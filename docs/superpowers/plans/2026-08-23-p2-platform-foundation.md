# P2 Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reset the schema to one fresh migration baseline that carries `Node`, Prisma enums for every enum-like string, `AuditEvent`, `Task.subject`, `ApprovalPolicy`, `DecisionVote`, readiness signals/snapshots, `@db.Timestamptz(3)`/`Decimal` precision, CHECK constraints, and `Product`/`ProductCategory`/`ProductVariant`/`ProductMedia` replacing `MenuItem`/`MenuCategory` — with every backend consumer, every frontend type and the seeds migrated, and the unit suite green after each task.

**Architecture:** Schema work lands first as *additive* changes (enums declared but unused, new models alongside old) so the backend compiles and `npx jest` stays green at every commit. Field types then flip enum-by-enum in three domain slices (mission, ops, commerce). `Node` arrives with a Prisma-level `@default` on `node_id` so ~100 existing `create()` call sites need no edit. `MenuItem` → `Product` is done in three slices: models added → new `catalog` module → consumers flipped and the old models dropped. Tasks 1–14 need **no database**: every step is `prisma validate` + `prisma generate` + `tsc` + `jest`, so they run and are verifiable offline. Task 15 writes the single baseline migration with `prisma migrate diff --from-empty` (no shadow DB needed), and Task 16 applies it, reseeds and drift-checks against the live database.

**Tech Stack:** NestJS 11, Prisma 6.19 (PostgreSQL), Jest 30 + ts-jest (config inline in `backend/package.json`, `rootDir: "src"`, `testRegex: ".*\.spec\.ts$"`, 52 suites), class-validator, Next.js 16 + React 19 (frontend), npm. Branch `v2-os-marketplace`. Local database: Docker Postgres `konma-postgres` on `localhost:5433` (db/user/pass `konma`, shadow db `konma_shadow`); `backend/.env` already points `DATABASE_URL` and `DIRECT_DATABASE_URL` at it. A schema reset is explicitly permitted (SPEC §1.3 — the database is not deployed). Build output is `backend/dist/src/main.js`; seed scripts are plain `ts-node prisma/seed*.ts`.

## Decisions taken while reading the code (deviations from a literal reading of SPEC §3)

1. **`node_id` gets a Prisma `@default`.** `node_id String @default("11111111-1111-4111-8111-111111111111")` on every aggregate, and the single seeded `Node` uses that literal id. Rationale: SPEC §1.2 makes multi-node *operation* a non-goal; a required `node_id` with no default would force an edit in ~100 `prisma.X.create()` call sites for zero behavioural gain. When a second node lands, the `@default` is dropped and creates pass it explicitly.
2. **`Order.zone_id` is NOT renamed to `fulfilment_zone_id`.** Same semantics, already indexed (`@@index([zone_id, status])`) and referenced in 40+ places including `FulfilmentService.resolveMarketplaceZoneId`. Recorded as a deliberate naming deviation from SPEC §3.3.
3. **`ApprovalEntityType` is a superset of SPEC's list:** `task | evidence | decision | recipe`. `approvals.service.ts:73` and `:133` branch on `'evidence'` today and SPEC §3.2 omits it; dropping it would make live code unreachable. `ApprovalScope` likewise keeps `review` alongside the SPEC members because `approvals.service.spec.ts:26` uses it.
4. **`GovernanceTier` members are `tier_1 | tier_2 | tier_3`.** SPEC writes `(1|2|3)`; bare digits are not legal Prisma enum identifiers.
5. **`EventBooking.payment_status` is kept and `status: BookingStatus` is added beside it.** They are different vocabularies (payment vs lifecycle) — SPEC §3.3's `BookingStatus` has zero overlap with the four values the service writes.
6. **`Notification.is_email_sent` is kept** alongside the new `channel: NotificationChannel[]`; `notifications.cron.ts` reads it. Removing it is P3 work.
7. **Deferred to P5 (models NOT created here):** `Shipment`, `ShipmentEvent`, `Refund`, `Coupon`, `CouponRedemption`, `LoyaltyAccount`, `LoyaltyTransaction`, `Review`, `UsageEvent`. Their **enums are declared** in Task 1 so P5 only adds models, and the `Order` money columns they populate (`discount_amount`, `shipping_amount`, `tax_amount`, `loyalty_points_*`) are added now per SPEC §3.3. `Order.coupon_id` is *not* added (it needs the `Coupon` FK). This deviates from ROADMAP Phase 30 success criterion 4 / PLAT-08, which lists those models under Phase 30 — see Self-review.
8. **`/menu/*` stays as a route alias on `CatalogController`** returning the product shape; frontend routes `/menu` and `/operations/menu` keep their paths in P2 (SPEC §5.1's `/shop` routes and the `/menu` → `/shop` redirect are P5). P2 renames data, not routes.
9. **Breaking value renames (safe — the DB is reset, no backfill):** `EvidenceType` `photo`→`image`, `doc`→`document` (+ new `system`); `MovementType` `received`→`purchase_received`.

## File structure

**Create (backend):**
- `backend/src/common/utils/parse-enum.ts` + `.spec.ts` — `parseEnum`, `isEnumValue`.
- `backend/src/common/types/transaction.ts` — exported `Tx = Prisma.TransactionClient` alias.
- `backend/src/node/node.constants.ts`, `node.service.ts`, `node.service.spec.ts`, `node.controller.ts`, `node.module.ts`, `dto/update-node.dto.ts`.
- `backend/src/audit/audit.service.ts`, `audit.service.spec.ts`, `audit.controller.ts`, `audit.module.ts`.
- `backend/src/module-access/module-access.service.ts`, `module-access.controller.ts`, `module-access.module.ts`.
- `backend/src/catalog/catalog.service.ts`, `catalog.service.spec.ts`, `catalog.controller.ts`, `catalog.module.ts`, `dto/*.dto.ts` (6 files).
- `backend/src/common/utils/node-time.ts` + `.spec.ts` — `nodeDayRange`, `nodeDayKey`, `formatInNodeTz`.
- `backend/prisma/seed-data/module-access.ts`, `approval-policies.ts`, `demo-catalog.ts`.
- `backend/prisma/migrations/20260823120000_p2_platform_foundation/migration.sql` (Task 15).

**Delete (backend):** `backend/src/menu/` (whole directory: controller, service, spec, module, 5 DTOs).

**Create (frontend):** `frontend/lib/types/catalog.ts`.
**Delete (frontend):** `frontend/lib/types/menu.ts`.

**Modify:** `backend/prisma/schema.prisma` (every task 1–9), `backend/prisma/seed-reference.ts`, `seed-demo.ts`, `seed-data/reference.ts`, `backend/src/app.module.ts`, plus the per-task file lists below.

**Current state (verified 23 Aug):** 52 `*.spec.ts` suites under `backend/src`, all passing after P1-A/P1-B/P1-C. 20 migrations in `backend/prisma/migrations/`, all applied to the local database (latest `20260823000000_order_fk_set_null`, an FK `ON DELETE SET NULL` drift fix that the schema already carries and the new baseline therefore absorbs); reference and demo seeds have run. No `Node`, no `AuditEvent`, no `Product`, no `AuditService`. `process.env.TZ = 'Asia/Kolkata'` is forced at `backend/src/main.ts:2`.

---

### Task 1: Enum catalogue + `parseEnum` helper

Declares every Prisma enum but changes **no field types**, so nothing can break. Values are the ones actually found in the code (audited by grep), extended to the SPEC target sets.

**Files:**
- Modify: `backend/prisma/schema.prisma` (append after the `generator client` block)
- Create: `backend/src/common/utils/parse-enum.ts`, `backend/src/common/utils/parse-enum.spec.ts`
- Create: `backend/src/common/types/transaction.ts`

- [ ] Append to `backend/prisma/schema.prisma`, immediately after the `generator client { … }` block:

```prisma
// ─── Platform ────────────────────────────────────────────────────────────────
enum NodeStatus        { setup active paused closed }
enum ActorType         { user customer system }

// ─── Mission layer ───────────────────────────────────────────────────────────
enum MissionPhase      { setup foundation activation scale }
enum MissionScope      { food art lifestyle system mixed }
enum MissionStatus     { planned active completed paused }
enum QuestStatus       { planned active completed blocked }
enum TaskStatus        { todo doing done blocked cancelled }
enum TaskType          { core adhoc improvement }
enum TaskDomain        { food art lifestyle ops procurement bi talent tech design }
enum TaskPriority      { low medium high critical }
enum TaskSubjectType   { recipe product event vendor purchase_order prep_batch order decision }
enum EvidenceType      { image document video link note system }
enum EvidenceSource    { manual bridge }
enum ApprovalStatus    { pending approved rejected }
enum ApprovalEntityType { task evidence decision recipe }
enum ApprovalScope     { task decision recipe pricing vendor experience tech hiring review }
enum ApprovalMode      { all n_of }
enum DecisionStatus    { proposed aligned approved rejected reopened }
enum GovernanceTier    { tier_1 tier_2 tier_3 }
enum VoteValue         { approve reject abstain }
enum MeterMode         { task_driven derived hybrid }

// ─── Catalog ─────────────────────────────────────────────────────────────────
enum ProductType       { prepared_food packaged experience merchandise }
enum FulfilmentType    { local shipped booking }
enum StockMode         { derived_from_recipe tracked capacity }
enum ProductStatus     { draft active archived }
enum MediaKind         { image video }

// ─── Commerce ────────────────────────────────────────────────────────────────
enum OrderChannel      { dine_in takeaway delivery marketplace }
enum OrderStatus       { placed confirmed preparing ready served dispatched shipped delivered completed cancelled refunded }
enum OrderItemStatus   { pending preparing ready packed shipped delivered attended cancelled }
enum OrderSource       { pos storefront webhook_fallback }
enum DeliveryStatus    { picked_up in_transit delivered }
enum PaymentMethod     { cash card upi razorpay }
enum PaymentStatus     { pending paid failed refunded partially_refunded }
enum EventType         { dining workshop pop_up tasting other }
enum EventStatus       { draft upcoming live past cancelled }
enum BookingStatus     { held confirmed cancelled attended no_show }

// ─── Declared for P5 (no model uses them yet — SPEC §3.3) ────────────────────
enum ShippingProvider  { shiprocket manual }
enum ShipmentStatus    { pending awb_assigned pickup_scheduled picked_up in_transit out_for_delivery delivered rto cancelled failed }
enum CouponType        { percent fixed free_shipping }
enum LoyaltyTier       { member regular insider }
enum LoyaltyReason     { earn redeem adjust expire }
enum ReviewStatus      { pending published hidden }

// ─── Operations ──────────────────────────────────────────────────────────────
enum RecipeStatus      { draft pending approved archived }
enum PreparationType   { scratch batch_prepared ready_to_sell assemble }
enum UsageType         { recipe_input supply equipment }
enum MovementType      { purchase_received prep_deducted order_deducted waste adjustment supply_usage import shipment_packed return }
enum PurchaseOrderStatus { draft ordered received cancelled }
enum PrepBatchStatus   { active depleted expired }
enum NotificationType  { task_due task_blocked approval_pending low_stock new_order order_ready delivery_update admin_notice }
enum NotificationChannel { in_app email whatsapp }
```

- [ ] `cd backend && npx prisma validate` — expect `The schema at prisma\schema.prisma is valid 🚀`.
- [ ] `cd backend && npx prisma generate` — expect `Generated Prisma Client (v6.19.x)`.
- [ ] Create `backend/src/common/types/transaction.ts`:

```ts
import { Prisma } from '@prisma/client';

/**
 * The client handed to a `$transaction(async (tx) => …)` callback.
 * Promoted from the module-local alias in `fulfilment.service.ts` so audit,
 * catalog and node code can type their `tx` parameters instead of using `any`.
 */
export type Tx = Prisma.TransactionClient;
```

- [ ] Write the failing test `backend/src/common/utils/parse-enum.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { TaskStatus, MovementType } from '@prisma/client';
import { parseEnum, isEnumValue } from './parse-enum';

describe('parse-enum', () => {
  it('returns the value when it is a member', () => {
    expect(parseEnum(TaskStatus, 'doing', 'status')).toBe('doing');
    expect(parseEnum(MovementType, 'purchase_received', 'movement_type')).toBe(
      'purchase_received',
    );
  });

  it('throws BadRequestException listing the allowed values', () => {
    expect(() => parseEnum(TaskStatus, 'in_progress', 'status')).toThrow(
      BadRequestException,
    );
    expect(() => parseEnum(TaskStatus, 'in_progress', 'status')).toThrow(
      /Allowed: todo, doing, done, blocked, cancelled/,
    );
  });

  it('isEnumValue narrows without throwing', () => {
    expect(isEnumValue(TaskStatus, 'todo')).toBe(true);
    expect(isEnumValue(TaskStatus, 'nope')).toBe(false);
    expect(isEnumValue(TaskStatus, 42)).toBe(false);
  });
});
```

- [ ] `cd backend && npx jest src/common/utils/parse-enum --silent` — expect failure: `Cannot find module './parse-enum'`.
- [ ] Create `backend/src/common/utils/parse-enum.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

type EnumLike = Record<string, string>;

/**
 * Narrows an untrusted string to a Prisma enum member. Prisma generates each
 * enum as a frozen object of string values plus a string-union type, so the
 * object doubles as the runtime allow-list and the type parameter carries the union.
 */
export function parseEnum<T extends EnumLike>(
  enumObject: T,
  raw: string,
  field: string,
): T[keyof T] {
  const values = Object.values(enumObject);
  if (!values.includes(raw)) {
    throw new BadRequestException(
      `Invalid ${field}: "${raw}". Allowed: ${values.join(', ')}`,
    );
  }
  return raw as T[keyof T];
}

export function isEnumValue<T extends EnumLike>(
  enumObject: T,
  raw: unknown,
): raw is T[keyof T] {
  return typeof raw === 'string' && Object.values(enumObject).includes(raw);
}
```

- [ ] `cd backend && npx jest src/common/utils/parse-enum --silent` — expect `Tests: 3 passed, 3 total`.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 53 passed, 53 total` (52 pre-existing + the new one).
- [ ] `git add backend/prisma/schema.prisma backend/src/common && git commit -m "feat(p2-01): declare every Prisma enum plus parseEnum and Tx helpers" -- backend/prisma/schema.prisma backend/src/common`

---

### Task 2: Mission-layer fields become enums

`Mission`, `Quest`, `Task` (+ `subject_*`, `updated_by`), `Evidence` (+ `source`, `bridge_event`, `photo`→`image`), `Approval`, `Decision`. The DTO-local TypeScript enums are **deleted** — a TS string enum member is not assignable to Prisma's string-literal union, so DTOs must import the Prisma enum and use it for both `@IsEnum(...)` and the field type.

**Files:**
- Modify: `backend/prisma/schema.prisma` (`Mission`, `Quest`, `Task`, `Evidence`, `Approval`, `Decision`)
- Modify: `backend/src/missions/dto/create-mission.dto.ts`, `backend/src/missions/dto/update-mission.dto.ts`
- Modify: `backend/src/quests/dto/update-quest.dto.ts`
- Modify: `backend/src/tasks/dto/create-task.dto.ts`, `backend/src/tasks/dto/update-task.dto.ts`
- Modify: `backend/src/tasks/tasks.service.ts` (`update`, `block`, `unblock`)
- Modify: `backend/src/evidence/dto/create-evidence.dto.ts`, `backend/src/evidence/evidence.service.ts`
- Modify: `backend/src/decisions/dto/create-decision.dto.ts`, `backend/src/decisions/dto/update-decision.dto.ts`
- Modify: `backend/src/approvals/__tests__/approvals.service.spec.ts` (fixture `approval_scope`)
- Modify: `backend/src/imports/validators/tasks.validator.ts`, `quests.validator.ts` (row-state literals stay `string` — see step)

- [ ] `schema.prisma` — `Mission`: replace the three `String` status columns.

```prisma
  phase            MissionPhase  @default(setup)
  scope            MissionScope  @default(food)
  status           MissionStatus @default(planned)
```

- [ ] `schema.prisma` — `Quest`: `status String @default("planned")` → `status QuestStatus @default(planned)`.
- [ ] `schema.prisma` — `Task`: replace the four status columns and add the subject + updater columns.

```prisma
  task_type            TaskType             @default(core)
  domain               TaskDomain
  status               TaskStatus           @default(todo)
  priority             TaskPriority         @default(medium)
  subject_type         TaskSubjectType?
  subject_id           String?
  updated_by           String?
  updater              User?                @relation("TaskUpdater", fields: [updated_by], references: [id])
```
  and add two indexes beside the existing ones:
```prisma
  @@index([subject_type, subject_id])
  @@index([status, due_date])
```
  On `User`, add the back-relation next to `created_tasks`:
```prisma
  updated_tasks           Task[]               @relation("TaskUpdater")
```

- [ ] `schema.prisma` — `Evidence`: type/source/approval status.

```prisma
  type            EvidenceType
  source          EvidenceSource @default(manual)
  bridge_event    String?
  approval_status ApprovalStatus @default(pending)
```

- [ ] `schema.prisma` — `Approval`: enum columns (the `task` relation is removed in Task 5, not here).

```prisma
  entity_type            ApprovalEntityType
  approval_scope         ApprovalScope
  status                 ApprovalStatus @default(pending)
```

- [ ] `schema.prisma` — `Decision`: status + tier + required roles.

```prisma
  status            DecisionStatus @default(proposed)
  tier              GovernanceTier @default(tier_1)
  required_role_codes String[]     @default([])
  resolved_by       String?
  resolved_at       DateTime?
```

- [ ] `cd backend && npx prisma generate` — expect `Generated Prisma Client`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect errors in the DTO/service files listed above. Fix them as follows.
- [ ] `backend/src/missions/dto/create-mission.dto.ts` — delete the local `MissionPhase`/`MissionScope` enums (lines 3-16) and import the Prisma ones:

```ts
import { MissionPhase, MissionScope } from '@prisma/client';
```
  then keep the decorators unchanged (`@IsEnum(MissionPhase)`, `@IsEnum(MissionScope)`) and the property types as `MissionPhase` / `MissionScope`. Apply the same treatment in `update-mission.dto.ts` (which also declares `MissionStatus` at lines 4-9) and `backend/src/quests/dto/update-quest.dto.ts` (`QuestStatus`, lines 3-8).

- [ ] `backend/src/tasks/dto/create-task.dto.ts` — delete the local `TaskType` (12-16), `TaskDomain` (18-28) and `TaskPriority` (30-35) enums; replace with:

```ts
import { TaskType, TaskDomain, TaskPriority } from '@prisma/client';
```

- [ ] `backend/src/tasks/dto/update-task.dto.ts` — delete the local `TaskStatus` enum (10-16) **and** the inline object literal at line 33. Import and use the Prisma enums:

```ts
import { TaskStatus, TaskPriority, TaskDomain } from '@prisma/client';
```
```ts
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
```
```ts
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
```

- [ ] `backend/src/tasks/tasks.service.ts` — the three status writes now need enum members instead of bare strings. In `update` (the `$transaction` at line 197) the value already comes from the DTO and needs no change; in `block` (line 264) and `unblock` (line 323) replace the literals:

```ts
import { TaskStatus } from '@prisma/client';
```
```ts
        data: {
          status: TaskStatus.blocked,
          blocked: true,
          blocked_reason: reason,
        },
```
```ts
        data: {
          status: TaskStatus.todo,
          blocked: false,
          blocked_reason: null,
        },
```

- [ ] `backend/src/evidence/dto/create-evidence.dto.ts` — delete the local `EvidenceType` enum (8-14), import `EvidenceType` from `@prisma/client`. The member rename means callers now send `image`/`document`.
- [ ] `backend/src/evidence/evidence.service.ts` — the approval writes at lines 134, 370 and 409 and the filter at 287 become enum members:

```ts
import { ApprovalStatus, TaskStatus } from '@prisma/client';
```
  `approval_status: 'pending'` → `approval_status: ApprovalStatus.pending`; `'approved'` → `ApprovalStatus.approved`; `'rejected'` → `ApprovalStatus.rejected`; and the cascade check at line 310 `task.status === 'done'` → `task.status === TaskStatus.done`.

- [ ] `backend/src/decisions/dto/create-decision.dto.ts` / `update-decision.dto.ts` — replace `@IsIn(['proposed', 'approved', 'rejected'])` (update DTO line 17) with:

```ts
import { DecisionStatus } from '@prisma/client';
```
```ts
  @IsOptional()
  @IsEnum(DecisionStatus)
  status?: DecisionStatus;
```
  `decision_type` and `impact_scope` stay free strings (not in the SPEC §3 enum list).

- [ ] `backend/src/approvals/__tests__/approvals.service.spec.ts:24-27` — the fixture's `approval_scope: 'review'` is still valid (the enum keeps `review`); change `entity_type: 'evidence'` only if TypeScript complains about the literal — it should not, since `evidence` is a member.
- [ ] Import-preview row states (`status = 'blocked'` / `'duplicate'` in `backend/src/imports/validators/*.ts`) are a **different** field (`ImportRow.status`, `backend/src/imports/import-types.ts:29`). Leave them untouched; confirm with `grep -n "status: 'valid' | 'invalid' | 'duplicate' | 'blocked'" backend/src/imports/import-types.ts`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest src/tasks src/missions src/quests src/evidence src/decisions src/approvals --silent` — expect all suites `PASS`, `0 failed`.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 53 passed, 53 total`.
- [ ] `git add backend/prisma/schema.prisma backend/src/tasks backend/src/missions backend/src/quests backend/src/evidence backend/src/decisions backend/src/approvals && git commit -m "feat(p2-02): mission-layer enums, Task.subject, Evidence.source" -- backend/prisma/schema.prisma backend/src/tasks backend/src/missions backend/src/quests backend/src/evidence backend/src/decisions backend/src/approvals`

---

### Task 3: Operations fields become enums

`Recipe` (+ `parent_recipe_id`/`version`), `Ingredient` (drop legacy `category`), `StockMovement` (`received`→`purchase_received`), `PurchaseOrder`, `PrepBatch`, `Notification` (+ `channel[]`).

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/recipes/dto/update-recipe.dto.ts`, `backend/src/recipes/recipes.service.ts`
- Modify: `backend/src/ingredients/dto/create-ingredient.dto.ts`, `update-ingredient.dto.ts`, `backend/src/ingredients/ingredients.service.ts`
- Modify: `backend/src/purchase-orders/purchase-orders.service.ts`, `dto/create-purchase-order.dto.ts`, `purchase-orders.controller.ts`
- Modify: `backend/src/imports/validators/purchase-orders.validator.ts`, `recipes.validator.ts`, `ingredients.validator.ts`, `backend/src/imports/imports.service.ts`, `backend/src/imports/template.service.ts`
- Modify: `backend/src/kitchen/prep-batches/prep-batches.service.ts`, `backend/src/kitchen/expiry/kitchen-expiry.cron.ts`, `backend/src/kitchen/waste/waste.service.ts`, `backend/src/kitchen/supply-usage/supply-usage.service.ts`, `backend/src/kitchen/metrics/kitchen-metrics.service.ts`
- Modify: `backend/src/inventory/inventory.service.ts`
- Modify: `backend/src/notifications/notifications.processor.ts`, `backend/src/notifications/notifications.service.ts`
- Modify: `backend/src/procurement/procurement.service.ts`
- Modify: `backend/prisma/seed-reference.ts` (drop the legacy-category backfill loop)

- [ ] `schema.prisma` — `Recipe`:

```prisma
  status            RecipeStatus    @default(draft)
  preparation_type  PreparationType @default(scratch)
  parent_recipe_id  String?
  version           Int             @default(1)
  parent_recipe     Recipe?         @relation("RecipeVersions", fields: [parent_recipe_id], references: [id], onDelete: SetNull)
  versions          Recipe[]        @relation("RecipeVersions")
```

- [ ] `schema.prisma` — `Ingredient`: delete `category String?` entirely, and:

```prisma
  usage_type      UsageType           @default(recipe_input)
```

- [ ] `schema.prisma` — `StockMovement`: `movement_type String` → `movement_type MovementType` and `actor_type String @default("user")` → `actor_type ActorType @default(user)`; delete the stale trailing comments on both lines.
- [ ] `schema.prisma` — `PurchaseOrder`: `status PurchaseOrderStatus @default(draft)`; `PrepBatch`: `status PrepBatchStatus @default(active)`.
- [ ] `schema.prisma` — `Notification`:

```prisma
  type           NotificationType
  channel        NotificationChannel[] @default([in_app])
```

- [ ] `cd backend && npx prisma generate && npx tsc --noEmit -p tsconfig.build.json` — collect the error list; fix each as below.
- [ ] `backend/src/recipes/dto/update-recipe.dto.ts:65` — replace `@IsIn(['draft','pending','approved','archived'])` with `@IsEnum(RecipeStatus)` and type the property `RecipeStatus` (import from `@prisma/client`). Add the missing `preparation_type` validator that never existed:

```ts
  @IsOptional()
  @IsEnum(PreparationType)
  preparation_type?: PreparationType;
```
  Do the same in `backend/src/recipes/dto/create-recipe.dto.ts`.

- [ ] `backend/src/recipes/recipes.service.ts:198-203` — retype the transition map:

```ts
import { RecipeStatus } from '@prisma/client';

const ALLOWED_TRANSITIONS: Record<RecipeStatus, RecipeStatus[]> = {
  [RecipeStatus.draft]: [RecipeStatus.pending],
  [RecipeStatus.pending]: [RecipeStatus.approved, RecipeStatus.draft],
  [RecipeStatus.approved]: [RecipeStatus.archived],
  [RecipeStatus.archived]: [],
};
```
  and in `createNewVersion` (line 295) set the new lineage columns on the clone:
```ts
        parent_recipe_id: current.parent_recipe_id ?? current.id,
        version: current.version + 1,
        status: RecipeStatus.draft,
```

- [ ] `backend/src/ingredients/dto/create-ingredient.dto.ts` and `update-ingredient.dto.ts` — delete the `category` property and its `@IsIn(['dairy',…])` decorator entirely (SPEC §3.5); add:

```ts
  @IsOptional()
  @IsEnum(UsageType)
  usage_type?: UsageType;
```
  Then `grep -rn "\bcategory\b" backend/src/ingredients backend/src/imports/validators/ingredients.validator.ts` and delete every remaining write of the legacy string (keep `category_id`/`category_obj`).

- [ ] `backend/prisma/seed-reference.ts` — delete the "Backfill legacy string categories" block (the `ingredientsToUpdate` loop and the `CATEGORY_MAPPING` import); the column no longer exists. Also delete `CATEGORY_MAPPING` from `backend/prisma/seed-data/reference.ts`.
- [ ] `backend/src/purchase-orders/purchase-orders.service.ts` — import `PurchaseOrderStatus` and replace the four literal writes: line 72/97/108/109 `'ordered'` → `PurchaseOrderStatus.ordered`, line 264 `'cancelled'` → `PurchaseOrderStatus.cancelled`, the receive path `'received'` → `PurchaseOrderStatus.received`. Line 191's `movement_type: 'received'` becomes `MovementType.purchase_received`. Same in `backend/src/procurement/procurement.service.ts:71` (read filter).
- [ ] `backend/src/purchase-orders/dto/create-purchase-order.dto.ts:43` and `purchase-orders.controller.ts:26` — swap `@IsIn([...])` for `@IsEnum(PurchaseOrderStatus)`; keep the narrower runtime guard by validating separately:

```ts
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  @IsIn([PurchaseOrderStatus.draft, PurchaseOrderStatus.ordered])
  status?: PurchaseOrderStatus;
```

- [ ] `backend/src/imports/validators/purchase-orders.validator.ts:4` — `const VALID_STATUSES = [PurchaseOrderStatus.draft, PurchaseOrderStatus.ordered];` (import from `@prisma/client`).
- [ ] Movement-type writes — replace the literal in each of: `backend/src/kitchen/prep-batches/prep-batches.service.ts:335` (`MovementType.prep_deducted`), `backend/src/kitchen/waste/waste.service.ts:159` (`MovementType.waste`), `backend/src/kitchen/supply-usage/supply-usage.service.ts:45` and the read filter at `:11` (`MovementType.supply_usage`), `backend/src/inventory/inventory.service.ts:116` (`MovementType.adjustment`), `backend/src/imports/imports.service.ts:107` (`MovementType.import`). `backend/src/fulfilment/fulfilment.service.ts:269` (`MovementType.order_deducted`) is touched again in Task 11 — change it here too.
- [ ] Prep-batch status writes — `prep-batches.service.ts:21,123,237,390`, `fulfilment.service.ts:169,304,318`, `kitchen-expiry.cron.ts:19,35`, `kitchen-metrics.service.ts:50`, `waste.service.ts:254`: `'active'`→`PrepBatchStatus.active`, `'depleted'`→`PrepBatchStatus.depleted`, `'expired'`→`PrepBatchStatus.expired`.
- [ ] `backend/src/notifications/notifications.processor.ts` — import `NotificationType` and replace the seven literals at lines 58/66, 89, 118/146, 180/208, 240, 277, 300 with the matching members; `backend/src/notifications/notifications.service.ts:35` → `NotificationType.admin_notice`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest src/recipes src/ingredients src/purchase-orders src/kitchen src/inventory src/notifications src/imports --silent` — expect all `PASS`. Any spec asserting `movement_type: 'received'` must be updated to `'purchase_received'` (grep: `grep -rn "'received'" backend/src --include=*.spec.ts`).
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 53 passed, 53 total`.
- [ ] `git add backend/prisma backend/src && git commit -m "feat(p2-03): operations enums, recipe versioning, drop legacy Ingredient.category" -- backend/prisma backend/src`

---

### Task 4: Commerce fields become enums + SPEC §3.3 money columns

`Order`, `OrderItem`, `Payment`, `Event`, `EventBooking`, `ChannelModifier`.

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/orders/orders.service.ts`, `orders.controller.ts`, `dto/create-order.dto.ts`, `dto/order-filters.dto.ts`, `dto/record-payment.dto.ts`, `dto/update-delivery.dto.ts`
- Modify: `backend/src/customer-orders/customer-orders.service.ts`, `dto/sync-cart.dto.ts`
- Modify: `backend/src/fulfilment/fulfilment.service.ts`
- Modify: `backend/src/webhooks/webhooks.service.ts`
- Modify: `backend/src/kitchen/kds/kds.service.ts`, `kds.controller.ts`, `backend/src/kitchen/metrics/kitchen-metrics.service.ts`
- Modify: `backend/src/events/events.service.ts`, `dto/update-event.dto.ts`, `dto/create-event.dto.ts`
- Modify: `backend/src/menu/dto/upsert-channel-modifier.dto.ts` (moves to `catalog/` in Task 10 — edit in place now)
- Modify: `backend/src/analytics/analytics.service.ts`
- Modify: the matching `*.spec.ts` fixtures

- [ ] `schema.prisma` — `Order`: enum columns plus the SPEC §3.3 money and provenance columns.

```prisma
  channel                 OrderChannel
  status                  OrderStatus     @default(placed)
  delivery_status         DeliveryStatus?
  placed_via              OrderSource     @default(pos)
  discount_amount         Decimal         @default(0)
  shipping_amount         Decimal         @default(0)
  tax_amount              Decimal         @default(0)
  loyalty_points_earned   Int             @default(0)
  loyalty_points_redeemed Int             @default(0)
  idempotency_key         String?         @unique
  address_snapshot        Json?
  updated_by              String?
```

- [ ] `schema.prisma` — `OrderItem`:

```prisma
  status       OrderItemStatus @default(pending)
  fulfilment   FulfilmentType  @default(local)
  tax_rate     Decimal         @default(0)
```

- [ ] `schema.prisma` — `Payment`:

```prisma
  method              PaymentMethod
  status              PaymentStatus @default(pending)
  refunded_amount     Decimal       @default(0)
```

- [ ] `schema.prisma` — `Event` / `EventBooking` / `ChannelModifier`:

```prisma
  event_type  EventType
  status      EventStatus @default(upcoming)
```
```prisma
  status              BookingStatus @default(confirmed)
  hold_expires_at     DateTime?
```
```prisma
  channel        OrderChannel
```
  (`ChannelModifier.channel_type` is **renamed** to `channel` per SPEC §3.3; the `@@unique([channel_type])` becomes `@@unique([node_id, channel])` in Task 5. For now write `@@unique([channel])`.)

- [ ] `cd backend && npx prisma generate && npx tsc --noEmit -p tsconfig.build.json` — fix the reported sites:
- [ ] `backend/src/orders/orders.service.ts:24-34` — retype the state machine and terminal list:

```ts
import { OrderStatus, DeliveryStatus, OrderChannel, PaymentStatus, PaymentMethod, OrderItemStatus, OrderSource } from '@prisma/client';

/** Valid order status transitions (non-cancellation) */
const STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.placed]: [OrderStatus.confirmed, OrderStatus.preparing],
  [OrderStatus.confirmed]: [OrderStatus.preparing],
  [OrderStatus.preparing]: [OrderStatus.ready],
  [OrderStatus.ready]: [OrderStatus.served, OrderStatus.dispatched],
};
```
  The `shipped`/`delivered`/`completed`/`refunded` transitions belong to the shipment and refund lifecycles and are added in P5; declaring them as enum members now (Task 1) is what lets P5 extend this map without another migration.
```ts
/** Terminal statuses that cannot be cancelled */
const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.served,
  OrderStatus.dispatched,
  OrderStatus.delivered,
  OrderStatus.completed,
  OrderStatus.cancelled,
  OrderStatus.refunded,
];

