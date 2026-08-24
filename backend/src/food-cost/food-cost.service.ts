import { BadRequestException, Injectable } from '@nestjs/common';
import { MovementType, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { nodeDateRange, nodeDayKey } from '../common/utils/node-time';
import { toPaise, type Money, type Paise } from '../common/money/money';
import { valueQuantity, type IngredientPriceCache } from './ingredient-cost';

/** Number of node-local days the report covers when the caller names no window. */
const DEFAULT_WINDOW_DAYS = 30;

/** One product's share of the theoretical (BOM) cost of the period. */
export interface TheoreticalProductLine {
  product_id: string;
  name: string;
  /** Units sold in the window. */
  quantity: number;
  /** `Recipe.computed_cost` for one unit, in integer paise. */
  unit_cost: Paise;
  /** `quantity * unit_cost`, in integer paise. */
  cost: Paise;
}

/** One consuming movement type's share of the actual (store-room) cost. */
export interface ActualMovementLine {
  movement_type: MovementType;
  /** Integer paise. */
  cost: Paise;
}

/**
 * RUN-03's payload.
 *
 * **Every money field on this object is an integer number of paise**, never
 * rupees and never a float — `currency_unit` says so on the wire so a consumer
 * cannot mistake `8000` for eighty thousand rupees. Percentages are plain
 * numbers rounded to two decimal places.
 */
export interface FoodCostReport {
  /** Resolved window, `YYYY-MM-DD`, node-local and inclusive at both ends. */
  from: string;
  to: string;
  /** Always `'paise'`. Present so the wire format is self-describing. */
  currency_unit: 'paise';
  theoretical: { total: Paise; by_product: TheoreticalProductLine[] };
  actual: { total: Paise; by_movement_type: ActualMovementLine[] };
  /** `actual - theoretical`; `percent` is that as a share of `theoretical`. */
  variance: { amount: Paise; percent: number };
  /** Sum of `Order.total` over the same orders the theoretical side counts. */
  revenue: Paise;
  theoretical_pct_of_revenue: number;
  actual_pct_of_revenue: number;
  /** Ingredients that could not be valued — see P6 decision 18. */
  unpriced_ingredients: { id: string; name: string }[];
}

/** Percent to two decimals, with every divide-by-zero collapsing to 0. */
function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  const value = (numerator / denominator) * 100;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** `YYYY-MM-DD` shifted by whole calendar days — no instant arithmetic. */
function shiftDayKey(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

@Injectable()
export class FoodCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nodeService: NodeService,
  ) {}

  /**
   * The movement types that represent food *leaving* the store room.
   *
   * `adjustment` is deliberately absent: an adjustment is the correction *for*
   * drift, so including it would net the variance to zero and hide the very
   * finding this report exists to produce. Adjustments are accounted for by the
   * stock-reconciliation job, not here. `purchase_received`, `import` and
   * `return` are inbound; `shipment_packed` moves goods without consuming them.
   */
  private static readonly CONSUMING: readonly MovementType[] = [
    MovementType.order_deducted,
    MovementType.prep_deducted,
    MovementType.waste,
    MovementType.supply_usage,
  ];

  /**
   * Orders that count towards both the theoretical cost and the revenue it is
   * expressed as a percentage of. Cancelled and refunded orders never happened
   * as far as food cost is concerned — and using one filter for both halves is
   * what keeps `theoretical_pct_of_revenue` a coherent ratio rather than two
   * numbers over two populations.
   */
  private static readonly COUNTED_ORDER_STATUS = {
    notIn: [OrderStatus.cancelled, OrderStatus.refunded],
  };

  /**
   * RUN-03. Two independent readings of the same period:
   *
   *   theoretical — what the BOM says the food sold *should* have cost:
   *                 Σ OrderItem.quantity × Product.recipe.computed_cost, over
   *                 orders not cancelled/refunded. `computed_cost` is already
   *                 the recursive BOM roll-up maintained by RecipesService, so
   *                 this does not re-explode RecipeLine per order line.
   *   actual      — what actually left the store room: Σ |StockMovement.quantity|
   *                 over the consuming types, valued through `valueQuantity`.
   *
   * variance = actual − theoretical. Positive means more went out than the
   * recipes account for: over-portioning, unlogged waste, or theft. Negative
   * usually means a recipe's `computed_cost` is stale, which is itself the
   * finding BI wants.
   *
   * Computed on demand; there is no snapshot table (P6 decision 17). `from` and
   * `to` are node-local `YYYY-MM-DD` days, inclusive at both ends; omitting them
   * asks for the last 30 node-local days ending today.
   */
  async report(from?: string, to?: string): Promise<FoodCostReport> {
    const timeZone = await this.nodeService.timezone();
    const resolvedTo = to ?? nodeDayKey(timeZone, new Date());
    const resolvedFrom =
      from ?? shiftDayKey(resolvedTo, -(DEFAULT_WINDOW_DAYS - 1));
    if (resolvedFrom > resolvedTo) {
      throw new BadRequestException(
        `"from" (${resolvedFrom}) must not be after "to" (${resolvedTo})`,
      );
    }
    const { start, end } = nodeDateRange(timeZone, resolvedFrom, resolvedTo);

    // Deliberately not filtered by node: `StockMovement` carries a zone, not a
    // node, so a node filter on the theoretical half alone would compare two
    // different populations. v2.0 runs exactly one node (SPEC §3.1), and this
    // matches how every `analytics.service.ts` window already reads.
    const orderWindow = {
      created_at: { gte: start, lt: end },
      status: FoodCostService.COUNTED_ORDER_STATUS,
    };

    const [items, revenueAgg, movements] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { order: orderWindow },
        select: {
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              recipe: { select: { computed_cost: true } },
            },
          },
        },
      }),
      this.prisma.order.aggregate({
        where: orderWindow,
        _sum: { total: true },
      }),
      this.prisma.stockMovement.findMany({
        where: {
          created_at: { gte: start, lt: end },
          movement_type: { in: [...FoodCostService.CONSUMING] },
        },
        select: {
          movement_type: true,
          quantity: true,
          ingredient: { select: { id: true, name: true, base_unit: true } },
        },
      }),
    ]);

    const theoretical = this.rollUpTheoretical(items);
    const actual = await this.rollUpActual(movements);

    const revenue = toPaise(revenueAgg?._sum?.total ?? 0);
    const varianceAmount = actual.total - theoretical.total;

    return {
      from: resolvedFrom,
      to: resolvedTo,
      currency_unit: 'paise',
      theoretical: { total: theoretical.total, by_product: theoretical.lines },
      actual: { total: actual.total, by_movement_type: actual.lines },
      variance: {
        amount: varianceAmount,
        percent: pct(varianceAmount, theoretical.total),
      },
      revenue,
      theoretical_pct_of_revenue: pct(theoretical.total, revenue),
      actual_pct_of_revenue: pct(actual.total, revenue),
      unpriced_ingredients: actual.unpriced,
    };
  }

  /**
   * Σ quantity × `Recipe.computed_cost`, grouped by product.
   *
   * A product with no recipe, or a recipe whose `computed_cost` has never been
   * rolled up, values at zero and is still listed: a zero line against a real
   * sales quantity is exactly the "your BOM is incomplete" signal the screen
   * needs, and dropping it would understate the theoretical without saying so.
   */
  private rollUpTheoretical(
    items: {
      quantity: number;
      product: {
        id: string;
        name: string;
        recipe: { computed_cost: Money | null } | null;
      } | null;
    }[],
  ): { total: Paise; lines: TheoreticalProductLine[] } {
    const byProduct = new Map<string, TheoreticalProductLine>();

    for (const item of items) {
      const product = item.product;
      if (!product) continue;
      const rawCost = product.recipe?.computed_cost;
      const unitCost = rawCost == null ? 0 : toPaise(rawCost);
      const quantity = Number(item.quantity) || 0;

      const line = byProduct.get(product.id) ?? {
        product_id: product.id,
        name: product.name,
        quantity: 0,
        unit_cost: unitCost,
        cost: 0,
      };
      line.quantity += quantity;
      line.cost += quantity * unitCost;
      byProduct.set(product.id, line);
    }

    const lines = [...byProduct.values()].sort(
      (a, b) => b.cost - a.cost || a.name.localeCompare(b.name),
    );
    const total = lines.reduce((sum, line) => sum + line.cost, 0);
    return { total, lines };
  }

  /**
   * Σ |quantity| over the consuming movement types, valued at the latest
   * `VendorPrice`.
   *
   * `StockMovement.quantity` is signed and consumption is negative, so the
   * magnitude is what gets valued. One `priceCache` is shared across every
   * movement, or the query count is O(movements) rather than O(ingredients).
   *
   * All four consuming types are always present, at zero if nothing moved, so
   * the screen renders a stable shape — and so `adjustment`'s absence is a
   * fact the response states rather than one a reader has to infer.
   */
  private async rollUpActual(
    movements: {
      movement_type: MovementType;
      quantity: Money;
      ingredient: { id: string; name: string; base_unit: string } | null;
    }[],
  ): Promise<{
    total: Paise;
    lines: ActualMovementLine[];
    unpriced: { id: string; name: string }[];
  }> {
    const priceCache: IngredientPriceCache = new Map();
    const unpriced = new Map<string, string>();
    const byType = new Map<MovementType, Paise>(
      FoodCostService.CONSUMING.map((type) => [type, 0]),
    );

    for (const movement of movements) {
      const ingredient = movement.ingredient;
      if (!ingredient) continue;
      const qty = Math.abs(Number(movement.quantity) || 0);

      const { cost, unpriced: isUnpriced } = await valueQuantity(
        this.prisma,
        ingredient,
        qty,
        priceCache,
      );
      if (isUnpriced) unpriced.set(ingredient.id, ingredient.name);
      byType.set(
        movement.movement_type,
        (byType.get(movement.movement_type) ?? 0) + cost,
      );
    }

    const lines = FoodCostService.CONSUMING.map((movement_type) => ({
      movement_type,
      cost: byType.get(movement_type) ?? 0,
    }));
    return {
      total: lines.reduce((sum, line) => sum + line.cost, 0),
      lines,
      unpriced: [...unpriced.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
