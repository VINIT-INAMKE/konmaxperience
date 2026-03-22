---
phase: 13-customer-experience
plan: 01
subsystem: api
tags: [nestjs, prisma, qrcode, feedback, events, booking, public-api]

# Dependency graph
requires:
  - phase: 10-pos-orders
    provides: Order model, OrdersController, OrdersService
  - phase: 06-operations-management
    provides: Zone model, Brand model, MenuController, BrandsController
provides:
  - Feedback, Event, EventBooking Prisma models
  - FeedbackModule with public POST and auth-protected GET + stats
  - EventsModule with public GET/bookings and auth-protected CRUD with $transaction capacity enforcement
  - QR code generation endpoint on OrdersController
  - @Public() on 3 menu GET endpoints and brands GET endpoint
  - Frontend TypeScript types for feedback and events
affects: [13-customer-experience, frontend-public-pages, ops-dashboards]

# Tech tracking
tech-stack:
  added: [qrcode, "@types/qrcode"]
  patterns: [$transaction-capacity-enforcement, public-decorator-on-read-endpoints]

key-files:
  created:
    - backend/src/feedback/feedback.module.ts
    - backend/src/feedback/feedback.controller.ts
    - backend/src/feedback/feedback.service.ts
    - backend/src/feedback/dto/create-feedback.dto.ts
    - backend/src/feedback/dto/feedback-filters.dto.ts
    - backend/src/events/events.module.ts
    - backend/src/events/events.controller.ts
    - backend/src/events/events.service.ts
    - backend/src/events/dto/create-event.dto.ts
    - backend/src/events/dto/update-event.dto.ts
    - backend/src/events/dto/create-booking.dto.ts
    - backend/src/feedback/feedback.service.spec.ts
    - backend/src/events/events.service.spec.ts
    - frontend/lib/types/feedback.ts
    - frontend/lib/types/events.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/app.module.ts
    - backend/src/orders/orders.controller.ts
    - backend/src/orders/orders.service.ts
    - backend/src/menu/menu.controller.ts
    - backend/src/brands/brands.controller.ts

key-decisions:
  - "UpdateEventDto defined manually (no @nestjs/mapped-types) since package not installed in project"
  - "@Public() on brands GET and 3 menu GET endpoints for public digital menu access"
  - "QR code encodes frontend URL /feedback/:orderId with 256px width"

patterns-established:
  - "$transaction capacity enforcement: aggregate sum inside transaction, compare, reject if exceeded"
  - "Public POST for anonymous submission (feedback), auth-protected GET for admin views"

requirements-completed: [CUST-01, CUST-02, CUST-03]

# Metrics
duration: 11min
completed: 2026-03-22
---

# Phase 13 Plan 01: Customer Experience Backend Summary

**Feedback/Events NestJS modules with Prisma models, QR code generation, $transaction capacity enforcement, and @Public() on menu/brands read endpoints**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-22T09:24:27Z
- **Completed:** 2026-03-22T09:35:56Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- 3 new Prisma models (Feedback, Event, EventBooking) with proper relations to Order, Zone, Brand
- FeedbackModule: @Public() POST for anonymous submission, auth-protected GET + stats with rating/date filters
- EventsModule: @Public() GET for upcoming events + booking submission, auth-protected CRUD, atomic $transaction capacity enforcement
- QR code endpoint (GET /orders/:id/qr) generating Data URL with feedback link
- @Public() on 3 menu read endpoints (categories, items, availability) and brands GET for public digital menu
- 17 unit tests covering capacity enforcement (success, rejection, exact fill, past/cancelled events, null aggregate), feedback operations (submit, findAll, getStats)
- Frontend TypeScript types for Feedback, Events, and Bookings

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + NestJS Feedback/Events modules + QR endpoint + @Public()** - `296b651` (feat)
2. **Task 2: Frontend types + unit tests for capacity enforcement** - `790205d` (feat)

## Files Created/Modified
- `backend/prisma/schema.prisma` - Added Feedback, Event, EventBooking models + relations
- `backend/src/feedback/feedback.module.ts` - FeedbackModule declaration
- `backend/src/feedback/feedback.controller.ts` - @Public() POST + auth-protected GET/stats
- `backend/src/feedback/feedback.service.ts` - submit, findAll, getStats methods
- `backend/src/feedback/dto/create-feedback.dto.ts` - Validation: rating 1-5, optional order_id/comment/name/phone
- `backend/src/feedback/dto/feedback-filters.dto.ts` - Filter by rating, date_from, date_to
- `backend/src/events/events.module.ts` - EventsModule declaration
- `backend/src/events/events.controller.ts` - Public GET/bookings + auth-protected CRUD with route ordering
- `backend/src/events/events.service.ts` - CRUD + $transaction capacity enforcement + upcoming filter
- `backend/src/events/dto/create-event.dto.ts` - Validation: title, event_type, date, capacity, price
- `backend/src/events/dto/update-event.dto.ts` - All fields optional + status
- `backend/src/events/dto/create-booking.dto.ts` - Validation: customer_name, customer_phone, guests
- `backend/src/orders/orders.controller.ts` - Added GET :id/qr route between daily-summary and :id
- `backend/src/orders/orders.service.ts` - Added generateQr with qrcode library
- `backend/src/menu/menu.controller.ts` - @Public() on categories, items, availability
- `backend/src/brands/brands.controller.ts` - @Public() on GET findAll
- `backend/src/app.module.ts` - Registered FeedbackModule and EventsModule
- `backend/src/feedback/feedback.service.spec.ts` - 7 tests for feedback operations
- `backend/src/events/events.service.spec.ts` - 10 tests for capacity and events
- `frontend/lib/types/feedback.ts` - Feedback, CreateFeedbackPayload, FeedbackStats
- `frontend/lib/types/events.ts` - Event, EventBooking, CreateBookingPayload, labels

## Decisions Made
- Used manual UpdateEventDto definition instead of PartialType from @nestjs/mapped-types since that package is not installed in the project (would need a new dependency just for one DTO)
- @Public() decorator applied to brands GET findAll and 3 menu GET endpoints to enable unauthenticated access for the public digital menu page
- QR code generates a frontend URL encoding /feedback/:orderId at 256px width with standard black/white colors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced @nestjs/mapped-types PartialType with manual DTO**
- **Found during:** Task 1 (UpdateEventDto compilation)
- **Issue:** @nestjs/mapped-types not installed, causing TS2307 import error and cascading property errors
- **Fix:** Rewrote UpdateEventDto with all optional fields manually defined instead of extending PartialType(CreateEventDto)
- **Files modified:** backend/src/events/dto/update-event.dto.ts
- **Verification:** npx tsc --noEmit passes with zero errors
- **Committed in:** 296b651 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for compilation. Same functionality, just explicit field definitions. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## Known Stubs
None - all endpoints are fully wired to Prisma queries with real data operations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All API endpoints ready for Plan 02 (public-facing pages: digital menu, feedback form, event listing)
- All API endpoints ready for Plan 03 (ops dashboard pages: feedback management, event management)
- Frontend types exported and ready for component consumption

## Self-Check: PASSED

- All 15 created files verified present on disk
- Commit 296b651 (Task 1) verified in git log
- Commit 790205d (Task 2) verified in git log

---
*Phase: 13-customer-experience*
*Completed: 2026-03-22*
