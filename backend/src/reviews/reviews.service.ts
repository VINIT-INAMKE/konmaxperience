import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  OrderItemStatus,
  Prisma,
  ReviewStatus,
  type Review,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import type { Tx } from '../common/types/transaction';
import { hasPrismaCode } from '../common/utils/transaction-retry';
import {
  DomainEvent,
  customerActor,
  domainEventBase,
  emitDomainEvent,
  userActor,
  type DomainEventActor,
} from '../common/events/domain-events';
import { CreateReviewDto } from './dto/create-review.dto';

/** Staff queue page size (API appendix: default 50, max 200). */
const DEFAULT_PAGE = 50;
const MAX_PAGE = 200;
/** Public product page — smaller, because it renders unpaginated on mobile. */
const PUBLIC_PAGE = 20;
/** How many rows the storefront's own-reviews and pending lists return. */
const CUSTOMER_PAGE = 50;

/** `status=all` on the staff queue means "no status filter". */
export const REVIEW_STATUS_ALL = 'all';
export type ReviewStatusFilter = ReviewStatus | typeof REVIEW_STATUS_ALL;

/** What the public product page may see — no customer id, no moderation trail. */
const PUBLIC_SELECT = {
  id: true,
  rating: true,
  title: true,
  body: true,
  media: true,
  created_at: true,
  customer: { select: { name: true } },
} as const;

/** The customer's own reviews: their moderation status is theirs to see. */
const MINE_SELECT = {
  id: true,
  product_id: true,
  order_item_id: true,
  rating: true,
  title: true,
  body: true,
  media: true,
  status: true,
  created_at: true,
  product: { select: { id: true, name: true, slug: true } },
} as const;

/** The staff queue needs a name to judge a review by (API appendix §C). */
const MODERATION_INCLUDE = {
  product: { select: { id: true, name: true, slug: true } },
  customer: { select: { id: true, name: true, phone: true } },
} as const;

