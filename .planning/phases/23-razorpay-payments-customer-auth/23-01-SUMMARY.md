---
phase: 23-razorpay-payments-customer-auth
plan: 01
subsystem: auth
tags: [jwt, otp, whatsapp, redis, prisma, bcrypt, nestjs, guards]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: JWT auth strategy, Passport, JwtAuthGuard, @Public() decorator
  - phase: 21-in-app-chat
    provides: Pusher graceful fallback pattern (reused for WhatsApp/Redis services)
provides:
  - Customer Prisma model with phone-based identity
  - JwtPayload type discriminator (staff vs customer)
  - CustomerGuard and StaffGuard for token type enforcement
  - CustomerAuthService with OTP send/verify, auto-link, JWT cookie issuance
  - WhatsAppService with dev console fallback
  - RedisService for OTP hash storage
  - EventBooking/Payment/Order/Feedback schema extensions for customer_id and Razorpay fields
affects: [23-02, 23-03, 23-04, 24-customer-marketplace]

# Tech tracking
tech-stack:
  added: [ioredis (reuse), bcrypt (reuse), whatsapp-cloud-api (fetch-based)]
  patterns: [dual-token-jwt, type-discriminated-guards, otp-redis-hash, graceful-service-fallback]

key-files:
  created:
    - backend/src/customer-auth/customer-auth.service.ts
    - backend/src/customer-auth/customer-auth.controller.ts
    - backend/src/customer-auth/customer-auth.module.ts
    - backend/src/customer-auth/whatsapp.service.ts
    - backend/src/customer-auth/redis.service.ts
    - backend/src/customer-auth/guards/customer.guard.ts
    - backend/src/customer-auth/guards/staff.guard.ts
    - backend/src/customer-auth/dto/send-otp.dto.ts
    - backend/src/customer-auth/dto/verify-otp.dto.ts
    - backend/src/customer-auth/dto/update-customer.dto.ts
    - backend/src/customer-auth/customer-auth.service.spec.ts
    - backend/src/customer-auth/customer-auth-task1.spec.ts
    - backend/prisma/migrations/20260325193409_add_customer_model_payment_extensions/migration.sql
  modified:
    - backend/prisma/schema.prisma
    - backend/src/types/auth.ts
    - backend/src/auth/jwt.strategy.ts
    - backend/src/auth/auth.service.ts
    - backend/src/app.module.ts
    - backend/.env.example

key-decisions:
  - "HttpException with HttpStatus.TOO_MANY_REQUESTS instead of non-existent TooManyRequestsException"
  - "express default import pattern (import express from 'express') matching existing auth.controller.ts to avoid isolatedModules TS error"
  - "Prisma migrate deploy with manual migration SQL (non-interactive CI-compatible) instead of migrate dev"

patterns-established:
  - "Dual-token JWT: type discriminator in payload, separate cookie names (access_token vs customer_access_token)"
  - "Type-aware guards: CustomerGuard/StaffGuard check user.type in handleRequest"
  - "OTP Redis hash pattern: bcrypt hash stored at otp:{phone} with 300s TTL, rate limit at otp_rate:{phone} with 3600s TTL"
  - "Auto-link on first login: upsert customer then updateMany matching phone records"

requirements-completed: [PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06]

# Metrics
duration: 21min
completed: 2026-03-25
---

# Phase 23 Plan 01: Customer Auth + Schema Summary

**Customer model with phone-based OTP auth via WhatsApp, dual JWT strategy (staff/customer), type-aware guards, Redis OTP storage with rate limiting, and auto-link of existing records on first login**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-25T19:29:43Z
- **Completed:** 2026-03-25T19:50:43Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Customer Prisma model with phone unique index, migrated and deployed
- Extended EventBooking, Payment, Order, Feedback models with customer_id FK and Razorpay payment fields
- JwtPayload extended with `type: 'staff' | 'customer'` discriminator; JWT strategy extracts customer_access_token cookie
- CustomerAuthService with OTP generation, bcrypt hashing, Redis storage (5-min TTL), rate limiting (3/hour), auto-link on first login
- WhatsAppService with Meta Cloud API integration and dev console fallback
- StaffGuard and CustomerGuard enforce token type separation
- 19 unit tests passing across 2 test suites

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + migration + Customer auth types + Redis service** - `74a5b36` (feat)
2. **Task 2: CustomerAuthService + WhatsAppService + Controller + Module wiring + unit tests** - `07a5758` (feat)

_Both tasks followed TDD flow: RED (failing tests) -> GREEN (implementation) -> verify_

