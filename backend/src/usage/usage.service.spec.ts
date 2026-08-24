import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsageEventType } from '@prisma/client';
import {
  SUMMARY_BUCKET_LIMIT,
  SUMMARY_DEFAULT_DAYS,
  SUMMARY_MAX_DAYS,
  UsageService,
} from './usage.service';
import { UsageController } from './usage.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { mockPrisma, MockPrisma } from '../test-utils/mock-providers';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { nodeDayKey } from '../common/utils/node-time';

const IST = 'Asia/Kolkata';

/** Route each `groupBy` call to a fixture keyed by its `by` tuple. */
function routeGroupBy(
  prisma: MockPrisma,
  fixtures: Record<string, unknown[]>,
): void {
  prisma.usageEvent.groupBy.mockImplementation((args: unknown) =>
    Promise.resolve(
      fixtures[((args as { by: string[] }).by ?? []).join(',')] ?? [],
    ),
  );
}

/** The args of the `groupBy` call whose `by` tuple matches. */
function groupByArgs(prisma: MockPrisma, by: string): any {
  const call = prisma.usageEvent.groupBy.mock.calls.find(
    (c: unknown[]) => ((c[0] as { by: string[] }).by ?? []).join(',') === by,
  );
  expect(call).toBeDefined();
  return call![0];
}