/** Valid delivery status progression */
const DELIVERY_STATUS_ORDER: (DeliveryStatus | null)[] = [
  null,
  DeliveryStatus.picked_up,
  DeliveryStatus.in_transit,
  DeliveryStatus.delivered,
];
```

- [ ] `backend/src/orders/orders.service.ts:270` — `updateOrderStatus` must take the enum (and, for Task 6, an actor):

```ts
  async updateOrderStatus(orderId: string, newStatus: OrderStatus, userId: string | null) {
```
  Replace the two `'cancelled'` literals (289, 306) with `OrderStatus.cancelled`, the `'placed'` write at 97 with `OrderStatus.placed`, and `status: 'pending'` at 115 with `OrderItemStatus.pending`. Add `placed_via: OrderSource.pos` to the POS `order.create` data block.

- [ ] `backend/src/orders/orders.controller.ts:24` and `backend/src/orders/dto/order-filters.dto.ts:5,9` — replace both `@IsIn([...])` decorators with `@IsEnum(OrderStatus)` / `@IsEnum(OrderChannel)`, typing the properties accordingly. Thread the caller through to the service:

```ts
  @Patch(':id/status')
  @RequiresPermission(Permission.MANAGE_POS)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.ordersService.updateOrderStatus(id, dto.status, user.id);
  }
```

- [ ] `backend/src/orders/dto/create-order.dto.ts:28` → `@IsEnum(OrderChannel)`; `record-payment.dto.ts:4` → `@IsEnum(PaymentMethod)`; `update-delivery.dto.ts:9` → `@IsEnum(DeliveryStatus)`.
- [ ] `backend/src/customer-orders/dto/sync-cart.dto.ts:40` — keep the narrowing but on the enum:

```ts
  @IsEnum(OrderChannel)
  @IsIn([OrderChannel.takeaway, OrderChannel.delivery])
  channel!: OrderChannel;
