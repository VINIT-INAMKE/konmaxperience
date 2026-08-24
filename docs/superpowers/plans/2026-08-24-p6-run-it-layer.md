# P6 Run-It Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The node stops being a system people log into and becomes a system that *reaches out*. Staff get WhatsApp nudges for the four things that block a day (approvals waiting, blockers, low stock, failed shipments); a daily close screen makes yesterday auditable and signed; a theoretical-vs-actual food cost report turns the BOM into a number `BI_LEAD` can act on; an admin usage dashboard shows who actually uses what; and two AI assists — evidence-review suggestions and a morning brief — run behind an interface with a deterministic fallback, **suggesting only, never deciding**. Plus the nightly hygiene RUN-06 asks for, and the seven recorded debts P1–P5 left behind that belong to a run-it layer.

**Architecture:** Task 1 owns `schema.prisma` and adds every P6 model/column/enum *without* a migration, so Tasks 2–15 compile and unit-test against a generated client while the database stays on the P5a baseline. Task 16 writes the single migration, applies it, seeds and smoke-tests. Three new capabilities each go behind a resolver-selected port, following the `ShippingProviderResolver` precedent P5a established and the `QStashService` / `PusherService` null-client precedent that predates it: `AiProviderResolver` (Anthropic ↔ heuristic), `NotificationDispatcher` (in-app ↔ email ↔ WhatsApp, gated by opt-in and quiet hours), and `DailyCloseService` (compute ↔ persist ↔ sign). **No P6 code path can fail because a key is missing** — every provider degrades to a deterministic local implementation, and every outbound send is failure-isolated.

**Tech Stack:** NestJS 11, Prisma 6.19 (PostgreSQL), Jest 30 + ts-jest (config inline in `backend/package.json`, `rootDir: "src"`, `testRegex: ".*\.spec\.ts$"`, **102 suites / 1575 tests green at `5a15e39`**), class-validator, ioredis (Upstash), `@nestjs/schedule` 6.1, `@upstash/qstash` 2.10, Pusher, Next.js 16.2 / React 19 / Tailwind 4, npm, Node 22. Branch `v2-os-marketplace`, HEAD `29d47c7`. Local database: Docker Postgres `konma-postgres` on `localhost:5433` (db/user/pass `konma`, shadow db `konma_shadow`), carrying migrations `20260823120000_p2_platform_foundation`, `20260823180000_p3_mission_bridge`, `20260826000000_p4_role_aware_ia`, `20260826120000_p5a_marketplace_backend`. **`prisma migrate reset` is NOT available to agents** (Prisma 6.19 AI-agent guard) — Task 16 uses `migrate dev --create-only` + `migrate deploy`. Build output is `backend/dist/src/main.js`.

**Two new backend dependencies, both installed in Task 2:** `@anthropic-ai/sdk` (the official SDK — the skill contract for this repo is "official SDK or raw HTTP, never a shim") and `zod` (peer of `@anthropic-ai/sdk/helpers/zod`, already a frontend dependency at `^4.3.6`). Nothing else is added.

**Gates that must stay green after every task:** `cd backend && npx jest --silent` (102 → ~130 suites), `npx tsc --noEmit -p tsconfig.build.json` (exit 0), `npx eslint "{src,apps,libs,test}/**/*.ts"` (**0 errors**; warnings are pre-existing), `npx prisma validate`. Frontend: `cd frontend && npx tsc --noEmit`, `npx eslint .` (0 errors), `npx next build`.

---

## Decisions taken while reading the code

