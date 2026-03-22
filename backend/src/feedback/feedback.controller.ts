import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackFiltersDto } from './dto/feedback-filters.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async submit(@Body() dto: CreateFeedbackDto) {
    return this.feedbackService.submit(dto);
  }

  // IMPORTANT: stats BEFORE any parameterized route to prevent shadowing
  @Get('stats')
  @RequiresPermission(Permission.MANAGE_POS)
  async getStats() {
    return this.feedbackService.getStats();
  }

  @Get()
  @RequiresPermission(Permission.MANAGE_POS)
  async findAll(@Query() filters: FeedbackFiltersDto) {
    return this.feedbackService.findAll(filters);
  }
}
