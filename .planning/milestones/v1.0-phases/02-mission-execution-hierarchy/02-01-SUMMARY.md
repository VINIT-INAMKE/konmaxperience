---
phase: 02-mission-execution-hierarchy
plan: 01
subsystem: api
tags: [nestjs, prisma, typescript, crud, missions, quests, class-validator]

# Dependency graph
requires:
  - phase: 01-foundation-authentication
    provides: NestJS project structure, PrismaModule, AuthModule, PermissionsModule, RBAC guards
provides:
  - MissionsModule with GET/POST/PATCH /missions endpoints
  - QuestsModule with GET/POST/PATCH /quests endpoints with mission_id filter
  - Quest activation logic that locks baseline_task_count from core task count
  - Frontend TypeScript types for Mission, Quest, and Task interfaces
  - Shared enum labels (phase, scope, status, domain, priority) and XP weight constants
affects: [02-02-tasks-module, 02-03-mission-board-ui, 02-04-quest-detail-ui, 03-validation-evidence]

# Tech tracking
tech-stack:
  added: []
  patterns: [NestJS Module/Controller/Service CRUD pattern for domain entities, class-validator DTO enums, quest activation with $transaction]

key-files:
  created:
    - backend/src/missions/missions.module.ts
    - backend/src/missions/missions.controller.ts
    - backend/src/missions/missions.service.ts
    - backend/src/missions/dto/create-mission.dto.ts
    - backend/src/missions/dto/update-mission.dto.ts
    - backend/src/quests/quests.module.ts
    - backend/src/quests/quests.controller.ts
    - backend/src/quests/quests.service.ts
    - backend/src/quests/dto/create-quest.dto.ts
    - backend/src/quests/dto/update-quest.dto.ts
    - frontend/lib/types/missions.ts
    - frontend/lib/types/quests.ts
    - frontend/lib/types/tasks.ts
  modified:
    - backend/src/app.module.ts
    - frontend/lib/types/index.ts

key-decisions:
  - "Missions viewable by all authenticated users (shared board) -- no scope filter applied"
  - "Quest baseline_task_count immutable after first activation (only set when transitioning to active AND currently 0)"
  - "Frontend types use snake_case field names matching Prisma schema (not camelCase)"

patterns-established:
  - "Domain module CRUD: Module -> Controller -> Service -> PrismaService pattern with DTO validation"
  - "Shared board endpoints: GET without @RequiresPermission, POST/PATCH with permission guard"
  - "Quest activation: $transaction to atomically count core tasks and set baseline"

requirements-completed: [EXEC-01, EXEC-02, EXEC-05]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 02 Plan 01: Missions & Quests API Summary

**NestJS Missions and Quests CRUD modules with quest activation locking baseline_task_count, plus frontend TypeScript types for missions/quests/tasks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T17:33:28Z
- **Completed:** 2026-03-19T17:38:48Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- MissionsModule with full CRUD (GET all/by-id, POST create, PATCH update) including quest summaries in responses
- QuestsModule with mission_id filtering, quest activation logic that atomically locks baseline_task_count from core task count using $transaction
- Frontend TypeScript types for Mission, Quest, and Task with enum labels, XP weight constants, kanban column definitions, and all DTO interfaces
- Both modules registered in AppModule, all 18 existing tests still passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MissionsModule and QuestsModule with full CRUD endpoints** - `8adfb04` (feat)
2. **Task 2: Create shared frontend TypeScript types** - `47d5b07` (feat)

## Files Created/Modified
- `backend/src/missions/missions.module.ts` - NestJS MissionsModule definition
- `backend/src/missions/missions.controller.ts` - GET/POST/PATCH /missions endpoints
- `backend/src/missions/missions.service.ts` - Mission CRUD business logic with Prisma
- `backend/src/missions/dto/create-mission.dto.ts` - CreateMissionDto with phase/scope enums
- `backend/src/missions/dto/update-mission.dto.ts` - UpdateMissionDto with status enum
- `backend/src/quests/quests.module.ts` - NestJS QuestsModule definition
- `backend/src/quests/quests.controller.ts` - GET/POST/PATCH /quests endpoints with mission_id filter
- `backend/src/quests/quests.service.ts` - Quest CRUD + activate with baseline_task_count locking
- `backend/src/quests/dto/create-quest.dto.ts` - CreateQuestDto with week_number and owner_user_id
- `backend/src/quests/dto/update-quest.dto.ts` - UpdateQuestDto with status enum
- `backend/src/app.module.ts` - Added MissionsModule and QuestsModule imports
- `frontend/lib/types/missions.ts` - Mission interface, enums, labels, DTOs
- `frontend/lib/types/quests.ts` - Quest interface with dual-track progress fields, DTOs
- `frontend/lib/types/tasks.ts` - Task interface with XP weights, kanban columns, domain labels, DTOs
- `frontend/lib/types/index.ts` - Added barrel exports for new type files

## Decisions Made
- Missions are viewable by all authenticated users (shared board) -- no scope filter applied to GET /missions
- Quest baseline_task_count is immutable after first activation: only set when transitioning to 'active' AND currently 0
- Frontend types use snake_case field names matching Prisma schema directly (consistent with existing users.ts pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MissionsModule and QuestsModule ready for TasksModule (Plan 02) to reference
- Frontend types ready for mission board UI (Plan 03) and quest detail UI (Plan 04)
- Quest activation baseline locking ready for dual-track progress calculation in Phase 3

## Self-Check: PASSED

- All 13 created files verified present on disk
- Commit `8adfb04` (Task 1) verified in git log
- Commit `47d5b07` (Task 2) verified in git log
- Backend TypeScript compilation: clean (0 errors)
- Frontend TypeScript compilation: clean (0 errors)
- Backend tests: 18/18 passing

---
*Phase: 02-mission-execution-hierarchy*
*Completed: 2026-03-19*
