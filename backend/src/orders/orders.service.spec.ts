import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { PusherService } from '../chat/pusher.service';
import { FulfilmentService } from '../fulfilment/fulfilment.service';

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
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
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
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
    mockFulfilment.applyPrepTypeOnCreate.mockResolvedValue(undefined);
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
});
