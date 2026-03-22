---
phase: 04-gamification-readiness-intelligence
plan: 04
subsystem: ui
tags: [next.js, react-query, react-hook-form, zod, magicui, shadcn, kpi, dashboard, leaderboard]

requires:
  - phase: 04-01
    provides: KPI backend endpoints (POST/PATCH /kpis, GET /settings/:key, PATCH /settings/:key)
  - phase: 04-02
    provides: gamification types, LevelBadge, XpProgressBar, LevelUpCelebration components
  - phase: 04-03
    provides: ReadinessMeterRing, readiness types, leaderboard types

provides:
  - KPI types (Kpi, CreateKpiDto, UpdateKpiDto, KPI_DOMAINS, KPI_STATUS_LABELS, KPI_DOMAIN_LABELS) in frontend/lib/types/kpi.ts
  - LeaderboardUser and LeaderboardResponse types in frontend/lib/types/leaderboard.ts
  - KpiStatusBadge component with green/amber/red color-coded badges
  - KpiCard with MagicCard, NumberTicker, PulsatingButton for at_risk/off_track states
  - KpiForm Sheet with react-hook-form+zod, ShimmerButton submit, POST/PATCH mutations
  - /kpis page with domain filter Tabs, 3-col grid, permission-gated create/edit, all states
  - /admin/settings page with leaderboard kill switch, Switch component, disable confirmation Dialog
  - DashboardReadinessStrip showing 5 lowest meters as mini ReadinessMeterRings
  - DashboardKpiAlert showing at_risk/off_track KPIs in 2-col MagicCard grid
  - DashboardLeaderboardPreview with AvatarCircles and NumberTicker XP list
  - /dashboard mission control replacing placeholder with 3 parallel queries and all states

affects: [phase-05-procurement, phase-06-bi, phase-07-food, dashboard consumers]

tech-stack:
  added: []
  patterns:
    - "useMutation for POST/PATCH with queryClient.invalidateQueries on success and toast.success/error"
    - "Tabs value controlled by useState for domain filter tabs on /kpis page"
    - "Parallel useQuery fetches for dashboard sections with independent loading skeletons"
    - "DashboardKpiAlert returns null when all KPIs are on_track (no empty state shown)"
    - "DashboardLeaderboardPreview returns null when kill switch is off (no text — copywriting contract)"
    - "Kill switch toggle shows Dialog confirmation only when disabling (enabling is immediate)"

key-files:
  created:
    - frontend/lib/types/kpi.ts
    - frontend/lib/types/leaderboard.ts
    - frontend/components/ops/kpis/KpiStatusBadge.tsx
    - frontend/components/ops/kpis/KpiCard.tsx
    - frontend/components/ops/kpis/KpiForm.tsx
    - frontend/app/(ops)/kpis/page.tsx
    - frontend/app/(ops)/admin/settings/page.tsx
    - frontend/components/ops/dashboard/DashboardReadinessStrip.tsx
    - frontend/components/ops/dashboard/DashboardKpiAlert.tsx
    - frontend/components/ops/dashboard/DashboardLeaderboardPreview.tsx
  modified:
    - frontend/app/(ops)/dashboard/page.tsx

key-decisions:
  - "Zod v4 coerce.number() does not accept invalid_type_error — use message string on .min() instead"
  - "KpiForm uses react-hook-form watch() for Select fields since base-ui Select onValueChange fires outside RHF control"
  - "Dashboard sections only show loading skeleton if either loading OR has visible data — avoids empty flicker"
  - "DashboardReadinessStrip sorts ASC by current_value to surface lowest meters (most at risk)"
  - "linked_task_ids v1 as newline-separated textarea — combobox multi-select deferred per plan spec"

patterns-established:
  - "Sheet-based create/edit forms with ShimmerButton submit and Discard Changes ghost cancel"
  - "Dashboard sections conditionally shown based on data presence — empty sections are hidden (not shown with empty state)"

requirements-completed: [INTL-01, INTL-04, INTL-05]

duration: 6min
completed: 2026-03-20
---

# Phase 4 Plan 4: KPI Tracker, Admin Settings, and Mission Control Dashboard Summary

**KPI management page with domain filter Tabs and MagicCard grid, leaderboard kill switch settings page, and full mission control dashboard with readiness strip, KPI alerts, and leaderboard preview**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T17:15:37Z
- **Completed:** 2026-03-20T17:21:14Z
- **Tasks:** 2/2
- **Files modified:** 11

## Accomplishments

