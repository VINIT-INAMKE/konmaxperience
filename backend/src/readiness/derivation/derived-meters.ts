import type {
  DerivedResult,
  ProcurementInput,
  QualityInput,
  SalesInput,
  StandardizationInput,
} from './derivation.types';

/**
 * Clamp into `[lo, hi]`, defaulting to the 0-100 meter scale.
 *
 * `NaN` scores the floor — a formula that divided by nothing must not publish a
 * garbage meter. `Infinity` clamps to `hi` and `-Infinity` to `lo` (deviation
 * from the plan's `Number.isFinite` guard, which mapped `+Infinity` to `0` and
 * would have turned a catastrophic waste ratio into a perfect QUALITY score).
 */
export const clamp = (n: number, lo = 0, hi = 100): number =>
  Number.isNaN(n) ? lo : Math.min(hi, Math.max(lo, n));

/** Round to two decimals — `ReadinessSnapshot.value` is `Decimal(6,2)`. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * SPEC §4.3 STANDARDIZATION — % of active prepared_food/packaged products whose
 * recipe is `approved` AND has `computed_cost > 0`. An empty catalog scores 0:
 * nothing is standardised when nothing is sellable.
 */
export function standardization(input: StandardizationInput): DerivedResult {
  const total = input.products.length;
  if (total === 0)
    return { value: 0, sample_size: 0, detail: { total: 0, standardised: 0 } };
  const ok = input.products.filter(
    (p) => p.recipe_status === 'approved' && (p.computed_cost ?? 0) > 0,
  ).length;
  return {
    value: round2(clamp((ok / total) * 100)),
    sample_size: total,
    detail: { total, standardised: ok },
  };
}

/**
 * SPEC §4.3 PROCUREMENT — % of BOM ingredients (across approved recipes) that
 * have an active VendorPrice AND IngredientStock >= min_quantity.
 */
export function procurement(input: ProcurementInput): DerivedResult {
  const total = input.ingredients.length;
  if (total === 0)
    return { value: 0, sample_size: 0, detail: { total: 0, covered: 0 } };
  const covered = input.ingredients.filter(
    (i) => i.has_active_vendor_price && i.stock_on_hand >= i.min_stock_level,
  ).length;
  return {
    value: round2(clamp((covered / total) * 100)),
    sample_size: total,
    detail: { total, covered },
  };
}

/**
 * SPEC §4.3 SALES — min(100, 25 x channels with >= 1 completed order in the
 * trailing 7 days) plus a flat bonus at >= 10 orders/week (decision 9).
 */
export function sales(input: SalesInput): DerivedResult {
  const base = input.channels_with_orders * input.points_per_channel;
  const bonus =
    input.completed_orders >= input.volume_threshold ? input.volume_bonus : 0;
  return {
    value: round2(clamp(base + bonus)),
    sample_size: input.completed_orders,
    detail: { channels: input.channels_with_orders, base, bonus },
  };
}

/**
 * SPEC §4.3 QUALITY — 100 - clamp(waste_cost / COGS x 100 x 5) blended 50/50
 * with average rating x 20. With no COGS the waste half is a perfect 100 (there
 * is nothing to have wasted); with no ratings the rating half falls back to the
 * waste half so the meter is never dragged to 50 by silence.
 */
export function quality(input: QualityInput): DerivedResult {
  const wastePct =
    input.cogs > 0
      ? clamp((input.waste_cost / input.cogs) * 100 * input.waste_multiplier)
      : 0;
  const wasteHalf = clamp(100 - wastePct);
  const ratingHalf =
    input.average_rating === null
      ? wasteHalf
      : clamp(input.average_rating * 20);
  return {
    value: round2(clamp(wasteHalf * 0.5 + ratingHalf * 0.5)),
    sample_size: input.cogs > 0 ? 1 : 0,
    detail: { waste_half: round2(wasteHalf), rating_half: round2(ratingHalf) },
  };
}

/** `ReadinessMeter.formula_key` → formula. Keys are seeded in seed-data/reference.ts. */
export const DERIVED_FORMULAS = {
  standardization_v1: 'STANDARDIZATION',
  procurement_v1: 'PROCUREMENT',
  sales_v1: 'SALES',
  quality_v1: 'QUALITY',
} as const;

/** A `formula_key` seeded on a `derived` meter. */
export type DerivedFormulaKey = keyof typeof DERIVED_FORMULAS;

/** The `ReadinessMeter.code` of a `derived` meter. */
export type DerivedMeterCode = (typeof DERIVED_FORMULAS)[DerivedFormulaKey];

/**
 * SPEC §4.3 — a `hybrid` meter's `formula_key` names the derived meter it blends
 * with, so the mapping needs no extra table or setting. Seeded in
 * `prisma/seed-data/reference.ts` as `hybrid_backend_v1` / `hybrid_frontend_v1`.
 */
export const HYBRID_PARTNER_CODES = {
  hybrid_backend_v1: 'STANDARDIZATION',
  hybrid_frontend_v1: 'SALES',
} as const;

/** A `formula_key` seeded on a `hybrid` meter. */
export type HybridFormulaKey = keyof typeof HYBRID_PARTNER_CODES;
