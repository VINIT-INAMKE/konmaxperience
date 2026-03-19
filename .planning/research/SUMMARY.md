# Project Research Summary

**Project:** Konma Xperience OS
**Domain:** Role-based food operations platform (internal ops + customer-facing)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

Konma Xperience OS is a first-of-its-kind socio-technical operating system that fuses three distinct software categories: a Work OS (missions, quests, tasks, OKRs, governance), a food operations platform (standardization, asset management, zone coordination), and a customer-facing hospitality product (ordering, booking, feedback). No existing product combines all three — this means there is no single playbook to follow, but the patterns for each layer are individually well-documented. The research consensus is clear: build as a Next.js monolith for v1, with a service layer that decouples business logic from the API, PostgreSQL (Neon) as the relational backbone for 15 tightly-joined entities, and NestJS-style RBAC patterns implemented via middleware and data-layer scoping rather than route guards alone.

The core value proposition — and the most architecturally sensitive area — is the evidence-backed task validity chain: `task completion → evidence upload → approval → valid task → XP → readiness meter`. This cascade is what makes the system defensible against "done theater" and what differentiates it from both standard PM tools and restaurant POS systems. Getting this chain right in Phase 1 is the single most important technical decision. Every downstream feature (XP, leaderboard, readiness meters, mission progress, phase unlock gates) is a downstream consumer of this chain — if the chain is broken or inconsistent, the entire intelligence layer produces garbage.

The principal risks are architectural, not feature-level. Specifically: (1) the validation cascade must be wrapped in a single PostgreSQL transaction or partial failures will produce permanently inconsistent XP/readiness state; (2) RBAC must be enforced at the data layer (WHERE clauses), not just at the route layer, or scoped users can extract any data via query param manipulation; (3) approval deadlocks will freeze mission progress if there is no founder override or role delegation path. All three risks must be resolved in Phase 1, before any user touches the system. The customer-facing layer and gamification intelligence layer can be built confidently once Phase 1 delivers a working, consistent validation engine.

---

## Key Findings

### Recommended Stack

The stack decision is unambiguous. NestJS 11 on the backend provides first-class RBAC primitives (Guards, Decorators, DI), a module system that maps 1:1 onto the 15-entity domain model, and TypeScript-first integration with Prisma 7 for schema-safe migrations. For the frontend, Next.js 16 (App Router) with route groups cleanly separates the internal ops surface from the customer-facing storefront without running two applications. Both layers share the same Neon PostgreSQL database. The architecture research proposes a monolith-first approach with all API logic in Next.js Route Handlers for v1 — this is the right call for 8 internal users and avoids the overhead of coordinating two deployed services.

The infrastructure choices are cost-optimized for an early-stage single-node operation: Cloudflare R2 over AWS S3 (zero egress fees for evidence file retrieval), Upstash Redis over a managed Redis server (serverless, pairs with Vercel deployment model), and Neon Postgres with Vercel's native integration (branch-per-PR preview environments at no extra cost). The NestJS backend should deploy to Railway or Render — not Vercel, which has cold-start and execution limits unsuitable for a stateful NestJS API.

**Core technologies:**
- Next.js 16.2: Frontend + customer-facing UI — App Router with route groups, Turbopack stable, SSR for role dashboards
- NestJS 11.1.x: Backend REST API — opinionated structure matches the 15-entity domain, RBAC Guards/Decorators built-in, TypeScript-first
- PostgreSQL 16 (Neon): Primary database — all 15 entities are relational with ACID transactions required for validation cascade
- Prisma 7.x: ORM — schema-first type safety, migration tooling, NestJS official recipe
- shadcn/ui + Tailwind CSS 4.x: UI layer — Radix primitives, accessible, composable, Tailwind v4 compatible
- React Query 5.x: Client state/data fetching — caching, invalidation, optimistic updates
- BullMQ 5.x + Upstash Redis: Background jobs — notifications, XP recompute, readiness recalculation
- Cloudflare R2: Evidence file storage — S3-compatible API, zero egress fees
- Zod 4.x: Schema validation — shared schemas between frontend and backend

