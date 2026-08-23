import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ReadinessDerivationService,
  type ReadinessSettings,
} from './readiness-derivation.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SettingsService,
  SETTING_DEFAULTS,
} from '../settings/settings.service';
import { NodeService } from '../node/node.service';
import {
  mockNodeService,
  mockPrisma,
  type MockPrisma,
} from '../test-utils/mock-providers';
import type {
  ProcurementInput,
  QualityInput,
  SalesInput,
  StandardizationInput,
} from './derivation/derivation.types';

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const READINESS = SETTING_DEFAULTS.readiness;

type MeterRow = {
  id: string;
  node_id: string;
  code: string;
  name: string;
  description: string;
  current_value: number;
  target_value: number;
  weight: number;
  mode: 'task_driven' | 'derived' | 'hybrid';
  formula_key: string | null;
  task_value: number;
  derived_value: number | null;
  last_computed_at: Date | null;
  updated_at: Date;
};

function meterRow(over: Partial<MeterRow> & { code: string }): MeterRow {
  return {
    id: `meter-${over.code}`,
    node_id: NODE_ID,
    name: over.code,
    description: '',
    current_value: 0,
    target_value: 100,
    weight: 1,
    mode: 'task_driven',
    formula_key: null,
    task_value: 0,
    derived_value: null,
    last_computed_at: null,
    updated_at: new Date('2026-08-23T00:00:00.000Z'),
    ...over,
  };
}

/** The four gather methods are private; this is the typed door into them. */
type Gatherers = {
  gatherStandardization(nodeId: string): Promise<StandardizationInput>;
  gatherProcurement(nodeId: string): Promise<ProcurementInput>;
  gatherSales(
    nodeId: string,
    since: Date,
    cfg: ReadinessSettings,
  ): Promise<SalesInput>;
  gatherQuality(
    nodeId: string,
    since: Date,
    cfg: ReadinessSettings,
  ): Promise<QualityInput>;
};

