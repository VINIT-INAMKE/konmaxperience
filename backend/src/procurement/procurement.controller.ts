import { Controller, Get } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('summary')
  @RequiresPermission(Permission.MANAGE_PROCUREMENT)
  async getSummary() {
    return this.procurementService.getSummary();
  }
}
