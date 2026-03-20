# Food Production Pipeline — System Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Phases 7-13 data model, business logic, and entity relationships

---

## 1. Overview

This spec defines the complete data model and business logic for the food production pipeline in Konma Xperience OS. It covers: multi-stage recipes, unit conversion, inventory tracking, procurement, kitchen prep, POS ordering, delivery, and customer experience.

The pipeline serves a villa kitchen with 8 team members across 3 channels: dine-in, takeaway, and own delivery.

---

## 2. Core Principle: Recipes Are Uniform

Every recipe is the same entity. There is no `recipe_type` (prep vs assembly). A recipe is simply "inputs → output." Some inputs are raw ingredients, some are outputs of other recipes. Whether a recipe is customer-facing is determined solely by whether a MenuItem references it.

This allows unlimited chaining depth without special handling:
- Spice Mix (raw → output)
- Marinade (Spice Mix output + raw yogurt → output)
- Marinated Chicken (Marinade output + raw chicken → output)
- Chicken Tikka (Marinated Chicken output + raw garnish → output, referenced by MenuItem)

---

## 3. Data Model

### 3.1 Recipe & BOM

```
Recipe
  id              String    @id @default(uuid())
  name            String
  description     String
  prep_steps      String    // text or JSON array of steps
  cooking_method  String
  yield_qty       Decimal   // how much one batch produces
  yield_unit      String    // "ml", "g", "pieces", "portions"
  portion_size    String    // "1 serving", "200ml" — display only
  shelf_life_hours Int?     // how long output lasts (nullable for raw-to-serve)
  brand_id        String?   // FK Brand
  zone_id         String?   // FK Zone — which kitchen area
  image_url       String?   // photo of output
  computed_cost   Decimal?  // cached cost, recomputed on save
  status          String    @default("draft") // draft → approved → archived
  created_by      String    // FK User
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

RecipeLine
  id              String    @id @default(uuid())
  recipe_id       String    // FK Recipe
  input_type      String    // "ingredient" | "recipe"
  ingredient_id   String?   // FK Ingredient (when input_type=ingredient)
  source_recipe_id String?  // FK Recipe (when input_type=recipe)
  quantity        Decimal   // amount needed for one recipe yield
  unit            String    // can be any unit — converted via UnitConversion
  prep_notes      String?
  sort_order      Int       @default(0)
```

### 3.2 Ingredients & Units

```
Ingredient
  id              String    @id @default(uuid())
  name            String
  category        String    // "dairy", "vegetable", "spice", "grain", "meat", "oil"
  base_unit       String    // canonical unit: "g", "ml", "pieces"
  min_stock_level Decimal   // in base_unit — triggers low-stock alert
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

UnitConversion
  id              String    @id @default(uuid())
  from_unit       String
  to_unit         String
  factor          Decimal   // multiply from_unit value by this to get to_unit

  @@unique([from_unit, to_unit])

  Seed: kg→g:1000, g→kg:0.001, L→ml:1000, ml→L:0.001, dozen→pieces:12, pieces→dozen:0.0833
```

### 3.3 Vendors & Pricing

```
Vendor
  id              String    @id @default(uuid())
  name            String
  phone           String?
  email           String?
  address         String?
  payment_terms   String?   // "COD", "Net 7", "Net 30"
  status          String    @default("active") // active | inactive
  created_at      DateTime  @default(now())

VendorPrice
  id              String    @id @default(uuid())
  vendor_id       String    // FK Vendor
  ingredient_id   String    // FK Ingredient
  price           Decimal   // per unit
  unit            String    // procurement unit: "kg", "L", "dozen"
  effective_date  DateTime  // latest by date = current price
  created_at      DateTime  @default(now())
```

### 3.4 Menu

```
MenuCategory
  id              String    @id @default(uuid())
  name            String    // "Starters", "Mains", "Desserts", "Beverages"
  brand_id        String    // FK Brand
  sort_order      Int       @default(0)
  status          String    @default("active") // active | inactive

MenuItem
  id              String    @id @default(uuid())
  recipe_id       String    // FK Recipe
  category_id     String    // FK MenuCategory
  name            String    // display name (can differ from recipe name)
  base_price      Decimal
  image_url       String?
  available       Boolean   @default(true)  // manual override toggle
  status          String    @default("active") // active | inactive
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

ChannelModifier
  id              String    @id @default(uuid())
  channel_type    String    // "dine_in" | "takeaway" | "delivery"
  modifier_type   String    // "fixed" | "percentage"
  modifier_value  Decimal   // +30 or +8.5
  status          String    @default("active")

  @@unique([channel_type])
```

### 3.5 Inventory

