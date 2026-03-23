# Phase 19: Master Data Import + Export Gaps + Timezone - Research

**Researched:** 2026-03-23
**Domain:** NestJS file upload / CSV+XLSX parsing / React drag-drop import UI / Export builder extension / IST timezone
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Import Upload UX**
- D-01: Drag-drop zone + file picker button — accepts CSV and XLSX files
- D-02: Preview table after upload — shows all parsed rows with validation status per row/cell
- D-03: Inline cell editing in preview table — user can fix validation errors directly before importing
- D-04: "Import" button commits valid rows after user review
- D-05: Each import type has a dedicated page under `/admin/import/[type]` (e.g., `/admin/import/ingredients`)
- D-06: Admin imports page at `/admin/import` listing all available import types

**Import Templates**
- D-07: Each import type provides a downloadable template file (CSV and XLSX)
- D-08: Templates have exact column headers matching Prisma schema field names
- D-09: Templates include one sample row showing correct data format
- D-10: Templates include validation notes as comments or a second "Instructions" sheet in XLSX
- D-11: "Download Template" button prominently displayed on each import page before the upload zone

**Import Validation (Schema-Strict)**
- D-12: Validation runs against exact Prisma model constraints — required fields, field types, enum values, max lengths
- D-13: Foreign key references validated by name resolution (e.g., ingredient name → ingredient ID, zone name → zone ID)
- D-14: Invalid cells highlighted in red with error tooltip in the preview table
- D-15: Valid rows shown in green, invalid rows in red/amber
- D-16: User can fix errors inline in the preview table before importing

**Import Error & Duplicate Handling**
- D-17: "Update existing records" toggle in import dialog — user chooses per import whether to upsert or skip duplicates
- D-18: Duplicate detection by name field (ingredient name, vendor name)
- D-19: Import result summary after commit: X imported, Y updated, Z skipped, W errors

**Import Types (Phase 19)**
- D-20: Ingredients: name, category, base_unit, min_stock_level
- D-21: Vendors: name, phone, email, address, payment_terms, status
- D-22: Vendor Pricing: vendor (name), ingredient (name), price, unit, effective_date

**Export Gaps**
- D-23: New export builders: MissionsExportBuilder, QuestsExportBuilder
- D-24: Audit ALL frontend pages for missing ExportButton — add to every page with exportable data
- D-25: ExportButton on missions list, readiness dashboard, tasks list (not just detail), decisions, and any other page currently missing it

**IST Timezone**
- D-26: Already set via `process.env.TZ = 'Asia/Kolkata'` in main.ts — verify all date formatting uses IST
- D-27: Export files should show IST timestamps in column headers and date values

### Claude's Discretion
- Import page layout and styling
- Template file format details (column order, sample data values)
- Exact validation error message wording
- How to present the import result summary
- Which pages are missing ExportButton (discovered during audit)
- Whether to use a shared ImportModule or per-type modules

### Deferred Ideas (OUT OF SCOPE)
- Import for operational data (stock, recipes, menu, events, tasks, quests, KPIs) — Phase 20
- Scheduled/recurring imports — Future
- Import from Google Sheets URL — Future
- Import validation rules beyond schema (business logic like "price must be positive") — nice to have but not required
</user_constraints>

---

## Summary

Phase 19 has three deliverables: (1) a new ImportsModule in NestJS that accepts CSV/XLSX uploads for ingredients, vendors, and vendor pricing; parses them server-side; validates against Prisma schema; and returns structured row results with per-cell errors; (2) two new export builders (missions, quests) added to the existing ExportsModule registry, plus ExportButton added to pages currently missing it; (3) verification that IST timezone is working end-to-end through all date outputs.

All libraries required are already installed. `@fast-csv/parse` (4.3.6) is a transitive dependency of `fast-csv` already in the lock file — it can be used for CSV parsing directly. `exceljs` 4.4.0 is already a direct dependency used for XLSX export; the same API reads XLSX files on import. Multer 2.1.1 is already a transitive dependency of `@nestjs/platform-express` which is installed — NestJS `@UploadedFile()` + `FileInterceptor` work without any additional install.

