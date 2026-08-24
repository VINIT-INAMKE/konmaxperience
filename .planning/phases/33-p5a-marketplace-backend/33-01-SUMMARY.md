# Phase 33-01 — P5a "Marketplace Backend" Summary

**Branch:** `v2-os-marketplace`
**Range:** `8b46610..5a15e39` (backend)
**Plan:** `docs/superpowers/plans/2026-08-23-p5a-marketplace-backend.md` (18 tasks)
**Date:** 2026-08-24

P5a makes the backend sell all four `ProductType`s through one catalog and one mixed-fulfilment
`quote → pay → confirm` pipeline. The nine commerce models P2 deferred land in a single additive
migration; the money path stays one method (`FulfilmentService.confirmPaidOrder`) that both the
confirm endpoint and the Razorpay webhook replay; shipping HTTP hides behind a `ShippingProvider`
interface whose default is `manual`, so no test and no smoke ever touches a courier network.

---

## What P5a delivered

| Task | Commit(s) | What landed |
|---|---|---|
| 1 | `8b46610` | Every P5a model in `schema.prisma` with **no** migration — `Shipment`, `ShipmentEvent`, `Refund`, `Coupon`, `CouponRedemption`, `LoyaltyAccount`, `LoyaltyTransaction`, `Review`, plus `RefundStatus`/`CouponStatus` enums, `Order.coupon_id`, `OrderItem.event_booking_id`, `Customer.marketing_opt_in/last_seen_at`. Shared jest mock registry extended. |
| 2 | `18d4c9d`, `4936f9c` | `common/money/money.ts` — integer-paise `toPaise`/`toDecimal`/`inclusiveTaxPaise`/`percentOfPaise`/`sumPaise`/`clampPaise`; `shipping`, `loyalty`, `reviews`, `promotions`, `delivery_pincodes` setting keys seeded and allowlisted. |
| 3 | `d0acbe3`, `5ecab44` | `ShippingProviderPort`, `ManualProvider`, `ShiprocketAdapter` (token cached ~9 d), `ShippingProviderResolver.get()` reading `SystemSetting['shipping'].provider` per call; `SHIPROCKET_*` env contract validated only when the provider is `shiprocket` in production. |
| 4 | `b0e60cc`, `a7e8c34` | Public catalog cached 60 s (`CatalogCacheService`), faceted `GET /catalog/search`, cursor pagination on every list, `stock.low` signal, and the `CAT-03` assertion that cost/yield/BOM/margin never leave a public route. |
| 5 | `2ffa684`, `b4d2d3c` | `CartPricingService.price` — server re-pricing (base + variant delta + channel modifier), availability per `stock_mode`, `fulfilment` derived from `Product.fulfilment`. |
| 6 | `767bcc0`, `7310357` | `CouponsService` — CRUD, `evaluate` returning `CouponEvaluation`, server-only validation, no stacking, `free_shipping` restricted to shipped lines. |
| 7 | `c49b48c`, `249c9f6` | `LoyaltyService` — account, `previewRedeem`/`earnEstimate`/`earnForOrder`/`redeemForOrder`/`adjust`, tier thresholds from settings, 365-day expiry cron under an advisory lock. |
| 8 | `8592993`, `8a02aa5`, `b884436` | `POST /customer/checkout/quote` — the composition point: pricing + coupon + loyalty + shipping rate + tax breakup + 15-minute `EventBooking` holds, stored as `quote:{customerId}:{quoteId}`. `CheckoutModule` registered. |
| 9 | `5abfa6a`, `05f32c8` | `POST /customer/orders` takes `{ quote_id }`; cart sync returns server prices, availability and totals; `PendingOrderData` version-tagged `v: 2` with the v1 shape upgraded in memory. |
| 10 | `8a12b27`, `68785fb` | `confirmPaidOrder` extended, not forked: `applyCommercialEffects` writes `CouponRedemption`, `LoyaltyTransaction(redeem)`, `EventBooking → confirmed` and shipped-line `packed` inside the same Serializable transaction. |
| 11 | `bc0aaf6`, `928bdca` | Shipments staff API — `pack` (idempotent on `Shipment.order_id @unique`), `assignAwb`, `schedulePickup`, `getLabel`, `cancel`, `applyStatus`, cursor-paginated list. |
| 12 | `a0cd03b`, `a1b2be6` | `POST /webhooks/shiprocket` — `x-konma-webhook-token` compared with `timingSafeEqual`, idempotent on `(shipment_id, status, occurred_at)`, plus the `delivered` fan-out. |
| 13 | `384886d`, `f63b267` | `RefundsService.refund` (row written **before** the gateway call) and `reconcileGatewayRefund` for `refund.processed`; `Payment.refunded_amount` re-derived by summing `processed` rows, so partial and full are distinguishable. `RefundsModule` registered. |
| 14 | `3d48b8b`, `761e922` | Reviews — one per `order_item`, eligibility gated on `delivered`/`attended`, auto-publish at rating ≥ 4, moderation queue, `Product.rating_avg`/`rating_count` rollup. |
| 15 | `7faa04f`, `6b09b95`, `4a7f2fb` | `OrderLifecycleService` — `shipped → delivered → completed`, `onDelivered` credits loyalty and fires the review invitation; the follow-up commit wires the webhook fan-out through the same seam. |
| 16 | `9616622`, `ccc1e01` | Experiences — hold-aware capacity, the hold sweep, `POST /events/:id/attendance` flipping the linked `OrderItem` to `attended`. |
| 17 | `957396a`, `a853338` | Staff customers API (`GET /customers`, `GET /customers/:id`, `POST /customers/:id/loyalty-adjust`) and `UsageEvent` recording. |
| 18 | **`5a15e39`** | **The single migration, its hand-written SQL, the demo commerce seeds, the drift gate and the runtime walk-through** — see below. |

