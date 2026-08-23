import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderItemStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FulfilmentService,
  actorForOrder,
} from '../../fulfilment/fulfilment.service';
import {
  SERIALIZABLE_TX_OPTIONS,
  withSerializableRetry,
} from '../../common/utils/transaction-retry';

export interface KdsOrderItem {
  id: string;
  status: string;
  product_id: string;
  product_name: string;
  quantity: number;
  item_notes: string | null;
}

export interface KdsOrder {
  id: string;
  order_number: number;
  customer_name: string | null;
  created_at: string;
  status: string;
  items: KdsOrderItem[];
  zone_id: string;
}

export interface KdsZoneData {
  zone_id: string;
  zone_name: string;
  orders: KdsOrder[];
}

@Injectable()
export class KdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fulfilmentService: FulfilmentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getActiveOrders(): Promise<KdsZoneData[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.placed, OrderStatus.preparing] },
        zone_id: { not: null }, // KDS only shows kitchen (staff) orders with a zone
      },
      include: {
        items: {
          where: {
            product: {
              recipe: {
                preparation_type: 'scratch',
              },
            },
          },
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        zone: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    // Filter out orders with zero scratch items (only non-scratch items = nothing for KDS)
    const ordersWithScratchItems = orders.filter((o) => o.items.length > 0);

    // Group by zone
    const zoneMap = new Map<string, KdsZoneData>();

    for (const order of ordersWithScratchItems) {
      const zoneId = order.zone_id!;
      if (!zoneMap.has(zoneId)) {
        zoneMap.set(zoneId, {
          zone_id: zoneId,
          zone_name: order.zone!.name,
          orders: [],
        });
      }

      const kdsOrder: KdsOrder = {
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        created_at: order.created_at.toISOString(),
        status: order.status,
        zone_id: zoneId,
        items: order.items.map((item) => ({
          id: item.id,
          status: item.status,
          product_id: item.product_id,
          product_name: item.product.name,
          quantity: item.quantity,
          item_notes: item.item_notes,
        })),
      };

      zoneMap.get(zoneId)!.orders.push(kdsOrder);
    }

    return Array.from(zoneMap.values());
  }

  async updateItemStatus(
    itemId: string,
    newStatus: OrderItemStatus,
  ): Promise<{ id: string; status: OrderItemStatus; ready_at: Date | null }> {
    // The enum carries P5 members (packed/shipped/…) the KDS board cannot set
    const validStatuses: OrderItemStatus[] = [
      OrderItemStatus.pending,
      OrderItemStatus.preparing,
      OrderItemStatus.ready,
    ];
    if (!validStatuses.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status "${newStatus}". Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === OrderItemStatus.ready) {
      updateData.ready_at = new Date();
    }

    // When status is 'ready' — wrap in $transaction with deduction and Serializable isolation
    if (newStatus === OrderItemStatus.ready) {
      let wasAllReady = false;
      let orderData: {
        id: string;
        channel: string;
        created_by: string | null;
      } | null = null;

      const result = await withSerializableRetry(() =>
        this.prisma.$transaction(async (tx) => {
          // Fetch item INSIDE transaction to prevent concurrent status race
          const item = await tx.orderItem.findUnique({
            where: { id: itemId },
          });
          if (!item) {
            throw new NotFoundException(
              `Order item with ID ${itemId} not found`,
            );
          }

          // Validate status progression inside transaction
          const progressionMap: Record<string, string> = {
            pending: 'preparing',
            preparing: 'ready',
          };

          if (progressionMap[item.status] !== newStatus) {
            throw new BadRequestException(
              `Cannot transition from "${item.status}" to "${newStatus}". ` +
                `Valid next status: ${progressionMap[item.status] ?? 'none (already at final status)'}`,
            );
          }

          // Deduct ingredients/prep batches for this item (atomic)
          const order = await tx.order.findUniqueOrThrow({
            where: { id: item.order_id },
            select: {
              id: true,
              channel: true,
              created_by: true,
              customer_id: true,
              zone_id: true,
            },
          });
          if (!order.zone_id) {
            throw new BadRequestException(
              'Order has no fulfilment zone; cannot deduct stock',
            );
          }
          await this.fulfilmentService.deductItemIngredients(
            tx,
            {
              id: item.id,
              order_id: item.order_id,
              product_id: item.product_id,
              quantity: item.quantity,
            },
            actorForOrder(order),
            order.zone_id,
          );

          // Update item status
          const updated = await tx.orderItem.update({
            where: { id: itemId },
            data: updateData,
          });

          // Check if ALL items in order are ready -> auto-transition order
          // Only count non-ready siblings (excluding the current item we just marked ready)
          const notReadyCount = await tx.orderItem.count({
            where: {
              order_id: item.order_id,
              id: { not: itemId },
              status: { not: OrderItemStatus.ready },
            },
          });
          const allReady = notReadyCount === 0;
          if (allReady) {
            await tx.order.update({
              where: { id: item.order_id },
              data: { status: OrderStatus.ready },
            });
            wasAllReady = true;
            orderData = {
              id: order.id,
              channel: order.channel,
              created_by: order.created_by,
            };
          }

          return {
            id: updated.id,
            status: updated.status,
            ready_at: updated.ready_at,
          };
        }, SERIALIZABLE_TX_OPTIONS),
      );

      // Emit AFTER transaction commits (Pitfall 1 compliance)
      if (wasAllReady && orderData) {
        try {
          this.eventEmitter.emit('order.ready', {
            orderId: (
              orderData as { id: string; channel: string; created_by: string }
            ).id,
            channel: (
              orderData as { id: string; channel: string; created_by: string }
            ).channel,
            createdBy: (
              orderData as { id: string; channel: string; created_by: string }
            ).created_by,
          });
        } catch (e) {
          /* event emission failed - non-critical */
        }
      }

      return result;
    }

    // Non-ready transitions (e.g., pending -> preparing) — wrap in transaction for concurrency safety
    const result = await this.prisma.$transaction(async (tx) => {
      // Fetch item INSIDE transaction to prevent concurrent status race
      const item = await tx.orderItem.findUnique({
        where: { id: itemId },
      });
      if (!item) {
        throw new NotFoundException(`Order item with ID ${itemId} not found`);
      }

      // Validate status progression inside transaction
      const progressionMap: Record<string, string> = {
        pending: 'preparing',
        preparing: 'ready',
      };

      if (progressionMap[item.status] !== newStatus) {
        throw new BadRequestException(
          `Cannot transition from "${item.status}" to "${newStatus}". ` +
            `Valid next status: ${progressionMap[item.status] ?? 'none (already at final status)'}`,
        );
      }

      const updatedItem = await tx.orderItem.update({
        where: { id: itemId },
        data: updateData,
      });

      return {
        id: updatedItem.id,
        status: updatedItem.status,
        ready_at: updatedItem.ready_at,
      };
    }, SERIALIZABLE_TX_OPTIONS);

    return result;
  }
}
