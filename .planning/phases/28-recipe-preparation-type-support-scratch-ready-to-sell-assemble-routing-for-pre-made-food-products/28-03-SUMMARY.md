---
phase: 28-recipe-preparation-type-support-scratch-ready-to-sell-assemble-routing-for-pre-made-food-products
plan: 03
subsystem: api
tags: [nestjs, prisma, pick-and-pack, supply-usage, kitchen, ingredients, usage-type]

# Dependency graph
requires:
  - phase: 28-recipe-preparation-type-support-scratch-ready-to-sell-assemble-routing-for-pre-made-food-products
    plan: 01
    provides: Recipe.preparation_type field, Ingredient.usage_type field, IngredientCategory model
provides:
  - GET /kitchen/pick-and-pack endpoint returning non-scratch order items with assemble component checklists
  - PATCH /kitchen/pick-and-pack/items/:id/picked endpoint for marking items picked
  - GET /kitchen/supply-usage endpoint returning supply usage history
  - POST /kitchen/supply-usage endpoint for logging supply consumption with stock decrement
  - GET /ingredients?usage_type=recipe_input filter for BOM selector exclusion
  - category_obj relation included in ingredients findAll response
affects: [28-04, 28-05, 28-06, 28-07, 28-08, 28-09, 28-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [pick-and-pack-queue-query, supply-usage-stock-decrement, usage-type-filtering]

key-files:
  created:
    - backend/src/kitchen/pick-and-pack/pick-and-pack.service.ts
    - backend/src/kitchen/pick-and-pack/pick-and-pack.controller.ts
    - backend/src/kitchen/supply-usage/supply-usage.service.ts
    - backend/src/kitchen/supply-usage/supply-usage.controller.ts
    - backend/src/kitchen/supply-usage/dto/create-supply-usage.dto.ts
  modified:
    - backend/src/kitchen/kitchen.module.ts
    - backend/src/ingredients/ingredients.service.ts
    - backend/src/ingredients/ingredients.controller.ts

key-decisions:
  - "Controllers use RequiresPermission(Permission.MANAGE_KITCHEN) matching existing KDS/Waste pattern (JwtAuthGuard is global APP_GUARD)"
  - "Supply usage controller uses @Req() express.Request pattern (matching WasteController) instead of @CurrentUser decorator"
  - "No standalone pick-and-pack.module.ts or supply-usage.module.ts created — direct registration in KitchenModule matches existing pattern"

patterns-established:
  - "Pick & Pack query pattern: preparation_type != scratch with nested RecipeLines for assemble component checklists"
  - "Supply usage pattern: validate usage_type=supply then create StockMovement + decrement IngredientStock in transaction"
  - "usage_type query filter pattern on GET /ingredients for BOM selector scoping"

requirements-completed: [R28-06, R28-07, R28-08]

# Metrics
duration: 5min
completed: 2026-03-27
---

# Phase 28 Plan 03: Pick & Pack Queue and Supply Usage APIs Summary

**Pick & Pack queue endpoint for non-scratch order items with assemble component checklists, Supply Usage logging with stock decrement, and usage_type filtering on GET /ingredients**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T12:48:38Z
- **Completed:** 2026-03-27T12:53:27Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Pick & Pack service queries orders with non-scratch items, includes assemble component checklists from RecipeLines
- Supply Usage service validates supply-only ingredients, creates StockMovement with movement_type='supply_usage', decrements IngredientStock in transaction
- GET /ingredients now supports ?usage_type=recipe_input filter to exclude supplies/equipment from BOM selectors
- Both new services registered directly in KitchenModule following established direct-registration pattern
- category_obj relation added to ingredients findAll response for frontend category display

## Task Commits

Each task was committed atomically:

1. **Task 1: Pick & Pack service/controller + Supply Usage service/controller/DTO + KitchenModule registration** - `ed373e5` (feat)
2. **Task 2: Add usage_type filtering to GET /ingredients** - `f0b8eff` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `backend/src/kitchen/pick-and-pack/pick-and-pack.service.ts` - Pick & Pack queue query with preparation_type filtering and assemble component mapping
- `backend/src/kitchen/pick-and-pack/pick-and-pack.controller.ts` - GET /kitchen/pick-and-pack and PATCH items/:id/picked endpoints
- `backend/src/kitchen/supply-usage/supply-usage.service.ts` - Supply usage logging with supply-only validation, StockMovement creation, stock decrement
- `backend/src/kitchen/supply-usage/supply-usage.controller.ts` - GET /kitchen/supply-usage and POST /kitchen/supply-usage endpoints
- `backend/src/kitchen/supply-usage/dto/create-supply-usage.dto.ts` - Validated DTO with class-validator decorators
- `backend/src/kitchen/kitchen.module.ts` - Added PickAndPack and SupplyUsage controllers and services
- `backend/src/ingredients/ingredients.service.ts` - Added usage_type filter param and category_obj include to findAll
- `backend/src/ingredients/ingredients.controller.ts` - Added @Query('usage_type') parameter to findAll

## Decisions Made
- Controllers use RequiresPermission(Permission.MANAGE_KITCHEN) matching existing KDS/Waste pattern (JwtAuthGuard is global APP_GUARD)
- Supply usage controller uses @Req() express.Request pattern (matching WasteController) instead of @CurrentUser decorator
- No standalone pick-and-pack.module.ts or supply-usage.module.ts created -- direct registration in KitchenModule matches existing pattern

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data is wired and operational.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pick & Pack and Supply Usage endpoints operational for frontend consumption
- Ingredients endpoint ready for BOM selector scoping via usage_type filter
- All MANAGE_KITCHEN guarded endpoints ready for role-based access

## Self-Check: PASSED

All 8 files verified present. Both task commits (ed373e5, f0b8eff) confirmed in git log.

---
*Phase: 28-recipe-preparation-type-support-scratch-ready-to-sell-assemble-routing-for-pre-made-food-products*
*Completed: 2026-03-27*
