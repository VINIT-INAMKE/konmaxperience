---
phase: 04-gamification-readiness-intelligence
plan: 02
subsystem: ui
tags: [gamification, xp, levels, react, zustand, magicui, sidebar, kanban]

# Dependency graph
requires:
  - phase: 03-evidence-validation-cascade
    provides: "Task validation cascade, valid_xp, valid fields on Task, evidence approval flow"
  - phase: 02-quest-task-management
    provides: "Quest/mission detail pages, task kanban and list views, task types with XP weights"
provides:
  - "Auth store carries xp_total and level for current user (persisted in sessionStorage)"
  - "Sidebar displays XP total via NumberTicker, LevelBadge, XpProgressBar in dropdown"
  - "Task kanban cards show XP value badge; validated tasks show green checkmark + earned XP"
  - "Task list view has XP column with validated row styling"
  - "Quest detail page shows totalXpEarned vs potentialXp in progress section"
  - "Mission detail page shows totalXpEarned across all tasks via /tasks?mission_id query"
  - "Evidence approval triggers updateXpAndLevel and triggerLevelUp in auth store"
  - "LevelUpCelebration with confetti + TextAnimate + Sonner fires on level threshold cross"
  - "New sidebar nav links: Readiness, Leaderboard (kill-switch-gated), KPIs, Settings"
  - "Gamification type constants: XP_LEVEL_THRESHOLDS, LEVEL_COLORS, getXpForNextLevel, getMeterColors"
affects:
  - phase 04 readiness, leaderboard, kpis pages
  - any component reading user.xp_total or user.level

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "levelUpEvent in auth store as cross-component event signal (set by EvidenceItem via EvidenceSection callback, consumed by Sidebar)"
    - "onXpUpdate callback prop pattern from EvidenceItem to EvidenceSection for auth store updates"
    - "LevelBadge showGlow prop triggers timed BorderBeam effect (3s then auto-removes)"

key-files:
  created:
    - frontend/lib/types/gamification.ts
    - frontend/components/ops/gamification/LevelBadge.tsx
    - frontend/components/ops/gamification/XpProgressBar.tsx
    - frontend/components/ops/gamification/LevelUpCelebration.tsx
  modified:
    - frontend/lib/types/auth.ts
    - frontend/lib/stores/auth-store.ts
    - frontend/app/(ops)/layout.tsx
    - frontend/components/ops/Sidebar.tsx
    - frontend/components/ops/tasks/TaskKanbanCard.tsx
    - frontend/components/ops/tasks/TaskListView.tsx
    - frontend/components/ops/evidence/EvidenceItem.tsx
    - frontend/components/ops/evidence/EvidenceSection.tsx
    - frontend/app/(ops)/quests/[id]/page.tsx
    - frontend/app/(ops)/missions/[id]/page.tsx

key-decisions:
  - "levelUpEvent in auth store (not a shared event emitter) — cleanest cross-component signal using existing Zustand store pattern"
  - "EvidenceItem.onXpUpdate callback instead of direct auth store calls in EvidenceSection — keeps concern separation, EvidenceSection owns auth store updates"
  - "getXpForNextLevel uses <= maxXp threshold comparison so Level 4 (Infinity) correctly falls through"
  - "Leaderboard nav link conditionally included based on /settings/leaderboard_enabled query (not rendered when kill switch is off)"
  - "Mission detail fetches /tasks?mission_id instead of aggregating from quest tasks — single query, mirrors quest detail pattern"

patterns-established:
  - "XP display pattern: NumberTicker for animation + LevelBadge pill in sidebar trigger, XpProgressBar with Progress + NumberTicker in dropdown"
  - "Level-up flow: EvidenceItem detects level change via onXpUpdate callback -> EvidenceSection.handleXpUpdate -> triggerLevelUp -> Sidebar reads levelUpEvent -> LevelUpCelebration renders"

requirements-completed: [INTL-02, INTL-03]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 4 Plan 02: Gamification Foundation Summary

**XP/level gamification layer wired across auth store, sidebar, task cards, quest/mission pages, and evidence approval with confetti level-up celebrations**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-20T17:03:18Z
- **Completed:** 2026-03-20T17:11:38Z
- **Tasks:** 3
- **Files modified:** 10 files modified, 4 files created

## Accomplishments

