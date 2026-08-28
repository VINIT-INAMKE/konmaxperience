/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await --
   jest matchers (expect.objectContaining / expect.any) are typed `any`, and the
   $transaction mock deliberately forwards its callback result without awaiting. */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrderSource, Prisma } from '@prisma/client';
import {
  AUTO_REFUND_REASON,
  BOOKING_HOLD_EXPIRED,
  FulfilmentService,
  OrderRefusedAndRefundedException,
  actorForOrder,
  parsePendingOrder,
  pendingTotalPaise,
  upgradePendingOrder,
} from './fulfilment.service';
import { PrismaService } from '../prisma/prisma.service';
import { RefundsService } from '../refunds/refunds.service';
import { SYSTEM_USER_ID } from '../common/constants/system-actor';
import {
  mockAuditService,
  mockEventEmitter,
  provideAuditService,
  provideEventEmitter,
} from '../test-utils/mock-providers';
import { DomainEvent } from '../common/events/domain-events';
import { CouponsService } from '../promotions/coupons.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import type { PendingOrderV2, PricedLine } from '../checkout/quote.types';

jest.mock('../common/utils/unit-conversion', () => ({
  convertUnit: jest.fn().mockResolvedValue(null),
}));
import { convertUnit } from '../common/utils/unit-conversion';
const mockConvertUnit = convertUnit as jest.MockedFunction<typeof convertUnit>;

/** Mock Prisma Decimal -- supports Number() via valueOf() */
const dec = (n: number) => ({ valueOf: () => n, toNumber: () => n });

