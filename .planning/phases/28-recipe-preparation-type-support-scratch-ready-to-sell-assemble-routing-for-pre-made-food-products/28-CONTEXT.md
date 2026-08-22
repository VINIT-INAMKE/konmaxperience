# Phase 28: Recipe preparation_type — multi-fulfillment food product support - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `preparation_type` field to Recipe (scratch | batch_prepared | ready_to_sell | assemble) and `usage_type` field to Ingredient (recipe_input | supply | equipment). Fork availability calculation, deduction timing, and fulfillment routing by type. Build Pick & Pack page for non-scratch items. Build Supply Usage page for disposable supply logging. Add IngredientCategory model for hybrid managed categories. All existing scratch recipes continue to work unchanged.

</domain>

<decisions>
## Implementation Decisions

### Recipe preparation_type
- **D-01:** Four preparation types: `scratch` (default), `batch_prepared`, `ready_to_sell`, `assemble`. Field on Recipe model, default scratch. All existing recipes auto-migrate as scratch.
- **D-02:** Batch-prepared out-of-stock behavior: item shows "out of stock" when no active prep batches exist. NO fallback to ingredient stock availability. Staff must create a new prep batch first.
- **D-03:** Availability calculation forks by type:
  - `scratch` — `floor(ingredient_stock / BOM_per_serving)` (current behavior, unchanged)
  - `batch_prepared` — `sum(active PrepBatch.quantity_remaining)` for that recipe. Zero batches = zero availability.
  - `ready_to_sell` — `floor(ingredient_stock / BOM_per_serving)` (BOM has single line: 1 piece of the ingredient = 1 serving)
  - `assemble` — `min(availability of each component)` where each component uses its own recipe's preparation_type logic recursively
- **D-04:** Deduction timing forks: scratch deducts at KDS "ready" (current behavior). Non-scratch (batch_prepared, ready_to_sell, assemble) deducts at order confirmation — prevents double-selling the last item.
- **D-05:** Order items for non-scratch types auto-set to `status: 'ready'` on creation. They don't need kitchen preparation.

### Fulfillment routing
- **D-06:** KDS filters to scratch items only. `zone_id IS NOT NULL` AND `menuItem.recipe.preparation_type = 'scratch'`. Kitchen staff only sees items that need cooking.
- **D-07:** New "Pick & Pack" page under Kitchen section in sidebar. Separate from KDS. Shows non-scratch order items (batch_prepared, ready_to_sell, assemble) that need physical picking from shelves/storage.
- **D-08:** Assemble items show on Pick & Pack with a component checklist. Each sub-recipe component is a checkbox line. Staff picks each component, checks it off, then marks the item complete. No KDS involvement for assembly.
- **D-09:** Mixed orders (scratch + non-scratch items) route correctly: scratch items go to KDS, non-scratch items go to Pick & Pack. Order status transitions to "ready" only when ALL items across both queues are ready.
- **D-10:** Batch-prepared FIFO: when deducting from prep batches at order confirmation, consume from the batch expiring soonest first (existing FIFO pattern in PrepBatch service).

### Ingredient usage_type
- **D-11:** Three usage types on Ingredient model: `recipe_input` (default, current behavior), `supply` (disposable — gloves, parchment paper, cling wrap), `equipment` (reusable — moulds, pans, spatulas). All existing ingredients auto-migrate as recipe_input.
- **D-12:** Supplies (`supply`): tracked by count via IngredientStock. Use full procurement pipeline (PO, VendorPrice, low stock alerts). Manual end-of-day usage logging only — no auto-deduction from recipes or orders. New StockMovement `movement_type: 'supply_usage'`.
- **D-13:** Equipment (`equipment`): tracked by count via IngredientStock. Use full procurement pipeline. No usage logging — just a count of how many you own. Manual stock adjustment when something breaks/is lost (`movement_type: 'adjustment'`, existing).
- **D-14:** Supplies and equipment excluded from recipe BOM lookups — they never appear as recipe line options. Excluded from menu availability calculations.
- **D-15:** New "Supply Usage" page under Kitchen section in sidebar. Separate from Waste Log. Two-column layout: usage history table + log form (same UI pattern as waste log). End-of-day logging: select supply, quantity used, optional notes.

