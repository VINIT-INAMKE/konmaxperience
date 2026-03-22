# Phase 4: Gamification & Readiness Intelligence - Research

**Researched:** 2026-03-20
**Domain:** Gamification display layer — NestJS REST API + Next.js UI over existing Phase 3 computation engine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Readiness Meters Display:** Ring grid layout using MagicUI `animated-circular-progress-bar` in a responsive grid (3-4 columns). 10 meters: Villa, Backend, Frontend, Procurement, Standardization, Sales, Tech, Talent, Art Experience, Lifestyle Experience. Three-tier color coding: Green (70%+), Amber (30-69%), Red (<30%). Both dashboard summary and dedicated `/readiness` page. Dashboard: compact mini-rings showing the 4-5 lowest meters. `/readiness` page: full grid. Clicking a meter ring expands to show the list of valid tasks feeding into it. NumberTicker for animated percentage display.

- **Leaderboard & XP Visibility:** Podium + table layout. Top 3 shown as elevated podium (1st center, 2nd/3rd flanking), remaining in ranked table below with XP bars. Admin (FOUNDER_ADMIN) excluded from rankings. Kill switch: admin toggle in settings — when off, leaderboard page shows "Leaderboard is currently paused", sidebar link hidden, XP/levels still accumulate silently. XP/level visible in four locations: sidebar user section, task cards, user profile/header, quest/mission pages.

- **KPI Management:** Admin + BI Lead can create/edit/manage KPIs. Other leads view KPIs for their domain only. Status (on_track / at_risk / off_track) set manually — no auto-calculation. Cards grouped by domain. Both dashboard summary and dedicated `/kpis` page.

- **Level-up Celebrations:** Confetti burst (MagicUI confetti) + Sonner toast "Level up! You're now Level 3" + temporary glow on sidebar level badge. Recent level-ups highlighted on leaderboard page. Triggered client-side when XP response crosses a level threshold.

- **XP Feedback on Validation:** Animated toast "Task validated! +{XP} XP" via Sonner. NumberTicker in sidebar animates XP from old to new in real-time. Validated tasks on task cards show green checkmark + earned XP.

### Claude's Discretion

- Dashboard page layout and section ordering (meters, KPI summary, leaderboard preview)
- Readiness meter ring size and grid breakpoints
- Podium visual implementation details (CSS, animations)
- KPI form layout and validation
- Exact level badge pill styling and placement
- How "lowest meters" are selected for dashboard summary (bottom N by percentage)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTL-01 | 10 readiness meters track real operational readiness. Additional meters added when later phases ship. | ReadinessMeter model already seeded; `GET /readiness-meters` endpoint needed; `animated-circular-progress-bar` component pre-installed |
| INTL-02 | Only valid tasks contribute to readiness meters (event-based, not recalculated) | `applyReadinessFromTask()` already in EvidenceService; Phase 4 only reads `ReadinessMeter.current_value` and `TaskReadinessEvent` — no new write logic needed |
| INTL-03 | Users earn XP from valid tasks, accumulate levels (1-4) | `User.xp_total` and `User.level` already computed by Phase 3; Phase 4 exposes via leaderboard + sidebar + profile; level-up detection is client-side comparison of old vs new level |
| INTL-04 | Leaderboard ranks users by valid XP with kill switch option | `GET /leaderboard` endpoint needed; kill switch stored as system setting (new `SystemSetting` model or environment flag); FOUNDER_ADMIN excluded from rankings |
| INTL-05 | KPIs track domain metrics (on_track, at_risk, off_track) tied to tasks | `Kpi` model already in schema; `GET/POST/PATCH /kpis` endpoints needed; status is manually set, no auto-calculation |
</phase_requirements>

---

## Summary

Phase 4 is a pure **display and CRUD layer** on top of computation that Phase 3 already delivers. The XP calculation (`recalculateUserXp`), level assignment (thresholds: <200=1, <500=2, <1000=3, >=1000=4), readiness meter updates (`applyReadinessFromTask`), and event sourcing (`TaskReadinessEvent`) are all live in `EvidenceService`. Phase 4's backend job is to expose three new endpoint groups — readiness meters, leaderboard, and KPIs — as NestJS modules following the established Controller → Service → Prisma pattern.

