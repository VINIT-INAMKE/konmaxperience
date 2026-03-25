# Phase 23: Razorpay Payments + Customer Auth - Research

**Researched:** 2026-03-26
**Domain:** Payment gateway integration (Razorpay), OTP-based customer authentication (WhatsApp Cloud API), NestJS security patterns
**Confidence:** HIGH (core Razorpay/NestJS patterns verified via official SDK docs and source), MEDIUM (WhatsApp Cloud API structure verified via multiple sources including official Meta developer reference)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Separate `Customer` Prisma model (NOT extending the staff `User` model). Fields: `id` (uuid), `phone` (unique, login identifier), `name` (optional), `email` (optional). Customer and User are completely independent entities with separate auth flows.

**D-02:** Custom OTP via Meta WhatsApp Business Cloud API (not SMS, not Clerk). 6-digit numeric, generated server-side, hashed and stored in Upstash Redis with 5-minute TTL. Rate limited: 3 OTP requests per phone per hour. Env vars: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`.

**D-03:** Single JWT strategy handles both staff and customer tokens. Staff payload: `{ userId, roleCode, type: 'staff' }`. Customer payload: `{ customerId, type: 'customer' }`. New guards: `StaffGuard` (requires type=staff), `CustomerGuard` (requires type=customer). Global `JwtAuthGuard` updated to extract `type` field.

**D-04:** Customer session: 30-day access token, no refresh token. Cookie: `customer_access_token` (httpOnly, 30-day maxAge). On expiry, customer re-does OTP.

**D-05:** Auto-link on first login: when customer verifies phone for first time, find all `Order`, `EventBooking`, and `Feedback` records with matching `customer_phone` and set their `customer_id` FK.

**D-06:** Razorpay Custom Checkout (embedded JS modal). Frontend loads checkout.js, opens modal with `razorpay_order_id`. Returns `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }` to our callback.

**D-07:** Same Razorpay order is retryable. Booking/order stays in `payment_pending` until success or 30-minute expiry.

**D-08:** Idempotency on ALL payment-related endpoints. Razorpay's native `idempotency_key` header on order creation. Backend `findFirst` before create on all booking/payment records. Webhook handler checks `razorpay_payment_id` uniqueness before processing.

**D-09:** HMAC-SHA256 signature verification on EVERY payment confirmation. `razorpay_signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)`. NEVER trust frontend-only payment confirmation.

**D-10:** Razorpay webhook endpoint (`POST /webhooks/razorpay`) is `@Public()` but protected by Razorpay's webhook signature verification using `RAZORPAY_WEBHOOK_SECRET`. Raw body preserved for signature check.

**D-11:** Server-side amount validation. Frontend NEVER sends the amount — only the `razorpay_order_id`.

**D-12:** Payment status ONLY updated via: (a) verified webhook, or (b) verified frontend signature + server-side Razorpay API re-fetch.

**D-13:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` stored as env vars. Key ID is the only value exposed to frontend.

**D-14:** Refund handling: automated refunds only for race condition scenarios. All other refunds are admin-initiated with `MANAGE_SYSTEM` permission. Full audit logging.

**D-15:** Rate limiting on all payment endpoints. `POST /payments/create-order` rate limited per customer (5/min). Webhook endpoint rate limited by IP (100/min). OTP endpoints rate limited per phone (3/hour, 10/day).

**D-16:** No payment data ever touches our server. Razorpay's checkout modal handles all sensitive input. Our database stores only: `razorpay_order_id`, `razorpay_payment_id`, `payment_method`, `amount`, `status`.

**D-17:** Pay-to-book model: EventBooking ONLY created after payment succeeds. If capacity exceeded after payment: auto-refund + error response.

**D-18:** EventBooking extended with: `customer_id` (FK to Customer), `razorpay_order_id`, `razorpay_payment_id`, `payment_status`, `payment_amount`. Existing anonymous fields kept.

**D-19:** Free events (price=0) require customer login but skip Razorpay modal.

**D-20:** `POST /events/:id/checkout` (create Razorpay order), `POST /events/:id/bookings/confirm` (verify signature, create booking). Old anonymous `POST /events/:id/bookings` kept for backward compat.

**D-21:** `razorpay` added as 4th payment method. `@IsIn(['cash', 'card', 'upi', 'razorpay'])`.

**D-22:** POS Razorpay flow: staff creates Razorpay order for Order total → modal on POS screen → webhook confirms → Payment record created.

**D-23:** Single shared webhook endpoint. Routes internally based on Razorpay order metadata: `{ type: 'event_booking' | 'pos_order' | 'marketplace', entity_id: '<uuid>' }`.

### Claude's Discretion
- Exact Razorpay SDK version and initialization pattern
- Redis key schema for OTP storage
- WhatsApp message template design
- Customer auth module internal structure
- Error message wording for payment failures
- Webhook retry handling (Razorpay retries failed webhooks)
- Payment expiry cron job design (cleanup pending orders after 30min)

### Deferred Ideas (OUT OF SCOPE)
- Customer-facing marketplace (cart, checkout, delivery) — Phase 24
- Customer order history page — Phase 24
- Customer delivery address management — Phase 24
- Razorpay subscription/recurring payments — future
- Payment analytics dashboard — future
- Multi-currency support — out of scope
- Customer loyalty/rewards program — future
- Razorpay smart collect (virtual accounts) — future
</user_constraints>

