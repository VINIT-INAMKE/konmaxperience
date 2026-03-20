# Roadmap: Konma Xperience OS

## Overview

Konma Xperience OS delivers a role-based socio-technical operating system for a 4000 sq ft food-innovation villa, serving 8 internal users and external customers. The build progresses from foundational auth and data model, through the mission execution hierarchy, into the evidence-backed validation cascade (the architectural heart), then layers on intelligence, governance, operations management, dashboards, notifications, and finally the customer-facing storefront. Every phase delivers a coherent, verifiable capability. The validation cascade in Phase 3 is the critical dependency -- everything downstream (XP, readiness, leaderboard, dashboards, customer features) consumes its outputs.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Authentication** - Project scaffolding (separate backend/frontend projects), full database schema, JWT auth with 8-role RBAC including admin super access and user-level filtering (completed 2026-03-19)
- [x] **Phase 2: Mission Execution Hierarchy** - Mission/quest/task CRUD with types, ad-hoc injection, dependencies, blockers, and progress calculation (completed 2026-03-19)
- [ ] **Phase 3: Evidence & Validation Cascade** - Evidence upload via presigned URLs, approval workflow, and the complete task validation engine (the architectural heart)
- [ ] **Phase 4: Gamification & Readiness Intelligence** - XP from valid tasks, levels, leaderboard, 10 readiness meters (event-sourced), and KPI tracking
- [ ] **Phase 5: Governance & Decision Management** - Decision logging with types, admin override/escalation on approvals, and approval delegation
- [ ] **Phase 6: Operations Management** - Zone management, brand lifecycle, sales channels, and asset library with approval workflow
- [ ] **Phase 7: Dashboards & Shared Boards** - Admin mission control, role user dashboard, admin role-perspective view, and shared boards (mission board, quest board, wins, evidence feed)
- [ ] **Phase 8: Notifications** - BullMQ-backed alerts for deadlines, blockers, and pending approvals
- [ ] **Phase 9: Customer-Facing Layer** - Public menu browsing, online ordering, customer feedback, and experience/event booking

## Phase Details

### Phase 1: Foundation & Authentication
**Goal**: Internal users can log in with their role and see a system that enforces what they can view, create, and approve -- including admin super access and user-level filtering (reinterpreted from role-switching per CONTEXT.md)
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. A user can log in with email/password and receive a JWT that persists across browser refresh
  2. Each of the 8 roles (Frontend Lead, Backend Lead, BI Lead, Procurement Lead, Talent Lead, Tech Lead, Design/Outreach Lead, Founder/Admin) sees only the data and actions their permissions allow
  3. Admin can see everything across all roles without restriction
  4. Admin can filter view by individual user name (unified admin view, not role-switching)
  5. An unprivileged user attempting to access another role's data receives an access-denied response (RBAC enforced at data layer, not just route layer)
**Plans:** 3/3 plans complete

Plans:
- [ ] 01-01-PLAN.md — Scaffold separate backend/frontend projects, shared types, full 15-entity Prisma schema, seed data
- [ ] 01-02-PLAN.md — Backend auth (JWT login/refresh/logout), RBAC guards, permission cache, user/role management APIs, MailerSend email
- [ ] 01-03-PLAN.md — Frontend auth pages, edge middleware, ops layout with sidebar, admin user management, admin permission settings, dashboard shell

### Phase 2: Mission Execution Hierarchy
**Goal**: Admin can structure work as missions containing quests containing tasks, with dependency tracking and ad-hoc injection, and progress auto-calculates from task completion
**Depends on**: Phase 1
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06, EXEC-07, EXEC-08
**Success Criteria** (what must be TRUE):
  1. Admin can create a mission with phases, add weekly quests to it assigned to role owners, and add daily tasks to quests assigned to individual users
  2. Tasks carry a type (Core at 100% XP, Ad-hoc at 70% XP, Improvement at 80% XP) that is visible and correctly recorded
  3. Admin can inject an ad-hoc task into an active quest without the quest's core progress percentage changing (dual-track progress: core vs. ad-hoc)
  4. A task can declare a dependency on another task; when the dependency is incomplete, the dependent task shows as blocked with the reason and triggers a blocker alert
  5. Mission and quest progress percentages auto-update when their child tasks change status
