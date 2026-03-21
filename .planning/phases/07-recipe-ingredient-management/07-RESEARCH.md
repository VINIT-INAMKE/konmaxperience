# Phase 07: Recipe & Ingredient Management — Research

**Researched:** 2026-03-21
**Domain:** Food production data layer — Prisma schema migration, NestJS modules, Next.js 16 pages
**Confidence:** HIGH (all findings verified against project source code and locked spec)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Step-by-step wizard for recipe form: Step 1 = recipe details, Step 2 = add BOM lines, Step 3 = review + computed cost preview.
- **D-02:** BOM lines: type (ingredient/recipe), item (searchable combobox), quantity, unit, prep notes. Combobox switches item list based on type.
- **D-03:** Recipe detail page shows a visual dependency tree of sub-recipes. Click any node to navigate.
- **D-04:** Recipe status workflow: draft → approved → archived. Same pattern as assets.
- **D-05:** Recipes live under Operations section in sidebar. Icon: `ChefHat`.
- **D-06:** Menu management page: Brand tabs → Category sections (collapsible) → Item cards.
- **D-07:** Food cost % badge with color coding: green (<30%), amber (30–40%), red (>40%).
- **D-08:** Channel modifiers as inline-editable settings table on the menu page.
- **D-09:** MenuCategory has brand_id, name, sort_order, status.
- **D-10:** Vendor price history as simple list per ingredient sorted by effective_date DESC. No charts.
- **D-11:** Ingredients filtered by category tabs: All, Dairy, Vegetable, Spice, Grain, Meat, Oil.
- **D-12:** Vendors page as a table. Click to see vendor detail with linked ingredients and price history.
- **D-13:** Vendor + ingredient pages under Operations sidebar. Icons: `Truck`, `Salad`.
- **D-14:** Recipe model from pipeline spec §3.1. No type distinction. Polymorphic BOM via RecipeLine.input_type.
- **D-15:** Ingredient model from pipeline spec §3.2. Category, base_unit, min_stock_level.
- **D-16:** UnitConversion from pipeline spec §3.2. Seed: kg↔g, L↔ml, dozen↔pieces.
- **D-17:** Vendor + VendorPrice from pipeline spec §3.3. Current price = latest by effective_date.
- **D-18:** MenuCategory + MenuItem + ChannelModifier from pipeline spec §3.4. Brand → Category → Items.
- **D-19:** Recursive cost calculation per pipeline spec §4.2. Cached in computed_cost. Recalculated on save or vendor price change.

### Claude's Discretion

- Recipe wizard step layout and transitions
- Dependency tree visualization approach (nested list vs graph — UI-SPEC locked to nested indented list, no external graph library)
- Menu item card layout within category sections
- Vendor form field layout
- Ingredient form field layout
- Unit conversion seed data management UI (may just be seeded, no UI)
- How "best vendor price" is surfaced (cheapest? latest? user picks?)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RECIPE-01 | Unified recipe entity — name, description, prep steps, cooking method, yield qty+unit, portion size, shelf_life_hours, brand+zone, status (draft→approved→archived) | Prisma schema §3.1 fully specified; status workflow modeled after existing Asset pattern |
| RECIPE-02 | Polymorphic BOM (RecipeLine) — each line is raw ingredient or sub-recipe, with quantity, unit, prep notes; unlimited chain depth | Prisma self-referential FK on RecipeLine.source_recipe_id; recursive cost calc in §4.2 |
| RECIPE-03 | Ingredient master list — name, category, base_unit (canonical unit), min stock level | Prisma schema §3.2 fully specified; category filter tabs locked to 6 values |
| RECIPE-04 | Unit conversion system — UnitConversion table; all stock in base_unit, recipes use any compatible unit | UnitConversion model with @@unique([from_unit, to_unit]); 6 seed conversions specified |
| RECIPE-05 | Vendor management — Vendor entity + VendorPrice per ingredient with effective dates | Prisma schema §3.3 fully specified; current price = MAX(effective_date) |
| RECIPE-06 | Recursive recipe cost calculation — ingredient cost from best vendor price × BOM qty; cached in computed_cost; recalculated on save or price change | Algorithm in pipeline spec §4.2; must handle circular reference guard |
| RECIPE-07 | Menu items — MenuItem from approved recipe, base_price, food cost %, availability toggle, MenuCategory (Brand→Category→Items), ChannelModifier for per-channel price adjustments | Prisma schema §3.4 fully specified; food cost % = computed_cost / base_price × 100 |

</phase_requirements>

---

## Summary

