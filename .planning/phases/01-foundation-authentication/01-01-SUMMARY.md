---
phase: 01-foundation-authentication
plan: 01
subsystem: database
tags: [nestjs, nextjs, prisma, postgresql, typescript, shadcn, tailwind, rbac]

# Dependency graph
requires: []
provides:
  - "Full 15-entity Prisma schema (17 models including RefreshToken, PasswordResetToken)"
  - "Shared TypeScript types for RoleCode (8), Permission (15), JWT, auth, users"
  - "NestJS backend scaffold with ValidationPipe, CORS, helmet, ConfigModule"
  - "Next.js frontend scaffold with shadcn/ui (15 components), Tailwind v4, dark mode"
  - "PrismaService and global PrismaModule for NestJS"
  - "Seed data definitions for 8 roles, 8 users, 10 readiness meters, 8 zones"
affects: [01-02, 01-03, 02-mission-execution, 03-evidence-validation]

# Tech tracking
tech-stack:
  added: [prisma@6, "@prisma/client@6", "@nestjs/config", "@nestjs/passport", "@nestjs/jwt", "@nestjs/throttler", bcrypt, jose, helmet, class-validator, class-transformer, zustand, "@tanstack/react-query", react-hook-form, "@hookform/resolvers", zod, "shadcn/ui"]
  patterns: [global-prisma-module, identity-only-jwt, dual-track-quest-progress, hash-not-plaintext-tokens]

key-files:
  created:
    - backend/prisma/schema.prisma
    - backend/prisma/seed.ts
    - backend/src/prisma/prisma.service.ts
    - backend/src/prisma/prisma.module.ts
    - backend/src/types/roles.ts
    - backend/src/types/permissions.ts
    - backend/src/types/auth.ts
    - backend/src/types/users.ts
    - frontend/lib/types/roles.ts
    - frontend/lib/types/permissions.ts
    - frontend/lib/types/auth.ts
    - frontend/lib/types/users.ts
    - frontend/components/ui/ (15 shadcn components)
  modified:
    - backend/src/main.ts
    - backend/src/app.module.ts
    - backend/package.json
    - frontend/app/layout.tsx
    - frontend/app/globals.css

key-decisions:
  - "Prisma v6 used per user constraint (NOT v7) - schema uses prisma-client-js generator"
  - "Separate projects (no monorepo) - backend/ and frontend/ each have own package.json"
  - "Dual-track quest progress from schema level - baseline_task_count, core/adhoc progress"
  - "Token hashes stored for RefreshToken and PasswordResetToken - never plaintext"
  - "TaskReadinessEvent has revoked_at field for invalidation-revalidation cycle"
  - "Migration and seed deferred until PostgreSQL is configured by user"

patterns-established:
  - "Global PrismaModule: @Global() module providing PrismaService to all NestJS modules"
  - "Shared types pattern: identical enums/interfaces in backend/src/types/ and frontend/lib/types/"
  - "ValidationPipe global config: whitelist true, forbidNonWhitelisted true, transform true"
  - "CORS configured for frontend origin with credentials support"

requirements-completed: [AUTH-02]

# Metrics
duration: 121min
completed: 2026-03-19
---

# Phase 01 Plan 01: Project Scaffold Summary

**NestJS + Next.js independent projects with full 15-entity Prisma schema, 8-role RBAC types, and shadcn/ui component library**

## Performance

- **Duration:** ~20 min active execution (121 min wall clock including user pause)
- **Started:** 2026-03-19T11:49:23Z
- **Completed:** 2026-03-19T13:51:09Z
- **Tasks:** 2 of 2
- **Files modified:** 65

## Accomplishments

- NestJS backend scaffolded with security middleware (helmet, CORS, ValidationPipe), ConfigModule, and Prisma v6
- Next.js frontend scaffolded with Tailwind v4, shadcn/ui (15 components), Geist font, and dark mode
- Complete 15-entity Prisma schema with all relationships, indexes, and enhanced fields from research
- Shared TypeScript types (RoleCode enum with 8 roles, Permission enum with 15 values, JWT/auth/user interfaces) defined identically in both projects
- Seed data prepared for 8 roles with correct permissions, 8 users, 10 readiness meters, 8 zones
- PrismaService and global PrismaModule integrated into AppModule

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold backend project** - `6e37d9c` (feat)
2. **Task 1: Scaffold frontend project** - `faad63f` (feat)
3. **Task 2: Prisma schema, seed, PrismaModule** - `2ce9954` (feat)

## Files Created/Modified