```
IngredientStock
  id              String    @id @default(uuid())
  ingredient_id   String    // FK Ingredient
  zone_id         String    // FK Zone
  current_quantity Decimal  // always in ingredient.base_unit
  updated_at      DateTime  @updatedAt

  @@unique([ingredient_id, zone_id])

StockMovement
  id              String    @id @default(uuid())
  ingredient_id   String    // FK Ingredient
  zone_id         String    // FK Zone
  movement_type   String    // "received" | "prep_deducted" | "order_deducted" | "waste" | "adjustment"
  quantity        Decimal   // in base_unit (positive=in, negative=out)
  original_quantity Decimal // in original unit for display
  unit            String    // original unit for display
  reason          String?
  reference_type  String?   // "purchase_order" | "prep_batch" | "order" | "waste_log"
  reference_id    String?
  created_by      String    // FK User
  created_at      DateTime  @default(now())
```

### 3.6 Procurement

```
PurchaseOrder
  id              String    @id @default(uuid())
  vendor_id       String    // FK Vendor
  status          String    @default("draft") // draft → ordered → received → cancelled
  total_amount    Decimal   @default(0)
  notes           String?
  ordered_by      String    // FK User
  ordered_at      DateTime? // when status → ordered
  received_at     DateTime? // when status → received
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

PurchaseOrderLine
  id              String    @id @default(uuid())
  po_id           String    // FK PurchaseOrder
  ingredient_id   String    // FK Ingredient
  quantity        Decimal   // in procurement unit
  unit            String    // "kg", "L", "dozen"
  unit_cost       Decimal
  received_quantity Decimal? // may differ from ordered
```

### 3.7 Kitchen & Prep

```
PrepBatch
  id              String    @id @default(uuid())
  recipe_id       String    // FK Recipe
  zone_id         String    // FK Zone
  quantity_produced Decimal // in recipe.yield_unit
  quantity_remaining Decimal
  unit            String    // same as recipe.yield_unit
  prepared_by     String    // FK User
  expires_at      DateTime? // auto: created_at + recipe.shelf_life_hours
  status          String    @default("active") // active | depleted | expired
  created_at      DateTime  @default(now())

WasteLog
  id              String    @id @default(uuid())
  waste_type      String    // "ingredient" | "prep_batch"
  ingredient_id   String?   // FK Ingredient
  prep_batch_id   String?   // FK PrepBatch
  quantity        Decimal
  unit            String
  reason          String    // "spoilage" | "over_prep" | "cooking_error" | "expired" | "other"
  reason_notes    String?
  cost_impact     Decimal   // auto-calculated
  logged_by       String    // FK User
  zone_id         String    // FK Zone
  created_at      DateTime  @default(now())
```

### 3.8 Orders & POS

```
Order
  id              String    @id @default(uuid())
  channel         String    // "dine_in" | "takeaway" | "delivery"
  status          String    @default("placed") // placed → preparing → ready → served | dispatched | cancelled
  table_number    String?   // dine-in only
  customer_name   String?
  customer_phone  String?
  delivery_address String?  // delivery only
  delivery_assigned_to String? // plain name string
  delivery_status String?   // "picked_up" | "in_transit" | "delivered"
  subtotal        Decimal
  channel_modifier_amount Decimal @default(0)
  total           Decimal
  notes           String?
  created_by      String    // FK User (POS operator)
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

OrderItem
  id              String    @id @default(uuid())
  order_id        String    // FK Order
  menu_item_id    String    // FK MenuItem
  quantity        Int
  unit_price      Decimal   // snapshot of base_price at order time
  item_notes      String?   // "no onions", "extra spicy"
  status          String    @default("pending") // pending → preparing → ready
  ready_at        DateTime? // when cook marks ready
  created_at      DateTime  @default(now())

Payment
  id              String    @id @default(uuid())
  order_id        String    // FK Order
  method          String    // "cash" | "card" | "upi"
  amount          Decimal
  status          String    @default("pending") // pending | paid | refunded
  notes           String?   // "₹500 cash + ₹200 UPI"
  created_at      DateTime  @default(now())
```

### 3.9 Customer Experience

```
Feedback
  id              String    @id @default(uuid())
  order_id        String?   // FK Order (nullable — general feedback)
  rating          Int       // 1-5
  comment         String?
  customer_name   String?
  customer_phone  String?
  created_at      DateTime  @default(now())

Event
  id              String    @id @default(uuid())
  title           String
  description     String
  event_type      String    // "tasting" | "workshop" | "popup"
  date            DateTime
  capacity        Int
  current_bookings Int      @default(0)
  price           Decimal?  // nullable — free events
  zone_id         String?   // FK Zone
  brand_id        String?   // FK Brand
  image_url       String?
  status          String    @default("upcoming") // upcoming | full | completed | cancelled
  created_by      String    // FK User
  created_at      DateTime  @default(now())

EventBooking
  id              String    @id @default(uuid())
  event_id        String    // FK Event
  customer_name   String
  customer_phone  String
  guests          Int       @default(1)
  status          String    @default("confirmed") // confirmed | cancelled
  booked_at       DateTime  @default(now())
```

