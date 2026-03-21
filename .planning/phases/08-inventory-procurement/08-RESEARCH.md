# Phase 8: Inventory & Procurement — Research

**Researched:** 2026-03-21
**Domain:** NestJS inventory management + Prisma schema migration + Next.js operational pages
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stock Visibility & Alerts**
- D-01: Dedicated `/operations/inventory` page showing all stock levels by ingredient grouped by zone. Current stock also shown inline on the existing ingredient row as a secondary indicator.
- D-02: Low-stock alerts appear as a warning section on the main dashboard (like KPI alerts in Phase 4) AND as a red badge on ingredient rows when current_quantity < min_stock_level.
- D-03: Stock movements shown as an audit trail on the inventory detail — each entry shows movement_type, quantity, reason, reference, who, when.

**Purchase Order Flow**
- D-04: PO creation on a dedicated full-page form (not Sheet). Select vendor first, then add line items (ingredient, quantity, unit, unit_cost) in an inline table. Running total shown. Save as draft, then mark as ordered.
- D-05: PO statuses: draft → ordered → received → cancelled (from pipeline spec).
- D-06: Receiving is inline on the PO detail page. Each line item shows ordered qty and an editable received_qty field. Admin fills actual amounts (partial receiving supported). Click "Mark as Received" → auto-updates IngredientStock with unit conversion + creates StockMovement entries.
- D-07: PO list page shows all POs with status badges, vendor name, total amount, ordered_at date.

**Procurement Dashboard**
- D-08: Separate `/operations/procurement` page under Operations (not on main dashboard). Shows: pending POs count, low stock alerts count, vendor spend summary (this month), total inventory value.
- D-09: Simple summary cards with NumberTicker values — no charts. Top 3 vendors by spend. Price trends deferred.
- D-10: Procurement + Inventory pages added to Operations sidebar section.

**Data Model (locked by pipeline spec)**
- D-11: IngredientStock — per ingredient per zone, always in base_unit. See pipeline spec §3.5.
- D-12: StockMovement — received/prep_deducted/order_deducted/waste/adjustment with reference_type + reference_id. See pipeline spec §3.5.
- D-13: PurchaseOrder + PurchaseOrderLine — vendor FK, line items with ingredient/qty/unit/unit_cost/received_quantity. See pipeline spec §3.6.

### Claude's Discretion
- Inventory page layout (table vs card grid)
- PO form field layout and validation
- Stock adjustment manual entry UI
- Dashboard card layout and ordering
- How "total inventory value" is calculated (sum of current_quantity × latest vendor price per ingredient)

### Deferred Ideas (OUT OF SCOPE)
- Price trend charts — deferred to future version (v2)
- Automated PO generation from low stock — deferred
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INV-01 | Raw ingredient stock tracking — IngredientStock per ingredient per zone in base_unit, min stock level triggers low-stock alert | Schema confirmed in §3.5; upsert pattern needed for getOrCreate; low-stock alert = backend query on current_quantity < min_stock_level |
| INV-02 | Stock movement audit trail — every change logged as StockMovement (received/prep_deducted/order_deducted/waste/adjustment) with quantity, reason, reference to PO | Schema confirmed in §3.5; StockMovement created atomically inside $transaction alongside stock update |
| INV-03 | Purchase order workflow — PO to vendor with line items, status flow draft→ordered→received, partial receiving, auto-update IngredientStock on receive with unit conversion | Full receiving logic in §4.5; convertUnit() already exists; $transaction required for atomicity |
| INV-04 | Procurement dashboard — pending POs, low stock alerts, vendor spend summary, total inventory value | Derived queries: COUNT(POs where status!=received,cancelled), COUNT(stocks below min), SUM(po_lines * unit_cost this month), SUM(stock * latest_vendor_price) |
</phase_requirements>

---

## Summary

Phase 8 adds 4 new Prisma models (IngredientStock, StockMovement, PurchaseOrder, PurchaseOrderLine) and 3 NestJS modules (inventory, purchase-orders, procurement). The data model is fully locked by the pipeline spec; no design decisions are needed for the schema itself.

The most critical technical concern is the PO receiving transaction: `receivePurchaseOrder` must atomically update PurchaseOrderLine.received_quantity, upsert IngredientStock (getOrCreate pattern), create StockMovement records, update PO status, and recalculate total_amount — all within a single `prisma.$transaction`. If any step fails, no stock update should persist. The `convertUnit()` utility from Phase 7 handles the unit conversion inline.

