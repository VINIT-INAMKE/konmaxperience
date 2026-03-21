# Phase 10: POS & Orders - Research

**Researched:** 2026-03-21
**Domain:** NestJS REST API (orders module), Next.js 16 / React 19 (POS UI, order history, delivery queue), Prisma v6 (Order/OrderItem/Payment already in schema)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Split screen: left 2/3 = menu grid (Brand tabs → category rows → item cards, tap to add), right 1/3 = order summary sidebar.
- **D-02:** Both regular page (sidebar visible) AND full-screen toggle for dedicated POS terminal/tablet use.
- **D-03:** Servings-remaining badge on each menu item card ("X left"). When 0, item card grays out with "Sold Out". Uses Phase 9 availability endpoint.
- **D-04:** Channel selector in cart sidebar: dine-in / takeaway / delivery. Channel-specific fields appear based on selection (table_number, customer_phone, delivery_address + delivery_assigned_to).
- **D-05:** Inline in sidebar — staff selects channel, fills channel-specific fields, adds notes, clicks "Place Order". Single page, no checkout step.
- **D-06:** Order placement creates Order + OrderItems + applies ChannelModifier to total. Items appear on KDS immediately (Phase 9 KDS polling picks them up).
- **D-07:** Status: placed → preparing → ready → served (dine-in) / dispatched (delivery/takeaway) → cancelled. Locked from pipeline spec.
- **D-08:** Deduction on "mark ready" per item (locked from brainstorming): when cook marks item ready on KDS → PrepBatch.quantity_remaining decremented, IngredientStock decremented for direct-use items, StockMovements created. When ALL items ready → order status auto-transitions to "ready".
- **D-09:** Inline on order detail: delivery_assigned_to text field (type a name), delivery_status buttons (picked_up → in_transit → delivered).
- **D-10:** PLUS a dedicated delivery queue page listing all active delivery orders with status. Both views available.
- **D-11:** Payment recorded AFTER service (not at order placement). Staff clicks "Record Payment" on order detail. Method (cash/card/UPI), amount, notes for split description.
- **D-12:** Single Payment record per order. No gateway integration. Payment is record-keeping only.
- **D-13:** Table with filters: order #, channel, status, items count, total, payment status, date. Filters: date range, channel, status, payment method.
- **D-14:** Daily revenue summary card at top: total orders, total revenue, average order value.
- **D-15:** POS page under a new "POS" sidebar section (or top-level). Orders, Delivery Queue, Order History as sub-pages.
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

### Deferred Ideas (OUT OF SCOPE)

- Payment gateway integration (Razorpay/Stripe) — v2
- Third-party delivery integration (Swiggy/Zomato) — v2
- Customer self-service ordering — out of scope (staff-operated POS only)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POS-01 | Full POS interface — Brand → Category → Items menu grid, tap to add, quantity adjustment, order summary sidebar, channel selector (dine-in/takeaway/delivery), servings-remaining indicator per item | Menu data from Phase 7 endpoints already available; availability endpoint from Phase 9 ready; MagicCard + AnimatedListItem for item/cart UI |
| POS-02 | Order management — Order with channel-specific fields, status flow (placed → preparing → ready → served/dispatched/cancelled) | Order/OrderItem schema in Prisma from Phase 9; new OrdersModule needed; KDS already reads orders |
| POS-03 | Payment tracking — single Payment per order with method (cash/card/UPI), status (pending/paid/refunded), amount, notes. No gateway. | Payment schema in Prisma from Phase 9; POST /orders/:id/payment endpoint needed |
| POS-04 | Order → kitchen → deduction flow — order placed → items appear on KDS → cook marks preparing → cook marks ready → DEDUCTION HAPPENS | KDS.updateItemStatus() exists but currently does NOT deduct; must be extended to call deduction logic when status → ready; FIFO deduction pattern from PrepBatchesService is the direct template |
| POS-05 | Delivery dispatch — delivery_assigned_to (plain name string), delivery_status (picked_up → in_transit → delivered) on Order. No rider entity. | Fields already in Order schema; need PATCH /orders/:id/delivery endpoint; dedicated delivery queue page |
| POS-06 | Order history — searchable list with filters (date, channel, status, payment method), daily revenue summary | GET /orders with query params; Prisma WHERE clause with date/channel/status/paymentMethod filters; daily aggregate query |
</phase_requirements>