- Auth store now carries xp_total/level per user, persisted to sessionStorage with updateXpAndLevel and triggerLevelUp actions
- Sidebar shows animated XP (NumberTicker), color-coded LevelBadge, XpProgressBar in dropdown, and new nav items (Readiness, Leaderboard kill-switch-gated, KPIs, Settings)
- Evidence approval flow calls onXpUpdate callback which updates auth store and fires LevelUpCelebration (confetti + TextAnimate + Sonner) when level threshold is crossed

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth types, gamification types, auth store extension, and shared gamification components** - `e8f6bb7` (feat)
2. **Task 2: Wire XP into Sidebar, task cards, task list, and evidence approval flow** - `da23d33` (feat)
3. **Task 3: Wire XP earned summaries into quest detail and mission detail pages** - `b28c3c4` (feat)

## Files Created/Modified

- `frontend/lib/types/gamification.ts` — XP_LEVEL_THRESHOLDS, LEVEL_COLORS, getXpForNextLevel, getMeterColors constants and helpers
- `frontend/components/ops/gamification/LevelBadge.tsx` — Color-coded level pill badge with optional BorderBeam glow
- `frontend/components/ops/gamification/XpProgressBar.tsx` — Progress bar + NumberTicker showing XP progress to next level
- `frontend/components/ops/gamification/LevelUpCelebration.tsx` — Confetti burst + TextAnimate overlay + Sonner toast on level-up
- `frontend/lib/types/auth.ts` — Added xp_total/level to LoginResponse.user, extended RefreshResponse with user object
- `frontend/lib/stores/auth-store.ts` — Added xp_total/level to AuthUser, updateXpAndLevel action, triggerLevelUp/clearLevelUpEvent, levelUpEvent state
- `frontend/app/(ops)/layout.tsx` — Fixed setUser call to map xpTotal/level from MeResponse
- `frontend/components/ops/Sidebar.tsx` — Full rewrite: XP display, level badge, dropdown XP bar, level-up detection, new nav links
- `frontend/components/ops/tasks/TaskKanbanCard.tsx` — XP badge in card footer, green checkmark + earned XP for validated tasks
- `frontend/components/ops/tasks/TaskListView.tsx` — XP column with green text for validated tasks, bg-green-500/5 row highlight
- `frontend/components/ops/evidence/EvidenceItem.tsx` — onXpUpdate callback prop, extended approve response type
- `frontend/components/ops/evidence/EvidenceSection.tsx` — handleXpUpdate passes XP data to auth store, passes onXpUpdate to EvidenceItem
- `frontend/app/(ops)/quests/[id]/page.tsx` — totalXpEarned / potentialXp computation, NumberTicker display in progress section
- `frontend/app/(ops)/missions/[id]/page.tsx` — Added missionTasks query (/tasks?mission_id), XP earned display with skeleton loading

## Decisions Made

- **levelUpEvent in Zustand store**: Used auth store's `levelUpEvent` field as cross-component event signal rather than creating a separate event emitter. Zustand reactive subscriptions make this natural.
- **onXpUpdate callback pattern**: EvidenceSection owns auth store updates rather than EvidenceItem calling auth store directly. Keeps concerns separated and makes EvidenceItem more testable.
- **Leaderboard nav link conditional inclusion**: Array spread pattern `...(enabled ? [...] : [])` keeps nav items clean without conditional renders.
- **Mission XP via direct task fetch**: /tasks?mission_id is simpler than aggregating quest-by-quest; same pattern as quest detail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed layout.tsx setUser missing xp_total and level**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `app/(ops)/layout.tsx` called `setUser({ id, name, email, roleCode, roleName })` without the newly required `xp_total` and `level` fields from `LoginResponse['user']`
- **Fix:** Mapped `me.xpTotal ?? 0` and `me.level ?? 1` from `MeResponse` in the `setUser` call
- **Files modified:** `frontend/app/(ops)/layout.tsx`
- **Verification:** TypeScript compiled without errors after fix
- **Committed in:** e8f6bb7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in existing code exposed by type extension)
**Impact on plan:** Auto-fix was necessary for correctness — the layout initializes user state on app load and must carry XP/level. No scope creep.

## Issues Encountered

None beyond the auto-fixed layout.tsx type error above.

## Next Phase Readiness

- Gamification foundation is complete — auth store, components, sidebar, task cards, and page summaries all carry XP data
- Phase 04-03 (Readiness Intelligence page) and 04-04 (Leaderboard/KPIs) can now import from `frontend/lib/types/gamification.ts` and use `LevelBadge`/`XpProgressBar`
- Backend must return `user: { xp_total, level }` in evidence approval response for the onXpUpdate callback to fire — if not yet implemented, XP update silently no-ops (graceful degradation)

---
*Phase: 04-gamification-readiness-intelligence*
*Completed: 2026-03-20*
