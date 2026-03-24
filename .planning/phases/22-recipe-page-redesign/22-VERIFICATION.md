---
phase: 22-recipe-page-redesign
verified: 2026-03-24T12:45:00Z
status: passed
score: 13/13 must-haves verified
human_verification:
  - test: "Navigate to /operations/recipes/new and confirm empty builder renders with editable name, metadata grid, BOM table, and cost panel"
    expected: "Two-column layout with large editable recipe name, inline metadata fields, empty BOM table with ghost row and Add Line button, sticky cost panel on right"
    why_human: "Visual layout and interaction quality cannot be verified programmatically"
  - test: "Open an existing draft recipe, add a BOM line with a priced ingredient, and watch the cost panel"
    expected: "Per-line cost appears in amber dash when no price, cost panel updates immediately (client estimate), then switches to green Confirmed badge after ~3 seconds"
    why_human: "Animated transitions, timing of estimate-to-confirmed badge, and live update behavior require browser interaction"
  - test: "Drag a BOM row by its grip handle and verify reordering"
    expected: "Drag activates only on the grip icon (not anywhere in the row), row reorders smoothly, sort_order reflects new position on save"
    why_human: "dnd-kit drag interaction requires browser mouse events to test"
  - test: "As FOUNDER_ADMIN, open a pending recipe and verify Approve/Reject buttons appear; as non-admin verify only status text shows"
    expected: "Role-gated buttons show only for FOUNDER_ADMIN; reject opens confirmation dialog; approval changes status banner color to green"
    why_human: "Role-gated UI and dialog flows require browser interaction with different user sessions"
  - test: "Click Create New Version on an approved recipe and confirm navigation to new draft"
    expected: "Confirmation dialog opens, accepting archives original, creates draft clone with all BOM lines, navigates to new recipe page at /operations/recipes/[new-id]"
    why_human: "Multi-step flow with navigation requires browser interaction"
---

# Phase 22: Recipe Page Redesign Verification Report

