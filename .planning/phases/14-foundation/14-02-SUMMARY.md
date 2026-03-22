---
phase: 14-foundation
plan: 02
subsystem: api
tags: [nestjs, crud, dompurify, xss-sanitization, role-filtering, slug-generation]

# Dependency graph
requires:
  - phase: 14-foundation-plan-01
    provides: "GuideSection/GuidePage Prisma models, MANAGE_GUIDE permission, GuidesModule scaffold"
provides:
  - "Full GuidesService CRUD with role-based filtering, XSS sanitization, slug generation, read time computation"
  - "9 REST endpoints in GuidesController (3 read + 6 write) with MANAGE_GUIDE permission guards"
  - "4 DTOs with class-validator decorators for section and page create/update"
  - "24 unit tests covering all CRUD operations, role filtering, draft visibility, sanitization"
affects: [15-guide-reader, 16-guide-editor]

# Tech tracking
tech-stack:
  added: [isomorphic-dompurify]
  patterns: [role-based query filtering via isAdmin check, DOMPurify allowlist sanitization, auto-slug generation with collision handling]

key-files:
  created:
    - backend/src/guides/dto/create-section.dto.ts
    - backend/src/guides/dto/update-section.dto.ts
    - backend/src/guides/dto/create-page.dto.ts
    - backend/src/guides/dto/update-page.dto.ts
    - backend/src/guides/__tests__/guides.service.spec.ts
  modified:
    - backend/src/guides/guides.service.ts
    - backend/src/guides/guides.controller.ts
    - backend/package.json

key-decisions:
  - "DOMPurify default import works in NestJS with esModuleInterop: true"
  - "404 returned for inaccessible pages instead of 403 to avoid information disclosure"
  - "Role filtering uses Prisma has operator for array membership check on role_codes"

patterns-established:
  - "Role-based query filtering: isAdmin(roleCode) check gates findMany where clause — admin sees all, non-admin sees published + role-matched"
  - "Content sanitization: DOMPurify.sanitize with explicit ALLOWED_TAGS allowlist + FORBID_TAGS for script/iframe"
  - "Auto-slug: generateSlug(title) + uniqueSectionSlug/uniquePageSlug with -2, -3 collision suffix"

requirements-completed: [GUIDE-01, GUIDE-02, GUIDE-03, GUIDE-04, GUIDE-05, EDIT-04]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 14 Plan 02: Guide CRUD API Summary

**Full GuidesService with role-filtered CRUD, DOMPurify XSS sanitization, auto-slug generation, and 9 REST endpoints behind MANAGE_GUIDE permission**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T14:26:19Z
- **Completed:** 2026-03-22T14:34:00Z
- **Tasks:** 3 (including 1 TDD task with RED/GREEN commits)
- **Files modified:** 9

## Accomplishments
- 4 DTOs with class-validator decorators matching Prisma schema fields for sections and pages
- GuidesService with full CRUD: create, find, update, remove for both sections and pages
- Role-based filtering: FOUNDER_ADMIN/TECH_LEAD see all including drafts; other roles see only published sections with their role_code
- XSS sanitization via DOMPurify on every page create/update with explicit allowlist
- Auto-generated slugs from titles with collision handling (-2, -3 suffix)
- Estimated read time computed at ~200 words/min with 1 minute minimum
- 9 REST endpoints: 3 read (JWT-only with role filtering) + 6 write (MANAGE_GUIDE permission)
- 24 unit tests all passing covering GUIDE-01 through GUIDE-05 and EDIT-04

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DTOs for guide sections and pages** - `093e18e` (feat)
2. **Task 2 RED: Add failing tests for GuidesService** - `55e3741` (test)
3. **Task 2 GREEN: Implement GuidesService** - `787f155` (feat)
4. **Task 3: Wire GuidesController REST endpoints** - `ceed49c` (feat)

## Files Created/Modified
- `backend/src/guides/dto/create-section.dto.ts` - CreateSectionDto with title, description, icon, accent_color, role_codes, sort_order, status
- `backend/src/guides/dto/update-section.dto.ts` - UpdateSectionDto with all optional fields + slug override
- `backend/src/guides/dto/create-page.dto.ts` - CreatePageDto with section_id (UUID), title, content, summary, sort_order, status
- `backend/src/guides/dto/update-page.dto.ts` - UpdatePageDto with all optional fields + slug override
- `backend/src/guides/guides.service.ts` - Full CRUD with role filtering, DOMPurify sanitization, slug generation, read time computation
- `backend/src/guides/guides.controller.ts` - 9 REST endpoints with RequiresPermission guards and ParseUUIDPipe validation
- `backend/src/guides/__tests__/guides.service.spec.ts` - 24 unit tests covering all requirements
- `backend/package.json` - Added isomorphic-dompurify dependency
- `backend/package-lock.json` - Lock file updated

## Decisions Made
- **DOMPurify import:** Default import (`import DOMPurify from 'isomorphic-dompurify'`) works in NestJS context with `esModuleInterop: true`
- **Information disclosure prevention:** Returns 404 (not 403) when non-admin users attempt to access draft or non-role-matched sections/pages, preventing enumeration of hidden guide content
- **Prisma has operator:** Used `role_codes: { has: roleCode }` for array membership filtering on the role_codes String[] field

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all service methods are fully implemented with real logic. No placeholder data or TODO markers.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Complete guide CRUD API ready for Phase 15 (Reader View) to consume
- GET /guide/sections returns role-filtered sections with page summaries for navigation
- GET /guide/pages/:id returns full page content for reader view rendering
- All write endpoints guarded by MANAGE_GUIDE permission for Phase 16 (Guide Editor)
- DOMPurify sanitization ensures safe content rendering in frontend

## Self-Check: PASSED

All 7 created/modified files verified on disk. All 4 task commits verified in git history.

---
*Phase: 14-foundation*
*Completed: 2026-03-22*
