import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { NotificationType, ShipmentStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { NotificationsService } from './notifications.service';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import { ADVISORY_LOCK, withAdvisoryLock } from '../common/utils/advisory-lock';
import {
  DomainEvent,
  type DomainEventPayloads,
} from '../common/events/domain-events';

/**
 * Where the staff shipments queue lives. Phase 34 landed it at the root ops
 * path (`frontend/app/(ops)/shipments/`), not under `/operations/` — one string
 * here so a route change is one edit.
 */
export const SHIPMENTS_SCREEN_PATH = '/shipments';

/** The queue is theirs, so the nudge is theirs (SPEC §3 permission codes). */
export const OPS_PERMISSION = 'MANAGE_OPS';

/**
 * Money already collected against a parcel that is not moving. `cancelled` is
 * deliberately absent: it is a decision somebody already took.
 */
export const STUCK_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  ShipmentStatus.failed,
  ShipmentStatus.rto,
];

/**
 * How far back the shipment sweep looks, on `updated_at`.
 *
 * Deviation from the plan's snippet, which bounded the query by status alone.
 * `failed` and `rto` are terminal for a shipment that nobody re-books, so an
 * unbounded query re-nudges every failure in the node's history every cooldown
 * window, for ever — and blasts the whole backlog at every `MANAGE_OPS` holder
 * on the first sweep after deploy. `updated_at` moves whenever the status does,
 * so this window means "failed recently and still failing"; anything older is
 * queue work the Shipments screen already shows.
 */
export const FAILED_SHIPMENT_LOOKBACK_DAYS = 14;

/** What one sweep did, for the log line and for the spec. */
export interface StaffNudgeSweepResult {
  blocked_tasks: number;
  failed_shipments: number;
}

/** The shipment shape both the sweep and the transition listener nudge on. */
interface NudgeableShipment {
  id: string;
  status: ShipmentStatus;
  awb: string | null;
  order: { order_number: number };
}

