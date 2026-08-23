# P3 Mission Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution waves and worktree partitioning are defined in "Execution partition" near the end — read that section before spawning implementers.

**Goal:** Close the loop SPEC §0 describes — *I do the real work → the work itself becomes the proof → someone with skin in the game signs it off → a meter I care about moves.* Concretely: a typed after-commit domain-event catalogue (SPEC §4.1), a `MissionBridgeService` that turns ops events into pending bridge evidence, readiness signals and one spawned improvement task (SPEC §4.2), four derived meters plus 50/50 hybrids with daily snapshots and a history API (SPEC §4.3), and approval policies that actually generate `Approval` rows for tasks and recipes plus tier-1/2/3 decision voting (SPEC §4.4). Frontend work is limited to making the bridge *visible*: derived values with history on `/readiness`, a policy-generated approvals inbox on `/approvals`, vote UI on `/decisions`, and a "Bridge" marker on system evidence.

**Architecture:** P2 already shipped every table this phase needs (`ApprovalPolicy`, `DecisionVote`, `ReadinessSignal`, `ReadinessSnapshot`, `ReadinessMeter.mode/formula_key`, `Task.subject_type/subject_id`, `Approval.entity_type/entity_id/policy_id`, `AuditEvent`) — `ReadinessSignal` and `ReadinessSnapshot` have **zero code references** in `backend/src` today, so this phase is their first consumer. P3 therefore adds behaviour, not structure: the schema delta is one enum, one model (`BridgeDispatch`, the bridge's exactly-once ledger), three columns on `ReadinessMeter` and three indexes, all additive, all in Task 1, with one migration in Task 17.

The bridge is deliberately one-directional and failure-isolated: ops services emit *after* commit inside try/catch (the pattern `orders.service.ts:185`, `kds.service.ts:237`, `tasks.service.ts:309` already use); `MissionBridgeListener` is the only `@OnEvent` subscriber that writes; every rule application is keyed by `BridgeDispatch @@unique([rule_key, source_type, source_id])` so a replayed event is a no-op. Derived meters are pure functions over a snapshot object (`readiness/derivation/derived-meters.ts`), so the four SPEC §4.3 formulas are unit-testable without a database; the service that gathers the snapshot is a thin Prisma shell around them.

**Tech Stack:** NestJS 11, Prisma 6.19 (PostgreSQL), `@nestjs/event-emitter` 3 (already registered `EventEmitterModule.forRoot()` at `backend/src/app.module.ts:68`), `@nestjs/schedule` 6 (`ScheduleModule.forRoot()` at `:67`), Jest 30 + ts-jest (config inline in `backend/package.json`, `rootDir: "src"`, `testRegex: ".*\.spec\.ts$"`), class-validator, Next.js 16 + React 19 + `@tanstack/react-query` + `recharts@^3.8.0` (frontend), npm, Node 22. Branch `v2-os-marketplace`, HEAD `0da0e09`. Local database: Docker Postgres `konma-postgres` on `localhost:5433` (db/user/pass `konma`, shadow db `konma_shadow`); `backend/.env` already points `DATABASE_URL`/`DIRECT_DATABASE_URL` at it. `prisma migrate reset` is **not available** (Prisma 6.19's AI-agent guard refuses destructive migrate commands) — Task 17 uses `migrate dev --create-only` + `migrate deploy` + the `migrate diff` drift gate instead.

**Current gates (HEAD `0da0e09`, must stay green):** `npx jest --silent` → 60 suites / 603 tests (26 todo, 577 passed) · `npx tsc --noEmit -p tsconfig.build.json` → exit 0 · `npx eslint "{src,apps,libs,test}/**/*.ts"` → 0 errors (3875 warnings) · `npx prisma validate` → valid · frontend `tsc --noEmit` + `npm run build` clean. This plan adds **9 new spec suites → 69 total**.

---

## Decisions taken while reading the code (deviations from a literal reading of SPEC §4)

1. **A `BridgeDispatch` ledger provides exactly-once, not a unique column on `Evidence`.** SPEC §4.2 says the bridge creates evidence but is silent on replay. `@nestjs/event-emitter` gives at-most-once in-process delivery, but a service can legitimately emit the same event twice (e.g. a PO received in two partial deliveries, a retried request). Rather than sprinkle nullable unique columns on `Evidence` and `Task`, P3 adds one small model `BridgeDispatch { rule_key, source_type, source_id, task_id?, evidence_id?, outcome, detail }` with `@@unique([rule_key, source_type, source_id])`. One constraint governs evidence, signal *and* task-spawn idempotency, and it doubles as the observability record ("what has the bridge actually done") that `GET /mission-bridge/dispatches` exposes. `ReadinessSignal` needs no unique constraint as a result.

2. **Bridge evidence `url` is an app-relative deep link, not an absolute URL.** `Evidence.url` is a required `String` that today holds presigned R2 URLs. Bridge rows store `/operations/purchase-orders/{id}`-style paths so they survive an environment change and render as a Next `<Link>`; the frontend branches on `source === 'bridge'`. `FRONTEND_URL` exists in `env.validation.ts` but is production-only (`@ValidateIf(inProduction)`), so depending on it would make bridge evidence env-fragile in dev and test.

3. **The bridge acts as a seeded `SYSTEM` role + system user, not as a nullable uploader.** `Evidence.uploaded_by` is a required FK to `User`. Making it nullable would ripple through `EvidenceService`, the feed, exports and the frontend types for no gain. P3 seeds a ninth `Role { code: 'SYSTEM', permissions: [] }` and one `User { id: SYSTEM_USER_ID, email: 'system@konma.local', status: 'system', password_hash: '!' }`. `status: 'system'` is automatically excluded by the four places that already filter `status: 'active'` (`leaderboard.service.ts:16`, `chat.service.ts:22`, `activity.service.ts:109`, `notifications.service.ts:30`); `'!'` is not a valid bcrypt hash so `compare()` can never succeed. `UsersService` is hardened to hide it from the admin list and refuse update/delete (Task 14). The `SYSTEM` role is seeded from a dedicated `seed-data/system-actor.ts`, **not** added to `ROLE_SEEDS` — `ROLE_SEEDS` drives demo-user creation with real passwords in `seed-demo.ts`.

4. **`requires_approval = true` with zero `Approval` rows now blocks validation.** `evidence.service.ts:308-318` currently treats "no approval rows" as *satisfied*, so today every task with the default `requires_approval: true` self-validates the moment one evidence row is approved — the approval gate has never executed. P3 inverts this: a task with `requires_approval` must have at least one policy-generated row and satisfy the policy's `mode`/`min_approvals`. This is a deliberate behaviour change and it rewrites assertions in `backend/src/evidence/__tests__/cascade.spec.ts`.

5. **`ApprovalPolicyService` lives in its own `@Global()` module.** `TasksService`, `RecipesService`, `ApprovalsService` and `EvidenceService` all need policy resolution. Putting it in `ApprovalsModule` would create `TasksModule → ApprovalsModule → EvidenceModule → TasksModule`. `ApprovalPolicyModule` depends on `PrismaService` only and is registered `@Global()` in `app.module.ts`, the same shape `AuditModule` and `NodeModule` already use.

6. **The `is_default` fallback policy expands to the owner's domain lead in code, not in data.** `prisma/seed-data/approval-policies.ts` seeds the fallback row with `required_role_codes: []` and the comment "resolved to the task owner's domain lead in P3". `ApprovalPolicyService.resolve()` substitutes `DOMAIN_LEAD_ROLE[domain]` when the matched policy's `required_role_codes` is empty. The seed file is left untouched.

7. **`QUALITY` reads `Feedback`, not `Review`.** SPEC §4.3 says "average review rating × 20", but the `Review` model lands in P5 (Phase 33) per the P2 summary. P3 computes the rating half from `Feedback.rating` (1–5, already populated by the live feedback flow) and the formula file carries a named seam (`ratingSource`) so P5 swaps in `Review` without touching the arithmetic.

8. **COGS for `QUALITY` follows the existing analytics convention.** `analytics.service.ts:67-79` already treats `recipe.computed_cost` as a per-unit cost compared against `product.base_price`. The trailing-7-day COGS is therefore `Σ orderItem.quantity × product.recipe.computed_cost` over non-cancelled orders in the window — consistent with the number `BI_LEAD` already sees, rather than a second, divergent definition.

9. **"Completed order" for `SALES` means `status ∈ (served, delivered, completed)`.** `OrderStatus` has eleven members and the POS flow terminates at `served`/`completed` while the marketplace flow terminates at `delivered`; a literal `status = 'completed'` would score the marketplace channel at zero forever. The `≥ 10 orders/week` bonus is `+10`, applied before the `min(…, 100)` clamp, so it only matters below four active channels.

10. **`ReadinessMeter.current_value` becomes a published, computed column.** Task-driven contributions move to a new `task_value`, derived formula output to `derived_value`, and `current_value` is written by one pure function `blendMeterValue(mode, task_value, derived_value)`: `task_driven → task_value`, `derived → derived_value ?? 0`, `hybrid → 0.5 × task_value + 0.5 × (derived_value ?? 0)`. Every existing reader (`/readiness-meters`, dashboard strip, mission-control) keeps reading `current_value` unchanged. `hybrid` meters map to their derived partner through the already-seeded `formula_key` (`hybrid_backend_v1`, `hybrid_frontend_v1`) — no new setting or table.

11. **`aligned` is a recorded transition, not a resting state.** SPEC §4.4 says a tier-2 decision is "`aligned` when all `DecisionVote = approve`, then `approved`". Implemented as one transaction that writes an `AuditEvent(action='decision.aligned')` and then leaves the row at `approved` — so the alignment moment is auditable without creating a state nobody can act on. `abstain` is not `approve`: a decision where the remaining required voters all abstain stays `proposed` and needs a founder resolve.

12. **Recipe `pending → approved` by PATCH is removed and replaced, not deleted.** `recipes.service.ts:203-216` allows a direct flip. P3 keeps `draft → pending` (which now materialises `Approval{ entity_type: recipe }` rows from the `recipe/food` policy) and `approved → archived`, but `pending → approved` via `PATCH /recipes/:id` throws `BadRequestException`. The flip happens inside `ApprovalsService` when the last required approval lands, in the same transaction.

13. **Events with no emitter in P3 are declared, not faked.** `shipment.status_changed`, `shipment.delivered`, `review.published` and `coupon.redeemed` have no source model until P5. They are declared in `domain-events.ts` with full payload types and listed in `mission-bridge.rules.ts` as `emitter: 'P5'` so the rule table is complete and P5 only adds the emit call. No stub emitter is written.

14. **`notification-events.ts` is deleted.** Its five classes are structural subsets of the new typed payloads and would silently drift (`OrderReadyEvent.createdBy` is already typed `string` while `Order.created_by` is nullable). `notifications.listener.ts` imports the payload types from `common/events/domain-events.ts` instead.

15. **Smoke test 1 is executed as a scripted curl sequence in Task 17, not as Playwright.** `QA-03` asks for a Playwright smoke on a built preview; no Playwright harness exists in either package and the selectors it would target are the Phase 32 IA. The same six-step flow (`login → create task → upload evidence → approve → meter moves`) is executed against `dist/src/main.js` in Task 17 with recorded output, and the Playwright automation is deferred to Phase 32 — see Self-review.

---

## File structure

**Create (backend):**
- `backend/src/common/events/domain-events.ts` + `domain-events.spec.ts` — event-name const, per-event payload interfaces, `emitDomainEvent`, actor helpers.
- `backend/src/common/constants/system-actor.ts` — `SYSTEM_USER_ID`, `SYSTEM_ROLE_CODE`, `SYSTEM_USER_EMAIL`, `SYSTEM_USER_NAME`.
- `backend/src/common/utils/advisory-lock.ts` — `withAdvisoryLock(prisma, key, fn)` over `pg_try_advisory_lock`.
- `backend/src/approvals/approval-policy.service.ts` + `approval-policy.service.spec.ts`, `approval-policy.module.ts`, `approval-policies.controller.ts`, `dto/create-approval-policy.dto.ts`, `dto/update-approval-policy.dto.ts`, `dto/decide-approval.dto.ts`, `dto/list-approvals.dto.ts`.
- `backend/src/mission-bridge/mission-bridge.module.ts`, `mission-bridge.service.ts` + `.spec.ts`, `mission-bridge.listener.ts`, `mission-bridge.rules.ts` + `mission-bridge.rules.spec.ts`, `bridge-links.ts` + `bridge-links.spec.ts`, `mission-bridge.controller.ts`.
- `backend/src/readiness/derivation/derived-meters.ts` + `derived-meters.spec.ts`, `meter-value.ts` + `meter-value.spec.ts`, `derivation.types.ts`.
- `backend/src/readiness/readiness-derivation.service.ts` + `.spec.ts`, `readiness.cron.ts` + `.spec.ts`, `dto/meter-history.dto.ts`.
- `backend/src/decisions/dto/cast-vote.dto.ts`, `dto/resolve-decision.dto.ts`.
- `backend/prisma/seed-data/system-actor.ts`.
- `backend/prisma/migrations/20260823180000_p3_mission_bridge/migration.sql` (Task 17).

**Delete (backend):** `backend/src/notifications/events/notification-events.ts` (and the now-empty `backend/src/notifications/events/` directory).

**Create (frontend):**
- `frontend/lib/types/approvals.ts`.
- `frontend/components/ops/readiness/MeterHistoryChart.tsx`, `MeterModeBadge.tsx`, `MeterBreakdown.tsx`.
- `frontend/components/ops/decisions/DecisionVotePanel.tsx`.
- `frontend/components/ops/approvals/ApprovalEntityChip.tsx`.

**Modify (backend):** `backend/prisma/schema.prisma` (Task 1 only), `backend/src/test-utils/mock-providers.ts` (Task 1 only), `backend/src/app.module.ts` (Task 3 then Task 4), `backend/src/settings/settings.service.ts`, `backend/src/prisma/seed-data.spec.ts`, `backend/src/inventory/inventory.service.ts`, `backend/src/orders/orders.service.ts`, `backend/src/kitchen/kds/kds.service.ts`, `backend/src/kitchen/prep-batches/prep-batches.service.ts`, `backend/src/kitchen/waste/waste.service.ts`, `backend/src/purchase-orders/purchase-orders.service.ts`, `backend/src/fulfilment/fulfilment.service.ts`, `backend/src/catalog/catalog.service.ts`, `backend/src/vendors/vendors.service.ts`, `backend/src/feedback/feedback.service.ts`, `backend/src/events/events.service.ts`, `backend/src/notifications/notifications.listener.ts`, `backend/src/tasks/tasks.service.ts` + `tasks.module.ts` + `dto/`, `backend/src/approvals/approvals.service.ts` + `approvals.controller.ts` + `approvals.module.ts`, `backend/src/evidence/evidence.service.ts` + `evidence.module.ts`, `backend/src/recipes/recipes.service.ts` + `recipes.controller.ts`, `backend/src/decisions/decisions.service.ts` + `decisions.controller.ts` + `dto/`, `backend/src/readiness/readiness.service.ts` + `readiness.controller.ts` + `readiness.module.ts`, `backend/src/users/users.service.ts`, `backend/prisma/seed-reference.ts`, plus the specs listed per task.

**Modify (frontend):** `frontend/lib/types/readiness.ts`, `decisions.ts`, `evidence.ts`, `analytics.ts`, `frontend/app/(ops)/readiness/page.tsx`, `frontend/components/ops/readiness/{ReadinessGrid,ReadinessMeterRing,MeterDetailPanel}.tsx`, `frontend/app/(ops)/approvals/page.tsx`, `frontend/components/ops/approvals/{ApprovalQueue,ApprovalItem,OverrideDialog}.tsx`, `frontend/components/ops/decisions/{DecisionDetail,DecisionList}.tsx`, `frontend/app/(ops)/decisions/page.tsx`, `frontend/components/ops/boards/EvidenceFeedCard.tsx`, `frontend/components/ops/evidence/EvidenceItem.tsx`, `frontend/components/ops/Sidebar.tsx`.

**Untouched by contract:** `frontend/app/page.tsx` and `ScrollVideoStory` (SPEC §1.3), the navigation spine and header (Phase 32), every `/shop` route (Phase 33/34).

---

### Task 1: Schema delta, shared mocks, settings key

Everything structural P3 needs, in one place, additive only. **No migration is written here** — Task 17 produces the single migration for the whole phase.

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/test-utils/mock-providers.ts`
- Modify: `backend/src/settings/settings.service.ts`, `backend/prisma/seed-data/settings.ts`, `backend/src/prisma/seed-data.spec.ts`

- [ ] `schema.prisma` — add the enum next to the other platform enums (after `enum ActorType { … }`):

```prisma
/// Outcome of one MissionBridge rule application (SPEC §4.2).
enum BridgeOutcome {
  applied
  skipped_no_task
  skipped_no_mission
  skipped_no_owner
  failed
}
```

- [ ] `schema.prisma` — add the model immediately after `model ReadinessSnapshot { … }`:

```prisma
/// SPEC §4.2 — the bridge's exactly-once ledger. One row per (rule, source entity);
/// a replayed domain event hits the unique constraint and becomes a no-op.
/// `task_id`/`evidence_id` are recorded without FK relations for the same reason
/// `Approval.entity_id` has none: the bridge must never block a delete.
model BridgeDispatch {
  id          String        @id @default(uuid())
  node_id     String        @default("11111111-1111-4111-8111-111111111111")
  node        Node          @relation(fields: [node_id], references: [id], onDelete: Restrict)
  rule_key    String
  event       String
  source_type String
  source_id   String
  task_id     String?
  evidence_id String?
  outcome     BridgeOutcome @default(applied)
  detail      String?
  created_at  DateTime      @default(now()) @db.Timestamptz(3)

  @@unique([rule_key, source_type, source_id])
  @@index([node_id, created_at(sort: Desc)])
  @@index([event, created_at(sort: Desc)])
}
```

- [ ] `schema.prisma` — on `model Node`, add the back-relation `bridge_dispatches BridgeDispatch[]` next to `audit_events AuditEvent[]`.
- [ ] `schema.prisma` — extend `model ReadinessMeter` with the three published-value columns (decision 10), inserted after `formula_key`:

```prisma
  /// SPEC §4.3 — task-driven contribution (Σ active TaskReadinessEvent.value, clamped 0-100).
  task_value       Float     @default(0)
  /// SPEC §4.3 — formula output for `derived`/`hybrid` meters; null until first computed.
  derived_value    Float?
  last_computed_at DateTime? @db.Timestamptz(3)
```

- [ ] `schema.prisma` — three indexes the P3 queries need:
  - on `model Approval`, add `@@index([required_role_code, status])` (the "approvals waiting on me" inbox).
  - on `model Evidence`, add `@@index([task_id, source])` (bridge evidence per task).
  - on `model Decision`, add `@@index([status, created_at(sort: Desc)])` (the decisions inbox and stale-decision counts).
- [ ] `cd backend && npx prisma validate && npx prisma generate` — expect `valid 🚀` then `Generated Prisma Client`.
- [ ] `backend/src/test-utils/mock-providers.ts` — extend `PRISMA_MODELS` with every model P3 specs touch that is not already listed. Insert alphabetically-adjacent to the existing entries:

```ts
  'approvalPolicy',
  'bridgeDispatch',
  'decision',
  'decisionVote',
  'ingredientCategory',
  'node',
  'purchaseOrder',
  'readinessSignal',
  'readinessSnapshot',
  'recipeLine',
  'vendorPrice',
  'wasteLog',
  'zone',
```

- [ ] `backend/src/test-utils/mock-providers.ts` — append two factories (plain objects, no class imports, so this file never depends on P3 code):

```ts
/** A NodeService stand-in — `current()`/`currentId()`/`timezone()` are all the bridge needs. */
export function mockNodeService(nodeId = '11111111-1111-4111-8111-111111111111') {
  return {
    current: jest.fn().mockResolvedValue({
      id: nodeId,
      code: 'KX-VILLA-1',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    }),
    currentId: jest.fn().mockResolvedValue(nodeId),
    timezone: jest.fn().mockResolvedValue('Asia/Kolkata'),
  };
}

/**
 * An ApprovalPolicyService stand-in. Wire it in a spec with an explicit token:
 * `{ provide: ApprovalPolicyService, useValue: mockApprovalPolicyService() }`.
 * Declared here (not importing the class) so this file stays dependency-free.
 */
export function mockApprovalPolicyService() {
  return {
    resolve: jest.fn().mockResolvedValue({
      policy_id: null,
      scope: 'task',
      domain: null,
      required_role_codes: ['BACKEND_LEAD'],
      min_approvals: 1,
      mode: 'all',
    }),
    materialise: jest.fn().mockResolvedValue(1),
    isSatisfied: jest.fn().mockResolvedValue(true),
  };
}
```

- [ ] `backend/src/settings/settings.service.ts` — add one allowlisted key to `SETTING_DEFAULTS` (P3 needs a settings-driven knob for the derived formulas; `xp_rules` already exists and is unchanged):

```ts
  readiness: {
    /** SPEC §4.3 — trailing window for the SALES and QUALITY formulas. */
    trailing_days: 7,
    /** SALES: points per channel with >= 1 completed order in the window. */
    sales_points_per_channel: 25,
    /** SALES: flat bonus when the window carries >= this many completed orders. */
    sales_volume_threshold: 10,
    sales_volume_bonus: 10,
    /** QUALITY: multiplier applied to waste_cost / COGS before the 0-100 clamp. */
    quality_waste_multiplier: 5,
    /** History API default and hard cap. */
    history_default_days: 90,
    history_max_days: 365,
  },
```

- [ ] `backend/prisma/seed-data/settings.ts` — mirror the identical `readiness` object into `SEED_SETTING_DEFAULTS` (the file's own comment explains why the table is duplicated; `src/prisma/seed-data.spec.ts` asserts deep equality).
- [ ] `backend/src/prisma/seed-data.spec.ts` — no assertion change needed if the objects match; run it to prove parity.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output (nothing consumes the new model or columns yet).
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 60 passed, 60 total`.
- [ ] `cd backend && npx eslint "{src,apps,libs,test}/**/*.ts"` — expect `0 errors`.
- [ ] `git add backend/prisma/schema.prisma backend/prisma/seed-data/settings.ts backend/src/test-utils/mock-providers.ts backend/src/settings/settings.service.ts && git commit -m "feat(p3-01): BridgeDispatch, meter task/derived values, readiness setting, shared mocks" -- backend/prisma/schema.prisma backend/prisma/seed-data/settings.ts backend/src/test-utils/mock-providers.ts backend/src/settings/settings.service.ts`

---

### Task 2: The typed domain-event catalogue (SPEC §4.1)

One file declares every event name, every payload and the only sanctioned way to emit. Nothing consumes it yet, so this task cannot break anything.

**Files:**
- Create: `backend/src/common/events/domain-events.ts`, `backend/src/common/events/domain-events.spec.ts`
- Create: `backend/src/common/constants/system-actor.ts`

- [ ] Create `backend/src/common/constants/system-actor.ts`:

```ts
/**
 * The identity the MissionBridge writes as. Seeded by `seed:reference`
 * (`prisma/seed-data/system-actor.ts`) with a fixed id so services never
 * have to look it up. `status: 'system'` keeps it out of every screen that
 * filters `status: 'active'` (leaderboard, chat, activity, notifications).
 */
export const SYSTEM_USER_ID = '11111111-1111-4111-8111-111111111112';
export const SYSTEM_ROLE_CODE = 'SYSTEM';
export const SYSTEM_USER_EMAIL = 'system@konma.local';
export const SYSTEM_USER_NAME = 'Konma Bridge';
export const SYSTEM_USER_STATUS = 'system';
/** Never a valid bcrypt digest, so `bcrypt.compare()` can never succeed. */
export const SYSTEM_USER_PASSWORD_HASH = '!';
```

- [ ] Create `backend/src/common/events/domain-events.ts`. The header block, actor helpers and emit wrapper:

```ts
import { Logger } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { ActorType } from '@prisma/client';

/**
 * SPEC §4.1 — the complete domain-event catalogue. Every emitter passes
 * `{ node_id, actor, occurred_at, …payload }` and emits ONLY after the
 * transaction commits, through `emitDomainEvent` (which swallows listener
 * failures so a broken subscriber can never fail a write).
 */

export interface DomainEventActor {
  actor_type: ActorType;
  actor_id: string | null;
}

export interface DomainEventBase {
  node_id: string;
  actor: DomainEventActor;
  /** ISO-8601 UTC instant the source transaction committed. */
  occurred_at: string;
}

export const userActor = (userId: string | null | undefined): DomainEventActor =>
  userId
    ? { actor_type: ActorType.user, actor_id: userId }
    : { actor_type: ActorType.system, actor_id: null };

export const customerActor = (customerId: string): DomainEventActor => ({
  actor_type: ActorType.customer,
  actor_id: customerId,
});

export const systemActor = (): DomainEventActor => ({
  actor_type: ActorType.system,
  actor_id: null,
});
```

- [ ] Same file — the event-name registry (26 names: the 5 that exist plus the 21 SPEC §4.1 adds):

```ts
export const DomainEvent = {
  // Existing (v1) — retyped, names unchanged so listeners keep working.
  ORDER_PLACED: 'order.placed',
  ORDER_READY: 'order.ready',
  DELIVERY_UPDATED: 'delivery.updated',
  STOCK_LOW: 'stock.low',
  TASK_BLOCKED: 'task.blocked',
  // New — SPEC §4.1.
  RECIPE_APPROVED: 'recipe.approved',
  RECIPE_ARCHIVED: 'recipe.archived',
  PURCHASE_ORDER_RECEIVED: 'purchase_order.received',
  PREP_BATCH_CREATED: 'prep_batch.created',
  PREP_BATCH_DEPLETED: 'prep_batch.depleted',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_SERVED: 'order.served',
  ORDER_DELIVERED: 'order.delivered',
  SHIPMENT_STATUS_CHANGED: 'shipment.status_changed',
  SHIPMENT_DELIVERED: 'shipment.delivered',
  WASTE_LOGGED: 'waste.logged',
  EVENT_COMPLETED: 'event.completed',
  BOOKING_ATTENDED: 'booking.attended',
  FEEDBACK_RECEIVED: 'feedback.received',
  REVIEW_PUBLISHED: 'review.published',
  PRODUCT_PUBLISHED: 'product.published',
  VENDOR_PRICE_UPDATED: 'vendor_price.updated',
  TASK_VALIDATED: 'task.validated',
  APPROVAL_DECIDED: 'approval.decided',
  DECISION_RESOLVED: 'decision.resolved',
  COUPON_REDEEMED: 'coupon.redeemed',
} as const;

export type DomainEventName = (typeof DomainEvent)[keyof typeof DomainEvent];
```

- [ ] Same file — the payload map. Field names for the five existing events are **copied verbatim** from the current emit sites so `notifications.listener.ts` keeps compiling (`orders.service.ts:185`, `:519`, `kds.service.ts:237`, `inventory.service.ts:158`, `tasks.service.ts:309`):

```ts
export interface DomainEventPayloads {
  'order.placed': DomainEventBase & {
    orderId: string; channel: string; itemCount: number; total: string; createdBy: string | null;
  };
  'order.ready': DomainEventBase & { orderId: string; channel: string; createdBy: string | null };
  'delivery.updated': DomainEventBase & {
    orderId: string; deliveryStatus: string | null; deliveryAddress: string | null; createdBy: string | null;
  };
  'stock.low': DomainEventBase & {
    ingredientId: string; ingredientName: string; currentQty: number; minQty: number; unit: string; zoneId: string;
  };
  'task.blocked': DomainEventBase & {
    taskId: string; taskTitle: string; ownerUserId: string; blockedReason: string | null;
  };

  'recipe.approved': DomainEventBase & { recipeId: string; name: string; version: number; computedCost: string | null };
  'recipe.archived': DomainEventBase & { recipeId: string; name: string; version: number };
  'purchase_order.received': DomainEventBase & {
    purchaseOrderId: string; vendorId: string; vendorName: string; linkedTaskId: string | null;
    lineCount: number; totalAmount: string; fullyReceived: boolean;
  };
  'prep_batch.created': DomainEventBase & {
    prepBatchId: string; recipeId: string; recipeName: string; zoneId: string; quantityProduced: string; unit: string;
  };
  'prep_batch.depleted': DomainEventBase & { prepBatchId: string; recipeId: string; recipeName: string; zoneId: string };
  'order.confirmed': DomainEventBase & {
    orderId: string; orderNumber: number; channel: string; total: string; itemCount: number; customerId: string | null;
  };
  'order.served': DomainEventBase & { orderId: string; orderNumber: number; channel: string; total: string };
  'order.delivered': DomainEventBase & { orderId: string; orderNumber: number; channel: string; total: string };
  'shipment.status_changed': DomainEventBase & { shipmentId: string; orderId: string; status: string; awb: string | null };
  'shipment.delivered': DomainEventBase & { shipmentId: string; orderId: string; awb: string | null };
  'waste.logged': DomainEventBase & {
    wasteLogId: string; wasteType: string; reason: string; costImpact: string; zoneId: string;
    ingredientId: string | null; prepBatchId: string | null;
  };
  'event.completed': DomainEventBase & { eventId: string; title: string; attendedCount: number };
  'booking.attended': DomainEventBase & { bookingId: string; eventId: string; guests: number };
  'feedback.received': DomainEventBase & {
    feedbackId: string; orderId: string | null; rating: number; comment: string | null;
  };
  'review.published': DomainEventBase & { reviewId: string; productId: string; rating: number };
  'product.published': DomainEventBase & { productId: string; name: string; slug: string; type: string };
  'vendor_price.updated': DomainEventBase & {
    vendorPriceId: string; vendorId: string; ingredientId: string; ingredientName: string; price: string; unit: string;
  };
  'task.validated': DomainEventBase & {
    taskId: string; title: string; ownerUserId: string; questId: string | null; missionId: string;
    readinessMeterId: string | null; validXp: number;
  };
  'approval.decided': DomainEventBase & {
    approvalId: string; entityType: string; entityId: string; status: string;
    requiredRoleCode: string; overridden: boolean;
  };
  'decision.resolved': DomainEventBase & {
    decisionId: string; title: string; tier: string; status: string; linkedTaskId: string | null;
  };
  'coupon.redeemed': DomainEventBase & { couponId: string; code: string; orderId: string; amount: string };
}
```

- [ ] Same file — the emit wrapper (the *only* sanctioned emit path):

```ts
const logger = new Logger('DomainEvents');

/**
 * Fire a domain event after the transaction has committed. Never throws:
 * a listener failure is logged and swallowed (SPEC §4.1 "failure-isolated").
 */
export function emitDomainEvent<K extends DomainEventName>(
  emitter: Pick<EventEmitter2, 'emit'>,
  name: K,
  payload: DomainEventPayloads[K],
): void {
  try {
    emitter.emit(name, payload);
  } catch (err) {
    logger.warn(`domain event ${name} failed to dispatch: ${String(err)}`);
  }
}

/** Convenience for the `{ node_id, actor, occurred_at }` prefix every payload carries. */
export function domainEventBase(
  nodeId: string,
  actor: DomainEventActor,
  occurredAt: Date = new Date(),
): DomainEventBase {
  return { node_id: nodeId, actor, occurred_at: occurredAt.toISOString() };
}
```

- [ ] Create `backend/src/common/events/domain-events.spec.ts` with these cases:
  - `DomainEvent` contains exactly 26 entries and every value is unique (`new Set(Object.values(DomainEvent)).size === 26`).
  - Every key of `DomainEventPayloads` is a value of `DomainEvent` — assert with a compile-time check plus a runtime guard: `const names: DomainEventName[] = Object.values(DomainEvent); expect(names).toContain('recipe.approved')` and a `satisfies Record<DomainEventName, unknown>` type-level assertion in a `const _exhaustive` declaration.
  - `emitDomainEvent` calls `emitter.emit` once with `(name, payload)`.
  - `emitDomainEvent` returns `undefined` and does **not** throw when `emit` throws (`emit: jest.fn(() => { throw new Error('boom'); })`).
  - `userActor(null)` → `{ actor_type: 'system', actor_id: null }`; `userActor('u1')` → `{ actor_type: 'user', actor_id: 'u1' }`; `customerActor('c1')` → `{ actor_type: 'customer', actor_id: 'c1' }`.
  - `domainEventBase('n1', systemActor(), new Date('2026-08-23T10:00:00Z')).occurred_at === '2026-08-23T10:00:00.000Z'`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent src/common/events` — expect 1 suite passed with every case above green.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 61 passed, 61 total`.
- [ ] `git add backend/src/common && git commit -m "feat(p3-02): typed domain-event catalogue and system-actor constants" -- backend/src/common`

---

### Task 3: `ApprovalPolicyService` + `approval-policies` CRUD (GOV-01)

The policy resolver every governance task depends on, in a `@Global()` module so nothing goes circular (decision 5). This task owns the **first** `app.module.ts` edit of the phase.

**Files:**
- Create: `backend/src/approvals/approval-policy.service.ts`, `approval-policy.service.spec.ts`, `approval-policy.module.ts`, `approval-policies.controller.ts`, `dto/create-approval-policy.dto.ts`, `dto/update-approval-policy.dto.ts`
- Modify: `backend/src/app.module.ts`

- [ ] Create `backend/src/approvals/approval-policy.service.ts`:

```ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  ApprovalEntityType, ApprovalMode, ApprovalScope, ApprovalStatus, TaskDomain,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { RoleCode } from '../types/roles';
import type { Tx } from '../common/types/transaction';
import { CreateApprovalPolicyDto } from './dto/create-approval-policy.dto';
import { UpdateApprovalPolicyDto } from './dto/update-approval-policy.dto';

/**
 * SPEC §4.4 — "default → task owner's domain lead". The seeded fallback policy
 * carries `required_role_codes: []`; the resolver substitutes this map so the
 * seed file stays declarative (see prisma/seed-data/approval-policies.ts).
 */
export const DOMAIN_LEAD_ROLE: Record<TaskDomain, string> = {
  food: RoleCode.BACKEND_LEAD,
  art: RoleCode.DESIGN_OUTREACH_LEAD,
  lifestyle: RoleCode.DESIGN_OUTREACH_LEAD,
  ops: RoleCode.FOUNDER_ADMIN,
  procurement: RoleCode.PROCUREMENT_LEAD,
  bi: RoleCode.BI_LEAD,
  talent: RoleCode.TALENT_LEAD,
  tech: RoleCode.TECH_LEAD,
  design: RoleCode.DESIGN_OUTREACH_LEAD,
};

export interface ResolvedPolicy {
  policy_id: string | null;
  scope: ApprovalScope;
  domain: TaskDomain | null;
  required_role_codes: string[];
  min_approvals: number;
  mode: ApprovalMode;
}

export interface MaterialiseInput {
  entity_type: ApprovalEntityType;
  entity_id: string;
  scope: ApprovalScope;
  domain: TaskDomain | null;
}

@Injectable()
export class ApprovalPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Exact `(scope, domain)` match → the scope's `is_default` row → a synthetic
   * single-approver policy for the domain lead. Never throws: an entity with no
   * policy at all still gets one approver so the gate is never silently open.
   */
  async resolve(
    scope: ApprovalScope,
    domain: TaskDomain | null,
    nodeId: string = DEFAULT_NODE_ID,
  ): Promise<ResolvedPolicy> {
    const exact = domain
      ? await this.prisma.approvalPolicy.findFirst({ where: { node_id: nodeId, scope, domain } })
      : null;
    const fallback =
      exact ??
      (await this.prisma.approvalPolicy.findFirst({
        where: { node_id: nodeId, scope, domain: null },
      })) ??
      (await this.prisma.approvalPolicy.findFirst({
        where: { node_id: nodeId, is_default: true },
      }));

    const domainLead = domain ? DOMAIN_LEAD_ROLE[domain] : RoleCode.FOUNDER_ADMIN;

    if (!fallback) {
      return {
        policy_id: null, scope, domain,
        required_role_codes: [domainLead], min_approvals: 1, mode: ApprovalMode.all,
      };
    }

    const roles =
      fallback.required_role_codes.length > 0
        ? fallback.required_role_codes
        : [domainLead];

    return {
      policy_id: fallback.id,
      scope: fallback.scope,
      domain: fallback.domain,
      required_role_codes: roles,
      min_approvals: Math.min(Math.max(fallback.min_approvals, 1), roles.length),
      mode: fallback.mode,
    };
  }

  /**
   * Creates one pending `Approval` per required role, skipping roles that already
   * have a row. Idempotent by diff, and safe under concurrency because every
   * caller runs it inside the Serializable transaction that writes the entity.
   * Returns the number of rows created.
   */
  async materialise(tx: Tx, input: MaterialiseInput, nodeId = DEFAULT_NODE_ID): Promise<number> {
    const policy = await this.resolve(input.scope, input.domain, nodeId);

    const existing = await tx.approval.findMany({
      where: { entity_type: input.entity_type, entity_id: input.entity_id },
      select: { required_role_code: true },
    });
    const have = new Set(existing.map((a) => a.required_role_code));
    const missing = policy.required_role_codes.filter((r) => !have.has(r));
    if (missing.length === 0) return 0;

    await tx.approval.createMany({
      data: missing.map((role) => ({
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        approval_scope: policy.scope,
        required_role_code: role,
        policy_id: policy.policy_id,
        status: ApprovalStatus.pending,
      })),
    });
    return missing.length;
  }

  /**
   * SPEC §4.4 — "the validation cascade requires every policy-generated approval
   * approved". `all` needs every row approved; `n_of` needs `min_approvals`.
   * Zero rows is NEVER satisfied (decision 4) — the caller decides whether the
   * entity required approval at all.
   */
  async isSatisfied(
    tx: Tx,
    entityType: ApprovalEntityType,
    entityId: string,
    scope: ApprovalScope,
    domain: TaskDomain | null,
    nodeId = DEFAULT_NODE_ID,
  ): Promise<boolean> {
    const rows = await tx.approval.findMany({
      where: { entity_type: entityType, entity_id: entityId },
      select: { status: true },
    });
    if (rows.length === 0) return false;

    const approved = rows.filter((r) => r.status === ApprovalStatus.approved).length;
    const rejected = rows.some((r) => r.status === ApprovalStatus.rejected);
    if (rejected) return false;

    const policy = await this.resolve(scope, domain, nodeId);
    return policy.mode === ApprovalMode.n_of
      ? approved >= policy.min_approvals
      : approved === rows.length;
  }

  // ── CRUD (SPEC §9 `approval-policies`) ───────────────────────────────────
  async findAll(nodeId = DEFAULT_NODE_ID) {
    return this.prisma.approvalPolicy.findMany({
      where: { node_id: nodeId },
      orderBy: [{ scope: 'asc' }, { domain: 'asc' }],
    });
  }

  async create(dto: CreateApprovalPolicyDto, nodeId = DEFAULT_NODE_ID) {
    if (dto.mode === ApprovalMode.n_of && dto.min_approvals > dto.required_role_codes.length) {
      throw new BadRequestException('min_approvals cannot exceed required_role_codes.length');
    }
    const clash = await this.prisma.approvalPolicy.findFirst({
      where: { node_id: nodeId, scope: dto.scope, domain: dto.domain ?? null },
    });
    if (clash) throw new BadRequestException(`A policy for (${dto.scope}, ${dto.domain ?? 'default'}) already exists`);
    return this.prisma.approvalPolicy.create({ data: { ...dto, domain: dto.domain ?? null, node_id: nodeId } });
  }

  async update(id: string, dto: UpdateApprovalPolicyDto) {
    const existing = await this.prisma.approvalPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Approval policy ${id} not found`);
    const roles = dto.required_role_codes ?? existing.required_role_codes;
    const min = dto.min_approvals ?? existing.min_approvals;
    const mode = dto.mode ?? existing.mode;
    if (mode === ApprovalMode.n_of && min > roles.length) {
      throw new BadRequestException('min_approvals cannot exceed required_role_codes.length');
    }
    return this.prisma.approvalPolicy.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const existing = await this.prisma.approvalPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Approval policy ${id} not found`);
    if (existing.is_default) throw new BadRequestException('The default policy cannot be deleted');
    return this.prisma.approvalPolicy.delete({ where: { id } });
  }
}
```

- [ ] Create `backend/src/approvals/dto/create-approval-policy.dto.ts`:

```ts
import { ApprovalMode, ApprovalScope, TaskDomain } from '@prisma/client';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateApprovalPolicyDto {
  @IsEnum(ApprovalScope) scope!: ApprovalScope;
  @IsOptional() @IsEnum(TaskDomain) domain?: TaskDomain | null;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) required_role_codes!: string[];
  @IsInt() @Min(1) min_approvals!: number;
  @IsEnum(ApprovalMode) mode!: ApprovalMode;
  @IsOptional() @IsBoolean() is_default?: boolean;
}
```

- [ ] Create `backend/src/approvals/dto/update-approval-policy.dto.ts` — the same fields, every one `@IsOptional()`, with no `scope`/`domain` (identity is immutable; delete and recreate to move a policy).
- [ ] Create `backend/src/approvals/approval-policies.controller.ts` — `@Controller('approval-policies')`, all four routes `@RequiresPermission(Permission.MANAGE_SYSTEM)`, `@Param('id', ParseUUIDPipe)`, following the shape of `approvals.controller.ts`:

```ts
@Get()        findAll()
@Post()       create(@Body() dto: CreateApprovalPolicyDto)
@Patch(':id') update(@Param('id', ParseUUIDPipe) id, @Body() dto: UpdateApprovalPolicyDto)
@Delete(':id') remove(@Param('id', ParseUUIDPipe) id)
```

- [ ] Create `backend/src/approvals/approval-policy.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { ApprovalPolicyService } from './approval-policy.service';
import { ApprovalPoliciesController } from './approval-policies.controller';

/**
 * @Global so TasksService, RecipesService, ApprovalsService and EvidenceService
 * can inject the resolver without TasksModule → ApprovalsModule → EvidenceModule
 * → TasksModule becoming a cycle. It depends on PrismaService only.
 */
@Global()
@Module({
  controllers: [ApprovalPoliciesController],
  providers: [ApprovalPolicyService],
  exports: [ApprovalPolicyService],
})
export class ApprovalPolicyModule {}
```

- [ ] `backend/src/app.module.ts` — `import { ApprovalPolicyModule } from './approvals/approval-policy.module';` and add `ApprovalPolicyModule,` to `imports` immediately after `AuditModule,` (grouping it with the other global modules).
- [ ] Create `backend/src/approvals/approval-policy.service.spec.ts` (`{ provide: PrismaService, useValue: mockPrisma() }` from `test-utils/mock-providers`), covering:
  - `resolve` returns the exact `(scope, domain)` row when one exists (assert `findFirst` called with `{ node_id, scope, domain }`).
  - `resolve` falls back to the `domain: null` row for the same scope when no exact match.
  - `resolve` falls back to the `is_default` row when neither matches.
  - `resolve` substitutes `DOMAIN_LEAD_ROLE[domain]` when the matched policy has `required_role_codes: []` — for `domain: 'procurement'` expect `['PROCUREMENT_LEAD']`.
  - `resolve` with no policy rows at all returns `{ policy_id: null, required_role_codes: ['BACKEND_LEAD'], min_approvals: 1, mode: 'all' }` for `domain: 'food'`.
  - `resolve` clamps `min_approvals` into `[1, roles.length]`.
  - `materialise` creates one row per missing role and returns that count; assert the `createMany` payload carries `status: 'pending'`, `policy_id` and `approval_scope`.
  - `materialise` creates nothing and returns `0` when every required role already has a row.
  - `isSatisfied` returns `false` for zero rows (decision 4).
  - `isSatisfied` returns `false` when any row is `rejected`, even if `min_approvals` is met.
  - `isSatisfied` with `mode: 'all'` needs every row approved; with `mode: 'n_of'` and `min_approvals: 1` one approved row of two suffices.
  - `create` throws `BadRequestException` on a duplicate `(scope, domain)` and when `n_of` `min_approvals` exceeds the role count.
  - `remove` throws `BadRequestException` for the `is_default` policy.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 61 passed, 61 total` (this task adds one suite to the 60 baseline; if run after Task 2 in the same tree, 62).
- [ ] `cd backend && npx eslint "{src,apps,libs,test}/**/*.ts"` — expect `0 errors`.
- [ ] `git add backend/src/approvals backend/src/app.module.ts && git commit -m "feat(p3-03): ApprovalPolicyService, global module, approval-policies CRUD" -- backend/src/approvals backend/src/app.module.ts`

---

### Task 4: `MissionBridgeService` — subject resolution, dispatch ledger, bridge evidence (BRIDGE-02, BRIDGE-03)

The bridge's skeleton and its evidence half. Signals and task-spawn land in Task 12 once the derivation service exists. This task owns the **second and last** `app.module.ts` edit of the phase.

**Files:**
- Create: `backend/src/mission-bridge/mission-bridge.module.ts`, `mission-bridge.service.ts`, `mission-bridge.service.spec.ts`, `mission-bridge.listener.ts`, `bridge-links.ts`, `bridge-links.spec.ts`, `mission-bridge.controller.ts`
- Modify: `backend/src/app.module.ts`

- [ ] Create `backend/src/mission-bridge/bridge-links.ts` — the deep-link and evidence-note renderers (decision 2). One function per subject type, all app-relative:

```ts
import { TaskSubjectType } from '@prisma/client';

/**
 * SPEC §4.2 — the `url` on bridge evidence is an app-relative deep link
 * (decision 2), rendered by the frontend as an internal <Link>. The paths below
 * are the routes that exist today; Phase 32 may rename them, in which case only
 * this file changes.
 */
const SUBJECT_PATH: Record<TaskSubjectType, (id: string) => string> = {
  recipe: (id) => `/operations/recipes/${id}`,
  product: (id) => `/operations/menu?product=${id}`,
  event: (id) => `/operations/events/${id}`,
  vendor: (id) => `/operations/vendors/${id}`,
  purchase_order: (id) => `/operations/purchase-orders/${id}`,
  prep_batch: (id) => `/operations/kitchen/prep-batches?batch=${id}`,
  order: (id) => `/orders/${id}`,
  decision: (id) => `/decisions?decision=${id}`,
};

export function bridgeDeepLink(subjectType: TaskSubjectType, subjectId: string): string {
  return SUBJECT_PATH[subjectType](subjectId);
}

/**
 * Renders the human-readable note stored on the evidence row. `values` are the
 * event payload fields the rule chose to surface; unknown keys are ignored so a
 * payload change can never crash the bridge.
 */
export function renderBridgeNote(
  template: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const v = values[key];
    return v === undefined || v === null ? '—' : String(v);
  });
}
```

- [ ] Create `backend/src/mission-bridge/bridge-links.spec.ts`: one case per `TaskSubjectType` asserting the exact path string; `renderBridgeNote('PO {po} received from {vendor}', { po: 'PO-1', vendor: 'Acme' })` → `'PO PO-1 received from Acme'`; a missing key renders `'—'`; a template with no placeholders is returned verbatim.
- [ ] Create `backend/src/mission-bridge/mission-bridge.service.ts`. Subject resolution first (SPEC §4.2's three routes: `Task.subject_type/subject_id`, `PurchaseOrder.linked_task_id`, `Decision.linked_task_id`):

```ts
import { Injectable, Logger } from '@nestjs/common';
import {
  BridgeOutcome, EvidenceSource, EvidenceType, Prisma, TaskSubjectType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_USER_ID } from '../common/constants/system-actor';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { hasPrismaCode } from '../common/utils/transaction-retry';
