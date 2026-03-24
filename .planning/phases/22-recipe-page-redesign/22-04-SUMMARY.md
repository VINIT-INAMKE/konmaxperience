---
phase: 22-recipe-page-redesign
plan: 04
subsystem: ui
tags: [react, approval-workflow, status-banner, dialog, link-navigation, recipe-builder]

# Dependency graph
requires:
  - phase: 22-recipe-page-redesign
    provides: RecipeBuilderPage scaffold, RecipeStatus type with pending, route pages
provides:
  - RecipeStatusBanner component with status-colored banner and contextual action buttons
  - Approval workflow mutations (statusMutation, versionMutation) in RecipeBuilderPage
  - Recipe list page with Link navigation replacing sidebar wizard pattern
  - Pending status in list page status filter
affects: [22-recipe-page-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns: [status-banner-with-role-gated-actions, confirmation-dialog-pattern-for-destructive-actions]

key-files:
  created:
    - frontend/components/ops/operations/recipes/builder/RecipeStatusBanner.tsx
  modified:
    - frontend/components/ops/operations/recipes/RecipeBuilderPage.tsx
    - frontend/app/(ops)/operations/recipes/page.tsx
    - frontend/components/ops/operations/recipes/RecipeCard.tsx

key-decisions:
  - "Approver gate uses roleCode === FOUNDER_ADMIN (no APPROVE_FOOD permission exists)"
  - "RecipeCard Edit button removed -- entire card is a Link to the builder page"
  - "Wizard components left as dead code in wizard/ directory for future cleanup"

patterns-established:
  - "Status banner pattern: colored banner below page header with contextual buttons based on entity status + user role"
  - "Confirmation dialog for destructive status transitions: reject, archive, create new version"

requirements-completed: [RECIPE-10, RECIPE-11, RECIPE-13]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 22 Plan 04: Approval Workflow & List Page Cleanup Summary

**RecipeStatusBanner with role-gated approval actions (submit/approve/reject/archive/version), confirmation dialogs per UI spec copywriting, and recipe list page migrated from wizard to Link navigation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T12:22:26Z
- **Completed:** 2026-03-24T12:27:26Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created RecipeStatusBanner with status-colored backgrounds and contextual action buttons per D-12 (draft: Submit for Approval, pending+approver: Approve/Reject, approved: Create New Version/Archive)
- Integrated statusMutation and versionMutation into RecipeBuilderPage with toast messages matching copywriting contract
- Migrated recipe list page from RecipeWizard sidebar to Link navigation (/recipes/new for create, /recipes/[id] for edit)
- Added pending status to list page filter dropdown and cleaned up RecipeCard by removing onEdit/isNew props

## Task Commits

Each task was committed atomically:

1. **Task 1: RecipeStatusBanner component and integrate into RecipeBuilderPage** - `901ce5e` (feat)
2. **Task 2: Update recipe list page and remove wizard** - `f384c5e` (feat)

## Files Created/Modified
- `frontend/components/ops/operations/recipes/builder/RecipeStatusBanner.tsx` - Status banner with contextual buttons and three confirmation dialogs (reject, archive, create version)
- `frontend/components/ops/operations/recipes/RecipeBuilderPage.tsx` - Added RecipeStatusBanner integration, statusMutation, versionMutation, FOUNDER_ADMIN approver gate
- `frontend/app/(ops)/operations/recipes/page.tsx` - Removed RecipeWizard, wizard state, added Link navigation, added pending to status filter
- `frontend/components/ops/operations/recipes/RecipeCard.tsx` - Removed onEdit/isNew/ShineBorder, kept presentational card with archive action

## Decisions Made
- Approver gate uses `roleCode === FOUNDER_ADMIN` since no APPROVE_FOOD permission exists in the system
- Removed the Edit button from RecipeCard since the entire card is already wrapped in a Link to the builder page
- Wizard files in `frontend/components/ops/operations/recipes/wizard/` left as dead code -- no pages import them after this change; cleanup deferred to a future phase

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
- `menuItemPrice` is passed as `null` to RecipeCostPanel -- food cost % requires a menu item link (future plan concern, carried from Plan 03)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full recipe builder is functional end-to-end: create, edit, BOM table, cost panel, approval workflow
- Recipe list page uses clean Link navigation to builder pages
- Phase 22 (recipe-page-redesign) is complete -- all 4 plans executed
- Wizard components can be deleted in a future cleanup pass

## Self-Check: PASSED

All 4 files verified present. Both task commits (901ce5e, f384c5e) verified in git log.

---
*Phase: 22-recipe-page-redesign*
*Completed: 2026-03-24*
