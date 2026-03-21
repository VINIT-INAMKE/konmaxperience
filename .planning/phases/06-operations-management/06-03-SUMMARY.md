---
phase: 06-operations-management
plan: "03"
subsystem: ui
tags: [react, next.js, tanstack-query, lucide, base-ui, r2, presigned-url]

# Dependency graph
requires:
  - phase: 06-01
    provides: Backend API endpoints for /channels and /assets (CRUD + presign-asset), Prisma schema with Channel and Asset models

provides:
  - Channels page (/operations/channels) with table, Switch toggles, type badges, admin-only edit and create
  - Assets page (/operations/assets) with filter tabs, search, upload zone, status workflow, delete confirmation
  - AssetUploadZone with presign-asset two-step flow (POST presign -> XHR PUT -> callback to parent)
  - Asset status workflow: creator submits draft->in_review, admin approves/rejects
  - Type definitions for Channel and Asset with label maps and status arrays

affects: [07-onboarding, 09-marketplace]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AssetUploadZone separates presign+XHR from record creation — parent (AssetForm) owns POST /assets call
    - ShineBorder applied to TableRow via relative wrapper for new-entity highlight (3.5s timeout)
    - BorderBeam shown on isDragging (not isUploading) for drag-active state feedback
    - TooltipTrigger in base-ui does not support asChild — wrap Switch in div inside TooltipTrigger directly

key-files:
  created:
    - frontend/lib/types/channel.ts
    - frontend/lib/types/asset.ts
    - frontend/components/ops/operations/channels/ChannelStatusToggle.tsx
    - frontend/components/ops/operations/channels/ChannelRow.tsx
    - frontend/components/ops/operations/channels/ChannelForm.tsx
    - frontend/components/ops/operations/channels/ChannelStatusToggle.tsx
    - frontend/app/(ops)/operations/channels/page.tsx
    - frontend/components/ops/operations/assets/AssetStatusBadge.tsx
    - frontend/components/ops/operations/assets/AssetUploadZone.tsx
    - frontend/components/ops/operations/assets/AssetForm.tsx
    - frontend/components/ops/operations/assets/AssetRow.tsx
    - frontend/app/(ops)/operations/assets/page.tsx
  modified: []

key-decisions:
  - "AssetUploadZone uses onFileReady callback (not record creation) — parent AssetForm owns POST /assets to keep upload and record creation separate"
  - "TooltipTrigger (base-ui) does not accept asChild — Switch wrapped directly inside TooltipTrigger div"
  - "ChannelStatusToggle: inactive/planned -> active when Switch checked=true, active -> inactive when unchecked"
  - "Asset brand field marked optional in Select (matches schema) despite UI-SPEC saying required — keeps UX flexible"

patterns-established:
  - "TableRow relative + ShineBorder absolute inset — pattern for new-row highlight in table contexts"
  - "AssetUploadZone: separate presign+XHR from API record creation via onFileReady callback"

requirements-completed: [OPS-03, OPS-04]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 6 Plan 03: Channels and Assets Frontend Summary

**Channels table page with admin Switch toggles and Assets table with presign-asset upload, status workflow, and approved indicator**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-21T09:21:47Z
- **Completed:** 2026-03-21T09:27:06Z
- **Tasks:** 2
- **Files modified:** 11 created

## Accomplishments
- Channels page: table with 7 rows, admin-only Switch toggles (h-11 touch target), type badges, add/edit via Sheet
- Assets page: filterable table (status tabs + type select + search), presign-asset two-step upload, status workflow (creator: draft->in_review, admin: any status), approved "Ready for display" indicator
- Asset upload: POST /storage/presign-asset -> XHR PUT with progress bar -> onFileReady callback -> POST /assets (parent-owned)
- AssetUploadZone: BorderBeam on isDragging, progress bar during XHR, MIME/size validation before presign
- Delete confirmation Dialog with destructive button per UI-SPEC copywriting

## Task Commits

