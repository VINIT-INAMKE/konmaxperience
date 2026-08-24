# Phase 34-01 — P5b "Marketplace Storefront + Staff Commerce" Summary

**Branch:** `v2-os-marketplace`
**Range:** `089a947..6b82f7f` (frontend `254 files, +31,829 / −4,348`; backend Task 2 `20 files, +1,488 / −63`)
**Plan:** `docs/superpowers/plans/2026-08-24-p5b-storefront-staff-commerce.md` (20 tasks)
**Date:** 2026-08-24 → 2026-08-25

P5b puts a face on the pipeline P5a built. Eighteen storefront routes under `app/(public)/**` and six
staff commerce screens under `app/(ops)/**` share nothing but `lib/types/**`, which is why they were
implemented by nineteen parallel agents in isolated worktrees off three Wave-0 foundations: the typed
mirror, seven surgical backend gaps, and the config/theming layer. The money contract P5a signed off is
carried through unchanged — `tax_amount` is *inside* `subtotal` and is never added to a displayed total,
`variantId` is half a cart line's identity, and a quote is a stored 15-minute artefact whose id
`POST /customer/orders` requires.

Three commits in the range (`b7da851`, `6885699`, `8e29ac8`) are **Phase 35 Wave 1**, not P5b. They are
backend-only and are called out where they move a number this record quotes.

---

## What P5b delivered