---

## Summary

Phase 23 builds two tightly coupled systems: OTP-based customer authentication via WhatsApp and Razorpay payment processing. The payment system is the highest-risk component — every confirmation path must be independently verified via HMAC-SHA256 signature, and payment status must only be set through cryptographically verified callbacks (webhook or API re-fetch), never through frontend-only signals.

The Razorpay Node.js SDK (v2.9.6, released Feb 24, 2025) provides `validatePaymentVerification` and `validateWebhookSignature` utilities that should be used instead of hand-rolling HMAC. The SDK's `instance.orders.create()` method generates the server-side order; the `notes` object on the order carries routing metadata (`{ type, entity_id }`) so the single webhook endpoint can dispatch to the correct handler.

The NestJS raw body challenge — required because Razorpay webhook signature verification needs the unparsed request bytes — has a confirmed solution: use `{ bodyParser: false }` in NestFactory.create plus `getBodyParserOptions(true, { limit: '1mb' })` from `@nestjs/platform-express`. This preserves both raw body access AND the existing 1MB limit from main.ts.

**Primary recommendation:** Use `razorpay` npm SDK (v2.9.6) for all backend Razorpay operations. Use `{ rawBody: true }` with `RawBodyRequest<Request>` for the webhook controller — but only if the existing `app.use(json({ limit: '1mb' }))` middleware is removed from main.ts (it conflicts). The safer approach is `bodyParser: false` + `getBodyParserOptions` from `@nestjs/platform-express`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `razorpay` | 2.9.6 | Razorpay Node.js SDK — orders, payments, refunds, signature verification | Official Razorpay SDK, latest stable (Feb 2025) |
| `ioredis` | 5.10.1 | Redis client for OTP storage (already installed) | Already in project, used for BullMQ |
| `bcrypt` | 6.0.0 | OTP hash storage (already installed) | Already in project, used for auth passwords |
| `@nestjs/throttler` | 6.5.0 | Rate limiting (already installed) | Already in project, `@Throttle()` decorator available |
| `crypto` (Node.js built-in) | N/A | HMAC-SHA256 for signature verification | Built-in, no install needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@upstash/redis` | 1.37.0 | Alternative Upstash Redis client with HTTP transport | Use if ioredis TCP connectivity issues with Upstash |
| `@nestjs/platform-express` | 11.x | `getBodyParserOptions` utility for rawBody+limit fix | Required for webhook raw body solution |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `razorpay` SDK utilities | Hand-rolled HMAC crypto | SDK utilities are tested and correct; hand-roll is error-prone |
| ioredis (existing) | `@upstash/redis` HTTP client | ioredis already installed and working; prefer consistency |
| bcrypt for OTP hash | crypto.createHash('sha256') | bcrypt is deliberately slow (rate-limits brute force on OTP values); SHA-256 is fast and attackable |

**Installation (new packages only):**
```bash
npm install razorpay
```

**Version verification (confirmed 2026-03-26):**
```bash
npm view razorpay version   # 2.9.6 (Feb 24, 2025)
npm view @upstash/redis version  # 1.37.0
```

---

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── customer-auth/          # Customer OTP login module
│   ├── customer-auth.module.ts
│   ├── customer-auth.controller.ts  # POST /customer-auth/send-otp, /verify-otp
│   ├── customer-auth.service.ts     # OTP generation, Redis storage, JWT issue
│   ├── customer.guard.ts            # requires type='customer' in JWT
│   ├── staff.guard.ts               # requires type='staff' in JWT
│   └── dto/
│       ├── send-otp.dto.ts
│       └── verify-otp.dto.ts
├── razorpay/               # Shared Razorpay service module (reused Phase 24+)
│   ├── razorpay.module.ts
│   ├── razorpay.service.ts  # createOrder, verifyPayment, createRefund, fetchPayment
│   └── dto/
│       └── create-order.dto.ts
├── webhooks/               # Razorpay webhook endpoint
│   ├── webhooks.module.ts
│   ├── webhooks.controller.ts  # POST /webhooks/razorpay (@Public, raw body)
│   └── webhooks.service.ts     # route by metadata type, dedup by event_id
└── prisma/
    └── schema.prisma       # New: Customer model, EventBooking extensions, Payment extensions
```

### Pattern 1: Razorpay SDK Initialization (NestJS Service)

**What:** Injectable service wrapping the Razorpay SDK instance.
**When to use:** Import RazorpayModule into any module that needs to create orders or refunds (EventsModule, OrdersModule, WebhooksModule).

```typescript
// Source: github.com/razorpay/razorpay-node README + official SDK docs
import Razorpay from 'razorpay';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RazorpayService implements OnModuleInit {
  private instance: Razorpay;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.instance = new Razorpay({
      key_id: this.config.get<string>('RAZORPAY_KEY_ID')!,
      key_secret: this.config.get<string>('RAZORPAY_KEY_SECRET')!,
    });
  }

  async createOrder(params: {
    amount: number;      // in paise (rupees * 100)
    currency: string;    // 'INR'
    receipt: string;     // internal reference
    notes: {             // routing metadata (max 15 key-value pairs, 256 chars each)
      type: 'event_booking' | 'pos_order' | 'marketplace';
      entity_id: string;
    };
  }) {
    return this.instance.orders.create({
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });
  }
}
```

