# Role → UI View Mapping

If **RBAC defines what a role can do**, then **UI views define what a role experiences**.

That means each role should land into a screen that answers:

- What is my mission contribution?
- What should I do today?
- What is blocked?
- What needs my approval?
- How is my work moving the system?

---

# 🌾 KONMA XPERIENCE OS

### 1. UI DESIGN PRINCIPLE

Each role should get:

```
Mission Context
→ Quest Context
→ Actionable Work
→ Approvals / Blockers
→ Contribution Visibility
```

### 2. GLOBAL UI LAYERS

Every logged-in user should have access to 3 shared layers:

#### A. Shared Header

- Current Mission
- Current Phase
- Current Weekly Quest
- Notification bell
- Role name
- XP / Level snapshot

#### B. Shared Sidebar

- Mission Control
- My Quests
- My Tasks
- Readiness
- Evidence
- Governance
- Team
- Role-specific modules

#### C. Shared Footer / Profile Strip

- XP
- Level
- streak / recent activity
- quick add note/evidence

### 3. ROLE-SPECIFIC UI VIEWS

#### 3.1 Mission Director View

### Purpose

Strategic oversight and final governance.

### Default Landing

**Mission Control — Admin Mode**

### Primary Widgets

- Active Missions
- Phase progress
- Readiness overview (all meters)
- Cross-role blockers
- Pending approvals
- Decision queue
- Quest health summary
- Leaderboard snapshot

### Secondary Views

- All Quests
- All Tasks
- Decisions Log
- Governance Panel
- Role Contribution Analytics

### What should be visible immediately

- What is behind?
- What is blocked?
- What needs a decision?
- Which quest is drifting?
- Which readiness meter is weakest?

#### 3.2 Quest Architect View

### Purpose

Design and manage weekly execution structure.

### Default Landing

**Quest Control Board**

### Primary Widgets

- Current quests by phase
- Quest progress
- Tasks without quest
- Overloaded quests
- Quest dependencies
- Quest completion confidence

### Secondary Views

- Quest Builder
- Mission-to-Quest map
- Carry-forward items
- Ad-hoc task clustering

### What should be visible immediately

- Which quest needs redesign?
- Are tasks correctly nested?
- Which quest lacks owner / success conditions?
- Which ad-hoc work should become a quest?

#### 3.3 Governance Lead View

### Purpose

Approvals, consensus, escalation, and policy integrity.

### Default Landing

**Governance Console**

### Primary Widgets

- Pending approvals
- Cross-functional decisions
- Task approval queue
- Evidence review queue
- Overdue approvals
- Escalation alerts

### Secondary Views

- Decision Log
- Approval Matrix
- Governance audit trail
- Conflict / blocker review

### What should be visible immediately

- What is waiting on approval?
- Which decision is unresolved?
- Which quest is stuck due to governance?
- What needs escalation?

#### 3.4 Product Innovation Lead View

### Purpose

Create and shape products, especially food concepts.

### Default Landing

**Product Lab Dashboard**

### Primary Widgets

- Active product quests
- My tasks
- Recipe / product experiments
- Evidence uploads pending
- Validation requests
- Backend readiness contribution

### Secondary Views

- Product experiments board
- Recipe asset library
- Product approval pipeline
- Ingredient-linked tasks

### What should be visible immediately

- Which products are under development?
- Which need validation?
- Which are blocked by procurement / frontend?
- What is ready for standardization?

#### 3.5 Production Lead View

### Purpose

Run backend execution and production flow.

### Default Landing

**Production Ops Dashboard**

### Primary Widgets

- Today’s production tasks
- Dependencies
- Backend readiness
- Blocked prep / equipment issues
- Batch progress
- Evidence quick upload

### Secondary Views

- Production kanban
- Station / workflow board
- SOP access
- ingredient-linked tasks

### What should be visible immediately

- What must be produced today?
- What is blocked?
- Which task is overdue?
- Which quest this production supports?

#### 3.6 Quality & Standardization Lead View

### Purpose

Convert outputs into repeatable systems.

### Default Landing

**Standardization Console**

### Primary Widgets

- Tasks pending standardization
- Recipe / SOP review queue
- Approval-required items
- Standardization readiness
- Repeatability failures / flagged items

### Secondary Views

- SOP library
- standardization board
- validated assets
- audit trail of changes

### What should be visible immediately

- Which outputs need conversion into SOPs?
- What is inconsistent?
- What can be approved?
- Where is repeatability failing?

#### 3.7 Experience Lead View

### Purpose

Own frontend flow and customer experience.

