# Konma Xperience OS

> Canonical specification: `/SPEC.md` (v2.0, 2026-08-22). This file summarises it for GSD; when they disagree, SPEC.md wins. `contextdocs/`, `contextdocsv2/`, `contextdocsv3/` are historical.

## What This Is

The operating system for a Konma node — today one 4,000 sq ft villa where **Konma Food** designs and standardises (R&D → recipe → SOP) and **Just Craves** executes and sells (kitchen → service → channels → shipped products → experiences). Eight internal roles use it to turn real operational work into evidence-backed, approved, measured readiness; the same system sells what the node produces through one Konma-only storefront: prepared food (local), packaged products (shipped nationally via Shiprocket), experiences (capacity bookings), and merchandise/art/lifestyle goods (tracked stock). Food-first; v2.0 closes the loop so operational events become mission evidence automatically instead of being re-typed.

## Core Value

Every piece of work must be evidence-backed, approved, and validated before it counts — turning real execution into measurable readiness and progress across the entire operation. The daily loop: *what must I move today → I do the real work → the work itself becomes the proof → someone with skin in the game signs it off → a meter I care about moves.*

## Requirements

### Validated

**v1.0 MVP (Phases 1–13, shipped 2026-03-22; audit: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`)**

- [x] Authentication & RBAC — JWT, 8 roles, 23 permissions, scope filtering, user/role admin (Phase 1)
- [x] Mission/Quest/Task hierarchy with role-based assignment, CORE/ADHOC/IMPROVEMENT types, ad-hoc injection, dependencies, blockers, dual-track progress (Phase 2)
- [x] Evidence upload (R2 presigned), approval workflow, task validation engine (status + evidence + approval = valid) with cascade (Phase 3)
- [x] Gamification & Readiness Intelligence — XP, levels, leaderboard, 10 readiness meters (task-driven, event-sourced), KPI tracking (Phase 4)
- [x] Governance — decision logging, approval override/escalation, delegation with audit trail (Phase 5). *2+1 consensus votes and policy-driven approval gates were not built; they are v2.0 Phase 31.*
- [x] Operations Management — zones, brands, channels, asset library with upload and status workflow (Phase 6)
- [x] Recipe & Ingredient Management — unified recipes with polymorphic BOM, unit conversion, vendors, recursive cost calculation, menu items with channel pricing (Phase 7)
- [x] Inventory & Procurement — stock tracking, PO workflow with receiving, movement audit trail, low-stock alerts, procurement dashboard (Phase 8)
- [x] Kitchen & Prep — prep batch FIFO deduction, full-screen KDS with polling, waste logging, expiry cron, menu availability, kitchen metrics (Phase 9)
- [x] POS & Orders — staff POS, order-to-kitchen-to-deduction flow, payment tracking, own-rider delivery dispatch, order history (Phase 10)
- [x] Dashboards & Shared Boards — founder mission control (readiness strip, approvals, blockers, decisions, leaderboard), role user dashboard (my tasks/quests/evidence/contribution meters), analytics (Phase 11)
- [x] Notifications — in-app bell + page, MailerSend critical email, deadline/blocker/approval/level-up/order nudges (Phase 12)
- [x] Customer-facing: post-dining feedback and ratings, experience/event booking with capacity, public digital menu (Phase 13)

**v1.1 User Guide, Data Management & Commerce Foundations (Phases 14–28, complete 2026-03-27)**

- [x] Guide Foundation — GuideSection/GuidePage, MANAGE_GUIDE, role-filtered CRUD API, XSS sanitisation (Phase 14)
- [x] Guide Reader View — role-gated section index, Tiptap prose renderer, sidebar navigation (Phase 15)
- [x] Admin CMS — Tiptap editor, image upload, callouts, autosave, publish workflow (Phase 16)
- [x] Search, Preview & Seeding — Cmd+K tsvector search, preview-as-role, 12 sections / 39 pages of real content (Phase 17)
- [x] Data Export — CSV/XLSX for 22 report types with R2 storage and history (Phase 18)
- [x] Master Data Import + export gaps + IST timezone (Phase 19)
- [x] Operations Import — stock, recipes, menu, events, tasks, quests, KPIs (Phase 20)
- [x] In-App Chat — 1-1 and group messaging via Pusher, admin oversight (Phase 21)
- [x] Recipe Page Redesign — full-page builder, dnd-kit BOM, live cost preview, draft→pending→approved→archived, versioning (Phase 22)
- [x] Razorpay Payments + Customer Auth — WhatsApp OTP identity, customer JWT, Razorpay orders/webhooks/refunds for events and POS (Phase 23)
- [x] Customer Marketplace (v1) — Redis cart, /menu ordering for takeaway/delivery, Razorpay checkout, Pusher order tracking, addresses, receipts, profile (Phase 24)
- [ ] ~~Third-Party Delivery Integration (Porter + Shiprocket)~~ — **Phase 25: not built (no code exists, no plans written; ROADMAP previously claimed 4/4). Superseded by v2.0 Phase 33 (P5 Shiprocket).**
- [ ] ~~Order Detail Page (/orders/[id] for staff)~~ — **Phase 26: not built (empty phase directory, no code). Folded into v2.0 Phase 34 staff Orders screen.**
- [x] Mission Flow & Assessment Gap Closure — mission-control aggregation API, PO→Task linking, activity feed, team contribution, Today's Focus, breadcrumbs (Phase 27)
- [x] Recipe preparation_type (scratch / batch_prepared / ready_to_sell / assemble) with forked availability, deduction timing, KDS routing, Pick & Pack queue; ingredient usage_type + supply usage log; DB ingredient categories (Phase 28)

### Active

v2.0 work is specified in `SPEC.md` and itemised in `.planning/REQUIREMENTS.md` ("v2.0 Requirements"). Headline items:

- [ ] Stop the bleeding — 14 Critical/High defects fixed with regression tests, config validation, safe seeds, error boundaries, CI enforcing (Phase 29)
- [ ] Platform foundation — fresh migration baseline with Node, enums, AuditEvent, Task.subject, ApprovalPolicy, Product replacing MenuItem (Phase 30)
- [ ] Mission bridge — domain events → evidence + readiness signals, derived meters with history, policy-generated approvals, decision votes (Phase 31)
- [ ] Role-aware IA + identity — persistent mission header, spine navigation, ModuleAccess, real /tasks, brand tokens light + dark (Phase 32)
- [ ] Marketplace backend — catalog, mixed-fulfilment quote/checkout, Shiprocket shipments, coupons, loyalty, reviews, search, refunds (Phase 33)
- [ ] Marketplace storefront + staff commerce screens — desktop + SEO storefront, account, shipments queue, catalog admin (Phase 34)
- [ ] Run-it layer — WhatsApp nudges, daily close, theoretical vs actual food cost, usage dashboard, human-in-the-loop AI assists (Phase 35)

### Out of Scope

**v2.0 non-goals (SPEC.md §1.2):**

- Multi-vendor sellers, commissions, payouts (Razorpay Route) — Konma brands are the only sellers
- Cash on delivery — prepaid only
- Multi-node *operation* (two live villas), cross-node federation or benchmarking — `node_id` is present; only one node is seeded
- Native mobile apps — web-first, responsive
- Art/lifestyle *workflows* (studio R&D, residencies) — art and lifestyle *products* are sold; their production is not modelled
- AI that approves evidence, assigns readiness values, sets prices, or is the primary UI — P6 AI is assist-only, human-in-the-loop
- Replacing Razorpay, Pusher, MailerSend, R2, Neon, Railway, Vercel

**Standing exclusions:**

- Blockchain integration — not needed
- Python/FastAPI backend, Supabase, monorepo tooling, Prisma 7 — stack is fixed (SPEC.md §1.3)
- The 21-role model in `contextdocsv3/` — retired; 8 roles only

## Context

### Ecosystem Structure
- **Konma Food** = system builder (R&D, recipes, brand onboarding, SOPs, knowledge capture)
- **Just Craves** = system runner (kitchen execution, standardization, service, multi-channel sales, shipped products, experiences)
- **Konma Xperience** = first live node where both operate inside a physical villa; modelled as `Node` from v2.0

### Physical Villa (6 Zones)
- Zone A: Food Innovation Lab — R&D, product trials, recipe documentation (BACKEND_LEAD)
- Zone B: Production Kitchen — production, prep, standardization (BACKEND_LEAD + FRONTEND_LEAD)
- Zone C: Frontend Experience — customer flow, beverage, packaging (FRONTEND_LEAD + DESIGN_OUTREACH_LEAD)
- Zone D: Intelligence/Ops Desk — dashboards, planning, costing (BI_LEAD, TECH_LEAD, TALENT_LEAD)
- Zone E: Brand/Experience Space — storytelling, tastings, workshops, events (DESIGN_OUTREACH_LEAD)
- Zone F: Storage/Procurement — vendor receipt, dry/cold storage, inventory (PROCUREMENT_LEAD)

### Roles (8 internal + customer; SPEC.md §2)
- `FOUNDER_ADMIN` — strategy, escalation, override → Mission Control
- `BACKEND_LEAD` — food, production, R&D, standardisation, quality → My Tasks + Recipes + Kitchen
- `FRONTEND_LEAD` — service, customer flow, beverage, channels → My Tasks + Orders/POS + Feedback
- `BI_LEAD` — costing, pricing, KPIs, analytics → My Tasks + Analytics + KPIs
- `PROCUREMENT_LEAD` — vendors, sourcing, inventory, receiving → My Tasks + Inventory + POs
- `TALENT_LEAD` — onboarding, training, hiring, team readiness → My Tasks + Team
- `TECH_LEAD` — dashboard, automation, integrations, infra → Mission Control + Settings
- `DESIGN_OUTREACH_LEAD` — brand, storytelling, events, partnerships → My Tasks + Catalog + Experiences
- *Customer* — public buyer with OTP identity → Storefront

Permissions (23) remain the authorisation primitive; module visibility is a separate data-driven layer (`ModuleAccess`, SPEC.md §6.3).

### Execution Model
- Long-Term Mission (6-9 months) → Mid-Term Vision (90 days) → Weekly Quests → Daily Tasks
- Two layers: Fixed Roadmap (missions, quests, core tasks) + Ad-hoc (urgent fixes, experiments, real-time responses)
- Task types: CORE (100% XP), ADHOC (70% XP), IMPROVEMENT (80% XP) — rules move to `SystemSetting['xp_rules']` in v2.0
- v2.0: operational events (PO received, recipe approved, batch created, order delivered, review published…) create bridge evidence and readiness signals automatically; four meters (STANDARDIZATION, PROCUREMENT, SALES, QUALITY) are derived from ops state

### Governance
- Tier 1: Domain autonomy (lead decides within scope)
- Tier 2: Cross-functional consensus (2+1 rule: 2 relevant roles + 1 impacted) — executed via `DecisionVote` in v2.0
- Tier 3: Founder/admin override (conflicts, strategy, resources)
- Approval gates (seeded as `ApprovalPolicy` in v2.0): food = BACKEND_LEAD + FRONTEND_LEAD; pricing = BI_LEAD + FRONTEND_LEAD; vendor = PROCUREMENT_LEAD + BACKEND_LEAD; experience = FRONTEND_LEAD + DESIGN_OUTREACH_LEAD; tech = TECH_LEAD + FOUNDER_ADMIN; hiring = TALENT_LEAD + FOUNDER_ADMIN

### Specification Lineage
- **`SPEC.md`** — canonical v2.0 specification (domain model, mission↔ops contract, commerce, IA, design system, security, API delta, quality gates, delivery plan). Implement from this.
- `contextdocs/dev_spec.md` — historical v1 reference for Phases 1–6
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` — historical v1 reference for Phases 7–13
- `contextdocsv2/`, `contextdocsv3/` — historical assessments and role/screen maps; superseded

## Constraints

- **Stack fixed** (SPEC.md §1.3): NestJS 11 · Next.js 16 · React 19 · Prisma 6 · PostgreSQL (Neon) · Tailwind 4 · shadcn (base-ui) · npm. No Python, no Supabase, no monorepo tooling, no Prisma 7.
- **Deployment**: Vercel (frontend) + Railway (backend) + Neon (DB) + Upstash Redis + R2; deploys only on green `master` CI.
- **Database is not deployed**: v2.0 performs one schema reset with a fresh migration baseline and new seeds; no backfill migrations.
- **Homepage**: `frontend/app/page.tsx` + `ScrollVideoStory` kept as-is visually; only performance and metadata may change. Its `--public-*` palette is the brand source of truth.
- **Users**: 8 internal roles + external customers (OTP identity). Food-first; art/lifestyle products sold, not produced.
- **Auth**: staff JWT (access + typed refresh with separate secret) and customer JWT (7-day sliding, jti revocation).

## Current Milestone: v2.0 Mission OS + Marketplace

**Goal (SPEC.md §1.1):** Make it one system, not two — operational events produce mission evidence and readiness signals without re-typing; approval gates execute; four readiness meters are derived from ops state with history. Every role lands on "what I must move today". A full Konma-only storefront sells prepared food, packaged products, experiences and merchandise through one catalog, cart and checkout with accounts, reviews, coupons, loyalty, search, desktop layouts and SEO. No money or account is at risk from a known defect. A machine gates every change (CI green before deploy). Platform discipline now (`Node`, enums, rules in tables) so multi-node is possible later.

**Sub-projects (SPEC.md §11):**

| # | Sub-project | GSD phase | Exit criteria (summary) |
|---|---|---|---|
| P0 | Canonical spec + planning sync | — (done 2026-08-22) | SPEC.md committed; PROJECT/ROADMAP/REQUIREMENTS reflect v2.0; historical docs marked |
| P1 | Stop the bleeding | Phase 29 | 14 Critical/High defects fixed with regression tests; config validation; safe seeds; error boundaries; 43/43 suites green; CI enforcing |
| P2 | Platform foundation | Phase 30 | Fresh migration baseline with Node, enums, AuditEvent, Task.subject, ApprovalPolicy, timestamptz, CHECKs, Product replacing MenuItem; new seeds; v1 flows green |
| P3 | Mission bridge | Phase 31 | Domain events, MissionBridgeService, derived meters + snapshots + history API, policy-generated approvals, recipe approval via policy, decision votes; smoke test 1 passes |
| P4 | Role-aware IA + identity | Phase 32 | Header, spine nav, ModuleAccess, /tasks, My Quests, sheets, chips, motion allowlist, brand tokens light+dark, Pusher on kitchen screens, usage events |
| P5 | Marketplace | Phases 33 (backend) + 34 (storefront + staff screens) | Catalog admin, storefront (desktop + SEO), mixed-fulfilment cart/checkout/quote, Shiprocket + shipments queue, bookings via checkout, merch stock, coupons, loyalty, reviews, search, refunds, customer account; smoke test 2 passes |
| P6 | Run-it layer | Phase 35 | WhatsApp nudges, daily close screen, theoretical vs actual food cost, usage dashboard, AI evidence-review assist + morning brief (human-in-the-loop) |

Each sub-project: written plan → parallel subagents partitioned by module → CI green → walk-through → commit on `v2-os-marketplace` → summary in `.planning/phases/`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Food-first v1 scope | Dev spec is deepest on food; art/lifestyle lack equivalent detail | Confirmed; v2.0 sells art/lifestyle products without modelling their production |
| No Python/Supabase | Team preference for Node.js ecosystem consistency | NestJS + PostgreSQL |
| NestJS (not Express) | Research confirmed better fit for module system, guards, DI | Confirmed |
| PostgreSQL on Neon | Complex relational data (15+ entities with FKs) | Confirmed |
| Vercel + Neon deploy | Simple, scalable, low ops overhead | Confirmed (+ Railway backend, Upstash, R2) |
| POS model (not customer self-service) | Staff takes orders, no customer auth needed | Superseded by Phase 23/24 — POS and customer storefront coexist |
| Two-layer inventory | Raw ingredients + production (PrepBatch) | Confirmed |
| Unified recipe entity | No type distinction, depth emerges from chaining | Confirmed; `preparation_type` added in Phase 28 |
| Deduct on "ready" | Simple, no reversal needed, matches villa kitchen | Confirmed for scratch; non-scratch deducts at order confirmation (Phase 28) |
| Delivery: name string only | 1-2 riders, no rider management entity | Confirmed for local; shipped products use `Shipment` + Shiprocket (v2.0) |
| Single payment + notes | No gateway, just recording method + amount + split notes | Superseded by Razorpay (Phase 23); manual methods retained |
| Channel modifier (not per-item pricing) | One modifier per channel, base_price + modifier = final | Confirmed; node-scoped in v2.0 |
| Recipe approval flow with pending status | Recipes need explicit approval before kitchen use | Confirmed; v2.0 drives it from `ApprovalPolicy` |
| Hybrid cost calculation (client+server) | Instant client estimate + 3s debounced server confirm | Confirmed |
| Approved recipe edit lock + versioning | Approved recipes are read-only; editing requires Create New Version | Confirmed |
| Canonical spec = SPEC.md | One source of truth; contextdocs/v2/v3 drifted and contradicted each other | `SPEC.md` canonical; `contextdocs*/` historical (README markers) |
| DB reset allowed | Database is not deployed; no production data to preserve | One fresh migration baseline + new seeds in Phase 30; no backfills |
| Homepage kept as-is | It is the only finished brand surface | `page.tsx` + `ScrollVideoStory` untouched visually; `--public-*` palette is the brand token source |
| `MenuItem` replaced by `Product`, not extended | One catalog for four product types; POS reads products | Confirmed (SPEC §12) |
| Bridge rules are versioned TypeScript; signals and policies are tables | Rules need code review; data needs to be editable and auditable | Confirmed (SPEC §12) |
| Prepaid only; no COD | Simplifies fulfilment, refunds and shipping risk | Confirmed (SPEC §12) |
| Global `order_number`; node-scoped `Product.slug` and meter codes | Display sequence stays simple; catalog and readiness are per node | Confirmed (SPEC §12) |
| Customers are global identities; loyalty per customer, not per node | One phone = one customer across nodes | Confirmed (SPEC §12) |
| Experiences are products whose fulfilment is a booking; `EventBooking` remains the capacity record | One cart/checkout for everything | Confirmed (SPEC §12) |
| Kitchen screens get Pusher; everything else may poll at ≥ 30 s | Realtime where it changes behaviour, cheap elsewhere | Confirmed (SPEC §12) |
| Chat, delegations, guide editor, exports, imports, admin consoles are kept, scoped by `ModuleAccess` | Nothing deleted for being unused; visibility solves clutter | Confirmed (SPEC §12) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-22 — synced to SPEC.md v2.0 (P0); v1.1 closed, v2.0 Mission OS + Marketplace opened*
