import { NotificationType } from '@prisma/client';
import {
  WHATSAPP_TEMPLATES,
  WhatsAppTemplateSpec,
  TemplateContext,
} from './notification-templates';

/** The context each registered type's call site actually supplies. */
const DOCUMENTED_CONTEXT: Record<string, TemplateContext> = {
  approval_pending: { subject: 'Prep the Sunday menu', hours: 26 },
  task_blocked: { subject: 'Order paneer', reason: 'Vendor unreachable' },
  low_stock: { subject: 'Paneer', onHand: '2 kg', minimum: '5 kg' },
  shipment_failed: { subject: 'Order #4F21A0', status: 'rto' },
  morning_brief: { headline: 'Yesterday closed clean.' },
};

/** The registry is `Partial<Record<…>>`, so narrow away the `undefined` slot. */
const entries = Object.entries(WHATSAPP_TEMPLATES).filter(
  (entry): entry is [string, WhatsAppTemplateSpec] => entry[1] !== undefined,
);

describe('WHATSAPP_TEMPLATES', () => {
  it('registers at least the five RUN-01/RUN-05 templates', () => {
    expect(entries.length).toBeGreaterThanOrEqual(5);
  });

  it('keys only on real NotificationType members', () => {
    const types = Object.values(NotificationType) as string[];
    for (const [key] of entries) expect(types).toContain(key);
  });

  it('registers each Meta template name exactly once', () => {
    const names = entries.map(([, spec]) => spec.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('names every template in the reviewed staff_ namespace', () => {
    for (const [, spec] of entries) {
      expect(spec.name).toMatch(/^staff_[a-z_]+$/);
    }
  });

  it.each(entries.map(([key]) => key))(
    'returns non-empty positional params for %s',
    (key) => {
      const spec = WHATSAPP_TEMPLATES[key as NotificationType]!;
      const params = spec.params(DOCUMENTED_CONTEXT[key]);
      expect(Array.isArray(params)).toBe(true);
      expect(params.length).toBe(spec.contextKeys.length);
      for (const p of params) {
        expect(typeof p).toBe('string');
        expect(p.length).toBeGreaterThan(0);
      }
    },
  );

  // Meta rejects an empty positional param outright, so a call site that
  // forgets a key must still produce a sendable message rather than a 400 the
  // dispatcher can only log.
  it.each(entries.map(([key]) => key))(
    'substitutes a non-empty fallback for a missing context on %s',
    (key) => {
      const spec = WHATSAPP_TEMPLATES[key as NotificationType]!;
      const params = spec.params({});
      expect(params.length).toBe(spec.contextKeys.length);
      for (const p of params) expect(p.length).toBeGreaterThan(0);
    },
  );

  it('coerces numeric context to strings', () => {
    const params = WHATSAPP_TEMPLATES[
      NotificationType.approval_pending
    ]!.params({
      subject: 'Prep the Sunday menu',
      hours: 26,
    });
    expect(params).toEqual(['Prep the Sunday menu', '26']);
  });

  it('leaves the per-event types unregistered — they are in-app only', () => {
    for (const type of [
      NotificationType.new_order,
      NotificationType.order_ready,
      NotificationType.delivery_update,
      NotificationType.admin_notice,
    ]) {
      expect(WHATSAPP_TEMPLATES[type]).toBeUndefined();
    }
  });
});
