import { Logger } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { ActorType } from '@prisma/client';

/**
 * SPEC §4.1 — the complete domain-event catalogue. Every emitter passes
 * `{ node_id, actor, occurred_at, …payload }` and emits ONLY after the
 * transaction commits, through `emitDomainEvent` (which swallows listener
 * failures so a broken subscriber can never fail a write).
 *
 * Events whose source model does not exist yet (`shipment.status_changed`,
 * `shipment.delivered`, `review.published`, `coupon.redeemed`) are declared
 * here with full payload types but have no emitter until P5 — the rule table
 * in `mission-bridge.rules.ts` marks them `emitter: 'P5'`.
 */

export interface DomainEventActor {
  actor_type: ActorType;
  actor_id: string | null;
}

export interface DomainEventBase {
  node_id: string;
  actor: DomainEventActor;
  /** ISO-8601 UTC instant the source transaction committed. */
  occurred_at: string;
}

/**
 * Mirrors `AuditService`'s actor shape deliberately: `common/events` must not
 * depend on a feature module, and an `AuditEvent` written from a domain event
 * can reuse the same object without a translation step.
 */
export const userActor = (
  userId: string | null | undefined,
): DomainEventActor =>
  userId
    ? { actor_type: ActorType.user, actor_id: userId }
    : { actor_type: ActorType.system, actor_id: null };

export const customerActor = (customerId: string): DomainEventActor => ({
  actor_type: ActorType.customer,
  actor_id: customerId,
});

export const systemActor = (): DomainEventActor => ({
  actor_type: ActorType.system,
  actor_id: null,
});

// ─── Event-name registry ─────────────────────────────────────────────────────

export const DomainEvent = {
  // Existing (v1) — retyped, names unchanged so listeners keep working.
  ORDER_PLACED: 'order.placed',
  ORDER_READY: 'order.ready',
  DELIVERY_UPDATED: 'delivery.updated',
  STOCK_LOW: 'stock.low',
  TASK_BLOCKED: 'task.blocked',
  // New — SPEC §4.1.
  RECIPE_APPROVED: 'recipe.approved',
  RECIPE_ARCHIVED: 'recipe.archived',
  PURCHASE_ORDER_RECEIVED: 'purchase_order.received',
  PREP_BATCH_CREATED: 'prep_batch.created',
  PREP_BATCH_DEPLETED: 'prep_batch.depleted',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_SERVED: 'order.served',
  ORDER_DELIVERED: 'order.delivered',
  SHIPMENT_STATUS_CHANGED: 'shipment.status_changed',
  SHIPMENT_DELIVERED: 'shipment.delivered',
  WASTE_LOGGED: 'waste.logged',
  EVENT_COMPLETED: 'event.completed',
  BOOKING_ATTENDED: 'booking.attended',
  FEEDBACK_RECEIVED: 'feedback.received',
  REVIEW_PUBLISHED: 'review.published',
  PRODUCT_PUBLISHED: 'product.published',
  VENDOR_PRICE_UPDATED: 'vendor_price.updated',
  TASK_VALIDATED: 'task.validated',
  APPROVAL_DECIDED: 'approval.decided',
  DECISION_RESOLVED: 'decision.resolved',
  COUPON_REDEEMED: 'coupon.redeemed',
} as const;

export type DomainEventName = (typeof DomainEvent)[keyof typeof DomainEvent];

// ─── Payload map ─────────────────────────────────────────────────────────────

/**
 * Field names for the five v1 events are copied verbatim from the current emit
 * sites (`orders.service.ts:185`, `:519`, `kds.service.ts:237`,
 * `inventory.service.ts:158`, `tasks.service.ts:309`) so the untyped emits and
 * `notifications.listener.ts` keep compiling while Task 5 migrates them.
 * Nullability follows the *schema*, not the current emit site: `Order.created_by`
 * is nullable, so `createdBy` is `string | null`.
 */
export interface DomainEventPayloads {
  'order.placed': DomainEventBase & {
    orderId: string;
    channel: string;
    itemCount: number;
    total: string;
    createdBy: string | null;
  };
  'order.ready': DomainEventBase & {
    orderId: string;
    channel: string;
    createdBy: string | null;
  };
  'delivery.updated': DomainEventBase & {
    orderId: string;
    deliveryStatus: string | null;
    deliveryAddress: string | null;
    createdBy: string | null;
  };
  'stock.low': DomainEventBase & {
    ingredientId: string;
    ingredientName: string;
    currentQty: number;
    minQty: number;
    unit: string;
    zoneId: string;
  };
  'task.blocked': DomainEventBase & {
    taskId: string;
    taskTitle: string;
    ownerUserId: string;
    blockedReason: string | null;
  };

