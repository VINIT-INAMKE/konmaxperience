import { AnalyticsService } from './analytics.service';

/** Mock Prisma Decimal -- supports Number() via valueOf() */
const dec = (n: number) => ({ valueOf: () => n, toNumber: () => n });

const mockPrisma = {
  order: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  orderItem: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
  quest: {
    findMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
  },
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockNode: { timezone: jest.Mock };

  beforeEach(() => {
    mockNode = { timezone: jest.fn().mockResolvedValue('Asia/Kolkata') };
    service = new AnalyticsService(mockPrisma as any, mockNode as any);
    jest.clearAllMocks();
    mockNode.timezone.mockResolvedValue('Asia/Kolkata');
  });

  // ---------------------------------------------------------------
  // parseDateRange -- day boundaries come from Node.timezone
  // ---------------------------------------------------------------
  describe('parseDateRange', () => {
    /** `parseDateRange` is private; reach it through a typed cast. */
    const rangeOf = (svc: AnalyticsService, from: string, to: string) =>
      (
        svc as unknown as {
          parseDateRange: (
            a: string,
            b: string,
          ) => Promise<{ start: Date; end: Date }>;
        }
      ).parseDateRange(from, to);

    it('bounds an IST day at 18:30 UTC either side', async () => {
      const range = await rangeOf(service, '2026-03-20', '2026-03-20');
      expect(range.start.toISOString()).toBe('2026-03-19T18:30:00.000Z');
      expect(range.end.toISOString()).toBe('2026-03-20T18:30:00.000Z');
    });

    it('day boundaries come from Node.timezone, not the process TZ', async () => {
      mockNode.timezone.mockResolvedValue('Europe/London');
      const range = await rangeOf(service, '2026-08-23', '2026-08-23');
      expect(range.start.toISOString()).toBe('2026-08-22T23:00:00.000Z');
      expect(range.end.toISOString()).toBe('2026-08-23T23:00:00.000Z');
    });
  });

  // ---------------------------------------------------------------
  // getSummary
  // ---------------------------------------------------------------
  describe('getSummary', () => {
    it('returns total_revenue, avg_food_cost_pct, total_orders, avg_order_value', async () => {
      mockPrisma.order.count.mockResolvedValue(3);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { total: dec(800) }, _count: { id: 2 } });
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { quantity: 2, product: { base_price: dec(250), recipe: { computed_cost: dec(75) } } },
        { quantity: 1, product: { base_price: dec(300), recipe: { computed_cost: dec(135) } } },
        { quantity: 3, product: { base_price: dec(200), recipe: { computed_cost: dec(50) } } },
      ]);

      const result = await service.getSummary('2026-03-20', '2026-03-20');

      expect(result.total_revenue).toBe(800); // o1 + o2 paid
      expect(result.total_orders).toBe(3);
      // revenue / paid orders (2), not / all orders
      expect(result.avg_order_value).toBeCloseTo(400);
      // food_cost_pct per item:
      // o1: (75/250)*100 = 30%, qty=2 -> weighted = 60
      // o2: (135/300)*100 = 45%, qty=1 -> weighted = 45
      // o3: (50/200)*100 = 25%, qty=3 -> weighted = 75
      // total weighted = 180, total qty = 6 -> avg = 30
      expect(result.avg_food_cost_pct).toBeCloseTo(30);
    });

    it('skips cancelled orders and unpaid orders for revenue', async () => {
      mockPrisma.order.count.mockResolvedValue(3);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { total: dec(500) }, _count: { id: 1 } });
      mockPrisma.orderItem.findMany.mockResolvedValue([]);

      const result = await service.getSummary('2026-03-20', '2026-03-20');

      // Only o1 is paid
      expect(result.total_revenue).toBe(500);
      // All 3 orders are counted (cancelled already excluded by query filter)
      expect(result.total_orders).toBe(3);
    });
  });

  // ---------------------------------------------------------------
  // getRevenueSeries
  // ---------------------------------------------------------------
  describe('getRevenueSeries', () => {
    it('groups orders by IST date and returns sorted array', async () => {
      // 3 orders on 2 different IST dates
      const date1 = new Date('2026-03-20T10:00:00+05:30');
      const date2 = new Date('2026-03-20T14:00:00+05:30');
      const date3 = new Date('2026-03-21T09:00:00+05:30');

      mockPrisma.order.findMany.mockResolvedValue([
        { id: 'o1', total: dec(500), created_at: date1, payment: { status: 'paid' } },
        { id: 'o2', total: dec(300), created_at: date2, payment: { status: 'paid' } },
        { id: 'o3', total: dec(200), created_at: date3, payment: { status: 'paid' } },
      ]);

      const result = await service.getRevenueSeries('2026-03-20', '2026-03-21');

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-03-20');
      expect(result[0].revenue).toBe(800); // o1 + o2
      expect(result[1].date).toBe('2026-03-21');
      expect(result[1].revenue).toBe(200); // o3
    });

    it('buckets by the node timezone, so a late-evening IST order lands on its IST day', async () => {
      // 20:00 UTC is 01:30 IST the next day, and still the same day in London.
      const lateEvening = new Date('2026-03-20T20:00:00Z');
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'o1',
          total: dec(100),
          created_at: lateEvening,
          payment: { status: 'paid' },
        },
      ]);

      const ist = await service.getRevenueSeries('2026-03-20', '2026-03-21');
      expect(ist[0].date).toBe('2026-03-21');

      mockNode.timezone.mockResolvedValue('Europe/London');
      const london = await service.getRevenueSeries('2026-03-20', '2026-03-21');
      expect(london[0].date).toBe('2026-03-20');
    });
  });

  // ---------------------------------------------------------------
  // getTopItems
  // ---------------------------------------------------------------
  describe('getTopItems', () => {
    it('returns top 10 items ordered by quantity_sold desc', async () => {
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { product_id: 'mi-1', quantity: 50, unit_price: dec(350) },
        { product_id: 'mi-2', quantity: 30, unit_price: dec(250) },
        { product_id: 'mi-3', quantity: 10, unit_price: dec(50) },
      ]);

      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'mi-1', name: 'Butter Chicken', base_price: dec(350) },
        { id: 'mi-2', name: 'Paneer Tikka', base_price: dec(250) },
        { id: 'mi-3', name: 'Naan', base_price: dec(50) },
      ]);

      const result = await service.getTopItems('2026-03-20', '2026-03-20');

      expect(result).toHaveLength(3);
      expect(result[0].product_id).toBe('mi-1');
      expect(result[0].quantity_sold).toBe(50);
      expect(result[0].revenue).toBe(50 * 350);
      expect(result[0].name).toBe('Butter Chicken');
    });
  });

  // ---------------------------------------------------------------
  // getChannelBreakdown
  // ---------------------------------------------------------------
  describe('getChannelBreakdown', () => {
    it('groups revenue by channel', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        { id: 'o1', channel: 'dine_in', total: dec(500), payment: { status: 'paid' } },
        { id: 'o2', channel: 'dine_in', total: dec(300), payment: { status: 'paid' } },
        { id: 'o3', channel: 'delivery', total: dec(400), payment: { status: 'paid' } },
        { id: 'o4', channel: 'takeaway', total: dec(200), payment: null },
      ]);

      const result = await service.getChannelBreakdown('2026-03-20', '2026-03-20');

      const dineIn = result.find((r) => r.channel === 'dine_in');
      expect(dineIn).toBeDefined();
      expect(dineIn!.revenue).toBe(800);
      expect(dineIn!.order_count).toBe(2);

      const delivery = result.find((r) => r.channel === 'delivery');
      expect(delivery).toBeDefined();
      expect(delivery!.revenue).toBe(400);
      expect(delivery!.order_count).toBe(1);

      const takeaway = result.find((r) => r.channel === 'takeaway');
      expect(takeaway).toBeDefined();
      expect(takeaway!.revenue).toBe(0); // no payment
      expect(takeaway!.order_count).toBe(1);
    });
  });

  // ---------------------------------------------------------------
  // getRecipeCosts
  // ---------------------------------------------------------------
  describe('getRecipeCosts', () => {
    it('returns recipes sorted by food_cost_pct desc', async () => {
      mockPrisma.orderItem.groupBy.mockResolvedValue([
        { product_id: 'mi-1', _sum: { quantity: 20 } },
        { product_id: 'mi-2', _sum: { quantity: 15 } },
      ]);

      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'mi-1',
          base_price: dec(200),
          recipe: { id: 'r-1', name: 'Pasta', computed_cost: dec(80) },
        },
        {
          id: 'mi-2',
          base_price: dec(300),
          recipe: { id: 'r-2', name: 'Steak', computed_cost: dec(180) },
        },
      ]);

      const result = await service.getRecipeCosts('2026-03-20', '2026-03-20');

      expect(result).toHaveLength(2);
      // Steak: 180/300 = 60%, Pasta: 80/200 = 40%
      expect(result[0].recipe_name).toBe('Steak');
      expect(result[0].food_cost_pct).toBe(60);
      expect(result[0].units_sold).toBe(15);
      expect(result[1].recipe_name).toBe('Pasta');
      expect(result[1].food_cost_pct).toBe(40);
      expect(result[1].units_sold).toBe(20);
    });
  });

  // ---------------------------------------------------------------
  // getWins
  // ---------------------------------------------------------------
  describe('getWins', () => {
    it('merges completed quests + validated tasks sorted by timestamp desc', async () => {
      mockPrisma.quest.findMany.mockResolvedValue([
        {
          id: 'q-1',
          title: 'Quest Alpha',
          updated_at: new Date('2026-03-21T14:00:00Z'),
          owner: { name: 'Alice', role: { name: 'Chef' } },
        },
        {
          id: 'q-2',
          title: 'Quest Beta',
          updated_at: new Date('2026-03-20T10:00:00Z'),
          owner: { name: 'Bob', role: { name: 'Manager' } },
        },
      ]);

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 't-1',
          title: 'Task Gamma',
          completed_at: new Date('2026-03-21T12:00:00Z'),
          owner: { name: 'Charlie', role: { name: 'Server' } },
        },
        {
          id: 't-2',
          title: 'Task Delta',
          completed_at: new Date('2026-03-20T08:00:00Z'),
          owner: { name: 'Diana', role: { name: 'BI Lead' } },
        },
      ]);

      const result = await service.getWins(20);

      expect(result).toHaveLength(4);
      // Sorted desc: q-1 (14:00), t-1 (12:00), q-2 (10:00 on 20th), t-2 (08:00 on 20th)
      expect(result[0].id).toBe('q-1');
      expect(result[0].type).toBe('quest_completed');
      expect(result[0].actor_name).toBe('Alice');
      expect(result[1].id).toBe('t-1');
      expect(result[1].type).toBe('task_validated');
      expect(result[2].id).toBe('q-2');
      expect(result[3].id).toBe('t-2');
    });

    it('respects cursor-based pagination', async () => {
      mockPrisma.quest.findMany.mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([]);

      const cursorTime = '2026-03-20T10:00:00Z';
      await service.getWins(10, cursorTime);

      // Verify cursor is applied to quest query
      expect(mockPrisma.quest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            updated_at: { lt: new Date(cursorTime) },
          }),
        }),
      );

      // Verify cursor is applied to task query
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            completed_at: { lt: new Date(cursorTime) },
          }),
        }),
      );
    });

    it('limits combined results to specified limit', async () => {
      mockPrisma.quest.findMany.mockResolvedValue([
        {
          id: 'q-1',
          title: 'Quest 1',
          updated_at: new Date('2026-03-21T14:00:00Z'),
          owner: { name: 'Alice', role: { name: 'Chef' } },
        },
      ]);
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 't-1',
          title: 'Task 1',
          completed_at: new Date('2026-03-21T12:00:00Z'),
          owner: { name: 'Bob', role: { name: 'Manager' } },
        },
        {
          id: 't-2',
          title: 'Task 2',
          completed_at: new Date('2026-03-20T12:00:00Z'),
          owner: { name: 'Charlie', role: { name: 'Server' } },
        },
      ]);

      const result = await service.getWins(2);

      // 3 total entries but limit=2
      expect(result).toHaveLength(2);
    });
  });
});