---

## Task 18 — the migration

`backend/prisma/migrations/20260826120000_p5a_marketplace_backend/migration.sql` (363 lines).

`npx prisma migrate dev --create-only` **refused to run**: the `OrderItem.event_booking_id` unique
constraint raises a data-loss warning, and Prisma 6.19 will not prompt in a non-interactive shell
(`Error: Prisma Migrate has detected that the environment is non-interactive`). The migration was
generated instead with the supported fallback:

```
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://konma:konma@localhost:5433/konma_shadow \
  --script > prisma/migrations/20260826120000_p5a_marketplace_backend/migration.sql
```

### Statement census (the plan's own gate)

| Check | Plan expected | Actual | Note |
|---|---|---|---|
| `CREATE TYPE` | 2 | **2** | `RefundStatus`, `CouponStatus` |
| `CREATE TABLE` | 9 | **8** | `UsageEvent` already landed in `20260826000000_p4_role_aware_ia` |
| `DROP TABLE` | 0 | **0** | |
| `DROP COLUMN` | 0 | **0** | |
| `ALTER TABLE "Order" ADD COLUMN` | 1 | **1** | `coupon_id` |
| `ALTER TABLE "OrderItem" ADD COLUMN` | 1 | **1** | `event_booking_id` |
| `ALTER TABLE "Customer" ADD COLUMN` | 2 | **2** | `marketing_opt_in`, `last_seen_at` |
| `CREATE INDEX` | — | **9** | |
| `CREATE UNIQUE INDEX` | — | **8** | |
| FK `ADD CONSTRAINT` | — | **19** | |

Tables: `Shipment`, `ShipmentEvent`, `Refund`, `Coupon`, `CouponRedemption`, `LoyaltyAccount`,
`LoyaltyTransaction`, `Review`. Nothing unexpected slipped in from any of the seventeen worktrees.

### Hand-written SQL appended

1. `review_rating_rollup()` + `review_rating_rollup_trg` on `Review` INSERT/UPDATE-of-(rating, status,
   product_id)/DELETE.
2. `product_search_text_refresh_parent()` + `product_category_rename_trg` + `brand_rename_trg`, so a
   renamed category or brand refreshes its products' `search_text`.
3. Six CHECK constraints: `Review_rating_range` (1–5), `Refund_amount_positive`,
   `Coupon_window_valid` (`ends_at > starts_at`), `Coupon_value_non_negative`,
   `LoyaltyAccount_balance_non_negative`, `Shipment_weight_non_negative`.

---

## Task 18 — verification evidence

### Where it was applied

Docker Postgres `konma-postgres` on `localhost:5433`, database `konma`, shadow `konma_shadow` — the
same live database P2/P3/P4 left seeded. `prisma migrate reset` was never available (Prisma 6.19
AI-agent guard), so nothing was dropped.

### 1. Migration applies cleanly

```
$ npx prisma migrate deploy
4 migrations found in prisma/migrations

Applying migration `20260826120000_p5a_marketplace_backend`

The following migration(s) have been applied:

migrations/
  └─ 20260826120000_p5a_marketplace_backend/
    └─ migration.sql

All migrations have been successfully applied.
```

### 2. Drift gate — schema and migrations agree exactly

```
$ npx prisma migrate diff \
    --from-migrations prisma/migrations \
    --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url postgresql://konma:konma@localhost:5433/konma_shadow \
    --exit-code

No difference detected.

EXITCODE=0
```

`--from-migrations` replays all four migration files into the shadow database first, so this also
proves every hand-written statement is re-runnable from scratch.

### 3. The hand-written SQL bites

```
          tgname
-----------------------------
 review_rating_rollup_trg
 product_category_rename_trg
 brand_rename_trg
(3 rows)

$ INSERT INTO "Review" (…, rating, …) VALUES (…, 9, …);
ERROR:  new row for relation "Review" violates check constraint "Review_rating_range"
```

The rename trigger was verified live rather than assumed (plan risk 7):

