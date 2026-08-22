# Assessment: FrontendComponentMap.md

> Point-by-point verification against actual codebase (2026-03-27)
> Status legend: EXISTS | PARTIAL | MISSING | N/A (not needed at current scale)

---

## Section 1: App Shell

### `AppShell`
- **Status**: PARTIAL
- **Actual**: `frontend/app/(ops)/layout.tsx` wraps all authenticated views
- **Contains**:
  - TopHeader: MISSING (no persistent top header bar)
  - AdaptiveSidebar: EXISTS (`components/ops/Sidebar.tsx`)
  - MainContentArea: EXISTS (scrollable main area in layout)
  - QuickActionDock: PARTIAL (ad-hoc task button in sidebar only)
  - GlobalNotificationTray: EXISTS (`NotificationBell.tsx` popover + `/notifications` page)
- **Decision**: [ ] REVIEW — Consider adding a minimal top context bar (mission + phase + quest) or keep context on dashboard only

### `TopHeader`
- **Status**: MISSING
- **Spec says**: current mission, current phase, current weekly quest, search, notification bell, theme toggle, user avatar / role badge
- **Actual**: No persistent top header. These elements are scattered:
  - Mission/phase/quest: Only on dashboard via `MissionContextStrip`
  - Search: Only in Guide (Cmd+K overlay)
  - Notification bell: In sidebar top area (logo row, line 423)
  - Theme toggle: In sidebar
  - User avatar / role badge: In sidebar user dropdown
- **Decision**: [ ] REVIEW — A top header showing mission context everywhere would improve orientation. Alternatively, the sidebar approach works for a small team. Evaluate if users lose context when navigating deep.

### `AdaptiveSidebar`
- **Status**: EXISTS
- **Actual**: `components/ops/Sidebar.tsx` (659 lines)
- **Role-aware**: Yes, permission-gated nav items
- **Core items comparison**:
  - Mission Control: EXISTS as "Dashboard"
  - My Quests: PARTIAL — Quest Board at `/boards/quests` has assignee filter dropdown (can filter to self). Role dashboard shows "Active Quest" filtered to current user. But no dedicated "My Quests" sidebar link that auto-filters.
  - My Tasks: MISSING (no standalone "my tasks" view)
  - Readiness: EXISTS under Intelligence
  - Evidence: EXISTS under Boards > Evidence Feed
  - Governance: PARTIAL — split into Work > Approvals + Work > Decisions
  - Team: MISSING (no team page)
- **Role-scoped items comparison**:
  - Product Lab: MISSING
  - Service Ops: MISSING
  - Procurement: EXISTS under Operations > Procurement
  - KPI Center: EXISTS under Intelligence > KPIs
  - System Console: MISSING
  - Experience Layer: DEFERRED (food-first, art/lifestyle planned for future phase)
  - Outreach: MISSING
  - Talent Readiness: MISSING
- **Items in actual sidebar but NOT in spec** (spec is outdated here):
  - Guide, Chat, Wins board, Kitchen section (KDS, Prep Batches, Supply Usage, Waste Log, Pick & Pack), POS section (Take Order, Orders, Delivery Queue), Analytics, Feedback — all built in later phases
- **Decision**: [ ] REVIEW — "My Quests" and "My Tasks" are the biggest functional gaps. These are high-value additions. The role-specific modules (Product Lab, Service Ops, etc.) map to a 21-role model we don't use.

### `QuickActionDock`
- **Status**: PARTIAL
- **Spec says**: create ad-hoc task, upload evidence, log blocker, create decision note
- **Actual**: Only "Ad-hoc Task" button exists in sidebar (requires `CREATE_ADHOC_TASK` permission), opens `AdHocTaskSheet`
- **Missing actions**: Upload evidence shortcut, log blocker shortcut, create decision shortcut
- **Decision**: [ ] REVIEW — A floating quick-action dock could improve speed. Low priority for 8-person team since pages are few clicks away.

### `GlobalNotificationTray`
- **Status**: EXISTS
- **Actual**: `NotificationBell.tsx` with popover dropdown + `/notifications` page with 5 tabs (All/Unread/Tasks/Approvals/Operations)
- **Handles comparison**:
  - Approvals pending: EXISTS (notification type)
  - Blockers: EXISTS (notification type)
  - Due-soon tasks: EXISTS (notification type)
  - Dependency alerts: PARTIAL (via task blocking notifications)
  - Quest nearing completion: MISSING
- **Decision**: [x] KEEP — Works well. Quest-completion notification could be added as enhancement.

---

## Section 2: Global Shared Components

### Mission / Quest Layer

