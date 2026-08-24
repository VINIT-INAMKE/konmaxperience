import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { MorningBriefCron } from './morning-brief.cron';
import type { MorningBriefService } from './morning-brief.service';
import { ADVISORY_LOCK } from '../../common/utils/advisory-lock';
import { DEFAULT_NODE_TIMEZONE } from '../../node/node.constants';
import { mockPrisma, type MockPrisma } from '../../test-utils/mock-providers';

const DAY = '2026-08-24';

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

function buildBrief(overrides: Record<string, unknown> = {}) {
  return {
    enabled: jest.fn().mockResolvedValue(true),
    previousBusinessDate: jest.fn().mockResolvedValue(DAY),
    generateAndDeliver: jest.fn().mockResolvedValue({
      headline: 'Yesterday closed clean.',
      bullets: [],
      actions: [],
      provider: 'heuristic',
      model: null,
      latency_ms: 1,
      business_date: DAY,
      delivered_to: 2,
      recipients: 3,
      close_available: true,
    }),
    ...overrides,
  };
}

describe('MorningBriefCron (RUN-05 — 07:00, yesterday, once per cluster)', () => {
  let prisma: MockPrisma;
  let brief: ReturnType<typeof buildBrief>;
  let cron: MorningBriefCron;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockPrisma();
    advisoryLockRaw(prisma);
    brief = buildBrief();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    cron = new MorningBriefCron(
      prisma as never,
      brief as unknown as MorningBriefService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe('@Cron metadata', () => {
    it('runs at 07:00 in the node timezone — the moment quiet hours close', () => {
      const options = Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        MorningBriefCron.prototype.morningBrief,
      ) as { cronTime: string; timeZone: string };

      expect(options.cronTime).toBe('0 7 * * *');
      expect(options.timeZone).toBe(DEFAULT_NODE_TIMEZONE);
    });
  });

  describe('briefYesterday', () => {
    it('computes yesterday and delivers that day', async () => {
      const now = new Date('2026-08-25T01:30:00.000Z');

      const result = await cron.briefYesterday(now);

      expect(brief.previousBusinessDate).toHaveBeenCalledWith(now);
      expect(brief.generateAndDeliver).toHaveBeenCalledWith(DAY);
      expect(result.business_date).toBe(DAY);
    });
  });

  describe('morningBrief', () => {
    it('takes the reserved advisory lock and releases it', async () => {
      await cron.morningBrief();

      const statements = (
        prisma.$queryRaw.mock.calls as unknown as [
          { text: string; values: unknown[] },
        ][]
      ).map((call) => call[0].values[0]);
      expect(statements).toEqual([
        ADVISORY_LOCK.MORNING_BRIEF,
        ADVISORY_LOCK.MORNING_BRIEF,
      ]);
      expect(brief.generateAndDeliver).toHaveBeenCalledTimes(1);
    });

    it('short-circuits when another instance holds the lock', async () => {
      advisoryLockRaw(prisma, false);

      await cron.morningBrief();

      expect(brief.generateAndDeliver).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('lock held by another instance'),
      );
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('skips quietly — and without taking the lock — when disabled', async () => {
      brief.enabled.mockResolvedValue(false);

      await cron.morningBrief();

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(brief.generateAndDeliver).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('disabled in settings'),
      );
      // An operator's decision is not a failure.
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('logs what was delivered', async () => {
      await cron.morningBrief();

      expect(logSpy).toHaveBeenCalledWith(
        `Morning brief for ${DAY} delivered to 2/3 lead(s) via heuristic`,
      );
    });

    it('names the missing close in the log line', async () => {
      brief.generateAndDeliver.mockResolvedValue({
        provider: 'heuristic',
        business_date: DAY,
        delivered_to: 1,
        recipients: 1,
        close_available: false,
      });

      await cron.morningBrief();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('(no daily close for that date)'),
      );
    });

    it('never rejects — an unhandled rejection would take the process down', async () => {
      brief.generateAndDeliver.mockRejectedValue(
        new Error('provider exploded'),
      );

      await expect(cron.morningBrief()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('provider exploded'),
        expect.anything(),
      );
      // The lock is still released on the way out.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });
});
