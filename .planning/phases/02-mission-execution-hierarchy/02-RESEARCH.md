# Phase 2: Mission Execution Hierarchy - Research

**Researched:** 2026-03-19
**Domain:** NestJS 11 CRUD modules + Next.js 16 App Router pages — mission/quest/task hierarchy, kanban, dependency tracking, ad-hoc injection, dual-track progress
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Mission creation: dedicated full-page form (title, description, phase, scope, dates)
- Hierarchy navigation: Mission page lists quests → click quest → quest page lists tasks → click task → task detail page
- Week numbering: RELATIVE to mission start (Week 1, Week 2, etc.) — not calendar weeks
- Ad-hoc task injection from BOTH: inside a quest page ("Add ad-hoc task" button) AND global shortcut (from dashboard/sidebar)
- Ad-hoc tasks marked with `task_type = "adhoc"` and get 70% XP weight
- Task views: kanban board AND list view, with a toggle to switch
- Kanban columns: To Do, Doing, Done, Blocked
- List view: table with status, priority, due date, type — sortable and filterable
- Task detail: full dedicated page (not side panel or modal) with all details
- Users see own assigned tasks + read-only view of other tasks in the same quest (for context)
- Task owners can self-report blockers: "Report blocker" → enter reason → admin notified
- Blocked tasks get red "Blocked" badge inline on task cards/rows + show blocking reason
- Dedicated blockers overview page for admin listing all currently blocked tasks
- Mission and quest progress auto-calculate from valid task completion per dev spec
- Dual-track progress (core vs ad-hoc): Claude's discretion — prevents progress regression
- Kanban board should be quality implementation — use Shoogle MCP for premium kanban components

### Claude's Discretion

- Ad-hoc task visual differentiation (badge, color, section)
- Dependency setting UX (dropdown vs link action)
- Progress display visual (bar vs ring)
- Dual-track progress presentation (split vs combined)
- Mission list page layout and sorting
- Quest page layout and information density
- Task form field layout and validation

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-01 | Admin can create long-term missions with phases (setup, foundation, activation, scale) | MissionsModule: POST /missions with phase enum; full-page create form in frontend |
| EXEC-02 | Missions contain weekly quests assigned to role owners | QuestsModule: POST /quests with mission_id + week_number (relative) + owner_user_id |
| EXEC-03 | Quests contain daily tasks assigned to individual users | TasksModule: POST /tasks with quest_id + owner_user_id; RBAC via CREATE_TASK permission |
| EXEC-04 | Tasks have types: Core (100% XP), Ad-hoc (70% XP), Improvement (80% XP) | task_type enum already in schema; XP weight applied in recalculate_user_xp (Phase 3 validates, Phase 2 stores) |
| EXEC-05 | Admin can inject ad-hoc tasks without breaking the mission roadmap | Dual-track progress (core_progress_percent separate from adhoc_progress_percent); already in schema from Phase 1 |
| EXEC-06 | Tasks can declare dependencies on other tasks | `depends_on_task_id` FK already in Task schema; dependency selector UI on task create/edit form |
| EXEC-07 | Blocked tasks show reason and trigger blocker alerts | POST /tasks/:id/block endpoint; `blocked` + `blocked_reason` fields in schema; admin blockers overview page |
| EXEC-08 | Mission and quest progress auto-calculate from valid task completion | recalculate_quest_progress + recalculate_mission_progress service functions; triggered on task status change |
</phase_requirements>

---

## Summary

Phase 2 builds the execution spine of the system: the NestJS modules for missions, quests, and tasks, plus the frontend pages for managing and viewing them. The schema is complete from Phase 1 — every field needed (dual-track progress, blockers, dependencies, task types) is already defined in `backend/prisma/schema.prisma`. This phase adds the API layer and frontend UI on top of an already-correct data model.

The backend work follows the established NestJS module pattern: one module per entity (`MissionsModule`, `QuestsModule`, `TasksModule`), each with its own Controller → Service → Prisma chain. `@RequiresPermission` decorators protect endpoints, and `buildScopeFilter(user)` enforces data-layer RBAC in every service query. These patterns are proven in Phase 1 code.

The frontend work involves three tiers of pages — missions list → mission detail (with quests) → quest detail (with tasks) → task detail — plus a kanban/list toggle view on the quest page. The kanban is the most complex UI component; it needs `@dnd-kit` for drag-and-drop and ideally a quality component from Shoogle MCP. Progress calculation is event-driven: task status change calls `recalculate_quest_progress()` and `recalculate_mission_progress()`, keeping both core and ad-hoc tracks current.

**Primary recommendation:** Build backend before frontend. Three NestJS modules (Missions, Quests, Tasks) in sequence, then three frontend page tiers. Use `@dnd-kit` for kanban drag-and-drop. Protect dual-track progress from injection by keeping `baseline_task_count` immutable after quest creation. Wrap all progress recalculations in a Prisma interactive transaction.

