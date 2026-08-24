import { TaskSubjectType } from '@prisma/client';
import {
  DomainEvent,
  type DomainEventName,
  type DomainEventPayloads,
} from '../common/events/domain-events';

/**
 * Meter codes the rules target (SPEC §4.3) — the four `derived` meters, kept as
 * a runtime tuple so `mission-bridge.rules.spec.ts` can check the table against
 * `DERIVED_FORMULAS` instead of trusting a hand-written union.
 */
export const METER_CODES = [
  'STANDARDIZATION',
  'PROCUREMENT',
  'SALES',
  'QUALITY',
] as const;

export type MeterCode = (typeof METER_CODES)[number];

/** SPEC §4.2 "task spawn". Only `feedback.received` uses one today. */
export type BridgeSpawn = 'low_rating_improvement';

/**
 * SPEC §4.2 "signal" — the meter a rule contributes to and the size of the
 * contribution. `value` is written verbatim into `ReadinessSignal.value`
 * (`Decimal(14,4)`); negative values record a regression (stock ran low, a
 * recipe was archived, waste was logged).
 */
export interface BridgeSignal {
  meter: MeterCode;
  value: number;
}

/** What a rule pulls out of its typed payload for the bridge to act on. */
export interface BridgeSelection {
  subject_id: string;
  /** Set when the source row carries an explicit `linked_task_id` (PO/Decision). */
  explicit_task_id?: string | null;
  /** Fields surfaced in `note_template`; missing keys render as an em-dash. */
  values: Record<string, string | number | null | undefined>;
}

/**
 * SPEC §4.2 — one declarative row per (event → bridge action). Rules are typed
 * and reviewed in PRs; the bridge itself has no per-event branching.
 */
export interface BridgeRuleFor<K extends DomainEventName> {
  /** Stable identity for `BridgeDispatch.rule_key` — never renamed once shipped. */
  key: string;
  event: K;
  subject_type: TaskSubjectType;
  select: (payload: DomainEventPayloads[K]) => BridgeSelection;
  /** SPEC §4.2 "evidence" — rendered into `Evidence.notes`. */
  note_template: string;
  evidence: boolean;
  /** SPEC §4.2 "signal" — meter and contribution value; omit for no signal. */
  signal?: BridgeSignal;
  /** SPEC §4.2 "task spawn" — the improvement task the rule creates, if any. */
  spawn?: BridgeSpawn;
  /** 'P3' = an emitter exists in this phase; 'P5' = declared, wired in Phase 33. */
  emitter: 'P3' | 'P5';
}

/**
 * The event generic erased, so `BRIDGE_RULES` has one element type. `select`
 * widens to `any` here only — inside `defineRule` the payload is fully typed,
 * which is what stops a rule from reading a field the event does not carry.
 */
export type BridgeRule = Omit<BridgeRuleFor<DomainEventName>, 'select'> & {
  select: (payload: any) => BridgeSelection;
};

/** Preserves per-event payload inference inside the table literal. */
const defineRule = <K extends DomainEventName>(
  rule: BridgeRuleFor<K>,
): BridgeRule => rule as BridgeRule;

