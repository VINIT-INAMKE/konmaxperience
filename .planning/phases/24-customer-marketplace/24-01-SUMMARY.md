---
phase: 24-customer-marketplace
plan: 01
subsystem: api, database
tags: [prisma, redis, nestjs, pusher, customer-orders, cart, address]

# Dependency graph
requires:
  - phase: 23-razorpay-customer-auth
    provides: CustomerAuthModule, RedisService, CustomerGuard, customer JWT
provides:
  - CustomerAddress Prisma model with migration
  - CustomerOrdersModule with cart Redis CRUD and address CRUD endpoints
  - Customer Pusher auth endpoint for private channel authorization
  - Customer Pusher client and hook for frontend order tracking
  - apiClient 401 bypass for /customer/ prefixed paths
  - Nullable Order.created_by and Order.zone_id for customer marketplace orders
affects: [24-02-checkout, 24-03-tracking, 24-04-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cart Redis storage with cart:{customerId} key and 7-day TTL"
    - "Cart sync merge logic: keep cart with more items when both have items"
    - "Separate Pusher client instance for customer auth vs staff auth"

key-files:
  created:
    - backend/prisma/migrations/20260326_customer_address/migration.sql
    - backend/src/customer-orders/customer-orders.module.ts
    - backend/src/customer-orders/customer-orders.service.ts
    - backend/src/customer-orders/customer-orders.controller.ts
    - backend/src/customer-orders/dto/create-address.dto.ts
    - backend/src/customer-orders/dto/update-address.dto.ts
    - backend/src/customer-orders/dto/sync-cart.dto.ts
    - frontend/lib/customer-pusher-client.ts
    - frontend/lib/hooks/use-customer-pusher-channel.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/app.module.ts
    - backend/src/customer-auth/customer-auth.controller.ts
    - backend/src/customer-auth/customer-auth.module.ts
    - backend/src/kitchen/kds/kds.service.ts
    - backend/src/kitchen/metrics/kitchen-metrics.service.ts
    - frontend/lib/api-client.ts

key-decisions:
  - "UpdateAddressDto written manually with optional fields (no @nestjs/mapped-types, not installed)"
  - "KDS filters zone_id: { not: null } to exclude customer marketplace orders without zones"
  - "Customer Pusher channel name validated as private-customer-{customerId} from JWT"

patterns-established:
  - "CustomerGuard + @Public() controller pattern for customer endpoints bypassing global JwtAuthGuard"
  - "Cart Redis CRUD via RedisService.getClient() with JSON serialization and 7-day TTL"
  - "Address ownership check pattern: findFirst with customer_id + addressId before mutation"

requirements-completed: [MKT-01, MKT-04, MKT-06]

# Metrics
duration: 11min
completed: 2026-03-26
---

# Phase 24 Plan 01: Backend Foundation Summary

**CustomerAddress Prisma model + CustomerOrdersModule with Redis cart CRUD, address CRUD, Pusher auth, and apiClient 401 bypass for customer marketplace**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-26T09:05:54Z
- **Completed:** 2026-03-26T09:17:16Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- CustomerAddress Prisma model with migration, customer_id FK, label/address/pincode/lat/lng/is_default fields
- Cart Redis CRUD (get/set/delete/sync) with 7-day TTL via cart:{customerId} keys and merge logic on sync
- Address CRUD with ownership verification, default management (auto-set first, promote on delete)
- Customer Pusher auth endpoint validating channel name against JWT customerId
- apiClient 401 bypass extended to /customer/ prefix (no staff login redirect)
- Order.created_by and Order.zone_id made nullable for customer marketplace orders

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma migration + CustomerOrdersModule with cart/address CRUD** - `cd1240a` (feat)
2. **Task 2: Customer Pusher auth + apiClient 401 bypass + Pusher client/hook** - `48376f2` (feat)

## Files Created/Modified
- `backend/prisma/schema.prisma` - Added CustomerAddress model, made Order.created_by/zone_id nullable
- `backend/prisma/migrations/20260326_customer_address/migration.sql` - Migration for CustomerAddress + ALTER Order columns
- `backend/src/customer-orders/customer-orders.module.ts` - Module wiring with PrismaModule, CustomerAuthModule, ChatModule
- `backend/src/customer-orders/customer-orders.service.ts` - Cart Redis CRUD + address CRUD with ownership checks
- `backend/src/customer-orders/customer-orders.controller.ts` - Cart and address endpoints behind CustomerGuard
- `backend/src/customer-orders/dto/create-address.dto.ts` - Validated DTO with label, address, pincode, lat/lng
- `backend/src/customer-orders/dto/update-address.dto.ts` - Partial DTO with all optional fields
- `backend/src/customer-orders/dto/sync-cart.dto.ts` - Validated DTO with items array, channel, deliveryAddressId
- `backend/src/app.module.ts` - Registered CustomerOrdersModule
- `backend/src/customer-auth/customer-auth.controller.ts` - Added pusher-auth endpoint with channel validation
- `backend/src/customer-auth/customer-auth.module.ts` - Imported ChatModule for PusherService
- `backend/src/kitchen/kds/kds.service.ts` - Fixed TS errors from nullable zone_id (filter + non-null assertions)
- `backend/src/kitchen/metrics/kitchen-metrics.service.ts` - Fixed groupBy zone_id null handling
- `frontend/lib/api-client.ts` - Extended 401 bypass to /customer/ paths
- `frontend/lib/customer-pusher-client.ts` - Customer Pusher instance with customer-auth endpoint
- `frontend/lib/hooks/use-customer-pusher-channel.ts` - Hook for customer private channel subscription

## Decisions Made
- UpdateAddressDto written manually with optional fields since @nestjs/mapped-types is not installed in the project
- KDS service filters `zone_id: { not: null }` to exclude customer marketplace orders from kitchen display (customer orders have no zone)
- Customer Pusher channel name pattern: `private-customer-{customerId}` validated against JWT

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @nestjs/mapped-types not installed**
- **Found during:** Task 1 (DTO creation)
- **Issue:** Plan specified `PartialType(CreateAddressDto)` from @nestjs/mapped-types but package not in dependencies
- **Fix:** Wrote UpdateAddressDto manually with all fields optional instead of using PartialType
- **Files modified:** backend/src/customer-orders/dto/update-address.dto.ts
- **Verification:** TypeScript compiles with no errors
- **Committed in:** cd1240a (Task 1 commit)

**2. [Rule 1 - Bug] Nullable Order.zone_id broke KDS and kitchen-metrics TS compilation**
- **Found during:** Task 1 (after making Order.zone_id nullable)
- **Issue:** KDS and kitchen-metrics services assumed zone_id was always a string, causing TS errors
- **Fix:** Added `zone_id: { not: null }` filter in KDS query, non-null assertions where zone_id was guaranteed, filter(id): is string => id !== null) in kitchen-metrics
- **Files modified:** backend/src/kitchen/kds/kds.service.ts, backend/src/kitchen/metrics/kitchen-metrics.service.ts
- **Verification:** TypeScript compiles with no non-spec errors
- **Committed in:** cd1240a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CustomerOrdersModule ready for Plan 02 (checkout flow with Razorpay)
- Cart and address APIs available for Plan 04 (frontend marketplace pages)
- Customer Pusher auth ready for Plan 03 (order tracking via Pusher events)
- All endpoints behind CustomerGuard with @Throttle

## Self-Check: PASSED

All 10 created files verified present. Both commit hashes (cd1240a, 48376f2) verified in git log.

---
*Phase: 24-customer-marketplace*
*Completed: 2026-03-26*
