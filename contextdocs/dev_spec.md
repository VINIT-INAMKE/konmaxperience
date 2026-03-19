## Developer Spec

### Schema + Pseudo-code + API-ready Structure

### 1. Product definition

Build a **role-based socio-technical operating system** for the first Konma Xperience node.

The system must coordinate:

- people
- space
- missions
- quests
- tasks
- evidence
- approvals
- readiness
- KPIs / OKRs
- governance decisions
- ad-hoc interventions

It should support **food, art, and lifestyle**, with food as the deepest initial execution layer.

### 2. Product goals

### Primary

- Make the team interact through one system
- Align long-term mission with daily execution
- Enforce evidence-backed completion
- Support both fixed roadmap and admin-created ad-hoc tasks
- Maintain governance and consensus where needed
- Convert real work into readiness and progress

### Non-goals for v1

- No blockchain dependency
- No complex marketplace engine yet
- No public-facing customer app
- No advanced AI dependency in MVP

### 3. Solution architecture

```
Mission Layer
  -> long-term mission
  -> mid-term goals
  -> weekly quests
  -> daily tasks

Governance Layer
  -> approvals
  -> consensus
  -> decision logs
  -> override rules

Execution Layer
  -> tasks
  -> evidence
  -> validation
  -> blockers
  -> dependencies

Intelligence Layer
  -> readiness
  -> KPIs / OKRs
  -> XP / levels
  -> leaderboard

Experience Layer
  -> food
  -> art
  -> lifestyle
  -> events
  -> outreach

Replication Layer
  -> SOPs
  -> recipes
  -> playbooks
  -> templates
```

### 4. Domain model

### 4.1 Core domains

- `MISSION`
- `QUEST`
- `TASK`
- `EVIDENCE`
- `DECISION`
- `READINESS_METER`
- `KPI`
- `USER`
- `ROLE`
- `ZONE`
- `BRAND`
- `CHANNEL`
- `ASSET`

### 4.2 Functional domains

- `FOOD`
- `ART`
- `LIFESTYLE`
- `OPERATIONS`
- `PROCUREMENT`
- `BUSINESS_INTELLIGENCE`
- `TALENT`
- `TECH`
- `DESIGN_OUTREACH`

### 5. Role model

### Roles

- `FOUNDER_ADMIN`
- `ANCHITHA_FRONTEND`
- `SADHANA_BACKEND`
- `HASMITHA_BI`
- `SURYA_PROCUREMENT`
- `SATHYA_TALENT`
- `VINIT_TECH`
- `ADVI_INNOVATION_DESIGN_OUTREACH`

### Role descriptions

- **Frontend**: customer flow, service, beverage, space interaction, channels
- **Backend**: food, production, R&D, standardization, quality
- **BI**: costing, pricing, KPIs, performance
- **Procurement**: vendors, sourcing, inventory
- **Talent**: onboarding, training, hiring, team readiness
- **Tech**: dashboard, automations, integrations
- **Design/Outreach**: design language, storytelling, experience design, partnerships
- **Founder/Admin**: strategy, mission control, escalations, overrides

### 6. Permission model

### Permission enums

- `VIEW_ALL`
- `VIEW_ROLE_SCOPED`
- `CREATE_MISSION`
- `CREATE_QUEST`
- `CREATE_TASK`
- `UPDATE_OWN_TASK`
- `UPDATE_ANY_TASK`
- `UPLOAD_EVIDENCE`
- `APPROVE_EVIDENCE`
- `VERIFY_TASK`
- `CREATE_DECISION`
- `APPROVE_DECISION`
- `MANAGE_RBAC`
- `CREATE_ADHOC_TASK`
- `MANAGE_SYSTEM`

### Rules

- users can update their own assigned tasks
- leads/admin can create tasks in their scope
- only leads/admin can approve evidence
- only leads/admin can verify tasks
- only admin can change mission structure
- ad-hoc tasks can be created by admin and designated leads
- cross-functional tasks may require multiple approvals

### 7. Data schema

Below is an API-ready relational schema.

### 7.1 roles

```
{
  "id":"uuid",
  "code":"string",
  "name":"string",
  "description":"string",
  "permissions": ["string"],
  "created_at":"timestamp"
}
```

### 7.2 users

```
{
  "id":"uuid",
  "name":"string",
  "email":"string",
  "role_id":"uuid",
  "function":"enum",
  "status":"enum(active,inactive)",
  "xp_total":0,
  "level":1,
  "streak_days":0,
  "created_at":"timestamp",
  "updated_at":"timestamp"
}
```