/** The event payload carries `status` as a plain string; narrow it here. */
function isStuckStatus(status: string): boolean {
  return (STUCK_SHIPMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * RUN-01's staff nudges, on one schedule and under one lock.
 *
 * Two of the four already have a path: `approval_pending` is swept by
 * `NotificationsCron.scanApprovalsPending` and `low_stock` is raised by the
 * `stock.low` domain event, and P6 Task 4 put both on `NotificationDispatcher`,
 * so they gained email and WhatsApp without a line here. This cron adds the two
 * with no sweep at all — tasks that *stayed* blocked, and shipments that failed
 * or came back RTO.
 *
 * Channel choice, quiet hours and the per-type cooldown all belong to the
 * dispatcher (P6 decision 9): this file decides only *who* and *about what*, and
 * counts a truthy `dispatch` result as sent — `null` means the cooldown
 * suppressed it, which is the normal case on every sweep after the first.
 *
 * The body runs under `ADVISORY_LOCK.STAFF_NUDGE_SWEEP`, so N API instances run
 * it once between them, and it never rejects — an unhandled rejection out of a
 * `@Cron` method would take the process down.
 */
@Injectable()
export class StaffNudgeCron {
  private readonly logger = new Logger(StaffNudgeCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Hourly, on the hour. A decorator cannot await `NodeService`, so the zone is
   * pinned to the seeded default exactly as `readiness.cron.ts` pins it; for an
   * hourly job the zone only matters to DST, which `Asia/Kolkata` does not have.
   */
  @Cron('0 * * * *', { timeZone: DEFAULT_NODE_TIMEZONE })
  async sweep(): Promise<void> {
    try {
      const result = await withAdvisoryLock(
        this.prisma,
        ADVISORY_LOCK.STAFF_NUDGE_SWEEP,
        () => this.runSweep(),
        this.logger,
      );

      if (result === null) {
        this.logger.log(
          'Staff nudge sweep skipped — lock held by another instance',
        );
        return;
      }

      this.logger.log(
        `Staff nudge sweep sent ${result.blocked_tasks} blocked-task and ` +
          `${result.failed_shipments} failed-shipment notification(s)`,
      );
    } catch (error) {
      this.logger.error(
        `Staff nudge sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Separated from the `@Cron` wrapper so a manual re-run (and a spec) can call
   * it without the lock.
   *
   * The legs are independent and isolated from each other: a failing shipment
   * query must not cost the blocker nudges. `allSettled`, then log the rejects.
   */
  async runSweep(): Promise<StaffNudgeSweepResult> {
    const [blocked, shipments] = await Promise.allSettled([
      this.nudgeBlockedTasks(),
      this.nudgeFailedShipments(),
    ]);

    return {
      blocked_tasks: this.settled(blocked, 'blocked tasks'),
      failed_shipments: this.settled(shipments, 'failed shipments'),
    };
  }

  /**
   * A task that is still `blocked` is nudged to its owner.
   *
   * `task.blocked` already fires as a domain event on the *transition*, and its
   * processor job writes the same `(user, task_blocked, task id)` triple — so
   * the dispatcher's 12 h cooldown makes this sweep the follow-up rather than a
   * duplicate, and no minimum age filter is needed here to get that. This sweep
   * exists for the state no event describes: a task that stayed blocked.
   */
  private async nudgeBlockedTasks(): Promise<number> {
    const blocked = await this.prisma.task.findMany({
      where: { status: TaskStatus.blocked },
      select: {
        id: true,
        title: true,
        blocked_reason: true,
        owner_user_id: true,
        updated_at: true,
      },
    });

    let sent = 0;
    for (const task of blocked) {
      // `Task.owner_user_id` is non-null in the schema, so this is a guard
      // against a future nullable column rather than today's data — but an
      // ownerless task must be skipped, not dispatched to `undefined`.
      if (!task.owner_user_id) continue;

      const reason = task.blocked_reason ?? 'no reason recorded';
      const dispatched = await this.safely(`task ${task.id}`, () =>
        this.dispatcher.dispatch({
          user_id: task.owner_user_id,
          type: NotificationType.task_blocked,
          title: `Still blocked: ${task.title}`,
          body:
            task.blocked_reason ??
            'This task has been blocked with no reason recorded.',
          link_url: `/tasks/${task.id}`,
          reference_id: task.id,
          reference_type: 'task',
          template_ctx: { subject: task.title, reason },
        }),
      );
      if (dispatched) sent += 1;
    }
    return sent;
  }

  /**
   * RUN-01's fourth nudge, and the one with no prior implementation:
   * `ShipmentStatus.failed` and `.rto` are money already collected against a
   * parcel that is not moving. Goes to every `MANAGE_OPS` holder — the
   * Shipments queue is theirs.
   */
  private async nudgeFailedShipments(): Promise<number> {
    const cutoff = new Date(
      Date.now() - FAILED_SHIPMENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );
    const failed = await this.prisma.shipment.findMany({
      where: {
        status: { in: [...STUCK_SHIPMENT_STATUSES] },
        updated_at: { gte: cutoff },
      },
      select: {
        id: true,
        status: true,
        awb: true,
        order: { select: { order_number: true } },
      },
    });
    if (failed.length === 0) return 0;

    const recipients =
      await this.notifications.getUsersByPermission(OPS_PERMISSION);
    if (recipients.length === 0) {
      this.logger.warn(
        `${failed.length} shipment(s) need attention but no active user holds ${OPS_PERMISSION}`,
      );
      return 0;
    }

    let sent = 0;
    for (const shipment of failed) {
      sent += await this.nudgeShipment(shipment, recipients);
    }
    return sent;
  }

  /**
   * The same nudge on the **transition**, so a failure raised at 09:05 does not
   * wait until 10:00 for the sweep to find it. The webhook and the manual
   * status path both funnel into `ShipmentsService`, which emits this event —
   * and `src/webhooks/**` belongs to another task this wave, so the listener
   * lives here rather than in the webhook service.
   *
   * The row is re-read instead of trusted from the payload because the payload
   * carries no `order_number`, and because a status that moved again between
   * the emit and this handler should not produce a stale nudge. The dispatcher's
   * cooldown keys on `(user, shipment_failed, shipment id)`, so this and the
   * sweep cannot double-send.
   */
  @OnEvent(DomainEvent.SHIPMENT_STATUS_CHANGED)
  async handleShipmentStatusChanged(
    payload: DomainEventPayloads['shipment.status_changed'],
  ): Promise<void> {
    if (!isStuckStatus(payload.status)) return;

    try {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: payload.shipmentId },
        select: {
          id: true,
          status: true,
          awb: true,
          order: { select: { order_number: true } },
        },
      });
      if (!shipment || !isStuckStatus(shipment.status)) return;

      const recipients =
        await this.notifications.getUsersByPermission(OPS_PERMISSION);
      await this.nudgeShipment(shipment, recipients);
    } catch (error) {
      this.logger.error(
        `Could not nudge on shipment ${payload.shipmentId} going ${payload.status}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** One shipment, every recipient. Returns how many actually got a row. */
  private async nudgeShipment(
    shipment: NudgeableShipment,
    recipients: { id: string }[],
  ): Promise<number> {
    const label = `Order ${shipment.order.order_number}`;
    let sent = 0;

    for (const user of recipients) {
      const dispatched = await this.safely(
        `shipment ${shipment.id} → ${user.id}`,
        () =>
          this.dispatcher.dispatch({
            user_id: user.id,
            type: NotificationType.shipment_failed,
            title: `Shipment ${shipment.status}: ${label}`,
            body:
              `AWB ${shipment.awb ?? '(none)'} is ${shipment.status}. ` +
              `Re-book or refund from the Shipments queue.`,
            link_url: SHIPMENTS_SCREEN_PATH,
            reference_id: shipment.id,
            reference_type: 'shipment',
            template_ctx: { subject: label, status: shipment.status },
          }),
      );
      if (dispatched) sent += 1;
    }
    return sent;
  }

  /**
   * One recipient's dispatch failing must not cost the rest of the leg theirs.
   * The dispatcher already isolates its own providers, so reaching here means
   * the database write itself failed.
   */
  private async safely(
    subject: string,
    fn: () => Promise<{ id: string } | null>,
  ): Promise<boolean> {
    try {
      return (await fn()) !== null;
    } catch (error) {
      this.logger.error(
        `Nudge for ${subject} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  /** A rejected leg is logged and counted as zero; the other leg still stands. */
  private settled(result: PromiseSettledResult<number>, leg: string): number {
    if (result.status === 'fulfilled') return result.value;
    this.logger.error(
      `Staff nudge sweep leg "${leg}" failed: ${String(result.reason)}`,
    );
    return 0;
  }
}
