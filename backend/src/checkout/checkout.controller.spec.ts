import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CouponType, LoyaltyTier, OrderChannel } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ServiceabilityDto } from './dto/serviceability.dto';
import { CustomerOrdersService } from '../customer-orders/customer-orders.service';
import { CouponsService } from '../promotions/coupons.service';
import { toDecimal } from '../common/money/money';
import { CartPricingService } from './cart-pricing.service';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import type { StoredQuote } from './quote.types';

const CUSTOMER = 'c0000000-0000-4000-8000-000000000001';
const REQ = { user: { customerId: CUSTOMER } };

const CART_ITEMS = [{ productId: 'p1', variantId: null, quantity: 2 }];

function storedQuote(over: Partial<StoredQuote> = {}): StoredQuote {
  return {
    v: 2,
    quote_id: 'q-1',
    customer_id: CUSTOMER,
    created_at: '2026-08-24T06:00:00.000Z',
    expires_at: '2026-08-24T06:15:00.000Z',
    channel: OrderChannel.delivery,
    delivery_address_id: null,
    pickup: false,
    lines: [],
    holds: [],
    subtotal: 90000,
    discount_amount: 0,
    coupon: null,
    shipping_amount: 0,
    shipping: null,
    tax_amount: 4286,
    tax_breakup: [],
    loyalty_points_redeemed: 0,
    loyalty_redeem_amount: 0,
    loyalty_points_earned_estimate: 0,
    total: 90000,
    ...over,
  };
}

describe('CheckoutController', () => {
  let controller: CheckoutController;
  let checkout: { quote: jest.Mock; checkServiceability: jest.Mock };
  let carts: { getCart: jest.Mock };
  let coupons: { validate: jest.Mock };
  let pricing: { price: jest.Mock };

  beforeEach(async () => {
    checkout = {
      quote: jest.fn().mockResolvedValue({
        quote: storedQuote(),
        rejected: [],
        loyalty: {
          balance: 0,
          tier: LoyaltyTier.member,
          max_redeemable_points: 0,
          points_applied: 0,
          redeem_amount: 0,
          redeem_value_per_point: 0.25,
        },
      }),
      checkServiceability: jest.fn(),
    };
    carts = {
      getCart: jest.fn().mockResolvedValue({
        items: CART_ITEMS,
        channel: OrderChannel.delivery,
        deliveryAddressId: null,
        updatedAt: '2026-08-24T06:00:00.000Z',
      }),
    };
    coupons = { validate: jest.fn() };
    pricing = {
      price: jest.fn().mockResolvedValue({
        lines: [],
        subtotal: 90000,
        has_shipped: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [
        { provide: CheckoutService, useValue: checkout },
        { provide: CustomerOrdersService, useValue: carts },
        { provide: CouponsService, useValue: coupons },
        { provide: CartPricingService, useValue: pricing },
      ],
    }).compile();

    controller = module.get(CheckoutController);
  });

  it('quotes the customer’s stored cart, never a cart from the body', async () => {
    const body = await controller.quote(REQ, {
      channel: OrderChannel.delivery,
    });

    expect(carts.getCart).toHaveBeenCalledWith(CUSTOMER);
    expect(checkout.quote).toHaveBeenCalledWith(CUSTOMER, CART_ITEMS, {
      channel: OrderChannel.delivery,
    });
    expect(body.quote_id).toBe('q-1');
    expect(body.expires_at).toBe('2026-08-24T06:15:00.000Z');
    expect(body.total.toNumber()).toBe(900);
  });

  it('quotes an absent cart as an empty one so the service owns the message', async () => {
    carts.getCart.mockResolvedValue(null);

    await controller.quote(REQ, { channel: OrderChannel.delivery });

    expect(checkout.quote).toHaveBeenCalledWith(CUSTOMER, [], {
      channel: OrderChannel.delivery,
    });
  });

  it('validates a coupon against the re-priced cart, not a client subtotal', async () => {
    coupons.validate.mockResolvedValue({
      valid: true,
      code: 'WELCOME10',
      type: CouponType.percent,
      discount: toDecimal(20000),
      free_shipping: false,
    });

    const body = await controller.validateCoupon(REQ, { code: 'WELCOME10' });

    expect(pricing.price).toHaveBeenCalledWith(
      CART_ITEMS,
      OrderChannel.delivery,
    );
    expect(coupons.validate).toHaveBeenCalledWith('WELCOME10', {
      customerId: CUSTOMER,
      lines: [],
      subtotal: 90000,
      hasShipped: false,
    });
    expect(body.discount.toNumber()).toBe(200);
  });

  it('prices the validation on the channel the client named', async () => {
    coupons.validate.mockResolvedValue({});

    await controller.validateCoupon(REQ, {
      code: 'WELCOME10',
      channel: OrderChannel.takeaway,
    });

    expect(pricing.price).toHaveBeenCalledWith(
      CART_ITEMS,
      OrderChannel.takeaway,
    );
  });

  it('lets an ineligible coupon fail loudly rather than returning valid:false', async () => {
    coupons.validate.mockRejectedValue(
      new BadRequestException('This coupon has expired'),
    );

    await expect(
      controller.validateCoupon(REQ, { code: 'OLDCODE' }),
    ).rejects.toThrow('This coupon has expired');
  });

  // ─── serviceability pre-check (P5b gap 6) ─────────────────────────────────

  it('checks serviceability against the stored cart, never a cart from the body', async () => {
    const answer = {
      local: { serviceable: true },
      shipped: null,
    };
    checkout.checkServiceability.mockResolvedValue(answer);

    const body = await controller.serviceability(REQ, { pincode: '600131' });

    expect(carts.getCart).toHaveBeenCalledWith(CUSTOMER);
    expect(checkout.checkServiceability).toHaveBeenCalledWith(CART_ITEMS, {
      pincode: '600131',
    });
    expect(body).toBe(answer);
  });

  it('treats an absent cart as an empty one so the service owns the branch', async () => {
    carts.getCart.mockResolvedValue(null);
    checkout.checkServiceability.mockResolvedValue({
      local: { serviceable: true },
      shipped: null,
    });

    await controller.serviceability(REQ, { pincode: '600131' });

    expect(checkout.checkServiceability).toHaveBeenCalledWith([], {
      pincode: '600131',
    });
  });
});

describe('ServiceabilityDto', () => {
  const errors = (body: Record<string, unknown>) =>
    validate(plainToInstance(ServiceabilityDto, body));

  it('accepts a bare six-digit pincode', async () => {
    await expect(errors({ pincode: '600131' })).resolves.toEqual([]);
  });

  it.each(['60013', '6001311', '60013a', ''])(
    'rejects %p',
    async (pincode) => {
      const bad = await errors({ pincode });
      expect(bad.map((e) => e.property)).toContain('pincode');
    },
  );

  it('accepts an optional takeaway/delivery channel and rejects any other', async () => {
    await expect(
      errors({ pincode: '600131', channel: OrderChannel.takeaway }),
    ).resolves.toEqual([]);

    const bad = await errors({ pincode: '600131', channel: 'dine_in' });
    expect(bad.map((e) => e.property)).toContain('channel');
  });
});
