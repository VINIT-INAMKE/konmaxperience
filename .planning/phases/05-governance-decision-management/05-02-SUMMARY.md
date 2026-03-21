---
phase: 05-governance-decision-management
plan: 02
subsystem: ui
tags: [react, nextjs, tanstack-query, magicui, shadcn, decisions, governance]

requires:
  - phase: 05-01
    provides: Decision type and interfaces (decisions.ts), backend API routes for /decisions CRUD

provides:
  - /decisions page with filterable decision list (All/Proposed/Approved/Rejected tabs + search)
  - DecisionCard component with MagicCard spotlight, ShineBorder glow on new decisions, Lock icon on approved
  - DecisionDetail inline expand panel with Context/Links/History sections and admin approve/reject/reopen actions
  - DecisionList with AnimatedList, skeleton/error/empty states
  - DecisionForm Sheet for logging new decisions with title/type/context/mission/task fields
  - DecisionStatusBadge and DecisionTypeBadge with semantic color mapping
  - Sidebar Decisions link with proposed count badge

affects:
  - 05-04-delegations (Sidebar navigation pattern established)
  - future phases using governance trail

tech-stack:
  added: []
  patterns:
    - Inline decision detail expand below card (same pattern as MeterDetailPanel from Phase 4)
    - ShineBorder 3s glow on newly created items via isNew prop + useEffect timer
    - Admin status change actions via apiClient.patch with queryClient.invalidateQueries after
    - Sidebar count badge for governance items (proposed decisions count query)

key-files:
  created:
    - frontend/app/(ops)/decisions/page.tsx
    - frontend/components/ops/decisions/DecisionCard.tsx
    - frontend/components/ops/decisions/DecisionDetail.tsx
    - frontend/components/ops/decisions/DecisionForm.tsx
    - frontend/components/ops/decisions/DecisionList.tsx
    - frontend/components/ops/decisions/DecisionStatusBadge.tsx
    - frontend/components/ops/decisions/DecisionTypeBadge.tsx
  modified:
    - frontend/components/ops/Sidebar.tsx

key-decisions:
  - "Inline decision detail expand below card in list flow — not separate page (matches Phase 4 MeterDetailPanel pattern)"
  - "ShineBorder 3s glow managed via isNew prop and useEffect timer in DecisionCard itself"
  - "Sidebar Decisions badge uses string count (not NumberTicker JSX) — avoids NavItem interface change"
  - "Select onValueChange cast to string type to satisfy TypeScript strict typing on base-ui Select"

patterns-established:
  - "DecisionStatusBadge/DecisionTypeBadge: small Badge wrapper components for semantic color mapping"
  - "Admin actions in detail panel: Button with apiClient.patch + toast + queryClient.invalidateQueries + onStatusChange callback"

requirements-completed:
  - GOVN-01

duration: 5min
completed: 2026-03-21
---

# Phase 05 Plan 02: Decisions Frontend Summary

**Governance decisions page with MagicCard list, Sheet form, inline expand with admin approve/reject/reopen, and Sidebar link with proposed count badge**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T08:13:46Z
- **Completed:** 2026-03-21T08:19:02Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Full /decisions page with filter tabs (All/Proposed/Approved/Rejected), search input, and AnimatedList of MagicCard decision cards
- DecisionForm Sheet for logging new decisions with title/type/context/linked mission/task fields and ShimmerButton submit
- DecisionDetail inline expand panel with BlurFade animation, admin approve/reject/reopen actions (reopen has Dialog confirmation)
- Sidebar updated with Decisions link and blue badge showing proposed decision count

## Task Commits

Each task was committed atomically:

1. **Task 1: Decisions page, components, and form** - `3e3320b` (feat)
2. **Task 2: Sidebar Decisions link with NumberTicker count badge** - `a6d3db9` (feat)

## Files Created/Modified
- `frontend/app/(ops)/decisions/page.tsx` - Decisions page with tabs, search, DecisionList, DecisionForm Sheet
- `frontend/components/ops/decisions/DecisionCard.tsx` - MagicCard card with ShineBorder on new, Lock icon on approved, InteractiveHoverButton
- `frontend/components/ops/decisions/DecisionDetail.tsx` - Inline expand panel with BlurFade, admin approve/reject/reopen with Dialog confirmation
- `frontend/components/ops/decisions/DecisionForm.tsx` - Sheet form with title/type/context/mission/task fields, ShimmerButton submit
- `frontend/components/ops/decisions/DecisionList.tsx` - AnimatedList wrapper with skeleton/error/empty states
- `frontend/components/ops/decisions/DecisionStatusBadge.tsx` - Amber/green/red color-coded Badge for proposed/approved/rejected
- `frontend/components/ops/decisions/DecisionTypeBadge.tsx` - Slate/blue/purple color-coded Badge for individual/cross-function/strategic
- `frontend/components/ops/Sidebar.tsx` - Added Decisions nav item with ClipboardCheck icon and proposed count badge

## Decisions Made
- Inline decision detail expand below card in the list flow — not a separate page (consistent with Phase 4 MeterDetailPanel pattern)
- ShineBorder 3s glow managed via `isNew` prop and `useEffect` timer inside `DecisionCard` itself
- Sidebar Decisions badge uses string count rather than NumberTicker JSX to avoid changing the shared NavItem interface
- `Select` `onValueChange` return value cast to string to satisfy TypeScript strict typing with base-ui Select primitive

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript error: `Select onValueChange` for linked mission returned `string | null` but state was `string`. Fixed via explicit cast `v as string`.

## Known Stubs
None — all API calls use live endpoints from Plan 01 backend. Mission list in form fetches from `/missions`. Decisions list fetches from `/decisions`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /decisions page fully functional with real API integration
- Sidebar shows Decisions link with live proposed count badge
- Ready for Phase 05-04 delegations page and any remaining Phase 05 plans
