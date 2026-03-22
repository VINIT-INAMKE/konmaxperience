import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Query,
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
  @RequiresPermission(Permission.MANAGE_INVENTORY)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.findAll(Number(page), Number(limit));
  }

  @Get('low-stock')
  @RequiresPermission(Permission.MANAGE_INVENTORY)
  async getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @Get(':ingredientId/movements')
  @RequiresPermission(Permission.MANAGE_INVENTORY)
  async getMovements(
    @Param('ingredientId', ParseUUIDPipe) ingredientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getMovements(ingredientId, Number(page), Number(limit));
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
