import type { FulfilmentType, OrderChannel, ProductType } from '@prisma/client';
import type { Paise } from '../common/money/money';

/**
 * The frozen wire shapes of the P5a checkout pipeline.
 *
 * Everything here is a *stored artefact*: a quote written to Redis, a pending
 * order copied out of it, a line frozen at quote time and replayed inside the
 * confirm transaction. Nothing in this file is recomputed downstream, so the
 * field set is a contract — Tasks 8 (quote endpoint), 9 (pay) and 10 (confirm)
 * import it verbatim and must not edit it.
 *
 * **Every money field is integer paise** (`Paise`), produced by
 * `common/money/money.ts`. A `Prisma.Decimal` never appears in a stored quote:
 * it does not survive `JSON.stringify` as a number, and re-parsing one as a
 * float is exactly the drift this module exists to prevent.
 */

/** One re-priced cart line. Every money field is integer paise. */
export interface PricedLine {
  product_id: string;
  variant_id: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  /** Product type — decides which availability rule ran. */
  type: ProductType;
  /** Derived from `Product.fulfilment` at quote time (decision 6). */
  fulfilment: FulfilmentType;
  /** base_price + variant.price_delta + channel modifier share, per unit. */
  unit_price: Paise;
  /** unit_price × quantity, tax-inclusive. */
  gross: Paise;
  /** `Product.tax_rate` as a percentage string, e.g. "5.00". */
  tax_rate: string;
  /** Carved out of `gross` (decision 1) — contained *within* it, never added. */
  tax: Paise;
  weight_grams: number;
  hsn_code: string | null;
  available: boolean;
  unavailable_reason: string | null;
  /** `experience` lines only — the Event the booking hold is against. */
  event_id: string | null;
}

/** One cart line that could not be sold, with the message the storefront shows. */
export interface RejectedLine {
  product_id: string;
  variant_id: string | null;
  name: string;
  reason: string;
}

/** Per-rate GST rollup. `taxable + tax === gross` for every bucket (inclusive GST). */
export interface TaxBucket {
  rate: string;
  taxable: Paise;
  tax: Paise;
}

export interface PricedCart {
  lines: PricedLine[];
  /** Σ gross of available lines. */
  subtotal: Paise;
  /** Σ tax of available lines — contained *within* `subtotal`. */
  tax_total: Paise;
  tax_breakup: TaxBucket[];
  channel: OrderChannel;
  /** Σ of the per-unit channel modifier actually applied across all lines. */
  channel_modifier: Paise;
  has_local: boolean;
  has_shipped: boolean;
  has_booking: boolean;
  shipped_weight_grams: number;
  rejected: RejectedLine[];
}

/**
 * A mixed cart split by `OrderItem.fulfilment`. The confirm transaction routes
 * `local` lines to the kitchen, `shipped` lines to one `Shipment`, and
 * `booking` lines to their `EventBooking`.
 */
export interface FulfilmentGroups {
  local: PricedLine[];
  shipped: PricedLine[];
  booking: PricedLine[];
}

/** Booking hold created during a quote (15 minutes, SPEC §5.2). */
export interface QuoteHold {
  booking_id: string;
  event_id: string;
  product_id: string;
  guests: number;
  expires_at: string;
}

/** The coupon actually applied to a quote, frozen with its discount. */
export interface QuoteCoupon {
  id: string;
  code: string;
  type: string;
  discount: Paise;
}

/** The shipping decision frozen into a quote. */
export interface QuoteShipping {
  provider: string;
  courier_name: string | null;
  courier_id: string | null;
  etd: string | null;
  serviceable: boolean;
}

/** The stored quote — Redis `quote:{customerId}:{quoteId}`, TTL 15 min. */
export interface StoredQuote {
  v: 2;
  quote_id: string;
  customer_id: string;
  created_at: string;
  expires_at: string;
  channel: OrderChannel;
  delivery_address_id: string | null;
  pickup: boolean;
  lines: PricedLine[];
  holds: QuoteHold[];
  subtotal: Paise;
  discount_amount: Paise;
  coupon: QuoteCoupon | null;
  shipping_amount: Paise;
  shipping: QuoteShipping | null;
  tax_amount: Paise;
  tax_breakup: TaxBucket[];
  loyalty_points_redeemed: number;
  loyalty_redeem_amount: Paise;
  loyalty_points_earned_estimate: number;
  /** `subtotal − discount_amount − loyalty_redeem_amount + shipping_amount`. */
  total: Paise;
}

/** Redis `pending_order:{rzp_order_id}` — v2 (decision 5). */
export interface PendingOrderV2 extends Omit<
  StoredQuote,
  'v' | 'quote_id' | 'expires_at'
> {
  v: 2;
  razorpay_order_id: string;
  idempotency_key: string;
}