```
  and in `customer-orders.service.ts` set `placed_via: OrderSource.storefront` on the order create, plus `PaymentStatus.paid` / `PaymentMethod.razorpay` at the payment writes.

- [ ] `backend/src/fulfilment/fulfilment.service.ts` — the `PendingOrderData.channel` union becomes `OrderChannel`; line 153 `status: 'ready'` → `OrderItemStatus.ready`; line 365 `status: 'placed'` → `OrderStatus.placed`; 379 `status: 'paid'` → `PaymentStatus.paid`, `method: 'razorpay'` → `PaymentMethod.razorpay`; and `FulfilmentActorType` (line 21) is replaced by the Prisma enum:

```ts
import { ActorType, OrderChannel, OrderItemStatus, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import type { Tx } from '../common/types/transaction';

export interface FulfilmentActor {
  actor_type: ActorType;
  actor_id: string | null;
}
```
  and `actorForOrder` returns `{ actor_type: ActorType.user | ActorType.customer | ActorType.system, … }`. Delete the local `type Tx = Prisma.TransactionClient;` (line 19) and the `FulfilmentActorType` export; update `fulfilment.service.spec.ts:41` where the `as const` tuples are declared.

- [ ] `backend/src/webhooks/webhooks.service.ts` — lines 129/140 `PaymentStatus.paid`, 149/150 `OrderStatus.placed`/`OrderStatus.preparing`, 204 `OrderStatus.placed`, 222/233 `PaymentStatus.refunded`.
- [ ] `backend/src/kitchen/kds/kds.controller.ts:15` → `@IsEnum(OrderItemStatus)`; `kds.service.ts:211` `OrderStatus.ready`; `kitchen-metrics.service.ts:44` `OrderItemStatus.ready`.
- [ ] `backend/src/events/events.service.ts` — `EventStatus`/`BookingStatus` members at the sites the audit listed (282, 320, 359, 365, 380, 392, 401); `dto/update-event.dto.ts:23,57` and `dto/create-event.dto.ts:21` → `@IsEnum(EventType)` / `@IsEnum(EventStatus)`.
- [ ] `backend/src/menu/dto/upsert-channel-modifier.dto.ts` — the field is now `channel`:

```ts
import { IsEnum, IsIn, IsNumber, Min, Max } from 'class-validator';
import { OrderChannel } from '@prisma/client';

export class UpsertChannelModifierDto {
  @IsEnum(OrderChannel)
  channel!: OrderChannel;

  @IsIn(['fixed', 'percentage'])
  modifier_type!: string;

  @IsNumber()
  @Min(-100)
  @Max(1000)
  modifier_value!: number;
}
```
  Update the two lookup sites that join orders to modifiers — `backend/src/orders/orders.service.ts:74` and `backend/src/customer-orders/customer-orders.service.ts:229` — from `where: { channel_type: dto.channel, status: 'active' }` to `where: { channel: dto.channel, status: 'active' }`, and `menu.service.ts` `findModifiers`/`upsertModifier` from `channel_type` to `channel` (this file is replaced in Task 10 but must compile now).
- [ ] `backend/src/analytics/analytics.service.ts:36,87,185` — `PaymentStatus.paid`; `:262` — `QuestStatus.completed`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 53 passed, 53 total`. Spec fixtures that assert `channel_type` on `ChannelModifier` (`orders.service.spec.ts`, `customer-orders.service.spec.ts`) need the field renamed.
- [ ] `git add backend/prisma backend/src && git commit -m "feat(p2-04): commerce enums, order money columns, ChannelModifier.channel" -- backend/prisma backend/src`

---

### Task 5: `Node`, `node_id`, node-scoped uniques, timestamptz/Decimal precision, FK hygiene

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/node/node.constants.ts`, `node.service.ts`, `node.service.spec.ts`, `node.controller.ts`, `node.module.ts`, `dto/update-node.dto.ts`
- Modify: `backend/src/app.module.ts`, `backend/src/readiness/readiness.service.ts`, `backend/src/menu/menu.service.ts`, `backend/prisma/seed-reference.ts`

- [ ] Create `backend/src/node/node.constants.ts`:

```ts
/**
 * The single seeded node. `node_id` carries this as a Prisma-level @default so the
 * ~100 existing create() call sites need no edit (SPEC §1.2 makes multi-node
 * operation a non-goal for v2.0). Drop the @default when a second node is added.
 */
export const DEFAULT_NODE_ID = '11111111-1111-4111-8111-111111111111';
export const DEFAULT_NODE_CODE = 'KX-VILLA-1';
export const DEFAULT_NODE_NAME = 'Konma Xperience Villa 1';
export const DEFAULT_NODE_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_NODE_CURRENCY = 'INR';
```

- [ ] `schema.prisma` — add the `Node` model directly after the enum block:

```prisma
model Node {
  id         String     @id @default(uuid())
  code       String     @unique
  name       String
  timezone   String     @default("Asia/Kolkata")
  currency   String     @default("INR")
  status     NodeStatus @default(active)
  created_at DateTime   @default(now()) @db.Timestamptz(3)
  updated_at DateTime   @updatedAt @db.Timestamptz(3)

  zones             Zone[]
  missions          Mission[]
  quests            Quest[]
  tasks             Task[]
  readiness_meters  ReadinessMeter[]
  kpis              Kpi[]
  recipes           Recipe[]
  ingredients       Ingredient[]
  vendors           Vendor[]
  purchase_orders   PurchaseOrder[]
  prep_batches      PrepBatch[]
  waste_logs        WasteLog[]
  orders            Order[]
  events            Event[]
  brands            Brand[]
  assets            Asset[]
  decisions         Decision[]
  channel_modifiers ChannelModifier[]
}
```

- [ ] `schema.prisma` — add these **two lines** to each of `Zone`, `Mission`, `Quest`, `Task`, `ReadinessMeter`, `Kpi`, `Recipe`, `Ingredient`, `Vendor`, `PurchaseOrder`, `PrepBatch`, `WasteLog`, `Order`, `Event`, `Brand`, `Asset`, `Decision`, `ChannelModifier` (18 models). `Product*` gets it at creation in Task 9; `AuditEvent`, `ApprovalPolicy`, `ReadinessSignal`, `ReadinessSnapshot` in Tasks 6 and 8.

```prisma
  node_id    String   @default("11111111-1111-4111-8111-111111111111")
  node       Node     @relation(fields: [node_id], references: [id], onDelete: Restrict)
```

- [ ] `schema.prisma` — node-scoped uniques. On `ReadinessMeter` remove `@unique` from `code` and add `@@unique([node_id, code])`. On `ChannelModifier` replace the `@@unique([channel])` added in Task 4 with `@@unique([node_id, channel])`. `Order.order_number` stays a global `@unique` autoincrement (SPEC §3.1).
- [ ] `schema.prisma` — FK hygiene per SPEC §3.4/§3.5:
  - `RecipeLine.recipe` → `@relation("RecipeLines", fields: [recipe_id], references: [id], onDelete: Cascade)`
  - `RecipeLine.ingredient` → `@relation(fields: [ingredient_id], references: [id], onDelete: Restrict)`
  - `EventBooking.event` → `@relation(fields: [event_id], references: [id], onDelete: Restrict)` (was Cascade)
  - Delete `Approval.task Task? @relation("TaskApprovals", …)` and the matching `Task.approvals Approval[] @relation("TaskApprovals")` (SPEC §3.5). Run `grep -rn "approvals" backend/src --include=*.ts | grep -v "src/approvals/"` and rewrite any `include: { approvals: … }` on Task into an explicit `prisma.approval.findMany({ where: { entity_type: ApprovalEntityType.task, entity_id: taskId } })`.

- [ ] `schema.prisma` — timestamptz on every `DateTime`. Run this one-liner, then eyeball the diff:

```bash
cd backend && node -e "const fs=require('fs');const p='prisma/schema.prisma';let s=fs.readFileSync(p,'utf8');s=s.replace(/^(\s+\w+\s+DateTime\??)((?:\s+@[^\n]*)?)$/gm,(m,a,b)=>b.includes('@db.')?m:a+b+' @db.Timestamptz(3)');fs.writeFileSync(p,s);"
```
  Verify: `grep -c "Timestamptz(3) @db.Timestamptz" backend/prisma/schema.prisma` → `0`; `grep -c "DateTime" backend/prisma/schema.prisma` equals `grep -c "Timestamptz(3)" …` plus the one `@db.Date` on `ReadinessSnapshot` (added in Task 8, so at this point they are equal).

- [ ] `schema.prisma` — Decimal precision. Money → `@db.Decimal(12, 2)`: `Recipe.computed_cost`, `MenuItem.base_price`, `Order.subtotal`, `Order.channel_modifier_amount`, `Order.total`, `Order.discount_amount`, `Order.shipping_amount`, `Order.tax_amount`, `OrderItem.unit_price`, `Payment.amount`, `Payment.refunded_amount`, `PurchaseOrder.total_amount`, `PurchaseOrderLine.unit_cost`, `VendorPrice.price`, `WasteLog.cost_impact`, `Event.price`, `EventBooking.payment_amount`, `ChannelModifier.modifier_value`. Quantities → `@db.Decimal(14, 4)`: `Recipe.yield_qty`, `RecipeLine.quantity`, `Ingredient.min_stock_level`, `IngredientStock.current_quantity`, `StockMovement.quantity`, `StockMovement.original_quantity`, `PurchaseOrderLine.quantity`, `PurchaseOrderLine.received_quantity`, `PrepBatch.quantity_produced`, `PrepBatch.quantity_remaining`, `WasteLog.quantity`, `UnitConversion.factor`. Rate → `@db.Decimal(5, 2)`: `OrderItem.tax_rate`.
- [ ] Create `backend/src/node/node.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Node } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from './node.constants';

/**
 * Reads the node this deployment operates. v2.0 runs exactly one node, so the row
 * is cached for the process lifetime and refreshed on update.
 */
@Injectable()
export class NodeService {
  private cached: Node | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async current(): Promise<Node> {
    if (this.cached) return this.cached;
    const node =
      (await this.prisma.node.findUnique({ where: { id: DEFAULT_NODE_ID } })) ??
      (await this.prisma.node.findFirst({ orderBy: { created_at: 'asc' } }));
    if (!node) {
      throw new NotFoundException(
        'No Node row exists — run "npm run seed:reference" before starting the API',
      );
    }
    this.cached = node;
    return node;
  }

  async currentId(): Promise<string> {
    return (await this.current()).id;
  }

  async timezone(): Promise<string> {
    return (await this.current()).timezone;
  }

  async update(data: {
    name?: string;
    timezone?: string;
    currency?: string;
  }): Promise<Node> {
    const node = await this.current();
    this.cached = await this.prisma.node.update({ where: { id: node.id }, data });
    return this.cached;
  }
}
```

- [ ] Create `backend/src/node/dto/update-node.dto.ts`:

```ts
import { IsOptional, IsString, IsNotEmpty, Length } from 'class-validator';

export class UpdateNodeDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  /** IANA zone id, e.g. "Asia/Kolkata". */
  @IsOptional() @IsString() @IsNotEmpty() timezone?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
}
```

- [ ] Create `backend/src/node/node.controller.ts`:

```ts
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { NodeService } from './node.service';
import { UpdateNodeDto } from './dto/update-node.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('nodes')
export class NodeController {
  constructor(private readonly nodeService: NodeService) {}

  @Get('current')
  async current() {
    return this.nodeService.current();
  }

  @Patch('current')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async update(@Body() dto: UpdateNodeDto) {
    return this.nodeService.update(dto);
  }
}
```

- [ ] Create `backend/src/node/node.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { NodeService } from './node.service';
import { NodeController } from './node.controller';

@Global()
@Module({
  controllers: [NodeController],
  providers: [NodeService],
  exports: [NodeService],
})
export class NodeModule {}
```

- [ ] Create `backend/src/node/node.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NodeService } from './node.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from './node.constants';

const node = {
  id: DEFAULT_NODE_ID,
  code: 'KX-VILLA-1',
  name: 'Konma Xperience Villa 1',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
};

describe('NodeService', () => {
  let service: NodeService;
  let prisma: {
    node: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      node: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [NodeService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(NodeService);
  });

  it('returns the default node and caches it', async () => {
    prisma.node.findUnique.mockResolvedValue(node);
    expect(await service.currentId()).toBe(DEFAULT_NODE_ID);
    expect(await service.timezone()).toBe('Asia/Kolkata');
    expect(prisma.node.findUnique).toHaveBeenCalledTimes(1);
  });

  it('falls back to the oldest node when the default id is absent', async () => {
    prisma.node.findUnique.mockResolvedValue(null);
    prisma.node.findFirst.mockResolvedValue({ ...node, id: 'other' });
    expect(await service.currentId()).toBe('other');
  });

  it('throws when no node is seeded', async () => {
    prisma.node.findUnique.mockResolvedValue(null);
    prisma.node.findFirst.mockResolvedValue(null);
    await expect(service.current()).rejects.toThrow(NotFoundException);
  });

  it('update refreshes the cache', async () => {
    prisma.node.findUnique.mockResolvedValue(node);
    prisma.node.update.mockResolvedValue({ ...node, timezone: 'Asia/Dubai' });
    await service.update({ timezone: 'Asia/Dubai' });
    expect(await service.timezone()).toBe('Asia/Dubai');
  });
});
```

- [ ] `backend/src/app.module.ts` — add `NodeModule` to `imports[]` beside `PrismaModule`.
- [ ] Fix the two composite-unique call sites. `backend/src/readiness/readiness.service.ts`: inject `NodeService` and turn every `where: { code }` on `readinessMeter` into `where: { node_id_code: { node_id: await this.nodeService.currentId(), code } }`. `backend/src/menu/menu.service.ts` `upsertModifier`: `where: { node_id_channel: { node_id: DEFAULT_NODE_ID, channel: dto.channel } }`.
- [ ] `backend/prisma/seed-reference.ts` — make the meter upsert node-scoped (the full seed rewrite is Task 14; this only keeps it compiling):

```ts
      for (const meter of READINESS_METERS) {
        const data = { name: meter.name, description: meter.description };
        await tx.readinessMeter.upsert({
          where: { node_id_code: { node_id: DEFAULT_NODE_ID, code: meter.code } },
          update: data,
          create: { node_id: DEFAULT_NODE_ID, code: meter.code, ...data },
        });
      }
```

- [ ] `cd backend && npx prisma validate && npx prisma generate` — expect `valid` and `Generated Prisma Client`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 54 passed, 54 total`.
- [ ] `git add backend/prisma backend/src && git commit -m "feat(p2-05): Node model, node_id everywhere, timestamptz and Decimal precision" -- backend/prisma backend/src`

---

### Task 6: `AuditEvent` + `AuditService.record(tx, …)` in the status-changing transactions

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/audit/audit.service.ts`, `audit.service.spec.ts`, `audit.controller.ts`, `audit.module.ts`
- Modify: `backend/src/app.module.ts`, `backend/src/tasks/tasks.service.ts`, `backend/src/orders/orders.service.ts`, `backend/src/orders/orders.controller.ts`, `backend/src/purchase-orders/purchase-orders.service.ts`, `backend/src/purchase-orders/purchase-orders.controller.ts`, `backend/src/recipes/recipes.service.ts`, `backend/src/approvals/approvals.service.ts`, `backend/src/fulfilment/fulfilment.service.ts`
- Modify: the matching `*.spec.ts` provider lists

- [ ] `schema.prisma` — add after `Node`:

```prisma
model AuditEvent {
  id          String    @id @default(uuid())
  node_id     String    @default("11111111-1111-4111-8111-111111111111")
  node        Node      @relation(fields: [node_id], references: [id], onDelete: Restrict)
  entity_type String
  entity_id   String
  action      String
  actor_type  ActorType @default(system)
  actor_id    String?
  before      Json?
  after       Json?
  created_at  DateTime  @default(now()) @db.Timestamptz(3)

  @@index([entity_type, entity_id, created_at])
  @@index([node_id, created_at(sort: Desc)])
}
```
  and add `audit_events AuditEvent[]` to `Node`.

- [ ] Create `backend/src/audit/audit.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Tx } from '../common/types/transaction';
import { DEFAULT_NODE_ID } from '../node/node.constants';

export interface AuditInput {
  entity_type: string;
  entity_id: string;
  /** Dot-namespaced verb, e.g. "task.status_changed", "order.status_changed". */
  action: string;
  actor_type: ActorType;
  actor_id?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  node_id?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes one AuditEvent inside the caller's transaction (SPEC §3: "every mutating
   * write in a transaction also writes AuditEvent"). `tx` MUST be the transaction
   * client so the audit row rolls back with the change it describes.
   */
  async record(tx: Tx, input: AuditInput): Promise<void> {
    await tx.auditEvent.create({
      data: {
        node_id: input.node_id ?? DEFAULT_NODE_ID,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action: input.action,
        actor_type: input.actor_type,
        actor_id: input.actor_id ?? null,
        before: input.before ?? Prisma.JsonNull,
        after: input.after ?? Prisma.JsonNull,
      },
    });
  }

  /** Actor tuple for a staff-initiated change; falls back to a system actor. */
  static user(userId: string | null | undefined): {
    actor_type: ActorType;
    actor_id: string | null;
  } {
    return userId
      ? { actor_type: ActorType.user, actor_id: userId }
      : { actor_type: ActorType.system, actor_id: null };
  }

  /** Actor tuple for a storefront-initiated change. */
  static customer(customerId: string): {
    actor_type: ActorType;
    actor_id: string;
  } {
    return { actor_type: ActorType.customer, actor_id: customerId };
  }

