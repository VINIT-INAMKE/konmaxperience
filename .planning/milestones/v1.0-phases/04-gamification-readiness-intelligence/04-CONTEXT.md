# Phase 4: Gamification & Readiness Intelligence - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend API endpoints and frontend pages/components for: 10 readiness meters (event-sourced from valid tasks), XP/level display, leaderboard with kill switch, and KPI tracking with manual status. The validation cascade (Phase 3) already computes XP, levels, and readiness events — Phase 4 exposes and visualizes these. No new validation logic, no new task types, no new approval workflows.

</domain>

<decisions>
## Implementation Decisions

### Readiness Meters Display
- Ring grid layout using MagicUI `animated-circular-progress-bar` in a responsive grid (3-4 columns)
- 10 meters: Villa, Backend, Frontend, Procurement, Standardization, Sales, Tech, Talent, Art Experience, Lifestyle Experience
- Three-tier color coding: Green (70%+), Amber (30-69%), Red (<30%) — applied to ring stroke and percentage text
- **Both** dashboard summary and dedicated `/readiness` page:
  - Dashboard: compact mini-rings showing the 4-5 lowest meters as attention signals
  - `/readiness` page: full grid of all 10 meters
- Clicking a meter ring expands to show the list of valid tasks feeding into it (task name, XP value, who completed it)
- NumberTicker for animated percentage display

### Leaderboard & XP Visibility
- Podium + table layout: top 3 users shown as elevated podium visual (1st center, 2nd/3rd flanking), remaining users in a ranked table below with XP bars
- Admin (FOUNDER_ADMIN) excluded from rankings — leaderboard is for the 7 team members
- Kill switch: admin toggle in settings. When off, leaderboard page shows "Leaderboard is currently paused", sidebar link hidden. XP/levels still accumulate silently.
- XP/level visible in **four** locations beyond the leaderboard:
  1. **Sidebar user section** — XP total + level badge under user's name, NumberTicker animates on change
  2. **Task cards** — each task shows its XP value ("+25 XP"), validated tasks show earned XP with green checkmark
  3. **User profile/header** — XP bar showing progress to next level, level badge next to avatar
  4. **Quest/mission pages** — total XP earned from tasks in that quest/mission in the progress section

### KPI Management
- Admin + BI Lead can create, edit, and manage KPIs. Other leads view KPIs for their domain only.
- Status (on_track / at_risk / off_track) set manually by admin or BI Lead — no auto-calculation
- Cards grouped by domain (Backend, Frontend, Procurement, etc.). Each card shows: name, current vs target value, status badge (green/amber/red), linked task count
- **Both** dashboard summary and dedicated `/kpis` page:
  - Dashboard: compact section showing top 3-4 at-risk/off-track KPIs as attention signals
  - `/kpis` page: full KPI management with create/edit/domain filtering

### Level-up Celebrations
- Confetti burst (MagicUI confetti component) + Sonner toast "Level up! You're now Level 3" + temporary glow on sidebar level badge
- Recent level-ups highlighted on leaderboard page ("Sadhana just reached Level 3!") — shared visibility without interrupting others
- Level-up celebrations are triggered client-side when the XP response crosses a level threshold
- Color-coded level badges: Level 1 Gray/Silver, Level 2 Blue, Level 3 Purple, Level 4 Gold — shown as small colored pill next to username

### XP Feedback on Validation
- Animated toast: "Task validated! +{XP} XP" via Sonner
- NumberTicker in sidebar animates XP from old value to new value in real-time
- Validated tasks on task cards show green checkmark + earned XP

