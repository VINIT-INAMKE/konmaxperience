import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, WinsQueryDto } from './dto/analytics-query.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('channels')
  @RequiresPermission(Permission.MANAGE_KPIS)
  async getChannels(@Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getChannelBreakdown(dto.from, dto.to);
  }

  @Get('recipe-costs')
  @RequiresPermission(Permission.MANAGE_KPIS)
  async getRecipeCosts(@Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getRecipeCosts(dto.from, dto.to);
  }

  @Get('revenue')
  @RequiresPermission(Permission.MANAGE_KPIS)
  async getRevenue(@Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getRevenueSeries(dto.from, dto.to);
  }

  @Get('summary')
  @RequiresPermission(Permission.MANAGE_KPIS)
  async getSummary(@Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getSummary(dto.from, dto.to);
  }

  @Get('top-items')
  @RequiresPermission(Permission.MANAGE_KPIS)
  async getTopItems(@Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getTopItems(dto.from, dto.to);
  }

  @Get('wins')
  async getWins(@Query() dto: WinsQueryDto) {
    const limit = parseInt(dto.limit || '20', 10);
    return this.analyticsService.getWins(limit, dto.cursor);
  }
}
