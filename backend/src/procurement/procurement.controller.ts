import { Controller, Get } from '@nestjs/common';
import { ProcurementService } from './procurement.service';

@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('summary')
  async getSummary() {
    return this.procurementService.getSummary();
  }
}
