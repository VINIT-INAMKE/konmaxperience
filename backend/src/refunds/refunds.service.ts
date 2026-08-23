import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { AuditService } from '../audit/audit.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import type { Tx } from '../common/types/transaction';
import { toDecimal, toPaise, type Paise } from '../common/money/money';
import {
  SERIALIZABLE_TX_OPTIONS,
  withSerializableRetry,
} from '../common/utils/transaction-retry';
import { CreateRefundDto } from './dto/create-refund.dto';

/**
 * The `payload.refund.entity` Razorpay sends on `refund.processed`. `amount` is
 * in **paise**, as everything on the wire from Razorpay is.
 */
export interface GatewayRefundEntity {
  id: string;
  payment_id: string;
  amount: number;
  notes?: { reason?: string } | null;
}

/** The `Payment` columns a settlement needs; keeps the two call sites honest. */
type SettlementPayment = {
  id: string;
  order_id: string;
  amount: Prisma.Decimal | number | string;
  status: PaymentStatus;
};

/** Reason stamped on a `Refund` row this service had no prior record of. */
export const RECONCILED_REFUND_REASON = 'Gateway refund (reconciled)';

/** Note written on the clawed-back `LoyaltyTransaction` when an order is fully refunded. */
export const LOYALTY_REVERSAL_NOTE = 'Reversed on refund';

