import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import express from 'express';
import { CouponsService } from './coupons.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

/** Request shape after the auth guard has attached the staff user. */
type AuthedRequest = express.Request & { user: { id: string } };

const userId = (req: express.Request): string => (req as AuthedRequest).user.id;

/**
 * Staff coupon administration (SPEC §9, `MANAGE_OPS`).
 *
 * The customer-facing `POST /customer/coupons/validate` deliberately does
 * **not** live here — it is mounted on `CheckoutController` so it runs behind
 * the storefront `CustomerGuard` rather than the staff JWT guard. Both surfaces
 * end up in `CouponsService.evaluate`, which is the only place a discount is
 * ever computed.
 */
@Controller('promotions/coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_OPS)
  async list(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.coupons.list(cursor, limit ? Number(limit) : undefined);
  }

  @Get(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_OPS)
  async create(@Body() dto: CreateCouponDto, @Req() req: express.Request) {
    return this.coupons.create(dto, userId(req));
  }

  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
    @Req() req: express.Request,
  ) {
    return this.coupons.update(id, dto, userId(req));
  }

  /** DELETE disables the coupon; redeemed coupons are never removed. */
  @Delete(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    return this.coupons.archive(id, userId(req));
  }
}
