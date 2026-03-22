# Phase 10: POS & Orders - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Full POS interface for staff-operated ordering across all channels (dine-in, takeaway, delivery), order management with status flow, payment tracking (single record, no gateway), order-to-kitchen-to-deduction flow (deduct on "mark ready"), delivery dispatch (plain name string), and order history with daily revenue summary. Order/OrderItem/Payment models already in schema from Phase 9. No customer-facing ordering (Phase 13), no payment gateway integration (v2).

</domain>

<decisions>
## Implementation Decisions

### POS Interface Layout
- **D-01:** Split screen: left 2/3 = menu grid (Brand tabs → category rows → item cards, tap to add), right 1/3 = order summary sidebar (items, quantities, subtotal, channel modifier, total).
- **D-02:** Both regular page (sidebar visible) AND full-screen toggle for dedicated POS terminal/tablet use.
- **D-03:** Servings-remaining badge on each menu item card ("X left"). When 0, item card grays out with "Sold Out". Uses Phase 9 availability endpoint.
- **D-04:** Channel selector in cart sidebar: dine-in / takeaway / delivery. Channel-specific fields appear based on selection (table_number, customer_phone, delivery_address + delivery_assigned_to).

### Order Placement Flow
- **D-05:** Inline in sidebar — staff selects channel, fills channel-specific fields, adds notes, clicks "Place Order". Single page, no checkout step.
- **D-06:** Order placement creates Order + OrderItems + applies ChannelModifier to total. Items appear on KDS immediately (Phase 9 KDS polling picks them up).

### Order Status Flow
- **D-07:** Status: placed → preparing → ready → served (dine-in) / dispatched (delivery/takeaway) → cancelled. Locked from pipeline spec.
- **D-08:** Deduction on "mark ready" per item (locked from brainstorming): when cook marks item ready on KDS → PrepBatch.quantity_remaining decremented, IngredientStock decremented for direct-use items, StockMovements created. When ALL items ready → order status auto-transitions to "ready".

### Delivery Dispatch
- **D-09:** Inline on order detail: delivery_assigned_to text field (type a name), delivery_status buttons (picked_up → in_transit → delivered).
- **D-10:** PLUS a dedicated delivery queue page listing all active delivery orders with status. Both views available.

### Payment
- **D-11:** Payment recorded AFTER service (not at order placement). Staff clicks "Record Payment" on order detail. Method (cash/card/UPI), amount, notes for split description.
- **D-12:** Single Payment record per order. No gateway integration. Payment is record-keeping only.

### Order History
- **D-13:** Table with filters: order #, channel, status, items count, total, payment status, date. Filters: date range, channel, status, payment method.
- **D-14:** Daily revenue summary card at top: total orders, total revenue, average order value.

### Navigation
- **D-15:** POS page under a new "POS" sidebar section (or top-level). Orders, Delivery Queue, Order History as sub-pages.

### Data Model (locked by pipeline spec + Phase 9 schema)
- **D-16:** Order, OrderItem, Payment models already in schema from Phase 9.
- **D-17:** ChannelModifier from Phase 7 — applied to order total at placement time.

### Claude's Discretion
- POS menu item card size and grid density
- Cart sidebar item row design
- Order detail page layout
- Delivery queue page layout
- Payment form design
- How quantity adjustment works (+ / - buttons vs number input)
- Full-screen POS toggle implementation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Food Production Pipeline Spec (PRIMARY)
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §3.8 — Order, OrderItem, Payment schema
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §4.4 — Order fulfillment deduction logic (deduct on "ready")
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §4.6 — Menu availability + channel modifier application

### Existing Implementation
- `backend/prisma/schema.prisma` — Order, OrderItem, Payment models (added Phase 9)
- `backend/src/kitchen/kds/kds.service.ts` — KDS order reading + item status updates (Phase 9)
- `backend/src/kitchen/prep-batches/prep-batches.service.ts` — FIFO deduction (Phase 9) — reuse pattern for "mark ready" deduction
- `backend/src/menu/menu.service.ts` — getServingsAvailable (Phase 9), MenuItem queries (Phase 7)
- `backend/src/menu/menu.controller.ts` — GET /menu/availability/:menuItemId (Phase 9)
- `frontend/lib/types/kds.ts` — KdsOrder, KdsOrderItem types (Phase 9)

### Requirements
- `.planning/REQUIREMENTS.md` — POS-01 through POS-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/kitchen/kds/kds.service.ts` — KDS already reads orders; Phase 10 creates them
- `backend/src/kitchen/prep-batches/prep-batches.service.ts` — FIFO deduction pattern reusable for "mark ready" deduction
- `backend/src/inventory/inventory.service.ts` — IngredientStock adjustment for direct-use items
- `backend/src/common/utils/unit-conversion.ts` — convertUnit() for deduction calculations
- `frontend/components/ops/kitchen/kds/` — KDS components already show orders; POS creates them

### Established Patterns
- NestJS Module → Controller → Service → Prisma with $transaction
- React Query for server state, Sonner toast
- Split-screen pattern: similar to dashboard (left content, right sidebar)
- Tabs for category/channel filtering
- Badge for status indicators

### Integration Points
- KDS: Orders created by POS appear on KDS (existing 5s polling)
- Menu: POS reads menu items from Phase 7 endpoints, availability from Phase 9
- Kitchen: "Mark ready" on KDS triggers deduction (new logic wired to existing KDS status update)
- Inventory: Deduction creates StockMovements (existing pattern from Phase 8)
- ChannelModifier: Applied to order total at placement time (Phase 7 data)
- Sidebar: New POS section with Orders, Delivery, History pages

</code_context>

<specifics>
## Specific Ideas

- POS should feel fast — tap items, adjust quantities, place order in under 30 seconds
- The split screen mirrors real POS terminals — menu on left, cart on right
- Delivery queue is important for tracking active deliveries at a glance
- Payment is simple record-keeping — no complex checkout flow

</specifics>

<deferred>
## Deferred Ideas

- Payment gateway integration (Razorpay/Stripe) — v2
- Third-party delivery integration (Swiggy/Zomato) — v2
- Customer self-service ordering — out of scope (staff-operated POS only)

</deferred>

---

*Phase: 10-pos-orders*
*Context gathered: 2026-03-21*
