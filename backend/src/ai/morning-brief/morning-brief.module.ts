import { Module } from '@nestjs/common';
import { AiModule } from '../ai.module';
import { ReadinessModule } from '../../readiness/readiness.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { MorningBriefController } from './morning-brief.controller';
import { MorningBriefCron } from './morning-brief.cron';
import { MorningBriefService } from './morning-brief.service';

/**
 * RUN-05's brief surface, as a self-contained sub-module of `src/ai/`.
 *
 * `AiModule` is frozen at the end of wave 1 and declares no controllers, so the
 * brief ships its own module and `app.module.ts` imports this one — the same
 * shape `EvidenceAssistModule` takes.
 *
 * `PrismaModule` and `NodeModule` are `@Global()`, so the imports here are only
 * the three services this module consumes rather than re-derives:
 * `AiProviderResolver` (the port and the `ai` settings block),
 * `ReadinessService` (published meter values and their history),
 * `InventoryService` (the cross-column low-stock comparison) and
 * `NotificationDispatcher` (delivery, with the cooldown and WhatsApp legs).
 * None of the four imports anything that leads back here, so no cycle exists.
 *
 * The previous day's `DailyClose.metrics` is read as a row, not through
 * `DailyCloseService`: the brief wants the persisted artefact and must never be
 * able to trigger a recompute (decision 16), so `DailyCloseModule` is
 * deliberately *not* imported and only its types and pure day-key helpers are.
 */
@Module({
  imports: [AiModule, ReadinessModule, InventoryModule, NotificationsModule],
  controllers: [MorningBriefController],
  providers: [MorningBriefService, MorningBriefCron],
  exports: [MorningBriefService],
})
export class MorningBriefModule {}
