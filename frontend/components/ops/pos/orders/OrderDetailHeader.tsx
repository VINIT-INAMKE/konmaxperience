'use client';

import Link from 'next/link';
import { ArrowLeft, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { OrderStatusBadge } from '@/components/ops/pos/OrderStatusBadge';
import { STATUS_BADGE } from '@/lib/status-styles';
import { formatCurrency, assertDiscountSplit } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { ORDER_CHANNEL_LABELS } from '@/lib/types/kds';
import { ORDER_SOURCE_LABELS } from '@/lib/types/orders';
import type { StaffOrderDetail } from './types';

/**
 * `Order.discount_amount` is one column bundling the coupon and the loyalty burn
 * (P5a decision 23). A receipt that shows a single "Discount" line hides which
 * lever produced it, so the two halves are reconstructed:
 *
 * - **loyalty** = `loyalty_points_redeemed × redeem_value_per_point`, the only
 *   figure derivable from the order row itself;
 * - **coupon** = whatever is left of `discount_amount`.
 *
 * The rate comes from `settings.loyalty`, which needs `MANAGE_SYSTEM` — a
 * `MANAGE_POS` staffer cannot read it, so the caller passes the packaged default
 * when the read is refused. A wrong rate makes the coupon residual go negative,
 * and {@link assertDiscountSplit} turns that into a loud development failure
 * rather than a quietly wrong receipt.
 */
export function discountSplit(
  order: Pick<StaffOrderDetail, 'discount_amount' | 'loyalty_points_redeemed'>,
  redeemValuePerPoint: number,
): { coupon: number; loyalty: number } {
  const loyalty = Number(
    (order.loyalty_points_redeemed * redeemValuePerPoint).toFixed(2),
  );
  const coupon = Number(Math.max(0, order.discount_amount - loyalty).toFixed(2));
  assertDiscountSplit(order.discount_amount, coupon, loyalty, 'order');
  return { coupon, loyalty };
}

function MoneyRow({
  label,
  value,
  hint,
  emphasis = false,
  negative = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        className={
          emphasis
            ? 'text-sm font-semibold text-ink'
            : 'text-sm text-muted-foreground'
        }
      >
        {label}
        {hint ? (
          <span className="ml-1 text-xs text-ink-faint">{hint}</span>
        ) : null}
      </span>
      <span
        className={
          emphasis
            ? 'font-mono text-base font-bold tabular-nums text-ink'
            : 'font-mono text-sm tabular-nums text-ink'
        }
      >
        {negative ? `−${value}` : value}
      </span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-faint">{label}</dt>
      <dd className="truncate text-sm text-ink">{value}</dd>
    </div>
  );
}

interface OrderDetailHeaderProps {
  order: StaffOrderDetail;
  /** `settings.loyalty.redeem_value_per_point`, or the packaged default. */
  redeemValuePerPoint: number;
}

/**
 * The identity strip and the money block.
 *
 * **`tax_amount` is never a term in the total** (P5a decision 1): `subtotal` is
 * the tax-inclusive gross and `tax_amount` is the GST already carved out of it,
 * so it renders as an *of which* line under the total and never as a `+` row.
 */
export function OrderDetailHeader({
  order,
  redeemValuePerPoint,
}: OrderDetailHeaderProps) {
  const { coupon, loyalty } = discountSplit(order, redeemValuePerPoint);
  const customer =
    order.customer_name ?? order.customer_phone ?? 'Walk-in / no customer';

  return (
    <div className="space-y-4">
      <Link
        href="/pos/orders"
        className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
      >
        <ArrowLeft className="size-4" />
        Order history
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Identity */}
        <div className="space-y-4 rounded-xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-mono text-[28px] leading-none font-bold text-ink">
              #{order.order_number}
            </h1>
            <OrderStatusBadge status={order.status} />
            {order.payment ? (
              <OrderStatusBadge paymentStatus={order.payment.status} />
            ) : (
              <Badge className={STATUS_BADGE.warning}>Unpaid</Badge>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Fact label="Channel" value={ORDER_CHANNEL_LABELS[order.channel]} />
            <Fact
              label="Placed via"
              value={ORDER_SOURCE_LABELS[order.placed_via] ?? order.placed_via}
            />
            <Fact label="Placed at" value={formatDateTime(order.created_at)} />
            <Fact label="Customer" value={customer} />
            {order.customer_phone ? (
              <Fact label="Phone" value={order.customer_phone} />
            ) : null}
            {order.table_number ? (
              <Fact label="Table" value={order.table_number} />
            ) : null}
            {order.delivery_address ? (
              <Fact label="Address" value={order.delivery_address} />
            ) : null}
            {order.delivery_assigned_to ? (
              <Fact label="Rider" value={order.delivery_assigned_to} />
            ) : null}
          </dl>

          {order.notes ? (
            <p className="rounded-lg bg-surface-raised px-3 py-2 text-sm text-ink-subtle">
              {order.notes}
            </p>
          ) : null}

          {order.coupon_id ? (
            <div className="flex items-center gap-2">
              <Ticket className="size-4 text-ink-muted" />
              <span className="text-xs text-muted-foreground">
                Coupon applied
              </span>
              <span className="font-mono text-xs text-ink-muted">
                {order.coupon_id.slice(0, 8)}
              </span>
            </div>
          ) : null}
        </div>

        {/* Money */}
        <div className="space-y-2 rounded-xl border border-line bg-card p-4">
          <h2 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Totals
          </h2>

          <MoneyRow
            label="Subtotal"
            hint="(incl. GST)"
            value={formatCurrency(order.subtotal)}
          />
          {order.channel_modifier_amount > 0 ? (
            <MoneyRow
              label="Channel modifier"
              value={formatCurrency(order.channel_modifier_amount)}
            />
          ) : null}
          {coupon > 0 ? (
            <MoneyRow
              label="Coupon discount"
              value={formatCurrency(coupon)}
              negative
            />
          ) : null}
          {loyalty > 0 ? (
            <MoneyRow
              label="Loyalty redeemed"
              hint={`(${order.loyalty_points_redeemed} pts)`}
              value={formatCurrency(loyalty)}
              negative
            />
          ) : null}
          {order.shipping_amount > 0 ? (
            <MoneyRow
              label="Shipping"
              value={formatCurrency(order.shipping_amount)}
            />
          ) : null}

          <Separator className="my-2" />

          <MoneyRow label="Total" value={formatCurrency(order.total)} emphasis />
          <p className="text-xs text-ink-faint">
            of which GST {formatCurrency(order.tax_amount)} — already inside the
            subtotal, never added to it.
          </p>

          {order.loyalty_points_earned > 0 ||
          order.loyalty_points_redeemed > 0 ? (
            <>
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Loyalty points</span>
                <span className="font-mono tabular-nums text-ink">
                  {order.loyalty_points_earned > 0
                    ? `+${order.loyalty_points_earned}`
                    : '0'}
                  {order.loyalty_points_redeemed > 0
                    ? ` / −${order.loyalty_points_redeemed}`
                    : ''}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