The frontend introduces two full-page forms (PO creation, PO detail/receiving), three new route pages under `/operations/`, and dashboard widget additions. Patterns are well-established from Phases 4 and 7: MagicCard + NumberTicker for summary stats, table-based lists, Sheet for lightweight forms, and Sonner toasts for async feedback.

**Primary recommendation:** Build backend (schema migration → inventory module → purchase-orders module → procurement module) first, then frontend in parallel plans. The receiving $transaction is the single most complex piece — implement and test it completely in the purchase-orders plan before frontend work.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` | v6 (project constraint) | IngredientStock, StockMovement, PurchaseOrder, PurchaseOrderLine models | Already in backend, all prior phases use it |
| NestJS modules | existing | InventoryModule, PurchaseOrdersModule, ProcurementModule | All prior phases use this pattern |
| `convertUnit()` | local util | PO receiving unit conversion (procurement unit → base_unit) | Phase 7 established, already in `backend/src/common/utils/unit-conversion.ts` |
| `@tanstack/react-query` | existing | Data fetching for inventory, PO list, procurement dashboard | All frontend phases use this |
| `sonner` | existing | Async feedback toasts | Phase 3+ established pattern |

### Supporting (all pre-installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@magicui/number-ticker` | pre-installed | Procurement dashboard stat values | All 4 summary cards |
| `@magicui/magic-card` | pre-installed | Dashboard card containers | Summary cards, PO header card, ingredient detail card |
| `@magicui/animated-list` | pre-installed | Stock movement audit trail animation | StockMovementRow list |
| `@magicui/blur-fade` | pre-installed | Staggered page load animation | Procurement dashboard summary row |
| `@magicui/border-beam` | pre-installed | "Ready to act" signal on containers | PO receiving section, PO line items table |
| `@magicui/shine-border` | pre-installed | New PO creation celebration | ShineBorder on newly created PO card for 3s |
| `@magicui/shimmer-button` | pre-installed | Primary CTAs | "New Purchase Order" on PO list page |
| `@magicui/interactive-hover-button` | pre-installed | Row-level edit actions | "Edit" on draft PO rows |
| `lucide-react` | pre-installed | Icons | PackageSearch (Inventory), ShoppingCart (Purchase Orders), TrendingUp (Procurement) |

**No new npm installs required for this phase.**

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/
├── inventory/                   # New module — INV-01, INV-02
│   ├── inventory.module.ts
│   ├── inventory.controller.ts
│   ├── inventory.service.ts
│   └── dto/
│       ├── create-stock-adjustment.dto.ts
│       └── stock-movement-query.dto.ts
├── purchase-orders/             # New module — INV-03
│   ├── purchase-orders.module.ts
│   ├── purchase-orders.controller.ts
│   ├── purchase-orders.service.ts
│   └── dto/
│       ├── create-purchase-order.dto.ts
│       ├── update-purchase-order.dto.ts
│       └── receive-purchase-order.dto.ts
├── procurement/                 # New module — INV-04
│   ├── procurement.module.ts
│   ├── procurement.controller.ts
│   └── procurement.service.ts

frontend/app/(ops)/operations/
├── inventory/
│   ├── page.tsx                 # /operations/inventory — stock table
│   └── [ingredientId]/
│       └── page.tsx             # /operations/inventory/[id] — movement audit trail
├── purchase-orders/
│   ├── page.tsx                 # /operations/purchase-orders — PO list + tabs
│   ├── new/
│   │   └── page.tsx             # /operations/purchase-orders/new — PO creation form
│   └── [id]/
│       └── page.tsx             # /operations/purchase-orders/[id] — PO detail + receiving
└── procurement/
    └── page.tsx                 # /operations/procurement — dashboard

frontend/components/ops/operations/
├── inventory/
│   ├── InventoryRow.tsx          # Stock table row — ingredient, zone, current_qty, status badge
│   ├── StockMovementRow.tsx      # Audit trail row — type badge, qty, reason, user, date
│   └── StockAdjustmentSheet.tsx  # Manual adjustment Sheet form
├── purchase-orders/
│   ├── PurchaseOrderRow.tsx      # PO list table row
│   ├── PurchaseOrderLineRow.tsx  # Editable line item row (creation form)
│   └── ReceivingLineRow.tsx      # Receiving form row with editable received_qty
└── dashboard/
    └── DashboardLowStockAlert.tsx  # Dashboard widget (mirrors DashboardKpiAlert)