/** `{ items, next_cursor }` from a `take + 1` over-fetch — one extra row instead of a COUNT. */
function page<T extends { id: string }>(rows: T[], take: number) {
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return {
    items,
    next_cursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

/**
 * `REV-01` / `REV-02` — the single owner of `Review`.
 *
 * Three invariants live here and nowhere else:
 *
 * 1. **Eligibility is proved by an `OrderItem`, not asserted by the client.**
 *    A review may only be written against a line the requesting customer owns
 *    and that has reached `delivered` or `attended`; `product_id` is copied off
 *    that line. `Review.order_item_id @unique` makes "one per line" a database
 *    fact, so a double submit races into `P2002` → `409` rather than two rows.
 * 2. **Auto-publish is a setting, not a constant.** `SystemSetting['reviews']
 *    .auto_publish_min_rating` (seeded `4`) decides whether a new review is
 *    `published` or queued `pending`; an operator can raise it to 5 or drop it
 *    to 1 without a deploy.
 * 3. **`Product.rating_avg` / `rating_count` are recomputed from the published
 *    rows inside the same transaction as every status change** — auto-publish,
 *    staff publish, and staff hide (which *removes* a rating from the average).
 *    Recomputing beats incrementing: a counter drifts under a Serializable
 *    retry, and a full re-aggregate of one product's published reviews is a
 *    single indexed scan (`@@index([product_id, status, created_at])`).
 *
 * `review.published` is emitted **after** the transaction commits (SPEC §4.1),
 * through `emitDomainEvent`, which swallows listener failures — the
 * mission-bridge `review_published_v1` rule feeds the QUALITY meter off it and
 * must never be able to fail a customer's write.
 */
@Injectable()
export class ReviewsService {
  /** REV-01 — the only two line states that open the review gate. */
  private static readonly REVIEWABLE: OrderItemStatus[] = [
    OrderItemStatus.delivered,
    OrderItemStatus.attended,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── customer writes ──────────────────────────────────────────────────────

  /**
   * REV-01 — one review per delivered/attended order item.
   *
   * Ownership is checked before status so a customer probing another account's
   * order ids gets the same `403` whatever state the line is in.
   */
  async create(customerId: string, dto: CreateReviewDto): Promise<Review> {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: dto.order_item_id },
      select: {
        id: true,
        status: true,
        product_id: true,
        order: { select: { customer_id: true } },
      },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.order?.customer_id !== customerId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    if (!ReviewsService.REVIEWABLE.includes(item.status)) {
      throw new BadRequestException(
        'You can review an item once it has been delivered',
      );
    }

    const cfg = await this.settings.get('reviews');
    const status =
      dto.rating >= cfg.auto_publish_min_rating
        ? ReviewStatus.published
        : ReviewStatus.pending;

    let review: Review;
    try {
      review = await this.prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: {
            product_id: item.product_id,
            customer_id: customerId,
            order_item_id: item.id,
            rating: dto.rating,
            title: dto.title ?? null,
            body: dto.body ?? null,
            media: dto.media ?? [],
            status,
          },
        });
        // Only a published row moves the average, so a `pending` review costs
        // no extra write here — the rollup runs when a moderator publishes it.
        if (status === ReviewStatus.published) {
          await this.rollup(tx, created.product_id);
        }
        await this.audit.record(tx, {
          entity_type: 'review',
          entity_id: created.id,
          action:
            status === ReviewStatus.published
              ? 'review.published'
              : 'review.created',
          node_id: created.node_id,
          ...AuditService.customer(customerId),
          after: {
            status,
            rating: created.rating,
            product_id: created.product_id,
            order_item_id: created.order_item_id,
          },
        });
        return created;
      });
    } catch (err) {
      // The unique index is the real guard: two concurrent submits both pass
      // the eligibility read, and exactly one survives the insert.
      if (hasPrismaCode(err, 'P2002')) {
        throw new ConflictException('You have already reviewed this item');
      }
      throw err;
    }

    if (review.status === ReviewStatus.published) {
      this.emitPublished(review, customerActor(customerId));
    }
    return review;
  }

  // ─── staff moderation ─────────────────────────────────────────────────────

  /**
   * REV-02 — publish or hide, restricted to `MANAGE_OPS` at the controller.
   *
   * The rollup runs on **both** verbs: hiding a review is an un-publish, and
   * leaving the stale average behind would let a moderator remove a 1-star
   * review from the page while the product still showed the depressed score.
   */
  async moderate(
    id: string,
    status: ReviewStatus,
    userId: string | null,
    note?: string,
  ): Promise<Review> {
    const { review, becamePublished } = await this.prisma.$transaction(
      async (tx) => {
        const before = await tx.review.findUnique({ where: { id } });
        if (!before) throw new NotFoundException('Review not found');
        const after = await tx.review.update({
          where: { id },
          data: {
            status,
            moderated_by: userId,
            moderated_at: new Date(),
          },
        });
        await this.rollup(tx, after.product_id);
        await this.audit.record(tx, {
          entity_type: 'review',
          entity_id: id,
          action:
            status === ReviewStatus.published
              ? 'review.published'
              : 'review.hidden',
          node_id: after.node_id,
          ...AuditService.user(userId),
          before: { status: before.status },
          after: { status, ...(note ? { note } : {}) },
        });
        return {
          review: after,
          becamePublished:
            status === ReviewStatus.published &&
            before.status !== ReviewStatus.published,
        };
      },
    );

    // Re-publishing an already-published row is a no-op for the bridge: the
    // QUALITY meter must not tick twice because a moderator clicked twice.
    if (becamePublished) this.emitPublished(review, userActor(userId));
    return review;
  }

  // ─── reads ────────────────────────────────────────────────────────────────

  /** `GET /reviews?status=&cursor=&limit=` — the moderation queue, newest first. */
  async listForModeration(
    status: ReviewStatusFilter = ReviewStatus.pending,
    cursor?: string,
    limit = DEFAULT_PAGE,
  ) {
    const take = Math.min(Number(limit) || DEFAULT_PAGE, MAX_PAGE);
    const rows = await this.prisma.review.findMany({
      where: status === REVIEW_STATUS_ALL ? {} : { status },
      orderBy: { created_at: 'desc' },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: MODERATION_INCLUDE,
    });
    return page(rows, take);
  }

  /** `GET /catalog/products/:id/reviews` — public, `published` only. */
  async listPublic(productId: string, cursor?: string, limit = PUBLIC_PAGE) {
    const take = Math.min(Number(limit) || PUBLIC_PAGE, MAX_PAGE);
    const rows = await this.prisma.review.findMany({
      where: { product_id: productId, status: ReviewStatus.published },
      orderBy: { created_at: 'desc' },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: PUBLIC_SELECT,
    });
    return page(rows, take);
  }

  /** `GET /customer/reviews` — the customer's own reviews, any status. */
  async listForCustomer(customerId: string) {
    return this.prisma.review.findMany({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' },
      take: CUSTOMER_PAGE,
      select: MINE_SELECT,
    });
  }

  /**
   * `GET /customer/reviews/pending` (ACCT-02 / REV-02) — what this customer may
   * still review: delivered or attended lines with no `Review` row yet.
   */
  async pendingForCustomer(customerId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { customer_id: customerId },
        status: { in: ReviewsService.REVIEWABLE },
        review: null,
      },
      select: {
        id: true,
        product: { select: { id: true, name: true, slug: true } },
        order: { select: { id: true, order_number: true, created_at: true } },
      },
      orderBy: { created_at: 'desc' },
      take: CUSTOMER_PAGE,
    });
    // The API appendix keys this list on `order_item_id`, because that is what
    // `POST /customer/reviews` takes — returning the raw `id` of an order item
    // would make the storefront guess which id the write wants.
    return items.map((item) => ({
      order_item_id: item.id,
      product: item.product,
      order: item.order,
    }));
  }

  // ─── internals ────────────────────────────────────────────────────────────

  /**
   * SPEC §5.4 rollup: `Product.rating_avg` / `rating_count` recomputed from the
   * product's **published** reviews, inside the caller's transaction so the
   * average can never disagree with the rows it summarises. A product with no
   * published review gets `rating_avg = null` (not `0`), so the storefront can
   * tell "unrated" from "rated badly".
   */
  private async rollup(tx: Tx, productId: string): Promise<void> {
    const agg = await tx.review.aggregate({
      where: { product_id: productId, status: ReviewStatus.published },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const count = agg._count._all;
    const avg = agg._avg.rating;
    await tx.product.update({
      where: { id: productId },
      data: {
        rating_count: count,
        rating_avg:
          count > 0 && avg !== null ? new Prisma.Decimal(avg.toFixed(2)) : null,
      },
    });
  }

  /** Fired after commit only; `emitDomainEvent` isolates listener failures. */
  private emitPublished(review: Review, actor: DomainEventActor): void {
    emitDomainEvent(this.eventEmitter, DomainEvent.REVIEW_PUBLISHED, {
      ...domainEventBase(review.node_id, actor),
      reviewId: review.id,
      productId: review.product_id,
      rating: review.rating,
    });
  }
}