| Task | Commit(s) | What landed |
|---|---|---|
| 1 | `089a947`, `4b32475` | The typed mirror, cross-checked against the merged P5a controllers rather than the plan's appendix: `lib/types/{storefront,checkout,shipments,promotions,reviews,customers,refunds}.ts`, all eleven `SystemSetting` keys, `lib/format/{currency,date}.ts` with `assertInclusiveTotal`, `lib/seo/{metadata,json-ld}.ts`, and `ApiError extends Error` carrying `status` so `410` is distinguishable from `404` at the call site. `StorefrontProduct` declares **no** cost/yield/BOM/margin field, so `CAT-03` is enforced by the compiler. |
| 2 | `81988d8` | **The only backend task.** Every gap reproduced against a booted `dist/src/main.js` before a line changed: six customer routes missing `@Public()` (the global `PermissionsGuard` was 403-ing a logged-in customer on `GET`/`PATCH /customer-auth/profile`, `logout`, `pusher-auth`, `POST /events/:id/checkout`, `bookings/confirm`) — decision 12 confirmed at runtime, not inferred; `@Public()` on `GET /catalog/availability/:productId`; the cart-shrink merge rule; `marketing_opt_in`; `POST /storage/presign-product-media`; `POST /customer/checkout/serviceability`; and the `order.status_changed → shipped` `AuditEvent` hole P5a recorded. |
| 3 | `5e03eea` | The light pin made **real** — `.light` had never been a selector in `tokens.css`, so `app/(public)/layout.tsx`'s `className="light"` was inert and a dark-OS visitor got a three-way mixed storefront. Plus the 37 raw-colour literals swept, `next.config.ts` R2 `remotePatterns` (dropping `unoptimized`), `proxy.ts` `PUBLIC_PATHS` extended and switched to segment-aware `matchesPath`, and all four Phase-34 spine entries. |
| 4 | `cd60b9c` | `STORE-04`. The shell: a two-row desktop header collapsing to a sheet below `md`, `StorefrontNav`, a `MiniCartTrigger` client island, a real footer, and the `MoneyLine` / `PriceTag` / skeleton / empty / error primitives every Wave-2 list uses. `app/(public)/layout.tsx` stays a **server** component. |
| 5 | `72ae7dd` | `/shop`, `/shop/[category]`, `/search` — server components with `generateMetadata`, facets driven by URL search params (shareable, back-button-correct), `LoadMore` the one client island, `robots: { index: false }` on `/search`. |
| 6 | `fe863c0` | `/p/[slug]` — variant selection, media gallery through the now-optimised `next/image`, published reviews, `productJsonLd` with `aggregateRating` only when `rating_count > 0`, and add-to-cart carrying `variantId`. |
| 7 | `e95b4af`, `bf72c98` | `/experiences` and `/experiences/[slug]` — hold-aware seat counts read from `GET /events/:id` (the plan pointed at `/catalog/availability/:productId`, which does not subtract live holds), `Event` + `BreadcrumbList` JSON-LD, and a booking panel that adds a `fulfilment: booking` cart line rather than booking directly. |
| 8 | `0467867` | Cart store **v3**: lines keyed by `cartLineKey(productId, variantId)`, byte-identical to the key the backend's `assertQuoteStillValid` builds; the persisted `migrate` drops v2 carts rather than half-reading them. `use-cart` rewritten around sync → quote → order; the mini-cart sheet. |
| 9 | `691303b` | `/cart` — sync-on-mount server re-pricing, debounced re-sync on quantity edits, three labelled fulfilment groups, rejected lines shown with the server's own reason, and **no grand total** (decision 6: shipping and discounts only exist inside a quote). |
| 10 | `a7abaab` | `/checkout` — Contact → Fulfilment → Review behind a server `page.tsx` carrying `robots: { index: false }`. One quote per review step, re-issued only when one of five primitives changes; a 15-minute countdown from `expires_at` that disables Pay at zero and offers "Refresh price"; Razorpay; confirm. |
| 11 | `801486a` | `/orders/[id]/track` — one rail per fulfilment group instead of a single meaningless bar. `Order.status: 'shipped'` maps to `confirmed` on the local rail, because booking a courier says nothing about the kitchen line beside the parcel. Live shipment tracking over Pusher. |
| 12 | `d3dfbf3`, `bf72c98` | `/account`, `/account/{orders,orders/[id],addresses,loyalty,reviews,preferences}`, `/login`, the session context, and the retirement of the 971-line `/profile` page. `ACCT-01`, `ACCT-02`, `STORE-03`. |
| 13 | **`864da4b`** | **SEO** — sitemap, robots, OG image, the four 308 redirects, the `proxy.ts` matcher fix, and the indexability audit. See below. |
| 14 | `b9ebac9` | Staff **Shipments** — two tabs over `private-shipments`. "To pack" is assembled from three existing reads to satisfy the signed-off predicate (shipped lines whose order has no `Shipment` row), never `OrderItemStatus.packed`. Provider-aware AWB dialog, pickup, label, cancel, event timeline, 30 s poll fallback. |
| 15 | `515603f` | Staff **Promotions** (coupon CRUD, cursor passed back verbatim) and **Reviews** moderation. |
| 16 | `e17e147` | Staff **Customers** — list with debounced search into the query key, detail with orders/loyalty/reviews/addresses, loyalty adjust, marketing opt-in. |
| 17 | `196b0de` | Staff **Orders** — `/pos/orders/[id]` becomes a real route and `OrderDetailSheet` is deleted, so the refund ledger, the shipment link and the lifecycle actions are linkable and reloadable. Closes the Phase 26 intent. |
| 18 | `aa17108` | Staff **Experiences** — `AttendanceSheet` replaces `BookingListSheet`; capacity recomputes the backend's own `OCCUPYING_BOOKINGS` rule client-side; attendance marking against `POST /events/:id/attendance`. |
| 19 | `f91ec32` | Staff **Catalog** — `ProductForm` becomes a three-tab sheet (Details / Variants / Media). `VariantEditor` and the R2 `MediaManager` were the only two things `OPS-01` was missing; closes P2 follow-up #6. |
| 20 | **`d623af1`** | **Playwright, smoke 2, CI, the lint ratchet.** See below. |

Merge commits, in order: `d6a36c4` `8a53b76` `d1232e8` `3a52539` `728e87e` `12f0753` `4bc9d27` `2ab8376`
`29849ed` `17fbe7b` `31bb010` `b0d22fa` `e33c28d` `6dad91b` `047f9dd` `f9785d6` `7e6be2e` `b1d7fcd`
`dcdabd7` **`6b82f7f`**.

