import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventHoldsCron } from './event-holds.cron';

/**
 * `AuditModule` is `@Global()`, so only `LoyaltyModule` needs importing —
 * attendance credits loyalty for an experience order, which never reaches
 * `delivered` and so never earns through the delivery path.
 */
@Module({
  imports: [PrismaModule, RazorpayModule, LoyaltyModule],
  controllers: [EventsController],
  providers: [EventsService, EventHoldsCron],
  exports: [EventsService],
})
export class EventsModule {}
