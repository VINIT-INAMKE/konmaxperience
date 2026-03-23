import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { PusherService } from './pusher.service';
import { PusherAuthDto } from './dto/pusher-auth.dto';
import { RoleCode } from '../types/roles';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly pusherService: PusherService,
  ) {}

  @Post('auth')
  @HttpCode(200)
  async pusherAuth(@Body() dto: PusherAuthDto, @Req() req: any) {
    const user = req.user; // { id, roleCode } from JWT guard
    const conversationId = dto.channel_name.replace('private-chat-', '');

    // Admin/tech bypass — check role FIRST (per D-15, D-16)
    const isAdmin = [RoleCode.FOUNDER_ADMIN, RoleCode.TECH_LEAD].includes(
      user.roleCode,
    );

    if (!isAdmin) {
      const hasAccess = await this.chatService.checkParticipantAccess(
        conversationId,
        user.id,
      );
      if (!hasAccess) {
        throw new ForbiddenException('Not a participant');
      }
    }

    return this.pusherService.authorizeChannel(dto.socket_id, dto.channel_name);
  }
}
