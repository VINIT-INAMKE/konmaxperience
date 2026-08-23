import { NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { DomainEvent } from '../common/events/domain-events';
import { DEFAULT_NODE_ID } from '../node/node.constants';

const mockEmitter = { emit: jest.fn() };

const mockPrisma = {
  feedback: {
    create: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
};

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    service = new FeedbackService(mockPrisma as any, mockEmitter as any);
    jest.clearAllMocks();
    mockEmitter.emit.mockImplementation(() => true);
  });

  // ---------------------------------------------------------------
  // submit
  // ---------------------------------------------------------------
  describe('submit', () => {
    it('creates feedback without order_id', async () => {
      const dto = { rating: 5, comment: 'Great food!' };
      const expected = { id: 'f1', ...dto, order_id: null };
      mockPrisma.feedback.create.mockResolvedValue(expected);

      const result = await service.submit(dto);

      expect(result).toEqual(expected);
      expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
        data: {
          order_id: undefined,
          rating: 5,
          comment: 'Great food!',
          customer_name: undefined,
          customer_phone: undefined,
        },
      });
      expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();
    });

    it('verifies order exists when order_id is provided', async () => {
      const dto = { rating: 4, order_id: 'order-1' };
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'order-1' });
      mockPrisma.feedback.create.mockResolvedValue({ id: 'f2', ...dto });

      await service.submit(dto);

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
      });
    });

    it('throws NotFoundException when order_id does not exist', async () => {
      const dto = { rating: 3, order_id: 'nonexistent' };
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.submit(dto)).rejects.toThrow(NotFoundException);
      expect(mockEmitter.emit).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------
    // feedback.received domain event (SPEC §4.1)
    // -------------------------------------------------------------
    it('emits feedback.received once, after the row is created', async () => {
      let createResolved = false;
      mockPrisma.feedback.create.mockImplementation(async () => {
        createResolved = true;
        return {
          id: 'f9',
          order_id: null,
          rating: 5,
          comment: 'Great food!',
        };
      });
      mockEmitter.emit.mockImplementation(() => {
        expect(createResolved).toBe(true);
        return true;
      });

      await service.submit({ rating: 5, comment: 'Great food!' });

      expect(mockEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.FEEDBACK_RECEIVED,
        expect.objectContaining({
          node_id: DEFAULT_NODE_ID,
          actor: { actor_type: 'system', actor_id: null },
          occurred_at: expect.any(String),
          feedbackId: 'f9',
          orderId: null,
          rating: 5,
          comment: 'Great food!',
        }),
      );
    });

    it('takes the node from the linked order when one is given', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        node_id: 'node-7',
      });
      mockPrisma.feedback.create.mockResolvedValue({
        id: 'f10',
        order_id: 'order-1',
        rating: 4,
        comment: null,
      });

      await service.submit({ rating: 4, order_id: 'order-1' });

      expect(mockEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.FEEDBACK_RECEIVED,
        expect.objectContaining({ node_id: 'node-7', orderId: 'order-1' }),
      );
    });

    it('still resolves when the emitter throws', async () => {
      const created = { id: 'f11', order_id: null, rating: 2, comment: null };
      mockPrisma.feedback.create.mockResolvedValue(created);
      mockEmitter.emit.mockImplementation(() => {
        throw new Error('listener exploded');
      });

      await expect(service.submit({ rating: 2 })).resolves.toEqual(created);
    });
  });

  // ---------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------
  describe('findAll', () => {
    it('queries with no filters', async () => {
      mockPrisma.feedback.findMany.mockResolvedValue([]);

      await service.findAll({});

      expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
        where: {},
        include: { order: { select: { id: true } } },
        orderBy: { created_at: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('queries with rating filter', async () => {
      mockPrisma.feedback.findMany.mockResolvedValue([]);

      await service.findAll({ rating: 4 });

      expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rating: 4 },
        }),
      );
    });

    it('queries with date range filters', async () => {
      mockPrisma.feedback.findMany.mockResolvedValue([]);

      await service.findAll({
        date_from: '2026-01-01',
        date_to: '2026-01-31',
      });

      const call = mockPrisma.feedback.findMany.mock.calls[0][0];
      expect(call.where.created_at).toBeDefined();
      expect(call.where.created_at.gte).toBeInstanceOf(Date);
      expect(call.where.created_at.lte).toBeInstanceOf(Date);
    });
  });

  // ---------------------------------------------------------------
  // getStats
  // ---------------------------------------------------------------
  describe('getStats', () => {
    it('returns average_rating and total_count', async () => {
      mockPrisma.feedback.aggregate.mockResolvedValue({
        _avg: { rating: 4.333333 },
        _count: { id: 12 },
      });

      const result = await service.getStats();

      expect(result).toEqual({
        average_rating: 4.3,
        total_count: 12,
      });
    });

    it('returns 0 average when no feedback exists', async () => {
      mockPrisma.feedback.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { id: 0 },
      });

      const result = await service.getStats();

      expect(result).toEqual({
        average_rating: 0,
        total_count: 0,
      });
    });
  });
});
