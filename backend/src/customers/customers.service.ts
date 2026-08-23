import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

/** API appendix §C: `?limit=` defaults to 50 and is capped at 200. */
const DEFAULT_PAGE = 50;
const MAX_PAGE = 200;

/** How much history the staff detail screen loads in one shot (OPS-04). */
const DETAIL_ORDERS = 50;
const DETAIL_LOYALTY_TX = 50;
const DETAIL_REVIEWS = 50;
const DETAIL_REDEMPTIONS = 50;

/**
 * A `cancelled` or `refunded` order still happened, but it is not money the
 * villa kept — so it counts towards `total_orders` and never towards
 * `lifetime_value`.
 */
const NON_BILLABLE: OrderStatus[] = [
  OrderStatus.cancelled,
  OrderStatus.refunded,
];

/**
 * The whole `Customer` row is safe to return: the model carries no password,
 * no OTP and no token material — those live in Redis (`CustomerAuthService`)
 * and in `RefreshToken`, neither of which is reachable from this relation
 * graph. The list therefore selects by relation, not by field.
 */
const LIST_INCLUDE = {
  loyalty_account: true,
  _count: { select: { orders: true, reviews: true, bookings: true } },
} as const;

/** Enough of each order to render a row without a second round trip. */
const ORDER_INCLUDE = {
  items: {
    select: {
      id: true,
      product_id: true,
      variant_id: true,
      quantity: true,
      unit_price: true,
      status: true,
      fulfilment: true,
      tax_rate: true,
      product: { select: { id: true, name: true, slug: true } },
    },
  },
  payment: {
    select: {
      id: true,
      method: true,
      amount: true,
      status: true,
      refunded_amount: true,
      razorpay_payment_id: true,
      created_at: true,
    },
  },
} as const;

export interface CustomerOrdersSummary {
  /** Every order the customer ever placed, whatever its final status. */
  total_orders: number;
  /** Orders that are neither `cancelled` nor `refunded`. */
  billable_orders: number;
  /** Sum of `Order.total` over the billable orders, in rupees. */
  lifetime_value: Prisma.Decimal;
  last_order_at: Date | null;
}

/**
 * OPS-04 — the staff Customers screen.
 *
 * Two reads and one narrow write:
 *
 * 1. **`list`** is cursor-paginated over `created_at desc` with a `take + 1`
 *    over-fetch, the same shape every other P5a queue uses (`{ items,
 *    next_cursor }`), so the frontend has one pagination helper, not seven.
 *    The search predicate is a three-way `OR` over `phone`, `name` and
 *    `email`; `phone` is matched case-sensitively because it is digits, the
 *    other two `insensitive`.
 * 2. **`findOne`** fans out five bounded queries in parallel rather than one
 *    deep `include`: a customer with 5 000 orders must not be able to make the
 *    staff screen pull 5 000 rows, and Prisma cannot `take` a relation and
 *    aggregate it in the same query.
 * 3. **`update`** is the only writer of `Customer.marketing_opt_in` in the
 *    tree, and it writes an `AuditEvent` — consent changes are exactly the kind
 *    of fact a regulator asks about a year later.
 *
 * Loyalty adjustment is *not* here: `StaffLoyaltyController` in
 * `src/loyalty/loyalty.controller.ts` owns `POST /customers/:id/loyalty-adjust`
 * (P5a Task 7). Nest allows two controllers to share the `customers` prefix as
 * long as their paths differ.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * `GET /customers?q=&cursor=&limit=` — searchable by phone, name or email.
   *
   * Never returns OTP or token material; see {@link LIST_INCLUDE}.
   */
  async list(q?: string, cursor?: string, limit: number = DEFAULT_PAGE) {
    const take = Math.min(Number(limit) || DEFAULT_PAGE, MAX_PAGE);
    const term = q?.trim();
    // One extra row answers "is there a next page?" without a COUNT over a
    // table that grows with every storefront signup.
    const rows = await this.prisma.customer.findMany({
      where: term
        ? {
            OR: [
              { phone: { contains: term } },
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {},
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { created_at: 'desc' },
      include: LIST_INCLUDE,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      next_cursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  /**
   * `GET /customers/:id` — profile, spend summary, recent orders, the loyalty
   * account and its ledger, coupon redemptions and reviews.
   */
  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        loyalty_account: true,
        addresses: {
          orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
        },
        _count: {
          select: {
            orders: true,
            reviews: true,
            bookings: true,
            coupon_redemptions: true,
          },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const [orders, summary, loyaltyTransactions, redemptions, reviews] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { customer_id: id },
          orderBy: { created_at: 'desc' },
          take: DETAIL_ORDERS,
          include: ORDER_INCLUDE,
        }),
        this.ordersSummary(id),
        this.prisma.loyaltyTransaction.findMany({
          where: { customer_id: id },
          orderBy: { created_at: 'desc' },
          take: DETAIL_LOYALTY_TX,
        }),
        this.prisma.couponRedemption.findMany({
          where: { customer_id: id },
          orderBy: { created_at: 'desc' },
          take: DETAIL_REDEMPTIONS,
          include: {
            coupon: { select: { id: true, code: true, type: true } },
          },
        }),
        this.prisma.review.findMany({
          where: { customer_id: id },
          orderBy: { created_at: 'desc' },
          take: DETAIL_REVIEWS,
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        }),
      ]);

    return {
      ...customer,
      orders_summary: summary,
      orders,
      loyalty_transactions: loyaltyTransactions,
      coupon_redemptions: redemptions,
      reviews,
    };
  }

  /**
   * `PATCH /customers/:id` — the marketing consent toggle.
   *
   * Not in the API appendix's route table, but `Customer.marketing_opt_in`
   * (SPEC §3.3) would otherwise have no writer anywhere in the tree. The DTO
   * admits exactly one field, so this can never become a back door onto
   * `phone` (the login identity) or the loyalty balance.
   */
  async update(id: string, dto: UpdateCustomerDto, userId: string | null) {
    const before = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, marketing_opt_in: true },
    });
    if (!before) throw new NotFoundException('Customer not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: { marketing_opt_in: dto.marketing_opt_in },
      });
      await this.audit.record(tx, {
        entity_type: 'customer',
        entity_id: id,
        action: 'customer.marketing_opt_in_changed',
        ...AuditService.user(userId),
        before: { marketing_opt_in: before.marketing_opt_in },
        after: { marketing_opt_in: updated.marketing_opt_in },
      });
      return updated;
    });
  }

  /**
   * Two aggregates over `@@index([customer_id])`: one for the lifetime counts,
   * one for the money. Splitting them keeps `lifetime_value` honest about
   * cancellations without hiding those orders from `total_orders`.
   */
  private async ordersSummary(id: string): Promise<CustomerOrdersSummary> {
    const [all, billable] = await Promise.all([
      this.prisma.order.aggregate({
        where: { customer_id: id },
        _count: { _all: true },
        _max: { created_at: true },
      }),
      this.prisma.order.aggregate({
        where: { customer_id: id, status: { notIn: NON_BILLABLE } },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    return {
      total_orders: all._count._all,
      billable_orders: billable._count._all,
      lifetime_value: billable._sum.total ?? new Prisma.Decimal(0),
      last_order_at: all._max.created_at ?? null,
    };
  }
}