1. **There is no AI provider in this repository, so P6 builds one behind a port.** A sweep of `backend/src`, `backend/package.json`, `backend/.env.example` and the config validation schema for `anthropic`, `openai`, `gemini`, `langchain`, `ollama`, `mistral`, `cohere` returns **zero hits**. `backend/src/chat/` is human-to-human messaging over Pusher (`ChatService.createMessage`, `getConversations`, `addMembers`) — not an LLM surface, and `Chat*`/`Conversation*` carry no prompt or completion columns. P6 therefore ships `AiProviderPort` with two implementations and a resolver, following the `ShippingProviderResolver` precedent P5a established: `AiProviderResolver.get()` reads `SystemSetting['ai'].provider` on every call (seeded `heuristic`) and returns `AnthropicProvider` or `HeuristicProvider`. No jest run can reach the network.
2. **`ANTHROPIC_API_KEY` is optional and its absence is a supported production state.** SPEC §8 lists the vars whose absence must fail a production boot; `ANTHROPIC_API_KEY` is deliberately not added to that list. `AnthropicProvider` falls through to `HeuristicProvider` on a missing key, any `Anthropic.APIError`, and `stop_reason === 'refusal'`. RUN-05 ships whether or not a key ever arrives.
3. **The Anthropic call shape is pinned here so no implementer guesses it.** `@anthropic-ai/sdk`, model `claude-opus-5`, `thinking: { type: 'adaptive' }`, `output_config.effort` (`low` for evidence assist, `medium` for the morning brief), and structured output through `client.messages.parse({ output_config: { format: zodOutputFormat(Schema) } })`. **No `budget_tokens`** (removed on Opus 5 — a 400), **no assistant prefill** (also a 400), no streaming (both outputs are small and bounded). `max_tokens` is 2048 for the assist and 4096 for the brief — deliberately short, because both are schema-constrained.
4. **Server-side refusal fallbacks are deliberately NOT used, and this needs sign-off.** The `fallbacks` beta reroutes a refusal to a *different model*. This design already carries a strictly more available fallback — `HeuristicProvider`, which needs no key, no network and no quota — so a refusal is handled locally instead. If the model-level fallback is also wanted it is `betas: ['server-side-fallback-2026-07-01']` + `fallbacks: 'default'` on `client.beta.messages`, and Task 2 is the only file that changes.
5. **AI never writes a decision, and a test proves it.** `EvidenceService.approveEvidence` / `rejectEvidence` (`evidence.service.ts:504`, `:548`) and `ApprovalsService` (`:528`, `:542`) stay the only callers of `validateTask` and the only writers of `Evidence.approval_status`. The assist writes only `EvidenceReviewSuggestion`. `src/ai/ai-boundaries.spec.ts` reads every file under `src/ai/**` off disk and asserts none contains `approval_status`, `readiness_value`, `current_value`, `base_price` or `.update(` — a runnable guard on SPEC §1.2, not a promise in a comment.
6. **Suggestions are a sidecar table, not columns on `Evidence`.** `rejectEvidence` overwrites `Evidence.notes`, so an `ai_reason` column on the same row would be clobbered by the very human decision it exists to inform. A sidecar also carries `provider`, `model`, `latency_ms` and re-run history for free.
7. **`WhatsAppService` is NOT extracted into a global module.** `NotificationsModule` gains `imports: [CustomerAuthModule]`, which is safe: `CustomerAuthModule` imports only `PrismaModule`, `ChatModule` and `JwtModule`, so there is no cycle, and it already declares `exports: [CustomerAuthService, RedisService, WhatsAppService]` for the Shiprocket webhook. Moving the file would touch `customer-auth.module.ts`, `webhooks.module.ts`, `shiprocket-webhook.service.ts`, `mock-providers.ts` and three specs for zero behaviour change.
8. **Staff phone lives on `User`, with no unique constraint.** `User.phone String?` + `User.whatsapp_opt_in Boolean @default(false)`. `Customer.phone` is `@unique` in its own table and a staff member may also be a customer; two staff sharing a shop number must not be a seed-time failure. The dispatcher needs a number, not an identity.
9. **One dispatcher, three channels, one cooldown.** `NotificationDispatcher.dispatch()` replaces the two hand-rolled cooldown loops in `notifications.processor.ts` — `handleApprovalPending` (lines 116–141) and `handleLowStock` (lines 175–203), each of which builds its own `lastNotifMap` and hardcodes 24 h / 4 h — with the single existing `NotificationsService.shouldNotify(userId, type, referenceId, cooldownHours)`, whose `cooldownHours` now comes from `SystemSetting['notifications'].cooldown_hours`. The dispatcher writes `Notification.channel` with the channels actually attempted: the first writer that column has ever had (it has shipped `@default([in_app])` since P2 and nothing has ever set it).
10. **`Notification.is_email_sent` is dropped — the only DROP in the P6 migration.** Deferred P2 → P3 → P4 and now replaceable, because `channel` containing `email` carries the same fact. It has exactly four code touch points — `notifications.service.ts:27` (an optional field on the `create` input type), `notifications.processor.ts:352` (the only writer), `frontend/lib/types/notifications.ts:44`, and the schema. Zero readers anywhere.
11. **Quiet hours suppress WhatsApp only, and do not consume the cooldown.** In-app is a pull surface and is always written. A WhatsApp send suppressed by quiet hours leaves no `Notification` row for that `(user, type, reference_id)` triple, so the hourly sweep re-sends once the window closes — nothing lost, nothing duplicated. Quiet hours resolve in the **node** timezone via `NodeService.timezone()` and the existing `formatInNodeTz` helper; there is no per-user timezone and inventing one is out of scope.
12. **Every outbound WhatsApp send is failure-isolated.** `WhatsAppService.sendTemplate` (`customer-auth/whatsapp.service.ts:36`) logs and returns when unconfigured but **throws** on a Meta API error. Every P6 call site wraps it, so a Meta outage can never fail the write that triggered the nudge.
13. **`NotificationType` gains three members**: `shipment_failed` (RUN-01's fourth nudge has no type today), `morning_brief`, `daily_close_due`. Folding them into `admin_notice` would collapse the per-type cooldown RUN-01 explicitly asks for, because `shouldNotify` keys on `(user_id, type, reference_id)`.
14. **New advisory-lock ids take the `6_35x_xxx` block, and the three ids in the codebase are folded into one registry.** Today `ADVISORY_LOCK` holds exactly one entry (`READINESS_SNAPSHOT: 3_100_001`) while `LOYALTY_EXPIRY_LOCK_ID = 5_700_101` and `BOOKING_HOLD_SWEEP_LOCK_ID = 5_700_102` are declared inline in their cron files, each with a comment saying it lives there only because P5a Task 7 did not own `advisory-lock.ts`. P6 does own it. The registry's own header comment — "the `3_1xx_xxx` block is reserved for P3 and Phase 35's `RUN-06` takes the next one" — predates P5a's block and is corrected to the leading-digit-per-phase convention that actually shipped.
15. **The advisory-lock helper stays session-scoped; the xact-lock caveat is answered, not rewritten.** Every P6 job is nightly or weekly and issues lock and unlock back-to-back on an otherwise idle client — precisely the case the existing comment blesses. Converting `withAdvisoryLock` to `pg_try_advisory_xact_lock` inside an interactive `$transaction` would force `LoyaltyExpiryCron`'s deliberately per-row transactions and the reconciliation sweep into one long-held transaction, trading a theoretical pooling hazard for a real lock-contention one. What P6 **does** fix: `withAdvisoryLock` discards the `pg_advisory_unlock` return value, so an unlock that lands on a different pooled session returns `false` and wedges that lock id until the connection is recycled — silently. P6 checks it and logs an error. **Sign-off item.**
16. **The daily close is a persisted, signed artefact, not a live query.** `DailyClose { id, node_id, business_date @db.Date, status, metrics Json, signed_by, signed_at, notes, @@unique([node_id, business_date]) }`. A cron computes and upserts `open` at 00:45 node-local; the screen renders `metrics` verbatim; sign-off flips to `signed` and writes `AuditEvent(entity_type: 'daily_close', action: 'daily_close.signed')` in the same transaction. Recomputing on read would let a late refund change a number someone already signed — the exact thing a close exists to prevent.
17. **Food cost is computed on demand; no snapshot table.** The theoretical side already exists twice — `readiness-derivation.service.ts:391-397` (`Σ quantity × Recipe.computed_cost` for the QUALITY meter) and `analytics.service.ts:72-79` (weighted food-cost %). P6 extracts the canonical version into `FoodCostService` and **leaves both callers alone**: they sit on P3- and P1-owned hot paths, and forcing a shared helper would put three tasks into files they do not own. The actual side is new: `Σ |StockMovement.quantity|` over the consuming movement types, valued at the latest `VendorPrice` through `convertUnit`. A period report over `@@index([zone_id, created_at])` is cheap; a snapshot would need its own invalidation story for exactly the late-refund reason above, and RUN-03 asks for a report, not a ledger.
18. **An ingredient's unit cost is the latest `VendorPrice`, converted.** `Ingredient` has no cost column. `waste.service.ts:118-145` already establishes the pattern: latest `VendorPrice` by `effective_date desc` giving `{ price, unit }`, then `convertUnit(qty, fromUnit, priceUnit, prisma)` and multiply. When there is no price, or no conversion path, the line is valued at zero **and named in an `unpriced_ingredients` array on the response** — a silent zero is how a variance report lies.
19. **`/admin/usage` gets a new `usage` module key** (`sort_order 710`, `FOUNDER_ADMIN + TECH_LEAD`) rather than hanging off `settings`. It must be added in exactly **two** places, not three: `backend/prisma/seed-data/module-access.ts` and `frontend/lib/nav/spine.ts`. `frontend/components/ops/admin/module-routes.ts` derives `MODULE_ROUTES` from the spine (P4 Task 19 made good on its own TODO), so a key with a spine entry gets its route automatically and a key without one renders "—".
20. **The food-cost screen goes under the existing `analytics` key**, at `/intelligence/food-cost`. `analytics` already resolves to exactly `BI_LEAD, FOUNDER_ADMIN, TECH_LEAD` — RUN-03's stated audience — and `MANAGE_KPIS` is the permission every `analytics.controller.ts` route already uses. No new key, no new permission.
21. **The daily-close screen goes under the existing `orders` key**, at `/operations/daily-close`. `orders` resolves to `FRONTEND_LEAD, FOUNDER_ADMIN, TECH_LEAD` — exactly RUN-02's signatories.
22. **No server components.** Every page under `frontend/app/(ops)/` is `'use client'`; there is no `cookies()` / `next/headers` usage and no server fetch helper anywhere in the ops app. P6 follows the shipped pattern: client component + `@tanstack/react-query` + `apiClient` + the existing permission gate wrapper.
23. **`GET /usage/summary` gains `by_user` and moves to node-timezone day boundaries.** Today it windows on `new Date(Date.now() - days * 86_400_000)` (`usage.service.ts:91`), unlike analytics which uses `nodeDateRange`. RUN-04 asks for last-seen per user; `User` has no `last_seen_at` column and P6 does not add one — it is derived as `max(created_at) group by user_id` over the existing `@@index([user_id, created_at])`.
24. **The morning brief is delivered, not merely displayed.** RUN-05 says "delivered via notification/WhatsApp to leads": the cron writes one `Notification(type: morning_brief)` per lead **through the dispatcher**, so the WhatsApp half inherits opt-in, quiet hours and cooldown for free. Mission Control renders the same row through the `optionalGet` pattern P4 Task 14 established, so a day with no brief drops the card rather than breaking the dashboard.

---

## Gap closure — what P6 takes, what it leaves, and why

| Recorded debt | Verdict | Reasoning |
|---|---|---|
| `refund.failed` unhandled (P5a plan risk 3) | **Close — Task 13** | `webhooks.service.ts:77-113` dispatches `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`. `refund.failed` is absent, so a refund that fails at Razorpay leaves `Refund.status = processed` and the customer's money nowhere. `RefundStatus.failed` already exists in the enum, unused. Money correctness on a run-it surface: exactly P6's remit. |
| `Notification.is_email_sent` removal (deferred P2 → P3 → P4) | **Close — Tasks 4, 16** | P6 is the phase that rewrites the notification dispatch path, so the replacement (`channel`) gets its first writer here. Removing it in any other phase would have been a schema change with no behavioural anchor. |
| `PATCH /tasks/:id {"status":"done"}` does not re-run the validation cascade | **Close — Task 13** | Verified: `validateTask` has four call sites — `approvals.service.ts:528,542` and `evidence.service.ts:504,548` — and `TasksService.update` (`tasks.service.ts:322-480`) is not among them. A task whose evidence was approved *before* it was marked done never becomes `valid`, never awards XP and never moves a meter. P3 avoided it because the fix crosses the `TasksModule ↔ EvidenceModule` edge; P6 crosses it in the direction that has no cycle (`TasksModule` imports `EvidenceModule`, not the reverse). Without this, the daily close and morning brief report readiness numbers that are wrong for a reason nobody can see. |
| Audit hole on the shipped commerce surface | **Close — Task 13, scope corrected** | The debt is recorded as "the shipped promotion", but promotions are clean: `coupons.service.ts` audits create (`:224`), update (`:304`), archive (`:335`) **and redemption** (`:521`, `action: 'coupon.redeemed'`). The actual hole is **`CatalogService`** — nine mutating methods (`createCategory`, `updateCategory`, `removeCategory`, `createProduct`, `updateProduct`, `archiveProduct`, `removeVariant`, `removeMedia`, publish) and **zero** `audit.record` calls, against 3 in `ShipmentsService`, 2 in `RefundsService`, 2 in `ReviewsService`, 1 in `LoyaltyService`. SPEC §3: every mutating write in a transaction also writes `AuditEvent`. A price or publish flip is the most audit-worthy write in the catalog. |
| Feedback-per-order dispatch keying | **Close — Task 13** | `mission-bridge.rules.ts:241` selects `subject_id: p.orderId ?? p.feedbackId`, and `BridgeDispatch @@unique([rule_key, source_type, source_id])` is the only de-duplication (`mission-bridge.service.ts:400-405` says so explicitly). When `orderId` is null the key silently degrades from per-order to per-feedback, so two low ratings on one order — one carrying an order id, one not — spawn two improvement tasks. Two lines and a spec case. |
| The advisory-lock util's xact-lock note (RUN-06) | **Close — Task 3, as an unlock check** | See decision 15. The note is answered on its own terms rather than by a rewrite that would make three existing crons worse. |
| `cart/sync` merge rule | **Defer → Phase 34** | `customer-orders.service.ts:353-397` merges by "keep whichever cart has more items": a guest with three items in local storage overwrites a one-item saved cart wholesale, and vice versa; there is no union and no per-line quantity reconciliation. A real defect — but a **storefront purchase-flow** defect on the exact path Phase 34 is rewriting around the quote (`use-cart.ts:35` already posts the wrong body). Fixing it here means editing a Phase-34-owned file twice, with the second edit throwing the first away. Recorded for the Phase 34 planner. |
| `/admin/approval-policies` screen (P4 carry) | **Defer → v2.1** | The API shipped in P3; the screen is IA work with no RUN-* requirement behind it, and P6's frontend budget is spent on the four screens RUN-02/03/04/05 name. |
| `QA-03` Playwright smoke 1 · `QA-05` Postgres integration harness · `QA-06` Playwright smoke 2 | **Defer → Phase 34** | All three are already assigned to Phase 34 by the ROADMAP and the STATE carry-list. P6 must not fork a second attempt at a harness three phases have queued behind one owner. |

---

## File structure

**Create (backend):**
- `backend/src/ai/` — `ai.types.ts`, `ai.module.ts`, `ai-provider.resolver.ts(.spec)`, `anthropic.provider.ts(.spec)`, `heuristic.provider.ts(.spec)`, `ai-boundaries.spec.ts`
- `backend/src/ai/evidence-assist/` — `evidence-assist.service.ts(.spec)`, `evidence-assist.controller.ts`, `evidence-assist.prompt.ts`, `dto/request-assist.dto.ts`
- `backend/src/ai/morning-brief/` — `morning-brief.service.ts(.spec)`, `morning-brief.controller.ts`, `morning-brief.cron.ts(.spec)`, `morning-brief.prompt.ts`
- `backend/src/notifications/` — `notification-dispatcher.service.ts(.spec)`, `notification-templates.ts(.spec)`, `quiet-hours.ts(.spec)`, `staff-nudge.cron.ts(.spec)`
- `backend/src/daily-close/` — `daily-close.service.ts(.spec)`, `daily-close.controller.ts`, `daily-close.cron.ts(.spec)`, `daily-close.module.ts`, `dto/sign-daily-close.dto.ts`
- `backend/src/food-cost/` — `food-cost.service.ts(.spec)`, `food-cost.controller.ts`, `food-cost.module.ts`, `ingredient-cost.ts(.spec)`
- `backend/src/inventory/stock-reconciliation.cron.ts(.spec)`
- `backend/src/storage/orphan-sweep.cron.ts(.spec)`
- `backend/prisma/migrations/20260827090000_p6_run_it_layer/migration.sql`

**Create (frontend):**
- `frontend/app/(ops)/admin/usage/page.tsx` + `frontend/components/ops/admin/usage/{UsageDashboard,UsageByRoleChart,UsageLastSeenTable}.tsx`
- `frontend/app/(ops)/operations/daily-close/page.tsx` + `frontend/components/ops/daily-close/{DailyCloseScreen,DailyCloseMetrics,DailyCloseSignCard}.tsx`
- `frontend/app/(ops)/intelligence/food-cost/page.tsx` + `frontend/components/ops/intelligence/{FoodCostReport,FoodCostVarianceTable}.tsx`
- `frontend/components/ops/evidence/EvidenceAssistPanel.tsx`
- `frontend/components/ops/dashboard/MorningBriefCard.tsx`
- `frontend/lib/types/{daily-close,food-cost,usage,ai}.ts`

**Modify (backend):** `prisma/schema.prisma` (Task 1 only) · `src/settings/settings.service.ts` + `prisma/seed-data/settings.ts` (Task 1 only) · `src/test-utils/mock-providers.ts` (Task 1 only) · `src/config/env.validation.ts` + `.env.example` (Task 2 only) · `src/common/utils/advisory-lock.ts(.spec)`, `src/loyalty/loyalty.cron.ts(.spec)`, `src/events/event-holds.cron.ts(.spec)`, `src/readiness/readiness.cron.ts`, `src/inventory/inventory.module.ts`, `src/storage/storage.service.ts(.spec)` + `storage.module.ts` (Task 3) · `src/notifications/{notifications.service,notifications.processor,notifications.module,notifications.cron}.ts` + specs (Task 4) · `prisma/seed-data/module-access.ts`, `src/usage/usage.service.ts(.spec)`, `src/usage/usage.controller.ts` (Task 11) · `src/webhooks/webhooks.service.ts(.spec)`, `src/refunds/refunds.service.ts(.spec)`, `src/tasks/{tasks.service,tasks.module}.ts(.spec)`, `src/catalog/{catalog.service,catalog.module}.ts(.spec)`, `src/mission-bridge/mission-bridge.rules.ts(.spec)` (Task 13) · `src/users/{users.service,users.controller}.ts(.spec)` + `dto/` (Task 15) · `src/app.module.ts` (Tasks 2, 5, 13 — one per wave) · `prisma/seed-reference.ts` + `src/prisma/seed-data.spec.ts` (Task 16) · `CLOUDFLARE-SETUP.md` (Task 3).

**Modify (frontend):** `lib/types/notifications.ts` (Task 4) · `lib/nav/spine.ts` (Task 11) · `components/ops/evidence/**` and `components/ops/dashboard/**` (Task 14) · `components/ops/admin/users/**` and `components/ops/admin/settings/**` (Task 15).

**Current state (verified at `29d47c7`):** 102 spec suites (1575 tests green at the P5a gate); four migrations applied to `konma`; `npx prisma validate` clean; Docker `konma-postgres` up on 5433. `ADVISORY_LOCK` holds one id, two more are inline. `Notification.channel` has **zero** writers. `NotificationType` has 8 members, none for shipments. `User` has no `phone`. `SETTING_DEFAULTS` has 10 keys, none for notifications or AI. `CatalogService` has 9 mutating methods and 0 audit calls. `WebhooksService` handles 4 Razorpay events. `StorageService` can PUT but cannot LIST or DELETE. `UsageService.summary` returns `by_role`/`by_path`/`by_action` on a rolling millisecond window. No file in `backend/src` mentions any LLM provider.

---

### Task 1: Every P6 model, column and enum in `schema.prisma` + the two new setting blocks + the jest registry

**Files:**
- Modify: `backend/prisma/schema.prisma`, `backend/src/settings/settings.service.ts`, `backend/prisma/seed-data/settings.ts`, `backend/src/test-utils/mock-providers.ts`
- Create: `backend/src/prisma/run-it-schema.spec.ts`

**No migration in this task.** `npx prisma generate` only, exactly as P5a Task 1 did — Tasks 2–15 compile against the generated client while the database stays on the P5a baseline. Task 16 turns this into SQL.

- [ ] Add to `backend/prisma/schema.prisma` — three enum members, one enum, two `User` columns, two models, one DROP:

```prisma
enum NotificationType {
  task_due
  task_blocked
  approval_pending
  low_stock
  new_order
  order_ready
  delivery_update
  admin_notice
  shipment_failed   // RUN-01 nudge 4 — a Shipment that entered `failed` or `rto`
  morning_brief     // RUN-05 — the daily generated summary
  daily_close_due   // RUN-02 — yesterday's close is computed and unsigned
}

enum DailyCloseStatus {
  open
  signed
}

model DailyClose {
  id            String           @id @default(uuid())
  node_id       String           @default("11111111-1111-4111-8111-111111111111")
  node          Node             @relation(fields: [node_id], references: [id], onDelete: Restrict)
  /// The node-local business day this close covers. `@db.Date`, never a timestamp:
  /// a close is a calendar fact, and a timestamptz would drift under the node's tz.
  business_date DateTime         @db.Date
  status        DailyCloseStatus @default(open)
  /// Frozen `DailyCloseMetrics` (see `daily-close.service.ts`). Json, not columns:
  /// the shape grows with the business and a signed row must never be re-derived.
  metrics       Json
  notes         String?
  signed_by     String?
  signer        User?            @relation("DailyCloseSigner", fields: [signed_by], references: [id])
  signed_at     DateTime?        @db.Timestamptz(3)
  created_at    DateTime         @default(now()) @db.Timestamptz(3)
  updated_at    DateTime         @updatedAt @db.Timestamptz(3)

  @@unique([node_id, business_date])
  @@index([node_id, status, business_date(sort: Desc)])
}

model EvidenceReviewSuggestion {
  id          String   @id @default(uuid())
  node_id     String   @default("11111111-1111-4111-8111-111111111111")
  node        Node     @relation(fields: [node_id], references: [id], onDelete: Restrict)
  evidence_id String
  evidence    Evidence @relation(fields: [evidence_id], references: [id], onDelete: Cascade)
  /// `approve` | `reject` | `unsure` — a *suggestion*. Deliberately NOT an
  /// `ApprovalStatus`, so no code path can mistake it for a decision (SPEC §1.2).
  verdict     String
  /// 0..1. The heuristic provider emits banded values; the model emits its own.
  confidence  Decimal  @db.Decimal(4, 3)
  reasons     String[]
  provider    String
  model       String?
  latency_ms  Int
  created_at  DateTime @default(now()) @db.Timestamptz(3)

  @@index([evidence_id, created_at(sort: Desc)])
}
```

- [ ] On `model User`, add two columns and the back-relation (**do not** add `@unique` to `phone` — decision 8):

```prisma
  /// Staff WhatsApp number for RUN-01 nudges. Not unique: a staff member may
  /// also be a Customer (whose `phone` is unique in its own table), and two
  /// staff may share a shop handset. `WhatsAppService.normalize` adds the 91.
  phone              String?
  whatsapp_opt_in    Boolean                @default(false)
  dailyCloseSigned   DailyClose[]           @relation("DailyCloseSigner")
```

- [ ] On `model Evidence`, add `reviewSuggestions EvidenceReviewSuggestion[]`. On `model Node`, add `dailyCloses DailyClose[]` and `evidenceReviewSuggestions EvidenceReviewSuggestion[]`.
- [ ] **Delete** `is_email_sent  Boolean @default(false)` from `model Notification` (decision 10). Task 4 removes its three code references in the same wave; this task's `npx tsc --noEmit` will fail until it does, so **Task 1 lands the schema and Task 4 lands the code in the same wave — verify the merged wave, not this task alone.** If the orchestrator wants each task independently green, Task 1 keeps the column and Task 4 removes it; the migration in Task 16 is identical either way. Prefer the merged-wave check.
- [ ] Add two blocks to `SETTING_DEFAULTS` in `backend/src/settings/settings.service.ts` (the object is the allowlist, the shape contract **and** the fallback — `SETTING_KEYS` derives from it):

```ts
  notifications: {
    /** Master switch for outbound WhatsApp staff nudges (RUN-01). Off until templates are approved by Meta. */
    whatsapp_enabled: false,
    /** Node-local window in which no WhatsApp nudge is sent. In-app is unaffected. */
    quiet_hours: { start: '21:00', end: '07:00' },
    /** Hours before the same (user, type, reference) may be nudged again. */
    cooldown_hours: {
      approval_pending: 24,
      task_blocked: 12,
      low_stock: 4,
      shipment_failed: 6,
      morning_brief: 20,
      daily_close_due: 20,
    },
    /** Types that also send an email through `EmailService` (v1 behaviour, preserved). */
    email_types: ['task_due', 'task_blocked', 'approval_pending', 'low_stock'] as string[],
  },
  ai: {
    /** `heuristic` needs no key and is the seeded default (decision 1). */
    provider: 'heuristic' as 'anthropic' | 'heuristic',
    model: 'claude-opus-5' as string,
    /** RUN-05 guard rail. Flipping this to true is a SPEC §1.2 violation; nothing reads it as permission. */
    evidence_assist_enabled: true,
    morning_brief_enabled: true,
    /** Roles that receive the morning brief. */
    morning_brief_role_codes: ['FOUNDER_ADMIN', 'BACKEND_LEAD', 'FRONTEND_LEAD', 'BI_LEAD', 'PROCUREMENT_LEAD'] as string[],
  },
  daily_close: {
    /** Minute-of-day the close job runs, node-local. */
    compute_at: '00:45' as string,
    /** Roles allowed to sign (RUN-02). Checked in addition to `MANAGE_OPS`. */
    signer_role_codes: ['FRONTEND_LEAD', 'FOUNDER_ADMIN'] as string[],
  },
```

- [ ] Mirror all three blocks verbatim into `backend/prisma/seed-data/settings.ts`. `src/prisma/seed-data.spec.ts:258` asserts `SEED_SETTING_DEFAULTS` "mirrors SETTING_DEFAULTS exactly" — a mismatch fails an existing test, which is the point.
- [ ] Add to `backend/src/test-utils/mock-providers.ts`: `mockAiProvider` (a `jest.fn()` pair returning a fixed suggestion and brief), `provideAi`, and extend `mockSettings` so `get('notifications' | 'ai' | 'daily_close')` returns the declared defaults. Every downstream task's spec injects these rather than building its own double.
- [ ] Create `backend/src/prisma/run-it-schema.spec.ts` — the P5a `commerce-schema.spec.ts` pattern: assert the generated client exposes `dailyClose` and `evidenceReviewSuggestion` delegates, that `NotificationType` has the three new members, that `Notification` no longer has `is_email_sent`, and that `DailyCloseStatus` has exactly `open`/`signed`.
- [ ] `cd backend && npx prisma generate && npx prisma validate` — expect `The schema at prisma\schema.prisma is valid`.
- [ ] `cd backend && npx jest src/prisma src/settings --silent`
- [ ] `git commit -m "feat(p6-01): DailyClose + EvidenceReviewSuggestion models, User.phone, notification/ai/daily_close settings" -- backend/prisma/schema.prisma backend/prisma/seed-data/settings.ts backend/src/settings backend/src/test-utils backend/src/prisma`

---

### Task 2: `AiProviderPort`, `AnthropicProvider`, `HeuristicProvider`, the resolver, and the env contract (+ wave-1 `app.module`)

**Files:**
- Create: `backend/src/ai/{ai.types.ts,ai.module.ts,ai-provider.resolver.ts,ai-provider.resolver.spec.ts,anthropic.provider.ts,anthropic.provider.spec.ts,heuristic.provider.ts,heuristic.provider.spec.ts,ai-boundaries.spec.ts}`
- Modify: `backend/src/config/env.validation.ts`, `backend/.env.example`, `backend/src/app.module.ts` (**wave 1's single owner**), `backend/package.json`

This task is typed against **its own interfaces in `ai.types.ts`**, not against Prisma model types, so it runs in parallel with Task 1 (the `ShippingProviderPort` precedent, P5a decision 11).

- [ ] `cd backend && npm install @anthropic-ai/sdk zod` — the official SDK is the only permitted client (no OpenAI-compatible shim, no hand-rolled `fetch`); `zod` is the peer of `@anthropic-ai/sdk/helpers/zod` and already ships in the frontend at `^4.3.6`.
- [ ] Create `backend/src/ai/ai.types.ts`:

```ts
/** What the assist is asked about. Plain data — never a Prisma row. */
export interface EvidenceAssistInput {
  evidence_id: string;
  task_title: string;
  task_description: string | null;
  evidence_type: string;
  evidence_notes: string | null;
  evidence_url: string;
  /** `bridge` evidence was written by the system from a real ops event. */
  source: 'manual' | 'bridge';
  bridge_event: string | null;
  uploaded_by_name: string;
  /** How many times this task's evidence has already been rejected. */
  prior_rejections: number;
}

export type AssistVerdict = 'approve' | 'reject' | 'unsure';

export interface EvidenceAssistResult {
  verdict: AssistVerdict;
  /** 0..1 */
  confidence: number;
  /** One to four short, specific reasons. Never empty. */
  reasons: string[];
  provider: 'anthropic' | 'heuristic';
  model: string | null;
  latency_ms: number;
}

export interface MorningBriefInput {
  business_date: string;                                   // YYYY-MM-DD, node-local
  readiness: { code: string; value: number; delta_7d: number }[];
  sales: { orders: number; revenue: number; by_channel: { channel: string; orders: number; revenue: number }[] };
  waste: { entries: number; cost: number };
  pending: { approvals: number; blockers: number; stale_decisions: number };
  shipments: { open: number; failed: number };
  low_stock: { ingredient: string; on_hand: number; minimum: number }[];
}

export interface MorningBriefResult {
  headline: string;
  /** Three to six bullets. Rendered verbatim; no markdown. */
  bullets: string[];
  /** Zero to three things a lead should do today. */
  actions: string[];
  provider: 'anthropic' | 'heuristic';
  model: string | null;
  latency_ms: number;
}

export interface AiProviderPort {
  readonly name: 'anthropic' | 'heuristic';
  reviewEvidence(input: EvidenceAssistInput): Promise<EvidenceAssistResult>;
  writeMorningBrief(input: MorningBriefInput): Promise<MorningBriefResult>;
}
```

- [ ] Create `backend/src/ai/heuristic.provider.ts` — deterministic, no network, and the fallback for every failure mode. It must be good enough to ship alone:

```ts
import { Injectable } from '@nestjs/common';
import type {
  AiProviderPort, EvidenceAssistInput, EvidenceAssistResult,
  MorningBriefInput, MorningBriefResult,
} from './ai.types';

/**
 * The deterministic half of RUN-05. It is not a stub: with no `ANTHROPIC_API_KEY`
 * this is what ships, so its output has to be genuinely useful. It encodes the
 * rules a reviewer applies before reading the attachment — where the evidence
 * came from, whether it says anything, and whether this task has already been
 * bounced — and it is honest about uncertainty rather than guessing.
 */
@Injectable()
export class HeuristicProvider implements AiProviderPort {
  readonly name = 'heuristic' as const;

  async reviewEvidence(input: EvidenceAssistInput): Promise<EvidenceAssistResult> {
    const started = Date.now();
    const reasons: string[] = [];
    let score = 0;

    if (input.source === 'bridge') {
      score += 2;
      reasons.push(`Written by the mission bridge from a real ${input.bridge_event ?? 'ops'} event, not typed by hand.`);
    } else {
      reasons.push('Uploaded manually — the attachment itself still needs a human eye.');
    }

    const noteLength = (input.evidence_notes ?? '').trim().length;
    if (noteLength === 0) {
      score -= 2;
      reasons.push('No note explaining what this proves.');
    } else if (noteLength < 20) {
      score -= 1;
      reasons.push('The note is too short to tie the file to the task.');
    } else {
      score += 1;
    }

    if (input.evidence_type === 'note' && noteLength < 60) {
      score -= 1;
      reasons.push('A note-only submission carries no artefact.');
    }
    if (input.evidence_type === 'image' || input.evidence_type === 'document') score += 1;

    if (input.prior_rejections > 0) {
      score -= input.prior_rejections;
      reasons.push(`This task has already had ${input.prior_rejections} piece(s) of evidence rejected.`);
    }

    const verdict = score >= 2 ? 'approve' : score <= -2 ? 'reject' : 'unsure';
    // Banded, never 0 and never 1 — a heuristic must not present as certain.
    const confidence = verdict === 'unsure' ? 0.35 : Math.min(0.75, 0.45 + Math.abs(score) * 0.1);

    return {
      verdict, confidence,
      reasons: reasons.slice(0, 4),
      provider: this.name, model: null,
      latency_ms: Date.now() - started,
    };
  }

  async writeMorningBrief(input: MorningBriefInput): Promise<MorningBriefResult> {
    const started = Date.now();
    const bullets: string[] = [];

    bullets.push(
      `${input.sales.orders} order(s) for ₹${input.sales.revenue.toFixed(2)} across ` +
        `${input.sales.by_channel.length} channel(s).`,
    );
    const movers = [...input.readiness]
      .sort((a, b) => Math.abs(b.delta_7d) - Math.abs(a.delta_7d))
      .slice(0, 2)
      .filter((m) => m.delta_7d !== 0);
    for (const m of movers) {
      bullets.push(`${m.code} is ${m.value.toFixed(0)}% (${m.delta_7d > 0 ? '+' : ''}${m.delta_7d.toFixed(0)} over 7 days).`);
    }
    if (input.waste.entries > 0) bullets.push(`${input.waste.entries} waste entr(ies) costing ₹${input.waste.cost.toFixed(2)}.`);
    if (input.shipments.failed > 0) bullets.push(`${input.shipments.failed} shipment(s) failed or went RTO.`);
    if (input.low_stock.length > 0) bullets.push(`${input.low_stock.length} ingredient(s) below minimum.`);

    const actions: string[] = [];
    if (input.pending.approvals > 0) actions.push(`Clear ${input.pending.approvals} waiting approval(s).`);
    if (input.pending.blockers > 0) actions.push(`Unblock ${input.pending.blockers} task(s).`);
    if (input.shipments.failed > 0) actions.push('Re-run the failed shipments from the Shipments queue.');

    return {
      headline: `${input.business_date}: ${input.sales.orders} orders, ${input.pending.approvals} approvals waiting`,
      bullets: bullets.slice(0, 6),
      actions: actions.slice(0, 3),
      provider: this.name, model: null,
      latency_ms: Date.now() - started,
    };
  }
}
```

- [ ] Create `backend/src/ai/anthropic.provider.ts`. **The call shape below is the contract — do not substitute a remembered one.** No `budget_tokens` (400 on Opus 5), no assistant prefill (400), `thinking: adaptive`, effort inside `output_config`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { SettingsService } from '../settings/settings.service';
import { HeuristicProvider } from './heuristic.provider';
import { evidenceAssistPrompt, EVIDENCE_ASSIST_SYSTEM } from './evidence-assist/evidence-assist.prompt';
import { morningBriefPrompt, MORNING_BRIEF_SYSTEM } from './morning-brief/morning-brief.prompt';
import type {
  AiProviderPort, EvidenceAssistInput, EvidenceAssistResult,
  MorningBriefInput, MorningBriefResult,
} from './ai.types';

const AssistSchema = z.object({
  verdict: z.enum(['approve', 'reject', 'unsure']),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).min(1).max(4),
});

const BriefSchema = z.object({
  headline: z.string(),
  bullets: z.array(z.string()).min(3).max(6),
  actions: z.array(z.string()).max(3),
});

@Injectable()
export class AnthropicProvider implements AiProviderPort {
  readonly name = 'anthropic' as const;
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly settings: SettingsService,
    private readonly heuristic: HeuristicProvider,
  ) {
    // Zero-arg constructor resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN /
    // an `ant auth login` profile. Absent credentials are a supported state
    // (decision 2), so construction never throws — the fallback carries it.
    this.client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  }

  async reviewEvidence(input: EvidenceAssistInput): Promise<EvidenceAssistResult> {
    if (!this.client) return this.heuristic.reviewEvidence(input);
    const started = Date.now();
    const cfg = await this.settings.get('ai');
    try {
      const response = await this.client.messages.parse({
        model: cfg.model,
        max_tokens: 2048,
        system: EVIDENCE_ASSIST_SYSTEM,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low', format: zodOutputFormat(AssistSchema) },
        messages: [{ role: 'user', content: evidenceAssistPrompt(input) }],
      });
      // `stop_details` is populated only on a refusal — always guard first.
      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        this.logger.warn(
          `Evidence assist fell back to heuristic (stop_reason=${response.stop_reason}).`,
        );
        return this.heuristic.reviewEvidence(input);
      }
      const parsed = response.parsed_output;
      return {
        verdict: parsed.verdict,
        confidence: parsed.confidence,
        reasons: parsed.reasons,
        provider: this.name,
        model: cfg.model,
        latency_ms: Date.now() - started,
      };
    } catch (err) {
      // Most-specific-first, and APIConnectionError before APIError (it is a
      // subclass in the TS SDK). Every branch degrades rather than throws:
      // an assist is advisory, and a 429 must never break the evidence board.
      if (err instanceof Anthropic.RateLimitError) this.logger.warn('Anthropic rate limited; using heuristic.');
      else if (err instanceof Anthropic.APIConnectionError) this.logger.warn('Anthropic unreachable; using heuristic.');
      else if (err instanceof Anthropic.APIError) this.logger.error(`Anthropic error ${err.status}; using heuristic.`);
      else throw err;
      return this.heuristic.reviewEvidence(input);
    }
  }

  async writeMorningBrief(input: MorningBriefInput): Promise<MorningBriefResult> {
    // Same shape, `effort: 'medium'`, `max_tokens: 4096`, BriefSchema, and the
    // identical refusal + error-chain fallback to `heuristic.writeMorningBrief`.
  }
}
```

- [ ] Create `backend/src/ai/ai-provider.resolver.ts` — resolved per call, never at boot (the `ShippingProviderResolver` shape):

```ts
@Injectable()
export class AiProviderResolver {
  constructor(
    private readonly settings: SettingsService,
    private readonly anthropic: AnthropicProvider,
    private readonly heuristic: HeuristicProvider,
  ) {}

