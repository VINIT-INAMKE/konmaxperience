# Phase 28: Recipe preparation_type Support - Research

**Researched:** 2026-03-27
**Domain:** Food fulfillment routing, availability calculation forking, schema extension, supply tracking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Four preparation types: `scratch` (default), `batch_prepared`, `ready_to_sell`, `assemble`. Field on Recipe model, default scratch. All existing recipes auto-migrate as scratch.
- **D-02:** Batch-prepared out-of-stock behavior: item shows "out of stock" when no active prep batches exist. NO fallback to ingredient stock availability.
- **D-03:** Availability calculation forks by type:
  - `scratch` — `floor(ingredient_stock / BOM_per_serving)` (current behavior, unchanged)
  - `batch_prepared` — `sum(active PrepBatch.quantity_remaining)` for that recipe. Zero batches = zero availability.
  - `ready_to_sell` — `floor(ingredient_stock / BOM_per_serving)` (BOM has single line: 1 piece of the ingredient = 1 serving)
  - `assemble` — `min(availability of each component)` where each component uses its own recipe's preparation_type logic recursively
- **D-04:** Deduction timing forks: scratch deducts at KDS "ready". Non-scratch (batch_prepared, ready_to_sell, assemble) deducts at order confirmation.
- **D-05:** Order items for non-scratch types auto-set to `status: 'ready'` on creation.
- **D-06:** KDS filters to scratch items only — `zone_id IS NOT NULL` AND `menuItem.recipe.preparation_type = 'scratch'`.
- **D-07:** New "Pick & Pack" page under Kitchen section. Shows non-scratch order items.
- **D-08:** Assemble items show component checklist on Pick & Pack. Staff checks off each component then marks complete.
- **D-09:** Mixed orders route correctly — scratch to KDS, non-scratch to Pick & Pack. Order status "ready" only when ALL items across both queues are ready.
- **D-10:** Batch-prepared FIFO: consume from batch expiring soonest first.
- **D-11:** Three usage types on Ingredient: `recipe_input` (default), `supply`, `equipment`. All existing auto-migrate as recipe_input.
- **D-12:** Supplies: tracked via IngredientStock, use full procurement pipeline, manual end-of-day logging only. New `movement_type: 'supply_usage'`.
- **D-13:** Equipment: tracked by count via IngredientStock, no usage logging, manual adjustment only.
- **D-14:** Supplies and equipment excluded from recipe BOM lookups and availability calculations.
- **D-15:** New "Supply Usage" page under Kitchen section. Two-column layout matching Waste Log pattern.
- **D-16:** New `IngredientCategory` model: `id`, `name` (unique), `sort_order`, `is_default`. Replaces hardcoded `category` string on Ingredient.
- **D-17:** Seed 25-30 categories covering real kitchen needs.
- **D-18:** Admin can add custom categories. Seeded categories (`is_default: true`) cannot be deleted.
- **D-19:** Recipe form gets `preparation_type` selector (RadioGroup, 4 options).
- **D-20:** `ready_to_sell` recipes: prep_steps and cooking_method become optional.
- **D-21:** Ingredient form gets `usage_type` selector.
- **D-22:** Category dropdown switches from hardcoded list to DB-driven lookup.

### Claude's Discretion
- Pick & Pack page layout and interaction details (card style, sorting, grouping by order)
- Component checklist visual design for assemble items
- Supply Usage page layout details
- Category management UI placement (standalone settings section vs. inline on ingredients page)
- Migration strategy for converting existing `category` string values to IngredientCategory FK references

