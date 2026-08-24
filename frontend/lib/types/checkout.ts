/**
 * The `sync → quote → pay → confirm` pipeline, plus loyalty and the customer's
 * view of a parcel.
 *
 * ## Money
 *
 * **Every money field here is a `number` in rupees.** `toQuoteResponse`
 * (`backend/src/checkout/checkout.service.ts`) converts the stored integer paise
 * to `Prisma.Decimal`, and `DecimalSerializationInterceptor` renders that as a
 * JSON number. The one exception is {@link CreateOrderResponse.amount}, which is
 * **paise**, because it is handed straight to Razorpay Checkout.
 *
 * `tax_rate` and `tax_breakup[].rate` are **strings** (`"5.00"`) — they are
 * rates, not amounts, and the backend leaves them as the column's string form.
 *
 * ## The total
 *
 * `total = subtotal − discount_amount − loyalty.redeem_amount + shipping_amount`.
 *
 * **`tax_amount` is contained inside `subtotal` and is never added to a total.**
 * `Order.subtotal` is the tax-inclusive gross and `tax_amount` is the GST carved
 * out of it, so every money component renders "Subtotal (incl. GST)" with tax as
 * an *of which* line. `assertInclusiveTotal` in `lib/format/currency.ts` is the
 * dev-mode guard.
 *
 * ## Errors on the pay step (P5b decision 4)
 *
 * `POST /customer/orders` distinguishes three failures, and `apiClient`'s
 * {@link ApiError} exposes the status so the call site can tell them apart:
 *
 * - **`410 Gone`** — the quote is still in Redis but its `expires_at` passed.
 *   Re-quote in place and tell the customer the price was refreshed.
 * - **`404`** — the quote is gone entirely (never issued, already spent, TTL
 *   reaped). Bounce to `/cart`.
 * - **`400`** — the price moved or a line vanished. Show the server's message
 *   verbatim and re-quote.
 */

import type { FulfilmentType, ProductType } from './catalog';
import type { CouponType } from './promotions';
import type { ShipmentEventSummary, ShipmentStatus, ShippingProvider } from './shipments';

/** The two channels a marketplace cart may check out on (D-04). */
export type CheckoutChannel = 'takeaway' | 'delivery';

// ─── loyalty ────────────────────────────────────────────────────────────────

/** Prisma `LoyaltyTier`. */
export type LoyaltyTier = 'member' | 'regular' | 'insider';

/** Prisma `LoyaltyReason`. */
export type LoyaltyReason = 'earn' | 'redeem' | 'adjust' | 'expire';

export const LOYALTY_TIERS: LoyaltyTier[] = ['member', 'regular', 'insider'];

export const LOYALTY_TIER_LABELS: Record<LoyaltyTier, string> = {
  member: 'Member',
  regular: 'Regular',
  insider: 'Insider',
};

export const LOYALTY_REASON_LABELS: Record<LoyaltyReason, string> = {
  earn: 'Earned',
  redeem: 'Redeemed',
  adjust: 'Adjusted',
  expire: 'Expired',
};

/** A `LoyaltyAccount` row. Created empty on first read, so it is never missing. */
export interface LoyaltyAccount {
  customer_id: string;
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  created_at: string;
  updated_at: string;
}

/** One ledger row (`LEDGER_SELECT` in `loyalty.service.ts`). `delta` may be negative. */
export interface LoyaltyTransaction {
  id: string;
  delta: number;
  balance_after: number;
  reason: LoyaltyReason;
  order_id: string | null;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
}

/** `null` once the customer is at the top tier. */
export interface NextTier {
  tier: LoyaltyTier;
  points_needed: number;
}

/** `GET /customer/loyalty` — the whole storefront loyalty surface. */
export interface LoyaltySummary {
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  /** Rupees per point, e.g. `0.25` (four points to the rupee). */
  redeem_value_per_point: number;
  next_tier: NextTier | null;
  /** The most recent 50 rows, newest first. */
  transactions: LoyaltyTransaction[];
}

/** `POST /customers/:id/loyalty-adjust` (staff, `MANAGE_OPS`). `delta` is non-zero. */
export interface AdjustLoyaltyPayload {
  delta: number;
  notes: string;
}

