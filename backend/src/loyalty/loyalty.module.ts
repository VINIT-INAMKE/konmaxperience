import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import {
  CustomerLoyaltyController,
  StaffLoyaltyController,
} from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyExpiryCron } from './loyalty.cron';

/**
 * LOYAL-01/LOYAL-02. `PrismaModule` and `AuditModule` are `@Global()`, so only
 * `SettingsModule` needs importing. `LoyaltyService` is exported because the
 * checkout quote, the confirm transaction, the refund and the delivery
 * transition all call into it.
 */
@Module({
  imports: [SettingsModule],
  controllers: [CustomerLoyaltyController, StaffLoyaltyController],
  providers: [LoyaltyService, LoyaltyExpiryCron],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