### Deferred Ideas (OUT OF SCOPE)
- Non-food marketplace items (art, merchandise, lifestyle products)
- Per-channel item availability
- Disposable supply auto-deduction per order channel
- Batch-prepared fallback to ingredient availability
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R28-01 | Add `preparation_type` field to Recipe model with 4 values; default scratch | Schema migration pattern confirmed — add nullable String, then migrate resolve |
| R28-02 | Fork availability calculation in `menu.service.ts computeServings` by preparation_type | `computeServings` location and signature fully read — fork point at start of method |
| R28-03 | KDS `getActiveOrders` filters to scratch items only | KDS service line 44-95 fully read — add recipe join + preparation_type filter |
| R28-04 | Non-scratch items deduct at order confirmation, auto-set status='ready' | `createOrder` and `confirmOrder` both read — injection point clear |
| R28-05 | Add `usage_type` field to Ingredient model (recipe_input/supply/equipment) | Ingredient model line 415-429 read — additive String field migration |
| R28-06 | Supplies/equipment excluded from recipe BOM ingredient options | `IngredientsService.findAll` already accepts where filter — add `usage_type` guard |
| R28-07 | New "Pick & Pack" page showing non-scratch order items with pick/assemble workflow | KdsBoard pattern and KdsOrderCard pattern fully studied — direct adapt |
| R28-08 | New "Supply Usage" page with history table + log form | WasteLogPage + WasteLogForm fully read — direct mirror |
| R28-09 | Add `IngredientCategory` model replacing hardcoded category string | Schema + Prisma migration pattern confirmed; FK migration strategy researched |
| R28-10 | Seed 25-30 IngredientCategory records with `is_default: true` | Seed.ts pattern confirmed; upsert pattern used for idempotent seeding |
| R28-11 | Admin can add/delete custom categories (categories page or ingredients section) | CRUD pattern and sidebar integration confirmed |
| R28-12 | Recipe form adds preparation_type RadioGroup selector | RecipeMetaGrid.tsx fully read — extend before Brand row |
| R28-13 | Ingredient form adds usage_type selector + DB-driven category dropdown | IngredientForm.tsx fully read — extend sheet |
| R28-14 | Availability badges updated to reflect preparation_type (menu, POS, marketplace) | UI spec defines exact badge styles per type — confirmed in frontend types |
| R28-15 | Sidebar adds "Pick & Pack" and "Supply Usage" under Kitchen section | `kitchenNav` array in Sidebar.tsx fully read — append two entries |
</phase_requirements>

---

## Summary

Phase 28 is a vertical slice through the entire stack — schema, service logic, and frontend UI — that introduces food product type awareness across the system. The core problem: the existing pipeline only knows how to handle scratch (made-to-order) recipes, but the business also sells batch-prepared items, packaged goods, and assembled gift boxes that each have different stock sources, deduction timing, and kitchen routing.

The codebase is well-structured for this change. The key insertion points are already identified: `computeServings` in `menu.service.ts` needs a branch at the method entry, `createOrder`/`confirmOrder` need to detect non-scratch types and deduct immediately, `kds.service.ts getActiveOrders` needs one additional JOIN filter, and `deductItemIngredients` is already capable of handling all cases and doesn't need forking — it just needs to be called earlier for non-scratch types.

The secondary domain (Ingredient usage_type + IngredientCategory) is purely additive. The `usage_type` field gates ingredient visibility in BOM selectors and availability calculations. The IngredientCategory model replaces the hardcoded 6-value enum with a DB-driven table that supports custom categories. Both involve straightforward Prisma schema additions and a migration to backfill existing data.

**Primary recommendation:** Execute in five logical waves: (1) schema migrations for both Recipe and Ingredient fields + IngredientCategory model + seed, (2) backend service logic fork for availability and deduction, (3) new backend routes for Pick & Pack queue + Supply Usage CRUD + IngredientCategories, (4) frontend forms updated with new fields, (5) Pick & Pack and Supply Usage pages + sidebar entries.

---

## Standard Stack

### Core (already in use — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 6.x | Schema migration + ORM | Project standard, v6 locked per feedback |
| NestJS | 11.x | Backend modules + controllers | Project standard |
| Next.js | Latest (read from node_modules/next/dist/docs/) | Frontend routing | Project standard |
| TanStack Query | 5.x | Frontend data fetching + cache invalidation | Project standard — used in WasteLogForm, KdsBoard |
| shadcn base-nova | - | Component library | Project standard — base-ui components |
| lucide-react | - | Icons | Project standard |
| sonner | - | Toast notifications | Project standard |
| RadioGroup | shadcn (not yet installed) | preparation_type + usage_type segmented selector | `npx shadcn add radio-group` — per UI spec |

### New Install Required

```bash
# In frontend/ directory:
npx shadcn add radio-group
```

This is the only new component install. All other components are already available.

---

## Architecture Patterns

### Pattern 1: Schema Migration — additive String fields with default

Add `preparation_type String @default("scratch")` to Recipe and `usage_type String @default("recipe_input")` to Ingredient. These are non-nullable String fields with defaults, so existing rows get the default value automatically — no data migration needed for these two fields.

```prisma
// backend/prisma/schema.prisma — Recipe model addition
model Recipe {
  // ... existing fields ...
  preparation_type  String  @default("scratch")
  // Values: 'scratch' | 'batch_prepared' | 'ready_to_sell' | 'assemble'
}

// Ingredient model addition
model Ingredient {
  // ... existing fields ...
  usage_type  String  @default("recipe_input")
  // Values: 'recipe_input' | 'supply' | 'equipment'
}
```

**Migration approach:** Manual SQL migration (consistent with project pattern from Phase 14/17/20/23). Create the file with `prisma migrate --create-only`, then `prisma migrate deploy`. Do NOT use `prisma migrate dev` in this project — it resets the database.

