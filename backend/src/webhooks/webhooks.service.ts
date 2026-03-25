import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { RazorpayService } from '../razorpay/razorpay.service';
import { RedisService } from '../customer-auth/redis.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly razorpayService: RazorpayService,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async processWebhook(rawBody: Buffer | undefined, signature: string, eventId: string) {
    // 1. Validate rawBody exists
    if (!rawBody) throw new UnauthorizedException('Missing raw body');

    // 2. Verify webhook signature (D-10) — BEFORE any other processing
    const bodyStr = rawBody.toString();
    const isValid = this.razorpayService.verifyWebhookSignature(bodyStr, signature);
    if (!isValid) throw new UnauthorizedException('Invalid webhook signature');

    // 3. Dedup by event_id (D-08) — Redis SET NX with 24h TTL
    // Fail CLOSED: if Redis is down, reject the webhook (Razorpay will retry later)
    const redis = this.redisService.getClient();
    if (!redis) {
      throw new ServiceUnavailableException('Webhook dedup unavailable — retry later');
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
        console.warn('[Webhook] Missing routing metadata in notes:', notes);
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
          // Phase 24 — noop for now
          console.log('[Webhook] Marketplace payment received — not yet implemented');
          break;
        default:
          console.warn('[Webhook] Unknown payment type:', notes.type);
      }
    } else if (event === 'payment.failed') {
      // Log but do not update status — customer can retry with same order
      const payment = payload.payment?.entity;
      console.log(`[Webhook] Payment failed: ${payment?.id} for order ${payment?.order_id}`);
    } else if (event === 'refund.processed') {
      await this.handleRefundProcessed(payload);
    }
  }

  private async handleEventBookingPayment(payment: any, eventId: string) {
    // Find booking by razorpay_order_id (set during checkout in Plan 03)
    const booking = await this.prisma.eventBooking.findFirst({
      where: { razorpay_order_id: payment.order_id },
    });
    if (!booking) {
      console.warn(`[Webhook] No booking found for razorpay_order_id: ${payment.order_id}`);
      return;
    }
    // Idempotency: skip if already paid
    if (booking.payment_status === 'paid') return;

    await this.prisma.eventBooking.update({
      where: { id: booking.id },
      data: {
        payment_status: 'paid',
        razorpay_payment_id: payment.id,
      },
    });
  }

  private async handlePosOrderPayment(payment: any, orderId: string) {
    // Find or create Payment record for the order
    const existing = await this.prisma.payment.findFirst({
      where: { razorpay_order_id: payment.order_id },
    });
    if (existing && existing.status === 'paid') return; // idempotent

    if (existing) {
      await this.prisma.payment.update({
        where: { id: existing.id },
        data: {
          status: 'paid',
          razorpay_payment_id: payment.id,
        },
      });
    } else {
      // Create payment record from webhook (belt-and-suspenders with frontend confirm)
      await this.prisma.payment.create({
        data: {
          order_id: orderId,
          method: 'razorpay',
          amount: payment.amount / 100, // paise to rupees
          status: 'paid',
          razorpay_order_id: payment.order_id,
          razorpay_payment_id: payment.id,
        },
      });
    }

    // Update order status to paid if still placed
    await this.prisma.order.updateMany({
      where: { id: orderId, status: 'placed' },
      data: { status: 'preparing' },
    });
  }

  private async handleRefundProcessed(payload: any) {
    const refund = payload.refund?.entity;
    if (!refund) return;

    // Update booking or payment status to refunded
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

    const paymentRecord = await this.prisma.payment.findFirst({
      where: { razorpay_payment_id: refund.payment_id },
    });
    if (paymentRecord) {
      await this.prisma.payment.update({
        where: { id: paymentRecord.id },
        data: { status: 'refunded' },
      });
    }
  }
}
