---
phase: 03-evidence-validation-cascade
plan: 01
subsystem: api
tags: [aws-sdk, s3, cloudflare-r2, presigned-url, nestjs, evidence, file-upload]

# Dependency graph
requires:
  - phase: 01-foundation-authentication
    provides: "PrismaModule, AuthModule, PermissionsGuard, RequiresPermission decorator"
  - phase: 02-mission-quest-task-engine
    provides: "TasksModule, Task model, UPLOAD_EVIDENCE permission"
provides:
  - "StorageModule with R2 presigned URL generation"
  - "EvidenceModule with CRUD endpoints (findByTask, findOne, create)"
  - "POST /storage/presign endpoint with MIME + size validation"
  - "GET /tasks/:taskId/evidence endpoint"
  - "POST /tasks/:taskId/evidence endpoint"
affects: [03-02-approval-validation-cascade, 03-03-evidence-upload-frontend, 03-04-approval-frontend]

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"]
  patterns: ["Presigned URL pattern for direct browser-to-R2 upload", "MIME allowlist validation before presigned URL generation"]

key-files:
  created:
    - backend/src/storage/r2.config.ts
    - backend/src/storage/storage.service.ts
    - backend/src/storage/storage.controller.ts
    - backend/src/storage/storage.module.ts
    - backend/src/storage/dto/presign.dto.ts
    - backend/src/evidence/evidence.service.ts
    - backend/src/evidence/evidence.controller.ts
    - backend/src/evidence/evidence.module.ts
    - backend/src/evidence/dto/create-evidence.dto.ts
  modified:
    - backend/src/app.module.ts
    - backend/.env.example
    - backend/package.json

key-decisions:
  - "R2 S3Client created via factory function (not NestJS ConfigModule) matching existing env pattern"
  - "Evidence ownership check in both StorageController and EvidenceService for defense-in-depth"
  - "EvidenceType enum defined in DTO (photo, doc, video, link, note) with class-validator @IsEnum"

patterns-established:
  - "Presigned URL flow: validate -> check ownership -> build key -> generate URL -> return {presignedUrl, key, publicUrl}"
  - "Evidence key format: evidence/{taskId}/{timestamp}-{sanitized-filename}"

requirements-completed: [EVID-01]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 3 Plan 01: Storage & Evidence Backend Summary

**R2 presigned URL generation via @aws-sdk and evidence CRUD endpoints with MIME/size validation and ownership checks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T12:00:25Z
- **Completed:** 2026-03-20T12:05:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- StorageModule with R2 presigned PUT URL generation (15-min expiry, 10 MB max, MIME allowlist)
- EvidenceModule with GET/POST /tasks/:taskId/evidence endpoints enforcing UPLOAD_EVIDENCE permission
- Both modules registered in AppModule, TypeScript compiles cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Install AWS SDK and create StorageModule** - `096ebfc` (feat)
2. **Task 2: Create EvidenceModule and register in AppModule** - `3654e5d` (feat)

## Files Created/Modified
- `backend/src/storage/r2.config.ts` - S3Client factory for Cloudflare R2
- `backend/src/storage/storage.service.ts` - MIME validation, size validation, presigned URL generation, key builder
- `backend/src/storage/storage.controller.ts` - POST /storage/presign with ownership check
- `backend/src/storage/storage.module.ts` - Module definition exporting StorageService
- `backend/src/storage/dto/presign.dto.ts` - PresignDto with class-validator decorators
- `backend/src/evidence/evidence.service.ts` - Evidence CRUD with task ownership verification
- `backend/src/evidence/evidence.controller.ts` - GET/POST /tasks/:taskId/evidence routes
- `backend/src/evidence/evidence.module.ts` - Module definition exporting EvidenceService
- `backend/src/evidence/dto/create-evidence.dto.ts` - CreateEvidenceDto with EvidenceType enum
- `backend/src/app.module.ts` - Added StorageModule and EvidenceModule imports
- `backend/.env.example` - Added R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
- `backend/package.json` - Added @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner

## Decisions Made
- R2 S3Client created via factory function (not NestJS ConfigModule provider) -- matches existing env access pattern in the codebase
- Evidence ownership check duplicated in both StorageController (presign) and EvidenceService (create) for defense-in-depth
- EvidenceType enum defined in DTO file with values: photo, doc, video, link, note
- Storage key format: `evidence/{taskId}/{timestamp}-{sanitized-filename}` -- sanitized removes special chars

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in `tasks.service.spec.ts` (test expects valid-based counting but code still uses status='done') -- this is intentionally written for Phase 3's validation cascade changes and not caused by this plan's changes

## User Setup Required

Cloudflare R2 must be configured before evidence upload works. Required environment variables:
- `R2_ENDPOINT` - Cloudflare R2 S3 API endpoint
- `R2_ACCESS_KEY_ID` - R2 API token access key
- `R2_SECRET_ACCESS_KEY` - R2 API token secret key
- `R2_BUCKET_NAME` - R2 bucket name (e.g., 'konma-evidence')
- `R2_PUBLIC_URL` - R2 bucket public access URL

CORS policy must be set on the R2 bucket to allow PUT/GET from localhost:3000.

## Next Phase Readiness
- StorageService and EvidenceService exported and ready for Plan 02 (approval/validation cascade)
- EvidenceModule provides the data layer for Plan 03 (evidence upload frontend)
- Presign endpoint ready for frontend integration (direct browser-to-R2 upload)

## Self-Check: PASSED

All 9 created files verified present. Both task commits (096ebfc, 3654e5d) verified in git log.

---
*Phase: 03-evidence-validation-cascade*
*Completed: 2026-03-20*