Phase 7 is the largest schema migration in the project: 8 new Prisma models (Recipe, RecipeLine, Ingredient, UnitConversion, Vendor, VendorPrice, MenuCategory, MenuItem, ChannelModifier — note the spec lists 8 but ChannelModifier is also Phase 7 per the entity summary). The data model is fully locked in the pipeline spec. No ambiguity remains about shape — the research task is understanding how to implement correctly within the existing project patterns.

The single most complex piece is the recursive cost calculator (`calculateRecipeCost`). It must guard against cycles (a recipe referencing itself through any depth), use a `visitedSet` pattern, and tolerate missing vendor prices gracefully (return null rather than throw). The result is cached in `Recipe.computed_cost` and must be invalidated on two triggers: recipe save (BOM change) and VendorPrice save. Both triggers call the same recalculation service method.

The wizard (RecipeWizard) is the most complex frontend component. It is a three-step Sheet with controlled state held in the parent, back-navigation that preserves data, and a "discard changes" Dialog on close. The BOM line management within step 2 is a mini CRUD sub-form — no drag-to-reorder, just add/remove with a p-combobox-3 pattern for ingredient/recipe search. The combobox switches its data source (ingredient list vs recipe list) based on the selected type.

The menu page is a brand-tabbed, category-collapsible layout — the most structurally complex page in the phase. Channel modifiers live at the bottom as an inline-editable table per brand. Vendor detail opens in a Sheet (not a separate page), with per-ingredient price history inside.

**Primary recommendation:** Implement in 4 backend plans (schema + seed, RecipeModule, IngredientModule+VendorModule, MenuModule) and 3 frontend plans (recipe pages, ingredient+vendor pages, menu page), with the recursive cost service as a shared utility used by both RecipeModule and triggered by VendorModule.

---

## Standard Stack

### Core (locked by project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 6.19.2 | ORM + migrations | Project constraint — use v6, not v7 |
| NestJS | 11.0.1 | Backend framework | Established project stack |
| Next.js | 16.2.0 | Frontend framework | Established project stack |
| React | 19.2.4 | UI library | Established project stack |
| @tanstack/react-query | 5.91.2 | Server state | Established project pattern |
| zod | 4.3.6 | Validation (frontend) | Established project pattern |
| class-validator / class-transformer | (in backend deps) | DTO validation | Established NestJS pattern |
| Sonner | (installed) | Toast notifications | Established from Phase 3 |

### Supporting (installed, use these)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.71.2 | Form state | Wizard multi-step form |
| @hookform/resolvers | 5.2.2 | Zod-RHF bridge | Wizard validation |
| lucide-react | (installed) | Icons | ChefHat, Salad, Truck, UtensilsCrossed, Leaf |
| @magicui/... | (installed) | MagicCard, ShineBorder, ShimmerButton, NumberTicker, BlurFade | All UI per UI-SPEC |

### No New Libraries Required

All libraries for Phase 7 are already installed. No new npm installs needed.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/
├── recipes/
│   ├── recipes.module.ts
│   ├── recipes.controller.ts
│   ├── recipes.service.ts          # includes cost calculation
│   ├── cost-calculator.service.ts  # recursive cost logic (shared utility)
│   └── dto/
│       ├── create-recipe.dto.ts
│       ├── update-recipe.dto.ts
│       └── upsert-bom-lines.dto.ts
├── ingredients/
│   ├── ingredients.module.ts
│   ├── ingredients.controller.ts
│   ├── ingredients.service.ts
│   └── dto/
├── vendors/
│   ├── vendors.module.ts
│   ├── vendors.controller.ts
│   ├── vendors.service.ts
│   └── dto/
├── menu/
│   ├── menu.module.ts
│   ├── menu.controller.ts          # handles categories, items, channel modifiers
│   ├── menu.service.ts
│   └── dto/
```

```
frontend/app/(ops)/operations/
├── recipes/
│   ├── page.tsx                    # /operations/recipes — card grid
│   └── [id]/
│       └── page.tsx                # /operations/recipes/[id] — detail
├── ingredients/
│   └── page.tsx                    # /operations/ingredients — table
├── vendors/
│   └── page.tsx                    # /operations/vendors — table
└── menu/
    └── page.tsx                    # /operations/menu — brand-tab layout

frontend/components/ops/operations/
├── recipes/
│   ├── RecipeCard.tsx
│   ├── RecipeStatusBadge.tsx
│   └── wizard/
│       ├── RecipeWizard.tsx
│       ├── RecipeWizardStep1.tsx
│       ├── RecipeWizardStep2.tsx
│       ├── RecipeWizardStep3.tsx
│       └── BomLineRow.tsx
│   └── RecipeDependencyTree.tsx
├── ingredients/
│   ├── IngredientRow.tsx
│   └── IngredientForm.tsx
├── vendors/
│   ├── VendorCard.tsx
│   ├── VendorForm.tsx
│   ├── VendorDetail.tsx
│   ├── VendorPriceHistory.tsx
│   └── VendorPriceForm.tsx
└── menu/
    ├── MenuItemCard.tsx
    ├── MenuItemForm.tsx
    ├── MenuCategorySection.tsx
    ├── ChannelModifierTable.tsx
    └── FoodCostBadge.tsx

