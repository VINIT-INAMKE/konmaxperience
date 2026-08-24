/**
 * The single money-rendering surface for the storefront and the staff commerce
 * screens.
 *
 * Three facts about P5a's wire format decide everything in this file:
 *
 * 1. **Money arrives as a JSON number in rupees.** `DecimalSerializationInterceptor`
 *    (`backend/src/main.ts`) turns every `Prisma.Decimal` into `.toNumber()`, so
 *    `subtotal` is `6403`, never `"6403.00"`. Nothing here calls `parseFloat`,
 *    and no type in `lib/types/**` declares a money field as `string`.
 * 2. **Paise appear exactly once**, on `POST /customer/orders` →
 *    `CreateOrderResponse.amount`, because that is Razorpay's own unit. Use
 *    {@link formatPaise} there and {@link formatCurrency} everywhere else.
 * 3. **`tax_amount` is carved *out of* `subtotal`, never added to it**
 *    (P5a decision 1). Every total in the system is
 *    `subtotal − discount_amount − loyalty.redeem_amount + shipping_amount`.
 *    {@link assertInclusiveTotal} makes a violation loud in development.
 */

import type { Quote } from '../types/checkout';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Same digits, no currency symbol — for table columns that carry their own ₹ header. */
const INR_PLAIN = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PAISE_PER_RUPEE = 100;

/** Half a paise: the widest a rounded rupee comparison may legitimately drift. */
const EPSILON = 0.005;

/**
 * `6485` → `₹6,485.00`.
 *
 * A non-finite value renders as `₹0.00` rather than `₹NaN`: a broken number must
 * not become the most eye-catching thing on the page, and the dev-mode
 * invariants below are where a real arithmetic fault gets caught.
 */
export function formatCurrency(value: number): string {
  return INR.format(Number.isFinite(value) ? value : 0);
}

/** `6485` → `6,485.00`. For columns whose header already says ₹. */
export function formatAmount(value: number): string {
  return INR_PLAIN.format(Number.isFinite(value) ? value : 0);
}

/**
 * Razorpay's unit → a rupee string. `648500` → `₹6,485.00`.
 *
 * Only `CreateOrderResponse.amount` is in paise; passing a rupee figure here
 * silently divides it by a hundred, so the call sites are deliberately few.
 */
export function formatPaise(paise: number): string {
  return formatCurrency(paiseToRupees(paise));
}

/** Integer paise → rupees, rounded to the two decimals a `Decimal(12,2)` can hold. */
export function paiseToRupees(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / PAISE_PER_RUPEE;
}

/** Rupees → integer paise. The inverse of {@link paiseToRupees}. */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** `2500` → `₹2,500` — no decimals, for headline figures that are whole by construction. */
export function formatCurrencyCompact(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(safe)}`;
}

/** `5` → `5%`. Tax rates arrive as the string `"5.00"`; both forms are accepted. */
export function formatTaxRate(rate: number | string): string {
  const numeric = typeof rate === 'string' ? Number(rate) : rate;
  if (!Number.isFinite(numeric)) return '0%';
  // "5.00" reads better as "5%", but "2.50" must keep its half point.
  const trimmed = Number(numeric.toFixed(2));
  return `${trimmed}%`;
}

/** Two rupee amounts are equal when they agree to the paise. */
function rupeesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

/** True only in a development build — the invariants below are free in production. */
function invariantsEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** The narrow slice of a quote the total invariant actually reads. */
export interface InclusiveTotalInput {
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  total: number;
  loyalty?: { redeem_amount: number } | null;
}

/**
 * The total P5a actually computes:
 * `subtotal − discount_amount − loyalty.redeem_amount + shipping_amount`.
 *
 * `tax_amount` is **not** a term. It is the GST already carved out of
 * `subtotal`, so adding it would double-charge every order.
 */
export function expectedTotal(quote: InclusiveTotalInput): number {
  const redeem = quote.loyalty?.redeem_amount ?? 0;
  const net = Math.max(quote.subtotal - quote.discount_amount - redeem, 0);
  return Number((net + quote.shipping_amount).toFixed(2));
}

/**
 * Dev-only invariant: throws when a rendered total does not match the formula
 * above. Wired behind `NODE_ENV !== 'production'` so a genuine backend
 * regression stops a developer immediately and never a customer mid-checkout.
 *
 * Call it once per quote render — from `<QuoteSummary>` — not per line.
 */
export function assertInclusiveTotal(
  quote: InclusiveTotalInput,
  label = 'quote',
): void {
  if (!invariantsEnabled()) return;
  const expected = expectedTotal(quote);
  if (rupeesEqual(expected, quote.total)) return;
  throw new Error(
    `[money] ${label} total ${quote.total} != subtotal ${quote.subtotal} ` +
      `− discount ${quote.discount_amount} − loyalty ${quote.loyalty?.redeem_amount ?? 0} ` +
      `+ shipping ${quote.shipping_amount} (= ${expected}). ` +
      'tax_amount is inside subtotal and is never a term.',
  );
}

/** Convenience for the checkout screen, whose quote is the full {@link Quote}. */
export function assertQuoteTotal(quote: Quote): void {
  assertInclusiveTotal(quote, `quote ${quote.quote_id}`);
}

/**
 * Dev-only invariant for receipts (P5a decision 23).
 *
 * `Order.discount_amount` bundles the coupon and the loyalty burn into one
 * column. A receipt reconstructs the split — coupon from `CouponRedemption` (or
 * the quote echo), loyalty from `loyalty_points_redeemed × redeem_value_per_point`
 * — and the two halves must add back up to the column, or one of the two lines
 * on the receipt is a lie.
 */
export function assertDiscountSplit(
  discountAmount: number,
  couponAmount: number,
  loyaltyAmount: number,
  label = 'receipt',
): void {
  if (!invariantsEnabled()) return;
  if (rupeesEqual(couponAmount + loyaltyAmount, discountAmount)) return;
  throw new Error(
    `[money] ${label} discount split ${couponAmount} + ${loyaltyAmount} ` +
      `!= discount_amount ${discountAmount}`,
  );
}

/**
 * The rupee value of a loyalty burn, for the slider's live preview before a
 * quote exists. The server clamps the real figure three ways
 * (balance, `max_redeem_percent`, subtotal) — this is display only.
 */
export function loyaltyValue(points: number, valuePerPoint: number): number {
  if (!Number.isFinite(points) || !Number.isFinite(valuePerPoint)) return 0;
  return Number((Math.max(0, Math.floor(points)) * valuePerPoint).toFixed(2));
}