  async list(entityType?: string, entityId?: string, limit = 50, cursor?: string) {
    const take = Math.min(Number(limit) || 50, 200);
    return this.prisma.auditEvent.findMany({
      where: {
        ...(entityType ? { entity_type: entityType } : {}),
        ...(entityId ? { entity_id: entityId } : {}),
      },
      orderBy: { created_at: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }
}
```

- [ ] Create `backend/src/audit/audit.controller.ts`:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async list(
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.auditService.list(entityType, entityId, Number(limit) || 50, cursor);
  }
}
```

- [ ] Create `backend/src/audit/audit.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
```

- [ ] Create `backend/src/audit/audit.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ActorType, Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from '../node/node.constants';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditEvent: { create: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      auditEvent: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  it('writes through the transaction client, not this.prisma', async () => {
    const tx = { auditEvent: { create: jest.fn() } };
    await service.record(tx as never, {
      entity_type: 'task',
      entity_id: 't-1',
      action: 'task.status_changed',
      ...AuditService.user('u-1'),
      before: { status: 'todo' },
      after: { status: 'done' },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        node_id: DEFAULT_NODE_ID,
        entity_type: 'task',
        entity_id: 't-1',
        action: 'task.status_changed',
        actor_type: ActorType.user,
        actor_id: 'u-1',
      }),
    });
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('missing before/after become Prisma.JsonNull and actor_id null', async () => {
    const tx = { auditEvent: { create: jest.fn() } };
    await service.record(tx as never, {
      entity_type: 'order',
      entity_id: 'o-1',
      action: 'order.created',
      ...AuditService.user(null),
    });
    const data = tx.auditEvent.create.mock.calls[0][0].data;
    expect(data.before).toBe(Prisma.JsonNull);
    expect(data.actor_type).toBe(ActorType.system);
    expect(data.actor_id).toBeNull();
  });

  it('customer actor tuple', () => {
    expect(AuditService.customer('c-1')).toEqual({
      actor_type: ActorType.customer,
      actor_id: 'c-1',
    });
  });

  it('list caps limit at 200 and applies the entity filter', async () => {
    await service.list('task', 't-1', 5000);
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 200,
        where: { entity_type: 'task', entity_id: 't-1' },
      }),
    );
  });
});
```

- [ ] `cd backend && npx jest src/audit --silent` — expect `Tests: 4 passed, 4 total`.
- [ ] `backend/src/app.module.ts` — add `AuditModule` to `imports[]`.
- [ ] Wire the five status-changing transactions. `AuditModule` is `@Global()`, so each service only injects `private readonly auditService: AuditService`; each touched spec gains `{ provide: AuditService, useValue: { record: jest.fn() } }` in its providers.

  **a. `backend/src/tasks/tasks.service.ts`** — inside the `update` transaction (line 197), reusing the `statusChanged` flag computed at 195-196:

```ts
        if (statusChanged) {
          await this.auditService.record(tx, {
            entity_type: 'task',
            entity_id: id,
            action: 'task.status_changed',
            ...AuditService.user(requestingUser.id),
            before: { status: existing.status },
            after: { status: updated.status },
          });
        }
```
  and the same call with `action: 'task.blocked'` (before `{ status: existing.status }`, after `{ status: TaskStatus.blocked, blocked_reason: reason }`) inside `block` (line 264), and `action: 'task.unblocked'` inside `unblock` (line 323).

  **b. `backend/src/orders/orders.service.ts`** — `updateOrderStatus` has **no** transaction today (bare optimistic `updateMany`). Replace the whole method:

```ts
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string | null,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, customer_id: true, order_number: true },
    });
    if (!order) throw new NotFoundException(`Order with ID ${orderId} not found`);

    if (newStatus === OrderStatus.cancelled) {
      if (TERMINAL_STATUSES.includes(order.status)) {
        throw new BadRequestException(
          `Cannot cancel order in "${order.status}" status`,
        );
      }
    } else {
      const allowed = STATUS_TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from "${order.status}" to "${newStatus}". ` +
            `Valid transitions: ${allowed.join(', ') || 'none'}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: newStatus, updated_by: userId },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'Order status was changed by another request. Please retry.',
        );
      }
      await this.auditService.record(tx, {
        entity_type: 'order',
        entity_id: orderId,
        action: 'order.status_changed',
        ...AuditService.user(userId),
        before: { status: order.status },
        after: { status: newStatus },
      });
    });

    if (order.customer_id) {
      this.pusherService
        .trigger(`private-customer-${order.customer_id}`, 'order.status-changed', {
          orderId: order.id,
          orderNumber: order.order_number,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        })
        .catch((err) => console.error('[Pusher] Status trigger error:', err));
    }

    return this.prisma.order.findUnique({ where: { id: orderId } });
  }
```
  Also record `action: 'order.created'` inside `createOrder`'s existing transaction, right after `tx.order.create`.

  **c. `backend/src/fulfilment/fulfilment.service.ts`** — inside `confirmPaidOrder`'s transaction, after `applyPrepTypeOnCreate`:

```ts
          await this.auditService.record(tx, {
            entity_type: 'order',
            entity_id: created.id,
            action: 'order.confirmed',
            ...AuditService.customer(customerId),
            after: {
              status: OrderStatus.placed,
              razorpay_payment_id: input.razorpayPaymentId,
              total: String(pending.total),
            },
          });
```

  **d. `backend/src/purchase-orders/purchase-orders.service.ts`** — inside `receivePurchaseOrder`'s transaction (line 122), after the PO status update:

```ts
      await this.auditService.record(tx, {
        entity_type: 'purchase_order',
        entity_id: poId,
        action: 'purchase_order.received',
        ...AuditService.user(userId),
        before: { status: po.status },
        after: { status: PurchaseOrderStatus.received, lines: dto.lines.length },
      });
```
  `update` (line 88) and `cancel` (line 255) have no transaction and no `userId`: change their signatures to `update(id, data, userId: string)` and `cancel(id, userId: string)`, wrap each body in `this.prisma.$transaction(async (tx) => …)`, thread `@CurrentUser() user` from `purchase-orders.controller.ts`, and record `'purchase_order.status_changed'` / `'purchase_order.cancelled'`.

  **e. `backend/src/recipes/recipes.service.ts`** — inside the `update` transaction (line 212), when `dto.status` differs from `current.status`:

```ts
        await this.auditService.record(tx, {
          entity_type: 'recipe',
          entity_id: id,
          action: 'recipe.status_changed',
          ...AuditService.user(userId),
          before: { status: current.status, version: current.version },
          after: { status: dto.status, version: current.version },
        });
```
  and `action: 'recipe.version_created'` inside `createNewVersion` (line 295).

  **f. `backend/src/approvals/approvals.service.ts`** — both transactions use `async (tx: any)`; retype them `async (tx: Tx)` with the new `../common/types/transaction` alias, then record inside `approveWithDelegation`:

```ts
      await this.auditService.record(tx, {
        entity_type: 'approval',
        entity_id: approvalId,
        action: 'approval.decided',
        ...AuditService.user(actingUserId),
        before: { status: ApprovalStatus.pending },
        after: {
          status: ApprovalStatus.approved,
          delegated_from: delegatedFromUserId ?? null,
        },
      });
```
  and inside `overrideApproval`, `action: 'approval.overridden'` with `after: { status: ApprovalStatus.approved, override_reason: reason }`.

- [ ] `backend/src/orders/orders.controller.ts` — thread the actor:

```ts
  @Patch(':id/status')
  @RequiresPermission(Permission.MANAGE_POS)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.ordersService.updateOrderStatus(id, dto.status, user.id);
  }
```

- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest src/audit src/tasks src/orders src/purchase-orders src/recipes src/approvals src/fulfilment --silent` — expect all suites `PASS`.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 55 passed, 55 total`.
- [ ] `git add backend/prisma/schema.prisma backend/src && git commit -m "feat(p2-06): AuditEvent model, AuditService.record and the five status transactions" -- backend/prisma/schema.prisma backend/src`

---

### Task 7: `SystemSetting.value` → Json with a typed `SettingsService.get<T>` + `ModuleAccess`

**Files:**
- Modify: `backend/prisma/schema.prisma`, `backend/src/settings/settings.service.ts`, `settings.controller.ts`, `settings.service.spec.ts`, `backend/src/fulfilment/fulfilment.service.ts`, `backend/src/leaderboard/leaderboard.service.ts`, `backend/src/app.module.ts`
- Create: `backend/src/module-access/module-access.service.ts`, `module-access.controller.ts`, `module-access.module.ts`

- [ ] `schema.prisma`:

```prisma
model SystemSetting {
  key        String   @id
  value      Json
  updated_at DateTime @updatedAt @db.Timestamptz(3)
}

model ModuleAccess {
  module_key String   @id
  role_codes String[]
  enabled    Boolean  @default(true)
  sort_order Int      @default(0)
  updated_at DateTime @updatedAt @db.Timestamptz(3)

  @@index([sort_order])
}
```

- [ ] Replace `backend/src/settings/settings.service.ts` wholesale:

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Allow-listed settings keys with their defaults. `SystemSetting.value` is Json
 * (SPEC §3.1), so a key may hold a scalar, an object or an array; the default
 * doubles as the shape contract and as the fallback when the row is absent.
 */
export const SETTING_DEFAULTS = {
  leaderboard_enabled: true as boolean,
  system_name: 'Konma Xperience OS' as string,
  maintenance_mode: false as boolean,
  marketplace_fulfilment_zone_id: null as string | null,
  xp_rules: {
    core: 1.0,
    adhoc: 0.7,
    improvement: 0.8,
    level_curve: [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000],
  },
  delivery_pincodes: [] as string[],
  shipping: {
    provider: 'manual' as 'shiprocket' | 'manual',
    pickup_location_code: '',
    default_weight_grams: 500,
    default_dimensions_cm: { length: 20, breadth: 15, height: 10 },
  },
  loyalty: {
    earn_rate_per_100: 5,
    redeem_value_per_point: 0.25,
    tiers: { member: 0, regular: 500, insider: 2000 },
  },
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateKey(key: string): asserts key is SettingKey {
    if (!SETTING_KEYS.includes(key as SettingKey)) {
      throw new BadRequestException(
        `Invalid setting key: ${key}. Allowed: ${SETTING_KEYS.join(', ')}`,
      );
    }
  }

  /** Typed read with the declared default as fallback — never throws on a missing row. */
  async get<K extends SettingKey>(key: K): Promise<(typeof SETTING_DEFAULTS)[K]> {
    this.validateKey(key);
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!row || row.value === null) return SETTING_DEFAULTS[key];
    return row.value as (typeof SETTING_DEFAULTS)[K];
  }

  /** Raw row read for the admin screen; still throws when the row is absent. */
  async getSetting(key: string) {
    this.validateKey(key);
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting with key "${key}" not found`);
    return setting;
  }

  async updateSetting(key: string, value: Prisma.InputJsonValue) {
    this.validateKey(key);
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
```

- [ ] Replace `backend/src/settings/settings.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsDefined } from 'class-validator';
import { Prisma } from '@prisma/client';
import { SettingsService } from './settings.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

export class UpdateSettingDto {
  @IsDefined()
  value!: Prisma.InputJsonValue;
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':key')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async getSetting(@Param('key') key: string) {
    return this.settingsService.getSetting(key);
  }

  @Patch(':key')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async updateSetting(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settingsService.updateSetting(key, dto.value);
  }
}
```

- [ ] `backend/src/fulfilment/fulfilment.service.ts` — `resolveMarketplaceZoneId` now reads a Json value:

```ts
    const setting = await tx.systemSetting.findUnique({
      where: { key: MARKETPLACE_ZONE_SETTING_KEY },
    });
    const configuredZoneId =
      typeof setting?.value === 'string' ? setting.value : null;
    if (configuredZoneId) {
      const zone = await tx.zone.findUnique({
        where: { id: configuredZoneId },
        select: { id: true },
      });
      if (zone) return zone.id;
    }
```

- [ ] `backend/src/leaderboard/leaderboard.service.ts:11` — inject `SettingsService`, replace the direct Prisma read and the `=== 'true'` comparison with `const enabled = await this.settingsService.get('leaderboard_enabled');`. Add `SettingsService` to `leaderboard.service.spec.ts` providers as `{ provide: SettingsService, useValue: { get: jest.fn().mockResolvedValue(true) } }` and import `SettingsModule` in `leaderboard.module.ts`.
- [ ] `backend/src/settings/settings.service.spec.ts` — replace the string-value assertions with these:

```ts
    it('get returns the declared default when the row is absent', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);
      await expect(service.get('leaderboard_enabled')).resolves.toBe(true);
      await expect(service.get('delivery_pincodes')).resolves.toEqual([]);
    });

    it('get returns the stored JSON object', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'xp_rules',
        value: { core: 1, adhoc: 0.5, improvement: 0.9, level_curve: [0, 10] },
        updated_at: new Date(),
      });
      await expect(service.get('xp_rules')).resolves.toMatchObject({ adhoc: 0.5 });
    });

    it('rejects an unknown key', async () => {
      await expect(service.get('nope' as never)).rejects.toThrow(BadRequestException);
    });

    it('updateSetting upserts a JSON value', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({ key: 'shipping', value: {} });
      await service.updateSetting('shipping', { provider: 'shiprocket' });
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { key: 'shipping', value: { provider: 'shiprocket' } },
        }),
      );
    });
```

- [ ] Create `backend/src/module-access/module-access.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModuleAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** All modules, ordered for the navigation spine (SPEC §6.2). */
  async findAll() {
    return this.prisma.moduleAccess.findMany({
      orderBy: [{ sort_order: 'asc' }, { module_key: 'asc' }],
    });
  }

  /** Module keys this role may see — the data behind SPEC §6.3. */
  async forRole(roleCode: string): Promise<string[]> {
    const rows = await this.prisma.moduleAccess.findMany({
      where: { enabled: true, role_codes: { has: roleCode } },
      orderBy: [{ sort_order: 'asc' }],
      select: { module_key: true },
    });
    return rows.map((r) => r.module_key);
  }

  async update(
    moduleKey: string,
    data: { role_codes?: string[]; enabled?: boolean; sort_order?: number },
  ) {
    const existing = await this.prisma.moduleAccess.findUnique({
      where: { module_key: moduleKey },
    });
    if (!existing) throw new NotFoundException(`Module "${moduleKey}" not found`);
    return this.prisma.moduleAccess.update({
      where: { module_key: moduleKey },
      data,
    });
  }
}
```

- [ ] Create `backend/src/module-access/module-access.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ModuleAccessService } from './module-access.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

export class UpdateModuleAccessDto {
  @IsOptional() @IsArray() @IsString({ each: true }) role_codes?: string[];
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) sort_order?: number;
}

@Controller('modules')
export class ModuleAccessController {
  constructor(private readonly moduleAccessService: ModuleAccessService) {}

  @Get()
  async findAll() {
    return this.moduleAccessService.findAll();
  }

  @Get('mine')
  async mine(@CurrentUser() user: { roleCode: string }) {
    return this.moduleAccessService.forRole(user.roleCode);
  }

  @Patch(':key')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async update(@Param('key') key: string, @Body() dto: UpdateModuleAccessDto) {
    return this.moduleAccessService.update(key, dto);
  }
}
```
  Check the decorator's real export name first: `grep -rn "export const CurrentUser" backend/src/common/decorators/` and use whatever path/name it reports.

- [ ] Create `backend/src/module-access/module-access.module.ts` (standard `@Module` exporting `ModuleAccessService`) and register `ModuleAccessModule` in `app.module.ts`. **No UI in P2** — `/admin/modules` is P4.
- [ ] `cd backend && npx prisma generate && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest src/settings src/leaderboard src/fulfilment --silent` — expect all `PASS`.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 55 passed, 55 total`.
- [ ] `git add backend/prisma/schema.prisma backend/src && git commit -m "feat(p2-07): JSON SystemSetting with typed getter, ModuleAccess model and API" -- backend/prisma/schema.prisma backend/src`

---

### Task 8: Governance and readiness groundwork models

`ApprovalPolicy`, `DecisionVote`, `ReadinessMeter.mode/formula_key`, `ReadinessSignal`, `ReadinessSnapshot`. **Enforcement is P3** — this task adds models and relations only.

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] `schema.prisma` — extend `ReadinessMeter`:

```prisma
  mode          MeterMode           @default(task_driven)
  formula_key   String?
  signals       ReadinessSignal[]
  snapshots     ReadinessSnapshot[]
```

- [ ] `schema.prisma` — new models:

```prisma
model ApprovalPolicy {
  id                  String        @id @default(uuid())
  node_id             String        @default("11111111-1111-4111-8111-111111111111")
  node                Node          @relation(fields: [node_id], references: [id], onDelete: Restrict)
  scope               ApprovalScope
  domain              TaskDomain?
  required_role_codes String[]
  min_approvals       Int           @default(1)
  mode                ApprovalMode  @default(all)
  is_default          Boolean       @default(false)
  created_at          DateTime      @default(now()) @db.Timestamptz(3)
  updated_at          DateTime      @updatedAt @db.Timestamptz(3)
  approvals           Approval[]

  @@unique([node_id, scope, domain])
  @@index([node_id, is_default])
}

model DecisionVote {
  id          String    @id @default(uuid())
  decision_id String
  decision    Decision  @relation(fields: [decision_id], references: [id], onDelete: Cascade)
  user_id     String
  user        User      @relation("DecisionVoter", fields: [user_id], references: [id])
  role_code   String
  vote        VoteValue
  notes       String?
  created_at  DateTime  @default(now()) @db.Timestamptz(3)

  @@unique([decision_id, user_id])
  @@index([decision_id])
}

model ReadinessSignal {
  id           String         @id @default(uuid())
  node_id      String         @default("11111111-1111-4111-8111-111111111111")
  node         Node           @relation(fields: [node_id], references: [id], onDelete: Restrict)
  meter_id     String
  meter        ReadinessMeter @relation(fields: [meter_id], references: [id], onDelete: Cascade)
  source_event String
  source_type  String
  source_id    String
  value        Decimal        @db.Decimal(14, 4)
  created_at   DateTime       @default(now()) @db.Timestamptz(3)

  @@index([meter_id, created_at(sort: Desc)])
  @@index([source_type, source_id])
}

model ReadinessSnapshot {
  id       String         @id @default(uuid())
  node_id  String         @default("11111111-1111-4111-8111-111111111111")
  node     Node           @relation(fields: [node_id], references: [id], onDelete: Restrict)
  meter_id String
  meter    ReadinessMeter @relation(fields: [meter_id], references: [id], onDelete: Cascade)
  date     DateTime       @db.Date
  value    Decimal        @db.Decimal(6, 2)

  @@unique([meter_id, date])
  @@index([node_id, date])
}
```

- [ ] `schema.prisma` — back-relations: on `Node` add `approval_policies ApprovalPolicy[]`, `readiness_signals ReadinessSignal[]`, `readiness_snapshots ReadinessSnapshot[]`; on `Decision` add `votes DecisionVote[]`; on `User` add `decision_votes DecisionVote[] @relation("DecisionVoter")`; on `Approval` add `policy_id String?` and `policy ApprovalPolicy? @relation(fields: [policy_id], references: [id], onDelete: SetNull)`.
- [ ] `cd backend && npx prisma validate && npx prisma generate` — expect valid + generated.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output (nothing consumes the new models yet).
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 55 passed, 55 total`.
- [ ] `git add backend/prisma/schema.prisma && git commit -m "feat(p2-08): ApprovalPolicy, DecisionVote, ReadinessSignal/Snapshot, meter mode" -- backend/prisma/schema.prisma`

---

### Task 9: `Product`, `ProductCategory`, `ProductVariant`, `ProductMedia` (added alongside `MenuItem`)

Additive only — `MenuItem`/`MenuCategory` stay until Task 11, so the backend keeps compiling.

**Files:** Modify `backend/prisma/schema.prisma`.

- [ ] Add the four models:

```prisma
model ProductCategory {
  id            String        @id @default(uuid())
  node_id       String        @default("11111111-1111-4111-8111-111111111111")
  node          Node          @relation(fields: [node_id], references: [id], onDelete: Restrict)
  brand_id      String
  brand         Brand         @relation(fields: [brand_id], references: [id])
  name          String
  slug          String
  sort_order    Int           @default(0)
  product_types ProductType[] @default([])
  status        ProductStatus @default(active)
  created_at    DateTime      @default(now()) @db.Timestamptz(3)
  updated_at    DateTime      @updatedAt @db.Timestamptz(3)
  products      Product[]

  @@unique([node_id, slug])
  @@index([brand_id])
}

model Product {
  id                String          @id @default(uuid())
  node_id           String          @default("11111111-1111-4111-8111-111111111111")
  node              Node            @relation(fields: [node_id], references: [id], onDelete: Restrict)
  brand_id          String
  brand             Brand           @relation(fields: [brand_id], references: [id])
  category_id       String
  category          ProductCategory @relation(fields: [category_id], references: [id])
  type              ProductType
  name              String
  slug              String
  description       String          @default("")
  story             String?
  base_price        Decimal         @db.Decimal(12, 2)
  tax_rate          Decimal         @default(0) @db.Decimal(5, 2)
  hsn_code          String?
  fulfilment        FulfilmentType  @default(local)
  stock_mode        StockMode       @default(derived_from_recipe)
  recipe_id         String?
  recipe            Recipe?         @relation(fields: [recipe_id], references: [id], onDelete: Restrict)
  event_id          String?
  event             Event?          @relation(fields: [event_id], references: [id], onDelete: Restrict)
  weight_grams      Int?
  dimensions_cm     Json?
  shelf_life_days   Int?
  is_featured       Boolean         @default(false)
  rating_avg        Decimal?        @db.Decimal(3, 2)
  rating_count      Int             @default(0)
  status            ProductStatus   @default(draft)
  search_text       String          @default("")
  created_by        String?
  updated_by        String?
  created_at        DateTime        @default(now()) @db.Timestamptz(3)
  updated_at        DateTime        @updatedAt @db.Timestamptz(3)
  variants          ProductVariant[]
  media             ProductMedia[]
  orderItems        OrderItem[]

  @@unique([node_id, slug])
  @@index([node_id, type, status])
  @@index([category_id])
  @@index([recipe_id])
}

model ProductVariant {
  id                  String        @id @default(uuid())
  product_id          String
  product             Product       @relation(fields: [product_id], references: [id], onDelete: Cascade)
  name                String
  sku                 String        @unique
  price_delta         Decimal       @default(0) @db.Decimal(12, 2)
  stock_on_hand       Decimal       @default(0) @db.Decimal(14, 4)
  low_stock_threshold Decimal?      @db.Decimal(14, 4)
  is_default          Boolean       @default(false)
  status              ProductStatus @default(active)
  created_at          DateTime      @default(now()) @db.Timestamptz(3)
  updated_at          DateTime      @updatedAt @db.Timestamptz(3)
  orderItems          OrderItem[]

  @@index([product_id])
}

model ProductMedia {
  id         String    @id @default(uuid())
  product_id String
  product    Product   @relation(fields: [product_id], references: [id], onDelete: Cascade)
  url        String
  alt        String    @default("")
  sort_order Int       @default(0)
  kind       MediaKind @default(image)

  @@index([product_id, sort_order])
}
```

- [ ] Add the back-relations: on `Node` → `products Product[]`, `product_categories ProductCategory[]`; on `Brand` → `products Product[]`, `product_categories ProductCategory[]`; on `Recipe` → `products Product[]`; on `Event` → `products Product[]`.
- [ ] `OrderItem` — add the nullable product columns beside the existing `menu_item_id` (made required and `menu_item_id` dropped in Task 11):

```prisma
  product_id   String?
  product      Product?        @relation(fields: [product_id], references: [id])
  variant_id   String?
  variant      ProductVariant? @relation(fields: [variant_id], references: [id])

  @@index([product_id])
```

- [ ] `cd backend && npx prisma validate && npx prisma generate && npx tsc --noEmit -p tsconfig.build.json` — expect valid, generated, no TS output.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 55 passed, 55 total`.
- [ ] `git add backend/prisma/schema.prisma && git commit -m "feat(p2-09): Product, ProductCategory, ProductVariant, ProductMedia models" -- backend/prisma/schema.prisma`

---

### Task 10: `catalog` module replaces the `menu` module

`CatalogService` is `MenuService` rewritten against `Product`, keeping the availability arithmetic (`computeServings`/`lineStockQty`/`servingsFromStock`) intact — those three private methods are copied **verbatim** from `menu.service.ts:297-441` with `menuItem` renamed to `product` and `menuItem.available && menuItem.status === 'active'` replaced by `product.status === ProductStatus.active`. `CatalogController` serves `/catalog/*` and re-declares the same read routes under `/menu/*` (SPEC-compat aliases for external callers).

**Files:**
- Create: `backend/src/catalog/catalog.service.ts`, `catalog.service.spec.ts`, `catalog.controller.ts`, `catalog.module.ts`, `dto/create-product-category.dto.ts`, `dto/update-product-category.dto.ts`, `dto/create-product.dto.ts`, `dto/update-product.dto.ts`, `dto/upsert-product-variant.dto.ts`, `dto/upsert-channel-modifier.dto.ts`
- Delete: `backend/src/menu/` (entire directory, 9 files)
- Modify: `backend/src/app.module.ts`, `backend/src/exports/exports.module.ts`, `backend/src/exports/builders/menu.builder.ts` (renamed `products.builder.ts`), `backend/src/exports/export-types.ts`

- [ ] Move the five menu DTOs into `backend/src/catalog/dto/` renaming class + fields. `create-product.dto.ts`:

```ts
import {
  IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Min,
} from 'class-validator';
import { FulfilmentType, ProductStatus, ProductType, StockMode } from '@prisma/client';

export class CreateProductDto {
  @IsUUID() brand_id!: string;
  @IsUUID() category_id!: string;
  @IsEnum(ProductType) type!: ProductType;
  @IsString() @IsNotEmpty() name!: string;
  /** lowercase kebab; unique per node */
  @IsString() @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) slug!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() story?: string;
  @IsNumber() @Min(0.01) base_price!: number;
  @IsOptional() @IsNumber() @Min(0) tax_rate?: number;
  @IsOptional() @IsString() hsn_code?: string;
  @IsEnum(FulfilmentType) fulfilment!: FulfilmentType;
  @IsEnum(StockMode) stock_mode!: StockMode;
  @IsOptional() @IsUUID() recipe_id?: string;
  @IsOptional() @IsUUID() event_id?: string;
  @IsOptional() @IsInt() @Min(0) weight_grams?: number;
  @IsOptional() @IsInt() @Min(0) shelf_life_days?: number;
  @IsOptional() @IsBoolean() is_featured?: boolean;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}
```
  `update-product.dto.ts` is the same with every field `@IsOptional()`. `create-product-category.dto.ts` carries `name`, `slug`, `brand_id`, `sort_order?`, `product_types?: ProductType[]` (`@IsEnum(ProductType, { each: true })`); the update variant adds `status?: ProductStatus`. `upsert-product-variant.dto.ts` carries `product_id`, `name`, `sku`, `price_delta?`, `stock_on_hand?`, `low_stock_threshold?`, `is_default?`, `status?`. `upsert-channel-modifier.dto.ts` moves across unchanged from Task 4.

- [ ] Create `backend/src/catalog/catalog.service.ts` — the parts that differ from `menu.service.ts`:

```ts
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderChannel, ProductStatus, ProductType, RecipeStatus, StockMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { convertUnit } from '../common/utils/unit-conversion';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { UpsertProductVariantDto } from './dto/upsert-product-variant.dto';
import { UpsertChannelModifierDto } from './dto/upsert-channel-modifier.dto';

/** Public storefront shape — never selects cost, yield, BOM or margin fields (SPEC §8). */
const PUBLIC_INCLUDE = {
  media: { orderBy: { sort_order: 'asc' as const } },
  variants: {
    where: { status: ProductStatus.active },
    select: { id: true, name: true, sku: true, price_delta: true, is_default: true },
  },
  category: { select: { id: true, name: true, slug: true, brand_id: true } },
  recipe: { select: { id: true, preparation_type: true } },
  event: { select: { id: true, date: true, capacity: true } },
};

/** Staff shape — adds recipe cost/yield and variant stock for ops screens and POS. */
const STAFF_INCLUDE = {
  media: { orderBy: { sort_order: 'asc' as const } },
  variants: true,
  category: { select: { id: true, name: true, slug: true, brand_id: true } },
  recipe: {
    select: { id: true, name: true, computed_cost: true, yield_qty: true, preparation_type: true },
  },
  event: { select: { id: true, date: true, capacity: true } },
};

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Categories ────────────────────────────────────────────────────────────
  async findCategories(brandId?: string) {
    return this.prisma.productCategory.findMany({
      where: { ...(brandId ? { brand_id: brandId } : {}) },
      include: { _count: { select: { products: true } } },
      orderBy: { sort_order: 'asc' },
    });
  }

  async createCategory(dto: CreateProductCategoryDto) {
    return this.prisma.productCategory.create({ data: { ...dto, node_id: DEFAULT_NODE_ID } });
  }

  async updateCategory(id: string, dto: UpdateProductCategoryDto) {
    await this.getCategoryOrThrow(id);
    return this.prisma.productCategory.update({ where: { id }, data: { ...dto } });
  }

  /** Archives the category's products rather than deleting them — orders reference products. */
  async removeCategory(id: string) {
    await this.getCategoryOrThrow(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { category_id: id },
        data: { status: ProductStatus.archived },
      });
      return tx.productCategory.update({
        where: { id },
        data: { status: ProductStatus.archived },
      });
    });
  }

  private async getCategoryOrThrow(id: string) {
    const existing = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product category with ID ${id} not found`);
    return existing;
  }

  // ── Products ──────────────────────────────────────────────────────────────
  private listArgs(categoryId?: string, brandId?: string, type?: ProductType, page?: number, limit?: number) {
    const take = Math.min(Number(limit) || 50, 200);
    return {
      where: {
        ...(categoryId ? { category_id: categoryId } : {}),
        ...(brandId ? { brand_id: brandId } : {}),
        ...(type ? { type } : {}),
      },
      take,
      skip: ((Number(page) || 1) - 1) * take,
      orderBy: { name: 'asc' as const },
    };
  }

  async findProductsPublic(categoryId?: string, brandId?: string, type?: ProductType, page?: number, limit?: number) {
    const args = this.listArgs(categoryId, brandId, type, page, limit);
    return this.prisma.product.findMany({
      ...args,
      where: { ...args.where, status: ProductStatus.active },
      include: PUBLIC_INCLUDE,
    });
  }

  async findProductsStaff(categoryId?: string, brandId?: string, type?: ProductType, page?: number, limit?: number) {
    return this.prisma.product.findMany({
      ...this.listArgs(categoryId, brandId, type, page, limit),
      include: STAFF_INCLUDE,
    });
  }

  async findProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { node_id_slug: { node_id: DEFAULT_NODE_ID, slug } },
      include: PUBLIC_INCLUDE,
    });
    if (!product || product.status !== ProductStatus.active) {
      throw new NotFoundException(`Product "${slug}" not found`);
    }
    return product;
  }

  /** Postgres full-text search over Product.search_text (GIN index + trigger, Task 15). */
  async search(q: string, type?: ProductType, limit = 20) {
    if (!q.trim()) return [];
    return this.prisma.$queryRaw`
      SELECT p.id, p.name, p.slug, p.type, p.base_price
      FROM "Product" p
      WHERE p.status = 'active'
        AND (${type ?? null}::text IS NULL OR p.type::text = ${type ?? null})
        AND to_tsvector('simple', p.search_text) @@ plainto_tsquery('simple', ${q})
      ORDER BY ts_rank(to_tsvector('simple', p.search_text), plainto_tsquery('simple', ${q})) DESC
      LIMIT ${Math.min(limit, 50)}`;
  }

  async createProduct(dto: CreateProductDto, userId: string) {
    await this.assertRecipeUsable(dto.type, dto.recipe_id);
    return this.prisma.product.create({
      data: { ...dto, node_id: DEFAULT_NODE_ID, created_by: userId, updated_by: userId },
      include: STAFF_INCLUDE,
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto, userId: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Product with ID ${id} not found`);
    if (dto.recipe_id !== undefined) {
      await this.assertRecipeUsable(dto.type ?? existing.type, dto.recipe_id);
    }
    return this.prisma.product.update({
      where: { id },
      data: { ...dto, updated_by: userId },
      include: STAFF_INCLUDE,
    });
  }

  /** Publish/unpublish — SPEC §9 `catalog/products/:id/publish`. */
  async setStatus(id: string, status: ProductStatus, userId: string) {
    return this.prisma.product.update({
      where: { id },
      data: { status, updated_by: userId },
      include: STAFF_INCLUDE,
    });
  }

  /** Archives rather than deletes: OrderItem.product_id is a hard FK. */
  async archiveProduct(id: string, userId: string) {
    return this.setStatus(id, ProductStatus.archived, userId);
  }

  /**
   * Preserves the v1 rule "only approved recipes can be sold" for the two
   * recipe-backed product types (menu.service.ts:154-160).
   */
  private async assertRecipeUsable(type: ProductType, recipeId?: string | null) {
    const needsRecipe = type === ProductType.prepared_food || type === ProductType.packaged;
    if (!needsRecipe) return;
    if (!recipeId) {
      throw new BadRequestException(`A ${type} product must reference a recipe`);
    }
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, status: true },
    });
    if (!recipe) throw new NotFoundException(`Recipe with ID ${recipeId} not found`);
    if (recipe.status !== RecipeStatus.approved) {
      throw new BadRequestException(
        'Only approved recipes can be sold. Change the recipe status to Approved first.',
      );
    }
  }

  // ── Variants and media ────────────────────────────────────────────────────
  async upsertVariant(dto: UpsertProductVariantDto) {
    return this.prisma.productVariant.upsert({
      where: { sku: dto.sku },
      create: { ...dto },
      update: { ...dto },
    });
  }

  async removeVariant(id: string) {
    return this.prisma.productVariant.update({
      where: { id },
      data: { status: ProductStatus.archived },
    });
  }

  async addMedia(productId: string, data: { url: string; alt?: string; sort_order?: number; kind?: 'image' | 'video' }) {
    return this.prisma.productMedia.create({ data: { product_id: productId, ...data } });
  }

  async removeMedia(id: string) {
    return this.prisma.productMedia.delete({ where: { id } });
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async findAllForExport() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: {
        recipe: { select: { name: true, computed_cost: true } },
        category: { select: { name: true } },
        variants: { select: { name: true, sku: true, stock_on_hand: true } },
      },
    });
  }

  // ── Channel modifiers ─────────────────────────────────────────────────────
  async findModifiers() {
    return this.prisma.channelModifier.findMany({ orderBy: { channel: 'asc' } });
  }

  async upsertModifier(dto: UpsertChannelModifierDto) {
    return this.prisma.channelModifier.upsert({
      where: { node_id_channel: { node_id: DEFAULT_NODE_ID, channel: dto.channel } },
      create: { node_id: DEFAULT_NODE_ID, ...dto },
      update: { modifier_type: dto.modifier_type, modifier_value: dto.modifier_value },
    });
  }
}
```

- [ ] Append the availability block to `catalog.service.ts`. Copy `computeServings`, `lineStockQty`, `servingsFromStock`, `getServingsAvailable` and `getAllServingsAvailable` from `backend/src/menu/menu.service.ts:297-566` verbatim, applying exactly these substitutions:
  - parameter/variable `menuItem` → `product`, `menuItems` → `products`, `menuItemId` → `productId`
  - `this.prisma.menuItem` → `this.prisma.product`
  - `if (!menuItem.available || menuItem.status !== 'active')` → `if (product.status !== ProductStatus.active)`
  - `where: { status: 'active' }` in `getAllServingsAvailable` → `where: { status: ProductStatus.active, type: { in: [ProductType.prepared_food, ProductType.packaged] } }`
  - the `prepType === 'batch_prepared'` / `'active'` literals → `PreparationType.batch_prepared` / `PrepBatchStatus.active`
  - add the two non-recipe branches at the top of `computeServings`, before the prep-type fork:
```ts
    if (product.stock_mode === StockMode.tracked) {
      const onHand = (product.variants ?? []).reduce(
        (s, v) => s + Number(v.stock_on_hand),
        0,
      );
      return { available: onHand > 0, servings_remaining: Math.floor(onHand), preparation_type: 'tracked' };
    }
    if (product.stock_mode === StockMode.capacity) {
      const capacity = product.event?.capacity ?? 0;
      const booked = product.event?.bookings?.reduce((s, b) => s + b.guests, 0) ?? 0;
      const left = Math.max(0, capacity - booked);
      return { available: left > 0, servings_remaining: left, preparation_type: 'capacity' };
    }
