# Phase 31-01 — P3 "Mission Bridge" Summary

**Branch:** `v2-os-marketplace`
**Range:** `ced2385..080a664`
**Plan:** `docs/superpowers/plans/2026-08-23-p3-mission-bridge.md` (17 tasks)
**Date:** 2026-08-23

P3 closes the loop SPEC §0 describes — *I do the real work → the work itself becomes the proof → someone with skin in the game signs it off → a meter I care about moves.* P2 shipped every table this needed; P3 adds the behaviour, plus one additive migration (Task 17).

---

## What P3 delivered

| Task | Commit(s) | What landed |
|---|---|---|
| 1 | `6a0c4a7`, `29fd6ca` | Schema delta: `BridgeOutcome` enum, `BridgeDispatch` model (the exactly-once ledger), `ReadinessMeter.task_value/derived_value/last_computed_at`, three read-path indexes. Shared test mocks extended; `readiness` settings key allowlisted. |
| 2 | `167e2e1`, `89b877d` | `common/events/domain-events.ts` — the typed after-commit catalogue: `DomainEvent` names, per-event payload interfaces, `domainEventBase`, `userActor`/`customerActor`/`systemActor`, `emitDomainEvent` (emits after commit inside try/catch, swallows and logs). `notifications/events/notification-events.ts` deleted. |
| 3 | `f111844`, `fa003c0` | `ApprovalPolicyService` in its own `@Global()` `ApprovalPolicyModule` (`resolve` / `materialise` / `isSatisfied`), `approval-policies` CRUD, `DOMAIN_LEAD_ROLE` fallback expansion for the `is_default` policy. |
| 4 | `8910cc8`, `f99e6d9` | `MissionBridgeService` — `apply`, `resolveTaskId`, `dispatchOnce`, `createBridgeEvidence`, `listDispatches` — plus `mission-bridge.rules.ts` (the rule table), `bridge-links.ts` (`bridgeDeepLink` / `renderBridgeNote`) and `MissionBridgeListener`, the only `@OnEvent` subscriber that writes. |
| 5 | `9a56fa5`, `3eefa8c` | Twelve ops services emit typed domain events after commit: inventory, orders, KDS, prep batches, waste, purchase orders, fulfilment, catalog, vendors, feedback, events. Repo-wide `eventEmitter.emit(` count driven to zero outside the catalogue. |
| 6 | `aa38b79`, `c65ca7d` | The four SPEC §4.3 formulas as pure functions (`standardization`, `procurement`, `sales`, `quality`), `clamp`/`round2`, `DERIVED_FORMULAS`, `HYBRID_PARTNER_CODES`, and `blendMeterValue(mode, task_value, derived_value)`. No database needed to test them. |
| 7 | `72885ab`, `17946c9` | `ReadinessDerivationService` — the Prisma gatherers plus `recomputeMeter` / `recomputeAll` / `recomputeWithHybrids`; `GET /readiness-meters/:code/history` and `/signals`; `POST /readiness-meters/recompute`. |
| 8 | `833f979`, `314a0e5` | Task create/update materialises one pending `Approval` per role required by the `(scope=task, domain)` policy, in the same transaction. |
| 9 | `4d94a5c`, `2067575` | The approvals engine: `decide` / `cascade` / `findApprovals` / `countForUser` / `effectiveRoleCodes` / `entityAuthorId`, founder override with reason, self-approval refused, delegation honoured, and the validation cascade that now requires the policy to be satisfied. |
| 10 | `af64658`, `ee12d1e` | Recipe `draft → pending` via `POST /recipes/:id/submit` materialises `Approval{entity_type: recipe}` rows; the legacy `PATCH /recipes/:id {status:'approved'}` flip now 400s; `GET /recipes/:id/approvals`. |
| 11 | `88976e6`, `03b017c` | Decision tiers and votes: `POST /decisions/:id/votes`, `tallyDecision`, tier-1 auto-approve by the domain lead, tier-2 `aligned` → `approved`, tier-3 founder `resolve`, `reopen`. |
| 12 | `f22d24b`, `4bf70ed` | The bridge's full `apply`: `writeSignal` into `ReadinessSignal`, `recomputeWithHybrids` after each signalling event, and `spawnLowRatingTask` for `feedback.received` with rating ≤ 2. |
| 13 | `14a401a`, `42fe39e` | `ReadinessCron.snapshotAll()` — the nightly `ReadinessSnapshot` writer under `withAdvisoryLock(ADVISORY_LOCK.READINESS_SNAPSHOT)`, upserting on `@@unique([meter_id, date])`. |
| 14 | `425b6f9`, `f2a5c7b` | The seeded `SYSTEM` role + system user (`11111111-…-111112`, `status: 'system'`, `password_hash: '!'`) from `seed-data/system-actor.ts`; `UsersService` hardened to hide it and refuse update/delete. |
| 15 | `47433a3`, `bec9e1e` | **Frontend** — `/readiness` shows derived values, the 50/50 blend and 90-day history. |
| 16 | `3eedf09`, `700c72d` | **Frontend** — approvals inbox on policy rows, decision vote UI, bridge evidence marker. |
| 17 | `e6dade0`, `080a664` | **Single additive migration**, applied, seeded, drift-gated and smoke-tested — see below. Plus the `SYSTEM`-role hygiene fix Task 14 left behind. |

