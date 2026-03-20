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

- [ ] **INTL-01**: 13 readiness meters track real operational readiness (Villa, Backend, Frontend, Procurement, Standardization, Sales, Tech, Talent, Art Experience, Lifestyle Experience, Kitchen, Menu, Inventory)
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
- [ ] **NOTF-04**: Low stock alert when ingredient drops below min level
- [ ] **NOTF-05**: New order alert to kitchen (KDS push or sound)
- [ ] **NOTF-06**: Order ready alert to POS staff
- [ ] **NOTF-07**: Delivery dispatched / delivered status update

### Operations Management

- [ ] **OPS-01**: Manage 6+ villa zones with type, owner, and status
- [ ] **OPS-02**: Manage brands with type (food/art/lifestyle) and status lifecycle (idea to active)
- [ ] **OPS-03**: Manage sales channels (dine-in, delivery, takeaway, retail, event, workshop, online)
- [ ] **OPS-04**: Asset library for recipes, SOPs, menus, cost sheets, training docs with status workflow

### Recipe & Ingredient Management

- [ ] **RECIPE-01**: Structured recipe creation with name, description, prep steps, cooking method, yield quantity + unit, portion size, linked to brand, status (draft → approved → archived)
- [ ] **RECIPE-02**: Recipe ingredient list (BOM) — each recipe has ingredients with quantity, unit, and prep notes
- [ ] **RECIPE-03**: Ingredient master list with name, category, unit, min stock level
- [ ] **RECIPE-04**: Vendor management — vendor entity with contact info, which ingredients they supply, price tracking over time (VendorPrice with effective date)
- [ ] **RECIPE-05**: Auto-calculated recipe cost from ingredient costs (best vendor price) × quantities
- [ ] **RECIPE-06**: Menu item creation from approved recipes with selling price, food cost percentage display, and channel availability (dine-in/takeaway/delivery)

### Inventory & Procurement

- [ ] **INV-01**: Raw ingredient stock tracking — current quantity per ingredient per zone, min stock level, low-stock alerts when below minimum
- [ ] **INV-02**: Stock movement history — type (received/prep-deducted/waste/adjustment), quantity, reason, reference to PO or PrepBatch
- [ ] **INV-03**: Purchase order workflow — create PO to vendor with line items (ingredient + qty + unit cost), track status (draft → ordered → received), auto-update raw inventory on receive
- [ ] **INV-04**: Procurement dashboard — pending POs, low stock alerts, vendor spend summary, ingredient price trends, total inventory value

### Kitchen & Prep

- [ ] **KITCHEN-01**: Prep batch system — select recipe + quantity to prep, auto-deducts raw ingredients per BOM, creates PrepBatch with quantity_remaining (production layer)
- [ ] **KITCHEN-02**: Kitchen display (KDS) showing incoming orders with items to prepare, grouped by zone/station, real-time updates
- [ ] **KITCHEN-03**: Menu availability — MenuItem knows if it's servable based on PrepBatch levels. Auto-marks "sold out" on POS when prep runs out. Alerts kitchen to prep more.
- [ ] **KITCHEN-04**: Waste logging — structured waste reports with reason (spoilage/over-prep/cooking-error/expired), quantity, ingredient, cost impact
- [ ] **KITCHEN-05**: Kitchen metrics — average prep time per item, orders in queue, items completed today, prep batch levels, waste percentage

### POS & Orders

- [ ] **POS-01**: Full POS interface — menu grid with categories/brands, tap to add items to order, quantity adjustment, order summary sidebar, channel selector (dine-in/takeaway/delivery)
- [ ] **POS-02**: Order management — order entity with status (placed → confirmed → preparing → ready → served/dispatched/cancelled), channel-specific fields (table number for dine-in, phone for takeaway, address for delivery)
- [ ] **POS-03**: Payment tracking — payment method (cash/card/UPI), payment status (pending/paid/refunded), amount. No gateway integration, just recording.
- [ ] **POS-04**: Order → kitchen flow — when order is placed, items appear on KDS. When item marked ready on KDS, order status updates. Deduct from PrepBatch on fulfillment.
- [ ] **POS-05**: Delivery dispatch — assign delivery staff, track status (picked-up → in-transit → delivered), delivery notes
- [ ] **POS-06**: Order history — searchable list of all orders with filters (date, channel, status, payment), daily revenue summary