#### `MissionHeroCard`
- **Status**: PARTIAL
- **Actual**: `components/ops/missions/MissionCard.tsx` + `components/ops/boards/MissionCard.tsx`
- **Displays comparison**:
  - Mission title: EXISTS
  - Narrative: MISSING (description shown truncated, not narrative)
  - Phase: EXISTS (phase badge)
  - Progress: EXISTS (AnimatedCircularProgressBar)
  - Phase badge: EXISTS
  - Readiness impact summary: EXISTS (top 3 meters shown in board variant)
- **Extra**: Scope badge, quest count, avatar circles, start/end dates
- **Decision**: [x] KEEP — Close enough. "Narrative" is a naming difference — description serves same purpose.

#### `PhaseBadge`
- **Status**: MISSING as standalone component
- **Actual**: Phase values rendered as inline `<Badge>` in MissionCard (line ~66-70). Enum values correct: Setup, Foundation, Activation, Scale
- **Decision**: [x] SKIP — Inline badge rendering is fine. No need for standalone component extraction unless reuse grows.

#### `QuestSpotlightCard`
- **Status**: PARTIAL
- **Actual**: `components/ops/quests/QuestCard.tsx`
- **Displays comparison**:
  - Quest title: EXISTS
  - Narrative: MISSING
  - Owner: EXISTS (avatar + name)
  - Due date: MISSING in card (exists in detail page)
  - Progress %: EXISTS (core + adhoc progress bars)
  - Readiness contribution: MISSING
  - Success conditions: MISSING
  - Blockers count: MISSING
- **Decision**: [ ] IMPROVE — Add due date and blocker count to QuestCard. These are high-value at-a-glance fields. Readiness contribution and success conditions are better suited for detail page.

#### `QuestProgressBar`
- **Status**: PARTIAL
- **Actual**: `components/ops/quests/QuestProgress.tsx`
- **Shows**: Core task completion bar + Ad-hoc task completion bar + "Quest complete" state
- **Missing**: Evidence completion progress, approval completion progress (spec says tri-metric bar/ring)
- **Decision**: [ ] REVIEW — Evidence/approval completion would require backend aggregation changes. Worth evaluating if it adds clarity vs complexity.

### Task Layer

#### `TaskCard`
- **Status**: EXISTS (two variants)
- **Actual**: `TaskKanbanCard.tsx` (kanban) + `TaskListView.tsx` (table rows)
- **Displays comparison**:
  - Task title: EXISTS
  - Type badge (CORE/ADHOC/IMPROVEMENT): EXISTS
  - Domain badge (Food/Art/Lifestyle/System): MISSING in card (exists in detail page)
  - Owner: EXISTS
  - Status: EXISTS (border color coding)
  - XP: EXISTS
  - Readiness impact: EXISTS (badge if > 0)
  - Due date: EXISTS (with overdue indicator)
  - Dependency state: EXISTS (link indicator)
  - Approval required state: MISSING (field exists but not displayed)
- **Variants comparison**:
  - Compact: MISSING (no compact variant)
  - Kanban: EXISTS
  - Urgent: PARTIAL (critical priority badge, not distinct variant)
  - Validated: PARTIAL (green XP styling, not distinct variant)
  - Blocked: EXISTS (red border + blocked badge)
- **Decision**: [x] KEEP — Kanban card is comprehensive. Domain badge could be added but is low-value in a food-first system.

#### `TaskList`
- **Status**: EXISTS
- **Actual**: `TaskListView.tsx` — table format with sortable columns
- **Filters**: Text-based title search only
- **Missing filters**: Domain, type, status multi-select, owner, priority range, date range
- **Decision**: [ ] IMPROVE — Adding status and owner filters would be high-value. Full filter bar is medium priority.

#### `TaskKanbanBoard`
- **Status**: EXISTS
- **Actual**: `TaskKanban.tsx` with dnd-kit drag-and-drop
- **Columns**: To Do, Doing, Done, Blocked — all 4 present
- **Extra**: Drag prevention into Blocked column, count badges per column
- **Decision**: [x] KEEP — Fully matches spec.

#### `TaskFocusList`
- **Status**: PARTIAL
- **Actual**: `TodaysFocusSection.tsx`
- **Priority order**: Overdue > Due today > Quest-linked (sorted by priority: critical > high > medium > low)
- **Limit**: Top 5 items only (`.slice(0, 5)`)
- **Missing**: Spec says tabs for Core/Ad-hoc/Blocked — actual is a flat urgency-sorted list with no tabs
- **Missing**: Explicit "ad-hoc urgent" category separation
- **Decision**: [x] KEEP — Urgency-first flat list is cleaner than tabs for a small team. 5-item limit keeps dashboard focused.

#### `TaskDetailDrawer`
- **Status**: MISSING (uses full page instead)
- **Actual**: `/tasks/[id]/page.tsx` — full-page 2-column detail view
- **Contains**: Task metadata, linked mission/quest, evidence, approval status, notes, comments (partial), readiness effect (via readiness impact badge)
- **Decision**: [x] KEEP FULL PAGE — Full page gives more space for evidence uploads, metadata, and linked resources. Drawer would constrain this. No change needed.

