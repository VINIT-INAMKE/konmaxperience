# Phase 18: Data Export - Research

**Researched:** 2026-03-23
**Domain:** NestJS file generation (XLSX + CSV), R2 upload, ExportRecord Prisma model, React Query mutation flow
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Both CSV and XLSX formats — user chooses via download dropdown
- **D-02:** Multi-sheet XLSX workbooks for complex data (PO export: 'Orders' + 'Line Items'; Recipe export: 'Recipes' + 'BOM Lines'). Simple data: single sheet.
- **D-03:** Proper column headers, date formatting, and sheet names in XLSX files
- **D-04:** File naming: `{report_type}_{date_range}_{export_timestamp}.{csv|xlsx}` (e.g., `orders_2026-01-01_to_2026-03-23_20260323T120000.xlsx`)
- **D-05:** Server-side file generation — backend generates the file, NOT client-side
- **D-06:** Generated file stored on R2 via presigned URL (same StorageService pattern)
- **D-07:** Backend returns the R2 public URL as the download link
- **D-08:** Files persist on R2 — enables re-download and export history
- **D-09:** File naming includes export details: report type, date/time range, generation timestamp
- **D-10:** Export buttons on individual data pages — exports what the page shows
- **D-11:** Dedicated `/admin/exports` page — centralized export catalog with history
- **D-12:** Export dialog with page filters as defaults — user adjusts before downloading
- **D-13:** Format selector in export dialog: CSV or XLSX dropdown
- **D-14:** Admin exports page shows history — download link, timestamp, who generated, report type, file size
- **D-15:** History persisted in database (new ExportRecord Prisma model)
- **D-16:** R2 storage keys referenced from ExportRecord for re-download
- **D-17:** Page filters carry over as defaults in export dialog
- **D-18:** User can adjust date range and other filters in export dialog before generating
- **D-19:** Time-series exports (orders, waste, stock movements, POs) support date range filtering
- **D-20:** Master data exports (ingredients, vendors, recipes, menu) export full dataset (no date range)
- **D-21:** Claude's discretion on grouping 22 export types into plans
- **D-22:** All 22 report types delivered in this phase

### Claude's Discretion

- Exact XLSX library choice (exceljs vs xlsx vs similar)
- CSV library choice (fast-csv, json2csv, or built-in)
- How to group 22 exports into plans (by module, complexity, or shared patterns)
- R2 key prefix structure for export files
- ExportRecord model fields beyond the essentials
- Export dialog component design
- Whether to use BullMQ for async export generation or synchronous for small datasets
- RBAC on exports — which roles can export which reports

### Deferred Ideas (OUT OF SCOPE)

- Scheduled/recurring exports
- Email delivery of exports
- Export templates (saved filter presets)
- Bulk export (all reports at once)
</user_constraints>

---

## Summary

Phase 18 is a file generation and storage phase. The backend generates XLSX or CSV files from existing Prisma-backed services, uploads them to R2 as static objects, and returns a public URL. The frontend shows a compact dialog to collect format and date range, then polls or awaits the URL. An admin history page shows all past exports with re-download links.

The data is already largely accessible: existing services (AnalyticsService, OrdersService, InventoryService, etc.) have `findAll`/query methods that can be reused directly or adapted without major rewrites. The primary new work is: (1) a unified ExportsModule that orchestrates file generation, (2) the ExportRecord Prisma model, (3) the `/admin/exports` frontend page, and (4) ExportButton + ExportDialog added to 13 existing data pages.

**Primary recommendation:** Use `exceljs 4.4.0` for XLSX generation (`workbook.xlsx.writeBuffer()` → upload Buffer to R2 via `PutObjectCommand`). Use `fast-csv 5.0.5` `writeToBuffer()` for CSV generation. Run all generation synchronously (no BullMQ) — datasets are small for an 8-person operation team and synchronous generation keeps the implementation simple while matching the existing pattern across all other backend operations.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| exceljs | 4.4.0 | XLSX workbook generation — multi-sheet, column headers, date formatting | Industry standard for Node.js XLSX generation; `writeBuffer()` returns `Buffer` directly; already has `fast-csv` as a transitive dependency |
| fast-csv | 5.0.5 | CSV generation via `writeToBuffer()` | Returns `Promise<Buffer>` — same upload pattern as XLSX; TypeScript-native; already a transitive dep inside exceljs |
| @aws-sdk/client-s3 | 3.1014.0 (already installed) | `PutObjectCommand` to upload generated Buffer to R2 | Already used by StorageService — no new dependency |
| @aws-sdk/s3-request-presigner | 3.1014.0 (already installed) | Presigned PUT for large files if needed | Already used by StorageService |
| prisma (ExportRecord) | ^6.19.2 (already installed) | Persist export history | Existing ORM |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 (already installed in frontend) | `formatDistanceToNow` for "3 hours ago" display in history table | Already present in frontend package.json |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| exceljs | xlsx (SheetJS) | SheetJS community edition has licensing restrictions on commercial use for some features; exceljs is MIT; exceljs has cleaner multi-sheet API |
| fast-csv | json2csv | json2csv 6.0.0-alpha.2 is pre-release at time of writing; fast-csv 5.0.5 is stable and maintained |
| fast-csv | built-in JSON.stringify + manual escaping | CSV escaping has many edge cases (commas in values, quotes, newlines); don't hand-roll |
| Synchronous generation | BullMQ async | BullMQ is installed and available, but polling/webhook adds frontend complexity for a small team's dataset sizes. Synchronous stays consistent with all other backend endpoints. |

