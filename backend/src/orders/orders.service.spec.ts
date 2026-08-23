import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { PusherService } from '../chat/pusher.service';
import { FulfilmentService } from '../fulfilment/fulfilment.service';
import {
  mockAuditService,
  mockEventEmitter,
  provideAuditService,
} from '../test-utils/mock-providers';
import { DomainEvent } from '../common/events/domain-events';
import { OrderLifecycleService } from './order-lifecycle.service';

const emitter = mockEventEmitter();

/** The delivery hook is exercised in `order-lifecycle.service.spec.ts`. */
const lifecycle = {
  onDelivered: jest.fn().mockResolvedValue(0),
  complete: jest.fn(),
};

/** Mock Prisma Decimal -- supports Number() via valueOf() */
const dec = (n: number) => ({ valueOf: () => n, toNumber: () => n });

/**
 * Day boundaries come from Node.timezone, never from the process TZ. The default
 * implementation survives `jest.clearAllMocks()`; a test that needs another zone
 * overrides it with `mockResolvedValueOnce`.
 */
const mockNode = {
  timezone: jest.fn(async () => 'Asia/Kolkata'),
};

const mockFulfilment = {
  applyPrepTypeOnCreate: jest.fn().mockResolvedValue(undefined),
};

const audit = mockAuditService();

const createMockTx = () => ({
  channelModifier: {
    findFirst: jest.fn(),
  },
  product: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'mi-1', base_price: dec(150) },
      { id: 'mi-2', base_price: dec(200) },
    ]),
  },
  order: {
    create: jest.fn(),
  },
  auditEvent: {
    create: jest.fn(),
  },
});

