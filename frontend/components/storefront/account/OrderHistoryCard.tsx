'use client';

import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';

import { ReorderButton } from '@/components/storefront/account/ReorderButton';
import {
  isTrackable,
  orderStatusBadge,
} from '@/components/storefront/account/order-status';
import { formatCurrency } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { ORDER_CHANNEL_LABELS, ORDER_STATUS_LABELS } from '@/lib/types/kds';
import type { CustomerOrder } from '@/lib/types/marketplace';
import { cn } from '@/lib/utils';

/**
 * One order in the history list (`ACCT-01`).
 *
 * The card answers the four questions a customer actually opens this page with
 * — what did I buy, when, how much, and where is it — and nothing else. The
 * receipt behind it carries the money breakdown; duplicating a tax line here
 * would make a scannable list unscannable.
 *
 * `channel` is shown because `ACCT-01` requires **all** channels in one list: a
 * dine-in bill, a marketplace parcel and a takeaway order sit side by side, and
 * without the channel label the list reads as three unrelated things.
 */
export interface OrderHistoryCardProps {
  order: CustomerOrder;
  /** The overview shows a tighter card than the full history page. */
  compact?: boolean;
}

export function OrderHistoryCard({ order, compact = false }: OrderHistoryCardProps) {
  const lineCount = order.items.length;
  const unitLabel = lineCount === 1 ? 'item' : 'items';

  return (
    <article className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/account/orders/${order.id}`}
              className="text-sm font-semibold text-ink-strong underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
            >
              Order #{order.order_number}
            </Link>
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
            {formatDateTime(order.created_at)} · {lineCount} {unitLabel}
          </p>

          {!compact && order.delivery_address ? (
            <p className="flex items-start gap-1.5 text-xs text-ink-faint">
              <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{order.delivery_address}</span>
            </p>
          ) : null}
        </div>

        <p className="shrink-0 text-right text-base font-semibold tabular-nums text-ink-strong">
          {formatCurrency(order.total)}
        </p>
      </div>

      {!compact ? (
        <ul className="mt-3 space-y-0.5 border-t border-line pt-3">
          {order.items.slice(0, 3).map((item) => (
            <li key={item.id} className="flex justify-between gap-4 text-xs text-ink-muted">
              <span className="line-clamp-1">
                {item.quantity} × {item.product.name}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatCurrency(item.unit_price * item.quantity)}
              </span>
            </li>
          ))}
          {order.items.length > 3 ? (
            <li className="text-xs text-ink-faint">
              and {order.items.length - 3} more
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
        <Link
          href={`/account/orders/${order.id}`}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
        >
          Receipt
          <ChevronRight className="size-3" aria-hidden="true" />
        </Link>

        {isTrackable(order.status) ? (
          <Link
            href={`/orders/${order.id}/track`}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
          >
            Track order
            <ChevronRight className="size-3" aria-hidden="true" />
          </Link>
        ) : null}

        {!compact ? <ReorderButton order={order} className="ml-auto" /> : null}
      </div>
    </article>
  );
}