---

## Summary

Phase 10 introduces the staff-operated POS that ties together all previous phases. The data model (Order, OrderItem, Payment) is already in the Prisma schema from Phase 9 when it was needed for KDS to compile — no new migration is required. The entire backend work is a new `OrdersModule` containing order creation, status management, payment recording, delivery dispatch, order history, and — critically — extending the existing `KdsService.updateItemStatus()` to trigger stock deduction when an item moves to "ready".

The deduction logic (D-08 / POS-04) is the most complex and highest-risk piece. The pattern already exists verbatim in `PrepBatchesService.deductIngredient()` and `deductSubRecipeBatches()`. The Phase 10 implementation re-uses the same `$transaction` pattern, `activeBatchWhere()` helper, and `convertUnit()` call signature. The KDS update path must be extended — not replaced — because the KDS already handles status progression validation.

The frontend is a new `/pos` route group under the existing `(ops)` layout. Three pages are needed: `/pos` (POS interface), `/pos/orders` (order history), `/pos/delivery` (delivery queue). The sidebar needs a new "POS" section between Kitchen and Admin. All required UI components (MagicCard, AnimatedList, BorderBeam, PulsatingButton, ShimmerButton, NumberTicker) are pre-installed. The largest UI risk is AnimatedList — its default behavior auto-cycles items via a timeout; the POS cart needs `AnimatedListItem` directly inside `AnimatePresence`, not the `AnimatedList` wrapper.

**Primary recommendation:** Build the backend OrdersModule first (5 service methods), then wire the KDS deduction hook as a separate atomic extension, then build the three frontend pages in parallel using the pre-approved UI-SPEC.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | 11.x (installed) | Module/Controller/Service for OrdersModule | Established pattern in every backend phase |
| Prisma v6 | 6.x (installed) | ORM for Order/OrderItem/Payment queries | Project constraint — already in schema |
| `@tanstack/react-query` | 5.91.2 (installed) | Server state for POS menu, orders, availability | Established pattern in all frontend phases |
| `sonner` | 2.0.7 (installed) | Toast notifications for order placement, errors | Established from Phase 3 |
| `motion/react` (framer-motion) | 12.38 (installed) | AnimatedListItem for cart animations | Required by UI-SPEC |
| shadcn/ui | installed | Tabs, Badge, Button, Sheet, Dialog, Table, Input, Textarea, Select, ScrollArea, Separator, Popover | Pre-installed, UI-SPEC mandated |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 4.3.6 (installed) | DTO validation for CreateOrderDto, RecordPaymentDto | All new API inputs |
| `class-validator` | installed | NestJS DTO decorators on backend | All new DTOs |
| `date-fns` | 4.1.0 (installed) | Date range filter parsing, daily revenue grouping | Order history filters |

### MagicUI Components (ALL pre-installed, no new installs)
| Component | Source File | Usage in Phase 10 |
|-----------|-------------|-------------------|
| `MagicCard` | `frontend/components/ui/magic-card.tsx` | POS menu item cards (gradient "#1a1a2e") |
| `NumberTicker` | `frontend/components/ui/number-ticker.tsx` | Daily revenue totals |
| `BorderBeam` | `frontend/components/ui/border-beam.tsx` | Cart sidebar flash after order placement |
| `AnimatedListItem` | `frontend/components/ui/animated-list.tsx` | Cart item rows animate-in/out |
| `ShimmerButton` | `frontend/components/ui/shimmer-button.tsx` | Terminal Mode toggle |
| `PulsatingButton` | `frontend/components/ui/pulsating-button.tsx` | "Place Order" CTA |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `AnimatedListItem` (direct) | `AnimatedList` wrapper | `AnimatedList` uses a timer to auto-cycle; for a cart the items should respond to user action, not auto-cycle. Use `AnimatedListItem` inside `AnimatePresence` directly. |
| Polling for availability | React Query refetchInterval | Same thing — React Query's `refetchInterval: 10000` is the correct implementation of 10s polling |

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/orders/
├── orders.module.ts          # imports KitchenModule (for PrepBatchesService reuse)
├── orders.controller.ts      # POST /orders, GET /orders, PATCH /orders/:id/status
│                             # POST /orders/:id/payment, PATCH /orders/:id/delivery
├── orders.service.ts         # createOrder, getOrders, updateStatus, recordPayment, updateDelivery
└── dto/
    ├── create-order.dto.ts   # channel, items[], channel-specific fields, notes
    ├── record-payment.dto.ts # method, amount, notes
    └── update-delivery.dto.ts # delivery_assigned_to, delivery_status

