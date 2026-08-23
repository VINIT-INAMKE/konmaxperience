import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import express from 'express';
import { ShipmentStatus } from '@prisma/client';
import { ShipmentsService } from './shipments.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { PackShipmentDto } from './dto/pack-shipment.dto';
import { CancelShipmentDto, ManualAwbDto } from './dto/manual-awb.dto';

/** Request shape after the auth guard has attached the staff user. */
type AuthedRequest = express.Request & { user: { id: string } };

const userId = (req: express.Request): string => (req as AuthedRequest).user.id;

/**
 * SHIP-03 — the staff shipments queue (`MANAGE_OPS` throughout).
 *
 * `pack` is mounted on the collection rather than on `:id` because the row does
 * not exist yet: a shipment is identified by its order (`Shipment.order_id` is
 * unique), so `POST /shipments/pack { order_id }` is the create.
 *
 * The customer-facing view of a parcel is **not** here — it hangs off
 * `GET /customer/orders/:id/shipment` (Task 9) so it runs behind the storefront
 * guard, and calls `ShipmentsService.findForOrder`.
 */
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_OPS)
  async list(
    @Query('status') status?: ShipmentStatus,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shipments.list(
      status,
      cursor,
      limit ? Number(limit) : undefined,
    );
  }

  @Get(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipments.findOne(id);
  }

  @Post('pack')
  @RequiresPermission(Permission.MANAGE_OPS)
  async pack(@Body() dto: PackShipmentDto, @Req() req: express.Request) {
    return this.shipments.pack(dto, userId(req));
  }

  @Post(':id/awb')
  @RequiresPermission(Permission.MANAGE_OPS)
  async awb(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManualAwbDto,
    @Req() req: express.Request,
  ) {
    return this.shipments.assignAwb(id, dto, userId(req));
  }

  @Post(':id/pickup')
  @RequiresPermission(Permission.MANAGE_OPS)
  async pickup(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    return this.shipments.schedulePickup(id, userId(req));
  }

  @Get(':id/label')
  @RequiresPermission(Permission.MANAGE_OPS)
  async label(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    return this.shipments.getLabel(id, userId(req));
  }

  @Post(':id/cancel')
  @RequiresPermission(Permission.MANAGE_OPS)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelShipmentDto,
    @Req() req: express.Request,
  ) {
    return this.shipments.cancel(id, dto.reason, userId(req));
  }
}
