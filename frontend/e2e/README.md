# End-to-end smokes

Two walks share one Playwright project and one live stack. **Smoke 2 — the
purchase** (`QA-06`) is documented first, because it is what this harness was
built for; **smoke 1 — the mission flow** (`QA-03`) is the last section of this
file and rides the same config, the same `npm run test:e2e` and the same
`frontend-e2e` CI job with nothing added to any of them.

## Smoke 2 — the purchase

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

---

# Smoke 1 — the mission flow

`QA-03`. `e2e/smoke-1-mission.spec.ts` walks SPEC §0's loop through the ops
shell, with two people and a real backend: *I do the real work → the work itself
becomes the proof → someone with skin in the game signs it off → a meter I care
about moves.*

```
e2e/
  smoke-1-mission.spec.ts    the walk
  fixtures/staff.ts          POST /auth/login, cached; and the sign-in form
```

The walk, in order:

1. **`/tasks` while logged out** → `proxy.ts` *rewrites* (not redirects) onto the
   login page, so the URL stays `/team?redirect=%2Ftasks`. `GET /tasks` on the
   API answers `401`. This is a separate test and needs no credentials.
2. The task's **owner signs in at the real form** and lands on `/tasks`.
3. She finds the task by title; the row carries a `MeterChip` naming the
   readiness meter it feeds and the points it is worth.
4. On `/tasks/:id`: three unmet validation conditions, no evidence.
5. She moves the status to **Done** — one condition met.
6. She attaches **link** evidence, which lands `pending`.
7. **Negative:** she is offered no approve control over evidence she wrote
   herself, even holding every permission in the system.
8. A second person reads the pending approval off **`/approvals`** — the role the
   policy named, and whose work it is.
9. He approves the **evidence** — and the task is **still not valid**, asserted
   against the API, because the policy approval is undecided. This is P3
   decision 4 and the reason the spec exists.
10. He decides the **policy approval** from the task page's *Waiting on your
    sign-off* block. The task turns `valid` / `verified`, `valid_xp` lands.
11. **`/readiness`** shows the meter risen by exactly the task's
    `readiness_value`, cross-checked against `GET /readiness-meters`.

## Who the two actors are, and why

| | role | what they do |
|---|---|---|
| author | `FOUNDER_ADMIN` — `admin@konma.store` | signs in at the form, does the work, attaches the proof |
| approver | `TECH_LEAD` — `vinit@konma.store` | stands the fixture up over the API, then signs it off |

The **domain is `tech`** so that exactly one approval materialises: there is no
`(scope: task, domain: tech)` policy, so the node's default `(task, null)` row
applies and its empty `required_role_codes` is expanded by
`DOMAIN_LEAD_ROLE.tech` to a single `TECH_LEAD`. `food` would materialise two
(`BACKEND_LEAD` **and** `FRONTEND_LEAD`, `mode: all`) and cost a third login.

The author *ought* to be an ordinary lead — the loop is about the person who did
the work. It is the founder because of a live defect; see below.

## Two defects this spec had to walk around

Both were found while writing it. Neither is fixed here — this is a test file —
and both are worth a ticket.

1. **A task's own owner sees their own task page as read-only.**
   `TasksService.findOne` does not project `is_own`, and
   `app/(ops)/tasks/[id]/page.tsx` computes
   `canEdit = task?.is_own === true || isAdmin`. So the owner of a task opens it
   and is told *"Read-only -- this task belongs to &lt;themselves&gt;"*: no status
   control, no evidence upload, no Edit. `GET /tasks` (the list) *does* carry
   `is_own`, which is why the list row's status select works and the page's does
   not. Only a `FOUNDER_ADMIN` can drive a task page today — hence the actor
   table above. When `findOne` starts projecting `is_own`, move `STAFF.author` to
   a `_LEAD` and `STAFF.approver` to whichever lead that task's domain maps to.

2. **"Add a note" evidence can never be saved.** `NoteEvidenceForm` posts
   `{ type: 'note', url: '', notes }`, and `CreateEvidenceDto.url` is
   `@IsString() @IsNotEmpty()`, so the backend answers
   `400 url should not be empty` on every attempt; the component swallows it into
   a `Failed to submit note.` toast. The spec therefore uses **Add a link**,
   which posts a real `url` and works. Both are equally free of object storage —
   `EvidenceService.create` writes straight to Postgres and `EvidenceModule` does
   not import `StorageModule` — so nothing here needs R2.

## Credentials

Staff log in with a password, and `prisma/seed-demo.ts` generates those with
`randomBytes(24)`, prints them to stdout **once** and never stores them. There is
no `[DEV]` log line to scrape as there is for the customer's OTP, so the password
has to be told to the suite. `fixtures/staff.ts` looks in three places, in order:

| source | |
|---|---|
| `E2E_STAFF_PASSWORD_<ROLE_CODE>` | one role, explicitly — e.g. `E2E_STAFF_PASSWORD_TECH_LEAD` |
| `E2E_STAFF_PASSWORDS` | several, as `ROLE=secret` or `email=secret`, separated by newlines, commas or semicolons |
| `.planning/phases/31-p3-mission-bridge/31-01-SUMMARY.md` §6 | the eight demo passwords, parsed at run time |

The third is why a developer machine needs no configuration: those passwords were
rotated by hand against the local `konma` database. They are **read** from that
record rather than copied into the fixture, so the repository keeps exactly one
plaintext copy of a demo credential.

They are also database-specific. A database seeded independently has eight
*different* random passwords and will simply `401`. That is an ordinary state,
not a defect, so a `401` on a password that came from the demo record makes the
walk **skip** with the reason on the report; a `401` on a password that came from
the **environment** is fatal, because then something really is wrong.

| variable | default | what it is |
|---|---|---|
| `E2E_STAFF_PASSWORD_<ROLE>` | — | one role's password |
| `E2E_STAFF_PASSWORDS` | — | several, as `ROLE=secret` pairs |
| `E2E_STAFF_SESSION_DIR` | `node_modules/.cache/konma-e2e` | where the tokens are cached |

`POST /auth/login` is throttled to **five per five minutes per IP**. A cold run
spends two (the approver over the API, the author at the form); every run after
that spends one, because the approver's token is cached and reused while
`GET /auth/me` still accepts it. Delete `node_modules/.cache/konma-e2e` to force
the full path. The author always walks the form — that is the "login" in
*login → task → evidence → approve → meter moves*.

## Running it locally

The same stack smoke 2 needs, minus the Razorpay secrets — smoke 1 touches no
payment path, and no `E2E_BACKEND_LOG` either, because staff auth reads nothing
out of the backend's stdout:

```sh
docker start konma-postgres konma-redis
cd backend && npx prisma migrate deploy && npm run seed:reference \
  && SEED_DEMO_FORCE=true npm run seed:demo && npm run build
node dist/src/main.js > /tmp/konma-backend-e2e.log 2>&1 &

cd ../frontend
npm run test:e2e -- smoke-1
```

## Why it survives a re-run, and how to reset it

Neither seed writes a single `Mission`, `Quest` or `Task`, so there is nothing to
find and the spec **creates its fixture**: a mission, then a task wired to a
readiness meter. It picks a **`task_driven`** meter deliberately — a `hybrid`
meter blends `task_value` with a derived formula 50/50 and would move by half the
points, and a `derived` meter discards `task_value` and would not move at all.
There are six task-driven meters and the spec takes whichever is emptiest.

Every run adds a `TaskReadinessEvent` worth 20 points, and `task_value` clamps at
100 — so five runs exhaust one meter and thirty exhaust all six. When none has 20
points of headroom left the walk annotates and skips locally, and **fails on CI**,
where the database is fresh and every meter reads `0`.

To empty them again without re-seeding:

```sh
docker exec -i konma-postgres psql -U konma -d konma <<'SQL'
DELETE FROM "TaskReadinessEvent"
 WHERE task_id IN (SELECT id FROM "Task" WHERE title LIKE 'QA-03 mission smoke %');
UPDATE "ReadinessMeter" m
   SET task_value = sub.total, current_value = sub.total
  FROM (
    SELECT m2.id,
           COALESCE((SELECT SUM(e.value) FROM "TaskReadinessEvent" e
                      WHERE e.readiness_meter_id = m2.id AND e.revoked_at IS NULL), 0) AS total
      FROM "ReadinessMeter" m2 WHERE m2.mode = 'task_driven'
  ) sub
 WHERE m.id = sub.id;
SQL
```

The missions and tasks themselves are harmless clutter; each run makes its own,
titled `QA-03 smoke mission <id>` and `QA-03 mission smoke <id>`.

## CI

No new job and no change to `frontend-e2e`: `npm run test:e2e` already collects
every spec under `e2e/`, and the walk is untagged so the `mobile` project (which
greps `@mobile`) skips it. The *stranger* test runs there today and passes.

The mission flow itself will **skip** on CI until the job can tell it a password.
`seed:demo` prints the eight it generates, but that step's stdout is not captured
anywhere the suite can read. One line in the `Seed demo data` step closes it — tee
the output and hand the pairs to the suite as `E2E_STAFF_PASSWORDS` — but that is
a change to `.github/workflows/ci.yml`, which this spec deliberately does not
make. Until then CI proves the shell is closed to strangers, and a developer
machine proves the rest.