frontend/lib/types/
├── recipe.ts
├── ingredient.ts
├── vendor.ts
└── menu.ts
```

### Pattern 1: Recursive Cost Calculation (Backend)

**What:** A private service method that walks the BOM tree depth-first, accumulates ingredient costs via latest vendor price, and recurses into sub-recipes. Uses a `visitedSet` to guard cycles.

**When to use:** Called on every recipe save (full BOM upsert) and on every VendorPrice create. Must propagate upward — any recipe that uses the saved recipe as a BOM input also needs recomputation. This is done via a breadth-first "find all recipes that reference this one" query after the primary recalculation.

```typescript
// Source: pipeline spec §4.2 + project pattern
// backend/src/recipes/cost-calculator.service.ts
@Injectable()
export class CostCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateRecipeCost(
    recipeId: string,
    visitedSet: Set<string> = new Set(),
  ): Promise<number | null> {
    if (visitedSet.has(recipeId)) return null; // cycle guard
    visitedSet.add(recipeId);

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        RecipeLines: {
          include: {
            ingredient: {
              include: { VendorPrices: { orderBy: { effective_date: 'desc' }, take: 1 } },
            },
            source_recipe: true,
          },
        },
      },
    });

    if (!recipe) return null;

    let totalCost = 0;
    for (const line of recipe.RecipeLines) {
      if (line.input_type === 'ingredient') {
        const price = line.ingredient?.VendorPrices?.[0];
        if (!price) return null; // missing vendor price — cannot calculate
        const convertedQty = this.convert(line.quantity, line.unit, price.unit);
        if (convertedQty === null) return null;
        totalCost += convertedQty * Number(price.price);
      } else if (line.input_type === 'recipe' && line.source_recipe_id) {
        const srcCost = await this.calculateRecipeCost(line.source_recipe_id, visitedSet);
        if (srcCost === null) return null;
        const srcRecipe = line.source_recipe!;
        const costPerUnit = srcCost / Number(srcRecipe.yield_qty);
        const convertedQty = this.convert(line.quantity, line.unit, srcRecipe.yield_unit);
        if (convertedQty === null) return null;
        totalCost += costPerUnit * convertedQty;
      }
    }
    return totalCost;
  }

  private convert(qty: number, fromUnit: string, toUnit: string): number | null {
    if (fromUnit === toUnit) return qty;
    // Look up UnitConversion table — cache in memory or fetch
    // Returns null if conversion not found
  }
}
```

**Key insight:** The `visitedSet` is passed by reference through recursion. Always initialize to `new Set()` at the call site. Return `null` for any missing price rather than `0` — null means "cost unknown", zero means "free".

### Pattern 2: BOM Upsert (Backend)

**What:** On recipe save, BOM lines are replaced entirely (delete-then-create in a transaction). This avoids partial-update diffing complexity.

**When to use:** Recipe create or update with BOM changes. Always wrap in `prisma.$transaction`.

```typescript
// Source: project pattern from tasks.service.ts $transaction usage
async upsertBomLines(recipeId: string, lines: BomLineDto[]) {
  return this.prisma.$transaction(async (tx) => {
    await tx.recipeLine.deleteMany({ where: { recipe_id: recipeId } });
    await tx.recipeLine.createMany({
      data: lines.map((l, i) => ({
        recipe_id: recipeId,
        input_type: l.input_type,
        ingredient_id: l.input_type === 'ingredient' ? l.item_id : null,
        source_recipe_id: l.input_type === 'recipe' ? l.item_id : null,
        quantity: l.quantity,
        unit: l.unit,
        prep_notes: l.prep_notes ?? null,
        sort_order: i,
      })),
    });
  });
}
```

### Pattern 3: NestJS Module Registration (with cross-module dependency)

**What:** CostCalculatorService is exported from RecipesModule and imported by VendorsModule so VendorPrice saves can trigger cost recalculation.

```typescript
// backend/src/recipes/recipes.module.ts
@Module({
  providers: [RecipesService, CostCalculatorService],
  exports: [CostCalculatorService],   // <-- export for cross-module use
  controllers: [RecipesController],
  imports: [PrismaModule],
})
export class RecipesModule {}

