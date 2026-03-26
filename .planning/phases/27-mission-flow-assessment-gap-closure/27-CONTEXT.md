# Phase 27: Mission Flow & Assessment Gap Closure - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Close every gap identified in the v2 assessment review — GET /mission-control aggregation endpoint, PurchaseOrder/Asset → Task FK linking with UI display, activity feed widget on admin dashboard, team contribution breakdown view, "Today's Focus" section on non-admin dashboard, readiness meter name on task card badges, quest → mission breadcrumb on task detail pages, readiness impact in task validation toast, mission/quest context in task list view. After this phase, 0 of the assessment's 47 claims remain valid (except the intentionally deferred Experience module).

</domain>

<decisions>
## Implementation Decisions

### Mission Control Aggregation Endpoint
- **D-01:** `/mission-control` returns lean aggregation — active mission progress, readiness snapshot (meter summaries), and action-required counts (pending approvals, blockers, overdue tasks). No leaderboard/KPI/inventory in this payload.
- **D-02:** All missions with status `active` are returned (not single-mission assumption).
- **D-03:** Progressive loading pattern — `/mission-control` returns the above-fold summary header instantly, existing detail widgets (leaderboard, KPIs, low stock) keep their own endpoints and lazy-load independently below.
- **D-04:** Role-filtered access — all roles can call `/mission-control` but data is scoped to their quests/tasks. Admin sees everything.

### Activity Feed Widget
- **D-05:** Feed shows mission-relevant events only — quest completions, task validations, readiness meter movements, blocker resolutions. Not general ERP activity.
- **D-06:** Default lookback is 48 hours (covers daily check-in cadence without noise).
- **D-07:** Static on-load fetch, no Pusher real-time. No extra WebSocket channels or auth surface. Dashboard refreshes on page load.
- **D-08:** Compact widget — last 5 items on admin dashboard with "View all" link to `/activity` page for full history.

### Team Contribution View
- **D-09:** Dashboard widget (admin-only) showing compact per-role summary + "View details" link expanding to a full breakdown page.
- **D-10:** Per-role metrics: tasks completed, tasks validated, blocked count, readiness contribution (which meters they moved and by how much).
- **D-11:** Selectable time scope: this week / this month / this mission. Default to "this mission" to reinforce mission-driven narrative.
- **D-12:** Display role names only (Backend Lead, Procurement Lead) — not person names. Consistent with existing RBAC role-label patterns.

### "Today's Focus" Section (Non-Admin Dashboard)
- **D-13:** Appears at the top of RoleDashboardSections, above "My Tasks". Shows: overdue tasks first, then due-today tasks, then active quest tasks sorted by priority. Max 5 items.
- **D-14:** Simple card section with task title, due date, quest context — not a separate endpoint, filters from existing /tasks response.

### PurchaseOrder/Asset → Task FK Linking
- **D-15:** Add `linked_task_id` (optional FK) to PurchaseOrder model via Prisma migration. Asset already has this field.
- **D-16:** UI display: task detail page shows linked POs and Assets in a "Linked Resources" section below the evidence section.
- **D-17:** PO create/edit form gets optional "Link to task" dropdown. Asset create/edit already supports this but needs UI visibility.

### Task Card & List UX Enhancements
- **D-18:** Task kanban card readiness badge changes from `+N` to `+N MetricName` (e.g., "+3 Menu Readiness"). Meter name fetched via task include.
- **D-19:** Task list view adds Mission and Quest columns (collapsible on mobile). Data comes from expanded task include.
- **D-20:** Task detail page breadcrumb becomes full chain: `Mission Name → Quest Name → Task Title` with links to each.
- **D-21:** Task validation toast changes from `"Task validated! +25 XP"` to `"Task validated! +25 XP · +3 Menu Readiness"` when task has readiness_meter_id.

### Claude's Discretion
- Activity feed item component design and density
- Exact "Today's Focus" sorting tiebreakers
- Team contribution widget chart type (bars vs table vs cards)
- `/activity` full page layout and filtering
- Migration naming and sequencing

</decisions>

<specifics>
## Specific Ideas