### Default Landing

**Experience Control Dashboard**

### Primary Widgets

- Current frontend quest
- Service flow tasks
- Frontend readiness
- Customer journey blockers
- Experience approvals
- Event / activation tasks

### Secondary Views

- Experience map
- frontend task board
- channel readiness
- service simulation history

### What should be visible immediately

- What affects the customer journey today?
- Which frontend flows are not ready?
- What must be tested next?
- What needs design or backend input?

#### 3.8 Service Operations Lead View

### Purpose

Handle execution of service and workflow timing.

### Default Landing

**Service Ops Board**

### Primary Widgets

- Today’s service tasks
- urgent tasks
- timing / queue issues
- blockers
- simulation tasks
- evidence shortcuts

### Secondary Views

- service kanban
- shift flow
- task timing logs

### What should be visible immediately

- What needs action now?
- What is slowing down service?
- What is waiting on backend?
- Which quest this shift supports?

#### 3.9 Art & Culture Curator View

### Purpose

Own art-facing layer of Konma Xperience.

### Default Landing

**Art Layer Dashboard**

### Primary Widgets

- Art quests
- installation tasks
- art readiness meter
- dependencies with space / design / ops
- outreach / collaboration tasks

### Secondary Views

- art programming board
- installation log
- partner / collaborator list

### What should be visible immediately

- What art layer is being activated now?
- What is needed from design/ops?
- What is ready for experience integration?

#### 3.10 Lifestyle Experience Lead View

### Purpose

Own lifestyle programming and experience extensions.

### Default Landing

**Lifestyle Layer Dashboard**

### Primary Widgets

- lifestyle quests
- workshop / event tasks
- lifestyle readiness
- partnership tasks
- experience dependencies

### Secondary Views

- lifestyle programming board
- event prep board
- channel / outreach links

### What should be visible immediately

- What lifestyle experience is being built?
- What is needed for activation?
- Which tasks are blocked?

#### 3.11 Procurement Lead View

### Purpose

Keep the system supplied and stable.

### Default Landing

**Procurement Command View**

### Primary Widgets

- procurement tasks
- urgent low-stock alerts
- pending purchase-linked tasks
- vendor follow-ups
- procurement readiness
- cost-risk alerts

### Secondary Views

- vendor board
- purchase order tracker
- inventory-linked tasks
- reorder triggers

### What should be visible immediately

- What needs sourcing now?
- What is delayed?
- What can block quests?
- Which items are cost-risky?

#### 3.12 Inventory & Logistics Lead View

### Purpose

Manage movement, storage, and stock accuracy.

### Default Landing

**Inventory Operations View**

### Primary Widgets

- stock movement tasks
- inventory health
- storage readiness
- logistics blockers
- inward/outward task feed

### Secondary Views

- inventory table
- storage zone status
- logistics trail

### What should be visible immediately

- What is running low?
- What has arrived / moved?
- Which tasks depend on stock availability?

#### 3.13 Infrastructure & Facility Lead View

### Purpose

Own space readiness and physical enablement.

### Default Landing

**Villa Readiness Dashboard**

### Primary Widgets

- zone setup tasks
- maintenance blockers
- equipment issues
- villa readiness
- utility / facility alerts

### Secondary Views

- zone board
- facility checklist
- equipment log

### What should be visible immediately

- Which physical zone is not ready?
- What is broken or delayed?
- Which quest is blocked by infrastructure?

#### 3.14 Business Intelligence Lead View

### Purpose

Measure feasibility, pricing, cost, and outcomes.

### Default Landing

**BI Command Center**

### Primary Widgets

- KPI status
- costing tasks
- pricing tasks
- readiness analytics
- quest performance summary
- margin / cost alerts

### Secondary Views

- KPI dashboard
- pricing table
- costing sheet views
- performance trends

### What should be visible immediately

- What is off track?
- What is expensive?
- Which quest is operationally or financially weak?
- What requires decision support?

#### 3.15 System Architect (Tech) View

### Purpose

Operate the digital system and automations.

### Default Landing

**System Operations Console**

### Primary Widgets

- dashboard health
- failed automations
- pending tech tasks
- system readiness
- broken links / integrations
- permission alerts

### Secondary Views

- automation logs
- API health
- role access matrix
- schema / object health

### What should be visible immediately

- What is broken in the system?
- What needs implementation?
- What blocks team use?
- Are automations and validations firing correctly?

#### 3.16 Data & Insights Analyst View

### Purpose

Observe performance trends and generate insight.

### Default Landing

**Insights Dashboard**