frontend/app/(ops)/pos/
├── page.tsx                  # POS interface (split-screen)
├── orders/
│   └── page.tsx              # Order history
└── delivery/
    └── page.tsx              # Delivery queue

frontend/components/ops/pos/
├── PosMenuGrid.tsx           # Left panel: brand tabs → category rows → item cards
├── PosMenuItemCard.tsx       # MagicCard variant, tap to add, servings badge
├── PosCartSidebar.tsx        # Right panel: channel selector, item rows, totals, CTA
├── PosCartItemRow.tsx        # AnimatedListItem wrapper: name, qty +/-, line total
├── PosChannelFields.tsx      # Conditional fields based on selected channel
├── OrderHistoryTable.tsx     # Table + filters + Sheet trigger
├── OrderDetailSheet.tsx      # Order detail, status, payment, delivery inside Sheet
├── OrderStatusBadge.tsx      # Reuses kds.ts OrderStatus types
├── DeliveryQueueTable.tsx    # Active delivery orders table
└── DailyRevenueSummary.tsx   # 3 stat cards with NumberTicker

frontend/lib/types/orders.ts  # Order, OrderItem, Payment, CreateOrderPayload types
```

### Pattern 1: KDS Deduction Hook (POS-04 — most critical)

The existing `KdsService.updateItemStatus()` handles status progression but does NOT deduct. Phase 10 extends it to call deduction logic when status transitions to "ready".

**Architecture decision:** Where does deduction live?

Option A: Deduction logic inside `KdsService` directly — keeps it co-located with the trigger but mixes concerns.
Option B: New `OrderFulfillmentService` injected into `KdsService` — clean separation but adds a new service.
Option C: Deduction logic in `OrdersService`, KDS calls it via injection — `OrdersModule` exports `OrdersService`, `KitchenModule` imports `OrdersModule`.

**Recommendation: Option C** — `OrdersService.markItemReady(itemId, tx)` contains the deduction logic, `KdsService` calls it within the same `$transaction`. This mirrors how `PrepBatchesService` is exported from `KitchenModule` and imported by other modules.

**Critical implementation note:** The current `KdsService.updateItemStatus()` uses a plain `prisma.orderItem.update()` — NOT a `$transaction`. For Phase 10, this call MUST be wrapped in `$transaction` so that deduction + status update are atomic. If deduction fails, the item status must NOT advance to "ready".

```typescript
// Source: KdsService.updateItemStatus — must be extended
// BEFORE (Phase 9):
const updatedItem = await this.prisma.orderItem.update({ ... });

