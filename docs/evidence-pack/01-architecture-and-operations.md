> 🏗️ **As-Built Technical Evidence Pack — Part 1: Architecture & Operations**
> **Snapshot:** commit `2cab09e`, annotated tag `as-built-2026-09-03` (tag object `e96434a`), branch `v2-os-marketplace`. **Date:** 2026-09-03.
> Every claim below is traceable to a file in that commit, cited as `path:line`. Where the runtime truth lives in a vendor dashboard rather than in the repository, that is stated explicitly rather than inferred. Absences — no APM, no error tracker, no DR runbook — are recorded as findings, not omitted.

---

## 1. System overview

### 1.1 The two-app split

The repository is **not** a monorepo — there is no root `package.json`, no workspace manifest and no Turborepo/Nx configuration. It contains two independently installed, independently built, independently deployed Node applications:

| App | Path | Framework | Entrypoint | Build |
|---|---|---|---|---|
| Backend API | `backend/` | NestJS 11 (Express platform) | `backend/src/main.ts` | `nest build` → `dist/src/main.js` (`backend/package.json:12`) |
| Frontend web | `frontend/` | Next.js 16 (App Router) | `frontend/app/` + `frontend/proxy.ts` | `next build` (`frontend/package.json:11`) |

Both declare `"engines": { "node": ">=22" }` (`backend/package.json:8-10`, `frontend/package.json:5-7`). They share no code and no lockfile; the only contract between them is the HTTP API base URL (`NEXT_PUBLIC_API_URL`) and a shared `JWT_SECRET` used by `frontend/proxy.ts:4` to verify the `access_token` cookie the backend issues. The separation is a recorded constraint: *"No Python, no Supabase, no monorepo tooling, no Prisma 7"* (`SPEC.md:33`).

### 1.2 The socio-technical premise, in three sentences

Konma Xperience OS runs a single physical node — a 4,000 sq ft villa where **Konma Food** designs and standardises (R&D → recipe → SOP) and **Just Craves** executes and sells (kitchen → service → channels → shipped products → experiences) (`SPEC.md:11`). The **mission loop** is the system's reason to exist: *what must I move today → I do the real work → the work itself becomes the proof → someone with skin in the game signs it off → a meter I care about moves* — step three is automatic, because operational events emit domain events that the `MissionBridge` turns into evidence and readiness signals without anybody re-typing them (`SPEC.md:11`, `SPEC.md:16`). The **marketplace** is the second half of the same system rather than a bolt-on: one catalog covering prepared food (local), packaged goods (shipped nationally), experiences (capacity bookings) and merchandise, sold through one cart and one checkout, so that what the node produces is sold by the same software that proves it was produced correctly (`SPEC.md:18`).

### 1.3 Tech stack — exact versions

**Backend** (`backend/package.json:32-101`; `^` ranges are reproduced verbatim as declared):

| Concern | Package | Declared version |
|---|---|---|
| Framework | `@nestjs/common` / `@nestjs/core` / `@nestjs/platform-express` | `^11.0.1` |
| Config + validation | `@nestjs/config` | `^4.0.3` |
| Scheduling | `@nestjs/schedule` | `^6.1.1` |
| In-process events | `@nestjs/event-emitter` | `^3.0.1` |
| Rate limiting | `@nestjs/throttler` | `^6.5.0` |
| Auth | `@nestjs/jwt` `^11.0.2`, `@nestjs/passport` `^11.0.5`, `passport` `^0.7.0`, `passport-jwt` `^4.0.1`, `bcrypt` `^6.0.0`, `jose` `^6.2.2` | — |
| ORM | `prisma` / `@prisma/client` | `^6.19.2` |
| Redis | `ioredis` | `^5.10.1` |
| Object storage | `@aws-sdk/client-s3` `^3.1013.0`, `@aws-sdk/s3-request-presigner` `^3.1013.0` | — |
| Payments | `razorpay` | `^2.9.6` |
| Realtime | `pusher` | `^5.3.3` |
| Email | `mailersend` | `^2.6.0` |
| Queue | `@upstash/qstash` | `^2.10.1` |
| AI | `@anthropic-ai/sdk` | `^0.120.0` |
| Security headers | `helmet` | `^8.1.0` |
| Validation | `class-validator` `^0.15.1`, `class-transformer` `^0.5.1`, `zod` `^4.4.3` | — |
| Sanitisation | `sanitize-html` | `^2.17.2` |
| Files / exports | `exceljs` `^4.4.0`, `@fast-csv/format` `^5.0.5`, `@fast-csv/parse` `^5.0.5`, `qrcode` `^1.5.4` | — |
| Language / tests | `typescript` `^5.7.3`, `jest` `^30.0.0`, `ts-jest` `^29.2.5`, `supertest` `^7.0.0` | — |

**Frontend** (`frontend/package.json:15-69`; note `next`, `react`, `react-dom` and `eslint-config-next` are **pinned exactly**, without a range):

| Concern | Package | Declared version |
|---|---|---|
| Framework | `next` | `16.2.0` (exact) |
| UI runtime | `react` / `react-dom` | `19.2.4` (exact) |
| Styling | `tailwindcss` `^4`, `@tailwindcss/postcss` `^4`, `@tailwindcss/typography` `^0.5.19`, `tw-animate-css` `^1.4.0` | — |
| Component primitives | `@base-ui/react` `^1.3.0`; `shadcn` CLI `^4.0.8` (dev) | — |
| Server state | `@tanstack/react-query` | `^5.91.2` |
| Client state | `zustand` | `^5.0.12` |
| Realtime | `pusher-js` | `^8.4.3` |
| Forms | `react-hook-form` `^7.71.2`, `@hookform/resolvers` `^5.2.2`, `zod` `^4.3.6` | — |
| Editor | `@tiptap/react` + extensions | `^3.20.4` |
| Charts | `recharts` | `^3.8.0` |
| Motion | `motion` `^12.38.0`, `lenis` `^1.3.19`, `canvas-confetti` `^1.9.4` | — |
| Icons | `lucide-react` | `^0.577.0` |
| Drag & drop | `@dnd-kit/core` `^6.3.1`, `@dnd-kit/sortable` `^10.0.0` | — |
| Maps | `@react-google-maps/api` | `^2.20.8` |
| JWT (edge) | `jose` | `^6.2.2` |
| Sanitisation | `isomorphic-dompurify` | `^3.6.0` |
| E2E | `@playwright/test` | `^1.62.1` |
| Language | `typescript` `^5`, `eslint-config-next` `16.2.0` (exact) | — |

One dependency override is pinned: `"overrides": { "jsdom": "25.0.1" }` (`frontend/package.json:54-56`).

---

## 2. Deployment architecture

### 2.1 Production topology as of 2026-09

The topology below is recorded in `docs/walkthroughs/08-tech-lead.md:343-359` (*"The production topology, as of the 2026-08-30 go-live"*) and corroborated by the build/run configuration in the repository.

| Piece | Provider | Address | Repository evidence |
|---|---|---|---|
| Frontend | Vercel, project `konmaxperience` | `https://www.konma.store` (canonical); apex `konma.store` 308-redirects to `www` | `.vercel/project.json` (`projectName: konmaxperience`), `frontend/vercel.json`, `docs/walkthroughs/08-tech-lead.md:351` |
| Backend API | Railway, project `konmaxperience`, service `api` + Redis addon, builder **Railpack** | `https://api.konma.store` | `docs/walkthroughs/08-tech-lead.md:352`, `backend/package.json:14-15` |
| Database | Aiven **PostgreSQL 18**, database `defaultdb`, `sslmode=require` | — | `docs/walkthroughs/08-tech-lead.md:353`; `backend/prisma/schema.prisma:1-5` |
| Object storage | Cloudflare R2 | presigned PUT + public CDN GET | `backend/src/storage/storage.service.ts`, `docs/R2-LIFECYCLE.md` |
| Redis | Upstash / Railway Redis addon over `rediss://` | — | `backend/src/customer-auth/redis.service.ts:11-33` |
| DNS registrar | GoDaddy — `CNAME api → ec5b8mmz.up.railway.app` plus a Railway TXT verification record | — | Not in the repository; see §2.4 |

**Backend start sequence (verified in the repository, not inferred):**

```
prestart : prisma migrate deploy                                  backend/package.json:14
start    : node --max-old-space-size=384 dist/src/main.js          backend/package.json:15
```

Railpack **ignores `railway.toml`** and always invokes `npm run start`, which is why the 384 MB heap cap and the migration hook live in `package.json` rather than in a Railway config file — and why **deploys are self-migrating** (`docs/walkthroughs/08-tech-lead.md:358`). The ignored `railway.toml` was deleted in commit `e032a4e`. A second operational note is recorded at `docs/walkthroughs/08-tech-lead.md:359`: **`NODE_OPTIONS` must never be set as a Railway service variable**, because it poisons the build's TypeScript compile.

Note that `backend/package.json:18` still defines `start:prod` as `node dist/src/main.js` (no heap cap, no migration). It is **not** what production runs; `CLOUDFLARE-SETUP.md:290` instructs the operator to set `start:prod` as the Railway start command, which is stale — see §2.4.