### Pattern 2: IngredientCategory model with FK migration

This is the more complex migration. The Ingredient.category field (currently a String like `'dairy'`, `'vegetable'`) must become a FK to IngredientCategory. Two steps:

1. Add `IngredientCategory` model + `category_id` nullable FK to Ingredient
2. Seed IngredientCategory rows, update existing Ingredient rows to set category_id, then drop the old `category` string field

**Recommended migration strategy:**
- Migration 1: Add IngredientCategory table + `category_id String? @relation` to Ingredient (keep old `category` String)
- Seed IngredientCategory rows in seed.ts (using upsert on name for idempotency)
- Migration 2 (data migration SQL): `UPDATE "Ingredient" SET category_id = (SELECT id FROM "IngredientCategory" WHERE name = CASE "Ingredient".category WHEN 'dairy' THEN 'Dairy' ... END)`
- Migration 3: Make `category_id` non-nullable, drop old `category` column

The mapping from old string values to new category names:
- `'dairy'` → "Dairy"
- `'vegetable'` → "Vegetables"
- `'spice'` → "Spices (dried)"
- `'grain'` → "Grains & Cereals"
- `'meat'` → "Proteins (meat)"
- `'oil'` → "Oils & Fats"

**Alternative (simpler if little production data exists):** Keep both fields during migration wave, set category_id from category string lookup, then remove old category string in a later plan.

```prisma
model IngredientCategory {
  id         String       @id @default(uuid())
  name       String       @unique
  sort_order Int          @default(0)
  is_default Boolean      @default(false)
  ingredients Ingredient[]
}

model Ingredient {
  // ... existing fields ...
  usage_type    String             @default("recipe_input")
  category_id   String
  category_obj  IngredientCategory @relation(fields: [category_id], references: [id])
  // OLD: category String -- removed after migration
}
```

### Pattern 3: Availability calculation fork in computeServings

The `computeServings` method in `menu.service.ts` (lines 248-347) is the single source of truth for availability. The fork goes at method entry:

```typescript
// Source: backend/src/menu/menu.service.ts (modified)
private async computeServings(menuItem: { ... }, ...) {
  if (!menuItem.available || menuItem.status !== 'active') {
    return { available: false, servings_remaining: 0 };
  }

  const prepType = menuItem.recipe.preparation_type ?? 'scratch';

  // batch_prepared: sum of active prep batches for the recipe itself
  if (prepType === 'batch_prepared') {
    const total = prefetchedBatches?.get(menuItem.recipe.id) ?? 0;
    // (batches pre-fetched by recipe_id, not by BOM line source_recipe_id)
    return { available: total > 0, servings_remaining: total };
  }

  // assemble: recursive min across all BOM components
  // Each component line is a recipe reference — resolve each component's availability
  if (prepType === 'assemble') {
    let min = Infinity;
    for (const line of menuItem.recipe.RecipeLines) {
      if (line.input_type === 'recipe' && line.source_recipe_id) {
        const compAvail = await this.computeServingsForRecipe(
          line.source_recipe_id, prefetchedStocks, prefetchedBatches
        );
        // scale by quantity (how many servings of component per serving of assembled item)
        // simplification: quantity=1 for gift boxes, but honor the BOM
        min = Math.min(min, compAvail);
      }
    }
    const remaining = min === Infinity ? 0 : min;
    return { available: remaining > 0, servings_remaining: remaining };
  }

  // scratch + ready_to_sell: existing ingredient-stock logic (lines 272-346)
  // Only difference: usage_type='recipe_input' filter already applied via BOM (supplies/equipment never added to BOM)
  // ... existing loop unchanged ...
}
```

**Important note on `batch_prepared` availability:** The batch_prepared recipe's availability comes from PrepBatch records for that recipe's OWN id — not from a BOM ingredient line. The current `getAllServingsAvailable` pre-fetches batches by `source_recipe_id` in BOM lines. For batch_prepared recipes, we need batches keyed by `recipe_id` directly. The prefetch logic in `getAllServingsAvailable` must be extended to also fetch batches for recipes with `preparation_type = 'batch_prepared'`.

### Pattern 4: Non-scratch deduction at order confirmation

Both `orders.service.ts createOrder` (POS) and `customer-orders.service.ts confirmOrder` (marketplace) need to detect non-scratch items and deduct immediately. Pattern:

