---
phase: 10-pos-orders
plan: 02
subsystem: api
tags: [nestjs, prisma, kds, deduction, inventory, stock-movement, transaction, typescript]

# Dependency graph
requires:
  - phase: 10-pos-orders
    plan: 01
    provides: "OrdersModule with OrdersService, Order/OrderItem Prisma models"
  - phase: 09-kitchen-production
    provides: "KdsService.updateItemStatus, PrepBatch FIFO deduction pattern, KitchenModule"
  - phase: 08-inventory-procurement
    provides: "IngredientStock model, StockMovement model, convertUnit utility"
provides:
  - "OrdersService.deductItemIngredients method for atomic stock deduction on order item ready"
  - "KdsService.updateItemStatus extended with $transaction wrapping deduction on ready"
  - "KitchenModule imports OrdersModule for cross-module DI"
  - "12 unit tests covering deduction and KDS transaction flows"
affects: [10-03-pos-new-order, 10-04-pos-order-history, 10-05-pos-delivery]

# Tech tracking
tech-stack:
  added: []
  patterns: [transactional-deduction-on-ready, cross-module-di-via-imports, fifo-batch-depletion]

key-files:
  created:
    - backend/src/kitchen/kds/kds.service.spec.ts
  modified:
    - backend/src/orders/orders.service.ts
    - backend/src/orders/orders.service.spec.ts
    - backend/src/kitchen/kds/kds.service.ts
    - backend/src/kitchen/kitchen.module.ts

key-decisions:
  - "Deduction called BEFORE item status update in $transaction so rollback prevents status advance on failure"
  - "allReady check uses ternary (i.id === itemId ? true : i.status === ready) to handle current item not yet persisted"
  - "convertUnit receives tx (transaction client) not this.prisma per Research Pitfall 2 and Phase 8 decision"
  - "Non-ready transitions (pending->preparing) remain outside $transaction for performance"

patterns-established:
  - "Cross-module DI: KitchenModule imports OrdersModule to give KdsService access to OrdersService"
  - "Transactional deduction-on-ready: deduct -> update item -> check all-ready -> update order, all atomic"
  - "FIFO batch depletion with auto-depleted status transition when quantity_remaining reaches 0"

requirements-completed: [POS-04]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 10 Plan 02: Deduction Wiring Summary

**Atomic stock deduction on KDS mark-ready via $transaction: IngredientStock decremented, PrepBatch FIFO depleted, StockMovements created, order auto-transitions to ready when all items complete**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T16:58:50Z
- **Completed:** 2026-03-21T17:07:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- deductItemIngredients method in OrdersService handles both ingredient-type (IngredientStock decrement + StockMovement with order_deducted) and recipe-type (FIFO PrepBatch decrement with depleted status) RecipeLines, multiplied by orderItem.quantity
- KdsService.updateItemStatus wraps ready-path in $transaction: deducts first, updates item, checks all-ready, auto-transitions order
- Transaction rollback prevents status advance when stock is insufficient
- Non-ready transitions (pending->preparing) remain fast (no transaction overhead)
- 29 total tests pass across both service specs (24 orders + 5 KDS)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for deductItemIngredients** - `bfcc3e5` (test)
2. **Task 1 GREEN: deductItemIngredients in OrdersService** - `9f6dcbf` (feat)
3. **Task 2 RED: Failing tests for KDS deduction-on-ready** - `c603729` (test)
4. **Task 2 GREEN: KDS transactional deduction on ready** - `e6031c6` (feat)

**Plan metadata:** pending (docs: complete plan)

_Note: Both tasks followed TDD with RED and GREEN commits._

## Files Created/Modified
- `backend/src/orders/orders.service.ts` - Added deductItemIngredients method with ingredient-type and recipe-type deduction logic
- `backend/src/orders/orders.service.spec.ts` - Added 7 deduction tests (ingredient, FIFO, depleted, StockMovement, insufficient stock, multi-quantity)
- `backend/src/kitchen/kds/kds.service.ts` - Extended updateItemStatus with $transaction on ready, injected OrdersService
- `backend/src/kitchen/kitchen.module.ts` - Added OrdersModule to imports for cross-module DI
- `backend/src/kitchen/kds/kds.service.spec.ts` - Created 5 KDS deduction tests (non-ready, transaction, all-ready, rollback, partial-ready)

## Decisions Made
- **Deduction before item update in transaction:** Ensures rollback prevents status advance on deduction failure (Research Pitfall 1)
- **allReady ternary check:** Uses `i.id === itemId ? true : i.status === 'ready'` because the current item is being updated in the same transaction and findMany may return stale data
- **convertUnit receives tx:** Consistent with Phase 8 decision and Research Pitfall 2 -- all convertUnit calls inside $transaction pass the transaction client
- **Non-ready transitions skip transaction:** No performance overhead for pending->preparing which is the most frequent KDS action

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all deduction logic is fully wired with no placeholder data.

## Next Phase Readiness
- Deduction flow complete: orders placed via POS will have stock deducted when items are marked ready on KDS
- Frontend POS pages (Plans 03-05) can proceed independently since they use the already-created orders API
- End-to-end flow: create order (Plan 01) -> KDS displays -> cook marks ready -> stock deducted (this plan)

## Self-Check: PASSED

- All 5 files exist on disk
- All 4 commit hashes (bfcc3e5, 9f6dcbf, c603729, e6031c6) found in git log
- 29 unit tests passing (24 orders + 5 KDS)
- TypeScript compiles with no errors

---
*Phase: 10-pos-orders*
*Completed: 2026-03-21*