**Critical version requirements:**
- NestJS 11.x requires Node.js 18+ minimum
- BullMQ 5.x must match @nestjs/bullmq 10.x (major version parity required)
- Zod 4.x requires `@hookform/resolvers/zod` for React Hook Form compatibility
- Tailwind CSS 4.x uses CSS-first config — no `tailwind.config.js`

### Expected Features

The feature research identifies this system as spanning three audiences with distinct expectations. Internal table stakes (role-scoped dashboards, task management, evidence upload, approval flows) must be solid before any differentiators are built. Customer-facing table stakes (menu browsing, online ordering, experience booking) can follow but require the internal asset system to exist first — the customer menu is a filtered view of approved internal assets, not a separate data model.

**Must have (table stakes — v1 launch):**
- Auth with JWT + role-scoped views (8 roles, 15 permission enums) — nothing in the system works without this
- Mission → Quest → Task hierarchy with CRUD — the structural spine
- Task status transitions (todo → doing → done → blocked) — daily workflow primitive
- Evidence upload with multi-type support (photo, doc, link minimum) — the differentiation engine
- Approval flows for evidence and tasks — required gate for task validity
- Task validity engine (status + evidence + approval = valid) — core business rule, fully specified in pseudo-code
- XP calculation and level assignment (valid tasks only) — cannot be gamed
- Readiness meters (10 meters, event-sourced) — operational health signal
- Quest and mission progress auto-calculation — accountability layer
- Role-based dashboards (founder + role-user views) — the UI surfaces for all of the above
- Leaderboard (derived from valid XP, low additional effort once XP works)
- Notifications: deadline, blocker, level-up, approval pending (email-first)
- Zone management (6 villa zones), brand management (2 brands), channel management, asset library
- Menu browsing (public, no login), online ordering, customer feedback, experience booking

**Should have (competitive differentiators — v1.x):**
- Streak tracking — needs 2+ weeks of usage to be meaningful
- Phase unlock gates (readiness-based phase transitions) — requires real readiness data to trigger
- Decision log UI (governance board) — important but can start as manual tracking
- Governance consensus flows (2+1 rule UI) — schema ready, formal UI follows initial usage
- Ad-hoc task injection UI shortcut in admin dashboard

**Defer (v2+):**
- AI-generated task/recipe recommendations — requires 6+ months of usage data
- Customer loyalty program — requires ordering volume and repeat customer data
- Native mobile app — responsive web is sufficient until customer volume justifies native
- Inventory management (stock, purchase orders) — ERP-level complexity; v2
- Cross-node federation — requires a second live node to test
- POS hardware integrations — not needed for villa's curated model

**Explicit anti-features (do not build):**
- Real-time collaboration (live cursors) — no value for 8 async internal users
- Blockchain evidence integrity — zero practical benefit, meaningful infrastructure cost
- GraphQL — REST is sufficient for v1 per dev spec
- Socket.io for notifications — BullMQ + email is adequate for 8 users in v1

### Architecture Approach

The recommended architecture is a Next.js monolith with two route groups — `(ops)` for the authenticated internal surface and `(customer)` for the public storefront — sharing a single PostgreSQL database. All API logic lives in Next.js Route Handlers (`app/api/*`). Business logic is decoupled into a service layer (`lib/services/`) with plain TypeScript modules that are independently testable. The edge middleware (`middleware.ts`) handles JWT decode and role injection into request headers for all protected routes. This single-process design is appropriate for v1 scale; the service layer structure means individual engines (validation, gamification, readiness) can be extracted into separate services at 1,000+ users without rewriting business logic.

