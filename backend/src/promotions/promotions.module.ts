import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { SettingsModule } from '../settings/settings.module';

/**
 * Coupons and (later) other promotion mechanics.
 *
 * `SettingsModule` is imported explicitly because it is not `@Global()`;
 * `PrismaModule` and `AuditModule` are, so they need no import here.
 *
 * `CouponsService` is exported for `CheckoutService` (the quote and the
 * storefront `validate` endpoint) and `FulfilmentService` (which calls
 * `redeem(tx, …)` inside the confirm transaction).
 */
@Module({
  imports: [SettingsModule],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class PromotionsModule {}
