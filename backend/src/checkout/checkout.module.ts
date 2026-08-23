import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { SettingsModule } from '../settings/settings.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ShippingModule } from '../shipping/shipping.module';
import { CustomerOrdersModule } from '../customer-orders/customer-orders.module';
import { CartPricingService } from './cart-pricing.service';
import { ServiceabilityService } from './serviceability.service';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';

/**
 * `CHK-01`/`CHK-02` — server-side pricing and the quote.
 *
 * `CustomerAuthModule` is imported for its exported `RedisService` (the app's
 * single ioredis connection) and for the passport strategy `CustomerGuard`
 * rides on. `CustomerOrdersModule` is behind a `forwardRef` because Task 9 adds
 * the mirror import on its side once `POST /customer/orders` starts reading
 * quotes.
 *
 * Registration in `app.module.ts` is deliberately **not** done here — that file
 * has one owner per wave (plan "Execution partition").
 */
@Module({
  imports: [
    PrismaModule,
    CustomerAuthModule,
    SettingsModule,
    CatalogModule,
    PromotionsModule,
    LoyaltyModule,
    ShippingModule,
    forwardRef(() => CustomerOrdersModule),
  ],
  controllers: [CheckoutController],
  providers: [CartPricingService, ServiceabilityService, CheckoutService],
  exports: [CheckoutService, CartPricingService, ServiceabilityService],
})
export class CheckoutModule {}
