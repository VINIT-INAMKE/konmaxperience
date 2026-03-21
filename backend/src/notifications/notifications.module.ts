import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsWorker } from './notifications.worker';
import { NotificationsCron } from './notifications.cron';
import { NotificationsListener } from './notifications.listener';
import { NotificationsCleanupCron } from './notifications.cleanup.cron';

@Module({
  imports: [BullModule.registerQueue({ name: 'notifications' })],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsWorker,
    NotificationsCron,
    NotificationsListener,
    NotificationsCleanupCron,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
