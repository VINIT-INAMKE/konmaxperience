---
phase: 04-gamification-readiness-intelligence
plan: 01
subsystem: backend-api
tags: [nestjs, prisma, gamification, readiness, leaderboard, kpis, settings, tdd]
dependency_graph:
  requires: [03-04]
  provides: [readiness-api, leaderboard-api, kpi-api, settings-api, xp-in-auth]
  affects: [04-02, 04-03, 04-04]
tech_stack:
  added: []
  patterns: [nestjs-module, tdd-red-green, prisma-upsert, role-domain-map, kill-switch-pattern]
key_files:
  created:
    - backend/src/readiness/readiness.service.ts
    - backend/src/readiness/readiness.controller.ts
    - backend/src/readiness/readiness.module.ts
    - backend/src/readiness/readiness.service.spec.ts
    - backend/src/leaderboard/leaderboard.service.ts
    - backend/src/leaderboard/leaderboard.controller.ts
    - backend/src/leaderboard/leaderboard.module.ts
    - backend/src/leaderboard/leaderboard.service.spec.ts
    - backend/src/settings/settings.service.ts
    - backend/src/settings/settings.controller.ts
    - backend/src/settings/settings.module.ts
    - backend/src/settings/settings.service.spec.ts
    - backend/src/kpis/kpis.service.ts
    - backend/src/kpis/kpis.controller.ts
    - backend/src/kpis/kpis.module.ts
    - backend/src/kpis/kpis.service.spec.ts
    - backend/src/kpis/dto/create-kpi.dto.ts
    - backend/src/kpis/dto/update-kpi.dto.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/types/permissions.ts
    - backend/src/auth/auth.service.ts
    - backend/src/evidence/evidence.service.ts
    - backend/src/evidence/evidence.service.spec.ts
    - backend/src/evidence/__tests__/cascade.spec.ts
    - backend/src/app.module.ts
decisions:
  - "[04-01]: BI_LEAD sees all KPIs (same as admin) to support cross-domain intelligence role"
  - "[04-01]: leaderboard kill-switch defaults to enabled (null setting treated as true)"
  - "[04-01]: validateTask now fetches updatedUser via tx.user.findUnique after XP recalculation"
  - "[04-01]: KPI update uses $transaction to atomically update fields + clear/set task links"
metrics:
  duration: 7min
  completed: 2026-03-20
  tasks_completed: 2
  files_changed: 26
---

# Phase 4 Plan 1: Backend API — Readiness, Leaderboard, KPIs, Settings Summary

**One-liner:** Four NestJS modules (readiness, leaderboard, kpis, settings) with SystemSetting kill-switch, ROLE_DOMAIN_MAP scoping, and xp/level in auth + approval responses.

## What Was Built

### Task 1: Schema extension, permissions, auth/approval responses, readiness + leaderboard + settings modules

**Schema & Permissions:**
- Added `SystemSetting` model to Prisma schema (`key String @id`, `value String`, `updated_at DateTime @updatedAt`)
- Added `MANAGE_KPIS = 'MANAGE_KPIS'` to the Permission enum with display name and description

**Auth response extension (`auth.service.ts`):**
- `login()` now returns `xp_total: user.xp_total, level: user.level` in the user object
- `refreshToken()` now returns full user object including `xp_total` and `level` (previously returned only `accessToken`)

**Approval response extension (`evidence.service.ts`):**
- `validateTask()` now fetches `updatedUser = await tx.user.findUnique(...)` after XP recalculation
- Returns `{ valid, valid_xp, user: { id, xp_total, level } }` instead of `{ valid, valid_xp }`
- `approveEvidence()` return type updated to match

**ReadinessModule (`GET /readiness-meters`, `GET /readiness-meters/:id/tasks`):**
- `findAll()`: queries all meters ordered by code ascending
- `findTasksForMeter(meterId)`: throws NotFoundException if meter not found; returns active events (`revoked_at: null`) with task title, valid_xp, owner name

**LeaderboardModule (`GET /leaderboard`):**
- Kill-switch: checks `systemSetting` for `leaderboard_enabled`; if `value === 'false'` returns `{ enabled: false, users: [] }`
- Excludes `FOUNDER_ADMIN` via `role: { code: { not: 'FOUNDER_ADMIN' } }`
- Orders by `xp_total: 'desc'`

**SettingsModule (`GET /settings/:key`, `PATCH /settings/:key`):**
- `getSetting()`: throws NotFoundException if key not found
- `updateSetting()`: upserts via Prisma upsert (create or update)
- PATCH route protected by `@RequiresPermission(Permission.MANAGE_SYSTEM)`

### Task 2: KPI module with CRUD, domain scoping, and linked tasks

**DTOs:**
- `CreateKpiDto`: name, description, unit, target_value, domain (required); current_value, status, linked_task_ids (optional)
- `UpdateKpiDto`: all fields optional including linked_task_ids

**KpisService:**
- `ROLE_DOMAIN_MAP`: maps lead roles to domain strings
- `findAll(roleCode)`: FOUNDER_ADMIN and BI_LEAD see all; other leads filtered by their domain; unknown roles see nothing
- `create(dto)`: defaults status to `on_track`; links tasks via `task.updateMany` after KPI creation
- `update(id, dto)`: uses `$transaction` to clear old task links then set new ones atomically; throws NotFoundException if KPI missing

**KpisController (`/kpis`):**
- `GET /kpis`: no special permission, domain-scoped by role
- `GET /kpis/:id`: no special permission
- `POST /kpis`: requires `MANAGE_KPIS`
- `PATCH /kpis/:id`: requires `MANAGE_KPIS`

**AppModule:** ReadinessModule, LeaderboardModule, KpisModule, SettingsModule all registered.

## Test Results

- 14 test suites, 117 tests — all passing
- New tests: 10 (readiness) + 4 (leaderboard) + 6 (settings) + 15 (kpis) = 35 new tests
- Existing tests updated: evidence.service.spec.ts + cascade.spec.ts (Rule 1 auto-fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] cascade.spec.ts txMock missing user.findUnique after validateTask extension**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** `evidence/__tests__/cascade.spec.ts` had its own `txMock` without `user.findUnique`, which is now called inside `validateTask` after the XP recalculation. Tests failed with `TypeError: tx.user.findUnique is not a function`.
- **Fix:** Added `findUnique: jest.fn().mockResolvedValue({ id: 'uploader-1', xp_total: 100, level: 1 })` to `txMock.user` and updated three `toEqual` assertions to include the `user` field.
- **Files modified:** `backend/src/evidence/__tests__/cascade.spec.ts`
- **Commit:** b522891

## Self-Check: PASSED

All created files verified on disk. Both commits (b522891, 1a386e5) confirmed in git history. All 117 tests pass.