**Phase Goal:** Replace the sidebar recipe wizard with a dedicated full-page recipe builder — proper BOM table editing, live cost preview, inline approval workflow, and better UX for complex multi-ingredient recipes
**Verified:** 2026-03-24T12:45:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | PATCH /recipes/:id with status=pending succeeds for a draft recipe | VERIFIED | `ALLOWED_TRANSITIONS` map in `recipes.service.ts` line 198 allows `draft -> pending` |
| 2 | PATCH /recipes/:id with status=approved for pending recipe succeeds | VERIFIED | `pending: ['approved', 'draft']` in ALLOWED_TRANSITIONS at line 200 |
| 3 | PATCH /recipes/:id with status=draft for an approved recipe returns 400 | VERIFIED | `approved: ['archived']` only transition; ALLOWED_TRANSITIONS check throws BadRequestException |
| 4 | POST /recipes/:id/version archives the original and returns a new draft clone with copied BOM lines | VERIFIED | `createNewVersion` method in `recipes.service.ts` line 294; uses `$transaction` to archive then clone `RecipeLines` |
| 5 | POST /recipes/:id/cost-preview returns cost, complete, and missingPrices without modifying the database | VERIFIED | `calculateCostPreview` method at line 350; in-memory calculation only, no DB writes |
| 6 | GET /recipes/cost-data returns vendorPrices array and unitConversions array | VERIFIED | `getCostData` method at line 443; `@Get('cost-data')` at controller line 34, placed BEFORE `@Get(':id')` at line 39 |
| 7 | Navigating to /recipes/new renders an empty recipe builder page | VERIFIED | `frontend/app/(ops)/operations/recipes/new/page.tsx` renders `<RecipeBuilderPage />` with no recipeId |
| 8 | Navigating to /recipes/[id] renders the builder loaded with recipe data | VERIFIED | `frontend/app/(ops)/operations/recipes/[id]/page.tsx` renders `<RecipeBuilderPage recipeId={id} />` |
| 9 | Recipe name is a large editable text field with document-editing feel | VERIFIED | `RecipeBuilderPage.tsx` line 493 has `text-[28px] font-semibold` input with transparent border on rest, visible on focus |
| 10 | Metadata fields are inline-editable in a compact grid | VERIFIED | `RecipeMetaGrid.tsx` with `isLocked` prop, all fields use transparent-border pattern |
| 11 | Amber dot and "Unsaved changes" text appear when isDirty is true | VERIFIED | `RecipeBuilderPage.tsx` line 471-474: `{isDirty && <span className="size-2 rounded-full bg-amber-500" />} Unsaved changes` |
| 12 | Browser beforeunload dialog fires when navigating away with unsaved changes | VERIFIED | `RecipeBuilderPage.tsx` lines 258-265: `beforeunload` event handler gated on `isDirty` |
| 13 | BOM table rows can be reordered by dragging the grip handle | VERIFIED | `RecipeBomTable.tsx` has `DndContext`, `SortableContext`, `arrayMove`; `BomTableRow.tsx` uses `useSortable` with `setActivatorNodeRef` on grip button only |
| 14 | Ghost row at bottom creates a new BOM line on interaction | VERIFIED | `RecipeBomTable.tsx` lines 163-167: ghost line rendered; `handleActivateGhost` pushes it to lines array |
| 15 | Add Line button below the table adds a new empty row | VERIFIED | `RecipeBomTable.tsx` line 279: `<Plus /> Add Line` button calls `addNewLine` |
| 16 | Sub-recipe rows show a chevron that expands to show nested ingredients | VERIFIED | `BomTableRow.tsx` line 182: `ChevronRight`/`ChevronDown` toggle; renders `<RecipeDependencyTree>` when expanded |
| 17 | Per-line cost column shows currency amount or amber dash | VERIFIED | `BomTableRow.tsx` renders `₹ ${lineCost.toFixed(2)}` or `—` with `text-amber-500`; `calcLineCost` exported from `RecipeBomTable.tsx` |
| 18 | Cost panel shows batch cost, per-portion cost, and food cost % with animated transitions | VERIFIED | `RecipeCostPanel.tsx` has Batch Cost, Per Portion sections with `AnimatedCost`; food cost % gated on `menuItemPrice !== null` (correctly hidden when not linked) |
| 19 | CostEstimateBadge shows estimated (amber) or confirmed (green) | VERIFIED | `CostEstimateBadge.tsx` line 21: `isEstimate ? 'Estimated' : 'Confirmed'` with correct color classes |
| 20 | Missing-price ingredients are listed by name in the cost panel | VERIFIED | `RecipeCostPanel.tsx` lines 82-90: renders `missingPrices.map((name) => <li>{name}</li>)` with amber warning |
| 21 | 3-second debounced server cost confirmation replaces client estimate | VERIFIED | `RecipeBuilderPage.tsx` line 172: `scheduleServerCostConfirm` with `setTimeout(..., 3000)` and `costIsEstimate` state |
| 22 | Draft recipe shows Submit for Approval in status banner | VERIFIED | `RecipeStatusBanner.tsx` line 67: `Submit for Approval` button shown when `status === 'draft'` |
| 23 | Pending recipe shows Approve/Reject buttons for FOUNDER_ADMIN only | VERIFIED | `RecipeStatusBanner.tsx` line 73: `{status === 'pending' && isApprover && ...}` gates both buttons |
| 24 | Approved recipe shows Create New Version and Archive buttons | VERIFIED | `RecipeStatusBanner.tsx` lines 100-109: both buttons shown when `status === 'approved'` |
| 25 | Reject opens confirmation dialog then sends recipe back to draft | VERIFIED | `RecipeStatusBanner.tsx` line 120: dialog with "Send back to draft?" title; line 136: `onStatusChange('draft')` |
| 26 | Create New Version archives current and navigates to new draft | VERIFIED | `RecipeBuilderPage.tsx` line 337: `versionMutation` calls `POST /recipes/${recipeId}/version`; `router.push` to new recipe id |
| 27 | Recipe list page Create button navigates to /recipes/new via Link | VERIFIED | `page.tsx` line 99: `<Link href="/operations/recipes/new">` |
| 28 | Recipe card click navigates to /recipes/[id] via Link | VERIFIED | `RecipeCard.tsx` line 25: `<Link href={\`/operations/recipes/${recipe.id}\`}>` wraps entire card |
| 29 | Sidebar wizard (RecipeWizard) is no longer rendered on list or detail page | VERIFIED | grep across `frontend/app/` and `RecipeBuilderPage.tsx` returns zero results for `RecipeWizard` import |
| 30 | Approved recipes are fully locked (read-only) on the frontend | VERIFIED | `RecipeBuilderPage.tsx` line 54: `const isLocked = status === 'approved' || status === 'archived'`; passed to all form fields |
| 31 | Approved recipes reject data edits on the backend | VERIFIED | `recipes.service.ts` lines 187-194: throws `BadRequestException` when any key besides `status` is present in dto for approved recipe |

