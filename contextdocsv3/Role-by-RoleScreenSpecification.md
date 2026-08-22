# Role-by-Role Screen Specification

# 🌾 KONMA XPERIENCE OS

### 1. UNIVERSAL SCREEN FRAMEWORK

Every role-specific screen should inherit the same top-level shell.

#### 1.1 Global Header

Visible on all screens.

### Components

- Konma logo / system name
- Current Mission
- Current Phase
- Current Weekly Quest
- Notification bell
- Quick search
- User role badge
- XP / Level mini display

#### 1.2 Global Sidebar

Adaptive, but from a shared base.

### Base navigation

- Mission Control
- My Quests
- My Tasks
- Readiness
- Evidence
- Governance
- Team

### Role-specific modules

Loaded depending on role.

#### 1.3 Global Footer / User Strip

- profile
- streak
- recent activity count
- quick upload evidence
- quick add note

### 2. SCREEN STRUCTURE TEMPLATE

Each role landing screen should follow this order:

#### A. Context Strip

- What mission am I contributing to?
- What quest is currently active?
- What readiness meter am I moving?

#### B. Primary Action Zone

- today’s highest-priority work
- blockers
- approvals

#### C. Role Workbench

- role-specific module
- task clusters
- domain assets

#### D. Progress + Contribution Zone

- readiness contribution
- completed valid tasks
- quest progress
- role KPI snippets

#### E. Activity + Governance

- evidence feed
- approval queue
- decisions or escalations relevant to the role

### 3. ROLE-BY-ROLE SCREEN SPECIFICATIONS

#### 3.1 MISSION DIRECTOR SCREEN

### Screen Name:

**Mission Control — Executive View**

### Purpose:

Strategic oversight across the entire system.

### Default Route:

`/mission-control/admin`

### Layout

## Top Context Strip

- Current Mission title
- Current Phase badge
- Current Weekly Quest
- Phase unlock status
- global readiness average

## Primary Widgets

### 1. Mission Health Panel

- active missions
- mission progress bars
- at-risk missions
- completed missions

### 2. Readiness Grid

- all readiness meters
- current %
- trend delta
- red/yellow/green state

### 3. Critical Alerts Panel

- high-priority blockers
- overdue approvals
- unresolved dependencies
- stalled quests

## Role Workbench

### 4. Quest Health Matrix

Table:

- quest name
- owner
- status
- progress
- overdue task count
- approval pending count

### 5. Governance Queue

- strategic decisions pending
- cross-functional decisions pending
- founder sign-offs needed

## Secondary Widgets

### 6. Team Contribution Snapshot

- by role
- by mission
- by timeframe

### 7. Top Risks / Weakest Meters

- procurement lag
- tech lag
- readiness regression

### 8. Activity Feed

- latest approvals
- completed quests
- validated evidence
- milestone events

### Key Actions

- approve strategic decision
- override task / unblock
- create mission
- create cross-functional quest
- issue admin ad-hoc task

#### 3.2 QUEST ARCHITECT SCREEN

### Screen Name:

**Quest Control Board**

### Purpose:

Design, monitor, and refine quests.

### Default Route:

`/quests/control`

### Top Context Strip

- active mission
- total active quests
- quests needing redesign
- ad-hoc drift warning

## Primary Widgets

### 1. Current Quest Portfolio

List of active quests:

- title
- owner
- type
- progress
- readiness contribution

### 2. Quest Integrity Panel

Shows quests missing:

- owner
- success criteria
- deadlines
- domain tags
- readiness targets

### 3. Ad-hoc to Quest Signal

Tasks that are repeated enough to deserve their own quest

## Role Workbench

### 4. Quest Builder

Form / editor:

- title
- narrative
- type
- owner
- success conditions
- readiness targets
- linked tasks
- approvals required

### 5. Dependency View

Quest-level map of:

- upstream blockers
- cross-role dependencies
- carry-forward risks

## Secondary Widgets

### 6. Quest Completion Confidence

Calculated score:

- task completion
- evidence coverage
- approval coverage
- blocker density

### 7. Archived Quest Learnings

- what worked
- what should repeat
- reusable assets

### Key Actions

- create quest
- edit quest
- reassign quest owner
- convert ad-hoc cluster into quest
- move quest to under review

