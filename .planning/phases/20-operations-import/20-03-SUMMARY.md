---
phase: 20-operations-import
plan: 03
subsystem: api
tags: [nestjs, imports, validators, prisma, recipes, quests, tasks, menu]

# Dependency graph
requires:
  - phase: 20-operations-import
    provides: Import infrastructure (import-types, parsers, service, controller, module) from Plan 01
  - phase: 20-operations-import
    provides: Level 1 validators (opening-stock, missions, kpis, events) from Plan 02
provides:
  - Quest validator with mission/user FK resolution and status guard
  - Task validator with quest status guard (D-24), enum enforcement (task_type/domain/priority)
  - Recipe header + BOM validators with brand/zone ambiguity check, cycle detection (D-19)
  - Menu category validator with brand FK and brand change protection (D-02)
  - Menu item validator with approved recipe guard and category-within-brand context
  - All 12 import types wired into validateRow switch in imports.service.ts
  - Recipe BOM validation with recipeNameMap for cross-sheet references
  - D-15 cascading invalidation for BOM lines of invalid recipe headers
  - SHA-256 stock re-import detection (D-09/D-22/D-32)
affects: [20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Quest status guard: block modifications to non-planned quests (D-02/D-24)"
    - "Task enum enforcement: VALID_TASK_TYPES, VALID_DOMAINS, VALID_PRIORITIES arrays with .includes() check"
    - "Recipe BOM recipeNameMap: Map<string,string> built from Sheet 1 names for cross-sheet FK resolution"
    - "D-15 cascading invalidation: invalidRecipeNames Set propagates header errors to BOM rows"
    - "Cycle detection: self-reference check in BOM validator (sub-recipe name matches parent recipe)"

key-files:
  created:
    - backend/src/imports/validators/quests.validator.ts
    - backend/src/imports/validators/tasks.validator.ts
    - backend/src/imports/validators/recipes.validator.ts
    - backend/src/imports/validators/menu-categories.validator.ts
    - backend/src/imports/validators/menu-items.validator.ts
  modified:
    - backend/src/imports/imports.service.ts

key-decisions:
  - "Recipe BOM validator accepts optional recipeNameMap for validating cross-sheet references without DB lookup"
  - "Cycle detection limited to self-reference in validator; deep cycle detection deferred to commit-time walkForCycle"
  - "Menu item validator resolves brand BEFORE category to enable category-within-brand lookup"
  - "Task validator sets blocked status immediately when quest is not planned, before duplicate check"

patterns-established:
  - "findMany ambiguity pattern for brand/zone: 0=not found, 1=use it, 2+=ambiguous error"
  - "Enum validation pattern: const array + .includes() with formatted error listing valid values"
  - "Blocked status cascading: parent entity status propagates to child rows (recipe->BOM, quest->task)"

requirements-completed: [OPSIMPORT-05, OPSIMPORT-06, OPSIMPORT-07]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 20 Plan 03: Level 2-4 Entity Validators Summary

**5 validators for quests/tasks/recipes/menu-categories/menu-items with FK dependency chains, enum enforcement, cycle detection, and all 12 types wired into imports.service.ts validateRow switch**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T20:08:25Z
- **Completed:** 2026-03-23T20:13:35Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created 5 Level 2-4 validators with full FK resolution chains, enum enforcement, and dependency guards
- Wired all 12 import types into validateRow switch (3 existing + 4 from Plan 02 + 5 new)
- Replaced BOM pass-through with proper validateRecipeBomRow using recipeNameMap for cross-sheet references
- Added D-15 cascading invalidation (invalid recipe headers propagate to all their BOM lines)
- Added SHA-256 stock re-import detection producing warning in ParseResult

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validators for quest, task, recipe, menu category, and menu item** - `b094a2a` (feat)
2. **Task 2: Wire all 10 new validators into imports.service.ts validateRow switch** - `3756d1c` (feat)

## Files Created/Modified
- `backend/src/imports/validators/quests.validator.ts` - Quest row validator with mission/user FK resolution, duplicate by title+mission, blocked if not planned
- `backend/src/imports/validators/tasks.validator.ts` - Task row validator with mission/quest FK, enum enforcement (task_type/domain/priority), quest status guard (D-24)
- `backend/src/imports/validators/recipes.validator.ts` - Recipe header + BOM line validators with brand/zone ambiguity, cycle detection (D-19), approved recipe blocking
- `backend/src/imports/validators/menu-categories.validator.ts` - Menu category validator with brand FK ambiguity check, blocked on brand change (D-02)
- `backend/src/imports/validators/menu-items.validator.ts` - Menu item validator with approved recipe guard, category within brand context, boolean parsing
- `backend/src/imports/imports.service.ts` - All 12 import types in validateRow switch, BOM validation with recipeNameMap, D-15 cascading invalidation, SHA-256 stock re-import detection

## Decisions Made
- Recipe BOM validator accepts optional `recipeNameMap` parameter for validating cross-sheet references without requiring DB lookup (recipes in Sheet 1 may not be in DB yet)
- Cycle detection in BOM validator is limited to self-reference check (recipe A uses recipe A); deeper cycle detection via walkForCycle is deferred to commit time when actual recipe IDs are available
- Menu item validator resolves brand BEFORE category because category lookup requires brand_id for scoping
- Task validator sets blocked status immediately when quest status is not 'planned', skipping duplicate detection since the row cannot be imported regardless

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `kpis.service.spec.ts` (possibly null results) remain unchanged and are out of scope for this plan.

## Known Stubs
None. All validators are fully implemented with complete FK resolution, enum enforcement, and dependency guards.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 12 import types now have per-type validators with full validation logic
- Ready for Plan 04 (createRow/updateRow commit logic for all types)
- Recipe BOM validation + cascading invalidation ready for the multi-pass commit flow

## Self-Check: PASSED

- All 6 files verified present on disk
- Commit b094a2a (Task 1) verified in git log
- Commit 3756d1c (Task 2) verified in git log

---
*Phase: 20-operations-import*
*Completed: 2026-03-24*
