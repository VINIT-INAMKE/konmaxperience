import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import express from 'express';
import { UsageService } from './usage.service';
import { CreateUsageEventDto } from './dto/create-usage-event.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  /**
   * Telemetry ingest. Authenticated (the global `JwtAuthGuard` covers it) but needs
   * no permission — every staff role logs its own page views. Returns 202 without
   * awaiting the write so navigation is never blocked by observability.
   */
  @Post()
  @HttpCode(202)
  record(@Body() dto: CreateUsageEventDto, @Req() req: express.Request) {
    // JwtStrategy puts { id, roleCode, type } on req.user for staff sessions.
    const user = (req as any).user;
    void this.usage.record(dto, { id: user.id, roleCode: user.roleCode });
    return { accepted: true };
  }

  @Get('summary')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  summary(@Query('days') days?: string) {
    const parsed = Number(days);
    return this.usage.summary(
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 365) : 30,
    );
  }
}