  /** Reads `SystemSetting['ai'].provider` on every call so an operator can flip it live. */
  async get(): Promise<AiProviderPort> {
    const cfg = await this.settings.get('ai');
    return cfg.provider === 'anthropic' ? this.anthropic : this.heuristic;
  }
}
```

- [ ] Create the two prompt files as pure functions returning strings. `EVIDENCE_ASSIST_SYSTEM` must state the boundary in the prompt as well as in code: *"You are assisting a human reviewer. You never approve or reject anything — a person does. Return a suggestion with concrete reasons drawn only from the supplied fields. If the evidence does not let you judge, return `unsure`; that is a useful answer, not a failure."*
- [ ] Add to `backend/src/config/env.validation.ts`: `@IsOptional() @IsString() ANTHROPIC_API_KEY?: string;` — **not** in the production-required list (decision 2). Add the same, commented as optional, to `backend/.env.example`.
- [ ] Create `backend/src/ai/ai-boundaries.spec.ts` — the SPEC §1.2 guard, a real test not a comment:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = ['approval_status', 'readiness_value', 'current_value', 'base_price', '.update(', '.upsert('];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith('.ts') && !entry.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('AI boundary (SPEC §1.2 — AI never approves, scores or prices)', () => {
  // `evidence-assist.service.ts` writes EvidenceReviewSuggestion via `.create(`,
  // which is deliberately absent from FORBIDDEN. Anything that could mutate a
  // decision is not.
  it.each(sourceFiles(join(__dirname)))('%s writes no decision', (file) => {
    const src = readFileSync(file, 'utf8');
    for (const needle of FORBIDDEN) expect(src).not.toContain(needle);
  });
});
```

- [ ] Specs: `heuristic.provider.spec.ts` — bridge evidence with a real note suggests `approve`; note-only with no text suggests `reject`; two prior rejections push a borderline case to `reject`; confidence is never 0 or 1; the same input twice gives byte-identical output minus `latency_ms`. `anthropic.provider.spec.ts` — with `ANTHROPIC_API_KEY` unset the client is null and every call lands on the heuristic; with a stubbed client, a `refusal` stop reason falls back; a thrown `Anthropic.RateLimitError` falls back; a valid `parsed_output` is returned verbatim. `ai-provider.resolver.spec.ts` — the setting selects the provider and is re-read per call.
- [ ] Register wave 1's module in `backend/src/app.module.ts`: add `AiModule` to `imports`. **No other wave-1 task edits this file.**
- [ ] `cd backend && npx jest src/ai --silent && npx tsc --noEmit -p tsconfig.build.json`
- [ ] `git commit -m "feat(p6-02): AI provider port with Anthropic + deterministic heuristic, resolver, boundary test" -- backend/src/ai backend/src/config backend/.env.example backend/src/app.module.ts backend/package.json backend/package-lock.json`

---

### Task 3: RUN-06 — one lock registry, an unlock check, the stock reconciliation job, and R2 hygiene

**Files:**
- Modify: `backend/src/common/utils/advisory-lock.ts` + `.spec.ts`, `backend/src/loyalty/loyalty.cron.ts` + `.spec.ts`, `backend/src/events/event-holds.cron.ts` + `.spec.ts`, `backend/src/readiness/readiness.cron.ts`, `backend/src/inventory/inventory.module.ts`, `backend/src/storage/storage.service.ts` + `.spec.ts`, `backend/src/storage/storage.module.ts`, `CLOUDFLARE-SETUP.md`
- Create: `backend/src/inventory/stock-reconciliation.cron.ts` + `.spec.ts`, `backend/src/storage/orphan-sweep.cron.ts` + `.spec.ts`

- [ ] Rewrite the registry and the unlock path in `backend/src/common/utils/advisory-lock.ts`:

```ts
/**
 * Stable lock ids — never reuse a number for a different job.
 *
 * One 64-bit key space for the whole database, blocked by the phase that
 * introduced the job: `3_1xx_xxx` P3, `5_7xx_xxx` P5a, `6_35x_xxx` P6.
 * (The pre-P6 comment reserved the "next" block for RUN-06; P5a took it first,
 * so the convention is recorded as it actually shipped.)
 */
export const ADVISORY_LOCK = {
  READINESS_SNAPSHOT: 3_100_001,     // P3 — readiness.cron.ts
  LOYALTY_EXPIRY: 5_700_101,         // P5a — loyalty.cron.ts (was inline)
  BOOKING_HOLD_SWEEP: 5_700_102,     // P5a — event-holds.cron.ts (was inline)
  STOCK_RECONCILIATION: 6_350_001,   // P6 — inventory/stock-reconciliation.cron.ts
  DAILY_CLOSE: 6_350_002,            // P6 — daily-close/daily-close.cron.ts
  MORNING_BRIEF: 6_350_003,          // P6 — ai/morning-brief/morning-brief.cron.ts
  STAFF_NUDGE_SWEEP: 6_350_004,      // P6 — notifications/staff-nudge.cron.ts
  R2_ORPHAN_SWEEP: 6_350_005,        // P6 — storage/orphan-sweep.cron.ts
} as const;
```

- [ ] In the same file, keep the session-scoped `pg_try_advisory_lock` (decision 15) but **check the unlock**. Replace the `finally` body:

```ts
  } finally {
    // `pg_advisory_unlock` returns false when this session does not hold the
    // lock — which is exactly what a pooled connection swap looks like, and
    // which wedges the id until the connection is recycled. Ignoring the
    // result (the pre-P6 behaviour) makes that failure invisible; a job that
    // silently stops running is the worst outcome for a nightly.
    const unlocked = (await prisma.$queryRaw(
      Prisma.sql`SELECT pg_advisory_unlock(${key}::bigint) AS released`,
    )) as { released: boolean }[] | null | undefined;
    if (!unlocked?.[0]?.released) {
      logger?.error(
        `Advisory lock ${key} could not be released by this session — it may be ` +
          `held until the pooled connection is recycled. If this recurs, the job ` +
          `must move to pg_try_advisory_xact_lock inside an interactive transaction.`,
      );
    }
  }
```
  `withAdvisoryLock` gains an optional fourth parameter `logger?: { error(msg: string): void }` so a cron passes its own `Logger` and the helper keeps zero Nest dependencies. Note the statement changes from `$executeRaw` to `$queryRaw` because it now reads a value — update `AdvisoryLockClient` accordingly and keep `$executeRaw` on the type only if something else needs it.
- [ ] Move `LOYALTY_EXPIRY_LOCK_ID` and `BOOKING_HOLD_SWEEP_LOCK_ID` into `ADVISORY_LOCK`, keeping `export const LOYALTY_EXPIRY_LOCK_ID = ADVISORY_LOCK.LOYALTY_EXPIRY;` in place so no import breaks. **Three existing spec assertions require these ids to be absent from `ADVISORY_LOCK`** (in `loyalty.cron.spec.ts`, `event-holds.cron.spec.ts` and `advisory-lock.spec.ts`) — invert them to assert presence and uniqueness instead. Add a spec case asserting every value in `ADVISORY_LOCK` is distinct.
- [ ] Create `backend/src/inventory/stock-reconciliation.cron.ts` — SPEC §3.4's named job, RUN-06's first clause:

```ts
@Injectable()
export class StockReconciliationCron {
  private readonly logger = new Logger(StockReconciliationCron.name);
  private static readonly TOLERANCE = 0.0001;   // matches Decimal(14,4)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly node: NodeService,
  ) {}

  @Cron('30 2 * * *', { timeZone: DEFAULT_NODE_TIMEZONE })
  async reconcile(): Promise<void> {
    await withAdvisoryLock(this.prisma, ADVISORY_LOCK.STOCK_RECONCILIATION, async () => {
      const nodeId = await this.node.currentId();
      // One grouped read instead of N queries: Σ StockMovement.quantity per
      // (ingredient, zone) is the ledger; IngredientStock.current_quantity is
      // the cache. SPEC §3.4 wants the drift, not a repair.
      const sums = await this.prisma.stockMovement.groupBy({
        by: ['ingredient_id', 'zone_id'],
        _sum: { quantity: true },
      });
      const stocks = await this.prisma.ingredientStock.findMany({
        select: { ingredient_id: true, zone_id: true, current_quantity: true },
      });
      const ledger = new Map(sums.map((s) => [`${s.ingredient_id}:${s.zone_id}`, Number(s._sum.quantity ?? 0)]));

      let drifted = 0;
      for (const stock of stocks) {
        const key = `${stock.ingredient_id}:${stock.zone_id}`;
        const expected = ledger.get(key) ?? 0;
        const actual = Number(stock.current_quantity);
        const delta = actual - expected;
        if (Math.abs(delta) <= StockReconciliationCron.TOLERANCE) continue;
        drifted += 1;
        // Recorded, never auto-corrected: a silent write here would destroy the
        // only evidence of whichever code path is losing movements.
        await this.prisma.$transaction((tx) =>
          this.audit.record(tx, {
            entity_type: 'ingredient_stock',
            entity_id: `${stock.ingredient_id}:${stock.zone_id}`,
            action: 'stock.reconciliation_mismatch',
            node_id: nodeId,
            ...AuditService.user(null),
            before: { current_quantity: actual },
            after: { movement_sum: expected, delta },
          }),
        );
      }
      this.logger.log(`Reconciled ${stocks.length} stock rows; ${drifted} drifted`);
    }, this.logger);
  }
}
```
  Register it in `inventory.module.ts` `providers` (no `app.module.ts` change — `InventoryModule` is already imported).
- [ ] Add to `backend/src/storage/storage.service.ts`, keeping the existing MIME/size guard untouched:

```ts
  /** Lists every key under a prefix, following the S3 continuation token. */
  async listKeys(prefix: string): Promise<{ key: string; lastModified: Date | null }[]> { /* ListObjectsV2Command loop */ }

  /** Deletes up to 1000 keys per call (the S3 batch limit). Used only by the orphan sweep. */
  async deleteKeys(keys: string[]): Promise<number> { /* DeleteObjectsCommand in chunks of 1000 */ }
```
  Import `ListObjectsV2Command` and `DeleteObjectsCommand` from `@aws-sdk/client-s3` (already a dependency at `^3.1013.0`).
- [ ] Create `backend/src/storage/orphan-sweep.cron.ts` — weekly, under `ADVISORY_LOCK.R2_ORPHAN_SWEEP`, `@Cron('0 4 * * 0', { timeZone: DEFAULT_NODE_TIMEZONE })` (an hour after the existing `NotificationsCleanupCron` at `0 3 * * 0` so the two never overlap). It:
  1. lists `evidence/`, `exports/` and product-media prefixes;
  2. loads the referenced keys — `Evidence.url`, `ExportRecord.r2_key`, `ProductMedia.url`, `Asset.url`, `Conversation.avatar_key`;
  3. **skips anything modified in the last 48 hours** — a presigned PUT completes before its database row is written, and deleting inside that window would destroy live uploads;
  4. deletes the remainder and writes one `AuditEvent(entity_type: 'storage', action: 'storage.orphan_swept', after: { prefix, deleted, sample_keys })` per prefix.
  **`DRY_RUN` guard:** when `SystemSetting['maintenance_mode']` is true the sweep logs what it *would* delete and deletes nothing. Deleting customer evidence on a bad match is unrecoverable; the first production run should be observed.
- [ ] Specs: the reconciliation cron writes an audit row only past tolerance, writes none when the ledger matches, and short-circuits with zero reads when the lock is held. The orphan sweep never deletes a referenced key, never deletes a key newer than 48 h, chunks deletes at 1000, and deletes nothing in maintenance mode. `advisory-lock.spec.ts` gains: unlock returning `false` logs an error and does not throw; the lock ids are unique.
- [ ] Append to `CLOUDFLARE-SETUP.md` a short "R2 lifecycle (RUN-06)" section: the `exports/` prefix gets a 30-day expiry lifecycle rule, set in the Cloudflare dashboard under **R2 → bucket → Settings → Object lifecycle rules** (there is no API call in this repo that sets it), with the exact rule name `expire-exports-30d`, prefix `exports/`, and a note that `evidence/` and product media are **never** lifecycled — the orphan sweep is the only thing that removes them. **Do not touch the two unrelated scratch lines already at the end of that file in the working tree.**
- [ ] `cd backend && npx jest src/common/utils src/inventory src/storage src/loyalty src/events src/readiness --silent`
- [ ] `git commit -m "feat(p6-03): one advisory-lock registry with unlock check, stock reconciliation cron, R2 orphan sweep" -- backend/src/common/utils backend/src/inventory backend/src/storage backend/src/loyalty backend/src/events backend/src/readiness CLOUDFLARE-SETUP.md`

---

### Task 4: `NotificationDispatcher` — three channels, one cooldown, quiet hours, and the end of `is_email_sent`

**Files:**
- Create: `backend/src/notifications/{notification-dispatcher.service.ts,notification-dispatcher.service.spec.ts,notification-templates.ts,notification-templates.spec.ts,quiet-hours.ts,quiet-hours.spec.ts}`
- Modify: `backend/src/notifications/{notifications.service.ts,notifications.processor.ts,notifications.module.ts}` + their specs, `frontend/lib/types/notifications.ts`

- [ ] Create `backend/src/notifications/quiet-hours.ts` — a pure function, unit-testable without a clock:

```ts
import { formatInNodeTz } from '../common/utils/node-time';

/**
 * True when `at`, read in `timeZone`, falls inside the configured window.
 * Windows wrap midnight (`21:00`–`07:00`), so the comparison is on
 * minutes-of-day with a wrap branch rather than on Date ordering.
 */
export function isQuietHour(
  at: Date,
  timeZone: string,
  window: { start: string; end: string },
): boolean {
  const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const nowHhmm = formatInNodeTz(at, timeZone, { hour: '2-digit', minute: '2-digit', hour12: false });
  const now = minutes(nowHhmm);
  const start = minutes(window.start);
  const end = minutes(window.end);
  return start <= end ? now >= start && now < end : now >= start || now < end;
}
```
  Confirm `formatInNodeTz`'s exact signature at `backend/src/common/utils/node-time.ts:129` before writing this and match it; if it does not take an options bag, derive `hh:mm` from `nodeDayKey` + `tzOffsetMinutes` instead. **Do not change `node-time.ts` — it has other owners.**

- [ ] Create `backend/src/notifications/notification-templates.ts` — the WhatsApp template registry. Meta requires each template to be pre-approved by name with positional body parameters, so the mapping lives in one reviewed file:

```ts
import { NotificationType } from '@prisma/client';

export interface WhatsAppTemplateSpec {
  /** The name registered in the Meta WhatsApp Manager. */
  name: string;
  /** Positional body params, in template order. Meta rejects a count mismatch. */
  params: (ctx: Record<string, string | number>) => string[];
}

/**
 * `null` means "this type is in-app (and possibly email) only" — the dispatcher
 * skips WhatsApp for it without a special case at each call site.
 *
 * Every name below must exist and be APPROVED in the Meta WhatsApp Manager
 * before `SystemSetting['notifications'].whatsapp_enabled` is flipped on, which
 * is why the setting seeds `false`. An unapproved name fails the send with a
 * Meta 400, which `WhatsAppService.sendTemplate` throws and the dispatcher
 * isolates — a bad template degrades to in-app, it does not break the sweep.
 */
export const WHATSAPP_TEMPLATES: Partial<Record<NotificationType, WhatsAppTemplateSpec>> = {
  [NotificationType.approval_pending]: {
    name: 'staff_approval_waiting',
    params: (c) => [String(c.subject), String(c.hours)],
  },
  [NotificationType.task_blocked]: {
    name: 'staff_task_blocked',
    params: (c) => [String(c.subject), String(c.reason)],
  },
  [NotificationType.low_stock]: {
    name: 'staff_low_stock',
    params: (c) => [String(c.subject), String(c.onHand), String(c.minimum)],
  },
  [NotificationType.shipment_failed]: {
    name: 'staff_shipment_failed',
    params: (c) => [String(c.subject), String(c.status)],
  },
  [NotificationType.morning_brief]: {
    name: 'staff_morning_brief',
    params: (c) => [String(c.headline)],
  },
};
```

- [ ] Create `backend/src/notifications/notification-dispatcher.service.ts`:

```ts
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly node: NodeService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  /**
   * The one way P6 sends anything to a staff member (RUN-01).
   *
   * Channel resolution, in order:
   *   in_app   — always. It is a pull surface; suppressing it loses the record.
   *   email    — when the type is in `settings.notifications.email_types`.
   *   whatsapp — when the master switch is on, a template exists for the type,
   *              the user opted in, the user has a phone, and it is not quiet
   *              hours (decision 11).
   *
   * Returns `null` when the cooldown blocks the send, so a caller can count
   * suppressions. The cooldown is checked once for the whole dispatch, not per
   * channel — a nudge is one event however many ways it travels.
   */
  async dispatch(input: {
    user_id: string;
    type: NotificationType;
    title: string;
    body: string;
    link_url?: string;
    reference_id: string;
    reference_type: string;
    /** Substitutions for the WhatsApp template's positional params. */
    template_ctx?: Record<string, string | number>;
  }): Promise<{ id: string; channels: NotificationChannel[] } | null> {
    const cfg = await this.settings.get('notifications');
    const cooldown = cfg.cooldown_hours[input.type as keyof typeof cfg.cooldown_hours] ?? 24;

    if (!(await this.notifications.shouldNotify(input.user_id, input.type, input.reference_id, cooldown))) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.user_id },
      select: { id: true, name: true, email: true, phone: true, whatsapp_opt_in: true, status: true },
    });
    if (!user || user.status !== 'active') return null;

    const channels: NotificationChannel[] = [NotificationChannel.in_app];
    const wantsEmail = cfg.email_types.includes(input.type);
    const template = WHATSAPP_TEMPLATES[input.type];
    const timeZone = await this.node.timezone();
    const quiet = isQuietHour(new Date(), timeZone, cfg.quiet_hours);
    const wantsWhatsApp =
      cfg.whatsapp_enabled && !!template && user.whatsapp_opt_in && !!user.phone && !quiet;

    if (wantsEmail) channels.push(NotificationChannel.email);
    if (wantsWhatsApp) channels.push(NotificationChannel.whatsapp);

    // The row records what was *attempted*. A provider failure below is logged,
    // not un-recorded: "we tried to WhatsApp you and Meta was down" is the fact
    // an operator needs, and a rollback here would re-fire on the next sweep.
    const notification = await this.notifications.create({
      user_id: user.id,
      type: input.type,
      title: input.title,
      body: input.body,
      link_url: input.link_url,
      reference_id: input.reference_id,
      reference_type: input.reference_type,
      channel: channels,
    });

    if (wantsEmail) {
      await this.safely('email', () =>
        this.email.sendHtml(
          { email: user.email, name: user.name },
          `[Konma] ${input.title}`,
          `<p>Hi ${escapeHtml(user.name)},</p><p>${escapeHtml(input.body)}</p>` +
            `<p><a href="${this.email.publicFrontendUrl}${input.link_url ?? ''}">Open Konma Xperience</a></p>`,
          `Hi ${user.name},\n\n${input.body}\n\n${this.email.publicFrontendUrl}${input.link_url ?? ''}`,
        ),
      );
    }

    if (wantsWhatsApp && template) {
      await this.safely('whatsapp', () =>
        this.whatsapp.sendTemplate(user.phone!, template.name, template.params(input.template_ctx ?? {})),
      );
    }

    return { id: notification.id, channels };
  }

  /** `sendTemplate` throws on a Meta error; a nudge must never fail its caller. */
  private async safely(channel: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(
        `${channel} dispatch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
```

- [ ] `NotificationsService.create` — swap the `is_email_sent?: boolean` field on its input type for `channel?: NotificationChannel[]`, and pass it through to `prisma.notification.create`. Nothing else in that method changes; the Pusher emit stays.
- [ ] `notifications.processor.ts` — delete `sendCriticalEmail` (lines 316–361) and both hand-rolled cooldown loops, and route `handleTaskDue`, `handleTaskBlocked`, `handleApprovalPending` and `handleLowStock` through `dispatcher.dispatch(...)`. `handleNewOrder`, `handleOrderReady` and `handleDeliveryUpdate` keep `notifications.create` directly — they are per-event, not per-subject, and have no cooldown semantics to consolidate. This removes the last `is_email_sent` writer.
- [ ] `notifications.module.ts` — `imports: [CustomerAuthModule]` (decision 7), add `NotificationDispatcher` to `providers` and to `exports` (Tasks 8 and 9 inject it).
- [ ] `frontend/lib/types/notifications.ts:44` — delete `is_email_sent: boolean;`, add `channel: ('in_app' | 'email' | 'whatsapp')[];`.
- [ ] Specs — `notification-dispatcher.service.spec.ts`:
  1. a fresh `(user, type, reference)` dispatches and writes `channel: ['in_app']` when nothing else is enabled;
  2. a second dispatch inside the cooldown returns `null` and writes no row;
  3. `email_types` membership adds `email` and calls `EmailService.sendHtml` once;
  4. `whatsapp_enabled: true` + opt-in + phone + outside quiet hours adds `whatsapp` and calls `sendTemplate` with the template's exact positional params;
  5. inside quiet hours the row is still written with `['in_app']` and `sendTemplate` is **not** called;
  6. opt-in false, or `phone: null`, or no template for the type → no WhatsApp, no throw;
  7. `sendTemplate` rejecting is swallowed and the notification row survives;
  8. an inactive user is skipped.
  `quiet-hours.spec.ts` — a wrapping window (`21:00`–`07:00`) is quiet at 23:00 and 03:00, not quiet at 12:00; a non-wrapping window behaves; boundaries are `[start, end)`. `notification-templates.spec.ts` — every key in `WHATSAPP_TEMPLATES` is a real `NotificationType`, and every `params()` returns a non-empty `string[]` for its documented context.
- [ ] `cd backend && npx jest src/notifications --silent && npx tsc --noEmit -p tsconfig.build.json`
- [ ] `git commit -m "feat(p6-04): NotificationDispatcher with WhatsApp templates, quiet hours, unified cooldown; drop is_email_sent" -- backend/src/notifications frontend/lib/types/notifications.ts`

---

### Task 5: Daily close — compute, persist, sign (+ wave-2 `app.module`)

**Files:**
- Create: `backend/src/daily-close/{daily-close.service.ts,daily-close.service.spec.ts,daily-close.controller.ts,daily-close.cron.ts,daily-close.cron.spec.ts,daily-close.module.ts,dto/sign-daily-close.dto.ts}`
- Modify: `backend/src/app.module.ts` (**wave 2's single owner**)

- [ ] `daily-close.service.ts` — the metrics shape is the contract Task 12 renders:

```ts
export interface DailyCloseMetrics {
  business_date: string;                       // YYYY-MM-DD, node-local
  orders: {
    total: number;
    revenue: number;                           // Σ Order.total, tax-inclusive (P5a decision 1)
    by_channel: { channel: OrderChannel; orders: number; revenue: number }[];
    cancelled: number;
    refunded: number;
    refund_amount: number;
  };
  waste: { entries: number; cost: number; by_reason: { reason: string; cost: number }[] };
  batches: { created: number; depleted: number };
  stock_reconciliation: { checked: number; drifted: number; ran_at: string | null };
  shipments: { open: number; failed: number; delivered: number };
}

@Injectable()
export class DailyCloseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly node: NodeService,
  ) {}

  /**
   * Computes the metrics for one node-local business day and upserts the row
   * as `open`. Idempotent: re-running before sign-off refreshes the numbers,
   * re-running after sign-off is a **no-op** — a signed close is frozen
   * (decision 16), which is the whole reason the metrics live in a column.
   */
  async computeAndUpsert(businessDate: Date): Promise<DailyClose> {
    const nodeId = await this.node.currentId();
    const timeZone = await this.node.timezone();
    const { start, end } = nodeDayRange(timeZone, businessDate);

    const existing = await this.prisma.dailyClose.findUnique({
      where: { node_id_business_date: { node_id: nodeId, business_date: startOfUtcDate(businessDate) } },
    });
    if (existing?.status === DailyCloseStatus.signed) return existing;

    const metrics = await this.gather(nodeId, start, end);
    return this.prisma.dailyClose.upsert({
      where: { node_id_business_date: { node_id: nodeId, business_date: startOfUtcDate(businessDate) } },
      create: { node_id: nodeId, business_date: startOfUtcDate(businessDate), metrics: metrics as unknown as Prisma.InputJsonValue },
      update: { metrics: metrics as unknown as Prisma.InputJsonValue },
    });
  }

  /**
   * RUN-02 sign-off. Two gates, both required: `MANAGE_OPS` at the controller,
   * and membership of `SystemSetting['daily_close'].signer_role_codes` here —
   * the permission says "may run operations", the setting says "is accountable
   * for the day", and SPEC names the second, not the first.
   */
  async sign(businessDate: Date, userId: string, notes: string | null): Promise<DailyClose> {
    const cfg = await this.settings.get('daily_close');
    const nodeId = await this.node.currentId();
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { role: { select: { code: true } } },
    });
    if (!user || !cfg.signer_role_codes.includes(user.role.code)) {
      throw new ForbiddenException(
        `Only ${cfg.signer_role_codes.join(' or ')} may sign the daily close`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const close = await tx.dailyClose.findUnique({
        where: { node_id_business_date: { node_id: nodeId, business_date: startOfUtcDate(businessDate) } },
      });
      if (!close) throw new NotFoundException(`No daily close computed for ${businessDate.toISOString().slice(0, 10)}`);
      if (close.status === DailyCloseStatus.signed) {
        throw new ConflictException('This day is already signed');
      }

      const signed = await tx.dailyClose.update({
        where: { id: close.id },
        data: { status: DailyCloseStatus.signed, signed_by: userId, signed_at: new Date(), notes },
      });

      // RUN-02 says the sign-off *is* an AuditEvent. In the same transaction,
      // carrying the frozen metrics, so the audit row is self-contained even if
      // the DailyClose row is later archived.
      await this.audit.record(tx, {
        entity_type: 'daily_close',
        entity_id: signed.id,
        action: 'daily_close.signed',
        node_id: nodeId,
        ...AuditService.user(userId),
        before: { status: close.status },
        after: { status: signed.status, business_date: signed.business_date, notes, metrics: signed.metrics },
      });

      return signed;
    });
  }

  /** `GET /daily-close?from=&to=` and `GET /daily-close/:date`. */
  async list(from: Date, to: Date) { /* paginated by business_date desc */ }
  async findByDate(businessDate: Date) { /* single row, 404 when absent */ }

  private async gather(nodeId: string, start: Date, end: Date): Promise<DailyCloseMetrics> {
    // One Promise.all of grouped aggregates:
    //   order.groupBy({ by: ['channel'], _count, _sum: { total } })  filtered to
    //     created_at in [start, end) and status notIn [cancelled, refunded]
    //   order.count for cancelled and for refunded, refund._sum.amount
    //   wasteLog.groupBy({ by: ['reason'], _sum: { cost_impact } })
    //   prepBatch.count created, prepBatch.count depleted
    //   auditEvent.count where action = 'stock.reconciliation_mismatch' in window
    //     plus ingredientStock.count for the "checked" denominator
    //   shipment.groupBy({ by: ['status'] }) folded into open/failed/delivered
    // Every window filter uses `nodeDayRange`, never `new Date(Date.now() - n)`.
  }
}
```

- [ ] `daily-close.controller.ts`:

```ts
@Controller('daily-close')
export class DailyCloseController {
  @Get()            @RequiresPermission(Permission.MANAGE_OPS) list(@Query() q: ListDailyCloseDto) {}
  @Get(':date')     @RequiresPermission(Permission.MANAGE_OPS) findOne(@Param('date') date: string) {}
  @Post(':date/recompute') @RequiresPermission(Permission.MANAGE_OPS) recompute(@Param('date') date: string) {}
  @Post(':date/sign')      @RequiresPermission(Permission.MANAGE_OPS) sign(@Param('date') date: string, @Body() dto: SignDailyCloseDto, @Req() req) {}
}
```
  `:date` is `YYYY-MM-DD`; reject anything else with a 400 before it reaches the service.
- [ ] `daily-close.cron.ts` — `@Cron('45 0 * * *', { timeZone: DEFAULT_NODE_TIMEZONE })` under `ADVISORY_LOCK.DAILY_CLOSE`, computing **yesterday** in node time, then dispatching one `daily_close_due` notification per `signer_role_codes` holder through `NotificationDispatcher` with `reference_id` = the close id.
- [ ] Specs: metrics for a day with orders across three channels sum per channel and in total; a signed row is not recomputed; `sign` by a non-signer role throws `ForbiddenException`; signing twice throws `ConflictException`; the audit row lands in the same transaction as the status flip (assert both on the same `tx` double); the cron computes yesterday, not today, and short-circuits when the lock is held.
- [ ] Register wave 2's modules in `backend/src/app.module.ts` — `DailyCloseModule`, `FoodCostModule`. **No other wave-2 task edits this file**; run this step on the merged wave branch so both modules exist.
- [ ] `cd backend && npx jest src/daily-close --silent`
- [ ] `git commit -m "feat(p6-05): daily close compute/persist/sign with AuditEvent, nightly job" -- backend/src/daily-close backend/src/app.module.ts`

---

### Task 6: Theoretical vs actual food cost

**Files:**
- Create: `backend/src/food-cost/{food-cost.service.ts,food-cost.service.spec.ts,food-cost.controller.ts,food-cost.module.ts,ingredient-cost.ts,ingredient-cost.spec.ts}`

- [ ] `ingredient-cost.ts` — the valuation rule in one place (decision 18), extracted from the pattern at `waste.service.ts:118-145`:

```ts
export interface IngredientValuation {
  /** Cost of `qty` of `ingredient` expressed in `ingredient.base_unit`. */
  cost: number;
  /** True when no VendorPrice exists, or no conversion path to its unit. */
  unpriced: boolean;
}

