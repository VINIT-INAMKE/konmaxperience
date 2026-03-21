import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ZoneUtilization {
  zone_name: string;
  active_orders: number;
}

export interface KitchenMetrics {
  orders_in_queue: number;
  items_completed_today: number;
  active_prep_batches: number;
  waste_today_cost: number;
  waste_percentage: number;
  average_prep_time_minutes: number | null;
  zone_utilization: ZoneUtilization[];
}

@Injectable()
export class KitchenMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<KitchenMetrics> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Orders in queue: status IN ('placed', 'preparing')
    const orders_in_queue = await this.prisma.order.count({
      where: { status: { in: ['placed', 'preparing'] } },
    });

    // 2. Items completed today: OrderItems with status='ready' AND ready_at >= today
    const items_completed_today = await this.prisma.orderItem.count({
      where: {
        status: 'ready',
        ready_at: { gte: todayStart },
      },
    });

    // 3. Active prep batches
    const active_prep_batches = await this.prisma.prepBatch.count({
      where: { status: 'active' },
    });

    // 4. Waste today cost: sum of WasteLog.cost_impact where created_at >= today
    const wasteAggregate = await this.prisma.wasteLog.aggregate({
      _sum: { cost_impact: true },
      where: { created_at: { gte: todayStart } },
    });
    const waste_today_cost = Number(wasteAggregate._sum.cost_impact ?? 0);

    // 5. Waste percentage: (waste_today_cost / totalCostProduced) * 100
    // totalCostProduced: sum of (quantity_produced / yield_qty) * computed_cost for today's PrepBatches
    const todayBatches = await this.prisma.prepBatch.findMany({
      where: { created_at: { gte: todayStart } },
      include: {
        recipe: { select: { computed_cost: true, yield_qty: true } },
      },
    });

    let totalCostProduced = 0;
    for (const batch of todayBatches) {
      const yieldQty = Number(batch.recipe.yield_qty);
      if (yieldQty > 0) {
        totalCostProduced +=
          (Number(batch.quantity_produced) / yieldQty) *
          Number(batch.recipe.computed_cost ?? 0);
      }
    }

    const waste_percentage =
      totalCostProduced > 0
        ? (waste_today_cost / totalCostProduced) * 100
        : 0;

    // 6. Average prep time: average of (ready_at - order.created_at) in minutes
    //    for OrderItems with ready_at IS NOT NULL and created today
    const completedItems = await this.prisma.orderItem.findMany({
      where: {
        ready_at: { not: null, gte: todayStart },
      },
      include: {
        order: { select: { created_at: true } },
      },
    });

    let average_prep_time_minutes: number | null = null;
    if (completedItems.length > 0) {
      let totalMinutes = 0;
      for (const item of completedItems) {
        const diffMs =
          item.ready_at!.getTime() - item.order.created_at.getTime();
        totalMinutes += diffMs / 60000;
      }
      average_prep_time_minutes = Math.round(
        (totalMinutes / completedItems.length) * 10,
      ) / 10;
    }

    // 7. Zone utilization: active orders grouped by zone
    const zoneOrders = await this.prisma.order.groupBy({
      by: ['zone_id'],
      where: { status: { in: ['placed', 'preparing'] } },
      _count: { id: true },
    });

    const zones = zoneOrders.length > 0
      ? await this.prisma.zone.findMany({
          where: { id: { in: zoneOrders.map((z) => z.zone_id) } },
          select: { id: true, name: true },
        })
      : [];

    const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
    const zone_utilization: ZoneUtilization[] = zoneOrders.map((z) => ({
      zone_name: zoneMap.get(z.zone_id) ?? 'Unknown',
      active_orders: z._count.id,
    }));

    return {
      orders_in_queue,
      items_completed_today,
      active_prep_batches,
      waste_today_cost,
      waste_percentage,
      average_prep_time_minutes,
      zone_utilization,
    };
  }
}