### Evidence Layer

#### `EvidenceUploadPanel`
- **Status**: EXISTS
- **Actual**: `EvidenceUploadZone.tsx` + `NoteEvidenceForm.tsx` + `LinkEvidenceForm.tsx`
- **Supports comparison**:
  - Image: EXISTS (drag-drop upload)
  - Document: EXISTS (file upload)
  - Link: EXISTS (LinkEvidenceForm)
  - Video: PARTIAL (file upload accepts video but no special handling)
  - Note: EXISTS (NoteEvidenceForm)
- **Decision**: [x] KEEP — Covers all evidence types.

#### `EvidenceCard`
- **Status**: EXISTS
- **Actual**: `EvidenceFeedCard.tsx` + `EvidenceItem.tsx`
- **Displays comparison**:
  - Preview / thumbnail: EXISTS
  - Uploader: EXISTS
  - Type: EXISTS
  - Approval status: EXISTS
  - Timestamp: EXISTS
- **Decision**: [x] KEEP — Fully matches spec.

#### `EvidenceFeed`
- **Status**: EXISTS
- **Actual**: `/boards/evidence` page with cursor-based pagination
- **Shows**: Submissions with uploader, type, timestamp, approval status
- **Missing**: Explicit "approvals", "validations", "quest completions" as separate feed item types — feed is evidence-only
- **Decision**: [x] KEEP — Evidence-focused feed is correct. Activity feed (`ActivityFeedWidget`) covers the broader event stream.

#### `EvidenceReviewPanel`
- **Status**: EXISTS
- **Actual**: `ApprovalQueue.tsx` + `ApprovalItem.tsx` at `/approvals` page
- **Shows**: Evidence preview, linked task, uploader, approve/reject controls, rejection notes via `RejectionDialog`
- **Decision**: [x] KEEP — Approval workflow is complete.

### Governance Layer

#### `ApprovalQueueWidget`
- **Status**: EXISTS
- **Actual**: `AdminPendingApprovalsWidget.tsx` (dashboard widget) + `/approvals` page (full view)
- **Decision**: [x] KEEP

#### `BlockerAlertCard`
- **Status**: PARTIAL
- **Actual**: `AdminBlockersWidget.tsx` shows blocked tasks as a list (top 5, oldest first)
- **Displays comparison**:
  - Task title: EXISTS
  - Blocker reason: EXISTS (truncated at 60 chars)
  - Owner: MISSING (not displayed in widget)
  - Quest breadcrumb: EXISTS (quest context shown)
  - Age of blocker: MISSING (no explicit age/duration display)
- **Decision**: [ ] IMPROVE — Add owner and blocker age to the widget. Quest breadcrumb already present.

#### `DecisionCard`
- **Status**: EXISTS
- **Actual**: `components/ops/decisions/DecisionCard.tsx`
- **Displays comparison**:
  - Decision title: EXISTS
  - Decision type: EXISTS (via `DecisionTypeBadge`)
  - Context: EXISTS
  - Roles involved: PARTIAL (proposer shown, not all involved roles)
  - Status: EXISTS (via `DecisionStatusBadge`)
  - Linked mission / quest: PARTIAL (quest shown if linked)
- **Decision**: [x] KEEP — Works well for current governance flow.

#### `DecisionLogTable`
- **Status**: PARTIAL
- **Actual**: `DecisionList.tsx` — renders as card list, NOT a sortable table
- **Decision**: [ ] REVIEW — A table view with sorting/filtering would be better for governance audit. Low priority unless governance volume grows.

#### `ConsensusStatusPill`
- **Status**: MISSING
- **Actual**: `DecisionStatusBadge.tsx` shows: proposed, approved, rejected — but not "aligned", "partially approved"
- **Decision**: [x] SKIP — Current status values match the actual decision workflow. "Aligned" and "partially approved" are not in the data model.

### Readiness / KPI Layer

#### `ReadinessStrip`
- **Status**: EXISTS
- **Actual**: `DashboardReadinessStrip.tsx` — top-level condensed meter list on dashboard
- **Decision**: [x] KEEP

#### `ReadinessMeterCard`
- **Status**: EXISTS
- **Actual**: `ReadinessMeterRing.tsx` (mini & full variants) + `ReadinessGrid.tsx`
- **Displays comparison**:
  - Meter name: EXISTS
  - Current %: EXISTS (animated circular progress)
  - Target: EXISTS (implicit in color zones via `getMeterColors()`)
  - Insight label: EXISTS (in `DashboardReadinessStrip` via `getInsightLabel()` utility)
  - Delta/trend: MISSING (no week-over-week change indicator)
- **Extra**: Hover-to-reveal "View Tasks" button, color-coded progress zones
- **Decision**: [ ] IMPROVE — Delta/trend would add value but requires backend to track historical meter values.