**Major components:**
1. Next.js middleware.ts — JWT decode, role extraction, route guard at edge; injects `x-role` and `x-user-id` headers
2. `(ops)` route group — authenticated internal pages with role-scoped sidebar nav
3. `(customer)` route group — public customer storefront, reads only `status=approved` assets
4. Route Handlers `app/api/*` — thin adapters: validate input, call service, return response
5. Validation Engine (`lib/services/validation.ts`) — the core cascade: task validity → XP → quest progress → mission progress → readiness event
6. Gamification Engine (`lib/services/gamification.ts`) — XP calculation, level assignment, leaderboard aggregation; triggered only by validation
7. Readiness Engine (`lib/services/readiness.ts`) — applies `task_readiness_events`, aggregates meter values; idempotent by design
8. Approval Engine (`lib/services/approval.ts`) — creates approval records, checks satisfaction, triggers downstream
9. Notification Engine (`lib/services/notifications.ts`) — BullMQ-backed job dispatch; failures never block core operations
10. PostgreSQL (Neon) — source of truth for all 15 entities with FK constraints enforced
11. S3-compatible storage (Cloudflare R2) — evidence files via presigned URL; API server never buffers file bytes

**Key patterns:**
- Validation cascade pattern: any evidence/approval/task state change triggers `validateTask()` which cascades all five downstream writes inside one DB transaction
- Presigned URL upload: browser PUTs directly to R2; DB stores only the URL string; no file bytes touch the Node.js process
- Audience-aware API responses: same endpoint returns all records for internal users, only `status=approved` records for customer-facing requests
- RBAC at data layer: `buildScopeFilter(user)` appended to every query regardless of client-supplied filters

### Critical Pitfalls

1. **Validation cascade inconsistency (CRITICAL)** — If any step in the `validate_task` cascade fails mid-execution without a wrapping transaction, the system lands in permanently inconsistent state (XP incremented, quest progress not updated, etc.). Prevention: wrap the entire cascade in a single PostgreSQL transaction; use BullMQ for notification side-effects outside the transaction boundary.

2. **RBAC enforced at route layer only, not data layer (CRITICAL)** — A `VIEW_ROLE_SCOPED` user calling `GET /tasks?owner_user_id=other_user_id` will get another user's data if the service layer does not append `WHERE owner_user_id = req.user.id` unconditionally. Prevention: implement `buildScopeFilter(user)` in the service layer and call it before every query; never trust client-supplied owner filters from scoped roles.

3. **Stale permissions in JWT payload (CRITICAL)** — Embedding a `permissions: [...]` array in the JWT means permission changes don't take effect until token expiry (up to 24 hours). Prevention: store only `user_id` and `role_code` in JWT; look up current role permissions from a short-lived cache (Redis, 60-second TTL) on each request.

4. **Approval deadlock — no escalation path (HIGH)** — With approval records tied to specific named roles, one unavailable team member (sick, traveling, departed) freezes all approvals in their domain indefinitely. Prevention: add `delegate_user_id` to users table; add `founder_override` capability on approvals; build 24-hour escalation notification with one-click override on founder dashboard.

5. **Readiness meter over-attribution on invalidation-revalidation cycles (HIGH)** — The idempotency check for `task_readiness_events` short-circuits on re-validation of a previously-invalidated task. Prevention: add `revoked_at` timestamp to `task_readiness_events`; revoke events when task is invalidated, subtract from meter; create new event on re-validation; use DB partial unique constraint `UNIQUE(task_id, readiness_meter_id) WHERE revoked_at IS NULL`.

6. **Ad-hoc task injection breaking quest progress (MEDIUM)** — Adding a task to an active quest mid-flight increases the denominator and makes progress appear to go backward (80% → 73%), eroding team trust. Prevention: separate `core_progress_percent` from `adhoc_progress_percent` from Phase 1; store `baseline_task_count` at quest creation; ad-hoc additions never change core progress.

---

## Implications for Roadmap

Feature dependencies create a natural and strict build order. The validation engine sits at the bottom of the dependency tree — everything else (XP, readiness, leaderboard, dashboards, customer features) depends on it working correctly and transactionally. Customer-facing features depend on the internal asset system having approved records to serve. Notifications are additive and can follow core ops without blocking it. This structure suggests 5 phases matching the architecture research's recommended build order.

### Phase 1: Foundation + Core Validation Engine

