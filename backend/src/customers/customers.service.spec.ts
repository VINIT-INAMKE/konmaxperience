import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CallHandler,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { of } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActorType, OrderStatus, Prisma, UsageEventType } from '@prisma/client';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import {
  CustomerPresenceService,
  PRESENCE_WINDOW_MS,
} from './customer-presence.service';
import { CustomerPresenceInterceptor } from './customer-presence.interceptor';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditInput } from '../audit/audit.service';
import { UsageService, CUSTOMER_ROLE_CODE } from '../usage/usage.service';
import {
  MockPrisma,
  mockAuditService,
  mockPrisma,
} from '../test-utils/mock-providers';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

const CUSTOMER_ID = '5f0b0e1e-1111-4111-8111-111111111111';

/** The nth argument of the nth call, typed — see `reviews.service.spec.ts`. */
function callArg<T>(fn: jest.Mock, argIndex = 0, callIndex = 0): T {
  return fn.mock.calls[callIndex][argIndex] as T;
}

/** A customer row as the list `include` returns it. */
function customerRow(over: Record<string, unknown> = {}) {
  return {
    id: CUSTOMER_ID,
    phone: '919900000001',
    name: 'Demo Customer',
    email: 'demo.customer@konma.store',
    marketing_opt_in: false,
    last_seen_at: new Date('2026-08-24T06:00:00.000Z'),
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    updated_at: new Date('2026-08-24T06:00:00.000Z'),
    loyalty_account: { points_balance: 620, tier: 'regular' },
    _count: { orders: 3, reviews: 1, bookings: 1 },
    ...over,
  };
}