### Ingredient categories
- **D-16:** New `IngredientCategory` model: `id`, `name` (unique), `sort_order`, `is_default` (boolean — seeded categories can't be deleted). Replaces the hardcoded `category` string on Ingredient with a FK to IngredientCategory.
- **D-17:** Seed 25-30 categories covering real kitchen needs: Dairy, Vegetables, Fruits, Herbs (fresh), Spices (dried), Flours & Starches, Sugars & Sweeteners, Leaveners, Nuts & Seeds, Oils & Fats, Proteins (meat), Seafood, Eggs, Chocolates & Cocoa, Extracts & Essences, Grains & Cereals, Legumes & Pulses, Condiments & Sauces, Vinegars, Beverages, Baking Supplies, Frozen, Canned & Preserved, Packaging (for disposable supplies), Equipment (for reusable items).
- **D-18:** Admin can add custom categories via a simple settings page (or section on existing Ingredients page). Seeded categories have `is_default: true` and cannot be deleted.

### Recipe form
- **D-19:** Recipe create/edit form gets a `preparation_type` selector near the top (after name, before description). Radio group or segmented control with labels: "Fresh Preparation" (scratch), "Ready to Sell" (ready_to_sell), "Batch Prepared" (batch_prepared), "Assembly" (assemble). Default: scratch.
- **D-20:** When preparation_type is `ready_to_sell`, the form can simplify: prep_steps and cooking_method become optional (a pickle jar doesn't have cooking steps). BOM still required (to track what's being sold and its cost).

### Ingredient form
- **D-21:** Ingredient create/edit form gets a `usage_type` selector: "Recipe Ingredient" (recipe_input), "Disposable Supply" (supply), "Reusable Equipment" (equipment). Default: recipe_input.
- **D-22:** Category dropdown switches from hardcoded list to database-driven IngredientCategory lookup.

### Claude's Discretion
- Pick & Pack page layout and interaction details (card style, sorting, grouping by order)
- Component checklist visual design for assemble items
- Supply Usage page layout details
- Category management UI placement (standalone settings section vs. inline on ingredients page)
- Migration strategy for converting existing `category` string values to IngredientCategory FK references

</decisions>

<specifics>
## Specific Ideas

- Pre-made items (pickles, packaged goods) use the existing Recipe + RecipeLine + Ingredient pipeline — they just have a simpler BOM (1 piece of the ingredient = 1 serving) and skip the kitchen
- Gift boxes / thalis use the existing sub-recipe system (RecipeLine with `input_type: 'recipe'`) — each component is a reference to another recipe, and the system deducts from each component's own stock/batch source
- Supply Usage page follows the exact same two-column pattern as the Waste Log page — history table left, log form right
- Pick & Pack page is conceptually similar to KDS but without the cooking workflow — just pick, check off, mark done

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above and in the ROADMAP.md phase description.

### Codebase references (downstream agents MUST read)
- `backend/prisma/schema.prisma` — Recipe model (lines 369-395), Ingredient model (lines 415-429), OrderItem model, PrepBatch model, StockMovement model
- `backend/src/menu/menu.service.ts` — `computeServings` (lines 248-347) and `getAllServingsAvailable` (lines 371-447) — the availability logic to fork
- `backend/src/kitchen/kds/kds.service.ts` — `getActiveOrders` (lines 44-95) — the KDS filter to modify
- `backend/src/orders/orders.service.ts` — `createOrder` (lines 44-131) and `deductItemIngredients` (lines 614-763) — order creation and deduction logic to fork
- `backend/src/customer-orders/customer-orders.service.ts` — `confirmOrder` (lines 287-415) — customer order flow to add non-scratch deduction
- `backend/src/kitchen/prep-batches/prep-batches.service.ts` — FIFO deduction pattern to reuse
- `backend/src/kitchen/waste/waste.service.ts` — two-column UI pattern to replicate for Supply Usage
- `frontend/components/ops/operations/recipes/builder/RecipeMetaGrid.tsx` — recipe form to add preparation_type
- `frontend/components/ops/operations/ingredients/IngredientForm.tsx` — ingredient form to add usage_type
- `frontend/lib/types/ingredient.ts` — INGREDIENT_CATEGORIES and BASE_UNITS constants to update
- `backend/prisma/seed.ts` — UNIT_CONVERSIONS, category seeds, guide sections to update

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PrepBatch` FIFO deduction in `prep-batches.service.ts` — exact pattern to reuse for batch_prepared order deduction
- Waste Log two-column layout — replicate for Supply Usage page
- KDS card pattern — adapt for Pick & Pack cards
- `convertUnit` utility — already handles all unit conversions needed
- `StockMovement` with `movement_type` string — just add `'supply_usage'` value, no schema change needed

### Established Patterns
- `recipe.RecipeLines` with `input_type: 'ingredient' | 'recipe'` — the polymorphic BOM already supports sub-recipes for assemble type
- `computeServings` already handles both ingredient and sub-recipe lines — fork point is clear
- `zone_id: null` on customer orders already excludes them from KDS — same pattern for non-scratch filtering
- `OrderItem.status` already supports `'pending' | 'preparing' | 'ready'` — auto-setting to `'ready'` for non-scratch items fits naturally

### Integration Points
- `menu.service.ts computeServings` — must branch on `recipe.preparation_type`
- `orders.service.ts createOrder` — must check preparation_type and deduct non-scratch items immediately
- `customer-orders.service.ts confirmOrder` — same deduction logic for non-scratch items
- `kds.service.ts getActiveOrders` — add filter for `preparation_type: 'scratch'`
- `orders.service.ts deductItemIngredients` — already handles the deduction, just needs to be callable from order creation path (not just KDS)
- Sidebar navigation — add "Pick & Pack" and "Supply Usage" under Kitchen section

</code_context>

<deferred>
## Deferred Ideas

- Non-food marketplace items (art, merchandise, lifestyle products) — separate phase when v2 begins
- Per-channel item availability (some items only available for takeaway) — future enhancement
- Disposable supply auto-deduction per order channel (e.g., every takeaway order uses 1 container) — explicitly rejected, manual logging only
- Batch-prepared fallback to ingredient availability — explicitly rejected, out of stock means out of stock

</deferred>

---

*Phase: 28-recipe-preparation-type-support-scratch-ready-to-sell-assemble-routing-for-pre-made-food-products*
*Context gathered: 2026-03-27*
