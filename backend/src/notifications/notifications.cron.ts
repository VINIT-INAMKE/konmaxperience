import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApprovalEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QStashService } from './qstash.service';

@Injectable()
export class NotificationsCron {
  private readonly logger = new Logger(NotificationsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qstash: QStashService,
  ) {}

  @Cron('0 * * * *') // Every hour at :00
  async scanTasksDue() {
    try {
      const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const tasks = await this.prisma.withReconnect(() =>
        this.prisma.task.findMany({
          where: {
            due_date: { lte: cutoff, gt: new Date() },
            status: { notIn: ['done', 'cancelled', 'blocked'] },
          },
          select: {
            id: true,
            title: true,
            owner_user_id: true,
            due_date: true,
            quest: { select: { title: true } },
          },
        }),
      );

      this.logger.log(`Scan: found ${tasks.length} tasks due within 48h`);

      const dispatches = tasks
        .filter((task) => task.owner_user_id)
        .map((task) => {
          const hoursUntilDue = Math.round(
            (task.due_date!.getTime() - Date.now()) / (1000 * 60 * 60),
          );
          return this.qstash.publish('notify-task-due', {
            taskId: task.id,
            taskName: task.title,
            questName: task.quest?.title ?? 'Unknown Quest',
            userId: task.owner_user_id,
            hours: hoursUntilDue,
          });
        });
      await Promise.all(dispatches);
    } catch (error) {
      this.logger.error(
        'scanTasksDue failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @Cron('0 * * * *') // Every hour at :00
  async scanApprovalsPending() {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pendingApprovals = await this.prisma.withReconnect(() =>
        this.prisma.approval.findMany({
          where: {
            status: 'pending',
            created_at: { lt: cutoff },
          },
          select: {
            id: true,
            entity_type: true,
            entity_id: true,
            created_at: true,
          },
        }),
      );

      this.logger.log(`Scan: found ${pendingApprovals.length} approvals pending >24h`);

      // `Approval.entity_id` is polymorphic (SPEC §3.5) — there is no `task`
      // relation to include, so resolve the titles with an explicit query.
      const taskIds = pendingApprovals
        .filter((approval) => approval.entity_type === ApprovalEntityType.task)
        .map((approval) => approval.entity_id);
      const tasks = taskIds.length
        ? await this.prisma.task.findMany({
            where: { id: { in: taskIds } },
            select: { id: true, title: true },
          })
        : [];
      const taskTitleById = new Map(tasks.map((task) => [task.id, task.title]));

      const dispatches = pendingApprovals.map((approval) => {
        const hoursPending = Math.round(
          (Date.now() - new Date(approval.created_at).getTime()) / (1000 * 60 * 60),
        );
        return this.qstash.publish('notify-approval-pending', {
          approvalId: approval.id,
          taskName: taskTitleById.get(approval.entity_id) ?? 'Unknown Task',
          hours: hoursPending,
        });
      });
      await Promise.all(dispatches);
    } catch (error) {
      this.logger.error(
        'scanApprovalsPending failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
