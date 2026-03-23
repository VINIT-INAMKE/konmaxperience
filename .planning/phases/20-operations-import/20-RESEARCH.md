# Phase 20: Operations Import - Research

**Researched:** 2026-03-24
**Domain:** Bulk CSV/XLSX import for operational data (NestJS backend + Next.js frontend)
**Confidence:** HIGH

## Summary

Phase 20 extends the Phase 19 import infrastructure with 10 new import types (opening stock, missions, quests, tasks, KPIs, events, recipes, menu categories, menu items, plus infrastructure fixes). The existing codebase provides a solid, well-patterned foundation: `ImportType` enum, validator functions `(raw, rowIndex, prisma) => Promise<ImportRow>`, `IMPORT_TYPE_CONFIG` registry, template generation via `SAMPLE_DATA` + `INSTRUCTIONS`, and a `commitImport` switch dispatching to `createRow`/`updateRow`. All 10 new types follow this exact pattern with zero new libraries required.

The most complex component is the multi-sheet recipe import (3-sheet XLSX: headers, BOM lines, instructions). ExcelJS 4.4.0 already supports multi-sheet reading via `workbook.worksheets[N]`. The existing `parseXLSX` only reads `worksheets[0]`; it needs a new `parseRecipeXLSX` that reads sheets 0 and 1, groups BOM lines by recipe name, and returns a structured result. The recipe commit uses a two-pass transaction (Pass 1: create headers, build recipeIdMap; Pass 2: delete old BOM + create new lines with cycle detection). Cost calculation runs outside the transaction per recipe. Stock import calls `inventoryService.adjust()` per row (no outer transaction) and adds SHA-256-based re-import detection.

**Primary recommendation:** Extend the existing Phase 19 import infrastructure pattern-for-pattern. No new libraries. 10 new validators, 10 new IMPORT_TYPE_CONFIG entries, 10 new template specs, multi-sheet recipe parser, tiered import index page, and 7 infrastructure bug fixes. All patterns are well-established in the codebase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Import order enforced by dependency levels (Level 0-4)
- **D-02:** Per-entity update policy with SAFE/BLOCKED/NEVER field categories for all 10 entities
- **D-03:** Recipe BOM update policy: DELETE all existing RecipeLines, INSERT new ones, recalculate cost. Block if recipe is approved.
- **D-04:** FK resolution rules: case-insensitive trimmed name matching, email for User, findMany for Zone/Brand (ambiguity check), findFirst for others
- **D-05:** Complete FK chains for Opening Stock, Recipe Pass 1, Recipe Pass 2 (BOM), Quest, Task, Menu Category, Menu Item
- **D-06:** Single-entity imports use all-or-nothing $transaction with error collection and re-throw
- **D-07:** Recipe import: multi-pass inside one $transaction (headers then BOM), cycle detection, cost calculation outside
- **D-08:** Stock import: NO outer transaction, each adjust() is its own atomic transaction
- **D-09:** Stock re-import detection via SHA-256 file hash in StockMovement.reference_type/reference_id
- **D-10:** Duplicate detection via natural keys. Toggle OFF + duplicate = skip. Toggle ON + duplicate = update SAFE fields, block DANGEROUS per D-02
- **D-11:** Every validator enforces exact DTO enum values with "Invalid {field} '{value}'. Valid values: {list}" error format
- **D-12:** Import index page groups into visual tiers with prerequisite check via GET /imports/prerequisites
- **D-13:** Recipe template is 3-sheet XLSX (headers, BOM lines, instructions). CSV not supported for recipes.
- **D-14:** Preview table shows grouped rows: recipe header as bold/highlighted row, BOM lines indented beneath, expand/collapse per recipe
- **D-15:** Recipe import is atomic per recipe: invalid header blocks all BOM lines
- **D-16:** Recipes always import as draft. Admin approves manually. Menu items require approved recipes.
- **D-17:** Commit uses two-pass inside one transaction: Pass 1 creates headers (builds recipeIdMap), Pass 2 deletes old BOM + creates new, cycle detection per recipe. Cost runs outside.
- **D-18:** BOM lines use input_type (ingredient|recipe) + ingredient_name column. Resolves in Ingredient or Recipe table based on type.
- **D-19:** Cycle detection during validation: circular sub-recipe references flagged as cell error
- **D-20:** Stock import calls inventoryService.adjust() per row
- **D-21:** Pre-validate unit conversion against UnitConversion table
- **D-22:** Stock re-import detection: StockMovement.reference_type = 'import', reference_id = SHA-256(file content)
- **D-23:** Stock has NO "Update existing" toggle. Always additive. Frontend shows amber warning.
- **D-24:** Block task import into active/completed quests: quest.status must be 'planned'
- **D-25:** created_by from importing admin's JWT. Status always 'todo'. Non-importable fields specified.
- **D-26:** Fix transaction error handling in commitImport: collect errors in loop, re-throw at end for full rollback
- **D-27:** Add @Req() req to import controller commit endpoint. Pass req.user.id to service for created_by and stock audit.
- **D-28:** Block base_unit changes on ingredient "Update existing"
- **D-29:** Fix ingredient validator enum enforcement: reject invalid category/base_unit values
- **D-30:** Add 500-row limit on parse
- **D-31:** Strip commas from numeric fields before parseFloat
- **D-32:** Stock re-import detection using StockMovement.reference_type/reference_id
- **T-01 through T-09:** Complete template specifications for all new import types

