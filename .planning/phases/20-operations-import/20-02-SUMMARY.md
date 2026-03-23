---
phase: 20-operations-import
plan: 02
subsystem: api
tags: [nestjs, imports, validators, prisma, exceljs, templates]

# Dependency graph
requires:
  - phase: 20-operations-import
    plan: 01
    provides: Import infrastructure with 12 types, sanitizeNumber, ImportRow, basic template entries
provides:
  - Level 1 validators for opening stock, missions, KPIs, events
  - Opening stock validator with ingredient FK resolution, zone ambiguity check, unit conversion path validation
  - Mission validator with phase/scope enum enforcement and duplicate detection
  - KPI validator with status enum, current_value overwrite protection (blocked status)
  - Event validator with event_type enum, zone/brand ambiguity checks, booking-aware capacity/date blocked checks
  - Comprehensive SAMPLE_DATA with realistic Konma villa content for all 10 new import types
  - Enhanced INSTRUCTIONS with WARNING, NOTE, TIP rows for all 10 new types
  - Recipe 3-sheet XLSX template (Recipes + BOM Lines + Instructions)
  - CSV rejection for recipes import type
affects: [20-03, 20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "findMany ambiguity pattern for zone/brand FK resolution (D-04): 0=not found, 1=use, 2+=ambiguous"
    - "Enum enforcement with exact error format: Invalid {field} '{value}'. Valid values: {list}"
    - "D-02 blocked status for update safety: KPI current_value overwrite, event capacity/date with bookings"
    - "BOM_COLUMNS + BOM_SAMPLE_DATA constants for recipe 3-sheet XLSX template (D-13)"

key-files:
  created:
    - backend/src/imports/validators/opening-stock.validator.ts
    - backend/src/imports/validators/missions.validator.ts
    - backend/src/imports/validators/kpis.validator.ts
    - backend/src/imports/validators/events.validator.ts
  modified:
    - backend/src/imports/template.service.ts

key-decisions:
  - "Opening stock has NO duplicate detection — stock is additive per D-08"
  - "KPI blocked check triggers when existing current_value > 0 and new value differs per D-02"
  - "Event duplicate detection uses title + date composite key; capacity/date blocked checks query booking count"
  - "Recipe XLSX generates BOM Lines sheet between data sheet and instructions sheet per D-13"
  - "CSV template rejects recipes with BadRequestException per D-13"

patterns-established:
  - "Zone/brand findMany ambiguity: findMany + length check (0/1/2+) for non-unique name fields"
  - "Validator blocked status: errors pushed even after duplicate detection for field-level update safety"
  - "Recipe 3-sheet XLSX: data + BOM Lines + Instructions with separate BOM_COLUMNS/BOM_SAMPLE_DATA constants"

requirements-completed: [OPSIMPORT-03, OPSIMPORT-04]

# Metrics
duration: 4min
completed: 2026-03-24
---

# Phase 20 Plan 02: Level 1 Validators and Template Service Summary

**4 Level 1 validators (opening stock, missions, KPIs, events) with enum enforcement, FK resolution, and duplicate/blocked detection; template service enhanced with comprehensive INSTRUCTIONS including warnings/notes and recipe 3-sheet XLSX**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T20:07:35Z
- **Completed:** 2026-03-23T20:11:35Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created 4 Level 1 validators following established `(raw, rowIndex, prisma) => Promise<ImportRow>` pattern with sanitizeNumber, trim, case-insensitive matching
- Opening stock validator resolves ingredient by name, zone by findMany ambiguity check, validates unit conversion path against UnitConversion table
- KPI validator enforces status enum, detects duplicates by name, blocks current_value overwrite on measured KPIs
- Event validator enforces event_type enum, resolves zone/brand by findMany ambiguity, blocks capacity reduction below bookings and date change when bookings exist
- Enhanced template service INSTRUCTIONS with WARNING, TIP, NOTE rows for all 10 new types; recipe INSTRUCTIONS cover both Sheet 1 and Sheet 2 fields
- Added recipe 3-sheet XLSX generation (BOM Lines sheet) and CSV rejection for recipes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validators for opening stock, missions, KPIs, and events** - `76fda03` (feat)
2. **Task 2: Extend template service with comprehensive SAMPLE_DATA, INSTRUCTIONS, and recipe 3-sheet XLSX** - `1b7d1bc` (feat)

## Files Created/Modified
- `backend/src/imports/validators/opening-stock.validator.ts` - Stock row validator with ingredient/zone FK resolution, unit conversion path check, sanitizeNumber
- `backend/src/imports/validators/missions.validator.ts` - Mission row validator with phase/scope enum enforcement, title duplicate detection
- `backend/src/imports/validators/kpis.validator.ts` - KPI row validator with status enum, current_value overwrite protection (blocked status)
- `backend/src/imports/validators/events.validator.ts` - Event row validator with zone/brand findMany ambiguity, capacity/date blocked checks
- `backend/src/imports/template.service.ts` - Enhanced SAMPLE_DATA with detailed content, INSTRUCTIONS with WARNING/NOTE/TIP rows, BOM_COLUMNS/BOM_SAMPLE_DATA, 3-sheet recipe XLSX, CSV rejection

## Decisions Made
- Opening stock has NO duplicate detection since stock imports are additive (D-08) -- each import creates independent stock movements
- KPI blocked check compares new current_value against existing current_value > 0 per D-02 policy
- Event duplicate detection uses composite title + date key; booking count queried via _count.bookings for capacity/date safety
- Recipe XLSX generates BOM Lines as second sheet (between data and instructions) using separate BOM_COLUMNS constant
- CSV template for recipes throws BadRequestException since BOM requires multi-sheet format

## Deviations from Plan

None - plan executed exactly as written. Plan 01 had already added basic SAMPLE_DATA and INSTRUCTIONS entries as a deviation fix; this plan enhanced them with the full specification content.

## Issues Encountered
- Pre-existing TypeScript errors in `kpis.service.spec.ts` (possibly null results) remain unchanged and are out of scope for this plan.

## Known Stubs
None. All 4 validators are fully implemented with complete validation logic, FK resolution, enum enforcement, and duplicate/blocked detection. Template service has comprehensive content for all 10 new import types.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Level 1 validators ready for wiring into imports.service.ts parseFile/commitImport dispatch (Plan 03)
- Template service complete for all import types - template download endpoint works for every type
- Level 2 validators (quests, menu categories, recipes) and Level 3/4 validators (tasks, menu items) needed in Plans 03-04

## Self-Check: PASSED

- All 4 new validator files verified present on disk
- template.service.ts verified with all enhancements
- Commit 76fda03 (Task 1) verified in git log
- Commit 1b7d1bc (Task 2) verified in git log

---
*Phase: 20-operations-import*
*Completed: 2026-03-24*