The frontend job is richer: four new pages (`/dashboard`, `/readiness`, `/leaderboard`, `/kpis`), modifications to Sidebar, TaskKanbanCard, and TaskListView, and 13 new components covering the ring grid, podium, KPI cards, and level-up celebration. Every MagicUI component needed is pre-installed in `frontend/components/ui/` — no new package installs. The kill switch for the leaderboard requires a persistent boolean setting, which needs a new storage mechanism (a `SystemSetting` model added to the Prisma schema, or a dedicated settings endpoint).

The one gap: the `AuthUser` type in the Zustand auth store does not carry `xp_total` or `level`. The store must be extended, and the login/refresh flow must return these fields from the backend so the sidebar can display them without a separate fetch.

**Primary recommendation:** Build three NestJS modules (readiness, leaderboard, kpis) + one thin settings module for the kill switch. On the frontend, add `xp_total` and `level` to the auth store and the login API response, then build the 13 UI components in a single wave before wiring up the four pages.

---

## Standard Stack

### Core (established, no changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | existing | Backend modules, controllers, guards | Established in backend/ |
| Prisma v6 | existing | DB access — ReadinessMeter, Kpi, User | `prisma-client-js` generator, v6 constraint |
| React Query (@tanstack/query-react) | existing | Server state, cache invalidation | All Phase 2-3 fetches use this |
| Zustand | existing | Auth store (user, xp_total, level) | Used for AuthUser state |
| Sonner | existing | Toast notifications | Mounted in `Providers`, `richColors` enabled |
| motion/react | existing | NumberTicker spring animations | Installed as dep of MagicUI NumberTicker |
| canvas-confetti | existing | Level-up confetti burst | Installed as dep of MagicUI Confetti |

### MagicUI Components (all pre-installed at `frontend/components/ui/`)

| Component | File | Phase 4 Primary Usage |
|-----------|------|-----------------------|
| `animated-circular-progress-bar` | `animated-circular-progress-bar.tsx` | ReadinessMeterRing — takes `value`, `gaugePrimaryColor`, `gaugeSecondaryColor` props |
| `number-ticker` | `number-ticker.tsx` | XP in sidebar, % inside rings, KPI values — takes `value`, `startValue`, `delay` |
| `confetti` | `confetti.tsx` | Level-up burst — uses `manualstart` + `ref.fire()` pattern (imperative API) |
| `magic-card` | `magic-card.tsx` | KPI cards, leaderboard table container — `gradientColor="#1a1a2e"` (locked decision) |
| `blur-fade` | `blur-fade.tsx` | Page entry animations, MeterDetailPanel reveal |
| `border-beam` | `border-beam.tsx` | Sidebar XP section during level-up (3s then removed) |
| `shimmer-button` | `shimmer-button.tsx` | "Create KPI" primary action |
| `pulsating-button` | `pulsating-button.tsx` | KPI edit button when at_risk or off_track |
| `shine-border` | `shine-border.tsx` | Current user's leaderboard row wrapper |
| `cool-mode` | `cool-mode.tsx` | Wraps validated task checkmark — particles on hover |
| `text-animate` | `text-animate.tsx` | "Level Up!" heading in celebration overlay |
| `hyper-text` | `hyper-text.tsx` | Leaderboard podium user names (top 3) |
| `interactive-hover-button` | `interactive-hover-button.tsx` | "View Tasks" button on meter ring hover |
| `avatar-circles` | `avatar-circles.tsx` | Podium avatar cluster, recent level-ups strip |
| `animated-list` | `animated-list.tsx` | Valid tasks feed inside MeterDetailPanel |

**No new package installs needed.** All dependencies are already in `package.json`.

### New Permissions Required

Phase 4 needs two new permissions added to the `Permission` enum in `backend/src/types/permissions.ts`:

| Permission | Who Has It | Used For |
|------------|------------|----------|
| `MANAGE_KPIS` | FOUNDER_ADMIN, BI Lead | POST/PATCH KPI endpoints |
| `MANAGE_SYSTEM` | FOUNDER_ADMIN (already exists) | Kill switch toggle |

`MANAGE_SYSTEM` already exists — the leaderboard kill switch toggle reuses it.