### Claude's Discretion
- XLSX multi-sheet parser implementation approach
- Prerequisite check endpoint response shape
- Error message exact wording (within format constraints above)
- Recipe grouped preview component implementation
- Performance optimizations (batch DB queries for validators)
- Frontend icon choices for new import types
- Sidebar ordering if any changes needed

### Deferred Ideas (OUT OF SCOPE)
- Scheduled/recurring imports
- Google Sheets URL import
- Import history log
- Undo import
- Task dependency import (depends_on column)
- KPI task linking (linked_task_ids column)
- Event booking import
- Recipe approval in import flow
- Bulk unit conversion seeding
- Multi-brand batch import
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ExcelJS | 4.4.0 | Multi-sheet XLSX parsing and template generation | Already installed, proven in Phase 18/19 exports and imports |
| @fast-csv/parse | 5.0.5 | CSV file parsing with header support | Already installed, used in Phase 19 import infrastructure |
| @fast-csv/format | 5.0.5 | CSV template generation | Already installed, used in Phase 19 templates |
| NestJS | 11.x | Backend framework | Project standard |
| Prisma | 6.19.2 | ORM for all database operations | Project standard (Prisma v6 only per project rules) |
| Next.js | latest | Frontend framework | Project standard |
| Lucide React | installed | Icon library for new import type icons | Already used throughout app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js crypto | built-in | SHA-256 hash for stock re-import detection | `crypto.createHash('sha256').update(buffer).digest('hex')` |
| Multer | installed | File upload interceptor | Already configured in imports controller |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node crypto for SHA-256 | Web Crypto API | Node crypto is simpler for server-side, already available in NestJS |
| Custom multi-sheet parser | SheetJS (xlsx package) | ExcelJS already installed and working, no new dependency needed |

**Installation:**
```bash
# No new packages needed - all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/imports/
  import-types.ts              # Extended: 10 new ImportType entries + IMPORT_TYPE_CONFIG
  imports.service.ts           # Extended: parseFile (multi-sheet recipe), commitImport (10 new types), validateRow dispatch
  imports.controller.ts        # Extended: @Req() for userId, 500-row limit, prerequisites endpoint
  template.service.ts          # Extended: SAMPLE_DATA + INSTRUCTIONS for all new types, recipe 3-sheet template
  imports.module.ts            # Extended: inject InventoryModule, RecipesModule, CostCalculatorService
  dto/
    commit-import.dto.ts       # Extended: ImportType union accepts new types
  parsers/
    csv.parser.ts              # Unchanged
    xlsx.parser.ts             # Unchanged (single-sheet parsing for non-recipe types)
    recipe-xlsx.parser.ts      # NEW: multi-sheet recipe parser returning RecipeParseResult
  validators/
    ingredients.validator.ts   # Fix: enum enforcement (D-29), base_unit protection (D-28)
    vendors.validator.ts       # Unchanged
    vendor-pricing.validator.ts # Unchanged
    opening-stock.validator.ts  # NEW
    missions.validator.ts       # NEW
    quests.validator.ts         # NEW
    tasks.validator.ts          # NEW
    kpis.validator.ts           # NEW
    events.validator.ts         # NEW
    recipes.validator.ts        # NEW (validates headers + BOM lines)
    menu-categories.validator.ts # NEW
    menu-items.validator.ts     # NEW

frontend/app/(ops)/admin/import/
  page.tsx                     # Restructured: tiered layout with prerequisite check
  [type]/page.tsx              # Extended: stock warnings, recipe grouped preview, blocked field display
frontend/lib/types/imports.ts  # Extended: 10 new ImportType entries
```