## Files Created/Modified
- `backend/prisma/schema.prisma` - Added Customer model, extended EventBooking/Payment/Order/Feedback with customer_id and Razorpay fields
- `backend/prisma/migrations/20260325193409_add_customer_model_payment_extensions/migration.sql` - Database migration
- `backend/src/types/auth.ts` - Extended JwtPayload with type discriminator and customerId
- `backend/src/auth/jwt.strategy.ts` - Added customer_access_token cookie extraction, type-aware validate()
- `backend/src/auth/auth.service.ts` - Added type: 'staff' to login/refresh JWT payloads
- `backend/src/customer-auth/customer-auth.service.ts` - OTP send/verify, auto-link, JWT issuance, profile CRUD
- `backend/src/customer-auth/customer-auth.controller.ts` - REST endpoints with @Public(), @Throttle(), @UseGuards(CustomerGuard)
- `backend/src/customer-auth/customer-auth.module.ts` - Module with JwtModule.registerAsync
- `backend/src/customer-auth/whatsapp.service.ts` - WhatsApp Cloud API with dev fallback
- `backend/src/customer-auth/redis.service.ts` - Redis client with graceful null fallback
- `backend/src/customer-auth/guards/customer.guard.ts` - Rejects non-customer tokens
- `backend/src/customer-auth/guards/staff.guard.ts` - Rejects non-staff tokens
- `backend/src/customer-auth/dto/send-otp.dto.ts` - Indian phone number validation
- `backend/src/customer-auth/dto/verify-otp.dto.ts` - Phone + 6-digit OTP validation
- `backend/src/customer-auth/dto/update-customer.dto.ts` - Optional name/email update
- `backend/src/customer-auth/customer-auth.service.spec.ts` - 9 unit tests for service
- `backend/src/customer-auth/customer-auth-task1.spec.ts` - 10 unit tests for types/guards
- `backend/src/app.module.ts` - Registered CustomerAuthModule
- `backend/.env.example` - Added WhatsApp and Razorpay env vars

## Decisions Made
- Used `HttpException` with `HttpStatus.TOO_MANY_REQUESTS` (429) since NestJS does not export a `TooManyRequestsException` class
- Used `import express from 'express'` default import pattern (matching existing auth.controller.ts) to avoid `isolatedModules` TS errors with decorated parameters
- Created manual migration SQL + `prisma migrate deploy` for non-interactive environments instead of `prisma migrate dev`
- Added `type: 'staff'` to existing auth.service.ts as part of Task 1 (moved from Task 2 scope) since JwtPayload `type` became required and caused TS compilation errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added type: 'staff' to auth.service.ts in Task 1**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** JwtPayload.type became required, but auth.service.ts login/refresh did not include it, causing TS2741 errors
- **Fix:** Added `type: 'staff'` to both payload objects in auth.service.ts
- **Files modified:** backend/src/auth/auth.service.ts
- **Verification:** `npx tsc --noEmit` passes for non-spec files
- **Committed in:** 74a5b36 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed NestJS TooManyRequestsException not existing**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Plan specified `TooManyRequestsException` but NestJS does not export this class
- **Fix:** Used `HttpException` with `HttpStatus.TOO_MANY_REQUESTS` (429 status code)
- **Files modified:** backend/src/customer-auth/customer-auth.service.ts
- **Verification:** TypeScript compilation passes, test verifies 429 status code
- **Committed in:** 07a5758 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed express type imports for isolatedModules compatibility**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `import { Request, Response } from 'express'` caused TS1272 errors when types used in decorated parameters with `isolatedModules`
- **Fix:** Switched to `import express from 'express'` and `express.Request`/`express.Response` (matching existing auth.controller.ts pattern)
- **Files modified:** backend/src/customer-auth/customer-auth.controller.ts, backend/src/customer-auth/customer-auth.service.ts
- **Verification:** `npx tsc --noEmit` passes for all non-spec files
- **Committed in:** 07a5758 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for compilation and correctness. No scope creep.

## Issues Encountered
- Jest 30 replaced `--testPathPattern` with `--testPathPatterns` (plural) -- adjusted all test commands
- Jest 30 dynamic imports (`await import()`) fail without `--experimental-vm-modules` -- converted to static imports in test files
- `prisma migrate dev` requires interactive terminal -- used manual migration SQL + `prisma migrate deploy`

## User Setup Required

None for development -- WhatsApp OTP falls back to console.log and Redis gracefully degrades. For production:
- Set WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_BUSINESS_ACCOUNT_ID for real OTP delivery
- UPSTASH_REDIS_URL already configured for notifications
- Razorpay env vars (RAZORPAY_KEY_ID, etc.) needed by Plan 03

## Next Phase Readiness
- Customer model and auth flow complete -- Plan 02 (RazorpayModule) and Plan 03 (Event Booking Payment) can proceed
- StaffGuard/CustomerGuard ready for Plan 04 (POS Razorpay)
- Payment.order_id @unique constraint preserved for Plan 03 upsert pattern

## Self-Check: PASSED

- All 13 created files verified present on disk
- Both task commits (74a5b36, 07a5758) verified in git log
- 19/19 tests passing across 2 test suites
- TypeScript compilation clean (0 errors in non-spec files)
- Prisma migration status: up to date

---
*Phase: 23-razorpay-payments-customer-auth*
*Completed: 2026-03-25*
