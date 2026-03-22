# Phase 11: Dashboards & Shared Boards — Research

**Researched:** 2026-03-21
**Domain:** Dashboard aggregation, data visualization (Recharts), multi-role conditional rendering, shared board UI patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Admin vs. Role Dashboard:**
- D-01: Same `/dashboard` route with role-conditional sections. Admin sees mission control widgets + everything. Role users see personal section + relevant alerts.
- D-02: Role users land on: my active tasks (due soon first) + active quests with progress bars at top. Then XP/level card, then team alerts (low stock, KPI).
- D-03: Admin mission control adds 4 new widgets beyond existing 4: pending approvals count + list, active blockers summary, recent decisions feed, quick ad-hoc task injector.
- D-04: Admin widget order (action-first): Approvals → Blockers → Ad-hoc injector → Recent Decisions → Readiness strip → KPI alerts → Leaderboard → Low stock.

**BI Analytics Dashboard:**
- D-05: Time range: preset toggles (today / 7d / 30d) PLUS custom date range picker.
- D-06: Revenue trend: line chart with daily data points. X-axis = dates, Y-axis = revenue. Hover shows exact amount per day.
- D-07: 4 summary cards above charts: total revenue (period), average food cost %, total orders count, average order value.
- D-08: Top-selling items as ranked list (top 10 with quantity sold and revenue). Channel breakdown as donut chart showing revenue share per channel.
- D-09: Recipe cost analysis section: table showing recipes ranked by food cost %. Columns: recipe name, cost, selling price, food cost %, units sold. Highlights items with food cost % above 40%.
- D-10: Single period view only — no period comparison in v1.
- D-11: Access gated to Admin + BI Lead only (MANAGE_KPIS permission).

**Shared Boards:**
- D-12: Mission board: card grid with progress bars. Each mission card: name, phase, progress %, owner, deadline. Responsive grid. Click to drill into quests.
- D-13: Quest board: kanban columns by status (Not Started | In Progress | Completed). Quest cards with owner avatar, task count, progress %. Filter by mission or assignee.
- D-14: Wins/milestones: vertical timeline feed of completed milestones in reverse chronological order. Shows completed quests, validated tasks, level-ups. Each entry: what happened, who, when.
- D-15: Evidence feed: scrollable card feed with thumbnails. Each card: thumbnail (if image/video), task name, uploader, approval status badge, timestamp. Click to view full evidence. Most recent first.

**Domain Dashboard Placement:**
- D-16: Kitchen dashboard under Kitchen sidebar section as "Dashboard" link. Route: `/operations/kitchen/dashboard`.
- D-17: BI dashboard under Intelligence sidebar section as "Analytics" link. Route: `/intelligence/analytics`. Gated by MANAGE_KPIS permission.
- D-18: Shared boards in new "Boards" sidebar section (between Work and Intelligence). Links: Missions, Quests, Wins, Evidence Feed.
- D-19: Inventory/procurement: new dedicated dashboard page at `/operations/inventory/dashboard`.

### Claude's Discretion
- Chart library selection (Recharts, Chart.js, etc.)
- Summary card visual design and layout
- Kitchen dashboard card layout and metric visualization
- Kanban column styling and card design
- Timeline feed component implementation
- Evidence feed card layout and thumbnail sizing
- Inventory dashboard chart types and layout
- Ad-hoc task injector form design
- Responsive breakpoints for dashboard grids

