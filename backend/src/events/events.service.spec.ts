import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, OrderItemStatus, Prisma } from '@prisma/client';
import { EventsService, OCCUPYING_BOOKINGS } from './events.service';
import { DomainEvent } from '../common/events/domain-events';

const mockEmitter = { emit: jest.fn() };

const mockTx = {
  event: {
    findUniqueOrThrow: jest.fn(),
  },
  eventBooking: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  orderItem: {
    update: jest.fn(),
  },
};

const mockPrisma = {
  event: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  eventBooking: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  order: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<any>) =>
    cb(mockTx),
  ),
};

const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };
const mockLoyalty = { earnForOrder: jest.fn().mockResolvedValue(null) };

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(() => {
    service = new EventsService(
      mockPrisma as any,
      {} as any,
      mockEmitter as any,
      mockAudit as any,
      mockLoyalty as any,
    );
    jest.clearAllMocks();
    mockEmitter.emit.mockImplementation(() => true);
    mockAudit.record.mockResolvedValue(undefined);
    mockLoyalty.earnForOrder.mockResolvedValue(null);
    // Reset $transaction to pass mockTx
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockTx) => Promise<any>) => cb(mockTx),
    );
  });

  // ---------------------------------------------------------------
  // createBooking — capacity enforcement
  // ---------------------------------------------------------------
  describe('createBooking', () => {
    const futureDate = new Date(Date.now() + 86400000); // tomorrow

    it('succeeds when capacity is available (35 booked + 3 new <= 40)', async () => {
      mockTx.event.findUniqueOrThrow.mockResolvedValue({
        id: 'e1',
        capacity: 40,
        date: futureDate,
        status: 'upcoming',
      });
      mockTx.eventBooking.aggregate.mockResolvedValue({
        _sum: { guests: 35 },
      });
      const expectedBooking = {
        id: 'b1',
        event_id: 'e1',
        customer_name: 'John',
        customer_phone: '12345',
        guests: 3,
      };
      mockTx.eventBooking.create.mockResolvedValue(expectedBooking);

      const result = await service.createBooking('e1', {
        customer_name: 'John',
        customer_phone: '12345',
        guests: 3,
      });

      expect(result).toEqual(expectedBooking);
      expect(mockTx.eventBooking.create).toHaveBeenCalledWith({
        data: {
          event_id: 'e1',
          customer_name: 'John',
          customer_phone: '12345',
          guests: 3,
        },
      });
    });

    it('throws BadRequestException when capacity exceeded (38 booked + 5 new > 40)', async () => {
      mockTx.event.findUniqueOrThrow.mockResolvedValue({
        id: 'e1',
        capacity: 40,
        date: futureDate,
        status: 'upcoming',
      });
      mockTx.eventBooking.aggregate.mockResolvedValue({
        _sum: { guests: 38 },
      });

      await expect(
        service.createBooking('e1', {
          customer_name: 'Jane',
          customer_phone: '67890',
          guests: 5,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.eventBooking.create).not.toHaveBeenCalled();
    });

    it('succeeds when booking fills capacity exactly (7 booked + 3 new = 10)', async () => {
      mockTx.event.findUniqueOrThrow.mockResolvedValue({
        id: 'e2',
        capacity: 10,
        date: futureDate,
        status: 'upcoming',
      });
      mockTx.eventBooking.aggregate.mockResolvedValue({
        _sum: { guests: 7 },
      });
      const expectedBooking = {
        id: 'b2',
        event_id: 'e2',
        customer_name: 'Alice',
        customer_phone: '11111',
        guests: 3,
      };
      mockTx.eventBooking.create.mockResolvedValue(expectedBooking);

      const result = await service.createBooking('e2', {
        customer_name: 'Alice',
        customer_phone: '11111',
        guests: 3,
      });

      expect(result).toEqual(expectedBooking);
      expect(mockTx.eventBooking.create).toHaveBeenCalled();
    });

    it('throws BadRequestException for past events', async () => {
      const pastDate = new Date(Date.now() - 86400000); // yesterday
      mockTx.event.findUniqueOrThrow.mockResolvedValue({
        id: 'e3',
        capacity: 50,
        date: pastDate,
        status: 'upcoming',
      });

      await expect(
        service.createBooking('e3', {
          customer_name: 'Bob',
          customer_phone: '22222',
          guests: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for cancelled events', async () => {
      mockTx.event.findUniqueOrThrow.mockResolvedValue({
        id: 'e4',
        capacity: 50,
        date: futureDate,
        status: 'cancelled',
      });

      await expect(
        service.createBooking('e4', {
          customer_name: 'Carol',
          customer_phone: '33333',
          guests: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles null aggregate sum (no bookings yet)', async () => {
      mockTx.event.findUniqueOrThrow.mockResolvedValue({
        id: 'e5',
        capacity: 20,
        date: futureDate,
        status: 'upcoming',
      });
      mockTx.eventBooking.aggregate.mockResolvedValue({
        _sum: { guests: null },
      });
      mockTx.eventBooking.create.mockResolvedValue({
        id: 'b3',
        event_id: 'e5',
        customer_name: 'Dave',
        customer_phone: '44444',
        guests: 5,
      });

      const result = await service.createBooking('e5', {
        customer_name: 'Dave',
        customer_phone: '44444',
        guests: 5,
      });

      expect(result.id).toBe('b3');
      expect(mockTx.eventBooking.create).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // findUpcoming
  // ---------------------------------------------------------------
  describe('findUpcoming', () => {
    it('returns upcoming events with computed booked_guests and spots_remaining', async () => {
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'e1',
          title: 'Wine Tasting',
          date: new Date('2027-01-01'),
          capacity: 30,
          status: 'upcoming',
          bookings: [{ guests: 10 }, { guests: 5 }],
        },
      ]);
      mockPrisma.eventBooking.groupBy.mockResolvedValue([
        { event_id: 'e1', _sum: { guests: 15 } },
      ]);

      const result = await service.findUpcoming();

      expect(result).toHaveLength(1);
      expect(result[0].booked_guests).toBe(15);
      expect(result[0].spots_remaining).toBe(15);
    });

    it('returns empty array when no upcoming events', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);

      const result = await service.findUpcoming();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------
  describe('findOne', () => {
    it('throws NotFoundException when event does not exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------
  // remove — EventBooking.event is onDelete: Restrict (P2-05)
  // ---------------------------------------------------------------
  describe('remove', () => {
    it('throws NotFoundException when event does not exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.event.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException instead of a raw FK error when bookings exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'e1' });
      mockPrisma.eventBooking.count.mockResolvedValue(3);

      await expect(service.remove('e1')).rejects.toThrow(ConflictException);
      await expect(service.remove('e1')).rejects.toThrow(
        'Event has bookings; cancel it instead',
      );
      expect(mockPrisma.event.delete).not.toHaveBeenCalled();
    });

    it('deletes the event when it has no bookings', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'e1' });
      mockPrisma.eventBooking.count.mockResolvedValue(0);
      mockPrisma.event.delete.mockResolvedValue({ id: 'e1' });

      await expect(service.remove('e1')).resolves.toEqual({ id: 'e1' });
      expect(mockPrisma.event.delete).toHaveBeenCalledWith({
        where: { id: 'e1' },
      });
    });
  });

  // ---------------------------------------------------------------
  // update — event.completed domain event (SPEC §4.1)
  // ---------------------------------------------------------------
  describe('update — event.completed', () => {
    const updatedRow = {
      id: 'e1',
      node_id: 'node-1',
      title: 'Sunset Supper',
      status: 'past',
    };

    it('emits event.completed once, after the update resolves', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        status: 'upcoming',
      });
      let updateResolved = false;
      mockPrisma.event.update.mockImplementation(async () => {
        updateResolved = true;
        return updatedRow;
      });
      mockPrisma.eventBooking.count.mockResolvedValue(12);
      mockEmitter.emit.mockImplementation(() => {
        expect(updateResolved).toBe(true);
        return true;
      });

      await service.update('e1', { status: 'past' } as any);

      expect(mockEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.EVENT_COMPLETED,
        expect.objectContaining({
          node_id: 'node-1',
          actor: { actor_type: 'system', actor_id: null },
          occurred_at: expect.any(String),
          eventId: 'e1',
          title: 'Sunset Supper',
          attendedCount: 12,
        }),
      );
      expect(mockPrisma.eventBooking.count).toHaveBeenCalledWith({
        where: {
          event_id: 'e1',
          payment_status: { in: ['paid', 'free'] },
        },
      });
    });

    it('does not re-emit when the event was already past', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        status: 'past',
      });
      mockPrisma.event.update.mockResolvedValue(updatedRow);

      await service.update('e1', { status: 'past' } as any);

      expect(mockEmitter.emit).not.toHaveBeenCalled();
    });

    it('still resolves when the emitter throws', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        status: 'upcoming',
      });
      mockPrisma.event.update.mockResolvedValue(updatedRow);
      mockPrisma.eventBooking.count.mockResolvedValue(0);
      mockEmitter.emit.mockImplementation(() => {
        throw new Error('listener exploded');
      });

      await expect(
        service.update('e1', { status: 'past' } as any),
      ).resolves.toEqual(updatedRow);
    });
  });

  // ---------------------------------------------------------------
  // Hold-aware capacity (CHK-02) — an expired hold must not block a seat
  // ---------------------------------------------------------------
  describe('OCCUPYING_BOOKINGS', () => {
    const NOW = new Date('2026-08-24T06:15:00.000Z');
    const LIVE = new Date('2026-08-24T06:20:00.000Z'); // 5 min in the future
    const EXPIRED = new Date('2026-08-24T06:10:00.000Z'); // 5 min in the past

    /** Evaluates the generated `where` the way Postgres would, for one row. */
    function occupies(booking: {
      status: BookingStatus;
      hold_expires_at: Date | null;
    }): boolean {
      const clauses = OCCUPYING_BOOKINGS(NOW).OR as Array<{
        status?: unknown;
        hold_expires_at?: { gt: Date };
      }>;
      return clauses.some((clause) => {
        const settled = clause.status as
          | { in?: BookingStatus[] }
          | BookingStatus;
        if (typeof settled === 'object' && settled?.in) {
          return settled.in.includes(booking.status);
        }
        if (settled !== BookingStatus.held) return false;
        // Prisma `gt` never matches NULL — the hold with no expiry occupies nothing.
        return (
          booking.status === BookingStatus.held &&
          booking.hold_expires_at !== null &&
          booking.hold_expires_at > (clause.hold_expires_at as { gt: Date }).gt
        );
      });
    }

    it('an expired hold does not occupy capacity', () => {
      expect(
        occupies({ status: BookingStatus.held, hold_expires_at: EXPIRED }),
      ).toBe(false);
    });

    it('a live hold does occupy capacity', () => {
      expect(
        occupies({ status: BookingStatus.held, hold_expires_at: LIVE }),
      ).toBe(true);
    });

    it('a hold with no expiry occupies nothing (the sweep deletes it)', () => {
      expect(
        occupies({ status: BookingStatus.held, hold_expires_at: null }),
      ).toBe(false);
    });

    it('confirmed and attended always occupy; cancelled and no_show never do', () => {
      expect(
        occupies({ status: BookingStatus.confirmed, hold_expires_at: null }),
      ).toBe(true);
      expect(
        occupies({ status: BookingStatus.attended, hold_expires_at: null }),
      ).toBe(true);
      expect(
        occupies({ status: BookingStatus.cancelled, hold_expires_at: null }),
      ).toBe(false);
      expect(
        occupies({ status: BookingStatus.no_show, hold_expires_at: null }),
      ).toBe(false);
    });

    it('is applied to the list read', async () => {
      mockPrisma.event.findMany.mockResolvedValue([{ id: 'e1', capacity: 30 }]);
      mockPrisma.eventBooking.groupBy.mockResolvedValue([]);

      await service.findUpcoming();

      expect(mockPrisma.eventBooking.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            event_id: { in: ['e1'] },
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('is applied to the detail read', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'e1', capacity: 30 });
      mockPrisma.eventBooking.aggregate.mockResolvedValue({
        _sum: { guests: 4 },
      });

      const result = await service.findOne('e1');

      expect(result.spots_remaining).toBe(26);
      expect(mockPrisma.eventBooking.aggregate).toHaveBeenCalledWith({
        where: expect.objectContaining({
          event_id: 'e1',
          OR: expect.any(Array),
        }),
        _sum: { guests: true },
      });
    });

    it('is applied to the in-transaction re-check', async () => {
      mockTx.event.findUniqueOrThrow.mockResolvedValue({
        id: 'e1',
        capacity: 40,
        date: new Date(Date.now() + 86400000),
        status: 'upcoming',
      });
      mockTx.eventBooking.findUnique.mockResolvedValue(null);
      mockTx.eventBooking.aggregate.mockResolvedValue({ _sum: { guests: 0 } });
      mockTx.eventBooking.create.mockResolvedValue({ id: 'b1', guests: 2 });

      await service.createBooking('e1', {
        customer_name: 'Eve',
        customer_phone: '55555',
        guests: 2,
      });

      expect(mockTx.eventBooking.aggregate).toHaveBeenCalledWith({
        where: expect.objectContaining({
          event_id: 'e1',
          OR: expect.any(Array),
        }),
        _sum: { guests: true },
      });
    });
  });

  // ---------------------------------------------------------------
  // markAttendance (OPS-04, SPEC §5.2 step 5)
  // ---------------------------------------------------------------
  describe('markAttendance', () => {
    const USER = 'u0000000-0000-4000-8000-000000000001';
    const BOOKING = 'b0000000-0000-4000-8000-000000000001';

    function bookingRow(overrides: Record<string, unknown> = {}) {
      return {
        id: BOOKING,
        event_id: 'e1',
        status: BookingStatus.confirmed,
        guests: 2,
        event: { node_id: 'node-1' },
        order_item: { id: 'oi-1', order_id: 'o-1' },
        ...overrides,
      };
    }

    beforeEach(() => {
      mockTx.eventBooking.update.mockResolvedValue({
        id: BOOKING,
        status: BookingStatus.attended,
        guests: 2,
      });
      mockTx.orderItem.update.mockResolvedValue({ id: 'oi-1' });
      mockPrisma.order.findUnique.mockResolvedValue({
        customer_id: 'cust-1',
        total: new Prisma.Decimal(5079),
        shipping_amount: new Prisma.Decimal(79),
      });
    });

    it('throws NotFoundException when the booking is not on this event', async () => {
      mockTx.eventBooking.findFirst.mockResolvedValue(null);

      await expect(
        service.markAttendance(
          'e1',
          { booking_id: BOOKING, status: BookingStatus.attended },
          USER,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockTx.eventBooking.update).not.toHaveBeenCalled();
    });

    it('refuses to mark a held booking attended', async () => {
      mockTx.eventBooking.findFirst.mockResolvedValue(
        bookingRow({ status: BookingStatus.held }),
      );

      await expect(
        service.markAttendance(
          'e1',
          { booking_id: BOOKING, status: BookingStatus.attended },
          USER,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.eventBooking.update).not.toHaveBeenCalled();
      expect(mockEmitter.emit).not.toHaveBeenCalled();
    });

    it('refuses to re-mark an already attended booking', async () => {
      mockTx.eventBooking.findFirst.mockResolvedValue(
        bookingRow({ status: BookingStatus.attended }),
      );

      await expect(
        service.markAttendance(
          'e1',
          { booking_id: BOOKING, status: BookingStatus.attended },
          USER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('flips the linked OrderItem to attended, audits and emits booking.attended', async () => {
      mockTx.eventBooking.findFirst.mockResolvedValue(bookingRow());

      await service.markAttendance(
        'e1',
        { booking_id: BOOKING, status: BookingStatus.attended },
        USER,
      );

      expect(mockTx.eventBooking.update).toHaveBeenCalledWith({
        where: { id: BOOKING },
        data: { status: BookingStatus.attended },
      });
      expect(mockTx.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'oi-1' },
        data: { status: OrderItemStatus.attended },
      });
      expect(mockAudit.record).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          entity_type: 'event_booking',
          entity_id: BOOKING,
          action: 'booking.attended',
          actor_type: 'user',
          actor_id: USER,
          before: { status: BookingStatus.confirmed },
          after: { status: BookingStatus.attended },
        }),
      );
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.BOOKING_ATTENDED,
        expect.objectContaining({
          node_id: 'node-1',
          actor: { actor_type: 'user', actor_id: USER },
          bookingId: BOOKING,
          eventId: 'e1',
          guests: 2,
        }),
      );
    });

    it('credits loyalty on the order net of shipping, once', async () => {
      mockTx.eventBooking.findFirst.mockResolvedValue(bookingRow());

      await service.markAttendance(
        'e1',
        { booking_id: BOOKING, status: BookingStatus.attended },
        USER,
      );

      // ₹5079 total − ₹79 shipping = ₹5000 = 500000 paise
      expect(mockLoyalty.earnForOrder).toHaveBeenCalledTimes(1);
      expect(mockLoyalty.earnForOrder).toHaveBeenCalledWith(
        'o-1',
        'cust-1',
        500000,
      );
    });

    it('earns nothing when the booking has no order item', async () => {
      mockTx.eventBooking.findFirst.mockResolvedValue(
        bookingRow({ order_item: null }),
      );

      await service.markAttendance(
        'e1',
        { booking_id: BOOKING, status: BookingStatus.attended },
        USER,
      );

      expect(mockTx.orderItem.update).not.toHaveBeenCalled();
      expect(mockLoyalty.earnForOrder).not.toHaveBeenCalled();
      expect(mockEmitter.emit).toHaveBeenCalledTimes(1);
    });

    it('still resolves when the loyalty credit fails', async () => {
      mockTx.eventBooking.findFirst.mockResolvedValue(bookingRow());
      mockLoyalty.earnForOrder.mockRejectedValue(new Error('ledger down'));

      await expect(
        service.markAttendance(
          'e1',
          { booking_id: BOOKING, status: BookingStatus.attended },
          USER,
        ),
      ).resolves.toEqual(
        expect.objectContaining({ status: BookingStatus.attended }),
      );
    });

    it('a no_show cancels the order item and neither emits nor earns', async () => {
      mockTx.eventBooking.findFirst.mockResolvedValue(bookingRow());
      mockTx.eventBooking.update.mockResolvedValue({
        id: BOOKING,
        status: BookingStatus.no_show,
        guests: 2,
      });

      await service.markAttendance(
        'e1',
        { booking_id: BOOKING, status: BookingStatus.no_show },
        USER,
      );

      expect(mockTx.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'oi-1' },
        data: { status: OrderItemStatus.cancelled },
      });
      expect(mockEmitter.emit).not.toHaveBeenCalled();
      expect(mockLoyalty.earnForOrder).not.toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ action: 'booking.no_show' }),
      );
    });
  });
});
