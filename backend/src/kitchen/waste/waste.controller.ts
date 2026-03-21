import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import * as express from 'express';
import { WasteService } from './waste.service';
import { RequiresPermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../types/permissions';
import { CreateWasteLogDto } from './dto/create-waste-log.dto';

@Controller('kitchen/waste')
export class WasteController {
  constructor(private readonly wasteService: WasteService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  async findAll(@Query('zone_id') zoneId?: string) {
    return this.wasteService.findAll(zoneId);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  async createWasteLog(
    @Body() dto: CreateWasteLogDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.wasteService.createWasteLog(dto, user.id);
  }
}
