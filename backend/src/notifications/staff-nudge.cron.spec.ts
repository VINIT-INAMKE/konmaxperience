import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { NotificationType, ShipmentStatus, TaskStatus } from '@prisma/client';
import {
  FAILED_SHIPMENT_LOOKBACK_DAYS,
  OPS_PERMISSION,
  SHIPMENTS_SCREEN_PATH,
  StaffNudgeCron,
} from './staff-nudge.cron';
import type { DispatchInput } from './notification-dispatcher.service';
import { ADVISORY_LOCK } from '../common/utils/advisory-lock';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import { mockPrisma, type MockPrisma } from '../test-utils/mock-providers';

/**
 * The nth argument of the nth call, typed. `jest.Mock['mock']['calls']` is
 * `any[][]`, so every direct index trips four `no-unsafe-*` rules; funnelling
 * them through one helper confines the cast to a single line (the idiom
 * `refunds.service.spec.ts` established).
 */
function callArg<T>(fn: jest.Mock, argIndex = 0, callIndex = 0): T {
  return fn.mock.calls[callIndex][argIndex] as T;
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

const OWNER = 'u0000000-0000-4000-8000-00000000owner';
const OPS_ONE = 'u0000000-0000-4000-8000-0000000000o1';
const OPS_TWO = 'u0000000-0000-4000-8000-0000000000o2';

function blockedTask(over: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Fix the walk-in freezer',
    blocked_reason: 'Waiting on the compressor part',
    owner_user_id: OWNER,
    updated_at: new Date('2026-08-20T04:00:00.000Z'),
    ...over,
  };
}

function shipmentRow(over: Record<string, unknown> = {}) {
  return {
    id: 'ship-1',
    status: ShipmentStatus.failed,
    awb: 'AWB123',
    order: { order_number: 1042 },
    ...over,
  };
}

