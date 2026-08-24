import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import {
  LOW_STOCK_BRIEF_LIMIT,
  MISSING_CLOSE_BULLET,
  MORNING_BRIEF_LINK_URL,
  MORNING_BRIEF_REFERENCE_TYPE,
  MorningBriefService,
  READINESS_WINDOW_DAYS,
  STALE_DECISION_DAYS,
  readCloseMetrics,
} from './morning-brief.service';
import { AiProviderResolver } from '../ai-provider.resolver';
import { PrismaService } from '../../prisma/prisma.service';
import { NodeService } from '../../node/node.service';
import { ReadinessService } from '../../readiness/readiness.service';
import { InventoryService } from '../../inventory/inventory.service';
import { NotificationDispatcher } from '../../notifications/notification-dispatcher.service';
import { SETTING_DEFAULTS } from '../../settings/settings.service';
import { DAILY_CLOSE_METRICS_VERSION } from '../../daily-close/daily-close.service';
import {
  mockAiProvider,
  mockAiResolver,
  mockNodeService,
  mockPrisma,
  provideAi,
  type MockPrisma,
} from '../../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const DAY = '2026-08-24';

/** 07:00 on the day *after* {@link DAY}, in the seeded `Asia/Kolkata` zone. */
const NOW = new Date('2026-08-25T01:30:00.000Z');

/**
 * A v1 `DailyCloseMetrics` payload, trimmed to the blocks the brief reads.
 * Every money field is integer paise, exactly as the close persists it.
 */
function closeMetrics(overrides: Record<string, unknown> = {}) {
  return {
    version: DAILY_CLOSE_METRICS_VERSION,
    business_date: DAY,
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    orders: {
      total: 12,
      revenue_paise: 1_840_050,
      by_channel: [
        { channel: 'storefront', orders: 9, revenue_paise: 1_500_000 },
        { channel: 'pos', orders: 3, revenue_paise: 340_050 },
      ],
    },
    waste: { entries: 2, cost_paise: 45_075, by_reason: [] },
    shipments: { open: 1, failed: 0, delivered: 4, cancelled: 0 },
    ...overrides,
  };
}

function historyFor(code: string, points: { date: string; value: number }[]) {
  return { code, name: code, days: READINESS_WINDOW_DAYS, points };
}

/**
 * `mockAiResolver` predates `AiProviderResolver.settings()` (it lives in
 * `test-utils`, which may not import from `src/ai/**`), so the `ai` block the
 * service reads is layered on here.
 */
function buildResolver(
  provider = mockAiProvider(),
  ai: Partial<(typeof SETTING_DEFAULTS)['ai']> = {},
) {
  return {
    ...mockAiResolver(provider),
    settings: jest.fn().mockResolvedValue({ ...SETTING_DEFAULTS.ai, ...ai }),
  };
}

function buildReadiness(
  histories = [
    historyFor('SALES', [
      { date: '2026-08-18', value: 60 },
      { date: '2026-08-25', value: 72 },
    ]),
  ],
) {
  return {
    findAll: jest
      .fn()
      .mockResolvedValue(histories.map((h) => ({ code: h.code }))),
    history: jest.fn((code: string) =>
      Promise.resolve(histories.find((h) => h.code === code)),
    ),
  };
}

function buildInventory(rows: unknown[] = []) {
  return { getLowStock: jest.fn().mockResolvedValue(rows) };
}

function buildDispatcher(
  result: unknown = { id: 'n-1', channels: ['in_app'] },
) {
  return { dispatch: jest.fn().mockResolvedValue(result) };
}

/**
 * The nth `dispatch` payload, typed. `jest.Mock['mock']['calls']` is `any[][]`,
 * so every direct index trips the `no-unsafe-*` rules; funnelling them through
 * one helper confines the cast to a single line (the idiom
 * `daily-close.cron.spec.ts` established).
 */
function dispatched(
  dispatcher: ReturnType<typeof buildDispatcher>,
  callIndex = 0,
): { body: string; title: string; reference_id: string } {
  return dispatcher.dispatch.mock.calls[callIndex][0] as {
    body: string;
    title: string;
    reference_id: string;
  };
}

interface Harness {
  prisma?: MockPrisma;
  resolver?: ReturnType<typeof buildResolver>;
  readiness?: ReturnType<typeof buildReadiness>;
  inventory?: ReturnType<typeof buildInventory>;
  dispatcher?: ReturnType<typeof buildDispatcher>;
}

