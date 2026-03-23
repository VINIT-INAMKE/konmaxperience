# Phase 19: Master Data Import + Export Gaps + Timezone - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Three deliverables:
1. Bulk CSV/XLSX import for master data (ingredients, vendors, vendor pricing) with drag-drop upload, preview table, inline editing, schema-strict validation, and downloadable templates
2. Missing export builders (missions, quests) + ExportButton on ALL pages with exportable data (audit and fill gaps)
3. IST timezone already configured in main.ts — verify it's working across all date outputs

Requirements: TBD (to be defined during planning)

</domain>

<decisions>
## Implementation Decisions

### Import Upload UX
- **D-01:** Drag-drop zone + file picker button — accepts CSV and XLSX files
- **D-02:** Preview table after upload — shows all parsed rows with validation status per row/cell
- **D-03:** Inline cell editing in preview table — user can fix validation errors directly before importing
- **D-04:** "Import" button commits valid rows after user review
- **D-05:** Each import type has a dedicated page under `/admin/import/[type]` (e.g., `/admin/import/ingredients`)
- **D-06:** Admin imports page at `/admin/import` listing all available import types

### Import Templates
- **D-07:** Each import type provides a downloadable template file (CSV and XLSX)
- **D-08:** Templates have exact column headers matching Prisma schema field names
- **D-09:** Templates include one sample row showing correct data format
- **D-10:** Templates include validation notes as comments or a second "Instructions" sheet in XLSX
- **D-11:** "Download Template" button prominently displayed on each import page before the upload zone

### Import Validation (Schema-Strict)
- **D-12:** Validation runs against exact Prisma model constraints — required fields, field types, enum values, max lengths
- **D-13:** Foreign key references validated by name resolution (e.g., ingredient name → ingredient ID, zone name → zone ID)
- **D-14:** Invalid cells highlighted in red with error tooltip in the preview table
- **D-15:** Valid rows shown in green, invalid rows in red/amber
- **D-16:** User can fix errors inline in the preview table before importing

### Import Error & Duplicate Handling
- **D-17:** "Update existing records" toggle in import dialog — user chooses per import whether to upsert or skip duplicates
- **D-18:** Duplicate detection by name field (ingredient name, vendor name)
- **D-19:** Import result summary after commit: X imported, Y updated, Z skipped, W errors

### Import Types (Phase 19)
- **D-20:** Ingredients: name, category, base_unit, min_stock_level
- **D-21:** Vendors: name, phone, email, address, payment_terms, status
- **D-22:** Vendor Pricing: vendor (name), ingredient (name), price, unit, effective_date

### Export Gaps
- **D-23:** New export builders: MissionsExportBuilder, QuestsExportBuilder
- **D-24:** Audit ALL frontend pages for missing ExportButton — add to every page with exportable data
- **D-25:** ExportButton on missions list, readiness dashboard, tasks list (not just detail), decisions, and any other page currently missing it

### IST Timezone
- **D-26:** Already set via `process.env.TZ = 'Asia/Kolkata'` in main.ts — verify all date formatting uses IST
- **D-27:** Export files should show IST timestamps in column headers and date values

### Claude's Discretion
- Import page layout and styling
- Template file format details (column order, sample data values)
- Exact validation error message wording
- How to present the import result summary
- Which pages are missing ExportButton (discovered during audit)
- Whether to use a shared ImportModule or per-type modules

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prisma Schema (import target models)
- `backend/prisma/schema.prisma` — Ingredient, Vendor, VendorPrice models with exact field types and constraints

### Existing Export Infrastructure (reuse for import)
- `backend/src/exports/exports.module.ts` — ExportsModule with builder registry (add mission/quest builders here)
- `backend/src/exports/export-types.ts` — Export type config (add missions, quests)
- `backend/src/exports/exports.service.ts` — ExportsService pattern
- `frontend/components/ops/exports/ExportButton.tsx` — ExportButton component (add to missing pages)
- `frontend/components/ops/exports/ExportDialog.tsx` — ExportDialog (reference for import dialog pattern)

### CSV/XLSX Libraries (already installed)
- `backend/package.json` — exceljs 4.4.0, fast-csv (for parsing imports)

### Existing Service Methods
- `backend/src/ingredients/ingredients.service.ts` — Ingredient CRUD
- `backend/src/vendors/vendors.service.ts` — Vendor CRUD + VendorPrice
- `backend/src/missions/missions.service.ts` — Missions (for export builder)
- `backend/src/quests/quests.service.ts` — Quests (for export builder)

### Timezone
- `backend/src/main.ts` — `process.env.TZ = 'Asia/Kolkata'` already set

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ExportsModule` builder registry pattern — reference for import module design
- `ExportButton` + `ExportDialog` — reference for import UI components
- `fast-csv` already in backend for CSV parsing (used by export, now also for import)
- `exceljs` for XLSX reading and template generation
- Admin page patterns (`/admin/exports`, `/admin/guide`) for import admin pages

### Established Patterns
- NestJS module → controller → service for all backend features
- React Query for data fetching + mutations
- Sonner toast for success/error notifications
- Admin sidebar nav with permission gating

### Integration Points
- New `ImportsModule` in NestJS with import parsing, validation, and commit logic
- New Prisma migration: ImportRecord model to track import history (optional)
- New `/admin/import` frontend pages
- Sidebar admin nav — add "Import" item
- Export builders: add to existing `exports.module.ts`
- ExportButton: add to pages missing it

</code_context>

<specifics>
## Specific Ideas

- Templates must match EXACT Prisma schema field definitions — no guessing column names
- Inline editing in preview table is key — users shouldn't need to re-upload the entire file for a few cell errors
- "Update existing records" toggle gives users control over upsert behavior
- Import result summary should be clear: "12 imported, 3 updated, 1 skipped (duplicate), 2 errors"

</specifics>

<deferred>
## Deferred Ideas

- Import for operational data (stock, recipes, menu, events, tasks, quests, KPIs) — Phase 20
- Scheduled/recurring imports — Future
- Import from Google Sheets URL — Future
- Import validation rules beyond schema (business logic like "price must be positive") — nice to have but not required

</deferred>

---

*Phase: 19-master-data-import*
*Context gathered: 2026-03-23*