import type { Tx } from '../common/types/transaction';
import { bridgeDeepLink, renderBridgeNote } from './bridge-links';
import type { BridgeRule } from './mission-bridge.rules';
import type { DomainEventName, DomainEventPayloads } from '../common/events/domain-events';

export interface BridgeSubject {
  subject_type: TaskSubjectType;
  subject_id: string;
  /** Explicit task link when the source row carries one (PO/Decision). */
  explicit_task_id?: string | null;
}

@Injectable()
export class MissionBridgeService {
  private readonly logger = new Logger(MissionBridgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * SPEC §4.2 — a source entity resolves to a task via an explicit link
   * (`PurchaseOrder.linked_task_id`, `Decision.linked_task_id`) or via
   * `Task.subject_type/subject_id` (indexed by `@@index([subject_type, subject_id])`).
   * The newest matching open task wins; a validated task is never re-evidenced.
   */
  async resolveTaskId(tx: Tx, subject: BridgeSubject): Promise<string | null> {
    if (subject.explicit_task_id) return subject.explicit_task_id;
    const task = await tx.task.findFirst({
      where: {
        subject_type: subject.subject_type,
        subject_id: subject.subject_id,
        valid: false,
      },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
    return task?.id ?? null;
  }
}
```

- [ ] Same file — the dispatch guard and the evidence writer:

```ts
  /**
   * Runs `fn` exactly once for `(rule_key, source_type, source_id)`. The
   * `BridgeDispatch` insert is the lock: a replayed event hits the unique index
   * (P2002) and returns `null` without doing any work.
   */
  async dispatchOnce<T>(
    ruleKey: string,
    event: string,
    subject: BridgeSubject,
    nodeId: string,
    fn: (tx: Tx) => Promise<{ outcome: BridgeOutcome; task_id?: string | null; evidence_id?: string | null; detail?: string }>,
  ): Promise<T | null> {
    try {
      await this.prisma.$transaction(async (tx: Tx) => {
        const claim = await tx.bridgeDispatch.create({
          data: {
            node_id: nodeId,
            rule_key: ruleKey,
            event,
            source_type: subject.subject_type,
            source_id: subject.subject_id,
            outcome: BridgeOutcome.applied,
          },
          select: { id: true },
        });
        const result = await fn(tx);
        await tx.bridgeDispatch.update({
          where: { id: claim.id },
          data: {
            outcome: result.outcome,
            task_id: result.task_id ?? null,
            evidence_id: result.evidence_id ?? null,
            detail: result.detail ?? null,
          },
        });
      });
      return null;
    } catch (err) {
      if (hasPrismaCode(err, 'P2002')) {
        this.logger.debug(`bridge ${ruleKey} already dispatched for ${subject.subject_type}:${subject.subject_id}`);
        return null;
      }
      // Failure isolation: the bridge must never fail the caller's request.
      this.logger.warn(`bridge ${ruleKey} failed: ${String(err)}`);
      return null;
    }
  }

  /**
   * SPEC §4.2 — bridge evidence: `type: system`, `source: bridge`, deep link,
   * rendered note, uploaded by the system user, `approval_status: pending`.
   * Humans still approve; the bridge only removes re-typing.
   */
  async createBridgeEvidence(
    tx: Tx,
    taskId: string,
    rule: Pick<BridgeRule, 'key' | 'event' | 'note_template'>,
    subject: BridgeSubject,
    values: Record<string, string | number | null | undefined>,
  ): Promise<string> {
    const evidence = await tx.evidence.create({
      data: {
        task_id: taskId,
        uploaded_by: SYSTEM_USER_ID,
        type: EvidenceType.system,
        source: EvidenceSource.bridge,
        bridge_event: rule.event,
        url: bridgeDeepLink(subject.subject_type, subject.subject_id),
        notes: renderBridgeNote(rule.note_template, values),
      },
      select: { id: true },
    });
    return evidence.id;
  }

  /** Observability for `GET /mission-bridge/dispatches`. */
  async listDispatches(limit = 50, cursor?: string) {
    return this.prisma.bridgeDispatch.findMany({
      where: cursor ? { created_at: { lt: new Date(cursor) } } : {},
      orderBy: { created_at: 'desc' },
      take: Math.min(limit, 200),
    });
  }
```

- [ ] Create `backend/src/mission-bridge/mission-bridge.rules.ts` with the `BridgeRule` type and the rule table. Task 12 fills in the `signal` and `spawn` halves; this task declares the full shape so the table is written once:

```ts
import { TaskSubjectType } from '@prisma/client';
import { DomainEvent, type DomainEventName } from '../common/events/domain-events';

/** Meter codes the rules target (SPEC §4.3). */
export type MeterCode = 'STANDARDIZATION' | 'PROCUREMENT' | 'SALES' | 'QUALITY';

export interface BridgeRule {
  /** Stable identity for `BridgeDispatch.rule_key` — never renamed once shipped. */
  key: string;
  event: DomainEventName;
  subject_type: TaskSubjectType;
  /** Pulls `{ subject_id, explicit_task_id, values }` out of the typed payload. */
  select: (payload: any) => {
    subject_id: string;
    explicit_task_id?: string | null;
    values: Record<string, string | number | null | undefined>;
  };
  /** SPEC §4.2 "evidence" — omit to skip evidence creation for this rule. */
  note_template: string;
  evidence: boolean;
  /** SPEC §4.2 "signal" — meter and contribution value; omit for no signal. */
  signal?: { meter: MeterCode; value: number };
  /** SPEC §4.2 "task spawn" — see Task 12; only `feedback.received` uses it. */
  spawn?: 'low_rating_improvement';
  /** 'P3' = an emitter exists in this phase; 'P5' = declared, wired in Phase 33. */
  emitter: 'P3' | 'P5';
}

export const BRIDGE_RULES: BridgeRule[] = [
  {
    key: 'recipe_approved_v1',
    event: DomainEvent.RECIPE_APPROVED,
    subject_type: TaskSubjectType.recipe,
    select: (p) => ({ subject_id: p.recipeId, values: { name: p.name, version: p.version, cost: p.computedCost } }),
    note_template: 'Recipe "{name}" v{version} approved (computed cost {cost}).',
    evidence: true,
    signal: { meter: 'STANDARDIZATION', value: 1 },
    emitter: 'P3',
  },
  {
    key: 'recipe_archived_v1',
    event: DomainEvent.RECIPE_ARCHIVED,
    subject_type: TaskSubjectType.recipe,
    select: (p) => ({ subject_id: p.recipeId, values: { name: p.name, version: p.version } }),
    note_template: 'Recipe "{name}" v{version} archived.',
    evidence: true,
    signal: { meter: 'STANDARDIZATION', value: -1 },
    emitter: 'P3',
  },
  {
    key: 'purchase_order_received_v1',
    event: DomainEvent.PURCHASE_ORDER_RECEIVED,
    subject_type: TaskSubjectType.purchase_order,
    select: (p) => ({
      subject_id: p.purchaseOrderId,
      explicit_task_id: p.linkedTaskId,
      values: { vendor: p.vendorName, lines: p.lineCount, total: p.totalAmount },
    }),
    note_template: 'Purchase order received from {vendor} — {lines} line(s), total {total}.',
    evidence: true,
    signal: { meter: 'PROCUREMENT', value: 1 },
    emitter: 'P3',
  },
  {
    key: 'vendor_price_updated_v1',
    event: DomainEvent.VENDOR_PRICE_UPDATED,
    subject_type: TaskSubjectType.vendor,
    select: (p) => ({ subject_id: p.vendorId, values: { ingredient: p.ingredientName, price: p.price, unit: p.unit } }),
    note_template: 'Vendor price for {ingredient} set to {price} per {unit}.',
    evidence: true,
    signal: { meter: 'PROCUREMENT', value: 1 },
    emitter: 'P3',
  },
  {
    key: 'stock_low_v1',
    event: DomainEvent.STOCK_LOW,
    subject_type: TaskSubjectType.vendor,
    select: (p) => ({ subject_id: p.ingredientId, values: { name: p.ingredientName, qty: p.currentQty, min: p.minQty } }),
    note_template: 'Stock for {name} fell to {qty} (minimum {min}).',
    evidence: false,
    signal: { meter: 'PROCUREMENT', value: -1 },
    emitter: 'P3',
  },
  {
    key: 'prep_batch_created_v1',
    event: DomainEvent.PREP_BATCH_CREATED,
    subject_type: TaskSubjectType.prep_batch,
    select: (p) => ({ subject_id: p.prepBatchId, values: { recipe: p.recipeName, qty: p.quantityProduced, unit: p.unit } }),
    note_template: 'Prep batch of {recipe} produced — {qty} {unit}.',
    evidence: true,
    signal: { meter: 'STANDARDIZATION', value: 1 },
    emitter: 'P3',
  },
  {
    key: 'prep_batch_depleted_v1',
    event: DomainEvent.PREP_BATCH_DEPLETED,
    subject_type: TaskSubjectType.prep_batch,
    select: (p) => ({ subject_id: p.prepBatchId, values: { recipe: p.recipeName } }),
    note_template: 'Prep batch of {recipe} fully depleted.',
    evidence: true,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P3',
  },
  {
    key: 'order_confirmed_v1',
    event: DomainEvent.ORDER_CONFIRMED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({ subject_id: p.orderId, values: { number: p.orderNumber, channel: p.channel, total: p.total } }),
    note_template: 'Order #{number} confirmed on {channel} — {total}.',
    evidence: true,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P3',
  },
  {
    key: 'order_served_v1',
    event: DomainEvent.ORDER_SERVED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({ subject_id: p.orderId, values: { number: p.orderNumber, channel: p.channel, total: p.total } }),
    note_template: 'Order #{number} served on {channel}.',
    evidence: false,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P3',
  },
  {
    key: 'order_delivered_v1',
    event: DomainEvent.ORDER_DELIVERED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({ subject_id: p.orderId, values: { number: p.orderNumber, channel: p.channel, total: p.total } }),
    note_template: 'Order #{number} delivered.',
    evidence: false,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P3',
  },
  {
    key: 'waste_logged_v1',
    event: DomainEvent.WASTE_LOGGED,
    subject_type: TaskSubjectType.prep_batch,
    select: (p) => ({
      subject_id: p.prepBatchId ?? p.ingredientId ?? p.wasteLogId,
      values: { reason: p.reason, cost: p.costImpact },
    }),
    note_template: 'Waste logged ({reason}) — cost impact {cost}.',
    evidence: true,
    signal: { meter: 'QUALITY', value: -1 },
    emitter: 'P3',
  },
  {
    key: 'feedback_received_v1',
    event: DomainEvent.FEEDBACK_RECEIVED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({ subject_id: p.orderId ?? p.feedbackId, values: { rating: p.rating, comment: p.comment } }),
    note_template: 'Guest feedback received — {rating}/5. "{comment}"',
    evidence: true,
    signal: { meter: 'QUALITY', value: 1 },
    spawn: 'low_rating_improvement',
    emitter: 'P3',
  },
  {
    key: 'product_published_v1',
    event: DomainEvent.PRODUCT_PUBLISHED,
    subject_type: TaskSubjectType.product,
    select: (p) => ({ subject_id: p.productId, values: { name: p.name, type: p.type } }),
    note_template: 'Product "{name}" ({type}) published to the catalog.',
    evidence: true,
    signal: { meter: 'STANDARDIZATION', value: 1 },
    emitter: 'P3',
  },
  {
    key: 'event_completed_v1',
    event: DomainEvent.EVENT_COMPLETED,
    subject_type: TaskSubjectType.event,
    select: (p) => ({ subject_id: p.eventId, values: { title: p.title, attended: p.attendedCount } }),
    note_template: 'Experience "{title}" completed — {attended} guest(s) attended.',
    evidence: true,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P3',
  },
  {
    key: 'decision_resolved_v1',
    event: DomainEvent.DECISION_RESOLVED,
    subject_type: TaskSubjectType.decision,
    select: (p) => ({ subject_id: p.decisionId, explicit_task_id: p.linkedTaskId, values: { title: p.title, status: p.status, tier: p.tier } }),
    note_template: 'Decision "{title}" ({tier}) resolved as {status}.',
    evidence: true,
    emitter: 'P3',
  },
  {
    key: 'approval_decided_v1',
    event: DomainEvent.APPROVAL_DECIDED,
    subject_type: TaskSubjectType.decision,
    select: (p) => ({ subject_id: p.entityId, values: { role: p.requiredRoleCode, status: p.status } }),
    note_template: 'Approval by {role} recorded as {status}.',
    evidence: false,
    emitter: 'P3',
  },
  // ── Declared for Phase 33 (P5); no emitter exists yet (decision 13). ──────
  {
    key: 'booking_attended_v1',
    event: DomainEvent.BOOKING_ATTENDED,
    subject_type: TaskSubjectType.event,
    select: (p) => ({ subject_id: p.eventId, values: { guests: p.guests } }),
    note_template: 'Booking attended — {guests} guest(s).',
    evidence: true,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P5',
  },
  {
    key: 'shipment_delivered_v1',
    event: DomainEvent.SHIPMENT_DELIVERED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({ subject_id: p.orderId, values: { awb: p.awb } }),
    note_template: 'Shipment delivered (AWB {awb}).',
    evidence: true,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P5',
  },
  {
    key: 'review_published_v1',
    event: DomainEvent.REVIEW_PUBLISHED,
    subject_type: TaskSubjectType.product,
    select: (p) => ({ subject_id: p.productId, values: { rating: p.rating } }),
    note_template: 'Review published — {rating}/5.',
    evidence: false,
    signal: { meter: 'QUALITY', value: 1 },
    emitter: 'P5',
  },
  {
    key: 'coupon_redeemed_v1',
    event: DomainEvent.COUPON_REDEEMED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({ subject_id: p.orderId, values: { code: p.code, amount: p.amount } }),
    note_template: 'Coupon {code} redeemed for {amount}.',
    evidence: false,
    signal: { meter: 'SALES', value: 1 },
    emitter: 'P5',
  },
  {
    key: 'shipment_status_changed_v1',
    event: DomainEvent.SHIPMENT_STATUS_CHANGED,
    subject_type: TaskSubjectType.order,
    select: (p) => ({ subject_id: p.orderId, values: { status: p.status, awb: p.awb } }),
    note_template: 'Shipment status changed to {status} (AWB {awb}).',
    evidence: false,
    emitter: 'P5',
  },
];

export const RULES_BY_EVENT = new Map<DomainEventName, BridgeRule[]>(
  BRIDGE_RULES.reduce((acc, rule) => {
    const list = acc.get(rule.event) ?? [];
    list.push(rule);
    acc.set(rule.event, list);
    return acc;
  }, new Map<DomainEventName, BridgeRule[]>()),
);
```

- [ ] Create `backend/src/mission-bridge/mission-bridge.listener.ts` — one `@OnEvent` per P3-emitted event, each delegating to `MissionBridgeService.apply(event, payload)` (implemented as `applyEvidenceOnly` in this task, extended in Task 12). Use the explicit-decorator form rather than a wildcard so the subscribed set is greppable:

```ts
@Injectable()
export class MissionBridgeListener {
  constructor(private readonly bridge: MissionBridgeService) {}

  @OnEvent(DomainEvent.RECIPE_APPROVED)
  onRecipeApproved(p: DomainEventPayloads['recipe.approved']) {
    void this.bridge.apply(DomainEvent.RECIPE_APPROVED, p);
  }
  // … one handler per rule with emitter === 'P3' (16 handlers total:
  // recipe.approved, recipe.archived, purchase_order.received, vendor_price.updated,
  // stock.low, prep_batch.created, prep_batch.depleted, order.confirmed, order.served,
  // order.delivered, waste.logged, feedback.received, product.published,
  // event.completed, decision.resolved, approval.decided)
}
```

  `apply` never rejects (every path goes through `dispatchOnce`, which catches), so `void` is correct and no handler needs its own try/catch.

- [ ] Same file group — `MissionBridgeService.apply` in `mission-bridge.service.ts`:

```ts
  /** Entry point for every subscribed event. Never throws. */
  async apply<K extends DomainEventName>(event: K, payload: DomainEventPayloads[K]): Promise<void> {
    const rules = RULES_BY_EVENT.get(event) ?? [];
    for (const rule of rules) {
      const picked = rule.select(payload);
      const subject: BridgeSubject = {
        subject_type: rule.subject_type,
        subject_id: picked.subject_id,
        explicit_task_id: picked.explicit_task_id,
      };
      const nodeId = payload.node_id ?? DEFAULT_NODE_ID;

      await this.dispatchOnce(rule.key, rule.event, subject, nodeId, async (tx) => {
        const taskId = await this.resolveTaskId(tx, subject);
        if (rule.evidence && !taskId) {
          return { outcome: BridgeOutcome.skipped_no_task, detail: 'no open task for subject' };
        }
        const evidenceId =
          rule.evidence && taskId
            ? await this.createBridgeEvidence(tx, taskId, rule, subject, picked.values)
            : null;
        return { outcome: BridgeOutcome.applied, task_id: taskId, evidence_id: evidenceId };
      });
    }
  }
```

- [ ] Create `backend/src/mission-bridge/mission-bridge.controller.ts` — `@Controller('mission-bridge')`, `@Get('dispatches') @RequiresPermission(Permission.MANAGE_SYSTEM)` with `@Query('limit')`/`@Query('cursor')`, returning `listDispatches`.
- [ ] Create `backend/src/mission-bridge/mission-bridge.module.ts`:

```ts
@Module({
  imports: [ReadinessModule],   // ReadinessDerivationService is consumed in Task 12
  controllers: [MissionBridgeController],
  providers: [MissionBridgeService, MissionBridgeListener],
  exports: [MissionBridgeService],
})
export class MissionBridgeModule {}
```

- [ ] `backend/src/app.module.ts` — `import { MissionBridgeModule } from './mission-bridge/mission-bridge.module';` and add `MissionBridgeModule,` to `imports` after `ActivityModule,`.
- [ ] Create `backend/src/mission-bridge/mission-bridge.service.spec.ts` using `mockPrisma()`:
  - `resolveTaskId` returns `explicit_task_id` without querying when it is set (assert `prisma.task.findFirst` not called).
  - `resolveTaskId` queries `{ subject_type, subject_id, valid: false }` ordered `created_at desc` and returns the id.
  - `resolveTaskId` returns `null` when no task matches.
  - `createBridgeEvidence` writes `type: 'system'`, `source: 'bridge'`, `bridge_event`, `uploaded_by: SYSTEM_USER_ID`, the deep link and the rendered note, and **does not** set `approval_status` (the schema default is `pending`) — assert the created payload.
  - `dispatchOnce` creates the `BridgeDispatch` claim before calling `fn` and updates it with the returned outcome.
  - `dispatchOnce` swallows a P2002 from the claim insert and never calls `fn` (`prisma.$transaction` mock rejects with `{ code: 'P2002' }`).
  - `dispatchOnce` swallows any other error and resolves (failure isolation).
  - `apply('recipe.approved', …)` with a resolvable task creates one evidence row; with no resolvable task records `outcome: 'skipped_no_task'` and creates none.
  - `apply` on an event with no rule is a no-op.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent src/mission-bridge` — expect 2 suites passed.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 62 passed, 62 total` (60 baseline + this task's 2).
- [ ] `cd backend && npx eslint "{src,apps,libs,test}/**/*.ts"` — expect `0 errors`.
- [ ] `git add backend/src/mission-bridge backend/src/app.module.ts && git commit -m "feat(p3-04): MissionBridgeService, rule table, dispatch ledger, bridge evidence" -- backend/src/mission-bridge backend/src/app.module.ts`

---

### Task 5: Emitters — every ops service fires its typed event after commit (BRIDGE-01)

Fourteen emit sites. Every one goes **after** the `$transaction` resolves, through `emitDomainEvent`, with `domainEventBase(node_id, actor)`. The five existing emits are retyped in place; `notification-events.ts` is deleted (decision 14).

**Files:**
- Modify: `backend/src/inventory/inventory.service.ts`, `backend/src/orders/orders.service.ts`, `backend/src/kitchen/kds/kds.service.ts`, `backend/src/kitchen/prep-batches/prep-batches.service.ts`, `backend/src/kitchen/waste/waste.service.ts`, `backend/src/purchase-orders/purchase-orders.service.ts`, `backend/src/fulfilment/fulfilment.service.ts`, `backend/src/catalog/catalog.service.ts`, `backend/src/vendors/vendors.service.ts`, `backend/src/feedback/feedback.service.ts`, `backend/src/events/events.service.ts`, `backend/src/notifications/notifications.listener.ts`
- Modify (specs): `backend/src/orders/orders.service.spec.ts`, `backend/src/purchase-orders/purchase-orders.service.spec.ts`, `backend/src/kitchen/prep-batches/prep-batches.service.spec.ts`, `backend/src/feedback/feedback.service.spec.ts`, `backend/src/fulfilment/fulfilment.service.spec.ts`, `backend/src/catalog/catalog.service.spec.ts`, `backend/src/events/events.service.spec.ts`
- Delete: `backend/src/notifications/events/notification-events.ts` (and the empty `events/` directory)

- [ ] Retype the five existing emits. Each keeps its event name and field names and gains the `{ node_id, actor, occurred_at }` prefix. Example — `backend/src/orders/orders.service.ts:184-194` becomes:

```ts
    emitDomainEvent(this.eventEmitter, DomainEvent.ORDER_PLACED, {
      ...domainEventBase(order.node_id, userActor(userId)),
      orderId: order.id,
      channel: order.channel,
      itemCount: order.items?.length ?? 0,
      total: String(order.total),
      createdBy: userId,
    });
```

  Apply the same shape at `orders.service.ts:519` (`delivery.updated`, `userActor(userId)`), `kds.service.ts:237` (`order.ready`, `userActor(userId)`), `inventory.service.ts:158` (`stock.low`, `systemActor()`, `node_id` from `DEFAULT_NODE_ID` — `IngredientStock` has none), `tasks.service.ts:309` is **owned by Task 8** and is retyped there.

- [ ] `backend/src/notifications/notifications.listener.ts` — replace the `./events/notification-events` import with:

```ts
import type { DomainEventPayloads } from '../common/events/domain-events';
import { DomainEvent } from '../common/events/domain-events';
```

  and retype each handler parameter, e.g. `async handleOrderPlaced(payload: DomainEventPayloads['order.placed'])`, and each `@OnEvent('order.placed')` → `@OnEvent(DomainEvent.ORDER_PLACED)`. The bodies are unchanged. Then `rm backend/src/notifications/events/notification-events.ts` and remove the now-empty directory.
- [ ] New emit — `purchase_order.received`, `backend/src/purchase-orders/purchase-orders.service.ts`. The receive transaction ends at line 279; capture `po.linked_task_id`, `po.vendor`, and `newStatus` from the transaction result and emit after it resolves:

```ts
    emitDomainEvent(this.eventEmitter, DomainEvent.PURCHASE_ORDER_RECEIVED, {
      ...domainEventBase(updated.node_id, userActor(userId)),
      purchaseOrderId: poId,
      vendorId: updated.vendor_id,
      vendorName: updated.vendor?.name ?? '',
      linkedTaskId: updated.linked_task_id ?? null,
      lineCount: dto.lines.length,
      totalAmount: String(updated.total_amount),
      fullyReceived: updated.status === PurchaseOrderStatus.received,
    });
```

  `PurchaseOrdersService` does not inject `EventEmitter2` today — add it to the constructor and add `provideEventEmitter()` to `purchase-orders.service.spec.ts`'s providers.
- [ ] New emit — `prep_batch.created`, `backend/src/kitchen/prep-batches/prep-batches.service.ts` after the `createPrepBatch` transaction (line 213–…), with `recipeName` from the batch's included recipe.
- [ ] New emit — `prep_batch.depleted`, same file, in `deductSubRecipeBatches` (line ~390) where `newRemaining <= 0` flips the status. Collect the depleted batch ids in a local array inside the transaction and emit one event per id after it resolves.
- [ ] New emit — `waste.logged`, `backend/src/kitchen/waste/waste.service.ts` after both `createWasteLog` transaction branches (lines 126 and 234), carrying `wasteLogId`, `wasteType`, `reason`, `costImpact`, `zoneId`, `ingredientId`, `prepBatchId`.
- [ ] New emits — `order.confirmed`, `backend/src/fulfilment/fulfilment.service.ts` after the `confirmPaidOrder` transaction (line ~440) with `customerActor(customerId)`; and `order.served` / `order.delivered` in `backend/src/orders/orders.service.ts` `updateStatus` after the transaction, gated on `newStatus === OrderStatus.served` and `newStatus === OrderStatus.delivered` respectively.
- [ ] New emit — `product.published`, `backend/src/catalog/catalog.service.ts` `setStatus` (line 269). Fire only on the `draft|archived → active` transition, so re-saving an active product does not re-emit: read the existing status first inside the same call, then emit after the update resolves. `CatalogService` does not inject `EventEmitter2` — add it and `provideEventEmitter()` to `catalog.service.spec.ts`.
- [ ] New emit — `vendor_price.updated`, `backend/src/vendors/vendors.service.ts` `addPrice` (line 101), after `recalculateCostsForIngredient`. Add `EventEmitter2` to the constructor.
- [ ] New emit — `feedback.received`, `backend/src/feedback/feedback.service.ts` `submit` (line 10), after the create resolves. Add `EventEmitter2` to the constructor and `provideEventEmitter()` to `feedback.service.spec.ts`.
- [ ] New emit — `event.completed`, `backend/src/events/events.service.ts` `update` (line 130), gated on the transition to `EventStatus.past`, with `attendedCount` from a `eventBooking.count({ where: { event_id, payment_status: { in: ['paid', 'free'] } } })` taken after the update.
- [ ] Spec updates — for every service that gained an emitter, add one case asserting the emit happened with the right name and that it happened **after** the write (assert the emitter mock was called and that `prisma.$transaction` resolved first), plus one case asserting a throwing emitter does not fail the method (`emit: jest.fn(() => { throw new Error('x'); })` → the method still resolves). Existing assertions on the five retyped events must be updated to expect the new `node_id`/`actor`/`occurred_at` keys — use `expect.objectContaining({ orderId: … })` so the base fields do not have to be spelled out.
- [ ] `cd backend && grep -rn "eventEmitter.emit(" src --include=*.ts | grep -v spec` — expect **zero** hits: every emit now goes through `emitDomainEvent`.
- [ ] `cd backend && grep -rn "notification-events" src --include=*.ts` — expect zero hits.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 60 passed, 60 total` (no new suites; existing suites gain cases).
- [ ] `cd backend && npx eslint "{src,apps,libs,test}/**/*.ts"` — expect `0 errors`.
- [ ] `git commit -m "feat(p3-05): every ops service emits its typed domain event after commit" -- backend/src/inventory backend/src/orders backend/src/kitchen backend/src/purchase-orders backend/src/fulfilment backend/src/catalog backend/src/vendors backend/src/feedback backend/src/events backend/src/notifications`

---

### Task 6: The four derived-meter formulas as pure functions (READY-01)

SPEC §4.3's arithmetic, isolated from Prisma so every edge case is unit-testable. The service that gathers the snapshot is Task 7.

**Files:**
- Create: `backend/src/readiness/derivation/derivation.types.ts`, `derived-meters.ts`, `derived-meters.spec.ts`, `meter-value.ts`, `meter-value.spec.ts`

- [ ] Create `backend/src/readiness/derivation/derivation.types.ts` — the snapshot shapes each formula consumes:

```ts
/** Everything the four SPEC §4.3 formulas need, gathered once per recompute. */
export interface StandardizationInput {
  /** Active prepared_food/packaged products with their recipe status and cost. */
  products: { recipe_status: string | null; computed_cost: number | null }[];
}

export interface ProcurementInput {
  /** One entry per distinct recipe-input ingredient in an approved recipe's BOM. */
  ingredients: {
    ingredient_id: string;
    has_active_vendor_price: boolean;
    stock_on_hand: number;
    min_stock_level: number;
  }[];
}

export interface SalesInput {
  /** Distinct channels with >= 1 completed order in the trailing window. */
  channels_with_orders: number;
  /** Total completed orders in the trailing window. */
  completed_orders: number;
  points_per_channel: number;
  volume_threshold: number;
  volume_bonus: number;
}

export interface QualityInput {
  waste_cost: number;
  cogs: number;
  /** Mean of Feedback.rating (1-5) in the window; null when there is none. */
  average_rating: number | null;
  waste_multiplier: number;
}

export interface DerivedResult {
  value: number;
  /** Rows behind the number — surfaced by the API so the UI can explain it. */
  sample_size: number;
  detail: Record<string, number>;
}
```

- [ ] Create `backend/src/readiness/derivation/derived-meters.ts`:

```ts
import type {
  DerivedResult, ProcurementInput, QualityInput, SalesInput, StandardizationInput,
} from './derivation.types';

export const clamp = (n: number, lo = 0, hi = 100): number =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;

/** Round to two decimals — `ReadinessSnapshot.value` is `Decimal(6,2)`. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * SPEC §4.3 STANDARDIZATION — % of active prepared_food/packaged products whose
 * recipe is `approved` AND has `computed_cost > 0`. An empty catalog scores 0:
 * nothing is standardised when nothing is sellable.
 */
export function standardization(input: StandardizationInput): DerivedResult {
  const total = input.products.length;
  if (total === 0) return { value: 0, sample_size: 0, detail: { total: 0, standardised: 0 } };
  const ok = input.products.filter(
    (p) => p.recipe_status === 'approved' && (p.computed_cost ?? 0) > 0,
  ).length;
  return {
    value: round2(clamp((ok / total) * 100)),
    sample_size: total,
    detail: { total, standardised: ok },
  };
}

/**
 * SPEC §4.3 PROCUREMENT — % of BOM ingredients (across approved recipes) that
 * have an active VendorPrice AND IngredientStock >= min_quantity.
 */
export function procurement(input: ProcurementInput): DerivedResult {
  const total = input.ingredients.length;
  if (total === 0) return { value: 0, sample_size: 0, detail: { total: 0, covered: 0 } };
  const covered = input.ingredients.filter(
    (i) => i.has_active_vendor_price && i.stock_on_hand >= i.min_stock_level,
  ).length;
  return {
    value: round2(clamp((covered / total) * 100)),
    sample_size: total,
    detail: { total, covered },
  };
}

/**
 * SPEC §4.3 SALES — min(100, 25 x channels with >= 1 completed order in the
 * trailing 7 days) plus a flat bonus at >= 10 orders/week (decision 9).
 */
export function sales(input: SalesInput): DerivedResult {
  const base = input.channels_with_orders * input.points_per_channel;
  const bonus = input.completed_orders >= input.volume_threshold ? input.volume_bonus : 0;
  return {
    value: round2(clamp(base + bonus)),
    sample_size: input.completed_orders,
    detail: { channels: input.channels_with_orders, base, bonus },
  };
}

/**
 * SPEC §4.3 QUALITY — 100 - clamp(waste_cost / COGS x 100 x 5) blended 50/50
 * with average rating x 20. With no COGS the waste half is a perfect 100 (there
 * is nothing to have wasted); with no ratings the rating half falls back to the
 * waste half so the meter is never dragged to 50 by silence.
 */
export function quality(input: QualityInput): DerivedResult {
  const wastePct =
    input.cogs > 0 ? clamp((input.waste_cost / input.cogs) * 100 * input.waste_multiplier) : 0;
  const wasteHalf = clamp(100 - wastePct);
  const ratingHalf = input.average_rating === null ? wasteHalf : clamp(input.average_rating * 20);
  return {
    value: round2(clamp(wasteHalf * 0.5 + ratingHalf * 0.5)),
    sample_size: input.cogs > 0 ? 1 : 0,
    detail: { waste_half: round2(wasteHalf), rating_half: round2(ratingHalf) },
  };
}

/** `ReadinessMeter.formula_key` → formula. Keys are seeded in seed-data/reference.ts. */
export const DERIVED_FORMULAS = {
  standardization_v1: 'STANDARDIZATION',
  procurement_v1: 'PROCUREMENT',
  sales_v1: 'SALES',
  quality_v1: 'QUALITY',
} as const;

/**
 * SPEC §4.3 — a `hybrid` meter's `formula_key` names the derived meter it blends
 * with, so the mapping needs no extra table or setting. Seeded in
 * `prisma/seed-data/reference.ts` as `hybrid_backend_v1` / `hybrid_frontend_v1`.
 */
export const HYBRID_PARTNER_CODES = {
  hybrid_backend_v1: 'STANDARDIZATION',
  hybrid_frontend_v1: 'SALES',
} as const;
```

- [ ] Create `backend/src/readiness/derivation/meter-value.ts` (decision 10 — the single blend rule, imported by both `ReadinessDerivationService` and `EvidenceService`):

```ts
import { MeterMode } from '@prisma/client';
import { clamp, round2 } from './derived-meters';

/**
 * SPEC §4.3 — the published `ReadinessMeter.current_value`:
 *   task_driven -> task_value
 *   derived     -> derived_value (0 until first computed)
 *   hybrid      -> 0.5 x task_value + 0.5 x derived_value
 */
export function blendMeterValue(
  mode: MeterMode,
  taskValue: number,
  derivedValue: number | null,
): number {
  switch (mode) {
    case MeterMode.derived:
      return round2(clamp(derivedValue ?? 0));
    case MeterMode.hybrid:
      return round2(clamp(0.5 * clamp(taskValue) + 0.5 * clamp(derivedValue ?? 0)));
    case MeterMode.task_driven:
    default:
      return round2(clamp(taskValue));
  }
}
```

- [ ] Create `backend/src/readiness/derivation/derived-meters.spec.ts` with these cases:
  - `standardization`: empty catalog → `0` with `sample_size: 0`; 4 products of which 3 approved with cost → `75`; a product whose recipe is approved but `computed_cost: 0` does not count; `computed_cost: null` does not count; all approved → `100`.
  - `procurement`: empty BOM → `0`; 5 ingredients of which 2 have both price and stock → `40`; stock exactly equal to `min_stock_level` counts as covered; no vendor price with plenty of stock does not count.
  - `sales`: 0 channels, 0 orders → `0`; 2 channels, 4 orders (points 25, threshold 10, bonus 10) → `50`; 2 channels, 12 orders → `60`; 4 channels, 40 orders → `100` (clamped, not 110); 1 channel, 10 orders → `35`.
  - `quality`: `cogs: 0`, `average_rating: null` → `100`; `waste_cost: 100`, `cogs: 1000`, multiplier 5, `average_rating: 4` → waste half `50`, rating half `80`, value `65`; `average_rating: null` with waste → both halves equal the waste half; a waste ratio beyond the clamp (`waste_cost: 10000`, `cogs: 1000`) → waste half `0`; `average_rating: 5` → rating half `100`.
  - `clamp`/`round2`: `NaN` → `0`; `-5` → `0`; `140` → `100`; `66.666…` → `66.67`.
- [ ] Create `backend/src/readiness/derivation/meter-value.spec.ts` — `task_driven` returns the task value; `derived` ignores the task value; `derived` with `null` returns `0`; `hybrid` of `(60, 40)` returns `50`; `hybrid` with `null` derived returns half the task value; every branch clamps to `[0, 100]`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent src/readiness/derivation` — expect 2 suites passed.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 62 passed, 62 total`.
- [ ] `git add backend/src/readiness/derivation && git commit -m "feat(p3-06): SPEC 4.3 derived-meter formulas and the meter blend rule" -- backend/src/readiness/derivation`

---

### Task 7: `ReadinessDerivationService`, hybrid blend, history + signals API (READY-01, READY-02, part of READY-03)

Gathers the snapshot each formula needs, publishes `current_value`, and exposes the SPEC §9 history endpoint. Snapshot **writing** and the nightly cron are Task 13.

**Files:**
- Create: `backend/src/readiness/readiness-derivation.service.ts`, `readiness-derivation.service.spec.ts`, `dto/meter-history.dto.ts`
- Modify: `backend/src/readiness/readiness.service.ts`, `readiness.controller.ts`, `readiness.module.ts`, `readiness.service.spec.ts`

- [ ] Create `backend/src/readiness/readiness-derivation.service.ts`. Constructor: `PrismaService`, `SettingsService`, `NodeService`. `ReadinessModule` gains `imports: [SettingsModule]` (`NodeModule` is `@Global()`).

```ts
@Injectable()
export class ReadinessDerivationService {
  private readonly logger = new Logger(ReadinessDerivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly node: NodeService,
  ) {}

  /**
   * Recompute one meter by code. `task_driven` meters only re-publish their
   * `task_value`; `derived`/`hybrid` meters run their formula first.
   * Returns the published `current_value`.
   */
  async recomputeMeter(code: string): Promise<number> { … }

  /** Recompute every meter of the node — used by the nightly job and the admin button. */
  async recomputeAll(): Promise<{ code: string; value: number }[]> { … }

  /** Recompute only the meters whose formula depends on the given meter code. */
  async recomputeWithHybrids(code: string): Promise<void> { … }
}
```

- [ ] Same file — the four gather methods. Each returns the matching `*Input` from `derivation.types.ts`:

```ts
  private async gatherStandardization(nodeId: string): Promise<StandardizationInput> {
    const products = await this.prisma.product.findMany({
      where: {
        node_id: nodeId,
        status: ProductStatus.active,
        type: { in: [ProductType.prepared_food, ProductType.packaged] },
      },
      select: { recipe: { select: { status: true, computed_cost: true } } },
    });
    return {
      products: products.map((p) => ({
        recipe_status: p.recipe?.status ?? null,
        computed_cost: p.recipe?.computed_cost != null ? Number(p.recipe.computed_cost) : null,
      })),
    };
  }

  private async gatherProcurement(nodeId: string): Promise<ProcurementInput> {
    // Distinct recipe-input ingredients across approved recipes' BOMs.
    const lines = await this.prisma.recipeLine.findMany({
      where: {
        ingredient_id: { not: null },
        recipe: { node_id: nodeId, status: RecipeStatus.approved },
        ingredient: { usage_type: UsageType.recipe_input },
      },
      select: { ingredient_id: true },
      distinct: ['ingredient_id'],
    });
    const ids = lines.map((l) => l.ingredient_id!).filter(Boolean);
    if (ids.length === 0) return { ingredients: [] };

    const [ingredients, prices, stocks] = await Promise.all([
      this.prisma.ingredient.findMany({
        where: { id: { in: ids } },
        select: { id: true, min_stock_level: true },
      }),
      this.prisma.vendorPrice.groupBy({
        by: ['ingredient_id'],
        where: { ingredient_id: { in: ids }, effective_date: { lte: new Date() } },
        _count: { id: true },
      }),
      this.prisma.ingredientStock.groupBy({
        by: ['ingredient_id'],
        where: { ingredient_id: { in: ids } },
        _sum: { current_quantity: true },
      }),
    ]);
    const priced = new Set(prices.map((p) => p.ingredient_id));
    const stockBy = new Map(stocks.map((s) => [s.ingredient_id, Number(s._sum.current_quantity ?? 0)]));
    return {
      ingredients: ingredients.map((i) => ({
        ingredient_id: i.id,
        has_active_vendor_price: priced.has(i.id),
        stock_on_hand: stockBy.get(i.id) ?? 0,
        min_stock_level: Number(i.min_stock_level),
      })),
    };
  }
```

  `gatherSales(nodeId, since)`: `order.groupBy({ by: ['channel'], where: { node_id, created_at: { gte: since }, status: { in: [served, delivered, completed] } }, _count: { id: true } })` — `channels_with_orders` is the group count, `completed_orders` the summed `_count.id` (decision 9). The three numeric knobs come from `settings.get('readiness')`.

  `gatherQuality(nodeId, since)`: `waste_cost` = `wasteLog.aggregate({ _sum: { cost_impact: true }, where: { node_id, created_at: { gte: since } } })`; `cogs` = `Σ quantity × recipe.computed_cost` over `orderItem.findMany({ where: { order: { node_id, created_at: { gte: since }, status: { notIn: [cancelled, refunded] } } }, select: { quantity: true, product: { select: { recipe: { select: { computed_cost: true } } } } } })` (decision 8); `average_rating` = `feedback.aggregate({ _avg: { rating: true }, where: { created_at: { gte: since } } })._avg.rating` (decision 7 — `Feedback` has no `node_id`, so it is not filtered by node; documented as single-node-safe).

- [ ] Same file — `recomputeMeter`, the only writer of `derived_value`/`task_value`/`current_value`:

```ts
  async recomputeMeter(code: string): Promise<number> {
    const nodeId = await this.node.currentId();
    const meter = await this.prisma.readinessMeter.findUnique({
      where: { node_id_code: { node_id: nodeId, code } },
    });
    if (!meter) throw new NotFoundException(`Readiness meter ${code} not found`);

    const cfg = await this.settings.get('readiness');
    const since = new Date(Date.now() - cfg.trailing_days * 24 * 60 * 60 * 1000);

    // Task-driven half is always re-derived from the active event ledger, so a
    // revoked TaskReadinessEvent is reflected even on a derived-only recompute.
    const taskAgg = await this.prisma.taskReadinessEvent.aggregate({
      where: { readiness_meter_id: meter.id, revoked_at: null },
      _sum: { value: true },
    });
    const taskValue = clamp(Number(taskAgg._sum.value ?? 0));

    let derivedValue: number | null = meter.derived_value;
    if (meter.mode === MeterMode.derived) {
      derivedValue = (await this.runFormula(meter.formula_key, nodeId, since, cfg)).value;
    } else if (meter.mode === MeterMode.hybrid) {
      const partner = HYBRID_PARTNER_CODES[meter.formula_key as keyof typeof HYBRID_PARTNER_CODES];
      derivedValue = partner ? await this.readDerivedValue(nodeId, partner) : null;
    }

    const currentValue = blendMeterValue(meter.mode, taskValue, derivedValue);
    await this.prisma.readinessMeter.update({
      where: { id: meter.id },
      data: {
        task_value: taskValue,
        derived_value: derivedValue,
        current_value: currentValue,
        last_computed_at: new Date(),
      },
    });
    return currentValue;
  }
```

  `runFormula(formulaKey, …)` switches on `DERIVED_FORMULAS[formulaKey]` and calls the matching pure function with its gathered input; an unknown or null key returns `{ value: 0, sample_size: 0, detail: {} }` and logs a warning (a mis-seeded meter must not crash a recompute). `readDerivedValue` reads the partner meter's stored `derived_value`.

  `recomputeWithHybrids(code)` calls `recomputeMeter(code)` then `recomputeMeter` for every meter whose `formula_key` maps to `code` in `HYBRID_PARTNER_CODES` — so a `STANDARDIZATION` change moves `BACKEND` in the same pass.

  `recomputeAll()` recomputes the derived meters first, then the hybrids, then the task-driven ones, and returns `{ code, value }[]`.

- [ ] `backend/src/readiness/readiness.service.ts` — add the read paths the API and UI need:

```ts
  /** SPEC §9 — GET /readiness-meters/:code/history?days=90 */
  async history(code: string, days: number) { … }   // ReadinessSnapshot rows, oldest first,
                                                    // plus a synthetic point for today from current_value
  /** The ops-derived contribution ledger behind a derived meter. */
  async signals(code: string, limit: number) { … }  // ReadinessSignal rows, newest first
  async findByCode(code: string) { … }              // 404s with the code, not the id
```

  `history` clamps `days` into `[1, cfg.history_max_days]` (default `cfg.history_default_days`) and returns `{ date: 'YYYY-MM-DD', value: number }[]`. `findAll()` keeps its current shape and ordering; the three new columns ride along automatically because it selects the whole row.

- [ ] `backend/src/readiness/readiness.controller.ts` — add three routes. `:id/tasks` keeps its `ParseUUIDPipe`, so a meter **code** path can never shadow it:

```ts
  @Get(':code/history')
  async history(@Param('code') code: string, @Query('days') days?: string) {
    return this.readinessService.history(code, Number(days) || 0);
  }

  @Get(':code/signals')
  async signals(@Param('code') code: string, @Query('limit') limit?: string) {
    return this.readinessService.signals(code, Number(limit) || 20);
  }

  @Post('recompute')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async recompute() {
    return this.derivation.recomputeAll();
  }
```

- [ ] `backend/src/readiness/readiness.module.ts` — `imports: [SettingsModule]`, `providers: [ReadinessService, ReadinessDerivationService]`, `exports: [ReadinessService, ReadinessDerivationService]` (the bridge imports `ReadinessModule`).
- [ ] Create `backend/src/readiness/dto/meter-history.dto.ts` — `MeterHistoryQueryDto { @IsOptional() @IsInt() @Min(1) days?: number }` and the `MeterHistoryPoint` response interface.
- [ ] Create `backend/src/readiness/readiness-derivation.service.spec.ts` using `mockPrisma()`, a stub `settings.get` returning the `readiness` defaults and `mockNodeService()`:
  - `recomputeMeter` on a `task_driven` meter writes `task_value` = the aggregate sum, leaves `derived_value` untouched and sets `current_value` = `task_value`.
  - `recomputeMeter` on a `derived` meter with `formula_key: 'standardization_v1'` runs the standardization gather + formula and writes `derived_value` = `current_value`.
  - `recomputeMeter` on a `hybrid` meter with `formula_key: 'hybrid_backend_v1'` reads the `STANDARDIZATION` meter's `derived_value` and writes `current_value` = the 50/50 blend.
  - `recomputeMeter` on a meter with an unknown `formula_key` writes `derived_value: 0` and does not throw.
  - `recomputeMeter` throws `NotFoundException` for an unknown code.
  - `recomputeMeter` clamps a task sum above 100 to 100.
  - `gatherProcurement` returns `{ ingredients: [] }` and never queries when the approved-recipe BOM is empty.
  - `gatherProcurement` sums `IngredientStock` across zones before comparing with `min_stock_level`.
  - `gatherSales` counts distinct channels from `groupBy` and total orders from the summed `_count`.
  - `gatherQuality` computes COGS as `Σ quantity × computed_cost` and skips items whose product has no recipe.
  - `recomputeWithHybrids('STANDARDIZATION')` recomputes `STANDARDIZATION` and then `BACKEND`.
  - `recomputeAll` orders derived → hybrid → task-driven.
- [ ] `backend/src/readiness/readiness.service.spec.ts` — add: `history` clamps `days` to the configured max; `history` returns points oldest-first; `history` with no snapshots returns just today's synthetic point; `signals` passes `take: min(limit, 100)` and `orderBy: { created_at: 'desc' }`; `findByCode` throws `NotFoundException` naming the code.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent src/readiness` — expect 4 suites passed.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 63 passed, 63 total` (60 baseline + Task 6's 2 + this task's 1).
- [ ] `git add backend/src/readiness && git commit -m "feat(p3-07): ReadinessDerivationService, hybrid blend, history and signals API" -- backend/src/readiness`

---

### Task 8: Policy-generated approvals on task create/update (GOV-02, part 1)

`TasksService` becomes a policy client: a task with `requires_approval` gets one pending `Approval` per required role, inside the same transaction that writes the task. This task also owns the `task.blocked` retype left over from Task 5.

**Files:**
- Modify: `backend/src/tasks/tasks.service.ts`, `tasks.module.ts`, `tasks.controller.ts`, `dto/create-task.dto.ts`, `dto/update-task.dto.ts`, `tasks.service.spec.ts`

- [ ] `backend/src/tasks/dto/create-task.dto.ts` — add the three fields P3 needs and SPEC §3.2 already has columns for:

```ts
  @IsOptional() @IsBoolean() requires_approval?: boolean;
  @IsOptional() @IsEnum(TaskSubjectType) subject_type?: TaskSubjectType;
  @IsOptional() @IsUUID() subject_id?: string;
  @IsOptional() @IsUUID() readiness_meter_id?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) readiness_value?: number;
```

  `subject_type` and `subject_id` must be supplied together — enforce in the service with a `BadRequestException`, not with a class-validator cross-field rule (the codebase has no `@ValidateIf` pairs today).

- [ ] `backend/src/tasks/dto/update-task.dto.ts` — add `requires_approval`, `subject_type`, `subject_id`, `owner_user_id`, `domain` as optional. Changing `domain` or flipping `requires_approval` to `true` re-runs policy materialisation.
- [ ] `backend/src/tasks/tasks.service.ts` — inject `ApprovalPolicyService` (available globally from Task 3) and wrap `create` in a transaction:

```ts
  async create(dto: CreateTaskDto, userId: string) {
    if ((dto.subject_type == null) !== (dto.subject_id == null)) {
      throw new BadRequestException('subject_type and subject_id must be provided together');
    }
    const created = await this.prisma.$transaction(async (tx: Tx) => {
      const task = await tx.task.create({ data: { …existing fields…,
        requires_approval: dto.requires_approval ?? true,
        subject_type: dto.subject_type ?? null,
        subject_id: dto.subject_id ?? null,
        readiness_meter_id: dto.readiness_meter_id ?? null,
        readiness_value: dto.readiness_value ?? 0,
      }, include: { … } });

      // SPEC §4.4 — one pending Approval per policy role, resolved by (scope=task, domain).
      if (task.requires_approval) {
        await this.approvalPolicy.materialise(
          tx,
          { entity_type: ApprovalEntityType.task, entity_id: task.id, scope: ApprovalScope.task, domain: task.domain },
          task.node_id,
        );
      }

      await this.auditService.record(tx, {
        entity_type: 'task', entity_id: task.id, action: 'task.created',
        ...AuditService.user(userId),
        after: { status: task.status, domain: task.domain, requires_approval: task.requires_approval },
      });
      return task;
    }, SERIALIZABLE_TX_OPTIONS);
    return created;
  }
```

- [ ] `backend/src/tasks/tasks.service.ts` `update` — inside the existing transaction (line 199), after `tx.task.update`:
  - when `requires_approval` flips `false → true`, or `domain` changes while `requires_approval` is true, call `approvalPolicy.materialise(...)` with the **new** domain;
  - when `requires_approval` flips `true → false`, delete the still-`pending` rows: `tx.approval.deleteMany({ where: { entity_type: 'task', entity_id: id, status: 'pending' } })` and record `AuditEvent(action='task.approvals_cleared')`. Already-decided rows are never deleted.
  - Add `data.updated_by = requestingUser.id` (the column exists and is never written today).
- [ ] `backend/src/tasks/tasks.service.ts` `block` (line 251) — replace the raw `this.eventEmitter.emit('task.blocked', …)` with `emitDomainEvent(this.eventEmitter, DomainEvent.TASK_BLOCKED, { ...domainEventBase(result.node_id, userActor(requestingUser.id)), taskId: id, taskTitle: result.title, ownerUserId: result.owner_user_id, blockedReason: reason })`.
- [ ] `backend/src/tasks/tasks.service.ts` `findAll` — include the pending-approval count so the UI can show a gate chip without a second round trip: add `_count: { select: { … } }` is not available (approvals are polymorphic), so run one `approval.groupBy({ by: ['entity_id'], where: { entity_type: 'task', entity_id: { in: ids }, status: 'pending' }, _count: { id: true } })` after the `findMany` and attach `pending_approvals: number` alongside the existing `is_own` flag.
- [ ] `backend/src/tasks/tasks.module.ts` — no import needed (`ApprovalPolicyModule` is `@Global()`); confirm with `npx tsc`.
- [ ] `backend/src/tasks/tasks.service.spec.ts` — add cases:
  - `create` with `requires_approval: true` (the default) calls `materialise` with `{ entity_type: 'task', entity_id, scope: 'task', domain }`.
  - `create` with `requires_approval: false` does not call `materialise`.
  - `create` with only `subject_type` throws `BadRequestException`.
  - `create` writes `subject_type`/`subject_id` through to `task.create`.
  - `create` records `AuditEvent(action='task.created')` inside the transaction.
  - `update` flipping `requires_approval` to `true` calls `materialise`; flipping to `false` calls `approval.deleteMany` with `status: 'pending'`.
  - `update` changing `domain` on an approval-gated task re-materialises with the new domain.
  - `update` sets `updated_by`.
  - `block` emits `task.blocked` with `node_id`, `actor` and `occurred_at` present (`expect.objectContaining`).
  - `findAll` attaches `pending_approvals` per task.
  - Existing assertions on `create` must be updated: it now resolves through `$transaction` (the `mockPrisma` `$transaction` passes the same mock through, so only the audit/materialise expectations are new).
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent src/tasks` — expect 1 suite passed.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 60 passed, 60 total`.
- [ ] `git add backend/src/tasks && git commit -m "feat(p3-08): tasks materialise policy approvals on create and update" -- backend/src/tasks`

---

### Task 9: The approvals engine — decide, reject, override, inbox, and the validation cascade (GOV-02 part 2, GOV-04 inbox)

`ApprovalsService` grows from "evidence only" into the polymorphic engine SPEC §4.4 describes: it decides `task`, `recipe`, `decision` and `evidence` approvals, blocks self-approval, honours delegation, and drives whatever cascade the entity type needs.

**Files:**
- Modify: `backend/src/approvals/approvals.service.ts`, `approvals.controller.ts`, `approvals.module.ts`, `backend/src/approvals/__tests__/approvals.service.spec.ts`, `backend/src/approvals/dto/override-approval.dto.ts`
- Create: `backend/src/approvals/dto/decide-approval.dto.ts`, `dto/list-approvals.dto.ts`
- Modify: `backend/src/evidence/evidence.service.ts`, `evidence.module.ts`, `backend/src/evidence/evidence.service.spec.ts`, `backend/src/evidence/__tests__/cascade.spec.ts`

- [ ] Create `backend/src/approvals/dto/decide-approval.dto.ts`:

```ts
export class DecideApprovalDto {
  @IsEnum(ApprovalStatus) status!: ApprovalStatus;          // approved | rejected
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
```

  The controller enforces SPEC §6.4's "required note on reject": `status === 'rejected'` with an empty `notes` → `BadRequestException('A note is required when rejecting')`.

- [ ] Create `backend/src/approvals/dto/list-approvals.dto.ts` — `{ mine?: '0'|'1'; entity_type?: ApprovalEntityType; status?: ApprovalStatus; limit?: string; cursor?: string }`, all optional strings validated with `@IsOptional()`.
- [ ] `backend/src/approvals/approvals.service.ts` — replace `findPending()` with a polymorphic inbox that resolves every entity type's display fields in one extra query per type:

```ts
  /**
   * SPEC §6.2/§9 — the approvals inbox. `mine=1` narrows to the caller's own
   * required role plus any role they hold by active delegation.
   */
  async findApprovals(
    requestingUser: { id: string; roleCode: string },
    filters: ListApprovalsDto,
  ) {
    const roleCodes = await this.effectiveRoleCodes(requestingUser);
    const where: Prisma.ApprovalWhereInput = {
      status: filters.status ?? ApprovalStatus.pending,
      ...(filters.entity_type ? { entity_type: filters.entity_type } : {}),
      ...(filters.mine === '1' && requestingUser.roleCode !== RoleCode.FOUNDER_ADMIN
        ? { required_role_code: { in: roleCodes } }
        : {}),
      ...(filters.cursor ? { created_at: { lt: new Date(filters.cursor) } } : {}),
    };
    const approvals = await this.prisma.approval.findMany({
      where,
      include: { approver: { select: { id: true, name: true } }, policy: { select: { id: true, mode: true, min_approvals: true } } },
      orderBy: { created_at: 'asc' },
      take: Math.min(Number(filters.limit) || 50, 200),
    });
    return this.attachSubjects(approvals);
  }

  /** Header/sidebar badge — SPEC §6.1 "approvals waiting on me". */
  async countForUser(requestingUser: { id: string; roleCode: string }): Promise<{ count: number }> { … }
```

  `attachSubjects` groups the ids by `entity_type` and issues at most four queries (`task`, `recipe`, `decision`, `evidence`), attaching `{ subject: { id, title, url, owner } }` per row. The existing `task` field is preserved for backwards compatibility with `ApprovalItem.tsx` until Task 16 rewires it.

  `effectiveRoleCodes` = the caller's own role plus, when `delegationsService.getActiveDelegationForUser(userId)` returns a delegation, the delegator's role code (one `user.findUnique({ select: { role: { select: { code: true } } } })`).

- [ ] `backend/src/approvals/approvals.service.ts` — the new `decide` method, replacing `approveWithDelegation` (which becomes a thin `decide(id, user, { status: 'approved' })` shim so the existing `POST /approvals/:id/approve` route keeps working):

```ts
  async decide(
    approvalId: string,
    actingUser: { id: string; roleCode: string },
    dto: DecideApprovalDto,
  ) {
    const roleCodes = await this.effectiveRoleCodes(actingUser);
    const isFounder = actingUser.roleCode === RoleCode.FOUNDER_ADMIN;

    const result = await withSerializableRetry(() =>
      this.prisma.$transaction(async (tx: Tx) => {
        const approval = await tx.approval.findUnique({ where: { id: approvalId } });
        if (!approval) throw new NotFoundException(`Approval ${approvalId} not found`);
        if (approval.status !== ApprovalStatus.pending) {
          throw new BadRequestException(`Approval ${approvalId} is already ${approval.status}`);
        }
        if (!isFounder && !roleCodes.includes(approval.required_role_code)) {
          throw new ForbiddenException(
            `This approval is reserved for ${approval.required_role_code}`,
          );
        }
        // SPEC §4.4 — self-approval blocked (the founder override path is /override).
        const authorId = await this.entityAuthorId(tx, approval.entity_type, approval.entity_id);
        if (authorId && authorId === actingUser.id && !isFounder) {
          throw new ForbiddenException('You cannot approve your own work');
        }

        const delegatedFrom = roleCodes.includes(actingUser.roleCode) &&
          approval.required_role_code === actingUser.roleCode
            ? null
            : await this.delegatorFor(actingUser.id);

        await tx.approval.update({
          where: { id: approvalId },
          data: {
            status: dto.status,
            approved_by: actingUser.id,
            notes: dto.notes ?? null,
            delegated_from_user_id: delegatedFrom,
          },
        });
        await this.auditService.record(tx, {
          entity_type: 'approval', entity_id: approvalId, action: 'approval.decided',
          ...AuditService.user(actingUser.id),
          before: { status: ApprovalStatus.pending },
          after: { status: dto.status, delegated_from: delegatedFrom, notes: dto.notes ?? null },
        });

        const cascade = await this.cascade(tx, approval, actingUser.id);
        return { approval, cascade };
      }, SERIALIZABLE_TX_OPTIONS),
    );

    emitDomainEvent(this.eventEmitter, DomainEvent.APPROVAL_DECIDED, { … });
    return result.cascade;
  }
```

- [ ] Same file — `cascade`, the one place that knows what a satisfied gate means per entity type (decision 12):

```ts
  private async cascade(tx: Tx, approval: Approval, actorId: string) {
    switch (approval.entity_type) {
      case ApprovalEntityType.evidence: {
        // Unchanged from v1: flip the evidence row, then re-validate the task.
        const evidence = await tx.evidence.update({ … });
        return this.evidenceService.validateTask(evidence.task_id, tx);
      }
      case ApprovalEntityType.task:
        // The task's own gate — re-run the cascade so `valid` flips the moment
        // the last policy approval lands (and un-flips on a reject).
        return this.evidenceService.validateTask(approval.entity_id, tx);
      case ApprovalEntityType.recipe: {
        if (approval.status === ApprovalStatus.rejected) {
          await tx.recipe.update({ where: { id: approval.entity_id }, data: { status: RecipeStatus.draft } });
          await this.auditService.record(tx, { entity_type: 'recipe', entity_id: approval.entity_id,
            action: 'recipe.status_changed', ...AuditService.user(actorId),
            before: { status: RecipeStatus.pending }, after: { status: RecipeStatus.draft } });
          return { recipe_status: RecipeStatus.draft };
        }
        const satisfied = await this.approvalPolicy.isSatisfied(
          tx, ApprovalEntityType.recipe, approval.entity_id, ApprovalScope.recipe, TaskDomain.food,
        );
        if (!satisfied) return { recipe_status: RecipeStatus.pending };
        const recipe = await tx.recipe.update({
          where: { id: approval.entity_id },
          data: { status: RecipeStatus.approved },
          select: { id: true, name: true, version: true, computed_cost: true, node_id: true },
        });
        await this.auditService.record(tx, { entity_type: 'recipe', entity_id: recipe.id,
          action: 'recipe.approved', ...AuditService.user(actorId),
          before: { status: RecipeStatus.pending }, after: { status: RecipeStatus.approved } });
        this.pendingRecipeEmit = recipe;   // emitted after commit by `decide`
        return { recipe_status: RecipeStatus.approved };
      }
      case ApprovalEntityType.decision:
        return { decision: approval.entity_id };   // tallying lives in DecisionsService (Task 11)
    }
  }
```

  `entityAuthorId(tx, type, id)` → `task.owner_user_id` / `recipe.created_by` / `decision.proposed_by` / `evidence.uploaded_by`. `pendingRecipeEmit` is a local returned from the transaction, not instance state — implement it as a field on the transaction's return value and emit `recipe.approved` after commit (never inside).

- [ ] `backend/src/approvals/approvals.service.ts` `overrideApproval` — keep the existing behaviour and add the `cascade` call so a founder override completes a task/recipe gate too, and require the reason (already enforced by `OverrideApprovalDto`; add `@MinLength(10)` so "ok" is not a reason). Set `status: 'approved'`, `override_by`, `override_reason`, `override_at` as today.
- [ ] `backend/src/approvals/approvals.controller.ts` — routes:

```ts
@Get()            @RequiresPermission(APPROVE_EVIDENCE) findApprovals(@Query() q: ListApprovalsDto, @Req() req)
@Get('count')     @RequiresPermission(APPROVE_EVIDENCE) countForUser(@Req() req)
@Get('pending')   @RequiresPermission(APPROVE_EVIDENCE) findApprovals({ status: 'pending' })   // kept
@Post(':id/approve') @RequiresPermission(APPROVE_EVIDENCE) decide(id, req, { status: 'approved' })
@Post(':id/reject')  @RequiresPermission(APPROVE_EVIDENCE) decide(id, req, { status: 'rejected', notes })
@Post(':id/decide')  @RequiresPermission(APPROVE_EVIDENCE) decide(id, req, dto)
@Post(':id/override') @RequiresPermission(MANAGE_SYSTEM)   // unchanged, founder-only guard kept
```

- [ ] `backend/src/approvals/approvals.module.ts` — add `EventEmitter2` availability (it is provided by `EventEmitterModule.forRoot()`, no import needed) and keep `EvidenceModule`/`DelegationsModule` imports.
- [ ] `backend/src/evidence/evidence.service.ts` `validateTask` — replace the approvals block (lines 306–318) with the policy-aware rule (decision 4) and publish the meter through the shared blend:

```ts
    let approvalsSatisfied = true;
    if (task.requires_approval) {
      approvalsSatisfied = await this.approvalPolicy.isSatisfied(
        tx, ApprovalEntityType.task, taskId, ApprovalScope.task, task.domain,
      );
    }
```

  and in `applyReadinessFromTask`, replace the direct `current_value` write with:

```ts
    const meter = await tx.readinessMeter.findUnique({
      where: { id: task.readiness_meter_id },
      select: { id: true, mode: true, derived_value: true },
    });
    const taskValue = Math.min(Number(sumResult._sum.value ?? 0), 100);
    await tx.readinessMeter.update({
      where: { id: meter.id },
      data: {
        task_value: taskValue,
        current_value: blendMeterValue(meter.mode, taskValue, meter.derived_value),
        last_computed_at: new Date(),
      },
    });
```

  `EvidenceService` gains `task.domain` in its `validateTask` select and injects `ApprovalPolicyService` (global) and `EventEmitter2`.

- [ ] `backend/src/evidence/evidence.service.ts` — emit `task.validated` after the enclosing transaction commits whenever `validateTask` flips `valid` from `false` to `true`. Because `validateTask` runs *inside* a caller's transaction, it returns the flag and the two public entry points (`approveEvidence`, `rejectEvidence`) do the emitting; `ApprovalsService.decide` does the same for its own call. Add `newly_valid: boolean` to `validateTask`'s return type.
- [ ] `backend/src/approvals/__tests__/approvals.service.spec.ts` — rewrite around `decide`:
  - approving with the matching `required_role_code` sets `status: 'approved'`, `approved_by` and records `approval.decided`.
  - a role mismatch throws `ForbiddenException` naming the required role; `FOUNDER_ADMIN` bypasses it.
  - deciding an already-decided approval throws `BadRequestException`.
  - self-approval (`entityAuthorId === actingUser.id`) throws `ForbiddenException`; the founder is exempt.
  - delegation: a user without the role but with an active delegation from a holder succeeds and stores `delegated_from_user_id`.
  - rejecting with no notes is rejected by the controller-level guard (assert the service still stores `notes` when given).
  - `entity_type: 'evidence'` still flips the evidence row and calls `validateTask` (regression for the v1 path).
  - `entity_type: 'task'` calls `validateTask(entity_id)`.
  - `entity_type: 'recipe'`: not-yet-satisfied leaves the recipe `pending`; the satisfying approval flips it to `approved` and records `recipe.approved`; a rejection sends it back to `draft`.
  - `overrideApproval` sets the four override columns and runs the same cascade.
  - `findApprovals({ mine: '1' })` filters by the caller's effective role codes; a founder sees everything.
  - `countForUser` returns `{ count }`.
  - `decide` emits `approval.decided` after the transaction and does not throw when the emitter throws.
- [ ] `backend/src/evidence/__tests__/cascade.spec.ts` — update the two assertions decision 4 changes: a task with `requires_approval: true` and **zero** approval rows is now `valid: false`; a task with all rows approved is `valid: true`. Add: `requires_approval: false` still validates on approved evidence alone; `applyReadinessFromTask` writes `task_value` and a blended `current_value` for a `hybrid` meter.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent src/approvals src/evidence` — expect 4 suites passed.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 60 passed, 60 total`.
- [ ] `git add backend/src/approvals backend/src/evidence && git commit -m "feat(p3-09): polymorphic approvals engine, policy-aware validation cascade, inbox" -- backend/src/approvals backend/src/evidence`

---

### Task 10: Recipe approval flows through the `food` policy (GOV-03)

The legacy direct status flip is removed; `draft → pending` materialises the gate and the flip to `approved` happens in `ApprovalsService.cascade` (Task 9).

**Files:**
- Modify: `backend/src/recipes/recipes.service.ts`, `recipes.controller.ts`, `recipes.service.spec.ts`

- [ ] `backend/src/recipes/recipes.service.ts` `update` (lines 202–216) — narrow `ALLOWED_TRANSITIONS` and reject the removed edge with a message that points at the new route:

```ts
      const ALLOWED_TRANSITIONS: Record<RecipeStatus, RecipeStatus[]> = {
        [RecipeStatus.draft]: [RecipeStatus.pending],
        [RecipeStatus.pending]: [RecipeStatus.draft],          // withdraw only
        [RecipeStatus.approved]: [RecipeStatus.archived],
        [RecipeStatus.archived]: [],
      };
      if (existing.status === RecipeStatus.pending && dto.status === RecipeStatus.approved) {
        throw new BadRequestException(
          'Recipe approval is granted through the approvals queue, not by setting status. ' +
            'Approve the pending Approval rows for this recipe instead.',
        );
      }
```

- [ ] Same method — when the transition is `draft → pending`, materialise the gate inside the existing transaction:

```ts
      if (dto.status === RecipeStatus.pending && existing.status === RecipeStatus.draft) {
        await this.approvalPolicy.materialise(
          tx,
          { entity_type: ApprovalEntityType.recipe, entity_id: id, scope: ApprovalScope.recipe, domain: TaskDomain.food },
          existing.node_id,
        );
      }
```

  And when the transition is `pending → draft` (withdraw), delete the still-pending rows so a resubmission starts clean.

- [ ] Same method — when the transition is `approved → archived`, emit `recipe.archived` after the transaction:

```ts
    emitDomainEvent(this.eventEmitter, DomainEvent.RECIPE_ARCHIVED, {
      ...domainEventBase(existing.node_id, userActor(userId)),
      recipeId: id, name: existing.name, version: existing.version,
    });
```

  `RecipesService` gains `EventEmitter2` and `ApprovalPolicyService` in its constructor; `recipes.service.spec.ts` gains `provideEventEmitter()` and `{ provide: ApprovalPolicyService, useValue: mockApprovalPolicyService() }`.

- [ ] `backend/src/recipes/recipes.service.ts` `createNewVersion` (line ~320) — unchanged behaviourally, but the archive of the current version now also emits `recipe.archived`, and the draft clone carries no approval rows (they are keyed by recipe id, so nothing to clear).
- [ ] `backend/src/recipes/recipes.controller.ts` — add `POST /recipes/:id/submit` as the explicit `draft → pending` action (it is what the frontend status banner should call; `PATCH` with `{status:'pending'}` keeps working). `@RequiresPermission(Permission.MANAGE_OPS)`.
- [ ] `backend/src/recipes/recipes.service.ts` — add `async findApprovalState(id)` returning the recipe's approval rows with `required_role_code`, `status`, `approver`, so the recipe page can show the gate. Wire it as `GET /recipes/:id/approvals`.
- [ ] `backend/src/recipes/recipes.service.spec.ts` — add:
  - `pending → approved` throws `BadRequestException` with the "approvals queue" message.
  - `draft → pending` calls `materialise` with `{ entity_type: 'recipe', scope: 'recipe', domain: 'food' }`.
  - `pending → draft` deletes pending approval rows.
  - `approved → archived` emits `recipe.archived` after the transaction.
  - `draft → approved` still throws the generic transition error (it was never legal).
  - editing a non-status field on an approved recipe still throws (regression).
  - `findApprovalState` returns the rows ordered by `required_role_code`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent src/recipes` — expect 2 suites passed.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 60 passed, 60 total`.
- [ ] `git add backend/src/recipes && git commit -m "feat(p3-10): recipe approval runs through the food policy, direct flip removed" -- backend/src/recipes`

---

### Task 11: Decision tiers and votes (GOV-04)

Tier 1 auto-approves for the domain lead, tier 2 runs the 2+1 vote, tier 3 is the founder's, and any reject ends it.

**Files:**
- Modify: `backend/src/decisions/decisions.service.ts`, `decisions.controller.ts`, `dto/create-decision.dto.ts`, `dto/update-decision.dto.ts`, `backend/src/decisions/__tests__/decisions.service.spec.ts`
- Create: `backend/src/decisions/dto/cast-vote.dto.ts`, `dto/resolve-decision.dto.ts`

- [ ] `backend/src/decisions/dto/create-decision.dto.ts` — add `@IsEnum(GovernanceTier) tier`, `@IsString() impact_scope` (today hardcoded `'ops'` in the service), and `@IsOptional() @IsArray() @IsString({ each: true }) required_role_codes?: string[]`.
- [ ] Create `backend/src/decisions/dto/cast-vote.dto.ts` — `{ @IsEnum(VoteValue) vote; @IsOptional() @IsString() @MaxLength(2000) notes?: string }`.
- [ ] Create `backend/src/decisions/dto/resolve-decision.dto.ts` — `{ @IsEnum(DecisionStatus) status; @IsString() @MinLength(3) final_decision }` restricted to `approved | rejected` in the service.
- [ ] `backend/src/decisions/decisions.service.ts` `create` — implement the tier rules (SPEC §4.4):

```ts
  async create(dto: CreateDecisionDto, proposer: { id: string; roleCode: string }) {
    const domain = parseEnum(TaskDomain, dto.impact_scope) ?? TaskDomain.ops;
    const roles = this.resolveRequiredRoles(dto, domain, proposer.roleCode);

    // Tier 1: the domain lead decides. Auto-approved on creation by that lead.
    const isDomainLead = proposer.roleCode === DOMAIN_LEAD_ROLE[domain];
    const autoApprove = dto.tier === GovernanceTier.tier_1 && isDomainLead;

    const decision = await this.prisma.$transaction(async (tx: Tx) => {
      const created = await tx.decision.create({
        data: {
          title: dto.title, decision_type: dto.decision_type, context: dto.context,
          proposed_by: proposer.id, impact_scope: dto.impact_scope,
          tier: dto.tier, required_role_codes: roles,
          status: autoApprove ? DecisionStatus.approved : DecisionStatus.proposed,
          resolved_by: autoApprove ? proposer.id : null,
          resolved_at: autoApprove ? new Date() : null,
          linked_mission_id: dto.linked_mission_id ?? null,
          linked_task_id: dto.linked_task_id ?? null,
        },
        include: DECISION_INCLUDE,
      });
      await this.auditService.record(tx, {
        entity_type: 'decision', entity_id: created.id,
        action: autoApprove ? 'decision.resolved' : 'decision.created',
        ...AuditService.user(proposer.id),
        after: { status: created.status, tier: created.tier, required_role_codes: roles },
      });
      return created;
    }, SERIALIZABLE_TX_OPTIONS);

    if (autoApprove) this.emitResolved(decision);
    return decision;
  }
```

  `resolveRequiredRoles`: tier 1 → `[DOMAIN_LEAD_ROLE[domain]]`; tier 2 → `dto.required_role_codes` if it has **at least 3** entries, else `BadRequestException('A tier 2 decision needs two domain roles plus one impacted role')`; tier 3 → `[RoleCode.FOUNDER_ADMIN]`. A tier-1 decision proposed by someone who is *not* the domain lead stays `proposed` and needs that lead's vote.

- [ ] Same file — `castVote` with the tally in the same transaction (decision 11):

```ts
  async castVote(decisionId: string, voter: { id: string; roleCode: string }, dto: CastVoteDto) {
    const outcome = await withSerializableRetry(() =>
      this.prisma.$transaction(async (tx: Tx) => {
        const decision = await tx.decision.findUnique({ where: { id: decisionId } });
        if (!decision) throw new NotFoundException(`Decision ${decisionId} not found`);
        if (![DecisionStatus.proposed, DecisionStatus.reopened].includes(decision.status)) {
          throw new BadRequestException(`Decision is ${decision.status} and no longer accepts votes`);
        }
        const isFounder = voter.roleCode === RoleCode.FOUNDER_ADMIN;
        if (!isFounder && !decision.required_role_codes.includes(voter.roleCode)) {
          throw new ForbiddenException('Your role is not on this decision');
        }

        await tx.decisionVote.upsert({
          where: { decision_id_user_id: { decision_id: decisionId, user_id: voter.id } },
          create: { decision_id: decisionId, user_id: voter.id, role_code: voter.roleCode, vote: dto.vote, notes: dto.notes ?? null },
          update: { vote: dto.vote, notes: dto.notes ?? null, role_code: voter.roleCode },
        });

        const votes = await tx.decisionVote.findMany({ where: { decision_id: decisionId } });
        const next = tallyDecision(decision.required_role_codes, votes);
        if (next.status === decision.status) return { decision, votes, changed: false };

        if (next.aligned) {
          await this.auditService.record(tx, {
            entity_type: 'decision', entity_id: decisionId, action: 'decision.aligned',
            ...AuditService.user(voter.id), after: { status: DecisionStatus.aligned },
          });
        }
        const updated = await tx.decision.update({
          where: { id: decisionId },
          data: { status: next.status, resolved_by: voter.id, resolved_at: new Date() },
          include: DECISION_INCLUDE,
        });
        await this.auditService.record(tx, {
          entity_type: 'decision', entity_id: decisionId, action: 'decision.resolved',
          ...AuditService.user(voter.id),
          before: { status: decision.status }, after: { status: next.status },
        });
        return { decision: updated, votes, changed: true };
      }, SERIALIZABLE_TX_OPTIONS),
    );

    if (outcome.changed) this.emitResolved(outcome.decision);
    return { decision: outcome.decision, votes: outcome.votes };
  }
```

- [ ] Same file — `tallyDecision` as an exported pure function so it is unit-testable on its own:

```ts
/**
 * SPEC §4.4 — any reject ends the decision; all required roles voting `approve`
 * aligns it and then approves it (decision 11); anything else keeps it open.
 * `abstain` is not `approve`.
 */
export function tallyDecision(
  requiredRoleCodes: string[],
  votes: { role_code: string; vote: VoteValue }[],
): { status: DecisionStatus; aligned: boolean } {
  if (votes.some((v) => v.vote === VoteValue.reject)) {
    return { status: DecisionStatus.rejected, aligned: false };
  }
  const approvedRoles = new Set(votes.filter((v) => v.vote === VoteValue.approve).map((v) => v.role_code));
  const allApproved = requiredRoleCodes.length > 0 && requiredRoleCodes.every((r) => approvedRoles.has(r));
  return allApproved
    ? { status: DecisionStatus.approved, aligned: true }
    : { status: DecisionStatus.proposed, aligned: false };
}
```

- [ ] Same file — `resolve` (tier 3 / founder) and `reopen`:

```ts
  async resolve(id, founder, dto: ResolveDecisionDto)   // founder-only; sets status, final_decision, resolved_by/at,
                                                        // audits `decision.resolved`, emits after commit
  async reopen(id, founder)                             // founder-only; status -> reopened, clears resolved_by/at,
                                                        // deletes existing votes so the tally restarts, audits
                                                        // `decision.reopened`
```

- [ ] Same file — `update` keeps its existing lock ("approved decisions are locked, only admin can reopen") but **removes** the `dto.status` passthrough: status now moves only through `castVote`, `resolve` and `reopen`. `UpdateDecisionDto` drops `status`.
- [ ] `backend/src/decisions/decisions.service.ts` — `findOne`/`findAll` include `votes: { include: { user: { select: { id: true, name: true } } } }` so the UI can render the tally without a second call.
- [ ] `backend/src/decisions/decisions.controller.ts` — add and annotate:

```ts
@Get()                @RequiresPermission(Permission.VIEW_ROLE_SCOPED)   // was undecorated — closes the gap
@Post(':id/votes')    @RequiresPermission(Permission.APPROVE_DECISION) castVote(...)
@Get(':id/votes')     @RequiresPermission(Permission.VIEW_ROLE_SCOPED)  listVotes(...)
@Post(':id/resolve')  @RequiresPermission(Permission.APPROVE_DECISION) resolve(...)   // + founder check in the handler
@Post(':id/reopen')   @RequiresPermission(Permission.APPROVE_DECISION) reopen(...)    // + founder check in the handler
```

- [ ] `backend/src/decisions/__tests__/decisions.service.spec.ts` — add:
  - `tallyDecision`: any reject → `rejected`; all three required roles approve → `approved` with `aligned: true`; two of three approve → `proposed`; an abstain from the third → `proposed`; an empty `requiredRoleCodes` → `proposed` (never auto-approve on silence).
  - `create` tier 1 by the domain lead → `approved` with `resolved_by`; tier 1 by someone else → `proposed` with `required_role_codes: [domainLead]`.
  - `create` tier 2 with fewer than three roles throws `BadRequestException`.
  - `create` tier 3 forces `required_role_codes: ['FOUNDER_ADMIN']`.
  - `castVote` upserts on `(decision_id, user_id)` and stores `role_code`.
  - `castVote` by a role not on the decision throws `ForbiddenException`; the founder is exempt.
  - `castVote` on an `approved` decision throws `BadRequestException`.
  - the aligning vote writes both `decision.aligned` and `decision.resolved` audit rows and leaves the row `approved`.
  - `castVote` emits `decision.resolved` only when the status changed.
  - `reopen` deletes the votes and clears `resolved_by`/`resolved_at`.
  - `update` with a `status` field no longer moves the status (the field is gone from the DTO — assert the update payload).
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent src/decisions` — expect 1 suite passed.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 60 passed, 60 total`.
- [ ] `git add backend/src/decisions && git commit -m "feat(p3-11): decision tiers, DecisionVote tally, resolve and reopen" -- backend/src/decisions`

---

### Task 12: Bridge signals, derived recompute and the improvement-task spawn (BRIDGE-02 signal, BRIDGE-04)

The second half of the bridge: every rule with a `signal` writes a `ReadinessSignal` and triggers a recompute of that meter plus its hybrids; `feedback.received` with `rating <= 2` spawns exactly one improvement task per order.

**Files:**
- Modify: `backend/src/mission-bridge/mission-bridge.service.ts`, `mission-bridge.module.ts`, `mission-bridge.service.spec.ts`
- Create: `backend/src/mission-bridge/mission-bridge.rules.spec.ts`

- [ ] `backend/src/mission-bridge/mission-bridge.service.ts` — inject `ReadinessDerivationService` (exported by `ReadinessModule`, already imported by `MissionBridgeModule` in Task 4) and extend `apply` so each rule writes its signal inside the dispatch transaction and queues the recompute for **after** it commits:

```ts
      const pendingRecomputes = new Set<string>();

      await this.dispatchOnce(rule.key, rule.event, subject, nodeId, async (tx) => {
        const taskId = await this.resolveTaskId(tx, subject);
        let evidenceId: string | null = null;
        let spawnedTaskId: string | null = null;

        if (rule.evidence) {
          if (!taskId) {
            // Still record the signal — a readiness contribution does not need a task.
            if (rule.signal) await this.writeSignal(tx, nodeId, rule, subject);
            if (rule.signal) pendingRecomputes.add(rule.signal.meter);
            return { outcome: BridgeOutcome.skipped_no_task, detail: 'no open task for subject' };
          }
          evidenceId = await this.createBridgeEvidence(tx, taskId, rule, subject, picked.values);
        }

        if (rule.signal) {
          await this.writeSignal(tx, nodeId, rule, subject);
          pendingRecomputes.add(rule.signal.meter);
        }

        if (rule.spawn === 'low_rating_improvement') {
          const spawn = await this.spawnLowRatingTask(tx, nodeId, payload as DomainEventPayloads['feedback.received']);
          if (spawn.outcome !== BridgeOutcome.applied) return spawn;
          spawnedTaskId = spawn.task_id ?? null;
        }

        return { outcome: BridgeOutcome.applied, task_id: spawnedTaskId ?? taskId, evidence_id: evidenceId };
      });

      // After commit, never inside: a recompute reads a lot and must not extend
      // the dispatch transaction. Failures are logged, never propagated.
      for (const meter of pendingRecomputes) {
        try {
          await this.derivation.recomputeWithHybrids(meter);
        } catch (err) {
          this.logger.warn(`recompute of ${meter} after ${rule.key} failed: ${String(err)}`);
        }
      }
```

- [ ] Same file — the signal writer:

```ts
  private async writeSignal(tx: Tx, nodeId: string, rule: BridgeRule, subject: BridgeSubject) {
    const meter = await tx.readinessMeter.findUnique({
      where: { node_id_code: { node_id: nodeId, code: rule.signal!.meter } },
      select: { id: true },
    });
    if (!meter) return;   // a mis-seeded meter must not break the bridge
    await tx.readinessSignal.create({
      data: {
        node_id: nodeId,
        meter_id: meter.id,
        source_event: rule.event,
        source_type: subject.subject_type,
        source_id: subject.subject_id,
        value: new Prisma.Decimal(rule.signal!.value),
      },
    });
  }
```

- [ ] Same file — the spawn (BRIDGE-04). SPEC §4.2's example, made concrete: `Task.mission_id` is **required**, so the spawn needs an active mission and a `FRONTEND_LEAD` to own it; when either is missing the dispatch is recorded as skipped rather than throwing:

```ts
  /**
   * SPEC §4.2 — `feedback.received` with rating <= 2 creates one improvement task
   * per order. `BridgeDispatch @@unique([rule_key, source_type, source_id])` with
   * `source_id = orderId` is what makes it "once per order".
   */
  private async spawnLowRatingTask(
    tx: Tx,
    nodeId: string,
    payload: DomainEventPayloads['feedback.received'],
  ) {
    if (payload.rating > 2) {
      return { outcome: BridgeOutcome.applied, detail: 'rating above threshold, no task spawned' };
    }
    const mission = await tx.mission.findFirst({
      where: { node_id: nodeId, status: MissionStatus.active },
      orderBy: { start_date: 'desc' },
      select: { id: true },
    });
    if (!mission) return { outcome: BridgeOutcome.skipped_no_mission, detail: 'no active mission' };

    const owner = await tx.user.findFirst({
      where: { status: 'active', role: { code: RoleCode.FRONTEND_LEAD } },
      select: { id: true },
    });
    if (!owner) return { outcome: BridgeOutcome.skipped_no_owner, detail: 'no active FRONTEND_LEAD' };

    const task = await tx.task.create({
      data: {
        node_id: nodeId,
        mission_id: mission.id,
        title: `Follow up on ${payload.rating}-star feedback`,
        description:
          `A guest rated order ${payload.orderId ?? '(unknown)'} ${payload.rating}/5.` +
          (payload.comment ? ` They said: "${payload.comment}"` : '') +
          ' Find the cause, fix it, and attach the evidence.',
        task_type: TaskType.improvement,
        domain: TaskDomain.food,
        owner_user_id: owner.id,
        created_by: SYSTEM_USER_ID,
        priority: payload.rating <= 1 ? TaskPriority.high : TaskPriority.medium,
        subject_type: TaskSubjectType.order,
        subject_id: payload.orderId ?? payload.feedbackId,
        requires_approval: true,
      },
      select: { id: true, domain: true },
    });

    // The spawned task is approval-gated like any other (SPEC §4.4).
    await this.approvalPolicy.materialise(
      tx,
      { entity_type: ApprovalEntityType.task, entity_id: task.id, scope: ApprovalScope.task, domain: task.domain },
      nodeId,
    );
    await this.auditService.record(tx, {
      entity_type: 'task', entity_id: task.id, action: 'task.spawned_by_bridge',
      actor_type: ActorType.system, actor_id: null,
      after: { rule: 'low_rating_improvement', rating: payload.rating, order_id: payload.orderId },
    });
    return { outcome: BridgeOutcome.applied, task_id: task.id };
  }
```

  `MissionBridgeService` gains `ApprovalPolicyService` (global) and `AuditService` (global) in its constructor.

- [ ] `backend/src/mission-bridge/mission-bridge.listener.ts` — no change: `apply` already covers signal and spawn.
- [ ] Create `backend/src/mission-bridge/mission-bridge.rules.spec.ts` — table-level invariants that would otherwise only fail at runtime:
  - every `key` is unique across `BRIDGE_RULES`.
  - every `event` is a member of `DomainEvent`.
  - every rule with `evidence: true` has a non-empty `note_template`.
  - every `signal.meter` is one of the four derived meter codes.
  - every rule's `select` returns a `subject_id` for a representative payload (one fixture per rule; a `null` or `undefined` `subject_id` fails the test).
  - `RULES_BY_EVENT` groups every rule and its size equals the number of distinct events.
  - exactly five rules carry `emitter: 'P5'` and every one of them names an event with no emitter in `backend/src` (assert by name list, so adding a P5 emitter forces this test to be updated).
- [ ] `backend/src/mission-bridge/mission-bridge.service.spec.ts` — add:
  - a rule with a signal writes `ReadinessSignal` with `{ meter_id, source_event, source_type, source_id, value }`.
  - a signal for an unseeded meter code writes nothing and does not throw.
  - `recomputeWithHybrids` is called once per distinct meter **after** the transaction resolves.
  - a throwing `recomputeWithHybrids` is swallowed.
  - `feedback.received` with `rating: 5` records `applied` and creates no task.
  - `feedback.received` with `rating: 2` creates a `Task{ task_type: 'improvement', domain: 'food', subject_type: 'order' }` owned by the active `FRONTEND_LEAD` and materialises its approvals.
  - `rating: 1` sets `priority: 'high'`.
  - no active mission → `outcome: 'skipped_no_mission'`, no task created.
  - no active `FRONTEND_LEAD` → `outcome: 'skipped_no_owner'`.
  - a second `feedback.received` for the same `orderId` is a no-op (the P2002 path).
  - evidence-less rules (`stock.low`, `order.served`) write a signal and no evidence.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent src/mission-bridge` — expect 3 suites passed.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 63 passed, 63 total` (60 baseline + Task 4's 2 + this task's 1).
- [ ] `git add backend/src/mission-bridge && git commit -m "feat(p3-12): bridge readiness signals, derived recompute, low-rating task spawn" -- backend/src/mission-bridge`

---

### Task 13: Daily `ReadinessSnapshot` + the nightly job under an advisory lock (READY-03)

**Files:**
- Create: `backend/src/common/utils/advisory-lock.ts`, `advisory-lock.spec.ts`
- Create: `backend/src/readiness/readiness.cron.ts`, `readiness.cron.spec.ts`
- Modify: `backend/src/readiness/readiness-derivation.service.ts`, `readiness.module.ts`, `readiness-derivation.service.spec.ts`

- [ ] Create `backend/src/common/utils/advisory-lock.ts` — SPEC §8 "crons wrapped in `pg_try_advisory_lock`". No existing job takes a lock; this is the first, and Phase 35's `RUN-06` reuses it:

```ts
import { Prisma } from '@prisma/client';

/**
 * Runs `fn` only if this process wins the Postgres advisory lock for `key`,
 * so N API instances run a nightly job once between them. Returns `null` when
 * the lock was already held. The lock is session-scoped and always released.
 */
export async function withAdvisoryLock<T>(
  prisma: { $queryRaw: (q: Prisma.Sql) => Promise<unknown>; $executeRaw: (q: Prisma.Sql) => Promise<number> },
  key: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const rows = (await prisma.$queryRaw(
    Prisma.sql`SELECT pg_try_advisory_lock(${key}::bigint) AS locked`,
  )) as { locked: boolean }[];
  if (!rows?.[0]?.locked) return null;
  try {
    return await fn();
  } finally {
    await prisma.$executeRaw(Prisma.sql`SELECT pg_advisory_unlock(${key}::bigint)`);
  }
}

/** Stable lock ids — never reuse a number for a different job. */
export const ADVISORY_LOCK = {
  READINESS_SNAPSHOT: 3_100_001,
} as const;
```

- [ ] Create `backend/src/common/utils/advisory-lock.spec.ts` — `fn` runs and the unlock fires when `locked: true`; `fn` never runs and `null` is returned when `locked: false`; the unlock still fires when `fn` throws (and the error propagates); an empty result row is treated as not-locked.
- [ ] `backend/src/readiness/readiness-derivation.service.ts` — add the snapshot writer:

```ts
  /**
   * SPEC §4.3 — one `ReadinessSnapshot` row per meter per node-local day.
   * Idempotent: re-running on the same day overwrites the value rather than
   * failing on `@@unique([meter_id, date])`.
   */
  async snapshotAll(): Promise<number> {
    const nodeId = await this.node.currentId();
    const timezone = await this.node.timezone();
    const day = nodeDayKey(new Date(), timezone);          // 'YYYY-MM-DD', from common/utils/node-time
    const date = new Date(`${day}T00:00:00.000Z`);

    const meters = await this.prisma.readinessMeter.findMany({
      where: { node_id: nodeId },
      select: { id: true, current_value: true },
    });
    for (const meter of meters) {
      await this.prisma.readinessSnapshot.upsert({
        where: { meter_id_date: { meter_id: meter.id, date } },
        create: { node_id: nodeId, meter_id: meter.id, date, value: meter.current_value },
        update: { value: meter.current_value },
      });
    }
    return meters.length;
  }
```

- [ ] Create `backend/src/readiness/readiness.cron.ts`:

```ts
@Injectable()
export class ReadinessCron {
  private readonly logger = new Logger(ReadinessCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly derivation: ReadinessDerivationService,
  ) {}

  /**
   * SPEC §4.3 — "recompute on relevant events and nightly; write ReadinessSnapshot
   * daily". 00:20 node-local, after the day has rolled over. The timezone is pinned
   * to the seeded default for the same reason `notifications.cleanup.cron.ts` pins
   * it: a decorator cannot await NodeService.
   */
  @Cron('20 0 * * *', { timeZone: DEFAULT_NODE_TIMEZONE })
  async nightlyRecomputeAndSnapshot(): Promise<void> {
    try {
      const ran = await withAdvisoryLock(this.prisma, ADVISORY_LOCK.READINESS_SNAPSHOT, async () => {
        const meters = await this.derivation.recomputeAll();
        const snapshots = await this.derivation.snapshotAll();
        return { meters: meters.length, snapshots };
      });
      if (ran === null) {
        this.logger.log('nightly readiness job skipped — lock held by another instance');
        return;
      }
      this.logger.log(`nightly readiness: recomputed ${ran.meters} meters, wrote ${ran.snapshots} snapshots`);
    } catch (err) {
      this.logger.error(`nightly readiness job failed: ${String(err)}`);
    }
  }
}
```

- [ ] `backend/src/readiness/readiness.module.ts` — add `ReadinessCron` to `providers`.
- [ ] Create `backend/src/readiness/readiness.cron.spec.ts` — the job calls `recomputeAll` then `snapshotAll` when the lock is won; it does neither and logs when the lock is held; a throwing `recomputeAll` is caught and does not reject; assert the `@Cron` metadata (`Reflect.getMetadata(SCHEDULE_CRON_OPTIONS, …)`) carries `'20 0 * * *'` and the node timezone.
- [ ] `backend/src/readiness/readiness-derivation.service.spec.ts` — add: `snapshotAll` upserts one row per meter keyed on `{ meter_id, date }`; the date is the node-local day at UTC midnight; re-running the same day updates rather than creates; it returns the meter count.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent src/readiness src/common/utils/advisory-lock.spec.ts` — expect 6 suites passed.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 62 passed, 62 total` (60 baseline + this task's 2).
- [ ] `git add backend/src/readiness backend/src/common/utils && git commit -m "feat(p3-13): nightly readiness recompute and daily snapshots under an advisory lock" -- backend/src/readiness backend/src/common/utils`

---

### Task 14: Seeds — the system actor, and hardening `UsersService` against it

**Files:**
- Create: `backend/prisma/seed-data/system-actor.ts`
- Modify: `backend/prisma/seed-reference.ts`, `backend/src/users/users.service.ts`, `backend/src/users/users.service.spec.ts`, `backend/src/prisma/seed-data.spec.ts`

- [ ] Create `backend/prisma/seed-data/system-actor.ts` — mirrors `src/common/constants/system-actor.ts` for the same reason `seed-data/settings.ts` mirrors `SETTING_DEFAULTS` (a `ts-node` seed cannot import a Nest `@Injectable`, and these are plain consts but the mirror keeps the seed self-contained and lets `seed-data.spec.ts` assert parity):

```ts
import {
  SYSTEM_USER_ID, SYSTEM_ROLE_CODE, SYSTEM_USER_EMAIL, SYSTEM_USER_NAME,
  SYSTEM_USER_STATUS, SYSTEM_USER_PASSWORD_HASH,
} from '../../src/common/constants/system-actor';

/**
 * SPEC §4.2 — the MissionBridge uploads evidence as a real User because
 * `Evidence.uploaded_by` is a required FK. This role holds NO permissions and
 * the account can never log in (`password_hash` is not a bcrypt digest).
 * Deliberately NOT part of ROLE_SEEDS: that list drives demo-user creation
 * with real passwords in seed-demo.ts.
 */
export const SYSTEM_ACTOR = {
  role: {
    code: SYSTEM_ROLE_CODE,
    name: 'System',
    description: 'Automation identity for the mission bridge. Holds no permissions and cannot log in.',
    permissions: [] as string[],
  },
  user: {
    id: SYSTEM_USER_ID,
    name: SYSTEM_USER_NAME,
    email: SYSTEM_USER_EMAIL,
    function: 'automation',
    status: SYSTEM_USER_STATUS,
    password_hash: SYSTEM_USER_PASSWORD_HASH,
  },
} as const;
```

- [ ] `backend/prisma/seed-reference.ts` — after the `ROLE_SEEDS` loop (line ~57-68), upsert the system role and user. Idempotent and prod-safe (no password is generated, nothing is deleted):

```ts
      // SPEC §4.2 — the bridge's identity. Upserted, never reset.
      const systemRole = await tx.role.upsert({
        where: { code: SYSTEM_ACTOR.role.code },
        update: {
          name: SYSTEM_ACTOR.role.name,
          description: SYSTEM_ACTOR.role.description,
          permissions: SYSTEM_ACTOR.role.permissions,
        },
        create: { code: SYSTEM_ACTOR.role.code, ...SYSTEM_ACTOR.role },
      });
      await tx.user.upsert({
        where: { id: SYSTEM_ACTOR.user.id },
        update: {
          name: SYSTEM_ACTOR.user.name,
          status: SYSTEM_ACTOR.user.status,
          role_id: systemRole.id,
        },
        create: { ...SYSTEM_ACTOR.user, role_id: systemRole.id },
      });
```

- [ ] `backend/prisma/seed-reference.ts` — extend the closing `console.log` line with `, 1 system actor` so the summary stays honest.
- [ ] `backend/src/users/users.service.ts` — hide and protect the system account (decision 3):
  - `findAll()` gains `where: { status: { not: SYSTEM_USER_STATUS } }`.
  - `update(id, …)` and `remove(id)` throw `ForbiddenException('The system account cannot be modified')` when `id === SYSTEM_USER_ID`.
  - any role-assignment path refuses `SYSTEM_ROLE_CODE` for a human user with `BadRequestException('SYSTEM is not an assignable role')`.
- [ ] `backend/src/users/users.service.spec.ts` — add: `findAll` excludes `status: 'system'`; `update`/`remove` on `SYSTEM_USER_ID` throw `ForbiddenException`; assigning the `SYSTEM` role throws `BadRequestException`.
- [ ] `backend/src/prisma/seed-data.spec.ts` — add a case asserting `SYSTEM_ACTOR.user.id === SYSTEM_USER_ID` and `SYSTEM_ACTOR.role.permissions.length === 0` (a permission creeping onto the bridge account is exactly the failure this catches), and that the `readiness` mirror in `seed-data/settings.ts` still deep-equals `SETTING_DEFAULTS.readiness`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.json` — expect no output (this config covers `prisma/`; `tsconfig.build.json` excludes it).
- [ ] `cd backend && npx jest --silent src/users src/prisma` — expect 2 suites passed.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 60 passed, 60 total`.
- [ ] `git add backend/prisma backend/src/users && git commit -m "feat(p3-14): seed the SYSTEM role and bridge user; protect it in UsersService" -- backend/prisma backend/src/users`

---

### Task 15: `/readiness` shows derived values, the blend, and 90 days of history (SPEC §6.5 sparkline)

The minimum frontend that makes derived readiness *visible*. No IA, header or navigation work — that is Phase 32. `frontend/app/page.tsx` is not touched.

**Files:**
- Modify: `frontend/lib/types/readiness.ts`
- Create: `frontend/components/ops/readiness/MeterHistoryChart.tsx`, `MeterModeBadge.tsx`, `MeterBreakdown.tsx`
- Modify: `frontend/components/ops/readiness/MeterDetailPanel.tsx`, `ReadinessMeterRing.tsx`, `ReadinessGrid.tsx`, `frontend/app/(ops)/readiness/page.tsx`

- [ ] `frontend/lib/types/readiness.ts` — extend the existing `ReadinessMeter` (it has no timestamp today, so the UI currently cannot say when a value last moved) and add the two new response shapes:

```ts
export type MeterMode = 'task_driven' | 'derived' | 'hybrid';

export interface ReadinessMeter {
  id: string;
  code: string;
  name: string;
  description: string;
  current_value: number;
  target_value: number;
  weight: number;
  mode: MeterMode;
  formula_key: string | null;
  task_value: number;
  derived_value: number | null;
  last_computed_at: string | null;
}

/** GET /readiness-meters/:code/history?days=90 */
export interface MeterHistoryPoint {
  date: string;   // 'YYYY-MM-DD'
  value: number;
}

/** GET /readiness-meters/:code/signals?limit=20 */
export interface MeterSignal {
  id: string;
  source_event: string;
  source_type: string;
  source_id: string;
  value: string;   // Decimal serialises as a string
  created_at: string;
}
```

  Keep `MeterTaskEvent` exactly as it is.

- [ ] Create `frontend/components/ops/readiness/MeterModeBadge.tsx` — a `<Badge>` reading `Task-driven` / `Derived` / `Hybrid` with a `title` explaining the rule ("Derived from operations state", "Half task-driven, half derived"). Uses only design tokens (no arbitrary colour values — SPEC §7 and the Phase 32 lint rule).
- [ ] Create `frontend/components/ops/readiness/MeterBreakdown.tsx` — for a `hybrid` meter, two labelled bars (`Task {task_value}` / `Derived {derived_value}`) and the resulting `current_value`; for a `derived` meter, the derived value and `Updated {relative time from last_computed_at}`; for `task_driven`, nothing (returns `null`). This is the component that makes decision 10 legible to a human.
- [ ] Create `frontend/components/ops/readiness/MeterHistoryChart.tsx` — follow the established recharts pattern in `frontend/components/ops/analytics/RevenueTrendChart.tsx` verbatim (`ResponsiveContainer` > `LineChart` with `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, one `Line`), wrapped in a `<Card>`:

```tsx
export function MeterHistoryChart({ code, days = 90 }: { code: string; days?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['readiness-history', code, days],
    queryFn: () => apiClient.get<MeterHistoryPoint[]>(`/readiness-meters/${code}/history?days=${days}`),
  });
  // Skeleton while loading; an explicit empty state ("No history yet — the first
  // snapshot is written tonight") when data.length < 2, matching the loading/
  // empty/error rule in SPEC §6.4.
}
```

  `YAxis` domain is fixed `[0, 100]` so a flat meter does not look volatile. A day-range toggle (30 / 90) sits in the card header and only changes the query key.

- [ ] `frontend/components/ops/readiness/MeterDetailPanel.tsx` — restructure into three stacked blocks:
  1. `<MeterBreakdown meter={meter} />`
  2. `<MeterHistoryChart code={meter.code} />`
  3. the contribution list — for `task_driven`/`hybrid` meters keep the existing `GET /readiness-meters/{id}/tasks` `AnimatedList`; for `derived` meters fetch `GET /readiness-meters/{code}/signals?limit=20` instead and render `source_event`, `source_type:source_id` and the relative time. A `hybrid` meter shows both lists under a two-tab switch.
- [ ] `frontend/components/ops/readiness/ReadinessMeterRing.tsx` — render `<MeterModeBadge mode={meter.mode} />` under the ring in the full (non-`mini`) variant only; the `mini` variant used by `DashboardReadinessStrip` is untouched so the dashboard layout does not shift.
- [ ] `frontend/components/ops/readiness/ReadinessGrid.tsx` — group the grid into "Derived from operations" and "Task-driven" sections (mode-based), preserving the existing ring layout and click-to-select behaviour inside each. `frontend/app/(ops)/readiness/page.tsx` gains a "Recompute now" button visible only when the session role is `FOUNDER_ADMIN` or `TECH_LEAD`, posting `POST /readiness-meters/recompute` and invalidating `['readiness-meters']`.
- [ ] `cd frontend && npx tsc --noEmit` — expect no output.
- [ ] `cd frontend && npm run lint` — expect no new errors.
- [ ] `cd frontend && npm run build` — expect a clean build with the `/readiness` route present in the route table.
- [ ] Visual check (record in the phase summary): `/readiness` renders both sections; a derived meter's detail panel shows the history chart with a real line after Task 17's seed + recompute; a hybrid meter shows the two-bar breakdown; light and dark both legible.
- [ ] `git add frontend/lib/types/readiness.ts frontend/components/ops/readiness frontend/app/\(ops\)/readiness && git commit -m "feat(p3-15): readiness UI shows derived values, hybrid blend and 90-day history"`

---

### Task 16: `/approvals` shows policy rows, `/decisions` gets votes, bridge evidence is marked

**Files:**
- Create: `frontend/lib/types/approvals.ts`, `frontend/components/ops/approvals/ApprovalEntityChip.tsx`, `frontend/components/ops/decisions/DecisionVotePanel.tsx`
- Modify: `frontend/lib/types/decisions.ts`, `evidence.ts`, `analytics.ts`, `frontend/app/(ops)/approvals/page.tsx`, `frontend/components/ops/approvals/{ApprovalQueue,ApprovalItem,OverrideDialog}.tsx`, `frontend/app/(ops)/decisions/page.tsx`, `frontend/components/ops/decisions/{DecisionDetail,DecisionList}.tsx`, `frontend/components/ops/boards/EvidenceFeedCard.tsx`, `frontend/components/ops/evidence/EvidenceItem.tsx`, `frontend/components/ops/Sidebar.tsx`

- [ ] Create `frontend/lib/types/approvals.ts` — the type the frontend has never had (the approvals surface is typed as `Evidence` today):

```ts
export type ApprovalEntityType = 'task' | 'evidence' | 'decision' | 'recipe';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalScope =
  | 'task' | 'decision' | 'recipe' | 'pricing' | 'vendor'
  | 'experience' | 'tech' | 'hiring' | 'review';

export interface ApprovalSubject {
  id: string;
  title: string;
  /** App-relative deep link to the thing being approved. */
  url: string;
  owner?: { id: string; name: string } | null;
}

export interface Approval {
  id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  approval_scope: ApprovalScope;
  required_role_code: string;
  status: ApprovalStatus;
  notes: string | null;
  approved_by: string | null;
  approver?: { id: string; name: string } | null;
  override_by: string | null;
  override_reason: string | null;
  override_at: string | null;
  delegated_from_user_id: string | null;
  policy_id: string | null;
  policy?: { id: string; mode: 'all' | 'n_of'; min_approvals: number } | null;
  subject: ApprovalSubject | null;
  created_at: string;
  updated_at: string;
}
```

  Import it directly (`@/lib/types/approvals`) — `frontend/lib/types/index.ts` does not re-export `readiness` or `decisions` either, so the barrel stays as it is.

- [ ] Create `frontend/components/ops/approvals/ApprovalEntityChip.tsx` — a small badge + icon per `entity_type` (Task / Evidence / Recipe / Decision) linking to `approval.subject.url`.
- [ ] `frontend/app/(ops)/approvals/page.tsx` — switch the fetch from `GET /evidence?status=pending` to `GET /approvals?mine=1&status=pending` typed `Approval[]`, and add four filter tabs (`All`, `Tasks`, `Recipes`, `Decisions`, `Evidence`) that append `&entity_type=`. The pending-count badge reads the same query rather than issuing its own.
- [ ] `frontend/components/ops/approvals/ApprovalQueue.tsx` — replace the `ApprovalEvidence extends Evidence` interface with `Approval[]`; keep the existing empty/loading/error states; group rows by `entity_type` when the `All` tab is active.
- [ ] `frontend/components/ops/approvals/ApprovalItem.tsx` — render `<ApprovalEntityChip>`, the `required_role_code`, the policy mode (`2 of 2` / `1 of 3`) and the subject title. Actions:
  - Approve → `POST /approvals/{id}/approve`
  - Reject → `POST /approvals/{id}/reject` with the existing `RejectionDialog` supplying the now-**required** `notes`
  - Override (admin) → `POST /approvals/{id}/override` — the id is now the **Approval** id, not the evidence id (it always should have been; the old call worked only because evidence approvals shared the id space). Update `OverrideDialog.tsx`'s prop name from `evidenceId` to `approvalId`.
  - The evidence-specific `POST /evidence/{id}/approve|reject` calls stay only on the evidence detail/board surfaces, not in the inbox.
- [ ] `frontend/components/ops/Sidebar.tsx` — the approvals badge switches from `GET /evidence?status=pending` (`Evidence[]`, counted client-side) to `GET /approvals/count` (`{ count: number }`); the decisions badge keeps `GET /decisions?status=proposed`.
- [ ] `frontend/lib/types/decisions.ts` — add the vote types and hang them off `Decision`:

```ts
export type VoteValue = 'approve' | 'reject' | 'abstain';

export interface DecisionVote {
  id: string;
  decision_id: string;
  user_id: string;
  user?: { id: string; name: string };
  role_code: string;
  vote: VoteValue;
  notes: string | null;
  created_at: string;
}
```

  and `votes?: DecisionVote[]` on `Decision`.

- [ ] Create `frontend/components/ops/decisions/DecisionVotePanel.tsx`:
  - a row per `required_role_codes` entry showing the role, the matching vote (or "waiting"), the voter's name and the note;
  - a tally line (`2 of 3 approved`);
  - Approve / Reject / Abstain buttons, enabled only when the session role is in `required_role_codes` (or `FOUNDER_ADMIN`) **and** the decision is `proposed`/`reopened`, posting `POST /decisions/{id}/votes` with `{ vote, notes }` (a note is required for `reject`, matching the approvals rule in SPEC §6.4);
  - founder-only `Resolve` (tier 3) → `POST /decisions/{id}/resolve` with `{ status, final_decision }`, and `Reopen` → `POST /decisions/{id}/reopen` with a confirm that says the existing votes will be cleared.
- [ ] `frontend/components/ops/decisions/DecisionDetail.tsx` — replace the three admin `PATCH /decisions/{id}` buttons with `<DecisionVotePanel>`; keep the context/links block; show the `tier` badge next to the status badge.
- [ ] `frontend/app/(ops)/decisions/page.tsx` — add `aligned` and `reopened` to the status tabs so the two states the type already declares become reachable.
- [ ] `frontend/lib/types/analytics.ts` — add `source: 'manual' | 'bridge'` and `bridge_event: string | null` to `EvidenceFeedEntry` (they are already on the backend response and on the fuller `Evidence` type; the feed type is a stale slimmed copy).
- [ ] `frontend/components/ops/boards/EvidenceFeedCard.tsx` and `frontend/components/ops/evidence/EvidenceItem.tsx` — when `source === 'bridge'`, render a "Bridge" badge with the `bridge_event` as its `title`, and make the card's link target `evidence.url` as an internal `<Link>` (bridge URLs are app-relative — decision 2) instead of an external anchor. Manual evidence keeps its current external-URL behaviour; branch on `url.startsWith('/')`.
- [ ] `cd frontend && npx tsc --noEmit` — expect no output.
- [ ] `cd frontend && npm run lint` — expect no new errors.
- [ ] `cd frontend && npm run build` — expect a clean build.
- [ ] Visual check (record in the phase summary): a task created with `requires_approval` appears in `/approvals` under Tasks with its policy role; approving as the wrong role is refused with the role name; a tier-2 decision shows three role rows and flips to Approved on the third approve; bridge evidence shows the Bridge badge and its link opens the source record.
- [ ] `git add frontend/lib/types frontend/components/ops frontend/app/\(ops\)/approvals frontend/app/\(ops\)/decisions && git commit -m "feat(p3-16): approvals inbox reads policy rows, decision votes UI, bridge evidence badge"`

---

### Task 17: One migration, apply, seed, drift gate, runtime smoke

Main tree only — this task talks to the database and must not run inside a worktree. It is the only task in the phase that writes a migration.

**Files:**
- Create: `backend/prisma/migrations/20260823180000_p3_mission_bridge/migration.sql`
- Modify: `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` (tick the P3 ids), `.planning/phases/31-p3-mission-bridge/31-01-SUMMARY.md` (new)

- [ ] Confirm the tree is at the merge of Tasks 1–16 and green: `cd backend && npx prisma validate && npx tsc --noEmit -p tsconfig.build.json && npx jest --silent` — expect `Test Suites: 69 passed, 69 total`.
- [ ] Generate the migration:

```bash
cd backend && npx prisma migrate dev --create-only --name p3_mission_bridge
```

  Expect a new directory `prisma/migrations/<timestamp>_p3_mission_bridge/migration.sql` and **no** application (that is what `--create-only` means). Rename the directory to `20260823180000_p3_mission_bridge` so the name is deterministic across worktrees.

  **Fallback** if Prisma 6.19's AI-agent guard refuses `migrate dev` (it refused `migrate reset --force` in P2) or the `konma` role cannot create the temporary shadow database:

```bash
cd backend && mkdir -p prisma/migrations/20260823180000_p3_mission_bridge && npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://konma:konma@localhost:5433/konma_shadow \
  --script > prisma/migrations/20260823180000_p3_mission_bridge/migration.sql
```

  (Create the directory **before** running `migrate diff --from-migrations`, and make sure the new directory is empty at that moment, so the diff is taken against the P2 baseline only.)

- [ ] Read the generated SQL and confirm it is exactly the Task 1 delta and nothing else:

```bash
cd backend && cat prisma/migrations/20260823180000_p3_mission_bridge/migration.sql
grep -c "CREATE TYPE" prisma/migrations/20260823180000_p3_mission_bridge/migration.sql   # expect 1  (BridgeOutcome)
grep -c "CREATE TABLE" prisma/migrations/20260823180000_p3_mission_bridge/migration.sql  # expect 1  (BridgeDispatch)
grep -c "DROP " prisma/migrations/20260823180000_p3_mission_bridge/migration.sql          # expect 0  (additive only)
grep -c "ALTER TABLE \"ReadinessMeter\" ADD COLUMN" …                                     # expect 3
grep -c "CREATE INDEX" …                                                                  # expect 5
                                                                                          # (2 on BridgeDispatch + Approval + Evidence + Decision)
grep -c "CREATE UNIQUE INDEX" …                                                           # expect 1  (BridgeDispatch)
```

  A `DROP` of any kind means an unintended schema change slipped into a task — stop and find it rather than editing the SQL.

- [ ] Apply it: `cd backend && npx prisma migrate deploy` — expect `Applying migration \`20260823180000_p3_mission_bridge\`` and `2 migrations found in prisma/migrations`.
- [ ] Drift gate — schema and migrations must agree exactly:

```bash
cd backend && npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://konma:konma@localhost:5433/konma_shadow \
  --exit-code
```

  Expect `No difference detected.` and exit code `0`.

- [ ] Reseed reference data (idempotent, safe on the live local DB — it upserts and deletes nothing):

```bash
cd backend && npm run seed:reference
```

  Expect the `[seed:reference] done —` line to now include `1 system actor`. Run it **twice** and confirm the identical line both times with no unique-constraint error.

- [ ] Verify the seed landed:

```bash
docker exec konma-postgres psql -U konma -d konma -c "SELECT code, name, array_length(permissions,1) FROM \"Role\" WHERE code = 'SYSTEM';"
docker exec konma-postgres psql -U konma -d konma -c "SELECT id, email, status FROM \"User\" WHERE id = '11111111-1111-4111-8111-111111111112';"
docker exec konma-postgres psql -U konma -d konma -c "SELECT code, mode, formula_key, task_value, derived_value FROM \"ReadinessMeter\" ORDER BY code;"
docker exec konma-postgres psql -U konma -d konma -c "SELECT key FROM \"SystemSetting\" WHERE key = 'readiness';"
```

  Expect: one `SYSTEM` role with `array_length = NULL` (empty array); one user `system@konma.local` with `status = system`; 12 meters with 4 `derived`, 2 `hybrid`, 6 `task_driven` and the seeded `formula_key`s; one `readiness` setting row.

- [ ] Build and boot: `cd backend && npm run build && PORT=4031 node dist/src/main.js` — expect `Nest application successfully started`. Keep it running for the smoke below (background it, or use a second shell).
- [ ] **Runtime smoke — SPEC §10 smoke test 1** (`login → create task → upload evidence → approve → meter moves`). Run each step and record the status and the salient response field in the phase summary. Log in as the demo `FOUNDER_ADMIN` (cookies only — `POST /auth/login` returns 201 with httpOnly cookies, never tokens in the body):

| # | Request | Expect |
|---|---|---|
| 1 | `POST /auth/login` | `201`, `Set-Cookie` |
| 2 | `GET /approval-policies` | `200`, 8 rows |
| 3 | `POST /missions` then `POST /tasks` with `{ domain: 'food', requires_approval: true, readiness_meter_id: <BACKEND>, readiness_value: 20 }` | `201`; then `GET /approvals?mine=0` shows **2 pending rows** (`BACKEND_LEAD`, `FRONTEND_LEAD`) for that task |
| 4 | `POST /evidence` on the task, then `POST /evidence/:id/approve` as a different user | `200`/`201`; task is **still** `valid: false` — the policy gate has not been satisfied (decision 4) |
| 5 | `POST /approvals/:id/approve` as `BACKEND_LEAD`, then as `FRONTEND_LEAD` | `200` each; after the second, `GET /tasks/:id` shows `valid: true` |
| 6 | `GET /readiness-meters` | the `BACKEND` meter's `task_value` rose by 20 and `current_value` is the 50/50 blend with its `derived_value` |
| 7 | `POST /approvals/:id/approve` as the task **owner** | `403` "You cannot approve your own work" |

- [ ] **Runtime smoke — the bridge.** With the same server running:

| # | Action | Expect |
|---|---|---|
| 1 | `PATCH /recipes/:id {"status":"pending"}` on a seeded draft recipe | `200`; `GET /approvals?entity_type=recipe` shows 2 pending rows |
| 2 | `PATCH /recipes/:id {"status":"approved"}` | `400` "Recipe approval is granted through the approvals queue" |
| 3 | Approve both recipe approvals | recipe `status = approved`; `GET /audit?entity_type=recipe&entity_id=…` contains `recipe.approved` |
| 4 | Create a `Task{ subject_type: 'recipe', subject_id: <that recipe> }` **before** step 3, then re-run steps 1–3 on a second recipe | `GET /evidence?task_id=…` contains one row with `type: system`, `source: bridge`, `bridge_event: recipe.approved`, `approval_status: pending`, `url` starting `/operations/recipes/` |
| 5 | `GET /mission-bridge/dispatches?limit=10` | one row per applied rule with `outcome`, `rule_key`, `task_id`, `evidence_id` |
| 6 | Replay the same recipe approval (re-emit by approving a second time — it 400s, so instead re-run the seed's recipe flow on the same recipe id) | no second evidence row; `BridgeDispatch` still has exactly one row for that `(rule_key, source_type, source_id)` |
| 7 | `POST /feedback` with `{ order_id, rating: 1 }` | a `Task{ task_type: 'improvement', domain: 'food' }` exists owned by the `FRONTEND_LEAD`, with 2 pending approvals; posting a second 1-star feedback for the same order creates **no** second task |
| 8 | `POST /readiness-meters/recompute` | `200`, an array of `{ code, value }`; `STANDARDIZATION` reflects the newly approved recipes |
| 9 | `GET /readiness-meters/STANDARDIZATION/history?days=90` | `200`, at least one point (today's synthetic point) |
| 10 | `GET /readiness-meters/STANDARDIZATION/signals?limit=20` | `200`, rows with `source_event: 'recipe.approved'` |
| 11 | `POST /decisions {"tier":"tier_2","impact_scope":"food","required_role_codes":["BACKEND_LEAD","FRONTEND_LEAD","BI_LEAD"], …}` then three `POST /decisions/:id/votes {"vote":"approve"}` | after the third, `status: 'approved'`; `GET /audit?entity_type=decision&entity_id=…` contains both `decision.aligned` and `decision.resolved` |
| 12 | `POST /decisions/:id/votes` as a role not on the decision | `403` |

- [ ] Nightly job (do not wait for the cron): call `POST /readiness-meters/recompute`, then verify the snapshot path directly —

```bash
docker exec konma-postgres psql -U konma -d konma -c "SELECT m.code, s.date, s.value FROM \"ReadinessSnapshot\" s JOIN \"ReadinessMeter\" m ON m.id = s.meter_id ORDER BY m.code;"
```

  Snapshots are written by `ReadinessCron`; to prove `snapshotAll` without waiting until 00:20, add a one-off `node -e` that boots the Nest context and calls `derivation.snapshotAll()`, or temporarily invoke the cron method through a REPL — record which you used. Expect 12 rows for today and the `@@unique([meter_id, date])` upsert to be a no-op on a second run.

- [ ] Stop the server. Final static gates on the merged tree:

```bash
cd backend && npx jest --silent                                   # 69 suites, 0 failed
cd backend && npx tsc --noEmit -p tsconfig.build.json             # exit 0
cd backend && npx eslint "{src,apps,libs,test}/**/*.ts"           # 0 errors
cd backend && npx prisma validate && npm run build                # valid + dist/src/main.js
cd frontend && npx tsc --noEmit && npm run lint && npm run build  # clean
```

- [ ] `git status --short` — expect only ` M CLOUDFLARE-SETUP.md` (pre-existing, deliberately untouched) plus the migration and planning docs staged below.
- [ ] Write `.planning/phases/31-p3-mission-bridge/31-01-SUMMARY.md` in the shape of the P2 summary: what each task landed with its commit, the migration contents, every verification table above with the real recorded values, deviations taken during implementation, and the deferrals from the Self-review.
- [ ] Update `.planning/STATE.md` (position, gates, next phase), `.planning/ROADMAP.md` (tick Phase 31, record the commit range) and `.planning/REQUIREMENTS.md` (tick `BRIDGE-01…04`, `READY-01…03`, `GOV-01…04`, and `QA-02` — leaving `QA-03` open with its deferral note).
- [ ] `git add backend/prisma/migrations .planning && git commit -m "feat(p3-17): single p3_mission_bridge migration, applied, seeded, smoke-tested"`

---

## Execution partition

Five waves. Every agent inside a wave works in its **own git worktree** branched from the merged result of the previous wave, and the file sets inside a wave are disjoint — no two agents in the same wave open the same file. Merge the wave into `v2-os-marketplace` before starting the next one; a wave is not complete until the merged tree passes `npx tsc --noEmit -p tsconfig.build.json` and `npx jest --silent`.

**Worktree setup per agent** (the `.claude/worktrees` path is already gitignored at `65a3599`):

```bash
git worktree add .claude/worktrees/p3-<task> v2-os-marketplace -b p3/<task>
cd .claude/worktrees/p3-<task>/backend && npm ci && npx prisma generate
```

`npx prisma generate` is mandatory in every worktree from wave 2 onward — the Prisma client must carry Task 1's `BridgeDispatch` model and the three `ReadinessMeter` columns or nothing compiles. No worktree runs `prisma migrate` of any kind.

**Shared-file ownership** — each of the three contested files is opened by exactly one task per wave:

| File | Wave 1 | Wave 2 | Wave 3 | Wave 4 | Wave 5 |
|---|---|---|---|---|---|
| `backend/prisma/schema.prisma` | **Task 1** | — | — | — | Task 17 (reads only) |
| `backend/src/app.module.ts` | **Task 3** | **Task 4** | — | — | — |
| `backend/src/test-utils/mock-providers.ts` | **Task 1** | — | — | — | — |
| `backend/src/prisma/seed-data.spec.ts` | **Task 1** | — | — | **Task 14** | — |
| `backend/src/readiness/readiness.module.ts` | — | — | **Task 7** | **Task 13** | — |

### Wave 1 — foundations (3 agents, parallel)

| Agent | Task | Depends on | Exclusive file set |
|---|---|---|---|
| A1 | **Task 1** — schema delta, mocks, settings key | — | `backend/prisma/schema.prisma`, `backend/prisma/seed-data/settings.ts`, `backend/src/settings/settings.service.ts`, `backend/src/test-utils/mock-providers.ts`, `backend/src/prisma/seed-data.spec.ts` |
| A2 | **Task 2** — domain-event catalogue | — | `backend/src/common/events/**`, `backend/src/common/constants/**` |
| A3 | **Task 3** — `ApprovalPolicyService` + CRUD | — | `backend/src/approvals/approval-policy.service.ts`, `approval-policy.service.spec.ts`, `approval-policy.module.ts`, `approval-policies.controller.ts`, `backend/src/approvals/dto/create-approval-policy.dto.ts`, `dto/update-approval-policy.dto.ts`, `backend/src/app.module.ts` |

### Wave 2 — emitters, bridge skeleton, formulas (3 agents, parallel)

| Agent | Task | Depends on | Exclusive file set |
|---|---|---|---|
| B1 | **Task 4** — `MissionBridgeService`, rules, dispatch ledger, bridge evidence | 1, 2 | `backend/src/mission-bridge/**`, `backend/src/app.module.ts` |
| B2 | **Task 5** — every ops emitter | 2 | `backend/src/inventory/**`, `backend/src/orders/**`, `backend/src/kitchen/**`, `backend/src/purchase-orders/**`, `backend/src/fulfilment/**`, `backend/src/catalog/**`, `backend/src/vendors/**`, `backend/src/feedback/**`, `backend/src/events/**`, `backend/src/notifications/**` |
| B3 | **Task 6** — derived-meter formulas | — | `backend/src/readiness/derivation/**` |

B1 and B3 do not import each other; B1's `MissionBridgeModule` imports `ReadinessModule` as it exists today (Task 7 adds the export it will consume in wave 4).

### Wave 3 — governance and derivation services (5 agents, parallel)

| Agent | Task | Depends on | Exclusive file set |
|---|---|---|---|
| C1 | **Task 7** — `ReadinessDerivationService`, history + signals API | 1, 6 | `backend/src/readiness/readiness.service.ts`, `readiness.controller.ts`, `readiness.module.ts`, `readiness.service.spec.ts`, `readiness-derivation.service.ts`, `readiness-derivation.service.spec.ts`, `backend/src/readiness/dto/**` |
| C2 | **Task 8** — task policy approvals | 1, 2, 3 | `backend/src/tasks/**` |
| C3 | **Task 9** — approvals engine + validation cascade | 1, 3, 6 | `backend/src/approvals/approvals.service.ts`, `approvals.controller.ts`, `approvals.module.ts`, `backend/src/approvals/__tests__/**`, `backend/src/approvals/dto/decide-approval.dto.ts`, `dto/list-approvals.dto.ts`, `dto/override-approval.dto.ts`, `backend/src/evidence/**` |
| C4 | **Task 10** — recipe approval via policy | 2, 3 | `backend/src/recipes/**` |
| C5 | **Task 11** — decision tiers and votes | 2, 3 | `backend/src/decisions/**` |

C1 must not touch `backend/src/readiness/derivation/**` (owned by B3 in wave 2, and frozen for the rest of the phase). C3 must not touch `approval-policy*.ts` (owned by A3).

### Wave 4 — bridge completion, nightly job, seeds, frontend (5 agents, parallel)

| Agent | Task | Depends on | Exclusive file set |
|---|---|---|---|
| D1 | **Task 12** — bridge signals, recompute, task spawn | 4, 6, 7, 3 | `backend/src/mission-bridge/**` |
| D2 | **Task 13** — snapshots + nightly cron | 7 | `backend/src/readiness/readiness.cron.ts`, `readiness.cron.spec.ts`, `readiness-derivation.service.ts`, `readiness-derivation.service.spec.ts`, `readiness.module.ts`, `backend/src/common/utils/advisory-lock.ts`, `advisory-lock.spec.ts` |
| D3 | **Task 14** — system-actor seed + `UsersService` guard | 2 | `backend/prisma/seed-reference.ts`, `backend/prisma/seed-data/system-actor.ts`, `backend/src/users/**`, `backend/src/prisma/seed-data.spec.ts` |
| D4 | **Task 15** — readiness UI | 7, 13 (contract only) | `frontend/lib/types/readiness.ts`, `frontend/components/ops/readiness/**`, `frontend/app/(ops)/readiness/**` |
| D5 | **Task 16** — approvals, decisions, evidence UI | 9, 11 (contract only) | `frontend/lib/types/approvals.ts`, `decisions.ts`, `evidence.ts`, `analytics.ts`, `frontend/components/ops/approvals/**`, `frontend/components/ops/decisions/**`, `frontend/components/ops/boards/EvidenceFeedCard.tsx`, `frontend/components/ops/evidence/EvidenceItem.tsx`, `frontend/components/ops/Sidebar.tsx`, `frontend/app/(ops)/approvals/**`, `frontend/app/(ops)/decisions/**` |

D1 and D2 both consume `ReadinessDerivationService` but only D2 edits it. D4 and D5 are frontend-only and share no file; the API contracts they code against are fully specified in Tasks 7, 9, 11 and 13 above, so neither has to wait for a running server.

### Wave 5 — database and closure (main tree only, 1 agent, no worktree)

| Agent | Task | Depends on | Notes |
|---|---|---|---|
| E1 | **Task 17** — migration, apply, seed, drift gate, runtime smoke, phase summary | all | **Main tree only.** It runs `prisma migrate dev --create-only`, `prisma migrate deploy`, `prisma migrate diff`, `npm run seed:reference`, boots `dist/src/main.js` and curls the endpoints. No worktree touches the database at any point in this phase. |

**Clean-up:** after each wave merges, `git worktree remove .claude/worktrees/p3-<task>` and `git branch -d p3/<task>`.

---

## Self-review

### SPEC §4 coverage → task

| SPEC §4 item | Task |
|---|---|
| §4.1 one file `backend/src/common/events/domain-events.ts`, typed, after-commit | 2 |
| §4.1 existing `order.placed`, `order.ready`, `delivery.updated`, `stock.low` retyped | 2 (declare), 5 (emit) |
| §4.1 existing `task.blocked` retyped | 2 (declare), 8 (emit) |
| §4.1 new `recipe.approved` | 2, 9 (emit on the satisfying approval) |
| §4.1 new `recipe.archived` | 2, 10 |
| §4.1 new `purchase_order.received` | 2, 5 |
| §4.1 new `prep_batch.created`, `prep_batch.depleted` | 2, 5 |
| §4.1 new `order.confirmed`, `order.served`, `order.delivered` | 2, 5 |
| §4.1 new `waste.logged` | 2, 5 |
| §4.1 new `event.completed` | 2, 5 |
| §4.1 new `feedback.received` | 2, 5 |
| §4.1 new `product.published` | 2, 5 |
| §4.1 new `vendor_price.updated` | 2, 5 |
| §4.1 new `task.validated` | 2, 9 |
| §4.1 new `approval.decided` | 2, 9 |
| §4.1 new `decision.resolved` | 2, 11 |
| §4.1 new `shipment.status_changed`, `shipment.delivered`, `review.published`, `coupon.redeemed`, `booking.attended` | 2 (declared); emitters **deferred to Phase 33** — see below |
| §4.1 `{ node_id, actor, occurred_at }` on every payload, emitted after commit inside try/catch | 2 (`domainEventBase` + `emitDomainEvent`), enforced at every call site in 5, 8, 9, 10, 11 |
| §4.2 `MissionBridgeService` subscribes to the ops events | 4 (listener), 12 (full apply) |
| §4.2 rules in `mission-bridge.rules.ts`, typed, reviewed in PRs | 4 (table), 12 (rules spec) |
| §4.2 **evidence**: subject resolves via `Task.subject`, `PurchaseOrder.linked_task_id`, `Decision.linked_task_id`; `Evidence{ type: system, source: bridge, bridge_event, url: deep link, notes: rendered template, uploaded_by: system user, approval_status: pending }` | 4 (`resolveTaskId`, `createBridgeEvidence`, `bridge-links.ts`), 14 (the system user) |
| §4.2 **signal**: `ReadinessSignal{ meter_id, source_event, value }` + trigger derived recompute | 12 |
| §4.2 **task spawn**: `feedback.received` rating ≤ 2 → one improvement task per order | 12 |
| §4.3 `STANDARDIZATION` formula | 6 (pure), 7 (gather) |
| §4.3 `PROCUREMENT` formula | 6, 7 |
| §4.3 `SALES` formula | 6, 7 |
| §4.3 `QUALITY` formula | 6, 7 |
| §4.3 hybrid `BACKEND`/`FRONTEND` = 0.5 × task-driven + 0.5 × mapped derived | 6 (`blendMeterValue`, `HYBRID_PARTNER_CODES`), 7 (apply), 9 (task-driven half writes through the same blend) |
| §4.3 remaining meters stay `task_driven` | seeded in P2; 7 publishes them unchanged |
| §4.3 recompute on relevant events | 12 (`recomputeWithHybrids` after each signal) |
| §4.3 recompute nightly | 13 |
| §4.3 write `ReadinessSnapshot` daily | 13 |
| §4.3 `GET /readiness-meters/:code/history?days=90` | 7 |
| §4.4 `ApprovalPolicy` seeded from the blueprint gates | seeded in P2 (`seed-data/approval-policies.ts`); 3 exposes CRUD and resolves the `is_default` fallback to the domain lead |
| §4.4 task create/update with `requires_approval` → one `Approval` per required role | 8 |
| §4.4 validation cascade requires every policy approval | 9 |
| §4.4 `FOUNDER_ADMIN` override with reason | 9 |
| §4.4 self-approval blocked | 9 |
| §4.4 delegation honoured | 9 |
| §4.4 recipe `draft → pending → approved` via the `food` policy; legacy flip removed | 10 (submit + removal), 9 (the flip on satisfaction) |
| §4.4 decision tier 1 auto-approve by the domain lead | 11 |
| §4.4 decision tier 2 (2+1), `aligned` then `approved` | 11 |
| §4.4 decision tier 3 founder resolves | 11 |
| §4.4 any reject → `rejected`; founder may `reopen` | 11 |
| §3.2 schema support (`BridgeDispatch`, meter value columns, three indexes) | 1 |
| §9 `approval-policies` CRUD | 3 |
| §9 `decisions/:id/votes` | 11 |
| §9 `readiness-meters/:code/history` | 7 |
| §6.5 readiness with a 30-day sparkline (the readiness surface half) | 15 |
| §10 unit tests per task, suite green after every task | every task |
| §10 smoke test 1 (`login → create task → upload evidence → approve → meter moves`) | 17 (curl; Playwright deferred) |

### REQUIREMENTS coverage → task

| Id | Task(s) |
|---|---|
| `BRIDGE-01` — domain-events.ts declares every §4.1 event; emitters after commit in try/catch | 2, 5, 8, 9, 10, 11 |
| `BRIDGE-02` — `MissionBridgeService` + `mission-bridge.rules.ts` declaring evidence, signal, spawn | 4, 12 |
| `BRIDGE-03` — bridge evidence with deep link, system uploader, never auto-approved | 4, 14 |
| `BRIDGE-04` — `feedback.received` ≤ 2 spawns one improvement task per order | 12 |
| `READY-01` — four derived meters by the §4.3 formulas; `ReadinessSignal` ledger | 6, 7, 12 |
| `READY-02` — hybrids blend 50/50; the rest stay task-driven; `xp_rules` from settings | 6, 7, 9 (`xp_rules` already allowlisted; `calculateEffectiveXp` reads it in 9) |
| `READY-03` — recompute on events and nightly; daily snapshot; history API | 7, 12, 13 |
| `GOV-01` — policies seeded with CRUD at `approval-policies` | 3 |
| `GOV-02` — policy approvals on task create/update; cascade; override; self-approval; delegation | 8, 9 |
| `GOV-03` — recipe approval by policy; legacy flip removed | 9, 10 |
| `GOV-04` — decision tiers, votes, reopen; `GET /approvals` returns task, decision and recipe approvals | 9, 11 |
| `QA-02` — tests cover PO receive, prep batch, evidence cascade, policy approvals, derived recompute | 5, 9, 12, 7 (unit) + 17 (recorded runtime smoke). **Partially deferred** — see below |
| `QA-03` — Playwright smoke test 1 in CI | **Deferred to Phase 32** — see below |

### Deliberate deferrals, with reasons

- **`QA-03` (Playwright smoke 1) → Phase 32.** Neither package has Playwright, a preview server harness or a `test/jest-integration.json`; the selectors a browser test would target are the Phase 32 header, spine and `/tasks` screens, so writing them now guarantees a rewrite. The exact flow is executed and recorded as curl in Task 17, so the *behaviour* is proven in this phase and only the automation moves.
- **`QA-02` integration harness → Phase 33.** SPEC §10 asks for a Postgres-backed integration job. P3 delivers unit coverage for every multi-write path it adds plus the Task 17 runtime smoke against the real database; the CI job with a Postgres service belongs with Phase 33's order-confirm/shipment transactions, which is where the harness earns its keep. Flag it when closing the phase so the roadmap text is corrected rather than the requirement silently ticked.
- **Emitters for `shipment.status_changed`, `shipment.delivered`, `review.published`, `coupon.redeemed`, `booking.attended` → Phase 33.** Their source models (`Shipment`, `Review`, `Coupon`, and the `events/:id/attendance` endpoint) do not exist; P2's summary places them in P5. The events are declared in `domain-events.ts` and their bridge rules are written and marked `emitter: 'P5'`, so Phase 33 adds one `emitDomainEvent` call per event and nothing else.
- **`Review` in the `QUALITY` formula → Phase 33.** P3 uses `Feedback.rating` (decision 7) behind a named seam.
- **`/admin/approval-policies` UI → Phase 32.** `GOV-01` asks for CRUD "at `approval-policies`" — the API ships here; the admin screen belongs with `/admin/modules` and the rest of the Phase 32 admin surface.
- **Header approvals badge, spine nav, `/tasks`, Mission Control §6.5 layout → Phase 32.** P3 updates the existing sidebar badge to the new count endpoint (Task 16) and nothing else in the IA.
- **WhatsApp/QStash nudges for pending policy approvals → Phase 35 (`RUN-01`).** `notifications.cron.ts:scanApprovalsPending` already dispatches for `Approval` rows and keeps working unchanged now that those rows finally exist.
- **`Notification.is_email_sent` removal** (P2's summary called it "P3 work") → Phase 32, with the notifications and IA pass. No P3 requirement depends on it and removing it would put `notifications.cron.ts` in Task 5's already-large file set.
- **Backfill of `valid` for existing tasks affected by decision 4** → not done. The only database is the local demo seed; the flag re-derives on the next cascade for any task that is touched. Called out as a risk below.

### Open risks

1. **Decision 4 is a live behaviour change.** Any task already carrying `requires_approval: true` with no `Approval` rows stops being `valid` the next time its cascade runs. On the local demo database this is noise; on a populated one it would visibly reduce XP and readiness. Task 17's smoke asserts the new semantics explicitly so the change is observed rather than discovered.
2. **`prisma migrate dev --create-only` may be refused** by Prisma 6.19's AI-agent guard (it refused `migrate reset --force` during P2) or by a `konma` role without `CREATEDB` for the temporary shadow database. Task 17 carries the `migrate diff --from-migrations … --script` fallback, which needs no privilege beyond the already-proven `konma_shadow`.
3. **Recompute frequency.** `recomputeWithHybrids` runs after every signalling bridge event, so a busy service hour recomputes `SALES` once per order. The gathers are `groupBy`/`aggregate` over indexed columns across a 7-day window, and they run outside the dispatch transaction, but this is the one place P3 could become hot. If it does, the fix is a short Redis debounce key per meter — deliberately not built now, because measuring it needs Phase 33's order volume.
4. **`Feedback` has no `node_id`**, so the `QUALITY` rating half is node-agnostic. Correct for the single seeded node; it must become node-scoped when a second node lands (or when `Review` replaces it in Phase 33).
5. **Task 5 has the widest blast radius** in the phase — twelve ops services in one agent. Its verification includes a repo-wide `grep -rn "eventEmitter.emit(" src` that must return zero, so a missed call site fails the task rather than silently bypassing the typed catalogue.
6. **The override endpoint's id semantics change.** `POST /approvals/:id/override` has always taken an `Approval` id in the backend, but `OverrideDialog.tsx` passes an *evidence* id and it only worked because evidence approvals were the only rows. Task 16 renames the prop and passes `approval.id`; any external caller of the old shape breaks. Called out here so it is recorded, not discovered.
7. **`apply()` awaits recomputes inside a `void`-ed listener call.** Request latency is unaffected (the listener is fire-and-forget) but an unhandled rejection would be invisible; `dispatchOnce` and the recompute loop each catch, and `emitDomainEvent` catches the dispatch itself, so there is no uncaught path — this is asserted by two spec cases in Tasks 4 and 12.

### Placeholder scan

No `TODO`, `TBD`, "similar to" or "etc." stands in for code. Four steps are specified as a shape plus an exact rule rather than a full listing, each with the rule that makes them mechanical: the sixteen `@OnEvent` handlers in Task 4 (one per rule with `emitter: 'P3'`, all named in the step, all identical but for the event constant); the four `gather*` methods in Task 7 (two are written out in full, the other two are given as their exact queries and the decision that fixes their semantics); `attachSubjects` in Task 9 (four `findMany` calls keyed by `entity_type`, listed); and the recharts chart in Task 15 (named as a verbatim reuse of `RevenueTrendChart.tsx` with the enumerated substitutions). Every formula, every state machine and every schema line is given literally.

### Name consistency across tasks

`SYSTEM_USER_ID` / `SYSTEM_ROLE_CODE` / `SYSTEM_USER_STATUS` (Tasks 2, 4, 12, 14) · `DomainEvent` / `DomainEventName` / `DomainEventPayloads` / `emitDomainEvent` / `domainEventBase` / `userActor` / `customerActor` / `systemActor` (Tasks 2, 5, 8, 9, 10, 11, 12) · `ApprovalPolicyService.resolve` / `.materialise` / `.isSatisfied` and `DOMAIN_LEAD_ROLE` / `ResolvedPolicy` (Tasks 3, 8, 9, 10, 11, 12) · `MissionBridgeService.apply` / `.resolveTaskId` / `.dispatchOnce` / `.createBridgeEvidence` / `.writeSignal` / `.spawnLowRatingTask` / `.listDispatches` (Tasks 4, 12) · `BridgeRule` / `BRIDGE_RULES` / `RULES_BY_EVENT` / `rule_key` / `BridgeOutcome` (Tasks 1, 4, 12) · `bridgeDeepLink` / `renderBridgeNote` (Task 4) · `standardization` / `procurement` / `sales` / `quality` / `clamp` / `round2` / `DERIVED_FORMULAS` / `HYBRID_PARTNER_CODES` (Tasks 6, 7) · `blendMeterValue` (Tasks 6, 7, 9) · `ReadinessDerivationService.recomputeMeter` / `.recomputeAll` / `.recomputeWithHybrids` / `.snapshotAll` (Tasks 7, 12, 13) · `ReadinessService.history` / `.signals` / `.findByCode` (Tasks 7, 15) · `ApprovalsService.decide` / `.cascade` / `.findApprovals` / `.countForUser` / `.effectiveRoleCodes` / `.entityAuthorId` (Tasks 9, 16) · `tallyDecision` / `castVote` / `resolve` / `reopen` (Tasks 11, 16) · `withAdvisoryLock` / `ADVISORY_LOCK.READINESS_SNAPSHOT` (Task 13) · `SETTING_DEFAULTS.readiness` and its `seed-data/settings.ts` mirror (Tasks 1, 7, 14) · migration directory `20260823180000_p3_mission_bridge` (Task 17) · frontend `MeterHistoryPoint` / `MeterSignal` / `MeterMode` (Tasks 7 response shape, 15) and `Approval` / `ApprovalSubject` / `DecisionVote` / `VoteValue` (Tasks 9, 11 response shapes, 16).