**24 files deleted**, each by its replacing task so the deletion stays attributable: the four superseded
route pages (`/menu`, `/events`, `/events/[id]`, `/profile`), `OrderDetailSheet`, `BookingListSheet`, and
eighteen superseded `components/public/*` shelves. What survives there is exactly what the plan said would:
`ScrollVideoStory` (frozen), `OtpDigitInput`, `CustomerOtpForm`, `GooglePlacesInput`, `StarRatingInput`,
`OrderTrackingTimeline`, `FeedbackThankYou`. New work lives in `components/storefront/**` (ten families).

---

## Task 13 — SEO

### The redirects moved into `next.config.ts`

The plan specified route-level `redirect()` pages so the `(public)` layout would still apply. Reading the
routing chain changed the answer: config redirects are answered at step 2 (headers → **redirects** →
proxy → rewrites → filesystem), *before* the proxy and before the filesystem, so each is a real **308**
with a `Location` header and no rendered body — where a `redirect()` page answers **307** and costs a
render of the whole route group forever. All four are `permanent: true`:

| From | To | Why permanent |
|---|---|---|
| `/menu` | `/shop?type=prepared_food` | SPEC §5.1; the frozen homepage links here three times |
| `/events` | `/experiences` | same freeze; three more homepage links |
| `/events/:id` | `/experiences` | to the **list**: the old route addressed an `Event` by uuid and the public catalog offers no id→slug lookup |
| `/profile` | `/account` | one page became six |

All four curl-verified as `308` at runtime. `app/page.tsx` is untouched (SPEC §1.3) — these rules are what
keep its six legacy links working. The four superseded pages and the three now-orphaned legacy components
(`CategoryTabBar`, `MenuBrandTabs`, `ProductOrderCard`, imported only by the deleted `/menu`) went with
them.

### `app/sitemap.ts` — 21 URLs, matching the live catalogue exactly

4 static (`/`, `/shop`, `/experiences`, `/search`) + 5 categories + 10 non-experience products + 2
experiences. It walks `/catalog/products` through every `next_cursor` rather than assuming one page,
`lastModified` comes from `updated_at`, and `revalidate: 3600`. **An experience is listed once**, under
`/experiences/[slug]` and not also under `/p/[slug]`: both routes resolve it (`findProductBySlug` does not
discriminate by type), but `/experiences/[slug]` is the canonical address — it is what `ExperienceCard`
links to, where `/p/[slug]`'s own booking button sends the visitor, and the only one of the two that
renders the hold-aware seat count. Every fetch resolves to `null` on failure and a `null` drops that group
of URLs, so a build machine with no backend still emits a valid sitemap instead of a `500`.

### `app/robots.ts` — 5 `Allow`, 34 `Disallow`

Allow `/`, `/shop`, `/p`, `/experiences`, `/search`. Disallow 6 session-scoped storefront prefixes
(`/cart`, `/checkout`, `/account`, `/orders`, `/feedback`, `/login`) and 28 staff segments — an explicit
list, not a wildcard, because `robots.txt` has no "everything except" operator and an accidental
`Disallow: /` would take the storefront down with it. The `sitemap` pointer is absolute.

### The `proxy.ts` matcher hole — load-bearing

Without it the whole feature was inert: `proxy.ts` fell through to its "no token → `/team`" branch and
answered Googlebot's `GET /robots.txt` with a `307` to the staff login. `sitemap.xml`, `robots.txt` and
`opengraph-image` joined the existing asset exclusions in the matcher, which is the pattern Next's own
proxy documentation prescribes.

### The indexability audit

All six public routes (`/shop`, `/shop/[category]`, `/p/[slug]`, `/experiences`, `/experiences/[slug]`,
`/search`) export `generateMetadata` and contain no top-level `'use client'`. Every private route carries
`robots: { index: false }`. Two real defects were found and fixed rather than recorded:

1. `/shop/[category]`'s unresolved-slug branch emitted an indexable `Shop — Konma` card with a canonical
   pointing at the dead URL; it now returns a not-found title with `index/follow: false`, matching what
   `/p/[slug]` and `/experiences/[slug]` already did.
