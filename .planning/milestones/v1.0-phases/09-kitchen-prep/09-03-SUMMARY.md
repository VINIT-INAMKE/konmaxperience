---
phase: 09-kitchen-prep
plan: 03
subsystem: api
tags: [nestjs, prisma, kds, waste-log, kitchen-metrics, cron, menu-availability, unit-conversion]

# Dependency graph
requires:
  - phase: 09-kitchen-prep
    provides: "PrepBatch, WasteLog, Order, OrderItem Prisma models, MANAGE_KITCHEN permission, @nestjs/schedule"
  - phase: 08-inventory-procurement
    provides: "IngredientStock, StockMovement models and inventory patterns"
  - phase: 07-recipe-ingredient-management
    provides: "Recipe, RecipeLine, Ingredient, MenuItem, VendorPrice models and CostCalculatorService"
provides:
  - "KDS endpoints: GET /kitchen/kds (active orders grouped by zone), PATCH /kitchen/kds/items/:id/status (progression validation)"
  - "WasteLog CRUD: POST /kitchen/waste (auto cost_impact + stock deduction), GET /kitchen/waste (with zone filter)"
  - "Kitchen metrics: GET /kitchen/metrics (orders_in_queue, items_completed_today, active_prep_batches, waste_today_cost, waste_percentage, average_prep_time_minutes)"
  - "Expiry cron: hourly @Cron marks expired PrepBatches and auto-creates WasteLog entries"
  - "Menu availability: GET /menu/availability/:menuItemId (servings_remaining from PrepBatch + IngredientStock)"
affects: [09-kitchen-prep, 10-pos-orders]

# Tech tracking
tech-stack:
  added: []
  patterns: ["KDS zone grouping with Map-based aggregation", "Auto cost_impact from VendorPrice (ingredient) or computed_cost (prep_batch)", "Status progression validation via progressionMap", "Hourly cron with $transaction for batch expiry + waste logging"]

key-files:
  created:
    - "backend/src/kitchen/kds/kds.service.ts"
    - "backend/src/kitchen/kds/kds.controller.ts"
    - "backend/src/kitchen/waste/waste.service.ts"
    - "backend/src/kitchen/waste/waste.controller.ts"
    - "backend/src/kitchen/waste/dto/create-waste-log.dto.ts"
    - "backend/src/kitchen/metrics/kitchen-metrics.service.ts"
    - "backend/src/kitchen/metrics/kitchen-metrics.controller.ts"
    - "backend/src/kitchen/expiry/kitchen-expiry.cron.ts"
  modified:
    - "backend/src/kitchen/kitchen.module.ts"
    - "backend/src/menu/menu.service.ts"
    - "backend/src/menu/menu.controller.ts"

key-decisions:
  - "KDS item status progression enforced via progressionMap (pending->preparing->ready only, no backwards)"
  - "Auto order-ready check: when all OrderItems reach ready status, Order.status auto-updates to ready"
  - "Ingredient waste creates StockMovement (type=waste) and decrements IngredientStock in single $transaction"
  - "Prep batch waste decrements quantity_remaining and marks depleted if <= 0"
  - "waste_percentage = (waste_today_cost / totalCostProduced) * 100 per D-15 / KITCHEN-05"
  - "Menu availability endpoint (GET /menu/availability/:menuItemId) is backend-only for Phase 9; D-11 frontend display deferred to Phase 10"

patterns-established:
  - "Status progression map pattern: Record<string, string> for enforcing valid state transitions"
  - "Zone-grouped query result: Map-based aggregation with zone_id key for KDS display"
  - "Cost calculation dispatch: waste_type determines cost source (VendorPrice for ingredient, computed_cost for prep_batch)"
  - "System-generated waste entries: logged_by=null when cron creates WasteLog (nullable FK)"

requirements-completed: [KITCHEN-02, KITCHEN-03, KITCHEN-04, KITCHEN-05, KITCHEN-06]

# Metrics
duration: 6min
completed: 2026-03-21
---

# Phase 9 Plan 03: KDS + Waste + Metrics + Expiry + Availability Summary

