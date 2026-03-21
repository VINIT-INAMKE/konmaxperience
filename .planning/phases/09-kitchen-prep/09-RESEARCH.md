# Phase 9: Kitchen & Prep — Research

**Researched:** 2026-03-21
**Domain:** NestJS kitchen modules (PrepBatch, KDS, WasteLog), React Query polling, NestJS scheduled tasks, FIFO deduction transactions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Prep Batch Creation**
- D-01: Multi-step wizard: Step 1 = select recipe + quantity + zone. Step 2 = review deductions with availability check (shows each input with current available qty vs required qty). Step 3 = confirm. If any input is insufficient, highlight in red and disable confirm button.
- D-02: Prep batch list shows FIFO order (oldest first). Columns: recipe name, quantity remaining/produced, unit, expires in (countdown), status badge. Expired batches shown in red.
- D-03: New "Kitchen" sidebar section (separate from Operations): Prep Batches, KDS, Waste Log.

**Kitchen Display System (KDS)**
- D-04: Order cards in columns grouped by zone. Each card: order #, items with status, customer name, elapsed timer.
- D-05: Full-screen dedicated view (hides sidebar). Designed for kitchen monitor/tablet. Large touch targets, high contrast. Toggle to exit full-screen.
- D-06: Tap item to advance status: pending → preparing → ready. Visual color change + Sonner toast. When all items ready, order card highlights as complete.
- D-07: Color-coded elapsed timer per order: green (<10 min), amber (10-20 min), red (>20 min). Updates every second.
- D-08: Visual flash only for new orders — BorderBeam animation on new order cards for 3 seconds. No sound.
- D-09: Fixed 5-second polling interval for new/updated orders.
- D-10: Completed orders auto-hide after 30 seconds with fade-out. Keeps display clean.

**Menu Availability**
- D-11: Servings remaining count shown per menu item: "X servings left" based on minimum availability across all BOM inputs. When 0, shows "Sold Out" in red.

**Waste Logging**
- D-12: Dedicated waste page with history table and form section. Form: select type (ingredient/prep_batch), select item, quantity + unit, reason (spoilage/over_prep/cooking_error/expired/other), optional notes. System auto-calculates cost impact.

**Prep Batch Expiry**
- D-13: Expired batches get red "Expired" badge on prep batch list. Hourly cron auto-creates WasteLog entries for expired batches and marks status=expired. No KDS notification.
- D-14: PrepBatch.expires_at auto-set on creation: created_at + recipe.shelf_life_hours. Expired batches excluded from availability calculations and FIFO deduction.

**Kitchen Metrics**
- D-15: Kitchen metrics section (on KDS page or separate): orders in queue, prep batch levels, average prep time, waste percentage, items completed today.

**Data Model (locked by pipeline spec)**
- D-16: PrepBatch — recipe_id, zone_id, quantity_produced, quantity_remaining, unit, prepared_by, expires_at, status (active/depleted/expired).
- D-17: WasteLog — waste_type, ingredient_id/prep_batch_id, quantity, unit, reason, reason_notes, cost_impact, logged_by, zone_id.

### Claude's Discretion
- KDS full-screen layout implementation (CSS fullscreen API vs route-based)
- Elapsed timer component implementation
- How "servings remaining" is calculated endpoint-side (min across BOM inputs)
- Cron job implementation for expiry (NestJS @Cron or simple setInterval)
- Kitchen metrics card layout
- Prep wizard step transitions and animations

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KITCHEN-01 | Prep batch system — select recipe × quantity, auto-deducts inputs per BOM (raw ingredients from IngredientStock, prep items from other PrepBatches via FIFO), creates PrepBatch with quantity_remaining. All in single $transaction. | Pipeline spec §4.3 fully specifies FIFO logic. Existing inventory.service.ts + convertUnit() pattern maps directly. |
| KITCHEN-02 | Kitchen display (KDS) — polls for orders with status placed/preparing every 5 seconds, grouped by zone. Cook taps to update item status (pending → preparing → ready). | React Query refetchInterval:5000 confirmed. Order/OrderItem models in schema §3.8. KDS is read-only in Phase 9 — order status update endpoint also needed. |
| KITCHEN-03 | Menu availability — checks BOTH PrepBatch levels AND raw IngredientStock for each RecipeLine. Shows servings remaining on POS. Auto-marks "sold out" when any input insufficient. Alerts kitchen to prep more. | Pipeline spec §4.1 defines getServingsAvailable() algorithm. Endpoint is GET /menu/availability — called by Phase 10 POS; Phase 9 creates the endpoint only. |
| KITCHEN-04 | Waste logging — WasteLog with type, structured reason, auto-calculated cost impact. Expired PrepBatches auto-create waste entries via scheduled job. | WasteLog schema in §3.7. CostCalculatorService.calculateRecipeCost() for prep_batch cost_impact. Ingredient cost via VendorPrice for ingredient waste. |
| KITCHEN-05 | Kitchen metrics — orders in queue, prep batch levels, average prep time, waste percentage, items completed today. | Aggregation queries on Order/OrderItem/PrepBatch/WasteLog. Mirrors ProcurementService.getSummary() pattern. |
| KITCHEN-06 | PrepBatch expiry — shelf_life_hours on Recipe, expires_at auto-set on PrepBatch creation, expired batches excluded from availability, hourly cron marks expired + logs waste. | @nestjs/schedule @Cron decorator. Spec §4.6 defines logic. @nestjs/schedule v4.1.1 compatible with NestJS 11. |
</phase_requirements>

