# Feature Research

**Domain:** Food operations / kitchen management / socio-technical operating system
**Researched:** 2026-03-19
**Confidence:** HIGH (core ops features), MEDIUM (gamification integration patterns), HIGH (customer-facing features)

---

## Context: This Is Not a Standard Restaurant POS

Konma Xperience OS sits at the intersection of three distinct software categories:

1. **Food ops / kitchen management** (recipe management, inventory, standardization)
2. **Work OS / project management** (missions, quests, tasks, OKRs, evidence, governance)
3. **Customer-facing hospitality** (ordering, menu, experience booking, feedback)

Features are evaluated against all three categories. Table stakes for each category differ. Missing a table-stakes feature from any category breaks that layer of the product.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users (internal team or customers) assume exist. Missing = product feels broken.

#### Internal / Ops Layer

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Role-based login and scoped views | Every team member expects to see their work, not everyone else's | MEDIUM | 8 roles with different permission sets; JWT-based. Scoped views are distinct from auth — both must ship |
| Task list per user (my tasks, status, due dates) | Any work coordination tool has this as baseline | LOW | The atomic unit of the whole system |
| Task status transitions (todo → doing → done → blocked) | Standard workflow expectation | LOW | Blocked state needs reason field |
| Evidence upload against a task | Distinguishes this OS from generic PM tools; teams will not accept verbal completion | MEDIUM | Multi-type: photo, doc, video, sheet, link, note. Needs file storage (S3-compatible) |
| Approval flow for evidence | If evidence can be uploaded but not reviewed, the validation engine breaks | MEDIUM | Per-role approval gates defined in spec (food=Sadhana+Anchitha, etc.) |
| Task validity state (valid/invalid flag) | Core business rule: task is only done when evidence approved + verified | LOW | Logic is well-defined in pseudo-code; straightforward to implement once evidence + approvals work |
| Mission → Quest → Task hierarchy | The structural spine; without it, tasks are orphaned | MEDIUM | Three levels; tasks can belong to mission without a quest (ad-hoc) |
| Progress tracking (% complete on missions and quests) | Teams need to see how they are tracking against goals | LOW | Auto-calculated from valid tasks; formula defined in spec |
| Notifications for deadlines, blockers, approvals | Without nudges, blockers sit silent and deadlines miss | MEDIUM | Email-first for v1; five trigger types defined in spec |
| Founder/admin dashboard (mission control, pending approvals, blockers) | Admin must have full situational awareness | MEDIUM | Aggregates data already computed elsewhere; mostly a view layer |
| Role-user dashboard (my tasks, my quests, my evidence, my meters) | Every team member needs their personal operational view | MEDIUM | Per-role scoping; each role sees different data |

#### Customer-Facing Layer

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Menu browsing (public, no login required) | Customers expect to see what is available before ordering | LOW | Static or semi-static; menu is an asset in the system |
| Online ordering (delivery and takeaway) | Standard expectation for any food brand with digital presence | HIGH | Order management, cart, payment gateway integration required |
| Order status tracking | Customers who place online orders expect to know where their order is | MEDIUM | Webhook or polling from kitchen order pipeline |
| Experience / event booking | Villa offers curated events; customers must be able to book them | MEDIUM | Separate flow from food ordering; ticketed or slot-based |
| Customer feedback and ratings | Customers expect to be able to leave feedback after an order or visit | LOW | Simple form; feeds into internal quality tracking |

---

### Differentiators (Competitive Advantage)

