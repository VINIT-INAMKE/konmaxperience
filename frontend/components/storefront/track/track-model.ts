/**
 * The derivation layer behind `/orders/[id]/track` (`STORE-03`).
 *
 * Everything here is pure: it turns a `CustomerOrder` and an optional
 * `CustomerShipment` into the three progress presentations the page renders.
 * Keeping it out of the components is what makes the two hard rules below
 * checkable by reading one file.
 *
 * ## Rule 1 — a mixed order has no single progress bar
 *
 * P5a routes a line by `OrderItem.fulfilment`, not by the order. One order can
 * hold a kitchen line, a parcel and a seat at an event, and those three move at
 * completely different speeds. So the page renders **one rail per fulfilment
 * group** and never averages them into a single percentage:
 *
 * | group | rail |
 * |---|---|
 * | `local` | `placed -> confirmed -> preparing -> ready -> served/dispatched -> delivered` |
 * | `shipped` | deferred to the `Shipment` ledger — see {@link buildShipmentSteps} |
 * | `booking` | `held -> confirmed -> attended`, one rail per seat |
 *
 * `Order.status` is a single column covering all of that, so it is read as a
 * *floor*, not as the answer. `shipped` in particular says the parcel left the
 * villa and says **nothing** about the kitchen line beside it, which is why
 * {@link ORDER_STATUS_RANK} maps it to `confirmed` for the local rail.
 *
 * ## Rule 2 — a courier's ledger is the truth, and it skips
 *
 * P5a recorded couriers reporting `delivered` with no intermediate scan. So
 * {@link buildShipmentSteps} renders each stage from the `ShipmentEvent` rows
 * that actually exist: a stage the parcel has passed with no scan behind it is
 * marked `skipped` and says so, rather than being drawn as a completed step the
 * courier never reported.
 */

import type { CustomerShipment } from '@/lib/types/checkout';
import type { FulfilmentType } from '@/lib/types/catalog';
import type { OrderItemStatus, OrderStatus } from '@/lib/types/kds';
import type { CustomerOrder, CustomerOrderItem } from '@/lib/types/marketplace';
import type { DeliveryStatus } from '@/lib/types/orders';
import {
  SHIPMENT_LINEAR_FLOW,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from '@/lib/types/shipments';

// --- the order, as this page reads it ---------------------------------------

/**
 * `GET /customer/orders/:id` projects `product: { id, name }` and nothing more
 * (`customer-orders.service.ts` `getOrderById`), so an `experience` line does
 * **not** carry its event date today. The relation is declared optional here so
 * the booking rail renders the date the moment the projection widens, and
 * renders cleanly without it in the meantime — rather than this page growing a
 * second fetch for a field the order route should be carrying anyway.
 */
export interface TrackProduct {
  id: string;
  name: string;
  event?: { id: string; date: string } | null;
}

export type TrackOrderItem = Omit<CustomerOrderItem, 'product'> & {
  product: TrackProduct;
};

export type TrackOrder = Omit<CustomerOrder, 'items'> & {
  items: TrackOrderItem[];
};

// --- one step of a rail -----------------------------------------------------

/**
 * - `done` — reached, with a timestamp where one exists.
 * - `current` — where the order or the parcel is right now.
 * - `pending` — still ahead.
 * - `skipped` — passed without ever being reported. Only a courier ledger
 *   produces this (rule 2); it is drawn quieter than `done` and captioned.
 * - `cancelled` — the order or the parcel stopped here.
 */
export type TimelineStepState = 'done' | 'current' | 'pending' | 'skipped' | 'cancelled';

export interface TimelineStep {
  key: string;
  label: string;
  state: TimelineStepState;
  /** ISO 8601, when the API carries one for this step. Most steps have none. */
  at?: string | null;
  /** A quiet caption under the label. */
  note?: string | null;
}

// --- grouping ---------------------------------------------------------------

export const FULFILMENT_GROUP_ORDER: readonly FulfilmentType[] = ['local', 'shipped', 'booking'];

export const FULFILMENT_GROUP_LABELS: Record<FulfilmentType, string> = {
  local: 'From the kitchen',
  shipped: 'Shipped to you',
  booking: 'Your experience',
};

/** Splits an order's lines the way the page presents them. Order is stable. */
export function groupOrderItems(
  items: readonly TrackOrderItem[],
): Record<FulfilmentType, TrackOrderItem[]> {
  const groups: Record<FulfilmentType, TrackOrderItem[]> = {
    local: [],
    shipped: [],
    booking: [],
  };
  for (const item of items) {
    // `fulfilment` is non-null on every confirmed line; the fallback keeps an
    // unexpected value visible in the kitchen group rather than silently
    // dropping the line off the page.
    groups[item.fulfilment ?? 'local'].push(item);
  }
  return groups;
}

// --- terminal states --------------------------------------------------------

export const CANCELLED_ORDER_STATUSES: readonly OrderStatus[] = ['cancelled', 'refunded'];

const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  'delivered',
  'completed',
  'cancelled',
  'refunded',
];