**Installation (backend only — new packages):**
```bash
cd backend && npm install exceljs@4.4.0 @fast-csv/format@5.0.5
```

**Version verification (confirmed 2026-03-23):**
- `exceljs`: `4.4.0` — latest stable (published 2024-12-20)
- `fast-csv`: `5.0.5` — latest stable (published 2025-10-20)

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/exports/
├── exports.module.ts           # Imports StorageModule, all data modules as providers
├── exports.controller.ts       # POST /exports/generate, GET /exports/history
├── exports.service.ts          # Orchestrates: fetch data → build file → upload → save ExportRecord
├── dto/
│   └── generate-export.dto.ts  # reportType, format ('csv'|'xlsx'), dateFrom?, dateTo?, filters?
└── builders/
    ├── orders.builder.ts        # Builds workbook/CSV rows for orders report
    ├── inventory.builder.ts     # Stock levels report
    ├── analytics.builder.ts     # Revenue/channel/top-items
    ├── purchase-orders.builder.ts  # Multi-sheet: PO header + line items
    ├── recipes.builder.ts       # Multi-sheet: recipe summary + BOM lines
    └── ... (one builder per report group)

frontend/components/ops/exports/
├── ExportButton.tsx             # Outline button with FileDown icon; opens ExportDialog
├── ExportDialog.tsx             # Format selector + date range + filters summary + Discard/Export
├── ExportHistoryTable.tsx       # Table of ExportRecord rows
├── ExportStatusBadge.tsx        # Completed/Generating/Failed colored badge
└── ExportHistorySkeleton.tsx    # 5-row skeleton for loading state

frontend/app/(ops)/admin/exports/
└── page.tsx                     # AdminExportsPage — filter bar + ExportHistoryTable
```

### Pattern 1: File Generation → Buffer → R2 Upload (XLSX)

**What:** ExportsService generates the workbook in memory, calls `writeBuffer()` to get a `Buffer`, then uses `PutObjectCommand` to upload directly to R2, then calls `getPublicUrl()` for the download URL.

**When to use:** All XLSX exports.

**Example:**
```typescript
// Source: exceljs GitHub + AWS SDK v3 PutObjectCommand pattern
import ExcelJS from 'exceljs';
import { PutObjectCommand } from '@aws-sdk/client-s3';

async buildAndUploadXlsx(data: OrderRow[], key: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Orders');

  sheet.columns = [
    { header: 'Order ID',  key: 'id',         width: 36 },
    { header: 'Channel',   key: 'channel',    width: 12 },
    { header: 'Status',    key: 'status',     width: 12 },
    { header: 'Total',     key: 'total',      width: 10, style: { numFmt: '₹#,##0.00' } },
    { header: 'Created At',key: 'created_at', width: 22 },
  ];

  for (const row of data) {
    sheet.addRow(row);
  }

  // writeBuffer() returns Promise<Buffer> (confirmed from exceljs discussions#2495)
  const buffer = await workbook.xlsx.writeBuffer();

  await this.s3.send(new PutObjectCommand({
    Bucket: this.bucketName,
    Key: key,
    Body: buffer as Buffer,
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ContentLength: (buffer as Buffer).length,
  }));

  return this.storageService.getPublicUrl(key);
}
```

### Pattern 2: CSV Generation → Buffer → R2 Upload

**What:** `fast-csv` `writeToBuffer()` generates CSV bytes in memory. Same upload path as XLSX.

**When to use:** All CSV exports.

**Example:**
```typescript
// Source: fast-csv official docs (c2fo.github.io/fast-csv/docs/formatting/methods)
import { writeToBuffer } from '@fast-csv/format';

async buildAndUploadCsv(rows: Record<string, unknown>[], headers: string[], key: string): Promise<string> {
  const buffer = await writeToBuffer(rows, { headers });

  await this.s3.send(new PutObjectCommand({
    Bucket: this.bucketName,
    Key: key,
    Body: buffer,
    ContentType: 'text/csv',
    ContentLength: buffer.length,
  }));

  return this.storageService.getPublicUrl(key);
}
```

### Pattern 3: Multi-Sheet XLSX (POs, Recipes)

**What:** `addWorksheet()` called multiple times on the same workbook object, then one `writeBuffer()` call.

**When to use:** PO export (PO header sheet + Line Items sheet), Recipe export (Recipes sheet + BOM Lines sheet).

**Example:**
```typescript
// Source: exceljs GitHub README multi-sheet pattern
const workbook = new ExcelJS.Workbook();