2. `/login` and `/feedback/[orderId]` are `'use client'` and could therefore export no metadata at all.
   Both gained a metadata-only `layout.tsx` (the shape `account/layout.tsx` already uses), because
   `Disallow` stops a crawl but not a listing.

**Three soft-404s remain.** `/p/…`, `/shop/…` and `/experiences/…` with an unknown slug return a `200`
body rather than a `404` status, because the route group's `loading.tsx` Suspense boundary commits the
response before `notFound()` is reached. All three inject `noindex`, so nothing can be listed; the
status-code fix needs slug resolution in `proxy.ts` and is deferred.

---

## Task 20 — Playwright, smoke 2, CI, the ratchet

### The harness

`playwright.config.ts`: `testDir: './e2e'`, `fullyParallel: false`, `workers: 1`, `retries: 1` in CI,
`trace: 'on-first-retry'`, `timeout: 180 s` (a quote holds fifteen minutes and a production build is cold
on first hit), `webServer` running `npm run build && npm run start`. Two projects:

- **`desktop`** — Chromium at 1440×900, `grepInvert: /@mobile/`, runs the money path.
- **`mobile`** — Pixel 5, `grep: /@mobile/`, **read-only by construction**. A purchase confirms a real
  order, burns a coupon redemption and turns a hold into a confirmed booking, so running the money path
  once per viewport would buy twice.

### What is real and what is not

| | |
|---|---|
| Postgres, Redis, the Nest backend, every API call | **real** |
| the customer session | **real** — `send-otp` → the `[DEV] OTP …` line → `verify-otp` |
| the Razorpay **order** (`POST /customer/orders`) | **real**, against `api.razorpay.com` in test mode |
| `checkout.razorpay.com/v1/checkout.js` | **stubbed** via `page.route` — CI needs no network for the modal |
| the payment capture | **a signed webhook**, not the modal |

A stub cannot mint a `razorpay_signature` the backend will accept, so `POST /customer/orders/confirm` is
not walkable from a stubbed browser. `POST /webhooks/razorpay` is, and it runs the same
`FulfilmentService.confirmPaidOrder` — the order it produces is the real thing, distinguishable only by
`placed_via: webhook_fallback`. This is the **same boundary P5a's smoke stopped at**, for the same reason.

### The fixtures

- **`customer.ts`** — no fixture user, no back door. It notes the backend log's size before sending so a
  stale code can never be picked up, and caches the 30-day token under `node_modules/.cache` because
  `send-otp` is throttled to three per hour and a suite that logged in cold every run would lock itself
  out. CI has no cache and therefore always exercises the full OTP path once.
- **`razorpay-stub.ts`** — serves a local `checkout.js` defining `window.Razorpay` with `open()`/`on()`
  and recording the options it was constructed with.
- **`webhook.ts`** — an HMAC-SHA256-signed `payment.captured` with
  `notes: { type: 'marketplace', entity_id: <customerId> }`, the exact request P5a §5c recorded.

### Nothing hard-coded that the data can move

The seeded database is not a fixture this suite owns — earlier smokes have already bought from it. So the
products are chosen at run time from `GET /catalog/products` filtered through
`GET /catalog/availability/:id` (`masala-chai` and `smoked-butter-chicken-bowl` are already sold out of
ingredient stock), the experience from sittings this customer has no booking on (`EventBooking` is
`@@unique([event_id, customer_phone])` and only `held` rows are swept, so a *confirmed* seat blocks that
sitting forever), and the coupon assertion accepts either answer the server is entitled to give — the
discount, or `You have already used this coupon`, since `WELCOME10` is `per_customer_limit: 1`. Under `CI`,
where the database is seeded fresh, the strict branch is the only reachable one and an exhausted catalogue
is a failure rather than a skip.

### CI