### Pattern 2: HMAC-SHA256 Payment Signature Verification

**What:** Verify the signature returned by the Razorpay checkout modal on the backend.
**When to use:** In `POST /events/:id/bookings/confirm` handler before creating the EventBooking record.

```typescript
// Source: github.com/razorpay/razorpay-node documents/paymentVerfication.md (verified)
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils';
import { ConfigService } from '@nestjs/config';

// In your service:
verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  return validatePaymentVerification(
    { order_id: orderId, payment_id: paymentId },
    signature,
    this.config.get<string>('RAZORPAY_KEY_SECRET')!,
  );
}
```

**Manual HMAC fallback (if SDK import fails):**
```typescript
// Source: Multiple verified community implementations
import * as crypto from 'crypto';

verifyPaymentSignatureManual(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const body = orderId + '|' + paymentId;
  const generated = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');
  // Use timingSafeEqual to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(generated),
    Buffer.from(signature),
  );
}
```

### Pattern 3: Webhook Signature Verification (NestJS Raw Body)

**What:** Verify the `x-razorpay-signature` header on the webhook endpoint using raw request bytes.
**When to use:** `POST /webhooks/razorpay` controller.

**CRITICAL — Main.ts change for rawBody support:**
The existing `app.use(json({ limit: '1mb' }))` in main.ts conflicts with `rawBody: true`. Use the `getBodyParserOptions` utility:

```typescript
// Source: github.com/nestjs/nest issue #10471 — confirmed workaround
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { getBodyParserOptions } from '@nestjs/platform-express/adapters/utils/get-body-parser-options.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,  // disable default body parser
  });

  // Re-enable with raw body support AND custom limit
  app.use(json(getBodyParserOptions(true, { limit: '1mb' })));
  app.use(urlencoded(getBodyParserOptions(true, { limit: '1mb', extended: true })));

  // ... rest of existing main.ts unchanged
}
```

**Webhook controller using RawBodyRequest:**
```typescript
// Source: docs.nestjs.com/faq/raw-body (verified)
import { Controller, Post, Req, Headers } from '@nestjs/common';
import { Request } from 'express';
import { RawBodyRequest } from '@nestjs/common';
import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';
import { Public } from '../common/decorators/public.decorator';

@Controller('webhooks')
export class WebhooksController {
  @Post('razorpay')
  @Public()
  async handleRazorpay(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId: string,
  ) {
    const rawBody = req.rawBody; // Buffer
    const isValid = validateWebhookSignature(
      rawBody!.toString(),
      signature,
      process.env.RAZORPAY_WEBHOOK_SECRET!,
    );
    if (!isValid) throw new UnauthorizedException('Invalid webhook signature');
    // Dedup by eventId before processing
  }
}
```

**Manual webhook HMAC fallback:**
```typescript
// Source: Razorpay official documentation summary (verified from multiple sources)
const generated = crypto
  .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
  .update(rawBody.toString())   // MUST be raw string, not JSON.stringify(req.body)
  .digest('hex');
```

### Pattern 4: Razorpay Order Creation (Backend — Server-Side Amount)

```typescript
// Amount in paise (₹500 = 50000 paise)
const order = await this.razorpayService.createOrder({
  amount: Math.round(event.price.toNumber() * guestCount * 100),  // paise
  currency: 'INR',
  receipt: `evt_${eventId}_${Date.now()}`,
  notes: {
    type: 'event_booking',
    entity_id: eventId,  // used by webhook to route to correct handler
  },
});
// Return only order.id (razorpay_order_id) to frontend — NEVER return amount
return { razorpay_order_id: order.id };
```

### Pattern 5: Frontend Checkout.js Integration (Next.js)

```typescript
// Source: dev.to/hanuchaudhary (verified) — Next.js 15/React 19 compatible
// In _app or layout.tsx:
import Script from 'next/script';
<Script src="https://checkout.razorpay.com/v1/checkout.js" />

// In payment component (use client):
function openCheckout(razorpayOrderId: string) {
  const options = {
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,   // public key only
    // amount and currency intentionally OMITTED — modal reads from order
    order_id: razorpayOrderId,
    name: 'Konma Xperience',
    description: 'Event Booking',
    handler: async (response: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }) => {
      // Send all three to backend for server-side HMAC verification
      await confirmBooking(response);
    },
    modal: {
      ondismiss: () => {
        // Order stays open — customer can retry with same razorpay_order_id
      },
    },
    prefill: { contact: customerPhone },
    theme: { color: '#000000' },
  };
  const rzp = new (window as any).Razorpay(options);
  rzp.on('payment.failed', (resp: any) => handlePaymentFailed(resp));
  rzp.open();
}
```

**TypeScript declaration (d.ts file):**
```typescript
interface Window {
  Razorpay: new (options: Record<string, unknown>) => {
    open(): void;
    on(event: string, handler: (response: any) => void): void;
  };
}
```

### Pattern 6: Redis OTP Storage (Upstash via ioredis)

**Key schema:** `otp:{phone}` — stores bcrypt-hashed OTP with 5-minute TTL.
**Rate limit key:** `otp_rate:{phone}` — stores attempt count with 1-hour TTL.

