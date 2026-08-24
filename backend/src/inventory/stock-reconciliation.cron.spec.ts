import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { StockReconciliationCron } from './stock-reconciliation.cron';
import { ADVISORY_LOCK } from '../common/utils/advisory-lock';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import {
  mockAuditService,
  mockNodeService,
  mockPrisma,
  type MockPrisma,
} from '../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const ING = 'i-1';
const ZONE = 'z-1';

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

/** One `(ingredient, zone)` ledger sum, shaped as Prisma's `groupBy` returns it. */
function sum(quantity: number, ingredient = ING, zone = ZONE) {
  return {
    ingredient_id: ingredient,
    zone_id: zone,
    _sum: { quantity },
  };
}

/** One `IngredientStock` cache row, as the cron selects it. */
function stock(current: number, ingredient = ING, zone = ZONE) {
  return {
    ingredient_id: ingredient,
    zone_id: zone,
    current_quantity: current,
  };
}

describe('StockReconciliationCron', () => {
  let cron: StockReconciliationCron;
  let prisma: MockPrisma;
  let audit: ReturnType<typeof mockAuditService>;
  let node: ReturnType<typeof mockNodeService>;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockPrisma();
    advisoryLockRaw(prisma);
    prisma.stockMovement.groupBy.mockResolvedValue([]);
    prisma.ingredientStock.findMany.mockResolvedValue([]);

    audit = mockAuditService();
    node = mockNodeService(NODE_ID);

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    cron = new StockReconciliationCron(
      prisma as any,
      audit as any,
      node as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('@Cron metadata', () => {
    it('runs at 02:30 in the node timezone', () => {
      const options = Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        StockReconciliationCron.prototype.nightlyReconcile,
      ) as { cronTime: string; timeZone: string };

      expect(options.cronTime).toBe('30 2 * * *');
      expect(options.timeZone).toBe(DEFAULT_NODE_TIMEZONE);
    });

    it('claims the P6 reconciliation lock id', () => {
      expect(ADVISORY_LOCK.STOCK_RECONCILIATION).toBe(6_350_001);
    });
  });

  describe('advisory lock', () => {
    it('takes the lock, reads, and releases it', async () => {
      await cron.nightlyReconcile();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      const acquire = prisma.$queryRaw.mock.calls[0][0] as {
        text: string;
        values: unknown[];
      };
      expect(acquire.text).toContain('pg_try_advisory_lock');
      expect(acquire.values).toContain(ADVISORY_LOCK.STOCK_RECONCILIATION);
      const release = prisma.$queryRaw.mock.calls[1][0] as { text: string };
      expect(release.text).toContain('pg_advisory_unlock');
    });

    it('short-circuits with zero reads when another instance holds the lock', async () => {
      advisoryLockRaw(prisma, false);

      await cron.nightlyReconcile();

      expect(prisma.stockMovement.groupBy).not.toHaveBeenCalled();
      expect(prisma.ingredientStock.findMany).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      // Only the acquire ran: releasing a lock this instance never took would
      // free it for whoever is actually holding it.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('lock held by another instance'),
      );
    });

    it('swallows a throwing sweep, logs it, and still releases the lock', async () => {
      prisma.ingredientStock.findMany.mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(cron.nightlyReconcile()).resolves.toBeUndefined();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('connection reset'),
        expect.anything(),
      );
    });
  });

  describe('reconcile', () => {
    it('writes no audit row when the ledger matches the cache', async () => {
      prisma.stockMovement.groupBy.mockResolvedValue([sum(12.5)]);
      prisma.ingredientStock.findMany.mockResolvedValue([stock(12.5)]);

      const result = await cron.reconcile();

      expect(result).toEqual({ checked: 1, drifted: 0 });
      expect(audit.record).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('treats a difference at or below the Decimal(14,4) tolerance as noise', async () => {
      prisma.stockMovement.groupBy.mockResolvedValue([sum(12.5)]);
      prisma.ingredientStock.findMany.mockResolvedValue([
        stock(12.5 + StockReconciliationCron.TOLERANCE),
      ]);

      const result = await cron.reconcile();

      expect(result.drifted).toBe(0);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('records one audit row per drifted row, with the delta', async () => {
      prisma.stockMovement.groupBy.mockResolvedValue([sum(10)]);
      prisma.ingredientStock.findMany.mockResolvedValue([stock(7.5)]);

      const result = await cron.reconcile();

      expect(result).toEqual({ checked: 1, drifted: 1 });
      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entity_type: 'ingredient_stock',
          entity_id: `${ING}:${ZONE}`,
          action: 'stock.reconciliation_mismatch',
          node_id: NODE_ID,
          actor_type: ActorType.system,
          actor_id: null,
          before: { current_quantity: 7.5 },
          after: { movement_sum: 10, delta: -2.5 },
        }),
      );
    });

    it('never repairs the cache — the drift is recorded, not written away', async () => {
      prisma.stockMovement.groupBy.mockResolvedValue([sum(10)]);
      prisma.ingredientStock.findMany.mockResolvedValue([stock(7.5)]);

      await cron.reconcile();

      expect(prisma.ingredientStock.update).not.toHaveBeenCalled();
      expect(prisma.ingredientStock.updateMany).not.toHaveBeenCalled();
      expect(prisma.ingredientStock.upsert).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });

    it('treats a stock row with no movements at all as expecting zero', async () => {
      prisma.stockMovement.groupBy.mockResolvedValue([]);
      prisma.ingredientStock.findMany.mockResolvedValue([stock(4)]);

      const result = await cron.reconcile();

      expect(result.drifted).toBe(1);
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          after: { movement_sum: 0, delta: 4 },
        }),
      );
    });

    it('reads null _sum.quantity as zero rather than NaN', async () => {
      prisma.stockMovement.groupBy.mockResolvedValue([
        { ingredient_id: ING, zone_id: ZONE, _sum: { quantity: null } },
      ]);
      prisma.ingredientStock.findMany.mockResolvedValue([stock(0)]);

      const result = await cron.reconcile();

      expect(result.drifted).toBe(0);
    });

    it('keys the ledger per (ingredient, zone), not per ingredient', async () => {
      // Same ingredient in two zones: the cold-room row matches, the prep-room
      // row drifted. Keying on ingredient alone would hide both.
      prisma.stockMovement.groupBy.mockResolvedValue([
        sum(10, ING, 'cold'),
        sum(3, ING, 'prep'),
      ]);
      prisma.ingredientStock.findMany.mockResolvedValue([
        stock(10, ING, 'cold'),
        stock(8, ING, 'prep'),
      ]);

      const result = await cron.reconcile();

      expect(result).toEqual({ checked: 2, drifted: 1 });
      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ entity_id: `${ING}:prep` }),
      );
    });

    it('reads the ledger in one grouped query, not one per stock row', async () => {
      prisma.stockMovement.groupBy.mockResolvedValue([
        sum(1, 'a', ZONE),
        sum(2, 'b', ZONE),
      ]);
      prisma.ingredientStock.findMany.mockResolvedValue([
        stock(1, 'a', ZONE),
        stock(2, 'b', ZONE),
      ]);

      await cron.reconcile();

      expect(prisma.stockMovement.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.stockMovement.groupBy).toHaveBeenCalledWith({
        by: ['ingredient_id', 'zone_id'],
        _sum: { quantity: true },
      });
      expect(prisma.stockMovement.findMany).not.toHaveBeenCalled();
    });

    it('logs how many rows were checked and how many drifted', async () => {
      prisma.stockMovement.groupBy.mockResolvedValue([sum(10)]);
      prisma.ingredientStock.findMany.mockResolvedValue([stock(7.5)]);

      await cron.nightlyReconcile();

      expect(logSpy).toHaveBeenCalledWith('Reconciled 1 stock rows; 1 drifted');
    });
  });
});
