# Phase 22: Recipe Page Redesign - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the sidebar recipe wizard with a dedicated full-page recipe builder. Proper BOM table editing, live cost preview, inline approval workflow, and better UX for complex multi-ingredient recipes. The recipe list page (card grid) is NOT being redesigned — only the create/edit experience and detail view.

</domain>

<decisions>
## Implementation Decisions

### Page layout and editing model
- **D-01:** Single scrollable page with two-column layout — main content (left, ~70%) scrolls, cost panel (right, ~30%) is sticky
- **D-02:** Dedicated routes: `/recipes/new` (empty builder), `/recipes/[id]` (loaded builder). List page "Create" button becomes a `<Link>`. Current `/recipes/[id]/edit` alias also supported. The sidebar wizard (`RecipeWizard.tsx`) and its 3 step components are removed entirely
- **D-03:** Inline-editable header — recipe name as a large editable text field at the top, metadata (brand, zone, yield qty/unit, portion size, shelf life, description) as compact inline fields in a grid below. Document-editing feel, not a form
- **D-04:** Browser `beforeunload` dialog on navigation with unsaved changes. Amber dot + "Unsaved changes" text in the page header next to the Save button. No custom discard modal

### BOM table experience
- **D-05:** Drag-handle reordering on each row using `dnd-kit`. Grip handle (`GripVertical` icon) on the left column of each row
- **D-06:** Per-line cost column in the BOM table. Ingredient lines show `₹ X.XX` from vendor price calculation. Sub-recipe lines show cost derived from `computed_cost / yield_qty * quantity`. Lines without vendor prices show `—` with subtle amber text
- **D-07:** Both a persistent empty row at the bottom of the table (start typing to search) AND an explicit "+ Add Line" button below it for discoverability
- **D-08:** Sub-recipe BOM lines are expandable inline — chevron icon on the row, expanding shows the sub-recipe's ingredients indented below (read-only, tree view). Uses the same nesting logic as the existing `RecipeDependencyTree` component

### Live cost preview
- **D-09:** Hybrid cost calculation — client-side instant estimate as user edits (using pre-fetched vendor prices and sub-recipe computed costs), plus server-side recalculation on a 3-second debounce to correct unit conversion edge cases. Client shows estimate immediately; server response replaces it with authoritative value. Subtle "estimated" badge until server confirms
- **D-10:** Partial costs displayed with `(partial)` label. Missing-price lines listed by name in the cost panel with amber warning icon. Call-to-action: "X ingredients missing prices"
- **D-11:** Cost panel shows three metrics: (1) total batch cost, (2) per-portion cost (batch cost / yield in portions), (3) food cost % if the recipe is linked to a menu item (recipe cost / selling price). Per-portion requires knowing portion count from yield

### Inline approval workflow
- **D-12:** Colored status banner below the page header with contextual action buttons. Draft → `[Submit for Approval]`, Pending → `[Approve] [Reject]` (for approvers only), Approved → `[Create New Version] [Archive]`. No status dropdown anywhere
- **D-13:** New `pending` status added to the schema. Full flow: `draft → pending → approved → archived`. Reject sends back to `draft`. The existing backend rule "cannot revert approved to draft" stays — editing an approved recipe requires "Create New Version" which archives the current and creates a draft clone
- **D-14:** Approved recipes are locked (all fields read-only). "Create New Version" button archives the current recipe and creates a new draft clone with the same data. This preserves the approved version in history while allowing iteration

### Claude's Discretion
- Exact dnd-kit configuration and animation details
- Cost panel visual design and number formatting
- Empty state design for new recipe builder
- Loading skeleton design
- Keyboard shortcuts for common actions (if any)
- How the "estimated" vs "confirmed" cost badge looks
- Error state handling for failed saves

</decisions>

<specifics>
## Specific Ideas

- Cost panel should feel like a live dashboard widget — numbers update smoothly as you type quantities
- BOM table should feel like a spreadsheet, not a form — Tab key between cells, inline editing without modal popups
- The "Create New Version" pattern for approved recipes mirrors how recipe versioning works in professional kitchen management software
- Status banner colors: draft = neutral/gray, pending = amber/yellow, approved = green, archived = muted

</specifics>

<canonical_refs>
## Canonical References

### Recipe data model
- `backend/prisma/schema.prisma` lines 368-394 — Recipe and RecipeLine models, status field, BOM structure
- `backend/src/recipes/recipes.service.ts` — CRUD operations, cycle detection, status transition validation
- `backend/src/recipes/cost-calculator.service.ts` — Server-side cost calculation with BFS propagation

### Current frontend (to be replaced)
- `frontend/app/(ops)/operations/recipes/page.tsx` — Recipe list page (KEEP, update Create button to link)
- `frontend/app/(ops)/operations/recipes/[id]/page.tsx` — Current detail page (REPLACE with builder)
- `frontend/components/ops/operations/recipes/wizard/RecipeWizard.tsx` — Current sidebar wizard (REMOVE)
- `frontend/components/ops/operations/recipes/wizard/BomLineRow.tsx` — Current BOM line component (REPLACE)
- `frontend/components/ops/operations/recipes/RecipeDependencyTree.tsx` — Nested BOM tree view (REUSE for inline expansion)

### Governance (approval rules)
- `.planning/PROJECT.md` lines 99-102 — Approval gates: food = Sadhana+Anchitha

### Existing patterns
- `frontend/components/ops/operations/recipes/RecipeCard.tsx` — Recipe card on list page (KEEP)
- `backend/src/recipes/dto/create-recipe.dto.ts` — Current DTO with BomLineDto
- `backend/src/common/utils/unit-conversion.ts` — Unit conversion logic needed for client-side cost calc

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RecipeDependencyTree` component: Already renders nested BOM as a tree — reuse for inline sub-recipe expansion in the BOM table
- `NumberTicker` component: Already used for cost display — reuse in the sticky cost panel
- `RecipeStatusBadge` component: Maps status to colored badges — extend for the new `pending` status
- `Combobox` component: Already used in BomLineRow for ingredient/recipe search — reuse in the new table
- `CostCalculatorService`: Server-side cost calculation with cycle detection — becomes the "server confirm" half of the hybrid approach

### Established Patterns
- `useQuery` with React Query for data fetching — all recipe pages use this pattern
- `apiClient.patch` for updates — matches existing mutation pattern
- `beforeunload` pattern: Not currently used in the app (wizard uses a custom dialog) — this is a new pattern
- `dnd-kit`: Not currently in the project — will need to be added as a dependency

### Integration Points
- Recipe list page: "Create" button changes from wizard-opening onClick to `<Link href="/recipes/new">`
- Recipe list page: "Edit" button on RecipeCard changes to `<Link href="/recipes/[id]">`
- Backend: New `pending` status requires schema migration + DTO update + status transition validation update
- Backend: Optional new endpoint for cost preview (debounced server calculation)
- Backend: New "clone recipe" endpoint or service method for "Create New Version"
- Menu item form: Currently links recipes — food cost % needs the menu item's selling price fetched

</code_context>

<deferred>
## Deferred Ideas

- Recipe version history / changelog — track all versions with diffs (future phase)
- Approval comments / rejection reason text field — would enhance the approval flow but adds scope
- Recipe image upload via R2 (currently just a URL field) — separate concern
- Recipe templates / "create from template" — future feature
- Batch scaling calculator ("double this recipe") — future feature

</deferred>

---

*Phase: 22-recipe-page-redesign*
*Context gathered: 2026-03-24*
