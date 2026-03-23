import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { PusherService } from './pusher.service';
import { PusherAuthDto } from './dto/pusher-auth.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { RoleCode } from '../types/roles';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly pusherService: PusherService,
  ) {}

  // ==================== Pusher Auth ====================

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

  // ==================== Conversations ====================

  @Post('conversations')
  async createConversation(
    @Body() dto: CreateConversationDto,
    @Req() req: any,
  ) {
    const user = req.user;

    // Group creation restricted to FOUNDER_ADMIN (per D-11)
    if (dto.type === 'group') {
      if (user.roleCode !== RoleCode.FOUNDER_ADMIN) {
        throw new ForbiddenException(
          'Only admin can create group conversations',
        );
      }
    }

    return this.chatService.createConversation(dto, user.id);
  }

  @Get('conversations')
  async getConversations(@Req() req: any) {
    return this.chatService.getConversations(req.user.id);
  }

  @Get('conversations/:id')
  async getConversation(@Param('id') id: string, @Req() req: any) {
    await this.ensureAccess(id, req.user);
    return this.chatService.getConversation(id);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('cursor') cursor: string,
    @Query('take') take: string,
    @Req() req: any,
  ) {
    await this.ensureAccess(id, req.user);
    return this.chatService.getMessages(
      id,
      cursor || undefined,
      take ? parseInt(take, 10) : 30,
    );
  }

  @Post('conversations/:id/messages')
  async createMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @Req() req: any,
  ) {
    const user = req.user;

    // Per D-18: admin cannot send messages to conversations they don't belong to
    const isParticipant = await this.chatService.checkParticipantAccess(
      id,
      user.id,
    );
    if (!isParticipant) {
      throw new ForbiddenException(
        'Only participants can send messages',
      );
    }

    // Validate at least content or attachment provided
    if (!dto.content && !dto.attachment_url) {
      throw new BadRequestException(
        'Message must have content or attachment',
      );
    }

    return this.chatService.createMessage(id, dto, user.id);
  }

  @Patch('conversations/:id/read')
  @HttpCode(204)
  async markRead(@Param('id') id: string, @Req() req: any) {
    await this.chatService.markRead(id, req.user.id);
  }

  // ==================== Group Member Management (Admin) ====================

  @Patch('conversations/:id/members')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async addMembers(
    @Param('id') id: string,
    @Body() body: { user_ids: string[] },
  ) {
    return this.chatService.addMembers(id, body.user_ids);
  }

  @Delete('conversations/:id/members')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async removeMembers(
    @Param('id') id: string,
    @Body() body: { user_ids: string[] },
  ) {
    return this.chatService.removeMembers(id, body.user_ids);
  }

  // ==================== Admin Oversight ====================

  @Get('admin/conversations')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async getAllConversations() {
    return this.chatService.getAllConversations();
  }

  @Get('admin/conversations/:id/messages')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async getAdminMessages(
    @Param('id') id: string,
    @Query('cursor') cursor: string,
    @Query('take') take: string,
  ) {
    return this.chatService.getMessages(
      id,
      cursor || undefined,
      take ? parseInt(take, 10) : 30,
    );
  }

  // ==================== Private Helpers ====================

  private async ensureAccess(
    conversationId: string,
    user: { id: string; roleCode: string },
  ) {
    const isAdmin = [RoleCode.FOUNDER_ADMIN, RoleCode.TECH_LEAD].includes(
      user.roleCode as RoleCode,
    );
    if (isAdmin) return;

    const hasAccess = await this.chatService.checkParticipantAccess(
      conversationId,
      user.id,
    );
    if (!hasAccess) {
      throw new ForbiddenException('Not a participant');
    }
  }
}
