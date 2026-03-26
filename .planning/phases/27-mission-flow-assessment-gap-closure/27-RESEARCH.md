# Phase 27: Mission Flow & Assessment Gap Closure - Research

**Researched:** 2026-03-26
**Domain:** NestJS aggregation endpoints, Prisma groupBy, React Query progressive loading, Next.js App Router breadcrumbs, dashboard widget composition, Prisma FK migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mission Control Aggregation Endpoint**
- D-01: `/mission-control` returns lean aggregation — active mission progress, readiness snapshot (meter summaries), and action-required counts (pending approvals, blockers, overdue tasks). No leaderboard/KPI/inventory in this payload.
- D-02: All missions with status `active` are returned (not single-mission assumption).
- D-03: Progressive loading pattern — `/mission-control` returns the above-fold summary header instantly, existing detail widgets (leaderboard, KPIs, low stock) keep their own endpoints and lazy-load independently below.
- D-04: Role-filtered access — all roles can call `/mission-control` but data is scoped to their quests/tasks. Admin sees everything.

**Activity Feed Widget**
- D-05: Feed shows mission-relevant events only — quest completions, task validations, readiness meter movements, blocker resolutions. Not general ERP activity.
- D-06: Default lookback is 48 hours (covers daily check-in cadence without noise).
- D-07: Static on-load fetch, no Pusher real-time. No extra WebSocket channels or auth surface. Dashboard refreshes on page load.
- D-08: Compact widget — last 5 items on admin dashboard with "View all" link to `/activity` page for full history.

**Team Contribution View**
- D-09: Dashboard widget (admin-only) showing compact per-role summary + "View details" link expanding to a full breakdown page.
- D-10: Per-role metrics: tasks completed, tasks validated, blocked count, readiness contribution (which meters they moved and by how much).
- D-11: Selectable time scope: this week / this month / this mission. Default to "this mission" to reinforce mission-driven narrative.
- D-12: Display role names only (Backend Lead, Procurement Lead) — not person names. Consistent with existing RBAC role-label patterns.

**"Today's Focus" Section (Non-Admin Dashboard)**
- D-13: Appears at the top of RoleDashboardSections, above "My Tasks". Shows: overdue tasks first, then due-today tasks, then active quest tasks sorted by priority. Max 5 items.
- D-14: Simple card section with task title, due date, quest context — not a separate endpoint, filters from existing /tasks response.

**PurchaseOrder/Asset to Task FK Linking**
- D-15: Add `linked_task_id` (optional FK) to PurchaseOrder model via Prisma migration. Asset already has this field.
- D-16: UI display: task detail page shows linked POs and Assets in a "Linked Resources" section below the evidence section.
- D-17: PO create/edit form gets optional "Link to task" dropdown. Asset create/edit already supports this but needs UI visibility.

**Task Card & List UX Enhancements**
- D-18: Task kanban card readiness badge changes from `+N` to `+N MetricName` (e.g., "+3 Menu Readiness"). Meter name fetched via task include.
- D-19: Task list view adds Mission and Quest columns (collapsible on mobile). Data comes from expanded task include.
- D-20: Task detail page breadcrumb becomes full chain: `Mission Name → Quest Name → Task Title` with links to each.
- D-21: Task validation toast changes from `"Task validated! +25 XP"` to `"Task validated! +25 XP · +3 Menu Readiness"` when task has readiness_meter_id.

### Claude's Discretion
- Activity feed item component design and density
- Exact "Today's Focus" sorting tiebreakers
- Team contribution widget chart type (bars vs table vs cards)
- `/activity` full page layout and filtering
- Migration naming and sequencing

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

This phase closes assessment gaps rather than adding net-new feature requirements. The specific deliverables from CONTEXT.md map to these implementation areas:

