import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { BookingStatus } from '@prisma/client';
import {
  BOOKING_HOLD_SWEEP_LOCK_ID,
  EventHoldsCron,
  expiredHoldWhere,
} from './event-holds.cron';
import { ADVISORY_LOCK } from '../common/utils/advisory-lock';
import { LOYALTY_EXPIRY_LOCK_ID } from '../loyalty/loyalty.cron';
import { mockPrisma, type MockPrisma } from '../test-utils/mock-providers';

const NOW = new Date('2026-08-24T06:15:00.000Z');

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

describe('EventHoldsCron', () => {
  let cron: EventHoldsCron;
  let prisma: MockPrisma;
  let logSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockPrisma();
    advisoryLockRaw(prisma);
    prisma.eventBooking.deleteMany.mockResolvedValue({ count: 0 });

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    debugSpy = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    cron = new EventHoldsCron(prisma as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('@Cron metadata', () => {
    it('runs every five minutes', () => {
      const options = Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        EventHoldsCron.prototype.sweepExpiredHolds,
      ) as { cronTime: string };

      expect(options.cronTime).toBe(CronExpression.EVERY_5_MINUTES);
    });

    it('uses the registry id, and one no other job claims', () => {
      // P6 folded the inline constant into the single registry; the export
      // stays as an alias so no import breaks.
      expect(BOOKING_HOLD_SWEEP_LOCK_ID).toBe(ADVISORY_LOCK.BOOKING_HOLD_SWEEP);
      expect(Object.values(ADVISORY_LOCK)).toContain(
        BOOKING_HOLD_SWEEP_LOCK_ID,
      );
      expect(BOOKING_HOLD_SWEEP_LOCK_ID).not.toBe(LOYALTY_EXPIRY_LOCK_ID);
      expect(
        Object.values(ADVISORY_LOCK).filter(
          (id) => id === BOOKING_HOLD_SWEEP_LOCK_ID,
        ),
      ).toHaveLength(1);
    });
  });

  describe('advisory lock', () => {
    it('takes the lock and releases it', async () => {
      await cron.sweepExpiredHolds();

      // Acquire and release, both through `$queryRaw` since P6 reads the
      // `pg_advisory_unlock` result instead of discarding it.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      const lockSql = prisma.$queryRaw.mock.calls[0][0] as {
        text: string;
        values: unknown[];
      };
      expect(lockSql.values).toContain(BOOKING_HOLD_SWEEP_LOCK_ID);
      const unlockSql = prisma.$queryRaw.mock.calls[1][0] as {
        text: string;
        values: unknown[];
      };
      expect(unlockSql.text).toContain('pg_advisory_unlock');
      expect(unlockSql.values).toContain(BOOKING_HOLD_SWEEP_LOCK_ID);
    });

    it('short-circuits with no writes when another instance holds the lock', async () => {
      prisma.$queryRaw.mockResolvedValue([{ locked: false }]);

      await cron.sweepExpiredHolds();

      expect(prisma.eventBooking.deleteMany).not.toHaveBeenCalled();
      // Only the acquire ran: releasing a lock this instance never took would
      // free it for whoever is actually holding it.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('lock held by another instance'),
      );
    });

    it('releases the lock and swallows the error when the sweep throws', async () => {
      prisma.eventBooking.deleteMany.mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(cron.sweepExpiredHolds()).resolves.toBeUndefined();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(
        (prisma.$queryRaw.mock.calls[1][0] as { text: string }).text,
      ).toContain('pg_advisory_unlock');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('connection reset'),
        expect.anything(),
      );
    });

    it('logs the count only when something was released', async () => {
      prisma.eventBooking.deleteMany.mockResolvedValue({ count: 3 });

      await cron.sweepExpiredHolds();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Released 3 expired booking holds'),
      );
    });

    it('stays quiet when nothing was due', async () => {
      await cron.sweepExpiredHolds();

      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('releaseExpiredHolds', () => {
    it('deletes only held rows whose hold has run out', async () => {
      prisma.eventBooking.deleteMany.mockResolvedValue({ count: 2 });

      const released = await cron.releaseExpiredHolds(NOW);

      expect(released).toBe(2);
      expect(prisma.eventBooking.deleteMany).toHaveBeenCalledWith({
        where: {
          status: BookingStatus.held,
          OR: [{ hold_expires_at: { lte: NOW } }, { hold_expires_at: null }],
        },
      });
    });

    it('never touches a confirmed, cancelled or attended booking', () => {
      const where = expiredHoldWhere(NOW);

      // The only status the sweep can reach is `held` — a real booking is a
      // record, not a placeholder, and must survive every sweep.
      expect(where.status).toBe(BookingStatus.held);
      expect(where.status).not.toBe(BookingStatus.confirmed);
    });

    it('leaves a live hold alone', async () => {
      await cron.releaseExpiredHolds(NOW);

      const { where } = prisma.eventBooking.deleteMany.mock.calls[0][0] as {
        where: { OR: Array<{ hold_expires_at: unknown }> };
      };
      // `lte: NOW` cannot match a hold that expires after NOW.
      expect(where.OR[0].hold_expires_at).toEqual({ lte: NOW });
    });
  });
});
