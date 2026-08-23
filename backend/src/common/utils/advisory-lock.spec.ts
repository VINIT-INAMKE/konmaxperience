import { Prisma } from '@prisma/client';
import {
  ADVISORY_LOCK,
  withAdvisoryLock,
  type AdvisoryLockClient,
} from './advisory-lock';

/** A two-method stand-in for `PrismaService`; `locked` drives `pg_try_advisory_lock`. */
function lockClient(rows: unknown) {
  const client = {
    $queryRaw: jest.fn().mockResolvedValue(rows),
    $executeRaw: jest.fn().mockResolvedValue(1),
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
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('binds the key as a bigint parameter on both statements', async () => {
    const prisma = lockClient([{ locked: true }]);

    await withAdvisoryLock(prisma, ADVISORY_LOCK.READINESS_SNAPSHOT, () =>
      Promise.resolve(null),
    );

    const acquire = sqlArg(prisma.$queryRaw);
    expect(acquire.text).toContain('pg_try_advisory_lock($1::bigint)');
    expect(acquire.values).toEqual([ADVISORY_LOCK.READINESS_SNAPSHOT]);

    const release = sqlArg(prisma.$executeRaw);
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
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('treats an empty result set as not-locked', async () => {
    const prisma = lockClient([]);
    const fn = jest.fn();

    await expect(withAdvisoryLock(prisma, 42, fn)).resolves.toBeNull();

    expect(fn).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
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

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('reserves a stable id for the readiness snapshot job', () => {
    expect(ADVISORY_LOCK.READINESS_SNAPSHOT).toBe(3_100_001);
  });
});