frontend/lib/types/
├── inventory.ts                  # IngredientStock, StockMovement types
└── purchase-order.ts             # PurchaseOrder, PurchaseOrderLine types
```

### Pattern 1: Prisma Schema Migration (Wave 0)

**What:** Add 4 new models to `backend/prisma/schema.prisma`, run `npx prisma migrate dev --name phase_8_inventory`.
**When to use:** Always as the first task in the backend plan.

```prisma
// Source: pipeline spec §3.5
model IngredientStock {
  id               String     @id @default(uuid())
  ingredient_id    String
  zone_id          String
  current_quantity Decimal
  updated_at       DateTime   @updatedAt
  ingredient       Ingredient @relation(fields: [ingredient_id], references: [id])
  zone             Zone       @relation(fields: [zone_id], references: [id])
  StockMovements   StockMovement[]

  @@unique([ingredient_id, zone_id])
}

model StockMovement {
  id                String          @id @default(uuid())
  ingredient_id     String
  zone_id           String
  movement_type     String
  quantity          Decimal
  original_quantity Decimal
  unit              String
  reason            String?
  reference_type    String?
  reference_id      String?
  created_by        String
  created_at        DateTime        @default(now())
  ingredient        Ingredient      @relation(fields: [ingredient_id], references: [id])
  zone              Zone            @relation(fields: [zone_id], references: [id])
  creator           User            @relation(fields: [created_by], references: [id])
  stock             IngredientStock @relation(fields: [ingredient_id, zone_id], references: [ingredient_id, zone_id])
}

model PurchaseOrder {
  id           String              @id @default(uuid())
  vendor_id    String
  status       String              @default("draft")
  total_amount Decimal             @default(0)
  notes        String?
  ordered_by   String
  ordered_at   DateTime?
  received_at  DateTime?
  created_at   DateTime            @default(now())
  updated_at   DateTime            @updatedAt
  vendor       Vendor              @relation(fields: [vendor_id], references: [id])
  ordered_by_user User             @relation(fields: [ordered_by], references: [id])
  lines        PurchaseOrderLine[]
}

