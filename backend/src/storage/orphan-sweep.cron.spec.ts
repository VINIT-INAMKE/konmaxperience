import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import {
  OrphanSweepCron,
  SWEPT_PREFIXES,
  UPLOAD_GRACE_MS,
  storageKeyFromUrl,
} from './orphan-sweep.cron';
import { ADVISORY_LOCK } from '../common/utils/advisory-lock';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import {
  mockAuditService,
  mockNodeService,
  mockPrisma,
  type MockModel,
  type MockPrisma,
} from '../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-08-30T04:00:00.000Z');
/** Comfortably outside the 48 h upload grace window. */
const OLD = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
/** Inside it — an upload whose row may not have landed yet. */
const FRESH = new Date(NOW.getTime() - 60 * 60 * 1000);

/**
 * `mockPrisma` only knows the models its own registry lists; the sweep also
 * reads `ExportRecord`, `Asset` and `Conversation`. `overrides` accepts any key,
 * so they are added here rather than in the Task-1-owned registry.
 */
type SweepPrisma = MockPrisma &
  Record<'exportRecord' | 'asset' | 'conversation', MockModel>;

function sweepPrisma(): SweepPrisma {
  const prisma = mockPrisma({
    exportRecord: { findMany: jest.fn().mockResolvedValue([]) },
    asset: { findMany: jest.fn().mockResolvedValue([]) },
    conversation: { findMany: jest.fn().mockResolvedValue([]) },
  }) as SweepPrisma;
  prisma.evidence.findMany.mockResolvedValue([]);
  prisma.productMedia.findMany.mockResolvedValue([]);
  return prisma;
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

function mockStorageWithListing(
  listings: Record<string, { key: string; lastModified: Date | null }[]> = {},
) {
  return {
    listKeys: jest.fn((prefix: string) =>
      Promise.resolve(listings[prefix] ?? []),
    ),
    deleteKeys: jest.fn((keys: string[]) => Promise.resolve(keys.length)),
  };
}

describe('OrphanSweepCron', () => {
  let cron: OrphanSweepCron;
  let prisma: SweepPrisma;
  let storage: ReturnType<typeof mockStorageWithListing>;
  let audit: ReturnType<typeof mockAuditService>;
  let node: ReturnType<typeof mockNodeService>;
  let settings: { get: jest.Mock };
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  function build(
    listings: Record<string, { key: string; lastModified: Date | null }[]> = {},
  ) {
    storage = mockStorageWithListing(listings);
    cron = new OrphanSweepCron(
      prisma as any,
      storage as any,
      audit as any,
      node as any,
      settings as any,
    );
  }

  beforeEach(() => {
    prisma = sweepPrisma();
    advisoryLockRaw(prisma);
    audit = mockAuditService();
    node = mockNodeService(NODE_ID);
    settings = { get: jest.fn().mockResolvedValue(false) };

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    build();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('@Cron metadata', () => {
    it('runs Sunday 04:00 node-local, an hour after the notifications cleanup', () => {
      const options = Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        OrphanSweepCron.prototype.weeklySweep,
      ) as { cronTime: string; timeZone: string };

      expect(options.cronTime).toBe('0 4 * * 0');
      expect(options.timeZone).toBe(DEFAULT_NODE_TIMEZONE);
    });

    it('claims the P6 orphan-sweep lock id', () => {
      expect(ADVISORY_LOCK.R2_ORPHAN_SWEEP).toBe(6_350_005);
    });

    it('sweeps only the three prefixes uploads accumulate under', () => {
      expect([...SWEPT_PREFIXES]).toEqual([
        'evidence/',
        'exports/',
        'product-media/',
      ]);
      expect(UPLOAD_GRACE_MS).toBe(48 * 60 * 60 * 1000);
    });
  });

  describe('advisory lock', () => {
    it('takes the lock, sweeps, and releases it', async () => {
      await cron.weeklySweep();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      const acquire = prisma.$queryRaw.mock.calls[0][0] as {
        text: string;
        values: unknown[];
      };
      expect(acquire.text).toContain('pg_try_advisory_lock');
      expect(acquire.values).toContain(ADVISORY_LOCK.R2_ORPHAN_SWEEP);
      expect(
        (prisma.$queryRaw.mock.calls[1][0] as { text: string }).text,
      ).toContain('pg_advisory_unlock');
    });

    it('lists nothing when another instance holds the lock', async () => {
      advisoryLockRaw(prisma, false);

      await cron.weeklySweep();

      expect(storage.listKeys).not.toHaveBeenCalled();
      expect(storage.deleteKeys).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('lock held by another instance'),
      );
    });

    it('swallows a throwing sweep and still releases the lock', async () => {
      build();
      storage.listKeys.mockRejectedValue(new Error('R2 unreachable'));

      await expect(cron.weeklySweep()).resolves.toBeUndefined();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('R2 unreachable'),
        expect.anything(),
      );
    });
  });

  describe('reference safety', () => {
    it('never deletes a key any of the five columns points at', async () => {
      prisma.evidence.findMany.mockResolvedValue([
        { url: 'https://cdn.example.com/evidence/task-1/1-photo.jpg' },
      ]);
      prisma.exportRecord.findMany.mockResolvedValue([
        { r2_key: 'exports/orders/20260801/orders_x.csv' },
      ]);
      prisma.productMedia.findMany.mockResolvedValue([
        { url: 'https://cdn.example.com/product-media/p-1/1-hero.webp' },
      ]);
      // `Asset` and `Conversation` keys live outside the swept prefixes, but a
      // key that somehow lands inside one must still be spared.
      prisma.asset.findMany.mockResolvedValue([
        { url: 'https://cdn.example.com/evidence/asset-shaped.png' },
      ]);
      prisma.conversation.findMany.mockResolvedValue([
        { avatar_key: 'evidence/avatar-shaped.png' },
      ]);

      build({
        'evidence/': [
          { key: 'evidence/task-1/1-photo.jpg', lastModified: OLD },
          { key: 'evidence/asset-shaped.png', lastModified: OLD },
          { key: 'evidence/avatar-shaped.png', lastModified: OLD },
          { key: 'evidence/task-9/9-orphan.jpg', lastModified: OLD },
        ],
        'exports/': [
          { key: 'exports/orders/20260801/orders_x.csv', lastModified: OLD },
        ],
        'product-media/': [
          { key: 'product-media/p-1/1-hero.webp', lastModified: OLD },
        ],
      });

      await cron.sweep(NOW);

      expect(storage.deleteKeys).toHaveBeenCalledTimes(1);
      expect(storage.deleteKeys).toHaveBeenCalledWith([
        'evidence/task-9/9-orphan.jpg',
      ]);
    });

    it('matches a url-encoded stored url against the literal listed key', async () => {
      prisma.evidence.findMany.mockResolvedValue([
        { url: 'https://cdn.example.com/evidence/t/1-my%20file.jpg' },
      ]);
      build({
        'evidence/': [{ key: 'evidence/t/1-my file.jpg', lastModified: OLD }],
      });

      await cron.sweep(NOW);

      expect(storage.deleteKeys).not.toHaveBeenCalled();
    });

    it('loads the referenced set after listing, so a row written mid-listing still counts', async () => {
      build({ 'evidence/': [{ key: 'evidence/x', lastModified: OLD }] });

      await cron.sweep(NOW);

      const lastList = storage.listKeys.mock.invocationCallOrder.at(-1)!;
      expect(
        prisma.evidence.findMany.mock.invocationCallOrder[0],
      ).toBeGreaterThan(lastList);
    });
  });

  describe('the 48-hour upload grace window', () => {
    it('never deletes a key written inside the window', async () => {
      build({
        'evidence/': [
          { key: 'evidence/in-flight.jpg', lastModified: FRESH },
          { key: 'evidence/stale.jpg', lastModified: OLD },
        ],
      });

      const results = await cron.sweep(NOW);

      expect(storage.deleteKeys).toHaveBeenCalledWith(['evidence/stale.jpg']);
      expect(results[0]).toMatchObject({
        prefix: 'evidence/',
        listed: 2,
        orphans: 1,
        spared: 1,
      });
    });

    it('treats a key exactly on the boundary as still in flight', async () => {
      build({
        'evidence/': [
          {
            key: 'evidence/boundary.jpg',
            lastModified: new Date(NOW.getTime() - UPLOAD_GRACE_MS),
          },
        ],
      });

      await cron.sweep(NOW);

      expect(storage.deleteKeys).not.toHaveBeenCalled();
    });

    it('spares an object whose age is unknown', async () => {
      build({
        'evidence/': [{ key: 'evidence/no-date.jpg', lastModified: null }],
      });

      await cron.sweep(NOW);

      expect(storage.deleteKeys).not.toHaveBeenCalled();
    });
  });

  describe('deletion and audit', () => {
    it('writes one audit row per prefix that lost objects', async () => {
      build({
        'evidence/': [{ key: 'evidence/a.jpg', lastModified: OLD }],
        'exports/': [{ key: 'exports/b.csv', lastModified: OLD }],
      });

      await cron.sweep(NOW);

      expect(audit.record).toHaveBeenCalledTimes(2);
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entity_type: 'storage',
          entity_id: 'evidence/',
          action: 'storage.orphan_swept',
          node_id: NODE_ID,
          actor_type: ActorType.system,
          actor_id: null,
          after: {
            prefix: 'evidence/',
            deleted: 1,
            sample_keys: ['evidence/a.jpg'],
          },
        }),
      );
    });

    it('names at most ten sample keys but reports the full count', async () => {
      const keys = Array.from({ length: 14 }, (_, i) => ({
        key: `evidence/${i}.jpg`,
        lastModified: OLD,
      }));
      build({ 'evidence/': keys });

      await cron.sweep(NOW);

      expect(storage.deleteKeys.mock.calls[0][0]).toHaveLength(14);
      const after = audit.record.mock.calls[0][1].after as {
        deleted: number;
        sample_keys: string[];
      };
      expect(after.deleted).toBe(14);
      expect(after.sample_keys).toHaveLength(10);
    });

    it('writes nothing at all when every listed key is referenced', async () => {
      prisma.evidence.findMany.mockResolvedValue([
        { url: 'https://cdn.example.com/evidence/a.jpg' },
      ]);
      build({ 'evidence/': [{ key: 'evidence/a.jpg', lastModified: OLD }] });

      const results = await cron.sweep(NOW);

      expect(storage.deleteKeys).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(results.every((r) => r.deleted === 0)).toBe(true);
    });

    it('lists all three prefixes on every pass', async () => {
      await cron.sweep(NOW);

      expect(storage.listKeys.mock.calls.map((c) => c[0])).toEqual([
        'evidence/',
        'exports/',
        'product-media/',
      ]);
    });
  });

  describe('maintenance-mode dry run', () => {
    it('deletes nothing, audits nothing, and logs what it would have removed', async () => {
      settings.get.mockResolvedValue(true);
      build({
        'evidence/': [{ key: 'evidence/orphan.jpg', lastModified: OLD }],
      });

      const results = await cron.sweep(NOW);

      expect(settings.get).toHaveBeenCalledWith('maintenance_mode');
      expect(storage.deleteKeys).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('would delete 1 orphaned objects'),
      );
      expect(results[0]).toMatchObject({
        orphans: 1,
        deleted: 0,
        dry_run: true,
      });
    });
  });

  describe('storageKeyFromUrl', () => {
    it('strips the public origin from a stored url', () => {
      expect(
        storageKeyFromUrl('https://cdn.example.com/evidence/t/1-a.jpg'),
      ).toBe('evidence/t/1-a.jpg');
    });

    it('passes a bare key through unchanged', () => {
      expect(storageKeyFromUrl('exports/orders/a.csv')).toBe(
        'exports/orders/a.csv',
      );
    });

    it('drops a query string and a fragment', () => {
      expect(storageKeyFromUrl('https://cdn.example.com/a/b.jpg?v=2#x')).toBe(
        'a/b.jpg',
      );
    });

    it('returns null for empty, blank and nullish input', () => {
      expect(storageKeyFromUrl('')).toBeNull();
      expect(storageKeyFromUrl('   ')).toBeNull();
      expect(storageKeyFromUrl(null)).toBeNull();
      expect(storageKeyFromUrl(undefined)).toBeNull();
      expect(storageKeyFromUrl('https://cdn.example.com/')).toBeNull();
    });
  });
});
