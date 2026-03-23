# Phase 20: Operations Import - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Bulk CSV/XLSX import for operational data — opening stock, recipes (with BOM lines), menu items, events, tasks, quests, KPIs. Extends the Phase 19 import infrastructure with 7+ new import types, a two-sheet XLSX parser for recipes, dependency ordering on the import index page, and fixes to critical blockers in the existing import pipeline.

Also includes: prerequisite check endpoint, import controller audit trail (userId), transaction error fix, row count limit, number format sanitization, and base_unit overwrite protection.

</domain>

<decisions>
## Implementation Decisions

### Recipe Two-Sheet Import
- **D-01:** Recipe template is a 3-sheet XLSX: Sheet 1 (Recipes headers), Sheet 2 (BOM Lines), Sheet 3 (Instructions explaining both sheets and how recipe_name links them)
- **D-02:** Recipes are XLSX-only — no CSV support (CSV can't do two sheets). All other entity types support both CSV and XLSX.
- **D-03:** Preview table shows grouped rows — recipe header as a bold/highlighted row, BOM lines indented beneath. Expand/collapse per recipe.
- **D-04:** Recipe import is atomic per recipe — if the recipe header is invalid, all its BOM lines are also blocked. Either all of a recipe imports or none.
- **D-05:** Recipes always import as `draft` status. Admin reviews computed costs and BOM, then manually approves. Menu item import requires approved recipes.
- **D-06:** Commit uses two-pass inside one transaction: Pass 1 creates recipe headers (builds recipeIdMap), Pass 2 creates BOM lines (resolves recipe_name from map or DB), Pass 3 triggers cost calculation per recipe.
- **D-07:** BOM lines use a combined pattern: `input_type` column (`ingredient` or `recipe`) plus `ingredient_name` column. If input_type=ingredient, resolve in Ingredient table. If input_type=recipe, resolve in Recipe table (for sub-recipes).
- **D-08:** Cycle detection runs during validation — if a BOM line with input_type=recipe would create a circular reference, it's flagged as a cell error.

### Import Grouping & Ordering
- **D-09:** Import index page groups types into visual tiers with section headers:
  - FOUNDATION DATA: Ingredients, Vendors, Vendor Pricing (Phase 19)
  - OPERATIONS DATA Tier 1: Opening Stock, KPIs, Events (no Phase 20 deps)
  - OPERATIONS DATA Tier 2: Missions
  - OPERATIONS DATA Tier 3: Quests (needs missions)
  - OPERATIONS DATA Tier 4: Tasks (needs missions + quests)
  - MENU DATA Tier 5: Recipes
  - MENU DATA Tier 6: Menu Categories
  - MENU DATA Tier 7: Menu Items (needs approved recipes + categories)
- **D-10:** Soft warnings via real-time prerequisite check — on page load, `GET /imports/prerequisites` returns entity counts. Cards show dynamic warnings like "⚠ 0 approved recipes found — import and approve recipes first". Don't hard-block — admin might have pre-existing data.
- **D-11:** Menu Categories and Menu Items are in Phase 20 scope. Admin workflow: import recipes → approve manually → import menu categories → import menu items.

### Entity Scope & FK Resolution
- **D-12:** User references resolved by email (`owner_email` column). Applies to: task owner, quest owner, recipe created_by (auto from importing admin).
- **D-13:** Mission and quest references resolved by title (case-insensitive). Task template has `mission` and `quest` (optional) columns. Quest template has `mission` column.
- **D-14:** Zone and brand names resolved with ambiguity-safe pattern: findMany by name. If 1 match → use it. If 0 → error "Zone X not found". If 2+ → error "Multiple zones named X found — use zone_id column instead". Templates include optional `zone_id`/`brand_id` fallback columns.
- **D-15:** Menu item category resolved by category name + brand name together: `prisma.menuCategory.findFirst({ where: { name, brand: { name: brandName } } })`.
- **D-16:** Menu item recipe resolved by name, MUST have `status === 'approved'`. Error: "Recipe X is not approved — approve it before importing menu items".
- **D-17:** `created_by` for recipes and tasks uses the importing admin's userId from JWT — no spreadsheet column needed.

### Opening Stock Import
- **D-18:** Stock import calls `inventoryService.adjust()` per row — NOT direct DB insert. This properly creates both IngredientStock (upsert) and StockMovement audit trail, with unit conversion.
- **D-19:** Template columns: ingredient (name), zone (name), quantity (positive number), unit, reason (optional, defaults to "Opening stock").
- **D-20:** Pre-validate unit conversion: check that a conversion path exists from the row's unit to the ingredient's base_unit in the UnitConversion table. Error: "No conversion from tsp to g — add a unit conversion first or use the ingredient's base unit".
- **D-21:** Allowed stock import units are those with conversion paths in UnitConversion table (currently: g, kg, ml, L, pieces). Validator checks dynamically, not hardcoded.

### Task Import
- **D-22:** Core fields only: title, description, mission, quest (optional), owner_email, task_type, domain, priority, xp (optional, defaults to 25), due_date (optional). Status defaults to 'todo'. Fields like valid, verified, blocked, depends_on, kpi, readiness_meter are NOT in the import template.
- **D-23:** Block task import into active/completed quests — validator checks quest status. Error: "Quest X is active — baseline is frozen. Import tasks before activating the quest."
- **D-24:** task_type enum: `core | adhoc | improvement`. domain enum: `food | art | lifestyle | ops | procurement | bi | talent | tech | design`. priority enum: `low | medium | high | critical`.

### Quest Import
- **D-25:** Template columns: title, description, mission (title), week_number, owner_email, start_date (optional), end_date (optional). Status defaults to 'planned'.

### Mission Import
- **D-26:** Template columns: title, description, phase, scope, start_date (optional), end_date (optional). Status defaults to 'planned'. phase enum: `setup | foundation | activation | scale`. scope enum: `food | art | lifestyle | system | mixed`.

### KPI Import
- **D-27:** Template columns: name, description, unit, target_value, domain, current_value (optional, defaults to 0), status (optional, defaults to 'on_track'). status enum: `on_track | at_risk | off_track`.
- **D-28:** KPI import does NOT link tasks (no linked_task_ids column). Task-KPI linking is a separate workflow.

### Event Import
- **D-29:** Template columns: title, event_type, date, capacity, price, zone (optional), brand (optional), description (optional). Status defaults to 'upcoming'. event_type enum: `dining | workshop | pop_up | tasting | other`.
- **D-30:** Event bookings are NOT imported — only the event itself.

### Menu Category Import
- **D-31:** Template columns: name, brand (name), sort_order (optional, defaults to 0). Status defaults to 'active'.

### Menu Item Import
- **D-32:** Template columns: name, recipe (name, must be approved), category (name), brand (name — used with category for disambiguation), base_price, available (optional, defaults to true).

### Critical Bug Fixes (Phase 19 infrastructure)
- **D-33:** Fix transaction error handling in commitImport — collect errors in the loop but re-throw at the end of the transaction to ensure full rollback on ANY error. Return error details in the response.
- **D-34:** Add @Req() to import controller to get userId from JWT. Pass userId to commitImport for entities that need created_by and for stock adjustment audit trail.
- **D-35:** Block base_unit changes on ingredient "Update existing" — if the ingredient already exists and the spreadsheet has a different base_unit, reject the row with error "Cannot change base_unit from g to kg — existing stock records use g".
- **D-36:** Add 500-row limit on parse — reject files with >500 data rows. Error: "File has X rows — maximum is 500 per import."
- **D-37:** Sanitize number formats — strip commas from numeric fields before parseFloat. '1,000' → '1000'. Invalid results show validation error.

### Claude's Discretion
- XLSX parser extension for two-sheet reading (implementation approach)
- Exact prerequisite check endpoint response shape
- Template sample data values for each entity type
- Instructions sheet content per entity type
- Exact error message wording for each validation
- How to extend the frontend import type page to handle grouped recipe preview
- Performance optimization for large imports (batching DB queries)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Import Infrastructure (Phase 19 — extend, don't replace)
- `backend/src/imports/import-types.ts` — ImportType enum, ImportRow, ParseResult, CommitResult types. Extend enum with new types.
- `backend/src/imports/imports.service.ts` — parseFile, commitImport flow. Fix transaction error handling (D-33). Add userId parameter (D-34).
- `backend/src/imports/imports.controller.ts` — Endpoints. Add @Req() for userId (D-34). Add row limit check (D-36).
- `backend/src/imports/template.service.ts` — SAMPLE_DATA, INSTRUCTIONS per type. Extend for all new types.
- `backend/src/imports/parsers/xlsx.parser.ts` — Single-sheet only. Must extend for two-sheet recipe parsing.
- `backend/src/imports/validators/ingredients.validator.ts` — Validator pattern to follow. Add base_unit protection (D-35).
- `backend/src/imports/validators/vendor-pricing.validator.ts` — FK resolution pattern (resolve by name).
- `frontend/app/(ops)/admin/import/page.tsx` — Import index page. Restructure into tiered layout (D-09).
- `frontend/app/(ops)/admin/import/[type]/page.tsx` — Import type page. Extend for recipe grouped preview (D-03).
- `frontend/lib/types/imports.ts` — Frontend types. Extend ImportType and IMPORT_TYPE_CONFIG.

### Entity Services (business logic that validators MUST replicate)
- `backend/src/inventory/inventory.service.ts` — adjust() method. Stock import MUST call this, not raw insert (D-18). Unit conversion via UnitConversion table.
- `backend/src/recipes/recipes.service.ts` — create() with BOM lines, cycle detection via walkForCycle, cost calculation trigger. Import must follow same flow (D-06).
- `backend/src/menu/menu.service.ts` — createItem() requires recipe.status === 'approved' (D-16). createCategory() requires brand_id.
- `backend/src/tasks/tasks.service.ts` — create() requires mission_id, owner_user_id, created_by. Status defaults to 'todo'. XP defaults to 25.
- `backend/src/quests/quests.service.ts` — create() requires mission_id, owner_user_id. activate() freezes baseline_task_count (D-23).
- `backend/src/missions/missions.service.ts` — create() requires title, description, phase, scope. created_by from JWT.
- `backend/src/kpis/kpis.service.ts` — create() is simple. linked_task_ids is a separate update (D-28).
- `backend/src/events/events.service.ts` — create() is straightforward. event_type enum validation (D-29).

### Prisma Schema (field types, constraints, enums)
- `backend/prisma/schema.prisma` — All model definitions. Key unique constraints: IngredientStock(ingredient_id, zone_id), UnitConversion(from_unit, to_unit).

### DTO Enums (exact allowed values for validators)
- `backend/src/ingredients/dto/` — category: dairy|vegetable|spice|grain|meat|oil. base_unit: g|ml|pieces|kg|L.
- `backend/src/tasks/dto/` — task_type: core|adhoc|improvement. domain: food|art|lifestyle|ops|procurement|bi|talent|tech|design. priority: low|medium|high|critical.
- `backend/src/missions/dto/` — phase: setup|foundation|activation|scale. scope: food|art|lifestyle|system|mixed.
- `backend/src/events/dto/` — event_type: dining|workshop|pop_up|tasting|other.
- `backend/src/kpis/dto/` — status: on_track|at_risk|off_track.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Validator pattern** (ingredients.validator.ts, vendor-pricing.validator.ts): All new validators follow the same signature: `(raw, rowIndex, prisma) => Promise<ImportRow>`. Extend for new entity types.
- **FK resolution by name**: vendor-pricing.validator.ts shows case-insensitive `findFirst` pattern. New pattern: ambiguity-safe `findMany` + count for zone/brand (D-14).
- **Template generation**: SAMPLE_DATA + INSTRUCTIONS pattern in template.service.ts. Extend for each new type.
- **CostCalculatorService**: Already handles cost recalculation — import just needs to call `recalculateAndSave(recipeId)` after recipe creation.
- **InventoryService.adjust()**: Already handles unit conversion, IngredientStock upsert, StockMovement creation — stock import calls this directly.

### Established Patterns
- Import types registered in IMPORT_TYPE_CONFIG (both backend and frontend)
- Frontend uses IMPORT_TYPE_CONFIG for card rendering (icon, label, description, route)
- Backend validateRow switch dispatches to per-type validator functions

### Integration Points
- `app.module.ts` already imports ImportsModule — new validators and types are internal additions
- Frontend import index page needs restructuring from flat card grid to tiered sections
- Frontend import type page needs extension for recipe grouped preview (expandable rows)
- Import controller needs @Req() decorator added for userId

</code_context>

<specifics>
## Specific Ideas

- Stock import should feel like a "day 1 setup" tool — admin enters opening balances for all ingredients across all zones
- Recipe import is the most complex — two-sheet XLSX with grouped preview is a premium UX feature
- The prerequisite check endpoint makes the import page intelligent — it guides the admin through the correct order
- The base_unit protection (D-35) and quest baseline protection (D-23) are guardrails that prevent silent data corruption
- Transaction fix (D-33) ensures "all or nothing" import semantics — no more partial commits on errors

</specifics>

<deferred>
## Deferred Ideas

- **Scheduled/recurring imports** — auto-import from a shared Google Drive folder on a cron schedule
- **Google Sheets URL import** — paste a Sheets URL, auto-parse without download
- **Import history log** — track all past imports with who/when/what/how many
- **Undo import** — soft-delete or rollback a specific import batch
- **Task dependency import** — depends_on_task column for task chaining
- **KPI task linking** — linked_task_ids column to auto-link tasks to KPIs
- **Event booking import** — bulk create bookings for events
- **Recipe approval in import flow** — approve recipes inline during import preview
- **Bulk unit conversion seeding** — import UnitConversion rows to support more units

</deferred>

---

*Phase: 20-operations-import*
*Context gathered: 2026-03-23*