### Pattern 1: Validator Function Signature (Established Phase 19)
**What:** Each import type has a standalone async validator function
**When to use:** Every new import type
**Example:**
```typescript
// Source: backend/src/imports/validators/vendor-pricing.validator.ts (existing pattern)
export async function validateMissionRow(
  raw: Record<string, string>,
  rowIndex: number,
  prisma: PrismaService,
): Promise<ImportRow> {
  const errors: CellError[] = [];
  const validated: Record<string, unknown> = {};

  // 1. Required field validation
  const title = (raw.title ?? '').trim();
  if (!title || title.length < 3) {
    errors.push({ field: 'title', message: 'Required (min 3 chars)' });
  } else {
    validated.title = title;
  }

  // 2. Enum enforcement (D-11)
  const VALID_PHASES = ['setup', 'foundation', 'activation', 'scale'];
  const phase = (raw.phase ?? '').trim().toLowerCase();
  if (!phase) {
    errors.push({ field: 'phase', message: 'Required' });
  } else if (!VALID_PHASES.includes(phase)) {
    errors.push({
      field: 'phase',
      message: `Invalid phase '${phase}'. Valid values: ${VALID_PHASES.join(', ')}`,
    });
  } else {
    validated.phase = phase;
  }

  // 3. Duplicate detection
  let existingId: string | undefined;
  let status: ImportRow['status'] = errors.length > 0 ? 'invalid' : 'valid';
  if (title && errors.length === 0) {
    const existing = await prisma.mission.findFirst({
      where: { title: { equals: title, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      existingId = existing.id;
      status = 'duplicate';
    }
  }

  return { rowIndex, raw, validated, errors, status, existingId };
}
```

### Pattern 2: FK Resolution with Ambiguity Check (D-04)
**What:** Zone and Brand lookups use findMany with ambiguity detection
**When to use:** Any validator resolving zone or brand by name
**Example:**
```typescript
// Source: CONTEXT.md D-04 (zone/brand ambiguity resolution)
const zoneName = (raw.zone ?? '').trim();
if (zoneName) {
  const zones = await prisma.zone.findMany({
    where: { name: { equals: zoneName, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (zones.length === 0) {
    errors.push({ field: 'zone', message: `Zone '${zoneName}' not found` });
  } else if (zones.length > 1) {
    errors.push({
      field: 'zone',
      message: `Multiple zones named '${zoneName}' found — use zone_id column`,
    });
  } else {
    validated.zone_id = zones[0].id;
  }
}
// Fallback: zone_id column overrides name if both provided
const zoneIdRaw = (raw.zone_id ?? '').trim();
if (zoneIdRaw) {
  validated.zone_id = zoneIdRaw;
}
```

### Pattern 3: Update Policy Enforcement (D-02)
**What:** Per-entity field categorization into SAFE/BLOCKED/NEVER during update
**When to use:** commitImport updateRow for each entity type
**Example:**
```typescript
// Source: CONTEXT.md D-02, D-28
// Ingredient updateRow with base_unit protection
private async updateIngredientRow(tx: any, row: ImportRow): Promise<void> {
  const v = row.validated;
  const existing = await tx.ingredient.findUnique({
    where: { id: row.existingId },
    select: { base_unit: true },
  });
  // BLOCKED: base_unit change
  if (existing && v.base_unit && v.base_unit !== existing.base_unit) {
    throw new Error(
      `Cannot change base_unit — stock records use ${existing.base_unit}`
    );
  }
  await tx.ingredient.update({
    where: { id: row.existingId },
    data: {
      name: v.name as string,
      category: v.category as string,
      // SAFE fields only — base_unit NOT updated
      min_stock_level: v.min_stock_level as number,
    },
  });
}
```

