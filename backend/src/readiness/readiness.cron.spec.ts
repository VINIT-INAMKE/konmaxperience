import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { ReadinessCron } from './readiness.cron';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import { ADVISORY_LOCK } from '../common/utils/advisory-lock';
import {
  mockNodeService,
  mockPrisma,
  type MockPrisma,
} from '../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';

/** 2026-08-23 19:30 UTC is 2026-08-24 01:00 in Asia/Kolkata — the two day keys differ. */
const LATE_UTC_EVENING = new Date('2026-08-23T19:30:00.000Z');
const KOLKATA_DAY = new Date('2026-08-24T00:00:00.000Z');

describe('ReadinessCron', () => {
  let cron: ReadinessCron;
  let prisma: MockPrisma;
  let node: ReturnType<typeof mockNodeService>;
  let derivation: { recomputeAll: jest.Mock };
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockPrisma();
    prisma.$queryRaw.mockResolvedValue([{ locked: true }]);
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.readinessMeter.findMany.mockResolvedValue([]);
    prisma.readinessSnapshot.upsert.mockResolvedValue({});

    node = mockNodeService(NODE_ID);
    derivation = { recomputeAll: jest.fn().mockResolvedValue([]) };

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    cron = new ReadinessCron(prisma as any, node as any, derivation as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('@Cron metadata', () => {
    it('runs at 00:20 in the node timezone', () => {
      const options = Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        ReadinessCron.prototype.nightlyRecomputeAndSnapshot,
      ) as { cronTime: string; timeZone: string };

      expect(options.cronTime).toBe('20 0 * * *');
      expect(options.timeZone).toBe(DEFAULT_NODE_TIMEZONE);
    });
  });

  describe('snapshotAll', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(LATE_UTC_EVENING);
    });

    it('upserts one row per meter keyed on { meter_id, date }', async () => {
      prisma.readinessMeter.findMany.mockResolvedValue([
        { id: 'meter-1', current_value: 42.5 },
        { id: 'meter-2', current_value: 0 },
      ]);

      const written = await cron.snapshotAll();

      expect(written).toBe(2);
      expect(prisma.readinessMeter.findMany).toHaveBeenCalledWith({
        where: { node_id: NODE_ID },
        select: { id: true, current_value: true },
      });
      expect(prisma.readinessSnapshot.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.readinessSnapshot.upsert).toHaveBeenNthCalledWith(1, {
        where: { meter_id_date: { meter_id: 'meter-1', date: KOLKATA_DAY } },
        create: {
          node_id: NODE_ID,
          meter_id: 'meter-1',
          date: KOLKATA_DAY,
          value: 42.5,
        },
        update: { value: 42.5 },
      });
      expect(prisma.readinessSnapshot.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { meter_id_date: { meter_id: 'meter-2', date: KOLKATA_DAY } },
          update: { value: 0 },
        }),
      );
    });

    it('keys on the node-local day at UTC midnight, not the UTC day', async () => {
      prisma.readinessMeter.findMany.mockResolvedValue([
        { id: 'meter-1', current_value: 10 },
      ]);

      await cron.snapshotAll();

      const { date } = (
        prisma.readinessSnapshot.upsert.mock.calls[0][0] as {
          create: { date: Date };
        }
      ).create;
      // The UTC calendar day is still the 23rd at this instant.
      expect(date.toISOString()).toBe('2026-08-24T00:00:00.000Z');
      expect(node.timezone).toHaveBeenCalled();
    });

    it('re-running the same day updates rather than creating a second row', async () => {
      prisma.readinessMeter.findMany.mockResolvedValue([
        { id: 'meter-1', current_value: 10 },
      ]);

      await cron.snapshotAll();
      await cron.snapshotAll();

      const [first, second] = prisma.readinessSnapshot.upsert.mock.calls as [
        [{ where: unknown }],
        [{ where: unknown }],
      ];
      // Identical unique key on both passes, so `@@unique([meter_id, date])`
      // routes the second call into the `update` branch.
      expect(second[0].where).toEqual(first[0].where);
    });

    it('writes nothing and returns 0 when the node has no meters', async () => {
      await expect(cron.snapshotAll()).resolves.toBe(0);
      expect(prisma.readinessSnapshot.upsert).not.toHaveBeenCalled();
    });
  });

  describe('nightlyRecomputeAndSnapshot', () => {
    it('recomputes then snapshots when the lock is won, and releases it', async () => {
      derivation.recomputeAll.mockResolvedValue([
        { code: 'BACKEND', value: 50 },
        { code: 'SALES', value: 30 },
      ]);
      prisma.readinessMeter.findMany.mockResolvedValue([
        { id: 'meter-1', current_value: 50 },
        { id: 'meter-2', current_value: 30 },
      ]);

      await cron.nightlyRecomputeAndSnapshot();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(derivation.recomputeAll).toHaveBeenCalledTimes(1);
      expect(prisma.readinessSnapshot.upsert).toHaveBeenCalledTimes(2);
      // Snapshots must read the values this pass just published.
      expect(derivation.recomputeAll.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.readinessMeter.findMany.mock.invocationCallOrder[0],
      );
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        'Nightly readiness: recomputed 2 meters, wrote 2 snapshots',
      );
    });

    it('takes the lock under the reserved readiness id', async () => {
      await cron.nightlyRecomputeAndSnapshot();

      const acquire = prisma.$queryRaw.mock.calls[0][0] as { values: number[] };
      expect(acquire.values).toEqual([ADVISORY_LOCK.READINESS_SNAPSHOT]);
    });

    it('does neither and logs when another instance holds the lock', async () => {
      prisma.$queryRaw.mockResolvedValue([{ locked: false }]);

      await cron.nightlyRecomputeAndSnapshot();

      expect(derivation.recomputeAll).not.toHaveBeenCalled();
      expect(prisma.readinessMeter.findMany).not.toHaveBeenCalled();
      expect(prisma.readinessSnapshot.upsert).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'Nightly readiness job skipped — lock held by another instance',
      );
    });

    it('swallows a throwing recompute, logs it, and still releases the lock', async () => {
      derivation.recomputeAll.mockRejectedValue(new Error('meter blew up'));

      await expect(cron.nightlyRecomputeAndSnapshot()).resolves.toBeUndefined();

      expect(prisma.readinessSnapshot.upsert).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('meter blew up'),
        expect.any(String),
      );
    });

    it('swallows a failing snapshot write', async () => {
      prisma.readinessMeter.findMany.mockResolvedValue([
        { id: 'meter-1', current_value: 10 },
      ]);
      prisma.readinessSnapshot.upsert.mockRejectedValue(
        new Error('unique violation'),
      );

      await expect(cron.nightlyRecomputeAndSnapshot()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('unique violation'),
        expect.any(String),
      );
    });

    it('does not reject when acquiring the lock itself fails', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection reset'));

      await expect(cron.nightlyRecomputeAndSnapshot()).resolves.toBeUndefined();

      expect(derivation.recomputeAll).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('connection reset'),
        expect.any(String),
      );
    });
  });
});
