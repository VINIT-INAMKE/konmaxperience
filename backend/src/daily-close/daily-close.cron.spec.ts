import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { DailyCloseStatus, NotificationType } from '@prisma/client';
import {
  DAILY_CLOSE_SCREEN_PATH,
  DailyCloseCron,
  previousDayKey,
} from './daily-close.cron';
import { ADVISORY_LOCK } from '../common/utils/advisory-lock';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import { SETTING_DEFAULTS } from '../settings/settings.service';
import {
  type MockPrisma,
  mockNodeService,
  mockPrisma,
  mockSettings,
} from '../test-utils/mock-providers';

/**
 * The nth argument of the nth call, typed. `jest.Mock['mock']['calls']` is
 * `any[][]`, so every direct index trips four `no-unsafe-*` rules; funnelling
 * them through one helper confines the cast to a single line (the idiom
 * `refunds.service.spec.ts` established).
 */
function callArg<T>(fn: jest.Mock, argIndex = 0, callIndex = 0): T {
  return fn.mock.calls[callIndex][argIndex] as T;
}

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const CLOSE_ID = 'close-1';

/**
 * 2026-08-24T19:15Z is 2026-08-25 00:45 in Asia/Kolkata — the instant the cron
 * actually fires. "Yesterday in node time" is therefore 2026-08-24, which is
 * *today* in UTC: the case that fails whenever a job forgets the node zone.
 */
const FIRED_AT = new Date('2026-08-24T19:15:00.000Z');
const BUSINESS_DATE = '2026-08-24';

/**
 * P6 (RUN-06) checks the unlock, so `withAdvisoryLock` issues *both* statements
 * through `$queryRaw`: the acquire reads `locked`, the release reads `released`.
 * Route by SQL text so a spec can still flip the acquire on its own.
 */
function advisoryLockRaw(prisma: MockPrisma, locked = true): void {
  prisma.$queryRaw.mockImplementation((sql: { text: string }) =>
    Promise.resolve(
      sql.text.includes('pg_advisory_unlock')
        ? [{ released: true }]
        : [{ locked }],
    ),
  );
}

function closeRow(over: Record<string, unknown> = {}) {
  return {
    id: CLOSE_ID,
    node_id: NODE_ID,
    business_date: new Date(`${BUSINESS_DATE}T00:00:00.000Z`),
    status: DailyCloseStatus.open,
    metrics: {},
    notes: null,
    signed_by: null,
    signed_at: null,
    created_at: FIRED_AT,
    updated_at: FIRED_AT,
    ...over,
  };
}