#### 3.3 GOVERNANCE LEAD SCREEN

### Screen Name:

**Governance Console**

### Purpose:

Maintain approvals, consensus, and decision hygiene.

### Default Route:

`/governance`

### Top Context Strip

- pending approvals count
- overdue approvals count
- unresolved decisions
- escalations triggered

## Primary Widgets

### 1. Approval Queue

Tabs:

- evidence approvals
- task approvals
- decision approvals

Columns:

- item
- linked mission
- linked quest
- required role
- pending since
- urgency

### 2. Decision Board

- proposed
- under review
- approved
- rejected
- executed

### 3. Escalation Panel

- blocked > 24h
- approvals pending > 24h
- critical tasks stalled

## Role Workbench

### 4. Approval Detail Drawer

When clicked:

- context
- submitted evidence
- related tasks
- related quest
- comments
- approve / reject

### 5. Governance Rule Matrix

Shows current rules by domain:

- food
- pricing
- procurement
- experience
- tech
- hiring

## Secondary Widgets

### 6. Governance Audit Trail

- who approved what
- when
- what changed

### Key Actions

- approve evidence
- approve task
- approve decision
- reject with comments
- escalate to mission director

#### 3.4 PRODUCT INNOVATION LEAD SCREEN

### Screen Name:

**Product Lab Dashboard**

### Purpose:

Drive product ideation and prototype validation.

### Default Route:

`/product-lab`

### Top Context Strip

- current product quest
- active product experiments
- backend readiness contribution
- validation requests pending

## Primary Widgets

### 1. Product Quest Focus

- current quest narrative
- success conditions
- due date
- progress

### 2. Active Experiment Board

Columns:

- idea
- testing
- refining
- shortlisted
- validated

### 3. Product Tasks

- my product tasks
- linked ingredients
- linked readiness impact

## Role Workbench

### 4. Recipe / Product Asset Panel

- draft recipes
- approved recipes
- pending standardization
- rejected / retry items

### 5. Validation Request Panel

Items waiting for:

- frontend execution validation
- BI costing
- quality approval

## Secondary Widgets

### 6. Ingredient Dependency Signals

- missing ingredients
- vendor delays impacting product trials

### Key Actions

- create experiment task
- upload recipe evidence
- request validation
- move item to shortlisted / validated

#### 3.5 PRODUCTION LEAD SCREEN

### Screen Name:

**Production Operations Dashboard**

### Purpose:

Run backend execution and production flow.

### Default Route:

`/production`

### Top Context Strip

- today’s production target
- backend readiness
- blocked production tasks
- due-today count

## Primary Widgets

### 1. Today’s Production Queue

Sorted by:

- critical
- due today
- quest-linked

### 2. Production Flow Board

Stages:

- prep
- in production
- quality check
- ready

### 3. Dependency Alerts

- waiting on ingredient
- waiting on equipment
- waiting on standard recipe

## Role Workbench

### 4. Station / Process View

- assigned production tasks
- prep notes
- batch instructions
- quick evidence upload

### 5. Repeatability Panel

- previous batch outcomes
- time taken
- failure reasons
- consistency notes

## Secondary Widgets

### 6. Backend Contribution

- readiness moved this week
- validated tasks
- pending approvals

### Key Actions

- update task status
- mark blocked
- upload evidence
- request approval
- flag inconsistency

#### 3.6 QUALITY & STANDARDIZATION LEAD SCREEN

### Screen Name:

**Standardization Console**

### Purpose:

Convert outputs into repeatable systems.

### Default Route:

`/standardization`

### Top Context Strip

- standardization readiness
- items pending SOP
- items pending approval
- consistency risk count

## Primary Widgets

### 1. Standardization Queue

- recipes awaiting SOP
- flows awaiting SOP
- training items awaiting documentation

### 2. Validation Queue

- items awaiting repeatability approval
- items failing consistency check

### 3. Asset Status

- draft SOPs
- approved SOPs
- outdated SOPs

## Role Workbench

### 4. SOP Editor / Detail

- linked quest
- linked task
- linked evidence
- versioning
- approval flow

### 5. Consistency Tracker

- last 3 execution outcomes
- deviations
- notes

### Key Actions

- approve SOP
- request revision
- create standardization task
- mark repeatable

