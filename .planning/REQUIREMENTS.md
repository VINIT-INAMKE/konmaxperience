# Requirements: Konma Xperience OS

**Defined:** 2026-03-19
**Core Value:** Every piece of work must be evidence-backed, approved, and validated before it counts -- turning real execution into measurable readiness and progress.

## v1 Requirements

### Authentication & RBAC

- [x] **AUTH-01**: User can log in with email and password (JWT-based)
- [x] **AUTH-02**: System enforces 8 generic roles (Frontend Lead, Backend Lead, BI Lead, Procurement Lead, Talent Lead, Tech Lead, Design/Outreach Lead, Founder/Admin)
- [x] **AUTH-03**: Each role has scoped permissions controlling what they can view, create, approve
- [x] **AUTH-04**: User session persists across browser refresh
- [x] **AUTH-05**: Admin has super access -- can see everything across all roles
- [x] **AUTH-06**: Admin can switch to view the system from any role's perspective

### Missions & Execution

- [x] **EXEC-01**: Admin can create long-term missions with phases (setup, foundation, activation, scale)
- [x] **EXEC-02**: Missions contain weekly quests assigned to role owners
- [x] **EXEC-03**: Quests contain daily tasks assigned to individual users
- [x] **EXEC-04**: Tasks have types: Core (100% XP), Ad-hoc (70% XP), Improvement (80% XP)
- [x] **EXEC-05**: Admin can inject ad-hoc tasks without breaking the mission roadmap
- [x] **EXEC-06**: Tasks can declare dependencies on other tasks
- [x] **EXEC-07**: Blocked tasks show reason and trigger blocker alerts
- [x] **EXEC-08**: Mission and quest progress auto-calculate from valid task completion

### Evidence & Validation

- [x] **EVID-01**: User can upload evidence (photo, doc, video, link, note) to any assigned task
- [x] **EVID-02**: Lead/admin can approve or reject evidence with notes
- [x] **EVID-03**: Task is valid only when: status=done + approved evidence + all required approvals satisfied + verified=true

### Intelligence & Gamification

- [ ] **INTL-01**: 10 readiness meters track real operational readiness (Villa, Backend, Frontend, Procurement, Standardization, Sales, Tech, Talent, Art Experience, Lifestyle Experience)
- [ ] **INTL-02**: Only valid tasks contribute to readiness meters (event-based, not recalculated)
- [ ] **INTL-03**: Users earn XP from valid tasks, accumulate levels (1-4)
- [ ] **INTL-04**: Leaderboard ranks users by valid XP with kill switch option
- [ ] **INTL-05**: KPIs track domain metrics (on_track, at_risk, off_track) tied to tasks

### Governance

- [ ] **GOVN-01**: Decisions can be logged with type (individual, cross-function, strategic), context, and status
- [ ] **GOVN-02**: Admin/founder can override or escalate any pending approval
- [ ] **GOVN-03**: Approval delegation when primary approver is unavailable

### Notifications

- [ ] **NOTF-01**: Alert user when task is due within 48 hours
- [ ] **NOTF-02**: Alert user when task is blocked by unresolved dependency
- [ ] **NOTF-03**: Alert admin when approval is pending more than 24 hours

### Operations Management

- [ ] **OPS-01**: Manage 6+ villa zones with type, owner, and status
- [ ] **OPS-02**: Manage brands with type (food/art/lifestyle) and status lifecycle (idea to active)
- [ ] **OPS-03**: Manage sales channels (dine-in, delivery, takeaway, retail, event, workshop, online)
- [ ] **OPS-04**: Asset library for recipes, SOPs, menus, cost sheets, training docs with status workflow

### Customer-Facing

- [ ] **CUST-01**: Public menu page showing approved food items from the asset library
- [ ] **CUST-02**: Customers can place delivery/takeaway orders online
- [ ] **CUST-03**: Customers can rate dishes and leave feedback after ordering/dining
- [ ] **CUST-04**: Customers can browse and book experience events (tastings, workshops, pop-ups)

### Recipe & Ingredient Management

- [ ] **RECIPE-01**: Structured recipe creation with name, description, prep steps, cooking method, yield, portion size, linked to brand
- [ ] **RECIPE-02**: Recipe ingredient list (BOM) — each recipe has ingredients with quantity, unit, and prep notes
- [ ] **RECIPE-03**: Ingredient master list with name, category, unit, supplier info, and current unit cost
- [ ] **RECIPE-04**: Auto-calculated recipe cost from ingredient costs × quantities
- [ ] **RECIPE-05**: Menu item creation from approved recipes with pricing and food cost percentage display

### Inventory & Procurement

- [ ] **INV-01**: Two-layer inventory — raw ingredients (what procurement buys) and production items (what kitchen preps). Each tracked separately with current quantity, zone, and min stock level with low-stock alerts
- [ ] **INV-02**: Stock movement history (in: procurement received, out: kitchen prep deducted from raw, out: customer order deducted from production, adjustment: waste/spillage)
- [ ] **INV-03**: Purchase order workflow — create PO to vendor with items/quantities, track status (draft → ordered → received), auto-update raw ingredient inventory on receive
- [ ] **INV-04**: Kitchen prep batch — select recipe + quantity to prep, deducts raw ingredients, adds to production inventory (e.g., prep 20 pizza doughs → -flour/yeast/water from raw, +20 doughs to production)
- [ ] **INV-05**: Procurement dashboard — pending POs, low stock alerts (both layers), vendor spend summary, inventory value