The export gap audit is complete from reading the codebase: missions list, readiness page, decisions page, and boards/missions and boards/quests pages are missing ExportButton. The tasks list page already has ExportButton on the task detail page but the CONTEXT.md confirms tasks list (not detail) needs it too. IST is already set as `process.env.TZ = 'Asia/Kolkata'` at the very top of main.ts before any imports — this is the correct placement and means all `new Date()` and date formatting in NestJS will use IST. The only risk is XLSX date columns in ExcelJS — these must use explicit IST formatting, not JavaScript's default date serialization which could use a different timezone if the server is misconfigured.

**Primary recommendation:** Use `FileInterceptor` + `@UploadedFile()` (Multer/NestJS built-in) for file upload; use `@fast-csv/parse` + `exceljs.Workbook().xlsx.load()` for parsing; validate in ImportsService; return a preview payload to the frontend for the preview table. Mirror the ExportsModule builder registry pattern for ImportsModule to keep future import types pluggable.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/platform-express` | ^11.0.1 | Multer file upload via `FileInterceptor` | Built into NestJS; Multer 2.1.1 is in lock file |
| `@fast-csv/parse` | 4.3.6 (transitive) | CSV row parsing with headers | Already in lock file as `fast-csv` dependency; same org as `@fast-csv/format` already used |
| `exceljs` | ^4.4.0 | XLSX file reading + template generation | Already installed; `.xlsx.load(buffer)` API for read, same as write |
| `@fast-csv/format` | ^5.0.5 | CSV template generation for downloads | Already installed |
| `@prisma/client` | ^6.19.2 | DB reads for name resolution (ingredient, vendor lookups) | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-validator` | ^0.15.1 | DTO validation for import commit payload | Already installed; use for `CommitImportDto` |
| `class-transformer` | ^0.5.1 | Transform body DTOs | Already installed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fast-csv/parse` | `csv-parse` (npm) | csv-parse is more popular but `@fast-csv/parse` is already in lock file as a transitive dep — no new install needed |
| Multer memory storage | Multer disk storage | Memory storage is correct here — files are small (import templates), processed immediately, never persisted to disk |
| ExcelJS for XLSX read | `xlsx` (SheetJS) | xlsx library has more features but ExcelJS is already installed and its `Workbook.xlsx.load(buffer)` API handles all required columns |

**Installation:** No new packages needed — all libraries are already in `backend/package.json` or its transitive deps.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/imports/
├── imports.module.ts            # ImportsModule — imports IngredientsModule, VendorsModule
├── imports.controller.ts        # POST /imports/parse, POST /imports/commit, GET /imports/template
├── imports.service.ts           # Orchestrates parse → validate → commit flow
├── dto/
│   ├── parse-import.dto.ts      # importType: 'ingredients' | 'vendors' | 'vendor_pricing'
│   └── commit-import.dto.ts     # importType, rows (validated), updateExisting
├── parsers/
│   ├── csv.parser.ts            # parseCSV(buffer): Promise<Record<string,string>[]>
│   └── xlsx.parser.ts           # parseXLSX(buffer): Promise<Record<string,string>[]>
├── validators/
│   ├── ingredients.validator.ts # validates raw row → ImportRow with errors per cell
│   ├── vendors.validator.ts
│   └── vendor-pricing.validator.ts
└── builders/
    ├── missions.builder.ts      # NEW: MissionsExportBuilder (goes in exports/builders/)
    └── quests.builder.ts        # NEW: QuestsExportBuilder (goes in exports/builders/)
```

Note: The export builders (missions, quests) belong in `backend/src/exports/builders/` not in imports. Listed here for completeness.

### Pattern 1: NestJS File Upload with Multer (FileInterceptor)

