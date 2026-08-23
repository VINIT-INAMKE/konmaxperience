# P5a Marketplace Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The backend sells all four `ProductType`s through one catalog and one mixed-fulfilment `quote → pay → confirm` pipeline — with Shiprocket shipments behind a provider interface, coupons, loyalty, reviews, faceted search and refunds — landing the nine commerce models P2 deferred, in **one** migration `p5a_marketplace_backend`.

**Architecture:** Task 1 adds every new model to `schema.prisma` *without* a migration, so Tasks 2–17 compile, type-check and unit-test against a generated client while the database stays on the P2 baseline. Task 18 writes the single migration, applies it, seeds and smoke-tests. The money path is one method (`FulfilmentService.confirmPaidOrder`) that P5a **extends**, never forks: the quote freezes the numbers, the pay step copies them into `pending_order:{rzp_order_id}`, and confirm (endpoint **and** webhook) replays the same frozen payload through the same Serializable transaction. Shipping HTTP lives behind a `ShippingProvider` interface with a `manual` default, so no test ever touches the network.

**Tech Stack:** NestJS 11, Prisma 6.19 (PostgreSQL), Jest 30 + ts-jest (config inline in `backend/package.json`, `rootDir: "src"`, `testRegex: ".*\.spec\.ts$"`, **60 suites / 603 tests green at `0da0e09`**), class-validator, ioredis (Upstash), Razorpay 2.9, Pusher, npm, Node 22. Branch `v2-os-marketplace`. Local database: Docker Postgres `konma-postgres` on `localhost:5433` (db/user/pass `konma`, shadow db `konma_shadow`), already carrying the P2 baseline + reference + demo seeds. **`prisma migrate reset` is NOT available to agents** (Prisma 6.19 AI-agent guard) — Task 18 uses `migrate dev --create-only` + `migrate deploy`. Build output is `backend/dist/src/main.js`.

**Gates that must stay green after every task:** `npx jest --silent` (60 → 79 suites), `npx tsc --noEmit -p tsconfig.build.json` (exit 0), `npx eslint "{src,apps,libs,test}/**/*.ts"` (**0 errors**; warnings are pre-existing), `npx prisma validate`.

---

## Decisions taken while reading the code

1. **GST is inclusive, so tax is carved out of the price, never added to it.** SPEC §3.3 says `tax_rate Decimal (GST %, inclusive pricing)`. Therefore per line: `gross = unit_price × qty`; `tax = round(gross × rate / (100 + rate))`; `taxable = gross − tax`. `Order.subtotal` is the **gross** (tax-inclusive) sum, `Order.tax_amount` is the carved-out tax *already contained in* `subtotal`, and `total = subtotal − discount_amount + shipping_amount`. `tax_amount` is **never** added to `total`. This is the single most load-bearing money decision in the phase — see Self-review "for sign-off".
2. **All arithmetic happens in integer paise; `Decimal` only at the Prisma boundary.** `backend/src/common/money/money.ts` exposes `toPaise` / `toDecimal` / `inclusiveTaxPaise` / `percentOfPaise`. No `Number` multiplication or division on rupee values anywhere in the checkout path. The existing `customer-orders.service.ts` float arithmetic (`subtotal + serverPrice * item.quantity`, `Math.round(total * 100)`) is replaced in Task 9.
3. **Money leaves the API as JSON numbers, not strings.** `main.ts:119` installs `DecimalSerializationInterceptor`, which converts every `Prisma.Decimal` to `.toNumber()`. The API contract appendix therefore shows `1234.5`, not `"1234.50"`. Phase 34 must not expect strings.
4. **A quote is a stored artefact, not a recomputation.** `POST /customer/checkout/quote` writes `quote:{customerId}:{quoteId}` to Redis with a 15-minute TTL and returns `quote_id`. `POST /customer/orders` takes `{ quote_id }`, re-validates availability and the coupon, and copies the **frozen** line totals into `pending_order:{rzp_order_id}`. Without this, price drift between quote and pay is unbounded.
5. **`PendingOrderData` becomes version-tagged (`v: 2`) and additive.** The v1 shape (`{ customerId, cart, subtotal, modifierAmount, total, channel, deliveryAddressId }`) is still readable: a payload with no `v` is upgraded in memory to v2 with zero discount/shipping/loyalty and `fulfilment: 'local'` on every line. A 30-minute TTL means at most one deploy window of v1 payloads exists.
6. **`OrderItem.fulfilment` is derived from `Product.fulfilment` at quote time and re-verified inside the confirm transaction.** Today it is never set (P2 summary follow-up #4) and defaults to `local`. Freezing it in the quote makes routing deterministic; re-reading `Product.fulfilment` inside the transaction stops a catalog edit between quote and confirm from silently re-routing a paid line.
7. **`confirmPaidOrder` is extended, not forked.** One new private step, `applyCommercialEffects(tx, order, pending, actor)`, runs inside the *same* Serializable transaction and writes `CouponRedemption`, `LoyaltyTransaction(redeem)`, `EventBooking → confirmed`, and shipped-line `OrderItemStatus.packed`. The webhook fallback (`WebhooksService.handleMarketplacePayment`) calls the same method, so the two paths cannot diverge.
8. **One `Shipment` per order** — `Shipment.order_id @unique`. A shipment covers *all* `fulfilment = shipped` lines of that order. This makes "pack" idempotent at the database level (P2002 → return the existing shipment) and avoids inventing a `ShipmentItem` join table SPEC does not model.
9. **The Shiprocket webhook is authenticated by a shared-secret header, not a body HMAC.** `main.ts:29-33` preserves `req.rawBody` **only** for `/webhooks/razorpay`; this plan does not touch `main.ts`. `POST /webhooks/shiprocket` compares an `x-konma-webhook-token` header to `SHIPROCKET_WEBHOOK_TOKEN` with `crypto.timingSafeEqual`, exactly as SPEC §5.3 words it ("shared-secret header").
10. **The shipping provider is resolved per call, not at boot.** `ShippingProviderResolver.get()` reads `SystemSetting['shipping'].provider` (seeded `manual`) on every call and returns `ManualProvider` or `ShiprocketAdapter`. `SHIPROCKET_*` env vars are validated **only** when `SHIPPING_PROVIDER=shiprocket` in production. Tests get `manual` unless they stub the setting — no jest run can reach the network.
11. **`ShiprocketAdapter` is typed against plain interfaces in `shipping.types.ts`, not Prisma model types.** This lets Task 3 (wave 1) run in parallel with Task 1 (schema) and keeps the adapter unit-testable with a `fetch` double.
12. **Commerce domain events live in a Phase-33-owned file.** `backend/src/common/events/domain-events.ts` belongs to **Phase 31**. P5a declares only its own subset in `backend/src/common/events/commerce-events.ts` (`shipment.status_changed`, `shipment.delivered`, `coupon.redeemed`, `review.published`, `order.confirmed`, `order.delivered`, `booking.attended`, `product.published`, `stock.low`) with the SPEC §4.1 literal names and the `{ node_id, actor, occurred_at, … }` envelope. Different filename ⇒ no merge conflict with Phase 31; the merge follow-up is a one-line re-export.
13. **Two new enums are declared** that SPEC §3.3 names but does not enumerate: `RefundStatus { pending processed failed }` and `CouponStatus { draft active disabled }`. Everything else reuses P2's already-declared `ShippingProvider`, `ShipmentStatus`, `CouponType`, `LoyaltyTier`, `LoyaltyReason`, `ReviewStatus`.
14. **`Coupon` has no denormalised `usage_count`.** Redemption limits are enforced by counting `CouponRedemption` rows (`@@unique([coupon_id, order_id])`, `@@index([coupon_id, customer_id])`). A counter column would drift under the Serializable retry.
15. **`Customer.default_address_id` is NOT added.** `CustomerAddress.is_default` already carries the same fact and is already maintained by `CustomerOrdersService.setDefaultAddress`. Duplicating it invites drift. Deviation from SPEC §3.3 recorded here.
16. **`EventBooking.order_item_id` is NOT added; `OrderItem.event_booking_id @unique` is.** SPEC §3.3 lists both directions, which would be a redundant cycle. The order side is the one checkout needs.
17. **`Event.product_id` is NOT added.** P2 shipped the reverse (`Product.event_id` + `Event.products Product[]`); `CAT-04` is satisfied by that relation. Adding the mirror FK creates a two-way optional cycle for no gain.
18. **`isServiceable` moves from `process.env.DELIVERY_PINCODES` to `SystemSetting['delivery_pincodes']`** (already seeded as `[]`), with the env var kept as a fallback when the setting is empty, so no environment change is required to deploy.
19. **`UsageEvent` lands in this phase's schema task**, per the brief, even though **Phase 32 consumes it**. `schema.prisma` has exactly one owner in P5a (Task 1). If Phase 32's plan also declares `UsageEvent`, the second one to merge deletes its copy — see "Execution partition → cross-phase collisions".
20. **`Order.zone_id` stays `zone_id`** (P2 decision 2 preserved). `FulfilmentService.resolveMarketplaceZoneId` and 40+ call sites keep working.
21. **The product search trigger is extended, not duplicated.** P2 already ships `product_search_text_refresh()` + `product_search_text_trg` + `Product_search_text_gin`. Task 18 adds a *second* trigger pair on `ProductCategory` and `Brand` so renaming a category or brand refreshes its products' `search_text`, and Task 4 adds facets to the existing `CatalogService.search` query. No new tsvector column, no second GIN index.
22. **Review aggregation is a database trigger**, per SPEC §5.4 ("maintained by trigger"). Task 18 writes `review_rating_rollup()` on `Review` INSERT/UPDATE/DELETE, so `Product.rating_avg`/`rating_count` are correct even when a review is moderated from a raw SQL fix-up.

---

## File structure

**Create (backend):**
- `backend/src/common/money/money.ts`, `money.spec.ts`
- `backend/src/common/events/commerce-events.ts`
- `backend/src/shipping/` — `shipping.types.ts`, `shipping.constants.ts`, `manual.provider.ts`, `manual.provider.spec.ts`, `shiprocket.adapter.ts`, `shiprocket.adapter.spec.ts`, `shipping-provider.resolver.ts`, `shipping-provider.resolver.spec.ts`, `shipping.module.ts`
- `backend/src/catalog/catalog-cache.service.ts`, `catalog-cache.service.spec.ts`
- `backend/src/checkout/` — `quote.types.ts`, `cart-pricing.service.ts`, `cart-pricing.service.spec.ts`, `checkout.service.ts`, `checkout.service.spec.ts`, `checkout.controller.ts`, `checkout.module.ts`, `dto/quote-checkout.dto.ts`, `dto/create-order-from-quote.dto.ts`
- `backend/src/promotions/` — `coupons.service.ts`, `coupons.service.spec.ts`, `coupons.controller.ts`, `promotions.module.ts`, `dto/create-coupon.dto.ts`, `dto/update-coupon.dto.ts`, `dto/validate-coupon.dto.ts`
- `backend/src/loyalty/` — `loyalty.service.ts`, `loyalty.service.spec.ts`, `loyalty.controller.ts`, `loyalty.cron.ts`, `loyalty.cron.spec.ts`, `loyalty.module.ts`, `dto/adjust-loyalty.dto.ts`
- `backend/src/shipments/` — `shipments.service.ts`, `shipments.service.spec.ts`, `shipments.controller.ts`, `shipments.module.ts`, `dto/pack-shipment.dto.ts`, `dto/manual-awb.dto.ts`
- `backend/src/webhooks/shiprocket-webhook.service.ts`, `shiprocket-webhook.service.spec.ts`
- `backend/src/refunds/` — `refunds.service.ts`, `refunds.service.spec.ts`, `refunds.controller.ts`, `refunds.module.ts`, `dto/create-refund.dto.ts`
- `backend/src/reviews/` — `reviews.service.ts`, `reviews.service.spec.ts`, `reviews.controller.ts`, `reviews.listener.ts`, `reviews.module.ts`, `dto/create-review.dto.ts`, `dto/moderate-review.dto.ts`
- `backend/src/orders/order-lifecycle.service.ts`, `order-lifecycle.service.spec.ts`
- `backend/src/events/event-holds.cron.ts`, `event-holds.cron.spec.ts`, `dto/mark-attendance.dto.ts`
- `backend/src/customers/` — `customers.service.ts`, `customers.service.spec.ts`, `customers.controller.ts`, `customers.module.ts`
- `backend/src/usage/` — `usage.service.ts`, `usage.service.spec.ts`, `usage.controller.ts`, `usage.module.ts`, `dto/record-usage.dto.ts`
- `backend/src/prisma/commerce-schema.spec.ts`
- `backend/prisma/seed-data/demo-commerce.ts`
- `backend/prisma/migrations/20260824090000_p5a_marketplace_backend/migration.sql`

**Modify (backend):** `backend/prisma/schema.prisma` (Task 1 only) · `backend/src/test-utils/mock-providers.ts` (Task 1 only) · `backend/src/settings/settings.service.ts` + `backend/prisma/seed-data/settings.ts` (Task 2) · `backend/src/config/env.validation.ts` + `backend/.env.example` (Task 3 only) · `backend/src/catalog/catalog.service.ts`, `catalog.controller.ts`, `catalog.module.ts`, `catalog.service.spec.ts` (Task 4) · `backend/src/customer-orders/customer-orders.service.ts`, `customer-orders.controller.ts`, `customer-orders.module.ts`, `dto/sync-cart.dto.ts`, `customer-orders.service.spec.ts` (Task 9) · `backend/src/fulfilment/fulfilment.service.ts`, `fulfilment.module.ts`, `fulfilment.service.spec.ts` (Task 10) · `backend/src/webhooks/webhooks.controller.ts`, `webhooks.module.ts` (Task 12) · `backend/src/webhooks/webhooks.service.ts`, `webhooks.service.spec.ts` (Task 13) · `backend/src/orders/orders.service.ts`, `orders.controller.ts`, `orders.module.ts`, `orders.service.spec.ts` (Task 15) · `backend/src/events/events.service.ts`, `events.controller.ts`, `events.module.ts`, `events.service.spec.ts` (Task 16) · `backend/src/app.module.ts` (Tasks 7, 11, 12, 17 — one per wave) · `backend/prisma/seed-demo.ts`, `backend/src/prisma/seed-data.spec.ts` (Task 18).

**Current state (verified at `0da0e09`):** 60 spec suites / 603 tests green; 1 migration (`20260823120000_p2_platform_foundation`) applied to `konma`; drift gate clean. Nine commerce models absent; their enums present. `Order` has `discount_amount`, `shipping_amount`, `tax_amount`, `loyalty_points_earned/redeemed` but **no `coupon_id`**. `OrderItem` has `variant_id`, `fulfilment` (always defaulted `local`) and `tax_rate` (always `0`). `CatalogService.search` exists with no facets and no cache. `RazorpayService.createRefund` exists and is called **only** by `EventsService` capacity auto-refund. `WebhooksService.handleRefundProcessed` flips `Payment.status` to `refunded` with no `Refund` row and no partial handling.

---

### Task 1: Every P5a model in `schema.prisma` + the shared jest registry

Additive only — no field type changes, no migration. Existing suites must stay green because nothing they read changes shape.

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/test-utils/mock-providers.ts`
- Create: `backend/src/prisma/commerce-schema.spec.ts`

- [ ] Append two enums to the "Declared for P5" block in `backend/prisma/schema.prisma` (immediately after `enum ReviewStatus`):

```prisma
enum RefundStatus {
  pending
  processed
  failed
}

enum CouponStatus {
  draft
  active
  disabled
}
```

- [ ] Append the nine models at the end of `backend/prisma/schema.prisma`. `NODE_DEFAULT` below is the literal `"11111111-1111-4111-8111-111111111111"` used by every other aggregate (see `backend/src/node/node.constants.ts`).

```prisma
// ─── P5a commerce (SPEC §3.3 — models deferred from P2) ──────────────────────

/// One shipment per order, covering every `fulfilment = shipped` line of that
/// order. `order_id` is unique so "pack" is idempotent at the database level.
model Shipment {
  id                   String           @id @default(uuid())
  node_id              String           @default("11111111-1111-4111-8111-111111111111")
  node                 Node             @relation(fields: [node_id], references: [id], onDelete: Restrict)
  order_id             String           @unique
  order                Order            @relation(fields: [order_id], references: [id], onDelete: Restrict)
  provider             ShippingProvider @default(manual)
  provider_order_id    String?
  provider_shipment_id String?
  awb                  String?          @unique
  courier_name         String?
  status               ShipmentStatus   @default(pending)
  label_url            String?
  tracking_url         String?
  pickup_location_code String           @default("")
  weight_grams         Int              @default(0)
  cost                 Decimal?         @db.Decimal(12, 2)
  etd                  DateTime?        @db.Timestamptz(3)
  packed_by            String?
  packer               User?            @relation("ShipmentPacker", fields: [packed_by], references: [id])
  created_at           DateTime         @default(now()) @db.Timestamptz(3)
  updated_at           DateTime         @updatedAt @db.Timestamptz(3)
  events               ShipmentEvent[]

  @@index([node_id, status, created_at])
}

/// Append-only tracking ledger. The unique triple is the SHIP-04 idempotency key
/// (`awb` is 1:1 with `shipment_id`, so the shipment id stands in for it).
model ShipmentEvent {
  id          String         @id @default(uuid())
  shipment_id String
  shipment    Shipment       @relation(fields: [shipment_id], references: [id], onDelete: Cascade)
  status      ShipmentStatus
  raw         Json?
  occurred_at DateTime       @db.Timestamptz(3)
  created_at  DateTime       @default(now()) @db.Timestamptz(3)

  @@unique([shipment_id, status, occurred_at])
  @@index([shipment_id, occurred_at])
}

model Refund {
  id                 String       @id @default(uuid())
  node_id            String       @default("11111111-1111-4111-8111-111111111111")
  node               Node         @relation(fields: [node_id], references: [id], onDelete: Restrict)
  order_id           String
  order              Order        @relation(fields: [order_id], references: [id], onDelete: Restrict)
  payment_id         String
  payment            Payment      @relation(fields: [payment_id], references: [id], onDelete: Restrict)
  amount             Decimal      @db.Decimal(12, 2)
  reason             String
  razorpay_refund_id String?      @unique
  status             RefundStatus @default(pending)
  requested_by       String?
  requester          User?        @relation("RefundRequester", fields: [requested_by], references: [id])
  created_at         DateTime     @default(now()) @db.Timestamptz(3)
  updated_at         DateTime     @updatedAt @db.Timestamptz(3)

  @@index([order_id, created_at])
  @@index([payment_id])
}

/// Redemption limits are enforced by counting `CouponRedemption` rows — there is
/// deliberately no denormalised counter to drift under Serializable retries.
model Coupon {
  id                 String             @id @default(uuid())
  node_id            String             @default("11111111-1111-4111-8111-111111111111")
  node               Node               @relation(fields: [node_id], references: [id], onDelete: Restrict)
  code               String             @unique
  description        String             @default("")
  type               CouponType
  value              Decimal            @db.Decimal(12, 2)
  min_order          Decimal?           @db.Decimal(12, 2)
  max_discount       Decimal?           @db.Decimal(12, 2)
  applies_to         ProductType[]      @default([])
  starts_at          DateTime           @db.Timestamptz(3)
  ends_at            DateTime           @db.Timestamptz(3)
  usage_limit        Int?
  per_customer_limit Int?
  status             CouponStatus       @default(draft)
  created_by         String?
  created_at         DateTime           @default(now()) @db.Timestamptz(3)
  updated_at         DateTime           @updatedAt @db.Timestamptz(3)
  redemptions        CouponRedemption[]
  orders             Order[]

  @@index([node_id, status, starts_at, ends_at])
}

model CouponRedemption {
  id          String   @id @default(uuid())
  coupon_id   String
  coupon      Coupon   @relation(fields: [coupon_id], references: [id], onDelete: Restrict)
  order_id    String
  order       Order    @relation(fields: [order_id], references: [id], onDelete: Cascade)
  customer_id String
  customer    Customer @relation(fields: [customer_id], references: [id], onDelete: Restrict)
  amount      Decimal  @db.Decimal(12, 2)
  created_at  DateTime @default(now()) @db.Timestamptz(3)

  @@unique([coupon_id, order_id])
  @@index([coupon_id, customer_id])
  @@index([customer_id])
}

/// Loyalty is per customer and global, not per node (SPEC §12).
model LoyaltyAccount {
  customer_id     String      @id
  customer        Customer    @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  points_balance  Int         @default(0)
  lifetime_points Int         @default(0)
  tier            LoyaltyTier @default(member)
  created_at      DateTime    @default(now()) @db.Timestamptz(3)
  updated_at      DateTime    @updatedAt @db.Timestamptz(3)
}

/// `@@unique([order_id, reason])` makes earn and redeem idempotent per order —
/// Postgres treats NULL `order_id` (manual adjustments, expiry) as distinct.
model LoyaltyTransaction {
  id            String        @id @default(uuid())
  customer_id   String
  customer      Customer      @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  order_id      String?
  order         Order?        @relation(fields: [order_id], references: [id], onDelete: SetNull)
  delta         Int
  balance_after Int
  reason        LoyaltyReason
  notes         String?
  expires_at    DateTime?     @db.Timestamptz(3)
  expired       Boolean       @default(false)
  created_by    String?
  created_at    DateTime      @default(now()) @db.Timestamptz(3)

  @@unique([order_id, reason])
  @@index([customer_id, created_at(sort: Desc)])
  @@index([expired, expires_at])
}

model Review {
  id            String       @id @default(uuid())
  node_id       String       @default("11111111-1111-4111-8111-111111111111")
  node          Node         @relation(fields: [node_id], references: [id], onDelete: Restrict)
  product_id    String
  product       Product      @relation(fields: [product_id], references: [id], onDelete: Cascade)
  customer_id   String
  customer      Customer     @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  order_item_id String       @unique
  order_item    OrderItem    @relation(fields: [order_item_id], references: [id], onDelete: Cascade)
  rating        Int
  title         String?
  body          String?
  media         String[]     @default([])
  status        ReviewStatus @default(pending)
  moderated_by  String?
  moderated_at  DateTime?    @db.Timestamptz(3)
  created_at    DateTime     @default(now()) @db.Timestamptz(3)
  updated_at    DateTime     @updatedAt @db.Timestamptz(3)

  @@index([product_id, status, created_at(sort: Desc)])
  @@index([node_id, status])
  @@index([customer_id])
}

/// SPEC §8 observability. Written here because P5a owns `schema.prisma`;
/// **Phase 32 (P4) is the consumer** — see the plan's cross-phase note.
model UsageEvent {
  id         String    @id @default(uuid())
  node_id    String    @default("11111111-1111-4111-8111-111111111111")
  node       Node      @relation(fields: [node_id], references: [id], onDelete: Restrict)
  actor_type ActorType @default(system)
  actor_id   String?
  role_code  String?
  event_type String
  path       String?
  metadata   Json?
  created_at DateTime  @default(now()) @db.Timestamptz(3)

  @@index([node_id, created_at(sort: Desc)])
  @@index([event_type, created_at(sort: Desc)])
  @@index([role_code, created_at(sort: Desc)])
}
```

- [ ] Add the back-relations and the four new columns. Exact edits, in file order:

  **`model Node`** — append to the relation block:
```prisma
  shipments           Shipment[]
  refunds             Refund[]
  coupons             Coupon[]
  reviews             Review[]
  usage_events        UsageEvent[]
```

  **`model User`** — append:
```prisma
  packed_shipments  Shipment[] @relation("ShipmentPacker")
  requested_refunds Refund[]   @relation("RefundRequester")
```

  **`model Product`** — append `reviews Review[]` after `orderItems OrderItem[]`.

  **`model Customer`** — append the three SPEC §3.3 columns and the four back-relations:
```prisma
  marketing_opt_in Boolean   @default(false)
  last_seen_at     DateTime? @db.Timestamptz(3)

  loyalty_account      LoyaltyAccount?
  loyalty_transactions LoyaltyTransaction[]
  coupon_redemptions   CouponRedemption[]
  reviews              Review[]
```

  **`model Order`** — add the coupon FK and the four back-relations:
```prisma
  coupon_id            String?
  coupon               Coupon?              @relation(fields: [coupon_id], references: [id], onDelete: SetNull)
  shipment             Shipment?
  refunds              Refund[]
  coupon_redemptions   CouponRedemption[]
  loyalty_transactions LoyaltyTransaction[]
```
  …and add `@@index([coupon_id])` to its index block.

  **`model OrderItem`** — add the booking link and the review back-relation:
```prisma
  event_booking_id String?       @unique
  event_booking    EventBooking? @relation(fields: [event_booking_id], references: [id], onDelete: SetNull)
  review           Review?
```

  **`model Payment`** — append `refunds Refund[]`.

  **`model EventBooking`** — append `order_item OrderItem?`.

- [ ] `cd backend && npx prisma validate` — expect `The schema at prisma\schema.prisma is valid 🚀`.
- [ ] `cd backend && npx prisma generate` — expect `Generated Prisma Client (v6.19.x)`.
- [ ] Extend `PRISMA_MODELS` in `backend/src/test-utils/mock-providers.ts` — insert after `'channelModifier',`:

```ts
  'shipment',
  'shipmentEvent',
  'refund',
  'coupon',
  'couponRedemption',
  'loyaltyAccount',
  'loyaltyTransaction',
  'review',
  'usageEvent',
  'zone',
  'brand',
```

- [ ] Extend `mockRedisClient()` in the same file with the commands P5a uses (`setex` for the Shiprocket token, `ttl` for quote expiry, `mget` for the catalog cache, `keys` for the cache sweep):

```ts
export function mockRedisClient() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    getdel: jest.fn(),
    ttl: jest.fn(),
    mget: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
  };
}
```

- [ ] Add three provider factories at the end of `mock-providers.ts` (every later task uses these; **no later task may edit this file** — see the execution partition):

```ts
import { SettingsService, SETTING_DEFAULTS } from '../settings/settings.service';
import { WhatsAppService } from '../customer-auth/whatsapp.service';

/** A SettingsService stand-in that returns the declared defaults unless overridden. */
export function mockSettings(overrides: Partial<typeof SETTING_DEFAULTS> = {}) {
  return {
    get: jest.fn(async (key: string) => ({ ...SETTING_DEFAULTS, ...overrides })[key]),
    getSetting: jest.fn(),
    updateSetting: jest.fn(),
  };
}

/** A ShippingProvider stand-in — every method resolves, none touches the network. */
export function mockShippingProvider() {
  return {
    name: 'manual' as const,
    checkServiceability: jest.fn().mockResolvedValue({ serviceable: true, rate: 0, courier_name: null, etd: null }),
    createShipment: jest.fn().mockResolvedValue({ provider_order_id: null, provider_shipment_id: null }),
    assignAwb: jest.fn().mockResolvedValue({ awb: null, courier_name: null }),
    schedulePickup: jest.fn().mockResolvedValue({ scheduled: true, pickup_token: null }),
    getLabel: jest.fn().mockResolvedValue({ label_url: null }),
    track: jest.fn().mockResolvedValue({ status: 'pending', events: [] }),
    cancel: jest.fn().mockResolvedValue({ cancelled: true }),
  };
}

export function mockWhatsApp() {
  return { sendOtp: jest.fn().mockResolvedValue(undefined), sendTemplate: jest.fn().mockResolvedValue(undefined) };
}

export const provideSettings = (value = mockSettings()) => ({
  provide: SettingsService,
  useValue: value,
});
export const provideWhatsApp = (value = mockWhatsApp()) => ({
  provide: WhatsAppService,
  useValue: value,
});
```

- [ ] Write `backend/src/prisma/commerce-schema.spec.ts` — a shape guard so a later schema edit that drops a model or enum member fails loudly:

```ts
import { PrismaClient, RefundStatus, CouponStatus, ShipmentStatus, LoyaltyReason } from '@prisma/client';