**Rationale:** Nothing in the system works without auth, the data model, and the validation cascade. This phase is the critical path. All 7 critical pitfalls are in scope here — the decisions made in Phase 1 about transaction boundaries, RBAC data-layer enforcement, and JWT architecture cannot be economically retrofitted later.

**Delivers:** Working auth with RBAC, full 15-entity database schema, Mission → Quest → Task CRUD, evidence upload (presigned URL pattern), approval engine, and the complete validation cascade (task validity → XP → quest progress → mission progress → readiness event) in a single DB transaction.

**Addresses:** Auth/RBAC, Mission/Quest/Task hierarchy, Evidence upload + approval, Task validity engine, XP calculation, Readiness meters (schema + engine), Quest and mission progress calculation.

**Avoids:**
- Cascade inconsistency: wrap `validateTask()` in one PostgreSQL transaction from day one
- RBAC data-layer bypass: implement `buildScopeFilter(user)` before any endpoint ships
- Stale JWT permissions: store only `role_code` in token, cache permissions in Redis
- Approval deadlock: build `founder_override` and `delegate_user_id` before going live
- Readiness double-counting: add `revoked_at` to `task_readiness_events` at schema creation time
- Ad-hoc progress regression: add `baseline_task_count` + dual-track progress to quest schema

**Research flag:** NEEDS DEEPER RESEARCH — specifically the Prisma transaction API for nested service calls, and the Next.js middleware JWT verification approach for edge-compatible crypto libraries.

### Phase 2: Ops Intelligence Layer

**Rationale:** With a working validation engine, the intelligence layer (gamification, readiness visualization, KPI tracking, governance) can be built on top of real, consistent data. These features are downstream consumers of Phase 1's outputs. Building them before the validation engine is solid would result in building on top of a broken foundation.

**Delivers:** Leaderboard (sorted valid XP), readiness meter dashboards, KPI tracker, cross-function decision board with 2+1 consensus approval flow, decision log.

**Addresses:** Leaderboard, readiness meter UI, KPI tracking, governance/decision log, cross-functional approval gates.

**Uses:** Gamification Engine (`lib/services/gamification.ts`), Readiness Engine (`lib/services/readiness.ts`), approval records for cross-function decisions.

**Avoids:**
- Leaderboard demotivation: add role-normalized progress display alongside raw XP; include opt-in or soft-default behavior from the start
- Decision log immutability: decisions allow INSERT and status UPDATE only — no DELETE after `status=approved`

**Research flag:** STANDARD PATTERNS — leaderboard queries, materialized views, and approval consensus flows are well-documented. No deeper research needed.

### Phase 3: Ops Dashboards + Notifications

**Rationale:** Dashboards aggregate data already computed in Phases 1 and 2. Notifications are side-effects of state changes already handled. Both are primarily view-layer and job-dispatch work. Building these after the data layer is stable ensures dashboards are accurate from day one.

**Delivers:** Founder mission control dashboard (blockers, pending approvals, readiness overview), role-user dashboard (my tasks, my quests, my evidence, my contribution meters), BullMQ-backed notification system (deadline nudges, approval alerts, level-up alerts, blocker alerts, near-complete quest alerts).

**Addresses:** Role dashboards (founder + user views), Notifications (all 5 trigger types).

**Uses:** BullMQ + Upstash Redis, Vercel Cron for hourly notification polling, email (Resend or Nodemailer) as first notification channel.

**Avoids:**
- Notifications blocking core operations: notification jobs are dispatched to BullMQ queue; failures never fail the triggering API request
- N+1 query on dashboard queries: write raw SQL aggregations for dashboard rollups; do not load full object graphs from ORM

**Research flag:** STANDARD PATTERNS — BullMQ queue setup and Vercel Cron integration are well-documented. Dashboard aggregation SQL patterns are straightforward.

### Phase 4: Internal Ops Data Management

**Rationale:** Zone management, brand management, channel management, and asset library are relatively low-complexity data management features. They enhance context for tasks and provide the data foundation that the customer-facing layer will consume. They should exist before customer features but do not need to block the core validation engine or dashboards.

