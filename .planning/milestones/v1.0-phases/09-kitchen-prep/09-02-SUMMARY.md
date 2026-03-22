---
phase: 09-kitchen-prep
plan: 02
subsystem: api, database
tags: [nestjs, prisma, fifo, prep-batch, kitchen, unit-conversion, tdd, jest]

# Dependency graph
requires:
  - phase: 09-kitchen-prep
    provides: "PrepBatch, WasteLog Prisma models, MANAGE_KITCHEN permission, frontend kitchen types"
  - phase: 08-inventory-procurement
    provides: "IngredientStock, StockMovement models, convertUnit utility, inventory patterns"
  - phase: 07-recipe-ingredient-management
    provides: "Recipe, RecipeLine BOM, Ingredient models, CostCalculatorService"
provides:
  - "PrepBatchesService with createPrepBatch (atomic FIFO deduction) and previewDeductions (read-only)"
  - "PrepBatchesController with POST/GET endpoints protected by MANAGE_KITCHEN"
  - "KitchenModule registering PrepBatches controller and service"
  - "Unit tests for FIFO deduction logic (7 test cases)"
affects: [09-kitchen-prep, 10-pos-orders]

# Tech tracking
tech-stack:
  added: []
  patterns: ["FIFO batch deduction via findMany orderBy created_at ASC with loop", "activeBatchWhere helper with OR filter for expires_at null/gt now", "Mock Decimal helper using valueOf() for jest tests"]

key-files:
  created:
    - "backend/src/kitchen/prep-batches/prep-batches.service.ts"
    - "backend/src/kitchen/prep-batches/prep-batches.controller.ts"
    - "backend/src/kitchen/prep-batches/prep-batches.service.spec.ts"
    - "backend/src/kitchen/prep-batches/dto/create-prep-batch.dto.ts"
    - "backend/src/kitchen/prep-batches/dto/preview-deductions.dto.ts"
    - "backend/src/kitchen/kitchen.module.ts"
  modified:
    - "backend/src/app.module.ts"

key-decisions:
  - "PrepBatch created first in $transaction to get ID for StockMovement reference_id, rolls back on deduction failure"
  - "Mock Decimal uses valueOf() pattern (not toNumber) to match Number() coercion behavior in service code"
  - "activeBatchWhere extracted as shared helper for consistent OR filter (expires_at null or gt now)"

patterns-established:
  - "FIFO deduction: findMany with orderBy created_at ASC, loop with Math.min and decrement, status=depleted when remaining<=0"
  - "deductIngredient and deductSubRecipeBatches as private methods for separation of deduction types"
  - "Mock Decimal helper dec(n) with valueOf for test mocking of Prisma Decimal fields"

requirements-completed: [KITCHEN-01]

# Metrics
duration: 7min
completed: 2026-03-21
---

# Phase 9 Plan 02: PrepBatch FIFO Deduction Backend Summary

**PrepBatch creation with atomic FIFO deduction of raw ingredients and sub-recipe batches, read-only deduction preview, and 7 jest unit tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T13:44:57Z
- **Completed:** 2026-03-21T13:52:22Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- PrepBatchesService with createPrepBatch using $transaction for atomic deduction of both raw ingredients (from IngredientStock) and sub-recipe outputs (from PrepBatches in FIFO order)
- previewDeductions read-only availability check returning available/required/sufficient per BOM line for wizard Step 2
- 7 unit tests covering FIFO ordering, batch depletion, insufficient stock errors, expired batch exclusion, and preview read-only safety
- KitchenModule scaffold with controller, service, DTOs registered in AppModule

## Task Commits

Each task was committed atomically:

1. **Task 1: KitchenModule scaffold + PrepBatches DTOs + findAll endpoint** - `9fe59c7` (feat)
2. **Task 2 RED: Failing tests for FIFO deduction** - `46328cc` (test)
3. **Task 2 GREEN: FIFO deduction logic + preview + passing tests** - `0454ca5` (feat)

## Files Created/Modified
- `backend/src/kitchen/kitchen.module.ts` - KitchenModule registering PrepBatches controller and service
- `backend/src/kitchen/prep-batches/prep-batches.service.ts` - PrepBatchesService with findAll, createPrepBatch (atomic FIFO deduction), previewDeductions (read-only)
- `backend/src/kitchen/prep-batches/prep-batches.controller.ts` - GET/POST endpoints with MANAGE_KITCHEN permission
- `backend/src/kitchen/prep-batches/prep-batches.service.spec.ts` - 7 unit tests for FIFO deduction, depletion, insufficient stock, expiry, preview
- `backend/src/kitchen/prep-batches/dto/create-prep-batch.dto.ts` - CreatePrepBatchDto with class-validator decorators
- `backend/src/kitchen/prep-batches/dto/preview-deductions.dto.ts` - PreviewDeductionsDto with class-validator decorators
- `backend/src/app.module.ts` - Added KitchenModule to imports

## Decisions Made
- PrepBatch record created first in $transaction to obtain its ID for StockMovement.reference_id; entire transaction rolls back if any deduction fails
- Mock Decimal helper uses valueOf() pattern (not .toNumber()) to match how Number() coerces Prisma Decimal objects in service code
- activeBatchWhere extracted as module-level helper for consistent expired-batch exclusion across createPrepBatch and previewDeductions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma Decimal mock pattern in tests**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** Initial mocks used `{ toNumber: () => N }` but service uses `Number()` which calls valueOf(), not toNumber(). Caused NaN in all calculations.
- **Fix:** Created `dec(n)` helper that returns `{ valueOf: () => n, toNumber: () => n }` for proper Number() coercion
- **Files modified:** backend/src/kitchen/prep-batches/prep-batches.service.spec.ts
- **Verification:** All 7 tests pass after fix
- **Committed in:** 0454ca5 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test mock fix necessary for correct Number() coercion. No scope creep.

## Issues Encountered
- Other parallel agents modified kitchen.module.ts during execution, removing PrepBatches registrations. Resolved by re-adding PrepBatches entries alongside their additions (KDS, Waste, Metrics, Expiry).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PrepBatch CRUD backend complete with atomic FIFO deduction
- previewDeductions ready for frontend wizard Step 2 integration
- PrepBatchesService exported from KitchenModule for cross-module use

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 09-kitchen-prep*
*Completed: 2026-03-21*