/**
 * An ingredient's unit cost is the most recent `VendorPrice` — `Ingredient` has
 * no cost column. The price is quoted in the vendor's unit, so the quantity is
 * converted into that unit before multiplying.
 *
 * An unpriceable line returns `cost: 0` **and** `unpriced: true`. The caller
 * must surface the name; a silent zero turns a variance report into a lie
 * (decision 18).
 */
export async function valueQuantity(
  prisma: PrismaService,
  ingredient: { id: string; base_unit: string },
  qtyInBaseUnit: number,
  priceCache: Map<string, { price: number; unit: string } | null>,
): Promise<IngredientValuation> {
  let price = priceCache.get(ingredient.id);
  if (price === undefined) {
    const row = await prisma.vendorPrice.findFirst({
      where: { ingredient_id: ingredient.id },
      orderBy: { effective_date: 'desc' },
      select: { price: true, unit: true },
    });
    price = row ? { price: Number(row.price), unit: row.unit } : null;
    priceCache.set(ingredient.id, price);
  }
  if (!price) return { cost: 0, unpriced: true };

  const converted = await convertUnit(qtyInBaseUnit, ingredient.base_unit, price.unit, prisma);
  if (converted === null) return { cost: 0, unpriced: true };
  return { cost: converted * price.price, unpriced: false };
}
```

- [ ] `food-cost.service.ts`:

```ts
export interface FoodCostReport {
  from: string; to: string;                    // YYYY-MM-DD, node-local
  theoretical: { total: number; by_product: { product_id: string; name: string; quantity: number; unit_cost: number; cost: number }[] };
  actual:      { total: number; by_movement_type: { movement_type: MovementType; cost: number }[] };
  variance:    { amount: number; percent: number };
  revenue: number;
  theoretical_pct_of_revenue: number;
  actual_pct_of_revenue: number;
  /** Ingredients that could not be valued — see decision 18. */
  unpriced_ingredients: { id: string; name: string }[];
}

