# P5b Marketplace Storefront + Staff Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers shop all four `ProductType`s on a desktop-designed, SEO-ready storefront — `/shop`, `/p/[slug]`, `/experiences`, `/search`, `/cart`, `/checkout`, `/account/*`, `/orders/[id]/track` — through the mixed-fulfilment `sync → quote → pay → confirm` pipeline P5a shipped; and staff run Shipments, Promotions, Reviews, Customers, Orders (with refunds and a real detail route), Experiences attendance and Catalog variants/media from the ops app the Phase 32 spine already scopes.

**Architecture:** P5a's backend is ground truth and is **not** re-litigated. Wave 0 lands the three cross-cutting foundations — the frontend type mirror, seven small backend gaps the storefront genuinely cannot work without, and the config/theming layer (the light pin, `next.config.ts`, `proxy.ts`, the four new spine entries). Waves 1–2 then run the storefront and the staff screens **in parallel**, because they share nothing but types: the storefront lives under `frontend/app/(public)/**` + `frontend/components/storefront/**`, the staff screens under `frontend/app/(ops)/**` + `frontend/components/ops/**`. Wave 3 is SEO (needs every route to exist); Wave 4 is Playwright, CI and the record, on the merged tree.

**Tech Stack:** Next.js 16.2 (App Router, `proxy.ts` — *not* `middleware.ts`), React 19, Tailwind 4, shadcn on base-ui, TanStack Query 5, zustand 5 (cart), next-themes, Pusher JS, `sonner` toasts, `react-hook-form` + `zod`, npm, Node 22. Branch `v2-os-marketplace`, base ≥ `29d47c7`. Backend is NestJS 11 at `5a15e39`, unchanged except by Task 2. Build output `frontend/.next`; backend `backend/dist/src/main.js`.

**Gates that must stay green after every task:** frontend `npx tsc --noEmit` (exit 0), `npm run lint` (0 errors), `npm run build` (compiles, every route rendered); backend (only when Task 2 is in play) `npx jest --silent`, `npx tsc --noEmit -p tsconfig.build.json`, `npx eslint "{src,apps,libs,test}/**/*.ts"` (0 errors), `npx prisma validate`.

---

## Decisions taken while reading the code

1. **The storefront is pinned to light, and the pin is made real.** `frontend/app/(public)/layout.tsx:11` already renders `<div className="light …">` — but **there is no `.light` selector anywhere in `frontend/app/tokens.css`** (its only selectors are `:root` at lines 12 and 38, `.dark` at 85, and `:root, .dark` at 129). The class is inert. Meanwhile `frontend/lib/providers.tsx:24` runs next-themes as `attribute="class" defaultTheme="system" enableSystem`, so a visitor whose OS is dark gets `<html class="dark">` and `.dark`'s custom properties inherit straight into the storefront. Today the storefront therefore renders a **three-way mix**: `--public-*`-tokened components stay light (that layer has no dark override), `bg-background`/`text-foreground`/`border-border` flip dark, and 37 raw `bg-white`/`text-white` literals stay literally white. That is precisely the "light-pinned mixing" Sweep D flagged. **Fix:** change the layer-2/3 light block's selector in `tokens.css` from `:root {` to `:root, .light {` — one line — so a `.light` element re-declares the light values and beats an ancestor `.dark` by proximity, and add `color-scheme: light` so native controls and scrollbars follow. **Why pinned and not theme-following:** the public header has no theme toggle, so a customer who lands in dark has no way out; SPEC §1.3 freezes the homepage light and makes its palette the brand source of truth, so a storefront that flips dark next to a permanently-light homepage is incoherent; and OG cards and product photography are shot on the warm stone ground. The ops app keeps its toggle, untouched. `html.light` from next-themes becomes a harmless no-op because `:root` and `.light` declare identical values.
2. **`variantId` becomes the cart's identity, not an optional extra.** `lib/stores/cart-store.ts` keys every line by `productId` alone (lines 31, 46, 51) — two variants of the ceramic mug would collapse into one line at the wrong price. The store goes to **v3** with a composite line key `` `${productId}:${variantId ?? ''}` ``, and the persisted `migrate` drops v2 carts rather than half-reading them (the v2 migrator already sets that precedent at line 91).
3. **A quote is fetched once, at the review step — not on every keystroke.** `/checkout` is a three-step client flow: **contact/address → fulfilment options → review**. The quote (`POST /customer/checkout/quote`) is issued **on entering the review step** and again only when the customer changes a quote input (coupon, redeem points, address, pickup toggle). It carries a live 15-minute countdown from `expires_at`. At T-0 the Pay button disables and a "Refresh price" button re-quotes. This is the load-bearing UX decision — see Self-review "for sign-off".
4. **`410` re-quotes silently; `404` returns to the cart; `400` is read, not guessed.** P5a deviation 11 split these deliberately. `POST /customer/orders` → `410 Gone` means the payload is still in Redis but its own `expires_at` passed → the checkout re-quotes in place and tells the customer the price was refreshed. `404` means the quote is gone entirely (never issued, already spent, TTL reaped) → hard bounce to `/cart` with a toast. `400` now also carries "price changed" and "item gone" → show the server's message verbatim and re-quote. `apiClient` must therefore expose the HTTP status at the call site (Task 1).
5. **`tax_amount` is never added to a displayed total.** P5a decision 1, signed off and verified live: `Order.subtotal` is the tax-**inclusive** gross, `tax_amount` is the carved-out GST already inside it, and `total = subtotal − discount_amount − loyalty.redeem_amount + shipping_amount`. Every storefront and staff money component renders "Subtotal (incl. GST)" and shows tax as an *of which* line, never a `+` line. A `formatCurrency` helper and a single `<MoneyLine>` primitive make this the path of least resistance.
6. **`/cart` never shows a grand total.** Shipping, coupon discount and loyalty only exist inside a quote, and quoting requires an address. `/cart` therefore shows per-line prices and "Subtotal (incl. GST)" plus the literal note that shipping and discounts are calculated at checkout. Anything else would either lie or force a premature address prompt.
7. **Money arrives as JSON numbers.** `DecimalSerializationInterceptor` converts every `Prisma.Decimal` to `.toNumber()`. No frontend type declares a money field as `string`, and no component calls `parseFloat` on one.
8. **Staff order detail becomes a route, not a sheet.** `OPS-05` words it as "a full `/orders/[id]` detail page … replacing `OrderDetailSheet`". The ops orders list already lives at `/pos/orders` (`lib/nav/spine.ts:138`), so the detail route is **`/pos/orders/[id]`**. This also keeps `/orders/*` entirely free for the customer, which is what makes decision 9 safe.
9. **`/orders/[id]/track` is a customer route and `proxy.ts` must learn that.** `frontend/proxy.ts:5` lists `PUBLIC_PATHS = ['/login', '/menu', '/events', '/feedback', '/profile']`; everything else without a staff `access_token` is redirected to `/team`. Every new storefront route — `/shop`, `/p`, `/experiences`, `/search`, `/cart`, `/checkout`, `/account`, `/orders` — is currently treated as an ops route and would bounce anonymous shoppers to the staff login. Because staff orders live at `/pos/orders`, adding `/orders` to `PUBLIC_PATHS` is unambiguous.
10. **The Pick & Pack queue predicate is "shipped lines whose order has no `Shipment` row", not `OrderItemStatus.packed`.** P5a's own summary records that `applyCommercialEffects` sets shipped lines to `packed` at *confirm*, before anyone has packed anything. The Shipments screen's "To pack" tab is therefore driven by `GET /shipments` cross-referenced with orders carrying shipped lines — never by the item status. Getting this wrong would show an empty queue and a pile of phantom-packed items.
11. **Seven backend gaps are in scope; two are not.** Task 2 fixes only what the storefront cannot work without (decision 12). `refund.failed` reconciliation and the Postgres integration harness are **deferred to Phase 35** — no P5b screen reads either, and both are backend-owned work that would put one file in the way of nineteen frontend agents.
12. **A six-route customer-auth guard defect blocks the whole account surface.** NestJS runs **global** guards before route-level ones. `PermissionsGuard` is global (`app.module.ts:156`) and returns `false` unconditionally for `user.type === 'customer'` on any route not marked `@Public()` (`permissions.guard.ts:33`). Every P5a-era customer controller therefore pairs `@UseGuards(CustomerGuard)` **with** `@Public()` and says so in a comment — `customer-orders.controller.ts:28-29`, `checkout.controller.ts:35-36`, `loyalty.controller.ts:29-30`, `reviews.controller.ts:62-63`. Two pre-P5a controllers do **not**: `customer-auth.controller.ts` lines 47/54/64/70 (`GET`/`PATCH /customer-auth/profile`, `POST /customer-auth/logout`, `POST /customer-auth/pusher-auth`) and `events.controller.ts` lines 73/84 (`POST /events/:id/checkout`, `POST /events/:id/bookings/confirm`). Without the fix there is no session restore on refresh, no customer Pusher auth (so no live tracking), no logout (so no `jti` revocation — `ACCT-02`), and experiences cannot be booked. **This is inferred from guard ordering, not yet observed at runtime — Task 2's first step reproduces it against a running server before changing a line.**
13. **`GET /catalog/availability/:productId` is missing `@Public()`.** `catalog.controller.ts:224` marks the batch route public; line 231 marks the per-product route with nothing, so it falls to the staff guard. `/p/[slug]` needs live availability for one product. One decorator.
14. **`POST /customer/cart/sync` cannot shrink a cart.** `customer-orders.service.ts:360` merges by `existing.items.length >= localCart.items.length`, so removing a line, or changing only `channel`/`deliveryAddressId`, is silently discarded — P5a's own smoke lost a round-trip to it. `/cart` is unusable without a fix. The merge rule becomes: the **incoming** cart is authoritative whenever the client sends an explicit sync; the stored cart is only used to seed an *empty* incoming cart at login (the original intent).
15. **Product media are unsigned public CDN URLs, so `next/image` is safe.** `storage.service.ts:76` returns `${R2_PUBLIC_URL}/${key}` with no query-string signature (`.env.example:17` → `https://<bucket>.r2.dev`). `next.config.ts` currently sets `images: { unoptimized: true }` and declares no `remotePatterns`; Task 3 adds the R2 pattern and drops `unoptimized`. Evidence and exports keep their presigned GETs and are not rendered through `next/image`.
16. **There is no `presign-product-media` route.** `storage.controller.ts` offers `presign` (evidence, `UPLOAD_EVIDENCE`), `presign-asset`, `presign-guide` and `presign-chat`. Catalog media upload (`OPS-01`) needs its own, gated by `MANAGE_OPS` to match every other staff catalog route (`catalog.controller.ts:203`). Task 2 adds it.
17. **The staff Catalog admin already exists and is only missing two things.** `app/(ops)/operations/menu/page.tsx` (507 lines) plus `components/ops/operations/menu/{ProductForm,ProductCard,ProductCategorySection,ChannelModifierTable,FoodCostBadge}.tsx` already do product CRUD, category CRUD and publish-by-status. `ProductForm.tsx` contains **zero** matches for `variant` or `media`. Task 19 adds exactly those two editors and nothing else — `OPS-01` is otherwise satisfied.
18. **The frontend has no test infrastructure at all** — no jest, no vitest, no Playwright, no `test` script, no CI job beyond lint/tsc/build. "Tests where the house pattern has them" therefore means: **there is no house pattern to mirror.** The only automated test P5b adds is the Playwright smoke (Task 20); every other task's verification is a typed, built, manually-walked checklist. This is stated so no agent invents a testing convention mid-phase.
19. **Playwright lands in P5b, and smoke 2 stops at the same boundary P5a's smoke did.** See "Playwright decision" below.
20. **`/menu` and `/events` become redirects, and `app/page.tsx` is not touched.** The frozen homepage links to `/menu` at lines 77, 127, 273 and `/events` at 85, 147, 274. SPEC §1.3 freezes that file. So `/menu` → `/shop?type=prepared_food` (SPEC §5.1, permanent) and `/events` → `/experiences` (same reasoning, permanent), implemented as `redirect()` in tiny server pages so the route group's layout still applies. `app/(public)/profile` → `/account` likewise.
21. **`catalog/search`'s `next_cursor` is an opaque base64 offset, not an id.** P5a's appendix shows `"next_cursor": "MjA="` for search and a row id for `/catalog/products`. Neither is parsed by the frontend; both are passed back verbatim. Nothing may assume cursor semantics.
22. **The storefront gets its own component root.** New work lives in `frontend/components/storefront/**`, not `components/public/**`. `components/public/` keeps only what survives: `ScrollVideoStory.tsx` (frozen), `OtpDigitInput`, `CustomerOtpForm`, `GooglePlacesInput`, `StarRatingInput`, `OrderTrackingTimeline`. The rest are superseded and deleted by their replacing task, which keeps deletions attributable.
23. **`Order.discount_amount` bundles coupon and loyalty; receipts reconstruct the split.** Coupon value comes from the `CouponRedemption` row (or `Order.coupon_id` + a quote echo), loyalty from `Order.loyalty_points_redeemed × redeem_value_per_point`. Receipts render two lines; the sum must equal `discount_amount` and a dev-mode assertion says so.
24. **No optimistic writes on the money path.** Cart quantity changes are optimistic; quote, pay, confirm and every staff mutation (refund, AWB, pickup, loyalty adjust, moderation) are not — they show a pending state and reconcile from the server response.

---

## Backend contract cross-check

Every route P5b consumes, with its **real** shape read from the merged controllers and services at `5a15e39`. Where the P5a appendix (`docs/superpowers/plans/2026-08-23-p5a-marketplace-backend.md:3859-4167`) differs, the code wins and the difference is called out.

### Public catalog — no auth, cached 60 s (`backend/src/catalog/catalog.controller.ts`)

| Route | Line | Auth | Real response |
|---|---|---|---|
| `GET /catalog/products` | 128 | `@Public()` | `{ items: Product[], next_cursor: string \| null }` — envelope, **not** a bare array. Query: `type`, `category_id`, `brand_id`, `cursor`, `limit`. `recipe` is trimmed to `{ id, preparation_type }`; no `computed_cost`/`yield_qty`/BOM/margin key exists (`CAT-03`, asserted by a test) |
| `GET /catalog/products/slug/:slug` | 117 | `@Public()` | one product with `media[]`, `variants[]`, `category`, `event` |
| `GET /catalog/search` | 98 | `@Public()` | `{ items: [{…, rank: number}], facets: { types: [{type,count}], categories: [{category_id,name,count}] }, next_cursor }`. `next_cursor` is an **opaque base64 offset** (decision 21) |
| `GET /catalog/categories` | 45 | `@Public()` | bare array (alias `menu/categories`) |
| `GET /catalog/availability` | 224 | `@Public()` | map keyed by product id |
| `GET /catalog/availability/:productId` | 231 | **none — falls to the staff guard** | **GAP** (decision 13); Task 2 adds `@Public()` |
| `GET /catalog/products/:id/reviews` | `reviews.controller.ts:156` | `@Public()` | `{ items: [{ id, rating, title, body, media, created_at, customer:{name} }], next_cursor }` — published only |

### Customer cart, checkout, orders (`@Public()` + `@UseGuards(CustomerGuard)` at class level)

