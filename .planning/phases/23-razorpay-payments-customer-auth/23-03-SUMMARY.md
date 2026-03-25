---
phase: 23-razorpay-payments-customer-auth
plan: 03
subsystem: payments
tags: [razorpay, events, orders, pos, checkout, confirm, refund, hmac, nestjs, tdd]

# Dependency graph
requires:
  - phase: 23-razorpay-payments-customer-auth
    provides: RazorpayService (createOrder, verifyPaymentSignature, fetchPayment, createRefund), CustomerGuard, Customer model, EventBooking/Payment schema with Razorpay fields
provides:
  - POST /events/:id/checkout (customer auth, Razorpay order creation for paid events, direct booking for free)
  - POST /events/:id/bookings/confirm (signature verify + API re-fetch + booking update with auto-refund)
  - POST /orders/:id/razorpay-order (staff auth, Razorpay order from Order.total for POS)
  - POST /orders/:id/razorpay-confirm (staff auth, signature verify + API re-fetch + Payment update)
  - 19 unit tests across 2 test suites covering all payment flows
affects: [23-04, 24-customer-marketplace]

# Tech tracking
tech-stack:
  added: []
  patterns: [pay-to-book-with-capacity-check, belt-and-suspenders-signature-verify, auto-refund-on-capacity-race, server-side-amount-only]

key-files:
  created:
    - backend/src/events/dto/checkout-event.dto.ts
    - backend/src/events/dto/confirm-booking.dto.ts
    - backend/src/events/events-checkout.spec.ts
    - backend/src/orders/dto/create-razorpay-order.dto.ts
    - backend/src/orders/orders-razorpay.spec.ts
  modified:
    - backend/src/events/events.service.ts
    - backend/src/events/events.controller.ts
    - backend/src/events/events.module.ts
    - backend/src/events/events.service.spec.ts
    - backend/src/orders/orders.service.ts
    - backend/src/orders/orders.controller.ts
    - backend/src/orders/orders.module.ts
    - backend/src/orders/orders.service.spec.ts

key-decisions:
  - "Number(payment.amount) cast for Razorpay SDK fetchPayment return type (string | number) to satisfy createRefund number parameter"
  - "EventEmitter2 and RazorpayService mocks added to orders.service.spec.ts for DI resolution after constructor change"

patterns-established:
  - "Belt-and-suspenders: verifyPaymentSignature BEFORE fetchPayment on all confirm endpoints"
  - "Server-side amount only: checkout/createRazorpayOrder calculates paise from DB prices, never from frontend"
  - "Capacity race condition auto-refund: serializable tx re-checks capacity, triggers createRefund if exceeded"
  - "Idempotent confirm: return existing record if payment_status already paid"

requirements-completed: [PAY-13, PAY-14, PAY-16, PAY-17, PAY-18]

# Metrics
duration: 13min
completed: 2026-03-25
---

# Phase 23 Plan 03: Event Checkout + POS Razorpay Summary

**Event booking pay-to-book flow with Razorpay checkout/confirm, free event path, capacity race condition auto-refund, and POS Razorpay order creation + confirmation with belt-and-suspenders signature verification**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-25T20:13:59Z
- **Completed:** 2026-03-25T20:26:31Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Event booking checkout creates Razorpay order (paid events) or direct booking (free events) with serializable transaction capacity enforcement
- Event booking confirm verifies HMAC signature, re-fetches payment from Razorpay API, updates booking in serializable transaction with automatic refund on capacity race condition
- POS Razorpay order creation from Order.total with idempotent Payment upsert, POS payment confirmation with signature + API re-fetch
- Old anonymous POST /events/:id/bookings preserved for backward compatibility
- 19 unit tests across 2 TDD suites covering checkout, confirm, idempotency, auto-refund, and error cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Event booking checkout + confirm endpoints with TDD** - `8410a3a` (feat)
2. **Task 2: POS Razorpay order creation + payment confirmation with TDD** - `b7e3224` (feat)

_Both tasks followed TDD flow: RED (failing tests) -> GREEN (implementation) -> verify_