#### `ReadinessRingGauge`
- **Status**: EXISTS
- **Actual**: `ReadinessMeterRing.tsx` — circular progress indicator with color zones
- **Decision**: [x] KEEP

#### `ReadinessBreakdownPanel`
- **Status**: PARTIAL
- **Actual**: `MeterDetailPanel.tsx` exists — shows contributing tasks with owner and XP earned
- **Working**: Task list drill-down per meter, uses `/readiness-meters/:id/tasks` endpoint
- **Missing**: Quest/mission breadcrumb context per task, quest-level contribution summary
- **Decision**: [ ] IMPROVE — Add quest breadcrumb to contributing tasks. Core functionality already works.

#### `KpiCard`
- **Status**: EXISTS
- **Actual**: `components/ops/kpis/KpiCard.tsx`
- **Displays comparison**:
  - KPI name: EXISTS
  - Target: EXISTS
  - Current: EXISTS (with unit display)
  - Status: EXISTS (on_track/at_risk/off_track via KpiStatusBadge)
  - Delta: EXISTS (current vs target comparison)
  - Linked quest/task count: EXISTS
- **Extra**: Pulsating edit button for at-risk/off-track KPIs
- **Decision**: [x] KEEP — Fully matches spec. All fields present.

#### `InsightLabel`
- **Status**: EXISTS (inline utility)
- **Actual**: Implemented as `getInsightLabel()` function in `DashboardReadinessStrip.tsx` (lines 13-19)
- **Values**: "Needs urgent attention" (<30%), "Falling behind" (<50%), "Room to improve" (<70%), "On track" (>=70%)
- **Spec vs actual**: Spec says "Ready to unlock" — actual uses "Room to improve" instead. Minor wording difference.
- **Scope**: Shown in ReadinessStrip on dashboard, NOT on individual ReadinessMeterRing components
- **Decision**: [x] KEEP — Already implemented. Wording difference is cosmetic.

### Team / Gamification Layer

#### `RoleContributionCard`
- **Status**: PARTIAL
- **Actual**: `TeamContributionWidget.tsx` (dashboard) + `/team-contribution` page both show per-role data inline: tasks completed, tasks validated, blocked count, readiness delta. Not a standalone card component but same data.
- **Displays comparison**:
  - Role name: EXISTS
  - Active tasks: PARTIAL (shows "completed" not "active")
  - Valid tasks: EXISTS (tasks validated count)
  - Readiness contribution: EXISTS (readiness delta per meter)
  - Blockers: EXISTS (blocked count with badge)
  - XP total: MISSING
- **Decision**: [x] KEEP — Data is already rendered. `/team-contribution` page just needs sidebar link. XP per role is a nice-to-have.

#### `LeaderboardWidget`
- **Status**: EXISTS
- **Actual**: `LeaderboardTable.tsx` + `LeaderboardPodium.tsx` at `/leaderboard` + `DashboardLeaderboardPreview.tsx` on dashboard
- **Decision**: [x] KEEP

#### `XpLevelBadge`
- **Status**: EXISTS
- **Actual**: `LevelBadge.tsx` (glow effect) + `XpProgressBar.tsx` (progress to next level) — shown in sidebar user area
- **Decision**: [x] KEEP

#### `StreakIndicator`
- **Status**: MISSING
- **Actual**: Streak data tracked in backend (`User.current_streak`, `User.longest_streak`) but no frontend indicator
- **Decision**: [ ] REVIEW — Data exists in backend. Could be added to sidebar user area or dashboard. Low priority.

### Utilities

#### `DomainBadge`
- **Status**: MISSING as standalone
- **Actual**: Domain values (Food/Art/Lifestyle/System) exist in task model. Displayed on task detail page as text, not a dedicated badge component.
- **Decision**: [x] SKIP — Inline rendering is sufficient. The system is food-first; most tasks are Food domain.

#### `TaskTypeBadge`
- **Status**: PARTIAL
- **Actual**: `getTaskTypeBadge()` in `status-styles.ts`. Ad-hoc (amber) and Improvement (blue) get badges. **Core tasks get NO badge** (returns empty string).
- **Rendered inline** in `TaskKanbanCard.tsx` and `TaskListView.tsx`. Not a standalone component.
- **Decision**: [x] SKIP — Inline rendering works. Core getting no badge is intentional (core is the default/expected type).

#### `StatusBadge`
- **Status**: EXISTS
- **Actual**: Various status badge utilities across the codebase:
  - Task: `getTaskStatusBadge()` — To Do, Doing (blue), Done (green), Blocked (red), Cancelled
  - Evidence: `getEvidenceStatusBadge()` — Pending (amber), Approved (green), Rejected (red)
  - KPI: `KpiStatusBadge` — On Track (green), At Risk (amber), Off Track (red)
