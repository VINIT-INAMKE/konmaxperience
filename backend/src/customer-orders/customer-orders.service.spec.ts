import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FulfilmentType, OrderChannel, ProductType } from '@prisma/client';
import { CustomerOrdersService } from './customer-orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { NodeService } from '../node/node.service';
import { RedisService } from '../customer-auth/redis.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { PusherService } from '../chat/pusher.service';
import {
  FulfilmentService,
  OrderRefusedAndRefundedException,
} from '../fulfilment/fulfilment.service';
import { CartPricingService } from '../checkout/cart-pricing.service';
import type {
  PricedCart,
  PricedLine,
  StoredQuote,
} from '../checkout/quote.types';

/** A priced line with sane defaults; every money field is integer paise. */
function line(overrides: Partial<PricedLine> = {}): PricedLine {
  return {
    product_id: 'p1',
    variant_id: null,
    name: 'Konma Signature Thali',
    sku: null,
    quantity: 2,
    type: ProductType.prepared_food,
    fulfilment: FulfilmentType.local,
    unit_price: 45000,
    gross: 90000,
    tax_rate: '5.00',
    tax: 4286,
    weight_grams: 0,
    hsn_code: null,
    available: true,
    unavailable_reason: null,
    event_id: null,
    ...overrides,
  };
}

/** A `CartPricingService.price` answer built from the lines it should return. */
function pricedCart(
  lines: PricedLine[],
  rejected: PricedCart['rejected'] = [],
): PricedCart {
  const subtotal = lines.reduce((sum, l) => sum + l.gross, 0);
  const taxTotal = lines.reduce((sum, l) => sum + l.tax, 0);
  return {
    lines,
    subtotal,
    tax_total: taxTotal,
    tax_breakup: [],
    channel: OrderChannel.delivery,
    channel_modifier: 0,
    has_local: lines.some((l) => l.fulfilment === FulfilmentType.local),
    has_shipped: lines.some((l) => l.fulfilment === FulfilmentType.shipped),
    has_booking: lines.some((l) => l.fulfilment === FulfilmentType.booking),
    shipped_weight_grams: 0,
    rejected,
  };
}

