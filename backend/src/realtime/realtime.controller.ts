import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import express from 'express';
import { RealtimeService } from './realtime.service';
import { RealtimeAuthDto } from './dto/realtime-auth.dto';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * Pusher's private-channel handshake for every ops channel. Authenticated by
   * the global `JwtAuthGuard`; the per-channel rules live in `RealtimeService`.
   */
  @Post('auth')
  @HttpCode(200)
  async auth(@Body() dto: RealtimeAuthDto, @Req() req: express.Request) {
    const user = (req as any).user;
    return this.realtime.authorize(dto.socket_id, dto.channel_name, {
      id: user.id,
      roleCode: user.roleCode,
    });
  }
}
