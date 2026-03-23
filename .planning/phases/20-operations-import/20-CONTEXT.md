# Phase 20: Operations Import - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Bulk CSV/XLSX import for operational data — opening stock, recipes (with BOM lines), menu categories, menu items, events, tasks, quests, missions, KPIs. Extends the Phase 19 import infrastructure with 10 new import types, a multi-sheet XLSX parser for recipes, dependency ordering on the import index page, per-entity update safety policies, and fixes to critical bugs in the existing import pipeline.

Infrastructure fixes shipping with this phase: transaction rollback (partial commit bug), userId audit trail, row limit, number sanitization, ingredient enum enforcement, base_unit overwrite protection, stock re-import detection.

</domain>

<decisions>
## Implementation Decisions

---

### SYSTEM DESIGN: Entity Dependency Graph

- **D-01:** Import order enforced by dependency levels:
  ```
  LEVEL 0 (pre-existing from Phase 19 / seed): Ingredient, Vendor, VendorPrice, Zone, Brand, User, UnitConversion
  LEVEL 1 (no Phase 20 deps): Opening Stock, Mission, KPI, Event
  LEVEL 2 (deps on Level 1): Quest → Mission+User. Menu Category → Brand. Recipe → User+Ingredient+Brand?+Zone?
  LEVEL 3 (deps on Level 2): Task → Mission+Quest+User. [MANUAL GAP: admin approves recipes in UI]
  LEVEL 4 (deps on approved recipes): Menu Item → approved Recipe + MenuCategory + Brand
  ```

---

### SYSTEM DESIGN: Per-Entity Update Policy ("Update Existing" Toggle)

- **D-02:** Every entity has three field categories — SAFE (can update), BLOCKED (rejects row with error), NEVER (import ignores, computed/workflow field):

  | Entity | Duplicate Key | SAFE to update | BLOCKED on update (with error) | NEVER touch |
  |---|---|---|---|---|
  | Ingredient | name | name, category, min_stock_level | `base_unit` if changed ("Cannot change — stock records use {old}") | — |
  | Opening Stock | ingredient_id + zone_id | N/A — stock is additive, not updatable | N/A | current_quantity |
  | Mission | title | description, phase, scope, start_date, end_date | — | progress_percent, status |
  | Quest | title + mission_id | description, week_number, start_date, end_date | ALL if status != 'planned' ("Quest is {status} — cannot modify") | baseline_task_count, *_progress_percent, status |
  | Task | title + mission_id + quest_id | description, priority, xp, due_date, domain | ALL if status = 'done' ("Cannot modify completed task") | status, valid, verified, valid_xp, blocked, completed_at, readiness_value |
  | KPI | name | description, unit, target_value, domain | current_value if existing value > 0 ("Cannot overwrite measured data") | — |
  | Event | title + date | description, price, event_type, zone, brand | capacity if reducing below booked count; date if bookings exist | — |
  | Recipe | name | ALL header fields + BOM replacement if status = 'draft' | ALL if status = 'approved' ("Cannot modify approved recipe") | computed_cost, status |
  | Menu Category | name + brand_id | name, sort_order | brand_id ("Cannot move category to different brand") | status |
  | Menu Item | name + category_id | name, base_price, available | — | status |

- **D-03:** Recipe BOM update policy: When "Update existing" is on and recipe is `draft`, DELETE all existing RecipeLines, INSERT new ones from Sheet 2, then recalculate cost. If recipe is `approved`, BLOCK the entire row.

---

### SYSTEM DESIGN: FK Resolution Chains

- **D-04:** Resolution rules (ALL entities):
  - All name matches are **case-insensitive, trimmed** (`.trim()` then `mode: 'insensitive'`)
  - User: `findUnique({ where: { email } })` — email is `@unique`, no ambiguity possible
  - Zone/Brand: `findMany({ where: { name } })` → exactly 1 = use it; 0 = error "not found"; 2+ = error "Multiple found — use {entity}_id column"
  - Mission/Quest/Recipe/Ingredient/etc: `findFirst({ where: { name/title: { equals, mode: 'insensitive' } } })`