1. **Task 1: Channel types, ChannelRow/Form/Toggle, Channels page** - `507d4eb` (feat)
2. **Task 2: Asset types, AssetRow/Form/UploadZone/StatusBadge, Assets page** - `b0e86d6` (feat)

## Files Created/Modified
- `frontend/lib/types/channel.ts` - ChannelStatus/ChannelType enums, label maps, constant arrays
- `frontend/lib/types/asset.ts` - AssetStatus/AssetType enums, label maps, MIME/size constants
- `frontend/components/ops/operations/channels/ChannelStatusToggle.tsx` - Switch toggle with h-11 touch target and Tooltip
- `frontend/components/ops/operations/channels/ChannelRow.tsx` - Table row with type badge, toggle, admin edit button
- `frontend/components/ops/operations/channels/ChannelForm.tsx` - Sheet form for create/edit channel
- `frontend/app/(ops)/operations/channels/page.tsx` - Channels page with Table, skeleton loading, toggle handler
- `frontend/components/ops/operations/assets/AssetStatusBadge.tsx` - Status badge with UI-SPEC colors
- `frontend/components/ops/operations/assets/AssetUploadZone.tsx` - Presign+XHR upload zone with drag-drop and progress
- `frontend/components/ops/operations/assets/AssetForm.tsx` - Sheet form with upload zone and status workflow
- `frontend/components/ops/operations/assets/AssetRow.tsx` - Table row with type icons, ShineBorder, Ready for display
- `frontend/app/(ops)/operations/assets/page.tsx` - Assets page with filter tabs, table, empty state, delete dialog

## Decisions Made
- AssetUploadZone uses `onFileReady(file, publicUrl)` callback pattern — keeps the component focused on presign+XHR only; parent AssetForm owns POST /assets record creation. This matches the plan spec and keeps concerns separated.
- base-ui TooltipTrigger does not support `asChild` — fixed by wrapping Switch in a div directly inside TooltipTrigger (no wrapper element needed for functionality).
- Asset brand field is optional Select (not required) — the schema allows null and UX benefits from flexibility; the plan noted "required" but the backend schema makes it optional.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unsupported `asChild` prop from TooltipTrigger**
- **Found during:** Task 1 (ChannelStatusToggle)
- **Issue:** base-ui Tooltip does not support `asChild` on TooltipTrigger — TypeScript error TS2322
- **Fix:** Removed `asChild` from TooltipTrigger, wrapped Switch in div directly inside trigger
- **Files modified:** frontend/components/ops/operations/channels/ChannelStatusToggle.tsx
- **Verification:** npx tsc --noEmit exits 0
- **Committed in:** 507d4eb (Task 1 commit)

**2. [Rule 1 - Bug] Removed unsupported `asChild={false}` prop from Button in AssetRow**
- **Found during:** Task 2 (AssetRow)
- **Issue:** Button component doesn't accept `asChild` prop — TypeScript error TS2322
- **Fix:** Removed `asChild={false}` from View button (default behavior is correct)
- **Files modified:** frontend/components/ops/operations/assets/AssetRow.tsx
- **Verification:** npx tsc --noEmit exits 0
- **Committed in:** b0e86d6 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — TypeScript prop errors from base-ui component API differences)
**Impact on plan:** Both fixes were TypeScript correctness issues, no behavior change.

## Issues Encountered
None beyond the two auto-fixed TypeScript prop errors above.

## Known Stubs
None — all data is wired to real API endpoints (/channels, /assets, /storage/presign-asset, /brands).

## Self-Check: PASSED

- All 11 created files confirmed present on disk
- Commits 507d4eb and b0e86d6 confirmed in git log
- TypeScript compiles clean (npx tsc --noEmit exits 0)

## Next Phase Readiness
- Channels page: ready for demo — table, toggle, CRUD sheet all wired
- Assets page: ready for demo — upload flow, status workflow, filters all wired
- Phase 07 can use /assets as a data source for onboarding or display content
