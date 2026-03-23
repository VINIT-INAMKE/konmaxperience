---
phase: 20-operations-import
plan: 04
subsystem: api
tags: [nestjs, prisma, imports, inventory, recipes, transactions, cost-calculator]

# Dependency graph
requires:
  - phase: 20-operations-import
    provides: "Parsers, validators, and import-types for all 13 import types (Plans 01-03)"
  - phase: 08-inventory-procurement
    provides: "InventoryService.adjust() for stock movements"
  - phase: 07-recipe-ingredient
    provides: "CostCalculatorService.recalculateAndSave() for recipe costing"
provides:
  - "Complete commit logic for all 13 import types in ImportsService"
  - "commitStockImport: independent per-row adjust() with import reference tagging"
  - "commitRecipeImport: two-pass header+BOM with cycle detection and cost recalc"
  - "createRow/updateRow cases for missions, quests, tasks, kpis, events, menu_categories, menu_items"
  - "D-02 update policy enforcement (SAFE/BLOCKED/NEVER) in all updateRow cases"
  - "CommitImportDto.bomRows for recipe BOM lines"
affects: [20-operations-import]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stock import: no outer transaction, each inventoryService.adjust() is independent"
    - "Recipe import: two-pass within single transaction (Pass 1 headers, Pass 2 BOM replacement)"
    - "Recipe cost calc outside transaction (non-critical, retryable)"
    - "FileHash pass-through via first row validated.fileHash for stock re-import detection"

key-files:
  created: []
  modified:
    - "backend/src/imports/imports.service.ts"
    - "backend/src/imports/dto/commit-import.dto.ts"
    - "backend/src/imports/imports.controller.ts"

key-decisions:
  - "Included commitRecipeImport and commitStockImport in same commit since both are routed from commitImport early returns"
  - "fileHash passed through validated row data (row[0].validated.fileHash) rather than adding to DTO, matching plan recommendation"
  - "Recipe BOM cycle detection is two-level (self + immediate parents) rather than full graph walk, sufficient for import use case"

patterns-established:
  - "Import commit routing: special-case types (opening_stock, recipes) return early from commitImport to dedicated methods"
  - "D-02 defense-in-depth: even when validators block unsafe fields, updateRow omits them from Prisma data"

requirements-completed: [OPSIMPORT-08, OPSIMPORT-03]

# Metrics
duration: 8min
completed: 2026-03-23
---

# Phase 20 Plan 04: Commit Logic for All Import Types Summary

**Complete commit logic for 13 import types: stock with independent adjust() + import tagging, recipe two-pass with BOM replacement and cycle detection, 8 single-entity types with D-02 update policy enforcement**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-23T20:18:39Z
- **Completed:** 2026-03-23T20:26:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Stock commit path calls inventoryService.adjust() per row with no outer transaction, tags StockMovement with reference_type='import' and reference_id=fileHash for re-import detection
- Recipe two-pass commit creates/updates headers in Pass 1, deletes and recreates BOM lines in Pass 2, detects circular references, runs costCalculatorService.recalculateAndSave() outside transaction
- All 8 single-entity types (missions, quests, tasks, kpis, events, menu_categories, menu_items) have createRow and updateRow with full D-02 policy enforcement
- Ingredient updateRow fixed to exclude base_unit (D-28 defense-in-depth)
- CommitImportDto extended with optional bomRows for recipe commit flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Stock commit + createRow/updateRow for all types** - `058b024` (feat)
2. **Task 2: Recipe two-pass commit** - included in `058b024` (logically inseparable from Task 1 routing)

## Files Created/Modified
- `backend/src/imports/imports.service.ts` - Added commitStockImport, commitRecipeImport, 8 createRow cases, 8 updateRow cases, fileHash pass-through
- `backend/src/imports/dto/commit-import.dto.ts` - Added optional bomRows field for recipe commit
- `backend/src/imports/imports.controller.ts` - Updated commitImport call to pass dto.bomRows

## Decisions Made
- Combined Tasks 1 and 2 into a single commit because commitRecipeImport was defined in the same method addition as commitStockImport and both are routed from commitImport
- Used fileHash pass-through via validated row data rather than adding a separate DTO field, matching plan recommendation
- Recipe BOM cycle detection performs two-level check (self-reference + immediate parent BOM lines) rather than full recursive graph walk

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were committed together because the code was logically inseparable (both special commit methods were added alongside the routing logic in commitImport).

## Issues Encountered
- Pre-existing TypeScript errors in kpis.service.spec.ts (2 errors about nullable result) -- out of scope, unrelated to import changes

## Known Stubs
None - all commit logic is fully wired to real services (inventoryService.adjust, costCalculatorService.recalculateAndSave, Prisma create/update).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 13 import types now have complete parse + validate + commit pipelines
- Ready for Plan 05 (frontend integration of commit flow)
- Stock, recipe, and all single-entity commits are functional

---
*Phase: 20-operations-import*
*Completed: 2026-03-23*