// AFTER (Phase 10):
const updatedItem = await this.prisma.$transaction(async (tx) => {
  if (newStatus === 'ready') {
    await this.ordersService.deductItemIngredients(tx, item); // new
  }
  const updated = await tx.orderItem.update({ where: { id: itemId }, data: updateData });
  if (newStatus === 'ready') {
    const allItems = await tx.orderItem.findMany({ where: { order_id: item.order_id } });
    const allReady = allItems.every((i) => i.id === itemId ? true : i.status === 'ready');
    if (allReady) await tx.order.update({ where: { id: item.order_id }, data: { status: 'ready' } });
  }
  return updated;
});
```

### Pattern 2: Order Creation with Channel Modifier

Order total = subtotal + channel_modifier_amount. The modifier is read at placement time (snapshot), not recalculated later.

```typescript
// Source: pipeline spec §4.6 + ChannelModifier schema
async createOrder(dto: CreateOrderDto, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Compute subtotal from OrderItems
    const subtotal = dto.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

    // 2. Look up active ChannelModifier for this channel
    const modifier = await tx.channelModifier.findUnique({
      where: { channel_type: dto.channel }
    });

    // 3. Apply modifier
    let modifierAmount = 0;
    if (modifier && modifier.status === 'active') {
      modifierAmount = modifier.modifier_type === 'fixed'
        ? Number(modifier.modifier_value)
        : subtotal * (Number(modifier.modifier_value) / 100);
    }

    // 4. Create Order + OrderItems
    const order = await tx.order.create({
      data: {
        channel: dto.channel,
        status: 'placed',
        subtotal,
        channel_modifier_amount: modifierAmount,
        total: subtotal + modifierAmount,
        created_by: userId,
        zone_id: dto.zone_id,  // NOTE: zone_id exists on Order model
        // channel-specific fields...
        items: { create: dto.items }
      },
      include: { items: true }
    });
    return order;
  });
}
```

**zone_id on Order:** The Order model in the Prisma schema has `zone_id String` as a required field (FK to Zone). This means the POS must pass a zone_id when creating an order. The planner must decide how zone is determined — most likely it is the zone associated with the selected brand/category, or a default kitchen zone.

### Pattern 3: Order History Filters

```typescript
// GET /orders?date_from=&date_to=&channel=&status=&payment_method=
async getOrders(filters: OrderFiltersDto) {
  const where: Prisma.OrderWhereInput = {};
  if (filters.channel) where.channel = filters.channel;
  if (filters.status) where.status = filters.status;
  if (filters.date_from || filters.date_to) {
    where.created_at = {
      ...(filters.date_from && { gte: new Date(filters.date_from) }),
      ...(filters.date_to && { lte: new Date(filters.date_to) }),
    };
  }
  if (filters.payment_method) {
    where.payment = { method: filters.payment_method };
  }
  return this.prisma.order.findMany({
    where,
    include: { items: { select: { id: true } }, payment: true },
    orderBy: { created_at: 'desc' },
  });
}
```

### Pattern 4: Cart State Management (Frontend)

The cart is pure local React state — no React Query, no API call until "Place Order".

```typescript
interface CartItem {
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
}
const [cartItems, setCartItems] = useState<CartItem[]>([]);
const [channel, setChannel] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');

