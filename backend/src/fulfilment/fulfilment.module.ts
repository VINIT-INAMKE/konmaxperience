import { Module } from '@nestjs/common';
import { FulfilmentService } from './fulfilment.service';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PromotionsModule } from '../promotions/promotions.module';

/**
 * `confirmPaidOrder` writes the coupon redemption and the loyalty spend inside
 * its own transaction, so it needs both services (they take the `tx` client).
 * `PrismaModule`, `AuditModule` and `EventEmitterModule` are global.
 */
@Module({
  imports: [LoyaltyModule, PromotionsModule],
  providers: [FulfilmentService],
  exports: [FulfilmentService],
})
export class FulfilmentModule {}
