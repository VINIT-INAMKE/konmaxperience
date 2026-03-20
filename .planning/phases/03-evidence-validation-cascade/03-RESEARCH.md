# Phase 3: Evidence & Validation Cascade - Research

**Researched:** 2026-03-20
**Domain:** File uploads (Cloudflare R2 presigned URLs), approval workflows, atomic validation cascade, NestJS + Prisma v6
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Drag-and-drop zone on the task detail page for file uploads; click to browse as fallback
- Upload progress indicator visible during upload
- Multiple evidence items per task — unlimited
- All five evidence types: photo, document, video, link, text note
- Evidence list: type icon + filename + status badge (no inline previews/thumbnails)
- For link type: user pastes URL + optional notes
- For note type: user types text directly (no file upload)
- Cloudflare R2 for file storage (S3-compatible, no egress fees)
- Presigned URL pattern: browser uploads directly to R2, never through API server
- Backend generates presigned upload URL, frontend uploads directly, confirms with backend
- Max file size: 10 MB per upload
- Allowed types: images (jpg, png, webp), documents (pdf, docx), video (mp4, webm), any link URL
- Evidence appears inline on task detail page with approve/reject buttons for authorized reviewers
- Dedicated approval queue page (pending approvals across all tasks) — consistent with Phase 1 decision
- Reject requires a written reason
- Task owner sees rejection reason; can upload replacement evidence
- Approval records reviewer identity + timestamp (audit trail)
- Task auto-verifies when ALL conditions met: status=done + at least one approved evidence + all required approvals satisfied
- NO manual "verify" step — verified=true is set automatically by the cascade
- Cascade executes in single Prisma $transaction:
  - Set task.valid=true, task.valid_xp (core=100%, adhoc=70%, improvement=80%)
  - Recalculate quest progress (tighten from status='done' to valid=true)
  - Recalculate mission progress
  - Emit readiness event (if task has readiness_meter_id)
- Green "Valid" badge on task when all conditions met
- When invalid: show checklist of unmet conditions
- On validation: toast "Task validated! +{XP} XP" with NumberTicker animation
- Quest progress bar animates on update
- On evidence rejection: toast "Evidence rejected" + rejection reason on evidence item

### Claude's Discretion
- Presigned URL expiration time
- R2 bucket naming and folder structure
- Evidence deletion policy (can users delete their own evidence?)
- Drag-drop zone visual design
- Approval queue page layout and filtering
- How the validation checklist looks on the task page

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EVID-01 | User can upload evidence (photo, doc, video, link, note) to any assigned task | R2 presigned URL pattern; NestJS EvidenceModule; frontend drag-drop zone; all 5 types handled via type-specific code paths |
| EVID-02 | Lead/admin can approve or reject evidence with notes | APPROVE_EVIDENCE permission already defined; NestJS controller endpoints; approval queue page; inline approve/reject on task detail |
| EVID-03 | Task is valid only when: status=done + approved evidence + all required approvals satisfied + verified=true | validateTask() cascade in single Prisma $transaction; tightens existing recalculateQuestProgress and recalculateMissionProgress from status='done' to valid=true; UserXP calculation added |
</phase_requirements>

---

## Summary

Phase 3 is the architectural heart of the system. It wires together three sub-systems: (1) evidence upload via R2 presigned URLs, (2) an approval workflow for reviewing uploaded evidence, and (3) the validation cascade that atomically sets task.valid=true and cascades XP, quest progress, mission progress, and readiness events. Everything downstream — gamification, readiness meters, dashboards — consumes the outputs of this cascade.

The backend needs a new `EvidenceModule` and an `ApprovalsModule` (or reuse the approval model via TasksModule). Both modules delegate to a shared `validateTask()` service method that wraps the entire cascade in `prisma.$transaction()`. The frontend replaces the Phase 3 placeholder card on the task detail page with a working drag-drop upload zone, evidence list, and inline approve/reject controls. A new approval queue page is created at `/approvals`.

The critical correctness constraint is that the cascade is **always atomic**. Partial state (XP incremented but progress not updated) must never persist. The existing `tasks.service.ts` already uses `prisma.$transaction()` for status updates — Phase 3 extends that same pattern to the full validation cascade.

**Primary recommendation:** Build in this order — (1) backend EvidenceModule with R2 upload + evidence CRUD, (2) approve/reject endpoints that call validateTask(), (3) validateTask() cascade implementation inside $transaction, (4) frontend upload zone + evidence list, (5) inline approval UI on task detail, (6) approval queue page, (7) progress bar animations and toast feedback.

---

## Standard Stack