// ─── the quote ──────────────────────────────────────────────────────────────

/** One re-priced line. `unit_price`, `gross` and `tax` are rupees; `tax_rate` is a string. */
export interface QuoteLine {
  product_id: string;
  variant_id: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  type: ProductType;
  /** Frozen at quote time from `Product.fulfilment` — what routes the line. */
  fulfilment: FulfilmentType;
  unit_price: number;
  /** `unit_price × quantity`, tax-inclusive. */
  gross: number;
  /** A percentage as a string, e.g. `"5.00"`. */
  tax_rate: string;
  /** Carved out of `gross`, contained within it. */
  tax: number;
}

/** A line that could not be sold, with the message to show beside it. */
export interface RejectedLine {
  product_id: string;
  variant_id: string | null;
  name: string;
  reason: string;
}

/** The coupon frozen into a quote. The internal id stays server-side. */
export interface QuoteCoupon {
  code: string;
  type: CouponType;
  /** Rupees discounted. */
  discount: number;
}

/** The courier decision frozen into a quote. `null` when nothing ships. */
export interface QuoteShipping {
  provider: ShippingProvider | string;
  courier_name: string | null;
  courier_id: string | null;
  etd: string | null;
  serviceable: boolean;
}

/** One GST bucket. `taxable + tax === gross` for the bucket (inclusive GST). */
export interface TaxBreakupRow {
  /** A percentage as a string, e.g. `"5.00"`. */
  rate: string;
  taxable: number;
  tax: number;
}

/** The loyalty context a quote carries — balance and caps, plus what was applied. */
export interface QuoteLoyalty {
  balance: number;
  tier: LoyaltyTier;
  /** Capped by the balance *and* `loyalty.max_redeem_percent` of the discounted subtotal. */
  max_redeemable_points: number;
  points_applied: number;
  /** Rupee value of `points_applied`. A term in the total. */
  redeem_amount: number;
  redeem_value_per_point: number;
  /** What the order will earn once delivered/attended — not credited at payment. */
  points_earned_estimate: number;
}

/** A 15-minute `held` `EventBooking` created by the quote, one per booking line. */
export interface QuoteHold {
  booking_id: string;
  event_id: string;
  product_id: string;
  guests: number;
  expires_at: string;
}

/**
 * `POST /customer/checkout/quote` — the frozen price the customer is about to
 * pay. Lives 15 minutes; `expires_at` drives the checkout countdown.
 *
 * The cart is **not** in the request: it is read from Redis, so a client can
 * only ever quote its own cart (`CHK-02`).
 */
export interface Quote {
  quote_id: string;
  expires_at: string;
  channel: CheckoutChannel;
  pickup: boolean;
  delivery_address_id: string | null;
  lines: QuoteLine[];
  rejected: RejectedLine[];
  /** Tax-inclusive gross of the available lines. */
  subtotal: number;
  coupon: QuoteCoupon | null;
  /** The coupon's discount. Loyalty is carried separately, in `loyalty.redeem_amount`. */
  discount_amount: number;
  shipping: QuoteShipping | null;
  shipping_amount: number;
  /** GST already inside `subtotal`. **Never** added to `total`. */
  tax_amount: number;
  tax_breakup: TaxBreakupRow[];
  loyalty: QuoteLoyalty;
  holds: QuoteHold[];
  /** `subtotal − discount_amount − loyalty.redeem_amount + shipping_amount`. */
  total: number;
}

/**
 * The quote request. Every number that matters is computed server-side from
 * these few intentions (`CHK-01`).
 *
 * Errors: `400` cart empty · `400` nothing available · `400` pincode not served
 * · `400` a coupon message · `503` Redis unavailable.
 */
export interface QuoteRequest {
  channel: CheckoutChannel;
  delivery_address_id?: string;
  /** Local lines are collected at the villa, so the delivery allow-list is skipped. */
  pickup?: boolean;
  /** One code — stacking is banned (`PROMO-02`). */
  coupon_code?: string;
  /** Clamped server-side by the balance, the cap and the subtotal; never rejected. */
  redeem_points?: number;
}