```typescript
// Source: Verified pattern from multiple Redis+OTP implementations
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Redis } from 'ioredis';

// Generate and store OTP
async sendOtp(phone: string): Promise<void> {
  const redis = this.redisService.getClient(); // reuse existing ioredis client

  // Check rate limit: 3 per hour
  const rateKey = `otp_rate:${phone}`;
  const attempts = await redis.incr(rateKey);
  if (attempts === 1) await redis.expire(rateKey, 3600); // 1-hour window
  if (attempts > 3) throw new TooManyRequestsException('OTP limit exceeded');

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();

  // Hash before storage (bcrypt, cost 10 — lower than password bcrypt 12 for speed)
  const hash = await bcrypt.hash(otp, 10);

  // Store with 5-minute TTL
  const otpKey = `otp:${phone}`;
  await redis.set(otpKey, hash, 'EX', 300);

  // Send via WhatsApp
  await this.whatsappService.sendOtp(phone, otp);
}

// Verify OTP
async verifyOtp(phone: string, submittedOtp: string): Promise<boolean> {
  const redis = this.redisService.getClient();
  const otpKey = `otp:${phone}`;
  const storedHash = await redis.get(otpKey);

  if (!storedHash) return false; // expired or never sent

  const isValid = await bcrypt.compare(submittedOtp, storedHash);
  if (isValid) {
    await redis.del(otpKey); // consume OTP — prevent reuse
  }
  return isValid;
}
```

### Pattern 7: WhatsApp Cloud API — Send Authentication OTP

**Endpoint:** `POST https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages`
**Auth:** `Authorization: Bearer {WHATSAPP_TOKEN}`

```typescript
// Source: Meta developer docs (graph.facebook.com/v18.0), verified via multiple sources
async sendOtp(recipientPhone: string, otp: string): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientPhone,   // include country code: '919876543210'
      type: 'template',
      template: {
        name: 'otp_verification',   // pre-approved template name
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: otp }  // OTP code injected into template
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [
              { type: 'text', text: otp }  // Also injected into button
            ],
          },
        ],
      },
    }),
  });
}
```

**Template pre-approval:** Authentication templates with OTP copy-code buttons use a fixed body: `"<VERIFICATION_CODE> is your verification code"`. Template must be submitted via Meta Business Manager (or Graph API) and approved before use. Authentication templates are the lowest-risk category and are approved quickly. Template TTL: 10-minute default (set between 30-900 seconds).

**Graceful fallback (dev mode — PusherService pattern):**
```typescript
// If WHATSAPP_TOKEN is not set, log OTP to console (dev only)
// Same null-client pattern used by PusherService in Phase 21
if (!process.env.WHATSAPP_TOKEN) {
  console.log(`[DEV] OTP for ${phone}: ${otp}`);
  return;
}
```

### Pattern 8: Customer JWT — Extending Existing Auth

**Extend JwtPayload type:**
```typescript
// backend/src/types/auth.ts — extend existing interface
export interface JwtPayload {
  // Existing staff fields:
  userId?: string;
  roleCode?: string;
  // New customer fields:
  customerId?: string;
  // Discriminator (both):
  type: 'staff' | 'customer';
  iat?: number;
  exp?: number;
}
```

**Update JwtStrategy.validate():**
```typescript
// Extend validate to return type-aware user object
async validate(payload: JwtPayload) {
  if (payload.type === 'customer') {
    return { customerId: payload.customerId, type: 'customer' };
  }
  // Existing staff path:
  return { id: payload.userId, roleCode: payload.roleCode, type: 'staff' };
}
```

**CustomerGuard — restrict to customer tokens:**
```typescript
@Injectable()
export class CustomerGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user || user.type !== 'customer') {
      throw err || new UnauthorizedException('Customer authentication required');
    }
    return user;
  }
}
```

**StaffGuard — restrict to staff tokens:**
```typescript
@Injectable()
export class StaffGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user || user.type !== 'staff') {
      throw err || new UnauthorizedException('Staff authentication required');
    }
    return user;
  }
}
```

**JWT extractor update** — extend `extractJwtFromHeaderOrCookie` to also check `customer_access_token` cookie:
```typescript
function extractJwtFromHeaderOrCookie(req: Request): string | null {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (fromHeader) return fromHeader;
  if (req?.cookies?.access_token) return req.cookies.access_token;
  if (req?.cookies?.customer_access_token) return req.cookies.customer_access_token;
  return null;
}
```

### Pattern 9: Webhook Routing by Order Metadata

```typescript
// Webhook payload structure from Razorpay (verified)
// req.body.payload.payment.entity.order_id  → razorpay order id
// req.body.payload.payment.entity.notes     → our metadata object
// req.body.event  → 'payment.captured' | 'order.paid' | 'payment.failed'

async handleWebhook(event: string, payload: any) {
  const payment = payload.payload.payment.entity;
  const notes = payment.notes as { type: string; entity_id: string };

  switch (notes.type) {
    case 'event_booking':
      return this.handleEventBookingPayment(payment, notes.entity_id);
    case 'pos_order':
      return this.handlePosOrderPayment(payment, notes.entity_id);
    case 'marketplace':
      return this.handleMarketplacePayment(payment, notes.entity_id);
  }
}
```

### Pattern 10: Webhook Deduplication (x-razorpay-event-id)

