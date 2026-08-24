import { CreditCard } from 'lucide-react';

import { MoneyLine } from '@/components/storefront/common/MoneyLine';
import { Badge } from '@/components/ui/badge';
import { assertDiscountSplit, assertInclusiveTotal } from '@/lib/format/currency';
import { STATUS_BADGE } from '@/lib/status-styles';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/lib/types/orders';
import type { PaymentStatus } from '@/lib/types/kds';
import { cn } from '@/lib/utils';

import { splitDiscount, type TrackOrder } from './track-model';

/**
 * What was actually charged, in the shape P5a's arithmetic demands.
 *
 * - **`subtotal` is the tax-inclusive gross and `tax_amount` is carved out of
 *   it** (P5a decision 1), so GST is an `of which` line and never a `+` row.
 *   `MoneyLine`'s `of-which` variant is the only way to render it.
 * - **`discount_amount` bundles the coupon and the loyalty burn** (decision 23).
 *   `splitDiscount` reconstructs the two, and `assertDiscountSplit` makes a
 *   mismatch loud in development. Without `redeem_value_per_point` the split
 *   is not attempted and one combined line shows instead.
 * - `assertInclusiveTotal` re-checks
 *   `total = subtotal − discount − loyalty + shipping` on every render in
 *   development, so a backend regression stops a developer, never a customer.
 *
 * `loyalty_points_redeemed` is already inside `discount_amount`, so the loyalty
 * line is a *split* of that column and **not** an extra subtraction — passing
 * `loyalty` to the invariant as well would double-count it, which is why the
 * assertion below is given `loyalty: null`.
 */

function paymentTone(status: PaymentStatus): string {
  if (status === 'paid') return STATUS_BADGE.good;
  if (status === 'failed') return STATUS_BADGE.critical;
  if (status === 'refunded' || status === 'partially_refunded') return STATUS_BADGE.warning;
  return STATUS_BADGE.neutral;
}

export interface OrderMoneySummaryProps {
  order: TrackOrder;
  /** From `GET /customer/loyalty`; `null` until it lands. Drives the split. */
  redeemValuePerPoint: number | null;
  className?: string;
}

export function OrderMoneySummary({
  order,
  redeemValuePerPoint,
  className,
}: OrderMoneySummaryProps) {
  const discount = splitDiscount(order, redeemValuePerPoint);

  // A marketplace order always carries `channel_modifier_amount: 0`
  // (`fulfilment.service.ts:532`), so the invariant holds exactly. The guard is
  // there because the same type also describes a POS order, where a channel
  // modifier is a real term the formula above does not model — and a dev-mode
  // throw on a legitimate order would be worse than not checking.
  if (order.channel_modifier_amount === 0) {
    assertInclusiveTotal(
      {
        subtotal: order.subtotal,
        discount_amount: order.discount_amount,
        shipping_amount: order.shipping_amount,
        total: order.total,
        loyalty: null,
      },
      `order ${order.order_number}`,
    );
  }
  if (discount.split) {
    assertDiscountSplit(
      order.discount_amount,
      discount.coupon,
      discount.loyalty,
      `order ${order.order_number}`,
    );
  }

  return (
    <section
      data-slot="order-money-summary"
      className={cn('rounded-2xl border border-line bg-surface', className)}
    >
      <header className="border-b border-line-warm p-5">
        <h2 className="text-base font-semibold text-ink-strong">What you paid</h2>
      </header>

      <div className="space-y-3 p-5">
        <MoneyLine label="Subtotal (incl. GST)" value={order.subtotal} />
        <MoneyLine label="GST" value={order.tax_amount} variant="of-which" />

        {order.channel_modifier_amount !== 0 ? (
          <MoneyLine label="Channel adjustment" value={order.channel_modifier_amount} />
        ) : null}

        {discount.split ? (
          <>
            {discount.coupon !== 0 ? (
              <MoneyLine label="Coupon" value={discount.coupon} sign="minus" />
            ) : null}
            <MoneyLine
              label="Loyalty points"
              value={discount.loyalty}
              sign="minus"
              note={`${order.loyalty_points_redeemed} points redeemed`}
            />
          </>
        ) : order.discount_amount !== 0 ? (
          <MoneyLine label="Discount" value={order.discount_amount} sign="minus" />
        ) : null}

        <MoneyLine
          label="Shipping"
          value={order.shipping_amount}
          valueOverride={order.shipping_amount === 0 ? 'Free' : undefined}
        />

        <MoneyLine label="Total" value={order.total} variant="total" />

        {order.loyalty_points_earned > 0 ? (
          <p className="pt-1 text-xs text-ink-faint">
            {order.loyalty_points_earned} points are credited once this order is delivered.
          </p>
        ) : null}
      </div>

      {order.payment ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-warm px-5 py-4">
          <span className="inline-flex items-center gap-2 text-sm text-ink-subtle">
            <CreditCard className="size-4 text-ink-muted" aria-hidden="true" />
            Paid by {PAYMENT_METHOD_LABELS[order.payment.method]}
          </span>
          <span className="flex items-center gap-2">
            <Badge className={cn('h-6 px-2.5', paymentTone(order.payment.status))}>
              {PAYMENT_STATUS_LABELS[order.payment.status]}
            </Badge>
            {order.payment.razorpay_payment_id ? (
              <span className="font-mono text-xs text-ink-faint">
                {order.payment.razorpay_payment_id}
              </span>
            ) : null}
          </span>
        </footer>
      ) : (
        <footer className="border-t border-line-warm px-5 py-4 text-sm text-ink-muted">
          No payment is recorded against this order yet.
        </footer>
      )}
    </section>
  );
}
