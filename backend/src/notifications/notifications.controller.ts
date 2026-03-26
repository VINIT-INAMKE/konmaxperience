import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  Headers,
  HttpCode,
  ParseUUIDPipe,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Receiver } from '@upstash/qstash';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { Public } from '../common/decorators/public.decorator';

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
  private readonly logger = new Logger(NotificationsController.name);
  private receiver: Receiver | null = null;

  constructor(
    private readonly notifications: NotificationsService,
    private readonly processor: NotificationsProcessor,
    private readonly config: ConfigService,
  ) {
    const signingKey = this.config.get<string>('QSTASH_CURRENT_SIGNING_KEY');
    const nextSigningKey = this.config.get<string>('QSTASH_NEXT_SIGNING_KEY');
    if (signingKey && nextSigningKey) {
      this.receiver = new Receiver({
        currentSigningKey: signingKey,
        nextSigningKey: nextSigningKey,
      });
    }
  }

  /**
   * QStash webhook endpoint — receives notification jobs from Upstash QStash.
   * Verifies signature, then routes to the processor.
   */
  @Post('qstash-webhook')
  @Public()
  @HttpCode(200)
  async handleQStashWebhook(
    @Body() body: { jobName: string; data: Record<string, any> },
    @Headers('upstash-signature') signature: string,
  ) {
    // Verify QStash signature if receiver is configured
    if (this.receiver) {
      if (!signature) throw new UnauthorizedException('Missing QStash signature');
      try {
        await this.receiver.verify({ signature, body: JSON.stringify(body) });
      } catch {
        throw new UnauthorizedException('Invalid QStash signature');
      }
    }

    await this.processor.process(body.jobName, body.data);
    return { status: 'ok' };
  }

  @Get()
  async findForUser(@Request() req, @Query() query: NotificationQueryDto) {
    return this.notifications.findForUser(req.user.id, query);
  }

  @Get('unread-count')
  async unreadCount(@Request() req) {
    return this.notifications.unreadCount(req.user.id);
  }

  @Patch(':id/read')
  async markRead(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    await this.notifications.markRead(id, req.user.id);
    return { success: true };
  }

  @Post('read-all')
  async markAllRead(@Request() req) {
    await this.notifications.markAllRead(req.user.id);
    return { success: true };
  }

  @Post('broadcast')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async broadcast(@Body() dto: BroadcastNoticeDto, @Request() req) {
    const result = await this.notifications.broadcast({
      title: dto.title,
      body: dto.body,
      link_url: dto.link_url,
      sent_by: req.user.id,
    });
    return { success: true, count: result.count };
  }
}