// ─── pay and confirm ────────────────────────────────────────────────────────

/** `POST /customer/orders` — names a stored quote rather than re-describing the cart. */
export interface CreateOrderRequest {
  quote_id: string;
  /** Makes a retried "Pay" tap resolve to the same Razorpay order. 8–64 chars. */
  idempotency_key?: string;
}

/** Everything Razorpay Checkout needs to open. */
export interface CreateOrderResponse {
  razorpay_order_id: string;
  /** **Paise** — Razorpay's own unit, copied verbatim from the frozen quote. */
  amount: number;
  currency: 'INR';
  /** The publishable key. `null` when the server has none configured. */
  key_id: string | null;
  /** Echoed back so the client can correlate the payment with the quote it accepted. */
  quote_id: string;
}

/** `POST /customer/orders/confirm`. A replay returns the same order, not an error. */
export interface ConfirmOrderRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// ─── coupons on the storefront ──────────────────────────────────────────────

/** `POST /customer/coupons/validate`. */
export interface CouponValidationRequest {
  code: string;
  channel?: CheckoutChannel;
}

/**
 * The success shape. There is **no `{ valid: false }` branch** — an ineligible
 * code answers `400` with a message written for the customer
 * (`Invalid coupon code`, `This coupon has expired`,
 * `Add ₹150.00 more to use this coupon`, `You have already used this coupon`,
 * `This coupon does not apply to the items in your cart`). Show it verbatim.
 */
export interface CouponValidation {
  valid: true;
  code: string;
  type: CouponType;
  /** Rupees this code would take off the current cart. */
  discount: number;
  free_shipping: boolean;
}

// ─── serviceability ─────────────────────────────────────────────────────────

/**
 * `POST /customer/checkout/serviceability` (added by P5b Task 2) — lets the
 * address step validate a pincode *before* a quote exists, instead of making
 * the customer discover it by failing to check out.
 *
 * `shipped` is `null` when the cart has no shipped line, so the question does
 * not arise.
 */
export interface ServiceabilityRequest {
  pincode: string;
  channel?: CheckoutChannel;
}

export interface ServiceabilityResponse {
  local: { serviceable: boolean; reason?: string };
  shipped: {
    serviceable: boolean;
    courier_name?: string;
    etd?: string;
    /** Rupees. */
    amount?: number;
  } | null;
}

// ─── the customer's parcel ──────────────────────────────────────────────────

/**
 * `GET /customer/orders/:id/shipment` (`SHIP-05`).
 *
 * **`null` — not a 404 — when the order has no shipped lines.** "This order is
 * not a parcel" is a normal answer and the storefront renders nothing.
 *
 * The route returns the whole `Shipment` row with a narrow event projection, so
 * fields the track page does not use (`pickup_location_code`, `packed_by`) are
 * present and simply ignored.
 */
export interface CustomerShipment {
  id: string;
  node_id: string;
  order_id: string;
  provider: ShippingProvider | string;
  provider_order_id: string | null;
  provider_shipment_id: string | null;
  awb: string | null;
  courier_name: string | null;
  status: ShipmentStatus;
  label_url: string | null;
  tracking_url: string | null;
  pickup_location_code: string;
  weight_grams: number;
  cost: number | null;
  etd: string | null;
  packed_by: string | null;
  created_at: string;
  updated_at: string;
  /** Newest first. */
  events: ShipmentEventSummary[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Groups a quote's lines the way the cart and review steps present them. */
export function groupQuoteLines(
  lines: readonly QuoteLine[],
): Record<FulfilmentType, QuoteLine[]> {
  const groups: Record<FulfilmentType, QuoteLine[]> = {
    local: [],
    shipped: [],
    booking: [],
  };
  for (const line of lines) groups[line.fulfilment].push(line);
  return groups;
}

/** True once the quote's own 15-minute window has closed — the Pay button disables. */
export function isQuoteExpired(quote: Pick<Quote, 'expires_at'>, now: number = Date.now()): boolean {
  return Date.parse(quote.expires_at) <= now;
}