### Deferred Ideas (OUT OF SCOPE)
- Period comparison on BI charts (this week vs last week) — v2
- Export/download dashboard data as CSV/PDF — v2
- Custom dashboard widget arrangement (drag-and-drop) — v2
- Real-time WebSocket updates for dashboards — v2 (polling is fine for v1)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Admin mission control — readiness overview, pending approvals, blockers, decisions, ad-hoc task injector, leaderboard | Backend: `GET /approvals/pending` exists, `GET /tasks/blocked` exists, `GET /decisions` exists. 4 new admin widgets needed. Existing 4 dashboard widgets reused as-is. `POST /tasks` with `task_type=adhoc` for injector. |
| DASH-02 | Role user dashboard — my tasks, quests, evidence, contribution meters | Backend: `GET /tasks` with scope filter returns user's tasks; `GET /quests` by mission_id. Role user view built via `isAdmin` branch in existing dashboard page. XP/level in auth store already. |
| DASH-03 | Kitchen dashboard — orders in queue, prep batch levels, station utilization, average prep times, waste today | Backend: `GET /kitchen/metrics` exists and returns all 6 required fields. Frontend page at new route `/operations/kitchen/dashboard`. 30-second polling. |
| DASH-04 | Inventory & procurement dashboard — stock levels (raw + production), low stock alerts, PO status, vendor spend, inventory value | Backend: `GET /procurement/summary` returns pending_po_count, low_stock_count, vendor_spend_this_month, total_inventory_value, top_vendors. `GET /inventory/low-stock` exists. New backend endpoint needed for PO status breakdown by status. |
| DASH-05 | BI dashboard — revenue (daily/weekly/monthly), food cost %, recipe cost analysis, top-selling items, channel breakdown | Backend: `GET /orders/daily-summary` is single-date only. 4 new backend endpoints needed: revenue time series, BI summary stats, top items, channel breakdown, recipe cost analysis. All accept date range params. |
| DASH-06 | Shared boards — mission board, quest board, wins/milestones, latest evidence feed | Backend: `GET /missions`, `GET /quests` exist. `GET /evidence` (with APPROVE_EVIDENCE permission) exists for feed. New endpoint needed for wins timeline (completed quests + validated tasks + level-ups). |
</phase_requirements>

---

## Summary

Phase 11 is a pure aggregation and display phase — no new Prisma models required. All data already exists in the database from Phases 1-10. The work breaks into two distinct tracks: (1) new backend aggregation endpoints that reshape existing data for dashboard consumption, and (2) new frontend pages and a refactored `/dashboard` page with role-conditional rendering.

The biggest backend work items are: BI analytics endpoints (revenue time series, top items, channel breakdown, recipe cost analysis with units sold), a wins/milestones timeline endpoint (merging completed quests + validated tasks + level-up events from User history), and a PO status breakdown endpoint. The kitchen, procurement/inventory, and approvals/blockers/decisions endpoints already exist or are trivially extended.

The frontend has a rich library of reusable components (DashboardReadinessStrip, DashboardKpiAlert, DashboardLeaderboardPreview, DashboardLowStockAlert, NumberTicker, AnimatedCircularProgressBar, MagicCard, BlurFade, all shadcn primitives). The main new dependency is Recharts for charts — NOT yet installed in frontend. All other components are already present.

**Primary recommendation:** Install Recharts first (frontend-only dependency). Build new backend aggregation endpoints in a dedicated `analytics` module. Refactor `/dashboard` page using `isAdmin` branch. Build 4 new board pages and 4 new domain dashboard pages as clean server-consumed read-only views.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 2.x (latest) | Line, Pie, Bar charts for BI and inventory dashboards | Project-selected (UI-SPEC D-06, D-08). React-native SVG-based, composable, tree-shakeable. Already approved in UI-SPEC. |
| @tanstack/react-query | 5.91.2 (installed) | Server state + polling for dashboard widgets | Already the project standard for all data fetching |
| shadcn (Card, Tabs, Badge, Progress, Table, Select, Popover, Avatar, ScrollArea, Skeleton) | installed | All widget containers, filters, kanban cards | Project standard (shadcn base-nova preset) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 (installed) | Date formatting for chart X-axis labels, timeline timestamps | Use `format(date, 'MMM d')` for chart axis; `formatDistanceToNow` for "2h ago" in feeds |
| lucide-react | 0.577.0 (installed) | Icons — LayoutGrid for Boards section, FileText/Video/Link/StickyNote for evidence thumbnails | Use project-approved icon set only |
| MagicUI components | installed (all at frontend/components/ui/) | BlurFade, NumberTicker, MagicCard, AnimatedCircularProgressBar | All already installed — no new installs needed |

### Recharts NOT Yet Installed
Recharts is the only new dependency for this phase.

**Installation:**
```bash
cd D:/aditee/konmaxperience/frontend && npm install recharts
```

**Version verification:** Recharts latest stable as of 2026-03 is 2.15.x. Verify with `npm view recharts version` before installing.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Chart.js / react-chartjs-2 | Canvas-based (vs SVG), harder to style with CSS variables, more boilerplate |
| Recharts | Victory | Heavier bundle, less community momentum |
| Recharts | Tremor | Opinionated components that fight shadcn styling |

---

## Architecture Patterns

### New Backend Module Structure