async function build(overrides: Harness = {}) {
  const prisma = overrides.prisma ?? basePrisma();
  const resolver = overrides.resolver ?? buildResolver();
  const readiness = overrides.readiness ?? buildReadiness();
  const inventory = overrides.inventory ?? buildInventory();
  const dispatcher = overrides.dispatcher ?? buildDispatcher();
  const node = mockNodeService(NODE_ID);

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      MorningBriefService,
      { provide: PrismaService, useValue: prisma },
      { provide: NodeService, useValue: node },
      { provide: ReadinessService, useValue: readiness },
      { provide: InventoryService, useValue: inventory },
      { provide: NotificationDispatcher, useValue: dispatcher },
      provideAi(AiProviderResolver, resolver),
    ],
  }).compile();

  return {
    service: moduleRef.get(MorningBriefService),
    prisma,
    resolver,
    readiness,
    inventory,
    dispatcher,
    node,
  };
}

function basePrisma(metrics: unknown = closeMetrics()): MockPrisma {
  const prisma = mockPrisma();
  prisma.dailyClose.findUnique.mockResolvedValue(
    metrics === null ? null : { metrics },
  );
  prisma.approval.count.mockResolvedValue(3);
  prisma.task.count.mockResolvedValue(1);
  prisma.decision.count.mockResolvedValue(2);
  prisma.shipment.groupBy.mockResolvedValue([
    { status: 'in_transit', _count: { _all: 4 } },
    { status: 'delivered', _count: { _all: 9 } },
    { status: 'rto', _count: { _all: 1 } },
    { status: 'failed', _count: { _all: 2 } },
    { status: 'cancelled', _count: { _all: 5 } },
  ]);
  prisma.user.findMany.mockResolvedValue([{ id: 'lead-1' }, { id: 'lead-2' }]);
  return prisma;
}