```typescript
// After order is created in transaction, for each item:
const recipe = await tx.menuItem.findUnique({
  where: { id: item.menu_item_id },
  select: { recipe: { select: { preparation_type: true } } }
});

if (recipe?.recipe?.preparation_type !== 'scratch') {
  // 1. Auto-set item status to 'ready'
  await tx.orderItem.update({ where: { id: item.id }, data: { status: 'ready', ready_at: new Date() } });
  // 2. Deduct immediately (reuse existing deductItemIngredients — already handles BOM for ready_to_sell,
  //    and batch FIFO for batch_prepared via source_recipe lines)
  await this.deductItemIngredients(tx, item, userId, zoneId);
}
```

**Existing `deductItemIngredients` compatibility:** For `ready_to_sell`, BOM has one ingredient line (1 piece = 1 serving) — deduction hits `input_type === 'ingredient'` branch. For `batch_prepared`, the recipe itself IS the source — but `deductItemIngredients` operates on RecipeLines. A `batch_prepared` recipe's BOM may not have a self-referential `input_type: 'recipe'` line. Instead, the deduction needs to call PrepBatch FIFO directly against the recipe_id. This is a key difference that must be designed carefully.

**Resolution:** For `batch_prepared` items: deduction does NOT go through `deductItemIngredients` (which expects BOM lines). Instead, inline FIFO deduction against PrepBatch by recipe_id, following the same FIFO pattern in `deductItemIngredients` lines 712-762. For `assemble` items: `deductItemIngredients` works naturally — RecipeLines have `input_type: 'recipe'` lines pointing to component recipes, each component handles its own deduction type recursively.

### Pattern 5: KDS filter for scratch-only

Current `getActiveOrders` in `kds.service.ts` (line 44):

```typescript
// Add to the include and where:
include: {
  items: {
    where: {
      // Only scratch items shown in KDS
      menu_item: {
        recipe: { preparation_type: 'scratch' }
      }
    },
    include: { menu_item: { select: { id: true, name: true } } }
  },
  // ...
}
```

Note: Prisma supports nested `where` inside `include` for filtering related records. This is a relation filter — only order items where the linked recipe has `preparation_type = 'scratch'` will be returned.

**Alternative:** Filter in application code after fetching all items. Either works — relation filter is cleaner and avoids returning unnecessary data.

### Pattern 6: Pick & Pack backend endpoint

New endpoint: `GET /kitchen/pick-and-pack` — returns active orders that have at least one non-scratch item, with item-level preparation_type and (for assemble) component checklist.

```typescript
// Response shape
interface PickAndPackOrder {
  id: string;
  order_number: number;
  customer_name: string | null;
  created_at: string;
  channel: string;
  items: PickAndPackItem[];
}

interface PickAndPackItem {
  id: string;
  status: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  item_notes: string | null;
  preparation_type: string; // 'batch_prepared' | 'ready_to_sell' | 'assemble'
  components?: AssembleComponent[]; // only for assemble
}

interface AssembleComponent {
  recipe_id: string;
  recipe_name: string;
  quantity: number;
  unit: string;
}
```

Fetching: Join Order -> items (where status != 'ready') -> menu_item -> recipe (where preparation_type != 'scratch'). For assemble items, include RecipeLines with source_recipe names.

### Pattern 7: Supply Usage backend

New service + controller following waste.service.ts pattern exactly:

```typescript
// POST /kitchen/supply-usage
interface CreateSupplyUsageDto {
  ingredient_id: string; // must be usage_type = 'supply'
  quantity: number;
  unit: string;
  notes?: string;
  zone_id: string;
}
```

Creates a `StockMovement` with `movement_type: 'supply_usage'` and decrements `IngredientStock.current_quantity`. No cost_impact calculation needed (supplies are consumables, not directly cost-tracked per use).

### Pattern 8: IngredientCategory CRUD endpoints

New module: `IngredientCategoriesModule` with:
- `GET /ingredient-categories` — returns all categories sorted by sort_order
- `POST /ingredient-categories` — creates custom category (name unique)
- `DELETE /ingredient-categories/:id` — only if `is_default = false`, else 400

### Recommended Project Structure Changes

```
backend/src/
├── kitchen/
│   ├── kds/                    # Modified: add prep_type filter
│   ├── pick-and-pack/          # New: PickAndPackModule, service, controller
│   ├── supply-usage/           # New: SupplyUsageModule, service, controller, DTO
│   ├── waste/                  # Unchanged
│   └── prep-batches/           # Unchanged
├── ingredient-categories/      # New: IngredientCategoriesModule, service, controller, DTO
├── ingredients/                # Modified: add usage_type to DTO/service
├── menu/                       # Modified: computeServings fork
└── orders/                     # Modified: createOrder non-scratch deduction

frontend/
├── app/(ops)/operations/kitchen/
│   ├── pick-and-pack/          # New: page.tsx
│   └── supply-usage/           # New: page.tsx
├── components/ops/kitchen/
│   ├── pick-and-pack/          # New: PickAndPackBoard, PickAndPackOrderCard, AssembleChecklist
│   └── supply-usage/           # New: SupplyUsageForm, SupplyUsageRow
├── components/ops/operations/recipes/builder/
│   └── RecipeMetaGrid.tsx      # Modified: add preparation_type RadioGroup
└── components/ops/operations/ingredients/
    └── IngredientForm.tsx      # Modified: usage_type selector, DB category
```

