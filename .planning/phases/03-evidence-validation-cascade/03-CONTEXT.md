# Phase 3: Evidence & Validation Cascade - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Evidence upload (photo, doc, video, link, note) to tasks via presigned URLs. Approval workflow where leads/admin approve or reject evidence with notes. Task auto-validates when all conditions are met (status=done + approved evidence + all approvals satisfied). The validation cascade (task validity → XP credit → quest progress → mission progress → readiness event) executes atomically in a single DB transaction. This is the architectural heart — everything downstream (gamification, readiness, dashboards) consumes its outputs.

</domain>

<decisions>
## Implementation Decisions

### Evidence Upload UX
- Drag-and-drop zone on the task detail page for file uploads
- Click to browse also available as fallback
- Upload progress indicator visible during upload
- Multiple evidence items per task — unlimited
- All five evidence types supported: photo, document, video, link, text note
- Evidence list displays as type icon + filename + status badge (no inline previews/thumbnails)
- For link type: user pastes URL + optional notes
- For note type: user types text directly (no file upload)

### File Storage
- Cloudflare R2 for file storage (S3-compatible, no egress fees)
- Presigned URL pattern — files go directly from browser to R2, never through the API server
- Backend generates presigned upload URL, frontend uploads directly, then confirms with backend
- Max file size: 10 MB per upload
- Allowed types: images (jpg, png, webp), documents (pdf, docx), video (mp4, webm), any link URL

### Approval Workflow
- Evidence appears inline on the task detail page with approve/reject buttons for authorized reviewers
- ALSO available from a dedicated approval queue page (pending approvals across all tasks) — consistent with Phase 1 decision
- Reject requires a written reason — reviewer must explain what's wrong
- Task owner sees rejection reason and can upload replacement evidence
- Approval records reviewer identity + timestamp (audit trail per dev spec)

### Validation Logic
- Task auto-verifies when ALL conditions are met: status=done + at least one approved evidence + all required approvals satisfied
- NO manual "verify" step — `verified=true` is set automatically by the cascade
- When task becomes valid: entire cascade executes in single Prisma $transaction
  - Set task.valid=true, task.valid_xp (based on type: core=100%, adhoc=70%, improvement=80%)
  - Recalculate quest progress (tighten from status='done' to valid=true)
  - Recalculate mission progress
  - Emit readiness event (if task has readiness_meter_id)

### Validation Feedback
- Green "Valid" badge on task when all conditions met
- When invalid: show checklist of unmet conditions (missing evidence, pending approval, status not done)
- On validation: toast notification "Task validated! +{XP} XP" with NumberTicker animation
- Quest progress bar animates on update — visible feedback loop for the user
- On evidence rejection: toast "Evidence rejected" + rejection reason visible on the evidence item

### Claude's Discretion
- Presigned URL expiration time
- R2 bucket naming and folder structure
- Evidence deletion policy (can users delete their own evidence?)
- Drag-drop zone visual design
- Approval queue page layout and filtering
- How the validation checklist looks on the task page

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain Model & Schema
- `contextdocs/dev_spec.md` §7.6 (evidence) — Evidence schema with types, approval_status, reviewer
- `contextdocs/dev_spec.md` §7.7 (approvals) — Approval schema with entity_type, scope, required_role_code
- `contextdocs/dev_spec.md` §9 (Business rules) — Task validity rules, XP rules, readiness rules
- `contextdocs/dev_spec.md` §10.1-10.8 — Pseudo-code for validate_task, calculate_effective_xp, update_readiness, approve_evidence

### API Design
- `contextdocs/dev_spec.md` §11.6 (evidence API) — GET/POST evidence, approve/reject endpoints
- `contextdocs/dev_spec.md` §11.7 (approvals API) — GET/approve/reject approvals

### Architecture Decisions
- `.planning/research/PITFALLS.md` — Validation cascade atomicity pitfall (must be single transaction)
- `.planning/research/PITFALLS.md` — Readiness double-counting prevention (idempotent events)
- `.planning/research/ARCHITECTURE.md` — Presigned URL pattern for evidence uploads

### Existing Implementation
- `backend/prisma/schema.prisma` — Evidence, Approval, TaskReadinessEvent models already defined
- `backend/src/tasks/tasks.service.ts` — Progress recalculation already exists (currently uses status='done', Phase 3 tightens to valid=true)
- `frontend/app/(ops)/tasks/[id]/page.tsx` — Task detail page with evidence placeholder section
- `backend/src/permissions/permissions.guard.ts` — @RequiresPermission decorator
- `backend/src/types/permissions.ts` — APPROVE_EVIDENCE, VERIFY_TASK, UPLOAD_EVIDENCE permissions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/tasks/tasks.service.ts` — recalculateQuestProgress and recalculateMissionProgress methods (currently filter by status='done', need to change to valid=true)
- `backend/src/permissions/scope.filter.ts` — buildScopeFilter for data-layer RBAC
- `frontend/lib/api-client.ts` — API client with auth refresh, can extend for presigned URL uploads
- `frontend/components/ui/progress.tsx` — Progress component for quest/mission progress bars
- `frontend/components/ui/number-ticker.tsx` — NumberTicker for animated XP/progress numbers

### Established Patterns
- NestJS Module → Controller → Service → Prisma pattern
- @RequiresPermission decorator for endpoint protection
- Prisma $transaction for atomic multi-step operations
- React Query for server state (invalidateQueries after mutations)
- Toast notifications (inline, no external library)

### Integration Points
- Task detail page (`frontend/app/(ops)/tasks/[id]/page.tsx`) — evidence section goes here
- Quest detail page — progress bars already exist, will update automatically via query invalidation
- Sidebar — approval queue link needs to be added (like blockers page)
- Phase 2 progress recalculation — needs to be tightened from status='done' to valid=true

</code_context>

<specifics>
## Specific Ideas

- The validation cascade is the most critical piece of code in the system — it MUST be transactional and correct. No partial state allowed.
- Toast + animation on validation gives the gamification feel — "Task validated! +25 XP" should feel rewarding
- The drag-drop zone should be clean and minimal, not a giant upload area taking up the page
- Approval queue should feel like a work inbox — pending items that need action

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-evidence-validation-cascade*
*Context gathered: 2026-03-20*