model PurchaseOrderLine {
  id                String        @id @default(uuid())
  po_id             String
  ingredient_id     String
  quantity          Decimal
  unit              String
  unit_cost         Decimal
  received_quantity Decimal?
  purchase_order    PurchaseOrder @relation(fields: [po_id], references: [id])
  ingredient        Ingredient    @relation(fields: [ingredient_id], references: [id])
}
```

**IMPORTANT:** The StockMovement → IngredientStock relation via composite key may need to use a different approach. See Pitfall 2 below. Use a direct ingredient_id/zone_id pair lookup in the service layer rather than a Prisma relation — safer and simpler.

### Pattern 2: PO Receiving $transaction (Critical Business Logic)

**What:** Atomic stock update + movement creation when admin marks PO received.
**When to use:** `POST /purchase-orders/:id/receive`

```typescript
// Source: pipeline spec §4.5 + backend/src/common/utils/unit-conversion.ts pattern
async receivePurchaseOrder(poId: string, lines: ReceiveLineDto[], userId: string) {
  return this.prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { lines: true } });
    if (po.status !== 'ordered') throw new BadRequestException('PO must be in ordered status to receive');

    let totalReceived = new Decimal(0);

    for (const lineReceived of lines) {
      if (!lineReceived.received_quantity || lineReceived.received_quantity <= 0) continue;

      const poLine = po.lines.find((l) => l.id === lineReceived.id);
      if (!poLine) continue;

      const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: poLine.ingredient_id } });

      // Convert procurement unit → base_unit
      const qtyBase = await convertUnit(lineReceived.received_quantity, poLine.unit, ingredient.base_unit, this.prisma);
      if (qtyBase === null) throw new BadRequestException(`No conversion from ${poLine.unit} to ${ingredient.base_unit}`);

      // Upsert IngredientStock (getOrCreate pattern)
      // Use default zone — find first zone or require zone_id on line
      const stock = await tx.ingredientStock.upsert({
        where: { ingredient_id_zone_id: { ingredient_id: poLine.ingredient_id, zone_id: DEFAULT_ZONE_ID } },
        create: { ingredient_id: poLine.ingredient_id, zone_id: DEFAULT_ZONE_ID, current_quantity: qtyBase },
        update: { current_quantity: { increment: qtyBase } },
      });

      // Create StockMovement
      await tx.stockMovement.create({
        data: {
          ingredient_id: poLine.ingredient_id,
          zone_id: DEFAULT_ZONE_ID,
          movement_type: 'received',
          quantity: qtyBase,
          original_quantity: lineReceived.received_quantity,
          unit: poLine.unit,
          reference_type: 'purchase_order',
          reference_id: poId,
          created_by: userId,
        },
      });

      // Update line received_quantity
      await tx.purchaseOrderLine.update({
        where: { id: poLine.id },
        data: { received_quantity: lineReceived.received_quantity },
      });

      totalReceived = totalReceived.add(new Decimal(lineReceived.received_quantity).mul(poLine.unit_cost));
    }

    // Mark PO as received
    return tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'received', received_at: new Date(), total_amount: totalReceived },
      include: { lines: { include: { ingredient: true } }, vendor: true },
    });
  });
}
```

### Pattern 3: Zone Resolution for PO Receiving

**What:** The pipeline spec says `getOrCreate IngredientStock(ingredient_id, default_zone_id)` but doesn't specify how to determine the zone. Two strategies:

**Strategy A — PO-level zone:** Add an optional `zone_id` field on PurchaseOrder so the buyer specifies where stock lands on creation.

**Strategy B — First zone fallback:** Use the first active zone from the Zones table as the default if no zone is specified.

**Recommendation (Claude's discretion):** Use Strategy A — add `zone_id` to PurchaseOrder creation form. This is the most explicit and operationally correct for a multi-zone villa (different POs land in different storage areas). Default in the form to the first active zone for convenience. Aligns with the existing Zone model and spec's per-zone stock tracking.

### Pattern 4: getOrCreate IngredientStock

**What:** IngredientStock has a unique composite constraint `[ingredient_id, zone_id]`. On PO receiving, stock may not exist yet for a newly tracked ingredient+zone combination.

**Pattern:** Use Prisma `upsert` with the compound unique field:

```typescript
// Source: Prisma v6 docs — upsert with compound unique
await tx.ingredientStock.upsert({
  where: {
    ingredient_id_zone_id: {
      ingredient_id: poLine.ingredient_id,
      zone_id: zoneId,
    },
  },
  create: {
    ingredient_id: poLine.ingredient_id,
    zone_id: zoneId,
    current_quantity: qtyBase,
  },
  update: {
    current_quantity: { increment: qtyBase },
  },
});
```

Prisma auto-generates the compound unique name as `{field1}_{field2}` — `ingredient_id_zone_id` for this model.

### Pattern 5: Manual Stock Adjustment

**What:** Admin can manually adjust stock (positive or negative) from the Inventory page.

```typescript
// POST /inventory/adjust
async adjustStock(dto: CreateStockAdjustmentDto, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    // Upsert stock
    await tx.ingredientStock.upsert({
      where: { ingredient_id_zone_id: { ingredient_id: dto.ingredient_id, zone_id: dto.zone_id } },
      create: { ingredient_id: dto.ingredient_id, zone_id: dto.zone_id, current_quantity: dto.quantity },
      update: { current_quantity: { increment: dto.quantity } }, // dto.quantity is signed (negative = deduction)
    });
    // Log movement
    return tx.stockMovement.create({
      data: {
        ingredient_id: dto.ingredient_id,
        zone_id: dto.zone_id,
        movement_type: 'adjustment',
        quantity: dto.quantity,
        original_quantity: Math.abs(dto.quantity),
        unit: dto.unit,
        reason: dto.reason,
        reference_type: null,
        reference_id: null,
        created_by: userId,
      },
    });
  });
}
```

### Pattern 6: Procurement Dashboard Queries

**What:** Four summary stats derived from database aggregations.

```typescript
// pending POs
const pendingCount = await this.prisma.purchaseOrder.count({
  where: { status: { in: ['draft', 'ordered'] } },
});

// low stock items (current_quantity < ingredient.min_stock_level)
// Requires a raw query or a post-fetch filter since min_stock_level is on Ingredient, not IngredientStock
const allStocks = await this.prisma.ingredientStock.findMany({
  include: { ingredient: { select: { min_stock_level: true } } },
});
const lowStockCount = allStocks.filter(
  (s) => Number(s.current_quantity) < Number(s.ingredient.min_stock_level)
).length;

// vendor spend this month
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const poLines = await this.prisma.purchaseOrderLine.findMany({
  where: {
    purchase_order: {
      status: { in: ['ordered', 'received'] },
      ordered_at: { gte: monthStart },
    },
  },
  include: { purchase_order: { select: { vendor_id: true, vendor: { select: { name: true } } } } },
});
// group by vendor for top-3 calculation