```typescript
// Razorpay uses at-least-once delivery — check dedup BEFORE processing
// Source: Razorpay webhook FAQs (verified)
async handleRazorpay(rawBody: Buffer, signature: string, eventId: string) {
  // 1. Verify signature first
  const isValid = validateWebhookSignature(
    rawBody.toString(),
    signature,
    process.env.RAZORPAY_WEBHOOK_SECRET!,
  );
  if (!isValid) throw new UnauthorizedException();

  // 2. Dedup check — use Redis SET NX with 24h TTL
  const redis = this.redisService.getClient();
  const dedupKey = `webhook_processed:${eventId}`;
  const isNew = await redis.set(dedupKey, '1', 'EX', 86400, 'NX');
  if (!isNew) {
    // Already processed — return 200 to stop Razorpay retrying
    return { status: 'duplicate' };
  }

  // 3. Process event
  const body = JSON.parse(rawBody.toString());
  await this.routeWebhookEvent(body);
  return { status: 'ok' };
}
```

**Razorpay retry behavior:** Retries with exponential backoff for 24 hours if server does not respond within 5 seconds or returns non-2xx. ALWAYS return 200 after signature verification even if internal processing fails — use background processing for reliability.

### Pattern 11: Razorpay Refund API

```typescript
// Source: github.com/razorpay/razorpay-node documents/refund.md (verified)
// For race condition auto-refunds (capacity exceeded after payment):
async createRefund(paymentId: string, amountInPaise: number, reason: string) {
  return this.instance.payments.refund(paymentId, {
    amount: amountInPaise,  // paise, NOT rupees
    speed: 'optimum',       // instant refund
    notes: { reason },
    receipt: `refund_${Date.now()}`,
  });
}
```

### Pattern 12: Belt-and-Suspenders Payment Confirmation (D-12)

```typescript
// After frontend signature verification, re-fetch from Razorpay API to confirm capture
async confirmPayment(orderId: string, paymentId: string, signature: string) {
  // Step 1: Verify HMAC signature
  const isValid = this.verifyPaymentSignature(orderId, paymentId, signature);
  if (!isValid) throw new BadRequestException('Invalid payment signature');

  // Step 2: Re-fetch payment from Razorpay to confirm capture status
  const payment = await this.instance.payments.fetch(paymentId);
  if (payment.status !== 'captured') {
    throw new BadRequestException(`Payment not captured: ${payment.status}`);
  }
  if (payment.order_id !== orderId) {
    throw new BadRequestException('Order ID mismatch');
  }

  return payment;
}
```

### Pattern 13: Prisma Schema Additions

**New Customer model:**
```prisma
model Customer {
  id         String   @id @default(uuid())
  phone      String   @unique
  name       String?
  email      String?
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  bookings  EventBooking[]
  orders    Order[]
  feedbacks Feedback[]

  @@index([phone])
}
```

**EventBooking extensions:**
```prisma
model EventBooking {
  id                 String    @id @default(uuid())
  event_id           String
  event              Event     @relation(fields: [event_id], references: [id], onDelete: Cascade)
  customer_id        String?                          // FK to Customer (nullable for backward compat)
  customer           Customer? @relation(fields: [customer_id], references: [id])
  customer_name      String                           // kept for backward compat
  customer_phone     String                           // kept for backward compat
  guests             Int
  razorpay_order_id  String?   @unique               // unique prevents duplicate bookings
  razorpay_payment_id String?  @unique
  payment_status     String    @default("pending")   // pending | paid | refunded | free
  payment_amount     Decimal?
  created_at         DateTime  @default(now())

  @@unique([event_id, customer_phone])
  @@index([customer_id])
  @@index([razorpay_order_id])
}
```

**Payment model extensions (for razorpay method):**
```prisma
model Payment {
  id                  String   @id @default(uuid())
  order_id            String   @unique
  method              String   // "cash" | "card" | "upi" | "razorpay"
  amount              Decimal
  status              String   @default("pending")
  razorpay_order_id   String?
  razorpay_payment_id String?
  notes               String?
  created_at          DateTime @default(now())
  order               Order    @relation(fields: [order_id], references: [id])
}
```

**Order and Feedback additions:**
```prisma
// Add to Order model:
customer_id   String?
customer      Customer? @relation(fields: [customer_id], references: [id])

// Add to Feedback model:
customer_id   String?
customer      Customer? @relation(fields: [customer_id], references: [id])
```

### Anti-Patterns to Avoid