const poSheet = workbook.addWorksheet('Purchase Orders');
poSheet.columns = [/* PO header columns */];
for (const po of purchaseOrders) poSheet.addRow({ ...po });

const linesSheet = workbook.addWorksheet('Line Items');
linesSheet.columns = [/* line item columns */];
for (const line of allLines) linesSheet.addRow({ ...line });

const buffer = await workbook.xlsx.writeBuffer();
```

### Pattern 4: ExportsService — Unified Dispatch

**What:** Single `generateExport(dto, userId)` method dispatches to the correct builder based on `dto.reportType`. This keeps the controller thin and the builder logic isolated.

**Example:**
```typescript
async generateExport(dto: GenerateExportDto, userId: string): Promise<{ downloadUrl: string; exportId: string }> {
  // 1. Fetch data via existing service methods
  const data = await this.fetchDataForReport(dto);

  // 2. Build file
  const key = this.buildExportKey(dto);
  const { buffer, contentType, fileSizeBytes } = dto.format === 'xlsx'
    ? await this.buildXlsx(dto.reportType, data, key)
    : await this.buildCsv(dto.reportType, data, key);

  // 3. Upload to R2
  await this.uploadToR2(key, buffer, contentType);
  const downloadUrl = this.storageService.getPublicUrl(key);

  // 4. Persist ExportRecord
  const record = await this.prisma.exportRecord.create({
    data: {
      report_type: dto.reportType,
      format: dto.format,
      filters_applied: JSON.stringify(dto),
      file_size_bytes: fileSizeBytes,
      r2_key: key,
      download_url: downloadUrl,
      generated_by: userId,
      status: 'completed',
    },
  });

  return { downloadUrl, exportId: record.id };
}
```

### Pattern 5: StorageService — Direct Upload (not presigned PUT)

**What:** The existing `StorageService.generatePresignedPutUrl()` is designed for client-to-R2 direct upload. For server-generated files, the backend uploads directly using `PutObjectCommand` with the Buffer body. The `s3` client and `bucketName` are already on StorageService — extend it with a `putObject(key, buffer, contentType)` method.

**Critical:** StorageService currently validates MIME types in `validatePresignRequest()` and blocks `text/csv` and XLSX. For export uploads, bypass validation — this is server-initiated, not client-initiated. Add a separate `putObjectDirect(key: string, buffer: Buffer, contentType: string)` method to StorageService that skips the MIME whitelist check.

### Pattern 6: R2 Key Structure for Exports

```
exports/{reportType}/{YYYYMMDD}/{filename}
```

Example: `exports/orders/20260323/orders_2026-01-01_to_2026-03-23_20260323T120000.xlsx`

Rationale: same prefix pattern as `evidence/{taskId}/...` and `guide/{timestamp}-...`. The date subfolder avoids key collisions and makes R2 browser browsing easier.

### Pattern 7: ExportRecord Prisma Model

```prisma
model ExportRecord {
  id              String   @id @default(uuid())
  report_type     String   // "orders" | "inventory" | "analytics_revenue" | ...
  format          String   // "csv" | "xlsx"
  filters_applied String?  // JSON string of the filters used
  file_size_bytes Int
  r2_key          String   // the R2 object key
  download_url    String   // public URL
  generated_by    String   // user.id
  generated_by_user User   @relation(fields: [generated_by], references: [id])
  status          String   @default("completed") // "generating" | "completed" | "failed"
  created_at      DateTime @default(now())

  @@index([report_type, created_at(sort: Desc)])
  @@index([generated_by, created_at(sort: Desc)])
}
```

**Note on status:** Since generation is synchronous in this phase, records are written as `completed` immediately. The `generating` and `failed` statuses are reserved for UI display consistency (the spec describes them) but in practice records are only ever written at the end of a successful generation. Failed generations raise an exception instead of writing a record — or write with `status: 'failed'` and no `download_url`.

### Pattern 8: Frontend Export Flow

**What:** `ExportButton` opens `ExportDialog`. Dialog calls `POST /exports/generate` via React Query `useMutation`. On success, toast with download URL. React Query cache for `['exports', 'history']` is invalidated.

**Example:**
```typescript
// Source: React Query useMutation pattern (existing throughout codebase)
const generateMutation = useMutation({
  mutationFn: (payload: GenerateExportPayload) =>
    apiClient.post<{ downloadUrl: string; exportId: string }>('/exports/generate', payload),
  onSuccess: ({ downloadUrl }) => {
    setIsGenerating(false);
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ['exports', 'history'] });
    toast.success('Export ready. Click to download.', {
      action: {
        label: 'Download',
        onClick: () => window.open(downloadUrl, '_blank'),
      },
    });
  },
  onError: () => {
    setIsGenerating(false);
    onOpenChange(false);
    toast.error('Export failed. The file could not be generated. Try again.');
  },
});
```

### Anti-Patterns to Avoid

- **Streaming XLSX to HTTP response:** The UI-SPEC mandates R2 storage and a public URL — do NOT return the file as a streamed HTTP response (Content-Disposition: attachment). Store to R2, return URL.
- **Client-side XLSX generation (SheetJS in browser):** D-05 locked server-side generation. Do not use browser-side file generation libraries.
- **Writing temporary disk files in NestJS:** `workbook.xlsx.writeFile('/tmp/...')` creates disk I/O and cleanup complexity. Use `writeBuffer()` for in-memory generation only.
- **Bypassing existing service methods:** Export builders MUST reuse existing service logic (e.g., `OrdersService.getOrders()`, `InventoryService.findAll()`). Do not write duplicate Prisma queries in export builders.
- **Paginated service methods in exports:** Existing `getOrders()` has `take`/`skip` pagination and a 100-record cap. Export builders need to either call without pagination limits or write a dedicated `findAllForExport()` variant that removes the limit. The export needs ALL records in the date range, not just the first page.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XLSX generation | Custom XML builder | exceljs `workbook.xlsx.writeBuffer()` | XLSX is a complex ZIP of XML files; column widths, date formats, cell types, multi-sheet — all edge cases |
| CSV escaping | `values.join(',')` | fast-csv `writeToBuffer()` | Commas inside values, quotes, line breaks in strings, UTF-8 BOM for Excel compatibility — all must be handled |
| File size calculation | `JSON.stringify(rows).length` | `(buffer as Buffer).length` after `writeBuffer()` | Only the actual generated file size is accurate; JSON length is meaningless |
| Date formatting in cells | `new Date().toISOString()` | exceljs `style.numFmt` or pre-format with `date-fns/format` before addRow | Excel date cells need a numFmt to display correctly; raw ISO strings become text |
| R2 direct upload | Custom fetch/multipart | `PutObjectCommand` (already in `@aws-sdk/client-s3`) | Already present in codebase via StorageService |

**Key insight:** The file generation domain has significant hidden complexity (XLSX format, CSV escaping, streaming vs. buffer). Both exceljs and fast-csv encapsulate years of edge case handling.

---

## 22 Export Types — Complete Map

This table defines every export type, its data source, export category, and whether it's time-series or master data.

| # | Report Name | Backend Service | Key Fields | Type | Sheet Count |
|---|-------------|----------------|-----------|------|------------|
| 1 | Orders | OrdersService.getOrders() | id, channel, status, subtotal, channel_modifier_amount, total, customer_name, payment method, created_at | Time-series | 1 |
| 2 | Revenue Summary | AnalyticsService.getRevenueSeries() | date, revenue | Time-series | 1 |
| 3 | Top Items | AnalyticsService.getTopItems() | name, quantity_sold, revenue | Time-series | 1 |
| 4 | Channel Breakdown | AnalyticsService.getChannelBreakdown() | channel, revenue, order_count | Time-series | 1 |
| 5 | Recipe Costs | AnalyticsService.getRecipeCosts() | recipe_name, computed_cost, selling_price, food_cost_pct, units_sold | Time-series | 1 |
| 6 | Inventory Levels | InventoryService.findAll() | ingredient name, category, zone, current_quantity, base_unit, min_stock_level, low_stock | Master data | 1 |
| 7 | Stock Movements | InventoryService.getMovements() or direct Prisma query | ingredient, zone, movement_type, quantity, unit, reason, created_by, created_at | Time-series | 1 |
| 8 | Purchase Orders | PurchaseOrdersService.findAll() + findOne() | PO header + line items | Time-series | 2 (multi-sheet) |
| 9 | Vendor Pricing | VendorPrice via Prisma direct | vendor, ingredient, price, unit, effective_date | Master data | 1 |
| 10 | Waste Log | WasteService.findAll() | waste_type, ingredient/recipe name, quantity, unit, reason, cost_impact, zone, logged_by, created_at | Time-series | 1 |
| 11 | Prep Batches | PrepBatchesService.findAll() | recipe name, zone, quantity_produced, quantity_remaining, unit, status, expires_at, created_at | Time-series | 1 |
| 12 | Ingredients | IngredientsService.findAll() | name, category, base_unit, min_stock_level | Master data | 1 |
| 13 | Vendors | VendorsService.findAll() | name, phone, email, address, payment_terms, status | Master data | 1 |
| 14 | Recipes | RecipesService.findAll() + BOM lines | recipe summary + RecipeLine BOM | Master data | 2 (multi-sheet) |
| 15 | Menu Items | MenuService.findItems() | name, category, base_price, status, recipe cost, channel modifiers | Master data | 1 |
| 16 | Feedback | FeedbackService.findAll() | order_id, rating, comment, customer_name, customer_phone, created_at | Time-series | 1 |
| 17 | Events | EventsService.findAll() | title, event_type, date, capacity, price, zone, brand, status | Master data | 1 |
| 18 | Event Guest Lists | EventBooking via Prisma direct (or extend EventsService) | event title, customer_name, customer_phone, guests, created_at | Master data | 1 |
| 19 | Tasks | TasksService.findMany() | title, domain, status, priority, xp, valid_xp, owner, quest, due_date, completed_at | Master data | 1 |
| 20 | KPIs | KpisService.findAll() | name, description, unit, target_value, current_value, status, domain | Master data | 1 |
| 21 | Decision Log | DecisionsService.findAll() | title, decision_type, context, proposed_by, impact_scope, final_decision, status | Master data | 1 |
| 22 | Leaderboard | LeaderboardService or direct User query | name, role, xp_total, level, streak_days | Master data | 1 |

**Multi-sheet exports (2 total):** Purchase Orders (#8), Recipes (#14). All others are single-sheet.

---

## RBAC on Exports — Recommendation

Based on existing permission structure, this is the recommended mapping. All exports require at minimum one matching permission — the same permission that gates reading the underlying data page.

| Export Type(s) | Required Permission | Rationale |
|---------------|--------------------|-----------|
| Orders, Revenue, Top Items, Channel Breakdown, Recipe Costs | `MANAGE_KPIS` | AnalyticsController already uses this |
| Inventory Levels, Stock Movements | `MANAGE_INVENTORY` | InventoryController uses this |
| Purchase Orders, Vendor Pricing | `MANAGE_PROCUREMENT` | PurchaseOrdersController uses this |
| Waste Log, Prep Batches | `MANAGE_KITCHEN` | KitchenController uses this |
| Ingredients, Vendors, Recipes, Menu Items | `MANAGE_OPS` | Operations data |
| Feedback | `MANAGE_OPS` | FeedbackController gates with this |
| Events, Guest Lists | `MANAGE_OPS` | EventsController uses this |
| Tasks, KPIs, Decision Log, Leaderboard | `MANAGE_KPIS` | Analytics/intelligence data |
| Export History (`/admin/exports` page) | `MANAGE_SYSTEM` | Admin-only history view |

**New permission needed:** None. Existing permissions cover all export types. The ExportsController uses `@RequiresPermission(Permission.X)` per endpoint or dispatches internally with per-type permission checks.

**Implementation option:** Single `POST /exports/generate` endpoint guarded by a service-level permission check based on `dto.reportType`, rather than 22 separate endpoints. This is simpler and consistent.

---

## Pagination Gotcha — Export Must Bypass Page Limits

**Critical:** Existing service methods have hard pagination caps:
- `OrdersService.getOrders()`: `take = Math.min(limit || 50, 100)` — maximum 100 records
- `InventoryService.findAll()`: same 100-record cap
- `WasteService.findAll()`: same 100-record cap

Export builders MUST NOT use these paginated methods directly. Two options:

**Option A (Recommended):** Add `findAllForExport(filters)` methods to the relevant services that remove the `take`/`skip` cap and accept a date range. This keeps export logic isolated and prevents unbounded queries on the normal API.

**Option B:** Export builders write their own Prisma queries directly. This duplicates logic but avoids touching existing services.

Option A is preferred — it keeps the data access logic in the service layer, which is the existing NestJS convention.

---

## Common Pitfalls

### Pitfall 1: `writeBuffer()` returns `Buffer | ArrayBuffer` — cast explicitly

**What goes wrong:** `workbook.xlsx.writeBuffer()` return type in exceljs TypeScript types is `Buffer | ArrayBuffer`. Passing `ArrayBuffer` directly to `PutObjectCommand.Body` may cause type errors or silent upload failures.

**Why it happens:** The exceljs type definitions are slightly loose.

**How to avoid:** Cast: `const buf = await workbook.xlsx.writeBuffer() as Buffer;` and use `buf.length` for `ContentLength`.

**Warning signs:** TypeScript error on `Body: buffer` or `ContentLength: buffer.length`.

---

### Pitfall 2: StorageService MIME type whitelist blocks CSV and XLSX exports

**What goes wrong:** `StorageService.validatePresignRequest()` only allows a fixed set of MIME types. Neither `text/csv` nor `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` are in the current whitelist — they would throw `BadRequestException`.

**Why it happens:** The whitelist was designed for user evidence uploads, not server-generated exports.

**How to avoid:** Add a `putObjectDirect(key: string, body: Buffer, contentType: string): Promise<void>` method to `StorageService` that skips `validatePresignRequest()`. This method is only callable from server-side code (ExportsService) — not exposed via HTTP.

**Warning signs:** `BadRequestException: Content type "text/csv" is not allowed` during export generation.

---

### Pitfall 3: Existing services cap data at 100 records for exports

**What goes wrong:** If the ExportsService calls `OrdersService.getOrders()` directly, it will only get up to 100 records regardless of date range.

**Why it happens:** The `take = Math.min(limit || 50, 100)` guard exists to protect the API from unbounded queries.

**How to avoid:** Add `findAllForExport()` variants per service (or direct Prisma queries in export builders) that do not apply `take`/`skip`.

**Warning signs:** Export files that suspiciously contain exactly 50 or 100 rows.

---

### Pitfall 4: Decimal fields from Prisma are `Decimal` type, not `number`

**What goes wrong:** Prisma's `Decimal` type (used on `total`, `subtotal`, `base_price`, `computed_cost`, etc.) does not serialize to plain numbers in JavaScript. If added to an exceljs row as a `Decimal` object, the cell may render as `[object Object]`.

**Why it happens:** Prisma wraps `NUMERIC`/`DECIMAL` PostgreSQL columns in a `Decimal` class.

**How to avoid:** Convert with `Number(row.total)` before passing to `sheet.addRow()`. For percentage display: `Math.round(Number(row.food_cost_pct) * 100) / 100`.

**Warning signs:** Cells in the exported file showing `[object Object]` or NaN.

---

### Pitfall 5: Date fields must be pre-formatted for CSV (ISO string) but can be Excel date cells in XLSX

**What goes wrong:** For CSV, passing a `Date` object to fast-csv rows will use JavaScript's default `toString()` which produces locale-dependent output. For XLSX, raw Date objects work correctly in exceljs but need a `numFmt` style.

**Why it happens:** CSV is plain text; XLSX has a date cell type.

**How to avoid:**
- CSV: format dates as ISO strings before row building: `created_at: row.created_at.toISOString()`
- XLSX: use `style: { numFmt: 'YYYY-MM-DD HH:MM:SS' }` on date columns, pass Date objects natively to exceljs

**Warning signs:** Date columns in CSV showing `Mon Mar 23 2026 12:00:00 GMT+0530 (IST)` format.

---

### Pitfall 6: R2 `PutObjectCommand` requires `ContentLength` for buffer uploads

**What goes wrong:** Uploading a `Buffer` to R2 (S3-compatible) without specifying `ContentLength` may fail or produce corrupted files because R2 cannot determine the stream length.

**Why it happens:** R2/S3 requires known content length for non-multipart puts.

**How to avoid:** Always set `ContentLength: buffer.length` when using `PutObjectCommand` with a Buffer body.

**Warning signs:** `MissingContentLength` error from R2, or 400 status from R2 during upload.

---

### Pitfall 7: ExportRecord `generated_by` must reference a valid User

**What goes wrong:** The User model does not currently have a relation to ExportRecord. If the `generated_by` FK is added without updating the User model's relation list, Prisma will generate a client but the migration may produce unexpected behavior.

**Why it happens:** Prisma requires explicit relation fields on both sides.

**How to avoid:** Add `export_records ExportRecord[]` to the User model when writing the Prisma migration. Run `npx prisma migrate dev --name add-export-record`.

**Warning signs:** Prisma migration warning about implicit many-to-many or missing back-relation.

---

## Code Examples

### ExcelJS Multi-Sheet (Purchase Orders)
```typescript
// Source: exceljs README — multi-sheet workbook pattern
const workbook = new ExcelJS.Workbook();