@Injectable()
export class FoodCostService {
  /**
   * RUN-03. Two independent readings of the same period:
   *
   *   theoretical — what the BOM says the food sold *should* have cost:
   *                 Σ OrderItem.quantity × Product.recipe.computed_cost, over
   *                 orders not cancelled/refunded. `computed_cost` is already
   *                 the recursive BOM roll-up maintained by RecipesService, so
   *                 this does not re-explode RecipeLine per order line.
   *   actual      — what actually left the store room: Σ |StockMovement.quantity|
   *                 over the consuming types, valued through `valueQuantity`.
   *
   * variance = actual − theoretical. Positive means more went out than the
   * recipes account for: over-portioning, unlogged waste, or theft. Negative
   * usually means a recipe's `computed_cost` is stale, which is itself the
   * finding BI wants.
   */
  async report(from: Date, to: Date): Promise<FoodCostReport> { /* … */ }

  private static readonly CONSUMING: MovementType[] = [
    MovementType.order_deducted,
    MovementType.prep_deducted,
    MovementType.waste,
    MovementType.supply_usage,
  ];
}
```
  Notes the implementer must honour:
  - Window with `nodeDateRange(timeZone, from, to)` — never `Date.now()` arithmetic.
  - `StockMovement.quantity` is **signed**; consumption is negative. Use `Math.abs`.
  - `movement_type: adjustment` is deliberately excluded from `actual`: an adjustment is the correction *for* drift, and including it would net the variance to zero — the reconciliation job (Task 3) is where adjustments are accounted for.
  - Build one `priceCache` per report and share it across every movement, or the query count is O(movements).
  - Percentages divide by `revenue` (Σ `Order.total` for the same window, tax-inclusive per P5a decision 1). Guard `revenue === 0` → `0`, never `NaN` or `Infinity`.
- [ ] `food-cost.controller.ts` — `@Controller('analytics/food-cost')` with `@Get()` under `@RequiresPermission(Permission.MANAGE_KPIS)`, matching every other `analytics.controller.ts` route (decision 20). Query: `from`, `to` (`YYYY-MM-DD`, default: the last 30 node-local days), validated by a DTO. Nest allows a second controller on the `analytics` prefix path — do **not** edit `analytics.controller.ts`, which Task 13 does not own either.
- [ ] Specs: two order lines of a product whose recipe costs ₹40 give a theoretical of ₹80; a `waste` movement of 2 kg of an ingredient priced ₹100/kg contributes ₹200 to actual; an ingredient with no `VendorPrice` contributes ₹0 and appears in `unpriced_ingredients`; an ingredient whose base unit has no conversion to the price unit does the same; `adjustment` movements are excluded; `variance.percent` is 0 when theoretical is 0 rather than `Infinity`; the window is node-local (a movement at 23:30 IST on the `to` date is inside).
- [ ] `cd backend && npx jest src/food-cost --silent`
- [ ] `git commit -m "feat(p6-06): theoretical vs actual food cost with vendor-price valuation and unpriced reporting" -- backend/src/food-cost`

---

### Task 7: AI evidence-review assist — suggestion only

**Files:**
- Create: `backend/src/ai/evidence-assist/{evidence-assist.service.ts,evidence-assist.service.spec.ts,evidence-assist.controller.ts,evidence-assist.prompt.ts,dto/request-assist.dto.ts}`

Owns `src/ai/evidence-assist/**` only. Task 2 froze `src/ai/*.ts` at the end of wave 1.

- [ ] `evidence-assist.service.ts`:

```ts
@Injectable()
export class EvidenceAssistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: AiProviderResolver,
    private readonly settings: SettingsService,
    private readonly node: NodeService,
  ) {}

  /**
   * RUN-05 — a suggestion for the human reviewing this evidence.
   *
   * This method reads `Evidence` and writes `EvidenceReviewSuggestion`. It does
   * not, and must never, touch `Evidence.approval_status`, `Task.valid` or any
   * meter: `EvidenceService.approveEvidence` / `rejectEvidence` remain the only
   * writers of a decision (SPEC §1.2, guarded by `ai-boundaries.spec.ts`).
   */
  async suggest(evidenceId: string): Promise<EvidenceReviewSuggestion> {
    const cfg = await this.settings.get('ai');
    if (!cfg.evidence_assist_enabled) throw new BadRequestException('Evidence assist is disabled');

    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: {
        id: true, type: true, notes: true, url: true, source: true,
        bridge_event: true, approval_status: true,
        uploader: { select: { name: true } },
        task: { select: { id: true, title: true, description: true } },
      },
    });
    if (!evidence) throw new NotFoundException(`Evidence ${evidenceId} not found`);
    // A decided piece of evidence has nothing left to suggest about, and
    // offering one invites a reviewer to "confirm" a decision already made.
    if (evidence.approval_status !== ApprovalStatus.pending) {
      throw new BadRequestException('This evidence has already been reviewed');
    }

    const priorRejections = await this.prisma.evidence.count({
      where: { task_id: evidence.task.id, approval_status: ApprovalStatus.rejected },
    });

    const provider = await this.resolver.get();
    const result = await provider.reviewEvidence({
      evidence_id: evidence.id,
      task_title: evidence.task.title,
      task_description: evidence.task.description,
      evidence_type: evidence.type,
      evidence_notes: evidence.notes,
      evidence_url: evidence.url,
      source: evidence.source,
      bridge_event: evidence.bridge_event,
      uploaded_by_name: evidence.uploader.name,
      prior_rejections: priorRejections,
    });

    return this.prisma.evidenceReviewSuggestion.create({
      data: {
        node_id: await this.node.currentId(),
        evidence_id: evidence.id,
        verdict: result.verdict,
        confidence: new Prisma.Decimal(result.confidence.toFixed(3)),
        reasons: result.reasons,
        provider: result.provider,
        model: result.model,
        latency_ms: result.latency_ms,
      },
    });
  }

  /** The newest suggestion for this evidence, or null. Never generates one. */
  async latest(evidenceId: string) {
    return this.prisma.evidenceReviewSuggestion.findFirst({
      where: { evidence_id: evidenceId },
      orderBy: { created_at: 'desc' },
    });
  }
}
```

- [ ] `evidence-assist.controller.ts`:

```ts
@Controller('evidence/:id/review-assist')
export class EvidenceAssistController {
  /** Generates a suggestion. Same permission as reviewing, because only a
   *  reviewer should be able to spend a model call on this. */
  @Post() @RequiresPermission(Permission.APPROVE_EVIDENCE)
  create(@Param('id', ParseUUIDPipe) id: string) { return this.assist.suggest(id); }

  @Get()  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  latest(@Param('id', ParseUUIDPipe) id: string) { return this.assist.latest(id); }
}
```
  **Rate limit it.** Add `@Throttle({ short: { limit: 10, ttl: 60_000 } })` on the `@Post` — the named throttlers were registered in P1b, and an unthrottled route that spends money per request is a defect.
- [ ] Specs: a pending piece of evidence produces and persists a suggestion whose `provider` matches the resolver's choice; already-approved evidence throws; `evidence_assist_enabled: false` throws; the resolver's provider is called exactly once per request; `prior_rejections` counts only rejected evidence on the same task; **`Evidence.approval_status` is never written** (assert `prisma.evidence.update` is not called on the double).
- [ ] `cd backend && npx jest src/ai --silent`
- [ ] `git commit -m "feat(p6-07): AI evidence-review assist — persisted suggestions, never a decision" -- backend/src/ai/evidence-assist`

---

### Task 8: The four staff nudges — approvals waiting, blockers, low stock, failed shipments

**Files:**
- Create: `backend/src/notifications/{staff-nudge.cron.ts,staff-nudge.cron.spec.ts}`
- Modify: `backend/src/notifications/notifications.module.ts` (add the provider only — Task 4 owns the rest of that file and lands first in the same wave order)

RUN-01's four nudges. Two of them (`approval_pending`, `low_stock`) already reach in-app through `NotificationsCron` → QStash → `NotificationsProcessor`; Task 4 put those on the dispatcher, so they gain WhatsApp for free. This task adds the **two that have no sweep at all** and gives all four one cron with one lock.

- [ ] `staff-nudge.cron.ts` — `@Cron('0 * * * *', { timeZone: DEFAULT_NODE_TIMEZONE })` under `ADVISORY_LOCK.STAFF_NUDGE_SWEEP`:

```ts
@Injectable()
export class StaffNudgeCron {
  private readonly logger = new Logger(StaffNudgeCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 * * * *', { timeZone: DEFAULT_NODE_TIMEZONE })
  async sweep(): Promise<void> {
    await withAdvisoryLock(this.prisma, ADVISORY_LOCK.STAFF_NUDGE_SWEEP, async () => {
      // Independent sweeps, isolated from each other: a failing shipment query
      // must not stop the blocker nudges. `allSettled`, then log the rejects.
      const results = await Promise.allSettled([
        this.nudgeBlockedTasks(),
        this.nudgeFailedShipments(),
      ]);
      for (const r of results) {
        if (r.status === 'rejected') this.logger.error(`nudge sweep leg failed: ${String(r.reason)}`);
      }
    }, this.logger);
  }

  /**
   * A task that has been `blocked` for more than the cooldown is nudged to its
   * owner and to every `FOUNDER_ADMIN`. `task.blocked` already fires as a
   * domain event on the *transition*; this sweep is about tasks that stayed
   * blocked, which no event describes.
   */
  private async nudgeBlockedTasks(): Promise<void> {
    const blocked = await this.prisma.task.findMany({
      where: { status: TaskStatus.blocked, owner_user_id: { not: null } },
      select: { id: true, title: true, blocked_reason: true, owner_user_id: true, updated_at: true },
    });
    for (const task of blocked) {
      await this.dispatcher.dispatch({
        user_id: task.owner_user_id!,
        type: NotificationType.task_blocked,
        title: `Still blocked: ${task.title}`,
        body: task.blocked_reason ?? 'This task has been blocked with no reason recorded.',
        link_url: `/tasks/${task.id}`,
        reference_id: task.id,
        reference_type: 'task',
        template_ctx: { subject: task.title, reason: task.blocked_reason ?? 'no reason recorded' },
      });
    }
  }

  /**
   * RUN-01's fourth nudge, and the one with no prior implementation:
   * `ShipmentStatus.failed` and `.rto` are money already collected against a
   * parcel that is not moving. Goes to every `MANAGE_OPS` holder — the
   * Shipments queue is theirs.
   */
  private async nudgeFailedShipments(): Promise<void> {
    const failed = await this.prisma.shipment.findMany({
      where: { status: { in: [ShipmentStatus.failed, ShipmentStatus.rto] } },
      select: { id: true, status: true, awb: true, order: { select: { order_number: true } } },
    });
    if (failed.length === 0) return;
    const recipients = await this.notifications.getUsersByPermission('MANAGE_OPS');
    for (const shipment of failed) {
      const label = `Order ${shipment.order.order_number}`;
      for (const user of recipients) {
        await this.dispatcher.dispatch({
          user_id: user.id,
          type: NotificationType.shipment_failed,
          title: `Shipment ${shipment.status}: ${label}`,
          body: `AWB ${shipment.awb ?? '(none)'} is ${shipment.status}. Re-book or refund from the Shipments queue.`,
          link_url: '/operations/shipments',
          reference_id: shipment.id,
          reference_type: 'shipment',
          template_ctx: { subject: label, status: shipment.status },
        });
      }
    }
  }
}
```

- [ ] Also emit the nudge on the **transition**, not only on the sweep: in the Shiprocket webhook's status handler, when the new status is `failed` or `rto`, call the same dispatcher path. Do **not** edit `shiprocket-webhook.service.ts` from this task if Task 13 also touches `src/webhooks/` — instead register an `@OnEvent(DomainEvent.SHIPMENT_STATUS_CHANGED)` listener inside `staff-nudge.cron.ts`'s module, which P5a already emits with `{ shipmentId, status }`. Confirm the payload field names in `domain-events.ts` before wiring; the sweep is the safety net either way.
- [ ] Specs: a blocked task nudges its owner once and is suppressed on the second sweep by the cooldown; a task with no owner is skipped; a `failed` shipment nudges every `MANAGE_OPS` holder; a `delivered` shipment nudges nobody; the whole sweep short-circuits when the lock is held; a throwing leg is logged and the other leg still runs.
- [ ] `cd backend && npx jest src/notifications --silent`
- [ ] `git commit -m "feat(p6-08): hourly staff nudge sweep — blocked tasks and failed shipments" -- backend/src/notifications/staff-nudge.cron.ts backend/src/notifications/staff-nudge.cron.spec.ts backend/src/notifications/notifications.module.ts`

---

### Task 9: The morning brief — gather, generate, deliver

**Files:**
- Create: `backend/src/ai/morning-brief/{morning-brief.service.ts,morning-brief.service.spec.ts,morning-brief.controller.ts,morning-brief.cron.ts,morning-brief.cron.spec.ts,morning-brief.prompt.ts}`

Needs Task 2 (provider), Task 4 (dispatcher), Task 5 (`DailyCloseMetrics`) and Task 6 (nothing yet — the brief reports sales and waste from the close, not the food-cost report, so the two stay decoupled).

- [ ] `morning-brief.service.ts`:

```ts
@Injectable()
export class MorningBriefService {
  /**
   * Assembles the `MorningBriefInput` from state that already exists, then asks
   * the resolved provider to write it. Nothing here computes a new number: the
   * sales and waste figures are read from **yesterday's `DailyClose.metrics`**,
   * so the brief and the close can never disagree — which is the failure mode
   * that makes a generated summary untrustworthy.
   */
  async gather(businessDate: Date): Promise<MorningBriefInput> {
    // readiness   — ReadinessMeter.current_value now, minus the ReadinessSnapshot
    //               value 7 days back (@@unique([meter_id, date]) makes this one query)
    // sales/waste — yesterday's DailyClose.metrics; when the close has not been
    //               computed yet, fall back to zeroes and say so in a bullet
    //               rather than recomputing behind the close's back
    // pending     — approval.count(status: pending), task.count(status: blocked),
    //               decision.count(status: proposed, created_at older than 7 days)
    // shipments   — shipment.groupBy status
    // low_stock   — ingredientStock joined to ingredient where current_quantity < min_stock_level
  }

  /** Generates and delivers. Returns what was delivered so the controller can echo it. */
  async generateAndDeliver(businessDate: Date): Promise<MorningBriefResult & { delivered_to: number }> {
    const cfg = await this.settings.get('ai');
    if (!cfg.morning_brief_enabled) throw new BadRequestException('Morning brief is disabled');

    const input = await this.gather(businessDate);
    const provider = await this.resolver.get();
    const brief = await provider.writeMorningBrief(input);

    const leads = await this.prisma.user.findMany({
      where: { status: 'active', role: { code: { in: cfg.morning_brief_role_codes } } },
      select: { id: true },
    });

    const body = [brief.headline, '', ...brief.bullets.map((b) => `• ${b}`),
                  ...(brief.actions.length ? ['', 'Today:', ...brief.actions.map((a) => `→ ${a}`)] : [])]
      .join('\n');

    let delivered = 0;
    for (const lead of leads) {
      // Through the dispatcher (decision 24) so WhatsApp inherits opt-in, quiet
      // hours and the cooldown. `reference_id` is the business date, so a
      // re-run on the same day is suppressed rather than duplicated.
      const sent = await this.dispatcher.dispatch({
        user_id: lead.id,
        type: NotificationType.morning_brief,
        title: brief.headline,
        body,
        link_url: '/dashboard',
        reference_id: input.business_date,
        reference_type: 'morning_brief',
        template_ctx: { headline: brief.headline },
      });
      if (sent) delivered += 1;
    }
    return { ...brief, delivered_to: delivered };
  }

