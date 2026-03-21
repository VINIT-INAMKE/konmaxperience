---
phase: 07-recipe-ingredient-management
plan: 02
subsystem: api
tags: [nestjs, prisma, ingredients, vendors, unit-conversion, crud]

# Dependency graph
requires:
  - phase: 07-01
    provides: Prisma schema with Ingredient, Vendor, VendorPrice, UnitConversion, RecipeLine models

provides:
  - IngredientsModule with full CRUD, category filter, usage-safe delete, compatible-units endpoint
  - VendorsModule with full CRUD, VendorPrice add/list, cost recalculation stub
  - Shared unit conversion utility with in-memory caching
  - Both modules registered in app.module.ts

affects:
  - 07-03-recipe-crud (uses IngredientsService for RecipeLine validation)
  - 07-04-cost-calculator (wires CostCalculatorService into VendorsService.recalculateCostsForIngredient stub)
  - frontend ingredient/vendor UI plans

# Tech tracking
tech-stack:
  added: []
  patterns:
    - VENDOR_INCLUDE const pattern for reusable Prisma include object
    - Unit conversion cache as module-level Map (cleared via clearConversionCache())
    - Usage-safe delete: count related records, throw BadRequestException if > 0

key-files:
  created:
    - backend/src/ingredients/ingredients.module.ts
    - backend/src/ingredients/ingredients.controller.ts
    - backend/src/ingredients/ingredients.service.ts
    - backend/src/ingredients/dto/create-ingredient.dto.ts
    - backend/src/ingredients/dto/update-ingredient.dto.ts
    - backend/src/vendors/vendors.module.ts
    - backend/src/vendors/vendors.controller.ts
    - backend/src/vendors/vendors.service.ts
    - backend/src/vendors/dto/create-vendor.dto.ts
    - backend/src/vendors/dto/update-vendor.dto.ts
    - backend/src/vendors/dto/create-vendor-price.dto.ts
    - backend/src/common/utils/unit-conversion.ts
  modified:
    - backend/src/app.module.ts

key-decisions:
  - "Vendor delete blocked when VendorPrice records exist (same usage-safe pattern as Ingredient delete)"
  - "VendorsController places GET /prices/ingredient/:id before GET /:id to prevent NestJS route shadowing"
  - "recalculateCostsForIngredient is a stub (console.log only) — CostCalculatorService wired in Plan 03"
  - "unit-conversion.ts uses module-level cache (not class-level) so it works from any service context"

patterns-established:
  - "Usage-safe delete: count related records, throw BadRequestException with message listing count and instructions"
  - "VENDOR_INCLUDE const for reusable Prisma include objects — avoids inline repetition"
  - "getCompatibleUnits endpoint on resource for BOM unit Select population"

requirements-completed: [RECIPE-03, RECIPE-04, RECIPE-05]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 7 Plan 02: Ingredients & Vendors Backend Modules Summary

**NestJS IngredientsModule and VendorsModule with VendorPrice management, shared in-memory unit conversion utility, and both registered in app.module.ts**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-21T09:24:39Z
- **Completed:** 2026-03-21T09:32:39Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- IngredientsModule: full CRUD with category filter, usage-safe delete (blocks if used in RecipeLines), GET /:id/compatible-units endpoint
- VendorsModule: full CRUD, VendorPrice add/list/getLatest, vendor delete blocked when prices exist
- Shared unit-conversion utility with loadConversions(), convertUnit(), getCompatibleUnits(), clearConversionCache() and in-memory caching
- Both modules registered in app.module.ts imports array after AssetsModule

## Task Commits

Each task was committed atomically:

1. **Task 1: Ingredients module + shared unit conversion utility** - `e2c4ad0` (feat)
2. **Task 2: Vendors module with VendorPrice management + app.module registration** - `ca1adb0` (feat)

## Files Created/Modified

- `backend/src/common/utils/unit-conversion.ts` - Shared convertUnit(), getCompatibleUnits(), in-memory cache
- `backend/src/ingredients/ingredients.module.ts` - NestJS module definition
- `backend/src/ingredients/ingredients.controller.ts` - REST endpoints: GET /, GET /:id, GET /:id/compatible-units, POST /, PATCH /:id, DELETE /:id
- `backend/src/ingredients/ingredients.service.ts` - CRUD with category filter, usage-safe delete
- `backend/src/ingredients/dto/create-ingredient.dto.ts` - name, category (enum), base_unit (enum), min_stock_level
- `backend/src/ingredients/dto/update-ingredient.dto.ts` - All fields optional
- `backend/src/vendors/vendors.module.ts` - NestJS module definition
- `backend/src/vendors/vendors.controller.ts` - REST endpoints: GET /, GET /prices/ingredient/:id, GET /:id, POST /, POST /prices, PATCH /:id, DELETE /:id
- `backend/src/vendors/vendors.service.ts` - CRUD, addPrice, getPricesForIngredient, getLatestPrice, recalculateCostsForIngredient stub
- `backend/src/vendors/dto/create-vendor.dto.ts` - name, phone?, email?, address?, payment_terms?
- `backend/src/vendors/dto/update-vendor.dto.ts` - All fields optional + status field
- `backend/src/vendors/dto/create-vendor-price.dto.ts` - vendor_id, ingredient_id, price, unit, effective_date
- `backend/src/app.module.ts` - Added IngredientsModule and VendorsModule imports

## Decisions Made

- Vendor delete is blocked when VendorPrice records exist, matching the same usage-safe delete pattern used for ingredients (blocked by RecipeLine usage). This maintains data integrity.
- VendorsController places `GET /prices/ingredient/:ingredientId` route before `GET /:id` to prevent NestJS from treating "prices" as a UUID param and throwing a ParseUUIDPipe error.
- `recalculateCostsForIngredient` is a stub that only console.logs — CostCalculatorService injection happens in Plan 03 per the plan spec.
- `unit-conversion.ts` uses a module-level cache variable (not injected service) so it works from any service that imports it, avoiding circular dependency concerns.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- IngredientsService and VendorsService are exported from their modules, ready for injection in Plan 03 (RecipeCRUD and CostCalculatorService)
- The `recalculateCostsForIngredient` stub is the explicit integration point for Plan 03/04 cost calculator wiring
- `clearConversionCache()` export available for use in UnitConversion seed/admin endpoints

## Self-Check: PASSED

- FOUND: backend/src/common/utils/unit-conversion.ts
- FOUND: backend/src/ingredients/ingredients.module.ts
- FOUND: backend/src/ingredients/ingredients.service.ts
- FOUND: backend/src/vendors/vendors.module.ts
- FOUND: backend/src/vendors/vendors.service.ts
- FOUND: .planning/phases/07-recipe-ingredient-management/07-02-SUMMARY.md
- FOUND commit: e2c4ad0
- FOUND commit: ca1adb0

---
*Phase: 07-recipe-ingredient-management*
*Completed: 2026-03-21*