The BI analytics endpoints do not belong in the existing `orders/` module — they aggregate across orders, menu items, and recipes. A dedicated `analytics` module is the right pattern, consistent with how `kitchen/metrics/` was structured.

```
backend/src/analytics/
├── analytics.module.ts          # imports PrismaModule, OrdersModule (for OrdersService)
├── analytics.controller.ts      # GET /analytics/* routes
├── analytics.service.ts         # All aggregation queries
└── dto/
    └── analytics-query.dto.ts   # { from: string, to: string } date range params
```

This mirrors the `kitchen/metrics/` pattern exactly.

### New Frontend Page Structure

All new pages live inside the existing `(ops)` route group, inheriting the layout with Sidebar + main container.

```
frontend/app/(ops)/
├── dashboard/page.tsx                                    # MODIFY — role-conditional
├── intelligence/analytics/page.tsx                       # NEW — BI dashboard
├── boards/
│   ├── missions/page.tsx                                 # NEW — Mission board
│   ├── quests/page.tsx                                   # NEW — Quest board
│   ├── wins/page.tsx                                     # NEW — Wins timeline
│   └── evidence/page.tsx                                 # NEW — Evidence feed
├── operations/kitchen/dashboard/page.tsx                 # NEW — Kitchen metrics
└── operations/inventory/dashboard/page.tsx               # NEW — Inventory overview

frontend/components/ops/
├── dashboard/
│   ├── DashboardReadinessStrip.tsx                       # EXISTING — reuse
│   ├── DashboardKpiAlert.tsx                             # EXISTING — reuse
│   ├── DashboardLeaderboardPreview.tsx                   # EXISTING — reuse
│   ├── DashboardLowStockAlert.tsx                        # EXISTING — reuse
│   ├── AdminPendingApprovalsWidget.tsx                   # NEW
│   ├── AdminBlockersWidget.tsx                           # NEW
│   ├── AdminRecentDecisionsWidget.tsx                    # NEW
│   └── AdminAdHocInjectorWidget.tsx                      # NEW
├── analytics/
│   ├── RevenueTrendChart.tsx                             # NEW — Recharts LineChart
│   ├── ChannelBreakdownChart.tsx                         # NEW — Recharts PieChart
│   ├── TopItemsList.tsx                                  # NEW — ranked list
│   └── RecipeCostTable.tsx                               # NEW — table with row highlight
├── boards/
│   ├── MissionCard.tsx                                   # NEW — MagicCard variant
│   ├── QuestKanbanColumn.tsx                             # NEW
│   ├── QuestKanbanCard.tsx                               # NEW
│   ├── WinsTimeline.tsx                                  # NEW
│   └── EvidenceFeedCard.tsx                              # NEW
└── kitchen/
    └── KitchenMetricsCards.tsx                           # NEW
```

### Pattern 1: Role-Conditional Dashboard Rendering

The existing `dashboard/page.tsx` currently checks `isAdmin` only to show `AdminUserFilter`. It needs a full structural branch. The pattern: compute `isAdmin` from auth store, then render entirely different section stacks.

```typescript
// Source: existing frontend/app/(ops)/dashboard/page.tsx pattern
const user = useAuthStore((s) => s.user);
const permissions = useAuthStore((s) => s.permissions);
const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

return isAdmin ? <AdminDashboard /> : <RoleDashboard />;
```

Extract admin widgets to `AdminDashboard` sub-component and role content to `RoleDashboard` sub-component inside the same file, or as separate component files imported by page.

### Pattern 2: Backend Analytics Aggregation — Date Range Queries

All BI endpoints accept `{ from: string, to: string }` in YYYY-MM-DD format, parsed as IST (matching existing `getDailySummary` pattern).

```typescript
// Source: backend/src/orders/orders.service.ts getDailySummary — IST parse pattern
const start = new Date(`${from}T00:00:00+05:30`);
const end = new Date(`${to}T23:59:59+05:30`);
// Use: { created_at: { gte: start, lte: end } }
```

For the 7-day preset: compute `from` as `new Date() - 6 days` and `to` as today on the frontend, pass as ISO date strings. Backend does no preset logic — all date computation on frontend.

### Pattern 3: Recharts ResponsiveContainer Pattern

```typescript
// Source: Recharts official docs — ResponsiveContainer is required wrapper
import {
  LineChart, Line, CartesianGrid,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

<ResponsiveContainer width="100%" height={256}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'MMM d')} />
    <YAxis tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
    <Tooltip
      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
    />
    <Line
      type="monotone"
      dataKey="revenue"
      stroke="hsl(var(--chart-1))"
      strokeWidth={2}
      dot={false}
      activeDot={{ r: 4 }}
      isAnimationActive={false}
    />
  </LineChart>
</ResponsiveContainer>
```

