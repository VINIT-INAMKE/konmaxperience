import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  DailyCloseStatus,
  OrderChannel,
  OrderStatus,
  PrepBatchStatus,
  Prisma,
  RefundStatus,
  ShipmentStatus,
} from '@prisma/client';
import {
  DAILY_CLOSE_METRICS_VERSION,
  DAILY_CLOSE_SIGNED_ACTION,
  DailyCloseService,
  RECONCILIATION_MISMATCH_ACTION,
  assertBusinessDateKey,
  dateToDayKey,
  dayKeyToDate,
  present,
  type DailyCloseMetrics,
} from './daily-close.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditInput } from '../audit/audit.service';
import {
  SETTING_DEFAULTS,
  SettingsService,
} from '../settings/settings.service';
import { NodeService } from '../node/node.service';
import {
  type MockPrisma,
  mockAuditService,
  mockNodeService,
  mockPrisma,
  mockSettings,
} from '../test-utils/mock-providers';

/**
 * The nth argument of the nth call, typed. `jest.Mock['mock']['calls']` is
 * `any[][]`, so every direct index trips four `no-unsafe-*` rules; funnelling
 * them through one helper confines the cast to a single line (the idiom
 * `refunds.service.spec.ts` established).
 */
function callArg<T>(fn: jest.Mock, argIndex = 0, callIndex = 0): T {
  return fn.mock.calls[callIndex][argIndex] as T;
}

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const DAY = '2026-08-24';
const CLOSE_ID = 'close-1';
const USER_ID = 'user-1';

/** 2026-08-24 in Asia/Kolkata (UTC+05:30) runs 2026-08-23T18:30Z → 2026-08-24T18:30Z. */
const WINDOW_START = new Date('2026-08-23T18:30:00.000Z');
const WINDOW_END = new Date('2026-08-24T18:30:00.000Z');

const d = (rupees: string) => new Prisma.Decimal(rupees);

/**
 * Three channels whose components reconcile: on the storefront line
 * `subtotal − discount + shipping === total` (P5a decision 1), and on the two
 * POS lines `subtotal === total`. The spec asserts that identity so a future
 * change to the money rule fails here rather than in a signed artefact.
 */
function channelRows() {
  return [
    {
      channel: OrderChannel.dine_in,
      _count: { _all: 3 },
      _sum: {
        total: d('1500.00'),
        subtotal: d('1500.00'),
        channel_modifier_amount: d('0.00'),
        discount_amount: d('0.00'),
        shipping_amount: d('0.00'),
        tax_amount: d('71.43'),
      },
    },
    {
      channel: OrderChannel.takeaway,
      _count: { _all: 2 },
      _sum: {
        total: d('800.00'),
        subtotal: d('800.00'),
        channel_modifier_amount: d('0.00'),
        discount_amount: d('0.00'),
        shipping_amount: d('0.00'),
        tax_amount: d('38.10'),
      },
    },
    {
      channel: OrderChannel.delivery,
      _count: { _all: 1 },
      _sum: {
        total: d('640.00'),
        subtotal: d('600.00'),
        channel_modifier_amount: d('0.00'),
        discount_amount: d('50.00'),
        shipping_amount: d('90.00'),
        tax_amount: d('30.48'),
      },
    },
  ];
}

function closeRow(over: Record<string, unknown> = {}) {
  return {
    id: CLOSE_ID,
    node_id: NODE_ID,
    business_date: dayKeyToDate(DAY),
    status: DailyCloseStatus.open,
    metrics: { version: DAILY_CLOSE_METRICS_VERSION },
    notes: null,
    signed_by: null,
    signed_at: null,
    created_at: new Date('2026-08-24T19:15:00.000Z'),
    updated_at: new Date('2026-08-24T19:15:00.000Z'),
    ...over,
  };
}

