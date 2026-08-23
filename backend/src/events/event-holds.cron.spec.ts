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

describe('EventHoldsCron', () => {
  let cron: EventHoldsCron;
  let prisma: MockPrisma;
  let logSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockPrisma();
    prisma.$queryRaw.mockResolvedValue([{ locked: true }]);
    prisma.$executeRaw.mockResolvedValue(1);
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

    it('uses a lock id no other job claims', () => {
      expect(Object.values(ADVISORY_LOCK)).not.toContain(
        BOOKING_HOLD_SWEEP_LOCK_ID,
      );
      expect(BOOKING_HOLD_SWEEP_LOCK_ID).not.toBe(LOYALTY_EXPIRY_LOCK_ID);
    });
  });

  describe('advisory lock', () => {
    it('takes the lock and releases it', async () => {
      await cron.sweepExpiredHolds();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      const lockSql = prisma.$queryRaw.mock.calls[0][0] as {
        values: unknown[];
      };
      expect(lockSql.values).toContain(BOOKING_HOLD_SWEEP_LOCK_ID);
    });

    it('short-circuits with no writes when another instance holds the lock', async () => {
      prisma.$queryRaw.mockResolvedValue([{ locked: false }]);

      await cron.sweepExpiredHolds();

      expect(prisma.eventBooking.deleteMany).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('lock held by another instance'),
      );
    });

    it('releases the lock and swallows the error when the sweep throws', async () => {
      prisma.eventBooking.deleteMany.mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(cron.sweepExpiredHolds()).resolves.toBeUndefined();

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
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
