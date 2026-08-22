/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await --
   jest matchers (expect.objectContaining / expect.any) are typed `any`, and the
   $transaction mock deliberately forwards its callback result without awaiting. */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrderSource, Prisma } from '@prisma/client';
import { FulfilmentService, actorForOrder } from './fulfilment.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../common/utils/unit-conversion', () => ({
  convertUnit: jest.fn().mockResolvedValue(null),
}));
import { convertUnit } from '../common/utils/unit-conversion';
const mockConvertUnit = convertUnit as jest.MockedFunction<typeof convertUnit>;

/** Mock Prisma Decimal -- supports Number() via valueOf() */
const dec = (n: number) => ({ valueOf: () => n, toNumber: () => n });

const makeTx = () => ({
  menuItem: { findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  orderItem: { update: jest.fn() },
  order: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
  ingredientStock: { findFirst: jest.fn(), update: jest.fn() },
  stockMovement: { create: jest.fn() },
  prepBatch: { findMany: jest.fn(), update: jest.fn() },
  systemSetting: { findUnique: jest.fn() },
  zone: { findUnique: jest.fn(), findFirst: jest.fn() },
});
type MockTx = ReturnType<typeof makeTx>;
const asTx = (tx: MockTx) => tx as unknown as Prisma.TransactionClient;

const mockPrisma = {
  $transaction: jest.fn(),
  order: { findFirst: jest.fn() },
  customerAddress: { findFirst: jest.fn() },
};

const userActor = { actor_type: 'user' as const, actor_id: 'user-1' };
const orderItem = {
  id: 'oi-1',
  order_id: 'order-1',
  menu_item_id: 'mi-1',
  quantity: 1,
};

describe('FulfilmentService', () => {
  let service: FulfilmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FulfilmentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(FulfilmentService);
    jest.clearAllMocks();
    mockConvertUnit.mockResolvedValue(null);
  });

  describe('actorForOrder', () => {
    it('maps staff, customer and system orders', () => {
      expect(actorForOrder({ created_by: 'u1', customer_id: null })).toEqual({
        actor_type: 'user',
        actor_id: 'u1',
      });
      expect(actorForOrder({ created_by: null, customer_id: 'c1' })).toEqual({
        actor_type: 'customer',
        actor_id: 'c1',
      });
      expect(actorForOrder({ created_by: null, customer_id: null })).toEqual({
        actor_type: 'system',
        actor_id: null,
      });
    });
  });

  describe('resolveMarketplaceZoneId', () => {
    it('uses the configured zone when it exists', async () => {
      const tx = makeTx();
      tx.systemSetting.findUnique.mockResolvedValue({
        key: 'marketplace_fulfilment_zone_id',
        value: 'zone-cfg',
      });
      tx.zone.findUnique.mockResolvedValue({ id: 'zone-cfg' });
      await expect(service.resolveMarketplaceZoneId(asTx(tx))).resolves.toBe(
        'zone-cfg',
      );
      expect(tx.zone.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to the first kitchen zone', async () => {
      const tx = makeTx();
      tx.systemSetting.findUnique.mockResolvedValue(null);
      tx.zone.findFirst.mockResolvedValue({ id: 'zone-kitchen' });
      await expect(service.resolveMarketplaceZoneId(asTx(tx))).resolves.toBe(
        'zone-kitchen',
      );
      expect(tx.zone.findFirst).toHaveBeenCalledWith({
        where: { zone_type: 'kitchen' },
        orderBy: { name: 'asc' },
        select: { id: true },
      });
    });

    it('throws ServiceUnavailableException when no zone can be resolved', async () => {
      const tx = makeTx();
      tx.systemSetting.findUnique.mockResolvedValue(null);
      tx.zone.findFirst.mockResolvedValue(null);
      await expect(service.resolveMarketplaceZoneId(asTx(tx))).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('applyPrepTypeOnCreate', () => {
    it('leaves scratch items pending and deducts nothing', async () => {
      const tx = makeTx();
      tx.menuItem.findMany.mockResolvedValue([
        { id: 'mi-1', recipe: { id: 'r-1', preparation_type: 'scratch' } },
      ]);
      await service.applyPrepTypeOnCreate(
        asTx(tx),
        { id: 'order-1', zone_id: 'zone-1' },
        [orderItem],
        userActor,
      );
      expect(tx.orderItem.update).not.toHaveBeenCalled();
      expect(tx.prepBatch.findMany).not.toHaveBeenCalled();
    });

    it('batch_prepared: FIFO by expires_at within the zone and sets item ready', async () => {
      const tx = makeTx();
      tx.menuItem.findMany.mockResolvedValue([
        {
          id: 'mi-1',
          recipe: { id: 'r-1', preparation_type: 'batch_prepared' },
        },
      ]);
      tx.prepBatch.findMany.mockResolvedValue([
        { id: 'b-1', quantity_remaining: dec(1) },
        { id: 'b-2', quantity_remaining: dec(5) },
      ]);
      await service.applyPrepTypeOnCreate(
        asTx(tx),
        { id: 'order-1', zone_id: 'zone-1' },
        [{ ...orderItem, quantity: 3 }],
        userActor,
      );
      expect(tx.prepBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recipe_id: 'r-1',
            zone_id: 'zone-1',
            status: 'active',
          }),
          orderBy: [{ expires_at: 'asc' }, { created_at: 'asc' }],
        }),
      );
      expect(tx.prepBatch.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { quantity_remaining: { decrement: 1 }, status: 'depleted' },
      });
      expect(tx.prepBatch.update).toHaveBeenCalledWith({
        where: { id: 'b-2' },
        data: { quantity_remaining: { decrement: 2 }, status: 'active' },
      });
      expect(tx.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'oi-1' },
        data: { status: 'ready', ready_at: expect.any(Date) },
      });
    });

    it('batch_prepared: throws BadRequestException on shortfall', async () => {
      const tx = makeTx();
      tx.menuItem.findMany.mockResolvedValue([
        {
          id: 'mi-1',
          recipe: { id: 'r-1', preparation_type: 'batch_prepared' },
        },
      ]);
      tx.prepBatch.findMany.mockResolvedValue([
        { id: 'b-1', quantity_remaining: dec(1) },
      ]);
      await expect(
        service.applyPrepTypeOnCreate(
          asTx(tx),
          { id: 'order-1', zone_id: 'zone-1' },
          [{ ...orderItem, quantity: 2 }],
          userActor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(tx.orderItem.update).not.toHaveBeenCalled();
    });

    it('ready_to_sell: BOM deduction writes a StockMovement with actor fields', async () => {
      const tx = makeTx();
      mockConvertUnit.mockResolvedValue(100);
      tx.menuItem.findMany.mockResolvedValue([
        {
          id: 'mi-1',
          recipe: { id: 'r-1', preparation_type: 'ready_to_sell' },
        },
      ]);
      tx.menuItem.findUniqueOrThrow.mockResolvedValue({
        recipe: {
          RecipeLines: [
            {
              input_type: 'ingredient',
              ingredient_id: 'ing-1',
              ingredient: { name: 'Flour', base_unit: 'g' },
              source_recipe_id: null,
              source_recipe: null,
              quantity: dec(100),
              unit: 'g',
            },
          ],
        },
      });
      tx.ingredientStock.findFirst.mockResolvedValue({
        id: 'stock-1',
        current_quantity: dec(500),
      });
      await service.applyPrepTypeOnCreate(
        asTx(tx),
        { id: 'order-1', zone_id: 'zone-1' },
        [orderItem],
        { actor_type: 'customer', actor_id: 'cust-1' },
      );
      expect(tx.ingredientStock.findFirst).toHaveBeenCalledWith({
        where: { ingredient_id: 'ing-1', zone_id: 'zone-1' },
      });
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          zone_id: 'zone-1',
          movement_type: 'order_deducted',
          quantity: -100,
          reference_type: 'order',
          reference_id: 'order-1',
          created_by: null,
          actor_type: 'customer',
          actor_id: 'cust-1',
        }),
      });
      expect(tx.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'oi-1' },
        data: { status: 'ready', ready_at: expect.any(Date) },
      });
    });

    it('throws when the order has no zone', async () => {
      const tx = makeTx();
      await expect(
        service.applyPrepTypeOnCreate(
          asTx(tx),
          { id: 'order-1', zone_id: null },
          [orderItem],
          userActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------
  // deductItemIngredients (moved from orders.service.spec.ts)
  // ---------------------------------------------------------------
  describe('deductItemIngredients', () => {
    it('deducts ingredient-type RecipeLine from IngredientStock', async () => {
      const tx = makeTx();
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
      tx.ingredientStock.findFirst.mockResolvedValue({
        id: 'stock-1',
        current_quantity: dec(500),
      });

      await service.deductItemIngredients(
        asTx(tx),
        orderItem,
        userActor,
        'zone-1',
      );

      expect(tx.ingredientStock.update).toHaveBeenCalledWith({
        where: { id: 'stock-1' },
        data: { current_quantity: { decrement: 100 } },
      });
    });

    it('deducts recipe-type RecipeLine from PrepBatches via FIFO', async () => {
      const tx = makeTx();
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
      // FIFO: oldest batch (batch-1) has 1 portion, second (batch-2) has 3 portions
      tx.prepBatch.findMany.mockResolvedValue([
        {
          id: 'batch-1',
          quantity_remaining: dec(1),
          created_at: new Date('2026-03-20'),
        },
        {
          id: 'batch-2',
          quantity_remaining: dec(3),
          created_at: new Date('2026-03-21'),
        },
      ]);

      await service.deductItemIngredients(
        asTx(tx),
        orderItem,
        userActor,
        'zone-1',
      );

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
      const tx = makeTx();
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
      tx.prepBatch.findMany.mockResolvedValue([
        {
          id: 'batch-1',
          quantity_remaining: dec(5),
          created_at: new Date('2026-03-20'),
        },
      ]);

      await service.deductItemIngredients(
        asTx(tx),
        orderItem,
        userActor,
        'zone-1',
      );

      expect(tx.prepBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { quantity_remaining: { decrement: 5 }, status: 'depleted' },
      });
    });

    it('creates StockMovement with type order_deducted for ingredient deductions', async () => {
      const tx = makeTx();
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
      tx.ingredientStock.findFirst.mockResolvedValue({
        id: 'stock-1',
        current_quantity: dec(1000),
      });

      await service.deductItemIngredients(
        asTx(tx),
        orderItem,
        userActor,
        'zone-1',
      );

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
          actor_type: 'user',
          actor_id: 'user-1',
        }),
      });
    });

    it('throws BadRequestException when IngredientStock insufficient', async () => {
      const tx = makeTx();
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
      // Only 100g available, need 500g
      tx.ingredientStock.findFirst.mockResolvedValue({
        id: 'stock-1',
        current_quantity: dec(100),
      });

      await expect(
        service.deductItemIngredients(asTx(tx), orderItem, userActor, 'zone-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when PrepBatch stock insufficient', async () => {
      const tx = makeTx();
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
      // Only 3 portions available total
      tx.prepBatch.findMany.mockResolvedValue([
        {
          id: 'batch-1',
          quantity_remaining: dec(3),
          created_at: new Date('2026-03-20'),
        },
      ]);

      await expect(
        service.deductItemIngredients(asTx(tx), orderItem, userActor, 'zone-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deducts 3x the per-serving amount when quantity=3', async () => {
      const tx = makeTx();
      mockConvertUnit.mockResolvedValue(150); // 50g per serving x 3

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
      tx.ingredientStock.findFirst.mockResolvedValue({
        id: 'stock-1',
        current_quantity: dec(1000),
      });

      // quantity=3 means 3 servings
      await service.deductItemIngredients(
        asTx(tx),
        { ...orderItem, quantity: 3 },
        userActor,
        'zone-1',
      );

      // Per-serving need is multiplied by servings BEFORE conversion, so the
      // line produces a single stock update + movement for the full 150g.
      expect(mockConvertUnit).toHaveBeenCalledWith(150, 'g', 'g', asTx(tx));
      expect(tx.ingredientStock.update).toHaveBeenCalledTimes(1);
      expect(tx.ingredientStock.update).toHaveBeenCalledWith({
        where: { id: 'stock-1' },
        data: { current_quantity: { decrement: 150 } },
      });
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quantity: -150,
          original_quantity: 150,
        }),
      });
    });
  });

  describe('confirmPaidOrder', () => {
    const pending = {
      customerId: 'cust-1',
      cart: {
        items: [
          {
            menuItemId: 'mi-1',
            name: 'Burger',
            quantity: 2,
            unitPrice: 150,
            imageUrl: null,
          },
        ],
      },
      subtotal: 300,
      modifierAmount: 0,
      total: 300,
      channel: 'takeaway' as const,
      deliveryAddressId: null,
    };
    const input = {
      customerId: 'cust-1',
      razorpayOrderId: 'order_rzp1',
      razorpayPaymentId: 'pay_1',
      pending,
      placedVia: OrderSource.storefront,
    };

    it('creates order+payment in one transaction, resolves zone, applies prep types', async () => {
      const tx = makeTx();
      tx.systemSetting.findUnique.mockResolvedValue({ value: 'zone-1' });
      tx.zone.findUnique.mockResolvedValue({ id: 'zone-1' });
      tx.order.create.mockResolvedValue({
        id: 'ord-1',
        zone_id: 'zone-1',
        items: [orderItem],
      });
      tx.menuItem.findMany.mockResolvedValue([
        { id: 'mi-1', recipe: { id: 'r-1', preparation_type: 'scratch' } },
      ]);
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'ord-1',
        order_number: 7,
        status: 'placed',
        items: [],
        payment: { id: 'p-1' },
      });
      mockPrisma.$transaction.mockImplementation(
        async (cb: (t: unknown) => unknown) => cb(tx),
      );

      const result = await service.confirmPaidOrder(input);

      expect(result).toEqual(
        expect.objectContaining({ id: 'ord-1', order_number: 7 }),
      );
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customer_id: 'cust-1',
            zone_id: 'zone-1',
            created_by: null,
            status: 'placed',
            payment: {
              create: expect.objectContaining({
                razorpay_order_id: 'order_rzp1',
                razorpay_payment_id: 'pay_1',
                status: 'paid',
              }),
            },
          }),
        }),
      );
    });

    it('returns the existing order when the payment id is already stored (P2002)', async () => {
      mockPrisma.$transaction.mockRejectedValue(
        Object.assign(new Error('dup'), { code: 'P2002' }),
      );
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'ord-existing' });

      await expect(service.confirmPaidOrder(input)).resolves.toEqual({
        id: 'ord-existing',
      });
      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { payment: { razorpay_payment_id: 'pay_1' } },
        }),
      );
    });

    it('retries on P2034 before succeeding', async () => {
      const tx = makeTx();
      tx.systemSetting.findUnique.mockResolvedValue(null);
      tx.zone.findFirst.mockResolvedValue({ id: 'zone-k' });
      tx.order.create.mockResolvedValue({
        id: 'ord-2',
        zone_id: 'zone-k',
        items: [],
      });
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'ord-2',
        items: [],
        payment: {},
      });
      mockPrisma.$transaction
        .mockRejectedValueOnce(
          Object.assign(new Error('serialize'), { code: 'P2034' }),
        )
        .mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));

      await expect(service.confirmPaidOrder(input)).resolves.toEqual(
        expect.objectContaining({ id: 'ord-2' }),
      );
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });
});
