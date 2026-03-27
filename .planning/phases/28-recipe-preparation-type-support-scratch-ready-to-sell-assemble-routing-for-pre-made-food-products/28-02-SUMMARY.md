---
phase: 28-recipe-preparation-type-support-scratch-ready-to-sell-assemble-routing-for-pre-made-food-products
plan: 02
subsystem: api
tags: [nestjs, prisma, orders, kds, availability, preparation-type, fifo]

# Dependency graph
requires:
  - phase: 28-recipe-preparation-type-support-scratch-ready-to-sell-assemble-routing-for-pre-made-food-products
    plan: 01
    provides: Recipe.preparation_type field with default 'scratch'
provides:
  - Forked computeServings with preparation_type branching (batch_prepared, assemble, scratch, ready_to_sell)
  - Non-scratch deduction at POS order creation (deductBatchPrepared + deductItemIngredients)
  - Non-scratch deduction at marketplace order confirmation
  - KDS scratch-only item filter with zero-scratch-item order exclusion
  - Mixed-order rollup preserved for partial readiness
  - preparation_type in all menu item recipe select statements
affects: [28-03, 28-04, 28-05, 28-06, 28-07, 28-08, 28-09, 28-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [preparation-type-fork-pattern, batch-prepared-fifo-deduction, kds-scratch-only-filter]

key-files:
  created: []
  modified:
    - backend/src/menu/menu.service.ts
    - backend/src/orders/orders.service.ts
    - backend/src/customer-orders/customer-orders.service.ts
    - backend/src/customer-orders/customer-orders.module.ts
    - backend/src/kitchen/kds/kds.service.ts

key-decisions:
  - "OrdersService injected into CustomerOrdersService via OrdersModule import for deductItemIngredients reuse"
  - "batch_prepared FIFO orders by expires_at asc then created_at asc for deterministic consumption"
  - "Non-scratch items auto-set to status='ready' with ready_at timestamp at order creation time"
  - "KDS uses Prisma nested where filter on menu_item.recipe.preparation_type for server-side scratch filtering"
  - "updateItemStatus sibling count left unfiltered to correctly handle mixed-order rollup"

patterns-established:
  - "preparation_type fork pattern: check prepType at method entry, branch early for non-scratch, fall through to existing logic for scratch/ready_to_sell"
  - "deductBatchPrepared pattern: FIFO deduction against PrepBatch records keyed by recipe_id with warn-not-throw on insufficient stock"
  - "KDS scratch-only pattern: nested where filter + post-query empty-items filter removes non-scratch items and all-non-scratch orders"

requirements-completed: [R28-02, R28-03, R28-04]

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 28 Plan 02: Core Business Logic Summary

**Forked availability calculation, order deduction timing, and KDS routing by preparation_type -- batch_prepared uses FIFO PrepBatch, assemble uses min(components), non-scratch auto-completes at order creation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T12:48:04Z
- **Completed:** 2026-03-27T12:55:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- computeServings correctly forks for all 4 preparation_types: batch_prepared (PrepBatch sum), assemble (min of components), scratch/ready_to_sell (existing BOM logic)
- POS createOrder and marketplace confirmOrder deduct non-scratch items immediately and set status='ready'
- KDS getActiveOrders filters to scratch items only, excluding orders with zero scratch items
- Mixed-order rollup preserved: Order.status transitions to 'ready' only when ALL items across both flows are complete

## Task Commits

Each task was committed atomically:

1. **Task 1: Fork availability calculation in menu.service.ts computeServings + extend batch pre-fetch** - `5504819` (feat)
2. **Task 2: Non-scratch deduction at order creation + KDS scratch-only filter + mixed-order rollup verification** - `7251e2a` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `backend/src/menu/menu.service.ts` - Forked computeServings by preparation_type, extended batch pre-fetch for batch_prepared, added preparation_type to all recipe selects
- `backend/src/orders/orders.service.ts` - Added deductBatchPrepared FIFO method, non-scratch auto-ready + deduction in createOrder
- `backend/src/customer-orders/customer-orders.service.ts` - Non-scratch deduction in confirmOrder with inline FIFO for batch_prepared + OrdersService for BOM deduction
- `backend/src/customer-orders/customer-orders.module.ts` - Added OrdersModule import for deductItemIngredients access
- `backend/src/kitchen/kds/kds.service.ts` - Nested where filter for preparation_type='scratch' in getActiveOrders, zero-scratch-item order exclusion

## Decisions Made
- Injected OrdersService into CustomerOrdersService via OrdersModule import (no circular dependency) for reusing deductItemIngredients in marketplace flow
- batch_prepared FIFO orders by expires_at ascending then created_at ascending for deterministic batch consumption
- Non-scratch items auto-set to status='ready' with ready_at=new Date() at order creation -- they skip KDS entirely
- KDS uses Prisma nested where filter on menu_item.recipe.preparation_type for server-side scratch filtering (not client-side)
- updateItemStatus sibling count query left unfiltered by preparation_type to correctly handle mixed orders where non-scratch items are already 'ready'
- deductBatchPrepared warns (console.warn) rather than throws on insufficient batch stock, since order is already confirmed at that point

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data paths are wired and operational.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core business logic layer complete: availability, deduction, and KDS routing all fork correctly by preparation_type
- Pick & Pack page (Plan 03+) can now query for non-scratch order items
- Frontend can use preparation_type in menu availability responses for type-specific badges
- Mixed orders route correctly across KDS (scratch) and future Pick & Pack (non-scratch)

---
*Phase: 28-recipe-preparation-type-support-scratch-ready-to-sell-assemble-routing-for-pre-made-food-products*
*Completed: 2026-03-27*