function addItem(menuItem: MenuItem) {
  setCartItems(prev => {
    const existing = prev.find(i => i.menu_item_id === menuItem.id);
    if (existing) {
      return prev.map(i => i.menu_item_id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i);
    }
    return [...prev, { menu_item_id: menuItem.id, name: menuItem.name, unit_price: menuItem.base_price, quantity: 1 }];
  });
}
```

### Pattern 5: Servings Availability Polling

```typescript
// 10s polling, optimistic deduct after Place Order
const { data: availability } = useQuery({
  queryKey: ['menu', 'availability', menuItemId],
  queryFn: () => apiClient.get<{ available: boolean; servings_remaining: number }>(
    `/menu/availability/${menuItemId}`
  ),
  refetchInterval: 10000,  // matches KDS metrics bar pattern (Phase 9 decision)
});
```

**Important:** Fetch ALL menu items' availability in a single batch or individually? Phase 9 endpoint is per-item (`GET /menu/availability/:menuItemId`). For a POS with 20-50 items, polling each individually at 10s creates 20-50 parallel requests. The planner should add `GET /menu/availability` (batch endpoint returning all items) to reduce load. This is not in the existing Phase 9 code — it is a new endpoint needed for Phase 10.

### Anti-Patterns to Avoid

- **Do NOT call deduction outside a $transaction.** If `IngredientStock.update` and `StockMovement.create` are not atomic with `orderItem.update`, a crash between them creates phantom stock.
- **Do NOT duplicate the FIFO deduction logic.** The private helpers `deductIngredient()` and `deductSubRecipeBatches()` in `PrepBatchesService` are battle-tested. Extract them to a shared `DeductionService` OR copy the same pattern exactly — do not reimagine the logic.
- **Do NOT use `AnimatedList` wrapper for cart items.** It auto-cycles (timer-driven). Use `AnimatedListItem` inside `AnimatePresence` + a keyed array directly — gives slide-in/out on React state change.
- **Do NOT compute channel modifier on the frontend.** Compute server-side in `createOrder()` to ensure the correct modifier value is persisted on the Order record. Frontend can display estimated total but server is authoritative.
- **Do NOT filter order history client-side.** With any significant order volume, filtering must be done as a Prisma `WHERE` clause, not a `.filter()` on a full list.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FIFO prep batch deduction | Custom deduction algorithm | `PrepBatchesService.deductSubRecipeBatches()` pattern (copy pattern exactly, or extract shared service) | Already handles edge cases: multi-batch spanning, depletion marking, insufficient stock error |
| Unit conversion in deduction | Custom converter | `convertUnit(qty, fromUnit, toUnit, tx)` from `backend/src/common/utils/unit-conversion.ts` | Must receive `tx` (transaction client) inside `$transaction` — Pitfall from Phase 8 |
| Animated cart item enter/exit | CSS transitions | `AnimatedListItem` from `frontend/components/ui/animated-list.tsx` wrapping `AnimatePresence` | Spring physics already tuned, matches existing KDS patterns |
| Order status badge | Custom status display | Extend `ORDER_STATUS_LABELS` in `frontend/lib/types/kds.ts` | Reuse type constants already defined for KDS |
| Order detail drawer | Custom overlay/modal | shadcn `Sheet` (right side, 520px) | Already pre-installed; consistent with project Sheet pattern from Phase 5 |

**Key insight:** The deduction-on-ready pattern (POS-04) is already fully designed in the pipeline spec §4.4 and the PrepBatchesService has 90% of the implementation. Phase 10 is wiring the trigger, not inventing a new algorithm.

---

## Common Pitfalls

### Pitfall 1: KDS updateItemStatus is NOT in a $transaction (Phase 9)
**What goes wrong:** The current `KdsService.updateItemStatus()` uses `this.prisma.orderItem.update()` directly (no transaction). If we add deduction calls alongside it without wrapping the whole thing in `$transaction`, a crash between the deduction write and the status write leaves inconsistent state.
**Why it happens:** Phase 9 had no deduction — a transaction was not needed. Phase 10 adds it.
**How to avoid:** Wrap the entire `updateItemStatus()` body in `this.prisma.$transaction()` when newStatus === 'ready'. The "all items ready → order ready" check also moves inside the transaction.
**Warning signs:** If the spec test shows `orderItem.status = 'ready'` but stock was not decremented (or vice versa), the transaction is not atomic.

### Pitfall 2: convertUnit() must receive the transaction client inside $transaction
**What goes wrong:** `convertUnit(qty, from, to, this.prisma)` works normally but inside a `$transaction(async (tx) => {...})` you must pass `tx` not `this.prisma`. The unit conversion cache is module-level so this works; the pattern matters for correctness.
**Why it happens:** Phase 8 documented this as Research Pitfall 2 and it was enforced in PrepBatchesService.
**How to avoid:** Every `convertUnit()` call inside a `$transaction` lambda receives `tx`, not `this.prisma`.

### Pitfall 3: zone_id required on Order creation
**What goes wrong:** The Order model has `zone_id String` as a non-nullable FK. If the POS does not include zone_id in the CreateOrderDto, Prisma will throw a required field error at runtime.
**Why it happens:** KDS groups orders by zone (for kitchen display routing). The zone was added in Phase 9 schema.
**How to avoid:** Determine the correct zone for each order. Since menu items belong to a category → brand → zone (via Recipe), the zone can be inferred from the first item's recipe zone, OR a default kitchen zone can be passed from the frontend. The planner must specify how zone_id is determined at order creation time.
**Warning signs:** `PrismaClientValidationError: Argument zone_id for data.zone_id is missing` at order creation.

### Pitfall 4: AnimatedList auto-cycling behavior
**What goes wrong:** Using `<AnimatedList>` wrapper for cart items triggers an internal `setIndex()` timeout that auto-cycles which items are visible. With 3+ cart items, older items disappear until the cycle completes.
**Why it happens:** The MagicUI `AnimatedList` component is designed for notification-stream demos, not interactive lists.
**How to avoid:** Use `AnimatedListItem` inside `AnimatePresence` directly:
```tsx
<AnimatePresence>
  {cartItems.map((item) => (
    <AnimatedListItem key={item.menu_item_id}>
      <PosCartItemRow item={item} ... />
    </AnimatedListItem>
  ))}