- **D-05:** Complete FK chain per entity:
  - **Opening Stock:** ingredient(name)→Ingredient.id, zone(name)→Zone.id, unit→UnitConversion lookup against ingredient.base_unit. COMMIT via `inventoryService.adjust()`.
  - **Recipe Pass 1:** brand(name)→Brand.id?, zone(name)→Zone.id?. COMMIT creates recipe as draft.
  - **Recipe Pass 2 (BOM):** recipe_name→recipeIdMap[name] OR Recipe.id from DB. If input_type=ingredient: ingredient_name→Ingredient.id. If input_type=recipe: ingredient_name→Recipe.id (with cycle check).
  - **Quest:** mission(title)→Mission.id, owner_email→User.id.
  - **Task:** mission(title)→Mission.id, quest(title)→Quest.findFirst({title, mission_id}), owner_email→User.id. GUARD: quest.status must be 'planned'.
  - **Menu Category:** brand(name)→Brand.id.
  - **Menu Item:** brand(name)→Brand.id, category(name)→MenuCategory.findFirst({name, brand_id}), recipe(name)→Recipe.findFirst({name}) + GUARD recipe.status must be 'approved'.

---

### SYSTEM DESIGN: Transaction Integrity

- **D-06:** Single-entity imports (mission, quest, task, KPI, event, menu category, menu item): all-or-nothing `$transaction`. Errors collected in loop, re-thrown at end for full rollback. Response includes error details for frontend display.
- **D-07:** Recipe import: multi-pass inside one `$transaction`. Pass 1: create/update headers. Pass 2: delete old BOM + create new. Cycle detection. If any errors → full rollback. Cost calculation runs OUTSIDE transaction (non-critical, retryable).
- **D-08:** Stock import: NO outer transaction — each `adjust()` is its own atomic transaction (creates IngredientStock upsert + StockMovement). If row 5 fails, rows 1-4 are valid stock movements with audit trail. This is intentional — stock movements are independent facts.

---

### SYSTEM DESIGN: Idempotency & Re-Import Protection

- **D-09:** Stock re-import detection: On commit, set `StockMovement.reference_type = 'import'` and `reference_id = SHA-256(file content)`. On parse, check if any StockMovement with that reference_id exists. If found, return warning in ParseResult: "This file was already imported on {date}. Re-importing will create duplicate stock movements." Frontend shows amber banner. Does not block.
- **D-10:** All other entities: duplicate detection via natural keys (D-02). Toggle OFF + duplicate = skip. Toggle ON + duplicate = update SAFE fields, block DANGEROUS fields per D-02 policy.

---

### SYSTEM DESIGN: Enum Enforcement

- **D-11:** Every validator enforces exact DTO enum values. Error format: `"Invalid {field} '{value}'. Valid values: {list}"`. Complete enum list:
  - Ingredient.category: `dairy, vegetable, spice, grain, meat, oil`
  - Ingredient.base_unit: `g, ml, pieces, kg, L`
  - Task.task_type: `core, adhoc, improvement`
  - Task.domain: `food, art, lifestyle, ops, procurement, bi, talent, tech, design`
  - Task.priority: `low, medium, high, critical`
  - Mission.phase: `setup, foundation, activation, scale`
  - Mission.scope: `food, art, lifestyle, system, mixed`
  - KPI.status: `on_track, at_risk, off_track`
  - Event.event_type: `dining, workshop, pop_up, tasting, other`
  - RecipeLine.input_type: `ingredient, recipe`

---

### TEMPLATE SPECIFICATIONS

Each template has: exact columns, required/optional markers, sample data that shows correct format, and an Instructions sheet explaining every column, valid values, and common mistakes.

**Template design principles:**
- Column headers match the import validator's expected field names exactly
- Sample row uses realistic data from the Konma villa context (not "test" or "example")
- Required columns are marked with * in the Instructions sheet
- Enum columns list ALL valid values in the Instructions sheet
- FK name columns explain what table they resolve against
- Optional columns show what the default is if left blank

#### T-01: Opening Stock Template

**Columns:**

| Column | Required | Format | Notes |
|---|---|---|---|
| ingredient | yes | text | Must match an existing ingredient name exactly |
| zone | yes | text | Must match an existing zone name. If ambiguous, use zone_id instead |
| zone_id | no | UUID | Optional fallback — overrides zone name if both provided |
| quantity | yes | number > 0 | Opening quantities are always positive |
| unit | yes | text | Must have a conversion path to the ingredient's base_unit. Safe values: g, kg, ml, L, pieces, dozen |
| reason | no | text | Defaults to "Opening stock" if blank |