- **Spec vs actual discrepancy**: Spec lists "Under Review" and "Validated" as status values — these are NOT task statuses. Tasks use todo/doing/done/blocked/cancelled. "Validated" is a boolean (`task.valid`), not a status. "Under Review" does not exist.
- **Extra**: "Cancelled" exists in actual but not in spec
- **Decision**: [x] KEEP — Status values match actual workflow. Spec was aspirational with "Under Review"/"Validated" as statuses.

#### `BreadcrumbContext`
- **Status**: EXISTS
- **Actual**: Task detail page (`/tasks/[id]`) renders full **Mission → Quest → Task** breadcrumb chain as semantic `<nav><ol>` with ChevronRight separators (lines 172-193). Mission and Quest are clickable links. Falls back to simple "Back" arrow if quest/mission chain is missing.
- Quest detail page (`/quests/[id]`) has breadcrumb link back to parent Mission.
- **Not universal**: Only renders when the task has a `quest_id` AND that quest has a `mission`. Not a shared reusable component — implemented inline per page.
- **Decision**: [x] KEEP — Breadcrumb chain works where it matters most (task + quest detail). Could be extracted into shared component for reuse, but low priority.

#### `EmptyStateCard`
- **Status**: MISSING as reusable component
- **Actual**: Empty states exist per page but as inline JSX, not a shared component.
- **Decision**: [x] SKIP — Inline empty states are fine. Extracting a shared component adds abstraction without clear benefit.

---

## Section 3: Page-Level Component Map

### 3.1 Mission Control Page (`MissionControlPage`)
- **Status**: EXISTS
- **Actual**: `/dashboard` page with admin and role variants
- **Components comparison**:
  - MissionHeroCard: EXISTS as `MissionContextStrip`
  - QuestSpotlightCard: EXISTS (active quest shown in role dashboard)
  - ReadinessStrip: EXISTS as `DashboardReadinessStrip`
  - TodayExecutionPanel: PARTIAL as `TodaysFocusSection` — spec says tabs (Core/Ad-hoc/Blocked), actual is flat urgency-sorted top-5 list with no tabs
  - ApprovalsSummaryWidget: EXISTS as `AdminPendingApprovalsWidget`
  - BlockersSummaryWidget: EXISTS as `AdminBlockersWidget`
  - TeamContributionGrid: EXISTS as `TeamContributionWidget`
  - ActivityFeed: EXISTS as `ActivityFeedWidget`
  - LeaderboardWidget: EXISTS as `DashboardLeaderboardPreview`
- **Decision**: [x] KEEP — Well-covered. The flat focus list is actually cleaner than tabs for a small team.

### 3.2 Missions Page
- **Status**: PARTIAL
- **`MissionListPage`**:
  - MissionFilterBar: MISSING
  - MissionGrid: EXISTS (card grid)
  - MissionHeroCard[]: EXISTS
- **`MissionDetailPage`**:
  - MissionHeroCard: EXISTS
  - QuestTimeline: MISSING
  - MissionReadinessContributionPanel: MISSING
  - MissionTasksTable: PARTIAL (tasks accessible via quests, not direct table)
  - MissionDecisionFeed: MISSING
- **Decision**: [ ] IMPROVE — Mission detail page could be enriched with quest timeline and readiness contribution. Filter bar on list page is medium priority.

### 3.3 Quests Page
- **Status**: PARTIAL
- **`QuestBoardPage`**:
  - QuestFilterBar: EXISTS — Mission filter + Assignee filter dropdowns
  - QuestGrid: EXISTS (kanban board at `/boards/quests` with Not Started / In Progress / Completed columns)
  - QuestSpotlightCard[]: EXISTS
- **`QuestDetailPage`** (`/quests/[id]`):
  - QuestSpotlightCard: EXISTS
  - QuestNarrativePanel: MISSING
  - QuestSuccessConditions: MISSING
  - QuestTaskBoard: EXISTS (task kanban/list within quest)
  - QuestBlockersPanel: MISSING
  - QuestEvidenceSummary: MISSING
  - QuestReadinessImpactPanel: MISSING
  - QuestCloseoutPanel: MISSING
- **Decision**: [ ] IMPROVE — Quest detail page has the most gaps. Success conditions, blockers panel, and evidence summary would add significant value. These are data-available improvements.

### 3.4 Tasks Page
- **Status**: MISSING as standalone
- **Actual**: No standalone `/tasks` page. Tasks live under quests at `/quests/[id]` with TaskKanban + TaskListView
- **Spec components**:
  - TaskFilterBar: MISSING
  - TaskKanbanBoard: EXISTS (under quest)
  - TaskListToggle: EXISTS (under quest)
  - TaskDetailDrawer: MISSING (full page instead)
- **Decision**: [ ] ADD — A standalone "My Tasks" page showing all tasks assigned to the user across all quests/missions would be very high value. This is the #1 gap.

