---
phase: 12-notifications
plan: 02
subsystem: notifications
tags: [nestjs, bullmq, event-emitter, cron, prisma, notifications]

# Dependency graph
requires:
  - phase: 12-01
    provides: "NotificationsService, NotificationsWorker, BullMQ queue, Notification model, event type interfaces"
provides:
  - "NotificationsCron: hourly task-due and approval-pending scanners"
  - "NotificationsListener: 5 @OnEvent handlers bridging EventEmitter2 to BullMQ queue"
  - "NotificationsCleanupCron: weekly 30-day notification cleanup"
  - "Event emissions in OrdersService (order.placed, delivery.updated), KdsService (order.ready), InventoryService (stock.low), TasksService (task.blocked)"
affects: [12-notifications, 10-pos-orders, 09-kitchen-prep, 08-inventory-procurement, 02-tasks]

# Tech tracking
tech-stack:
  added: []
  patterns: ["post-transaction event emission with try/catch isolation", "cron scanner -> BullMQ queue pattern", "EventEmitter2 -> BullMQ bridge via listener"]

key-files:
  created:
    - backend/src/notifications/notifications.cron.ts
    - backend/src/notifications/notifications.listener.ts
    - backend/src/notifications/notifications.cleanup.cron.ts
    - backend/src/notifications/__tests__/notifications.cron.spec.ts
    - backend/src/notifications/__tests__/notifications.listener.spec.ts
  modified:
    - backend/src/notifications/notifications.module.ts
    - backend/src/notifications/events/notification-events.ts
    - backend/src/orders/orders.service.ts
    - backend/src/kitchen/kds/kds.service.ts
    - backend/src/inventory/inventory.service.ts
    - backend/src/tasks/tasks.service.ts

key-decisions:
  - "Event type definitions changed from interfaces to classes for isolatedModules + emitDecoratorMetadata compatibility"
  - "All event emissions use try/catch {} empty-catch pattern for D-03 failure isolation"
  - "KdsService captures allReady flag + orderData inside transaction, emits outside (Pitfall 1)"

patterns-established:
  - "Post-transaction emit: capture result from $transaction, emit event after return with try/catch isolation"
  - "Cron scanner pattern: findMany with time-based where clause, enqueue BullMQ jobs per result"
  - "EventEmitter2-to-BullMQ bridge: @OnEvent handler wraps queue.add in try/catch"

requirements-completed: [NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, NOTF-06, NOTF-07]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 12 Plan 02: Notification Triggers Summary

**Hourly cron scanners for task-due/approval-pending, 5 EventEmitter2 listeners bridging to BullMQ, weekly cleanup cron, and event emissions in OrdersService, KdsService, InventoryService, TasksService -- all with post-transaction emit and failure isolation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T20:43:49Z
- **Completed:** 2026-03-21T20:51:37Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- NotificationsCron scans tasks due within 48h and approvals pending >24h every hour, enqueuing BullMQ jobs
- NotificationsListener subscribes to 5 EventEmitter2 events (order.placed, order.ready, delivery.updated, stock.low, task.blocked) and bridges them to BullMQ notification queue
- NotificationsCleanupCron deletes 30-day-old notifications every Sunday at 3am
- Four core services (Orders, KDS, Inventory, Tasks) now emit events AFTER transaction commits with try/catch isolation
- 27 unit tests passing across 4 notification test suites

## Task Commits

Each task was committed atomically:

1. **Task 1: NotificationsCron + NotificationsListener + NotificationsCleanupCron + module update** - `7afc69e` (feat)
2. **Task 2: Event emissions in OrdersService, KdsService, InventoryService, TasksService + unit tests** - `6e242d1` (feat)

## Files Created/Modified
- `backend/src/notifications/notifications.cron.ts` - Hourly cron scanning tasks due 48h and approvals pending 24h
- `backend/src/notifications/notifications.listener.ts` - 5 @OnEvent handlers bridging EventEmitter2 to BullMQ
- `backend/src/notifications/notifications.cleanup.cron.ts` - Weekly Sunday 3am cleanup of 30-day-old notifications
- `backend/src/notifications/notifications.module.ts` - Registered 3 new providers (cron, listener, cleanup)
- `backend/src/notifications/events/notification-events.ts` - Changed interfaces to classes for decorator compatibility
- `backend/src/orders/orders.service.ts` - Emits order.placed after createOrder, delivery.updated after updateDelivery
- `backend/src/kitchen/kds/kds.service.ts` - Emits order.ready when all items become ready (after transaction)
- `backend/src/inventory/inventory.service.ts` - Emits stock.low when adjustment drops below min_stock_level
- `backend/src/tasks/tasks.service.ts` - Emits task.blocked when task transitions to blocked status
- `backend/src/notifications/__tests__/notifications.cron.spec.ts` - Unit tests for scanTasksDue, scanApprovalsPending, failure isolation
- `backend/src/notifications/__tests__/notifications.listener.spec.ts` - Unit tests for 5 handlers + failure isolation

## Decisions Made
- Event type definitions changed from interfaces to classes: TypeScript `isolatedModules` + `emitDecoratorMetadata` requires decorated method parameters to have runtime types. Classes provide runtime presence, interfaces do not.
- All event emissions use empty try/catch: `try { this.eventEmitter.emit(...) } catch {}` ensures EventEmitter failures never affect producing services (D-03 compliance).
- KdsService captures `wasAllReady` flag and `orderData` inside the transaction closure, then emits `order.ready` outside the transaction -- complying with Pitfall 1 (no emit inside $transaction) while still accessing transaction-scoped data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed event type definitions from interfaces to classes**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** TS1272 error: types referenced in decorated signatures must be imported with runtime presence when `isolatedModules` and `emitDecoratorMetadata` are enabled. Interfaces are type-only.
- **Fix:** Changed all 5 event interfaces to classes with `!` definite assignment assertions
- **Files modified:** backend/src/notifications/events/notification-events.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 7afc69e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal -- classes are structurally identical to interfaces for this use case. No scope creep.

## Issues Encountered
None beyond the interface-to-class deviation documented above.

## Known Stubs
None -- all triggers are fully wired to the BullMQ queue and NotificationsWorker from Plan 01.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notification triggers are fully wired -- the system now produces notification events from real operations
- Ready for Plan 03 (frontend notification bell/panel) to consume these notifications via the REST API from Plan 01
- Ready for Plan 04 (SSE real-time push) to add live notification delivery

## Self-Check: PASSED

- All 5 created files confirmed present on disk
- Commit 7afc69e (Task 1) confirmed in git log
- Commit 6e242d1 (Task 2) confirmed in git log
- TypeScript compilation clean (0 errors)
- 27 notification tests pass (4 suites)

---
*Phase: 12-notifications*
*Completed: 2026-03-22*
