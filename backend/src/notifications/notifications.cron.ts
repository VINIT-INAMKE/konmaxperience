import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsCron {
  private readonly logger = new Logger(NotificationsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly queue: Queue,
  ) {}

  @Cron('0 * * * *') // Every hour at :00 -- NOTF-01
  async scanTasksDue() {
    try {
      const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const tasks = await this.prisma.task.findMany({
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
      });

      this.logger.log(`Scan: found ${tasks.length} tasks due within 48h`);

      for (const task of tasks) {
        if (!task.owner_user_id) continue;
        const hoursUntilDue = Math.round(
          (task.due_date!.getTime() - Date.now()) / (1000 * 60 * 60),
        );
        await this.queue.add(
          'notify-task-due',
          {
            taskId: task.id,
            taskTitle: task.title,
            questTitle: task.quest?.title ?? 'Unknown Quest',
            ownerUserId: task.owner_user_id,
            hoursUntilDue,
          },
          { attempts: 2, removeOnComplete: 100, removeOnFail: 50 },
        );
      }
    } catch (error) {
      this.logger.error(
        'scanTasksDue failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @Cron('0 * * * *') // Every hour at :00 -- NOTF-03
  async scanApprovalsPending() {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pendingApprovals = await this.prisma.approval.findMany({
        where: {
          status: 'pending',
          created_at: { lt: cutoff },
        },
        select: {
          id: true,
          entity_id: true,
          task: { select: { id: true, title: true } },
        },
      });

      this.logger.log(
        `Scan: found ${pendingApprovals.length} approvals pending >24h`,
      );

      for (const approval of pendingApprovals) {
        await this.queue.add(
          'notify-approval-pending',
          {
            approvalId: approval.id,
            taskId: approval.task?.id ?? approval.entity_id,
            taskTitle: approval.task?.title ?? 'Unknown Task',
          },
          { attempts: 2, removeOnComplete: 100, removeOnFail: 50 },
        );
      }
    } catch (error) {
      this.logger.error(
        'scanApprovalsPending failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