| ID | Description | Research Support |
|----|-------------|------------------|
| MC-01 | GET /mission-control aggregation endpoint | Prisma parallel queries, groupBy patterns, NestJS service aggregation |
| MC-02 | Role-scoped /mission-control data | Existing MissionsService.findAll() scope pattern to extend |
| AF-01 | Activity feed widget (admin dashboard, last 5 items, 48h lookback) | QueryDsl across existing tables, no new ActivityEvent model needed |
| AF-02 | /activity full history page | React Query, pagination patterns |
| TC-01 | Team contribution breakdown widget + detail page | Prisma groupBy by role, Task/User join aggregation |
| TF-01 | "Today's Focus" section (non-admin dashboard) | Client-side filter of existing /tasks response |
| PO-01 | linked_task_id FK on PurchaseOrder (Prisma migration) | Optional FK migration pattern with zero downtime |
| PO-02 | "Link to task" dropdown on PO create/edit form | Combobox pattern with tasks search |
| LR-01 | "Linked Resources" section on task detail page | Parallel queries for POs and Assets linked to task |
| KB-01 | Readiness badge meter name on kanban card | Task include extension + badge layout |
| LV-01 | Mission and Quest columns in task list view | Task type extension, TaskListView columns |
| BC-01 | Mission -> Quest -> Task breadcrumb on task detail | ChevronRight nav pattern (already used in guide) |
| VT-01 | Readiness impact in validation toast | EvidenceSection useEffect enhancement |
</phase_requirements>

---

## Summary

Phase 27 is entirely within the existing NestJS + Prisma + Next.js + React Query stack. No new infrastructure, libraries, or external services are introduced. The work is: one new aggregation backend endpoint, one Prisma migration, several service method extensions, two new dashboard widgets, and a set of surgical frontend component enhancements.

The most technically interesting piece is the `/mission-control` aggregation endpoint, which must return a lean summary across active missions, readiness meters, and action-required counts in a single fast response. The established pattern in this codebase is `Promise.all` for independent Prisma queries within a single service method — this is the correct approach here too.

The activity feed does NOT need a dedicated `ActivityEvent` model. The codebase already has `TaskReadinessEvent`, `Evidence` (with `reviewed_at`), and `Task` (with `completed_at`, `blocked`, `updated_at`). Querying across these existing tables with a 48-hour lookback and ranking by `created_at/reviewed_at/updated_at` is sufficient and preferable to introducing a new model.

**Primary recommendation:** Use `Promise.all` parallel Prisma queries for the aggregation endpoint; build the activity feed by unioning recent events from existing tables with a shared timestamp sort; use the existing `GuidePageHeader` breadcrumb pattern (ChevronRight nav) for the task detail chain.

---

## Standard Stack

### Core (already in project — confirm versions match)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` | 6.19.2 | ORM for all DB queries | Project standard; groupBy, aggregate, $transaction all verified working |
| `prisma` | 6.19.2 | Schema + migrations | Manual SQL migration + `prisma migrate deploy` pattern established |
| `@nestjs/common` | 11.x | Controller/Service decorators | Project standard |
| `@tanstack/react-query` | 5.91.2 | Server state, progressive loading | Project standard; `useQuery` + `queryKey` patterns established |
| `next` | 16.2.0 | App Router, dynamic params | Project standard; `use(params)` for async params confirmed working |

### Supporting (used in this phase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | already installed | Date arithmetic for 48h lookback, due-today filter | Use `subHours`, `isToday`, `isPast` |
| `lucide-react` | already installed | `ChevronRight` for breadcrumb, icons for feed | Standard icon source |
| `sonner` | already installed | Toast for validation + readiness impact display | D-21 toast enhancement |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Querying existing tables for feed | New ActivityEvent model | New model adds migration + write overhead; existing tables already have all data needed for 48h lookback |
| Client-side filter for Today's Focus | New backend endpoint | D-14 explicitly says no new endpoint — filter from existing /tasks |
| ChevronRight nav for breadcrumb | shadcn breadcrumb component | No breadcrumb component in this codebase; guide pattern uses `<nav>` + ChevronRight directly |

**Installation:** No new packages required for this phase.

---

## Architecture Patterns

### Recommended Project Structure for New Code

```
backend/src/missions/
├── missions.controller.ts       # add GET /mission-control route here
├── missions.service.ts          # add getMissionControl() method
├── dto/
│   └── mission-control.dto.ts   # response shape type

backend/src/activity/             # NEW module — thin
├── activity.module.ts
├── activity.controller.ts        # GET /activity (paginated feed)
├── activity.service.ts           # buildFeed() querying existing tables

backend/prisma/migrations/
└── 20260326_add_po_linked_task/  # new migration file

frontend/components/ops/dashboard/
├── ActivityFeedWidget.tsx         # NEW — follows AdminPendingApprovalsWidget pattern
├── TeamContributionWidget.tsx     # NEW — compact per-role summary
└── TodaysFocusSection.tsx         # NEW — client-filtered task section

frontend/app/(ops)/activity/
└── page.tsx                       # NEW — full activity history

frontend/app/(ops)/intelligence/   # team contribution detail page
└── contributions/
    └── page.tsx                   # NEW — full breakdown page
```

