import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { ChatModule } from '../chat/chat.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { FulfilmentModule } from '../fulfilment/fulfilment.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CartPricingService } from '../checkout/cart-pricing.service';
import { CustomerOrdersController } from './customer-orders.controller';
import { CustomerOrdersService } from './customer-orders.service';

/**
 * `CartPricingService` is provided locally rather than imported from
 * `CheckoutModule`: that module does not exist yet (P5a Task 8) and importing it
 * would need a `forwardRef` in both directions, because `CheckoutController`
 * reads the cart through `CustomerOrdersService`. The service is stateless — it
 * holds only `PrismaService` and `CatalogService` — so a second instance is
 * equivalent to a shared one. Swap this for
 * `forwardRef(() => CheckoutModule)` once Task 8 lands if a single instance is
 * preferred.
 */
@Module({
  imports: [
    PrismaModule,
    CustomerAuthModule, // provides RedisService
    ChatModule, // provides PusherService (for order tracking)
    RazorpayModule, // provides RazorpayService (for checkout/confirm)
    FulfilmentModule, // provides FulfilmentService (paid-order creation + deduction)
    CatalogModule, // provides CatalogService (availability, for CartPricingService)
  ],
  controllers: [CustomerOrdersController],
  providers: [CustomerOrdersService, CartPricingService],
  exports: [CustomerOrdersService],
})
export class CustomerOrdersModule {}
