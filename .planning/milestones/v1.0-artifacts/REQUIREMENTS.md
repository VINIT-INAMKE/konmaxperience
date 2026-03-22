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

- [x] **INTL-01**: 10 readiness meters track real operational readiness (Villa, Backend, Frontend, Procurement, Standardization, Sales, Tech, Talent, Art Experience, Lifestyle Experience). Additional meters (Kitchen, Menu, Inventory) added when those phases ship.
- [x] **INTL-02**: Only valid tasks contribute to readiness meters (event-based, not recalculated)
- [x] **INTL-03**: Users earn XP from valid tasks, accumulate levels (1-4)
- [x] **INTL-04**: Leaderboard ranks users by valid XP with kill switch option
- [x] **INTL-05**: KPIs track domain metrics (on_track, at_risk, off_track) tied to tasks

### Governance

- [x] **GOVN-01**: Decisions can be logged with type (individual, cross-function, strategic), context, and status
- [x] **GOVN-02**: Admin/founder can override or escalate any pending approval
- [x] **GOVN-03**: Approval delegation when primary approver is unavailable

### Notifications

- [x] **NOTF-01**: Alert user when task is due within 48 hours
- [x] **NOTF-02**: Alert user when task is blocked by unresolved dependency
- [x] **NOTF-03**: Alert admin when approval is pending more than 24 hours
- [x] **NOTF-04**: Low stock alert when ingredient drops below min level
- [x] **NOTF-05**: New order alert to kitchen (KDS push or sound)
- [x] **NOTF-06**: Order ready alert to POS staff
- [x] **NOTF-07**: Delivery dispatched / delivered status update

### Operations Management

- [x] **OPS-01**: Manage 6+ villa zones with type, owner, and status
- [x] **OPS-02**: Manage brands with type (food/art/lifestyle) and status lifecycle (idea to active)
- [x] **OPS-03**: Manage sales channels (dine-in, delivery, takeaway, retail, event, workshop, online)
- [x] **OPS-04**: Asset library for recipes, SOPs, menus, cost sheets, training docs with status workflow

### Recipe & Ingredient Management

- [x] **RECIPE-01**: Unified recipe entity — name, description, prep steps, cooking method, yield qty + unit, portion size, shelf_life_hours, linked to brand + zone, status (draft → approved → archived). No type distinction — any recipe can be prep or final dish.
- [x] **RECIPE-02**: Polymorphic BOM (RecipeLine) — each line is either a raw ingredient (ingredient_id) or output of another recipe (source_recipe_id), with quantity, unit, and prep notes. Supports unlimited chaining depth.
- [x] **RECIPE-03**: Ingredient master list with name, category, base_unit (canonical unit for stock tracking), min stock level
- [x] **RECIPE-04**: Unit conversion system — UnitConversion table (kg↔g, L↔ml, dozen↔pieces). All stock in base_unit, recipes/POs use any compatible unit, system converts automatically.
- [x] **RECIPE-05**: Vendor management — Vendor entity with contact info + VendorPrice tracking per ingredient with effective dates. Current price = latest by date.
- [x] **RECIPE-06**: Recursive recipe cost calculation — ingredient cost from best vendor price × BOM qty; prep item cost from source recipe cost prorated by usage. Cached in computed_cost field, recalculated on save or price change.
- [x] **RECIPE-07**: Menu items — MenuItem from approved recipe with base_price, food cost %, manual availability toggle, image_url. MenuCategory for Brand → Category → Items hierarchy. ChannelModifier for per-channel price adjustments (base_price + modifier).

### Inventory & Procurement

- [x] **INV-01**: Raw ingredient stock tracking — IngredientStock per ingredient per zone in base_unit, min stock level triggers low-stock alert
- [x] **INV-02**: Stock movement audit trail — every change logged as StockMovement (received/prep_deducted/order_deducted/waste/adjustment) with quantity, reason, reference to PO/PrepBatch/Order/WasteLog
- [x] **INV-03**: Purchase order workflow — PO to vendor with line items (ingredient + qty + unit_cost), status (draft → ordered → received), partial receiving supported (received_qty can differ from ordered), auto-update IngredientStock on receive with unit conversion
- [x] **INV-04**: Procurement dashboard — pending POs, low stock alerts, vendor spend summary, ingredient price trends, total inventory value

### Kitchen & Prep

- [x] **KITCHEN-01**: Prep batch system — select recipe × quantity, auto-deducts inputs per BOM (raw ingredients from IngredientStock, prep items from other PrepBatches via FIFO), creates PrepBatch with quantity_remaining. All in single $transaction.
- [x] **KITCHEN-02**: Kitchen display (KDS) — polls for orders with status placed/preparing every 5 seconds, grouped by zone. Cook taps to update item status (pending → preparing → ready).
- [x] **KITCHEN-03**: Menu availability — checks BOTH PrepBatch levels AND raw IngredientStock for each RecipeLine. Shows servings remaining on POS. Auto-marks "sold out" when any input insufficient. Alerts kitchen to prep more.
- [x] **KITCHEN-04**: Waste logging — WasteLog with type (ingredient/prep_batch), structured reason (spoilage/over_prep/cooking_error/expired/other), auto-calculated cost impact. Expired PrepBatches auto-create waste entries via scheduled job.
- [x] **KITCHEN-05**: Kitchen metrics — orders in queue, prep batch levels, average prep time, waste percentage, items completed today
- [x] **KITCHEN-06**: PrepBatch expiry — shelf_life_hours on Recipe, expires_at auto-set on PrepBatch creation, expired batches excluded from availability, hourly cron marks expired + logs waste

### POS & Orders