### Pattern 1: Parallel Prisma Aggregation (for /mission-control)

**What:** Run independent Prisma queries in parallel via `Promise.all`, assemble the response object in the service method.

**When to use:** Any aggregation endpoint that joins data from multiple unrelated tables. This project already uses this pattern in `TasksService.update()` for parallel progress recalculations.

**Example:**
```typescript
// Source: tasks.service.ts — existing parallel pattern to follow
async getMissionControl(requestingUser: { id: string; roleCode: string }) {
  const isAdmin = ...; // getPermissionsForRole check

  const [activeMissions, meters, pendingCount, blockerCount] = await Promise.all([
    this.prisma.mission.findMany({
      where: { status: 'active' },
      include: {
        _count: { select: { quests: true, tasks: true } },
        quests: {
          select: { id: true, title: true, status: true, progress_percent: true },
        },
      },
    }),
    this.prisma.readinessMeter.findMany({ orderBy: { code: 'asc' } }),
    this.prisma.evidence.count({ where: { approval_status: 'pending' } }),
    this.prisma.task.count({ where: { blocked: true, status: 'blocked' } }),
  ]);

  return {
    missions: activeMissions,
    readiness: meters,
    actionRequired: {
      pendingApprovals: pendingCount,
      blockers: blockerCount,
    },
  };
}
```

### Pattern 2: Prisma groupBy for Team Contributions

**What:** Use `prisma.task.groupBy({ by: ['owner_user_id'], _count: { id: true } })` to get per-user task counts, then join with User.role for per-role aggregation in application layer.

**When to use:** Aggregate metrics grouped by a field. Already used in this project in `recalculateQuestProgress()`.

**Example:**
```typescript
// Verified pattern from tasks.service.ts recalculateQuestProgress
const taskCounts = await tx.task.groupBy({
  by: ['task_type', 'valid'],
  where: { quest_id: questId },
  _count: { id: true },
});
```

For team contributions, group by `owner_user_id` to get counts, then resolve role names via User includes:

```typescript
// D-10: per-role: tasks completed, tasks validated, blocked count, readiness contribution
const [taskGroups, readinessContributions, users] = await Promise.all([
  this.prisma.task.groupBy({
    by: ['owner_user_id', 'status', 'valid', 'blocked'],
    where: { /* time scope filter */ },
    _count: { id: true },
  }),
  this.prisma.taskReadinessEvent.findMany({
    where: { revoked_at: null },
    include: { task: { select: { owner_user_id: true } }, readiness_meter: { select: { name: true } } },
  }),
  this.prisma.user.findMany({
    select: { id: true, role: { select: { name: true, code: true } } },
  }),
]);
// Aggregate in application layer — group taskGroups by owner's role
```

### Pattern 3: Activity Feed from Existing Tables (no new model)

**What:** Query three existing tables with date filter, sort by timestamp, slice to N items.

**When to use:** Feed that aggregates mission-relevant events from tables that already exist. Avoids new model + migration for write events.

**Example:**
```typescript
// Activity feed — query 3 sources, union in app layer
const cutoff = subHours(new Date(), 48); // date-fns

const [recentValidations, recentReadiness, recentBlockers] = await Promise.all([
  // Task validations: task.valid=true, task.updated_at > cutoff
  this.prisma.task.findMany({
    where: { valid: true, updated_at: { gte: cutoff } },
    select: { id: true, title: true, updated_at: true, quest: { select: { title: true } }, owner: { select: { name: true } } },
    orderBy: { updated_at: 'desc' },
    take: 20,
  }),
  // Readiness events: created_at > cutoff
  this.prisma.taskReadinessEvent.findMany({
    where: { created_at: { gte: cutoff }, revoked_at: null },
    include: { task: { select: { title: true } }, readiness_meter: { select: { name: true } } },
    orderBy: { created_at: 'desc' },
    take: 20,
  }),
  // Blocker resolutions: blocked=false, status changed recently
  this.prisma.task.findMany({
    where: { blocked: false, updated_at: { gte: cutoff }, blocked_reason: { not: null } },
    select: { id: true, title: true, updated_at: true },
    orderBy: { updated_at: 'desc' },
    take: 10,
  }),
]);
// Normalize to ActivityFeedItem interface, sort by timestamp, slice to limit
```