  'recipe.approved': DomainEventBase & {
    recipeId: string;
    name: string;
    version: number;
    computedCost: string | null;
  };
  'recipe.archived': DomainEventBase & {
    recipeId: string;
    name: string;
    version: number;
  };
  'purchase_order.received': DomainEventBase & {
    purchaseOrderId: string;
    vendorId: string;
    vendorName: string;
    linkedTaskId: string | null;
    lineCount: number;
    totalAmount: string;
    fullyReceived: boolean;
  };
  'prep_batch.created': DomainEventBase & {
    prepBatchId: string;
    recipeId: string;
    recipeName: string;
    zoneId: string;
    quantityProduced: string;
    unit: string;
  };
  'prep_batch.depleted': DomainEventBase & {
    prepBatchId: string;
    recipeId: string;
    recipeName: string;
    zoneId: string;
  };
  'order.confirmed': DomainEventBase & {
    orderId: string;
    orderNumber: number;
    channel: string;
    total: string;
    itemCount: number;
    customerId: string | null;
  };
  'order.served': DomainEventBase & {
    orderId: string;
    orderNumber: number;
    channel: string;
    total: string;
  };
  'order.delivered': DomainEventBase & {
    orderId: string;
    orderNumber: number;
    channel: string;
    total: string;
  };
  'shipment.status_changed': DomainEventBase & {
    shipmentId: string;
    orderId: string;
    status: string;
    awb: string | null;
  };
  'shipment.delivered': DomainEventBase & {
    shipmentId: string;
    orderId: string;
    awb: string | null;
  };
  'waste.logged': DomainEventBase & {
    wasteLogId: string;
    wasteType: string;
    reason: string;
    costImpact: string;
    zoneId: string;
    ingredientId: string | null;
    prepBatchId: string | null;
  };
  'event.completed': DomainEventBase & {
    eventId: string;
    title: string;
    attendedCount: number;
  };
  'booking.attended': DomainEventBase & {
    bookingId: string;
    eventId: string;
    guests: number;
  };
  'feedback.received': DomainEventBase & {
    feedbackId: string;
    orderId: string | null;
    rating: number;
    comment: string | null;
  };
  'review.published': DomainEventBase & {
    reviewId: string;
    productId: string;
    rating: number;
  };
  'product.published': DomainEventBase & {
    productId: string;
    name: string;
    slug: string;
    type: string;
  };
  'vendor_price.updated': DomainEventBase & {
    vendorPriceId: string;
    vendorId: string;
    ingredientId: string;
    ingredientName: string;
    price: string;
    unit: string;
  };
  'task.validated': DomainEventBase & {
    taskId: string;
    title: string;
    ownerUserId: string;
    questId: string | null;
    missionId: string;
    readinessMeterId: string | null;
    validXp: number;
  };
  'approval.decided': DomainEventBase & {
    approvalId: string;
    entityType: string;
    entityId: string;
    status: string;
    requiredRoleCode: string;
    overridden: boolean;
  };
  'decision.resolved': DomainEventBase & {
    decisionId: string;
    title: string;
    tier: string;
    status: string;
    linkedTaskId: string | null;
  };
  'coupon.redeemed': DomainEventBase & {
    couponId: string;
    code: string;
    orderId: string;
    amount: string;
  };
}

/**
 * Compile-time proof that the payload map and the name registry describe the
 * same set of events, in both directions: adding a `DomainEvent` entry without
 * a payload (or a payload without an entry) fails `tsc`, not a code review.
 */
type AssertSameKeys<A extends PropertyKey, B extends PropertyKey> = [
  Exclude<A, B>,
] extends [never]
  ? [Exclude<B, A>] extends [never]
    ? true
    : never
  : never;

const _payloadsMatchRegistry: AssertSameKeys<
  keyof DomainEventPayloads,
  DomainEventName
> = true;
void _payloadsMatchRegistry;

/** The payload type for a given event name. */
export type DomainEventPayload<K extends DomainEventName> =
  DomainEventPayloads[K];

// ─── Emit ────────────────────────────────────────────────────────────────────

const logger = new Logger('DomainEvents');

/**
 * Fire a domain event after the transaction has committed. Never throws:
 * a listener failure is logged and swallowed (SPEC §4.1 "failure-isolated").
 */
export function emitDomainEvent<K extends DomainEventName>(
  emitter: Pick<EventEmitter2, 'emit'>,
  name: K,
  payload: DomainEventPayloads[K],
): void {
  try {
    emitter.emit(name, payload);
  } catch (err) {
    logger.warn(`domain event ${name} failed to dispatch: ${String(err)}`);
  }
}

/** Convenience for the `{ node_id, actor, occurred_at }` prefix every payload carries. */
export function domainEventBase(
  nodeId: string,
  actor: DomainEventActor,
  occurredAt: Date = new Date(),
): DomainEventBase {
  return {
    node_id: nodeId,
    actor,
    occurred_at: occurredAt.toISOString(),
  };
}