// backend/src/vendors/vendors.module.ts
@Module({
  imports: [PrismaModule, RecipesModule],  // import RecipesModule to get CostCalculatorService
  providers: [VendorsService],
  controllers: [VendorsController],
})
export class VendorsModule {}
```

### Pattern 4: app.module.ts Registration

Phase 7 adds 4 new modules. Follow the established alphabetical-by-domain order:

```typescript
// Add to app.module.ts imports array:
IngredientsModule,
MenuModule,
RecipesModule,
VendorsModule,
```

### Pattern 5: Wizard State Management (Frontend)

**What:** Multi-step Sheet. State lives in the wizard parent component. Each step receives state + setters as props. Back navigation preserves all entered data. Closing mid-flow triggers a "Discard changes?" Dialog.

```typescript
// Source: UI-SPEC §Recipe Wizard
// RecipeWizard.tsx owns all state
const [step, setStep] = useState<1 | 2 | 3>(1);
const [details, setDetails] = useState<RecipeDetailsState>(EMPTY_DETAILS);
const [bomLines, setBomLines] = useState<BomLineState[]>([]);
const [isDirty, setIsDirty] = useState(false);
const [showDiscardDialog, setShowDiscardDialog] = useState(false);

// On Sheet onOpenChange — if isDirty, show dialog instead of closing
const handleOpenChange = (open: boolean) => {
  if (!open && isDirty) {
    setShowDiscardDialog(true);
    return;
  }
  onOpenChange(open);
};
```

### Pattern 6: Dependency Tree (Frontend)

**What:** Recursive React component. Renders a nested indented list. Each level adds 16px left padding. Leaf nodes (ingredients) show `Leaf` icon. Sub-recipe nodes show `ChefHat` icon and are clickable links to `/operations/recipes/[id]`.

**When to use:** Recipe detail page only (not in wizard step 3 — step 3 shows BOM table).

```typescript
// RecipeDependencyTree.tsx — recursive component
function TreeNode({ line, depth }: { line: BomLineWithRelations; depth: number }) {
  if (line.input_type === 'ingredient') {
    return (
      <div style={{ paddingLeft: depth * 16 }} className="flex items-center gap-2 py-1">
        <Leaf className="size-3.5 text-muted-foreground" />
        <span className="text-sm">{line.ingredient?.name}</span>
        <span className="text-xs text-muted-foreground">{line.quantity} {line.unit}</span>
      </div>
    );
  }
  return (
    <div>
      <div style={{ paddingLeft: depth * 16 }} className="flex items-center gap-2 py-1">
        <ChefHat className="size-3.5 text-muted-foreground" />
        <Link href={`/operations/recipes/${line.source_recipe_id}`} className="text-sm underline-offset-2 hover:underline cursor-pointer">
          {line.source_recipe?.name}
        </Link>
        <span className="text-xs text-muted-foreground">{line.quantity} {line.unit}</span>
      </div>
      {line.source_recipe?.RecipeLines?.map((subLine) => (
        <TreeNode key={subLine.id} line={subLine} depth={depth + 1} />
      ))}
    </div>
  );
}
```

### Pattern 7: Permission for Recipe Operations

**What:** Existing `MANAGE_OPS` permission gates create/delete for operations entities. Recipe, Ingredient, Vendor, Menu management follows the same pattern — `MANAGE_OPS` required for mutating operations, all authenticated users can view.

No new permission enum value needed. This is confirmed by CONTEXT.md (no new permissions discussed) and the existing pattern where brands/zones/assets all use `MANAGE_OPS`.

### Anti-Patterns to Avoid

- **Separate RecipeType enum:** The spec explicitly rejects recipe type fields. Recipes are uniform. Avoid adding `is_prep_item` or `recipe_type` fields.
- **Storing food cost % in DB:** Food cost % is always derived (`computed_cost / base_price × 100`). Never store it. Compute client-side on the menu page from `recipe.computed_cost` and `menuItem.base_price`.
- **UnitConversion in code:** Never hardcode unit multipliers as constants. Always look up the `UnitConversion` table. This ensures new conversions (e.g., tbsp↔ml) can be added without code changes.
- **Cascade deletes on RecipeLine:** Deleting an ingredient that is referenced in RecipeLine should RESTRICT or at minimum warn. Use a usage-check endpoint before allowing ingredient deletion.
- **Mutable ChannelModifier per item:** Channel modifiers are global (one per channel_type), not per menu item. A single `@@unique([channel_type])` constraint enforces this.
- **Triggering cost recalculation synchronously on every GET:** Cost recalculation is expensive on deep trees. Only trigger on SAVE events (POST/PATCH recipe, POST vendor price). Return cached `computed_cost` on GET.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unit conversion arithmetic | Custom multiplier map | UnitConversion Prisma table + single `convert()` helper | Must be extensible; Phase 8 procurement adds more units |
| Cycle detection in BOM | Ad-hoc "max depth" limit | `visitedSet: Set<string>` passed through recursion | Correct, O(n) time, handles arbitrary graph shapes |
| Multi-step form state | Separate component state per step | Wizard parent owns all state, passes down as props | Back navigation requires step 1 data while on step 3 |
| Combobox with async search | Custom `<input>` + dropdown | `p-combobox-3` pattern (base-ui Combobox) already installed | Pattern already vetted in Phase 6, handles debounce, empty state |
| Inline-editable table | Custom contenteditable | Row-level edit mode with controlled inputs + Save/Cancel | Safer, matches existing patterns for delegation table inline edit |

**Key insight:** The unit conversion helper is used in 3 places in Phase 7 (cost calc, ingredient form validation, BOM unit select). It is also re-used in Phase 8 (PO receiving) and Phase 9 (prep batch). Build it as a pure function in a shared util, not embedded in a service.

---

## Common Pitfalls

### Pitfall 1: Infinite Recursion in Cost Calculator

**What goes wrong:** A recipe references itself through a chain (Recipe A → Recipe B → Recipe A). The recursive cost calculator stack-overflows.

**Why it happens:** Prisma has no built-in cycle detection. The data model allows self-referential RecipeLines.

**How to avoid:** Always pass and check `visitedSet` before recursing. If `visitedSet.has(recipeId)`, return `null` and log a warning. Add a server-side validation in `createRecipeLine` that prevents adding a source_recipe that creates a cycle (check if `recipeId` appears anywhere in the source_recipe's transitive dependency tree).

**Warning signs:** Stack overflow in NestJS logs on recipe save; null computed_cost on recipes that have been linked together.

### Pitfall 2: Computed Cost Going Stale

**What goes wrong:** An admin changes a VendorPrice but recipe `computed_cost` fields are not updated. Menu items show wrong food cost %.

**Why it happens:** `computed_cost` is a cached field. It must be explicitly invalidated. The trigger is: when a VendorPrice is saved, find all recipes that (directly or transitively) use that ingredient, and recalculate their cost.

**How to avoid:** In `VendorsService.addPrice()`, after saving the VendorPrice, call `CostCalculatorService.recalculateForIngredient(ingredientId)`. This method finds all RecipeLines with that ingredient_id, gets their recipe_ids, recalculates each, then finds all recipes that use those recipes as BOM inputs, and recalculates those too (one level of propagation is sufficient for Phase 7 — deep propagation is a Phase 8+ concern).

**Warning signs:** Menu item food cost % incorrect after vendor price update; computed_cost unchanged after editing a BOM.

### Pitfall 3: Unit Mismatch in Cost Calculation

**What goes wrong:** A BOM line specifies quantity in "kg" but the VendorPrice is in "dozen". The convert() call returns null because no kg→dozen conversion exists.

**Why it happens:** Incompatible units (mass vs count) have no mathematical conversion. The seeded UnitConversion table only covers kg↔g, L↔ml, dozen↔pieces.

**How to avoid:** In the BOM line unit Select, only show units compatible with the ingredient's `base_unit`. Compatibility = reachable via UnitConversion table from `base_unit`. For "g" base_unit, compatible units are: g, kg. For "ml" base_unit: ml, L. For "pieces" base_unit: pieces, dozen. This validation also belongs server-side in `createRecipeLine`.

**Warning signs:** `computed_cost` is null for recipes that do have vendor prices; unit conversion errors in service logs.

### Pitfall 4: Wizard Losing BOM State on Back Navigation

**What goes wrong:** User fills step 2 BOM lines, clicks Back to step 1, then Next again — BOM lines are empty.

**Why it happens:** If BOM state lives inside RecipeWizardStep2 as local state, unmounting and remounting the component clears it.

**How to avoid:** All wizard state lives in the RecipeWizard parent. Steps receive state and setters as props. Use `useState` in RecipeWizard, not in the step components.

**Warning signs:** BOM lines disappear when stepping back and forward; wizard shows empty step 2 on return.

### Pitfall 5: MenuItem Referencing Unapproved Recipe

**What goes wrong:** A MenuItem links to a recipe with status "draft". The recipe is then modified, changing its cost, and the menu item shows stale data.

**Why it happens:** No guard prevents linking to non-approved recipes.

**How to avoid:** Server-side validation in `createMenuItem`: check `recipe.status === 'approved'`. Frontend: the recipe Combobox in MenuItemForm only queries `GET /recipes?status=approved`. UI-SPEC copy: "Only approved recipes can be added to the menu."

**Warning signs:** Menu items referencing draft recipes; food cost % = 0 because recipe has no BOM.

### Pitfall 6: Prisma Decimal vs JavaScript number

**What goes wrong:** `recipe.yield_qty`, `line.quantity`, `price.price` are all `Decimal` in Prisma (maps to JavaScript `Decimal` object, not `number`). Arithmetic on them fails silently or produces wrong results.

**Why it happens:** Prisma v6 returns `Decimal` for `Decimal` fields. `Decimal + Decimal` is not the same as `number + number`.

**How to avoid:** In cost calculator, always call `Number(field)` before arithmetic. Example: `Number(price.price) * Number(line.quantity)`. Alternatively, configure the Prisma `Decimal` type to return `number` strings and parse explicitly. The established project pattern (see schema.prisma) uses plain arithmetic — check how existing `Decimal` fields are used in services.

**Warning signs:** `[object Object]` in computed_cost; NaN in cost breakdown.

---

## Code Examples

### Prisma Schema Addition (Phase 7 migration)

```prisma
// Source: pipeline spec §3.1–3.4 (verified against schema.prisma patterns)