### 7.3 missions

```
{
  "id":"uuid",
  "title":"string",
  "description":"string",
  "phase":"enum(setup,foundation,activation,scale)",
  "scope":"enum(food,art,lifestyle,system,mixed)",
  "status":"enum(planned,active,completed,paused)",
  "start_date":"date",
  "end_date":"date",
  "progress_percent":0,
  "created_by":"uuid",
  "created_at":"timestamp",
  "updated_at":"timestamp"
}
```

### 7.4 quests

```
{
  "id":"uuid",
  "mission_id":"uuid",
  "title":"string",
  "description":"string",
  "week_number":1,
  "owner_user_id":"uuid",
  "status":"enum(planned,active,completed,blocked)",
  "progress_percent":0,
  "start_date":"date",
  "end_date":"date",
  "created_at":"timestamp",
  "updated_at":"timestamp"
}
```

### 7.5 tasks

```
{
  "id":"uuid",
  "mission_id":"uuid",
  "quest_id":"uuid|null",
  "title":"string",
  "description":"string",
  "task_type":"enum(core,adhoc,improvement)",
  "domain":"enum(food,art,lifestyle,ops,procurement,bi,talent,tech,design)",
  "owner_user_id":"uuid",
  "created_by":"uuid",
  "status":"enum(todo,doing,done,blocked,cancelled)",
  "priority":"enum(low,medium,high,critical)",
  "xp":25,
  "valid_xp":0,
  "verified":false,
  "valid":false,
  "requires_approval":true,
  "blocked":false,
  "blocked_reason":"string|null",
  "depends_on_task_id":"uuid|null",
  "readiness_meter_id":"uuid|null",
  "readiness_value":0,
  "kpi_id":"uuid|null",
  "due_date":"date|null",
  "completed_at":"timestamp|null",
  "created_at":"timestamp",
  "updated_at":"timestamp"
}
```

### 7.6 evidence

```
{
  "id":"uuid",
  "task_id":"uuid",
  "uploaded_by":"uuid",
  "type":"enum(photo,doc,video,sheet,link,note)",
  "url":"string",
  "notes":"string|null",
  "approval_status":"enum(pending,approved,rejected)",
  "reviewed_by":"uuid|null",
  "reviewed_at":"timestamp|null",
  "created_at":"timestamp"
}
```

### 7.7 approvals

```
{
  "id":"uuid",
  "entity_type":"enum(task,decision,evidence)",
  "entity_id":"uuid",
  "approval_scope":"enum(food,pricing,procurement,experience,tech,hiring,mixed)",
  "required_role_code":"string",
  "approved_by":"uuid|null",
  "status":"enum(pending,approved,rejected)",
  "notes":"string|null",
  "created_at":"timestamp",
  "updated_at":"timestamp"
}
```

### 7.8 decisions

```
{
  "id":"uuid",
  "title":"string",
  "decision_type":"enum(individual,cross_function,strategic)",
  "context":"string",
  "proposed_by":"uuid",
  "impact_scope":"enum(food,ops,space,procurement,system,brand,art,lifestyle)",
  "final_decision":"string|null",
  "status":"enum(proposed,under_review,approved,rejected,executed)",
  "linked_task_id":"uuid|null",
  "linked_mission_id":"uuid|null",
  "created_at":"timestamp",
  "updated_at":"timestamp"
}
```

### 7.9 readiness_meters

```
{
  "id":"uuid",
  "code":"string",
  "name":"string",
  "description":"string",
  "current_value":0,
  "target_value":100,
  "weight":1.0,
  "updated_at":"timestamp"
}
```

Suggested meters:

- `VILLA`
- `BACKEND`
- `FRONTEND`
- `PROCUREMENT`
- `STANDARDIZATION`
- `SALES`
- `TECH`
- `TALENT`
- `ART_EXPERIENCE`
- `LIFESTYLE_EXPERIENCE`

### 7.10 task_readiness_events

```
{
  "id":"uuid",
  "task_id":"uuid",
  "readiness_meter_id":"uuid",
  "value":5,
  "applied":true,
  "created_at":"timestamp"
}
```

### 7.11 kpis

```
{
  "id":"uuid",
  "name":"string",
  "description":"string",
  "unit":"string",
  "target_value":0,
  "current_value":0,
  "status":"enum(on_track,at_risk,off_track)",
  "domain":"enum(food,ops,sales,procurement,team,experience,tech)",
  "updated_at":"timestamp"
}
```

### 7.12 zones

