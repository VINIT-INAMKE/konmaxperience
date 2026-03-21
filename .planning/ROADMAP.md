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
- [x] **Phase 3: Evidence & Validation Cascade** - Evidence upload via presigned URLs, approval workflow, and the complete task validation engine (the architectural heart) (completed 2026-03-20)
- [x] **Phase 4: Gamification & Readiness Intelligence** - XP from valid tasks, levels, leaderboard, 10 readiness meters (event-sourced), and KPI tracking (completed 2026-03-20)
- [x] **Phase 5: Governance & Decision Management** - Decision logging with types, admin override/escalation on approvals, and approval delegation (completed 2026-03-21)
- [x] **Phase 6: Operations Management** - Zone management, brand lifecycle, sales channels, and asset library with approval workflow (completed 2026-03-21)
- [ ] **Phase 7: Recipe & Ingredient Management** - Structured recipes with BOM, ingredient master, vendor management, recipe costing, menu items with pricing and food cost %
- [ ] **Phase 8: Inventory & Procurement** - Raw ingredient stock tracking, stock movements, purchase order workflow with vendor prices, low-stock alerts
- [ ] **Phase 9: Kitchen & Prep** - Prep batch system (recipe x qty -> deduct raw, add production), kitchen display (KDS), menu availability based on prep levels, waste logging
- [ ] **Phase 10: POS & Orders** - Full POS interface for staff, order management (dine-in/takeaway/delivery), payment tracking (method + status), own-delivery dispatch, order -> kitchen flow
- [ ] **Phase 11: Dashboards & Shared Boards** - Mission control, role dashboards, kitchen metrics, inventory overview, recipe cost analysis, procurement spend
- [ ] **Phase 12: Notifications** - BullMQ alerts for tasks, stock levels, orders, kitchen, approvals, delivery
- [ ] **Phase 13: Customer Experience** - Post-dining feedback (QR/link), experience event booking with capacity, digital menu display (non-interactive)

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
**Plans:** 4/4 plans complete

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
**Plans:** 4/4 plans complete

Plans:
- [ ] 04-01-PLAN.md — Backend: SystemSetting schema, MANAGE_KPIS permission, auth response extension (xp_total/level), readiness/leaderboard/settings/KPI NestJS modules with unit tests
- [ ] 04-02-PLAN.md — Frontend foundation: auth store extension, gamification types/components (LevelBadge, XpProgressBar, LevelUpCelebration), sidebar XP display, task card XP, evidence approval wiring
- [ ] 04-03-PLAN.md — Frontend: /readiness page (10 animated rings, meter detail panels) + /leaderboard page (podium, ranked table, kill switch paused state)
- [ ] 04-04-PLAN.md — Frontend: /kpis page (domain-scoped cards, create/edit sheet) + /admin/settings (kill switch) + /dashboard mission control (readiness strip, KPI alerts, leaderboard preview)

### Phase 5: Governance & Decision Management
**Goal**: The team can log decisions with proper categorization, admin can break approval deadlocks via override or delegation, and the governance trail is auditable
**Depends on**: Phase 3
**Requirements**: GOVN-01, GOVN-02, GOVN-03
**Success Criteria** (what must be TRUE):
  1. Any authorized user can log a decision with type (individual, cross-function, strategic), context, and status, and approved decisions cannot be deleted
  2. Admin/founder can override or escalate any pending approval that is stalling progress
  3. When a primary approver is unavailable, their approval authority can be delegated to another user, and the delegation is recorded in the audit trail
**Plans:** 4/4 plans complete

Plans:
- [x] 05-01-PLAN.md — Backend: schema migration (ApprovalDelegation + Approval override fields), Decisions/Approvals/Delegations NestJS modules, frontend types
- [x] 05-02-PLAN.md — Frontend: /decisions page (filterable list, MagicCard cards, detail expand, log decision form), sidebar Decisions link
- [x] 05-03-PLAN.md — Frontend: approval override UI (OverrideDialog + ApprovalItem modification with override button and attribution)
- [x] 05-04-PLAN.md — Frontend: /admin/delegations page (create/view/deactivate delegations), sidebar Delegations link

### Phase 6: Operations Management
**Goal**: The team can manage the villa's physical zones, brands, sales channels, and operational assets (recipes, SOPs, menus, cost sheets) through their full lifecycle -- producing the approved assets that the customer-facing layer will consume
**Depends on**: Phase 1, Phase 3 (asset approval reuses approval engine)
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. Admin can create and manage 6+ villa zones with type, owner, and status reflecting the physical layout
  2. Brands can be created with type (food/art/lifestyle) and progress through a status lifecycle (idea to active)
  3. Sales channels (dine-in, delivery, takeaway, retail, event, workshop, online) can be created and managed with activation status
  4. Assets (recipes, SOPs, menus, cost sheets, training docs) can be created, uploaded, and moved through a status workflow; only assets with approved status are candidates for customer-facing display
**Plans:** 3/3 plans complete