Features that no standard restaurant POS or project management tool has. These are the core value proposition of Konma Xperience OS.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Evidence-backed task completion (evidence → approval → valid) | Forces real work to be documented before it counts; eliminates "done" theater | HIGH | This is the most differentiated feature. No standard PM tool enforces this. Pseudo-code is fully specified. |
| Readiness meters (10 meters aggregating valid task contributions) | Visual, real-time measure of operational readiness per domain (backend, frontend, sales, etc.) | HIGH | Event-sourced: readiness only moves when tasks are valid. Defined in spec with 10 named meters. |
| XP / leveling system tied only to valid work | Gamification that cannot be gamed — XP only flows from verified, approved tasks | MEDIUM | Four levels; task-type multipliers (core=100%, adhoc=70%, improvement=80%). Schema ready. |
| Leaderboard using valid XP only | Public competition metric that reflects actual quality output, not activity | LOW | Simple sort on valid XP; powerful signal in a small team |
| 3-tier governance model (individual → cross-function → strategic) | Decisions are logged, consensual where required, and traceable | HIGH | "2+1 rule" for cross-functional decisions; 6 domain-specific approval gates; decision log entity in schema |
| Phase unlock gates tied to readiness meters | Operational phases (setup → foundation → activation) only unlock when readiness thresholds are met | MEDIUM | Pseudo-code defined (BACKEND≥80, FRONTEND≥80, PROCUREMENT≥60, TECH≥50 to unlock foundation) |
| Ad-hoc task injection without breaking roadmap | Admin can inject urgent tasks that do not affect core roadmap progress | LOW | Task type enum distinguishes CORE vs ADHOC vs IMPROVEMENT; XP multipliers already handle this |
| Zone management (6 physical villa zones mapped to digital functions) | Physical space has a digital twin; tasks can be zone-scoped | LOW | Mostly a data enrichment feature; low complexity but meaningful for space coordination |
| Asset library tied to missions and tasks (recipes, SOPs, menus, cost sheets) | Knowledge capture is embedded in work execution, not separate | MEDIUM | Asset entity with 8 types; linked to tasks and brands |
| Brand and channel management (multiple food brands, multiple sales channels) | Supports Konma Food + Just Craves operating as distinct brands under one node | LOW | Schema ready; brand_type and channel_type enums defined |
| Streak tracking on users | Behavioral signal for consistent daily engagement | LOW | streak_days field on user entity; needs daily login or task completion trigger |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem natural to build but should be deliberately avoided or deferred.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time collaboration (live cursors, simultaneous editing) | Teams see it in Notion / Figma and want it everywhere | Adds WebSocket complexity to every form; for 8 internal users with async workflows, it provides no material value | Optimistic UI with standard HTTP + refresh-on-save is sufficient for v1 |
| AI-generated task recommendations / auto-assignment | Feels like a natural next step; looks impressive in demos | Requires training data that does not exist in v1; generates wrong suggestions early and erodes trust in the system | Build after 6+ months of real usage data; flag in PROJECT.md as Phase 3 |
| Complex marketplace engine (multi-vendor, dynamic pricing) | Logical extension of multi-brand multi-channel structure | Marketplace logic (splits, vendor fees, conflict resolution) is a separate product with significant legal and ops complexity | Support multi-channel ordering within owned brands; marketplace deferred to future node |
| Blockchain for evidence integrity | "Immutable records" sounds credible for a governance system | Adds infrastructure complexity, latency, and cost with zero practical benefit for an 8-person team at one node | PostgreSQL with append-only event tables and created_at/reviewed_at timestamps provides sufficient audit trail |
| Public customer app (native iOS/Android) | Customers are used to apps for ordering | For v1 with limited customer volume, a responsive web app is functionally identical and a fraction of the build cost | Responsive Next.js frontend works on mobile; ship native app only after customer volume justifies it |
| Advanced inventory management (stock depletion, purchase orders, supplier integrations) | Procurement role (Surya) naturally wants full inventory tooling | Full inventory = ERP-level complexity; Zone F and procurement flows are v1 operational, not software-managed | Track vendor sheet assets and manual procurement tasks in v1; dedicated inventory module is v2 |
| Customer loyalty / points program | Standard feature of hospitality apps | Requires customer account system, order history, point calculations, and redemption flows; significant additional surface area | Collect customer feedback in v1; build loyalty after ordering volume and repeat customer data exists |
| Cross-node federation | Natural extension of the "node" architecture concept | Requires multiple live nodes with operational data; premature until node 1 is proven | Design schema to be node-aware (add node_id to entities) without building federation logic |
| Granular per-user permissions editor (UI to change any user's permissions) | Admin wants control over every permission | Creates "permission sprawl" and makes system behavior unpredictable; 8 fixed roles with defined permissions is the right model for this team size | Role assignments are admin-managed; permissions are code-level constants per role, not UI-editable |
| Full POS terminal (tableside ordering, kitchen display system, payment hardware) | Operational kitchen seems to need it | Out of scope for v1; customer ordering through web is sufficient for the villa's curated experience model | Online ordering + takeaway covers v1 customer channels; hardware integrations are v2 |

---

## Feature Dependencies

```
[Auth / RBAC]
    └──required by──> [All internal views]
    └──required by──> [Evidence upload]
    └──required by──> [Approval flows]
    └──required by──> [Task management]

[Task management (CRUD, status transitions)]
    └──required by──> [Evidence upload]
                          └──required by──> [Approval flows]
                                                └──required by──> [Task validity engine]
                                                                      └──required by──> [XP calculation]
                                                                      └──required by──> [Readiness meters]
                                                                      └──required by──> [Quest/mission progress]

[Mission → Quest hierarchy]
    └──required by──> [Task management] (quest_id, mission_id on tasks)
    └──required by──> [Progress tracking]
    └──required by──> [Leaderboard context]

[Readiness meters]
    └──required by──> [Phase unlock gates]
    └──required by──> [Founder dashboard readiness overview]

[XP / leveling]
    └──required by──> [Leaderboard]
    └──required by──> [Streak tracking] (needs daily XP events)

[Notifications]
    └──required by──> [Deadline nudges]
    └──required by──> [Blocker alerts]
    └──required by──> [Level-up notifications]
    └──required by──> [Approval pending alerts]
    └──enhances──> [Task management] (not required by)

[Governance / decisions]
    └──required by──> [Cross-functional approval gates]
    └──enhances──> [Task management] (decisions can be linked to tasks)

[Asset library]
    └──enhances──> [Task management] (tasks can produce assets)
    └──enhances──> [Brand management]

[Menu (customer-facing)]
    └──requires──> [Asset library] (menu = an asset type)
    └──required by──> [Online ordering]

[Online ordering]
    └──requires──> [Menu]
    └──requires──> [Payment gateway]
    └──enhances──> [Customer feedback] (order history context)

[Experience booking]
    └──independent of ordering] (separate booking flow)
    └──enhances──> [Brand management] (experiences tied to brands/channels)
```

### Dependency Notes

- **Task validity requires the full chain:** A task cannot be valid without evidence, which requires the evidence entity, which requires approvals, which requires the approval entity and role model. These four must be built together in Phase 1.
- **Readiness meters require valid tasks:** Readiness cannot be tested or seeded with dummy data until the validation engine works. Plan Phase 1 to end with at least one valid task → readiness event in the system.
- **XP is a derived value:** It should never be set manually. It is always the output of `recalculate_user_xp()` which reads valid tasks. Building XP as a stored aggregate (not real-time query) matches the spec and avoids performance issues.
- **Menu is a prerequisite for ordering:** The customer-facing ordering flow assumes a menu exists. Menu = an asset record of type `menu`. The asset system must exist before customer-facing features are built.
- **Customer ordering is independent from internal ops:** The two layers share the same database (brands, channels, assets) but customer-facing flows do not depend on the task/evidence/approval system. They can be built in parallel in a later phase.
- **Notifications enhance but do not block core flows:** Build notifications after core ops features are working. A system where tasks, evidence, and approvals work without notifications is usable; notifications reduce friction but are not blockers.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what is needed for the 8-person team to use this as their primary operating system and for customers to interact with the two customer-facing channels.

**Internal OS core:**
- [ ] Auth (JWT login, role-scoped sessions) — nothing works without this
- [ ] Mission → Quest → Task hierarchy with CRUD — the structural spine
- [ ] Task status transitions + blocking with reason — daily workflow
- [ ] Evidence upload (photo, doc, link at minimum) — the differentiating engine
- [ ] Approval flows for evidence and tasks — required for task validity
- [ ] Task validity engine (status + evidence + approval = valid) — the core business rule
- [ ] XP calculation and level assignment — tied directly to valid tasks
- [ ] Readiness meters (10 meters, event-sourced) — operational health at a glance
- [ ] Quest and mission progress auto-calculation — accountability signal
- [ ] Role-based dashboards (founder view + role-user view) — the UI surfaces for above
- [ ] Leaderboard — already derived from valid XP, low additional effort
- [ ] Notifications (deadline, blocker, level-up, approval pending) — reduces friction and keeps the team engaged

**Internal ops data:**
- [ ] Zone management (6 villa zones) — space context for tasks
- [ ] Brand management (Konma Food, Just Craves) — multi-brand structure
- [ ] Channel management (dine-in, delivery, takeaway, events) — multi-channel structure
- [ ] Asset management (recipes, SOPs, menus, cost sheets) — knowledge capture

**Customer-facing:**
- [ ] Menu browsing (public, no login) — customer discovery
- [ ] Online ordering (delivery / takeaway) — revenue channel
- [ ] Customer feedback and ratings — quality loop
- [ ] Experience booking (events / workshops) — the villa's curated product

### Add After Validation (v1.x)

Features to add once the core system is in use and generating real data.

- [ ] Streak tracking — needs 2+ weeks of usage data to be meaningful
- [ ] Phase unlock gates (readiness-based phase transitions) — needs real readiness data to trigger
- [ ] Ad-hoc task injection UI (admin dashboard shortcut) — the schema supports it; the dedicated admin UI surface is v1.x polish
- [ ] Advanced notification channels (WhatsApp, Slack) — email is sufficient for v1; add when team requests it
- [ ] Decision log UI (governance board for cross-functional decisions) — important but can launch with manual tracking and add the formal board in v1.x
- [ ] Governance consensus flows (2+1 rule UI) — schema is ready; the formal UI to request and track consensus can follow initial usage

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] AI-generated recommendations (task suggestions, recipe optimization) — requires 6+ months of usage data; defer per PROJECT.md
- [ ] Cross-node federation — requires a second live node
- [ ] Customer loyalty program — requires ordering volume and repeat customer data
- [ ] Native mobile app — web is sufficient; build when customer volume justifies native
- [ ] Inventory management (stock depletion, purchase orders) — full ERP complexity; v2 once procurement workflows are understood
- [ ] Art and lifestyle domain layers — v1 is food-first; art/lifestyle deferred per scope
- [ ] POS hardware integrations — not needed for villa's curated model

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth / RBAC | HIGH | MEDIUM | P1 |
| Mission → Quest → Task hierarchy | HIGH | MEDIUM | P1 |
| Evidence upload + approval | HIGH | MEDIUM | P1 |
| Task validity engine | HIGH | LOW | P1 |
| Readiness meters | HIGH | MEDIUM | P1 |
| XP + leveling | HIGH | LOW | P1 |
| Leaderboard | HIGH | LOW | P1 |
| Role dashboards (founder + user) | HIGH | MEDIUM | P1 |
| Notifications | HIGH | MEDIUM | P1 |
| Zone / brand / channel / asset management | MEDIUM | LOW | P1 |
| Menu browsing (customer) | HIGH | LOW | P1 |
| Online ordering (customer) | HIGH | HIGH | P1 |
| Customer feedback | MEDIUM | LOW | P1 |
| Experience booking | HIGH | MEDIUM | P1 |
| Streak tracking | MEDIUM | LOW | P2 |
| Phase unlock gates | MEDIUM | LOW | P2 |
| Ad-hoc task injection UI | MEDIUM | LOW | P2 |
| Governance / decision log UI | MEDIUM | HIGH | P2 |
| Consensus workflow UI (2+1) | MEDIUM | HIGH | P2 |
| Advanced notifications (WhatsApp) | LOW | MEDIUM | P2 |
| AI recommendations | MEDIUM | HIGH | P3 |
| Inventory management | MEDIUM | HIGH | P3 |
| Customer loyalty program | MEDIUM | HIGH | P3 |
| Cross-node federation | LOW | HIGH | P3 |
| Native mobile app | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

