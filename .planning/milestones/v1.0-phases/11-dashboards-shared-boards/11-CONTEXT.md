# Phase 11: Dashboards & Shared Boards - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprehensive dashboards for admin mission control, role-specific personal views, kitchen operations, inventory/procurement overview, BI analytics with charts, and shared team boards (missions, quests, wins, evidence feed). Existing `/dashboard` page gets enriched with role-conditional sections. New dedicated pages for kitchen dashboard, BI analytics, inventory dashboard, and shared boards. No new data models — dashboards consume existing endpoints and new aggregation queries.

</domain>

<decisions>
## Implementation Decisions

### Admin vs. Role Dashboard
- **D-01:** Same `/dashboard` route with role-conditional sections. Admin sees mission control widgets + everything. Role users see personal section + relevant alerts.
- **D-02:** Role users land on: my active tasks (due soon first) + active quests with progress bars at top. Then XP/level card, then team alerts (low stock, KPI).
- **D-03:** Admin mission control adds 4 new widgets beyond existing 4: pending approvals count + list, active blockers summary, recent decisions feed, quick ad-hoc task injector.
- **D-04:** Admin widget order (action-first): Approvals → Blockers → Ad-hoc injector → Readiness strip → KPI alerts → Decisions → Leaderboard → Low stock.

### BI Analytics Dashboard
- **D-05:** Time range: preset toggles (today / 7d / 30d) PLUS custom date range picker.
- **D-06:** Revenue trend: line chart with daily data points. X-axis = dates, Y-axis = revenue. Hover shows exact amount per day.
- **D-07:** 4 summary cards above charts: total revenue (period), average food cost %, total orders count, average order value.
- **D-08:** Top-selling items as ranked list (top 10 with quantity sold and revenue). Channel breakdown as donut chart showing revenue share per channel.
- **D-09:** Recipe cost analysis section: table showing recipes ranked by food cost %. Columns: recipe name, cost, selling price, food cost %, units sold. Highlights items with food cost % above 40%.
- **D-10:** Single period view only — no period comparison in v1.
- **D-11:** Access gated to Admin + BI Lead only (MANAGE_KPIS permission).

### Shared Boards
- **D-12:** Mission board: card grid with progress bars. Each mission card: name, phase, progress %, owner, deadline. Responsive grid. Click to drill into quests.
- **D-13:** Quest board: kanban columns by status (Not Started | In Progress | Completed). Quest cards with owner avatar, task count, progress %. Filter by mission or assignee.
- **D-14:** Wins/milestones: vertical timeline feed of completed milestones in reverse chronological order. Shows completed quests, validated tasks, level-ups. Each entry: what happened, who, when.
- **D-15:** Evidence feed: scrollable card feed with thumbnails. Each card: thumbnail (if image/video), task name, uploader, approval status badge, timestamp. Click to view full evidence. Most recent first.

### Domain Dashboard Placement
- **D-16:** Kitchen dashboard under Kitchen sidebar section as "Dashboard" link. Route: `/operations/kitchen/dashboard`. Uses existing `GET /kitchen/metrics` endpoint.
- **D-17:** BI dashboard under Intelligence sidebar section as "Analytics" link. Route: `/intelligence/analytics`. Gated by MANAGE_KPIS permission.
- **D-18:** Shared boards in new "Boards" sidebar section (between Work and Intelligence). Links: Missions, Quests, Wins, Evidence Feed.
- **D-19:** Inventory/procurement: new dedicated dashboard page at `/operations/inventory/dashboard`. Combines stock levels, PO status breakdown, vendor spend chart. Separate from existing procurement PO management page.

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DASH-01 through DASH-06

### Existing Dashboard
- `frontend/app/(ops)/dashboard/page.tsx` — Current dashboard with 4 widgets (ReadinessStrip, KpiAlert, LeaderboardPreview, LowStockAlert)
- `frontend/components/ops/dashboard/` — Existing dashboard widget components

