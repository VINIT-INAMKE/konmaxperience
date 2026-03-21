---
phase: 07-recipe-ingredient-management
plan: 05
subsystem: ui
tags: [react, next.js, tanstack-query, magic-card, number-ticker, combobox, sheet, wizard]

# Dependency graph
requires:
  - phase: 07-01
    provides: Recipe, RecipeLine, BomLineInput types; brand/zone/ingredient types
  - phase: 07-03
    provides: /recipes API endpoints (GET, POST, PATCH) + BOM lines support
provides:
  - /operations/recipes list page with card grid, brand/status/search filters, archive Dialog
  - RecipeWizard 3-step Sheet: details form, BOM line management, review + cost preview
  - RecipeCard with MagicCard, ShineBorder, NumberTicker cost display
  - RecipeStatusBadge component for draft/approved/archived
  - BomLineRow: type-switching combobox (ingredient vs recipe datasource)
  - /operations/recipes/[id] detail page with 2-column layout
  - RecipeDependencyTree: recursive rendering with clickable sub-recipe Links
affects:
  - 07-06 (menu management — uses /operations/recipes routes for recipe linking)
  - phase 08+ (any phase referencing recipe detail pages)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wizard state in parent (RecipeWizard) — all step state hoisted, steps receive props"
    - "base-ui Select onValueChange returns string | null — wrapper (v) => setState(v ?? '') required"
    - "RecipeDependencyTree recursive component — depth prop drives paddingLeft indentation"
    - "BomLineRow queries switch data source based on input_type (ingredient/recipe)"

key-files:
  created:
    - frontend/app/(ops)/operations/recipes/page.tsx
    - frontend/app/(ops)/operations/recipes/[id]/page.tsx
    - frontend/components/ops/operations/recipes/RecipeCard.tsx
    - frontend/components/ops/operations/recipes/RecipeStatusBadge.tsx
    - frontend/components/ops/operations/recipes/RecipeDependencyTree.tsx
    - frontend/components/ops/operations/recipes/wizard/RecipeWizard.tsx
    - frontend/components/ops/operations/recipes/wizard/RecipeWizardStep1.tsx
    - frontend/components/ops/operations/recipes/wizard/RecipeWizardStep2.tsx
    - frontend/components/ops/operations/recipes/wizard/RecipeWizardStep3.tsx
    - frontend/components/ops/operations/recipes/wizard/BomLineRow.tsx
  modified: []

key-decisions:
  - "Wizard state hoisted to RecipeWizard parent — setStep/details/bomLines all live there, steps get props"
  - "Discard changes Dialog gated on isDirty flag — Sheet close intercepted when dirty"
  - "BomLineRow queries conditionally enabled by input_type — prevents unnecessary API calls"
  - "RecipeDependencyTree depth prop controls paddingLeft (depth * 16px) for visual hierarchy"
  - "Archive action patches status=archived (not DELETE) — matches approved-recipe guard in backend"

requirements-completed: [RECIPE-01, RECIPE-02, RECIPE-06]

# Metrics
duration: 13min
completed: 2026-03-21
---

# Phase 07 Plan 05: Recipe Management UI Summary

**3-step recipe creation wizard (MagicCard grid, BOM combobox, NumberTicker cost) + detail page with recursive dependency tree and clickable sub-recipe navigation**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-21T10:44:44Z
- **Completed:** 2026-03-21T10:57:50Z
- **Tasks:** 2/2
- **Files modified:** 10 created

## Accomplishments
- Recipe list page with MagicCard grid, brand/status/search filters, ShineBorder on new items, archive Dialog
- RecipeWizard 3-step Sheet with state hoisted in parent — details form, BOM line management, review + cost preview
- BomLineRow with type-switching Combobox (ingredient vs sub-recipe data source) + compatible-units query
- RecipeDependencyTree recursive component — Leaf icon for ingredients, ChefHat + Link for sub-recipes, depth indentation
- Recipe detail page with 2-column layout, BOM card, cost breakdown with NumberTicker, edit via RecipeWizard

## Task Commits

Each task was committed atomically:

1. **Task 1: Recipe list page + RecipeCard + wizard (3 steps) + BomLineRow** - `a4c52f2` (feat)
2. **Task 2: Recipe detail page with dependency tree and cost breakdown** - `541f9bb` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `frontend/app/(ops)/operations/recipes/page.tsx` — Recipe list page, card grid, filters, archive Dialog, RecipeWizard
- `frontend/app/(ops)/operations/recipes/[id]/page.tsx` — Recipe detail page, 2-column layout, BOM + cost cards
- `frontend/components/ops/operations/recipes/RecipeCard.tsx` — MagicCard + ShineBorder, NumberTicker cost, edit/archive
- `frontend/components/ops/operations/recipes/RecipeStatusBadge.tsx` — draft/approved/archived badge
- `frontend/components/ops/operations/recipes/RecipeDependencyTree.tsx` — Recursive BOM tree with clickable sub-recipe Links
- `frontend/components/ops/operations/recipes/wizard/RecipeWizard.tsx` — 3-step Sheet, state management, discard Dialog
- `frontend/components/ops/operations/recipes/wizard/RecipeWizardStep1.tsx` — Details form (name, yield, brand, zone, status)
- `frontend/components/ops/operations/recipes/wizard/RecipeWizardStep2.tsx` — BOM line table with add/remove
- `frontend/components/ops/operations/recipes/wizard/RecipeWizardStep3.tsx` — Read-only review + NumberTicker cost
- `frontend/components/ops/operations/recipes/wizard/BomLineRow.tsx` — Type Select + Combobox + unit + prep notes

## Decisions Made
- Wizard state hoisted to RecipeWizard parent (setStep/details/bomLines all live there, steps get props) — prevents back navigation data loss
- Discard changes Dialog gated on isDirty flag — only shown when form has been touched
- BomLineRow queries conditionally enabled by input_type — prevents unnecessary API calls on initial render
- Archive patches status=archived (not DELETE) — matches backend approved-recipe guard behavior
- RecipeDependencyTree depth prop drives paddingLeft (depth * 16px) for visual nesting hierarchy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed base-ui Select onValueChange null type errors**
- **Found during:** Task 1 (all 3 Select onValueChange handlers)
- **Issue:** base-ui Select onValueChange returns `string | null`, TypeScript rejected direct assignment to `string` state
- **Fix:** Added null-coalescing wrapper `(v) => setState(v ?? 'default')` on all Select handlers — consistent with Phase 06-02 decision pattern
- **Files modified:** `RecipeWizardStep1.tsx`, `BomLineRow.tsx`, `recipes/page.tsx`
- **Verification:** TypeScript exits with code 0 after fixes
- **Committed in:** `a4c52f2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug/type error)
**Impact on plan:** Necessary fix for TypeScript correctness. Pattern already established in project STATE.md decisions.

## Issues Encountered
None beyond the base-ui Select null type error (auto-fixed).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Recipe management UI complete — /operations/recipes and /operations/recipes/[id] fully functional
- RecipeWizard available as shared component for any future page needing recipe create/edit
- Plan 07-06 (menu management) can reference /operations/recipes routes for recipe linking to menu items

## Self-Check: PASSED

All files verified present on disk. Both task commits exist in git history.

---
*Phase: 07-recipe-ingredient-management*
*Completed: 2026-03-21*