**KDS endpoints with zone grouping and status progression, WasteLog CRUD with auto cost_impact from VendorPrice/computed_cost, kitchen metrics with waste_percentage, hourly expiry cron, and menu availability via PrepBatch+IngredientStock check**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T13:45:18Z
- **Completed:** 2026-03-21T13:52:04Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- KDS getActiveOrders groups orders by zone with full item details; updateItemStatus validates progression (pending->preparing->ready) and auto-marks order ready when all items done
- WasteLog createWasteLog auto-calculates cost_impact from VendorPrice (ingredient waste) or recipe computed_cost (prep_batch waste), with stock deduction in $transaction
- Kitchen metrics endpoint returns orders_in_queue, items_completed_today, active_prep_batches, waste_today_cost, waste_percentage (per D-15), and average_prep_time_minutes
- Hourly expiry cron marks expired PrepBatches as expired and auto-creates WasteLog entries with logged_by=null
- Menu availability endpoint returns servings_remaining by checking minimum across all BOM inputs (both PrepBatch and IngredientStock)

## Task Commits

Each task was committed atomically:

1. **Task 1: KDS endpoints + WasteLog CRUD + DTOs** - `77d59bc` (feat)
2. **Task 2: Kitchen metrics + expiry cron + menu availability endpoint** - `56da858` (feat)

## Files Created/Modified
- `backend/src/kitchen/kds/kds.service.ts` - KDS service with getActiveOrders (zone-grouped) and updateItemStatus (progression validation + auto order-ready)
- `backend/src/kitchen/kds/kds.controller.ts` - GET /kitchen/kds and PATCH /kitchen/kds/items/:id/status with MANAGE_KITCHEN permission
- `backend/src/kitchen/waste/waste.service.ts` - WasteLog findAll with zone filter, createWasteLog with auto cost_impact and stock/batch deduction
- `backend/src/kitchen/waste/waste.controller.ts` - GET /kitchen/waste and POST /kitchen/waste with MANAGE_KITCHEN permission
- `backend/src/kitchen/waste/dto/create-waste-log.dto.ts` - CreateWasteLogDto with class-validator decorators
- `backend/src/kitchen/metrics/kitchen-metrics.service.ts` - KitchenMetricsService.getSummary with all 6 metrics including waste_percentage
- `backend/src/kitchen/metrics/kitchen-metrics.controller.ts` - GET /kitchen/metrics with MANAGE_KITCHEN permission
- `backend/src/kitchen/expiry/kitchen-expiry.cron.ts` - @Cron('0 * * * *') hourly expiry with $transaction for batch status + waste log
- `backend/src/kitchen/kitchen.module.ts` - Updated with KitchenMetricsController, KitchenMetricsService, KitchenExpiryCron
- `backend/src/menu/menu.service.ts` - Added getServingsAvailable checking PrepBatch levels and IngredientStock via convertUnit
- `backend/src/menu/menu.controller.ts` - Added GET /menu/availability/:menuItemId endpoint

## Decisions Made
- KDS item status progression enforced via progressionMap pattern (pending->preparing->ready only, no backwards transitions allowed)
- Auto order-ready: when all OrderItems in an order reach ready status, Order.status automatically updates to ready
- Ingredient waste creates StockMovement (type=waste) and decrements IngredientStock in single $transaction for data integrity
- Prep batch waste decrements quantity_remaining and marks status=depleted if <= 0
- waste_percentage calculated as (waste_today_cost / totalCostProduced) * 100 per D-15 / KITCHEN-05 specification
- Menu availability endpoint is backend-only for Phase 9; frontend display (D-11) deferred to Phase 10 POS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Exported KDS interfaces to fix TS4053 compilation error**
- **Found during:** Task 1 (KDS endpoints)
- **Issue:** KdsZoneData, KdsOrder, KdsOrderItem interfaces were not exported, causing TS4053 error in controller return types
- **Fix:** Added `export` keyword to all three interfaces in kds.service.ts
- **Files modified:** backend/src/kitchen/kds/kds.service.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 77d59bc (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript visibility fix required for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 backend requirements (KITCHEN-02 through KITCHEN-06) complete
- KDS, waste, metrics, and availability endpoints ready for frontend consumption in Plan 04/05
- Expiry cron will auto-run when ScheduleModule is active
- Menu availability contract ready for Phase 10 POS integration

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 09-kitchen-prep*
*Completed: 2026-03-21*