```
$ UPDATE "ProductCategory" SET name = 'Pantry & Provisions ZZTEST' WHERE slug='pantry-provisions';
$ SELECT search_text FROM "Product" WHERE slug='cold-pressed-coconut-oil';
 Cold-Pressed Coconut Oil Virgin coconut oil … Pantry & Provisions ZZTEST Konma Food
```

(then renamed back, and `search_text` followed).

### 4. Seeds — idempotent, identical on every run

```
$ npm run seed:reference          # run 1 and run 2, byte-identical
[seed:reference] done — 1 node, 8 roles, 47 modules, 12 meters, 8 approval policies, 8 zones,
  2 brands, 7 channels, 20 unit conversions, 25 categories, 11 settings, 17 guide sections, 1 system actor

$ SEED_DEMO_FORCE=true npm run seed:demo    # run 1 and run 2, byte-identical
[seed:demo] catalog done — 12 ingredients, 8 recipes, 2 events, 5 product categories, 12 products,
  16 variants, 12 media, 4 coupons, 1 loyalty account
```

Second demo run proves the guards hold: `coupons=4`, `LoyaltyTransaction=1`, `CustomerAddress=1`,
`points_balance=620` — no double-credit.

Seeded commerce fixtures (`prisma/seed-data/demo-commerce.ts`):

| Code | Type | Value | Window | Limits | Purpose |
|---|---|---|---|---|---|
| `WELCOME10` | percent | 10 % (min ₹500, cap ₹200) | −1 → +90 d | 500 / 1 per customer | the happy path |
| `PANTRY150` | fixed | ₹150 (min ₹900) | −1 → +60 d | 200 / 2 | `applies_to: [packaged]` |
| `SHIPFREE` | free_shipping | — (min ₹1200) | −1 → +30 d | ∞ / 3 | `applies_to: [packaged, merchandise]` |
| `EXPIRED5` | percent | 5 % | −60 → −30 d | ∞ / ∞ | proves the window is enforced |

Plus one demo customer `9900000001` "Demo Customer" with a `regular` loyalty account (620 points,
620 lifetime, one `adjust` opening credit) and a default delivery address in a serviceable pincode.

### 5. Runtime smoke — SPEC §11 walk-through

`npm run build` → `PORT=4021 node dist/src/main.js`. Staff auth is an httpOnly cookie; the smoke
extracts `access_token` from the jar and re-sends it as `Authorization: Bearer`. Customer auth is the
real OTP flow — `send-otp` prints `[DEV] OTP for 9900000001: ……` to the server log when WhatsApp is
unconfigured, and `verify-otp` returns the `customer_token` cookie.

**Redis:** the configured Upstash host was unresolvable from this machine
(`getaddrinfo ENOTFOUND present-pelican-68710.upstash.io`), and without Redis there is no OTP, no
cart, no quote and no pending-order key. The smoke therefore ran against a throwaway local Redis
(`docker run -d --name konma-redis-p5a -p 6390:6379 redis:8.6-alpine`, `UPSTASH_REDIS_URL=redis://localhost:6390`);
both were reverted afterwards. Nothing in the code changed for it.

#### 5a. Catalog and search

| # | Request | Status | Key fact observed |
|---|---|---|---|
| 1 | `GET /catalog/products?limit=3` | `200` | envelope `{ items, next_cursor }`; **no** `computed_cost`/`yield_qty`/`margin` key; the `recipe` relation is trimmed to `{ id, preparation_type }` (`CAT-03`) |
| 2 | `GET /catalog/search?q=coconut&type=packaged` | `200` | `{ items:[{…, rank: 0.075990885}], facets:{ types:[…], categories:[…] }, next_cursor: null }` |
| 3 | `GET /catalog/products/:id/reviews` | `200` | `{ items: [], next_cursor: null }` before the review, one published row after |
| 4 | `GET /catalog/products/slug/:slug`, `/catalog/categories`, `/catalog/availability` | `200` | unchanged shapes |

#### 5b. Customer cart → quote → order

