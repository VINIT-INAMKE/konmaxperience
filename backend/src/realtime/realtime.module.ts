import { Global, Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { RealtimeListener } from './realtime.listener';
import { ChatModule } from '../chat/chat.module';

/**
 * `@Global` for the same reason `NodeModule` and `ApprovalPolicyModule` are: the
 * emit sites are spread across kitchen, approvals and notifications, and a realtime
 * push is infrastructure rather than a domain dependency of any of them.
 * `PusherService` comes from `ChatModule`, which already exports it.
 */
@Global()
@Module({
  imports: [ChatModule],
  controllers: [RealtimeController],
  providers: [RealtimeService, RealtimeListener],
  exports: [RealtimeService],
})
export class RealtimeModule {}
