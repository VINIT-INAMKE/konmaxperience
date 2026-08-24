import {
  DailyCloseStatus,
  NotificationType,
  PrismaClient,
} from '@prisma/client';
import type {
  DailyClose,
  EvidenceReviewSuggestion,
  User,
} from '@prisma/client';
import { SETTING_DEFAULTS } from '../settings/settings.service';

/**
 * The P5a `commerce-schema.spec.ts` pattern: assert the *generated client*
 * carries what P6 declared, so a schema edit that never reached
 * `prisma generate` fails here rather than three tasks later. Nothing in this
 * file opens a connection — the delegates are read off the client object and
 * the model shapes are checked at compile time.
 */
describe('P6 run-it schema', () => {
  const client = new PrismaClient() as unknown as Record<string, unknown>;

  it.each(['dailyClose', 'evidenceReviewSuggestion'])(
    'exposes the %s delegate',
    (delegate) => {
      expect(client[delegate]).toBeDefined();
    },
  );

  it('declares DailyCloseStatus with exactly open and signed', () => {
    expect(Object.values(DailyCloseStatus)).toEqual(['open', 'signed']);
  });

  it('adds the three P6 notification types', () => {
    expect(Object.values(NotificationType)).toEqual(
      expect.arrayContaining([
        'shipment_failed',
        'morning_brief',
        'daily_close_due',
      ]),
    );
  });

  it('keeps the eight P2-declared notification types intact', () => {
    expect(Object.values(NotificationType)).toEqual(
      expect.arrayContaining([
        'task_due',
        'task_blocked',
        'approval_pending',
        'low_stock',
        'new_order',
        'order_ready',
        'delivery_update',
        'admin_notice',
      ]),
    );
  });

  // The dispatcher keys its cooldown on `NotificationType`. A type named by
  // RUN-01/02/05 with no entry in `SETTING_DEFAULTS.notifications` would fall
  // back to "no cooldown" and re-nudge on every sweep.
  it.each([
    'approval_pending',
    'task_blocked',
    'low_stock',
    'shipment_failed',
    'morning_brief',
    'daily_close_due',
  ])('gives %s a positive cooldown in the notifications setting', (type) => {
    expect(Object.values(NotificationType)).toContain(type);
    const cooldowns: Record<string, number> =
      SETTING_DEFAULTS.notifications.cooldown_hours;
    expect(cooldowns[type]).toBeGreaterThan(0);
  });

  it('seeds the ai block on the keyless provider', () => {
    // Decision 1/2: a missing `ANTHROPIC_API_KEY` is a supported production
    // state, so the seeded default must be the provider that needs no key.
    expect(SETTING_DEFAULTS.ai.provider).toBe('heuristic');
    expect(
      SETTING_DEFAULTS.daily_close.signer_role_codes.length,
    ).toBeGreaterThan(0);
  });

  it('types User.phone as nullable and whatsapp_opt_in as boolean', () => {
    // Compile-time: nullable because staff without a handset are the norm, and
    // deliberately not unique (decision 8) — two staff may share one number.
    const staff: Pick<User, 'phone' | 'whatsapp_opt_in'> = {
      phone: null,
      whatsapp_opt_in: false,
    };
    expect(staff.phone).toBeNull();
    expect(staff.whatsapp_opt_in).toBe(false);
  });

  it('types DailyClose and EvidenceReviewSuggestion as declared', () => {
    // Compile-time: `metrics` is Json (frozen, never re-derived), `status` is
    // the enum, `verdict` is a plain string and NOT an `ApprovalStatus` — a
    // suggestion must never be assignable to a decision (SPEC §1.2).
    const close: Pick<DailyClose, 'status' | 'signed_by' | 'business_date'> = {
      status: DailyCloseStatus.open,
      signed_by: null,
      business_date: new Date('2026-08-23'),
    };
    const suggestion: Pick<
      EvidenceReviewSuggestion,
      'verdict' | 'provider' | 'model' | 'reasons' | 'latency_ms'
    > = {
      verdict: 'unsure',
      provider: 'heuristic',
      model: null,
      reasons: ['Not enough in the note to judge.'],
      latency_ms: 3,
    };
    expect(close.status).toBe('open');
    expect(suggestion.verdict).toBe('unsure');
  });

  // Deferred, deliberately: dropping the column breaks `notifications.service.ts`
  // and `notifications.processor.ts`, which this task does not own. The task that
  // removes those references drops the column and turns this into a real
  // assertion; the P6 migration carries the DROP either way (decision 10).
  it.todo(
    'drops Notification.is_email_sent once `channel` has its first writer',
  );

  afterAll(async () => {
    await (client as unknown as PrismaClient).$disconnect();
  });
});
