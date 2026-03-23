import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PusherService } from './pusher.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, PusherService],
  exports: [ChatService, PusherService],
})
export class ChatModule {}