A `frontend-e2e` job: `postgres:16-alpine` + `redis:7-alpine` services, `prisma migrate deploy`,
`seed:reference`, `SEED_DEMO_FORCE=true seed:demo`, backend booted with stdout redirected to the file the
fixtures read, then `playwright install --with-deps chromium && npm run test:e2e`, trace uploaded on
failure. It needs **three repository secrets that are not yet set**: `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, all test-mode. `SHIPROCKET_WEBHOOK_TOKEN` is set in-job
to a literal with a comment recording that `POST /webhooks/shiprocket` answers `403` **by design** when it
is absent (P5a deviation 8) — the purchase smoke does not touch that route, but a future shipment smoke
should not have to rediscover it.

### The lint ratchet

P4 left a **warn**-level raw-colour block over `app/(public)/**`, `components/public/**` and
`app/(auth)/**` as a debt ledger for a storefront it knew Phase 34 would rewrite, and held only the
then-unwritten `components/storefront/**` to an error. Phase 34 has landed, the ledger has nothing left to
excuse, and the two blocks collapse into one **error**-level block covering the entire customer surface —
`app/(public)/**`, `app/(auth)/**`, `components/public/**`, `components/storefront/**` — with
`noBannedPrimitiveRules` riding along (SPEC §6.4 applies to the storefront too). `app/page.tsx` and
`ScrollVideoStory.tsx` stay excluded, and their block stays **last**, because its globs sit inside the new
one and the final matching config wins. CI's ceiling ratchets `--max-warnings 80 → 60`.

---

## Gates on the merged tree (`6b82f7f`)

| Gate | Result |
|---|---|
| **frontend** `npx tsc --noEmit` | exit `0` |
| **frontend** `npx eslint .` | **0 errors**, 53 warnings (all React Compiler diagnostics) |
| **frontend** `npx eslint . --max-warnings 60` | exit `0` — the new CI ceiling |
| **frontend** `npm run build` | compiled, **83/83 static pages** |
| **frontend** `npm run test:e2e` | **3 passed** — the strict purchase path, the unavailable-line negative, the mobile readability check |
| **backend** `npx jest --silent` | **111 suites / 1749 tests** (1722 passed, 27 todo) |
| **backend** `npx tsc --noEmit -p tsconfig.build.json` | exit `0` |
| **backend** `npx eslint "{src,apps,libs,test}/**/*.ts"` | **0 errors** |
| **backend** `npm run -s build` | exit `0` |

Two notes on those numbers, both deliberate:

1. **The backend counts include Phase 35 Wave 1.** `b7da851`/`6885699`/`8e29ac8` merged into the same
   branch before `6b82f7f`. P5b's own backend contribution is Task 2 alone; the 111/1749 figure is the
   merged tree, not P5b's delta.
2. **Task 20's own commit message records 55 warnings**, measured on its worktree branch before merge.
   The merged tree measures 53. Neither crosses the 60 ceiling.

P5b adds **no migration** (`backend/prisma/migrations/**` had no owner in the partition), so the drift gate
is unchanged from P5a's `No difference detected.`

---

## The walk-through — what is proven, and how

This is stated precisely because the plan's Task 20 asked for a single fresh end-to-end walk-through and
that is not what happened.

**The storefront money path is proven by machine.** `npm run test:e2e` passes 3/3 on the merged tree, and
the strict path is the walk-through SPEC §10 asks for: browse → facet → product detail → variant selection
→ a cart holding all three fulfilment types → `/cart` (three groups, no grand total) → Contact →
Fulfilment → Review → `WELCOME10` → a 20-point loyalty redemption → the frozen quote (asserting the line
items, the "of which GST" line, the countdown, and `total = subtotal − discount − redeem + shipping`) →
Pay (asserting the `razorpay_order_id` and that the stub opened) → a signed `payment.captured` →
`/orders/[id]/track` rendering the confirmed order. Two negatives ride along: `EXPIRED5` refused in the
server's own words, and a line the server will not sell turning "Continue to checkout" into a disabled
button with the reason beneath it. The mobile project asserts the small-screen chrome.