---

## Summary

Phase 9 builds the kitchen operational layer on top of the Phase 7 recipe + Phase 8 inventory foundation. All six requirements converge around two new Prisma models (PrepBatch, WasteLog) and four NestJS modules (KitchenModule, KdsModule, WasteModule, KitchenMetricsModule — or combined into KitchenModule with separate controllers).

The most complex unit is KITCHEN-01: the prep batch creation transaction must FIFO-deduct sub-recipe batches, convert units throughout, and check availability in a single `$transaction`. This exact pattern is specified in pipeline spec §4.3 and follows the same structure as the existing `receivePurchaseOrder` in purchase-orders.service.ts. The deduction preview endpoint (Step 2 of the wizard) must perform the same availability check without writing — this is a separate read-only calculation endpoint.

The KDS (KITCHEN-02) is architecturally simpler than it looks: it reads Order + OrderItem data that Phase 10 will write. Phase 9's job is to (a) add the Order/OrderItem models to the Prisma schema, (b) create the KDS polling endpoint, and (c) create the item status update endpoint. The full-screen layout hides the sidebar using CSS `position: fixed; inset: 0; z-index: 50` rather than a separate layout segment — this avoids duplicating the auth guard logic and is the approach confirmed by the UI-SPEC.

The expiry cron (KITCHEN-06) requires installing `@nestjs/schedule` (v6.1.1, compatible with NestJS 11) — it is NOT currently in backend/package.json and must be added as a new dependency.

**Primary recommendation:** Implement in 4 backend plans: (1) Prisma schema + KitchenModule scaffold, (2) PrepBatch CRUD + FIFO deduction logic, (3) KDS endpoints + WasteLog + metrics + expiry cron, (4) Menu availability endpoint. Frontend in 2 plans: (5) Prep Batches page + Sidebar Kitchen section, (6) KDS full-screen + Waste Log page.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/schedule | 6.1.1 | `@Cron` decorator for hourly expiry job | Official NestJS scheduler, zero config, pairs with ScheduleModule.forRoot() |
| @tanstack/react-query | ^5.91.2 (installed) | refetchInterval polling for KDS | Already installed, project standard for all data fetching |
| Prisma v6 | ^6.19.2 (installed) | PrepBatch + WasteLog models | Project constraint — Prisma 6 only |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^2.0.7 (installed) | KDS item status toast, expiry auto-waste toast | Already wired in root providers since Phase 3 |
| BorderBeam | pre-installed MagicUI | New order card flash (3s) on KDS | Already installed from Phase 5 |
| NumberTicker | pre-installed MagicUI | Kitchen metrics numbers | Already installed from Phase 4 |

### Installation (new dependency only)
```bash
# Backend — install @nestjs/schedule
cd backend && npm install @nestjs/schedule
```

**Version verification (performed 2026-03-21):**
- `@nestjs/schedule` latest: 6.1.1 (verified via npm registry)
- All other packages already installed at confirmed versions

---

## Architecture Patterns

### Recommended Backend Module Structure
```
backend/src/
├── kitchen/
│   ├── kitchen.module.ts           — registers PrepBatchesController, KdsController, WasteController, KitchenMetricsController, KitchenExpiryCron
│   ├── prep-batches/
│   │   ├── prep-batches.controller.ts
│   │   ├── prep-batches.service.ts
│   │   └── dto/
│   │       ├── create-prep-batch.dto.ts
│   │       └── preview-deductions.dto.ts
│   ├── kds/
│   │   ├── kds.controller.ts
│   │   └── kds.service.ts
│   ├── waste/
│   │   ├── waste.controller.ts
│   │   ├── waste.service.ts
│   │   └── dto/create-waste-log.dto.ts
│   ├── metrics/
│   │   ├── kitchen-metrics.controller.ts
│   │   └── kitchen-metrics.service.ts
│   └── expiry/
│       └── kitchen-expiry.cron.ts
```

