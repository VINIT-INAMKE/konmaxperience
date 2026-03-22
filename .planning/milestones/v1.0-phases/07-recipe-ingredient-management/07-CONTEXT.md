# Phase 7: Recipe & Ingredient Management - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete food production data layer: unified recipe system with polymorphic BOM, ingredient master list, unit conversion, vendor management with price history, recursive cost calculation, and menu items with channel-aware pricing. Data model is fully specified in the pipeline design spec — Phase 7 builds the schema migration, NestJS modules, and frontend pages. No inventory tracking (Phase 8), no kitchen prep (Phase 9), no POS (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Recipe Creation UX
- **D-01:** Step-by-step wizard for recipe form: Step 1 = recipe details (name, description, prep_steps, cooking_method, yield, portion_size, shelf_life_hours, brand, zone, image_url, status). Step 2 = add BOM lines. Step 3 = review + computed cost preview.
- **D-02:** BOM lines: each line has type (ingredient/recipe), item (searchable combobox), quantity, unit, prep notes. Combobox switches between ingredient list and recipe list based on type selection.
- **D-03:** Recipe detail page shows a visual dependency tree (indented or graph) of sub-recipes. E.g., Chicken Tikka → Marinated Chicken → Marinade → Spice Mix. Click any node to navigate to that recipe.
- **D-04:** Recipe status workflow: draft → approved → archived. Same pattern as assets (Phase 6).
- **D-05:** Recipes live under Operations section in sidebar alongside Zones, Brands, Channels, Assets.

### Menu & Pricing Pages
- **D-06:** Menu management page organized as: Brand tabs (top) → Category sections (collapsible) → Item cards within each section. Each card shows name, base_price, food cost %, availability toggle.
- **D-07:** Food cost % shown prominently on menu item cards with color coding: green (<30%), amber (30-40%), red (>40%).
- **D-08:** Channel modifiers managed as a settings-style table on the menu page (not a separate page). Shows each channel with modifier type (fixed/percentage) and value. Admin edits inline.
- **D-09:** MenuCategory has brand_id, name, sort_order, status (active/inactive). Admin creates categories per brand.

### Vendor & Ingredient Pages
- **D-10:** Vendor price history displayed as a simple list per ingredient sorted by effective_date DESC. Current price highlighted. No charts in v1.
- **D-11:** Ingredients filtered by category tabs: All, Dairy, Vegetable, Spice, Grain, Meat, Oil.
- **D-12:** Vendors page as a table with name, phone, email, payment_terms, status. Click to see vendor detail with linked ingredients and price history.
- **D-13:** Vendor + ingredient pages also live under Operations sidebar section.

### Data Model (locked by pipeline spec)
- **D-14:** Recipe model — see pipeline spec §3.1. No type distinction. Polymorphic BOM via RecipeLine.input_type ("ingredient" | "recipe").
- **D-15:** Ingredient model — see pipeline spec §3.2. Category, base_unit, min_stock_level.
- **D-16:** UnitConversion — see pipeline spec §3.2. Seed: kg↔g, L↔ml, dozen↔pieces.
- **D-17:** Vendor + VendorPrice — see pipeline spec §3.3. Current price = latest by effective_date.
- **D-18:** MenuCategory + MenuItem + ChannelModifier — see pipeline spec §3.4. Brand → Category → Items hierarchy.
- **D-19:** Recursive cost calculation: ingredient cost = best vendor price × qty (converted to base_unit). Recipe input cost = source recipe computed_cost × (qty / yield_qty). Cached in computed_cost field.

### Claude's Discretion
- Recipe wizard step layout and transitions
- Dependency tree visualization approach (nested list vs actual graph library)
- Menu item card layout within category sections
- Vendor form field layout
- Ingredient form field layout
- Unit conversion seed data management UI (if any — may just be seeded, no UI)
- How "best vendor price" is surfaced (cheapest? latest? user picks?)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Food Production Pipeline Spec (PRIMARY)
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §3.1 — Recipe & RecipeLine schema
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §3.2 — Ingredient & UnitConversion schema + seed values
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §3.3 — Vendor & VendorPrice schema
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §3.4 — MenuCategory, MenuItem, ChannelModifier schema
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §4.5 — Recursive cost calculation algorithm
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §4.6 — Menu availability logic (prep checks deferred to Phase 9)

### Existing Implementation
- `backend/prisma/schema.prisma` — Brand model (line 284), Zone model (line 274), Channel model (line 295) — Phase 7 entities reference these
- `backend/src/brands/brands.service.ts` — Brand CRUD pattern (owner-edit RBAC)
- `backend/src/assets/assets.service.ts` — Status workflow pattern (draft → approved)
- `frontend/components/ops/operations/` — Operations page patterns from Phase 6

### Requirements
- `.planning/REQUIREMENTS.md` — RECIPE-01 through RECIPE-07

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/assets/assets.service.ts` — Status workflow pattern (draft/approved/archived)
- `backend/src/storage/storage.service.ts` — R2 presigned URL for recipe image upload
- `frontend/components/ops/operations/` — Operations page patterns (card grids, tables, forms)
- `frontend/components/ui/tabs.tsx` — Filter tabs (used for ingredients, menu brands)
- `frontend/components/ui/magic-card.tsx` — MagicCard for recipe/menu item cards
- `frontend/components/patterns/p-combobox-3.tsx` — Premium combobox for ingredient/recipe search in BOM lines

### Established Patterns
- NestJS Module → Controller → Service → Prisma
- Sheet for create/edit forms, Dialog for confirmations
- Sidebar Operations section for nav
- Sonner toast for notifications
- React Query for server state

### Integration Points
- Sidebar: Add Recipes, Ingredients, Vendors, Menu to Operations section (D-05, D-13)
- Brand model: Recipes reference brand_id, MenuCategories reference brand_id
- Zone model: Recipes reference zone_id
- Channel model: ChannelModifiers reference channel_type
- Storage: Recipe image_url via presigned URL upload

</code_context>

<specifics>
## Specific Ideas

- The recipe wizard should feel substantial — this is the core content creation flow for the food business
- Dependency tree visualization is a standout feature — makes the recipe chain tangible
- Food cost % color coding on menu items makes this immediately actionable for the team — "which items have bad margins?"
- Unit conversion should be invisible to users — system handles it automatically, users pick any compatible unit

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-recipe-ingredient-management*
*Context gathered: 2026-03-21*
