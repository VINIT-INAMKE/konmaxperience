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
import { IsIn } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateOrderDto } from './dto/create-order.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { OrderFiltersDto } from './dto/order-filters.dto';
import { ConfirmRazorpayPaymentDto } from './dto/create-razorpay-order.dto';

export class UpdateOrderStatusDto {
  @IsIn(['placed', 'preparing', 'ready', 'served', 'dispatched', 'cancelled'])
  status: string;
}

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

  @Get(':id/qr')
  @RequiresPermission(Permission.MANAGE_POS)
  async getOrderQr(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.generateQr(id);
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
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(id, dto.status);
  }

  @Post(':id/payment')
  @RequiresPermission(Permission.MANAGE_POS)
  async recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.ordersService.recordPayment(id, dto);
  }

  @Post(':id/razorpay-order')
  @RequiresPermission(Permission.MANAGE_POS)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createRazorpayOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.createRazorpayOrder(id);
  }

  @Post(':id/razorpay-confirm')
  @RequiresPermission(Permission.MANAGE_POS)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmRazorpayPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRazorpayPaymentDto,
  ) {
    return this.ordersService.confirmRazorpayPayment(id, dto);
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
