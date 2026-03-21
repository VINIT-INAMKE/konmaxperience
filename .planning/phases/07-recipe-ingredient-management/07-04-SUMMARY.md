---
phase: 07-recipe-ingredient-management
plan: 04
subsystem: ui
tags: [react, nextjs, tanstack-query, shadcn, lucide-react, ingredients, vendors]

# Dependency graph
requires:
  - phase: 07-01
    provides: frontend types for Ingredient, Vendor, VendorPrice
  - phase: 07-02
    provides: backend API endpoints for ingredients and vendors

provides:
  - Sidebar updated with 4 new Operations nav items (Recipes, Ingredients, Vendors, Menu)
  - /operations/ingredients page with category tab filter, search, table, Sheet form, delete Dialog
  - /operations/vendors page with table, VendorDetail Sheet, price history, VendorPriceForm
affects:
  - 07-03
  - 07-05
  - 07-06

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Table-based list pages (vs card grid for brands) for data-dense views
    - VendorDetail Sheet with nested VendorPriceForm sub-sheet pattern
    - Collapsible ingredient groups in vendor detail using local expandedIngredients Set state

key-files:
  created:
    - frontend/components/ops/operations/ingredients/IngredientRow.tsx
    - frontend/components/ops/operations/ingredients/IngredientForm.tsx
    - frontend/app/(ops)/operations/ingredients/page.tsx
    - frontend/components/ops/operations/vendors/VendorCard.tsx
    - frontend/components/ops/operations/vendors/VendorForm.tsx
    - frontend/components/ops/operations/vendors/VendorDetail.tsx
    - frontend/components/ops/operations/vendors/VendorPriceHistory.tsx
    - frontend/components/ops/operations/vendors/VendorPriceForm.tsx
    - frontend/app/(ops)/operations/vendors/page.tsx
  modified:
    - frontend/components/ops/Sidebar.tsx

key-decisions:
  - "VendorCard is a table row component (not a card) — UI-SPEC specifies vendors as a table, not a card grid"
  - "VendorDetail Sheet uses expandable ingredient sections (Set<string> state) rather than permanent expansion to keep panel compact"
  - "VendorPriceForm uses Select for ingredient instead of Combobox — simpler for MVP, Combobox can be added when ingredient list grows large"
  - "onValueChange typed fix: Select in base-ui returns string | null, so use (v) => setState(v ?? '') wrapper"

patterns-established:
  - "Table row components: table row with border-b hover:bg-muted/30 for consistent table styling"
  - "Category badge colors: consistent muted hues per category using bg-{color}-500/15 text-{color}-400 without semantic meaning"
  - "Nested Sheet pattern: VendorDetail opens VendorPriceForm as second Sheet layer — both use side=right"

requirements-completed:
  - RECIPE-03
  - RECIPE-05

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 07 Plan 04: Sidebar + Ingredients + Vendors UI Summary

**Sidebar updated with 4 new ops nav items, /operations/ingredients table page with category filter, and /operations/vendors page with detail Sheet showing grouped price history per ingredient**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T10:35:43Z
- **Completed:** 2026-03-21T10:41:12Z
- **Tasks:** 2
- **Files modified:** 10 (1 modified, 9 created)

## Accomplishments
- Sidebar shows 8 Operations items: 4 existing + Recipes/Ingredients/Vendors/Menu with correct lucide icons
- Ingredients page: category tab filter (All|Dairy|Vegetable|Spice|Grain|Meat|Oil), search, table rows with colored category badges, Sheet form for create/edit, delete Dialog with UI-SPEC copy
- Vendors page: table with Name/Phone/Email/Payment Terms/Status/Actions, VendorDetail Sheet with grouped price history, VendorPriceForm for adding prices per ingredient, deactivate (no confirmation per Phase 5-04 pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: Sidebar update + Ingredients page** - `d0924c3` (feat)
2. **Task 2: Vendors page with detail Sheet, price history, and price form** - `15ad6c4` (feat)

**Plan metadata:** `(pending)`

## Files Created/Modified
- `frontend/components/ops/Sidebar.tsx` - Added ChefHat, Salad, Truck, UtensilsCrossed imports + 4 new operationsNav items
- `frontend/app/(ops)/operations/ingredients/page.tsx` - Ingredients list page with category tabs, search, table, Sheet, Dialog
- `frontend/components/ops/operations/ingredients/IngredientRow.tsx` - Table row with category badge and Pencil/Trash2 actions
- `frontend/components/ops/operations/ingredients/IngredientForm.tsx` - Sheet form: Name, Category Select, Base Unit Select, Min Stock Level
- `frontend/app/(ops)/operations/vendors/page.tsx` - Vendors list page with table, VendorDetail, VendorForm, deactivate
- `frontend/components/ops/operations/vendors/VendorCard.tsx` - Table row with Eye/Pencil/PowerOff actions
- `frontend/components/ops/operations/vendors/VendorForm.tsx` - Sheet form: Name, Phone, Email, Address Textarea, Payment Terms Select
- `frontend/components/ops/operations/vendors/VendorDetail.tsx` - Detail Sheet with vendor info + grouped expandable ingredient price sections
- `frontend/components/ops/operations/vendors/VendorPriceHistory.tsx` - Sorted price list with current price accent border-left highlight
- `frontend/components/ops/operations/vendors/VendorPriceForm.tsx` - Price form: Ingredient Select, INR-prefixed price Input, effective_date Input

## Decisions Made
- VendorCard is actually a table row component — named VendorCard per PLAN spec but implements `<tr>` per UI-SPEC table layout
- VendorPriceForm uses Select for ingredient (not Combobox) — adequate for MVP, ingredient count expected to be small
- base-ui Select `onValueChange` returns `string | null`, added `(v) => setIngredientId(v ?? '')` wrapper (auto-fixed Rule 1)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] base-ui Select onValueChange null type mismatch in VendorPriceForm**
- **Found during:** Task 2 (VendorPriceForm TypeScript compilation)
- **Issue:** `setIngredientId` expects `string` but `onValueChange` passes `string | null` — TypeScript error TS2322
- **Fix:** Wrapped setter: `onValueChange={(v) => setIngredientId(v ?? '')}`
- **Files modified:** frontend/components/ops/operations/vendors/VendorPriceForm.tsx
- **Verification:** `tsc --noEmit` passes with no errors
- **Committed in:** 15ad6c4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 type bug)
**Impact on plan:** Minimal fix — base-ui Select returns nullable string, pattern fix needed.

## Issues Encountered
None beyond the auto-fixed TypeScript type error.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ingredients and Vendors UI is complete and ready for use
- /operations/recipes page (07-03 backend, 07-05 frontend) can now link to ingredient data
- VendorPriceForm is wired to POST /vendors/prices — requires 07-02 backend to be deployed

---
*Phase: 07-recipe-ingredient-management*
*Completed: 2026-03-21*

## Self-Check: PASSED

All files present and both task commits verified in git log.
