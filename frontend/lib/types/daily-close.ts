/**
 * RUN-02 — the daily close, as the API actually speaks it.
 *
 * Mirrors `backend/src/daily-close/daily-close.service.ts` field for field. Two
 * things about this contract are easy to get wrong and expensive to get wrong:
 *
 * 1. **Every money field is integer paise**, not rupees. The close is a signed
 *    artefact, so the backend refuses to freeze a float — `Number(Decimal)` on a
 *    rupee sum is exactly the thing a signature must not carry. Every such field
 *    is suffixed `_paise`, and the only correct way to render one is
 *    {@link formatPaise} (or `paiseToRupees` into a `<MoneyLine>`), never
 *    `formatCurrency` on the raw number. This is the one place in the app where
 *    the P5a "money is a JSON number in rupees" rule does not hold, and the
 *    suffix is the whole warning.
 * 2. **GST is carved out of `revenue_paise`, never added to it** (P5a decision
 *    1). `tax_paise` renders as an "of which" clarification under the total;
 *    `net_revenue_paise` is what is left after it. Adding `tax_paise` to any
 *    displayed total double-charges the day.
 *
 * `version` is the reason `metrics` is a JSON column rather than a wall of
 * columns: a signed row is frozen for good, so rows written under an older
 * shape survive forever and the renderer branches on this number instead of
 * guessing from which keys happen to be present.
 */

import type { OrderChannel } from '@/lib/types/kds';

/** The shape this build knows how to render in full. */
export const DAILY_CLOSE_METRICS_VERSION = 1;

/**
 * `SystemSetting['daily_close'].signer_role_codes` as seeded.
 *
 * The client uses it only to decide whether to *offer* the sign-off — the server
 * re-reads the live setting and answers `403` regardless of what this array
 * says, so a drifted copy costs a confusing button, never an unauthorised
 * signature.
 */
export const DAILY_CLOSE_SIGNER_ROLE_CODES: readonly string[] = [
  'FRONTEND_LEAD',
  'FOUNDER_ADMIN',
];

export type DailyCloseStatus = 'open' | 'signed';

/** Revenue for one sales channel on the closed day. */
export interface DailyCloseChannelBreakdown {
  channel: OrderChannel;
  orders: number;
  /** Integer paise. */
  revenue_paise: number;
}

/** The order half of the close. Every `_paise` field is an integer. */
export interface DailyCloseOrderMetrics {
  /** Orders counted in `revenue_paise` — cancelled and refunded are excluded. */
  total: number;
  /** Σ `Order.total` over the counted orders. Tax-inclusive and authoritative. */
  revenue_paise: number;
  subtotal_paise: number;
  channel_modifier_paise: number;
  discount_paise: number;
  shipping_paise: number;
  /** GST already inside `revenue_paise`. Never a `+` line. */
  tax_paise: number;
  /** `revenue_paise − tax_paise`. */
  net_revenue_paise: number;
  by_channel: DailyCloseChannelBreakdown[];
  cancelled: number;
  refunded: number;
  /** `Refund` rows that reached `processed` inside the window. */
  refunds: number;
  refund_amount_paise: number;
}

/** One waste reason and what it cost. `reason` is a `WasteReason` value. */
export interface DailyCloseWasteReason {
  reason: string;
  entries: number;
  cost_paise: number;
}

export interface DailyCloseWasteMetrics {
  entries: number;
  cost_paise: number;
  by_reason: DailyCloseWasteReason[];
}

/**
 * `created` and `depleted` both count batches **opened on this day**.
 * `PrepBatch` carries no `depleted_at`, so a batch opened on Monday and emptied
 * on Tuesday is in neither Tuesday figure — the backend is deliberately honest
 * about that rather than inventing a column, and the screen says so out loud.
 */
export interface DailyCloseBatchMetrics {
  created: number;
  depleted: number;
}

/**
 * `checked` is the current `IngredientStock` row count — the denominator "how
 * many rows could have drifted", read as of the computation, not windowed.
 * `drifted` counts the `stock.reconciliation_mismatch` audit rows written inside
 * the window.
 *
 * **`ran_at` is `null` on a clean night.** The reconciliation job records drift
 * and nothing else, so "no timestamp" means "nothing drifted", not "the job
 * never ran". The screen must say that; a bare em dash reads as an outage.
 */
export interface DailyCloseReconciliationMetrics {
  checked: number;
  drifted: number;
  ran_at: string | null;
}

/** Shipments *created* on this day, folded by outcome. The four are disjoint. */
export interface DailyCloseShipmentMetrics {
  open: number;
  failed: number;
  delivered: number;
  cancelled: number;
}

/** The frozen contract persisted verbatim in `DailyClose.metrics`. */
export interface DailyCloseMetrics {
  version: number;
  /** `YYYY-MM-DD`, node-local. */
  business_date: string;
  /** IANA zone the day was bounded in. */
  timezone: string;
  /** ISO-4217 code from `Node.currency`. */
  currency: string;
  /** The UTC instants the day spanned, `[start, end)`. */
  window: { start: string; end: string };
  orders: DailyCloseOrderMetrics;
  waste: DailyCloseWasteMetrics;
  batches: DailyCloseBatchMetrics;
  stock_reconciliation: DailyCloseReconciliationMetrics;
  shipments: DailyCloseShipmentMetrics;
  /** ISO instant the numbers were gathered. A recompute moves it; a signature freezes it. */
  computed_at: string;
}

/** A `DailyClose` row as the API presents it — `business_date` is a `YYYY-MM-DD`. */
export interface DailyCloseView {
  id: string;
  node_id: string;
  business_date: string;
  status: DailyCloseStatus;
  metrics: DailyCloseMetrics;
  notes: string | null;
  /** The signatory's `User.id`, or `null` while the day is still open. */
  signed_by: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Body of `POST /daily-close/:date/sign`. `notes` is capped at 2000 by the DTO. */
export interface SignDailyClosePayload {
  notes?: string;
}

/** The longest note the server will accept. */
export const DAILY_CLOSE_NOTES_MAX = 2000;

/**
 * True when this build understands the frozen shape well enough to render it.
 *
 * A signed close from an older version is not an error and must not be hidden —
 * the screen shows what it can and says plainly that the row predates the
 * current metric set.
 */
export function isKnownMetricsVersion(
  metrics: DailyCloseMetrics | null | undefined,
): boolean {
  return metrics?.version === DAILY_CLOSE_METRICS_VERSION;
}
