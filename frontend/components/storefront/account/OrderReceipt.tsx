'use client';

import Link from 'next/link';
import { MapPin, Receipt } from 'lucide-react';

import { ReorderButton } from '@/components/storefront/account/ReorderButton';
import {
  isTrackable,
  orderStatusBadge,
} from '@/components/storefront/account/order-status';
import { MoneyLine } from '@/components/storefront/common/MoneyLine';
import { Button } from '@/components/ui/button';
import { assertDiscountSplit, formatCurrency, loyaltyValue } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import {
  ORDER_CHANNEL_LABELS,
  ORDER_ITEM_STATUS_LABELS,
  ORDER_STATUS_LABELS,
} from '@/lib/types/kds';
import type { CustomerOrder } from '@/lib/types/marketplace';
import { cn } from '@/lib/utils';

/**
 * The full receipt for one order.
 *
 * ## The discount split (P5a decision 23)
 *
 * `Order.discount_amount` is **one column carrying two things**: the coupon and
 * the loyalty burn. A receipt that printed it as a single "Discount" line would
 * be accurate and useless — the customer wants to know what their points bought.
 * The split is reconstructed the only way the payload allows:
 *
 * ```
 * loyalty = loyalty_points_redeemed × redeem_value_per_point
 * coupon  = discount_amount − loyalty
 * ```
 *
 * `redeem_value_per_point` is the customer's **current** rate from
 * `GET /customer/loyalty`, not the rate frozen on the order — the API does not
 * expose the latter. If the rate has been changed since the order was placed the
 * reconstruction is wrong, so the loyalty line is only drawn when the rate is
 * known *and* the arithmetic lands inside the column; otherwise the receipt
 * falls back to the single honest "Discount" line rather than printing a
 * confident lie.
 *
 * `assertDiscountSplit` throws in development if the two halves do not add back
 * up — the guard exists so a future change to how discounts are stored fails
 * loudly here instead of quietly mis-stating what someone paid.
 *
 * ## Totals
 *
 * `tax_amount` is **carved out of** `subtotal`, never added to it, so it renders
 * as an `of-which` line. `total = subtotal − discount_amount + shipping_amount`.
 */
export interface OrderReceiptProps {
  order: CustomerOrder;
  /** From `GET /customer/loyalty`. `null` while it loads or if the read failed. */
  redeemValuePerPoint: number | null;
}

export function OrderReceipt({ order, redeemValuePerPoint }: OrderReceiptProps) {
  const loyaltyAmount =
    redeemValuePerPoint !== null && order.loyalty_points_redeemed > 0
      ? loyaltyValue(order.loyalty_points_redeemed, redeemValuePerPoint)
      : 0;

  const couponAmount = Number((order.discount_amount - loyaltyAmount).toFixed(2));

  // Only split when the arithmetic is sound. A negative coupon share means the
  // current redemption rate does not describe this order.
  const splittable = order.discount_amount > 0 && loyaltyAmount > 0 && couponAmount >= 0;
  if (splittable) {
    assertDiscountSplit(
      order.discount_amount,
      couponAmount,
      loyaltyAmount,
      `order #${order.order_number}`,
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-ink-strong">
                Order #{order.order_number}
              </h2>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                  orderStatusBadge(order.status),
                )}
              >
                {ORDER_STATUS_LABELS[order.status]}
              </span>
              <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                {ORDER_CHANNEL_LABELS[order.channel]}
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Placed {formatDateTime(order.created_at)}
            </p>
            {order.delivery_address ? (
              <p className="flex items-start gap-1.5 text-xs text-ink-muted">
                <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                {order.delivery_address}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isTrackable(order.status) ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/orders/${order.id}/track`} />}
              >
                Track order
              </Button>
            ) : null}
            <ReorderButton order={order} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <h3 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink-strong">
          Items
        </h3>
        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-4 px-5 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm text-ink-strong">{item.product.name}</p>
                <p className="text-xs text-ink-muted">
                  {item.quantity} × {formatCurrency(item.unit_price)} ·{' '}
                  {ORDER_ITEM_STATUS_LABELS[item.status]}
                </p>
              </div>
              <p className="shrink-0 text-sm tabular-nums text-ink-strong">
                {formatCurrency(item.unit_price * item.quantity)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-xl border border-line bg-surface p-5">
        <h3 className="flex items-center gap-2 pb-1 text-sm font-semibold text-ink-strong">
          <Receipt className="size-4" aria-hidden="true" />
          What you paid
        </h3>

        <MoneyLine label="Subtotal (incl. GST)" value={order.subtotal} />
        <MoneyLine label="of which GST" value={order.tax_amount} variant="of-which" />

        {order.channel_modifier_amount !== 0 ? (
          <MoneyLine
            label="Channel adjustment"
            value={order.channel_modifier_amount}
            note={`Applied to ${ORDER_CHANNEL_LABELS[order.channel]} orders`}
          />
        ) : null}

        {order.discount_amount > 0 ? (
          splittable ? (
            <>
              <MoneyLine label="Coupon" value={couponAmount} sign="minus" />
              <MoneyLine
                label="Loyalty points"
                value={loyaltyAmount}
                sign="minus"
                note={`${order.loyalty_points_redeemed.toLocaleString('en-IN')} points redeemed`}
              />
            </>
          ) : (
            <MoneyLine
              label="Discount"
              value={order.discount_amount}
              sign="minus"
              note={
                order.loyalty_points_redeemed > 0
                  ? `Includes ${order.loyalty_points_redeemed.toLocaleString('en-IN')} loyalty points`
                  : undefined
              }
            />
          )
        ) : null}

        {order.shipping_amount > 0 ? (
          <MoneyLine label="Shipping" value={order.shipping_amount} />
        ) : (
          <MoneyLine label="Shipping" value={0} valueOverride="Free" />
        )}

        <MoneyLine label="Total" value={order.total} variant="total" />

        {order.loyalty_points_earned > 0 ? (
          <p className="pt-2 text-xs text-gold-text">
            Earned {order.loyalty_points_earned.toLocaleString('en-IN')} points on this
            order.
          </p>
        ) : null}

        {order.payment ? (
          <p className="pt-1 text-xs text-ink-faint">
            Paid by {order.payment.method} · {order.payment.status}
          </p>
        ) : null}
      </section>
    </div>
  );
}
