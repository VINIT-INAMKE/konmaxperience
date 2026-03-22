import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import * as express from 'express';
import { PrepBatchesService } from './prep-batches.service';
import { RequiresPermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../types/permissions';
import { CreatePrepBatchDto } from './dto/create-prep-batch.dto';
import { PreviewDeductionsDto } from './dto/preview-deductions.dto';

@Controller('kitchen/prep-batches')
export class PrepBatchesController {
  constructor(private readonly prepBatchesService: PrepBatchesService) {}

  @Get()
  async findAll(
    @Query('zone_id') zoneId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prepBatchesService.findAll(zoneId, status, Number(page), Number(limit));
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  async create(
    @Body() dto: CreatePrepBatchDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.prepBatchesService.createPrepBatch(dto, user.id);
  }

  @Post('preview')
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  async preview(@Body() dto: PreviewDeductionsDto) {
    return this.prepBatchesService.previewDeductions(dto);
  }
}