```
  (SPEC §3.3 availability-per-type table.)

- [ ] Create `backend/src/catalog/catalog.controller.ts` — `/catalog/*` plus the `/menu/*` aliases. Keep the batch-availability route declared **before** the parameterised one (the `menu.controller.ts:107` constraint):

```ts
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get(['catalog/categories', 'menu/categories'])
  @Public() @Throttle({ default: { limit: 30, ttl: 60000 } })
  findCategories(@Query('brand_id') brand_id?: string) {
    return this.catalog.findCategories(brand_id);
  }

  @Post('catalog/categories')
  @RequiresPermission(Permission.MANAGE_OPS)
  createCategory(@Body() dto: CreateProductCategoryDto) { return this.catalog.createCategory(dto); }

  @Patch('catalog/categories/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductCategoryDto) {
    return this.catalog.updateCategory(id, dto);
  }

  @Delete('catalog/categories/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  removeCategory(@Param('id', ParseUUIDPipe) id: string) { return this.catalog.removeCategory(id); }

  @Get(['catalog/products', 'menu/items'])
  @Public() @Throttle({ default: { limit: 30, ttl: 60000 } })
  findPublic(
    @Query('category_id') category_id?: string,
    @Query('brand_id') brand_id?: string,
    @Query('type') type?: ProductType,
  ) { return this.catalog.findProductsPublic(category_id, brand_id, type); }

  @Get(['catalog/products/staff', 'menu/items/staff'])
  findStaff(
    @Query('category_id') category_id?: string,
    @Query('brand_id') brand_id?: string,
    @Query('type') type?: ProductType,
  ) { return this.catalog.findProductsStaff(category_id, brand_id, type); }

  @Get('catalog/search')
  @Public() @Throttle({ default: { limit: 30, ttl: 60000 } })
  search(@Query('q') q: string, @Query('type') type?: ProductType) { return this.catalog.search(q ?? '', type); }

  @Get('catalog/products/slug/:slug')
  @Public() @Throttle({ default: { limit: 30, ttl: 60000 } })
  bySlug(@Param('slug') slug: string) { return this.catalog.findProductBySlug(slug); }

  @Post('catalog/products')
  @RequiresPermission(Permission.MANAGE_OPS)
  create(@Body() dto: CreateProductDto, @CurrentUser() user: { id: string }) {
    return this.catalog.createProduct(dto, user.id);
  }

  @Patch('catalog/products/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: { id: string }) {
    return this.catalog.updateProduct(id, dto, user.id);
  }

  @Patch('catalog/products/:id/publish')
  @RequiresPermission(Permission.MANAGE_OPS)
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string }) {
    return this.catalog.setStatus(id, ProductStatus.active, user.id);
  }

  @Delete('catalog/products/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string }) {
    return this.catalog.archiveProduct(id, user.id);
  }

  @Patch('catalog/variants')
  @RequiresPermission(Permission.MANAGE_OPS)
  upsertVariant(@Body() dto: UpsertProductVariantDto) { return this.catalog.upsertVariant(dto); }

  @Post('catalog/products/:id/media')
  @RequiresPermission(Permission.MANAGE_OPS)
  addMedia(@Param('id', ParseUUIDPipe) id: string, @Body() dto: { url: string; alt?: string; sort_order?: number; kind?: 'image' | 'video' }) {
    return this.catalog.addMedia(id, dto);
  }

  @Delete('catalog/media/:id')
  @RequiresPermission(Permission.MANAGE_OPS)
  removeMedia(@Param('id', ParseUUIDPipe) id: string) { return this.catalog.removeMedia(id); }

  // Batch route MUST stay before the parameterised one
  @Get(['catalog/availability', 'menu/availability'])
  @Public() @Throttle({ default: { limit: 30, ttl: 60000 } })
  allAvailability() { return this.catalog.getAllServingsAvailable(); }

  @Get(['catalog/availability/:productId', 'menu/availability/:productId'])
  availability(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.catalog.getServingsAvailable(productId);
  }

  @Get(['catalog/channel-modifiers', 'menu/channel-modifiers'])
  findModifiers() { return this.catalog.findModifiers(); }

  @Patch(['catalog/channel-modifiers', 'menu/channel-modifiers'])
  @RequiresPermission(Permission.MANAGE_OPS)
  upsertModifier(@Body() dto: UpsertChannelModifierDto) { return this.catalog.upsertModifier(dto); }
}
```

- [ ] Create `backend/src/catalog/catalog.module.ts` (controllers `[CatalogController]`, providers/exports `[CatalogService]`). In `backend/src/app.module.ts` replace the `MenuModule` import and registration with `CatalogModule`.
- [ ] `git mv backend/src/menu/menu.service.spec.ts backend/src/catalog/catalog.service.spec.ts` then rewrite it: `MenuService`→`CatalogService`, `prisma.menuItem`→`prisma.product`, and the fixtures gain `status: 'active'`, `stock_mode: 'derived_from_recipe'`, `type: 'prepared_food'` instead of `available: true`. Add two new cases:

```ts
  it('tracked merchandise is available from variant stock, not a recipe', async () => {
    const product = {
      status: 'active', stock_mode: 'tracked', type: 'merchandise',
      variants: [{ stock_on_hand: 4 }, { stock_on_hand: 2 }], recipe: null,
    };
    prisma.product.findUniqueOrThrow.mockResolvedValue(product);
    await expect(service.getServingsAvailable('p-1')).resolves.toMatchObject({
      available: true, servings_remaining: 6,
    });
  });

  it('an experience is available from event capacity minus confirmed guests', async () => {
    prisma.product.findUniqueOrThrow.mockResolvedValue({
      status: 'active', stock_mode: 'capacity', type: 'experience', recipe: null,
      event: { capacity: 10, bookings: [{ guests: 4 }, { guests: 2 }] },
    });
    await expect(service.getServingsAvailable('p-2')).resolves.toMatchObject({
      available: true, servings_remaining: 4,
    });
  });

  it('rejects a prepared_food product whose recipe is not approved', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ id: 'r-1', status: 'draft' });
    await expect(
      service.createProduct({ type: 'prepared_food', recipe_id: 'r-1' } as never, 'u-1'),
    ).rejects.toThrow(/Only approved recipes/);
  });
```

- [ ] `git rm -r backend/src/menu` — the module is fully replaced.
- [ ] `git mv backend/src/exports/builders/menu.builder.ts backend/src/exports/builders/products.builder.ts` — rename `MenuItemsExportBuilder`→`ProductsExportBuilder`, inject `CatalogService`, worksheet name `'Products'`, and extend the header row to `Name, Slug, Type, Category, Base Price, Tax %, Status, Recipe Name, Recipe Cost, Variants`. In `exports.module.ts` swap `MenuModule`→`CatalogModule` and the registry key at line 174 from `'menu_items'` to `'products'`; in `export-types.ts:25` and `:124-129` rename the union member and metadata (`label: 'Products'`, `description: 'products with pricing and variants'`).
- [ ] `backend/src/test-utils/mock-providers.ts:19` — replace `'menuItem'` with `'product'`, `'productCategory'`, `'productVariant'`, `'productMedia'`, `'auditEvent'`, `'node'`, `'moduleAccess'`.
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest src/catalog src/exports --silent` — expect both `PASS`.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 55 passed, 55 total` (menu suite removed, catalog suite added).
- [ ] `git add -A backend/src && git commit -m "feat(p2-10): catalog module replaces menu module, products export builder" -- backend/src`

---

### Task 11: Flip every consumer to `product` and drop `MenuItem`/`MenuCategory`

The atomic switch. `OrderItem.product_id` becomes required, `menu_item_id`/`menu_item` and both legacy models are deleted, and the eleven consumers found by grep are migrated in one commit so the build never breaks in between.

**Files (backend):** `backend/prisma/schema.prisma`; `orders/orders.service.ts`, `orders/dto/create-order.dto.ts`; `customer-orders/customer-orders.service.ts`, `customer-orders/dto/sync-cart.dto.ts`, `customer-orders/receipt.template.ts`; `fulfilment/fulfilment.service.ts`; `kitchen/kds/kds.service.ts`; `kitchen/pick-and-pack/pick-and-pack.service.ts`; `analytics/analytics.service.ts`; `recipes/recipes.service.ts`; `imports/import-types.ts`, `imports/imports.service.ts`, `imports/template.service.ts`, `imports/validators/menu-items.validator.ts` → `products.validator.ts`, `imports/validators/menu-categories.validator.ts` → `product-categories.validator.ts`; and the seven spec files listed at the end.

- [ ] `schema.prisma` — `OrderItem`: delete `menu_item_id`, `menu_item`, `@@index([menu_item_id])`; make the product columns required:

```prisma
  product_id   String
  product      Product         @relation(fields: [product_id], references: [id])
  variant_id   String?
  variant      ProductVariant? @relation(fields: [variant_id], references: [id])
```
  Then delete `model MenuItem`, `model MenuCategory`, `Recipe.MenuItems`, `Brand.menu_categories`. `grep -n "MenuItem\|MenuCategory\|menu_item" backend/prisma/schema.prisma` → no output.

- [ ] `cd backend && npx prisma generate` — expect `Generated Prisma Client`.
- [ ] Apply this rename across the backend, then fix what remains by hand:

```bash
cd backend && grep -rl "menu_item\|menuItem\|MenuItem" src --include=*.ts \
  | xargs sed -i 's/menu_item_id/product_id/g; s/menu_item_name/product_name/g; s/menu_item/product/g; s/menuItemId/productId/g; s/menuItemIds/productIds/g; s/menuItems/products/g; s/menuItem/product/g; s/MenuItem/Product/g'
```
  This is correct for every hit **except** the four sites below, which the compiler and these greps catch:
  - `backend/src/orders/orders.service.ts:67` error copy — restore human wording: `` `Product with ID ${item.product_id} not found` ``.
  - `backend/src/recipes/recipes.service.ts:281-287` — the guard becomes `this.prisma.product.count({ where: { recipe_id: id } })` with the message `` `Cannot delete: recipe is referenced by ${count} product(s)` ``.
  - `backend/src/analytics/analytics.service.ts:205` — `groupBy: { by: ['product_id'] }` and the two `prisma.product.findMany` calls must now `select` `{ id, name, base_price, recipe: { select: { computed_cost: true } } }`; the response key stays `product_id`.
  - `backend/src/imports/import-types.ts:12-13` — the registry strings become `'product_categories'` and `'products'`; propagate to `imports.service.ts:272-275, 402-421, 848-865, 1014-1035`, `template.service.ts:105-117, 448-516`, and rename both validator files with `git mv` (`validateMenuItemRow`→`validateProductRow`, `validateMenuCategoryRow`→`validateProductCategoryRow`; inside them `prisma.menuCategory.findFirst`→`prisma.productCategory.findFirst`, `prisma.menuItem.findFirst`→`prisma.product.findFirst`). The import template columns for `products` become `name, slug, type, recipe, category, brand, base_price, status`.

- [ ] Verify the four nested **relation-path filters** (they fail at runtime, not compile time): `kds.service.ts:59` and `pick-and-pack.service.ts:16,28,35` must now read `product: { recipe: { preparation_type: … } }`. `grep -rn "menu_item" backend/src` → no output.
- [ ] `backend/src/fulfilment/fulfilment.service.ts` — after the rename, `PendingOrderData.cart.items[].productId` and `CONFIRMED_ORDER_INCLUDE` (`items: { include: { product: { select: { id: true, name: true } } } }`) are correct. Add the variant price to the order-item create in `confirmPaidOrder`:

```ts
                create: pending.cart.items.map((item) => ({
                  product_id: item.productId,
                  variant_id: item.variantId ?? null,
                  quantity: item.quantity,
                  unit_price: item.unitPrice,
                })),
```
  and add `variantId?: string | null` to the `PendingOrderData` cart item type and to `CartData` in `customer-orders.service.ts:26-37`. **Redis carts written before this deploy carry `menuItemId`** — `customer-orders.service.ts` `syncCart` must drop unknown-shaped lines rather than crash:
```ts
      const items = (parsed.items ?? []).filter(
        (i: { productId?: string }) => typeof i.productId === 'string',
      );
```

- [ ] Update the seven spec files the grep flagged: `analytics.service.spec.ts` (16, 43-45, 108-122, 166-170), `customer-orders.service.spec.ts` (51, 107-445, 766), `fulfilment.service.spec.ts` (23, 45, 122-623), `orders.service.spec.ts` (21, 87-88), `kds.service.spec.ts` (22, 71, 111), `webhooks.service.spec.ts` (305), `imports.service.spec.ts`. The same `sed` above covers them; re-run it with `src --include=*.spec.ts` if the first pass excluded them.
- [ ] `cd backend && npx prisma validate && npx tsc --noEmit -p tsconfig.build.json` — expect valid and no TS output.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 55 passed, 55 total`.
- [ ] `cd backend && npx eslint src/catalog src/orders src/fulfilment src/customer-orders src/kitchen src/analytics src/imports src/exports` — expect no errors.
- [ ] `git add -A backend && git commit -m "feat(p2-11): OrderItem reads Product; MenuItem and MenuCategory removed" -- backend`

---

### Task 12: Frontend types, stores, pages and components read products

Routes stay where they are (`/menu`, `/operations/menu`, `/pos`); only the data names change. `frontend/lib/types/menu.ts` becomes `catalog.ts`.

**Files:** `frontend/lib/types/catalog.ts` (new, replaces `menu.ts`), `types/index.ts`, `types/orders.ts`, `types/marketplace.ts`, `types/kds.ts`, `types/kitchen.ts`, `types/analytics.ts`, `types/exports.ts`, `types/imports.ts`, `types/tasks.ts`, `types/evidence.ts`, `types/decisions.ts`, `types/inventory.ts`, `types/recipe.ts`, `types/purchase-order.ts`, `types/events.ts`; `lib/stores/cart-store.ts`; `app/(ops)/operations/menu/page.tsx`, `app/(ops)/pos/page.tsx`, `app/(public)/menu/page.tsx`, `app/(public)/profile/page.tsx`, `app/(public)/orders/[id]/track/page.tsx`, `app/(ops)/admin/import/page.tsx`, `app/(ops)/admin/import/[type]/page.tsx`; `components/ops/operations/menu/*` (4), `components/ops/pos/*` (5), `components/ops/kitchen/kds/KdsOrderItem.tsx`, `KdsBoard.tsx`, `components/ops/kitchen/pick-and-pack/PickAndPackOrderCard.tsx`, `components/ops/analytics/TopItemsList.tsx`, `components/public/MenuItemOrderCard.tsx`, `MenuItemPublicCard.tsx`, `CategoryTabBar.tsx`, `CartBottomSheet.tsx`, `CustomerOrderCard.tsx`.

- [ ] `git mv frontend/lib/types/menu.ts frontend/lib/types/catalog.ts` and replace its contents:

```ts
export type ProductType = 'prepared_food' | 'packaged' | 'experience' | 'merchandise';
export type FulfilmentType = 'local' | 'shipped' | 'booking';
export type StockMode = 'derived_from_recipe' | 'tracked' | 'capacity';
export type ProductStatus = 'draft' | 'active' | 'archived';
export type MediaKind = 'image' | 'video';
export type ModifierType = 'fixed' | 'percentage';
export type OrderChannelValue = 'dine_in' | 'takeaway' | 'delivery' | 'marketplace';

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  prepared_food: 'Prepared food',
  packaged: 'Packaged',
  experience: 'Experience',
  merchandise: 'Merchandise',
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

export interface ProductMedia {
  id: string;
  url: string;
  alt: string;
  sort_order: number;
  kind: MediaKind;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price_delta: number;
  stock_on_hand: number;
  low_stock_threshold: number | null;
  is_default: boolean;
  status: ProductStatus;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  brand_id: string;
  sort_order: number;
  product_types: ProductType[];
  status: ProductStatus;
  _count?: { products: number };
}

export interface Product {
  id: string;
  brand_id: string;
  category_id: string;
  type: ProductType;
  name: string;
  slug: string;
  description: string;
  story: string | null;
  base_price: number;
  tax_rate: number;
  hsn_code: string | null;
  fulfilment: FulfilmentType;
  stock_mode: StockMode;
  recipe_id: string | null;
  event_id: string | null;
  weight_grams: number | null;
  shelf_life_days: number | null;
  is_featured: boolean;
  rating_avg: number | null;
  rating_count: number;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  media?: ProductMedia[];
  variants?: ProductVariant[];
  recipe?: { id: string; name?: string; computed_cost: number | null; yield_qty?: number; preparation_type: string } | null;
  category?: { id: string; name: string; slug: string; brand_id: string } | null;
  event?: { id: string; date: string; capacity: number } | null;
}

export interface ChannelModifier {
  id: string;
  channel: OrderChannelValue;
  modifier_type: ModifierType;
  modifier_value: number;
  status: string;
}

/** First image for a product, or null — replaces the v1 `image_url` column. */
export function productImage(product: Product): string | null {
  return product.media?.find((m) => m.kind === 'image')?.url ?? null;
}

