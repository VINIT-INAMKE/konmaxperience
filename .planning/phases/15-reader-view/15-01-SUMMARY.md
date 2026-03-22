---
phase: 15-reader-view
plan: 01
subsystem: ui
tags: [tiptap, typography, guide, lucide-react, magic-card, border-beam, tanstack-query]

# Dependency graph
requires:
  - phase: 14-foundation
    provides: Guide backend API (GET /guide/sections with role-based filtering)
provides:
  - Guide TypeScript interfaces (GuideSection, GuideSectionPage, GuidePage)
  - Shared DynamicIcon component for Lucide icon name resolution
  - GuideSectionCard component with MagicUI effects
  - Section index page at /guide with role-filtered section grid
  - Section detail page at /guide/[sectionSlug] with page list
  - Guide nav item in ops sidebar for all authenticated users
  - Tiptap and typography dependencies installed
affects: [15-reader-view, 16-editor, guide-admin]

# Tech tracking
tech-stack:
  added: ["@tiptap/react", "@tiptap/pm", "@tiptap/starter-kit", "@tiptap/extension-image", "isomorphic-dompurify", "@tailwindcss/typography"]
  patterns: [DynamicIcon for runtime Lucide icon resolution from string names, shared TanStack Query cache key for section data reuse]

key-files:
  created:
    - frontend/lib/types/guides.ts
    - frontend/components/ops/guide/DynamicIcon.tsx
    - frontend/components/ops/guide/GuideSectionCard.tsx
    - frontend/components/ops/guide/GuideSectionIndexSkeleton.tsx
    - frontend/app/(ops)/guide/page.tsx
    - frontend/app/(ops)/guide/loading.tsx
    - frontend/app/(ops)/guide/[sectionSlug]/page.tsx
  modified:
    - frontend/package.json
    - frontend/app/globals.css
    - frontend/components/ops/Sidebar.tsx

key-decisions:
  - "DynamicIcon extracts to shared component for reuse across guide section card and section detail page"
  - "Section detail page reuses same queryKey as index for TanStack Query cache sharing"

patterns-established:
  - "DynamicIcon: renders Lucide icon by string name with BookOpen fallback"
  - "Guide route structure: /guide (index), /guide/[sectionSlug] (section), /guide/[sectionSlug]/[pageSlug] (page)"

requirements-completed: [READ-01]

# Metrics
duration: 7min
completed: 2026-03-22
---

# Phase 15 Plan 01: Guide Section Index & Detail Pages Summary

**Tiptap + typography setup, guide type definitions, section index with MagicUI cards, and section detail page with page list navigation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T17:10:56Z
- **Completed:** 2026-03-22T17:18:21Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Installed Tiptap v3, isomorphic-dompurify, and @tailwindcss/typography with jsdom override
- Built polished section index page at /guide with MagicCard + BorderBeam effects, role-filtered via backend API
- Created section detail page at /guide/[sectionSlug] showing sorted page list with read time estimates
- Added Guide nav item in sidebar visible to all authenticated users
- Defined TypeScript interfaces matching backend API response shapes exactly

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, register typography plugin, create guide types, add sidebar nav item** - `23ae212` (feat)
2. **Task 2: Build section index page with GuideSectionCard component and loading skeleton** - `81efa72` (feat)
3. **Task 3: Build section detail page with page list and shared DynamicIcon** - `5f6b7b2` (feat)

## Files Created/Modified
- `frontend/lib/types/guides.ts` - TypeScript interfaces for GuideSection, GuideSectionPage, GuidePage
- `frontend/components/ops/guide/DynamicIcon.tsx` - Shared component resolving Lucide icon by string name
- `frontend/components/ops/guide/GuideSectionCard.tsx` - Section card with MagicCard, BorderBeam, accent color, page count
- `frontend/components/ops/guide/GuideSectionIndexSkeleton.tsx` - 3-column grid of 6 skeleton cards for loading state
- `frontend/app/(ops)/guide/page.tsx` - Section index page with role-filtered grid, empty and error states
- `frontend/app/(ops)/guide/loading.tsx` - Next.js loading boundary with skeleton placeholders
- `frontend/app/(ops)/guide/[sectionSlug]/page.tsx` - Section detail with sorted page list, back navigation, not-found state
- `frontend/package.json` - Added Tiptap packages, isomorphic-dompurify, typography plugin, jsdom override
- `frontend/app/globals.css` - Registered @tailwindcss/typography plugin
- `frontend/components/ops/Sidebar.tsx` - Added BookOpen import and Guide nav item to overviewNav

## Decisions Made
- Extracted DynamicIcon to shared component rather than duplicating in each file
- Reused same TanStack Query cache key ['guide', 'sections'] in both index and detail pages for instant navigation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components wire to real API endpoints.

## Next Phase Readiness
- Guide section index and detail pages ready for page reading view (Plan 02)
- Tiptap dependencies installed and ready for prose rendering
- DynamicIcon shared component available for reuse in sidebar sheet and page views

## Self-Check: PASSED

All 8 files verified present. All 3 commit hashes verified in git log.

---
*Phase: 15-reader-view*
*Completed: 2026-03-22*