| # | Request | Status | Key fact observed |
|---|---|---|---|
| 5 | `POST /customer-auth/send-otp` → `verify-otp` (`9900000001`) | `201` | `{"customer":{"id":"74bf3561-…","phone":"9900000001","name":"Demo Customer"},"isNewCustomer":false}` |
| 6 | `POST /customer/cart/sync` — thali ×2 (`local`) + ceramic mug ×1 (`shipped`) + fermentation workshop ×2 (`booking`) | `201` | every line server-priced, `fulfilment` overwritten from `Product.fulfilment`, `available: true`, `totals: {subtotal: 6710, tax_total: 364.17}` |
| 7 | `POST /customer/checkout/quote` `{delivery, coupon_code:"WELCOME10", redeem_points:100}` | `201` | `subtotal 6710`, `discount_amount 200`, `loyalty.redeem_amount 25`, `shipping_amount 0` (`manual` provider), `tax_amount 364.17` with a two-rate `tax_breakup`, one `holds[]` entry, **`total 6485` = 6710 − 200 − 25 + 0** |
| 8 | `POST /customer/coupons/validate` `EXPIRED5` | `400` | `This coupon has expired` |
| 8b | …`WELCOME10` / `SHIPFREE` / `PANTRY150` / `NOPE` | `201`/`201`/`400`/`400` | `{"valid":true,"discount":200}` · `{"free_shipping":true}` · `This coupon does not apply to the items in your cart` · `Invalid coupon code` |
| 9 | `POST /customer/orders` `{quote_id}` | `201` | `{"razorpay_order_id":"order_TTP4lUmdm70WQX","amount":648500,"currency":"INR"}` — paise equal to the quote total |
| 10 | `POST /customer/orders` with an unknown `quote_id` | `404` | `Your quote expired — please review your cart again` |
| 11 | `POST /customer/orders` with a quote whose `expires_at` is in the past | `410` | same message, `Gone` — the TTL-vs-`expires_at` split works |
| 12 | `POST /customer/coupons/validate` `WELCOME10` again, after redemption | `400` | `You have already used this coupon` (`per_customer_limit: 1`) |

#### 5c. Payment confirm

The confirm **endpoint** re-fetches the payment from Razorpay, which a fabricated payment id cannot
satisfy, so the smoke used the *other* documented entry point into the same method — the signed
Razorpay webhook, which reads the pending key and calls `FulfilmentService.confirmPaidOrder` directly.

| # | Request | Status | Key fact observed |
|---|---|---|---|
| 13 | `POST /webhooks/razorpay` `payment.captured`, `notes:{type:"marketplace",entity_id:<customerId>}`, HMAC-SHA256 over the raw body | `200 {"status":"ok"}` | order created |

Resulting rows:

```
order_number            | 1
status                  | placed
channel                 | delivery
subtotal                | 6710.00
discount_amount         | 225.00      -- 200 coupon + 25 loyalty, one column (decision from the appendix)
shipping_amount         | 0.00
tax_amount              | 364.17      -- carved out of subtotal, never added
total                   | 6485.00
coupon_id               | 0757220a-…  (WELCOME10)
loyalty_points_redeemed | 100

         name          | qty | unit_price | tax_rate | fulfilment | status  | event_booking_id
-----------------------+-----+------------+----------+------------+---------+-----------------
 Konma Signature Thali |   2 |     480.00 |     5.00 | local      | pending | –
 Konma Ceramic Mug     |   1 |     750.00 |    12.00 | shipped    | packed  | –
 Fermentation Workshop |   2 |    2500.00 |     5.00 | booking    | ready   | set
```

Commercial effects, all inside the one Serializable transaction:

```
CouponRedemption   WELCOME10  amount 200.00, (coupon_id, order_id) unique
LoyaltyTransaction -100 → balance_after 520, reason redeem, order_id set
LoyaltyAccount     620 → 520
EventBooking       status confirmed, payment_status paid, hold_expires_at cleared
Payment            razorpay, 6485.00, paid, refunded_amount 0.00, pay_P5ASMOKE0001
AuditEvent         order.confirmed { placed_via: "webhook_fallback", coupon_code: "WELCOME10", … }
```

#### 5d. Shipment lifecycle

| # | Request | Status | Key fact observed |
|---|---|---|---|
| 14 | `GET /shipments` | `200` | `{"items":[],"next_cursor":null}` |
| 15 | `POST /shipments/pack` `{order_id, weight_grams:550, pickup_location_code:"KONMA-VILLA"}` | `201` | `provider:"manual"`, `status:"pending"`, `packed_by` set |
| 16 | `POST /shipments/pack` again | `201` | the **same** shipment id — P2002 on `order_id @unique` handled |
| 17 | `POST /shipments/:id/awb` `{awb:"MANUAL-0042", …}` | `201` | `status:"awb_assigned"`, body honoured because the provider is `manual` |
| 18 | `GET /shipments/:id/label` | `200` | `{"label_url":null}` — `manual` has no label to hand back |
| 19 | `POST /shipments/:id/pickup` | `201` | `status:"pickup_scheduled"`; `Order.status` moved to `shipped` |
| 20 | `POST /webhooks/shiprocket` with a **wrong** token | `401` | `Invalid webhook token` |
| 21 | …right token, unknown AWB | `200` | `{"status":"ignored","reason":"unknown awb"}` |
| 22 | …right token, `IN TRANSIT` | `200` | `{"status":"ok","shipment_status":"in_transit","order_delivered":false}` |
| 23 | …right token, `DELIVERED` | `200` | `{"…":"delivered","order_delivered":false}` — correct: the local and booking lines are still outstanding; the shipped `OrderItem` flipped to `delivered` |
| 24 | replay of 23 | `200` | idempotent — no sixth `ShipmentEvent`, unique on `(shipment_id, status, occurred_at)` |

