import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';

// Mock convertUnit — return same value (unit conversion tested separately)
jest.mock('../common/utils/unit-conversion', () => ({
  convertUnit: jest.fn().mockResolvedValue(null),
}));

import { convertUnit } from '../common/utils/unit-conversion';
const mockConvertUnit = convertUnit as jest.MockedFunction<typeof convertUnit>;

/** Mock Prisma Decimal -- supports Number() via valueOf() */
const dec = (n: number) => ({ valueOf: () => n, toNumber: () => n });

const createMockTx = () => ({
  channelModifier: {
    findFirst: jest.fn(),
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
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: RazorpayService, useValue: { createOrder: jest.fn(), verifyPaymentSignature: jest.fn(), fetchPayment: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
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
        { menu_item_id: 'mi-1', quantity: 2, unit_price: 150 },
        { menu_item_id: 'mi-2', quantity: 1, unit_price: 200 },
      ],
      table_number: 'T5',
    };

    it('creates order with channel modifier (fixed)', async () => {
      const mockTx = createMockTx();
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      mockTx.channelModifier.findFirst.mockResolvedValue({
        id: 'cm-1',
        channel_type: 'dine_in',
        modifier_type: 'fixed',
        modifier_value: dec(50),
        status: 'active',
      });

      const expectedOrder = {
        id: 'order-1',
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
        where: { channel_type: 'dine_in', status: 'active' },
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
      expect(result).toBe(expectedOrder);
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
        channel_type: 'delivery',
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
      expect(call.where.created_at.gte).toBeDefined();
      expect(call.where.created_at.lte).toBeDefined();
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
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: 'placed',
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'o-1',
        status: 'preparing',
      });

      const result = await service.updateOrderStatus('o-1', 'preparing');
      expect(result!.status).toBe('preparing');
    });

    it('throws on invalid transition placed -> ready', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: 'placed',
      });

      await expect(
        service.updateOrderStatus('o-1', 'ready'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows cancellation from non-terminal status', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: 'preparing',
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'o-1',
        status: 'cancelled',
      });

      const result = await service.updateOrderStatus('o-1', 'cancelled');
      expect(result!.status).toBe('cancelled');
    });

    it('does not allow cancellation from terminal status', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: 'served',
      });

      await expect(
        service.updateOrderStatus('o-1', 'cancelled'),
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
        delivery_status: null,
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
        delivery_status: null,
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
        delivery_status: null,
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
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'o-1',
          total: dec(500),
          status: 'served',
          payment: { status: 'paid' },
        },
        {
          id: 'o-2',
          total: dec(300),
          status: 'placed',
          payment: { status: 'paid' },
        },
        {
          id: 'o-3',
          total: dec(200),
          status: 'ready',
          payment: null,
        },
      ]);

      const result = await service.getDailySummary('2026-03-20');

      expect(result.total_orders).toBe(3);
      expect(result.total_revenue).toBe(800); // o-1 + o-2 paid
      expect(result.average_order_value).toBeCloseTo(800 / 3);

      // Verify date range was computed
      const call = mockPrisma.order.findMany.mock.calls[0][0];
      expect(call.where.created_at).toBeDefined();
      expect(call.where.status).toEqual({ not: 'cancelled' });
    });
  });

  // ---------------------------------------------------------------
  // deductItemIngredients
  // ---------------------------------------------------------------
  describe('deductItemIngredients', () => {
    const orderItem = {
      id: 'oi-1',
      order_id: 'order-1',
      menu_item_id: 'mi-1',
      quantity: 1,
    };

    const makeDeductionTx = () => ({
      menuItem: { findUniqueOrThrow: jest.fn() },
      order: { findUniqueOrThrow: jest.fn() },
      ingredientStock: { findFirst: jest.fn(), update: jest.fn() },
      stockMovement: { create: jest.fn() },
      prepBatch: { findMany: jest.fn(), update: jest.fn() },
    });

    beforeEach(() => {
      // Default: convertUnit returns same value (identity)
      mockConvertUnit.mockResolvedValue(null);
    });

    it('deducts ingredient-type RecipeLine from IngredientStock', async () => {
      const tx = makeDeductionTx();
      mockConvertUnit.mockResolvedValue(100); // 100g

      tx.menuItem.findUniqueOrThrow.mockResolvedValue({
        id: 'mi-1',
        recipe: {
          id: 'recipe-1',
          RecipeLines: [
            {
              input_type: 'ingredient',
              ingredient_id: 'ing-1',
              ingredient: { id: 'ing-1', name: 'Flour', base_unit: 'g' },
              source_recipe_id: null,
              source_recipe: null,
              quantity: dec(100),
              unit: 'g',
            },
          ],
        },
      });
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        zone_id: 'zone-1',
      });
      tx.ingredientStock.findFirst.mockResolvedValue({
        id: 'stock-1',
        current_quantity: dec(500),
      });

      await service.deductItemIngredients(tx, orderItem, 'user-1');

      expect(tx.ingredientStock.update).toHaveBeenCalledWith({
        where: { id: 'stock-1' },
        data: { current_quantity: { decrement: 100 } },
      });
    });

    it('deducts recipe-type RecipeLine from PrepBatches via FIFO', async () => {
      const tx = makeDeductionTx();
      mockConvertUnit.mockResolvedValue(2); // 2 yield units

      tx.menuItem.findUniqueOrThrow.mockResolvedValue({
        id: 'mi-1',
        recipe: {
          id: 'recipe-1',
          RecipeLines: [
            {
              input_type: 'recipe',
              ingredient_id: null,
              ingredient: null,
              source_recipe_id: 'sr-1',
              source_recipe: {
                id: 'sr-1',
                name: 'Dough',
                yield_unit: 'portion',
              },
              quantity: dec(2),
              unit: 'portion',
            },
          ],
        },
      });
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        zone_id: 'zone-1',
      });
      // FIFO: oldest batch (batch-1) has 1 portion, second (batch-2) has 3 portions
      tx.prepBatch.findMany.mockResolvedValue([
        { id: 'batch-1', quantity_remaining: dec(1), created_at: new Date('2026-03-20') },
        { id: 'batch-2', quantity_remaining: dec(3), created_at: new Date('2026-03-21') },
      ]);

      await service.deductItemIngredients(tx, orderItem, 'user-1');

      // Should deduct 1 from batch-1 (depleting it) and 1 from batch-2
      expect(tx.prepBatch.update).toHaveBeenCalledTimes(2);
      expect(tx.prepBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { quantity_remaining: { decrement: 1 }, status: 'depleted' },
      });
      expect(tx.prepBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-2' },
        data: { quantity_remaining: { decrement: 1 } },
      });
    });

    it('marks PrepBatch as depleted when quantity_remaining reaches 0', async () => {
      const tx = makeDeductionTx();
      mockConvertUnit.mockResolvedValue(5); // need exactly 5

      tx.menuItem.findUniqueOrThrow.mockResolvedValue({
        id: 'mi-1',
        recipe: {
          id: 'recipe-1',
          RecipeLines: [
            {
              input_type: 'recipe',
              ingredient_id: null,
              ingredient: null,
              source_recipe_id: 'sr-1',
              source_recipe: {
                id: 'sr-1',
                name: 'Sauce',
                yield_unit: 'ml',
              },
              quantity: dec(5),
              unit: 'ml',
            },
          ],
        },
      });
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        zone_id: 'zone-1',
      });
      tx.prepBatch.findMany.mockResolvedValue([
        { id: 'batch-1', quantity_remaining: dec(5), created_at: new Date('2026-03-20') },
      ]);

      await service.deductItemIngredients(tx, orderItem, 'user-1');

      expect(tx.prepBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { quantity_remaining: { decrement: 5 }, status: 'depleted' },
      });
    });

    it('creates StockMovement with type order_deducted for ingredient deductions', async () => {
      const tx = makeDeductionTx();
      mockConvertUnit.mockResolvedValue(200);

      tx.menuItem.findUniqueOrThrow.mockResolvedValue({
        id: 'mi-1',
        recipe: {
          id: 'recipe-1',
          RecipeLines: [
            {
              input_type: 'ingredient',
              ingredient_id: 'ing-1',
              ingredient: { id: 'ing-1', name: 'Sugar', base_unit: 'g' },
              source_recipe_id: null,
              source_recipe: null,
              quantity: dec(200),
              unit: 'g',
            },
          ],
        },
      });
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        zone_id: 'zone-1',
      });
      tx.ingredientStock.findFirst.mockResolvedValue({
        id: 'stock-1',
        current_quantity: dec(1000),
      });

      await service.deductItemIngredients(tx, orderItem, 'user-1');

      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ingredient_id: 'ing-1',
          zone_id: 'zone-1',
          movement_type: 'order_deducted',
          quantity: -200,
          original_quantity: 200,
          unit: 'g',
          reference_type: 'order',
          reference_id: 'order-1',
          created_by: 'user-1',
        }),
      });
    });

    it('throws BadRequestException when IngredientStock insufficient', async () => {
      const tx = makeDeductionTx();
      mockConvertUnit.mockResolvedValue(500);

      tx.menuItem.findUniqueOrThrow.mockResolvedValue({
        id: 'mi-1',
        recipe: {
          id: 'recipe-1',
          RecipeLines: [
            {
              input_type: 'ingredient',
              ingredient_id: 'ing-1',
              ingredient: { id: 'ing-1', name: 'Butter', base_unit: 'g' },
              source_recipe_id: null,
              source_recipe: null,
              quantity: dec(500),
              unit: 'g',
            },
          ],
        },
      });
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        zone_id: 'zone-1',
      });
      // Only 100g available, need 500g
      tx.ingredientStock.findFirst.mockResolvedValue({
        id: 'stock-1',
        current_quantity: dec(100),
      });

      await expect(
        service.deductItemIngredients(tx, orderItem, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when PrepBatch stock insufficient', async () => {
      const tx = makeDeductionTx();
      mockConvertUnit.mockResolvedValue(10); // need 10 portions

      tx.menuItem.findUniqueOrThrow.mockResolvedValue({
        id: 'mi-1',
        recipe: {
          id: 'recipe-1',
          RecipeLines: [
            {
              input_type: 'recipe',
              ingredient_id: null,
              ingredient: null,
              source_recipe_id: 'sr-1',
              source_recipe: {
                id: 'sr-1',
                name: 'Base',
                yield_unit: 'portion',
              },
              quantity: dec(10),
              unit: 'portion',
            },
          ],
        },
      });
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        zone_id: 'zone-1',
      });
      // Only 3 portions available total
      tx.prepBatch.findMany.mockResolvedValue([
        { id: 'batch-1', quantity_remaining: dec(3), created_at: new Date('2026-03-20') },
      ]);

      await expect(
        service.deductItemIngredients(tx, orderItem, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deducts 3x the per-serving amount when quantity=3', async () => {
      const tx = makeDeductionTx();
      mockConvertUnit.mockResolvedValue(50); // 50g per serving

      tx.menuItem.findUniqueOrThrow.mockResolvedValue({
        id: 'mi-1',
        recipe: {
          id: 'recipe-1',
          RecipeLines: [
            {
              input_type: 'ingredient',
              ingredient_id: 'ing-1',
              ingredient: { id: 'ing-1', name: 'Rice', base_unit: 'g' },
              source_recipe_id: null,
              source_recipe: null,
              quantity: dec(50),
              unit: 'g',
            },
          ],
        },
      });
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        zone_id: 'zone-1',
      });
      tx.ingredientStock.findFirst.mockResolvedValue({
        id: 'stock-1',
        current_quantity: dec(1000),
      });

      // quantity=3 means 3 servings
      await service.deductItemIngredients(
        tx,
        { ...orderItem, quantity: 3 },
        'user-1',
      );

      // Should have 3 update calls (one per serving) each decrementing 50g
      expect(tx.ingredientStock.update).toHaveBeenCalledTimes(3);
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(3);
    });
  });
});