describe('UsageService', () => {
  let service: UsageService;
  let prisma: MockPrisma;

  const actor = { id: 'user-1', roleCode: 'BACKEND_LEAD' };

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsageService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsageService>(UsageService);
    jest.clearAllMocks();
    routeGroupBy(prisma, {});
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  describe('record', () => {
    it('writes path and nulls action for a page_view', async () => {
      prisma.usageEvent.create.mockResolvedValue({ id: 'ev-1' });

      await service.record(
        {
          event_type: UsageEventType.page_view,
          path: '/tasks',
          action: 'task.create',
        },
        actor,
      );

      expect(prisma.usageEvent.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-1',
          role_code: 'BACKEND_LEAD',
          event_type: UsageEventType.page_view,
          path: '/tasks',
          action: null,
          meta: undefined,
        },
      });
    });

    it('writes action and nulls path for an action event', async () => {
      prisma.usageEvent.create.mockResolvedValue({ id: 'ev-2' });

      await service.record(
        {
          event_type: UsageEventType.action,
          path: '/tasks',
          action: 'task.create',
          meta: { task_id: 't-1' },
        },
        actor,
      );

      expect(prisma.usageEvent.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-1',
          role_code: 'BACKEND_LEAD',
          event_type: UsageEventType.action,
          path: null,
          action: 'task.create',
          meta: { task_id: 't-1' },
        },
      });
    });

    it('resolves without throwing when the write rejects', async () => {
      prisma.usageEvent.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.record(
          { event_type: UsageEventType.page_view, path: '/tasks' },
          actor,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('summary — window', () => {
    it('bounds an explicit from..to on node-local midnights, so 23:30 IST on `to` is inside', async () => {
      const result = await service.summary({
        timeZone: IST,
        from: '2026-08-01',
        to: '2026-08-07',
      });

      const where = groupByArgs(prisma, 'role_code').where;
      const start = where.created_at.gte as Date;
      const end = where.created_at.lt as Date;

      // IST is UTC+05:30, so local midnight is 18:30Z on the previous day.
      expect(start.toISOString()).toBe('2026-07-31T18:30:00.000Z');
      expect(end.toISOString()).toBe('2026-08-07T18:30:00.000Z');

      const lateOnLastDay = new Date('2026-08-07T18:00:00.000Z'); // 23:30 IST
      expect(lateOnLastDay.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(lateOnLastDay.getTime()).toBeLessThan(end.getTime());

      expect(result.from).toBe('2026-08-01');
      expect(result.to).toBe('2026-08-07');
      expect(result.days).toBe(7);
    });

    it('still honours `days` with no from/to, ending on the node-local today', async () => {
      const result = await service.summary({ timeZone: IST, days: 7 });

      const today = nodeDayKey(IST, new Date());
      expect(result.to).toBe(today);
      expect(result.days).toBe(7);
      expect(result.daily).toHaveLength(7);
      expect(result.daily[6].date).toBe(today);
      // `from` is six days earlier — `days` counts inclusively.
      expect(
        (new Date(`${result.to}T00:00:00Z`).getTime() -
          new Date(`${result.from}T00:00:00Z`).getTime()) /
          86_400_000,
      ).toBe(6);
    });

    it('defaults to 30 days when no window is supplied at all', async () => {
      const result = await service.summary({ timeZone: IST });
      expect(result.days).toBe(SUMMARY_DEFAULT_DAYS);
      expect(result.daily).toHaveLength(SUMMARY_DEFAULT_DAYS);
    });

    it('anchors a `days` window on `to` when only `to` is given', async () => {
      const result = await service.summary({
        timeZone: IST,
        days: 3,
        to: '2026-08-07',
      });
      expect(result).toMatchObject({
        from: '2026-08-05',
        to: '2026-08-07',
        days: 3,
      });
    });

    it('runs `from`..today when only `from` is given', async () => {
      const today = nodeDayKey(IST, new Date());
      const result = await service.summary({
        timeZone: IST,
        from: today,
      });
      expect(result).toMatchObject({ from: today, to: today, days: 1 });
    });

    it('rejects an inverted window', async () => {
      await expect(
        service.summary({
          timeZone: IST,
          from: '2026-08-07',
          to: '2026-08-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an explicit window longer than the cap', async () => {
      await expect(
        service.summary({
          timeZone: IST,
          from: '2020-01-01',
          to: '2026-08-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('clamps a `days` request to the cap and to at least one day', async () => {
      expect((await service.summary({ timeZone: IST, days: 9999 })).days).toBe(
        SUMMARY_MAX_DAYS,
      );
      expect((await service.summary({ timeZone: IST, days: 0 })).days).toBe(1);
    });
  });

  describe('summary — buckets', () => {
    it('caps each bucket, filters to its event type and drops null keys', async () => {
      routeGroupBy(prisma, {
        role_code: [
          { role_code: 'BACKEND_LEAD', _count: { _all: 4 } },
          { role_code: 'CUSTOMER', _count: { _all: 9 } },
        ],
        path: [
          { path: '/tasks', _count: { _all: 3 } },
          { path: null, _count: { _all: 1 } },
        ],
        action: [
          { action: 'task.create', _count: { _all: 2 } },
          { action: null, _count: { _all: 5 } },
        ],
      });

      const result = await service.summary({
        timeZone: IST,
        from: '2026-08-01',
        to: '2026-08-02',
      });

      const pathArgs = groupByArgs(prisma, 'path');
      const actionArgs = groupByArgs(prisma, 'action');
      expect(pathArgs.take).toBe(SUMMARY_BUCKET_LIMIT);
      expect(pathArgs.where.event_type).toBe(UsageEventType.page_view);
      expect(pathArgs.where.path).toEqual({ not: null });
      expect(actionArgs.take).toBe(SUMMARY_BUCKET_LIMIT);
      expect(actionArgs.where.event_type).toBe(UsageEventType.action);
      expect(actionArgs.where.action).toEqual({ not: null });

      expect(result.by_role).toEqual([
        { role_code: 'BACKEND_LEAD', count: 4 },
        { role_code: 'CUSTOMER', count: 9 },
      ]);
      expect(result.by_path).toEqual([{ path: '/tasks', count: 3 }]);
      expect(result.by_action).toEqual([{ action: 'task.create', count: 2 }]);
    });

    it('returns empty buckets and a zero-filled series on a fresh install', async () => {
      const result = await service.summary({
        timeZone: IST,
        from: '2026-08-01',
        to: '2026-08-03',
      });

      expect(result).toEqual({
        days: 3,
        from: '2026-08-01',
        to: '2026-08-03',
        by_role: [],
        by_path: [],
        by_action: [],
        by_user: [],
        daily: [
          { date: '2026-08-01', count: 0 },
          { date: '2026-08-02', count: 0 },
          { date: '2026-08-03', count: 0 },
        ],
      });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('summary — by_user (RUN-04 last-seen)', () => {
    const groups = [
      {
        user_id: 'u-1',
        event_type: UsageEventType.page_view,
        _count: { _all: 12 },
        _max: { created_at: new Date('2026-08-07T09:00:00.000Z') },
      },
      {
        user_id: 'u-1',
        event_type: UsageEventType.action,
        _count: { _all: 3 },
        _max: { created_at: new Date('2026-08-07T18:00:00.000Z') },
      },
      {
        user_id: 'u-2',
        event_type: UsageEventType.page_view,
        _count: { _all: 5 },
        _max: { created_at: new Date('2026-08-02T10:00:00.000Z') },
      },
    ];

    beforeEach(() => {
      routeGroupBy(prisma, { 'user_id,event_type': groups });
      prisma.user.findMany.mockResolvedValue([
        { id: 'u-2', name: 'Bina', role: { code: 'BI_LEAD' } },
        { id: 'u-1', name: 'Asha', role: { code: 'BACKEND_LEAD' } },
      ]);
    });

    it('splits page views from actions, takes the newest last_seen and sorts by it', async () => {
      const result = await service.summary({
        timeZone: IST,
        from: '2026-08-01',
        to: '2026-08-07',
      });

      expect(result.by_user).toEqual([
        {
          user_id: 'u-1',
          name: 'Asha',
          role_code: 'BACKEND_LEAD',
          page_views: 12,
          actions: 3,
          last_seen_at: '2026-08-07T18:00:00.000Z',
        },
        {
          user_id: 'u-2',
          name: 'Bina',
          role_code: 'BI_LEAD',
          page_views: 5,
          actions: 0,
          last_seen_at: '2026-08-02T10:00:00.000Z',
        },
      ]);
    });

    it('excludes storefront traffic and resolves names in a single findMany', async () => {
      await service.summary({
        timeZone: IST,
        from: '2026-08-01',
        to: '2026-08-07',
      });

      expect(groupByArgs(prisma, 'user_id,event_type').where.user_id).toEqual({
        not: null,
      });
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['u-1', 'u-2'] } },
        select: { id: true, name: true, role: { select: { code: true } } },
      });
    });

    it('omits a user with no event inside the window', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u-1', name: 'Asha', role: { code: 'BACKEND_LEAD' } },
        { id: 'u-2', name: 'Bina', role: { code: 'BI_LEAD' } },
      ]);
      routeGroupBy(prisma, {
        'user_id,event_type': groups.filter((g) => g.user_id === 'u-1'),
      });

      const result = await service.summary({
        timeZone: IST,
        from: '2026-08-01',
        to: '2026-08-07',
      });

      expect(result.by_user.map((u) => u.user_id)).toEqual(['u-1']);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['u-1'] } } }),
      );
    });
  });

  describe('summary — daily series', () => {
    it('fills the days the raw group left out and keeps the ones it returned', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { date: '2026-08-02', count: 7 },
        { date: '2026-08-04', count: 2 },
      ]);

      const result = await service.summary({
        timeZone: IST,
        from: '2026-08-01',
        to: '2026-08-04',
      });

      expect(result.daily).toEqual([
        { date: '2026-08-01', count: 0 },
        { date: '2026-08-02', count: 7 },
        { date: '2026-08-03', count: 0 },
        { date: '2026-08-04', count: 2 },
      ]);
    });

    it('passes the node timezone, both window bounds and page_view to the raw group', async () => {
      await service.summary({
        timeZone: IST,
        from: '2026-08-01',
        to: '2026-08-04',
      });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const [, ...values] = prisma.$queryRaw.mock.calls[0] as unknown[];
      expect(values[0]).toBe(IST);
      expect((values[1] as Date).toISOString()).toBe(
        '2026-07-31T18:30:00.000Z',
      );
      expect((values[2] as Date).toISOString()).toBe(
        '2026-08-04T18:30:00.000Z',
      );
      expect(values[3]).toBe(UsageEventType.page_view);
    });
  });
});