**Server hardening applied at boot** (`backend/src/main.ts`):
- `trust proxy = 1` so `req.ip` resolves the real client rather than the edge (`main.ts:24-25`).
- Body limits of `1mb` on JSON and urlencoded; the raw body is preserved **only** for `/webhooks/razorpay` (`main.ts:29-34`).
- `helmet` with an explicit CSP, `crossOriginEmbedderPolicy: false` (to allow R2 images) and one-year HSTS with `includeSubDomains` (`main.ts:37-53`).
- CORS restricted to `FRONTEND_URL` plus its `www.` sibling, `credentials: true`, methods limited to `GET/POST/PATCH/DELETE` (`main.ts:59-78`).
- Global exception filter, Decimal-serialisation interceptor and a whitelisting `ValidationPipe` with `forbidNonWhitelisted: true` (`main.ts:116-128`).
- Shutdown hooks enabled; listener bound to `0.0.0.0:${PORT ?? 4000}` with `keepAliveTimeout 65s`, `headersTimeout 66s`, `requestTimeout 30s` as slowloris protection (`main.ts:131-139`).
- Rate limiting is four named throttlers — `default` 100/60s, `short` 20/1s, `medium` 20/10s, `long` 100/60s (`backend/src/config/throttler.config.ts:8-13`), bound globally via `UserAwareThrottlerGuard`.

**Frontend edge behaviour** is `frontend/proxy.ts` (the Next.js 16 successor to `middleware.ts`), which verifies the `access_token` cookie with `jose` against `JWT_SECRET` (`proxy.ts:4`, `:80`, `:114`) and routes unauthenticated staff traffic to `/team`. Security headers are set by Vercel rather than by Next: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` on `/(.*)` (`frontend/vercel.json:4-13`).

### 2.2 Request flow

1. A browser resolves `www.konma.store` (or `konma.store`, which Vercel answers with a **308** to `www`) through **GoDaddy DNS** to Vercel's edge.
2. Vercel serves the Next.js 16 App Router build. `frontend/vercel.json:4-13` attaches the three security headers to every response.
3. For any path not excluded by the matcher at `frontend/proxy.ts:160-164`, `proxy()` runs first: `/` and the `PUBLIC_PATHS` list (`proxy.ts:21-35`) pass through; a staff path with no `access_token` cookie is redirected to `/team?redirect=…` (`proxy.ts:107-111`); a customer token on a staff path is redirected to `/account` (`proxy.ts:118`). Note the documented ordering — headers → redirects → proxy → rewrites → filesystem (`frontend/next.config.ts:42-49`) — which is why the four 308 redirects at `next.config.ts:61-73` fire before `proxy.ts` ever sees `/menu`, `/events` or `/profile`.
4. Server components and client components alike call the API at `process.env.NEXT_PUBLIC_API_URL` (16 read sites; canonical wrapper at `frontend/lib/api-client.ts:1`), i.e. `https://api.konma.store`.
5. `api.konma.store` resolves via a GoDaddy `CNAME` to `ec5b8mmz.up.railway.app` and terminates at Railway's edge, which forwards to the `api` service.
6. Express applies, in order: body limits → helmet → cookie parser → CORS → the in-memory abuse counter (`main.ts:85-113`) → throttler guard → `JwtAuthGuard` → `PermissionsGuard` → `ValidationPipe` → the controller.
7. Handlers read and write **Aiven PostgreSQL** through `PrismaService`, which connects with three retries and exponential backoff (`backend/src/prisma/prisma.service.ts:44-60`), and touch **Redis** for carts, quotes, OTPs, webhook dedup, the catalog cache and the Shiprocket token.
8. Side-effects leave the process to **Razorpay** (order create, refund), **Shiprocket** (courier, when enabled), **Cloudflare R2** (presign / direct PUT), **MailerSend** (email), **Pusher** (realtime push), **Upstash QStash** (notification queue) and optionally the **Anthropic API**.
9. Inbound callbacks arrive at three public routes: `POST /webhooks/razorpay` (HMAC over the preserved raw body), `POST /webhooks/shiprocket` (constant-time shared-secret header), and `POST /notifications/qstash-webhook` (QStash `Receiver` signature).
10. Realtime updates return to the browser over Pusher `private-*` channels; every consumer degrades to a ≥30 s poll when the socket is down.
11. `GET /` on the API returns `{ status: 'ok', timestamp }`, `@Public()` and exempt from all four throttlers (`backend/src/app.controller.ts:6-13`).

### 2.3 The Vercel root-directory question

Two repository facts have to be reconciled, and they do reconcile:

- `.vercel/project.json` sits at the **repository root**, and `.vercelignore` (added in commit `935cdd3`, "vercelignore for root-linked Vercel deploys") excludes `backend/`, `.claude/`, `.planning/`, `docs/` and `.git/`. Both indicate the `vercel` CLI is linked and invoked **at the repo root**. `docs/walkthroughs/08-tech-lead.md:351` says the same in prose: *"Deployed from the repo root, not `frontend/`."*
- There is **no `package.json` at the repository root**, so a Vercel build whose Root Directory were the repo root could not detect or build a Next.js app. `frontend/vercel.json` (`"framework": "nextjs"`) is honoured, which only happens when the build's Root Directory is `frontend`.

The consistent reading — and the one the evidence supports — is that the **CLI link and upload happen at the repo root while the Vercel project's Root Directory setting is `frontend`**. The Root Directory value itself lives in the Vercel dashboard and is not present in this repository; it cannot be verified from the snapshot.

### 2.4 Cloudflare is documented but NOT active — the delta

`CLOUDFLARE-SETUP.md` (441 committed lines) describes an architecture in which **all traffic routes through Cloudflare first** (`CLOUDFLARE-SETUP.md:14`), with nameservers delegated from GoDaddy to Cloudflare (`:48-71`), the `api` subdomain proxied orange-cloud (`:81`), Full (Strict) SSL (`:99`), Bot Fight Mode (`:127`), five WAF custom rules (`:131-186`) and three page rules (`:206-228`). **None of that is the production configuration.** DNS is served by **GoDaddy**, with a `CNAME api → ec5b8mmz.up.railway.app` and a Railway TXT verification record; there is no Cloudflare zone in front of either host.

> ⚠️ **`CLOUDFLARE-SETUP.md` is stale in six material ways and should be read as a historical plan, not as a description of the runtime.**
>
> | Claim in the document | Actual as-built |
> |---|---|
> | *"All traffic routes through Cloudflare first"* (`:14`), nameservers moved to Cloudflare (`:48-71`) | **Cloudflare is not in the path.** DNS is GoDaddy. No DDoS mitigation, no WAF, no Bot Fight Mode, no edge caching, no "Under Attack Mode" is in effect. The five WAF rules (`:135-186`) and three page rules (`:208-228`) **do not exist**. |
> | *"db: Neon PostgreSQL"* (`:9`, `:299`) | **Aiven PostgreSQL 18**, database `defaultdb` (`docs/walkthroughs/08-tech-lead.md:353`). Neon is referenced throughout `backend/.env.example:3,8` and `SPEC.md:33` as well — all stale. |
> | *"Start Command: `npm run start:prod`"* (`:290`) | Railpack ignores the setting and runs **`npm start`** → `node --max-old-space-size=384 dist/src/main.js` with a `prisma migrate deploy` prestart (`backend/package.json:14-15`). |
> | *"Root Directory to `backend`"* / Watch Paths (`:283`, `:291`) | Not verifiable from the repo; the build/run contract is entirely in `backend/package.json`. |
> | *`npx prisma db push` + `npx prisma db seed`* for the first deploy (`:341-343`) | Production uses **`prisma migrate deploy`** (the prestart hook) against the five versioned migrations, plus `npm run seed:reference`. `db push` would bypass the migration history. |
> | *"`www.konma.store` should redirect to `konma.store`"* (`:269`, `:380`) | **The direction is reversed.** `www` is canonical and the apex 308s to it (`docs/walkthroughs/08-tech-lead.md:351`). |
>
> The Cloudflare-specific comment at `backend/src/main.ts:22-23` (*"Trust Cloudflare proxy … CF-Connecting-IP"*) is likewise vestigial. `trust proxy = 1` is still correct and still necessary — Railway's edge is the proxy being trusted — but the header named in the comment is not the one in play.

One consequence is worth stating plainly: **the security posture the setup document promises is not deployed.** The controls that do exist are all in-process — helmet headers (`main.ts:37-53`), four named throttlers (`throttler.config.ts:8-13`), 1 MB body caps (`main.ts:29-34`), connection timeouts (`main.ts:137-139`) and the abuse-log counter (`main.ts:85-113`) — plus Vercel's own edge for the frontend. There is no WAF, no bot management and no DDoS layer in front of `api.konma.store`.

---

## 3. Environment & service inventory

**No values appear anywhere in this section.** Every credential slot in `backend/.env.example` and `frontend/.env.example` ships blank or as a `<placeholder>`; the repository contains no secrets.