### Pattern 4: Optional FK Migration (add linked_task_id to PurchaseOrder)

**What:** Manual SQL migration file with `prisma migrate deploy` — consistent with Phase 14/17/23 established approach.

**When to use:** Any schema change in this project. Interactive `prisma migrate dev` is avoided for CI-friendliness.

**Migration SQL:**
```sql
-- Migration: 20260326_add_po_linked_task_id
ALTER TABLE "PurchaseOrder" ADD COLUMN "linked_task_id" TEXT;
ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_linked_task_id_fkey"
  FOREIGN KEY ("linked_task_id") REFERENCES "Task"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "PurchaseOrder_linked_task_id_idx" ON "PurchaseOrder"("linked_task_id");
```

**Schema change:**
```prisma
model PurchaseOrder {
  // ...existing fields...
  linked_task_id  String?
  linked_task     Task?   @relation(fields: [linked_task_id], references: [id], onDelete: SetNull)
  // Existing Task model gets: linked_purchase_orders PurchaseOrder[]
}
```

**CRITICAL:** The Task model already has `linked_assets Asset[]` — add `linked_purchase_orders PurchaseOrder[]` to Task as well for reverse relation.

### Pattern 5: Task Include Extension for Breadcrumb + List Columns

**What:** The `findAll` method currently does NOT include quest/mission in its output. The `findOne` method already does. Extend `findAll` to include quest+mission for the list view and kanban card.

**When to use:** D-18 (readiness badge meter name), D-19 (mission/quest columns in list), D-20 (breadcrumb in detail).

**Key insight:** `findOne` already includes `quest: { select: { id: true, title: true } }` and `mission: { select: { id: true, title: true } }`. The task detail page already has these fields. The missing piece is:
1. `findAll` include: add `quest: { select: { id: true, title: true, mission: { select: { id: true, title: true } } } }` — nested mission within quest
2. `readiness_meter` include: add `readiness_meter: { select: { id: true, name: true } }` to both `findAll` and `findOne`
3. Update `Task` TypeScript type to add `quest.mission` and `readiness_meter.name` fields

**Example — extended task include:**
```typescript
// tasks.service.ts findAll include
include: {
  owner: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
  depends_on: { select: { id: true, title: true, status: true } },
  quest: {
    select: {
      id: true,
      title: true,
      mission: { select: { id: true, title: true } },  // NEW
    },
  },
  readiness_meter: { select: { id: true, name: true } },  // NEW
},
```

### Pattern 6: Breadcrumb in Next.js App Router (Task Detail)

**What:** Use the existing `GuidePageHeader` pattern — inline `<nav>` with `<ol>` and `ChevronRight` separators. No external breadcrumb component needed.

**When to use:** Any deep-hierarchy page needing back-navigation chain.

**Current state:** Task detail uses a simple `<Link href={...}>Back to quest/mission</Link>`. Replace with 3-level breadcrumb when task has quest.

**Example:**
```tsx
// Source: GuidePageHeader.tsx — existing pattern to follow
<nav aria-label="Breadcrumb">
  <ol className="flex items-center gap-1 text-[13px] text-muted-foreground">
    <li>
      <Link href={`/missions/${task.mission_id}`} className="hover:text-foreground transition-colors">
        {task.mission?.title ?? 'Mission'}
      </Link>
    </li>
    {task.quest_id && (
      <>
        <li><ChevronRight className="size-3" /></li>
        <li>
          <Link href={`/quests/${task.quest_id}`} className="hover:text-foreground transition-colors">
            {task.quest?.title ?? 'Quest'}
          </Link>
        </li>
      </>
    )}
    <li><ChevronRight className="size-3" /></li>
    <li className="text-foreground">{task.title}</li>
  </ol>
</nav>
```

### Pattern 7: Validation Toast with Readiness Impact (D-21)

**What:** Extend the existing `useEffect` in `EvidenceSection.tsx` (line 48-61) to append readiness impact when `task.readiness_meter_id` is set.