// total inventory value = SUM(current_quantity * latest VendorPrice)
// Use VendorsService.getLatestPrice() per ingredient
```

**Note:** The low stock cross-table comparison has no efficient Prisma query — use application-level filter after fetching. For MVP scale (< 50 ingredients) this is acceptable. Flag for optimization if needed.

### Pattern 7: Frontend Full-Page PO Form

**What:** Unlike all prior forms (Sheet-based), PO creation is a full page at `/operations/purchase-orders/new`. This matches the recipe wizard pattern but is simpler (no step wizard).

```
/app/(ops)/operations/purchase-orders/new/page.tsx
```

Key difference from Sheet pattern: router.push/router.back for navigation, no open/onOpenChange state.

**State management:** All line item state lives in the page component (not child components). On submit, construct the full payload and POST `/purchase-orders`.

### Pattern 8: Inventory Page Table Layout

From the UI-SPEC and aligned with existing pages (ingredients, vendors, channels), the inventory page uses a plain HTML table inside `rounded-lg border overflow-hidden` with `thead.bg-muted/40`. No shadcn `Table` component needed — raw table markup consistent with IngredientRow pattern.

### Anti-Patterns to Avoid

- **Creating StockMovement outside a transaction:** Never call `prisma.stockMovement.create()` separately from the stock update — they must be atomic. If the movement creation fails but stock was updated, data is corrupt.
- **Fetching all POs for vendor spend calculation:** Use Prisma `where` with `ordered_at: { gte: monthStart }` to limit data loaded.
- **Using Sheet for PO creation:** CONTEXT.md D-04 locks this as a full-page form. The recipe wizard Sheet pattern does NOT apply here.
- **Converting units outside the transaction:** `convertUnit()` reads from DB but uses an in-memory cache — safe to call inside `$transaction`. Do not pre-compute outside and pass in, as cache may be stale.
- **Checking stock availability without zone_id:** IngredientStock is zone-specific. Always filter by both `ingredient_id` AND `zone_id` when reading stock levels.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unit conversion | Custom conversion logic | `convertUnit()` in `backend/src/common/utils/unit-conversion.ts` | Phase 7 tested, handles same/different units, uses cached DB table |
| Vendor latest price lookup | Manual VendorPrice sort | `VendorsService.getLatestPrice(ingredientId)` | Already implemented, sorts by effective_date desc |
| Toast notifications | Custom toast components | `sonner` (already installed, Toaster mounted in root) | Phase 3+ established pattern |
| Animated counters | CSS animation | `NumberTicker` from `@/components/ui/number-ticker` | Phase 4+ established pattern |
| Low-stock alert widget | Custom alert card | Mirror `DashboardKpiAlert` pattern with `MagicCard` + link | Phase 4 established pattern, UI-SPEC requires visual consistency |
| Compound unique index lookup | Manual findFirst + where | Prisma `upsert` with `ingredient_id_zone_id` compound key | Prisma auto-generates the compound accessor name |
| PO status badge colors | Custom status-to-color logic | Match Phase 7 VendorPrice/RecipeStatus pattern: object map `STATUS_BADGE_CLASSES` | Consistent with existing badge patterns |

---

## Common Pitfalls

### Pitfall 1: StockMovement relation on composite key
**What goes wrong:** Defining a Prisma `@relation` on StockMovement pointing back to IngredientStock via the composite key `[ingredient_id, zone_id]` causes migration complexity — Prisma requires all fields in the relation to be non-optional on both sides.
**Why it happens:** IngredientStock uses a compound unique `@@unique([ingredient_id, zone_id])` not a single FK column. Prisma composite relations require matching field combinations and careful syntax.
**How to avoid:** Do NOT add a `stock IngredientStock @relation(...)` to StockMovement. Simply store `ingredient_id` and `zone_id` separately on StockMovement and look up the stock record independently when needed. The audit trail already has what it needs (ingredient + zone + quantity). Remove the composite relation from the schema shown in the patterns above — the service layer handles the join.
**Warning signs:** Migration error "Foreign key constraint failed" or "Relation field 'stock' must be required on exactly one side."

### Pitfall 2: convertUnit() inside prisma.$transaction
**What goes wrong:** `convertUnit()` calls `loadConversions(prisma)` which does `prisma.unitConversion.findMany()`. Inside a `prisma.$transaction`, you must pass the transaction client (`tx`), not the raw `this.prisma` instance.
**Why it happens:** The conversion utility accepts `prisma: any` — passing `this.prisma` inside a transaction bypasses transaction isolation.
**How to avoid:** Pass `tx` as the prisma argument when calling `convertUnit()` inside a transaction block. The in-memory cache (`conversionCache`) avoids extra DB calls on subsequent conversions within the same transaction.
**Warning signs:** Unit conversions succeed but are not rolled back when the transaction fails.

### Pitfall 3: Zone ID for PO receiving — where does it come from?
**What goes wrong:** The pipeline spec says `getOrCreate IngredientStock(ingredient_id, default_zone_id)` but doesn't define what "default" means. Implementing receiving without zone_id on the PO creates stock in an ambiguous zone.
**Why it happens:** The spec was written at a design level; the PO receiving form didn't exist when the spec was written.
**How to avoid:** Add `zone_id` field to `PurchaseOrder` model. Frontend PO creation form includes a Zone Select (defaults to first active zone). Backend receiving logic reads `po.zone_id`. See Architecture Pattern 3.
**Warning signs:** Stock records created with a hardcoded/null zone_id that can't be traced back.

### Pitfall 4: Decimal type in Prisma vs JavaScript number
**What goes wrong:** Prisma returns `Decimal` objects for fields typed `Decimal` in the schema. JavaScript comparison `stock.current_quantity < ingredient.min_stock_level` will fail silently (comparing Decimal object to Decimal object uses object reference, not value).
**Why it happens:** Prisma v6 preserves precision via `Decimal` (from the `decimal.js` library). Direct comparison with `<`, `>` returns unexpected results.
**How to avoid:** Convert to `Number()` for comparisons: `Number(s.current_quantity) < Number(s.ingredient.min_stock_level)`. For arithmetic accumulation in the receiving function, use `Decimal` methods: `new Decimal(a).add(b)`.
**Warning signs:** Low-stock alerts never trigger, or trigger for all items regardless of quantity.

### Pitfall 5: Frontend PO line item state — re-renders on every keystroke
**What goes wrong:** Storing all line items in a single `useState<LineItem[]>` and updating one field causes the entire table to re-render, making numeric inputs feel laggy.
**Why it happens:** React re-renders all array item components when the parent state updates.
**How to avoid:** Use a `useReducer` or keyed stable references. Alternatively, use `useCallback` for the onChange handler per row with stable `index` reference. The recipe BOM line pattern in `RecipeWizardStep2.tsx` handles this with individual index-based updaters — mirror that pattern.
**Warning signs:** Typing in quantity or unit_cost fields is noticeably slow when there are 5+ line items.

### Pitfall 6: Sidebar imports for new Lucide icons
**What goes wrong:** Adding new nav items to `Sidebar.tsx` requires importing the icons at the top of the file. Forgetting to add the import causes a build error.
**Why it happens:** Lucide-react uses named exports; unused imports are tree-shaken but missing ones are build errors.
**How to avoid:** Add `PackageSearch`, `ShoppingCart`, `TrendingUp` to the existing lucide-react import block at the top of `frontend/components/ops/Sidebar.tsx`. Confirmed: these icons exist in lucide-react (verified against Phase 7 pattern where similar icons were added).
**Warning signs:** Build error: "PackageSearch is not exported from lucide-react."

### Pitfall 7: Procurement vendor spend query — cancelled POs
**What goes wrong:** Including `draft` POs in the vendor spend summary inflates numbers with orders that haven't been placed yet.
**Why it happens:** Filtering only on month date but not status.
**How to avoid:** Filter vendor spend on `status: { in: ['ordered', 'received'] }` AND `ordered_at: { gte: monthStart }`. Draft POs have no `ordered_at` so they're excluded anyway, but explicit status filter is safer and clearer.

---

## Code Examples

### Inventory API Endpoints

```typescript
// Source: NestJS module pattern consistent with existing modules