describe('StaffNudgeCron', () => {
  let cron: StaffNudgeCron;
  let prisma: MockPrisma;
  let dispatcher: { dispatch: jest.Mock };
  let notifications: { getUsersByPermission: jest.Mock };
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockPrisma();
    advisoryLockRaw(prisma);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.shipment.findMany.mockResolvedValue([]);
    prisma.shipment.findUnique.mockResolvedValue(null);

    dispatcher = { dispatch: jest.fn().mockResolvedValue({ id: 'notif-1' }) };
    notifications = {
      getUsersByPermission: jest
        .fn()
        .mockResolvedValue([{ id: OPS_ONE }, { id: OPS_TWO }]),
    };

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    cron = new StaffNudgeCron(
      prisma as any,
      dispatcher as any,
      notifications as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('schedule and lock', () => {
    it('runs hourly in the node timezone', () => {
      const options = Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        StaffNudgeCron.prototype.sweep,
      ) as { cronTime: string; timeZone: string };

      expect(options.cronTime).toBe('0 * * * *');
      expect(options.timeZone).toBe(DEFAULT_NODE_TIMEZONE);
    });

    it('takes the reserved registry id and releases it', async () => {
      await cron.sweep();

      const acquire = callArg<{ text: string; values: unknown[] }>(
        prisma.$queryRaw,
      );
      const release = callArg<{ text: string; values: unknown[] }>(
        prisma.$queryRaw,
        0,
        1,
      );

      expect(acquire.text).toContain('pg_try_advisory_lock');
      expect(acquire.values).toEqual([ADVISORY_LOCK.STAFF_NUDGE_SWEEP]);
      expect(release.text).toContain('pg_advisory_unlock');
      expect(release.values).toEqual([ADVISORY_LOCK.STAFF_NUDGE_SWEEP]);
      expect(ADVISORY_LOCK.STAFF_NUDGE_SWEEP).toBe(6_350_004);
    });

    it('short-circuits the whole sweep when another instance holds the lock', async () => {
      advisoryLockRaw(prisma, false);

      await cron.sweep();

      expect(prisma.task.findMany).not.toHaveBeenCalled();
      expect(prisma.shipment.findMany).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('lock held by another instance'),
      );
    });

    it('never rejects when the lock query itself throws', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection reset'));

      await expect(cron.sweep()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('connection reset'),
        expect.stringContaining('Error: connection reset'),
      );
    });
  });

  describe('blocked tasks', () => {
    it('nudges the owner of a task that is still blocked', async () => {
      prisma.task.findMany.mockResolvedValue([blockedTask()]);

      const result = await cron.runSweep();

      expect(result.blocked_tasks).toBe(1);
      expect(callArg<{ where: unknown }>(prisma.task.findMany).where).toEqual({
        status: TaskStatus.blocked,
      });

      const input = callArg<DispatchInput>(dispatcher.dispatch);
      expect(input).toMatchObject({
        user_id: OWNER,
        type: NotificationType.task_blocked,
        title: 'Still blocked: Fix the walk-in freezer',
        body: 'Waiting on the compressor part',
        link_url: '/tasks/task-1',
        reference_id: 'task-1',
        reference_type: 'task',
        template_ctx: {
          subject: 'Fix the walk-in freezer',
          reason: 'Waiting on the compressor part',
        },
      });
    });

    it('counts nothing on the second sweep, because the cooldown suppressed it', async () => {
      prisma.task.findMany.mockResolvedValue([blockedTask()]);
      // The dispatcher owns the cooldown and answers `null` when it blocks.
      dispatcher.dispatch
        .mockResolvedValueOnce({ id: 'notif-1' })
        .mockResolvedValueOnce(null);

      const first = await cron.runSweep();
      const second = await cron.runSweep();

      expect(first.blocked_tasks).toBe(1);
      expect(second.blocked_tasks).toBe(0);
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    });

    it('skips a task with no owner', async () => {
      prisma.task.findMany.mockResolvedValue([
        blockedTask({ owner_user_id: null }),
      ]);

      const result = await cron.runSweep();

      expect(result.blocked_tasks).toBe(0);
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('falls back to a readable body and template param with no reason', async () => {
      prisma.task.findMany.mockResolvedValue([
        blockedTask({ blocked_reason: null }),
      ]);

      await cron.runSweep();

      const input = callArg<DispatchInput>(dispatcher.dispatch);
      expect(input.body).toBe(
        'This task has been blocked with no reason recorded.',
      );
      expect(input.template_ctx).toEqual({
        subject: 'Fix the walk-in freezer',
        reason: 'no reason recorded',
      });
    });

    it('keeps sweeping when one task dispatch throws', async () => {
      prisma.task.findMany.mockResolvedValue([
        blockedTask(),
        blockedTask({ id: 'task-2' }),
      ]);
      dispatcher.dispatch
        .mockRejectedValueOnce(new Error('notification write failed'))
        .mockResolvedValueOnce({ id: 'notif-2' });

      const result = await cron.runSweep();

      expect(result.blocked_tasks).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('notification write failed'),
      );
    });
  });

  describe('failed shipments', () => {
    it('nudges every MANAGE_OPS holder about a failed shipment', async () => {
      prisma.shipment.findMany.mockResolvedValue([shipmentRow()]);

      const result = await cron.runSweep();

      expect(result.failed_shipments).toBe(2);
      expect(notifications.getUsersByPermission).toHaveBeenCalledWith(
        OPS_PERMISSION,
      );
      expect(
        dispatcher.dispatch.mock.calls.map(
          (call) => (call[0] as DispatchInput).user_id,
        ),
      ).toEqual([OPS_ONE, OPS_TWO]);

      const input = callArg<DispatchInput>(dispatcher.dispatch);
      expect(input).toMatchObject({
        type: NotificationType.shipment_failed,
        title: 'Shipment failed: Order 1042',
        link_url: SHIPMENTS_SCREEN_PATH,
        reference_id: 'ship-1',
        reference_type: 'shipment',
        template_ctx: { subject: 'Order 1042', status: ShipmentStatus.failed },
      });
      expect(input.body).toContain('AWB123');
    });

    it('links to the staff shipments screen Phase 34 actually shipped', () => {
      expect(SHIPMENTS_SCREEN_PATH).toBe('/shipments');
    });

    it('reads only failed and rto shipments updated inside the lookback window', async () => {
      const before = Date.now();
      await cron.runSweep();

      const where = callArg<{
        status: { in: ShipmentStatus[] };
        updated_at: { gte: Date };
      }>(prisma.shipment.findMany).where;

      expect(where.status.in).toEqual([
        ShipmentStatus.failed,
        ShipmentStatus.rto,
      ]);
      const windowMs = FAILED_SHIPMENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
      expect(where.updated_at.gte.getTime()).toBeGreaterThanOrEqual(
        before - windowMs,
      );
      expect(where.updated_at.gte.getTime()).toBeLessThanOrEqual(
        Date.now() - windowMs + 1000,
      );
    });

    it('nudges nobody when nothing is failing — a delivered shipment is not selected', async () => {
      prisma.shipment.findMany.mockResolvedValue([]);

      const result = await cron.runSweep();

      expect(result.failed_shipments).toBe(0);
      expect(notifications.getUsersByPermission).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('warns when a shipment is failing and nobody holds the permission', async () => {
      prisma.shipment.findMany.mockResolvedValue([shipmentRow()]);
      notifications.getUsersByPermission.mockResolvedValue([]);

      const result = await cron.runSweep();

      expect(result.failed_shipments).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(OPS_PERMISSION),
      );
    });

    it('says "(none)" rather than "null" when the parcel never got an AWB', async () => {
      prisma.shipment.findMany.mockResolvedValue([
        shipmentRow({ awb: null, status: ShipmentStatus.rto }),
      ]);

      await cron.runSweep();

      const input = callArg<DispatchInput>(dispatcher.dispatch);
      expect(input.body).toContain('AWB (none) is rto');
      expect(input.title).toBe('Shipment rto: Order 1042');
    });
  });

  describe('leg isolation', () => {
    it('logs a throwing leg and still runs the other one', async () => {
      prisma.task.findMany.mockRejectedValue(new Error('task query exploded'));
      prisma.shipment.findMany.mockResolvedValue([shipmentRow()]);

      const result = await cron.runSweep();

      expect(result.blocked_tasks).toBe(0);
      expect(result.failed_shipments).toBe(2);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('task query exploded'),
      );
    });

    it('releases the lock and logs the counts through the cron entry point', async () => {
      prisma.task.findMany.mockResolvedValue([blockedTask()]);
      prisma.shipment.findMany.mockResolvedValue([shipmentRow()]);

      await cron.sweep();

      expect(logSpy).toHaveBeenCalledWith(
        'Staff nudge sweep sent 1 blocked-task and 2 failed-shipment notification(s)',
      );
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('shipment.status_changed listener', () => {
    const payload = (status: string) => ({
      node_id: 'node-1',
      occurred_at: new Date().toISOString(),
      actor: { user_id: null, role_code: null },
      shipmentId: 'ship-1',
      orderId: 'order-1',
      status,
      awb: 'AWB123',
    });

    it('nudges on the transition without waiting for the next sweep', async () => {
      prisma.shipment.findUnique.mockResolvedValue(shipmentRow());

      await cron.handleShipmentStatusChanged(payload('failed') as any);

      expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
      expect(callArg<DispatchInput>(dispatcher.dispatch)).toMatchObject({
        type: NotificationType.shipment_failed,
        reference_id: 'ship-1',
        link_url: SHIPMENTS_SCREEN_PATH,
      });
    });

    it('ignores a status that is not failed or rto, without reading the row', async () => {
      await cron.handleShipmentStatusChanged(payload('delivered') as any);

      expect(prisma.shipment.findUnique).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('drops the nudge when the row moved on before the handler ran', async () => {
      prisma.shipment.findUnique.mockResolvedValue(
        shipmentRow({ status: ShipmentStatus.in_transit }),
      );

      await cron.handleShipmentStatusChanged(payload('failed') as any);

      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('never rejects when the read fails', async () => {
      prisma.shipment.findUnique.mockRejectedValue(new Error('db down'));

      await expect(
        cron.handleShipmentStatusChanged(payload('rto') as any),
      ).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('db down'));
    });
  });
});