**Critical:** `isAnimationActive={false}` prevents Recharts animation conflicts with React 19 concurrent rendering. Animation disabled per UI-SPEC D-06 interaction contract.

### Pattern 4: Wins Timeline — Client-Side Merge

The wins timeline combines three sources: completed quests, validated tasks, level-ups. The backend returns a single `/analytics/wins` endpoint that queries all three and returns a merged, sorted array with a `type` discriminator.

```typescript
// Backend returns:
interface WinsEntry {
  type: 'quest_completed' | 'task_validated' | 'level_up';
  title: string;        // e.g. "Quest delivered" or "DB schema finalized"
  actor_name: string;
  actor_role: string;
  timestamp: string;    // ISO string
}
```

Frontend simply renders this array — no client-side merge needed. This is simpler and avoids 3 parallel queries on a public board page.

**Data sources for wins endpoint:**
- Quest completed: `Quest` where `status = 'completed'`, `updated_at` as timestamp
- Task validated: `Task` where `valid = true`, `completed_at` as timestamp
- Level-up: User `level` history is NOT stored in schema (User.level is current only). Level-up events must be inferred or a new approach taken.

**Level-up gap:** The Prisma schema has `User.level Int @default(1)` and `User.xp_total Int` but NO level-up event log. Level-up transitions happen in `validateTask` (Phase 3 decision: "validateTask sets verified=isValid atomically"). There is no `LevelUpEvent` table.

**Resolution:** For wins timeline, skip level-up entries in v1 (not enough data). Wins = quest completions + validated tasks only. This is the simpler, correct approach. Add note in open questions.

### Pattern 5: Evidence Feed — Permission Scope

`GET /evidence` (EvidenceReviewController) requires `APPROVE_EVIDENCE` permission. The Evidence Feed board (`/boards/evidence`) is visible to all authenticated users (D-18 says "Boards section visible to all authenticated users"). This is a conflict.

**Resolution:** A new backend endpoint `GET /evidence/feed` without `APPROVE_EVIDENCE` guard, returning evidence with `approval_status` included (read-only, no approval actions). Alternatively, reuse the existing endpoint and only gate the approval actions — but the current route is `@RequiresPermission(Permission.APPROVE_EVIDENCE)`.

**Recommended approach:** New `GET /evidence/feed` endpoint in `EvidenceReviewController` without permission guard (all authenticated users can see the feed), returning evidence ordered by `created_at desc` with task name included. This is the minimal change. **Planner must include this as a backend task.**

### Pattern 6: Quest Board Filter Strategy

The UI-SPEC says filter by mission or assignee ("client-side if data volume is small; backend query if result set is large"). For v1, client-side filtering is correct: the quest set is bounded (tens, not thousands). Fetch all quests once, filter in memory.

```typescript
// Client-side filter pattern (same as Phase 10 delivery queue pattern)
const filtered = quests.filter(q =>
  (!missionFilter || q.mission_id === missionFilter) &&
  (!assigneeFilter || q.owner_user_id === assigneeFilter)
);
```

### Anti-Patterns to Avoid
- **Fetching time series data for "today" with the daily-summary endpoint:** `GET /orders/daily-summary` accepts a single date, not a range. For BI trend charts, build a new endpoint that accepts `from`+`to` and returns an array of `{ date, revenue }` objects.
- **Rendering Recharts without ResponsiveContainer:** Charts become fixed-width. Always wrap in `<ResponsiveContainer width="100%" height={N}>`.
- **Using `process.env.TZ` for IST:** The existing `getDailySummary` uses explicit `+05:30` offset in date strings. Maintain this pattern for all new date queries.
- **Adding `APPROVE_EVIDENCE` guard to the Evidence Feed:** All users should see the evidence feed board. Use a separate unguarded endpoint.
- **Blocking on missing level-up log:** Skip level-up entries for wins timeline; deliver with quest + task wins only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG chart | Recharts LineChart/PieChart | SVG math, animation, responsive sizing, tooltip positioning are all extremely hard to get right |
| Date formatting for charts | Manual string slicing | `date-fns` format() | Locale edge cases, DST, leap years |
| Progress bars | Custom div with width% | shadcn `Progress` component | Accessible, themed, consistent |
| Kanban column scroll | Custom overflow container | shadcn `ScrollArea` | Browser scrollbar normalization, momentum scrolling on iOS |
| Avatar initials generation | Custom character slicing | shadcn `Avatar` + `AvatarFallback` | Already pattern in Sidebar.tsx (getInitials helper), copy the pattern |
| Polling intervals | `setInterval` + manual cleanup | React Query `refetchInterval` option | Query key deduplication, refetch on window focus, cleanup on unmount — all handled automatically |

