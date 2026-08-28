# Phase 35-01 — P6 "Run-It Layer" Summary

**Branch:** `v2-os-marketplace`
**Range:** Wave 1 landed *before* P5b's last two tasks (`b7da851`, `6885699`, `8e29ac8`; `38 files, +3,426 / −70`);
Waves 2–5 are `5b52811..dce8180` (`106 files, +14,117 / −443` — backend `73 / +9,485 / −434`, frontend `33 / +4,632 / −9`)
**Plan:** `docs/superpowers/plans/2026-08-24-p6-run-it-layer.md` (16 tasks)
**Date:** 2026-08-25 → 2026-08-28

P6 is the phase where the system stops being a thing you *build* and becomes a thing you *run*. Nothing here
sells anything new. What it adds is the layer that makes the node's own day legible: a nightly close that
freezes what happened into signed, versioned metrics; a food-cost report that puts the recipe's promise
beside the stock ledger's answer; a notification dispatcher that finally knows the difference between "write
a row" and "wake a person at 2 a.m."; five scheduled jobs that hold a lock so N instances do a nightly job
once; and two AI assists that are — by construction, not by policy — unable to decide anything.

The single hardest constraint in the plan is SPEC §1.2: **AI suggests, humans decide.** It is enforced three
ways. The `AiProviderPort` is heuristic-first, so the whole feature works with no API key configured and an
Anthropic outage degrades to a deterministic answer rather than an error. `EvidenceReviewSuggestion` is a
separate table that no approval path reads. And `EvidenceAssistPanel` is *structurally* unable to touch the
approve/reject controls — it renders beside them and shares no state with them.

Phase 35 is the last phase of **v2.0**. Its completion closes the milestone.

---

## What P6 delivered