**Score:** 31/31 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/recipes/dto/update-recipe.dto.ts` | pending in @IsIn validator | VERIFIED | Line 65: `@IsIn(['draft', 'pending', 'approved', 'archived'])` |
| `backend/src/recipes/recipes.service.ts` | createNewVersion, calculateCostPreview, getCostData methods | VERIFIED | Lines 294, 350, 443 respectively |
| `backend/src/recipes/recipes.controller.ts` | POST version, POST cost-preview, GET cost-data endpoints | VERIFIED | Lines 66, 76, 34 respectively; cost-data before :id at lines 34 vs 39 |
| `backend/src/recipes/dto/cost-preview.dto.ts` | CostPreviewDto with bom_lines | VERIFIED | Line 5: `export class CostPreviewDto`; line 9: `bom_lines!: BomLineDto[]` |
| `frontend/lib/types/recipe.ts` | RecipeStatus with pending, BomLineState, CostData, CostPreviewResponse | VERIFIED | Lines 1, 60, 71, 76 |
| `frontend/components/ops/operations/recipes/RecipeStatusBadge.tsx` | pending in amber | VERIFIED | Line 15: `pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'` |
| `frontend/app/(ops)/operations/recipes/new/page.tsx` | Empty builder route | VERIFIED | Renders `<RecipeBuilderPage />` with no props |
| `frontend/app/(ops)/operations/recipes/[id]/page.tsx` | Loaded builder route | VERIFIED | Renders `<RecipeBuilderPage recipeId={id} />`; no RecipeWizard |
| `frontend/components/ops/operations/recipes/RecipeBuilderPage.tsx` | Two-column layout, state management, save mutation, unsaved guard | VERIFIED | Lines 404, 414, 461, 258-265; RecipeBomTable, RecipeCostPanel, RecipeStatusBanner all integrated |
| `frontend/components/ops/operations/recipes/builder/RecipeMetaGrid.tsx` | Inline-editable metadata grid | VERIFIED | `export function RecipeMetaGrid` with `isLocked` prop, all fields disabled when locked |
| `frontend/components/ops/operations/recipes/builder/RecipeBomTable.tsx` | Sortable BOM table with DndContext | VERIFIED | `DndContext`, `SortableContext`, `arrayMove`, `PointerSensor` with `distance: 5`, ghost row, Add Line button, `calcLineCost` |
| `frontend/components/ops/operations/recipes/builder/BomTableRow.tsx` | Sortable row with drag handle | VERIFIED | `useSortable`, `setActivatorNodeRef` on grip button, `GripVertical`, "Drag to reorder" tooltip, `RecipeDependencyTree` for expansion |
| `frontend/components/ops/operations/recipes/builder/RecipeCostPanel.tsx` | Sticky cost panel | VERIFIED | Batch Cost, Per Portion, Food Cost % (conditional on menuItemPrice), missing prices list, `AnimatedCost`, `CostEstimateBadge` |
| `frontend/components/ops/operations/recipes/builder/AnimatedCost.tsx` | Animated number via useMotionValue | VERIFIED | `useMotionValue` + `useSpring`; no `NumberTicker` or `useInView` |
| `frontend/components/ops/operations/recipes/builder/CostEstimateBadge.tsx` | Estimated/Confirmed badge | VERIFIED | Renders "Estimated" (amber) or "Confirmed" (green) |
| `frontend/components/ops/operations/recipes/builder/RecipeStatusBanner.tsx` | Status banner with approval workflow | VERIFIED | Submit for Approval, Approve Recipe, Reject Recipe, Create New Version, Archive Recipe; rejection dialog "Send back to draft?" + "Send Back" |
| `frontend/app/(ops)/operations/recipes/page.tsx` | List page with Link nav, wizard removed | VERIFIED | No RecipeWizard, no wizardOpen state; Link to /recipes/new; pending in status filter |
| `frontend/components/ops/operations/recipes/RecipeCard.tsx` | Card links to builder | VERIFIED | `<Link href={\`/operations/recipes/${recipe.id}\`}>` wraps entire card content |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `recipes.controller.ts` | `recipes.service.ts` | `createNewVersion` + `calculateCostPreview` calls | WIRED | Lines 73, 84 call service methods directly |
| `recipes.service.ts` | `cost-calculator.service.ts` | `calculateRecipeCost` for sub-recipe cost preview | WIRED | Line 402: `this.costCalculatorService.calculateRecipeCost(line.item_id)` |
| `new/page.tsx` | `RecipeBuilderPage.tsx` | renders `<RecipeBuilderPage />` | WIRED | Line 4: `return <RecipeBuilderPage />` |
| `[id]/page.tsx` | `RecipeBuilderPage.tsx` | renders `<RecipeBuilderPage recipeId={id} />` | WIRED | Line 9: `return <RecipeBuilderPage recipeId={id} />` |
| `RecipeBomTable.tsx` | `BomTableRow.tsx` | renders `<BomTableRow>` for each line inside SortableContext | WIRED | Lines 222, 253: `<BomTableRow` inside DndContext/SortableContext |
| `RecipeCostPanel.tsx` | `AnimatedCost.tsx` | renders `<AnimatedCost>` for batch and per-portion costs | WIRED | Lines 41, 54, 71: `<AnimatedCost value={...}` |
| `RecipeBuilderPage.tsx` | `RecipeBomTable.tsx` | `<RecipeBomTable>` replaces BOM placeholder slot | WIRED | Line 541: `<RecipeBomTable ...>` with `cost-data` fetch at line 78 |
| `RecipeStatusBanner.tsx` | `RecipeBuilderPage.tsx` | `onStatusChange` and `onCreateVersion` callbacks | WIRED | Lines 21-22 define props; lines 511-512 in builder wire `statusMutation.mutate` and `versionMutation.mutate` |
| `page.tsx` (list) | `new/page.tsx` | `<Link href="/operations/recipes/new">` | WIRED | Line 99 in list page |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| RECIPE-01 | Plan 01 | `pending` status with enforced transitions: draft->pending, pending->approved, pending->draft (reject), approved->archived | SATISFIED | `ALLOWED_TRANSITIONS` map in `recipes.service.ts`; `@IsIn(['draft', 'pending', 'approved', 'archived'])` in DTO |
| RECIPE-02 | Plan 01 | `POST /recipes/:id/version` archives approved recipe and creates draft clone in $transaction | SATISFIED | `createNewVersion` method with `$transaction` at `recipes.service.ts:294` |
| RECIPE-03 | Plan 01 | `POST /recipes/:id/cost-preview` returns `{cost, complete, missingPrices}` without DB save | SATISFIED | `calculateCostPreview` at `recipes.service.ts:350`; pure in-memory calculation |
| RECIPE-04 | Plan 01 | `GET /recipes/cost-data` returns lowest vendor prices and unit conversions | SATISFIED | `getCostData` at `recipes.service.ts:443`; route correctly placed before `:id` |
| RECIPE-05 | Plan 02 | Full-page builder at `/recipes/new` and `/recipes/[id]` with two-column layout | SATISFIED | Both route pages wired; `grid-cols-[1fr_320px]` layout in `RecipeBuilderPage.tsx` |
| RECIPE-06 | Plan 02 | Inline-editable header — large recipe name field, compact metadata grid | SATISFIED | `text-[28px]` name input; `RecipeMetaGrid` with transparent-border inline fields |
| RECIPE-07 | Plan 03 | BOM table with dnd-kit drag-handle reorder, per-line cost, ghost row, Add Line button, sub-recipe expansion | SATISFIED | All features verified in `RecipeBomTable.tsx` and `BomTableRow.tsx` |
| RECIPE-08 | Plan 03 | Hybrid live cost: client-side instant estimate + 3s debounced server confirmation with badges | SATISFIED | `scheduleServerCostConfirm` with 3000ms timeout; `costIsEstimate` toggle; `CostEstimateBadge` |
| RECIPE-09 | Plan 03 | Sticky cost panel — batch cost, per-portion cost, food cost % (if linked to menu item), animated numbers | SATISFIED | `RecipeCostPanel.tsx` has all sections; food cost % gated on `menuItemPrice !== null` (acceptable — requirement states "if linked") |
| RECIPE-10 | Plan 04 | Status banner with contextual buttons — Submit, Approve/Reject (approver), Create New Version/Archive | SATISFIED | `RecipeStatusBanner.tsx` with full conditional button set per status + role |
| RECIPE-11 | Plan 04 | Approved recipes fully locked (read-only); Create New Version archives and creates draft clone | SATISFIED | `isLocked = status === 'approved' || status === 'archived'` on frontend; backend rejects data edits for approved recipes |
| RECIPE-12 | Plan 02 | Browser `beforeunload` on unsaved changes, amber dot + "Unsaved changes" indicator | SATISFIED | `beforeunload` handler at `RecipeBuilderPage.tsx:258`; amber dot at line 473 |
| RECIPE-13 | Plan 04 | List page Create as Link to /recipes/new, card click as Link to /recipes/[id]; sidebar wizard removed | SATISFIED | Link in `page.tsx:99`; Link in `RecipeCard.tsx:25`; zero RecipeWizard imports outside wizard/ directory |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `RecipeBuilderPage.tsx` | 601 | `menuItemPrice={null}` — food cost % always hidden | Info | Food cost % never displays; RECIPE-09 requires it "if linked to menu item" — the conditional guard is correct, this is a future concern when menu item linking is implemented |

