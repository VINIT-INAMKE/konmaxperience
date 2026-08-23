import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ActorType,
  OrderItemStatus,
  Prisma,
  ReviewStatus,
} from '@prisma/client';
import { ReviewsService, REVIEW_STATUS_ALL } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditInput } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DomainEvent } from '../common/events/domain-events';
import type { Tx } from '../common/types/transaction';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  MockPrisma,
  mockAuditService,
  mockEventEmitter,
  mockPrisma,
  mockSettings,
} from '../test-utils/mock-providers';

const NODE_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = 'customer-1';
const PRODUCT_ID = 'product-1';
const ITEM_ID = '5f0b0e1e-1111-4111-8111-111111111111';

/**
 * The nth argument of the nth call, typed. `jest.Mock['mock']['calls']` is
 * `any[][]`, so every direct index trips four `no-unsafe-*` rules; funnelling
 * them through one helper confines the cast to a single line.
 */
function callArg<T>(fn: jest.Mock, argIndex = 0, callIndex = 0): T {
  return fn.mock.calls[callIndex][argIndex] as T;
}

/** A delivered order item belonging to CUSTOMER_ID, as the select shape returns it. */
function itemRow(over: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    status: OrderItemStatus.delivered,
    product_id: PRODUCT_ID,
    order: { customer_id: CUSTOMER_ID },
    ...over,
  };
}

/** A review row as Prisma would hand it back. */
function reviewRow(over: Record<string, unknown> = {}) {
  return {
    id: 'review-1',
    node_id: NODE_ID,
    product_id: PRODUCT_ID,
    customer_id: CUSTOMER_ID,
    order_item_id: ITEM_ID,
    rating: 5,
    title: 'Excellent',
    body: 'Tasted great.',
    media: [] as string[],
    status: ReviewStatus.published,
    moderated_by: null as string | null,
    moderated_at: null as Date | null,
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  };
}

