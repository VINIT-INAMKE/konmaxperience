import { BadRequestException } from '@nestjs/common';
import { MovementType, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { mockPrisma } from '../test-utils/mock-providers';
import { clearConversionCache } from '../common/utils/unit-conversion';
import { FoodCostService } from './food-cost.service';

const dec = (value: string) => new Prisma.Decimal(value);

/** One `OrderItem` row in the shape `report()` selects. */
const item = (
  productId: string,
  name: string,
  quantity: number,
  computedCost: string | null,
) => ({
  quantity,
  product: {
    id: productId,
    name,
    recipe: computedCost === null ? null : { computed_cost: dec(computedCost) },
  },
});

/** One `StockMovement` row in the shape `report()` selects. Consumption is negative. */
const movement = (
  movement_type: MovementType,
  quantity: number,
  ingredient: { id: string; name: string; base_unit: string },
) => ({ movement_type, quantity: dec(String(quantity)), ingredient });

const FLOUR = { id: 'ing-flour', name: 'Flour', base_unit: 'kg' };
const SALT = { id: 'ing-salt', name: 'Salt', base_unit: 'kg' };
const OIL = { id: 'ing-oil', name: 'Oil', base_unit: 'litre' };

describe('FoodCostService.report — RUN-03 theoretical vs actual', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let node: { timezone: jest.Mock };
  let service: FoodCostService;

  const setup = (opts: {
    items?: ReturnType<typeof item>[];
    movements?: ReturnType<typeof movement>[];
    revenue?: string | null;
    prices?: Record<string, { price: string; unit: string }>;
    conversions?: { from_unit: string; to_unit: string; factor: number }[];
  }) => {
    clearConversionCache();
    prisma = mockPrisma({
      // `unitConversion` has no entry in `PRISMA_MODELS`; `overrides` supplies it
      // rather than editing the shared factory, which this task does not own.
      unitConversion: {
        findMany: jest.fn().mockResolvedValue(opts.conversions ?? []),
      },
    });
    prisma.orderItem.findMany.mockResolvedValue(opts.items ?? []);
    prisma.stockMovement.findMany.mockResolvedValue(opts.movements ?? []);
    prisma.order.aggregate.mockResolvedValue({
      _sum: { total: opts.revenue == null ? null : dec(opts.revenue) },
    });
    prisma.vendorPrice.findFirst.mockImplementation((args: any) => {
      const row = (opts.prices ?? {})[args.where.ingredient_id as string];
      return Promise.resolve(
        row ? { price: dec(row.price), unit: row.unit } : null,
      );
    });
    node = { timezone: jest.fn().mockResolvedValue('Asia/Kolkata') };
    service = new FoodCostService(
      prisma as unknown as PrismaService,
      node as unknown as NodeService,
    );
  };

  // -------------------------------------------------------------------
  // Theoretical — Σ quantity × Recipe.computed_cost
  // -------------------------------------------------------------------
  it('two order lines of a product whose recipe costs ₹40 give a theoretical of ₹80', async () => {
    setup({
      items: [
        item('prod-1', 'Thali', 1, '40.00'),
        item('prod-1', 'Thali', 1, '40.00'),
      ],
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.currency_unit).toBe('paise');
    expect(report.theoretical.total).toBe(8_000);
    expect(report.theoretical.by_product).toEqual([
      {
        product_id: 'prod-1',
        name: 'Thali',
        quantity: 2,
        unit_cost: 4_000,
        cost: 8_000,
      },
    ]);
  });

  it('counts only orders that are neither cancelled nor refunded', async () => {
    setup({ items: [] });

    await service.report('2026-03-01', '2026-03-31');

    const where = prisma.orderItem.findMany.mock.calls[0][0].where;
    expect(where.order.status).toEqual({
      notIn: [OrderStatus.cancelled, OrderStatus.refunded],
    });
    // Revenue is summed over the identical population, or the percentage is a
    // ratio of two different things.
    expect(prisma.order.aggregate.mock.calls[0][0].where.status).toEqual(
      where.order.status,
    );
  });

  it('lists a sold product whose recipe has no computed cost at zero rather than dropping it', async () => {
    setup({
      items: [
        item('prod-1', 'Thali', 1, '40.00'),
        item('prod-2', 'Chai', 3, null),
      ],
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.theoretical.total).toBe(4_000);
    expect(report.theoretical.by_product.map((p) => p.product_id)).toEqual([
      'prod-1',
      'prod-2',
    ]);
    expect(report.theoretical.by_product[1]).toMatchObject({
      quantity: 3,
      unit_cost: 0,
      cost: 0,
    });
  });

  // -------------------------------------------------------------------
  // Actual — Σ |StockMovement.quantity| at the latest VendorPrice
  // -------------------------------------------------------------------
  it('a waste movement of 2 kg of an ingredient priced ₹100/kg contributes ₹200 to actual', async () => {
    setup({
      movements: [movement(MovementType.waste, -2, FLOUR)],
      prices: { [FLOUR.id]: { price: '100.00', unit: 'kg' } },
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.actual.total).toBe(20_000);
    expect(report.actual.by_movement_type).toContainEqual({
      movement_type: MovementType.waste,
      cost: 20_000,
    });
  });

  it('takes the magnitude of the signed quantity — a negative movement is not a credit', async () => {
    setup({
      movements: [
        movement(MovementType.order_deducted, -3, FLOUR),
        movement(MovementType.prep_deducted, 1, FLOUR),
      ],
      prices: { [FLOUR.id]: { price: '100.00', unit: 'kg' } },
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.actual.total).toBe(40_000);
  });

  it('never queries `adjustment` movements, and never reports a row for them', async () => {
    setup({ movements: [] });

    const report = await service.report('2026-03-01', '2026-03-31');

    const where = prisma.stockMovement.findMany.mock.calls[0][0].where;
    expect(where.movement_type.in).toEqual([
      MovementType.order_deducted,
      MovementType.prep_deducted,
      MovementType.waste,
      MovementType.supply_usage,
    ]);
    expect(where.movement_type.in).not.toContain(MovementType.adjustment);
    expect(
      report.actual.by_movement_type.map((row) => row.movement_type),
    ).not.toContain(MovementType.adjustment);
  });

  it('returns every consuming type, at zero when nothing moved', async () => {
    setup({ movements: [] });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.actual.by_movement_type).toEqual([
      { movement_type: MovementType.order_deducted, cost: 0 },
      { movement_type: MovementType.prep_deducted, cost: 0 },
      { movement_type: MovementType.waste, cost: 0 },
      { movement_type: MovementType.supply_usage, cost: 0 },
    ]);
  });

  it('shares one price cache across the whole report — one query per ingredient', async () => {
    setup({
      movements: [
        movement(MovementType.waste, -1, FLOUR),
        movement(MovementType.order_deducted, -1, FLOUR),
        movement(MovementType.prep_deducted, -1, FLOUR),
      ],
      prices: { [FLOUR.id]: { price: '100.00', unit: 'kg' } },
    });

    await service.report('2026-03-01', '2026-03-31');

    expect(prisma.vendorPrice.findFirst).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------
  // Unpriced ingredients — decision 18
  // -------------------------------------------------------------------
  it('an ingredient with no VendorPrice contributes ₹0 and is named in unpriced_ingredients', async () => {
    setup({
      movements: [
        movement(MovementType.waste, -2, FLOUR),
        movement(MovementType.waste, -5, SALT),
      ],
      prices: { [FLOUR.id]: { price: '100.00', unit: 'kg' } },
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.actual.total).toBe(20_000);
    expect(report.unpriced_ingredients).toEqual([
      { id: SALT.id, name: 'Salt' },
    ]);
  });

  it('an ingredient with no conversion path to its price unit does the same', async () => {
    setup({
      movements: [movement(MovementType.supply_usage, -4, OIL)],
      // Priced per kilogram against a litre base unit, with no bridging row.
      prices: { [OIL.id]: { price: '250.00', unit: 'kg' } },
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.actual.total).toBe(0);
    expect(report.unpriced_ingredients).toEqual([{ id: OIL.id, name: 'Oil' }]);
  });

  it('names each unpriced ingredient once however many movements it has', async () => {
    setup({
      movements: [
        movement(MovementType.waste, -1, SALT),
        movement(MovementType.waste, -2, SALT),
        movement(MovementType.order_deducted, -3, SALT),
      ],
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.unpriced_ingredients).toHaveLength(1);
  });

  // -------------------------------------------------------------------
  // Variance and percentages
  // -------------------------------------------------------------------
  it('variance is actual − theoretical, positive when more left the store room', async () => {
    setup({
      items: [item('prod-1', 'Thali', 2, '40.00')], // ₹80 theoretical
      movements: [movement(MovementType.order_deducted, -1, FLOUR)], // ₹100 actual
      prices: { [FLOUR.id]: { price: '100.00', unit: 'kg' } },
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.variance).toEqual({ amount: 2_000, percent: 25 });
  });

  it('variance.percent is 0 when theoretical is 0, never Infinity or NaN', async () => {
    setup({
      movements: [movement(MovementType.waste, -2, FLOUR)],
      prices: { [FLOUR.id]: { price: '100.00', unit: 'kg' } },
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.theoretical.total).toBe(0);
    expect(report.variance.amount).toBe(20_000);
    expect(report.variance.percent).toBe(0);
    expect(Number.isFinite(report.variance.percent)).toBe(true);
  });

  it('expresses both sides as a percentage of tax-inclusive Order.total revenue', async () => {
    setup({
      items: [item('prod-1', 'Thali', 5, '40.00')], // ₹200 theoretical
      movements: [movement(MovementType.order_deducted, -2, FLOUR)], // ₹200 actual
      prices: { [FLOUR.id]: { price: '100.00', unit: 'kg' } },
      revenue: '800.00',
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.revenue).toBe(80_000);
    expect(report.theoretical_pct_of_revenue).toBe(25);
    expect(report.actual_pct_of_revenue).toBe(25);
  });

  it('collapses both percentages to 0 when revenue is 0', async () => {
    setup({
      items: [item('prod-1', 'Thali', 1, '40.00')],
      movements: [movement(MovementType.waste, -1, FLOUR)],
      prices: { [FLOUR.id]: { price: '100.00', unit: 'kg' } },
      revenue: null,
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report.revenue).toBe(0);
    expect(report.theoretical_pct_of_revenue).toBe(0);
    expect(report.actual_pct_of_revenue).toBe(0);
  });

  it('rounds percentages to two decimals', async () => {
    setup({
      items: [item('prod-1', 'Thali', 1, '30.00')], // ₹30 theoretical
      revenue: '70.00',
    });

    const report = await service.report('2026-03-01', '2026-03-31');

    // 3000 / 7000 = 42.857142…% -> 42.86
    expect(report.theoretical_pct_of_revenue).toBe(42.86);
  });

  // -------------------------------------------------------------------
  // Window — node-local, never Date.now() arithmetic
  // -------------------------------------------------------------------
  it('bounds the window in the node timezone: a movement at 23:30 IST on `to` is inside', async () => {
    setup({ movements: [] });

    await service.report('2026-03-01', '2026-03-20');

    const range = prisma.stockMovement.findMany.mock.calls[0][0].where
      .created_at as { gte: Date; lt: Date };
    // 2026-03-20 23:30 IST === 2026-03-20T18:00:00Z
    const lateNight = new Date('2026-03-20T18:00:00.000Z');
    expect(range.gte.toISOString()).toBe('2026-02-28T18:30:00.000Z');
    expect(range.lt.toISOString()).toBe('2026-03-20T18:30:00.000Z');
    expect(range.gte.getTime()).toBeLessThanOrEqual(lateNight.getTime());
    expect(range.lt.getTime()).toBeGreaterThan(lateNight.getTime());
  });

  it('reads the boundary from Node.timezone, not the process TZ', async () => {
    setup({ movements: [] });
    node.timezone.mockResolvedValue('Europe/London');

    await service.report('2026-03-20', '2026-03-20');

    const range = prisma.stockMovement.findMany.mock.calls[0][0].where
      .created_at as { gte: Date; lt: Date };
    expect(range.gte.toISOString()).toBe('2026-03-20T00:00:00.000Z');
    expect(node.timezone).toHaveBeenCalled();
  });

  it('applies the same window to orders and to movements', async () => {
    setup({});

    await service.report('2026-03-01', '2026-03-31');

    const orderRange =
      prisma.orderItem.findMany.mock.calls[0][0].where.order.created_at;
    const movementRange =
      prisma.stockMovement.findMany.mock.calls[0][0].where.created_at;
    expect(orderRange).toEqual(movementRange);
  });

  it('defaults to the last 30 node-local days ending today', async () => {
    setup({});
    // Only `Date` is faked: faking the microtask queue would stall the awaited
    // Prisma mocks.
    jest.useFakeTimers({
      now: new Date('2026-03-20T19:00:00.000Z'),
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate', 'setTimeout'],
    });
    try {
      const report = await service.report();

      // 19:00Z on the 20th is already 00:30 on the 21st in IST — the default
      // window ends on the node's today, not the process's.
      expect(report.to).toBe('2026-03-21');
      expect(report.from).toBe('2026-02-20');
    } finally {
      jest.useRealTimers();
    }
  });

  it('echoes the resolved window back on the report', async () => {
    setup({});

    const report = await service.report('2026-03-01', '2026-03-31');

    expect(report).toMatchObject({ from: '2026-03-01', to: '2026-03-31' });
  });

  it('rejects an inverted window instead of silently reporting nothing', async () => {
    setup({});

    await expect(service.report('2026-03-31', '2026-03-01')).rejects.toThrow(
      BadRequestException,
    );
  });
});
