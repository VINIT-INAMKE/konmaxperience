# Phase 18: Data Export - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

CSV/XLSX export for all major report types across the system. Backend generates files, stores on R2, returns download URL. Includes export buttons on data pages + dedicated admin exports page with history. No import functionality in this phase.

Requirements: TBD (to be defined during planning — covers 22 report types)

</domain>

<decisions>
## Implementation Decisions

### Export Format & File
- **D-01:** Both CSV and XLSX formats available — user chooses via download dropdown
- **D-02:** Multi-sheet XLSX workbooks for complex data (e.g., PO export with 'Orders' + 'Line Items', Recipe export with 'Recipes' + 'BOM Lines'). Simple data uses single sheet.
- **D-03:** Proper column headers, date formatting, and sheet names in XLSX files
- **D-04:** File naming convention: `{report_type}_{date_range}_{export_timestamp}.{csv|xlsx}` (e.g., `orders_2026-01-01_to_2026-03-23_20260323T120000.xlsx`)

### Export Pipeline
- **D-05:** Server-side file generation — backend generates the file, NOT client-side
- **D-06:** Generated file stored on R2 via presigned URL (same StorageService pattern as evidence/guide images)
- **D-07:** Backend returns the R2 public URL as the download link
- **D-08:** Files persist on R2 — enables re-download and export history
- **D-09:** File naming includes export details: report type, date/time range, generation timestamp

### Export Trigger UX
- **D-10:** Export buttons on individual data pages (orders, inventory, analytics, etc.) — exports what the page shows
- **D-11:** Dedicated `/admin/exports` page listing all report types — centralized export catalog
- **D-12:** Export dialog with page filters as defaults — user can adjust date range and filters before downloading
- **D-13:** Format selector in export dialog: CSV or XLSX dropdown

### Export History
- **D-14:** Admin exports page shows history of past exports — download link, timestamp, who generated, report type, file size
- **D-15:** History persisted in database (new ExportRecord Prisma model)
- **D-16:** R2 storage keys referenced from ExportRecord for re-download

### Filtering & Date Ranges
- **D-17:** Page filters carry over as defaults in export dialog
- **D-18:** User can adjust date range and other filters in export dialog before generating
- **D-19:** Time-series exports (orders, waste, stock movements, POs) support date range filtering
- **D-20:** Master data exports (ingredients, vendors, recipes, menu) export full dataset (no date range)

### Scope & Grouping
- **D-21:** Claude's discretion on how to group the 22 export types into plans — group by shared patterns, data complexity, and module proximity
- **D-22:** All 22 report types delivered in this phase (not split across phases)

### Claude's Discretion
- Exact XLSX library choice (exceljs vs xlsx vs similar)
- CSV library choice (fast-csv, json2csv, or built-in)
- How to group 22 exports into plans (by module, complexity, or shared patterns)
- R2 key prefix structure for export files
- ExportRecord model fields beyond the essentials
- Export dialog component design
- Whether to use BullMQ for async export generation or synchronous for small datasets
- RBAC on exports — which roles can export which reports

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Services (data sources for exports)
- `backend/src/analytics/analytics.service.ts` — Revenue summary, top items, channels, recipe costs (already computed)
- `backend/src/orders/orders.service.ts` — Order CRUD with payment data
- `backend/src/inventory/inventory.service.ts` — Stock levels, movements
- `backend/src/purchase-orders/purchase-orders.service.ts` — PO data with line items
- `backend/src/kitchen/waste/waste.service.ts` — Waste logs with cost impact
- `backend/src/kitchen/prep-batches/prep-batches.service.ts` — Prep batch history
- `backend/src/feedback/feedback.service.ts` — Customer feedback with ratings
- `backend/src/events/events.service.ts` — Events and bookings
- `backend/src/ingredients/ingredients.service.ts` — Ingredient master data
- `backend/src/vendors/vendors.service.ts` — Vendor list with pricing
- `backend/src/recipes/recipes.service.ts` — Recipes with BOM and computed cost
- `backend/src/menu/menu.service.ts` — Menu items with channel modifiers
- `backend/src/missions/missions.service.ts` — Missions
- `backend/src/quests/quests.service.ts` — Quests
- `backend/src/tasks/tasks.service.ts` — Tasks with XP and status
- `backend/src/kpis/kpis.service.ts` — KPI definitions and values
- `backend/src/decisions/decisions.service.ts` — Decision log
- `backend/src/leaderboard/leaderboard.service.ts` — XP rankings

### Storage (R2 upload pattern)
- `backend/src/storage/storage.service.ts` — generatePresignedPutUrl, getPublicUrl (reuse for export files)
- `backend/src/storage/storage.controller.ts` — Presign endpoint pattern

### Import/Export Reference
- `docs/import-export-overview.md` — Full analysis of all 22 exportable report types with who needs each

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StorageService.generatePresignedPutUrl(key, contentType)` — reuse for export file uploads to R2
- `StorageService.getPublicUrl(key)` — resolve R2 keys to download URLs
- `AnalyticsService` already computes most financial/operational summaries — exports can reuse these
- Existing admin page patterns (`/admin/guide`, `/admin/users`) for the exports page

### Established Patterns
- NestJS service → controller pattern for all data access
- React Query for data fetching on frontend
- Sheet-based forms from shadcn for dialogs
- `@RequiresPermission()` for RBAC gating
- Sonner toast for success/error notifications

### Integration Points
- New `ExportsModule` in NestJS with `ExportsService` and `ExportsController`
- New `ExportRecord` Prisma model for history tracking
- New `/admin/exports` frontend page with export history table
- Export buttons added to existing data pages (orders, inventory, analytics, etc.)
- Sidebar admin nav — add "Exports" item

</code_context>

<specifics>
## Specific Ideas

- Export files must be named properly with report type + date range + timestamp — not generic UUIDs
- R2 storage for persistence — exports are redownloadable, not one-shot streams
- Export history on admin page gives accountability — who exported what, when
- Page filters should carry over to export dialog as sensible defaults

</specifics>

<deferred>
## Deferred Ideas

- Scheduled/recurring exports — Future
- Email delivery of exports — Future
- Export templates (saved filter presets) — Future
- Bulk export (all reports at once) — Future

</deferred>

---

*Phase: 18-data-export*
*Context gathered: 2026-03-23*
