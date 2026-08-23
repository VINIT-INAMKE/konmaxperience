import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { DomainEvent } from '../common/events/domain-events';

const mockEmitter = { emit: jest.fn() };

const mockTx = {
  event: {
    findUniqueOrThrow: jest.fn(),
  },
  eventBooking: {
    findUnique: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
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
    groupBy: jest.fn().mockResolvedValue([]),
  },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<any>) =>
    cb(mockTx),
  ),
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(() => {
    service = new EventsService(
      mockPrisma as any,
      {} as any,
      mockEmitter as any,
    );
    jest.clearAllMocks();
    mockEmitter.emit.mockImplementation(() => true);
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
});
