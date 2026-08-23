import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerGuard } from '../customer-auth/guards/customer.guard';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { LoyaltyService } from './loyalty.service';
import { AdjustLoyaltyDto } from './dto/adjust-loyalty.dto';

/**
 * `GET /customer/loyalty` — the storefront's whole loyalty surface: balance,
 * tier, what the next tier costs, the redemption rate the quote will use, and
 * the last 50 ledger rows.
 *
 * `@Public()` bypasses the global `JwtAuthGuard` so `CustomerGuard` (which
 * rejects a staff token) is the only authority on this route, exactly as
 * `CustomerOrdersController` does it.
 */
@Controller('customer/loyalty')
@UseGuards(CustomerGuard)
@Public()
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class CustomerLoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get()
  async mine(@Req() req: any) {
    const customerId: string = req.user.customerId;
    return this.loyalty.getSummary(customerId);
  }
}

/**
 * Staff surface. Shares the `customers` prefix with Task 17's
 * `CustomersController` — Nest allows two controllers on one prefix while their
 * paths differ, and this one owns only the `POST :id/loyalty-adjust` verb.
 */
@Controller('customers')
export class StaffLoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  /** LOYAL-01 — writes a `LoyaltyTransaction(adjust)` and an `AuditEvent`. */
  @Post(':id/loyalty-adjust')
  @RequiresPermission(Permission.MANAGE_OPS)
  async adjust(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustLoyaltyDto,
    @Req() req: any,
  ) {
    const userId: string | null = req.user?.id ?? null;
    return this.loyalty.adjust(id, dto.delta, dto.notes, userId);
  }
}