### Customer Experience

- [ ] **CUST-01**: Post-dining feedback collection via QR code or link — rate dishes, leave comments (no customer auth required)
- [ ] **CUST-02**: Experience event browsing and booking — event listings with capacity, booking form (name + phone), confirmation
- [ ] **CUST-03**: Digital menu display (non-interactive) — shows current menu with prices, available items, brand sections. For display screens or QR access.

### Dashboards

- [ ] **DASH-01**: Admin mission control — readiness overview, pending approvals, blockers, decisions, ad-hoc task injector, leaderboard
- [ ] **DASH-02**: Role user dashboard — my tasks, quests, evidence, contribution meters
- [ ] **DASH-03**: Kitchen dashboard — orders in queue, prep batch levels, station utilization, average prep times, waste today
- [ ] **DASH-04**: Inventory & procurement dashboard — stock levels (raw + production), low stock alerts, PO status, vendor spend, inventory value
- [ ] **DASH-05**: BI dashboard — revenue (daily/weekly/monthly), food cost %, recipe cost analysis, top-selling items, channel breakdown
- [ ] **DASH-06**: Shared boards — mission board, quest board, wins/milestones, latest evidence feed

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
| Complex inventory management | ~~Moved to v1~~ — Full two-layer inventory, procurement, kitchen prep |
| Payment gateway integration | Payment method + status tracked (POS-03) but no Razorpay/Stripe gateway in v1 |
| Customer self-service ordering | POS-based (staff takes orders). No customer-facing order placement. |
| Third-party delivery integration | Own delivery only (POS-05). No Swiggy/Zomato API integration in v1. |
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
| OPS-01 | Phase 6 | Pending |
| OPS-02 | Phase 6 | Pending |
| OPS-03 | Phase 6 | Pending |
| OPS-04 | Phase 6 | Pending |
| RECIPE-01 | Phase 7 | Pending |
| RECIPE-02 | Phase 7 | Pending |
| RECIPE-03 | Phase 7 | Pending |
| RECIPE-04 | Phase 7 | Pending |
| RECIPE-05 | Phase 7 | Pending |
| RECIPE-06 | Phase 7 | Pending |
| INV-01 | Phase 8 | Pending |
| INV-02 | Phase 8 | Pending |
| INV-03 | Phase 8 | Pending |
| INV-04 | Phase 8 | Pending |
| KITCHEN-01 | Phase 9 | Pending |
| KITCHEN-02 | Phase 9 | Pending |
| KITCHEN-03 | Phase 9 | Pending |
| KITCHEN-04 | Phase 9 | Pending |
| KITCHEN-05 | Phase 9 | Pending |
| POS-01 | Phase 10 | Pending |
| POS-02 | Phase 10 | Pending |
| POS-03 | Phase 10 | Pending |
| POS-04 | Phase 10 | Pending |
| POS-05 | Phase 10 | Pending |
| POS-06 | Phase 10 | Pending |
| DASH-01 | Phase 11 | Pending |
| DASH-02 | Phase 11 | Pending |
| DASH-03 | Phase 11 | Pending |
| DASH-04 | Phase 11 | Pending |
| DASH-05 | Phase 11 | Pending |
| DASH-06 | Phase 11 | Pending |
| NOTF-01 | Phase 12 | Pending |
| NOTF-02 | Phase 12 | Pending |
| NOTF-03 | Phase 12 | Pending |
| NOTF-04 | Phase 12 | Pending |
| NOTF-05 | Phase 12 | Pending |
| NOTF-06 | Phase 12 | Pending |
| NOTF-07 | Phase 12 | Pending |
| CUST-01 | Phase 13 | Pending |
| CUST-02 | Phase 13 | Pending |
| CUST-03 | Phase 13 | Pending |

**Coverage:**
- v1 requirements: 68 total
- Mapped to phases: 68
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