### Anti-Patterns to Avoid

- **Calling `deductItemIngredients` for `batch_prepared` items via BOM lines:** The method expects ingredient BOM lines. `batch_prepared` deduction is direct against PrepBatch by recipe_id. Use inline FIFO code (copy the pattern from lines 712-762 of `deductItemIngredients`) rather than routing through the BOM.
- **Fetching recipe.preparation_type in getAllServingsAvailable without including it in the Prisma query:** The current query does not select `preparation_type`. It must be added to the `include: { recipe: { include: { ... } } }` select to avoid undefined at runtime.
- **Setting status='ready' for non-scratch items at KDS:** The KDS should not receive these items. The `status: 'ready'` is set at order creation time. Do not modify KDS status update logic for non-scratch items.
- **Assigning category_id in IngredientForm before seed runs:** Category dropdown will be empty if the `GET /ingredient-categories` endpoint returns nothing because seed hasn't run. Seed must include IngredientCategory rows in the same wave as the schema migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FIFO batch deduction | Custom depletion logic | Copy from `deductItemIngredients` lines 712-762 | Same FIFO pattern, exact Prisma ops — not complex but proven |
| Availability pre-fetch | New fetch mechanism | Extend existing `stockMap` / `batchMap` in `getAllServingsAvailable` | Already handles N+1 avoidance — just expand the batch pre-fetch scope |
| Order completion detection | New all-ready check | Reuse existing `notReadyCount` pattern in `kds.service.ts` lines 167-174 | Already accounts for "exclude current item being marked ready" edge case |
| Unit conversion | Custom converter | Existing `convertUnit` from `common/utils/unit-conversion` | Already handles all unit families with DB-driven conversion factors |
| Radio button segmented control | Bespoke styled buttons | `shadcn add radio-group` — RadioGroup + RadioGroupItem | Accessible focus/keyboard, consistent with design system |
| Supply deduction stock movement | Direct SQL update | `StockMovement` create + `IngredientStock` decrement (existing pattern) | Audit trail maintained, same pattern as `deductItemIngredients` |

**Key insight:** Every complex behavior in this phase has a proven pattern already in the codebase. The implementation is primarily wiring — routing through forks using existing primitives.

---

## Common Pitfalls

### Pitfall 1: availability computation for batch_prepared double-counts

**What goes wrong:** The current `getAllServingsAvailable` pre-fetches PrepBatches by `source_recipe_id` found in BOM `input_type: 'recipe'` lines. For a `batch_prepared` recipe, there is no such BOM line pointing to itself — the recipe IS the batch source. The `batchMap` will return 0 for this recipe, showing it as unavailable even with active batches.

**Why it happens:** Current code only collects `recipeIds` from `input_type === 'recipe'` BOM lines. A `batch_prepared` recipe's PrepBatches are keyed by the recipe's own ID, not by a sub-recipe reference.

**How to avoid:** In `getAllServingsAvailable`, after the initial loop, also collect recipe IDs for all `batch_prepared` recipes and include them in the batch pre-fetch WHERE clause.

**Warning signs:** Menu shows batch_prepared items as "out of stock" despite active PrepBatch records for that recipe.

### Pitfall 2: mixed order "all ready" logic breaks when non-scratch items skip KDS

**What goes wrong:** Current `kds.service.ts updateItemStatus` sets order status to `'ready'` when `notReadyCount === 0` (all items ready). If non-scratch items are auto-set to `status: 'ready'` at order creation, the KDS "mark ready" for the last scratch item will check notReadyCount and find 0 (non-scratch items already ready) — the order transitions correctly. This actually works fine.

**The real risk:** If the non-scratch items are NOT set to `status: 'ready'` at order creation, a scratch-only KDS marking the last item ready will see non-scratch siblings still in `pending` status and the order will never auto-complete.

**How to avoid:** Ensure D-05 is implemented first: all non-scratch order items get `status: 'ready'` synchronously during the `createOrder` / `confirmOrder` transaction, before any KDS interaction.

**Warning signs:** POS orders with mixed items never transition to order `status: 'ready'`.

### Pitfall 3: IngredientCategory FK migration fails if old category values are not in the mapping

