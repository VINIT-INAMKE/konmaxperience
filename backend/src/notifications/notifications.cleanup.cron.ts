import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsCleanupCron {
  private readonly logger = new Logger(NotificationsCleanupCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * 0') // Sunday 3:00 AM -- D-13
  async cleanupOldNotifications() {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Delete read notifications older than 30 days first (per D-13)
      const readDeleted = await this.prisma.notification.deleteMany({
        where: { is_read: true, created_at: { lt: cutoff } },
      });

      // Then delete all (including unread) older than 30 days
      const allDeleted = await this.prisma.notification.deleteMany({
        where: { created_at: { lt: cutoff } },
      });

      this.logger.log(
        `Cleanup: ${readDeleted.count} read + ${allDeleted.count} remaining old notifications deleted`,
      );
    } catch (error) {
      this.logger.error(
        'Notification cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