**Sample row:** `Basmati Rice | Main Kitchen | | 5000 | g | Opening stock`
**Sample row 2:** `Ghee | Cold Storage | | 5 | L | Transferred from old system`
**Sample row 3:** `Eggs | Main Kitchen | | 10 | dozen | Opening stock`

**Instructions sheet content:**
- "This import creates stock adjustment records. Each row adds to the ingredient's stock in the specified zone."
- "⚠ Stock imports are ADDITIVE. If you import this file twice, quantities will be doubled. The system will warn you if a file has been imported before."
- "The 'unit' must be convertible to the ingredient's base unit. Available conversions: g↔kg, ml↔L, pieces↔dozen. If your unit isn't supported, use the ingredient's base unit directly."
- Table of all zones with their names for reference

#### T-02: Mission Template

**Columns:**

| Column | Required | Format | Valid Values |
|---|---|---|---|
| title | yes | text (min 3 chars) | — |
| description | yes | text | — |
| phase | yes | enum | setup, foundation, activation, scale |
| scope | yes | enum | food, art, lifestyle, system, mixed |
| start_date | no | date | YYYY-MM-DD |
| end_date | no | date | YYYY-MM-DD |

**Sample row:** `Foundation Setup | Establish core villa kitchen operations, procurement, and inventory systems | foundation | food | 2026-04-01 | 2026-06-30`
**Sample row 2:** `Art Activation | Launch art workshops and gallery events for villa guests | activation | art | 2026-05-01 | 2026-07-31`

**Instructions:** "Each row creates a mission with status 'planned'. Progress is calculated automatically from tasks — do not import progress values."

#### T-03: Quest Template

**Columns:**

| Column | Required | Format | Resolves To |
|---|---|---|---|
| title | yes | text (min 3 chars) | — |
| description | yes | text | — |
| mission | yes | text | Must match an existing mission title |
| week_number | yes | integer ≥ 1 | — |
| owner_email | yes | email | Must match a registered user's email |
| start_date | no | date | YYYY-MM-DD |
| end_date | no | date | YYYY-MM-DD |

**Sample row:** `Week 1 Kitchen Setup | Set up all kitchen stations, equipment checks, and initial inventory | Foundation Setup | 1 | chef@konma.com | 2026-04-01 | 2026-04-07`
**Sample row 2:** `Week 2 Menu Planning | Finalize seasonal menu with recipe testing and costing | Foundation Setup | 2 | chef@konma.com | 2026-04-08 | 2026-04-14`

**Instructions:** "Quests are created with status 'planned'. Import ALL tasks for a quest BEFORE activating it in the app — the baseline task count locks permanently on first activation."

#### T-04: Task Template

**Columns:**

| Column | Required | Format | Valid Values / Resolves To |
|---|---|---|---|
| title | yes | text (min 3 chars) | — |
| description | yes | text | — |
| mission | yes | text | Must match an existing mission title |
| quest | no | text | Must match a quest title within the specified mission |
| owner_email | yes | email | Must match a registered user's email |
| task_type | yes | enum | core, adhoc, improvement |
| domain | yes | enum | food, art, lifestyle, ops, procurement, bi, talent, tech, design |
| priority | yes | enum | low, medium, high, critical |
| xp | no | integer ≥ 0 | Defaults to 25 if blank |
| due_date | no | date | YYYY-MM-DD |

**Sample row:** `Organize prep station | Set up cutting boards, knife sets, and prep containers at each station | Foundation Setup | Week 1 Kitchen Setup | chef@konma.com | core | food | high | 30 | 2026-04-03`
**Sample row 2:** `Create vendor contact sheet | Compile all vendor phone numbers, emails, and delivery schedules | Foundation Setup | | ops@konma.com | adhoc | procurement | medium | | 2026-04-05`

**Instructions:**
- "Tasks are created with status 'todo'. Status progression (in_progress, done) happens in the app."
- "The 'quest' column is optional. If blank, the task belongs to the mission directly."
- "⚠ You CANNOT import tasks into a quest that has been activated. The quest must still be in 'planned' status."
- "XP defaults to 25 if left blank. Set to 0 for tasks that should not award experience points."

#### T-05: KPI Template

**Columns:**

| Column | Required | Format | Valid Values |
|---|---|---|---|
| name | yes | text | — |
| description | yes | text | — |
| unit | yes | text | e.g., %, INR, count, hours, score |
| target_value | yes | number | — |
| domain | yes | text | e.g., food, ops, procurement, bi, talent |
| current_value | no | number | Defaults to 0 if blank |
| status | no | enum | on_track, at_risk, off_track. Defaults to on_track |