Plans:
- [x] 06-01-PLAN.md — Backend: MANAGE_OPS permission, Zones/Brands/Channels/Assets NestJS modules, presign-asset endpoint, seed update, unit tests
- [x] 06-02-PLAN.md — Frontend: Zone/Brand types, sidebar Operations section, /operations/zones page, /operations/brands page
- [x] 06-03-PLAN.md — Frontend: Channel/Asset types, /operations/channels page, /operations/assets page with upload zone

### Phase 7: Recipe & Ingredient Management
**Goal**: Unified recipe system with polymorphic BOM (raw ingredients + recipe outputs), unit conversion, vendor management, recursive cost calculation, and menu items with channel-aware pricing — the food production data layer
**Depends on**: Phase 6 (brands, assets)
**Requirements**: RECIPE-01, RECIPE-02, RECIPE-03, RECIPE-04, RECIPE-05, RECIPE-06, RECIPE-07
**Success Criteria** (what must be TRUE):
  1. A recipe can be created with steps, yield, shelf_life_hours, brand, zone, and status workflow — no type distinction (prep or assembly determined by usage)
  2. Each RecipeLine is either a raw ingredient or the output of another recipe (polymorphic BOM), supporting unlimited chaining depth
  3. Ingredients have a master list with category, base_unit, and min stock level
  4. UnitConversion table converts between compatible units (kg↔g, L↔ml, dozen↔pieces) — all stock operations in base_unit
  5. Vendors can be created and linked to ingredients with historical price tracking (VendorPrice with effective_date)
  6. Recipe cost auto-calculates recursively — ingredient costs from best vendor price, prep item costs from source recipe cost prorated. Cached in computed_cost.
  7. Menu items created from approved recipes with base_price, food cost %, manual availability toggle, MenuCategory (Brand → Category → Item), and ChannelModifier for per-channel price adjustments
**Plans:** 3/6 plans executed

Plans:
- [x] 07-01-PLAN.md — Prisma schema migration (9 new models + Asset.linked_recipe_id), UnitConversion seed, frontend shared types
- [x] 07-02-PLAN.md — Backend Ingredients module (CRUD, category filter, usage-safe delete) + Vendors module (CRUD, VendorPrice management) + shared unit conversion utility
- [x] 07-03-PLAN.md — Backend Recipes module (CRUD, BOM upsert, CostCalculator with cycle guard) + Menu module (categories, items, channel modifiers) + vendor cost wiring
- [ ] 07-04-PLAN.md — Frontend sidebar update (4 nav items) + /operations/ingredients page + /operations/vendors page with detail Sheet and price history
- [ ] 07-05-PLAN.md — Frontend /operations/recipes page (card grid) + 3-step RecipeWizard + /operations/recipes/[id] detail with dependency tree
- [ ] 07-06-PLAN.md — Frontend /operations/menu page (brand tabs, category sections, menu item cards, food cost %, channel modifier table)

### Phase 8: Inventory & Procurement
**Goal**: Raw ingredient stock tracking with real-time visibility, purchase order workflow from vendor to receiving, and stock movement audit trail
**Depends on**: Phase 7 (ingredients, vendors)
**Requirements**: INV-01, INV-02, INV-03, INV-04
**Success Criteria** (what must be TRUE):
  1. Each ingredient has a current stock quantity per zone with min level, and low-stock alerts fire when below minimum
  2. Every stock change is recorded as a movement (received, prep-deducted, waste, adjustment) with reason and reference
  3. Purchase orders can be created to vendors with line items, tracked through draft → ordered → received, and auto-update inventory on receive
  4. Procurement dashboard shows pending POs, low stock alerts, vendor spend, and total inventory value
**Plans**: TBD

### Phase 9: Kitchen & Prep
**Goal**: Kitchen prep batch system that bridges raw ingredients to servable items (deducting both raw ingredients AND source prep batches via FIFO), KDS for real-time order display via polling, menu availability from BOTH prep levels AND raw stock, structured waste tracking with auto-expiry, and kitchen metrics
**Depends on**: Phase 7 (recipes, ingredients, unit conversion), Phase 8 (raw inventory, stock movements)
**Requirements**: KITCHEN-01, KITCHEN-02, KITCHEN-03, KITCHEN-04, KITCHEN-05, KITCHEN-06
**Success Criteria** (what must be TRUE):
  1. Kitchen can log prep batches (recipe × quantity) — deducts raw ingredients from IngredientStock AND source prep items from other PrepBatches (FIFO), all in single $transaction
  2. Kitchen display (KDS) polls for orders every 5 seconds, grouped by zone, cook updates item status (pending → preparing → ready)
  3. Menu availability checks BOTH PrepBatch levels AND raw IngredientStock for each RecipeLine — shows servings remaining on POS, auto-marks sold out when any input insufficient
  4. Waste logged with structured reasons (spoilage/over_prep/cooking_error/expired/other) and auto-calculated cost impact
  5. Kitchen metrics: orders in queue, prep batch levels, average prep time, waste percentage
  6. PrepBatch expiry: auto-calculated from recipe.shelf_life_hours, expired batches excluded from availability, hourly cron marks expired + auto-creates waste entries
**Plans**: TBD