The contract is enforced at boot by `ConfigModule.forRoot({ isGlobal: true, validate })` (`backend/src/app.module.ts:96`) against the class in `backend/src/config/env.validation.ts`. Three gate predicates decide what is required:

| Predicate | Definition | Meaning |
|---|---|---|
| `inProduction` | `o.NODE_ENV === 'production'` — `env.validation.ts:11` | required on a production boot only |
| `qstashEnabled` | `!!o.QSTASH_TOKEN` — `env.validation.ts:12` | the three companions become required the moment the token is set |
| `whatsappConfigured` | `!!(o.WHATSAPP_TOKEN \|\| o.WHATSAPP_PHONE_ID)` — `env.validation.ts:13-14` | **either** one present makes **both** required; neither present is a supported production state |
| `shiprocketEnabled` | `o.NODE_ENV === 'production' && o.SHIPPING_PROVIDER === 'shiprocket'` — `env.validation.ts:20-21` | courier credentials required only when the env var names the courier |

### 3.1 Backend — validated at boot

| Variable | Required when | Consumed by | Value lives in |
|---|---|---|---|
| `NODE_ENV` | optional (`env.validation.ts:28`) | `main.ts:17,62`; `auth.controller.ts:60,70,99,109`; `notifications.controller.ts:77` | Railway service vars |
| `DATABASE_URL` | **always** (`:31`) | `prisma/schema.prisma:3` (pooled app queries) | Railway service vars / local `backend/.env` |
| `JWT_SECRET` | **always**, min 32 chars (`:32`) | `auth.module.ts:18`, `jwt.strategy.ts:31`, `customer-auth.module.ts:18`; **and** `frontend/proxy.ts:4` | Railway service vars **and** Vercel env (must match) |
| `DIRECT_DATABASE_URL` | production (`:35`) | `prisma/schema.prisma:4` (`directUrl`, used by migrations) | Railway service vars |
| `JWT_REFRESH_SECRET` | production, min 32 (`:36`) | `auth/refresh-secret.ts:13-19` — in non-production it derives from `JWT_SECRET` with a logged warning; in production its absence throws (`:16`) | Railway service vars |
| `FRONTEND_URL` | production (`:37`) | CORS allow-list `main.ts:60-71`; email links `email.service.ts:19`; `auth.controller.ts:20`; `orders.service.ts:679` | Railway service vars |
| `R2_ENDPOINT` | production (`:38`) | `storage.service.ts:48` → `r2.config.ts:9-18` | Railway service vars |
| `R2_ACCESS_KEY_ID` | production (`:39`) | `storage.service.ts:49` | Railway service vars |
| `R2_SECRET_ACCESS_KEY` | production (`:40`) | `storage.service.ts:50` | Railway service vars |
| `R2_BUCKET_NAME` | production (`:41`) | `storage.service.ts:52` | Railway service vars |
| `R2_PUBLIC_URL` | production (`:42`) | `storage.service.ts:53,89-91` (public CDN reads) | Railway service vars; mirrored to Vercel as `NEXT_PUBLIC_R2_PUBLIC_URL` |
| `UPSTASH_REDIS_URL` | production (`:43`) | `customer-auth/redis.service.ts:11` — the single `ioredis` connection the app owns | Railway service vars |
| `RAZORPAY_KEY_ID` | production (`:44`) | `razorpay.service.ts:17`; echoed to the storefront at `customer-orders.service.ts:517` | Railway service vars |
| `RAZORPAY_KEY_SECRET` | production (`:45`) | `razorpay.service.ts:18`; payment-signature HMAC `:48-60` | Railway service vars |
| `RAZORPAY_WEBHOOK_SECRET` | production (`:46`) | `razorpay.service.ts:19`; webhook HMAC `:62-70` — a **different** secret from the key secret | Railway service vars |
| `WHATSAPP_TOKEN` | **pair-gated** (`:54`) | `customer-auth/whatsapp.service.ts:11` | Railway service vars — **currently unset** |
| `WHATSAPP_PHONE_ID` | **pair-gated** (`:55`) | `customer-auth/whatsapp.service.ts:12` | Railway service vars — **currently unset** |
| `QSTASH_TOKEN` | optional (`:58`) | `notifications/qstash.service.ts:18` | Railway service vars |
| `QSTASH_URL` | when `QSTASH_TOKEN` set (`:59`) | `qstash.service.ts:19`; callback target derived as `${QSTASH_URL}/notifications/qstash-webhook` (`:27`) | Railway service vars |
| `QSTASH_CURRENT_SIGNING_KEY` | when `QSTASH_TOKEN` set (`:60`) | `notifications.controller.ts:53` | Railway service vars |
| `QSTASH_NEXT_SIGNING_KEY` | when `QSTASH_TOKEN` set (`:61`) | `notifications.controller.ts:54` | Railway service vars |
| `SHIPPING_PROVIDER` | optional (`:64`) | **boot predicate only** (`:20-21`) — never read at runtime | Railway service vars |
| `SHIPROCKET_BASE_URL` | optional (`:66`) | `shiprocket.adapter.ts:77`; defaults to `shipping.constants.ts:3` | Railway service vars (sandbox override) |
| `SHIPROCKET_EMAIL` | production + provider=shiprocket (`:67`) | `shiprocket.adapter.ts:83` | Railway service vars |
| `SHIPROCKET_PASSWORD` | production + provider=shiprocket (`:68`) | `shiprocket.adapter.ts:84` | Railway service vars |
| `SHIPROCKET_PICKUP_LOCATION` | production + provider=shiprocket (`:69`) | **never read** — see §3.4 | Railway service vars |
| `SHIPROCKET_WEBHOOK_TOKEN` | production + provider=shiprocket, min 16 (`:70`) | `webhooks/shiprocket-webhook.service.ts:154` (constant-time compare) | Railway service vars; CI sets a literal |
| `ANTHROPIC_API_KEY` | **optional, deliberately** (`:81`, rationale `:72-80`) | `ai/anthropic.provider.ts:65` | Railway service vars |

### 3.2 Backend — consumed but NOT validated at boot

These appear in `backend/.env.example` and are read at runtime, but are absent from `EnvironmentVariables`, so a production boot succeeds without them.

| Variable | Consumed by | Behaviour when absent | Value lives in |
|---|---|---|---|
| `PORT` | `main.ts:133` | defaults to `4000` | Railway service vars (Railway injects it) |
| `MAILERSEND_API_KEY` | `email.service.ts:13` | defaults to `''`; the client is built anyway and sends fail at the API — **no config guard** | Railway service vars |
| `MAILERSEND_FROM_EMAIL` | `email.service.ts:16` | falls back to `noreply@konma.store` | Railway service vars |
| `EMAIL_DISABLED` | `email.service.ts:24` (`=== 'true'`) | all three send paths early-return with a log line (`:37`, `:80`, `:112`) | local `.env` only |
| `PUSHER_APP_ID` / `PUSHER_KEY` / `PUSHER_SECRET` / `PUSHER_CLUSTER` | `chat/pusher.service.ts:11-14` | `trigger()` becomes a silent no-op (`:33-45`); `authorizeChannel()` throws a raw `Error` → **500** (`:47-57`) | Railway service vars |
| `QSTASH_ALLOW_UNSIGNED` | `notifications.controller.ts:76` | only honoured when `NODE_ENV !== 'production'` (`:77`) — structurally impossible in production | local `.env` only |
| `DELIVERY_PINCODES` | `checkout/serviceability.service.ts:32` | fallback when `SystemSetting['delivery_pincodes']` is empty | Railway service vars |
| `PRISMA_LOG` | `prisma.service.ts:14,28` | query logging off | local `.env` only |
| `SEED_DEMO_FORCE` | `prisma/seed-utils.ts:11,17` | `seed:demo` refuses to run under `NODE_ENV=production` | CI job env only |

### 3.3 Frontend

| Variable | Required when | Consumed by | Value lives in |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | always in production | 16 read sites; canonical at `frontend/lib/api-client.ts:1`; also `lib/usage.ts:3`, `lib/pusher-client.ts:4`, `app/sitemap.ts:56`. Falls back to `http://localhost:4000` everywhere **except** `lib/customer-pusher-client.ts:13,18`, which has no fallback | Vercel env |
| `JWT_SECRET` | always (server-side) | `frontend/proxy.ts:4` → `jwtVerify` at `:80`, `:114`. Non-null-asserted: a missing value makes every staff route bounce to `/team` | Vercel env — **must equal the backend's** |
| `NEXT_PUBLIC_PUSHER_KEY` | when realtime is on | `lib/pusher-client.ts:30,41`; `lib/customer-pusher-client.ts:10` | Vercel env |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | when realtime is on | `lib/pusher-client.ts:30,42`; `lib/customer-pusher-client.ts:11` | Vercel env |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | fallback only | `hooks/use-razorpay.ts:86`; `components/storefront/checkout/PayButton.tsx:202` — the server-issued `order.key_id` is authoritative | Vercel env |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | address autocomplete | `components/public/GooglePlacesInput.tsx:27` | Vercel env |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | optional (build-time) | `frontend/next.config.ts:20` — its hostname is prepended to `images.remotePatterns`; falls back to `cdn.konma.store` and `**.r2.dev` (`next.config.ts:17`) | Vercel env |
| `NEXT_PUBLIC_SITE_URL` | optional | `lib/seo/metadata.ts:17`, feeding `absoluteUrl()` and `lib/seo/json-ld.ts:152,194` | Vercel env — **not documented in `frontend/.env.example`** |

