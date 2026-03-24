---
phase: 22-recipe-page-redesign
plan: 02
subsystem: ui
tags: [react, next.js, tanstack-query, recipe-builder, inline-edit]

# Dependency graph
requires:
  - phase: 07-recipe-management
    provides: Recipe types, RecipeStatusBadge, recipe API endpoints
provides:
  - RecipeStatus extended with 'pending' status and amber badge styling
  - BomLineState, CostData, CostPreviewResponse frontend type interfaces
  - RecipeBuilderPage scaffold with two-column layout, save mutation, unsaved guard
  - RecipeMetaGrid inline-editable metadata component
  - /recipes/new and /recipes/[id] route pages wired to builder
affects: [22-recipe-page-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline-editable-field-with-transparent-border, two-column-sticky-layout, beforeunload-unsaved-guard]

key-files:
  created:
    - frontend/app/(ops)/operations/recipes/new/page.tsx
    - frontend/components/ops/operations/recipes/RecipeBuilderPage.tsx
    - frontend/components/ops/operations/recipes/builder/RecipeMetaGrid.tsx
  modified:
    - frontend/lib/types/recipe.ts
    - frontend/components/ops/operations/recipes/RecipeStatusBadge.tsx
    - frontend/app/(ops)/operations/recipes/[id]/page.tsx

key-decisions:
  - "base-ui Select onValueChange passes string|null -- coalesced to empty string with ?? operator"
  - "Replaced entire [id]/page.tsx detail view with RecipeBuilderPage (removed RecipeWizard pattern)"

patterns-established:
  - "Inline editable field: border-transparent at rest, hover:border-border, focus:border-[var(--primary)]"
  - "RecipeMetaGrid compact grid: grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 with label+input cells"
  - "Builder page two-column layout: grid-cols-[1fr_320px] with sticky right panel at top-[64px]"

requirements-completed: [RECIPE-05, RECIPE-06, RECIPE-12]

# Metrics
duration: 9min
completed: 2026-03-24
---

# Phase 22 Plan 02: Frontend Builder Scaffold Summary

**RecipeBuilderPage with inline-editable metadata grid, pending status type, two-column layout scaffold with placeholder slots for BOM table and cost panel**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-24T11:56:57Z
- **Completed:** 2026-03-24T12:06:03Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extended RecipeStatus type system with 'pending' status and added BomLineState, CostData, CostPreviewResponse interfaces for the builder
- Created RecipeBuilderPage with two-column layout, 28px editable name field, save mutation, unsaved changes guard with amber dot indicator
- Created RecipeMetaGrid with inline-editable brand, zone, yield, portion size, shelf life, and description fields
- Wired /recipes/new and /recipes/[id] routes to the new builder page, replacing the old detail+wizard view

## Task Commits

Each task was committed atomically:

1. **Task 1: Update frontend types and RecipeStatusBadge for pending status** - `b122ee5` (feat)
2. **Task 2: Create RecipeBuilderPage scaffold, RecipeMetaGrid, and route pages** - `40ddf30` (feat)

## Files Created/Modified
- `frontend/lib/types/recipe.ts` - Added pending to RecipeStatus, BomLineState/CostData/CostPreviewResponse interfaces
- `frontend/components/ops/operations/recipes/RecipeStatusBadge.tsx` - Extended with pending amber styling
- `frontend/app/(ops)/operations/recipes/new/page.tsx` - New recipe route rendering empty builder
- `frontend/app/(ops)/operations/recipes/[id]/page.tsx` - Replaced detail view with builder page
- `frontend/components/ops/operations/recipes/RecipeBuilderPage.tsx` - Main builder component with state management, save mutation, layout
- `frontend/components/ops/operations/recipes/builder/RecipeMetaGrid.tsx` - Inline-editable metadata grid component

## Decisions Made
- base-ui Select `onValueChange` passes `string | null` -- coalesced to empty string with `??` operator for type safety
- Replaced entire `[id]/page.tsx` detail view with RecipeBuilderPage, removing the RecipeWizard sidebar pattern entirely

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed base-ui Select onValueChange type mismatch**
- **Found during:** Task 2 (RecipeMetaGrid creation)
- **Issue:** base-ui Select.Root `onValueChange` callback passes `string | null`, but `onChange` prop expected `string`
- **Fix:** Added null coalescing `v ?? ''` on all three Select onValueChange handlers
- **Files modified:** frontend/components/ops/operations/recipes/builder/RecipeMetaGrid.tsx
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 40ddf30 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal type fix for base-ui Select API. No scope creep.

## Issues Encountered
None

## Known Stubs
- BOM table placeholder at line ~339 in RecipeBuilderPage.tsx ("BOM table will be added in Plan 03.") -- intentional, resolved by Plan 03
- Cost panel placeholder at line ~350 in RecipeBuilderPage.tsx ("Cost panel will be added in Plan 04.") -- intentional, resolved by Plan 04
- Status banner slot (commented out) in RecipeBuilderPage.tsx -- intentional, resolved by Plan 04

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RecipeBuilderPage scaffold is ready for Plan 03 to plug in the BOM table component
- RecipeBuilderPage scaffold is ready for Plan 04 to add the cost panel and status banner
- BomLineState type is ready for drag-and-drop BOM table implementation
- CostData and CostPreviewResponse types are ready for the cost calculation panel

## Self-Check: PASSED

All 6 files verified present. Both task commits (b122ee5, 40ddf30) verified in git log.

---
*Phase: 22-recipe-page-redesign*
*Completed: 2026-03-24*