const TERMINAL_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  'delivered',
  'rto',
  'cancelled',
  'failed',
];

export function isOrderCancelled(status: OrderStatus): boolean {
  return CANCELLED_ORDER_STATUSES.includes(status);
}

/**
 * True once nothing more can happen to this order — the page stops polling.
 * A live shipment keeps the page awake even on a `delivered` order, because the
 * parcel can still report `rto`.
 */
export function isTrackingSettled(
  order: Pick<TrackOrder, 'status'>,
  shipment: Pick<CustomerShipment, 'status'> | null,
): boolean {
  if (!TERMINAL_ORDER_STATUSES.includes(order.status)) return false;
  if (!shipment) return true;
  return TERMINAL_SHIPMENT_STATUSES.includes(shipment.status);
}

// --- the local rail ---------------------------------------------------------

const LOCAL_RANK = {
  placed: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  handover: 4,
  delivered: 5,
} as const;

/**
 * `Order.status` -> the local rail's floor.
 *
 * `shipped` maps to `confirmed` deliberately: `POST /shipments/:id/pickup`
 * moves the *order* to `shipped` the moment the courier is booked, which tells
 * you nothing about the kitchen line sitting beside the parcel. Reading it as
 * progress on the local rail would jump the kitchen straight past "preparing".
 */
const ORDER_STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  placed: LOCAL_RANK.placed,
  confirmed: LOCAL_RANK.confirmed,
  preparing: LOCAL_RANK.preparing,
  ready: LOCAL_RANK.ready,
  served: LOCAL_RANK.handover,
  dispatched: LOCAL_RANK.handover,
  shipped: LOCAL_RANK.confirmed,
  delivered: LOCAL_RANK.delivered,
  completed: LOCAL_RANK.delivered,
};

/** `OrderItem.status` -> the same scale. A paid line is at least `confirmed`. */
const ITEM_STATUS_RANK: Partial<Record<OrderItemStatus, number>> = {
  pending: LOCAL_RANK.confirmed,
  preparing: LOCAL_RANK.preparing,
  ready: LOCAL_RANK.ready,
  packed: LOCAL_RANK.ready,
  shipped: LOCAL_RANK.handover,
  delivered: LOCAL_RANK.delivered,
  attended: LOCAL_RANK.delivered,
};

const DELIVERY_STATUS_RANK: Record<DeliveryStatus, number> = {
  picked_up: LOCAL_RANK.handover,
  in_transit: LOCAL_RANK.handover,
  delivered: LOCAL_RANK.delivered,
};

/** The storefront quotes on `takeaway` or `delivery`; everything else collects. */
export function isDeliveryOrder(order: Pick<TrackOrder, 'channel'>): boolean {
  return order.channel === 'delivery';
}

/**
 * How far the kitchen lines have actually got.
 *
 * The order column is a floor and the *least* advanced line is the ceiling — a
 * group is only as far along as the dish still on the pass.
 */