**Key insight:** Every chart, progress indicator, and scroll container in this phase has a library solution already installed or being installed. The value here is in the aggregation queries, not the rendering primitives.

---

## Common Pitfalls

### Pitfall 1: Recharts + Tailwind CSS Variables
**What goes wrong:** Recharts `stroke`, `fill` props don't accept Tailwind class names. `stroke="text-primary"` does nothing.
**Why it happens:** Recharts uses SVG attributes, not CSS classes.
**How to avoid:** Use `stroke="hsl(var(--chart-1))"` — CSS variable in hsl() function. All chart colors use the `--chart-1` through `--chart-5` tokens from `globals.css` (already defined per UI-SPEC).
**Warning signs:** Chart line/bars appear in black or invisible.

### Pitfall 2: Recharts PieChart innerRadius for Donut
**What goes wrong:** `<Pie>` without `innerRadius` renders a filled pie, not a donut.
**Why it happens:** Donut = Pie with `innerRadius > 0`.
**How to avoid:** `<Pie innerRadius={60} outerRadius={100} ...>` for the channel breakdown donut.

### Pitfall 3: BI Analytics — Food Cost % Aggregation
**What goes wrong:** Food cost % is per-recipe (computed from BOM + vendor prices). A "period average food cost %" requires computing across all sold items, weighted by units sold.
**Why it happens:** `MenuItem.food_cost_percent` is a stored field but may be stale (based on recipe computed_cost at MenuItem creation). Current menu items have a `food_cost_percent` field (check schema).
**How to avoid:** For the BI summary card "Avg Food Cost %", use a weighted average: sum all (MenuItem.food_cost_percent * OrderItem.quantity) / sum all OrderItem.quantity for the period. This requires joining Order → OrderItem → MenuItem.

### Pitfall 4: NestJS Route Ordering — Analytics Controller
**What goes wrong:** If analytics routes include both `/analytics/summary` and `/analytics/revenue`, NestJS may shadow one with a wildcard if order is wrong.
**Why it happens:** NestJS matches routes first-match on registration order.
**How to avoid:** Register specific routes before parameterized routes. No `:id` params expected in analytics routes, so order is less critical here. Still: list all GET routes alphabetically in controller for predictability.

### Pitfall 5: Permission Guard on Evidence Feed vs. Approval Queue
**What goes wrong:** Reusing `GET /evidence` (which requires APPROVE_EVIDENCE) for the public boards feed means only leads/admins can see it.
**Why it happens:** Phase 3 gated the evidence list behind APPROVE_EVIDENCE for the approval workflow.
**How to avoid:** New `GET /evidence/feed` endpoint without permission guard. Return evidence ordered by `created_at desc` with `task { title }` included. Include `approval_status` for the badge display.

### Pitfall 6: Dashboard Page — Auth Store `permissions` Field
**What goes wrong:** The dashboard page currently checks `user?.roleCode === RoleCode.FOUNDER_ADMIN` for admin detection. BI analytics page needs `MANAGE_KPIS` permission check.
**Why it happens:** The auth store stores `user` but the `permissions` array is fetched separately at the permission-gate level.
**How to avoid:** Check `user?.roleCode` for the BI dashboard gate OR call `getPermissionsForRole` equivalent on frontend via the auth store pattern. Looking at the Sidebar, it uses `useAuthStore((s) => s.permissions)` — verify if the `permissions` field exists in the store. If not, gate by `roleCode` for simplicity (admin + BI_LEAD roleCode check).

### Pitfall 7: `active_prep_batches` Count vs. List
**What goes wrong:** The kitchen metrics endpoint returns `active_prep_batches: number` (count). The kitchen dashboard UI-SPEC shows a table of active prep batches (recipe name, qty, expiry, status).
**Why it happens:** `GET /kitchen/metrics` returns the count but not the list.
**How to avoid:** The kitchen dashboard needs a second query: `GET /kitchen/prep-batches?status=active` to populate the table. Check if this endpoint exists (it does — `prep-batches.controller.ts` exists). The stat card uses the count from `/kitchen/metrics`; the table uses the prep-batches list endpoint.

