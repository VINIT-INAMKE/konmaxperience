# Konma Xperience OS

## What This Is

A role-based socio-technical operating system for the first Konma Xperience node — a 4000 sq ft villa that serves as a live ecosystem for food innovation, production, standardization, multi-channel sales, and curated experiences. The system coordinates 8 internal users (7 team + founder) and customer-facing features across two business layers: Konma Food (builder/R&D) and Just Craves (execution/sales). V1 is food-first.

## Core Value

Every piece of work must be evidence-backed, approved, and validated before it counts — turning real execution into measurable readiness and progress across the entire operation.

## Requirements

### Validated

(None yet — ship to validate)

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
Full schema (15 entities), REST API design (15+ endpoint groups), business rules, pseudo-code, and seed data defined in `contextdocs/dev_spec.md`. This is the primary implementation reference.

## Constraints

- **Tech Stack**: Next.js frontend + Express or NestJS backend + Postgres or MongoDB (research will determine best fit). No Python, no Supabase.
- **Deployment**: Vercel for frontend + managed cloud database (Neon, Railway, or Atlas)
- **Users**: 8 internal team members + external customers
- **Domain Focus**: Food-first for v1. Art and lifestyle domains deferred.
- **Auth**: JWT-based with role-based permissions (8 distinct roles)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Food-first v1 scope | Dev spec is deepest on food; art/lifestyle lack equivalent detail | — Pending |
| No Python/Supabase | Team preference for Node.js ecosystem consistency | — Pending |
| Express vs NestJS | To be determined by research | — Pending |
| Postgres vs MongoDB | To be determined by research (complex relations suggest Postgres) | — Pending |
| Vercel + cloud DB deploy | Simple, scalable, low ops overhead | — Pending |
| Internal + customer-facing | Customers get menu, ordering, feedback, booking in v1 | — Pending |

---
*Last updated: 2026-03-19 after initialization*