**When to use:** Already has the `task.valid` transition detection. Just extend the toast message.

**Current code (line 58):**
```typescript
toast.success(`Task validated! +${task.valid_xp} XP`);
```

**Updated pattern:**
```typescript
const readinessMsg = task.readiness_meter_id && task.readiness_value > 0
  ? ` · +${task.readiness_value} ${task.readiness_meter?.name ?? 'Readiness'}`
  : '';
toast.success(`Task validated! +${task.valid_xp} XP${readinessMsg}`);
```

**Requires:** `readiness_meter` included in Task type AND in `findOne` response (already in schema — just need to add to include).

### Dashboard Widget Composition Pattern

**What:** Each widget fetches its own data via `useQuery`. Follows existing `AdminPendingApprovalsWidget`, `AdminBlockersWidget` pattern precisely.

**Structure for new ActivityFeedWidget:**
```tsx
// components/ops/dashboard/ActivityFeedWidget.tsx
export function ActivityFeedWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => apiClient.get<ActivityFeedItem[]>('/activity?limit=5'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold">Mission Activity</CardTitle>
        <CardAction>
          <Link href="/activity" className="text-xs text-muted-foreground">View all</Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {/* loading skeleton / empty state / list items */}
      </CardContent>
    </Card>
  );
}
```

**Placement in dashboard/page.tsx:** Add ActivityFeedWidget and TeamContributionWidget to the "Status" section of AdminDashboard (between ReadinessStrip and RecentDecisions).

### Anti-Patterns to Avoid

- **Anti-pattern: loading quest+mission in a second request:** The task detail already fetches the full task via `GET /tasks/:id`. If `findOne` includes quest+mission, no second fetch is needed. Don't add a separate API call for breadcrumb data.
- **Anti-pattern: creating an ActivityEvent write hook in every service:** Avoid adding `activityService.record(...)` calls scattered across EvidenceService, TasksService, etc. Query existing tables instead (D-07: static fetch).
- **Anti-pattern: real-time activity feed:** D-07 explicitly says no Pusher for the feed. Don't add WebSocket subscription.
- **Anti-pattern: separate endpoint for Today's Focus:** D-14 says filter from existing `/tasks` response. Don't add `GET /tasks/today`.
- **Anti-pattern: interactive `prisma migrate dev`:** This project uses manual SQL + `prisma migrate deploy`. Don't run `prisma migrate dev` — it requires interactive prompts not available in CI.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission scoping in new endpoints | Custom role check logic | `getPermissionsForRole()` + `Permission.VIEW_ALL` check | Existing auth pattern — permissions.cache already loaded |
| Date arithmetic for 48h cutoff | Manual timestamp subtraction | `date-fns subHours(new Date(), 48)` | date-fns already installed, handles DST/timezone correctly |
| Progress recalculation after changes | Direct DB updates | `recalculateQuestProgress()` + `recalculateMissionProgress()` | These are the canonical methods in tasksService — don't bypass |
| Readiness meter recomputation | Direct update to current_value | `applyReadinessFromTask()` in evidence.service.ts | Handles idempotency + event log correctly |
| Breadcrumb component | Custom component | Inline `<nav><ol>` with ChevronRight (Guide pattern) | No shadcn breadcrumb exists in this project; guide pattern is clean |
| Time scope filter logic (this week/month/mission) | Complex date math | `date-fns` startOfWeek, startOfMonth + mission start_date from DB | Simple date range queries |

**Key insight:** The project has established canonical service methods for any operation that touches task validity, progress, or readiness. Always call these methods rather than duplicating logic. The aggregation endpoint for /mission-control should call `MissionsService` or query Prisma directly through its own service — not call other HTTP endpoints internally.

---

## Common Pitfalls

### Pitfall 1: findAll include extension breaks performance
**What goes wrong:** Adding `quest.mission` nested include to `findAll` for 200 tasks causes N+1 or slow join on every task list load.
**Why it happens:** Prisma resolves nested `include` with JOIN queries, which is fine, but adding it to `findAll` (which returns up to 200 records) increases payload size significantly.
**How to avoid:** Add a query parameter `?include=context` that is only passed when the full list view (with mission/quest columns) is needed. Kanban view can continue using the lightweight include. The `TodaysFocusSection` component uses the same `/tasks` response and only needs `quest.title` — acceptable cost since it's already fetching.
**Warning signs:** Response time increase on /tasks endpoint; large JSON payload in network tab.