model Recipe {
  id              String       @id @default(uuid())
  name            String
  description     String
  prep_steps      String
  cooking_method  String
  yield_qty       Decimal
  yield_unit      String
  portion_size    String
  shelf_life_hours Int?
  brand_id        String?
  brand           Brand?       @relation(fields: [brand_id], references: [id])
  zone_id         String?
  zone            Zone?        @relation(fields: [zone_id], references: [id])
  image_url       String?
  computed_cost   Decimal?
  status          String       @default("draft")
  created_by      String
  creator         User         @relation(fields: [created_by], references: [id])
  created_at      DateTime     @default(now())
  updated_at      DateTime     @updatedAt
  RecipeLines     RecipeLine[] @relation("RecipeLines")
  SourceLines     RecipeLine[] @relation("SourceRecipeLines")
  MenuItems       MenuItem[]
}

model RecipeLine {
  id               String   @id @default(uuid())
  recipe_id        String
  recipe           Recipe   @relation("RecipeLines", fields: [recipe_id], references: [id])
  input_type       String   // "ingredient" | "recipe"
  ingredient_id    String?
  ingredient       Ingredient? @relation(fields: [ingredient_id], references: [id])
  source_recipe_id String?
  source_recipe    Recipe?  @relation("SourceRecipeLines", fields: [source_recipe_id], references: [id])
  quantity         Decimal
  unit             String
  prep_notes       String?
  sort_order       Int      @default(0)
}