| Task | Commit(s) | What landed |
|---|---|---|
| 1 | `b7da851` | The typed P6 schema: `DailyClose`, `EvidenceReviewSuggestion`, `User.phone` / `User.whatsapp_opt_in`, three new `NotificationType` members (`shipment_failed`, `morning_brief`, `daily_close_due`), and the `notifications` / `ai` / `daily_close` blocks in `SystemSetting`. Plus the jest mock registry every later wave builds on. |
| 2 | `ebf34fe`, `8e29ac8` | `AiProviderPort` — a **heuristic-first** resolver with an optional-key `AnthropicProvider` behind it and an env contract that treats the key as absent-by-default. No `ANTHROPIC_API_KEY` is required to boot, to test, or to ship; the provider degrades *internally*, so no caller has an error path for "AI is down". `ai-boundaries.spec.ts` asserts the port cannot reach a decision surface. |
| 3 | `6885699` | `RUN-06`. One unified `ADVISORY_LOCK` registry (eight named keys, three inherited from P3/P5a and five new) replacing the inline magic numbers, with a **checked** `pg_advisory_unlock` release — an unlock that returns false is now an error, not a shrug. Plus the nightly stock reconciliation (record-only), the weekly R2 orphan sweep, and `docs/R2-LIFECYCLE.md`. |
| 4 | `d222e04`, `ab79518`, `173d88b` | `NotificationDispatcher`. Three channels with three different rules: **in_app always** (it is a pull surface — suppressing it loses the record), **email** when the type is in `settings.notifications.email_types`, **whatsapp** only when the master switch is on *and* a template exists for the type *and* the user opted in *and* the user has a phone *and* it is not a quiet hour. Per-type cooldowns (24 h default). `Notification.is_email_sent` retired end to end — the column, the writes, the reads and the frontend field. |
| 5 | `52d5b72`, `108d4be` | `RUN-02` backend. Daily close compute / recompute / sign, all four routes at `MANAGE_OPS`. Metrics are **versioned** (`DAILY_CLOSE_METRICS_VERSION = 1`) and **integer paise**, so a formula change is detectable rather than silently retroactive. 00:45 cron under `DAILY_CLOSE`. |
| 6 | `acde019`, `182195f` | `RUN-03` backend. `GET /analytics/food-cost` — theoretical (recipe-derived) versus actual (stock-movement) COGS per period, valued at vendor price, with **unpriced ingredients reported rather than silently costed at zero**. Gated at `MANAGE_KPIS`. |
| 7 | `6a15863`, `c2131c5` | `RUN-05` half one. `POST`/`GET /evidence/:id/review-assist` — a persisted suggestion with a verdict, a confidence and a provider, and nothing else. Boundary-guard enforced. |
| — | `117389b` | Wave-2 sibling registration on the merged branch (`FoodCostModule`, `EvidenceAssistModule`) — the cost of partitioning `app.module.ts` away from the task worktrees. |
| 8 | `f8e2f7d`, `81a0e53` | `RUN-01`. The hourly staff-nudge sweep under `STAFF_NUDGE_SWEEP`: blocked tasks and failed shipments (14-day lookback so a stuck AWB does not nudge forever). Approvals-waiting and low-stock were already dispatcher-routed by T4 and are deliberately not re-swept. |
| 9 | `2189d52`, `bc090bd`, `9d00c8c` | `RUN-05` half two. The 07:00 morning brief: gathered from the previous close, readiness, pending approvals, open shipments and low stock; generated behind the AI port; delivered per recipient through the dispatcher with a 20-hour cooldown. |
| 10 | `2048d3e`, `c707648` | `GET /usage/summary` — `by_role`, `by_path`, `by_action`, `by_user`, last-seen, node-local windows and **dense** daily series (a zero day is a zero, not a gap). `MANAGE_SYSTEM`. |
| 13 | `d48a5e3`, `cdae634`, `8a2ae4b` | Gap closure — four debts three phases deep. See below. |
| 12 | `d6c50cf`, `14fc543` | `RUN-02` screen. `/operations/daily-close` — per-channel revenue, waste, batches, reconciliation, open shipments, and a sign-off with a confirm step. Paise-aware rendering throughout. |
| 14 | `3f1898d`, `0e98987` | `RUN-03` screen. `/intelligence/food-cost` — variance bands, a movement-type chart, and an unpriced-ingredient banner that names the offenders. Linked from `/intelligence/analytics`. |
| 11 | `1242bbd`, `82128a4` | `RUN-04`. `/admin/usage` — trend, by-role, bucket and last-seen views over the T10 summary; `usage` module key and spine entry. |
| 15 | `30715b7`, `65d66f0`, `202320a` | The human edges: `EvidenceAssistPanel` (renders beside the approve/reject controls and shares no state with them), `MorningBriefCard` on the dashboard, staff contactability (phone + opt-in on the user surface, `PATCH /me/notification-prefs` enforcing the invariant), and the `NotificationSettingsForm`. `202320a` closed a nav gap T12 flagged — the `daily_close` module key and its Commerce spine entry, roles mirroring the commerce trio. |
| 16 | `06e203e`, **`dce8180`** | One migration `20260828000000_p6_run_it_layer`, the `FRONTEND_LEAD` → `MANAGE_OPS` grant, seed spec coverage, the drift gate and the runtime smoke. See below. |

Merge commits in first-parent order: `b7da851` `6885699` `8e29ac8` · `c2131c5` `182195f` `108d4be`
`117389b` `ab79518` `173d88b` `81a0e53` `c707648` `bc090bd` `9d00c8c` `cdae634` `8a2ae4b` `14fc543`
`0e98987` `82128a4` `202320a` `65d66f0` **`dce8180`**.

Wave 1 sits *before* P5b's final two merges (`dcdabd7`, `6b82f7f`) on the branch, which is why the Phase 34
record already quotes backend counts that include it. That interleaving is recorded, not hidden: it is the
reason 34's `111 suites / 1749 tests` is a merged-tree figure and not P5b's delta.

---

## Task 13 — the gap closure

Four debts, three of them carried since P3 or P5a. All four were closed in one task because each one is small
and each one had been deferred at least once for the same reason: it crossed a module boundary nobody owned.

