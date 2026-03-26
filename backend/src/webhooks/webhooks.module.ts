import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { ChatModule } from '../chat/chat.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [PrismaModule, RazorpayModule, CustomerAuthModule, ChatModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
