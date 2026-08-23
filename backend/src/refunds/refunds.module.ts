import { Global, Module } from '@nestjs/common';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

/**
 * CHK-05. `PrismaModule` and `AuditModule` are `@Global()`, so only
 * `RazorpayModule` (the gateway call) and `LoyaltyModule` (the points claw-back
 * on a full refund) need importing.
 *
 * `@Global()` for the same reason `AuditModule` is: `WebhooksService` reconciles
 * `refund.processed` through `RefundsService`, and `webhooks.module.ts` is owned
 * by the Shiprocket-webhook slice. Exporting globally lets the two slices share
 * one writer of `Refund` rows without either editing the other's module file.
 * `AppModule` still registers this module exactly once.
 */
@Global()
@Module({
  imports: [RazorpayModule, LoyaltyModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