#### 3.7 EXPERIENCE LEAD SCREEN

### Screen Name:

**Experience Control Dashboard**

### Purpose:

Run the frontend and customer journey layer.

### Default Route:

`/experience`

### Top Context Strip

- active experience quest
- frontend readiness
- customer flow blockers
- simulation status

## Primary Widgets

### 1. Current Experience Quest

- title
- why it matters
- success conditions
- progress

### 2. Frontend Task Board

- service setup
- flow testing
- beverage
- packaging
- event-facing prep

### 3. Customer Journey Map Widget

Stages:

- arrival
- order
- wait
- receive
- exit / feedback

Show blockers at each stage.

## Role Workbench

### 4. Simulation Panel

- mock service runs
- timing logs
- friction points
- retries

### 5. Frontend Validation Queue

Items awaiting:

- plating validation
- flow validation
- experience sign-off

### Key Actions

- update experience task
- request backend alignment
- upload service evidence
- approve frontend-valid food item

#### 3.8 SERVICE OPERATIONS LEAD SCREEN

### Screen Name:

**Service Ops Board**

### Purpose:

Operate the real-time execution layer.

### Default Route:

`/service-ops`

### Top Context Strip

- current service target
- due-now tasks
- blocked-now tasks
- service timing target

## Primary Widgets

### 1. Live Ops Queue

- urgent tasks
- service-linked tasks
- due-now items

### 2. Timing Panel

- average prep time
- average completion time
- service delay flags

### 3. Escalations

- waiting on backend
- waiting on procurement
- queue overload

## Role Workbench

### 4. Shift / Cycle Board

- task assignments
- active order simulations
- current bottlenecks

### Key Actions

- mark task done
- flag blocker
- upload shift evidence
- trigger escalation

#### 3.9 ART & CULTURE CURATOR SCREEN

### Screen Name:

**Art Layer Dashboard**

### Purpose:

Activate and manage the art component.

### Default Route:

`/art`

### Top Context Strip

- art readiness
- current art quest
- installation blockers
- linked experience events

## Primary Widgets

### 1. Art Quest Panel

- active installations
- creative tasks
- deadlines

### 2. Art Task Board

Stages:

- concept
- preparation
- install
- review
- live

### 3. Dependency Panel

- waiting on design
- waiting on space
- waiting on ops clearance

## Role Workbench

### 4. Installation Detail View

- location
- materials
- linked event
- evidence
- sign-off status

### Key Actions

- create art task
- upload installation evidence
- request design/ops review

#### 3.10 LIFESTYLE EXPERIENCE LEAD SCREEN

### Screen Name:

**Lifestyle Layer Dashboard**

### Purpose:

Own workshops, events, and lifestyle integrations.

### Default Route:

`/lifestyle`

### Top Context Strip

- lifestyle readiness
- current lifestyle quest
- event blockers
- active collaborations

## Primary Widgets

### 1. Lifestyle Programming Board

- workshop tasks
- event prep
- activation tasks

### 2. Event Readiness Widget

- upcoming experience
- dependencies
- status

### Role Workbench

### 3. Experience Detail View

- concept
- owner
- required assets
- linked quest
- linked approvals

### Key Actions

- create programming task
- upload evidence
- request approval

#### 3.11 PROCUREMENT LEAD SCREEN

### Screen Name:

**Procurement Command View**

### Purpose:

Manage sourcing and vendor continuity.

### Default Route:

`/procurement`

### Top Context Strip

- procurement readiness
- urgent shortages
- pending vendor tasks
- delayed PO alerts

## Primary Widgets

### 1. Procurement Task Queue

- source
- confirm
- receive
- validate
- closed

### 2. Vendor Panel

- active vendors
- pending quotes
- delayed responses
- risk vendors

### 3. Inventory-Risk Alerts

- low stock
- unavailable items
- quest-blocking shortages

## Role Workbench

### 4. Purchase Order Detail

- linked task
- linked quest
- due date
- impact if delayed

### Key Actions

- create PO-linked task
- mark source complete
- upload vendor evidence
- flag procurement blocker

#### 3.12 INVENTORY & LOGISTICS LEAD SCREEN

### Screen Name:

**Inventory Operations View**

### Purpose:

Maintain inventory accuracy and movement.