export const BRIDGE_RULES: BridgeRule[] = [
  defineRule({
    key: 'recipe_approved_v1',
    event: DomainEvent.RECIPE_APPROVED,
    subject_type: TaskSubjectType.recipe,
    select: (p) => ({
      subject_id: p.recipeId,
      values: { name: p.name, version: p.version, cost: p.computedCost },
    }),
    note_template:
      'Recipe "{name}" v{version} approved (computed cost {cost}).',
    evidence: true,
    signal: { meter: 'STANDARDIZATION', value: 1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'recipe_archived_v1',
    event: DomainEvent.RECIPE_ARCHIVED,
    subject_type: TaskSubjectType.recipe,
    select: (p) => ({
      subject_id: p.recipeId,
      values: { name: p.name, version: p.version },
    }),
    note_template: 'Recipe "{name}" v{version} archived.',
    evidence: true,
    signal: { meter: 'STANDARDIZATION', value: -1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'purchase_order_received_v1',
    event: DomainEvent.PURCHASE_ORDER_RECEIVED,
    subject_type: TaskSubjectType.purchase_order,
    select: (p) => ({
      subject_id: p.purchaseOrderId,
      explicit_task_id: p.linkedTaskId,
      values: {
        vendor: p.vendorName,
        lines: p.lineCount,
        total: p.totalAmount,
      },
    }),
    note_template:
      'Purchase order received from {vendor} — {lines} line(s), total {total}.',
    evidence: true,
    signal: { meter: 'PROCUREMENT', value: 1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'vendor_price_updated_v1',
    event: DomainEvent.VENDOR_PRICE_UPDATED,
    subject_type: TaskSubjectType.vendor,
    select: (p) => ({
      subject_id: p.vendorId,
      values: { ingredient: p.ingredientName, price: p.price, unit: p.unit },
    }),
    note_template: 'Vendor price for {ingredient} set to {price} per {unit}.',
    evidence: true,
    signal: { meter: 'PROCUREMENT', value: 1 },
    emitter: 'P3',
  }),
  defineRule({
    // `evidence: false`, so the ingredient id never renders through
    // `bridgeDeepLink`; `vendor` is the procurement-facing subject bucket.
    key: 'stock_low_v1',
    event: DomainEvent.STOCK_LOW,
    subject_type: TaskSubjectType.vendor,
    select: (p) => ({
      subject_id: p.ingredientId,
      values: { name: p.ingredientName, qty: p.currentQty, min: p.minQty },
    }),
    note_template: 'Stock for {name} fell to {qty} (minimum {min}).',
    evidence: false,
    signal: { meter: 'PROCUREMENT', value: -1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'prep_batch_created_v1',
    event: DomainEvent.PREP_BATCH_CREATED,
    subject_type: TaskSubjectType.prep_batch,
    select: (p) => ({
      subject_id: p.prepBatchId,
      values: {
        recipe: p.recipeName,
        qty: p.quantityProduced,
        unit: p.unit,
      },
    }),
    note_template: 'Prep batch of {recipe} produced — {qty} {unit}.',
    evidence: true,
    signal: { meter: 'STANDARDIZATION', value: 1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'prep_batch_depleted_v1',
    event: DomainEvent.PREP_BATCH_DEPLETED,
    subject_type: TaskSubjectType.prep_batch,
    select: (p) => ({
      subject_id: p.prepBatchId,
      values: { recipe: p.recipeName },
    }),
    note_template: 'Prep batch of {recipe} fully depleted.',
    evidence: true,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'order_confirmed_v1',
    event: DomainEvent.ORDER_CONFIRMED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({
      subject_id: p.orderId,
      values: { number: p.orderNumber, channel: p.channel, total: p.total },
    }),
    note_template: 'Order #{number} confirmed on {channel} — {total}.',
    evidence: true,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'order_served_v1',
    event: DomainEvent.ORDER_SERVED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({
      subject_id: p.orderId,
      values: { number: p.orderNumber, channel: p.channel, total: p.total },
    }),
    note_template: 'Order #{number} served on {channel}.',
    evidence: false,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'order_delivered_v1',
    event: DomainEvent.ORDER_DELIVERED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({
      subject_id: p.orderId,
      values: { number: p.orderNumber, channel: p.channel, total: p.total },
    }),
    note_template: 'Order #{number} delivered.',
    evidence: false,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'waste_logged_v1',
    event: DomainEvent.WASTE_LOGGED,
    subject_type: TaskSubjectType.prep_batch,
    select: (p) => ({
      subject_id: p.prepBatchId ?? p.ingredientId ?? p.wasteLogId,
      values: { reason: p.reason, cost: p.costImpact },
    }),
    note_template: 'Waste logged ({reason}) — cost impact {cost}.',
    evidence: true,
    signal: { meter: 'QUALITY', value: -1 },
    emitter: 'P3',
  }),
  // ── feedback.received, split in two (P6 Task 13) ───────────────────────────
  //
  // The `BridgeDispatch` ledger is keyed on `(rule_key, source_type, source_id)`
  // and is the ONLY de-duplication the bridge has
  // (`mission-bridge.service.ts:400-405` says so explicitly). One rule selecting
  // `p.orderId ?? p.feedbackId` silently degrades "once per order" into "once
  // per feedback": two low ratings on the same order — one carrying an order id,
  // one not — key differently and spawn two improvement tasks for one problem.
  //
  // The split is two rules rather than a branch inside `select` because
  // `subject_type` is declared at the rule level, not returned by `select`, and
  // widening `defineRule` to allow a per-event override is out of scope. A
  // `TaskSubjectType.feedback` member would be the honest subject type for the
  // standalone case, but adding an enum member is a schema change this task does
  // not own — so the standalone rule keeps `order` (exactly the subject type an
  // order-less feedback already carried before P6, deep link included) and takes
  // its key separation from `rule_key` instead.
  //
  // `applyOne` skips any rule whose `select` returns an empty subject id, so the
  // two rules are discriminated on `p.orderId` with no new machinery.
  defineRule({
    key: 'feedback_received_order_v1',
    event: DomainEvent.FEEDBACK_RECEIVED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({
      subject_id: p.orderId ?? '',
      values: { rating: p.rating, comment: p.comment },
    }),
    note_template: 'Guest feedback received — {rating}/5. "{comment}"',
    evidence: true,
    signal: { meter: 'QUALITY', value: 1 },
    spawn: 'low_rating_improvement',
    emitter: 'P3',
  }),
  defineRule({
    key: 'feedback_received_standalone_v1',
    event: DomainEvent.FEEDBACK_RECEIVED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({
      // Feedback with no order has no order to be idempotent about, so the
      // feedback id is the right key here — it is only the *wrong* key when an
      // order id exists, which is precisely the case the sibling rule owns.
      subject_id: p.orderId ? '' : p.feedbackId,
      values: { rating: p.rating, comment: p.comment },
    }),
    note_template: 'Guest feedback received — {rating}/5. "{comment}"',
    evidence: true,
    signal: { meter: 'QUALITY', value: 1 },
    spawn: 'low_rating_improvement',
    emitter: 'P3',
  }),
  defineRule({
    key: 'product_published_v1',
    event: DomainEvent.PRODUCT_PUBLISHED,
    subject_type: TaskSubjectType.product,
    select: (p) => ({
      subject_id: p.productId,
      values: { name: p.name, type: p.type },
    }),
    note_template: 'Product "{name}" ({type}) published to the catalog.',
    evidence: true,
    signal: { meter: 'STANDARDIZATION', value: 1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'event_completed_v1',
    event: DomainEvent.EVENT_COMPLETED,
    subject_type: TaskSubjectType.event,
    select: (p) => ({
      subject_id: p.eventId,
      values: { title: p.title, attended: p.attendedCount },
    }),
    note_template:
      'Experience "{title}" completed — {attended} guest(s) attended.',
    evidence: true,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P3',
  }),
  defineRule({
    key: 'decision_resolved_v1',
    event: DomainEvent.DECISION_RESOLVED,
    subject_type: TaskSubjectType.decision,
    select: (p) => ({
      subject_id: p.decisionId,
      explicit_task_id: p.linkedTaskId,
      values: { title: p.title, status: p.status, tier: p.tier },
    }),
    note_template: 'Decision "{title}" ({tier}) resolved as {status}.',
    evidence: true,
    emitter: 'P3',
  }),
  defineRule({
    key: 'approval_decided_v1',
    event: DomainEvent.APPROVAL_DECIDED,
    subject_type: TaskSubjectType.decision,
    select: (p) => ({
      subject_id: p.entityId,
      values: { role: p.requiredRoleCode, status: p.status },
    }),
    note_template: 'Approval by {role} recorded as {status}.',
    evidence: false,
    emitter: 'P3',
  }),
  // ── Declared for Phase 33 (P5); no emitter exists yet (P3 decision 13). ────
  defineRule({
    key: 'booking_attended_v1',
    event: DomainEvent.BOOKING_ATTENDED,
    subject_type: TaskSubjectType.event,
    select: (p) => ({ subject_id: p.eventId, values: { guests: p.guests } }),
    note_template: 'Booking attended — {guests} guest(s).',
    evidence: true,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P5',
  }),
  defineRule({
    key: 'shipment_delivered_v1',
    event: DomainEvent.SHIPMENT_DELIVERED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({ subject_id: p.orderId, values: { awb: p.awb } }),
    note_template: 'Shipment delivered (AWB {awb}).',
    evidence: true,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P5',
  }),
  defineRule({
    key: 'review_published_v1',
    event: DomainEvent.REVIEW_PUBLISHED,
    subject_type: TaskSubjectType.product,
    select: (p) => ({ subject_id: p.productId, values: { rating: p.rating } }),
    note_template: 'Review published — {rating}/5.',
    evidence: false,
    signal: { meter: 'QUALITY', value: 1 },
    emitter: 'P5',
  }),
  defineRule({
    key: 'coupon_redeemed_v1',
    event: DomainEvent.COUPON_REDEEMED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({
      subject_id: p.orderId,
      values: { code: p.code, amount: p.amount },
    }),
    note_template: 'Coupon {code} redeemed for {amount}.',
    evidence: false,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P5',
  }),
  defineRule({
    key: 'shipment_status_changed_v1',
    event: DomainEvent.SHIPMENT_STATUS_CHANGED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({
      subject_id: p.orderId,
      values: { status: p.status, awb: p.awb },
    }),
    note_template: 'Shipment status changed to {status} (AWB {awb}).',
    evidence: false,
    emitter: 'P5',
  }),
];

/** Rules the `MissionBridgeListener` subscribes to in this phase. */
export const P3_RULES: BridgeRule[] = BRIDGE_RULES.filter(
  (rule) => rule.emitter === 'P3',
);

export const RULES_BY_EVENT: ReadonlyMap<DomainEventName, BridgeRule[]> =
  BRIDGE_RULES.reduce((acc, rule) => {
    const list = acc.get(rule.event) ?? [];
    list.push(rule);
    acc.set(rule.event, list);
    return acc;
  }, new Map<DomainEventName, BridgeRule[]>());
