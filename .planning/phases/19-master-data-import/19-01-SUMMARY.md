---
phase: 19-master-data-import
plan: 01
subsystem: api, ui
tags: [nestjs, exceljs, fast-csv, export, missions, quests, react]

# Dependency graph
requires:
  - phase: 18-data-export
    provides: ExportsModule builder registry, ExportButton component, export-types.ts
provides:
  - MissionsExportBuilder and QuestsExportBuilder classes
  - findAllForExport() on MissionsService and QuestsService
  - ExportButton on 5 additional frontend pages (18 total)
  - REPORT_TYPES expanded to 24 entries (missions, quests added)
affects: [19-master-data-import, 20-operations-import]

# Tech tracking
tech-stack:
  added: []
  patterns: [export builder for mission/quest entities follows existing ExportBuilder pattern]

key-files:
  created:
    - backend/src/exports/builders/missions-quests.builder.ts
  modified:
    - backend/src/missions/missions.service.ts
    - backend/src/quests/quests.service.ts
    - backend/src/exports/export-types.ts
    - backend/src/exports/exports.module.ts
    - frontend/lib/types/exports.ts
    - frontend/app/(ops)/missions/page.tsx
    - frontend/app/(ops)/boards/missions/page.tsx
    - frontend/app/(ops)/boards/quests/page.tsx
    - frontend/app/(ops)/decisions/page.tsx
    - frontend/app/(ops)/quests/[id]/page.tsx

key-decisions:
  - "MissionsExportBuilder and QuestsExportBuilder use MANAGE_KPIS permission matching tasks/decisions pattern"
  - "Quest detail page uses tasks reportType since it displays the quest's task list (per D-25)"
  - "IST timezone confirmed working via process.env.TZ = Asia/Kolkata in main.ts; XLSX date columns use numFmt styles"

patterns-established:
  - "findAllForExport() pattern extended to MissionsService and QuestsService (no take/skip, includes relations)"

requirements-completed: [EXPORT-12, EXPORT-13, TZ-01]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 19 Plan 01: Export Gaps Summary

**Missions and quests export builders with ExportButton on all 5 previously-missing frontend pages, REPORT_TYPES expanded to 24**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T16:29:59Z
- **Completed:** 2026-03-23T16:35:26Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created MissionsExportBuilder and QuestsExportBuilder with full XLSX/CSV support (bold headers, date formatting)
- Added findAllForExport() to both MissionsService and QuestsService (no pagination, includes relations)
- Added ExportButton to all 5 pages missing it: missions list, boards/missions, boards/quests, decisions, quest detail (tasks list)
- Expanded REPORT_TYPES from 22 to 24 entries on both backend and frontend

## Task Commits

Each task was committed atomically:

1. **Task 1: Missions and Quests export builders + findAllForExport + IST date formatting** - `233ce46` (feat)
2. **Task 2: ExportButton on 5 frontend pages + frontend type updates** - `6d89f15` (feat)

## Files Created/Modified
- `backend/src/exports/builders/missions-quests.builder.ts` - MissionsExportBuilder and QuestsExportBuilder classes
- `backend/src/missions/missions.service.ts` - Added findAllForExport() method
- `backend/src/quests/quests.service.ts` - Added findAllForExport() method
- `backend/src/exports/export-types.ts` - Added missions/quests to REPORT_TYPES and EXPORT_TYPE_CONFIG
- `backend/src/exports/exports.module.ts` - Registered builders with MissionsModule/QuestsModule imports
- `frontend/lib/types/exports.ts` - Added missions/quests to ReportType union and config
- `frontend/app/(ops)/missions/page.tsx` - Added ExportButton (reportType=missions)
- `frontend/app/(ops)/boards/missions/page.tsx` - Added ExportButton (reportType=missions)
- `frontend/app/(ops)/boards/quests/page.tsx` - Added ExportButton (reportType=quests)
- `frontend/app/(ops)/decisions/page.tsx` - Added ExportButton (reportType=decision_log)
- `frontend/app/(ops)/quests/[id]/page.tsx` - Added ExportButton (reportType=tasks)

## Decisions Made
- Used MANAGE_KPIS permission for missions and quests exports, consistent with tasks/decisions/leaderboard pattern
- Quest detail page at /quests/[id] uses reportType="tasks" since it's the tasks list view per D-25
- IST timezone confirmed working via process.env.TZ already set in main.ts; XLSX date columns use numFmt styles for formatting

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
None - all export builders are fully wired to service data sources.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All export report types are now covered (24 total)
- ExportButton present on all pages with exportable data (18 pages)
- Ready for Phase 19 Plan 02 (import infrastructure)

## Self-Check: PASSED

All 11 files verified present. Both task commits (233ce46, 6d89f15) confirmed in git log.

---
*Phase: 19-master-data-import*
*Completed: 2026-03-23*