/**
 * CHK-05 — the single owner of `Refund` rows and of `Payment.refunded_amount`.
 *
 * Two entry points write refunds and they must not diverge:
 *
 * - {@link refund} is the staff act (`POST /orders/:id/refund`). It opens a
 *   `pending` row *before* calling Razorpay so a crash between the two leaves an
 *   auditable row rather than silence, then settles optimistically on a
 *   successful API response.
 * - {@link reconcileGatewayRefund} is the `refund.processed` webhook, which is
 *   the *authority*: Razorpay may take hours to actually move the money, and a
 *   refund created outside this system (the dashboard, a support agent) only
 *   ever reaches us this way.
 *
 * Both funnel into {@link settle}, which never trusts a running total: it
 * re-derives `Payment.refunded_amount` by summing the `processed` `Refund` rows
 * inside the transaction. That is what makes a partial refund distinguishable
 * from a full one — the defect this task fixes was flipping `Payment.status` to
 * `refunded` for *any* refund, however small.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly audit: AuditService,
    private readonly loyalty: LoyaltyService,
  ) {}

  /** `GET /orders/:id/refunds` — the refund ledger for one order, newest first. */
  async list(orderId: string) {
    return this.prisma.refund.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * `POST /orders/:id/refund`. `dto.amount` is in rupees and optional — omitted
   * means the whole refundable balance.
   */
  async refund(orderId: string, dto: CreateRefundDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const payment = order.payment;
    if (!payment) {
      throw new BadRequestException('This order has no payment to refund');
    }
    if (
      payment.status !== PaymentStatus.paid &&
      payment.status !== PaymentStatus.partially_refunded
    ) {
      throw new BadRequestException(
        `Cannot refund a payment with status ${payment.status}`,
      );
    }
    if (
      payment.method !== PaymentMethod.razorpay ||
      !payment.razorpay_payment_id
    ) {
      throw new BadRequestException(
        'Only Razorpay payments can be refunded from here — record cash/UPI refunds manually',
      );
    }

    const paid = toPaise(payment.amount);
    const alreadyRefunded = toPaise(payment.refunded_amount);
    const refundable = paid - alreadyRefunded;
    const requested = dto.amount != null ? toPaise(dto.amount) : refundable;
    if (requested <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }
    if (requested > refundable) {
      throw new BadRequestException(
        `Only ₹${toDecimal(refundable).toFixed(2)} is left to refund on this order`,
      );
    }

    // Written before the gateway call on purpose: if the process dies mid-flight
    // the operator sees a `pending` row instead of a silent hole, and the sum in
    // `settle` ignores it because only `processed` rows count.
    const opened = await this.prisma.refund.create({
      data: {
        order_id: orderId,
        payment_id: payment.id,
        amount: toDecimal(requested),
        reason: dto.reason,
        status: RefundStatus.pending,
        requested_by: userId,
      },
    });

    let gatewayId: string | null = null;
    try {
      const result = await this.razorpay.createRefund(
        payment.razorpay_payment_id,
        requested,
        dto.reason,
      );
      gatewayId = result?.id ?? null;
    } catch (err) {
      await this.prisma.refund.update({
        where: { id: opened.id },
        data: { status: RefundStatus.failed },
      });
      throw new BadRequestException(
        `Refund failed at the gateway: ${(err as Error).message}`,
      );
    }

    return withSerializableRetry(() =>
      this.prisma.$transaction(async (tx) => {
        // `Refund.razorpay_refund_id` is unique, and the webhook may have landed
        // while our HTTP call was in flight. If it claimed this gateway id first
        // it has already settled the payment, so drop the duplicate row we opened
        // rather than trip the constraint.
        const claimed = gatewayId
          ? await tx.refund.findUnique({
              where: { razorpay_refund_id: gatewayId },
            })
          : null;
        if (claimed && claimed.id !== opened.id) {
          await tx.refund.delete({ where: { id: opened.id } });
          return claimed;
        }

        const settled = await tx.refund.update({
          where: { id: opened.id },
          data: {
            status: RefundStatus.processed,
            razorpay_refund_id: gatewayId,
          },
        });

        const { refunded, full } = await this.settle(tx, payment, userId);

        await this.audit.record(tx, {
          entity_type: 'order',
          entity_id: orderId,
          action: 'order.refunded',
          ...AuditService.user(userId),
          before: {
            refunded_amount: toDecimal(alreadyRefunded).toFixed(2),
            payment_status: payment.status,
          },
          after: {
            refunded_amount: toDecimal(refunded).toFixed(2),
            payment_status: full
              ? PaymentStatus.refunded
              : PaymentStatus.partially_refunded,
            refund_id: settled.id,
            razorpay_refund_id: gatewayId,
            amount: toDecimal(requested).toFixed(2),
            reason: dto.reason,
          },
        });

        return settled;
      }, SERIALIZABLE_TX_OPTIONS),
    );
  }

  /**
   * The `refund.processed` branch of the Razorpay webhook.
   *
   * Idempotent on `Refund.razorpay_refund_id`: a redelivery of an already
   * `processed` refund returns without writing. A refund this system never
   * initiated (Razorpay dashboard, support agent) creates a reconciliation-only
   * row so the ledger still balances.
   */
  async reconcileGatewayRefund(entity: GatewayRefundEntity): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { razorpay_payment_id: entity.payment_id },
    });
    if (!payment) {
      this.logger.warn(
        `refund.processed ${entity.id} references unknown payment ${entity.payment_id} — ignored`,
      );
      return;
    }

    const existing = await this.prisma.refund.findUnique({
      where: { razorpay_refund_id: entity.id },
    });
    if (existing?.status === RefundStatus.processed) return;

    await withSerializableRetry(() =>
      this.prisma.$transaction(async (tx) => {
        // A staff refund whose gateway call succeeded lands here as `pending`
        // (or `failed`, if Razorpay first said no and then processed it anyway);
        // either way the webhook is the authority and promotes it.
        const row = existing
          ? await tx.refund.update({
              where: { id: existing.id },
              data: { status: RefundStatus.processed },
            })
          : await tx.refund.create({
              data: {
                order_id: payment.order_id,
                payment_id: payment.id,
                amount: toDecimal(entity.amount),
                reason: entity.notes?.reason ?? RECONCILED_REFUND_REASON,
                razorpay_refund_id: entity.id,
                status: RefundStatus.processed,
              },
            });

        const { refunded, full } = await this.settle(tx, payment, null);

        await this.audit.record(tx, {
          entity_type: 'order',
          entity_id: payment.order_id,
          action: 'order.refund_reconciled',
          actor_type: ActorType.system,
          actor_id: null,
          before: {
            refunded_amount: toDecimal(
              toPaise(payment.refunded_amount),
            ).toFixed(2),
            payment_status: payment.status,
          },
          after: {
            refund_id: row.id,
            razorpay_refund_id: entity.id,
            refunded_amount: toDecimal(refunded).toFixed(2),
            payment_status: full
              ? PaymentStatus.refunded
              : PaymentStatus.partially_refunded,
          },
        });
      }, SERIALIZABLE_TX_OPTIONS),
    );
  }

  /**
   * Re-derives the refunded total from the `processed` `Refund` rows and applies
   * it to the payment, the order and the loyalty ledger.
   *
   * Summing rather than incrementing is the whole point: two concurrent partial
   * refunds that each added their own delta to `refunded_amount` would double
   * count under a Serializable retry, and a webhook redelivery would too.
   *
   * `Payment.status` becomes `refunded` **only** when the sum reaches the amount
   * paid; anything short of that is `partially_refunded`. Only a full refund
   * moves the order to `refunded` and claws the loyalty points back —
   * `LoyaltyService.reverse` is itself idempotent per order.
   */
  private async settle(
    tx: Tx,
    payment: SettlementPayment,
    updatedBy: string | null,
  ): Promise<{ refunded: Paise; full: boolean }> {
    const paid = toPaise(payment.amount);
    const totals = await tx.refund.aggregate({
      where: { payment_id: payment.id, status: RefundStatus.processed },
      _sum: { amount: true },
    });
    const refunded = toPaise(totals._sum.amount ?? 0);
    const full = refunded >= paid;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        refunded_amount: toDecimal(refunded),
        status: full
          ? PaymentStatus.refunded
          : PaymentStatus.partially_refunded,
      },
    });

    if (!full) return { refunded, full };

    const order = await tx.order.update({
      where: { id: payment.order_id },
      data: {
        status: OrderStatus.refunded,
        // The webhook has no staff actor; leave whoever touched the order last.
        ...(updatedBy ? { updated_by: updatedBy } : {}),
      },
      select: { id: true, customer_id: true },
    });

    // POS orders have no customer and therefore no loyalty to reverse.
    if (order.customer_id) {
      await this.loyalty.reverse(
        tx,
        order.customer_id,
        order.id,
        LOYALTY_REVERSAL_NOTE,
      );
    }

    return { refunded, full };
  }
}