### Pitfall 8: React 19 + Recharts Animation
**What goes wrong:** Recharts default animations cause "Warning: An update to ResponsiveContainer inside a test was not wrapped in act(...)" and visual jitter.
**Why it happens:** Recharts uses `setTimeout` for animations which conflicts with React 19 concurrent rendering.
**How to avoid:** Set `isAnimationActive={false}` on all `<Line>`, `<Bar>`, `<Pie>` elements (per UI-SPEC interaction contract).

---

## Code Examples

### Revenue Time Series Backend Query
```typescript
// Source: pattern from backend/src/orders/orders.service.ts getDailySummary
// For GET /analytics/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD
async getRevenueSeries(from: string, to: string) {
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(`${to}T23:59:59+05:30`);

  const orders = await this.prisma.order.findMany({
    where: {
      created_at: { gte: start, lte: end },
      status: { not: 'cancelled' },
    },
    include: { payment: true },
    orderBy: { created_at: 'asc' },
  });

  // Group by date (IST date string)
  const byDate = new Map<string, number>();
  for (const order of orders) {
    if (order.payment?.status !== 'paid') continue;
    const dateKey = order.created_at.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    }); // YYYY-MM-DD in IST
    byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + Number(order.total));
  }

  return Array.from(byDate.entries()).map(([date, revenue]) => ({ date, revenue }));
}
```

### Top Selling Items Backend Query
```typescript
// For GET /analytics/top-items?from=YYYY-MM-DD&to=YYYY-MM-DD
async getTopItems(from: string, to: string) {
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(`${to}T23:59:59+05:30`);

  const items = await this.prisma.orderItem.groupBy({
    by: ['menu_item_id'],
    where: {
      order: {
        created_at: { gte: start, lte: end },
        status: { not: 'cancelled' },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  });

  // Enrich with MenuItem names and revenue
  // Note: groupBy does not support include — requires separate findMany
  const menuItemIds = items.map(i => i.menu_item_id);
  const menuItems = await this.prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    select: { id: true, name: true, base_price: true },
  });

  return items.map(i => ({
    menu_item_id: i.menu_item_id,
    name: menuItems.find(m => m.id === i.menu_item_id)?.name ?? 'Unknown',
    quantity_sold: i._sum.quantity ?? 0,
    revenue: (i._sum.quantity ?? 0) * Number(
      menuItems.find(m => m.id === i.menu_item_id)?.base_price ?? 0
    ),
  }));
}
```

### React Query Polling Pattern (Kitchen Dashboard)
```typescript
// Source: established React Query v5 pattern from existing pages
const { data: metrics, isLoading } = useQuery({
  queryKey: ['kitchen-metrics'],
  queryFn: () => apiClient.get<KitchenMetrics>('/kitchen/metrics'),
  refetchInterval: 30_000, // 30-second polling — kitchen dashboard
});
```

### Role-Conditional Dashboard Branch
```typescript
// Source: existing dashboard/page.tsx pattern
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  return (
    <BlurFade>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold">
            {isAdmin ? 'Mission Control' : 'My Dashboard'}
          </h1>
          {isAdmin && <AdminUserFilter />}
        </div>

        {isAdmin ? <AdminDashboardSections /> : <RoleDashboardSections />}
      </div>
    </BlurFade>
  );
}
```