### Core (already installed — no new installs needed for backend)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @aws-sdk/client-s3 | 3.1013.0 | S3-compatible client for R2 | Official AWS SDK works with Cloudflare R2 via endpoint override; already confirmed working |
| @aws-sdk/s3-request-presigner | 3.1013.0 | Generate presigned PUT URLs | Companion package to client-s3 for presigned URL generation; must match client-s3 version |
| @prisma/client | 6.x (project uses v6) | ORM for all DB operations | Already in use; $transaction supports interactive transactions in v6 |
| multer | 2.1.1 | NOT needed — presigned URL pattern bypasses server upload | Do not add; files never traverse NestJS |

### Supporting (frontend additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | 12.38.0 (already installed) | Progress bar animations, toast entrance | Quest progress bar animation on validation; already in package.json |
| canvas-confetti | 1.9.4 (already installed) | Confetti burst on task validation | Already installed; fire on task.valid=true transition |

**Installation (backend only):**
```bash
cd backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install -D @types/multer  # NOT needed — skip multer entirely
```

**Version verification (confirmed 2026-03-20):**
- `@aws-sdk/client-s3`: 3.1013.0
- `@aws-sdk/s3-request-presigner`: 3.1013.0
- `multer`: 2.1.1 (NOT used — presigned URL pattern)

---

## Architecture Patterns

### Recommended Module Structure (backend)

```
backend/src/
├── evidence/
│   ├── evidence.module.ts
│   ├── evidence.controller.ts      # GET/POST /tasks/:id/evidence, POST /evidence/:id/approve, POST /evidence/:id/reject
│   ├── evidence.service.ts         # createEvidence, approveEvidence, rejectEvidence, validateTask
│   └── dto/
│       ├── create-evidence.dto.ts  # type, url, notes?
│       └── review-evidence.dto.ts  # notes? (for rejection reason)
├── approvals/
│   ├── approvals.module.ts
│   ├── approvals.controller.ts     # GET /approvals, POST /approvals/:id/approve, POST /approvals/:id/reject
│   └── approvals.service.ts        # getApprovalQueue, approveApproval, rejectApproval, then calls validateTask
└── storage/
    ├── storage.module.ts
    ├── storage.service.ts          # generatePresignedPutUrl(key, contentType, taskId)
    └── r2.config.ts                # S3Client configured for R2 endpoint
```

```
frontend/
├── app/(ops)/
│   ├── approvals/
│   │   └── page.tsx               # NEW: approval queue page
│   └── tasks/[id]/
│       └── page.tsx               # MODIFIED: replace Evidence placeholder card
├── components/ops/
│   ├── evidence/
│   │   ├── EvidenceUploadZone.tsx  # Drag-drop + click-to-browse
│   │   ├── EvidenceList.tsx        # List with type icon + status badge
│   │   ├── EvidenceItem.tsx        # Single evidence row with approve/reject
│   │   ├── LinkEvidenceForm.tsx    # URL paste + notes for link type
│   │   └── NoteEvidenceForm.tsx    # Text area for note type
│   └── approvals/
│       ├── ApprovalQueue.tsx       # Full approval queue list
│       └── ApprovalItem.tsx        # Single approval item with actions
└── lib/types/
    ├── evidence.ts                 # Evidence, EvidenceType, EvidenceApprovalStatus
    └── approvals.ts                # Approval type
```

### Pattern 1: R2 Presigned URL Upload (Two-Phase Pattern)

**What:** Backend generates a presigned PUT URL; frontend uploads directly to R2; then frontend calls backend to confirm and create the evidence record.

**When to use:** All file-type evidence (photo, doc, video). Not for link or note types.

**Three steps:**
1. Frontend calls `POST /storage/presign` with `{ filename, contentType, taskId }` → receives `{ url, key }`
2. Frontend does `PUT url` directly with file bytes (progress tracked via XHR or fetch with ReadableStream)
3. Frontend calls `POST /tasks/:taskId/evidence` with `{ type, url: r2PublicUrl, notes }` → evidence record created

**Backend presign endpoint:**
```typescript
// backend/src/storage/storage.service.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT, // https://<account>.r2.cloudflarestorage.com
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  async generatePresignedPutUrl(
    key: string,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });
    // 15 minutes expiry — enough for 10MB upload on slow connections
    return getSignedUrl(this.s3, command, { expiresIn: 900 });
  }
}
```

