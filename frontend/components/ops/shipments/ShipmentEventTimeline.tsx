'use client';

import { PackageSearch } from 'lucide-react';
import { formatDateTime } from '@/lib/format/date';
import {
  SHIPMENT_LINEAR_FLOW,
  SHIPMENT_STATUS_LABELS,
  type ShipmentEvent,
  type ShipmentStatus,
} from '@/lib/types/shipments';
import { shipmentStatusClass } from './ShipmentStatusBadge';

/**
 * The tracking ledger, newest first — exactly as `GET /shipments/:id` returns
 * it.
 *
 * **A gap is not an error.** `ShipmentsService` accepts any *forward* move
 * along the linear flow precisely because couriers skip scans: a parcel is
 * routinely reported `in_transit` while we still believe it is
 * `pickup_scheduled`, and rejecting that would 400 the webhook and lose the
 * update entirely. So the flow strip below marks a step that was never scanned
 * as **"not scanned"** in muted ink, never as missing, late or broken — the
 * ledger is the truth and it is complete by construction.
 */
interface ShipmentEventTimelineProps {
  events: ShipmentEvent[];
  currentStatus: ShipmentStatus;
}

export function ShipmentEventTimeline({
  events,
  currentStatus,
}: ShipmentEventTimelineProps) {
  const scanned = new Set(events.map((event) => event.status));
  // A terminal detour (`rto`, `cancelled`, `failed`) has no place on the happy
  // path, so the strip stops being meaningful and is hidden rather than lying.
  const onLinearPath = SHIPMENT_LINEAR_FLOW.includes(currentStatus);
  const reachedIndex = SHIPMENT_LINEAR_FLOW.indexOf(currentStatus);

  return (
    <div className="space-y-6">
      {onLinearPath && (
        <ol className="flex flex-wrap gap-x-2 gap-y-2" aria-label="Delivery progress">
          {SHIPMENT_LINEAR_FLOW.map((status, index) => {
            const reached = index <= reachedIndex;
            const hasScan = scanned.has(status);
            return (
              <li
                key={status}
                className={`rounded-md border px-2 py-1 text-xs ${
                  reached
                    ? shipmentStatusClass(status)
                    : 'border-line text-ink-faint'
                }`}
              >
                <span className="font-medium">
                  {SHIPMENT_STATUS_LABELS[status]}
                </span>
                {reached && !hasScan && (
                  <span className="ml-1.5 opacity-70">· not scanned</span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line py-10">
          <PackageSearch className="size-8 text-ink-faint" />
          <p className="text-sm text-ink-muted">No scans recorded yet.</p>
        </div>
      ) : (
        <ol className="space-y-0">
          {events.map((event, index) => (
            <li key={event.id} className="flex gap-3">
              {/* Rail: a dot per scan, joined by a line except after the last. */}
              <div
                className="flex flex-col items-center"
                aria-hidden
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    index === 0 ? 'bg-brand' : 'bg-ink-faint'
                  }`}
                />
                {index < events.length - 1 && (
                  <span className="w-px flex-1 bg-line" />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-5">
                <p className="text-sm font-medium text-ink">
                  {SHIPMENT_STATUS_LABELS[event.status]}
                </p>
                <p className="text-xs text-ink-muted">
                  {formatDateTime(event.occurred_at)}
                  {event.occurred_at !== event.created_at && (
                    <span className="text-ink-faint">
                      {' '}
                      · recorded {formatDateTime(event.created_at)}
                    </span>
                  )}
                </p>
                <EventNote raw={event.raw} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * `ShipmentEvent.raw` is the courier's untyped payload — or, for a staff
 * action, the small object the service stamped (`{ source, reason }`). Only the
 * two keys that are ours are rendered; a courier blob is not paraded at staff
 * as pseudo-English.
 */
function EventNote({ raw }: { raw: unknown }) {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as { source?: unknown; reason?: unknown };
  const source = typeof record.source === 'string' ? record.source : null;
  const reason = typeof record.reason === 'string' ? record.reason : null;
  if (!source && !reason) return null;

  return (
    <p className="mt-1 text-xs text-ink-subtle">
      {reason ?? (source === 'shiprocket.webhook' ? 'Courier scan' : 'Staff action')}
    </p>
  );
}
