# Phase 23: Razorpay Payments + Customer Auth - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

OTP-based customer authentication (phone login via WhatsApp), Razorpay payment gateway integration for event bookings and POS, with existing manual payment methods (cash/card/UPI) preserved. Events are confirmed only after successful payment. This phase builds the payment infrastructure that Phase 24 (Customer Marketplace) will reuse.

</domain>

<decisions>
## Implementation Decisions

### Customer identity model
- **D-01:** Separate `Customer` Prisma model (NOT extending the staff `User` model). Fields: `id` (uuid), `phone` (unique, login identifier), `name` (optional, prompted at first order/booking), `email` (optional, for receipts). Customer and User are completely independent entities with separate auth flows
- **D-02:** Custom OTP via Meta WhatsApp Business Cloud API (not SMS, not Clerk). OTP is 6-digit numeric, generated server-side, hashed and stored in Upstash Redis with 5-minute TTL. Rate limited: 3 OTP requests per phone per hour. Env vars: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`
- **D-03:** Single JWT strategy handles both staff and customer tokens. Staff token payload: `{ userId, roleCode, type: 'staff' }`. Customer token payload: `{ customerId, type: 'customer' }`. New guards: `StaffGuard` (requires type=staff), `CustomerGuard` (requires type=customer). Existing `@Public()` decorator still works. `JwtAuthGuard` updated to extract `type` field
- **D-04:** Customer session: 30-day access token, no refresh token. Cookie: `customer_access_token` (httpOnly, 30-day maxAge). On expiry, customer re-does OTP (10 seconds). No refresh token complexity for customer flow
- **D-05:** Auto-link on first login: when customer verifies phone for the first time, find all `Order`, `EventBooking`, and `Feedback` records with matching `customer_phone` and set their `customer_id` FK. One-time backfill query per customer

### Razorpay integration pattern
- **D-06:** Razorpay Custom Checkout (embedded JavaScript modal). Customer stays on our site. Frontend loads Razorpay checkout.js, opens modal with `razorpay_order_id`. Modal handles card/UPI/wallet/netbanking. Returns `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }` to our callback
- **D-07:** Same Razorpay order is retryable. If payment fails or customer closes the modal, the Razorpay order stays open. Customer can retry with the same `razorpay_order_id`. Booking/order stays in `payment_pending` until success or 30-minute expiry
- **D-08:** Idempotency on ALL payment-related endpoints. Razorpay's native `idempotency_key` header on order creation. Backend `findFirst` before create on all booking/payment records. Webhook handler checks `razorpay_payment_id` uniqueness before processing. No double charges, no double bookings

### Payment security (CRITICAL)
- **D-09:** HMAC-SHA256 signature verification on EVERY payment confirmation. Backend verifies `razorpay_signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)`. NEVER trust frontend-only payment confirmation. Both the frontend callback AND the webhook verify signatures independently
- **D-10:** Razorpay webhook endpoint (`POST /webhooks/razorpay`) is `@Public()` (no JWT) but protected by Razorpay's webhook signature verification using `RAZORPAY_WEBHOOK_SECRET` (separate from API key secret). Raw body preserved for signature check (no JSON parse before verification)
- **D-11:** Server-side amount validation: backend creates Razorpay orders with the authoritative amount (calculated from event price x guests or order total). Frontend NEVER sends the amount — only the `razorpay_order_id`. Amount tampering is impossible because Razorpay enforces the order amount
- **D-12:** Payment status is ONLY updated via: (a) verified webhook callback, or (b) verified frontend signature + server-side Razorpay API re-fetch (`GET /payments/:id` on Razorpay's API) to confirm capture. Belt and suspenders — never trust a single source
- **D-13:** All Razorpay secrets (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) stored as env vars, never in code. Key ID is the only value exposed to frontend (it's public by design). Key Secret and Webhook Secret are backend-only, never sent to client
- **D-14:** Refund handling: automated refunds only for race condition scenarios (event capacity exceeded after payment). All other refunds are admin-initiated via a backend endpoint with `MANAGE_SYSTEM` permission guard. Refunds use Razorpay's Refund API with full audit logging (who, when, why, amount)
- **D-15:** Rate limiting on all payment endpoints: `POST /payments/create-order` rate limited per customer (5/min). Webhook endpoint rate limited by IP (100/min — Razorpay sends bursts). OTP endpoints rate limited per phone (3/hour, 10/day)
- **D-16:** No payment data (card numbers, UPI IDs) ever touches our server. Razorpay's checkout modal handles all sensitive input directly. Our database stores only: `razorpay_order_id`, `razorpay_payment_id`, `payment_method` (which method was used), `amount`, `status`. PCI-DSS compliance is Razorpay's responsibility

### Event booking payment flow
- **D-17:** Pay-to-book model: EventBooking is ONLY created after payment succeeds. No dangling unpaid bookings. Flow: customer selects event + guest count → backend creates Razorpay order (checks capacity) → customer pays via modal → backend verifies signature, re-checks capacity in serializable transaction, creates EventBooking with payment fields. If capacity exceeded after payment: auto-refund via Razorpay Refund API + error response
- **D-18:** EventBooking model extended with: `customer_id` (FK to Customer), `razorpay_order_id`, `razorpay_payment_id`, `payment_status` ('pending' | 'paid' | 'refunded'), `payment_amount` (Decimal). Existing anonymous fields (`customer_name`, `customer_phone`) kept for backward compatibility but new bookings set `customer_id`
- **D-19:** Free events (price = 0) also require customer login. Skip the Razorpay modal but still create a proper EventBooking linked to the Customer record. Consistent experience, builds customer base
- **D-20:** Booking endpoints: `POST /events/:id/checkout` (customer auth, creates Razorpay order, returns `razorpay_order_id`), `POST /events/:id/bookings/confirm` (customer auth, verifies signature, creates booking). Old anonymous `POST /events/:id/bookings` is deprecated but kept for backward compat (staff can still create bookings manually)

### POS + manual payment coexistence
- **D-21:** `razorpay` added as 4th payment method alongside `cash`, `card`, `upi`. `Payment.method` validator: `@IsIn(['cash', 'card', 'upi', 'razorpay'])`. Cash/card/upi flow is UNCHANGED — staff records manually as today
- **D-22:** POS Razorpay flow: staff clicks "Pay via Razorpay" → backend creates Razorpay order for the Order total → Razorpay modal opens on POS screen → customer taps card/scans UPI → webhook confirms payment → Payment record created with method='razorpay' and Razorpay IDs
- **D-23:** Single shared webhook endpoint (`POST /webhooks/razorpay`). Routes internally based on Razorpay order metadata: `{ type: 'event_booking' | 'pos_order' | 'marketplace', entity_id: '<uuid>' }`. Metadata is set when creating the Razorpay order. One webhook URL in Razorpay dashboard

### Claude's Discretion
- Exact Razorpay SDK version and initialization pattern
- Redis key schema for OTP storage
- WhatsApp message template design
- Customer auth module internal structure
- Error message wording for payment failures
- Webhook retry handling (Razorpay retries failed webhooks)
- Payment expiry cron job design (cleanup pending orders after 30min)

</decisions>

<specifics>
## Specific Ideas

- Security is the absolute top priority — this is money. Every payment confirmation must be double-verified (signature + API re-fetch). No shortcuts on HMAC verification
- Idempotency everywhere payment-related — double charges are unacceptable
- WhatsApp OTP preferred over SMS — higher trust and open rates in India
- The Razorpay infrastructure built here must be reusable for Phase 24 (marketplace checkout) — design the RazorpayModule as a shared service, not tightly coupled to events or POS

</specifics>

<canonical_refs>
## Canonical References

### Payment infrastructure
- `backend/src/orders/orders.service.ts` — `recordPayment()` method showing current manual payment flow, amount tolerance check, idempotency pattern
- `backend/src/orders/dto/record-payment.dto.ts` — Current `@IsIn(['cash', 'card', 'upi'])` validator to extend
- `backend/prisma/schema.prisma` — `Payment` model (1:1 with Order), `EventBooking` model (fields to extend), `Order` model (customer_name/phone fields)

### Auth infrastructure
- `backend/src/auth/auth.service.ts` — JWT signing, cookie setting, refresh token rotation — pattern to extend for customer tokens
- `backend/src/auth/jwt.strategy.ts` — Custom JWT extractor (Bearer header + cookie fallback) — needs `type` field handling
- `backend/src/auth/guards/jwt-auth.guard.ts` — Global auth guard with `@Public()` bypass — needs type-aware routing
- `backend/src/auth/guards/permissions.guard.ts` — Role-based permission check — staff only, customer bypasses this

### Event bookings
- `backend/src/events/events.service.ts` — `createBooking()` with serializable transaction, capacity check, duplicate phone guard
- `backend/src/events/events.controller.ts` — `@Public()` routes for event browsing and booking

### Environment
- `.env.example` — Existing env var patterns. Phase 23 adds: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`
- `backend/src/main.ts` — IST timezone, CORS config, global guards registration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuthModule` pattern: JWT strategy, guards, cookie handling — extend for customer auth
- `PusherService` graceful fallback pattern: same pattern for WhatsApp service (null client when env vars missing for dev)
- Upstash Redis: already configured for notifications — reuse for OTP hash storage with TTL
- `MailerSendService`: pattern reference for external API service (similar structure for WhatsApp and Razorpay services)

### Established Patterns
- `@Public()` decorator with `isPublic` metadata for unauthenticated routes
- `@Throttle()` for rate limiting (already on auth routes)
- Serializable transactions for race condition prevention (already on EventBooking)
- `findFirst` before create for idempotency (already on Payment)
- httpOnly cookie setting via `res.cookie()` in auth service

### Integration Points
- `Payment.method` needs new `'razorpay'` value in DTO validator and schema comment
- `EventBooking` needs new fields: `customer_id`, `razorpay_order_id`, `razorpay_payment_id`, `payment_status`, `payment_amount`
- `Order` model needs optional `customer_id` FK (currently uses freetext `customer_name`/`customer_phone`)
- `Feedback` model needs optional `customer_id` FK
- JWT payload type needs extending with `type: 'staff' | 'customer'` field
- Global `JwtAuthGuard` needs to handle both staff and customer tokens
- New env vars: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`
- Razorpay checkout.js script tag needed in frontend layout (or dynamic load)

</code_context>

<deferred>
## Deferred Ideas

- Customer-facing marketplace (cart, checkout, delivery) — Phase 24
- Customer order history page — Phase 24
- Customer delivery address management — Phase 24
- Razorpay subscription/recurring payments — future phase
- Payment analytics dashboard — future phase
- Multi-currency support — out of scope
- Customer loyalty/rewards program — future phase
- Razorpay smart collect (virtual accounts) — future phase

</deferred>

---

*Phase: 23-razorpay-payments-customer-auth*
*Context gathered: 2026-03-25*
