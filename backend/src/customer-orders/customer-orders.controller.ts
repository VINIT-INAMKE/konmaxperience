import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Header,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerGuard } from '../customer-auth/guards/customer.guard';
import { CustomerOrdersService, CartData } from './customer-orders.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { SyncCartDto } from './dto/sync-cart.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('customer')
@UseGuards(CustomerGuard)
@Public() // Bypass global JwtAuthGuard — CustomerGuard handles auth
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class CustomerOrdersController {
  constructor(
    private readonly customerOrdersService: CustomerOrdersService,
  ) {}

  // ---------------------------------------------------------------
  // Cart endpoints
  // ---------------------------------------------------------------

  @Get('cart')
  async getCart(@Req() req: any): Promise<CartData> {
    const customerId: string = req.user.customerId;
    const cart = await this.customerOrdersService.getCart(customerId);
    return (
      cart ?? {
        items: [],
        channel: null,
        deliveryAddressId: null,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  @Post('cart/sync')
  async syncCart(
    @Req() req: any,
    @Body() dto: SyncCartDto,
  ): Promise<CartData> {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.syncCart(customerId, dto);
  }

  @Delete('cart')
  async deleteCart(@Req() req: any) {
    const customerId: string = req.user.customerId;
    await this.customerOrdersService.deleteCart(customerId);
    return { success: true };
  }

  // ---------------------------------------------------------------
  // Order endpoints
  // ---------------------------------------------------------------

  @Post('orders')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async checkoutCart(@Req() req: any) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.checkoutCart(customerId);
  }

  @Post('orders/confirm')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmOrder(@Req() req: any, @Body() dto: ConfirmOrderDto) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.confirmOrder(customerId, dto);
  }

  @Get('orders')
  async getCustomerOrders(@Req() req: any) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.getCustomerOrders(customerId);
  }

  // IMPORTANT: Receipt route BEFORE :id route to avoid NestJS route conflict
  @Get('orders/:id/receipt')
  @Header('Content-Type', 'text/html')
  async getOrderReceipt(@Req() req: any, @Param('id') id: string) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.generateOrderReceipt(customerId, id);
  }

  @Get('orders/:id')
  async getOrderById(@Req() req: any, @Param('id') id: string) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.getOrderById(customerId, id);
  }

  // ---------------------------------------------------------------
  // Booking endpoints
  // ---------------------------------------------------------------

  @Get('bookings')
  async getCustomerBookings(@Req() req: any) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.getCustomerBookings(customerId);
  }

  @Get('bookings/:id/receipt')
  @Header('Content-Type', 'text/html')
  async getBookingReceipt(@Req() req: any, @Param('id') id: string) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.generateBookingReceipt(customerId, id);
  }

  // ---------------------------------------------------------------
  // Address endpoints
  // ---------------------------------------------------------------

  @Post('addresses')
  async createAddress(
    @Req() req: any,
    @Body() dto: CreateAddressDto,
  ) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.createAddress(customerId, dto);
  }

  @Get('addresses')
  async listAddresses(@Req() req: any) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.listAddresses(customerId);
  }

  @Patch('addresses/:id')
  async updateAddress(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.updateAddress(customerId, id, dto);
  }

  @Delete('addresses/:id')
  async deleteAddress(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const customerId: string = req.user.customerId;
    await this.customerOrdersService.deleteAddress(customerId, id);
    return { success: true };
  }

  @Patch('addresses/:id/default')
  async setDefaultAddress(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const customerId: string = req.user.customerId;
    return this.customerOrdersService.setDefaultAddress(customerId, id);
  }
}
