---
phase: 22-recipe-page-redesign
plan: 03
subsystem: ui
tags: [react, dnd-kit, sortable, motion, animated-cost, recipe-builder, bom-table]

# Dependency graph
requires:
  - phase: 22-recipe-page-redesign
    provides: RecipeBuilderPage scaffold, BomLineState types, CostData/CostPreviewResponse types
provides:
  - RecipeBomTable with dnd-kit drag-and-drop reordering, ghost row, Add Line button
  - BomTableRow with sortable drag handle, type select, item combobox, qty, unit, prep notes, cost, remove
  - Client-side per-line cost calculation via calcLineCost utility
  - RecipeCostPanel with batch cost, per-portion cost, food cost %, missing-price warnings
  - AnimatedCost component using useMotionValue + useSpring for smooth number transitions
  - CostEstimateBadge with amber (estimated) and green (confirmed) states
  - 3-second debounced server cost confirmation flow in RecipeBuilderPage
affects: [22-recipe-page-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns: [dnd-kit-sortable-with-activator-ref, useMotionValue-spring-animated-number, client-server-hybrid-cost-calculation]

key-files:
  created:
    - frontend/components/ops/operations/recipes/builder/RecipeBomTable.tsx
    - frontend/components/ops/operations/recipes/builder/BomTableRow.tsx
    - frontend/components/ops/operations/recipes/builder/AnimatedCost.tsx
    - frontend/components/ops/operations/recipes/builder/CostEstimateBadge.tsx
    - frontend/components/ops/operations/recipes/builder/RecipeCostPanel.tsx
  modified:
    - frontend/components/ops/operations/recipes/RecipeBuilderPage.tsx

key-decisions:
  - "calcLineCost exported from RecipeBomTable for reuse in RecipeBuilderPage client-side cost aggregation"
  - "BomTableRow receives ingredientOptions and recipeOptions as props (not fetching internally) for single data source"
  - "subRecipeLineMap added to RecipeBomTable props for sub-recipe expansion without extra API calls"

patterns-established:
  - "dnd-kit activator ref: useSortable setActivatorNodeRef on grip button, not row container"
  - "Animated number: useMotionValue + useSpring from motion/react, ref.current.textContent update in onChange callback"
  - "Hybrid cost: client-side instant estimate + 3s debounced server confirmation with CostEstimateBadge toggle"

requirements-completed: [RECIPE-07, RECIPE-08, RECIPE-09]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 22 Plan 03: BOM Table & Cost Panel Summary

**Sortable BOM table with dnd-kit drag-and-drop, ghost row, per-line cost display, and sticky cost panel with useMotionValue animated numbers and estimated/confirmed badge flow**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T12:10:45Z
- **Completed:** 2026-03-24T12:18:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built sortable BOM table with dnd-kit drag handles, inline type/item/qty/unit/prep editing, per-line cost display, ghost row, and Add Line button
- Created AnimatedCost component using useMotionValue + useSpring for smooth cost number transitions (explicitly avoiding NumberTicker which uses once-only useInView)
- Implemented RecipeCostPanel with batch cost, per-portion cost, food cost %, missing-price warnings, and CostEstimateBadge
- Wired client-side cost calculation with vendorPriceMap/subRecipeCostMap/conversionMap and 3-second debounced server cost confirmation

## Task Commits

Each task was committed atomically:

1. **Task 1: BOM table with dnd-kit drag-and-drop and inline editing** - `8750eef` (feat)
2. **Task 2: Cost panel with animated numbers and estimate/confirmed badge** - `c608493` (feat)

## Files Created/Modified
- `frontend/components/ops/operations/recipes/builder/BomTableRow.tsx` - Sortable row with drag handle, type select, item combobox, qty, unit, prep notes, cost, remove
- `frontend/components/ops/operations/recipes/builder/RecipeBomTable.tsx` - DndContext/SortableContext wrapper with ghost row, Add Line, and calcLineCost utility
- `frontend/components/ops/operations/recipes/builder/AnimatedCost.tsx` - Animated number display using useMotionValue + useSpring
- `frontend/components/ops/operations/recipes/builder/CostEstimateBadge.tsx` - Estimated (amber) / Confirmed (green) badge
- `frontend/components/ops/operations/recipes/builder/RecipeCostPanel.tsx` - Sticky cost panel with batch cost, per-portion, food cost %, missing-price warnings
- `frontend/components/ops/operations/recipes/RecipeBuilderPage.tsx` - Integrated BOM table and cost panel, added cost-data/ingredient/recipe queries, client-side cost computation, server cost confirmation

## Decisions Made
- Exported `calcLineCost` from RecipeBomTable so RecipeBuilderPage can reuse it for aggregate batch cost computation
- BomTableRow receives ingredientOptions and recipeOptions as props rather than fetching internally, keeping a single data source at the page level
- Added `subRecipeLineMap` as a dedicated prop to RecipeBomTable for sub-recipe expansion data, avoiding extra API calls

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
- `menuItemPrice` is passed as `null` to RecipeCostPanel -- food cost % requires knowing if the recipe is linked to a menu item and its selling price, which is a future plan concern
- Status banner slot remains commented out in RecipeBuilderPage.tsx -- intentional, resolved by Plan 04

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BOM table and cost panel are fully integrated into RecipeBuilderPage
- Plan 04 can add the RecipeStatusBanner for inline approval workflow
- All 5 builder component files are in place for the complete recipe builder experience

## Self-Check: PASSED

All 6 files verified present. Both task commits (8750eef, c608493) verified in git log.

---
*Phase: 22-recipe-page-redesign*
*Completed: 2026-03-24*