**`refund.failed` is handled.** Deferred out of P5b by plan decision 11 and open since P5a. The handler
re-derives the order's refund state by **summing** the surviving refunds rather than reversing the failed
one — a reversal assumes the failed refund was the last write, which a concurrent partial refund makes false.

**`PATCH /tasks/:id {"status":"done"}` now re-runs the validation cascade.** This is the one the Phase 32
record called out as "pre-existing v1 behaviour": `evidence.service.ts` held the only validator and
`TasksService` never called it, because doing so meant crossing the `TasksModule ↔ EvidenceModule` edge P3
had deliberately avoided. It is now crossed **by a port**: `TASK_VALIDATION_PORT` is a symbol-injected
interface declared in `tasks/task-validation.port.ts`, implemented by `EvidenceService`, and re-exporting the
two types so `tasks.service.ts` never names `src/evidence/**` at all. `validateTask` runs inside the caller's
transaction; `emitTaskValidated` is called after it commits. The cascade now runs on **every** status change,
not only on `done`. `tasks.module.spec.ts` asserts the module graph has no cycle.

**All nine catalog writes audit.** P2's rule is "every mutating transaction writes an `AuditEvent`"; the
catalog service had grown nine write paths and only some of them complied.

**The feedback bridge dispatch is keyed per order.** It was keyed on the bridge rule alone, so a second
order's feedback deduped against the first one's dispatch and never fired. Retiring the old
`feedback_received_v1` key means historical `BridgeDispatch` rows no longer dedupe a replay — harmless
pre-launch, and recorded below rather than backfilled.

`8a2ae4b` is a follow-on type fix, not a behaviour change: the staff-nudge spec's `findMany` argument was
inferred loosely enough that the *build* tsconfig accepted it and the full `tsc --noEmit` (which includes
specs) did not.

---

## Task 16 — the migration, the grant, and the smoke

### `20260828000000_p6_run_it_layer` — 92 lines

Three `ALTER TYPE "NotificationType" ADD VALUE` (`shipment_failed`, `morning_brief`, `daily_close_due`), one
`ALTER TABLE "Notification" DROP COLUMN "is_email_sent"` — **the first DROP since the P2 baseline**, and the
discharge of a debt the Phase 33 and 34 records both carried — two `CREATE TABLE` (`DailyClose`,
`EvidenceReviewSuggestion`), and the `User` contact columns.

Two CHECKs are hand-written, because Prisma's datamodel has no CHECK concept and the generator cannot
produce them:

| Constraint | Rule |
|---|---|
| `DailyClose_signed_has_signer` | `status <> 'signed' OR (signed_by IS NOT NULL AND signed_at IS NOT NULL)` |
| `EvidenceReviewSuggestion_verdict_check` | `verdict IN ('approve', 'reject', 'unsure')` |

The first is the one that matters: a signed close with no signer is exactly the row that would make the
`AuditEvent` trail a lie, and it is now unrepresentable in the database rather than merely unreachable
through the service.

### `FRONTEND_LEAD` gains `MANAGE_OPS`

Found by the smoke, not by review. SPEC and the plan both name `FRONTEND_LEAD` as a valid daily-close signer;
all four `/daily-close` routes are `@RequiresPermission(MANAGE_OPS)`; and `FRONTEND_LEAD` did not hold
`MANAGE_OPS`. The named signer was **403-blocked from signing**. The grant is in `seed-data/roles.ts` with a
comment recording why, and `seed-data.spec.ts` now covers it.

### Runtime smoke — live stack