| Route | File:line | Real shape |
|---|---|---|
| `POST /customer/cart/sync` | `customer-orders.controller.ts:47` | Req `{ items:[{productId, variantId?, quantity}], channel, deliveryAddressId }` → `{ items:[{ productId, variantId, name, quantity, unitPrice, imageUrl, fulfilment, available, unavailable_reason }], channel, deliveryAddressId, updatedAt, totals:{ subtotal, tax_total } }`. **Merge defect at `customer-orders.service.ts:360`** (decision 14) |
| `GET /customer/cart` | :41 | same envelope, server-priced |
| `DELETE /customer/cart` | :56 | clears |
| `POST /customer/checkout/quote` | `checkout.controller.ts:50` | Req `{ channel, delivery_address_id?, pickup?, coupon_code?, redeem_points? }` → the full quote object below |
| `POST /customer/coupons/validate` | `checkout.controller.ts:71` | `{ valid, code, type, discount, free_shipping }`; invalid → **`400` with a human message** (`Invalid coupon code`, `This coupon has expired`, `Add ₹150.00 more to use this coupon`, `You have already used this coupon`, `This coupon does not apply to the items in your cart`) |
| `POST /customer/orders` | :72 | Req `{ quote_id, idempotency_key? }` → `{ razorpay_order_id, amount /* PAISE */, currency, key_id, quote_id }`. **`404`** quote gone · **`410`** quote present but `expires_at` passed · **`400`** price changed / item gone |
| `POST /customer/orders/confirm` | :79 | Req `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` → the order with `items[].product`, `payment`, `coupon_id`, `loyalty_points_redeemed/earned`. Replay returns the **same** order |
| `GET /customer/orders`, `/:id`, `/:id/receipt` | :86, :110, :93 | list + detail + receipt |
| `GET /customer/orders/:id/shipment` | :101 | `{ id, status, provider, awb, courier_name, tracking_url, etd, weight_grams, events:[{status, occurred_at}] }` or `null` when the order has no shipped lines |
| `GET/POST/PATCH/DELETE /customer/addresses…` | :137-:172 | CRUD + `PATCH /:id/default` — **present**, contrary to any assumption that it is missing |
| `GET /customer/loyalty` | `loyalty.controller.ts:35` | `{ points_balance, lifetime_points, tier, redeem_value_per_point, next_tier:{tier, points_needed}, transactions:[{id, delta, balance_after, reason, order_id, expires_at, created_at}] }` |
| `GET /customer/reviews`, `/pending`, `POST /customer/reviews` | `reviews.controller.ts:69,77,85` | pending → `[{ order_item_id, product:{id,name,slug}, order:{id,order_number,created_at} }]`; create → `400` not delivered · `403` other customer · `409` already reviewed |

**The quote object**, verbatim in shape: `quote_id`, `expires_at`, `channel`, `pickup`, `lines[]` (`product_id`, `variant_id`, `name`, `sku`, `quantity`, `type`, `fulfilment`, `unit_price`, `gross`, `tax_rate`, `tax`), `rejected[]` (`product_id`, `name`, `reason`), `subtotal`, `coupon` (`code`, `type`, `discount`) or `null`, `discount_amount`, `shipping` (`provider`, `courier_name`, `courier_id`, `etd`, `serviceable`), `shipping_amount`, `tax_amount`, `tax_breakup[]` (`rate`, `taxable`, `tax`), `loyalty` (`balance`, `tier`, `max_redeemable_points`, `points_applied`, `redeem_amount`, `redeem_value_per_point`, `points_earned_estimate`), `holds[]` (`booking_id`, `event_id`, `product_id`, `guests`, `expires_at`), `total`.
`total = subtotal − discount_amount − loyalty.redeem_amount + shipping_amount`. **`tax_amount` is inside `subtotal`.** Errors: `400` cart empty · `400` nothing available · `400` pincode not serviced · `400` coupon message · `503` Redis down.

### Customer auth (`backend/src/customer-auth/customer-auth.controller.ts`)

| Route | Line | Decorators | Status |
|---|---|---|---|
| `POST /customer-auth/send-otp` | 30 | `@Public()` + throttle 3/h | OK |
| `POST /customer-auth/verify-otp` | 37 | `@Public()` + throttle 10/h | OK — returns `{ customer:{id,phone,name}, isNewCustomer }` and sets the `customer_token` cookie |
| `GET /customer-auth/profile` | 47 | `@UseGuards(CustomerGuard)` — **no `@Public()`** | **GAP** (decision 12) |
| `PATCH /customer-auth/profile` | 54 | same | **GAP** — and has no `marketing_opt_in` field |
| `POST /customer-auth/logout` | 64 | same | **GAP** — blocks `ACCT-02` `jti` revocation |
| `POST /customer-auth/pusher-auth` | 70 | same | **GAP** — blocks `private-customer-{id}` subscription, so no live tracking |

### Staff commerce

| Route | File | Permission | Real response |
|---|---|---|---|
| `GET /shipments` | `shipments.controller.ts` | `MANAGE_OPS` | `{ items, next_cursor }`; `?status=&cursor=&limit=` |
| `GET /shipments/:id` | " | `MANAGE_OPS` | shipment + `events[]` |
| `POST /shipments/pack` | " | `MANAGE_OPS` | `{ order_id, weight_grams, pickup_location_code }` → shipment. **Idempotent** — packing twice returns the same row (`order_id @unique`, P2002 handled). `400` when the order has no shipped lines |
| `POST /shipments/:id/awb` | " | `MANAGE_OPS` | body `{ awb, courier_name, tracking_url }` **honoured only by the `manual` provider**; with `shiprocket` the body is ignored and values come from the API. `400` illegal transition · `503` unreachable |
| `POST /shipments/:id/pickup` | " | `MANAGE_OPS` | `status: pickup_scheduled`; **also moves `Order.status → shipped`** |
| `GET /shipments/:id/label` | " | `MANAGE_OPS` | **`200 {"label_url": null}`** for a `manual` shipment with an AWB — *not* the appendix's `400`. `400` is reserved for "no AWB assigned" |
| `POST /shipments/:id/cancel` | " | `MANAGE_OPS` | `{ reason }` → `status: cancelled` |
| `GET/POST /promotions/coupons` | `promotions/coupons.controller.ts` | `MANAGE_OPS` | `{ items, next_cursor }`, each row with `_count:{ redemptions }` |
| `PATCH/DELETE /promotions/coupons/:id` | " | `MANAGE_OPS` | **DELETE disables, it does not delete** |
| `GET /reviews?status=pending` | `reviews.controller.ts:97` | `MANAGE_OPS` | `{ items, next_cursor }` with `product` and `customer` joined |
| `PATCH /reviews/:id/publish` \| `/hide` | :112, :128 | `MANAGE_OPS` | sets `moderated_by`/`moderated_at`; rating rollup runs in **both** the service transaction and a DB trigger (identical values) |
| `GET /customers` | `customers.controller.ts` | `MANAGE_OPS` | `{ items:[{…, loyalty_account:{points_balance,tier}, _count:{orders,reviews,bookings}}], next_cursor }`; `?q=` |
| `GET /customers/:id` | " | `MANAGE_OPS` | adds `orders` (with `items` + `payment`), `loyalty_transactions`, `reviews`, `addresses`, `coupon_redemptions`, `orders_summary` |
| `POST /customers/:id/loyalty-adjust` | `loyalty.controller.ts:52` | `MANAGE_OPS` | `{ delta, notes }` → new account row; always writes `LoyaltyTransaction(reason: adjust)` + `AuditEvent` |
| `POST /orders/:id/refund` | `refunds.controller.ts` | `MANAGE_POS` | `{ amount?, reason }` (omit `amount` = full) → `Refund` row. Gateway failure → **`400` and the row stays `failed`**; `Payment.refunded_amount` accumulates; full refund sets `Order.status = refunded` **and claws loyalty back** |
| `GET /orders/:id/refunds` | " | `MANAGE_POS` | array, newest first |
| `POST /orders/:id/complete` | `orders.controller.ts` | `MANAGE_POS` | lifecycle |
| `PATCH /orders/:id/status` | " | `MANAGE_POS` | `400 Cannot transition from "X" to "Y". Valid transitions: …` — the message **lists the legal moves**, so the UI can render them |
| `POST /events/:id/attendance` | `events.controller.ts:118` | `MANAGE_OPS` | `{ booking_id, status: 'attended' \| 'no_show' }`; `attended` flips the linked `OrderItem` and opens the review gate |
| `PATCH /catalog/variants`, `DELETE /catalog/variants/:id` | `catalog.controller.ts:186,197` | `MANAGE_OPS` | variant upsert/delete |
| `POST /catalog/products/:id/media`, `DELETE /catalog/media/:id` | :203, :213 | `MANAGE_OPS` | media add (URL) / remove |
| `POST /storage/presign-*` | `storage.controller.ts` | various | **no product-media route exists** (decision 16) |

### Realtime

`backend/src/shipments/shipments.service.ts` triggers Pusher `shipment.updated` on the **`private-shipments`** channel — the channel `frontend/lib/hooks/use-realtime-channel.ts` already knows about and which no screen consumes yet. Customer-side tracking uses `private-customer-{customerId}`, authorised by `POST /customer-auth/pusher-auth` — which is one of the six broken routes (decision 12).

### Settings

Backend allowlist (`settings.service.ts:14-68`): `leaderboard_enabled`, `system_name`, `maintenance_mode`, `marketplace_fulfilment_zone_id`, `xp_rules`, `delivery_pincodes`, `shipping`, `loyalty`, `reviews`, `promotions`, `readiness`.
Frontend mirror (`lib/types/settings.ts`) is missing **`reviews`**, **`promotions`**, **`readiness`**, and — inside `loyalty` — **`expiry_days`** and **`max_redeem_percent`**. Task 1 closes it.

### Gaps found against the appendix

| # | Gap | Verdict |
|---|---|---|
| 1 | Six customer routes miss `@Public()` → `403` under the global `PermissionsGuard` | **P5b, Task 2** — blocks the whole account surface |
| 2 | `GET /catalog/availability/:productId` not `@Public()` | **P5b, Task 2** |
| 3 | `cart/sync` cannot shrink a cart or change only channel/address | **P5b, Task 2** |
| 4 | No `marketing_opt_in` on `PATCH /customer-auth/profile` | **P5b, Task 2** (`ACCT-01`) |
| 5 | No product-media presign route | **P5b, Task 2** (`OPS-01`) |
| 6 | No serviceability pre-check before a quote exists | **P5b, Task 2** — else the address step is trial-and-error |
| 7 | `Order.status → shipped` from `shipments.service.ts:650` writes no `AuditEvent` | **P5b, Task 2** — 5 lines, same file, and the order timeline reads better for it |
| 8 | `refund.failed` webhook branch unhandled | **Phase 35** — no P5b screen reads it; `Refund.status` already carries `failed` |
| 9 | 15-min hold vs 30-min pending order can strand a captured payment | **Phase 35** — contained in P5b by the countdown (decision 3) |
| 10 | `GET /usage/summary` returns `by_role`/`by_path`/`by_action`, not the appendix's `by_event` | no action — P5b does not build the usage dashboard (Phase 35) |
| 11 | `GET /shipments/:id/label` returns `200 {label_url:null}`, not `400` | no action — Task 14 handles both |

---

## Playwright decision (QA-06)

**P5b introduces Playwright and lands smoke test 2.** It is not deferred a third time.

The reasoning, stated so it is not re-litigated:

- `QA-03` (smoke 1) has now slipped twice — Phase 31 → 32, and Phase 32's carry-forward still records it as "not automated". `QA-06` is a **Phase 34 success criterion**. Deferring it again turns the requirement into shelf-ware, which is the exact failure mode SPEC's audit was written against.
- The reason it kept slipping is real but narrow: **Razorpay's checkout is a cross-origin iframe**, and `POST /customer/orders/confirm` re-fetches the payment from Razorpay and verifies an HMAC, so no stub can satisfy it. That is a wall, but it is a wall P5a already walked around.
- **The walk-around is documented and proven.** P5a §5c hit exactly this and used the *other* entry point into the same method: the signed `POST /webhooks/razorpay` `payment.captured` event, which reads the pending key and calls `FulfilmentService.confirmPaidOrder` directly. That is not a shortcut — SPEC §5.2.4 mandates that the webhook and the endpoint run the same service precisely so the two cannot diverge.

**So smoke 2 is split at the payment boundary, and both halves are real:**

1. Playwright drives the browser: `/shop` → facet filter → `/p/[slug]` → pick a variant → add a `local`, a `shipped` and a `booking` product → `/cart` (assert three fulfilment groups, assert no grand total) → `/checkout` → address → coupon `WELCOME10` → redeem 100 points → review step → assert the quote's line items, the `of which GST` line, the countdown, and `total = subtotal − discount − redeem + shipping` → click **Pay** → assert `POST /customer/orders` returned a `razorpay_order_id` and that the Razorpay modal opened (the script is stubbed via `page.route('https://checkout.razorpay.com/**')` so CI needs no network).
2. The test then posts the **signed** `payment.captured` webhook itself with the test secret — the same request P5a §5c recorded — and asserts the storefront's `/orders/[id]/track` renders the confirmed order with its three lines and shipment placeholder.

What this does **not** cover, stated honestly: the Razorpay-hosted card form, and `confirm`'s HMAC verification path. Both are exercised by backend unit specs and by a human walk-through recorded in the phase summary. Neither can be automated without a live Razorpay test account reachable from CI, which is a Phase 35 infrastructure question, not a P5b one.

`QA-03` (smoke 1) stays deferred to **Phase 35**, but its cost drops to ~one spec file because P5b builds the harness, the config, the fixtures and the CI job.

---

## File structure

**Create (frontend — storefront routes):**
- `app/(public)/shop/page.tsx`, `shop/[category]/page.tsx`, `shop/loading.tsx`
- `app/(public)/p/[slug]/page.tsx`, `p/[slug]/loading.tsx`, `p/[slug]/not-found.tsx`
- `app/(public)/experiences/page.tsx`, `experiences/[slug]/page.tsx`
- `app/(public)/search/page.tsx`
- `app/(public)/cart/page.tsx`
- `app/(public)/checkout/page.tsx`
- `app/(public)/account/page.tsx`, `account/orders/page.tsx`, `account/orders/[id]/page.tsx`, `account/addresses/page.tsx`, `account/loyalty/page.tsx`, `account/reviews/page.tsx`, `account/layout.tsx`
- `app/(public)/menu/page.tsx` (**replaced** by a `redirect()`), `app/(public)/events/page.tsx`, `events/[id]/page.tsx` (**replaced** by redirects), `app/(public)/profile/page.tsx` (**replaced** by a redirect)
- `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`

**Create (frontend — storefront components):** `components/storefront/` — `shell/{StorefrontHeader,StorefrontFooter,StorefrontNav,MiniCart,MiniCartTrigger}.tsx` · `catalog/{ProductGrid,StorefrontProductCard,FacetSidebar,FacetChips,CatalogSort,LoadMore,SearchInput,EmptyCatalog}.tsx` · `product/{ProductGallery,VariantPicker,AddToCartPanel,ProductMeta,ReviewSummary,ReviewList,AvailabilityNote}.tsx` · `experiences/{ExperienceCard,ExperienceGrid,CapacityNote,BookingPanel}.tsx` · `cart/{CartLineList,CartLine,CartFulfilmentGroup,RejectedLines,CartSummary,EmptyCart}.tsx` · `checkout/{CheckoutStepper,ContactStep,AddressStep,ServiceabilityNote,PickupToggle,FulfilmentStep,ReviewStep,CouponField,LoyaltySlider,QuoteSummary,QuoteCountdown,PayButton,QuoteErrorBanner}.tsx` · `track/{OrderTimeline,ShipmentTracker,ShipmentEventList,TrackHeader}.tsx` · `account/{AccountNav,OrderHistoryList,OrderHistoryCard,ReorderButton,AddressBook,AddressForm,LoyaltyPanel,LoyaltyLedger,PendingReviewList,ReviewComposer,MarketingOptInToggle}.tsx` · `common/{MoneyLine,PriceTag,StorefrontEmpty,StorefrontError,StorefrontSkeleton}.tsx`

