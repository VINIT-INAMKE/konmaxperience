/**
 * Coupons — the staff CRUD surface (`GET/POST /promotions/coupons`,
 * `PATCH/DELETE /promotions/coupons/:id`, all `MANAGE_OPS`) and the enums the
 * customer-facing validation shares with it.
 *
 * Two rules the screens must not re-litigate:
 *
 * - **`DELETE` disables, it does not delete.** A redeemed coupon is a financial
 *   record; `CouponsService.archive` sets `status: 'disabled'`.
 * - **A discount is never computed on the client** (`PROMO-02`). The only
 *   discount figure the frontend may show is one the server returned, from
 *   `POST /customer/coupons/validate` or from inside a quote.
 */

import type { ProductType } from './catalog';

/** Prisma `CouponType`. */
export type CouponType = 'percent' | 'fixed' | 'free_shipping';

/** Prisma `CouponStatus`. A coupon is `draft` unless someone deliberately activates it. */
export type CouponStatus = 'draft' | 'active' | 'disabled';

export const COUPON_TYPES: CouponType[] = ['percent', 'fixed', 'free_shipping'];

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  percent: 'Percentage off',
  fixed: 'Flat amount off',
  free_shipping: 'Free shipping',
};

export const COUPON_STATUSES: CouponStatus[] = ['draft', 'active', 'disabled'];

export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  disabled: 'Disabled',
};

/**
 * A `Coupon` row.
 *
 * `value` means a percentage for `percent`, a rupee amount for `fixed`, and is
 * ignored for `free_shipping`. `min_order` is measured against the whole cart
 * subtotal (gross, tax-inclusive), not against the eligible subset.
 * An empty `applies_to` means "every product type".
 */
export interface Coupon {
  id: string;
  node_id: string;
  code: string;
  description: string;
  type: CouponType;
  value: number;
  min_order: number | null;
  max_discount: number | null;
  applies_to: ProductType[];
  starts_at: string;
  ends_at: string;
  /** Total redemptions across all customers. `null` = unlimited. */
  usage_limit: number | null;
  /** Redemptions per customer. `null` = unlimited. */
  per_customer_limit: number | null;
  status: CouponStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Present on list and detail reads — the usage column reads it. */
  _count?: { redemptions: number };
}

export interface CouponsEnvelope {
  items: Coupon[];
  next_cursor: string | null;
}

/** `POST /promotions/coupons`. Money fields are rupees with at most 2dp. */
export interface CreateCouponPayload {
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  min_order?: number;
  max_discount?: number;
  applies_to?: ProductType[];
  starts_at: string;
  ends_at: string;
  usage_limit?: number;
  per_customer_limit?: number;
  status?: CouponStatus;
}

/**
 * `PATCH /promotions/coupons/:id`.
 *
 * The four nullable columns accept an explicit `null` to *clear* the value —
 * `{ max_discount: null }` removes the ceiling, which `undefined` ("leave
 * unchanged") cannot express.
 */
export interface UpdateCouponPayload {
  code?: string;
  description?: string;
  type?: CouponType;
  value?: number;
  min_order?: number | null;
  max_discount?: number | null;
  applies_to?: ProductType[];
  starts_at?: string;
  ends_at?: string;
  usage_limit?: number | null;
  per_customer_limit?: number | null;
  status?: CouponStatus;
}

/** A `CouponRedemption` row, as the customer detail screen joins it. */
export interface CouponRedemption {
  id: string;
  coupon_id: string;
  order_id: string;
  customer_id: string;
  /** Rupees actually discounted by this coupon on that order. */
  amount: number;
  created_at: string;
  coupon?: { id: string; code: string; type: CouponType };
}

/**
 * Whether a coupon is live *right now*, independent of its stored status —
 * an `active` coupon outside its window is not usable and the badge should say so.
 */
export function isCouponLive(coupon: Coupon, now: number = Date.now()): boolean {
  if (coupon.status !== 'active') return false;
  const starts = Date.parse(coupon.starts_at);
  const ends = Date.parse(coupon.ends_at);
  return now >= starts && now <= ends;
}