**Plans:** 4/4 plans complete

Plans:
- [ ] 02-01-PLAN.md — Backend Missions + Quests NestJS modules (CRUD, RBAC, baseline_task_count activation) + shared frontend types
- [ ] 02-02-PLAN.md — Backend Tasks NestJS module (scope-filtered CRUD, dependencies, blocking, atomic progress recalculation) + unit tests
- [ ] 02-03-PLAN.md — Frontend Mission list/detail/create pages, Quest form/cards, dual-track progress display, dependency installs
- [ ] 02-04-PLAN.md — Frontend Task kanban/list views, task detail/form, blocker dialog, ad-hoc injection sheet, admin blockers page, sidebar update

### Phase 3: Evidence & Validation Cascade
**Goal**: Users can upload evidence to tasks, leads/admin can approve or reject it, and the system enforces that a task is valid only when all conditions are met -- producing the foundation every downstream feature depends on
**Depends on**: Phase 2
**Requirements**: EVID-01, EVID-02, EVID-03
**Success Criteria** (what must be TRUE):
  1. A user can upload evidence (photo, document, video, link, or note) to any task assigned to them, with files stored via presigned URL (no file bytes through the API server)
  2. A lead or admin can approve or reject evidence with notes, and the approval decision is recorded with timestamp and reviewer identity
  3. A task becomes valid only when status=done AND approved evidence exists AND all required approvals are satisfied AND verified=true; missing any condition keeps the task invalid
  4. The entire validation cascade (task validity check, XP credit, quest progress update, mission progress update, readiness event emission) executes within a single database transaction -- partial failure rolls back all changes
**Plans:** 4 plans

Plans:
- [ ] 03-01-PLAN.md — Backend StorageModule (R2 presigned URLs) + EvidenceModule (evidence CRUD), AWS SDK install
- [ ] 03-02-PLAN.md — Backend approval endpoints, atomic validateTask cascade, progress tightening to valid=true, unit tests
- [ ] 03-03-PLAN.md — Frontend evidence types, 8 MagicUI installs, Sonner mount, evidence upload zone + list on task detail
- [ ] 03-04-PLAN.md — Frontend approval UI (inline approve/reject, validation checklist, celebrations), approval queue page, sidebar update

### Phase 4: Gamification & Readiness Intelligence
**Goal**: Valid task completions produce XP, levels, leaderboard rankings, readiness meter movements, and KPI status -- all derived exclusively from validated work, never from unverified claims
**Depends on**: Phase 3
**Requirements**: INTL-01, INTL-02, INTL-03, INTL-04, INTL-05
**Success Criteria** (what must be TRUE):
  1. Ten readiness meters (Villa, Backend, Frontend, Procurement, Standardization, Sales, Tech, Talent, Art Experience, Lifestyle Experience) display current operational readiness, and only valid tasks contribute to their values
  2. A user earns XP when their task becomes valid (and only then), accumulates toward levels 1-4, and can see their current XP and level
  3. The leaderboard ranks all users by valid XP, updates when any task is validated, and can be disabled via kill switch
  4. When a previously valid task is invalidated (evidence rejected, status reverted), the XP is removed, the readiness meter contribution is revoked, and the leaderboard updates accordingly -- no stale credit persists
  5. KPIs track domain metrics with status indicators (on_track, at_risk, off_track) and each KPI is tied to contributing tasks
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Governance & Decision Management
**Goal**: The team can log decisions with proper categorization, admin can break approval deadlocks via override or delegation, and the governance trail is auditable
**Depends on**: Phase 3
**Requirements**: GOVN-01, GOVN-02, GOVN-03
**Success Criteria** (what must be TRUE):
  1. Any authorized user can log a decision with type (individual, cross-function, strategic), context, and status, and approved decisions cannot be deleted
  2. Admin/founder can override or escalate any pending approval that is stalling progress
  3. When a primary approver is unavailable, their approval authority can be delegated to another user, and the delegation is recorded in the audit trail
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Operations Management
**Goal**: The team can manage the villa's physical zones, brands, sales channels, and operational assets (recipes, SOPs, menus, cost sheets) through their full lifecycle -- producing the approved assets that the customer-facing layer will consume
**Depends on**: Phase 1, Phase 3 (asset approval reuses approval engine)
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. Admin can create and manage 6+ villa zones with type, owner, and status reflecting the physical layout
  2. Brands can be created with type (food/art/lifestyle) and progress through a status lifecycle (idea to active)
  3. Sales channels (dine-in, delivery, takeaway, retail, event, workshop, online) can be created and managed with activation status
  4. Assets (recipes, SOPs, menus, cost sheets, training docs) can be created, uploaded, and moved through a status workflow; only assets with approved status are candidates for customer-facing display
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