// Sheet 1: PO headers
const poSheet = workbook.addWorksheet('Purchase Orders');
poSheet.columns = [
  { header: 'PO ID',        key: 'id',           width: 36 },
  { header: 'Vendor',       key: 'vendor_name',  width: 24 },
  { header: 'Zone',         key: 'zone_name',    width: 16 },
  { header: 'Status',       key: 'status',       width: 12 },
  { header: 'Total Amount', key: 'total_amount', width: 14, style: { numFmt: '₹#,##0.00' } },
  { header: 'Ordered By',   key: 'ordered_by',   width: 20 },
  { header: 'Ordered At',   key: 'ordered_at',   width: 22 },
];
for (const po of purchaseOrders) {
  poSheet.addRow({
    id: po.id,
    vendor_name: po.vendor.name,
    zone_name: po.zone.name,
    status: po.status,
    total_amount: Number(po.total_amount),  // Decimal -> number (Pitfall 4)
    ordered_by: po.ordered_by_user.name,
    ordered_at: po.ordered_at,              // Date object — exceljs handles this
  });
}

// Sheet 2: Line items (all lines from all POs in range)
const linesSheet = workbook.addWorksheet('Line Items');
linesSheet.columns = [
  { header: 'PO ID',       key: 'po_id',           width: 36 },
  { header: 'Ingredient',  key: 'ingredient_name', width: 24 },
  { header: 'Qty',         key: 'quantity',        width: 10 },
  { header: 'Unit',        key: 'unit',            width: 8  },
  { header: 'Unit Cost',   key: 'unit_cost',       width: 12, style: { numFmt: '₹#,##0.00' } },
  { header: 'Received Qty',key: 'received_qty',    width: 12 },
];
for (const po of purchaseOrders) {
  for (const line of po.lines) {
    linesSheet.addRow({
      po_id: po.id,
      ingredient_name: line.ingredient.name,
      quantity: Number(line.quantity),
      unit: line.unit,
      unit_cost: Number(line.unit_cost),
      received_qty: line.received_quantity ? Number(line.received_quantity) : '',
    });
  }
}

