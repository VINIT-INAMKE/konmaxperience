'use client';

/**
 * Every read the Shipments screens make, in one place.
 *
 * **The "To pack" predicate is the delicate one** (P5b decision 10). It is
 * *not* `OrderItemStatus.packed`: `FulfilmentService.confirmPaidOrder` sets
 * every shipped line to `packed` at **confirm**, before anyone has touched a
 * box, so that predicate would show an empty queue and a warehouse full of
 * phantom-packed parcels. The real predicate is
 *
 *   > an order with at least one `fulfilment: 'shipped'` line and **no
 *   > `Shipment` row**
 *
 * and `Shipment.order_id` being unique is what makes the second half a set
 * membership test rather than a join.
 *
 * The backend has no single endpoint for that, and `backend/**` belongs to
 * another task, so the queue is assembled from three reads that already exist:
 *
 * 1. `GET /shipments` paged to exhaustion → the set of order ids that are done.
 * 2. `GET /orders?status=…` over the four open statuses → the candidates.
 * 3. `GET /orders/:id` for each candidate not in (1) → the only place
 *    `OrderItem.fulfilment` is exposed, since the orders **list** projection
 *    carries `_count.items` and no items.
 *
 * Step 3 is bounded by {@link CANDIDATE_LIMIT} so a backlog cannot turn one
 * screen into a hundred requests, and the queue says so out loud when it trims.
 */

import { useMemo } from 'react';
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { apiClient, apiErrorStatus } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  OPEN_ORDERS_KEY,
  POLL_FLOOR_MS,
  SHIPMENT_ORDER_IDS_KEY,
  opsOrderDetailKey,
  shipmentDetailKey,
  shipmentListKey,
} from '@/lib/hooks/use-shipments-realtime';
import { SETTING_DEFAULTS, type ShippingSetting, type SystemSetting } from '@/lib/types/settings';
import type {
  ShipmentDetail,
  ShipmentStatus,
  ShipmentsEnvelope,
} from '@/lib/types/shipments';
import type { Order, OrderItem, OrderStatus } from '@/lib/types/orders';

/** `GET /shipments` caps `limit` at 100 server-side; ask for the cap. */
const SHIPMENTS_PAGE_SIZE = 100;

/** How many pages the packed-id scan will walk before it admits it is partial. */
const SHIPMENT_SCAN_MAX_PAGES = 20;

/**
 * The order statuses that can still be waiting on a parcel. `shipped`,
 * `delivered`, `completed`, `cancelled` and `refunded` are past packing;
 * `served` and `dispatched` are the counter and rider lanes, which never carry
 * a shipped line.
 */
const OPEN_ORDER_STATUSES: OrderStatus[] = [
  'placed',
  'confirmed',
  'preparing',
  'ready',
];

/** Per-status page size for the candidate sweep. */
const OPEN_ORDERS_PAGE_SIZE = 100;

/** The most orders the queue will hydrate line-by-line in one render. */
export const CANDIDATE_LIMIT = 60;

// ─── shipping settings ──────────────────────────────────────────────────────

/**
 * `GET /settings/shipping` is gated by `MANAGE_SYSTEM`, but this screen only
 * needs `MANAGE_OPS` — a packer legitimately has one and not the other. So the
 * read is asked for only when the permission is held, never retried, and always
 * falls back to `SETTING_DEFAULTS.shipping` rather than blocking the screen.
 *
 * Nothing load-bearing depends on it: the AWB dialog reads `Shipment.provider`
 * off the row itself (which is written from this setting at pack time and is
 * therefore the *per-parcel* truth), and an omitted `pickup_location_code`
 * makes the server apply this same default.
 */
export function useShippingSettings(): {
  shipping: ShippingSetting;
  /** `false` when the value below is the compiled-in default, not the server's. */
  fromServer: boolean;
} {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canRead = hasPermission('MANAGE_SYSTEM');

  const { data } = useQuery({
    queryKey: ['settings', 'shipping'],
    queryFn: () =>
      apiClient.get<SystemSetting<'shipping'>>('/settings/shipping'),
    enabled: canRead,
    retry: false,
    staleTime: 5 * 60_000,
  });

  return {
    shipping: data?.value ?? SETTING_DEFAULTS.shipping,
    fromServer: Boolean(data?.value),
  };
}

// ─── the Shipments tab ──────────────────────────────────────────────────────

function shipmentsPath(
  status: ShipmentStatus | 'all',
  cursor: string | undefined,
): string {
  const params = new URLSearchParams({ limit: String(SHIPMENTS_PAGE_SIZE) });
  if (status !== 'all') params.set('status', status);
  if (cursor) params.set('cursor', cursor);
  return `/shipments?${params.toString()}`;
}

/**
 * `GET /shipments?status=&cursor=&limit=` as an infinite query — the envelope's
 * `{ items, next_cursor }` is exactly `useInfiniteQuery`'s contract, so the
 * accumulated pages live in the cache instead of in component state.
 *
 * `next_cursor` is a row id and is passed back verbatim; nothing here parses it.
 */
export function useShipmentList(status: ShipmentStatus | 'all', live: boolean) {
  return useInfiniteQuery({
    queryKey: shipmentListKey(status),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<ShipmentsEnvelope>(shipmentsPath(status, pageParam)),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: live ? false : POLL_FLOOR_MS,
  });
}

