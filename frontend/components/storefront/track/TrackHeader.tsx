import { CheckCircle2, RadioTower, Receipt, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format/date';
import { STATUS_BADGE } from '@/lib/status-styles';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types/kds';
import { cn } from '@/lib/utils';

import { isOrderCancelled, type TrackOrder } from './track-model';

/**
 * The masthead: which order this is, where it stands, how the page is staying
 * up to date, and the receipt.
 *
 * **The live/polling indicator is deliberately visible.** `private-customer-{id}`
 * is authorised by `POST /customer-auth/pusher-auth`, a route that can be
 * unreachable (no Pusher credentials in the build, an expired customer cookie,
 * a `403`). When it is, the page falls back to a 30 s poll — and a customer
 * watching a parcel deserves to know whether "nothing has changed" means live
 * silence or a refresh that has not come round yet.
 *
 * The receipt is a plain `<a>` rather than `window.open`: `GET /customer/orders/:id/receipt`
 * is a cookie-authenticated top-level navigation, and an anchor is what a
 * keyboard, a screen reader and "open in new tab" all already understand.
 */

function orderTone(status: OrderStatus): string {
  if (status === 'delivered' || status === 'completed') return STATUS_BADGE.good;
  if (status === 'cancelled' || status === 'refunded') return STATUS_BADGE.critical;
  if (status === 'placed') return STATUS_BADGE.neutral;
  return STATUS_BADGE.info;
}

export interface TrackHeaderProps {
  order: TrackOrder;
  /** True once the Pusher subscription is live; false while the page polls. */
  live: boolean;
  /** The receipt endpoint, already absolute — it is served by the API, not Next. */
  receiptUrl: string;
  /** Set by the checkout hand-off (`?placed=1`) to acknowledge the payment once. */
  justPlaced?: boolean;
  className?: string;
}

export function TrackHeader({
  order,
  live,
  receiptUrl,
  justPlaced = false,
  className,
}: TrackHeaderProps) {
  const cancelled = isOrderCancelled(order.status);

  return (
    <header data-slot="track-header" className={cn('space-y-4', className)}>
      {justPlaced && !cancelled ? (
        <p className="flex items-start gap-2 rounded-xl border border-line bg-brand-soft px-4 py-3 text-sm text-ink-strong">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden="true" />
          <span>
            Payment received — your order is confirmed. This page updates itself as it moves.
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">
            Order #{order.order_number}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Placed {formatDateTime(order.created_at)}
            {order.delivery_address ? ` · ${order.delivery_address}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn('h-6 px-2.5', orderTone(order.status))}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
          <span
            className="inline-flex items-center gap-1.5 text-xs text-ink-faint"
            title={
              live
                ? 'Connected — updates arrive the moment they happen.'
                : 'Not connected — this page refreshes every 30 seconds.'
            }
          >
            {live ? (
              <RadioTower className="size-3.5 text-leaf" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            )}
            {live ? 'Live' : 'Refreshing every 30s'}
          </span>
          <a
            href={receiptUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            <Receipt className="size-4" aria-hidden="true" />
            Receipt
          </a>
        </div>
      </div>

      {cancelled ? (
        <p className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle">
          {order.status === 'refunded'
            ? 'This order was refunded. The money is on its way back to the card or account you paid with.'
            : 'This order was cancelled. Nothing further will be prepared or shipped.'}
        </p>
      ) : null}
    </header>
  );
}
