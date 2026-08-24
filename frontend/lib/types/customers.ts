/**
 * The staff Customers screen (`OPS-04`) — `GET /customers`, `GET /customers/:id`
 * and the two narrow writes, all `MANAGE_OPS`.
 *
 * `GET /customers/:id` fans out five bounded queries rather than one deep
 * include, so every relation on {@link CustomerDetail} is a **capped, recent**
 * slice, not the customer's whole history: orders, loyalty ledger, coupon
 * redemptions and reviews each come back newest-first and truncated. Use
 * `_count` for the real totals and `orders_summary` for lifetime value.
 *
 * There is no customer-facing route here — the storefront reads its own profile
 * through `GET /customer-auth/profile` and its own orders through
 * `GET /customer/orders`.
 */

import type { FulfilmentType } from './catalog';
import type { LoyaltyAccount, LoyaltyTransaction } from './checkout';
import type { OrderChannel, OrderItemStatus, OrderStatus, PaymentMethod, PaymentStatus } from './kds';
import type { CustomerAddress } from './marketplace';
import type { CouponRedemption } from './promotions';
import type { ReviewStatus } from './reviews';

/** The `Customer` columns both reads share. `phone` is the login identity. */
export interface CustomerBase {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  marketing_opt_in: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A row of `GET /customers?q=&cursor=&limit=`.
 *
 * `q` searches phone (case-sensitive — it is digits), name and email
 * (case-insensitive). `loyalty_account` is `null` until the customer's account
 * has been touched once.
 */
export interface CustomerSummary extends CustomerBase {
  loyalty_account: LoyaltyAccount | null;
  _count: { orders: number; reviews: number; bookings: number };
}

export interface CustomersEnvelope {
  items: CustomerSummary[];
  next_cursor: string | null;
}

/** One line of an order on the customer detail screen. */
export interface CustomerDetailOrderItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  status: OrderItemStatus;
  fulfilment: FulfilmentType;
  /** A percentage as a number, e.g. `5`. */
  tax_rate: number;
  product: { id: string; name: string; slug: string };
}

/** The payment projection joined onto each order. */
export interface CustomerDetailPayment {
  id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  refunded_amount: number;
  razorpay_payment_id: string | null;
  created_at: string;
}

/** A recent order, with its lines and payment. */
export interface CustomerDetailOrder {
  id: string;
  order_number: number;
  channel: OrderChannel;
  status: OrderStatus;
  subtotal: number;
  channel_modifier_amount: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total: number;
  loyalty_points_earned: number;
  loyalty_points_redeemed: number;
  coupon_id: string | null;
  delivery_address: string | null;
  created_at: string;
  updated_at: string;
  items: CustomerDetailOrderItem[];
  payment: CustomerDetailPayment | null;
}

/** A review row on the customer detail screen, with the product joined. */
export interface CustomerDetailReview {
  id: string;
  product_id: string;
  order_item_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  media: string[];
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
  product: { id: string; name: string; slug: string };
}

/** Spend, computed over every order the customer ever placed. */
export interface CustomerOrdersSummary {
  total_orders: number;
  /** Orders that are neither `cancelled` nor `refunded`. */
  billable_orders: number;
  /** Sum of `Order.total` over the billable orders, in rupees. */
  lifetime_value: number;
  last_order_at: string | null;
}

/** `GET /customers/:id`. Every relation below is a recent, capped slice. */
export interface CustomerDetail extends CustomerBase {
  loyalty_account: LoyaltyAccount | null;
  addresses: CustomerAddress[];
  _count: {
    orders: number;
    reviews: number;
    bookings: number;
    coupon_redemptions: number;
  };
  orders_summary: CustomerOrdersSummary;
  orders: CustomerDetailOrder[];
  loyalty_transactions: LoyaltyTransaction[];
  coupon_redemptions: CouponRedemption[];
  reviews: CustomerDetailReview[];
}

/**
 * `PATCH /customers/:id` — deliberately one field. `phone` is the login
 * identity, `name`/`email` are the customer's own to edit, and the loyalty
 * balance moves only through `POST /customers/:id/loyalty-adjust`. Anything else
 * in the body is a `400`.
 */
export interface UpdateCustomerPayload {
  marketing_opt_in: boolean;
}

/** `GET /customers` query parameters. */
export interface CustomerListQuery {
  q?: string;
  cursor?: string;
  limit?: number;
}

/** A display name that never renders as an empty cell. */
export function customerLabel(customer: Pick<CustomerBase, 'name' | 'phone'>): string {
  return customer.name?.trim() || customer.phone;
}