export function calcFoodCostPercent(computedCost: number | null, basePrice: number): number | null {
  if (!computedCost || !basePrice) return null;
  return (computedCost / basePrice) * 100;
}
```

- [ ] `frontend/lib/types/index.ts:12` — `export * from './menu'` → `export * from './catalog'`.
- [ ] Run the mechanical rename over the frontend, then fix the four non-mechanical spots below:

```bash
cd frontend && grep -rl "menu_item\|menuItem\|MenuItem\|MenuCategory" app components lib --include=*.ts --include=*.tsx \
  | grep -v "components/ui/dropdown-menu.tsx" \
  | xargs sed -i 's/menu_item_id/product_id/g; s/menu_item_name/product_name/g; s/menu_item/product/g; s/menuItemId/productId/g; s/menuItems/products/g; s/menuItem/product/g; s/MenuItemAvailability/ProductAvailability/g; s/MenuCategory/ProductCategory/g; s/MenuItem/Product/g'
```
  Then restore the shadcn identifiers the sweep may have hit: `grep -rn "DropdownProduct\|NavigationProduct\|ContextProduct" frontend` → fix any hit back to `DropdownMenuItem` etc. (`components/ops/Sidebar.tsx`, `components/ops/chat/MessageThread.tsx`, `ConversationList.tsx`, `app/(ops)/admin/users/page.tsx`, `app/(auth)/team/page.tsx` are the five files at risk).

- [ ] `git mv frontend/components/public/MenuItemOrderCard.tsx frontend/components/public/ProductOrderCard.tsx` and `MenuItemPublicCard.tsx` → `ProductPublicCard.tsx`; `frontend/components/ops/operations/menu/MenuItemCard.tsx` → `ProductCard.tsx`, `MenuItemForm.tsx` → `ProductForm.tsx`, `MenuCategorySection.tsx` → `ProductCategorySection.tsx`; `frontend/components/ops/pos/PosMenuItemCard.tsx` → `PosProductCard.tsx`, `PosMenuGrid.tsx` → `PosProductGrid.tsx`. Update every import.
- [ ] Re-point the API paths from `/menu/*` to `/catalog/*` (the `/menu/*` aliases stay live, but the frontend should use the canonical route): `app/(ops)/operations/menu/page.tsx:78,85,91,108,140,172,178,199`, `components/ops/operations/menu/ProductForm.tsx:83,110,119`, `ChannelModifierTable.tsx:72`, `app/(ops)/pos/page.tsx:63,71,77`, `app/(public)/menu/page.tsx:45,55,61`, `app/(public)/profile/page.tsx:250,338`, `components/public/CartBottomSheet.tsx:75` — `'/menu/items'`→`'/catalog/products'`, `'/menu/items/staff'`→`'/catalog/products/staff'`, `'/menu/categories'`→`'/catalog/categories'`, `'/menu/availability'`→`'/catalog/availability'`, `'/menu/channel-modifiers'`→`'/catalog/channel-modifiers'`.
- [ ] `frontend/lib/stores/cart-store.ts` — the persisted key `'cart-storage'` now stores `productId`; bump the store version so old carts are dropped instead of half-read:

```ts
    {
      name: 'cart-storage',
      version: 2,
      migrate: () => ({ items: [], channel: null, deliveryAddressId: null }),
    },
```

- [ ] Extend the exhaustive `Record<Union, string>` maps for the enum members added in Tasks 2–4 (each is a `next build` tripwire): `types/decisions.ts:28` add `aligned`, `reopened`; `types/evidence.ts:19-25` rename `photo`→`image`, `doc`→`document`, add `system` (and the MIME derivation at `:37-39` plus the six branch sites in `components/ops/approvals/ApprovalItem.tsx:41,42,194`, `components/ops/evidence/EvidenceItem.tsx:37,38,134`, `components/ops/boards/EvidenceFeedCard.tsx:35,49,51,53`, and the duplicated inline union at `types/analytics.ts:48`); `types/inventory.ts:1,3,11` add `supply_usage`, `import`, `shipment_packed`, `return` and rename `received`→`purchase_received`; `types/kds.ts:41-48` add the six new `OrderStatus` members and `:50-54` the five new `OrderItemStatus` members; `types/events.ts:64-68` add `draft`, `live`; `types/orders.ts:114-118` add `failed`, `partially_refunded`; `types/notifications.ts` already carries all eight `NotificationType` values — leave it. Reconcile `types/marketplace.ts:29 OrderTrackingStatus` with the real union by re-exporting it: `export type OrderTrackingStatus = OrderStatus;`.
- [ ] `types/exports.ts:43,72` — `'menu_items'` → `'products'` (label `'Products'`); `types/imports.ts:12-13,73,137-148` — `'menu_categories'`/`'menu_items'` → `'product_categories'`/`'products'` and the prereq key `menu_categories` → `product_categories`; mirror in `app/(ops)/admin/import/page.tsx:41-42,71-76,120` and `app/(ops)/admin/import/[type]/page.tsx:73-74,506`.
- [ ] `cd frontend && npx tsc --noEmit` — expect no output.
- [ ] `cd frontend && npm run lint` — expect no errors.
- [ ] `cd frontend && npm run build` — expect a successful production build.
- [ ] `grep -rn "menuItem\|menu_item\|MenuCategory" frontend/app frontend/components frontend/lib --include=*.ts --include=*.tsx` — expect no output.
- [ ] `git add -A frontend && git commit -m "feat(p2-12): frontend reads products; catalog types replace menu types" -- frontend`

---

### Task 13: `Node.timezone` replaces the hardcoded IST offset

**Files:**
- Delete line: `backend/src/main.ts:2` (`process.env.TZ = 'Asia/Kolkata';`)
- Create: `backend/src/common/utils/node-time.ts`, `node-time.spec.ts`
- Modify: `backend/src/analytics/analytics.service.ts`, `backend/src/orders/orders.service.ts`, `backend/src/customer-orders/receipt.template.ts`, `backend/src/imports/imports.service.ts`, `backend/.env.example`
- Modify: `backend/src/analytics/analytics.service.spec.ts`

- [ ] Create `backend/src/common/utils/node-time.ts`:

```ts
/**
 * Day-boundary and day-key helpers that take the node's IANA timezone instead of
 * the process TZ. `process.env.TZ = 'Asia/Kolkata'` used to be forced in main.ts;
 * it is removed so a node in another zone reports its own days (SPEC §3.1 Node.timezone).
 */

/** Offset of `at` in `timeZone`, in minutes east of UTC (handles DST). */
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** `YYYY-MM-DD` for `at` as seen in `timeZone` — the analytics day-bucket key. */
export function nodeDayKey(timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at);
}

