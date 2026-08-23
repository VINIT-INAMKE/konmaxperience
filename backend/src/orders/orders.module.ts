import { Module } from '@nestjs/common';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { ChatModule } from '../chat/chat.module';
import { FulfilmentModule } from '../fulfilment/fulfilment.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderLifecycleService } from './order-lifecycle.service';

/**
 * `LoyaltyModule` joins for the delivery earn (SPEC §5.2 step 6).
 * `OrderLifecycleService` is exported as well as provided: the Shiprocket webhook
 * (Task 12) reaches `delivered` through `OrdersService.updateOrderStatus`, which
 * fires the hook for it, but a caller that writes `Order.status` itself can inject
 * the lifecycle service and credit the order directly.
 */
@Module({
  imports: [RazorpayModule, ChatModule, FulfilmentModule, LoyaltyModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderLifecycleService],
  exports: [OrdersService, OrderLifecycleService],
})
export class OrdersModule {}
