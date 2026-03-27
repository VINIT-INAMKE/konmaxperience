import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { ChatModule } from '../chat/chat.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { OrdersModule } from '../orders/orders.module';
import { CustomerOrdersController } from './customer-orders.controller';
import { CustomerOrdersService } from './customer-orders.service';

@Module({
  imports: [
    PrismaModule,
    CustomerAuthModule, // provides RedisService
    ChatModule, // provides PusherService (for order tracking)
    RazorpayModule, // provides RazorpayService (for checkout/confirm)
    OrdersModule, // provides OrdersService (for non-scratch deduction)
  ],
  controllers: [CustomerOrdersController],
  providers: [CustomerOrdersService],
  exports: [CustomerOrdersService],
})
export class CustomerOrdersModule {}
