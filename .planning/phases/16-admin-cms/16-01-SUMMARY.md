---
phase: 16-admin-cms
plan: 01
subsystem: ui
tags: [react, nextjs, tanstack-query, shadcn, lucide, guide-cms, admin]

# Dependency graph
requires:
  - phase: 14-guide-foundation
    provides: GuideSection/GuidePage Prisma models, REST API endpoints, MANAGE_GUIDE permission
  - phase: 15-guide-reader
    provides: DynamicIcon component, GuideSectionPage/GuideSection types, BorderBeam hover pattern
provides:
  - Admin guide management page at /admin/guide with section CRUD
  - GuideSectionList with expand/collapse and reorder functionality
  - GuideSectionCard with status badges, role badges, page sub-lists
  - GuideSectionForm Sheet with icon picker, color picker, role checkboxes
  - GuideIconPicker (20 Lucide icons in 5x4 grid)
  - GuideColorPicker (12 predefined color swatches)
  - GuideAdminSkeleton loading state
  - Sidebar nav entry for Guide Management gated by MANAGE_GUIDE
affects: [16-admin-cms plan 02 (editor page), 17-guide-extras]

# Tech tracking
tech-stack:
  added: []
  patterns: [admin-section-list-with-expand-collapse, icon-picker-grid, color-swatch-picker, sort-order-swap-reorder]

key-files:
  created:
    - frontend/app/(ops)/admin/guide/page.tsx
    - frontend/components/ops/guide/admin/GuideSectionList.tsx
    - frontend/components/ops/guide/admin/GuideSectionCard.tsx
    - frontend/components/ops/guide/admin/GuideSectionForm.tsx
    - frontend/components/ops/guide/admin/GuideIconPicker.tsx
    - frontend/components/ops/guide/admin/GuideColorPicker.tsx
    - frontend/components/ops/guide/admin/GuideAdminSkeleton.tsx
  modified:
    - frontend/components/ops/Sidebar.tsx

key-decisions:
  - "Sort-order reorder via PATCH swap (Promise.all of two PATCH calls to swap adjacent sort_order values)"
  - "GuideSectionForm placeholder created in Task 1 and replaced in Task 2 to satisfy TypeScript during incremental commits"

patterns-established:
  - "Icon picker grid: predefined Lucide icon names rendered via DynamicIcon in a grid, selected state with bg-primary/10 border-primary"
  - "Color swatch picker: hex color circles with ring-2 ring-ring selected state"
  - "Admin section list: expandable cards with hover-reveal action buttons and BorderBeam accent"

requirements-completed: [EDIT-01]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 16 Plan 01: Admin Guide Section Management Summary

**Admin guide management page at /admin/guide with collapsible section list, section CRUD via Sheet form, icon/color/role pickers, page sub-lists with create/delete, and sort-order reorder arrows**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T18:31:23Z
- **Completed:** 2026-03-22T18:37:10Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Admin guide management page with full section CRUD (create, edit, delete with cascade warning) and page management (create, edit, delete)
- Section form Sheet with icon picker (20 Lucide icons), color picker (12 hex swatches), and role multi-select checkboxes
- Collapsible section list with per-section page sub-lists, reorder arrows (up/down) for both sections and pages
- Sidebar nav entry for "Guide Management" gated by MANAGE_GUIDE permission

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin guide management page with section list, expand/collapse, and page sub-lists** - `72616f9` (feat)
2. **Task 2: Section form Sheet with icon picker, color picker, and role checkboxes** - `09ec8c4` (feat)

## Files Created/Modified
- `frontend/components/ops/Sidebar.tsx` - Added Guide Management nav item under Admin section gated by MANAGE_GUIDE
- `frontend/app/(ops)/admin/guide/page.tsx` - Admin guide management page with section list, empty/loading/error states, delete dialogs
- `frontend/components/ops/guide/admin/GuideSectionList.tsx` - Collapsible section list with sort_order swap reorder logic
- `frontend/components/ops/guide/admin/GuideSectionCard.tsx` - Section card with icon, title, role badges, status, page count, expand toggle, action buttons, BorderBeam hover
- `frontend/components/ops/guide/admin/GuideSectionForm.tsx` - Sheet-based create/edit form with title, description, icon picker, color picker, role checkboxes
- `frontend/components/ops/guide/admin/GuideIconPicker.tsx` - 5x4 grid of 20 predefined Lucide icons using DynamicIcon
- `frontend/components/ops/guide/admin/GuideColorPicker.tsx` - 12 predefined hex color swatches with selected ring state
- `frontend/components/ops/guide/admin/GuideAdminSkeleton.tsx` - Loading skeleton with 4 animated pulse cards

## Decisions Made
- Sort-order reorder implemented via Promise.all of two PATCH calls swapping adjacent sort_order values (no drag-and-drop library needed)
- GuideSectionForm created as placeholder in Task 1 and fully implemented in Task 2 to maintain TypeScript compilation across incremental commits

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all components are fully wired to backend API endpoints.

## Next Phase Readiness
- Section and page management is complete, ready for Plan 02 (Tiptap editor page at /admin/guide/pages/[id])
- Page create handler navigates to /admin/guide/pages/[id] which will be built in Plan 02
- All guide-sections-admin query cache invalidation patterns established for reuse

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (72616f9, 09ec8c4) found in git history.

---
*Phase: 16-admin-cms*
*Completed: 2026-03-22*
