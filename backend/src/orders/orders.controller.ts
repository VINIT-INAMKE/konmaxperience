import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateOrderDto } from './dto/create-order.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { OrderFiltersDto } from './dto/order-filters.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequiresPermission(Permission.MANAGE_POS)
  async createOrder(@Body() dto: CreateOrderDto, @Req() req: any) {
    return this.ordersService.createOrder(dto, req.user.id);
  }

  @Get()
  @RequiresPermission(Permission.MANAGE_POS)
  async getOrders(@Query() filters: OrderFiltersDto) {
    return this.ordersService.getOrders(filters);
  }

  // IMPORTANT: daily-summary BEFORE :id to prevent NestJS route shadowing
  @Get('daily-summary')
  @RequiresPermission(Permission.MANAGE_POS)
  async getDailySummary(@Query('date') date?: string) {
    const targetDate =
      date || new Date().toISOString().split('T')[0];
    return this.ordersService.getDailySummary(targetDate);
  }

  @Get(':id')
  @RequiresPermission(Permission.MANAGE_POS)
  async getOrderById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Patch(':id/status')
  @RequiresPermission(Permission.MANAGE_POS)
  async updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ) {
    return this.ordersService.updateOrderStatus(id, status);
  }

  @Post(':id/payment')
  @RequiresPermission(Permission.MANAGE_POS)
  async recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.ordersService.recordPayment(id, dto);
  }

  @Patch(':id/delivery')
  @RequiresPermission(Permission.MANAGE_POS)
  async updateDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryDto,
  ) {
    return this.ordersService.updateDelivery(id, dto);
  }
}
