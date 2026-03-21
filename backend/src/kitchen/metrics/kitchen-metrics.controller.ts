import { Controller, Get } from '@nestjs/common';
import { KitchenMetricsService } from './kitchen-metrics.service';
import { RequiresPermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../types/permissions';

@Controller('kitchen/metrics')
export class KitchenMetricsController {
  constructor(
    private readonly kitchenMetricsService: KitchenMetricsService,
  ) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  async getSummary() {
    return this.kitchenMetricsService.getSummary();
  }
}
