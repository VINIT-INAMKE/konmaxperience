# Phase 8: Inventory & Procurement - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Raw ingredient stock tracking (IngredientStock per ingredient per zone), stock movement audit trail (StockMovement), purchase order workflow (PO → vendor → receive → stock update), and procurement dashboard. Data model locked in pipeline spec §3.5-3.6. No prep batches (Phase 9), no order deductions (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Stock Visibility & Alerts
- **D-01:** Dedicated `/operations/inventory` page showing all stock levels by ingredient grouped by zone. Current stock also shown inline on the existing ingredient row as a secondary indicator.
- **D-02:** Low-stock alerts appear as a warning section on the main dashboard (like KPI alerts in Phase 4) AND as a red badge on ingredient rows when current_quantity < min_stock_level.
- **D-03:** Stock movements shown as an audit trail on the inventory detail — each entry shows movement_type, quantity, reason, reference, who, when.

### Purchase Order Flow
- **D-04:** PO creation on a dedicated full-page form (not Sheet). Select vendor first, then add line items (ingredient, quantity, unit, unit_cost) in an inline table. Running total shown. Save as draft, then mark as ordered.
- **D-05:** PO statuses: draft → ordered → received → cancelled (from pipeline spec).
- **D-06:** Receiving is inline on the PO detail page. Each line item shows ordered qty and an editable received_qty field. Admin fills actual amounts (partial receiving supported). Click "Mark as Received" → auto-updates IngredientStock with unit conversion + creates StockMovement entries.
- **D-07:** PO list page shows all POs with status badges, vendor name, total amount, ordered_at date.

### Procurement Dashboard
- **D-08:** Separate `/operations/procurement` page under Operations (not on main dashboard). Shows: pending POs count, low stock alerts count, vendor spend summary (this month), total inventory value.
- **D-09:** Simple summary cards with NumberTicker values — no charts. Top 3 vendors by spend. Price trends deferred.
- **D-10:** Procurement + Inventory pages added to Operations sidebar section.

### Data Model (locked by pipeline spec)
- **D-11:** IngredientStock — per ingredient per zone, always in base_unit. See pipeline spec §3.5.
- **D-12:** StockMovement — received/prep_deducted/order_deducted/waste/adjustment with reference_type + reference_id. See pipeline spec §3.5.
- **D-13:** PurchaseOrder + PurchaseOrderLine — vendor FK, line items with ingredient/qty/unit/unit_cost/received_quantity. See pipeline spec §3.6.

### Claude's Discretion
- Inventory page layout (table vs card grid)
- PO form field layout and validation
- Stock adjustment manual entry UI
- Dashboard card layout and ordering
- How "total inventory value" is calculated (sum of current_quantity × latest vendor price per ingredient)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Food Production Pipeline Spec (PRIMARY)
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §3.5 — IngredientStock, StockMovement schema
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §3.6 — PurchaseOrder, PurchaseOrderLine schema
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §4.3 — PO receiving logic (stock update + movement creation)

### Existing Implementation
- `backend/src/ingredients/ingredients.service.ts` — Ingredient CRUD (Phase 7)
- `backend/src/vendors/vendors.service.ts` — Vendor + VendorPrice (Phase 7)
- `backend/src/common/utils/unit-conversion.ts` — Unit conversion utility (Phase 7)
- `backend/prisma/schema.prisma` — Ingredient, Vendor, Zone models already exist

### Requirements
- `.planning/REQUIREMENTS.md` — INV-01 through INV-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/common/utils/unit-conversion.ts` — convertUnit() for PO receiving (procurement unit → base_unit)
- `backend/src/vendors/vendors.service.ts` — getLatestPrice() for inventory valuation
- `frontend/components/ops/operations/` — Operations page patterns
- `frontend/components/ui/number-ticker.tsx` — NumberTicker for dashboard summary values

### Established Patterns
- NestJS Module → Controller → Service → Prisma with $transaction for multi-step operations
- Sheet for simple forms, full-page for complex forms (PO creation matches recipe wizard pattern)
- Sidebar Operations section for nav
- Dashboard alert widgets (readiness strip, KPI alerts patterns from Phase 4)

### Integration Points
- Sidebar: Add Inventory, Purchase Orders, Procurement to Operations section
- Main dashboard: Add low-stock alert widget (same pattern as KPI alerts)
- Ingredients page: Add stock level inline indicator
- Unit conversion: Reuse convertUnit() for PO receiving stock updates
- VendorPrice: Reuse for inventory valuation calculation

</code_context>

<specifics>
## Specific Ideas

- PO receiving should feel transactional — fill in received quantities, one click to process, stock updates atomically
- Low-stock alerts on the dashboard create urgency — "these ingredients need to be ordered"
- The stock movement audit trail is the governance backbone for inventory — every gram accounted for

</specifics>

<deferred>
## Deferred Ideas

- Price trend charts — deferred to future version (v2)
- Automated PO generation from low stock — deferred

</deferred>

---

*Phase: 08-inventory-procurement*
*Context gathered: 2026-03-21*
