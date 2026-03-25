import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import { validatePaymentVerification, validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';

@Injectable()
export class RazorpayService implements OnModuleInit {
  private instance: Razorpay | null = null;
  private keySecret: string | null = null;
  private webhookSecret: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') || null;
    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') || null;

    if (!keyId || !this.keySecret) {
      console.warn('[Razorpay] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set — payment service disabled');
      return;
    }
    this.instance = new Razorpay({ key_id: keyId, key_secret: this.keySecret });
  }

  private ensureInstance(): Razorpay {
    if (!this.instance) throw new BadRequestException('Razorpay not configured');
    return this.instance;
  }

  async createOrder(params: {
    amount: number;       // in paise (rupees * 100)
    currency?: string;    // default 'INR'
    receipt: string;
    notes: { type: 'event_booking' | 'pos_order' | 'marketplace'; entity_id: string };
  }) {
    const rzp = this.ensureInstance();
    return rzp.orders.create({
      amount: params.amount,
      currency: params.currency || 'INR',
      receipt: params.receipt,
      notes: params.notes,
    });
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.keySecret) throw new BadRequestException('Razorpay not configured');
    try {
      const result = validatePaymentVerification(
        { order_id: orderId, payment_id: paymentId },
        signature,
        this.keySecret,
      );
      return result;
    } catch {
      return false;
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) throw new BadRequestException('Webhook secret not configured');
    try {
      const result = validateWebhookSignature(rawBody, signature, this.webhookSecret);
      return result;
    } catch {
      return false;
    }
  }

  async fetchPayment(paymentId: string) {
    const rzp = this.ensureInstance();
    return rzp.payments.fetch(paymentId);
  }

  async createRefund(paymentId: string, amountInPaise: number, reason: string) {
    const rzp = this.ensureInstance();
    return rzp.payments.refund(paymentId, {
      amount: amountInPaise,
      speed: 'optimum',
      notes: { reason },
      receipt: `refund_${Date.now()}`,
    });
  }
}