---

## Architecture Patterns

### Backend: Three New NestJS Modules

Following the established `Module → Controller → Service → Prisma` pattern:

```
backend/src/
├── readiness/
│   ├── readiness.module.ts
│   ├── readiness.controller.ts   (GET /readiness-meters, GET /readiness-meters/:id/tasks)
│   └── readiness.service.ts
├── leaderboard/
│   ├── leaderboard.module.ts
│   ├── leaderboard.controller.ts (GET /leaderboard)
│   └── leaderboard.service.ts
├── kpis/
│   ├── kpis.module.ts
│   ├── kpis.controller.ts        (GET/POST/PATCH /kpis, PATCH /kpis/:id)
│   ├── kpis.service.ts
│   └── dto/
│       ├── create-kpi.dto.ts
│       └── update-kpi.dto.ts
└── settings/
    ├── settings.module.ts
    ├── settings.controller.ts    (GET /settings, PATCH /settings/:key)
    └── settings.service.ts
```

Each module registered in `AppModule` imports array.

### Kill Switch Storage: SystemSetting Model

The leaderboard kill switch requires a persistent boolean. The established pattern in this codebase uses Prisma for all persistence. Add a `SystemSetting` model to the schema:

```prisma
model SystemSetting {
  key        String   @id
  value      String
  updated_at DateTime @updatedAt
}
```

Seed with `{ key: "leaderboard_enabled", value: "true" }`. The settings service reads/writes this. The leaderboard controller checks this setting before returning data. The frontend checks a `GET /settings/leaderboard_enabled` call (or includes it in the leaderboard response) to conditionally hide the sidebar link and dashboard preview.

### Auth Store Extension: xp_total and level

The current `AuthUser` interface and Zustand store do NOT carry `xp_total` or `level`. The sidebar XP display and level-up detection require these fields to be available without an extra fetch on every render.

**What to extend:**

1. `backend/src/auth/` — login and refresh token responses must include `xp_total` and `level` from the `User` record.
2. `frontend/lib/types/auth.ts` — `LoginResponse.user` must include `xp_total: number; level: number`.
3. `frontend/lib/stores/auth-store.ts` — `AuthUser` interface and `setUser()` must carry these fields.

After validation, the evidence approval response already includes the updated user's level from `recalculateUserXp`. The frontend catches this response and calls `useAuthStore.getState().setUser(updatedUser)` — triggering the NumberTicker animation and level-up check.

### Frontend: Component Tree

```
frontend/
├── app/(ops)/
│   ├── dashboard/page.tsx           (MODIFY — replace placeholder)
│   ├── readiness/page.tsx           (NEW)
│   ├── leaderboard/page.tsx         (NEW)
│   └── kpis/page.tsx                (NEW)
└── components/ops/
    ├── readiness/
    │   ├── ReadinessMeterRing.tsx    (NEW)
    │   ├── ReadinessGrid.tsx         (NEW)
    │   └── MeterDetailPanel.tsx      (NEW)
    ├── leaderboard/
    │   ├── LeaderboardPodium.tsx     (NEW)
    │   └── LeaderboardTable.tsx      (NEW)
    ├── gamification/
    │   ├── LevelBadge.tsx            (NEW)
    │   ├── XpProgressBar.tsx         (NEW)
    │   └── LevelUpCelebration.tsx    (NEW)
    ├── kpis/
    │   ├── KpiCard.tsx               (NEW)
    │   ├── KpiForm.tsx               (NEW)
    │   └── KpiStatusBadge.tsx        (NEW)
    ├── dashboard/
    │   ├── DashboardReadinessStrip.tsx    (NEW)
    │   ├── DashboardKpiAlert.tsx          (NEW)
    │   └── DashboardLeaderboardPreview.tsx (NEW)
    ├── Sidebar.tsx                   (MODIFY)
    ├── tasks/TaskKanbanCard.tsx      (MODIFY)
    └── tasks/TaskListView.tsx        (MODIFY)
```

### Pattern 1: Level-Up Detection (client-side)

Level-up is detected by comparing the user's previous level (from auth store) with the new level returned from the evidence approval response. This runs in the mutation `onSuccess` handler:

```typescript
// In the evidence approval mutation onSuccess:
const previousLevel = useAuthStore.getState().user?.level ?? 1;
const newLevel = approvalResult.user?.level ?? previousLevel;

// Update store with new XP/level
useAuthStore.getState().setUser({ ...currentUser, xp_total: newLevel_xp, level: newLevel });

// Trigger level-up if crossed
if (newLevel > previousLevel) {
  confettiRef.current?.fire({ particleCount: 100, spread: 70 });
  toast.success(`Level up! You're now Level ${newLevel}.`);
  // BorderBeam activates in sidebar via a levelUpTimestamp state variable
}
```

The evidence approval endpoint must return the updated user's `xp_total` and `level` in its response. Currently `approveEvidence` returns `{ valid, valid_xp }` — this must be extended to include the user data.

### Pattern 2: AnimatedCircularProgressBar Color Coding

The component accepts `gaugePrimaryColor` (the arc) and `gaugeSecondaryColor` (the track). Phase 4's color logic:

```typescript
function getMeterColors(value: number): { primary: string; secondary: string } {
  if (value >= 70) return { primary: '#22c55e', secondary: '#14532d' };  // green-500/green-900
  if (value >= 30) return { primary: '#f59e0b', secondary: '#78350f' };  // amber-500/amber-900
  return { primary: '#ef4444', secondary: '#7f1d1d' };                   // red-500/red-900
}
```

The percentage text inside the ring uses `text-green-500`, `text-amber-500`, or `text-red-500` via Tailwind class.

The mini-ring variant on the dashboard uses `className="size-16"` (64px) instead of the default `size-40`. Pass it via the `className` prop — the component already supports this.

### Pattern 3: KPI Permission Scoping

The KPI list endpoint must scope results for non-admin, non-BI Lead roles:

```typescript
// In kpis.service.ts findAll():
const isAdminOrBi = roleCode === 'FOUNDER_ADMIN' || roleCode === 'BI_LEAD';
const where = isAdminOrBi ? {} : { domain: userDomain };
// userDomain derived from role code (BACKEND_LEAD -> 'Backend', etc.)
```

The domain mapping from role code to KPI domain must be defined in the service (or a shared constants file).

### Pattern 4: Leaderboard Query (FOUNDER_ADMIN excluded)

```typescript
// In leaderboard.service.ts:
const users = await this.prisma.user.findMany({
  where: {
    status: 'active',
    role: { code: { not: 'FOUNDER_ADMIN' } },
  },
  select: {
    id: true,
    name: true,
    xp_total: true,
    level: true,
    function: true,
  },
  orderBy: { xp_total: 'desc' },
});
```

### Pattern 5: Readiness Meter Detail — Valid Tasks for a Meter

```typescript
// GET /readiness-meters/:id/tasks
// Returns active (non-revoked) TaskReadinessEvent rows with task + owner join
const events = await this.prisma.taskReadinessEvent.findMany({
  where: {
    readiness_meter_id: meterId,
    revoked_at: null,
  },
  include: {
    task: {
      select: {
        id: true,
        title: true,
        valid_xp: true,
        owner: { select: { id: true, name: true } },
      },
    },
  },
  orderBy: { created_at: 'desc' },
});
```

### Anti-Patterns to Avoid

- **Recomputing readiness in Phase 4 code:** Never recompute `current_value` in the Phase 4 readiness service. Always read the pre-computed value from `ReadinessMeter.current_value`. Phase 3 already handles all updates.
- **Auto-calculating KPI status:** Status is manually set by admin/BI Lead. Do not write any formula that auto-sets `on_track`/`at_risk`/`off_track` based on `current_value` vs `target_value`.
- **Storing kill switch in env variables:** Use `SystemSetting` model so it is toggle-able at runtime without a redeploy.
- **Fetching full user list to derive leaderboard:** Use a single Prisma query with `orderBy: { xp_total: 'desc' }` — do not sort in JS.
- **Level-up confetti on page load:** Confetti must only fire when the approval response returns a *higher* level than was stored before the mutation. Never fire on initial data load.
- **Blocking sidebar render on XP fetch:** XP data comes from the auth store (already persisted in sessionStorage). No separate loading state for the sidebar XP display.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circular progress ring | Custom SVG arc calculation | `animated-circular-progress-bar` (pre-installed) | Handles arc math, CSS variable animation, gap, strokeWidth |
| Animated number counting | setTimeout-based counter | `NumberTicker` (pre-installed) | Uses `motion/react` spring with correct easing, in-view trigger |
| Confetti burst | Custom canvas particle system | `Confetti` component (pre-installed) | `canvas-confetti` integration with imperative `ref.fire()` API |
| Podium avatar cluster | Custom stacked avatar layout | `avatar-circles` (pre-installed) | Handles overlap, z-index, max display count |
| Animated list entry | Manual CSS keyframes per item | `animated-list` (pre-installed) | Stagger and BlurFade entry pre-built |
| Spotlight card effect | Custom CSS radial gradient tracking | `magic-card` (pre-installed) | Mouse-tracking gradient already implemented |
| XP level thresholds | In-component branching | Shared constant `XP_LEVEL_THRESHOLDS` | Single source of truth for <200=1, <500=2, <1000=3, >=1000=4 |

**Key insight:** Every MagicUI animation need in Phase 4 is already solved. The work is wiring, not building.

---

## Common Pitfalls

### Pitfall 1: approveEvidence Response Missing User Data

**What goes wrong:** The sidebar XP animation and level-up detection require the updated `xp_total` and `level` after validation. Currently `approveEvidence` in `EvidenceService` returns `{ valid: boolean; valid_xp: number }`. The updated user data is not in the response.

**Why it happens:** Phase 3 was scoped to return only task validation results. User data was computed internally but not returned.

**How to avoid:** Extend the `approveEvidence` return type to `{ valid: boolean; valid_xp: number; user: { id: string; xp_total: number; level: number } }`. Read the updated user inside the same transaction after `recalculateUserXp`.

**Warning signs:** If the sidebar only updates XP when the page refreshes, this was missed.

### Pitfall 2: NumberTicker Requires `startValue` for Live Updates

**What goes wrong:** NumberTicker animates from `startValue` to `value`. If `startValue` is always 0 (default), the ticker always counts from zero on re-render, not from the previous XP value.

**Why it happens:** The component's `startValue` prop defaults to 0 and is a `ComponentPropsWithoutRef<"span">` extension — easy to miss.

**How to avoid:** In the sidebar XP display, store the previous XP value in a `useRef` before the auth store update, and pass it as `startValue` to NumberTicker. After the animation completes, update the ref.

```typescript
const prevXpRef = useRef(user?.xp_total ?? 0);
// After mutation resolves:
<NumberTicker startValue={prevXpRef.current} value={user.xp_total} />
// Then: prevXpRef.current = user.xp_total;
```

### Pitfall 3: Kill Switch Sidebar Hiding Requires Conditional Query

**What goes wrong:** If the leaderboard link in the sidebar is hidden based on the kill switch, but the setting is fetched asynchronously, there's a flicker where the link appears then disappears.

**Why it happens:** React Query fetches on mount with a brief loading window.

**How to avoid:** Use `initialData` or check the auth store for a cached `leaderboardEnabled` flag. Alternatively, include `leaderboard_enabled` in the user session payload so it's available instantly from the auth store.

**Warning signs:** Link briefly appears in sidebar before the settings fetch resolves.

### Pitfall 4: AnimatedCircularProgressBar Default Size is 160px (size-40)

**What goes wrong:** The component has a hardcoded `className="relative size-40 text-2xl font-semibold"` as its outer wrapper default. Dashboard mini-rings need 64px (size-16). If `className` is passed, it replaces the size class via `cn()`, but `text-2xl font-semibold` may also need overriding.

**Why it happens:** The component uses `cn()` which merges classes, but Tailwind size utilities need to override the default.

**How to avoid:** Pass `className="size-16 text-sm font-medium"` for mini-rings. The `cn()` in the component will merge correctly since size-16 overrides size-40.

### Pitfall 5: KPI Domain Mapping (role code to domain string)

**What goes wrong:** The `Kpi.domain` field stores strings like `"backend"`, `"frontend"`, etc. Role codes are like `BACKEND_LEAD`. If the mapping is done inconsistently, a BI Lead may see KPIs of the wrong domain or no KPIs.

**Why it happens:** The domain enum in `dev_spec.md` uses `(food,ops,sales,procurement,team,experience,tech)` but KPI cards in the UI show `(Backend, Frontend, Procurement, etc.)` from the CONTEXT decisions — these don't fully align.

**How to avoid:** Define a canonical `KPI_DOMAINS` constant array in a shared types file. Use this same array for the KPI form domain select, the tab filter on `/kpis`, and the role-to-domain scoping logic. Confirm final domain list from the dev_spec `kpis.domain` enum and normalize to lowercase.

### Pitfall 6: Confetti Component Requires `manualstart` Prop

**What goes wrong:** By default, `Confetti` fires immediately on mount (`manualstart=false`). Rendering `LevelUpCelebration` without `manualstart` causes confetti to fire on every render/re-mount.

**Why it happens:** Default is immediate fire. The `manualstart` prop + `ref.fire()` imperative pattern is not prominent in casual reading.

**How to avoid:** Always use `manualstart={true}` on the `Confetti` component and trigger via `confettiRef.current?.fire(options)` in the level-up callback.

---

## Code Examples

Verified from actual source files in the repository.

### Readiness Meter Ring (color-coded)

```typescript
// ReadinessMeterRing.tsx
function getMeterColors(value: number) {
  if (value >= 70) return { primary: '#22c55e', secondary: '#14532d' };
  if (value >= 30) return { primary: '#f59e0b', secondary: '#78350f' };
  return { primary: '#ef4444', secondary: '#7f1d1d' };
}