describe('MorningBriefService (RUN-05 — reads the close, never re-derives it)', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('readCloseMetrics', () => {
    it('accepts a v1 payload and rejects anything else', () => {
      expect(readCloseMetrics(closeMetrics())).not.toBeNull();
      expect(readCloseMetrics(null)).toBeNull();
      expect(readCloseMetrics('{}')).toBeNull();
      expect(readCloseMetrics([])).toBeNull();
      // A future close writes a bumped version; guessing at its shape is worse
      // than saying the numbers were not read.
      expect(readCloseMetrics(closeMetrics({ version: 2 }))).toBeNull();
      expect(readCloseMetrics(closeMetrics({ orders: 12 }))).toBeNull();
    });
  });

  describe('gather', () => {
    it('reads sales and waste from DailyClose.metrics and never touches Order', async () => {
      const { service, prisma } = await build();

      const { input, close_available } = await service.gather(DAY);

      expect(close_available).toBe(true);
      expect(input.business_date).toBe(DAY);
      expect(input.sales).toEqual({
        orders: 12,
        revenue: 18_400.5,
        by_channel: [
          { channel: 'storefront', orders: 9, revenue: 15_000 },
          { channel: 'pos', orders: 3, revenue: 3_400.5 },
        ],
      });
      expect(input.waste).toEqual({ entries: 2, cost: 450.75 });

      // The brief and the close can never disagree because the brief never asks
      // the orders table anything.
      for (const method of Object.values(prisma.order)) {
        expect(method).not.toHaveBeenCalled();
      }
      for (const method of Object.values(prisma.wasteLog)) {
        expect(method).not.toHaveBeenCalled();
      }
    });

    it('looks the close up by the node and the business date', async () => {
      const { service, prisma } = await build();

      await service.gather(DAY);

      expect(prisma.dailyClose.findUnique).toHaveBeenCalledWith({
        where: {
          node_id_business_date: {
            node_id: NODE_ID,
            business_date: new Date(`${DAY}T00:00:00.000Z`),
          },
        },
        select: { metrics: true },
      });
    });

    it('falls back to zeroes without throwing when the close is missing', async () => {
      const { service } = await build({ prisma: basePrisma(null) });

      const { input, close_available } = await service.gather(DAY);

      expect(close_available).toBe(false);
      expect(input.sales).toEqual({ orders: 0, revenue: 0, by_channel: [] });
      expect(input.waste).toEqual({ entries: 0, cost: 0 });
      // The live backlogs are still real — a missing close says nothing about
      // what is waiting for a lead this morning.
      expect(input.pending.approvals).toBe(3);
    });

    it('rejects a business date that is not a real calendar day', async () => {
      const { service } = await build();
      await expect(service.gather('2026-02-31')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('takes the readiness delta from the point seven days back', async () => {
      const { service, readiness } = await build();

      const { input } = await service.gather(DAY);

      expect(readiness.history).toHaveBeenCalledWith(
        'SALES',
        READINESS_WINDOW_DAYS,
      );
      expect(input.readiness).toEqual([
        { code: 'SALES', value: 72, delta_7d: 12 },
      ]);
    });

    it('reports a zero delta when no snapshot exists seven days back', async () => {
      const { service } = await build({
        readiness: buildReadiness([
          historyFor('QUALITY', [
            // A snapshot exists, but not on the comparison day.
            { date: '2026-08-21', value: 40 },
            { date: '2026-08-25', value: 55 },
          ]),
        ]),
      });

      const { input } = await service.gather(DAY);

      // Not `55 - 0`: a delta measured against a snapshot that was never
      // written reads as a collapse that never happened.
      expect(input.readiness).toEqual([
        { code: 'QUALITY', value: 55, delta_7d: 0 },
      ]);
    });

    it('drops a meter with no published points at all', async () => {
      const { service } = await build({
        readiness: buildReadiness([historyFor('OPS', [])]),
      });

      const { input } = await service.gather(DAY);

      expect(input.readiness).toEqual([]);
    });

    it('counts approvals, blocked tasks and decisions gone stale', async () => {
      const { service, prisma } = await build();

      const { input } = await service.gather(DAY);

      expect(input.pending).toEqual({
        approvals: 3,
        blockers: 1,
        stale_decisions: 2,
      });
      expect(prisma.approval.count).toHaveBeenCalledWith({
        where: { status: 'pending' },
      });
      expect(prisma.task.count).toHaveBeenCalledWith({
        where: { status: 'blocked' },
      });
      expect(prisma.decision.count).toHaveBeenCalledWith({
        where: {
          status: 'proposed',
          created_at: {
            lt: new Date(NOW.getTime() - STALE_DECISION_DAYS * 86_400_000),
          },
        },
      });
    });

    it('folds the live shipment backlog into open and failed', async () => {
      const { service } = await build();

      const { input } = await service.gather(DAY);

      // 4 in transit are open; rto + failed are failed; delivered and
      // cancelled are nobody's problem this morning.
      expect(input.shipments).toEqual({ open: 4, failed: 3 });
    });

    it('lists the worst shortfalls first and caps the list', async () => {
      const rows = Array.from(
        { length: LOW_STOCK_BRIEF_LIMIT + 3 },
        (_, i) => ({
          current_quantity: 1,
          ingredient: {
            name: `Ingredient ${String(i).padStart(2, '0')}`,
            base_unit: 'kg',
            min_stock_level: i + 2,
          },
        }),
      );
      const { service } = await build({ inventory: buildInventory(rows) });

      const { input } = await service.gather(DAY);

      expect(input.low_stock).toHaveLength(LOW_STOCK_BRIEF_LIMIT);
      expect(input.low_stock[0]).toEqual({
        ingredient: `Ingredient ${String(rows.length - 1).padStart(2, '0')} (kg)`,
        on_hand: 1,
        minimum: rows.length + 1,
      });
    });
  });

  describe('generateAndDeliver', () => {
    it('throws when the brief is disabled', async () => {
      const { service, dispatcher } = await build({
        resolver: buildResolver(mockAiProvider(), {
          morning_brief_enabled: false,
        }),
      });

      await expect(service.generateAndDeliver(DAY)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('delivers to exactly the configured role codes', async () => {
      const { service, prisma, dispatcher } = await build({
        resolver: buildResolver(mockAiProvider(), {
          morning_brief_role_codes: ['FOUNDER_ADMIN', 'BI_LEAD'],
        }),
      });

      const result = await service.generateAndDeliver(DAY);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          role: { code: { in: ['FOUNDER_ADMIN', 'BI_LEAD'] } },
        },
        select: { id: true },
      });
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
      expect(result.delivered_to).toBe(2);
      expect(result.recipients).toBe(2);
    });

    it('sends nothing when no role is configured to receive the brief', async () => {
      const { service, prisma, dispatcher } = await build({
        resolver: buildResolver(mockAiProvider(), {
          morning_brief_role_codes: [],
        }),
      });

      const result = await service.generateAndDeliver(DAY);

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect(result.delivered_to).toBe(0);
    });

    it('dispatches with the business date as the cooldown key', async () => {
      const provider = mockAiProvider();
      const { service, dispatcher } = await build({
        resolver: buildResolver(provider),
      });

      await service.generateAndDeliver(DAY);

      expect(dispatcher.dispatch).toHaveBeenCalledWith({
        user_id: 'lead-1',
        type: 'morning_brief',
        title: 'Yesterday closed clean.',
        body:
          'Yesterday closed clean.\n\n' +
          '• 12 orders, ₹18,400 revenue.\n' +
          '• No blockers open longer than a day.\n' +
          '• Two approvals waiting on BACKEND_LEAD.\n\n' +
          'Today:\n' +
          '→ Sign yesterday’s close.',
        link_url: MORNING_BRIEF_LINK_URL,
        reference_id: DAY,
        reference_type: MORNING_BRIEF_REFERENCE_TYPE,
        template_ctx: { headline: 'Yesterday closed clean.' },
      });
    });

    it('omits the actions block when the provider returned none', async () => {
      const provider = mockAiProvider({
        writeMorningBrief: jest.fn().mockResolvedValue({
          headline: 'Quiet day.',
          bullets: ['Nothing moved.'],
          actions: [],
          provider: 'heuristic',
          model: null,
          latency_ms: 1,
        }),
      });
      const { service, dispatcher } = await build({
        resolver: buildResolver(provider),
      });

      await service.generateAndDeliver(DAY);

      expect(dispatched(dispatcher).body).toBe(
        'Quiet day.\n\n• Nothing moved.',
      );
    });

    it('counts a second run the same day as delivered to nobody', async () => {
      // The dispatcher answers `null` on cooldown (20 h for `morning_brief`),
      // so a re-run is suppressed rather than duplicated.
      const { service, dispatcher } = await build({
        dispatcher: buildDispatcher(null),
      });

      const result = await service.generateAndDeliver(DAY);

      expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
      expect(result.delivered_to).toBe(0);
      expect(result.recipients).toBe(2);
    });

    it('keeps delivering after one recipient fails', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      const dispatcher = buildDispatcher();
      dispatcher.dispatch
        .mockRejectedValueOnce(new Error('Meta is down'))
        .mockResolvedValueOnce({ id: 'n-2', channels: ['in_app'] });
      const { service } = await build({ dispatcher });

      const result = await service.generateAndDeliver(DAY);

      expect(result.delivered_to).toBe(1);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('says so in a bullet when the close was never computed', async () => {
      const { service, dispatcher } = await build({
        prisma: basePrisma(null),
      });

      const result = await service.generateAndDeliver(DAY);

      expect(result.close_available).toBe(false);
      expect(result.bullets).toContain(MISSING_CLOSE_BULLET);
      expect(dispatched(dispatcher).body).toContain(MISSING_CLOSE_BULLET);
    });

    it('leaves the bullets alone when the close is present', async () => {
      const { service } = await build();

      const result = await service.generateAndDeliver(DAY);

      expect(result.close_available).toBe(true);
      expect(result.bullets).not.toContain(MISSING_CLOSE_BULLET);
      expect(result.business_date).toBe(DAY);
    });

    it('hands the provider the gathered input verbatim', async () => {
      const provider = mockAiProvider();
      const { service } = await build({ resolver: buildResolver(provider) });

      const { input } = await service.gather(DAY);
      provider.writeMorningBrief.mockClear();
      await service.generateAndDeliver(DAY);

      expect(provider.writeMorningBrief).toHaveBeenCalledWith(input);
    });
  });

  describe('previousBusinessDate', () => {
    it('answers yesterday in the node timezone', async () => {
      const { service } = await build();
      // 01:30Z on the 25th is 07:00 IST on the 25th, so the brief is for the 24th.
      await expect(service.previousBusinessDate(NOW)).resolves.toBe(DAY);
    });
  });

  describe('latestForUser', () => {
    it('returns the newest brief notification for that user only', async () => {
      const { service, prisma } = await build();
      prisma.notification.findFirst.mockResolvedValue({ id: 'n-9' });

      await expect(service.latestForUser('lead-1')).resolves.toEqual({
        id: 'n-9',
      });
      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: { user_id: 'lead-1', type: 'morning_brief' },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          title: true,
          body: true,
          link_url: true,
          reference_id: true,
          is_read: true,
          created_at: true,
        },
      });
    });
  });

  describe('enabled', () => {
    it('reads the flag out of the ai settings block', async () => {
      const on = await build();
      await expect(on.service.enabled()).resolves.toBe(true);

      const off = await build({
        resolver: buildResolver(mockAiProvider(), {
          morning_brief_enabled: false,
        }),
      });
      await expect(off.service.enabled()).resolves.toBe(false);
    });
  });
});