**What:** `FileInterceptor('file')` + `@UploadedFile()` receives the multipart file in the controller. File is in memory as `Express.Multer.File` with `.buffer` property.

**When to use:** Single file upload endpoints (parse import, template download). Already installed via `@nestjs/platform-express`.

**Example:**
```typescript
// Source: NestJS official docs (FileInterceptor pattern)
import { Controller, Post, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('imports')
export class ImportsController {
  @Post('parse')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (_req, file, cb) => {
      const allowed = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  async parseImport(
    @UploadedFile() file: Express.Multer.File,
    @Body('importType') importType: string,
  ) {
    // file.buffer is the raw bytes; file.mimetype tells CSV vs XLSX
  }
}
```

**Critical:** The main.ts already applies `app.use(json({ limit: '1mb' }))` for JSON body but this does NOT apply to multipart form data (Multer handles that separately). The file size limit must be set in `FileInterceptor` options.

### Pattern 2: CSV Parsing with @fast-csv/parse

**What:** `@fast-csv/parse` is already in the lock file as a transitive dependency. It provides `parseString` (sync-ish, stream-based) and can parse CSV from a Buffer.

**Example:**
```typescript
// Source: @fast-csv/parse API (same package as @fast-csv/format already used in project)
import { parse } from '@fast-csv/parse';

export async function parseCSV(buffer: Buffer): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    parse(buffer.toString('utf-8'), { headers: true, trim: true })
      .on('data', (row: Record<string, string>) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}
```

**Note:** `@fast-csv/parse` is `4.3.6` (transitive) while `@fast-csv/format` is `5.0.5` (direct). The parse package must be imported directly from `@fast-csv/parse` not from `fast-csv` (which bundles both at 4.x). Add `"@fast-csv/parse": "^4.3.6"` to backend `package.json` to make the dep explicit — it is already installed in node_modules.

### Pattern 3: XLSX Parsing with ExcelJS

**What:** `ExcelJS.Workbook.xlsx.load(buffer)` reads an XLSX file from a buffer. The first worksheet is accessed via `workbook.worksheets[0]`.

**Example:**
```typescript
// Source: ExcelJS documentation — Workbook.xlsx.load()
import ExcelJS from 'exceljs';

export async function parseXLSX(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];

  const headers: string[] = [];
  const rows: Record<string, string>[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Extract headers from first row
      row.eachCell((cell) => {
        headers.push(String(cell.value ?? '').trim());
      });
      return;
    }
    const record: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        record[header] = String(cell.value ?? '').trim();
      }
    });
    rows.push(record);
  });

  return rows;
}
```

**Pitfall:** ExcelJS date cells return a JavaScript `Date` object, not a string. The cell value must be checked: `cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : String(cell.value)`.

### Pattern 4: Import Validation Shape

**What:** Validation transforms raw parsed rows into `ImportRow` objects with per-cell errors. The frontend preview table consumes this shape.

**Example:**
```typescript
// Designed to match frontend preview table contract (per UI-SPEC)
export interface CellError {
  field: string;
  message: string;
}

export interface ImportRow {
  rowIndex: number;           // 1-based (matches file row number for user clarity)
  raw: Record<string, string>;
  validated: Record<string, unknown>; // typed values after coercion
  errors: CellError[];        // empty array = valid row
  status: 'valid' | 'invalid' | 'duplicate';
  existingId?: string;        // set when duplicate found by name
}

export interface ParseResult {
  rows: ImportRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
}
```

### Pattern 5: Export Builder Registration (Missions + Quests)

**What:** Add `MissionsExportBuilder` and `QuestsExportBuilder` to `exports.module.ts` following the identical pattern of existing builders.

**Steps:**
1. Create `backend/src/exports/builders/missions-quests.builder.ts` with both classes
2. Add `'missions'` and `'quests'` to `REPORT_TYPES` array in `export-types.ts`
3. Add config entries in `EXPORT_TYPE_CONFIG`
4. Import `MissionsModule` and `QuestsModule` in `ExportsModule.imports[]`
5. Add both builders to `ExportsModule.providers[]`
6. Register in `onModuleInit()` with `this.exportsService.registerBuilder('missions', ...)`

