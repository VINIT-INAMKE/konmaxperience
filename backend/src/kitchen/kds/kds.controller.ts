import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { OrderItemStatus } from '@prisma/client';
import { KdsService } from './kds.service';
import { RequiresPermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../types/permissions';

export class UpdateKdsItemStatusDto {
  @IsEnum(OrderItemStatus)
  status: OrderItemStatus;
}

@Controller('kitchen/kds')
export class KdsController {
  constructor(private readonly kdsService: KdsService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  async getActiveOrders() {
    return this.kdsService.getActiveOrders();
  }

  @Patch('items/:id/status')
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  async updateItemStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKdsItemStatusDto,
  ) {
    return this.kdsService.updateItemStatus(id, dto.status);
  }
}