### Default Route:

`/inventory`

### Top Context Strip

- stock health
- low stock count
- storage alerts
- movement issues

## Primary Widgets

### 1. Inventory Table

- item
- quantity
- threshold
- status
- linked quest/task

### 2. Movement Feed

- inward
- outward
- internal transfer

### Role Workbench

### 3. Storage Readiness Panel

- dry
- cold
- fast-moving
- overflow / mismatch

### Key Actions

- log movement
- update stock
- flag shortage
- link stock issue to task

#### 3.13 INFRASTRUCTURE & FACILITY LEAD SCREEN

### Screen Name:

**Villa Readiness Dashboard**

### Purpose:

Manage physical space and facility enablement.

### Default Route:

`/villa`

### Top Context Strip

- villa readiness
- zones needing work
- equipment issues
- maintenance blockers

## Primary Widgets

### 1. Zone Status Board

- food lab
- production kitchen
- experience zone
- storage
- ops desk
- art zone
- lifestyle zone

### 2. Equipment / Facility Alerts

- broken
- delayed
- needs installation
- waiting approval

### Role Workbench

### 3. Space Task Queue

- zoning
- setup
- repair
- optimize

### Key Actions

- update zone status
- create facility task
- mark issue blocked
- upload setup evidence

#### 3.14 BUSINESS INTELLIGENCE LEAD SCREEN

### Screen Name:

**BI Command Center**

### Purpose:

Control costing, pricing, and KPI visibility.

### Default Route:

`/bi`

### Top Context Strip

- current KPI health
- off-track KPI count
- quest financial risk
- readiness impact anomalies

## Primary Widgets

### 1. KPI Status Grid

- KPI name
- current
- target
- status
- linked quest/task

### 2. Costing / Pricing Queue

- products awaiting costing
- pricing pending approval
- cost risk alerts

### 3. Readiness vs Outcome Panel

- which readiness moved
- what business effect it created

## Role Workbench

### 4. Quest Performance Detail

- quest cost
- quest efficiency
- completion rate
- blockers impacting cost/time

### Key Actions

- update KPI
- approve pricing-linked item
- publish insight note
- flag high-cost risk

#### 3.15 SYSTEM ARCHITECT SCREEN

### Screen Name:

**System Operations Console**

### Purpose:

Monitor technical health of the OS.

### Default Route:

`/system-console`

### Top Context Strip

- system uptime / health
- failed automations
- unvalidated tasks count
- approval queue health

## Primary Widgets

### 1. Automation Status

- task validation jobs
- readiness updates
- notifications
- dependency checks

### 2. Data Integrity Panel

- tasks missing quest
- invalid links
- stale readiness
- orphaned evidence

### 3. Permission / RBAC Alerts

- permission mismatch
- unauthorized access attempt
- missing access mapping

## Role Workbench

### 4. Technical Backlog

- active tech tasks
- broken flows
- bug fixes
- UX enhancements

### Key Actions

- re-run automation
- patch issue
- update permission
- inspect failed workflow

#### 3.16 DATA & INSIGHTS ANALYST SCREEN

### Screen Name:

**Insights Dashboard**

### Purpose:

Spot patterns and generate improvement insights.

### Default Route:

`/insights`

### Top Context Strip

- trend summary
- weak-performing quest
- top blocker theme
- readiness delta week-on-week

## Primary Widgets

### 1. Trend Panels

- task completion rate
- quest velocity
- blocker trends
- approval delays

### 2. Role Contribution Trends

- by role
- by mission
- by week

### Role Workbench

### 3. Insight Note Builder

- create structured observations
- link to quest/mission
- recommend action

### Key Actions

- log insight
- flag systemic issue
- recommend quest change

#### 3.17 TALENT & TRAINING LEAD SCREEN

### Screen Name:

**Talent Readiness Dashboard**

### Purpose:

Ensure team onboarding and capability.

### Default Route:

`/talent`

### Top Context Strip

- talent readiness
- onboarding incomplete count
- training pending count
- role activation status

## Primary Widgets

### 1. Onboarding Queue

- who is not fully onboarded
- what is missing
- who owns completion

### 2. Training Task Board

- document
- teach
- review
- complete

### 3. Skill Gap Signals