Test-only variables (`E2E_*`, `PLAYWRIGHT_BASE_URL`, `E2E_BACKEND_LOG`, `E2E_STAFF_PASSWORDS`, …) are read exclusively under `frontend/e2e/` and `frontend/playwright.config.ts`; they are not part of the production runtime.

### 3.4 Findings from the inventory

> ⚠️ **Four env-contract defects, none blocking, all worth recording.**
>
> 1. **`JWT_ACCESS_EXPIRY` and `JWT_REFRESH_EXPIRY` are dead.** They are documented at `CLOUDFLARE-SETUP.md:303-304` and present in the local `backend/.env`, but nothing reads them. Token lifetimes are hardcoded: staff access `15m` (`auth.module.ts:19`, `auth.service.ts:37`), staff refresh `7d` (`auth.service.ts:45`), customer `30d` (`customer-auth.module.ts:19`, `customer-auth.service.ts:143`), R2 presign `900s` (`storage.service.ts:86`).
> 2. **`SHIPROCKET_PICKUP_LOCATION` is validated at boot but never read.** The effective pickup code comes from `SystemSetting['shipping'].pickup_location_code`, seeded to `''` (`settings.service.ts:28`). An empty code silently degrades the rate lookup to the customer's own pincode (`checkout.service.ts:170,320`), which Shiprocket rejects.
> 3. **The shipping env/setting split is a live trap.** Boot validation keys off `SHIPPING_PROVIDER` (`env.validation.ts:20-21`) while the runtime resolver reads `SystemSetting['shipping'].provider` on **every call** (`shipping-provider.resolver.ts:26-31`). Flipping the setting to `shiprocket` without also setting the env var produces a node that boots clean and then 503s on every courier call.
> 4. **`NEXT_PUBLIC_SITE_URL` is undocumented, and `metadataBase` ignores it.** `frontend/app/layout.tsx:22` hardcodes `new URL("https://konma.store")` — the apex — while the canonical host is `https://www.konma.store`. Sitemap, robots and JSON-LD default to the apex too (`lib/seo/metadata.ts:17`), so unless `NEXT_PUBLIC_SITE_URL` is set in Vercel, every canonical URL the site emits points at a host that immediately 308s.

---

## 4. Third-party services

### 4.1 Razorpay — payments (TEST mode)

`backend/src/razorpay/razorpay.service.ts`. Reads all three credentials in `onModuleInit` (`:17-19`). **Missing credentials do not block boot**: the service logs `[Razorpay] … payment service disabled` and returns without constructing the SDK client (`:21-24`); any later call hits `ensureInstance()` → `BadRequestException('Razorpay not configured')` (`:28-31`).

Order creation takes integer paise and a `notes: { type, entity_id }` routing tuple (`:33-46`), used from three surfaces: marketplace (`customer-orders.service.ts:492-496`), POS (`orders.service.ts:713-717`) and event bookings (`events.service.ts:411`). Two distinct HMACs are verified, both through the vendor SDK: the **payment** signature keyed on `RAZORPAY_KEY_SECRET` (`razorpay.service.ts:48-60`) and the **webhook** signature keyed on `RAZORPAY_WEBHOOK_SECRET` (`:62-70`).

`POST /webhooks/razorpay` (`webhooks.controller.ts:26-43`, `@Public()`, 200, 100/min) verifies the signature **before anything else** (`webhooks.service.ts:51-55`), then de-duplicates on Redis `SET webhook_processed:{eventId} NX EX 86400`. That dedup **fails closed**: with no Redis client the handler answers `ServiceUnavailableException('Webhook dedup unavailable — retry later')` (`webhooks.service.ts:59-64`). Events handled: `payment.captured` and `order.paid` (same branch, `:78`), `payment.failed` (logged only, so the customer can retry, `:105-110`), `refund.processed` (`:295-311`) and `refund.failed` (`:326-331`).

**Mode.** There is no live/test switch in the codebase — no `payment_capture` flag is passed anywhere, and no `rzp_test`/`rzp_live` branching exists. Mode is determined entirely by which key pair Railway injects. Three sites accept both `captured` **and** `authorized`, each carrying the same comment naming test mode: `orders.service.ts:757,761`, `events.service.ts:442,446`, `customer-orders.service.ts:613`. The operational record is explicit: *"Live keys have not been swapped in… There is deliberately no test-mode badge anywhere in the UI — the only signal is the key prefix"* (`docs/walkthroughs/08-tech-lead.md:394-403`).

> ⚠️ **An authorized-but-uncaptured payment is accepted as good and is never captured by any code path.** Under auto-capture this is a non-issue; under a manual-capture account it would leave money on a hold that nothing in this system releases.

### 4.2 Shiprocket — shipping port/adapter, `manual` by default

The port is `ShippingProviderPort` (`backend/src/shipping/shipping.types.ts:111-122`): seven total methods — `checkServiceability`, `createShipment`, `assignAwb`, `schedulePickup`, `getLabel`, `track`, `cancel` — plus a `name`. All money crossing the boundary is integer paise (`shipping.types.ts:14`); no Prisma types leak through it.

Two implementations. `ManualProvider` (`manual.provider.ts:31-81`) is a succeeding no-op on every method — `serviceable: true, rate: 0`, `track` → `ShipmentStatus.pending` — so staff paste AWBs by hand. `ShiprocketAdapter` (`shiprocket.adapter.ts`) talks to `https://apiv2.shiprocket.in/v1/external` (`shipping.constants.ts:3`), caches its auth token in Redis under `shiprocket:token` for **9 days** (`shipping.constants.ts:4-6`, tokens live 10) with an in-process `memoryToken` fallback (`:62,101,111`), re-authenticates **exactly once** on a 401 (`:151-180`), and times out at 15 s (`shipping.constants.ts:7`). Every transport failure, malformed body and non-ok status becomes a `ServiceUnavailableException`.

Selection is per-call and data-driven: `ShippingProviderResolver.get()` reads `SystemSetting['shipping'].provider` on every invocation and returns the Shiprocket adapter only when it equals `shiprocket` (`shipping-provider.resolver.ts:26-31`). **The seeded default is `manual`** (`settings.service.ts:26-31`). Switching couriers therefore needs no redeploy, and no jest run can reach the network.

`POST /webhooks/shiprocket` (`webhooks.controller.ts:60-69`) is authenticated by a **constant-time shared-secret header** `x-konma-webhook-token`, not a body HMAC (`shiprocket-webhook.service.ts:145-166`) — because `main.ts:29-33` preserves the raw body only for the Razorpay path. An unconfigured secret returns **403 by design** (`:155-157`). Everything non-authentication answers 200 (unknown AWB, illegal transition) because Shiprocket retries every non-2xx.

Note that `ShippingProviderPort.track()` is implemented by both providers but has **no application call site** — tracking arrives by webhook push, never by poll.

### 4.3 Cloudflare R2 — object storage

One `S3Client` with `region: 'auto'` against the R2 endpoint (`storage/r2.config.ts:9-18`). `StorageService` throws at construction if any of the four core `R2_*` vars is missing (`storage.service.ts:40-45`).

- **Writes are presigned PUTs**, 15-minute expiry (`storage.service.ts:76-87`), gated by a MIME whitelist of seven types (jpeg, png, webp, pdf, docx, mp4, webm — `:21-29`) and a 10 MB cap (`:31`). `putObjectDirect` (`:97-111`) is the server-initiated path and **bypasses both checks** by design.
- **Reads are public CDN GETs** — `getPublicUrl()` is a plain `${R2_PUBLIC_URL}/${key}` concatenation (`:89-91`). Product media are unsigned public objects, which is why `next/image` is allowed to cache them (`frontend/next.config.ts:3-16`).

### 4.4 MailerSend — transactional email

`backend/src/email/email.service.ts`. Sender defaults to `noreply@konma.store` with display name `Konma Xperience` (`:16-17`, `:39`). Three surfaces only: `sendPasswordSetup` (`:32-72`), the generic `sendHtml` used by the notification dispatcher (`:74-101`), and `sendPasswordReset` (`:107-147`). Bodies are HTML-escaped (`:28-30`, and again at `notification-dispatcher.service.ts:15-22`).

> ⚠️ **There is no configuration guard and no retry.** The `MailerSend` client is constructed unconditionally with an empty-string key when `MAILERSEND_API_KEY` is unset (`:13-14`). The two password paths catch and **swallow** failures (`:65-71`, `:140-146`); `sendHtml` rethrows (`:94-100`) but its only caller wraps it in `safely()` (`notification-dispatcher.service.ts:159-170`). **A failed email is lost silently** — no backoff, no queue, no dead-letter.