describe('P5a commerce schema', () => {
  const client = new PrismaClient() as unknown as Record<string, unknown>;

  it.each([
    'shipment', 'shipmentEvent', 'refund', 'coupon', 'couponRedemption',
    'loyaltyAccount', 'loyaltyTransaction', 'review', 'usageEvent',
  ])('exposes the %s delegate', (delegate) => {
    expect(client[delegate]).toBeDefined();
  });

  it('declares the new enums', () => {
    expect(Object.values(RefundStatus)).toEqual(['pending', 'processed', 'failed']);
    expect(Object.values(CouponStatus)).toEqual(['draft', 'active', 'disabled']);
  });

  it('keeps the P2-declared commerce enums intact', () => {
    expect(Object.values(ShipmentStatus)).toContain('out_for_delivery');
    expect(Object.values(LoyaltyReason)).toEqual(['earn', 'redeem', 'adjust', 'expire']);
  });

  afterAll(async () => {
    await (client as unknown as PrismaClient).$disconnect();
  });
});
```

- [ ] `cd backend && npx jest src/prisma/commerce-schema --silent` — expect `Tests: 13 passed`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — exit 0.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 61 passed, 61 total`.
- [ ] `git commit -m "feat(p5a-01): nine P5a commerce models, coupon/booking FKs, jest registry" -- backend/prisma/schema.prisma backend/src/test-utils/mock-providers.ts backend/src/prisma/commerce-schema.spec.ts`

---

### Task 2: Integer-paise money helpers + the P5a setting keys

**Files:**
- Create: `backend/src/common/money/money.ts`, `backend/src/common/money/money.spec.ts`
- Create: `backend/src/common/events/commerce-events.ts`
- Modify: `backend/src/settings/settings.service.ts`, `backend/prisma/seed-data/settings.ts`

- [ ] Write the failing test `backend/src/common/money/money.spec.ts`:

```ts
import { Prisma } from '@prisma/client';
import {
  toPaise, toDecimal, inclusiveTaxPaise, percentOfPaise, sumPaise, clampPaise,
} from './money';

describe('money', () => {
  it('converts rupees to paise with half-up rounding', () => {
    expect(toPaise('123.45')).toBe(12345);
    expect(toPaise(new Prisma.Decimal('0.005'))).toBe(1);
    expect(toPaise(0)).toBe(0);
  });

  it('round-trips paise back to a 2dp Decimal', () => {
    expect(toDecimal(12345).toFixed(2)).toBe('123.45');
    expect(toDecimal(0).toFixed(2)).toBe('0.00');
  });

  it('carves inclusive GST out of a gross amount', () => {
    // ₹105.00 gross at 5% inclusive -> ₹5.00 tax, ₹100.00 taxable
    expect(inclusiveTaxPaise(10500, 5)).toBe(500);
    // ₹112.00 gross at 12% inclusive -> ₹12.00 tax
    expect(inclusiveTaxPaise(11200, 12)).toBe(1200);
    expect(inclusiveTaxPaise(9999, 0)).toBe(0);
  });

  it('never returns a fractional paise', () => {
    expect(Number.isInteger(inclusiveTaxPaise(33333, 5))).toBe(true);
    expect(Number.isInteger(percentOfPaise(33333, '17.5'))).toBe(true);
  });

  it('percentOfPaise rounds half-up', () => {
    expect(percentOfPaise(10000, 10)).toBe(1000);
    expect(percentOfPaise(1, 50)).toBe(1); // 0.5 -> 1
  });

  it('sumPaise and clampPaise are total', () => {
    expect(sumPaise([100, 250, 3])).toBe(353);
    expect(sumPaise([])).toBe(0);
    expect(clampPaise(-5, 0, 100)).toBe(0);
    expect(clampPaise(500, 0, 100)).toBe(100);
  });
});
```

- [ ] `cd backend && npx jest src/common/money --silent` — expect `Cannot find module './money'`.
- [ ] Create `backend/src/common/money/money.ts`:

```ts
import { Prisma } from '@prisma/client';

/** An integer number of paise. Safe to 2^53 paise ≈ ₹90 trillion. */
export type Paise = number;

type Money = Prisma.Decimal | number | string;

const HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

/**
 * Rupees -> integer paise. Every arithmetic step in the checkout path runs on the
 * result of this function; floats never touch a rupee value (SPEC §10 DoD).
 */
export function toPaise(rupees: Money): Paise {
  return new Prisma.Decimal(rupees).mul(100).toDecimalPlaces(0, HALF_UP).toNumber();
}

/** Integer paise -> the 2dp Decimal Prisma stores in a `Decimal(12,2)` column. */
export function toDecimal(paise: Paise): Prisma.Decimal {
  return new Prisma.Decimal(paise).div(100).toDecimalPlaces(2, HALF_UP);
}

/**
 * GST is **inclusive** (SPEC §3.3): the price already contains the tax, so the tax
 * is carved out rather than added — `tax = gross × rate / (100 + rate)`.
 */
export function inclusiveTaxPaise(grossPaise: Paise, ratePercent: Money): Paise {
  const rate = new Prisma.Decimal(ratePercent);
  if (rate.lessThanOrEqualTo(0)) return 0;
  return new Prisma.Decimal(grossPaise)
    .mul(rate)
    .div(rate.plus(100))
    .toDecimalPlaces(0, HALF_UP)
    .toNumber();
}

/** `basePaise × percent / 100`, rounded half-up to whole paise. */
export function percentOfPaise(basePaise: Paise, percent: Money): Paise {
  return new Prisma.Decimal(basePaise)
    .mul(new Prisma.Decimal(percent))
    .div(100)
    .toDecimalPlaces(0, HALF_UP)
    .toNumber();
}

export function sumPaise(values: Paise[]): Paise {
  return values.reduce((total, value) => total + value, 0);
}

export function clampPaise(value: Paise, min: Paise, max: Paise): Paise {
  return Math.min(Math.max(value, min), max);
}
```

- [ ] `cd backend && npx jest src/common/money --silent` — expect `Tests: 6 passed`.
- [ ] Create `backend/src/common/events/commerce-events.ts` — the P5a subset of SPEC §4.1. **Phase 31 owns `domain-events.ts`; this file exists so the two phases never edit the same file.**

```ts
import { ActorType } from '@prisma/client';

/** SPEC §4.1 envelope — every emitter passes these three fields. */
export interface DomainEventEnvelope {
  node_id: string;
  actor: { actor_type: ActorType; actor_id: string | null };
  occurred_at: Date;
}

/**
 * Commerce event names, verbatim from SPEC §4.1. Phase 31's
 * `common/events/domain-events.ts` re-exports these once both phases are merged —
 * a one-line follow-up, tracked in the Self-review.
 */
export const CommerceEvent = {
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_DELIVERED: 'order.delivered',
  SHIPMENT_STATUS_CHANGED: 'shipment.status_changed',
  SHIPMENT_DELIVERED: 'shipment.delivered',
  BOOKING_ATTENDED: 'booking.attended',
  COUPON_REDEEMED: 'coupon.redeemed',
  REVIEW_PUBLISHED: 'review.published',
  PRODUCT_PUBLISHED: 'product.published',
  STOCK_LOW: 'stock.low',
} as const;

export type CommerceEventName = (typeof CommerceEvent)[keyof typeof CommerceEvent];

export interface OrderConfirmedPayload extends DomainEventEnvelope { order_id: string; total: number; channel: string }
export interface OrderDeliveredPayload extends DomainEventEnvelope { order_id: string; customer_id: string | null }
export interface ShipmentStatusChangedPayload extends DomainEventEnvelope { shipment_id: string; order_id: string; status: string; awb: string | null }
export interface BookingAttendedPayload extends DomainEventEnvelope { booking_id: string; event_id: string; customer_id: string | null }
export interface CouponRedeemedPayload extends DomainEventEnvelope { coupon_id: string; code: string; order_id: string; amount: number }
export interface ReviewPublishedPayload extends DomainEventEnvelope { review_id: string; product_id: string; rating: number }
export interface StockLowPayload extends DomainEventEnvelope { product_id: string; variant_id: string; stock_on_hand: number; threshold: number }
```

- [ ] Extend `SETTING_DEFAULTS` in `backend/src/settings/settings.service.ts` — add `expiry_days` to `loyalty` and two new keys after it:

```ts
  loyalty: {
    earn_rate_per_100: 5,
    redeem_value_per_point: 0.25,
    expiry_days: 365,
    max_redeem_percent: 20,
    tiers: { member: 0, regular: 500, insider: 2000 },
  },
  reviews: {
    auto_publish_min_rating: 4,
    invitation_delay_hours: 24,
  },
  promotions: {
    allow_stacking: false,
  },
```

- [ ] Mirror the identical values into `SEED_SETTING_DEFAULTS` in `backend/prisma/seed-data/settings.ts`. `backend/src/prisma/seed-data.spec.ts` already asserts the two are deeply equal, so a mismatch fails a test rather than a deploy.
- [ ] `cd backend && npx jest src/prisma/seed-data src/settings --silent` — expect all green (the existing settings spec asserts the allow-list length; update the expected count from `8` to `11` if it is asserted numerically).
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — exit 0.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 62 passed, 62 total`.
- [ ] `git commit -m "feat(p5a-02): integer-paise money helpers, commerce event names, loyalty/reviews/promotions settings" -- backend/src/common/money backend/src/common/events backend/src/settings/settings.service.ts backend/prisma/seed-data/settings.ts`

---

### Task 3: `ShippingProvider` interface, `ManualProvider`, `ShiprocketAdapter`, env contract

Typed against plain interfaces (decision 11), so this task needs neither the new models nor a database. `SHIPROCKET_*` is validated only when `SHIPPING_PROVIDER=shiprocket` **and** `NODE_ENV=production`.

**Files:**
- Create: `backend/src/shipping/shipping.types.ts`, `shipping.constants.ts`, `manual.provider.ts`, `manual.provider.spec.ts`, `shiprocket.adapter.ts`, `shiprocket.adapter.spec.ts`, `shipping-provider.resolver.ts`, `shipping-provider.resolver.spec.ts`, `shipping.module.ts`
- Modify: `backend/src/config/env.validation.ts`, `backend/.env.example`

- [ ] Create `backend/src/shipping/shipping.types.ts`:

```ts
import { ShipmentStatus, ShippingProvider as ShippingProviderName } from '@prisma/client';

export interface ServiceabilityRequest {
  pickup_pincode: string;
  delivery_pincode: string;
  weight_grams: number;
  declared_value_paise: number;
  cod: false;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  /** Forward shipping charge in **paise**. `0` for the manual provider. */
  rate: number;
  courier_name: string | null;
  courier_id: string | null;
  etd: Date | null;
  reason?: string;
}

export interface ShipmentDraftLine {
  name: string;
  sku: string;
  quantity: number;
  /** Unit price in paise (tax-inclusive, matching `OrderItem.unit_price`). */
  unit_price: number;
  hsn_code: string | null;
}

export interface ShipmentDraft {
  order_number: number;
  order_placed_at: Date;
  pickup_location_code: string;
  billing: {
    name: string; phone: string; email: string | null;
    address: string; landmark: string | null; city: string; state: string; pincode: string;
  };
  lines: ShipmentDraftLine[];
  sub_total_paise: number;
  weight_grams: number;
  dimensions_cm: { length: number; breadth: number; height: number };
}

export interface ShipmentRef {
  provider_order_id: string | null;
  provider_shipment_id: string | null;
  awb: string | null;
}

export interface CreateShipmentResult { provider_order_id: string | null; provider_shipment_id: string | null }
export interface AssignAwbResult { awb: string | null; courier_name: string | null; courier_id: string | null }
export interface SchedulePickupResult { scheduled: boolean; pickup_token: string | null; pickup_scheduled_date: Date | null }
export interface LabelResult { label_url: string | null }
export interface TrackResult {
  status: ShipmentStatus;
  courier_name: string | null;
  tracking_url: string | null;
  events: Array<{ status: ShipmentStatus; occurred_at: Date; raw: unknown }>;
}
export interface CancelResult { cancelled: boolean; reason?: string }

/** SPEC §5.3. Every method is total: it resolves or throws a Nest HTTP exception. */
export interface ShippingProviderPort {
  readonly name: ShippingProviderName;
  checkServiceability(req: ServiceabilityRequest): Promise<ServiceabilityResult>;
  createShipment(draft: ShipmentDraft): Promise<CreateShipmentResult>;
  assignAwb(ref: ShipmentRef): Promise<AssignAwbResult>;
  schedulePickup(ref: ShipmentRef): Promise<SchedulePickupResult>;
  getLabel(ref: ShipmentRef): Promise<LabelResult>;
  track(awb: string): Promise<TrackResult>;
  cancel(ref: ShipmentRef): Promise<CancelResult>;
}
```

- [ ] Create `backend/src/shipping/shipping.constants.ts`:

```ts
import { ShipmentStatus } from '@prisma/client';

export const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';
export const SHIPROCKET_TOKEN_KEY = 'shiprocket:token';
/** Shiprocket tokens live 10 days; cache for 9 so a refresh always precedes expiry. */
export const SHIPROCKET_TOKEN_TTL_SECONDS = 9 * 24 * 60 * 60;
export const SHIPROCKET_TIMEOUT_MS = 15_000;

/** Shiprocket `current_status` / webhook `shipment_status` -> our enum. */
export const SHIPROCKET_STATUS_MAP: Record<string, ShipmentStatus> = {
  'AWB ASSIGNED': ShipmentStatus.awb_assigned,
  'LABEL GENERATED': ShipmentStatus.awb_assigned,
  'PICKUP SCHEDULED': ShipmentStatus.pickup_scheduled,
  'PICKUP GENERATED': ShipmentStatus.pickup_scheduled,
  'PICKED UP': ShipmentStatus.picked_up,
  'IN TRANSIT': ShipmentStatus.in_transit,
  SHIPPED: ShipmentStatus.in_transit,
  'OUT FOR DELIVERY': ShipmentStatus.out_for_delivery,
  DELIVERED: ShipmentStatus.delivered,
  RTO: ShipmentStatus.rto,
  'RTO INITIATED': ShipmentStatus.rto,
  'RTO DELIVERED': ShipmentStatus.rto,
  CANCELED: ShipmentStatus.cancelled,
  CANCELLED: ShipmentStatus.cancelled,
  'PICKUP ERROR': ShipmentStatus.failed,
  UNDELIVERED: ShipmentStatus.failed,
  LOST: ShipmentStatus.failed,
};

/** Unknown provider strings map to `failed` so a shipment never silently stalls. */
export function mapShiprocketStatus(raw: string | null | undefined): ShipmentStatus {
  if (!raw) return ShipmentStatus.pending;
  return SHIPROCKET_STATUS_MAP[raw.trim().toUpperCase()] ?? ShipmentStatus.failed;
}
```

- [ ] Write `backend/src/shipping/manual.provider.spec.ts`, then the provider:

```ts
import { ShipmentStatus } from '@prisma/client';
import { ManualProvider } from './manual.provider';

describe('ManualProvider', () => {
  const provider = new ManualProvider();
  const ref = { provider_order_id: null, provider_shipment_id: null, awb: 'MANUAL-1' };

  it('is always serviceable at zero rate', async () => {
    const result = await provider.checkServiceability({
      pickup_pincode: '560001', delivery_pincode: '110001',
      weight_grams: 500, declared_value_paise: 100000, cod: false,
    });
    expect(result).toEqual({ serviceable: true, rate: 0, courier_name: null, courier_id: null, etd: null });
  });

  it('returns empty refs so staff can paste an AWB later', async () => {
    await expect(provider.assignAwb(ref)).resolves.toEqual({ awb: null, courier_name: null, courier_id: null });
    await expect(provider.getLabel(ref)).resolves.toEqual({ label_url: null });
  });

  it('tracks to pending with no events', async () => {
    await expect(provider.track('MANUAL-1')).resolves.toEqual({
      status: ShipmentStatus.pending, courier_name: null, tracking_url: null, events: [],
    });
  });

  it('cancels unconditionally', async () => {
    await expect(provider.cancel(ref)).resolves.toEqual({ cancelled: true });
  });
});
```

```ts
// manual.provider.ts
import { Injectable } from '@nestjs/common';
import { ShipmentStatus, ShippingProvider as ShippingProviderName } from '@prisma/client';
import type { /* the seven result types + ShippingProviderPort */ } from './shipping.types';

/**
 * SPEC §5.3 fallback: staff paste an AWB and tracking URL into the shipment.
 * Every method is a no-op that succeeds, so the shipments queue behaves identically
 * whichever provider is configured.
 */
@Injectable()
export class ManualProvider implements ShippingProviderPort {
  readonly name = ShippingProviderName.manual;

  async checkServiceability(): Promise<ServiceabilityResult> {
    return { serviceable: true, rate: 0, courier_name: null, courier_id: null, etd: null };
  }
  async createShipment(): Promise<CreateShipmentResult> {
    return { provider_order_id: null, provider_shipment_id: null };
  }
  async assignAwb(): Promise<AssignAwbResult> {
    return { awb: null, courier_name: null, courier_id: null };
  }
  async schedulePickup(): Promise<SchedulePickupResult> {
    return { scheduled: true, pickup_token: null, pickup_scheduled_date: null };
  }
  async getLabel(): Promise<LabelResult> { return { label_url: null }; }
  async track(): Promise<TrackResult> {
    return { status: ShipmentStatus.pending, courier_name: null, tracking_url: null, events: [] };
  }
  async cancel(): Promise<CancelResult> { return { cancelled: true }; }
}
```

- [ ] Write `backend/src/shipping/shiprocket.adapter.spec.ts` **before** the adapter. It stubs `global.fetch` and `RedisService`, so it never touches the network:

```ts
import { ShipmentStatus } from '@prisma/client';
import { ShiprocketAdapter } from './shiprocket.adapter';
import { mockRedis, mockRedisClient } from '../test-utils/mock-providers';
import { SHIPROCKET_TOKEN_KEY, SHIPROCKET_TOKEN_TTL_SECONDS } from './shipping.constants';

const config = { get: (k: string) => ({ SHIPROCKET_EMAIL: 'ops@konma.io', SHIPROCKET_PASSWORD: 'pw' })[k] };

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}

describe('ShiprocketAdapter', () => {
  let redisClient: ReturnType<typeof mockRedisClient>;
  let adapter: ShiprocketAdapter;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    redisClient = mockRedisClient();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    adapter = new ShiprocketAdapter(config as never, mockRedis(redisClient) as never);
  });

  it('logs in once and caches the token for ~9 days', async () => {
    redisClient.get.mockResolvedValue(null);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-1' }))
      .mockResolvedValueOnce(jsonResponse({ data: { available_courier_companies: [
        { courier_name: 'Delhivery', courier_company_id: 12, rate: 79, etd: '2026-08-27 18:00' },
      ] } }));

    const result = await adapter.checkServiceability({
      pickup_pincode: '560001', delivery_pincode: '110001',
      weight_grams: 500, declared_value_paise: 100000, cod: false,
    });

    expect(redisClient.setex).toHaveBeenCalledWith(SHIPROCKET_TOKEN_KEY, SHIPROCKET_TOKEN_TTL_SECONDS, 'tok-1');
    expect(result.serviceable).toBe(true);
    expect(result.rate).toBe(7900); // paise
    expect(result.courier_name).toBe('Delhivery');
  });

  it('reuses the cached token without calling auth/login', async () => {
    redisClient.get.mockResolvedValue('tok-cached');
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { available_courier_companies: [] } }));

    const result = await adapter.checkServiceability({
      pickup_pincode: '560001', delivery_pincode: '999999',
      weight_grams: 500, declared_value_paise: 1, cod: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.serviceable).toBe(false);
  });

  it('re-authenticates once on a 401 and retries the call', async () => {
    redisClient.get.mockResolvedValue('stale');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, false, 401))
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-2' }))
      .mockResolvedValueOnce(jsonResponse({ data: { available_courier_companies: [] } }));

    await adapter.checkServiceability({
      pickup_pincode: '560001', delivery_pincode: '110001',
      weight_grams: 500, declared_value_paise: 1, cod: false,
    });

    expect(redisClient.del).toHaveBeenCalledWith(SHIPROCKET_TOKEN_KEY);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('maps provider tracking statuses onto ShipmentStatus', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ tracking_data: {
      track_url: 'https://track/1',
      shipment_track: [{ courier_name: 'Delhivery', current_status: 'OUT FOR DELIVERY' }],
      shipment_track_activities: [{ status: 'IN TRANSIT', date: '2026-08-25 09:00:00', activity: 'Departed' }],
    } }));

    const result = await adapter.track('AWB123');
    expect(result.status).toBe(ShipmentStatus.out_for_delivery);
    expect(result.events[0].status).toBe(ShipmentStatus.in_transit);
    expect(result.tracking_url).toBe('https://track/1');
  });

  it('throws ServiceUnavailable when Shiprocket is down', async () => {
    redisClient.get.mockResolvedValue('tok');
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'boom' }, false, 500));
    await expect(adapter.track('AWB123')).rejects.toThrow(/Shiprocket/);
  });
});
```

- [ ] Create `backend/src/shipping/shiprocket.adapter.ts`. Endpoint map (SPEC §5.3): `POST auth/login` · `GET courier/serviceability/` · `POST orders/create/adhoc` · `POST courier/assign/awb` · `POST courier/generate/pickup` · `POST courier/generate/label` · `GET courier/track/awb/{awb}` · `POST orders/cancel`.

```ts
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShippingProvider as ShippingProviderName } from '@prisma/client';
import { RedisService } from '../customer-auth/redis.service';
import {
  SHIPROCKET_BASE_URL, SHIPROCKET_TIMEOUT_MS, SHIPROCKET_TOKEN_KEY,
  SHIPROCKET_TOKEN_TTL_SECONDS, mapShiprocketStatus,
} from './shipping.constants';

@Injectable()
export class ShiprocketAdapter implements ShippingProviderPort {
  readonly name = ShippingProviderName.shiprocket;
  private readonly logger = new Logger(ShiprocketAdapter.name);
  /** In-process fallback when Redis is unavailable — the token still gets reused per boot. */
  private memoryToken: string | null = null;

  constructor(private readonly config: ConfigService, private readonly redis: RedisService) {}

  // ---- auth -------------------------------------------------------------
  private async login(): Promise<string> {
    const email = this.config.get<string>('SHIPROCKET_EMAIL');
    const password = this.config.get<string>('SHIPROCKET_PASSWORD');
    if (!email || !password) {
      throw new ServiceUnavailableException('Shiprocket credentials are not configured');
    }
    const res = await this.rawFetch('auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json()) as { token?: string };
    if (!res.ok || !body.token) {
      throw new ServiceUnavailableException(`Shiprocket login failed (${res.status})`);
    }
    this.memoryToken = body.token;
    await this.redis.getClient()?.setex(SHIPROCKET_TOKEN_KEY, SHIPROCKET_TOKEN_TTL_SECONDS, body.token);
    return body.token;
  }

  private async token(): Promise<string> {
    const cached = await this.redis.getClient()?.get(SHIPROCKET_TOKEN_KEY);
    if (cached) return cached;
    if (this.memoryToken) return this.memoryToken;
    return this.login();
  }

  private async invalidateToken(): Promise<void> {
    this.memoryToken = null;
    await this.redis.getClient()?.del(SHIPROCKET_TOKEN_KEY);
  }

  // ---- transport --------------------------------------------------------
  private rawFetch(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${SHIPROCKET_BASE_URL}/${path}`, {
      ...init,
      signal: AbortSignal.timeout(SHIPROCKET_TIMEOUT_MS),
    });
  }

  /** Authenticated call with exactly one re-auth retry on 401. */
  private async call<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
    const token = await this.token();
    const res = await this.rawFetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    if (res.status === 401 && !retried) {
      await this.invalidateToken();
      await this.login();
      return this.call<T>(path, init, true);
    }
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Shiprocket ${path} failed ${res.status}: ${text.slice(0, 400)}`);
      throw new ServiceUnavailableException(`Shiprocket ${path} failed (${res.status})`);
    }
    return (await res.json()) as T;
  }

  // ---- ShippingProviderPort --------------------------------------------
  async checkServiceability(req: ServiceabilityRequest): Promise<ServiceabilityResult> {
    const query = new URLSearchParams({
      pickup_postcode: req.pickup_pincode,
      delivery_postcode: req.delivery_pincode,
      weight: (req.weight_grams / 1000).toFixed(3),
      cod: '0',
      declared_value: (req.declared_value_paise / 100).toFixed(2),
    });
    const body = await this.call<{ data?: { available_courier_companies?: Array<{
      courier_name: string; courier_company_id: number; rate: number; etd?: string;
    }> } }>(`courier/serviceability/?${query.toString()}`, { method: 'GET' });

    const options = body.data?.available_courier_companies ?? [];
    if (options.length === 0) {
      return { serviceable: false, rate: 0, courier_name: null, courier_id: null, etd: null,
               reason: 'No courier serves this pincode' };
    }
    const cheapest = options.reduce((best, c) => (c.rate < best.rate ? c : best), options[0]);
    return {
      serviceable: true,
      rate: Math.round(cheapest.rate * 100), // rupees -> paise
      courier_name: cheapest.courier_name,
      courier_id: String(cheapest.courier_company_id),
      etd: cheapest.etd ? new Date(cheapest.etd.replace(' ', 'T')) : null,
    };
  }

  async createShipment(draft: ShipmentDraft): Promise<CreateShipmentResult> {
    const body = await this.call<{ order_id?: number; shipment_id?: number }>('orders/create/adhoc', {
      method: 'POST',
      body: JSON.stringify({
        order_id: String(draft.order_number),
        order_date: draft.order_placed_at.toISOString().slice(0, 16).replace('T', ' '),
        pickup_location: draft.pickup_location_code,
        billing_customer_name: draft.billing.name,
        billing_last_name: '',
        billing_address: draft.billing.address,
        billing_address_2: draft.billing.landmark ?? '',
        billing_city: draft.billing.city,
        billing_pincode: draft.billing.pincode,
        billing_state: draft.billing.state,
        billing_country: 'India',
        billing_email: draft.billing.email ?? '',
        billing_phone: draft.billing.phone,
        shipping_is_billing: true,
        order_items: draft.lines.map((l) => ({
          name: l.name, sku: l.sku, units: l.quantity,
          selling_price: (l.unit_price / 100).toFixed(2), hsn: l.hsn_code ?? '',
        })),
        payment_method: 'Prepaid',
        sub_total: (draft.sub_total_paise / 100).toFixed(2),
        length: draft.dimensions_cm.length,
        breadth: draft.dimensions_cm.breadth,
        height: draft.dimensions_cm.height,
        weight: (draft.weight_grams / 1000).toFixed(3),
      }),
    });
    return {
      provider_order_id: body.order_id ? String(body.order_id) : null,
      provider_shipment_id: body.shipment_id ? String(body.shipment_id) : null,
    };
  }

  async assignAwb(ref: ShipmentRef): Promise<AssignAwbResult> {
    const body = await this.call<{ response?: { data?: { awb_code?: string; courier_name?: string; courier_company_id?: number } } }>(
      'courier/assign/awb',
      { method: 'POST', body: JSON.stringify({ shipment_id: ref.provider_shipment_id }) },
    );
    const data = body.response?.data;
    return {
      awb: data?.awb_code ?? null,
      courier_name: data?.courier_name ?? null,
      courier_id: data?.courier_company_id ? String(data.courier_company_id) : null,
    };
  }

  async schedulePickup(ref: ShipmentRef): Promise<SchedulePickupResult> {
    const body = await this.call<{ pickup_token_number?: string; pickup_scheduled_date?: string }>(
      'courier/generate/pickup',
      { method: 'POST', body: JSON.stringify({ shipment_id: [ref.provider_shipment_id] }) },
    );
    return {
      scheduled: true,
      pickup_token: body.pickup_token_number ?? null,
      pickup_scheduled_date: body.pickup_scheduled_date ? new Date(body.pickup_scheduled_date) : null,
    };
  }

  async getLabel(ref: ShipmentRef): Promise<LabelResult> {
    const body = await this.call<{ label_url?: string }>('courier/generate/label', {
      method: 'POST', body: JSON.stringify({ shipment_id: [ref.provider_shipment_id] }),
    });
    return { label_url: body.label_url ?? null };
  }

  async track(awb: string): Promise<TrackResult> {
    const body = await this.call<{ tracking_data?: {
      track_url?: string;
      shipment_track?: Array<{ courier_name?: string; current_status?: string }>;
      shipment_track_activities?: Array<{ status?: string; date?: string; activity?: string }>;
    } }>(`courier/track/awb/${encodeURIComponent(awb)}`, { method: 'GET' });

    const data = body.tracking_data;
    const head = data?.shipment_track?.[0];
    return {
      status: mapShiprocketStatus(head?.current_status),
      courier_name: head?.courier_name ?? null,
      tracking_url: data?.track_url ?? null,
      events: (data?.shipment_track_activities ?? []).map((a) => ({
        status: mapShiprocketStatus(a.status),
        occurred_at: a.date ? new Date(a.date.replace(' ', 'T')) : new Date(),
        raw: a,
      })),
    };
  }

  async cancel(ref: ShipmentRef): Promise<CancelResult> {
    await this.call('orders/cancel', {
      method: 'POST', body: JSON.stringify({ ids: [Number(ref.provider_order_id)] }),
    });
    return { cancelled: true };
  }
}
```

- [ ] Write `backend/src/shipping/shipping-provider.resolver.spec.ts`, then the resolver:

```ts
import { ShippingProviderResolver } from './shipping-provider.resolver';
import { ManualProvider } from './manual.provider';
import { mockSettings } from '../test-utils/mock-providers';