// GET /inventory — all stock levels with ingredient + zone info
// GET /inventory/:ingredientId/movements — paginated StockMovement audit trail
// POST /inventory/adjust — manual stock adjustment (creates StockMovement)

@Controller('inventory')
export class InventoryController {
  @Get()
  @RequirePermission('VIEW_INVENTORY')
  findAll() { return this.inventoryService.findAll(); }

  @Get(':ingredientId/movements')
  @RequirePermission('VIEW_INVENTORY')
  getMovements(@Param('ingredientId') id: string) {
    return this.inventoryService.getMovements(id);
  }

  @Post('adjust')
  @RequirePermission('MANAGE_INVENTORY')
  adjust(@Body() dto: CreateStockAdjustmentDto, @Request() req) {
    return this.inventoryService.adjustStock(dto, req.user.id);
  }
}
```

### Purchase Order API Endpoints

```typescript
// GET  /purchase-orders         — list all POs (with status filter)
// POST /purchase-orders         — create new PO (status: draft)
// GET  /purchase-orders/:id     — get single PO with lines
// PATCH /purchase-orders/:id    — update status (draft→ordered) or notes
// POST /purchase-orders/:id/receive — receiving flow (status→received, stock update)
// POST /purchase-orders/:id/cancel  — cancel PO (draft or ordered only)
```

### Frontend Type Definitions

```typescript
// frontend/lib/types/inventory.ts
export type StockMovementType = 'received' | 'prep_deducted' | 'order_deducted' | 'waste' | 'adjustment';