### Pitfall 2: Task type missing readiness_meter and quest.mission fields
**What goes wrong:** Frontend `Task` TypeScript type doesn't include `readiness_meter?: { id: string; name: string }` or `quest?.mission`, causing TS errors and runtime undefined.
**Why it happens:** `findAll` currently doesn't include `readiness_meter` in its response. The type was defined before this include existed.
**How to avoid:** Update `Task` type in `frontend/lib/types/tasks.ts` to add optional `readiness_meter` and `quest.mission` fields BEFORE implementing the UI components that use them.

### Pitfall 3: PurchaseOrder → Task FK relation direction
**What goes wrong:** Adding `linked_purchase_orders PurchaseOrder[]` to the Task model in schema.prisma causes Prisma to error if the inverse relation is not also declared.
**Why it happens:** Prisma requires both sides of a relation to be declared. `Asset` already has `linked_task Task?` and Task has `linked_assets Asset[]` — same pattern needed for PO.
**How to avoid:** Add `linked_purchase_orders PurchaseOrder[]` to Task model explicitly. Update PO_INCLUDE const in purchase-orders.service.ts to optionally include `linked_task`.

### Pitfall 4: Activity feed "blocker resolutions" are hard to detect
**What goes wrong:** Querying tasks where `blocked=false AND blocked_reason IS NOT NULL AND updated_at > cutoff` returns tasks that were never blocked (if blocked_reason got set some other way) or tasks that were unblocked months ago and then touched.
**Why it happens:** The schema doesn't have a `resolved_at` timestamp. `updated_at` changes on any update.
**How to avoid:** Limit the blocker resolution feed item to tasks where `blocked=false AND status='todo' AND blocked_reason IS NOT NULL` — this is the exact state after `unblock()` resets status to 'todo'. Accept that this is an approximation; false positives are rare for an activity feed. Alternatively, omit blocker resolutions from the feed entirely and focus on task validations + readiness events which have clean timestamps.

### Pitfall 5: /mission-control role scoping mirrors findAll() but is not identical
**What goes wrong:** Copying the WHERE clause from `MissionsService.findAll()` for non-admin users but forgetting that `/mission-control` returns active missions (not all missions).
**Why it happens:** `findAll` has no status filter. `getMissionControl` must filter `status: 'active'` AND apply role scoping simultaneously.
**How to avoid:** Compose the where clause explicitly:
```typescript
const where: Record<string, unknown> = { status: 'active' };
if (!isAdmin) {
  where.OR = [
    { quests: { some: { owner_user_id: requestingUser.id } } },
    { tasks: { some: { owner_user_id: requestingUser.id } } },
  ];
}
```

### Pitfall 6: Team contribution groupBy returns owner_user_id, not role
**What goes wrong:** `task.groupBy({ by: ['owner_user_id'] })` returns per-user counts. Converting to per-role requires a separate users query and application-layer grouping.
**Why it happens:** Prisma groupBy cannot join across relations. You can't `groupBy: ['owner.role.code']`.
**How to avoid:** Fetch users with their roles separately (`this.prisma.user.findMany({ include: { role: true } })`), build a `userId → roleCode` map, then aggregate task counts by role in application layer. This is O(N) where N is number of users (small).

### Pitfall 7: Today's Focus relies on task.assigned_to but field is owner_user_id
**What goes wrong:** `RoleDashboardSections.tsx` currently filters `t.assigned_to === user?.id` but the Task type uses `owner_user_id`. Looking at the component code, `assigned_to` appears to be mapped from `owner_user_id` in the API response or it's actually checking the right field.
**Why it happens:** The Task interface has `owner_user_id` but the component filters by `assigned_to`. Looking at the existing code more carefully — the component fetches `/tasks` which returns tasks with `owner_user_id`. The filter `t.assigned_to === user?.id` is referencing a field that doesn't exist in the type — it's likely filtering wrong today or there's a backend mapping.
**How to avoid:** When implementing TodaysFocusSection, filter by `task.owner_user_id === user?.id` (not `assigned_to`). Fix the existing My Tasks filter in RoleDashboardSections at the same time.

---

## Code Examples

### /mission-control controller endpoint

