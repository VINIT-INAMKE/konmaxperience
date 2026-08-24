import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EvidenceAssistService } from './evidence-assist.service';
import { RequestAssistDto } from './dto/request-assist.dto';
import { RequiresPermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../types/permissions';

@Controller('evidence/:id/review-assist')
export class EvidenceAssistController {
  constructor(private readonly assist: EvidenceAssistService) {}

  /**
   * Generates a suggestion. Same permission as reviewing, because only a
   * reviewer should be able to spend a model call on this — and throttled,
   * because an unthrottled route that costs money per request is a defect.
   */
  @Post()
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: RequestAssistDto,
  ) {
    return this.assist.suggest(id);
  }

  /** Reads the newest stored suggestion. Never spends a model call. */
  @Get()
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  latest(@Param('id', ParseUUIDPipe) id: string) {
    return this.assist.latest(id);
  }
}
