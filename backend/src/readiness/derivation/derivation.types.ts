/**
 * SPEC §4.3 — the snapshot shapes the four derived-meter formulas consume.
 *
 * Nothing in `readiness/derivation/**` imports Prisma or Nest at runtime: the
 * formulas are pure functions over these plain objects, so every edge case is
 * unit-testable without a database. `ReadinessDerivationService` (Task 7) is the
 * thin Prisma shell that gathers them.
 */

/** Everything the four SPEC §4.3 formulas need, gathered once per recompute. */
export interface StandardizationInput {
  /** Active prepared_food/packaged products with their recipe status and cost. */
  products: { recipe_status: string | null; computed_cost: number | null }[];
}

export interface ProcurementInput {
  /** One entry per distinct recipe-input ingredient in an approved recipe's BOM. */
  ingredients: {
    ingredient_id: string;
    has_active_vendor_price: boolean;
    stock_on_hand: number;
    min_stock_level: number;
  }[];
}

export interface SalesInput {
  /** Distinct channels with >= 1 completed order in the trailing window. */
  channels_with_orders: number;
  /** Total completed orders in the trailing window. */
  completed_orders: number;
  points_per_channel: number;
  volume_threshold: number;
  volume_bonus: number;
}

export interface QualityInput {
  waste_cost: number;
  cogs: number;
  /**
   * Mean of `Feedback.rating` (1-5) in the window; null when there is none.
   *
   * Decision 7 — SPEC §4.3 says "average review rating", but the `Review` model
   * lands in P5. This is the named seam: P5 swaps the source that fills this
   * field without touching the arithmetic below.
   */
  average_rating: number | null;
  waste_multiplier: number;
}

export interface DerivedResult {
  value: number;
  /** Rows behind the number — surfaced by the API so the UI can explain it. */
  sample_size: number;
  detail: Record<string, number>;
}
