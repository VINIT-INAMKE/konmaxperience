import { Module } from '@nestjs/common';
import { ReadinessController } from './readiness.controller';
import { ReadinessService } from './readiness.service';
import { ReadinessDerivationService } from './readiness-derivation.service';
import { ReadinessCron } from './readiness.cron';
import { SettingsModule } from '../settings/settings.module';

/**
 * `NodeModule` is `@Global()`, so only `SettingsModule` needs importing here.
 * `ReadinessDerivationService` is exported because `MissionBridgeModule` and the
 * nightly job both drive recomputes through it.
 */
@Module({
  imports: [SettingsModule],
  controllers: [ReadinessController],
  providers: [ReadinessService, ReadinessDerivationService, ReadinessCron],
  exports: [ReadinessService, ReadinessDerivationService],
})
export class ReadinessModule {}
