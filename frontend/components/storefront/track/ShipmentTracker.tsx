import { ExternalLink, PackageCheck, Truck } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { formatEtd } from '@/lib/format/date';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { CustomerShipment } from '@/lib/types/checkout';
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from '@/lib/types/shipments';
import { cn } from '@/lib/utils';

import { ShipmentEventList } from './ShipmentEventList';
import { TimelineRail } from './TimelineRail';
import { buildShipmentSteps, isShipmentStopped, type TrackOrderItem } from './track-model';

/**
 * The parcel half of a mixed order (`SHIP-05`).
 *
 * Three things this component refuses to do, each of them a bug P5a actually
 * recorded:
 *
 * 1. **It does not invent a `null` shipment.** `GET /customer/orders/:id/shipment`
 *    answers `null` — not `404` — for an order with no shipped lines, and also
 *    for a shipped order nobody has packed yet. The caller distinguishes the
 *    two; this component is only rendered when a `Shipment` row exists.
 * 2. **It does not assume the courier reported every stage.** The rail comes
 *    from `buildShipmentSteps`, which reads the `ShipmentEvent` ledger; a stage
 *    the parcel passed with no scan behind it says so.
 * 3. **It does not fabricate a tracking link.** `tracking_url` is `null` until
 *    a provider supplies one, and a manual shipment may never get one, so the
 *    AWB is rendered as plain copyable text when there is nothing to link to.
 */

function statusTone(status: ShipmentStatus): string {
  if (status === 'delivered') return STATUS_BADGE.good;
  if (isShipmentStopped(status)) return STATUS_BADGE.critical;
  if (status === 'out_for_delivery' || status === 'in_transit') return STATUS_BADGE.info;
  return STATUS_BADGE.neutral;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="truncate text-sm font-medium text-ink-strong">{children}</dd>
    </div>
  );
}

export interface ShipmentTrackerProps {
  shipment: CustomerShipment;
  items: readonly TrackOrderItem[];
  className?: string;
}

export function ShipmentTracker({ shipment, items, className }: ShipmentTrackerProps) {
  const steps = buildShipmentSteps(shipment);
  const eta = formatEtd(shipment.etd);
  const stopped = isShipmentStopped(shipment.status);

  return (
    <section
      data-slot="shipment-tracker"
      className={cn('rounded-2xl border border-line bg-surface', className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-warm p-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-strong">
            <Truck className="size-4 text-ink-muted" aria-hidden="true" />
            Shipped to you
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {items.length} {items.length === 1 ? 'item' : 'items'} in this parcel
            {eta && !stopped ? ` · arriving ${eta}` : ''}
          </p>
        </div>
        <Badge className={cn('h-6 px-2.5', statusTone(shipment.status))}>
          {SHIPMENT_STATUS_LABELS[shipment.status]}
        </Badge>
      </header>

      <dl className="grid gap-4 border-b border-line-warm p-5 sm:grid-cols-3">
        <Fact label="Courier">{shipment.courier_name ?? 'Being assigned'}</Fact>
        <Fact label="Tracking number (AWB)">
          {shipment.awb ? (
            <span className="font-mono text-[0.8rem] tracking-tight">{shipment.awb}</span>
          ) : (
            <span className="font-normal text-ink-muted">Not issued yet</span>
          )}
        </Fact>
        <Fact label="Estimated arrival">
          {eta ? <span className="capitalize">{eta}</span> : <span className="font-normal text-ink-muted">To be confirmed</span>}
        </Fact>
      </dl>

      {shipment.tracking_url ? (
        <div className="border-b border-line-warm px-5 py-3">
          <a
            href={shipment.tracking_url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            Track on the courier&rsquo;s site
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      ) : null}

      <div className="grid gap-8 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-strong">
            <PackageCheck className="size-4 text-ink-muted" aria-hidden="true" />
            Progress
          </h3>
          <TimelineRail steps={steps} />
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-ink-strong">Courier scans</h3>
          <ShipmentEventList events={shipment.events} />
        </div>
      </div>

      <ul className="border-t border-line-warm px-5 py-4 text-sm text-ink-subtle">
        {items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-4 py-0.5">
            <span className="min-w-0 truncate">{item.product.name}</span>
            <span className="shrink-0 text-ink-muted tabular-nums">&times;{item.quantity}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