Final ledger: 5 `ShipmentEvent` rows (`pending`, `awb_assigned`, `pickup_scheduled`, `in_transit`, `delivered`).

#### 5e. Delivery, loyalty earn, reviews

| # | Request | Status | Key fact observed |
|---|---|---|---|
| 25 | `POST /events/:id/attendance` `{booking_id, status:"attended"}` | `201` | booking `attended`; the linked `OrderItem` opens the review gate |
| 26 | `PATCH /orders/:id/status {"status":"delivered"}` | `200` | loyalty credited: `LoyaltyTransaction(+320, balance_after 840, reason earn, expires_at 2027-08-24)`; account `840 / 940 lifetime` |
| 27 | `PATCH /orders/:id/status {"status":"preparing"}` | `400` | `Cannot transition from "delivered" to "preparing". Valid transitions: completed` |
| 28 | `GET /customer/reviews/pending` | `200` | two rows — the delivered mug and the attended workshop; the still-`pending` thali is absent |
| 29 | `POST /customer/reviews` rating 5 | `201` | `status:"published"` (auto-publish ≥ 4) |
| 30 | `POST /customer/reviews` rating 3 | `201` | `status:"pending"` |
| 31 | `POST /customer/reviews` duplicate | `409` | `You have already reviewed this item` |
| 32 | `POST /customer/reviews` for the un-delivered local line | `400` | `You can review an item once it has been delivered` |
| 33 | `GET /reviews?status=pending` (staff) | `200` | one row with `product` and `customer` joined |
| 34 | `PATCH /reviews/:id/publish` | `200` | `moderated_by`/`moderated_at` set; rollup → `Fermentation Workshop 3.00 / 1` |
| 35 | `PATCH /reviews/:id/hide` then `/publish` | `200` | rollup dropped the workshop to unrated and restored it — trigger and service agree |
| 36 | `GET /catalog/products/:id/reviews` | `200` | one published review with `customer:{name}` only |

#### 5f. Refunds

| # | Request | Status | Key fact observed |
|---|---|---|---|
| 37 | `POST /orders/:id/refund {"amount":649}` against the fabricated payment | `400` | `Refund failed at the gateway: …`; the `Refund` row stays `failed`, `Payment.refunded_amount` untouched — the documented failure semantics |
| 38 | `RefundsService.refund` driven from a Nest application context with **only `RazorpayService.createRefund` stubbed** (partial ₹649) | — | `Refund(processed, rfnd_P5ASMOKE1)`; `Payment → partially_refunded`, `refunded_amount 649.00`; order still `delivered` |
| 39 | …then a full refund (amount omitted → ₹5836 balance) | — | `Refund(processed, rfnd_P5ASMOKE2)`; `Payment → refunded`, `refunded_amount 6485.00`; **`Order.status → refunded`**; loyalty clawback `LoyaltyTransaction(-220, "Reversed on refund")` — the 320 earned reversed and the 100 redeemed restored, account back to `620 / 620` |
| 40 | a third refund attempt | — | `Cannot refund a payment with status refunded` |
| 41 | `GET /orders/:id/refunds` | `200` | 3 rows (1 failed + 2 processed), newest first |

`AuditEvent(entity_type: order)` at the end: `order.confirmed`, `order.status_changed`,
`order.refunded`, `order.refunded`.

#### 5g. Staff surface

| # | Request | Status | Key fact observed |
|---|---|---|---|
| 42 | `GET /promotions/coupons` | `200` | 4 coupons, each with `_count:{redemptions}`; `WELCOME10` shows `1` |
| 43 | `POST /promotions/coupons` then `DELETE /promotions/coupons/:id` | `201`/`200` | create returns the row; DELETE disables rather than deletes |
| 44 | `GET /customers?q=99000` | `200` | the demo customer with `loyalty_account` and `_count:{orders:1, reviews:2, bookings:1}` |
| 45 | `GET /customers/:id` | `200` | adds `orders` (with `items` + `payment`), `loyalty_transactions` (4), `reviews` (2), `addresses`, `coupon_redemptions`, `orders_summary` |
| 46 | `POST /customers/:id/loyalty-adjust {"delta":-50}` | `201` | balance `620 → 570`, `LoyaltyTransaction(reason: adjust)` written |
| 47 | `GET /customer/loyalty` | `200` | `points_balance`, `tier: "regular"`, `next_tier:{tier:"insider",points_needed:1380}`, `redeem_value_per_point: 0.25`, transaction list |
| 48 | `GET /customer/orders/:id/shipment` | `200` | the shipment with its `events[]` |
| 49 | `POST /usage {"event_type":"page_view","path":"/shipments","meta":{…}}` | `202` | no body |
| 50 | `GET /usage/summary?days=30` | `200` | `{"days":30,"by_role":[{"role_code":"CUSTOMER","count":2},…],"by_path":[…],"by_action":[]}` |
| 51 | `GET /audit?entity_type=order&limit=5` | `200` | the four order audit rows above |

