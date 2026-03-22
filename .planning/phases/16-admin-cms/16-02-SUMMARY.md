---
phase: 16-admin-cms
plan: 02
subsystem: ui
tags: [tiptap, rich-text-editor, autosave, image-upload, r2, nextjs, react, tanstack-query]

# Dependency graph
requires:
  - phase: 14-guide-foundation
    provides: GuideSection/GuidePage Prisma models, REST API endpoints, MANAGE_GUIDE permission, presign-guide storage endpoint
  - phase: 15-guide-reader
    provides: CalloutExtension, GuideCalloutBlock, GuideProseRenderer, GuidePage types
  - phase: 16-admin-cms plan 01
    provides: Admin guide management page, section CRUD, page create/delete, GuideSectionForm
provides:
  - Tiptap rich text editor page at /admin/guide/pages/[id]
  - GuideEditorClient with autosave (5s debounce, SHA-256 hash check)
  - GuideEditorToolbar with headings, lists, image upload, callout insertion
  - GuideEditorBubbleMenu with bold, italic, underline, link toggle
  - GuideImageUploadHandler utility for R2 presigned URL image upload
  - GuideEditorPageShell with dynamic import (ssr: false)
  - Publish/unpublish workflow with visual status indicators
affects: [17-guide-extras]

# Tech tracking
tech-stack:
  added: [@tiptap/extension-typography]
  patterns: [tiptap-v3-bubble-menu-plugin, autosave-with-content-hash, image-placeholder-swap, dynamic-import-client-shell]

key-files:
  created:
    - frontend/components/ops/guide/admin/GuideImageUploadHandler.ts
    - frontend/components/ops/guide/admin/GuideEditorToolbar.tsx
    - frontend/components/ops/guide/admin/GuideEditorBubbleMenu.tsx
    - frontend/components/ops/guide/admin/GuideEditorClient.tsx
    - frontend/components/ops/guide/admin/GuideEditorPageShell.tsx
    - frontend/app/(ops)/admin/guide/pages/[id]/page.tsx
  modified:
    - frontend/package.json

key-decisions:
  - "BubbleMenuPlugin registered programmatically via editor.registerPlugin instead of JSX component (Tiptap v3 changed BubbleMenu to Extension, not React component)"
  - "GuideEditorClient fetches page data client-side via React Query instead of SSR to avoid auth cookie forwarding complexity"
  - "Content hash uses SHA-256 of editor.getHTML() (not getJSON) per Tiptap v3 pitfall — JSON serialization is non-deterministic"

patterns-established:
  - "Tiptap v3 BubbleMenu: Use BubbleMenuPlugin programmatically with a ref'd DOM element, not JSX component"
  - "Image upload placeholder swap: Insert SVG placeholder immediately, replace src with final R2 URL after upload completes"
  - "Autosave pattern: 5s debounced setTimeout with SHA-256 content hash to skip no-op saves"
  - "Client shell pattern: 'use client' wrapper with dynamic(ssr: false) to isolate heavy editor bundle from SSR"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03]

# Metrics
duration: 10min
completed: 2026-03-22
---

# Phase 16 Plan 02: Guide Page Editor Summary

**Tiptap rich text editor at /admin/guide/pages/[id] with fixed toolbar, floating BubbleMenu, R2 image upload (toolbar/drag-drop/paste), callout blocks, 5s autosave with SHA-256 hash, and publish/unpublish workflow**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-22T18:41:03Z
- **Completed:** 2026-03-22T18:51:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Full Tiptap rich text editor with headings (H2/H3/H4), bold, italic, underline, links, ordered/unordered lists, and callout blocks (tip/warning/info)
- Three-path image upload (toolbar button, drag-drop, clipboard paste) via R2 presigned URLs with inline placeholder swap
- Autosave every 5 seconds with SHA-256 content hash check, visual saving/saved/unsaved indicators
- Publish/unpublish workflow with draft banner, status badges, and unsaved changes warning (beforeunload + Link onNavigate)

## Task Commits

Each task was committed atomically:

1. **Task 1: Image upload handler utility and install Typography extension** - `513452a` (feat)
2. **Task 2: Tiptap editor toolbar, bubble menu, and full editor client with autosave and publish** - `c17911d` (feat)

## Files Created/Modified
- `frontend/components/ops/guide/admin/GuideImageUploadHandler.ts` - Validates image type/size, calls presign-guide, uploads to R2
- `frontend/components/ops/guide/admin/GuideEditorToolbar.tsx` - Fixed toolbar with block-type, list, media/callout button groups (React.memo)
- `frontend/components/ops/guide/admin/GuideEditorBubbleMenu.tsx` - Floating inline formatting toolbar (bold, italic, underline, link)
- `frontend/components/ops/guide/admin/GuideEditorClient.tsx` - Core Tiptap editor with autosave, publish, image upload, callouts
- `frontend/components/ops/guide/admin/GuideEditorPageShell.tsx` - Client shell with dynamic import (ssr: false)
- `frontend/app/(ops)/admin/guide/pages/[id]/page.tsx` - RSC page extracting ID param, renders editor shell
- `frontend/package.json` - Added @tiptap/extension-typography dependency

## Decisions Made
- BubbleMenuPlugin registered programmatically via editor.registerPlugin/unregisterPlugin because Tiptap v3 changed BubbleMenu from React component to Extension
- GuideEditorClient fetches page data client-side via React Query (useQuery) instead of server-side rendering to avoid auth cookie forwarding complexity
- Content hash uses SHA-256 of editor.getHTML() (not getJSON()) because Tiptap v3 JSON serialization is non-deterministic across transactions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BubbleMenu import changed from JSX component to BubbleMenuPlugin**
- **Found during:** Task 2 (Editor client implementation)
- **Issue:** Plan specified `<BubbleMenu editor={editor}>` JSX usage from `@tiptap/extension-bubble-menu`, but Tiptap v3.20.4 exports BubbleMenu as an Extension (not a React component), causing TS2604 error
- **Fix:** Used `BubbleMenuPlugin` function to create a ProseMirror plugin with a ref'd DOM element, registered/unregistered via useEffect lifecycle
- **Files modified:** frontend/components/ops/guide/admin/GuideEditorClient.tsx
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** c17911d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for Tiptap v3 API compatibility. No scope creep.

## Issues Encountered

None beyond the BubbleMenu API deviation documented above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all components are fully wired to backend API endpoints.

## Next Phase Readiness
- Guide CMS editor is complete, ready for Phase 17 (guide extras: search, preview-as-role, content seeding)
- All guide admin pages are accessible via /admin/guide (section management) and /admin/guide/pages/[id] (page editor)
- Callout blocks, image upload, autosave, and publish/unpublish workflows are fully functional

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (513452a, c17911d) found in git history.

---
*Phase: 16-admin-cms*
*Completed: 2026-03-22*
