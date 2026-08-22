# Frontend Component Map

---

# Konma Xperience OS

### 1. App shell

These components frame the whole product.

### `AppShell`

Wraps all authenticated views.

Contains:

- `TopHeader`
- `AdaptiveSidebar`
- `MainContentArea`
- `QuickActionDock`
- `GlobalNotificationTray`

### `TopHeader`

Displays:

- current mission
- current phase
- current weekly quest
- search
- notification bell
- theme toggle
- user avatar / role badge

### `AdaptiveSidebar`

Role-aware navigation.

Core items:

- Mission Control
- My Quests
- My Tasks
- Readiness
- Evidence
- Governance
- Team

Role-scoped items:

- Product Lab
- Service Ops
- Procurement
- KPI Center
- System Console
- Experience Layer
- Outreach
- Talent Readiness

### `QuickActionDock`

Floating or footer-level quick actions:

- create ad-hoc task
- upload evidence
- log blocker
- create decision note

### `GlobalNotificationTray`

Handles:

- approvals pending
- blockers
- due-soon tasks
- dependency alerts
- quest nearing completion

### 2. Global shared components

These are reusable across pages.

## Mission / quest layer

### `MissionHeroCard`

Displays:

- mission title
- narrative
- phase
- progress
- phase badge
- readiness impact summary

### `PhaseBadge`

Values:

- Setup
- Foundation
- Activation
- Scale

### `QuestSpotlightCard`

Displays:

- quest title
- narrative
- owner
- due date
- progress %
- readiness contribution
- success conditions
- blockers count

### `QuestProgressBar`

Visual bar or ring for:

- task completion
- evidence completion
- approval completion

## Task layer

### `TaskCard`

Core object in most views.

Displays:

- task title
- type badge (`CORE`, `ADHOC`, `IMPROVEMENT`)
- domain badge (`Food`, `Art`, `Lifestyle`, `System`)
- owner
- status
- XP
- readiness impact
- due date
- dependency state
- approval required state

Variants:

- compact
- kanban
- urgent
- validated
- blocked

### `TaskList`

Renders multiple task cards with filters.

### `TaskKanbanBoard`

Columns:

- To Do
- Doing
- Done
- Blocked

### `TaskFocusList`

Urgency-first list:

- overdue
- due today
- quest-linked
- ad-hoc urgent

### `TaskDetailDrawer`

Opens task details without full page nav.

Contains:

- task metadata
- linked mission / quest
- evidence
- approval status
- notes
- comments
- readiness effect

#### Evidence layer

### `EvidenceUploadPanel`

Supports:

- image
- document
- link
- video
- note

### `EvidenceCard`

Displays:

- preview / thumbnail
- uploader
- type
- approval status
- timestamp

### `EvidenceFeed`

Chronological stream of:

- submissions
- approvals
- validations
- quest completions

### `EvidenceReviewPanel`

For approvers.

Displays:

- evidence preview
- linked task
- uploader
- approve / reject controls
- notes

#### Governance layer

### `ApprovalQueueWidget`

Shows pending approvals.

### `BlockerAlertCard`

Displays:

- task title
- blocker reason
- owner
- quest breadcrumb
- age of blocker

### `DecisionCard`

Displays:

- decision title
- decision type
- context
- roles involved
- status
- linked mission / quest

### `DecisionLogTable`

Sortable table for governance history.

### `ConsensusStatusPill`

Shows:

- pending
- aligned
- partially approved
- approved
- rejected

#### Readiness / KPI layer

### `ReadinessStrip`

Top-level condensed list of meters.

### `ReadinessMeterCard`

Displays:

- meter name
- current %
- target
- insight label
- delta/trend

### `ReadinessRingGauge`

Useful for homepage and summary areas.

### `ReadinessBreakdownPanel`

Shows contributing tasks and quests.

### `KpiCard`

Displays:

- KPI name
- target
- current
- status
- delta
- linked quest/task count

### `InsightLabel`

Examples:

- Needs urgent attention
- Falling behind
- On track
- Ready to unlock