### Kitchen & Order Preparation

- [ ] **KITCHEN-01**: Kitchen display showing incoming customer orders with items to prepare, assigned to zones/stations
- [ ] **KITCHEN-02**: Order item status tracking (pending → preparing → ready → served/dispatched) with timestamp per transition
- [ ] **KITCHEN-03**: When order item is fulfilled, auto-deduct from production inventory. If production inventory insufficient, alert kitchen to prep more (which deducts raw ingredients)
- [ ] **KITCHEN-04**: Kitchen performance metrics — average prep time per item, orders in queue, items completed today, production inventory levels

### Dashboards

- [ ] **DASH-01**: Admin mission control -- readiness overview, pending approvals, blockers, decisions, ad-hoc task injector, leaderboard
- [ ] **DASH-02**: Role user dashboard -- my tasks, quests, evidence, contribution meters
- [ ] **DASH-03**: Admin can switch view to see the system from any role's perspective
- [ ] **DASH-04**: Shared boards -- mission board, quest board, wins/milestones, latest evidence feed

## v2 Requirements

### Advanced Governance

- **GOVN-04**: Cross-functional consensus voting (2+1 rule UI)
- **GOVN-05**: Decision impact tracking (link decisions to outcomes)

### Notifications v2

- **NOTF-04**: Near level-up nudge (within 20 XP of next level)
- **NOTF-05**: Quest almost complete nudge (80%+ progress)
- **NOTF-06**: WhatsApp/Slack integration for notifications

### Advanced Gamification

- **INTL-06**: Badge/achievement system
- **INTL-07**: Streak tracking (consecutive active days)

### Experience Layer

- **EXP-01**: Event calendar with public visibility
- **EXP-02**: Workshop registration with capacity management
- **EXP-03**: Pop-up/tasting announcement system

### Replication

- **REPL-01**: Zone layout templates exportable for new nodes
- **REPL-02**: SOP library with version control
- **REPL-03**: Playbook generator from completed missions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Art/lifestyle domain execution | V1 is food-first; art/lifestyle lack equivalent spec depth |
| Blockchain evidence integrity | Unnecessary complexity for v1; approved evidence is sufficient |
| AI recommendations/predictions | Phase 3 per blueprint; no AI dependency in MVP |
| Cross-node federation | Requires multiple nodes to exist first |
| Native mobile app | Web-first with responsive design; mobile app is v2+ |
| Real-time chat | High complexity, not core to operations coordination |
| Complex inventory management | ~~Moved to v1~~ — RECIPE-01 to RECIPE-05 + INV-01 to INV-05 |
| Payment processing | Order placement without integrated payment in v1; payment is a separate decision |
| Video evidence processing | Accept video uploads but no transcoding/processing in v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| EXEC-01 | Phase 2 | Complete |
| EXEC-02 | Phase 2 | Complete |
| EXEC-03 | Phase 2 | Complete |
| EXEC-04 | Phase 2 | Complete |
| EXEC-05 | Phase 2 | Complete |
| EXEC-06 | Phase 2 | Complete |
| EXEC-07 | Phase 2 | Complete |
| EXEC-08 | Phase 2 | Complete |
| EVID-01 | Phase 3 | Complete |
| EVID-02 | Phase 3 | Complete |
| EVID-03 | Phase 3 | Complete |
| INTL-01 | Phase 4 | Pending |
| INTL-02 | Phase 4 | Pending |
| INTL-03 | Phase 4 | Pending |
| INTL-04 | Phase 4 | Pending |
| INTL-05 | Phase 4 | Pending |
| GOVN-01 | Phase 5 | Pending |
| GOVN-02 | Phase 5 | Pending |
| GOVN-03 | Phase 5 | Pending |
| NOTF-01 | Phase 10 | Pending |
| NOTF-02 | Phase 10 | Pending |
| NOTF-03 | Phase 10 | Pending |
| OPS-01 | Phase 6 | Pending |
| OPS-02 | Phase 6 | Pending |
| OPS-03 | Phase 6 | Pending |
| OPS-04 | Phase 6 | Pending |
| RECIPE-01 | Phase 7 | Pending |
| RECIPE-02 | Phase 7 | Pending |
| RECIPE-03 | Phase 7 | Pending |
| RECIPE-04 | Phase 7 | Pending |
| RECIPE-05 | Phase 7 | Pending |
| INV-01 | Phase 8 | Pending |
| INV-02 | Phase 8 | Pending |
| INV-03 | Phase 8 | Pending |
| INV-04 | Phase 8 | Pending |
| INV-05 | Phase 8 | Pending |
| KITCHEN-01 | Phase 8 | Pending |
| KITCHEN-02 | Phase 8 | Pending |
| KITCHEN-03 | Phase 8 | Pending |
| KITCHEN-04 | Phase 8 | Pending |
| DASH-01 | Phase 9 | Pending |
| DASH-02 | Phase 9 | Pending |
| DASH-03 | Phase 9 | Pending |
| DASH-04 | Phase 9 | Pending |
| CUST-01 | Phase 11 | Pending |
| CUST-02 | Phase 11 | Pending |
| CUST-03 | Phase 11 | Pending |
| CUST-04 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