### 6. Static gates (HEAD = `5a15e39`)

| Gate | Result |
|---|---|
| `npx jest --silent` | **102 suites passed / 102 total** — 1575 tests (1549 passed, 26 todo) |
| `npx tsc --noEmit -p tsconfig.build.json` | exit `0` |
| `npx eslint "{src,apps,libs,test}/**/*.ts"` | **0 errors**, 4011 warnings (pre-existing) |
| `npm run -s build` | exit `0`, `dist/src/main.js` written |
| `npx prisma validate` | `The schema at prisma\schema.prisma is valid` |
| **frontend** `npx tsc --noEmit` | exit `0` |
| **frontend** `npm run -s build` | compiled successfully (all routes rendered) |

`git status --short` at the end of the phase shows only ` M CLOUDFLARE-SETUP.md` — pre-existing,
deliberately untouched.

### 7. Demo credentials

`seed:demo` never resets an existing user's password, so the Phase 31 rotation still stands and no
new passwords were issued (`[seed:demo] all demo users already exist — no passwords issued`). The
smoke logged in as `admin@konma.store` with the password recorded in
`.planning/phases/31-p3-mission-bridge/31-01-SUMMARY.md` §6; that table remains the source of truth
for all eight staff logins.

New in P5a — the **customer** login, which needs no password:

| Phone | Name | Loyalty | How to log in |
|---|---|---|---|
| `9900000001` | Demo Customer | 620 pts, `regular` | `POST /customer-auth/send-otp {"phone":"9900000001"}`, read `[DEV] OTP for 9900000001: ……` from the server log, `POST /customer-auth/verify-otp` |

---

## Deliberate deviations

### Migration and seeds (Task 18)

1. **The migration directory is `20260826120000_p5a_marketplace_backend`, not the plan's pinned
   `20260824090000`.** Phase 32's `20260826000000_p4_role_aware_ia` merged first and is already
   applied; a `2026-08-24` timestamp would sort *before* it and Prisma orders by directory name. The
   plan anticipated exactly this case and told the implementer to re-generate with a later timestamp
   rather than rename by hand.
2. **8 `CREATE TABLE`, not the plan's 9.** `UsageEvent` shipped in the P4 migration (`1e95fa2`), which
   is the collision the plan's "Execution partition → cross-phase collisions" section predicted. The
   model stays in `schema.prisma` exactly once.
3. **`migrate dev --create-only` was not usable**; `migrate diff --script` produced the identical DDL.
   Recorded because the plan's command block will fail the same way for anyone re-running it.
4. **The parent-rename trigger writes `SET "name" = "name"`, not `updated_at`.** The P2 trigger is
   `BEFORE INSERT OR UPDATE OF "name","description","story","category_id","brand_id"`; Postgres fires
   `UPDATE OF` only when a listed column appears in the `SET` list, so the plan's `updated_at` form
   would silently never fire. This is the plan's own risk 7 and its stated fallback, verified live.
5. **The `review_rating_rollup` trigger is redundant with `ReviewsService.rollup()`** and was still
   added. The service recomputes the same two columns inside its transaction on create/publish/hide;
   the trigger computes an identical value (count + `round(avg,2)` over published rows, `NULL` when
   none), so the two writes cannot disagree, and SPEC §5.4 words the rollup as "maintained by
   trigger". It earns its keep when a review is moderated by raw SQL. The redundancy is documented in
   the migration file itself.
6. **`DEMO_LOYALTY_CUSTOMER.phone` is `9900000001`, not the plan's `919900000001`.** `SendOtpDto` and
   `VerifyOtpDto` validate `/^[6-9]\d{9}$/`, `CustomerAuthService.verifyOtp` upserts `Customer.phone`
   with exactly the string it was given, and `WhatsAppService.normalize()` adds the `91` prefix on the
   way out — so a `91…` row can never be logged into. Found by the smoke; the plan's fixture would
   have shipped an unusable demo customer.
7. **A `CustomerAddress` was added to the demo seed**, in a pincode drawn from the local `.env`
   `DELIVERY_PINCODES`. `SystemSetting['delivery_pincodes']` seeds empty and
   `ServiceabilityService.allowedPincodes()` then falls back to the env var, so without a matching
   address the local line fails `assertLocalServiceable` and no mixed-cart quote is possible.
8. **`SHIPROCKET_WEBHOOK_TOKEN` had to be set locally.** With it unset the endpoint returns `403` by
   design, so the smoke added a placeholder to `backend/.env` (gitignored). `.env.example` already
   documents it.

### Inherited from Tasks 1–17 (the merged code is ground truth where the plan differs)

9. **Commerce events live in `common/events/domain-events.ts`; no `commerce-events.ts` exists.** Plan
   decision 12 planned a Phase-33-owned file to avoid a merge conflict with Phase 31. Phase 31 merged
   first, so P5a extended the existing catalogue instead — the same names, the same
   `{ node_id, actor, occurred_at }` envelope, one file.