**What goes wrong:** The data migration SQL maps old string values to new category names. If any existing Ingredient row has a `category` value not covered by the CASE statement (e.g., a typo or a value added via import), `category_id` will be NULL and the subsequent NOT NULL constraint will fail.

**How to avoid:** Run a pre-migration audit: `SELECT DISTINCT category FROM "Ingredient"` and ensure all returned values are in the CASE mapping. Add a catch-all ELSE clause in the SQL that maps unknown values to a default "Other" category.

**Warning signs:** Migration deploy fails with constraint violation on `category_id NOT NULL`.

### Pitfall 4: BOM ingredient selector does not filter by usage_type

**What goes wrong:** The recipe builder's BOM line ingredient selector calls `GET /ingredients` which returns all ingredients. After adding `usage_type`, supplies and equipment will appear as selectable BOM ingredients, violating D-14.

**How to avoid:** Add a `usage_type` query param to `GET /ingredients` and ensure the recipe builder fetches `?usage_type=recipe_input`. The `IngredientsService.findAll` already accepts a `where` filter — extend it to accept `usage_type` filtering.

**Warning signs:** Parchment paper and mixing bowls appear in recipe ingredient dropdowns.

### Pitfall 5: preparation_type not included in RecipeLines Prisma query

**What goes wrong:** `computeServings` receives the recipe object. The current type signature for `recipe` in `computeServings` does not include `preparation_type` (it was not a field before this phase). After adding the field to the schema, all Prisma `include` statements that load recipes must also `select: { preparation_type: true }`.

**How to avoid:** Search all `recipe: { include: { RecipeLines: ...` queries and add `preparation_type: true` to the select. Key locations: `menu.service.ts getServingsAvailable` line 354, `getAllServingsAvailable` line 374.

**Warning signs:** TypeScript compiler error `property 'preparation_type' does not exist` on recipe type OR runtime `undefined` causing the fork to always take the default branch.

### Pitfall 6: `ready_to_sell` recipe with optional prep_steps causes NOT NULL violation

**What goes wrong:** Current schema has `prep_steps String` and `cooking_method String` as required (non-nullable) fields on Recipe. D-20 says these become optional for `ready_to_sell`. If the DB column remains NOT NULL and the form submits empty strings, it works — but it's wrong semantically.

**How to avoid:** Change `prep_steps` and `cooking_method` to `String?` (nullable) in schema migration. Backend DTO validation: make them optional. Frontend: already handles optional via textarea with empty string. When both are empty and `preparation_type = 'ready_to_sell'`, submit null.

**Warning signs:** Prisma validation error on Recipe create when prep_steps is null.

---

## Code Examples

### Availability fork entry point

```typescript
// Source: backend/src/menu/menu.service.ts — computeServings (to modify)
private async computeServings(menuItem: MenuItemWithRecipe, ...) {
  if (!menuItem.available || menuItem.status !== 'active') {
    return { available: false, servings_remaining: 0 };
  }

  const prepType = menuItem.recipe.preparation_type ?? 'scratch';

  if (prepType === 'batch_prepared') {
    // Direct recipe-level batch lookup (not BOM-line-level)
    const batchTotal = prefetchedBatches?.get(menuItem.recipe.id) ?? 0;
    return { available: batchTotal > 0, servings_remaining: Math.floor(batchTotal) };
  }

  // assemble and scratch/ready_to_sell fall through to existing BOM loop
  // (assemble's BOM lines are all input_type:'recipe', each resolved recursively)
}
```

### Non-scratch deduction at createOrder

```typescript
// Source: backend/src/orders/orders.service.ts — inside $transaction after order creation
for (const item of created.items) {
  const menuItem = await tx.menuItem.findUnique({
    where: { id: item.menu_item_id },
    select: { recipe: { select: { preparation_type: true } } },
  });
  const prepType = menuItem?.recipe?.preparation_type ?? 'scratch';

  if (prepType !== 'scratch') {
    // Auto-ready: non-scratch items skip KDS
    await tx.orderItem.update({
      where: { id: item.id },
      data: { status: 'ready', ready_at: new Date() },
    });
    // Deduct immediately
    if (prepType === 'batch_prepared') {
      await this.deductBatchPrepared(tx, menuItem.recipe.id, item.quantity, userId, created.id);
    } else {
      // ready_to_sell and assemble: deductItemIngredients handles BOM
      await this.deductItemIngredients(tx, item, userId, zoneId);
    }
  }
}
```

### KDS scratch-only filter

```typescript
// Source: backend/src/kitchen/kds/kds.service.ts — getActiveOrders (to modify)
items: {
  where: {
    menu_item: {
      recipe: { preparation_type: 'scratch' }
    }
  },
  include: {
    menu_item: {
      select: { id: true, name: true }
    }
  },
}
```