function localRank(order: TrackOrder, items: readonly TrackOrderItem[]): number {
  const fromOrder = ORDER_STATUS_RANK[order.status] ?? LOCAL_RANK.placed;
  const fromDelivery = order.delivery_status
    ? DELIVERY_STATUS_RANK[order.delivery_status]
    : LOCAL_RANK.placed;

  const live = items.filter((item) => item.status !== 'cancelled');
  const fromItems = live.length
    ? Math.min(...live.map((item) => ITEM_STATUS_RANK[item.status] ?? LOCAL_RANK.confirmed))
    : LOCAL_RANK.placed;

  return Math.max(fromOrder, fromDelivery, fromItems);
}

/** The latest `ready_at` across the group — the moment the whole group was up. */
function groupReadyAt(items: readonly TrackOrderItem[]): string | null {
  const stamps = items.map((item) => item.ready_at).filter((at): at is string => Boolean(at));
  if (!stamps.length || stamps.length !== items.length) return null;
  return stamps.reduce((latest, at) => (Date.parse(at) > Date.parse(latest) ? at : latest));
}

function stepState(stageRank: number, reached: number, cancelled: boolean): TimelineStepState {
  if (cancelled && stageRank >= reached) return 'cancelled';
  if (stageRank < reached) return 'done';
  if (stageRank === reached) return 'current';
  return 'pending';
}

/**
 * The last stage of a rail is terminal by construction, so "you are here" on it
 * would be wrong — an order that has been collected is done, not in progress.
 */
function settleFinalStep(steps: TimelineStep[]): TimelineStep[] {
  const last = steps[steps.length - 1];
  if (last && last.state === 'current') last.state = 'done';
  return steps;
}

/**
 * The kitchen rail. A pickup order ends at "Collected" and never grows a
 * delivery step it will not take.
 */
export function buildLocalSteps(
  order: TrackOrder,
  items: readonly TrackOrderItem[],
): TimelineStep[] {
  const delivery = isDeliveryOrder(order);
  const rank = localRank(order, items);
  const cancelled = isOrderCancelled(order.status);

  const stages: { key: string; label: string; rank: number; at?: string | null }[] = [
    { key: 'placed', label: 'Order placed', rank: LOCAL_RANK.placed, at: order.created_at },
    { key: 'confirmed', label: 'Payment confirmed', rank: LOCAL_RANK.confirmed },
    { key: 'preparing', label: 'Being prepared', rank: LOCAL_RANK.preparing },
    {
      key: 'ready',
      label: delivery ? 'Ready to leave' : 'Ready for collection',
      rank: LOCAL_RANK.ready,
      at: groupReadyAt(items),
    },
  ];

  if (delivery) {
    stages.push(
      { key: 'dispatched', label: 'Out for delivery', rank: LOCAL_RANK.handover },
      { key: 'delivered', label: 'Delivered', rank: LOCAL_RANK.delivered },
    );
  } else {
    stages.push({ key: 'served', label: 'Collected', rank: LOCAL_RANK.handover });
  }

  return settleFinalStep(
    stages.map((stage) => ({
      key: stage.key,
      label: stage.label,
      at: stage.at ?? null,
      state: stepState(stage.rank, rank, cancelled),
    })),
  );
}

// --- the booking rail -------------------------------------------------------

const BOOKING_RANK = { held: 0, confirmed: 1, attended: 2 } as const;

/**
 * One rail per seat: `held -> confirmed -> attended`.
 *
 * A quote creates a 15-minute `held` `EventBooking`; `confirm` promotes it and
 * stamps `OrderItem.event_booking_id`, so the presence of that id — not the
 * order status — is what says the seat is really the customer's. `attended` is
 * set by staff through `POST /events/:id/attendance`, which is also what opens
 * the review gate.
 */
