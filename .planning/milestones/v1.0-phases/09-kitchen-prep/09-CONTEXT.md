# Phase 9: Kitchen & Prep - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Kitchen operational layer: prep batch system (recipe × qty → deduct raw + sub-batches → create PrepBatch), kitchen display system (KDS) with polling for real-time order view, menu availability from both prep and raw stock levels, waste logging with structured reasons and auto-calculated cost impact, and prep batch expiry handling. Data model locked in pipeline spec §3.7. No order creation (Phase 10), no customer-facing display (Phase 13).

</domain>

<decisions>
## Implementation Decisions

### Prep Batch Creation
- **D-01:** Multi-step wizard: Step 1 = select recipe + quantity + zone. Step 2 = review deductions with availability check (shows each input with current available qty vs required qty). Step 3 = confirm. If any input is insufficient, highlight in red and disable confirm button.
- **D-02:** Prep batch list shows FIFO order (oldest first). Columns: recipe name, quantity remaining/produced, unit, expires in (countdown), status badge. Expired batches shown in red.
- **D-03:** New "Kitchen" sidebar section (separate from Operations): Prep Batches, KDS, Waste Log.

### Kitchen Display System (KDS)
- **D-04:** Order cards in columns grouped by zone (Main Kitchen, Prep Station, etc.). Each card: order #, items with status, customer name, elapsed timer.
- **D-05:** Full-screen dedicated view (hides sidebar). Designed for kitchen monitor/tablet. Large touch targets, high contrast. Toggle to exit full-screen.
- **D-06:** Tap item to advance status: pending → preparing → ready. Visual color change + Sonner toast. When all items ready, order card highlights as complete.
- **D-07:** Color-coded elapsed timer per order: green (<10 min), amber (10-20 min), red (>20 min). Updates every second.
- **D-08:** Visual flash only for new orders — BorderBeam animation on new order cards for 3 seconds. No sound.
- **D-09:** Fixed 5-second polling interval for new/updated orders.
- **D-10:** Completed orders auto-hide after 30 seconds with fade-out. Keeps display clean.

### Menu Availability
- **D-11:** Servings remaining count shown per menu item: "X servings left" based on minimum availability across all BOM inputs. When 0, shows "Sold Out" in red.

### Waste Logging
- **D-12:** Dedicated waste page with history table and form section. Form: select type (ingredient/prep_batch), select item, quantity + unit, reason (spoilage/over_prep/cooking_error/expired/other), optional notes. System auto-calculates cost impact.

### Prep Batch Expiry
- **D-13:** Expired batches get red "Expired" badge on prep batch list. Hourly cron auto-creates WasteLog entries for expired batches and marks status=expired. No KDS notification.
- **D-14:** PrepBatch.expires_at auto-set on creation: created_at + recipe.shelf_life_hours. Expired batches excluded from availability calculations and FIFO deduction.

### Kitchen Metrics
- **D-15:** Kitchen metrics section (on KDS page or separate): orders in queue, prep batch levels, average prep time, waste percentage, items completed today.

### Data Model (locked by pipeline spec)
- **D-16:** PrepBatch — see pipeline spec §3.7. recipe_id, zone_id, quantity_produced, quantity_remaining, unit, prepared_by, expires_at, status (active/depleted/expired).
- **D-17:** WasteLog — see pipeline spec §3.7. waste_type, ingredient_id/prep_batch_id, quantity, unit, reason, reason_notes, cost_impact, logged_by, zone_id.

### Claude's Discretion
- KDS full-screen layout implementation (CSS fullscreen API vs route-based)
- Elapsed timer component implementation
- How "servings remaining" is calculated endpoint-side (min across BOM inputs)
- Cron job implementation for expiry (NestJS @Cron or simple setInterval)
- Kitchen metrics card layout
- Prep wizard step transitions and animations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Food Production Pipeline Spec (PRIMARY)
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §3.7 — PrepBatch, WasteLog schema
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §3.8 — Order, OrderItem schema (KDS reads these)
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §4.1 — Prep batch deduction logic (FIFO for sub-batches)
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §4.4 — Menu availability calculation algorithm
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §4.7 — Expiry handling and waste auto-logging

### Existing Implementation
- `backend/src/recipes/recipes.service.ts` — Recipe CRUD, BOM data (Phase 7)
- `backend/src/recipes/cost-calculator.service.ts` — Cost calculation for waste cost_impact
- `backend/src/inventory/inventory.service.ts` — IngredientStock queries + StockMovement creation (Phase 8)
- `backend/src/common/utils/unit-conversion.ts` — convertUnit() for deduction calculations
- `backend/src/menu/menu.service.ts` — MenuItem queries (Phase 7)

### Requirements
- `.planning/REQUIREMENTS.md` — KITCHEN-01 through KITCHEN-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/common/utils/unit-conversion.ts` — convertUnit() for prep batch deductions
- `backend/src/inventory/inventory.service.ts` — adjustStock pattern for prep deductions
- `backend/src/recipes/cost-calculator.service.ts` — Cost calculation for waste cost_impact
- `frontend/components/ui/border-beam.tsx` — BorderBeam for new order flash on KDS
- `frontend/components/ui/number-ticker.tsx` — NumberTicker for kitchen metrics

### Established Patterns
- NestJS Module → Controller → Service → Prisma with $transaction
- React Query polling via refetchInterval for KDS
- Sonner toast for status updates
- Wizard pattern from Recipe (Phase 7) — reuse for prep batch creation

### Integration Points
- Sidebar: New "Kitchen" section with 3 nav items
- Inventory: Prep batch creation deducts from IngredientStock (creates StockMovement with type="prep_deducted")
- Menu: Availability endpoint checks PrepBatch.quantity_remaining + IngredientStock.current_quantity
- Orders: KDS reads orders (Phase 10 creates them, Phase 9 displays them)
- Recipe: PrepBatch references recipe_id, uses recipe.shelf_life_hours for expiry

</code_context>

<specifics>
## Specific Ideas

- KDS should feel like a real kitchen display — full-screen, large text, high contrast, touch-optimized. Not a regular admin page.
- The elapsed timer creates urgency — red orders demand attention
- Prep batch wizard with stock check prevents failed transactions — kitchen staff shouldn't hit errors mid-service
- FIFO ordering on prep batches ensures freshness — oldest batches get used first

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-kitchen-prep*
*Context gathered: 2026-03-21*
