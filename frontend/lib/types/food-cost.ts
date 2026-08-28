/**
 * RUN-03 — `GET /analytics/food-cost` (P6 Task 6, `FoodCostService.report`).
 *
 * **Every money field on this object is an integer number of paise.** That is
 * the one thing about this payload a reader has to hold: `8000` is ₹80.00, not
 * eighty thousand rupees. The wire says so itself in {@link FoodCostReport.currency_unit},
 * and the only correct way to render any of these numbers is
 * `formatPaise(value)` (or `paiseToRupees` when a chart needs the numeric
 * rupee). No other analytics payload in this app is in paise — `lib/types/analytics.ts`
 * is rupees throughout, because `DecimalSerializationInterceptor` hands back
 * `Prisma.Decimal.toNumber()` — so the unit does not transfer by analogy from
 * the neighbouring screen.
 *
 * Percentages are plain numbers already rounded to two decimals server-side and
 * collapse to `0` wherever the denominator is zero; nothing here needs a
 * divide-by-zero guard of its own.
 */

import type { StockMovementType } from './inventory';

/** The four movement types the report treats as food *leaving* the store room. */
export type ConsumingMovementType = Extract<
  StockMovementType,
  'order_deducted' | 'prep_deducted' | 'waste' | 'supply_usage'
>;

/**
 * One product's share of the theoretical (BOM) cost of the period.
 *
 * A line with `unit_cost: 0` against a real `quantity` is not noise to be
 * filtered out — it is the report saying *this product has no recipe, or a
 * recipe whose `computed_cost` was never rolled up*. The screen surfaces it
 * (P6 decision 18): dropping the row would understate the theoretical total
 * without saying so anywhere.
 */
export interface TheoreticalProductLine {
  product_id: string;
  name: string;
  /** Units sold in the window. A count, not money. */
  quantity: number;
  /** `Recipe.computed_cost` for one unit, in integer paise. `0` means no BOM. */
  unit_cost: number;
  /** `quantity × unit_cost`, in integer paise. */
  cost: number;
}

/** One consuming movement type's share of the actual (store-room) cost. */
export interface ActualMovementLine {
  movement_type: ConsumingMovementType;
  /** Integer paise. */
  cost: number;
}

/**
 * An ingredient that could not be valued because no `VendorPrice` exists for
 * it. Its consumption was counted at ₹0, so the *actual* side — and therefore
 * the variance — is understated by however much it was really worth.
 */
export interface UnpricedIngredient {
  id: string;
  name: string;
}

/** The full RUN-03 payload. */
export interface FoodCostReport {
  /** Resolved window, `YYYY-MM-DD`, node-local and inclusive at both ends. */
  from: string;
  to: string;
  /** Always `'paise'`. Present so the wire format is self-describing. */
  currency_unit: 'paise';
  theoretical: {
    /** Integer paise. */
    total: number;
    /** Sorted `cost` descending, then `name` ascending. */
    by_product: TheoreticalProductLine[];
  };
  actual: {
    /** Integer paise. */
    total: number;
    /**
     * Always exactly the four consuming types, zero-filled, in a fixed order —
     * so a zero is a stated fact rather than a missing row. `adjustment` is
     * deliberately absent: it is the correction *for* drift, and counting it
     * would net the variance to zero and hide the finding.
     */
    by_movement_type: ActualMovementLine[];
  };
  /**
   * `actual − theoretical`, signed, in integer paise; `percent` is that as a
   * share of the theoretical total, `0` when the theoretical total is `0`.
   *
   * **Positive** means more stock left the store room than the recipes account
   * for — over-portioning, unlogged waste, or theft. **Negative** usually means
   * a recipe's `computed_cost` is stale. The direction is the whole point of
   * the number and never renders without it.
   */
  variance: { amount: number; percent: number };
  /** Σ `Order.total` over the same orders the theoretical side counts, in paise. Tax-inclusive. */
  revenue: number;
  /** Two decimals, `0` when revenue is `0`. */
  theoretical_pct_of_revenue: number;
  /** Two decimals, `0` when revenue is `0`. */
  actual_pct_of_revenue: number;
  /** Deduped and name-sorted. A data-quality callout, never an error. */
  unpriced_ingredients: UnpricedIngredient[];
}

/** The variance bands the screen colours by. Symmetric: direction is shown separately. */
export type VarianceBand = 'good' | 'warning' | 'serious';

/**
 * Within ±2 % is normal kitchen drift, ±5 % is worth a look, beyond that
 * something is wrong. Symmetric on purpose — a −8 % variance means the BOM is
 * badly stale, which is as much of a problem as a +8 % one.
 */
export function varianceBand(percent: number): VarianceBand {
  const magnitude = Math.abs(percent);
  if (magnitude <= 2) return 'good';
  if (magnitude <= 5) return 'warning';
  return 'serious';
}
