---
phase: 27-mission-flow-assessment-gap-closure
plan: 02
subsystem: api
tags: [nestjs, prisma, tasks, purchase-orders, includes, relations]

# Dependency graph
requires:
  - phase: 27-mission-flow-assessment-gap-closure (plan 01)
    provides: PurchaseOrder.linked_task_id schema migration + Prisma client types
provides:
  - Extended Task findAll with quest.mission and readiness_meter includes
  - Extended Task findOne with linked_assets, linked_purchase_orders, readiness_meter
  - PO create/update accepting optional linked_task_id
  - PO list/detail responses including linked_task title
affects: [27-03, 27-04, 27-05, frontend-task-kanban, frontend-task-list, frontend-task-detail, frontend-po-form]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nested Prisma include for quest.mission chain in task queries"
    - "Optional FK passthrough on PO create/update with clear-by-empty-string pattern"

key-files:
  created: []
  modified:
    - backend/src/tasks/tasks.service.ts
    - backend/src/purchase-orders/purchase-orders.service.ts
    - backend/src/purchase-orders/purchase-orders.controller.ts
    - backend/src/purchase-orders/dto/create-purchase-order.dto.ts

key-decisions:
  - "Kept direct mission include alongside quest.mission on findOne for adhoc tasks with no quest"
  - "PO update uses empty-string-to-null coalescion for linked_task_id clearing"

patterns-established:
  - "Nested relation chain: quest -> mission in task includes for breadcrumb/context display"
  - "Optional FK field passthrough pattern: spread with truthy guard on create, undefined check on update"

requirements-completed: [PO-02, LR-01, KB-01, LV-01, BC-01, VT-01]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 27 Plan 02: Backend Task & PO Service Extensions Summary

**Task API returns quest.mission chain + readiness_meter for kanban/list/breadcrumb context; PO API accepts linked_task_id with task title in responses**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T12:02:24Z
- **Completed:** 2026-03-26T12:07:24Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Task findAll now includes quest.mission nested chain and readiness_meter name for kanban badges and list view columns
- Task findOne includes linked_assets, linked_purchase_orders, readiness_meter for detail page resources section and validation toast
- PO create/update accepts optional linked_task_id, PO responses include linked_task title for display

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Task findAll/findOne includes + linked resources** - `545b6ba` (feat)
2. **Task 2: PO create/update accepts optional linked_task_id** - `7df2cfc` (feat)

## Files Created/Modified
- `backend/src/tasks/tasks.service.ts` - Extended findAll include (quest.mission, readiness_meter) and findOne include (quest.mission, readiness_meter, linked_assets, linked_purchase_orders)
- `backend/src/purchase-orders/purchase-orders.service.ts` - PO_INCLUDE adds linked_task, findAll adds linked_task, create passes linked_task_id, update accepts/passes linked_task_id
- `backend/src/purchase-orders/purchase-orders.controller.ts` - UpdatePurchaseOrderDto adds optional linked_task_id field
- `backend/src/purchase-orders/dto/create-purchase-order.dto.ts` - CreatePurchaseOrderDto adds optional linked_task_id with @IsString validation

## Decisions Made
- Kept direct `mission` include alongside `quest.mission` on findOne because adhoc tasks may have no quest but always have a mission (both paths needed for breadcrumb chain)
- PO update uses `data.linked_task_id || null` pattern so sending an empty string clears the link (set to null), while sending a UUID sets it
- Regenerated Prisma client after schema was updated by parallel plan 27-01 (the linked_task_id field and relation already existed in schema)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated Prisma client for linked_purchase_orders type**
- **Found during:** Task 1 (extending findOne includes)
- **Issue:** TypeScript error: `linked_purchase_orders does not exist in type TaskInclude` because Prisma client was stale after schema update by parallel plan 27-01
- **Fix:** Ran `npx prisma generate` to regenerate Prisma client types
- **Files modified:** node_modules/@prisma/client (generated)
- **Verification:** `npx tsc --noEmit` passes for tasks.service.ts
- **Committed in:** 545b6ba (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Prisma client regeneration was necessary since parallel plan 27-01 updated the schema. No scope creep.

## Issues Encountered
- `update-purchase-order.dto.ts` file does not exist as a separate file -- the UpdatePurchaseOrderDto is defined inline in the controller. Added linked_task_id there instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend data shape is ready for all frontend plans (27-03 through 27-05)
- Task API returns everything needed for kanban badge meter name (D-18), list view columns (D-19), breadcrumb chain (D-20), validation toast (D-21), and linked resources (D-16)
- PO API is ready for "Link to task" dropdown on PO form (D-17)

## Self-Check: PASSED

All 4 modified files verified present. Both task commits (545b6ba, 7df2cfc) verified in git log.

---
*Phase: 27-mission-flow-assessment-gap-closure*
*Completed: 2026-03-26*
