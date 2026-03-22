---
phase: 15-reader-view
plan: 02
subsystem: ui
tags: [tiptap, dompurify, prose-renderer, callout-blocks, sidebar-sheet, guide-reader, tanstack-query]

# Dependency graph
requires:
  - phase: 15-reader-view
    provides: Guide TypeScript interfaces, DynamicIcon, section index and detail pages, Tiptap dependencies
  - phase: 14-foundation
    provides: Backend GET /guide/sections and GET /guide/pages/:id APIs with role filtering
provides:
  - GuideProseRenderer with read-only Tiptap editor and DOMPurify sanitization
  - GuideCalloutBlock Tiptap extension for tip/warning/info callout rendering
  - GuidePageHeader with breadcrumb, title, summary, read time, and updated date
  - GuidePageSkeleton loading placeholder
  - GuideSidebarSheet overlay with section tree navigation and active page highlighting
  - Page reading view route at /guide/[sectionSlug]/[pageSlug]
affects: [16-editor, guide-admin, guide-search]

# Tech tracking
tech-stack:
  added: ["@tiptap/html"]
  patterns: [dynamic import with ssr:false for Tiptap editor components, two-query pattern for section cache + page-by-ID fetch, CalloutExtension as custom Tiptap Node with ReactNodeViewRenderer]

key-files:
  created:
    - frontend/components/ops/guide/GuideProseRenderer.tsx
    - frontend/components/ops/guide/GuideCalloutBlock.tsx
    - frontend/components/ops/guide/GuidePageHeader.tsx
    - frontend/components/ops/guide/GuidePageSkeleton.tsx
    - frontend/components/ops/guide/GuideSidebarSheet.tsx
    - frontend/app/(ops)/guide/[sectionSlug]/[pageSlug]/page.tsx
  modified:
    - frontend/app/(ops)/guide/[sectionSlug]/page.tsx
    - frontend/package.json
    - frontend/package-lock.json

key-decisions:
  - "GuideProseRenderer dynamically imported with ssr:false to prevent Tiptap SSR crash"
  - "Two-query data fetching: shared sections cache + page-by-ID to avoid slug-based endpoint pitfall"
  - "DOMPurify sanitizes generateHTML output before passing to Tiptap editor as defense-in-depth"

patterns-established:
  - "Dynamic import pattern: next/dynamic with ssr:false for any Tiptap editor component"
  - "CalloutExtension: custom Tiptap Node.create() with ReactNodeViewRenderer for styled callout blocks"
  - "GuideSidebarSheet: Sheet side=left with section tree, collapsible sections, active page aria-current"

requirements-completed: [READ-02, READ-05]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 15 Plan 02: Guide Page Reading View & Sidebar Navigation Summary

**Read-only Tiptap prose renderer with DOMPurify sanitization, callout block extension, page header with breadcrumb metadata, and Sheet-based sidebar navigation overlay for cross-page browsing**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T17:44:00Z
- **Completed:** 2026-03-22T17:52:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 9

## Accomplishments
- Built read-only Tiptap prose renderer with DOMPurify sanitization and generateHTML from @tiptap/html
- Created custom CalloutExtension Tiptap node with three styled variants (tip, warning, info) using ReactNodeViewRenderer
- Built page reading view at /guide/[sectionSlug]/[pageSlug] with Next.js 16 use(params), dynamic Tiptap import, and two-query data fetching
- Created GuideSidebarSheet overlay with collapsible section tree, active page highlighting (aria-current="page"), and cross-page navigation
- Added sidebar trigger and GuideSidebarSheet to section detail page for consistent navigation experience

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GuideProseRenderer, GuideCalloutBlock, GuidePageHeader, GuidePageSkeleton** - `7c5b7bd` (feat)
2. **Task 2: Create GuideSidebarSheet and page reading view route** - `0fe7171` (feat)
3. **Task 3: Verify complete guide reader experience end-to-end** - checkpoint (human-verify, approved)

## Files Created/Modified
- `frontend/components/ops/guide/GuideProseRenderer.tsx` - Read-only Tiptap editor with DOMPurify sanitization and generateHTML
- `frontend/components/ops/guide/GuideCalloutBlock.tsx` - Custom Tiptap Node extension for tip/warning/info callout blocks
- `frontend/components/ops/guide/GuidePageHeader.tsx` - Breadcrumb nav, title, summary, read time, updated date with Separator
- `frontend/components/ops/guide/GuidePageSkeleton.tsx` - Loading skeleton with heading, subtitle, metadata, and 8 text line placeholders
- `frontend/components/ops/guide/GuideSidebarSheet.tsx` - Sheet side=left overlay with collapsible section tree and active page highlighting
- `frontend/app/(ops)/guide/[sectionSlug]/[pageSlug]/page.tsx` - Page reading view with dynamic Tiptap import, two useQuery calls, sidebar trigger
- `frontend/app/(ops)/guide/[sectionSlug]/page.tsx` - Modified: added GuideSidebarSheet and BookOpen sidebar trigger
- `frontend/package.json` - Added @tiptap/html dependency
- `frontend/package-lock.json` - Lock file updated

## Decisions Made
- GuideProseRenderer loaded via next/dynamic with ssr:false to prevent Tiptap SSR hydration crash (Pitfall 1 from RESEARCH.md)
- Two-query data fetching pattern: sections from shared cache to resolve slug-to-UUID, then page fetch by ID (avoids slug-based endpoint pitfall)
- DOMPurify.sanitize() applied to generateHTML output before passing to editor content, providing defense-in-depth per D-07

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components wire to real API endpoints via TanStack Query and apiClient.

## Next Phase Readiness
- Complete guide reader experience ready: section index (/guide), section detail (/guide/[slug]), page reading view (/guide/[slug]/[page-slug])
- Tiptap editor infrastructure (extensions, CalloutExtension) ready for reuse in Phase 16 Admin CMS editor
- GuideSidebarSheet reusable from both section detail and page reading views
- Phase 15 complete -- Phase 16 (Admin CMS) can proceed

## Self-Check: PASSED

All 6 created files verified present. Both commit hashes (7c5b7bd, 0fe7171) verified in git log.

---
*Phase: 15-reader-view*
*Completed: 2026-03-22*
