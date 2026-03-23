# Konma Xperience OS

## What This Is

A role-based socio-technical operating system for the first Konma Xperience node — a 4000 sq ft villa that serves as a live ecosystem for food innovation, production, standardization, multi-channel sales, and curated experiences. The system coordinates 8 internal users (7 team + founder) and customer-facing features across two business layers: Konma Food (builder/R&D) and Just Craves (execution/sales). V1 is food-first.

## Core Value

Every piece of work must be evidence-backed, approved, and validated before it counts — turning real execution into measurable readiness and progress across the entire operation.

## Requirements

### Validated

- [x] Authentication & RBAC (Phase 1)
- [x] Mission/Quest/Task hierarchy with execution engine (Phase 2)
- [x] Evidence upload, approval workflow, validation cascade (Phase 3)
- [x] Gamification & Readiness Intelligence — XP, levels, leaderboard, 10 readiness meters, KPIs (Phase 4)
- [x] Governance & Decision Management — decision logging, approval override/escalation, delegation with audit trail (Phase 5)
- [x] Operations Management — zones, brands, channels, asset library with upload and status workflow (Phase 6)
- [x] Recipe & Ingredient Management — unified recipes with polymorphic BOM, unit conversion, vendors, recursive cost calculation, menu items with channel pricing (Phase 7)
- [x] Inventory & Procurement — stock tracking, PO workflow with receiving, movement audit trail, procurement dashboard (Phase 8)
- [x] Kitchen & Prep — prep batch FIFO deduction, full-screen KDS with polling, waste logging, expiry cron, menu availability, kitchen metrics (Phase 9)
- [x] POS & Orders — staff POS with split-screen menu/cart, order-to-kitchen-to-deduction flow, payment tracking, delivery dispatch, order history (Phase 10)
- [x] Guide Foundation — GuideSection/GuidePage Prisma models, MANAGE_GUIDE permission, GuidesModule with CRUD API, role-based filtering, XSS sanitization, presign-guide endpoint (Phase 14)
- [x] Guide Reader View — section index with MagicCard grid, page reading view with Tiptap prose renderer, slide-in sidebar navigation, DOMPurify defense-in-depth, skeleton loading states (Phase 15)
- [x] Admin CMS — Tiptap rich text editor with dual toolbar, image upload (3 paths), callout blocks, 5s debounced autosave, publish/unpublish workflow, unsaved changes warning (Phase 16)
- [x] Search, Preview & Seeding — Cmd+K search overlay with tsvector full-text search, admin preview-as-role dropdown, 12 sections with 39 pages of real walkthrough content from codebase (Phase 17)
- [x] Data Export — CSV/XLSX export for 22 report types with R2 storage, export history, admin exports page, ExportButton on 13 data pages (Phase 18)

### Active

- [ ] Mission/quest/task hierarchy with role-based assignment
- [ ] Evidence upload and approval workflow
- [ ] Task validation engine (status + evidence + approval = valid)
- [ ] Readiness meters aggregating valid task contributions
- [ ] XP/leveling/leaderboard gamification system
- [ ] Role-based access control (8 roles with scoped permissions)
- [ ] Governance: approval gates, cross-functional consensus, decision logging
- [ ] Ad-hoc task injection by admin without breaking roadmap
- [ ] Dependency tracking and blocker management
- [ ] Notification/nudge system (deadlines, blockers, level-ups, approvals)
- [ ] KPI/OKR tracking tied to tasks
- [ ] Zone management (6 villa zones mapped to functions)
- [ ] Brand and channel management
- [ ] Asset management (recipes, SOPs, menus, cost sheets)
- [ ] Customer-facing: menu browsing
- [ ] Customer-facing: online ordering (delivery/takeaway)
- [ ] Customer-facing: feedback and ratings
- [ ] Customer-facing: experience/event booking
- [ ] Founder/admin dashboard (mission control, readiness overview, approvals, blockers, decisions, leaderboard)
- [ ] Role user dashboard (my tasks, quests, evidence, contribution meters)

### Out of Scope

- Art/lifestyle domain execution — v1 is food-first, art/lifestyle layers deferred
- Blockchain integration — not needed for v1
- Complex marketplace engine — future consideration
- Advanced AI/predictive features — Phase 3 per blueprint
- Cross-node federation — requires multiple nodes, future
- Mobile native app — web-first, responsive design
- Python/FastAPI backend — using Node.js (Express or NestJS)
- Supabase — building custom backend

## Context

### Ecosystem Structure
- **Konma Food** = system builder (R&D, recipes, brand onboarding, SOPs, knowledge capture)
- **Just Craves** = system runner (kitchen execution, standardization, service, multi-channel sales)
- **Konma Xperience** = first live node where both operate inside a physical villa