const mockPrisma = {
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  payment: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  auditEvent: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NodeService, useValue: mockNode },
        { provide: EventEmitter2, useValue: emitter },
        {
          provide: RazorpayService,
          useValue: {
            createOrder: jest.fn(),
            verifyPaymentSignature: jest.fn(),
            fetchPayment: jest.fn(),
          },
        },
        {
          provide: PusherService,
          useValue: { trigger: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: FulfilmentService, useValue: mockFulfilment },
        provideAuditService(audit),
        { provide: OrderLifecycleService, useValue: lifecycle },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
    emitter.emit.mockReturnValue(true);
    mockFulfilment.applyPrepTypeOnCreate.mockResolvedValue(undefined);
    lifecycle.onDelivered.mockResolvedValue(0);
    // updateOrderStatus now runs its optimistic guard + audit row in one transaction.
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
  });

  // ---------------------------------------------------------------
  // createOrder
  // ---------------------------------------------------------------
  describe('createOrder', () => {
    const userId = 'user-1';
    const baseDto = {
      channel: 'dine_in' as const,
      zone_id: 'zone-1',
      items: [
        { product_id: 'mi-1', quantity: 2, unit_price: 150 },
        { product_id: 'mi-2', quantity: 1, unit_price: 200 },
      ],
      table_number: 'T5',
    };

    it('creates order with channel modifier (fixed)', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.channelModifier.findFirst.mockResolvedValue({
        id: 'cm-1',
        channel: 'dine_in',
        modifier_type: 'fixed',
        modifier_value: dec(50),
        status: 'active',
      });

      const expectedOrder = {
        id: 'order-1',
        zone_id: 'zone-1',
        channel: 'dine_in',
        status: 'placed',
        subtotal: dec(500),
        channel_modifier_amount: dec(50),
        total: dec(550),
        items: [],
        payment: null,
      };
      mockTx.order.create.mockResolvedValue(expectedOrder);

      const result = await service.createOrder(baseDto, userId);

      expect(mockTx.channelModifier.findFirst).toHaveBeenCalledWith({
        where: { channel: 'dine_in', status: 'active' },
      });

      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'dine_in',
            status: 'placed',
            subtotal: 500,
            channel_modifier_amount: 50,
            total: 550,
            zone_id: 'zone-1',
            created_by: 'user-1',
          }),
          include: { items: true, payment: true },
        }),
      );
      expect(mockFulfilment.applyPrepTypeOnCreate).toHaveBeenCalledWith(
        mockTx,
        { id: 'order-1', zone_id: 'zone-1' },
        [],
        { actor_type: 'user', actor_id: 'user-1' },
      );
      expect(result).toBe(expectedOrder);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 },
      );
      expect(audit.record).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          entity_type: 'order',
          entity_id: 'order-1',
          action: 'order.created',
          actor_type: 'user',
          actor_id: 'user-1',
          after: expect.objectContaining({
            status: 'placed',
            channel: 'dine_in',
            item_count: 0,
          }),
        }),
      );
    });

    it('sets channel_modifier_amount=0 when no modifier exists', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.channelModifier.findFirst.mockResolvedValue(null);

      const expectedOrder = {
        id: 'order-2',
        subtotal: dec(500),
        channel_modifier_amount: dec(0),
        total: dec(500),
      };
      mockTx.order.create.mockResolvedValue(expectedOrder);

      await service.createOrder(baseDto, userId);

      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 500,
            channel_modifier_amount: 0,
            total: 500,
          }),
        }),
      );
    });

    it('stores delivery_address and customer_phone for delivery channel', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
      mockTx.channelModifier.findFirst.mockResolvedValue(null);

      const deliveryDto = {
        ...baseDto,
        channel: 'delivery' as const,
        delivery_address: '42 Main St',
        customer_phone: '+911234567890',
      };

      const expectedOrder = { id: 'order-3' };
      mockTx.order.create.mockResolvedValue(expectedOrder);

      await service.createOrder(deliveryDto, userId);

      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'delivery',
            delivery_address: '42 Main St',
            customer_phone: '+911234567890',
          }),
        }),
      );
    });

    it('applies percentage modifier correctly', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.channelModifier.findFirst.mockResolvedValue({
        id: 'cm-2',
        channel: 'delivery',
        modifier_type: 'percentage',
        modifier_value: dec(10),
        status: 'active',
      });

      const expectedOrder = { id: 'order-4' };
      mockTx.order.create.mockResolvedValue(expectedOrder);

      // subtotal = 2*150 + 1*200 = 500; 10% of 500 = 50
      await service.createOrder(baseDto, userId);

      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 500,
            channel_modifier_amount: 50,
            total: 550,
          }),
        }),
      );
    });

    it('retries the transaction on serialization failure (P2034)', async () => {
      const mockTx = createMockTx();
      mockTx.channelModifier.findFirst.mockResolvedValue(null);
      mockTx.order.create.mockResolvedValue({
        id: 'order-3',
        zone_id: 'zone-1',
        items: [],
        total: dec(500),
      });
      mockPrisma.$transaction
        .mockRejectedValueOnce(
          Object.assign(new Error('serialize'), { code: 'P2034' }),
        )
        .mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.createOrder(baseDto, userId);

      expect(result.id).toBe('order-3');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------
  // getOrders
  // ---------------------------------------------------------------
  describe('getOrders', () => {
    it('filters by channel', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.getOrders({ channel: 'dine_in' });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ channel: 'dine_in' }),
        }),
      );
    });

    it('filters by date_from and date_to', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.getOrders({
        date_from: '2026-03-20',
        date_to: '2026-03-21',
      });

      const call = mockPrisma.order.findMany.mock.calls[0][0];
      expect(call.where.created_at).toBeDefined();
      // Node-local (IST) day boundaries: 18:30 UTC the day before each date.
      expect(call.where.created_at.gte.toISOString()).toBe(
        '2026-03-19T18:30:00.000Z',
      );
      expect(call.where.created_at.lt.toISOString()).toBe(
        '2026-03-21T18:30:00.000Z',
      );
    });

    it('takes the day boundaries from Node.timezone, not the process TZ', async () => {
      mockNode.timezone.mockResolvedValueOnce('Europe/London');
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.getOrders({
        date_from: '2026-08-23',
        date_to: '2026-08-23',
      });

      const call = mockPrisma.order.findMany.mock.calls[0][0];
      expect(call.where.created_at.gte.toISOString()).toBe(
        '2026-08-22T23:00:00.000Z',
      );
      expect(call.where.created_at.lt.toISOString()).toBe(
        '2026-08-23T23:00:00.000Z',
      );
    });

    it('filters by payment_method', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.getOrders({ payment_method: 'upi' });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            payment: { method: 'upi' },
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------
  // updateOrderStatus
  // ---------------------------------------------------------------
  describe('updateOrderStatus', () => {
    it('allows placed -> preparing', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({
          id: 'o-1',
          status: 'placed',
          customer_id: null,
        })
        .mockResolvedValueOnce({ id: 'o-1', status: 'preparing' });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateOrderStatus('o-1', 'preparing', 'u-1');

      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'o-1', status: 'placed' },
        data: { status: 'preparing', updated_by: 'u-1' },
      });
      expect(result!.status).toBe('preparing');
    });

    it('throws 409 when the status changed concurrently', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: 'placed',
        customer_id: null,
      });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateOrderStatus('o-1', 'preparing', 'u-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws on invalid transition placed -> ready', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: 'placed',
      });

      await expect(
        service.updateOrderStatus('o-1', 'ready', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    // ---------------------------------------------------------------
    // P5a lifecycle: the three lanes out of `ready` and the close-out
    // ---------------------------------------------------------------
    describe('shipment and completion lifecycle', () => {
      const arrange = (from: string, to: string) => {
        mockPrisma.order.findUnique
          .mockResolvedValueOnce({
            id: 'o-1',
            status: from,
            customer_id: null,
            order_number: 42,
          })
          .mockResolvedValueOnce({
            id: 'o-1',
            node_id: 'node-1',
            order_number: 42,
            channel: 'delivery',
            total: '550',
            status: to,
          });
        mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      };

      it.each([
        ['ready', 'shipped'],
        ['ready', 'dispatched'],
        ['ready', 'served'],
        ['dispatched', 'delivered'],
        ['shipped', 'delivered'],
        ['served', 'completed'],
        ['delivered', 'completed'],
      ])('allows %s -> %s', async (from, to) => {
        arrange(from, to);

        const result = await service.updateOrderStatus('o-1', to as any, 'u-1');

        expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
          where: { id: 'o-1', status: from },
          data: { status: to, updated_by: 'u-1' },
        });
        expect(result!.status).toBe(to);
      });

      it.each([
        // `delivered` is reached from a *dispatch*, never straight off the pass.
        ['ready', 'delivered'],
        // `completed` is terminal in both senses: nothing leaves it.
        ['completed', 'served'],
        ['completed', 'delivered'],
        ['completed', 'refunded'],
        // The courier lane and the rider lane do not cross.
        ['shipped', 'dispatched'],
      ])('rejects %s -> %s', async (from, to) => {
        mockPrisma.order.findUnique.mockResolvedValue({
          id: 'o-1',
          status: from,
          customer_id: null,
        });

        await expect(
          service.updateOrderStatus('o-1', to as any, 'u-1'),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
      });

      it('credits loyalty once the order reaches delivered', async () => {
        arrange('shipped', 'delivered');

        await service.updateOrderStatus('o-1', 'delivered', 'u-1');

        expect(lifecycle.onDelivered).toHaveBeenCalledTimes(1);
        expect(lifecycle.onDelivered).toHaveBeenCalledWith('o-1', {
          actor_type: 'user',
          actor_id: 'u-1',
        });
      });

      it('credits loyalty before re-reading the order, so the caller sees the points', async () => {
        arrange('shipped', 'delivered');
        let creditedFirst = false;
        lifecycle.onDelivered.mockImplementation(async () => {
          creditedFirst = mockPrisma.order.findUnique.mock.calls.length === 1;
          return 20;
        });

        await service.updateOrderStatus('o-1', 'delivered', 'u-1');

        expect(creditedFirst).toBe(true);
      });

      it('does not credit loyalty on any other transition', async () => {
        arrange('ready', 'shipped');

        await service.updateOrderStatus('o-1', 'shipped', 'u-1');

        expect(lifecycle.onDelivered).not.toHaveBeenCalled();
      });

      it('allows cancellation from delivered — only completed closes the order', async () => {
        mockPrisma.order.findUnique
          .mockResolvedValueOnce({
            id: 'o-1',
            status: 'delivered',
            customer_id: null,
          })
          .mockResolvedValueOnce({ id: 'o-1', status: 'cancelled' });
        mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.updateOrderStatus(
          'o-1',
          'cancelled',
          'u-1',
        );

        expect(result!.status).toBe('cancelled');
      });

      it('refuses to cancel a completed order', async () => {
        mockPrisma.order.findUnique.mockResolvedValue({
          id: 'o-1',
          status: 'completed',
        });

        await expect(
          service.updateOrderStatus('o-1', 'cancelled', 'u-1'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    it('allows cancellation from non-terminal status', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({
          id: 'o-1',
          status: 'preparing',
          customer_id: null,
        })
        .mockResolvedValueOnce({ id: 'o-1', status: 'cancelled' });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateOrderStatus('o-1', 'cancelled', 'u-1');
      expect(result!.status).toBe('cancelled');
    });

    it('does not allow cancellation from terminal status', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: 'served',
      });

      await expect(
        service.updateOrderStatus('o-1', 'cancelled', 'u-1'),
      ).rejects.toThrow(BadRequestException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('records an order.status_changed AuditEvent inside the same transaction', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({
          id: 'o-1',
          status: 'placed',
          customer_id: null,
        })
        .mockResolvedValueOnce({ id: 'o-1', status: 'preparing' });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });

      await service.updateOrderStatus('o-1', 'preparing', 'u-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(mockPrisma, {
        entity_type: 'order',
        entity_id: 'o-1',
        action: 'order.status_changed',
        actor_type: 'user',
        actor_id: 'u-1',
        before: { status: 'placed' },
        after: { status: 'preparing' },
      });
    });

    it('audits a system actor when no user is threaded through', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({
          id: 'o-1',
          status: 'placed',
          customer_id: null,
        })
        .mockResolvedValueOnce({ id: 'o-1', status: 'preparing' });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });

      await service.updateOrderStatus('o-1', 'preparing', null);

      expect(audit.record).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({ actor_type: 'system', actor_id: null }),
      );
    });

    it('does not audit when the optimistic guard loses the race', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: 'placed',
        customer_id: null,
      });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateOrderStatus('o-1', 'preparing', 'u-1'),
      ).rejects.toThrow(ConflictException);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // recordPayment
  // ---------------------------------------------------------------
  describe('recordPayment', () => {
    it('creates payment record with status=paid', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      const expectedPayment = {
        id: 'pay-1',
        order_id: 'o-1',
        method: 'cash',
        amount: dec(550),
        status: 'paid',
        notes: null,
      };
      mockPrisma.payment.create.mockResolvedValue(expectedPayment);

      const result = await service.recordPayment('o-1', {
        method: 'cash',
        amount: 550,
      });

      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: {
          order_id: 'o-1',
          method: 'cash',
          amount: 550,
          status: 'paid',
          notes: undefined,
        },
      });
      expect(result).toBe(expectedPayment);
    });

    it('throws 409 when payment already exists', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-existing',
        order_id: 'o-1',
      });

      await expect(
        service.recordPayment('o-1', { method: 'card', amount: 550 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------
  // updateDelivery
  // ---------------------------------------------------------------
  describe('updateDelivery', () => {
    it('sets delivery_assigned_to and delivery_status', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        channel: 'delivery',
        delivery_status: null,
        customer_id: null,
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'o-1',
        delivery_assigned_to: 'driver-1',
        delivery_status: 'picked_up',
      });

      const result = await service.updateDelivery('o-1', {
        delivery_assigned_to: 'driver-1',
        delivery_status: 'picked_up',
      });

      expect(result.delivery_assigned_to).toBe('driver-1');
      expect(result.delivery_status).toBe('picked_up');
    });

    it('validates delivery_status progression (null -> picked_up ok)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        channel: 'delivery',
        delivery_status: null,
        customer_id: null,
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'o-1',
        delivery_status: 'picked_up',
      });

      // Should not throw
      await service.updateDelivery('o-1', { delivery_status: 'picked_up' });
    });

    it('rejects invalid delivery_status progression (null -> delivered)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        channel: 'delivery',
        delivery_status: null,
        customer_id: null,
      });

      await expect(
        service.updateDelivery('o-1', { delivery_status: 'delivered' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('credits loyalty when the rider marks the drop delivered', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        channel: 'delivery',
        delivery_status: 'in_transit',
        created_by: 'user-9',
        customer_id: 'cust-1',
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'o-1',
        node_id: 'node-1',
        delivery_status: 'delivered',
      });

      await service.updateDelivery('o-1', { delivery_status: 'delivered' });

      expect(lifecycle.onDelivered).toHaveBeenCalledWith('o-1', {
        actor_type: 'user',
        actor_id: 'user-9',
      });
    });

    it('does not credit loyalty on an earlier delivery leg', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        channel: 'delivery',
        delivery_status: 'picked_up',
        created_by: 'user-9',
        customer_id: null,
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'o-1',
        node_id: 'node-1',
        delivery_status: 'in_transit',
      });

      await service.updateDelivery('o-1', { delivery_status: 'in_transit' });

      expect(lifecycle.onDelivered).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // completeOrder
  // ---------------------------------------------------------------
  describe('completeOrder', () => {
    it('hands the close-out to the lifecycle service', async () => {
      lifecycle.complete.mockResolvedValue({ id: 'o-1', status: 'completed' });

      const result = await service.completeOrder('o-1', 'u-1');

      expect(lifecycle.complete).toHaveBeenCalledWith('o-1', 'u-1');
      expect(result).toEqual({ id: 'o-1', status: 'completed' });
    });
  });

  // ---------------------------------------------------------------
  // getDailySummary
  // ---------------------------------------------------------------
  describe('getDailySummary', () => {
    it('returns totalOrders, totalRevenue, averageOrderValue for a date', async () => {
      // 3 non-cancelled orders that day; 2 of them paid for a total of 800
      mockPrisma.order.count.mockResolvedValue(3);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { total: dec(800) },
        _count: { id: 2 },
      });

      const result = await service.getDailySummary('2026-03-20');

      expect(result.total_orders).toBe(3);
      expect(result.total_revenue).toBe(800);
      expect(result.average_order_value).toBeCloseTo(400);

      // Verify date range was computed against non-cancelled orders
      const countCall = mockPrisma.order.count.mock.calls[0][0];
      expect(countCall.where.created_at).toBeDefined();
      expect(countCall.where.status).toEqual({ not: 'cancelled' });

      // Revenue only counts paid orders
      const aggCall = mockPrisma.order.aggregate.mock.calls[0][0];
      expect(aggCall.where.payment).toEqual({ status: 'paid' });
    });

    it('bounds the day by Node.timezone — 18:30 UTC either side for IST', async () => {
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { total: null },
        _count: { id: 0 },
      });

      await service.getDailySummary('2026-08-23');

      const { created_at } = mockPrisma.order.count.mock.calls[0][0].where;
      expect(created_at.gte.toISOString()).toBe('2026-08-22T18:30:00.000Z');
      expect(created_at.lt.toISOString()).toBe('2026-08-23T18:30:00.000Z');
    });

    it('follows the node to another zone instead of the process TZ', async () => {
      mockNode.timezone.mockResolvedValueOnce('Europe/London');
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { total: null },
        _count: { id: 0 },
      });

      await service.getDailySummary('2026-08-23');

      const { created_at } = mockPrisma.order.count.mock.calls[0][0].where;
      expect(created_at.gte.toISOString()).toBe('2026-08-22T23:00:00.000Z');
      expect(created_at.lt.toISOString()).toBe('2026-08-23T23:00:00.000Z');
    });
  });

  // ---------------------------------------------------------------
  // Domain events (SPEC §4.1) — every one fires after the write commits
  // ---------------------------------------------------------------
  describe('domain events', () => {
    describe('order.placed', () => {
      const dto = {
        channel: 'dine_in' as const,
        zone_id: 'zone-1',
        items: [{ product_id: 'mi-1', quantity: 2, unit_price: 150 }],
      };
      const created = {
        id: 'order-1',
        node_id: 'node-1',
        zone_id: 'zone-1',
        channel: 'dine_in',
        status: 'placed',
        total: '300',
        items: [{ id: 'oi-1' }],
        payment: null,
      };

      it('emits once, after the transaction resolves, with the typed payload', async () => {
        const mockTx = createMockTx();
        let txResolved = false;
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
          const out = await cb(mockTx);
          txResolved = true;
          return out;
        });
        mockTx.channelModifier.findFirst.mockResolvedValue(null);
        mockTx.order.create.mockResolvedValue(created);
        emitter.emit.mockImplementation(() => {
          expect(txResolved).toBe(true);
          return true;
        });

        await service.createOrder(dto, 'user-1');

        expect(emitter.emit).toHaveBeenCalledTimes(1);
        expect(emitter.emit).toHaveBeenCalledWith(
          DomainEvent.ORDER_PLACED,
          expect.objectContaining({
            node_id: 'node-1',
            actor: { actor_type: 'user', actor_id: 'user-1' },
            occurred_at: expect.any(String),
            orderId: 'order-1',
            channel: 'dine_in',
            itemCount: 1,
            total: '300',
            createdBy: 'user-1',
          }),
        );
      });

      it('still resolves when the emitter throws', async () => {
        const mockTx = createMockTx();
        mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
        mockTx.channelModifier.findFirst.mockResolvedValue(null);
        mockTx.order.create.mockResolvedValue(created);
        emitter.emit.mockImplementation(() => {
          throw new Error('listener exploded');
        });

        await expect(service.createOrder(dto, 'user-1')).resolves.toBe(created);
      });
    });

    describe('order.served / order.delivered', () => {
      const arrangeStatus = (from: string, to: string) => {
        mockPrisma.order.findUnique
          .mockResolvedValueOnce({
            id: 'o-1',
            status: from,
            customer_id: null,
            order_number: 42,
          })
          .mockResolvedValueOnce({
            id: 'o-1',
            node_id: 'node-1',
            order_number: 42,
            channel: 'dine_in',
            total: '550',
            status: to,
          });
        mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      };

      it('emits order.served on ready -> served', async () => {
        arrangeStatus('ready', 'served');

        await service.updateOrderStatus('o-1', 'served', 'u-1');

        expect(emitter.emit).toHaveBeenCalledTimes(1);
        expect(emitter.emit).toHaveBeenCalledWith(
          DomainEvent.ORDER_SERVED,
          expect.objectContaining({
            node_id: 'node-1',
            actor: { actor_type: 'user', actor_id: 'u-1' },
            occurred_at: expect.any(String),
            orderId: 'o-1',
            orderNumber: 42,
            channel: 'dine_in',
            total: '550',
          }),
        );
      });

      /**
       * Phase 31 typed and wired `order.delivered` while no path into `delivered`
       * existed. P5a opens `dispatched → delivered` and `shipped → delivered`, so
       * the dormant gate now fires — once, with the payload the mission bridge
       * and the review-invitation listener were specified against.
       */
      it.each(['dispatched', 'shipped'])(
        'emits order.delivered on %s -> delivered',
        async (from) => {
          arrangeStatus(from, 'delivered');

          await service.updateOrderStatus('o-1', 'delivered', 'u-1');

          expect(emitter.emit).toHaveBeenCalledTimes(1);
          expect(emitter.emit).toHaveBeenCalledWith(
            DomainEvent.ORDER_DELIVERED,
            expect.objectContaining({
              node_id: 'node-1',
              actor: { actor_type: 'user', actor_id: 'u-1' },
              occurred_at: expect.any(String),
              orderId: 'o-1',
              orderNumber: 42,
              channel: 'dine_in',
              total: '550',
            }),
          );
        },
      );

      /**
       * The lifecycle service credits loyalty but stays silent, so replaying the
       * credit hook can never double-fire the review invitation.
       */
      it('emits order.delivered exactly once even when the credit hook runs', async () => {
        arrangeStatus('shipped', 'delivered');
        lifecycle.onDelivered.mockResolvedValue(20);

        await service.updateOrderStatus('o-1', 'delivered', 'u-1');

        expect(
          emitter.emit.mock.calls.filter(
            (call: unknown[]) => call[0] === DomainEvent.ORDER_DELIVERED,
          ),
        ).toHaveLength(1);
      });

      it('rejects ready -> delivered and emits nothing', async () => {
        mockPrisma.order.findUnique.mockResolvedValue({
          id: 'o-1',
          status: 'ready',
          customer_id: null,
          order_number: 42,
        });

        await expect(
          service.updateOrderStatus('o-1', 'delivered', 'u-1'),
        ).rejects.toThrow(BadRequestException);
        expect(emitter.emit).not.toHaveBeenCalled();
        expect(lifecycle.onDelivered).not.toHaveBeenCalled();
      });

      it('emits nothing for a non-terminal transition', async () => {
        arrangeStatus('placed', 'preparing');

        await service.updateOrderStatus('o-1', 'preparing', 'u-1');

        expect(emitter.emit).not.toHaveBeenCalled();
      });

      it('does not emit when the optimistic guard loses the race', async () => {
        mockPrisma.order.findUnique.mockResolvedValue({
          id: 'o-1',
          status: 'ready',
          customer_id: null,
          order_number: 42,
        });
        mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });

        await expect(
          service.updateOrderStatus('o-1', 'served', 'u-1'),
        ).rejects.toThrow(ConflictException);
        expect(emitter.emit).not.toHaveBeenCalled();
      });

      it('still resolves when the emitter throws', async () => {
        arrangeStatus('ready', 'served');
        emitter.emit.mockImplementation(() => {
          throw new Error('listener exploded');
        });

        await expect(
          service.updateOrderStatus('o-1', 'served', 'u-1'),
        ).resolves.toMatchObject({ id: 'o-1', status: 'served' });
      });
    });

    describe('delivery.updated', () => {
      it('emits once, after the update resolves, with the typed payload', async () => {
        mockPrisma.order.findUnique.mockResolvedValue({
          id: 'o-1',
          channel: 'delivery',
          delivery_status: null,
          delivery_address: '12 Palm Rd',
          created_by: 'user-9',
          customer_id: null,
        });
        let updateResolved = false;
        mockPrisma.order.update.mockImplementation(async () => {
          updateResolved = true;
          return { id: 'o-1', node_id: 'node-1', delivery_status: 'picked_up' };
        });
        emitter.emit.mockImplementation(() => {
          expect(updateResolved).toBe(true);
          return true;
        });

        await service.updateDelivery('o-1', { delivery_status: 'picked_up' });

        expect(emitter.emit).toHaveBeenCalledTimes(1);
        expect(emitter.emit).toHaveBeenCalledWith(
          DomainEvent.DELIVERY_UPDATED,
          expect.objectContaining({
            node_id: 'node-1',
            actor: { actor_type: 'user', actor_id: 'user-9' },
            occurred_at: expect.any(String),
            orderId: 'o-1',
            deliveryStatus: 'picked_up',
            deliveryAddress: '12 Palm Rd',
            createdBy: 'user-9',
          }),
        );
      });
    });
  });
});