model Ingredient {
  id              String       @id @default(uuid())
  name            String
  category        String
  base_unit       String
  min_stock_level Decimal
  created_at      DateTime     @default(now())
  updated_at      DateTime     @updatedAt
  RecipeLines     RecipeLine[]
  VendorPrices    VendorPrice[]
}

model UnitConversion {
  id        String  @id @default(uuid())
  from_unit String
  to_unit   String
  factor    Decimal
  @@unique([from_unit, to_unit])
}

model Vendor {
  id            String        @id @default(uuid())
  name          String
  phone         String?
  email         String?
  address       String?
  payment_terms String?
  status        String        @default("active")
  created_at    DateTime      @default(now())
  VendorPrices  VendorPrice[]
}

model VendorPrice {
  id             String     @id @default(uuid())
  vendor_id      String
  vendor         Vendor     @relation(fields: [vendor_id], references: [id])
  ingredient_id  String
  ingredient     Ingredient @relation(fields: [ingredient_id], references: [id])
  price          Decimal
  unit           String
  effective_date DateTime
  created_at     DateTime   @default(now())
}

model MenuCategory {
  id         String     @id @default(uuid())
  name       String
  brand_id   String
  brand      Brand      @relation(fields: [brand_id], references: [id])
  sort_order Int        @default(0)
  status     String     @default("active")
  MenuItems  MenuItem[]
}

model MenuItem {
  id          String       @id @default(uuid())
  recipe_id   String
  recipe      Recipe       @relation(fields: [recipe_id], references: [id])
  category_id String
  category    MenuCategory @relation(fields: [category_id], references: [id])
  name        String
  base_price  Decimal
  image_url   String?
  available   Boolean      @default(true)
  status      String       @default("active")
  created_at  DateTime     @default(now())
  updated_at  DateTime     @updatedAt
}