</AnimatePresence>
```
**Warning signs:** Cart items disappear after a few seconds or only the most recently added item is visible.

### Pitfall 5: ChannelModifier upsert semantics
**What goes wrong:** If no ChannelModifier exists for a channel (e.g., dine_in has no modifier configured), a `findUnique` returns null. The code must handle null gracefully — `channel_modifier_amount = 0` and `total = subtotal`.
**Why it happens:** Modifiers are optional; not every channel necessarily has one configured.
**How to avoid:** Always null-check modifier before applying. Do not throw if modifier is null.

### Pitfall 6: Daily revenue summary scope
**What goes wrong:** "Revenue Today" must match the user's local timezone, not UTC midnight. `WHERE created_at >= '2026-03-21T00:00:00Z'` gives wrong results if the villa is in IST (UTC+5:30) — it misses orders from 0:00–5:30 local time.
**Why it happens:** Postgres stores timestamps in UTC; "today" is ambiguous without timezone.
**How to avoid:** The backend should accept `date` query parameter (YYYY-MM-DD) for the daily summary endpoint and compute `startOfDay`/`endOfDay` at the server level using the local timezone offset (IST = UTC+5:30). Alternatively, accept `date_from`/`date_to` as ISO timestamps from the frontend (frontend knows local time).
**Warning signs:** Daily totals are visibly wrong when tested near midnight.

### Pitfall 7: Payment.order_id is @unique
**What goes wrong:** `Payment` has `order_id String @unique` — there can be only one Payment per Order. If staff attempts to record payment twice, Prisma throws a unique constraint error.
**Why it happens:** D-12 locks this as single Payment per order (no gateway).
**How to avoid:** Before creating a Payment, check if one already exists. If it does, update it (PATCH semantics) rather than creating a new one, OR return 409 Conflict and surface "Payment already recorded" toast.

---

## Code Examples

Verified patterns from existing codebase:

### FIFO Batch Deduction (reference implementation from Phase 9)
```typescript
// Source: backend/src/kitchen/prep-batches/prep-batches.service.ts
// deductSubRecipeBatches() — copy this pattern for order deduction
private async deductSubRecipeBatches(tx: any, params: { ... }) {
  const batches = await tx.prepBatch.findMany({
    where: { recipe_id: params.sourceRecipeId, status: 'active',
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
    orderBy: { created_at: 'asc' },  // FIFO
  });
  let remainingNeed = await convertUnit(params.needed, params.lineUnit, params.sourceYieldUnit, tx);
  for (const batch of batches) {
    if (remainingNeed <= 0) break;
    const deduct = Math.min(Number(batch.quantity_remaining), remainingNeed);
    await tx.prepBatch.update({
      where: { id: batch.id },
      data: { quantity_remaining: { decrement: deduct },
        ...(Number(batch.quantity_remaining) - deduct <= 0 ? { status: 'depleted' } : {}) }
    });
    remainingNeed -= deduct;
  }
  if (remainingNeed > 0) throw new BadRequestException(`Insufficient prep batch stock for ...`);
}
```

### StockMovement for order deduction
```typescript
// Source: backend/src/kitchen/prep-batches/prep-batches.service.ts — deductIngredient()
// movement_type for order: 'order_deducted' (not 'prep_deducted')
await tx.stockMovement.create({
  data: {
    ingredient_id: params.ingredientId,
    zone_id: params.zoneId,
    movement_type: 'order_deducted',   // distinguishes from prep_deducted
    quantity: -neededBase,
    original_quantity: params.needed,
    unit: params.lineUnit,
    reference_type: 'order',           // per pipeline spec §3.5
    reference_id: orderId,
    created_by: userId,
  }
});
```

### KDS updateItemStatus — current signature (Phase 9)
```typescript
// Source: backend/src/kitchen/kds/kds.service.ts
async updateItemStatus(itemId: string, newStatus: string): Promise<{ id: string; status: string; ready_at: Date | null }>
// Phase 10 MUST extend this method — same signature, wrapped in $transaction, deduction injected
```

### Servings availability endpoint (existing, Phase 9)
```typescript
// Source: backend/src/menu/menu.controller.ts + menu.service.ts
// GET /menu/availability/:menuItemId → { available: boolean, servings_remaining: number }
// Phase 10 should ADD: GET /menu/availability (batch, no id) → Record<menuItemId, { ... }>
```

### React Query with refetchInterval (frontend polling pattern)
```typescript
// Source: established project pattern from Phase 9 KDS metrics bar (10s polling)
useQuery({
  queryKey: ['menu', 'availability-batch'],
  queryFn: () => apiClient.get<Record<string, { available: boolean; servings_remaining: number }>>('/menu/availability'),
  refetchInterval: 10000,
  staleTime: 8000,
})
```

### Module dependency pattern
```typescript
// Source: backend/src/kitchen/kitchen.module.ts
// KitchenModule exports PrepBatchesService
// OrdersModule must import KitchenModule to access PrepBatchesService for deduction
// OR deduction logic lives in OrdersModule and KitchenModule imports OrdersModule
@Module({
  imports: [/* KitchenModule or MenuModule as needed */],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 9: KDS reads orders (no deduction) | Phase 10: KDS triggers deduction on item ready | Phase 10 | updateItemStatus() must be extended to wrap in $transaction |
| Phase 9: availability endpoint per-item only | Phase 10: batch availability endpoint added | Phase 10 (new) | POS page loads all item availability in one call, not N calls |
| No MANAGE_POS permission (not in Permission enum) | MANAGE_POS must be added | Phase 10 | New permission needed in backend/src/types/permissions.ts; roles seeded appropriately |

**Deprecated/outdated:**
- `AnimatedList` wrapper for interactive lists: use `AnimatedListItem` inside `AnimatePresence` directly for user-driven lists.
- Plain `prisma.orderItem.update()` in KdsService for status=ready: must become `prisma.$transaction()` with deduction.

---

## Open Questions

1. **zone_id on Order creation — how is zone determined?**
   - What we know: Order model has required `zone_id` FK (added in Phase 9 schema). KDS groups by zone.
   - What's unclear: Should the POS frontend send a zone_id? Is there a default kitchen zone? Can it be inferred from the brand selected?
   - Recommendation: The planner should decide. Simplest approach: a `default_zone_id` stored in settings, or the zone associated with the selected brand (via `Brand → Zone` relationship if it exists). If not, POS UI needs a zone selector (adds complexity). The pipeline spec §3.8 shows `zone_id` on Order but does not specify how it is set at POS time.

2. **MANAGE_POS permission — add new or reuse MANAGE_KITCHEN?**
   - What we know: Current `Permission` enum (backend/src/types/permissions.ts) does not have `MANAGE_POS`. KDS uses `MANAGE_KITCHEN`. The CONTEXT.md says "MANAGE_POS permission (or all authenticated staff — TBD by planner)".
   - What's unclear: Should POS be gated by a new permission or accessible to all authenticated staff?
   - Recommendation: Add `MANAGE_POS` to the Permission enum. Assign it broadly (to FRONTEND_LEAD, BACKEND_LEAD, and any role that operates the POS). This is the established pattern for other domain operations.

3. **Batch availability endpoint — add now or poll per-item?**
   - What we know: Phase 9 has per-item `GET /menu/availability/:menuItemId`. POS has 20-50 items.
   - What's unclear: Whether N parallel requests at 10s polling is acceptable.
   - Recommendation: Add `GET /menu/availability` (no ID) that returns a map of `menuItemId → { available, servings_remaining }` for all active menu items. One query per poll instead of N. Implement as a new method in `MenuService.getAllServingsAvailable()`.

4. **Order ID display format**
   - What we know: UI-SPEC says order IDs shown as "#XXXX" (last 4 hex of UUID, uppercase). KDS uses same pattern: `order.id.slice(-4).toUpperCase()`.
   - What's unclear: Nothing — this is consistent with the existing KDS implementation.
   - Recommendation: Use the same `id.slice(-4).toUpperCase()` pattern throughout all POS pages.

---

## Validation Architecture

nyquist_validation is enabled (config.json: `"nyquist_validation": true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (NestJS built-in) |
| Config file | `backend/package.json` (jest config inline) |
| Quick run command | `cd D:/aditee/konmaxperience/backend && npm test -- --testPathPattern=orders` |
| Full suite command | `cd D:/aditee/konmaxperience/backend && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POS-01 | Menu availability fetch returns servings count | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |
| POS-02 | Order creation with channel modifier applied correctly | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |
| POS-02 | Order status transition: placed → served/dispatched/cancelled | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |
| POS-03 | Payment recorded; duplicate payment returns 409 | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |
| POS-04 | markItemReady deducts PrepBatch quantity_remaining (FIFO) | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |
| POS-04 | markItemReady deducts IngredientStock for direct-use items | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |
| POS-04 | markItemReady: all items ready → order.status = 'ready' | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |
| POS-04 | markItemReady: deduction + status are atomic (transaction rollback on failure) | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |
| POS-05 | delivery_status advance: picked_up → in_transit → delivered | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |
| POS-06 | getOrders filters by channel, status, date range, payment method | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |
| POS-06 | Daily revenue: correct sum, count, average | unit | `npm test -- --testPathPattern=orders.service` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd D:/aditee/konmaxperience/backend && npm test -- --testPathPattern=orders.service --passWithNoTests`
- **Per wave merge:** `cd D:/aditee/konmaxperience/backend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/orders/orders.service.spec.ts` — covers all POS-01 through POS-06 behaviors above
- [ ] Mock Prisma tx pattern: same as `prep-batches.service.spec.ts` createMockTx() — reuse that pattern
- [ ] `convertUnit` mock: same `jest.mock('../../common/utils/unit-conversion', ...)` pattern as prep-batches spec

*(Frontend has no test framework set up — no test files, no jest/vitest config in frontend. Frontend testing is manual-only for this project.)*

---

## Sources

### Primary (HIGH confidence)
- `D:/aditee/konmaxperience/backend/prisma/schema.prisma` — Order, OrderItem, Payment models verified present with all fields from pipeline spec §3.8
- `D:/aditee/konmaxperience/backend/src/kitchen/kds/kds.service.ts` — Current KDS implementation; confirmed does NOT have $transaction or deduction
- `D:/aditee/konmaxperience/backend/src/kitchen/prep-batches/prep-batches.service.ts` — FIFO deduction pattern; direct template for Phase 10 deduction logic
- `D:/aditee/konmaxperience/backend/src/menu/menu.service.ts` — getServingsAvailable() confirmed as per-item only; batch endpoint confirmed absent
- `D:/aditee/konmaxperience/backend/src/types/permissions.ts` — MANAGE_POS confirmed absent; MANAGE_KITCHEN is the closest existing permission
- `D:/aditee/konmaxperience/frontend/components/ui/animated-list.tsx` — AnimatedList auto-cycle behavior confirmed; AnimatedListItem is the safe primitive
- `D:/aditee/konmaxperience/.planning/phases/10-pos-orders/10-UI-SPEC.md` — All component choices, layout contracts, interaction contracts confirmed

### Secondary (MEDIUM confidence)
- `D:/aditee/konmaxperience/docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` §4.4 — Deduction-on-ready algorithm; confirmed matches implemented PrepBatchesService pattern
- `D:/aditee/konmaxperience/.planning/STATE.md` — Phase 9 decisions about zone_id on Order; AnimatedList delay=150ms decision

### Tertiary (LOW confidence)
- None — all key findings verified against actual source files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as installed in package.json
- Architecture: HIGH — patterns confirmed from existing Phase 9 source code
- Pitfalls: HIGH — derived from reading actual source files, not training data assumptions
- Validation: HIGH — test framework confirmed from existing spec files

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable codebase; expires only if Phase 9 KDS code is modified)
