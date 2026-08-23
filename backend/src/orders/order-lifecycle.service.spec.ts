import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import {
  COMPLETABLE_STATUSES,
  OrderLifecycleService,
} from './order-lifecycle.service';
import { STATUS_TRANSITIONS } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  mockAuditService,
  provideAuditService,
} from '../test-utils/mock-providers';

const dec = (n: number) => new Prisma.Decimal(n);

const audit = mockAuditService();

const loyalty = {
  earnForOrder: jest.fn(),
};

const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  auditEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};

/** A delivered ₹1,000 order with ₹100 off — ₹900 of goods value. */
const deliveredOrder = {
  id: 'o-1',
  customer_id: 'cust-1',
  subtotal: dec(1000),
  discount_amount: dec(100),
  loyalty_points_earned: 0,
};

describe('OrderLifecycleService', () => {
  let service: OrderLifecycleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderLifecycleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoyaltyService, useValue: loyalty },
        provideAuditService(audit),
      ],
    }).compile();

    service = module.get(OrderLifecycleService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    mockPrisma.$transaction.mockImplementation(async (cb: any) =>
      cb(mockPrisma),
    );
  });

  afterAll(() => jest.restoreAllMocks());

  // ---------------------------------------------------------------
  // onDelivered — the loyalty earn
  // ---------------------------------------------------------------
  describe('onDelivered', () => {
    const actor = { actor_type: 'user' as const, actor_id: 'u-1' };

    it('credits the ledger and mirrors the points onto the order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(deliveredOrder);
      loyalty.earnForOrder.mockResolvedValue({ id: 'lt-1', delta: 9 });

      const credited = await service.onDelivered('o-1', actor);

      expect(credited).toBe(9);
      expect(loyalty.earnForOrder).toHaveBeenCalledWith(
        'o-1',
        'cust-1',
        90_000,
      );
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'o-1' },
        data: { loyalty_points_earned: 9 },
      });
    });

    it('audits the credit inside the same transaction as the mirror write', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(deliveredOrder);
      loyalty.earnForOrder.mockResolvedValue({ id: 'lt-1', delta: 9 });

      await service.onDelivered('o-1', actor);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(mockPrisma, {
        entity_type: 'order',
        entity_id: 'o-1',
        action: 'order.loyalty_earned',
        actor_type: 'user',
        actor_id: 'u-1',
        before: { loyalty_points_earned: 0 },
        after: { loyalty_points_earned: 9, loyalty_transaction_id: 'lt-1' },
      });
    });

    /**
     * Freight is a pass-through cost, so the earn base is `subtotal − discount`
     * — equivalently the paid `total` with `shipping_amount` taken back off.
     */
    it('earns on the goods value only — shipping never earns', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...deliveredOrder,
        subtotal: dec(1000),
        discount_amount: dec(0),
        shipping_amount: dec(49), // never selected, so never reachable
      });
      loyalty.earnForOrder.mockResolvedValue({ id: 'lt-1', delta: 10 });

      await service.onDelivered('o-1', actor);

      expect(
        mockPrisma.order.findUnique.mock.calls[0][0].select,
      ).not.toHaveProperty('shipping_amount');
      // ₹1,000 of goods -> 100_000 paise, not the ₹1,049 the customer paid.
      expect(loyalty.earnForOrder).toHaveBeenCalledWith(
        'o-1',
        'cust-1',
        100_000,
      );
    });

    it('never sends a negative base when the discount exceeds the subtotal', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...deliveredOrder,
        subtotal: dec(100),
        discount_amount: dec(250),
      });
      loyalty.earnForOrder.mockResolvedValue(null);

      await service.onDelivered('o-1', actor);

      expect(loyalty.earnForOrder).toHaveBeenCalledWith('o-1', 'cust-1', 0);
    });

    it('is a no-op the second time — the mirror already carries the points', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...deliveredOrder,
        loyalty_points_earned: 9,
      });

      const credited = await service.onDelivered('o-1', actor);

      expect(credited).toBe(0);
      expect(loyalty.earnForOrder).not.toHaveBeenCalled();
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    /** The ledger's `@@unique([order_id, reason])` is the real guard. */
    it('writes nothing when the ledger already holds the earn row', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(deliveredOrder);
      loyalty.earnForOrder.mockResolvedValue(null);

      const credited = await service.onDelivered('o-1', actor);

      expect(credited).toBe(0);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('earns nothing for a POS order with no customer', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...deliveredOrder,
        customer_id: null,
      });

      const credited = await service.onDelivered('o-1', actor);

      expect(credited).toBe(0);
      expect(loyalty.earnForOrder).not.toHaveBeenCalled();
    });

    it('earns nothing for an order that no longer exists', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.onDelivered('o-1', actor)).resolves.toBe(0);
      expect(loyalty.earnForOrder).not.toHaveBeenCalled();
    });

    /**
     * It runs after the status transaction has committed, so a loyalty outage
     * must not turn a delivered order into a 500 for the rider or the courier.
     */
    it('swallows and logs a loyalty failure instead of throwing', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn');
      mockPrisma.order.findUnique.mockResolvedValue(deliveredOrder);
      loyalty.earnForOrder.mockRejectedValue(new Error('ledger unavailable'));

      await expect(service.onDelivered('o-1', actor)).resolves.toBe(0);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('ledger unavailable'),
      );
    });
  });

  // ---------------------------------------------------------------
  // complete — the terminal close-out
  // ---------------------------------------------------------------
  describe('complete', () => {
    const arrange = (status: OrderStatus) => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({ id: 'o-1', status })
        // the credit hook's own read
        .mockResolvedValueOnce({ ...deliveredOrder, loyalty_points_earned: 9 })
        .mockResolvedValueOnce({ id: 'o-1', status: OrderStatus.completed });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    };

    it.each([OrderStatus.served, OrderStatus.delivered])(
      'completes an order in %s',
      async (from) => {
        arrange(from);

        const result = await service.complete('o-1', 'u-1');

        expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
          where: { id: 'o-1', status: from },
          data: { status: OrderStatus.completed, updated_by: 'u-1' },
        });
        expect(result).toEqual({ id: 'o-1', status: OrderStatus.completed });
      },
    );

    it('audits order.completed in the same transaction as the status write', async () => {
      arrange(OrderStatus.delivered);

      await service.complete('o-1', 'u-1');

      expect(audit.record).toHaveBeenCalledWith(mockPrisma, {
        entity_type: 'order',
        entity_id: 'o-1',
        action: 'order.completed',
        actor_type: 'user',
        actor_id: 'u-1',
        before: { status: OrderStatus.delivered },
        after: { status: OrderStatus.completed },
      });
    });

    it('audits a system actor when no user is threaded through', async () => {
      arrange(OrderStatus.served);

      await service.complete('o-1', null);

      expect(audit.record).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          action: 'order.completed',
          actor_type: 'system',
          actor_id: null,
        }),
      );
    });

    /**
     * `ready → served → completed` never touches `delivered`, so the close-out is
     * the only chance a counter order linked to a customer gets to earn.
     */
    it('credits a served order that never passed through delivered', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({ id: 'o-1', status: OrderStatus.served })
        .mockResolvedValueOnce(deliveredOrder)
        .mockResolvedValueOnce({ id: 'o-1', status: OrderStatus.completed });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      loyalty.earnForOrder.mockResolvedValue({ id: 'lt-1', delta: 9 });

      await service.complete('o-1', 'u-1');

      expect(loyalty.earnForOrder).toHaveBeenCalledWith(
        'o-1',
        'cust-1',
        90_000,
      );
    });

    it('credits nothing when the order already earned on delivery', async () => {
      arrange(OrderStatus.delivered);

      await service.complete('o-1', 'u-1');

      expect(loyalty.earnForOrder).not.toHaveBeenCalled();
    });

    it('is idempotent — completing a completed order writes nothing', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: OrderStatus.completed,
      });

      const result = await service.complete('o-1', 'u-1');

      expect(result).toEqual({ id: 'o-1', status: OrderStatus.completed });
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it.each([
      OrderStatus.placed,
      OrderStatus.preparing,
      OrderStatus.ready,
      OrderStatus.shipped,
      OrderStatus.cancelled,
    ])('refuses to complete an order in %s', async (from) => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: from,
      });

      await expect(service.complete('o-1', 'u-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('404s on an unknown order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.complete('nope', 'u-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('409s when another request closed the order first', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: OrderStatus.delivered,
      });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.complete('o-1', 'u-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  /**
   * The close-out guard and `OrdersService`'s transition map encode the same
   * fact in two files (they must not import each other — `OrdersService` injects
   * this service). This pins them together.
   */
  describe('COMPLETABLE_STATUSES', () => {
    it('matches every status the transition map lets reach completed', () => {
      const fromMap = (Object.keys(STATUS_TRANSITIONS) as OrderStatus[]).filter(
        (from) => STATUS_TRANSITIONS[from]?.includes(OrderStatus.completed),
      );

      expect([...COMPLETABLE_STATUSES].sort()).toEqual(fromMap.sort());
    });
  });
});