No blocker anti-patterns found. The `menuItemPrice={null}` is a deliberate deferral documented in Plan 04 summary as a known stub, with the UI correctly hiding the food cost % section when null. RECIPE-09 explicitly qualifies the feature as "if linked to menu item", so this is not a gap.

### Human Verification Required

#### 1. Builder Page Visual Layout

**Test:** Navigate to `/operations/recipes/new`
**Expected:** Two-column layout renders — large editable recipe name, compact metadata grid, BOM table with ghost row and "+ Add Line" button, sticky cost panel on the right with "Cost unavailable" empty state
**Why human:** Visual layout quality and responsive behavior require browser inspection

#### 2. Live Cost Update Flow

**Test:** Open an existing draft recipe, add a BOM line with a priced ingredient, observe cost panel
**Expected:** Per-line cost appears instantly (client estimate), cost panel shows amber "Estimated" badge and a batch cost figure; after ~3 seconds the badge switches to green "Confirmed" and the cost number may update slightly
**Why human:** Timing of the debounced server confirmation and animated number transitions require browser interaction

#### 3. Drag-and-Drop BOM Reordering

**Test:** Open a recipe with multiple BOM lines, grab the grip handle icon on a row, drag to reorder
**Expected:** Drag activates only on the grip icon (clicking anywhere else in the row should not drag); row reorders smoothly with a semi-transparent drag overlay; save reflects new sort order
**Why human:** dnd-kit pointer events require browser mouse interaction; the `distance: 5` activation constraint prevents accidental drag but needs human validation