## Files Created/Modified
- `backend/src/events/dto/checkout-event.dto.ts` - CheckoutEventDto with guests validation (no amount field)
- `backend/src/events/dto/confirm-booking.dto.ts` - ConfirmBookingDto with razorpay_order_id, razorpay_payment_id, razorpay_signature
- `backend/src/events/events.service.ts` - Added checkoutEvent and confirmBooking methods with Razorpay integration
- `backend/src/events/events.controller.ts` - Added POST :id/checkout and POST :id/bookings/confirm with CustomerGuard
- `backend/src/events/events.module.ts` - Added RazorpayModule import
- `backend/src/events/events-checkout.spec.ts` - 10 unit tests for checkout and confirm flows
- `backend/src/events/events.service.spec.ts` - Fixed constructor to accept 2 args (PrismaService + RazorpayService)
- `backend/src/orders/dto/create-razorpay-order.dto.ts` - ConfirmRazorpayPaymentDto with signature fields
- `backend/src/orders/orders.service.ts` - Added createRazorpayOrder and confirmRazorpayPayment methods
- `backend/src/orders/orders.controller.ts` - Added POST :id/razorpay-order and POST :id/razorpay-confirm with staff auth
- `backend/src/orders/orders.module.ts` - Added RazorpayModule import
- `backend/src/orders/orders-razorpay.spec.ts` - 9 unit tests for POS Razorpay flows
- `backend/src/orders/orders.service.spec.ts` - Added EventEmitter2 and RazorpayService mocks for DI resolution

## Decisions Made
- Used `Number(payment.amount)` cast when passing Razorpay fetchPayment result to createRefund, because the Razorpay SDK types `amount` as `string | number` while createRefund expects `number`
- Added EventEmitter2 and RazorpayService mock providers to orders.service.spec.ts to fix NestJS DI resolution after constructor signature change (Rule 3 - blocking fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cast payment.amount to Number for createRefund**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Razorpay SDK fetchPayment returns `amount` as `string | number`, but createRefund expects `number`
- **Fix:** Wrapped with `Number(payment.amount)`
- **Files modified:** backend/src/events/events.service.ts
- **Verification:** `npx tsc --noEmit` passes for events files
- **Committed in:** 8410a3a (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed orders.service.spec.ts DI resolution**
- **Found during:** Task 2 (full test suite verification)
- **Issue:** OrdersService constructor changed from 2 to 3 params (added RazorpayService), breaking existing test module compilation
- **Fix:** Added EventEmitter2 and RazorpayService mock providers to test module
- **Files modified:** backend/src/orders/orders.service.spec.ts
- **Verification:** Test module compiles; 14 pre-existing tests restored to passing
- **Committed in:** b7e3224 (Task 2 commit)

**3. [Rule 3 - Blocking] Fixed events.service.spec.ts constructor**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** EventsService constructor changed from 1 to 2 params (added RazorpayService), breaking existing spec
- **Fix:** Added `{} as any` second arg to constructor call
- **Files modified:** backend/src/events/events.service.spec.ts
- **Verification:** TypeScript compilation passes for events spec
- **Committed in:** 8410a3a (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All fixes necessary for compilation and test infrastructure. No scope creep.

## Issues Encountered
- Pre-existing test failures in kpis, missions, quests specs (unrelated to this plan) -- out of scope
- Pre-existing test failures in orders.service.spec.ts for createOrder/updateOrderStatus/deductItemIngredients (missing $transaction mock) -- pre-existing, not caused by this plan

## User Setup Required

None -- Razorpay env vars are handled by Plan 02's graceful fallback pattern.

## Known Stubs

None -- all endpoints are fully wired to RazorpayService with real business logic.

## Next Phase Readiness
- Event booking checkout and confirm endpoints ready for frontend integration (Phase 24)
- POS Razorpay endpoints ready for POS frontend integration (Plan 04)
- Webhook handlers (Plan 02) will find pending bookings/payments by razorpay_order_id
- Auto-refund path tested and ready for production

## Self-Check: PASSED

- All 5 created files verified present on disk
- Both task commits (8410a3a, b7e3224) verified in git log
- 19/19 tests passing across 2 test suites
- TypeScript compilation clean (0 errors in plan-related files; 5 pre-existing in unrelated specs)
- No stubs or placeholder content detected

---
*Phase: 23-razorpay-payments-customer-auth*
*Completed: 2026-03-25*
