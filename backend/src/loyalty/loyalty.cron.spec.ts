import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { LoyaltyReason } from '@prisma/client';
import {
  EXPIRY_BATCH_SIZE,
  LOYALTY_EXPIRY_LOCK_ID,
  LoyaltyExpiryCron,
} from './loyalty.cron';
import { ADVISORY_LOCK } from '../common/utils/advisory-lock';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import { mockPrisma, type MockPrisma } from '../test-utils/mock-providers';

const CUSTOMER = 'c0000000-0000-4000-8000-000000000001';
const NOW = new Date('2027-09-01T00:00:00.000Z');

function account(points: number) {
  return {
    customer_id: CUSTOMER,
    points_balance: points,
    lifetime_points: 900,
  };
}

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

describe('LoyaltyExpiryCron', () => {
  let cron: LoyaltyExpiryCron;
  let prisma: MockPrisma;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockPrisma();
    advisoryLockRaw(prisma);
    prisma.loyaltyTransaction.findMany.mockResolvedValue([]);
    prisma.loyaltyTransaction.create.mockResolvedValue({});
    prisma.loyaltyTransaction.update.mockResolvedValue({});
    prisma.loyaltyAccount.findUnique.mockResolvedValue(account(100));
    prisma.loyaltyAccount.update.mockResolvedValue({});

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    cron = new LoyaltyExpiryCron(prisma as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('@Cron metadata', () => {
    it('runs at 02:00 in the node timezone', () => {
      const options = Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        LoyaltyExpiryCron.prototype.nightlyExpiry,
      ) as { cronTime: string; timeZone: string };

      expect(options.cronTime).toBe('0 2 * * *');
      expect(options.timeZone).toBe(DEFAULT_NODE_TIMEZONE);
    });

    it('uses the registry id, and one no other job claims', () => {
      // P6 folded the inline constant into the single registry; the export
      // stays as an alias so no import breaks.
      expect(LOYALTY_EXPIRY_LOCK_ID).toBe(ADVISORY_LOCK.LOYALTY_EXPIRY);
      expect(Object.values(ADVISORY_LOCK)).toContain(LOYALTY_EXPIRY_LOCK_ID);
      expect(LOYALTY_EXPIRY_LOCK_ID).not.toBe(ADVISORY_LOCK.READINESS_SNAPSHOT);
      expect(
        Object.values(ADVISORY_LOCK).filter(
          (id) => id === LOYALTY_EXPIRY_LOCK_ID,
        ),
      ).toHaveLength(1);
    });
  });

  describe('advisory lock', () => {
    it('takes the lock and releases it', async () => {
      await cron.nightlyExpiry();

      // Acquire and release, both through `$queryRaw` since P6 reads the
      // `pg_advisory_unlock` result instead of discarding it.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      const lockSql = prisma.$queryRaw.mock.calls[0][0] as {
        text: string;
        values: unknown[];
      };
      expect(lockSql.values).toContain(LOYALTY_EXPIRY_LOCK_ID);
      const unlockSql = prisma.$queryRaw.mock.calls[1][0] as {
        text: string;
        values: unknown[];
      };
      expect(unlockSql.text).toContain('pg_advisory_unlock');
      expect(unlockSql.values).toContain(LOYALTY_EXPIRY_LOCK_ID);
    });

    it('short-circuits with no writes when another instance holds the lock', async () => {
      prisma.$queryRaw.mockResolvedValue([{ locked: false }]);

      await cron.nightlyExpiry();

      expect(prisma.loyaltyTransaction.findMany).not.toHaveBeenCalled();
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
      // Only the acquire ran: releasing a lock this instance never took would
      // free it for whoever is actually holding it.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('lock held by another instance'),
      );
    });

    it('releases the lock and swallows the error when the sweep throws', async () => {
      prisma.loyaltyTransaction.findMany.mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(cron.nightlyExpiry()).resolves.toBeUndefined();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(
        (prisma.$queryRaw.mock.calls[1][0] as { text: string }).text,
      ).toContain('pg_advisory_unlock');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('connection reset'),
        expect.anything(),
      );
    });
  });

  describe('expirePoints', () => {
    it('writes one expire row per due earn and flags the source expired', async () => {
      prisma.loyaltyTransaction.findMany.mockResolvedValueOnce([
        { id: 'earn-1', customer_id: CUSTOMER, delta: 30 },
      ]);

      const expired = await cron.expirePoints(NOW);

      expect(expired).toBe(1);
      expect(prisma.loyaltyTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            reason: LoyaltyReason.earn,
            expired: false,
            expires_at: { lte: NOW },
          },
          take: EXPIRY_BATCH_SIZE,
        }),
      );
      expect(prisma.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { customer_id: CUSTOMER },
        data: { points_balance: 70 },
      });
      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith({
        data: {
          customer_id: CUSTOMER,
          delta: -30,
          balance_after: 70,
          reason: LoyaltyReason.expire,
          notes: 'Expired earn earn-1',
        },
      });
      expect(prisma.loyaltyTransaction.update).toHaveBeenCalledWith({
        where: { id: 'earn-1' },
        data: { expired: true },
      });
    });

    it('never drives the balance below zero when the points were already spent', async () => {
      prisma.loyaltyAccount.findUnique.mockResolvedValue(account(10));
      prisma.loyaltyTransaction.findMany.mockResolvedValueOnce([
        { id: 'earn-1', customer_id: CUSTOMER, delta: 30 },
      ]);

      await cron.expirePoints(NOW);

      expect(prisma.loyaltyAccount.update).toHaveBeenCalledWith({
        where: { customer_id: CUSTOMER },
        data: { points_balance: 0 },
      });
      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ delta: -10, balance_after: 0 }),
        }),
      );
    });

    it('flags the row and writes nothing when the account has been deleted', async () => {
      prisma.loyaltyAccount.findUnique.mockResolvedValue(null);
      prisma.loyaltyTransaction.findMany.mockResolvedValueOnce([
        { id: 'earn-1', customer_id: CUSTOMER, delta: 30 },
      ]);

      await cron.expirePoints(NOW);

      expect(prisma.loyaltyAccount.update).not.toHaveBeenCalled();
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
      expect(prisma.loyaltyTransaction.update).toHaveBeenCalledWith({
        where: { id: 'earn-1' },
        data: { expired: true },
      });
    });

    it('keeps paging while a full batch comes back', async () => {
      const full = Array.from({ length: EXPIRY_BATCH_SIZE }, (_, i) => ({
        id: `earn-${i}`,
        customer_id: CUSTOMER,
        delta: 1,
      }));
      prisma.loyaltyTransaction.findMany
        .mockResolvedValueOnce(full)
        .mockResolvedValueOnce([
          { id: 'earn-last', customer_id: CUSTOMER, delta: 1 },
        ]);

      const expired = await cron.expirePoints(NOW);

      expect(expired).toBe(EXPIRY_BATCH_SIZE + 1);
      expect(prisma.loyaltyTransaction.findMany).toHaveBeenCalledTimes(2);
    });

    it('does nothing when nothing is due', async () => {
      const expired = await cron.expirePoints(NOW);

      expect(expired).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
