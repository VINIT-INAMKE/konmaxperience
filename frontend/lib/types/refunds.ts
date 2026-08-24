/**
 * Refunds — `CHK-05`. `POST /orders/:id/refund` and `GET /orders/:id/refunds`,
 * both `MANAGE_POS`, mounted on the orders prefix but owned by their own
 * controller.
 *
 * Three behaviours the staff screen must render honestly:
 *
 * - **Only Razorpay payments refund from here.** A cash or UPI order answers
 *   `400` with "record cash/UPI refunds manually".
 * - **A gateway failure is a `400`, and the `Refund` row stays `failed`.** The
 *   row is not rolled back, so the history table shows the attempt. (The
 *   `refund.failed` webhook reconciliation is Phase 35 — `Refund.status`
 *   already carries the value.)
 * - **A full refund sets `Order.status = 'refunded'` and claws loyalty back.**
 *   Partial refunds leave the order status alone and move `Payment.status` to
 *   `partially_refunded`.
 */

/** Prisma `RefundStatus`. */
export type RefundStatus = 'pending' | 'processed' | 'failed';

export const REFUND_STATUSES: RefundStatus[] = ['pending', 'processed', 'failed'];

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  pending: 'Pending',
  processed: 'Processed',
  failed: 'Failed',
};

/** A `Refund` row. `GET /orders/:id/refunds` returns these newest first. */
export interface Refund {
  id: string;
  node_id: string;
  order_id: string;
  payment_id: string;
  /** Rupees. */
  amount: number;
  reason: string;
  razorpay_refund_id: string | null;
  status: RefundStatus;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * `POST /orders/:id/refund`.
 *
 * Omit `amount` to refund the whole remaining balance — the server computes
 * `Payment.amount − Payment.refunded_amount` rather than trusting a figure the
 * screen may have read from a stale order.
 */
export interface CreateRefundPayload {
  amount?: number;
  reason: string;
}

/**
 * What is still refundable on a payment, in rupees. The dialog uses it as the
 * input's max; the server recomputes it and is the authority.
 */
export function refundableAmount(payment: {
  amount: number;
  refunded_amount: number;
}): number {
  return Number(Math.max(0, payment.amount - payment.refunded_amount).toFixed(2));
}