const buffer = await workbook.xlsx.writeBuffer() as Buffer;
```

### Fast-CSV with Headers (Inventory Levels)
```typescript
// Source: fast-csv docs (c2fo.github.io/fast-csv/docs/formatting/methods)
import { writeToBuffer } from '@fast-csv/format';

const rows = stocks.map(s => ({
  Ingredient:    s.ingredient.name,
  Category:      s.ingredient.category,
  Zone:          s.zone.name,
  'Current Qty': Number(s.current_quantity),
  Unit:          s.ingredient.base_unit,
  'Min Stock':   Number(s.ingredient.min_stock_level),
  'Low Stock':   s.low_stock ? 'Yes' : 'No',
}));

const buffer = await writeToBuffer(rows, { headers: true });
// returns Buffer; 'headers: true' uses object keys as column headers
```

### Export Key Builder
```typescript
function buildExportKey(reportType: string, format: string, dateFrom?: string, dateTo?: string): string {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', 'T').slice(0, 15);
  const dateRange = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : 'all';
  const filename = `${reportType}_${dateRange}_${ts}.${format}`;
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `exports/${reportType}/${datePrefix}/${filename}`;
}
```

### ExportRecord Prisma Migration
```prisma
// Add to backend/prisma/schema.prisma

model ExportRecord {
  id              String   @id @default(uuid())
  report_type     String
  format          String   // "csv" | "xlsx"
  filters_applied String?  @db.Text   // JSON string
  file_size_bytes Int
  r2_key          String
  download_url    String
  generated_by    String
  user            User     @relation(fields: [generated_by], references: [id])
  status          String   @default("completed")  // "generating" | "completed" | "failed"
  created_at      DateTime @default(now())

  @@index([report_type, created_at(sort: Desc)])
  @@index([generated_by, created_at(sort: Desc)])
  @@index([status, created_at(sort: Desc)])
}

