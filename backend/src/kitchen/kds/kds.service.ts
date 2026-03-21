import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../../orders/orders.service';

export interface KdsOrderItem {
  id: string;
  status: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  item_notes: string | null;
}

export interface KdsOrder {
  id: string;
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
    private readonly ordersService: OrdersService,
  ) {}

  async getActiveOrders(): Promise<KdsZoneData[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['placed', 'preparing'] },
      },
      include: {
        items: {
          include: {
            menu_item: { select: { id: true, name: true } },
          },
        },
        zone: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    // Group by zone
    const zoneMap = new Map<string, KdsZoneData>();

    for (const order of orders) {
      const zoneId = order.zone_id;
      if (!zoneMap.has(zoneId)) {
        zoneMap.set(zoneId, {
          zone_id: zoneId,
          zone_name: order.zone.name,
          orders: [],
        });
      }

      const kdsOrder: KdsOrder = {
        id: order.id,
        customer_name: order.customer_name,
        created_at: order.created_at.toISOString(),
        status: order.status,
        zone_id: order.zone_id,
        items: order.items.map((item) => ({
          id: item.id,
          status: item.status,
          menu_item_id: item.menu_item_id,
          menu_item_name: item.menu_item.name,
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
    newStatus: string,
  ): Promise<{ id: string; status: string; ready_at: Date | null }> {
    // Validate newStatus
    const validStatuses = ['pending', 'preparing', 'ready'];
    if (!validStatuses.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status "${newStatus}". Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    // Find the current item
    const item = await this.prisma.orderItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Order item with ID ${itemId} not found`);
    }

    // Validate status progression: pending -> preparing -> ready only
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

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'ready') {
      updateData.ready_at = new Date();
    }

    // When status is 'ready' — wrap in $transaction with deduction
    if (newStatus === 'ready') {
      return this.prisma.$transaction(async (tx) => {
        // Deduct ingredients/prep batches for this item (atomic)
        const order = await tx.order.findUniqueOrThrow({
          where: { id: item.order_id },
        });
        await this.ordersService.deductItemIngredients(
          tx,
          {
            id: item.id,
            order_id: item.order_id,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
          },
          order.created_by,
        );

        // Update item status
        const updated = await tx.orderItem.update({
          where: { id: itemId },
          data: updateData,
        });

        // Check if ALL items in order are ready → auto-transition order
        const allItems = await tx.orderItem.findMany({
          where: { order_id: item.order_id },
        });
        const allReady = allItems.every(
          (i) => (i.id === itemId ? true : i.status === 'ready'),
        );
        if (allReady) {
          await tx.order.update({
            where: { id: item.order_id },
            data: { status: 'ready' },
          });
        }

        return {
          id: updated.id,
          status: updated.status,
          ready_at: updated.ready_at,
        };
      });
    }

    // Non-ready transitions — simple update (no transaction needed)
    const updatedItem = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return {
      id: updatedItem.id,
      status: updatedItem.status,
      ready_at: updatedItem.ready_at,
    };
  }
}