- `backend/prisma/schema.prisma` - Full 17-model Prisma schema (15 entities + RefreshToken + PasswordResetToken)
- `backend/prisma/seed.ts` - Seed data: 8 roles, 8 users, 10 readiness meters, 8 zones
- `backend/src/prisma/prisma.service.ts` - PrismaClient wrapper with lifecycle hooks
- `backend/src/prisma/prisma.module.ts` - Global module exporting PrismaService
- `backend/src/main.ts` - NestJS bootstrap with ValidationPipe, CORS, helmet
- `backend/src/app.module.ts` - Root module with ConfigModule and PrismaModule
- `backend/src/types/` - RoleCode enum, Permission enum, JwtPayload, LoginDto, UserProfile
- `backend/.env.example` - Environment variable template
- `frontend/app/layout.tsx` - Root layout with Geist font, dark mode, Konma Xperience metadata
- `frontend/app/globals.css` - shadcn/ui theme variables with dark mode support
- `frontend/lib/types/` - Identical shared types (roles, permissions, auth, users)
- `frontend/components/ui/` - 15 shadcn components (button, input, card, table, dialog, etc.)
- `frontend/.env.example` - Frontend environment template
- `.gitignore` - Root gitignore covering both projects
- `.env.example` - Root pointer to project-specific .env.example files

## Decisions Made

- **Prisma v6 over v7:** User constraint requires v6. Removed v7-specific prisma.config.ts and prisma-client output directory. Uses standard prisma-client-js generator.
- **No monorepo tooling:** Backend and frontend are fully independent projects with separate package.json, npm install, and TypeScript compilation.
- **Removed nested .git from frontend:** create-next-app generated a .git inside frontend/, which prevented staging files in the parent repo. Removed it.
- **Frontend .gitignore updated:** Default .gitignore from create-next-app excluded .env.example and next-env.d.ts. Updated to allow these tracked files.
- **Migration deferred:** User indicated PostgreSQL will be configured later. Schema validates, client generates, TypeScript compiles -- migration and seed will run when DB is available.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed nested .git from frontend/**
- **Found during:** Task 1 (frontend scaffolding)
- **Issue:** create-next-app created a .git directory inside frontend/, preventing git add from the parent repo
- **Fix:** Removed frontend/.git directory
- **Files modified:** None (removed .git directory)
- **Verification:** git add frontend/ files now stages correctly
- **Committed in:** faad63f (Task 1 frontend commit)

**2. [Rule 3 - Blocking] Updated frontend .gitignore to allow .env.example**
- **Found during:** Task 1 (frontend scaffolding)
- **Issue:** Default .gitignore had `.env*` pattern which excluded `.env.example` from git tracking
- **Fix:** Changed pattern to explicitly list `.env`, `.env.local`, `.env.*.local` with `!.env.example` negation. Also removed `next-env.d.ts` from ignore.
- **Files modified:** frontend/.gitignore
- **Verification:** git add frontend/.env.example succeeds without -f flag
- **Committed in:** faad63f (Task 1 frontend commit)

**3. [Rule 3 - Blocking] Downgraded Prisma from v7 to v6**
- **Found during:** Task 1 (backend scaffolding)
- **Issue:** Backend had Prisma v7 installed (which uses prisma-client provider and prisma.config.ts). User constraint requires Prisma v6.
- **Fix:** Ran npm install prisma@6 @prisma/client@6, removed prisma.config.ts and generated/ directory, updated schema to use prisma-client-js provider
- **Files modified:** backend/package.json, backend/prisma/schema.prisma (removed prisma.config.ts)
- **Verification:** npx prisma validate passes, npx prisma generate succeeds
- **Committed in:** 6e37d9c (Task 1 backend commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking issues)
**Impact on plan:** All auto-fixes were necessary to unblock git operations and meet Prisma version constraint. No scope creep.

## Issues Encountered

- **PostgreSQL not available:** Migration and seed commands require a running PostgreSQL database. User indicated they will configure PostgreSQL later. All code artifacts are complete and validated -- only the actual database operations are deferred.
- **Prisma v7 artifacts:** The backend was initialized with Prisma v7 (npx prisma init generates v7 by default). Required downgrade to v6 and removal of v7-specific configuration files.

## User Setup Required

Before running migration and seed:
1. Install and start PostgreSQL locally (or configure a remote PostgreSQL URL)
2. Update `backend/.env` with a valid `DATABASE_URL` (format: `postgresql://user:pass@host:port/dbname`)
3. Run: `cd backend && npx prisma migrate dev --name init`
4. Run: `cd backend && npx prisma db seed`

## Next Phase Readiness

- Schema and types are complete -- Plan 01-02 (JWT auth implementation) can proceed immediately
- PrismaModule is globally available for any NestJS module to inject PrismaService
- Shared types enable type-safe contract between backend and frontend
- **Blocker for runtime testing:** PostgreSQL must be configured before auth endpoints can be tested against the database

## Self-Check: PASSED

All 17 key files verified present on disk. All 3 commit hashes (6e37d9c, faad63f, 2ce9954) found in git log. Backend TypeScript compilation passes. Frontend TypeScript compilation passes. Prisma schema validates successfully.

---
*Phase: 01-foundation-authentication*
*Completed: 2026-03-19*