**Sample row:** `Food Cost Percentage | Track food cost as percentage of total revenue | % | 30 | food | 0 | on_track`
**Sample row 2:** `Vendor On-Time Delivery | Percentage of vendor deliveries arriving on schedule | % | 95 | procurement | 0 | on_track`
**Sample row 3:** `Guest Satisfaction Score | Average post-event guest rating out of 10 | score | 8.5 | food | 0 | on_track`

**Instructions:** "KPIs are standalone metrics. Linking KPIs to tasks is done separately in the app, not via import."

#### T-06: Event Template

**Columns:**

| Column | Required | Format | Valid Values / Resolves To |
|---|---|---|---|
| title | yes | text (3-200 chars) | — |
| event_type | yes | enum | dining, workshop, pop_up, tasting, other |
| date | yes | date/datetime | YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS |
| capacity | yes | integer ≥ 1 | — |
| price | yes | number ≥ 0 | Price per guest in INR |
| zone | no | text | Must match an existing zone name |
| brand | no | text | Must match an existing brand name |
| description | no | text (max 2000 chars) | — |

**Sample row:** `Farm to Table Dinner | dining | 2026-04-15T19:00:00 | 30 | 2500 | Garden Terrace | Konma Food | A seasonal five-course dinner featuring produce from our partner farms`
**Sample row 2:** `Pottery Workshop | workshop | 2026-04-20T10:00:00 | 15 | 1800 | Workshop Studio | | Hands-on pottery session with local artisan`
**Sample row 3:** `Wine Tasting Evening | tasting | 2026-04-25T18:00:00 | 25 | 1200 | Lounge | Konma Food | Curated selection of Indian wines`

**Instructions:** "Events are created with status 'upcoming'. Event bookings are managed separately in the app. When updating existing events, capacity cannot be reduced below the number of existing bookings, and date cannot be changed if bookings exist."

#### T-07: Recipe Template (3-sheet XLSX only)

**Sheet 1 — Recipes:**

| Column | Required | Format | Resolves To |
|---|---|---|---|
| name | yes | text | — |
| description | yes | text | — |
| prep_steps | yes | text | Full preparation instructions |
| cooking_method | yes | text | e.g., "Pressure cook + tadka", "Grill + rest" |
| yield_qty | yes | number > 0 | — |
| yield_unit | yes | text | e.g., portions, kg, L, pieces |
| portion_size | yes | text | e.g., "250g", "1 plate", "300ml" |
| shelf_life_hours | no | integer ≥ 1 | — |
| brand | no | text | Must match an existing brand name |
| zone | no | text | Must match an existing zone name |

**Sample Sheet 1:**
```
Dal Tadka | Comfort yellow dal with ghee tempering | 1. Soak toor dal 2 hrs 2. Pressure cook 4 whistles 3. Prepare tadka with ghee, cumin, garlic | Pressure cook + tadka | 4 | portions | 250g | 48 | Konma Food | Main Kitchen
Paneer Tikka | Tandoor-grilled marinated cottage cheese | 1. Cut paneer into cubes 2. Marinate in yogurt and spices 3. Thread on skewers 4. Grill in tandoor 8-10 min | Tandoor grill | 6 | portions | 180g | 24 | Konma Food | Main Kitchen
```

**Sheet 2 — BOM Lines:**

| Column | Required | Format | Resolves To |
|---|---|---|---|
| recipe_name | yes | text | Must match a recipe name in Sheet 1 or in the database |
| input_type | yes | enum | ingredient (look up in Ingredient table) or recipe (look up in Recipe table for sub-recipes) |
| ingredient_name | yes | text | Name of the ingredient or sub-recipe being used |
| quantity | yes | number > 0 | — |
| unit | yes | text | e.g., g, ml, pieces, kg, L |
| prep_notes | no | text | e.g., "Soaked overnight", "Finely diced" |

**Sample Sheet 2:**
```
Dal Tadka | ingredient | Toor Dal | 200 | g | Soaked 2 hours
Dal Tadka | ingredient | Ghee | 30 | ml |
Dal Tadka | ingredient | Onion | 100 | g | Finely chopped
Dal Tadka | ingredient | Garlic | 15 | g | Minced
Paneer Tikka | ingredient | Paneer | 500 | g | Cut into 2cm cubes
Paneer Tikka | ingredient | Yogurt | 100 | ml | Hung yogurt
Paneer Tikka | recipe | Tikka Masala Paste | 60 | g |
```

