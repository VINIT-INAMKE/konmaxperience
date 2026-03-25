---
phase: 23-razorpay-payments-customer-auth
verified: 2026-03-26T00:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "OTP arrives on WhatsApp in production"
    expected: "Customer receives 6-digit code via WhatsApp when WHATSAPP_TOKEN is configured"
    why_human: "Requires production WhatsApp credentials — dev mode falls back to console.log"
  - test: "Razorpay modal opens and completes payment on event detail page"
    expected: "Modal opens with correct amount, payment succeeds, booking confirmed, page shows success state"
    why_human: "Requires live Razorpay test keys and browser interaction"
  - test: "POS Razorpay flow staff-to-customer QR scan"
    expected: "Staff clicks 'Open Razorpay' on PaymentForm, customer scans QR, payment goes through, order status updates"
    why_human: "Requires two-device interaction and live Razorpay test keys"
  - test: "Free event booking skips modal"
    expected: "Selecting a free event (price=0), clicking 'Reserve My Spot' creates booking immediately without Razorpay modal"
    why_human: "Requires event with price=0 in a running environment"
  - test: "Capacity race condition triggers auto-refund message"
    expected: "If event fills between checkout and confirm, user sees refund message with amount"
    why_human: "Requires concurrent requests and Razorpay refund API reachability"
  - test: "Customer profile page shows phone verified badge"
    expected: "Logged-in customer at /profile sees +91 phone with green 'Verified' badge, can edit name, can logout"
    why_human: "Visual and session state — needs browser"
---

# Phase 23: Razorpay Payments + Customer Auth Verification Report