| # | Request | Result |
|---|---|---|
| 1 | `POST /daily-close/2026-08-27/recompute` | metrics **v1**, IST window, reconciliation **13 checked / 0 drifted** |
| 2 | `POST /daily-close/2026-08-27/sign` as `BI_LEAD` | **403** at the `MANAGE_OPS` gate — the guard is real |
| 3 | same, as `FRONTEND_LEAD` | **201 signed**, with a `daily_close.signed` `AuditEvent` |
| 4 | sign again | **409** — signing is not idempotent-by-overwrite, it is refused |
| 5 | `POST /ai/morning-brief/generate` | `provider: heuristic`, `delivered_to: 5`, headline `2026-08-27: 0 orders, 2 approvals waiting` |
| 6 | regenerate immediately | `delivered_to: 0` — the 20-hour cooldown holds |
| 7 | `POST /evidence/:id/review-assist` on pending evidence | verdict `unsure`, confidence `0.35`, provider `heuristic`; **the evidence stays `pending`** |
| 8 | `GET /analytics/food-cost` | `currency_unit: paise`, theoretical **₹16,570.00** over 3 products, unpriced: **Basmati Rice** |
| 9 | `GET /usage/summary` | 3 roles including the synthetic `CUSTOMER`, dense 31-day series |
| 10 | `PATCH /me/notification-prefs` clearing the phone | `whatsapp_opt_in` **forced off** — the invariant is server-side |
| 11 | boot | **12 cron jobs registered**, including all five new ones |

Request 7 is the one the phase exists to prove. The assist ran, produced a verdict, persisted it, and the
evidence's `approval_status` did not move. Request 5's `provider: heuristic` is the second: no API key was
configured, and the brief was produced anyway.

The five new crons, with their locks: morning brief `0 7 * * *` (`MORNING_BRIEF`), daily close `45 0 * * *`
(`DAILY_CLOSE`), stock reconciliation `30 2 * * *` (`STOCK_RECONCILIATION`), staff-nudge sweep `0 * * * *`
(`STAFF_NUDGE_SWEEP`), R2 orphan sweep `0 4 * * 0` (`R2_ORPHAN_SWEEP`) — all `Asia/Kolkata`.

---

## Gates on the merged tree (`dce8180`)

| Gate | Result |
|---|---|
| **backend** `npx jest --silent` | **125 suites / 2023 tests** (1997 passed, 26 todo), **0 failures** |
| **backend** `npx tsc --noEmit` (full, specs included) | exit `0` |
| **backend** `npx eslint "{src,apps,libs,test}/**/*.ts"` | **0 errors** |
| **backend** `npm run -s build` | exit `0` |
| **frontend** `npx tsc --noEmit` | exit `0` |
| **frontend** `npx eslint .` | **0 errors**, 56 warnings (ceiling 60) |
| **frontend** `npm run build` | compiled, **85 routes** |
| `prisma migrate deploy` | applied |
| **drift gate** | `No difference detected.` on the main tree |
| `seed:reference` | green — **8 roles, 49 modules, 14 settings** |

The backend gate was run as a **full** `tsc --noEmit`, not the build tsconfig. That distinction is what
`8a2ae4b` fixed: the build config excludes specs, so a loosely-typed test argument passes the build and fails
the full check. Both are green at `dce8180`.

Frontend warnings moved 53 → 56 against the ceiling of 60 that Phase 34 ratcheted down from 80. All are React
Compiler diagnostics on the new screens; none is an error and none is new in kind.

---

## Deliberate deviations

1. **The `AiProviderPort` degrades internally rather than surfacing a provider error.** Plan decision 4
   settled this: an Anthropic refusal or outage falls back to the heuristic *inside* the provider, so no
   caller has an "AI is down" branch to get wrong. The consequence is that the refusal fallback is
   local-only — there is no signal at the call site distinguishing "the model declined" from "the model was
   never asked", beyond the `provider` field on the persisted suggestion.
2. **The staff-nudge sweep covers two of the four nudge types, not all four.** Approvals-waiting and
   low-stock are already dispatcher-routed by T4 at the moment the condition arises; sweeping for them
   hourly would produce a second delivery path with its own cooldown state, for the same event.
3. **Failed shipments carry a 14-day lookback.** Without it a permanently stuck AWB nudges forever. Fourteen
   days is long enough to cover a courier's own retry window and short enough that the queue drains.
