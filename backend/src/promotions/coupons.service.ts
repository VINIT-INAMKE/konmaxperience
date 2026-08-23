import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CouponStatus, CouponType, Prisma, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import type { Tx } from '../common/types/transaction';
import { hasPrismaCode } from '../common/utils/transaction-retry';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  type DomainEventActor,
  type DomainEventPayload,
} from '../common/events/domain-events';
import {
  clampPaise,
  percentOfPaise,
  sumPaise,
  toDecimal,
  toPaise,
  type Paise,
} from '../common/money/money';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

/**
 * The slice of a priced cart line coupon evaluation needs: what kind of product
 * it is, and the gross (tax-inclusive) line total in paise.
 *
 * Declared structurally rather than imported from `checkout/quote.types.ts`
 * (Task 5, same wave) so the two tasks can land in parallel — and *kept*
 * structural after the merge, because `PricedLine` is a strict superset:
 * `PricedLine[]` is assignable to `CouponLine[]` with no cast and no import,
 * which is a smaller coupling than a type import would be.
 */
export interface CouponLine {
  type: ProductType;
  /** Line total in integer paise, tax **inclusive** (decision 1). */
  gross: Paise;
}

/** Everything eligibility depends on, all of it computed server-side. */
export interface CouponContext {
  customerId: string;
  lines: readonly CouponLine[];
  /** Gross, tax-inclusive cart subtotal in paise — the base `min_order` is compared against. */
  subtotal: Paise;
  /** True when at least one line has `fulfilment = shipped`; gates `free_shipping`. */
  hasShipped: boolean;
}

export interface CouponEvaluation {
  coupon: { id: string; code: string; type: CouponType };
  /** Discount in paise, applied to the order subtotal. Always `0` for `free_shipping`. */
  discount: Paise;
  /** When true the caller zeroes `shipping_amount` instead of reducing the subtotal. */
  free_shipping: boolean;
}

/** The `POST /customer/coupons/validate` response body. */
export interface CouponValidation {
  valid: true;
  code: string;
  type: CouponType;
  /**
   * Rupees. `DecimalSerializationInterceptor` turns this into a JSON number
   * (`200`, not `"200.00"`) on the way out — decision 3.
   */
  discount: Prisma.Decimal;
  free_shipping: boolean;
}

export interface RedeemCouponInput {
  couponId: string;
  orderId: string;
  customerId: string;
  /** The discount actually applied to the order, in paise. */
  amount: Paise;
  /** Copied onto the `coupon.redeemed` envelope; defaults to the order's node. */
  nodeId: string;
  actor: DomainEventActor;
}

export type CouponRedeemedEvent = DomainEventPayload<
  typeof DomainEvent.COUPON_REDEEMED
>;

export interface RedeemCouponResult {
  redemption: {
    id: string;
    coupon_id: string;
    order_id: string;
    customer_id: string;
    amount: Prisma.Decimal;
  };
  /**
   * Ready-to-emit `coupon.redeemed` payload. `redeem` runs *inside* the confirm
   * transaction, and SPEC §4.1 requires events to fire only after it commits —
   * so the payload is handed back rather than emitted, and the caller passes it
   * to {@link CouponsService.emitRedeemed} once `$transaction` resolves.
   */
  event: CouponRedeemedEvent;
}

const COUPON_LIST_INCLUDE = {
  _count: { select: { redemptions: true } },
} as const;

const MAX_PERCENT = 100;
const DEFAULT_PAGE = 50;
const MAX_PAGE = 200;

/** `Coupon` fields worth keeping in an audit `before`/`after` snapshot, JSON-safe. */
function auditSnapshot(coupon: {
  code: string;
  type: CouponType;
  value: Prisma.Decimal;
  min_order: Prisma.Decimal | null;
  max_discount: Prisma.Decimal | null;
  applies_to: ProductType[];
  starts_at: Date;
  ends_at: Date;
  usage_limit: number | null;
  per_customer_limit: number | null;
  status: CouponStatus;
}): Prisma.InputJsonValue {
  return {
    code: coupon.code,
    type: coupon.type,
    value: String(coupon.value),
    min_order: coupon.min_order === null ? null : String(coupon.min_order),
    max_discount:
      coupon.max_discount === null ? null : String(coupon.max_discount),
    applies_to: coupon.applies_to,
    starts_at: coupon.starts_at.toISOString(),
    ends_at: coupon.ends_at.toISOString(),
    usage_limit: coupon.usage_limit,
    per_customer_limit: coupon.per_customer_limit,
    status: coupon.status,
  };
}