10. **The quote key is `quote:{customerId}:{quoteId}`**, so one customer can never read another's
    quote by guessing an id. The plan wrote the key without the customer segment.
11. **`POST /customer/orders` distinguishes `404` from `410`**: `404` when the quote is gone (never
    issued, already spent, TTL reaped), `410` when the payload is still in Redis but its own
    `expires_at` has passed. The plan's appendix listed only `400`.
12. **`RefundsModule`, `ReviewsModule`, `CheckoutModule` and `CustomersModule` are all registered in
    `app.module.ts`** — the plan assigned those edits one-per-wave and two landed as follow-up commits
    (`b884436`, `f63b267`).
13. **The shipment transition guard allows forward skips**, so a courier that reports `delivered`
    without an intermediate scan is honoured rather than rejected.
14. **`EventBooking` holds are DELETED on release/sweep**, not cancelled in place — a released hold
    leaves no row behind, so capacity maths never has to filter cancelled holds.
15. **`GET /usage/summary` returns `by_role` / `by_path` / `by_action`**, not the appendix's
    `by_role` / `by_event`.
16. **`GET /shipments/:id/label` returns `200 {"label_url": null}` for a `manual` shipment with an
    AWB**, rather than the appendix's `400`. The `400` is reserved for "no AWB assigned".

### The two plan decisions that needed sign-off — both taken as written

17. **GST is carved out of the price, never added to it.** Per line
    `tax = round(gross × rate / (100 + rate))`; `Order.subtotal` is the tax-**inclusive** gross,
    `Order.tax_amount` is the carved-out tax already contained in it, and
    `total = subtotal − discount_amount + shipping_amount`. Verified live: subtotal 6710, tax_amount
    364.17, total 6485 — 364.17 is *inside* 6710. This matches SPEC §3.3 ("GST %, inclusive pricing")
    and the seeded demo prices, which read as shelf prices. **Phase 34 must never add `tax_amount` to
    a displayed total.**
18. **A quote is a stored 15-minute artefact and `POST /customer/orders` requires its id.** The extra
    round-trip is real and is a breaking change to the storefront (see below), but it is what freezes
    the price, attaches the booking hold to the payment, and makes `assertQuoteStillValid` possible.
    Taken as designed.

---

## Observations recorded, not fixed

