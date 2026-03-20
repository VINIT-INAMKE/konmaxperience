---
phase: 04-gamification-readiness-intelligence
plan: "03"
subsystem: frontend-gamification
tags: [readiness, leaderboard, MagicUI, React-Query, gamification]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [readiness-page, leaderboard-page]
  affects: [frontend-ops-navigation]
tech_stack:
  added: []
  patterns:
    - AnimatedCircularProgressBar with getMeterColors color-coded rings
    - BlurFade stagger for grid entrance animations
    - React Query inline query per component (MeterDetailPanel, leaderboard page)
    - ShineBorder for current user highlighting in podium and table
    - DiceBear initials API for generated user avatars
key_files:
  created:
    - frontend/lib/types/readiness.ts
    - frontend/lib/types/leaderboard.ts
    - frontend/components/ops/readiness/ReadinessMeterRing.tsx
    - frontend/components/ops/readiness/ReadinessGrid.tsx
    - frontend/components/ops/readiness/MeterDetailPanel.tsx
    - frontend/components/ops/leaderboard/LeaderboardPodium.tsx
    - frontend/components/ops/leaderboard/LeaderboardTable.tsx
    - frontend/app/(ops)/readiness/page.tsx
    - frontend/app/(ops)/leaderboard/page.tsx
  modified: []
decisions:
  - "[04-03]: MeterDetailPanel uses col-span-full to span all grid columns below selected meter (no row-based positioning needed)"
  - "[04-03]: LeaderboardTable ShineBorder applied via absolute inset on the tr element using position:relative on the row"
  - "[04-03]: AnimatedList AnimatedListItem used with items-stretch gap-2 override for task feed layout"
  - "[04-03]: HyperText py-0 overflow-visible override to fit podium column layout without extra spacing"
  - "[04-03]: Pre-existing KpiForm.tsx invalid_type_error TS errors are out-of-scope (from Plan 04-02, not introduced here)"
metrics:
  duration: "~4 min"
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_created: 9
  files_modified: 0
---

# Phase 04 Plan 03: Readiness & Leaderboard Pages Summary

**One-liner:** Readiness Intelligence page with 10 animated color-coded meter rings and expandable task detail panels, plus Team Leaderboard page with elevated podium, ranked table, kill switch paused state, and current user ShineBorder highlighting.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Readiness types, components, /readiness page | 2810e8c | readiness.ts, ReadinessMeterRing, ReadinessGrid, MeterDetailPanel, readiness/page.tsx |
| 2 | Leaderboard types, components, /leaderboard page | 7b69ed8 | leaderboard.ts, LeaderboardPodium, LeaderboardTable, leaderboard/page.tsx |

## What Was Built

### Task 1: Readiness Intelligence

**Types** (`frontend/lib/types/readiness.ts`):
- `ReadinessMeter` interface with id, code, name, description, current_value, target_value, weight
- `MeterTaskEvent` interface with nested task/owner structure

**ReadinessMeterRing** (`frontend/components/ops/readiness/ReadinessMeterRing.tsx`):
- `AnimatedCircularProgressBar` with `getMeterColors()` for green/amber/red color coding
- `NumberTicker` percentage display with `%` suffix, color-matched to ring
- Mini variant (`size-16`) for dashboard strip usage
- `InteractiveHoverButton` "View Tasks" overlay on hover (non-mini only)
- `hover:scale-105 transition-transform duration-200` on wrapper
- `aria-label="{name}: {N}% ready"` on interactive element
- `ring-2 ring-primary` selected state outline