### Pattern 4: Multi-Sheet Recipe Parse
**What:** Parse 3-sheet XLSX into recipe headers + BOM lines
**When to use:** Recipe import only
**Example:**
```typescript
// Source: ExcelJS API (already used in xlsx.parser.ts)
export async function parseRecipeXLSX(buffer: Buffer): Promise<{
  headers: Record<string, string>[];
  bomLines: Record<string, string>[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const headerSheet = workbook.worksheets[0]; // Sheet 1: Recipes
  const bomSheet = workbook.worksheets[1];    // Sheet 2: BOM Lines

  if (!headerSheet || headerSheet.rowCount < 2) {
    return { headers: [], bomLines: [] };
  }

  // Parse headers from Sheet 1
  const headers = parseSheet(headerSheet);
  // Parse BOM lines from Sheet 2
  const bomLines = bomSheet ? parseSheet(bomSheet) : [];

  return { headers, bomLines };
}

function parseSheet(sheet: ExcelJS.Worksheet): Record<string, string>[] {
  const headers: string[] = [];
  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        headers.push(String(cell.value ?? '').trim().toLowerCase());
      });
      return;
    }
    const record: Record<string, string> = {};
    let hasAnyValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        const val = cell.value instanceof Date
          ? cell.value.toISOString().slice(0, 10)
          : String(cell.value ?? '').trim();
        record[header] = val;
        if (val) hasAnyValue = true;
      }
    });
    if (hasAnyValue) rows.push(record);
  });
  return rows;
}
```

### Pattern 5: Transaction Error Collection with Full Rollback (D-06, D-26)
**What:** Collect errors during transaction loop, re-throw at end for full rollback
**When to use:** All single-entity imports (mission, quest, task, KPI, event, menu category, menu item)
**Example:**
```typescript
// Source: CONTEXT.md D-06, D-26 (fix for existing partial-commit bug)
async commitImport(
  importType: ImportType,
  rows: ImportRow[],
  updateExisting: boolean,
  userId: string,  // NEW: D-27
): Promise<CommitResult> {
  // ... filter committable rows ...

  const transactionErrors: Array<{ rowIndex: number; message: string }> = [];

  try {
    await this.prisma.$transaction(async (tx) => {
      for (const row of committable) {
        try {
          if (row.status === 'duplicate' && updateExisting && row.existingId) {
            await this.updateRow(tx, importType, row, userId);
            updated++;
          } else {
            await this.createRow(tx, importType, row, userId);
            imported++;
          }
        } catch (err) {
          transactionErrors.push({
            rowIndex: row.rowIndex,
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
      // D-26 FIX: Re-throw collected errors for full rollback
      if (transactionErrors.length > 0) {
        throw new Error(
          `${transactionErrors.length} row(s) failed: ${transactionErrors.map(e => `Row ${e.rowIndex}: ${e.message}`).join('; ')}`
        );
      }
    });
  } catch (err) {
    // Transaction rolled back — all rows reverted
    return {
      imported: 0,
      updated: 0,
      skipped,
      errors: transactionErrors.length || 1,
      errorDetails: transactionErrors.length > 0 ? transactionErrors : [{
        rowIndex: 0,
        message: err instanceof Error ? err.message : 'Unknown error',
      }],
    };
  }

  return { imported, updated, skipped, errors: 0, errorDetails: [] };
}
```

### Pattern 6: Stock Import (No Outer Transaction, D-08)
**What:** Each stock row calls inventoryService.adjust() independently
**When to use:** Opening stock import only
**Example:**
```typescript
// Source: CONTEXT.md D-08, D-20
// Stock import has its own commit path — no outer transaction
async commitStockImport(
  rows: ImportRow[],
  userId: string,
  fileHash: string,
): Promise<CommitResult> {
  let imported = 0;
  const errorDetails: Array<{ rowIndex: number; message: string }> = [];

  for (const row of committable) {
    try {
      await this.inventoryService.adjust(
        {
          ingredient_id: row.validated.ingredient_id as string,
          zone_id: row.validated.zone_id as string,
          quantity: row.validated.quantity as number,
          unit: row.validated.unit as string,
          reason: (row.validated.reason as string) || 'Opening stock',
        },
        userId,
      );
      // Tag StockMovement with import reference for re-import detection (D-22)
      // Note: adjust() creates the StockMovement inside its own transaction
      // We need to update reference_type/reference_id after
      imported++;
    } catch (err) {
      errorDetails.push({
        rowIndex: row.rowIndex,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    imported,
    updated: 0,
    skipped: 0,
    errors: errorDetails.length,
    errorDetails,
  };
}
```

### Pattern 7: SHA-256 Re-Import Detection (D-09, D-22, D-32)
**What:** Compute SHA-256 hash of file buffer, check against StockMovement.reference_id
**When to use:** Stock import parse step
**Example:**
```typescript
import { createHash } from 'crypto';

// During parseFile for opening_stock:
const fileHash = createHash('sha256').update(buffer).digest('hex');
const existingImport = await this.prisma.stockMovement.findFirst({
  where: { reference_type: 'import', reference_id: fileHash },
  select: { created_at: true },
});
// Return warning in ParseResult if found
if (existingImport) {
  // Add to ParseResult: warning field
  result.warning = `This file was already imported on ${existingImport.created_at.toLocaleDateString()}`;
}
```

