import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { QStashService } from './qstash.service';
import { NotificationsCron } from './notifications.cron';
import { NotificationsListener } from './notifications.listener';
import { NotificationsCleanupCron } from './notifications.cleanup.cron';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    QStashService,
    NotificationsCron,
    NotificationsListener,
    NotificationsCleanupCron,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