// Usage:
const colors = getMeterColors(meter.current_value);
<AnimatedCircularProgressBar
  value={meter.current_value}
  gaugePrimaryColor={colors.primary}
  gaugeSecondaryColor={colors.secondary}
  className="size-40"  // or "size-16" for mini-rings
/>
```

Source: `frontend/components/ui/animated-circular-progress-bar.tsx` — props verified.

### XP NumberTicker with Start Value

```typescript
// NumberTicker supports startValue for animated transitions
// Source: frontend/components/ui/number-ticker.tsx
<NumberTicker
  value={user.xp_total}      // new value
  startValue={prevXp}         // animated from here
  delay={0}
  className="text-sm tabular-nums"
/>
```

### Confetti Level-Up (imperative)

```typescript
// LevelUpCelebration.tsx
// Source: frontend/components/ui/confetti.tsx — manualstart + ref.fire() pattern
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';

const confettiRef = useRef<ConfettiRef>(null);

// Trigger:
confettiRef.current?.fire({
  particleCount: 100,
  spread: 70,
  origin: { y: 0.6 },
});

// JSX:
<Confetti
  ref={confettiRef}
  manualstart
  className="pointer-events-none fixed inset-0 z-50 size-full"
  aria-hidden="true"
/>
```

### NestJS Controller Pattern (from existing evidence module)

```typescript
// Established pattern: @Controller, @RequiresPermission, @Req() for user
// Source: backend/src/evidence/evidence.controller.ts
@Controller('readiness-meters')
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get()
  async findAll() {
    return this.readinessService.findAll();
  }

  @Get(':id/tasks')
  async findTasksForMeter(@Param('id', ParseUUIDPipe) id: string) {
    return this.readinessService.findTasksForMeter(id);
  }
}
```

### Leaderboard Query (FOUNDER_ADMIN excluded)

```typescript
// Source: backend/prisma/schema.prisma — User.role relation verified
async getLeaderboard() {
  return this.prisma.user.findMany({
    where: {
      status: 'active',
      role: { code: { not: 'FOUNDER_ADMIN' } },
    },
    select: {
      id: true,
      name: true,
      xp_total: true,
      level: true,
      function: true,
    },
    orderBy: { xp_total: 'desc' },
  });
}
```

### React Query Mutation with Auth Store Update

```typescript
// Established pattern from Phase 3 evidence approval
const mutation = useMutation({
  mutationFn: (evidenceId: string) =>
    apiClient.post<{ valid: boolean; valid_xp: number; user: { xp_total: number; level: number } }>(
      `/evidence/${evidenceId}/approve`
    ),
  onSuccess: (data) => {
    const prevLevel = useAuthStore.getState().user?.level ?? 1;
    // Update auth store
    const currentUser = useAuthStore.getState().user!;
    useAuthStore.getState().setUser({ ...currentUser, xp_total: data.user.xp_total, level: data.user.level });

    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    queryClient.invalidateQueries({ queryKey: ['readiness-meters'] });

    // Toast
    toast.success(`Task validated! +${data.valid_xp} XP earned.`);

    // Level-up check
    if (data.user.level > prevLevel) {
      // Fire confetti + level-up toast
    }
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| XP computed on read (aggregated query per request) | XP pre-computed and stored on `User.xp_total` via Phase 3 `recalculateUserXp` | Leaderboard query is a single `findMany` — no aggregation at read time |
| Readiness computed by counting valid tasks | Event-sourced via `TaskReadinessEvent` with `revoked_at` | Meter values are always current at DB write time; reads are simple `current_value` field |
| Custom SVG ring components | MagicUI `animated-circular-progress-bar` | CSS variable-driven animation with no JS animation loop |

---

## Open Questions

1. **Should the leaderboard response include avatar URLs?**
   - What we know: `User` model has no `avatar_url` field. `AvatarCircles` uses DiceBear initials API per Phase 02-03 decision.
   - What's unclear: Whether the leaderboard endpoint should return the DiceBear URL or just the user name and let the client build the URL.
   - Recommendation: Return `name` from the backend and build the DiceBear URL client-side (`https://api.dicebear.com/7.x/initials/svg?seed=${name}`). This is the established pattern from Phase 02-03.

2. **Does the KPI form need `linked_task_ids` multiselect in v1?**
   - What we know: `Task.kpi_id` is a FK back to `Kpi`, but the Task schema does not have a many-to-many join — tasks have a single `kpi_id`. The `Kpi` model has a `tasks Task[]` relation (one-to-many).
   - What's unclear: Whether the KPI form lets admin assign multiple tasks or whether tasks are linked to KPIs at task creation time.
   - Recommendation: The UI-SPEC mentions `linked_task_ids` as a combobox multi-select on the KPI Sheet. Since the schema supports it (Kpi `tasks Task[]`), implement a UI-side multi-select that sends a list of task IDs to `PATCH /kpis/:id` which updates each `Task.kpi_id`. The backend service does a `updateMany` on Tasks.

3. **Where is the Admin Settings page for the kill switch?**
   - What we know: The kill switch toggle lives in "Admin Settings" per CONTEXT.md. Currently there is no `/admin/settings` page — admin pages are `/admin/users`, `/admin/permissions`, `/admin/blockers`.
   - What's unclear: Whether Phase 4 creates a new `/admin/settings` page or adds the kill switch to an existing admin page.
   - Recommendation: Create a minimal `/admin/settings` page (new in Phase 4) with just the leaderboard kill switch. This gives a home for future system toggles without cluttering existing admin pages.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (NestJS default) |
| Config file | `backend/package.json` jest config |
| Quick run command | `cd backend && npm test -- --testPathPattern=readiness\|leaderboard\|kpis --passWithNoTests` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| INTL-01 | GET /readiness-meters returns all 10 meters with current_value | unit | `cd backend && npm test -- --testPathPattern=readiness` | No — Wave 0 |
| INTL-01 | GET /readiness-meters/:id/tasks returns active events with task+owner | unit | `cd backend && npm test -- --testPathPattern=readiness` | No — Wave 0 |
| INTL-02 | Only non-revoked TaskReadinessEvents are counted in meter response | unit | `cd backend && npm test -- --testPathPattern=readiness` | No — Wave 0 |
| INTL-03 | GET /leaderboard excludes FOUNDER_ADMIN and orders by xp_total desc | unit | `cd backend && npm test -- --testPathPattern=leaderboard` | No — Wave 0 |
| INTL-03 | Level thresholds correct (199=L1, 200=L2, 499=L2, 500=L3, 999=L3, 1000=L4) | unit (already in EvidenceService spec) | `cd backend && npm test -- --testPathPattern=evidence` | Yes (evidence.service.spec.ts) |
| INTL-04 | GET /settings/leaderboard_enabled returns current boolean | unit | `cd backend && npm test -- --testPathPattern=settings` | No — Wave 0 |
| INTL-04 | PATCH /settings/leaderboard_enabled updates SystemSetting in DB | unit | `cd backend && npm test -- --testPathPattern=settings` | No — Wave 0 |
| INTL-05 | POST /kpis creates KPI with correct domain, status defaults to on_track | unit | `cd backend && npm test -- --testPathPattern=kpis` | No — Wave 0 |
| INTL-05 | PATCH /kpis/:id updates status and current_value | unit | `cd backend && npm test -- --testPathPattern=kpis` | No — Wave 0 |
| INTL-05 | Non-admin non-BI-Lead cannot POST/PATCH /kpis (403) | unit | `cd backend && npm test -- --testPathPattern=kpis` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && npm test -- --testPathPattern=readiness|leaderboard|kpis|settings --passWithNoTests`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/src/readiness/readiness.service.spec.ts` — covers INTL-01, INTL-02
- [ ] `backend/src/leaderboard/leaderboard.service.spec.ts` — covers INTL-03, INTL-04 (kill switch gating)
- [ ] `backend/src/kpis/kpis.service.spec.ts` — covers INTL-05 (CRUD + permission scoping)
- [ ] `backend/src/settings/settings.service.spec.ts` — covers INTL-04 (SystemSetting read/write)

---

## Sources

### Primary (HIGH confidence)

- `backend/src/evidence/evidence.service.ts` — Complete Phase 3 XP, level, readiness, and quest/mission progress implementation. All computation patterns verified by reading source.
- `backend/prisma/schema.prisma` — `ReadinessMeter`, `TaskReadinessEvent`, `Kpi`, `User.xp_total`, `User.level` schema verified. `SystemSetting` model NOT yet present — must be added.
- `backend/src/evidence/evidence.service.spec.ts` — Jest test patterns (txMock, describe/it structure, `jest.fn()` factories) verified for Phase 4 test authoring.
- `backend/src/types/permissions.ts` — Current `Permission` enum — `MANAGE_SYSTEM` exists, `MANAGE_KPIS` does not yet.
- `frontend/components/ui/animated-circular-progress-bar.tsx` — Exact API (`value`, `gaugePrimaryColor`, `gaugeSecondaryColor`, `className`) verified from source.
- `frontend/components/ui/number-ticker.tsx` — Exact API (`value`, `startValue`, `delay`, `decimalPlaces`) verified.
- `frontend/components/ui/confetti.tsx` — `manualstart` prop + `ref.fire()` imperative pattern verified from source.
- `frontend/lib/stores/auth-store.ts` — Current `AuthUser` interface confirmed missing `xp_total` and `level`.
- `frontend/lib/providers.tsx` — Sonner `Toaster position="top-right" richColors` already mounted — no new setup needed.
- `contextdocs/dev_spec.md` §7.9, §7.10, §7.11, §11.9, §11.10, §11.15 — Schema definitions and API contracts for readiness, KPIs, and leaderboard verified.

### Secondary (MEDIUM confidence)

- `frontend/components/ops/Sidebar.tsx` — Current sidebar structure verified; no XP/level display yet. `NavItem` interface supports `badge` property — can be extended for new nav links.
- `frontend/components/ops/tasks/TaskKanbanCard.tsx` — Current card structure verified; `valid`, `valid_xp` fields already in Task type and available on the card prop.
- `frontend/lib/types/tasks.ts` — `Task` interface confirmed to include `valid`, `valid_xp`, `readiness_meter_id`, `kpi_id` — all needed fields are in the type.
- `.planning/phases/04-gamification-readiness-intelligence/04-UI-SPEC.md` — All MagicUI component usages, color values, spacing, copywriting, and accessibility contracts verified. Checker sign-off 2026-03-20.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components and libraries verified from actual installed source files
- Architecture patterns: HIGH — based on reading existing NestJS modules and Phase 3 service code directly
- Kill switch approach: MEDIUM — SystemSetting model is a design recommendation; alternative (env var) was explicitly ruled out but implementation detail needs planner confirmation
- Pitfalls: HIGH — all identified from direct code inspection (missing fields in response, NumberTicker startValue behavior, confetti manualstart pattern)

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack — no fast-moving dependencies)