/** UTC instants bounding the local day `YYYY-MM-DD` in `timeZone`; `end` is exclusive. */
export function nodeDayRange(timeZone: string, day: string): { start: Date; end: Date } {
  const [y, m, d] = day.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offset = tzOffsetMinutes(timeZone, new Date(naive));
  const start = new Date(naive - offset * 60000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** Inclusive-from / exclusive-to range spanning two local day strings. */
export function nodeDateRange(timeZone: string, from: string, to: string): { start: Date; end: Date } {
  return { start: nodeDayRange(timeZone, from).start, end: nodeDayRange(timeZone, to).end };
}

/** Display formatter for receipts and notices, rendered in the node's zone. */
export function formatInNodeTz(timeZone: string, at: Date | string, locale = 'en-IN'): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  return d.toLocaleString(locale, {
    timeZone, year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}
```

- [ ] Create `backend/src/common/utils/node-time.spec.ts`:

```ts
import { nodeDayKey, nodeDayRange, nodeDateRange, tzOffsetMinutes } from './node-time';

describe('node-time', () => {
  it('IST is +330 minutes with no DST', () => {
    expect(tzOffsetMinutes('Asia/Kolkata', new Date('2026-01-15T00:00:00Z'))).toBe(330);
    expect(tzOffsetMinutes('Asia/Kolkata', new Date('2026-07-15T00:00:00Z'))).toBe(330);
  });

  it('nodeDayRange for IST starts at 18:30 UTC the previous day', () => {
    const { start, end } = nodeDayRange('Asia/Kolkata', '2026-08-23');
    expect(start.toISOString()).toBe('2026-08-22T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-08-23T18:30:00.000Z');
  });

  it('handles a DST zone correctly', () => {
    expect(tzOffsetMinutes('Europe/London', new Date('2026-07-01T12:00:00Z'))).toBe(60);
    expect(tzOffsetMinutes('Europe/London', new Date('2026-01-01T12:00:00Z'))).toBe(0);
  });

  it('nodeDayKey buckets a 20:00 UTC order into the next IST day', () => {
    expect(nodeDayKey('Asia/Kolkata', new Date('2026-08-22T20:00:00Z'))).toBe('2026-08-23');
  });

  it('nodeDateRange spans from the first day start to the last day end', () => {
    const { start, end } = nodeDateRange('Asia/Kolkata', '2026-08-01', '2026-08-03');
    expect(start.toISOString()).toBe('2026-07-31T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-08-03T18:30:00.000Z');
  });
});
```

- [ ] `cd backend && npx jest src/common/utils/node-time --silent` — expect `Tests: 5 passed, 5 total`.
- [ ] Delete `backend/src/main.ts:2` and its comment. `grep -rn "process.env.TZ" backend/src` → no output. Remove `TZ=Asia/Kolkata` from `backend/.env.example:51` and add a comment pointing at `Node.timezone`.
- [ ] `backend/src/analytics/analytics.service.ts` — inject `NodeService`; `parseDateRange` (lines 11-17) becomes:

```ts
  private async parseDateRange(from: string, to: string): Promise<{ start: Date; end: Date }> {
    return nodeDateRange(await this.nodeService.timezone(), from, to);
  }
```
  and the day-bucket at 97-99 becomes `nodeDayKey(tz, order.created_at)` with `tz` resolved once before the loop. Every caller of `parseDateRange` gains an `await`.

- [ ] `backend/src/orders/orders.service.ts:509-511` — `getDailySummary` stops duplicating the parser:

```ts
  async getDailySummary(date: string) {
    const { start, end } = nodeDayRange(await this.nodeService.timezone(), date);
```
  (inject `NodeService`; add it to `orders.service.spec.ts` providers as `{ provide: NodeService, useValue: { timezone: jest.fn().mockResolvedValue('Asia/Kolkata') } }`).

- [ ] `backend/src/customer-orders/receipt.template.ts:22-23` — `formatDate` takes the zone: `formatDate(timeZone: string, date: Date | string)` calling `formatInNodeTz`; the caller passes the zone resolved from `NodeService`. `backend/src/imports/imports.service.ts:111` — same substitution for the duplicate-import warning string.
- [ ] `backend/src/orders/orders.controller.ts:49` — the default `date` param must be the node's today, not UTC's: `date ?? nodeDayKey(await this.nodeService.timezone(), new Date())`.
- [ ] `backend/src/analytics/analytics.service.spec.ts:82-84` — the `+05:30` fixtures stay (they are explicit-offset instants and remain correct); add `NodeService` to the providers. Because `main.ts` no longer forces the process TZ, add a guard test asserting `parseDateRange` is zone-driven:

```ts
  it('day boundaries come from Node.timezone, not the process TZ', async () => {
    nodeService.timezone.mockResolvedValue('Europe/London');
    const range = await (service as never as { parseDateRange: (a: string, b: string) => Promise<{ start: Date }> })
      .parseDateRange('2026-08-23', '2026-08-23');
    expect(range.start.toISOString()).toBe('2026-08-22T23:00:00.000Z');
  });
```

- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `grep -rn "+05:30\|Asia/Kolkata" backend/src` — expect hits **only** in `node/node.constants.ts` and `analytics.service.spec.ts` fixtures.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 56 passed, 56 total`.
- [ ] `git add backend && git commit -m "feat(p2-13): day boundaries read Node.timezone; drop process.env.TZ" -- backend`

---

### Task 14: Seeds — node, module access, approval policies, meter modes, demo catalog

**Files:**
- Create: `backend/prisma/seed-data/module-access.ts`, `backend/prisma/seed-data/approval-policies.ts`, `backend/prisma/seed-data/demo-catalog.ts`
- Modify: `backend/prisma/seed-data/reference.ts`, `backend/prisma/seed-reference.ts`, `backend/prisma/seed-demo.ts`, `backend/package.json`

- [ ] `backend/prisma/seed-data/reference.ts` — add the two meters SPEC §4.3 needs and the mode/formula columns:

```ts
export const READINESS_METERS = [
  { code: 'VILLA', name: 'Villa Readiness', description: 'Overall villa setup and space readiness', mode: 'task_driven', formula_key: null },
  { code: 'BACKEND', name: 'Backend Readiness', description: 'Food production, R&D, and standardization readiness', mode: 'hybrid', formula_key: 'hybrid_backend_v1' },
  { code: 'FRONTEND', name: 'Frontend Readiness', description: 'Customer-facing service and experience readiness', mode: 'hybrid', formula_key: 'hybrid_frontend_v1' },
  { code: 'PROCUREMENT', name: 'Procurement Readiness', description: 'Vendor sourcing and inventory readiness', mode: 'derived', formula_key: 'procurement_v1' },
  { code: 'STANDARDIZATION', name: 'Standardization Readiness', description: 'SOPs, recipes, and process documentation readiness', mode: 'derived', formula_key: 'standardization_v1' },
  { code: 'SALES', name: 'Sales Readiness', description: 'Sales channels and revenue pipeline readiness', mode: 'derived', formula_key: 'sales_v1' },
  { code: 'QUALITY', name: 'Quality Readiness', description: 'Waste, food-cost variance and guest ratings', mode: 'derived', formula_key: 'quality_v1' },
  { code: 'BI', name: 'BI Readiness', description: 'Costing, pricing and KPI instrumentation readiness', mode: 'task_driven', formula_key: null },
  { code: 'TECH', name: 'Tech Readiness', description: 'Dashboard, automation, and system infrastructure readiness', mode: 'task_driven', formula_key: null },
  { code: 'TALENT', name: 'Talent Readiness', description: 'Team hiring, training, and onboarding readiness', mode: 'task_driven', formula_key: null },
  { code: 'ART_EXPERIENCE', name: 'Art Experience Readiness', description: 'Art program and experience design readiness', mode: 'task_driven', formula_key: null },
  { code: 'LIFESTYLE_EXPERIENCE', name: 'Lifestyle Experience Readiness', description: 'Lifestyle program and experience design readiness', mode: 'task_driven', formula_key: null },
] as const;
```
  Also delete `CATEGORY_MAPPING` (already removed from the seed in Task 3) and change `CHANNELS` `status: 'planned'` rows unchanged.

- [ ] Create `backend/prisma/seed-data/module-access.ts` — SPEC §6.3 verbatim. `ALL` and `APPROVERS` are resolved at seed time from `ROLE_SEEDS`:

```ts
import { RoleCode } from '../../src/types/roles';

const R = RoleCode;
export const ALL_ROLES = Object.values(RoleCode) as string[];

export interface ModuleAccessSeed {
  module_key: string;
  role_codes: string[] | 'ALL' | 'APPROVERS';
  sort_order: number;
}

/** sort_order follows the SPEC §6.2 navigation spine, then the collapsible groups. */
export const MODULE_ACCESS: ModuleAccessSeed[] = [
  { module_key: 'mission_control', role_codes: 'ALL', sort_order: 10 },
  { module_key: 'my_tasks', role_codes: 'ALL', sort_order: 20 },
  { module_key: 'my_quests', role_codes: 'ALL', sort_order: 30 },
  { module_key: 'evidence', role_codes: 'ALL', sort_order: 40 },
  { module_key: 'approvals', role_codes: 'APPROVERS', sort_order: 50 },
  { module_key: 'decisions', role_codes: 'ALL', sort_order: 60 },
  { module_key: 'readiness', role_codes: 'ALL', sort_order: 70 },
  { module_key: 'team', role_codes: 'ALL', sort_order: 80 },
  { module_key: 'guide', role_codes: 'ALL', sort_order: 90 },
  { module_key: 'chat', role_codes: 'ALL', sort_order: 100 },

  ...['recipes', 'ingredients', 'prep_batches', 'kds', 'pick_pack', 'waste', 'supply_usage'].map(
    (k, i) => ({ module_key: k, role_codes: [R.BACKEND_LEAD, R.PROCUREMENT_LEAD, R.FRONTEND_LEAD, R.FOUNDER_ADMIN, R.TECH_LEAD] as string[], sort_order: 200 + i }),
  ),
  ...['inventory', 'procurement', 'purchase_orders', 'vendors'].map(
    (k, i) => ({ module_key: k, role_codes: [R.PROCUREMENT_LEAD, R.BACKEND_LEAD, R.FOUNDER_ADMIN, R.TECH_LEAD] as string[], sort_order: 300 + i }),
  ),
  ...['pos', 'orders', 'delivery', 'shipments', 'customers', 'reviews'].map(
    (k, i) => ({ module_key: k, role_codes: [R.FRONTEND_LEAD, R.FOUNDER_ADMIN, R.TECH_LEAD] as string[], sort_order: 400 + i }),
  ),
  ...['catalog', 'promotions', 'experiences', 'brands', 'assets'].map(
    (k, i) => ({ module_key: k, role_codes: [R.DESIGN_OUTREACH_LEAD, R.FRONTEND_LEAD, R.FOUNDER_ADMIN, R.TECH_LEAD] as string[], sort_order: 500 + i }),
  ),
  ...['analytics', 'kpis', 'feedback', 'exports'].map(
    (k, i) => ({ module_key: k, role_codes: [R.BI_LEAD, R.FOUNDER_ADMIN, R.TECH_LEAD] as string[], sort_order: 600 + i }),
  ),
  ...['imports', 'users', 'permissions', 'delegations', 'notices', 'settings', 'modules', 'guide_editor', 'zones', 'channels'].map(
    (k, i) => ({ module_key: k, role_codes: [R.FOUNDER_ADMIN, R.TECH_LEAD] as string[], sort_order: 700 + i }),
  ),
  { module_key: 'talent', role_codes: [R.TALENT_LEAD, R.FOUNDER_ADMIN], sort_order: 800 },
];
```

- [ ] Create `backend/prisma/seed-data/approval-policies.ts` — SPEC §4.4:

```ts
import { RoleCode } from '../../src/types/roles';

const R = RoleCode;

export interface ApprovalPolicySeed {
  scope: 'task' | 'decision' | 'recipe' | 'pricing' | 'vendor' | 'experience' | 'tech' | 'hiring';
  domain: string | null;
  required_role_codes: string[];
  min_approvals: number;
  mode: 'all' | 'n_of';
  is_default: boolean;
}

export const APPROVAL_POLICIES: ApprovalPolicySeed[] = [
  { scope: 'recipe', domain: 'food', required_role_codes: [R.BACKEND_LEAD, R.FRONTEND_LEAD], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'task', domain: 'food', required_role_codes: [R.BACKEND_LEAD, R.FRONTEND_LEAD], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'pricing', domain: 'bi', required_role_codes: [R.BI_LEAD, R.FRONTEND_LEAD], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'vendor', domain: 'procurement', required_role_codes: [R.PROCUREMENT_LEAD, R.BACKEND_LEAD], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'experience', domain: 'design', required_role_codes: [R.FRONTEND_LEAD, R.DESIGN_OUTREACH_LEAD], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'tech', domain: 'tech', required_role_codes: [R.TECH_LEAD, R.FOUNDER_ADMIN], min_approvals: 2, mode: 'all', is_default: false },
  { scope: 'hiring', domain: 'talent', required_role_codes: [R.TALENT_LEAD, R.FOUNDER_ADMIN], min_approvals: 2, mode: 'all', is_default: false },
  // Fallback: the task owner's domain lead, resolved at runtime in P3.
  { scope: 'task', domain: null, required_role_codes: [], min_approvals: 1, mode: 'n_of', is_default: true },
];
```

- [ ] `backend/prisma/seed-reference.ts` — add these blocks inside the existing transaction, **before** the roles loop for the node and after it for the rest:

```ts
      const node = await tx.node.upsert({
        where: { id: DEFAULT_NODE_ID },
        update: { name: DEFAULT_NODE_NAME, timezone: DEFAULT_NODE_TIMEZONE, currency: DEFAULT_NODE_CURRENCY },
        create: {
          id: DEFAULT_NODE_ID,
          code: DEFAULT_NODE_CODE,
          name: DEFAULT_NODE_NAME,
          timezone: DEFAULT_NODE_TIMEZONE,
          currency: DEFAULT_NODE_CURRENCY,
          status: 'active',
        },
      });
```
```ts
      for (const meter of READINESS_METERS) {
        const data = {
          name: meter.name,
          description: meter.description,
          mode: meter.mode,
          formula_key: meter.formula_key,
        };
        await tx.readinessMeter.upsert({
          where: { node_id_code: { node_id: node.id, code: meter.code } },
          update: data,
          create: { node_id: node.id, code: meter.code, ...data },
        });
      }
```
```ts
      const approverRoleCodes = ROLE_SEEDS
        .filter((r) => r.permissions.includes(Permission.APPROVE_EVIDENCE))
        .map((r) => r.code as string);

      for (const m of MODULE_ACCESS) {
        const roleCodes =
          m.role_codes === 'ALL' ? ALL_ROLES
          : m.role_codes === 'APPROVERS' ? approverRoleCodes
          : m.role_codes;
        await tx.moduleAccess.upsert({
          where: { module_key: m.module_key },
          update: { role_codes: roleCodes, sort_order: m.sort_order },
          create: { module_key: m.module_key, role_codes: roleCodes, sort_order: m.sort_order, enabled: true },
        });
      }

      for (const p of APPROVAL_POLICIES) {
        await tx.approvalPolicy.upsert({
          where: { node_id_scope_domain: { node_id: node.id, scope: p.scope, domain: p.domain } },
          update: {
            required_role_codes: p.required_role_codes,
            min_approvals: p.min_approvals,
            mode: p.mode,
            is_default: p.is_default,
          },
          create: { node_id: node.id, ...p },
        });
      }
```
```ts
      // SystemSetting.value is Json (SPEC §3.1) — seed every allow-listed key at its default.
      for (const key of SETTING_KEYS) {
        const value =
          key === 'marketplace_fulfilment_zone_id' && mainKitchenId
            ? mainKitchenId
            : SETTING_DEFAULTS[key];
        await tx.systemSetting.upsert({
          where: { key },
          update: key === 'marketplace_fulfilment_zone_id' ? { value } : {},
          create: { key, value },
        });
      }
```
  Delete the two hand-written `leaderboard_enabled` / `marketplace_fulfilment_zone_id` upserts the loop replaces, and update the closing `console.log` counts to include `${MODULE_ACCESS.length} modules, ${APPROVAL_POLICIES.length} approval policies`.

- [ ] Create `backend/prisma/seed-data/demo-catalog.ts` — twelve products across the four `ProductType`s, with the eight recipes and ten ingredients they need. Structure (exact rows written by the implementing agent from this table):

| # | Product | type | fulfilment | stock_mode | recipe (`preparation_type`) | variants |
|---|---|---|---|---|---|---|
| 1 | Konma Signature Thali | prepared_food | local | derived_from_recipe | Signature Thali (`scratch`) | — |
| 2 | Smoked Butter Chicken Bowl | prepared_food | local | derived_from_recipe | Butter Chicken Base (`batch_prepared`) | — |
| 3 | Terrace Garden Salad | prepared_food | local | derived_from_recipe | Garden Salad (`assemble`) | — |
| 4 | Villa Filter Coffee | prepared_food | local | derived_from_recipe | Filter Coffee (`assemble`) | Small / Large |
| 5 | Masala Chai | prepared_food | local | derived_from_recipe | Masala Chai Concentrate (`batch_prepared`) | — |
| 6 | Konma Garam Masala | packaged | shipped | derived_from_recipe | Garam Masala Blend (`ready_to_sell`) | 100 g / 250 g |
| 7 | Cold-Pressed Coconut Oil | packaged | shipped | derived_from_recipe | Coconut Oil Bottling (`ready_to_sell`) | 500 ml / 1 L |
| 8 | Sourdough Starter Kit | packaged | shipped | derived_from_recipe | Starter Kit Pack (`ready_to_sell`) | — |
| 9 | Chef's Table Dinner | experience | booking | capacity | — (`event_id`) | — |
| 10 | Fermentation Workshop | experience | booking | capacity | — (`event_id`) | — |
| 11 | Konma Ceramic Mug | merchandise | shipped | tracked | — | Terracotta / Olive |
| 12 | Villa Linen Apron | merchandise | shipped | tracked | — | One size |

  Rules the data must satisfy: every recipe is `status: approved` with a non-null `computed_cost` (so `STANDARDIZATION` is meaningful in P3); products 1–8 set `recipe_id`, 9–10 set `event_id` and leave `recipe_id` null, 11–12 set neither and carry `stock_on_hand > 0` on every variant; each product has one `ProductMedia` row (`kind: image`, an R2 placeholder path) and a unique kebab `slug`; `tax_rate` is `5` for prepared food and `12` for packaged/merchandise; `weight_grams` is set on every `shipped` product.

- [ ] `backend/prisma/seed-demo.ts` — after the user loop, add `await seedDemoCatalog(prisma)` guarded by the same `assertDemoSeedAllowed`, wrapping the ingredient → recipe → category → product → variant → media inserts in one `prisma.$transaction` with `{ timeout: 60000 }`, each write an `upsert` keyed on its natural key (`Ingredient.name`, `Recipe.name`, `ProductCategory.node_id_slug`, `Product.node_id_slug`, `ProductVariant.sku`) so a re-run is idempotent.
- [ ] `backend/package.json` — the seed scripts are already plain `ts-node`; confirm:

```json
    "seed:reference": "ts-node prisma/seed-reference.ts",
    "seed:demo": "ts-node prisma/seed-demo.ts",
```
```json
  "prisma": { "seed": "ts-node prisma/seed.ts" }
```

- [ ] `cd backend && npx tsc --noEmit -p tsconfig.build.json` — expect no output.
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 56 passed, 56 total`.
- [ ] `git add backend/prisma backend/package.json && git commit -m "feat(p2-14): seed node, module access, approval policies, meter modes and a demo catalog" -- backend/prisma backend/package.json`

---

### Task 15: One baseline migration + hand-written CHECK and trigger SQL

SPEC §11 P2 and ROADMAP Phase 30 criterion 1 require **a single baseline migration**. The 20 v1 migrations are replaced (the DB is not deployed; SPEC §1.3 permits one schema reset), so the baseline is generated with `--from-empty`, which needs no shadow database and runs offline.

**Files:**
- Delete: `backend/prisma/migrations/2026*` (all 20 directories)
- Create: `backend/prisma/migrations/20260823120000_p2_platform_foundation/migration.sql`
- Keep: `backend/prisma/migrations/migration_lock.toml`

- [ ] Archive then remove the v1 migrations (the drift fix `20260823000000_order_fk_set_null` is folded into the baseline because the schema already carries its `onDelete: SetNull`; verify with `grep -n "onDelete: SetNull" backend/prisma/schema.prisma` before deleting):

```bash
cd backend && git rm -r --quiet prisma/migrations/2026*
mkdir -p prisma/migrations/20260823120000_p2_platform_foundation
```

- [ ] Generate the baseline DDL:

```bash
cd backend && npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260823120000_p2_platform_foundation/migration.sql
```
  Expected: a ~1,200-line script that begins with `CREATE TYPE "NodeStatus" AS ENUM ('setup', 'active', 'paused', 'closed');` and contains `CREATE TABLE "Node"`, `CREATE TABLE "Product"`, `CREATE TABLE "AuditEvent"`, and **no** `"MenuItem"` / `"MenuCategory"`. Verify: `grep -c "CREATE TYPE" migration.sql` → `48`; `grep -c "MenuItem" migration.sql` → `0`.

- [ ] Append the hand-written constraints and triggers (SPEC §3.4, §5.4) to the same file:

```sql
-- ─── SPEC §3.4 CHECK constraints (not expressible in Prisma schema) ──────────
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_input_xor"
  CHECK (
    (("input_type" = 'ingredient') = ("ingredient_id" IS NOT NULL))
    AND (("input_type" = 'recipe') = ("source_recipe_id" IS NOT NULL))
  );

ALTER TABLE "IngredientStock" ADD CONSTRAINT "IngredientStock_quantity_non_negative"
  CHECK ("current_quantity" >= 0);

ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_source_xor"
  CHECK (
    (("waste_type" = 'ingredient') = ("ingredient_id" IS NOT NULL))
    AND (("waste_type" = 'prep_batch') = ("prep_batch_id" IS NOT NULL))
  );

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_non_negative"
  CHECK ("stock_on_hand" >= 0);

-- ─── SPEC §5.4 product search (tsvector via trigger + GIN index) ─────────────
CREATE OR REPLACE FUNCTION product_search_text_refresh() RETURNS trigger AS $$
BEGIN
  NEW."search_text" :=
    coalesce(NEW."name", '') || ' ' ||
    coalesce(NEW."description", '') || ' ' ||
    coalesce(NEW."story", '') || ' ' ||
    coalesce((SELECT c."name" FROM "ProductCategory" c WHERE c."id" = NEW."category_id"), '') || ' ' ||
    coalesce((SELECT b."name" FROM "Brand" b WHERE b."id" = NEW."brand_id"), '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_search_text_trg
  BEFORE INSERT OR UPDATE OF "name", "description", "story", "category_id", "brand_id"
  ON "Product"
  FOR EACH ROW EXECUTE FUNCTION product_search_text_refresh();

CREATE INDEX "Product_search_text_gin"
  ON "Product" USING GIN (to_tsvector('simple', "search_text"));
```

- [ ] Confirm `backend/prisma/migrations/migration_lock.toml` still reads `provider = "postgresql"` and that `ls backend/prisma/migrations` shows exactly one migration directory plus the lock file.
- [ ] `cd backend && npx prisma validate` — expect valid.
- [ ] `git add -A backend/prisma/migrations && git commit -m "feat(p2-15): single baseline migration with CHECK constraints and product search trigger" -- backend/prisma/migrations`

---

### Task 16: Apply to the database, reset, seed, and record the result

The local Docker Postgres (`konma-postgres`, `localhost:5433`, db/user/pass `konma`, shadow db `konma_shadow`) is reachable and `backend/.env` already points at it.

**Files:** none modified except `.planning/phases/` (walk-through record).

- [ ] `cd backend && npx prisma migrate reset --force` — drops and recreates the schema from the single baseline, then runs `prisma db seed`. Expected tail:
```
Applying migration `20260823120000_p2_platform_foundation`
Database reset successful
Running seed command `ts-node prisma/seed.ts` ...
[seed:reference] done — 8 roles, 12 meters, 8 zones, 2 brands, 7 channels, 20 unit conversions, 25 categories, N guide sections, 47 modules, 8 approval policies
[seed:demo] NEW demo credentials (shown once, never stored in plaintext): …
```
- [ ] `cd backend && npx prisma migrate status` — expect `Database schema is up to date!` and `1 migration found in prisma/migrations`.
- [ ] Drift check — the schema and the applied migration must agree exactly:
```bash
cd backend && npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://konma:konma@localhost:5433/konma_shadow \
  --exit-code
```
  Expect exit code `0` and `No difference detected.` (A non-zero exit means the schema drifted from the baseline — regenerate the migration rather than hand-patching.)

- [ ] Verify the hand-written SQL survived the reset:
```bash
psql postgresql://konma:konma@localhost:5433/konma -c "\d+ \"RecipeLine\"" | grep -c "RecipeLine_input_xor"
psql postgresql://konma:konma@localhost:5433/konma -c "SELECT tgname FROM pg_trigger WHERE tgname = 'product_search_text_trg';"
psql postgresql://konma:konma@localhost:5433/konma -c "SELECT count(*) FROM \"Node\"; SELECT count(*) FROM \"ModuleAccess\"; SELECT count(*) FROM \"ApprovalPolicy\"; SELECT count(*) FROM \"Product\";"
```
  Expect `1`, one row named `product_search_text_trg`, and counts `1 / 47 / 8 / 12`.

- [ ] Prove the CHECK constraints bite:
```bash
psql postgresql://konma:konma@localhost:5433/konma -c "UPDATE \"IngredientStock\" SET current_quantity = -1 WHERE true;"
```
  Expect `ERROR: new row for relation "IngredientStock" violates check constraint "IngredientStock_quantity_non_negative"`.

- [ ] Idempotency of the prod-safe seed: `cd backend && npm run seed:reference` twice — expect the same `[seed:reference] done` line both times and no unique-constraint error.
- [ ] `cd backend && npm run build` — expect `dist/src/main.js` to exist (`ls dist/src/main.js`).
- [ ] `cd backend && npx jest --silent` — expect `Test Suites: 56 passed, 56 total`.
- [ ] `cd frontend && npx tsc --noEmit && npm run build` — expect a clean build.
- [ ] Manual walk-through against the running stack (record the outcome in `.planning/phases/` per SPEC §11): log in as the demo admin → create a task → upload evidence → approve it → confirm the meter moved and `GET /audit?entity_type=task&entity_id=<id>` returns the `task.status_changed` row; receive a purchase order → confirm `StockMovement.movement_type = 'purchase_received'`; create a POS order for a `batch_prepared` product → confirm KDS shows it and stock deducted once; place a marketplace order → confirm one `Order`, one `Payment`, `AuditEvent(action='order.confirmed', actor_type='customer')`.
- [ ] `git status` — expect clean; no commit needed for this task.

---

## Self-review

**SPEC §3 / §11 P2 coverage → task**

| Spec item | Task |
|---|---|
| §3.1 `Node` (+ seed `KX-VILLA-1`, Asia/Kolkata, INR) | 5, 14 |
| §3.1 `node_id` on the listed aggregates; node-scoped uniques (`ReadinessMeter`, `ChannelModifier`, `Product`) | 5 (meters/modifiers), 9 (`Product.node_id_slug`) |
| §3.1 `AuditEvent` + audit in every status transaction + `GET /audit` | 6 |
| §3.1 `SystemSetting.value` Json + typed `get<T>` + allow-list | 7 |
| §3.1 `ModuleAccess` + §6.3 defaults (no UI) | 7 (model/API), 14 (seed) |
| §3.2 `Task.subject_type/subject_id`, `updated_by`, indexes | 2 |
| §3.2 `Evidence.source`/`bridge_event`, `EvidenceType` rename | 2 |
| §3.2 `ApprovalPolicy` (+ §4.4 gates seeded) | 8, 14 |
| §3.2 `Approval.entity_type/entity_id`, `Approval.task` relation removed, `policy_id` | 2, 5, 8 |
| §3.2 `DecisionStatus`, `GovernanceTier`, `DecisionVote` | 2, 8 |
| §3.2 `ReadinessMeter.mode/formula_key`, `ReadinessSignal`, `ReadinessSnapshot` | 8, 14 |
| §3.3 `Product`/`ProductCategory`/`ProductVariant`/`ProductMedia` replace `MenuItem`/`MenuCategory` | 9, 10, 11 |
| §3.3 availability per product type | 10 |
| §3.3 `Order`/`OrderItem`/`Payment` money and status fields | 4, 5 |
| §3.4 `Recipe.parent_recipe_id/version` | 3 |
| §3.4 drop legacy `Ingredient.category` | 3 |
| §3.4 `MovementType`, `PurchaseOrderStatus`, `PrepBatchStatus`, `Notification.type/channel` | 3 |
| §3.4 `EventBooking → Event` onDelete Restrict; `RecipeLine` cascade/restrict | 5 |
| §3.4 CHECKs (`RecipeLine` XOR, `IngredientStock >= 0`, `WasteLog` XOR) | 15 |
| §3 all `DateTime` timestamptz(3); `Decimal(12,2)` / `(14,4)` | 5 |
| §3 every enum-like field is a Prisma enum | 1 (declare), 2/3/4 (apply) |
| §3.5 removals (`MenuItem`, `MenuCategory`, `Ingredient.category`, `Approval.task`) | 3, 5, 11 |
| §5.4 product search tsvector + GIN + trigger | 10 (query), 15 (DDL) |
| §11 P2 "new seeds" | 14 |
| §11 P2 "fresh migration baseline", "all v1 flows green" | 15, 16 |
| Drop `process.env.TZ` in favour of `Node.timezone` | 13 |

**Deliberately deferred, with reason**
- `Shipment`, `ShipmentEvent`, `Refund`, `Coupon`, `CouponRedemption`, `LoyaltyAccount`, `LoyaltyTransaction`, `Review`, `UsageEvent` → **P5**, per the brief. Their enums (`ShippingProvider`, `ShipmentStatus`, `CouponType`, `LoyaltyTier`, `LoyaltyReason`, `ReviewStatus`) are declared in Task 1 and the `Order` money columns they write are added in Task 4, so P5 adds models and services only. This diverges from ROADMAP Phase 30 criterion 4 / `PLAT-08`, which list those models under Phase 30 — flag it when closing the phase so the roadmap text is corrected rather than the scope silently expanded.
- SPEC §3.5's frontend removals (`components/spectrumui/`, `p-combobox-3.tsx`, duplicate `MissionCard`/`GuideSectionCard`, `framer-motion`, `shadcn` runtime dep) and the BullMQ `.env.example` remnants → **P4** (`PLAT-09`), where the motion allowlist and design-token work happens. P2 touches no unrelated frontend component.
- Approval-policy **enforcement**, recipe approval through the policy, decision-vote tallying, derived-meter formulas and the mission bridge → **P3**; P2 ships only their tables and seeds (SPEC §11 draws the same line).
- `/shop` storefront routes and the `/menu` → `/shop` redirect (SPEC §5.1) → **P5**. P2 keeps `/menu` and `/operations/menu` and re-points them at `/catalog/*`.
- `Order.coupon_id` → **P5** (it needs the `Coupon` FK). `Order.zone_id` is **not** renamed to `fulfilment_zone_id` (decision 2 above).

**Placeholder scan:** no TODO, TBD, "similar to" or "etc." stands in for code. Three steps are deliberate mechanical operations with the exact command and the exact exception list given: the timestamptz `node -e` one-liner (Task 5), and the backend/frontend `sed` renames (Tasks 11, 12) — each is followed by a named list of the sites the sweep gets wrong and a `grep` that proves the sweep is complete. Task 10's availability block is a verbatim copy with an enumerated substitution list rather than a re-listing of 140 unchanged lines. Task 14's demo catalog is specified as a table plus the invariants the rows must satisfy, because the twelve rows are data, not logic.

**Name consistency across tasks:** `DEFAULT_NODE_ID` / `DEFAULT_NODE_CODE` (Tasks 5, 6, 9, 10, 14); `Tx` from `common/types/transaction` (Tasks 1, 6, 10); `AuditService.record` / `AuditService.user` / `AuditService.customer` / `AuditInput` (Task 6, called in 6 only); `SETTING_DEFAULTS` / `SETTING_KEYS` / `SettingsService.get` (Tasks 7, 14); `parseEnum` / `isEnumValue` (Task 1); `CatalogService` methods `findCategories`, `createCategory`, `updateCategory`, `removeCategory`, `findProductsPublic`, `findProductsStaff`, `findProductBySlug`, `search`, `createProduct`, `updateProduct`, `setStatus`, `archiveProduct`, `assertRecipeUsable`, `upsertVariant`, `removeVariant`, `addMedia`, `removeMedia`, `findAllForExport`, `findModifiers`, `upsertModifier`, `computeServings`, `lineStockQty`, `servingsFromStock`, `getServingsAvailable`, `getAllServingsAvailable` (Tasks 10, 11); `nodeDayRange` / `nodeDateRange` / `nodeDayKey` / `formatInNodeTz` / `tzOffsetMinutes` (Task 13); `ProductsExportBuilder` and registry key `'products'` (Tasks 10, 12); import registry keys `'product_categories'` / `'products'` (Tasks 11, 12); migration directory `20260823120000_p2_platform_foundation` (Tasks 15, 16).

**Consumers of `MenuItem`/`MenuCategory` found by grep → migrating task**

| Consumer (absolute path) | Task |
|---|---|
| `backend/prisma/schema.prisma` (`MenuItem`, `MenuCategory`, `Recipe.MenuItems`, `Brand.menu_categories`, `OrderItem.menu_item_id`) | 9 (add Product), 11 (drop) |
| `backend/src/menu/menu.service.ts`, `menu.controller.ts`, `menu.module.ts`, `dto/*` (5), `menu.service.spec.ts` | 10 (deleted, replaced by `src/catalog/`) |
| `backend/src/orders/orders.service.ts`, `orders/dto/create-order.dto.ts`, `orders.service.spec.ts` | 11 |
| `backend/src/customer-orders/customer-orders.service.ts`, `dto/sync-cart.dto.ts`, `receipt.template.ts`, `customer-orders.service.spec.ts` | 11 |
| `backend/src/fulfilment/fulfilment.service.ts`, `fulfilment.service.spec.ts` | 11 |
| `backend/src/kitchen/kds/kds.service.ts`, `kds.service.spec.ts` | 11 |
| `backend/src/kitchen/pick-and-pack/pick-and-pack.service.ts` | 11 |
| `backend/src/analytics/analytics.service.ts`, `analytics.service.spec.ts` | 11 |
| `backend/src/recipes/recipes.service.ts` (delete guard) | 11 |
| `backend/src/exports/builders/menu.builder.ts`, `exports/exports.module.ts`, `exports/export-types.ts` | 10 |
| `backend/src/imports/import-types.ts`, `imports.service.ts`, `template.service.ts`, `validators/menu-items.validator.ts`, `validators/menu-categories.validator.ts` | 11 |
| `backend/src/webhooks/webhooks.service.spec.ts` | 11 |
| `backend/src/test-utils/mock-providers.ts` | 10 |
| `frontend/lib/types/menu.ts`, `index.ts`, `orders.ts`, `marketplace.ts`, `kds.ts`, `kitchen.ts`, `analytics.ts`, `exports.ts`, `imports.ts` | 12 |
| `frontend/lib/stores/cart-store.ts` | 12 |
| `frontend/app/(ops)/operations/menu/page.tsx`, `app/(ops)/pos/page.tsx`, `app/(public)/menu/page.tsx`, `app/(public)/profile/page.tsx`, `app/(public)/orders/[id]/track/page.tsx`, `app/(ops)/admin/import/page.tsx`, `app/(ops)/admin/import/[type]/page.tsx` | 12 |
| `frontend/components/ops/operations/menu/*` (4), `components/ops/pos/*` (5), `components/ops/kitchen/kds/KdsOrderItem.tsx`, `KdsBoard.tsx`, `components/ops/kitchen/pick-and-pack/PickAndPackOrderCard.tsx`, `components/ops/analytics/TopItemsList.tsx` | 12 |
| `frontend/components/public/MenuItemOrderCard.tsx`, `MenuItemPublicCard.tsx`, `CategoryTabBar.tsx`, `CartBottomSheet.tsx`, `CustomerOrderCard.tsx` | 12 |
| `frontend/components/ops/operations/recipes/builder/RecipeCostPanel.tsx`, `RecipeBuilderPage.tsx` (prop `menuItemPrice` only) | 12 |

**Excluded as false positives** (shadcn/tiptap identifiers, not the model): `frontend/components/ui/dropdown-menu.tsx`, `components/ops/Sidebar.tsx` (`DropdownMenuItem`), `components/ops/chat/MessageThread.tsx`, `ConversationList.tsx`, `app/(ops)/admin/users/page.tsx`, `app/(auth)/team/page.tsx`, `components/ops/guide/admin/GuideEditor*`, and `frontend/lib/types/asset.ts` (`AssetType = 'menu'`). The `/menu` **href** targets in `app/page.tsx`, `app/(public)/login/page.tsx`, `app/(public)/error.tsx`, `app/(auth)/team/page.tsx` and `components/ops/Sidebar.tsx:92,304` are route strings, deliberately left alone in P2 (decision 8) and changed in P5.

**Persisted-shape risks called out in the plan:** the Redis `cart:{customer_id}` / `pending_order:{rzp_order_id}` payloads and the browser `localStorage['cart-storage']` both carry `menuItemId`; Task 11 adds a shape filter on the Redis read and Task 12 bumps the zustand store version, so stale carts are dropped rather than half-read.
