import { Logger } from '@nestjs/common';
import {
  DomainEvent,
  DomainEventName,
  DomainEventPayloads,
  customerActor,
  domainEventBase,
  emitDomainEvent,
  systemActor,
  userActor,
} from './domain-events';

/**
 * Compile-time exhaustiveness: this object must name every `DomainEvent` value
 * exactly once. A registry entry with no payload (or a payload with no registry
 * entry) makes `tsc` fail here before the runtime assertions below ever run.
 */
const EVERY_EVENT = {
  'order.placed': true,
  'order.ready': true,
  'delivery.updated': true,
  'stock.low': true,
  'task.blocked': true,
  'recipe.approved': true,
  'recipe.archived': true,
  'purchase_order.received': true,
  'prep_batch.created': true,
  'prep_batch.depleted': true,
  'order.confirmed': true,
  'order.served': true,
  'order.delivered': true,
  'shipment.status_changed': true,
  'shipment.delivered': true,
  'waste.logged': true,
  'event.completed': true,
  'booking.attended': true,
  'feedback.received': true,
  'review.published': true,
  'product.published': true,
  'vendor_price.updated': true,
  'task.validated': true,
  'approval.decided': true,
  'decision.resolved': true,
  'coupon.redeemed': true,
} satisfies Record<DomainEventName, true> &
  Record<keyof DomainEventPayloads, true>;

describe('domain-events catalogue (SPEC §4.1)', () => {
  describe('DomainEvent registry', () => {
    it('declares exactly 26 events with unique dotted names', () => {
      const values = Object.values(DomainEvent);
      expect(values).toHaveLength(26);
      expect(new Set(values).size).toBe(26);
      for (const name of values) {
        expect(name).toMatch(/^[a-z_]+\.[a-z_]+$/);
      }
    });

    it('keeps the five v1 event names unchanged so listeners keep working', () => {
      expect(DomainEvent.ORDER_PLACED).toBe('order.placed');
      expect(DomainEvent.ORDER_READY).toBe('order.ready');
      expect(DomainEvent.DELIVERY_UPDATED).toBe('delivery.updated');
      expect(DomainEvent.STOCK_LOW).toBe('stock.low');
      expect(DomainEvent.TASK_BLOCKED).toBe('task.blocked');
    });

    it('declares the 21 events SPEC §4.1 adds', () => {
      const names: DomainEventName[] = Object.values(DomainEvent);
      expect(names).toContain('recipe.approved');
      expect(names).toContain('recipe.archived');
      expect(names).toContain('purchase_order.received');
      expect(names).toContain('prep_batch.created');
      expect(names).toContain('prep_batch.depleted');
      expect(names).toContain('order.confirmed');
      expect(names).toContain('order.served');
      expect(names).toContain('order.delivered');
      expect(names).toContain('shipment.status_changed');
      expect(names).toContain('shipment.delivered');
      expect(names).toContain('waste.logged');
      expect(names).toContain('event.completed');
      expect(names).toContain('booking.attended');
      expect(names).toContain('feedback.received');
      expect(names).toContain('review.published');
      expect(names).toContain('product.published');
      expect(names).toContain('vendor_price.updated');
      expect(names).toContain('task.validated');
      expect(names).toContain('approval.decided');
      expect(names).toContain('decision.resolved');
      expect(names).toContain('coupon.redeemed');
    });

    it('has a payload declared for every registry value and nothing else', () => {
      const names: DomainEventName[] = Object.values(DomainEvent);
      const payloadKeys = Object.keys(EVERY_EVENT).sort();
      expect(payloadKeys).toEqual([...names].sort());
    });
  });

  describe('emitDomainEvent', () => {
    it('calls emitter.emit once with (name, payload)', () => {
      const emit = jest.fn();
      const payload: DomainEventPayloads['task.blocked'] = {
        ...domainEventBase('node-1', systemActor()),
        taskId: 't1',
        taskTitle: 'Ship the bridge',
        ownerUserId: 'u1',
        blockedReason: null,
      };

      emitDomainEvent({ emit }, DomainEvent.TASK_BLOCKED, payload);

      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith('task.blocked', payload);
    });

    it('swallows and logs a listener failure instead of failing the write', () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const emit = jest.fn(() => {
        throw new Error('boom');
      });

      const result = emitDomainEvent({ emit }, DomainEvent.STOCK_LOW, {
        ...domainEventBase('node-1', systemActor()),
        ingredientId: 'i1',
        ingredientName: 'Tomato',
        currentQty: 1,
        minQty: 5,
        unit: 'kg',
        zoneId: 'z1',
      });

      expect(result).toBeUndefined();
      expect(emit).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('stock.low'));
      warn.mockRestore();
    });
  });

  describe('actor helpers', () => {
    it('maps a user id to a user actor', () => {
      expect(userActor('u1')).toEqual({ actor_type: 'user', actor_id: 'u1' });
    });

    it('falls back to the system actor when there is no user', () => {
      expect(userActor(null)).toEqual({
        actor_type: 'system',
        actor_id: null,
      });
      expect(userActor(undefined)).toEqual({
        actor_type: 'system',
        actor_id: null,
      });
      expect(userActor('')).toEqual({ actor_type: 'system', actor_id: null });
    });

    it('maps a customer id to a customer actor', () => {
      expect(customerActor('c1')).toEqual({
        actor_type: 'customer',
        actor_id: 'c1',
      });
    });

    it('builds a system actor with a null id', () => {
      expect(systemActor()).toEqual({ actor_type: 'system', actor_id: null });
    });
  });

  describe('domainEventBase', () => {
    it('serialises occurred_at as an ISO-8601 UTC instant', () => {
      const base = domainEventBase(
        'n1',
        systemActor(),
        new Date('2026-08-23T10:00:00Z'),
      );

      expect(base).toEqual({
        node_id: 'n1',
        actor: { actor_type: 'system', actor_id: null },
        occurred_at: '2026-08-23T10:00:00.000Z',
      });
    });

    it('defaults occurred_at to now', () => {
      const before = Date.now();
      const base = domainEventBase('n1', userActor('u1'));
      const after = Date.now();

      const at = Date.parse(base.occurred_at);
      expect(at).toBeGreaterThanOrEqual(before);
      expect(at).toBeLessThanOrEqual(after);
      expect(base.actor).toEqual({ actor_type: 'user', actor_id: 'u1' });
    });
  });
});