4. **The task validation cascade crosses `TasksModule ↔ EvidenceModule` through a port, not an import.**
   P3 avoided the edge because it is a real cycle. `TASK_VALIDATION_PORT` breaks it by inverting the
   direction: `tasks` declares the interface it needs, `evidence` implements it, and a module spec asserts
   the graph stays acyclic.
5. **`refund.failed` re-derives from the sum of surviving refunds** rather than reversing the failed one.
   A reversal is only correct if the failed refund was the last write.
6. **Daily-close metrics are versioned integers in paise**, not floats. A formula change bumps the version,
   so an old close and a new close are distinguishable rather than silently re-interpreted.
7. **Signing a close twice is a `409`, not an overwrite.** The `AuditEvent` records who signed; a second
   signature would either lose the first or duplicate it, and neither is a fact about the day.
8. **`202320a` and the two registration commits (`117389b`, `9d00c8c`) are harness commits on the merged
   branch, not task work.** `app.module.ts` and `spine.ts` were partitioned away from the task worktrees so
   sixteen agents could not race on them; the price is that sibling registration lands separately, and it is
   left attributable rather than folded into a task's merge.

---

## Observations recorded, not fixed

New in P6. None blocks anything shipped.

**Backend:**

- **`GET /evidence?approval_status=` is a no-op** — the filter is accepted and ignored.
- **There is no `GET /me/notification-prefs`.** The `PATCH` exists; reading the current values means reading
  the user record.
- **The phone pattern is 10–13 digits with no `+`.** It accepts an Indian mobile with or without the country
  code and rejects an E.164 string, which is what a paste from a contacts app produces.
- **`mockAiResolver()` lacks `settings()`** — the specs that need it layer it locally, which will drift.
- **The Anthropic refusal fallback is local-only** (deviation 1).
- **The retired `feedback_received_v1` bridge key** means pre-existing `BridgeDispatch` rows no longer dedupe
  a replay. Harmless pre-launch; would need a backfill if the ledger were live.

**Frontend:**

- **`CreateUserDialog` lacks the contact fields.** `ContactNotificationsFields` exists and is a drop-in; the
  dialog was not in T15's file list.
- **`lib/types/settings.ts` should absorb the `notifications` block** — it is typed locally in
  `components/ops/admin/settings/notifications-setting.ts` for now, which is a second source of truth for a
  shape the backend owns.
- **No personal notification-prefs UI consumes `PATCH /me/notification-prefs`.** Staff contactability is
  editable by an admin on the user surface; a person cannot yet change their own opt-in from a screen.
- **There is no `/admin/audit` browser.** The daily-close drift drill-down therefore points at
  `/operations/inventory`, which shows the stock but not the `AuditEvent` that recorded the drift.

**Carried from P5b and still open:** the catalog-availability `capacity` branch ignoring live holds; no
`sort` param on `GET /catalog/products`; `PUBLIC_INCLUDE` variants lacking `stock_on_hand`; `getOrderById`
items lacking the `event` relation; no staff receipt endpoint; no `PATCH /catalog/media/:id`; no `order_id`
filter on `GET /shipments`; `app/layout.tsx`'s hardcoded `metadataBase` versus `lib/seo/metadata.ts`'s
`NEXT_PUBLIC_SITE_URL`; unknown routes 307-bouncing to `/team`; the three soft-404s; the unexercised sitemap
cursor walk; `AccountLink`'s own profile `GET`; `use-cart.ts`'s stale header comment.

---

## Operator / user actions required

Unchanged in substance from the Phase 34 record — none can be done from the repository, and P6 makes the
first one load-bearing rather than anticipatory.

1. **Submit the five Meta WhatsApp templates** (`staff_approval_waiting`, `staff_task_blocked`,
   `staff_low_stock`, `staff_shipment_failed`, `staff_morning_brief`), then flip
   `settings.notifications.whatsapp_enabled`. Until both are done the dispatcher's WhatsApp channel is
   correctly inert: the master switch is off and no template resolves. In-app and email deliver regardless.