```
{
  "id":"uuid",
  "name":"string",
  "zone_type":"enum(food_lab,production_kitchen,experience_zone,storage,ops_desk,brand_showcase,art_zone,lifestyle_zone)",
  "owner_user_id":"uuid|null",
  "status":"enum(planned,active,ready,needs_work)",
  "notes":"string|null"
}
```

### 7.13 brands

```
{
  "id":"uuid",
  "name":"string",
  "brand_type":"enum(food,art,lifestyle)",
  "status":"enum(idea,onboarding,testing,active,paused)",
  "owner_user_id":"uuid|null",
  "notes":"string|null"
}
```

### 7.14 channels

```
{
  "id":"uuid",
  "name":"string",
  "channel_type":"enum(dine_in,delivery,takeaway,retail,event,workshop,online)",
  "status":"enum(planned,testing,active,paused)"
}
```

### 7.15 assets

```
{
  "id":"uuid",
  "name":"string",
  "asset_type":"enum(recipe,sop,menu,cost_sheet,vendor_sheet,design_asset,training_doc,event_template)",
  "linked_task_id":"uuid|null",
  "linked_brand_id":"uuid|null",
  "url":"string",
  "status":"enum(draft,approved,archived)",
  "created_by":"uuid",
  "created_at":"timestamp"
}
```

### 8. Relationship model

```
roles 1---* users
missions 1---* quests
missions 1---* tasks
quests 1---* tasks
users 1---* tasks
tasks 1---* evidence
tasks 1---* approvals
decisions 1---* approvals
tasks *---1 readiness_meters
tasks *---1 kpis
tasks *---1 zones (optional future)
brands 1---* assets
tasks 1---* assets
```

### 9. Business rules

### Task validity

A task is valid only if:

- `status = done`
- at least one evidence record exists
- required evidence is approved
- all required approvals are satisfied
- `verified = true`

### XP rules

- `CORE` tasks = 100% XP
- `ADHOC` tasks = configurable, default 70% XP
- `IMPROVEMENT` tasks = configurable, default 80% XP
- invalid tasks always yield `0`

### Readiness rules

- only valid tasks can move readiness
- readiness movement is event-based, not recalculated blindly
- max meter value capped at 100

### Governance rules

- individual decisions can be executed by owner inside scope
- cross-function decisions require relevant approvals
- strategic decisions require founder/admin approval
- no logged decision = no formal decision

### Consensus rules

Use the “2+1” rule for cross-functional decisions:

- 2 relevant roles
- 1 impacted role

### Dependency rules

- blocked dependencies prevent downstream validation
- blocked tasks must include reason and optional escalation

### 10. Pseudo-code

### 10.1 validate_task

```
defvalidate_task(task_id):
task=get_task(task_id)
evidence_list=get_evidence_for_task(task_id)
approvals=get_approvals_for_entity("task",task_id)

has_approved_evidence=any(e.approval_status=="approved"foreinevidence_list)
approvals_satisfied=all(a.status=="approved"forainapprovals)iftask.requires_approvalelseTrue

if (
task.status=="done"
andtask.verifiedisTrue
andhas_approved_evidence
andapprovals_satisfied
    ):
task.valid=True
task.valid_xp=calculate_effective_xp(task)
else:
task.valid=False
task.valid_xp=0

save_task(task)
recalculate_user_xp(task.owner_user_id)
recalculate_quest_progress(task.quest_id)
recalculate_mission_progress(task.mission_id)
update_readiness_from_task(task.id)
```

### 10.2 calculate_effective_xp

```
defcalculate_effective_xp(task):
iftask.task_type=="core":
returntask.xp
eliftask.task_type=="adhoc":
returnint(task.xp*0.7)
eliftask.task_type=="improvement":
returnint(task.xp*0.8)
return0
```

### 10.3 recalculate_user_xp

```
defrecalculate_user_xp(user_id):
tasks=get_tasks_by_owner(user_id)
total_xp=sum(t.valid_xpfortintasksift.valid)
level=calculate_level(total_xp)
update_user(user_id, {
"xp_total":total_xp,
"level":level
    })
```

### 10.4 calculate_level

```
defcalculate_level(xp):
ifxp<200:
return1
elifxp<500:
return2
elifxp<1000:
return3
else:
return4
```

### 10.5 recalculate_mission_progress

```
defrecalculate_mission_progress(mission_id):
tasks=get_tasks_by_mission(mission_id)
total=len(tasks)
valid_done=len([tfortintasksift.valid])
progress=round((valid_done/total)*100,2)iftotalelse0
update_mission(mission_id, {"progress_percent":progress})
```

