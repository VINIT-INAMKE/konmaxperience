import { Module } from '@nestjs/common';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { ChatModule } from '../chat/chat.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [RazorpayModule, ChatModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
