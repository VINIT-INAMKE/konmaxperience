import { TaskSubjectType } from '@prisma/client';
import {
  BRIDGE_RULES,
  METER_CODES,
  P3_RULES,
  RULES_BY_EVENT,
} from './mission-bridge.rules';
import { renderBridgeNote } from './bridge-links';
import { DERIVED_FORMULAS } from '../readiness/derivation/derived-meters';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import {
  DomainEvent,
  domainEventBase,
  systemActor,
  type DomainEventName,
  type DomainEventPayloads,
} from '../common/events/domain-events';

/**
 * The rule table is data, so its invariants are only enforceable at runtime:
 * a duplicate `key` silently breaks the dispatch ledger's unique index, a
 * `select` that reads a field its payload does not carry returns `undefined`
 * and quietly disables the rule, and a `note_template` placeholder with no
 * matching value renders an em-dash in front of a human. Each of those is a
 * test here rather than a production incident.
 */

const base = () => domainEventBase(DEFAULT_NODE_ID, systemActor());

/**
 * One representative payload per event the table names. Typed per key, so a
 * payload-shape change in `domain-events.ts` fails `tsc` here first.
 */
const PAYLOADS: { [K in DomainEventName]?: DomainEventPayloads[K] } = {
  [DomainEvent.RECIPE_APPROVED]: {
    ...base(),
    recipeId: 'rec-1',
    name: 'Masala Chai',
    version: 2,
    computedCost: '42.50',
  },
  [DomainEvent.RECIPE_ARCHIVED]: {
    ...base(),
    recipeId: 'rec-1',
    name: 'Masala Chai',
    version: 2,
  },
  [DomainEvent.PURCHASE_ORDER_RECEIVED]: {
    ...base(),
    purchaseOrderId: 'po-1',
    vendorId: 'v-1',
    vendorName: 'Acme Provisions',
    linkedTaskId: 'task-po',
    lineCount: 3,
    totalAmount: '1200.00',
    fullyReceived: true,
  },
  [DomainEvent.VENDOR_PRICE_UPDATED]: {
    ...base(),
    vendorPriceId: 'vp-1',
    vendorId: 'v-1',
    ingredientId: 'ing-1',
    ingredientName: 'Cardamom',
    price: '900.00',
    unit: 'kg',
  },
  [DomainEvent.STOCK_LOW]: {
    ...base(),
    ingredientId: 'ing-1',
    ingredientName: 'Cardamom',
    currentQty: 2,
    minQty: 10,
    unit: 'kg',
    zoneId: 'zone-1',
  },
  [DomainEvent.PREP_BATCH_CREATED]: {
    ...base(),
    prepBatchId: 'pb-1',
    recipeId: 'rec-1',
    recipeName: 'Masala Chai',
    zoneId: 'zone-1',
    quantityProduced: '20.000',
    unit: 'l',
  },
  [DomainEvent.PREP_BATCH_DEPLETED]: {
    ...base(),
    prepBatchId: 'pb-1',
    recipeId: 'rec-1',
    recipeName: 'Masala Chai',
    zoneId: 'zone-1',
  },
  [DomainEvent.ORDER_CONFIRMED]: {
    ...base(),
    orderId: 'ord-1',
    orderNumber: 7,
    channel: 'dine_in',
    total: '450.00',
    itemCount: 2,
    customerId: null,
  },
  [DomainEvent.ORDER_SERVED]: {
    ...base(),
    orderId: 'ord-1',
    orderNumber: 7,
    channel: 'dine_in',
    total: '450.00',
  },
  [DomainEvent.ORDER_DELIVERED]: {
    ...base(),
    orderId: 'ord-1',
    orderNumber: 7,
    channel: 'marketplace',
    total: '450.00',
  },
  [DomainEvent.WASTE_LOGGED]: {
    ...base(),
    wasteLogId: 'wl-1',
    wasteType: 'spoilage',
    reason: 'left out overnight',
    costImpact: '180.00',
    zoneId: 'zone-1',
    ingredientId: 'ing-1',
    prepBatchId: 'pb-1',
  },
  [DomainEvent.FEEDBACK_RECEIVED]: {
    ...base(),
    feedbackId: 'fb-1',
    orderId: 'ord-1',
    rating: 2,
    comment: 'Cold and late.',
  },
  [DomainEvent.PRODUCT_PUBLISHED]: {
    ...base(),
    productId: 'prod-1',
    name: 'Chai Concentrate',
    slug: 'chai-concentrate',
    type: 'packaged',
  },
  [DomainEvent.EVENT_COMPLETED]: {
    ...base(),
    eventId: 'evt-1',
    title: 'Sunset Supper',
    attendedCount: 12,
  },
  [DomainEvent.DECISION_RESOLVED]: {
    ...base(),
    decisionId: 'dec-1',
    title: 'Switch dairy vendor',
    tier: 'tier_2',
    status: 'approved',
    linkedTaskId: 'task-dec',
  },
  [DomainEvent.APPROVAL_DECIDED]: {
    ...base(),
    approvalId: 'apr-1',
    entityType: 'task',
    entityId: 'task-1',
    status: 'approved',
    requiredRoleCode: 'BACKEND_LEAD',
    overridden: false,
  },
  [DomainEvent.BOOKING_ATTENDED]: {
    ...base(),
    bookingId: 'bk-1',
    eventId: 'evt-1',
    guests: 4,
  },
  [DomainEvent.SHIPMENT_DELIVERED]: {
    ...base(),
    shipmentId: 'shp-1',
    orderId: 'ord-1',
    awb: 'AWB123',
  },
  [DomainEvent.SHIPMENT_STATUS_CHANGED]: {
    ...base(),
    shipmentId: 'shp-1',
    orderId: 'ord-1',
    status: 'in_transit',
    awb: 'AWB123',
  },
  [DomainEvent.REVIEW_PUBLISHED]: {
    ...base(),
    reviewId: 'rev-1',
    productId: 'prod-1',
    rating: 5,
  },
  [DomainEvent.COUPON_REDEEMED]: {
    ...base(),
    couponId: 'cpn-1',
    code: 'WELCOME10',
    orderId: 'ord-1',
    amount: '100.00',
  },
};