describe('ReadinessDerivationService', () => {
  let service: ReadinessDerivationService;
  let prisma: MockPrisma;
  let settings: { get: jest.Mock };
  let meters: Map<string, MeterRow>;

  /** Route `findUnique({ where: { node_id_code: { code } } })` through `meters`. */
  const registerMeters = (...rows: MeterRow[]) => {
    meters = new Map(rows.map((r) => [r.code, r]));
    prisma.readinessMeter.findUnique.mockImplementation(
      (args: { where: { node_id_code?: { code: string } } }) =>
        Promise.resolve(
          args.where.node_id_code
            ? (meters.get(args.where.node_id_code.code) ?? null)
            : null,
        ),
    );
  };

  const gatherers = () => service as unknown as Gatherers;

  const updateArgs = () =>
    prisma.readinessMeter.update.mock.calls.map(
      (call) =>
        call[0] as { where: { id: string }; data: Record<string, unknown> },
    );

  beforeEach(async () => {
    prisma = mockPrisma();
    settings = { get: jest.fn().mockResolvedValue(READINESS) };

    prisma.taskReadinessEvent.aggregate.mockResolvedValue({
      _sum: { value: 0 },
    });
    // Write updates back into the fixture map so a hybrid recomputed after its
    // derived partner reads the value that partner just published.
    prisma.readinessMeter.update.mockImplementation(
      (args: { where: { id: string }; data: Partial<MeterRow> }) => {
        const row = [...meters.values()].find((m) => m.id === args.where.id);
        if (row) Object.assign(row, args.data);
        return Promise.resolve(row ?? {});
      },
    );
    prisma.readinessMeter.findMany.mockResolvedValue([]);
    registerMeters();

    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessDerivationService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
        { provide: NodeService, useValue: mockNodeService(NODE_ID) },
      ],
    }).compile();

    service = module.get(ReadinessDerivationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recomputeMeter', () => {
    it('publishes task_value and leaves derived_value untouched on a task_driven meter', async () => {
      registerMeters(
        meterRow({ code: 'VILLA', mode: 'task_driven', derived_value: 30 }),
      );
      prisma.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 42 },
      });

      const value = await service.recomputeMeter('VILLA');

      expect(value).toBe(42);
      expect(updateArgs()[0].where).toEqual({ id: 'meter-VILLA' });
      expect(updateArgs()[0].data).toEqual(
        expect.objectContaining({
          task_value: 42,
          derived_value: 30,
          current_value: 42,
        }),
      );
      expect(updateArgs()[0].data.last_computed_at).toBeInstanceOf(Date);
    });

    it('runs the standardization formula on a derived meter and publishes it as current_value', async () => {
      registerMeters(
        meterRow({
          code: 'STANDARDIZATION',
          mode: 'derived',
          formula_key: 'standardization_v1',
        }),
      );
      prisma.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 10 },
      });
      prisma.product.findMany.mockResolvedValue([
        {
          recipe: { status: 'approved', computed_cost: new Prisma.Decimal(80) },
        },
        {
          recipe: { status: 'approved', computed_cost: new Prisma.Decimal(40) },
        },
        {
          recipe: { status: 'approved', computed_cost: new Prisma.Decimal(0) },
        },
        { recipe: null },
      ]);

      const value = await service.recomputeMeter('STANDARDIZATION');

      expect(value).toBe(50);
      expect(updateArgs()[0].data).toEqual(
        expect.objectContaining({
          task_value: 10,
          derived_value: 50,
          current_value: 50,
        }),
      );
    });

    it('blends 50/50 against the partner meter derived_value on a hybrid meter', async () => {
      registerMeters(
        meterRow({
          code: 'BACKEND',
          mode: 'hybrid',
          formula_key: 'hybrid_backend_v1',
        }),
        meterRow({
          code: 'STANDARDIZATION',
          mode: 'derived',
          formula_key: 'standardization_v1',
          derived_value: 80,
        }),
      );
      prisma.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 60 },
      });

      const value = await service.recomputeMeter('BACKEND');

      expect(value).toBe(70);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
      expect(updateArgs()[0].data).toEqual(
        expect.objectContaining({
          task_value: 60,
          derived_value: 80,
          current_value: 70,
        }),
      );
    });

    it('publishes 0 for an unregistered formula_key instead of throwing', async () => {
      registerMeters(
        meterRow({
          code: 'STANDARDIZATION',
          mode: 'derived',
          formula_key: 'bogus_v9',
          derived_value: 55,
        }),
      );

      const value = await service.recomputeMeter('STANDARDIZATION');

      expect(value).toBe(0);
      expect(updateArgs()[0].data).toEqual(
        expect.objectContaining({ derived_value: 0, current_value: 0 }),
      );
    });

    it('throws NotFoundException naming an unknown code', async () => {
      registerMeters();

      await expect(service.recomputeMeter('NOPE')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.recomputeMeter('NOPE')).rejects.toThrow(
        /Readiness meter NOPE not found/,
      );
      expect(prisma.readinessMeter.update).not.toHaveBeenCalled();
    });

    it('clamps a task-event sum above 100', async () => {
      registerMeters(meterRow({ code: 'VILLA', mode: 'task_driven' }));
      prisma.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 250 },
      });

      expect(await service.recomputeMeter('VILLA')).toBe(100);
      expect(updateArgs()[0].data).toEqual(
        expect.objectContaining({ task_value: 100, current_value: 100 }),
      );
    });

    it('reads only active TaskReadinessEvent rows', async () => {
      registerMeters(meterRow({ code: 'VILLA', mode: 'task_driven' }));

      await service.recomputeMeter('VILLA');

      expect(prisma.taskReadinessEvent.aggregate).toHaveBeenCalledWith({
        where: { readiness_meter_id: 'meter-VILLA', revoked_at: null },
        _sum: { value: true },
      });
    });
  });

  describe('gatherProcurement', () => {
    it('returns no ingredients and issues no follow-up query for an empty BOM', async () => {
      prisma.recipeLine.findMany.mockResolvedValue([]);

      const input = await gatherers().gatherProcurement(NODE_ID);

      expect(input).toEqual({ ingredients: [] });
      expect(prisma.ingredient.findMany).not.toHaveBeenCalled();
      expect(prisma.vendorPrice.groupBy).not.toHaveBeenCalled();
      expect(prisma.ingredientStock.groupBy).not.toHaveBeenCalled();
    });

    it('sums IngredientStock across zones before comparing with min_stock_level', async () => {
      prisma.recipeLine.findMany.mockResolvedValue([
        { ingredient_id: 'ing-1' },
        { ingredient_id: 'ing-2' },
      ]);
      prisma.ingredient.findMany.mockResolvedValue([
        { id: 'ing-1', min_stock_level: new Prisma.Decimal(5) },
        { id: 'ing-2', min_stock_level: new Prisma.Decimal(5) },
      ]);
      prisma.vendorPrice.groupBy.mockResolvedValue([
        { ingredient_id: 'ing-1', _count: { id: 2 } },
        { ingredient_id: 'ing-2', _count: { id: 1 } },
      ]);
      // Prisma has already summed the per-zone rows; ing-1 holds 4 + 2 across two zones.
      prisma.ingredientStock.groupBy.mockResolvedValue([
        {
          ingredient_id: 'ing-1',
          _sum: { current_quantity: new Prisma.Decimal(6) },
        },
        {
          ingredient_id: 'ing-2',
          _sum: { current_quantity: new Prisma.Decimal(2) },
        },
      ]);

      const input = await gatherers().gatherProcurement(NODE_ID);

      expect(prisma.ingredientStock.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['ingredient_id'],
          _sum: { current_quantity: true },
        }),
      );
      expect(input.ingredients).toEqual([
        {
          ingredient_id: 'ing-1',
          has_active_vendor_price: true,
          stock_on_hand: 6,
          min_stock_level: 5,
        },
        {
          ingredient_id: 'ing-2',
          has_active_vendor_price: true,
          stock_on_hand: 2,
          min_stock_level: 5,
        },
      ]);
    });

    it('reads distinct recipe-input ingredients of approved recipes only', async () => {
      prisma.recipeLine.findMany.mockResolvedValue([]);

      await gatherers().gatherProcurement(NODE_ID);

      expect(prisma.recipeLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          distinct: ['ingredient_id'],
          where: expect.objectContaining({
            recipe: { node_id: NODE_ID, status: 'approved' },
            ingredient: { usage_type: 'recipe_input' },
          }),
        }),
      );
    });
  });

  describe('gatherSales', () => {
    it('counts distinct channels from groupBy and total orders from the summed _count', async () => {
      prisma.order.groupBy.mockResolvedValue([
        { channel: 'dine_in', _count: { id: 7 } },
        { channel: 'marketplace', _count: { id: 5 } },
      ]);
      const since = new Date('2026-08-16T00:00:00.000Z');

      const input = await gatherers().gatherSales(NODE_ID, since, READINESS);

      expect(input).toEqual({
        channels_with_orders: 2,
        completed_orders: 12,
        points_per_channel: READINESS.sales_points_per_channel,
        volume_threshold: READINESS.sales_volume_threshold,
        volume_bonus: READINESS.sales_volume_bonus,
      });
      expect(prisma.order.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['channel'],
          where: expect.objectContaining({
            node_id: NODE_ID,
            created_at: { gte: since },
            status: { in: ['served', 'delivered', 'completed'] },
          }),
        }),
      );
    });
  });

  describe('gatherQuality', () => {
    it('computes COGS as quantity x computed_cost and skips items with no recipe', async () => {
      prisma.wasteLog.aggregate.mockResolvedValue({
        _sum: { cost_impact: new Prisma.Decimal(240) },
      });
      prisma.orderItem.findMany.mockResolvedValue([
        {
          quantity: 2,
          product: { recipe: { computed_cost: new Prisma.Decimal(50) } },
        },
        { quantity: 3, product: { recipe: null } },
        {
          quantity: 1,
          product: { recipe: { computed_cost: new Prisma.Decimal(20) } },
        },
      ]);
      prisma.feedback.aggregate.mockResolvedValue({ _avg: { rating: 4 } });
      const since = new Date('2026-08-16T00:00:00.000Z');

      const input = await gatherers().gatherQuality(NODE_ID, since, READINESS);

      expect(input).toEqual({
        waste_cost: 240,
        cogs: 120,
        average_rating: 4,
        waste_multiplier: READINESS.quality_waste_multiplier,
      });
      expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            order: expect.objectContaining({
              status: { notIn: ['cancelled', 'refunded'] },
            }),
          },
        }),
      );
    });

    it('reports a null average_rating when the window carries no feedback', async () => {
      prisma.wasteLog.aggregate.mockResolvedValue({
        _sum: { cost_impact: null },
      });
      prisma.orderItem.findMany.mockResolvedValue([]);
      prisma.feedback.aggregate.mockResolvedValue({ _avg: { rating: null } });

      const input = await gatherers().gatherQuality(
        NODE_ID,
        new Date(),
        READINESS,
      );

      expect(input).toEqual(
        expect.objectContaining({
          waste_cost: 0,
          cogs: 0,
          average_rating: null,
        }),
      );
    });
  });

  describe('gatherStandardization', () => {
    it('reads active prepared_food/packaged products of the node', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      const input = await gatherers().gatherStandardization(NODE_ID);

      expect(input).toEqual({ products: [] });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            node_id: NODE_ID,
            status: 'active',
            type: { in: ['prepared_food', 'packaged'] },
          },
        }),
      );
    });
  });

  describe('recomputeWithHybrids', () => {
    it('recomputes STANDARDIZATION and then the BACKEND hybrid that blends it', async () => {
      registerMeters(
        meterRow({
          code: 'STANDARDIZATION',
          mode: 'derived',
          formula_key: 'standardization_v1',
        }),
        meterRow({
          code: 'BACKEND',
          mode: 'hybrid',
          formula_key: 'hybrid_backend_v1',
        }),
      );
      prisma.product.findMany.mockResolvedValue([
        {
          recipe: { status: 'approved', computed_cost: new Prisma.Decimal(10) },
        },
      ]);
      prisma.readinessMeter.findMany.mockResolvedValue([{ code: 'BACKEND' }]);
      prisma.taskReadinessEvent.aggregate.mockResolvedValue({
        _sum: { value: 40 },
      });

      await service.recomputeWithHybrids('STANDARDIZATION');

      expect(prisma.readinessMeter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mode: 'hybrid',
            formula_key: { in: ['hybrid_backend_v1'] },
          }),
        }),
      );
      expect(updateArgs().map((c) => c.where.id)).toEqual([
        'meter-STANDARDIZATION',
        'meter-BACKEND',
      ]);
      // STANDARDIZATION published 100, so BACKEND is 0.5 x 40 + 0.5 x 100 = 70.
      expect(updateArgs()[1].data).toEqual(
        expect.objectContaining({ current_value: 70 }),
      );
    });

    it('does not look for hybrids when no hybrid maps to the code', async () => {
      registerMeters(meterRow({ code: 'VILLA', mode: 'task_driven' }));

      await service.recomputeWithHybrids('VILLA');

      expect(prisma.readinessMeter.findMany).not.toHaveBeenCalled();
      expect(updateArgs()).toHaveLength(1);
    });
  });

  describe('recomputeAll', () => {
    it('recomputes derived, then hybrid, then task-driven meters', async () => {
      registerMeters(
        meterRow({
          code: 'FRONTEND',
          mode: 'hybrid',
          formula_key: 'hybrid_frontend_v1',
        }),
        meterRow({ code: 'SALES', mode: 'derived', formula_key: 'sales_v1' }),
        meterRow({ code: 'VILLA', mode: 'task_driven' }),
      );
      // Stored code-ascending, as the query orders them.
      prisma.readinessMeter.findMany.mockResolvedValue([
        { code: 'FRONTEND', mode: 'hybrid' },
        { code: 'SALES', mode: 'derived' },
        { code: 'VILLA', mode: 'task_driven' },
      ]);
      prisma.order.groupBy.mockResolvedValue([
        { channel: 'dine_in', _count: { id: 12 } },
      ]);

      const results = await service.recomputeAll();

      expect(results.map((r) => r.code)).toEqual([
        'SALES',
        'FRONTEND',
        'VILLA',
      ]);
      expect(updateArgs().map((c) => c.where.id)).toEqual([
        'meter-SALES',
        'meter-FRONTEND',
        'meter-VILLA',
      ]);
      // 1 channel x 25 + 10 volume bonus = 35.
      expect(results[0].value).toBe(35);
    });

    it('skips a meter that fails and still returns the rest', async () => {
      registerMeters(meterRow({ code: 'VILLA', mode: 'task_driven' }));
      prisma.readinessMeter.findMany.mockResolvedValue([
        { code: 'GHOST', mode: 'task_driven' },
        { code: 'VILLA', mode: 'task_driven' },
      ]);

      const results = await service.recomputeAll();

      expect(results.map((r) => r.code)).toEqual(['VILLA']);
    });
  });
});
