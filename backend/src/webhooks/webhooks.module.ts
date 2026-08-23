import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { ChatModule } from '../chat/chat.module';
import { FulfilmentModule } from '../fulfilment/fulfilment.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { ShiprocketWebhookService } from './shiprocket-webhook.service';

/**
 * `ShipmentsModule` is imported for `ShipmentsService` — the single writer of
 * `Shipment.status`, which the Shiprocket callback funnels through so the staff
 * queue and the courier cannot record different histories. `CustomerAuthModule`
 * supplies `RedisService` (Razorpay idempotency) and `WhatsAppService` (the
 * customer's shipment notification); `ChatModule` supplies `PusherService`.
 */
@Module({
  imports: [
    PrismaModule,
    RazorpayModule,
    CustomerAuthModule,
    ChatModule,
    FulfilmentModule,
    ShipmentsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, ShiprocketWebhookService],
})
export class WebhooksModule {}