**ReadinessGrid** (`frontend/components/ops/readiness/ReadinessGrid.tsx`):
- CSS grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`
- Each ring wrapped in `BlurFade` with `delay={index * 0.05}` stagger
- Toggle behavior: clicking same ring collapses the detail panel
- `MeterDetailPanel` renders with `col-span-full` below grid

**MeterDetailPanel** (`frontend/components/ops/readiness/MeterDetailPanel.tsx`):
- React Query `queryKey: ['readiness-meters', meterId, 'tasks']` fetching `/readiness-meters/:id/tasks`
- `BlurFade` entrance animation wrapper
- Title: `"{meterName} — {N}% Ready"` (per copywriting contract)
- `AnimatedList` with `AnimatedListItem` for task feed (50ms delay)
- Each item: task title, `+{valid_xp} XP`, owner name
- Loading: 3 shimmer rows, Empty: "No validated tasks contributing to this meter yet.", Error: Alert + Retry button

**/readiness page** (`frontend/app/(ops)/readiness/page.tsx`):
- Header: "Readiness Intelligence" + subtitle "All values derived from validated task completions"
- React Query `queryKey: ['readiness-meters']`
- Loading: 10 skeleton rings with `opacity-30 animate-pulse`
- Error: Alert with exact copywriting + retry button
- Empty: per copywriting contract copy
- `BlurFade` page entrance

### Task 2: Team Leaderboard

**Types** (`frontend/lib/types/leaderboard.ts`):
- `LeaderboardUser` interface with id, name, xp_total, level, function
- `LeaderboardResponse` interface with enabled flag and users array

**LeaderboardPodium** (`frontend/components/ops/leaderboard/LeaderboardPodium.tsx`):
- Podium order: 2nd (left), 1st (center, elevated), 3rd (right)
- Center column: `style={{ transform: 'translateY(-20px)' }}`
- Each column: DiceBear 48px avatar, `HyperText` name, `LevelBadge`, `NumberTicker` XP + "XP" label, rank `#N` in `--primary` color
- Current user column wrapped in `ShineBorder borderWidth={2} shineColor={['#a78bfa', '#22c55e']}`
- `BlurFade` page entrance

**LeaderboardTable** (`frontend/components/ops/leaderboard/LeaderboardTable.tsx`):
- `MagicCard gradientColor="#1a1a2e"` wrapping semantic `<table>`
- `<th scope="col">` headers: Rank, User, Level, XP, Tasks Validated
- DiceBear 32px avatars per row
- `LevelBadge` level column, `NumberTicker` XP column
- Current user row: `bg-primary/5` background + `ShineBorder`
- `ScrollArea` wrapper for >10 rows

**/leaderboard page** (`frontend/app/(ops)/leaderboard/page.tsx`):
- React Query `queryKey: ['leaderboard']`
- Kill switch off: `data?.enabled === false` → Card with "Leaderboard Paused" heading and body per copywriting contract
- Populated: `LeaderboardPodium` (top 3) + `LeaderboardTable` (rank 4+, startRank=4)
- Recent level-ups strip: `AvatarCircles` + `TextAnimate` for last 3 users with level > 1 (sorted by level descending)
- Loading: skeleton podium columns + skeleton table rows
- Error: Alert with exact copywriting + retry button
- Empty: per copywriting contract copy
- `currentUserId` from `useAuthStore`

## Deviations from Plan

### Out-of-Scope Issues Noted

Pre-existing TypeScript errors in `frontend/components/ops/kpis/KpiForm.tsx` (from Plan 04-02) regarding Zod v4 `invalid_type_error` parameter. These are not introduced by this plan and are logged to deferred items.

None of the plan tasks introduced new TypeScript errors. All new files compile cleanly.

## Self-Check: PASSED

Files created and verified:
- `frontend/lib/types/readiness.ts` — contains `interface ReadinessMeter` and `interface MeterTaskEvent`
- `frontend/lib/types/leaderboard.ts` — contains `interface LeaderboardUser` and `interface LeaderboardResponse`
- `frontend/components/ops/readiness/ReadinessMeterRing.tsx` — contains `AnimatedCircularProgressBar`, `getMeterColors`, `aria-label`, `size-16`
- `frontend/components/ops/readiness/ReadinessGrid.tsx` — contains `grid-cols-4`, `BlurFade`
- `frontend/components/ops/readiness/MeterDetailPanel.tsx` — contains `AnimatedList`, `readiness-meters`, `No validated tasks contributing`
- `frontend/app/(ops)/readiness/page.tsx` — contains `Readiness Intelligence`, `queryKey` with `readiness-meters`
- `frontend/components/ops/leaderboard/LeaderboardPodium.tsx` — contains `HyperText`, `translateY(-20px)`, `ShineBorder`, `dicebear`
- `frontend/components/ops/leaderboard/LeaderboardTable.tsx` — contains `MagicCard`, `<th scope`, `bg-primary/5`
- `frontend/app/(ops)/leaderboard/page.tsx` — contains `Leaderboard Paused`, `data?.enabled === false`, `queryKey` with `leaderboard`, `AvatarCircles`

Commits verified:
- `2810e8c` — Task 1 (readiness page, types, components)
- `7b69ed8` — Task 2 (leaderboard page, types, components)