MissionsService already has `findAll()` — need to add `findAllForExport()` that removes take/skip (same pattern as `DecisionsService.findAllForExport` added in Phase 18). QuestsService `findAll()` also paginates — same fix needed.

### Pattern 6: ExportButton Audit — Pages Currently Missing It

From reading the codebase, these pages have exportable data but no ExportButton:

| Page | Route | Report Type | Notes |
|------|-------|-------------|-------|
| Missions list | `/missions` | `missions` | No ExportButton in current page.tsx |
| Boards - Missions | `/boards/missions` | `missions` | No ExportButton |
| Boards - Quests | `/boards/quests` | `quests` | No ExportButton |
| Readiness | `/readiness` | Not applicable | Readiness meters are snapshots, not a dedicated report type — skip or add future type |
| Decisions | `/decisions` | `decision_log` | No ExportButton found |

Pages already confirmed to HAVE ExportButton: leaderboard, tasks/[id], kds, events, feedback, menu, vendors, ingredients, recipes, purchase-orders, analytics, inventory, pos/orders.

**Recommendation (Claude's discretion):** Add ExportButton to missions list page, boards/missions, boards/quests, and decisions page. Readiness page maps to tasks export (the underlying tasks drive readiness), or skip — readiness meters have no dedicated export type and D-25 does not require creating one.

### Anti-Patterns to Avoid

- **Don't load ExcelJS XLSX files with row.values array indexing:** `row.values` is 1-based sparse array in ExcelJS; use `row.eachCell({ includeEmpty: true })` to iterate all cells including blanks.
- **Don't skip the `process.env.TZ` verification for ExcelJS dates:** ExcelJS serializes Date objects using JavaScript's `toISOString()` which outputs UTC. For XLSX column headers showing timestamps, format them explicitly: `new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })`.
- **Don't forget to set `limits.fileSize` in FileInterceptor:** Without it, Multer uses no size limit and large files can exhaust memory.
- **Don't create a new ImportsModule that depends on IngredientsModule/VendorsModule without exporting their services:** Check `ingredients.module.ts` and `vendors.module.ts` — both already export their services (`exports: [IngredientsService]` pattern). Confirm before wiring.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing from buffer | Custom string split parser | `@fast-csv/parse` | Handles quoted fields, escaped commas, BOM characters, Windows CRLF line endings |
| XLSX parsing | Manual zip/XML parsing | `exceljs` Workbook.xlsx.load() | Handles formulas, merged cells, date types automatically |
| File upload handling | Manual multipart body parsing | NestJS `FileInterceptor` (Multer) | Handles content-type boundaries, memory storage, file size limits |
| Duplicate detection | In-memory Set per import | Prisma `findFirst({ where: { name: dto.name } })` | Authoritative — catches concurrent duplicates; already in DB at commit time |

**Key insight:** All parsing infrastructure is already installed. The only new code is validation logic (row-by-row schema checks) and the import commit transaction (upsert vs. skip per D-17).

---

## Runtime State Inventory

> Not applicable — this is a greenfield feature phase (new ImportsModule), not a rename/refactor/migration phase.

None — no existing runtime state needs migration. The existing `IngredientsService.create()` and `VendorsService.create()` methods will be called during commit; no schema migration is required for the core import feature.

Note: D-CONTEXT.md mentions "New Prisma migration: ImportRecord model to track import history (optional)" — this is explicitly optional and deferred to Claude's discretion. No migration is required for Phase 19 core functionality.

---

## Common Pitfalls

### Pitfall 1: @fast-csv/parse Version Mismatch
**What goes wrong:** Importing `from 'fast-csv'` instead of `from '@fast-csv/parse'` uses the v4 bundled version, while the project has `@fast-csv/format` at v5. They're separate packages and should be imported separately.
**Why it happens:** `fast-csv` is a convenience wrapper that re-exports both format and parse. It is in node_modules as a transitive dep but not a direct dep.
**How to avoid:** Import `import { parse } from '@fast-csv/parse'` directly. Add `"@fast-csv/parse": "^4.3.6"` to backend package.json devDependencies to make the dependency explicit.
**Warning signs:** TypeScript "Cannot find module '@fast-csv/parse'" (means it wasn't installed explicitly; fix: `npm install @fast-csv/parse`).

### Pitfall 2: ExcelJS Date Cell Handling
**What goes wrong:** ExcelJS returns JavaScript `Date` objects for date-formatted cells, not strings. A naive `String(cell.value)` returns "Mon Jan 01 2024 00:00:00 GMT+0530" which doesn't match the expected YYYY-MM-DD format for `effective_date`.
**Why it happens:** ExcelJS preserves native cell types, including dates.
**How to avoid:** In the XLSX parser, check `cell.value instanceof Date` and convert: `cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : String(cell.value ?? '')`.
**Warning signs:** Vendor pricing rows fail validation with "Invalid date format" even though the file looks correct.

### Pitfall 3: Multer Not Applied to JSON-Only Body Limit
**What goes wrong:** The existing `app.use(json({ limit: '1mb' }))` in main.ts does NOT apply to multipart uploads. A user uploading a 4MB XLSX would bypass the limit and consume server memory.
**Why it happens:** `json()` middleware only parses `application/json` content-type. Multer handles `multipart/form-data` separately.
**How to avoid:** Set `limits: { fileSize: 5 * 1024 * 1024 }` in `FileInterceptor` options. Validate file MIME type in `fileFilter` callback.
**Warning signs:** Large uploads succeed when they should be rejected.

### Pitfall 4: Prisma Decimal Fields in Import Validation
**What goes wrong:** `Ingredient.min_stock_level` and `VendorPrice.price` are `Decimal` (not `Float`) in the Prisma schema. Passing a JavaScript `number` directly to Prisma for a Decimal field works, but the raw CSV value is a string that must be parseable as a decimal.
**Why it happens:** Prisma Decimal fields accept number literals but reject non-numeric strings at the DB layer.
**How to avoid:** In the validator, use `isNaN(parseFloat(value))` to detect non-numeric strings early. Pass the validated value as `parseFloat(value)` to Prisma — Prisma's Decimal adapter handles the conversion.
**Warning signs:** Import commits fail with Prisma validation error "Expected Decimal, got String".

### Pitfall 5: ExcelJS and XLSX Template — Instructions Sheet
**What goes wrong:** D-10 requires an "Instructions" sheet in the XLSX template. ExcelJS adds worksheets with `workbook.addWorksheet('Instructions')`. The parser must skip any sheet that is not the first data sheet.
**Why it happens:** If the parser reads `workbook.worksheets[1]` (Instructions) instead of `[0]` (Data), it gets headers like "Field Name | Description | Valid Values" and all imports fail.
**How to avoid:** The XLSX parser always reads `workbook.worksheets[0]` — the template generator must put the data sheet FIRST and the instructions sheet SECOND.
**Warning signs:** Every upload shows "Unknown column headers" errors.

### Pitfall 6: IST Already Set But ExcelJS XLSX Date Headers May Use UTC
**What goes wrong:** `process.env.TZ = 'Asia/Kolkata'` correctly affects `new Date()` operations, but if any code uses `date.toISOString()` it always returns UTC. Export column headers that include "Generated at" timestamps using `toISOString()` will show UTC time.
**Why it happens:** `toISOString()` always returns UTC per the JavaScript spec regardless of `TZ` env var.
**How to avoid:** Use `new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })` for human-readable timestamps in export headers, or `Intl.DateTimeFormat` formatting. Alternatively: `new Date().toLocaleDateString('sv-SE')` gives YYYY-MM-DD using local TZ (IST when TZ=Asia/Kolkata).
**Warning signs:** Export files show column headers like "Generated: 2026-03-23T08:30:00.000Z" (UTC) instead of "2026-03-23 14:00 IST".

---

## Code Examples

Verified patterns from the existing codebase:

### Export Builder Pattern (reference — existing builders all follow this)
```typescript
// Source: backend/src/exports/builders/master-data.builder.ts
@Injectable()
export class IngredientsExportBuilder implements ExportBuilder {
  constructor(private readonly ingredientsService: IngredientsService) {}

  async fetchData(): Promise<unknown[]> {
    return this.ingredientsService.findAllForExport();
  }

  async buildXlsx(data: unknown[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ingredients');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 24 },
      // ...
    ];
    sheet.getRow(1).font = { bold: true };
    for (const row of data as any[]) { sheet.addRow(row); }
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async buildCsv(data: unknown[]): Promise<Buffer> {
    const rows = (data as any[]).map((row) => ({ name: row.name /* ... */ }));
    return writeToBuffer(rows, { headers: true });
  }
}
```

### Adding a Builder to ExportsModule (registration pattern)
```typescript
// Source: backend/src/exports/exports.module.ts — onModuleInit() pattern
onModuleInit() {
  this.exportsService.registerBuilder('missions', this.missionsExportBuilder);
  this.exportsService.registerBuilder('quests', this.questsExportBuilder);
}
```

### Ingredient Model — Exact Prisma Schema Fields
```
model Ingredient {
  id              String    @id @default(uuid())
  name            String                      // required, no @unique constraint
  category        String                      // required
  base_unit       String                      // required
  min_stock_level Decimal                     // required, Decimal type
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
}
```

### Vendor Model — Exact Prisma Schema Fields
```
model Vendor {
  id             String    @id @default(uuid())
  name           String                      // required, no @unique
  phone          String?                     // optional
  email          String?                     // optional
  address        String?                     // optional
  payment_terms  String?                     // optional
  status         String    @default("active") // "active" or "inactive"
  created_at     DateTime  @default(now())
}
```

### VendorPrice Model — Exact Prisma Schema Fields
```
model VendorPrice {
  id             String    @id @default(uuid())
  vendor_id      String                       // FK — must resolve by name at import time
  ingredient_id  String                       // FK — must resolve by name at import time
  price          Decimal                      // required, Decimal
  unit           String                       // required
  effective_date DateTime                     // required, parse from YYYY-MM-DD
  created_at     DateTime  @default(now())
}
```

### Sidebar Nav Addition Pattern (Admin section)
```typescript
// Source: frontend/components/ops/Sidebar.tsx — adminNav array
...(can('MANAGE_SYSTEM')
  ? [
      { label: 'Import', href: '/admin/import', icon: <Upload className="size-4" /> },
      // ...existing entries
    ]
  : []),
```
Also add `/admin/import` to `SECTION_ROUTES.Admin` array for auto-expand.

### ExportButton Usage (existing pattern)
```tsx
// Source: frontend/app/(ops)/operations/ingredients/page.tsx
<ExportButton
  reportType="ingredients"
  reportName="Ingredients"
  isTimeSeries={false}
/>
```
For missions: `reportType="missions"`, `isTimeSeries={false}`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multer v1.x disk storage | Multer v2.x memory storage | Multer 2.x (2024+) | Memory storage is default and correct for small import files |
| ExcelJS v3 synchronous API | ExcelJS v4 async/await | ExcelJS 4.0 (2022) | Must use `await workbook.xlsx.load(buffer)` — synchronous overload removed |
| fast-csv combined package import | `@fast-csv/parse` and `@fast-csv/format` separate imports | fast-csv 4.x (2020) | Import from individual scoped packages |

**Deprecated/outdated:**
- `fast-csv` as a combined import: still works but is the bundled 4.x version; prefer `@fast-csv/parse` directly for clarity

---

## Open Questions

1. **Should `findAllForExport()` be added to MissionsService and QuestsService?**
   - What we know: Both `findAll()` methods apply `take`/`skip` pagination. Phase 18 established the pattern: add `findAllForExport()` without pagination.
   - What's unclear: Whether any constraint prevents exporting all missions/quests (they could be large datasets).
   - Recommendation: Add `findAllForExport()` to both services following the Phase 18 pattern.

2. **Is there a unique constraint on Ingredient.name?**
   - What we know: Prisma schema shows `name String` with no `@unique` directive. `IngredientsService.create()` does not check for name uniqueness before creating.
   - What's unclear: Whether duplicate ingredient names are intentionally allowed in the data model.
   - Recommendation: Duplicate detection for import is by `prisma.ingredient.findFirst({ where: { name: { equals: dto.name, mode: 'insensitive' } } })`. If found, flag as duplicate candidate; let the toggle control upsert vs. skip.

3. **Should the import commit use a Prisma transaction?**
   - What we know: Importing 100 rows of vendor pricing requires 100 separate `vendorPrice.create()` calls; a failure mid-batch leaves partial data.
   - What's unclear: Whether partial import is acceptable UX.
   - Recommendation: Use `prisma.$transaction([...])` for the commit of all valid rows in one batch. If the transaction fails, no rows are written and the full error is surfaced.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (configured in backend/package.json) |
| Config file | `backend/package.json` jest section |
| Quick run command | `cd backend && npm test -- --testPathPattern="imports"` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map

Phase 19 requirements are TBD at planning time, but based on the success criteria:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Parse CSV ingredients file — valid rows returned | Unit | `npm test -- imports.service.spec` | No — Wave 0 |
| Parse XLSX ingredients file — valid rows returned | Unit | `npm test -- imports.service.spec` | No — Wave 0 |
| Validation catches missing required field | Unit | `npm test -- imports.service.spec` | No — Wave 0 |
| Duplicate detection returns existingId | Unit | `npm test -- imports.service.spec` | No — Wave 0 |
| Commit creates ingredient records | Integration (manual) | Manual DB verify | N/A |

### Sampling Rate
- **Per task commit:** `cd backend && npm test -- --testPathPattern="imports" --passWithNoTests`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/imports/imports.service.spec.ts` — covers CSV/XLSX parse + validation unit tests
- [ ] Mock `PrismaService` for duplicate lookup tests

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `backend/src/exports/`, `backend/prisma/schema.prisma`, `backend/package.json`, `backend/package-lock.json` — authoritative for what is already installed and how existing patterns work
- `backend/src/main.ts` — confirmed `process.env.TZ = 'Asia/Kolkata'` is set correctly at top of file
- `frontend/components/ops/Sidebar.tsx` — confirmed sidebar nav pattern for adding Import entry
- `frontend/components/ops/exports/ExportButton.tsx` and `ExportDialog.tsx` — confirmed ExportButton API

### Secondary (MEDIUM confidence)
- `backend/package-lock.json` entry for `fast-csv` and `@fast-csv/parse` — confirms 4.3.6 is transitively installed
- `backend/package-lock.json` entry for `multer: 2.1.1` — confirms version available without install

### Tertiary (LOW confidence)
- ExcelJS `workbook.xlsx.load(buffer)` API details — based on training data knowledge of ExcelJS 4.x API; consistent with how `workbook.xlsx.writeBuffer()` is already used in the codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and package-lock.json
- Architecture: HIGH — mirrors existing Export builder pattern exactly; codebase read confirmed patterns
- Pitfalls: HIGH for ExcelJS/fast-csv pitfalls (well-known library behaviors); MEDIUM for IST timezone edge cases (based on JS spec knowledge)
- Export gap audit: HIGH — read every page.tsx file and searched for ExportButton usage

**Research date:** 2026-03-23
**Valid until:** 2026-04-22 (stable libraries, 30-day window)