### 3.5 Readiness Page
- **Status**: PARTIAL
- **Actual**: `/readiness` page exists
- **Components comparison**:
  - ReadinessOverviewGrid: EXISTS (`ReadinessGrid`)
  - ReadinessMeterCard[]: EXISTS (`ReadinessMeterRing`)
  - ReadinessTrendChart: MISSING
  - ReadinessBreakdownPanel: PARTIAL (`MeterDetailPanel` exists — shows contributing tasks with owner/XP, but missing quest breadcrumb per task)
  - QuestContributionTable: MISSING
- **Decision**: [ ] IMPROVE — Trend chart and breakdown panel would make readiness actionable instead of just a snapshot.

### 3.6 Governance Page
- **Status**: MISSING as unified page
- **Actual**: Split into `/approvals` and `/decisions` as separate pages
- **Spec components**:
  - ApprovalQueueWidget: EXISTS at `/approvals`
  - DecisionLogTable: EXISTS at `/decisions` (card list, not table)
  - BlockerBoard: MISSING (admin widget only)
  - ConsensusStatusPanel: MISSING
- **Decision**: [ ] REVIEW — Evaluate if a unified `/governance` page combining approvals + decisions + blockers would improve workflow for leads. Current split works but fragments governance oversight.

### 3.7 Evidence Page
- **Status**: PARTIAL
- **Actual**: `/boards/evidence` exists as feed view with cursor-based pagination
- **Spec components**:
  - EvidenceFeed: EXISTS
  - EvidenceFilterBar: PARTIAL — status filter buttons exist (all/pending/approved/rejected) but no date/type/uploader filters
  - EvidenceGrid: MISSING (feed only, no grid/gallery view)
  - EvidenceReviewPanel: EXISTS at `/approvals` (separate page)
- **Decision**: [ ] REVIEW — Basic status filtering works. Additional filters (type, uploader, date range) could help at scale. Grid view is low priority.

### 3.8 Team Page
- **Status**: PARTIAL
- **Actual**: `/team-contribution` page exists but is NOT linked in main sidebar. Shows per-role cards with tasks completed/validated/blocked + readiness delta, with scope selector (this week/month/mission). Admin dashboard also has `TeamContributionWidget`.
- **Spec components**:
  - RoleContributionGrid: PARTIAL (`/team-contribution` page shows role cards, not grid layout)
  - LeaderboardWidget: EXISTS at `/leaderboard` (separate page)
  - TeamCapacityPanel: MISSING
  - RoleAssignmentTable: MISSING (user management at `/admin/users` is different purpose)
- **Decision**: [ ] IMPROVE — Page exists but is hidden. Add sidebar link. Consider consolidating with leaderboard into a unified team view.

### 3.9 Operations Pages
- **Status**: EXISTS
- **`IngredientsPage`**:
  - IngredientTable: EXISTS
  - IngredientDetailDrawer: PARTIAL (inline form, not drawer)
  - LinkedTasksPanel: MISSING
  - UsageContextPanel: MISSING
- **`PurchaseOrdersPage`**:
  - PurchaseOrderTable: EXISTS
  - PurchaseOrderDetail: EXISTS
  - LinkedQuestPanel: MISSING
  - ProcurementImpactCard: MISSING
- **Decision**: [x] KEEP — Operations pages are functional. LinkedTasks/Quest panels are nice-to-have but low priority.

### 3.10 Experience Page
- **Status**: MISSING (deliberately deferred)
- **Actual**: No `/experience` page. No `/art` or `/lifestyle` routes.
- **Decision**: [x] DEFERRED — App is food-first by design. Art, Lifestyle, and Experience layers were deliberately deferred to a future phase. These will be built when the villa expands beyond food operations.

---

## Section 4: Role-Specific Dashboard Variants

### Overall Assessment
- **Spec**: 7 role dashboards (Frontend, Backend, Procurement, BI, Talent, Tech, Design/Outreach)
- **Actual**: 2 dashboard variants — Admin (comprehensive) + Generic Role (same layout, different readiness meters)
- **Gap**: All non-admin roles share one dashboard template with role-filtered readiness meters

| Dashboard | Status | Notes |
|---|---|---|
| FrontendDashboard | PARTIAL | Gets generic role dashboard with Frontend/Service meters |
| BackendDashboard | PARTIAL | Gets generic role dashboard with Backend/Food/Standardization meters |
| ProcurementDashboard | PARTIAL | Gets generic role dashboard with Procurement/Supply meters |
| BiDashboard | PARTIAL | Gets generic role dashboard with BI/Finance meters |
| TalentDashboard | PARTIAL | Gets generic role dashboard with Talent/Hiring meters |
| TechDashboard | PARTIAL | Gets generic role dashboard with Tech/Systems meters |
| DesignOutreachDashboard | PARTIAL | Gets generic role dashboard with Design/Outreach/Brand meters |