- **Verifying signature client-side only:** The frontend handler receives the signature — NEVER trust it without server-side HMAC re-verification. Frontend can be manipulated.
- **Using `req.body` as string for webhook:** `JSON.stringify(req.body)` is NOT the raw body — JSON serialization can change key order/whitespace. MUST use raw buffer.
- **Setting payment status from frontend:** Even with HMAC verification, also do the API re-fetch (`payments.fetch(paymentId)`) to confirm `status === 'captured'`.
- **Using the same secret for payment verification and webhook verification:** `RAZORPAY_KEY_SECRET` verifies frontend signatures; `RAZORPAY_WEBHOOK_SECRET` verifies webhook headers. These are separate values set separately in Razorpay dashboard.
- **Blocking on webhook processing:** Razorpay expects 200 within 5 seconds. If processing takes longer, acknowledge immediately and process asynchronously (BullMQ is already installed).
- **Storing OTP as plaintext in Redis:** Always bcrypt-hash before storage. Upstash Redis is a third-party service; if compromised, plaintext OTPs expose all pending auths.
- **Using `Math.random()` for OTP generation:** Use `crypto.randomInt(100000, 999999)` — `Math.random()` is not cryptographically secure.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment signature verification | Custom HMAC implementation | `validatePaymentVerification` from `razorpay/dist/utils/razorpay-utils` | Official utility handles edge cases; reduces typo risk in security code |
| Webhook signature verification | Custom HMAC from req.body | `validateWebhookSignature` from `razorpay/dist/utils/razorpay-utils` | Same — uses raw body correctly |
| OTP generation | Manual digit generation | `crypto.randomInt(100000, 999999)` | CSPRNG; Math.random() is attackable |
| Rate limiting | Custom Redis counter | `@Throttle()` decorator + ThrottlerGuard (already configured) | Already in AppModule, works with existing rate limit config |
| JWT signing/verification | Custom JWT library | `@nestjs/jwt` (already in project) | Already installed, tested, used for staff auth |
| Timing-safe comparison | `===` string comparison | `crypto.timingSafeEqual()` | Prevents timing attacks on HMAC digest comparison |

**Key insight:** The `razorpay` npm SDK's utility functions (`validatePaymentVerification`, `validateWebhookSignature`) are the only tested implementations of Razorpay's signature verification. Using them eliminates an entire class of implementation bugs.

---

## Common Pitfalls

### Pitfall 1: rawBody Conflict with Existing main.ts Body Parser
**What goes wrong:** NestJS `rawBody: true` in `NestFactory.create` silently fails when you also call `app.use(json({ limit: '1mb' }))`. The raw body will be undefined in controllers.
**Why it happens:** The `app.use()` call re-registers a body parser after NestJS's internal raw-body-aware parser, overwriting the rawBody attachment.
**How to avoid:** Use `bodyParser: false` in NestFactory + `getBodyParserOptions(true, { limit: '1mb' })` from `@nestjs/platform-express`. This is the confirmed fix from GitHub issue #10471.
**Warning signs:** `req.rawBody` is undefined in webhook controller; webhook signature verification always fails.

### Pitfall 2: Webhook Signature Computed from req.body (JSON Parsed)
**What goes wrong:** `JSON.stringify(req.body)` does NOT equal the raw request bytes. Key order, whitespace, and number serialization differ. Signature verification always fails.
**Why it happens:** Express JSON body parser parses the bytes into a JS object; `JSON.stringify` re-serializes differently.
**How to avoid:** Only compute HMAC on `req.rawBody.toString()` — the original bytes before parsing.
**Warning signs:** `validateWebhookSignature` returns false for all valid webhooks.

### Pitfall 3: Amount in Rupees Instead of Paise
**What goes wrong:** Razorpay API requires amount in the smallest currency unit (paise for INR). Passing `500` instead of `50000` creates a ₹5 order, not a ₹500 order.
**Why it happens:** Developers assume rupees.
**How to avoid:** Always multiply by 100: `Math.round(priceInRupees * 100)`. The `Math.round()` prevents floating point issues.
**Warning signs:** Orders created with suspiciously low amounts in Razorpay dashboard.

### Pitfall 4: OTP Reuse After Successful Verification
**What goes wrong:** If OTP is not deleted from Redis after successful verification, the same OTP can be reused within the TTL window.
**Why it happens:** Forgetting `await redis.del(otpKey)` after successful `bcrypt.compare`.
**How to avoid:** Always delete the Redis key atomically after successful verification.
**Warning signs:** Customers can log in multiple times with the same OTP within 5 minutes.

### Pitfall 5: Double-Booking on Race Condition
**What goes wrong:** Two customers verify payment simultaneously for the last spot. Both pass capacity check but one booking creates capacity overflow.
**Why it happens:** Capacity check and booking creation are separate operations without serializable isolation.
**How to avoid:** Wrap the capacity check + EventBooking creation in a `$transaction({ isolationLevel: Serializable })` (already done in existing `createBooking`). For the new payment flow, maintain this pattern.
**Warning signs:** `spots_remaining` goes negative in the events list.

### Pitfall 6: Webhook Event Processed Multiple Times (Razorpay At-Least-Once)
**What goes wrong:** Razorpay retries webhooks if your server doesn't respond within 5 seconds. Without dedup, payment records are created twice.
**Why it happens:** Processing takes >5 seconds OR network timeout between your server and Razorpay.
**How to avoid:** Check `x-razorpay-event-id` header. Store processed event IDs in Redis with `SET NX` before processing. Return 200 immediately, process in background.
**Warning signs:** Duplicate Payment or EventBooking records with same `razorpay_payment_id`.

### Pitfall 7: JwtAuthGuard Rejects Customer Tokens on Staff Routes
**What goes wrong:** After adding `type: 'customer'` to JWT, existing staff routes that use the global `JwtAuthGuard` may behave unexpectedly if the guard only accepts staff-type tokens.
**Why it happens:** The global guard needs to accept both types for the `@Public()` bypass to work correctly, but individual routes need type enforcement.
**How to avoid:** Global `JwtAuthGuard` remains type-agnostic (just validates JWT signature). Type enforcement happens at route-level via `CustomerGuard` or `StaffGuard` decorators. The existing `PermissionsGuard` already handles staff-only routes by checking `roleCode`.
**Warning signs:** Staff users can access customer endpoints or vice versa.