### 3.10 Notifications

```
Notification
  id              String    @id @default(uuid())
  user_id         String    // FK User
  type            String    // task_deadline | task_blocked | approval_pending | low_stock | new_order | order_ready | delivery_update | prep_low | prep_expired
  title           String
  message         String
  read            Boolean   @default(false)
  entity_type     String?   // "task" | "order" | "ingredient" | "prep_batch"
  entity_id       String?
  created_at      DateTime  @default(now())
```

### 3.11 Existing Model Update

```
Asset (add field)
  linked_recipe_id String?  // FK Recipe — attach SOPs, plating guides to recipes
```

---

## 4. Business Logic

### 4.1 Menu Availability

```
isMenuItemAvailable(menuItem):
  if menuItem.available === false → return false (manual override)
  if menuItem.status !== "active" → return false

  for each line in menuItem.recipe.RecipeLines:
    if line.input_type === "recipe":
      activeBatches = PrepBatch where recipe_id=line.source_recipe_id, status="active", expires_at > now()
      totalRemaining = sum(quantity_remaining)
      needed = convert(line.quantity, line.unit, batch.unit)
      if totalRemaining < needed → return false

    if line.input_type === "ingredient":
      stock = IngredientStock where ingredient_id=line.ingredient_id
      needed = convert(line.quantity, line.unit, ingredient.base_unit)
      if stock.current_quantity < needed → return false

  return true

getServingsAvailable(menuItem):
  minServings = Infinity
  for each line in recipe.RecipeLines:
    available = (total remaining or stock quantity)
    needed_per_serving = convert(line.quantity, line.unit, target)
    servings = floor(available / needed_per_serving)
    minServings = min(minServings, servings)
  return minServings
```

Computed on POS load and on each order submission. Not cached.

### 4.2 Cost Calculation (Recursive)

```
calculateRecipeCost(recipe):
  totalCost = 0
  for each line in recipe.RecipeLines:
    if line.input_type === "ingredient":
      bestPrice = latest VendorPrice for ingredient
      qtyInPriceUnit = convert(line.quantity, line.unit, bestPrice.unit)
      totalCost += qtyInPriceUnit * bestPrice.price

    if line.input_type === "recipe":
      sourceCost = calculateRecipeCost(line.source_recipe)  // recursive
      costPerUnit = sourceCost / source_recipe.yield_qty
      qtyInYieldUnit = convert(line.quantity, line.unit, source_recipe.yield_unit)
      totalCost += costPerUnit * qtyInYieldUnit

  return totalCost  // cost for one full recipe yield

MenuItem food cost:
  recipeCost = calculateRecipeCost(menuItem.recipe)
  costPerServing = recipeCost / recipe.yield_qty × portion_quantity
  foodCostPercent = (costPerServing / menuItem.base_price) × 100
```

Cached in `Recipe.computed_cost`. Recalculated on recipe save or VendorPrice change.

### 4.3 PrepBatch Creation

```
createPrepBatch(recipe_id, quantity_to_prep, zone_id, user_id):
  recipe = getRecipe(recipe_id)
  multiplier = quantity_to_prep / recipe.yield_qty

  $transaction:
    for each line in recipe.RecipeLines:
      needed = line.quantity * multiplier

      if line.input_type === "ingredient":
        needed_base = convert(needed, line.unit, ingredient.base_unit)
        stock = IngredientStock(ingredient_id, zone_id)
        if stock.current_quantity < needed_base → throw InsufficientStockError
        stock.current_quantity -= needed_base
        create StockMovement(type: "prep_deducted", qty: -needed_base, ref: prep_batch)

      if line.input_type === "recipe":
        batches = active non-expired PrepBatches for source_recipe, ordered by created_at ASC (FIFO)
        remaining_need = convert(needed, line.unit, batch.unit)
        for batch in batches:
          deduct = min(batch.quantity_remaining, remaining_need)
          batch.quantity_remaining -= deduct
          if batch.quantity_remaining <= 0 → batch.status = "depleted"
          remaining_need -= deduct
          if remaining_need <= 0 → break
        if remaining_need > 0 → throw InsufficientPrepError

    create PrepBatch(
      recipe_id, zone_id,
      quantity_produced: quantity_to_prep,
      quantity_remaining: quantity_to_prep,
      unit: recipe.yield_unit,
      prepared_by: user_id,
      expires_at: now() + recipe.shelf_life_hours
    )
```

