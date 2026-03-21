import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { convertUnit } from '../common/utils/unit-conversion';

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    // 1. Pending PO count (draft or ordered)
    const pending_po_count = await this.prisma.purchaseOrder.count({
      where: { status: { in: ['draft', 'ordered'] } },
    });

    // 2. Low stock count — application-level filter (Pitfall 4: use Number() for Decimal)
    const allStocks = await this.prisma.ingredientStock.findMany({
      include: { ingredient: { select: { min_stock_level: true } } },
    });
    const low_stock_count = allStocks.filter(
      (s) => Number(s.current_quantity) < Number(s.ingredient.min_stock_level),
    ).length;

    // 3. Vendor spend this month + top vendors
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const monthPOs = await this.prisma.purchaseOrder.findMany({
      where: {
        status: { in: ['ordered', 'received'] },
        ordered_at: { gte: monthStart },
      },
      include: {
        lines: true,
        vendor: { select: { id: true, name: true } },
      },
    });

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

    // 4. Total inventory value — sum of (current_quantity * latest VendorPrice) per ingredient
    const stocks = await this.prisma.ingredientStock.findMany({
      include: { ingredient: true },
    });
    const ingredientIds = [...new Set(stocks.map((s) => s.ingredient_id))];
    let total_inventory_value = 0;

    for (const ingId of ingredientIds) {
      const latestPrice = await this.prisma.vendorPrice.findFirst({
        where: { ingredient_id: ingId },
        orderBy: { effective_date: 'desc' },
      });
      if (!latestPrice) continue;

      const stocksForIng = stocks.filter((s) => s.ingredient_id === ingId);
      const totalQty = stocksForIng.reduce(
        (sum, s) => sum + Number(s.current_quantity),
        0,
      );

      // current_quantity is in base_unit, price is per price.unit — need conversion
      const baseUnit = stocksForIng[0].ingredient.base_unit;
      const factor = await convertUnit(
        1,
        latestPrice.unit,
        baseUnit,
        this.prisma,
      );
      const pricePerBaseUnit = factor
        ? Number(latestPrice.price) / factor
        : Number(latestPrice.price);

      total_inventory_value += totalQty * pricePerBaseUnit;
    }

    // 5. PO status breakdown
    const [draft_count, ordered_count, received_count] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { status: 'draft' } }),
      this.prisma.purchaseOrder.count({ where: { status: 'ordered' } }),
      this.prisma.purchaseOrder.count({ where: { status: 'received' } }),
    ]);

    return {
      pending_po_count,
      low_stock_count,
      vendor_spend_this_month,
      total_inventory_value,
      top_vendors,
      po_status_breakdown: {
        draft: draft_count,
        ordered: ordered_count,
        received: received_count,
      },
    };
  }
}