/** An empty two-aggregate answer for `ordersSummary`. */
function emptyAggregates(prisma: MockPrisma) {
  prisma.order.aggregate
    .mockResolvedValueOnce({
      _count: { _all: 0 },
      _max: { created_at: null },
    })
    .mockResolvedValueOnce({
      _count: { _all: 0 },
      _sum: { total: null },
    });
}

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: MockPrisma;
  let audit: ReturnType<typeof mockAuditService>;

  beforeEach(async () => {
    prisma = mockPrisma();
    audit = mockAuditService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(CustomersService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('searches phone, name and email, the last two case-insensitively', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.list('  99000  ');

      const args = callArg<Prisma.CustomerFindManyArgs>(
        prisma.customer.findMany,
      );
      expect(args.where).toEqual({
        OR: [
          { phone: { contains: '99000' } },
          { name: { contains: '99000', mode: 'insensitive' } },
          { email: { contains: '99000', mode: 'insensitive' } },
        ],
      });
    });

    it('drops the predicate entirely when no term is given', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.list();

      expect(
        callArg<Prisma.CustomerFindManyArgs>(prisma.customer.findMany).where,
      ).toEqual({});
    });

    it('over-fetches by one and returns the last kept id as next_cursor', async () => {
      const rows = [
        customerRow({ id: 'c-1' }),
        customerRow({ id: 'c-2' }),
        customerRow({ id: 'c-3' }),
      ];
      prisma.customer.findMany.mockResolvedValue(rows);

      const result = await service.list(undefined, undefined, 2);

      expect(
        callArg<Prisma.CustomerFindManyArgs>(prisma.customer.findMany).take,
      ).toBe(3);
      expect(result.items).toHaveLength(2);
      expect(result.next_cursor).toBe('c-2');
    });

    it('returns a null cursor on the last page', async () => {
      prisma.customer.findMany.mockResolvedValue([customerRow()]);

      const result = await service.list(undefined, undefined, 2);

      expect(result.items).toHaveLength(1);
      expect(result.next_cursor).toBeNull();
    });

    it('round-trips a cursor as `skip: 1` past that id', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.list(undefined, 'c-2');

      const args = callArg<Prisma.CustomerFindManyArgs>(
        prisma.customer.findMany,
      );
      expect(args.skip).toBe(1);
      expect(args.cursor).toEqual({ id: 'c-2' });
      expect(args.orderBy).toEqual({ created_at: 'desc' });
    });

    it('caps limit at 200 and falls back to 50 for junk', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.list(undefined, undefined, 5_000);
      expect(
        callArg<Prisma.CustomerFindManyArgs>(prisma.customer.findMany).take,
      ).toBe(201);

      await service.list(undefined, undefined, Number.NaN);
      expect(
        callArg<Prisma.CustomerFindManyArgs>(prisma.customer.findMany, 0, 1)
          .take,
      ).toBe(51);
    });

    it('never leaks password or OTP material', async () => {
      prisma.customer.findMany.mockResolvedValue([customerRow()]);

      const serialised = JSON.stringify(await service.list());

      expect(serialised).not.toMatch(/password/i);
      expect(serialised).not.toMatch(/otp/i);
      expect(serialised).not.toMatch(/secret|token/i);
    });

    it('has no credential column on `Customer` to leak in the first place', () => {
      // The list returns whole rows, so the guarantee above only holds while
      // the model itself carries no credential. If one is ever added this
      // fails, forcing an explicit `select` rather than a silent leak.
      const fields = Object.keys(Prisma.CustomerScalarFieldEnum);
      expect(
        fields.filter((f) => /password|otp|secret|token/i.test(f)),
      ).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('404s on an unknown id without firing the fan-out', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.findOne(CUSTOMER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });

    it('bounds every history list at 50 rows, newest first', async () => {
      prisma.customer.findUnique.mockResolvedValue(customerRow());
      prisma.order.findMany.mockResolvedValue([]);
      prisma.loyaltyTransaction.findMany.mockResolvedValue([]);
      prisma.couponRedemption.findMany.mockResolvedValue([]);
      prisma.review.findMany.mockResolvedValue([]);
      emptyAggregates(prisma);

      await service.findOne(CUSTOMER_ID);

      for (const fn of [
        prisma.order.findMany,
        prisma.loyaltyTransaction.findMany,
        prisma.couponRedemption.findMany,
        prisma.review.findMany,
      ]) {
        const args = callArg<{
          take: number;
          orderBy: unknown;
          where: unknown;
        }>(fn);
        expect(args.take).toBe(50);
        expect(args.orderBy).toEqual({ created_at: 'desc' });
      }
      expect(
        callArg<Prisma.OrderFindManyArgs>(prisma.order.findMany).where,
      ).toEqual({ customer_id: CUSTOMER_ID });
    });

    it('excludes cancelled and refunded orders from lifetime value only', async () => {
      prisma.customer.findUnique.mockResolvedValue(customerRow());
      prisma.order.findMany.mockResolvedValue([]);
      prisma.loyaltyTransaction.findMany.mockResolvedValue([]);
      prisma.couponRedemption.findMany.mockResolvedValue([]);
      prisma.review.findMany.mockResolvedValue([]);
      const lastOrder = new Date('2026-08-20T10:00:00.000Z');
      prisma.order.aggregate
        .mockResolvedValueOnce({
          _count: { _all: 5 },
          _max: { created_at: lastOrder },
        })
        .mockResolvedValueOnce({
          _count: { _all: 4 },
          _sum: { total: new Prisma.Decimal('2499.50') },
        });

      const result = await service.findOne(CUSTOMER_ID);

      const [allArgs, billableArgs] = prisma.order.aggregate.mock.calls.map(
        (call: unknown[]) => call[0] as Prisma.OrderAggregateArgs,
      );
      expect(allArgs.where).toEqual({ customer_id: CUSTOMER_ID });
      expect(billableArgs.where).toEqual({
        customer_id: CUSTOMER_ID,
        status: {
          notIn: [OrderStatus.cancelled, OrderStatus.refunded],
        },
      });
      expect(result.orders_summary).toEqual({
        total_orders: 5,
        billable_orders: 4,
        lifetime_value: new Prisma.Decimal('2499.50'),
        last_order_at: lastOrder,
      });
    });

    it('reports zero lifetime value rather than null for a customer who never paid', async () => {
      prisma.customer.findUnique.mockResolvedValue(customerRow());
      prisma.order.findMany.mockResolvedValue([]);
      prisma.loyaltyTransaction.findMany.mockResolvedValue([]);
      prisma.couponRedemption.findMany.mockResolvedValue([]);
      prisma.review.findMany.mockResolvedValue([]);
      emptyAggregates(prisma);

      const result = await service.findOne(CUSTOMER_ID);

      expect(result.orders_summary.lifetime_value).toEqual(
        new Prisma.Decimal(0),
      );
      expect(result.orders_summary.last_order_at).toBeNull();
    });

    it('carries the profile, loyalty account and every history list', async () => {
      prisma.customer.findUnique.mockResolvedValue(
        customerRow({
          addresses: [{ id: 'a-1', is_default: true }],
          _count: {
            orders: 3,
            reviews: 1,
            bookings: 1,
            coupon_redemptions: 2,
          },
        }),
      );
      prisma.order.findMany.mockResolvedValue([{ id: 'o-1' }]);
      prisma.loyaltyTransaction.findMany.mockResolvedValue([{ id: 'lt-1' }]);
      prisma.couponRedemption.findMany.mockResolvedValue([{ id: 'cr-1' }]);
      prisma.review.findMany.mockResolvedValue([{ id: 'r-1' }]);
      emptyAggregates(prisma);

      const result = await service.findOne(CUSTOMER_ID);

      expect(result.id).toBe(CUSTOMER_ID);
      expect(result.last_seen_at).toEqual(new Date('2026-08-24T06:00:00.000Z'));
      expect(result.loyalty_account).toEqual({
        points_balance: 620,
        tier: 'regular',
      });
      expect(result.orders).toEqual([{ id: 'o-1' }]);
      expect(result.loyalty_transactions).toEqual([{ id: 'lt-1' }]);
      expect(result.coupon_redemptions).toEqual([{ id: 'cr-1' }]);
      expect(result.reviews).toEqual([{ id: 'r-1' }]);
    });
  });

  describe('update', () => {
    it('404s before touching the row', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.update(CUSTOMER_ID, { marketing_opt_in: true }, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('flips the flag and audits the before/after in one transaction', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: CUSTOMER_ID,
        marketing_opt_in: false,
      });
      prisma.customer.update.mockResolvedValue(
        customerRow({ marketing_opt_in: true }),
      );

      const result = await service.update(
        CUSTOMER_ID,
        { marketing_opt_in: true },
        'user-1',
      );

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: CUSTOMER_ID },
        data: { marketing_opt_in: true },
      });
      const entry = callArg<AuditInput>(audit.record, 1);
      expect(entry).toMatchObject({
        entity_type: 'customer',
        entity_id: CUSTOMER_ID,
        action: 'customer.marketing_opt_in_changed',
        actor_type: ActorType.user,
        actor_id: 'user-1',
        before: { marketing_opt_in: false },
        after: { marketing_opt_in: true },
      });
      expect(result.marketing_opt_in).toBe(true);
    });

    it('falls back to a system actor when no staff id is on the request', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: CUSTOMER_ID,
        marketing_opt_in: true,
      });
      prisma.customer.update.mockResolvedValue(customerRow());

      await service.update(CUSTOMER_ID, { marketing_opt_in: false }, null);

      expect(callArg<AuditInput>(audit.record, 1)).toMatchObject({
        actor_type: ActorType.system,
        actor_id: null,
      });
    });
  });
});