---

## Standard Stack

### Core (already installed — confirmed from package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS (@nestjs/core) | 11.0.1 | Backend module framework | Locked; Guards + Decorators; Module → Controller → Service pattern established in Phase 1 |
| Prisma (@prisma/client) | 6.19.2 | ORM | Locked; schema with Mission/Quest/Task already defined; `$transaction` for atomic progress recalc |
| Next.js | 16.2.0 | Frontend pages | Locked; App Router; dynamic `[id]` segments for detail pages |
| shadcn/ui (existing components) | 4.0.8 | UI components | Already installed: button, card, badge, table, dialog, select, checkbox, input, dropdown-menu |
| React Hook Form | 7.71.2 | Form management | Already installed; mission/quest/task creation forms |
| Zod | 4.3.6 | Schema validation | Already installed; DTO validation in forms and NestJS |
| TanStack Query | 5.91.2 | Server state | Already installed; mission list, quest list, task list data fetching |
| Zustand | 5.0.12 | Client state | Already installed; auth store + view state (kanban vs list toggle) |
| lucide-react | 0.577.0 | Icons | Already installed; task type icons, status icons, action icons |

### New Dependencies Required

| Library | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| @dnd-kit/core | 6.3.1 | Drag-and-drop engine | `npm install @dnd-kit/core` |
| @dnd-kit/sortable | 10.0.0 | Sortable lists/kanban | `npm install @dnd-kit/sortable` |
| @dnd-kit/utilities | 3.2.2 | DnD utilities | `npm install @dnd-kit/utilities` |
| date-fns | 4.1.0 | Date formatting for due dates, week display | `npm install date-fns` |

**Install in frontend:**
```bash
cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities date-fns
```

**No new backend dependencies required.** All NestJS patterns (guards, decorators, Prisma) are already in place from Phase 1.

### Shoogle MCP — Kanban Component

Per CONTEXT.md and memory: "Kanban board should be a quality implementation — use Shoogle MCP." The Shoogle MCP server (https://mcp.shoogle.dev/mcp) provides premium shadcn-compatible kanban components. Executor agents MUST query Shoogle MCP for the kanban component before building from scratch. If Shoogle MCP provides a kanban that fits the Konma columns (To Do, Doing, Done, Blocked), use it as the base and extend it with `@dnd-kit`.

### shadcn Components Needed (not yet installed)

The following shadcn components are needed and not yet present in `frontend/components/ui/`:
- `sheet` — for global ad-hoc task injection (slide-in panel from sidebar shortcut)
- `textarea` — for task description, blocker reason fields
- `popover` — for dependency picker dropdown
- `progress` — for mission/quest progress bars
- `tabs` — for kanban/list view toggle (or use custom toggle)
- `scroll-area` — for kanban column scroll

Install as needed:
```bash
cd frontend && npx shadcn@latest add sheet textarea popover progress tabs scroll-area
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit | react-beautiful-dnd | react-beautiful-dnd is unmaintained as of 2023; @dnd-kit is the current standard, accessible, works with React 19 |
| @dnd-kit | Custom drag-and-drop | Drag-and-drop has many edge cases (touch, keyboard a11y, scroll containers); @dnd-kit handles all of them |
| date-fns | dayjs | Both are adequate; date-fns is already in the recommended stack (STACK.md); consistent choice |

---

## Architecture Patterns

### Recommended Project Structure

**Backend additions:**
```
backend/src/
├── missions/
│   ├── missions.module.ts
│   ├── missions.controller.ts    # GET/POST/PATCH /missions, GET /missions/:id
│   ├── missions.service.ts       # findAll, findOne, create, update, recalculateProgress
│   └── dto/
│       ├── create-mission.dto.ts
│       └── update-mission.dto.ts
├── quests/
│   ├── quests.module.ts
│   ├── quests.controller.ts      # GET/POST/PATCH /quests?mission_id=, GET /quests/:id
│   ├── quests.service.ts         # findAll, findOne, create, update, recalculateProgress
│   └── dto/
│       ├── create-quest.dto.ts
│       └── update-quest.dto.ts
├── tasks/
│   ├── tasks.module.ts
│   ├── tasks.controller.ts       # GET/POST/PATCH /tasks, GET/PATCH /tasks/:id, POST /tasks/:id/block
│   ├── tasks.service.ts          # findAll (scope-filtered), findOne, create, update, block
│   └── dto/
│       ├── create-task.dto.ts
│       ├── update-task.dto.ts
│       └── block-task.dto.ts
```

**Frontend additions:**
```
frontend/app/(ops)/
├── missions/
│   ├── page.tsx                  # Mission list — sortable table/cards
│   ├── new/
│   │   └── page.tsx              # Create mission form (full page)
│   └── [id]/
│       ├── page.tsx              # Mission detail — quest list + progress
│       └── quests/
│           └── new/
│               └── page.tsx      # Create quest form
├── quests/
│   └── [id]/
│       ├── page.tsx              # Quest detail — task kanban/list + progress
│       └── tasks/
│           └── new/
│               └── page.tsx      # Create task form
├── tasks/
│   └── [id]/
│       └── page.tsx              # Task detail — full page (placeholder for Phase 3 evidence)
└── admin/
    └── blockers/
        └── page.tsx              # Admin: all currently blocked tasks overview

frontend/components/ops/
├── missions/
│   ├── MissionCard.tsx           # Mission card with progress bar
│   └── MissionForm.tsx           # Create/edit mission form
├── quests/
│   ├── QuestCard.tsx             # Quest card with dual-track progress
│   └── QuestForm.tsx             # Create/edit quest form
├── tasks/
│   ├── TaskKanban.tsx            # Kanban board (4 columns)
│   ├── TaskKanbanCard.tsx        # Individual task card in kanban
│   ├── TaskListView.tsx          # Table view with sort/filter
│   ├── TaskViewToggle.tsx        # Kanban/list toggle control
│   ├── TaskForm.tsx              # Create/edit task form
│   ├── BlockerDialog.tsx         # "Report blocker" dialog
│   └── AdHocTaskDialog.tsx       # Ad-hoc task injection dialog (global shortcut)
```

### Pattern 1: NestJS Module (established from Phase 1)

**What:** Module → Controller → Service → Prisma. Each entity is one module. Controller handles HTTP, Service handles business logic, Prisma accessed only in Service.

**When to use:** Every new entity (Missions, Quests, Tasks).

```typescript
// backend/src/missions/missions.controller.ts
import { Controller, Get, Post, Patch, Param, Body, Query, Req } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateMissionDto } from './dto/create-mission.dto';
import express from 'express';