**Sheet 3 — Instructions:**
- "Sheet 1 contains recipe headers. Sheet 2 contains BOM (Bill of Materials) lines — the ingredients for each recipe."
- "The 'recipe_name' column in Sheet 2 must exactly match a recipe name from Sheet 1 (or a recipe already in the system)."
- "For sub-recipes: set input_type to 'recipe' and put the sub-recipe name in ingredient_name. The sub-recipe must exist in the system or in Sheet 1."
- "⚠ Recipes are imported as 'draft'. You must approve them individually in the app before they can be used in menu items."
- "⚠ Circular recipe references are not allowed (Recipe A uses Recipe B which uses Recipe A)."
- "⚠ CSV is not supported for recipes — use XLSX only (the BOM lines require a second sheet)."
- "When updating an existing draft recipe, ALL existing BOM lines are replaced with the lines from Sheet 2."
- "Approved recipes CANNOT be updated via import. Archive them first or create a new version."

#### T-08: Menu Category Template

**Columns:**

| Column | Required | Format | Resolves To |
|---|---|---|---|
| name | yes | text | — |
| brand | yes | text | Must match an existing brand name |
| sort_order | no | integer ≥ 0 | Display order. Defaults to 0 if blank |

**Sample row:** `Mains | Konma Food | 1`
**Sample row 2:** `Starters | Konma Food | 2`
**Sample row 3:** `Desserts | Konma Food | 3`
**Sample row 4:** `Beverages | Just Craves | 1`

**Instructions:** "Each category belongs to a brand. The brand must already exist in the system. When updating, the brand cannot be changed (it would move all linked menu items to a different brand context)."

#### T-09: Menu Item Template

**Columns:**

| Column | Required | Format | Resolves To |
|---|---|---|---|
| name | yes | text | — |
| recipe | yes | text | Must match an APPROVED recipe name. Draft recipes are rejected. |
| category | yes | text | Must match a menu category name within the specified brand |
| brand | yes | text | Used to find the correct category (a brand can have unique category names) |
| base_price | yes | number ≥ 0.01 | Price in INR |
| available | no | true/false | Defaults to true if blank |

**Sample row:** `Dal Tadka Bowl | Dal Tadka | Mains | Konma Food | 350 | true`
**Sample row 2:** `Paneer Tikka Plate | Paneer Tikka | Starters | Konma Food | 450 | true`
**Sample row 3:** `Seasonal Sorbet | Mango Sorbet | Desserts | Konma Food | 200 | false`

**Instructions:**
- "The recipe MUST be in 'approved' status. Draft recipes cannot be linked to menu items."
- "The category is looked up by name within the specified brand. Make sure the brand name matches exactly."
- "Workflow: 1) Import recipes → 2) Approve recipes in app → 3) Import menu categories → 4) Import menu items"
- "'available' controls whether the item shows to customers. Set to 'false' for seasonal items not currently offered."

---

### Import Index Page Design

- **D-12:** Import index page groups types into visual tiers with section headers. Real-time prerequisite check via `GET /imports/prerequisites` returns entity counts. Cards show dynamic warnings when prerequisites are missing.
  ```
  ━ FOUNDATION DATA
    [Ingredients] [Vendors] [Vendor Pricing]

  ━ OPERATIONS — Independent
    [Opening Stock]  [Missions]  [KPIs]  [Events]

  ━ OPERATIONS — Sequenced
    [Quests ⚠ needs missions]  [Tasks ⚠ needs missions + quests]

  ━ MENU
    [Recipes]  [Menu Categories ⚠ needs brands]  [Menu Items ⚠ needs approved recipes]
  ```

---

### Recipe Two-Sheet Import

- **D-13:** Recipe template is a 3-sheet XLSX: Sheet 1 (Recipe headers), Sheet 2 (BOM Lines), Sheet 3 (Instructions). CSV not supported for recipes.
- **D-14:** Preview table shows grouped rows — recipe header as a bold/highlighted row, BOM lines indented beneath. Expand/collapse per recipe.
- **D-15:** Recipe import is atomic per recipe — if the recipe header is invalid, all its BOM lines are also blocked.
- **D-16:** Recipes always import as `draft`. Admin approves manually. Menu items hard-require approved recipes.
- **D-17:** Commit uses two-pass inside one transaction: Pass 1 creates recipe headers (builds recipeIdMap), Pass 2 deletes old BOM lines (if update) then creates new BOM lines, cycle detection per recipe. Cost calculation runs outside transaction per recipe.
- **D-18:** BOM lines use `input_type` column (ingredient|recipe) + `ingredient_name` column. Resolves in Ingredient or Recipe table based on type.
- **D-19:** Cycle detection during validation — circular sub-recipe references flagged as cell error.