### 4.5 Pusher — realtime

Client at `backend/src/chat/pusher.service.ts:11-14`, `useTLS: true` hardcoded (`:29`). All channels are `private-*`; **there are no presence channels anywhere.**

| Channel | Purpose | Auth endpoint |
|---|---|---|
| `private-kds`, `private-pick-pack`, `private-shipments`, `private-approvals` | ops boards; closed vocabulary at `realtime/realtime.channels.ts:11-25`, each with **both** a permission and a `moduleKey` gate | `POST /realtime/auth` |
| `private-user-{userId}` | per-user notifications | `POST /realtime/auth` |
| `private-chat-{conversationId}` | staff chat | `POST /chat/auth` |
| `private-customer-{customerId}` | storefront order/shipment updates | `POST /customer-auth/pusher-auth` |

`/realtime/auth` (`realtime.controller.ts:14-22` → `realtime.service.ts:23-55`) is the strictest: own user-channel only, then a channel-vocabulary check, then the role permission, **then** a `ModuleAccess` check — *a role that cannot see the screen must not hold a socket for it* (`:46-51`). `/chat/auth` keeps a separate participant check (`chat.controller.ts:32-55`); `/customer-auth/pusher-auth` asserts exact channel-name equality (`customer-auth.controller.ts:87-101`).

Events published: `kds.order.new/updated`, `pickpack.order.new/updated`, `approvals.count.changed`, `notification.created` (`realtime.channels.ts:35-42`), plus customer-facing `order.placed`, `order.refunded`, `delivery.updated`, `shipment.updated`. Publish failures are isolated at `realtime.service.ts:57-64` — *"a dropped push degrades to the 30 s poll."*

> ⚠️ **Asymmetric degradation.** With Pusher unconfigured, `trigger()` is a silent no-op (`pusher.service.ts:33-45`) but `authorizeChannel()` throws a **raw `Error`** (`:47-57`), which surfaces as a 500 rather than a 503. None of the four `PUSHER_*` vars is in the boot validator.

### 4.6 Upstash QStash — notification queue

`QStashService` (`backend/src/notifications/qstash.service.ts`) publishes notification jobs as HTTP callbacks to its own backend, with `retries: 3` (`:43`). The callback target is derived, not configured: `${QSTASH_URL}/notifications/qstash-webhook` (`:27`).

**What it is used for:** decoupling notification fan-out from the request that triggered it. Seven job names are handled (`notifications.processor.ts:17-43`) — `notify-task-due`, `notify-task-blocked`, `notify-approval-pending`, `notify-low-stock`, `notify-new-order`, `notify-order-ready`, `notify-delivery-update`. The four **per-subject** jobs route through `NotificationDispatcher` (cooldown + email + WhatsApp); the three **per-event** jobs go straight to `notifications.create` (`:45-50`). Publishers are the hourly crons (`notifications.cron.ts:44,99`) and the domain-event listener (`notifications.listener.ts:16,28,42,54,66-71`).

**It never throws.** With no token or URL it warns *"notifications will process inline (no queue)"* and processes directly (`qstash.service.ts:20-25,55`); even a configured client falls back inline when `publishJSON` rejects (`:46-51`).

Inbound verification (`notifications.controller.ts:53-60,74-92`) builds an `@upstash/qstash` `Receiver` only when **both** signing keys are present. Missing signature → 401; failed verify → 401; no `Receiver` at all → 403, unless `QSTASH_ALLOW_UNSIGNED === 'true'` **and** `NODE_ENV !== 'production'` (`:76-77`) — so accepting unsigned callbacks in production is structurally impossible.

> ⚠️ **The QStash signature is verified against a re-serialised body.** `notifications.controller.ts:88` calls `receiver.verify({ signature, body: JSON.stringify(body) })` on the already-parsed DTO, because `main.ts:29-33` preserves `rawBody` only for `/webhooks/razorpay`. It works today because QStash echoes back exactly what `publishJSON` sent; it would break the moment any other publisher, or any key-ordering difference, entered the picture.

### 4.7 Anthropic — optional, heuristic by default

The port is `AiProviderPort` (`backend/src/ai/ai.types.ts:70-74`): `reviewEvidence` and `writeMorningBrief` only. The architectural boundary is enforced by a test — *"Nothing here can express a decision"* (`ai.types.ts:9-11`, asserted in `backend/src/ai/ai-boundaries.spec.ts`), consistent with the non-goal at `SPEC.md:29`.

`AiProviderResolver.get()` reads `SystemSetting['ai'].provider` per call and returns `AnthropicProvider` **iff** it is exactly `'anthropic'` (`ai-provider.resolver.ts:30-33`). The seeded default is `heuristic` with model `claude-opus-5` (`settings.service.ts:89-100`, mirrored at `ai.types.ts:102-114`). `HeuristicProvider` (`heuristic.provider.ts:21-70`) is deterministic — no network, no randomness, banded confidence that is *"never 0 and never 1"*.

`AnthropicProvider` builds a client only when `ANTHROPIC_API_KEY` is set (`anthropic.provider.ts:65`) and **degrades internally rather than throwing** for any integration reason: no key, a refusal `stop_reason`, a missing parsed output, or a `RateLimitError`/`APIConnectionError`/`APIError` all fall through to the heuristic (`:76,89-94,113,128-133,154-168`). Anything that is not an SDK error is rethrown as a bug. The consequence is that **no caller has an error path for "AI is down"** — which is why `evidence-assist.service.ts:127` has no try/catch. Both AI routes are throttled at 10/min because *"an unthrottled route that costs money per request is a defect"* (`evidence-assist.controller.ts:21-22`).

### 4.8 WhatsApp — configured off

The channel ships disabled pending Meta template approval; `SystemSetting['notifications'].whatsapp_enabled` seeds false and the dispatcher degrades to in-app/email (`env.validation.ts:47-53`). Staff nudges are unaffected. **Customer sign-in is not**: OTP over WhatsApp is the only delivery channel, and outside production the code prints `[DEV] OTP for {phone}: {code}` to the API log (`customer-auth.service.ts:149`) while in production the send is refused rather than logged (`docs/walkthroughs/08-tech-lead.md:382-392`).

---

## 5. Storage architecture

### 5.1 PostgreSQL — the system of record

Aiven PostgreSQL 18, database `defaultdb`, `sslmode=require`. `backend/prisma/schema.prisma:1-5` declares a pooled `url` (`DATABASE_URL`) and a `directUrl` (`DIRECT_DATABASE_URL`) — the latter is what `prisma migrate deploy` uses, bypassing the pooler.

Conventions from `SPEC.md:60`: every `DateTime` is `@db.Timestamptz(3)`; money is `Decimal @db.Decimal(12,2)`; quantities `Decimal @db.Decimal(14,4)`; every enum-like field is a Prisma enum; every aggregate carries `node_id`; **every mutating write in a transaction also writes an `AuditEvent`**. `PrismaService` connects with three retries and exponential backoff (`prisma/prisma.service.ts:44-60`).

> ⚠️ **The `connection_limit=8` pool cap is not verifiable from this snapshot.** It is a query parameter on the production `DATABASE_URL`, which lives only in Railway's service variables. The repository's committed example shows `connection_limit=5` against a (now stale) Neon URL — `backend/.env.example:3` — and the local dev `backend/.env` carries neither `connection_limit=8` nor an Aiven host. A reviewer must read the value from the Railway dashboard to confirm it.

### 5.2 Redis — what actually lives there

One `ioredis` connection for the whole application, owned by `RedisService` (`backend/src/customer-auth/redis.service.ts:5-48`) and exported from `CustomerAuthModule` so that `CatalogModule`, `CheckoutModule`, `CustomerOrdersModule`, `ShippingModule` and `WebhooksModule` all share it rather than opening their own (`catalog.module.ts:8-9`, `checkout.module.ts:18`). It is `lazyConnect`, retries three times, then **sets itself to `null` permanently** and logs *"App continues without OTP/dedup"* (`redis.service.ts:22-32`). Every consumer therefore has to handle `getClient() === null`.

