import { Prisma } from '@prisma/client';
import {
  ADVISORY_LOCK,
  withAdvisoryLock,
  type AdvisoryLockClient,
} from './advisory-lock';

/**
 * A one-method stand-in for `PrismaService`. Both advisory statements go through
 * `$queryRaw`, so the mock answers by SQL text: `locked` drives
 * `pg_try_advisory_lock`, `released` drives `pg_advisory_unlock`.
 */
function lockClient(
  rows: unknown,
  releaseRows: unknown = [{ released: true }],
) {
  const client = {
    $queryRaw: jest.fn((sql: Prisma.Sql) =>
      Promise.resolve(
        sql.text.includes('pg_advisory_unlock') ? releaseRows : rows,
      ),
    ),
  };
  return client as typeof client & AdvisoryLockClient;
}

/** The `Prisma.Sql` a mocked method received, so the SQL text and bind can be asserted. */
function sqlArg(mock: jest.Mock, call = 0): Prisma.Sql {
  return mock.mock.calls[call][0] as Prisma.Sql;
}

describe('withAdvisoryLock', () => {
  it('runs fn and releases the lock when it is won', async () => {
    const prisma = lockClient([{ locked: true }]);
    const fn = jest.fn().mockResolvedValue('done');

    const result = await withAdvisoryLock(prisma, 42, fn);

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(sqlArg(prisma.$queryRaw, 1).text).toContain('pg_advisory_unlock');
  });

  it('binds the key as a bigint parameter on both statements', async () => {
    const prisma = lockClient([{ locked: true }]);

    await withAdvisoryLock(prisma, ADVISORY_LOCK.READINESS_SNAPSHOT, () =>
      Promise.resolve(null),
    );

    const acquire = sqlArg(prisma.$queryRaw);
    expect(acquire.text).toContain('pg_try_advisory_lock($1::bigint)');
    expect(acquire.values).toEqual([ADVISORY_LOCK.READINESS_SNAPSHOT]);

    const release = sqlArg(prisma.$queryRaw, 1);
    expect(release.text).toContain('pg_advisory_unlock($1::bigint)');
    expect(release.values).toEqual([ADVISORY_LOCK.READINESS_SNAPSHOT]);
  });

  it('returns null and never runs fn when the lock is held elsewhere', async () => {
    const prisma = lockClient([{ locked: false }]);
    const fn = jest.fn();

    await expect(withAdvisoryLock(prisma, 42, fn)).resolves.toBeNull();

    expect(fn).not.toHaveBeenCalled();
    // Nothing was acquired, so nothing may be released — unlocking here would
    // release a lock another instance is holding.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('treats an empty result set as not-locked', async () => {
    const prisma = lockClient([]);
    const fn = jest.fn();

    await expect(withAdvisoryLock(prisma, 42, fn)).resolves.toBeNull();

    expect(fn).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('treats a null result as not-locked', async () => {
    const prisma = lockClient(null);
    const fn = jest.fn();

    await expect(withAdvisoryLock(prisma, 42, fn)).resolves.toBeNull();

    expect(fn).not.toHaveBeenCalled();
  });

  it('releases the lock and rethrows when fn throws', async () => {
    const prisma = lockClient([{ locked: true }]);
    const boom = new Error('recompute exploded');

    await expect(
      withAdvisoryLock(prisma, 42, () => Promise.reject(boom)),
    ).rejects.toThrow(boom);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(sqlArg(prisma.$queryRaw, 1).text).toContain('pg_advisory_unlock');
  });

  describe('unlock check (RUN-06)', () => {
    it('logs an error, without throwing, when the release returns false', async () => {
      const prisma = lockClient([{ locked: true }], [{ released: false }]);
      const logger = { error: jest.fn() };

      await expect(
        withAdvisoryLock(prisma, ADVISORY_LOCK.R2_ORPHAN_SWEEP, () =>
          Promise.resolve('done'),
        ),
      ).resolves.toBe('done');

      expect(logger.error).not.toHaveBeenCalled();

      await withAdvisoryLock(
        prisma,
        ADVISORY_LOCK.R2_ORPHAN_SWEEP,
        () => Promise.resolve('done'),
        logger,
      );

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Advisory lock ${ADVISORY_LOCK.R2_ORPHAN_SWEEP} could not be released`,
        ),
      );
    });

    it('treats an empty or null release result as a failed release', async () => {
      for (const releaseRows of [[], null, [{}]]) {
        const prisma = lockClient([{ locked: true }], releaseRows);
        const logger = { error: jest.fn() };

        await withAdvisoryLock(prisma, 42, () => Promise.resolve(1), logger);

        expect(logger.error).toHaveBeenCalledTimes(1);
      }
    });

    it('stays quiet when the release succeeds', async () => {
      const prisma = lockClient([{ locked: true }]);
      const logger = { error: jest.fn() };

      await withAdvisoryLock(prisma, 42, () => Promise.resolve(1), logger);

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('still logs the failed release when fn threw', async () => {
      const prisma = lockClient([{ locked: true }], [{ released: false }]);
      const logger = { error: jest.fn() };

      await expect(
        withAdvisoryLock(
          prisma,
          42,
          () => Promise.reject(new Error('job exploded')),
          logger,
        ),
      ).rejects.toThrow('job exploded');

      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('ADVISORY_LOCK registry', () => {
    it('reserves a stable id for the readiness snapshot job', () => {
      expect(ADVISORY_LOCK.READINESS_SNAPSHOT).toBe(3_100_001);
    });

    it('carries the two P5a ids that used to be declared inline', () => {
      expect(ADVISORY_LOCK.LOYALTY_EXPIRY).toBe(5_700_101);
      expect(ADVISORY_LOCK.BOOKING_HOLD_SWEEP).toBe(5_700_102);
    });

    it('carries the five P6 ids in the 6_35x_xxx block', () => {
      expect(ADVISORY_LOCK.STOCK_RECONCILIATION).toBe(6_350_001);
      expect(ADVISORY_LOCK.DAILY_CLOSE).toBe(6_350_002);
      expect(ADVISORY_LOCK.MORNING_BRIEF).toBe(6_350_003);
      expect(ADVISORY_LOCK.STAFF_NUDGE_SWEEP).toBe(6_350_004);
      expect(ADVISORY_LOCK.R2_ORPHAN_SWEEP).toBe(6_350_005);
    });

    it('never reuses a number — every id is distinct', () => {
      const values = Object.values(ADVISORY_LOCK);
      expect(new Set(values).size).toBe(values.length);
    });

    it('keeps every id a safe positive integer (the key space is bigint)', () => {
      for (const value of Object.values(ADVISORY_LOCK)) {
        expect(Number.isSafeInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    });
  });
});