### Primary Widgets

- KPI trends
- readiness deltas
- top blockers
- quest velocity
- completion patterns

### Secondary Views

- analytics board
- weekly insight reports
- evidence-to-outcome analysis

### What should be visible immediately

- What pattern is emerging?
- Where is the system inefficient?
- Which role or quest is underperforming?

#### 3.17 Talent & Training Lead View

### Purpose

Own onboarding, capability building, and people readiness.

### Default Landing

**Talent Readiness Dashboard**

### Primary Widgets

- onboarding tasks
- training tasks
- role activation status
- people blockers
- talent readiness meter

### Secondary Views

- onboarding board
- training library
- readiness by role
- skill gap tracker

### What should be visible immediately

- Who is not yet activated?
- What training is missing?
- Which quest is blocked by people capacity?

#### 3.18 Workforce Coordinator View

### Purpose

Coordinate workload and execution rhythm.

### Default Landing

**Work Allocation Board**

### Primary Widgets

- task load by role
- overdue tasks
- ad-hoc load
- weekly allocation
- dependency map

### Secondary Views

- assignment board
- capacity planning
- daily coordination view

### What should be visible immediately

- Who is overloaded?
- What is unassigned?
- Where is there idle capacity?
- Which dependency chain is failing?

#### 3.19 Brand & Design Lead View

### Purpose

Shape identity, packaging, and visual expression.

### Default Landing

**Brand Design Dashboard**

### Primary Widgets

- design tasks
- identity tasks
- packaging tasks
- brand consistency approvals
- experience design blockers

### Secondary Views

- asset library
- design review board
- brand consistency tracker

### What should be visible immediately

- What design output is needed now?
- What needs approval?
- Which quest depends on design completion?

#### 3.20 Partnerships & Outreach Lead View

### Purpose

Build external relationships and ecosystem growth.

### Default Landing

**Outreach Dashboard**

### Primary Widgets

- outreach tasks
- collaboration tasks
- pending partner actions
- event / experience opportunities

### Secondary Views

- partner pipeline
- outreach board
- ecosystem opportunities log

### What should be visible immediately

- What external follow-up matters this week?
- What partnership supports a quest?
- What can unlock future experiences?

#### 3.21 Sales & Channel Lead View

### Purpose

Own go-to-market execution across channels.

### Default Landing

**Channel Activation Dashboard**

### Primary Widgets

- sales/channel tasks
- channel readiness
- activation blockers
- pricing dependencies
- packaging / fulfillment dependencies

### Secondary Views

- channels board
- activation checklist
- sales KPI tracker

### What should be visible immediately

- Which channel is closest to activation?
- What is blocking multi-channel sales?
- What depends on frontend / procurement / tech?

### 4. CROSS-ROLE SHARED VIEWS

Some views should be shared across many roles.

## A. Mission Control

Everyone sees it, but with filtered depth.

## B. Current Weekly Quest

Everyone should see:

- title
- narrative
- owner
- success conditions
- readiness contribution
- progress
- blockers

## C. Activity / Evidence Feed

Everyone should see visible progress.

## D. Governance Board

At least leads should see:

- pending approvals
- decisions
- blockers

### 5. UI ACCESS MODEL

For implementation, there are 3 layers:

## Layer 1 — Universal

Visible to everyone:

- Mission Control
- Current Quest
- My Tasks
- My Evidence
- Basic Readiness

## Layer 2 — Role-scoped

Visible by function:

- procurement board
- product lab
- BI center
- design board
- outreach board

## Layer 3 — Elevated

Visible only to governance/admin roles:

- full approvals
- full blockers
- decision panel
- system health
- role management

### 6. RECOMMENDED NAVIGATION BY ROLE

Instead of one identical sidebar, the sidebar should adapt slightly.

## Example: Backend-focused role

- Mission Control
- My Quests
- My Tasks
- Product / Production
- Evidence
- Readiness
- Governance

## Example: BI role

- Mission Control
- My Quests
- KPI Center
- Readiness
- Decisions
- Evidence
- Team Analytics

## Example: Tech role

- Mission Control
- System Console
- Tasks
- Automations
- Readiness
- Governance
- Activity Feed

### 7. FINAL PRINCIPLE

Every role-specific UI should answer this:

```
What am I responsible for?
What matters this week?
What should I do now?
What is blocked?
How is my work moving the mission?
```

If a view does not answer these, it is noise.

### 8. FINAL DEFINITION

```
RBAC controls access.
Role-specific UI controls clarity.
```

Together, they create:

- focus
- speed
- accountability
- alignment