**The staff commerce path is not re-proven here, and was not re-run.** Pack → AWB → pickup → label →
courier webhook → delivered → review moderation → partial and full refund with loyalty clawback was
runtime-proved at the **API** layer in P5a's 51-request smoke (recorded verbatim in
`.planning/phases/33-p5a-marketplace-backend/33-01-SUMMARY.md` §5d–§5f), and each Wave-3 staff screen was
manually checked against that same seeded stack by its task agent at merge time, per the per-task
verification blocks. What does **not** exist is a single fresh operator walk-through of the seven staff
screens end to end on the merged tree. It is recorded as outstanding rather than claimed.

---

## Deliberate deviations

1. **The four redirects are `next.config.ts` rules (`308`), not route-level `redirect()` pages (`307`).**
   Plan Task 13 and decision 20 specified the latter so the `(public)` layout would still apply; the
   layout turned out to be irrelevant to a redirect that never renders, and a `308` with no body is what
   moves link equity. `permanent: true` on all four.
2. **`proxy.ts`'s matcher had to be widened** — not in any task's file list. Without excluding
   `sitemap.xml`, `robots.txt` and `opengraph-image`, the proxy 307-bounced all three to the staff login
   and Task 13 shipped inert. Found by curl, not by review.
3. **Experience capacity is read from `GET /events/:id`, not `GET /catalog/availability/:productId`.**
   The plan pointed Task 7 at the catalog route; its `capacity` branch does not subtract live holds, so a
   sitting could show seats it had already promised. The events route is hold-aware and is what the
   staff attendance screen computes against.
4. **The "To pack" queue is assembled from three reads, not one.** No single endpoint answers "shipped
   lines whose order has no `Shipment` row" (decision 10), so Task 14 pages `GET /shipments` to exhaustion
   for the packed `order_id` set and cross-references `GET /orders`. Driving it from `OrderItemStatus.packed`
   — which `applyCommercialEffects` sets at *confirm*, before anyone packs — would have shown an empty
   queue beside a pile of phantoms.
5. **Task 2's guard defect was confirmed at runtime before it was fixed.** Decision 12 was inferred from
   NestJS guard ordering; the plan required a reproduction first, and the reproduction agreed — all six
   routes 403'd their own logged-in customer. A controller spec now asserts the decorator on each handler
   so a refactor cannot silently re-break the account surface.
6. **`/experiences/[slug]` and `/p/[slug]` both resolve an experience; only the former is in the
   sitemap.** Submitting both would volunteer a duplicate. `/p/[slug]` keeps rendering one (with an
   "Experiences" breadcrumb and a booking button that sends the visitor to the canonical route) because
   `findProductBySlug` does not discriminate by type and making it do so would be a backend change no
   task owned.
7. **The e2e suite chooses its data at run time.** The seeded database is shared with earlier smokes;
   hard-coding `masala-chai` or a sitting would have made the suite fail on the second run rather than
   on a regression.
8. **`workers: 1` and a read-only mobile project.** Every test shares one customer, one server-side cart
   and one quote namespace, and a purchase has real side effects. Parallelising or re-running the money
   path per viewport would double-buy.

---

## Observations recorded, not fixed

Carried forward from the Wave 1/2 agent reports, plus what Waves 3–4 added. None blocks anything shipped.

**Backend gaps the storefront works around:**

- `GET /catalog/availability`'s `capacity` branch ignores live holds — the experiences pages read
  `GET /events/:id` instead (deviation 3). A backend fix is wanted so one route is authoritative.
- No `sort` param on `GET /catalog/products`; `CatalogSort` therefore sorts within the 200-row page cap.
- `PUBLIC_INCLUDE` variants lack `stock_on_hand`, so a variant's own low-stock state is invisible publicly.
- `getOrderById` items lack the `event` relation, so the track page cannot show a booking's date.
- No staff receipt endpoint.
- No `PATCH /catalog/media/:id` — a reorder is create-then-delete.
- No `order_id` filter on `GET /shipments` (part of why the "To pack" queue needs three reads).

**Frontend and SEO:**

- **`app/layout.tsx` hardcodes `metadataBase: https://konma.store` while `lib/seo/metadata.ts` reads
  `NEXT_PUBLIC_SITE_URL`.** Two sources of truth for the same origin; a deployment on another host gets
  mixed canonicals.
