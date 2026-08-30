/**
 * Shipments — `SHIP-03`'s staff queue (`GET/POST /shipments*`, `MANAGE_OPS`).
 *
 * Four facts read off `backend/src/shipments/shipments.service.ts` that the
 * screens must honour:
 *
 * 1. **One shipment per order.** `Shipment.order_id` is unique, so
 *    `POST /shipments/pack { order_id }` *is* the create, and packing twice
 *    returns the same row rather than erroring.
 * 2. **The AWB body is honoured only by the `manual` provider.** With
 *    `shiprocket` configured the API issues the AWB and courier name and the
 *    posted body loses — so the dialog must say which provider is live.
 * 3. **`GET /shipments/:id/label` answers `200 { label_url: null }`** for a
 *    manual shipment that has an AWB but no label. `400` is reserved for
 *    "no AWB assigned yet".
 * 4. **`POST /shipments/:id/pickup` does NOT move the order** — `pickup_scheduled`
 *    is deliberately outside `ShipmentsService.IN_FLIGHT`; the order flips to
 *    `shipped` on the courier's first scan (`picked_up`/`in_transit`), not at
 *    scheduling time.
 *
 * The "to pack" queue is *not* driven by `OrderItemStatus.packed`: `confirm`
 * already sets shipped lines to `packed` before anyone has touched a box
 * (P5b decision 10). It is "orders with shipped lines that have no `Shipment`
 * row" — cross-reference `GET /shipments` against the orders list.
 */

import type { OrderItemStatus, OrderStatus } from './kds';

/** Prisma `ShipmentStatus`. */
export type ShipmentStatus =
  | 'pending'
  | 'awb_assigned'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'rto'
  | 'cancelled'
  | 'failed';

/** Prisma `ShippingProvider`. */
export type ShippingProvider = 'shiprocket' | 'manual';

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'pending',
  'awb_assigned',
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'rto',
  'cancelled',
  'failed',
];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Packed',
  awb_assigned: 'AWB assigned',
  pickup_scheduled: 'Pickup scheduled',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  rto: 'Returned to origin',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

/** The happy path, in order — index comparison answers "is this forward?". */
export const SHIPMENT_LINEAR_FLOW: readonly ShipmentStatus[] = [
  'pending',
  'awb_assigned',
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

/**
 * The legal moves, mirroring `ShipmentsService.TRANSITIONS`. A terminal status
 * (`delivered`, `rto`, `cancelled`, `failed`) has no outgoing edge, so the UI
 * renders no action for it rather than offering a button the server will refuse.
 */
export const SHIPMENT_TRANSITIONS: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  pending: ['awb_assigned', 'cancelled', 'failed'],
  awb_assigned: ['pickup_scheduled', 'cancelled', 'failed'],
  pickup_scheduled: ['picked_up', 'cancelled', 'failed'],
  picked_up: ['in_transit', 'rto', 'failed'],
  in_transit: ['out_for_delivery', 'rto', 'failed'],
  out_for_delivery: ['delivered', 'rto', 'failed'],
};

export function canTransitionShipment(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  return (SHIPMENT_TRANSITIONS[from] ?? []).includes(to);
}

/** One row of the tracking ledger. `raw` is the courier's untyped payload. */
export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  status: ShipmentStatus;
  raw: unknown | null;
  occurred_at: string;
  created_at: string;
}

/** The narrow event projection the customer-facing parcel view carries. */
export interface ShipmentEventSummary {
  status: ShipmentStatus;
  occurred_at: string;
}

/** A `Shipment` row, with no joins. */
export interface Shipment {
  id: string;
  node_id: string;
  order_id: string;
  provider: ShippingProvider;
  provider_order_id: string | null;
  provider_shipment_id: string | null;
  awb: string | null;
  courier_name: string | null;
  status: ShipmentStatus;
  label_url: string | null;
  tracking_url: string | null;
  pickup_location_code: string;
  weight_grams: number;
  /** Courier charge in rupees, or `null` when the provider quoted none. */
  cost: number | null;
  etd: string | null;
  packed_by: string | null;
  created_at: string;
  updated_at: string;
}

/** One shipped line, as `SHIPPED_ITEMS_INCLUDE` projects it. */
export interface ShipmentOrderItem {
  id: string;
  quantity: number;
  status: OrderItemStatus;
  unit_price: number;
  product: { id: string; name: string; slug: string };
  variant: { id: string; name: string; sku: string } | null;
}

/**
 * The order a shipment hangs off. Only the `shipped` lines are included — a
 * mixed order's local and booking lines are deliberately absent.
 */
export interface ShipmentOrderSummary {
  id: string;
  order_number: number;
  status: OrderStatus;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  created_at: string;
  items: ShipmentOrderItem[];
}

/** A row of `GET /shipments`. */
export interface ShipmentListRow extends Shipment {
  order: ShipmentOrderSummary;
}

/** `GET /shipments/:id` — the row plus its full tracking ledger, newest first. */
export interface ShipmentDetail extends ShipmentListRow {
  events: ShipmentEvent[];
}

export interface ShipmentsEnvelope {
  items: ShipmentListRow[];
  next_cursor: string | null;
}

/**
 * `POST /shipments/pack`. Both overrides are optional: omit `weight_grams` and
 * the server sums `Product.weight_grams × qty`, falling back to
 * `settings.shipping.default_weight_grams`. `400` when the order has no
 * shipped lines.
 */
export interface PackShipmentPayload {
  order_id: string;
  weight_grams?: number;
  pickup_location_code?: string;
}

/**
 * `POST /shipments/:id/awb`. Every field is optional because the body only
 * matters to the `manual` provider (see the module note).
 * `400` illegal transition · `503` courier unreachable.
 */
export interface AssignAwbPayload {
  awb?: string;
  courier_name?: string;
  tracking_url?: string;
}

/** `POST /shipments/:id/cancel` — the reason is stored on the `ShipmentEvent`. */
export interface CancelShipmentPayload {
  reason?: string;
}

/** `GET /shipments/:id/label`. `null` means "the provider has no label for this one". */
export interface ShipmentLabel {
  label_url: string | null;
}

/** `?status=&cursor=&limit=` on `GET /shipments`. */
export interface ShipmentListQuery {
  status?: ShipmentStatus;
  cursor?: string;
  limit?: number;
}

/**
 * The Pusher event `ShipmentsService` broadcasts on the **`private-shipments`**
 * channel whenever `applyStatus` runs — staff action or courier webhook alike.
 * Both constants are byte-identical to the backend's.
 */
export const SHIPMENTS_CHANNEL = 'private-shipments';
export const SHIPMENT_UPDATED_EVENT = 'shipment.updated';

/**
 * The broadcast payload. Deliberately camelCase — it is a Pusher message, not
 * an API row — and deliberately partial: it carries enough to decide whether a
 * refetch is worth it, never enough to render from.
 */
export interface ShipmentUpdatedEvent {
  id: string;
  orderId: string;
  status: ShipmentStatus;
  awb: string | null;
  courierName: string | null;
  trackingUrl: string | null;
}