- /kpis page: domain-filtered KPI grid with MagicCard, permission-gated create (ShimmerButton) and edit (PulsatingButton for at_risk/off_track), Sheet-based form with react-hook-form + zod + useMutation
- /admin/settings: leaderboard kill switch with Switch component, disable-only confirmation Dialog matching copywriting contract, immediate enable toggle
- /dashboard: replaced Phase 1 placeholder with Mission Control — 3 parallel React Query fetches, section-aware loading skeletons, graceful hide when sections empty, all-clear card when everything operational

## Task Commits

1. **Task 1: KPI types, KpiCard, KpiStatusBadge, KpiForm, /kpis page** - `91672a9` (feat)
2. **Task 2: Admin settings, dashboard components, /dashboard mission control** - `f6fad1a` (feat)

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `frontend/lib/types/kpi.ts` - KPI types: Kpi, CreateKpiDto, UpdateKpiDto, KPI_DOMAINS, KPI_STATUS_LABELS, KPI_DOMAIN_LABELS
- `frontend/lib/types/leaderboard.ts` - LeaderboardUser and LeaderboardResponse interfaces
- `frontend/components/ops/kpis/KpiStatusBadge.tsx` - Color-coded status badge (green/amber/red)
- `frontend/components/ops/kpis/KpiCard.tsx` - MagicCard with NumberTicker, PulsatingButton for at_risk/off_track
- `frontend/components/ops/kpis/KpiForm.tsx` - Sheet form with RHF+zod, ShimmerButton submit, POST/PATCH mutations
- `frontend/app/(ops)/kpis/page.tsx` - Domain filter Tabs, 3-col grid, all 4 states, MANAGE_KPIS permission gate
- `frontend/app/(ops)/admin/settings/page.tsx` - Leaderboard kill switch with confirmation Dialog
- `frontend/components/ops/dashboard/DashboardReadinessStrip.tsx` - 5 lowest meters as mini ReadinessMeterRings
- `frontend/components/ops/dashboard/DashboardKpiAlert.tsx` - at_risk/off_track KPIs in 2-col MagicCard grid
- `frontend/components/ops/dashboard/DashboardLeaderboardPreview.tsx` - AvatarCircles + NumberTicker XP list
- `frontend/app/(ops)/dashboard/page.tsx` - Mission Control with 3 parallel queries and all states

## Decisions Made

- Zod v4 `coerce.number()` does not accept `invalid_type_error` option — use message string on `.min()` instead
- KpiForm uses `watch()` + manual `setValue()` for base-ui Select fields (outside RHF's `register()` system)
- Dashboard sections are conditionally rendered: shown only when loading OR when data has visible content — this avoids flash of empty state during hydration
- DashboardReadinessStrip sorts meters by `current_value ASC` to show the 5 most critical (lowest readiness)
- linked_task_ids v1: newline-separated textarea — combobox multi-select deferred per plan spec to avoid scope bloat

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing leaderboard.ts types file**
- **Found during:** Task 1 (KPI types implementation)
- **Issue:** `DashboardLeaderboardPreview` needs `LeaderboardResponse` and `LeaderboardUser` types from Plan 03 which was never completed (no 04-03-SUMMARY.md exists)
- **Fix:** Created `frontend/lib/types/leaderboard.ts` with both interfaces as specified in Plan 03 contract
- **Files modified:** `frontend/lib/types/leaderboard.ts`
- **Verification:** TypeScript compiles without errors
- **Committed in:** `91672a9` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Zod v4 coerce.number() API usage**
- **Found during:** Task 1 (KpiForm schema definition)
- **Issue:** Zod v4 `z.coerce.number({ invalid_type_error: '...' })` fails — the options object no longer accepts `invalid_type_error`
- **Fix:** Changed to `z.coerce.number().min(0, 'Must be a non-negative number')` pattern
- **Files modified:** `frontend/components/ops/kpis/KpiForm.tsx`
- **Verification:** TypeScript compiles without errors
- **Committed in:** `91672a9` (Task 1 commit, fixed inline before staging)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency, 1 bug)
**Impact on plan:** Both fixes necessary for compilation and correctness. No scope creep.

## Issues Encountered

- Zod v4 schema API differs from v3 for coerce number type params — resolved immediately by removing invalid option

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 frontend complete: /kpis, /admin/settings, /dashboard, /readiness (Plan 03), /leaderboard (Plan 03) pages all built
- Dashboard mission control surfaces KPI alerts, readiness strip, and leaderboard preview
- Kill switch fully integrated: DashboardLeaderboardPreview hides when off, /admin/settings controls the toggle
- Note: Plan 03 (/readiness and /leaderboard pages) was skipped in STATE.md — components exist on disk but 04-03-SUMMARY.md not created. Downstream phases can use all readiness/leaderboard components.

---
*Phase: 04-gamification-readiness-intelligence*
*Completed: 2026-03-20*