export interface IngredientStock {
  id: string;
  ingredient_id: string;
  zone_id: string;
  current_quantity: number;
  updated_at: string;
  ingredient?: { id: string; name: string; category: string; base_unit: string; min_stock_level: number };
  zone?: { id: string; name: string };
}

export interface StockMovement {
  id: string;
  ingredient_id: string;
  zone_id: string;
  movement_type: StockMovementType;
  quantity: number;        // in base_unit, signed (+/-)
  original_quantity: number;
  unit: string;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string;
  created_at: string;
  creator?: { id: string; name: string };
}

// frontend/lib/types/purchase-order.ts
export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  received_quantity: number | null;
  ingredient?: { id: string; name: string; base_unit: string };
}

export interface PurchaseOrder {
  id: string;
  vendor_id: string;
  zone_id: string;
  status: PurchaseOrderStatus;
  total_amount: number;
  notes: string | null;
  ordered_by: string;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { id: string; name: string };
  lines?: PurchaseOrderLine[];
}
```

### Low Stock Comparison Pattern

```typescript
// Correct Decimal comparison in service layer
const lowStockItems = allStocks.filter((stock) =>
  Number(stock.current_quantity) < Number(stock.ingredient.min_stock_level)
);

// Correct Decimal arithmetic in receiving transaction
let totalAmount = new Decimal(0);
for (const line of receivedLines) {
  totalAmount = totalAmount.add(
    new Decimal(line.received_quantity).mul(new Decimal(poLine.unit_cost))
  );
}
```

### IngredientRow Enhancement (Adding Stock Inline)

```typescript
// frontend/components/ops/operations/ingredients/IngredientRow.tsx
// Add stock prop — fetched alongside ingredients via expanded query
interface IngredientRowProps {
  ingredient: Ingredient;
  stock?: IngredientStock | null;   // NEW: current stock for this ingredient
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (ingredient: Ingredient) => void;
  isAdmin: boolean;
}

// In the row:
const isLowStock = stock && Number(stock.current_quantity) < ingredient.min_stock_level;
// Display: font-mono text-xs, amber if low
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Track inventory in spreadsheets | IngredientStock per ingredient per zone, real-time | Phase 8 | Enables Phase 9 prep deductions and Phase 10 order deductions |
| Manual procurement tracking | PO workflow with audit trail | Phase 8 | Procurement Lead can track vendor spend and order history |
| No stock visibility on dashboard | Low-stock alert widget (mirrors KPI alerts) | Phase 8 | Operational urgency surfaced in Mission Control |

---

## Open Questions

1. **Zone on PurchaseOrder**
   - What we know: The pipeline spec doesn't include `zone_id` on PurchaseOrder, but IngredientStock requires a zone.
   - What's unclear: Should all line items in one PO land in the same zone, or can different line items go to different zones?
   - Recommendation: Add `zone_id` to `PurchaseOrder` (single zone per PO — simpler UX). The PO creation form shows a Zone Select. This is the Claude's discretion area from CONTEXT.md. If multi-zone is needed in future, it's a PurchaseOrderLine-level change.

2. **MANAGE_INVENTORY permission**
   - What we know: Existing permission system uses `MANAGE_OPS`, `MANAGE_RECIPES`, `MANAGE_KPIS` style permissions. Phase 8 needs new permissions.
   - What's unclear: Whether to add new `VIEW_INVENTORY`, `MANAGE_INVENTORY`, `MANAGE_PROCUREMENT` permissions or reuse `MANAGE_OPS`.
   - Recommendation: Add `MANAGE_INVENTORY` and `MANAGE_PROCUREMENT` as new permissions. Procurement Lead role gets both. All authenticated users get `VIEW_INVENTORY` (consistent with Phase 6 decision that Operations is visible to all). Admin migration seed must be updated.