- The assessment claimed the system "behaves like a restaurant ERP + task tool, not a mission-driven OS." Every decision in this phase explicitly ties modules back to the mission hierarchy.
- Activity feed should feel like a mission heartbeat — showing the system is alive and progressing, not just a list of database changes.
- Team contribution view should answer "who is moving the needle on readiness?" — not just "who completed tasks."
- After this phase, the assessment response document (`contextdocsv2/ASSESSMENT_RESPONSE.md`) should have 0 valid claims remaining except the intentionally deferred Experience module.

</specifics>

<canonical_refs>
## Canonical References

### Assessment gap analysis
- `contextdocsv2/ASSESSMENT_RESPONSE.md` — All 47 claims verified; this phase closes the 4 remaining valid gaps + 6 UX polish items
- `contextdocsv2/dashboard_assessment.md` — Original assessment claiming system lacks mission-first design
- `contextdocsv2/ostechnicalv2.md` — Technical assessment with architecture claims

### Existing mission/task infrastructure
- `backend/src/missions/missions.controller.ts` — Current mission endpoints (no aggregation)
- `backend/src/missions/missions.service.ts` — Mission CRUD + quest nesting
- `backend/src/tasks/tasks.service.ts` — Task CRUD, findAll with pagination
- `backend/src/tasks/tasks.controller.ts` — Task endpoints
- `backend/src/evidence/evidence.service.ts` — validateTask() method, approval cascade
- `backend/src/readiness/readiness.service.ts` — Readiness meter queries

### Dashboard infrastructure
- `frontend/app/(ops)/dashboard/page.tsx` — Admin dashboard with existing widgets
- `frontend/components/ops/dashboard/RoleDashboardSections.tsx` — Non-admin dashboard sections
- `frontend/components/ops/dashboard/AdminPendingApprovalsWidget.tsx` — Existing widget pattern
- `frontend/components/ops/dashboard/AdminBlockersWidget.tsx` — Existing widget pattern
- `frontend/components/ops/dashboard/DashboardReadinessStrip.tsx` — Readiness ring gauges

### Task UI components
- `frontend/components/ops/tasks/TaskKanbanCard.tsx` — Card with readiness badge (needs meter name)
- `frontend/components/ops/tasks/TaskListView.tsx` — List view (needs mission/quest columns)
- `frontend/app/(ops)/tasks/[id]/page.tsx` — Detail page (needs breadcrumb chain)
- `frontend/components/ops/evidence/EvidenceSection.tsx` — Validation toast (needs readiness impact)

### Schema
- `backend/prisma/schema.prisma` — PurchaseOrder (missing linked_task_id), Asset (has linked_task_id), ReadinessMeter, Task relations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EvidenceFeedCard` component: Activity feed items can follow same card pattern (thumbnail + title + timestamp + badge)
- `AdminPendingApprovalsWidget` / `AdminBlockersWidget`: Dashboard widget pattern (card with header, compact list, count badge) — reuse for activity feed and team contribution widgets
- `DashboardReadinessStrip`: Ring gauge pattern reusable for contribution visualization
- `DashboardLeaderboardPreview`: Compact table pattern reusable for team contribution widget

### Established Patterns
- Dashboard widgets fetch their own data via React Query hooks — progressive loading is already the de facto pattern
- Task includes: `{ quest: { include: { mission: true } } }` pattern already used in task detail, extend to list/card
- Readiness meters: `ReadinessMeter` model has `code`, `name`, `current_value`, `target_value` — name is available for badge display
- Role-scoped queries: `MissionsService.findAll()` already filters by user role — extend pattern to `/mission-control`

### Integration Points
- `TaskKanbanCard` line 137-142: readiness badge — add meter name from task.readiness_meter.name
- `EvidenceSection` line 48-61: validation toast — add readiness meter context
- `TaskListView`: add quest.title and quest.mission.title columns via expanded include
- `tasks/[id]/page.tsx` line 170-176: replace simple back link with full breadcrumb
- `PurchaseOrder` Prisma model: add optional `linked_task_id` field + relation
- `dashboard/page.tsx`: add ActivityFeedWidget and TeamContributionWidget to admin sections

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 27-mission-flow-assessment-gap-closure*
*Context gathered: 2026-03-26*
