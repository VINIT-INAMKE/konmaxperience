import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CheckoutEventDto } from './dto/checkout-event.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CustomerGuard } from '../customer-auth/guards/customer.guard';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // Public endpoints first
  @Get()
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async findUpcoming() {
    return this.eventsService.findUpcoming();
  }

  // IMPORTANT: 'all' BEFORE ':id' to prevent NestJS route shadowing
  @Get('all')
  @RequiresPermission(Permission.MANAGE_OPS)
  async findAll() {
    return this.eventsService.findAll();
  }

  @Get(':id')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_OPS)
  async create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.remove(id);
  }

  @Post(':id/checkout')
  @UseGuards(CustomerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async checkout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckoutEventDto,
    @Req() req: any,
  ) {
    return this.eventsService.checkoutEvent(id, dto.guests, req.user.customerId);
  }

  @Post(':id/bookings/confirm')
  @UseGuards(CustomerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmBookingDto,
    @Req() req: any,
  ) {
    return this.eventsService.confirmBooking(id, dto, req.user.customerId);
  }

  @Post(':id/bookings')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async createBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBookingDto,
  ) {
    const booking = await this.eventsService.createBooking(id, dto);
    // Return minimal response for public endpoint — no internal IDs or payment fields
    return { id: booking.id, guests: booking.guests, created_at: booking.created_at };
  }

  @Get(':id/bookings')
  @RequiresPermission(Permission.MANAGE_OPS)
  async getBookings(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.getBookings(id);
  }
}
