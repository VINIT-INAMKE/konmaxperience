---
phase: 23-razorpay-payments-customer-auth
plan: 02
subsystem: payments
tags: [razorpay, webhooks, hmac, redis, dedup, nestjs, sdk]

# Dependency graph
requires:
  - phase: 23-razorpay-payments-customer-auth
    provides: Customer model, RedisService, CustomerAuthModule with RedisService export
provides:
  - RazorpayService (shared SDK wrapper) with createOrder, verifyPaymentSignature, verifyWebhookSignature, fetchPayment, createRefund
  - WebhooksController with POST /webhooks/razorpay endpoint (@Public, raw body, signature-first verification)
  - WebhooksService with Redis SET NX dedup, metadata-based routing, idempotent handlers
  - Raw body preservation in main.ts for webhook signature verification
  - RecordPaymentDto extended with 'razorpay' as 4th payment method
affects: [23-03, 23-04, 24-customer-marketplace]

# Tech tracking
tech-stack:
  added: [razorpay@2.9.6]
  patterns: [razorpay-sdk-wrapper, webhook-signature-first, redis-set-nx-dedup, raw-body-verify-callback, metadata-based-webhook-routing]

key-files:
  created:
    - backend/src/razorpay/razorpay.service.ts
    - backend/src/razorpay/razorpay.module.ts
    - backend/src/razorpay/razorpay.service.spec.ts
    - backend/src/webhooks/webhooks.controller.ts
    - backend/src/webhooks/webhooks.service.ts
    - backend/src/webhooks/webhooks.module.ts
    - backend/src/webhooks/webhooks.service.spec.ts
  modified:
    - backend/src/main.ts
    - backend/src/app.module.ts
    - backend/src/orders/dto/record-payment.dto.ts
    - backend/package.json

key-decisions:
  - "Module-level jest.mock for Razorpay constructor to prevent real SDK API calls in tests"
  - "Raw body via verify callback (req.rawBody = buf) instead of bodyParser:false + getBodyParserOptions (simpler, standard Express pattern)"
  - "express default import pattern in WebhooksController matching existing codebase convention"

patterns-established:
  - "Razorpay SDK wrapper: singleton instance via OnModuleInit, graceful disable when env vars missing"
  - "Webhook signature-first: verify HMAC before dedup before routing (security before optimization)"
  - "Redis SET NX dedup: webhook_processed:{eventId} key with 24h TTL for idempotent webhook processing"
  - "Metadata-based routing: Razorpay order notes.type determines which handler processes the webhook"
  - "Raw body preservation: verify callback on json() middleware stores Buffer as req.rawBody"

requirements-completed: [PAY-07, PAY-08, PAY-09, PAY-10, PAY-11, PAY-12, PAY-15]

# Metrics
duration: 10min
completed: 2026-03-25
---

# Phase 23 Plan 02: Razorpay SDK + Webhooks Summary

**Shared RazorpayService wrapping razorpay@2.9.6 SDK with HMAC signature verification, webhook endpoint with Redis SET NX dedup and metadata-based routing to event booking/POS/marketplace handlers**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-25T19:59:45Z
- **Completed:** 2026-03-25T20:09:45Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- RazorpayService with full SDK wrapper: createOrder (paise amounts), verifyPaymentSignature, verifyWebhookSignature, fetchPayment, createRefund
- Webhook endpoint POST /webhooks/razorpay with @Public(), raw body extraction, signature-first verification, Redis dedup (24h TTL), and metadata-based routing
- All handlers are idempotent: event bookings skip if already paid, POS creates or updates payment records, refunds update booking/payment status
- Raw body preserved in main.ts via verify callback for webhook signature verification
- 17 unit tests across 2 test suites (9 RazorpayService + 8 WebhooksService)

## Task Commits

Each task was committed atomically:

1. **Task 1: RazorpayService SDK wrapper + raw body + payment DTO** - `55f869d` (feat)
2. **Task 2: WebhooksModule with dedup, routing, and handlers** - `00c7941` (feat)

_Both tasks followed TDD flow: RED (failing tests) -> GREEN (implementation) -> verify_

## Files Created/Modified
- `backend/src/razorpay/razorpay.service.ts` - Shared Razorpay SDK wrapper with createOrder, verify*, fetch, refund methods
- `backend/src/razorpay/razorpay.module.ts` - Module exporting RazorpayService for import by other modules
- `backend/src/razorpay/razorpay.service.spec.ts` - 9 unit tests for SDK wrapper methods and error handling
- `backend/src/webhooks/webhooks.controller.ts` - POST /webhooks/razorpay with @Public(), @Throttle(100/min), raw body extraction
- `backend/src/webhooks/webhooks.service.ts` - Webhook processing: signature verify, Redis dedup, event routing, idempotent handlers
- `backend/src/webhooks/webhooks.module.ts` - Module importing PrismaModule, RazorpayModule, CustomerAuthModule
- `backend/src/webhooks/webhooks.service.spec.ts` - 8 unit tests for webhook processing, dedup, routing, idempotency
- `backend/src/main.ts` - Added verify callback to json() middleware for raw body preservation
- `backend/src/app.module.ts` - Registered RazorpayModule and WebhooksModule
- `backend/src/orders/dto/record-payment.dto.ts` - Added 'razorpay' to @IsIn validator
- `backend/package.json` - Added razorpay@2.9.6 dependency

## Decisions Made
- Used module-level `jest.mock('razorpay')` to mock SDK constructor (prevents real API calls; `jest.mock` inside `beforeEach` doesn't intercept module-level imports)
- Used verify callback pattern `(req, _res, buf) => { req.rawBody = buf }` on `json()` middleware instead of `bodyParser: false` + `getBodyParserOptions` (simpler, standard Express pattern used by Stripe/Shopify, avoids importing internal NestJS utility)
- Used `import express from 'express'` default import in WebhooksController (matching existing codebase pattern in auth.controller.ts to avoid isolatedModules TS errors)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all implementations matched plan specifications.

## User Setup Required

For production deployment, the following Razorpay configuration is needed:
- Set `RAZORPAY_KEY_ID` (from Razorpay Dashboard -> Settings -> API Keys)
- Set `RAZORPAY_KEY_SECRET` (from Razorpay Dashboard -> Settings -> API Keys)
- Set `RAZORPAY_WEBHOOK_SECRET` (from Razorpay Dashboard -> Settings -> Webhooks)
- Configure webhook URL in Razorpay Dashboard: `https://{backend-url}/webhooks/razorpay`
- Subscribe to events: payment.captured, order.paid, payment.failed, refund.processed

For development, the service gracefully disables when env vars are missing.

## Next Phase Readiness
- RazorpayModule ready for import by EventsModule (Plan 03) and OrdersModule (Plan 04)
- WebhooksModule ready to receive and route all Razorpay webhook events
- Payment DTO accepts 'razorpay' method for POS flow (Plan 04)
- Raw body preserved for webhook signature verification

## Self-Check: PASSED

- All 7 created files verified present on disk
- Both task commits (55f869d, 00c7941) verified in git log
- 17/17 tests passing across 2 test suites
- TypeScript compilation clean (0 errors in non-spec files)
- No stubs or placeholder content detected

---
*Phase: 23-razorpay-payments-customer-auth*
*Completed: 2026-03-25*