### Recharts Donut (Channel Breakdown)
```typescript
// Source: Recharts official docs
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))',
  'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
];

<ResponsiveContainer width="100%" height={200}>
  <PieChart>
    <Pie
      data={channelData}
      dataKey="revenue"
      nameKey="channel"
      cx="50%"
      cy="50%"
      innerRadius={60}
      outerRadius={90}
      isAnimationActive={false}
    >
      {channelData.map((_, index) => (
        <Cell key={index} fill={COLORS[index % COLORS.length]} />
      ))}
    </Pie>
    <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

---

## Backend Endpoints — Inventory

### What Exists vs. What's Needed

**Existing:**
- `GET /procurement/summary` — returns `{ pending_po_count, low_stock_count, vendor_spend_this_month, total_inventory_value, top_vendors }`
- `GET /inventory/low-stock` — returns array of low-stock items

**Gap for DASH-04:** UI-SPEC shows "PO Status Breakdown" chart (e.g. draft/ordered/received counts). `GET /procurement/summary` only has `pending_po_count` (draft+ordered combined). Need a new aggregation: count by PO status.

**Resolution:** Add `po_status_breakdown: { draft: number, ordered: number, received: number }` to the existing `ProcurementService.getSummary()` response — minimal change, no new endpoint needed.

---

## Backend Endpoints — New Analytics Module

### Endpoints to Build

| Endpoint | Permission | Returns |
|----------|-----------|---------|
| `GET /analytics/summary?from&to` | MANAGE_KPIS | `{ total_revenue, avg_food_cost_pct, total_orders, avg_order_value }` |
| `GET /analytics/revenue?from&to` | MANAGE_KPIS | `Array<{ date: string, revenue: number }>` |
| `GET /analytics/top-items?from&to` | MANAGE_KPIS | `Array<{ name, quantity_sold, revenue }>` (top 10) |
| `GET /analytics/channels?from&to` | MANAGE_KPIS | `Array<{ channel, revenue }>` |
| `GET /analytics/recipe-costs?from&to` | MANAGE_KPIS | `Array<{ recipe_name, cost, selling_price, food_cost_pct, units_sold }>` |

### Endpoints to Build — Wins/Milestones

| Endpoint | Permission | Returns |
|----------|-----------|---------|
| `GET /analytics/wins?limit&cursor` | (none — authenticated) | `Array<WinsEntry>` paginated |

WinsEntry merges:
- Completed quests: `Quest` where `status='completed'`, ordered by `updated_at desc`
- Validated tasks: `Task` where `valid=true`, ordered by `completed_at desc`

(Level-up entries excluded — no event log in schema. See Open Questions.)

### Endpoints to Build — Evidence Feed

| Endpoint | Permission | Returns |
|----------|-----------|---------|
| `GET /evidence/feed?status&limit&cursor` | (none — authenticated) | `Array<EvidenceFeedEntry>` with task title, uploader name |

Add to `EvidenceReviewController` without `@RequiresPermission` decorator.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual polling with setInterval | React Query `refetchInterval` | React Query v5 (project start) | Auto-cleanup on unmount, deduplication |
| Canvas-based charts (Chart.js) | SVG-based (Recharts) | Ecosystem shift ~2022 | CSS variables work directly in stroke/fill via hsl() |
| Separate admin dashboard route | Role-conditional single route | Project decision D-01 | Simpler auth guard, shared layout |

**Deprecated/outdated:**
- Recharts v1/v2 prop `label` on `<XAxis>` — use `tickFormatter` instead for custom rendering.
- Recharts `<Tooltip content={...}>` custom render — `formatter` prop is simpler for this use case.

---

## Open Questions

1. **Level-up entries in wins timeline**
   - What we know: `User.level` stores current level only. No `LevelUpEvent` table exists in schema.
   - What's unclear: Should we add a `LevelUpEvent` table in this phase? Or skip?
   - Recommendation: Skip level-up entries in wins timeline for v1 (no schema migration needed). Planner notes this in the plan as a deliberate scope reduction. Wins = quest completions + validated tasks only. Timeline will still be meaningful.

2. **BI Dashboard — `avg_food_cost_pct` calculation precision**
   - What we know: `MenuItem.food_cost_percent` exists as a stored field on MenuItems. It may not reflect the most current vendor prices (set at MenuItem creation from recipe's computed_cost).
   - What's unclear: Should avg food cost use the stored `food_cost_percent` on MenuItem (fast, potentially stale) or recalculate from current vendor prices (accurate, expensive)?
   - Recommendation: Use stored `MenuItem.food_cost_percent` weighted by `OrderItem.quantity`. It's "good enough" for a BI dashboard and avoids expensive real-time cost recalculation. Note staleness in tooltip/help text if desired.

3. **auth store `permissions` field availability**
   - What we know: The Sidebar uses `useAuthStore` for user info. `isAdmin` check is always `user?.roleCode === RoleCode.FOUNDER_ADMIN`. There is no explicit `permissions` array in the auth store visible from the store implementation read.
   - What's unclear: Is `MANAGE_KPIS` permission check possible from the store, or must we gate by roleCode?
   - Recommendation: Gate BI dashboard by roleCode check (`FOUNDER_ADMIN` or `BI_LEAD`). This matches the existing Sidebar pattern for leaderboard (checks roleCode not permission). Planner implements as `user?.roleCode === 'FOUNDER_ADMIN' || user?.roleCode === 'BI_LEAD'`.

4. **Inventory dashboard — prep batch levels**
   - What we know: DASH-04 says "stock levels (raw + production)". Production = PrepBatch levels. `GET /procurement/summary` has no PrepBatch data.
   - What's unclear: Should the inventory dashboard show active PrepBatch levels (count + quantity_remaining)?
   - Recommendation: Add `active_prep_batch_count` to `GET /procurement/summary` response. Display as a stat card "Active Batches". Full batch list is on the kitchen dashboard, not inventory dashboard.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (NestJS default) |
| Config file | `backend/package.json` jest config (inline) |
| Quick run command | `cd D:/aditee/konmaxperience/backend && npx jest --testPathPattern=analytics --passWithNoTests` |
| Full suite command | `cd D:/aditee/konmaxperience/backend && npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Admin widgets query correct data (approvals, blockers, decisions counts) | Unit | `npx jest analytics.service --passWithNoTests` | ❌ Wave 0 |
| DASH-03 | Kitchen metrics returns correct field shapes | Unit | `npx jest kitchen-metrics.service` | ❌ (existing service, no spec yet) |
| DASH-05 | Revenue series groups by IST date correctly | Unit | `npx jest analytics.service` | ❌ Wave 0 |
| DASH-05 | Top items returns top 10 ordered by quantity | Unit | `npx jest analytics.service` | ❌ Wave 0 |
| DASH-06 | Wins endpoint merges quests + tasks sorted by timestamp | Unit | `npx jest analytics.service` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd D:/aditee/konmaxperience/backend && npx jest --testPathPattern=analytics --passWithNoTests`
- **Per wave merge:** `cd D:/aditee/konmaxperience/backend && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/analytics/analytics.service.spec.ts` — covers DASH-01, DASH-05, DASH-06 revenue/top-items/wins logic
- [ ] `backend/src/kitchen/metrics/kitchen-metrics.service.spec.ts` — DASH-03 (service already exists, test file missing)

*(Frontend components are read-only dashboard views — no business logic to unit test. Visual correctness verified via `/gsd:verify-work` manual check.)*

---

## Sources

### Primary (HIGH confidence)
- `backend/src/kitchen/metrics/kitchen-metrics.service.ts` — KitchenMetrics interface and all 6 metric fields confirmed
- `backend/src/procurement/procurement.service.ts` — procurement summary fields confirmed
- `backend/src/orders/orders.service.ts` — getDailySummary IST date pattern, daily summary fields
- `backend/src/approvals/approvals.controller.ts` — `GET /approvals/pending` exists
- `backend/src/tasks/tasks.controller.ts` — `GET /tasks/blocked` exists
- `backend/src/decisions/decisions.controller.ts` — `GET /decisions` with status filter
- `backend/src/evidence/evidence.controller.ts` — existing evidence routes and permission gates
- `frontend/app/(ops)/dashboard/page.tsx` — existing dashboard structure and 4 widgets
- `frontend/components/ops/Sidebar.tsx` — sidebar structure, navigation patterns
- `frontend/package.json` — confirmed Recharts NOT installed, all other dependencies confirmed
- `backend/prisma/schema.prisma` — Task, Quest, Mission, Evidence, User models confirmed
- `.planning/phases/11-dashboards-shared-boards/11-CONTEXT.md` — all locked decisions
- `.planning/phases/11-dashboards-shared-boards/11-UI-SPEC.md` — full layout and component contracts

### Secondary (MEDIUM confidence)
- Recharts official docs (via knowledge): `isAnimationActive={false}` for React 19 compatibility, `innerRadius` for donut, `ResponsiveContainer` requirement
- date-fns v4 `format()` and `formatDistanceToNow` — consistent with installed version in package.json

### Tertiary (LOW confidence)
- Recharts version 2.15.x as "latest stable" — verify with `npm view recharts version` before install

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from package.json and existing code
- Architecture: HIGH — patterns derived from existing code reading (analytics module mirrors kitchen/metrics)
- Pitfalls: HIGH — all derived from schema reading, existing service code, and established project decisions
- Backend endpoints: HIGH — all existing endpoints confirmed by reading controller files; new endpoints derived from requirements

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack — 30 days)
