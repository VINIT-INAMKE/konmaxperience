'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, PackageSearch, Truck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { STATUS_BADGE } from '@/lib/status-styles';
import { formatDate } from '@/lib/format/date';
import { SHIPMENT_STATUS_LABELS } from '@/lib/types/shipments';
import type {
  ShipmentListRow,
  ShipmentStatus,
  ShipmentsEnvelope,
} from '@/lib/types/shipments';

const SHIPMENT_STATUS_STYLES: Record<ShipmentStatus, string> = {
  pending: STATUS_BADGE.warning,
  awb_assigned: STATUS_BADGE.info,
  pickup_scheduled: STATUS_BADGE.info,
  picked_up: STATUS_BADGE.info,
  in_transit: STATUS_BADGE.info,
  out_for_delivery: STATUS_BADGE.info,
  delivered: STATUS_BADGE.good,
  rto: STATUS_BADGE.serious,
  cancelled: STATUS_BADGE.serious,
  failed: STATUS_BADGE.critical,
};

/** One page of `GET /shipments`; the list is capped server-side anyway. */
const PAGE_SIZE = 100;
/** How far back the lookup will walk before giving up — 500 parcels. */
const MAX_PAGES = 5;

export type ShipmentLookup =
  | { kind: 'found'; shipment: ShipmentListRow }
  | { kind: 'absent' }
  | { kind: 'beyond-reach' };

/**
 * One key for the whole route, so the timeline and this panel share a single
 * walk of the queue instead of each paging it independently.
 */
export function shipmentLookupKey(orderId: string) {
  return ['orders', orderId, 'shipment-lookup'] as const;
}

/**
 * `GET /orders/:id` does **not** include the shipment, and `/shipments` has no
 * `order_id` filter — the only by-order lookup, `ShipmentsService.findForOrder`,
 * is mounted behind the customer guard at `GET /customer/orders/:id/shipment`
 * and is unreachable for staff.
 *
 * So the parcel is found by walking the staff queue, which is ordered
 * newest-first: a recently packed order lands on the first page. The walk stops
 * at {@link MAX_PAGES} and reports `beyond-reach` rather than claiming "not
 * packed" for an old order it simply did not reach — a lie about a parcel is
 * worse than an admission that this screen could not find it.
 */
export async function findShipmentForOrder(
  orderId: string,
): Promise<ShipmentLookup> {
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) query.set('cursor', cursor);
    const envelope: ShipmentsEnvelope = await apiClient.get<ShipmentsEnvelope>(
      `/shipments?${query.toString()}`,
    );
    const match = envelope.items.find((row) => row.order_id === orderId);
    if (match) return { kind: 'found', shipment: match };
    if (!envelope.next_cursor) return { kind: 'absent' };
    cursor = envelope.next_cursor;
  }
  return { kind: 'beyond-reach' };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm text-ink">
        {value}
      </span>
    </div>
  );
}

/**
 * The parcel summary for an order with `shipped` lines, with a link into the
 * Shipments screen where the pack / AWB / pickup / label actions live.
 */
export function OrderShipmentPanel({ orderId }: { orderId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: shipmentLookupKey(orderId),
    queryFn: () => findShipmentForOrder(orderId),
  });

  return (
    <section className="space-y-3 rounded-xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <Truck className="size-4 text-ink-muted" />
        <h2 className="text-sm font-semibold text-ink">Shipment</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : null}

      {isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Could not read the shipments queue</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            This order has shipped lines, but the parcel could not be looked up.
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {data?.kind === 'found' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Badge className={SHIPMENT_STATUS_STYLES[data.shipment.status]}>
              {SHIPMENT_STATUS_LABELS[data.shipment.status]}
            </Badge>
            <Button
              nativeButton={false}
              render={<Link href={`/shipments/${data.shipment.id}`} />}
              variant="outline"
              size="sm"
            >
              Open shipment
            </Button>
          </div>
          <Row label="Provider" value={data.shipment.provider} />
          <Row
            label="AWB"
            value={
              <span className="font-mono text-xs">
                {data.shipment.awb ?? 'not assigned'}
              </span>
            }
          />
          <Row label="Courier" value={data.shipment.courier_name ?? '—'} />
          <Row
            label="Weight"
            value={
              data.shipment.weight_grams > 0
                ? `${data.shipment.weight_grams} g`
                : '—'
            }
          />
          <Row
            label="ETD"
            value={data.shipment.etd ? formatDate(data.shipment.etd) : '—'}
          />
          {data.shipment.tracking_url ? (
            <Row
              label="Tracking"
              value={
                <a
                  className="underline underline-offset-2 hover:text-brand"
                  href={data.shipment.tracking_url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Courier page
                </a>
              }
            />
          ) : null}
        </div>
      ) : null}

      {data?.kind === 'absent' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This order has shipped lines but no parcel yet. Pack it from the
            Shipments queue — packing is what creates the shipment row.
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/shipments?tab=to-pack" />}
            variant="outline"
            size="sm"
          >
            <PackageSearch className="size-4" />
            Go to “To pack”
          </Button>
        </div>
      ) : null}

      {data?.kind === 'beyond-reach' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The parcel for this order is older than the {MAX_PAGES * PAGE_SIZE}{' '}
            most recent shipments, so it could not be resolved from here. Find it
            by AWB or order number in the Shipments screen.
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/shipments" />}
            variant="outline"
            size="sm"
          >
            Open Shipments
          </Button>
        </div>
      ) : null}
    </section>
  );
}
