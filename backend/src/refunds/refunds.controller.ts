import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import express from 'express';
import { RefundsService } from './refunds.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateRefundDto } from './dto/create-refund.dto';

/** Request shape after the auth guard has attached the staff user. */
type AuthedRequest = express.Request & { user: { id: string } };

const userId = (req: express.Request): string => (req as AuthedRequest).user.id;

/**
 * CHK-05 — the refund routes live on the `orders` prefix (that is where the
 * staff screen puts them) but in their own controller, so the refund slice and
 * the order-lifecycle slice never edit the same file.
 *
 * Nest matches `:id/refund` and `:id/refunds` by segment count, so neither route
 * is shadowed by `OrdersController`'s `@Get(':id')` regardless of which module
 * registers first.
 */
@Controller('orders')
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Post(':id/refund')
  @RequiresPermission(Permission.MANAGE_POS)
  async refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRefundDto,
    @Req() req: express.Request,
  ) {
    return this.refunds.refund(id, dto, userId(req));
  }

  @Get(':id/refunds')
  @RequiresPermission(Permission.MANAGE_POS)
  async list(@Param('id', ParseUUIDPipe) id: string) {
    return this.refunds.list(id);
  }
}