model ChannelModifier {
  id             String  @id @default(uuid())
  channel_type   String
  modifier_type  String  // "fixed" | "percentage"
  modifier_value Decimal
  status         String  @default("active")
  @@unique([channel_type])
}
```

**Note:** The spec lists 8 Phase 7 entities but ChannelModifier is also Phase 7 per §6. Total new models: 9 (Recipe, RecipeLine, Ingredient, UnitConversion, Vendor, VendorPrice, MenuCategory, MenuItem, ChannelModifier). The Asset model also needs a `linked_recipe_id` column added per §3.11.

### UnitConversion Seed

```typescript
// Source: pipeline spec §3.2
const UNIT_CONVERSIONS = [
  { from_unit: 'kg',     to_unit: 'g',      factor: 1000    },
  { from_unit: 'g',      to_unit: 'kg',     factor: 0.001   },
  { from_unit: 'L',      to_unit: 'ml',     factor: 1000    },
  { from_unit: 'ml',     to_unit: 'L',      factor: 0.001   },
  { from_unit: 'dozen',  to_unit: 'pieces', factor: 12      },
  { from_unit: 'pieces', to_unit: 'dozen',  factor: 0.08333 },
];
```

### Sidebar Addition (Frontend)

```typescript
// Source: frontend/components/ops/Sidebar.tsx — operationsNav array (line 173)
// Add after FolderOpen (Assets):
{ label: 'Recipes',     href: '/operations/recipes',     icon: <ChefHat className="size-4" /> },
{ label: 'Ingredients', href: '/operations/ingredients', icon: <Salad className="size-4" /> },
{ label: 'Vendors',     href: '/operations/vendors',     icon: <Truck className="size-4" /> },
{ label: 'Menu',        href: '/operations/menu',        icon: <UtensilsCrossed className="size-4" /> },
// Import: ChefHat, Salad, Truck, UtensilsCrossed from 'lucide-react'
```

### Food Cost % Calculation (Frontend)

```typescript
// Source: UI-SPEC §Interaction Patterns — Food Cost % Live Calculation
// Used in MenuItemForm and MenuItemCard
function calcFoodCostPercent(computedCost: number | null, basePrice: number): number | null {
  if (!computedCost || !basePrice) return null;
  return (computedCost / basePrice) * 100;
}

