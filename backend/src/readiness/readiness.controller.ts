import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ReadinessService } from './readiness.service';
import { ReadinessDerivationService } from './readiness-derivation.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { MeterHistoryQueryDto } from './dto/meter-history.dto';
import { MeterSignalsQueryDto } from './dto/meter-signals.dto';

/**
 * SPEC §9 `readiness-meters`. `:id/tasks` keeps its `ParseUUIDPipe`, so the
 * code-addressed routes below can never shadow it — they also differ in their
 * trailing segment (`/history`, `/signals`).
 */
@Controller('readiness-meters')
export class ReadinessController {
  constructor(
    private readonly readinessService: ReadinessService,
    private readonly derivation: ReadinessDerivationService,
  ) {}

  @Get()
  async findAll() {
    return this.readinessService.findAll();
  }

  /** Recompute every meter of the node. Governance action, so `MANAGE_SYSTEM`. */
  @Post('recompute')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async recompute() {
    return this.derivation.recomputeAll();
  }

  @Get(':id/tasks')
  async findTasksForMeter(@Param('id', ParseUUIDPipe) id: string) {
    return this.readinessService.findTasksForMeter(id);
  }

  @Get(':code/history')
  async history(
    @Param('code') code: string,
    @Query() query: MeterHistoryQueryDto,
  ) {
    return this.readinessService.history(code, query.days ?? 0);
  }

  @Get(':code/signals')
  async signals(
    @Param('code') code: string,
    @Query() query: MeterSignalsQueryDto,
  ) {
    return this.readinessService.signals(code, query.limit ?? 0);
  }
}