**Delivers:** Zone management (6 villa zones with digital-physical mapping), brand management (Konma Food + Just Craves), channel management (dine-in, delivery, takeaway, events), asset library (8 asset types: recipes, SOPs, menus, cost sheets, etc.), asset approval workflow (ops team approves assets that become visible to customers).

**Addresses:** Zone management, brand management, channel management, asset management (all P1 features with LOW complexity).

**Uses:** Asset entity with typed records; asset approval flows reuse the approval engine from Phase 1.

**Avoids:**
- Separate "customer menu" data model: customer menu is a filtered view of `assets` table (`asset_type=menu`, `status=approved`) — no duplication.

**Research flag:** STANDARD PATTERNS — CRUD with file associations and status workflows are well-documented. No deeper research needed.

### Phase 5: Customer-Facing Layer

**Rationale:** The customer surface can only be built after the internal asset system has approved records to serve. Online ordering requires a menu (approved menu assets), an orders entity, and availability re-validation at checkout. Experience booking requires the channel structure. This phase is the final layer and has the most integration surface area with third-party services (payment gateway).

**Delivers:** Menu browsing (public, reads approved menu assets), online ordering (new `orders` entity, payment integration, availability re-validation at `POST /orders`), experience/event booking (new `bookings` entity, slot-based or ticketed), customer feedback form.

**Addresses:** Menu browsing, online ordering, experience booking, customer feedback (all P1 customer-facing features).

**Uses:** `(customer)` route group in Next.js, audience-aware API responses (approved-only assets), payment intent pattern for ordering (create order in `pending_payment`, confirm on payment webhook).

**Avoids:**
- Customer ordering without availability guard: re-validate `is_available` on every menu item at `POST /orders` time, not only at menu-load time; return `ITEM_UNAVAILABLE` error before payment
- Payment accepted before confirmed: use payment intent pattern; never set order `status=confirmed` before payment webhook fires
- Customer access to internal endpoints: middleware must distinguish customer tokens from internal role tokens

**Research flag:** NEEDS DEEPER RESEARCH — payment gateway integration (Razorpay or Stripe for India market), webhook handling for payment confirmation, and slot-based booking availability logic need provider-specific research before implementation.

### Phase Ordering Rationale

- **Phase 1 must precede everything** because XP, readiness, leaderboard, dashboards, and customer features are all downstream of the validation cascade. Building any of them before Phase 1 is complete means building on an unverified foundation.
- **Phase 2 follows Phase 1** because it processes outputs (valid tasks, XP, readiness events) that Phase 1 produces. Without Phase 1's consistency guarantees, intelligence features produce incorrect data.
- **Phase 3 follows Phase 2** because dashboards aggregate intelligence-layer data. Notifications reference gamification events (level-up) that Phase 2 introduces.
- **Phase 4 can overlap with Phase 2-3** for the non-approval-dependent parts (zones, brands, channels). The asset approval workflow requires Phase 1's approval engine, so asset management must wait for Phase 1 completion.
- **Phase 5 must follow Phase 4** because the customer menu requires approved assets, and ordering requires active channels — both produced by Phase 4.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1:** Prisma transaction API for nested cascade service calls; edge-compatible JWT verification library for Next.js middleware (jose or similar); specific Neon connection configuration for Railway-deployed NestJS
- **Phase 5:** Payment gateway integration (Razorpay vs Stripe for India market); webhook handling and idempotency for payment confirmation; slot-based booking availability and overbooking prevention logic

