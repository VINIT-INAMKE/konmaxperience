import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BookingStatus,
  CouponType,
  FulfilmentType,
  LoyaltyTier,
  OrderChannel,
  ProductType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../customer-auth/redis.service';
import { SettingsService } from '../settings/settings.service';
import { CouponsService } from '../promotions/coupons.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { ShippingProviderResolver } from '../shipping/shipping-provider.resolver';
import {
  mockPrisma,
  mockRedis,
  mockSettings,
  mockShippingProvider,
  type MockPrisma,
} from '../test-utils/mock-providers';
import { CartPricingService, type CartLineInput } from './cart-pricing.service';
import { ServiceabilityService } from './serviceability.service';
import { CheckoutService, toQuoteResponse } from './checkout.service';
import type { PricedCart, PricedLine, TaxBucket } from './quote.types';
import { QuoteCheckoutDto } from './dto/quote-checkout.dto';

const CUSTOMER = 'c0000000-0000-4000-8000-000000000001';
const ADDRESS = 'a0000000-0000-4000-8000-000000000001';
const EVENT = 'e0000000-0000-4000-8000-000000000001';

// ---------------------------------------------------------------
// Fixtures — every money field is integer paise.
// ---------------------------------------------------------------

/** A `prepared_food` / `local` line: ₹450 × 2, 5% inclusive GST. */
function line(over: Partial<PricedLine> = {}): PricedLine {
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
    ...over,
  };
}

/** A `packaged` / `shipped` line: ₹649 × 1, 550 g, 12% inclusive GST. */
function shippedLine(over: Partial<PricedLine> = {}): PricedLine {
  return line({
    product_id: 'p2',
    name: 'Cold-Pressed Coconut Oil — 500 ml',
    sku: 'KX-OIL-500',
    quantity: 1,
    type: ProductType.packaged,
    fulfilment: FulfilmentType.shipped,
    unit_price: 64900,
    gross: 64900,
    tax_rate: '12.00',
    tax: 6954,
    weight_grams: 550,
    hsn_code: '15131100',
    ...over,
  });
}

/** An `experience` / `booking` line: ₹2500 × 2 against `EVENT`. */
function bookingLine(over: Partial<PricedLine> = {}): PricedLine {
  return line({
    product_id: 'p3',
    name: "Chef's Table Dinner",
    quantity: 2,
    type: ProductType.experience,
    fulfilment: FulfilmentType.booking,
    unit_price: 250000,
    gross: 500000,
    tax: 23810,
    event_id: EVENT,
    ...over,
  });
}

/** Derives every `PricedCart` rollup from its lines, exactly as Task 5 does. */
function priced(
  lines: PricedLine[],
  over: Partial<PricedCart> = {},
): PricedCart {
  const byRate = new Map<string, TaxBucket>();
  for (const l of lines) {
    const bucket = byRate.get(l.tax_rate) ?? {
      rate: l.tax_rate,
      taxable: 0,
      tax: 0,
    };
    bucket.taxable += l.gross - l.tax;
    bucket.tax += l.tax;
    byRate.set(l.tax_rate, bucket);
  }
  return {
    lines,
    subtotal: lines.reduce((sum, l) => sum + l.gross, 0),
    tax_total: lines.reduce((sum, l) => sum + l.tax, 0),
    tax_breakup: [...byRate.values()],
    channel: OrderChannel.delivery,
    channel_modifier: 0,
    has_local: lines.some((l) => l.fulfilment === FulfilmentType.local),
    has_shipped: lines.some((l) => l.fulfilment === FulfilmentType.shipped),
    has_booking: lines.some((l) => l.fulfilment === FulfilmentType.booking),
    shipped_weight_grams: lines
      .filter((l) => l.fulfilment === FulfilmentType.shipped)
      .reduce((sum, l) => sum + l.weight_grams * l.quantity, 0),
    rejected: [],
    ...over,
  };
}

const CART: CartLineInput[] = [{ productId: 'p1', quantity: 2 }];
const DTO: QuoteCheckoutDto = { channel: OrderChannel.delivery };