- **`ShipmentsService` moves `Order.status → shipped` without an `AuditEvent`.**
  `shipments.service.ts:650` writes the transition directly (deliberately bypassing
  `STATUS_TRANSITIONS`, which the map's own comment says it does not go through), so the order's
  audit trail jumps from `order.confirmed` to `order.status_changed {before: shipped}`. Nothing is
  wrong functionally; the trail just has a hole where "packed and picked up" should be.
- **Shipped lines are `packed` the instant payment confirms** (`applyCommercialEffects`), while
  `POST /shipments/pack` is the staff action that creates the `Shipment`. So the Pick & Pack queue
  cannot be driven off `OrderItemStatus.packed` — a line is `packed` before anyone has packed it. The
  queue's real predicate is "shipped lines whose order has no `Shipment` row". Phase 34's Shipments
  screen needs to know this; the plan does not say which of the two meanings `packed` carries.
- **A gateway refund failure reported `undefined`.** `rzp.payments.refund()` rejects with a plain
  `{ statusCode, error: { code, description } }` object, not an `Error`, so
  `(err as Error).message` was `undefined` and staff saw
  `Refund failed at the gateway: undefined`. **Fixed** in this commit —
  `backend/src/refunds/refunds.service.ts:27` (`gatewayErrorMessage`) now prefers the gateway's
  `description`, then its `code`, then a real `Error.message`.
- **`POST /customer/cart/sync` keeps the *stored* cart when the incoming cart has no more items.**
  `customer-orders.service.ts:360` merges by `existing.items.length >= localCart.items.length`, so a
  re-sync that only changes `deliveryAddressId` or `channel` is discarded. Pre-existing v1 behaviour;
  it cost the smoke one confusing round-trip until the cart was cleared first.
- **`refund.failed` is still unhandled** (the plan's risk 3). `Refund.status` carries a `failed`
  member and the staff path writes it, but no webhook branch reconciles a refund that fails *after*
  Razorpay accepted it.
- **The 15-minute hold vs the 30-minute pending order** (plan risk 5) is unchanged: a payment captured
  after its booking hold was swept throws inside `applyCommercialEffects` and leaves a captured
  payment with no order. The auto-refund of that payment is still a follow-up.
- **`SALES` and `PROCUREMENT` readiness still compute from a nearly empty database.** The smoke added
  one order and 200 units of every ingredient; the formulas are exercised by their unit specs.

---

## What Phase 34 must handle (storefront gaps)

The frontend compiles and builds against this backend, but the **customer purchase flow is now
broken at runtime** and is the first thing Phase 34 must fix.

1. **No quote step exists.** `frontend/hooks/use-cart.ts:35` calls
   `apiClient.post('/customer/orders')` with **no body**, which now returns `400` (`quote_id` is
   required). The storefront needs `POST /customer/checkout/quote` → render the itemised quote →
   `POST /customer/orders {quote_id}` → Razorpay → `POST /customer/orders/confirm`.
2. **`variantId` does not exist anywhere in the frontend** (zero matches repo-wide). The backend
   carries it end to end — cart, quote, `OrderItem`, review — and a product with two variants (the
   ceramic mug, the coconut oil) is unsellable at the right price without it. This is P2 follow-up #1,
   now load-bearing.
3. **Envelope changes.** `app/(public)/menu/page.tsx:57` already reads
   `{ items, next_cursor }` from `/catalog/products`, so that one is done; `GET /catalog/search` is
   not consumed yet and returns `{ items, facets, next_cursor }`.
4. **`404` / `410` handling on `POST /customer/orders`.** A `410` means "your quote aged out, re-quote
   silently"; a `404` means "start again from the cart". Both must be distinguishable in the UI, and
   `400` now also carries "price changed" and "item gone".
5. **Money is a JSON number, not a string** — `DecimalSerializationInterceptor` converts every
   `Prisma.Decimal` to `.toNumber()`. And `tax_amount` is **inside** `subtotal`: showing
   `subtotal + tax` overcharges the customer on screen.
6. **`Order.discount_amount` bundles coupon discount and loyalty redemption.** The split lives in
   `Order.coupon_id`, `Order.loyalty_points_redeemed` and the `CouponRedemption` row; a receipt that
   wants two lines has to reconstruct them.
7. **Every staff commerce screen is still missing** — Catalog admin, Promotions, Reviews moderation,
   the Shipments queue, Orders detail with refunds, Experiences attendance and Customers. Their APIs
   are complete and specified in the plan's appendix §C.
8. **`/menu` → `/shop`.** The storefront still lives at `/menu` (linked from `app/page.tsx`,
   `sign-in`, `error.tsx`); SPEC's storefront routes (`/shop`, `/p/[slug]`, `/experiences`, `/search`,
   `/cart`, `/checkout`, `/account/*`, `/orders/[id]/track`, `/feedback/[orderId]`) plus JSON-LD,
   sitemap and robots are all Phase 34.

---

## Deferrals carried forward

- **`QA-05` second half — the Postgres-backed integration harness** (`test/jest-integration.json`
  against a real database, covering order confirm, fulfilment, shipment lifecycle, coupon, loyalty and
  review) **is still not built.** P5a delivers unit coverage for every multi-write path plus this
  recorded runtime walk-through. This was already carried from Phase 31 (`QA-02`) and now has a second
  phase's worth of transactions waiting for it.
- **Playwright smoke test 2** (`browse → three fulfilment types → coupon → pay → confirm → track`) →
  Phase 34; it needs the storefront.
- **Shiprocket sandbox** was never required and never used: `SystemSetting['shipping'].provider` seeds
  `manual`, every adapter test stubs `fetch`, and the smoke ran the manual provider end to end. The
  eight Shiprocket request/response shapes in `shiprocket.adapter.ts` remain the only surface untested
  against reality. Before the first real switch: flip the setting on staging and compare
  `pack → awb → pickup → label` responses to the adapter's parsing.
- **A body HMAC for the Shiprocket webhook** would need `/webhooks/shiprocket` added to the
  `main.ts:29-33` `rawBody` allowlist. Deliberately out of scope — no P5a task owns `main.ts`.
- **Product media upload UI / R2 presign for catalog media**, **`Order.zone_id` → `fulfilment_zone_id`
  rename**, **multi-shipment orders** — unchanged deferrals.
- **WhatsApp staff nudges, daily close, theoretical-vs-actual food cost, AI assists** → Phase 35.

---

## Status

**Phase 33 (P5a) is complete.** All 18 plan tasks are merged, the single additive migration is
committed and applied to the live local Postgres, the drift gate is clean, both seeds are idempotent,
and the whole commerce path — faceted catalog, mixed-fulfilment cart, quote with coupon + loyalty +
holds, order from quote, payment confirm through the webhook, coupon redemption, loyalty earn/redeem/
clawback, pack → AWB → pickup → courier webhook → delivered, reviews with moderation and rating
rollup, partial and full refunds, and the staff customers/usage/audit surface — has been exercised end
to end against `dist/src/main.js` with the results recorded above.

Backend gates green at `5a15e39`: 102 suites / 1575 tests, `tsc` exit 0, 0 lint errors, build clean,
drift gate `No difference detected.` Frontend gates on the same tree: `tsc --noEmit` exit 0, `next
build` compiled.

**Next:** Phase 34 (Marketplace Storefront + Staff Commerce, P5b). Its first task is the quote → pay
flow above; nothing else in the storefront can be trusted until `POST /customer/orders` has a body.