### Phase 7: Dashboards & Shared Boards
**Goal**: Admin has a mission-control view of the entire operation, each role user has a personal productivity dashboard, and shared boards provide team-wide visibility into missions, quests, wins, and recent evidence
**Depends on**: Phase 4, Phase 5, Phase 6
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Admin mission control displays: readiness overview across all 10 meters, pending approvals queue, active blockers, recent decisions, ad-hoc task injection shortcut, and leaderboard -- all on one screen
  2. Role user dashboard displays: my assigned tasks (with status), my active quests (with progress), my uploaded evidence (with approval status), and my contribution meters -- personalized to the logged-in user's role
  3. Admin can switch to view the dashboard from any role's perspective (seeing what that role user sees) and switch back to mission control
  4. Shared boards are accessible to all internal users: mission board (all missions with progress), quest board (active quests), wins/milestones feed, and latest evidence feed
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

### Phase 8: Notifications
**Goal**: Users receive timely alerts for deadlines, blockers, and pending approvals so nothing falls through the cracks
**Depends on**: Phase 2, Phase 3 (state changes that trigger notifications)
**Requirements**: NOTF-01, NOTF-02, NOTF-03
**Success Criteria** (what must be TRUE):
  1. A user is alerted when any of their tasks is due within 48 hours
  2. A user is alerted when any of their tasks is blocked by an unresolved dependency
  3. Admin is alerted when any approval has been pending for more than 24 hours
  4. Notification delivery failures never block or roll back the core operation that triggered the notification (BullMQ queue isolation)
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Customer-Facing Layer
**Goal**: External customers can browse the menu, place orders, leave feedback, and book experience events -- all consuming only approved internal assets, fully separated from the internal ops surface
**Depends on**: Phase 6 (approved assets to display), Phase 8 (order notifications)
**Requirements**: CUST-01, CUST-02, CUST-03, CUST-04
**Success Criteria** (what must be TRUE):
  1. A customer (no login required) can browse the public menu page showing only food items with approved status from the internal asset library
  2. A customer can place a delivery or takeaway order online, selecting items from the approved menu with availability re-validated at order submission time
  3. A customer can rate dishes and leave written feedback after ordering or dining
  4. A customer can browse upcoming experience events (tastings, workshops, pop-ups) and book a spot
  5. Customer-facing pages and API endpoints are fully isolated from internal ops data -- a customer request can never access unapproved assets or internal user data
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD
- [ ] 09-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

Note: Phase 5 and Phase 6 both depend on Phase 3 (not Phase 4), so they could potentially overlap with Phase 4 if needed. Phase 8 can begin after Phase 3 is complete. The listed order is the recommended sequential path.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Authentication | 3/3 | Complete    | 2026-03-19 |
| 2. Mission Execution Hierarchy | 4/4 | Complete    | 2026-03-19 |
| 3. Evidence & Validation Cascade | 0/4 | Planning complete | - |
| 4. Gamification & Readiness Intelligence | 0/3 | Not started | - |
| 5. Governance & Decision Management | 0/2 | Not started | - |
| 6. Operations Management | 0/3 | Not started | - |
| 7. Dashboards & Shared Boards | 0/3 | Not started | - |
| 8. Notifications | 0/2 | Not started | - |
| 9. Customer-Facing Layer | 0/3 | Not started | - |
