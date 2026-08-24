'use client';

/**
 * `private-shipments` — the one channel `use-realtime-channel.ts` has always
 * known about and that nothing consumed until the Shipments screen landed.
 *
 * `ShipmentsService.applyStatus` is the single writer of `Shipment.status`, and
 * every path through it — the staff AWB/pickup/cancel buttons *and* the
 * Shiprocket webhook — broadcasts `shipment.updated` on this channel. So one
 * subscription keeps both tabs honest: a courier scan moves a row without a
 * reload, and a colleague packing an order on another till drops it out of the
 * "To pack" queue here.
 *
 * The payload is deliberately not rendered from (it is partial by design); it is
 * only a signal to refetch, which is exactly what {@link useRealtimeChannel}
 * does with it.
 *
 * **Query-key layout.** Everything the broadcast can invalidate hangs off the
 * `['shipments']` prefix; the per-order hydration the "To pack" queue needs does
 * **not**, and lives under `['ops-orders']` instead. That split is load-bearing:
 * a prefix invalidation refetches two small queries rather than the dozens of
 * order-detail requests the queue keeps warm.
 */

import type { QueryKey } from '@tanstack/react-query';
import {
  SHIPMENTS_CHANNEL,
  SHIPMENT_UPDATED_EVENT,
  type ShipmentStatus,
} from '@/lib/types/shipments';
import {
  POLL_FLOOR_MS,
  useRealtimeChannel,
  type RealtimeChannelState,
} from '@/lib/hooks/use-realtime-channel';

export { POLL_FLOOR_MS };

/** The invalidation root. Every shipment-derived query starts here. */
export const SHIPMENTS_KEY = ['shipments'] as const;

/** `GET /shipments?status=` — one cached infinite query per filter value. */
export function shipmentListKey(status: ShipmentStatus | 'all'): QueryKey {
  return ['shipments', 'list', status];
}

/** `GET /shipments/:id`. */
export function shipmentDetailKey(id: string): QueryKey {
  return ['shipments', 'detail', id];
}

/**
 * The set of `order_id`s that already carry a `Shipment` row — the half of the
 * "To pack" predicate that says an order is *done* being packed.
 */
export const SHIPMENT_ORDER_IDS_KEY: QueryKey = ['shipments', 'packed-order-ids'];

/** The open staff orders the queue draws its candidates from. */
export const OPEN_ORDERS_KEY: QueryKey = ['shipments', 'open-orders'];

/**
 * `GET /orders/:id` for one queue candidate. Outside the `['shipments']` prefix
 * on purpose — see the module note.
 */
export function opsOrderDetailKey(id: string): QueryKey {
  return ['ops-orders', 'detail', id];
}

/**
 * Module-level constants: `useRealtimeChannel` takes both arrays as effect
 * dependencies, so a fresh literal per render would resubscribe every render.
 */
const SHIPMENT_EVENTS = [SHIPMENT_UPDATED_EVENT] as const;
const SHIPMENT_INVALIDATE = [SHIPMENTS_KEY] as const;

/**
 * Subscribes the Shipments screens to `shipment.updated`.
 *
 * `live` is `true` only once Pusher has confirmed the subscription. Call sites
 * write `refetchInterval: live ? false : POLL_FLOOR_MS` so a socket that is
 * missing, refused or dropped silently degrades to the SPEC §6.4 30 s poll
 * instead of leaving a stale queue on a packing bench (`IA-07`).
 */
export function useShipmentsRealtime(): RealtimeChannelState {
  return useRealtimeChannel(
    SHIPMENTS_CHANNEL,
    SHIPMENT_EVENTS,
    SHIPMENT_INVALIDATE,
  );
}