describe('UpdateCustomerDto', () => {
  it('accepts a boolean and rejects anything else', async () => {
    await expect(
      validate(plainToInstance(UpdateCustomerDto, { marketing_opt_in: true })),
    ).resolves.toEqual([]);

    const bad = await validate(
      plainToInstance(UpdateCustomerDto, { marketing_opt_in: 'yes' }),
    );
    expect(bad).toHaveLength(1);
  });
});

describe('CustomersController permissions', () => {
  it.each([
    ['list', CustomersController.prototype.list],
    ['findOne', CustomersController.prototype.findOne],
    ['update', CustomersController.prototype.update],
  ])('requires MANAGE_OPS for %s', (_name, handler) => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSION_KEY, handler)).toBe(
      Permission.MANAGE_OPS,
    );
  });
});

/** Lets the fire-and-forget write settle before assertions. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('CustomerPresenceService', () => {
  const NOW = Date.parse('2026-08-24T06:00:00.000Z');
  let presence: CustomerPresenceService;
  let prisma: MockPrisma;
  let usage: { recordCustomerVisit: jest.Mock };
  let now: jest.SpyInstance<number, []>;

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.customer.update.mockResolvedValue({ id: CUSTOMER_ID });
    usage = { recordCustomerVisit: jest.fn().mockResolvedValue(undefined) };
    now = jest.spyOn(Date, 'now').mockReturnValue(NOW);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerPresenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsageService, useValue: usage },
      ],
    }).compile();

    presence = module.get(CustomerPresenceService);
  });

  afterEach(() => now.mockRestore());

  it('touches `last_seen_at` and beats one usage event', async () => {
    presence.touch(CUSTOMER_ID, '/customer/orders/:id');
    await flush();

    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID },
      data: { last_seen_at: new Date(NOW) },
    });
    expect(usage.recordCustomerVisit).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      path: '/customer/orders/:id',
    });
  });

  it('returns synchronously — the write is never awaited by the caller', () => {
    expect(presence.touch(CUSTOMER_ID)).toBeUndefined();
  });

  it('writes once per window however many requests arrive', async () => {
    presence.touch(CUSTOMER_ID);
    now.mockReturnValue(NOW + PRESENCE_WINDOW_MS - 1);
    presence.touch(CUSTOMER_ID);
    presence.touch(CUSTOMER_ID);
    await flush();

    expect(prisma.customer.update).toHaveBeenCalledTimes(1);
    expect(usage.recordCustomerVisit).toHaveBeenCalledTimes(1);
  });

  it('writes again once the window has elapsed', async () => {
    presence.touch(CUSTOMER_ID);
    await flush();
    now.mockReturnValue(NOW + PRESENCE_WINDOW_MS);
    presence.touch(CUSTOMER_ID);
    await flush();

    expect(prisma.customer.update).toHaveBeenCalledTimes(2);
  });

  it('throttles per customer, not globally', async () => {
    presence.touch('customer-a');
    presence.touch('customer-b');
    await flush();

    expect(prisma.customer.update).toHaveBeenCalledTimes(2);
  });

  it('swallows a failed write and lets the next request retry', async () => {
    prisma.customer.update.mockRejectedValueOnce(new Error('db down'));

    presence.touch(CUSTOMER_ID);
    await flush();
    expect(usage.recordCustomerVisit).not.toHaveBeenCalled();

    // Still inside the window, but the failed claim was released.
    presence.touch(CUSTOMER_ID);
    await flush();
    expect(prisma.customer.update).toHaveBeenCalledTimes(2);
    expect(usage.recordCustomerVisit).toHaveBeenCalledTimes(1);
  });
});

describe('CustomerPresenceInterceptor', () => {
  let interceptor: CustomerPresenceInterceptor;
  let presence: { touch: jest.Mock };

  const next = {
    handle: jest.fn().mockReturnValue(of('handler-result')),
  } as unknown as CallHandler;

  function ctx(
    req: Record<string, unknown>,
    type: 'http' | 'ws' = 'http',
  ): ExecutionContext {
    return {
      getType: () => type,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    presence = { touch: jest.fn() };
    interceptor = new CustomerPresenceInterceptor(
      presence as unknown as CustomerPresenceService,
    );
    jest.clearAllMocks();
  });

  it('touches with the route pattern, not the concrete url', () => {
    interceptor.intercept(
      ctx({
        user: { type: 'customer', customerId: CUSTOMER_ID },
        route: { path: '/customer/orders/:id' },
        path: '/customer/orders/abc-123',
      }),
      next,
    );

    expect(presence.touch).toHaveBeenCalledWith(
      CUSTOMER_ID,
      '/customer/orders/:id',
    );
  });

  it('falls back to the request path when no route pattern is attached', () => {
    interceptor.intercept(
      ctx({
        user: { type: 'customer', customerId: CUSTOMER_ID },
        path: '/customer/orders',
      }),
      next,
    );

    expect(presence.touch).toHaveBeenCalledWith(
      CUSTOMER_ID,
      '/customer/orders',
    );
  });

  it.each([
    ['a staff request', { user: { type: 'staff', id: 'user-1' } }],
    ['an unauthenticated request', {}],
    ['a customer token with no id', { user: { type: 'customer' } }],
  ])('ignores %s', (_label, req) => {
    interceptor.intercept(ctx(req), next);
    expect(presence.touch).not.toHaveBeenCalled();
  });

  it('ignores a non-http execution context', () => {
    interceptor.intercept(
      ctx({ user: { type: 'customer', customerId: CUSTOMER_ID } }, 'ws'),
      next,
    );
    expect(presence.touch).not.toHaveBeenCalled();
  });

  it('passes the handler stream through untouched', (done) => {
    interceptor
      .intercept(ctx({ user: { type: 'staff' } }), next)
      .subscribe((value) => {
        expect(value).toBe('handler-result');
        done();
      });
  });
});

describe('UsageService.recordCustomerVisit', () => {
  let service: UsageService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = mockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsageService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(UsageService);
    jest.clearAllMocks();
  });

  it('records a page_view under the synthetic CUSTOMER role with no user FK', async () => {
    prisma.usageEvent.create.mockResolvedValue({ id: 'ev-1' });

    await service.recordCustomerVisit({
      customerId: CUSTOMER_ID,
      path: '/customer/orders',
    });

    expect(prisma.usageEvent.create).toHaveBeenCalledWith({
      data: {
        user_id: null,
        role_code: CUSTOMER_ROLE_CODE,
        event_type: UsageEventType.page_view,
        path: '/customer/orders',
        action: null,
        meta: { customer_id: CUSTOMER_ID },
      },
    });
  });

  it('resolves without throwing when the insert rejects', async () => {
    prisma.usageEvent.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.recordCustomerVisit({ customerId: CUSTOMER_ID }),
    ).resolves.toBeUndefined();
  });
});
