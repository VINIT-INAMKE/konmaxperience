import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ActorType,
  CouponStatus,
  CouponType,
  Prisma,
  ProductType,
} from '@prisma/client';
import { CouponsService, type CouponContext } from './coupons.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditInput } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DomainEvent } from '../common/events/domain-events';
import type { Tx } from '../common/types/transaction';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import {
  MockPrisma,
  mockAuditService,
  mockEventEmitter,
  mockPrisma,
  mockSettings,
} from '../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const DAY = 24 * 60 * 60 * 1000;

/**
 * The nth argument of the nth call, typed. `jest.Mock['mock']['calls']` is
 * `any[][]`, so every direct index trips four `no-unsafe-*` rules; funnelling
 * them through one helper confines the cast to a single line and lets the
 * assertions below read as ordinary typed code.
 */
function callArg<T>(fn: jest.Mock, argIndex = 0, callIndex = 0): T {
  return fn.mock.calls[callIndex][argIndex] as T;
}

/** A coupon row as Prisma would hand it back. Dates straddle "now" by a day. */
function couponRow(over: Record<string, unknown> = {}) {
  return {
    id: 'coupon-1',
    node_id: NODE_ID,
    code: 'WELCOME10',
    description: '10% off your first order',
    type: CouponType.percent,
    value: new Prisma.Decimal(10),
    min_order: null as Prisma.Decimal | null,
    max_discount: null as Prisma.Decimal | null,
    applies_to: [] as ProductType[],
    starts_at: new Date(Date.now() - DAY),
    ends_at: new Date(Date.now() + DAY),
    usage_limit: null as number | null,
    per_customer_limit: null as number | null,
    status: CouponStatus.active,
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  };
}

/** ₹900 of prepared food, nothing shipped. */
function ctx(over: Partial<CouponContext> = {}): CouponContext {
  return {
    customerId: 'cust-1',
    lines: [{ type: ProductType.prepared_food, gross: 90_000 }],
    subtotal: 90_000,
    hasShipped: false,
    ...over,
  };
}

