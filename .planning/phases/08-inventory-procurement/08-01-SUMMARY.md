---
phase: 08-inventory-procurement
plan: 01
subsystem: database
tags: [prisma, postgresql, typescript, permissions, inventory, procurement]

# Dependency graph
requires:
  - phase: 07-recipe-ingredient-management
    provides: Ingredient, Vendor, Zone, UnitConversion models that new FK relations point to
provides:
  - IngredientStock Prisma model with compound unique (ingredient_id, zone_id)
  - StockMovement Prisma model with movement_type, signed quantity, reference tracking
  - PurchaseOrder Prisma model with vendor/zone/user relations and zone_id for stock upsert
  - PurchaseOrderLine Prisma model with cascade delete from PurchaseOrder
  - MANAGE_INVENTORY and MANAGE_PROCUREMENT permissions in backend and frontend enums
  - Frontend TypeScript interfaces for IngredientStock, StockMovement, PurchaseOrder, PurchaseOrderLine
  - Phase 8 migration SQL (20260321115147_phase_8_inventory)
affects: [08-02, 08-03, 08-04, 08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Signed quantity in StockMovement (positive = in, negative = out) with original_quantity/unit for display
    - zone_id on PurchaseOrder for receiving-to-zone stock upsert pattern
    - No direct StockMovement -> IngredientStock FK (service layer joins via ingredient_id + zone_id)
    - PO_STATUS_BADGE_CLASSES and MOVEMENT_TYPE_BADGE_CLASSES pattern for badge styling

key-files:
  created:
    - backend/prisma/migrations/20260321115147_phase_8_inventory/migration.sql
    - frontend/lib/types/inventory.ts
    - frontend/lib/types/purchase-order.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/prisma/seed.ts
    - backend/src/types/permissions.ts
    - frontend/lib/types/permissions.ts
    - frontend/lib/types/index.ts

key-decisions:
  - "No composite FK from StockMovement to IngredientStock — service layer handles join via ingredient_id + zone_id lookup"
  - "zone_id added to PurchaseOrder so receiving flow knows where to upsert IngredientStock"
  - "PROCUREMENT_LEAD seeded with MANAGE_INVENTORY and MANAGE_PROCUREMENT (was missing from seed)"
  - "PERMISSION_DISPLAY_NAMES and PERMISSION_DESCRIPTIONS updated on both backend and frontend for all new permissions"

patterns-established:
  - "Badge class maps: PO_STATUS_BADGE_CLASSES / MOVEMENT_TYPE_BADGE_CLASSES for consistent status badges"
  - "Frontend types index.ts exports all new type files via re-export"

requirements-completed: [INV-01, INV-02, INV-03]

# Metrics
duration: 7min
completed: 2026-03-21
---

# Phase 8 Plan 01: Inventory & Procurement Foundation Summary

**4 new Prisma models (IngredientStock, StockMovement, PurchaseOrder, PurchaseOrderLine) with migration, MANAGE_INVENTORY and MANAGE_PROCUREMENT permissions across backend/frontend, and typed interfaces for inventory and procurement UI.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-21T11:47:00Z
- **Completed:** 2026-03-21T11:54:02Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Schema already had 4 new models (pre-staged from prior work) — verified structure, created phase 8 migration SQL, regenerated Prisma client
- Added MANAGE_INVENTORY and MANAGE_PROCUREMENT to backend permissions enum + display names + descriptions (both were missing from display maps)
- Updated seed: PROCUREMENT_LEAD now has MANAGE_INVENTORY and MANAGE_PROCUREMENT permissions
- Created frontend types inventory.ts and purchase-order.ts with full interfaces, status/movement type unions, and badge class maps
- Synced frontend permissions.ts: added MANAGE_DELEGATIONS, MANAGE_INVENTORY, MANAGE_PROCUREMENT to enum + display names + descriptions
- TypeScript check passes with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema migration + permissions + seed update** - `a2eb341` (feat)
2. **Task 2: Frontend TypeScript types for inventory and purchase orders** - `2ba2b0e` (feat)

**Plan metadata:** `00d1b0b` (docs: complete plan)

## Files Created/Modified
- `backend/prisma/schema.prisma` - IngredientStock, StockMovement, PurchaseOrder, PurchaseOrderLine models + reverse relations on Ingredient, Zone, Vendor, User
- `backend/prisma/migrations/20260321115147_phase_8_inventory/migration.sql` - CREATE TABLE and FK statements for all 4 models
- `backend/src/types/permissions.ts` - Added MANAGE_INVENTORY/MANAGE_PROCUREMENT to enum, PERMISSION_DISPLAY_NAMES, PERMISSION_DESCRIPTIONS
- `backend/prisma/seed.ts` - PROCUREMENT_LEAD now seeded with MANAGE_INVENTORY + MANAGE_PROCUREMENT
- `frontend/lib/types/inventory.ts` - IngredientStock, StockMovement interfaces; StockMovementType union; MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_BADGE_CLASSES maps
- `frontend/lib/types/purchase-order.ts` - PurchaseOrder, PurchaseOrderLine interfaces; PurchaseOrderStatus union; PO_STATUS_LABELS, PO_STATUS_BADGE_CLASSES maps
- `frontend/lib/types/permissions.ts` - Added MANAGE_DELEGATIONS, MANAGE_INVENTORY, MANAGE_PROCUREMENT with display names and descriptions
- `frontend/lib/types/index.ts` - Added re-exports for inventory.ts and purchase-order.ts

## Decisions Made
- No direct FK between StockMovement and IngredientStock — service layer handles join via ingredient_id + zone_id to avoid over-coupling
- zone_id added to PurchaseOrder so receiving flow can upsert IngredientStock in the correct zone
- PROCUREMENT_LEAD receives both MANAGE_INVENTORY and MANAGE_PROCUREMENT (as TECH_LEAD already gets all via Object.values(Permission))
- MANAGE_DELEGATIONS was also missing from frontend permissions enum — fixed as part of same sync task

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] PERMISSION_DISPLAY_NAMES and PERMISSION_DESCRIPTIONS missing entries for MANAGE_INVENTORY and MANAGE_PROCUREMENT on backend**
- **Found during:** Task 1 (permissions.ts review)
- **Issue:** Enum had the values but the Record<Permission, string> maps did not include them — TypeScript would error on Record completeness
- **Fix:** Added display name and description entries for both new permissions
- **Files modified:** backend/src/types/permissions.ts
- **Verification:** File reads correctly with all enum members covered
- **Committed in:** a2eb341 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Frontend permissions.ts missing MANAGE_DELEGATIONS, MANAGE_INVENTORY, MANAGE_PROCUREMENT**
- **Found during:** Task 2 (permissions sync check)
- **Issue:** Frontend enum was out of sync with backend — MANAGE_DELEGATIONS was already in backend but not frontend; both new permissions were absent
- **Fix:** Added all three to enum, PERMISSION_DISPLAY_NAMES, and PERMISSION_DESCRIPTIONS
- **Files modified:** frontend/lib/types/permissions.ts
- **Verification:** TypeScript check passes with no errors (npx tsc --noEmit)
- **Committed in:** 2ba2b0e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes required for TypeScript correctness. No scope creep.