### Anti-Patterns to Avoid
- **Calling entity services directly for create/update inside transaction:** Import uses `tx.model.create()` directly inside the $transaction callback, NOT the entity service's create method (which opens its own transaction). Exception: stock import calls `inventoryService.adjust()` outside any wrapping transaction (D-08).
- **Updating base_unit on ingredient re-import:** D-28 explicitly blocks this. Stock records reference the old base_unit.
- **CSV for recipes:** D-13 mandates XLSX-only. The parser must reject CSV files for recipe import type.
- **Modifying approved recipes via import:** D-03 blocks all fields. The validator must reject the entire row if recipe.status === 'approved'.
- **Importing tasks into active/completed quests:** D-24 blocks this. Quest.status must be 'planned'.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unit conversion | Custom conversion logic | `convertUnit()` from `common/utils/unit-conversion.ts` | Already handles bidirectional lookup, caching, UnitConversion table |
| Stock adjustment | Direct IngredientStock upsert + StockMovement create | `inventoryService.adjust()` | Handles unit conversion, upsert, negative stock guard, audit trail |
| Recipe cycle detection | BFS/DFS on recipe graph | `RecipesService.checkCycle()` / `walkForCycle()` | Already handles visited set, nested sub-recipe traversal |
| Recipe cost calculation | Sum of ingredient costs | `CostCalculatorService.recalculateAndSave()` | Handles sub-recipe costs, vendor price lookups, unit conversion |
| SHA-256 hashing | Third-party hash library | Node.js built-in `crypto.createHash('sha256')` | Zero dependency, standard Node API |
| XLSX parsing | New library | ExcelJS `workbook.xlsx.load(buffer)` | Already installed (4.4.0), proven in Phase 18/19 |
| CSV parsing | New library | `@fast-csv/parse` `parseString()` | Already installed (5.0.5), proven in Phase 19 |

**Key insight:** Phase 20 introduces zero new libraries. Every capability needed (multi-sheet XLSX, CSV, unit conversion, stock adjustment, cycle detection, cost calculation, hashing) already exists in the codebase or Node.js standard library.

## Common Pitfalls

### Pitfall 1: Transaction Partial Commit (D-26 — Existing Bug)
**What goes wrong:** Current `commitImport` catches errors per-row inside the transaction but doesn't re-throw, so the transaction commits with partial data.
**Why it happens:** The try/catch inside the for-loop swallows errors, and the transaction resolves normally.
**How to avoid:** Collect errors in array, check after loop, re-throw if any errors exist. This forces `$transaction` to rollback.
**Warning signs:** Some rows imported but others silently failed. Import returns success but data is incomplete.

### Pitfall 2: Stock Import Inside Transaction Scope
**What goes wrong:** Wrapping stock import rows in an outer $transaction causes `inventoryService.adjust()` to fail because it opens its own nested transaction.
**Why it happens:** Prisma doesn't support nested transactions (interactive). `adjust()` calls `prisma.$transaction()` internally.
**How to avoid:** Stock import has NO outer transaction (D-08). Each `adjust()` call is independent and atomic. If row 5 fails, rows 1-4 remain committed.
**Warning signs:** Prisma error "Transaction already in progress" or deadlock.

### Pitfall 3: Recipe Import Ordering (Two-Pass)
**What goes wrong:** BOM lines reference recipes that haven't been created yet (within the same import file).
**Why it happens:** If Pass 2 runs before all headers from Pass 1 are committed.
**How to avoid:** Two-pass inside one transaction: Pass 1 creates ALL recipe headers and builds `recipeIdMap` (name -> id). Pass 2 uses this map for BOM line resolution. Sub-recipe references to recipes in the same file use the map; references to existing DB recipes use findFirst.
**Warning signs:** "Recipe not found" errors for recipes that exist in Sheet 1.

### Pitfall 4: Zone/Brand Name Ambiguity
**What goes wrong:** Zone and Brand names are NOT unique in the schema. `findFirst` silently picks one of multiple matches.
**Why it happens:** Multiple zones or brands with the same name exist.
**How to avoid:** Use `findMany` for Zone and Brand lookups (D-04). If count > 1, return error "Multiple found -- use {entity}_id column". Only `findFirst` for entities with effectively unique names (Mission title, etc.).
**Warning signs:** Data imported against the wrong zone/brand.