---

## Task 17 — the migration

`backend/prisma/migrations/20260823180000_p3_mission_bridge/migration.sql`, generated with `npx prisma migrate dev --create-only --name p3_mission_bridge` (the AI-agent guard did **not** refuse it, so the `migrate diff --script` fallback was not needed) and renamed to the deterministic directory name.

Contents, verbatim in shape:

- `CREATE TYPE "BridgeOutcome" AS ENUM ('applied', 'skipped_no_task', 'skipped_no_mission', 'skipped_no_owner', 'failed');`
- `ALTER TABLE "ReadinessMeter"` — three columns: `derived_value DOUBLE PRECISION`, `last_computed_at TIMESTAMPTZ(3)`, `task_value DOUBLE PRECISION NOT NULL DEFAULT 0`
- `CREATE TABLE "BridgeDispatch"` (`id`, `node_id` defaulted to the seeded node, `rule_key`, `event`, `source_type`, `source_id`, `task_id?`, `evidence_id?`, `outcome` defaulted `applied`, `detail?`, `created_at`)
- `CREATE INDEX "BridgeDispatch_node_id_created_at_idx"`, `"BridgeDispatch_event_created_at_idx"`
- `CREATE UNIQUE INDEX "BridgeDispatch_rule_key_source_type_source_id_key"`
- `CREATE INDEX "Approval_required_role_code_status_idx"`, `"Decision_status_created_at_idx"`, `"Evidence_task_id_source_idx"`
- `ALTER TABLE "BridgeDispatch" ADD CONSTRAINT "BridgeDispatch_node_id_fkey" … ON DELETE RESTRICT`