3. **Ingredient page stock query performance**
   - What we know: The ingredient page currently does `GET /ingredients`. Adding stock inline requires either (a) fetching all IngredientStock alongside ingredients, or (b) a new `GET /ingredients/with-stock` endpoint.
   - What's unclear: Best join strategy.
   - Recommendation: Modify `GET /inventory` to return stock keyed by `ingredient_id` (since that's what the inventory page needs). The ingredient page does a second `GET /inventory` query and merges by ingredient_id client-side. React Query caches both independently. This avoids modifying the existing ingredients endpoint.

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test files found in backend/src/ or frontend/ |
| Config file | None — Wave 0 must create |
| Quick run command | `cd backend && npx jest --testPathPattern=inventory --passWithNoTests` |
| Full suite command | `cd backend && npx jest --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-01 | IngredientStock upsert creates record with correct base_unit quantity | unit | `cd backend && npx jest inventory.service --passWithNoTests` | Wave 0 |
| INV-01 | Low-stock query returns ingredients where current_quantity < min_stock_level | unit | `cd backend && npx jest inventory.service --passWithNoTests` | Wave 0 |
| INV-02 | StockMovement created atomically with stock update | unit | `cd backend && npx jest inventory.service --passWithNoTests` | Wave 0 |
| INV-02 | StockMovement rollback if stock update fails | unit | `cd backend && npx jest inventory.service --passWithNoTests` | Wave 0 |
| INV-03 | PO receiving converts quantity to base_unit correctly | unit | `cd backend && npx jest purchase-orders.service --passWithNoTests` | Wave 0 |
| INV-03 | PO receiving partial amounts (received_qty < ordered_qty) accepted | unit | `cd backend && npx jest purchase-orders.service --passWithNoTests` | Wave 0 |
| INV-03 | PO status transitions blocked (received → ordered is invalid) | unit | `cd backend && npx jest purchase-orders.service --passWithNoTests` | Wave 0 |
| INV-04 | Procurement summary returns correct pending PO count | unit | `cd backend && npx jest procurement.service --passWithNoTests` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx jest --passWithNoTests 2>&1 | tail -5`
- **Per wave merge:** `cd backend && npx jest --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/inventory/inventory.service.spec.ts` — covers INV-01, INV-02 unit tests
- [ ] `backend/src/purchase-orders/purchase-orders.service.spec.ts` — covers INV-03 unit tests
- [ ] `backend/src/procurement/procurement.service.spec.ts` — covers INV-04 unit tests
- [ ] Jest config: `cd backend && npm install --save-dev jest @types/jest ts-jest` if not present

---

## Sources

### Primary (HIGH confidence)
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §3.5, §3.6, §4.5 — IngredientStock, StockMovement, PurchaseOrder schema and receiving logic
- `backend/prisma/schema.prisma` — confirmed existing models (Ingredient, Zone, Vendor, User) that new models FK into
- `backend/src/common/utils/unit-conversion.ts` — `convertUnit()` signature and behavior confirmed by reading source
- `backend/src/vendors/vendors.service.ts` — `getLatestPrice()` method confirmed for inventory valuation
- `frontend/components/ops/dashboard/DashboardKpiAlert.tsx` — DashboardLowStockAlert pattern confirmed
- `frontend/components/ops/Sidebar.tsx` — operationsNav array confirmed, insertion point for new nav items
- `frontend/app/(ops)/operations/ingredients/page.tsx` — table pattern, query invalidation, Sheet pattern confirmed
- `backend/src/app.module.ts` — module registration pattern confirmed

### Secondary (MEDIUM confidence)
- Prisma v6 `upsert` compound unique syntax — confirmed from project constraint (Prisma v6, STATE.md decision `[01-01]: Prisma v6 used`) and general Prisma compound unique naming convention (`field1_field2`)
- Decimal arithmetic pattern (`new Decimal().add()`) — confirmed by Prisma v6 behavior with Decimal fields

### Tertiary (LOW confidence — validate during implementation)
- Jest setup for backend — no test files found in codebase; need to verify if Jest is already in `backend/package.json` before Wave 0 gap creation

---

## Metadata

**Confidence breakdown:**
- Data model: HIGH — locked by pipeline spec §3.5-3.6, matches existing schema conventions
- Business logic: HIGH — receiving transaction documented in §4.5, convertUnit() already implemented
- Frontend patterns: HIGH — all UI patterns established in Phases 4, 6, 7 and confirmed by reading source files
- Permissions: MEDIUM — naming convention is clear but exact permission codes need to be confirmed against existing `backend/src/permissions/` definitions
- Test setup: LOW — no existing tests found; Jest installation status unknown

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable tech, 30-day window)