describe('CheckoutService', () => {
  let service: CheckoutService;
  let prisma: MockPrisma;
  let redis: ReturnType<typeof mockRedis>;
  let settings: ReturnType<typeof mockSettings>;
  let pricing: { price: jest.Mock };
  let coupons: { evaluate: jest.Mock; validate: jest.Mock };
  let loyalty: { previewRedeem: jest.Mock; earnEstimate: jest.Mock };
  let provider: ReturnType<typeof mockShippingProvider>;
  let resolver: { get: jest.Mock; settings: jest.Mock };
  let savedPincodesEnv: string | undefined;

  beforeEach(async () => {
    // `ServiceabilityService` falls back to this env var when the setting is
    // empty; pin it so a developer's shell cannot change a test's verdict.
    savedPincodesEnv = process.env.DELIVERY_PINCODES;
    delete process.env.DELIVERY_PINCODES;

    prisma = mockPrisma();
    redis = mockRedis();
    settings = mockSettings();
    pricing = { price: jest.fn().mockResolvedValue(priced([line()])) };
    coupons = { evaluate: jest.fn(), validate: jest.fn() };
    loyalty = {
      previewRedeem: jest.fn().mockResolvedValue({
        balance: 0,
        tier: LoyaltyTier.member,
        max_redeemable_points: 0,
        points_applied: 0,
        redeem_amount: 0,
        redeem_value_per_point: 0.25,
      }),
      earnEstimate: jest.fn().mockResolvedValue(0),
    };
    provider = mockShippingProvider();
    resolver = {
      get: jest.fn().mockResolvedValue(provider),
      settings: jest.fn().mockResolvedValue({}),
    };

    prisma.customerAddress.findFirst.mockResolvedValue({
      id: ADDRESS,
      pincode: '600131',
    });
    prisma.customer.findUnique.mockResolvedValue({
      name: 'Aditi R.',
      phone: '+919000000001',
    });
    prisma.eventBooking.deleteMany.mockResolvedValue({ count: 0 });
    prisma.eventBooking.create.mockResolvedValue({ id: 'booking-1' });
    redis.client.setex.mockResolvedValue('OK');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        ServiceabilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: SettingsService, useValue: settings },
        { provide: CartPricingService, useValue: pricing },
        { provide: CouponsService, useValue: coupons },
        { provide: LoyaltyService, useValue: loyalty },
        { provide: ShippingProviderResolver, useValue: resolver },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  afterEach(() => {
    if (savedPincodesEnv === undefined) delete process.env.DELIVERY_PINCODES;
    else process.env.DELIVERY_PINCODES = savedPincodesEnv;
  });

  // ─── guards ───────────────────────────────────────────────────────────────

  it('rejects an empty cart before pricing anything', async () => {
    await expect(service.quote(CUSTOMER, [], DTO)).rejects.toThrow(
      new BadRequestException('Cart is empty'),
    );
    expect(pricing.price).not.toHaveBeenCalled();
  });

  it('rejects a cart whose every line was rejected, listing the reasons', async () => {
    pricing.price.mockResolvedValue(
      priced([], {
        rejected: [
          {
            product_id: 'p9',
            variant_id: null,
            name: 'Linen Apron',
            reason: 'Only 0 left',
          },
          {
            product_id: 'p8',
            variant_id: null,
            name: 'Beach Picnic',
            reason: 'Sold out',
          },
        ],
      }),
    );

    await expect(service.quote(CUSTOMER, CART, DTO)).rejects.toThrow(
      'Nothing in your cart is available: Linen Apron — Only 0 left; Beach Picnic — Sold out',
    );
    expect(redis.client.setex).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when Redis is unavailable, before any side effect', async () => {
    redis.getClient.mockReturnValue(null);

    await expect(service.quote(CUSTOMER, CART, DTO)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(pricing.price).not.toHaveBeenCalled();
    expect(prisma.eventBooking.create).not.toHaveBeenCalled();
  });

  // ─── local serviceability ─────────────────────────────────────────────────

  it('refuses local lines going to an unserviced pincode', async () => {
    settings.get.mockImplementation((key: string) =>
      Promise.resolve(key === 'delivery_pincodes' ? ['600131'] : {}),
    );
    prisma.customerAddress.findFirst.mockResolvedValue({
      id: ADDRESS,
      pincode: '110001',
    });

    await expect(service.quote(CUSTOMER, CART, DTO)).rejects.toThrow(
      "Sorry, we don't deliver to this pincode yet",
    );
  });

  it('lets pickup bypass the pincode allow-list entirely', async () => {
    settings.get.mockImplementation((key: string) =>
      Promise.resolve(key === 'delivery_pincodes' ? ['600131'] : {}),
    );
    prisma.customerAddress.findFirst.mockResolvedValue({
      id: ADDRESS,
      pincode: '110001',
    });

    const { quote } = await service.quote(CUSTOMER, CART, {
      ...DTO,
      pickup: true,
    });

    expect(quote.pickup).toBe(true);
    expect(quote.total).toBe(90000);
  });

  it('rejects a delivery address that belongs to someone else', async () => {
    prisma.customerAddress.findFirst.mockResolvedValue(null);

    await expect(
      service.quote(CUSTOMER, CART, { ...DTO, delivery_address_id: ADDRESS }),
    ).rejects.toThrow('Delivery address not found');
  });

  // ─── shipping ─────────────────────────────────────────────────────────────

  it('asks the provider once with the summed shipped weight and takes its rate', async () => {
    // Two bottles: 550 g each, ₹649 each.
    pricing.price.mockResolvedValue(
      priced([shippedLine({ quantity: 2, gross: 129800, tax: 13907 })]),
    );
    provider.checkServiceability.mockResolvedValue({
      serviceable: true,
      rate: 7900,
      courier_name: 'Delhivery',
      courier_id: '12',
      etd: new Date('2026-08-27T18:00:00.000Z'),
    });

    const { quote } = await service.quote(CUSTOMER, CART, DTO);

    expect(provider.checkServiceability).toHaveBeenCalledTimes(1);
    expect(provider.checkServiceability).toHaveBeenCalledWith({
      pickup_pincode: '600131', // no configured pickup code -> the delivery one
      delivery_pincode: '600131',
      weight_grams: 1100, // 550 g x 2, above the 500 g default
      declared_value_paise: 129800,
      cod: false,
    });
    expect(quote.shipping_amount).toBe(7900);
    expect(quote.shipping).toEqual({
      provider: 'manual',
      courier_name: 'Delhivery',
      courier_id: '12',
      etd: '2026-08-27T18:00:00.000Z',
      serviceable: true,
    });
    expect(quote.total).toBe(137700);
  });

  it('refuses shipped lines with no address', async () => {
    pricing.price.mockResolvedValue(priced([shippedLine()]));
    prisma.customerAddress.findFirst.mockResolvedValue(null);

    await expect(service.quote(CUSTOMER, CART, DTO)).rejects.toThrow(
      'A delivery address is required for shipped items',
    );
  });

  it("surfaces the courier's own reason when it will not ship there", async () => {
    pricing.price.mockResolvedValue(priced([shippedLine()]));
    provider.checkServiceability.mockResolvedValue({
      serviceable: false,
      rate: 0,
      courier_name: null,
      courier_id: null,
      etd: null,
      reason: 'No courier serves 600131',
    });

    await expect(service.quote(CUSTOMER, CART, DTO)).rejects.toThrow(
      'No courier serves 600131',
    );
  });

  // ─── coupon ───────────────────────────────────────────────────────────────

  it('zeroes shipping for a free_shipping coupon and leaves the discount at 0', async () => {
    pricing.price.mockResolvedValue(priced([line(), shippedLine()]));
    provider.checkServiceability.mockResolvedValue({
      serviceable: true,
      rate: 7900,
      courier_name: 'Delhivery',
      courier_id: '12',
      etd: null,
    });
    coupons.evaluate.mockResolvedValue({
      coupon: {
        id: 'coupon-1',
        code: 'SHIPFREE',
        type: CouponType.free_shipping,
      },
      discount: 0,
      free_shipping: true,
    });

    const { quote } = await service.quote(CUSTOMER, CART, {
      ...DTO,
      coupon_code: 'SHIPFREE',
    });

    expect(quote.shipping_amount).toBe(0);
    expect(quote.discount_amount).toBe(0);
    expect(quote.coupon).toEqual({
      id: 'coupon-1',
      code: 'SHIPFREE',
      type: CouponType.free_shipping,
      discount: 0,
    });
    // The rate was still fetched, so the storefront can show what was waived.
    expect(quote.shipping?.serviceable).toBe(true);
  });

  it('caps the loyalty burn against the discounted subtotal, not the gross one', async () => {
    coupons.evaluate.mockResolvedValue({
      coupon: { id: 'coupon-1', code: 'WELCOME10', type: CouponType.percent },
      discount: 20000,
      free_shipping: false,
    });

    await service.quote(CUSTOMER, CART, {
      ...DTO,
      coupon_code: 'WELCOME10',
      redeem_points: 100,
    });

    expect(loyalty.previewRedeem).toHaveBeenCalledWith(CUSTOMER, 100, 70000);
  });

  // ─── the money identity ───────────────────────────────────────────────────

  it('totals subtotal − discount − loyalty + shipping and never adds tax', async () => {
    pricing.price.mockResolvedValue(priced([line(), shippedLine()]));
    provider.checkServiceability.mockResolvedValue({
      serviceable: true,
      rate: 7900,
      courier_name: 'Delhivery',
      courier_id: '12',
      etd: null,
    });
    coupons.evaluate.mockResolvedValue({
      coupon: { id: 'coupon-1', code: 'WELCOME10', type: CouponType.percent },
      discount: 20000,
      free_shipping: false,
    });
    loyalty.previewRedeem.mockResolvedValue({
      balance: 620,
      tier: LoyaltyTier.regular,
      max_redeemable_points: 254,
      points_applied: 100,
      redeem_amount: 2500,
      redeem_value_per_point: 0.25,
    });
    loyalty.earnEstimate.mockResolvedValue(66);

    const { quote } = await service.quote(CUSTOMER, CART, {
      ...DTO,
      coupon_code: 'WELCOME10',
      redeem_points: 100,
    });

    expect(quote.subtotal).toBe(154900);
    expect(quote.tax_amount).toBe(11240);
    expect(quote.total).toBe(154900 - 20000 - 2500 + 7900);
    expect(quote.total).not.toBe(154900 - 20000 - 2500 + 7900 + 11240);
    // Points are earned on the net paid value, shipping excluded.
    expect(loyalty.earnEstimate).toHaveBeenCalledWith(132400);
    expect(quote.loyalty_points_earned_estimate).toBe(66);
    expect(quote.tax_breakup).toEqual([
      { rate: '5.00', taxable: 85714, tax: 4286 },
      { rate: '12.00', taxable: 57946, tax: 6954 },
    ]);
  });

  // ─── booking holds ────────────────────────────────────────────────────────

  it('holds one seat per booking line for the quote window', async () => {
    pricing.price.mockResolvedValue(priced([bookingLine()]));

    const { quote } = await service.quote(CUSTOMER, CART, DTO);

    expect(prisma.eventBooking.create).toHaveBeenCalledTimes(1);
    const createCalls = prisma.eventBooking.create.mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;
    const created = createCalls[0][0].data;
    expect(created).toMatchObject({
      event_id: EVENT,
      customer_id: CUSTOMER,
      customer_name: 'Aditi R.',
      customer_phone: '+919000000001',
      guests: 2,
      status: BookingStatus.held,
      payment_status: 'pending',
    });
    expect(String(created.payment_amount)).toBe('5000');
    expect((created.hold_expires_at as Date).toISOString()).toBe(
      quote.expires_at,
    );
    expect(quote.holds).toEqual([
      {
        booking_id: 'booking-1',
        event_id: EVENT,
        product_id: 'p3',
        guests: 2,
        expires_at: quote.expires_at,
      },
    ]);
    // 15 minutes, matching CheckoutService.QUOTE_TTL_SECONDS.
    expect(Date.parse(quote.expires_at) - Date.parse(quote.created_at)).toBe(
      900_000,
    );
  });

  it('releases the previous quote’s holds before creating new ones', async () => {
    pricing.price.mockResolvedValue(priced([bookingLine()]));

    await service.quote(CUSTOMER, CART, DTO);

    expect(prisma.eventBooking.deleteMany).toHaveBeenCalledWith({
      where: { customer_id: CUSTOMER, status: BookingStatus.held },
    });
    expect(
      prisma.eventBooking.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.eventBooking.create.mock.invocationCallOrder[0]);
  });

  it('creates no hold and needs no customer row when nothing is a booking', async () => {
    await service.quote(CUSTOMER, CART, DTO);

    expect(prisma.eventBooking.create).not.toHaveBeenCalled();
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it('turns a duplicate-booking collision into a storefront message', async () => {
    pricing.price.mockResolvedValue(priced([bookingLine()]));
    prisma.eventBooking.create.mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' }),
    );

    await expect(service.quote(CUSTOMER, CART, DTO)).rejects.toThrow(
      'You already have a booking for "Chef\'s Table Dinner"',
    );
  });

  it('will not hold a seat for a customer that no longer exists', async () => {
    pricing.price.mockResolvedValue(priced([bookingLine()]));
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.quote(CUSTOMER, CART, DTO)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ─── persistence ──────────────────────────────────────────────────────────

  it('stores the quote at quote:{customerId}:{quoteId} with a 900 s TTL', async () => {
    const { quote } = await service.quote(CUSTOMER, CART, DTO);

    expect(CheckoutService.QUOTE_TTL_SECONDS).toBe(900);
    expect(redis.client.setex).toHaveBeenCalledTimes(1);
    const setexCalls = redis.client.setex.mock.calls as Array<
      [string, number, string]
    >;
    const [key, ttl, payload] = setexCalls[0];
    expect(key).toBe(`quote:${CUSTOMER}:${quote.quote_id}`);
    expect(key).toBe(service.quoteKey(CUSTOMER, quote.quote_id));
    expect(ttl).toBe(900);
    // What is stored is byte-for-byte what the caller got back.
    expect(JSON.parse(payload)).toEqual(quote);
    expect(quote.v).toBe(2);
    expect(quote.customer_id).toBe(CUSTOMER);
  });

  it('reads a stored quote back, scoped to its customer', async () => {
    const stored = { v: 2, quote_id: 'q1', customer_id: CUSTOMER, total: 1 };
    redis.client.get.mockResolvedValue(JSON.stringify(stored));

    await expect(service.readQuote(CUSTOMER, 'q1')).resolves.toEqual(stored);
    expect(redis.client.get).toHaveBeenCalledWith(`quote:${CUSTOMER}:q1`);
  });

  it('tells the customer to review the cart when the quote has expired', async () => {
    redis.client.get.mockResolvedValue(null);

    await expect(service.readQuote(CUSTOMER, 'q1')).rejects.toThrow(
      'Your quote expired — please review your cart again',
    );
  });

  // ─── the wire shape ───────────────────────────────────────────────────────

  it('serialises money as rupee Decimals and hides the coupon id', async () => {
    pricing.price.mockResolvedValue(
      priced([line()], {
        rejected: [
          {
            product_id: 'p9',
            variant_id: null,
            name: 'Linen Apron',
            reason: 'Only 0 left',
          },
        ],
      }),
    );
    coupons.evaluate.mockResolvedValue({
      coupon: { id: 'coupon-1', code: 'WELCOME10', type: CouponType.percent },
      discount: 20000,
      free_shipping: false,
    });

    const body = toQuoteResponse(
      await service.quote(CUSTOMER, CART, { ...DTO, coupon_code: 'WELCOME10' }),
    );

    expect(body.subtotal.toNumber()).toBe(900);
    expect(body.total.toNumber()).toBe(700);
    expect(body.tax_amount.toNumber()).toBe(42.86);
    expect(body.lines[0].unit_price.toNumber()).toBe(450);
    expect(body.lines[0].tax_rate).toBe('5.00'); // a rate, not an amount
    expect(body.coupon?.code).toBe('WELCOME10');
    expect(body.coupon?.type).toBe(CouponType.percent);
    expect(body.coupon?.discount.toNumber()).toBe(200);
    expect(body.coupon).not.toHaveProperty('id');
    expect(body.rejected).toEqual([
      {
        product_id: 'p9',
        variant_id: null,
        name: 'Linen Apron',
        reason: 'Only 0 left',
      },
    ]);
    expect(body.loyalty).toMatchObject({
      balance: 0,
      tier: LoyaltyTier.member,
      max_redeemable_points: 0,
      points_applied: 0,
      redeem_value_per_point: 0.25,
      points_earned_estimate: 0,
    });
  });

  // ─── serviceability pre-check (P5b gap 6) ─────────────────────────────────
  //
  // The address step could not ask "do you reach this pincode?" before a quote
  // existed: `quote` needs a *saved* `delivery_address_id`, and a customer
  // typing a new address has not saved one. The pre-check must therefore agree
  // with the quote exactly — a pre-check that says yes where the quote says no
  // is worse than none.

  describe('checkServiceability', () => {
    const withAllowList = (pincodes: string[]) =>
      settings.get.mockImplementation((key: string) =>
        Promise.resolve(
          key === 'delivery_pincodes'
            ? pincodes
            : key === 'shipping'
              ? {
                  provider: 'manual',
                  pickup_location_code: '',
                  default_weight_grams: 500,
                  default_dimensions_cm: {
                    length: 20,
                    breadth: 15,
                    height: 10,
                  },
                }
              : {},
        ),
      );

    it('answers local:true for a pincode on the allow-list', async () => {
      withAllowList(['600131']);

      const result = await service.checkServiceability(CART, {
        pincode: '600131',
      });

      expect(result.local).toEqual({ serviceable: true });
    });

    it('answers local:false with the same message the quote throws', async () => {
      withAllowList(['600131']);

      const result = await service.checkServiceability(CART, {
        pincode: '110001',
      });

      expect(result.local).toEqual({
        serviceable: false,
        reason: "Sorry, we don't deliver to this pincode yet",
      });
    });

    it('treats an empty allow-list as "no restriction configured"', async () => {
      withAllowList([]);

      const result = await service.checkServiceability(CART, {
        pincode: '110001',
      });

      expect(result.local.serviceable).toBe(true);
    });

    it('trims the pincode before matching, as the allow-list check does', async () => {
      withAllowList(['600131']);

      const result = await service.checkServiceability(CART, {
        pincode: ' 600131 ',
      });

      expect(result.local.serviceable).toBe(true);
    });

    it('returns shipped:null for a cart with no shipped line, and asks no provider', async () => {
      withAllowList(['600131']);
      pricing.price.mockResolvedValue(priced([line()]));

      const result = await service.checkServiceability(CART, {
        pincode: '600131',
      });

      expect(result.shipped).toBeNull();
      expect(provider.checkServiceability).not.toHaveBeenCalled();
    });

    it('returns shipped:null for an empty cart without pricing anything', async () => {
      withAllowList(['600131']);

      const result = await service.checkServiceability([], {
        pincode: '600131',
      });

      expect(result.shipped).toBeNull();
      expect(pricing.price).not.toHaveBeenCalled();
      expect(provider.checkServiceability).not.toHaveBeenCalled();
    });

    it('asks the provider with exactly the arguments the quote builds', async () => {
      withAllowList(['600131']);
      pricing.price.mockResolvedValue(priced([shippedLine()]));
      provider.checkServiceability.mockResolvedValue({
        serviceable: true,
        rate: 8000,
        courier_name: 'Delhivery Surface',
        courier_id: '12',
        etd: new Date('2026-08-29T00:00:00.000Z'),
      });

      const result = await service.checkServiceability(CART, {
        pincode: '600131',
      });

      expect(provider.checkServiceability).toHaveBeenCalledWith({
        // An unconfigured pickup code means "ship from wherever the customer
        // is", exactly as the quote resolves it.
        pickup_pincode: '600131',
        delivery_pincode: '600131',
        weight_grams: 550,
        declared_value_paise: 64900,
        cod: false,
      });
      expect(result.shipped).toMatchObject({
        serviceable: true,
        courier_name: 'Delhivery Surface',
        etd: '2026-08-29T00:00:00.000Z',
      });
      // Rupees on the wire, like every other money field.
      expect(result.shipped?.amount?.toNumber()).toBe(80);
    });

    it('floors the default weight the way the quote does', async () => {
      withAllowList(['600131']);
      pricing.price.mockResolvedValue(
        priced([shippedLine({ weight_grams: 100 })]),
      );

      await service.checkServiceability(CART, { pincode: '600131' });

      expect(provider.checkServiceability).toHaveBeenCalledWith(
        expect.objectContaining({ weight_grams: 500 }),
      );
    });

    it('clamps a fractional or negative provider rate, as the quote does', async () => {
      withAllowList(['600131']);
      pricing.price.mockResolvedValue(priced([shippedLine()]));
      provider.checkServiceability.mockResolvedValue({
        serviceable: true,
        rate: -12.7,
        courier_name: null,
        courier_id: null,
        etd: null,
      });

      const result = await service.checkServiceability(CART, {
        pincode: '600131',
      });

      expect(result.shipped?.amount?.toNumber()).toBe(0);
    });

    it('reports an unserviceable courier without throwing, carrying its reason', async () => {
      withAllowList([]);
      pricing.price.mockResolvedValue(priced([shippedLine()]));
      provider.checkServiceability.mockResolvedValue({
        serviceable: false,
        rate: 0,
        courier_name: null,
        courier_id: null,
        etd: null,
        reason: 'No courier serves 110001',
      });

      const result = await service.checkServiceability(CART, {
        pincode: '110001',
      });

      expect(result.shipped).toEqual({
        serviceable: false,
        reason: 'No courier serves 110001',
      });
    });

    it('falls back to a house message when the provider gives no reason', async () => {
      withAllowList([]);
      pricing.price.mockResolvedValue(priced([shippedLine()]));
      provider.checkServiceability.mockResolvedValue({
        serviceable: false,
        rate: 0,
        courier_name: null,
        courier_id: null,
        etd: null,
      });

      const result = await service.checkServiceability(CART, {
        pincode: '110001',
      });

      expect(result.shipped?.reason).toBe('We cannot ship to this pincode yet');
    });

    it('answers both halves independently — local no, courier yes', async () => {
      withAllowList(['600131']);
      pricing.price.mockResolvedValue(priced([line(), shippedLine()]));
      provider.checkServiceability.mockResolvedValue({
        serviceable: true,
        rate: 8000,
        courier_name: 'Delhivery Surface',
        courier_id: '12',
        etd: null,
      });

      const result = await service.checkServiceability(CART, {
        pincode: '110001',
      });

      expect(result.local.serviceable).toBe(false);
      expect(result.shipped?.serviceable).toBe(true);
    });

    it('prices the cart on the channel the client named', async () => {
      withAllowList([]);
      pricing.price.mockResolvedValue(priced([line()]));

      await service.checkServiceability(CART, {
        pincode: '600131',
        channel: OrderChannel.takeaway,
      });

      expect(pricing.price).toHaveBeenCalledWith(CART, OrderChannel.takeaway);
    });

    it('defaults the channel to delivery, as the cart routes do', async () => {
      withAllowList([]);
      pricing.price.mockResolvedValue(priced([line()]));

      await service.checkServiceability(CART, { pincode: '600131' });

      expect(pricing.price).toHaveBeenCalledWith(CART, OrderChannel.delivery);
    });

    it('needs no Redis — it writes nothing and holds nothing', async () => {
      withAllowList([]);
      redis.getClient.mockReturnValue(null);
      pricing.price.mockResolvedValue(priced([line()]));

      await expect(
        service.checkServiceability(CART, { pincode: '600131' }),
      ).resolves.toMatchObject({ local: { serviceable: true } });
      expect(prisma.eventBooking.create).not.toHaveBeenCalled();
    });
  });
});