#### 4. Approval Workflow Role Gates

**Test (as FOUNDER_ADMIN):** Open a pending recipe — verify Approve and Reject buttons appear. Click Reject — confirm dialog appears with "Send back to draft?" title and "Send Back" button. Confirm sends recipe back to draft with toast.
**Test (as non-admin):** Open same pending recipe — verify only status text shows, no approve/reject buttons.
**Expected:** Role gate correctly isolates approval actions to FOUNDER_ADMIN
**Why human:** Role-gated UI behavior requires testing with multiple user sessions

#### 5. Create New Version End-to-End

**Test:** On an approved recipe, click "Create New Version" — confirm dialog appears. Accept it.
**Expected:** Current recipe gets archived (visible in list with archived status), new draft recipe appears at a new URL with all BOM lines copied, page navigates to the new draft
**Why human:** Multi-step flow with navigation and database state change requires browser interaction

### Gaps Summary

No gaps were found. All 13 requirements are satisfied. All 17 artifacts exist and are substantive. All 9 key links are wired. All 4 commits documented in summaries are confirmed in git log (07b0b00, 166f0f4, 901ce5e, f384c5e).

The only notable non-blocker is `menuItemPrice={null}` in RecipeBuilderPage, which correctly hides the food cost % section. RECIPE-09 qualifies this feature with "if linked to menu item" — so the behavior is intentional and correct. A future phase that links recipes to menu items will populate this field.

---

_Verified: 2026-03-24T12:45:00Z_
_Verifier: Claude (gsd-verifier)_
