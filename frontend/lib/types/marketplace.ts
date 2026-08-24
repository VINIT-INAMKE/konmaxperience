import type { FulfilmentType } from './catalog';
import type {
  OrderChannel,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './kds';
import type { DeliveryStatus } from './orders';

/**
 * One cart line as the **client** holds it — in the zustand store, before and
 * between syncs.
 *
 * **`variantId` is part of a line's identity, not an optional extra**
 * (P5b decision 2). Two variants of the same product are two lines at two
 * prices, keyed by `` `${productId}:${variantId ?? ''}` `` — byte-identical to
 * the key `assertQuoteStillValid` uses server-side. `undefined` and `null` mean
 * the same thing here: "this product has no variant".
 *
 * The last four fields are optional **only because a line can be built locally
 * before it has ever been priced**. The server populates all of them on every
 * read; anything that comes off the wire is a {@link PricedCartItem}, where
 * they are required.
 */
export interface CartItem {
  productId: string;
  variantId?: string | null;
  name: string;
  /** Set when the line names a variant, so the cart can render "Large / 500 g". */
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
  /** Overwritten from `Product.fulfilment` on every sync; a client echo is never persisted. */
  fulfilment?: FulfilmentType | null;
  available?: boolean;
  /** The message to show beside an unavailable line. */
  unavailable_reason?: string | null;
}

/**
 * One line as `GET /customer/cart` and `POST /customer/cart/sync` return it —
 * the backend's own `PricedCartItem`, with every field guaranteed.
 *
 * `unitPrice` is the **server's** price in rupees, re-derived from
 * `Product.base_price` on every read (`CHK-01`), never the one the client
 * cached. `fulfilment` is `null` only for a line the server could not price at
 * all.
 */
export interface PricedCartItem {
  productId: string;
  variantId: string | null;
  name: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
  fulfilment: FulfilmentType | null;
  available: boolean;
  unavailable_reason: string | null;
}

/**
 * The cart envelope. `totals.subtotal` is tax-inclusive and `totals.tax_total`
 * is contained inside it (P5a decision 1).
 *
 * `/cart` shows those two figures and nothing else: shipping, coupon discount
 * and loyalty exist only inside a quote, and quoting needs an address
 * (P5b decision 6).
 */
export interface CartData {
  items: PricedCartItem[];
  channel: 'takeaway' | 'delivery' | null;
  deliveryAddressId: string | null;
  updatedAt: string;
  totals: { subtotal: number; tax_total: number };
}

/**
 * `POST /customer/cart/sync`.
 *
 * The incoming cart is authoritative on every explicit sync; the stored cart is
 * read only when `items` is empty *and* no `channel`/`deliveryAddressId` was
 * sent — the login-merge case (P5b decision 14, Task 2).
 */
export interface SyncCartPayload {
  items: Array<{
    productId: string;
    variantId?: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    imageUrl?: string | null;
    fulfilment?: FulfilmentType;
  }>;
  channel?: 'takeaway' | 'delivery';
  deliveryAddressId?: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: 'Home' | 'Work' | 'Other';
  address: string;
  landmark: string | null;
  pincode: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
}

/** Body of `POST /customer/addresses` and `PATCH /customer/addresses/:id`. */
export interface CustomerAddressPayload {
  label: 'Home' | 'Work' | 'Other';
  address: string;
  landmark?: string;
  pincode: string;
  lat?: number;
  lng?: number;
}

/** Tracking uses the same vocabulary as the order itself — kept as an alias so the two cannot drift. */
export type OrderTrackingStatus = OrderStatus;

export interface OrderTrackingStep {
  label: string;
  status: 'completed' | 'active' | 'pending';
  timestamp: string | null;
}

/** One line of a customer-facing order. */
export interface CustomerOrderItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  status: OrderItemStatus;
  /** What routes the line: kitchen, parcel or booking. */
  fulfilment: FulfilmentType;
  /** A percentage as a number, e.g. `5`. */
  tax_rate: number;
  /** Set on an `experience` line once its hold is confirmed. */
  event_booking_id: string | null;
  ready_at: string | null;
  created_at: string;
  product: { id: string; name: string };
}

/**
 * `GET /customer/orders`, `/customer/orders/:id` and the order returned by
 * `POST /customer/orders/confirm`.
 *
 * `total = subtotal − discount_amount − loyalty_points_redeemed_value +
 * shipping_amount`, and **`tax_amount` is already inside `subtotal`**.
 * `discount_amount` bundles the coupon and the loyalty burn into one column;
 * a receipt reconstructs the split from `CouponRedemption` and
 * `loyalty_points_redeemed × redeem_value_per_point` (P5a decision 23) — see
 * `assertDiscountSplit` in `lib/format/currency.ts`.
 */
export interface CustomerOrder {
  id: string;
  order_number: number;
  channel: OrderChannel;
  status: OrderStatus;
  delivery_status: DeliveryStatus | null;
  /** Tax-inclusive gross. */
  subtotal: number;
  channel_modifier_amount: number;
  /** Coupon **and** loyalty, summed into one column. */
  discount_amount: number;
  shipping_amount: number;
  /** GST carved out of `subtotal`. Never added to `total`. */
  tax_amount: number;
  total: number;
  loyalty_points_earned: number;
  loyalty_points_redeemed: number;
  coupon_id: string | null;
  customer_name: string | null;
  delivery_address: string | null;
  created_at: string;
  items: CustomerOrderItem[];
  payment: {
    method: PaymentMethod;
    /** Prisma column is `status`; there is no `payment_status` on Payment. */
    status: PaymentStatus;
    amount?: number;
    razorpay_payment_id?: string | null;
  } | null;
}
