# End-to-end: smoke 2 — the purchase

`QA-06`. One Playwright spec walks the storefront money path against a **real**
backend, Postgres and Redis: browse → facet → product detail → variant → a cart
holding all three fulfilment types → the three-step checkout → a coupon →
loyalty points → the frozen quote → Razorpay → a signed `payment.captured` →
`/orders/[id]/track`. Two negatives ride along: an expired coupon is refused in
the server's own words, and a line the server will not sell blocks checkout.

```
e2e/
  smoke-2-purchase.spec.ts   the walk
  fixtures/customer.ts       a real OTP login, cached
  fixtures/razorpay-stub.ts  checkout.razorpay.com, served locally
  fixtures/webhook.ts        a signed payment.captured
```

## What is real, and what is not

| | |
|---|---|
| Postgres, Redis, the Nest backend, every API call | **real** |
| the customer session | **real** — `send-otp` → the OTP → `verify-otp` |
| the Razorpay *order* (`POST /customer/orders`) | **real**, against `api.razorpay.com` in test mode |
| `checkout.razorpay.com/v1/checkout.js` | **stubbed** in the browser — CI needs no network for it |
| the payment capture | **a signed webhook**, not the modal |

The stub cannot mint a `razorpay_signature` the backend will accept, so
`POST /customer/orders/confirm` is not walkable from a stubbed browser.
`POST /webhooks/razorpay` is, and it runs the same `FulfilmentService.confirmPaidOrder`
— the order it produces is the real thing, distinguishable only by
`placed_via: webhook_fallback`.

## How the OTP gets into the test

There is no fixture user and no back door: `POST /customer-auth/send-otp` →
`POST /customer-auth/verify-otp` is the only way to a customer session. When
WhatsApp is unconfigured — every developer machine, and CI —
`WhatsAppService` logs the code:

```
[DEV] OTP for 9900000001: 872013
```

So **the backend has to be started with its stdout redirected to a file**, and
`E2E_BACKEND_LOG` pointed at that file. The fixture notes the file's size before
sending, then reads only what was appended, so a stale code can never be picked
up.

`send-otp` is throttled to **three requests per hour**. The verified token is
good for 30 days, so it is cached at
`node_modules/.cache/konma-e2e/customer-session.json` and reused while
`GET /customer-auth/profile` still accepts it. Delete that file to force a fresh
login. CI has no cache and therefore always exercises the full OTP path once.

## Environment

| variable | default | what it is |
|---|---|---|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3000` | the storefront under test; also decides the port `webServer` starts |
| `E2E_API_URL` | `NEXT_PUBLIC_API_URL`, else `http://localhost:4000` | the backend, as the **tests** reach it |
| `E2E_BACKEND_LOG` | — | **required** for a cold login: the file the backend's stdout was redirected to |
| `E2E_RAZORPAY_WEBHOOK_SECRET` | falls back to `RAZORPAY_WEBHOOK_SECRET` | must equal the value the backend under test booted with |
| `E2E_CUSTOMER_PHONE` | `9900000001` | the seeded demo customer (620 points, a `600096` address) |
| `E2E_SESSION_FILE` | `node_modules/.cache/konma-e2e/customer-session.json` | where the token is cached |
| `CI` | — | makes the adaptive branches below fatal instead of skipped |

The app's own `NEXT_PUBLIC_API_URL` (in `frontend/.env.local`) has to point at
the same backend, because it is **baked into the bundle at build time** and
`webServer` runs `npm run build`.

## Running it locally

Postgres and Redis first, migrated and seeded:

```sh
docker start konma-postgres konma-redis
cd backend
npx prisma migrate deploy
npm run seed:reference
SEED_DEMO_FORCE=true npm run seed:demo
npm run build
```

Then the backend, with its output going somewhere the fixture can read:

```sh
cd backend
node dist/src/main.js > /tmp/konma-backend-e2e.log 2>&1 &
```

Then the suite (it starts the frontend itself, `npm run build && npm run start`):

```sh
cd frontend
npx playwright install chromium          # once
E2E_BACKEND_LOG=/tmp/konma-backend-e2e.log \
E2E_RAZORPAY_WEBHOOK_SECRET="$(grep '^RAZORPAY_WEBHOOK_SECRET=' ../backend/.env | cut -d= -f2)" \
npm run test:e2e
```