const makeTx = () => ({
  product: { findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  orderItem: { update: jest.fn(), updateMany: jest.fn() },
  order: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
  eventBooking: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    aggregate: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  event: { findUnique: jest.fn() },
  customer: { findUnique: jest.fn() },
  ingredientStock: { findFirst: jest.fn(), update: jest.fn() },
  stockMovement: { create: jest.fn() },
  prepBatch: { findMany: jest.fn(), update: jest.fn() },
  systemSetting: { findUnique: jest.fn() },
  zone: { findUnique: jest.fn(), findFirst: jest.fn() },
  auditEvent: { create: jest.fn() },
});
type MockTx = ReturnType<typeof makeTx>;
const asTx = (tx: MockTx) => tx as unknown as Prisma.TransactionClient;

/**
 * The `data` payload of the single `tx.order.create` call.
 *
 * Money is asserted through `String(...)` rather than by comparing `Decimal`
 * instances: the string is what Postgres stores, and it fails loudly on a
 * scale slip (`'300'` vs `'30000'`) that a numeric compare would hide.
 */
const createData = (tx: MockTx) =>
  (
    tx.order.create.mock.calls[0][0] as {
      data: Record<string, any> & {
        items: { create: Array<Record<string, any>> };
      };
    }
  ).data;

const mockPrisma = {
  $transaction: jest.fn(),
  order: { findFirst: jest.fn() },
  customerAddress: { findFirst: jest.fn() },
};

const audit = mockAuditService();
const emitter = mockEventEmitter();
const coupons = {
  redeem: jest.fn(),
  emitRedeemed: jest.fn(),
};
const loyalty = {
  redeemForOrder: jest.fn(),
};
const refunds = {
  refund: jest.fn(),
};

const userActor = { actor_type: 'user' as const, actor_id: 'user-1' };
const orderItem = {
  id: 'oi-1',
  order_id: 'order-1',
  product_id: 'mi-1',
  quantity: 1,
  fulfilment: 'local' as const,
};

describe('FulfilmentService', () => {
  let service: FulfilmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FulfilmentService,
        { provide: PrismaService, useValue: mockPrisma },
        provideAuditService(audit),
        provideEventEmitter(emitter),
        { provide: CouponsService, useValue: coupons },
        { provide: LoyaltyService, useValue: loyalty },
        { provide: RefundsService, useValue: refunds },
      ],
    }).compile();
    service = module.get(FulfilmentService);
    jest.clearAllMocks();
    emitter.emit.mockReturnValue(true);
    mockConvertUnit.mockResolvedValue(null);
    coupons.redeem.mockResolvedValue({
      redemption: { id: 'cr-1' },
      event: { couponId: 'cp-1', code: 'SAVE10' },
    });
    loyalty.redeemForOrder.mockResolvedValue(null);
    refunds.refund.mockResolvedValue({ id: 'rf-1' });
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
      tx.product.findMany.mockResolvedValue([
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
      tx.product.findMany.mockResolvedValue([
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
      tx.product.findMany.mockResolvedValue([
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
      tx.product.findMany.mockResolvedValue([
        {
          id: 'mi-1',
          recipe: { id: 'r-1', preparation_type: 'ready_to_sell' },
        },
      ]);
      tx.product.findUniqueOrThrow.mockResolvedValue({
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

      tx.product.findUniqueOrThrow.mockResolvedValue({
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

      tx.product.findUniqueOrThrow.mockResolvedValue({
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

      tx.product.findUniqueOrThrow.mockResolvedValue({
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

      tx.product.findUniqueOrThrow.mockResolvedValue({
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

      tx.product.findUniqueOrThrow.mockResolvedValue({
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

      tx.product.findUniqueOrThrow.mockResolvedValue({
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

      tx.product.findUniqueOrThrow.mockResolvedValue({
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
    /**
     * A **v1** pending record — the shape the previous deploy wrote, still
     * readable for one 30-minute TTL window (decision 5). Money is in rupees.
     * Keeping the original suite on this fixture makes the whole block a
     * standing regression test for the legacy upgrade path.
     */
    const pending = {
      customerId: 'cust-1',
      cart: {
        items: [
          {
            productId: 'mi-1',
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
        node_id: 'node-1',
        zone_id: 'zone-1',
        items: [orderItem],
      });
      tx.product.findMany.mockResolvedValue([
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
      expect(audit.record).toHaveBeenCalledWith(tx, {
        entity_type: 'order',
        entity_id: 'ord-1',
        action: 'order.confirmed',
        node_id: 'node-1',
        actor_type: 'customer',
        actor_id: 'cust-1',
        after: {
          status: 'placed',
          placed_via: OrderSource.storefront,
          razorpay_payment_id: 'pay_1',
          total: '300',
          discount_amount: '0',
          shipping_amount: '0',
          tax_amount: '0',
          coupon_code: null,
          loyalty_points_redeemed: 0,
        },
      });
    });

    it('upgrades the legacy v1 payload: rupee money, local lines, zeroed P5a columns', async () => {
      const tx = makeTx();
      tx.systemSetting.findUnique.mockResolvedValue({ value: 'zone-1' });
      tx.zone.findUnique.mockResolvedValue({ id: 'zone-1' });
      tx.order.create.mockResolvedValue({
        id: 'ord-1',
        node_id: 'node-1',
        zone_id: 'zone-1',
        items: [orderItem],
      });
      tx.product.findMany.mockResolvedValue([
        { id: 'mi-1', recipe: { id: 'r-1', preparation_type: 'scratch' } },
      ]);
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'ord-1',
        node_id: 'node-1',
        order_number: 7,
        items: [],
        payment: {},
      });
      mockPrisma.$transaction.mockImplementation(
        async (cb: (t: unknown) => unknown) => cb(tx),
      );

      await service.confirmPaidOrder(input);

      const data = createData(tx);
      // Rupees in, rupees out — the v1 total was never paise.
      expect(String(data.subtotal)).toBe('300');
      expect(String(data.total)).toBe('300');
      expect(String(data.discount_amount)).toBe('0');
      expect(String(data.shipping_amount)).toBe('0');
      expect(String(data.tax_amount)).toBe('0');
      expect(data.coupon_id).toBeNull();
      expect(data.loyalty_points_redeemed).toBe(0);
      expect(data.idempotency_key).toBeNull();
      expect(data.address_snapshot).toBe(Prisma.JsonNull);
      expect(data.items.create).toEqual([
        expect.objectContaining({
          product_id: 'mi-1',
          variant_id: null,
          quantity: 2,
          fulfilment: 'local',
        }),
      ]);
      expect(String(data.items.create[0].unit_price)).toBe('150');
      expect(String(data.items.create[0].tax_rate)).toBe('0');
      // Nothing commercial fires for a v1 payload — it predates all of it.
      expect(coupons.redeem).not.toHaveBeenCalled();
      expect(loyalty.redeemForOrder).not.toHaveBeenCalled();
      expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
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

    // -------------------------------------------------------------
    // order.confirmed domain event (SPEC §4.1)
    // -------------------------------------------------------------
    describe('order.confirmed', () => {
      const confirmed = {
        id: 'ord-1',
        node_id: 'node-1',
        order_number: 7,
        channel: 'takeaway',
        total: '300',
        customer_id: 'cust-1',
        status: 'placed',
        items: [orderItem],
        payment: { id: 'p-1' },
      };

      const arrangeConfirm = () => {
        const tx = makeTx();
        tx.systemSetting.findUnique.mockResolvedValue({ value: 'zone-1' });
        tx.zone.findUnique.mockResolvedValue({ id: 'zone-1' });
        tx.order.create.mockResolvedValue({
          id: 'ord-1',
          node_id: 'node-1',
          zone_id: 'zone-1',
          items: [orderItem],
        });
        tx.product.findMany.mockResolvedValue([
          { id: 'mi-1', recipe: { id: 'r-1', preparation_type: 'scratch' } },
        ]);
        tx.order.findUniqueOrThrow.mockResolvedValue(confirmed);
        return tx;
      };

      it('emits once, after the transaction resolves, with the typed payload', async () => {
        const tx = arrangeConfirm();
        let txResolved = false;
        mockPrisma.$transaction.mockImplementation(
          async (cb: (t: unknown) => unknown) => {
            const out = await cb(tx);
            txResolved = true;
            return out;
          },
        );
        emitter.emit.mockImplementation(() => {
          expect(txResolved).toBe(true);
          return true;
        });

        await service.confirmPaidOrder(input);

        expect(emitter.emit).toHaveBeenCalledTimes(1);
        expect(emitter.emit).toHaveBeenCalledWith(
          DomainEvent.ORDER_CONFIRMED,
          expect.objectContaining({
            node_id: 'node-1',
            actor: { actor_type: 'customer', actor_id: 'cust-1' },
            occurred_at: expect.any(String),
            orderId: 'ord-1',
            orderNumber: 7,
            channel: 'takeaway',
            total: '300',
            itemCount: 1,
            customerId: 'cust-1',
          }),
        );
      });

      it('does not re-emit on the P2002 replay path', async () => {
        mockPrisma.$transaction.mockRejectedValue(
          Object.assign(new Error('dup'), { code: 'P2002' }),
        );
        mockPrisma.order.findFirst.mockResolvedValue({ id: 'ord-existing' });

        await service.confirmPaidOrder(input);

        expect(emitter.emit).not.toHaveBeenCalled();
      });

      it('still resolves when the emitter throws', async () => {
        const tx = arrangeConfirm();
        mockPrisma.$transaction.mockImplementation(
          async (cb: (t: unknown) => unknown) => cb(tx),
        );
        emitter.emit.mockImplementation(() => {
          throw new Error('listener exploded');
        });

        await expect(service.confirmPaidOrder(input)).resolves.toEqual(
          expect.objectContaining({ id: 'ord-1' }),
        );
      });
    });
  });

  // ---------------------------------------------------------------------
  // CHK-04: the v2 frozen quote — every commercial effect, one transaction
  // ---------------------------------------------------------------------
  describe('confirmPaidOrder (v2 frozen quote)', () => {
    const line = (over: Partial<PricedLine> = {}): PricedLine => ({
      product_id: 'p-local',
      variant_id: null,
      name: 'Burger',
      sku: null,
      quantity: 2,
      type: 'prepared_food',
      fulfilment: 'local',
      unit_price: 15000,
      gross: 30000,
      tax_rate: '5.00',
      tax: 1429,
      weight_grams: 0,
      hsn_code: null,
      available: true,
      unavailable_reason: null,
      event_id: null,
      ...over,
    });

    const v2 = (over: Partial<PendingOrderV2> = {}): PendingOrderV2 => ({
      v: 2,
      razorpay_order_id: 'order_rzp1',
      idempotency_key: 'idem-1',
      customer_id: 'cust-1',
      created_at: '2026-08-24T00:00:00.000Z',
      channel: 'takeaway',
      delivery_address_id: null,
      pickup: false,
      lines: [line()],
      holds: [],
      subtotal: 30000,
      discount_amount: 0,
      coupon: null,
      shipping_amount: 0,
      shipping: null,
      tax_amount: 1429,
      tax_breakup: [],
      loyalty_points_redeemed: 0,
      loyalty_redeem_amount: 0,
      loyalty_points_earned_estimate: 0,
      total: 30000,
      ...over,
    });

    const confirmInput = (pending: PendingOrderV2) => ({
      customerId: 'cust-1',
      razorpayOrderId: 'order_rzp1',
      razorpayPaymentId: 'pay_1',
      pending,
      placedVia: OrderSource.storefront,
    });

    type ArrangedItem = {
      id: string;
      product_id: string;
      fulfilment: string;
      quantity?: number;
    };

    /**
     * One `tx.product.findMany` mock serves both readers — `reconcileFulfilment`
     * reads `fulfilment`, `applyPrepTypeOnCreate` reads `recipe` — so every
     * fixture product carries both.
     */
    const arrange = (
      items: ArrangedItem[],
      products: Array<{ id: string; fulfilment?: string; recipe?: unknown }>,
    ) => {
      const tx = makeTx();
      tx.systemSetting.findUnique.mockResolvedValue({ value: 'zone-1' });
      tx.zone.findUnique.mockResolvedValue({ id: 'zone-1' });
      tx.order.create.mockResolvedValue({
        id: 'ord-1',
        node_id: 'node-1',
        zone_id: 'zone-1',
        items: items.map((i) => ({ order_id: 'ord-1', quantity: 1, ...i })),
      });
      tx.product.findMany.mockResolvedValue(products);
      // Re-seat defaults: an event with room, no rival row, a real customer.
      // Every booking test overrides exactly the one it is about.
      tx.event.findUnique.mockResolvedValue({
        id: 'ev-1',
        capacity: 10,
        status: 'upcoming',
      });
      tx.eventBooking.findFirst.mockResolvedValue(null);
      tx.eventBooking.aggregate.mockResolvedValue({ _sum: { guests: 0 } });
      tx.eventBooking.create.mockResolvedValue({ id: 'bk-new' });
      tx.customer.findUnique.mockResolvedValue({
        name: 'Demo Customer',
        phone: '9900000001',
      });
      tx.order.findUniqueOrThrow.mockResolvedValue({
        id: 'ord-1',
        node_id: 'node-1',
        order_number: 7,
        channel: 'takeaway',
        total: '300',
        customer_id: 'cust-1',
        status: 'placed',
        items,
        payment: { id: 'p-1' },
      });
      mockPrisma.$transaction.mockImplementation(
        async (cb: (t: unknown) => unknown) => cb(tx),
      );
      return tx;
    };

    const MIXED_ITEMS: ArrangedItem[] = [
      { id: 'oi-local', product_id: 'p-local', fulfilment: 'local' },
      { id: 'oi-ship', product_id: 'p-ship', fulfilment: 'shipped' },
      { id: 'oi-book', product_id: 'p-book', fulfilment: 'booking' },
    ];
    const MIXED_PRODUCTS = [
      {
        id: 'p-local',
        fulfilment: 'local',
        recipe: { id: 'r-1', preparation_type: 'scratch' },
      },
      { id: 'p-ship', fulfilment: 'shipped' },
      { id: 'p-book', fulfilment: 'booking' },
    ];
    const MIXED_PENDING = () =>
      v2({
        lines: [
          line(),
          line({
            product_id: 'p-ship',
            variant_id: 'var-1',
            fulfilment: 'shipped',
            type: 'merchandise',
            tax_rate: '18.00',
            quantity: 1,
            unit_price: 50000,
            gross: 50000,
          }),
          line({
            product_id: 'p-book',
            fulfilment: 'booking',
            type: 'experience',
            tax_rate: '0.00',
            quantity: 1,
            unit_price: 100000,
            gross: 100000,
            event_id: 'ev-1',
          }),
        ],
        holds: [
          {
            booking_id: 'bk-1',
            event_id: 'ev-1',
            product_id: 'p-book',
            guests: 2,
            expires_at: '2026-08-24T00:15:00.000Z',
          },
        ],
        subtotal: 180000,
        tax_amount: 9057,
        total: 180000,
      });

    it('writes one OrderItem per line with its frozen fulfilment, variant and tax rate', async () => {
      const tx = arrange(MIXED_ITEMS, MIXED_PRODUCTS);
      tx.eventBooking.findUnique.mockResolvedValue({
        id: 'bk-1',
        status: 'held',
      });

      await service.confirmPaidOrder(confirmInput(MIXED_PENDING()));

      const items = createData(tx).items.create;
      expect(items).toHaveLength(3);
      expect(items.map((i) => i.fulfilment)).toEqual([
        'local',
        'shipped',
        'booking',
      ]);
      expect(items[1].variant_id).toBe('var-1');
      // tax_rate is the per-line Product rate, not the P2 default of 0.
      expect(items.map((i) => String(i.tax_rate))).toEqual(['5', '18', '0']);
      expect(items.map((i) => String(i.unit_price))).toEqual([
        '150',
        '500',
        '1000',
      ]);
    });

    it('routes shipped lines to the packed queue and leaves them out of prep', async () => {
      const tx = arrange(MIXED_ITEMS, MIXED_PRODUCTS);
      tx.eventBooking.findUnique.mockResolvedValue({
        id: 'bk-1',
        status: 'held',
      });

      await service.confirmPaidOrder(confirmInput(MIXED_PENDING()));

      expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['oi-ship'] } },
        data: { status: 'packed' },
      });
      // A shipped line has no recipe to deduct against.
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('promotes the booking hold to confirmed and links it to the paying item', async () => {
      const tx = arrange(MIXED_ITEMS, MIXED_PRODUCTS);
      tx.eventBooking.findUnique.mockResolvedValue({
        id: 'bk-1',
        status: 'held',
      });

      await service.confirmPaidOrder(confirmInput(MIXED_PENDING()));

      expect(tx.eventBooking.update).toHaveBeenCalledWith({
        where: { id: 'bk-1' },
        data: {
          status: 'confirmed',
          payment_status: 'paid',
          hold_expires_at: null,
          razorpay_payment_id: null,
        },
      });
      expect(tx.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'oi-book' },
        data: { event_booking_id: 'bk-1', status: 'ready' },
      });
    });

    // ── P5a debt: the 15-minute hold vs the 30-minute pending order ────────
    //
    // `EventHoldsCron` sweeps a hold at 15 minutes; the pending-order key lives
    // 30. A capture in that window used to throw inside `applyCommercialEffects`
    // and leave a captured payment with no order at all — the §5.2 violation
    // these specs pin shut.

    describe('a hold that was swept before the payment landed', () => {
      it('re-acquires the seat and confirms the order normally', async () => {
        const tx = arrange(MIXED_ITEMS, MIXED_PRODUCTS);
        tx.eventBooking.findUnique.mockResolvedValue(null); // swept

        await service.confirmPaidOrder(confirmInput(MIXED_PENDING()));

        // Capacity was re-checked with the quote's own hold-aware arithmetic.
        expect(tx.eventBooking.aggregate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ event_id: 'ev-1' }),
            _sum: { guests: true },
          }),
        );
        expect(tx.eventBooking.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            event_id: 'ev-1',
            customer_id: 'cust-1',
            customer_phone: '9900000001',
            guests: 2,
            status: 'confirmed',
            payment_status: 'paid',
            hold_expires_at: null,
          }),
          select: { id: true },
        });
        expect(tx.orderItem.update).toHaveBeenCalledWith({
          where: { id: 'oi-book' },
          data: { event_booking_id: 'bk-new', status: 'ready' },
        });
        // A normal confirmation: the order exists, nothing was refunded.
        expect(refunds.refund).not.toHaveBeenCalled();
        expect(emitter.emit).toHaveBeenCalledWith(
          DomainEvent.ORDER_CONFIRMED,
          expect.anything(),
        );
      });

      it('audits the re-acquisition so the extra seat is traceable', async () => {
        const tx = arrange(MIXED_ITEMS, MIXED_PRODUCTS);
        tx.eventBooking.findUnique.mockResolvedValue(null);

        await service.confirmPaidOrder(confirmInput(MIXED_PENDING()));

        expect(audit.record).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({
            action: 'order.booking_reacquired',
            entity_id: 'ord-1',
            after: expect.objectContaining({
              lines: [
                {
                  order_item_id: 'oi-book',
                  product_id: 'p-book',
                  event_id: 'ev-1',
                  guests: 2,
                  booking_id: 'bk-new',
                },
              ],
            }),
          }),
        );
      });

      it('promotes a cancelled hold row in place rather than inserting beside it', async () => {
        const tx = arrange(MIXED_ITEMS, MIXED_PRODUCTS);
        tx.eventBooking.findUnique.mockResolvedValue({
          id: 'bk-1',
          status: 'cancelled',
        });
        tx.eventBooking.findFirst.mockResolvedValue({
          id: 'bk-1',
          status: 'cancelled',
        });

        await service.confirmPaidOrder(confirmInput(MIXED_PENDING()));

        // `@@unique([event_id, customer_phone])` — a second insert would abort
        // the whole Postgres transaction, so the row is reused.
        expect(tx.eventBooking.create).not.toHaveBeenCalled();
        expect(tx.eventBooking.update).toHaveBeenCalledWith({
          where: { id: 'bk-1' },
          data: expect.objectContaining({
            status: 'confirmed',
            payment_status: 'paid',
            hold_expires_at: null,
            guests: 2,
          }),
        });
        // The row it is promoting must not count against its own capacity check.
        expect(tx.eventBooking.aggregate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ NOT: { id: 'bk-1' } }),
          }),
        );
      });

      it('seats a line whose hold never reached the payload, from the quoted line', async () => {
        const tx = arrange(MIXED_ITEMS, MIXED_PRODUCTS);
        const pending = MIXED_PENDING();
        pending.holds = [];

        await service.confirmPaidOrder(confirmInput(pending));

        expect(tx.eventBooking.findUnique).not.toHaveBeenCalled();
        expect(tx.eventBooking.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ event_id: 'ev-1', guests: 1 }),
          select: { id: true },
        });
      });
    });

    describe('a booking line that cannot be re-seated', () => {
      /** The event has filled up while the customer was on the payment screen. */
      const soldOut = () => {
        const tx = arrange(MIXED_ITEMS, MIXED_PRODUCTS);
        tx.eventBooking.findUnique.mockResolvedValue(null);
        tx.event.findUnique.mockResolvedValue({
          id: 'ev-1',
          capacity: 10,
          status: 'upcoming',
        });
        tx.eventBooking.aggregate.mockResolvedValue({ _sum: { guests: 9 } });
        return tx;
      };

      it('refuses the whole order rather than confirming a partial one', async () => {
        const tx = soldOut();

        await expect(
          service.confirmPaidOrder(confirmInput(MIXED_PENDING())),
        ).rejects.toBeInstanceOf(OrderRefusedAndRefundedException);

        // Nothing commercial was applied and no seat was written.
        expect(coupons.redeem).not.toHaveBeenCalled();
        expect(loyalty.redeemForOrder).not.toHaveBeenCalled();
        expect(tx.eventBooking.update).not.toHaveBeenCalled();
        expect(tx.eventBooking.create).not.toHaveBeenCalled();
        expect(emitter.emit).not.toHaveBeenCalled();
      });

      it('writes a cancelled order with cancelled items and the captured payment', async () => {
        const tx = soldOut();

        await expect(
          service.confirmPaidOrder(confirmInput(MIXED_PENDING())),
        ).rejects.toThrow(BOOKING_HOLD_EXPIRED);

        // The second `order.create` is the refusal: `OrderStatus` has no
        // `failed` member and `Refund.order_id` is required, so a `cancelled`
        // row is the shape this schema supports for the refund to hang off.
        const refused = (
          tx.order.create.mock.calls.at(-1)?.[0] as {
            data: Record<string, any> & {
              items: { create: Array<Record<string, any>> };
            };
          }
        ).data;
        expect(refused.status).toBe('cancelled');
        expect(refused.zone_id).toBeNull();
        expect(refused.coupon_id).toBeNull();
        expect(refused.loyalty_points_redeemed).toBe(0);
        expect(String(refused.total)).toBe('1800');
        expect(
          refused.items.create.every((item) => item.status === 'cancelled'),
        ).toBe(true);
        expect(refused.payment.create).toMatchObject({
          status: 'paid',
          razorpay_payment_id: 'pay_1',
        });
      });

      it('issues a full gateway refund as the system actor and audits the refusal', async () => {
        const tx = soldOut();

        await expect(
          service.confirmPaidOrder(confirmInput(MIXED_PENDING())),
        ).rejects.toThrow(BOOKING_HOLD_EXPIRED);

        // No `amount` — `RefundsService` refunds the whole remaining balance.
        expect(refunds.refund).toHaveBeenCalledWith(
          'ord-1',
          { reason: expect.stringContaining(AUTO_REFUND_REASON) },
          SYSTEM_USER_ID,
        );
        expect(audit.record).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({
            action: 'order.payment_refused',
            entity_id: 'ord-1',
            actor_type: 'system',
            after: expect.objectContaining({
              status: 'cancelled',
              razorpay_payment_id: 'pay_1',
              unseatable: [
                expect.objectContaining({
                  order_item_id: 'oi-book',
                  event_id: 'ev-1',
                  guests: 2,
                }),
              ],
            }),
          }),
        );
      });

      it('carries the refund outcome on the exception', async () => {
        soldOut();

        await expect(
          service.confirmPaidOrder(confirmInput(MIXED_PENDING())),
        ).rejects.toMatchObject({
          detail: { order_id: 'ord-1', refund_id: 'rf-1', refunded: true },
        });
      });

      it('keeps the refused order when the gateway rejects the refund', async () => {
        const tx = soldOut();
        refunds.refund.mockRejectedValue(new Error('gateway down'));

        await expect(
          service.confirmPaidOrder(confirmInput(MIXED_PENDING())),
        ).rejects.toMatchObject({ detail: { refunded: false } });

        // The order row survives on purpose: dropping it would put a captured
        // payment back to having nothing attached to it at all.
        expect(tx.order.create).toHaveBeenCalledTimes(2);
        expect(audit.record).toHaveBeenCalledWith(
          tx,
          expect.objectContaining({ action: 'order.auto_refund_failed' }),
        );
      });

      it('replays as a no-op: no second order, no second gateway call', async () => {
        const tx = soldOut();
        // The confirm attempt still runs and still rolls back; it is the
        // *refusal* write that collides, because the first delivery already
        // wrote it and `Payment.razorpay_payment_id` is unique.
        tx.order.create
          .mockResolvedValueOnce({
            id: 'ord-1',
            node_id: 'node-1',
            zone_id: 'zone-1',
            items: MIXED_ITEMS.map((i) => ({
              order_id: 'ord-1',
              quantity: 1,
              ...i,
            })),
          })
          .mockRejectedValueOnce(
            Object.assign(new Error('unique'), { code: 'P2002' }),
          );
        mockPrisma.order.findFirst.mockResolvedValue({
          id: 'ord-1',
          node_id: 'node-1',
          payment: { status: 'refunded' },
        });

        await expect(
          service.confirmPaidOrder(confirmInput(MIXED_PENDING())),
        ).rejects.toMatchObject({
          detail: { order_id: 'ord-1', refunded: true, refund_id: null },
        });

        expect(refunds.refund).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalledWith(
          tx,
          expect.objectContaining({ action: 'order.payment_refused' }),
        );
      });

      it('reports refunded:false on a replay whose first auto-refund failed', async () => {
        const tx = soldOut();
        tx.order.create
          .mockResolvedValueOnce({
            id: 'ord-1',
            node_id: 'node-1',
            zone_id: 'zone-1',
            items: MIXED_ITEMS.map((i) => ({
              order_id: 'ord-1',
              quantity: 1,
              ...i,
            })),
          })
          .mockRejectedValueOnce(
            Object.assign(new Error('unique'), { code: 'P2002' }),
          );
        // The money never left: the `Payment` row still reads `paid`.
        mockPrisma.order.findFirst.mockResolvedValue({
          id: 'ord-1',
          node_id: 'node-1',
          payment: { status: 'paid' },
        });

        await expect(
          service.confirmPaidOrder(confirmInput(MIXED_PENDING())),
        ).rejects.toMatchObject({ detail: { refunded: false } });
      });
    });

    it('redeems the coupon inside the transaction and emits only after it commits', async () => {
      const tx = arrange(
        [{ id: 'oi-local', product_id: 'p-local', fulfilment: 'local' }],
        [
          {
            id: 'p-local',
            fulfilment: 'local',
            recipe: { id: 'r-1', preparation_type: 'scratch' },
          },
        ],
      );
      let committed = false;
      mockPrisma.$transaction.mockImplementation(
        async (cb: (t: unknown) => unknown) => {
          const out = await cb(tx);
          committed = true;
          return out;
        },
      );
      coupons.emitRedeemed.mockImplementation(() => {
        expect(committed).toBe(true);
      });

      await service.confirmPaidOrder(
        confirmInput(
          v2({
            coupon: {
              id: 'cp-1',
              code: 'SAVE10',
              type: 'percent',
              discount: 3000,
            },
            discount_amount: 3000,
            total: 27000,
          }),
        ),
      );

      expect(coupons.redeem).toHaveBeenCalledTimes(1);
      expect(coupons.redeem).toHaveBeenCalledWith(tx, {
        couponId: 'cp-1',
        orderId: 'ord-1',
        customerId: 'cust-1',
        // Paise-exact: the quote's discount, not a recomputed percentage.
        amount: 3000,
        nodeId: 'node-1',
        actor: { actor_type: 'customer', actor_id: 'cust-1' },
      });
      expect(coupons.emitRedeemed).toHaveBeenCalledWith({
        couponId: 'cp-1',
        code: 'SAVE10',
      });
      expect(createData(tx).coupon_id).toBe('cp-1');
    });

    it('leaves the coupon alone when the frozen discount is zero', async () => {
      const tx = arrange(
        [{ id: 'oi-local', product_id: 'p-local', fulfilment: 'local' }],
        [{ id: 'p-local', fulfilment: 'local' }],
      );

      await service.confirmPaidOrder(
        confirmInput(
          v2({
            coupon: {
              id: 'cp-1',
              code: 'FREESHIP',
              type: 'free_shipping',
              discount: 0,
            },
            discount_amount: 0,
          }),
        ),
      );

      expect(coupons.redeem).not.toHaveBeenCalled();
      expect(coupons.emitRedeemed).not.toHaveBeenCalled();
      // The coupon is still recorded on the order — it was applied, just free.
      expect(createData(tx).coupon_id).toBe('cp-1');
    });

    it('spends loyalty points through the transaction client, never through prisma', async () => {
      const tx = arrange(
        [{ id: 'oi-local', product_id: 'p-local', fulfilment: 'local' }],
        [{ id: 'p-local', fulfilment: 'local' }],
      );

      await service.confirmPaidOrder(
        confirmInput(
          v2({
            loyalty_points_redeemed: 120,
            loyalty_redeem_amount: 12000,
            total: 18000,
          }),
        ),
      );

      expect(loyalty.redeemForOrder).toHaveBeenCalledWith(
        tx,
        'cust-1',
        'ord-1',
        120,
      );
      expect(loyalty.redeemForOrder.mock.calls[0][0]).not.toBe(mockPrisma);
      const data = createData(tx);
      expect(data.loyalty_points_redeemed).toBe(120);
      // Earned on delivery, never on payment.
      expect(data.loyalty_points_earned).toBe(0);
    });

    it('folds the loyalty spend into discount_amount and never adds tax to the total', async () => {
      const tx = arrange(
        [{ id: 'oi-local', product_id: 'p-local', fulfilment: 'local' }],
        [{ id: 'p-local', fulfilment: 'local' }],
      );

      await service.confirmPaidOrder(
        confirmInput(
          v2({
            subtotal: 30000,
            discount_amount: 3000,
            loyalty_redeem_amount: 2000,
            loyalty_points_redeemed: 20,
            shipping_amount: 4900,
            tax_amount: 1429,
            total: 29900,
            coupon: {
              id: 'cp-1',
              code: 'SAVE10',
              type: 'percent',
              discount: 3000,
            },
          }),
        ),
      );

      const data = createData(tx);
      expect(String(data.subtotal)).toBe('300');
      // 3000 coupon + 2000 loyalty, both in paise, one rupee column.
      expect(String(data.discount_amount)).toBe('50');
      expect(String(data.shipping_amount)).toBe('49');
      expect(String(data.tax_amount)).toBe('14.29');
      // subtotal - discount - loyalty + shipping = 299; tax is carved out of
      // subtotal (decision 1) and is NOT a fourth term.
      expect(String(data.total)).toBe('299');
      expect(String(data.channel_modifier_amount)).toBe('0');
      expect(String(data.payment.create.amount)).toBe('299');
    });

    it('re-routes a line whose Product.fulfilment changed since the quote', async () => {
      // Frozen as `local`; a staff edit made the product `shipped` before payment.
      const tx = arrange(
        [{ id: 'oi-local', product_id: 'p-local', fulfilment: 'local' }],
        [
          {
            id: 'p-local',
            fulfilment: 'shipped',
            recipe: { id: 'r-1', preparation_type: 'ready_to_sell' },
          },
        ],
      );

      await service.confirmPaidOrder(confirmInput(v2()));

      expect(tx.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'oi-local' },
        data: { fulfilment: 'shipped' },
      });
      expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['oi-local'] } },
        data: { status: 'packed' },
      });
      // Re-routing happens BEFORE prep, so the now-shipped line never had its
      // ingredients deducted for a kitchen that is not making it.
      expect(tx.product.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('freezes the delivery address into address_snapshot', async () => {
      const tx = arrange(
        [{ id: 'oi-local', product_id: 'p-local', fulfilment: 'local' }],
        [{ id: 'p-local', fulfilment: 'local' }],
      );
      mockPrisma.customerAddress.findFirst.mockResolvedValue({
        id: 'addr-1',
        label: 'Home',
        address: '12 Palm Road',
        landmark: 'Near the pier',
        pincode: '403001',
        lat: 15.5,
        lng: 73.8,
      });

      await service.confirmPaidOrder(
        confirmInput(
          v2({ channel: 'delivery', delivery_address_id: 'addr-1' }),
        ),
      );

      const data = createData(tx);
      expect(data.delivery_address).toBe(
        '12 Palm Road, Near the pier - 403001',
      );
      expect(data.address_snapshot).toEqual({
        id: 'addr-1',
        label: 'Home',
        address: '12 Palm Road',
        landmark: 'Near the pier',
        pincode: '403001',
        lat: 15.5,
        lng: 73.8,
      });
    });

    it('resolves an address for a shipped line even on a non-delivery channel', async () => {
      arrange(
        [{ id: 'oi-ship', product_id: 'p-ship', fulfilment: 'shipped' }],
        [{ id: 'p-ship', fulfilment: 'shipped' }],
      );
      mockPrisma.customerAddress.findFirst.mockResolvedValue(null);

      await service.confirmPaidOrder(
        confirmInput(
          v2({
            channel: 'takeaway',
            delivery_address_id: 'addr-1',
            lines: [line({ product_id: 'p-ship', fulfilment: 'shipped' })],
          }),
        ),
      );

      expect(mockPrisma.customerAddress.findFirst).toHaveBeenCalledWith({
        where: { id: 'addr-1', customer_id: 'cust-1' },
      });
    });

    it('carries the client idempotency key onto the order', async () => {
      const tx = arrange(
        [{ id: 'oi-local', product_id: 'p-local', fulfilment: 'local' }],
        [{ id: 'p-local', fulfilment: 'local' }],
      );

      await service.confirmPaidOrder(
        confirmInput(v2({ idempotency_key: 'quote-abc' })),
      );

      expect(createData(tx).idempotency_key).toBe('quote-abc');
    });

    it('records the new money fields on the audit row', async () => {
      const tx = arrange(
        [{ id: 'oi-local', product_id: 'p-local', fulfilment: 'local' }],
        [{ id: 'p-local', fulfilment: 'local' }],
      );

      await service.confirmPaidOrder(
        confirmInput(
          v2({
            coupon: {
              id: 'cp-1',
              code: 'SAVE10',
              type: 'percent',
              discount: 3000,
            },
            discount_amount: 3000,
            shipping_amount: 4900,
            loyalty_points_redeemed: 20,
            loyalty_redeem_amount: 2000,
            total: 29900,
          }),
        ),
      );

      expect(audit.record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: 'order.confirmed',
          node_id: 'node-1',
          after: {
            status: 'placed',
            placed_via: OrderSource.storefront,
            razorpay_payment_id: 'pay_1',
            total: '299',
            discount_amount: '50',
            shipping_amount: '49',
            tax_amount: '14.29',
            coupon_code: 'SAVE10',
            loyalty_points_redeemed: 20,
          },
        }),
      );
    });

    it('replays a duplicate payment to the existing order without re-applying anything', async () => {
      mockPrisma.$transaction.mockRejectedValue(
        Object.assign(new Error('dup'), { code: 'P2002' }),
      );
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'ord-existing' });

      await expect(
        service.confirmPaidOrder(
          confirmInput(
            v2({
              coupon: {
                id: 'cp-1',
                code: 'SAVE10',
                type: 'percent',
                discount: 3000,
              },
              discount_amount: 3000,
              loyalty_points_redeemed: 20,
              loyalty_redeem_amount: 2000,
            }),
          ),
        ),
      ).resolves.toEqual({ id: 'ord-existing' });
      expect(emitter.emit).not.toHaveBeenCalled();
      expect(coupons.emitRedeemed).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // Pending-order version guard (decision 5)
  // ---------------------------------------------------------------------
  describe('pending order payload versioning', () => {
    const v1 = {
      customerId: 'cust-9',
      cart: {
        items: [
          {
            productId: 'p-1',
            variantId: 'var-9',
            name: 'Latte',
            quantity: 3,
            unitPrice: 12.5,
            imageUrl: null,
          },
        ],
      },
      subtotal: 37.5,
      modifierAmount: 0,
      total: 37.5,
      channel: 'delivery' as const,
      deliveryAddressId: 'addr-9',
    };

    it('upgrades a v1 record to neutral v2 values in paise', () => {
      const upgraded = upgradePendingOrder(v1);

      expect(upgraded.v).toBe(2);
      expect(upgraded.customer_id).toBe('cust-9');
      expect(upgraded.delivery_address_id).toBe('addr-9');
      expect(upgraded.subtotal).toBe(3750);
      expect(upgraded.total).toBe(3750);
      expect(upgraded.discount_amount).toBe(0);
      expect(upgraded.shipping_amount).toBe(0);
      expect(upgraded.tax_amount).toBe(0);
      expect(upgraded.coupon).toBeNull();
      expect(upgraded.holds).toEqual([]);
      expect(upgraded.loyalty_points_redeemed).toBe(0);
      expect(upgraded.lines).toEqual([
        expect.objectContaining({
          product_id: 'p-1',
          variant_id: 'var-9',
          quantity: 3,
          fulfilment: 'local',
          type: 'prepared_food',
          unit_price: 1250,
          gross: 3750,
          tax_rate: '0.00',
          tax: 0,
        }),
      ]);
    });

    it('returns a v2 record untouched', () => {
      const already = {
        v: 2,
        total: 999,
      } as unknown as PendingOrderV2;
      expect(upgradePendingOrder(already)).toBe(already);
    });

    it('reads the total in paise from either version', () => {
      expect(pendingTotalPaise(v1)).toBe(3750);
      expect(
        pendingTotalPaise({ v: 2, total: 3750 } as unknown as PendingOrderV2),
      ).toBe(3750);
    });

    it('parses raw Redis JSON of either version', () => {
      expect(parsePendingOrder(JSON.stringify(v1)).total).toBe(3750);
      expect(parsePendingOrder('{"v":2,"total":4200}').total).toBe(4200);
    });
  });
});
