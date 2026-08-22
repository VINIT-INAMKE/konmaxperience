import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ActorType,
  MovementType,
  OrderChannel,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrepBatchStatus,
  Prisma,
} from '@prisma/client';
import type { Tx } from '../common/types/transaction';
import { PrismaService } from '../prisma/prisma.service';
import { convertUnit } from '../common/utils/unit-conversion';
import {
  SERIALIZABLE_TX_OPTIONS,
  hasPrismaCode,
  withSerializableRetry,
} from '../common/utils/transaction-retry';

export const MARKETPLACE_ZONE_SETTING_KEY = 'marketplace_fulfilment_zone_id';
/** Zone.zone_type used by seed.ts for production kitchens ('Main Kitchen', 'Prep Station'). */
export const PRODUCTION_ZONE_TYPE = 'kitchen';

export type FulfilmentActorType = ActorType;

export interface FulfilmentActor {
  actor_type: ActorType;
  actor_id: string | null;
}

export interface FulfilmentOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
}

export interface FulfilmentOrder {
  id: string;
  zone_id: string | null;
}

/** Shape stored in Redis under pending_order:{rzp_order_id} by CustomerOrdersService.checkoutCart. */
export interface PendingOrderData {
  customerId: string;
  cart: {
    items: Array<{
      menuItemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      imageUrl: string | null;
    }>;
  };
  subtotal: number;
  modifierAmount: number;
  total: number;
  channel: OrderChannel;
  deliveryAddressId: string | null;
}

export interface ConfirmPaidOrderInput {
  customerId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  pending: PendingOrderData;
  /** Which surface produced the order: the storefront confirm endpoint or the webhook fallback. */
  placedVia: OrderSource;
}

export const CONFIRMED_ORDER_INCLUDE = {
  items: { include: { menu_item: { select: { id: true, name: true } } } },
  payment: true,
} satisfies Prisma.OrderInclude;

export function actorForOrder(order: {
  created_by: string | null;
  customer_id: string | null;
}): FulfilmentActor {
  if (order.created_by)
    return { actor_type: ActorType.user, actor_id: order.created_by };
  if (order.customer_id)
    return { actor_type: ActorType.customer, actor_id: order.customer_id };
  return { actor_type: ActorType.system, actor_id: null };
}

