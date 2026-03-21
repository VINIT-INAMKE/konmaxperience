---
phase: 07-recipe-ingredient-management
plan: 03
subsystem: api
tags: [nestjs, prisma, recipes, menu, cost-calculation, bom]

# Dependency graph
requires:
  - phase: 07-recipe-ingredient-management
    plan: 02
    provides: unit-conversion utility, VendorsService stub, IngredientsModule, VendorsModule
  - phase: 06-operations-management
    provides: MANAGE_OPS permission, brands, zones, channels backend
provides:
  - RecipesModule with full CRUD, BOM upsert (delete-then-create in tx), cycle detection, cost recalculation on save
  - CostCalculatorService with recursive visitedSet cycle guard and ingredient-level propagation
  - MenuModule with categories CRUD, items CRUD (approved-recipe guard), channel modifier upsert
  - Vendor price save now triggers real cost recalculation via CostCalculatorService
  - All 4 Phase 7 backend modules registered in app.module.ts
affects:
  - 07-recipe-ingredient-management
  - frontend recipe and menu pages

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BOM upsert via delete-then-createMany in $transaction (no individual upsert needed)
    - Recursive cost calculation with visitedSet Set<string> cycle guard
    - Cross-module DI: VendorsModule imports RecipesModule to access exported CostCalculatorService
    - Approved-recipe guard in MenuService.createItem — validates recipe.status before MenuItem creation
    - Channel modifier global upsert via @@unique([channel_type]) Prisma upsert

key-files:
  created:
    - backend/src/recipes/cost-calculator.service.ts
    - backend/src/recipes/recipes.service.ts
    - backend/src/recipes/recipes.controller.ts
    - backend/src/recipes/recipes.module.ts
    - backend/src/recipes/dto/create-recipe.dto.ts
    - backend/src/recipes/dto/update-recipe.dto.ts
    - backend/src/recipes/dto/upsert-bom-lines.dto.ts
    - backend/src/menu/menu.service.ts
    - backend/src/menu/menu.controller.ts
    - backend/src/menu/menu.module.ts
    - backend/src/menu/dto/create-menu-category.dto.ts
    - backend/src/menu/dto/update-menu-category.dto.ts
    - backend/src/menu/dto/create-menu-item.dto.ts
    - backend/src/menu/dto/update-menu-item.dto.ts
    - backend/src/menu/dto/upsert-channel-modifier.dto.ts
  modified:
    - backend/src/vendors/vendors.service.ts
    - backend/src/vendors/vendors.module.ts
    - backend/src/app.module.ts

key-decisions:
  - "BOM upsert uses delete-then-createMany pattern in $transaction — clean, atomic, no partial state"
  - "CostCalculatorService exported from RecipesModule so VendorsModule can import it via cross-module DI (no circular dep)"
  - "Approved-recipe guard in MenuService throws 400 with explicit message directing user to change recipe status"
  - "checkCycle walks source recipe's BOM recursively with visitedSet to detect circular references before createMany"
  - "findAll for recipes returns brand/zone/creator but NOT RecipeLines to keep list queries lightweight"

patterns-established:
  - "Recursive cost calc: calculateRecipeCost(id, visitedSet) — null on cycle, null on missing price, totalCost otherwise"
  - "Propagation: recalculateForIngredient walks direct lines then one level of parent recipes"
  - "BOM upsert: deleteMany where recipe_id + createMany in same $transaction — no individual upsert needed"
  - "Cross-module export: RecipesModule exports CostCalculatorService; VendorsModule imports RecipesModule"

requirements-completed: [RECIPE-01, RECIPE-02, RECIPE-06, RECIPE-07]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 07 Plan 03: Recipes + Menu Backend Modules Summary

**NestJS RecipesModule with recursive cost calculator (visitedSet cycle guard), BOM upsert in $transaction, and MenuModule with approved-recipe guard and channel modifier upsert — vendor price saves now trigger real cost recalculation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T10:35:31Z
- **Completed:** 2026-03-21T10:39:31Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- CostCalculatorService with recursive calculateRecipeCost (visitedSet cycle guard), recalculateAndSave, recalculateForIngredient (direct + one-level parent propagation)
- RecipesService with full CRUD, BOM upsert (delete-then-createMany in $transaction), checkCycle, status transition guard (approved cannot revert to draft)
- MenuService with categories CRUD, items CRUD (approved-recipe guard with explicit 400 message), channel modifier global upsert via @@unique
- VendorsService stub replaced with real CostCalculatorService.recalculateForIngredient call
- All 4 Phase 7 backend modules (IngredientsModule, VendorsModule, RecipesModule, MenuModule) registered in app.module.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Recipes module with CostCalculator + BOM upsert + vendor cost wiring** - `b97c1b9` (feat)
2. **Task 2: Menu module (categories, items, channel modifiers) + app.module registration** - `d96ac5c` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/src/recipes/cost-calculator.service.ts` - Recursive cost calc with visitedSet cycle guard, recalculateForIngredient propagation
- `backend/src/recipes/recipes.service.ts` - Full CRUD, BOM upsert in $transaction, checkCycle, status transition guard
- `backend/src/recipes/recipes.controller.ts` - GET/POST/PATCH/DELETE /recipes with MANAGE_OPS gate on write ops
- `backend/src/recipes/recipes.module.ts` - Exports CostCalculatorService for cross-module use
- `backend/src/recipes/dto/create-recipe.dto.ts` - Recipe creation DTO with optional bom_lines array
- `backend/src/recipes/dto/update-recipe.dto.ts` - All fields optional, includes status and bom_lines
- `backend/src/recipes/dto/upsert-bom-lines.dto.ts` - BomLineDto (input_type, item_id, quantity, unit, prep_notes)
- `backend/src/menu/menu.service.ts` - Categories/items/channel modifier CRUD with approved-recipe guard
- `backend/src/menu/menu.controller.ts` - /menu/categories, /menu/items, /menu/channel-modifiers routes
- `backend/src/menu/menu.module.ts` - Exports MenuService
- `backend/src/menu/dto/*.ts` - 5 DTOs for all menu operations
- `backend/src/vendors/vendors.service.ts` - Stub replaced; CostCalculatorService injected via DI
- `backend/src/vendors/vendors.module.ts` - Imports RecipesModule for CostCalculatorService access
- `backend/src/app.module.ts` - RecipesModule and MenuModule added to imports array

## Decisions Made

- BOM upsert uses delete-then-createMany in $transaction rather than individual upserts — atomic, predictable, matches research pattern
- CostCalculatorService exported from RecipesModule and VendorsModule imports RecipesModule (not the service directly) — clean cross-module DI, no circular dependency risk
- Approved-recipe guard in createItem throws 400 with explicit user-facing message guiding status change
- findAll for recipes includes brand/zone/creator but not RecipeLines (heavy) — list view stays fast, detail view gets full RECIPE_INCLUDE with 3-level deep BOM tree
- status transition guard: approved -> draft throws BadRequestException; archived is the correct path instead

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Backend recipe and menu API is complete and TypeScript-verified
- All 4 Phase 7 backend modules registered in app.module.ts
- Ready for Plan 04 (frontend recipe management UI) and Plan 05 (frontend menu UI)
- Cost calculator will automatically recalculate when vendor prices are saved after database is configured

---
*Phase: 07-recipe-ingredient-management*
*Completed: 2026-03-21*