describe('ShippingProviderResolver', () => {
  const manual = new ManualProvider();
  const shiprocket = { name: 'shiprocket' } as never;

  it('returns the manual provider by default (seeded shipping.provider = manual)', async () => {
    const resolver = new ShippingProviderResolver(mockSettings() as never, manual, shiprocket);
    await expect(resolver.get()).resolves.toBe(manual);
  });

  it('returns the Shiprocket adapter when the setting says so', async () => {
    const settings = mockSettings({ shipping: {
      provider: 'shiprocket', pickup_location_code: 'KONMA-VILLA',
      default_weight_grams: 500, default_dimensions_cm: { length: 20, breadth: 15, height: 10 },
    } });
    const resolver = new ShippingProviderResolver(settings as never, manual, shiprocket);
    await expect(resolver.get()).resolves.toBe(shiprocket);
  });

  it('exposes the shipping settings block for pack defaults', async () => {
    const resolver = new ShippingProviderResolver(mockSettings() as never, manual, shiprocket);
    await expect(resolver.settings()).resolves.toMatchObject({ provider: 'manual', default_weight_grams: 500 });
  });
});
```

```ts
// shipping-provider.resolver.ts
import { Injectable } from '@nestjs/common';
import { ShippingProvider as ShippingProviderName } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import { ManualProvider } from './manual.provider';
import { ShiprocketAdapter } from './shiprocket.adapter';
import type { ShippingProviderPort } from './shipping.types';

/**
 * Resolves the provider **per call** from `SystemSetting['shipping'].provider`
 * (decision 10), so switching providers needs no redeploy and tests default to
 * `manual` — no jest run can reach the network.
 */
@Injectable()
export class ShippingProviderResolver {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly manual: ManualProvider,
    private readonly shiprocket: ShiprocketAdapter,
  ) {}

  /** The `SystemSetting['shipping']` block — pickup code and package defaults for pack. */
  async settings() {
    return this.settingsService.get('shipping');
  }

  async get(): Promise<ShippingProviderPort> {
    const { provider } = await this.settingsService.get('shipping');
    return provider === ShippingProviderName.shiprocket ? this.shiprocket : this.manual;
  }
}
```

- [ ] Create `backend/src/shipping/shipping.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module'; // provides RedisService
import { ManualProvider } from './manual.provider';
import { ShiprocketAdapter } from './shiprocket.adapter';
import { ShippingProviderResolver } from './shipping-provider.resolver';

@Module({
  imports: [SettingsModule, CustomerAuthModule],
  providers: [ManualProvider, ShiprocketAdapter, ShippingProviderResolver],
  exports: [ShippingProviderResolver, ManualProvider],
})
export class ShippingModule {}
```

- [ ] Extend `backend/src/config/env.validation.ts`. Add the guard predicate next to `qstashEnabled` and the four conditional fields:

```ts
const shiprocketEnabled = (o: EnvironmentVariables) =>
  o.NODE_ENV === 'production' && o.SHIPPING_PROVIDER === 'shiprocket';
```

```ts
  // Required only when SHIPPING_PROVIDER=shiprocket in production (SPEC §5.3)
  @IsOptional() @IsString() SHIPPING_PROVIDER?: string;
  @ValidateIf(shiprocketEnabled) @IsString() @IsNotEmpty() SHIPROCKET_EMAIL?: string;
  @ValidateIf(shiprocketEnabled) @IsString() @IsNotEmpty() SHIPROCKET_PASSWORD?: string;
  @ValidateIf(shiprocketEnabled) @IsString() @IsNotEmpty() SHIPROCKET_PICKUP_LOCATION?: string;
  @ValidateIf(shiprocketEnabled) @IsString() @MinLength(16) SHIPROCKET_WEBHOOK_TOKEN?: string;
```

- [ ] Add cases to `backend/src/config/env.validation.spec.ts` (existing suite): production + `SHIPPING_PROVIDER=shiprocket` with no `SHIPROCKET_EMAIL` **throws**; production with `SHIPPING_PROVIDER` unset **passes**; development with `SHIPPING_PROVIDER=shiprocket` and nothing else **passes**.
- [ ] Append to `backend/.env.example`, under "Optional integrations":

```
# ---- Shipping (SPEC 5.3). SHIPPING_PROVIDER mirrors SystemSetting['shipping'].provider;
# the four SHIPROCKET_* vars are required only when it is "shiprocket" in production.
SHIPPING_PROVIDER=manual
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
SHIPROCKET_PICKUP_LOCATION=
# Shared secret compared (constant time) against the x-konma-webhook-token header on
# POST /webhooks/shiprocket. Minimum 16 characters.
SHIPROCKET_WEBHOOK_TOKEN=
```

- [ ] `cd backend && npx jest src/shipping src/config --silent` — expect `Test Suites: 4 passed` (3 new + env validation).
- [ ] `cd backend && npx eslint "src/shipping/**/*.ts" "src/config/**/*.ts"` — expect 0 errors.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 65 passed, 65 total`.
- [ ] `git commit -m "feat(p5a-03): ShippingProvider port, ManualProvider, ShiprocketAdapter, shiprocket env contract" -- backend/src/shipping backend/src/config backend/.env.example`

---

### Task 4: Catalog — 60 s public cache, faceted search, cursor pagination, low-stock signal

Extends the P2 `catalog` module; adds no models. `CAT-03`'s field-absence assertion becomes a real test.

**Files:**
- Create: `backend/src/catalog/catalog-cache.service.ts`, `catalog-cache.service.spec.ts`
- Modify: `backend/src/catalog/catalog.service.ts`, `catalog.controller.ts`, `catalog.module.ts`, `catalog.service.spec.ts`

- [ ] Write `backend/src/catalog/catalog-cache.service.spec.ts`, then the service. It is a thin Redis wrapper that degrades to "always miss" when Redis is null (the RedisService contract).

```ts
import { CatalogCacheService } from './catalog-cache.service';
import { mockRedis, mockRedisClient } from '../test-utils/mock-providers';

describe('CatalogCacheService', () => {
  it('returns the cached payload on a hit', async () => {
    const client = mockRedisClient();
    client.get.mockResolvedValue(JSON.stringify([{ id: 'p1' }]));
    const cache = new CatalogCacheService(mockRedis(client) as never);
    await expect(cache.wrap('products:all', () => Promise.resolve([{ id: 'other' }]))).resolves.toEqual([{ id: 'p1' }]);
  });

  it('computes, stores with a 60 s TTL, and returns on a miss', async () => {
    const client = mockRedisClient();
    client.get.mockResolvedValue(null);
    const cache = new CatalogCacheService(mockRedis(client) as never);
    await expect(cache.wrap('products:all', () => Promise.resolve([{ id: 'p1' }]))).resolves.toEqual([{ id: 'p1' }]);
    expect(client.setex).toHaveBeenCalledWith('catalog:products:all', 60, JSON.stringify([{ id: 'p1' }]));
  });

  it('computes without caching when Redis is unavailable', async () => {
    const cache = new CatalogCacheService({ getClient: () => null } as never);
    await expect(cache.wrap('k', () => Promise.resolve('v'))).resolves.toBe('v');
  });

  it('invalidate() deletes every catalog key', async () => {
    const client = mockRedisClient();
    client.keys.mockResolvedValue(['catalog:products:all', 'catalog:search:q=oil']);
    const cache = new CatalogCacheService(mockRedis(client) as never);
    await cache.invalidate();
    expect(client.del).toHaveBeenCalledWith('catalog:products:all', 'catalog:search:q=oil');
  });
});
```

```ts
// catalog-cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../customer-auth/redis.service';

/** SPEC §9: public catalog endpoints are cached 60 s. */
export const CATALOG_CACHE_TTL_SECONDS = 60;
const PREFIX = 'catalog:';

@Injectable()
export class CatalogCacheService {
  private readonly logger = new Logger(CatalogCacheService.name);
  constructor(private readonly redis: RedisService) {}

  async wrap<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const client = this.redis.getClient();
    if (!client) return compute();
    try {
      const hit = await client.get(PREFIX + key);
      if (hit) return JSON.parse(hit) as T;
    } catch (err) {
      this.logger.warn(`catalog cache read failed for ${key}: ${(err as Error).message}`);
      return compute();
    }
    const value = await compute();
    try {
      await client.setex(PREFIX + key, CATALOG_CACHE_TTL_SECONDS, JSON.stringify(value));
    } catch (err) {
      this.logger.warn(`catalog cache write failed for ${key}: ${(err as Error).message}`);
    }
    return value;
  }

  /** Called after every publish/update/archive so a staff edit is visible immediately. */
  async invalidate(): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    const keys = await client.keys(`${PREFIX}*`);
    if (keys.length > 0) await client.del(...keys);
  }
}
```

- [ ] Replace `CatalogService.search` with the faceted, cursor-friendly version. Keep the same `to_tsvector('simple', p.search_text)` + GIN predicate (decision 21):

```ts
export interface SearchFacets {
  types: Array<{ type: ProductType; count: number }>;
  categories: Array<{ category_id: string; name: string; count: number }>;
}

export interface SearchResult {
  items: Array<{ id: string; name: string; slug: string; type: ProductType; base_price: Prisma.Decimal;
                 rating_avg: Prisma.Decimal | null; rating_count: number; rank: number }>;
  facets: SearchFacets;
  next_cursor: string | null;
}

/**
 * SRCH-01. Uses the P2 GIN index on `to_tsvector('simple', search_text)` — the
 * predicate must stay byte-identical to the index expression or Postgres will not
 * use it. Facets are one extra grouped query over the same predicate.
 */
async search(
  q: string,
  type?: ProductType,
  categoryId?: string,
  cursor?: string,
  limit = 20,
): Promise<SearchResult> {
  const term = q.trim();
  if (!term) return { items: [], facets: { types: [], categories: [] }, next_cursor: null };

  const take = Math.min(Number(limit) || 20, 50);
  const offset = cursor ? Number(Buffer.from(cursor, 'base64').toString('utf8')) || 0 : 0;
  const typeFilter: string | null = type ?? null;
  const categoryFilter: string | null = categoryId ?? null;

  const items = await this.prisma.$queryRaw<SearchResult['items']>`
    SELECT p.id, p.name, p.slug, p.type, p.base_price, p.rating_avg, p.rating_count,
           ts_rank(to_tsvector('simple', p.search_text), plainto_tsquery('simple', ${term})) AS rank
    FROM "Product" p
    WHERE p.status = 'active'
      AND (${typeFilter}::text IS NULL OR p.type::text = ${typeFilter}::text)
      AND (${categoryFilter}::text IS NULL OR p.category_id = ${categoryFilter}::text)
      AND to_tsvector('simple', p.search_text) @@ plainto_tsquery('simple', ${term})
    ORDER BY rank DESC, p.name ASC
    LIMIT ${take + 1} OFFSET ${offset}`;

  const page = items.slice(0, take);
  const nextCursor =
    items.length > take ? Buffer.from(String(offset + take), 'utf8').toString('base64') : null;

  const facetRows = await this.prisma.$queryRaw<Array<{ type: ProductType; category_id: string; name: string; count: bigint }>>`
    SELECT p.type, p.category_id, c.name, count(*)::bigint AS count
    FROM "Product" p
    JOIN "ProductCategory" c ON c.id = p.category_id
    WHERE p.status = 'active'
      AND to_tsvector('simple', p.search_text) @@ plainto_tsquery('simple', ${term})
    GROUP BY p.type, p.category_id, c.name`;

  const types = new Map<ProductType, number>();
  const categories = new Map<string, { category_id: string; name: string; count: number }>();
  for (const row of facetRows) {
    const n = Number(row.count);
    types.set(row.type, (types.get(row.type) ?? 0) + n);
    const existing = categories.get(row.category_id);
    categories.set(row.category_id, {
      category_id: row.category_id, name: row.name, count: (existing?.count ?? 0) + n,
    });
  }

  return {
    items: page,
    facets: {
      types: [...types].map(([t, count]) => ({ type: t, count })),
      categories: [...categories.values()],
    },
    next_cursor: nextCursor,
  };
}
```

- [ ] Add cursor pagination to `listArgs` and wrap the three public reads in the cache. `findProductsPublic`, `findCategories` and `findProductBySlug` become:

```ts
async findProductsPublic(categoryId?, brandId?, type?, cursor?: string, limit?: number) {
  const key = `products:${categoryId ?? ''}:${brandId ?? ''}:${type ?? ''}:${cursor ?? ''}:${limit ?? ''}`;
  return this.cache.wrap(key, async () => { /* existing findMany, with cursor/skip:1 instead of skip:(page-1)*take */ });
}
```
  `cursor` is the last returned `Product.id`; when present pass `{ cursor: { id: cursor }, skip: 1 }`. Return `{ items, next_cursor }` where `next_cursor` is the id of the `take + 1`-th row or `null`. **This changes the public list response from a bare array to an envelope** — record it in the API appendix and in the Phase 34 hand-off.

- [ ] Call `await this.cache.invalidate()` at the end of `createProduct`, `updateProduct`, `setStatus`, `archiveProduct`, `upsertVariant`, `removeVariant`, `addMedia`, `removeMedia`, `createCategory`, `updateCategory`, `removeCategory`.
- [ ] Emit `stock.low` from `upsertVariant` when `low_stock_threshold != null && stock_on_hand <= low_stock_threshold` (`CAT-02`). Inject `EventEmitter2`; emit **after** the write, inside try/catch, with the `StockLowPayload` envelope from `commerce-events.ts`.
- [ ] Emit `product.published` from `setStatus` when the new status is `active` and the previous was not.
- [ ] Add `category_id` and `cursor`/`limit` query params to the controller. Route signatures become:

```ts
@Get('catalog/search')
@Public()
@Throttle({ default: { limit: 30, ttl: 60000 } })
async search(
  @Query('q') q?: string,
  @Query('type') type?: ProductType,
  @Query('category_id') category_id?: string,
  @Query('cursor') cursor?: string,
  @Query('limit') limit?: string,
) {
  return this.catalog.search(q ?? '', type, category_id, cursor, Number(limit) || 20);
}
```

- [ ] Add the `CAT-03` field-absence test to `backend/src/catalog/catalog.service.spec.ts`:

```ts
it('never exposes cost, yield, BOM or margin on the public shape (CAT-03)', async () => {
  const prisma = mockPrisma({ product: { findMany: jest.fn().mockResolvedValue([]) } });
  const service = new CatalogService(prisma as never, cache as never, emitter as never);
  await service.findProductsPublic();
  const args = prisma.product.findMany.mock.calls[0][0];
  const serialised = JSON.stringify(args.include);
  for (const forbidden of ['computed_cost', 'yield_qty', 'yield_unit', 'RecipeLines', 'margin', 'cost_per_unit']) {
    expect(serialised).not.toContain(forbidden);
  }
});
```

- [ ] Add search tests: a blank `q` short-circuits without a query; a `type` filter is passed through; the cursor round-trips; facets aggregate across types **and** categories.
- [ ] Wire `CatalogCacheService` into `CatalogModule` (`imports: [CustomerAuthModule]` for `RedisService`; add `CatalogCacheService` to providers).
- [ ] `cd backend && npx jest src/catalog --silent` — expect `Test Suites: 2 passed`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json && npx jest --silent` — expect `Test Suites: 66 passed, 66 total`.
- [ ] `git commit -m "feat(p5a-04): catalog 60s cache, faceted search, cursor pagination, stock.low signal" -- backend/src/catalog`

---

### Task 5: Server-side cart re-pricing, availability and fulfilment derivation

The heart of `CHK-01`. Produces the priced-line shape every later task consumes.

**Files:**
- Create: `backend/src/checkout/quote.types.ts`, `backend/src/checkout/cart-pricing.service.ts`, `backend/src/checkout/cart-pricing.service.spec.ts`

- [ ] Create `backend/src/checkout/quote.types.ts` — **owned by this task and frozen for the rest of the phase**; Tasks 8, 9 and 10 import it and must not edit it.

```ts
import { FulfilmentType, OrderChannel, ProductType } from '@prisma/client';
import type { Paise } from '../common/money/money';

/** One re-priced cart line. Every money field is integer paise. */
export interface PricedLine {
  product_id: string;
  variant_id: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  /** Product type — decides which availability rule ran. */
  type: ProductType;
  /** Derived from `Product.fulfilment` at quote time (decision 6). */
  fulfilment: FulfilmentType;
  /** base_price + variant.price_delta + channel modifier share, per unit. */
  unit_price: Paise;
  /** unit_price × quantity, tax-inclusive. */
  gross: Paise;
  /** `Product.tax_rate` as a percentage string, e.g. "5.00". */
  tax_rate: string;
  /** Carved out of `gross` (decision 1). */
  tax: Paise;
  weight_grams: number;
  hsn_code: string | null;
  available: boolean;
  unavailable_reason: string | null;
  /** `experience` lines only — the Event the booking hold is against. */
  event_id: string | null;
}

export interface PricedCart {
  lines: PricedLine[];
  /** Σ gross of available lines. */
  subtotal: Paise;
  /** Σ tax of available lines — contained *within* `subtotal`. */
  tax_total: Paise;
  tax_breakup: Array<{ rate: string; taxable: Paise; tax: Paise }>;
  channel: OrderChannel;
  channel_modifier: Paise;
  has_local: boolean;
  has_shipped: boolean;
  has_booking: boolean;
  shipped_weight_grams: number;
  rejected: Array<{ product_id: string; variant_id: string | null; name: string; reason: string }>;
}

/** Booking hold created during a quote (15 minutes, SPEC §5.2). */
export interface QuoteHold {
  booking_id: string;
  event_id: string;
  product_id: string;
  guests: number;
  expires_at: string;
}

/** The stored quote — Redis `quote:{customerId}:{quoteId}`, TTL 15 min. */
export interface StoredQuote {
  v: 2;
  quote_id: string;
  customer_id: string;
  created_at: string;
  expires_at: string;
  channel: OrderChannel;
  delivery_address_id: string | null;
  pickup: boolean;
  lines: PricedLine[];
  holds: QuoteHold[];
  subtotal: Paise;
  discount_amount: Paise;
  coupon: { id: string; code: string; type: string; discount: Paise } | null;
  shipping_amount: Paise;
  shipping: { provider: string; courier_name: string | null; courier_id: string | null;
              etd: string | null; serviceable: boolean } | null;
  tax_amount: Paise;
  tax_breakup: Array<{ rate: string; taxable: Paise; tax: Paise }>;
  loyalty_points_redeemed: number;
  loyalty_redeem_amount: Paise;
  loyalty_points_earned_estimate: number;
  total: Paise;
}

/** Redis `pending_order:{rzp_order_id}` — v2 (decision 5). */
export interface PendingOrderV2 extends Omit<StoredQuote, 'v' | 'quote_id' | 'expires_at'> {
  v: 2;
  razorpay_order_id: string;
  idempotency_key: string;
}
```

- [ ] Write `backend/src/checkout/cart-pricing.service.spec.ts` first. Cases (all with `mockPrisma`, no database):
  1. a `prepared_food` line prices as `base_price + variant delta` and derives `fulfilment = local`;
  2. a `packaged` line derives `fulfilment = shipped` and carries `weight_grams` into `shipped_weight_grams`;
  3. an `experience` line derives `fulfilment = booking` and carries `event_id`;
  4. a `merchandise` line with `stock_on_hand < quantity` is marked unavailable and lands in `rejected`, and is **excluded** from `subtotal`;
  5. a percentage channel modifier is spread per unit and included in `gross`;
  6. inclusive tax is carved out per line and grouped into `tax_breakup` by rate;
  7. a line whose product is `archived` is rejected with `"no longer available"`;
  8. a cart mixing all three fulfilment types sets `has_local`, `has_shipped` and `has_booking` all true;
  9. cart prices sent by the client are ignored — the server price wins even when the client sends a lower one.

```ts
it('ignores client-sent prices and re-prices from the database', async () => {
  const prisma = mockPrisma({
    product: { findMany: jest.fn().mockResolvedValue([{
      id: 'p1', name: 'Thali', type: 'prepared_food', fulfilment: 'local', stock_mode: 'derived_from_recipe',
      base_price: new Prisma.Decimal('450.00'), tax_rate: new Prisma.Decimal('5.00'),
      status: 'active', weight_grams: null, hsn_code: null, event_id: null, variants: [],
    }]) },
    channelModifier: { findFirst: jest.fn().mockResolvedValue(null) },
  });
  const service = new CartPricingService(prisma as never, catalog as never);
  const priced = await service.price(
    [{ productId: 'p1', variantId: null, quantity: 2, unitPrice: 1 /* lie */, name: 'x', imageUrl: null }],
    OrderChannel.delivery,
  );
  expect(priced.lines[0].unit_price).toBe(45000);
  expect(priced.subtotal).toBe(90000);
  expect(priced.lines[0].tax).toBe(inclusiveTaxPaise(90000, 5));
});
```

- [ ] Create `backend/src/checkout/cart-pricing.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { FulfilmentType, OrderChannel, ProductStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { inclusiveTaxPaise, percentOfPaise, sumPaise, toPaise, type Paise } from '../common/money/money';
import type { PricedCart, PricedLine } from './quote.types';

/** The Redis cart line shape (`CustomerOrdersService.CartData['items'][number]`). */
export interface CartLineInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  name?: string;
  unitPrice?: number;
  imageUrl?: string | null;
}

@Injectable()
export class CartPricingService {
  constructor(private readonly prisma: PrismaService, private readonly catalog: CatalogService) {}

  /**
   * CHK-01: re-prices every line from the database and re-checks availability per
   * product type (SPEC §3.3). Client-sent prices are never trusted; unavailable
   * lines are collected in `rejected` and excluded from every total.
   */
  async price(items: CartLineInput[], channel: OrderChannel): Promise<PricedCart> {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true, name: true, type: true, fulfilment: true, stock_mode: true, status: true,
        base_price: true, tax_rate: true, weight_grams: true, hsn_code: true, event_id: true,
        variants: { select: { id: true, name: true, sku: true, price_delta: true,
                              stock_on_hand: true, status: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    // One availability pass for every product in the cart (batched inside CatalogService).
    const availability = await this.catalog.getAllServingsAvailable();

    const modifier = await this.prisma.channelModifier.findFirst({
      where: { channel, status: 'active' },
    });

    const lines: PricedLine[] = [];
    const rejected: PricedCart['rejected'] = [];

    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product || product.status !== ProductStatus.active) {
        rejected.push({ product_id: item.productId, variant_id: item.variantId ?? null,
                        name: item.name ?? item.productId, reason: 'No longer available' });
        continue;
      }
      const variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId && v.status === ProductStatus.active)
        : product.variants.find((v) => v.status === ProductStatus.active) ?? null;
      if (item.variantId && !variant) {
        rejected.push({ product_id: product.id, variant_id: item.variantId,
                        name: product.name, reason: 'Selected option is no longer available' });
        continue;
      }

      const reason = this.availabilityReason(product, variant, item.quantity, availability[product.id]);
      if (reason) {
        rejected.push({ product_id: product.id, variant_id: variant?.id ?? null, name: product.name, reason });
        continue;
      }

      const base = toPaise(product.base_price);
      const delta = variant ? toPaise(variant.price_delta) : 0;
      const beforeModifier = base + delta;
      const unitPrice = beforeModifier + this.perUnitModifier(beforeModifier, modifier);
      const gross = unitPrice * item.quantity;
      const rate = new Prisma.Decimal(product.tax_rate).toFixed(2);

      lines.push({
        product_id: product.id,
        variant_id: variant?.id ?? null,
        name: variant ? `${product.name} — ${variant.name}` : product.name,
        sku: variant?.sku ?? null,
        quantity: item.quantity,
        type: product.type,
        fulfilment: product.fulfilment,          // decision 6
        unit_price: unitPrice,
        gross,
        tax_rate: rate,
        tax: inclusiveTaxPaise(gross, rate),
        weight_grams: product.weight_grams ?? 0,
        hsn_code: product.hsn_code,
        available: true,
        unavailable_reason: null,
        event_id: product.event_id,
      });
    }

    const subtotal = sumPaise(lines.map((l) => l.gross));
    const taxTotal = sumPaise(lines.map((l) => l.tax));

    const byRate = new Map<string, { taxable: Paise; tax: Paise }>();
    for (const line of lines) {
      const bucket = byRate.get(line.tax_rate) ?? { taxable: 0, tax: 0 };
      bucket.taxable += line.gross - line.tax;
      bucket.tax += line.tax;
      byRate.set(line.tax_rate, bucket);
    }

    return {
      lines,
      subtotal,
      tax_total: taxTotal,
      tax_breakup: [...byRate].map(([rate, v]) => ({ rate, taxable: v.taxable, tax: v.tax })),
      channel,
      channel_modifier: sumPaise(lines.map((l) => l.gross)) - sumPaise(lines.map(
        (l) => l.quantity * (l.unit_price - this.perUnitModifier(l.unit_price, modifier)))),
      has_local: lines.some((l) => l.fulfilment === FulfilmentType.local),
      has_shipped: lines.some((l) => l.fulfilment === FulfilmentType.shipped),
      has_booking: lines.some((l) => l.fulfilment === FulfilmentType.booking),
      shipped_weight_grams: sumPaise(
        lines.filter((l) => l.fulfilment === FulfilmentType.shipped).map((l) => l.weight_grams * l.quantity)),
      rejected,
    };
  }

  /** `fixed` modifiers apply once per unit; `percentage` scales the unit price. */
  private perUnitModifier(
    unitBase: Paise,
    modifier: { modifier_type: string; modifier_value: Prisma.Decimal } | null,
  ): Paise {
    if (!modifier) return 0;
    if (modifier.modifier_type === 'percentage') return percentOfPaise(unitBase, modifier.modifier_value);
    if (modifier.modifier_type === 'fixed') return toPaise(modifier.modifier_value);
    return 0;
  }

  /** SPEC §3.3 availability per product type; `null` means the line is sellable. */
  private availabilityReason(
    product: { type: string; stock_mode: string; name: string },
    variant: { stock_on_hand: Prisma.Decimal } | null,
    quantity: number,
    servings?: { available: boolean; servings_remaining: number },
  ): string | null {
    if (product.stock_mode === 'tracked') {
      const onHand = variant ? Number(variant.stock_on_hand) : 0;
      return onHand >= quantity ? null : `Only ${Math.max(onHand, 0)} left`;
    }
    if (!servings) return null;             // no availability record -> treat as sellable
    if (!servings.available) return 'Sold out';
    return servings.servings_remaining >= quantity
      ? null
      : `Only ${servings.servings_remaining} left`;
  }
}
```
  The `channel_modifier` expression above is deliberately derived rather than accumulated; if the reviewer prefers, accumulate it in the loop instead — the test asserts the value, not the derivation.

- [ ] `cd backend && npx jest src/checkout/cart-pricing --silent` — expect `Tests: 9 passed`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json && npx jest --silent` — expect `Test Suites: 67 passed, 67 total`.
- [ ] `git commit -m "feat(p5a-05): server-side cart re-pricing, per-type availability, fulfilment derivation" -- backend/src/checkout`

---

### Task 6: Coupons — CRUD, server-only validation, no stacking

**Files:**
- Create: `backend/src/promotions/coupons.service.ts`, `coupons.service.spec.ts`, `coupons.controller.ts`, `promotions.module.ts`, `dto/create-coupon.dto.ts`, `dto/update-coupon.dto.ts`, `dto/validate-coupon.dto.ts`