/** Stubs every read `gather()` issues, routed by argument so array order never matters. */
function stubGather(prisma: MockPrisma): void {
  prisma.order.groupBy.mockResolvedValue(channelRows());
  prisma.order.count.mockImplementation((args: any) =>
    Promise.resolve(args?.where?.status === OrderStatus.cancelled ? 2 : 1),
  );
  prisma.refund.aggregate.mockResolvedValue({
    _count: { _all: 1 },
    _sum: { amount: d('250.00') },
  });
  prisma.wasteLog.groupBy.mockResolvedValue([
    {
      reason: 'over_prep',
      _count: { _all: 1 },
      _sum: { cost_impact: d('40.00') },
    },
    {
      reason: 'spoilage',
      _count: { _all: 2 },
      _sum: { cost_impact: d('120.50') },
    },
  ]);
  prisma.prepBatch.count.mockImplementation((args: any) =>
    Promise.resolve(args?.where?.status === PrepBatchStatus.depleted ? 4 : 11),
  );
  prisma.auditEvent.aggregate.mockResolvedValue({
    _count: { _all: 3 },
    _max: { created_at: new Date('2026-08-24T21:00:00.000Z') },
  });
  prisma.ingredientStock.count.mockResolvedValue(42);
  prisma.shipment.groupBy.mockResolvedValue([
    { status: ShipmentStatus.in_transit, _count: { _all: 5 } },
    { status: ShipmentStatus.pending, _count: { _all: 2 } },
    { status: ShipmentStatus.delivered, _count: { _all: 9 } },
    { status: ShipmentStatus.failed, _count: { _all: 1 } },
    { status: ShipmentStatus.rto, _count: { _all: 1 } },
    { status: ShipmentStatus.cancelled, _count: { _all: 3 } },
  ]);
}

