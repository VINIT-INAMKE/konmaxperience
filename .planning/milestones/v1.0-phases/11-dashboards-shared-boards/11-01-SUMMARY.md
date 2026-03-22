---
phase: 11-dashboards-shared-boards
plan: 01
subsystem: api
tags: [nestjs, analytics, prisma, typescript, bi-endpoints, evidence-feed]

# Dependency graph
requires:
  - phase: 10-pos-orders
    provides: Order, OrderItem, Payment models and OrdersModule
provides:
  - AnalyticsModule with 7 GET endpoints under /analytics/*
  - Evidence feed endpoint at GET /evidence/feed (no permission gate)
  - Procurement summary enhanced with po_status_breakdown
  - Frontend type definitions for all analytics response shapes (9 interfaces)
affects: [11-02, 11-03, 11-04, 11-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [weighted-average-food-cost-from-recipe, IST-date-grouping-via-toLocaleDateString, cursor-pagination-for-wins-feed]

key-files:
  created:
    - backend/src/analytics/analytics.module.ts
    - backend/src/analytics/analytics.controller.ts
    - backend/src/analytics/analytics.service.ts
    - backend/src/analytics/analytics.service.spec.ts
    - backend/src/analytics/dto/analytics-query.dto.ts
    - frontend/lib/types/analytics.ts
  modified:
    - backend/src/evidence/evidence.controller.ts
    - backend/src/evidence/evidence.service.ts
    - backend/src/procurement/procurement.service.ts
    - backend/src/app.module.ts

key-decisions:
  - "Food cost % computed dynamically from recipe.computed_cost / base_price (no food_cost_percent column on MenuItem)"
  - "Wins endpoint queries role.name via relation join (User has no roleName field)"
  - "Evidence feed uses uploader relation (not uploader_user) matching existing Prisma schema relation name"

patterns-established:
  - "Analytics date range: parseDateRange() helper with IST offset (+05:30) for consistent date boundary handling"
  - "Merged feed pattern: parallel query + in-memory sort + slice for cursor-based pagination across entities"

requirements-completed: [DASH-01, DASH-04, DASH-05, DASH-06]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 11 Plan 01: Backend Analytics & BI Endpoints Summary

**AnalyticsModule with 7 aggregation endpoints (summary, revenue, top-items, channels, recipe-costs, wins), evidence feed without permission gate, procurement PO breakdown, and 9 frontend type interfaces**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T18:41:46Z
- **Completed:** 2026-03-21T18:46:29Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- AnalyticsModule registered in AppModule with 7 endpoints covering all BI data needs for dashboards
- BI endpoints (summary, revenue, top-items, channels, recipe-costs) gated by MANAGE_KPIS permission; wins endpoint open to all authenticated users
- Evidence feed at GET /evidence/feed accessible without APPROVE_EVIDENCE permission gate
- Procurement summary enhanced with po_status_breakdown (draft, ordered, received counts)
- 9 unit tests covering all analytics aggregation methods with full pass
- Frontend analytics.ts exports 9 interfaces consumed by Plans 02-05

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend analytics module + evidence feed + procurement enhancement** - `5ce5446` (feat)
2. **Task 2: Analytics service unit tests + frontend types** - `6630df4` (test)

## Files Created/Modified
- `backend/src/analytics/analytics.module.ts` - NestJS module registering controller and service
- `backend/src/analytics/analytics.controller.ts` - 7 GET endpoints with MANAGE_KPIS permission on BI routes
- `backend/src/analytics/analytics.service.ts` - All aggregation queries (summary, revenue, top-items, channels, recipe-costs, wins)
- `backend/src/analytics/analytics.service.spec.ts` - 9 unit tests covering all service methods
- `backend/src/analytics/dto/analytics-query.dto.ts` - AnalyticsQueryDto (from/to dates) and WinsQueryDto (cursor/limit)
- `backend/src/evidence/evidence.controller.ts` - Added getFeed() endpoint before APPROVE_EVIDENCE route
- `backend/src/evidence/evidence.service.ts` - Added getFeed() method with status filter and cursor pagination
- `backend/src/procurement/procurement.service.ts` - Added po_status_breakdown to getSummary() return
- `backend/src/app.module.ts` - Registered AnalyticsModule in imports
- `frontend/lib/types/analytics.ts` - 9 interfaces: AnalyticsSummary, RevenuePoint, TopItem, ChannelRevenue, RecipeCostRow, WinsEntry, EvidenceFeedEntry, ProcurementSummary, KitchenMetrics

## Decisions Made
- Food cost % computed dynamically from recipe.computed_cost / base_price rather than a stored food_cost_percent field (schema has no such column on MenuItem)
- Wins endpoint accesses role name via User -> Role relation (owner.role.name), not a denormalized roleName field
- Evidence feed uses existing `uploader` relation name from Prisma schema (not `uploader_user`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed non-existent food_cost_percent field reference**
- **Found during:** Task 1 (Analytics service implementation)
- **Issue:** Plan referenced `menu_item.food_cost_percent` but MenuItem has no such column in the Prisma schema
- **Fix:** Computed food cost % dynamically as `(recipe.computed_cost / base_price) * 100` via relation join
- **Files modified:** backend/src/analytics/analytics.service.ts
- **Verification:** TypeScript compiles cleanly, unit tests pass with correct weighted average calculation
- **Committed in:** 5ce5446 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Auto-fix necessary for correctness — schema has no food_cost_percent field. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All backend endpoints ready for frontend dashboard plans (02-05) to consume
- Frontend type definitions exported for immediate use in API fetchers and components
- No blockers for downstream plans

---
*Phase: 11-dashboards-shared-boards*
*Completed: 2026-03-22*