/**
 * Coupons: staff CRUD plus the **only** place in the codebase a coupon discount
 * is computed (`PROMO-02`). The client never sends a discount and never sends
 * an eligibility verdict — it sends a code, and {@link CouponsService.evaluate}
 * decides. `CheckoutService` calls the same method the storefront's
 * `validate` endpoint calls, so a quote and a preview can never disagree.
 */
@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── staff CRUD ────────────────────────────────────────────────────────────

  async list(cursor?: string, limit: number = DEFAULT_PAGE) {
    const take = Math.min(Number(limit) || DEFAULT_PAGE, MAX_PAGE);
    // One extra row is the cheapest way to know whether a next page exists
    // without a second COUNT over a table that grows with every promotion.
    const rows = await this.prisma.coupon.findMany({
      orderBy: { created_at: 'desc' },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: COUPON_LIST_INCLUDE,
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      next_cursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: COUPON_LIST_INCLUDE,
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async create(dto: CreateCouponDto, userId: string) {
    const startsAt = new Date(dto.starts_at);
    const endsAt = new Date(dto.ends_at);
    assertWindow(startsAt, endsAt);
    assertValueForType(dto.type, dto.value);

    try {
      return await this.prisma.$transaction(async (tx: Tx) => {
        const created = await tx.coupon.create({
          data: {
            code: normaliseCode(dto.code),
            description: dto.description ?? '',
            type: dto.type,
            value: new Prisma.Decimal(dto.value),
            min_order:
              dto.min_order == null ? null : new Prisma.Decimal(dto.min_order),
            max_discount:
              dto.max_discount == null
                ? null
                : new Prisma.Decimal(dto.max_discount),
            applies_to: dto.applies_to ?? [],
            starts_at: startsAt,
            ends_at: endsAt,
            usage_limit: dto.usage_limit ?? null,
            per_customer_limit: dto.per_customer_limit ?? null,
            status: dto.status ?? CouponStatus.draft,
            created_by: userId,
          },
          include: COUPON_LIST_INCLUDE,
        });
        await this.audit.record(tx, {
          entity_type: 'coupon',
          entity_id: created.id,
          action: 'coupon.created',
          node_id: created.node_id,
          ...AuditService.user(userId),
          after: auditSnapshot(created),
        });
        return created;
      });
    } catch (err) {
      throw asCodeConflict(err, normaliseCode(dto.code));
    }
  }

  async update(id: string, dto: UpdateCouponDto, userId: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');

    // The window is validated against the *merged* row: patching only
    // `ends_at` must still be checked against the stored `starts_at`.
    const startsAt =
      dto.starts_at === undefined
        ? existing.starts_at
        : new Date(dto.starts_at);
    const endsAt =
      dto.ends_at === undefined ? existing.ends_at : new Date(dto.ends_at);
    assertWindow(startsAt, endsAt);
    assertValueForType(
      dto.type ?? existing.type,
      dto.value === undefined ? existing.value : dto.value,
    );

    try {
      return await this.prisma.$transaction(async (tx: Tx) => {
        const updated = await tx.coupon.update({
          where: { id },
          data: {
            ...(dto.code === undefined
              ? {}
              : { code: normaliseCode(dto.code) }),
            ...(dto.description === undefined
              ? {}
              : { description: dto.description }),
            ...(dto.type === undefined ? {} : { type: dto.type }),
            ...(dto.value === undefined
              ? {}
              : { value: new Prisma.Decimal(dto.value) }),
            // `null` clears the column; `undefined` leaves it alone.
            ...(dto.min_order === undefined
              ? {}
              : {
                  min_order:
                    dto.min_order === null
                      ? null
                      : new Prisma.Decimal(dto.min_order),
                }),
            ...(dto.max_discount === undefined
              ? {}
              : {
                  max_discount:
                    dto.max_discount === null
                      ? null
                      : new Prisma.Decimal(dto.max_discount),
                }),
            ...(dto.applies_to === undefined
              ? {}
              : { applies_to: dto.applies_to }),
            ...(dto.starts_at === undefined ? {} : { starts_at: startsAt }),
            ...(dto.ends_at === undefined ? {} : { ends_at: endsAt }),
            ...(dto.usage_limit === undefined
              ? {}
              : { usage_limit: dto.usage_limit }),
            ...(dto.per_customer_limit === undefined
              ? {}
              : { per_customer_limit: dto.per_customer_limit }),
            ...(dto.status === undefined ? {} : { status: dto.status }),
          },
          include: COUPON_LIST_INCLUDE,
        });
        await this.audit.record(tx, {
          entity_type: 'coupon',
          entity_id: id,
          action: 'coupon.updated',
          node_id: updated.node_id,
          ...AuditService.user(userId),
          before: auditSnapshot(existing),
          after: auditSnapshot(updated),
        });
        return updated;
      });
    } catch (err) {
      throw asCodeConflict(err, dto.code ? normaliseCode(dto.code) : '');
    }
  }

  /**
   * `DELETE /promotions/coupons/:id` is a **disable**, not a delete:
   * `CouponRedemption.coupon_id` is `onDelete: Restrict`, and a redeemed coupon
   * is part of an order's financial history.
   */
  async archive(id: string, userId: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');

    return this.prisma.$transaction(async (tx: Tx) => {
      const updated = await tx.coupon.update({
        where: { id },
        data: { status: CouponStatus.disabled },
        include: COUPON_LIST_INCLUDE,
      });
      await this.audit.record(tx, {
        entity_type: 'coupon',
        entity_id: id,
        action: 'coupon.archived',
        node_id: updated.node_id,
        ...AuditService.user(userId),
        before: auditSnapshot(existing),
        after: auditSnapshot(updated),
      });
      return updated;
    });
  }

  // ─── validation (PROMO-02) ────────────────────────────────────────────────

  /**
   * The **only** place a discount is computed. Called from the quote
   * (`CheckoutService`) and from `POST /customer/coupons/validate`; never from
   * the client, which supplies a code and nothing else.
   *
   * Throws `BadRequestException` with a message written for the customer —
   * every rejection reason is one the storefront shows verbatim.
   */
  async evaluate(code: string, ctx: CouponContext): Promise<CouponEvaluation> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: normaliseCode(code) },
    });
    if (!coupon) throw new BadRequestException('Invalid coupon code');
    if (coupon.status !== CouponStatus.active) {
      throw new BadRequestException('This coupon is not active');
    }

    const now = new Date();
    if (now < coupon.starts_at) {
      throw new BadRequestException('This coupon is not active yet');
    }
    if (now > coupon.ends_at) {
      throw new BadRequestException('This coupon has expired');
    }

    // `applies_to` empty means "every product type" (the column default).
    const applies =
      coupon.applies_to.length === 0
        ? ctx.lines
        : ctx.lines.filter((line) => coupon.applies_to.includes(line.type));
    const eligible = sumPaise(applies.map((line) => line.gross));
    if (eligible === 0) {
      throw new BadRequestException(
        'This coupon does not apply to the items in your cart',
      );
    }

    // `min_order` is measured against the whole cart subtotal, not the eligible
    // subset: "spend ₹500 to get 10% off packaged goods" is the offer staff mean.
    if (coupon.min_order !== null) {
      const floor = toPaise(coupon.min_order);
      if (ctx.subtotal < floor) {
        const short = toDecimal(floor - ctx.subtotal).toFixed(2);
        throw new BadRequestException(`Add ₹${short} more to use this coupon`);
      }
    }

    // Counting rows is the source of truth for both limits (decision 14): a
    // denormalised counter would drift under the Serializable confirm retry.
    // Skip the query entirely when the corresponding limit is null.
    const [used, usedByCustomer] = await Promise.all([
      coupon.usage_limit == null
        ? Promise.resolve(0)
        : this.prisma.couponRedemption.count({
            where: { coupon_id: coupon.id },
          }),
      coupon.per_customer_limit == null
        ? Promise.resolve(0)
        : this.prisma.couponRedemption.count({
            where: { coupon_id: coupon.id, customer_id: ctx.customerId },
          }),
    ]);
    if (coupon.usage_limit != null && used >= coupon.usage_limit) {
      throw new BadRequestException('This coupon has been fully redeemed');
    }
    if (
      coupon.per_customer_limit != null &&
      usedByCustomer >= coupon.per_customer_limit
    ) {
      throw new BadRequestException('You have already used this coupon');
    }

    if (coupon.type === CouponType.free_shipping) {
      if (!ctx.hasShipped) {
        throw new BadRequestException(
          'This coupon applies to shipped items only',
        );
      }
      return {
        coupon: { id: coupon.id, code: coupon.code, type: coupon.type },
        discount: 0,
        free_shipping: true,
      };
    }

    const raw =
      coupon.type === CouponType.percent
        ? percentOfPaise(eligible, coupon.value)
        : toPaise(coupon.value);
    // A `fixed` coupon larger than the cart, and a `percent` coupon past its
    // `max_discount`, both collapse to the same clamp — a discount can never
    // exceed the eligible base, so an order total can never go negative.
    const cap =
      coupon.max_discount === null ? eligible : toPaise(coupon.max_discount);
    const discount = clampPaise(raw, 0, Math.min(cap, eligible));

    return {
      coupon: { id: coupon.id, code: coupon.code, type: coupon.type },
      discount,
      free_shipping: false,
    };
  }

  /**
   * `POST /customer/coupons/validate` — {@link evaluate} shaped for the wire.
   * An ineligible code throws; there is no `{ valid: false }` branch, because
   * the *reason* is the useful part and `BadRequestException` carries it.
   */
  async validate(code: string, ctx: CouponContext): Promise<CouponValidation> {
    const evaluation = await this.evaluate(code, ctx);
    return {
      valid: true,
      code: evaluation.coupon.code,
      type: evaluation.coupon.type,
      discount: toDecimal(evaluation.discount),
      free_shipping: evaluation.free_shipping,
    };
  }

  /**
   * `PROMO-02`: no stacking. `ValidateCouponDto` already makes two codes
   * unsayable over HTTP; this is the same rule at the service boundary, for
   * callers (the quote path) that assemble codes themselves. Reads
   * `promotions.allow_stacking` so turning stacking on later is a settings
   * change rather than a code change — it ships `false`.
   */
  async assertSingleCoupon(codes: readonly string[]): Promise<void> {
    if (codes.length <= 1) return;
    const promotions = await this.settings.get('promotions');
    if (!promotions.allow_stacking) {
      throw new BadRequestException('Only one coupon can be applied per order');
    }
  }

  // ─── redemption ───────────────────────────────────────────────────────────

  /**
   * Records the redemption **inside the caller's transaction** — this is the
   * hook `FulfilmentService.confirmPaidOrder` calls from
   * `applyCommercialEffects`, so the `CouponRedemption` row commits with the
   * `Order` it belongs to or not at all.
   *
   * Idempotent by `@@unique([coupon_id, order_id])`: an `upsert` rather than a
   * `create`, because a P2002 inside a Serializable transaction aborts the
   * whole transaction and there would be no paid order left to recover.
   *
   * Deliberately does **not** re-check `usage_limit`/`per_customer_limit`.
   * Eligibility was decided at quote time; by the time this runs the customer
   * has paid, and failing a captured payment to protect a promotion budget is
   * the wrong trade. A race can over-redeem by at most the number of payments
   * in flight, and every one of them is recorded here for staff to see.
   */
  async redeem(tx: Tx, input: RedeemCouponInput): Promise<RedeemCouponResult> {
    const amount = toDecimal(input.amount);
    const redemption = await tx.couponRedemption.upsert({
      where: {
        coupon_id_order_id: {
          coupon_id: input.couponId,
          order_id: input.orderId,
        },
      },
      create: {
        coupon_id: input.couponId,
        order_id: input.orderId,
        customer_id: input.customerId,
        amount,
      },
      update: { amount },
      include: { coupon: { select: { code: true } } },
    });

    await this.audit.record(tx, {
      entity_type: 'coupon',
      entity_id: input.couponId,
      action: 'coupon.redeemed',
      node_id: input.nodeId,
      actor_type: input.actor.actor_type,
      actor_id: input.actor.actor_id,
      after: {
        order_id: input.orderId,
        customer_id: input.customerId,
        amount: String(amount),
      },
    });

    return {
      redemption: {
        id: redemption.id,
        coupon_id: redemption.coupon_id,
        order_id: redemption.order_id,
        customer_id: redemption.customer_id,
        amount: redemption.amount,
      },
      event: {
        ...domainEventBase(input.nodeId, input.actor),
        couponId: input.couponId,
        code: redemption.coupon.code,
        orderId: input.orderId,
        amount: String(amount),
      },
    };
  }

  /** Emit the payload {@link redeem} returned — **after** the transaction commits. */
  emitRedeemed(event: CouponRedeemedEvent): void {
    emitDomainEvent(this.eventEmitter, DomainEvent.COUPON_REDEEMED, event);
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Coupon codes are case- and whitespace-insensitive to the customer typing
 * them, so they are normalised on the way in *and* on the way out of the
 * lookup — `Coupon.code @unique` then genuinely means "one coupon per code".
 */
function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

function assertWindow(startsAt: Date, endsAt: Date): void {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new BadRequestException('starts_at and ends_at must be valid dates');
  }
  if (startsAt >= endsAt) {
    throw new BadRequestException('starts_at must be before ends_at');
  }
}

/** A `percent` coupon above 100% is corrupt data, not a 150% refund. */
function assertValueForType(
  type: CouponType,
  value: Prisma.Decimal | number,
): void {
  if (type !== CouponType.percent) return;
  if (new Prisma.Decimal(value).greaterThan(MAX_PERCENT)) {
    throw new BadRequestException(
      'A percent coupon value must be between 0 and 100',
    );
  }
}

/** Turns the `code @unique` violation into the 409 a staff form can render. */
function asCodeConflict(err: unknown, code: string): unknown {
  if (hasPrismaCode(err, 'P2002')) {
    return new ConflictException(
      code
        ? `A coupon with the code ${code} already exists`
        : 'A coupon with this code already exists',
    );
  }
  return err;
}
