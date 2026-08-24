import { Controller, Get, Query } from '@nestjs/common';
import { FoodCostService, type FoodCostReport } from './food-cost.service';
import { FoodCostQueryDto } from './dto/food-cost-query.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

/**
 * RUN-03's read surface, mounted on the `analytics` prefix beside the routes in
 * `AnalyticsController` — Nest allows a second controller on the same path
 * segment, and the alternative (editing `analytics.controller.ts`) would put
 * this work in a file P6 does not own.
 *
 * `MANAGE_KPIS` is the permission every analytics route already carries, and it
 * resolves to exactly RUN-03's audience: BI lead, founder/admin, tech lead
 * (P6 decision 20). No new key, no new permission.
 */
@Controller('analytics/food-cost')
export class FoodCostController {
  constructor(private readonly foodCostService: FoodCostService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_KPIS)
  async getFoodCost(@Query() dto: FoodCostQueryDto): Promise<FoodCostReport> {
    return this.foodCostService.report(dto.from, dto.to);
  }
}