| Key | Written by | TTL | Behaviour when Redis is down |
|---|---|---|---|
| `quote:{customerId}:{quoteId}` | `checkout.service.ts:114-116` | **900 s / 15 min** — `QUOTE_TTL_SECONDS` at `checkout.service.ts:99-100`, the quote TTL *and* the booking-hold window | **Fails closed** — `requireRedis()` throws `ServiceUnavailableException('Checkout is temporarily unavailable…')` (`checkout.service.ts:483-491`) |
| `pending_order:{razorpay_order_id}` | `customer-orders.service.ts:505`, read at `:576` | set alongside the Razorpay order | **Fails closed** — same reasoning: *"pretending otherwise would strand the customer between a Razorpay charge and an order that never existed"* (`checkout.service.ts:477-482`) |
| `cart:{customerId}` | `customer-orders.service.ts:228-265` | **604800 s / 7 days** (`CART_TTL`, `:109`) | Degrades — `getCart` returns `null`, `setCart` silently no-ops (`:233-234`, `:249-250`) |
| `otp:{phone}` | `customer-auth.service.ts:67` | **300 s / 5 min** | Endpoint answers *"OTP service unavailable"* |
| `webhook_processed:{eventId}` | `webhooks.service.ts:59-64` | 86400 s / 24 h, `SET … NX EX` | **Fails closed** — 503 |
| `catalog:*` | `catalog-cache.service.ts:81-86` | **60 s** (`CATALOG_CACHE_TTL_SECONDS`, `:6`) | Degrades to "always miss"; *"a cache outage may never turn a 200 into a 500"* (`:45-52`) |
| `shiprocket:token` | `shiprocket.adapter.ts:102-104` | **9 days** (`shipping.constants.ts:6`) | Falls back to an in-process `memoryToken` (`:111`) |

The stored quote is a versioned, fully-frozen artefact (`checkout/quote.types.ts:115-139`): `v: 2`, integer-paise lines, holds, coupon, shipping decision, tax breakup and loyalty, so *"nothing downstream recomputes any of it"* — the confirm transaction replays the frozen numbers, which is the entire defence against price drift between the total a customer sees and the total they pay (`checkout.service.ts:83-96`). `PendingOrderV2` (`quote.types.ts:141-149`) is that same shape plus the Razorpay order id and an idempotency key.

### 5.3 Cloudflare R2 — buckets and prefixes

One bucket, six key prefixes:

| Prefix | Written by | Lifecycled? | Swept? |
|---|---|---|---|
| `evidence/{taskId}/{ts}-{file}` | `storage.service.ts:70-74` | **Never** — it is the proof behind an approval (`docs/R2-LIFECYCLE.md:50-53`) | Yes |
| `exports/{reportType}/{YYYYMMDD}/…` | `exports.service.ts:167` | `expire-exports-30d`, 30 days (`docs/R2-LIFECYCLE.md:19-40`) | Yes |
| `product-media/{productId}/{ts}-{file}` | `storage.controller.ts:97` | **Never** — referenced by a live storefront (`R2-LIFECYCLE.md:54-55`) | Yes |
| `assets/{ts}-{file}` | `storage.controller.ts:71` | Never | No |
| `guide/{ts}-{file}` | `storage.controller.ts:81` | Never | No |
| `chat/{ts}-{file}` | `storage.controller.ts:107` | Never | No |

Two mechanisms remove objects, and they do not overlap (`docs/R2-LIFECYCLE.md:8-16`):

1. **The `expire-exports-30d` object lifecycle rule** on `exports/`. There is **no API call in the repository that sets this rule** — it is configured by hand in the Cloudflare dashboard, and it is the only manual step in RUN-06 (`docs/R2-LIFECYCLE.md:26-40`). The `ExportRecord` row survives the object: a link older than 30 days 404s and regenerating writes a fresh object (`:42-46`).
2. **`OrphanSweepCron`** — `@Cron('0 4 * * 0', { timeZone: DEFAULT_NODE_TIMEZONE })` (`backend/src/storage/orphan-sweep.cron.ts:110`), i.e. **Sunday 04:00 IST**, an hour after the notifications cleanup so the two weeklies never overlap. It runs under `ADVISORY_LOCK.R2_ORPHAN_SWEEP` so N instances run it once between them. It lists `SWEPT_PREFIXES = ['evidence/', 'exports/', 'product-media/']` (`orphan-sweep.cron.ts:21-25`), loads every referenced key **after** the listing, **skips anything modified in the last 48 h** (`UPLOAD_GRACE_MS`, `:36`) because a presigned PUT completes before its row is written, deletes the remainder in batches of 1000 (`storage.service.ts:13,156-177`), and writes one `AuditEvent(entity_type: 'storage', action: 'storage.orphan_swept')` per prefix carrying the count and first ten keys.

> ⚠️ **The `expire-exports-30d` lifecycle rule has NOT yet been created.** It is a documented manual step that nothing in the codebase performs or verifies. Until an operator adds it in the Cloudflare dashboard, `exports/` grows without bound except for whatever the weekly orphan sweep removes — and the sweep only removes objects that **no database row points at**, whereas every export *does* have an `ExportRecord` row. In practice this means **no export object is currently being deleted by anything.**
>
> A second, softer gap: the orphan sweep has a dry-run mode gated on `SystemSetting['maintenance_mode']`, and `docs/R2-LIFECYCLE.md:87-94` instructs that **at least one production pass be observed in maintenance mode before it is allowed to delete for real**. Whether that observation has happened is not recorded anywhere in the repository.

### 5.4 Browser localStorage — the cart

`frontend/lib/stores/cart-store.ts` is a zustand `persist` store on `localStorage`:

- Key **`cart-storage`** (`cart-store.ts:41`, applied `:265`), version **`3`** (`:44`, applied `:269`).
- Persisted shape is exactly `PersistedCart` (`:64-68`): `{ items: CartLine[]; channel; deliveryAddressId }` via `partialize` (`:280-284`).
- **`totals`, `syncedAt` and `repriced` are deliberately not persisted** (`:29-31`, forced back to null at `:305-308`) — a stale server price restored a day later is worse than none. The server re-prices every cart on read (`customer-orders.service.ts:267-281`).
- `migrate: () => emptyCart()` (`:270`) — v1 and v2 carts are **dropped**, not salvaged, because v2 carried no variant information. A belt-and-braces `merge` (`:290-310`) also drops any row lacking an explicit `variantId`.
- The line-identity key `` `${productId}:${variantId ?? ''}` `` (`:11-14`) is byte-identical to the backend's `assertQuoteStillValid` key (`customer-orders.service.ts:527`).

Two other browser stores exist: `auth-storage` on **`sessionStorage`** (`frontend/lib/stores/auth-store.ts:67,70` — no version, no migrate) and `konma-spine-collapsed` on `localStorage` (`frontend/components/ops/nav/SpineNav.tsx:55`).

---

## 6. Logging & monitoring

### 6.1 What exists

| Capability | Implementation | Evidence |
|---|---|---|
| Application logging | Nest `Logger` to **stdout**, captured by Railway's log stream. Production level is `['error','warn','log']`; development adds `debug` and `verbose` | `backend/src/main.ts:16-20` |
| Log discipline enforced in CI | The backend job fails if any `*.service.ts` contains `console.` — `! grep -rn "console\." src --include=*.service.ts` | `.github/workflows/ci.yml:34-35` |
| Unhandled-error capture | `GlobalExceptionFilter` logs the full stack server-side and returns a generic 500 body, so stack traces, schema and paths never reach a client | `backend/src/common/filters/global-exception.filter.ts:31-40` |
| Abuse detection | An in-process `Map` counts requests per IP over a rolling 5-minute window and emits `[ABUSE] IP {ip} hit 500 requests in 5 minutes` at exactly the 500th request; entries are pruned when the map exceeds 10,000 | `backend/src/main.ts:80-113` |
| Domain audit trail | `AuditEvent` — `{node_id, entity_type, entity_id, action, actor_type, actor_id, before, after, created_at}`, indexed on `(entity_type, entity_id, created_at)` and `(node_id, created_at desc)`. Written **inside the caller's transaction** so it rolls back with the change it describes | `backend/prisma/schema.prisma:481-496`; `backend/src/audit/audit.service.ts:29-45`; contract at `SPEC.md:60` |
| Audit read API | `GET /audit?entity_type=&entity_id=` | `backend/src/audit/audit.controller.ts`; `SPEC.md:276` |
| Product analytics | `UsageEvent` — page views and dotted action keys per role, indexed four ways. *"Writes are fire-and-forget and are never part of a business transaction"* | `backend/prisma/schema.prisma:965-987` |
| Analytics ingest | `POST /usage` — authenticated but permission-free (every staff role logs its own views), returns **202 without awaiting the write** so navigation is never blocked by observability | `backend/src/usage/usage.controller.ts:35-42` |
| Analytics roll-up | `GET /usage/summary` behind `MANAGE_SYSTEM`, surfaced at `/admin/usage` (who was active, busiest screens, events by role) | `backend/src/usage/usage.controller.ts:50-63`; `frontend/app/(ops)/admin/usage`; walkthrough at `docs/walkthroughs/08-tech-lead.md:420-427` |
| Liveness | `GET /` returns `{status:'ok', timestamp}`, `@Public()` and exempt from all four throttlers | `backend/src/app.controller.ts:6-13` |
| Cron observability | Every scheduled job takes a Postgres advisory lock and swallows its own errors, because an unhandled rejection out of a `@Cron` method would take the API down | `backend/src/notifications/staff-nudge.cron.ts:82-84,103-115`; `docs/walkthroughs/08-tech-lead.md:363` |

### 6.2 What does NOT exist