describe('CouponsService', () => {
  let service: CouponsService;
  let prisma: MockPrisma;
  let audit: ReturnType<typeof mockAuditService>;
  let settings: ReturnType<typeof mockSettings>;
  let emitter: ReturnType<typeof mockEventEmitter>;

  beforeEach(async () => {
    prisma = mockPrisma();
    audit = mockAuditService();
    settings = mockSettings();
    emitter = mockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: SettingsService, useValue: settings },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
  });

  // ─── PROMO-02: server-only evaluation ──────────────────────────────────────

  describe('evaluate', () => {
    it('rejects an unknown code', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);

      await expect(service.evaluate('NOPE', ctx())).rejects.toThrow(
        new BadRequestException('Invalid coupon code'),
      );
    });

    it('looks the code up case- and whitespace-insensitively', async () => {
      prisma.coupon.findUnique.mockResolvedValue(couponRow());

      await service.evaluate('  welcome10 ', ctx());

      expect(prisma.coupon.findUnique).toHaveBeenCalledWith({
        where: { code: 'WELCOME10' },
      });
    });

    it('rejects a coupon that is not active', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({ status: CouponStatus.draft }),
      );

      await expect(service.evaluate('WELCOME10', ctx())).rejects.toThrow(
        new BadRequestException('This coupon is not active'),
      );
    });

    it('rejects a coupon whose window has not opened', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({
          starts_at: new Date(Date.now() + DAY),
          ends_at: new Date(Date.now() + 2 * DAY),
        }),
      );

      await expect(service.evaluate('WELCOME10', ctx())).rejects.toThrow(
        new BadRequestException('This coupon is not active yet'),
      );
    });

    it('rejects a coupon whose window has closed', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({
          starts_at: new Date(Date.now() - 2 * DAY),
          ends_at: new Date(Date.now() - DAY),
        }),
      );

      await expect(service.evaluate('WELCOME10', ctx())).rejects.toThrow(
        new BadRequestException('This coupon has expired'),
      );
    });

    it('rejects a subtotal under min_order and names the shortfall', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({ min_order: new Prisma.Decimal(500) }),
      );

      // ₹350 cart against a ₹500 floor: ₹150.00 short.
      await expect(
        service.evaluate('WELCOME10', ctx({ subtotal: 35_000 })),
      ).rejects.toThrow(
        new BadRequestException('Add ₹150.00 more to use this coupon'),
      );
    });

    it('computes a percent discount from the eligible base', async () => {
      prisma.coupon.findUnique.mockResolvedValue(couponRow());

      const result = await service.evaluate(
        'WELCOME10',
        ctx({
          lines: [{ type: ProductType.packaged, gross: 654_900 }],
          subtotal: 654_900,
        }),
      );

      // 10% of ₹6549.00 = ₹654.90.
      expect(result.discount).toBe(65_490);
      expect(result.free_shipping).toBe(false);
      expect(result.coupon).toEqual({
        id: 'coupon-1',
        code: 'WELCOME10',
        type: CouponType.percent,
      });
    });

    it('caps a percent discount at max_discount', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({ max_discount: new Prisma.Decimal(200) }),
      );

      const result = await service.evaluate(
        'WELCOME10',
        ctx({
          lines: [{ type: ProductType.packaged, gross: 654_900 }],
          subtotal: 654_900,
        }),
      );

      // ₹654.90 raw, ceiling ₹200.
      expect(result.discount).toBe(20_000);
    });

    it('never lets a fixed discount exceed the eligible subtotal', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({ type: CouponType.fixed, value: new Prisma.Decimal(500) }),
      );

      const result = await service.evaluate(
        'WELCOME10',
        ctx({
          lines: [{ type: ProductType.prepared_food, gross: 30_000 }],
          subtotal: 30_000,
        }),
      );

      // ₹500 off a ₹300 cart is a ₹300 discount, never a ₹200 credit.
      expect(result.discount).toBe(30_000);
    });

    it('returns free_shipping with a zero discount when the cart has shipped lines', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({
          type: CouponType.free_shipping,
          value: new Prisma.Decimal(0),
        }),
      );

      const result = await service.evaluate(
        'WELCOME10',
        ctx({ hasShipped: true }),
      );

      expect(result).toEqual({
        coupon: {
          id: 'coupon-1',
          code: 'WELCOME10',
          type: CouponType.free_shipping,
        },
        discount: 0,
        free_shipping: true,
      });
    });

    it('rejects free_shipping on a cart with nothing to ship', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({
          type: CouponType.free_shipping,
          value: new Prisma.Decimal(0),
        }),
      );

      await expect(
        service.evaluate('WELCOME10', ctx({ hasShipped: false })),
      ).rejects.toThrow(
        new BadRequestException('This coupon applies to shipped items only'),
      );
    });

    it('restricts the eligible base to the applies_to product types', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({ applies_to: [ProductType.packaged] }),
      );

      const result = await service.evaluate(
        'WELCOME10',
        ctx({
          lines: [
            { type: ProductType.prepared_food, gross: 90_000 },
            { type: ProductType.packaged, gross: 64_900 },
          ],
          subtotal: 154_900,
        }),
      );

      // 10% of the ₹649 packaged line only — the ₹900 thali is not discounted.
      expect(result.discount).toBe(6_490);
    });

    it('rejects a coupon whose applies_to matches nothing in the cart', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({ applies_to: [ProductType.merchandise] }),
      );

      await expect(service.evaluate('WELCOME10', ctx())).rejects.toThrow(
        new BadRequestException(
          'This coupon does not apply to the items in your cart',
        ),
      );
    });

    it('rejects a coupon that has hit its usage_limit', async () => {
      prisma.coupon.findUnique.mockResolvedValue(couponRow({ usage_limit: 5 }));
      prisma.couponRedemption.count.mockResolvedValue(5);

      await expect(service.evaluate('WELCOME10', ctx())).rejects.toThrow(
        new BadRequestException('This coupon has been fully redeemed'),
      );
      expect(prisma.couponRedemption.count).toHaveBeenCalledWith({
        where: { coupon_id: 'coupon-1' },
      });
    });

    it('rejects a coupon this customer has already used up', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({ per_customer_limit: 1 }),
      );
      prisma.couponRedemption.count.mockResolvedValue(1);

      await expect(service.evaluate('WELCOME10', ctx())).rejects.toThrow(
        new BadRequestException('You have already used this coupon'),
      );
      expect(prisma.couponRedemption.count).toHaveBeenCalledWith({
        where: { coupon_id: 'coupon-1', customer_id: 'cust-1' },
      });
    });

    it('counts no redemptions at all when neither limit is set', async () => {
      prisma.coupon.findUnique.mockResolvedValue(couponRow());

      await service.evaluate('WELCOME10', ctx());

      expect(prisma.couponRedemption.count).not.toHaveBeenCalled();
    });
  });

  // ─── the wire shape ────────────────────────────────────────────────────────

  describe('validate', () => {
    it('returns the discount in rupees for the storefront', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({ max_discount: new Prisma.Decimal(200) }),
      );

      const result = await service.validate(
        'welcome10',
        ctx({
          lines: [{ type: ProductType.packaged, gross: 654_900 }],
          subtotal: 654_900,
        }),
      );

      expect(result.valid).toBe(true);
      expect(result.code).toBe('WELCOME10');
      expect(result.type).toBe(CouponType.percent);
      expect(result.free_shipping).toBe(false);
      // A Decimal, so `DecimalSerializationInterceptor` emits the JSON number 200.
      expect(result.discount.toNumber()).toBe(200);
    });

    it('throws rather than returning { valid: false }', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);

      await expect(service.validate('NOPE', ctx())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── PROMO-02: no stacking ────────────────────────────────────────────────

  describe('no stacking', () => {
    it('rejects an array of codes at the DTO boundary', async () => {
      const dto = plainToInstance(ValidateCouponDto, {
        code: ['WELCOME10', 'FREESHIP'],
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('rejects a smuggled `codes` array as a non-whitelisted property', async () => {
      const dto = plainToInstance(ValidateCouponDto, {
        code: 'WELCOME10',
        codes: ['WELCOME10', 'FREESHIP'],
      });

      // The global pipe runs with `forbidNonWhitelisted: true` (main.ts:123).
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('codes');
    });

    it('rejects two codes at the service boundary while allow_stacking is false', async () => {
      await expect(
        service.assertSingleCoupon(['WELCOME10', 'FREESHIP']),
      ).rejects.toThrow(
        new BadRequestException('Only one coupon can be applied per order'),
      );
      expect(settings.get).toHaveBeenCalledWith('promotions');
    });

    it('allows a single code without reading the setting', async () => {
      await expect(
        service.assertSingleCoupon(['WELCOME10']),
      ).resolves.toBeUndefined();
      await expect(service.assertSingleCoupon([])).resolves.toBeUndefined();
      expect(settings.get).not.toHaveBeenCalled();
    });

    it('permits two codes once promotions.allow_stacking is turned on', async () => {
      settings.get.mockResolvedValue({ allow_stacking: true });

      await expect(
        service.assertSingleCoupon(['WELCOME10', 'FREESHIP']),
      ).resolves.toBeUndefined();
    });
  });

  // ─── redemption (called by FulfilmentService inside the confirm tx) ────────

  describe('redeem', () => {
    const input = {
      couponId: 'coupon-1',
      orderId: 'order-1',
      customerId: 'cust-1',
      amount: 20_000,
      nodeId: NODE_ID,
      actor: { actor_type: ActorType.customer, actor_id: 'cust-1' },
    };

    beforeEach(() => {
      prisma.couponRedemption.upsert.mockResolvedValue({
        id: 'redemption-1',
        coupon_id: 'coupon-1',
        order_id: 'order-1',
        customer_id: 'cust-1',
        amount: new Prisma.Decimal(200),
        created_at: new Date(),
        coupon: { code: 'WELCOME10' },
      });
    });

    it('upserts on [coupon_id, order_id] so a replayed confirm is idempotent', async () => {
      await service.redeem(prisma as unknown as Tx, input);

      expect(prisma.couponRedemption.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            coupon_id_order_id: {
              coupon_id: 'coupon-1',
              order_id: 'order-1',
            },
          },
        }),
      );
      const call = callArg<{ create: { amount: Prisma.Decimal } }>(
        prisma.couponRedemption.upsert,
      );
      expect(call.create.amount.toNumber()).toBe(200);
    });

    it('writes the audit row inside the caller transaction', async () => {
      await service.redeem(prisma as unknown as Tx, input);

      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entity_type: 'coupon',
          entity_id: 'coupon-1',
          action: 'coupon.redeemed',
          actor_type: ActorType.customer,
          actor_id: 'cust-1',
        }),
      );
    });

    it('returns the event payload instead of emitting inside the transaction', async () => {
      const result = await service.redeem(prisma as unknown as Tx, input);

      expect(emitter.emit).not.toHaveBeenCalled();
      expect(result.event).toEqual(
        expect.objectContaining({
          node_id: NODE_ID,
          couponId: 'coupon-1',
          code: 'WELCOME10',
          orderId: 'order-1',
          amount: '200',
        }),
      );
      expect(result.redemption.id).toBe('redemption-1');
    });

    it('emits coupon.redeemed once the caller has committed', async () => {
      const { event } = await service.redeem(prisma as unknown as Tx, input);

      service.emitRedeemed(event);

      expect(emitter.emit).toHaveBeenCalledWith(
        DomainEvent.COUPON_REDEEMED,
        event,
      );
    });
  });

  // ─── staff CRUD ───────────────────────────────────────────────────────────

  describe('list', () => {
    it('pages with a cursor and reports the next one', async () => {
      const rows = Array.from({ length: 3 }, (_, i) =>
        couponRow({ id: `coupon-${i}` }),
      );
      prisma.coupon.findMany.mockResolvedValue(rows);

      const result = await service.list(undefined, 2);

      expect(prisma.coupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3,
          include: { _count: { select: { redemptions: true } } },
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.next_cursor).toBe('coupon-1');
    });

    it('reports no next cursor on the last page', async () => {
      prisma.coupon.findMany.mockResolvedValue([couponRow()]);

      const result = await service.list(undefined, 2);

      expect(result.items).toHaveLength(1);
      expect(result.next_cursor).toBeNull();
    });

    it('skips the cursor row itself', async () => {
      prisma.coupon.findMany.mockResolvedValue([]);

      await service.list('coupon-9', 10);

      expect(prisma.coupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 1, cursor: { id: 'coupon-9' } }),
      );
    });
  });

  describe('create', () => {
    const dto: CreateCouponDto = {
      code: 'welcome10',
      type: CouponType.percent,
      value: 10,
      starts_at: new Date(Date.now() - DAY).toISOString(),
      ends_at: new Date(Date.now() + DAY).toISOString(),
    };

    it('upper-cases the code, defaults to draft and audits the creation', async () => {
      prisma.coupon.create.mockResolvedValue(
        couponRow({ status: CouponStatus.draft }),
      );

      await service.create(dto, 'user-1');

      const { data } = callArg<{ data: Prisma.CouponUncheckedCreateInput }>(
        prisma.coupon.create,
      );
      expect(data.code).toBe('WELCOME10');
      expect(data.status).toBe(CouponStatus.draft);
      expect(data.applies_to).toEqual([]);
      expect(data.created_by).toBe('user-1');
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entity_type: 'coupon',
          action: 'coupon.created',
          actor_type: ActorType.user,
          actor_id: 'user-1',
        }),
      );
    });

    it('rejects a window that ends before it starts', async () => {
      await expect(
        service.create(
          { ...dto, starts_at: dto.ends_at, ends_at: dto.starts_at },
          'user-1',
        ),
      ).rejects.toThrow(
        new BadRequestException('starts_at must be before ends_at'),
      );
      expect(prisma.coupon.create).not.toHaveBeenCalled();
    });

    it('rejects a percent coupon above 100', async () => {
      await expect(
        service.create({ ...dto, value: 150 }, 'user-1'),
      ).rejects.toThrow(
        new BadRequestException(
          'A percent coupon value must be between 0 and 100',
        ),
      );
    });

    it('allows a fixed coupon above 100 rupees', async () => {
      prisma.coupon.create.mockResolvedValue(couponRow());

      await expect(
        service.create(
          { ...dto, type: CouponType.fixed, value: 150 },
          'user-1',
        ),
      ).resolves.toBeDefined();
    });

    it('turns a duplicate code into a 409', async () => {
      prisma.coupon.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '6.19.0',
        }),
      );

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('validates a partial window against the stored row', async () => {
      prisma.coupon.findUnique.mockResolvedValue(couponRow());

      await expect(
        service.update(
          'coupon-1',
          { ends_at: new Date(Date.now() - 2 * DAY).toISOString() },
          'user-1',
        ),
      ).rejects.toThrow(
        new BadRequestException('starts_at must be before ends_at'),
      );
    });

    it('clears a nullable column when the patch sends null', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        couponRow({ max_discount: new Prisma.Decimal(200) }),
      );
      prisma.coupon.update.mockResolvedValue(couponRow());

      await service.update('coupon-1', { max_discount: null }, 'user-1');

      expect(
        callArg<{ data: Prisma.CouponUncheckedUpdateInput }>(
          prisma.coupon.update,
        ).data,
      ).toEqual({ max_discount: null });
    });

    it('leaves omitted fields untouched and audits before/after', async () => {
      prisma.coupon.findUnique.mockResolvedValue(couponRow());
      prisma.coupon.update.mockResolvedValue(
        couponRow({ status: CouponStatus.active }),
      );

      await service.update(
        'coupon-1',
        { status: CouponStatus.active },
        'user-1',
      );

      expect(
        callArg<{ data: Prisma.CouponUncheckedUpdateInput }>(
          prisma.coupon.update,
        ).data,
      ).toEqual({ status: CouponStatus.active });
      const call = callArg<AuditInput>(audit.record, 1);
      expect(call.action).toBe('coupon.updated');
      expect(call.before).toBeDefined();
      expect(call.after).toBeDefined();
    });

    it('404s on an unknown coupon', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', {}, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('archive', () => {
    it('disables rather than deletes, and audits it', async () => {
      prisma.coupon.findUnique.mockResolvedValue(couponRow());
      prisma.coupon.update.mockResolvedValue(
        couponRow({ status: CouponStatus.disabled }),
      );

      await service.archive('coupon-1', 'user-1');

      expect(prisma.coupon.delete).not.toHaveBeenCalled();
      expect(prisma.coupon.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'coupon-1' },
          data: { status: CouponStatus.disabled },
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'coupon.archived' }),
      );
    });

    it('404s on an unknown coupon', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);

      await expect(service.archive('nope', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