### Running on non-default ports

`4000` and `3000` are the defaults everything agrees on. To move off them —
another agent is holding the usual pair, say — three things have to move
together, and **`FRONTEND_URL` is the one that is easy to forget**: the
backend's CORS allow-list is built from it, and a mismatched origin makes every
credentialed call fail silently, so the storefront just says "You are browsing
as a guest".

```sh
# backend on 4100, trusting a storefront on 3100
cd backend && PORT=4100 FRONTEND_URL=http://localhost:3100 \
  node dist/src/main.js > /tmp/konma-backend-e2e.log 2>&1 &

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4100

cd frontend
PLAYWRIGHT_BASE_URL=http://localhost:3100 \
E2E_API_URL=http://localhost:4100 \
E2E_BACKEND_LOG=/tmp/konma-backend-e2e.log \
E2E_RAZORPAY_WEBHOOK_SECRET=… \
npm run test:e2e
```

## The two projects

`desktop` (1440×900) runs the money path; `mobile` (Pixel 5) runs only the tests
tagged `@mobile`, which are **read-only**. A purchase confirms a real order,
burns a coupon redemption and turns an experience hold into a confirmed booking,
so running it once per viewport would buy twice. `workers: 1` for the same
reason: every test shares one customer, one server-side cart and one quote
namespace.

## Why the spec chooses its data at run time

The seeded database is not a fixture this suite owns — earlier smokes have
already bought from it. So nothing is hard-coded:

* the **products** come from `GET /catalog/products` filtered through
  `GET /catalog/availability/:id`, because `masala-chai` and
  `smoked-butter-chicken-bowl` are already sold out of ingredient stock;
* the **experience** is chosen from the sittings this customer has no booking
  on, because `EventBooking` is `@@unique([event_id, customer_phone])` and only
  `held` rows are swept — a *confirmed* seat blocks that sitting forever;
* the **coupon** assertion accepts either answer the server is entitled to give,
  asserting the exact text in both cases: `WELCOME10` is
  `per_customer_limit: 1`, so the second run gets
  `You have already used this coupon` rather than a discount.

Under `CI` — where the database is seeded fresh for every job — the strict
branch is the only one that can be taken, and an exhausted catalogue is a
failure rather than a skip.

### Restoring the strict local walk

Two seeded sittings means two strict local runs. To get back to a full
three-group purchase without re-seeding everything:

```sh
docker exec -i konma-postgres psql -U konma -d konma <<'SQL'
DELETE FROM "EventBooking"
 WHERE customer_phone = '9900000001' AND status IN ('held', 'confirmed');
DELETE FROM "CouponRedemption"
 WHERE customer_id = (SELECT id FROM "Customer" WHERE phone = '9900000001');
SQL
```

`OrderItem.event_booking_id` is `onDelete: SetNull`, so the orders those
bookings belonged to survive with the link cleared. The nuclear option is a full
re-seed:

```sh
cd backend && npx prisma migrate reset --force \
  && npm run seed:reference && SEED_DEMO_FORCE=true npm run seed:demo
```

Loyalty points are the one thing that only ever goes down: each run burns 20 of
the seeded 620, and the loyalty leg annotates and skips once the balance can no
longer fund a redemption.

## CI

`.github/workflows/ci.yml` → the `frontend-e2e` job. Postgres and Redis as
services, `prisma migrate deploy`, `seed:reference`, `SEED_DEMO_FORCE=true seed:demo`,
`node dist/src/main.js` with stdout to `$E2E_BACKEND_LOG`, then
`npx playwright install --with-deps chromium && npm run test:e2e`. On failure the
trace, the HTML report and the backend log are uploaded as `playwright-trace`.

It needs three repository secrets — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET` — set to a **test-mode** key pair and its webhook
secret, because `POST /customer/orders` opens a real Razorpay test order.

`SHIPROCKET_WEBHOOK_TOKEN` is set in the job (any 16+ character value) because
`POST /webhooks/shiprocket` answers `403` without it **by design** — P5a
deviation 8: the courier callback is authenticated by a shared secret rather
than a body HMAC, and `ShiprocketWebhookService` fails closed. This smoke does
not exercise that route; the value is there so a future shipment smoke does not
have to rediscover it.