**Create (frontend — staff screens):**
- `app/(ops)/shipments/page.tsx`, `shipments/[id]/page.tsx`
- `app/(ops)/promotions/page.tsx` · `app/(ops)/reviews/page.tsx`
- `app/(ops)/customers/page.tsx`, `customers/[id]/page.tsx`
- `app/(ops)/pos/orders/[id]/page.tsx`
- `components/ops/shipments/{ShipmentsTable,ShipmentStatusBadge,ShipmentFilterBar,PackDialog,AssignAwbDialog,SchedulePickupButton,LabelButton,CancelShipmentDialog,ShipmentEventTimeline,ToPackQueue}.tsx`
- `components/ops/promotions/{CouponTable,CouponForm,CouponSheet,CouponStatusBadge,CouponUsageCell}.tsx`
- `components/ops/reviews/{ReviewModerationTable,ReviewCard,ReviewFilterBar,ModerateReviewButtons}.tsx`
- `components/ops/customers/{CustomerTable,CustomerFilterBar,CustomerProfileHeader,CustomerOrdersPanel,CustomerLoyaltyPanel,LoyaltyAdjustDialog,CustomerReviewsPanel,CustomerAddressesPanel,MarketingOptInBadge}.tsx`
- `components/ops/pos/orders/{OrderDetailHeader,OrderLineTable,OrderPaymentPanel,OrderRefundPanel,RefundDialog,RefundHistoryTable,OrderLifecycleActions,OrderShipmentPanel,OrderTimelinePanel,OrderReceiptButton}.tsx`
- `components/ops/operations/events/{AttendanceSheet,AttendanceRow,HoldsPanel}.tsx`
- `components/ops/operations/menu/{VariantEditor,VariantRow,MediaManager,MediaUploader,MediaThumb}.tsx`

**Create (frontend — lib):** `lib/types/{storefront,checkout,shipments,promotions,reviews,customers,refunds}.ts` · `lib/seo/{metadata,json-ld}.ts` · `lib/format/{currency,date}.ts` · `lib/hooks/{use-quote,use-storefront-cart,use-shipments-realtime}.ts`

**Create (testing):** `frontend/playwright.config.ts` · `frontend/e2e/{smoke-2-purchase.spec.ts,fixtures/{customer,razorpay-stub,webhook}.ts}` · `frontend/e2e/README.md`

**Modify (frontend):** `app/tokens.css` (T3) · `app/(public)/layout.tsx` (T4) · `app/(auth)/layout.tsx` (T3, same latent light bug) · `next.config.ts` (T3) · `proxy.ts` (T3) · `eslint.config.mjs` (T3) · `lib/nav/spine.ts` (T3) · `components/ops/admin/module-routes.ts` (T3) · `lib/types/{catalog,marketplace,settings,index}.ts` (T1) · `lib/api-client.ts` (T1, status exposure) · `lib/stores/cart-store.ts` + `hooks/use-cart.ts` (T8) · `app/(public)/{error,loading}.tsx` (T4) · `app/(public)/login/page.tsx`, `feedback/[orderId]/page.tsx` (T12) · `app/(ops)/pos/orders/page.tsx` (T17) · `app/(ops)/operations/events/page.tsx` (T18) · `app/(ops)/operations/menu/page.tsx` + `components/ops/operations/menu/ProductForm.tsx` (T19) · `package.json` + `package-lock.json` (T20) · `.github/workflows/ci.yml` (T20).

**Delete (frontend):** `components/public/{CartBottomSheet,FloatingCartBar,CategoryTabBar,MenuBrandTabs,ProductOrderCard,ProductPublicCard,ChannelToggle,AvailabilityBadge,CapacityBadge,EventCard,EventCheckoutForm,EventBookingForm,AddressSelector,CustomerAddressCard,CustomerOrderCard,CustomerIdentityStrip,PaymentStatusPanel,PhoneLoginPrompt,FeedbackThankYou}.tsx` — each deleted by the task that replaces it, never in bulk.

**Modify (backend — Task 2 only):** `src/customer-auth/customer-auth.controller.ts`, `dto/update-customer.dto.ts`, `customer-auth.service.ts` · `src/events/events.controller.ts` · `src/catalog/catalog.controller.ts` · `src/customer-orders/customer-orders.service.ts` (+ `.spec.ts`) · `src/checkout/checkout.controller.ts`, `checkout.service.ts` (+ `.spec.ts`), `dto/serviceability.dto.ts` (new) · `src/storage/storage.controller.ts`, `dto/presign-product-media.dto.ts` (new) · `src/shipments/shipments.service.ts` (+ `.spec.ts`).

**Current state (verified at `29d47c7`):** `app/(public)` holds 10 files / 1,953 lines — `menu`, `events`, `events/[id]`, `orders/[id]/track`, `feedback/[orderId]`, `login`, `profile` (971 lines), plus `layout`, `loading`, `error`. **No `/shop`, `/p`, `/cart`, `/checkout`, `/search`, `/experiences`, `/account`.** `variantId` has **zero** matches repo-wide in `frontend/`. `hooks/use-cart.ts:35` posts an empty body to `POST /customer/orders`. `components/public/` holds 25 files. Raw palette literals: **59** hits across `app/(public)` + `components/public`, of which **22 are in the frozen `ScrollVideoStory.tsx`**, leaving **37** to sweep, plus 8 bare hex literals. `lib/nav/spine.ts:14-15,31,140,151` documents `shipments`/`customers`/`reviews`/`promotions` as seeded in `ModuleAccess` but deliberately routeless, "→ Phase 34". The staff catalog admin lives at `/operations/menu` (507 lines) with no variant and no media editor. The frontend has **no tests, no test runner and no Playwright**. `next.config.ts` is 9 lines with `images: { unoptimized: true }` and no `remotePatterns`.

---

### Task 1: Frontend type reconciliation, the money/format layer, and status-aware `apiClient`

The mirror the whole phase is typed against. No UI.

**Files:** create `lib/types/{storefront,checkout,shipments,promotions,reviews,customers,refunds}.ts`, `lib/format/{currency,date}.ts`, `lib/seo/{metadata,json-ld}.ts`; modify `lib/types/{catalog,marketplace,settings,index}.ts`, `lib/api-client.ts`.