- [ ] Write `backend/src/promotions/coupons.service.spec.ts` first, covering `PROMO-02` exactly:
  1. an unknown code throws `BadRequestException('Invalid coupon code')`;
  2. `status !== active` is rejected;
  3. outside `[starts_at, ends_at]` is rejected;
  4. `subtotal < min_order` is rejected with the shortfall in the message;
  5. `percent` discount = `percentOfPaise(eligible, value)` and is capped by `max_discount`;
  6. `fixed` discount never exceeds the eligible subtotal;
  7. `free_shipping` returns `discount = 0` and `free_shipping = true`, and applies **only** when the cart has shipped lines;
  8. `applies_to = [packaged]` restricts the eligible base to `packaged` lines only;
  9. `usage_limit` reached (redemption count) is rejected;
  10. `per_customer_limit` reached for this customer is rejected;
  11. only one coupon may be applied — `validate` takes a single code and `CheckoutService` never merges two (stacking test asserts the DTO rejects an array).

- [ ] Create `backend/src/promotions/coupons.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CouponStatus, CouponType, FulfilmentType, Prisma, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { clampPaise, percentOfPaise, sumPaise, toDecimal, toPaise, type Paise } from '../common/money/money';
import type { PricedLine } from '../checkout/quote.types';

export interface CouponEvaluation {
  coupon: { id: string; code: string; type: CouponType };
  /** Discount in paise, applied to the order subtotal. `0` for free_shipping. */
  discount: Paise;
  free_shipping: boolean;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  // ---- staff CRUD -------------------------------------------------------
  async list(cursor?: string, limit = 50) { /* findMany with _count: { select: { redemptions: true } } */ }
  async create(dto: CreateCouponDto, userId: string) { /* code uppercased; starts_at < ends_at asserted */ }
  async update(id: string, dto: UpdateCouponDto, userId: string) { /* audit 'coupon.updated' */ }
  async archive(id: string, userId: string) { /* status -> disabled, audit */ }

  // ---- validation (PROMO-02) -------------------------------------------
  /**
   * The **only** place a discount is computed. Called from the quote and from
   * `POST /customer/coupons/validate`; never from the client.
   */
  async evaluate(
    code: string,
    ctx: { customerId: string; lines: PricedLine[]; subtotal: Paise; hasShipped: boolean },
  ): Promise<CouponEvaluation> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!coupon) throw new BadRequestException('Invalid coupon code');
    if (coupon.status !== CouponStatus.active) throw new BadRequestException('This coupon is not active');

    const now = new Date();
    if (now < coupon.starts_at) throw new BadRequestException('This coupon is not active yet');
    if (now > coupon.ends_at) throw new BadRequestException('This coupon has expired');

    // `applies_to` empty means "every product type".
    const applies = coupon.applies_to.length === 0
      ? ctx.lines
      : ctx.lines.filter((l) => coupon.applies_to.includes(l.type as ProductType));
    const eligible = sumPaise(applies.map((l) => l.gross));
    if (eligible === 0) throw new BadRequestException('This coupon does not apply to the items in your cart');

    if (coupon.min_order && ctx.subtotal < toPaise(coupon.min_order)) {
      const short = toDecimal(toPaise(coupon.min_order) - ctx.subtotal).toFixed(2);
      throw new BadRequestException(`Add ₹${short} more to use this coupon`);
    }

    const [used, usedByCustomer] = await Promise.all([
      coupon.usage_limit == null
        ? Promise.resolve(0)
        : this.prisma.couponRedemption.count({ where: { coupon_id: coupon.id } }),
      coupon.per_customer_limit == null
        ? Promise.resolve(0)
        : this.prisma.couponRedemption.count({
            where: { coupon_id: coupon.id, customer_id: ctx.customerId } }),
    ]);
    if (coupon.usage_limit != null && used >= coupon.usage_limit) {
      throw new BadRequestException('This coupon has been fully redeemed');
    }
    if (coupon.per_customer_limit != null && usedByCustomer >= coupon.per_customer_limit) {
      throw new BadRequestException('You have already used this coupon');
    }

    if (coupon.type === CouponType.free_shipping) {
      if (!ctx.hasShipped) {
        throw new BadRequestException('This coupon applies to shipped items only');
      }
      return { coupon: { id: coupon.id, code: coupon.code, type: coupon.type }, discount: 0, free_shipping: true };
    }

    const raw = coupon.type === CouponType.percent
      ? percentOfPaise(eligible, coupon.value)
      : toPaise(coupon.value);
    const cap = coupon.max_discount ? toPaise(coupon.max_discount) : eligible;
    const discount = clampPaise(raw, 0, Math.min(cap, eligible));

    return { coupon: { id: coupon.id, code: coupon.code, type: coupon.type }, discount, free_shipping: false };
  }
}
```

- [ ] `dto/create-coupon.dto.ts` — `@IsString() @Length(3, 32) code`, `@IsEnum(CouponType) type`, `@IsNumber({ maxDecimalPlaces: 2 }) @Min(0) value`, optional `@Min(0)` `min_order`/`max_discount`, `@IsArray() @IsEnum(ProductType, { each: true })` `applies_to`, `@IsDateString()` `starts_at`/`ends_at`, `@IsInt() @Min(1)` optional `usage_limit`/`per_customer_limit`, `@IsEnum(CouponStatus)` optional `status`.
- [ ] `dto/validate-coupon.dto.ts` — **a single `code: string`**, not an array. `PROMO-02` bans stacking at the type level.
- [ ] `coupons.controller.ts`:

```ts
@Controller('promotions/coupons')
export class CouponsController {
  @Get()    @RequiresPermission(Permission.MANAGE_OPS) list(@Query('cursor') c?: string, @Query('limit') l?: string) {}
  @Post()   @RequiresPermission(Permission.MANAGE_OPS) create(@Body() dto: CreateCouponDto, @Req() req) {}
  @Patch(':id') @RequiresPermission(Permission.MANAGE_OPS) update(...) {}
  @Delete(':id') @RequiresPermission(Permission.MANAGE_OPS) archive(...) {}
}
```
  The customer-facing `POST /customer/coupons/validate` lives on `CheckoutController` (Task 8) so it shares the `CustomerGuard`.

- [ ] `cd backend && npx jest src/promotions --silent` — expect `Tests: 11 passed`.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 68 passed, 68 total`.
- [ ] `git commit -m "feat(p5a-06): coupon CRUD and server-only evaluation with redemption limits" -- backend/src/promotions`

---

### Task 7: Loyalty — account, earn/redeem, staff adjust, 365-day expiry cron (+ wave-2 `app.module`)

**Files:**
- Create: `backend/src/loyalty/loyalty.service.ts`, `loyalty.service.spec.ts`, `loyalty.controller.ts`, `loyalty.cron.ts`, `loyalty.cron.spec.ts`, `loyalty.module.ts`, `dto/adjust-loyalty.dto.ts`
- Modify: `backend/src/app.module.ts` (**wave 2's single owner**)

- [ ] Write `backend/src/loyalty/loyalty.service.spec.ts` first:
  1. `getAccount` creates a zero-balance `member` account on first read;
  2. `previewRedeem` caps at the balance, at `max_redeem_percent` of the subtotal, and at whole points;
  3. `earnForOrder` writes `delta = floor(net_paise / 10000) × earn_rate_per_100` with `expires_at = now + expiry_days`;
  4. `earnForOrder` called twice for the same order writes one row (P2002 on `@@unique([order_id, reason])` → no-op);
  5. `redeemForOrder` decrements the balance and writes `balance_after`;
  6. tier recalculates from `lifetime_points` against the seeded thresholds (`member 0 / regular 500 / insider 2000`);
  7. `adjust` (staff) writes a `LoyaltyTransaction(reason: adjust)` **and** an `AuditEvent`;
  8. a redeem larger than the balance throws.

- [ ] Create `backend/src/loyalty/loyalty.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { LoyaltyReason, LoyaltyTier } from '@prisma/client';
import type { Tx } from '../common/types/transaction';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { hasPrismaCode } from '../common/utils/transaction-retry';
import { clampPaise, percentOfPaise, toPaise, type Paise } from '../common/money/money';

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async getAccount(customerId: string) {
    return this.prisma.loyaltyAccount.upsert({
      where: { customer_id: customerId },
      create: { customer_id: customerId },
      update: {},
    });
  }

  /**
   * LOYAL-02 redemption preview for the quote. Points are whole; the rupee value
   * per point and the cap come from `SystemSetting['loyalty']`.
   */
  async previewRedeem(customerId: string, requestedPoints: number, subtotal: Paise) {
    const cfg = await this.settings.get('loyalty');
    const account = await this.getAccount(customerId);
    const valuePerPoint = toPaise(cfg.redeem_value_per_point);   // e.g. 0.25 -> 25 paise
    const capPaise = percentOfPaise(subtotal, cfg.max_redeem_percent);
    const maxPointsByCap = valuePerPoint > 0 ? Math.floor(capPaise / valuePerPoint) : 0;
    const maxPoints = Math.max(0, Math.min(account.points_balance, maxPointsByCap));
    const points = Math.max(0, Math.min(Math.floor(requestedPoints || 0), maxPoints));
    return {
      balance: account.points_balance,
      tier: account.tier,
      max_redeemable_points: maxPoints,
      points_applied: points,
      redeem_amount: clampPaise(points * valuePerPoint, 0, subtotal),
      redeem_value_per_point: cfg.redeem_value_per_point,
    };
  }

  /** Points a paid order will earn once it is delivered/attended. */
  async earnEstimate(netPaise: Paise): Promise<number> {
    const cfg = await this.settings.get('loyalty');
    return Math.floor(netPaise / 10_000) * cfg.earn_rate_per_100;
  }

  /** Called inside the confirm transaction. `tx` MUST be the transaction client. */
  async redeemForOrder(tx: Tx, customerId: string, orderId: string, points: number) {
    if (points <= 0) return;
    const account = await tx.loyaltyAccount.upsert({
      where: { customer_id: customerId }, create: { customer_id: customerId }, update: {},
    });
    if (account.points_balance < points) throw new BadRequestException('Not enough loyalty points');
    const balanceAfter = account.points_balance - points;
    await tx.loyaltyAccount.update({
      where: { customer_id: customerId }, data: { points_balance: balanceAfter },
    });
    await tx.loyaltyTransaction.create({
      data: { customer_id: customerId, order_id: orderId, delta: -points,
              balance_after: balanceAfter, reason: LoyaltyReason.redeem },
    });
  }

  /**
   * LOYAL-02 earn, fired on `order.delivered` / `booking.attended`. Idempotent via
   * `@@unique([order_id, reason])` — a replayed webhook cannot double-credit.
   */
  async earnForOrder(orderId: string, customerId: string, netPaise: Paise) {
    const cfg = await this.settings.get('loyalty');
    const points = Math.floor(netPaise / 10_000) * cfg.earn_rate_per_100;
    if (points <= 0) return null;
    const expiresAt = new Date(Date.now() + cfg.expiry_days * 24 * 60 * 60 * 1000);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await tx.loyaltyAccount.upsert({
          where: { customer_id: customerId }, create: { customer_id: customerId }, update: {},
        });
        const balanceAfter = account.points_balance + points;
        const lifetime = account.lifetime_points + points;
        await tx.loyaltyAccount.update({
          where: { customer_id: customerId },
          data: { points_balance: balanceAfter, lifetime_points: lifetime, tier: this.tierFor(lifetime, cfg.tiers) },
        });
        return tx.loyaltyTransaction.create({
          data: { customer_id: customerId, order_id: orderId, delta: points,
                  balance_after: balanceAfter, reason: LoyaltyReason.earn, expires_at: expiresAt },
        });
      });
    } catch (err) {
      if (hasPrismaCode(err, 'P2002')) return null;   // already earned for this order
      throw err;
    }
  }

  /** Staff adjustment — always audited (LOYAL-01). */
  async adjust(customerId: string, delta: number, notes: string, userId: string) { /* tx + audit 'loyalty.adjusted' */ }

  private tierFor(lifetime: number, tiers: { member: number; regular: number; insider: number }): LoyaltyTier {
    if (lifetime >= tiers.insider) return LoyaltyTier.insider;
    if (lifetime >= tiers.regular) return LoyaltyTier.regular;
    return LoyaltyTier.member;
  }
}
```

- [ ] Create `backend/src/loyalty/loyalty.cron.ts` — nightly expiry under `pg_try_advisory_lock` (SPEC §8):

```ts
@Injectable()
export class LoyaltyExpiryCron {
  private readonly logger = new Logger(LoyaltyExpiryCron.name);
  /** Arbitrary but stable lock id; no other job may reuse it. */
  private static readonly LOCK_ID = 570_101;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async expirePoints(): Promise<void> {
    const [{ locked }] = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${LoyaltyExpiryCron.LOCK_ID}) AS locked`;
    if (!locked) return;
    try {
      const due = await this.prisma.loyaltyTransaction.findMany({
        where: { reason: LoyaltyReason.earn, expired: false, expires_at: { lte: new Date() } },
        select: { id: true, customer_id: true, delta: true },
      });
      for (const row of due) {
        await this.prisma.$transaction(async (tx) => {
          const account = await tx.loyaltyAccount.findUnique({ where: { customer_id: row.customer_id } });
          if (!account) return;
          const expire = Math.min(account.points_balance, row.delta);
          const balanceAfter = account.points_balance - expire;
          await tx.loyaltyAccount.update({
            where: { customer_id: row.customer_id }, data: { points_balance: balanceAfter } });
          await tx.loyaltyTransaction.create({
            data: { customer_id: row.customer_id, delta: -expire, balance_after: balanceAfter,
                    reason: LoyaltyReason.expire, notes: `Expired earn ${row.id}` } });
          await tx.loyaltyTransaction.update({ where: { id: row.id }, data: { expired: true } });
        });
      }
      this.logger.log(`Expired ${due.length} loyalty earn rows`);
    } finally {
      await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${LoyaltyExpiryCron.LOCK_ID})`;
    }
  }
}
```

- [ ] `loyalty.cron.spec.ts` — the lock is taken and released; a `locked: false` result short-circuits with no writes; an expired row never drives the balance below zero.
- [ ] `loyalty.controller.ts` — two surfaces on one controller pair:

```ts
@Controller('customer/loyalty')
@UseGuards(CustomerGuard)
@Public()
export class CustomerLoyaltyController {
  @Get() async mine(@Req() req) { /* account + last 50 transactions */ }
}

@Controller('customers')
export class StaffLoyaltyController {
  @Post(':id/loyalty-adjust')
  @RequiresPermission(Permission.MANAGE_OPS)
  adjust(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustLoyaltyDto, @Req() req) {}
}
```
  Task 17 adds `GET /customers` and `GET /customers/:id` on its own `CustomersController` — Nest allows two controllers to share a prefix while their paths differ.

- [ ] Register wave 2's modules in `backend/src/app.module.ts` — add `ShippingModule`, `PromotionsModule` and `LoyaltyModule` to `imports` (alphabetically near the other commerce modules) with their imports at the top. **No other wave-2 task edits this file.**
- [ ] `cd backend && npx jest src/loyalty --silent` — expect `Test Suites: 2 passed`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json && npx jest --silent` — expect `Test Suites: 70 passed, 70 total`.
- [ ] `git commit -m "feat(p5a-07): loyalty account, earn/redeem, staff adjust, nightly expiry cron" -- backend/src/loyalty backend/src/app.module.ts`

---

### Task 8: `POST /customer/checkout/quote` — the one composition point

Composes Tasks 5, 6, 7 and 3 into `CHK-02`. Creates 15-minute booking holds and stores the quote in Redis.

**Files:**
- Create: `backend/src/checkout/checkout.service.ts`, `checkout.service.spec.ts`, `checkout.controller.ts`, `checkout.module.ts`, `dto/quote-checkout.dto.ts`, `dto/create-order-from-quote.dto.ts`

- [ ] `dto/quote-checkout.dto.ts`:

```ts
export class QuoteCheckoutDto {
  @IsEnum(OrderChannel) channel: OrderChannel;
  @IsOptional() @IsUUID() delivery_address_id?: string;
  /** True when local lines are collected at the villa (SPEC §5.2 "or pickup"). */
  @IsOptional() @IsBoolean() pickup?: boolean;
  /** A single code — stacking is banned (PROMO-02). */
  @IsOptional() @IsString() @Length(3, 32) coupon_code?: string;
  @IsOptional() @IsInt() @Min(0) redeem_points?: number;
}
```

- [ ] Write `backend/src/checkout/checkout.service.spec.ts` first. Cases:
  1. an empty cart throws `BadRequestException('Cart is empty')`;
  2. a cart where every line is rejected throws and lists the reasons;
  3. local lines + a non-serviceable pincode throw `"We don't deliver to this pincode yet"`; **pickup bypasses the pincode check**;
  4. shipped lines call `ShippingProviderResolver.get().checkServiceability` once with the summed weight and set `shipping_amount` from the returned rate;
  5. a `free_shipping` coupon zeroes `shipping_amount` and leaves `discount_amount` at 0;
  6. `total = subtotal − discount − loyalty_redeem + shipping` and **never includes `tax_amount`**;
  7. booking lines create one `EventBooking{ status: held, hold_expires_at: +15 min }` per line and return them in `holds`;
  8. re-quoting releases the previous quote's holds before creating new ones;
  9. the quote is written to `quote:{customerId}:{quoteId}` with a 900 s TTL;
  10. Redis unavailable → `ServiceUnavailableException` (fail closed, matching `checkoutCart`).

- [ ] Create `backend/src/checkout/checkout.service.ts`:

```ts
@Injectable()
export class CheckoutService {
  static readonly QUOTE_TTL_SECONDS = 900; // 15 minutes, matching the booking hold

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
    private readonly pricing: CartPricingService,
    private readonly coupons: CouponsService,
    private readonly loyalty: LoyaltyService,
    private readonly shipping: ShippingProviderResolver,
  ) {}

  async quote(customerId: string, cart: CartLineInput[], dto: QuoteCheckoutDto): Promise<StoredQuote> {
    const redis = this.requireRedis();
    if (cart.length === 0) throw new BadRequestException('Cart is empty');

    const priced = await this.pricing.price(cart, dto.channel);
    if (priced.lines.length === 0) {
      throw new BadRequestException(
        `Nothing in your cart is available: ${priced.rejected.map((r) => `${r.name} — ${r.reason}`).join('; ')}`);
    }

    const address = await this.resolveAddress(customerId, dto);
    if (priced.has_local && !dto.pickup) {
      await this.assertLocalServiceable(address);
    }

    // ---- shipping (CHK-02) ------------------------------------------------
    let shippingAmount = 0;
    let shippingInfo: StoredQuote['shipping'] = null;
    if (priced.has_shipped) {
      if (!address) throw new BadRequestException('A delivery address is required for shipped items');
      const cfg = await this.settings.get('shipping');
      const provider = await this.shipping.get();
      const result = await provider.checkServiceability({
        pickup_pincode: cfg.pickup_location_code || address.pincode,
        delivery_pincode: address.pincode,
        weight_grams: Math.max(priced.shipped_weight_grams, cfg.default_weight_grams),
        declared_value_paise: priced.subtotal,
        cod: false,
      });
      if (!result.serviceable) {
        throw new BadRequestException(result.reason ?? 'We cannot ship to this pincode yet');
      }
      shippingAmount = result.rate;
      shippingInfo = { provider: provider.name, courier_name: result.courier_name,
                       courier_id: result.courier_id, etd: result.etd?.toISOString() ?? null,
                       serviceable: true };
    }

    // ---- coupon (PROMO-02) ------------------------------------------------
    let discount = 0;
    let coupon: StoredQuote['coupon'] = null;
    if (dto.coupon_code) {
      const evaluated = await this.coupons.evaluate(dto.coupon_code, {
        customerId, lines: priced.lines, subtotal: priced.subtotal, hasShipped: priced.has_shipped,
      });
      discount = evaluated.discount;
      if (evaluated.free_shipping) shippingAmount = 0;
      coupon = { id: evaluated.coupon.id, code: evaluated.coupon.code,
                 type: evaluated.coupon.type, discount: evaluated.discount };
    }

    // ---- loyalty (LOYAL-02) ----------------------------------------------
    const afterDiscount = Math.max(priced.subtotal - discount, 0);
    const redeem = await this.loyalty.previewRedeem(customerId, dto.redeem_points ?? 0, afterDiscount);

    // ---- booking holds (CHK-02) ------------------------------------------
    await this.releaseHolds(customerId);
    const holds = await this.createHolds(customerId, priced.lines);

    const total = Math.max(afterDiscount - redeem.redeem_amount, 0) + shippingAmount;
    const quoteId = randomUUID();
    const now = new Date();
    const stored: StoredQuote = {
      v: 2, quote_id: quoteId, customer_id: customerId,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + CheckoutService.QUOTE_TTL_SECONDS * 1000).toISOString(),
      channel: dto.channel,
      delivery_address_id: address?.id ?? null,
      pickup: dto.pickup ?? false,
      lines: priced.lines,
      holds,
      subtotal: priced.subtotal,
      discount_amount: discount,
      coupon,
      shipping_amount: shippingAmount,
      shipping: shippingInfo,
      tax_amount: priced.tax_total,
      tax_breakup: priced.tax_breakup,
      loyalty_points_redeemed: redeem.points_applied,
      loyalty_redeem_amount: redeem.redeem_amount,
      loyalty_points_earned_estimate: await this.loyalty.earnEstimate(total - shippingAmount),
      total,
    };

    await redis.setex(this.quoteKey(customerId, quoteId), CheckoutService.QUOTE_TTL_SECONDS,
                      JSON.stringify(stored));
    return stored;
  }

  quoteKey(customerId: string, quoteId: string) { return `quote:${customerId}:${quoteId}`; }

  async readQuote(customerId: string, quoteId: string): Promise<StoredQuote> {
    const raw = await this.requireRedis().get(this.quoteKey(customerId, quoteId));
    if (!raw) throw new BadRequestException('Your quote expired — please review your cart again');
    return JSON.parse(raw) as StoredQuote;
  }

  /** 15-minute `held` bookings, one per `experience` line. */
  private async createHolds(customerId: string, lines: PricedLine[]): Promise<QuoteHold[]> { /* … */ }
  /** Cancels this customer's outstanding `held` bookings so re-quoting cannot double-hold. */
  private async releaseHolds(customerId: string): Promise<void> { /* updateMany status: cancelled where held */ }
  private async assertLocalServiceable(address): Promise<void> {
    const pincodes = await this.settings.get('delivery_pincodes');
    const allowed = pincodes.length > 0
      ? pincodes
      : (process.env.DELIVERY_PINCODES ?? '').split(',').map((p) => p.trim()).filter(Boolean);
    if (allowed.length === 0) return;                       // no restriction configured
    if (!address) throw new BadRequestException('Please select a delivery address');
    if (!allowed.includes(address.pincode)) {
      throw new BadRequestException("Sorry, we don't deliver to this pincode yet");
    }
  }
  private requireRedis() {
    const client = this.redis.getClient();
    if (!client) throw new ServiceUnavailableException('Checkout is temporarily unavailable. Please try again in a moment.');
    return client;
  }
}
```

- [ ] Create `backend/src/checkout/checkout.controller.ts`. It carries the two customer routes that need the priced cart; the guard stack mirrors `CustomerOrdersController` exactly (`@UseGuards(CustomerGuard)` + `@Public()` to bypass the global `JwtAuthGuard`):

```ts
@Controller('customer')
@UseGuards(CustomerGuard)
@Public()
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly carts: CustomerOrdersService,
    private readonly coupons: CouponsService,
    private readonly pricing: CartPricingService,
  ) {}

  @Post('checkout/quote')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async quote(@Req() req: CustomerRequest, @Body() dto: QuoteCheckoutDto) {
    const cart = await this.carts.getCart(req.user.customerId);
    return toQuoteResponse(await this.checkout.quote(req.user.customerId, cart?.items ?? [], dto));
  }

  @Post('coupons/validate')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async validateCoupon(@Req() req: CustomerRequest, @Body() dto: ValidateCouponDto) {
    const cart = await this.carts.getCart(req.user.customerId);
    const priced = await this.pricing.price(cart?.items ?? [], dto.channel ?? OrderChannel.delivery);
    const evaluated = await this.coupons.evaluate(dto.code, {
      customerId: req.user.customerId, lines: priced.lines,
      subtotal: priced.subtotal, hasShipped: priced.has_shipped,
    });
    return { valid: true, code: evaluated.coupon.code, type: evaluated.coupon.type,
             discount: evaluated.discount / 100, free_shipping: evaluated.free_shipping };
  }
}
```
  `toQuoteResponse` converts every `Paise` field to rupees (`/100`) so the wire shape matches the rest of the API — the appendix documents the rupee form. Keep it in `quote.types.ts`… **no**: `quote.types.ts` is frozen by Task 5. Put `toQuoteResponse` in `checkout.service.ts` and export it.

- [ ] `checkout.module.ts` — imports `PrismaModule`, `CustomerAuthModule`, `SettingsModule`, `CatalogModule`, `PromotionsModule`, `LoyaltyModule`, `ShippingModule`, `forwardRef(() => CustomerOrdersModule)`; providers `CartPricingService`, `CheckoutService`; controllers `CheckoutController`; exports `CheckoutService`, `CartPricingService`. Task 9 adds the matching `forwardRef(() => CheckoutModule)` on its side.
- [ ] `cd backend && npx jest src/checkout --silent` — expect `Test Suites: 2 passed`, `Tests: 19 passed`.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 71 passed, 71 total`.
- [ ] `git commit -m "feat(p5a-08): POST /customer/checkout/quote with shipping rate, coupon, loyalty and booking holds" -- backend/src/checkout`

---

### Task 9: `POST /customer/orders` takes a `quote_id`; cart sync returns server prices

`CHK-03`. Replaces the float arithmetic in `checkoutCart` with the frozen quote.

**Files:**
- Modify: `backend/src/customer-orders/customer-orders.service.ts`, `customer-orders.controller.ts`, `customer-orders.module.ts`, `dto/sync-cart.dto.ts`, `customer-orders.service.spec.ts`
- Create: `backend/src/customer-orders/dto/create-order-from-quote.dto.ts`

- [ ] `dto/create-order-from-quote.dto.ts`:

```ts
export class CreateOrderFromQuoteDto {
  @IsUUID() quote_id: string;
  /** Client-supplied replay guard; also written to `Order.idempotency_key`. */
  @IsOptional() @IsString() @Length(8, 64) idempotency_key?: string;
}
```

- [ ] Rewrite `CustomerOrdersService.checkoutCart` as `createOrderFromQuote`. The old signature `checkoutCart(customerId)` is removed; the controller route stays `POST /customer/orders` but now takes a body.

```ts
async createOrderFromQuote(customerId: string, dto: CreateOrderFromQuoteDto) {
  const redis = this.requireRedis();

  // 1. Read the frozen quote (throws if expired).
  const quote = await this.checkout.readQuote(customerId, dto.quote_id);

  // 2. Re-validate: prices, availability and the coupon can have moved in 15 minutes.
  const cart = await this.getCart(customerId);
  const reprice = await this.pricing.price(cart?.items ?? [], quote.channel);
  this.assertQuoteStillValid(quote, reprice);

  // 3. Razorpay order for the **quoted** total, in paise — no float anywhere.
  const rzpOrder = await this.razorpayService.createOrder({
    amount: quote.total,
    receipt: `mkt_${customerId.slice(0, 8)}_${Date.now()}`,
    notes: { type: 'marketplace', entity_id: customerId },
  });

  // 4. Freeze the quote into the pending record (30 min TTL, unchanged).
  const pending: PendingOrderV2 = {
    ...quote,
    v: 2,
    razorpay_order_id: rzpOrder.id,
    idempotency_key: dto.idempotency_key ?? dto.quote_id,
  };
  delete (pending as Partial<StoredQuote>).quote_id;
  delete (pending as Partial<StoredQuote>).expires_at;

  await redis.set(`pending_order:${rzpOrder.id}`, JSON.stringify(pending), 'EX', PENDING_ORDER_TTL);
  await redis.del(this.checkout.quoteKey(customerId, dto.quote_id));

  return { razorpay_order_id: rzpOrder.id, amount: quote.total, currency: 'INR' };
}