### Pitfall 5: Number Sanitization (D-31)
**What goes wrong:** Numbers like "1,500" or "2,500.50" fail `parseFloat` because of comma separators.
**Why it happens:** Excel and CSVs from Indian locale use commas as thousand separators.
**How to avoid:** Strip commas before parsing: `const clean = raw.replace(/,/g, ''); const num = parseFloat(clean);`
**Warning signs:** Valid-looking numbers rejected as "Must be a number".

### Pitfall 6: Ingredient Enum Values Not Enforced (D-29 — Existing Bug)
**What goes wrong:** Ingredient validator accepts any string for `category` and `base_unit`, bypassing DTO validation.
**Why it happens:** The existing validator only checks for empty strings, not valid enum values.
**How to avoid:** Add enum validation matching the DTO's `@IsIn` lists: category in `['dairy', 'vegetable', 'spice', 'grain', 'meat', 'oil']`, base_unit in `['g', 'ml', 'pieces', 'kg', 'L']`.
**Warning signs:** Ingredients created with invalid categories or units.

### Pitfall 7: Missing userId in commitImport (D-27 — Existing Bug)
**What goes wrong:** Stock import needs `userId` for `inventoryService.adjust()` audit trail, and Mission/Task need `created_by`. Current controller doesn't pass user context.
**Why it happens:** The commit endpoint doesn't extract `@Req() req` and pass `req.user.id`.
**How to avoid:** Add `@Req() req` to the commit endpoint, extract `req.user.id`, pass it through to service.
**Warning signs:** StockMovement.created_by is undefined; Mission.created_by is empty.

### Pitfall 8: ExcelJS Cell Value Types
**What goes wrong:** ExcelJS returns typed values for cells (Date objects, numbers, rich text objects), not strings.
**Why it happens:** ExcelJS parses cell types from the XLSX metadata.
**How to avoid:** The existing `parseXLSX` already handles Date objects (`cell.value instanceof Date`). The new recipe parser must replicate this pattern. Also handle numeric cells: `typeof cell.value === 'number' ? String(cell.value) : ...`.
**Warning signs:** Dates showing as epoch numbers, numbers silently converted to `[object Object]`.

### Pitfall 9: Blocked Row Status vs Invalid
**What goes wrong:** UI shows "Invalid" for rows that are actually blocked by update policy (e.g., approved recipe, base_unit change).
**Why it happens:** Both conditions use the same `'invalid'` status.
**How to avoid:** The ParseResult/ImportRow may need a `'blocked'` status (or an error message indicating blocked) to distinguish from validation errors. The UI spec (20-UI-SPEC.md) defines a separate "Blocked" badge. Consider adding `'blocked'` to the ImportRow status union.
**Warning signs:** User cannot distinguish "fix this field" from "this row cannot be updated at all".

### Pitfall 10: Recipe CSV Upload Rejection
**What goes wrong:** User uploads CSV for recipe import, which requires XLSX (D-13).
**Why it happens:** The existing parse endpoint accepts CSV for all types.
**How to avoid:** Check `importType === 'recipes'` in the parse handler. If mimetype is CSV, return error: "Recipes require XLSX format -- CSV is not supported."
**Warning signs:** Recipe import succeeds with only header rows, no BOM lines.

## Code Examples

### Number Sanitization Utility (D-31)
```typescript
// Shared utility for all validators
export function sanitizeNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
```

### Prerequisite Check Endpoint (D-12)
```typescript
// GET /imports/prerequisites
@Get('prerequisites')
@RequiresPermission('MANAGE_SYSTEM')
async getPrerequisites() {
  const [
    ingredientCount,
    vendorCount,
    zoneCount,
    brandCount,
    missionCount,
    questCount,
    approvedRecipeCount,
    menuCategoryCount,
  ] = await Promise.all([
    this.prisma.ingredient.count(),
    this.prisma.vendor.count(),
    this.prisma.zone.count(),
    this.prisma.brand.count(),
    this.prisma.mission.count(),
    this.prisma.quest.count(),
    this.prisma.recipe.count({ where: { status: 'approved' } }),
    this.prisma.menuCategory.count(),
  ]);
  return {
    ingredients: ingredientCount,
    vendors: vendorCount,
    zones: zoneCount,
    brands: brandCount,
    missions: missionCount,
    quests: questCount,
    approved_recipes: approvedRecipeCount,
    menu_categories: menuCategoryCount,
  };
}
```

