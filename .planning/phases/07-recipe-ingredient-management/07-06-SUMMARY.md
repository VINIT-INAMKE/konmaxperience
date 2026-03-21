---
phase: 07-recipe-ingredient-management
plan: 06
subsystem: ui
tags: [nextjs, react, tanstack-query, menu, food-cost, channel-modifiers]

requires:
  - phase: 07-01
    provides: Menu TypeScript types (MenuItem, MenuCategory, ChannelModifier, calcFoodCostPercent)
  - phase: 07-03
    provides: Backend menu endpoints (POST /menu/items guards approved-recipe only)

provides:
  - Menu management page at /operations/menu with brand-tabbed layout
  - FoodCostBadge component with green/amber/red color thresholds
  - MenuItemCard with availability toggle and food cost badge
  - MenuItemForm with approved-recipe-only filter and live food cost % calculation
  - MenuCategorySection with collapsible layout and item grid
  - ChannelModifierTable with inline editing for dine_in/takeaway/delivery

affects: [08-pricing, 09-ordering, verifier]

tech-stack:
  added: []
  patterns:
    - Availability toggle fires immediate PATCH with error revert pattern
    - Live computed field (food cost %) uses useMemo on form state
    - Brand filter via query select() — filtering to food+active brands client-side
    - Channel modifier inline editing with local row edit state (not server roundtrip until Save)

key-files:
  created:
    - frontend/components/ops/operations/menu/FoodCostBadge.tsx
    - frontend/components/ops/operations/menu/MenuItemCard.tsx
    - frontend/components/ops/operations/menu/MenuItemForm.tsx
    - frontend/components/ops/operations/menu/MenuCategorySection.tsx
    - frontend/components/ops/operations/menu/ChannelModifierTable.tsx
    - frontend/app/(ops)/operations/menu/page.tsx
  modified: []

key-decisions:
  - "ChannelModifierTable uses POST /menu/channel-modifiers for both create and update (upsert semantics on backend) — no separate PUT needed from frontend"
  - "effectiveBrandId pattern: selectedBrandId || brands[0]?.id avoids useState initialization race with async brands query"
  - "MenuItemForm queries /recipes?status=approved — only approved recipes surfaced; backend enforces same guard returning 400"
  - "Pre-existing TypeScript errors in BomLineRow.tsx and RecipeWizardStep1.tsx (Select null return) are out of scope — logged to deferred items"

patterns-established:
  - "FoodCostBadge: standalone presentational component, accepts computed percent directly"
  - "MenuCategorySection: compound component — section header manages expand/collapse, delegates all CRUD callbacks upward"
  - "Inline row editing in table: local editingRow + editState, commits on Save button click"

requirements-completed: [RECIPE-07]

duration: 6min
completed: 2026-03-21
---

# Phase 07 Plan 06: Menu Management UI Summary

**Brand-tabbed menu management page with food cost % color coding, availability toggle, approved-recipe-only item form, and inline-editable channel modifier table**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-21T10:44:43Z
- **Completed:** 2026-03-21T10:50:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- FoodCostBadge with green (<30%), amber (30-40%), red (>40%) thresholds per UI-SPEC
- Full menu page with brand tabs, collapsible category sections, item cards grid
- MenuItemForm filtering only approved recipes, with live food cost % calculation as user types base price
- ChannelModifierTable with inline row editing for all 3 channel types; shows "Not set" for missing modifiers
- Availability toggle fires immediate PATCH with revert-on-error pattern and 500ms spinner

## Task Commits

1. **Task 1: FoodCostBadge, MenuItemCard, MenuItemForm, MenuCategorySection, ChannelModifierTable** - `0eaf098` (feat)
2. **Task 2: Menu page with brand tabs, category management, channel modifiers** - `62dbab1` (feat)

## Files Created/Modified

- `frontend/components/ops/operations/menu/FoodCostBadge.tsx` - Color-coded food cost % badge (null-safe, 3 color thresholds)
- `frontend/components/ops/operations/menu/MenuItemCard.tsx` - MagicCard item card with availability toggle, spinner, FoodCostBadge
- `frontend/components/ops/operations/menu/MenuItemForm.tsx` - Sheet form with approved-recipe Select, live cost % via useMemo
- `frontend/components/ops/operations/menu/MenuCategorySection.tsx` - Collapsible section with item grid, admin CRUD actions
- `frontend/components/ops/operations/menu/ChannelModifierTable.tsx` - Table with inline row editing (editingRow state), 3 fixed channels
- `frontend/app/(ops)/operations/menu/page.tsx` - Full menu page: brand tabs, category CRUD, item CRUD, channel modifiers

## Decisions Made

- **ChannelModifierTable uses POST (upsert)**: Backend handles create-or-update by channel_type. No separate PUT needed from frontend, simplifies form state.
- **effectiveBrandId pattern**: `selectedBrandId || brands[0]?.id || ''` handles async brands loading without needing useEffect to set default.
- **Approved recipes only in MenuItemForm**: Query uses `/recipes?status=approved` — matches backend guard. Empty-state message tells user to approve a recipe first.
- **ChannelModifier inline editing**: Row-level local state (editingRow + editState) — no optimistic update, commit on explicit Save click, cancel restores display values.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `BomLineRow.tsx` and `RecipeWizardStep1.tsx` (base-ui Select `onValueChange` returning `string | null` not assignable to `string`) — these are out of scope for this plan and were not introduced by this work. Logged for deferred resolution.

## Known Stubs

None. All data flows are wired to real API calls via apiClient.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Menu management UI complete; /operations/menu is functional end-to-end pending backend being live
- Phase 07-05 (recipe wizard) and Phase 07-06 (menu UI) complete the recipe-ingredient-management frontend
- Ready for Phase 08 or ordering/pricing phases that depend on menu item data

---
*Phase: 07-recipe-ingredient-management*
*Completed: 2026-03-21*
