import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ReadinessService } from './readiness.service';

@Controller('readiness-meters')
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get()
  async findAll() {
    return this.readinessService.findAll();
  }

  @Get(':id/tasks')
  async findTasksForMeter(@Param('id', ParseUUIDPipe) id: string) {
    return this.readinessService.findTasksForMeter(id);
  }
}