- **Decision**: [ ] IMPROVE — The generic role dashboard already has Today's Focus, My Tasks, Active Quest, XP Progress, and role-relevant readiness meters. Adding 1-2 role-specific widgets per role (e.g., LowStockPanel for Procurement, KPI alerts for BI) would meaningfully improve each dashboard without building 7 separate pages.

---

## Section 5: Component Hierarchy

- **Status**: PARTIAL
- **Actual tree** matches structure but with different naming:
  ```
  (ops)/layout.tsx          ← AppShell
  ├── Sidebar.tsx           ← AdaptiveSidebar (contains theme, notifications, user)
  ├── MainContentArea       ← via layout CSS grid
  │   ├── /dashboard        ← MissionControlPage
  │   ├── /missions         ← MissionsPage
  │   ├── /boards/quests    ← QuestsPage
  │   ├── /quests/[id]      ← QuestDetailPage
  │   ├── /tasks/[id]       ← TaskDetailPage (no standalone tasks page)
  │   ├── /readiness        ← ReadinessPage
  │   ├── /approvals        ← GovernancePage (partial)
  │   ├── /decisions        ← GovernancePage (partial)
  │   ├── /boards/evidence  ← EvidencePage
  │   ├── /leaderboard      ← TeamPage (partial)
  │   └── /operations/*     ← OperationsPages
  └── (no QuickActionDock)
  ```
- **Decision**: [x] KEEP — Hierarchy is sound. Naming differences are cosmetic.

---

## Section 6: Data Binding Map

### `MissionHeroCard` bindings
- `mission.title`: EXISTS
- `mission.phase`: EXISTS
- `mission.progress_percent`: EXISTS
- `mission.description`: EXISTS (spec says "narrative" — same field)
- **Decision**: [x] KEEP

### `QuestSpotlightCard` bindings
- `quest.title`: EXISTS
- `quest.narrative`: Field is `quest.description` in actual data model (not "narrative"). EXISTS in data but NOT displayed in QuestCard
- `quest.owner`: EXISTS
- `quest.progress_percent`: EXISTS
- `quest.readiness_targets`: MISSING (not in data model)
- `quest.end_date`: EXISTS in data, MISSING in card display
- **Decision**: [ ] IMPROVE — Add end_date and description to QuestCard display

### `TaskCard` bindings
- `task.title`: EXISTS
- `task.task_type`: EXISTS
- `task.domain`: EXISTS in data, MISSING in card display
- `task.status`: EXISTS
- `task.priority`: EXISTS
- `task.xp`: EXISTS
- `task.valid`: EXISTS (green XP styling when validated)
- `task.requires_approval`: EXISTS in data, MISSING in card display
- `task.due_date`: EXISTS
- **Decision**: [x] KEEP — All data fields available. Display choices are intentional.

### `ReadinessMeterCard` bindings
- `meter.name`: EXISTS
- `meter.current_value`: EXISTS
- `meter.target_value`: EXISTS
- `meter.insight_label`: PARTIAL — computed by `getInsightLabel()` and shown in `DashboardReadinessStrip`, but NOT displayed on individual `ReadinessMeterRing` components
- **Decision**: [x] KEEP — Insight label exists in strip context. Adding it to individual rings would be nice but not required.

### `DecisionCard` bindings
- `decision.title`: EXISTS
- `decision.decision_type`: EXISTS
- `decision.status`: EXISTS
- `decision.context`: EXISTS
- **Decision**: [x] KEEP

---

## Section 7: Implementation Strategy

- **Phase 1 (Reusable primitives)**: DONE — badges, cards, tables, filters, drawers, feed items, gauges all exist
- **Phase 2 (Page composites)**: MOSTLY DONE — Mission Control, Quests, Tasks (under quest), Readiness, Governance (split)
- **Phase 3 (Role-composed dashboards)**: PARTIAL — Generic role dashboard exists but not role-composed

---

## Section 8: Design Principles

Each component should answer one of:
- **What are we building?** → Mission/Quest views: EXISTS
- **What should I do now?** → TodaysFocusSection + task views: EXISTS
- **What is blocked?** → BlockersWidget + blocker states: EXISTS
- **What needs approval?** → ApprovalsWidget + approval queue: EXISTS
- **How is the system progressing?** → Readiness meters + KPIs: EXISTS

**Verdict**: Core design principles are well-served.

---

## Priority Summary