```typescript
// Source: missions.controller.ts — follows existing controller pattern
@Get('mission-control')
async getMissionControl(@Req() request: express.Request) {
  const user = (request as any).user;
  return this.missionsService.getMissionControl(
    { id: user.id, roleCode: user.roleCode },
  );
}
```

Note: This route MUST be declared BEFORE `@Get(':id')` to avoid NestJS routing conflict (same pitfall as cost-data route in Phase 22).

### Prisma migration file

```sql
-- backend/prisma/migrations/20260326_add_po_linked_task_id/migration.sql
ALTER TABLE "PurchaseOrder" ADD COLUMN "linked_task_id" TEXT;
ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_linked_task_id_fkey"
  FOREIGN KEY ("linked_task_id") REFERENCES "Task"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "PurchaseOrder_linked_task_id_idx" ON "PurchaseOrder"("linked_task_id");
```

### React Query progressive loading in AdminDashboard

```tsx
// dashboard/page.tsx — follows existing pattern for widgets
// New widgets added to "Status" section
// Each widget is self-contained with its own useQuery — no prop drilling

<section className="space-y-5 border-t border-border/40 pt-8">
  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</h2>
  {/* Existing */}
  {(metersLoading || hasLowMeters) && <DashboardReadinessStrip ... />}
  {/* NEW */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <ActivityFeedWidget />
    <TeamContributionWidget />
  </div>
  {/* Existing */}
  <AdminRecentDecisionsWidget />
</section>
```

### Today's Focus filter (client-side, from existing /tasks)

```typescript
// frontend/components/ops/dashboard/TodaysFocusSection.tsx
import { isToday, isPast, parseISO } from 'date-fns';

const todaysFocus = useMemo(() => {
  if (!allTasks) return [];
  const myTasks = allTasks.filter(
    (t) => t.owner_user_id === user?.id && t.status !== 'done' && t.status !== 'cancelled'
  );
  const overdue = myTasks.filter(
    (t) => t.due_date && isPast(parseISO(t.due_date)) && !t.completed_at
  );
  const dueToday = myTasks.filter(
    (t) => t.due_date && isToday(parseISO(t.due_date)) && !overdue.includes(t)
  );
  const questTasks = myTasks
    .filter((t) => t.quest_id && !overdue.includes(t) && !dueToday.includes(t))
    .sort((a, b) => {
      const pOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
    });
  return [...overdue, ...dueToday, ...questTasks].slice(0, 5);
}, [allTasks, user?.id]);
```

### Readiness badge with meter name (D-18)