#### Team / gamification layer

### `RoleContributionCard`

Displays:

- role name
- active tasks
- valid tasks
- readiness contribution
- blockers
- XP total

### `LeaderboardWidget`

Top performers by XP / contribution.

### `XpLevelBadge`

Displays:

- XP
- level
- progress to next level

### `StreakIndicator`

Shows current streak status.

#### Utilities

### `DomainBadge`

Values:

- Food
- Art
- Lifestyle
- System

### `TaskTypeBadge`

Values:

- Core
- Ad-hoc
- Improvement

### `StatusBadge`

Values:

- To Do
- Doing
- Done
- Blocked
- Under Review
- Validated

### `BreadcrumbContext`

Shows:

Mission → Quest → Task

### `EmptyStateCard`

Custom empty states per module.

### 3. Page-level component map

#### 3.1 Mission Control page

### `MissionControlPage`

Composed of:

- `MissionHeroCard`
- `QuestSpotlightCard`
- `ReadinessStrip`
- `TodayExecutionPanel`
- `ApprovalsSummaryWidget`
- `BlockersSummaryWidget`
- `TeamContributionGrid`
- `ActivityFeed`
- `LeaderboardWidget`

### `TodayExecutionPanel`

Contains:

- `TaskFocusList`
- tabs for:
    - Core
    - Ad-hoc
    - Blocked

#### 3.2 Missions page

### `MissionListPage`

Components:

- `MissionFilterBar`
- `MissionGrid`
- `MissionHeroCard[]`

### `MissionDetailPage`

Components:

- `MissionHeroCard`
- `QuestTimeline`
- `MissionReadinessContributionPanel`
- `MissionTasksTable`
- `MissionDecisionFeed`

#### 3.3 Quests page

### `QuestBoardPage`

Components:

- `QuestFilterBar`
- `QuestGrid`
- `QuestSpotlightCard[]`

### `QuestDetailPage`

Components:

- `QuestSpotlightCard`
- `QuestNarrativePanel`
- `QuestSuccessConditions`
- `QuestTaskBoard`
- `QuestBlockersPanel`
- `QuestEvidenceSummary`
- `QuestReadinessImpactPanel`
- `QuestCloseoutPanel`

#### 3.4 Tasks page

### `TasksPage`

Components:

- `TaskFilterBar`
- `TaskKanbanBoard`
- `TaskListToggle`
- `TaskDetailDrawer`

#### 3.5 Readiness page

### `ReadinessPage`

Components:

- `ReadinessOverviewGrid`
- `ReadinessMeterCard[]`
- `ReadinessTrendChart`
- `ReadinessBreakdownPanel`
- `QuestContributionTable`

#### 3.6 Governance page

### `GovernancePage`

Components:

- `ApprovalQueueWidget`
- `DecisionLogTable`
- `BlockerBoard`
- `ConsensusStatusPanel`

#### 3.7 Evidence page

### `EvidencePage`

Components:

- `EvidenceFeed`
- `EvidenceFilterBar`
- `EvidenceGrid`
- `EvidenceReviewPanel`

#### 3.8 Team page

### `TeamPage`

Components:

- `RoleContributionGrid`
- `LeaderboardWidget`
- `TeamCapacityPanel`
- `RoleAssignmentTable`

#### 3.9 Operations pages

### `IngredientsPage`

Components:

- `IngredientTable`
- `IngredientDetailDrawer`
- `LinkedTasksPanel`
- `UsageContextPanel`

### `PurchaseOrdersPage`

Components:

- `PurchaseOrderTable`
- `PurchaseOrderDetail`
- `LinkedQuestPanel`
- `ProcurementImpactCard`

#### 3.10 Experience page

### `ExperiencePage`

Components:

- `ExperienceLayerOverview`
- `ArtQuestPanel`
- `LifestyleQuestPanel`
- `EventTaskBoard`
- `ExperienceReadinessPanel`

### 4. Role-specific dashboard variants

Instead of building separate products, compose role dashboards from shared modules.

