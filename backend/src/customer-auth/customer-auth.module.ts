import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { WhatsAppService } from './whatsapp.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    PrismaModule,
    ChatModule, // provides PusherService for customer Pusher auth
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, WhatsAppService, RedisService],
  // `WhatsAppService` is exported for the Shiprocket webhook's customer
  // notification (P5a SHIP-05); it stays the single instance of the sender.
  exports: [CustomerAuthService, RedisService, WhatsAppService],
})
export class CustomerAuthModule {}