- quest blocked by skill
- training overdue
- role under-activation

## Role Workbench

### 4. Role Readiness Panel

- readiness by role
- training completion
- onboarding evidence

### Key Actions

- assign onboarding task
- upload training evidence
- mark training complete
- flag role gap

#### 3.18 WORKFORCE COORDINATOR SCREEN

### Screen Name:

**Work Allocation Board**

### Purpose:

Balance work and capacity.

### Default Route:

`/allocation`

### Top Context Strip

- overloaded roles
- unassigned tasks
- dependency congestion
- ad-hoc load ratio

## Primary Widgets

### 1. Load by Role

- task count
- critical count
- blocked count
- due today

### 2. Assignment Queue

- unassigned tasks
- reassign suggestions
- carry-forward items

### Role Workbench

### 3. Capacity Planner

- available capacity
- overstretched roles
- underused roles

### Key Actions

- assign task
- rebalance load
- raise overload alert

#### 3.19 BRAND & DESIGN LEAD SCREEN

### Screen Name:

**Brand Design Dashboard**

### Purpose:

Manage identity, packaging, visual consistency.

### Default Route:

`/brand-design`

### Top Context Strip

- current brand quest
- pending visual approvals
- design blockers
- asset readiness

## Primary Widgets

### 1. Design Task Board

- concept
- draft
- review
- approved
- deployed

### 2. Asset Library

- menus
- packaging
- signage
- visual language docs

### Role Workbench

### 3. Review Queue

- items waiting for sign-off
- linked quest
- impact area

### Key Actions

- upload design asset
- approve asset
- request revision

#### 3.20 PARTNERSHIPS & OUTREACH LEAD SCREEN

### Screen Name:

**Outreach Dashboard**

### Purpose:

Manage external relationships and ecosystem links.

### Default Route:

`/outreach`

### Top Context Strip

- active outreach quest
- pending follow-ups
- collaboration opportunities
- event-linked outreach

## Primary Widgets

### 1. Outreach Task Board

- identify
- contact
- discuss
- confirm
- closed

### 2. Partner Pipeline

- type
- interest level
- linked quest/event

### Key Actions

- create outreach task
- log meeting note
- upload partner evidence
- convert outreach into activation task

#### 3.21 SALES & CHANNEL LEAD SCREEN

### Screen Name:

**Channel Activation Dashboard**

### Purpose:

Enable and track sales channels.

### Default Route:

`/channels`

### Top Context Strip

- sales readiness
- active channels
- blocked channels
- pricing dependency alerts

## Primary Widgets

### 1. Channel Status Board

- dine-in
- takeaway
- delivery
- retail
- events

### 2. Channel Task Queue

- packaging
- pricing
- system setup
- activation
- testing

### 3. Channel KPI Snapshot

- order readiness
- pricing readiness
- packaging readiness

### Key Actions

- activate channel task
- flag missing dependency
- request pricing approval
- upload activation evidence

### 4. SHARED SCREEN SPECS

#### 4.1 Mission Control Screen

Everyone sees it, depth varies by role.

### Required Components

- current mission
- current phase
- active quest
- readiness strip
- today’s focus
- blockers
- approvals
- recent evidence

#### 4.2 My Quests Screen

Shows only quests the role owns or contributes to.

### Required Components

- quest cards
- status
- progress
- deadline
- linked tasks
- blockers
- readiness impact

#### 4.3 My Tasks Screen

Task-focused execution board.

### Required Components

- task filters
- today / this week / overdue
- core / ad-hoc tags
- evidence status
- approval status
- dependency status

#### 4.4 Readiness Screen

Universal, but filtered.

### Required Components

- all meters
- role-relevant contribution
- contributing tasks
- trends

#### 4.5 Evidence Screen

Universal record of proof.

### Required Components

- uploads
- approval status
- linked task/quest
- recent validated work

### 5. FINAL DESIGN RULE

Every role-specific screen must make these five things obvious:

```
1. What is my current quest?
2. What do I need to do now?
3. What is blocked?
4. What needs my input or approval?
5. How is my work moving the system?
```

If a screen fails these five, it is not finished.

### 6. FINAL OUTPUT

This specification gives:

- default route per role
- widget set per role
- action model per role
- UI hierarchy
- shared vs role-specific surfaces