- [x] **POS-01**: Full POS interface — Brand → Category → Items menu grid, tap to add, quantity adjustment, order summary sidebar, channel selector (dine-in/takeaway/delivery), servings-remaining indicator per item
- [x] **POS-02**: Order management — Order with channel-specific fields (table_number for dine-in, customer_phone for takeaway, delivery_address + delivery_assigned_to string for delivery), status flow (placed → preparing → ready → served/dispatched/cancelled)
- [x] **POS-03**: Payment tracking — single Payment per order with method (cash/card/UPI), status (pending/paid/refunded), amount, notes field for split description. No gateway integration.
- [x] **POS-04**: Order → kitchen → deduction flow — order placed → items appear on KDS → cook marks preparing → cook marks ready → DEDUCTION HAPPENS (PrepBatch.quantity_remaining decremented, IngredientStock decremented for direct-use items, StockMovements created) → when all items ready → order status = ready
- [x] **POS-05**: Delivery dispatch — delivery_assigned_to (plain name string), delivery_status (picked_up → in_transit → delivered) on Order. No rider entity.
- [x] **POS-06**: Order history — searchable list with filters (date, channel, status, payment method), daily revenue summary

### Customer Experience

- [x] **CUST-01**: Post-dining feedback via QR code or link — Feedback entity with optional order_id, rating (1-5), comment, customer name/phone. No auth required.
- [x] **CUST-02**: Experience event management — Event entity created internally (title, type, date, capacity, price, zone, brand), public display, EventBooking (name + phone + guests), capacity enforcement (auto-full when bookings >= capacity)
- [x] **CUST-03**: Digital menu display (non-interactive) — shows current menu with prices, available items, brand sections. For display screens or QR access.

### Dashboards

- [x] **DASH-01**: Admin mission control — readiness overview, pending approvals, blockers, decisions, ad-hoc task injector, leaderboard
- [x] **DASH-02**: Role user dashboard — my tasks, quests, evidence, contribution meters
- [x] **DASH-03**: Kitchen dashboard — orders in queue, prep batch levels, station utilization, average prep times, waste today
- [x] **DASH-04**: Inventory & procurement dashboard — stock levels (raw + production), low stock alerts, PO status, vendor spend, inventory value
- [x] **DASH-05**: BI dashboard — revenue (daily/weekly/monthly), food cost %, recipe cost analysis, top-selling items, channel breakdown
- [x] **DASH-06**: Shared boards — mission board, quest board, wins/milestones, latest evidence feed

## v2 Requirements

### Advanced Governance

- **GOVN-04**: Cross-functional consensus voting (2+1 rule UI)
- **GOVN-05**: Decision impact tracking (link decisions to outcomes)

### Notifications v2

- **NOTF-V2-01**: Near level-up nudge (within 20 XP of next level)
- **NOTF-V2-02**: Quest almost complete nudge (80%+ progress)
- **NOTF-V2-03**: WhatsApp/Slack integration for notifications

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
| INTL-01 | Phase 4 | Complete |
| INTL-02 | Phase 4 | Complete |
| INTL-03 | Phase 4 | Complete |
| INTL-04 | Phase 4 | Complete |
| INTL-05 | Phase 4 | Complete |
| GOVN-01 | Phase 5 | Complete |
| GOVN-02 | Phase 5 | Complete |
| GOVN-03 | Phase 5 | Complete |
| OPS-01 | Phase 6 | Complete |
| OPS-02 | Phase 6 | Complete |
| OPS-03 | Phase 6 | Complete |
| OPS-04 | Phase 6 | Complete |
| RECIPE-01 | Phase 7 | Complete |
| RECIPE-02 | Phase 7 | Complete |
| RECIPE-03 | Phase 7 | Complete |
| RECIPE-04 | Phase 7 | Complete |
| RECIPE-05 | Phase 7 | Complete |
| RECIPE-06 | Phase 7 | Complete |
| RECIPE-07 | Phase 7 | Complete |
| INV-01 | Phase 8 | Complete |
| INV-02 | Phase 8 | Complete |
| INV-03 | Phase 8 | Complete |
| INV-04 | Phase 8 | Complete |
| KITCHEN-01 | Phase 9 | Complete |
| KITCHEN-02 | Phase 9 | Complete |
| KITCHEN-03 | Phase 9 | Complete |
| KITCHEN-04 | Phase 9 | Complete |
| KITCHEN-05 | Phase 9 | Complete |
| KITCHEN-06 | Phase 9 | Complete |
| POS-01 | Phase 10 | Complete |
| POS-02 | Phase 10 | Complete |
| POS-03 | Phase 10 | Complete |
| POS-04 | Phase 10 | Complete |
| POS-05 | Phase 10 | Complete |
| POS-06 | Phase 10 | Complete |
| DASH-01 | Phase 11 | Complete |
| DASH-02 | Phase 11 | Complete |
| DASH-03 | Phase 11 | Pending |
| DASH-04 | Phase 11 | Complete |
| DASH-05 | Phase 11 | Complete |
| DASH-06 | Phase 11 | Complete |
| NOTF-01 | Phase 12 | Complete |
| NOTF-02 | Phase 12 | Complete |
| NOTF-03 | Phase 12 | Complete |
| NOTF-04 | Phase 12 | Complete |
| NOTF-05 | Phase 12 | Complete |
| NOTF-06 | Phase 12 | Complete |
| NOTF-07 | Phase 12 | Complete |
| CUST-01 | Phase 13 | Complete |
| CUST-02 | Phase 13 | Complete |
| CUST-03 | Phase 13 | Complete |

**Coverage:**
- v1 requirements: 70 total
- Mapped to phases: 70
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