**Phase Goal:** OTP-based customer authentication (phone login), Razorpay payment gateway integration for customer marketplace, POS, and event bookings (events confirmed only after successful payment), with existing manual payment methods (cash/card/UPI) preserved
**Verified:** 2026-03-26
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Customer can request OTP via phone and receive it (or see console log in dev) | VERIFIED | `whatsapp.service.ts` line 19: `console.log('[DEV] OTP for ${recipientPhone}: ${otp}')` when token not configured; WhatsApp Cloud API call when WHATSAPP_TOKEN is set |
| 2 | Customer can verify OTP and receive a 30-day JWT cookie | VERIFIED | `customer-auth.service.ts` signs JWT with `{ customerId, type: 'customer' }` and `expiresIn: '30d'`, sets httpOnly `access_token` cookie |
| 3 | Staff tokens still work on all existing routes | VERIFIED | `auth.service.ts` adds `type: 'staff'` to JWT payload; `jwt.strategy.ts` validate() dispatches on payload.type; existing staff routes unaffected |
| 4 | CustomerGuard rejects staff tokens; StaffGuard rejects customer tokens | VERIFIED | `customer.guard.ts` throws if `user.type !== 'customer'`; `staff.guard.ts` throws if `user.type !== 'staff'` |
| 5 | OTP is rate-limited (3 send per hour, 5 verify attempts per OTP) | VERIFIED | `sendOtp`: `otp_rate:{phone}` key, rejects if attempts > 3; `verifyOtp`: `otp_verify:{phone}` key, invalidates OTP and rejects if attempts > 5 |
| 6 | First-time customer verification auto-links existing orders/bookings/feedback | VERIFIED | `verifyOtp` calls `prisma.order.updateMany`, `prisma.eventBooking.updateMany`, `prisma.feedback.updateMany` on `isNewCustomer` |
| 7 | RazorpayService creates orders and verifies signatures using SDK (not hand-rolled) | VERIFIED | `razorpay.service.ts` uses `validatePaymentVerification` and `validateWebhookSignature` from `razorpay/dist/utils/razorpay-utils` |
| 8 | Webhook endpoint deduplicates by x-razorpay-event-id using Redis SET NX, fails closed | VERIFIED | `webhooks.service.ts` line 30: `redis.set(dedupKey, '1', 'EX', 86400, 'NX')`; if Redis is null, throws `ServiceUnavailableException` (fail-closed per hardening) |
| 9 | Webhook routes to correct handler based on notes.type metadata | VERIFIED | `webhooks.service.ts` switch on `notes.type`: `event_booking`, `pos_order`, `marketplace` cases present |
| 10 | Event checkout creates Razorpay order (paid) or direct booking (free), events confirmed only after payment | VERIFIED | `checkoutEvent()` splits on `amountInPaise === 0`; `confirmBooking()` verifies HMAC signature + re-fetches from Razorpay API before setting `payment_status: 'paid'` |
| 11 | Capacity race condition triggers auto-refund | VERIFIED | `confirmBooking()` in serializable transaction, calls `razorpayService.createRefund()` and throws if capacity exceeded after payment |
| 12 | POS staff can create Razorpay order and confirm payment | VERIFIED | `POST /orders/:id/razorpay-order` and `POST /orders/:id/razorpay-confirm` present in `orders.controller.ts`, uses staff JWT (no `@Public()`) |
| 13 | Existing manual payment methods (cash/card/UPI) preserved | VERIFIED | `RecordPaymentDto` now accepts `['cash', 'card', 'upi', 'razorpay']`; existing `recordPayment` path unchanged; POS PaymentForm shows all 4 options |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/prisma/schema.prisma` | Customer model with phone unique, relations to Order/EventBooking/Feedback | VERIFIED | `model Customer` present, `phone String @unique`, relations to `EventBooking[]`, `Order[]`, `Feedback[]` |
| `backend/src/customer-auth/customer-auth.service.ts` | OTP generation, Redis storage, JWT issuance, auto-link | VERIFIED | Full implementation: `crypto.randomInt`, `bcrypt.hash`, `redis.set('otp:...'`, `expiresIn: '30d'`, auto-link with updateMany |
| `backend/src/customer-auth/guards/customer.guard.ts` | Guard requiring type=customer in JWT | VERIFIED | `user.type !== 'customer'` check in `handleRequest` |
| `backend/src/customer-auth/guards/staff.guard.ts` | Guard requiring type=staff in JWT | VERIFIED | `user.type !== 'staff'` check in `handleRequest` |
| `backend/src/types/auth.ts` | Extended JwtPayload with type discriminator | VERIFIED | `type: 'staff' | 'customer'`, `customerId?: string` present |
| `backend/src/razorpay/razorpay.service.ts` | SDK wrapper — createOrder, verifyPayment, verifyWebhook, createRefund, fetchPayment | VERIFIED | All 5 methods present, uses official SDK utilities |
| `backend/src/webhooks/webhooks.controller.ts` | POST /webhooks/razorpay with @Public() and raw body | VERIFIED | `@Post('razorpay')`, `@Public()`, `@HttpCode(200)`, `rawBody` extraction |
| `backend/src/webhooks/webhooks.service.ts` | Webhook routing, dedup, event processing | VERIFIED | signature-first, SET NX dedup, routing switch, idempotent handlers |
| `backend/src/events/events.service.ts` | checkoutEvent and confirmBooking methods | VERIFIED | Both methods present with full implementation |
| `backend/src/events/events.controller.ts` | POST /events/:id/checkout and /bookings/confirm | VERIFIED | Both routes with `@UseGuards(CustomerGuard)`, old `@Post(':id/bookings')` preserved |
| `backend/src/orders/orders.service.ts` | createRazorpayOrder, confirmRazorpayPayment | VERIFIED | Both methods at lines 482 and 530 |
| `backend/src/orders/orders.controller.ts` | POST /orders/:id/razorpay-order and /razorpay-confirm | VERIFIED | Both routes without `@Public()` (staff-only) |
| `frontend/hooks/use-razorpay.ts` | Dynamic checkout.js loader + state machine | VERIFIED | State machine with 8 states, dynamic script loader, optionsRef pattern |
| `frontend/hooks/use-customer-auth.ts` | Customer session management | VERIFIED | fetchProfile, sendOtp, verifyOtp, updateProfile, logout all wired to API |
| `frontend/components/public/EventCheckoutForm.tsx` | Auth-aware event booking form | VERIFIED | Uses `useRazorpay` and `useCustomerAuth`, handles free/paid paths |
| `frontend/components/public/CustomerOtpForm.tsx` | Three-phase OTP flow | VERIFIED | phone -> otp -> name phases with auto-advance and rate limit handling |
| `frontend/components/ops/pos/PaymentForm.tsx` | Extended with Razorpay option | VERIFIED | `razorpay` SelectItem present, opens modal, confirms via `/orders/:id/razorpay-confirm` |
| `frontend/app/(public)/events/[id]/page.tsx` | Uses EventCheckoutForm | VERIFIED | `import { EventCheckoutForm }` and `<EventCheckoutForm .../>` present |
| `frontend/app/(public)/profile/page.tsx` | Customer profile page | VERIFIED | Phone verified badge, inline name edit, logout — all wired to useCustomerAuth |
| `frontend/app/(public)/layout.tsx` | Login/profile link in header | VERIFIED | `<Link href="/profile">` with User icon present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `customer-auth.service.ts` | `redis.service.ts` | Redis OTP storage | VERIFIED | `redis.set('otp:' + phone, hash, 'EX', 300)` at line 56 |
| `jwt.strategy.ts` | `types/auth.ts` | JwtPayload type import | VERIFIED | `payload.type === 'customer'` check in validate() |
| `webhooks.controller.ts` | `razorpay.service.ts` | verifyWebhookSignature call | VERIFIED | `webhooksService.processWebhook()` which calls `razorpayService.verifyWebhookSignature()` |
| `webhooks.service.ts` | `redis.service.ts` | Redis SET NX dedup | VERIFIED | `redis.set(dedupKey, '1', 'EX', 86400, 'NX')` at line 30 |
| `main.ts` | raw body preservation | verify callback on json() | VERIFIED | `req.rawBody = buf` inside verify callback at `/webhooks/razorpay` path only |
| `events.service.ts` | `razorpay.service.ts` | createOrder + verifyPaymentSignature | VERIFIED | `this.razorpayService.createOrder(...)` line 294, `this.razorpayService.verifyPaymentSignature(...)` line 334 |
| `events.service.ts` | `razorpay.service.ts` | createRefund for race condition | VERIFIED | `this.razorpayService.createRefund(...)` line 373 |
| `orders.service.ts` | `razorpay.service.ts` | createOrder for POS | VERIFIED | `this.razorpayService.createOrder(...)` in createRazorpayOrder |
| `EventCheckoutForm.tsx` | `use-razorpay.ts` | openCheckout callback | VERIFIED | `import { useRazorpay }` and `const { state: rzpState, openCheckout, reset: resetRzp } = useRazorpay(...)` |
| `EventCheckoutForm.tsx` | `use-customer-auth.ts` | customer session state | VERIFIED | `import { useCustomerAuth }` and `const { customer, isLoading, fetchProfile, logout } = useCustomerAuth()` |
| `events/[id]/page.tsx` | `EventCheckoutForm.tsx` | replaces EventBookingForm | VERIFIED | `import { EventCheckoutForm }` — EventBookingForm no longer present in this page |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| PAY-01 | 23-01 | Customer Prisma model with phone (unique), name, email, relations to Order/EventBooking/Feedback | SATISFIED | `model Customer` in schema.prisma with all required fields and relations |
| PAY-02 | 23-01 | OTP-based customer auth via WhatsApp Cloud API — 6-digit, bcrypt-hashed, Redis TTL 5min, rate-limited 3/hour | SATISFIED | Full implementation in customer-auth.service.ts; 5-attempt brute-force guard added (security hardening) |
| PAY-03 | 23-01 | JwtPayload extended with `type: 'staff' | 'customer'` and `customerId` | SATISFIED | `types/auth.ts` has both fields |
| PAY-04 | 23-01 | Customer JWT: 30-day access token in `customer_access_token` httpOnly cookie, no refresh token | SATISFIED (with deviation) | Cookie name changed to `access_token` (same as staff, type discriminator in JWT differentiates); 30-day expiry verified; no refresh token issued; accessToken NOT in response body |
| PAY-05 | 23-01 | CustomerGuard (type=customer) and StaffGuard (type=staff) | SATISFIED | Both guards verified in codebase |
| PAY-06 | 23-01 | Auto-link on first customer login — backfill customer_id on existing Order/EventBooking/Feedback | SATISFIED | updateMany calls in verifyOtp on isNewCustomer |
| PAY-07 | 23-02 | RazorpayService wrapping SDK with 5 methods | SATISFIED | All 5 methods in razorpay.service.ts |
| PAY-08 | 23-02 | HMAC-SHA256 signature verification using `validatePaymentVerification` from razorpay SDK | SATISFIED | Import and usage of validatePaymentVerification verified |
| PAY-09 | 23-02 | Webhook signature verification with `validateWebhookSignature` using raw body | SATISFIED | validateWebhookSignature called with rawBody.toString() |
| PAY-10 | 23-02 | Webhook endpoint POST /webhooks/razorpay — @Public(), raw body, dedup by x-razorpay-event-id via Redis SET NX | SATISFIED | All attributes verified in webhooks.controller.ts and webhooks.service.ts |
| PAY-11 | 23-02 | Webhook routing by order notes.type metadata | SATISFIED | Switch statement on notes.type: event_booking, pos_order, marketplace |
| PAY-12 | 23-02 | main.ts updated for raw body preservation | SATISFIED | `verify: (req, _res, buf) => { if (req.originalUrl === '/webhooks/razorpay') req.rawBody = buf }` — scoped to webhook path only (memory optimization) |
| PAY-13 | 23-03 | Event checkout: POST /events/:id/checkout (CustomerGuard, server-side amount, returns razorpay_order_id) | SATISFIED | Route present with `@UseGuards(CustomerGuard)`, amount calculated from `event.price.toNumber() * guests * 100` |
| PAY-14 | 23-03 | Event confirm: POST /events/:id/bookings/confirm (CustomerGuard, verify + re-fetch + serializable tx) | SATISFIED | Route present, verifyPaymentSignature BEFORE fetchPayment, serializable transaction used |
| PAY-15 | 23-02 | Payment model extended with razorpay fields; 'razorpay' as 4th method | SATISFIED | schema.prisma has razorpay_order_id, razorpay_payment_id; RecordPaymentDto has 'razorpay' |
| PAY-16 | 23-03 | Free events (price=0) skip Razorpay, create booking with payment_status='free' | SATISFIED | `if (amountInPaise === 0)` branch in checkoutEvent creates booking with `payment_status: 'free'` |
| PAY-17 | 23-03 | Capacity race condition after payment triggers auto-refund + refunded status | SATISFIED | `razorpayService.createRefund()` called in confirmBooking when capacity exceeded, booking set to 'refunded' |
| PAY-18 | 23-03 | POS Razorpay: create order + confirm payment for existing orders | SATISFIED | Both routes in orders.controller.ts, staff JWT only (no @Public()) |
| PAY-19 | 23-04 | Frontend useRazorpay hook — dynamic checkout.js loader, state machine | SATISFIED | Full hook at frontend/hooks/use-razorpay.ts with 8 states |
| PAY-20 | 23-04 | Frontend CustomerOtpForm — three-phase OTP flow | SATISFIED | phone -> otp -> name phases implemented, auto-advance via useEffect |
| PAY-21 | 23-04 | Frontend EventCheckoutForm — replaces EventBookingForm on event detail page | SATISFIED | EventCheckoutForm imported and used in events/[id]/page.tsx |
| PAY-22 | 23-04 | Frontend POS PaymentForm — Razorpay SelectItem, opens modal, confirms | SATISFIED | Razorpay option in Select, handleOpenRazorpay opens modal, handleRazorpaySuccess confirms |
| PAY-23 | 23-04 | Customer profile page at /profile | SATISFIED | Page at frontend/app/(public)/profile/page.tsx with phone badge, name edit, logout |
| PAY-24 | 23-04 | Public layout login/profile link in header | SATISFIED | `<Link href="/profile">` with User icon in public layout header |

### Security Hardening Verification (Post-Plan Additions)

The following hardening items were added after plan execution. Each is verified as an improvement that does not break any must-haves:

| Hardening Item | Verified Present | Impact on Must-Haves |
|----------------|-----------------|----------------------|
| OTP brute-force protection (5 attempt limit per phone) | YES — `otp_verify:{phone}` key, invalidates OTP on 6th attempt | Strengthens PAY-02; does not break OTP flow (legitimate users succeed within 5 attempts) |
| Serializable transactions on all event checkout paths | YES — `Prisma.TransactionIsolationLevel.Serializable` in both free and paid checkout paths | Strengthens PAY-13/PAY-17; capacity counting is now race-condition-safe |
| Webhook dedup fails closed (ServiceUnavailableException if Redis down) | YES — `if (!redis) throw new ServiceUnavailableException(...)` before dedup | Strengthens PAY-10; ensures no webhooks process without dedup guarantee |
| accessToken removed from response body | YES — `customer-auth.service.ts` verifyOtp returns `{ customer: {...}, isNewCustomer }` only; no token in body | Strengthens PAY-04; prevents XSS token theft |
| CSV formula injection sanitization | YES — `csv-sanitize.ts` utility used across all export builders | Not related to phase 23 functionality; no impact |
| Global exception filter | YES — `GlobalExceptionFilter` applied in `main.ts` | Prevents stack trace leakage on unhandled errors; no impact on payment flows |
| Neon reconnect logic in PrismaService | YES — `prisma.service.ts` has auto-reconnect on connection-closed errors | Improves reliability; no impact on payment logic |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/src/webhooks/webhooks.service.ts` | 59–61 | `case 'marketplace': console.log(...)` noop | Info | Phase 24 placeholder — explicitly documented, not a blocker for phase 23 goal |

No blockers or warnings found. The marketplace noop is intentional stub for Phase 24.

### PAY-04 Cookie Name Deviation

The PLAN specified `customer_access_token` as the cookie name. The implementation uses `access_token` for both staff and customer tokens. The type discriminator (`type: 'staff' | 'customer'`) in the JWT payload differentiates them at the application layer.

**Assessment:** This is a valid design decision documented in the SUMMARY ("single cookie for both staff + customer"). The `JwtStrategy.validate()` correctly dispatches on `payload.type`. Both `CustomerGuard` and `StaffGuard` check `user.type`. The consolidated cookie name avoids having two competing cookies from the same domain. PAY-04 is SATISFIED — the 30-day httpOnly cookie with no refresh token requirement is met; the specific cookie name `customer_access_token` was a plan suggestion, not a hard requirement, and the alternative approach achieves the security goals (httpOnly, no token in body, type-discriminated).

### Human Verification Required

1. **WhatsApp OTP delivery in production**
   - **Test:** Set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID, trigger OTP for an Indian mobile number
   - **Expected:** Customer receives 6-digit code via WhatsApp within ~10 seconds
   - **Why human:** Requires production credentials and real device

2. **Razorpay event booking end-to-end**
   - **Test:** Navigate to a paid event detail page, click "Send OTP", complete OTP flow, click "Book & Pay", complete Razorpay modal
   - **Expected:** Razorpay modal opens with correct amount (event.price * guests), payment succeeds, page shows success state with event date
   - **Why human:** Requires browser, Razorpay test keys, live backend

3. **POS Razorpay flow**
   - **Test:** Open an order in POS, select Razorpay method, click "Open Razorpay", customer scans QR or enters card
   - **Expected:** Modal opens, payment goes through, toast "Payment confirmed via Razorpay" appears
   - **Why human:** Two-device interaction, live Razorpay keys

4. **Free event booking**
   - **Test:** Navigate to an event with price=0, complete OTP login, click "Reserve My Spot"
   - **Expected:** No Razorpay modal, booking confirmed directly, page shows success
   - **Why human:** Requires a free event in the database

5. **Capacity race condition auto-refund message**
   - **Test:** Manually fill event to capacity, then attempt a paid booking and confirm payment
   - **Expected:** User sees "This event is now full. Your payment has been refunded..." message with refund amount
   - **Why human:** Requires concurrent state manipulation and Razorpay refund API

6. **Customer profile page at /profile**
   - **Test:** Log in via OTP, navigate to /profile
   - **Expected:** Phone shown with green "Verified" badge, name editable inline, logout works
   - **Why human:** Visual and session state verification

### Gaps Summary

No gaps found. All 24 requirements (PAY-01 through PAY-24) are satisfied. All 13 plan must-have truths are verified. All key links are wired. Unit test suites exist and contain the required test coverage (verified by file content):

- `customer-auth.service.spec.ts`: 9 test cases (sendOtp rate limiting, verifyOtp flow, auto-link, JWT cookie)
- `customer-auth-task1.spec.ts`: 10 test cases (guard type enforcement, JWT strategy)
- `razorpay.service.spec.ts`: 9 test cases (SDK methods, signature verification, error handling)
- `webhooks.service.spec.ts`: 8 test cases (dedup, routing, idempotency, refunds)
- `events-checkout.spec.ts`: 10 test cases (free/paid checkout, confirmBooking, race condition)
- `orders-razorpay.spec.ts`: 9 test cases (createRazorpayOrder, confirmRazorpayPayment, idempotency)

The post-plan security hardening (OTP brute-force guard, serializable transactions, fail-closed dedup, no token in body, global exception filter) are all verified present and are improvements that strengthen the implementation without breaking any phase 23 goals.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