### Pitfall 8: WhatsApp Template Not Pre-Approved
**What goes wrong:** Sending a message to a non-test phone number with an unapproved template returns a 400 from WhatsApp Cloud API.
**Why it happens:** Authentication templates must be approved before use in production.
**How to avoid:** Submit template via Meta Business Manager before Phase 23 is deployed. Use the dev console-log fallback during development. Template approval can take 24-48 hours.
**Warning signs:** WhatsApp API returns `{"error":{"message":"Template name does not exist"}}`.

### Pitfall 9: Customer Phone Number Format
**What goes wrong:** WhatsApp Cloud API requires phone numbers with country code, no `+` prefix (e.g., `919876543210` not `+919876543210`).
**Why it happens:** Mixed conventions between E.164 format and WhatsApp's expected format.
**How to avoid:** Normalize phone at OTP send time: strip `+` prefix, ensure starts with country code. Store in DB in E.164 format (`+919876543210`) for consistency, normalize to no-plus before WhatsApp call.

---

## Code Examples

### Order Creation (Backend)
```typescript
// Source: github.com/razorpay/razorpay-node documents/order.md (verified)
const order = await instance.orders.create({
  amount: 50000,           // ₹500 in paise
  currency: 'INR',         // only INR supported currently
  receipt: 'receipt_001',  // internal reference
  notes: {                 // max 15 key-value pairs, 256 chars each
    type: 'event_booking',
    entity_id: 'event-uuid-here',
  },
});
// order.id = 'order_EKwxwAgItmmXdp' — this is the razorpay_order_id
```

### Refund (Backend)
```typescript
// Source: github.com/razorpay/razorpay-node documents/refund.md (verified)
const refund = await instance.payments.refund(paymentId, {
  amount: 50000,         // paise — full or partial refund
  speed: 'optimum',      // 'normal' (5-7 days) or 'optimum' (instant)
  notes: { reason: 'capacity_exceeded' },
  receipt: `refund_${Date.now()}`,
});
```

### Frontend Checkout Modal Options
```typescript
// Source: Razorpay standard checkout docs + dev community (verified pattern)
const options = {
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  // DO NOT include amount — modal reads it from the order
  order_id: razorpayOrderId,
  name: 'Konma Xperience',
  handler: (response) => {
    // response = { razorpay_payment_id, razorpay_order_id, razorpay_signature }
    // Send all three to backend for server-side verification
  },
  modal: { ondismiss: () => {} },
};
new (window as any).Razorpay(options).open();
```

### WhatsApp OTP (node-fetch / native fetch)
```typescript
// Source: graph.facebook.com/v18.0 Messages API (verified from Meta developer docs)
await fetch(
  `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientPhone,   // '919876543210' — no + prefix
      type: 'template',
      template: {
        name: 'otp_verification',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: otpCode }],
          },
        ],
      },
    }),
  },
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WhatsApp On-Premises API (self-hosted) | WhatsApp Cloud API (Meta-hosted) | Sunsetting Oct 23, 2025 | Must use Cloud API — no self-hosted option |
| `rawBody: true` in NestFactory | `bodyParser: false` + `getBodyParserOptions` | NestJS ~v9-10 issue | The official rawBody: true approach conflicts with custom limits |
| Custom HMAC for Razorpay | `validatePaymentVerification` / `validateWebhookSignature` from SDK utils | SDK v2.x | Official utilities are now the standard approach |

**Deprecated/outdated:**
- WhatsApp On-Premises API: sunset October 23, 2025. Only Cloud API should be used.
- `razorpay.validatePaymentVerification` at top level: import from `razorpay/dist/utils/razorpay-utils` directly.

---

## Open Questions

1. **WhatsApp template name and pre-approval timing**
   - What we know: Template category `AUTHENTICATION` with body `"<VERIFICATION_CODE> is your verification code"` — this is the fixed Meta-approved text
   - What's unclear: Whether the template will be pre-approved before Phase 23 deployment. The dev console-log fallback handles this for local development
   - Recommendation: Create the template in Meta Business Manager during Wave 0 of Phase 23 planning. Template approval typically takes 24-48 hours.

2. **ioredis client injection for CustomerAuthService**
   - What we know: ioredis is used via BullMQ in app.module.ts. No standalone RedisService exists yet.
   - What's unclear: Whether to create a shared `RedisService` injectable or duplicate the ioredis connection
   - Recommendation: Create a shared `RedisModule` (similar to the BullMQ pattern) that exports an ioredis client. Both OTP storage and webhook dedup can inject it.

3. **getBodyParserOptions import path stability**
   - What we know: The path `@nestjs/platform-express/adapters/utils/get-body-parser-options.util` resolved the NestJS rawBody+limit conflict in issue #10471
   - What's unclear: Whether this internal utility path is stable across `@nestjs/platform-express` minor versions
   - Recommendation: If the import fails, fall back to the `bodyParser: false` + manual `body-parser` middleware with `verify` callback approach (the Stripe/Shopify pattern).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 (already configured) |
