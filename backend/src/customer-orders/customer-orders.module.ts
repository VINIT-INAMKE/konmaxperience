import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { ChatModule } from '../chat/chat.module';
import { CustomerOrdersController } from './customer-orders.controller';
import { CustomerOrdersService } from './customer-orders.service';

@Module({
  imports: [
    PrismaModule,
    CustomerAuthModule, // provides RedisService
    ChatModule, // provides PusherService (for Plan 02 order tracking)
  ],
  controllers: [CustomerOrdersController],
  providers: [CustomerOrdersService],
  exports: [CustomerOrdersService],
})
export class CustomerOrdersModule {}
