import { createHmac, randomUUID } from 'node:crypto';

import { request, type APIRequestContext } from '@playwright/test';

import { API_BASE_URL } from './customer';

/**
 * The `payment.captured` Razorpay would have sent — signed, so the backend
 * believes it.
 *
 * This is the request P5a §5c recorded, and it is what actually creates the
 * order in this smoke. The stub checkout cannot produce a valid
 * `razorpay_signature`, so `POST /customer/orders/confirm` is not walkable from
 * the browser; the webhook fallback is. `WebhooksService.handleMarketplacePayment`
 * reads the frozen quote out of `pending_order:<razorpay_order_id>`, checks the
 * paid amount against it **to the paise**, and calls the same
 * `FulfilmentService.confirmPaidOrder` the confirm endpoint calls — so the order
 * this produces is the same order, only `placed_via: webhook_fallback`.
 *
 * Three things the backend will reject, and therefore three things this fixture
 * has to get exactly right:
 *
 * 1. **The signature is over the raw bytes.** `main.ts` preserves `rawBody` for
 *    `/webhooks/razorpay` only, and the HMAC is computed over that buffer — so
 *    the body is serialised **once**, signed, and posted as that same string.
 *    Re-serialising would change key order or spacing and invalidate it.
 * 2. **`x-razorpay-event-id` must be new.** Dedup is a Redis `SET NX` with a
 *    24-hour TTL; a replayed id answers `{ status: 'duplicate' }` and does
 *    nothing.
 * 3. **`notes` routes the payment.** `{ type: 'marketplace', entity_id: <customerId> }`
 *    is what picks the marketplace branch; anything else is logged and dropped.
 */

/** The secret the backend verifies with — `backend/.env`'s `RAZORPAY_WEBHOOK_SECRET`. */
export function webhookSecret(): string {
  const secret =
    process.env.E2E_RAZORPAY_WEBHOOK_SECRET ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
  if (!secret) {
    throw new Error(
      'RAZORPAY_WEBHOOK_SECRET (or E2E_RAZORPAY_WEBHOOK_SECRET) is not set. It must be the ' +
        "same value the backend under test booted with — see frontend/e2e/README.md.",
    );
  }
  return secret;
}

export interface PaymentCapturedInput {
  /** From `POST /customer/orders` — the order the storefront just opened. */
  razorpayOrderId: string;
  /** The quoted total **in paise**, as `CreateOrderFromQuoteResponse.amount` gives it. */
  amountPaise: number;
  /** `notes.entity_id` — the marketplace branch keys the cart and the order on it. */
  customerId: string;
  /** Overridable so a test can deliberately replay one. */
  paymentId?: string;
  eventId?: string;
}

export interface WebhookResult {
  status: number;
  body: { status?: string } & Record<string, unknown>;
  paymentId: string;
  eventId: string;
}

/** Builds the exact JSON string that gets signed and posted. */
export function paymentCapturedBody(input: PaymentCapturedInput & { paymentId: string }): string {
  return JSON.stringify({
    entity: 'event',
    account_id: 'acc_e2e',
    event: 'payment.captured',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: input.paymentId,
          entity: 'payment',
          amount: input.amountPaise,
          currency: 'INR',
          status: 'captured',
          order_id: input.razorpayOrderId,
          method: 'upi',
          captured: true,
          notes: { type: 'marketplace', entity_id: input.customerId },
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  });
}

export function signWebhook(rawBody: string, secret = webhookSecret()): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Post a signed `payment.captured` to `POST /webhooks/razorpay`.
 *
 * Pass an `api` to reuse an existing context; otherwise an anonymous one is
 * created and disposed — the webhook route is `@Public()` and must never
 * depend on a customer session.
 */
export async function sendPaymentCaptured(
  input: PaymentCapturedInput,
  api?: APIRequestContext,
): Promise<WebhookResult> {
  const paymentId = input.paymentId ?? `pay_e2e${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const eventId = input.eventId ?? `evt_e2e_${randomUUID()}`;
  const rawBody = paymentCapturedBody({ ...input, paymentId });
  const signature = signWebhook(rawBody);

  const context = api ?? (await request.newContext({ baseURL: API_BASE_URL }));
  try {
    const response = await context.post('/webhooks/razorpay', {
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': signature,
        'x-razorpay-event-id': eventId,
      },
      // A string, not an object: the signature is over these exact bytes.
      data: rawBody,
    });
    const text = await response.text();
    let body: WebhookResult['body'] = {};
    try {
      body = JSON.parse(text) as WebhookResult['body'];
    } catch {
      body = { raw: text };
    }
    return { status: response.status(), body, paymentId, eventId };
  } finally {
    if (!api) await context.dispose();
  }
}
