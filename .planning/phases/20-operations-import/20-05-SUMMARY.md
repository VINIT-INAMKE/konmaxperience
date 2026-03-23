---
phase: 20-operations-import
plan: 05
subsystem: ui
tags: [nextjs, react, lucide, imports, prerequisites, tiered-layout, stock-warnings, recipe-preview]

# Dependency graph
requires:
  - phase: 20-operations-import
    provides: Extended ImportType union (12 types), RecipeParseResult, blocked status, prerequisites endpoint
  - phase: 19-master-data-import
    provides: Base import frontend (type page with drag-drop, parse, preview, commit flow)
provides:
  - Frontend ImportType config with all 12 types including icon, label, description
  - PrerequisiteData interface for dependency checks
  - Tiered import index page (Foundation, Operations Independent, Operations Sequenced, Menu)
  - Amber prerequisite warning badges on import cards
  - Stock-specific UI (additive warning, hidden toggle, re-import warning)
  - Recipe-specific UI (XLSX-only badge, draft notice, grouped BOM preview with expand/collapse)
  - Blocked row status rendering with destructive badge
  - Entity-specific update toggle labels
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tiered import index with prerequisite fetch on mount and amber warning badges"
    - "Entity-specific getUpdateLabel function for context-aware toggle descriptions"
    - "Recipe grouped preview: header rows with collapsible BOM lines using expandedRecipes Set state"
    - "RecipeParseResult cast pattern for recipe-specific parseResult access"
    - "XLSX-only file validation for recipe imports with separate error messages"

key-files:
  created: []
  modified:
    - frontend/lib/types/imports.ts
    - frontend/app/(ops)/admin/import/page.tsx
    - frontend/app/(ops)/admin/import/[type]/page.tsx

key-decisions:
  - "PrerequisiteData interface mirrors backend response shape for type-safe prerequisite checks"
  - "Tier prerequisites use function predicates (not static boolean) for dynamic evaluation against live data"
  - "Recipe grouped preview renders BOM lines inline under parent recipe rows with expand/collapse toggle"
  - "Blocked status uses same red dot as invalid but distinct Blocked badge for visual differentiation"
  - "Stock imports hide update toggle entirely (always additive) rather than showing disabled toggle"

patterns-established:
  - "TIERS array with prerequisites Record for dependency-ordered import index layout"
  - "renderStatusBadge unified function handling valid/invalid/duplicate/blocked row states"
  - "getUpdateLabel entity-specific switch for contextual toggle descriptions"

requirements-completed: [OPSIMPORT-09, OPSIMPORT-10]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 20 Plan 05: Frontend Import Types, Tiered Index, and Stock/Recipe UI Summary

**Extended frontend with 12 import type configs, tiered index page with live prerequisite checks, stock additive warnings, and recipe XLSX-only grouped BOM preview**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T20:07:35Z
- **Completed:** 2026-03-23T20:13:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended frontend IMPORT_TYPE_CONFIG with all 12 types (icons, labels, descriptions, columns) plus PrerequisiteData and RecipeParseResult interfaces
- Restructured import index page into 4 dependency-ordered tiers with live prerequisite fetch and amber warning badges for missing dependencies
- Added stock-specific UI: amber additive warning banner, hidden update toggle, and re-import warning display after parse
- Added recipe-specific UI: XLSX-only badge with file validation, draft notice info banner, and grouped preview table with expand/collapse BOM lines
- Added blocked row status rendering and entity-specific update toggle labels for recipes, quests, tasks, and events

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend frontend types and restructure import index page with prerequisite tiers** - `b52dbc6` (feat)
2. **Task 2: Add stock-specific and recipe-specific UI enhancements to import type page** - `951aa86` (feat)

## Files Created/Modified
- `frontend/lib/types/imports.ts` - Extended IMPORT_TYPES to 12 types, added blocked status, warning field, RecipeParseResult, PrerequisiteData, full IMPORT_TYPE_CONFIG with icons
- `frontend/app/(ops)/admin/import/page.tsx` - Restructured from flat 3-column grid to 4 tiered sections with prerequisite fetch, entity count display, and amber warning badges
- `frontend/app/(ops)/admin/import/[type]/page.tsx` - Added stock warnings, recipe XLSX-only handling, grouped BOM preview, blocked status, entity-specific toggle labels, all 12 types in ICON_MAP

## Decisions Made
- PrerequisiteData interface mirrors backend response shape for type-safe prerequisite checks
- Tier prerequisites use function predicates for dynamic evaluation against live data
- Recipe grouped preview renders BOM lines inline under parent rows with expand/collapse toggle per recipe
- Blocked status uses same red dot as invalid but distinct "Blocked" badge text for visual differentiation
- Stock imports hide update toggle entirely (always additive) rather than showing a disabled toggle
- Empty state text updated to match UI-SPEC copy ("File parsed -- no importable rows found")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
None. All UI components are fully wired to existing API endpoints. Backend validators for new import types are handled by Plan 03.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend fully supports all 12 import types with type-specific UI behaviors
- Tiered index page with prerequisite checks provides clear import ordering guidance
- Stock and recipe import pages have specialized UI per the UI-SPEC contract

## Self-Check: PASSED

- All 3 files verified present on disk
- Commit b52dbc6 (Task 1) verified in git log
- Commit 951aa86 (Task 2) verified in git log

---
*Phase: 20-operations-import*
*Completed: 2026-03-24*