/** `GET /shipments/:id` — the row, its shipped lines and its full ledger. */
export function useShipmentDetail(id: string, live: boolean) {
  return useQuery({
    queryKey: shipmentDetailKey(id),
    queryFn: () => apiClient.get<ShipmentDetail>(`/shipments/${id}`),
    enabled: id.length > 0,
    refetchInterval: live ? false : POLL_FLOOR_MS,
  });
}

// ─── the "To pack" tab ──────────────────────────────────────────────────────

/** The orders-list projection: `_count.items` and a payment stub, never items. */
export type OrderListRow = Pick<
  Order,
  | 'id'
  | 'order_number'
  | 'status'
  | 'channel'
  | 'total'
  | 'customer_name'
  | 'customer_phone'
  | 'delivery_address'
  | 'created_at'
>;

/** One row of the queue: an order that needs a box, and the lines going in it. */
export interface ToPackRow {
  order: OrderListRow;
  shippedItems: OrderItem[];
  /** Units across every shipped line — what the packer actually counts. */
  units: number;
}

export interface ToPackQueueState {
  rows: ToPackRow[];
  isLoading: boolean;
  /** Candidates still being hydrated by `GET /orders/:id`. */
  isHydrating: boolean;
  isError: boolean;
  /** `403` when the signed-in role holds `MANAGE_OPS` but not `MANAGE_POS`. */
  isForbidden: boolean;
  /** More open orders than {@link CANDIDATE_LIMIT} — the tail is not shown. */
  isTruncated: boolean;
  /**
   * The packed-id scan hit its page bound, so a handful of very old parcels may
   * not have been seen and their orders could show here in error.
   */
  isScanIncomplete: boolean;
  refetch: () => void;
}

/**
 * Walks `GET /shipments` to exhaustion and returns every `order_id` that
 * already has a parcel. Bounded at {@link SHIPMENT_SCAN_MAX_PAGES}; `complete`
 * says whether the bound was hit, and the queue surfaces that rather than
 * quietly claiming an order still needs packing.
 */
function usePackedOrderIds(live: boolean) {
  return useQuery({
    queryKey: SHIPMENT_ORDER_IDS_KEY,
    queryFn: async (): Promise<{ ids: string[]; complete: boolean }> => {
      const ids: string[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < SHIPMENT_SCAN_MAX_PAGES; page += 1) {
        const envelope = await apiClient.get<ShipmentsEnvelope>(
          shipmentsPath('all', cursor),
        );
        for (const row of envelope.items) ids.push(row.order_id);
        if (!envelope.next_cursor) return { ids, complete: true };
        cursor = envelope.next_cursor;
      }
      return { ids, complete: false };
    },
    refetchInterval: live ? false : POLL_FLOOR_MS,
  });
}

/** The four open statuses, swept in parallel and merged oldest-first. */
function useOpenOrders(live: boolean) {
  return useQuery({
    queryKey: OPEN_ORDERS_KEY,
    queryFn: async (): Promise<OrderListRow[]> => {
      const pages = await Promise.all(
        OPEN_ORDER_STATUSES.map((status) =>
          apiClient.get<OrderListRow[]>(
            `/orders?status=${status}&limit=${OPEN_ORDERS_PAGE_SIZE}`,
          ),
        ),
      );
      const seen = new Map<string, OrderListRow>();
      for (const page of pages) {
        for (const order of page) seen.set(order.id, order);
      }
      // Oldest first: a queue is worked from the front, and the oldest unpacked
      // order is the one closest to breaching its promise.
      return [...seen.values()].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    },
    refetchInterval: live ? false : POLL_FLOOR_MS,
  });
}

/**
 * The queue itself. See the module note for why it is assembled rather than
 * fetched.
 */
export function useToPackQueue(live: boolean): ToPackQueueState {
  const packed = usePackedOrderIds(live);
  const orders = useOpenOrders(live);

  const packedIds = useMemo(
    () => new Set(packed.data?.ids ?? []),
    [packed.data],
  );

  const candidates = useMemo(
    () => (orders.data ?? []).filter((order) => !packedIds.has(order.id)),
    [orders.data, packedIds],
  );

  const hydrated = candidates.slice(0, CANDIDATE_LIMIT);

  const details = useQueries({
    queries: hydrated.map((order) => ({
      queryKey: opsOrderDetailKey(order.id),
      queryFn: () => apiClient.get<Order>(`/orders/${order.id}`),
      // Lines do not change while an order waits to be packed, and this query
      // sits outside the realtime invalidation prefix on purpose.
      staleTime: 5 * 60_000,
    })),
  });

  // Derived straight, not memoised: `details` is a fresh array on every render
  // by `useQueries`' own design, so a memo over it would never hit and would
  // only hide that fact.
  const rows: ToPackRow[] = [];
  hydrated.forEach((order, index) => {
    const detail = details[index]?.data;
    if (!detail) return;
    const shippedItems = (detail.items ?? []).filter(
      (item) => item.fulfilment === 'shipped',
    );
    if (shippedItems.length === 0) return;
    rows.push({
      order,
      shippedItems,
      units: shippedItems.reduce((sum, item) => sum + item.quantity, 0),
    });
  });

  const forbidden =
    apiErrorStatus(orders.error) === 403 ||
    details.some((query) => apiErrorStatus(query.error) === 403);

  return {
    rows,
    isLoading: packed.isLoading || orders.isLoading,
    isHydrating: details.some((query) => query.isPending),
    isError: packed.isError || orders.isError,
    isForbidden: forbidden,
    isTruncated: candidates.length > CANDIDATE_LIMIT,
    isScanIncomplete: packed.data?.complete === false,
    refetch: () => {
      void packed.refetch();
      void orders.refetch();
    },
  };
}
