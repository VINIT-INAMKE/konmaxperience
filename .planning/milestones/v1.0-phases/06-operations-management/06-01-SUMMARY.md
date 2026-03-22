---
phase: 06-operations-management
plan: 01
subsystem: api
tags: [nestjs, prisma, rbac, zones, brands, channels, assets, permissions]

# Dependency graph
requires:
  - phase: 05-governance-decision-management
    provides: DecisionsModule pattern (module/controller/service/dto) used as template for all 4 new modules
  - phase: 03-evidence-validation
    provides: StorageService.validatePresignRequest, generatePresignedPutUrl, getPublicUrl used in presign-asset endpoint
provides:
  - ZonesModule with owner-edit RBAC (MANAGE_OPS for create/delete, service-level ownership check for update)
  - BrandsModule with owner-edit RBAC and optional status query filter
  - ChannelsModule with admin-only writes via MANAGE_OPS (no delete — reference data)
  - AssetsModule with creator-edit RBAC and status transition guard (creator can only submit for review)
  - StorageController presign-asset endpoint without taskId requirement
  - MANAGE_OPS permission in both backend and frontend enums
  - Seed data: 8 D-01 zones, 2 brands, 7 channels (idempotent)
affects: [06-02, 06-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NestJS module pattern: module/controller/service/dto following DecisionsModule template"
    - "Owner-edit RBAC: isOwner check in service.update(), no permission decorator on PATCH route"
    - "Creator-edit RBAC: status transition guard — creator can only move to in_review, admin can set any status"
    - "Idempotent seed via deleteMany + recreate pattern for zone/brand/channel data"

key-files:
  created:
    - backend/src/zones/zones.module.ts
    - backend/src/zones/zones.controller.ts
    - backend/src/zones/zones.service.ts
    - backend/src/zones/dto/create-zone.dto.ts
    - backend/src/zones/dto/update-zone.dto.ts
    - backend/src/zones/zones.service.spec.ts
    - backend/src/brands/brands.module.ts
    - backend/src/brands/brands.controller.ts
    - backend/src/brands/brands.service.ts
    - backend/src/brands/dto/create-brand.dto.ts
    - backend/src/brands/dto/update-brand.dto.ts
    - backend/src/brands/brands.service.spec.ts
    - backend/src/channels/channels.module.ts
    - backend/src/channels/channels.controller.ts
    - backend/src/channels/channels.service.ts
    - backend/src/channels/dto/create-channel.dto.ts
    - backend/src/channels/dto/update-channel.dto.ts
    - backend/src/channels/channels.service.spec.ts
    - backend/src/assets/assets.module.ts
    - backend/src/assets/assets.controller.ts
    - backend/src/assets/assets.service.ts
    - backend/src/assets/dto/create-asset.dto.ts
    - backend/src/assets/dto/update-asset.dto.ts
    - backend/src/assets/assets.service.spec.ts
    - backend/src/storage/dto/presign-asset.dto.ts
  modified:
    - backend/src/types/permissions.ts
    - frontend/lib/types/permissions.ts
    - backend/src/storage/storage.controller.ts
    - backend/src/app.module.ts
    - backend/prisma/seed.ts

key-decisions:
  - "MANAGE_OPS gates create/delete for zones, brands, channels; update uses service-level ownership check (no decorator) matching plan spec"
  - "ChannelsModule has no delete endpoint — channels are reference data per UI-SPEC"
  - "AssetsService status transition guard: creators limited to in_review only, admin can set any status"
  - "presign-asset endpoint reuses UPLOAD_EVIDENCE permission and StorageService methods — no new service code needed"
  - "Seed zones replaced with 8 D-01 zones matching correct zone_type enum values"

patterns-established:
  - "Owner-edit RBAC pattern: no @RequiresPermission on PATCH, extract user from req in controller, pass userId+isAdmin to service, throw ForbiddenException when !isAdmin && !isOwner"
  - "Creator-edit RBAC pattern with status transition guard: creator can only move to approved-precursor statuses, admin unrestricted"
  - "CONST_INCLUDE pattern: define includes as const at module top, reuse in findMany/findOne/create/update"

requirements-completed: [OPS-01, OPS-02, OPS-03, OPS-04]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 6 Plan 1: Backend NestJS Modules for Operations Management Summary

**Four NestJS CRUD modules (zones/brands/channels/assets) with MANAGE_OPS RBAC, presign-asset storage endpoint, and D-01 seed data — 24 unit tests, 163 total passing, TypeScript clean**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T09:13:53Z
- **Completed:** 2026-03-21T09:19:13Z
- **Tasks:** 1 (TDD: 2 commits — test RED + feat GREEN)
- **Files modified:** 30

## Accomplishments

- 4 NestJS modules (ZonesModule, BrandsModule, ChannelsModule, AssetsModule) created, registered in AppModule, with full CRUD endpoints following DecisionsModule pattern
- MANAGE_OPS permission added to both backend and frontend permission enums with display names and descriptions
- presign-asset endpoint in StorageController accepts filename/contentType/fileSize without requiring taskId
- Seed updated with 8 D-01 zones (correct zone_type enum values), 2 brands (Konma Food, Just Craves), 7 channels
- 24 new unit tests covering all service behaviors including RBAC and status transition guards; full suite 163/163 passing

## Task Commits

TDD execution (single task, two phases):

1. **RED phase** - `919c48b` (test: failing tests for zones/brands/channels/assets services)
2. **GREEN phase** - `33257cd` (feat: MANAGE_OPS permission, all 4 modules, presign-asset, seed update)

**Plan metadata:** (docs commit follows)

_Note: TDD task has 2 commits — RED (failing tests) then GREEN (implementation)_

## Files Created/Modified

- `backend/src/zones/zones.service.ts` — Zone CRUD with owner-edit RBAC
- `backend/src/brands/brands.service.ts` — Brand CRUD with owner-edit RBAC, status filter
- `backend/src/channels/channels.service.ts` — Channel CRUD admin-only, no delete
- `backend/src/assets/assets.service.ts` — Asset CRUD with creator-edit RBAC and status transition guard
- `backend/src/storage/storage.controller.ts` — Added presign-asset endpoint
- `backend/src/storage/dto/presign-asset.dto.ts` — PresignAssetDto (filename, contentType, fileSize)
- `backend/src/app.module.ts` — ZonesModule, BrandsModule, ChannelsModule, AssetsModule registered
- `backend/src/types/permissions.ts` — MANAGE_OPS added to enum, display name, description
- `frontend/lib/types/permissions.ts` — MANAGE_OPS added to enum, display name, description
- `backend/prisma/seed.ts` — 8 D-01 zones, 2 brands, 7 channels with idempotent delete/recreate

## Decisions Made

- MANAGE_OPS gates create/delete for zones, brands, channels; PATCH uses service-level ownership check (no decorator) — consistent with plan spec and existing patterns
- ChannelsModule has no delete endpoint — channels are reference data per UI-SPEC
- AssetsService status transition guard: creators limited to `in_review` only, admin can set any valid status
- presign-asset reuses UPLOAD_EVIDENCE permission and existing StorageService methods — no new service code needed
- Seed zones replaced entirely: old generic zones (food_lab, production_kitchen etc.) replaced with D-01 named zones (Main Kitchen, Prep Station, etc.) with correct zone_type enum values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend API layer for Phase 6 is complete. Zones, brands, channels, assets all have functional CRUD endpoints with RBAC.
- Phase 6 Plan 2 (frontend pages for operations management) can proceed immediately.
- presign-asset endpoint is ready for frontend asset upload flow.

---
*Phase: 06-operations-management*
*Completed: 2026-03-21*