## Issues Encountered
- Prisma `validate` command blocked by shell permissions — used `prisma generate` instead (generates only when schema is structurally valid, confirmed success)
- Migration SQL created manually from schema diff rather than `prisma migrate dev` (DATABASE_URL not configured per Phase 1 deferred decision)

## User Setup Required
None - no external service configuration required beyond the existing PostgreSQL setup deferred since Phase 1.

## Next Phase Readiness
- Schema foundation complete: all 4 models with correct relations and migration file ready for Phase 8 NestJS module work
- Permissions seeded: PROCUREMENT_LEAD has correct permissions for inventory/procurement API access
- Frontend types importable: Plans 08-02 through 08-05 can reference IngredientStock, StockMovement, PurchaseOrder, PurchaseOrderLine types directly

## Self-Check: PASSED

- FOUND: backend/prisma/migrations/20260321115147_phase_8_inventory/migration.sql
- FOUND: frontend/lib/types/inventory.ts (contains `interface IngredientStock`, `interface StockMovement`, `MOVEMENT_TYPE_BADGE_CLASSES`)
- FOUND: frontend/lib/types/purchase-order.ts (contains `interface PurchaseOrder`, `interface PurchaseOrderLine`, `PO_STATUS_BADGE_CLASSES`)
- FOUND: backend/prisma/schema.prisma (contains `model IngredientStock`, `model StockMovement`, `model PurchaseOrder`, `model PurchaseOrderLine`)
- FOUND: backend/src/types/permissions.ts (contains `MANAGE_INVENTORY`, `MANAGE_PROCUREMENT` in enum + display names + descriptions)
- FOUND: backend/prisma/seed.ts (contains `Permission.MANAGE_INVENTORY` in PROCUREMENT_LEAD)
- FOUND: frontend/lib/types/permissions.ts (contains `MANAGE_INVENTORY`, `MANAGE_PROCUREMENT`)
- Commits verified: a2eb341 (task 1), 2ba2b0e (task 2), 00d1b0b (metadata)
- TypeScript: `npx tsc --noEmit` passed with zero errors
- Prisma client: `prisma generate` succeeded (schema structurally valid)

---
*Phase: 08-inventory-procurement*
*Completed: 2026-03-21*