// Also add to User model:
// export_records  ExportRecord[]
```

---

## Grouping Recommendation — 22 Exports Into Plans

Given the codebase patterns (fine granularity, 2-3 tasks per plan, ~7-10 files per plan), the recommended grouping is:

**Plan 1 — Foundation:** ExportRecord Prisma model + migration, ExportsModule skeleton (service/controller/dto), StorageService extension (`putObjectDirect`), new `EXPORT_DATA` permission enum entry (or reuse existing), `GenerateExportDto`, R2 key builder utility.

**Plan 2 — Financial/Analytics Exports (5 types):** Orders, Revenue Summary, Top Items, Channel Breakdown, Recipe Costs. All use AnalyticsService/OrdersService. Includes `findAllForExport()` variants.

**Plan 3 — Inventory/Procurement Exports (4 types):** Inventory Levels, Stock Movements, Purchase Orders (multi-sheet), Vendor Pricing.

**Plan 4 — Kitchen/F&B Exports (5 types):** Waste Log, Prep Batches, Ingredients, Vendors, Recipes (multi-sheet).

**Plan 5 — Menu/Events/Feedback Exports (4 types):** Menu Items, Feedback, Events, Event Guest Lists.

**Plan 6 — Operations/Intelligence Exports (4 types) + Admin Page:** Tasks, KPIs, Decision Log, Leaderboard. Plus: `/admin/exports` page (ExportHistoryTable, ExportStatusBadge, ExportHistorySkeleton, AdminExportsPage).

**Plan 7 — Export Buttons on Data Pages (13 pages):** Add ExportButton + ExportDialog to all 13 existing data pages. Sidebar nav "Exports" item.

This is 7 plans total. Plans 2-5 follow the identical pattern (fetch → build → upload → record) which makes them fast to execute once Plan 1's foundation is complete.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| xlsx (SheetJS) for Node.js | exceljs 4.4.0 | 2024+ | exceljs has cleaner multi-sheet API; MIT license unambiguous |
| Client-side CSV via hidden anchor tag | Server-side generation + R2 URL | Phase 18 decision | More durable, redownloadable, auditable |
| Streaming HTTP response (Content-Disposition: attachment) | Store to R2, return URL | Phase 18 decision | Enables history, re-download, no connection timeout risk |

**Deprecated/outdated:**
- `workbook.xlsx.write(stream)`: Older streaming API. Use `writeBuffer()` for in-memory (confirmed current recommendation per exceljs discussions#2495).
- `StreamBuf` constructor: Mentioned in old exceljs docs; no longer works as documented. Use `writeBuffer()`.

---

## Open Questions

1. **Event Guest List source:** No `EventsService.getGuestList(eventId)` exists today. The ExportRecord for guest lists needs either: (a) extend EventsService to expose `getBookingsForExport(eventId?)`, or (b) direct Prisma query in the export builder. Recommendation: direct Prisma query to avoid scope creep in EventsService.
   - What we know: `EventBooking` model exists with `event_id`, `customer_name`, `customer_phone`, `guests`, `created_at`
   - What's unclear: whether guest list export is per-event or all events combined
   - Recommendation: export all bookings with event title joined (like other master-data exports)

2. **`MANAGE_OPS` permission on Vendors/Ingredients/Recipes:** These are currently guarded by `MANAGE_OPS`. However, some roles (e.g., Head Chef) may have `MANAGE_KITCHEN` but not `MANAGE_OPS`. The export for Recipes may need to be accessible to kitchen staff.
   - What we know: Permission mapping is stored in Role.permissions (string array in DB); current assignment not audited here
   - What's unclear: exact role-permission assignments
   - Recommendation: Use `MANAGE_OPS` for now as it matches the existing data page guards; adjust if specific role feedback arises

3. **File size limits for large exports:** For an 8-person operation, datasets are small. But stock movements could theoretically be large if the system runs for months.
   - What we know: R2 via PutObjectCommand supports objects up to 5GB. For in-memory Buffer, Node.js is the limit (~1.5GB practical).
   - What's unclear: Whether stock movements will ever exceed 10MB buffer in practice
   - Recommendation: No chunking needed. If buffer > 50MB is a concern later, switch to multipart upload. Not required for Phase 18.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.x (configured in `backend/package.json`) |
| Config file | `backend/package.json → jest` block |
| Quick run command | `cd backend && npm test -- --testPathPattern=exports` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map

Phase 18 requirements are TBD (defined during planning). The following maps expected behaviors to test types:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `ExportsService.generateExport()` dispatches to correct builder by reportType | unit | `npm test -- --testPathPattern=exports.service` | Wave 0 |
| XLSX buffer is non-empty and valid for orders export | unit | `npm test -- --testPathPattern=orders.builder` | Wave 0 |
| CSV buffer contains correct headers for inventory export | unit | `npm test -- --testPathPattern=inventory.builder` | Wave 0 |
| ExportRecord is persisted with correct fields after generation | unit (mock Prisma) | `npm test -- --testPathPattern=exports.service` | Wave 0 |
| `POST /exports/generate` returns `{ downloadUrl, exportId }` | e2e / integration | manual smoke | N/A |
| Permission guard blocks unauthorized access | unit (mock guard) | `npm test -- --testPathPattern=exports.controller` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npm test -- --testPathPattern=exports --passWithNoTests`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/exports/exports.service.spec.ts` — covers service dispatch, ExportRecord creation
- [ ] `backend/src/exports/builders/orders.builder.spec.ts` — covers XLSX buffer validity, row count
- [ ] `backend/src/exports/builders/inventory.builder.spec.ts` — covers CSV headers
- [ ] `backend/src/exports/exports.controller.spec.ts` — covers permission guard

---

## Sources

### Primary (HIGH confidence)
- exceljs npm registry — version 4.4.0, published 2024-12-20, MIT license
- fast-csv npm registry — version 5.0.5, published 2025-10-20
- exceljs GitHub discussions#2495 — confirmed `writeBuffer()` returns `Buffer`; StreamBuf constructor no longer works
- fast-csv official docs (c2fo.github.io/fast-csv/docs/formatting/methods) — `writeToBuffer(rows, opts): Promise<Buffer>` signature verified
- Project codebase: `backend/src/storage/storage.service.ts` — `generatePresignedPutUrl`, `getPublicUrl` pattern
- Project codebase: `backend/src/types/permissions.ts` — complete Permission enum
- Project codebase: `backend/prisma/schema.prisma` — all model fields verified
- Project codebase: `backend/src/analytics/analytics.service.ts` — existing method signatures
- Project codebase: `backend/src/orders/orders.service.ts` — pagination cap verified (take: 100)

### Secondary (MEDIUM confidence)
- AWS SDK v3 `PutObjectCommand` pattern — `Body: Buffer, ContentLength: buffer.length` — verified from AWS SDK documentation pattern and existing StorageService usage in codebase
- exceljs multi-sheet `addWorksheet()` API — verified from official GitHub README and multiple community sources

### Tertiary (LOW confidence)
- NestJS BullMQ async pattern — not deeply verified for this phase; decision made to use synchronous generation instead

---

## Metadata

**Confidence breakdown:**
- Standard stack (exceljs, fast-csv): HIGH — versions confirmed from npm registry, APIs confirmed from official docs
- Architecture patterns (Buffer → PutObjectCommand → R2): HIGH — existing StorageService shows the S3 client is already configured; PutObjectCommand is standard AWS SDK v3
- RBAC mapping: HIGH — Permission enum fully read from codebase; mapping follows existing controller guards
- Pagination pitfall: HIGH — code directly confirmed `take = Math.min(limit || 50, 100)` in OrdersService and InventoryService
- 22 export type mapping: HIGH — all models and services verified from schema.prisma and service files
- Plan grouping: MEDIUM — depends on planner's interpretation of file count per plan

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (stable libraries; exceljs has been at 4.4.0 since Dec 2024)
