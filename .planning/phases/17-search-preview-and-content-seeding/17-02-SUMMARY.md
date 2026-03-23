---
phase: 17-search-preview-and-content-seeding
plan: 02
subsystem: ui
tags: [cmdk, command-palette, search-overlay, preview-as-role, shadcn, react-query, next.js]

# Dependency graph
requires:
  - phase: 17-search-preview-and-content-seeding
    provides: GET /guide/search?q= endpoint, cmdk component, mark CSS styling
  - phase: 15-guide-reader-view
    provides: GuideSidebarSheet, GuideSectionCard, guide page routing
provides:
  - GuideSearchOverlay with Cmd+K/Ctrl+K keyboard shortcut and 300ms debounce
  - GuideSearchResultItem with title, highlighted snippet, and section badge
  - Guide layout mounting search overlay for all /guide/* routes
  - GuidePreviewBanner with amber strip and role reset action
  - Admin-only role selector dropdown filtering sections client-side
  - Search trigger button in guide index page header and sidebar
affects: [guide-reader-view, guide-editor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CommandDialog search overlay with debounced React Query and Cmd+K keyboard shortcut
    - Admin preview-as-role client-side filtering with amber banner feedback

key-files:
  created:
    - frontend/components/ops/guide/GuideSearchOverlay.tsx
    - frontend/components/ops/guide/GuideSearchResultItem.tsx
    - frontend/components/ops/guide/GuidePreviewBanner.tsx
    - frontend/app/(ops)/guide/layout.tsx
  modified:
    - frontend/app/(ops)/guide/page.tsx
    - frontend/components/ops/guide/GuideSidebarSheet.tsx
    - frontend/lib/types/guides.ts

key-decisions:
  - "GuideSearchResult type added to shared guides.ts for frontend consumption of backend search API"
  - "Admin detection via roleCode check (FOUNDER_ADMIN or TECH_LEAD) matching existing RBAC pattern"
  - "Client-side section filtering for preview-as-role (no backend role-spoofing needed)"
  - "Search trigger dispatches synthetic Cmd+K keydown event to reuse overlay listener"

patterns-established:
  - "CommandDialog search pattern: debounced query + useQuery with enabled guard + skeleton loading states"
  - "Preview-as-role pattern: local state previewRole + client-side array filter + amber banner feedback"

requirements-completed: [READ-03, READ-04]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 17 Plan 02: Search Overlay and Preview-as-Role Summary

**Cmd+K search overlay with debounced full-text query, highlighted snippets, section badges, and admin preview-as-role dropdown with amber banner filtering guide sections client-side**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T05:41:59Z
- **Completed:** 2026-03-23T05:46:31Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- GuideSearchOverlay with CommandDialog, Cmd+K/Ctrl+K listener, 300ms debounce, skeleton loading, and footer navigation hints
- GuideSearchResultItem rendering page title, DOMPurify-sanitized snippet with mark highlights, and section badge
- Guide layout mounting search overlay globally for all /guide/* routes
- Admin-only role selector with all 8 roles and amber preview banner with reset action
- Search trigger button in both guide index page header and sidebar sheet

## Task Commits

Each task was committed atomically:

1. **Task 1: Search overlay, result item, and guide layout** - `235d189` (feat)
2. **Task 2: Preview-as-role dropdown, banner, and search trigger on guide index** - `3e1a2d3` (feat)

## Files Created/Modified
- `frontend/components/ops/guide/GuideSearchOverlay.tsx` - CommandDialog wrapper with Cmd+K listener, debounced search, result rendering
- `frontend/components/ops/guide/GuideSearchResultItem.tsx` - Single search result row with FileText icon, title, snippet, section badge
- `frontend/components/ops/guide/GuidePreviewBanner.tsx` - Amber preview banner with Eye icon, role display name, and reset action
- `frontend/app/(ops)/guide/layout.tsx` - Guide layout mounting GuideSearchOverlay for all /guide/* routes
- `frontend/app/(ops)/guide/page.tsx` - Added search trigger button, admin role selector dropdown, preview banner, displaySections filtering
- `frontend/components/ops/guide/GuideSidebarSheet.tsx` - Added onSearchOpen prop and search trigger button above section tree
- `frontend/lib/types/guides.ts` - Added GuideSearchResult interface for search API response

## Decisions Made
- Admin detection uses roleCode check (FOUNDER_ADMIN or TECH_LEAD) matching existing RBAC pattern in the codebase
- Client-side section filtering for preview-as-role avoids backend role-spoofing and extra API calls
- Search trigger button dispatches synthetic Cmd+K keydown event to reuse the overlay's existing keyboard listener
- GuideSearchResult type placed in shared guides.ts alongside existing GuideSection and GuidePage types

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all files compiled cleanly on first pass.

## Known Stubs

None - all functionality is fully wired to the search API endpoint from Plan 01.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Search overlay and preview-as-role are fully functional frontend components consuming Plan 01 backend
- Content from Plan 03 (39 pages across 12 sections) is searchable via the tsvector infrastructure
- Guide CMS editor from Phase 16 continues to work alongside new search and preview features

## Self-Check: PASSED

All 7 files verified present. Both commit hashes (235d189, 3e1a2d3) confirmed in git log.

---
*Phase: 17-search-preview-and-content-seeding*
*Completed: 2026-03-23*