### Recommended Frontend Structure
```
frontend/
├── app/(ops)/operations/kitchen/
│   ├── prep-batches/
│   │   └── page.tsx
│   ├── kds/
│   │   └── page.tsx                — full-screen route, CSS override
│   └── waste/
│       └── page.tsx
├── components/ops/kitchen/
│   ├── prep-batches/
│   │   ├── PrepBatchList.tsx
│   │   ├── PrepBatchRow.tsx
│   │   ├── PrepBatchWizard.tsx
│   │   ├── PrepBatchWizardStep1.tsx
│   │   ├── PrepBatchWizardStep2.tsx
│   │   ├── PrepBatchWizardStep3.tsx
│   │   ├── PrepBatchStatusBadge.tsx
│   │   └── ExpiresInCountdown.tsx
│   ├── kds/
│   │   ├── KdsBoard.tsx
│   │   ├── KdsZoneColumn.tsx
│   │   ├── KdsOrderCard.tsx
│   │   ├── KdsOrderItem.tsx
│   │   ├── KdsElapsedTimer.tsx
│   │   ├── KdsItemStatusBadge.tsx
│   │   ├── KdsExitButton.tsx
│   │   └── KdsMetricsBar.tsx
│   └── waste/
│       ├── WasteLogForm.tsx
│       ├── WasteLogRow.tsx
│       └── WasteReasonBadge.tsx
├── lib/types/
│   ├── kitchen.ts                  — PrepBatch, WasteLog types
│   └── kds.ts                      — Order, OrderItem types (for KDS read)
```

### Pattern 1: FIFO Batch Deduction in $transaction

**What:** When creating a PrepBatch, deduct sub-recipe inputs from existing PrepBatches in FIFO (oldest created_at first) order, within a single `$transaction`.

**When to use:** PrepBatch creation (KITCHEN-01)

**Key mechanics:**
- Multiplier = `quantity_to_prep / recipe.yield_qty`
- For ingredient lines: convert + deduct from IngredientStock, create StockMovement type="prep_deducted"
- For recipe lines: fetch active, non-expired PrepBatches ordered by `created_at ASC`, deduct greedily, mark depleted when `quantity_remaining <= 0`
- If `remaining_need > 0` after all batches exhausted: throw `BadRequestException` (insufficient prep stock)
- All writes inside `this.prisma.$transaction(async (tx) => {...})` — pass `tx` to `convertUnit()` per established Pitfall 2 pattern

```typescript
// Source: pipeline spec §4.3 + purchase-orders.service.ts pattern
async createPrepBatch(dto: CreatePrepBatchDto, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.findUniqueOrThrow({
      where: { id: dto.recipe_id },
      include: { RecipeLines: { include: { ingredient: true, source_recipe: true } } },
    });
    const multiplier = Number(dto.quantity_to_prep) / Number(recipe.yield_qty);

    for (const line of recipe.RecipeLines) {
      const needed = Number(line.quantity) * multiplier;

      if (line.input_type === 'ingredient') {
        const neededBase = await convertUnit(needed, line.unit, line.ingredient!.base_unit, tx);
        if (neededBase === null) throw new BadRequestException(`No conversion: ${line.unit} → ${line.ingredient!.base_unit}`);

        const stock = await tx.ingredientStock.findUniqueOrThrow({
          where: { ingredient_id_zone_id: { ingredient_id: line.ingredient_id!, zone_id: dto.zone_id } },
        });
        if (Number(stock.current_quantity) < neededBase) throw new BadRequestException('Insufficient stock');

        await tx.ingredientStock.update({
          where: { ingredient_id_zone_id: { ingredient_id: line.ingredient_id!, zone_id: dto.zone_id } },
          data: { current_quantity: { decrement: neededBase } },
        });
        await tx.stockMovement.create({
          data: { ingredient_id: line.ingredient_id!, zone_id: dto.zone_id, movement_type: 'prep_deducted',
            quantity: -neededBase, original_quantity: needed, unit: line.unit,
            reference_type: 'prep_batch', created_by: userId },
        });
      }

      if (line.input_type === 'recipe') {
        const batches = await tx.prepBatch.findMany({
          where: { recipe_id: line.source_recipe_id!, status: 'active',
            expires_at: { gt: new Date() } },
          orderBy: { created_at: 'asc' }, // FIFO
        });
        let remainingNeed = needed; // already in yield_unit — convert if line.unit differs
        for (const batch of batches) {
          const deduct = Math.min(Number(batch.quantity_remaining), remainingNeed);
          const newQty = Number(batch.quantity_remaining) - deduct;
          await tx.prepBatch.update({
            where: { id: batch.id },
            data: { quantity_remaining: newQty, ...(newQty <= 0 && { status: 'depleted' }) },
          });
          remainingNeed -= deduct;
          if (remainingNeed <= 0) break;
        }
        if (remainingNeed > 0) throw new BadRequestException('Insufficient prep batch stock');
      }
    }

    return tx.prepBatch.create({
      data: {
        recipe_id: dto.recipe_id, zone_id: dto.zone_id,
        quantity_produced: dto.quantity_to_prep, quantity_remaining: dto.quantity_to_prep,
        unit: recipe.yield_unit, prepared_by: userId,
        expires_at: recipe.shelf_life_hours
          ? new Date(Date.now() + recipe.shelf_life_hours * 3600000)
          : null,
        status: 'active',
      },
    });
  });
}
```

