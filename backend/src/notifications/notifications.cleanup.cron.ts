import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';

@Injectable()
export class NotificationsCleanupCron {
  private readonly logger = new Logger(NotificationsCleanupCron.name);

  constructor(private readonly prisma: PrismaService) {}

  // Sunday 3:00 AM -- D-13. A decorator cannot await NodeService, so the zone is
  // pinned to the seeded default; the process TZ is no longer forced in main.ts.
  @Cron('0 3 * * 0', { timeZone: DEFAULT_NODE_TIMEZONE })
  async cleanupOldNotifications() {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Delete all notifications older than 30 days (read and unread)
      const deleted = await this.prisma.withReconnect(() =>
        this.prisma.notification.deleteMany({
          where: { created_at: { lt: cutoff } },
        })
      );

      this.logger.log(
        `Cleanup: ${deleted.count} old notifications deleted`,
      );
    } catch (error) {
      this.logger.error(
        'Notification cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