### Pick & Pack page (frontend) — adapts KdsBoard pattern

```typescript
// Source: frontend/components/ops/kitchen/kds/KdsBoard.tsx (adapted)
const { data: orders } = useQuery({
  queryKey: ['pick-and-pack'],
  queryFn: () => apiClient.get<PickAndPackOrder[]>('/kitchen/pick-and-pack'),
  refetchInterval: 5000,
});
```

### Sidebar kitchen nav extension

```typescript
// Source: frontend/components/ops/Sidebar.tsx — kitchenNav array (to extend)
const kitchenNav: NavItem[] = can('MANAGE_KITCHEN')
  ? [
      { label: 'Dashboard', href: '/operations/kitchen/dashboard', icon: <LayoutDashboard /> },
      { label: 'KDS', href: '/operations/kitchen/kds', icon: <Monitor /> },
      { label: 'Pick & Pack', href: '/operations/kitchen/pick-and-pack', icon: <Package /> },
      { label: 'Prep Batches', href: '/operations/kitchen/prep-batches', icon: <ChefHat /> },
      { label: 'Supply Usage', href: '/operations/kitchen/supply-usage', icon: <ClipboardList /> },
      { label: 'Waste Log', href: '/operations/kitchen/waste', icon: <Trash2 /> },
    ]
  : [];
// Also add to SECTION_ROUTES['Kitchen'] prefix array: '/operations/kitchen/'  (already covers it)
```

### IngredientCategory seed pattern