### Pattern 2: Deduction Preview (Read-Only)

**What:** GET /kitchen/prep-batches/preview endpoint that runs the same availability check as createPrepBatch but returns deduction plan without writing. Powers wizard Step 2.

**When to use:** Wizard Step 2 — "Review Deductions" (D-01)

**Response shape:**
```typescript
// For each BOM line:
{ input_name: string; input_type: 'ingredient'|'recipe'; available: number;
  required: number; unit: string; sufficient: boolean }[]
```

This is a GET with query params (recipe_id, quantity_to_prep, zone_id) or a POST body — POST is simpler to pass structured data.

### Pattern 3: KDS Polling with React Query

**What:** `refetchInterval: 5000` on the KDS data query. Silent refresh (no loading spinner on background polls).

**When to use:** KdsBoard component (KITCHEN-02)

```typescript
// Source: @tanstack/react-query v5 docs + project apiClient pattern
const { data: kdsData, isError } = useQuery({
  queryKey: ['kds-orders'],
  queryFn: () => apiClient.get<KdsZoneData[]>('/kitchen/kds'),
  refetchInterval: 5000,
  refetchIntervalInBackground: true,   // continues polling even if tab unfocused
});
// New orders: detected by comparing prev vs current order IDs in useEffect or usePrevious hook
```

**New order detection:** Compare previous query result to current result in `useEffect`. New order IDs get BorderBeam state set for 3 seconds.

### Pattern 4: Expiry Cron with @nestjs/schedule

**What:** `@Cron('0 * * * *')` (every hour at minute 0) marks expired PrepBatches and creates WasteLog entries.

**When to use:** KITCHEN-06

```typescript
// Source: @nestjs/schedule docs — @Cron decorator
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class KitchenExpiryCron {
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * *') // hourly at :00
  async handleExpiredPrepBatches() {
    const expired = await this.prisma.prepBatch.findMany({
      where: { status: 'active', expires_at: { lt: new Date() } },
      include: { recipe: true },
    });
    for (const batch of expired) {
      await this.prisma.$transaction(async (tx) => {
        await tx.prepBatch.update({ where: { id: batch.id }, data: { status: 'expired' } });
        if (Number(batch.quantity_remaining) > 0) {
          const costImpact = /* calculateWasteCost(batch) using recipe.computed_cost */
            Number(batch.recipe.computed_cost ?? 0) *
            (Number(batch.quantity_remaining) / Number(batch.quantity_produced));
          await tx.wasteLog.create({
            data: {
              waste_type: 'prep_batch', prep_batch_id: batch.id,
              quantity: batch.quantity_remaining, unit: batch.unit,
              reason: 'expired', cost_impact: costImpact,
              logged_by: 'system', zone_id: batch.zone_id,
            },
          });
        }
      });
    }
  }
}
```

**App module wiring:**
```typescript
// app.module.ts additions
import { ScheduleModule } from '@nestjs/schedule';
// In imports array:
ScheduleModule.forRoot(),
KitchenModule,
```

### Pattern 5: KDS Full-Screen Layout

**What:** CSS-based overlay that renders over the sidebar. No separate layout segment needed.