/**
 * A quote is honoured only if every line is still available at the same unit price.
 * Anything else sends the customer back to the cart rather than charging a stale total.
 */
private assertQuoteStillValid(quote: StoredQuote, reprice: PricedCart): void {
  const now = new Map(reprice.lines.map((l) => [`${l.product_id}:${l.variant_id ?? ''}`, l]));
  for (const line of quote.lines) {
    const current = now.get(`${line.product_id}:${line.variant_id ?? ''}`);
    if (!current) throw new BadRequestException(`"${line.name}" is no longer available — please review your cart`);
    if (current.unit_price !== line.unit_price) {
      throw new BadRequestException(`The price of "${line.name}" changed — please review your cart`);
    }
    if (current.quantity < line.quantity) {
      throw new BadRequestException(`Only ${current.quantity} of "${line.name}" left — please review your cart`);
    }
  }
}
```

- [ ] Make `getCart` / `syncCart` return server-priced lines (`CHK-01`). `syncCart` keeps its merge logic but ends with:

```ts
const priced = await this.pricing.price(merged.items, merged.channel ?? OrderChannel.delivery);
await this.setCart(customerId, merged);
return {
  ...merged,
  items: merged.items.map((item) => {
    const line = priced.lines.find(
      (l) => l.product_id === item.productId && (l.variant_id ?? null) === (item.variantId ?? null));
    const rejection = priced.rejected.find((r) => r.product_id === item.productId);
    return {
      ...item,
      unitPrice: line ? line.unit_price / 100 : item.unitPrice,
      fulfilment: line?.fulfilment ?? null,
      available: Boolean(line),
      unavailable_reason: rejection?.reason ?? null,
    };
  }),
  totals: { subtotal: priced.subtotal / 100, tax_total: priced.tax_total / 100 },
};
```

- [ ] Extend `dto/sync-cart.dto.ts`'s item shape with `@IsOptional() @IsEnum(FulfilmentType) fulfilment?: FulfilmentType` so a client may echo it back; the server always overwrites it.
- [ ] Update `confirmOrder` to parse the pending payload through a version guard:

```ts
/** Reads either shape; a payload with no `v` is a pre-P5a v1 record (decision 5). */
function upgradePending(raw: string): PendingOrderV2 {
  const parsed = JSON.parse(raw) as PendingOrderV2 | PendingOrderData;
  if ((parsed as PendingOrderV2).v === 2) return parsed as PendingOrderV2;
  const v1 = parsed as PendingOrderData;
  return {
    v: 2,
    razorpay_order_id: '',
    idempotency_key: '',
    customer_id: v1.customerId,
    created_at: new Date().toISOString(),
    channel: v1.channel,
    delivery_address_id: v1.deliveryAddressId,
    pickup: false,
    lines: v1.cart.items.map((i) => ({
      product_id: i.productId, variant_id: i.variantId ?? null, name: i.name, sku: null,
      quantity: i.quantity, type: 'prepared_food', fulfilment: FulfilmentType.local,
      unit_price: Math.round(i.unitPrice * 100), gross: Math.round(i.unitPrice * 100) * i.quantity,
      tax_rate: '0.00', tax: 0, weight_grams: 0, hsn_code: null,
      available: true, unavailable_reason: null, event_id: null,
    })),
    holds: [], subtotal: Math.round(v1.subtotal * 100), discount_amount: 0, coupon: null,
    shipping_amount: 0, shipping: null, tax_amount: 0, tax_breakup: [],
    loyalty_points_redeemed: 0, loyalty_redeem_amount: 0, loyalty_points_earned_estimate: 0,
    total: Math.round(v1.total * 100),
  };
}
```
  Amount comparison in `confirmOrder` becomes `Number(payment.amount) !== pending.total` — the pending total is already in paise, so the `Math.round(total * 100)` float step disappears.

- [ ] Controller changes:

```ts
@Post('orders')
@Throttle({ default: { limit: 5, ttl: 60000 } })
async createOrder(@Req() req: CustomerRequest, @Body() dto: CreateOrderFromQuoteDto) {
  return this.customerOrdersService.createOrderFromQuote(req.user.customerId, dto);
}

@Get('orders/:id/shipment')
async getShipment(@Req() req: CustomerRequest, @Param('id', ParseUUIDPipe) id: string) {
  return this.customerOrdersService.getOrderShipment(req.user.customerId, id);
}
```
  `getOrderShipment` verifies ownership, then returns the `Shipment` with its `events` ordered `occurred_at desc` (`SHIP-05`). Returns `null` when the order has no shipped lines.

- [ ] Add `CheckoutModule` (via `forwardRef`) and `CatalogModule` to `CustomerOrdersModule.imports`; inject `CheckoutService` and `CartPricingService`.
- [ ] Extend `customer-orders.service.spec.ts` with: an expired quote throws; a price change between quote and pay throws; the Razorpay amount equals `quote.total` exactly (paise, no rounding); the pending record round-trips as `v: 2`; a v1 pending record still confirms; `getOrderShipment` returns 403 for another customer's order.
- [ ] `cd backend && npx jest src/customer-orders --silent` — expect all green.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json && npx jest --silent` — expect `Test Suites: 71 passed`.
- [ ] `git commit -m "feat(p5a-09): quote-backed POST /customer/orders, server-priced cart sync, v2 pending payload" -- backend/src/customer-orders`

---

### Task 10: Extend `FulfilmentService.confirmPaidOrder` — one transaction, every commercial effect

`CHK-04`. The method is **extended, not forked** (decision 7): both the confirm endpoint and the webhook keep calling it.

**Files:**
- Modify: `backend/src/fulfilment/fulfilment.service.ts`, `fulfilment.module.ts`, `fulfilment.service.spec.ts`

- [ ] Change `ConfirmPaidOrderInput.pending` to `PendingOrderV2` (from `checkout/quote.types`) and keep `PendingOrderData` exported for the v1 upgrade path in Task 9.
- [ ] Rewrite the `tx.order.create` payload so every SPEC §3.3 money column is populated from the frozen quote:

```ts
const created = await tx.order.create({
  data: {
    channel: pending.channel,
    customer_id: customerId,
    subtotal: toDecimal(pending.subtotal),
    channel_modifier_amount: toDecimal(0),   // already folded into unit_price by CartPricingService
    discount_amount: toDecimal(pending.discount_amount + pending.loyalty_redeem_amount),
    shipping_amount: toDecimal(pending.shipping_amount),
    tax_amount: toDecimal(pending.tax_amount),
    total: toDecimal(pending.total),
    coupon_id: pending.coupon?.id ?? null,
    loyalty_points_redeemed: pending.loyalty_points_redeemed,
    loyalty_points_earned: 0,                // credited on delivery (LOYAL-02), not on payment
    idempotency_key: pending.idempotency_key || null,
    address_snapshot: addressSnapshot ?? Prisma.JsonNull,
    delivery_address: deliveryAddress,
    status: OrderStatus.placed,
    placed_via: input.placedVia,
    created_by: null,
    zone_id: zoneId,
    items: {
      create: pending.lines.map((line) => ({
        product_id: line.product_id,
        variant_id: line.variant_id,
        quantity: line.quantity,
        unit_price: toDecimal(line.unit_price),
        tax_rate: new Prisma.Decimal(line.tax_rate),   // per-line rate from Product.tax_rate
        fulfilment: line.fulfilment,                   // derived at quote time, re-verified below
      })),
    },
    payment: {
      create: {
        method: PaymentMethod.razorpay,
        amount: toDecimal(pending.total),
        status: PaymentStatus.paid,
        razorpay_order_id: input.razorpayOrderId,
        razorpay_payment_id: input.razorpayPaymentId,
      },
    },
  },
  include: { items: true },
});
```

- [ ] Add the new private step, called immediately after `applyPrepTypeOnCreate` and **inside the same transaction**:

```ts
/**
 * CHK-04: every commercial side effect of a paid order, in the same Serializable
 * transaction as the order itself. Routing per line:
 *   local   -> `applyPrepTypeOnCreate` already handled it (KDS vs Pick & Pack)
 *   shipped -> item goes to the `packed` queue
 *   booking -> the 15-minute hold becomes `confirmed` and is linked to the item
 */
private async applyCommercialEffects(
  tx: Tx,
  order: { id: string; items: Array<{ id: string; product_id: string; fulfilment: FulfilmentType; quantity: number }> },
  pending: PendingOrderV2,
  customerId: string,
): Promise<void> {
  // 1. Re-verify the derived fulfilment against the live catalog (decision 6).
  const products = await tx.product.findMany({
    where: { id: { in: [...new Set(order.items.map((i) => i.product_id))] } },
    select: { id: true, fulfilment: true },
  });
  const liveFulfilment = new Map(products.map((p) => [p.id, p.fulfilment]));
  for (const item of order.items) {
    const live = liveFulfilment.get(item.product_id);
    if (live && live !== item.fulfilment) {
      await tx.orderItem.update({ where: { id: item.id }, data: { fulfilment: live } });
      item.fulfilment = live;
    }
  }

  // 2. Shipped lines join the pack queue.
  const shipped = order.items.filter((i) => i.fulfilment === FulfilmentType.shipped);
  if (shipped.length > 0) {
    await tx.orderItem.updateMany({
      where: { id: { in: shipped.map((i) => i.id) } },
      data: { status: OrderItemStatus.packed },
    });
  }

  // 3. Booking lines: promote the hold, link it to the item.
  const bookingItems = order.items.filter((i) => i.fulfilment === FulfilmentType.booking);
  for (const [index, item] of bookingItems.entries()) {
    const hold = pending.holds[index];
    if (!hold) throw new BadRequestException('Booking hold expired — payment will be refunded');
    const booking = await tx.eventBooking.findUnique({ where: { id: hold.booking_id } });
    if (!booking || booking.status === BookingStatus.cancelled) {
      throw new BadRequestException('Booking hold expired — payment will be refunded');
    }
    await tx.eventBooking.update({
      where: { id: hold.booking_id },
      data: { status: BookingStatus.confirmed, payment_status: 'paid', hold_expires_at: null,
              razorpay_payment_id: null },
    });
    await tx.orderItem.update({
      where: { id: item.id },
      data: { event_booking_id: hold.booking_id, status: OrderItemStatus.ready },
    });
  }

  // 4. Coupon redemption (PROMO-02) — unique on (coupon_id, order_id).
  if (pending.coupon && pending.discount_amount > 0) {
    await tx.couponRedemption.create({
      data: { coupon_id: pending.coupon.id, order_id: order.id, customer_id: customerId,
              amount: toDecimal(pending.discount_amount) },
    });
  }

  // 5. Loyalty redemption (LOYAL-02) — earn happens on delivery, not here.
  if (pending.loyalty_points_redeemed > 0) {
    await this.loyalty.redeemForOrder(tx, customerId, order.id, pending.loyalty_points_redeemed);
  }
}
```

- [ ] Emit the after-commit events (SPEC §4.1 requires "only after the transaction commits", inside try/catch). Add to the end of `confirmPaidOrder`, after the transaction resolves:

```ts
this.safeEmit(CommerceEvent.ORDER_CONFIRMED, {
  node_id: DEFAULT_NODE_ID, actor: { actor_type: ActorType.customer, actor_id: customerId },
  occurred_at: new Date(), order_id: order.id, total: pending.total / 100, channel: pending.channel,
});
if (pending.coupon) {
  this.safeEmit(CommerceEvent.COUPON_REDEEMED, {
    node_id: DEFAULT_NODE_ID, actor: { actor_type: ActorType.customer, actor_id: customerId },
    occurred_at: new Date(), coupon_id: pending.coupon.id, code: pending.coupon.code,
    order_id: order.id, amount: pending.discount_amount / 100,
  });
}
```
  `safeEmit` is a one-line private helper: `try { this.emitter.emit(name, payload); } catch (err) { this.logger.warn(...); }`.

- [ ] Extend the audit row already written by `confirmPaidOrder` with the new money fields (`discount_amount`, `shipping_amount`, `tax_amount`, `coupon_code`, `loyalty_points_redeemed`).
- [ ] `FulfilmentModule` gains `imports: [LoyaltyModule]` and `EventEmitter2` (already global via `EventEmitterModule.forRoot()`).
- [ ] Extend `fulfilment.service.spec.ts`:
  1. a mixed cart writes three `OrderItem`s with `fulfilment` `local` / `shipped` / `booking`;
  2. shipped items land at `OrderItemStatus.packed`;
  3. the booking hold flips to `confirmed` and is linked via `event_booking_id`;
  4. a coupon writes exactly one `CouponRedemption` with the paise-exact amount;
  5. `loyalty.redeemForOrder` is called with the transaction client, not `prisma`;
  6. `Order.total` equals `pending.total / 100` and `tax_amount` is **not** added to it;
  7. `OrderItem.tax_rate` is the per-line `Product.tax_rate`, not `0`;
  8. a cancelled hold throws before any write;
  9. a live `Product.fulfilment` change between quote and confirm re-routes the item and is asserted;
  10. the P2002 duplicate-payment path still returns the existing order (regression from P1).
- [ ] `cd backend && npx jest src/fulfilment --silent` — expect all green.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 71 passed`.
- [ ] `git commit -m "feat(p5a-10): confirmPaidOrder writes money columns, coupon redemption, loyalty, bookings and packed lines" -- backend/src/fulfilment`

---

### Task 11: Shipments staff API — pack → AWB → pickup → label → cancel (+ wave-3 `app.module`)

`SHIP-03`. Every transition appends a `ShipmentEvent` and pushes a Pusher update.

**Files:**
- Create: `backend/src/shipments/shipments.service.ts`, `shipments.service.spec.ts`, `shipments.controller.ts`, `shipments.module.ts`, `dto/pack-shipment.dto.ts`, `dto/manual-awb.dto.ts`
- Modify: `backend/src/app.module.ts` (**wave 3's single owner** — registers `CheckoutModule` and `ShipmentsModule`)

- [ ] Write `backend/src/shipments/shipments.service.spec.ts` first:
  1. `pack` on an order with no `shipped` lines throws `BadRequestException`;
  2. `pack` creates one `Shipment{ status: pending }`, a `ShipmentEvent`, an `AuditEvent` and a `StockMovement{ movement_type: shipment_packed }` per tracked variant;
  3. `pack` twice returns the existing shipment (P2002 on `order_id @unique`) without a second event;
  4. `assignAwb` with the `manual` provider stores the pasted AWB/tracking URL and moves to `awb_assigned`;
  5. `assignAwb` with the Shiprocket provider calls `createShipment` then `assignAwb` and stores both provider ids;
  6. `schedulePickup` requires `awb_assigned` and moves to `pickup_scheduled`;
  7. `getLabel` requires an AWB and caches `label_url` on the row;
  8. `cancel` from `delivered` throws; `cancel` from `pickup_scheduled` calls the provider and moves to `cancelled`;
  9. every transition triggers `pusher.trigger('private-shipments', 'shipment.updated', …)`.

- [ ] Create `backend/src/shipments/shipments.service.ts`:

```ts
@Injectable()
export class ShipmentsService {
  /** Allowed forward transitions; anything else throws. */
  private static readonly TRANSITIONS: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
    [ShipmentStatus.pending]: [ShipmentStatus.awb_assigned, ShipmentStatus.cancelled, ShipmentStatus.failed],
    [ShipmentStatus.awb_assigned]: [ShipmentStatus.pickup_scheduled, ShipmentStatus.cancelled, ShipmentStatus.failed],
    [ShipmentStatus.pickup_scheduled]: [ShipmentStatus.picked_up, ShipmentStatus.cancelled, ShipmentStatus.failed],
    [ShipmentStatus.picked_up]: [ShipmentStatus.in_transit, ShipmentStatus.rto, ShipmentStatus.failed],
    [ShipmentStatus.in_transit]: [ShipmentStatus.out_for_delivery, ShipmentStatus.rto, ShipmentStatus.failed],
    [ShipmentStatus.out_for_delivery]: [ShipmentStatus.delivered, ShipmentStatus.rto, ShipmentStatus.failed],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly providers: ShippingProviderResolver,
    private readonly audit: AuditService,
    private readonly pusher: PusherService,
    private readonly emitter: EventEmitter2,
  ) {}

  async list(status?: ShipmentStatus, cursor?: string, limit = 50) { /* cursor pagination, include order + items */ }
  async findOne(id: string) { /* include events ordered occurred_at desc */ }

  /**
   * SHIP-03 "pack": turns every `fulfilment = shipped` line of an order into one
   * Shipment. Idempotent — `Shipment.order_id` is unique, so a second pack returns
   * the first shipment (decision 8).
   */
  async pack(orderId: string, dto: PackShipmentDto, userId: string) {
    const cfg = await this.settings.get('shipping');
    try {
      return await withSerializableRetry(() => this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { items: { include: { product: true, variant: true } } },
        });
        const shippedItems = order.items.filter((i) => i.fulfilment === FulfilmentType.shipped);
        if (shippedItems.length === 0) throw new BadRequestException('This order has no shipped items');

        const weight = shippedItems.reduce(
          (total, i) => total + (i.product.weight_grams ?? 0) * i.quantity, 0) || cfg.default_weight_grams;

        const shipment = await tx.shipment.create({
          data: {
            order_id: orderId,
            provider: cfg.provider as ShippingProvider,
            status: ShipmentStatus.pending,
            pickup_location_code: dto.pickup_location_code ?? cfg.pickup_location_code,
            weight_grams: dto.weight_grams ?? weight,
            packed_by: userId,
          },
        });
        await tx.shipmentEvent.create({
          data: { shipment_id: shipment.id, status: ShipmentStatus.pending,
                  occurred_at: new Date(), raw: { source: 'staff.pack' } },
        });
        await tx.orderItem.updateMany({
          where: { id: { in: shippedItems.map((i) => i.id) } },
          data: { status: OrderItemStatus.packed },
        });
        // Tracked merchandise leaves stock when it is packed (MovementType.shipment_packed).
        for (const item of shippedItems.filter((i) => i.variant_id)) {
          await tx.productVariant.update({
            where: { id: item.variant_id! },
            data: { stock_on_hand: { decrement: item.quantity } },
          });
          await tx.stockMovement.create({
            data: { ingredient_id: null, zone_id: order.zone_id, movement_type: MovementType.shipment_packed,
                    quantity: -item.quantity, original_quantity: item.quantity, unit: 'unit',
                    reason: 'Shipment packed', reference_type: 'shipment', reference_id: shipment.id,
                    actor_type: ActorType.user, actor_id: userId, created_by: userId },
          });
        }
        await this.audit.record(tx, {
          entity_type: 'shipment', entity_id: shipment.id, action: 'shipment.packed',
          ...AuditService.user(userId), after: { order_id: orderId, weight_grams: shipment.weight_grams },
        });
        return shipment;
      }, SERIALIZABLE_TX_OPTIONS));
    } catch (err) {
      if (hasPrismaCode(err, 'P2002')) {
        return this.prisma.shipment.findUniqueOrThrow({ where: { order_id: orderId } });
      }
      throw err;
    } finally {
      await this.notify(orderId);
    }
  }

  async assignAwb(id: string, dto: ManualAwbDto, userId: string) { /* provider.createShipment + assignAwb, or manual paste */ }
  async schedulePickup(id: string, userId: string) { /* provider.schedulePickup, status -> pickup_scheduled */ }
  async getLabel(id: string, userId: string) { /* provider.getLabel, cache label_url */ }
  async cancel(id: string, reason: string, userId: string) { /* provider.cancel, status -> cancelled */ }

  /**
   * The single write path for a status change (used by staff actions AND the
   * webhook in Task 12). Appends the ledger row, audits, Pushes and emits.
   */
  async applyStatus(
    id: string,
    next: ShipmentStatus,
    occurredAt: Date,
    raw: unknown,
    actor: { actor_type: ActorType; actor_id: string | null },
  ) { /* transition guard + tx { shipment.update, shipmentEvent.create (skip P2002), audit } */ }

  private assertTransition(from: ShipmentStatus, to: ShipmentStatus): void {
    if (from === to) return;
    const allowed = ShipmentsService.TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Cannot move a shipment from ${from} to ${to}`);
    }
  }
}
```
  `StockMovement.ingredient_id` is required in the current schema — if it is non-nullable, skip the `StockMovement` write for variant stock and record the decrement in the `AuditEvent` only. **Check `model StockMovement` before implementing this step and take whichever branch the schema allows; do not alter the schema (Task 1 owns it).**

- [ ] `shipments.controller.ts`:

```ts
@Controller('shipments')
export class ShipmentsController {
  @Get()               @RequiresPermission(Permission.MANAGE_OPS) list(@Query() q) {}
  @Get(':id')          @RequiresPermission(Permission.MANAGE_OPS) findOne(@Param('id', ParseUUIDPipe) id) {}
  @Post('pack')        @RequiresPermission(Permission.MANAGE_OPS) pack(@Body() dto: PackShipmentDto, @Req() req) {}
  @Post(':id/awb')     @RequiresPermission(Permission.MANAGE_OPS) awb(@Param('id', ParseUUIDPipe) id, @Body() dto: ManualAwbDto, @Req() req) {}
  @Post(':id/pickup')  @RequiresPermission(Permission.MANAGE_OPS) pickup(@Param('id', ParseUUIDPipe) id, @Req() req) {}
  @Get(':id/label')    @RequiresPermission(Permission.MANAGE_OPS) label(@Param('id', ParseUUIDPipe) id, @Req() req) {}
  @Post(':id/cancel')  @RequiresPermission(Permission.MANAGE_OPS) cancel(@Param('id', ParseUUIDPipe) id, @Body('reason') reason: string, @Req() req) {}
}
```
  `PackShipmentDto` carries `order_id` (UUID, required) plus optional `weight_grams` and `pickup_location_code`; `ManualAwbDto` carries optional `awb`, `courier_name`, `tracking_url` (used by the manual provider) — with the Shiprocket provider all three are ignored and filled from the API.

- [ ] Register `CheckoutModule` and `ShipmentsModule` in `backend/src/app.module.ts`. **No other wave-3 task edits this file.**
- [ ] `cd backend && npx jest src/shipments --silent` — expect `Tests: 9 passed`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json && npx jest --silent` — expect `Test Suites: 72 passed, 72 total`.
- [ ] `git commit -m "feat(p5a-11): shipments queue with pack/AWB/pickup/label/cancel and shipment event ledger" -- backend/src/shipments backend/src/app.module.ts`

---

### Task 12: `POST /webhooks/shiprocket` + order status propagation (+ wave-4 `app.module`)

`SHIP-04`, `SHIP-05`.

**Files:**
- Create: `backend/src/webhooks/shiprocket-webhook.service.ts`, `shiprocket-webhook.service.spec.ts`
- Modify: `backend/src/webhooks/webhooks.controller.ts`, `webhooks.module.ts`, `backend/src/app.module.ts` (**wave 4's single owner**)

- [ ] Write `backend/src/webhooks/shiprocket-webhook.service.spec.ts` first:
  1. a missing or wrong `x-konma-webhook-token` throws `UnauthorizedException` **before** any database read;
  2. a token of a different length does not leak through `timingSafeEqual` (the length check happens first);
  3. an unknown AWB returns `{ status: 'ignored' }` without throwing (Shiprocket retries on non-2xx);
  4. a known AWB appends one `ShipmentEvent` and updates `Shipment.status`;
  5. **the same `(awb, status, occurred_at)` twice writes one event** (P2002 on the unique triple → swallowed);
  6. `DELIVERED` sets `Shipment.status = delivered`, `Order.status = delivered`, and every shipped `OrderItem.status = delivered`;
  7. an in-transit status sets `Order.status = shipped` when the order is not already past it;
  8. a delivered shipment triggers the customer Pusher event and the WhatsApp template, both inside `.catch()`;
  9. an unmapped provider string maps to `failed` and still records an event.

- [ ] Create `backend/src/webhooks/shiprocket-webhook.service.ts`:

```ts
import { timingSafeEqual } from 'node:crypto';

/** Shiprocket's tracking webhook body (documented fields we rely on). */
interface ShiprocketWebhookBody {
  awb?: string;
  current_status?: string;
  current_status_id?: number;
  order_id?: string;
  courier_name?: string;
  etd?: string;
  current_timestamp?: string;
  scans?: Array<{ date?: string; activity?: string; status?: string; location?: string }>;
}

@Injectable()
export class ShiprocketWebhookService {
  private readonly logger = new Logger(ShiprocketWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly shipments: ShipmentsService,
    private readonly pusher: PusherService,
    private readonly whatsapp: WhatsAppService,
    private readonly emitter: EventEmitter2,
  ) {}

  /** SPEC §5.3: shared-secret header, compared in constant time (decision 9). */
  assertAuthorised(token: string | undefined): void {
    const expected = this.config.get<string>('SHIPROCKET_WEBHOOK_TOKEN');
    if (!expected) throw new ForbiddenException('Shiprocket webhook is not configured');
    const provided = Buffer.from(token ?? '', 'utf8');
    const secret = Buffer.from(expected, 'utf8');
    if (provided.length !== secret.length || !timingSafeEqual(provided, secret)) {
      throw new UnauthorizedException('Invalid webhook token');
    }
  }

  async handle(token: string | undefined, body: ShiprocketWebhookBody) {
    this.assertAuthorised(token);

    const awb = body.awb?.trim();
    if (!awb) return { status: 'ignored', reason: 'no awb' };

    const shipment = await this.prisma.shipment.findUnique({
      where: { awb },
      include: { order: { select: { id: true, status: true, customer_id: true, customer_phone: true } } },
    });
    if (!shipment) {
      this.logger.warn(`Shiprocket webhook for unknown AWB ${awb}`);
      return { status: 'ignored', reason: 'unknown awb' };
    }

    const next = mapShiprocketStatus(body.current_status);
    const occurredAt = body.current_timestamp
      ? new Date(body.current_timestamp.replace(' ', 'T'))
      : new Date();

    // SHIP-04 idempotency: (shipment, status, occurred_at) is unique; a replay is a no-op.
    await this.shipments.applyStatus(shipment.id, next, occurredAt, body,
      { actor_type: ActorType.system, actor_id: null });

    await this.propagateToOrder(shipment.order.id, shipment.order.status, next);
    this.notifyCustomer(shipment, next, awb, body.courier_name ?? shipment.courier_name);

    return { status: 'ok', shipment_status: next };
  }

  /**
   * Shipment status drives `Order.status` (`shipped` -> `delivered`). Local lines are
   * untouched: an order that also has local items only reaches `delivered` when every
   * shipped item is delivered, which is exactly what the `updateMany` count proves.
   */
  private async propagateToOrder(orderId: string, current: OrderStatus, next: ShipmentStatus) {
    if (next === ShipmentStatus.delivered) {
      await this.prisma.$transaction(async (tx) => {
        await tx.orderItem.updateMany({
          where: { order_id: orderId, fulfilment: FulfilmentType.shipped },
          data: { status: OrderItemStatus.delivered },
        });
        const outstanding = await tx.orderItem.count({
          where: { order_id: orderId, status: { notIn: [OrderItemStatus.delivered, OrderItemStatus.attended,
                                                        OrderItemStatus.cancelled, OrderItemStatus.ready] } },
        });
        if (outstanding === 0) {
          await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.delivered } });
        }
      });
      this.safeEmit(CommerceEvent.SHIPMENT_DELIVERED, { /* envelope + shipment_id, order_id */ });
      this.safeEmit(CommerceEvent.ORDER_DELIVERED, { /* envelope + order_id, customer_id */ });
      return;
    }
    const inFlight: ShipmentStatus[] = [
      ShipmentStatus.picked_up, ShipmentStatus.in_transit, ShipmentStatus.out_for_delivery];
    if (inFlight.includes(next) && current !== OrderStatus.delivered && current !== OrderStatus.completed) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.shipped } });
    }
    this.safeEmit(CommerceEvent.SHIPMENT_STATUS_CHANGED, { /* envelope */ });
  }

  /** SHIP-05: customer Pusher event + WhatsApp template, both failure-isolated. */
  private notifyCustomer(shipment, next: ShipmentStatus, awb: string, courier: string | null) {
    const customerId = shipment.order.customer_id;
    if (customerId) {
      this.pusher.trigger(`private-customer-${customerId}`, 'shipment.updated', {
        orderId: shipment.order.id, shipmentId: shipment.id, status: next, awb, courier,
        trackingUrl: shipment.tracking_url,
      }).catch((err) => this.logger.warn(`Pusher shipment.updated failed: ${err.message}`));
    }
    if (next === ShipmentStatus.delivered || next === ShipmentStatus.out_for_delivery) {
      const phone = shipment.order.customer_phone;
      if (phone) {
        this.whatsapp.sendTemplate(phone, 'shipment_update', [String(next), awb, courier ?? ''])
          .catch((err) => this.logger.warn(`WhatsApp shipment_update failed: ${err.message}`));
      }
    }
  }
}
```

- [ ] Add `sendTemplate(recipientPhone, templateName, bodyParams)` to `backend/src/customer-auth/whatsapp.service.ts` — the same Graph API call as `sendOtp` with a parameterised template name, logging and returning (not throwing) when unconfigured outside production. **Note: `whatsapp.service.ts` is otherwise untouched by any other P5a task.**
- [ ] Add the route to `backend/src/webhooks/webhooks.controller.ts`:

```ts
@Post('shiprocket')
@Public()
@HttpCode(200)
@Throttle({ default: { limit: 300, ttl: 60000 } })
async handleShiprocket(
  @Headers('x-konma-webhook-token') token: string,
  @Body() body: Record<string, unknown>,
) {
  return this.shiprocketWebhookService.handle(token, body);
}
```
  No `rawBody` is needed (decision 9), so `main.ts` stays untouched.

- [ ] Add `ShiprocketWebhookService` to `WebhooksModule` providers and import `ShipmentsModule`.
- [ ] Register `RefundsModule` and `ReviewsModule` (created in Tasks 13 and 14, same wave) in `backend/src/app.module.ts`. **No other wave-4 task edits this file.**
- [ ] `cd backend && npx jest src/webhooks --silent` — expect `Test Suites: 2 passed`.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 73 passed, 73 total`.
- [ ] `git commit -m "feat(p5a-12): shiprocket tracking webhook, order status propagation, customer notifications" -- backend/src/webhooks backend/src/customer-auth/whatsapp.service.ts backend/src/app.module.ts`