```typescript
// Source: backend/prisma/seed.ts — new section
const INGREDIENT_CATEGORIES = [
  { name: 'Dairy', sort_order: 1, is_default: true },
  { name: 'Vegetables', sort_order: 2, is_default: true },
  { name: 'Fruits', sort_order: 3, is_default: true },
  // ... 25-30 total
];

for (const cat of INGREDIENT_CATEGORIES) {
  await prisma.ingredientCategory.upsert({
    where: { name: cat.name },
    update: {},
    create: cat,
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `category` String on Ingredient | FK to `IngredientCategory` table | Phase 28 | Admins can extend categories without code changes |
| Single deduction path (KDS ready event) | Forked deduction: KDS ready (scratch) vs order confirm (non-scratch) | Phase 28 | Prevents double-selling of pre-made items |
| KDS shows all order items | KDS shows scratch items only | Phase 28 | Kitchen staff only sees items requiring cooking |

**Deprecated/outdated:**
- `INGREDIENT_CATEGORIES` and `INGREDIENT_CATEGORY_LABELS` constants in `frontend/lib/types/ingredient.ts`: replaced by API call to `GET /ingredient-categories`. Remove after migration complete.
- `IngredientCategory` TypeScript type in `frontend/lib/types/ingredient.ts` (currently `'dairy' | 'vegetable' | 'spice' | 'grain' | 'meat' | 'oil'`): replaced by `{ id: string; name: string; sort_order: number; is_default: boolean }`.

---

## Open Questions

1. **Where does zone_id come from for non-scratch deduction in POS createOrder?**
   - What we know: `createOrder` in `orders.service.ts` takes `dto.zone_id`. For POS scratch orders, the zone is the kitchen zone. Non-scratch items can be picked from any shelf — zone context may not apply the same way.
   - What's unclear: Should the stock deduction for `ready_to_sell` items use the order's zone_id, or a default zone? Current `deductItemIngredients` uses `zoneId` to find `IngredientStock` — if the item is stored in a different zone than the kitchen, the deduction will fail with "Insufficient stock."
   - Recommendation: Use the order's `zone_id` if present; if null (customer marketplace orders), use the first zone with sufficient stock. This matches existing behavior for customer orders where `zone_id` is null.

2. **assemble item deduction: does it recurse all the way down?**
   - What we know: `deductItemIngredients` already handles `input_type: 'recipe'` lines by doing FIFO batch deduction for that source_recipe. For an assemble item, each component is a `source_recipe_id` pointing to another recipe.
   - What's unclear: If an assemble component is itself `batch_prepared`, `deductItemIngredients` will try to FIFO against its PrepBatches — which is correct. If a component is `ready_to_sell`, it has an ingredient line and stock will be deducted — also correct. The recursion through `deductItemIngredients` handles the existing sub-recipe BOM lines naturally.
   - Recommendation: No special handling needed for assemble deduction — `deductItemIngredients` already handles the sub-recipe pattern correctly for all sub-types.

3. **Pick & Pack item "mark picked" — does this write to the DB?**
   - What we know: Non-scratch items are auto-set to `status: 'ready'` at order creation. They don't need staff to mark them ready via DB mutation.
   - What's unclear: The Pick & Pack page shows items that are `status: 'ready'` but physically not yet picked. If there's no DB state for "physically picked", the queue will keep showing them after they're picked.
   - Recommendation: "Mark Picked" on Pick & Pack should call `PATCH /kitchen/kds/items/:id/status` with `status: 'ready'` (already the state) — but this won't change state. Alternative: Add a new status `'picked'` for non-scratch items, or use the existing `ready_at` timestamp as a signal and remove the item from the queue once the order status transitions to `'ready'`. Simplest: hide items from Pick & Pack queue once order is `status: 'ready'` and all items are `status: 'ready'`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (NestJS testing module) |
| Config file | `backend/package.json` — `"test": "jest"` |
| Quick run command | `cd backend && npx jest --testPathPattern="kds|menu|orders|customer-orders" --no-coverage` |
| Full suite command | `cd backend && npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R28-02 | computeServings forks by preparation_type | unit | `cd backend && npx jest menu.service --no-coverage` | ❌ Wave 0 |
| R28-03 | KDS getActiveOrders returns only scratch items | unit | `cd backend && npx jest kds.service --no-coverage` | ✅ (extend existing) |
| R28-04 | createOrder deducts non-scratch items immediately, sets status='ready' | unit | `cd backend && npx jest orders.service --no-coverage` | ✅ (extend existing) |
| R28-04 | confirmOrder deducts non-scratch items immediately | unit | `cd backend && npx jest customer-orders.service --no-coverage` | ✅ (extend existing) |
| R28-06 | Supplies/equipment excluded from BOM selectors (GET /ingredients?usage_type=recipe_input) | unit | `cd backend && npx jest ingredients.service --no-coverage` | - |
| R28-09 | IngredientCategory CRUD: create, list, delete (default protected) | unit | `cd backend && npx jest ingredient-categories --no-coverage` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx jest --testPathPattern="<relevant-spec>" --no-coverage`
- **Per wave merge:** `cd backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/menu/menu.service.spec.ts` — covers R28-02 (availability fork by preparation_type): batch_prepared returns sum of batches, ready_to_sell uses ingredient stock, assemble uses min of components, scratch unchanged
- [ ] `backend/src/ingredient-categories/ingredient-categories.service.spec.ts` — covers R28-09: create, findAll, delete (default protected returns 400), delete custom succeeds
- [ ] `backend/src/kitchen/pick-and-pack/pick-and-pack.service.spec.ts` — covers R28-07: returns non-scratch items, excludes already-ready orders
- [ ] `backend/src/kitchen/supply-usage/supply-usage.service.spec.ts` — covers R28-08: creates StockMovement with movement_type='supply_usage', validates ingredient must be usage_type='supply'

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `backend/src/menu/menu.service.ts` — computeServings + getAllServingsAvailable implementation
- Direct codebase read: `backend/src/kitchen/kds/kds.service.ts` — getActiveOrders filter pattern
- Direct codebase read: `backend/src/orders/orders.service.ts` — createOrder + deductItemIngredients full implementation
- Direct codebase read: `backend/src/customer-orders/customer-orders.service.ts` — confirmOrder transaction structure
- Direct codebase read: `backend/prisma/schema.prisma` — all relevant models (Recipe, Ingredient, OrderItem, PrepBatch, StockMovement, WasteLog)
- Direct codebase read: `frontend/components/ops/kitchen/kds/KdsBoard.tsx`, `KdsOrderCard.tsx` — adaptation pattern
- Direct codebase read: `frontend/app/(ops)/operations/kitchen/waste/page.tsx` + `WasteLogForm.tsx` — mirror pattern
- Direct codebase read: `frontend/components/ops/Sidebar.tsx` — kitchenNav structure
- Direct codebase read: `frontend/components/ops/operations/recipes/builder/RecipeMetaGrid.tsx` — form extension point
- Direct codebase read: `frontend/components/ops/operations/ingredients/IngredientForm.tsx` — form extension point
- Direct codebase read: `frontend/lib/types/ingredient.ts` — current hardcoded categories to replace

### Secondary (MEDIUM confidence)
- Project history (STATE.md): Manual SQL migration + `prisma migrate deploy` pattern (established in Phases 14, 17, 20, 23)
- CONTEXT.md decisions: All R28-01 through R28-22 locked decisions verified against codebase

### Tertiary (LOW confidence)
- None — all claims grounded in direct codebase reads

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, one new install (radio-group) per UI spec
- Architecture: HIGH — all integration points read directly from source files
- Pitfalls: HIGH — each pitfall derived from careful reading of actual code behavior, not hypothetical

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable codebase, no fast-moving dependencies)
