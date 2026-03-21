import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse a date range from YYYY-MM-DD strings into IST-aware Date objects.
   */
  private parseDateRange(from: string, to: string): { start: Date; end: Date } {
    const start = new Date(`${from}T00:00:00+05:30`);
    const end = new Date(`${to}T23:59:59+05:30`);
    return { start, end };
  }

  // ---------------------------------------------------------------
  // Summary KPIs
  // ---------------------------------------------------------------
  async getSummary(from: string, to: string) {
    const { start, end } = this.parseDateRange(from, to);

    const orders = await this.prisma.order.findMany({
      where: {
        created_at: { gte: start, lte: end },
        status: { not: 'cancelled' },
      },
      include: {
        payment: true,
        items: {
          include: {
            menu_item: {
              select: {
                base_price: true,
                recipe: { select: { computed_cost: true } },
              },
            },
          },
        },
      },
    });

    const total_orders = orders.length;

    // Revenue = sum of order.total where payment is paid
    const total_revenue = orders.reduce((sum, order) => {
      if (order.payment?.status === 'paid') {
        return sum + Number(order.total);
      }
      return sum;
    }, 0);

    const avg_order_value = total_orders > 0 ? total_revenue / total_orders : 0;

    // Weighted average food cost %: computed from recipe.computed_cost / base_price
    let weightedSum = 0;
    let totalQty = 0;
    for (const order of orders) {
      for (const item of order.items) {
        const basePrice = Number(item.menu_item?.base_price ?? 0);
        const computedCost = Number(item.menu_item?.recipe?.computed_cost ?? 0);
        if (basePrice > 0) {
          const fcp = (computedCost / basePrice) * 100;
          weightedSum += fcp * item.quantity;
          totalQty += item.quantity;
        }
      }
    }
    const avg_food_cost_pct = totalQty > 0 ? weightedSum / totalQty : 0;

    return { total_revenue, avg_food_cost_pct, total_orders, avg_order_value };
  }

  // ---------------------------------------------------------------
  // Revenue Time Series
  // ---------------------------------------------------------------
  async getRevenueSeries(from: string, to: string) {
    const { start, end } = this.parseDateRange(from, to);

    const orders = await this.prisma.order.findMany({
      where: {
        created_at: { gte: start, lte: end },
        status: { not: 'cancelled' },
      },
      include: { payment: true },
    });

    const dateMap = new Map<string, number>();
    for (const order of orders) {
      if (order.payment?.status !== 'paid') continue;
      const dateKey = order.created_at.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + Number(order.total));
    }

    return Array.from(dateMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---------------------------------------------------------------
  // Top Items by Quantity Sold
  // ---------------------------------------------------------------
  async getTopItems(from: string, to: string) {
    const { start, end } = this.parseDateRange(from, to);

    const grouped = await this.prisma.orderItem.groupBy({
      by: ['menu_item_id'],
      where: {
        order: {
          created_at: { gte: start, lte: end },
          status: { not: 'cancelled' },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    const menuItemIds = grouped.map((g) => g.menu_item_id);

    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true, base_price: true },
    });

    const menuMap = new Map(menuItems.map((mi) => [mi.id, mi]));

    return grouped.map((g) => {
      const mi = menuMap.get(g.menu_item_id);
      const quantity_sold = g._sum.quantity || 0;
      return {
        menu_item_id: g.menu_item_id,
        name: mi?.name || 'Unknown',
        quantity_sold,
        revenue: quantity_sold * Number(mi?.base_price || 0),
      };
    });
  }

  // ---------------------------------------------------------------
  // Channel Breakdown
  // ---------------------------------------------------------------
  async getChannelBreakdown(from: string, to: string) {
    const { start, end } = this.parseDateRange(from, to);

    const orders = await this.prisma.order.findMany({
      where: {
        created_at: { gte: start, lte: end },
        status: { not: 'cancelled' },
      },
      include: { payment: true },
    });

    const channelMap = new Map<string, { revenue: number; order_count: number }>();

    for (const order of orders) {
      const existing = channelMap.get(order.channel) || {
        revenue: 0,
        order_count: 0,
      };
      existing.order_count += 1;
      if (order.payment?.status === 'paid') {
        existing.revenue += Number(order.total);
      }
      channelMap.set(order.channel, existing);
    }

    return Array.from(channelMap.entries()).map(([channel, data]) => ({
      channel,
      revenue: data.revenue,
      order_count: data.order_count,
    }));
  }

  // ---------------------------------------------------------------
  // Recipe Costs
  // ---------------------------------------------------------------
  async getRecipeCosts(from: string, to: string) {
    const { start, end } = this.parseDateRange(from, to);

    const grouped = await this.prisma.orderItem.groupBy({
      by: ['menu_item_id'],
      where: {
        order: {
          created_at: { gte: start, lte: end },
          status: { not: 'cancelled' },
        },
      },
      _sum: { quantity: true },
    });

    const menuItemIds = grouped.map((g) => g.menu_item_id);

    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: {
        recipe: { select: { id: true, name: true, computed_cost: true } },
      },
    });

    const menuMap = new Map(menuItems.map((mi) => [mi.id, mi]));
    const qtyMap = new Map(grouped.map((g) => [g.menu_item_id, g._sum.quantity || 0]));

    const results: Array<{
      recipe_id: string;
      recipe_name: string;
      computed_cost: number;
      selling_price: number;
      food_cost_pct: number;
      units_sold: number;
    }> = [];

    for (const [menuItemId, mi] of menuMap) {
      if (!mi.recipe) continue;
      const unitsSold = qtyMap.get(menuItemId) || 0;
      const computedCost = Number(mi.recipe.computed_cost ?? 0);
      const sellingPrice = Number(mi.base_price);
      const foodCostPct = sellingPrice > 0 ? (computedCost / sellingPrice) * 100 : 0;

      results.push({
        recipe_id: mi.recipe.id,
        recipe_name: mi.recipe.name,
        computed_cost: computedCost,
        selling_price: sellingPrice,
        food_cost_pct: Math.round(foodCostPct * 100) / 100,
        units_sold: unitsSold,
      });
    }

    return results.sort((a, b) => b.food_cost_pct - a.food_cost_pct);
  }

  // ---------------------------------------------------------------
  // Wins (Completed Quests + Validated Tasks)
  // ---------------------------------------------------------------
  async getWins(limit: number, cursor?: string) {
    const questWhere: Record<string, unknown> = { status: 'completed' };
    const taskWhere: Record<string, unknown> = {
      valid: true,
      completed_at: { not: null },
    };

    if (cursor) {
      questWhere.updated_at = { lt: new Date(cursor) };
      taskWhere.completed_at = { lt: new Date(cursor) };
    }

    const [quests, tasks] = await Promise.all([
      this.prisma.quest.findMany({
        where: questWhere,
        include: { owner: { select: { name: true, role: { select: { name: true } } } } },
        orderBy: { updated_at: 'desc' },
        take: limit,
      }),
      this.prisma.task.findMany({
        where: taskWhere,
        include: {
          owner: { select: { name: true, role: { select: { name: true } } } },
        },
        orderBy: { completed_at: 'desc' },
        take: limit,
      }),
    ]);

    const merged: Array<{
      id: string;
      type: 'quest_completed' | 'task_validated';
      title: string;
      actor_name: string;
      actor_role: string;
      timestamp: string;
    }> = [];

    for (const q of quests) {
      merged.push({
        id: q.id,
        type: 'quest_completed',
        title: q.title,
        actor_name: q.owner.name,
        actor_role: q.owner.role.name,
        timestamp: q.updated_at.toISOString(),
      });
    }

    for (const t of tasks) {
      merged.push({
        id: t.id,
        type: 'task_validated',
        title: t.title,
        actor_name: t.owner.name,
        actor_role: t.owner.role.name,
        timestamp: (t.completed_at as Date).toISOString(),
      });
    }

    merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return merged.slice(0, limit);
  }
}