### 10.6 recalculate_quest_progress

```
defrecalculate_quest_progress(quest_id):
ifnotquest_id:
return
tasks=get_tasks_by_quest(quest_id)
total=len(tasks)
valid_done=len([tfortintasksift.valid])
progress=round((valid_done/total)*100,2)iftotalelse0
update_quest(quest_id, {"progress_percent":progress})
```

### 10.7 update_readiness_from_task

```
defupdate_readiness_from_task(task_id):
task=get_task(task_id)
ifnottask.validornottask.readiness_meter_id:
return

existing=get_readiness_event_by_task(task_id)
ifexisting:
return

create_task_readiness_event({
"task_id":task.id,
"readiness_meter_id":task.readiness_meter_id,
"value":task.readiness_value,
"applied":True
    })

events=get_events_for_meter(task.readiness_meter_id)
total=sum(e.valueforeineventsife.applied)
update_readiness_meter(task.readiness_meter_id, {
"current_value":min(total,100)
    })
```

### 10.8 approve_evidence

```
defapprove_evidence(evidence_id,reviewer_id):
evidence=get_evidence(evidence_id)
evidence.approval_status="approved"
evidence.reviewed_by=reviewer_id
evidence.reviewed_at=now()
save_evidence(evidence)
validate_task(evidence.task_id)
```

### 10.9 create_cross_function_decision

```
defcreate_cross_function_decision(payload):
decision=create_decision({
"title":payload["title"],
"decision_type":"cross_function",
"context":payload["context"],
"proposed_by":payload["proposed_by"],
"impact_scope":payload["impact_scope"],
"status":"under_review"
    })

forrole_codeinpayload["required_role_codes"]:
create_approval({
"entity_type":"decision",
"entity_id":decision.id,
"approval_scope":payload["impact_scope"],
"required_role_code":role_code,
"status":"pending"
        })

returndecision
```

### 10.10 mark_task_blocked

```
defmark_task_blocked(task_id,reason):
update_task(task_id, {
"status":"blocked",
"blocked":True,
"blocked_reason":reason
    })
trigger_blocker_notification(task_id)
```

### 10.11 unlock_next_phase

```
defunlock_next_phase():
meters=get_all_readiness_meters()

if (
get_meter_value("BACKEND")>=80and
get_meter_value("FRONTEND")>=80and
get_meter_value("PROCUREMENT")>=60and
get_meter_value("TECH")>=50
    ):
return {"unlock":True,"next_phase":"foundation"}

return {"unlock":False}
```

### 11. API structure

REST is sufficient for v1.

### 11.1 auth

### POST `/auth/login`

```
{
  "email":"user@example.com",
  "password":"secret"
}
```

### Response

```
{
  "token":"jwt-token",
  "user": {
    "id":"uuid",
    "name":"Anchitha",
    "role_code":"ANCHITHA_FRONTEND"
  }
}
```

### 11.2 roles and users

### GET `/roles`

### GET `/users`

### GET `/users/:id`

### PATCH `/users/:id`

### 11.3 missions

### GET `/missions`

### POST `/missions`

### GET `/missions/:id`

### PATCH `/missions/:id`

### 11.4 quests

### GET `/quests?mission_id=:id`

### POST `/quests`

### GET `/quests/:id`

### PATCH `/quests/:id`

### 11.5 tasks

### GET `/tasks`

Query params:

- `owner_user_id`
- `mission_id`
- `quest_id`
- `status`
- `task_type`
- `domain`

### POST `/tasks`

### GET `/tasks/:id`

### PATCH `/tasks/:id`

### POST `/tasks/:id/verify`

### POST `/tasks/:id/block`

Body:

```
{
  "reason":"Waiting on vendor confirmation"
}
```

### 11.6 evidence

### GET `/tasks/:id/evidence`

### POST `/tasks/:id/evidence`

```
{
  "type":"photo",
  "url":"https://...",
  "notes":"Cheesecake batch output"
}
```

### POST `/evidence/:id/approve`

### POST `/evidence/:id/reject`

### 11.7 approvals

### GET `/approvals?entity_type=task&entity_id=:id`

### POST `/approvals/:id/approve`

### POST `/approvals/:id/reject`

### 11.8 decisions

### GET `/decisions`

### POST `/decisions`

### GET `/decisions/:id`

### PATCH `/decisions/:id`

### 11.9 readiness

### GET `/readiness`

### GET `/readiness/:id`

### 11.10 kpis

### GET `/kpis`

### PATCH `/kpis/:id`