This product has no direct competitor — it combines categories that are normally separate. The analysis maps against the closest analogues.

| Feature | Work OS (ClickUp/Asana) | Food Ops (Toast/Restaurant365) | Konma Xperience OS Approach |
|---------|------------------------|-------------------------------|------------------------------|
| Task hierarchy | Objectives → Goals → Tasks | Not present | Mission → Quest → Task with food domain context |
| Evidence / proof of completion | File attachments, comments | Photo evidence in compliance checklists | Mandatory typed evidence (photo/doc/video/sheet/link/note) as gate to validity |
| Approval flows | Basic approval statuses | Not present in core; compliance-focused | Domain-scoped approval gates (6 domains) with 2+1 consensus rule |
| XP / gamification | Optional; not tied to quality | Not present | XP only from valid (approved + evidence) tasks; cannot be gamed |
| Readiness meters | Not present | Not present | Event-sourced meters aggregating valid task contributions per domain |
| Online ordering | Not present | Core feature (POS + online) | Customer-facing web ordering tied to brand/channel structure |
| Menu management | Not present | Core feature | Asset-based; menu = an asset record |
| Experience booking | Not present | Partial (OpenTable integration) | First-class booking flow for curated villa experiences |
| Governance / decision log | Basic (comments, status) | Not present | 3-tier model (individual / cross-function / strategic) with decision entity and approval records |
| Recipe / SOP management | File storage only | Dedicated (Apicbase, JAMIX) | Asset library with typed records; v1 is file-based, not structured recipe database |
| Physical zone management | Not present | Not present | Villa zones mapped to digital function assignments |