| Config file | `backend/jest.config.ts` |
| Quick run command | `cd backend && npx jest --testPathPattern=customer-auth --passWithNoTests` |
| Full suite command | `cd backend && npx jest --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-09 | HMAC-SHA256 payment signature verifies correctly | unit | `npx jest --testPathPattern=razorpay.service.spec -x` | Wave 0 |
| D-09 | Invalid signature returns false | unit | `npx jest --testPathPattern=razorpay.service.spec -x` | Wave 0 |
| D-10 | Webhook with invalid signature throws 401 | unit | `npx jest --testPathPattern=webhooks.controller.spec -x` | Wave 0 |
| D-10 | Webhook dedup: second event with same event-id skipped | unit | `npx jest --testPathPattern=webhooks.service.spec -x` | Wave 0 |
| D-11 | Amount cannot be sent from frontend (order only accepts order_id) | integration | manual review | manual-only |
| D-02 | OTP bcrypt hash stored in Redis with 5-min TTL | unit | `npx jest --testPathPattern=customer-auth.service.spec -x` | Wave 0 |
| D-02 | OTP rate limit: 4th request within hour throws 429 | unit | `npx jest --testPathPattern=customer-auth.service.spec -x` | Wave 0 |
| D-04 | Customer JWT cookie set with 30-day maxAge | unit | `npx jest --testPathPattern=customer-auth.service.spec -x` | Wave 0 |
| D-03 | CustomerGuard rejects staff token | unit | `npx jest --testPathPattern=customer.guard.spec -x` | Wave 0 |
| D-03 | StaffGuard rejects customer token | unit | `npx jest --testPathPattern=staff.guard.spec -x` | Wave 0 |
| D-17 | EventBooking only created after payment confirmed | integration | manual test with Razorpay test mode | manual-only |
| D-08 | Duplicate webhook with same razorpay_payment_id not double-processed | unit | `npx jest --testPathPattern=webhooks.service.spec -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx jest --testPathPattern="razorpay|customer-auth|webhooks" --passWithNoTests`
- **Per wave merge:** `cd backend && npx jest --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/razorpay/razorpay.service.spec.ts` — covers D-09 signature verification
- [ ] `backend/src/webhooks/webhooks.controller.spec.ts` — covers D-10 webhook auth
- [ ] `backend/src/webhooks/webhooks.service.spec.ts` — covers D-10 dedup, D-08
- [ ] `backend/src/customer-auth/customer-auth.service.spec.ts` — covers D-02, D-04
- [ ] `backend/src/customer-auth/guards/customer.guard.spec.ts` — covers D-03
- [ ] `backend/src/customer-auth/guards/staff.guard.spec.ts` — covers D-03

---

## Sources

### Primary (HIGH confidence)
- `github.com/razorpay/razorpay-node` (v2.9.6, Feb 24, 2025) — SDK initialization, Orders API, payment/webhook verification utilities, Refund API
- `github.com/razorpay/razorpay-node/blob/master/documents/paymentVerfication.md` — validatePaymentVerification, validateWebhookSignature exact signatures
- `github.com/razorpay/razorpay-node/blob/master/documents/refund.md` — instance.payments.refund() parameters
- `github.com/razorpay/razorpay-node/blob/master/documents/order.md` — instance.orders.create() parameters and response
- `docs.nestjs.com/faq/raw-body` — NestJS rawBody: true feature, RawBodyRequest interface
- `github.com/nestjs/nest/issues/10471` — rawBody + json limit conflict solution via getBodyParserOptions
- `developers.facebook.com/docs/whatsapp/cloud-api/reference/messages` — WhatsApp API endpoint `POST /v18.0/{Phone-Number-ID}/messages`, Bearer token auth

### Secondary (MEDIUM confidence)
- Multiple community implementations cross-verifying HMAC algorithm: `HMAC_SHA256(order_id + "|" + payment_id, key_secret)` — consistent across all sources
- Razorpay webhook FAQs: `x-razorpay-event-id` unique per event for dedup; at-least-once delivery with exponential backoff 24h
- Razorpay webhook events verified: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`
- WhatsApp authentication template fixed body text: `"<VERIFICATION_CODE> is your verification code"` (AUTHENTICATION category)
- Meta WhatsApp Cloud API endpoint: `graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages` (current API version)

### Tertiary (LOW confidence — verify before use)
- `getBodyParserOptions` import path from `@nestjs/platform-express/adapters/utils/get-body-parser-options.util` — this is an internal NestJS utility; path may change with minor version. Verify against installed version before use.
- WhatsApp template component structure for AUTHENTICATION category `otp_type: COPY_CODE` button — gathered from third-party API gateway docs (Messangi), not directly from Meta. Verify against official Meta Graph API docs when creating template.

---

## Metadata

**Confidence breakdown:**
- Standard stack (Razorpay SDK): HIGH — verified v2.9.6 via npm registry, GitHub README, and official method signatures from raw GitHub docs
- HMAC signature algorithm: HIGH — verified from SDK source code, multiple independent community implementations, and Razorpay's own documentation summary
- NestJS raw body pattern: HIGH — verified from official NestJS docs and confirmed GitHub issue resolution
- WhatsApp Cloud API endpoint and auth: MEDIUM-HIGH — verified from Meta developer reference; template component structure from third-party docs
- Redis OTP pattern: HIGH — verified pattern consistent across NestJS, ioredis, and bcrypt documentation
- Webhook dedup via x-razorpay-event-id: HIGH — explicitly documented in Razorpay webhook FAQs

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (90 days — Razorpay API is stable; WhatsApp API version may change)