### Claude's Discretion
- Dashboard page layout and section ordering (meters, KPI summary, leaderboard preview)
- Readiness meter ring size and grid breakpoints
- Podium visual implementation details (CSS, animations)
- KPI form layout and validation
- Exact level badge pill styling and placement
- How "lowest meters" are selected for dashboard summary (bottom N by percentage)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain Model & Schema
- `contextdocs/dev_spec.md` §7.10 (readiness_meters) — ReadinessMeter schema with code, name, weight, target_value
- `contextdocs/dev_spec.md` §7.11 (task_readiness_events) — Event-sourced readiness with applied/revoked
- `contextdocs/dev_spec.md` §7.12 (kpis) — KPI schema with domain, unit, target_value, status
- `contextdocs/dev_spec.md` §9 (Business rules) — XP rules (type multipliers), readiness rules (only valid tasks), leaderboard rules
- `contextdocs/dev_spec.md` §10.2 (calculate_effective_xp) — XP calculation pseudo-code
- `contextdocs/dev_spec.md` §10.3 (update_readiness) — Readiness update pseudo-code

### API Design
- `contextdocs/dev_spec.md` §11.8 (readiness API) — GET /readiness-meters
- `contextdocs/dev_spec.md` §11.9 (leaderboard API) — GET /leaderboard
- `contextdocs/dev_spec.md` §11.10 (kpis API) — GET/POST/PATCH /kpis

### Existing Implementation (Phase 3)
- `backend/src/evidence/evidence.service.ts` — Contains: `recalculateUserXp()` (levels 1-4), `applyReadinessFromTask()` (event-sourced), `calculateEffectiveXp()` (type multipliers)
- `backend/prisma/schema.prisma` — ReadinessMeter, TaskReadinessEvent, Kpi models already defined; User.xp_total, User.level fields exist

### Architecture
- `contextdocs/blueprint.md` §Readiness meters — 10 meter definitions and what they measure
- `contextdocs/technical.md` §LAYER 7 (Intelligence Layer) — Readiness aggregation, gamification, KPI tracking

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/components/ui/animated-circular-progress-bar.tsx` — MagicUI animated ring, perfect for readiness meters
- `frontend/components/ui/number-ticker.tsx` — NumberTicker for animated XP/percentage values
- `frontend/components/ui/confetti.tsx` — MagicUI confetti for level-up celebrations
- `frontend/components/ui/magic-card.tsx` — MagicCard for KPI cards with spotlight effect
- `frontend/components/ui/badge.tsx` — Badge component for status indicators
- `frontend/components/ui/text-animate.tsx` — TextAnimate for "Level Up!" text
- `frontend/components/ui/hyper-text.tsx` — HyperText for animated leaderboard names
- `frontend/components/ui/shine-border.tsx` — ShineBorder for level-up glow effects
- `frontend/components/ui/cool-mode.tsx` — CoolMode for interactive celebration particles

### Established Patterns
- NestJS Module → Controller → Service → Prisma pattern
- @RequiresPermission decorator for endpoint protection
- Prisma `$transaction` for atomic multi-step operations
- React Query for server state (invalidateQueries after mutations)
- Sonner toast for notifications (mounted in root providers)
- Zustand auth store for user state (user.xp_total, user.level available)

### Integration Points
- Dashboard page (`frontend/app/(ops)/dashboard/page.tsx`) — currently placeholder, becomes the readiness + KPI + leaderboard summary hub
- Sidebar (`frontend/components/ops/Sidebar.tsx`) — add XP/level display, leaderboard link, readiness link, KPI link
- Task cards (`frontend/components/ops/tasks/TaskKanbanCard.tsx`, `TaskListView.tsx`) — add XP value display
- Quest/mission detail pages — add XP earned section alongside progress bars
- Auth store — extend to include xp_total and level for sidebar display, update on validation responses

</code_context>

<specifics>
## Specific Ideas

- Dashboard should feel like a mission control center — readiness rings across the top, attention signals for at-risk KPIs, compact leaderboard preview
- Level-up should feel rewarding and celebratory — confetti + toast + badge glow. This is the gamification payoff for evidence-backed work.
- The podium visual for top 3 on the leaderboard should be a standout design element — it's what makes the competition feel real
- XP visibility everywhere (sidebar, cards, headers, quest pages) creates a persistent gamification layer — users always see their progress

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-gamification-readiness-intelligence*
*Context gathered: 2026-03-20*
