---
phase: 22-recipe-page-redesign
plan: 01
subsystem: api
tags: [nestjs, recipes, status-workflow, cost-calculation, versioning]

# Dependency graph
requires:
  - phase: 07-recipe-ingredient-management
    provides: Recipe/RecipeLine models, CostCalculatorService, unit conversion
provides:
  - pending status in recipe workflow (draft -> pending -> approved -> archived)
  - POST /recipes/:id/version endpoint for creating draft clones of approved recipes
  - POST /recipes/:id/cost-preview endpoint for live cost calculation without DB save
  - GET /recipes/cost-data endpoint for client-side cost pre-fetching
  - Approved recipe edit lock (data changes blocked, only status transition to archived)
affects: [22-recipe-page-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ALLOWED_TRANSITIONS map for status workflow enforcement"
    - "Approved-recipe edit guard: block data keys when status is approved"
    - "Cost preview without DB save: in-memory calculation from BOM lines"
    - "Bulk cost-data endpoint: lowest vendor price per ingredient + unit conversions"

key-files:
  created:
    - backend/src/recipes/dto/cost-preview.dto.ts
  modified:
    - backend/src/recipes/dto/update-recipe.dto.ts
    - backend/src/recipes/recipes.service.ts
    - backend/src/recipes/recipes.controller.ts

key-decisions:
  - "Status transition via ALLOWED_TRANSITIONS map replacing single if-check"
  - "Approved recipes reject all data edits via Object.keys filter on dto"
  - "createNewVersion archives original in transaction before cloning"
  - "cost-data route placed before :id route to avoid NestJS route conflict"

patterns-established:
  - "ALLOWED_TRANSITIONS record pattern for multi-status workflow enforcement"
  - "Recipe versioning via archive-and-clone in a single transaction"

requirements-completed: [RECIPE-01, RECIPE-02, RECIPE-03, RECIPE-04]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 22 Plan 01: Backend API Changes Summary

**Pending status workflow with transition guards, recipe versioning via archive-and-clone, and cost-preview/cost-data endpoints for live client-side calculation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-24T11:56:59Z
- **Completed:** 2026-03-24T12:03:32Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Full status workflow: draft -> pending -> approved -> archived with reject path (pending -> draft)
- Approved recipes locked from data edits; createNewVersion archives and clones with BOM lines
- Cost-preview endpoint accepts BOM lines and returns cost/complete/missingPrices without saving
- Cost-data bulk endpoint returns lowest vendor prices and unit conversions for client-side calculation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pending status + transitions + createNewVersion** - `07b0b00` (feat)
2. **Task 2: Cost-preview endpoint and bulk cost-data endpoint** - `166f0f4` (feat)

## Files Created/Modified
- `backend/src/recipes/dto/update-recipe.dto.ts` - Added 'pending' to @IsIn status validator
- `backend/src/recipes/dto/cost-preview.dto.ts` - New DTO with validated bom_lines array for cost preview
- `backend/src/recipes/recipes.service.ts` - ALLOWED_TRANSITIONS guard, approved-edit lock, createNewVersion, calculateCostPreview, getCostData methods
- `backend/src/recipes/recipes.controller.ts` - POST :id/version, POST :id/cost-preview, GET cost-data endpoints

## Decisions Made
- Status transition via ALLOWED_TRANSITIONS map replacing the previous single if-check for more comprehensive workflow enforcement
- Approved recipes reject all data edits by checking Object.keys(dto) minus 'status' — ensures backend enforces the "Create New Version" requirement
- createNewVersion archives the original recipe within the same transaction before creating the draft clone, ensuring atomicity
- cost-data GET route declared before :id GET route in the controller to prevent NestJS interpreting "cost-data" as a UUID parameter

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all endpoints are fully wired to real data sources.

## Next Phase Readiness
- All 3 new endpoints (version, cost-preview, cost-data) and updated status transitions ready for frontend consumption
- Plan 02 (frontend recipe builder page) can now use these backend capabilities

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 22-recipe-page-redesign*
*Completed: 2026-03-24*