/** `{placeholder}` names a `note_template` expects the `select` to produce. */
const placeholders = (template: string): string[] =>
  [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

/**
 * The five events with no emitter anywhere in `backend/src` (P3 decision 13).
 * Asserted as a literal list so shipping a P5 emitter forces this test — and
 * the rule's `emitter` field — to be updated together.
 */
const P5_EVENTS: DomainEventName[] = [
  DomainEvent.BOOKING_ATTENDED,
  DomainEvent.SHIPMENT_DELIVERED,
  DomainEvent.SHIPMENT_STATUS_CHANGED,
  DomainEvent.REVIEW_PUBLISHED,
  DomainEvent.COUPON_REDEEMED,
];

/**
 * A rule that owns only a slice of its event answers with an empty subject id
 * for the other slice — that is how `applyOne` skips it (P6 Task 13 split
 * `feedback.received` into an order rule and a standalone rule). The generic
 * assertions below therefore feed each such rule the payload it actually
 * applies to, rather than pretending one fixture fits every rule on an event.
 */
const RULE_PAYLOADS: Record<string, DomainEventPayloads[DomainEventName]> = {
  feedback_received_standalone_v1: {
    ...PAYLOADS[DomainEvent.FEEDBACK_RECEIVED]!,
    orderId: null,
  },
};

const payloadFor = (rule: { key: string; event: DomainEventName }) =>
  RULE_PAYLOADS[rule.key] ?? PAYLOADS[rule.event];

describe('BRIDGE_RULES', () => {
  it('keeps every rule key unique — the ledger index depends on it', () => {
    const keys = BRIDGE_RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('names only events that exist in the DomainEvent registry', () => {
    const known = new Set<string>(Object.values(DomainEvent));
    for (const rule of BRIDGE_RULES) {
      expect(known.has(rule.event)).toBe(true);
    }
  });

  it('names only subject types the deep-link table can render', () => {
    const subjects = new Set<string>(Object.values(TaskSubjectType));
    for (const rule of BRIDGE_RULES) {
      expect(subjects.has(rule.subject_type)).toBe(true);
    }
  });

  it('gives every evidence-writing rule a non-empty note template', () => {
    for (const rule of BRIDGE_RULES) {
      if (!rule.evidence) continue;
      expect(rule.note_template.trim().length).toBeGreaterThan(0);
    }
  });

  it('targets only the four derived meter codes', () => {
    const meters = new Set<string>(METER_CODES);
    for (const rule of BRIDGE_RULES) {
      if (!rule.signal) continue;
      expect(meters.has(rule.signal.meter)).toBe(true);
      expect(Number.isFinite(rule.signal.value)).toBe(true);
      expect(rule.signal.value).not.toBe(0);
    }
  });

  it('keeps METER_CODES in step with the seeded derived formulas', () => {
    expect([...METER_CODES].sort()).toEqual(
      [...new Set(Object.values(DERIVED_FORMULAS))].sort(),
    );
  });

  it('has a payload fixture for every event it names', () => {
    for (const rule of BRIDGE_RULES) {
      expect(PAYLOADS[rule.event]).toBeDefined();
    }
  });

  it('selects a subject id from a representative payload for every rule', () => {
    for (const rule of BRIDGE_RULES) {
      const picked = rule.select(payloadFor(rule));
      expect(typeof picked.subject_id).toBe('string');
      expect(picked.subject_id.length).toBeGreaterThan(0);
    }
  });

  it('produces a value for every placeholder its note template uses', () => {
    for (const rule of BRIDGE_RULES) {
      const picked = rule.select(payloadFor(rule));
      for (const key of placeholders(rule.note_template)) {
        // A key the select never produces renders as an em-dash in front of a
        // human, so the miss has to fail here instead.
        expect(Object.keys(picked.values)).toContain(key);
        expect(picked.values[key]).toBeDefined();
      }
      // …and the rendered note keeps no unresolved `{placeholder}` behind.
      expect(renderBridgeNote(rule.note_template, picked.values)).not.toMatch(
        /\{\w+\}/,
      );
    }
  });

  it('falls back down the waste subject chain when no prep batch is named', () => {
    const rule = BRIDGE_RULES.find((r) => r.key === 'waste_logged_v1')!;
    const payload = PAYLOADS[DomainEvent.WASTE_LOGGED]!;

    expect(rule.select({ ...payload, prepBatchId: null }).subject_id).toBe(
      'ing-1',
    );
    expect(
      rule.select({ ...payload, prepBatchId: null, ingredientId: null })
        .subject_id,
    ).toBe('wl-1');
  });

  // P6 Task 13. `BridgeDispatch @@unique([rule_key, source_type, source_id])`
  // is the bridge's only de-duplication, so `orderId ?? feedbackId` on one rule
  // meant two low ratings on one order spawned two improvement tasks whenever
  // one of them arrived without an order id.
  describe('feedback.received keying', () => {
    const orderRule = BRIDGE_RULES.find(
      (r) => r.key === 'feedback_received_order_v1',
    )!;
    const standaloneRule = BRIDGE_RULES.find(
      (r) => r.key === 'feedback_received_standalone_v1',
    )!;
    const payload = PAYLOADS[DomainEvent.FEEDBACK_RECEIVED]!;

    it('keys an order-carrying feedback on the order, never the feedback', () => {
      expect(orderRule.select(payload).subject_id).toBe('ord-1');
      expect(
        orderRule.select({ ...payload, feedbackId: 'fb-2' }).subject_id,
      ).toBe('ord-1');
    });

    it('stands the order rule down when the guest order is unknown', () => {
      expect(orderRule.select({ ...payload, orderId: null }).subject_id).toBe(
        '',
      );
    });

    it('keys an order-less feedback on the feedback id', () => {
      expect(
        standaloneRule.select({ ...payload, orderId: null }).subject_id,
      ).toBe('fb-1');
      expect(
        standaloneRule.select({
          ...payload,
          orderId: null,
          feedbackId: 'fb-2',
        }).subject_id,
      ).toBe('fb-2');
    });

    it('stands the standalone rule down whenever an order id exists', () => {
      expect(standaloneRule.select(payload).subject_id).toBe('');
    });

    it('never lets both rules claim the same event', () => {
      for (const p of [payload, { ...payload, orderId: null }]) {
        const claimed = [orderRule, standaloneRule].filter(
          (r) => r.select(p).subject_id !== '',
        );
        expect(claimed).toHaveLength(1);
      }
    });
  });

  it('spawns only from feedback, once per order and once per order-less guest', () => {
    const spawning = BRIDGE_RULES.filter((r) => r.spawn);
    expect(spawning.map((r) => r.key).sort()).toEqual([
      'feedback_received_order_v1',
      'feedback_received_standalone_v1',
    ]);
    for (const rule of spawning) {
      expect(rule.event).toBe(DomainEvent.FEEDBACK_RECEIVED);
      expect(rule.spawn).toBe('low_rating_improvement');
    }
  });
});

describe('RULES_BY_EVENT', () => {
  it('indexes every rule under its own event', () => {
    const indexed = [...RULES_BY_EVENT.values()].flat();
    expect(indexed).toHaveLength(BRIDGE_RULES.length);
    for (const [event, rules] of RULES_BY_EVENT) {
      for (const rule of rules) expect(rule.event).toBe(event);
    }
  });

  it('has one entry per distinct event', () => {
    expect(RULES_BY_EVENT.size).toBe(
      new Set(BRIDGE_RULES.map((r) => r.event)).size,
    );
  });
});

describe('emitter phases', () => {
  it('marks exactly the five events with no P3 emitter as P5', () => {
    const p5 = BRIDGE_RULES.filter((r) => r.emitter === 'P5');
    expect(p5).toHaveLength(5);
    expect([...p5.map((r) => r.event)].sort()).toEqual([...P5_EVENTS].sort());
  });

  it('splits the table cleanly into the P3 subscription set and the rest', () => {
    expect(P3_RULES).toHaveLength(BRIDGE_RULES.length - 5);
    for (const rule of P3_RULES) {
      expect(P5_EVENTS).not.toContain(rule.event);
    }
  });
});
