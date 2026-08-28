import {
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { RazorpayService } from '../razorpay/razorpay.service';
import { RedisService } from '../customer-auth/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../chat/pusher.service';
import {
  FulfilmentService,
  OrderRefusedAndRefundedException,
  PendingOrderPayload,
  pendingTotalPaise,
} from '../fulfilment/fulfilment.service';
import {
  RefundsService,
  type GatewayRefundEntity,
} from '../refunds/refunds.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly razorpayService: RazorpayService,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly pusherService: PusherService,
    private readonly fulfilmentService: FulfilmentService,
    private readonly refundsService: RefundsService,
  ) {}

  async processWebhook(
    rawBody: Buffer | undefined,
    signature: string,
    eventId: string,
  ) {
    // 1. Validate rawBody exists
    if (!rawBody) throw new UnauthorizedException('Missing raw body');

    // 2. Verify webhook signature (D-10) — BEFORE any other processing
    const bodyStr = rawBody.toString();
    const isValid = this.razorpayService.verifyWebhookSignature(
      bodyStr,
      signature,
    );
    if (!isValid) throw new UnauthorizedException('Invalid webhook signature');

    // 3. Dedup by event_id (D-08) — Redis SET NX with 24h TTL
    // Fail CLOSED: if Redis is down, reject the webhook (Razorpay will retry later)
    const redis = this.redisService.getClient();
    if (!redis) {
      throw new ServiceUnavailableException(
        'Webhook dedup unavailable — retry later',
      );
    }
    const dedupKey = `webhook_processed:${eventId}`;
    const isNew = await redis.set(dedupKey, '1', 'EX', 86400, 'NX');
    if (!isNew) return { status: 'duplicate' };

    // 4. Parse and route
    const body = JSON.parse(bodyStr);
    const event = body.event as string;
    await this.routeWebhookEvent(event, body.payload);

    return { status: 'ok' };
  }

  private async routeWebhookEvent(event: string, payload: any) {
    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = payload.payment?.entity;
      if (!payment) return;

      const notes = payment.notes as { type?: string; entity_id?: string };
      if (!notes?.type || !notes?.entity_id) {
        this.logger.warn(
          `[Webhook] Missing routing metadata in notes: ${JSON.stringify(notes)}`,
        );
        return;
      }

      switch (notes.type) {
        case 'event_booking':
          await this.handleEventBookingPayment(payment, notes.entity_id);
          break;
        case 'pos_order':
          await this.handlePosOrderPayment(payment, notes.entity_id);
          break;
        case 'marketplace':
          await this.handleMarketplacePayment(payment, notes.entity_id);
          break;
        default:
          this.logger.warn(
            `[Webhook] Unknown payment type: ${String(notes.type)}`,
          );
      }
    } else if (event === 'payment.failed') {
      // Log but do not update status — customer can retry with same order
      const payment = payload.payment?.entity;
      this.logger.log(
        `[Webhook] Payment failed: ${payment?.id} for order ${payment?.order_id}`,
      );
    } else if (event === 'refund.processed') {
      await this.handleRefundProcessed(payload);
    } else if (event === 'refund.failed') {
      await this.handleRefundFailed(payload);
    }
  }

  private async handleEventBookingPayment(payment: any, eventId: string) {
    // Atomic idempotent update — WHERE clause prevents double-processing without read-then-write race
    const result = await this.prisma.eventBooking.updateMany({
      where: {
        razorpay_order_id: payment.order_id,
        payment_status: { not: 'paid' }, // only update if not already paid
      },
      data: {
        payment_status: 'paid',
        razorpay_payment_id: payment.id,
      },
    });
    if (result.count === 0) {
      this.logger.log(
        `[Webhook] Booking already paid or not found for order: ${payment.order_id}`,
      );
    }
  }

  private async handlePosOrderPayment(payment: any, orderId: string) {
    // Find or create Payment record for the order
    const existing = await this.prisma.payment.findFirst({
      where: { razorpay_order_id: payment.order_id },
    });
    if (existing && existing.status === PaymentStatus.paid) return; // idempotent

    if (existing) {
      await this.prisma.payment.update({
        where: { id: existing.id },
        data: {
          status: PaymentStatus.paid,
          razorpay_payment_id: payment.id,
        },
      });
    } else {
      // Create payment record from webhook (belt-and-suspenders with frontend confirm)
      await this.prisma.payment.create({
        data: {
          order_id: orderId,
          method: PaymentMethod.razorpay,
          amount: payment.amount / 100, // paise to rupees
          status: PaymentStatus.paid,
          razorpay_order_id: payment.order_id,
          razorpay_payment_id: payment.id,
        },
      });
    }

    // Update order status to paid if still placed
    await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.placed },
      data: { status: OrderStatus.preparing },
    });
  }

  private async handleMarketplacePayment(
    payment: { id: string; order_id: string; amount: number },
    customerId: string,
  ) {
    // Backup path — normal flow is POST /customer/orders/confirm. Same FulfilmentService path.
    const existing = await this.fulfilmentService.findOrderByRazorpayPaymentId(
      payment.id,
    );
    if (existing) return;

    const redis = this.redisService.getClient();
    if (!redis) return; // processWebhook already failed closed without Redis
    const pendingKey = `pending_order:${payment.order_id}`;
    const pendingRaw = await redis.getdel(pendingKey);
    if (!pendingRaw) {
      this.logger.warn(
        `No pending order for ${payment.order_id}; confirm endpoint probably won the race`,
      );
      return;
    }
    // Either payload version may be in Redis; `pendingTotalPaise` reads both,
    // and `confirmPaidOrder` upgrades a v1 record itself (decision 5).
    const pending = JSON.parse(pendingRaw) as PendingOrderPayload;
    const expectedPaise = pendingTotalPaise(pending);
    if (Number(payment.amount) !== expectedPaise) {
      await redis.set(pendingKey, pendingRaw, 'EX', 1800, 'NX');
      this.logger.error(
        `Amount mismatch for ${payment.order_id}: paid ${payment.amount}, expected ${expectedPaise}`,
      );
      return;
    }

    let order: { id: string; order_number: number };
    try {
      order = await this.fulfilmentService.confirmPaidOrder({
        customerId,
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        pending,
        placedVia: OrderSource.webhook_fallback,
      });
    } catch (err) {
      // SPEC §5.2 — the payment could not become an order and has already been
      // refunded inside `confirmPaidOrder`. That is a *resolution*, not a
      // failure: restoring the pending key would have Razorpay's next delivery
      // (and the storefront) try to buy the same sold-out seat all over again.
      // 2xx for the same reason — there is nothing left for a retry to fix.
      if (err instanceof OrderRefusedAndRefundedException) {
        await redis.del(`cart:${customerId}`);
        this.notifyPaymentRefused(customerId, err);
        return;
      }
      await redis.set(pendingKey, pendingRaw, 'EX', 1800, 'NX');
      this.logger.error(
        `confirmPaidOrder failed for ${payment.order_id}: ${(err as Error).message}`,
      );
      return;
    }

    await redis.del(`cart:${customerId}`);
    this.pusherService
      .trigger(`private-customer-${customerId}`, 'order.placed', {
        orderId: order.id,
        orderNumber: order.order_number,
        status: OrderStatus.placed,
      })
      .catch((err) =>
        this.logger.error(
          '[Pusher] Webhook order trigger error',
          err instanceof Error ? err.stack : String(err),
        ),
      );
  }

  /**
   * Tells the customer their payment is coming back, on the same
   * `private-customer-{id}` channel that already carries `order.placed`,
   * `delivery.updated` and `shipment.updated` — no new channel is invented for
   * this.
   *
   * The webhook is the only path that needs it: the storefront confirm endpoint
   * surfaces the same outcome synchronously as a `409`. Failure-isolated, and
   * logged either way, because the money has already moved and a dead socket
   * must not turn a settled refund into a webhook retry.
   */
  private notifyPaymentRefused(
    customerId: string,
    refusal: OrderRefusedAndRefundedException,
  ): void {
    this.logger.warn(
      `Order refused after capture (order ${refusal.detail.order_id}); refund ${
        refusal.detail.refunded
          ? `issued (${refusal.detail.refund_id ?? 'reconciled'})`
          : 'FAILED at the gateway — see order.auto_refund_failed'
      }`,
    );
    this.pusherService
      .trigger(`private-customer-${customerId}`, 'order.refunded', {
        orderId: refusal.detail.order_id,
        status: OrderStatus.refunded,
        reason: refusal.message,
        refunded: refusal.detail.refunded,
      })
      .catch((err) =>
        this.logger.error(
          '[Pusher] Webhook order refused trigger error',
          err instanceof Error ? err.stack : String(err),
        ),
      );
  }

  /**
   * CHK-05. This branch used to flip `Payment.status` straight to `refunded` for
   * any refund, however small, and never wrote a `Refund` row — a ₹1 goodwill
   * refund closed a ₹5,000 order. It now delegates to `RefundsService`, which
   * writes/promotes the `Refund` row, re-derives `Payment.refunded_amount` from
   * the processed rows, and only calls a payment `refunded` once the whole
   * amount is back.
   *
   * Event bookings keep their original behaviour: they carry
   * `razorpay_payment_id` directly and have no `Order`/`Payment` pair to settle.
   */
  private async handleRefundProcessed(payload: any) {
    const refund = payload.refund?.entity as GatewayRefundEntity | undefined;
    if (!refund?.id || !refund.payment_id) return;

    const booking = await this.prisma.eventBooking.findFirst({
      where: { razorpay_payment_id: refund.payment_id },
    });
    if (booking) {
      await this.prisma.eventBooking.update({
        where: { id: booking.id },
        data: { payment_status: 'refunded' },
      });
      return;
    }

    await this.refundsService.reconcileGatewayRefund(refund);
  }

  /**
   * P5a plan risk 3. `refund.processed` is optimistic: a refund can sit
   * `pending` at Razorpay for hours after `payments.refund()` returned, and
   * `RefundsService.refund` marks the row `processed` on that response. When the
   * rail finally fails, this is the only event that says so — without it the
   * refund stays `processed`, `Payment.refunded_amount` keeps counting money
   * that never left, and the customer is told they were refunded.
   *
   * Event bookings are not handled here on purpose: `refund.failed` usually
   * arrives with no preceding `refund.processed`, so there is no
   * `payment_status: 'refunded'` to undo, and a booking carries no `Refund` row
   * for the ledger to correct.
   */
  private async handleRefundFailed(payload: any) {
    const refund = payload.refund?.entity as GatewayRefundEntity | undefined;
    if (!refund?.id || !refund.payment_id) return;

    await this.refundsService.markGatewayRefundFailed(refund);
  }
}