Phases with standard patterns (skip research-phase):
- **Phase 2:** Leaderboard queries, materialized views, approval consensus — well-documented patterns
- **Phase 3:** BullMQ queue setup, Vercel Cron, email notification — well-documented
- **Phase 4:** CRUD with status workflows, file-based asset management — straightforward

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | NestJS, PostgreSQL, Prisma, Next.js, Cloudflare R2 all backed by official docs and multiple high-quality sources. Version compatibility verified. Only storage provider confidence is MEDIUM (Cloudflare R2 is S3-compatible but slightly less documented for edge cases). |
| Features | HIGH (core ops), MEDIUM (gamification integration patterns) | Internal table stakes and customer-facing features are well-researched against industry analogues. Gamification integration with ops workflows (XP from valid work only) is novel — patterns exist in isolation but the combined model is proprietary. |
| Architecture | HIGH | Monolith-first Next.js + service layer pattern is backed by official Next.js documentation and multiple 2025-2026 implementation guides. The specific cascade pattern matches the dev spec exactly. |
| Pitfalls | HIGH (critical pitfalls), MEDIUM (integration and performance) | Critical pitfalls (cascade inconsistency, RBAC bypass, JWT staleness, approval deadlock) are backed by authoritative security and architecture sources. Performance trap estimates (N+1 at 200 tasks, leaderboard at 8 users) are directionally correct but thresholds are estimates. |

**Overall confidence:** HIGH

### Gaps to Address

- **Payment gateway selection (Phase 5):** Research did not evaluate specific payment providers for the India market (Razorpay, Cashfree, Stripe India). This must be resolved before Phase 5 planning — the choice affects both backend webhook handling and frontend checkout UX.
- **Booking/reservation logic (Phase 5):** Experience booking availability, slot management, and overbooking prevention are not covered in current research. Industry patterns exist (SevenRooms, EatApp) but specific implementation for the villa's curated model needs a dedicated research spike.
- **Notification delivery (Phase 3):** Email provider is specified as Resend or Nodemailer but not evaluated. WhatsApp Business API (for the India team) requires a separate evaluation before Phase 3 implementation.
- **Prisma transaction boundaries (Phase 1):** The exact Prisma 7.x API for wrapping multi-service calls in a single transaction (particularly with `$transaction()` and interactive transactions) should be validated against the cascade service architecture before Phase 1 implementation begins.
- **Role delegation UX (Phase 1):** The founder override / delegate mechanism for approval deadlock prevention needs UX definition — specifically which admin actions are available, how delegation is set/unset, and how the override is audited.

---

## Sources

### Primary (HIGH confidence)
- NestJS 11 official docs — authentication, guards, queues, RBAC patterns
- Next.js 16 official docs — App Router, route groups, middleware, Route Handlers
- Prisma + NestJS official recipe — ORM integration pattern
- Dev spec (`contextdocs/dev_spec.md`) + system layers (`contextdocs/technical.md`) — primary domain specification, 15-entity model, pseudo-code for cascade

### Secondary (MEDIUM confidence)
- NestJS + BullMQ + Redis — background job processing patterns (Medium)
- S3 Presigned URL Architecture — client-direct upload for evidence files (DEV Community)
- RBAC with Custom Guards in NestJS — Guard + decorator RBAC pattern (OneUptime, Jan 2026)
- Next.js App Router patterns 2026 — Server/Client component boundaries (DEV Community)
- MongoDB vs PostgreSQL for enterprise — RBAC + ACID for complex relational data (Xenoss, Astera)
- Cloudflare R2 vs AWS S3 — egress cost analysis (DigitalApplied)
- shadcn/ui Tailwind v4 docs — Tailwind 4 compatibility
- Restaurant operations management research — Xenia, Operandio, SynergySuite, Restaurant365, UpMenu
- Gamification in project management — ClickUp, Xperiencify, Growth Engineering
- Approval workflow best practices — Digital Project Manager, Moxo, ACM

### Tertiary (MEDIUM-LOW confidence)
- RBAC pitfalls — OSO HQ, Permit.io, Hoop.dev (security community, well-regarded)
- Race conditions in database transactions — Doyensec, PlanetScale (N+1 pattern)
- Customer ordering problems — Deonde (industry blog, directionally useful)
- Workplace gamification moral agency research — CMU / phys.org (Feb 2026 — informs leaderboard UX approach)

---

*Research completed: 2026-03-19*
*Ready for roadmap: yes*