@Injectable()
export class FulfilmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the zone that fulfils marketplace (customer app) orders: the zone
   * configured in SystemSetting, else the first production kitchen by name.
   */
  async resolveMarketplaceZoneId(tx: Tx): Promise<string> {
    const setting = await tx.systemSetting.findUnique({
      where: { key: MARKETPLACE_ZONE_SETTING_KEY },
    });
    if (setting?.value) {
      const zone = await tx.zone.findUnique({
        where: { id: setting.value },
        select: { id: true },
      });
      if (zone) return zone.id;
    }

    const fallback = await tx.zone.findFirst({
      where: { zone_type: PRODUCTION_ZONE_TYPE },
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    if (!fallback) {
      throw new ServiceUnavailableException(
        `No fulfilment zone configured for marketplace orders (set SystemSetting ${MARKETPLACE_ZONE_SETTING_KEY})`,
      );
    }
    return fallback.id;
  }

  /**
   * Routes freshly created order items by preparation_type:
   * scratch -> nothing (KDS deducts at "ready"); batch_prepared -> FIFO PrepBatch;
   * ready_to_sell/assemble -> BOM deduction. Every non-scratch item is set to "ready".
   */
  async applyPrepTypeOnCreate(
    tx: Tx,
    order: FulfilmentOrder,
    items: FulfilmentOrderItem[],
    actor: FulfilmentActor,
  ): Promise<void> {
    if (items.length === 0) return;
    if (!order.zone_id)
      throw new BadRequestException('Order has no fulfilment zone');
    const zoneId = order.zone_id;

    const menuItems = await tx.menuItem.findMany({
      where: { id: { in: [...new Set(items.map((i) => i.menu_item_id))] } },
      select: {
        id: true,
        recipe: { select: { id: true, preparation_type: true } },
      },
    });
    const recipeByMenuItem = new Map(menuItems.map((m) => [m.id, m.recipe]));
    const readyAt = new Date();

    for (const item of items) {
      const recipe = recipeByMenuItem.get(item.menu_item_id);
      const prepType = recipe?.preparation_type ?? 'scratch';
      if (!recipe || prepType === 'scratch') continue;

      if (prepType === 'batch_prepared') {
        await this.deductBatchPrepared(tx, recipe.id, item.quantity, zoneId);
      } else {
        await this.deductItemIngredients(tx, item, actor, zoneId);
      }
      await tx.orderItem.update({
        where: { id: item.id },
        data: { status: OrderItemStatus.ready, ready_at: readyAt },
      });
    }
  }

  /** FIFO deduction against PrepBatch for a batch_prepared recipe, soonest expiry first. Throws on shortfall. */
  async deductBatchPrepared(
    tx: Tx,
    recipeId: string,
    quantity: number,
    zoneId: string,
  ): Promise<void> {
    const batches = await tx.prepBatch.findMany({
      where: {
        recipe_id: recipeId,
        zone_id: zoneId,
        status: PrepBatchStatus.active,
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
      orderBy: [{ expires_at: 'asc' }, { created_at: 'asc' }],
    });

    let remaining = quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const batchQty = Number(batch.quantity_remaining);
      const deductFromBatch = Math.min(batchQty, remaining);
      await tx.prepBatch.update({
        where: { id: batch.id },
        data: {
          quantity_remaining: { decrement: deductFromBatch },
          status:
            batchQty - deductFromBatch <= 0
              ? PrepBatchStatus.depleted
              : PrepBatchStatus.active,
        },
      });
      remaining -= deductFromBatch;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Insufficient prepared batch quantity for recipe ${recipeId}: needed ${quantity}, short by ${remaining}`,
      );
    }
  }

  /**
   * BOM deduction for one order item: ingredient lines decrement IngredientStock (+ StockMovement),
   * recipe lines FIFO-decrement PrepBatch. `tx` MUST be the transaction client.
   */
  async deductItemIngredients(
    tx: Tx,
    orderItem: FulfilmentOrderItem,
    actor: FulfilmentActor,
    zoneId: string,
  ): Promise<void> {
    const menuItem = await tx.menuItem.findUniqueOrThrow({
      where: { id: orderItem.menu_item_id },
      select: {
        recipe: {
          select: {
            RecipeLines: {
              select: {
                input_type: true,
                quantity: true,
                unit: true,
                ingredient_id: true,
                ingredient: { select: { name: true, base_unit: true } },
                source_recipe_id: true,
                source_recipe: { select: { name: true, yield_unit: true } },
              },
            },
          },
        },
      },
    });

    // Multiply per-serving needs by quantity so N servings cost one stock lookup.
    const servings = orderItem.quantity;

    for (const line of menuItem.recipe.RecipeLines) {
      const totalNeeded = Number(line.quantity) * servings;

      if (
        line.input_type === 'ingredient' &&
        line.ingredient &&
        line.ingredient_id
      ) {
        const neededBase = await convertUnit(
          totalNeeded,
          line.unit,
          line.ingredient.base_unit,
          tx,
        );
        if (neededBase === null) {
          throw new BadRequestException(
            `No unit conversion from ${line.unit} to ${line.ingredient.base_unit}`,
          );
        }

        const stock = await tx.ingredientStock.findFirst({
          where: { ingredient_id: line.ingredient_id, zone_id: zoneId },
        });
        if (!stock || Number(stock.current_quantity) < neededBase) {
          throw new BadRequestException(
            `Insufficient stock for ${line.ingredient.name}`,
          );
        }

        await tx.ingredientStock.update({
          where: { id: stock.id },
          data: { current_quantity: { decrement: neededBase } },
        });

        await tx.stockMovement.create({
          data: {
            ingredient_id: line.ingredient_id,
            zone_id: zoneId,
            movement_type: MovementType.order_deducted,
            quantity: -neededBase,
            original_quantity: totalNeeded,
            unit: line.unit,
            reason: 'Order item deduction',
            reference_type: 'order',
            reference_id: orderItem.order_id,
            created_by: actor.actor_type === 'user' ? actor.actor_id : null,
            actor_type: actor.actor_type,
            actor_id: actor.actor_id,
          },
        });
      }

      if (
        line.input_type === 'recipe' &&
        line.source_recipe &&
        line.source_recipe_id
      ) {
        let remainingNeed = await convertUnit(
          totalNeeded,
          line.unit,
          line.source_recipe.yield_unit,
          tx,
        );
        if (remainingNeed === null) {
          throw new BadRequestException(
            `No unit conversion from ${line.unit} to ${line.source_recipe.yield_unit}`,
          );
        }

        const batches = await tx.prepBatch.findMany({
          where: {
            recipe_id: line.source_recipe_id,
            zone_id: zoneId,
            status: PrepBatchStatus.active,
            OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
          },
          orderBy: [{ expires_at: 'asc' }, { created_at: 'asc' }],
        });

        for (const batch of batches) {
          if (remainingNeed <= 0) break;
          const batchRemaining = Number(batch.quantity_remaining);
          const deduct = Math.min(batchRemaining, remainingNeed);
          await tx.prepBatch.update({
            where: { id: batch.id },
            data: {
              quantity_remaining: { decrement: deduct },
              ...(batchRemaining - deduct <= 0
                ? { status: PrepBatchStatus.depleted }
                : {}),
            },
          });
          remainingNeed -= deduct;
        }

        if (remainingNeed > 0) {
          throw new BadRequestException(
            `Insufficient prep batch stock for ${line.source_recipe.name}`,
          );
        }
      }
    }
  }

  findOrderByRazorpayPaymentId(razorpayPaymentId: string) {
    return this.prisma.order.findFirst({
      where: { payment: { razorpay_payment_id: razorpayPaymentId } },
      include: CONFIRMED_ORDER_INCLUDE,
    });
  }

  /**
   * The single "paid marketplace order" path, used by POST /customer/orders/confirm and the
   * Razorpay payment.captured webhook. Serializable + retry; a duplicate payment id (P2002)
   * resolves to the already-created order.
   */
  async confirmPaidOrder(input: ConfirmPaidOrderInput) {
    const { customerId, pending } = input;
    const deliveryAddress = await this.resolveDeliveryAddress(
      customerId,
      pending,
    );

    try {
      return await withSerializableRetry(() =>
        this.prisma.$transaction(async (tx) => {
          const zoneId = await this.resolveMarketplaceZoneId(tx);

          const created = await tx.order.create({
            data: {
              channel: pending.channel,
              customer_id: customerId,
              subtotal: pending.subtotal,
              channel_modifier_amount: pending.modifierAmount,
              total: pending.total,
              delivery_address: deliveryAddress,
              status: OrderStatus.placed,
              placed_via: input.placedVia,
              created_by: null,
              zone_id: zoneId,
              items: {
                create: pending.cart.items.map((item) => ({
                  menu_item_id: item.menuItemId,
                  quantity: item.quantity,
                  unit_price: item.unitPrice,
                })),
              },
              payment: {
                create: {
                  method: PaymentMethod.razorpay,
                  amount: pending.total,
                  status: PaymentStatus.paid,
                  razorpay_order_id: input.razorpayOrderId,
                  razorpay_payment_id: input.razorpayPaymentId,
                },
              },
            },
            include: { items: true },
          });

          await this.applyPrepTypeOnCreate(
            tx,
            { id: created.id, zone_id: created.zone_id },
            created.items,
            { actor_type: ActorType.customer, actor_id: customerId },
          );

          return tx.order.findUniqueOrThrow({
            where: { id: created.id },
            include: CONFIRMED_ORDER_INCLUDE,
          });
        }, SERIALIZABLE_TX_OPTIONS),
      );
    } catch (err) {
      if (hasPrismaCode(err, 'P2002')) {
        const existing = await this.findOrderByRazorpayPaymentId(
          input.razorpayPaymentId,
        );
        if (existing) return existing;
      }
      throw err;
    }
  }

  /** Flattens a saved CustomerAddress into the denormalised Order.delivery_address text. */
  private async resolveDeliveryAddress(
    customerId: string,
    pending: PendingOrderData,
  ): Promise<string | null> {
    if (pending.channel !== OrderChannel.delivery || !pending.deliveryAddressId)
      return null;
    const addr = await this.prisma.customerAddress.findFirst({
      where: { id: pending.deliveryAddressId, customer_id: customerId },
    });
    if (!addr) return null;
    let text = addr.address;
    if (addr.landmark) text += `, ${addr.landmark}`;
    return `${text} - ${addr.pincode}`;
  }
}