### Backend Endpoints (existing, to consume)
- `backend/src/kitchen/metrics/kitchen-metrics.service.ts` — KitchenMetrics: orders_in_queue, items_completed_today, active_prep_batches, waste_today_cost, waste_percentage, average_prep_time_minutes
- `backend/src/orders/orders.controller.ts` — `GET /orders/daily-summary` (total_orders, total_revenue, avg_order_value)
- `backend/src/procurement/procurement.controller.ts` — `GET /procurement/summary`
- `backend/src/inventory/inventory.service.ts` — `GET /inventory/low-stock`

### Data Sources (existing modules)
- `backend/src/readiness-meters/` — ReadinessMeter CRUD
- `backend/src/leaderboard/` — Leaderboard with kill switch
- `backend/src/kpis/` — KPI CRUD with domain filtering
- `backend/src/evidence/` — Evidence approval workflow
- `backend/src/decisions/` — Decision logging
- `backend/src/tasks/` — Task CRUD with assignment
- `backend/src/quests/` — Quest CRUD with progress
- `backend/src/missions/` — Mission CRUD with phases

### Prior Phase Decisions
- `.planning/phases/04-gamification-readiness-intelligence/04-CONTEXT.md` — Dashboard summary + dedicated page pattern, readiness strip shows lowest meters
- `.planning/phases/09-kitchen-prep/09-CONTEXT.md` — Kitchen metrics definition (D-15)
- `.planning/phases/10-pos-orders/10-CONTEXT.md` — Daily revenue summary, order status flow

### Food Production Pipeline Spec
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` — Order/payment schema, menu pricing, channel modifiers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/components/ops/dashboard/DashboardReadinessStrip.tsx` — Readiness mini-rings pattern
- `frontend/components/ops/dashboard/DashboardKpiAlert.tsx` — KPI alert card pattern
- `frontend/components/ops/dashboard/DashboardLeaderboardPreview.tsx` — Leaderboard preview
- `frontend/components/ops/dashboard/DashboardLowStockAlert.tsx` — Low stock alert strip
- `frontend/components/ui/animated-circular-progress-bar.tsx` — Progress rings
- `frontend/components/ui/number-ticker.tsx` — Animated number transitions
- `frontend/components/ui/blur-fade.tsx` — Page entrance animation
- `frontend/components/ops/AdminUserFilter.tsx` — Admin user filter dropdown

### Established Patterns
- React Query for server state with `apiClient.get<T>()`
- Skeleton loading states per section
- Card/CardContent from shadcn for widget containers
- BlurFade for page-level entrance animation
- Sonner toast for notifications
- Permission-gated rendering via `useAuthStore((s) => s.permissions)`
- Sidebar sections pattern (Dashboard, Work, Intelligence, Operations, Kitchen, POS, Admin)

### Integration Points
- Sidebar: Add "Boards" section, "Dashboard" under Kitchen, "Analytics" under Intelligence, "Dashboard" under Operations (inventory)
- `/dashboard` page: Refactor to role-conditional rendering
- New backend endpoints needed: BI analytics (revenue time series, top items, channel breakdown, recipe cost analysis), approvals count, blockers count, recent decisions
- Existing endpoints to consume: /kitchen/metrics, /orders/daily-summary, /procurement/summary, /inventory/low-stock, /readiness-meters, /kpis, /leaderboard

</code_context>

<specifics>
## Specific Ideas

- Admin dashboard should feel like a mission control — actionable items first, intelligence second
- BI dashboard is for data-driven decision making — clean charts, not cluttered
- Shared boards give the whole team visibility into progress without digging into individual pages
- Quest board kanban should feel snappy — visual status at a glance
- Evidence feed celebrates team work — showing what people are submitting and getting approved

</specifics>

<deferred>
## Deferred Ideas

- Period comparison on BI charts (this week vs last week) — v2
- Export/download dashboard data as CSV/PDF — v2
- Custom dashboard widget arrangement (drag-and-drop) — v2
- Real-time WebSocket updates for dashboards — v2 (polling is fine for v1)

</deferred>

---

*Phase: 11-dashboards-shared-boards*
*Context gathered: 2026-03-21*
