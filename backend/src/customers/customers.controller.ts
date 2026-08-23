import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import express from 'express';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

/** Request shape after the global staff auth guard has attached the user. */
type AuthedRequest = express.Request & { user?: { id?: string } };

const staffId = (req: express.Request): string | null =>
  (req as AuthedRequest).user?.id ?? null;

/**
 * OPS-04 — the staff Customers screen (`MANAGE_OPS` throughout).
 *
 * Shares the `customers` prefix with `StaffLoyaltyController`
 * (`POST /customers/:id/loyalty-adjust`, P5a Task 7). Nest resolves the two by
 * path + verb, so neither controller has to know about the other.
 *
 * There is no customer-facing route here: the storefront reads its own profile
 * through `GET /customer-auth/profile` and its own orders through
 * `GET /customer/orders`, both behind `CustomerGuard`.
 */
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_OPS)
  async list(
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customers.list(q, cursor, limit ? Number(limit) : undefined);
  }

  @Get(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.findOne(id);
  }

  /** The marketing consent toggle — the only staff-side write on `Customer`. */
  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: express.Request,
  ) {
    return this.customers.update(id, dto, staffId(req));
  }
}