---

### Task 13: Refunds — `POST /orders/:id/refund` + `refund.processed` reconciliation

`CHK-05`. A new module keeps `orders.controller.ts` free for Task 15.

**Files:**
- Create: `backend/src/refunds/refunds.service.ts`, `refunds.service.spec.ts`, `refunds.controller.ts`, `refunds.module.ts`, `dto/create-refund.dto.ts`
- Modify: `backend/src/webhooks/webhooks.service.ts`, `webhooks.service.spec.ts`

- [ ] Write `backend/src/refunds/refunds.service.spec.ts` first:
  1. an order with no `Payment` throws `BadRequestException`;
  2. a non-`razorpay` payment method throws (manual refunds are recorded, not gateway-called — assert the explicit message);
  3. `amount > payment.amount − refunded_amount` throws with the refundable balance in the message;
  4. a full refund sets `Payment.status = refunded` and `Order.status = refunded`;
  5. a partial refund sets `Payment.status = partially_refunded` and leaves `Order.status` alone;
  6. `Payment.refunded_amount` accumulates across two partial refunds;
  7. a `Refund` row is written with `status: pending` before the gateway call and flipped to `processed` after;
  8. a Razorpay failure leaves the `Refund` at `failed` and does **not** change `Payment.status`;
  9. an `AuditEvent{ action: 'order.refunded' }` is written inside the transaction.

- [ ] Create `backend/src/refunds/refunds.service.ts`:

```ts
@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly audit: AuditService,
  ) {}

  async list(orderId: string) {
    return this.prisma.refund.findMany({ where: { order_id: orderId }, orderBy: { created_at: 'desc' } });
  }

  /**
   * CHK-05. The `Refund` row is written *before* the gateway call so a crash between
   * the two leaves an auditable `pending` row rather than silence. The webhook
   * (`refund.processed`) is the authority on the final status.
   */
  async refund(orderId: string, dto: CreateRefundDto, userId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId }, include: { payment: true },
    });
    const payment = order.payment;
    if (!payment) throw new BadRequestException('This order has no payment to refund');
    if (payment.status !== PaymentStatus.paid && payment.status !== PaymentStatus.partially_refunded) {
      throw new BadRequestException(`Cannot refund a payment with status ${payment.status}`);
    }
    if (payment.method !== PaymentMethod.razorpay || !payment.razorpay_payment_id) {
      throw new BadRequestException('Only Razorpay payments can be refunded from here — record cash/UPI refunds manually');
    }

    const paid = toPaise(payment.amount);
    const alreadyRefunded = toPaise(payment.refunded_amount);
    const requested = dto.amount != null ? toPaise(dto.amount) : paid - alreadyRefunded;
    const refundable = paid - alreadyRefunded;
    if (requested <= 0) throw new BadRequestException('Refund amount must be greater than zero');
    if (requested > refundable) {
      throw new BadRequestException(`Only ₹${toDecimal(refundable).toFixed(2)} is left to refund on this order`);
    }

    const refund = await this.prisma.refund.create({
      data: { order_id: orderId, payment_id: payment.id, amount: toDecimal(requested),
              reason: dto.reason, status: RefundStatus.pending, requested_by: userId },
    });

    let gatewayId: string | null = null;
    try {
      const result = await this.razorpay.createRefund(payment.razorpay_payment_id, requested, dto.reason);
      gatewayId = (result as { id?: string }).id ?? null;
    } catch (err) {
      await this.prisma.refund.update({ where: { id: refund.id }, data: { status: RefundStatus.failed } });
      throw new BadRequestException(`Refund failed at the gateway: ${(err as Error).message}`);
    }

    return withSerializableRetry(() => this.prisma.$transaction(async (tx) => {
      const totalRefunded = alreadyRefunded + requested;
      const full = totalRefunded >= paid;
      const updated = await tx.refund.update({
        where: { id: refund.id },
        data: { status: RefundStatus.processed, razorpay_refund_id: gatewayId },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { refunded_amount: toDecimal(totalRefunded),
                status: full ? PaymentStatus.refunded : PaymentStatus.partially_refunded },
      });
      if (full) {
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.refunded, updated_by: userId } });
      }
      await this.audit.record(tx, {
        entity_type: 'order', entity_id: orderId, action: 'order.refunded',
        ...AuditService.user(userId),
        before: { refunded_amount: toDecimal(alreadyRefunded).toFixed(2), payment_status: payment.status },
        after: { refunded_amount: toDecimal(totalRefunded).toFixed(2),
                 payment_status: full ? 'refunded' : 'partially_refunded',
                 refund_id: updated.id, razorpay_refund_id: gatewayId, reason: dto.reason },
      });
      return updated;
    }, SERIALIZABLE_TX_OPTIONS));
  }
}
```

- [ ] `dto/create-refund.dto.ts`: `@IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount?: number` (omitted = full refund) and `@IsString() @Length(3, 200) reason: string`.
- [ ] `refunds.controller.ts` — a second controller on the `orders` prefix (decision in the file structure):

```ts
@Controller('orders')
export class RefundsController {
  @Post(':id/refund')
  @RequiresPermission(Permission.MANAGE_POS)
  refund(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateRefundDto, @Req() req) {}

  @Get(':id/refunds')
  @RequiresPermission(Permission.MANAGE_POS)
  list(@Param('id', ParseUUIDPipe) id: string) {}
}
```

- [ ] Replace `WebhooksService.handleRefundProcessed` — it currently flips `Payment.status` to `refunded` for any refund, ignoring partials and never writing a `Refund` row:

```ts
private async handleRefundProcessed(payload: any) {
  const refund = payload.refund?.entity as
    { id: string; payment_id: string; amount: number; notes?: { reason?: string } } | undefined;
  if (!refund) return;

  // Event bookings keep their existing behaviour (they have no Order/Payment pair).
  const booking = await this.prisma.eventBooking.findFirst({
    where: { razorpay_payment_id: refund.payment_id } });
  if (booking) {
    await this.prisma.eventBooking.update({
      where: { id: booking.id }, data: { payment_status: 'refunded' } });
    return;
  }

  const payment = await this.prisma.payment.findFirst({
    where: { razorpay_payment_id: refund.payment_id } });
  if (!payment) return;

  // Idempotent on razorpay_refund_id: a replay updates nothing.
  const existing = await this.prisma.refund.findUnique({ where: { razorpay_refund_id: refund.id } });
  if (existing?.status === RefundStatus.processed) return;

  await withSerializableRetry(() => this.prisma.$transaction(async (tx) => {
    const row = existing
      ? await tx.refund.update({ where: { id: existing.id }, data: { status: RefundStatus.processed } })
      : await tx.refund.create({
          data: { order_id: payment.order_id, payment_id: payment.id,
                  amount: toDecimal(refund.amount), reason: refund.notes?.reason ?? 'Gateway refund',
                  razorpay_refund_id: refund.id, status: RefundStatus.processed },
        });

    const paid = toPaise(payment.amount);
    const totalRefunded = toPaise(
      (await tx.refund.aggregate({
        where: { payment_id: payment.id, status: RefundStatus.processed },
        _sum: { amount: true },
      }))._sum.amount ?? 0);
    const full = totalRefunded >= paid;

    await tx.payment.update({
      where: { id: payment.id },
      data: { refunded_amount: toDecimal(totalRefunded),
              status: full ? PaymentStatus.refunded : PaymentStatus.partially_refunded },
    });
    if (full) {
      await tx.order.update({ where: { id: payment.order_id }, data: { status: OrderStatus.refunded } });
    }
    await this.audit.record(tx, {
      entity_type: 'order', entity_id: payment.order_id, action: 'order.refund_reconciled',
      actor_type: ActorType.system, actor_id: null,
      after: { refund_id: row.id, razorpay_refund_id: refund.id,
               refunded_amount: toDecimal(totalRefunded).toFixed(2) },
    });
  }, SERIALIZABLE_TX_OPTIONS));
}
```
  `WebhooksService` gains `AuditService` in its constructor (it is `@Global`, so no module import is needed).

- [ ] Extend `webhooks.service.spec.ts`: a partial `refund.processed` sets `partially_refunded`; a second delivery of the same `refund.id` is a no-op; a refund whose payment is unknown is ignored; the booking branch is unchanged.
- [ ] `cd backend && npx jest src/refunds src/webhooks --silent` — expect all green.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 74 passed, 74 total`.
- [ ] `git commit -m "feat(p5a-13): staff refunds with Refund rows and partial-aware refund.processed reconciliation" -- backend/src/refunds backend/src/webhooks/webhooks.service.ts backend/src/webhooks/webhooks.service.spec.ts`

---

### Task 14: Reviews — one per delivered/attended `OrderItem`, auto-publish at ≥ 4, moderation

`REV-01`, `REV-02`. The rollup trigger itself is Task 18's SQL; this task writes the service that depends on it.

**Files:**
- Create: `backend/src/reviews/reviews.service.ts`, `reviews.service.spec.ts`, `reviews.controller.ts`, `reviews.listener.ts`, `reviews.module.ts`, `dto/create-review.dto.ts`, `dto/moderate-review.dto.ts`

- [ ] Write `backend/src/reviews/reviews.service.spec.ts` first:
  1. reviewing an `OrderItem` that is not `delivered` or `attended` throws `"You can review an item once it has been delivered"`;
  2. reviewing another customer's order item throws `ForbiddenException`;
  3. a second review of the same `order_item_id` throws `ConflictException` (P2002 on the unique);
  4. rating 4 or 5 is created `published`; rating 1–3 is created `pending`;
  5. the auto-publish threshold comes from `SystemSetting['reviews'].auto_publish_min_rating`, not a constant;
  6. rating outside 1–5 is rejected by the DTO;
  7. `publish` and `hide` write `moderated_by`/`moderated_at` and an `AuditEvent`;
  8. publishing emits `review.published`;
  9. `listPublic(productId)` returns only `published` rows;
  10. `pendingForCustomer` lists delivered/attended items with no review yet.

- [ ] Create `backend/src/reviews/reviews.service.ts`:

```ts
@Injectable()
export class ReviewsService {
  private static readonly REVIEWABLE: OrderItemStatus[] = [
    OrderItemStatus.delivered, OrderItemStatus.attended];

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly emitter: EventEmitter2,
  ) {}

  /** REV-01: one review per order item, only after the item is delivered or attended. */
  async create(customerId: string, dto: CreateReviewDto) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: dto.order_item_id },
      include: { order: { select: { customer_id: true } } },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.order.customer_id !== customerId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    if (!ReviewsService.REVIEWABLE.includes(item.status)) {
      throw new BadRequestException('You can review an item once it has been delivered');
    }

    const cfg = await this.settings.get('reviews');
    const status = dto.rating >= cfg.auto_publish_min_rating
      ? ReviewStatus.published
      : ReviewStatus.pending;

    try {
      const review = await this.prisma.review.create({
        data: {
          product_id: item.product_id, customer_id: customerId, order_item_id: item.id,
          rating: dto.rating, title: dto.title ?? null, body: dto.body ?? null,
          media: dto.media ?? [], status,
        },
      });
      if (status === ReviewStatus.published) this.emitPublished(review);
      return review;
    } catch (err) {
      if (hasPrismaCode(err, 'P2002')) {
        throw new ConflictException('You have already reviewed this item');
      }
      throw err;
    }
  }

  /** REV-02: moderation, restricted to FRONTEND_LEAD/admins at the controller. */
  async moderate(id: string, status: ReviewStatus, userId: string) {
    const review = await this.prisma.$transaction(async (tx) => {
      const before = await tx.review.findUniqueOrThrow({ where: { id } });
      const after = await tx.review.update({
        where: { id },
        data: { status, moderated_by: userId, moderated_at: new Date() },
      });
      await this.audit.record(tx, {
        entity_type: 'review', entity_id: id,
        action: status === ReviewStatus.published ? 'review.published' : 'review.hidden',
        ...AuditService.user(userId),
        before: { status: before.status }, after: { status },
      });
      return after;
    });
    if (status === ReviewStatus.published) this.emitPublished(review);
    return review;
  }

  async listForModeration(status: ReviewStatus = ReviewStatus.pending, cursor?: string, limit = 50) { /* … */ }
  async listPublic(productId: string, cursor?: string, limit = 20) { /* status: published only */ }
  async listForCustomer(customerId: string) { /* the customer's own reviews, any status */ }

  /** ACCT-02 / REV-02: what this customer may still review. */
  async pendingForCustomer(customerId: string) {
    return this.prisma.orderItem.findMany({
      where: {
        order: { customer_id: customerId },
        status: { in: ReviewsService.REVIEWABLE },
        review: null,
      },
      include: { product: { select: { id: true, name: true, slug: true } },
                 order: { select: { id: true, order_number: true, created_at: true } } },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  private emitPublished(review: { id: string; product_id: string; rating: number }) {
    try {
      this.emitter.emit(CommerceEvent.REVIEW_PUBLISHED, {
        node_id: DEFAULT_NODE_ID, actor: { actor_type: ActorType.system, actor_id: null },
        occurred_at: new Date(), review_id: review.id, product_id: review.product_id, rating: review.rating,
      });
    } catch { /* failure-isolated per SPEC §4.1 */ }
  }
}
```

- [ ] Create `backend/src/reviews/reviews.listener.ts` — the review invitation (`REV-02`), driven by the `order.delivered` / `booking.attended` events Tasks 12, 15 and 16 emit. **Event-driven so no wave-4 task depends on another wave-4 task's class.**

```ts
@Injectable()
export class ReviewInvitationListener {
  private readonly logger = new Logger(ReviewInvitationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
    private readonly settings: SettingsService,
  ) {}

  @OnEvent(CommerceEvent.ORDER_DELIVERED, { async: true })
  async onOrderDelivered(payload: OrderDeliveredPayload) {
    await this.invite(payload.order_id).catch((err) =>
      this.logger.warn(`Review invitation failed for order ${payload.order_id}: ${err.message}`));
  }

  @OnEvent(CommerceEvent.BOOKING_ATTENDED, { async: true })
  async onBookingAttended(payload: BookingAttendedPayload) { /* same, resolved via OrderItem.event_booking_id */ }

  private async invite(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: { include: { product: { select: { name: true, slug: true } } } } },
    });
    if (!order?.customer) return;
    const link = `${process.env.FRONTEND_URL ?? ''}/feedback/${order.id}`;
    if (order.customer.phone) {
      await this.whatsapp.sendTemplate(order.customer.phone, 'review_invitation',
        [order.customer.name ?? 'there', String(order.order_number), link]);
    }
    if (order.customer.email) {
      await this.email.sendHtml(order.customer.email, 'How was your Konma order?',
        renderReviewInvitation(order, link));
    }
  }
}
```
  `renderReviewInvitation` is a small template function in the same file (mirroring `customer-orders/receipt.template.ts`); it must not import anything from `reviews.service.ts`.

- [ ] `dto/create-review.dto.ts` — `@IsUUID() order_item_id`, `@IsInt() @Min(1) @Max(5) rating`, optional `@IsString() @MaxLength(120) title`, optional `@IsString() @MaxLength(2000) body`, optional `@IsArray() @IsUrl({}, { each: true }) @ArrayMaxSize(5) media`.
- [ ] `reviews.controller.ts` — customer and staff surfaces:

```ts
@Controller('customer/reviews')
@UseGuards(CustomerGuard)
@Public()
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class CustomerReviewsController {
  @Get()          mine(@Req() req) {}
  @Get('pending') pending(@Req() req) {}
  @Post()         create(@Req() req, @Body() dto: CreateReviewDto) {}
}

@Controller('reviews')
export class ReviewsController {
  @Get()               @RequiresPermission(Permission.MANAGE_OPS) list(@Query() q) {}
  @Patch(':id/publish') @RequiresPermission(Permission.MANAGE_OPS) publish(@Param('id', ParseUUIDPipe) id, @Req() req) {}
  @Patch(':id/hide')    @RequiresPermission(Permission.MANAGE_OPS) hide(@Param('id', ParseUUIDPipe) id, @Req() req) {}
}

// Public product reviews ride on the catalog surface but live here to keep CatalogService lean.
@Controller('catalog/products')
export class PublicReviewsController {
  @Get(':id/reviews')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  list(@Param('id', ParseUUIDPipe) id: string, @Query('cursor') cursor?: string) {}
}
```

- [ ] `cd backend && npx jest src/reviews --silent` — expect `Tests: 10 passed`.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 75 passed, 75 total`.
- [ ] `git commit -m "feat(p5a-14): reviews gated on delivered items, auto-publish, moderation, invitations" -- backend/src/reviews`

---

### Task 15: Order lifecycle — `shipped → delivered → completed`, loyalty earn on delivery

Closes the SPEC §5.2 step 6 loop for **local** orders (Task 12 covers shipped ones).

**Files:**
- Create: `backend/src/orders/order-lifecycle.service.ts`, `order-lifecycle.service.spec.ts`
- Modify: `backend/src/orders/orders.service.ts`, `orders.controller.ts`, `orders.module.ts`, `orders.service.spec.ts`

- [ ] Extend `STATUS_TRANSITIONS` in `backend/src/orders/orders.service.ts` to cover the shipment and completion lifecycles the P2 comment promised:

```ts
const STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.placed]: [OrderStatus.confirmed, OrderStatus.preparing],
  [OrderStatus.confirmed]: [OrderStatus.preparing],
  [OrderStatus.preparing]: [OrderStatus.ready],
  [OrderStatus.ready]: [OrderStatus.served, OrderStatus.dispatched, OrderStatus.shipped],
  [OrderStatus.dispatched]: [OrderStatus.delivered],
  [OrderStatus.shipped]: [OrderStatus.delivered],
  [OrderStatus.served]: [OrderStatus.completed],
  [OrderStatus.delivered]: [OrderStatus.completed],
};
```
  Remove `delivered` from `TERMINAL_STATUSES` (it is no longer terminal — `completed` is) and keep `served`, `completed`, `cancelled`, `refunded` there.

- [ ] Create `backend/src/orders/order-lifecycle.service.ts`:

```ts
@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger(OrderLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyService,
    private readonly audit: AuditService,
    private readonly emitter: EventEmitter2,
  ) {}

  /**
   * SPEC §5.2 step 6. Called after a status write lands on `delivered` (local
   * delivery, or the shipment webhook) — credits loyalty and emits `order.delivered`,
   * which the review-invitation listener consumes.
   *
   * Idempotent: `LoyaltyTransaction @@unique([order_id, reason])` means a second call
   * credits nothing, so a replayed webhook is harmless.
   */
  async onDelivered(orderId: string, actor: { actor_type: ActorType; actor_id: string | null }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customer_id: true, subtotal: true, discount_amount: true,
                shipping_amount: true, loyalty_points_earned: true },
    });
    if (!order?.customer_id) return;
    if (order.loyalty_points_earned > 0) return;   // already credited

    // Earn on the goods value only — shipping never earns points.
    const netPaise = Math.max(toPaise(order.subtotal) - toPaise(order.discount_amount), 0);
    const txn = await this.loyalty.earnForOrder(order.id, order.customer_id, netPaise);
    if (txn) {
      await this.prisma.order.update({
        where: { id: order.id }, data: { loyalty_points_earned: txn.delta },
      });
    }

    this.safeEmit(CommerceEvent.ORDER_DELIVERED, {
      node_id: DEFAULT_NODE_ID, actor, occurred_at: new Date(),
      order_id: order.id, customer_id: order.customer_id,
    });
  }

  /** Terminal close-out; POS "complete" and the daily close both land here. */
  async complete(orderId: string, userId: string) { /* status -> completed + audit 'order.completed' */ }

  private safeEmit(name: string, payload: unknown) {
    try { this.emitter.emit(name, payload); }
    catch (err) { this.logger.warn(`emit ${name} failed: ${(err as Error).message}`); }
  }
}
```

- [ ] Call `orderLifecycle.onDelivered(...)` from `OrdersService.updateStatus` **after** the transaction commits, whenever the new status is `delivered`. Also call it from `updateDelivery` when `delivery_status` reaches `delivered` (the existing rider flow).
- [ ] Add `POST /orders/:id/complete` to `orders.controller.ts` (`@RequiresPermission(Permission.MANAGE_POS)`).
- [ ] Write `order-lifecycle.service.spec.ts`: earning happens once; a second `onDelivered` is a no-op; shipping is excluded from the earn base; an order with no customer earns nothing; `order.delivered` is emitted exactly once and inside try/catch.
- [ ] Extend `orders.service.spec.ts` with the new transitions: `ready → shipped` allowed, `ready → delivered` **rejected**, `delivered → completed` allowed, `completed → anything` rejected.
- [ ] `OrdersModule` imports `LoyaltyModule`; providers gain `OrderLifecycleService`; exports gain it too (Task 12's webhook may reuse it — if it does, it injects via `ShipmentsModule`'s import chain rather than editing this file).
- [ ] `cd backend && npx jest src/orders --silent` — expect all green.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 76 passed, 76 total`.
- [ ] `git commit -m "feat(p5a-15): order lifecycle to delivered/completed with idempotent loyalty earn" -- backend/src/orders`

---

### Task 16: Experiences — hold expiry cron and attendance marking

`CAT-04` and the booking half of SPEC §5.2 step 5.

**Files:**
- Create: `backend/src/events/event-holds.cron.ts`, `event-holds.cron.spec.ts`, `backend/src/events/dto/mark-attendance.dto.ts`
- Modify: `backend/src/events/events.service.ts`, `events.controller.ts`, `events.module.ts`, `events.service.spec.ts`

- [ ] Make every capacity read exclude expired holds. `EventsService.enrichWithGuestCounts` and the three in-transaction capacity re-checks currently sum all bookings; they must sum only bookings that count:

```ts
/** Bookings that occupy capacity: confirmed, attended, or a hold that has not expired. */
const OCCUPYING_BOOKINGS = (now: Date): Prisma.EventBookingWhereInput => ({
  OR: [
    { status: { in: [BookingStatus.confirmed, BookingStatus.attended] } },
    { status: BookingStatus.held, hold_expires_at: { gt: now } },
  ],
});
```
  Apply it to every `eventBooking.aggregate({ _sum: { guests: true } })` in the file. **This is the change that makes 15-minute holds safe** — without it an abandoned checkout blocks a seat forever.

- [ ] Create `backend/src/events/event-holds.cron.ts` — sweep expired holds every five minutes, under an advisory lock:

```ts
@Injectable()
export class EventHoldsCron {
  private static readonly LOCK_ID = 570_102;
  private readonly logger = new Logger(EventHoldsCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredHolds(): Promise<void> {
    const [{ locked }] = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${EventHoldsCron.LOCK_ID}) AS locked`;
    if (!locked) return;
    try {
      const result = await this.prisma.eventBooking.updateMany({
        where: { status: BookingStatus.held, hold_expires_at: { lte: new Date() } },
        data: { status: BookingStatus.cancelled },
      });
      if (result.count > 0) this.logger.log(`Released ${result.count} expired booking holds`);
    } finally {
      await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${EventHoldsCron.LOCK_ID})`;
    }
  }
}
```

- [ ] Add attendance marking to `EventsService` (`OPS-04`, SPEC §5.2 step 5):

```ts
/**
 * Marks a booking `attended` or `no_show` on the day. `attended` also flips the
 * linked `OrderItem` to `attended` (so the review gate opens) and emits
 * `booking.attended`, which credits loyalty and sends the invitation.
 */
async markAttendance(eventId: string, dto: MarkAttendanceDto, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    const booking = await tx.eventBooking.findFirstOrThrow({
      where: { id: dto.booking_id, event_id: eventId },
      include: { order_item: { select: { id: true, order_id: true } } },
    });
    if (booking.status !== BookingStatus.confirmed) {
      throw new BadRequestException(`Only a confirmed booking can be marked ${dto.status}`);
    }
    const updated = await tx.eventBooking.update({
      where: { id: booking.id }, data: { status: dto.status },
    });
    if (booking.order_item) {
      await tx.orderItem.update({
        where: { id: booking.order_item.id },
        data: { status: dto.status === BookingStatus.attended
                  ? OrderItemStatus.attended : OrderItemStatus.cancelled },
      });
    }
    await this.audit.record(tx, {
      entity_type: 'event_booking', entity_id: booking.id, action: `booking.${dto.status}`,
      ...AuditService.user(userId),
      before: { status: booking.status }, after: { status: dto.status },
    });
    return { updated, orderId: booking.order_item?.order_id ?? null };
  });
}
```
  After the transaction commits, emit `booking.attended` (failure-isolated) when `dto.status === attended`, and — when an `orderId` exists — call `LoyaltyService.earnForOrder` through the same idempotent path Task 15 uses.

- [ ] `dto/mark-attendance.dto.ts` — `@IsUUID() booking_id`, `@IsIn([BookingStatus.attended, BookingStatus.no_show]) status`.
- [ ] Controller: `@Post(':id/attendance') @RequiresPermission(Permission.MANAGE_OPS)`.
- [ ] `event-holds.cron.spec.ts` — the lock is taken and released; `locked: false` short-circuits; only `held` rows with a past `hold_expires_at` are cancelled.
- [ ] Extend `events.service.spec.ts`: an expired hold does not occupy capacity; a live hold does; marking a `held` booking `attended` throws; marking a confirmed booking `attended` flips the linked `OrderItem`.
- [ ] `EventsModule` gains `LoyaltyModule` in imports and `EventHoldsCron` in providers.
- [ ] `cd backend && npx jest src/events --silent` — expect all green.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 77 passed, 77 total`.
- [ ] `git commit -m "feat(p5a-16): booking hold expiry sweep, hold-aware capacity, attendance marking" -- backend/src/events`

---

### Task 17: Staff customers API + `UsageEvent` recording (+ wave-5 `app.module`)