#### Frontend / Experience role dashboard

### `FrontendDashboard`

- `QuestSpotlightCard`
- `TaskFocusList`
- `FrontendReadinessCard`
- `ServiceBlockersPanel`
- `ApprovalQueueWidget`
- `ChannelActivationPanel`

#### Backend / Product role dashboard

### `BackendDashboard`

- `QuestSpotlightCard`
- `TaskFocusList`
- `BackendReadinessCard`
- `ProductExperimentPanel`
- `EvidenceUploadPanel`
- `StandardizationQueue`

#### Procurement dashboard

### `ProcurementDashboard`

- `TaskFocusList`
- `ProcurementReadinessCard`
- `VendorAlertsPanel`
- `LowStockPanel`
- `PurchaseOrderTable`

#### BI dashboard

### `BiDashboard`

- `KpiGrid`
- `QuestPerformancePanel`
- `CostAlertsPanel`
- `ReadinessDeltaPanel`
- `DecisionSupportPanel`

#### Talent dashboard

### `TalentDashboard`

- `TaskFocusList`
- `TalentReadinessCard`
- `OnboardingStatusPanel`
- `TrainingQueue`
- `CapacityAlertsPanel`

#### Tech dashboard

### `TechDashboard`

- `SystemHealthPanel`
- `AutomationAlertsPanel`
- `TaskFocusList`
- `ReadinessSystemPanel`
- `PermissionAlertsPanel`

#### Design / Outreach dashboard

### `DesignOutreachDashboard`

- `QuestSpotlightCard`
- `ExperienceReadinessCard`
- `DesignTaskBoard`
- `OutreachPipelinePanel`
- `AssetReviewPanel`

### 5. Component hierarchy

A useful tree for implementation:

```
AppShell
├── TopHeader
├── AdaptiveSidebar
├── MainContentArea
│   ├── MissionControlPage
│   │   ├── MissionHeroCard
│   │   ├── QuestSpotlightCard
│   │   ├── ReadinessStrip
│   │   ├── TodayExecutionPanel
│   │   │   └── TaskFocusList
│   │   ├── ApprovalsSummaryWidget
│   │   ├── BlockersSummaryWidget
│   │   ├── TeamContributionGrid
│   │   └── ActivityFeed
│   ├── MissionsPage
│   ├── QuestsPage
│   ├── TasksPage
│   ├── ReadinessPage
│   ├── GovernancePage
│   ├── EvidencePage
│   ├── TeamPage
│   ├── OperationsPages
│   └── ExperiencePage
└── QuickActionDock
```

### 6. Data binding map

#### MissionHeroCard

Consumes:

- `mission.title`
- `mission.phase`
- `mission.progress_percent`
- `mission.description`

#### QuestSpotlightCard

Consumes:

- `quest.title`
- `quest.narrative`
- `quest.owner`
- `quest.progress_percent`
- `quest.readiness_targets`
- `quest.end_date`

#### TaskCard

Consumes:

- `task.title`
- `task.task_type`
- `task.domain`
- `task.status`
- `task.priority`
- `task.xp`
- `task.valid`
- `task.requires_approval`
- `task.due_date`

#### ReadinessMeterCard

Consumes:

- `meter.name`
- `meter.current_value`
- `meter.target_value`
- `meter.insight_label`

#### DecisionCard

Consumes:

- `decision.title`
- `decision.decision_type`
- `decision.status`
- `decision.context`

### 7. Recommended implementation strategy

#### Phase 1

Build reusable primitives:

- badges
- cards
- tables
- filters
- drawers
- feed items
- gauges

#### Phase 2

Build page composites:

- Mission Control
- Quests
- Tasks
- Readiness
- Governance

#### Phase 3

Build role-composed dashboards from the same primitives.

This keeps the UI consistent and prevents per-role duplication.

### 8. Final design principle

Every component should answer one of these:

- **What are we building?**
- **What should I do now?**
- **What is blocked?**
- **What needs approval?**
- **How is the system progressing?**