import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActorType,
  BookingStatus,
  EventStatus,
  FulfilmentType,
  MovementType,
  OrderChannel,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrepBatchStatus,
  Prisma,
  ProductType,
} from '@prisma/client';
import type { Tx } from '../common/types/transaction';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { convertUnit } from '../common/utils/unit-conversion';
import { toDecimal, toPaise, type Paise } from '../common/money/money';
import {
  SERIALIZABLE_TX_OPTIONS,
  hasPrismaCode,
  withSerializableRetry,
} from '../common/utils/transaction-retry';
import {
  DomainEvent,
  customerActor,
  domainEventBase,
  emitDomainEvent,
} from '../common/events/domain-events';
import type { PendingOrderV2, QuoteHold } from '../checkout/quote.types';
import {
  CouponsService,
  type CouponRedeemedEvent,
} from '../promotions/coupons.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { OCCUPYING_BOOKINGS } from '../events/events.service';
import { RefundsService } from '../refunds/refunds.service';
import { SYSTEM_USER_ID } from '../common/constants/system-actor';

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
  product_id: string;
  quantity: number;
}

export interface FulfilmentOrder {
  id: string;
  zone_id: string | null;
}

/** An `OrderItem` the confirm transaction has to route, with its live fulfilment. */
export interface ConfirmedOrderItem extends FulfilmentOrderItem {
  fulfilment: FulfilmentType;
}

/**
 * The **v1** shape stored in Redis under `pending_order:{rzp_order_id}` by the
 * pre-P5a `CustomerOrdersService.checkoutCart`. Every money field is *rupees*.
 *
 * Kept exported and readable (decision 5): the key carries a 30-minute TTL, so
 * for one deploy window a customer can pay against a v1 record and confirm
 * against the P5a build. {@link upgradePendingOrder} lifts it to
 * {@link PendingOrderV2} in memory — zero discount, zero shipping, zero
 * loyalty, every line `local` — so exactly one code path writes orders.
 */