- [ ] **`lib/types/storefront.ts`** — the *public* product shape, distinct from `catalog.ts`'s staff `Product`. `catalog.ts:99-105` declares `recipe.computed_cost` and `yield_qty`; the public route trims `recipe` to `{ id, preparation_type }` and `CAT-03` asserts cost never leaves it. Declare `StorefrontProduct` with `recipe?: { id: string; preparation_type: PreparationType } | null` and **no** cost fields, so a public component cannot even reference one. Add `CatalogEnvelope<T> = { items: T[]; next_cursor: string | null }`, `SearchEnvelope` (adds `facets: { types: TypeFacet[]; categories: CategoryFacet[] }` and `items[].rank`), `ProductReview`, `StorefrontCategory`.
- [ ] **`lib/types/checkout.ts`** — `Quote`, `QuoteLine`, `RejectedLine`, `QuoteCoupon`, `QuoteShipping`, `TaxBreakupRow`, `QuoteLoyalty`, `QuoteHold`, `QuoteRequest`, `CreateOrderResponse` (`{ razorpay_order_id; amount /* paise */; currency; key_id; quote_id }`), `CouponValidation`, `LoyaltySummary`, `CustomerShipment`. Every money field is `number`. Add the doc comment: *`tax_amount` is contained inside `subtotal` and is never added to a total.*
- [ ] **`lib/types/marketplace.ts`** — extend `CartItem` with `variantId: string | null`, `variantName?: string | null`, `fulfilment: FulfilmentType`, `available: boolean`, `unavailable_reason: string | null`; extend `CartData` with `totals: { subtotal: number; tax_total: number }`; extend `CustomerOrder` with `discount_amount`, `shipping_amount`, `tax_amount`, `coupon_id`, `loyalty_points_earned/redeemed`, and `items[].variant_id`, `items[].fulfilment`, `items[].status`, `items[].event_booking_id`. Keep `CustomerAddress` as is — it already matches.
- [ ] **`lib/types/settings.ts`** — add `ReviewsSetting { auto_publish_min_rating: number; invitation_delay_hours: number }`, `PromotionsSetting { allow_stacking: boolean }`, `ReadinessSetting {...}`; add `expiry_days` and `max_redeem_percent` to `LoyaltySetting`; extend `SettingValueMap`, `SETTING_KEYS`, `SETTING_DEFAULTS` and `SETTING_LABELS` so all eleven backend keys are mirrored. Values must match `backend/src/settings/settings.service.ts:14-68` exactly.
- [ ] **`lib/types/{shipments,promotions,reviews,customers,refunds}.ts`** — the staff shapes from the cross-check table above, including `_count` fields, the `{items,next_cursor}` envelopes, and the enums (`ShipmentStatus`, `CouponType`, `CouponStatus`, `ReviewStatus`, `RefundStatus`, `LoyaltyTier`, `LoyaltyReason`).
- [ ] **`lib/format/currency.ts`** — `formatCurrency(n: number): string` → `₹6,485.00` via `Intl.NumberFormat('en-IN', { style:'currency', currency:'INR' })`, `formatPaise(p: number)` for the Razorpay amount, and `assertInclusiveTotal(q)` — a dev-only invariant that throws when `total !== subtotal − discount_amount − loyalty.redeem_amount + shipping_amount`. Wire the assertion behind `process.env.NODE_ENV !== 'production'`.
- [ ] **`lib/api-client.ts`** — surface the HTTP status. Decision 4 needs `410` distinguishable from `404` and `400` at the call site. Add an exported `ApiError extends Error` carrying `status: number`, `body: unknown` and `message` (the server's human message, which the coupon and quote paths rely on), and throw it from the existing error path. Do not change any successful-response behaviour; every existing `catch {}` keeps working.
- [ ] **`lib/seo/metadata.ts`** — `storefrontMetadata({ title, description, path, image })` returning a Next `Metadata` with canonical, OpenGraph and Twitter blocks, `metadataBase` inherited from `app/layout.tsx:22`. `lib/seo/json-ld.ts` — `productJsonLd(p, reviews)` → schema.org `Product` with `offers`, `aggregateRating` (only when `rating_count > 0`) and `brand`; `eventJsonLd(e)` → `Event` with `offers` and `location`; `breadcrumbJsonLd(trail)`. Each returns a plain object; pages render it with `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }} />`.
- [ ] **`lib/types/index.ts`** — re-export the new modules. **This file has exactly one owner in P5b (this task).**

**Verification:** `npx tsc --noEmit` exit 0 · `npm run lint` 0 errors · `npm run build` compiles · `grep -rn "computed_cost\|yield_qty" lib/types/storefront.ts` → no output · the eleven setting keys match `backend/src/settings/settings.service.ts` one for one.

---

### Task 2: The seven backend gaps the storefront cannot work without

Small, surgical, and the only backend task in the phase. **Every change is additive or a decorator.**

**Files:** `backend/src/customer-auth/{customer-auth.controller.ts,customer-auth.service.ts,dto/update-customer.dto.ts}` · `src/events/events.controller.ts` · `src/catalog/catalog.controller.ts` · `src/customer-orders/customer-orders.service.ts(.spec.ts)` · `src/checkout/{checkout.controller.ts,checkout.service.ts(.spec.ts),dto/serviceability.dto.ts}` · `src/storage/{storage.controller.ts,dto/presign-product-media.dto.ts}` · `src/shipments/shipments.service.ts(.spec.ts)`.

- [ ] **Step 0 — reproduce before fixing.** Build and boot (`npm run build && PORT=4021 node dist/src/main.js`), log a customer in via the real OTP flow (`POST /customer-auth/send-otp` `{"phone":"9900000001"}`, read `[DEV] OTP for 9900000001: ……` from the server log, `POST /customer-auth/verify-otp`), then `GET /customer-auth/profile` with the `customer_token` cookie. **Record the actual status code in the commit message.** If it is `200`, decision 12 is wrong — stop, report, and skip the guard fix; every other step still stands.
- [ ] **Gap 1 — the six routes.** Add `@Public()` to `customer-auth.controller.ts` lines 47, 54, 64, 70 and `events.controller.ts` lines 73, 84, each with the same one-line comment the P5a controllers carry: `// Bypass global JwtAuthGuard — CustomerGuard handles auth`. `CustomerGuard.handleRequest` already rejects a missing or staff token with `401`, so the routes stay closed; only `PermissionsGuard`'s blanket customer rejection is bypassed. Add a controller spec asserting the decorator is present on each of the six handlers (`Reflect.getMetadata(IS_PUBLIC_KEY, handler)`), so a future refactor cannot silently re-break the account surface.
- [ ] **Gap 2 — availability.** Add `@Public()` to `catalog.controller.ts:231` (`GET /catalog/availability/:productId`). Assert in the catalog spec that the per-product route returns the same `CAT-03`-clean projection as the batch route.
- [ ] **Gap 3 — the cart merge rule.** `customer-orders.service.ts:360` currently keeps the stored cart when `existing.items.length >= localCart.items.length`. Replace with: the incoming cart is authoritative on every explicit `POST /customer/cart/sync`; the stored cart is read **only** when the incoming `items` array is empty **and** the caller did not pass `channel`/`deliveryAddressId` (the login-merge case the rule was written for). Add specs for: removing a line persists; changing only `deliveryAddressId` persists; an empty sync at login still restores the stored cart.
- [ ] **Gap 4 — marketing opt-in.** Add `marketing_opt_in?: boolean` to `UpdateCustomerDto` (`@IsOptional() @IsBoolean()`) and persist it in `CustomerAuthService.updateProfile`, writing an `AuditEvent` like the other profile fields. `ACCT-01`.
- [ ] **Gap 5 — product-media presign.** Add `POST /storage/presign-product-media` guarded by `@RequiresPermission(Permission.MANAGE_OPS)` (matching `catalog.controller.ts:203`), keyed `product-media/{productId}/{Date.now()}-{sanitised filename}`, reusing `validatePresignRequest`, `generatePresignedPutUrl` and `getPublicUrl`. Returns `{ presignedUrl, key, publicUrl }` exactly like its three siblings. `OPS-01`.
- [ ] **Gap 6 — serviceability pre-check.** Add `POST /customer/checkout/serviceability` on `CheckoutController` (same `@Public()` + `CustomerGuard` class decorators) taking `{ pincode, channel? }` and returning `{ local: { serviceable: boolean; reason?: string }, shipped: { serviceable: boolean; courier_name?: string; etd?: string; amount?: number } | null }`. It reuses `ServiceabilityService.allowedPincodes()` and the shipping provider's `checkServiceability` — **no new logic**, it just exposes what the quote already computes so the address step can validate before a quote exists. Cart contents are read to decide whether the `shipped` half is even relevant.
- [ ] **Gap 7 — the audit hole.** `shipments.service.ts:650` moves `Order.status → shipped` directly (deliberately bypassing `STATUS_TRANSITIONS`) and writes no `AuditEvent`, so the order trail jumps from `order.confirmed` to a `status_changed` whose `before` is already `shipped`. Write an `AuditEvent(entity_type:'order', action:'order.status_changed', before:{status}, after:{status:'shipped'}, actor:…)` inside the same transaction. Five lines; the order detail timeline (Task 17) reads better for it.

**Verification:** `npx jest --silent` (all suites green, new specs included) · `npx tsc --noEmit -p tsconfig.build.json` exit 0 · `npx eslint "{src,apps,libs,test}/**/*.ts"` 0 errors · `npx prisma validate` · **runtime**: re-run step 0 and record `200`; `POST /customer/cart/sync` with two items then one item and confirm the stored cart holds one; `POST /customer/checkout/serviceability` with a seeded and an unseeded pincode; `POST /storage/presign-product-media` as `FOUNDER_ADMIN` returns a URL and as a customer returns `403`.

---

### Task 3: Cross-cutting config — the real light pin, the colour sweep, `next.config.ts`, `proxy.ts`, and the four spine entries

Every file that more than one later task would otherwise want to touch, edited exactly once, up front.

**Files:** `app/tokens.css` · `app/(public)/layout.tsx` *(selector + `color-scheme` only — Task 4 owns its structure)* · `app/(auth)/layout.tsx` · `next.config.ts` · `proxy.ts` · `eslint.config.mjs` · `lib/nav/spine.ts` · `components/ops/admin/module-routes.ts` · the 37 raw-colour literals in `components/public/**`.

- [ ] **Make `.light` real.** In `app/tokens.css`, change the layer-2/3 light block's selector at line 38 from `:root {` to `:root,\n.light {`. Leave the `--public-*` block at line 12 on bare `:root` (those values have no dark variant by design) and leave `.dark` at line 85 untouched. Add `color-scheme: light;` inside the `.light` rule and `color-scheme: dark;` inside `.dark`. Verify by loading `/menu` with the OS in dark mode: the page must render light **and** the ops `/dashboard` must still go dark.
- [ ] **Confirm the pin at the wrapper.** `app/(public)/layout.tsx:11` already has `className="light …"` — keep it. `app/(auth)/layout.tsx` has the same latent bug; add `light` to its root element. Do not restructure either layout (Task 4 owns the public one).
- [ ] **Sweep the 37 raw literals** in `components/public/**` — per-file counts to hit: `AddressSelector` 2, `CartBottomSheet` 3, `CategoryTabBar` 1, `ChannelToggle` 2, `CustomerOrderCard` 1, `CustomerOtpForm` 5, `EventCheckoutForm` 2, `FloatingCartBar` 2, `GooglePlacesInput` 2, `OtpDigitInput` 1, `PaymentStatusPanel` 1, `PhoneLoginPrompt` 1, `ProductOrderCard` 2, plus the 8 bare hex literals. Replace each with the matching `--public-*` or semantic token (`bg-white` on a card → `bg-[var(--surface)]`; `text-white` on a terracotta button → `text-[var(--accent-ink)]`; the dark cart bar → `bg-[var(--public-cart-bar)] text-[var(--public-cart-bar-fg)]`, which already exists for it). **Do not touch `components/public/ScrollVideoStory.tsx` (22 hits, frozen) or `app/page.tsx`.** **Do not sweep `app/(public)/profile/page.tsx` (12 hits)** — Task 12 deletes it; sweeping it is wasted work.
- [ ] **Promote the lint rule where the new code lives.** `eslint.config.mjs` carries `no-raw-colors` at **warn** for the storefront paths with a comment that the ceiling ratchets down "when Phase 34 lands". Add an `error`-level block scoped to the paths this phase creates — `app/(public)/{shop,p,experiences,search,cart,checkout,account,orders}/**`, `components/storefront/**` — and leave the legacy paths at warn. Task 20 removes the warn block once the legacy files are gone. **A sibling agent is concurrently editing this file for Phase 32's record; on conflict keep both blocks.**
- [ ] **`next.config.ts`** — remove `images: { unoptimized: true }` and add `images: { remotePatterns: [{ protocol: 'https', hostname: <R2_PUBLIC_URL host>, pathname: '/**' }], formats: ['image/avif','image/webp'] }`. Read the host from `NEXT_PUBLIC_R2_PUBLIC_URL` at config time with a literal fallback so a missing env var cannot break the build. Media are unsigned public CDN URLs (decision 15), so optimisation is safe. Do **not** add `next.config` redirects — the `/menu` and `/events` redirects are route-level (Task 13) so the `(public)` layout still applies.
- [ ] **`proxy.ts`** — extend `PUBLIC_PATHS` (line 5) to `['/login', '/menu', '/events', '/feedback', '/profile', '/shop', '/p', '/experiences', '/search', '/cart', '/checkout', '/account', '/orders']`. Add the comment that staff orders live at `/pos/orders`, so `/orders` is unambiguous (decision 9). Note that `PUBLIC_PATHS` uses bare `startsWith`, unlike `STAFF_AUTH_PAGES`'s segment-aware `matchesPath` — switch `PUBLIC_PATHS` to `matchesPath` too, so `/p` cannot swallow `/permissions` and `/search` cannot swallow a future `/search-admin`. **This is a correctness fix, not a style change — verify `/permissions` still requires staff auth afterwards.**
- [ ] **`lib/nav/spine.ts`** — land all four Phase-34 entries at once, replacing the "→ Phase 34" comments at lines 140 and 151: into the `commerce` group after `delivery` → `{ moduleKey: 'shipments', label: 'Shipments', href: '/shipments', icon: PackageCheck }`, `{ moduleKey: 'customers', label: 'Customers', href: '/customers', icon: Users }`, `{ moduleKey: 'reviews', label: 'Reviews', href: '/reviews', icon: Star }`; into the `catalog` group → `{ moduleKey: 'promotions', label: 'Promotions', href: '/promotions', icon: TicketPercent }`. Update the file's header comment (lines 14-15, 26-27, 31) so it no longer says these are routeless. Add the same four to `components/ops/admin/module-routes.ts` (which maps `catalog: '/operations/menu'` at line 80). **This file has exactly one owner in P5b (this task);** the routes themselves land in Wave 1, and a sidebar link that 404s for one wave is invisible because nothing is deployed mid-wave.

**Verification:** `npx tsc --noEmit` exit 0 · `npm run lint` 0 errors · `npm run build` compiles · `grep -rn "bg-white\|text-white\|bg-black\|text-black" components/public --include=*.tsx | grep -v ScrollVideoStory` → no output · `grep -n "\.light" app/tokens.css` → the new selector · **manual, OS set to dark**: `/menu` renders light, `/team` (sign-in) renders light, `/dashboard` renders dark, the ops theme toggle still switches · **manual**: anonymous `GET /shop` is not redirected to `/team`; anonymous `GET /permissions` still is · the four new items appear in the sidebar for `FOUNDER_ADMIN`.

---

### Task 4: The storefront shell — desktop chrome, nav, mini-cart mount

`STORE-04`. The frame every storefront page renders into. Desktop is designed, not stretched.

**Files:** modify `app/(public)/layout.tsx`, `app/(public)/{loading,error}.tsx`; create `components/storefront/shell/{StorefrontHeader,StorefrontFooter,StorefrontNav,MiniCartTrigger}.tsx`, `components/storefront/common/{StorefrontEmpty,StorefrontError,StorefrontSkeleton,MoneyLine,PriceTag}.tsx`.

- [ ] Rebuild `app/(public)/layout.tsx` as a **server** component keeping `className="light"` (now load-bearing) and a `max-w-7xl` content well. Today's header is a 14px-tall bar with a logo and one "Account" link (lines 12-26) — a phone layout stretched to desktop. Replace with a two-row header: a slim utility row (brand promise, `/account` or "Sign in", loyalty points when known) and a main row (logo · primary nav `Shop / Experiences / Search` · search affordance · mini-cart trigger). Collapse to a single row with a sheet-based nav below `md`.
- [ ] `StorefrontNav` — `Shop` (`/shop`), category links read server-side from `GET /catalog/categories` and grouped by brand, `Experiences` (`/experiences`), `Search` (`/search`). Active state by `usePathname` longest-match, mirroring `lib/nav/spine.ts:235`'s rationale so `/shop` does not light up for `/shop/pantry`.
- [ ] `MiniCartTrigger` — a client island reading `useCartStore` for the line count only. It renders the count and opens the `MiniCart` sheet Task 8 provides; it must **not** import the cart's pricing logic, so the shell stays server-rendered around one small client boundary.
- [ ] `StorefrontFooter` — replace the 10px "Powered by" strip with a real footer: brand blurb, catalog links, `/experiences`, account links, and legal. Keep it token-only.
- [ ] `components/storefront/common/` — `MoneyLine` (label + `formatCurrency` value + optional `of which` variant, the primitive that makes decision 5 the default), `PriceTag` (base + variant delta + strike-through when a variant reduces price), `StorefrontSkeleton`, `StorefrontEmpty`, `StorefrontError`. Every list in Wave 2 uses these three states — `DESIGN-03`.
- [ ] Rewrite `app/(public)/loading.tsx` and `error.tsx` against the new shell. `error.tsx:38` currently sends the customer to `/menu`; send them to `/shop`.

**Verification:** `tsc` + `lint` + `build` green · **manual at 1440px, 1024px, 768px and 390px**: header, nav and footer are laid out for each, no horizontal scroll, nav collapses at `md` · `grep -n "use client" "app/(public)/layout.tsx"` → no output (the layout stays a server component) · the mini-cart trigger shows a live count after adding an item.

---

### Task 5: `/shop`, `/shop/[category]` and `/search` — server components, facets, metadata

`STORE-01`. Three routes, one component family.

**Files:** create `app/(public)/shop/{page.tsx,loading.tsx}`, `shop/[category]/page.tsx`, `app/(public)/search/page.tsx`; `components/storefront/catalog/{ProductGrid,StorefrontProductCard,FacetSidebar,FacetChips,CatalogSort,LoadMore,SearchInput,EmptyCatalog}.tsx`.

- [ ] **All three pages are server components** with `generateMetadata`. Fetch on the server with `fetch(..., { next: { revalidate: 60 } })` — matching the backend's own 60 s cache — never through the client `apiClient` (which is cookie-bound and client-only). Read the envelope `{ items, next_cursor }` (decision 21).
- [ ] `/shop` accepts `?type=`, `?category_id=`, `?brand_id=`, `?cursor=`. **`?type=prepared_food` is the target of the `/menu` redirect**, so it must produce the same product set today's `/menu` shows. `/shop/[category]` resolves the slug via `GET /catalog/categories`, 404s on an unknown slug via `notFound()`, and sets a category-specific title/description.
- [ ] `/search` reads `?q=`, `?type=`, `?category_id=` and calls `GET /catalog/search`, rendering `facets.types` and `facets.categories` as counted chips. An empty `q` renders the search prompt, not an error. `robots: { index: false }` on `/search` — a query-string result page is not a canonical URL.
- [ ] `FacetSidebar` (desktop, `lg:` and up) and `FacetChips` (below `lg`) drive facets through **URL search params**, not client state, so the page stays server-rendered, shareable and back-button-correct. `LoadMore` is the one client island: it appends pages by pushing `?cursor=` and merges results.
- [ ] `StorefrontProductCard` — `next/image` (now optimised, Task 3) with `sizes`, name, `PriceTag` (base price, "+₹x" when the cheapest variant carries a delta), rating stars when `rating_count > 0`, a type chip (`Prepared food` / `Packaged` / `Experience` / `Merchandise` from `PRODUCT_TYPE_LABELS`), and an availability note. **No add-to-cart on the card for products with variants** — a variant choice cannot be made from a grid, so those cards link to `/p/[slug]`; single-variant and variantless products get a quick-add.
- [ ] Loading, empty and error states on all three (`DESIGN-03`). Empty is specific: "No products in Pantry yet" ≠ "No results for 'xyz'".
- [ ] Delete `components/public/{CategoryTabBar,MenuBrandTabs,ProductPublicCard}.tsx`.

**Verification:** `tsc` + `lint` + `build` green, and the build output lists `/shop`, `/shop/[category]` and `/search` as **server** routes · `grep -rn "use client" "app/(public)/shop" "app/(public)/search"` → matches only in `LoadMore`-style islands, never in a `page.tsx` · **manual**: `/shop?type=prepared_food` matches today's `/menu` contents; a facet click changes the URL and the results; the generated `<title>` is present in the server HTML; `/search?q=coconut` shows counted facets.

---

### Task 6: `/p/[slug]` — variants, media, reviews, add-to-cart with `variantId`, JSON-LD

`STORE-01`. The page that makes `variantId` real, and the single most load-bearing storefront route.

**Files:** create `app/(public)/p/[slug]/{page.tsx,loading.tsx,not-found.tsx}`; `components/storefront/product/{ProductGallery,VariantPicker,AddToCartPanel,ProductMeta,ReviewSummary,ReviewList,AvailabilityNote}.tsx`.

- [ ] Server component. `generateMetadata` from `GET /catalog/products/slug/:slug` — title, description, canonical, OG image from the first `media[]` image. `notFound()` on a missing slug. Emit `productJsonLd` (Task 1) with `offers` priced at `base_price` (+ the default variant's delta), `aggregateRating` only when `rating_count > 0`, and `breadcrumbJsonLd`.
- [ ] `ProductGallery` — `media[]` (`kind: 'image' | 'video'`) as a desktop two-column gallery with thumbnails, a single swipeable strip below `md`, `next/image` with `priority` on the first frame. Fall back to a token-coloured placeholder when `media` is empty (the demo seed has 12 media across 12 products, so empties are real).
- [ ] **`VariantPicker`** — renders `variants[]` when there is more than one. Selection state seeds from `is_default`. Each option shows `name`, the effective price (`base_price + price_delta`), and — for `stock_mode: 'tracked'` — its own availability from `stock_on_hand`. The selected `variant.id` is what `AddToCartPanel` puts in the cart. **A product with variants can never be added without one selected.**
- [ ] `AddToCartPanel` — quantity stepper, the add button, and per-type behaviour driven by `product.type` / `fulfilment`: `prepared_food`/`packaged`/`merchandise` add a cart line; `experience` links to `/experiences/[slug]` rather than adding blind (capacity and date live there). Calls `useCart().addItem({ productId, variantId, name, unitPrice, imageUrl, fulfilment })`. Optimistic (decision 24 permits it — it is not the money path).
- [ ] `AvailabilityNote` — reads `GET /catalog/availability/:productId` (public after Task 2) on the client with a 60 s refetch. Copy per `stock_mode`: `derived_from_recipe` → "Made to order · N servings left today"; `tracked` → "N in stock" / "Out of stock"; `capacity` → defer to the experience page.
- [ ] `ReviewSummary` + `ReviewList` — `GET /catalog/products/:id/reviews` (`{items,next_cursor}`), average from `rating_avg`/`rating_count`, a star distribution, and paginated published reviews showing `customer.name` only. Empty state invites the first review.
- [ ] `ProductMeta` — `story`, `description`, `hsn_code`, `weight_grams`, `shelf_life_days` where present, rendered as a definition list. **Never** render a cost, yield or margin field — `StorefrontProduct` (Task 1) makes that a type error.
- [ ] Delete `components/public/{ProductOrderCard,AvailabilityBadge}.tsx`.

**Verification:** `tsc` + `lint` + `build` green, `/p/[slug]` listed as a server route · the server HTML contains at least one `application/ld+json` block and it validates as schema.org `Product` · **manual**: the coconut oil and the ceramic mug both show a working variant picker; adding variant A then variant B yields **two** cart lines at their own prices; `grep -rn "variantId" components/storefront/product` → present.

---

### Task 7: `/experiences` and `/experiences/[slug]` — capacity, booking into the cart, `Event` JSON-LD

`STORE-01`, `CAT-04`.

**Files:** create `app/(public)/experiences/{page.tsx,[slug]/page.tsx}`; `components/storefront/experiences/{ExperienceCard,ExperienceGrid,CapacityNote,BookingPanel}.tsx`.

- [ ] Server components with `generateMetadata`; `/experiences/[slug]` emits `eventJsonLd` with `startDate`, `endDate`, `location`, `offers` and `eventStatus`.
- [ ] `/experiences` lists `type: 'experience'` products via `GET /catalog/products?type=experience`, each joined to its `event` (`Product.event_id`, present in the public projection). Group by upcoming / past; `EventStatus` `draft` and `cancelled` never appear.
- [ ] `BookingPanel` (client) — guest-count stepper bounded by remaining capacity from `GET /catalog/availability/:productId`, then adds a `fulfilment: 'booking'` line to the cart. **The hold is not created here** — SPEC §5.2.2 creates the 15-minute `EventBooking` hold at *quote* time, and the quote returns it in `holds[]`. The panel must say so plainly: "Your place is held for 15 minutes once you reach checkout." Getting this wrong would double-book.
- [ ] `CapacityNote` — "N of M places left", and a sold-out state that disables the panel.
- [ ] Existing `/events` and `/events/[id]` become redirects in Task 13; this task does not touch them.
- [ ] Delete `components/public/{EventCard,EventCheckoutForm,EventBookingForm,CapacityBadge}.tsx`.

**Verification:** `tsc` + `lint` + `build` green, both routes server-rendered · JSON-LD present and valid on the detail page · **manual**: the seeded Fermentation Workshop shows correct remaining capacity, adds a booking line, and the 15-minute-hold copy is visible before checkout.

---

### Task 8: The cart store v3, the `use-cart` rewrite, and the mini-cart

The task the ROADMAP calls Phase 34's first: `hooks/use-cart.ts:35` posts an empty body to an endpoint that now requires `{ quote_id }`.

**Files:** `lib/stores/cart-store.ts`, `hooks/use-cart.ts`, `lib/hooks/{use-quote.ts,use-storefront-cart.ts}`, `components/storefront/shell/MiniCart.tsx`. **These files have exactly one owner in P5b (this task).**

- [ ] **`cart-store.ts` → v3.** Add `variantId: string | null` to every line and key lines by `` `${productId}:${variantId ?? ''}` ``. `addItem`, `removeItem` and `updateQuantity` take the composite key, not a bare `productId` (lines 31, 46, 51 today). Bump `version: 3` and keep the existing `migrate: () => ({ items: [], … })` drop-on-upgrade behaviour (line 91) — a v2 cart has no variant information and cannot be salvaged. Extend the `merge` guard (line 108) to also drop lines missing `variantId` as a key. Keep `channel`/`deliveryAddressId`; `getSubtotal` stays a *local optimistic* number and is never displayed as an authoritative total.
- [ ] **`use-cart.ts` — the whole purchase pipeline.** Replace the three stubs with:
  - `syncToServer()` → `POST /customer/cart/sync` sending `{ items: [{productId, variantId, quantity}], channel, deliveryAddressId }`, replacing the local cart with the server's priced result including `fulfilment`, `available` and `unavailable_reason`, and surfacing `totals`. Depends on Task 2 gap 3 to be able to shrink a cart.
  - `requestQuote(input)` → `POST /customer/checkout/quote`, returning the `Quote`. Errors are read from `ApiError.message` (Task 1) and surfaced verbatim.
  - `createOrder(quoteId)` → `POST /customer/orders {quote_id}` returning `{ razorpay_order_id, amount, currency, key_id }`. **Maps `410` → `'requote'`, `404` → `'restart'`, `400` → `'stale'` + message** (decision 4) as a typed result, not a thrown string.
  - `confirmOrder(payload)` → `POST /customer/orders/confirm`, clears the cart, returns the order.
- [ ] **`lib/hooks/use-quote.ts`** — owns the quote lifecycle (decision 3): holds the current `Quote`, exposes `expiresAt`, a `secondsLeft` countdown ticking on a single `setInterval` (cleared on unmount), `isExpired`, and `refresh()`. Re-quotes when a quote input changes, never on unrelated re-renders.
- [ ] **`MiniCart.tsx`** — the sheet the shell's trigger opens: lines with thumbnails, variant names, quantity steppers, per-line prices, "Subtotal (incl. GST)" and **no** grand total (decision 6), a "View cart" link to `/cart` and a "Checkout" link to `/checkout`. Rejected/unavailable lines render dimmed with their `unavailable_reason`.
- [ ] Delete `components/public/{CartBottomSheet,FloatingCartBar}.tsx`.

**Verification:** `tsc` + `lint` + `build` green · `grep -n "apiClient.post<.*>('/customer/orders')" hooks/use-cart.ts` → **no output** (the empty-body call is gone) · `grep -c "variantId" lib/stores/cart-store.ts hooks/use-cart.ts` → non-zero in both · **manual**: add two variants of one product → two lines; reload the page → the persisted v3 cart survives; a stale v2 `cart-storage` in `localStorage` is dropped, not half-read.

---

### Task 9: `/cart` — server-priced, mixed fulfilment, rejected lines

`STORE-02`.

**Files:** create `app/(public)/cart/page.tsx`; `components/storefront/cart/{CartLineList,CartLine,CartFulfilmentGroup,RejectedLines,CartSummary,EmptyCart}.tsx`.

- [ ] Client page (SPEC §5.1 marks `/cart` client). `export const metadata` with `robots: { index: false }` — a cart is not indexable.
- [ ] On mount and on every quantity change (debounced 400 ms) call `syncToServer()`. **The server's prices win**; the optimistic local subtotal is replaced by `totals.subtotal`. A line whose `unitPrice` changed shows a quiet "price updated" marker rather than silently swapping the number.
- [ ] `CartFulfilmentGroup` — group lines by `fulfilment` into three labelled sections: **Delivered from the villa** (`local`), **Shipped to you** (`shipped`), **Booked experiences** (`booking`), each with a one-line explanation of how it will be fulfilled. This is what makes mixed fulfilment legible instead of confusing.
- [ ] `RejectedLines` — lines with `available: false` render in a distinct block above the summary with `unavailable_reason` verbatim, a "Remove" action and a "Remove all unavailable" action. **Checkout is blocked while any unavailable line remains**, with the reason stated on the disabled button — the quote would 400 anyway, and failing here is kinder.
- [ ] `CartSummary` — "Subtotal (incl. GST)" from `totals.subtotal`, an "of which GST" line from `totals.tax_total` rendered as `MoneyLine` in its `of which` variant, and the explicit note "Shipping, coupons and loyalty are calculated at checkout" (decision 6). **No grand total.** Primary action → `/checkout`.
- [ ] `EmptyCart` — links to `/shop` and `/experiences`.
- [ ] Not-logged-in state: the cart is local-only until sign-in (`syncToServer` no-ops without a customer, as it does today at `use-cart.ts:15`). The summary shows a "Sign in to check out" action routing to `/login?redirect=/cart`.

**Verification:** `tsc` + `lint` + `build` green · **manual**: a cart with a local, a shipped and a booking line shows three groups; reducing a quantity to 0 removes the line **and the server agrees on re-sync** (proves Task 2 gap 3); an out-of-stock line blocks checkout with its reason shown; no grand total appears anywhere on the page.

---

### Task 10: `/checkout` — address, serviceability, coupon, loyalty, quote with countdown, Razorpay, confirm

`STORE-02`. The money path.

**Files:** create `app/(public)/checkout/page.tsx`; `components/storefront/checkout/{CheckoutStepper,ContactStep,AddressStep,ServiceabilityNote,PickupToggle,FulfilmentStep,ReviewStep,CouponField,LoyaltySlider,QuoteSummary,QuoteCountdown,PayButton,QuoteErrorBanner}.tsx`.

- [ ] Client page, `robots: { index: false }`. Three steps (decision 3): **Contact → Fulfilment → Review**. Desktop renders steps 1–2 in a left column with a sticky `QuoteSummary` on the right; below `lg` it is a single stacked flow with the summary collapsed into a bottom bar.
- [ ] **ContactStep** — requires a customer session. Anonymous visitors get the OTP form inline (reusing `components/public/CustomerOtpForm.tsx` and `OtpDigitInput.tsx`, which survive) rather than a redirect that loses the cart.
- [ ] **AddressStep** — `GET /customer/addresses` list + create/edit via `react-hook-form + zod` (`DESIGN-03`), reusing `GooglePlacesInput`. `PickupToggle` switches local lines to pickup and hides the address requirement for them. On pincode change, call `POST /customer/checkout/serviceability` (Task 2 gap 6) and render `ServiceabilityNote` **before** any quote exists: local serviceable / not serviced (offer pickup), shipped serviceable with courier and ETD / not serviceable. **This is why gap 6 is in scope** — without it the customer fills everything in and gets a 400.
- [ ] **ReviewStep** — entering it calls `requestQuote`. Render `QuoteSummary` from the real object: every `lines[]` row with quantity and `gross`; `rejected[]` in a warning block; "Subtotal (incl. GST)"; the coupon discount as a negative line when `coupon` is non-null; the loyalty redemption as a separate negative line (decision 23 — never merged); `shipping_amount` with `shipping.courier_name` and `etd`; **`tax_amount` as an "of which GST" line with the `tax_breakup[]` rates expandable, never added**; and `total`. Run `assertInclusiveTotal` in dev.
- [ ] **CouponField** — apply calls `POST /customer/coupons/validate` for instant feedback, then re-quotes so the server is the authority (SPEC §5.4: validated only in the quote). Invalid codes show the backend's message verbatim (`This coupon has expired`, `Add ₹150.00 more to use this coupon`, `You have already used this coupon`, …). One coupon only — no stacking UI.
- [ ] **LoyaltySlider** — bounded by `loyalty.max_redeemable_points`, showing points → rupees at `redeem_value_per_point` live, plus balance, tier and `points_earned_estimate`. Changing it re-quotes (debounced 600 ms). Zero-balance customers see the panel collapsed with their balance, not a broken slider.
- [ ] **QuoteCountdown** — `mm:ss` from `expires_at`, warning-toned under 3 minutes. At zero: `PayButton` disables, a `QuoteErrorBanner` explains that the price and any booking hold have expired, and a "Refresh price" button re-quotes. This is the containment for P5a risk 5 (a payment captured after its hold was swept).
- [ ] **PayButton** — `createOrder(quote_id)` → `useRazorpay().openCheckout({ razorpayOrderId, prefill })`. `hooks/use-razorpay.ts` already loads the script, reads the brand colour from `--public-terracotta` and handles `ondismiss`/`payment.failed` — **reuse it unchanged**. On the Razorpay `handler` callback, call `confirmOrder(...)` and `router.push('/orders/{id}/track')`. Handle `createOrder`'s three outcomes (decision 4): `'requote'` (410) → re-quote in place with an informational banner; `'restart'` (404) → toast and `router.push('/cart')`; `'stale'` (400) → show the server message and re-quote.
- [ ] Handle a dismissed modal without losing state: the quote stays live, the countdown keeps running, the button returns to "Pay ₹x".

**Verification:** `tsc` + `lint` + `build` green · **manual, end to end against the seeded demo customer `9900000001`**: mixed cart → address in a seeded pincode → `WELCOME10` applied (₹200 off) → 100 points redeemed (₹25) → the summary reproduces P5a's recorded numbers (subtotal 6710, discount 200, redeem 25, shipping 0, tax_amount 364.17 shown as *of which*, total 6485) → Pay opens Razorpay → dismissing keeps the quote → the countdown expires and disables Pay → "Refresh price" issues a new quote · `EXPIRED5` shows `This coupon has expired` verbatim.

---

### Task 11: `/orders/[id]/track` — order timeline, shipment tracking, Pusher

`STORE-03`.

**Files:** rewrite `app/(public)/orders/[id]/track/page.tsx` (234 lines today); create `components/storefront/track/{TrackHeader,OrderTimeline,ShipmentTracker,ShipmentEventList}.tsx`.

- [ ] Client page (live data). `GET /customer/orders/:id` for the order, `GET /customer/orders/:id/shipment` for the shipment (**may be `null`** when the order has no shipped lines — the single most common shape bug here).
- [ ] `OrderTimeline` — per-fulfilment progress, not one generic bar: `local` lines follow `placed → confirmed → preparing → ready → served/delivered`; `booking` lines show the event date and `held → confirmed → attended`; `shipped` lines defer to `ShipmentTracker`. Reuse `components/public/OrderTrackingTimeline.tsx` where its shape still fits.
- [ ] `ShipmentTracker` — AWB, courier, `tracking_url` (external link), `etd`, current `status` as a labelled badge, and `ShipmentEventList` rendering `events[]` newest-first. Handle the P5a-recorded forward-skip: a courier may report `delivered` with no intermediate scan, so the timeline renders from `events[]`, never from an assumed sequence.
- [ ] **Pusher.** Subscribe to `private-customer-{customerId}` via `lib/hooks/use-customer-pusher-channel.ts` and invalidate the order and shipment queries on an update. **This depends on Task 2 gap 1** — `POST /customer-auth/pusher-auth` is one of the six broken routes, so without it the subscription silently fails. Fall back to a 30 s poll when Pusher is unconfigured (`IA-07`'s polling floor).
- [ ] Receipt link → `GET /customer/orders/:id/receipt`. Money rendered with the inclusive-tax rule (decision 5) and the discount split reconstructed per decision 23.

**Verification:** `tsc` + `lint` + `build` green · **manual**: an order with all three fulfilment types shows three distinct progress presentations; an order with no shipped lines renders cleanly with a `null` shipment; posting a `POST /webhooks/shiprocket` `IN TRANSIT` event updates the page without a reload (Pusher configured) and within 30 s (unconfigured).

---

### Task 12: `/account/*`, `/login`, `/feedback/[orderId]`, and the `/profile` retirement

`ACCT-01`, `ACCT-02`, `STORE-03`.

**Files:** create `app/(public)/account/{layout.tsx,page.tsx,orders/page.tsx,orders/[id]/page.tsx,addresses/page.tsx,loyalty/page.tsx,reviews/page.tsx}`; `components/storefront/account/{AccountNav,OrderHistoryList,OrderHistoryCard,ReorderButton,AddressBook,AddressForm,LoyaltyPanel,LoyaltyLedger,PendingReviewList,ReviewComposer,MarketingOptInToggle}.tsx`; modify `app/(public)/login/page.tsx`, `app/(public)/feedback/[orderId]/page.tsx`; **replace** `app/(public)/profile/page.tsx` (971 lines) with a redirect.

- [ ] `account/layout.tsx` — client guard on the customer session (`use-customer-auth`), a desktop left `AccountNav` (Overview · Orders · Addresses · Loyalty · Reviews) and a horizontal tab strip below `md`. Unauthenticated → `/login?redirect=<path>`. **The whole surface depends on Task 2 gap 1**: without `GET /customer-auth/profile` returning `200`, the session never restores on refresh and every account page bounces to login.
- [ ] `/account` — overview: name/phone, loyalty balance and tier, the two most recent orders, pending review count, `MarketingOptInToggle` writing `PATCH /customer-auth/profile { marketing_opt_in }` (Task 2 gap 4).
- [ ] `/account/orders` — `GET /customer/orders` across **all** channels and fulfilment types (`ACCT-01`), each card showing channel, status, line count, total and a track link. `/account/orders/[id]` — full receipt with the discount split reconstructed (decision 23), a dev-mode assertion that coupon + loyalty equals `discount_amount`, and `ReorderButton` re-adding still-active lines to the cart (skipping archived products with a note).
- [ ] `/account/addresses` — `GET/POST/PATCH/DELETE /customer/addresses` + `PATCH /:id/default`. `react-hook-form + zod`, reusing `GooglePlacesInput`. Deleting the default promotes another.
- [ ] `/account/loyalty` — `GET /customer/loyalty`: balance, tier, `next_tier.points_needed` as a progress bar, `redeem_value_per_point` stated in rupees, and `LoyaltyLedger` over `transactions[]` with `reason` labels (`earn`/`redeem`/`adjust`/`expire`), `balance_after`, and `expires_at` flagged when within 30 days.
- [ ] `/account/reviews` — two sections. **Pending**: `GET /customer/reviews/pending` → `[{ order_item_id, product, order }]`, each opening `ReviewComposer`. **Written**: `GET /customer/reviews` with each review's `status` shown honestly (`published` / `pending` moderation / `hidden`). `ReviewComposer` uses `StarRatingInput` (survives), title, body, and posts `POST /customer/reviews`; handles `409` ("already reviewed") and `400` ("not yet delivered") with the server's message.
- [ ] `/login` — currently a 30-line page that pushes to `/menu` (line 12). Rebuild on `CustomerOtpForm`, honour `?redirect=`, default to `/account`.
- [ ] `/feedback/[orderId]` — keep the route (SPEC §5.1, and the homepage links `/feedback/demo` at `app/page.tsx:167`); re-point its thank-you to `/account/reviews`. `FeedbackThankYou.tsx`'s `Confetti` was already removed by P4 Sweep D — confirm with a grep and do not reintroduce it.
- [ ] **Retire `/profile`**: replace the 971-line page with `export default function Page() { redirect('/account') }` and delete `components/public/{CustomerIdentityStrip,CustomerOrderCard,CustomerAddressCard,AddressSelector,PaymentStatusPanel,PhoneLoginPrompt,ChannelToggle}.tsx`. This also clears the 12 raw-colour hits Task 3 deliberately skipped.

**Verification:** `tsc` + `lint` + `build` green · `grep -rn "bg-white\|text-white" "app/(public)"` → no output outside the frozen paths · **manual**: log in as `9900000001`, refresh the page and **stay logged in** (proves gap 1); every account route renders; adding and defaulting an address works; the loyalty ledger shows P5a's seeded transactions; `/account/reviews` lists the delivered mug and attended workshop as pending; `/profile` redirects.

---

### Task 13: SEO — sitemap, robots, redirects, OG image, and the indexability audit

`STORE-01`. Runs after every route exists.

**Files:** create `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`; replace `app/(public)/menu/page.tsx`, `app/(public)/events/page.tsx`, `app/(public)/events/[id]/page.tsx` with redirects.

- [ ] **`/menu` → `/shop?type=prepared_food`** (SPEC §5.1, permanent). Implemented as a route-level `redirect()` in a server page, not a `next.config` rewrite, so the `(public)` layout still applies and the frozen homepage's three `/menu` links (`app/page.tsx:77,127,273`) keep working. **`app/page.tsx` is not touched** (SPEC §1.3).
- [ ] **`/events` → `/experiences`** and **`/events/[id]` → `/experiences`** (permanent), for the homepage's three `/events` links (`app/page.tsx:85,147,274`). SPEC does not name this redirect; it is required by the same freeze that requires the `/menu` one, and is recorded as a deliberate addition.
- [ ] **`app/sitemap.ts`** — server-generated from live data: `/`, `/shop`, every `/shop/[category]` from `GET /catalog/categories`, every `/p/[slug]` for `status: 'active'` products, `/experiences` and every `/experiences/[slug]` for non-`draft`/non-`cancelled` events. `lastModified` from `updated_at`. Paginate through `next_cursor` — do **not** assume one page. Cache with `revalidate: 3600`.
- [ ] **`app/robots.ts`** — allow `/`, `/shop`, `/p`, `/experiences`; **disallow** `/cart`, `/checkout`, `/account`, `/orders`, `/feedback`, `/login`, and every ops path (`/dashboard`, `/tasks`, `/pos`, `/operations`, `/admin`, …). Point `sitemap` at the generated URL.
- [ ] **`app/opengraph-image.tsx`** — a brand default via `ImageResponse` using the `--public-*` values as literals (the OG runtime cannot read CSS variables), so a page without product media still shares well.
- [ ] **The audit.** Grep every storefront `page.tsx` and assert: `/shop`, `/shop/[category]`, `/p/[slug]`, `/experiences`, `/experiences/[slug]`, `/search` each export `generateMetadata` **and** contain no top-level `'use client'`; `/cart`, `/checkout`, `/account/*`, `/orders/[id]/track` each carry `robots: { index: false }`. This closes risk 3.

**Verification:** `tsc` + `lint` + `build` green · `/sitemap.xml` lists active products + categories + events + 3 URLs · `/robots.txt` shows the disallow list · `curl -sI localhost:3000/menu` → `307`/`308` to `/shop?type=prepared_food`; same for `/events` → `/experiences` and `/profile` → `/account` · `git diff --name-only` does **not** contain `app/page.tsx` or `components/public/ScrollVideoStory.tsx`.

---

### Task 14: Staff Shipments — the queue, the lifecycle, and `private-shipments` live

`OPS-03`. The largest staff screen, and the one the ops IA has been holding a slot for.

**Files:** create `app/(ops)/shipments/{page.tsx,[id]/page.tsx}`; `components/ops/shipments/{ShipmentsTable,ShipmentStatusBadge,ShipmentFilterBar,ToPackQueue,PackDialog,AssignAwbDialog,SchedulePickupButton,LabelButton,CancelShipmentDialog,ShipmentEventTimeline}.tsx`; `lib/hooks/use-shipments-realtime.ts`.

- [ ] `/shipments` — two tabs. **To pack**: orders carrying `fulfilment: 'shipped'` lines that have **no `Shipment` row** (decision 10). **Do not** drive this from `OrderItemStatus.packed` — P5a sets shipped lines to `packed` at confirm, before anyone packs, so that predicate shows an empty queue and a pile of phantoms. **Shipments**: `GET /shipments?status=&cursor=&limit=` with `{items,next_cursor}`, filtered by `ShipmentStatus`.
- [ ] `PackDialog` → `POST /shipments/pack { order_id, weight_grams, pickup_location_code }`. Default `weight_grams` from the order's shipped lines' `Product.weight_grams` (falling back to `SystemSetting['shipping'].default_weight_grams`) and `pickup_location_code` from `SystemSetting['shipping'].pickup_location_code`. **Packing twice returns the same shipment** — treat a repeat as success, not an error.
- [ ] `AssignAwbDialog` → `POST /shipments/:id/awb`. **Provider-aware**: read `SystemSetting['shipping'].provider`; with `manual` show editable `awb` / `courier_name` / `tracking_url` fields (the body is honoured); with `shiprocket` show a confirm-only dialog explaining the values come back from the API (the body is ignored). Getting this wrong hands staff a form whose input is silently discarded.
- [ ] `SchedulePickupButton` → `POST /shipments/:id/pickup`, with the warning that it **also moves the order to `shipped`**. `LabelButton` → `GET /shipments/:id/label`: `200 { label_url: null }` (a `manual` shipment) shows "No label for manual shipments"; a URL opens in a new tab; `400` means no AWB yet. `CancelShipmentDialog` → `POST /shipments/:id/cancel { reason }` with a required reason.
- [ ] `/shipments/[id]` — header (AWB, courier, provider, weight, cost, ETD), the lifecycle action row gated by the current status, the linked order with its shipped lines, and `ShipmentEventTimeline` over `events[]`. **Allow forward skips** — P5a's guard permits a courier reporting `delivered` with no intermediate scan, so never render a "missing step" as an error.
- [ ] **`use-shipments-realtime.ts`** — subscribe to **`private-shipments`** for `shipment.updated` via the existing `lib/hooks/use-realtime-channel.ts` (the channel is already known there; nothing consumes it yet) and invalidate the shipments queries. 30 s poll fallback (`IA-07`).
- [ ] Follow the house pattern exactly: `'use client'` page, TanStack Query for reads and mutations, `sonner` toasts on success/failure, `react-hook-form + zod` in every dialog, and loading / empty / error states on both tabs (`DESIGN-03`).

**Verification:** `tsc` + `lint` + `build` green · **manual**: pack the seeded order → assign a manual AWB → schedule pickup → confirm the order flips to `shipped` → label shows the manual message → post a `POST /webhooks/shiprocket` `IN TRANSIT` and watch the row update live without a reload · packing the same order twice does not error · the "To pack" tab is non-empty for an order with shipped lines and no shipment.

---

### Task 15: Staff Promotions (coupons) and Reviews moderation

`OPS-02`. Two small screens, one agent, disjoint folders.

**Files:** create `app/(ops)/promotions/page.tsx`, `app/(ops)/reviews/page.tsx`; `components/ops/promotions/{CouponTable,CouponForm,CouponSheet,CouponStatusBadge,CouponUsageCell}.tsx`; `components/ops/reviews/{ReviewModerationTable,ReviewCard,ReviewFilterBar,ModerateReviewButtons}.tsx`.

- [ ] **`/promotions`** — `GET /promotions/coupons` (`{items,next_cursor}`, each row with `_count:{redemptions}`). Table: code, type, value, window, `min_order`, `max_discount`, `applies_to`, usage (`_count.redemptions / usage_limit`), per-customer limit, status.
- [ ] `CouponSheet` (create/edit) — a Sheet per `IA-05`/`DESIGN-03`, `react-hook-form + zod`. `type` drives the form: `percent` shows `value` (%) + `max_discount`; `fixed` shows `value` (₹) and hides `max_discount`; `free_shipping` hides `value` entirely and states that it applies to shipped lines only (SPEC §5.4). `applies_to` is a `ProductType[]` multi-select; empty means all. Client-side zod mirrors the DB CHECKs P5a added: `ends_at > starts_at`, `value >= 0`.
- [ ] **`DELETE /promotions/coupons/:id` disables, it does not delete.** The action is labelled "Disable", the confirm copy says the coupon stops working but its redemption history is kept, and the row stays visible with a `disabled` badge.
- [ ] **`/reviews`** — `GET /reviews?status=pending` by default, with `published` and `hidden` filters. Each `ReviewCard` shows product, customer name, rating, title, body, media thumbnails, `created_at`, and `moderated_by`/`moderated_at` where set.
- [ ] `ModerateReviewButtons` — `PATCH /reviews/:id/publish` | `/hide`, optimistic-free (decision 24), with a toast naming the effect on the product rating. Note in a comment that the rating rollup runs in **both** the service transaction and a DB trigger and that they compute identical values, so the UI must not try to predict the new average — refetch the product instead.
- [ ] Loading / empty / error on both tables. Empty for `/reviews?status=pending` is a positive state ("Nothing waiting on you"), not a shrug.

**Verification:** `tsc` + `lint` + `build` green · **manual**: create a `percent` coupon and confirm the form hides `max_discount` for `fixed` and both for `free_shipping`; disable a coupon and confirm it stays listed as disabled; publish the seeded rating-3 review and confirm the product's `rating_avg` refetches to the new value; hide it and confirm the rating drops.

---

### Task 16: Staff Customers — list, detail, loyalty adjustments, marketing

`OPS-04` (customers half).

**Files:** create `app/(ops)/customers/{page.tsx,[id]/page.tsx}`; `components/ops/customers/{CustomerTable,CustomerFilterBar,CustomerProfileHeader,CustomerOrdersPanel,CustomerLoyaltyPanel,LoyaltyAdjustDialog,CustomerReviewsPanel,CustomerAddressesPanel,MarketingOptInBadge}.tsx`.

- [ ] `/customers` — `GET /customers?q=&cursor=&limit=` (`{items,next_cursor}`). Columns: name, phone, email, `loyalty_account.points_balance` + `tier`, `_count.orders/reviews/bookings`, `marketing_opt_in`, `last_seen_at`. Debounced search on `q`.
- [ ] `/customers/[id]` — `GET /customers/:id`, which returns `orders` (with `items` + `payment`), `loyalty_transactions`, `reviews`, `addresses`, `coupon_redemptions` and `orders_summary`. Render as panels: profile header (with `MarketingOptInBadge`), orders (linking each to `/pos/orders/[id]` from Task 17), loyalty (balance, tier, ledger), reviews, addresses, coupon history.
- [ ] `LoyaltyAdjustDialog` → `POST /customers/:id/loyalty-adjust { delta, notes }`. `delta` is a signed integer with `notes` **required** — every adjust writes a `LoyaltyTransaction(reason: adjust)` and an `AuditEvent`, and an unexplained balance change is exactly what an audit trail exists to prevent. A negative delta that would take the balance below zero is blocked client-side (the DB CHECK `LoyaltyAccount_balance_non_negative` would reject it anyway) with the maximum shown.
- [ ] Money in `orders_summary` and every order row uses `formatCurrency` and the inclusive-tax rule.
- [ ] Loading / empty / error on the list and every panel.

**Verification:** `tsc` + `lint` + `build` green · **manual**: `?q=99000` finds the demo customer; the detail page shows the seeded order, four loyalty transactions, two reviews, one address and one coupon redemption; a `-50` adjust with notes lands and the ledger refetches; an over-large negative delta is blocked before the request.

---

### Task 17: Staff Orders — the `/pos/orders/[id]` detail route, refunds, lifecycle actions

`OPS-05`, and the Phase 26 intent folded in.

**Files:** create `app/(ops)/pos/orders/[id]/page.tsx`; `components/ops/pos/orders/{OrderDetailHeader,OrderLineTable,OrderPaymentPanel,OrderRefundPanel,RefundDialog,RefundHistoryTable,OrderLifecycleActions,OrderShipmentPanel,OrderTimelinePanel,OrderReceiptButton}.tsx`; modify `app/(ops)/pos/orders/page.tsx` (row → detail link, replacing the sheet).

- [ ] **Replace `OrderDetailSheet` with a route** (decision 8): `/pos/orders/[id]`. The list row navigates instead of opening a sheet; delete the sheet component once nothing imports it.
- [ ] `OrderDetailHeader` — order number, channel, status, `placed_via`, customer, created_at, and the totals block: subtotal (incl. GST), discount (**split** into coupon and loyalty per decision 23, with a dev assertion that they sum to `discount_amount`), shipping, **`tax_amount` as an "of which" line**, total.
- [ ] `OrderLineTable` — per line: product, variant, quantity, `unit_price`, `tax_rate`, `fulfilment`, `OrderItemStatus`, and `event_booking_id` where set. Group by `fulfilment` so a mixed order reads correctly.
- [ ] `OrderLifecycleActions` — `PATCH /orders/:id/status` and `POST /orders/:id/complete`. **The `400` message lists the legal transitions** (`Cannot transition from "delivered" to "preparing". Valid transitions: completed`), so the UI renders only the legal next moves and, on a race, surfaces the server's list verbatim. Warn on `delivered` that it credits loyalty and fires the review invitation.
- [ ] `OrderRefundPanel` + `RefundDialog` → `POST /orders/:id/refund { amount?, reason }`. Amount defaults to the refundable balance (`payment.amount − payment.refunded_amount`) and is capped at it; omitting it means a full refund. **Full refund warns that it sets `Order.status = refunded` and claws back loyalty** (P5a §5f: the earned points are reversed and the redeemed ones restored). A `400` from the gateway means the `Refund` row stays `failed` — show the server's message (which now prefers the gateway's `description`) and refetch, because the failed row is real and appears in the history.
- [ ] `RefundHistoryTable` → `GET /orders/:id/refunds`, newest first, showing `status` (`processed`/`failed`/`pending`), amount, reason, `razorpay_refund_id`, `requested_by`. `OrderPaymentPanel` shows `method`, `status` (including `partially_refunded`), `refunded_amount`, `razorpay_payment_id`.
- [ ] `OrderShipmentPanel` — for orders with shipped lines, the shipment summary with a link to `/shipments/[id]`, or a "Not packed yet" state linking to the Shipments "To pack" tab.
- [ ] `OrderTimelinePanel` — built from `Order.status`, `ShipmentEvent[]`, `Payment` and `Refund` rows (not from `AuditEvent`), so it is complete regardless of the audit hole Task 2 gap 7 closes.
- [ ] `OrderReceiptButton` — the existing receipt endpoint.

**Verification:** `tsc` + `lint` + `build` green · **manual on the seeded order**: the detail route renders; the discount split (200 coupon + 25 loyalty = 225) reconciles; a partial ₹649 refund lands and the payment flips to `partially_refunded`; a full refund flips the order to `refunded` and the loyalty clawback shows in the customer's ledger; a third refund attempt shows the server's message; only legal status transitions are offered · `grep -rn "OrderDetailSheet" frontend/` → no output.

---

### Task 18: Staff Experiences — attendance marking and the holds view

`OPS-04` (experiences half).

**Files:** modify `app/(ops)/operations/events/page.tsx`; create `components/ops/operations/events/{AttendanceSheet,AttendanceRow,HoldsPanel}.tsx`.

- [ ] `AttendanceSheet` — for an event on or after its date, list `EventBooking`s with `status` in `confirmed`/`attended`/`no_show` and mark each via `POST /events/:id/attendance { booking_id, status }`. `attended` flips the linked `OrderItem` and **opens the review gate**, so the confirm copy says so.
- [ ] Bulk "mark all attended" with a confirm, because that is the real-world action on the day; individual `no_show` overrides afterwards.
- [ ] `HoldsPanel` — bookings with `status: 'held'` and a live `hold_expires_at` countdown, so staff can see capacity that is temporarily committed to an in-flight checkout. **A released hold leaves no row** (P5a deviation 14 — holds are DELETEd on release/sweep, not cancelled in place), so the panel shows only live holds and never a graveyard.
- [ ] Capacity display accounts for holds: `capacity − confirmed − held`.
- [ ] Loading / empty / error; the empty attendance state distinguishes "no bookings" from "event has not happened yet".

**Verification:** `tsc` + `lint` + `build` green · **manual**: mark the seeded Fermentation Workshop booking `attended` → the linked order item flips and the customer's `/account/reviews` pending list gains it; a quote in flight shows a live hold with a countdown in `HoldsPanel` and the row disappears when the hold is swept.

---

### Task 19: Staff Catalog — the variant editor and media upload

`OPS-01`. The two things `/operations/menu` is missing, and nothing else.

**Files:** modify `app/(ops)/operations/menu/page.tsx`, `components/ops/operations/menu/ProductForm.tsx`; create `components/ops/operations/menu/{VariantEditor,VariantRow,MediaManager,MediaUploader,MediaThumb}.tsx`.

- [ ] **`VariantEditor`** — a section inside `ProductForm` (which today contains zero `variant` matches). Rows of `name`, `sku`, `price_delta`, `stock_on_hand`, `low_stock_threshold`, `is_default`, `status`, persisted via `PATCH /catalog/variants` and `DELETE /catalog/variants/:id`. Exactly one `is_default` is enforced client-side. `stock_on_hand` and `low_stock_threshold` are shown **only** when `stock_mode: 'tracked'` — for `derived_from_recipe` and `capacity` they are meaningless and would mislead. The effective price (`base_price + price_delta`) is shown live per row, since that is the number the storefront charges.
- [ ] **`MediaManager` + `MediaUploader`** — closes P2 follow-up #6. Presign via `POST /storage/presign-product-media` (Task 2 gap 5), `PUT` the file straight to R2, then `POST /catalog/products/:id/media { url, alt, kind, sort_order }` with the returned `publicUrl`. `DELETE /catalog/media/:id` removes. Drag-to-reorder writes `sort_order`; `alt` text is **required** before save (it is what `/p/[slug]`'s `next/image` and the OG card render). Validate content type and size client-side to match `validatePresignRequest` so failures happen before the upload, not after.
- [ ] `MediaThumb` — `next/image` preview, `kind` badge, the first image marked as the OG/card image so staff know which one the storefront leads with.
- [ ] Do not restructure the rest of `/operations/menu` — product CRUD, category CRUD and publish-by-status already satisfy `OPS-01` (decision 17).

**Verification:** `tsc` + `lint` + `build` green · **manual**: add a second variant to a product, set a `price_delta`, and confirm `/p/[slug]` offers both at the right prices and that adding each yields two distinct cart lines; upload an image and confirm it renders through `next/image` on the storefront card and detail page; delete it and confirm the storefront falls back to its placeholder · `grep -c "variant" components/ops/operations/menu/ProductForm.tsx` → non-zero.

---

### Task 20: Playwright, smoke test 2, CI, the final gates and the record

`QA-06`. Main tree, on the fully merged branch, strictly last.

**Files:** create `frontend/playwright.config.ts`, `frontend/e2e/smoke-2-purchase.spec.ts`, `frontend/e2e/fixtures/{customer.ts,razorpay-stub.ts,webhook.ts}`, `frontend/e2e/README.md`; modify `frontend/package.json` + `package-lock.json`, `frontend/eslint.config.mjs` (drop the legacy warn block), `.github/workflows/ci.yml`; write `.planning/phases/34-p5b-storefront-staff-commerce/34-01-SUMMARY.md` and update `.planning/{STATE,ROADMAP}.md`.

- [ ] **Install and configure Playwright.** `@playwright/test` as a devDependency, `playwright.config.ts` with `testDir: './e2e'`, `webServer` running `npm run build && npm run start`, `chromium` only (desktop 1440×900 and a mobile viewport project), `trace: 'on-first-retry'`. Add `"test:e2e": "playwright test"` to `package.json`.
- [ ] **`fixtures/customer.ts`** — log in through the real OTP flow: `POST /customer-auth/send-otp {"phone":"9900000001"}`, read the `[DEV] OTP …` line the server prints when WhatsApp is unconfigured, `POST /customer-auth/verify-otp`, and inject the `customer_token` cookie into the browser context. No password, no fixture user invented.
- [ ] **`fixtures/razorpay-stub.ts`** — `page.route('https://checkout.razorpay.com/**')` serving a stub `checkout.js` that defines `window.Razorpay` with `open()`/`on()` and records the options it was constructed with. **CI needs no network.**
- [ ] **`fixtures/webhook.ts`** — post a signed `payment.captured` to `POST /webhooks/razorpay` with an HMAC-SHA256 over the raw body using the test secret, `notes: { type: 'marketplace', entity_id: <customerId> }` — the exact request P5a §5c recorded.
- [ ] **`smoke-2-purchase.spec.ts`** — the flow in the Playwright decision above: browse → facet → product detail → variant → three fulfilment types added → `/cart` (three groups, no grand total) → `/checkout` → address → `WELCOME10` → redeem points → review step (assert line items, the "of which GST" line, the countdown, and `total = subtotal − discount − redeem + shipping`) → Pay (assert `razorpay_order_id` and that the stub opened) → signed webhook → `/orders/[id]/track` renders the confirmed order. Plus two negative assertions that cost nothing: `EXPIRED5` shows `This coupon has expired`, and an unavailable line blocks checkout.
- [ ] **CI** — add a `frontend-e2e` job to `.github/workflows/ci.yml`: Postgres + Redis services, `prisma migrate deploy`, `seed:reference`, `SEED_DEMO_FORCE=true seed:demo`, boot `backend/dist/src/main.js`, then `npx playwright install --with-deps chromium && npm run test:e2e`. Upload the trace on failure. **Note in the job comment that `SHIPROCKET_WEBHOOK_TOKEN` must be set or `/webhooks/shiprocket` returns `403` by design** (P5a deviation 8).
- [ ] **Drop the legacy lint warn block** in `eslint.config.mjs` now that `app/(public)/profile` and the superseded `components/public/*` files are deleted, and ratchet the CI `--max-warnings` ceiling down — the change P4 Task 19's comment anticipated. Confirm `ScrollVideoStory.tsx` and `app/page.tsx` remain excluded.
- [ ] **Full gates on the merged tree:** frontend `tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:e2e`; backend `jest --silent`, `tsc --noEmit -p tsconfig.build.json`, `eslint` (0 errors), `prisma validate`, `npm run build`, and the drift gate `prisma migrate diff --from-migrations … --exit-code` → `No difference detected.` (P5b adds **no** migration; the drift gate proves it).
- [ ] **The recorded walk-through** (SPEC §10 definition of done) at desktop and mobile: storefront browse → product with variants → mixed cart → checkout with coupon and loyalty → pay → track; then staff pack → AWB → pickup → label → courier webhook → delivered → moderate a review → refund. Record it in the phase summary with statuses and observed values, the way P5a's summary does.
- [ ] Write `.planning/phases/34-p5b-storefront-staff-commerce/34-01-SUMMARY.md`; update `.planning/STATE.md` and `.planning/ROADMAP.md` (Phase 34 → complete, criteria corrected where reality differed, carry-forwards for Phase 35).

**Verification:** every gate above green, with the command output pasted into the summary · `npm run test:e2e` passes locally and in CI · `git status --short` shows only intended files (` M CLOUDFLARE-SETUP.md` is pre-existing and stays untouched).

---

## Execution partition (parallel Opus implementers, isolated worktrees)

**Rules for every agent**
- `model: "opus"` on every implementation subagent (harness preference).
- One agent per task, in its own git worktree branched from the wave's base commit, created with the `superpowers:using-git-worktrees` skill. Merge the wave, run the full gate, then start the next.
- **`git commit -- <paths>` only.** Never `git add -A`.
- Gates after every task: frontend `npx tsc --noEmit`, `npm run lint` (0 errors), `npm run build`. Task 2 additionally runs the backend gates. A wave is not merged until every task is green individually **and** the merged tree is green.
- **Single-owner files** — an agent needing a change in a file it does not own must stop and report, not edit it:

| File | Sole owner |
|---|---|
| `frontend/lib/types/index.ts`, `lib/types/{catalog,marketplace,settings}.ts`, `lib/api-client.ts` | Task 1 |
| `backend/**` (all of it) | Task 2 |
| `frontend/app/tokens.css`, `next.config.ts`, `proxy.ts`, `eslint.config.mjs`, `lib/nav/spine.ts`, `components/ops/admin/module-routes.ts` | Task 3 |
| `frontend/app/(public)/layout.tsx` | Task 4 |
| `frontend/lib/stores/cart-store.ts`, `hooks/use-cart.ts`, `lib/hooks/use-quote.ts` | Task 8 |
| `frontend/app/(public)/profile/page.tsx` (→ redirect) | Task 12 |
| `frontend/app/sitemap.ts`, `robots.ts`, and the `/menu` · `/events` redirect pages | Task 13 |
| `frontend/app/(ops)/pos/orders/page.tsx` | Task 17 |
| `frontend/package.json`, `package-lock.json`, `.github/workflows/ci.yml` | Task 20 |
| `frontend/app/page.tsx`, `components/public/ScrollVideoStory.tsx` | **nobody** — frozen (SPEC §1.3) |
| `backend/prisma/migrations/**` | **nobody** — P5b adds no migration |

### Wave 0 — foundations (3 agents, no dependencies between them)

| Task | Agent | Owns |
|---|---|---|
| **1** Types, money, SEO helpers, `apiClient` status | `p5b-types` | `frontend/lib/types/**`, `lib/format/**`, `lib/seo/**`, `lib/api-client.ts` |
| **2** The seven backend gaps | `p5b-backend-gaps` | everything under `backend/` |
| **3** Theming, colour sweep, config, spine | `p5b-config` | `app/tokens.css`, `app/(auth)/layout.tsx`, `next.config.ts`, `proxy.ts`, `eslint.config.mjs`, `lib/nav/spine.ts`, `components/ops/admin/module-routes.ts`, the 37 literals in `components/public/**` |

Disjoint by construction: Task 1 is `lib/`, Task 2 is `backend/`, Task 3 is `app/*.css` + config + `components/public/**`. Task 3 must **not** sweep `app/(public)/profile/page.tsx` (Task 12 deletes it) and must **not** touch `app/(public)/layout.tsx`'s structure (Task 4 owns it) — only its `className` and `color-scheme`.

**Gate before Wave 1:** frontend `tsc` + `lint` + `build` green; backend `jest` + `tsc` + `eslint` + `prisma validate` + `build` green; Task 2's runtime reproduction recorded; the light pin verified with the OS in dark mode.

### Wave 1 — the shell, the cart engine, and every staff screen (8 agents) · base = merged Wave 0

| Task | Agent | Owns | Needs |
|---|---|---|---|
| **4** Storefront shell | `p5b-shell` | `app/(public)/{layout,loading,error}.tsx`, `components/storefront/{shell,common}/**` | T1, T3 |
| **8** Cart store + `use-cart` + mini-cart | `p5b-cart-engine` | `lib/stores/cart-store.ts`, `hooks/use-cart.ts`, `lib/hooks/{use-quote,use-storefront-cart}.ts`, `components/storefront/shell/MiniCart.tsx` | T1, T2 |
| **14** Shipments | `p5b-shipments` | `app/(ops)/shipments/**`, `components/ops/shipments/**`, `lib/hooks/use-shipments-realtime.ts` | T1, T3 |
| **15** Promotions + Reviews | `p5b-promo-reviews` | `app/(ops)/{promotions,reviews}/**`, `components/ops/{promotions,reviews}/**` | T1, T3 |
| **16** Customers | `p5b-customers` | `app/(ops)/customers/**`, `components/ops/customers/**` | T1, T3 |
| **17** Orders detail + refunds | `p5b-orders` | `app/(ops)/pos/orders/**`, `components/ops/pos/orders/**` | T1, T3 |
| **18** Experiences attendance | `p5b-attendance` | `app/(ops)/operations/events/**`, `components/ops/operations/events/**` | T1, T3 |
| **19** Catalog variants + media | `p5b-catalog-admin` | `app/(ops)/operations/menu/**`, `components/ops/operations/menu/**` | T1, T2 (presign), T3 |

Boundary notes that make the sets disjoint: Task 4 owns `components/storefront/shell/**` **except** `MiniCart.tsx`, which is Task 8's — Task 4 ships `MiniCartTrigger` with a prop-driven open handler, Task 8 mounts the sheet, so the two never edit one file. Task 16 links to `/pos/orders/[id]` (Task 17's route) by href only. Task 14's "To pack" tab reads orders through the existing orders API and does not touch Task 17's files. Every staff task sits in its own `app/(ops)/<key>/` and `components/ops/<key>/` pair.

**Gate before Wave 2:** `tsc` + `lint` + `build` green; each staff screen walked once for its own verification block; the empty-body `POST /customer/orders` grep is clean.

### Wave 2 — the storefront routes (7 agents) · base = merged Wave 1

| Task | Agent | Owns | Needs |
|---|---|---|---|
| **5** `/shop`, `/shop/[category]`, `/search` | `p5b-catalog-routes` | `app/(public)/{shop,search}/**`, `components/storefront/catalog/**` | T4 |
| **6** `/p/[slug]` | `p5b-product-detail` | `app/(public)/p/**`, `components/storefront/product/**` | T4, T8, T2 (availability) |
| **7** `/experiences` | `p5b-experiences` | `app/(public)/experiences/**`, `components/storefront/experiences/**` | T4, T8 |
| **9** `/cart` | `p5b-cart-page` | `app/(public)/cart/**`, `components/storefront/cart/**` | T8, T2 (merge rule) |
| **10** `/checkout` | `p5b-checkout` | `app/(public)/checkout/**`, `components/storefront/checkout/**` | T8, T2 (serviceability) |
| **11** `/orders/[id]/track` | `p5b-track` | `app/(public)/orders/**`, `components/storefront/track/**` | T8, T2 (pusher-auth) |
| **12** `/account/*`, `/login`, `/feedback` | `p5b-account` | `app/(public)/{account,login,feedback,profile}/**`, `components/storefront/account/**` | T8, T2 (profile, opt-in) |

Seven agents, seven disjoint route folders and seven disjoint component folders. The only shared reads are Task 1's types and Task 8's hooks, neither of which any of them edits. `components/public/**` deletions are attributed per task: Task 5 deletes the menu/browse components, Task 6 the product ones, Task 7 the event ones, Task 12 the profile ones.

**Gate before Wave 3:** `tsc` + `lint` + `build` green; the build output lists `/shop`, `/shop/[category]`, `/p/[slug]`, `/experiences`, `/experiences/[slug]` and `/search` as **server** routes; the full purchase path walked once by hand.

### Wave 3 — SEO (1 agent) · base = merged Wave 2

| Task | Agent | Owns |
|---|---|---|
| **13** Sitemap, robots, redirects, OG, indexability audit | `p5b-seo` | `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, the `/menu` · `/events` · `/events/[id]` redirect pages |

Runs alone and after everything because the sitemap enumerates routes that must already exist and the audit greps every storefront page.

### Wave 4 — verification and the record (1 agent, **main tree**)

| Task | Agent | Owns |
|---|---|---|
| **20** Playwright, smoke 2, CI, final gates, summary | main tree | `frontend/playwright.config.ts`, `frontend/e2e/**`, `package.json`, `eslint.config.mjs` (warn-block removal), `.github/workflows/ci.yml`, `.planning/**` |

**Main tree, not a worktree**: it runs the merged-tree gates, boots the real backend against the real seeded database, and writes the planning record — none of which is meaningful in an isolated copy.

### Dependency graph

```
T1 ──┬─────────────────────────────┬─→ T4 ──┬─→ T5 ─┐
     │                             │        ├─→ T6 ─┤
T3 ──┴─→ T14 T15 T16 T17 T18 T19 ──┘        ├─→ T7 ─┼─→ T13 ─→ T20
                                            │       │
T2 ──────────────→ T8 ──────────────────────┴─┬─→ T9┤
                                              ├─→T10┤
                                              ├─→T11┤
                                              └─→T12┘
```

### Cross-phase collisions (Phase 32's record is being written concurrently)

| Risk | Mitigation |
|---|---|
| A sibling agent is editing `frontend/eslint.config.mjs` for Phase 32 | Task 3 adds a **new** `error`-scoped block and leaves the existing warn block alone. On conflict, keep both; the blocks target disjoint path globs. |
| The sibling is writing `.planning/phases/32-p4-role-aware-ia/**` and may touch `STATE.md`/`ROADMAP.md` | Only Task 20 writes `.planning/`, and it runs last on the merged tree. It must re-read both files before editing rather than working from a stale copy. |
| Phase 32's record may list follow-ups that overlap P5b tasks | Task 20 reconciles: anything P5b actually delivered is marked done in the Phase 34 summary with a pointer, not silently dropped. |

---

## Self-review

### SPEC coverage → task

| SPEC item | Task |
|---|---|
| §5.1 `/shop`, `/shop/[category]` server components + `generateMetadata` | 5 |
| §5.1 `/p/[slug]` + `Product` JSON-LD | 6 |
| §5.1 `/experiences`, `/experiences/[slug]` + `Event` JSON-LD | 7 |
| §5.1 `/search?q=` | 5 |
| §5.1 `/cart` (client) | 9 |
| §5.1 `/checkout` (client) | 10 |
| §5.1 `/orders/[id]/track` | 11 |
| §5.1 `/account`, `/account/orders`, `/account/addresses`, `/account/loyalty`, `/account/reviews` | 12 |
| §5.1 `/feedback/[orderId]`, `/login` | 12 |
| §5.1 `/menu` → `/shop?type=prepared_food` | 13 |
| §5.1 `next/image` + R2 remote pattern | 3 (config), 5, 6, 7, 19 |
| §5.1 sitemap + robots | 13 |
| §5.1 desktop layouts designed, not stretched | 4, and every route task's verification |
| §5.2.1 cart server-priced on every sync, rejected lines | 8, 9 (+2 for the merge rule) |
| §5.2.2 serviceability — local pincode / pickup, shipped rate, booking hold | 10 (+2 for the pre-check) |
| §5.2.2 itemised quote — subtotal, discount, shipping, tax breakup, loyalty redeemable, total | 10 |
| §5.2.3 pay — `POST /customer/orders {quote_id}` → Razorpay | 8, 10 |
| §5.2.4 confirm — `POST /customer/orders/confirm`, idempotent replay | 8, 10 |
| §5.2.5 shipped → staff pack → AWB → pickup → label → tracking | 14 |
| §5.2.5 booking → attendance marked from the Events admin | 18 |
| §5.2.5 customer-facing tracking with the Pusher event | 11 (+2 for `pusher-auth`) |
| §5.2.6 review invitation surface, loyalty visible after delivery/attendance | 12 |
| §5.2.7 staff refund action, full and partial | 17 |
| §5.4 coupon entry validated server-side, no stacking | 10, 15 |
| §5.4 loyalty balance, tier, redeem slider, ledger | 10, 12, 16 |
| §5.4 reviews — one per item, moderation queue | 12, 15 |
| §5.4 faceted search over the tsvector index | 5 |
| §5.5 Catalog (products, variants, media, categories, publish) | 19 (+ the existing screen) |
| §5.5 Promotions | 15 |
| §5.5 Reviews moderation | 15 |
| §5.5 Shipments queue (pack → AWB → pickup → label → track) | 14 |
| §5.5 Orders (all channels, refunds) | 17 |
| §5.5 Experiences (events + attendance) | 18 |
| §5.5 Customers (profile, orders, loyalty adjustments) | 16 |
| §5.5 POS sells `prepared_food` only, otherwise unchanged | none — already true; asserted in Task 20's walk-through |
| §6.2 spine entries for shipments · customers · reviews · promotions | 3 |
| §6.4 Sheets for create/edit; `<Button>`/`<Card>` only; loading/empty/error everywhere | 14, 15, 16, 17, 18, 19 |
| §6.4 Pusher on Shipments; polling ≥ 30 s as fallback | 14 |
| §7 one token file, zero arbitrary colour values, light validated | 3, 20 |
| §8 auth — 7-day sliding customer session, `jti` revocation on logout | 2 (logout route), 12 |
| §8 public surface never returns cost/yield/BOM/margin | 1 (`StorefrontProduct` makes it a type error) |
| §10 Playwright smoke on a built preview, in CI | 20 |
| §10 recorded human walk-through | 20 |

### REQUIREMENTS id → task

| Id | Task | Id | Task |
|---|---|---|---|
| STORE-01 | 3, 5, 6, 7, 13 | OPS-01 | 19 |
| STORE-02 | 2, 8, 9, 10 | OPS-02 | 15 |
| STORE-03 | 2, 11, 12 | OPS-03 | 14 |
| STORE-04 | 3, 4, 5–12, 20 | OPS-04 | 16, 18 |
| ACCT-01 | 2, 12 | OPS-05 | 17 |
| ACCT-02 | 2, 12 | QA-06 | 20 |

### Deferrals — what does **not** land here

| Deferred | To | Why |
|---|---|---|
| `QA-05` second half — the Postgres-backed `test/jest-integration.json` harness (order confirm, fulfilment, shipment lifecycle, coupon, loyalty, review) | **35** | Carried from `QA-02` → `QA-05` → here. It is *backend* work, and P5b is a frontend phase: standing it up would put one backend config file in the path of nineteen frontend agents for no storefront gain. P5a's recorded 51-request runtime walk-through plus its unit coverage remain the evidence until then. |
| `QA-03` — Playwright smoke test 1 (`login → task → evidence → approve → meter moves`) | **35** | Its cost drops to ~one spec file because Task 20 builds the harness, config, fixtures and CI job. |
| `refund.failed` webhook reconciliation | **35** | No P5b screen reads it; `Refund.status` already carries `failed` and Task 17 renders it. A refund failing *after* Razorpay accepted it is an operational alert, which is P6's run-it layer. |
| Auto-refund of a payment captured after its booking hold was swept | **35** | P5a risk 5. Contained in P5b by the quote countdown (decision 3); the automatic refund needs the alerting P6 owns. `EventsService` already has the capacity-exceeded auto-refund pattern to copy. |
| WhatsApp review-invitation and staff-nudge templates | **35** | `RUN-01`. P5a fires the event; the template is P6. |
| Admin usage dashboard over `UsageEvent` | **35** | `RUN-04`. `GET /usage/summary` exists; the screen is P6. |
| Shiprocket sandbox verification of the eight adapter request/response shapes | before the first production switch | `SystemSetting['shipping'].provider` seeds `manual` and Task 14 is provider-aware, so P5b ships end to end without it. |
| A body HMAC for `POST /webhooks/shiprocket` | later | Needs `/webhooks/shiprocket` added to `main.ts`'s `rawBody` allowlist; no P5b task owns `main.ts`. |
| Guest order tracking without a login | not planned | `/orders/[id]/track` is customer-scoped; SPEC gives no guest path. |
| Multi-shipment orders / partial shipments | not planned | `Shipment.order_id @unique`; SPEC models one shipment per order. |
| `Order.zone_id` → `fulfilment_zone_id` rename | later | P2 decision 2 preserved; 40+ call sites, zero behavioural gain. |
| Dark mode for the storefront | not planned | Decision 1 — pinned light, deliberately. |
| Razorpay Route, COD, multi-vendor | never (§1.2) | explicit non-goals. |

### Risks and how the plan contains them

1. **Razorpay's modal in dev and CI.** It renders in a cross-origin iframe, needs `NEXT_PUBLIC_RAZORPAY_KEY_ID`, and `POST /customer/orders/confirm` re-fetches the payment from Razorpay and verifies an HMAC — so no fabricated payment id can complete the flow. P5a's smoke hit this exact wall. **Contained by:** Task 10 reuses `hooks/use-razorpay.ts` unchanged (it already handles script loading, `ondismiss` and `payment.failed`), Task 20's Playwright stubs `checkout.razorpay.com` via `page.route` so CI needs no network, and the confirm half is driven through the **signed webhook** — SPEC §5.2.4's mandated equivalent path. **Not contained:** the Razorpay-hosted card form itself, which stays a manual walk-through item.
2. **Quote expiry.** The booking hold is 15 minutes; the pending order key is 30. A customer can quote, pay at +14 and confirm at +20, after the sweep deleted the hold — `applyCommercialEffects` then throws and leaves a captured payment with no order (P5a risk 5, unchanged). **Contained by:** the countdown (decision 3) disables Pay at T-0 and forces a re-quote, so the window is closed from the UI side; `410` re-quotes silently and `404` returns to the cart (decision 4). **Not contained:** the auto-refund of a payment that slips through anyway — deferred to Phase 35 above.
3. **SEO on client components.** `generateMetadata` does not run in a client component, so one stray top-level `'use client'` in `/shop`, `/p/[slug]`, `/experiences` or `/search` silently kills the metadata, the JSON-LD and the server render. **Contained by:** the server-page + client-island split is stated in Tasks 5–7, and Task 13's audit greps every storefront `page.tsx` for `'use client'` and for `generateMetadata`, with the build output's server/client route table as the second check.
4. **`next/image` and R2.** Turning off `unoptimized: true` only works if media URLs are stable and unsigned. **Verified, not assumed:** `storage.service.ts:76` returns `${R2_PUBLIC_URL}/${key}` with no query-string signature and `.env.example:17` points at `https://<bucket>.r2.dev`. Evidence and exports keep presigned GETs and are never rendered through `next/image`. **Residual:** if `R2_PUBLIC_URL` is ever changed to a signing proxy, `remotePatterns` must change with it — noted in Task 3's config comment.
5. **The six-route guard defect is inferred, not observed.** The reasoning is structural (global guards precede route guards; `permissions.guard.ts:33` rejects customer tokens unconditionally) and corroborated by every P5a controller carrying `@Public()` with an explanatory comment while the two pre-P5a ones do not. **Contained by:** Task 2 step 0 reproduces it against a running server and records the status code *before* changing a line, with an explicit instruction to stop and report if the route already returns `200`.
6. **`proxy.ts`'s `PUBLIC_PATHS` uses bare `startsWith`.** Adding `/p` and `/search` to a bare prefix match would expose `/permissions` and any future `/search-admin`. **Contained by:** Task 3 switches `PUBLIC_PATHS` to the file's own segment-aware `matchesPath` helper (already used for `STAFF_AUTH_PAGES` for exactly this reason, per its comment at line 22) and verifies `/permissions` still requires staff auth.
7. **The Pick & Pack / Shipments queue predicate.** `OrderItemStatus.packed` is set at confirm, so the obvious predicate yields an empty queue and phantom-packed items. **Contained by:** decision 10 states the real predicate, and Task 14's verification requires a non-empty "To pack" tab for an order with shipped lines and no `Shipment`.
8. **Cart identity.** Keying lines by `productId` alone silently collapses two variants into one line at one price — a mispricing bug, not a display bug. **Contained by:** the composite key and the v3 drop-on-upgrade migration in Task 8, plus Task 6's explicit verification that adding two variants yields two lines.
9. **The light pin could be undone by a later edit.** A future `bg-white` or a component that reads `.dark` directly would reintroduce the mix. **Contained by:** Task 3's `error`-level lint block scoped to every path this phase creates, and Task 20 removing the legacy warn block so the whole storefront is at `error`.
10. **Nineteen agents across two app areas.** **Contained by:** the single-owner table, disjoint route/component folder pairs per task, and the two genuine near-collisions being resolved by name (`components/storefront/shell/MiniCart.tsx` → Task 8 while Task 4 owns the rest of `shell/`; `components/public/**` deletions attributed to the deleting task, never done in bulk).

### For sign-off

1. **The quote lifecycle, and what `/cart` is allowed to say.** One quote per checkout review step, re-issued only when a quote input changes, with a live 15-minute countdown that disables Pay at zero; `410` re-quotes silently, `404` returns to the cart, `400` shows the server's message and re-quotes. The corollary is that **`/cart` shows no grand total at all** — shipping, coupon and loyalty only exist inside a quote, and a quote needs an address. The alternative (quote on every keystroke) burns booking holds and Shiprocket rate calls, and the other alternative (guess a total on the cart page) either lies to the customer or forces an address prompt before they have decided to buy. Related and already settled by P5a decision 1: **`tax_amount` is never added to a displayed total** — it is rendered as an "of which GST" line, everywhere, enforced by a `MoneyLine` primitive and a dev-mode invariant.
2. **Staff order detail becomes a route, and Shipments is driven off "no `Shipment` row".** `/pos/orders/[id]` replaces `OrderDetailSheet` (`OPS-05` words it as "replacing"), which keeps `/orders/*` free for the customer-facing `/orders/[id]/track` and lets `proxy.ts` open `/orders` to the public unambiguously. And the Shipments "To pack" queue is defined as *shipped lines whose order has no `Shipment` row*, **not** `OrderItemStatus.packed` — because P5a sets shipped lines to `packed` at payment confirm, before anyone has packed anything. Both are recorded here rather than discovered at execution time, because the first one shapes two route trees and the second one is the difference between a working queue and an empty one.
