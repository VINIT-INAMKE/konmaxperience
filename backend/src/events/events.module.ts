import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [PrismaModule, RazorpayModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
