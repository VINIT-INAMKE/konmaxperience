---
phase: 23-razorpay-payments-customer-auth
plan: 04
subsystem: ui
tags: [razorpay, otp, customer-auth, react, checkout, payments]

requires:
  - phase: 23-razorpay-payments-customer-auth (plans 01-03)
    provides: Customer auth backend, Razorpay payment service, event checkout + POS endpoints
provides:
  - useRazorpay hook for dynamic checkout.js loading and payment state machine
  - useCustomerAuth hook for customer session management
  - CustomerOtpForm three-phase OTP login flow
  - EventCheckoutForm auth-aware booking with Razorpay modal
  - POS PaymentForm Razorpay method option
  - Customer profile page at /profile
  - Razorpay TypeScript declarations
affects: [24-customer-marketplace]

tech-stack:
  added: [razorpay-checkout.js (CDN)]
  patterns: [dynamic-script-loading, payment-state-machine, otp-digit-input, auth-aware-checkout]

key-files:
  created:
    - frontend/types/razorpay.d.ts
    - frontend/lib/types/customer-auth.ts
    - frontend/hooks/use-razorpay.ts
    - frontend/hooks/use-customer-auth.ts
    - frontend/components/public/OtpDigitInput.tsx
    - frontend/components/public/CustomerOtpForm.tsx
    - frontend/components/public/PhoneLoginPrompt.tsx
    - frontend/components/public/CustomerIdentityStrip.tsx
    - frontend/components/public/PaymentStatusPanel.tsx
    - frontend/components/public/EventCheckoutForm.tsx
    - frontend/app/(public)/profile/page.tsx
  modified:
    - frontend/lib/types/kds.ts
    - frontend/lib/types/orders.ts
    - frontend/components/ops/pos/PaymentForm.tsx
    - frontend/app/(public)/events/[id]/page.tsx
    - frontend/app/(public)/layout.tsx

key-decisions:
  - "optionsRef pattern in useRazorpay to avoid stale closure in Razorpay callbacks"
  - "Auto-verify OTP when 6 digits entered for faster UX"
  - "Cookie-based session detection in layout for login/profile link (document.cookie check)"

patterns-established:
  - "useRazorpay: dynamic checkout.js CDN load + state machine (idle -> loading-script -> razorpay-open -> confirming -> success/failed/dismissed)"
  - "CustomerOtpForm: three-phase auth flow (phone -> otp -> name) with countdown timer and rate limit handling"
  - "Public components use --public-* CSS var tokens, ops components use standard --primary tokens"

requirements-completed: [PAY-19, PAY-20, PAY-21, PAY-22, PAY-23, PAY-24]

duration: 7min
completed: 2026-03-25
---

# Phase 23 Plan 04: Frontend Customer Auth + Razorpay Checkout Summary

**Customer OTP login flow, auth-aware event checkout with Razorpay modal, POS Razorpay integration, and customer profile page using --public-* design tokens**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-25T20:29:59Z
- **Completed:** 2026-03-25T20:37:00Z
- **Tasks:** 3 of 3 (all complete, checkpoint approved)
- **Files modified:** 16

## Accomplishments
- useRazorpay hook dynamically loads checkout.js and manages full payment state machine with success/dismiss/failure handling
- CustomerOtpForm implements three-phase OTP flow (phone -> code -> name capture) with auto-advance, resend countdown, and rate limit handling
- EventCheckoutForm replaces EventBookingForm on event detail page with auth-aware checkout supporting both free and paid events
- POS PaymentForm extended with Razorpay method that opens modal and confirms payment via backend
- Customer profile page at /profile with verified phone badge, inline name editing, and logout

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, hooks, OTP components** - `050b411` (feat)
2. **Task 2: EventCheckoutForm, POS PaymentForm, profile page, layout** - `dfa8ab0` (feat)

**Task 3:** Human verification checkpoint -- APPROVED

## Files Created/Modified
- `frontend/types/razorpay.d.ts` - TypeScript declarations for Razorpay checkout.js Window integration
- `frontend/lib/types/customer-auth.ts` - Customer, CheckoutResponse, ConfirmBookingPayload types
- `frontend/lib/types/kds.ts` - PaymentMethod union extended with 'razorpay'
- `frontend/lib/types/orders.ts` - PAYMENT_METHOD_LABELS updated with razorpay entry
- `frontend/hooks/use-razorpay.ts` - Dynamic checkout.js loader + payment state machine hook
- `frontend/hooks/use-customer-auth.ts` - Customer session management (profile, sendOtp, verifyOtp, updateProfile, logout)
- `frontend/components/public/OtpDigitInput.tsx` - 6-cell digit input with auto-advance, paste handling, WCAG labels
- `frontend/components/public/CustomerOtpForm.tsx` - Three-phase OTP flow with countdown timer and error states
- `frontend/components/public/PhoneLoginPrompt.tsx` - Card prompt with WhatsApp login CTA
- `frontend/components/public/CustomerIdentityStrip.tsx` - Verified phone badge strip with logout link
- `frontend/components/public/PaymentStatusPanel.tsx` - Success/failed/refunded state panels
- `frontend/components/public/EventCheckoutForm.tsx` - Auth-aware event booking form with Razorpay integration
- `frontend/app/(public)/profile/page.tsx` - Customer profile with avatar, inline name edit, logout
- `frontend/app/(public)/events/[id]/page.tsx` - Replaced EventBookingForm with EventCheckoutForm
- `frontend/app/(public)/layout.tsx` - Added login/profile link in header
- `frontend/components/ops/pos/PaymentForm.tsx` - Added Razorpay method with modal + confirm flow

## Decisions Made
- Used optionsRef pattern in useRazorpay to avoid stale closure when Razorpay callbacks fire (callbacks capture ref, not state)
- Auto-verify OTP when all 6 digits entered (no need to click Verify Code button) for faster UX
- Cookie-based session detection in public layout for login/profile link display (document.cookie.includes check for instant render)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no new external service configuration required (Razorpay env vars already set up in Plans 01-03).

## Known Stubs

None - all components are wired to real backend APIs from Plans 01-03.

## Next Phase Readiness
- All customer auth + payment frontend components complete
- Human verification checkpoint approved -- end-to-end flows confirmed
- Phase 24 (Customer Marketplace) can build on useRazorpay and useCustomerAuth hooks

## Self-Check: PASSED

- All 11 created files verified present on disk
- Commit 050b411 (Task 1) verified in git log
- Commit dfa8ab0 (Task 2) verified in git log
- TypeScript compilation: zero errors

---
*Phase: 23-razorpay-payments-customer-auth*
*Completed: 2026-03-25 (human verification approved 2026-03-26)*
