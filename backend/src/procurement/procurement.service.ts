import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { loadConversions } from '../common/utils/unit-conversion';

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    // Run all independent queries in parallel
    const [
      pending_po_count,
      allStocks,
      monthPOs,
      poStatusCounts,
    ] = await Promise.all([
      // 1. Pending PO count (draft or ordered)
      this.prisma.purchaseOrder.count({
        where: { status: { in: ['draft', 'ordered'] } },
      }),
      // 2 + 4. Fetch ALL stocks once (used for low_stock_count AND inventory value)
      this.prisma.ingredientStock.findMany({
        include: {
          ingredient: {
            select: { id: true, base_unit: true, min_stock_level: true },
          },
        },
      }),
      // 3. Vendor spend this month + top vendors
      this.prisma.purchaseOrder.findMany({
        where: {
          status: { in: ['ordered', 'received'] },
          ordered_at: { gte: monthStart },
        },
        select: {
          status: true,
          vendor_id: true,
          vendor: { select: { id: true, name: true } },
          lines: { select: { quantity: true, received_quantity: true, unit_cost: true } },
        },
      }),
      // 5. PO status breakdown via groupBy
      this.prisma.purchaseOrder.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    // 2. Low stock count from the single fetch
    const low_stock_count = allStocks.filter(
      (s) => Number(s.current_quantity) < Number(s.ingredient.min_stock_level),
    ).length;

    // 3. Vendor spend aggregation
    let vendor_spend_this_month = 0;
    const vendorSpendMap = new Map<
      string,
      { vendor_id: string; vendor_name: string; spend: number }
    >();

    for (const po of monthPOs) {
      let poSpend = 0;
      for (const line of po.lines) {
        const qty =
          po.status === 'received' && line.received_quantity
            ? Number(line.received_quantity)
            : Number(line.quantity);
        poSpend += qty * Number(line.unit_cost);
      }
      vendor_spend_this_month += poSpend;

      const existing = vendorSpendMap.get(po.vendor_id);
      if (existing) {
        existing.spend += poSpend;
      } else {
        vendorSpendMap.set(po.vendor_id, {
          vendor_id: po.vendor_id,
          vendor_name: po.vendor.name,
          spend: poSpend,
        });
      }
    }

    const top_vendors = Array.from(vendorSpendMap.values())
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 3);

    // 4. Total inventory value — reuse allStocks from step 2
    const ingredientIds = [...new Set(allStocks.map((s) => s.ingredient_id))];
    let total_inventory_value = 0;

    if (ingredientIds.length > 0) {
      // Batch-fetch all vendor prices in one query to avoid N+1
      const allPrices = await this.prisma.vendorPrice.findMany({
        where: { ingredient_id: { in: ingredientIds } },
        orderBy: { effective_date: 'desc' },
      });
      // Group by ingredient_id, keeping only the latest (first) price per ingredient
      const priceMap = new Map<string, (typeof allPrices)[0]>();
      for (const p of allPrices) {
        if (!priceMap.has(p.ingredient_id)) priceMap.set(p.ingredient_id, p);
      }

      // Pre-load conversion cache once (avoids repeated DB hits in the loop)
      const conversionCache = await loadConversions(this.prisma);

      // Build a Map of ingredient_id -> { totalQty, baseUnit } for O(1) lookups
      const stockAggMap = new Map<string, { totalQty: number; baseUnit: string }>();
      for (const s of allStocks) {
        const existing = stockAggMap.get(s.ingredient_id);
        if (existing) {
          existing.totalQty += Number(s.current_quantity);
        } else {
          stockAggMap.set(s.ingredient_id, {
            totalQty: Number(s.current_quantity),
            baseUnit: s.ingredient.base_unit,
          });
        }
      }

      for (const ingId of ingredientIds) {
        const latestPrice = priceMap.get(ingId);
        if (!latestPrice) continue;

        const stockAgg = stockAggMap.get(ingId);
        if (!stockAgg) continue;

        // Synchronous unit conversion using pre-loaded cache
        const fromUnit = latestPrice.unit;
        const toUnit = stockAgg.baseUnit;
        let factor: number | null = 1;
        if (fromUnit !== toUnit) {
          const direct = conversionCache.get(`${fromUnit}:${toUnit}`);
          if (direct !== undefined) {
            factor = direct;
          } else {
            const reverse = conversionCache.get(`${toUnit}:${fromUnit}`);
            factor = reverse !== undefined && reverse !== 0 ? 1 / reverse : null;
          }
        }

        const pricePerBaseUnit = factor
          ? Number(latestPrice.price) / factor
          : Number(latestPrice.price);

        total_inventory_value += stockAgg.totalQty * pricePerBaseUnit;
      }
    }

    // 5. PO status breakdown from groupBy
    const statusMap = new Map(poStatusCounts.map((s) => [s.status, s._count.id]));

    return {
      pending_po_count,
      low_stock_count,
      vendor_spend_this_month,
      total_inventory_value,
      top_vendors,
      po_status_breakdown: {
        draft: statusMap.get('draft') ?? 0,
        ordered: statusMap.get('ordered') ?? 0,
        received: statusMap.get('received') ?? 0,
      },
    };
  }
}
