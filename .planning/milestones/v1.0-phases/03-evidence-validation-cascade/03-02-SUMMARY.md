---
phase: 03-evidence-validation-cascade
plan: 02
subsystem: api
tags: [nestjs, prisma, transaction, validation-cascade, xp, readiness, evidence-approval]

# Dependency graph
requires:
  - phase: 01-foundation-authentication
    provides: "PrismaModule, AuthModule, PermissionsGuard, RequiresPermission decorator"
  - phase: 02-mission-quest-task-engine
    provides: "TasksModule, Task model, recalculateQuestProgress, recalculateMissionProgress"
  - phase: 03-evidence-validation-cascade plan 01
    provides: "StorageModule, EvidenceModule with CRUD endpoints"
provides:
  - "POST /evidence/:id/approve endpoint with APPROVE_EVIDENCE permission"
  - "POST /evidence/:id/reject endpoint with required notes body"
  - "Atomic validateTask cascade in prisma.$transaction"
  - "Self-approval prevention (403 ForbiddenException)"
  - "calculateEffectiveXp: core=100%, adhoc=70%, improvement=80%"
  - "recalculateUserXp with level thresholds (1/2/3/4)"
  - "Quest/mission progress tightened from status='done' to valid=true"
  - "applyReadinessFromTask with idempotent creation and revocation"
  - "41 new tests (31 evidence + 10 storage)"
affects: [03-03-evidence-upload-frontend, 03-04-approval-frontend, 04-frontend-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Atomic validation cascade via prisma.$transaction", "Idempotent readiness event creation/revocation with recomputation", "Self-referential evidence review prevention"]

key-files:
  created:
    - backend/src/evidence/dto/review-evidence.dto.ts
    - backend/src/evidence/evidence.service.spec.ts
    - backend/src/storage/storage.service.spec.ts
    - backend/src/evidence/__tests__/cascade.spec.ts
  modified:
    - backend/src/evidence/evidence.service.ts
    - backend/src/evidence/evidence.controller.ts
    - backend/src/evidence/evidence.module.ts
    - backend/src/tasks/tasks.service.ts
    - backend/src/tasks/tasks.service.spec.ts

key-decisions:
  - "EvidenceReviewController as separate controller class for /evidence/:id/* routes (NestJS single prefix per controller)"
  - "validateTask sets verified=isValid atomically (auto-set, no manual verification step)"
  - "User XP derived via task.aggregate with _sum instead of fetching all tasks"
  - "Readiness meter always recomputed from active events (not incremental) for consistency"

patterns-established:
  - "Cascade pattern: approve/reject -> validateTask -> recalculateUserXp -> recalculateQuestProgress -> recalculateMissionProgress -> applyReadinessFromTask — all within single $transaction"
  - "Readiness revocation: set revoked_at + applied=false, then recompute from all active events"
  - "XP multipliers: core=1.0, adhoc=0.7, improvement=0.8 with Math.floor"

requirements-completed: [EVID-02, EVID-03]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 3 Plan 02: Approval & Validation Cascade Summary

**Atomic evidence approve/reject endpoints with full validateTask cascade setting valid=true, XP calculation, quest/mission progress tightened to valid=true, and idempotent readiness events**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T12:08:07Z
- **Completed:** 2026-03-20T12:15:07Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Atomic validateTask cascade: evidence approval triggers task validation, XP calculation, quest/mission progress update, and readiness event management in single prisma.$transaction
- Self-approval blocked with 403 ForbiddenException before any writes
- Quest and mission progress tightened from status='done' to valid=true in both tasks.service.ts and evidence.service.ts
- 89 total backend tests pass (41 new: 31 evidence + 10 storage)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement approval/rejection endpoints and atomic validateTask cascade** - `5e9ad1e` (test/RED), `6e86501` (feat/GREEN)
2. **Task 2: Unit tests for validation cascade, self-approval, XP, readiness, presign** - `897023e` (test)

## Files Created/Modified
- `backend/src/evidence/dto/review-evidence.dto.ts` - ReviewEvidenceDto with required notes field for rejection
- `backend/src/evidence/evidence.service.ts` - Added approveEvidence, rejectEvidence, validateTask, calculateEffectiveXp, recalculateUserXp, recalculateQuestProgress, recalculateMissionProgress, applyReadinessFromTask
- `backend/src/evidence/evidence.controller.ts` - Added EvidenceReviewController with POST evidence/:id/approve and evidence/:id/reject
- `backend/src/evidence/evidence.module.ts` - Registered EvidenceReviewController
- `backend/src/tasks/tasks.service.ts` - Tightened recalculateQuestProgress and recalculateMissionProgress from status='done' to valid=true
- `backend/src/evidence/evidence.service.spec.ts` - 31 unit tests for cascade, self-approval, XP, readiness, progress
- `backend/src/storage/storage.service.spec.ts` - 10 unit tests for presign MIME/size validation, key format, public URL
- `backend/src/evidence/__tests__/cascade.spec.ts` - TDD RED phase tests (9 tests)
- `backend/src/tasks/tasks.service.spec.ts` - Fixed mission progress test mock to align with valid=true tightening

## Decisions Made
- EvidenceReviewController created as separate class (NestJS requires single @Controller prefix per class) registered alongside EvidenceController in EvidenceModule
- validateTask sets verified=isValid atomically -- no separate manual verification step needed
- User XP calculated via Prisma aggregate._sum (efficient single query) rather than fetching all tasks
- Readiness meter always recomputed from all active events (sum where revoked_at=null) rather than incremental add/subtract, ensuring consistency after revoke/re-approve cycles

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tasks.service.spec.ts mission progress test mock**
- **Found during:** Task 2 (running full test suite)
- **Issue:** Existing test mocked task.findMany for mission progress but production code uses task.count after valid=true tightening
- **Fix:** Changed mock from findMany with valid flags to task.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4)
- **Files modified:** backend/src/tasks/tasks.service.spec.ts
- **Verification:** All 89 tests pass
- **Committed in:** 897023e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Test mock alignment required by the tightening change. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Approve/reject endpoints ready for frontend integration (Plan 04)
- Evidence upload frontend (Plan 03) can be built in parallel -- only needs Plan 01's presign endpoint
- The cascade is the architectural heart -- all downstream features (dashboard XP, readiness meters, quest completion) now have valid data flow

## Self-Check: PASSED

All 4 created files verified present. All 3 task commits (5e9ad1e, 6e86501, 897023e) verified in git log.

---
*Phase: 03-evidence-validation-cascade*
*Completed: 2026-03-20*