Statement census (the plan's own gate):

| Check | Expected | Actual |
|---|---|---|
| `CREATE TYPE` | 1 | **1** |
| `CREATE TABLE` | 1 | **1** |
| `DROP ` | 0 | **0** |
| `ADD COLUMN` | 3 | **3** |
| `CREATE INDEX` | 5 | **5** |
| `CREATE UNIQUE INDEX` | 1 | **1** |

Nothing unexpected slipped in from any task. The plan predicted the third `ReadinessMeter` column as `last_derived_at`; the merged schema names it **`last_computed_at`** — a naming difference only.

---

## Task 17 — verification evidence

### Where it was applied

Docker Postgres `konma-postgres` on `localhost:5433`, database `konma`, shadow `konma_shadow` — the same live database P2 left seeded. `prisma migrate reset` was never available (Prisma 6.19 AI-agent guard), so nothing was dropped.

### 1. Migration applies cleanly

```
$ npx prisma migrate deploy
2 migrations found in prisma/migrations

Applying migration `20260823180000_p3_mission_bridge`

The following migration(s) have been applied:

migrations/
  └─ 20260823180000_p3_mission_bridge/
    └─ migration.sql

All migrations have been successfully applied.
```

```
migration_name                        | applied
--------------------------------------+---------
20260823120000_p2_platform_foundation | t
20260823180000_p3_mission_bridge      | t
```

### 2. Drift gate — schema and migrations agree exactly

```
$ npx prisma migrate diff \
    --from-migrations prisma/migrations \
    --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url postgresql://konma:konma@localhost:5433/konma_shadow \
    --exit-code

No difference detected.

EXIT=0
```

### 3. Seeds — idempotent, identical on both runs

```
$ npm run seed:reference        # run 1 and run 2, byte-identical
[seed:reference] start
[seed:reference] done — 1 node, 8 roles, 47 modules, 12 meters, 8 approval policies,
  8 zones, 2 brands, 7 channels, 20 unit conversions, 25 categories, 9 settings,
  17 guide sections, 1 system actor
```

No unique-constraint error on the second run. `seed:demo` was **not** re-run (it never resets an existing user's password anyway).

Seed verification:

```
  code  |  name  | array_length          -- SYSTEM role, empty permissions
--------+--------+--------------
 SYSTEM | System |

                  id                  |       email        | status
--------------------------------------+--------------------+--------
 11111111-1111-4111-8111-111111111112 | system@konma.local | system

         code         |    mode     |    formula_key       -- 12 meters
----------------------+-------------+--------------------
 ART_EXPERIENCE       | task_driven |
 BACKEND              | hybrid      | hybrid_backend_v1
 BI                   | task_driven |
 FRONTEND             | hybrid      | hybrid_frontend_v1
 LIFESTYLE_EXPERIENCE | task_driven |
 PROCUREMENT          | derived     | procurement_v1
 QUALITY              | derived     | quality_v1
 SALES                | derived     | sales_v1
 STANDARDIZATION      | derived     | standardization_v1
 TALENT               | task_driven |
 TECH                 | task_driven |
 VILLA                | task_driven |
```

4 `derived` + 2 `hybrid` + 6 `task_driven` = 12, and one `readiness` `SystemSetting` row. 8 `ApprovalPolicy` rows:

```
   scope    |   domain    | mode | min_approvals |         required_role_codes          | is_default
------------+-------------+------+---------------+--------------------------------------+------------
 task       |             | n_of |             1 | {}                                   | t
 task       | food        | all  |             2 | {BACKEND_LEAD,FRONTEND_LEAD}         | f
 recipe     | food        | all  |             2 | {BACKEND_LEAD,FRONTEND_LEAD}         | f
 pricing    | bi          | all  |             2 | {BI_LEAD,FRONTEND_LEAD}              | f
 vendor     | procurement | all  |             2 | {PROCUREMENT_LEAD,BACKEND_LEAD}      | f
 experience | design      | all  |             2 | {FRONTEND_LEAD,DESIGN_OUTREACH_LEAD} | f
 tech       | tech        | all  |             2 | {TECH_LEAD,FOUNDER_ADMIN}            | f
 hiring     | talent      | all  |             2 | {TALENT_LEAD,FOUNDER_ADMIN}          | f
```

### 4. Runtime smoke — SPEC §10 smoke test 1

`npm run build` → `PORT=4019 node dist/src/main.js` → `Nest application successfully started`. Auth tokens are httpOnly cookies; the smoke extracts `access_token` from the cookie jar and re-sends it as `Authorization: Bearer`.

**Note on `POST /auth/login`:** it is throttled at 5 requests / 5 minutes per IP, so the smoke logs in exactly once per role and caches the token.

#### 4a. Login → task → evidence → approve → meter moves

| # | Request | Status | Key fact observed |
|---|---|---|---|
| 1 | `POST /auth/login` ×4 (admin, BACKEND_LEAD, FRONTEND_LEAD, BI_LEAD) | `201` | `Set-Cookie: access_token, refresh_token`; no token in the body |
| 2 | `GET /approval-policies` | `200` | 8 rows |
| 3 | `GET /users` | `200` | 8 rows — the system user is **not** among them |
| 4 | `GET /roles` | `200` | 8 rows — `SYSTEM` is **not** among them (the Task 17 hygiene fix) |
| 5 | `POST /missions` + `PATCH /missions/:id {"status":"active"}` | `201`/`200` | mission active |
| 6 | `POST /tasks` `{domain:'food', requires_approval:true, readiness_meter_id:<BACKEND>, readiness_value:20, xp:50}` | `201` | `valid: false`, `status: todo` |
| 7 | `GET /approvals?status=pending&entity_type=task` | `200` | **2 pending rows** for the task — `BACKEND_LEAD` and `FRONTEND_LEAD`, exactly the `(task, food)` policy |
| 8 | `PATCH /tasks/:id {"status":"done"}` | `200` | `status: done`, `valid: false` |
| 9 | `POST /tasks/:id/evidence` | `201` | `source: manual`, `approval_status: pending` |
| 10 | `POST /evidence/:id/approve` | `201` | `{"valid":false,"valid_xp":0,"newly_valid":false}` — **the policy gate blocks validation** (decision 4 proven live) |
| 11 | `POST /approvals/:id/decide {"decision":"approve"}` as `BACKEND_LEAD` | `201` | `{"valid":false,…}` — 1 of 2, `mode: all` not satisfied |
| 12 | `POST /approvals/:id/decide` as `FRONTEND_LEAD` | `201` | `{"valid":true,"valid_xp":50,"newly_valid":true,"user":{"xp_total":50,"level":1}}` |
| 13 | `GET /tasks/:id` | `200` | `valid: true`, `valid_xp: 50`, `verified: true` |
| 14 | `GET /readiness-meters` | `200` | `BACKEND {mode:"hybrid", task_value:20, derived_value:null, current_value:10}` — the 50/50 blend of 20 and 0 |
| 15 | `GET /audit?entity_type=approval` | `200` | `["approval.decided","approval.decided","approval.decided","approval.decided"]` |
| 16 | `POST /approvals/:id/decide` as the task **owner** | `403` | `{"message":"You cannot approve your own work","error":"Forbidden","statusCode":403}` |

#### 4b. The bridge

| # | Request | Status | Key fact observed |
|---|---|---|---|
| 1 | `POST /recipes` | `201` | `status: draft`, `version: 1` |
| 2 | `POST /tasks {subject_type:'recipe', subject_id:<recipe>}` | `201` | the subject task the bridge will attach evidence to |
| 3 | `POST /recipes/:id/submit` | `201` | `status: pending` |
| 4 | `PATCH /recipes/:id {"status":"approved"}` | `400` | `"Recipe approval is granted through the approvals queue, not by setting status."` — the legacy flip is gone |
| 5 | `GET /recipes/:id/approvals` | `200` | 2 pending rows: `BACKEND_LEAD`, `FRONTEND_LEAD` |
| 6 | `POST /approvals/:id/decide` ×1 | `201` | recipe still `pending` after 1 of 2 |
| 7 | `POST /approvals/:id/decide` ×2 | `201` | **recipe `status: approved`** — flipped inside the approvals transaction |
| 8 | `GET /tasks/:subjectTask/evidence` | `200` | `{"type":"system","source":"bridge","bridge_event":"recipe.approved","approval_status":"pending","url":"/operations/recipes/274fead7-…","uploaded_by":"11111111-1111-4111-8111-111111111112"}` — app-relative deep link, system uploader, never auto-approved |
| 9 | `GET /mission-bridge/dispatches?limit=10` | `200` | `{"rule_key":"recipe_approved_v1","event":"recipe.approved","source_type":"recipe","outcome":"applied","task_id":"48ab4d8d-…","evidence_id":"b0f2f2dd-…"}` |
| 10 | `GET /readiness-meters/STANDARDIZATION/signals?limit=20` | `200` | `{"source_event":"recipe.approved","value":1}` |
| 11 | `POST /inventory/adjust` then `POST /kitchen/waste` | `201`/`201` | `waste_logged_v1` → `outcome: "skipped_no_task"` (no subject task) **and** a `QUALITY` signal `{"source_event":"waste.logged","value":-1}` — the signal is written independently of the evidence bail-out |
| 12 | `POST /feedback {"rating":1}` | `201` | `feedback_received_v1` → `outcome: applied`, spawned `Task{task_type:'improvement', domain:'food', owner: FRONTEND_LEAD, requires_approval: true}` |
| 13 | `POST /readiness-meters/recompute` | `201` | `[{"PROCUREMENT":0},{"QUALITY":100},{"SALES":0},{"STANDARDIZATION":100},{"BACKEND":60},{"FRONTEND":0},…]` — 12 entries |
| 14 | `GET /readiness-meters` | `200` | `BACKEND {task_value:20, derived_value:100, current_value:60}` — 0.5 × 20 + 0.5 × 100 = 60 ✓ |
| 15 | `GET /readiness-meters/STANDARDIZATION/history?days=30` | `200` | `{"code":"STANDARDIZATION","mode":"derived","current_value":100,"points":[{"date":"2026-08-23","value":100}]}` |
| 16 | `POST /decisions {tier:'tier_1', impact_scope:'food'}` then `POST /decisions/:id/votes {"vote":"approve"}` as `BACKEND_LEAD` | `201`/`201` | `required_role_codes: ["BACKEND_LEAD"]` resolved from the domain; **`status: approved`** on the single domain-lead vote |
| 17 | `POST /decisions {tier:'tier_2', required_role_codes:[BACKEND_LEAD,FRONTEND_LEAD,BI_LEAD]}` + 3 approve votes | `201` each | `status: approved`; `GET /audit?entity_type=decision` → `["decision.resolved","decision.aligned","decision.voted","decision.voted","decision.voted","decision.created"]` — `aligned` is recorded as a transition, then the row rests at `approved` |
| 18 | `POST /decisions/:id/votes` as a role **not** on the decision | `403` | `{"message":"Your role is not on this decision"}` |

#### 4c. Exactly-once and the nightly job

Run through a one-off Node script that boots the compiled Nest application context (`NestFactory.createApplicationContext(AppModule)`), re-emits `recipe.approved` for the already-handled recipe, and calls `ReadinessCron.snapshotAll()` twice:

```
=== 1. bridge replay is a no-op ===
  before: BridgeDispatch=1  bridge Evidence(recipe.approved)=1
prisma:error Invalid `tx.bridgeDispatch.create()` invocation …
  Unique constraint failed on the fields: (`rule_key`,`source_type`,`source_id`)
  after replay: BridgeDispatch=1  bridge Evidence(recipe.approved)=1
  RESULT: no-op (exactly-once holds)

=== 2. ReadinessCron.snapshotAll() ===
  ReadinessSnapshot rows: before=0 after 1st run=12 after 2nd run=12
    STANDARDIZATION        2026-08-23  100
    BACKEND                2026-08-23  60
    QUALITY                2026-08-23  60
    ART_EXPERIENCE         2026-08-23  0
    PROCUREMENT            2026-08-23  0
    LIFESTYLE_EXPERIENCE   2026-08-23  0
```

The unique-constraint failure is the *expected* mechanism: `dispatchOnce` claims the `(rule_key, source_type, source_id)` row first and catches the collision, so no second evidence row, no second signal, no second spawned task. `snapshotAll` writes 12 rows for today and the second run is a no-op through the `@@unique([meter_id, date])` upsert.

Final ledger state: **8 `BridgeDispatch` rows, 3 `ReadinessSignal` rows, 12 `ReadinessSnapshot` rows.**

### 5. Static gates (HEAD = `080a664`)

| Gate | Result |
|---|---|
| `npx jest --silent` | **75 suites passed / 75 total**, 974 tests (948 passed, 26 todo) |
| `npx tsc --noEmit -p tsconfig.json` | exit `0` |
| `npm run -s lint:check` | **0 errors**, 3790 warnings |
| `npm run -s build` | exit `0`, `dist/src/main.js` written |
| `npx prisma validate` | `The schema at prisma\schema.prisma is valid` |

The plan predicted 69 suites; the merged tree carries 75 (the implementers added more spec files than the plan enumerated, and Task 17 adds `roles.service.spec.ts`).

`git status --short` at the end of the phase shows only ` M CLOUDFLARE-SETUP.md` — pre-existing, deliberately untouched.

### 6. Demo credentials

The passwords recorded in the P2 summary belong to the throwaway `konma_p2_verify` database and do not authenticate against `konma`; `seed:demo` never resets an existing user's password, so it cannot re-issue them. Task 17 rotated all eight demo passwords once, with bcrypt cost 12, so the runtime smoke could log in.

| Role | Email | Password |
|---|---|---|
| FOUNDER_ADMIN | admin@konma.store | `Br-Oym06xPq8vaHLFSy0h3fE` |
| BACKEND_LEAD | sadhana@konma.store | `tSWq4xQzWpijJmej8jQk5Yz5` |
| FRONTEND_LEAD | advitha2@konma.store | `oVBZ9-9mQZ_5u0i4v3uOPMoF` |
| BI_LEAD | hasmitha@konma.store | `sz8ziH5XnYJql2z0ighjst3s` |
| PROCUREMENT_LEAD | surya@konma.store | `G3wp7vb703jb6lQAxB5cnT4K` |
| TALENT_LEAD | sathya@konma.store | `sQMQ4aON3DJwCfXX6tN1dXBE` |
| TECH_LEAD | vinit@konma.store | `4btL_RQY8BSBalJG2B81OsIy` |
| DESIGN_OUTREACH_LEAD | advitha@konma.store | `6-3vihdzOqF1MZ-mtizi0Pk8` |

---

## Frontend (Tasks 15–16)

| Task | Commit(s) | What landed |
|---|---|---|
| 15 | `47433a3`, `bec9e1e` | `/readiness` shows derived values, the 50/50 blend and 90-day history. New `MeterHistoryChart.tsx`, `MeterModeBadge.tsx`, `MeterBreakdown.tsx`; `ReadinessGrid`, `ReadinessMeterRing` and `MeterDetailPanel` updated; `lib/types/readiness.ts` gains `MeterMode` / `MeterHistoryPoint` / `MeterSignal`. |
| 16 | `3eedf09`, `700c72d` | Approvals inbox reads policy-generated `Approval` rows (task, recipe and decision subjects, not just evidence), decision vote UI (`DecisionVotePanel.tsx`), and the "Bridge" marker on system evidence. New `lib/types/approvals.ts` and `ApprovalEntityChip.tsx`; `ApprovalQueue`, `ApprovalItem`, `OverrideDialog`, `DecisionDetail`, `DecisionList`, `EvidenceFeedCard`, `EvidenceItem`, `Sidebar` updated. |

Both were built in separate worktrees and merged into `v2-os-marketplace` ahead of Task 17; neither touches `backend/`. The backend response shapes they consume are the ones recorded in the smoke tables above — in particular the history envelope `{code, mode, current_value, points:[{date,value}]}` and `POST /approvals/:id/decide {decision, note?}`.

**Frontend gates on the merged tree (harness, after `700c72d`):** `npx tsc --noEmit` exit 0 · `npx eslint .` 0 errors / 67 warnings · `npm run build` compiled successfully. Phase 31 is done end to end.

---

## Deliberate deviations and deferrals

### Deviations taken during implementation (beyond the plan's own decision list)

1. **`BridgeDispatch` is the exactly-once ledger** (plan decision 1, confirmed in code). One `@@unique(rule_key, source_type, source_id)` governs evidence, signal *and* task-spawn idempotency, and doubles as the observability record behind `GET /mission-bridge/dispatches`. `ReadinessSignal` needs no unique constraint. Proven live in §4c.
2. **`requires_approval: true` with zero `Approval` rows now blocks validation** (plan decision 4). v1 treated "no rows" as satisfied, so the approval gate had never executed. This is a live behaviour change; it rewrote assertions in `evidence/__tests__/cascade.spec.ts` and is asserted explicitly in the smoke (row 10 of §4a).
3. **`applyRule` is a named seam.** The bridge's per-rule application is factored out so a rule can be exercised in a spec without the listener, the emitter or a transaction.
4. **Task spawn is independent of the evidence no-task bail-out.** `spawnLowRatingTask` runs before the `rule.evidence && !taskId` check, and a rule's signal is written even when the dispatch outcome is `skipped_no_task`. Observed live: `waste.logged` recorded `skipped_no_task` *and* a `QUALITY` signal of `-1` in the same dispatch.
5. **The history endpoint returns an envelope, not a bare array.** `GET /readiness-meters/:code/history` → `{code, mode, current_value, points: [{date, value}]}`. The plan wrote "at least one point"; the shape is the envelope.
6. **`snapshotAll()` lives on `ReadinessCron`** (`backend/src/readiness/readiness.cron.ts`), not on `ReadinessDerivationService` as the plan's name-consistency table said. The advisory lock lives with it.
7. **`POST /decisions/:id/votes` is guarded by `VIEW_ROLE_SCOPED`, with the real ACL in the service.** A permission fine-grained enough to mean "may vote on *this* decision" does not exist in the `Permission` enum; the controller therefore admits any role-scoped viewer and `DecisionsService` rejects a voter whose role is not in `required_role_codes` with `403 "Your role is not on this decision"` (verified, §4b row 18).
8. **`CreateDecisionDto.tier` and `.impact_scope` are optional**, so the v1 decision form keeps working. Omitted `tier` means `tier_1` (the column default); an unrecognised `impact_scope` is treated as `ops`, the value the service hardcoded before P3.
9. **Recipe resubmission clears the prior gate.** `POST /recipes/:id/submit` on a recipe that was previously submitted discards the stale pending `Approval` rows before materialising fresh ones, so a rejected-then-resubmitted recipe cannot be approved by votes cast against the earlier version.
10. **`order.delivered` is dormant.** The rule and the emitter exist, but no code path moves an order `dispatched → delivered` until P5 opens it. The event is declared and wired; nothing fires it yet.
11. **`ReadinessDerivationService` owns the gatherers**, and the pure formulas in `derivation/derived-meters.ts` own the arithmetic. The gatherers are thin Prisma shells (`groupBy`/`aggregate` over indexed columns in a 7-day window) so the four SPEC §4.3 formulas stay unit-testable without a database.
12. **`ReadinessMeter.last_computed_at`**, not `last_derived_at` as the plan's file structure wrote it.
13. **`approval_decided_v1` carries `subject_type: TaskSubjectType.decision`** even when the approval's entity is a task, because `TaskSubjectType` has no `task` member. The rule is `evidence: false`, so the row is a pure ledger entry and the mislabelled `source_type` never resolves a subject. Harmless today; worth a `task` enum member if the rule ever grows evidence.

### Observations recorded, not fixed

- **`PATCH /tasks/:id {"status":"done"}` does not re-run the validation cascade.** `validateTask` is reachable only from evidence approve/reject and approval decide/override. In the normal flow the last event is always an approval or an evidence decision, so `valid` lands correctly — but a task whose evidence and approvals were all settled *before* it was marked done stays `valid: false` until something touches its evidence or approvals again. This predates P3 (v1 behaviour) and a fix means calling into `EvidenceService` from `TasksService`, which is the circular edge P3 deliberately avoided. `backend/src/evidence/evidence.service.ts:334` (`validateTask`), `backend/src/tasks/tasks.service.ts` (no caller).
- **`feedback.received` with no `order_id` keys the dispatch on the feedback id.** `BRIDGE-04` says "one improvement task per order"; with a null order there is no order to dedupe on, so each order-less 1-star feedback spawns its own task. Correct for the guest-feedback path, but worth a second look when the marketplace review flow lands in P5.
- **`konma` had zero orders and zero ingredient stock**, so `POST /kitchen/waste` first returned `400 "Insufficient stock: have 0 kg, need 1.5"`. The smoke posted a `POST /inventory/adjust` of +10 kg first. `SALES` and `PROCUREMENT` therefore both compute to `0` on this database — the formulas are exercised by their unit specs, not by seeded volume.

### Deferrals (from the plan's Self-review, re-confirmed)

- **`QA-03` (Playwright smoke test 1) → Phase 32.** Neither package has Playwright or a preview-server harness, and the selectors a browser test would target are the Phase 32 header, spine and `/tasks` screens. The exact six-step flow is executed and recorded as curl above, so the *behaviour* is proven here and only the automation moves.
- **`QA-02` integration harness → Phase 33.** P3 delivers unit coverage for every multi-write path it adds plus this runtime smoke against the real database. The CI job with a Postgres service belongs with Phase 33's order-confirm/shipment transactions. `QA-02` is therefore **partially** met, not fully — the roadmap text says so rather than ticking it silently.
- **Emitters for `shipment.status_changed`, `shipment.delivered`, `review.published`, `coupon.redeemed`, `booking.attended` → Phase 33.** Declared in `domain-events.ts` with full payload types and listed in `mission-bridge.rules.ts` as `emitter: 'P5'`; Phase 33 adds one `emitDomainEvent` call per event and nothing else.
- **`Review` in the `QUALITY` formula → Phase 33.** P3 computes the rating half from `Feedback.rating` behind the named `ratingSource` seam.
- **`/admin/approval-policies` UI → Phase 32.** The API ships here; the admin screen belongs with `/admin/modules`.
- **Header approvals badge, spine nav, `/tasks`, Mission Control §6.5 layout → Phase 32.**
- **WhatsApp/QStash nudges for pending policy approvals → Phase 35 (`RUN-01`).** `notifications.cron.ts:scanApprovalsPending` already dispatches for `Approval` rows and keeps working now that those rows finally exist.
- **`Notification.is_email_sent` removal → Phase 32**, with the notifications and IA pass.
- **Backfill of `valid` for tasks affected by decision 4** → not done. Only the local demo database exists; the flag re-derives on the next cascade for any task that is touched.

### Open risks carried forward

1. **Decision 4 is a live behaviour change** on any populated database — tasks with `requires_approval: true` and no `Approval` rows stop being valid on their next cascade, visibly reducing XP and readiness.
2. **Recompute frequency.** `recomputeWithHybrids` runs after every signalling bridge event, so a busy service hour recomputes `SALES` once per order. The fix, if it bites, is a short Redis debounce key per meter — deliberately not built until Phase 33 supplies the order volume to measure it.
3. **`Feedback` has no `node_id`**, so the `QUALITY` rating half is node-agnostic. Correct for the single seeded node; must become node-scoped when a second node lands.
4. **`POST /approvals/:id/override` takes an `Approval` id**, which it always did in the backend — Task 16 renames the frontend prop and passes `approval.id`. Any external caller of the old evidence-id shape breaks.

---

## Status

**Phase 31 (P3) is complete pending the frontend gate re-run.** All 17 plan tasks are merged, the single additive migration is committed and applied to the live local Postgres, the drift gate is clean, the seeds are idempotent, and the whole bridge — policy approvals, the validation gate, bridge evidence, the dispatch ledger, readiness signals, derived recompute, the 50/50 blend, the history API, the daily snapshot and decision voting — has been exercised end to end against `dist/src/main.js` with the results recorded above.

Backend gates green at `080a664`: 75 suites / 974 tests, `tsc` exit 0, 0 lint errors, build clean.

**Next:** Phase 32 and Phase 33 can proceed in parallel — Phase 32 owns the IA, admin surface and the deferred Playwright smoke (`QA-03`); Phase 33 owns P5 commerce, the deferred event emitters, `Review` in `QUALITY`, and the Postgres-backed integration harness (`QA-02`).
