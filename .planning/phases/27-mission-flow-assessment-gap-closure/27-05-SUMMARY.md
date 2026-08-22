---
phase: 27-mission-flow-assessment-gap-closure
plan: 05
subsystem: frontend
tags: [activity-feed, team-contribution, purchase-orders, visual-verification]

# Dependency graph
requires:
  - plan: 27-03
    provides: Task UX enhancements (badges, columns, breadcrumbs, toast, linked resources)
  - plan: 27-04
    provides: Dashboard widgets (ActivityFeedWidget, TeamContributionWidget, TodaysFocusSection)
provides:
  - /activity full page with 168h lookback, event type badges, timestamps
  - /team-contribution detail page with per-role breakdown and week/month/mission scope selector
  - PO form "Link to Task" optional dropdown
  - Visual verification of all 14 Phase 27 deliverables
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [full-page-from-widget-link, scope-selector-reuse]

key-files:
  created:
    - frontend/app/(ops)/activity/page.tsx
    - frontend/app/(ops)/team-contribution/page.tsx
  modified:
    - frontend/app/(ops)/operations/purchase-orders/new/page.tsx
---

# Plan 27-05 Summary

## One-liner

Full /activity and /team-contribution pages linked from dashboard widgets, PO form "Link to Task" dropdown, and visual verification of all 14 Phase 27 deliverables.

## What was built

### Task 1: Pages + PO dropdown
- `/activity` page: full activity feed with 168h lookback (7 days), event type badges (validation/readiness/quest_complete/blocker_resolved), color-coded icons, relative + absolute timestamps, loading skeletons, empty state
- `/team-contribution` page: per-role breakdown with scope selector (week/month/mission), tasks completed, tasks validated, blocked count, readiness delta per meter, loading skeletons, empty state
- PO form: optional "Link to Task" dropdown added to purchase order create/edit form

### Task 2: Visual verification checkpoint (APPROVED)
All 14 deliverables confirmed working:
1. GET /missions/mission-control aggregation endpoint
2. GET /activity feed endpoint (48h lookback)
3. GET /activity/contributions team breakdown
4. PurchaseOrder linked_task_id FK migration
5. Task includes extended with quest.mission + readiness_meter
6. TaskKanbanCard readiness badge shows "+N MetricName"
7. TaskListView has Quest and Mission columns
8. Task detail page has Mission > Quest > Task breadcrumb chain
9. Task validation toast includes readiness impact
10. Task detail page shows Linked Resources (POs + Assets)
11. Admin dashboard: ActivityFeedWidget + TeamContributionWidget
12. Non-admin dashboard: TodaysFocusSection above My Tasks
13. /activity full page + /team-contribution detail page
14. PO form has optional "Link to Task" dropdown

## Requirements completed

- AF-02: Activity feed full page
- PO-02: PO task linking UI
- D-08: Dashboard activity widget link target
- D-09: Dashboard team contribution link target
- D-17: PO form Link to Task dropdown

## Self-check

- [x] /activity page renders full feed with event badges
- [x] /team-contribution page renders per-role breakdown with scope selector
- [x] PO form has Link to Task dropdown
- [x] All 14 deliverables visually verified
- [x] TypeScript compilation clean