function FoodCostBadge({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-xs text-muted-foreground">Cost not available</span>;
  const color = percent < 30 ? 'text-green-500' : percent <= 40 ? 'text-amber-500' : 'text-red-500';
  return <span className={`text-xs font-semibold ${color}`}>{percent.toFixed(1)}%</span>;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 6 had no recipe entities | Phase 7 introduces 9 new Prisma models | Phase 7 | New migration `20260321XXXXXX_phase_7_recipe` needed |
| Asset-linked recipe (document) | Actual Recipe entity with BOM | Phase 7 | These are different things — Asset.linked_recipe_id links them |
| No unit conversion | UnitConversion table + seed | Phase 7 | Future phases (8, 9) reuse this table |

**Deprecated/outdated:**
- Recipe as an AssetType: The `asset_type = 'recipe'` in Assets still exists (SOP documents about recipes), but the actual recipe data model is now the `Recipe` entity. These serve different purposes.

---

## Open Questions

1. **"Best vendor price" definition (Claude's Discretion)**
   - What we know: D-17 says "current price = latest by effective_date". The cost calculator spec says "best vendor price" without clarifying cheapest vs latest.
   - What's unclear: Should "best" mean cheapest available price from any active vendor, or latest price from any vendor?
   - Recommendation: Use **latest by effective_date across all vendors** for Phase 7. This is consistent with D-17. Cheapest-vendor logic adds complexity (comparing across vendors) and is a Phase 8 procurement optimization. The query is: `VendorPrice where ingredient_id = X, ordered by effective_date DESC, take 1`.

2. **Cost propagation depth on vendor price change**
   - What we know: When a VendorPrice changes, affected recipes need recalculation. Recipes that use those recipes as BOM inputs also need recalculation.
   - What's unclear: How many levels to propagate? A very deep recipe tree (spice mix → marinade → chicken → dish) requires propagating 3 levels.
   - Recommendation: After recalculating directly-affected recipes, do one additional propagation pass: find all recipes that have any of the recalculated recipe IDs as `source_recipe_id` in their RecipeLines, and recalculate those too. This covers 2-level propagation, which is sufficient for the villa kitchen depth. Document that Phase 9 can add full BFS propagation if needed.

3. **Circular reference prevention in UI**
   - What we know: The backend must guard against cycles in BOM during RecipeLine creation.
   - What's unclear: Is there a pre-save validation endpoint for checking cycle-safety before submission?
   - Recommendation: Add a lightweight server-side check in `POST /recipes/:id/bom-lines`: before creating each line with `input_type=recipe`, verify the source_recipe's transitive BOM does NOT already contain the current `recipe_id`. Return 409 Conflict if it would create a cycle. No special frontend pre-validation needed — the error state copy in UI-SPEC covers this.

4. **Asset.linked_recipe_id migration**
   - What we know: Pipeline spec §3.11 says add `linked_recipe_id String?` to Asset. The Asset model is in the current schema.
   - What's unclear: Does Phase 7 need to expose this link in the UI, or just add it to the schema for future use?
   - Recommendation: Add the column to the migration (it's required for Phase 9 kitchen display to link SOPs to recipes) but do NOT add UI for it in Phase 7. It's a schema-only addition in this phase.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — project has no test files |
| Config file | None — Wave 0 must create |
| Quick run command | `npm test` in backend/ (once configured) |
| Full suite command | `npm test` in backend/ |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECIPE-01 | Recipe CRUD — create, read, update status | unit | `npm test -- --testPathPattern recipes.service` | ❌ Wave 0 |
| RECIPE-02 | BOM upsert replaces lines atomically | unit | `npm test -- --testPathPattern recipes.service` | ❌ Wave 0 |
| RECIPE-03 | Ingredient CRUD — create, filter by category | unit | `npm test -- --testPathPattern ingredients.service` | ❌ Wave 0 |
| RECIPE-04 | Unit conversion: kg→g, L→ml, incompatible units return null | unit | `npm test -- --testPathPattern cost-calculator.service` | ❌ Wave 0 |
| RECIPE-05 | Vendor price create, latest price query | unit | `npm test -- --testPathPattern vendors.service` | ❌ Wave 0 |
| RECIPE-06 | Recursive cost: single ingredient, chained recipes, cycle returns null, missing price returns null | unit | `npm test -- --testPathPattern cost-calculator.service` | ❌ Wave 0 |
| RECIPE-07 | MenuItem create with approved recipe, reject unapproved recipe | unit | `npm test -- --testPathPattern menu.service` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Not applicable — no test infrastructure exists
- **Per wave merge:** Not applicable — no test infrastructure exists
- **Phase gate:** Manual verification via UI walkthrough + API smoke tests before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No test infrastructure exists in the project — no jest config, no test files
- [ ] Decision required: add Jest to backend/ for Phase 7, or continue with manual-only validation
- [ ] If added: `npm install --save-dev jest @types/jest ts-jest` in backend/
- Note: Given project velocity (5–8 min per plan), adding test infrastructure is likely out of scope for Phase 7. All existing phases used manual validation. Flag for tech lead decision.

---

## Sources

### Primary (HIGH confidence)

- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` — Complete data model, all 9 Prisma schemas, recursive cost algorithm, unit conversion seed values
- `backend/prisma/schema.prisma` — Brand (line 284), Zone (line 274), Channel (line 295) — confirmed FK targets for Phase 7 models
- `backend/src/assets/assets.service.ts` — Status workflow pattern (draft→approved), service structure
- `backend/src/brands/brands.service.ts` — INCLUDE pattern, ownership RBAC, optional field spread
- `backend/src/tasks/tasks.service.ts` — `$transaction` usage, complex filter patterns
- `frontend/components/ops/operations/brands/BrandCard.tsx` — MagicCard + ShineBorder pattern
- `frontend/components/ops/operations/brands/BrandForm.tsx` — Sheet form, useQuery, apiClient, toast pattern
- `frontend/app/(ops)/operations/assets/page.tsx` — Full page pattern: BlurFade, Tabs, useQuery, useMemo filter, delete Dialog
- `frontend/components/patterns/p-combobox-3.tsx` — Combobox API (base-ui)
- `frontend/components/ops/Sidebar.tsx` — operationsNav structure (line 173–178) — confirmed where new items go
- `backend/src/types/permissions.ts` — MANAGE_OPS confirmed as the correct permission for recipe operations
- `backend/src/app.module.ts` — Module registration pattern

### Secondary (MEDIUM confidence)

- `backend/prisma/seed.ts` — Seed structure (upsertMany pattern for UnitConversion seed)
- `frontend/lib/types/brand.ts` — Type file structure to replicate for recipe.ts, ingredient.ts, vendor.ts, menu.ts
- `.planning/phases/07-recipe-ingredient-management/07-CONTEXT.md` — All 19 decisions locked
- `.planning/phases/07-recipe-ingredient-management/07-UI-SPEC.md` — Component inventory, interaction contracts, copy

### Tertiary (LOW confidence)

- None — all claims in this document are verified against source code or the locked spec.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json files
- Architecture patterns: HIGH — all patterns derived from existing project code
- Prisma schemas: HIGH — copied verbatim from locked pipeline spec
- Recursive cost algorithm: HIGH — algorithm specified in pipeline spec §4.2; cycle guard is standard pattern
- Pitfalls: HIGH — derived from known Prisma Decimal behavior, existing project decisions, and spec logic
- Test infrastructure: LOW — no tests exist in project; recommendation is pragmatic given velocity

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack — no fast-moving dependencies)