---

### Opening Stock Import

- **D-20:** Stock import calls `inventoryService.adjust()` per row — creates IngredientStock (upsert) + StockMovement (audit trail) with unit conversion.
- **D-21:** Pre-validate unit conversion against UnitConversion table. Error if no conversion path exists.
- **D-22:** Stock re-import detection: set `StockMovement.reference_type = 'import'`, `reference_id = SHA-256(file content)`. Warn on re-import.
- **D-23:** Stock has NO "Update existing" toggle — every import is additive. Frontend shows amber warning: "Stock imports are ADDITIVE. If you already imported this file, quantities will be added again."

---

### Task Import

- **D-24:** Block task import into active/completed quests — quest.status must be 'planned'.
- **D-25:** `created_by` from importing admin's JWT. Status always 'todo'. Fields like valid, verified, blocked, depends_on, kpi, readiness_meter are NOT importable.

---

### Infrastructure Fixes (ship with Phase 20)

- **D-26:** Fix transaction error handling in `commitImport` — collect errors in loop, re-throw at end for full rollback. Return error details.
- **D-27:** Add `@Req() req` to import controller commit endpoint. Pass `req.user.id` to service for created_by and stock audit.
- **D-28:** Block base_unit changes on ingredient "Update existing".
- **D-29:** Fix ingredient validator enum enforcement — reject invalid category/base_unit values matching DTO's @IsIn lists.
- **D-30:** Add 500-row limit on parse.
- **D-31:** Strip commas from numeric fields before parseFloat.
- **D-32:** Stock re-import detection using StockMovement.reference_type/reference_id.

