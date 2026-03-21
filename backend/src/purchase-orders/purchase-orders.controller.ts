import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import * as express from 'express';
import { PurchaseOrdersService } from './purchase-orders.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
  ) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    return this.purchaseOrdersService.findAll(status);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_PROCUREMENT)
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.purchaseOrdersService.create(dto, user.id);
  }

  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_PROCUREMENT)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { notes?: string; status?: string },
  ) {
    return this.purchaseOrdersService.update(id, body);
  }

  @Post(':id/receive')
  @RequiresPermission(Permission.MANAGE_PROCUREMENT)
  async receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.purchaseOrdersService.receivePurchaseOrder(id, dto, user.id);
  }

  @Post(':id/cancel')
  @RequiresPermission(Permission.MANAGE_PROCUREMENT)
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.cancel(id);
  }
}