export interface PendingOrderData {
  customerId: string;
  cart: {
    items: Array<{
      productId: string;
      variantId?: string | null;
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

/** Either shape may still be sitting in Redis; the service normalises on the way in. */
export type PendingOrderPayload = PendingOrderV2 | PendingOrderData;

/**
 * The one message a customer sees when a booking line cannot be honoured after
 * payment. Exported so the storefront and the webhook can match on it.
 */
export const BOOKING_HOLD_EXPIRED =
  'Booking hold expired — payment will be refunded';

/** Reason stamped on the `Refund` this service raises without a human asking. */
export const AUTO_REFUND_REASON =
  'Auto-refund: seats unavailable after payment';

/** One booking line whose swept hold was replaced by a fresh confirmed seat. */
export interface ReacquiredSeat {
  order_item_id: string;
  product_id: string;
  event_id: string;
  guests: number;
  booking_id: string;
}

/** One booking line that could not be seated, and why. */
export interface UnseatableBookingLine {
  order_item_id: string;
  product_id: string;
  event_id: string | null;
  guests: number;
  reason: string;
}

/**
 * Raised **inside** the confirm transaction when at least one booking line has
 * no seat left, so the whole transaction rolls back.
 *
 * Rolling back is the point (SPEC §5.2): a paid order is all-or-nothing, and a
 * "confirmed" order missing the experience the customer paid for is worse than
 * no order at all. `confirmPaidOrder` catches this outside the transaction and
 * resolves the captured payment with a refund instead.
 *
 * Not an `HttpException`: it never reaches a client, it only crosses the
 * transaction boundary.
 */
export class BookingSeatUnavailableError extends Error {
  constructor(readonly lines: UnseatableBookingLine[]) {
    super(BOOKING_HOLD_EXPIRED);
    this.name = 'BookingSeatUnavailableError';
  }
}

/** What {@link OrderRefusedAndRefundedException} carries to its two callers. */
export interface OrderRefusedDetail {
  /** The `cancelled` → `refunded` order row the refund is hung off. */
  order_id: string;
  /** `null` when the gateway itself refused the refund — see the audit trail. */
  refund_id: string | null;
  refunded: boolean;
  lines: UnseatableBookingLine[];
}

/**
 * A captured marketplace payment that could **not** become an order and has
 * been sent back to the customer instead (SPEC §5.2: a captured payment always
 * resolves to a confirmed order or a refund).
 *
 * `409`, not `400`: the customer did nothing wrong — the seat went while their
 * money was in flight. Both entry points into `confirmPaidOrder` treat this as
 * *resolved*, not as a failure to retry: the pending-order key must **not** be
 * put back, or the next webhook delivery would try to charge the same seat
 * again.
 */
export class OrderRefusedAndRefundedException extends ConflictException {
  constructor(readonly detail: OrderRefusedDetail) {
    super(BOOKING_HOLD_EXPIRED);
  }
}

/**
 * How one booking line will be seated, decided by a read-only pass **before**
 * any booking row is written.
 *
 * Two passes rather than one because a partial order is forbidden: the plan has
 * to know that *every* line can be seated before the first `EventBooking` is
 * touched. It also keeps a unique-constraint violation out of the transaction —
 * in Postgres a failed statement poisons the whole transaction, so "try the
 * insert and catch P2002" is not available here.
 */
type SeatDecision =
  | {
      /** The 15-minute hold survived — promote it, exactly as P5a always did. */
      kind: 'hold';
      item: ConfirmedOrderItem;
      booking_id: string;
    }
  | {
      /** The hold was swept; capacity was taken again inside this transaction. */
      kind: 'reacquire';
      item: ConfirmedOrderItem;
      /** A reusable `cancelled`/`no_show`/stale-`held` row, else `null`. */
      booking_id: string | null;
      event_id: string;
      guests: number;
      gross: Paise;
    };

/** `EventBooking` carries the contact denormalised; a re-seat needs it. */
interface BookingContact {
  name: string | null;
  phone: string;
}

/** A v2 payload is self-describing; a v1 record has no `v` at all (decision 5). */
export function isPendingOrderV2(
  pending: PendingOrderPayload,
): pending is PendingOrderV2 {
  return (pending as PendingOrderV2).v === 2;
}

/**
 * v1 → v2 in memory. A v2 payload passes through untouched.
 *
 * The v1 record has no per-line tax, no coupon, no shipping and no booking
 * holds, because none of those existed when it was written — so the upgrade is
 * a pure widening: every absent field takes its neutral value and every line is
 * `local`, which is what the pre-P5a pipeline could produce.
 */
export function upgradePendingOrder(
  pending: PendingOrderPayload,
): PendingOrderV2 {
  if (isPendingOrderV2(pending)) return pending;
  return {
    v: 2,
    razorpay_order_id: '',
    idempotency_key: '',
    customer_id: pending.customerId,
    created_at: new Date().toISOString(),
    channel: pending.channel,
    delivery_address_id: pending.deliveryAddressId,
    pickup: false,
    lines: pending.cart.items.map((item) => {
      const unitPrice = toPaise(item.unitPrice);
      return {
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        name: item.name,
        sku: null,
        quantity: item.quantity,
        type: ProductType.prepared_food,
        fulfilment: FulfilmentType.local,
        unit_price: unitPrice,
        gross: unitPrice * item.quantity,
        tax_rate: '0.00',
        tax: 0,
        weight_grams: 0,
        hsn_code: null,
        available: true,
        unavailable_reason: null,
        event_id: null,
      };
    }),
    holds: [],
    subtotal: toPaise(pending.subtotal),
    discount_amount: 0,
    coupon: null,
    shipping_amount: 0,
    shipping: null,
    tax_amount: 0,
    tax_breakup: [],
    loyalty_points_redeemed: 0,
    loyalty_redeem_amount: 0,
    loyalty_points_earned_estimate: 0,
    total: toPaise(pending.total),
  };
}

/** `JSON.parse` + {@link upgradePendingOrder} — what every Redis reader wants. */
export function parsePendingOrder(raw: string): PendingOrderV2 {
  return upgradePendingOrder(JSON.parse(raw) as PendingOrderPayload);
}

/**
 * The amount the customer owes, in paise, whichever payload version is in
 * Redis — a v2 total is already paise, a v1 total is rupees.
 *
 * Every "did they pay what we asked?" check goes through this. Doing the
 * conversion at the comparison site is how a v1 rupee total silently became a
 * 100× mismatch the moment v2 payloads started being written.
 */
export function pendingTotalPaise(pending: PendingOrderPayload): Paise {
  return isPendingOrderV2(pending) ? pending.total : toPaise(pending.total);
}

export interface ConfirmPaidOrderInput {
  customerId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  /**
   * The frozen quote replayed into the order. A legacy v1 record is accepted
   * and upgraded in memory (decision 5), so the storefront and the webhook keep
   * working across the deploy that introduces v2 payloads.
   */
  pending: PendingOrderPayload;
  /** Which surface produced the order: the storefront confirm endpoint or the webhook fallback. */
  placedVia: OrderSource;
}

export const CONFIRMED_ORDER_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true } } } },
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
  private readonly logger = new Logger(FulfilmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
    private readonly coupons: CouponsService,
    private readonly loyalty: LoyaltyService,
    /** `RefundsModule` is `@Global()`, so this needs no module edit. */
    private readonly refunds: RefundsService,
  ) {}

  /**
   * Resolves the zone that fulfils marketplace (customer app) orders: the zone
   * configured in SystemSetting, else the first production kitchen by name.
   */
  async resolveMarketplaceZoneId(tx: Tx): Promise<string> {
    const setting = await tx.systemSetting.findUnique({
      where: { key: MARKETPLACE_ZONE_SETTING_KEY },
    });
    const configuredZoneId =
      typeof setting?.value === 'string' ? setting.value : null;
    if (configuredZoneId) {
      const zone = await tx.zone.findUnique({
        where: { id: configuredZoneId },
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

    const products = await tx.product.findMany({
      where: { id: { in: [...new Set(items.map((i) => i.product_id))] } },
      select: {
        id: true,
        recipe: { select: { id: true, preparation_type: true } },
      },
    });
    const recipeByProduct = new Map(products.map((p) => [p.id, p.recipe]));
    const readyAt = new Date();

    for (const item of items) {
      const recipe = recipeByProduct.get(item.product_id);
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
    const product = await tx.product.findUniqueOrThrow({
      where: { id: orderItem.product_id },
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

    // `Product.recipe` is optional (merchandise/experience products carry no BOM);
    // such a product has nothing to deduct.
    for (const line of product.recipe?.RecipeLines ?? []) {
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
   * The single "paid marketplace order" path (`CHK-04`), used by
   * `POST /customer/orders/confirm` and the Razorpay `payment.captured`
   * webhook. Serializable + retry; a duplicate payment id (P2002) resolves to
   * the already-created order.
   *
   * Everything commercial about a paid order commits together: the money
   * columns copied from the frozen quote, the per-line fulfilment routing, the
   * stock deductions, the coupon redemption, the loyalty spend, the booking
   * holds and the audit row. Nothing is a follow-up write — a crash after the
   * commit can only lose events, never money.
   *
   * The numbers are **not** recomputed here. `pending` is the quote the
   * customer was shown and paid against; recomputing would let a catalog edit
   * between quote and confirm change what was charged.
   */
  async confirmPaidOrder(input: ConfirmPaidOrderInput) {
    const { customerId } = input;
    const pending = upgradePendingOrder(input.pending);
    const address = await this.resolveDeliveryAddress(customerId, pending);
    // Loyalty spends like a coupon — both reduce what was actually charged, and
    // `Order` has one discount column to carry the pair.
    const discount = pending.discount_amount + pending.loyalty_redeem_amount;

    try {
      const { order, couponEvent } = await withSerializableRetry(() =>
        this.prisma.$transaction(async (tx) => {
          const zoneId = await this.resolveMarketplaceZoneId(tx);

          const created = await tx.order.create({
            data: {
              channel: pending.channel,
              customer_id: customerId,
              subtotal: toDecimal(pending.subtotal),
              // CartPricingService folds the channel modifier into `unit_price`,
              // so the standalone column stays zero for marketplace orders.
              channel_modifier_amount: toDecimal(0),
              discount_amount: toDecimal(discount),
              shipping_amount: toDecimal(pending.shipping_amount),
              // Carved *out of* `subtotal` (decision 1) — never added to `total`.
              tax_amount: toDecimal(pending.tax_amount),
              total: toDecimal(pending.total),
              coupon_id: pending.coupon?.id ?? null,
              loyalty_points_redeemed: pending.loyalty_points_redeemed,
              // Credited on delivery (LOYAL-02), not on payment.
              loyalty_points_earned: 0,
              idempotency_key: pending.idempotency_key || null,
              address_snapshot: address.snapshot ?? Prisma.JsonNull,
              delivery_address: address.text,
              status: OrderStatus.placed,
              placed_via: input.placedVia,
              created_by: null,
              zone_id: zoneId,
              items: {
                create: pending.lines.map((line) => ({
                  product_id: line.product_id,
                  variant_id: line.variant_id,
                  quantity: line.quantity,
                  unit_price: toDecimal(line.unit_price),
                  tax_rate: new Prisma.Decimal(line.tax_rate),
                  fulfilment: line.fulfilment,
                })),
              },
              payment: {
                create: {
                  method: PaymentMethod.razorpay,
                  amount: toDecimal(pending.total),
                  status: PaymentStatus.paid,
                  razorpay_order_id: input.razorpayOrderId,
                  razorpay_payment_id: input.razorpayPaymentId,
                },
              },
            },
            include: { items: true },
          });

          // Re-read `Product.fulfilment` *before* anything routes on it
          // (decision 6): a catalog edit between quote and confirm must not
          // send a now-shipped line through the kitchen's BOM deduction, nor
          // leave a now-local line unprepared.
          const items = await this.reconcileFulfilment(tx, created.items);

          await this.applyPrepTypeOnCreate(
            tx,
            { id: created.id, zone_id: created.zone_id },
            items.filter((item) => item.fulfilment === FulfilmentType.local),
            { actor_type: ActorType.customer, actor_id: customerId },
          );

          const { couponEvent: event, reacquired } =
            await this.applyCommercialEffects(
              tx,
              { id: created.id, node_id: created.node_id, items },
              pending,
              customerId,
            );

          // The seat was re-taken after the 15-minute hold had already been
          // swept — a fact that is invisible on the order row and has to be
          // recoverable when someone asks why an event went over its old count.
          if (reacquired.length > 0) {
            await this.auditService.record(tx, {
              entity_type: 'order',
              entity_id: created.id,
              action: 'order.booking_reacquired',
              node_id: created.node_id,
              ...AuditService.customer(customerId),
              after: {
                razorpay_payment_id: input.razorpayPaymentId,
                lines: reacquired.map((line) => ({
                  order_item_id: line.order_item_id,
                  product_id: line.product_id,
                  event_id: line.event_id,
                  guests: line.guests,
                  booking_id: line.booking_id,
                })),
              },
            });
          }

          await this.auditService.record(tx, {
            entity_type: 'order',
            entity_id: created.id,
            action: 'order.confirmed',
            node_id: created.node_id,
            ...AuditService.customer(customerId),
            after: {
              status: OrderStatus.placed,
              placed_via: input.placedVia,
              razorpay_payment_id: input.razorpayPaymentId,
              total: String(toDecimal(pending.total)),
              discount_amount: String(toDecimal(discount)),
              shipping_amount: String(toDecimal(pending.shipping_amount)),
              tax_amount: String(toDecimal(pending.tax_amount)),
              coupon_code: pending.coupon?.code ?? null,
              loyalty_points_redeemed: pending.loyalty_points_redeemed,
            },
          });

          const full = await tx.order.findUniqueOrThrow({
            where: { id: created.id },
            include: CONFIRMED_ORDER_INCLUDE,
          });
          return { order: full, couponEvent: event };
        }, SERIALIZABLE_TX_OPTIONS),
      );

      // Emit AFTER the transaction commits (SPEC §4.1). The P2002 replay path
      // below returns the already-created order and deliberately does not
      // re-emit — the order was confirmed once.
      emitDomainEvent(this.eventEmitter, DomainEvent.ORDER_CONFIRMED, {
        ...domainEventBase(order.node_id, customerActor(customerId)),
        orderId: order.id,
        orderNumber: order.order_number,
        channel: order.channel,
        total: String(order.total),
        itemCount: order.items.length,
        customerId: order.customer_id,
      });
      if (couponEvent) this.coupons.emitRedeemed(couponEvent);

      return order;
    } catch (err) {
      // SPEC §5.2 — a captured marketplace payment must resolve to a confirmed
      // order or to a refund. The transaction has already rolled back, so
      // nothing partial exists; the money is what is left to settle.
      if (err instanceof BookingSeatUnavailableError) {
        return await this.refuseAndRefund(input, pending, err.lines);
      }
      if (hasPrismaCode(err, 'P2002')) {
        const existing = await this.findOrderByRazorpayPaymentId(
          input.razorpayPaymentId,
        );
        if (existing) return existing;
      }
      throw err;
    }
  }

  /**
   * The other half of the §5.2 invariant: the payment was captured, the order
   * cannot exist, so the money goes back.
   *
   * Three writes, in this order and no other:
   *
   * 1. A **`cancelled`** `Order` with its `OrderItem`s `cancelled` and a `paid`
   *    `Payment`. `OrderStatus` has no `failed` member and `Refund.order_id` /
   *    `Payment.order_id` are both required, so a row is the only shape this
   *    schema supports for a refund — and `cancelled` is the honest word for an
   *    order that never reached the kitchen. `RefundsService.settle` moves it on
   *    to `refunded` once the full amount is back, which is where it belongs.
   *    **No** coupon redemption, **no** loyalty spend, **no** stock movement and
   *    **no** booking: none of those happened.
   * 2. The gateway refund, through the one `RefundsService` that owns `Refund`
   *    rows and `Payment.refunded_amount`, as the system actor.
   * 3. `OrderRefusedAndRefundedException`, which tells both callers this payment
   *    is *resolved* — the pending-order key must not be restored.
   *
   * A gateway that refuses the refund is not allowed to undo step 1: the
   * `Refund` row `RefundsService` already opened stays `failed`, an audit event
   * puts it in front of the order desk, and the exception still carries
   * `refunded: false`. Losing the order row here would leave a captured payment
   * with nothing at all attached to it — the exact defect being fixed.
   */
  private async refuseAndRefund(
    input: ConfirmPaidOrderInput,
    pending: PendingOrderV2,
    lines: UnseatableBookingLine[],
  ): Promise<never> {
    const reason = lines[0]?.reason ?? BOOKING_HOLD_EXPIRED;
    const { order, alreadyRecorded, alreadyRefunded } =
      await this.recordRefusedOrder(input, pending, lines, reason);

    // A replayed capture lands on the order the first delivery already refused.
    // Re-calling the gateway would only earn a "payment already refunded"
    // rejection, so the replay stays the no-op it has to be — and the flag
    // reports what the `Payment` row actually says, not what it should say.
    if (alreadyRecorded) {
      throw new OrderRefusedAndRefundedException({
        order_id: order.id,
        refund_id: null,
        refunded: alreadyRefunded,
        lines,
      });
    }

    let refundId: string | null = null;
    try {
      const refund = await this.refunds.refund(
        order.id,
        { reason: `${AUTO_REFUND_REASON} — ${reason}`.slice(0, 200) },
        SYSTEM_USER_ID,
      );
      refundId = refund.id;
    } catch (err) {
      this.logger.error(
        `Auto-refund failed for payment ${input.razorpayPaymentId} on refused order ${order.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      await this.prisma.$transaction((tx) =>
        this.auditService.record(tx, {
          entity_type: 'order',
          entity_id: order.id,
          action: 'order.auto_refund_failed',
          node_id: order.node_id,
          actor_type: ActorType.system,
          actor_id: null,
          after: {
            razorpay_payment_id: input.razorpayPaymentId,
            amount: String(toDecimal(pending.total)),
            error: err instanceof Error ? err.message : String(err),
          },
        }),
      );
    }

    throw new OrderRefusedAndRefundedException({
      order_id: order.id,
      refund_id: refundId,
      refunded: refundId !== null,
      lines,
    });
  }

  /**
   * Writes the refused order, its cancelled items, its captured payment and the
   * `order.payment_refused` audit row in one transaction.
   *
   * `alreadyRecorded` distinguishes the replay: `Payment.razorpay_payment_id` is
   * unique, so a second capture for the same payment trips P2002 and resolves to
   * the order the first pass wrote rather than creating a second one.
   * `alreadyRefunded` then reports what that payment row actually says, so a
   * replay after a *failed* auto-refund does not claim the money went back.
   */
  private async recordRefusedOrder(
    input: ConfirmPaidOrderInput,
    pending: PendingOrderV2,
    lines: UnseatableBookingLine[],
    reason: string,
  ): Promise<{
    order: { id: string; node_id: string };
    alreadyRecorded: boolean;
    alreadyRefunded: boolean;
  }> {
    try {
      const order = await withSerializableRetry(() =>
        this.prisma.$transaction(async (tx) => {
          const created = await tx.order.create({
            data: {
              channel: pending.channel,
              customer_id: input.customerId,
              subtotal: toDecimal(pending.subtotal),
              channel_modifier_amount: toDecimal(0),
              // The money columns are copied so the order reconciles against the
              // bank statement, but nothing commercial was *applied*: no coupon
              // was redeemed and no points were spent, so neither is claimed.
              discount_amount: toDecimal(
                pending.discount_amount + pending.loyalty_redeem_amount,
              ),
              shipping_amount: toDecimal(pending.shipping_amount),
              tax_amount: toDecimal(pending.tax_amount),
              total: toDecimal(pending.total),
              coupon_id: null,
              loyalty_points_redeemed: 0,
              loyalty_points_earned: 0,
              idempotency_key: pending.idempotency_key || null,
              address_snapshot: Prisma.JsonNull,
              delivery_address: null,
              status: OrderStatus.cancelled,
              placed_via: input.placedVia,
              created_by: null,
              // Deliberately unzoned: nothing was routed to a kitchen, and a
              // zone would put this order on a production queue.
              zone_id: null,
              items: {
                create: pending.lines.map((line) => ({
                  product_id: line.product_id,
                  variant_id: line.variant_id,
                  quantity: line.quantity,
                  unit_price: toDecimal(line.unit_price),
                  tax_rate: new Prisma.Decimal(line.tax_rate),
                  fulfilment: line.fulfilment,
                  status: OrderItemStatus.cancelled,
                })),
              },
              payment: {
                create: {
                  method: PaymentMethod.razorpay,
                  amount: toDecimal(pending.total),
                  status: PaymentStatus.paid,
                  razorpay_order_id: input.razorpayOrderId,
                  razorpay_payment_id: input.razorpayPaymentId,
                },
              },
            },
            select: { id: true, node_id: true },
          });

          await this.auditService.record(tx, {
            entity_type: 'order',
            entity_id: created.id,
            action: 'order.payment_refused',
            node_id: created.node_id,
            actor_type: ActorType.system,
            actor_id: null,
            after: {
              status: OrderStatus.cancelled,
              placed_via: input.placedVia,
              razorpay_payment_id: input.razorpayPaymentId,
              total: String(toDecimal(pending.total)),
              reason,
              unseatable: lines.map((line) => ({
                order_item_id: line.order_item_id,
                product_id: line.product_id,
                event_id: line.event_id,
                guests: line.guests,
                reason: line.reason,
              })),
            },
          });

          return created;
        }, SERIALIZABLE_TX_OPTIONS),
      );
      return { order, alreadyRecorded: false, alreadyRefunded: false };
    } catch (err) {
      if (hasPrismaCode(err, 'P2002')) {
        const existing = await this.findOrderByRazorpayPaymentId(
          input.razorpayPaymentId,
        );
        if (existing) {
          const status = existing.payment?.status;
          return {
            order: { id: existing.id, node_id: existing.node_id },
            alreadyRecorded: true,
            alreadyRefunded:
              status === PaymentStatus.refunded ||
              status === PaymentStatus.partially_refunded,
          };
        }
      }
      throw err;
    }
  }

  /**
   * Reconciles each freshly created `OrderItem` against the live
   * `Product.fulfilment` (decision 6).
   *
   * The quote froze a routing decision up to 45 minutes ago. Honouring the
   * frozen value blindly would let a staff member who flipped a product from
   * `local` to `shipped` send a paid line to a kitchen that can no longer make
   * it; recomputing the *price* would be wrong for the same reason, but
   * recomputing the *route* is exactly right — the customer bought the product,
   * not the logistics.
   */
  private async reconcileFulfilment(
    tx: Tx,
    items: ConfirmedOrderItem[],
  ): Promise<ConfirmedOrderItem[]> {
    if (items.length === 0) return [];

    const products = await tx.product.findMany({
      where: { id: { in: [...new Set(items.map((i) => i.product_id))] } },
      select: { id: true, fulfilment: true },
    });
    const live = new Map(products.map((p) => [p.id, p.fulfilment]));

    const reconciled: ConfirmedOrderItem[] = [];
    for (const item of items) {
      const current = live.get(item.product_id);
      if (current === undefined || current === item.fulfilment) {
        reconciled.push(item);
        continue;
      }
      await tx.orderItem.update({
        where: { id: item.id },
        data: { fulfilment: current },
      });
      reconciled.push({ ...item, fulfilment: current });
    }
    return reconciled;
  }

  /**
   * `CHK-04`: every commercial side effect of a paid order, in the same
   * Serializable transaction as the order itself. Routing per line:
   *   `local`   → {@link applyPrepTypeOnCreate} already handled it (KDS vs BOM)
   *   `shipped` → the item joins the pack queue
   *   `booking` → the 15-minute hold becomes `confirmed` and is linked to the item
   *
   * Returns the `coupon.redeemed` payload rather than emitting it: SPEC §4.1
   * requires events only after the transaction commits, and this runs inside it.
   * `reacquired` lists the booking lines whose hold had already been swept and
   * whose seat had to be taken again.
   */
  private async applyCommercialEffects(
    tx: Tx,
    order: { id: string; node_id: string; items: ConfirmedOrderItem[] },
    pending: PendingOrderV2,
    customerId: string,
  ): Promise<{
    couponEvent: CouponRedeemedEvent | null;
    reacquired: ReacquiredSeat[];
  }> {
    const shipped = order.items.filter(
      (item) => item.fulfilment === FulfilmentType.shipped,
    );
    if (shipped.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: shipped.map((item) => item.id) } },
        data: { status: OrderItemStatus.packed },
      });
    }

    const reacquired = await this.confirmBookingHolds(
      tx,
      order.items.filter((item) => item.fulfilment === FulfilmentType.booking),
      pending,
      customerId,
    );

    // PROMO-02. `redeem` is an upsert on (coupon_id, order_id), so a retried
    // transaction cannot double-count the redemption.
    let couponEvent: CouponRedeemedEvent | null = null;
    if (pending.coupon && pending.discount_amount > 0) {
      const { event } = await this.coupons.redeem(tx, {
        couponId: pending.coupon.id,
        orderId: order.id,
        customerId,
        amount: pending.discount_amount,
        nodeId: order.node_id,
        actor: customerActor(customerId),
      });
      couponEvent = event;
    }

    // LOYAL-02 — the *spend*. Points are earned on delivery, not on payment.
    if (pending.loyalty_points_redeemed > 0) {
      await this.loyalty.redeemForOrder(
        tx,
        customerId,
        order.id,
        pending.loyalty_points_redeemed,
      );
    }

    return { couponEvent, reacquired };
  }

  /**
   * Promotes each booking line's 15-minute hold to a confirmed `EventBooking`
   * and links it to the item that paid for it.
   *
   * Holds are matched to items **by product**, not by position: `order.items`
   * comes back from a nested create and its order is the database's, not the
   * quote's.
   *
   * A hold that is **gone** is no longer fatal. The hold window is 15 minutes
   * and the pending-order key lives 30, so a customer who pays late has their
   * seat swept out from under them by `EventHoldsCron` through no fault of their
   * own — and before this, `applyCommercialEffects` threw and left a captured
   * payment with no order at all (SPEC §5.2 violated). Instead the seat is
   * **taken again** inside this same Serializable transaction with the same
   * hold-aware arithmetic the quote used (`capacity − confirmed − live holds`,
   * `OCCUPYING_BOOKINGS`). Only when a line genuinely cannot be re-seated does
   * this raise {@link BookingSeatUnavailableError}, and then for the *whole*
   * order — never a partial confirmation.
   *
   * `razorpay_payment_id` is cleared: that id belongs to the order's `Payment`
   * row, and `EventBooking.razorpay_payment_id` is unique, so copying it would
   * make a second booking on the same payment impossible.
   *
   * Returns the lines whose seat had to be re-acquired, for the audit trail.
   */
  private async confirmBookingHolds(
    tx: Tx,
    bookingItems: ConfirmedOrderItem[],
    pending: PendingOrderV2,
    customerId: string,
  ): Promise<ReacquiredSeat[]> {
    if (bookingItems.length === 0) return [];

    const { decisions, unseatable, contact } = await this.planBookingSeats(
      tx,
      bookingItems,
      pending,
      customerId,
    );
    if (unseatable.length > 0)
      throw new BookingSeatUnavailableError(unseatable);

    const reacquired: ReacquiredSeat[] = [];
    for (const decision of decisions) {
      let bookingId: string;

      if (decision.kind === 'hold') {
        await tx.eventBooking.update({
          where: { id: decision.booking_id },
          data: {
            status: BookingStatus.confirmed,
            payment_status: 'paid',
            hold_expires_at: null,
            razorpay_payment_id: null,
          },
        });
        bookingId = decision.booking_id;
      } else if (decision.booking_id) {
        // Reusing the row rather than inserting a new one: at most one booking
        // can exist per (event, customer_phone), so a `cancelled` or stale
        // `held` row is the only seat this customer can hold on this event.
        await tx.eventBooking.update({
          where: { id: decision.booking_id },
          data: {
            status: BookingStatus.confirmed,
            payment_status: 'paid',
            hold_expires_at: null,
            razorpay_payment_id: null,
            customer_id: customerId,
            guests: decision.guests,
            payment_amount: toDecimal(decision.gross),
          },
        });
        bookingId = decision.booking_id;
      } else {
        // `planBookingSeats` refuses any line whose customer row is missing, so
        // a decision that reaches an insert always carries a contact. Guarded
        // rather than defaulted: a booking with a blank phone would collide with
        // every other phoneless row on `@@unique([event_id, customer_phone])`.
        if (!contact) {
          throw new BookingSeatUnavailableError([
            {
              order_item_id: decision.item.id,
              product_id: decision.item.product_id,
              event_id: decision.event_id,
              guests: decision.guests,
              reason: 'Customer record not found',
            },
          ]);
        }
        const created = await tx.eventBooking.create({
          data: {
            event_id: decision.event_id,
            customer_id: customerId,
            customer_name: contact.name ?? 'Guest',
            customer_phone: contact.phone,
            guests: decision.guests,
            status: BookingStatus.confirmed,
            payment_status: 'paid',
            hold_expires_at: null,
            payment_amount: toDecimal(decision.gross),
          },
          select: { id: true },
        });
        bookingId = created.id;
      }

      await tx.orderItem.update({
        where: { id: decision.item.id },
        data: {
          event_booking_id: bookingId,
          status: OrderItemStatus.ready,
        },
      });

      if (decision.kind === 'reacquire') {
        reacquired.push({
          order_item_id: decision.item.id,
          product_id: decision.item.product_id,
          event_id: decision.event_id,
          guests: decision.guests,
          booking_id: bookingId,
        });
      }
    }

    return reacquired;
  }

  /**
   * The read-only half of {@link confirmBookingHolds}: decides how every
   * booking line would be seated, without writing anything.
   *
   * Nothing is recomputed for a line whose hold survived — that seat was never
   * given back, and re-checking capacity would let a staff member who shrank an
   * event between quote and confirm turn a legitimately held seat into a refund.
   * The capacity arithmetic runs **only** on the re-acquire path.
   *
   * `reserved` carries seats already promised to earlier lines of this same
   * order, so two lines pointing at one event cannot both be told the last seat
   * is theirs.
   */
  private async planBookingSeats(
    tx: Tx,
    bookingItems: ConfirmedOrderItem[],
    pending: PendingOrderV2,
    customerId: string,
  ): Promise<{
    decisions: SeatDecision[];
    unseatable: UnseatableBookingLine[];
    contact: BookingContact | null;
  }> {
    const queues = new Map<string, QuoteHold[]>();
    for (const hold of pending.holds) {
      const queue = queues.get(hold.product_id);
      if (queue) queue.push(hold);
      else queues.set(hold.product_id, [hold]);
    }

    const decisions: SeatDecision[] = [];
    const unseatable: UnseatableBookingLine[] = [];
    const reserved = new Map<string, number>();
    const now = new Date();
    let contact: BookingContact | null = null;

    for (const item of bookingItems) {
      const hold = queues.get(item.product_id)?.shift() ?? null;
      const held = hold
        ? await tx.eventBooking.findUnique({
            where: { id: hold.booking_id },
            select: { id: true, status: true },
          })
        : null;

      if (held && held.status !== BookingStatus.cancelled) {
        decisions.push({ kind: 'hold', item, booking_id: held.id });
        continue;
      }

      // ── the hold is gone: take the capacity again ───────────────────────
      const line = pending.lines.find(
        (candidate) =>
          candidate.product_id === item.product_id && candidate.event_id,
      );
      const eventId = hold?.event_id ?? line?.event_id ?? null;
      const guests = hold?.guests ?? item.quantity;
      const refuse = (reason: string) =>
        unseatable.push({
          order_item_id: item.id,
          product_id: item.product_id,
          event_id: eventId,
          guests,
          reason,
        });

      if (!eventId) {
        refuse('This experience is no longer on the catalogue');
        continue;
      }

      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: { id: true, capacity: true, status: true },
      });
      if (!event || event.status === EventStatus.cancelled) {
        refuse('This experience is no longer running');
        continue;
      }

      contact ??= await this.bookingContact(tx, customerId);
      if (!contact) {
        refuse('Customer record not found');
        continue;
      }

      // `@@unique([event_id, customer_phone])` — one row per customer per
      // event. Found first, and reused rather than inserted alongside: a P2002
      // inside a Postgres transaction aborts the transaction outright, so the
      // constraint has to be avoided, not caught.
      const existing = await tx.eventBooking.findFirst({
        where: { event_id: eventId, customer_phone: contact.phone },
        select: { id: true, status: true },
      });
      if (
        existing &&
        (existing.status === BookingStatus.confirmed ||
          existing.status === BookingStatus.attended)
      ) {
        // Some other order already owns this customer's only possible seat;
        // confirming here would sell it twice.
        refuse('This experience is already booked on another order');
        continue;
      }

      const occupancy = await tx.eventBooking.aggregate({
        where: {
          event_id: eventId,
          ...OCCUPYING_BOOKINGS(now),
          // The row about to be promoted must not count against itself.
          ...(existing ? { NOT: { id: existing.id } } : {}),
        },
        _sum: { guests: true },
      });
      const taken = (occupancy._sum.guests ?? 0) + (reserved.get(eventId) ?? 0);
      if (event.capacity - taken < guests) {
        refuse('The last seats went while the payment was being taken');
        continue;
      }

      reserved.set(eventId, (reserved.get(eventId) ?? 0) + guests);
      decisions.push({
        kind: 'reacquire',
        item,
        booking_id: existing?.id ?? null,
        event_id: eventId,
        guests,
        gross: line?.gross ?? 0,
      });
    }

    return { decisions, unseatable, contact };
  }

  /** The denormalised contact an `EventBooking` row needs. */
  private async bookingContact(
    tx: Tx,
    customerId: string,
  ): Promise<BookingContact | null> {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { name: true, phone: true },
    });
    return customer ? { name: customer.name, phone: customer.phone } : null;
  }

  /**
   * Resolves the saved `CustomerAddress` into the denormalised
   * `Order.delivery_address` text **and** the `Order.address_snapshot` JSON.
   *
   * The snapshot is frozen at confirm time: editing the saved address later
   * must not rewrite the address a courier was already given (SPEC §3.3).
   *
   * An address is needed when the order is delivered locally *or* when any line
   * ships — a `takeaway` channel order can still contain merchandise.
   */
  private async resolveDeliveryAddress(
    customerId: string,
    pending: PendingOrderV2,
  ): Promise<{ text: string | null; snapshot: Prisma.InputJsonObject | null }> {
    const needsAddress =
      pending.channel === OrderChannel.delivery ||
      pending.lines.some((line) => line.fulfilment === FulfilmentType.shipped);
    if (!needsAddress || !pending.delivery_address_id) {
      return { text: null, snapshot: null };
    }

    const addr = await this.prisma.customerAddress.findFirst({
      where: { id: pending.delivery_address_id, customer_id: customerId },
    });
    if (!addr) return { text: null, snapshot: null };

    let text = addr.address;
    if (addr.landmark) text += `, ${addr.landmark}`;
    return {
      text: `${text} - ${addr.pincode}`,
      snapshot: {
        id: addr.id,
        label: addr.label,
        address: addr.address,
        landmark: addr.landmark,
        pincode: addr.pincode,
        lat: addr.lat,
        lng: addr.lng,
      },
    };
  }
}