@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get()
  // All authenticated users can view missions (shared board)
  async findAll(@Req() req: express.Request) {
    const user = (req as any).user;
    return this.missionsService.findAll(user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: express.Request) {
    const user = (req as any).user;
    return this.missionsService.findOne(id, user);
  }

  @Post()
  @RequiresPermission(Permission.CREATE_MISSION)
  async create(@Body() dto: CreateMissionDto, @Req() req: express.Request) {
    const user = (req as any).user;
    return this.missionsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequiresPermission(Permission.CREATE_MISSION)
  async update(@Param('id') id: string, @Body() dto: UpdateMissionDto) {
    return this.missionsService.update(id, dto);
  }
}
```

### Pattern 2: Scope-Filtered Task Queries (critical for EXEC-03)

**What:** Tasks are the only entity with granular per-user scoping. Missions and quests are readable by all internal users (shared board). Tasks apply `buildScopeFilter(user)` so non-admin users only see own tasks by default, with an additional `quest_id` filter for the "quest context" view.

**When to use:** Every `TasksService.findAll()` call.

```typescript
// backend/src/tasks/tasks.service.ts
import { buildScopeFilter } from '../permissions/scope.filter';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { Permission } from '../types/permissions';

async findAll(
  requestingUser: { id: string; roleCode: string },
  filters: { questId?: string; missionId?: string; status?: string; viewAs?: string },
): Promise<Task[]> {
  const perms = await getPermissionsForRole(requestingUser.roleCode, this.prisma);
  const scopedUser = { ...requestingUser, permissions: perms };
  const scopeFilter = buildScopeFilter(scopedUser);

  // Admin viewAs filter (same pattern as Phase 1 AUTH-06)
  const adminViewFilter =
    perms.includes(Permission.VIEW_ALL) && filters.viewAs
      ? { owner_user_id: filters.viewAs }
      : {};

  // Quest context: non-admin users see own tasks AND read-only other tasks in same quest
  // This is handled by the frontend: call findAll twice — once scoped (editable), once by questId (read-only)
  // OR: return all tasks for a quest and mark ownership in the response

  return this.prisma.task.findMany({
    where: {
      ...scopeFilter,
      ...adminViewFilter,
      ...(filters.questId ? { quest_id: filters.questId } : {}),
      ...(filters.missionId ? { mission_id: filters.missionId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      owner: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      depends_on: { select: { id: true, title: true, status: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}
```

**Quest context read-only view:** For non-admin users on a quest page, use two queries — one scoped (user's own tasks, editable) and one `{ quest_id: questId }` without scope filter (all tasks, read-only). Return a combined response with an `is_own` boolean per task so the frontend can render edit controls only on owned tasks.

### Pattern 3: Atomic Progress Recalculation

**What:** When a task's status changes, recalculate quest and mission progress atomically. Both updates must commit together or neither should, to avoid inconsistent progress values.

**When to use:** PATCH /tasks/:id whenever `status` field changes.

```typescript
// backend/src/tasks/tasks.service.ts

async update(id: string, dto: UpdateTaskDto, requestingUser: ScopedUser): Promise<Task> {
  const task = await this.prisma.task.findUniqueOrThrow({ where: { id } });

  const updated = await this.prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        // ... other fields
        ...(dto.status === 'done' ? { completed_at: new Date() } : {}),
      },
    });

    // Recalculate progress if status changed
    if (dto.status && dto.status !== task.status) {
      await this.recalculateQuestProgress(task.quest_id, tx);
      await this.recalculateMissionProgress(task.mission_id, tx);
    }

    return updatedTask;
  });

  return updated;
}

private async recalculateQuestProgress(
  questId: string | null,
  tx: Prisma.TransactionClient,
): Promise<void> {
  if (!questId) return;
  const quest = await tx.quest.findUniqueOrThrow({ where: { id: questId } });

  // Core progress: valid core tasks / baseline_task_count (set at creation, never changes)
  const coreTasks = await tx.task.count({
    where: { quest_id: questId, task_type: 'core', valid: true },
  });
  const coreProgress = quest.baseline_task_count > 0
    ? Math.round((coreTasks / quest.baseline_task_count) * 100)
    : 0;

  // Ad-hoc progress: valid adhoc tasks / total adhoc tasks
  const totalAdhoc = await tx.task.count({ where: { quest_id: questId, task_type: 'adhoc' } });
  const validAdhoc = await tx.task.count({ where: { quest_id: questId, task_type: 'adhoc', valid: true } });
  const adhocProgress = totalAdhoc > 0 ? Math.round((validAdhoc / totalAdhoc) * 100) : 0;

  // Combined progress for display (weighted: core carries more weight)
  const combinedProgress = quest.baseline_task_count > 0
    ? Math.round(((coreTasks + validAdhoc * 0.7) / (quest.baseline_task_count + totalAdhoc * 0.7)) * 100)
    : 0;

  await tx.quest.update({
    where: { id: questId },
    data: {
      core_progress_percent: coreProgress,
      adhoc_progress_percent: adhocProgress,
      progress_percent: combinedProgress,
    },
  });
}

private async recalculateMissionProgress(missionId: string, tx: Prisma.TransactionClient): Promise<void> {
  const tasks = await tx.task.findMany({ where: { mission_id: missionId } });
  const total = tasks.length;
  const validDone = tasks.filter((t) => t.valid).length;
  const progress = total > 0 ? Math.round((validDone / total) * 100) : 0;
  await tx.mission.update({ where: { id: missionId }, data: { progress_percent: progress } });
}
```

### Pattern 4: Blocking a Task (EXEC-07)

**What:** POST /tasks/:id/block sets `blocked = true`, `status = "blocked"`, `blocked_reason = reason`. Admin gets notified (notification is logged, actual delivery in Phase 8).

```typescript
// backend/src/tasks/tasks.controller.ts
@Post(':id/block')
async blockTask(
  @Param('id') id: string,
  @Body() dto: BlockTaskDto,
  @Req() req: express.Request,
) {
  const user = (req as any).user;
  return this.tasksService.block(id, dto.reason, user);
}

// backend/src/tasks/tasks.service.ts
async block(id: string, reason: string, requestingUser: ScopedUser): Promise<Task> {
  // Only task owner or admin can block
  const task = await this.prisma.task.findUniqueOrThrow({ where: { id } });
  const perms = await getPermissionsForRole(requestingUser.roleCode, this.prisma);
  const canBlock =
    perms.includes(Permission.UPDATE_ANY_TASK) ||
    (perms.includes(Permission.UPDATE_OWN_TASK) && task.owner_user_id === requestingUser.id);
  if (!canBlock) throw new ForbiddenException('Not authorized to block this task');

  return this.prisma.task.update({
    where: { id },
    data: { status: 'blocked', blocked: true, blocked_reason: reason },
  });
  // Note: blocker notification dispatch goes here in Phase 8
}
```

### Pattern 5: Baseline Task Count Protection

**What:** `quest.baseline_task_count` is set once at quest creation to the number of core tasks initially planned. It NEVER changes, even when ad-hoc tasks are injected. This is the denominator for `core_progress_percent`.

**When to use:** QuestsService.create() sets `baseline_task_count = 0` initially (no tasks yet). It is updated ONCE when the first batch of core tasks is created via a `setBaseline` operation, OR it can be set directly from the quest creation form if the admin inputs an expected task count.

**Implementation decision:** Set `baseline_task_count` when a quest is activated (status changes from `planned` to `active`). At activation time, count existing core tasks and lock that number.

```typescript
// In QuestsService.activate():
async activate(questId: string): Promise<Quest> {
  const coreTasks = await this.prisma.task.count({
    where: { quest_id: questId, task_type: 'core' },
  });
  return this.prisma.quest.update({
    where: { id: questId },
    data: { status: 'active', baseline_task_count: coreTasks },
  });
}
```

### Pattern 6: Next.js 16 Dynamic Route Pages — params is a Promise

**Critical:** In Next.js 16 (based on local docs), `params` in page components is a Promise. Both Server Components (`await params`) and Client Components (`use(params)` from React 19) must handle this correctly.

```typescript
// frontend/app/(ops)/missions/[id]/page.tsx — Client Component pattern
'use client';
import { use } from 'react';

export default function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);   // React 19 use() hook for Client Components
  // ... rest of page
}
```

All dynamic route pages in this phase must use `use(params)` in Client Components or `await params` in Server Components. Do NOT access params synchronously — it will work but is deprecated.

### Pattern 7: Kanban with @dnd-kit

**What:** Four-column kanban board (To Do, Doing, Done, Blocked). Drag-and-drop updates task status. Uses `@dnd-kit/core` + `@dnd-kit/sortable`.

```typescript
// frontend/components/ops/tasks/TaskKanban.tsx
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

const COLUMNS = ['todo', 'doing', 'done', 'blocked'] as const;
type TaskStatus = typeof COLUMNS[number];

export function TaskKanban({ tasks, onStatusChange }: TaskKanbanProps) {
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    if (active.id !== over.id) {
      onStatusChange(taskId, newStatus);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-4 h-full">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column}
            id={column}
            tasks={tasks.filter((t) => t.status === column)}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

### Anti-Patterns to Avoid

- **Recalculating progress outside a transaction:** Quest and mission progress updates must be inside the same `$transaction` as the task update. Separate commits = inconsistent state if server restarts between writes.
- **Mutating baseline_task_count:** After a quest is activated, `baseline_task_count` is immutable. NEVER update it when ad-hoc tasks are added. Core progress denominator must be stable.
- **Scoped users reading other users' tasks:** `buildScopeFilter` must be applied in TasksService. The "quest context read-only" view is a separate query pattern, not a bypass of scope filtering.
- **Accessing params synchronously in Next.js 16:** `params` is a Promise. Always use `use(params)` in Client Components or `await params` in Server Components.
- **Using react-beautiful-dnd:** It is unmaintained. Use `@dnd-kit` exclusively.
- **Admin blockers page missing scope:** Admin blockers overview is a `VIEW_ALL` endpoint only. `GET /tasks?blocked=true` with no scope filter, visible only to FOUNDER_ADMIN.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Kanban drag-and-drop | Custom mousedown/mousemove listeners | @dnd-kit/core + @dnd-kit/sortable | Edge cases: touch events, keyboard accessibility, scroll containers, collision detection, multi-pointer. @dnd-kit handles all of these. |
| Date formatting for week display | Manual date arithmetic | date-fns (format, differenceInWeeks, addWeeks) | DST edge cases, locale handling, leap year math. date-fns is battle-tested. |
| Progress bar component | Custom div width manipulation | shadcn/ui Progress component | Already in shadcn; just `npx shadcn add progress`. |
| Form validation | Manual HTML5 validity checks | react-hook-form + zod (already installed) | Already in project; consistent validation pattern from Phase 1. |
| Sorting/filtering tasks in table | Custom sort state management | TanStack Table (or simple useState sort) | For a ~50-task table, simple state is fine; TanStack Table if complexity grows. |

**Key insight:** The most complex custom work in this phase is the kanban board. Everything else (CRUD forms, progress display, tables) is standard UI composition. Query Shoogle MCP for the kanban component first.

---

## Common Pitfalls

### Pitfall 1: Progress Regression on Ad-hoc Injection
**What goes wrong:** Quest shows 80% (8/10 core tasks done). Admin injects ad-hoc task. Quest drops to 73% (8/11). Team thinks progress went backward.
**Why it happens:** Single `progress_percent` denominator includes all tasks.
**How to avoid:** `core_progress_percent` uses `baseline_task_count` (locked at activation, never changes). Ad-hoc tasks only affect `adhoc_progress_percent`. Display both tracks separately. Schema already has these fields from Phase 1.
**Warning signs:** Any code that calls `COUNT(*) WHERE quest_id = X` as the denominator for core progress.

### Pitfall 2: baseline_task_count Never Set
**What goes wrong:** Quest created, tasks added, quest activated, `baseline_task_count` stays 0. `core_progress_percent` is always 0/0 = 0. Progress never shows correctly.
**Why it happens:** `baseline_task_count` defaults to 0 in schema. There is no trigger to set it automatically.
**How to avoid:** Set `baseline_task_count` explicitly in `QuestsService.activate()` by counting current core tasks. Alternatively, allow the quest creation form to accept an expected task count that seeds the baseline.
**Warning signs:** `baseline_task_count = 0` for any active quest that has tasks.

### Pitfall 3: Task Scope Bypass in Quest Context View
**What goes wrong:** Non-admin user on the quest page can see all tasks because the query uses `{ quest_id: questId }` without the scope filter. This leaks other users' task details.
**Why it happens:** "Quest context" read-only view requires a different query shape than the normal scoped view.
**How to avoid:** Two separate query patterns: (1) scoped query `{ quest_id: questId, owner_user_id: user.id }` for editable tasks; (2) a separate "preview" query `{ quest_id: questId }` returning only `{ id, title, status, owner.name }` (minimal fields, no sensitive data). The frontend renders editable controls only on owned tasks.
**Warning signs:** `GET /tasks?quest_id=X` returns full task details for tasks owned by other users to a scoped role.

### Pitfall 4: Drag-and-drop Status Change Without Permission Check
**What goes wrong:** Non-admin user drags another user's task to "Done" column, changing its status without authorization.
**Why it happens:** Kanban drag-and-drop fires `onStatusChange(taskId, newStatus)`. The frontend may not check ownership before calling PATCH.
**How to avoid:** Frontend checks `task.owner_user_id === currentUser.id` before allowing drag. Backend ALWAYS validates permission in `TasksService.update()` — `UPDATE_OWN_TASK` holders can only update tasks they own; `UPDATE_ANY_TASK` holders can update any task.
**Warning signs:** Any kanban card without a `draggable` check against task ownership.

### Pitfall 5: Ad-hoc Quest Completion Reset
**What goes wrong:** Quest status = `completed`. Admin injects an ad-hoc task. Quest silently resets to `active` (or code incorrectly recalculates to < 100%).
**Why it happens:** Ad-hoc task injection decreases the adhoc denominator, making `progress_percent` < 100. Some code might interpret this as "quest is no longer complete" and reset status.
**How to avoid:** Quest `status` field is ONLY updated manually (admin sets it to `active`, `completed`, etc.). Auto-recalculated progress fields (`core_progress_percent`, `adhoc_progress_percent`, `progress_percent`) NEVER touch the `status` field. Status is a separate concern.
**Warning signs:** `recalculateQuestProgress` also writes `quest.status`.

### Pitfall 6: Next.js 16 params Synchronous Access
**What goes wrong:** Page component accesses `params.id` directly without `await` or `use()`. Builds fine in dev, fails silently or with a deprecation warning.
**Why it happens:** In Next.js 14 and earlier, params was synchronous. Next.js 16 changed it to a Promise.
**How to avoid:** Always use `use(params)` in Client Components, `await params` in Server Components (confirmed in local Next.js 16 docs at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`).
**Warning signs:** `const { id } = params` without awaiting in page components.

---

## Code Examples

### NestJS DTO with class-validator (established pattern)

```typescript
// backend/src/missions/dto/create-mission.dto.ts
import { IsString, IsEnum, IsOptional, IsDateString, MinLength } from 'class-validator';

export enum MissionPhase {
  SETUP = 'setup',
  FOUNDATION = 'foundation',
  ACTIVATION = 'activation',
  SCALE = 'scale',
}

export enum MissionScope {
  FOOD = 'food',
  ART = 'art',
  LIFESTYLE = 'lifestyle',
  SYSTEM = 'system',
  MIXED = 'mixed',
}

export class CreateMissionDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  description: string;

  @IsEnum(MissionPhase)
  phase: MissionPhase;

  @IsEnum(MissionScope)
  scope: MissionScope;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
```

### Progress Display — Dual-Track (Claude's Discretion: Split presentation)

Dual-track presentation: show two progress bars or progress segments, one for core and one for ad-hoc, rather than combining into one. This makes it obvious that "core progress is 80%, with 2 ad-hoc tasks also complete."

```tsx
// frontend/components/ops/quests/QuestProgress.tsx
import { Progress } from '@/components/ui/progress';

interface QuestProgressProps {
  coreProgress: number;      // 0-100
  adhocProgress: number;     // 0-100
  baselineTaskCount: number;
  totalAdhocTasks: number;
}

export function QuestProgress({ coreProgress, adhocProgress, baselineTaskCount, totalAdhocTasks }: QuestProgressProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Core tasks</span>
          <span>{coreProgress}%</span>
        </div>
        <Progress value={coreProgress} className="h-1.5" />
      </div>
      {totalAdhocTasks > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Ad-hoc tasks</span>
            <span>{adhocProgress}%</span>
          </div>
          <Progress value={adhocProgress} className="h-1.5 [&>div]:bg-amber-500" />
        </div>
      )}
    </div>
  );
}
```

### Blocker Overview — Admin Query

```typescript
// backend/src/tasks/tasks.service.ts

async findBlockedTasks(requestingUser: ScopedUser): Promise<Task[]> {
  const perms = await getPermissionsForRole(requestingUser.roleCode, this.prisma);
  if (!perms.includes(Permission.VIEW_ALL)) {
    throw new ForbiddenException('Admin only');
  }
  return this.prisma.task.findMany({
    where: { blocked: true, status: 'blocked' },
    include: {
      owner: { select: { id: true, name: true } },
      quest: { select: { id: true, title: true } },
      mission: { select: { id: true, title: true } },
    },
    orderBy: { updated_at: 'asc' }, // Oldest blockers first — most urgent
  });
}
```

### Ad-hoc Task Injection — Global Shortcut

The global ad-hoc task shortcut lives in the Sidebar (or a floating action button). It opens a Sheet/dialog where admin selects which quest to attach the task to.

```tsx
// frontend/components/ops/tasks/AdHocTaskDialog.tsx — simplified structure
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function AdHocTaskDialog({ open, onOpenChange }: AdHocTaskDialogProps) {
  const { data: missions } = useQuery({
    queryKey: ['missions'],
    queryFn: () => apiClient.get<Mission[]>('/missions'),
    enabled: open,
  });
  // Select mission → quest → then task form with task_type pre-set to 'adhoc'
  // ...
}
```

The Sidebar must import and render `AdHocTaskDialog` with a trigger button visible to FOUNDER_ADMIN only. The trigger can be a `+` button or a keyboard shortcut icon.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit | 2023 (rbd maintenance ended) | @dnd-kit is the standard; rbd has React 18+ issues |
| params synchronous access in Next.js | params as Promise (use() / await) | Next.js 15+ | All page components must use `use(params)` in Client Components |
| Single progress_percent on quest | Dual-track core + adhoc progress | Phase 1 schema decision | Schema already has both fields; this phase wires them up |
| Manual drag-and-drop event handling | @dnd-kit with accessibility | Ongoing best practice | Keyboard navigation, touch support, screen readers |

**Deprecated/outdated:**
- `react-beautiful-dnd`: unmaintained, has React 18+ issues. Do not use.
- Synchronous `params` in Next.js pages: deprecated in Next.js 15, continues to work but generates warnings in 16.

---

## Open Questions

1. **Shoogle MCP kanban component availability**
   - What we know: Shoogle MCP server at https://mcp.shoogle.dev/mcp provides premium shadcn kanban components.
   - What's unclear: Whether the available kanban fits the 4-column layout (To Do, Doing, Done, Blocked) and works with @dnd-kit.
   - Recommendation: Executor agent MUST query Shoogle MCP first. If a suitable kanban exists, use it as base and customize. If not, build from scratch with @dnd-kit + shadcn Card.

2. **Quest page "quest context" read-only view**
   - What we know: Non-admin users see own tasks (editable) + other tasks in same quest (read-only, for context).
   - What's unclear: Whether this is one combined API response or two separate queries.
   - Recommendation: Single endpoint `GET /tasks?quest_id=X` that returns all tasks for the quest. Service layer annotates each task with `is_own: boolean` based on `owner_user_id === requestingUser.id`. Frontend shows edit controls only on `is_own = true` tasks.

3. **Dependency picker UX (Claude's discretion)**
   - What we know: Tasks have a `depends_on_task_id` FK. The UX for setting it is unspecified.
   - What's unclear: Whether a dropdown (all tasks in quest/mission) or a search-by-title approach is better.
   - Recommendation: Combobox (searchable dropdown) filtered to tasks in the same mission. Show task title + current status. This is clear and avoids overwhelming the user with hundreds of tasks.

4. **Admin notification on blocker report**
   - What we know: "Task owners can self-report blockers: 'Report blocker' → enter reason → admin gets notified." Actual notification delivery is in Phase 8.
   - What's unclear: How to "notify admin" in Phase 2 without the notification system.
   - Recommendation: Log the blocker (set `blocked = true`, `blocked_reason`). The admin blockers overview page serves as the notification mechanism for Phase 2 — admin checks it. Full notification (email/push) comes in Phase 8. Add a server-side log entry for now.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.x (auto-configured by NestJS CLI, already in backend/package.json) |
| Config file | `backend/jest` field in `backend/package.json` |
| Quick run command | `cd backend && npx jest --testPathPattern=missions\|quests\|tasks --passWithNoTests` |
| Full suite command | `cd backend && npx jest --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXEC-01 | POST /missions creates mission with correct phase/scope | unit | `cd backend && npx jest missions.service --passWithNoTests` | Wave 0 |
| EXEC-02 | POST /quests creates quest with relative week_number | unit | `cd backend && npx jest quests.service --passWithNoTests` | Wave 0 |
| EXEC-03 | GET /tasks returns only own tasks for scoped user | unit | `cd backend && npx jest tasks.service --passWithNoTests` | Wave 0 |
| EXEC-03 | GET /tasks?quest_id=X returns quest context for scoped user | unit | `cd backend && npx jest tasks.service --passWithNoTests` | Wave 0 |
| EXEC-04 | Task with task_type=adhoc stores xp correctly | unit | `cd backend && npx jest tasks.service --passWithNoTests` | Wave 0 |
| EXEC-05 | Injecting ad-hoc task does NOT change baseline_task_count | unit | `cd backend && npx jest quests.service --passWithNoTests` | Wave 0 |
| EXEC-05 | core_progress_percent unchanged after ad-hoc injection | unit | `cd backend && npx jest quests.service --passWithNoTests` | Wave 0 |
| EXEC-06 | Task creation with depends_on_task_id stores FK correctly | unit | `cd backend && npx jest tasks.service --passWithNoTests` | Wave 0 |
| EXEC-07 | POST /tasks/:id/block sets blocked=true + blocked_reason | unit | `cd backend && npx jest tasks.service --passWithNoTests` | Wave 0 |
| EXEC-07 | Non-owner cannot block another user's task | unit | `cd backend && npx jest tasks.service --passWithNoTests` | Wave 0 |
| EXEC-08 | Task status change triggers quest progress recalculation | unit | `cd backend && npx jest tasks.service --passWithNoTests` | Wave 0 |
| EXEC-08 | Quest progress recalc wrapped in single transaction | unit | `cd backend && npx jest tasks.service --passWithNoTests` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && npx jest --testPathPattern=missions\|quests\|tasks --passWithNoTests`
- **Per wave merge:** `cd backend && npx jest --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/src/missions/missions.service.spec.ts` — covers EXEC-01
- [ ] `backend/src/quests/quests.service.spec.ts` — covers EXEC-02, EXEC-05 (baseline protection)
- [ ] `backend/src/tasks/tasks.service.spec.ts` — covers EXEC-03, EXEC-04, EXEC-06, EXEC-07, EXEC-08

*(Existing test infrastructure from Phase 1 is in place — Jest configured, spec files for auth/permissions exist. New spec files needed for missions, quests, tasks modules.)*

---

## Sources

### Primary (HIGH confidence)

- `backend/prisma/schema.prisma` (first-party) — Mission, Quest, Task models with all fields confirmed present; dual-track progress fields (`core_progress_percent`, `adhoc_progress_percent`, `baseline_task_count`) confirmed in schema
- `backend/src/auth/permissions.guard.ts` (first-party) — `@RequiresPermission` decorator pattern confirmed
- `backend/src/permissions/scope.filter.ts` (first-party) — `buildScopeFilter(user)` pattern confirmed
- `backend/src/users/users.controller.ts` (first-party) — `viewAs` admin filter pattern confirmed (maps to EXEC query filtering)
- `backend/src/types/permissions.ts` (first-party) — `CREATE_MISSION`, `CREATE_QUEST`, `CREATE_TASK`, `CREATE_ADHOC_TASK`, `UPDATE_OWN_TASK`, `UPDATE_ANY_TASK` permissions confirmed
- `backend/package.json` (first-party) — Prisma 6.19.2, NestJS 11.0.1, no dnd-kit (must install)
- `frontend/package.json` (first-party) — @dnd-kit NOT installed; date-fns NOT installed; react-hook-form 7.71.2 installed
- Next.js 16 local docs (`frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`) — params is a Promise; `use(params)` required in Client Components
- `contextdocs/dev_spec.md` §7.3-7.5, §10.5-10.6 (first-party) — mission/quest/task schemas, recalculate_quest_progress/recalculate_mission_progress pseudo-code

### Secondary (MEDIUM confidence)

- `@dnd-kit` npm registry version check 2026-03-19 — @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0, @dnd-kit/utilities 3.2.2 — current versions verified
- Shoogle MCP reference (memory/reference_shoogle_mcp.md) — confirmed configured at https://mcp.shoogle.dev/mcp for premium kanban components
- PITFALLS.md §Pitfall 6 (first-party) — ad-hoc injection breaking quest progress; dual-track solution confirmed
- STACK.md (first-party) — date-fns 3.x recommended; upgrading to 4.1.0 (current stable)

### Tertiary (LOW confidence, flagged for validation)

- @dnd-kit React 19 compatibility: @dnd-kit/core 6.x was tested against React 18. React 19.2.4 is in the project. Per npm peer deps, @dnd-kit/core 6.3.1 lists React >=16 as peer dep — should work, but validate at install time.

---

## Metadata

**Confidence breakdown:**
- Backend patterns (NestJS modules, guards, scope filter): HIGH — identical to Phase 1 established code
- Schema (Mission/Quest/Task fields): HIGH — confirmed directly in schema.prisma
- Progress calculation logic: HIGH — dev_spec pseudo-code is authoritative
- Frontend routing (Next.js 16 dynamic params): HIGH — confirmed in local Next.js 16 docs
- @dnd-kit for kanban: HIGH — standard for React drag-and-drop as of 2024-2026
- React 19 + @dnd-kit peer dep compatibility: LOW — verify at install

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable stack; NestJS and Next.js patterns are unlikely to change in 30 days)