- **Unknown routes 307-bounce to `/team`** via the `proxy.ts` fallthrough — there is no real 404 for a
  path outside `PUBLIC_PATHS`.
- **The three soft-404s** (`/p|/shop|/experiences` with an unknown slug) return `200` bodies, `noindex`
  injected. The fix needs slug resolution in the proxy.
- **The sitemap's cursor pagination is unexercised** — one page of seed data never advances the cursor,
  so the `MAX_PAGES` walk is written but untested against a real second page.
- `AccountLink` still issues its own profile `GET` instead of using `loadCustomerProfile`.
- `use-cart.ts` carries a stale header comment and a redundant profile effect.

**Schema:**

- **`Notification.is_email_sent` is still not dropped.** Deferred to Phase 35 Task 4, where a schema
  comment and an `it.todo` mark it.

---

## Operator / user actions required

None of these can be done from the repository, and two of them gate CI.

1. **Set the three Razorpay test-mode repository secrets** — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`. Until they exist the `frontend-e2e` job fails at "Razorpay not configured".
2. **Set `NEXT_PUBLIC_R2_PUBLIC_URL` in production.** `next.config.ts` degrades to the `cdn.konma.store`
   / `**.r2.dev` fallbacks without it, which is safe for a build but wrong for a different bucket.
3. **Create the R2 lifecycle rule `expire-exports-30d`** per `docs/R2-LIFECYCLE.md` (landed with Phase 35
   Wave 1; it is a console action, not code).
4. **Submit the five Meta WhatsApp templates** for approval — Phase 35 needs them before `RUN-01` can
   fire.

---

## Deferrals carried into Phase 35

- **A fresh operator walk-through of the seven staff commerce screens** on the merged tree (see "The
  walk-through" above).
- **`QA-05`'s second half — the Postgres-backed integration harness** (`test/jest-integration.json`).
  Carried from Phase 31's `QA-02` and Phase 33; now three phases deep. The Playwright smoke covers the
  storefront path through HTTP, which is not the same thing as transaction-level coverage.
- **`refund.failed` webhook reconciliation** — deliberately out of P5b scope (decision 11), still unhandled.
- **The 15-minute hold vs the 30-minute pending order** — a payment captured after its booking hold was
  swept still throws inside `applyCommercialEffects` and leaves a captured payment with no order.
- **Soft-404 status codes** and the **`metadataBase` / `NEXT_PUBLIC_SITE_URL` split** (above).
- **Shiprocket sandbox** — the eight adapter request/response shapes remain the only surface untested
  against reality; `SystemSetting['shipping'].provider` still seeds `manual`.
- **`Order.zone_id` → `fulfilment_zone_id` rename**, **multi-shipment orders** — unchanged deferrals.

---

## Status

**Phase 34 (P5b) is complete.** All 20 plan tasks are merged at `6b82f7f`. Eighteen storefront routes and
six staff commerce screens are live on the P5a pipeline; the storefront purchase flow that Phase 33 left
broken — `use-cart.ts` posting an empty body to a route that now demands `{ quote_id }`, and a frontend
with zero occurrences of `variantId` — is not merely repaired but proven by a passing Playwright smoke on
the merged tree.

Gates at `6b82f7f`: frontend `tsc` clean · `eslint` 0 errors / 53 warnings against a ceiling of 60 ·
`next build` 83/83 static pages · `test:e2e` 3/3. Backend on the same tree (including Phase 35 Wave 1):
111 suites / 1749 tests · `tsc` clean · 0 lint errors · build clean. No migration was added, so the drift
gate stands where P5a left it.

**Next:** Phase 35 (Run-It Layer, P6) is already **in progress** — Wave 1 (Tasks 1–3: the P6 schema and
settings, the heuristic-first `AiProviderPort`, and the unified advisory-lock registry with stock
reconciliation and the R2 orphan sweep) merged at `b7da851` / `6885699` / `8e29ac8` with a green combined
backend gate, and Wave 2 (Tasks 4–7) is in flight.