**R2 key structure (Claude's discretion — recommended):**
```
evidence/{taskId}/{timestamp}-{sanitized-filename}
```

**R2 public URL pattern:**
```
https://<bucket>.<account>.r2.cloudflarestorage.com/{key}
OR custom domain: https://evidence.konmaxperience.com/{key}
```

**MIME type validation (server-side, NOT extension-only):**
```typescript
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4', 'video/webm',
]);

// Validate in presign controller BEFORE generating URL
if (!ALLOWED_MIME_TYPES.has(contentType)) {
  throw new BadRequestException('File type not allowed');
}
```

### Pattern 2: validateTask() — The Atomic Cascade

**What:** Single function that checks all validity conditions and executes the full cascade in one `prisma.$transaction()`. Called after any state change (evidence approved, approval satisfied, task status changed).

**Critical requirement:** ALL five writes inside one transaction. No partial commits.

```typescript
// backend/src/evidence/evidence.service.ts

async validateTask(taskId: string, tx: Prisma.TransactionClient): Promise<void> {
  const task = await tx.task.findUnique({
    where: { id: taskId },
    include: {
      evidence: true,
      approvals: true,
    },
  });
  if (!task) return;

  const hasApprovedEvidence = task.evidence.some(
    (e) => e.approval_status === 'approved',
  );
  const approvalsSatisfied = task.requires_approval
    ? task.approvals.every((a) => a.status === 'approved')
    : true;

  const isValid =
    task.status === 'done' &&
    hasApprovedEvidence &&
    approvalsSatisfied;

  const validXp = isValid ? this.calculateEffectiveXp(task) : 0;

  // Write 1: task validity
  await tx.task.update({
    where: { id: taskId },
    data: {
      valid: isValid,
      valid_xp: validXp,
      verified: isValid, // auto-set — no manual verify step
    },
  });

  // Write 2: user XP (only if valid state changed or we need to recalculate)
  await this.recalculateUserXp(task.owner_user_id, tx);

  // Write 3 + 4: quest and mission progress (tighten to valid=true)
  await this.recalculateQuestProgress(task.quest_id, tx);
  await this.recalculateMissionProgress(task.mission_id, tx);

  // Write 5: readiness event (idempotent — only creates if valid and no existing active event)
  await this.applyReadinessFromTask(taskId, isValid, tx);
}

// TIGHTENED from status='done' to valid=true — the key Phase 3 change
private async recalculateQuestProgress(questId: string | null, tx): Promise<void> {
  if (!questId) return;
  const quest = await tx.quest.findUnique({ where: { id: questId } });
  if (!quest) return;

  const coreValidCount = await tx.task.count({
    where: { quest_id: questId, task_type: 'core', valid: true }, // TIGHTENED
  });
  const coreProgress = quest.baseline_task_count > 0
    ? Math.round((coreValidCount / quest.baseline_task_count) * 100)
    : 0;

  const totalAdhoc = await tx.task.count({ where: { quest_id: questId, task_type: 'adhoc' } });
  const validAdhoc = await tx.task.count({ where: { quest_id: questId, task_type: 'adhoc', valid: true } }); // TIGHTENED
  const adhocProgress = totalAdhoc > 0 ? Math.round((validAdhoc / totalAdhoc) * 100) : 0;

  const combinedProgress = quest.baseline_task_count > 0
    ? Math.round(((coreValidCount + validAdhoc * 0.7) / (quest.baseline_task_count + totalAdhoc * 0.7)) * 100)
    : 0;

  await tx.quest.update({
    where: { id: questId },
    data: { core_progress_percent: coreProgress, adhoc_progress_percent: adhocProgress, progress_percent: combinedProgress },
  });
}
```

**Trigger points — validateTask() is called after:**
1. `POST /evidence/:id/approve` — evidence just approved
2. `POST /evidence/:id/reject` — evidence rejected (may invalidate a previously valid task)
3. `POST /approvals/:id/approve` — formal approval satisfied
4. `POST /approvals/:id/reject` — approval rejected (may invalidate)
5. `PATCH /tasks/:id` with `status: 'done'` — status condition now met (already done, but re-check)

**How to call validateTask inside its own transaction:**
```typescript
// In evidence.service.ts approve method:
async approveEvidence(evidenceId: string, reviewerId: string): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    await tx.evidence.update({
      where: { id: evidenceId },
      data: { approval_status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date() },
    });
    const evidence = await tx.evidence.findUnique({ where: { id: evidenceId } });
    await this.validateTask(evidence.task_id, tx);
  });
}
```

### Pattern 3: Readiness Event — Idempotent with Revocation

**What:** Task readiness events follow the revocation pattern already in the schema (`revoked_at` field on `TaskReadinessEvent`). When a task becomes invalid again, its event is revoked and the meter is decremented.

```typescript
private async applyReadinessFromTask(
  taskId: string,
  isValid: boolean,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const task = await tx.task.findUnique({ where: { id: taskId } });
  if (!task?.readiness_meter_id) return;

  if (isValid) {
    // Check for existing active event (idempotency guard)
    const existing = await tx.taskReadinessEvent.findFirst({
      where: { task_id: taskId, readiness_meter_id: task.readiness_meter_id, revoked_at: null },
    });
    if (existing) return; // already applied — do nothing

    await tx.taskReadinessEvent.create({
      data: { task_id: taskId, readiness_meter_id: task.readiness_meter_id, value: task.readiness_value, applied: true },
    });
  } else {
    // Revoke existing active events for this task
    await tx.taskReadinessEvent.updateMany({
      where: { task_id: taskId, revoked_at: null },
      data: { revoked_at: new Date(), applied: false },
    });
  }

  // Recompute meter from all active events
  const events = await tx.taskReadinessEvent.findMany({
    where: { readiness_meter_id: task.readiness_meter_id, revoked_at: null },
  });
  const total = events.reduce((sum, e) => sum + e.value, 0);
  await tx.readinessMeter.update({
    where: { id: task.readiness_meter_id },
    data: { current_value: Math.min(total, 100) },
  });
}
```

### Pattern 4: User XP Recalculation

**What:** Sum all `valid_xp` from valid tasks owned by the user; derive level from thresholds.

```typescript
private async recalculateUserXp(userId: string, tx: Prisma.TransactionClient): Promise<void> {
  const validTasks = await tx.task.findMany({
    where: { owner_user_id: userId, valid: true },
    select: { valid_xp: true },
  });
  const totalXp = validTasks.reduce((sum, t) => sum + t.valid_xp, 0);
  const level = totalXp < 200 ? 1 : totalXp < 500 ? 2 : totalXp < 1000 ? 3 : 4;
  await tx.user.update({ where: { id: userId }, data: { xp_total: totalXp, level } });
}
```

### Pattern 5: Frontend Upload Progress

**What:** Track upload progress without multer. Use `XMLHttpRequest` (not `fetch`) for upload to presigned URL so progress events fire.

```typescript
// frontend/components/ops/evidence/EvidenceUploadZone.tsx
async function uploadToR2(file: File, presignedUrl: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => xhr.status < 400 ? resolve() : reject(new Error('Upload failed')));
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
```

### Pattern 6: Drag-Drop Upload Zone

**What:** Use native HTML drag events (`onDragOver`, `onDrop`) + `<input type="file">` for the click path. No external DnD library needed for simple file drop (dnd-kit is already installed for kanban but is overkill for file upload).

```typescript
// Minimal drag-drop implementation — no new library needed
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  // Validate type and size before starting upload
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) { showError('Max 10 MB'); return; }
    if (!ALLOWED_MIME_TYPES.has(file.type)) { showError('File type not allowed'); return; }
    startUpload(file);
  }
};
```

### Pattern 7: Toast + NumberTicker on Validation

**What:** Inline toast (established pattern from CreateUserDialog and PermissionMatrix). NumberTicker is already installed at `@/components/ui/number-ticker`. Confetti fires via canvas-confetti on task.valid transition.

```typescript
// In the React Query mutation onSuccess handler:
onSuccess: (updatedTask) => {
  if (updatedTask.valid && !wasValidBefore) {
    setToast(`Task validated! +${updatedTask.valid_xp} XP`);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => setToast(null), 4000);
  }
  void queryClient.invalidateQueries({ queryKey: ['tasks', id] });
  void queryClient.invalidateQueries({ queryKey: ['quests', task.quest_id] });
}
```

### Anti-Patterns to Avoid

- **Do not call validateTask() outside a transaction.** The function signature must accept a `Prisma.TransactionClient` (the `tx` parameter). Never call the function with `this.prisma` directly — always wrap in `prisma.$transaction()` at the outermost layer.
- **Do not validate MIME type by file extension only.** Extension is user-controlled. Check `file.type` in browser AND `contentType` on the presign endpoint. Two validation points = no bypass.
- **Do not skip the presign confirmation step.** Evidence record must NOT be created at presign time. It is created after upload completes. If network fails mid-upload, no orphan evidence record exists.
- **Do not allow task owner to approve their own evidence.** Check `evidence.uploaded_by !== reviewerId` in the approve endpoint. Return 403 if same user.
- **Do not recalculate progress with status='done' after Phase 3.** Both `recalculateQuestProgress` and `recalculateMissionProgress` in `tasks.service.ts` are documented with "NOTE: Uses status='done' until Phase 3" — they MUST be updated to use `valid=true` as part of this phase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presigned URL generation | Custom HMAC signing | `@aws-sdk/s3-request-presigner` | AWS SDK handles SigV4 signing, expiry, error edge cases |
| Upload progress tracking | WebSocket or polling | `XMLHttpRequest` upload progress events | Native browser API, no library needed |
| File drag detection | Custom mouse/touch event tracking | Native HTML `dragover` / `drop` events | Already supported; dnd-kit is overkill for this use case |
| MIME type detection | File extension parsing | Browser `file.type` + server content-type validation | Extension is spoofable; MIME type from both sides is the standard approach |
| Atomic cascade | Separate service calls with try/catch | `prisma.$transaction()` interactive transaction | Prisma v6 supports interactive transactions; rollback is automatic on throw |
| XP level thresholds | Dynamic calculation | Inline ternary with spec constants (200/500/1000) | Thresholds are fixed in dev spec §10.4; no library needed |

---

## Common Pitfalls

### Pitfall 1: Cascade Leaves Partial State (CRITICAL)

**What goes wrong:** Evidence is approved, `evidence.approval_status = 'approved'` writes successfully, but then `validateTask` is called outside the transaction. If any downstream write fails (user XP update, quest progress), the DB is in partial state: evidence approved but task still shows `valid=false` and `valid_xp=0`.

**Why it happens:** The `approveEvidence` method writes evidence status first, then calls `validateTask` as a separate operation outside the transaction scope.

**How to avoid:** The `approveEvidence` endpoint must open ONE `prisma.$transaction()` that includes both the evidence status update AND the full validateTask cascade. The `validateTask` method accepts `tx: Prisma.TransactionClient` as its parameter — never call it with the top-level `prisma` client.

**Warning signs:** Tests that check evidence status without checking quest progress after the same operation. Any code path that calls `validateTask` without an outer `$transaction`.

---

### Pitfall 2: Presign Endpoint Does Not Validate File Type/Size

**What goes wrong:** Frontend sends `contentType: 'application/x-executable'` or `contentType: 'video/mp4'` with a filename that's actually a 500MB file. Backend generates a presigned URL. R2 accepts the upload. Storage fills. App performance degrades.

**Why it happens:** Presign is a lightweight endpoint and developers focus on URL generation, not input validation.

**How to avoid:** The presign controller validates `contentType` against an allowlist (see ALLOWED_MIME_TYPES above) and checks the frontend-provided `fileSize` against the 10 MB limit before generating any URL. R2 also supports content-length range enforcement via presigned URL parameters.

**Warning signs:** Presign endpoint does not return 400 for `contentType: 'text/html'`. No `fileSize` parameter accepted by presign endpoint.

---

### Pitfall 3: Task Owner Approves Their Own Evidence

**What goes wrong:** A user uploads evidence and then calls `POST /evidence/:id/approve`. The permissions guard checks `APPROVE_EVIDENCE` — which the user has. Evidence is self-approved, task auto-validates, user earns XP without peer review.

**Why it happens:** Permission check is `APPROVE_EVIDENCE` only, without the "not the uploader" constraint.

**How to avoid:** In the approve endpoint service method: `if (evidence.uploaded_by === reviewerId) throw new ForbiddenException('Cannot approve your own evidence')`. This is a data-level check, not permission-level.

**Warning signs:** No test for the "self-approval" scenario. PITFALLS.md explicitly calls this out: "APPROVE_EVIDENCE must explicitly exclude UPDATE_OWN_TASK holders".

---

### Pitfall 4: Readiness Double-Counting on Validate → Reject → Re-Validate

**What goes wrong:** Task validates → readiness event created (value: 5). Evidence is later rejected → task.valid=false. Evidence is re-uploaded and approved → task.valid=true again. If the idempotency check only looks for `existing event`, it finds the original event and skips. But the original event was not revoked. Alternatively, a new event is created without revoking the old one → meter value is 10 instead of 5.

**Why it happens:** The PITFALLS.md documents this as Pitfall 5. The schema has `revoked_at` on `TaskReadinessEvent` for exactly this reason. But naive implementations check `if existing: return` without accounting for the revoke-and-recreate flow.

**How to avoid:** The `applyReadinessFromTask` function (see Architecture Patterns above) explicitly: (a) when `isValid=false`, revokes active events; (b) when `isValid=true`, checks for existing `revoked_at: null` event before creating. The meter value is always recomputed from scratch from active events.

**Warning signs:** No test for the validate→reject→re-approve sequence. No `revoked_at` being set in the invalidation path.

---

### Pitfall 5: Progress Bars Not Tightened to valid=true

**What goes wrong:** Phase 3 ships evidence and approval UI, but quest/mission progress still counts `status='done'` tasks rather than `valid=true` tasks. Quest shows 100% complete for tasks with no approved evidence.

**Why it happens:** The `recalculateQuestProgress` and `recalculateMissionProgress` methods in `tasks.service.ts` are documented with "NOTE: Uses status='done' until Phase 3" but the Phase 3 developer forgets to update them.

**How to avoid:** These two methods are modified in Phase 3 as an explicit task. Both are extracted into the shared `validateTask` cascade (calling the same tightened logic). The original `tasks.service.ts` methods that fire on status-change updates also need updating or delegation to the tightened version.

**Warning signs:** Quest shows 100% with tasks in `status='done'` but `valid=false`. Progress number does not decrease when evidence is rejected on a previously valid task.

---

### Pitfall 6: R2 CORS Configuration Not Set

**What goes wrong:** Frontend tries to `PUT` directly to R2 presigned URL. Browser sends preflight CORS request. R2 returns CORS error. Upload fails.

**Why it happens:** Cloudflare R2 buckets require explicit CORS policy configuration. Unlike S3, R2 has no default CORS. The presign URL works from server-side fetch, but not from browser.

**How to avoid:** Set R2 CORS policy before testing frontend uploads:
```json
[{
  "AllowedOrigins": ["https://konmaxperience.com", "http://localhost:3000"],
  "AllowedMethods": ["PUT", "GET"],
  "AllowedHeaders": ["Content-Type", "Content-Length"],
  "MaxAgeSeconds": 3600
}]
```
Configure via Cloudflare dashboard (R2 bucket → Settings → CORS) or via Wrangler CLI.

**Warning signs:** Upload works in Postman (server-side) but fails in browser. Browser console shows "CORS error" on PUT to R2 URL.

---

### Pitfall 7: evidence.url Points to Presigned URL (Expires)

**What goes wrong:** After upload, frontend passes the presigned URL directly as `evidence.url` to the `POST /tasks/:id/evidence` endpoint. Presigned URLs expire in 15 minutes. When a reviewer tries to see evidence later, the URL is expired and throws 403.

**Why it happens:** Developer confuses the presigned PUT URL (temporary, for upload) with the permanent public URL (for viewing).

**How to avoid:** The R2 public URL for viewing is different from the presigned PUT URL. Store the permanent URL constructed from `https://{bucket-domain}/{key}`, NOT the presigned URL. The presign response returns both `{ presignedUrl, key }` and the frontend constructs `publicUrl = ${R2_PUBLIC_BASE_URL}/${key}`.

**Warning signs:** Evidence URLs contain `X-Amz-Signature` query parameters. Evidence items show 403 errors after 15 minutes.

---

## Code Examples

Verified patterns from codebase and AWS SDK documentation:

### S3Client configured for Cloudflare R2

```typescript
// backend/src/storage/r2.config.ts
import { S3Client } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
// Note: Do NOT set forcePathStyle — R2 does not require it for presigned URLs
```

### EvidenceModule registration in AppModule

```typescript
// Add to backend/src/app.module.ts imports array:
import { EvidenceModule } from './evidence/evidence.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { StorageModule } from './storage/storage.module';

// AppModule imports: [...existing, EvidenceModule, ApprovalsModule, StorageModule]
```

### NestJS controller for evidence endpoints

```typescript
// backend/src/evidence/evidence.controller.ts
@Controller()
export class EvidenceController {
  // GET /tasks/:id/evidence
  @Get('tasks/:id/evidence')
  @RequiresPermission(Permission.UPLOAD_EVIDENCE) // any user with this perm can view
  async getTaskEvidence(@Param('id') taskId: string) { ... }

  // POST /tasks/:id/evidence (creates record after upload confirmed)
  @Post('tasks/:id/evidence')
  @RequiresPermission(Permission.UPLOAD_EVIDENCE)
  async createEvidence(@Param('id') taskId: string, @Body() dto: CreateEvidenceDto, @Request() req) { ... }

  // POST /evidence/:id/approve
  @Post('evidence/:id/approve')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async approveEvidence(@Param('id') evidenceId: string, @Request() req) { ... }

  // POST /evidence/:id/reject
  @Post('evidence/:id/reject')
  @RequiresPermission(Permission.APPROVE_EVIDENCE)
  async rejectEvidence(@Param('id') evidenceId: string, @Body() dto: ReviewEvidenceDto, @Request() req) { ... }

  // POST /storage/presign
  @Post('storage/presign')
  @RequiresPermission(Permission.UPLOAD_EVIDENCE)
  async presign(@Body() dto: PresignDto, @Request() req) { ... }
}
```

### Frontend types for evidence

```typescript
// frontend/lib/types/evidence.ts
export type EvidenceType = 'photo' | 'doc' | 'video' | 'link' | 'note';
export type EvidenceApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Evidence {
  id: string;
  task_id: string;
  uploaded_by: string;
  uploader?: { id: string; name: string };
  type: EvidenceType;
  url: string;
  notes: string | null;
  approval_status: EvidenceApprovalStatus;
  reviewed_by: string | null;
  reviewer?: { id: string; name: string } | null;
  reviewed_at: string | null;
  created_at: string;
}
```

### Evidence type icons (lucide-react — already installed)

```typescript
import { Image, FileText, Video, Link, FileEdit } from 'lucide-react';

const EVIDENCE_TYPE_ICONS: Record<EvidenceType, React.FC> = {
  photo: Image,
  doc: FileText,
  video: Video,
  link: Link,
  note: FileEdit,
};
```

### Approval queue page query pattern

```typescript
// GET /approvals?status=pending — returns approvals with task/entity context
const { data: approvals } = useQuery({
  queryKey: ['approvals', 'pending'],
  queryFn: () => apiClient.get<Approval[]>('/approvals?status=pending'),
});
```

### Validation checklist display (when task not yet valid)

```typescript
// Checklist of unmet conditions — shown inline on task detail
const conditions = [
  { met: task.status === 'done', label: 'Status is Done' },
  { met: evidence.some(e => e.approval_status === 'approved'), label: 'At least one evidence approved' },
  { met: task.requires_approval
      ? approvals.every(a => a.status === 'approved')
      : true,
    label: 'All required approvals satisfied' },
];
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multipart form upload through server | Presigned URL (browser → R2 direct) | Established pattern 2021+ | No file bytes in NestJS; no memory pressure; R2 with zero egress |
| Manual XP level lookup table | Inline threshold formula | Always simple for 4 levels | No library; 4 thresholds from dev spec §10.4 |
| Status='done' counts progress | valid=true counts progress | Phase 3 (this phase) | Progress is now evidence-backed, not just status-based |
| `aws-sdk` v2 (legacy) | `@aws-sdk/client-s3` v3 (modular) | 2021 | Tree-shakeable; Cloudflare R2 compatible; actively maintained |

**Deprecated/outdated:**
- `aws-sdk` v2 (the non-modular version): replaced by `@aws-sdk/client-s3` v3 — do not install `aws-sdk`
- Multer for file uploads in this context: presigned URL pattern eliminates the need for server-side file handling

---

## Open Questions

1. **R2 CORS configuration ownership**
   - What we know: R2 CORS must be set before browser uploads work
   - What's unclear: Does the user configure R2 bucket, or do we include Wrangler commands?
   - Recommendation: Include a Wave 0 task that sets R2 CORS policy (either via dashboard or `wrangler r2 bucket cors put`). Document required env vars: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

2. **Evidence deletion policy (Claude's discretion)**
   - What we know: Users see rejection reason and can upload replacement evidence
   - What's unclear: Should the original rejected evidence be deleted or remain as history?
   - Recommendation: Soft policy — rejected evidence remains in the list with `rejected` badge for audit trail. Users can add new evidence but cannot delete old. Admin can delete via a future admin action.

3. **Approval queue access control**
   - What we know: `APPROVE_EVIDENCE` permission gates the approve/reject actions
   - What's unclear: Should VIEW_ROLE_SCOPED users see only approvals in their domain, or all pending approvals?
   - Recommendation: Apply `buildScopeFilter` to the approvals queue — scoped users see only evidence for tasks in their domain. Admin sees all. This is consistent with Phase 1's data-layer RBAC pattern.

4. **verified field vs valid field**
   - What we know: Schema has both `verified: Boolean` and `valid: Boolean`. Dev spec §9 says "verified=true" is a condition for validity. The CONTEXT.md says "NO manual verify step — verified=true is set automatically".
   - What's unclear: Is `verified` redundant with `valid`? Or does it serve a different purpose (e.g., admin manual override)?
   - Recommendation: In Phase 3, set `verified=true` atomically with `valid=true` inside validateTask(). They remain as separate fields for potential future use (e.g., admin can manually set verified=false to revoke without rejecting evidence). Keep both but always set them together in the cascade.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 (NestJS default, configured in backend/package.json) |
| Config file | `backend/package.json` "jest" section |
| Quick run command | `cd backend && npm test -- --testPathPattern=evidence` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVID-01 | Presign generates valid R2 URL | unit | `npm test -- --testPathPattern=storage` | Wave 0 |
| EVID-01 | Evidence record created after upload confirmation | unit | `npm test -- --testPathPattern=evidence` | Wave 0 |
| EVID-01 | Link/note type creates evidence without file | unit | `npm test -- --testPathPattern=evidence` | Wave 0 |
| EVID-01 | Invalid MIME type rejected at presign | unit | `npm test -- --testPathPattern=storage` | Wave 0 |
| EVID-01 | File > 10MB rejected at presign | unit | `npm test -- --testPathPattern=storage` | Wave 0 |
| EVID-02 | Owner cannot approve own evidence | unit | `npm test -- --testPathPattern=evidence` | Wave 0 |
| EVID-02 | Approve sets approval_status='approved' + reviewer | unit | `npm test -- --testPathPattern=evidence` | Wave 0 |
| EVID-02 | Reject requires notes, sets status='rejected' | unit | `npm test -- --testPathPattern=evidence` | Wave 0 |
| EVID-03 | Task valid when status=done + approved evidence + approvals satisfied | unit | `npm test -- --testPathPattern=evidence` | Wave 0 |
| EVID-03 | Task NOT valid when missing evidence | unit | `npm test -- --testPathPattern=evidence` | Wave 0 |
| EVID-03 | Task NOT valid when status!=done | unit | `npm test -- --testPathPattern=evidence` | Wave 0 |
| EVID-03 | Validate→reject→re-approve cycle: meter not double-counted | unit | `npm test -- --testPathPattern=evidence` | Wave 0 |
| EVID-03 | Quest progress uses valid=true, not status='done' | unit | `npm test -- --testPathPattern=evidence` | Wave 0 |
| EVID-03 | Full cascade is atomic — transaction rollback on failure | integration | `npm run test:e2e` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && npm test -- --testPathPattern=evidence --passWithNoTests`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/src/evidence/evidence.service.spec.ts` — covers EVID-01, EVID-02, EVID-03
- [ ] `backend/src/storage/storage.service.spec.ts` — covers presign, MIME validation
- [ ] `backend/src/evidence/evidence.module.ts` — module scaffolding
- [ ] R2 environment variables — `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` must be in `.env.example` and `.env`
- [ ] R2 CORS policy must be applied to bucket before frontend upload tests

---

## Sources

### Primary (HIGH confidence)

- `backend/prisma/schema.prisma` — Evidence, Approval, TaskReadinessEvent models with exact field names
- `backend/src/tasks/tasks.service.ts` — recalculateQuestProgress/Mission with "NOTE: Phase 3" markers
- `backend/src/types/permissions.ts` — APPROVE_EVIDENCE, UPLOAD_EVIDENCE, VERIFY_TASK confirmed
- `contextdocs/dev_spec.md` §7.6-7.7, §9, §10.1-10.8, §11.6-11.7 — Evidence/Approval schema, business rules, pseudo-code, API spec
- `.planning/research/PITFALLS.md` — Pitfalls 1 (cascade atomicity), 5 (readiness double-counting), security mistake (self-approval)
- `backend/package.json` — No AWS SDK installed yet; confirmed exact package names needed
- `frontend/package.json` — framer-motion, canvas-confetti, @tanstack/react-query all confirmed installed

### Secondary (MEDIUM confidence)

- npm registry (queried 2026-03-20): `@aws-sdk/client-s3@3.1013.0`, `@aws-sdk/s3-request-presigner@3.1013.0`, `multer@2.1.1`
- `.planning/research/ARCHITECTURE.md` — Presigned URL pattern (Pattern 3), data flow diagram confirmed
- `.planning/research/STACK.md` — Cloudflare R2 as S3-compatible storage confirmed

### Tertiary (LOW confidence — flag for validation)

- Cloudflare R2 CORS configuration: documented as required, exact dashboard path needs verification against current Cloudflare UI
- `@aws-sdk/client-s3` R2 compatibility with `region: 'auto'` and no `forcePathStyle`: confirmed by STACK.md but not independently verified against current R2 docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages confirmed from npm registry; no AWS SDK installed yet so Phase 3 adds it
- Architecture: HIGH — all patterns derived from existing codebase + dev_spec pseudo-code + established PITFALLS.md guidance
- Pitfalls: HIGH — 3 critical pitfalls come from PITFALLS.md (written 2026-03-19); 4 additional phase-specific pitfalls derived from code analysis

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack; R2 API is stable; npm package versions verified)
