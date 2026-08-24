'use client';

import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { ORDER_STATUS_LABELS } from '@/lib/types/kds';
import { SHIPMENT_STATUS_LABELS } from '@/lib/types/shipments';
import type { ShipmentDetail } from '@/lib/types/shipments';
import type { Refund } from '@/lib/types/refunds';
import { REFUND_STATUS_LABELS } from '@/lib/types/refunds';
import {
  findShipmentForOrder,
  shipmentLookupKey,
} from './OrderShipmentPanel';
import type { StaffOrderDetail } from './types';

/**
 * Which token paints the dot. `serious` is the only one that carries alarm; the
 * rest read as history, not as status.
 */
type Tone = 'neutral' | 'good' | 'info' | 'serious';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-[var(--ink-faint)]',
  good: 'bg-[var(--status-good)]',
  info: 'bg-[var(--status-info)]',
  serious: 'bg-[var(--status-serious)]',
};

interface Entry {
  key: string;
  at: string;
  title: string;
  detail?: string;
  tone: Tone;
}

interface OrderTimelinePanelProps {
  order: StaffOrderDetail;
  refunds: Refund[];
  /** Only walk the shipments queue for an order that actually has parcels. */
  hasShipment: boolean;
}

/**
 * The order's history, assembled from rows that certainly exist:
 * `Order.created_at` and its current `status`, the `Payment` row, the
 * `ShipmentEvent` ledger and every `Refund` attempt.
 *
 * **Not built from `AuditEvent`.** The audit trail has a known hole — the
 * `Order.status → shipped` write from `shipments.service.ts` records nothing —
 * and a timeline that quietly skipped a leg would be worse than one assembled
 * from the domain rows themselves.
 */
export function OrderTimelinePanel({
  order,
  refunds,
  hasShipment,
}: OrderTimelinePanelProps) {
  const { data: lookup } = useQuery({
    queryKey: shipmentLookupKey(order.id),
    queryFn: () => findShipmentForOrder(order.id),
    enabled: hasShipment,
  });

  const shipmentId =
    lookup?.kind === 'found' ? lookup.shipment.id : null;

  const { data: shipment, isLoading: shipmentLoading } = useQuery({
    queryKey: ['shipments', shipmentId],
    queryFn: () => apiClient.get<ShipmentDetail>(`/shipments/${shipmentId}`),
    enabled: shipmentId !== null,
  });

  const entries: Entry[] = [];

  entries.push({
    key: 'placed',
    at: order.created_at,
    title: `Order placed — ${ORDER_STATUS_LABELS.placed}`,
    detail: `${formatCurrency(order.total)} · ${order.placed_via}`,
    tone: 'neutral',
  });

  if (order.payment) {
    entries.push({
      key: `payment-${order.payment.id}`,
      at: order.payment.created_at,
      title: `Payment ${order.payment.status}`,
      detail: `${formatCurrency(order.payment.amount)} · ${order.payment.method}`,
      tone: order.payment.status === 'paid' ? 'good' : 'neutral',
    });
  }

  for (const event of shipment?.events ?? []) {
    entries.push({
      key: `shipment-${event.id}`,
      at: event.occurred_at,
      title: `Parcel ${SHIPMENT_STATUS_LABELS[event.status] ?? event.status}`,
      tone: event.status === 'delivered' ? 'good' : 'info',
    });
  }

  for (const refund of refunds) {
    entries.push({
      key: `refund-${refund.id}`,
      at: refund.created_at,
      title: `Refund ${REFUND_STATUS_LABELS[refund.status] ?? refund.status}`,
      detail: `${formatCurrency(refund.amount)} · ${refund.reason}`,
      tone: refund.status === 'failed' ? 'serious' : 'info',
    });
  }

  // `Order.updated_at` is the only timestamp the current status carries, so the
  // head of the timeline is the status itself rather than a fabricated moment
  // for every leg the order has been through.
  entries.push({
    key: 'current',
    at: order.updated_at,
    title: `Now ${ORDER_STATUS_LABELS[order.status] ?? order.status}`,
    tone:
      order.status === 'cancelled' || order.status === 'refunded'
        ? 'serious'
        : 'good',
  });

  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <section className="space-y-3 rounded-xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <History className="size-4 text-ink-muted" />
        <h2 className="text-sm font-semibold text-ink">Timeline</h2>
      </div>

      {hasShipment && shipmentLoading ? (
        <Skeleton className="h-4 w-1/2" />
      ) : null}

      <ol className="space-y-3">
        {entries.map((entry) => (
          <li key={entry.key} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE_CLASSES[entry.tone]}`}
            />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm text-ink">{entry.title}</p>
              {entry.detail ? (
                <p className="text-xs text-muted-foreground">{entry.detail}</p>
              ) : null}
              <p className="text-xs text-ink-faint">
                {formatDateTime(entry.at)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