### 11.11 zones

### GET `/zones`

### POST `/zones`

### PATCH `/zones/:id`

### 11.12 brands

### GET `/brands`

### POST `/brands`

### PATCH `/brands/:id`

### 11.13 channels

### GET `/channels`

### POST `/channels`

### PATCH `/channels/:id`

### 11.14 assets

### GET `/assets`

### POST `/assets`

### PATCH `/assets/:id`

### 11.15 leaderboard

### GET `/leaderboard`

Response:

```
[
  {
    "user_id":"uuid",
    "name":"Sadhana",
    "xp_total":420,
    "level":2
  }
]
```

### 12. UI modules

### Founder/Admin

- mission control
- readiness overview
- pending approvals
- blocker dashboard
- decision board
- ad-hoc task injector
- leaderboard

### Role user

- my tasks
- my quests
- my evidence
- my contribution meters
- notifications

### Shared

- mission board
- quest board
- wins / milestones
- latest evidence feed

### 13. Notification / nudge logic

### due soon

```
iftask.due_date<=now_plus_48handnottask.valid:
notify(task.owner_user_id,"Task due within 48 hours")
```

### dependency blocked

```
iftask.depends_on_task_idanddependency_not_valid(task.depends_on_task_id):
notify(task.owner_user_id,"Task blocked by dependency")
```

### near level-up

```
if0<next_level_xp(user)-user.xp_total<=20:
notify(user.id,"You are close to the next level")
```

### quest almost complete

```
if80<=quest.progress_percent<100:
notify(quest.owner_user_id,"Quest almost complete")
```

### approval pending too long

```
ifapproval.status=="pending"andapproval.age_hours>24:
notify_admin("Approval pending more than 24 hours")
```

### 14. Seed data

### Readiness meters

```
[
  {"code":"VILLA","name":"Villa Readiness"},
  {"code":"BACKEND","name":"Backend Readiness"},
  {"code":"FRONTEND","name":"Frontend Readiness"},
  {"code":"PROCUREMENT","name":"Procurement Readiness"},
  {"code":"STANDARDIZATION","name":"Standardization Readiness"},
  {"code":"SALES","name":"Sales Readiness"},
  {"code":"TECH","name":"Tech Readiness"},
  {"code":"TALENT","name":"Talent Readiness"},
  {"code":"ART_EXPERIENCE","name":"Art Experience Readiness"},
  {"code":"LIFESTYLE_EXPERIENCE","name":"Lifestyle Experience Readiness"}
]
```

### Zones

```
[
  {"name":"Food Innovation Lab","zone_type":"food_lab"},
  {"name":"Production Kitchen","zone_type":"production_kitchen"},
  {"name":"Frontend Experience Zone","zone_type":"experience_zone"},
  {"name":"Procurement & Storage","zone_type":"storage"},
  {"name":"Intelligence & Planning Desk","zone_type":"ops_desk"},
  {"name":"Brand Showcase / Experience Space","zone_type":"brand_showcase"},
  {"name":"Art Zone","zone_type":"art_zone"},
  {"name":"Lifestyle Zone","zone_type":"lifestyle_zone"}
]
```

### 15. Recommended stack

### Fast MVP

- Frontend: Next.js
- Backend: FastAPI or Node/Express
- DB: Postgres / Supabase
- Auth: Supabase Auth / Clerk / JWT
- Storage: S3 / Supabase Storage
- Notifications: email first, Slack/WhatsApp later

### Internal MVP alternative

- Notion + Make/Zapier + Airtable/Sheets
- Later migrate to custom app

### 16. Implementation phases

### Phase 1

- schema
- missions / quests / tasks
- evidence / approvals
- readiness
- leaderboard
- basic RBAC

### Phase 1.5

- nudges
- dependency alerts
- badge engine
- KPI rollups

### Phase 2

- custom mobile-first UI
- richer governance workflows
- analytics and recommendations
- cross-node support

### 17. Acceptance criteria

The system is successful for v1 if:

- every user can see role-scoped work
- tasks cannot become valid without approved evidence
- readiness reflects only valid work
- ad-hoc tasks can be injected by admin without breaking roadmap
- approvals work for cross-functional decisions
- mission and quest progress update automatically
- blockers and dependencies are visible
- leaderboard uses valid XP only

### 18. Final framing

This system should be treated as:

```
Konma Xperience OS v1
= internal operating instance
= governed execution engine
= mission control for the first live node
```

It is not just a dashboard.

It is the **coordination layer between food, art, lifestyle, people, space, and progress**.