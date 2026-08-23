import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { AuditService, type AuditActor } from '../audit/audit.service';
import { toPaise, type Money, type Paise } from '../common/money/money';

/**
 * The two states a close-out may start from. `served` is the local counter's
 * hand-over, `delivered` the marketplace one; both are the last step before an
 * order stops moving. Kept in step with `STATUS_TRANSITIONS` in
 * `orders.service.ts` by a cross-check in `order-lifecycle.service.spec.ts`.
 */
export const COMPLETABLE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.served,
  OrderStatus.delivered,
];

/**
 * The columns the earn base is computed from — nothing else is read.
 * `shipping_amount` is deliberately absent: see {@link OrderLifecycleService.earnBase}.
 */
const EARN_SELECT = {
  id: true,
  customer_id: true,
  subtotal: true,
  discount_amount: true,
  loyalty_points_earned: true,
} as const;

/**
 * SPEC §5.2 step 6 — the tail of an order's life, after the money has settled.
 *
 * Two entry points, both idempotent:
 *
 * - {@link onDelivered} credits loyalty once the goods have landed. Every path
 *   into `delivered` funnels through it: the staff status PATCH, the rider's
 *   `delivery_status` update, and (via `OrdersService.updateOrderStatus`) the
 *   Shiprocket webhook's delivered fan-out.
 * - {@link complete} is the terminal close-out — POS "complete" and the daily
 *   close both land here — and credits as a backstop, so a local order that went
 *   `ready → served → completed` and never passed through `delivered` still earns.
 *
 * Exactly-once is the loyalty ledger's `@@unique([order_id, reason])`, not a flag
 * in this file: a replayed webhook, a double-clicked button and a rider marking
 * the same drop twice all converge on the same single `earn` row.
 *
 * **This service does not emit `order.delivered`.** `OrdersService` is the sole
 * emitter, at the status transition (Phase 31's wiring), so the event fires once
 * per order however many times the credit hook is replayed.
 */
@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger(OrderLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Credits the order's loyalty earn. Returns the points credited — `0` when the
   * order has no customer, has already earned, earns nothing at the configured
   * rate, or when the credit failed.
   *
   * **Never throws.** It runs *after* the status transaction has committed, so a
   * loyalty outage must not turn a delivered order into a 500 for the rider or
   * the courier's webhook; the failure is logged and the next delivery hook for
   * the same order (a webhook replay, or `complete`) picks it up.
   */
  async onDelivered(orderId: string, actor: AuditActor): Promise<number> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: EARN_SELECT,
      });
      // A POS walk-in has no loyalty account to credit.
      if (!order?.customer_id) return 0;
      if (order.loyalty_points_earned > 0) return 0; // already credited

      const txn = await this.loyalty.earnForOrder(
        order.id,
        order.customer_id,
        this.earnBase(order),
      );
      // `null` means "earned nothing" or "already in the ledger" — both no-ops.
      if (!txn) return 0;

      // The mirror column and its audit row commit together. The ledger row is
      // the source of truth: if this transaction lost, `loyalty_points_earned`
      // stays 0 while the points are real, and the `earn` row's unique index
      // stops a later hook from crediting twice.
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { loyalty_points_earned: txn.delta },
        });
        await this.audit.record(tx, {
          entity_type: 'order',
          entity_id: order.id,
          action: 'order.loyalty_earned',
          actor_type: actor.actor_type,
          actor_id: actor.actor_id,
          before: { loyalty_points_earned: 0 },
          after: {
            loyalty_points_earned: txn.delta,
            loyalty_transaction_id: txn.id,
          },
        });
      });

      return txn.delta;
    } catch (err) {
      this.logger.warn(
        `loyalty earn for order ${orderId} failed: ${(err as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Terminal close-out. `served → completed` and `delivered → completed` are the
   * only legal starts; re-completing an already-`completed` order is a no-op so a
   * double-clicked button is not a 400.
   *
   * The status write and its `order.completed` AuditEvent share one transaction,
   * guarded optimistically on the status we read — the same shape
   * `OrdersService.updateOrderStatus` uses, so two staff closing the same order
   * cannot both win.
   */
  async complete(orderId: string, userId: string | null) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    if (order.status === OrderStatus.completed) {
      return this.prisma.order.findUnique({ where: { id: orderId } });
    }
    if (!COMPLETABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Cannot transition from "${order.status}" to "${OrderStatus.completed}". ` +
          `Valid transitions: ${COMPLETABLE_STATUSES.join(', ')} -> completed`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: OrderStatus.completed, updated_by: userId },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'Order status was changed by another request. Please retry.',
        );
      }

      await this.audit.record(tx, {
        entity_type: 'order',
        entity_id: orderId,
        action: 'order.completed',
        ...AuditService.user(userId),
        before: { status: order.status },
        after: { status: OrderStatus.completed },
      });
    });

    // Backstop for the local counter path: `ready → served → completed` never
    // touches `delivered`, so this is the only chance a dine-in order linked to a
    // customer gets to earn. Idempotent, so a delivered order credits nothing here.
    await this.onDelivered(orderId, AuditService.user(userId));

    return this.prisma.order.findUnique({ where: { id: orderId } });
  }

  /**
   * Points are earned on the goods value only: `subtotal − discount`, which is
   * the paid `total` with `shipping_amount` taken back off (decision 1:
   * `total = subtotal − discount + shipping`, and `tax_amount` is already inside
   * `subtotal`). Freight is a pass-through cost and never earns.
   */
  private earnBase(order: { subtotal: Money; discount_amount: Money }): Paise {
    return Math.max(
      toPaise(order.subtotal) - toPaise(order.discount_amount),
      0,
    );
  }
}
