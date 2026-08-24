import { formatDateTime } from '@/lib/format/date';
import { SHIPMENT_STATUS_LABELS, type ShipmentEventSummary } from '@/lib/types/shipments';
import { cn } from '@/lib/utils';

/**
 * The courier's ledger, newest first — exactly the order
 * `GET /customer/orders/:id/shipment` returns it in
 * (`events: { orderBy: { occurred_at: 'desc' } }`), so nothing is re-sorted here
 * and the list cannot disagree with the rail beside it.
 *
 * This is the raw record, not a derived story: every `ShipmentEvent` row shows,
 * including a repeat of a status the parcel already reported. That is the point
 * — the rail above summarises, this list is the audit trail a customer quotes
 * back to support.
 *
 * Timestamps are absolute and pinned to IST by `formatDateTime`. A relative
 * "2 hours ago" would need `Date.now()` at render time, which is neither pure
 * nor stable across a re-render, and a courier scan is a fact worth stating
 * exactly.
 */
export interface ShipmentEventListProps {
  events: readonly ShipmentEventSummary[];
  className?: string;
}

export function ShipmentEventList({ events, className }: ShipmentEventListProps) {
  if (!events.length) {
    return (
      <p className={cn('text-sm text-ink-muted', className)}>
        No courier scans yet. They appear here as the parcel moves.
      </p>
    );
  }

  return (
    <ul
      data-slot="shipment-event-list"
      className={cn('divide-y divide-line rounded-xl border border-line bg-surface', className)}
    >
      {events.map((event, index) => (
        <li
          key={`${event.status}-${event.occurred_at}-${index}`}
          className="flex items-baseline justify-between gap-4 px-4 py-3"
        >
          <span className="text-sm font-medium text-ink-strong">
            {SHIPMENT_STATUS_LABELS[event.status] ?? event.status}
          </span>
          <span className="shrink-0 text-xs text-ink-muted tabular-nums">
            {formatDateTime(event.occurred_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
