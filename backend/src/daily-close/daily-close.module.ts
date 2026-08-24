import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DailyCloseController } from './daily-close.controller';
import { DailyCloseService } from './daily-close.service';
import { DailyCloseCron } from './daily-close.cron';

/**
 * RUN-02 — the daily close.
 *
 * `AuditModule` and `NodeModule` are `@Global()`, so only `SettingsModule` (the
 * `signer_role_codes` gate) and `NotificationsModule` (the 00:45 nudge to the
 * signatories) need importing. `NotificationsModule` imports nothing of its own,
 * so this edge cannot become a cycle.
 *
 * `DailyCloseService` is exported because RUN-05's morning brief reads the
 * previous day's `DailyCloseMetrics` rather than re-deriving them.
 */
@Module({
  imports: [PrismaModule, SettingsModule, NotificationsModule],
  controllers: [DailyCloseController],
  providers: [DailyCloseService, DailyCloseCron],
  exports: [DailyCloseService],
})
export class DailyCloseModule {}