/** The `_avg`/`_count` shape `review.aggregate` returns for the rollup. */
function agg(avg: number | null, count: number) {
  return { _avg: { rating: avg }, _count: { _all: count } };
}

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: MockPrisma;
  let audit: ReturnType<typeof mockAuditService>;
  let emitter: ReturnType<typeof mockEventEmitter>;
  let settings: ReturnType<typeof mockSettings>;

  async function build(
    settingsOverrides: Parameters<typeof mockSettings>[0] = {},
  ) {
    prisma = mockPrisma();
    audit = mockAuditService();
    emitter = mockEventEmitter();
    settings = mockSettings(settingsOverrides);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: SettingsService, useValue: settings },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  }

  beforeEach(async () => {
    await build();
    prisma.review.aggregate.mockResolvedValue(agg(5, 1));
    prisma.product.update.mockResolvedValue({ id: PRODUCT_ID });
  });

  // ─── 1. eligibility ───────────────────────────────────────────────────────

  it('refuses a review of an item that is not delivered or attended', async () => {
    prisma.orderItem.findUnique.mockResolvedValue(
      itemRow({ status: OrderItemStatus.shipped }),
    );

    await expect(
      service.create(CUSTOMER_ID, {
        order_item_id: ITEM_ID,
        rating: 5,
      } as CreateReviewDto),
    ).rejects.toThrow(
      new BadRequestException(
        'You can review an item once it has been delivered',
      ),
    );
    expect(prisma.review.create).not.toHaveBeenCalled();
  });

  it('accepts an attended booking line as reviewable', async () => {
    prisma.orderItem.findUnique.mockResolvedValue(
      itemRow({ status: OrderItemStatus.attended }),
    );
    prisma.review.create.mockResolvedValue(reviewRow());

    await expect(
      service.create(CUSTOMER_ID, {
        order_item_id: ITEM_ID,
        rating: 5,
      } as CreateReviewDto),
    ).resolves.toMatchObject({ id: 'review-1' });
  });

  it('404s when the order item does not exist', async () => {
    prisma.orderItem.findUnique.mockResolvedValue(null);

    await expect(
      service.create(CUSTOMER_ID, {
        order_item_id: ITEM_ID,
        rating: 5,
      } as CreateReviewDto),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── 2. ownership ─────────────────────────────────────────────────────────

  it("refuses to review another customer's order item", async () => {
    prisma.orderItem.findUnique.mockResolvedValue(
      itemRow({ order: { customer_id: 'someone-else' } }),
    );

    await expect(
      service.create(CUSTOMER_ID, {
        order_item_id: ITEM_ID,
        rating: 5,
      } as CreateReviewDto),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.review.create).not.toHaveBeenCalled();
  });

  // ─── 3. one per order item ────────────────────────────────────────────────

  it('maps the unique-index violation to a 409', async () => {
    prisma.orderItem.findUnique.mockResolvedValue(itemRow());
    prisma.review.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.0',
      }),
    );

    await expect(
      service.create(CUSTOMER_ID, {
        order_item_id: ITEM_ID,
        rating: 5,
      } as CreateReviewDto),
    ).rejects.toThrow(
      new ConflictException('You have already reviewed this item'),
    );
  });

  // ─── 4. auto-publish threshold ────────────────────────────────────────────

  it.each([
    [5, ReviewStatus.published],
    [4, ReviewStatus.published],
    [3, ReviewStatus.pending],
    [1, ReviewStatus.pending],
  ])('creates a %i-star review as %s', async (rating, expected) => {
    prisma.orderItem.findUnique.mockResolvedValue(itemRow());
    prisma.review.create.mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve(reviewRow(args.data)),
    );

    await service.create(CUSTOMER_ID, {
      order_item_id: ITEM_ID,
      rating,
    } as CreateReviewDto);

    const args = callArg<{ data: { status: ReviewStatus; rating: number } }>(
      prisma.review.create,
    );
    expect(args.data.status).toBe(expected);
    expect(args.data.rating).toBe(rating);
  });

  // ─── 5. threshold comes from SystemSetting, not a constant ────────────────

  it('reads auto_publish_min_rating from SystemSetting', async () => {
    await build({
      reviews: { auto_publish_min_rating: 5, invitation_delay_hours: 24 },
    });
    prisma.review.aggregate.mockResolvedValue(agg(4, 1));
    prisma.product.update.mockResolvedValue({ id: PRODUCT_ID });
    prisma.orderItem.findUnique.mockResolvedValue(itemRow());
    prisma.review.create.mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve(reviewRow(args.data)),
    );

    // 4 stars auto-publishes on the default; with the threshold raised to 5 it
    // must queue for moderation instead.
    await service.create(CUSTOMER_ID, {
      order_item_id: ITEM_ID,
      rating: 4,
    } as CreateReviewDto);

    expect(settings.get).toHaveBeenCalledWith('reviews');
    const args = callArg<{ data: { status: ReviewStatus } }>(
      prisma.review.create,
    );
    expect(args.data.status).toBe(ReviewStatus.pending);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  // ─── 6. DTO bounds ────────────────────────────────────────────────────────

  it.each([0, 6, -1, 4.5])('rejects rating %p at the DTO', async (rating) => {
    const dto = plainToInstance(CreateReviewDto, {
      order_item_id: ITEM_ID,
      rating,
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('rating');
  });

  it('accepts a well-formed review body at the DTO', async () => {
    const dto = plainToInstance(CreateReviewDto, {
      order_item_id: ITEM_ID,
      rating: 5,
      title: 'Excellent',
      body: 'Tasted great.',
      media: ['https://cdn.example.test/a.jpg'],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects more than five media urls', async () => {
    const dto = plainToInstance(CreateReviewDto, {
      order_item_id: ITEM_ID,
      rating: 5,
      media: Array.from(
        { length: 6 },
        (_, i) => `https://cdn.example.test/${i}.jpg`,
      ),
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('media');
  });

  // ─── 7. moderation writes the trail ───────────────────────────────────────

  it('publish records moderated_by/at and an AuditEvent', async () => {
    prisma.review.findUnique.mockResolvedValue(
      reviewRow({ status: ReviewStatus.pending }),
    );
    prisma.review.update.mockResolvedValue(
      reviewRow({ status: ReviewStatus.published, moderated_by: 'user-9' }),
    );

    await service.moderate('review-1', ReviewStatus.published, 'user-9');

    const update = callArg<{
      data: { status: ReviewStatus; moderated_by: string; moderated_at: Date };
    }>(prisma.review.update);
    expect(update.data.status).toBe(ReviewStatus.published);
    expect(update.data.moderated_by).toBe('user-9');
    expect(update.data.moderated_at).toBeInstanceOf(Date);

    const entry = callArg<AuditInput>(audit.record, 1);
    expect(entry).toMatchObject({
      entity_type: 'review',
      entity_id: 'review-1',
      action: 'review.published',
      actor_type: ActorType.user,
      actor_id: 'user-9',
      before: { status: ReviewStatus.pending },
    });
    // The audit row must be written with the transaction client, not the base
    // service, or it would survive a rollback.
    expect(callArg<Tx>(audit.record, 0)).toBe(prisma);
  });

  it('hide records the trail with the review.hidden action', async () => {
    prisma.review.findUnique.mockResolvedValue(
      reviewRow({ status: ReviewStatus.published }),
    );
    prisma.review.update.mockResolvedValue(
      reviewRow({ status: ReviewStatus.hidden, moderated_by: 'user-9' }),
    );

    await service.moderate(
      'review-1',
      ReviewStatus.hidden,
      'user-9',
      'Off topic',
    );

    const entry = callArg<AuditInput>(audit.record, 1);
    expect(entry.action).toBe('review.hidden');
    expect(entry.after).toMatchObject({
      status: ReviewStatus.hidden,
      note: 'Off topic',
    });
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('404s when moderating a review that does not exist', async () => {
    prisma.review.findUnique.mockResolvedValue(null);

    await expect(
      service.moderate('missing', ReviewStatus.published, 'user-9'),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── 8. review.published ──────────────────────────────────────────────────

  it('emits review.published when a moderator publishes', async () => {
    prisma.review.findUnique.mockResolvedValue(
      reviewRow({ status: ReviewStatus.pending, rating: 2 }),
    );
    prisma.review.update.mockResolvedValue(
      reviewRow({ status: ReviewStatus.published, rating: 2 }),
    );

    await service.moderate('review-1', ReviewStatus.published, 'user-9');

    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(callArg<string>(emitter.emit, 0)).toBe(DomainEvent.REVIEW_PUBLISHED);
    expect(callArg<Record<string, unknown>>(emitter.emit, 1)).toMatchObject({
      node_id: NODE_ID,
      actor: { actor_type: ActorType.user, actor_id: 'user-9' },
      reviewId: 'review-1',
      productId: PRODUCT_ID,
      rating: 2,
    });
  });

  it('emits review.published on auto-publish, with a customer actor', async () => {
    prisma.orderItem.findUnique.mockResolvedValue(itemRow());
    prisma.review.create.mockResolvedValue(reviewRow());

    await service.create(CUSTOMER_ID, {
      order_item_id: ITEM_ID,
      rating: 5,
    } as CreateReviewDto);

    expect(callArg<string>(emitter.emit, 0)).toBe(DomainEvent.REVIEW_PUBLISHED);
    expect(callArg<Record<string, unknown>>(emitter.emit, 1)).toMatchObject({
      actor: { actor_type: ActorType.customer, actor_id: CUSTOMER_ID },
      reviewId: 'review-1',
    });
  });

  it('does not emit for a review queued for moderation', async () => {
    prisma.orderItem.findUnique.mockResolvedValue(itemRow());
    prisma.review.create.mockResolvedValue(
      reviewRow({ rating: 2, status: ReviewStatus.pending }),
    );

    await service.create(CUSTOMER_ID, {
      order_item_id: ITEM_ID,
      rating: 2,
    } as CreateReviewDto);

    expect(emitter.emit).not.toHaveBeenCalled();
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('re-publishing an already published review does not emit twice', async () => {
    prisma.review.findUnique.mockResolvedValue(
      reviewRow({ status: ReviewStatus.published }),
    );
    prisma.review.update.mockResolvedValue(
      reviewRow({ status: ReviewStatus.published }),
    );

    await service.moderate('review-1', ReviewStatus.published, 'user-9');

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  // ─── rating rollup ────────────────────────────────────────────────────────

  it('recomputes rating_avg/rating_count from published rows on auto-publish', async () => {
    prisma.orderItem.findUnique.mockResolvedValue(itemRow());
    prisma.review.create.mockResolvedValue(reviewRow());
    prisma.review.aggregate.mockResolvedValue(agg(4.3333333, 3));

    await service.create(CUSTOMER_ID, {
      order_item_id: ITEM_ID,
      rating: 5,
    } as CreateReviewDto);

    const where = callArg<{ where: Record<string, unknown> }>(
      prisma.review.aggregate,
    ).where;
    expect(where).toMatchObject({
      product_id: PRODUCT_ID,
      status: ReviewStatus.published,
    });

    const update = callArg<{
      where: { id: string };
      data: { rating_avg: Prisma.Decimal | null; rating_count: number };
    }>(prisma.product.update);
    expect(update.where.id).toBe(PRODUCT_ID);
    expect(update.data.rating_count).toBe(3);
    expect(update.data.rating_avg?.toString()).toBe('4.33');
  });

  it('nulls rating_avg when hiding the last published review', async () => {
    prisma.review.findUnique.mockResolvedValue(
      reviewRow({ status: ReviewStatus.published }),
    );
    prisma.review.update.mockResolvedValue(
      reviewRow({ status: ReviewStatus.hidden }),
    );
    prisma.review.aggregate.mockResolvedValue(agg(null, 0));

    await service.moderate('review-1', ReviewStatus.hidden, 'user-9');

    const update = callArg<{
      data: { rating_avg: Prisma.Decimal | null; rating_count: number };
    }>(prisma.product.update);
    expect(update.data.rating_count).toBe(0);
    expect(update.data.rating_avg).toBeNull();
  });

  // ─── 9. public list ───────────────────────────────────────────────────────

  it('listPublic returns published rows only, in an { items, next_cursor } envelope', async () => {
    // One row object, reused in the assertion — `reviewRow()` stamps a fresh
    // `new Date()` per call, so building a second one would never deep-equal.
    const row = reviewRow();
    prisma.review.findMany.mockResolvedValue([row]);

    const result = await service.listPublic(PRODUCT_ID);

    const args = callArg<{
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      take: number;
    }>(prisma.review.findMany);
    expect(args.where).toEqual({
      product_id: PRODUCT_ID,
      status: ReviewStatus.published,
    });
    // The public shape must not leak the customer id or the moderation trail.
    expect(Object.keys(args.select)).not.toContain('customer_id');
    expect(Object.keys(args.select)).not.toContain('moderated_by');
    expect(result).toEqual({ items: [row], next_cursor: null });
  });

  it('listPublic reports a next_cursor when an extra row exists', async () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      reviewRow({ id: `review-${i}` }),
    );
    prisma.review.findMany.mockResolvedValue(rows);

    const result = await service.listPublic(PRODUCT_ID, undefined, 2);

    expect(result.items).toHaveLength(2);
    expect(result.next_cursor).toBe('review-1');
  });

  it('listForModeration defaults to the pending queue and honours status=all', async () => {
    prisma.review.findMany.mockResolvedValue([]);

    await service.listForModeration();
    expect(
      callArg<{ where: Record<string, unknown> }>(prisma.review.findMany).where,
    ).toEqual({ status: ReviewStatus.pending });

    await service.listForModeration(REVIEW_STATUS_ALL);
    expect(
      callArg<{ where: Record<string, unknown> }>(prisma.review.findMany, 0, 1)
        .where,
    ).toEqual({});
  });

  // ─── 10. pending for customer ─────────────────────────────────────────────

  it('pendingForCustomer lists delivered/attended lines with no review yet', async () => {
    prisma.orderItem.findMany.mockResolvedValue([
      {
        id: ITEM_ID,
        product: { id: PRODUCT_ID, name: 'Coconut Oil', slug: 'coconut-oil' },
        order: { id: 'order-1', order_number: 1042, created_at: new Date(0) },
      },
    ]);

    const result = await service.pendingForCustomer(CUSTOMER_ID);

    const args = callArg<{ where: Record<string, any> }>(
      prisma.orderItem.findMany,
    );
    expect(args.where).toMatchObject({
      order: { customer_id: CUSTOMER_ID },
      review: null,
    });
    expect(args.where.status.in).toEqual([
      OrderItemStatus.delivered,
      OrderItemStatus.attended,
    ]);
    expect(result).toEqual([
      {
        order_item_id: ITEM_ID,
        product: { id: PRODUCT_ID, name: 'Coconut Oil', slug: 'coconut-oil' },
        order: { id: 'order-1', order_number: 1042, created_at: new Date(0) },
      },
    ]);
  });

  it('listForCustomer returns the customer rows with their status', async () => {
    prisma.review.findMany.mockResolvedValue([
      reviewRow({ status: ReviewStatus.pending }),
    ]);

    await service.listForCustomer(CUSTOMER_ID);

    const args = callArg<{
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    }>(prisma.review.findMany);
    expect(args.where).toEqual({ customer_id: CUSTOMER_ID });
    expect(args.select.status).toBe(true);
  });
});
