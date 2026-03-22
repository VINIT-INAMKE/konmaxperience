---
phase: 09-kitchen-prep
plan: 05
subsystem: ui
tags: [kds, kitchen-display, waste-log, react-query, polling, timer, border-beam, number-ticker]

requires:
  - phase: 09-02
    provides: Backend KDS and Waste Log API endpoints
  - phase: 09-03
    provides: KDS order polling, item status PATCH, waste POST endpoints
provides:
  - Full-screen KDS page with zone columns, 5s polling, elapsed timers, and status tapping
  - Waste Log page with history table and waste logging form
  - KDS metrics bar with orders, completed items, and waste percentage
affects: [10-pos-orders]

tech-stack:
  added: []
  patterns: [full-screen-overlay-kds, per-second-timer, new-order-detection-via-seen-ids, border-beam-flash, fade-out-complete-orders]

key-files:
  created:
    - frontend/app/(ops)/operations/kitchen/kds/page.tsx
    - frontend/components/ops/kitchen/kds/KdsBoard.tsx
    - frontend/components/ops/kitchen/kds/KdsZoneColumn.tsx
    - frontend/components/ops/kitchen/kds/KdsOrderCard.tsx
    - frontend/components/ops/kitchen/kds/KdsOrderItem.tsx
    - frontend/components/ops/kitchen/kds/KdsElapsedTimer.tsx
    - frontend/components/ops/kitchen/kds/KdsItemStatusBadge.tsx
    - frontend/components/ops/kitchen/kds/KdsExitButton.tsx
    - frontend/components/ops/kitchen/kds/KdsMetricsBar.tsx
    - frontend/app/(ops)/operations/kitchen/waste/page.tsx
    - frontend/components/ops/kitchen/waste/WasteLogForm.tsx
    - frontend/components/ops/kitchen/waste/WasteLogRow.tsx
    - frontend/components/ops/kitchen/waste/WasteReasonBadge.tsx
  modified: []

key-decisions:
  - "KDS uses CSS fixed overlay (z-50) to cover sidebar, not separate layout segment"
  - "New order detection seeds seenOrderIds on first load to prevent all orders flashing as new"
  - "KDS metrics bar polls at 10s (separate from 5s order polling) to reduce API load"
  - "Waste Log form auto-sets unit from selected item (ingredient base_unit or batch unit)"

patterns-established:
  - "Full-screen overlay pattern: fixed inset-0 z-50 for KDS hides sidebar without layout changes"
  - "Per-second timer pattern: setInterval(tick, 1000) with cleanup in useEffect"
  - "New order detection: useRef(Set) tracks seen IDs, computes new on each poll"
  - "BorderBeam 3s flash: useState + useEffect setTimeout removes animation after 3s"
  - "Complete order fade-out: 30s setTimeout then opacity-0 transition-opacity duration-1000"

requirements-completed: [KITCHEN-02, KITCHEN-04, KITCHEN-05]

duration: 7min
completed: 2026-03-21
---

# Phase 9 Plan 05: KDS & Waste Log Summary

**Full-screen KDS with zone columns, 5s polling, per-second elapsed timers, status tapping with BorderBeam/fade-out animations, and Waste Log page with history table and logging form**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T13:56:41Z
- **Completed:** 2026-03-21T14:04:10Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Full-screen KDS at /operations/kitchen/kds with dark overlay covering sidebar, zone columns grid with 5s React Query polling
- Per-second elapsed timer with green (<10m), amber (10-20m), red (>20m) color thresholds
- Tap-to-advance item status (pending->preparing->ready) with Sonner toast feedback
- New order detection via seenOrderIds ref with 3s BorderBeam flash, completed orders fade-out after 30s
- KDS metrics bar showing orders in queue, completed today (NumberTicker), and waste percentage with color coding
- Waste Log page at /operations/kitchen/waste with two-column grid: history table (AnimatedList) and WasteLogForm
- WasteLogForm with dynamic item select based on waste type, auto-calculated cost_impact display

## Task Commits

Each task was committed atomically:

1. **Task 1: KDS full-screen page with zone columns, polling, timers, and status tapping** - `8f95c1c` (feat)
2. **Task 2: Waste Log page with history table and logging form** - already committed by parallel agent ca880fd (09-04); our implementations match

## Files Created/Modified
- `frontend/app/(ops)/operations/kitchen/kds/page.tsx` - Full-screen KDS page with fixed overlay
- `frontend/components/ops/kitchen/kds/KdsBoard.tsx` - Zone columns grid with 5s polling and new order detection
- `frontend/components/ops/kitchen/kds/KdsZoneColumn.tsx` - Individual zone column with sticky header
- `frontend/components/ops/kitchen/kds/KdsOrderCard.tsx` - Order card with BorderBeam flash and fade-out
- `frontend/components/ops/kitchen/kds/KdsOrderItem.tsx` - Tappable order item with status advance
- `frontend/components/ops/kitchen/kds/KdsElapsedTimer.tsx` - Per-second timer with green/amber/red colors
- `frontend/components/ops/kitchen/kds/KdsItemStatusBadge.tsx` - Status badge (pending/preparing/ready)
- `frontend/components/ops/kitchen/kds/KdsExitButton.tsx` - Fixed exit button navigating back
- `frontend/components/ops/kitchen/kds/KdsMetricsBar.tsx` - Metrics bar with NumberTicker and waste%
- `frontend/app/(ops)/operations/kitchen/waste/page.tsx` - Waste Log page with grid layout
- `frontend/components/ops/kitchen/waste/WasteLogForm.tsx` - Waste logging form with dynamic item select
- `frontend/components/ops/kitchen/waste/WasteLogRow.tsx` - Waste history table row with reason badge
- `frontend/components/ops/kitchen/waste/WasteReasonBadge.tsx` - Waste reason badge using type constants

## Decisions Made
- KDS uses CSS fixed overlay (z-50) to cover sidebar entirely -- simpler than separate layout segment
- New order detection seeds seenOrderIds on first load to avoid all orders flashing as new on initial render
- KDS metrics bar polls at 10s interval (separate from 5s order polling) to reduce API load
- Waste Log form auto-sets unit field from selected item's base_unit or batch unit for convenience

## Deviations from Plan

None - plan executed exactly as written.

Note: Task 2 (Waste Log) files were also committed by the parallel 09-04 agent as part of its commit (ca880fd). Both agents independently created identical implementations from the same spec. Our files match exactly -- no merge conflicts.

## Issues Encountered
- Pre-existing tsc error in PrepBatchWizardStep2.tsx (asChild prop) from parallel 09-04 agent -- out of scope, not from our changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 9 frontend pages complete: Prep Batches, KDS, Waste Log
- KDS ready for Phase 10 POS order integration (orders will flow into KDS automatically)
- Waste logging ready for production use once backend is deployed

## Self-Check: PASSED

- All 13 created files verified on disk
- Commit 8f95c1c verified in git log
- Task 2 files verified committed via parallel agent ca880fd

---
*Phase: 09-kitchen-prep*
*Completed: 2026-03-21*
