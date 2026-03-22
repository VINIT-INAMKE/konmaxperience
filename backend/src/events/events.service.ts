import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findUpcoming() {
    const events = await this.prisma.event.findMany({
      where: {
        date: { gte: new Date() },
        status: { not: 'cancelled' },
      },
      include: {
        bookings: { select: { guests: true } },
        zone: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    return events.map((event) => {
      const booked_guests = event.bookings.reduce(
        (sum, b) => sum + b.guests,
        0,
      );
      return {
        ...event,
        booked_guests,
        spots_remaining: event.capacity - booked_guests,
      };
    });
  }

  async findAll() {
    const events = await this.prisma.event.findMany({
      include: {
        bookings: { select: { guests: true } },
        zone: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    return events.map((event) => {
      const booked_guests = event.bookings.reduce(
        (sum, b) => sum + b.guests,
        0,
      );
      return {
        ...event,
        booked_guests,
        spots_remaining: event.capacity - booked_guests,
      };
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        zone: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        bookings: true,
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  async create(dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        title: dto.title,
        event_type: dto.event_type,
        date: new Date(dto.date),
        capacity: dto.capacity,
        price: dto.price,
        zone_id: dto.zone_id,
        brand_id: dto.brand_id,
        description: dto.description,
        image_url: dto.image_url,
      },
      include: {
        zone: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdateEventDto) {
    // Verify event exists
    await this.findOne(id);

    return this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.event_type !== undefined && { event_type: dto.event_type }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.zone_id !== undefined && { zone_id: dto.zone_id }),
        ...(dto.brand_id !== undefined && { brand_id: dto.brand_id }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.image_url !== undefined && { image_url: dto.image_url }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        zone: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    // Verify event exists
    await this.findOne(id);

    return this.prisma.event.delete({ where: { id } });
  }

  async createBooking(eventId: string, dto: CreateBookingDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Find the event
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
      });

      // 2. Check event date is in the future
      if (event.date < new Date()) {
        throw new BadRequestException(
          'Cannot book a past event.',
        );
      }

      // 3. Check event is not cancelled
      if (event.status === 'cancelled') {
        throw new BadRequestException(
          'Cannot book a cancelled event.',
        );
      }

      // 4. Sum existing bookings
      const aggregate = await tx.eventBooking.aggregate({
        where: { event_id: eventId },
        _sum: { guests: true },
      });
      const booked = aggregate._sum.guests ?? 0;

      // 5. Check capacity
      if (booked + dto.guests > event.capacity) {
        throw new BadRequestException(
          `Sorry, this event is full. No spots remain for ${dto.guests} guests.`,
        );
      }

      // 6. Create booking
      return tx.eventBooking.create({
        data: {
          event_id: eventId,
          customer_name: dto.customer_name,
          customer_phone: dto.customer_phone,
          guests: dto.guests,
        },
      });
    });
  }

  async getBookings(eventId: string) {
    // Verify event exists
    await this.findOne(eventId);

    return this.prisma.eventBooking.findMany({
      where: { event_id: eventId },
      orderBy: { created_at: 'desc' },
    });
  }
}