**Decision (Claude's Discretion, from UI-SPEC):** Use `position: fixed; inset: 0; z-index: 50` on the KDS container. This avoids duplicating the auth guard + layout code. URL query param `?fullscreen=true` is NOT recommended by UI-SPEC — the KDS route `/operations/kitchen/kds` is always full-screen by design.

**Implementation:** The ops layout renders `<Sidebar />` + `<main>`. The KDS page renders a fixed-position div that covers everything. The exit button navigates back.

```typescript
// KDS page — full viewport overlay
<div className="fixed inset-0 z-50 bg-[oklch(0.10_0_0)] overflow-hidden flex flex-col">
  {/* Fixed top bar */}
  {/* Scrollable zone columns grid */}
</div>
```

### Pattern 6: Elapsed Timer with setInterval

**What:** Component that calculates `Date.now() - order.created_at` and re-renders every second.

**When to use:** KdsElapsedTimer component

```typescript
// setInterval inside useEffect — cleanup on unmount
const [elapsed, setElapsed] = useState(0);
useEffect(() => {
  const start = new Date(order.created_at).getTime();
  const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
  tick(); // immediate first render
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, [order.created_at]);

const minutes = Math.floor(elapsed / 60);
const colorClass = minutes < 10 ? 'text-[oklch(0.627_0.194_142.495)]'
  : minutes < 20 ? 'text-[oklch(0.769_0.188_70.08)]'
  : 'text-destructive';
```

### Pattern 7: WasteLog Cost Impact Calculation

**What:** Auto-calculate cost_impact when creating a WasteLog entry.

- `waste_type = 'ingredient'`: fetch latest VendorPrice for ingredient → convert waste quantity to price unit → `cost_impact = converted_qty * price`
- `waste_type = 'prep_batch'`: use `recipe.computed_cost` proportional to waste quantity → `cost_impact = (quantity / quantity_produced) * computed_cost`

### Anti-Patterns to Avoid

- **Passing `this.prisma` instead of `tx` to `convertUnit()`**: All unit conversions inside `$transaction` must use the transaction client `tx`. This is Pitfall 2 from Phase 8 research — established project pattern.
- **Decimal comparison in Prisma WHERE**: Never use Prisma WHERE filters on Decimal fields (e.g., `quantity_remaining: { gt: 0 }` in the expiry cron). Use application-level `Number()` comparison after fetching. See Phase 8 Pitfall 4.
- **KDS route as separate Next.js layout segment**: Would require duplicating auth logic. Use CSS fixed overlay instead.
- **Sound alerts on KDS**: D-08 explicitly says no sound. BorderBeam only.
- **Deducting stock on order placed**: Pipeline spec §4.4 says deduction happens on "mark ready" (Phase 10). Phase 9 KDS only updates item status — it does NOT deduct stock.
- **Filtering expired PrepBatches with `expires_at < now()` in Prisma `where` on Decimal**: expires_at is DateTime not Decimal, so Prisma datetime comparison works fine here. Decimal pitfall applies only to Decimal-type quantity fields.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduled job | Custom setInterval in main.ts | `@nestjs/schedule` + `@Cron()` | Handles server restart, timezone, concurrent execution guard |
| Unit conversion | Local multiply logic | Existing `convertUnit()` in `backend/src/common/utils/unit-conversion.ts` | Already handles caching, tx-awareness, all project units |
| Recipe cost calculation | Custom cost math | Existing `CostCalculatorService.calculateRecipeCost()` | Handles recursive BOM, vendor price lookup, already tested |
| FIFO order | Custom sort | `orderBy: { created_at: 'asc' }` in Prisma query | Single field, no custom comparator needed |
| Polling without React Query | Custom WebSocket or SSE | `refetchInterval: 5000` on React Query | Pipeline spec explicitly chose polling over WebSocket |
| KDS full-screen via browser Fullscreen API | `document.documentElement.requestFullscreen()` | CSS `position: fixed; inset: 0; z-index: 50` | Browser Fullscreen API requires user gesture, has permission dialogs on tablets, complex to implement with React state |

**Key insight:** The inventory and recipe infrastructure built in Phases 7–8 contains exactly the utilities this phase needs. The work here is wiring them together, not building new foundations.

---

## Common Pitfalls

### Pitfall 1: PrepBatch Creation — Missing `updated_at` on IngredientStock
**What goes wrong:** IngredientStock has `updated_at @updatedAt`. When using `update({ data: { current_quantity: { decrement: x } } })`, Prisma auto-updates `updated_at`. When using a raw decrement inside `$transaction`, the timestamp updates correctly. No special handling needed — just use `update()`.
**Why it happens:** Forgetting Prisma auto-manages `@updatedAt` fields.
**How to avoid:** Always use Prisma `update()` methods, not `executeRaw()`, so `@updatedAt` is auto-applied.

### Pitfall 2: FIFO Unit Mismatch
**What goes wrong:** PrepBatch.unit = recipe.yield_unit for the source recipe. RecipeLine.unit is the unit from the parent recipe's BOM (may differ). Need to convert `line.quantity` from `line.unit` to the PrepBatch's `batch.unit` before deducting.
**Why it happens:** The pipeline spec §4.3 shows `convert(needed, line.unit, batch.unit)` but it's easy to skip this step.
**How to avoid:** Always call `convertUnit(needed, line.unit, batch.unit, tx)` for recipe-type BOM lines before comparing to `batch.quantity_remaining`.

### Pitfall 3: expires_at When shelf_life_hours is null
**What goes wrong:** Recipe.shelf_life_hours is `Int?` (nullable). If null, `PrepBatch.expires_at` must also be null. The cron expiry query `WHERE expires_at < now()` correctly ignores null rows in PostgreSQL (NULL comparisons return false). FIFO deduction filter `expires_at: { gt: new Date() }` must handle null by using `OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }]`.
**Why it happens:** Assuming non-null shelf_life_hours for all recipes.
**How to avoid:** When querying active, non-expired PrepBatches, use: `where: { status: 'active', OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] }`.

### Pitfall 4: KDS "New Order" Detection on Re-render
**What goes wrong:** Every 5-second poll returns all active orders. Naively applying BorderBeam to all orders on every refetch means every order flashes on every poll.
**Why it happens:** Not tracking which order IDs have already been seen.
**How to avoid:** Maintain a `seenOrderIds` Set in component state (or `useRef`). On each poll result, find new IDs (`currentIds - seenIds`), apply BorderBeam state only to those, then add all current IDs to the seen set.

### Pitfall 5: @nestjs/schedule Not in App Module
**What goes wrong:** `@Cron` decorators silently do nothing if `ScheduleModule.forRoot()` is not imported in AppModule.
**Why it happens:** `@nestjs/schedule` requires explicit module registration unlike some NestJS packages.
**How to avoid:** Add `ScheduleModule.forRoot()` to AppModule imports array AND `KitchenModule` to the imports array. `KitchenExpiryCron` provider registered in KitchenModule.

### Pitfall 6: WasteLog logged_by for System-Created Entries
**What goes wrong:** WasteLog.logged_by is a FK to User. The expiry cron has no authenticated user context.
**Why it happens:** Schema requires a user reference but the cron is headless.
**How to avoid:** Two options: (a) make `logged_by` nullable in schema (preferred — expiry entries are system-generated), or (b) use a designated system user ID. **Recommendation:** Add `logged_by String?` to WasteLog schema — null means system-generated. The frontend can display "System" for null logged_by.

### Pitfall 7: Order + OrderItem Models Not Yet in Schema
**What goes wrong:** KDS needs to query `order` and `orderItem` tables. These models are defined in the pipeline spec §3.8 but NOT yet in `backend/prisma/schema.prisma` — they belong to Phase 10.
**Why it happens:** Phase 9 needs to read Order/OrderItem for KDS, but Phase 10 creates orders.
**How to avoid:** Phase 9 Plan 1 (schema wave) MUST add Order and OrderItem models to schema.prisma as defined in §3.8. Phase 10 will add the write endpoints. Phase 9 only adds read + status-update endpoints. All models added in one migration, creation endpoints come in Phase 10.

---

## Code Examples

### Verified patterns from codebase

### PrepBatch Preview (Deduction Check without writing)
```typescript
// GET /kitchen/prep-batches/preview?recipe_id=X&quantity_to_prep=Y&zone_id=Z
async previewDeductions(dto: PreviewDeductionsDto) {
  const recipe = await this.prisma.recipe.findUniqueOrThrow({
    where: { id: dto.recipe_id },
    include: { RecipeLines: { include: { ingredient: true, source_recipe: true } } },
  });
  const multiplier = Number(dto.quantity_to_prep) / Number(recipe.yield_qty);
  const lines = [];

  for (const line of recipe.RecipeLines) {
    const needed = Number(line.quantity) * multiplier;
    if (line.input_type === 'ingredient') {
      const neededBase = await convertUnit(needed, line.unit, line.ingredient!.base_unit, this.prisma);
      const stock = await this.prisma.ingredientStock.findUnique({
        where: { ingredient_id_zone_id: { ingredient_id: line.ingredient_id!, zone_id: dto.zone_id } },
      });
      const available = Number(stock?.current_quantity ?? 0);
      lines.push({ input_name: line.ingredient!.name, input_type: 'ingredient',
        available, required: neededBase ?? needed, unit: line.ingredient!.base_unit,
        sufficient: available >= (neededBase ?? needed) });
    }
    if (line.input_type === 'recipe') {
      const batches = await this.prisma.prepBatch.findMany({
        where: { recipe_id: line.source_recipe_id!, status: 'active',
          OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
      });
      const available = batches.reduce((s, b) => s + Number(b.quantity_remaining), 0);
      lines.push({ input_name: line.source_recipe!.name, input_type: 'recipe',
        available, required: needed, unit: line.source_recipe!.yield_unit,
        sufficient: available >= needed });
    }
  }
  return lines;
}
```

### KDS Endpoint Shape
```typescript
// GET /kitchen/kds — returns active orders grouped by zone
interface KdsOrderItem { id: string; status: string; menu_item_id: string; menu_item_name: string; quantity: number; item_notes: string | null; }
interface KdsOrder { id: string; customer_name: string | null; created_at: string; status: string; items: KdsOrderItem[]; zone_id: string; }
interface KdsZoneData { zone_id: string; zone_name: string; orders: KdsOrder[]; }
```

### Sidebar Kitchen Section Addition
```typescript
// Add to Sidebar.tsx after operationsNav, before adminNav
// Add icons to imports: Monitor, Trash2 (Lucide) — ChefHat already imported
const kitchenNav: NavItem[] = [
  { label: 'Prep Batches', href: '/operations/kitchen/prep-batches', icon: <ChefHat className="size-4" /> },
  { label: 'KDS', href: '/operations/kitchen/kds', icon: <Monitor className="size-4" /> },
  { label: 'Waste Log', href: '/operations/kitchen/waste', icon: <Trash2 className="size-4" /> },
];
// Section label: "Kitchen" — placed between Operations and Admin sections
```

### Menu Availability Endpoint
```typescript
// GET /menu/availability?menu_item_id=X — called by Phase 10 POS
// Returns: { available: boolean; servings_remaining: number }
// getServingsAvailable algorithm from pipeline spec §4.1:
// minServings = min over all RecipeLines of floor(available / needed_per_serving)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WebSocket for real-time kitchen display | 5-second polling via React Query | Design decision in pipeline spec | Simpler, no WS infrastructure |
| Separate recipe "type" field (prep vs final) | Unified Recipe entity, BOM chains | Pipeline spec §2 | Any recipe can be a prep batch input |
| Manual expiry check | `@nestjs/schedule` cron | Phase 9 introduces | Automatic, no user action needed |

**Deprecated/outdated:**
- None — Phase 9 is greenfield for these models.

---

## Open Questions

1. **logged_by nullable for system-generated WasteLog entries**
   - What we know: WasteLog.logged_by is `String` (non-nullable FK to User) in pipeline spec §3.7.
   - What's unclear: Should the cron use a system user ID (requires a seed "system" user) or should the field be made nullable?
   - Recommendation: Make `logged_by String?` nullable in the Prisma schema migration for this phase. System-generated entries get `logged_by: null`. Frontend renders "System" for null. Simpler than seeding a system user.

2. **KDS reads Order/OrderItem but no orders exist until Phase 10**
   - What we know: Order/OrderItem models must be added to schema in Phase 9 so KDS endpoints compile. Phase 10 adds order creation.
   - What's unclear: Will the KDS look empty in Phase 9 testing? Yes — it will show "No orders in queue" (correct empty state per copywriting contract).
   - Recommendation: Add models in schema, create KDS endpoints, test with seeded test orders (or accept empty state as valid during Phase 9 verification).

3. **Kitchen metrics: "average prep time" calculation**
   - What we know: D-15 lists average prep time. OrderItem has `ready_at` (DateTime). Order has `created_at`.
   - What's unclear: Which endpoints/tables give prep time? `ready_at - created_at` on OrderItem, but only Phase 10 populates ready_at.
   - Recommendation: Kitchen metrics endpoint returns average_prep_time as null/0 for Phase 9 (no completed orders yet). Field is included in the response shape so Phase 10 auto-populates it.

4. **User relations for PrepBatch.prepared_by and WasteLog.logged_by**
   - What we know: These are FK to User in the spec. The User model must have corresponding reverse relations.
   - What's unclear: Does adding these cause Prisma schema errors with the existing User model?
   - Recommendation: Add `prepBatches PrepBatch[] @relation("PrepBatchCreator")` and `wasteLogs WasteLog[] @relation("WasteLogCreator")` to User model. Same pattern used for `StockMovement.creator` in Phase 8.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (configured in backend/package.json) |
| Config file | backend/package.json jest section — rootDir: src, testRegex: *.spec.ts |
| Quick run command | `cd backend && npm test -- --testPathPattern=kitchen` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KITCHEN-01 | createPrepBatch deducts stock and creates PrepBatch in transaction | unit (mock Prisma) | `npm test -- --testPathPattern=prep-batches` | ❌ Wave 0 |
| KITCHEN-01 | previewDeductions returns correct available/required per line | unit (mock Prisma) | `npm test -- --testPathPattern=prep-batches` | ❌ Wave 0 |
| KITCHEN-02 | GET /kitchen/kds returns orders grouped by zone | unit | `npm test -- --testPathPattern=kds` | ❌ Wave 0 |
| KITCHEN-02 | PATCH /kitchen/kds/items/:id/status advances status | unit | `npm test -- --testPathPattern=kds` | ❌ Wave 0 |
| KITCHEN-03 | getServingsAvailable returns min across all BOM lines | unit | `npm test -- --testPathPattern=kitchen.*service` | ❌ Wave 0 |
| KITCHEN-04 | createWasteLog auto-calculates cost_impact for ingredient type | unit | `npm test -- --testPathPattern=waste` | ❌ Wave 0 |
| KITCHEN-06 | handleExpiredPrepBatches marks expired + creates WasteLog | unit (mock Prisma) | `npm test -- --testPathPattern=expiry` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npm test -- --testPathPattern=kitchen`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/kitchen/prep-batches/prep-batches.service.spec.ts` — covers KITCHEN-01
- [ ] `backend/src/kitchen/kds/kds.service.spec.ts` — covers KITCHEN-02
- [ ] `backend/src/kitchen/waste/waste.service.spec.ts` — covers KITCHEN-04
- [ ] `backend/src/kitchen/expiry/kitchen-expiry.cron.spec.ts` — covers KITCHEN-06

---

## Sources

### Primary (HIGH confidence)
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` — PrepBatch/WasteLog schema §3.7, Order/OrderItem §3.8, FIFO deduction logic §4.3, availability algorithm §4.1, expiry handling §4.6
- `backend/src/purchase-orders/purchase-orders.service.ts` — $transaction + FIFO-adjacent receiving pattern verified in codebase
- `backend/src/inventory/inventory.service.ts` — adjustStock pattern, Decimal pitfall handling (application-level Number comparison)
- `backend/src/recipes/cost-calculator.service.ts` — cost calculation for waste cost_impact
- `backend/src/common/utils/unit-conversion.ts` — convertUnit() with tx parameter pattern
- `backend/package.json` — confirmed @nestjs/schedule NOT installed; all other dependencies confirmed
- `frontend/components/ops/Sidebar.tsx` — existing operationsNav structure, ChefHat already imported
- `frontend/app/(ops)/layout.tsx` — ops layout: Sidebar + main, CSS override approach confirmed
- `frontend/components/ops/operations/inventory/StockAdjustmentSheet.tsx` — Sheet component usage pattern
- `frontend/app/(ops)/operations/procurement/page.tsx` — MagicCard + NumberTicker pattern
- npm registry — `@nestjs/schedule` v6.1.1 (verified 2026-03-21)

### Secondary (MEDIUM confidence)
- `@nestjs/schedule` documentation — @Cron decorator, ScheduleModule.forRoot() registration pattern
- `@tanstack/react-query` v5 docs — refetchInterval option

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries either verified in package.json or npm registry
- Architecture: HIGH — patterns derived directly from existing codebase modules (Phase 8 inventory as direct template)
- Pitfalls: HIGH — derived from actual schema inspection and Phase 8 established pitfalls
- FIFO logic: HIGH — fully specified in pipeline spec §4.3, no interpretation needed
- KDS polling: HIGH — React Query refetchInterval is straightforward, no unknowns
- Cron job: HIGH — @nestjs/schedule @Cron is standard, version confirmed

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack — all dependencies locked)