**Files:**
- Create: `backend/src/customers/customers.service.ts`, `customers.service.spec.ts`, `customers.controller.ts`, `customers.module.ts`
- Create: `backend/src/usage/usage.service.ts`, `usage.service.spec.ts`, `usage.controller.ts`, `usage.module.ts`, `dto/record-usage.dto.ts`
- Modify: `backend/src/app.module.ts` (**wave 5's single owner**)

- [ ] `customers.service.ts` — SPEC §9 `customers` (list, detail, loyalty is Task 7's endpoint):

```ts
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cursor-paginated, searchable by phone/name/email. Never returns OTP material. */
  async list(q?: string, cursor?: string, limit = 50) {
    const take = Math.min(Number(limit) || 50, 200);
    const rows = await this.prisma.customer.findMany({
      where: q ? { OR: [
        { phone: { contains: q } },
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ] } : undefined,
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      include: {
        loyalty_account: true,
        _count: { select: { orders: true, reviews: true, bookings: true } },
      },
    });
    return { items: rows.slice(0, take), next_cursor: rows.length > take ? rows[take - 1].id : null };
  }

  /** Profile + orders + loyalty ledger for the staff Customers screen (OPS-04). */
  async findOne(id: string) { /* customer + last 50 orders + loyalty account + last 50 loyalty transactions + reviews */ }
}
```

- [ ] `customers.service.spec.ts` — the search predicate covers all three fields; the cursor round-trips; `limit` is capped at 200; the response never contains a `password` or OTP key (assert on `JSON.stringify`).
- [ ] `usage.service.ts` — SPEC §8 `UsageEvent`:

```ts
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget: a usage write must never fail a user action. */
  record(input: { actor_type: ActorType; actor_id: string | null; role_code?: string | null;
                  event_type: string; path?: string | null; metadata?: Prisma.InputJsonValue }) {
    this.prisma.usageEvent
      .create({ data: { ...input, metadata: input.metadata ?? Prisma.JsonNull } })
      .catch((err) => this.logger.warn(`usage event dropped: ${(err as Error).message}`));
  }

  /** Admin panel feed: counts per role and per event type over a window. */
  async summary(days = 30) { /* two groupBy queries, bounded to `days` */ }
  async list(eventType?: string, cursor?: string, limit = 50) { /* cursor pagination */ }
}
```

- [ ] `usage.controller.ts`:

```ts
@Controller('usage')
export class UsageController {
  @Post()          @HttpCode(202) record(@Body() dto: RecordUsageDto, @Req() req) {}   // any authenticated user
  @Get()           @RequiresPermission(Permission.MANAGE_SYSTEM) list(@Query() q) {}
  @Get('summary')  @RequiresPermission(Permission.MANAGE_SYSTEM) summary(@Query('days') days?: string) {}
}
```
  `RecordUsageDto`: `@IsString() @Length(1, 64) event_type`, optional `@IsString() @MaxLength(256) path`, optional `@IsObject() metadata`. The controller fills `actor_type`/`actor_id`/`role_code` from `req.user` — **never** from the body.

- [ ] `usage.service.spec.ts` — `record` never rejects when the insert fails; `summary` bounds the window; `list` caps `limit` at 200.
- [ ] Register `CustomersModule` and `UsageModule` in `backend/src/app.module.ts`.
- [ ] `cd backend && npx jest src/customers src/usage --silent` — expect `Test Suites: 2 passed`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json && npx eslint "{src,apps,libs,test}/**/*.ts"` — 0 errors.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 79 passed, 79 total`.
- [ ] `git commit -m "feat(p5a-17): staff customers API and UsageEvent recording" -- backend/src/customers backend/src/usage backend/src/app.module.ts`

---

### Task 18: One migration `p5a_marketplace_backend`, hand-written SQL, seeds, drift gate, runtime smoke

**Files:**
- Create: `backend/prisma/migrations/20260824090000_p5a_marketplace_backend/migration.sql`
- Create: `backend/prisma/seed-data/demo-commerce.ts`
- Modify: `backend/prisma/seed-demo.ts`, `backend/src/prisma/seed-data.spec.ts`

> **Migration ordering is by directory timestamp, not by merge order.** Phase 31 (P3 mission bridge) is adding its own migration in parallel. This one is named `20260824090000_p5a_marketplace_backend`; Phase 31's must carry a *different* timestamp. If Phase 31 merges first with a **later** timestamp, regenerate this file with a timestamp after it (`prisma migrate dev --create-only` again) rather than editing the directory name by hand — Prisma records the applied name in `_prisma_migrations`.

- [ ] Confirm the database is reachable and currently at the P2 baseline:
```bash
cd backend && npx prisma migrate status
```
  Expect `1 migration found in prisma/migrations` and `Database schema is up to date!`.

- [ ] Generate the migration **without applying it** (`migrate reset` is unavailable to agents; `--create-only` is the supported path):
```bash
cd backend && npx prisma migrate dev --create-only --name p5a_marketplace_backend
```
  Expect a new directory `prisma/migrations/2026<date><time>_p5a_marketplace_backend/`. **Rename it to `20260824090000_p5a_marketplace_backend` only if the generated timestamp sorts before the P2 baseline** (it will not; the guard is for a clock-skewed machine).

- [ ] Verify the generated DDL before touching it:
```bash
cd backend/prisma/migrations/20260824090000_p5a_marketplace_backend
grep -c "CREATE TABLE" migration.sql          # expect 9
grep -c "CREATE TYPE" migration.sql           # expect 2  (RefundStatus, CouponStatus)
grep -c "DROP TABLE" migration.sql            # expect 0
grep -c "ALTER TABLE \"Order\" ADD COLUMN"    # expect 1  (coupon_id)
grep -n "ALTER TABLE \"Customer\"" migration.sql   # marketing_opt_in, last_seen_at
grep -n "ALTER TABLE \"OrderItem\"" migration.sql  # event_booking_id
```
  **If any `DROP TABLE` or `DROP COLUMN` appears, stop.** It means the working schema drifted from the P2 baseline in a way this plan did not intend; reconcile before continuing.

- [ ] Append the hand-written SQL Prisma cannot model. Add to the **end** of the same `migration.sql`:

```sql
-- ─── SPEC §5.4: review aggregation trigger (Product.rating_avg / rating_count) ──
CREATE OR REPLACE FUNCTION review_rating_rollup() RETURNS trigger AS $$
DECLARE
  target text;
BEGIN
  target := COALESCE(NEW."product_id", OLD."product_id");
  UPDATE "Product" p
     SET "rating_count" = COALESCE(agg.cnt, 0),
         "rating_avg"   = agg.avg
    FROM (
      SELECT count(*)::int AS cnt,
             CASE WHEN count(*) = 0 THEN NULL
                  ELSE round(avg("rating")::numeric, 2) END AS avg
        FROM "Review"
       WHERE "product_id" = target AND "status" = 'published'
    ) agg
   WHERE p."id" = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_rating_rollup_trg
  AFTER INSERT OR UPDATE OF "rating", "status", "product_id" OR DELETE
  ON "Review"
  FOR EACH ROW EXECUTE FUNCTION review_rating_rollup();

-- ─── SPEC §5.4: keep Product.search_text fresh when a category or brand is renamed
--     (extends the P2 product_search_text_refresh trigger; does not replace it) ──
CREATE OR REPLACE FUNCTION product_search_text_refresh_parent() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'ProductCategory' THEN
    UPDATE "Product" SET "updated_at" = "updated_at" WHERE "category_id" = NEW."id";
  ELSE
    UPDATE "Product" SET "updated_at" = "updated_at" WHERE "brand_id" = NEW."id";
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_category_rename_trg
  AFTER UPDATE OF "name" ON "ProductCategory"
  FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name")
  EXECUTE FUNCTION product_search_text_refresh_parent();

CREATE TRIGGER brand_rename_trg
  AFTER UPDATE OF "name" ON "Brand"
  FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name")
  EXECUTE FUNCTION product_search_text_refresh_parent();

-- ─── Money and rating integrity CHECKs ───────────────────────────────────────
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range"
  CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_window_valid"
  CHECK ("ends_at" > "starts_at");

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_value_non_negative"
  CHECK ("value" >= 0);

ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_balance_non_negative"
  CHECK ("points_balance" >= 0 AND "lifetime_points" >= 0);

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_weight_non_negative"
  CHECK ("weight_grams" >= 0);
```
  The rename trigger touches `updated_at` on the child rows, which fires the **existing** P2 `product_search_text_trg` (a `BEFORE UPDATE OF name, description, story, category_id, brand_id` trigger) — **verify that**: if the P2 trigger's column list does not include a column this `UPDATE` touches, it will not fire. If so, change the two statements to `UPDATE "Product" SET "name" = "name" WHERE …` (a no-op write to a watched column). Confirm with the smoke check below before committing.

- [ ] Apply the migration:
```bash
cd backend && npx prisma migrate deploy
```
  Expect `Applying migration \`20260824090000_p5a_marketplace_backend\`` and `All migrations have been successfully applied.`

- [ ] **Drift gate** — the schema and the two migrations must agree exactly:
```bash
cd backend && npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://konma:konma@localhost:5433/konma_shadow \
  --exit-code
```
  Expect exit code `0` and `No difference detected.` This also proves every hand-written statement replays cleanly, because `--from-migrations` executes both files into the shadow database first.

- [ ] Prove the hand-written SQL bites:
```bash
docker exec konma-postgres psql -U konma -d konma -c "SELECT tgname FROM pg_trigger WHERE tgname IN ('review_rating_rollup_trg','product_category_rename_trg','brand_rename_trg');"
docker exec konma-postgres psql -U konma -d konma -c "INSERT INTO \"Review\" (id,product_id,customer_id,order_item_id,rating,status) VALUES ('t','x','y','z',9,'published');"
```
  Expect three trigger rows, and `ERROR: … violates check constraint "Review_rating_range"` (the FK error is also acceptable — the point is the insert fails).

- [ ] Create `backend/prisma/seed-data/demo-commerce.ts` with the demo promotion and loyalty fixtures. Data only, no logic:

```ts
import type { CouponType, CouponStatus, ProductType } from '@prisma/client';

export interface DemoCouponSeed {
  code: string;
  description: string;
  type: CouponType;
  value: number;
  min_order: number | null;
  max_discount: number | null;
  applies_to: ProductType[];
  /** Days from the seed run; the seed converts to absolute timestamps. */
  starts_in_days: number;
  ends_in_days: number;
  usage_limit: number | null;
  per_customer_limit: number | null;
  status: CouponStatus;
}

export const DEMO_COUPONS: DemoCouponSeed[] = [
  { code: 'WELCOME10', description: '10% off your first Konma order', type: 'percent', value: 10,
    min_order: 500, max_discount: 200, applies_to: [], starts_in_days: -1, ends_in_days: 90,
    usage_limit: 500, per_customer_limit: 1, status: 'active' },
  { code: 'PANTRY150', description: '₹150 off packaged pantry goods', type: 'fixed', value: 150,
    min_order: 900, max_discount: null, applies_to: ['packaged'], starts_in_days: -1, ends_in_days: 60,
    usage_limit: 200, per_customer_limit: 2, status: 'active' },
  { code: 'SHIPFREE', description: 'Free shipping on packaged and merchandise orders', type: 'free_shipping',
    value: 0, min_order: 1200, max_discount: null, applies_to: ['packaged', 'merchandise'],
    starts_in_days: -1, ends_in_days: 30, usage_limit: null, per_customer_limit: 3, status: 'active' },
  { code: 'EXPIRED5', description: 'Expired coupon — proves the validity window is enforced',
    type: 'percent', value: 5, min_order: null, max_discount: null, applies_to: [],
    starts_in_days: -60, ends_in_days: -30, usage_limit: null, per_customer_limit: null, status: 'active' },
];

/** One demo customer with a loyalty balance, so the redeem path is walkable end-to-end. */
export const DEMO_LOYALTY_CUSTOMER = {
  phone: '919900000001',
  name: 'Demo Customer',
  email: 'demo.customer@konma.store',
  points_balance: 620,
  lifetime_points: 620,
  tier: 'regular' as const,
};
```

- [ ] Extend `backend/prisma/seed-demo.ts` with a `seedCommerce(tx)` step called from the same transaction as the catalog seed. It must be idempotent: coupons upsert on `code`, the customer upserts on `phone`, and the loyalty account upserts on `customer_id` with a single `LoyaltyTransaction(reason: adjust, order_id: null, notes: 'demo seed')` guarded by a `findFirst` so re-running does not double-credit. Extend the `[seed:demo] catalog done —` log line with `, N coupons, 1 loyalty account`.
- [ ] Extend `backend/src/prisma/seed-data.spec.ts`: coupon codes are unique and uppercase; every `ends_in_days > starts_in_days`; `free_shipping` coupons carry `value: 0`; `applies_to` members are valid `ProductType`s; `DEMO_LOYALTY_CUSTOMER.tier` matches the seeded `loyalty.tiers` thresholds for its `lifetime_points`.
- [ ] Run the seeds:
```bash
cd backend && npm run seed:reference && npm run seed:demo
```
  Expect the reference line to show `11 settings` and the demo line to end `, 4 coupons, 1 loyalty account`. Run `seed:reference` twice to re-prove idempotency.

- [ ] Static gates:
```bash
cd backend && npx prisma validate
cd backend && npx tsc --noEmit -p tsconfig.build.json
cd backend && npx eslint "{src,apps,libs,test}/**/*.ts"
cd backend && npx jest --silent
cd backend && npm run build
```
  Expect: schema valid · tsc exit 0 · **0 errors** from eslint · `Test Suites: 79 passed, 79 total` · `dist/src/main.js` present.

- [ ] Runtime smoke against the seeded database (`PORT=4018 node dist/src/main.js`). Record every status in the phase summary:

| # | Request | Expect |
|---|---|---|
| 1 | `GET /catalog/products?limit=5` | 200, envelope `{ items, next_cursor }`, no `computed_cost` key |
| 2 | `GET /catalog/search?q=coconut&type=packaged` | 200, `{ items, facets: { types, categories }, next_cursor }` |
| 3 | `GET /catalog/products/:id/reviews` | 200, `[]` |
| 4 | `POST /customer-auth/send-otp` → `verify-otp` for `919900000001` | 200/201, customer session cookie |
| 5 | `POST /customer/cart/sync` with one `prepared_food`, one `packaged`, one `experience` line | 200, every line priced by the server, `totals.subtotal` present |
| 6 | `POST /customer/checkout/quote` `{channel:"delivery", delivery_address_id, coupon_code:"WELCOME10", redeem_points:100}` | 200, `discount` > 0, `shipping` present, one `holds[]` entry, `total = subtotal − discount − loyalty + shipping` |
| 7 | `POST /customer/coupons/validate` `{code:"EXPIRED5"}` | 400 `This coupon has expired` |
| 8 | `POST /customer/orders` `{quote_id}` | 201, `{ razorpay_order_id, amount }` with `amount` in paise equal to the quote total |
| 9 | `GET /promotions/coupons` (staff) | 200, 4 coupons with redemption counts |
| 10 | `GET /shipments` (staff) | 200, `{ items: [], next_cursor: null }` |
| 11 | `POST /webhooks/shiprocket` with a wrong token | 401 |
| 12 | `POST /webhooks/shiprocket` with the right token and an unknown AWB | 200 `{ status: "ignored" }` |
| 13 | `GET /customer/loyalty` | 200, `points_balance: 620`, `tier: "regular"` |
| 14 | `GET /customers?q=99000` (staff) | 200, the demo customer with `_count.orders` |
| 15 | `GET /usage/summary` (admin) | 200 |
| 16 | `GET /audit?entity_type=order&limit=5` | 200 |

- [ ] Prove the search rename trigger works (the caveat above):
```bash
docker exec konma-postgres psql -U konma -d konma -c "UPDATE \"ProductCategory\" SET name = name || ' X' WHERE slug IS NOT NULL AND id = (SELECT id FROM \"ProductCategory\" LIMIT 1); SELECT left(search_text, 80) FROM \"Product\" LIMIT 1;"
```
  The category's new name must appear in `search_text`. If it does not, switch the trigger body to the `SET "name" = "name"` form described above and re-run.

- [ ] `git commit -m "feat(p5a-18): single p5a migration with review rollup trigger, CHECKs, demo coupons and loyalty seed" -- backend/prisma`
- [ ] Write the walk-through record to `.planning/phases/33-p5a-marketplace-backend/33-01-SUMMARY.md` (SPEC §11 requires a recorded human walk-through per sub-project). Not part of this commit.

---

## API contract appendix (Phase 34 builds from this)

**Conventions.** All JSON. Money is a **number in rupees** with 2 decimals — `DecimalSerializationInterceptor` (`main.ts:119`) converts every `Prisma.Decimal` to `.toNumber()`, so never expect a string. Timestamps are ISO-8601 UTC. Staff routes sit behind the global `JwtAuthGuard` + `PermissionsGuard` (cookie session, permission named per route). Customer routes are `@Public()` + `@UseGuards(CustomerGuard)` (customer JWT cookie) — the customer token can never reach a staff route. Errors use the existing envelope: `{ statusCode, message, error }`. Every list route accepts `cursor` and `limit` (default 50, max 200) and returns `{ items, next_cursor }`.

### A. Public catalog (no auth, cached 60 s)

| Method | Path | Query | Notes |
|---|---|---|---|
| GET | `/catalog/products` | `type`, `category_id`, `brand_id`, `cursor`, `limit` | **CHANGED** — was a bare array, now an envelope |
| GET | `/catalog/products/slug/:slug` | — | unchanged shape |
| GET | `/catalog/products/:id/reviews` | `cursor`, `limit` | **NEW** — published reviews only |
| GET | `/catalog/categories` | `brand_id` | unchanged |
| GET | `/catalog/search` | `q`, `type`, `category_id`, `cursor`, `limit` | **CHANGED** — adds facets + cursor |
| GET | `/catalog/availability` | — | unchanged |

`GET /catalog/products` → `200`
```json
{
  "items": [{
    "id": "uuid", "name": "Cold-Pressed Coconut Oil", "slug": "cold-pressed-coconut-oil",
    "type": "packaged", "fulfilment": "shipped", "stock_mode": "tracked",
    "base_price": 649, "tax_rate": 12, "hsn_code": "15131100",
    "description": "…", "story": "…", "is_featured": true,
    "rating_avg": 4.6, "rating_count": 18,
    "weight_grams": 550, "shelf_life_days": 365, "status": "active",
    "media": [{ "id": "uuid", "url": "https://cdn…/oil.jpg", "alt": "…", "kind": "image", "sort_order": 0 }],
    "variants": [{ "id": "uuid", "name": "500 ml", "sku": "KX-OIL-500", "price_delta": 0, "is_default": true }],
    "category": { "id": "uuid", "name": "Pantry", "slug": "pantry", "brand_id": "uuid" },
    "event": null
  }],
  "next_cursor": "uuid-of-last-row"
}
```
No `computed_cost`, `yield_qty`, `RecipeLines`, `margin` or `cost_per_unit` key ever appears here (`CAT-03`, asserted by a test).

`GET /catalog/search?q=coconut&type=packaged` → `200`
```json
{
  "items": [{ "id": "uuid", "name": "…", "slug": "…", "type": "packaged",
              "base_price": 649, "rating_avg": 4.6, "rating_count": 18, "rank": 0.0607927 }],
  "facets": {
    "types": [{ "type": "packaged", "count": 3 }, { "type": "merchandise", "count": 1 }],
    "categories": [{ "category_id": "uuid", "name": "Pantry", "count": 3 }]
  },
  "next_cursor": "MjA="
}
```

`GET /catalog/products/:id/reviews` → `200`
```json
{ "items": [{ "id": "uuid", "rating": 5, "title": "Excellent", "body": "…",
              "media": [], "created_at": "2026-08-20T09:14:00.000Z",
              "customer": { "name": "Aditi R." } }],
  "next_cursor": null }
```

### B. Customer cart and checkout (`CustomerGuard`)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/customer/cart` | — | **CHANGED** — server-priced |
| POST | `/customer/cart/sync` | `SyncCartDto` | **CHANGED** — returns prices, availability, totals |
| DELETE | `/customer/cart` | — | unchanged |
| POST | `/customer/checkout/quote` | `QuoteCheckoutDto` | **NEW** |
| POST | `/customer/coupons/validate` | `{ code, channel? }` | **NEW** |
| GET | `/customer/loyalty` | — | **NEW** |
| POST | `/customer/orders` | `{ quote_id, idempotency_key? }` | **CHANGED** — was an empty body |
| POST | `/customer/orders/confirm` | unchanged DTO | **CHANGED** — richer response |
| GET | `/customer/orders/:id/shipment` | — | **NEW** |
| GET/POST | `/customer/reviews`, `/customer/reviews/pending` | `CreateReviewDto` | **NEW** |

`POST /customer/cart/sync` → `200`
```json
{
  "items": [{
    "productId": "uuid", "variantId": "uuid|null", "name": "Konma Signature Thali",
    "quantity": 2, "unitPrice": 450, "imageUrl": "https://…",
    "fulfilment": "local", "available": true, "unavailable_reason": null
  }],
  "channel": "delivery", "deliveryAddressId": "uuid|null",
  "updatedAt": "2026-08-24T06:00:00.000Z",
  "totals": { "subtotal": 900, "tax_total": 42.86 }
}
```

`POST /customer/checkout/quote`
```json
{ "channel": "delivery", "delivery_address_id": "uuid", "pickup": false,
  "coupon_code": "WELCOME10", "redeem_points": 100 }
```
→ `200`
```json
{
  "quote_id": "uuid",
  "expires_at": "2026-08-24T06:15:00.000Z",
  "channel": "delivery",
  "pickup": false,
  "lines": [
    { "product_id": "uuid", "variant_id": null, "name": "Konma Signature Thali", "sku": null,
      "quantity": 2, "type": "prepared_food", "fulfilment": "local",
      "unit_price": 450, "gross": 900, "tax_rate": "5.00", "tax": 42.86 },
    { "product_id": "uuid", "variant_id": "uuid", "name": "Cold-Pressed Coconut Oil — 500 ml",
      "sku": "KX-OIL-500", "quantity": 1, "type": "packaged", "fulfilment": "shipped",
      "unit_price": 649, "gross": 649, "tax_rate": "12.00", "tax": 69.54 },
    { "product_id": "uuid", "variant_id": null, "name": "Chef's Table Dinner", "sku": null,
      "quantity": 2, "type": "experience", "fulfilment": "booking",
      "unit_price": 2500, "gross": 5000, "tax_rate": "5.00", "tax": 238.10 }
  ],
  "rejected": [{ "product_id": "uuid", "name": "Linen Apron", "reason": "Only 0 left" }],
  "subtotal": 6549,
  "coupon": { "code": "WELCOME10", "type": "percent", "discount": 200 },
  "discount_amount": 200,
  "shipping": { "provider": "shiprocket", "courier_name": "Delhivery",
                "courier_id": "12", "etd": "2026-08-27T18:00:00.000Z", "serviceable": true },
  "shipping_amount": 79,
  "tax_amount": 350.50,
  "tax_breakup": [{ "rate": "5.00", "taxable": 5619.04, "tax": 280.96 },
                  { "rate": "12.00", "taxable": 579.46, "tax": 69.54 }],
  "loyalty": { "balance": 620, "tier": "regular", "max_redeemable_points": 254,
               "points_applied": 100, "redeem_amount": 25, "redeem_value_per_point": 0.25,
               "points_earned_estimate": 30 },
  "holds": [{ "booking_id": "uuid", "event_id": "uuid", "product_id": "uuid",
              "guests": 2, "expires_at": "2026-08-24T06:15:00.000Z" }],
  "total": 6403
}
```
`total = subtotal − discount_amount − loyalty.redeem_amount + shipping_amount`. **`tax_amount` is contained inside `subtotal` and is never added** (decision 1). Errors: `400` cart empty · `400` nothing available · `400` pincode not serviced · `400` coupon message · `503` Redis down.

`POST /customer/coupons/validate` `{ "code": "WELCOME10" }` → `200`
```json
{ "valid": true, "code": "WELCOME10", "type": "percent", "discount": 200, "free_shipping": false }
```
Invalid codes return `400` with the human message (`Invalid coupon code`, `This coupon has expired`, `Add ₹150.00 more to use this coupon`, `You have already used this coupon`, `This coupon applies to shipped items only`).

`GET /customer/loyalty` → `200`
```json
{
  "points_balance": 620, "lifetime_points": 620, "tier": "regular",
  "redeem_value_per_point": 0.25,
  "next_tier": { "tier": "insider", "points_needed": 1380 },
  "transactions": [{ "id": "uuid", "delta": 30, "balance_after": 620, "reason": "earn",
                     "order_id": "uuid", "expires_at": "2027-08-24T00:00:00.000Z",
                     "created_at": "2026-08-24T06:20:00.000Z" }]
}
```

`POST /customer/orders` `{ "quote_id": "uuid", "idempotency_key": "abc123" }` → `201`
```json
{ "razorpay_order_id": "order_Xyz", "amount": 640300, "currency": "INR" }
```
`amount` is **paise** (Razorpay's unit). Errors: `400` quote expired / price changed / item gone · `503` Redis down.

`POST /customer/orders/confirm` (DTO unchanged: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`) → `201`
```json
{
  "id": "uuid", "order_number": 1042, "status": "placed", "channel": "delivery",
  "subtotal": 6549, "discount_amount": 225, "shipping_amount": 79, "tax_amount": 350.5,
  "total": 6403, "coupon_id": "uuid",
  "loyalty_points_redeemed": 100, "loyalty_points_earned": 0,
  "items": [{ "id": "uuid", "product_id": "uuid", "variant_id": null, "quantity": 2,
              "unit_price": 450, "tax_rate": 5, "fulfilment": "local", "status": "pending",
              "event_booking_id": null, "product": { "id": "uuid", "name": "Konma Signature Thali" } }],
  "payment": { "id": "uuid", "method": "razorpay", "amount": 6403, "status": "paid",
               "refunded_amount": 0, "razorpay_payment_id": "pay_Abc" }
}
```
`discount_amount` on the order is `coupon discount + loyalty redeem value` (225 = 200 + 25) — the two reductions are one column in the schema. Replaying the same payment returns the **same** order (`200`/`201`, `razorpay_payment_id @unique` → P2002 → existing row).

`GET /customer/orders/:id/shipment` → `200` (or `null` when the order has no shipped lines)
```json
{
  "id": "uuid", "status": "in_transit", "provider": "shiprocket",
  "awb": "1234567890", "courier_name": "Delhivery",
  "tracking_url": "https://shiprocket.co/tracking/1234567890",
  "etd": "2026-08-27T18:00:00.000Z", "weight_grams": 550,
  "events": [{ "status": "in_transit", "occurred_at": "2026-08-25T09:00:00.000Z" },
             { "status": "picked_up",  "occurred_at": "2026-08-24T18:30:00.000Z" }]
}
```

`POST /customer/reviews` `{ "order_item_id": "uuid", "rating": 5, "title": "…", "body": "…", "media": [] }` → `201`
```json
{ "id": "uuid", "product_id": "uuid", "order_item_id": "uuid", "rating": 5,
  "status": "published", "created_at": "2026-08-28T10:00:00.000Z" }
```
`400` when the item is not `delivered`/`attended` · `403` other customer · `409` already reviewed.

`GET /customer/reviews/pending` → `200`
```json
[{ "order_item_id": "uuid", "product": { "id": "uuid", "name": "…", "slug": "…" },
   "order": { "id": "uuid", "order_number": 1042, "created_at": "…" } }]
```

### C. Staff commerce

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET/POST | `/promotions/coupons` | `MANAGE_OPS` | **NEW** |
| PATCH/DELETE | `/promotions/coupons/:id` | `MANAGE_OPS` | **NEW** (DELETE = disable) |
| GET | `/shipments` | `MANAGE_OPS` | **NEW** — `?status=&cursor=&limit=` |
| GET | `/shipments/:id` | `MANAGE_OPS` | **NEW** |
| POST | `/shipments/pack` | `MANAGE_OPS` | **NEW** |
| POST | `/shipments/:id/awb` | `MANAGE_OPS` | **NEW** |
| POST | `/shipments/:id/pickup` | `MANAGE_OPS` | **NEW** |
| GET | `/shipments/:id/label` | `MANAGE_OPS` | **NEW** |
| POST | `/shipments/:id/cancel` | `MANAGE_OPS` | **NEW** |
| POST | `/orders/:id/refund` | `MANAGE_POS` | **NEW** |
| GET | `/orders/:id/refunds` | `MANAGE_POS` | **NEW** |
| POST | `/orders/:id/complete` | `MANAGE_POS` | **NEW** |
| PATCH | `/orders/:id/status` | `MANAGE_POS` | **CHANGED** — new transitions |
| GET | `/reviews` | `MANAGE_OPS` | **NEW** — `?status=pending` |
| PATCH | `/reviews/:id/publish` \| `/hide` | `MANAGE_OPS` | **NEW** |
| GET | `/customers` | `MANAGE_OPS` | **NEW** — `?q=&cursor=&limit=` |
| GET | `/customers/:id` | `MANAGE_OPS` | **NEW** |
| POST | `/customers/:id/loyalty-adjust` | `MANAGE_OPS` | **NEW** |
| POST | `/events/:id/attendance` | `MANAGE_OPS` | **NEW** |
| GET/POST | `/usage`, `/usage/summary` | `MANAGE_SYSTEM` / any auth for POST | **NEW** |

`POST /promotions/coupons`
```json
{ "code": "WELCOME10", "description": "10% off your first order", "type": "percent",
  "value": 10, "min_order": 500, "max_discount": 200, "applies_to": [],
  "starts_at": "2026-08-01T00:00:00.000Z", "ends_at": "2026-11-01T00:00:00.000Z",
  "usage_limit": 500, "per_customer_limit": 1, "status": "active" }
```
→ `201` with the row plus `"_count": { "redemptions": 0 }`. `GET /promotions/coupons` returns `{ items: [...], next_cursor }` with the same `_count`.

`POST /shipments/pack` `{ "order_id": "uuid", "weight_grams": 550, "pickup_location_code": "KONMA-VILLA" }` → `201`
```json
{ "id": "uuid", "order_id": "uuid", "provider": "shiprocket", "status": "pending",
  "pickup_location_code": "KONMA-VILLA", "weight_grams": 550,
  "awb": null, "courier_name": null, "label_url": null, "tracking_url": null,
  "packed_by": "uuid", "created_at": "…" }
```
Packing twice returns the same shipment (`200`). `400` when the order has no shipped lines.

`POST /shipments/:id/awb` — body is used only by the `manual` provider:
```json
{ "awb": "MANUAL-0042", "courier_name": "Local courier", "tracking_url": "https://…" }
```
→ `200` with `status: "awb_assigned"` and the shipment row. With the `shiprocket` provider the body is ignored; `provider_order_id`, `provider_shipment_id`, `awb` and `courier_name` come from the API. `400` on an illegal transition; `503` when Shiprocket is unreachable.

`GET /shipments/:id/label` → `200 { "label_url": "https://…pdf" }` · `400` when no AWB is assigned.

`POST /shipments/:id/cancel` `{ "reason": "Customer cancelled" }` → `200` with `status: "cancelled"`.

`POST /orders/:id/refund`
```json
{ "amount": 649, "reason": "Damaged in transit" }
```
(omit `amount` for a full refund) → `201`
```json
{ "id": "uuid", "order_id": "uuid", "payment_id": "uuid", "amount": 649,
  "reason": "Damaged in transit", "razorpay_refund_id": "rfnd_Abc",
  "status": "processed", "requested_by": "uuid", "created_at": "…" }
```
Side effects: `Payment.refunded_amount` accumulates; `Payment.status` becomes `partially_refunded` or `refunded`; a full refund sets `Order.status = refunded`; `AuditEvent(action: 'order.refunded')`. Errors: `400` no payment · `400` non-Razorpay method · `400` over the refundable balance · `400` gateway failure (the `Refund` row stays `failed`).

`PATCH /orders/:id/status` `{ "status": "shipped" }` → `200`. Legal moves are listed in Task 15; anything else returns `400 Cannot move an order from X to Y`. Reaching `delivered` credits loyalty and fires the review invitation.

`GET /reviews?status=pending` → `200 { items, next_cursor }` with `product` and `customer` names included.
`PATCH /reviews/:id/publish` → `200` with `status: "published"`, `moderated_by`, `moderated_at`; the `Product.rating_avg`/`rating_count` rollup runs in the database trigger.

`GET /customers?q=99000` → `200`
```json
{ "items": [{ "id": "uuid", "phone": "919900000001", "name": "Demo Customer",
              "email": "demo.customer@konma.store", "marketing_opt_in": false,
              "last_seen_at": "2026-08-24T06:00:00.000Z",
              "loyalty_account": { "points_balance": 620, "tier": "regular" },
              "_count": { "orders": 3, "reviews": 1, "bookings": 1 } }],
  "next_cursor": null }
```
`GET /customers/:id` adds `orders` (last 50, with items and payment), `loyalty_transactions` (last 50) and `reviews`.

`POST /customers/:id/loyalty-adjust` `{ "delta": -50, "notes": "Goodwill correction" }` → `200` with the new account row; always writes `LoyaltyTransaction(reason: adjust)` and `AuditEvent(action: 'loyalty.adjusted')`.

`POST /events/:id/attendance` `{ "booking_id": "uuid", "status": "attended" }` → `200`. `attended` flips the linked `OrderItem` to `attended` (opening the review gate) and fires `booking.attended`.

`GET /usage/summary?days=30` → `200`
```json
{ "days": 30,
  "by_role": [{ "role_code": "FRONTEND_LEAD", "count": 412 }],
  "by_event": [{ "event_type": "page_view", "count": 3180 }] }
```
`POST /usage` `{ "event_type": "page_view", "path": "/tasks", "metadata": { "ms": 120 } }` → `202` (no body). Actor fields come from the session, never the body.

### D. Webhooks

`POST /webhooks/shiprocket` — **NEW**. Header `x-konma-webhook-token: <SHIPROCKET_WEBHOOK_TOKEN>`. Body (Shiprocket tracking payload):
```json
{ "awb": "1234567890", "current_status": "OUT FOR DELIVERY", "current_status_id": 17,
  "order_id": "1042", "courier_name": "Delhivery", "etd": "2026-08-27 18:00",
  "current_timestamp": "2026-08-26 08:12:00",
  "scans": [{ "date": "2026-08-26 08:12:00", "activity": "Out for delivery", "status": "OFD", "location": "Delhi" }] }
```
→ `200 { "status": "ok", "shipment_status": "out_for_delivery" }` · `200 { "status": "ignored", "reason": "unknown awb" }` · `401` bad token · `403` when `SHIPROCKET_WEBHOOK_TOKEN` is unset. Idempotent on `(shipment_id, status, occurred_at)`.

`POST /webhooks/razorpay` — contract **unchanged**; the `refund.processed` branch now writes/reconciles a `Refund` row, accumulates `Payment.refunded_amount`, and distinguishes `partially_refunded` from `refunded`.

### E. Breaking changes Phase 34 must handle

1. `GET /catalog/products` and `GET /catalog/search` return `{ items, next_cursor }` instead of a bare array.
2. `POST /customer/orders` now requires a body (`{ quote_id }`) — the old empty-body call returns `400`.
3. `POST /customer/cart/sync` items gain `fulfilment`, `available`, `unavailable_reason`, and the response gains `totals`.
4. Money is a **number**, not a string, everywhere.
5. `Order.discount_amount` bundles coupon discount **and** loyalty redemption value; the split lives in `Order.coupon_id` + `Order.loyalty_points_redeemed` (and the `CouponRedemption` row).

---

## Execution partition (parallel Opus implementers, isolated worktrees)

**Rules for every agent**
- `model: "opus"` on every implementation subagent (harness preference).
- One agent per task, in its own worktree branched from the wave's base commit; merge the wave, run the full gate, then start the next wave.
- **`git commit -- <paths>` only.** Never `git add -A`.
- Gates after every task: `npx jest --silent`, `npx tsc --noEmit -p tsconfig.build.json`, `npx eslint "{src,apps,libs,test}/**/*.ts"` (0 errors). The wave is not merged until all of its tasks are green individually **and** the merged tree is green.
- **Single-owner files** — an agent that needs a change in a file it does not own must stop and report, not edit it:

| File | Sole owner |
|---|---|
| `backend/prisma/schema.prisma` | Task 1 |
| `backend/src/test-utils/mock-providers.ts` | Task 1 |
| `backend/src/settings/settings.service.ts`, `backend/prisma/seed-data/settings.ts` | Task 2 |
| `backend/src/checkout/quote.types.ts` | Task 5 (frozen after wave 2) |
| `backend/src/config/env.validation.ts`, `backend/.env.example` | Task 3 |
| `backend/src/app.module.ts` | Task 7 (wave 2) · Task 11 (wave 3) · Task 12 (wave 4) · Task 17 (wave 5) |
| `backend/src/webhooks/webhooks.controller.ts`, `webhooks.module.ts` | Task 12 |
| `backend/src/webhooks/webhooks.service.ts` | Task 13 |
| `backend/src/main.ts` | **nobody** — P5a does not touch it (decision 9) |
| `backend/prisma/migrations/**` | Task 18 |

### Wave 1 — foundations (4 agents, no dependencies between them)

| Task | Owns |
|---|---|
| **1** Schema + jest registry | `backend/prisma/schema.prisma`, `src/test-utils/mock-providers.ts`, `src/prisma/commerce-schema.spec.ts` |
| **2** Money + settings + event names | `src/common/money/**`, `src/common/events/commerce-events.ts`, `src/settings/settings.service.ts`, `prisma/seed-data/settings.ts` |
| **3** Shipping providers + env | `src/shipping/**`, `src/config/env.validation.ts`, `src/config/env.validation.spec.ts`, `backend/.env.example` |
| **4** Catalog cache/search/facets | `src/catalog/**` |

Task 3 compiles without Task 1 because it is typed against `shipping.types.ts` (decision 11). Task 4 needs no new model. Merge order inside the wave is irrelevant — the four file sets are disjoint.

### Wave 2 — pricing and promotions (3 agents; base = merged wave 1)

| Task | Owns | Needs |
|---|---|---|
| **5** Cart pricing + `quote.types.ts` | `src/checkout/quote.types.ts`, `cart-pricing.service.ts(.spec)` | T1 (models), T2 (money), T4 (`CatalogService.getAllServingsAvailable`) |
| **6** Coupons | `src/promotions/**` | T1, T2, T5's `PricedLine` type |
| **7** Loyalty + wave `app.module` | `src/loyalty/**`, `src/app.module.ts` | T1, T2 |

Task 6 imports `PricedLine` from Task 5. To keep them parallel, **Task 5 lands `quote.types.ts` first as its opening step**, and Task 6's agent starts from that commit; if the orchestrator prefers strict parallelism, Task 6 may declare a local structural type and swap the import at merge — the reviewer must confirm the swap happened.

### Wave 3 — the money pipeline (4 agents; base = merged wave 2)

| Task | Owns | Needs |
|---|---|---|
| **8** Quote endpoint | `src/checkout/checkout.service.ts(.spec)`, `checkout.controller.ts`, `checkout.module.ts`, `dto/**` | T3, T5, T6, T7 |
| **9** Pay from quote | `src/customer-orders/**` | T5, T8 (`readQuote`, `quoteKey`) |
| **10** Confirm extension | `src/fulfilment/**` | T5 (`PendingOrderV2`), T7 (`redeemForOrder`) |
| **11** Shipments queue + wave `app.module` | `src/shipments/**`, `src/app.module.ts` | T1, T2, T3 |

Tasks 9 and 10 both read `PendingOrderV2` from Task 5's frozen `quote.types.ts` and never edit each other's files. Task 9 calls `CheckoutService.readQuote`; if Task 8 has not merged, its agent stubs the two-method interface and the merge resolves the import.

### Wave 4 — lifecycle and after-sales (5 agents; base = merged wave 3)

| Task | Owns | Needs |
|---|---|---|
| **12** Shiprocket webhook + wave `app.module` | `src/webhooks/shiprocket-webhook.service.ts(.spec)`, `webhooks.controller.ts`, `webhooks.module.ts`, `src/customer-auth/whatsapp.service.ts`, `src/app.module.ts` | T11 (`applyStatus`) |
| **13** Refunds | `src/refunds/**`, `src/webhooks/webhooks.service.ts(.spec)` | T1, T2 |
| **14** Reviews | `src/reviews/**` | T1, T2 |
| **15** Order lifecycle | `src/orders/**` | T7 (`earnForOrder`) |
| **16** Experiences | `src/events/**` | T1, T7 |

Tasks 12 and 13 both live under `src/webhooks/` but touch **disjoint files** (controller/module vs service). Tasks 14, 15 and 16 do not import each other: the review invitation is wired by an `@OnEvent` listener in Task 14, so Tasks 15 and 16 only emit event names from Task 2's `commerce-events.ts`.

### Wave 5 — admin surfaces (1 agent)

| Task | Owns |
|---|---|
| **17** Customers + usage + wave `app.module` | `src/customers/**`, `src/usage/**`, `src/app.module.ts` |

### Wave 6 — database (1 agent, strictly last)

| Task | Owns |
|---|---|
| **18** Migration, hand-written SQL, seeds, drift gate, smoke | `backend/prisma/migrations/**`, `prisma/seed-data/demo-commerce.ts`, `prisma/seed-demo.ts`, `src/prisma/seed-data.spec.ts` |

Task 18 must run against the **fully merged** tree: the migration is generated from the final `schema.prisma`, so any earlier wave still unmerged would produce an incomplete migration.

### Cross-phase collisions (Phases 31 and 32 run concurrently)

| Risk | Mitigation |
|---|---|
| Phase 31 also writes `backend/src/common/events/domain-events.ts` | P5a uses `commerce-events.ts` — a different file. Post-merge follow-up: `domain-events.ts` re-exports `CommerceEvent`, and P5a's imports switch over. One line, no behaviour change. |
| Phase 31 also adds a migration | Timestamps order migrations, not merge order. P5a is `20260824090000_p5a_marketplace_backend`. If Phase 31's timestamp is later and it merges first, regenerate P5a's with `migrate dev --create-only` rather than renaming. |
| Phase 32 may declare `UsageEvent` | P5a declares it (Task 1, per the brief). Whichever phase merges second deletes its duplicate model block and keeps the other's; the field set above is the one Phase 32's `UsageService` was specified against. |
| Phase 32 edits `app.module.ts` | Different import lines; a textual conflict at worst. Resolve by keeping both import blocks. |
| Phase 31 edits `orders.service.ts` to emit bridge events | P5a Task 15 also edits it. Both changes are additive (new transitions vs new emits); resolve by keeping both. Flag to the Phase 31 planner. |

---

## Self-review

### SPEC coverage → task

| SPEC item | Task |
|---|---|
| §3.3 `Shipment`, `ShipmentEvent` | 1 (model), 11 (service), 12 (webhook) |
| §3.3 `Refund` | 1, 13 |
| §3.3 `Coupon`, `CouponRedemption` | 1, 6, 10 |
| §3.3 `LoyaltyAccount`, `LoyaltyTransaction` | 1, 7, 10, 15 |
| §3.3 `Review` | 1, 14, 18 (rollup trigger) |
| §3.3 `UsageEvent` | 1, 17 |
| §3.3 `Order.coupon_id`, money columns populated | 1, 10 |
| §3.3 `OrderItem.fulfilment` derived, `tax_rate` per line, `event_booking_id` | 1, 5, 10 |
| §3.3 `Customer.marketing_opt_in`, `last_seen_at` | 1 |
| §3.3 cart in Redis with `productId/variantId/fulfilment`, mixed fulfilment | 5, 9 |
| §5.2.1 server-priced cart, availability per type, rejects unavailable lines | 5 |
| §5.2.2 `POST /customer/checkout/quote` — pincode/serviceability/holds/itemised response | 8 |
| §5.2.3 `POST /customer/orders` → Razorpay + `pending_order:{id}` 30 min | 9 |
| §5.2.4 idempotent confirm, GETDEL under lock, Serializable, P2002 → existing order, per-line routing, coupon + loyalty in the same transaction, webhook uses the same service | 9, 10 |
| §5.2.5 shipped → pack → `Shipment` → create/AWB/pickup/label → tracking webhook → `Order.status` + Pusher + WhatsApp | 11, 12 |
| §5.2.5 booking → `EventBooking.confirmed`; attendance from Events admin | 8, 10, 16 |
| §5.2.6 review invitation, loyalty credited after delivery/attendance | 14, 15, 16 |
| §5.2.7 `POST /orders/:id/refund`, `Refund` row, `refund.processed` reconciliation | 13 |
| §5.3 `ShippingProvider` interface, `ShiprocketAdapter` (token cached ~9 d), `ManualProvider`, `SystemSetting['shipping']` | 2 (setting), 3 |
| §5.3 `POST /webhooks/shiprocket`, shared secret, idempotent on `(awb, status, occurred_at)` | 1 (unique), 12 |
| §5.4 coupons server-only, no stacking, `free_shipping` on shipped lines only | 6, 8 |
| §5.4 loyalty settings, earn on delivered/attended, 365-day expiry job | 2, 7, 15, 16 |
| §5.4 reviews one per `order_item`, auto-publish ≥ 4, `rating_avg/count` by trigger | 14, 18 |
| §5.4 search tsvector + GIN + trigger, `GET /catalog/search` with type/category facets | 4, 18 |
| §8 public catalog never returns cost/yield/BOM/margin | 4 (asserted test) |
| §8 crons under `pg_try_advisory_lock`; every webhook idempotent | 7, 12, 16 |
| §8 `UsageEvent` feeding an admin usage panel | 17 |
| §9 new staff endpoints (`promotions/coupons`, `reviews`, `shipments`, `orders/:id/refund`, `customers`, `events/:id/attendance`, `usage`) | 6, 11, 13, 14, 16, 17 |
| §9 new customer endpoints (`catalog/*` cached, `checkout/quote`, `coupons/validate`, `loyalty`, `reviews`, `orders/:id/shipment`) | 4, 8, 9, 14 |
| §9 every list endpoint takes `cursor`/`limit` (default 50, max 200) | 4, 6, 11, 14, 17 |
| §10 unit tests per service; money never float | every task |

### REQUIREMENTS id → task

| Id | Task | Id | Task |
|---|---|---|---|
| CAT-01 | 4 (P2 shipped CRUD; this adds cache/pagination) | SHIP-04 | 1, 12 |
| CAT-02 | 4, 5 | SHIP-05 | 9, 12 |
| CAT-03 | 4 | PROMO-01 | 1, 6 |
| CAT-04 | 8, 10, 16 | PROMO-02 | 6, 8, 10 |
| CHK-01 | 5, 9 | LOYAL-01 | 1, 2, 7, 17 |
| CHK-02 | 8 | LOYAL-02 | 7, 8, 10, 15, 16 |
| CHK-03 | 9 | REV-01 | 1, 14, 18 |
| CHK-04 | 10 | REV-02 | 14 |
| CHK-05 | 13 | SRCH-01 | 4, 18 |
| SHIP-01 | 3 | QA-05 | every task's spec; the integration list below |
| SHIP-02 | 2, 3, 11 | | |
| SHIP-03 | 11 | | |

### Deferrals — what does **not** land here

| Deferred | To | Why |
|---|---|---|
| Every storefront route (`/shop`, `/p/[slug]`, `/experiences`, `/search`, `/cart`, `/checkout`, `/account/*`, `/feedback/[orderId]`, `/orders/[id]/track`), JSON-LD, sitemap, robots, the `/menu` → `/shop` redirect | **34** | `STORE-01…04`, `ACCT-01/02` are P5b by ROADMAP |
| Every staff screen (Catalog admin, Promotions, Reviews moderation, Shipments queue UI, Orders detail with refunds, Experiences, Customers) | **34** | `OPS-01…05`; this phase ships only their APIs, fully specified in the appendix |
| Product media **upload** UI and the R2 presign flow for catalog media | **34** | P2 follow-up #6; `POST /catalog/products/:id/media` already accepts a URL |
| Variant selection in the frontend cart | **34** | P2 follow-up #1; the backend already carries `variantId` end to end |
| Playwright smoke test 2 (`browse → three fulfilment types → coupon → pay → confirm → track`) | **34** | Needs the storefront; Task 18's runtime smoke covers the API half |
| `test/jest-integration.json` suite against a real Postgres (order confirm, fulfilment, shipment lifecycle, coupon, loyalty, review) | **34** or a P5a follow-up | The integration harness is `QA-05`'s second half and does not exist yet (`test/` has only `jest-e2e.json`); standing it up is its own piece of work and would block 18 parallel tasks on one file |
| WhatsApp **staff** nudges, daily close, theoretical-vs-actual food cost, AI assists | **35** | `RUN-01…06` |
| Mission-bridge evidence/signals for commerce events | **31** | P5a emits the SPEC §4.1 names; Phase 31 owns the rules that consume them |
| `Order.zone_id` → `fulfilment_zone_id` rename | later | P2 decision 2 preserved; 40+ call sites, zero behavioural gain |
| Multi-shipment orders / partial shipments | not planned | Decision 8; SPEC models one `Shipment` per order |
| Razorpay Route, COD, multi-vendor | never (§1.2) | explicit non-goals |

### Risks and how the plan contains them

1. **Shiprocket sandbox access.** The plan never requires it: `SystemSetting['shipping'].provider` is seeded `manual`, `SHIPROCKET_*` is validated only when the provider is `shiprocket` in production, and every adapter test stubs `global.fetch`. If sandbox credentials never arrive, P5a still ships end-to-end with `ManualProvider` and the only untested-against-reality surface is the eight HTTP request/response shapes in `shiprocket.adapter.ts`. **Mitigation for the first real switch:** flip the setting on staging, run `POST /shipments/pack` → `/awb` → `/pickup` → `/label` against the sandbox, and compare the four responses to the adapter's parsing before enabling production.
2. **Shiprocket webhook signature.** Shiprocket's tracking webhook offers a configurable header token, not an HMAC. This plan uses `timingSafeEqual` on that token and does **not** touch `main.ts`'s `rawBody` allowlist. If a body HMAC is later required, `main.ts:29-33` must add `/webhooks/shiprocket` to the `verify` callback — a one-line change that is deliberately out of scope here so no P5a agent owns `main.ts`.
3. **Razorpay refund semantics.** `payments.refund()` returns a refund whose `status` may be `pending` for hours (`speed: 'optimum'` routes through the instant rail when available and falls back to normal). The plan therefore treats the **webhook** as the authority: `POST /orders/:id/refund` writes a `Refund` row *before* calling the gateway, marks it `processed` optimistically on a successful API response, and `refund.processed` reconciles the true total by summing processed `Refund` rows rather than trusting a single event. A refund that ultimately fails at Razorpay will arrive as `refund.failed`, which this plan does **not** handle — recorded as a known gap for Phase 35's run-it layer, mitigated by the `Refund.status` column already carrying a `failed` member.
4. **Serializable contention on confirm.** `confirmPaidOrder` now writes to `Order`, `OrderItem`, `Payment`, `CouponRedemption`, `LoyaltyAccount`, `LoyaltyTransaction`, `EventBooking` and stock tables in one Serializable transaction. `withSerializableRetry` (3 retries, exponential backoff) already covers P2034; the new hot row is `LoyaltyAccount` (one row per customer, so contention is per-customer, not global) and `Coupon` (**not** written — the redemption count is read, which is why decision 14 rejects a counter column).
5. **The 15-minute booking hold vs the 30-minute pending order.** A customer can quote (hold expires at +15 min), pay at +14 min, and confirm at +20 min — after the hold expired and the sweep cancelled it. `applyCommercialEffects` detects the cancelled hold and throws, which rolls the whole transaction back and leaves a captured payment with no order. **Contained by:** the hold sweep runs every 5 minutes and only cancels holds already past `hold_expires_at`; the confirm path's failure is loud (the pending key is restored, the webhook retries, and the audit trail shows the throw). **Not contained:** the automatic refund of that captured payment. `EventsService` already has the capacity-exceeded auto-refund pattern (`events.service.ts:382-393`); wiring the same call into this branch is a small follow-up worth raising at execution time.
6. **Quote/price drift.** Handled by `assertQuoteStillValid` (Task 9) — a changed unit price sends the customer back to the cart rather than charging a stale total. The cost is a rare, explicit 400 instead of a silent mispricing.
7. **The `search_text` rename trigger may not fire.** The P2 trigger is `BEFORE UPDATE OF name, description, story, category_id, brand_id`. Task 18's parent-rename trigger writes `updated_at`, which is **not** in that column list, so the refresh may not run. The task carries an explicit verification step and the exact fallback (`SET "name" = "name"`). Do not skip that check.
8. **`StockMovement.ingredient_id` may be non-nullable**, which would break the `shipment_packed` movement for variant stock. Task 11 carries an explicit "check the schema first, take whichever branch it allows, do not alter the schema" instruction, because `schema.prisma` has one owner.

### Placeholder scan

No `TODO`, `TBD`, "etc." or "similar to" stands in for code that a reader must invent. Six method bodies are given as one-line signatures with a comment rather than full code — `CouponsService.list/create/update/archive`, `LoyaltyService.adjust`, `ShipmentsService.list/findOne/assignAwb/schedulePickup/getLabel/cancel/applyStatus`, `ReviewsService.listForModeration/listPublic/listForCustomer`, `CheckoutService.createHolds/releaseHolds`, `OrderLifecycleService.complete`, `CustomersService.findOne`, `UsageService.summary/list`. Each is: (a) mechanical CRUD or a paginated read whose shape is fully specified in the API appendix, and (b) covered by a named test case in the same task. The two places where an implementer must make a judgement call are flagged in bold with both branches spelled out (the `StockMovement` nullability in Task 11, the search-trigger column list in Task 18).

### Name consistency across tasks

`toPaise` / `toDecimal` / `inclusiveTaxPaise` / `percentOfPaise` / `sumPaise` / `clampPaise` / `Paise` (Tasks 2, 5, 6, 7, 8, 10, 11, 13) · `PricedLine` / `PricedCart` / `StoredQuote` / `PendingOrderV2` / `QuoteHold` from `checkout/quote.types` (Tasks 5, 8, 9, 10) · `CommerceEvent` from `common/events/commerce-events` (Tasks 2, 4, 10, 12, 14, 15, 16) · `ShippingProviderPort` / `ShippingProviderResolver.get()` / `ManualProvider` / `ShiprocketAdapter` / `mapShiprocketStatus` (Tasks 3, 8, 11, 12) · `CartPricingService.price` (Tasks 5, 8, 9) · `CouponsService.evaluate` returning `CouponEvaluation` (Tasks 6, 8) · `LoyaltyService.previewRedeem` / `earnEstimate` / `earnForOrder` / `redeemForOrder` / `adjust` (Tasks 7, 8, 10, 15, 16) · `CheckoutService.quote` / `readQuote` / `quoteKey` / `QUOTE_TTL_SECONDS` (Tasks 8, 9) · `FulfilmentService.confirmPaidOrder` / `applyCommercialEffects` / `applyPrepTypeOnCreate` (Task 10) · `ShipmentsService.pack` / `assignAwb` / `schedulePickup` / `getLabel` / `cancel` / `applyStatus` (Tasks 11, 12) · `RefundsService.refund` (Task 13) · `ReviewsService.create` / `moderate` / `pendingForCustomer` (Task 14) · `OrderLifecycleService.onDelivered` / `complete` (Tasks 15, 16) · `mockSettings` / `mockShippingProvider` / `mockWhatsApp` / `provideSettings` / `provideWhatsApp` (Task 1, used from Task 3 onward) · setting keys `shipping` / `loyalty` / `reviews` / `promotions` / `delivery_pincodes` (Tasks 2, 3, 7, 8, 11, 14) · migration directory `20260824090000_p5a_marketplace_backend` (Task 18).

### Two decisions that need sign-off before execution

1. **GST is carved out of the price, not added to it** (decision 1). `Order.subtotal` is tax-inclusive, `Order.tax_amount` is informational, and `total = subtotal − discount + shipping`. SPEC §3.3 says "GST %, inclusive pricing", and the seeded demo prices read as shelf prices, so this is the reading the plan takes. If the intent is exclusive pricing, `total` must become `subtotal + tax − discount + shipping` and every seeded `base_price` needs revisiting — a change that touches Tasks 5, 8, 10 and the whole appendix. **Confirm before wave 2 starts.**
2. **A quote is a stored, 15-minute artefact keyed by `quote_id`, and `POST /customer/orders` requires it** (decisions 4 and 5). This is a breaking change to the existing `POST /customer/orders` (which takes no body) and adds a mandatory extra round-trip before payment. The alternative — recompute at pay time — is simpler for Phase 34 but allows unbounded price drift between what the customer saw and what they are charged, and makes the booking hold impossible to attach to a payment. **Confirm the extra round-trip is acceptable in the storefront flow before wave 3 starts.**




