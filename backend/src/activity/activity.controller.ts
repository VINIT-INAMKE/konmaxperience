import { Controller, Get, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async getFeed(
    @Query('limit') limit?: string,
    @Query('hours') hours?: string,
  ) {
    return this.activityService.buildFeed({
      limit: limit ? Number(limit) : undefined,
      hoursLookback: hours ? Number(hours) : undefined,
    });
  }

  @Get('contributions')
  async getContributions(
    @Query('scope') scope?: string,
  ) {
    const validScope = ['week', 'month', 'mission'].includes(scope ?? '') ? scope as 'week' | 'month' | 'mission' : 'mission';
    return this.activityService.getContributions(validScope);
  }
}
