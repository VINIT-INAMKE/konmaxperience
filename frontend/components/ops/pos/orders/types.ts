/**
 * The shapes `GET /orders/:id` actually returns, for the staff order detail
 * route (`OPS-05`).
 *
 * `lib/types/orders.ts` is the shared mirror and is owned elsewhere in P5b, so
 * the three columns the detail screen needs and that mirror does not yet carry
 * are declared here rather than by widening a file this task does not own:
 *
 * - **`Order.coupon_id`** — Prisma's `include` adds relations; every scalar
 *   column comes back regardless, so `coupon_id`, `loyalty_points_redeemed` and
 *   `loyalty_points_earned` are all on the wire even though only the last two
 *   are in the mirror.
 * - **`OrderItem.event_booking_id`** — set on a `booking` line, `null`
 *   otherwise. The detail table renders it so a staffer can tie a line to the
 *   experience it holds a seat for.
 * - **`Payment.razorpay_order_id` / `razorpay_payment_id`** — the gateway
 *   handles the refund panel quotes back to the operator.
 *
 * What is deliberately **not** here: `OrderItem.variant`. `OrdersService.getOrderById`
 * includes `product: { select: { id, name } }` and nothing else, so the variant's
 * name and SKU are simply not on the wire. `variant_id` is, so the line table
 * flags a variant line and shows the id rather than inventing a name.
 */

import type { Order, OrderItem, Payment } from '@/lib/types/orders';

/** One line of `GET /orders/:id`, with the booking link the mirror omits. */
export interface StaffOrderItem extends OrderItem {
  event_booking_id: string | null;
}

/** The order's payment row, with the two gateway handles the refund panel shows. */
export interface StaffPayment extends Payment {
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
}

/**
 * `GET /orders/:id` (`MANAGE_POS`). `items` and `payment` stop being optional
 * because the detail endpoint always includes them — `payment` is still
 * nullable, because an unpaid order genuinely has no row.
 */
export interface StaffOrderDetail extends Omit<Order, 'items' | 'payment'> {
  coupon_id: string | null;
  items: StaffOrderItem[];
  payment: StaffPayment | null;
}