> ⚠️ **Every item below is confirmed absent from the snapshot, not merely unlocated.** A repository-wide search for `sentry`, `opentelemetry`, `datadog`, `newrelic`, `@nestjs/terminus` and `prom-client` returns no application source hits in either `backend/src/` or `frontend/app|components|lib`.
>
> - **No APM.** No tracing, no span instrumentation, no latency percentiles, no dependency map. There is no way to answer "which endpoint got slow last Tuesday" beyond reading Railway's raw log stream.
> - **No error tracker.** Sentry is not installed. The frontend's `frontend/lib/report-error.ts:1` is an explicit placeholder — *"Single place to forward runtime errors. Sentry lands here in a later phase"* — whose entire body is `console.error`. Backend unhandled errors are logged to stdout by `GlobalExceptionFilter` and nowhere else. **Nobody is notified when a 500 happens.**
> - **No alerting.** No PagerDuty, Opsgenie, Slack webhook or email alert exists for any condition. The `[ABUSE]` line at `main.ts:101` is written to stdout and read by nobody unless a human is watching the log stream.
> - **No uptime monitor.** `GET /` is a perfectly good health endpoint, but nothing polls it. There is no external check, no synthetic transaction, no status page.
> - **No log aggregation or retention beyond the platform default.** Logs exist only for as long as Railway (backend) and Vercel (frontend) retain them. That retention window is a platform setting, not a repository fact, and is not recorded anywhere here.
> - **No metrics endpoint.** No `/metrics`, no Prometheus exposition, no counters or histograms.
> - **The abuse counter is per-process and non-durable.** `main.ts:81` is a plain in-memory `Map`. It resets on every deploy and restart, it is not shared between instances, and it produces a log line rather than an action — nothing is blocked, throttled harder, or reported.
>
> The practical position: **the system has an excellent *domain* audit trail and no *operational* observability at all.** `AuditEvent` will tell a reviewer precisely who approved what and when; nothing will tell them the API was down for twenty minutes.

---

## 7. Backup & recovery

### 7.1 What is and is not verifiable

> ⚠️ **There is no backup, restore or disaster-recovery documentation anywhere in this repository.** A search across every `*.md` for `backup`, `restore`, `disaster`, `recovery`, `RPO`, `RTO` and `pg_dump` returns no operational document — only GSD workflow templates and one historical note about migration-drift recovery (`.planning/STATE.md:295`). The recovery path below is **reconstructed from the build tooling**, not transcribed from a runbook that exists.

**Aiven PostgreSQL.** The plan is Aiven's free tier. What the repository can establish is that the database is Aiven PostgreSQL 18 with `sslmode=require` and that migrations are applied on deploy (`docs/walkthroughs/08-tech-lead.md:353`). **Everything else about the backup posture must be read from the Aiven console** — whether automated backups are enabled at all on this plan tier, the backup frequency, the retention window, whether point-in-time recovery is available, and where backups are stored. No retention number is asserted here because none can be verified from the snapshot, and inventing one would be worse than the gap.

**Action for the reviewer:** open Aiven console → the `defaultdb` service → Backups, and record (a) whether backups exist, (b) their frequency, (c) their retention, (d) whether PITR is offered on this tier. Free-tier Aiven services are materially more limited than paid ones; this must be confirmed, not assumed.

### 7.2 The migration-replay path

The schema is fully reproducible from the repository. Five versioned migrations exist in `backend/prisma/migrations/`, in directory order:

```
20260823120000_p2_platform_foundation
20260823180000_p3_mission_bridge
20260826000000_p4_role_aware_ia
20260826120000_p5a_marketplace_backend
20260828000000_p6_run_it_layer
```

`npx prisma migrate deploy` against a clean database applies all five (`backend/package.json:14` runs exactly this as the `prestart` hook, so **every Railway deploy is self-migrating**). The v2.0 baseline was generated `--from-empty` after a deliberate one-time schema reset, so there is no v1 history to replay and no backfill migration is required (`SPEC.md:34`; rationale at `docs/superpowers/plans/2026-08-23-p2-platform-foundation.md:2815`).

### 7.3 The seeds

| Seed | Command | Behaviour |
|---|---|---|
| Reference | `npm run seed:reference` → `prisma/seed-reference.ts` | **Idempotent and production-safe.** *"Every write is an upsert or a find-then-update; nothing is ever deleted, and no user accounts or passwords are created here"* (`seed-reference.ts:30-33`). Seeds the single `Node`, roles and permissions, readiness meters, zones, brands, channels, unit conversions, ingredient categories, `ModuleAccess`, approval policies, the system actor, the fourteen `SystemSetting` keys and the guide content (`seed-reference.ts:2-19`). |
| Demo | `npm run seed:demo` → `prisma/seed-demo.ts` | **Refuses to run when `NODE_ENV=production`** unless `SEED_DEMO_FORCE=true` (`seed-utils.ts:11,17`). Creates staff users with random bcrypt-12 passwords printed exactly once and never stored in plaintext (`seed-demo.ts:26-35`), plus the demo catalog, coupons and demo customer. |

A sanitized data snapshot of the local demo database also ships in this evidence pack at `docs/evidence-pack/sample-data.sql` (data only; the schema comes from the migrations).

### 7.4 What has NO backup

| Asset | Backup status | Assessment |
|---|---|---|
| Redis — quotes, carts, OTPs, pending orders, webhook-dedup keys, catalog cache, Shiprocket token | **None. By design.** Everything in Redis carries a TTL between 60 s and 9 days | Correct. A quote is deliberately ephemeral, and the checkout path fails closed rather than proceeding without it (`checkout.service.ts:477-491`). **The one real exposure is `pending_order:{razorpay_order_id}`**: if Redis is lost between the Razorpay order being created and the payment being confirmed, that order's frozen pricing is gone. The webhook path re-checks the amount against the pending record and restores the key on mismatch (`webhooks.service.ts:196-203`), but a vanished record cannot be reconstructed. |
| Cloudflare R2 — `evidence/`, `product-media/`, `assets/`, `guide/`, `chat/` | **No backup, no replication, no versioning configured or documented** | **This is the most serious gap in this section.** `evidence/` is the proof behind every approval — `docs/R2-LIFECYCLE.md:50-53` argues at length that these objects must never expire, yet nothing copies them anywhere. A bucket-level accident is unrecoverable, and the orphan sweep deletes for real once maintenance mode is off. |
| R2 `exports/` | No backup — but every export is *"reproducible on demand from the same data"* (`docs/R2-LIFECYCLE.md:22-24`) | Acceptable. |
| Vercel / Railway configuration and env vars | Not in the repository; no export or IaC | A full account loss would require re-entering every service variable by hand from the secrets file. |
| Browser `localStorage` cart | None; the store is per-device and re-priced server-side on every read | Acceptable by design. |

### 7.5 Recovery-order runbook

This is the order the dependencies actually impose. It has not been rehearsed.

1. **Database first.** Restore the Aiven `defaultdb` service from a backup (frequency and retention to be confirmed per §7.1). If no restorable backup exists, provision a clean PostgreSQL 18 database instead and continue at step 2 — the schema is fully reproducible, the *data* is not.
2. **Environment second.** Re-populate Railway service variables (§3.1, §3.2) and Vercel environment variables (§3.3) from the secrets store. `DATABASE_URL` and `DIRECT_DATABASE_URL` must point at the restored instance. **`JWT_SECRET` must be identical on both platforms** or every staff session breaks at `frontend/proxy.ts:80`. Note that `env.validation.ts` will refuse to boot the API if any production-required variable is missing — this is a feature, and the boot log names the offender (`env.validation.ts:91-97`).
3. **Schema third — automatic.** Deploy the backend. The `prestart` hook runs `prisma migrate deploy` before `main.js` starts (`backend/package.json:14-15`), so the five migrations apply as part of the deploy. On a clean database this creates the entire schema.
4. **Reference data fourth.** `cd backend && npm run seed:reference`. Idempotent, so it is safe to run against a restored database as well as a clean one; it will not touch or recreate user accounts.
5. **Accounts fifth.** On a clean database with no restored user rows, staff accounts must be recreated — either through the admin UI (which emails a set-password link via MailerSend) or, for a non-production environment, `npm run seed:demo`.
6. **Frontend sixth.** Redeploy Vercel. Confirm `NEXT_PUBLIC_API_URL` points at the restored API before the deploy, since it is baked into the bundle at build time.
7. **DNS last, only if hostnames moved.** Update the GoDaddy `CNAME` for `api` to the new Railway target and re-add Railway's TXT verification record; re-add the Vercel domains. Allow for propagation.
8. **Verify.** `GET https://api.konma.store/` returns `{status:'ok'}`; a staff sign-in completes; `/admin/usage` renders; the storefront lists products (which also proves the catalog cache and Redis are live).

### 7.6 Honest gap list

