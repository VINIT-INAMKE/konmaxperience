---
phase: 18-data-export
plan: 07
subsystem: ui
tags: [nextjs, react, shadcn, exports, dialog, table, sidebar, lucide]

# Dependency graph
requires:
  - phase: 18-data-export
    provides: ExportsModule with POST /exports/generate and GET /exports/history endpoints, EXPORT_TYPE_CONFIG with 22 report types
  - phase: 10-pos-orders
    provides: Orders page with filter bar layout pattern
  - phase: 04-gamification-readiness
    provides: Analytics page, Leaderboard page
provides:
  - ExportRecord, GenerateExportPayload/Response types and EXPORT_TYPE_CONFIG frontend mirror
  - ExportButton reusable component with dialog trigger and loading state
  - ExportDialog with format selector (CSV/XLSX), date range, filters summary, mutation
  - ExportStatusBadge with completed/generating/failed status colors
  - ExportHistoryTable with format badge, file size, relative time, re-download
  - ExportHistorySkeleton with 5-row skeleton loading state
  - Admin exports page at /admin/exports with report type and date filters
  - Sidebar Exports nav item under Admin section (MANAGE_SYSTEM guard)
  - ExportButton integrated on all 13 data pages
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [reusable-export-button-pattern, card-style-radio-selector, admin-history-page-pattern]

key-files:
  created:
    - frontend/lib/types/exports.ts
    - frontend/components/ops/exports/ExportButton.tsx
    - frontend/components/ops/exports/ExportDialog.tsx
    - frontend/components/ops/exports/ExportStatusBadge.tsx
    - frontend/components/ops/exports/ExportHistoryTable.tsx
    - frontend/components/ops/exports/ExportHistorySkeleton.tsx
    - frontend/app/(ops)/admin/exports/page.tsx
  modified:
    - frontend/lib/types/index.ts
    - frontend/components/ops/Sidebar.tsx
    - frontend/app/(ops)/pos/orders/page.tsx
    - frontend/app/(ops)/operations/inventory/page.tsx
    - frontend/app/(ops)/intelligence/analytics/page.tsx
    - frontend/app/(ops)/operations/purchase-orders/page.tsx
    - frontend/app/(ops)/operations/recipes/page.tsx
    - frontend/app/(ops)/operations/ingredients/page.tsx
    - frontend/app/(ops)/operations/vendors/page.tsx
    - frontend/app/(ops)/operations/menu/page.tsx
    - frontend/app/(ops)/operations/feedback/page.tsx
    - frontend/app/(ops)/operations/events/page.tsx
    - frontend/app/(ops)/operations/kitchen/kds/page.tsx
    - frontend/app/(ops)/tasks/[id]/page.tsx
    - frontend/app/(ops)/leaderboard/page.tsx

key-decisions:
  - "TooltipProvider delay prop (not Tooltip delay) for base-ui tooltip component API compatibility"
  - "XLSX default format selection in ExportDialog (not CSV) per UI-SPEC"
  - "MANAGE_SYSTEM permission guard for Exports sidebar nav item per RBAC recommendation"
  - "KDS export button placed in top bar next to exit (fullscreen KDS has no filter bar)"
  - "Tasks export button placed in task detail header (exports ALL tasks, not just viewed task)"

patterns-established:
  - "ExportButton pattern: reportType + reportName + isTimeSeries + optional currentFilters props for any data page"
  - "Card-style radio selector: role=radiogroup container with role=radio cards, border-primary active state"
  - "Admin history page: filter bar + table with skeleton loading, empty state, error state"

requirements-completed: [EXPORT-09, EXPORT-10, EXPORT-11]

# Metrics
duration: 23min
completed: 2026-03-23
---

# Phase 18 Plan 07: Frontend Export UI Summary

**Reusable ExportButton/ExportDialog components with card-style format selector, admin exports history page with re-download, and export integration across all 13 data pages**

## Performance

