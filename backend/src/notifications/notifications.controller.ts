import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

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
}