describe('DailyCloseService', () => {
  let service: DailyCloseService;
  let prisma: MockPrisma;
  let audit: ReturnType<typeof mockAuditService>;
  let settings: ReturnType<typeof mockSettings>;

  beforeEach(async () => {
    prisma = mockPrisma();
    audit = mockAuditService();
    settings = mockSettings();
    stubGather(prisma);
    prisma.dailyClose.findUnique.mockResolvedValue(null);
    prisma.dailyClose.upsert.mockImplementation((args: any) =>
      Promise.resolve(
        closeRow({ metrics: args.create?.metrics ?? args.update?.metrics }),
      ),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        DailyCloseService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: SettingsService, useValue: settings },
        { provide: NodeService, useValue: mockNodeService(NODE_ID) },
      ],
    }).compile();

    service = moduleRef.get(DailyCloseService);
  });

  /** The metrics object handed to `upsert`, typed. */
  function upsertedMetrics(): DailyCloseMetrics {
    return callArg<{ create: { metrics: DailyCloseMetrics } }>(
      prisma.dailyClose.upsert,
    ).create.metrics;
  }

  describe('business date parsing', () => {
    it('accepts a real calendar day and round-trips it through @db.Date', () => {
      expect(assertBusinessDateKey(DAY)).toBe(DAY);
      expect(dayKeyToDate(DAY).toISOString()).toBe('2026-08-24T00:00:00.000Z');
      expect(dateToDayKey(dayKeyToDate(DAY))).toBe(DAY);
    });

    it.each([
      '24-08-2026',
      '2026-8-24',
      '2026-02-31',
      '2026-13-01',
      'yesterday',
      '',
    ])('rejects %p with a 400', (bad) => {
      expect(() => assertBusinessDateKey(bad)).toThrow(BadRequestException);
    });

    it('presents business_date as the YYYY-MM-DD the API speaks', () => {
      expect(present(closeRow() as any).business_date).toBe(DAY);
    });
  });

  describe('computeAndUpsert', () => {
    it('sums revenue per channel and in total, in integer paise', async () => {
      await service.computeAndUpsert(DAY);

      const metrics = upsertedMetrics();
      expect(metrics.orders.by_channel).toEqual([
        {
          channel: OrderChannel.delivery,
          orders: 1,
          revenue_paise: 64_000,
        },
        { channel: OrderChannel.dine_in, orders: 3, revenue_paise: 150_000 },
        { channel: OrderChannel.takeaway, orders: 2, revenue_paise: 80_000 },
      ]);
      expect(metrics.orders.total).toBe(6);
      expect(metrics.orders.revenue_paise).toBe(294_000);
      // The headline and the breakdown are the same number by construction.
      expect(
        metrics.orders.by_channel.reduce((s, r) => s + r.revenue_paise, 0),
      ).toBe(metrics.orders.revenue_paise);
    });

    it('carries the components revenue reconciles from, with GST carved out', async () => {
      await service.computeAndUpsert(DAY);

      const { orders } = upsertedMetrics();
      expect(orders.subtotal_paise).toBe(290_000);
      expect(orders.discount_paise).toBe(5_000);
      expect(orders.shipping_paise).toBe(9_000);
      expect(orders.channel_modifier_paise).toBe(0);
      // P5a decision 1 — `total = subtotal − discount + shipping`, tax inclusive.
      expect(
        orders.subtotal_paise - orders.discount_paise + orders.shipping_paise,
      ).toBe(orders.revenue_paise);
      expect(orders.tax_paise).toBe(14_001);
      expect(orders.net_revenue_paise).toBe(294_000 - 14_001);
    });

    it('reports cancelled, refunded and processed refunds as their own lines', async () => {
      await service.computeAndUpsert(DAY);

      const { orders } = upsertedMetrics();
      expect(orders.cancelled).toBe(2);
      expect(orders.refunded).toBe(1);
      expect(orders.refunds).toBe(1);
      expect(orders.refund_amount_paise).toBe(25_000);
      // Only money that actually left counts: a pending or failed refund is not
      // a refund, so the aggregate is filtered on `processed`.
      expect(prisma.refund.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: RefundStatus.processed }),
        }),
      );
    });

    it('folds waste by reason, costliest first', async () => {
      await service.computeAndUpsert(DAY);

      const { waste } = upsertedMetrics();
      expect(waste.entries).toBe(3);
      expect(waste.cost_paise).toBe(16_050);
      expect(waste.by_reason).toEqual([
        { reason: 'spoilage', entries: 2, cost_paise: 12_050 },
        { reason: 'over_prep', entries: 1, cost_paise: 4_000 },
      ]);
    });

    it('folds shipments into open, failed, delivered and cancelled', async () => {
      await service.computeAndUpsert(DAY);

      // `rto` is a failure with a return leg, so it lands in `failed`;
      // `cancelled` is deliberately in none of the first three.
      expect(upsertedMetrics().shipments).toEqual({
        open: 7,
        failed: 2,
        delivered: 9,
        cancelled: 3,
      });
    });

    it('reads the reconciliation mismatch audit rows for the drift figures', async () => {
      await service.computeAndUpsert(DAY);

      expect(prisma.auditEvent.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: RECONCILIATION_MISMATCH_ACTION,
          }),
        }),
      );
      expect(upsertedMetrics().stock_reconciliation).toEqual({
        checked: 42,
        drifted: 3,
        ran_at: '2026-08-24T21:00:00.000Z',
      });
    });

    it('leaves ran_at null on a clean night, because drift is the only thing recorded', async () => {
      prisma.auditEvent.aggregate.mockResolvedValue({
        _count: { _all: 0 },
        _max: { created_at: null },
      });

      await service.computeAndUpsert(DAY);

      expect(upsertedMetrics().stock_reconciliation).toEqual({
        checked: 42,
        drifted: 0,
        ran_at: null,
      });
    });

    it('counts prep batches created and, of those, the ones already depleted', async () => {
      await service.computeAndUpsert(DAY);

      expect(upsertedMetrics().batches).toEqual({ created: 11, depleted: 4 });
    });

    it('bounds every window on the node-local day, never on a rolling 24 hours', async () => {
      await service.computeAndUpsert(DAY);

      const groupByArgs = callArg<{
        where: { node_id: string; created_at: { gte: Date; lt: Date } };
      }>(prisma.order.groupBy);
      expect(groupByArgs.where.node_id).toBe(NODE_ID);
      expect(groupByArgs.where.created_at.gte).toEqual(WINDOW_START);
      expect(groupByArgs.where.created_at.lt).toEqual(WINDOW_END);

      const metrics = upsertedMetrics();
      expect(metrics.window).toEqual({
        start: WINDOW_START.toISOString(),
        end: WINDOW_END.toISOString(),
      });
      expect(metrics.business_date).toBe(DAY);
      expect(metrics.timezone).toBe('Asia/Kolkata');
      expect(metrics.currency).toBe('INR');
      expect(metrics.version).toBe(DAILY_CLOSE_METRICS_VERSION);
    });

    it('excludes cancelled and refunded orders from revenue', async () => {
      await service.computeAndUpsert(DAY);

      const args = callArg<{ where: { status: { notIn: OrderStatus[] } } }>(
        prisma.order.groupBy,
      );
      expect(args.where.status.notIn).toEqual([
        OrderStatus.cancelled,
        OrderStatus.refunded,
      ]);
    });

    it('upserts on (node, business_date) so a re-run refreshes instead of failing', async () => {
      await service.computeAndUpsert(DAY);

      const args = callArg<{
        where: {
          node_id_business_date: { node_id: string; business_date: Date };
        };
        update: { metrics: unknown };
      }>(prisma.dailyClose.upsert);
      expect(args.where.node_id_business_date).toEqual({
        node_id: NODE_ID,
        business_date: dayKeyToDate(DAY),
      });
      expect(args.update.metrics).toBeDefined();
    });

    it('is a no-op on a signed day — a frozen close is never recomputed', async () => {
      const signed = closeRow({
        status: DailyCloseStatus.signed,
        signed_by: USER_ID,
      });
      prisma.dailyClose.findUnique.mockResolvedValue(signed);

      const result = await service.computeAndUpsert(DAY);

      expect(result).toBe(signed);
      expect(prisma.dailyClose.upsert).not.toHaveBeenCalled();
      expect(prisma.order.groupBy).not.toHaveBeenCalled();
    });

    it('rejects a malformed date before any query runs', async () => {
      await expect(service.computeAndUpsert('2026-02-31')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.dailyClose.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('sign', () => {
    let tx: MockPrisma;

    beforeEach(() => {
      tx = mockPrisma();
      tx.dailyClose.findUnique.mockResolvedValue(closeRow());
      tx.dailyClose.update.mockImplementation((args: any) =>
        Promise.resolve(
          closeRow({
            status: DailyCloseStatus.signed,
            signed_by: USER_ID,
            signed_at: new Date('2026-08-25T04:00:00.000Z'),
            notes: args.data.notes,
          }),
        ),
      );
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));
      prisma.user.findUnique.mockResolvedValue({
        role: { code: 'FOUNDER_ADMIN' },
      });
    });

    it('flips the status and stamps the signatory', async () => {
      const signed = await service.sign(DAY, USER_ID, 'power cut at 19:00');

      expect(signed.status).toBe(DailyCloseStatus.signed);
      expect(tx.dailyClose.update).toHaveBeenCalledWith({
        where: { id: CLOSE_ID },
        data: expect.objectContaining({
          status: DailyCloseStatus.signed,
          signed_by: USER_ID,
          notes: 'power cut at 19:00',
        }),
      });
    });

    it('writes the AuditEvent on the same tx as the status flip', async () => {
      await service.sign(DAY, USER_ID, null);

      // Both writes must be on the transaction client, not the pooled one —
      // an audit row that survives a rolled-back signature is a lie.
      expect(tx.dailyClose.update).toHaveBeenCalledTimes(1);
      expect(prisma.dailyClose.update).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(callArg<unknown>(audit.record)).toBe(tx);

      const input = callArg<AuditInput>(audit.record, 1);
      expect(input).toEqual(
        expect.objectContaining({
          entity_type: 'daily_close',
          entity_id: CLOSE_ID,
          action: DAILY_CLOSE_SIGNED_ACTION,
          node_id: NODE_ID,
          actor_type: ActorType.user,
          actor_id: USER_ID,
          before: { status: DailyCloseStatus.open },
        }),
      );
      // The audit row carries the frozen metrics, so it stands alone even if the
      // DailyClose row is later archived.
      expect(input.after).toEqual(
        expect.objectContaining({
          status: DailyCloseStatus.signed,
          business_date: DAY,
          notes: null,
        }),
      );
    });

    it('throws ForbiddenException when the role is not a signer', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: { code: 'BACKEND_LEAD' },
      });

      await expect(service.sign(DAY, USER_ID, null)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('names the configured signer roles in the refusal', async () => {
      settings.get.mockResolvedValue({
        ...SETTING_DEFAULTS.daily_close,
        signer_role_codes: ['OPS_LEAD'],
      });
      prisma.user.findUnique.mockResolvedValue({
        role: { code: 'FOUNDER_ADMIN' },
      });

      await expect(service.sign(DAY, USER_ID, null)).rejects.toThrow(
        /Only OPS_LEAD may sign/,
      );
    });

    it('throws ForbiddenException when the user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.sign(DAY, USER_ID, null)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException on a second signature', async () => {
      tx.dailyClose.findUnique.mockResolvedValue(
        closeRow({ status: DailyCloseStatus.signed, signed_by: 'user-9' }),
      );

      await expect(service.sign(DAY, USER_ID, null)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.dailyClose.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the day was never computed', async () => {
      tx.dailyClose.findUnique.mockResolvedValue(null);

      await expect(service.sign(DAY, USER_ID, null)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('list and findByDate', () => {
    it('returns the newest business day first, scoped to the node', async () => {
      prisma.dailyClose.findMany.mockResolvedValue([closeRow()]);

      await service.list({ from: '2026-08-01', to: DAY, limit: 7 });

      expect(prisma.dailyClose.findMany).toHaveBeenCalledWith({
        where: {
          node_id: NODE_ID,
          business_date: {
            gte: dayKeyToDate('2026-08-01'),
            lte: dayKeyToDate(DAY),
          },
        },
        orderBy: { business_date: 'desc' },
        take: 7,
      });
    });

    it('caps the page at 100 and defaults to 30', async () => {
      prisma.dailyClose.findMany.mockResolvedValue([]);

      await service.list({ limit: 5000 });
      await service.list({});

      const take = (i: number) =>
        callArg<{ take: number }>(prisma.dailyClose.findMany, 0, i).take;
      expect(take(0)).toBe(100);
      expect(take(1)).toBe(30);
    });

    it('omits the date filter entirely when neither bound is given', async () => {
      prisma.dailyClose.findMany.mockResolvedValue([]);

      await service.list({});

      const args = callArg<{ where: Record<string, unknown> }>(
        prisma.dailyClose.findMany,
      );
      expect(args.where).toEqual({ node_id: NODE_ID });
    });

    it('404s a day the cron has not computed', async () => {
      prisma.dailyClose.findUnique.mockResolvedValue(null);

      await expect(service.findByDate(DAY)).rejects.toThrow(NotFoundException);
    });

    it('returns the stored row for a computed day', async () => {
      const row = closeRow();
      prisma.dailyClose.findUnique.mockResolvedValue(row);

      await expect(service.findByDate(DAY)).resolves.toBe(row);
    });
  });

  describe('today', () => {
    it('answers with the node-local day, not the UTC one', async () => {
      // 2026-08-24T19:15Z is already 2026-08-25 in Asia/Kolkata.
      await expect(
        service.today(new Date('2026-08-24T19:15:00.000Z')),
      ).resolves.toBe('2026-08-25');
    });
  });
});