### Claude's Discretion
- XLSX multi-sheet parser implementation approach
- Prerequisite check endpoint response shape
- Error message exact wording (within format constraints above)
- Recipe grouped preview component implementation
- Performance optimizations (batch DB queries for validators)
- Frontend icon choices for new import types
- Sidebar ordering if any changes needed

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Import Infrastructure (Phase 19 — extend, don't replace)
- `backend/src/imports/import-types.ts` — ImportType enum, ImportRow, ParseResult, CommitResult types. Add 10 new types.
- `backend/src/imports/imports.service.ts` — parseFile, commitImport. Fix transaction rollback (D-26). Add userId parameter (D-27). Add recipe multi-pass commit (D-17).
- `backend/src/imports/imports.controller.ts` — Add @Req() (D-27). Add row limit (D-30). Add prerequisites endpoint (D-12).
- `backend/src/imports/template.service.ts` — SAMPLE_DATA + INSTRUCTIONS. Add entries for all 10 new types per template specs T-01 through T-09.
- `backend/src/imports/parsers/xlsx.parser.ts` — Extend for multi-sheet recipe parsing.
- `backend/src/imports/validators/ingredients.validator.ts` — Fix enum enforcement (D-29). Add base_unit protection (D-28).
- `backend/src/imports/validators/vendor-pricing.validator.ts` — FK resolution pattern to replicate.
- `frontend/app/(ops)/admin/import/page.tsx` — Restructure into tiered layout (D-12).
- `frontend/app/(ops)/admin/import/[type]/page.tsx` — Extend for recipe grouped preview (D-14).
- `frontend/lib/types/imports.ts` — Extend ImportType and IMPORT_TYPE_CONFIG.

### Entity Services (validators MUST replicate this business logic)
- `backend/src/inventory/inventory.service.ts` — adjust() with unit conversion, StockMovement creation, negative stock guard. Stock import calls this directly (D-20).
- `backend/src/recipes/recipes.service.ts` — create() with BOM, walkForCycle(), cost calculation. Import replicates multi-pass flow (D-17).
- `backend/src/recipes/cost-calculator.service.ts` — recalculateAndSave() runs after recipe create/BOM update.
- `backend/src/menu/menu.service.ts` — createItem() requires recipe.status === 'approved'. createCategory() requires brand_id.
- `backend/src/tasks/tasks.service.ts` — create() requires mission_id, owner_user_id, created_by. Status='todo', xp defaults 25.
- `backend/src/quests/quests.service.ts` — activate() freezes baseline_task_count permanently. Import blocks tasks into non-planned quests (D-24).
- `backend/src/missions/missions.service.ts` — create() with created_by as plain string (not FK relation).
- `backend/src/kpis/kpis.service.ts` — Standalone. linked_task_ids is separate workflow.
- `backend/src/events/events.service.ts` — createBooking() has capacity/date guards that inform event update policy.

### Prisma Schema (exact field types and constraints)
- `backend/prisma/schema.prisma` — All models. Key constraints: IngredientStock @@unique([ingredient_id, zone_id]), UnitConversion @@unique([from_unit, to_unit]), User.email @unique. Zone.name and Brand.name are NOT unique.

### DTOs (exact enum values for validators)
- `backend/src/ingredients/dto/` — category: dairy|vegetable|spice|grain|meat|oil. base_unit: g|ml|pieces|kg|L.
- `backend/src/tasks/dto/` — task_type: core|adhoc|improvement. domain: food|art|lifestyle|ops|procurement|bi|talent|tech|design. priority: low|medium|high|critical.
- `backend/src/missions/dto/` — phase: setup|foundation|activation|scale. scope: food|art|lifestyle|system|mixed.
- `backend/src/events/dto/` — event_type: dining|workshop|pop_up|tasting|other.
- `backend/src/kpis/dto/` — status: on_track|at_risk|off_track.

### Seed Data (reference values for templates)
- `backend/prisma/seed.ts` — 8 zones (Main Kitchen, Prep Station, Dining Hall, Garden Terrace, Workshop Studio, Cold Storage, Office, Lounge), 2 brands (Konma Food, Just Craves), 6 unit conversions (kg↔g, L↔ml, dozen↔pieces).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Validator signature**: `(raw, rowIndex, prisma) => Promise<ImportRow>`. All 10 new validators follow this.
- **FK resolution by name**: vendor-pricing.validator.ts — case-insensitive findFirst. Extend with ambiguity-safe findMany for zone/brand.
- **Template generation**: SAMPLE_DATA + INSTRUCTIONS pattern in template.service.ts.
- **StockMovement.reference_type/reference_id**: Already exists in schema — use for re-import detection (D-22).
- **CostCalculatorService.recalculateAndSave()**: Call after recipe BOM import.
- **InventoryService.adjust()**: Call for stock import — handles unit conversion, upsert, audit.

### Established Patterns
- IMPORT_TYPE_CONFIG in both backend (columns, requiredColumns) and frontend (icon, label, description)
- Backend validateRow switch dispatches to per-type validator
- Backend commitImport switch dispatches to per-type createRow/updateRow
- Frontend ICON_MAP maps import types to Lucide icons

### Integration Points
- `app.module.ts` already imports ImportsModule — internal additions only
- Import controller needs @Req() decorator for userId
- Frontend import index page restructured from flat grid to tiered sections
- Frontend import type page extended for recipe grouped preview
- StockMovement gets reference_type='import' for re-import tracking

</code_context>

<specifics>
## Specific Ideas

- Templates are the user's contract — they must have realistic Konma villa sample data, not generic placeholder text
- Instructions sheets serve as inline documentation — admins who download a template should be able to fill it in without consulting any other guide
- Every enum column's Instructions sheet lists ALL valid values explicitly — no guessing
- The import index page is an intelligent guide, not just a list of cards — it tells the admin what to do first and what's missing
- Stock import is the only additive type — the UX must make this crystal clear with warnings

</specifics>

<deferred>
## Deferred Ideas

- **Scheduled/recurring imports** — auto-import from shared Drive folder on cron
- **Google Sheets URL import** — paste Sheets URL, auto-parse
- **Import history log** — track past imports with who/when/what/count
- **Undo import** — rollback a specific import batch
- **Task dependency import** — depends_on_task column for chaining
- **KPI task linking** — linked_task_ids column
- **Event booking import** — bulk create bookings
- **Recipe approval in import flow** — approve inline during preview
- **Bulk unit conversion seeding** — import UnitConversion rows
- **Multi-brand batch import** — single file spanning multiple brands

</deferred>

---

*Phase: 20-operations-import*
*Context gathered: 2026-03-24*