### HIGH (Should Do)
1. **Standalone "My Tasks" page** — CONFIRMED GAP. Dashboard shows max 8 tasks in widget. No full `/tasks` page exists. Users with many tasks can't see them all or filter/sort.
2. **"My Quests" sidebar shortcut** — PARTIALLY EXISTS. Quest Board has assignee dropdown filter. Dashboard shows Active Quest. But no dedicated "My Quests" sidebar link that auto-filters. Could be as simple as adding a nav link with `?assignee=me`.
3. **Quest detail enrichment** — CONFIRMED GAP. Quest detail page shows title/progress/tasks but skips description (field exists, not rendered), has no success conditions (not in data model), no blockers panel, no evidence summary.
4. **Readiness breakdown quest context** — CONFIRMED GAP. MeterDetailPanel shows task title + owner + XP but task.quest is not populated in the response. Backend endpoint would need to include quest relation.

### MEDIUM (Nice to Have)
5. **Readiness trend chart** — CONFIRMED GAP. No backend history endpoint exists (`/readiness-meters` returns current values only). No frontend chart component. Would require: backend history table/snapshots + frontend chart (Recharts etc).
6. **BlockerAlertCard improvement** — PARTIAL GAP. Full `/admin/blockers` page already shows owner + "blocked since" age. The dashboard *widget* (`AdminBlockersWidget`) is missing owner and age — just needs its interface updated to match the full page.
7. **Mission detail enrichment** — CONFIRMED GAP. Mission detail shows header + description + dates + quest list (as cards). No quest timeline visualization, no readiness contribution per quest, no linked decisions. Backend doesn't fetch decisions for mission.
8. **Role-specific dashboard widgets** — PARTIAL GAP. Role-filtered readiness meters work. KPI alerts + low stock shown in shared "Team Alerts" section for ALL roles. But no unique widgets per role (e.g., Procurement doesn't get a dedicated low-stock widget, BI doesn't get a dedicated KPI widget). Data is available but not role-branched.
9. **Task filter bar** — CONFIRMED GAP. TaskListView has text search + column sorting only. TaskKanban has no filters. No TaskFilterBar component exists. No status/owner/priority dropdowns.
10. **QuestCard improvement** — CONFIRMED GAP. `quest.end_date` field exists in type but is never rendered in QuestCard. Blocked task count not calculated or displayed.
11. **Evidence feed filters** — CONFIRMED GAP. Only status filter buttons (all/pending/approved/rejected) exist. No type filter (photo/doc/video/link/note), no uploader filter, no date range picker. All filter fields exist in the data model but have no UI.

### LOW (Skip for Now)
12. **TopHeader persistent bar** — VERIFIED MISSING on desktop. Mobile has a minimal header (menu/logo/toggler). Desktop only has sidebar, no top bar above content.
13. **QuickActionDock floating UI** — VERIFIED MISSING. No floating FAB/speed-dial anywhere. Only non-floating ad-hoc task button in sidebar.
14. **Team page** — PARTIALLY EXISTS. `/team-contribution` page exists showing per-role cards (tasks completed, validated, blocked, readiness delta) with scope selector (this week/month/mission). BUT not linked in main sidebar navigation — hidden page. Sidebar "Team" link goes to `/admin/users` (different purpose).
15. **Unified governance page** — VERIFIED MISSING. `/approvals`, `/decisions`, `/admin/blockers` are separate routes with zero cross-linking. Admin dashboard shows them as separate widgets.
16. **Evidence grid view** — VERIFIED MISSING. Pure vertical feed with horizontal cards only. No feed/grid toggle.
17. **DecisionLogTable** — VERIFIED MISSING as table. Renders as `AnimatedList` of `DecisionCard` components. Has status filter tabs (All/Proposed/Approved/Rejected) + title search, but no column sorting, no table headers, no pagination.
18. **StreakIndicator** — VERIFIED MISSING. No "streak" references anywhere in frontend. Frontend user type has no streak fields. Backend may track it but frontend doesn't consume or display it.
19. **RoleContributionCard** — PARTIALLY EXISTS as inline data in `TeamContributionWidget` and `/team-contribution` page. Shows per role: tasks completed, tasks validated, blocked count, readiness delta. Missing: XP total per role. Not a standalone card component.
20. **QuestProgressBar tri-metric** — VERIFIED MISSING. Only 2 metrics (core + ad-hoc task %). No evidence count or approval completion at quest level. Evidence is task-level only, not aggregated to quest.
21. **Experience page** — DELIBERATELY DEFERRED. App is food-first. Art/Lifestyle/Experience layers planned for future phase when villa expands beyond food operations.

### ALREADY COVERED (No Action Needed)
- BreadcrumbContext — EXISTS on task detail (Mission → Quest → Task) and quest detail (→ Mission)
- InsightLabel — EXISTS as `getInsightLabel()` utility in ReadinessStrip
- KpiCard — All spec fields present including linked task count
- EvidenceUploadPanel — All 5 evidence types supported
- TaskKanbanBoard — All 4 columns, drag-and-drop, blocked prevention
- StatusBadge — Full coverage via utility functions (note: "Under Review"/"Validated" are not actual task statuses)