2. **Create the R2 lifecycle rule `expire-exports-30d`** per `docs/R2-LIFECYCLE.md`. A console action; the
   weekly orphan sweep is the code half and it shipped in Wave 1.
3. **Set `NEXT_PUBLIC_R2_PUBLIC_URL` in production.**
4. **Add the three Razorpay test-mode CI secrets** (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`) — the `frontend-e2e` job still cannot run green without them.

---

## Deferrals carried forward past v2.0

These survive the milestone. They are recorded here because v2.0 closes with them open, not because P6
introduced them.

- **`QA-05`'s second half — the Postgres-backed integration harness** (`test/jest-integration.json`). Carried
  from Phase 31's `QA-02` through 33 and 34; now four phases deep. Unit coverage plus the Playwright storefront
  smoke plus the recorded API walk-throughs are what stand in for it.
- **`QA-03` — Playwright smoke test 1 (the ops shell).** The harness exists (Phase 34 built it for smoke 2);
  smoke 1 has never had an owner.
- **A fresh operator walk-through of the seven staff commerce screens** on a merged tree. Recorded as
  outstanding in the Phase 34 record and still outstanding; P6's smoke exercised the *new* operational
  surfaces, not P5b's commerce ones.
- **Soft-404 status codes** and the **`metadataBase` / `NEXT_PUBLIC_SITE_URL` split.**
- **Shiprocket sandbox** — the eight adapter request/response shapes remain untested against reality;
  `SystemSetting['shipping'].provider` still seeds `manual`.
- **The 15-minute booking hold versus the 30-minute pending order** — a payment captured after its hold was
  swept still throws inside `applyCommercialEffects`.
- **`/admin/approval-policies`**, **`Order.zone_id` → `fulfilment_zone_id`**, **multi-shipment orders**.
- **P3 decision 4 has no backfill**: `requires_approval: true` with zero `Approval` rows blocks validation, so
  on a populated database affected tasks stop being `valid` on their next cascade — and T13 made that cascade
  run on every task status change, which makes the effect arrive sooner than it would have.

---

## Status

**Phase 35 (P6) is complete.** All 16 tasks of `docs/superpowers/plans/2026-08-24-p6-run-it-layer.md` are
merged at `dce8180`, gated, migrated and runtime-smoked. Every `RUN-0x` requirement has a live surface:
staff nudges through a dispatcher that respects opt-in and quiet hours (`RUN-01`), a signed daily close with
a real 403/201/409 permission story (`RUN-02`), theoretical-versus-actual food cost that names its unpriced
ingredients (`RUN-03`), a usage dashboard over `UsageEvent` (`RUN-04`), two AI assists that produced output
with no API key configured and changed no state (`RUN-05`), and five locked crons plus the R2 lifecycle
documentation (`RUN-06`).

Gates at `dce8180`: backend **125 suites / 2023 tests, 0 failures** · full `tsc` clean · 0 lint errors ·
build green. Frontend `tsc` clean · 0 errors / 56 warnings against a ceiling of 60 · build green, 85 routes.
`migrate deploy` applied, drift gate `No difference detected.`, `seed:reference` green at 8 roles / 49
modules / 14 settings.

**The v2.0 milestone (Mission OS + Marketplace, Phases 29–35) is COMPLETE.** Seven phases from a schema
reset to a running node: P1 stopped the bleeding, P2 laid one migration baseline with `Node` and enums from
day one, P3 made operational events produce mission evidence automatically, P4 gave every role a spine and a
"what I must move today", P5a and P5b built and faced the marketplace, and P6 made the whole thing something
a team operates rather than something a team demonstrates.

**Next milestone is intentionally open.** The talent module is parked for v2.1 — the SPEC's own spine carries
a "no route" note against it, and nothing in v2.0 was written assuming it. What a v2.1 must not skip is in
the deferrals list above: the integration harness is four phases deep, and `QA-03` has never had an owner.
