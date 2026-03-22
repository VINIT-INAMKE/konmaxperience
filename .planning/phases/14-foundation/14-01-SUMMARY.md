---
phase: 14-foundation
plan: 01
subsystem: database, api
tags: [prisma, nestjs, permission, migration, presign, r2]

# Dependency graph
requires:
  - phase: 10-pos-orders
    provides: "Complete v1.0 Prisma schema with 40 models and StorageController with presign endpoints"
provides:
  - "GuideSection and GuidePage Prisma models with migration"
  - "MANAGE_GUIDE permission in Permission enum with display metadata"
  - "GuidesModule scaffold (controller + service stubs) registered in AppModule"
  - "POST /storage/presign-guide endpoint for guide image uploads"
affects: [14-foundation-plan-02, 15-guide-reader, 16-guide-editor]

# Tech tracking
tech-stack:
  added: []
  patterns: [additive-only migration, manual prisma migrate resolve for drift recovery]

key-files:
  created:
    - backend/prisma/migrations/20260322141410_add_guide_section_and_page/migration.sql
    - backend/src/guides/guides.module.ts
    - backend/src/guides/guides.controller.ts
    - backend/src/guides/guides.service.ts
    - backend/src/storage/dto/presign-guide.dto.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/types/permissions.ts
    - backend/src/app.module.ts
    - backend/src/storage/storage.controller.ts

key-decisions:
  - "Used prisma migrate resolve + db execute for migration due to drift between migration history and live database state"
  - "PresignGuideDto restricts contentType to image/jpeg, image/png, image/webp only (guides embed images, not arbitrary files)"
  - "Guide image key prefix is 'guide/' to separate from assets/ and evidence/ uploads"

patterns-established:
  - "Migration drift recovery: mark existing migrations as applied via prisma migrate resolve, then use prisma migrate diff + db execute + resolve for new migrations"

requirements-completed: [GUIDE-01, GUIDE-02, GUIDE-05]

# Metrics
duration: 11min
completed: 2026-03-22
---

# Phase 14 Plan 01: Guide Foundation Summary

**GuideSection/GuidePage Prisma models with additive-only migration, MANAGE_GUIDE permission, GuidesModule scaffold, and presign-guide storage endpoint**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-22T14:10:32Z
- **Completed:** 2026-03-22T14:22:03Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- GuideSection and GuidePage models added to Prisma schema with all required fields (role_codes, content @db.Text, cascade delete, compound unique slug)
- MANAGE_GUIDE permission added as 23rd permission with display name and description
- GuidesModule scaffolded and registered in AppModule, ready for Plan 02 to fill in CRUD methods
- POST /storage/presign-guide endpoint live with MANAGE_GUIDE guard and image-only content type validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GuideSection and GuidePage Prisma models + run migration** - `c649eda` (feat)
2. **Task 2: Add MANAGE_GUIDE permission + scaffold GuidesModule + register in AppModule** - `720e412` (feat)
3. **Task 3: Add presign-guide endpoint to StorageController** - `2422420` (feat)

## Files Created/Modified
- `backend/prisma/schema.prisma` - Added GuideSection and GuidePage models at end of file
- `backend/prisma/migrations/20260322141410_add_guide_section_and_page/migration.sql` - Additive-only migration with CREATE TABLE + CREATE INDEX
- `backend/src/types/permissions.ts` - Added MANAGE_GUIDE enum value, display name, and description
- `backend/src/guides/guides.module.ts` - Module declaration with controller, service, export
- `backend/src/guides/guides.controller.ts` - Controller stub with @Controller('guide')
- `backend/src/guides/guides.service.ts` - Service stub with PrismaService injection
- `backend/src/guides/dto/.gitkeep` - Placeholder for Plan 02 DTOs
- `backend/src/app.module.ts` - GuidesModule import and registration
- `backend/src/storage/storage.controller.ts` - presign-guide endpoint with MANAGE_GUIDE permission
- `backend/src/storage/dto/presign-guide.dto.ts` - DTO with image-only content type validation

## Decisions Made
- **Migration drift recovery:** The database had all v1.0 tables but migration history was out of sync. Used `prisma migrate resolve --applied` for all 7 existing migrations, then `prisma migrate diff` + `prisma db execute` + `prisma migrate resolve` for the new migration. This avoids destructive `prisma migrate reset`.
- **Image-only content types:** PresignGuideDto uses `@IsIn(['image/jpeg', 'image/png', 'image/webp'])` instead of generic `@IsString()` for contentType, restricting guide uploads to images only.
- **Guide key prefix:** Used `guide/` prefix (not `guides/`) to match the controller route naming convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma migration drift recovery**
- **Found during:** Task 1 (Prisma migration)
- **Issue:** `prisma migrate dev` failed because the database had all v1.0 tables but the migration history table didn't have them marked as applied. Prisma detected drift and wanted to reset the database.
- **Fix:** Marked all 7 existing migrations as applied via `prisma migrate resolve --applied`, then generated diff SQL via `prisma migrate diff --from-schema-datasource --to-schema-datamodel`, executed it with `prisma db execute`, and marked the new migration as applied.
- **Files modified:** No additional files (the migration SQL file was created as planned)
- **Verification:** `npx prisma migrate status` shows "Database schema is up to date"
- **Committed in:** c649eda (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Migration approach changed from `prisma migrate dev` to manual diff/execute/resolve. Same outcome (tables created, migration recorded), different mechanism. No scope creep.

## Known Stubs

- `backend/src/guides/guides.service.ts` - Empty service class (intentional; Plan 02 fills in CRUD methods)
- `backend/src/guides/guides.controller.ts` - Empty controller class (intentional; Plan 02 fills in REST endpoints)

These stubs are by design per the plan's objective ("module skeleton that Plan 02 builds upon").

## Issues Encountered
- Prisma client generation (`prisma generate`) failed repeatedly with EPERM (file lock on query_engine-windows.dll.node) likely due to parallel agent execution. Resolved by removing temp files and the locked DLL, then regenerating successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GuideSection and GuidePage tables exist in the database, ready for CRUD operations
- GuidesModule is registered and the service/controller stubs are ready for Plan 02 to add endpoints
- presign-guide endpoint is live for guide image uploads
- MANAGE_GUIDE permission auto-includes in FOUNDER_ADMIN and TECH_LEAD roles (they use Object.values(Permission))

## Self-Check: PASSED

All 7 created files verified on disk. All 3 task commits verified in git history.

---
*Phase: 14-foundation*
*Completed: 2026-03-22*