describe('UsageController', () => {
  const build = () => {
    const usage = { summary: jest.fn().mockResolvedValue(null) };
    const node = { timezone: jest.fn().mockResolvedValue(IST) };
    return {
      usage,
      node,
      controller: new UsageController(
        usage as unknown as UsageService,
        node as unknown as NodeService,
      ),
    };
  };

  it('leaves the ingest endpoint open to every authenticated staff role', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        UsageController.prototype.record,
      ),
    ).toBeUndefined();
  });

  it('requires MANAGE_SYSTEM for the summary roll-up', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        UsageController.prototype.summary,
      ),
    ).toBe(Permission.MANAGE_SYSTEM);
  });

  it('resolves the node timezone and forwards from/to alongside days', async () => {
    const { usage, node, controller } = build();

    await controller.summary({
      days: '90',
      from: '2026-08-01',
      to: '2026-08-07',
    });

    expect(node.timezone).toHaveBeenCalledTimes(1);
    expect(usage.summary).toHaveBeenCalledWith({
      timeZone: IST,
      days: 90,
      from: '2026-08-01',
      to: '2026-08-07',
    });
  });

  it('keeps the pre-P6 `days` contract: junk falls back to 30, huge values cap', async () => {
    const { usage, controller } = build();

    await controller.summary({});
    expect(usage.summary).toHaveBeenLastCalledWith(
      expect.objectContaining({ days: SUMMARY_DEFAULT_DAYS }),
    );

    await controller.summary({ days: 'nonsense' });
    expect(usage.summary).toHaveBeenLastCalledWith(
      expect.objectContaining({ days: SUMMARY_DEFAULT_DAYS }),
    );

    await controller.summary({ days: '9999' });
    expect(usage.summary).toHaveBeenLastCalledWith(
      expect.objectContaining({ days: SUMMARY_MAX_DAYS }),
    );
  });
});
