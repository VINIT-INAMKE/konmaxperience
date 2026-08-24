import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { QStashService } from './qstash.service';
import { NotificationsCron } from './notifications.cron';
import { NotificationsListener } from './notifications.listener';
import { NotificationsCleanupCron } from './notifications.cleanup.cron';
import { StaffNudgeCron } from './staff-nudge.cron';
import { SettingsModule } from '../settings/settings.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';

/**
 * `CustomerAuthModule` is imported for `WhatsAppService` rather than extracting
 * the sender into a module of its own (P6 decision 7): it exports the service
 * already, and its own imports are `PrismaModule`, `ChatModule` and
 * `JwtModule`, so there is no cycle back to here. `SettingsModule` is imported
 * explicitly because it is not `@Global()`; `PrismaModule`, `NodeModule`,
 * `EmailModule` and `RealtimeModule` are.
 */
@Module({
  imports: [SettingsModule, CustomerAuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatcher,
    NotificationsProcessor,
    QStashService,
    NotificationsCron,
    NotificationsListener,
    NotificationsCleanupCron,
    StaffNudgeCron,
  ],
  exports: [NotificationsService, NotificationDispatcher],
})
export class NotificationsModule {}
