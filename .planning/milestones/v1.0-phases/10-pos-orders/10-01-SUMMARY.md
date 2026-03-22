---
phase: 10-pos-orders
plan: 01
subsystem: api
tags: [nestjs, prisma, orders, pos, payments, delivery, typescript]

# Dependency graph
requires:
  - phase: 09-kitchen-production
    provides: "Order/OrderItem/Payment Prisma models, KDS endpoints, menu availability per-item"
  - phase: 07-recipe-ingredient-management
    provides: "ChannelModifier model, MenuService, MenuModule"
provides:
  - "OrdersModule with 7 REST endpoints (create, list, get, status, payment, delivery, daily-summary)"
  - "MANAGE_POS permission for POS access control"
  - "Batch menu availability endpoint GET /menu/availability"
  - "Frontend types for Order, Payment, CreateOrderPayload, DailySummary, AvailabilityMap"
affects: [10-02-deduction-wiring, 10-03-pos-new-order, 10-04-pos-order-history, 10-05-pos-delivery]

# Tech tracking
tech-stack:
  added: []
  patterns: [channel-modifier-in-transaction, delivery-status-progression-validation, batch-availability-refactor]

key-files:
  created:
    - backend/src/orders/orders.module.ts
    - backend/src/orders/orders.controller.ts
    - backend/src/orders/orders.service.ts
    - backend/src/orders/dto/create-order.dto.ts
    - backend/src/orders/dto/record-payment.dto.ts
    - backend/src/orders/dto/update-delivery.dto.ts
    - backend/src/orders/dto/order-filters.dto.ts
    - backend/src/orders/orders.service.spec.ts
    - frontend/lib/types/orders.ts
  modified:
    - backend/src/types/permissions.ts
    - backend/src/app.module.ts
    - backend/src/menu/menu.service.ts
    - backend/src/menu/menu.controller.ts

key-decisions:
  - "MANAGE_POS as dedicated permission (not reusing MANAGE_KITCHEN) per Research open question 2"
  - "Refactored getServingsAvailable into shared computeServings helper for single-item and batch reuse"
  - "daily-summary route placed before :id in controller to prevent NestJS route shadowing"
  - "Delivery status progression: null->picked_up->in_transit->delivered with strict one-step validation"

patterns-established:
  - "Channel modifier computation in $transaction: lookup modifier, compute fixed/percentage, apply to total"
  - "Delivery status progression validation via ordered array indexOf comparison"
  - "Batch availability via shared private helper (computeServings) called in loop"

requirements-completed: [POS-02, POS-03, POS-05, POS-06]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 10 Plan 01: Orders API + Batch Availability Summary

**OrdersModule with 7 REST endpoints for order CRUD, channel modifier computation in $transaction, payment recording with 409 dedup, delivery status progression, daily revenue summary, and batch menu availability**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T16:46:15Z
- **Completed:** 2026-03-21T16:54:27Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Full OrdersModule with createOrder, getOrders, getOrderById, updateOrderStatus, recordPayment, updateDelivery, getDailySummary
- Channel modifier computation (fixed/percentage) inside $transaction with graceful null-check
- Batch GET /menu/availability endpoint replacing N per-item polling calls with single query
- Frontend order type system with Order, Payment, CreateOrderPayload, DailySummary, AvailabilityMap, and label constants
- MANAGE_POS permission added with display name and description
- 17 unit tests passing covering all service methods

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for OrdersService** - `ec36aaf` (test)
2. **Task 1 GREEN: OrdersModule with full CRUD, payment, delivery, daily summary** - `91e8bda` (feat)
3. **Task 2: Batch menu availability + frontend order types** - `8e0b4cc` (feat)

**Plan metadata:** pending (docs: complete plan)

_Note: TDD Task 1 had RED and GREEN commits._

## Files Created/Modified
- `backend/src/orders/orders.module.ts` - NestJS module with controller, service, exports
- `backend/src/orders/orders.controller.ts` - 7 REST endpoints gated by MANAGE_POS
- `backend/src/orders/orders.service.ts` - Order business logic with $transaction, filters, status validation
- `backend/src/orders/dto/create-order.dto.ts` - CreateOrderDto with nested CreateOrderItemDto
- `backend/src/orders/dto/record-payment.dto.ts` - RecordPaymentDto with method/amount validation
- `backend/src/orders/dto/update-delivery.dto.ts` - UpdateDeliveryDto with status enum validation
- `backend/src/orders/dto/order-filters.dto.ts` - OrderFiltersDto for list endpoint query params
- `backend/src/orders/orders.service.spec.ts` - 17 unit tests for all service methods
- `frontend/lib/types/orders.ts` - Order, Payment, CreateOrderPayload, DailySummary, AvailabilityMap types + label constants
- `backend/src/types/permissions.ts` - Added MANAGE_POS to enum, display names, descriptions
- `backend/src/app.module.ts` - Imported OrdersModule after KitchenModule
- `backend/src/menu/menu.service.ts` - Refactored to shared computeServings helper, added getAllServingsAvailable
- `backend/src/menu/menu.controller.ts` - Added GET /menu/availability batch route before parameterized route

## Decisions Made
- **MANAGE_POS as dedicated permission:** Separate from MANAGE_KITCHEN for clear POS access control boundary
- **Shared computeServings helper:** Extracted from getServingsAvailable so both single-item and batch endpoints reuse the same logic, avoiding drift
- **daily-summary before :id route:** Prevents NestJS route shadowing (same pattern as Phase 7 VendorsController)
- **Strict delivery status progression:** null->picked_up->in_transit->delivered enforced via ordered array indexOf comparison

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all endpoints are fully wired to Prisma queries with no placeholder data.

## Next Phase Readiness
- OrdersModule ready for Plan 02 (stock deduction wiring on order creation)
- Frontend types ready for Plan 03-05 (POS new order, order history, delivery pages)
- Batch availability endpoint ready for POS new order page menu display

## Self-Check: PASSED

- All 9 created files exist on disk
- All 3 commit hashes (ec36aaf, 91e8bda, 8e0b4cc) found in git log
- 17 unit tests passing
- TypeScript compiles with no errors

---
*Phase: 10-pos-orders*
*Completed: 2026-03-21*