  /** What Mission Control renders: the current user's most recent brief notification. */
  async latestForUser(userId: string) {
    return this.prisma.notification.findFirst({
      where: { user_id: userId, type: NotificationType.morning_brief },
      orderBy: { created_at: 'desc' },
      select: { id: true, title: true, body: true, created_at: true, is_read: true },
    });
  }
}
```

- [ ] `morning-brief.controller.ts` — `@Controller('ai/morning-brief')`: `@Get('latest')` (any authenticated staff member, no extra permission — it returns only their own notification) and `@Post('generate')` under `@RequiresPermission(Permission.MANAGE_SYSTEM)` with the same `short` throttler as Task 7, for a manual re-run.
- [ ] `morning-brief.cron.ts` — `@Cron('0 7 * * *', { timeZone: DEFAULT_NODE_TIMEZONE })` under `ADVISORY_LOCK.MORNING_BRIEF`. 07:00 is deliberately the moment the seeded quiet-hours window (`21:00`–`07:00`) closes, so the brief is the first thing that may legitimately reach a phone each day. Computes for **yesterday**.
- [ ] `morning-brief.prompt.ts` — `MORNING_BRIEF_SYSTEM` states the boundary and the register: *"You write a short operational brief for the leads of one kitchen-and-storefront node. Report only what the supplied JSON contains. Never invent a number, never recommend a price, never state a readiness value that is not given. Prefer the two or three things that changed over a complete list."*
- [ ] Specs: `gather` reads sales from `DailyClose.metrics` and does not query `Order` (assert the order delegate is untouched); a missing close yields zeroes without throwing; the readiness delta uses the snapshot 7 days back and is 0 when no snapshot exists; delivery hits exactly the configured role codes; a second run the same day is suppressed by the cooldown and `delivered_to` is 0; `morning_brief_enabled: false` throws; the cron computes yesterday and short-circuits on a held lock.
- [ ] `cd backend && npx jest src/ai --silent`
- [ ] `git commit -m "feat(p6-09): morning brief — gathered from the close, generated behind the AI port, delivered via dispatcher" -- backend/src/ai/morning-brief`

---

### Task 10: `GET /usage/summary` — `by_user`, last-seen, node-local windows

**Files:**
- Modify: `backend/src/usage/usage.service.ts` + `.spec.ts`, `backend/src/usage/usage.controller.ts`
- Modify: `backend/prisma/seed-data/module-access.ts`

- [ ] Extend `UsageSummary` and `UsageService.summary` (`usage.service.ts:90`):

```ts
export interface UsageSummary {
  days: number;
  from: string; to: string;                    // YYYY-MM-DD, node-local (decision 23)
  by_role: { role_code: string; count: number }[];
  by_path: { path: string; count: number }[];
  by_action: { action: string; count: number }[];
  /** RUN-04 "last-seen per user" — derived, not a column (decision 23). */
  by_user: {
    user_id: string; name: string; role_code: string;
    page_views: number; actions: number; last_seen_at: string | null;
  }[];
  /** Page views per day, for the dashboard's sparkline. */
  daily: { date: string; count: number }[];
}
```
  Replace `const since = new Date(Date.now() - days * 86_400_000)` with `nodeDateRange(await this.node.timezone(), from, to)`, so the panel and the analytics screens agree about what "the last 30 days" means. `by_user` is one `groupBy(['user_id'], { _count, _max: { created_at } })` plus a single `user.findMany` to resolve names — never N+1. `daily` is a `$queryRaw` `date_trunc('day', created_at AT TIME ZONE $tz)` group, which is the only shape Prisma's `groupBy` cannot express.
- [ ] `usage.controller.ts` — keep `@RequiresPermission(Permission.MANAGE_SYSTEM)` on `GET /usage/summary`; add `from`/`to` query params alongside the existing `days`, with `days` retained as the default so no existing caller breaks.
- [ ] Add the new module key to `backend/prisma/seed-data/module-access.ts`, inside the Admin block so it inherits `FOUNDER_ADMIN, TECH_LEAD` (decision 19). The Admin block is a `.map()` over a string array — append `'usage'` to that array; it lands at `sort_order 710`.
- [ ] Specs: `by_user` reports one row per user with the correct split and `last_seen_at`; a user with zero events in the window is absent; the window is node-local (an event at 23:30 IST on the `to` date is inside); `days` still works with no `from`/`to`; `seed-data.spec.ts`'s module-access assertions cover the new key (extend the expected list there if it is enumerated).
- [ ] `cd backend && npx jest src/usage src/prisma --silent`
- [ ] `git commit -m "feat(p6-10): usage summary gains by_user, last-seen and node-local windows; usage module key" -- backend/src/usage backend/prisma/seed-data/module-access.ts backend/src/prisma`

---

### Task 11: `/admin/usage` — the dashboard (RUN-04)

**Files:**
- Create: `frontend/app/(ops)/admin/usage/page.tsx`, `frontend/components/ops/admin/usage/{UsageDashboard,UsageByRoleChart,UsageLastSeenTable}.tsx`, `frontend/lib/types/usage.ts`
- Modify: `frontend/lib/nav/spine.ts`

- [ ] `frontend/lib/nav/spine.ts` — add to the `admin` group, after `Modules` (decision 19). `MODULE_ROUTES` in `components/ops/admin/module-routes.ts` derives from this file, so no second edit is needed:

```ts
      { moduleKey: 'usage', label: 'Usage', href: '/admin/usage', icon: Activity },
```
  Import `Activity` from `lucide-react` alongside the existing icons.
- [ ] `frontend/app/(ops)/admin/usage/page.tsx` — `'use client'` (decision 22), matching the shape of the other `admin/*` pages: the `MANAGE_SYSTEM` gate wrapper those pages already use, rendering `<UsageDashboard />`. Copy the gate from `app/(ops)/admin/modules/page.tsx` rather than inventing one.
- [ ] `UsageDashboard.tsx` — `useQuery({ queryKey: ['usage-summary', range], queryFn: () => apiClient.get<UsageSummary>(...) })` with a range selector (7 / 30 / 90 days). Sections: a KPI row (total page views, distinct active users, busiest path); `UsageByRoleChart`; a top-paths and a top-actions list; `UsageLastSeenTable`. Loading, empty and error states on every list (SPEC §6.4) — an empty `UsageEvent` table is the normal state on a fresh install, so the empty state must say "no activity recorded yet", not render a broken chart.
- [ ] `UsageByRoleChart.tsx` — a horizontal bar per role built from existing primitives and design tokens. **No new charting dependency**; check what the analytics screens already use and reuse it, otherwise render bars as tokenised `div`s with `width: ${pct}%`. No arbitrary colour values — the QA-04 lint rule errors on them.
- [ ] `UsageLastSeenTable.tsx` — user, role, page views, actions, last seen (relative, via the `date-fns` helper already in the app). Sort by last-seen descending; a user who has never been seen sorts last with an explicit "never".
- [ ] Verify: `cd frontend && npx tsc --noEmit && npx eslint . && npx next build`; then log in as `FOUNDER_ADMIN`, confirm **Usage** appears in the Admin group, `/admin/usage` renders, and the same nav item is **absent** for `BI_LEAD`.
- [ ] `git commit -m "feat(p6-11): /admin/usage dashboard over UsageEvent, spine entry, usage module key" -- frontend/app/(ops)/admin/usage frontend/components/ops/admin/usage frontend/lib/nav/spine.ts frontend/lib/types/usage.ts`

---

### Task 12: `/operations/daily-close` — the close screen (RUN-02)

**Files:**
- Create: `frontend/app/(ops)/operations/daily-close/page.tsx`, `frontend/components/ops/daily-close/{DailyCloseScreen,DailyCloseMetrics,DailyCloseSignCard}.tsx`, `frontend/lib/types/daily-close.ts`

- [ ] `frontend/lib/types/daily-close.ts` — mirror `DailyCloseMetrics` from Task 5 exactly. Money arrives as a JSON **number**, not a string (P5a decision 3, `DecimalSerializationInterceptor`), and `orders.revenue` is **tax-inclusive** — never add `tax_amount` to a displayed total.
- [ ] `DailyCloseScreen.tsx` — a date picker defaulting to yesterday, a status chip (`open` / `signed`, with signer and time), `DailyCloseMetrics`, and `DailyCloseSignCard`. On a date with no computed close, an empty state with a **Recompute** button (`POST /daily-close/:date/recompute`) rather than a spinner that never resolves.
- [ ] `DailyCloseMetrics.tsx` — five `<Card>` blocks matching RUN-02's list, in its order: **Orders & revenue by channel** (a table: channel, orders, revenue, plus a total row, and cancelled/refunded counts with the refunded amount); **Waste** (entries, cost, by reason); **Batches** (created, depleted); **Stock reconciliation** (checked, drifted, ran-at — with a link to `/admin/audit?entity_type=ingredient_stock` when `drifted > 0`, because the drift detail lives in `AuditEvent`); **Open shipments** (open, failed, delivered, linking to the Shipments queue).
- [ ] `DailyCloseSignCard.tsx` — visible only to `FRONTEND_LEAD` / `FOUNDER_ADMIN` (read the role from the existing auth hook; the server enforces it regardless). An optional notes field and a **Sign off** button; a confirm dialog stating plainly that **a signed close is frozen and cannot be recomputed**. Once signed, the card becomes a read-only receipt: who signed, when, the notes. Handle the two server errors distinctly — `409` → "someone else signed this day, refetching"; `403` → "your role cannot sign the close".
- [ ] Verify: log in as `FRONTEND_LEAD`, open `/operations/daily-close`, confirm the sign card is present; as `BI_LEAD`, confirm the nav item is absent and a direct visit is gated; sign a day and confirm the row flips, the button disappears, and `GET /audit?entity_type=daily_close` shows the event.
- [ ] `git commit -m "feat(p6-12): daily close screen with per-channel revenue, waste, batches, reconciliation and sign-off" -- frontend/app/(ops)/operations/daily-close frontend/components/ops/daily-close frontend/lib/types/daily-close.ts`

---

### Task 13: Gap closure — `refund.failed`, the tasks-done cascade, catalog audit, feedback keying (+ wave-3 `app.module`)

**Files:**
- Modify: `backend/src/webhooks/webhooks.service.ts` + `.spec.ts`, `backend/src/refunds/refunds.service.ts` + `.spec.ts`, `backend/src/tasks/tasks.service.ts` + `tasks.module.ts` + `.spec.ts`, `backend/src/catalog/catalog.service.ts` + `catalog.module.ts` + `.spec.ts`, `backend/src/mission-bridge/mission-bridge.rules.ts` + `.spec.ts`, `backend/src/app.module.ts` (**wave 3's single owner**)

Four independent fixes, one owner, because they share no files with any other P6 task and each is small. Justification for each is in the gap-closure table above.

- [ ] **`refund.failed`.** In `webhooks.service.ts`, extend the dispatch at line 110 (`else if (event === 'refund.processed')`) with `else if (event === 'refund.failed')` → `handleRefundFailed(payload)`. Add to `RefundsService`:

```ts
  /**
   * Razorpay's `refund.processed` is optimistic — `payments.refund()` can return
   * a refund whose status is still `pending` for hours, and P5a marks the row
   * `processed` on that optimistic response (P5a plan risk 3). When the rail
   * ultimately fails, `refund.failed` arrives and the money is still ours.
   *
   * Flips the row to `failed`, recomputes `Payment.refunded_amount` from the
   * **sum of processed rows only** (never by subtraction, which drifts across
   * partial refunds), restores `Payment.status`, and writes an `AuditEvent` so
   * the failure is visible in the order's history rather than only in logs.
   */
  async markGatewayRefundFailed(entity: GatewayRefundEntity): Promise<void> {
    // findFirst on razorpay_refund_id; unknown id → log and return (idempotent).
    // $transaction: refund.update({ status: failed })
    //             → recompute refunded_amount = Σ amount where status = processed
    //             → payment.status = refunded_amount > 0 ? partially_refunded : paid
    //             → audit.record({ entity_type: 'refund', action: 'refund.failed', before, after })
    // Then dispatch a `shipment_failed`-style nudge? No — a failed refund is an
    // order-desk problem, not a shipment one; it surfaces on the order and in
    // Mission Control's Action Required. Do not invent a new NotificationType.
  }
```
  Spec: an unknown `razorpay_refund_id` is a no-op; a failed partial refund leaves `refunded_amount` equal to the sum of the *remaining* processed refunds; a single failed full refund restores `Payment.status = paid`; the handler is idempotent under a replayed webhook.
- [ ] **The tasks-done cascade.** `TasksService.update` currently writes the status and the audit row but never revalidates (see the gap table). Inside the existing transaction at `tasks.service.ts:405` (`if (dto.status === 'done')`), after the progress recalculation, call `this.evidenceService.validateTask(id, tx)`. Add `EvidenceModule` to `TasksModule.imports` — the edge has no cycle, because `EvidenceModule` does not import `TasksModule`. Confirm that before writing: if a cycle exists, use `forwardRef` and say so in the commit message rather than skipping the fix.
  Spec: a task with approved evidence and satisfied approvals, moved `todo → done`, comes back `valid: true` with `valid_xp` awarded and its meter recomputed; the same task with `requires_approval: true` and zero `Approval` rows stays `valid: false` (P3 decision 4 is preserved, not regressed); moving `done → todo` sets `valid: false`; a task with no evidence stays invalid. **Run the full `src/tasks`, `src/evidence` and `src/approvals` suites** — this changes behaviour those three share.
- [ ] **Catalog audit.** Inject `AuditService` into `CatalogService` and add an `audit.record` to each of the nine mutating methods, inside the existing transaction where there is one and inside a new `$transaction` where there is not. Actions: `product_category.created|updated|deleted`, `product.created|updated|archived|published`, `product_variant.deleted`, `product_media.deleted`. Follow the `coupons.service.ts` shape exactly, including a JSON-safe `auditSnapshot` helper for `Product` (id, name, slug, status, base_price, tax_rate, category_id — **never** the whole row, which carries `search_text`). `AuditModule` is `@Global()`, so `catalog.module.ts` needs no import change; verify that before editing it.
  Spec: each mutating method writes exactly one `AuditEvent` with the right action and a `before`/`after` pair; the audit row is written on the same `tx` as the change (assert on one double); a failed update writes no audit row.
- [ ] **Feedback keying.** In `mission-bridge.rules.ts:241`, replace `subject_id: p.orderId ?? p.feedbackId` with an explicit branch that keeps the *subject type* honest:

```ts
    select: (p) => ({
      // The BridgeDispatch ledger is keyed on (rule_key, source_type, source_id)
      // and is the ONLY de-duplication (mission-bridge.service.ts:400-405). A
      // fallback to feedbackId silently turns "once per order" into "once per
      // feedback", so two low ratings on one order spawn two improvement tasks.
      // Feedback with no order has no order to be idempotent about — it keeps
      // the feedback id but declares the honest subject type.
      subject_type: p.orderId ? TaskSubjectType.order : TaskSubjectType.feedback,
      subject_id: p.orderId ?? p.feedbackId,
      values: { rating: p.rating, comment: p.comment },
    }),
```
  `defineRule` currently carries `subject_type` at the rule level, not in `select` — check the type and, if the rule-level field cannot be overridden per event, instead register **two** rules (`feedback_received_order_v1` and `feedback_received_standalone_v1`) discriminated on `p.orderId`, which achieves the same key separation without changing `defineRule`'s shape. Take whichever branch the existing types allow; do not widen `defineRule`. Also confirm `TaskSubjectType` has a `feedback` member — if it does not, use the two-rule branch, because adding an enum member belongs to Task 1 and this task does not own the schema.
  Spec: two `feedback.received` events for the same `orderId` spawn one task; two events with different `orderId`s spawn two; two events with no `orderId` and different `feedbackId`s spawn two.
- [ ] Register wave 3's modules in `backend/src/app.module.ts` — `MorningBriefModule` (or whatever Task 9 names its module) and any module Task 8 introduced. Run this step on the merged wave branch.
- [ ] `cd backend && npx jest --silent` — the **full** suite, because this task changes behaviour in four modules other tasks depend on.
- [ ] `git commit -m "fix(p6-13): handle refund.failed, re-run validation cascade on task done, audit catalog writes, key feedback dispatch per order" -- backend/src/webhooks backend/src/refunds backend/src/tasks backend/src/catalog backend/src/mission-bridge backend/src/app.module.ts`

---

### Task 14: `/intelligence/food-cost` — theoretical vs actual (RUN-03)

**Files:**
- Create: `frontend/app/(ops)/intelligence/food-cost/page.tsx`, `frontend/components/ops/intelligence/{FoodCostReport,FoodCostVarianceTable}.tsx`, `frontend/lib/types/food-cost.ts`

No spine edit: the screen lives under the existing `analytics` module key (decision 20), which already resolves to `BI_LEAD, FOUNDER_ADMIN, TECH_LEAD`. Add it as a **tab or a linked card on `/intelligence/analytics`**, not as a second spine item — SPEC §6.2 says no label appears twice, and "Analytics" and "Food Cost" as sibling nav entries under one module key would render for the same roles with no way to tell them apart in the modules editor.

- [ ] `frontend/lib/types/food-cost.ts` — mirror `FoodCostReport` from Task 6. Money is a JSON number.
- [ ] `FoodCostReport.tsx` — a date-range picker (default: last 30 days, presets for last 7 / last 30 / this month), then three `<Card>`s across the top: **Theoretical** (₹, and % of revenue), **Actual** (₹, and % of revenue), **Variance** (₹ and %, coloured by the status tokens — `good` when within ±2 %, `warning` to ±5 %, `serious` beyond; never a raw hex, the QA-04 lint rule errors on it). Below: `FoodCostVarianceTable`, and a by-movement-type breakdown of the actual side so a spike is immediately attributable to waste versus order deduction.
- [ ] Render the sign honestly. A **positive** variance means more stock left the store room than the recipes account for — over-portioning, unlogged waste, or theft. A **negative** variance usually means a recipe's `computed_cost` is stale. Put that sentence in the UI next to the number, not only in the plan: a variance figure without its direction is the kind of metric people learn to ignore.
- [ ] `FoodCostVarianceTable.tsx` — per product: quantity sold, unit cost, theoretical cost, share of theoretical total. Sortable by cost descending (the default). Loading, empty and error states.
- [ ] **Surface `unpriced_ingredients`** as a dismissible warning banner listing the names, linking each to `/operations/ingredients`: "N ingredient(s) have no vendor price and were valued at ₹0 — the actual figure is understated." Hiding this is how the report becomes untrustworthy (decision 18).
- [ ] Verify: `cd frontend && npx tsc --noEmit && npx eslint . && npx next build`; as `BI_LEAD`, confirm the screen renders and the numbers tie to `GET /analytics/food-cost`; as `PROCUREMENT_LEAD`, confirm it is not reachable.
- [ ] `git commit -m "feat(p6-14): theoretical vs actual food cost report with variance and unpriced-ingredient warning" -- frontend/app/(ops)/intelligence/food-cost frontend/components/ops/intelligence frontend/lib/types/food-cost.ts`

---

### Task 15: The human edges — evidence assist panel, morning brief card, staff contactability

**Files:**
- Create: `frontend/components/ops/evidence/EvidenceAssistPanel.tsx`, `frontend/components/ops/dashboard/MorningBriefCard.tsx`, `frontend/lib/types/ai.ts`
- Modify: `backend/src/users/{users.service.ts,users.controller.ts}` + `.spec.ts` + `dto/`, `frontend/components/ops/evidence/**` (the review row/sheet), `frontend/components/ops/dashboard/**` (Mission Control), `frontend/components/ops/admin/users/**`, `frontend/components/ops/admin/settings/**`

Three surfaces, one owner: each is small, and all three are what make the rest of P6 visible to a person.

- [ ] **Staff contactability (backend).** `User.phone` and `User.whatsapp_opt_in` shipped in Task 1's schema but nothing reads or writes them. Add both to `CreateUserDto` / `UpdateUserDto` (`@IsOptional() @IsString() @Matches(/^[0-9]{10,13}$/)` for the phone — `WhatsAppService.normalize` prepends `91`, so store digits only) and to the `select` in `UsersService`'s list and detail reads. A user must be able to set **their own** opt-in without `MANAGE_RBAC`: add `PATCH /me/notification-prefs` taking `{ phone?, whatsapp_opt_in? }` and writing only the calling user's row. Spec: an admin can set another user's phone; a non-admin can set only their own; an invalid phone is rejected; `whatsapp_opt_in` defaults false for a newly created user.
- [ ] **Admin users form.** Add a "Contact & notifications" section to the existing user create/edit form: phone, and a WhatsApp opt-in switch that is **disabled with an explanatory hint when the phone is empty** — an opt-in with no number is a silent dead end.
- [ ] **`/admin/settings` notifications block.** `SystemSetting['notifications']` is now editable through the existing settings screen; render it as a real form rather than raw JSON: the master WhatsApp switch, quiet-hours start/end time inputs, and the per-type cooldown numbers. Add a plain-language note beside the master switch: *"WhatsApp templates must be approved in the Meta WhatsApp Manager before this is turned on."* Check how `/admin/settings` currently renders Json settings and follow it; if it is a generic JSON editor, add a typed sub-form for this one key rather than rewriting the screen.
- [ ] **`EvidenceAssistPanel.tsx`** — rendered inside the existing evidence review surface (the sheet/row P4 Task 16 built), **below** the human approve/reject controls, never above them. Behaviour:
  - On open, `GET /evidence/:id/review-assist` — if a suggestion exists, show it; if not, show a **"Ask for a suggestion"** button. Never auto-generate on render: that spends a model call on every scroll.
  - The suggestion renders as a verdict chip (`Suggests approve` / `Suggests reject` / `Not sure`), a confidence bar, and the reasons as a list.
  - **The approve and reject buttons are never pre-selected, defaulted, disabled or reordered by the suggestion.** This is the SPEC §1.2 line, and it is a UI property as much as a backend one.
  - A visible provenance line: *"Suggestion from {provider}{model ? ` (${model})` : ''} — a person decides."* When `provider === 'heuristic'`, say *"rule-based suggestion (no AI provider configured)"* so nobody mistakes the fallback for a model.
  - Errors are inline and non-blocking; a failed assist must never prevent the human from approving.
- [ ] **`MorningBriefCard.tsx`** — in Mission Control's Status column, above the readiness sparkline. `GET /ai/morning-brief/latest` through the `optionalGet` pattern P4 Task 14 established, so a 404 or a missing endpoint drops the card rather than breaking `/dashboard` (decision 24). Renders headline, bullets and actions; a relative timestamp; and, when the brief is older than 36 hours, a muted "from {date}" so a stale brief cannot read as today's.
- [ ] Verify: `cd frontend && npx tsc --noEmit && npx eslint . && npx next build`; then, with `SystemSetting['ai'].provider = 'heuristic'`, open a pending piece of evidence, request a suggestion, confirm it renders with the rule-based provenance line and that approve/reject are unchanged; confirm `/dashboard` renders with and without a brief.
- [ ] `git commit -m "feat(p6-15): evidence assist panel, morning brief card, staff phone/opt-in and notification settings" -- backend/src/users frontend/components/ops/evidence frontend/components/ops/dashboard frontend/components/ops/admin/users frontend/components/ops/admin/settings frontend/lib/types/ai.ts`

---

### Task 16: One migration `p6_run_it_layer`, seeds, drift gate, runtime smoke

**Files:**
- Create: `backend/prisma/migrations/20260827090000_p6_run_it_layer/migration.sql`
- Modify: `backend/prisma/seed-reference.ts`, `backend/src/prisma/seed-data.spec.ts`

Runs against the **fully merged** tree, strictly last: the migration is generated from the final `schema.prisma`, so an unmerged wave would produce an incomplete one.

- [ ] Confirm the timestamp is still the latest. Applied migrations are `20260823120000_p2_platform_foundation`, `20260823180000_p3_mission_bridge`, `20260826000000_p4_role_aware_ia`, `20260826120000_p5a_marketplace_backend`. **Phase 34 is being planned concurrently and may add one.** `ls backend/prisma/migrations` first; if anything sorts after `20260827090000`, regenerate with a later timestamp using `migrate dev --create-only` — never rename a directory, which desynchronises `_prisma_migrations`.
- [ ] `cd backend && npx prisma migrate dev --create-only --name p6_run_it_layer`. **`prisma migrate reset` is not available to agents** (Prisma 6.19 AI-agent guard); this flag generates the SQL without applying it.
- [ ] Review the generated SQL by hand. It must contain, and contain only:
  - `ALTER TYPE "NotificationType" ADD VALUE 'shipment_failed' | 'morning_brief' | 'daily_close_due'` — **each in its own statement**, and note that Postgres forbids `ALTER TYPE ... ADD VALUE` inside a transaction block in some versions; if `migrate deploy` fails on that, split the enum additions into a separate earlier migration rather than wrapping them.
  - `CREATE TYPE "DailyCloseStatus"`.
  - `CREATE TABLE "DailyClose"` and `"EvidenceReviewSuggestion"` with their FKs and indexes.
  - `ALTER TABLE "User" ADD COLUMN "phone" TEXT, ADD COLUMN "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false`.
  - `ALTER TABLE "Notification" DROP COLUMN "is_email_sent"` — **the only DROP in this migration.** Confirm it is the only one; any other DROP is a mistake and must be investigated before applying.
- [ ] Add one hand-written guard the generator cannot produce, at the end of the file:

```sql
-- A signed daily close is frozen (P6 decision 16). The service enforces this,
-- but a raw SQL fix-up would not, and the metrics are the audit record.
ALTER TABLE "DailyClose"
  ADD CONSTRAINT "DailyClose_signed_has_signer"
  CHECK (status <> 'signed' OR (signed_by IS NOT NULL AND signed_at IS NOT NULL));

-- A suggestion is never a decision: `verdict` is deliberately not an enum
-- (P6 Task 1) so it can never be cast to ApprovalStatus, but it is still closed.
ALTER TABLE "EvidenceReviewSuggestion"
  ADD CONSTRAINT "EvidenceReviewSuggestion_verdict_check"
  CHECK (verdict IN ('approve', 'reject', 'unsure'));
```

- [ ] `cd backend && npx prisma migrate deploy` against the Docker database on `localhost:5433`, then `npx prisma generate`.
- [ ] Seeds: `seed-reference.ts` must upsert the three new `SystemSetting` rows (`notifications`, `ai`, `daily_close`) and the `usage` `ModuleAccess` row. It is idempotent and prod-safe and **must not overwrite a row an operator has edited** — follow the existing create-if-absent pattern in that file exactly. Run `npm run seed:reference`, then `npm run seed:demo`.
- [ ] Extend `backend/src/prisma/seed-data.spec.ts` — the existing "mirrors SETTING_DEFAULTS exactly" case at line 258 covers the new blocks automatically; add a case asserting the `usage` module key is seeded with `[FOUNDER_ADMIN, TECH_LEAD]`.
- [ ] **Drift gate:** `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-url $SHADOW_URL --exit-code` against `konma_shadow`. Expect `No difference detected.` — nothing else is a pass.
- [ ] **Runtime smoke against `dist/src/main.js`** (`npm run build` first), recorded verbatim in the phase summary:
  1. `POST /daily-close/2026-08-26/recompute` → 201 with metrics; `GET /daily-close/2026-08-26` → the same numbers.
  2. `POST /daily-close/2026-08-26/sign` as `BI_LEAD` → **403**; as `FRONTEND_LEAD` → 200; again → **409**.
  3. `GET /audit?entity_type=daily_close` → one `daily_close.signed` row carrying the metrics.
  4. `GET /analytics/food-cost?from=…&to=…` as `BI_LEAD` → theoretical, actual, variance, and `unpriced_ingredients` populated on the demo seed.
  5. `POST /evidence/{pendingId}/review-assist` → a suggestion with `provider: "heuristic"`; `GET` the same → the identical row; confirm the evidence's `approval_status` is **still `pending`**.
  6. `POST /ai/morning-brief/generate` → a brief; `GET /notifications?type=morning_brief` for a lead → one row with `channel: ["in_app"]`; call generate again → `delivered_to: 0` (cooldown).
  7. `GET /usage/summary?days=30` → `by_user` with `last_seen_at`, and `daily` populated.
  8. Flip `SystemSetting['notifications'].whatsapp_enabled` to `true`, set a user's `phone` and `whatsapp_opt_in`, force a nudge, and confirm the `[DEV] WhatsApp template "staff_..."` log line appears with the right positional params (WhatsApp is unconfigured locally, which is exactly the degraded path we want to see exercised).
  9. Set `quiet_hours` to a window containing "now", repeat: the `Notification` row is written with `channel: ["in_app"]` and **no** WhatsApp log line.
  10. Post a `refund.failed` webhook for a processed refund → `Refund.status = failed`, `Payment.refunded_amount` recomputed, one `refund.failed` audit row.
  11. `PATCH /tasks/{id} {"status":"done"}` on a task with approved evidence → `valid: true` and XP awarded (the cascade gap, closed).
  12. `PATCH /catalog/products/{id}` → one `product.updated` audit row.
- [ ] Full gate: `npx jest --silent` · `npx tsc --noEmit -p tsconfig.build.json` · `npx eslint "{src,apps,libs,test}/**/*.ts"` (0 errors) · `npx prisma validate`; frontend `npx tsc --noEmit` · `npx eslint .` (0 errors) · `npx next build`.
- [ ] `git commit -m "feat(p6-16): p6_run_it_layer migration, reference seeds, drift gate, runtime smoke" -- backend/prisma backend/src/prisma`

---

## Execution partition (parallel Opus implementers, isolated worktrees)

**Rules for every agent**
- `model: "opus"` on every implementation subagent (harness preference).
- One agent per task, in its own worktree branched from the wave's base commit; merge the wave, run the full gate, then start the next wave.
- **`git commit -- <paths>` only.** Never `git add -A`.
- Gates after every task: `npx jest --silent`, `npx tsc --noEmit -p tsconfig.build.json`, `npx eslint "{src,apps,libs,test}/**/*.ts"` (0 errors). Frontend tasks additionally run `npx tsc --noEmit`, `npx eslint .`, `npx next build`.
- **The wave's `app.module.ts` owner performs its registration step on the merged wave branch**, not in its own worktree — the modules it registers are created by its siblings and do not exist until the merge. This is the one deliberate exception to "every task is green alone".
- **Task 1 and Task 4 are green as a pair, not individually.** Task 1 drops `Notification.is_email_sent` from the schema; Task 4 removes its three code references. Verify the merged wave.
- **Single-owner files** — an agent needing a change in a file it does not own must stop and report, not edit it:

| File | Sole owner |
|---|---|
| `backend/prisma/schema.prisma` | Task 1 |
| `backend/src/settings/settings.service.ts`, `backend/prisma/seed-data/settings.ts` | Task 1 |
| `backend/src/test-utils/mock-providers.ts` | Task 1 |
| `backend/src/config/env.validation.ts`, `backend/.env.example`, `backend/package.json` | Task 2 |
| `backend/src/ai/*.ts` (module root) | Task 2 — frozen after wave 1 |
| `backend/src/common/utils/advisory-lock.ts` | Task 3 |
| `backend/src/common/utils/node-time.ts` | **nobody** — P6 reads it, never edits it |
| `backend/src/notifications/{notifications.service,notifications.processor,notifications.module}.ts` | Task 4 |
| `backend/src/notifications/staff-nudge.cron.ts` | Task 8 |
| `backend/src/webhooks/**`, `backend/src/tasks/**`, `backend/src/catalog/**`, `backend/src/mission-bridge/**` | Task 13 |
| `backend/prisma/seed-data/module-access.ts` | Task 10 |
| `frontend/lib/nav/spine.ts` | Task 11 |
| `backend/src/main.ts` | **nobody** — P6 does not touch it |
| `backend/prisma/migrations/**`, `backend/prisma/seed-reference.ts` | Task 16 |
| `frontend/app/page.tsx`, `ScrollVideoStory.tsx` | **nobody** — frozen by SPEC §7 |

### Wave 1 — foundations (3 agents, no dependencies between them)

| Task | Owns |
|---|---|
| **1** Schema + settings + jest registry | `prisma/schema.prisma`, `src/settings/**`, `prisma/seed-data/settings.ts`, `src/test-utils/mock-providers.ts`, `src/prisma/run-it-schema.spec.ts` |
| **2** AI port + env + wave `app.module` | `src/ai/*.ts`, `src/config/env.validation.ts`, `.env.example`, `package.json`, `src/app.module.ts` |
| **3** Lock registry + reconciliation + R2 hygiene | `src/common/utils/advisory-lock.*`, `src/inventory/**`, `src/storage/**`, `src/loyalty/loyalty.cron.*`, `src/events/event-holds.cron.*`, `src/readiness/readiness.cron.ts`, `CLOUDFLARE-SETUP.md` |

Task 2 compiles without Task 1 because it is typed against `ai.types.ts` (the P5a `shipping.types.ts` precedent) — it needs only `SettingsService`, which Task 1 extends additively. Task 3 needs no new model. The three file sets are disjoint, so merge order inside the wave is irrelevant.

### Wave 2 — the four capabilities (4 agents; base = merged wave 1)

| Task | Owns | Needs |
|---|---|---|
| **4** Dispatcher + templates + quiet hours | `src/notifications/{notification-dispatcher,notification-templates,quiet-hours}.*`, `notifications.{service,processor,module}.ts`, `frontend/lib/types/notifications.ts` | T1 (`NotificationType`, `User.phone`, settings) |
| **5** Daily close + wave `app.module` | `src/daily-close/**`, `src/app.module.ts` | T1, T3 (`ADVISORY_LOCK.DAILY_CLOSE`) |
| **6** Food cost | `src/food-cost/**` | T1 |
| **7** Evidence assist | `src/ai/evidence-assist/**` | T1 (`EvidenceReviewSuggestion`), T2 (resolver) |

Task 5 owns `app.module.ts` and registers `DailyCloseModule` **and** `FoodCostModule` on the merged branch. Task 7 lives in a sub-directory of a module Task 2 froze, so the two never touch the same file.

### Wave 3 — delivery and debt (4 agents; base = merged wave 2)

| Task | Owns | Needs |
|---|---|---|
| **8** Staff nudge sweep | `src/notifications/staff-nudge.cron.*` | T3 (lock id), T4 (dispatcher) |
| **9** Morning brief | `src/ai/morning-brief/**` | T2, T4, T5 (`DailyCloseMetrics`) |
| **10** Usage summary + module key | `src/usage/**`, `prisma/seed-data/module-access.ts` | — |
| **13** Gap closure + wave `app.module` | `src/webhooks/**`, `src/refunds/**`, `src/tasks/**`, `src/catalog/**`, `src/mission-bridge/**`, `src/app.module.ts` | T1 |

Task 8 adds a provider line to `notifications.module.ts`, which Task 4 owns — Task 4 merged in wave 2, so this is an append to a settled file, not a concurrent edit. Task 13 owns `app.module.ts` for this wave and registers whatever Tasks 8 and 9 introduce, on the merged branch. Task 10 shares no file with any of the other three.

### Wave 4 — screens (4 agents; base = merged wave 3)

| Task | Owns | Needs |
|---|---|---|
| **11** `/admin/usage` | `app/(ops)/admin/usage/**`, `components/ops/admin/usage/**`, `lib/nav/spine.ts`, `lib/types/usage.ts` | T10 |
| **12** `/operations/daily-close` | `app/(ops)/operations/daily-close/**`, `components/ops/daily-close/**`, `lib/types/daily-close.ts` | T5 |
| **14** `/intelligence/food-cost` | `app/(ops)/intelligence/food-cost/**`, `components/ops/intelligence/**`, `lib/types/food-cost.ts` | T6 |
| **15** Human edges | `components/ops/{evidence,dashboard}/**`, `components/ops/admin/{users,settings}/**`, `src/users/**`, `lib/types/ai.ts` | T4, T7, T9 |

Only Task 11 edits `lib/nav/spine.ts`; Task 14 deliberately adds no spine entry (decision 20 and SPEC §6.2's no-duplicate-label rule). Task 15 is the only frontend task touching `components/ops/admin/`'s users and settings sub-trees.

### Wave 5 — database (1 agent, strictly last)

| Task | Owns |
|---|---|
| **16** Migration, hand-written CHECKs, seeds, drift gate, runtime smoke | `prisma/migrations/**`, `prisma/seed-reference.ts`, `src/prisma/seed-data.spec.ts` |

### Cross-phase collisions (Phase 34 is being planned concurrently)

| Risk | Mitigation |
|---|---|
| Phase 34 adds a migration with a later timestamp | Timestamps order migrations, not merge order. Task 16 lists the directory first and regenerates with `migrate dev --create-only` if anything sorts after it. Never rename a migration directory. |
| Phase 34 adds `shipments`, `customers`, `reviews`, `promotions` spine entries | P6 adds only `usage`, in the Admin group. Different lines in `lib/nav/spine.ts`; a textual conflict at worst, resolved by keeping both. |
| Phase 34 edits `customer-orders.service.ts` for the quote flow | P6 deliberately does not touch it — the `cart/sync` merge rule is deferred to Phase 34 for exactly this reason. |
| Phase 34 builds the staff Shipments queue at `/operations/shipments` | Task 8's `shipment_failed` nudge links there. If Phase 34 lands a different path, the link is one string in `staff-nudge.cron.ts`. Flag it to the Phase 34 planner. |
| Phase 34 edits `catalog.service.ts` for the catalog admin API | P6 Task 13 adds audit calls to the same nine methods. Both changes are additive; resolve by keeping both. **Flag to the Phase 34 planner: if their catalog work lands first, the audit calls go into whatever those methods become.** |
| Phase 34 also wants `MorningBriefCard` space in Mission Control | P6 Task 15 adds it to the Status column; Phase 34's "failed shipments" Action Required row is a different column. No conflict. |

---

## Self-review

### SPEC coverage → task

| SPEC item | Task |
|---|---|
| §1.2 "No AI that approves evidence, assigns readiness values, sets prices, or is the primary UI" | 2 (`ai-boundaries.spec.ts`), 7 (suggestion-only service), 15 (the panel never pre-selects a decision) |
| §3.1 `AuditEvent` on every mutating write | 5 (daily close sign-off), 3 (reconciliation drift, orphan sweep), 13 (the nine catalog methods) |
| §3.1 `SystemSetting` keys allowlisted in code | 1 (`notifications`, `ai`, `daily_close` added to `SETTING_DEFAULTS`, which *is* the allowlist) |
| §3.4 `IngredientStock` nightly reconciliation vs `Σ StockMovement`, `AuditEvent(action='stock.reconciliation_mismatch')` on drift | 3 |
| §3.4 `Notification.channel: NotificationChannel[] (in_app\|email\|whatsapp)` | 4 (its first writer) |
| §4.2 bridge task spawn "once per order" | 13 (the keying fix that makes "once per order" true) |
| §5.4 loyalty expiry nightly job under a lock | 3 (id folded into the registry; the job itself shipped in P5a) |
| §6.4 loading, empty and error states on every list | 11, 12, 14, 15 |
| §6.4 motion allowlist, no arbitrary colour values | 11, 12, 14, 15 (the QA-04 lint rule errors on violations) |
| §6.5 Mission Control Status column | 15 (morning brief card) |
| §8 crons wrapped in `pg_try_advisory_lock` | 3 (registry + unlock check), 5, 8, 9 (three new jobs) |
| §8 `UsageEvent` table feeding an admin usage panel | 10 (data), 11 (panel) |
| §8 R2 lifecycle rule on `exports/` (30 days), weekly orphan sweep | 3 |
| §8 config validation; production boot fails on missing required vars | 2 (`ANTHROPIC_API_KEY` added as **optional**, deliberately not required — decision 2) |
| §8 every outbound integration failure-isolated | 4 (`safely`), 2 (provider fallback chain) |
| §9 `usage` (admin), `audit?entity_type=&entity_id=` | 10, 12 (the reconciliation drill-down uses the audit endpoint) |
| §10 unit tests per service; no `any`, no `console.*` in services | every task |
| §11 P6 exit criteria (WhatsApp nudges, daily close, theoretical vs actual food cost, usage dashboard, AI assists) | 4+8, 5+12, 6+14, 10+11, 2+7+9+15 |

### REQUIREMENTS id → task

| Id | Task | Covered by |
|---|---|---|
| **RUN-01** WhatsApp staff templates for approvals waiting, blockers, low stock, failed shipments, with per-type cooldowns | 1, 4, 8, 15 | `WHATSAPP_TEMPLATES` registry · `NotificationDispatcher` (opt-in, quiet hours, one cooldown from `SystemSetting['notifications'].cooldown_hours`) · `StaffNudgeCron` for the two nudges with no sweep · `User.phone`/`whatsapp_opt_in` and the admin form that sets them |
| **RUN-02** Daily close screen, signed off by `FRONTEND_LEAD`/`FOUNDER_ADMIN` as an `AuditEvent` | 1, 5, 12 | `DailyClose` model · `computeAndUpsert` + `sign` (role gate from settings, audit in the same transaction) · the screen with all five metric blocks and a frozen-after-signing receipt |
| **RUN-03** Theoretical vs actual food cost, variance surfaced to `BI_LEAD` | 6, 14 | `FoodCostService.report` · `valueQuantity` · `/intelligence/food-cost` under the `analytics` key + `MANAGE_KPIS` |
| **RUN-04** Admin usage dashboard — page views per role, key actions, last-seen per user | 10, 11 | `by_user` + `daily` + node-local windows · `/admin/usage` and the new `usage` module key |
| **RUN-05** AI evidence-review assist and morning brief, human-in-the-loop, suggestions only | 2, 7, 9, 15 | `AiProviderPort` + `AnthropicProvider` + `HeuristicProvider` + resolver · `EvidenceAssistService` · `MorningBriefService` · the panel and the card, plus `ai-boundaries.spec.ts` as the enforcement |
| **RUN-06** Nightly jobs under `pg_try_advisory_lock` (reconciliation with drift audit, loyalty expiry, readiness snapshots); R2 `exports/` lifecycle + weekly orphan sweep | 3 | One `ADVISORY_LOCK` registry, an unlock check answering the xact-lock note, `StockReconciliationCron`, `OrphanSweepCron`, and the lifecycle rule documented in `CLOUDFLARE-SETUP.md` |

### What v2.0 leaves for v2.1

| Left undone | Why, and what it would take |
|---|---|
| **`cart/sync` merge rule** | Deferred to Phase 34 (gap table). If Phase 34 does not take it, v2.1 owes a union-with-max-quantity merge and a decision about which cart's `channel`/`deliveryAddressId` wins. |
| **`/admin/approval-policies`** | The P3 API has no screen. Policies are editable only by seed or SQL. Pure IA work, no RUN-* requirement. |
| **`talent` module** | SPEC §6.3 annotates it v2.1 itself. `TALENT_LEAD` sees only the all-roles spine today. |
| **`QA-03` / `QA-05` / `QA-06`** — Playwright smoke 1 and 2, and the Postgres integration harness | Three phases have queued these behind one owner; the ROADMAP assigns all three to Phase 34. P6 adds unit coverage and a recorded runtime smoke, not a harness. **This is the single largest piece of unpaid debt in v2.0.** |
| **Per-user notification timezones and digest mode** | Quiet hours are node-wide (decision 11). A distributed team needs per-user zones and a "digest instead of suppress" option. |
| **WhatsApp template approval in Meta** | `whatsapp_enabled` seeds `false` because the five template names in `notification-templates.ts` must be registered and approved in the Meta WhatsApp Manager first. This is an operations task with a real lead time, not a code task — start it before the phase, not after. |
| **Inbound WhatsApp** | Nudges are one-way. Approving from a WhatsApp reply would need the inbound webhook, an identity binding and a fresh authorisation story. |
| **AI beyond two assists** | No retrieval, no embeddings, no `pgvector`, no chat-over-ops. SPEC §1.2 keeps AI off the primary UI; the port makes a third assist cheap when one is justified. |
| **Snapshotting food cost** | The report recomputes per request (decision 17). If BI wants month-over-month trend lines, that is a `FoodCostSnapshot` table and a monthly job. |
| **Auto-correcting stock drift** | The reconciliation job records and never repairs (Task 3). Repair needs a decision about which side is authoritative — and the drift's *cause* is the finding, not the number. |
| **Presigned GET for private R2 reads** | SPEC §8 asks for presigned GET on evidence/exports/media; `StorageService` still exposes `getPublicUrl`. P6 adds LIST and DELETE for the sweep but does not change the read path, which would touch every consumer of an evidence or export URL. |

### Risks and how the plan contains them

1. **No Anthropic key has ever been configured in this project.** Contained by design, not by hope: `SystemSetting['ai'].provider` seeds `heuristic`, `ANTHROPIC_API_KEY` is optional in the validation schema, and `HeuristicProvider` is written to be genuinely useful rather than a stub. RUN-05 ships green with no key, and flipping one setting turns the model on later. The residual risk is that the model path's request shape is never exercised against the real API before production — mitigated by pinning the exact call shape in decision 3 from current API documentation (adaptive thinking, effort inside `output_config`, no `budget_tokens`, no prefill) and by `anthropic.provider.spec.ts` asserting the parameter object.
2. **Meta template approval is a lead-time dependency outside the code.** Five templates must be approved before `whatsapp_enabled` can be turned on. Contained: the switch seeds `false`, the dispatcher skips WhatsApp for any type with no template, and an unapproved name fails as a Meta 400 that `safely()` swallows. RUN-01's in-app half works regardless. **Start the Meta submissions before wave 2.**
3. **Dropping `is_email_sent` splits a green build across two tasks.** Contained by the explicit merged-wave rule in the partition, and by the escape hatch in Task 1 (keep the column, let Task 4 drop it) if the orchestrator insists on per-task green. The migration is identical either way.
4. **The tasks-done cascade is a live behaviour change on populated data.** Tasks that were `done` with approved evidence but never revalidated will flip to `valid: true` on their next update, awarding XP and moving meters — retroactively. That is the correct behaviour and the point of the fix, but it will look like a jump on the readiness charts. Contained: Task 13's spec pins P3 decision 4 (zero approvals still blocks), and the change is called out here so the phase summary records the jump as expected rather than investigating it later. It also crosses the `TasksModule → EvidenceModule` edge P3 declined; the task carries an explicit instruction to verify there is no cycle before wiring and to use `forwardRef` if there is.
5. **The R2 orphan sweep deletes customer evidence if its reference query is wrong.** The most dangerous thing in this plan. Contained three ways: a 48-hour age floor so an in-flight presigned upload can never be swept; a maintenance-mode dry run that logs instead of deleting; and an `AuditEvent` per prefix carrying sample keys. **The first production run must be a dry run that a human reads.** That instruction is in the task, not only here.
6. **`ALTER TYPE ... ADD VALUE` can fail inside a transaction block.** Postgres forbids it in some versions when the migration runs transactionally. Contained: Task 16 carries the explicit fallback (split the enum additions into their own earlier migration) rather than leaving an implementer to discover it against a half-applied migration.
7. **Phase 34 is being planned against the same files.** Five specific collisions are enumerated in the partition with a resolution for each. The two that need a message to the Phase 34 planner — the shipments route string and the catalog audit calls — are named there.
8. **The daily close computes yesterday from a cron at 00:45, and a late refund lands after it.** By design (decision 16): the close is a snapshot, and `recompute` exists for a day still `open`. The residual case — a refund arriving after sign-off — is intentionally *not* reflected in the signed metrics; it lives in the `Refund` row and the audit trail. The screen states the business date and signing time so the boundary is legible.
9. **`formatInNodeTz`'s exact signature is assumed by `quiet-hours.ts`.** Task 4 carries an explicit instruction to confirm it at `node-time.ts:129` and take the documented fallback (`nodeDayKey` + `tzOffsetMinutes`) if it differs — and `node-time.ts` is on the nobody-owns-it list, so the fallback is the only permitted route.
10. **`defineRule`'s shape may not allow a per-event `subject_type`.** Task 13 carries both branches (override, or two discriminated rules) and forbids widening `defineRule`, so the implementer cannot be blocked by a type they do not own.

### Placeholder scan

No `TODO`, `TBD`, "etc." or "similar to" stands in for code a reader must invent. Method bodies given as a signature plus a specification rather than full code: `AnthropicProvider.writeMorningBrief` (explicitly "same shape as `reviewEvidence`" with the four differing values named), `DailyCloseService.gather` / `list` / `findByDate`, `FoodCostService.report`, `MorningBriefService.gather`, `RefundsService.markGatewayRefundFailed`, `StorageService.listKeys` / `deleteKeys`. Each is (a) an aggregate query or mechanical CRUD whose exact output shape is declared as a TypeScript interface in the same task, and (b) covered by named test cases in that task. The five places where an implementer must make a judgement call are flagged in bold with both branches spelled out: `formatInNodeTz`'s signature (Task 4), the `TasksModule ↔ EvidenceModule` cycle check (Task 13), `defineRule`'s `subject_type` (Task 13), the `ALTER TYPE` transaction fallback (Task 16), and the migration-timestamp collision with Phase 34 (Task 16).

### Name consistency across tasks

`AiProviderPort` / `AiProviderResolver.get()` / `AnthropicProvider` / `HeuristicProvider` (Tasks 2, 7, 9) · `EvidenceAssistInput` / `EvidenceAssistResult` / `AssistVerdict` / `MorningBriefInput` / `MorningBriefResult` from `ai/ai.types` (Tasks 2, 7, 9, 15) · `NotificationDispatcher.dispatch()` returning `{ id, channels } | null` (Tasks 4, 8, 9) · `WHATSAPP_TEMPLATES` / `WhatsAppTemplateSpec` (Tasks 4, 8, 9) · `isQuietHour(at, timeZone, window)` (Task 4) · `ADVISORY_LOCK.{READINESS_SNAPSHOT,LOYALTY_EXPIRY,BOOKING_HOLD_SWEEP,STOCK_RECONCILIATION,DAILY_CLOSE,MORNING_BRIEF,STAFF_NUDGE_SWEEP,R2_ORPHAN_SWEEP}` (Tasks 3, 5, 8, 9) · `withAdvisoryLock(prisma, key, fn, logger?)` (Tasks 3, 5, 8, 9) · `DailyCloseMetrics` / `DailyCloseService.computeAndUpsert` / `.sign` (Tasks 5, 9, 12) · `FoodCostReport` / `FoodCostService.report` / `valueQuantity` (Tasks 6, 14) · `EvidenceAssistService.suggest` / `.latest` (Tasks 7, 15) · `MorningBriefService.gather` / `.generateAndDeliver` / `.latestForUser` (Tasks 9, 15) · `UsageSummary` with `by_user` / `daily` (Tasks 10, 11) · setting keys `notifications` / `ai` / `daily_close` (Tasks 1, 4, 5, 7, 9, 15, 16) · module key `usage` (Tasks 10, 11) · migration directory `20260827090000_p6_run_it_layer` (Task 16) · `NotificationType.{shipment_failed,morning_brief,daily_close_due}` (Tasks 1, 4, 8, 9).

### Two design decisions that need sign-off before execution

1. **The AI fallback is a local deterministic provider, not a second model.** `SystemSetting['ai'].provider` seeds `heuristic`; `ANTHROPIC_API_KEY` is optional; a missing key, an API error and a `stop_reason: "refusal"` all fall through to `HeuristicProvider` (decisions 1–4). Concretely: **RUN-05 ships and its tests pass whether or not anyone ever buys an Anthropic key**, and the first time the model path runs against the real API will be in staging, not in CI. The alternative — requiring the key, and using the server-side `fallbacks` beta to route refusals to another model — gives better suggestions from day one but makes RUN-05 blocked on procurement and makes every AI test either a network test or a mock of a mock. **Confirm the heuristic-first posture, and say whether a key will exist by the time wave 2 starts** (if yes, Task 2 should also enable `betas: ['server-side-fallback-2026-07-01']` + `fallbacks: 'default'`, which is a two-line change in one file).

2. **`withAdvisoryLock` stays session-scoped, and the pooling hazard is answered with an unlock check rather than a rewrite** (decisions 14–15, RUN-06). The util's own comment says to move to `pg_try_advisory_xact_lock` inside an interactive transaction "if this is ever reused on a hot path". P6 adds four more nightly/weekly jobs — not hot paths — so it keeps the session lock and instead makes the failure *visible*: `pg_advisory_unlock` returning `false` now logs an error naming the lock id. The alternative — converting every job to a transaction-scoped lock — would wrap `LoyaltyExpiryCron`'s deliberately per-row transactions and the whole reconciliation sweep in one long-held transaction, trading a rare pooling hazard for routine lock contention and a much longer transaction footprint on Neon. **Confirm the unlock-check approach**, or ask for the xact-lock conversion and accept that Tasks 3, 5, 8 and 9 all restructure around a single enclosing transaction.
