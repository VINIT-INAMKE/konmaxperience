import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BookingStatus,
  EventStatus,
  OrderItemStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { AuditService } from '../audit/audit.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { toPaise } from '../common/money/money';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  systemActor,
  userActor,
} from '../common/events/domain-events';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

/**
 * Bookings that occupy a seat: `confirmed`, `attended`, or a `held` row whose
 * hold has not run out yet.
 *
 * This predicate is what makes a fifteen-minute checkout hold safe. A quote
 * writes a `held` `EventBooking` (`CheckoutService.createHolds`) so two
 * customers cannot pay for the same last seat; without the `hold_expires_at`
 * bound, an abandoned checkout would keep blocking that seat until the sweep
 * ran — and between sweeps the event would read as full. `cancelled` and
 * `no_show` never occupy: the first gave the seat back, the second is only
 * ever marked once the event is over.
 *
 * `hold_expires_at: { gt: now }` does not match NULL, so a `held` row with no
 * expiry occupies nothing — `EventHoldsCron` deletes those.
 */
export const OCCUPYING_BOOKINGS = (
  now: Date = new Date(),
): Prisma.EventBookingWhereInput => ({
  OR: [
    { status: { in: [BookingStatus.confirmed, BookingStatus.attended] } },
    { status: BookingStatus.held, hold_expires_at: { gt: now } },
  ],
});

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditService,
    private readonly loyalty: LoyaltyService,
  ) {}

  private async enrichWithGuestCounts<
    T extends { id: string; capacity: number },
  >(
    events: T[],
  ): Promise<Array<T & { booked_guests: number; spots_remaining: number }>> {
    if (events.length === 0) return [];
    const eventIds = events.map((e) => e.id);
    const guestSums = await this.prisma.eventBooking.groupBy({
      by: ['event_id'],
      where: { event_id: { in: eventIds }, ...OCCUPYING_BOOKINGS() },
      _sum: { guests: true },
    });
    const guestMap = new Map(
      guestSums.map((g) => [g.event_id, g._sum.guests ?? 0]),
    );
    return events.map((event) => {
      const booked_guests = guestMap.get(event.id) ?? 0;
      return {
        ...event,
        booked_guests,
        spots_remaining: event.capacity - booked_guests,
      };
    });
  }

  async findUpcoming() {
    const events = await this.prisma.event.findMany({
      where: {
        date: { gte: new Date() },
        status: { not: EventStatus.cancelled },
      },
      include: {
        zone: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    return this.enrichWithGuestCounts(events);
  }

  async findAll() {
    const events = await this.prisma.event.findMany({
      include: {
        zone: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    return this.enrichWithGuestCounts(events);
  }

  async findAllForExport() {
    return this.prisma.event.findMany({
      orderBy: { date: 'desc' },
      include: {
        zone: { select: { name: true } },
        brand: { select: { name: true } },
      },
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        zone: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    const guestAgg = await this.prisma.eventBooking.aggregate({
      where: { event_id: id, ...OCCUPYING_BOOKINGS() },
      _sum: { guests: true },
    });
    const booked_guests = guestAgg._sum.guests ?? 0;

    return {
      ...event,
      booked_guests,
      spots_remaining: event.capacity - booked_guests,
    };
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
    // Verify event exists (lightweight check — no aggregation). `status` comes
    // along so `event.completed` fires only on the transition into `past`.
    const exists = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!exists) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    const updated = await this.prisma.event.update({
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

    // Emit AFTER the update resolves (SPEC §4.1).
    if (dto.status === EventStatus.past && exists.status !== EventStatus.past) {
      const attendedCount = await this.prisma.eventBooking.count({
        where: {
          event_id: id,
          payment_status: { in: ['paid', 'free'] },
        },
      });
      emitDomainEvent(this.eventEmitter, DomainEvent.EVENT_COMPLETED, {
        ...domainEventBase(updated.node_id, systemActor()),
        eventId: updated.id,
        title: updated.title,
        attendedCount,
      });
    }

    return updated;
  }

  async remove(id: string) {
    // Verify event exists (lightweight check — no aggregation)
    const exists = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // `EventBooking.event` is `onDelete: Restrict` (P2-05), so deleting an event
    // that still has bookings would surface a raw Prisma FK error. Say it plainly.
    const bookings = await this.prisma.eventBooking.count({
      where: { event_id: id },
    });
    if (bookings > 0) {
      throw new ConflictException('Event has bookings; cancel it instead');
    }

    return this.prisma.event.delete({ where: { id } });
  }

  async createBooking(eventId: string, dto: CreateBookingDto) {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Find the event
        const event = await tx.event.findUniqueOrThrow({
          where: { id: eventId },
        });

        // 2. Check event date is in the future
        if (event.date < new Date()) {
          throw new BadRequestException('Cannot book a past event.');
        }

        // 3. Check event is not cancelled
        if (event.status === EventStatus.cancelled) {
          throw new BadRequestException('Cannot book a cancelled event.');
        }

        // 4. Check duplicate booking by phone
        const existingBooking = await tx.eventBooking.findUnique({
          where: {
            event_id_customer_phone: {
              event_id: eventId,
              customer_phone: dto.customer_phone,
            },
          },
          select: { id: true },
        });
        if (existingBooking) {
          throw new BadRequestException(
            'This phone number has already booked this event.',
          );
        }

        // 5. Sum the bookings that actually occupy a seat (expired holds do not)
        const aggregate = await tx.eventBooking.aggregate({
          where: { event_id: eventId, ...OCCUPYING_BOOKINGS() },
          _sum: { guests: true },
        });
        const booked = aggregate._sum.guests ?? 0;

        // 6. Check capacity
        if (booked + dto.guests > event.capacity) {
          throw new BadRequestException(
            `Sorry, this event is full. No spots remain for ${dto.guests} guests.`,
          );
        }

        // 7. Create booking
        return tx.eventBooking.create({
          data: {
            event_id: eventId,
            customer_name: dto.customer_name,
            customer_phone: dto.customer_phone,
            guests: dto.guests,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ---------------------------------------------------------------
  // Checkout Event (Razorpay order or free booking)
  // ---------------------------------------------------------------
  async checkoutEvent(eventId: string, guests: number, customerId: string) {
    // Fetch event
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Check event date is in the future
    if (event.date < new Date()) {
      throw new BadRequestException('Cannot book a past event');
    }

    // Check capacity
    const guestAgg = await this.prisma.eventBooking.aggregate({
      where: { event_id: eventId, ...OCCUPYING_BOOKINGS() },
      _sum: { guests: true },
    });
    const bookedGuests = guestAgg._sum.guests ?? 0;
    if (event.capacity - bookedGuests < guests) {
      throw new BadRequestException('This event is now full');
    }

    // Calculate amount in paise
    const amountInPaise = Math.round(event.price.toNumber() * guests * 100);

    // Free event path (D-19)
    if (amountInPaise === 0) {
      const booking = await this.prisma.$transaction(
        async (tx) => {
          // Re-check capacity inside transaction
          const txAgg = await tx.eventBooking.aggregate({
            where: { event_id: eventId, ...OCCUPYING_BOOKINGS() },
            _sum: { guests: true },
          });
          const txBooked = txAgg._sum.guests ?? 0;
          if (event.capacity - txBooked < guests) {
            throw new BadRequestException('This event is now full');
          }

          // Get customer info
          const customer = await tx.customer.findUnique({
            where: { id: customerId },
          });

          return tx.eventBooking.create({
            data: {
              event_id: eventId,
              customer_id: customerId,
              customer_name: customer?.name || '',
              customer_phone: customer?.phone || '',
              guests,
              payment_status: 'free',
              payment_amount: 0,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return { type: 'free' as const, booking };
    }

    // Paid event path
    // Step 1: Create Razorpay order OUTSIDE tx (external API, avoids holding serializable lock)
    // If capacity is exceeded later, the unused Razorpay order auto-expires (~15min, no harm)
    const order = await this.razorpayService.createOrder({
      amount: amountInPaise,
      receipt: `evt_${eventId.slice(0, 8)}_${Date.now()}`,
      notes: { type: 'event_booking', entity_id: eventId },
    });

    // Step 2: Short serializable tx — re-check capacity + insert booking (no external calls)
    await this.prisma.$transaction(
      async (tx) => {
        const txAgg = await tx.eventBooking.aggregate({
          where: { event_id: eventId, ...OCCUPYING_BOOKINGS() },
          _sum: { guests: true },
        });
        const txBooked = txAgg._sum.guests ?? 0;
        if (event.capacity - txBooked < guests) {
          throw new BadRequestException('This event is now full');
        }

        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });
        return tx.eventBooking.create({
          data: {
            event_id: eventId,
            customer_id: customerId,
            customer_name: customer?.name || '',
            customer_phone: customer?.phone || '',
            guests,
            razorpay_order_id: order.id,
            payment_status: 'pending',
            payment_amount: amountInPaise / 100,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { type: 'paid' as const, razorpay_order_id: order.id };
  }

  // ---------------------------------------------------------------
  // Confirm Booking (signature verify + API re-fetch + booking update)
  // ---------------------------------------------------------------
  async confirmBooking(
    eventId: string,
    dto: ConfirmBookingDto,
    customerId: string,
  ) {
    // Step 1: Verify HMAC signature (D-09) — BEFORE fetchPayment
    const isValid = this.razorpayService.verifyPaymentSignature(
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Step 2: Re-fetch payment from Razorpay API (D-12 belt-and-suspenders)
    // Accept both 'captured' (auto-capture on) and 'authorized' (auto-capture off / test mode)
    const payment = await this.razorpayService.fetchPayment(
      dto.razorpay_payment_id,
    );
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      throw new BadRequestException(
        `Payment not captured — status: ${payment.status}`,
      );
    }
    if (payment.order_id !== dto.razorpay_order_id) {
      throw new BadRequestException('Order ID mismatch');
    }

    // Step 3: Find pending booking and update in serializable transaction
    return this.prisma.$transaction(
      async (tx) => {
        const booking = await tx.eventBooking.findFirst({
          where: {
            razorpay_order_id: dto.razorpay_order_id,
            customer_id: customerId,
          },
        });
        if (!booking) {
          throw new NotFoundException('Booking not found');
        }
        if (booking.payment_status === 'paid') {
          return booking; // idempotent
        }

        // Re-check capacity inside transaction (only count paid + free).
        // Deliberately NOT `OCCUPYING_BOOKINGS`: this branch decides whether a
        // payment that already landed has to be refunded, so it must count only
        // seats that are settled. A checkout hold is `payment_status: 'pending'`
        // and is therefore already excluded — as is the booking being confirmed
        // right now, which is why the comparison below is `< booking.guests`.
        const guestAgg = await tx.eventBooking.aggregate({
          where: {
            event_id: eventId,
            payment_status: { in: ['paid', 'free'] },
          },
          _sum: { guests: true },
        });
        const confirmedGuests = guestAgg._sum.guests ?? 0;
        const event = await tx.event.findUnique({ where: { id: eventId } });

        if (!event || event.capacity - confirmedGuests < booking.guests) {
          // Capacity exceeded after payment — auto-refund (D-14)
          await this.razorpayService.createRefund(
            dto.razorpay_payment_id,
            Number(payment.amount),
            'capacity_exceeded',
          );
          await tx.eventBooking.update({
            where: { id: booking.id },
            data: { payment_status: 'refunded' },
          });
          throw new BadRequestException(
            'This event is now full. Your payment has been refunded — it may take 5-7 business days to reflect.',
          );
        }

        // Update booking to paid
        if (dto.customer_name && !booking.customer_name) {
          await tx.eventBooking.update({
            where: { id: booking.id },
            data: {
              payment_status: 'paid',
              razorpay_payment_id: dto.razorpay_payment_id,
              customer_name: dto.customer_name,
            },
          });
        } else {
          await tx.eventBooking.update({
            where: { id: booking.id },
            data: {
              payment_status: 'paid',
              razorpay_payment_id: dto.razorpay_payment_id,
            },
          });
        }

        return tx.eventBooking.findUnique({ where: { id: booking.id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ---------------------------------------------------------------
  // Attendance (OPS-04, SPEC §5.2 step 5)
  // ---------------------------------------------------------------

  /**
   * Marks one booking `attended` or `no_show` on the day.
   *
   * `attended` also flips the linked `OrderItem` to `attended`, which is what
   * opens the review gate (`ReviewsService` only accepts a review for a
   * `delivered` or `attended` item), and emits `booking.attended` — the event
   * the SALES bridge rule and the review invitation consume.
   *
   * Only a `confirmed` booking can be marked: a `held` row is an unpaid
   * placeholder, and `cancelled` / `attended` / `no_show` are terminal. The
   * booking row, the order item and the audit row commit together; the domain
   * event and the loyalty earn happen *after* the commit and are
   * failure-isolated, so a broken listener can never roll back attendance.
   */
  async markAttendance(
    eventId: string,
    dto: MarkAttendanceDto,
    userId: string | null,
  ) {
    const { updated, nodeId, orderId } = await this.prisma.$transaction(
      async (tx) => {
        const booking = await tx.eventBooking.findFirst({
          where: { id: dto.booking_id, event_id: eventId },
          include: {
            order_item: { select: { id: true, order_id: true } },
            event: { select: { node_id: true } },
          },
        });
        if (!booking) {
          throw new NotFoundException(
            `Booking ${dto.booking_id} not found for this event`,
          );
        }
        if (booking.status !== BookingStatus.confirmed) {
          throw new BadRequestException(
            `Only a confirmed booking can be marked ${dto.status} — this one is ${booking.status}`,
          );
        }

        const row = await tx.eventBooking.update({
          where: { id: booking.id },
          data: { status: dto.status },
        });

        // A no-show item is `cancelled`, not `attended`: nothing was consumed,
        // so it must not open the review gate.
        if (booking.order_item) {
          await tx.orderItem.update({
            where: { id: booking.order_item.id },
            data: {
              status:
                dto.status === BookingStatus.attended
                  ? OrderItemStatus.attended
                  : OrderItemStatus.cancelled,
            },
          });
        }

        await this.audit.record(tx, {
          entity_type: 'event_booking',
          entity_id: booking.id,
          action: `booking.${dto.status}`,
          ...AuditService.user(userId),
          before: { status: booking.status },
          after: { status: dto.status },
        });

        return {
          updated: row,
          nodeId: booking.event.node_id,
          orderId: booking.order_item?.order_id ?? null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (dto.status === BookingStatus.attended) {
      emitDomainEvent(this.eventEmitter, DomainEvent.BOOKING_ATTENDED, {
        ...domainEventBase(nodeId, userActor(userId)),
        bookingId: updated.id,
        eventId,
        guests: updated.guests,
      });
      await this.earnForAttendedBooking(orderId);
    }

    return updated;
  }

  /**
   * An experience is never `delivered`, so attendance is the moment its order
   * earns loyalty. `earnForOrder` is idempotent on `@@unique([order_id,
   * reason])`, so an order that already earned on delivery (a mixed cart with
   * both a shipped line and an experience) simply earns nothing more here.
   *
   * Shipping is excluded from the base — a courier fee is not spend on us.
   * Failure is logged, never thrown: the booking is already `attended` and
   * committed, and a loyalty outage must not read back as a failed check-in.
   */
  private async earnForAttendedBooking(orderId: string | null): Promise<void> {
    if (!orderId) return;
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { customer_id: true, total: true, shipping_amount: true },
      });
      if (!order?.customer_id) return;

      const netPaise = Math.max(
        0,
        toPaise(order.total) - toPaise(order.shipping_amount),
      );
      await this.loyalty.earnForOrder(orderId, order.customer_id, netPaise);
    } catch (error) {
      this.logger.warn(
        `Loyalty earn for attended booking on order ${orderId} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async getBookings(eventId: string) {
    // Verify event exists (lightweight check)
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    return this.prisma.eventBooking.findMany({
      where: { event_id: eventId },
      orderBy: { created_at: 'desc' },
    });
  }
}
