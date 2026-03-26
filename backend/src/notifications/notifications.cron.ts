import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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
            entity_id: true,
            created_at: true,
            task: { select: { id: true, title: true } },
          },
        }),
      );

      this.logger.log(`Scan: found ${pendingApprovals.length} approvals pending >24h`);

      const dispatches = pendingApprovals.map((approval) => {
        const hoursPending = Math.round(
          (Date.now() - new Date(approval.created_at).getTime()) / (1000 * 60 * 60),
        );
        return this.qstash.publish('notify-approval-pending', {
          approvalId: approval.id,
          taskName: approval.task?.title ?? 'Unknown Task',
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