> ⚠️ **Seven recovery gaps, stated plainly.**
>
> 1. **No DR runbook existed before this document.** Nothing in the repository described how to bring the system back.
> 2. **The backup posture of the Aiven free tier is unverified.** Frequency, retention and PITR availability are all unknown from the snapshot and must be read from the console.
> 3. **No restore has ever been tested.** An untested backup is a hypothesis.
> 4. **R2 has no backup at all**, and it holds the approval evidence that gives the audit trail its meaning.
> 5. **No RPO or RTO has been defined**, so there is no target against which any of the above can be judged adequate.
> 6. **Env vars exist only in vendor dashboards and one secrets file.** There is no infrastructure-as-code, no `railway variables` export committed, nothing that could rebuild the configuration deterministically.
> 7. **The recovery path assumes a human with credentials to five vendors** (Aiven, Railway, Vercel, Cloudflare R2, GoDaddy) plus GitHub. There is no documented bus-factor mitigation.

---

## 8. CI/CD

`.github/workflows/ci.yml` runs on **every push to every branch** and on every pull request (`ci.yml:3-6`), with `cancel-in-progress` concurrency keyed on the ref (`:8-11`). Four jobs, all on `ubuntu-latest` with Node 22.

### 8.1 Job: `backend` — lint, typecheck, test, build

`ci.yml:13-35`, working directory `backend`, `NODE_ENV: test`. Gates, in order:

1. `npm ci` (npm cache keyed on `backend/package-lock.json`)
2. `npx prisma generate`
3. `npm run lint:check` — the read-only ESLint gate (`backend/package.json:20`); note `npm run lint` applies `--fix` and is **not** what CI runs (`CONTRIBUTING.md:19`)
4. `npx tsc --noEmit -p tsconfig.json`
5. `npx jest --ci --silent`
6. `npm run build`
7. **QA-04 log discipline:** `! grep -rn "console\." src --include=*.service.ts` — a `console.*` call in any service file fails the build (`ci.yml:34-35`)

**Secrets: none.**

### 8.2 Job: `backend-integration` — real Postgres

`ci.yml:37-87`. Spins a `postgres:16-alpine` service with health checks, then runs `npm run test:integration` (`jest --config test/jest-integration.json --runInBand`).

**What it gates, and why it exists** (`ci.yml:43-52`): the unit job mocks `PrismaService`, so it *cannot* prove that a Serializable transaction commits together, that a hand-written `CHECK` rejects a row, or that a unique index makes a replayed event a no-op. This job runs against a real database. The harness truncates every table between suites and **refuses outright to open a database whose name does not say "test"** (`backend/test/integration-setup.ts`). No Redis, no Razorpay, no Shiprocket — nothing in these specs boots the Nest app or leaves the process.

`prisma migrate deploy` is run explicitly before jest even though `globalSetup` would deploy again, so a schema failure is attributed to the migration rather than to jest (`ci.yml:84-86`).

**Secrets: none.** `INTEGRATION_DATABASE_URL`, `DATABASE_URL` and `DIRECT_DATABASE_URL` are literals pointing at the service container (`ci.yml:70-74`).

> Note: the Postgres service image is **`postgres:16-alpine`** while production is **PostgreSQL 18**. A two-major-version gap between the integration gate and production is a real, if low-probability, source of undetected behavioural drift.

### 8.3 Job: `frontend` — lint, typecheck, build, plus four grep gates

`ci.yml:89-124`, working directory `frontend`, with `NEXT_PUBLIC_API_URL: http://localhost:4000` and a literal dummy `JWT_SECRET` (`ci.yml:96-98`).

1. `npm ci`
2. `npx eslint . --max-warnings 60` — **a ratchet, not a formality.** DESIGN-02/DESIGN-04/QA-04 are *errors* via `frontend/eslint-rules/no-raw-colors.mjs`. The ceiling was 80 in P4; Phase 34 deleted the storefront's warn-level exemption and the tree fell to the low fifties, so 60 is the current ceiling. Every remaining warning is a React Compiler diagnostic (`ci.yml:107-113`)
3. `npx tsc --noEmit`
4. `npm run build`
5. **Motion allowlist (SPEC §6.4):** fails if any of twelve named animation components (`BlurFade`, `MagicCard`, `ShimmerButton`, …) appears in `app` or `components` (`ci.yml:116-118`)
6. **Polling floor (SPEC §6.4):** fails on any `refetchInterval` under 30 s or any `refetchIntervalInBackground` (`ci.yml:119-121`)
7. **One token file (SPEC §7):** fails if a `--public-` custom property is declared in any CSS file other than `app/tokens.css` (`ci.yml:122-124`)

**Secrets: none.**

### 8.4 Job: `frontend-e2e` — Playwright purchase smoke

`ci.yml:126-259`. The heaviest job: Postgres **and** Redis service containers, then `prisma migrate deploy` → `seed:reference` → `seed:demo` (with `SEED_DEMO_FORCE: true`) → `npm run build` → boot `dist/src/main.js` in the background with a 60-attempt readiness poll against `/catalog/products?limit=1` → `playwright install --with-deps chromium` → `npm run test:e2e`.

**What is real and what is not** (`ci.yml:127-147`): the smoke walks the real money path against a real backend, a real Postgres and a real Redis. Two things are deliberately not real — `checkout.razorpay.com` is stubbed in the browser (`frontend/e2e/fixtures/razorpay-stub.ts`) so no network call leaves the runner for the modal, and the capture is delivered as a **signed webhook** rather than by paying, because a stub cannot mint a `razorpay_signature` the backend accepts. But `POST /customer/orders` still opens a **real Razorpay test-mode order against `api.razorpay.com`**, which is why this job needs live credentials.

A nice detail at `ci.yml:212-215`: `seed-demo` prints staff passwords exactly once, so the job tees the output, `awk`s the `ROLE=secret` pairs out of it and pushes them into `$GITHUB_ENV` as `E2E_STAFF_PASSWORDS` — otherwise the staff smoke could only skip.

**Secrets required (names only, three):**

| Secret | Why |
|---|---|
| `RAZORPAY_KEY_ID` | test-mode key pair for the real order-create call |
| `RAZORPAY_KEY_SECRET` | same; also the payment-signature HMAC |
| `RAZORPAY_WEBHOOK_SECRET` | mints the signed capture webhook the fixture delivers |

Without them the pay step fails at *"Razorpay not configured"* (`ci.yml:138-140`). `SHIPROCKET_WEBHOOK_TOKEN` is set to a **literal** (`ci.yml:179`), not a secret, because `POST /webhooks/shiprocket` answers 403 by design when it is absent; the purchase smoke does not exercise that route, but the value is set so a future shipment smoke need not rediscover it (`ci.yml:142-147`).

On failure the job uploads the Playwright trace, the HTML report and the backend log with 7-day retention (`ci.yml:249-259`).

### 8.5 Deployment is CLI-driven, not git-triggered

> ⚠️ **CI gates nothing that deploys, and deploys gate on nothing that CI proves.**
>
> `.github/workflows/ci.yml` contains **no deploy job, no deploy step and no environment**. It builds and tests; it does not ship. There is no `vercel deploy`, no `railway up`, no deployment API call anywhere in the workflow file.
>
> Both `SPEC.md:284` and `.planning/REQUIREMENTS.md:329` state the intent — *"Railway and Vercel deploy only on green `master`"* — but that gate **is not implemented**. Deploys today are **CLI-driven from a developer machine**: the repository root carries a `vercel link` artefact (`.vercel/project.json`) and a `.vercelignore` added specifically "for root-linked Vercel deploys" (commit `935cdd3`), which is the signature of `vercel --prod` being run by hand rather than of a git integration.
>
> Consequences worth recording:
> - **A red CI run does not stop a deploy.** Nothing enforces the ordering.
> - **There is no deployment record in the repository** — no run history, no tagged release-to-deploy mapping, no way to answer "which commit is in production right now" from the repo alone. `git tag as-built-2026-09-03` is a manual snapshot marker, not a deployment artefact.
> - **Deployment is a bus-factor of one machine** holding the Vercel and Railway CLI sessions.
> - The workflow does run on **every branch**, not just `master` (`ci.yml:3-5`), so branch coverage is good — it is only the deploy linkage that is missing.
>
> A local safety net exists but is opt-in: `.githooks/pre-push` runs `tsc --noEmit` in both packages and blocks the push on type errors, enabled per clone with `git config core.hooksPath .githooks` (`CONTRIBUTING.md:7-14`). It is not installed automatically and can be skipped with `--no-verify`.

---

## Appendix — verification notes for the reviewer

Six claims in this document originate outside the repository and should be confirmed against the vendor consoles rather than taken on the strength of the citations above:

| Claim | Where to confirm |
|---|---|
| Vercel project Root Directory is `frontend` | Vercel → project `konmaxperience` → Settings → General |
| Apex `konma.store` → `www` 308 redirect | Vercel → Settings → Domains |
| Railway builder is Railpack; service `api` + Redis addon | Railway → project `konmaxperience` → service settings |
| GoDaddy `CNAME api → ec5b8mmz.up.railway.app` + Railway TXT | GoDaddy DNS management for `konma.store` |
| `DATABASE_URL` carries `connection_limit=8`; database is Aiven PG 18 `defaultdb` | Railway service variables; Aiven console |
| Aiven backup frequency / retention / PITR on the current plan | Aiven console → service → Backups |

Everything else in this document is traceable to commit `2cab09e`.