- **Duration:** 23 min
- **Started:** 2026-03-23T08:49:53Z
- **Completed:** 2026-03-23T09:12:54Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments
- ExportButton, ExportDialog, ExportStatusBadge reusable components created per UI-SPEC with full accessibility (ARIA roles, keyboard navigation)
- Admin exports history page at /admin/exports with report type filter, date range, skeleton loading, empty state, error state, and re-download with tooltip
- ExportButton added to all 13 data pages (orders, inventory, analytics, purchase orders, recipes, ingredients, vendors, menu, feedback, events, KDS, tasks, leaderboard) with correct reportType and isTimeSeries configuration
- Sidebar Exports nav item under Admin section with MANAGE_SYSTEM permission guard and Download icon
- ExportRecord, GenerateExportPayload/Response types and 22-type EXPORT_TYPE_CONFIG mirror for frontend

## Task Commits

Each task was committed atomically:

1. **Task 1: Export types, ExportButton, ExportDialog, ExportStatusBadge** - `354f6dd` (feat)
2. **Task 2: Admin exports page, history table, skeleton, sidebar nav** - `6e069ad` (feat)
3. **Task 3: Add ExportButton to all 13 data pages** - `35e9212` (feat)

## Files Created/Modified
- `frontend/lib/types/exports.ts` - ExportRecord, GenerateExportPayload/Response types, ReportType union, EXPORT_TYPE_CONFIG
- `frontend/lib/types/index.ts` - Added barrel export for exports types
- `frontend/components/ops/exports/ExportButton.tsx` - Reusable export trigger with FileDown icon, loading state, dialog management
- `frontend/components/ops/exports/ExportDialog.tsx` - Format selector (CSV/XLSX cards), date range, filters summary, mutation with toast
- `frontend/components/ops/exports/ExportStatusBadge.tsx` - Status badge with completed/generating/failed colors
- `frontend/components/ops/exports/ExportHistoryTable.tsx` - History table with format badge, file size, relative time, re-download tooltip
- `frontend/components/ops/exports/ExportHistorySkeleton.tsx` - 5-row skeleton matching table column widths
- `frontend/app/(ops)/admin/exports/page.tsx` - Admin exports history page with filters and query
- `frontend/components/ops/Sidebar.tsx` - Added Download import and Exports nav item under Admin
- 13 data pages - Each received ExportButton import and placement in filter bar / header

## Decisions Made
- Used `TooltipProvider delay={400}` instead of `Tooltip delay={400}` to match base-ui component API (the project uses base-ui primitives, not Radix directly)
- XLSX set as default format in ExportDialog per UI-SPEC specification
- MANAGE_SYSTEM permission used to guard the Exports sidebar nav item (consistent with Settings permission)
- KDS page ExportButton placed in the top bar alongside metrics and exit button since KDS is a fullscreen dark display with no traditional filter bar
- Tasks page ExportButton placed in the task detail header alongside status badges since it exports all tasks (not just the viewed one)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Tooltip delay prop API mismatch**
- **Found during:** Task 2 (ExportHistoryTable)
- **Issue:** `delay` prop was placed on `<Tooltip>` but in the base-ui wrapper it belongs on `<TooltipProvider>`
- **Fix:** Moved `delay={400}` from `<Tooltip>` to `<TooltipProvider delay={400}>`
- **Files modified:** frontend/components/ops/exports/ExportHistoryTable.tsx
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 6e069ad (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial API adaptation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components wire to real backend API endpoints (POST /exports/generate, GET /exports/history) via apiClient. ExportButton passes real filter state from each page.

## Next Phase Readiness
- Complete frontend export experience operational: users can trigger exports from any of 13 data pages
- Admin can view full export history at /admin/exports with filter and re-download
- Phase 18 data export is now fully complete (all 7 plans: infrastructure + 5 builder plans + frontend UI)

## Self-Check: PASSED

- All 7 created files verified present on disk
- All 15 modified files verified present on disk
- Commit 354f6dd (Task 1) verified in git log
- Commit 6e069ad (Task 2) verified in git log
- Commit 35e9212 (Task 3) verified in git log

---
*Phase: 18-data-export*
*Completed: 2026-03-23*
