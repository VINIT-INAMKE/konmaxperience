---
phase: 20-operations-import
plan: 01
subsystem: api
tags: [nestjs, imports, xlsx, exceljs, prisma, validation]

# Dependency graph
requires:
  - phase: 19-master-data-import
    provides: Import infrastructure (import-types, parsers, validators, service, controller, module)
provides:
  - Extended ImportType union with 10 new types (12 total)
  - ImportRow 'blocked' status and ParseResult warning/blockedCount fields
  - sanitizeNumber utility for comma-stripped numeric parsing
  - RecipeParseResult interface for multi-sheet recipe imports
  - Multi-sheet recipe XLSX parser (parseRecipeXLSX)
  - Ingredient validator enum enforcement and base_unit change protection
  - Prerequisites endpoint (GET /imports/prerequisites)
  - Transaction rollback fix (D-26) and userId audit trail (D-27)
  - 500-row limit enforcement (D-30)
  - InventoryModule and RecipesModule wired into ImportsModule
affects: [20-02, 20-03, 20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sanitizeNumber utility for comma-stripped numeric fields (D-31)"
    - "Multi-sheet XLSX parsing via parseSheet helper for recipe imports (D-13)"
    - "Transaction error collection with re-throw for full rollback (D-26)"
    - "Prerequisites endpoint returning entity counts for dependency checks (D-12)"

key-files:
  created:
    - backend/src/imports/parsers/recipe-xlsx.parser.ts
  modified:
    - backend/src/imports/import-types.ts
    - backend/src/imports/imports.service.ts
    - backend/src/imports/imports.controller.ts
    - backend/src/imports/imports.module.ts
    - backend/src/imports/validators/ingredients.validator.ts
    - backend/src/imports/template.service.ts

key-decisions:
  - "Recipe XLSX parser uses parseSheet helper function extracted from existing xlsx.parser.ts pattern"
  - "Transaction errors collected in array, re-thrown after loop for full rollback (not partial commit)"
  - "New import types get basic pass-through validation until Plan 03 adds per-type validators"
  - "BOM lines returned as basic ImportRow entries for preview; BOM validator deferred to Plan 03"

patterns-established:
  - "sanitizeNumber: strip commas, trim, parseFloat, return null for invalid"
  - "blocked status: ImportRow status for rows that cannot be updated due to constraint violations"
  - "RecipeParseResult: extends ParseResult with bomRows, bomColumns, bomValidCount, bomInvalidCount"

requirements-completed: [OPSIMPORT-01, OPSIMPORT-02]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 20 Plan 01: Import Infrastructure Foundation Summary

**Extended import infrastructure with 10 new types, multi-sheet recipe XLSX parser, transaction rollback fix, userId audit trail, 500-row limit, ingredient enum enforcement, and prerequisites endpoint**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T19:59:27Z
- **Completed:** 2026-03-23T20:04:27Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Extended IMPORT_TYPES array from 3 to 12 types with full IMPORT_TYPE_CONFIG entries for all
- Created multi-sheet recipe XLSX parser reading Sheet 1 (headers) and Sheet 2 (BOM lines)
- Fixed critical transaction rollback bug: errors now collected and re-thrown for full atomicity
- Added userId parameter to commitImport for audit trail, prerequisites endpoint for dependency checks
- Fixed ingredient validator with enum enforcement for category/base_unit and base_unit change protection

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend import types, fix ingredient validator, create recipe XLSX parser** - `5d3c66f` (feat)
2. **Task 2: Fix service/controller, add prerequisites endpoint, wire module deps** - `9f230e4` (feat)

## Files Created/Modified
- `backend/src/imports/import-types.ts` - Extended ImportType union (12 types), added blocked status, sanitizeNumber, RecipeParseResult
- `backend/src/imports/parsers/recipe-xlsx.parser.ts` - New multi-sheet recipe XLSX parser with parseSheet helper
- `backend/src/imports/validators/ingredients.validator.ts` - Enum enforcement for category/base_unit, base_unit change protection, sanitizeNumber usage
- `backend/src/imports/imports.service.ts` - Transaction rollback fix, userId param, 500-row limit, recipe file handling, prerequisites method, DI for InventoryService and CostCalculatorService
- `backend/src/imports/imports.controller.ts` - @Req() for userId, recipe CSV rejection, prerequisites endpoint
- `backend/src/imports/imports.module.ts` - Wired InventoryModule and RecipesModule
- `backend/src/imports/template.service.ts` - Added SAMPLE_DATA and INSTRUCTIONS for all 10 new import types

## Decisions Made
- Recipe XLSX parser extracts `parseSheet` as a reusable helper, mirroring the existing `xlsx.parser.ts` pattern
- Transaction errors collected in `transactionErrors` array, re-thrown after the for-loop for complete rollback instead of partial commits
- New import types default to basic pass-through validation (returning raw as validated) until Plan 03 adds per-type validators
- BOM lines returned as basic ImportRow entries; BOM-specific validation deferred to Plan 03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added template SAMPLE_DATA and INSTRUCTIONS for 10 new import types**
- **Found during:** Task 1 (extending import-types.ts)
- **Issue:** Expanding the ImportType union caused TypeScript errors in template.service.ts because SAMPLE_DATA and INSTRUCTIONS (typed as Record<ImportType, ...>) were missing entries for the 10 new types
- **Fix:** Added realistic sample data and instruction tables for all 10 new types in template.service.ts
- **Files modified:** backend/src/imports/template.service.ts
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** 5d3c66f (Task 1 commit)

**2. [Rule 3 - Blocking] Added blockedCount to parseFile return in imports.service.ts**
- **Found during:** Task 1 (adding blockedCount to ParseResult interface)
- **Issue:** ParseResult now requires blockedCount field, but imports.service.ts parseFile return was missing it
- **Fix:** Added `blockedCount: validatedRows.filter((r) => r.status === 'blocked').length` to the return
- **Files modified:** backend/src/imports/imports.service.ts
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** 5d3c66f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary to maintain TypeScript compilation after extending the ImportType union. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `kpis.service.spec.ts` (possibly null results) remain unchanged and are out of scope for this plan.

## Known Stubs
None. All code paths are fully wired. New import types use pass-through validation as an intentional design until Plan 03 adds per-type validators.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Import infrastructure extended and ready for Plan 02 (template specs) and Plan 03 (per-type validators)
- InventoryModule and RecipesModule wired for stock import and recipe cost calculation
- Prerequisites endpoint ready for frontend dependency UI

## Self-Check: PASSED

- All 7 files verified present on disk
- Commit 5d3c66f (Task 1) verified in git log
- Commit 9f230e4 (Task 2) verified in git log

---
*Phase: 20-operations-import*
*Completed: 2026-03-24*
