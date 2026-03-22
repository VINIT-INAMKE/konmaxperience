import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

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

  @Post(':id/bookings')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async createBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.eventsService.createBooking(id, dto);
  }

  @Get(':id/bookings')
  @RequiresPermission(Permission.MANAGE_OPS)
  async getBookings(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.getBookings(id);
  }
}