---

## Customer-Facing / Back-Office Integration Notes

Based on industry research, the standard integration pattern between customer ordering and back-office ops:

**Standard industry pattern:**
- Customer order → POS → Kitchen Display System (KDS) → Inventory deduction → Reporting
- Most platforms treat this as a POS-centric hub: all data flows through the POS

**Konma pattern (different):**
- Customer order → Channel record → Task creation or notification → Kitchen execution → Evidence-backed completion
- The back-office is the OS; customer orders are inputs to the OS, not the center of it
- Menu browsing and ordering feed directly from the asset system (menu = asset); no separate menu management tool needed
- Experience booking is a separate flow from food ordering; both feed into the same brand/channel structure

**Integration point to design carefully:**
The customer-facing ordering system needs to know about:
1. Which menu items are currently active (from assets with status=approved)
2. Which channels are currently active (dine-in/delivery/takeaway from channels table)
3. Order state (new → preparing → ready → delivered); this state machine lives adjacent to the task system but is distinct from it

Keep order management as a separate bounded context from the mission/task OS. They share the same database but should not be tightly coupled at the application layer.

---

## Sources

- [Top 10 All-In-One Restaurant Management Software 2026 — UpMenu](https://www.upmenu.com/blog/restaurant-management-software/)
- [Restaurant Operations Management Buyer's Guide 2026 — Xenia](https://www.xenia.team/articles/restaurant-operations-management)
- [2026 Restaurant Operations Management Best Practices — Operandio](https://operandio.com/restaurant-operations-management/)
- [Modern Restaurant Operations: What Execution Looks Like in 2025 — Supy](https://supy.io/blog/modern-restaurant-operations-execution-2025)
- [Integrated Back Office Platform Guide — SynergySuite](https://www.synergysuite.com/blog/what-is-an-integrated-restaurant-back-office-platform/)
- [An All-In-One Kitchen Operations Platform — Restaurant365](https://www.restaurant365.com/kitchen-operations/)
- [Restaurant Experiences & Events Management Software — SevenRooms](https://sevenrooms.com/platform/events-experiences/)
- [Best Restaurant Online Ordering Systems 2025 — UpMenu](https://www.upmenu.com/blog/best-restaurant-online-ordering-system/)
- [How to Gamify Project Management — ClickUp](https://clickup.com/blog/gamification-in-project-management/)
- [Employee Gamification in 2025 — Xperiencify](https://xperiencify.com/employee-gamification/)
- [32 Best Approval Workflow Software Solutions 2026 — Digital Project Manager](https://thedigitalprojectmanager.com/tools/best-approval-workflow-software/)
- [Wrike Approvals — Wrike](https://www.wrike.com/features/approvals/)
- [Recipe Management Software — Apicbase](https://get.apicbase.com/recipe-management-software/)
- [RBAC Best Practices 2025 — OSO](https://www.osohq.com/learn/rbac-best-practices)
- [Event Management Software Guide for Restaurants — EatApp](https://restaurant.eatapp.co/blog/event-management-software-for-restaurants-hotels)
- [OKRs and Project Management: Best Practices — Celoxis](https://www.celoxis.com/article/okrs-project-management)

---

*Feature research for: Konma Xperience OS — food operations / kitchen management / socio-technical operating system*
*Researched: 2026-03-19*