### Physical Villa (6 Zones)
- Zone A: Food Innovation Lab (Sadhana) — R&D, product trials, recipe documentation
- Zone B: Production Kitchen (Sadhana + Anchitha) — production, prep, standardization
- Zone C: Frontend Experience (Anchitha + Advitha) — customer flow, beverage, packaging
- Zone D: Intelligence/Ops Desk (Hasmitha, Vinit, Sathya) — dashboards, planning, costing
- Zone E: Brand/Experience Space (Advitha) — storytelling, tastings, workshops, events
- Zone F: Storage/Procurement (Surya) — vendor receipt, dry/cold storage, inventory

### Team (8 roles)
- Sadhana — Backend: food, production, R&D, quality, standardization
- Anchitha — Frontend: service, customer experience, beverage, flow
- Hasmitha — BI: costing, pricing, KPIs, performance
- Surya — Procurement: vendors, sourcing, inventory
- Sathya — Talent: onboarding, training, hiring pipeline
- Vinit — Tech: dashboard, automation, integrations
- Advitha — Design & Outreach: brand identity, storytelling, events
- Founder/Admin — strategy, mission control, escalations, overrides

### Interaction Flow
Sadhana creates → Anchitha operationalizes → Hasmitha measures → Surya enables supply → Sathya supports people → Vinit enables systems → Advitha shapes design/outreach → Founder integrates strategy

### Execution Model
- Long-Term Mission (6-9 months) → Mid-Term Vision (90 days) → Weekly Quests → Daily Tasks
- Two layers: Fixed Roadmap (missions, quests, core tasks) + Ad-hoc (urgent fixes, experiments, real-time responses)
- Task types: CORE (100% XP), ADHOC (70% XP), IMPROVEMENT (80% XP)

### Governance
- Tier 1: Domain autonomy (lead decides within scope)
- Tier 2: Cross-functional consensus (2+1 rule: 2 relevant roles + 1 impacted)
- Tier 3: Founder/admin override (conflicts, strategy, resources)
- Approval gates: food = Sadhana+Anchitha, pricing = Hasmitha+Anchitha, vendor = Surya+Sadhana, experience = Anchitha+Advitha, tech = Vinit+Founder, hiring = Sathya+Founder

### Existing Dev Spec
Full schema (15 entities), REST API design (15+ endpoint groups), business rules, pseudo-code, and seed data defined in `contextdocs/dev_spec.md`. This is the primary implementation reference for Phases 1-6.

### Food Production Pipeline Spec
Complete data model for Phases 7-13 (22 new entities) defined in `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md`. Covers: multi-stage recipes with polymorphic BOM, unit conversion, two-layer inventory (raw + production), procurement, kitchen prep batches, POS ordering with deduct-on-ready, delivery dispatch, and customer experience. This is the primary implementation reference for Phases 7-13.

## Constraints

- **Tech Stack**: Next.js frontend + Express or NestJS backend + Postgres or MongoDB (research will determine best fit). No Python, no Supabase.
- **Deployment**: Vercel for frontend + managed cloud database (Neon, Railway, or Atlas)
- **Users**: 8 internal team members + external customers
- **Domain Focus**: Food-first for v1. Art and lifestyle domains deferred.
- **Auth**: JWT-based with role-based permissions (8 distinct roles)

## Current Milestone: v1.1 User Guide & Data Management

**Goal:** In-app user guide CMS with role-based access + bulk data import/export across the entire system.

**Target features:**
- Admin CMS for creating/editing guide content (rich text + image uploads via R2)
- Feature-area sections containing step-by-step workflow walkthroughs
- Role-to-section mapping — users see only their role's guides
- Admin/tech access to all guide pages
- Rich, polished UI with MagicUI components (not static docs)
- CSV/XLSX export for 22 report types (orders, analytics, waste, inventory, procurement, feedback, KPIs, etc.)
- Bulk import for master data (ingredients, vendors, vendor pricing)
- Bulk import for operational data (opening stock, recipes, menu, events, tasks, quests, KPIs)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Food-first v1 scope | Dev spec is deepest on food; art/lifestyle lack equivalent detail | Confirmed |
| No Python/Supabase | Team preference for Node.js ecosystem consistency | NestJS + PostgreSQL |
| NestJS (not Express) | Research confirmed better fit for module system, guards, DI | Confirmed |
| PostgreSQL on Neon | Complex relational data (15+ entities with FKs) | Confirmed |
| Vercel + Neon deploy | Simple, scalable, low ops overhead | Confirmed |
| POS model (not customer self-service) | Staff takes orders, no customer auth needed | Confirmed |
| Two-layer inventory | Raw ingredients + production (PrepBatch) | Confirmed |
| Unified recipe entity | No type distinction, depth emerges from chaining | Confirmed |
| Deduct on "ready" | Simple, no reversal needed, matches villa kitchen | Confirmed |
| Delivery: name string only | 1-2 riders, no rider management entity | Confirmed |
| Single payment + notes | No gateway, just recording method + amount + split notes | Confirmed |
| Channel modifier (not per-item pricing) | One modifier per channel, base_price + modifier = final | Confirmed |

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
*Last updated: 2026-03-23 after Phase 18 (Data Export) completion*
