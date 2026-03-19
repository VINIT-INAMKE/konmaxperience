# Phase 2: Mission Execution Hierarchy - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend CRUD APIs and frontend pages for the mission → quest → task hierarchy. Admin creates missions with phases, adds weekly quests assigned to role owners, and daily tasks assigned to individual users. Tasks have types (Core/Ad-hoc/Improvement) with XP weights, can declare dependencies, be marked as blocked, and progress auto-calculates from task completion. This phase delivers the execution engine — evidence and validation come in Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Mission/Quest/Task Creation Flow
- Mission creation: dedicated full-page form (title, description, phase, scope, dates)
- From the mission page, navigate into quests as separate pages
- From a quest page, manage tasks — also separate pages for task detail
- Hierarchy: Mission page → lists quests → click quest → quest page lists tasks → click task → task detail page
- Week numbering is RELATIVE to mission start (Week 1, Week 2, etc.), not calendar weeks

### Ad-hoc Task Injection
- Admin can inject ad-hoc tasks from BOTH:
  - Inside a quest page ("Add ad-hoc task" button)
  - Global shortcut (from dashboard/sidebar, picks which quest to attach to)
- Ad-hoc tasks are marked with task_type = "adhoc" and get 70% XP weight

### Task Views
- Users see tasks in BOTH kanban board AND list view, with a toggle to switch
- Kanban columns: To Do, Doing, Done, Blocked
- List view: table with status, priority, due date, type — sortable and filterable
- Task detail: full dedicated page (not side panel or modal) with all details

### Task Scope (Non-Admin Users)
- Users see own assigned tasks + read-only view of other tasks in the same quest (for context)
- Consistent with Phase 1 decision: own tasks + shared quest context

### Dependencies & Blockers
- Task owners can self-report blockers: "Report blocker" → enter reason → admin gets notified
- Blocked tasks get red "Blocked" badge inline on task cards/rows + show blocking reason
- Dedicated blockers overview page for admin listing all currently blocked tasks across the system
- Dependency setting mechanism: Claude's discretion (dropdown or link action)

### Progress Calculation
- Mission and quest progress auto-calculate from valid task completion per dev spec
- Progress display visual (bar vs ring): Claude's discretion
- Dual-track display (core vs ad-hoc): Claude's discretion — research determined dual-track prevents progress regression when ad-hoc tasks are injected

### Claude's Discretion
- Ad-hoc task visual differentiation (badge, color, section) — just make it clear
- Dependency setting UX (dropdown vs link action)
- Progress display visual (bar vs ring)
- Dual-track progress presentation (split vs combined)
- Mission list page layout and sorting
- Quest page layout and information density
- Task form field layout and validation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain Model & Schema
- `contextdocs/dev_spec.md` §4 (Domain model) — Mission, Quest, Task entity definitions
- `contextdocs/dev_spec.md` §7.3 (missions) — Mission schema with phases, scope, progress
- `contextdocs/dev_spec.md` §7.4 (quests) — Quest schema with week_number, progress
- `contextdocs/dev_spec.md` §7.5 (tasks) — Task schema with types, dependencies, XP, blockers
- `contextdocs/dev_spec.md` §8 (Relationships) — missions 1→* quests, quests 1→* tasks
- `contextdocs/dev_spec.md` §9 (Business rules) — Task validity, XP rules, dependency rules

### API Design
- `contextdocs/dev_spec.md` §11.3 (missions API) — GET/POST/PATCH /missions
- `contextdocs/dev_spec.md` §11.4 (quests API) — GET/POST/PATCH /quests
- `contextdocs/dev_spec.md` §11.5 (tasks API) — GET/POST/PATCH/verify/block /tasks

### Progress Logic
- `contextdocs/dev_spec.md` §10.5 (recalculate_mission_progress) — Progress pseudo-code
- `contextdocs/dev_spec.md` §10.6 (recalculate_quest_progress) — Quest progress pseudo-code

### Execution Architecture
- `contextdocs/blueprint.md` §Execution architecture — Mission hierarchy, two execution layers (fixed + ad-hoc)
- `contextdocs/technical.md` §LAYER 6 (Execution Engine) — Task types, execution rules

### Existing Implementation
- `backend/prisma/schema.prisma` — Mission, Quest, Task models already defined with all fields
- `backend/src/types/permissions.ts` — Permission enums (CREATE_MISSION, CREATE_QUEST, CREATE_TASK, etc.)
- `backend/src/permissions/scope.filter.ts` — buildScopeFilter for data-layer RBAC
- `backend/src/permissions/permissions.guard.ts` — @RequiresPermission decorator

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/permissions/permissions.guard.ts` — @RequiresPermission decorator for endpoint protection
- `backend/src/permissions/scope.filter.ts` — buildScopeFilter(user) for data-layer RBAC
- `backend/src/prisma/prisma.service.ts` — Global PrismaService for database access
- `frontend/lib/api-client.ts` — API client with auth, refresh, and error handling
- `frontend/lib/stores/auth-store.ts` — Zustand auth store with user/role state
- `frontend/components/ops/Sidebar.tsx` — Sidebar with nav items (Missions item exists but disabled)
- `frontend/components/ops/AdminUserFilter.tsx` — Admin user filter component pattern

### Established Patterns
- NestJS module pattern: Module → Controller → Service → Prisma
- Permission decorators: @RequiresPermission(Permission.X) on endpoints
- Frontend route groups: (auth) for public, (ops) for authenticated
- Zustand for client state, React Query for server state
- shadcn/ui components with dark mode

### Integration Points
- Sidebar: "Missions" nav item exists but is disabled — enable it and link to /missions
- Dashboard: currently placeholder — will link to mission overview in Phase 7
- Admin user filter: pattern can be reused for filtering tasks by user
- RBAC: CREATE_MISSION, CREATE_QUEST, CREATE_TASK permissions already in enum

</code_context>

<specifics>
## Specific Ideas

- The full-page task detail is important — tasks are the atomic unit of work in this system, they deserve a real page with room for evidence, approvals, and history (coming in Phase 3)
- Admin filtering by user name (not role) carries into this phase — "Show me Sadhana's tasks"
- Kanban board should be a quality implementation, not a basic grid — consider using Shoogle MCP for premium kanban components

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-mission-execution-hierarchy*
*Context gathered: 2026-03-19*