### Recipe Two-Pass Commit (D-07, D-17)
```typescript
// Inside commitImport for recipes
async commitRecipeImport(
  headerRows: ImportRow[],
  bomRows: ImportRow[],
  updateExisting: boolean,
  userId: string,
): Promise<CommitResult> {
  const errors: Array<{ rowIndex: number; message: string }> = [];
  let imported = 0;
  let updated = 0;

  try {
    await this.prisma.$transaction(async (tx) => {
      const recipeIdMap = new Map<string, string>();

      // Pass 1: Create/update recipe headers
      for (const row of committable_headers) {
        const name = (row.validated.name as string).toLowerCase();
        if (row.status === 'duplicate' && updateExisting && row.existingId) {
          // Check if approved — block update
          const existing = await tx.recipe.findUnique({
            where: { id: row.existingId },
            select: { status: true },
          });
          if (existing?.status === 'approved') {
            errors.push({
              rowIndex: row.rowIndex,
              message: 'Cannot modify approved recipe',
            });
            continue;
          }
          await tx.recipe.update({ where: { id: row.existingId }, data: { ... } });
          recipeIdMap.set(name, row.existingId);
          updated++;
        } else {
          const created = await tx.recipe.create({ data: { ..., created_by: userId } });
          recipeIdMap.set(name, created.id);
          imported++;
        }
      }

      // Pass 2: Delete old BOM + create new BOM lines
      for (const [recipeName, recipeId] of recipeIdMap) {
        const isUpdate = /* check if this was an update */;
        if (isUpdate) {
          await tx.recipeLine.deleteMany({ where: { recipe_id: recipeId } });
        }
        const lines = bomRows.filter(
          r => (r.validated.recipe_name as string).toLowerCase() === recipeName
        );
        for (const line of lines) {
          // Cycle detection per line
          if (line.validated.input_type === 'recipe') {
            // walkForCycle check
          }
          await tx.recipeLine.create({ data: { recipe_id: recipeId, ... } });
        }
      }

      if (errors.length > 0) {
        throw new Error(`${errors.length} recipe(s) failed`);
      }
    });
  } catch (err) {
    return { imported: 0, updated: 0, skipped: 0, errors: errors.length, errorDetails: errors };
  }

  // Cost calculation outside transaction (non-critical, retryable)
  for (const [, recipeId] of recipeIdMap) {
    try {
      await this.costCalculatorService.recalculateAndSave(recipeId);
    } catch { /* non-critical */ }
  }

  return { imported, updated, skipped: 0, errors: 0, errorDetails: [] };
}
```

### ParseResult Extension for Warnings and Recipe Grouped Data
```typescript
// Extended ParseResult for stock and recipe types
export interface ParseResult {
  importType: ImportType;
  rows: ImportRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  columns: string[];
  // NEW: stock re-import warning
  warning?: string;
  // NEW: recipe grouped preview data
  recipeGroups?: Array<{
    recipeName: string;
    headerRow: ImportRow;
    bomRows: ImportRow[];
  }>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat import page with 3 cards | Tiered sections with prerequisite warnings | Phase 20 | Import index becomes an intelligent guide |
| No row limit | 500-row limit (D-30) | Phase 20 | Prevents server overload from large files |
| Silent transaction partial commits | Error collection with full rollback (D-26) | Phase 20 fix | Data integrity preserved |
| No userId audit trail on import | @Req() userId passed to all commit operations (D-27) | Phase 20 fix | Full audit trail for who imported what |

**Deprecated/outdated:**
- None. This phase extends existing Phase 19 infrastructure pattern-for-pattern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.x |
| Config file | `backend/jest.config.ts` (inferred from package.json) |
| Quick run command | `cd backend && npx jest --testPathPattern imports --no-coverage -t "{test name}" --runInBand` |
| Full suite command | `cd backend && npx jest --no-coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-26 | Transaction rollback on partial errors | unit | `npx jest imports.service.spec.ts -t "rollback"` | Skeleton exists (todos only) |
| D-27 | userId passed to commit | unit | `npx jest imports.controller.spec.ts -t "userId"` | Skeleton exists (todos only) |
| D-29 | Ingredient enum enforcement | unit | `npx jest -t "enum enforcement"` | No dedicated file |
| D-30 | 500-row limit | unit | `npx jest imports.controller.spec.ts -t "row limit"` | No dedicated file |
| D-31 | Number sanitization | unit | `npx jest -t "sanitize"` | No dedicated file |
| D-04 | FK resolution (case-insensitive) | unit | `npx jest -t "FK resolution"` | No dedicated file |
| D-19 | Recipe cycle detection | unit | `npx jest -t "cycle"` | No dedicated file |