### 4.4 Order Fulfillment (Deduct on Ready)

```
markOrderItemReady(orderItem_id):
  $transaction:
    orderItem = getOrderItem(orderItem_id)
    menuItem = getMenuItem(orderItem.menu_item_id)
    recipe = menuItem.recipe

    for i in range(orderItem.quantity):  // deduct per serving
      for each line in recipe.RecipeLines:
        if line.input_type === "recipe":
          batches = active non-expired PrepBatches for source_recipe (FIFO)
          needed = convert(line.quantity, line.unit, batch.unit)
          // deduct from batches (same FIFO logic as prep)

        if line.input_type === "ingredient":
          needed = convert(line.quantity, line.unit, ingredient.base_unit)
          stock = IngredientStock(ingredient_id)
          stock.current_quantity -= needed
          create StockMovement(type: "order_deducted", ref: order)

    orderItem.status = "ready"
    orderItem.ready_at = now()

    // Check if all items in order are ready
    allReady = all OrderItems for this order have status="ready"
    if allReady → order.status = "ready"

    // Fire alerts if stock/prep is low
    checkAndFireLowStockAlerts()
    checkAndFireLowPrepAlerts()
```

### 4.5 PO Receiving

```
receivePurchaseOrder(po_id, lines_received):
  $transaction:
    po = getPurchaseOrder(po_id)
    for each lineReceived in lines_received:
      poLine = getPOLine(lineReceived.id)
      poLine.received_quantity = lineReceived.quantity

      // Convert to base unit
      ingredient = getIngredient(poLine.ingredient_id)
      qty_base = convert(lineReceived.quantity, poLine.unit, ingredient.base_unit)

      // Update stock
      stock = getOrCreate IngredientStock(ingredient_id, default_zone_id)
      stock.current_quantity += qty_base

      create StockMovement(type: "received", qty: +qty_base, ref: po)

    po.status = "received"
    po.received_at = now()
    po.total_amount = sum(line.received_quantity * line.unit_cost)
```

### 4.6 Expiry Handling

Cron job (or BullMQ scheduled job) runs every hour:

```
handleExpiredPrepBatches():
  expired = PrepBatch where status="active" AND expires_at < now()
  for each batch in expired:
    batch.status = "expired"
    if batch.quantity_remaining > 0:
      create WasteLog(
        waste_type: "prep_batch",
        prep_batch_id: batch.id,
        quantity: batch.quantity_remaining,
        unit: batch.unit,
        reason: "expired",
        cost_impact: calculateWasteCost(batch)
      )
```

---

## 5. Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Recipe type field | None — unified entity | Depth emerges from connections, not types |
| Chain depth limit | Unlimited | RecipeLine naturally chains via source_recipe_id |
| Unit conversion | Conversion table (B) | Flexible — procurement in kg, recipes in g |
| Inventory deduction timing | On "ready" (C) | Simple, no reversal needed, matches villa kitchen |
| Menu availability | Check immediate inputs only (B) | System tracks, kitchen decides when to prep |
| Channel pricing | Base price + channel modifier (A) | One modifier per channel, not per item |
| Delivery staff | Plain string field (C) | 1-2 riders, everyone knows them |
| Split payments | Single record + notes (B) | No gateway, just recording |
| Menu categories | Brand → Category → Items (B) | Supports multi-brand |
| Daily menu override | Available toggle on MenuItem (A) | Manual override, DailyMenu deferred to v2 |
| Recipe ↔ Asset | Both image_url + linked_recipe_id (C) | Fast POS display + full documentation |
| Prep expiry | shelf_life_hours on Recipe (B) | Auto-calculated, kitchen doesn't decide per batch |
| Allergen tracking | Skip for v1 (C) | Staff knows, verbal communication |
| KDS updates | Polling every 5s | No WebSocket infrastructure needed for v1 |
| Cost caching | computed_cost on Recipe | Recalculate on save or price change |

---

## 6. Entity Summary

| Phase | New Entities | Count |
|-------|-------------|-------|
| 7 — Recipe | Recipe, RecipeLine, Ingredient, UnitConversion, Vendor, VendorPrice, MenuItem, MenuCategory | 8 |
| 8 — Inventory | IngredientStock, StockMovement, PurchaseOrder, PurchaseOrderLine | 4 |
| 9 — Kitchen | PrepBatch, WasteLog | 2 |
| 10 — POS | Order, OrderItem, Payment, ChannelModifier | 4 |
| 12 — Notifications | Notification | 1 |
| 13 — Customer | Feedback, Event, EventBooking | 3 |
| Update | Asset (add linked_recipe_id) | 0 |
| **Total** | | **22 new + 1 updated** |

---

*Spec version: 1.0*
*Author: Claude + Aditee*
*Approved: Pending*