### Phase 10: POS & Orders
**Goal**: Full POS interface for staff to take orders across all channels (dine-in, takeaway, delivery), with payment tracking (single record + notes for splits), order-to-kitchen-to-deduction flow (deduct on "ready"), and own-delivery dispatch (plain name string, no rider entity)
**Depends on**: Phase 7 (menu items, channel modifiers), Phase 9 (KDS, prep batch deduction logic)
**Requirements**: POS-01, POS-02, POS-03, POS-04, POS-05, POS-06
**Success Criteria** (what must be TRUE):
  1. Staff can take orders on POS with Brand → Category → Items grid, servings-remaining indicator, quantity adjustment, order summary, channel selector
  2. Orders track channel with channel-specific fields (table_number, customer_phone, delivery_address, delivery_assigned_to) and status flow (placed → preparing → ready → served/dispatched/cancelled)
  3. Single Payment per order: method (cash/card/UPI), status (pending/paid/refunded), amount, notes field for split description
  4. Order → kitchen → deduction: items appear on KDS on placement, cook marks ready → DEDUCTION (PrepBatch.quantity_remaining decremented via FIFO + IngredientStock decremented for direct-use items + StockMovements created) → when all items ready → order ready
  5. Delivery: delivery_assigned_to (plain name string), delivery_status (picked_up → in_transit → delivered)
  6. Order history searchable with filters (date, channel, status, payment), daily revenue summary
**Plans**: TBD

### Phase 11: Dashboards & Shared Boards
**Goal**: Comprehensive dashboards for admin mission control, role-specific views, kitchen operations, inventory/procurement, BI analytics, and shared team boards
**Depends on**: Phase 4, Phase 5, Phase 6, Phase 10 (needs all data sources)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. Admin mission control: readiness meters, pending approvals, active blockers, decisions, leaderboard
  2. Role user dashboard: my tasks, quests, evidence, contribution meters
  3. Kitchen dashboard: orders in queue, prep batch levels, station utilization, average prep times, waste today
  4. Inventory & procurement dashboard: stock levels (raw + production), low stock alerts, PO status, vendor spend
  5. BI dashboard: revenue (daily/weekly/monthly), food cost %, recipe cost analysis, top-selling items, channel breakdown
  6. Shared boards: mission board, quest board, wins/milestones, evidence feed
**Plans**: TBD

### Phase 12: Notifications
**Goal**: Comprehensive alert system covering task deadlines, blockers, approvals, stock levels, orders, kitchen, and delivery — delivered via BullMQ with guaranteed non-blocking delivery
**Depends on**: Phase 2, Phase 3, Phase 8, Phase 10 (all event sources)
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, NOTF-06, NOTF-07
**Success Criteria** (what must be TRUE):
  1. User alerted when task is due within 48 hours
  2. User alerted when task is blocked by unresolved dependency
  3. Admin alerted when approval pending more than 24 hours
  4. Procurement alerted when ingredient drops below min stock level
  5. Kitchen alerted when new order arrives (KDS push)
  6. POS staff alerted when order is ready for serving/pickup
  7. Delivery status updates tracked (dispatched, in-transit, delivered)
  8. All notification delivery failures are isolated — never block core operations
**Plans**: TBD

### Phase 13: Customer Experience
**Goal**: Post-dining feedback collection, experience event booking, and digital menu display — all without customer auth (POS-based operation)
**Depends on**: Phase 10 (orders), Phase 7 (menu items)
**Requirements**: CUST-01, CUST-02, CUST-03
**Success Criteria** (what must be TRUE):
  1. Customers can submit feedback via QR code or link — rate dishes and leave comments without login
  2. Experience events can be created internally, displayed publicly with capacity, and booked (name + phone)
  3. Digital menu display shows current menu with prices, available items, and brand sections (for screens or QR access)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13

Dependencies: Phase 7 (Recipes) depends on Phase 6 (brands/vendors). Phase 8 (Inventory) depends on Phase 7 (ingredients). Phase 9 (Kitchen) depends on Phase 7+8 (recipes + inventory). Phase 10 (POS) depends on Phase 7+9 (menu items + KDS). Phase 13 (Customer) depends on Phase 10 (orders exist).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Authentication | 3/3 | Complete | 2026-03-19 |
| 2. Mission Execution Hierarchy | 4/4 | Complete | 2026-03-19 |
| 3. Evidence & Validation Cascade | 4/4 | Complete | 2026-03-20 |
| 4. Gamification & Readiness Intelligence | 4/4 | Complete   | 2026-03-20 |
| 5. Governance & Decision Management | 4/4 | Complete   | 2026-03-21 |
| 6. Operations Management | 3/3 | Complete   | 2026-03-21 |
| 7. Recipe & Ingredient Management | 3/6 | In Progress|  |
| 8. Inventory & Procurement | 0/0 | Not started | - |
| 9. Kitchen & Prep | 0/0 | Not started | - |
| 10. POS & Orders | 0/0 | Not started | - |
| 11. Dashboards & Shared Boards | 0/0 | Not started | - |
| 12. Notifications | 0/0 | Not started | - |
| 13. Customer Experience | 0/0 | Not started | - |