```tsx
// TaskKanbanCard.tsx — replace existing readiness badge
{task.readiness_value > 0 && (
  <Badge variant="outline" className="text-[10px] h-4 px-1 text-blue-500 border-blue-500/30">
    <TrendingUp className="size-2.5 mr-0.5" />
    +{task.readiness_value}{task.readiness_meter?.name ? ` ${task.readiness_meter.name}` : ''}
  </Badge>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate endpoint calls for each dashboard widget | Each widget self-fetches via `useQuery` | Existing pattern in this codebase | No change needed — maintain this |
| Single aggregation query with complex JOIN | `Promise.all` parallel simple queries | Established in this project | Use parallel queries, not JOIN |
| `prisma migrate dev` | Manual SQL + `prisma migrate deploy` | Phase 14 | Use manual migration |
| `breadcrumb` shadcn component | Inline `<nav><ol>` with ChevronRight | Phase 15 (guide pattern) | No external component needed |

**No deprecated approaches detected** for this phase's scope.

---

## Open Questions

1. **Activity feed: quest completions**
   - What we know: `Quest` model has `status` field, no `completed_at` timestamp
   - What's unclear: To detect recent quest completions, we'd need to filter `quest.status='completed' AND quest.updated_at > cutoff`. But `updated_at` changes on any quest update — could give false positives.
   - Recommendation: Include quest completions by querying `Quest` where `status='completed' AND updated_at > cutoff`. Accept that admin-triggered manual updates to a completed quest will not appear as "fake" completions (they'd just reappear in the feed, which is benign). Or omit quest completions from the feed and rely on task validations + readiness events (which have cleaner event semantics via TaskReadinessEvent).

2. **Team contribution: "this mission" time scope**
   - What we know: Mission has `start_date` (nullable) and `created_at`. There can be multiple active missions.
   - What's unclear: When user selects "this mission" scope and there are multiple active missions, which mission start date is used as the cutoff?
   - Recommendation: Use the earliest `start_date` of all active missions as the cutoff. If no start_date set, fall back to `created_at` of the oldest active mission. This gives the broadest "this mission" window which is the most informative.

3. **linked_task_id on PurchaseOrder: Task dropdown UX**
   - What we know: PO create/edit form already uses Select dropdowns for vendor and zone. Tasks list from `/tasks` can return 200+ items.
   - What's unclear: Whether a basic Select or a Combobox (searchable) is appropriate for the task link dropdown.
   - Recommendation: Use Combobox (already in the codebase at `frontend/components/ui/combobox.tsx`) for the task link dropdown. 200+ tasks is too many for a plain Select. Filter by active missions only.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.x (NestJS) |
| Config file | `backend/package.json` `"jest"` key |
| Quick run command | `cd backend && npx jest --testPathPattern=missions --no-coverage` |
| Full suite command | `cd backend && npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MC-01 | getMissionControl returns active missions + meters + counts | unit | `npx jest --testPathPattern=missions.service --no-coverage` | ❌ Wave 0 |
| MC-02 | Non-admin only sees missions they participate in | unit | same as above | ❌ Wave 0 |
| PO-01 | PurchaseOrder accepts linked_task_id nullable FK | migration | `prisma migrate deploy` in CI | ❌ Wave 0 (migration) |
| AF-01 | Activity feed returns events within 48h | unit | `npx jest --testPathPattern=activity.service --no-coverage` | ❌ Wave 0 |
| TC-01 | Team contribution aggregates correctly by role | unit | `npx jest --testPathPattern=activity.service --no-coverage` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx jest --testPathPattern=missions --no-coverage`
- **Per wave merge:** `cd backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/missions/__tests__/missions.service.spec.ts` — needs `getMissionControl` unit tests (MC-01, MC-02)
- [ ] `backend/src/activity/__tests__/activity.service.spec.ts` — needs feed query unit tests (AF-01, TC-01)
- [ ] Migration file `backend/prisma/migrations/20260326_add_po_linked_task_id/migration.sql` — schema change prerequisite for PO-01

---

## Sources

### Primary (HIGH confidence)

- Codebase analysis: `backend/src/tasks/tasks.service.ts` — `Promise.all` parallel pattern, `groupBy` pattern verified in `recalculateQuestProgress`
- Codebase analysis: `backend/src/evidence/evidence.service.ts` — `validateTask()` return shape, `applyReadinessFromTask()` pattern
- Codebase analysis: `frontend/components/ops/evidence/EvidenceSection.tsx` — validation toast location (line 58) for D-21 enhancement
- Codebase analysis: `frontend/components/ops/guide/GuidePageHeader.tsx` — ChevronRight breadcrumb pattern for D-20
- Codebase analysis: `backend/prisma/schema.prisma` — `Asset` has `linked_task_id`, `PurchaseOrder` does not; `Task` has `readiness_meter_id` + `readiness_meter` relation; `TaskReadinessEvent` exists for activity feed
- Codebase analysis: `frontend/components/ops/dashboard/AdminPendingApprovalsWidget.tsx` — dashboard widget pattern for new widgets
- Prisma version: 6.19.2 (confirmed via `npx prisma --version`)
- Next.js version: 16.2.0 / TanStack Query: 5.91.2 (confirmed via package.json)

### Secondary (MEDIUM confidence)

- STATE.md Phase 22 decision: `cost-data GET route declared before :id GET route to avoid NestJS route conflict` — applies to `mission-control` route ordering
- STATE.md Phase 14/17/23 decisions: Manual migration SQL + `prisma migrate deploy` pattern
- STATE.md Phase 19 decision: `Import validator pattern: pure async function` — activity service follows same thin-service pattern

### Tertiary (LOW confidence)

- Activity feed "blocker resolution" detection heuristic — single source inference from schema; exact query needs testing
- `task.assigned_to` field discrepancy in `RoleDashboardSections.tsx` — observed from code but not confirmed against API response shape

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed from package.json; no new packages needed
- Architecture: HIGH — all patterns directly observed from existing codebase files
- Pitfalls: HIGH (pitfalls 1-6) / LOW (pitfall 7 — field name discrepancy needs verification)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable stack — 30 days)