describe('CustomerOrdersService', () => {
  let service: CustomerOrdersService;
  let prisma: Record<string, any>;
  let redisClient: Record<string, jest.Mock>;
  let redisService: { getClient: jest.Mock };
  let razorpayService: Record<string, jest.Mock>;
  let pusherService: { trigger: jest.Mock };
  let pricingService: { price: jest.Mock };
  let fulfilmentService: {
    confirmPaidOrder: jest.Mock;
    findOrderByRazorpayPaymentId: jest.Mock;
  };

  const customerId = 'cust-001';

  beforeEach(async () => {
    redisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getdel: jest.fn(),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
    };

    prisma = {
      customerAddress: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      channelModifier: {
        findFirst: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      shipment: {
        findUnique: jest.fn(),
      },
      eventBooking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    razorpayService = {
      createOrder: jest.fn(),
      verifyPaymentSignature: jest.fn(),
      fetchPayment: jest.fn(),
    };

    pusherService = {
      trigger: jest.fn().mockResolvedValue(undefined),
    };

    fulfilmentService = {
      confirmPaidOrder: jest.fn(),
      findOrderByRazorpayPaymentId: jest.fn().mockResolvedValue(null),
    };

    pricingService = {
      price: jest.fn().mockResolvedValue(pricedCart([])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerOrdersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NodeService,
          useValue: { timezone: jest.fn().mockResolvedValue('Asia/Kolkata') },
        },
        { provide: RedisService, useValue: redisService },
        { provide: RazorpayService, useValue: razorpayService },
        { provide: PusherService, useValue: pusherService },
        { provide: FulfilmentService, useValue: fulfilmentService },
        { provide: CartPricingService, useValue: pricingService },
      ],
    }).compile();

    service = module.get<CustomerOrdersService>(CustomerOrdersService);
  });

  // ---------------------------------------------------------------
  // Cart CRUD
  // ---------------------------------------------------------------

  describe('getCart', () => {
    it('should return parsed cart from Redis', async () => {
      const cart = {
        items: [
          {
            productId: 'm1',
            name: 'Burger',
            quantity: 2,
            unitPrice: 150,
            imageUrl: null,
          },
        ],
        channel: 'takeaway',
        deliveryAddressId: null,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      redisClient.get.mockResolvedValue(JSON.stringify(cart));

      const result = await service.getCart(customerId);
      expect(result).toEqual(cart);
      expect(redisClient.get).toHaveBeenCalledWith(`cart:${customerId}`);
    });

    it('should drop pre-P2-11 lines that carry no productId', async () => {
      // Pre-P2-11 carts keyed their lines on the old catalog id, never on
      // `productId`; the filter is shape-based, so any foreign key stands in.
      const legacyLine = {
        legacyItemId: 'legacy-1',
        name: 'Old Burger',
        quantity: 1,
        unitPrice: 150,
        imageUrl: null,
      };
      const currentLine = {
        productId: 'p1',
        name: 'Burger',
        quantity: 2,
        unitPrice: 150,
        imageUrl: null,
      };
      redisClient.get.mockResolvedValue(
        JSON.stringify({
          items: [legacyLine, currentLine],
          channel: 'takeaway',
          deliveryAddressId: null,
          updatedAt: '2026-01-01T00:00:00Z',
        }),
      );

      const result = await service.getCart(customerId);
      expect(result?.items).toEqual([currentLine]);
    });

    it('should return null when key missing', async () => {
      redisClient.get.mockResolvedValue(null);
      const result = await service.getCart(customerId);
      expect(result).toBeNull();
    });

    it('should return null when Redis client unavailable', async () => {
      redisService.getClient.mockReturnValue(null);
      const result = await service.getCart(customerId);
      expect(result).toBeNull();
    });
  });

  describe('setCart', () => {
    it('should call redis.set with correct key and TTL', async () => {
      const cart = {
        items: [],
        channel: null as any,
        deliveryAddressId: null,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      await service.setCart(customerId, cart);
      expect(redisClient.set).toHaveBeenCalledWith(
        `cart:${customerId}`,
        JSON.stringify(cart),
        'EX',
        604800,
      );
    });
  });

  describe('deleteCart', () => {
    it('should call redis.del with correct key', async () => {
      await service.deleteCart(customerId);
      expect(redisClient.del).toHaveBeenCalledWith(`cart:${customerId}`);
    });
  });

  // ---------------------------------------------------------------
  // syncCart / getPricedCart — CHK-01, server prices on every read
  // ---------------------------------------------------------------

  describe('syncCart', () => {
    // The merge rule: the incoming cart is authoritative on every explicit
    // sync; the stored cart is read only for the login merge (an empty `items`
    // with no `channel` and no `deliveryAddressId`).

    it('shrinks the stored cart when the client sends fewer lines', async () => {
      const existing = {
        items: [
          {
            productId: 'm1',
            name: 'A',
            quantity: 1,
            unitPrice: 100,
            imageUrl: null,
          },
          {
            productId: 'm2',
            name: 'B',
            quantity: 1,
            unitPrice: 200,
            imageUrl: null,
          },
        ],
        channel: 'takeaway' as const,
        deliveryAddressId: null,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      redisClient.get.mockResolvedValue(JSON.stringify(existing));
      pricingService.price.mockResolvedValue(
        pricedCart([line({ product_id: 'm1', quantity: 1 })]),
      );

      const local = {
        items: [{ productId: 'm1', name: 'A', quantity: 1, unitPrice: 100 }],
        channel: 'takeaway' as const,
        deliveryAddressId: null,
      };

      const result = await service.syncCart(customerId, local as any);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('m1');
      // …and the shrink is what was written back, not just what was returned.
      const written = JSON.parse(redisClient.set.mock.calls.at(-1)![1]);
      expect(written.items).toHaveLength(1);
      expect(written.items[0].productId).toBe('m1');
    });

    it('removes the last line — an empty cart is a storable state', async () => {
      redisClient.get.mockResolvedValue(
        JSON.stringify({
          items: [
            {
              productId: 'm1',
              name: 'A',
              quantity: 1,
              unitPrice: 100,
              imageUrl: null,
            },
          ],
          channel: 'delivery' as const,
          deliveryAddressId: null,
          updatedAt: '2026-01-01T00:00:00Z',
        }),
      );
      pricingService.price.mockResolvedValue(pricedCart([]));

      const result = await service.syncCart(customerId, {
        items: [],
        channel: 'delivery' as const,
      } as any);

      expect(result.items).toHaveLength(0);
      const written = JSON.parse(redisClient.set.mock.calls.at(-1)![1]);
      expect(written.items).toHaveLength(0);
    });

    it('persists a channel-only change against an unchanged item list', async () => {
      const items = [
        {
          productId: 'm1',
          name: 'A',
          quantity: 1,
          unitPrice: 100,
          imageUrl: null,
        },
      ];
      redisClient.get.mockResolvedValue(
        JSON.stringify({
          items,
          channel: 'delivery' as const,
          deliveryAddressId: null,
          updatedAt: '2026-01-01T00:00:00Z',
        }),
      );
      pricingService.price.mockResolvedValue(
        pricedCart([line({ product_id: 'm1', quantity: 1 })]),
      );

      const result = await service.syncCart(customerId, {
        items: [{ productId: 'm1', name: 'A', quantity: 1, unitPrice: 100 }],
        channel: 'takeaway' as const,
      } as any);

      expect(result.channel).toBe('takeaway');
      const written = JSON.parse(redisClient.set.mock.calls.at(-1)![1]);
      expect(written.channel).toBe('takeaway');
    });

    it('persists an address-only change against an unchanged item list', async () => {
      redisClient.get.mockResolvedValue(
        JSON.stringify({
          items: [
            {
              productId: 'm1',
              name: 'A',
              quantity: 1,
              unitPrice: 100,
              imageUrl: null,
            },
          ],
          channel: 'delivery' as const,
          deliveryAddressId: null,
          updatedAt: '2026-01-01T00:00:00Z',
        }),
      );
      pricingService.price.mockResolvedValue(
        pricedCart([line({ product_id: 'm1', quantity: 1 })]),
      );

      const result = await service.syncCart(customerId, {
        items: [{ productId: 'm1', name: 'A', quantity: 1, unitPrice: 100 }],
        channel: 'delivery' as const,
        deliveryAddressId: 'addr-9',
      } as any);

      expect(result.deliveryAddressId).toBe('addr-9');
      const written = JSON.parse(redisClient.set.mock.calls.at(-1)![1]);
      expect(written.deliveryAddressId).toBe('addr-9');
    });

    it('restores the stored cart on a login merge — empty items, nothing else said', async () => {
      const existing = {
        items: [
          {
            productId: 'm1',
            name: 'A',
            quantity: 1,
            unitPrice: 100,
            imageUrl: null,
          },
          {
            productId: 'm2',
            name: 'B',
            quantity: 1,
            unitPrice: 200,
            imageUrl: null,
          },
        ],
        channel: 'takeaway' as const,
        deliveryAddressId: 'addr-1',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      redisClient.get.mockResolvedValue(JSON.stringify(existing));
      pricingService.price.mockResolvedValue(
        pricedCart([
          line({ product_id: 'm1', quantity: 1 }),
          line({ product_id: 'm2', quantity: 1 }),
        ]),
      );

      const result = await service.syncCart(customerId, { items: [] } as any);

      expect(result.items).toHaveLength(2);
      expect(result.channel).toBe('takeaway');
      expect(result.deliveryAddressId).toBe('addr-1');
      // Rewritten so the 7-day TTL rolls forward on login.
      const written = JSON.parse(redisClient.set.mock.calls.at(-1)![1]);
      expect(written.items).toHaveLength(2);
    });

    it('an empty login merge with nothing stored yields an empty cart', async () => {
      redisClient.get.mockResolvedValue(null);
      pricingService.price.mockResolvedValue(pricedCart([]));

      const result = await service.syncCart(customerId, { items: [] } as any);

      expect(result.items).toHaveLength(0);
      expect(result.channel).toBeNull();
    });

    it('grows the stored cart when the client sends more lines', async () => {
      const existing = {
        items: [
          {
            productId: 'm1',
            name: 'A',
            quantity: 1,
            unitPrice: 100,
            imageUrl: null,
          },
        ],
        channel: 'takeaway' as const,
        deliveryAddressId: null,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      redisClient.get.mockResolvedValue(JSON.stringify(existing));

      const local = {
        items: [
          { productId: 'm1', name: 'A', quantity: 1, unitPrice: 100 },
          { productId: 'm2', name: 'B', quantity: 1, unitPrice: 200 },
          { productId: 'm3', name: 'C', quantity: 1, unitPrice: 300 },
        ],
        channel: 'delivery' as const,
        deliveryAddressId: 'addr-1',
      };

      const result = await service.syncCart(customerId, local as any);
      expect(result.items).toHaveLength(3);
    });

    it('overwrites the client price with the server price and adds totals', async () => {
      redisClient.get.mockResolvedValue(null);
      pricingService.price.mockResolvedValue(
        pricedCart([line({ product_id: 'm1', quantity: 2 })]),
      );

      const result = await service.syncCart(customerId, {
        items: [
          {
            productId: 'm1',
            name: 'Stale name',
            quantity: 2,
            unitPrice: 1, // the client's cached price is a lie
          },
        ],
        channel: 'delivery' as const,
      } as any);

      expect(result.items[0]).toEqual({
        productId: 'm1',
        variantId: null,
        name: 'Konma Signature Thali',
        quantity: 2,
        unitPrice: 450,
        imageUrl: null,
        fulfilment: FulfilmentType.local,
        available: true,
        unavailable_reason: null,
      });
      expect(result.totals).toEqual({ subtotal: 900, tax_total: 42.86 });
    });

    it('flags a rejected line as unavailable and carries its reason', async () => {
      redisClient.get.mockResolvedValue(null);
      pricingService.price.mockResolvedValue(
        pricedCart(
          [line({ product_id: 'm1' })],
          [
            {
              product_id: 'm2',
              variant_id: null,
              name: 'Linen Apron',
              reason: 'Only 0 left',
            },
          ],
        ),
      );

      const result = await service.syncCart(customerId, {
        items: [
          { productId: 'm1', name: 'A', quantity: 2, unitPrice: 450 },
          { productId: 'm2', name: 'Linen Apron', quantity: 1, unitPrice: 799 },
        ],
        channel: 'delivery' as const,
      } as any);

      expect(result.items[1]).toMatchObject({
        productId: 'm2',
        available: false,
        unavailable_reason: 'Only 0 left',
        fulfilment: null,
        unitPrice: 799, // the client's own price, since the server has none to give
      });
      // A rejected line contributes nothing to the totals.
      expect(result.totals.subtotal).toBe(900);
    });

    it('matches a line whose default variant the server resolved for it', async () => {
      redisClient.get.mockResolvedValue(null);
      pricingService.price.mockResolvedValue(
        pricedCart([
          line({
            product_id: 'm1',
            variant_id: 'var-default',
            name: 'Coconut Oil — 500 ml',
            quantity: 1,
            unit_price: 64900,
            gross: 64900,
          }),
        ]),
      );

      const result = await service.syncCart(customerId, {
        items: [
          // No variantId — the pricer picks the product's default.
          { productId: 'm1', name: 'Coconut Oil', quantity: 1, unitPrice: 649 },
        ],
        channel: 'delivery' as const,
      } as any);

      expect(result.items[0]).toMatchObject({
        available: true,
        variantId: 'var-default',
        unitPrice: 649,
      });
    });
  });

  describe('getPricedCart', () => {
    it('returns an empty priced cart when Redis holds nothing', async () => {
      redisClient.get.mockResolvedValue(null);

      const result = await service.getPricedCart(customerId);

      expect(result.items).toEqual([]);
      expect(result.totals).toEqual({ subtotal: 0, tax_total: 0 });
    });
  });

  // ---------------------------------------------------------------
  // createOrderFromQuote — CHK-03
  // ---------------------------------------------------------------

  describe('createOrderFromQuote', () => {
    const quoteId = '11111111-2222-4333-8444-555555555555';

    function storedQuote(overrides: Partial<StoredQuote> = {}): StoredQuote {
      return {
        v: 2,
        quote_id: quoteId,
        customer_id: customerId,
        created_at: '2026-08-24T06:00:00.000Z',
        expires_at: new Date(Date.now() + 900_000).toISOString(),
        channel: OrderChannel.delivery,
        delivery_address_id: 'addr-1',
        pickup: false,
        lines: [line()],
        holds: [],
        subtotal: 90000,
        discount_amount: 20000,
        coupon: {
          id: 'coup-1',
          code: 'WELCOME10',
          type: 'percent',
          discount: 20000,
        },
        shipping_amount: 7900,
        shipping: null,
        tax_amount: 4286,
        tax_breakup: [],
        loyalty_points_redeemed: 100,
        loyalty_redeem_amount: 2500,
        loyalty_points_earned_estimate: 30,
        total: 75400,
        ...overrides,
      };
    }

    /** Redis: the quote key resolves, the cart key does not. */
    function withQuote(quote: StoredQuote | null) {
      redisClient.get.mockImplementation((key: string) =>
        Promise.resolve(
          key === `quote:${customerId}:${quoteId}` && quote
            ? JSON.stringify(quote)
            : null,
        ),
      );
    }

    beforeEach(() => {
      razorpayService.createOrder.mockResolvedValue({ id: 'order_Xyz' });
      pricingService.price.mockResolvedValue(pricedCart([line()]));
    });

    it('reads quote:{customerId}:{quoteId} and charges the quoted total, in paise', async () => {
      withQuote(storedQuote());

      const result = await service.createOrderFromQuote(customerId, {
        quote_id: quoteId,
        idempotency_key: 'idem-abc123',
      });

      expect(redisClient.get).toHaveBeenCalledWith(
        `quote:${customerId}:${quoteId}`,
      );
      // Exactly the frozen total — no rounding, no re-derivation.
      expect(razorpayService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 75400,
          notes: { type: 'marketplace', entity_id: customerId },
        }),
      );
      expect(result).toEqual({
        razorpay_order_id: 'order_Xyz',
        amount: 75400,
        currency: 'INR',
        key_id: process.env.RAZORPAY_KEY_ID || null,
        quote_id: quoteId,
      });
    });

    it('writes a v2 pending order that round-trips, and spends the quote', async () => {
      withQuote(storedQuote());

      await service.createOrderFromQuote(customerId, { quote_id: quoteId });

      const [key, payload, ex, ttl] = redisClient.set.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          (call[0] as string).startsWith('pending_order:'),
      )!;
      expect(key).toBe('pending_order:order_Xyz');
      expect(ex).toBe('EX');
      expect(ttl).toBe(1800);

      const pending = JSON.parse(payload as string);
      expect(pending).toMatchObject({
        v: 2,
        razorpay_order_id: 'order_Xyz',
        idempotency_key: quoteId, // defaults to the quote id
        customer_id: customerId,
        subtotal: 90000,
        discount_amount: 20000,
        shipping_amount: 7900,
        loyalty_redeem_amount: 2500,
        total: 75400,
      });
      // The two quote-only fields do not survive into the pending record.
      expect(pending.quote_id).toBeUndefined();
      expect(pending.expires_at).toBeUndefined();

      expect(redisClient.del).toHaveBeenCalledWith(
        `quote:${customerId}:${quoteId}`,
      );
    });

    it('throws 404 when the quote is gone', async () => {
      withQuote(null);

      await expect(
        service.createOrderFromQuote(customerId, { quote_id: quoteId }),
      ).rejects.toThrow(NotFoundException);
      expect(razorpayService.createOrder).not.toHaveBeenCalled();
    });

    it('throws 410 when the stored quote outlived its own expires_at', async () => {
      withQuote(
        storedQuote({
          expires_at: new Date(Date.now() - 1000).toISOString(),
        }),
      );

      await expect(
        service.createOrderFromQuote(customerId, { quote_id: quoteId }),
      ).rejects.toThrow(GoneException);
      expect(razorpayService.createOrder).not.toHaveBeenCalled();
    });

    it('refuses to charge when a price moved between quote and pay', async () => {
      withQuote(storedQuote());
      pricingService.price.mockResolvedValue(
        pricedCart([line({ unit_price: 47500, gross: 95000 })]),
      );

      await expect(
        service.createOrderFromQuote(customerId, { quote_id: quoteId }),
      ).rejects.toThrow(/price of "Konma Signature Thali" changed/);
      expect(razorpayService.createOrder).not.toHaveBeenCalled();
    });

    it('refuses to charge when a quoted line has left the catalog', async () => {
      withQuote(storedQuote());
      pricingService.price.mockResolvedValue(pricedCart([]));

      await expect(
        service.createOrderFromQuote(customerId, { quote_id: quoteId }),
      ).rejects.toThrow(/no longer available/);
      expect(razorpayService.createOrder).not.toHaveBeenCalled();
    });

    it('refuses to charge when the cart no longer holds the quoted quantity', async () => {
      withQuote(storedQuote());
      pricingService.price.mockResolvedValue(
        pricedCart([line({ quantity: 1, gross: 45000 })]),
      );

      await expect(
        service.createOrderFromQuote(customerId, { quote_id: quoteId }),
      ).rejects.toThrow(/Only 1 of "Konma Signature Thali" left/);
    });

    it('rejects a quote on a channel the marketplace cannot sell (D-04)', async () => {
      withQuote(storedQuote({ channel: OrderChannel.dine_in }));

      await expect(
        service.createOrderFromQuote(customerId, { quote_id: quoteId }),
      ).rejects.toThrow(/takeaway or delivery/);
    });

    it('rejects a quote with nothing left to pay rather than sending 0 to Razorpay', async () => {
      withQuote(storedQuote({ total: 0 }));

      await expect(
        service.createOrderFromQuote(customerId, { quote_id: quoteId }),
      ).rejects.toThrow(/nothing left to pay/);
      expect(razorpayService.createOrder).not.toHaveBeenCalled();
    });

    it('throws 503 and creates no Razorpay order when Redis is down', async () => {
      redisService.getClient.mockReturnValue(null);

      await expect(
        service.createOrderFromQuote(customerId, { quote_id: quoteId }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(razorpayService.createOrder).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // confirmOrder
  // ---------------------------------------------------------------

  describe('confirmOrder', () => {
    const dto = {
      razorpay_order_id: 'order_rzp123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'sig_123',
    };

    /** A v2 pending record as `createOrderFromQuote` writes it. Money is paise. */
    const pendingData = {
      v: 2 as const,
      razorpay_order_id: 'order_rzp123',
      idempotency_key: 'idem-abc123',
      customer_id: customerId,
      created_at: '2026-08-24T06:00:00.000Z',
      channel: 'takeaway',
      delivery_address_id: null,
      pickup: false,
      lines: [
        line({
          product_id: 'm1',
          name: 'Burger',
          unit_price: 15000,
          gross: 30000,
          tax: 0,
          tax_rate: '0.00',
        }),
      ],
      holds: [],
      subtotal: 30000,
      discount_amount: 0,
      coupon: null,
      shipping_amount: 0,
      shipping: null,
      tax_amount: 0,
      tax_breakup: [],
      loyalty_points_redeemed: 0,
      loyalty_redeem_amount: 0,
      loyalty_points_earned_estimate: 0,
      total: 30000,
    };

    /** The pre-P5a payload `checkoutCart` used to write — rupee floats, no `v`. */
    const v1PendingData = {
      customerId,
      cart: {
        items: [
          {
            productId: 'm1',
            name: 'Burger',
            quantity: 2,
            unitPrice: 150,
            imageUrl: null,
          },
        ],
        channel: 'takeaway',
        deliveryAddressId: null,
      },
      subtotal: 300,
      modifierAmount: 0,
      total: 300,
      channel: 'takeaway',
      deliveryAddressId: null,
    };

    it('verifies signature, consumes the pending key, confirms via FulfilmentService, clears cart, triggers Pusher', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify(pendingData));
      redisClient.getdel.mockResolvedValue(JSON.stringify(pendingData));
      razorpayService.verifyPaymentSignature.mockReturnValue(true);
      razorpayService.fetchPayment.mockResolvedValue({
        status: 'captured',
        amount: 30000,
      });
      const createdOrder = {
        id: 'ord-1',
        order_number: 42,
        status: 'placed',
        customer_id: customerId,
        items: [],
        payment: { id: 'pay-1' },
      };
      fulfilmentService.confirmPaidOrder.mockResolvedValue(createdOrder);

      const result = await service.confirmOrder(customerId, dto);

      expect(result).toEqual(createdOrder);
      expect(razorpayService.verifyPaymentSignature).toHaveBeenCalledWith(
        dto.razorpay_order_id,
        dto.razorpay_payment_id,
        dto.razorpay_signature,
      );
      expect(redisClient.getdel).toHaveBeenCalledWith(
        'pending_order:order_rzp123',
      );
      expect(fulfilmentService.confirmPaidOrder).toHaveBeenCalledWith({
        customerId,
        razorpayOrderId: 'order_rzp123',
        razorpayPaymentId: 'pay_123',
        pending: pendingData,
        placedVia: 'storefront',
      });
      // The frozen payload reaches fulfilment as v2, in paise.
      const handed =
        fulfilmentService.confirmPaidOrder.mock.calls[0][0].pending;
      expect(handed.v).toBe(2);
      expect(handed.total).toBe(30000);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(redisClient.del).toHaveBeenCalledWith(`cart:${customerId}`);
      expect(pusherService.trigger).toHaveBeenCalledWith(
        `private-customer-${customerId}`,
        'order.placed',
        expect.objectContaining({ orderId: 'ord-1', status: 'placed' }),
      );
    });

    it('returns the existing order when another caller consumed the pending key first (GETDEL race)', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify(pendingData));
      redisClient.getdel.mockResolvedValue(null);
      razorpayService.verifyPaymentSignature.mockReturnValue(true);
      razorpayService.fetchPayment.mockResolvedValue({
        status: 'captured',
        amount: 30000,
      });
      const existing = { id: 'ord-1', customer_id: customerId };
      fulfilmentService.findOrderByRazorpayPaymentId.mockResolvedValue(
        existing,
      );

      const result = await service.confirmOrder(customerId, dto);

      expect(result).toEqual(existing);
      expect(redisClient.getdel).toHaveBeenCalledWith(
        'pending_order:order_rzp123',
      );
      expect(
        fulfilmentService.findOrderByRazorpayPaymentId,
      ).toHaveBeenCalledWith('pay_123');
      expect(fulfilmentService.confirmPaidOrder).not.toHaveBeenCalled();
    });

    it('returns the webhook-created order when the pending key is already gone', async () => {
      redisClient.get.mockResolvedValue(null);
      const existing = { id: 'ord-1', customer_id: customerId };
      fulfilmentService.findOrderByRazorpayPaymentId.mockResolvedValue(
        existing,
      );

      const result = await service.confirmOrder(customerId, dto);

      expect(result).toEqual(existing);
      expect(fulfilmentService.confirmPaidOrder).not.toHaveBeenCalled();
    });

    it('restores the pending key when confirmPaidOrder throws', async () => {
      const raw = JSON.stringify(pendingData);
      redisClient.get.mockResolvedValue(raw);
      redisClient.getdel.mockResolvedValue(raw);
      razorpayService.verifyPaymentSignature.mockReturnValue(true);
      razorpayService.fetchPayment.mockResolvedValue({
        status: 'captured',
        amount: 30000,
      });
      fulfilmentService.confirmPaidOrder.mockRejectedValue(new Error('boom'));

      await expect(service.confirmOrder(customerId, dto)).rejects.toThrow(
        'boom',
      );
      expect(redisClient.set).toHaveBeenCalledWith(
        'pending_order:order_rzp123',
        raw,
        'EX',
        1800,
        'NX',
      );
    });

    it('does NOT restore the pending key when the payment was refused and refunded', async () => {
      const raw = JSON.stringify(pendingData);
      redisClient.get.mockResolvedValue(raw);
      redisClient.getdel.mockResolvedValue(raw);
      razorpayService.verifyPaymentSignature.mockReturnValue(true);
      razorpayService.fetchPayment.mockResolvedValue({
        status: 'captured',
        amount: 30000,
      });
      fulfilmentService.confirmPaidOrder.mockRejectedValue(
        new OrderRefusedAndRefundedException({
          order_id: 'ord-refused',
          refund_id: 'rf-1',
          refunded: true,
          lines: [],
        }),
      );

      // 409 — the customer did nothing wrong, the seat went.
      await expect(service.confirmOrder(customerId, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      // Restoring it would let the webhook fallback re-attempt an order that
      // can never exist, against a payment that has already gone back.
      expect(redisClient.set).not.toHaveBeenCalledWith(
        'pending_order:order_rzp123',
        raw,
        'EX',
        1800,
        'NX',
      );
      expect(redisClient.del).toHaveBeenCalledWith(`cart:${customerId}`);
    });

    it('confirms a pre-P5a v1 pending record, upgraded in memory', async () => {
      const raw = JSON.stringify(v1PendingData);
      redisClient.get.mockResolvedValue(raw);
      redisClient.getdel.mockResolvedValue(raw);
      razorpayService.verifyPaymentSignature.mockReturnValue(true);
      razorpayService.fetchPayment.mockResolvedValue({
        status: 'captured',
        amount: 30000, // ₹300 — the v1 float total, now compared in paise
      });
      fulfilmentService.confirmPaidOrder.mockResolvedValue({
        id: 'ord-1',
        order_number: 42,
        customer_id: customerId,
      });

      await service.confirmOrder(customerId, dto);

      const handed =
        fulfilmentService.confirmPaidOrder.mock.calls[0][0].pending;
      expect(handed).toMatchObject({
        v: 2,
        customer_id: customerId,
        channel: 'takeaway',
        subtotal: 30000,
        total: 30000,
        discount_amount: 0,
        shipping_amount: 0,
        loyalty_points_redeemed: 0,
      });
      expect(handed.lines).toHaveLength(1);
      expect(handed.lines[0]).toMatchObject({
        product_id: 'm1',
        unit_price: 15000,
        gross: 30000,
        fulfilment: FulfilmentType.local,
      });
    });

    it('should throw ForbiddenException when customerId mismatch', async () => {
      redisClient.get.mockResolvedValue(
        JSON.stringify({ ...pendingData, customer_id: 'other-customer' }),
      );

      await expect(service.confirmOrder(customerId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a payment whose amount is not the frozen paise total', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify(pendingData));
      razorpayService.verifyPaymentSignature.mockReturnValue(true);
      razorpayService.fetchPayment.mockResolvedValue({
        status: 'captured',
        amount: 29900,
      });

      await expect(service.confirmOrder(customerId, dto)).rejects.toThrow(
        'Payment amount mismatch',
      );
      expect(redisClient.getdel).not.toHaveBeenCalled();
    });

    it('should throw when payment signature invalid', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify(pendingData));
      razorpayService.verifyPaymentSignature.mockReturnValue(false);

      await expect(service.confirmOrder(customerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when pending order not found', async () => {
      redisClient.get.mockResolvedValue(null);

      await expect(service.confirmOrder(customerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------------------------------------------------------------
  // getOrderById
  // ---------------------------------------------------------------

  describe('getOrderById', () => {
    it('should return order when customer_id matches', async () => {
      const order = {
        id: 'ord-1',
        customer_id: customerId,
        items: [],
        payment: null,
      };
      prisma.order.findUnique.mockResolvedValue(order);

      const result = await service.getOrderById(customerId, 'ord-1');
      expect(result).toEqual(order);
    });

    it('should throw ForbiddenException when customer_id mismatch', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customer_id: 'other-customer',
        items: [],
      });

      await expect(service.getOrderById(customerId, 'ord-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrderById(customerId, 'ord-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------
  // Address CRUD
  // ---------------------------------------------------------------

  // ---------------------------------------------------------------
  // getOrderShipment — SHIP-05
  // ---------------------------------------------------------------

  describe('getOrderShipment', () => {
    it('returns the shipment with its events newest first', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customer_id: customerId,
      });
      const shipment = { id: 'shp-1', status: 'in_transit', events: [] };
      prisma.shipment.findUnique.mockResolvedValue(shipment);

      const result = await service.getOrderShipment(customerId, 'ord-1');

      expect(result).toEqual(shipment);
      expect(prisma.shipment.findUnique).toHaveBeenCalledWith({
        where: { order_id: 'ord-1' },
        include: { events: { orderBy: { occurred_at: 'desc' } } },
      });
    });

    it('returns null when the order has no shipped lines', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customer_id: customerId,
      });
      prisma.shipment.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderShipment(customerId, 'ord-1'),
      ).resolves.toBeNull();
    });

    it('throws ForbiddenException for another customer’s order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customer_id: 'other-customer',
      });

      await expect(
        service.getOrderShipment(customerId, 'ord-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.shipment.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderShipment(customerId, 'ord-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createAddress', () => {
    it('should set is_default=true for first address', async () => {
      prisma.customerAddress.count.mockResolvedValue(0);
      prisma.customerAddress.create.mockResolvedValue({
        id: 'addr-1',
        is_default: true,
      });

      await service.createAddress(customerId, {
        label: 'Home',
        address: '123 Main St',
        pincode: '560001',
      } as any);

      expect(prisma.customerAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_default: true }),
        }),
      );
    });

    it('should not set is_default for subsequent addresses', async () => {
      prisma.customerAddress.count.mockResolvedValue(2);
      prisma.customerAddress.create.mockResolvedValue({
        id: 'addr-2',
        is_default: false,
      });

      await service.createAddress(customerId, {
        label: 'Work',
        address: '456 Office Blvd',
        pincode: '560002',
      } as any);

      expect(prisma.customerAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_default: false }),
        }),
      );
    });
  });

  describe('listAddresses', () => {
    it('should return addresses for customer', async () => {
      const addresses = [
        { id: 'addr-1', is_default: true },
        { id: 'addr-2', is_default: false },
      ];
      prisma.customerAddress.findMany.mockResolvedValue(addresses);

      const result = await service.listAddresses(customerId);
      expect(result).toEqual(addresses);
      expect(prisma.customerAddress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customer_id: customerId },
        }),
      );
    });
  });

  describe('deleteAddress', () => {
    it('should promote next address when deleting default', async () => {
      prisma.customerAddress.findFirst
        .mockResolvedValueOnce({
          id: 'addr-1',
          is_default: true,
          customer_id: customerId,
        })
        .mockResolvedValueOnce({ id: 'addr-2', is_default: false });
      prisma.customerAddress.delete.mockResolvedValue({});
      prisma.customerAddress.update.mockResolvedValue({});

      await service.deleteAddress(customerId, 'addr-1');

      expect(prisma.customerAddress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'addr-2' },
          data: { is_default: true },
        }),
      );
    });

    it('should throw NotFoundException for non-existent address', async () => {
      prisma.customerAddress.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteAddress(customerId, 'addr-999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------
  // Receipt generation
  // ---------------------------------------------------------------

  describe('generateOrderReceipt', () => {
    it('should throw ForbiddenException when customer_id mismatch', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customer_id: 'other-customer',
        items: [],
      });

      await expect(
        service.generateOrderReceipt(customerId, 'ord-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.generateOrderReceipt(customerId, 'ord-999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return HTML string for valid order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customer_id: customerId,
        order_number: 42,
        channel: 'takeaway',
        created_at: new Date('2026-01-15T10:00:00Z'),
        subtotal: 300,
        channel_modifier_amount: 0,
        total: 300,
        delivery_address: null,
        items: [
          { product: { name: 'Burger' }, quantity: 2, unit_price: 150 },
        ],
        payment: { method: 'razorpay', razorpay_payment_id: 'pay_123' },
        customer: { name: 'Test User', phone: '9876543210' },
      });

      const html = await service.generateOrderReceipt(customerId, 'ord-1');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Konma Xperience');
      expect(html).toContain('#42');
      expect(html).toContain('Burger');
    });
  });

  describe('generateBookingReceipt', () => {
    it('should throw ForbiddenException when customer_id mismatch', async () => {
      prisma.eventBooking.findUnique.mockResolvedValue({
        id: 'book-1',
        customer_id: 'other-customer',
      });

      await expect(
        service.generateBookingReceipt(customerId, 'book-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
