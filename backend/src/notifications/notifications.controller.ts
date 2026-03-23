import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { RequiresPermission } from '../common/decorators/requires-permission.decorator';
import { Permission } from '../types/permissions';

class BroadcastNoticeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body: string;

  @IsString()
  @IsOptional()
  link_url?: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async findForUser(@Request() req, @Query() query: NotificationQueryDto) {
    return this.notifications.findForUser(req.user.sub, query);
  }

  @Get('unread-count')
  async unreadCount(@Request() req) {
    return this.notifications.unreadCount(req.user.sub);
  }

  @Patch(':id/read')
  async markRead(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    await this.notifications.markRead(id, req.user.sub);
    return { success: true };
  }

  @Post('read-all')
  async markAllRead(@Request() req) {
    await this.notifications.markAllRead(req.user.sub);
    return { success: true };
  }

  @Post('broadcast')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async broadcast(@Body() dto: BroadcastNoticeDto, @Request() req) {
    const result = await this.notifications.broadcast({
      title: dto.title,
      body: dto.body,
      link_url: dto.link_url,
      sent_by: req.user.sub,
    });
    return { success: true, count: result.count };
  }
}