describe('DailyCloseCron', () => {
  let cron: DailyCloseCron;
  let prisma: MockPrisma;
  let dailyClose: { computeAndUpsert: jest.Mock };
  let notifications: { create: jest.Mock };
  let settings: ReturnType<typeof mockSettings>;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockPrisma();
    advisoryLockRaw(prisma);
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);

    dailyClose = {
      computeAndUpsert: jest.fn().mockResolvedValue(closeRow()),
    };
    notifications = { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) };
    settings = mockSettings();

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    cron = new DailyCloseCron(
      prisma as any,
      dailyClose as any,
      mockNodeService(NODE_ID) as any,
      settings as any,
      notifications as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('@Cron metadata', () => {
    it('runs at 00:45 in the node timezone, matching daily_close.compute_at', () => {
      const options = Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        DailyCloseCron.prototype.nightlyClose,
      ) as { cronTime: string; timeZone: string };

      expect(options.cronTime).toBe('45 0 * * *');
      expect(options.timeZone).toBe(DEFAULT_NODE_TIMEZONE);
      expect(SETTING_DEFAULTS.daily_close.compute_at).toBe('00:45');
    });

    it('uses the registry id reserved for the daily close, and no other job claims it', () => {
      expect(ADVISORY_LOCK.DAILY_CLOSE).toBe(6_350_002);
      expect(
        Object.values(ADVISORY_LOCK).filter(
          (id) => id === ADVISORY_LOCK.DAILY_CLOSE,
        ),
      ).toHaveLength(1);
    });
  });

  describe('previousDayKey', () => {
    it('walks back over a month boundary', () => {
      expect(previousDayKey('2026-09-01')).toBe('2026-08-31');
      expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
      expect(previousDayKey('2026-01-01')).toBe('2025-12-31');
    });
  });

  describe('advisory lock', () => {
    it('takes the lock and releases it', async () => {
      await cron.nightlyClose();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      const acquire = callArg<{ text: string; values: unknown[] }>(
        prisma.$queryRaw,
      );
      expect(acquire.values).toContain(ADVISORY_LOCK.DAILY_CLOSE);
      const release = callArg<{ text: string; values: unknown[] }>(
        prisma.$queryRaw,
        0,
        1,
      );
      expect(release.text).toContain('pg_advisory_unlock');
      expect(release.values).toContain(ADVISORY_LOCK.DAILY_CLOSE);
    });

    it('short-circuits with no compute when another instance holds the lock', async () => {
      advisoryLockRaw(prisma, false);

      await cron.nightlyClose();

      expect(dailyClose.computeAndUpsert).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
      // Only the acquire ran: releasing a lock this instance never took would
      // free it for whoever is actually holding it.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('lock held by another instance'),
      );
    });

    it('releases the lock and swallows the error when the close throws', async () => {
      dailyClose.computeAndUpsert.mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(cron.nightlyClose()).resolves.toBeUndefined();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(callArg<{ text: string }>(prisma.$queryRaw, 0, 1).text).toContain(
        'pg_advisory_unlock',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('connection reset'),
        expect.anything(),
      );
    });
  });

  describe('closeYesterday', () => {
    it('computes yesterday in node time, not today and not the UTC day', async () => {
      const result = await cron.closeYesterday(FIRED_AT);

      expect(dailyClose.computeAndUpsert).toHaveBeenCalledWith(BUSINESS_DATE);
      expect(result.business_date).toBe(BUSINESS_DATE);
      expect(result.close_id).toBe(CLOSE_ID);
    });

    it('still closes yesterday when the run happens later in the node day', async () => {
      await cron.closeYesterday(new Date('2026-08-25T09:00:00.000Z'));

      expect(dailyClose.computeAndUpsert).toHaveBeenCalledWith('2026-08-24');
    });

    it('writes one daily_close_due notification per signatory', async () => {
      const result = await cron.closeYesterday(FIRED_AT);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          role: {
            code: { in: SETTING_DEFAULTS.daily_close.signer_role_codes },
          },
        },
        select: { id: true },
      });
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          type: NotificationType.daily_close_due,
          // The close id, so the per-type cooldown keys on the day rather than
          // suppressing every future close after the first.
          reference_id: CLOSE_ID,
          reference_type: 'daily_close',
          link_url: `${DAILY_CLOSE_SCREEN_PATH}?date=${BUSINESS_DATE}`,
        }),
      );
      expect(result.notified).toBe(2);
    });

    it('does not nudge anyone about a day that is already signed', async () => {
      dailyClose.computeAndUpsert.mockResolvedValue(
        closeRow({ status: DailyCloseStatus.signed, signed_by: 'user-1' }),
      );

      const result = await cron.closeYesterday(FIRED_AT);

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
      expect(result.notified).toBe(0);
      expect(result.status).toBe(DailyCloseStatus.signed);
    });

    it('isolates a failed notification so the rest still land', async () => {
      notifications.create
        .mockRejectedValueOnce(new Error('pusher down'))
        .mockResolvedValueOnce({ id: 'notif-2' });

      const result = await cron.closeYesterday(FIRED_AT);

      expect(result.notified).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('pusher down'),
      );
    });

    it('writes nothing when no role is configured to sign', async () => {
      settings.get.mockResolvedValue({
        ...SETTING_DEFAULTS.daily_close,
        signer_role_codes: [],
      });

      const result = await cron.closeYesterday(FIRED_AT);

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(result.notified).toBe(0);
    });
  });
});