export function buildBookingSteps(order: TrackOrder, item: TrackOrderItem): TimelineStep[] {
  const cancelled = isOrderCancelled(order.status) || item.status === 'cancelled';
  const rank =
    item.status === 'attended'
      ? BOOKING_RANK.attended
      : item.event_booking_id
        ? BOOKING_RANK.confirmed
        : BOOKING_RANK.held;

  const stages: { key: string; label: string; rank: number; at: string | null }[] = [
    { key: 'held', label: 'Seat held', rank: BOOKING_RANK.held, at: order.created_at },
    { key: 'confirmed', label: 'Booking confirmed', rank: BOOKING_RANK.confirmed, at: null },
    { key: 'attended', label: 'Attended', rank: BOOKING_RANK.attended, at: null },
  ];

  return settleFinalStep(
    stages.map((stage) => ({
      key: stage.key,
      label: stage.label,
      at: stage.at,
      state: stepState(stage.rank, rank, cancelled),
    })),
  );
}

// --- the parcel rail --------------------------------------------------------

const SKIPPED_NOTE = 'No courier scan recorded';

/**
 * The parcel rail, drawn from the `ShipmentEvent` ledger rather than from the
 * happy path (rule 2 in the module note).
 *
 * `events` arrives newest-first, so the loop below lets the *oldest* row for a
 * status win: a courier that re-reports `in_transit` three times should stamp
 * the step with the first scan, not the last.
 *
 * A parcel that ends `rto`, `cancelled` or `failed` leaves the linear flow
 * entirely; that status is appended as a final, explicitly stopped step instead
 * of being forced into a rail it does not belong on.
 */
export function buildShipmentSteps(shipment: CustomerShipment): TimelineStep[] {
  const stamped = new Map<ShipmentStatus, string>();
  for (const event of shipment.events) stamped.set(event.status, event.occurred_at);

  const current = SHIPMENT_LINEAR_FLOW.indexOf(shipment.status);
  const offPath = current === -1;

  const steps: TimelineStep[] = SHIPMENT_LINEAR_FLOW.map((status, index) => {
    const at = stamped.get(status) ?? null;
    let state: TimelineStepState;
    if (index === current) state = 'current';
    else if (at) state = 'done';
    else if (!offPath && index < current) state = 'skipped';
    else state = 'pending';

    return {
      key: status,
      label: SHIPMENT_STATUS_LABELS[status],
      at,
      state,
      note: state === 'skipped' ? SKIPPED_NOTE : null,
    };
  });

  // `delivered` is the end of the road, not a "you are here" marker.
  if (shipment.status === 'delivered' && current >= 0) steps[current].state = 'done';

  if (offPath) {
    steps.push({
      key: shipment.status,
      label: SHIPMENT_STATUS_LABELS[shipment.status],
      at: stamped.get(shipment.status) ?? null,
      state: 'cancelled',
      note: null,
    });
  }

  return steps;
}

/** True when the courier has stopped and no further scan is coming. */
export function isShipmentStopped(status: ShipmentStatus): boolean {
  return status === 'rto' || status === 'cancelled' || status === 'failed';
}

// --- money ------------------------------------------------------------------

/**
 * `Order.discount_amount` bundles the coupon and the loyalty burn into one
 * column (P5a decision 23). A receipt shows two lines, so the split is
 * reconstructed: loyalty is `loyalty_points_redeemed * redeem_value_per_point`
 * and the coupon is the remainder.
 *
 * `redeem_value_per_point` lives on `GET /customer/loyalty`, so it can be
 * missing while that query is in flight. Then `split` is `false` and the caller
 * renders one honest "Discount" line rather than inventing a division it cannot
 * justify.
 */
export interface DiscountSplit {
  coupon: number;
  loyalty: number;
  split: boolean;
}

export function splitDiscount(
  order: Pick<TrackOrder, 'discount_amount' | 'loyalty_points_redeemed'>,
  redeemValuePerPoint: number | null | undefined,
): DiscountSplit {
  const total = order.discount_amount;
  const points = order.loyalty_points_redeemed;

  if (!points || !redeemValuePerPoint || !Number.isFinite(redeemValuePerPoint)) {
    return { coupon: total, loyalty: 0, split: false };
  }

  // Clamped rather than trusted: a settings change between the order and this
  // read would otherwise produce a negative coupon line.
  const loyalty = Math.min(Number((points * redeemValuePerPoint).toFixed(2)), total);
  return { coupon: Number((total - loyalty).toFixed(2)), loyalty, split: true };
}