### Sampling Rate
- **Per task commit:** `cd backend && npx jest --testPathPattern imports --no-coverage --runInBand`
- **Per wave merge:** `cd backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/imports/validators/__tests__/` directory for validator unit tests
- [ ] Existing `imports.service.spec.ts` has only todo stubs -- needs real test implementations
- [ ] `imports.controller.spec.ts` has only todo stubs -- needs real test implementations

*(Note: The existing test files are skeleton-only with `it.todo()` stubs. Real tests would need to be authored as part of implementation.)*

## Open Questions

1. **ParseResult type extension for recipe groups and stock warnings**
   - What we know: Standard ParseResult has rows/columns/counts. Recipe import needs grouped data (header + BOM lines per recipe). Stock import needs a `warning` field for re-import detection.
   - What's unclear: Should the `recipeGroups` and `warning` fields be added directly to ParseResult, or should there be a separate RecipeParseResult type? The frontend needs both for rendering.
   - Recommendation: Add optional fields to ParseResult (`warning?: string`, `recipeGroups?: RecipeGroup[]`). This keeps backward compatibility and avoids a parallel type hierarchy.

2. **ImportRow 'blocked' status**
   - What we know: UI spec defines a "Blocked" badge distinct from "Invalid". Current ImportRow status is `'valid' | 'invalid' | 'duplicate'`.
   - What's unclear: Should 'blocked' be a new status, or should it be conveyed via a special error message pattern on the 'invalid' status?
   - Recommendation: Add `'blocked'` to the ImportRow status union. This is the cleanest approach for frontend rendering and keeps the status semantics clear.

3. **Stock import StockMovement tagging**
   - What we know: `inventoryService.adjust()` creates StockMovement with `movement_type: 'adjustment'`. D-22 wants `reference_type: 'import'` and `reference_id: fileHash`.
   - What's unclear: `adjust()` doesn't currently accept reference_type/reference_id parameters. Two options: (a) extend adjust() with optional reference params, (b) update the StockMovement after adjust() returns.
   - Recommendation: Extend `CreateStockAdjustmentDto` and `adjust()` with optional `reference_type` and `reference_id` fields. This keeps tagging atomic within the adjust transaction.

4. **ImportsModule dependency injection**
   - What we know: Current ImportsModule imports IngredientsModule and VendorsModule. Stock import needs InventoryService. Recipe import needs CostCalculatorService.
   - What's unclear: How many additional module imports are needed?
   - Recommendation: Add InventoryModule and RecipesModule (which exports CostCalculatorService) to ImportsModule imports. For entities like Mission, Quest, Task, KPI, Event, MenuCategory, MenuItem -- the import service uses PrismaService directly (consistent with Phase 19 pattern per STATE.md decision), so no additional module imports needed.

## Sources

### Primary (HIGH confidence)
- `backend/src/imports/` -- Complete Phase 19 import infrastructure (import-types.ts, imports.service.ts, imports.controller.ts, template.service.ts, parsers/, validators/)
- `backend/src/inventory/inventory.service.ts` -- adjust() method with unit conversion and stock movement creation
- `backend/src/recipes/recipes.service.ts` -- create() with BOM, checkBomLinesForCycles(), walkForCycle()
- `backend/src/recipes/cost-calculator.service.ts` -- recalculateAndSave() for recipe cost
- `backend/src/menu/menu.service.ts` -- createItem() with recipe.status === 'approved' guard
- `backend/prisma/schema.prisma` -- All model definitions, constraints, indices
- `.planning/phases/20-operations-import/20-CONTEXT.md` -- 32 locked decisions with complete system design
- `.planning/phases/20-operations-import/20-UI-SPEC.md` -- UI design contract

### Secondary (MEDIUM confidence)
- ExcelJS 4.4.0 multi-sheet API -- verified via installed package and existing usage in codebase
- Node.js crypto module SHA-256 -- standard library, well-documented

### Tertiary (LOW confidence)
- None. All research verified against actual codebase code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zero new libraries, all capabilities verified in codebase
- Architecture: HIGH -- Extends proven Phase 19 patterns, all code paths read and understood
- Pitfalls: HIGH -- Identified from actual bugs in existing code (D-26, D-27, D-28, D-29) and schema constraints
- Validators: HIGH -- Complete FK chains, enum lists, and update policies documented in CONTEXT.md with schema verification
- Recipe multi-sheet: HIGH -- ExcelJS 4.4.0 worksheets[N] API verified in existing parser code

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain -- all patterns established, no fast-moving dependencies)
