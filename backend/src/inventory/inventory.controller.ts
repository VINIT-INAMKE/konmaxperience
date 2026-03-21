import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import * as express from 'express';
import { InventoryService } from './inventory.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async findAll() {
    return this.inventoryService.findAll();
  }

  @Get('low-stock')
  async getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @Get(':ingredientId/movements')
  async getMovements(
    @Param('ingredientId', ParseUUIDPipe) ingredientId: string,
  ) {
    return this.inventoryService.getMovements(ingredientId);
  }

  @Post('adjust')
  @RequiresPermission(Permission.MANAGE_INVENTORY)
  async adjust(
    @Body() dto: CreateStockAdjustmentDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.inventoryService.adjust(dto, user.id);
  }
}
