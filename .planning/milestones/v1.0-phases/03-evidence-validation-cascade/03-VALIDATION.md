---
phase: 3
slug: evidence-validation-cascade
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (NestJS backend) |
| **Config file** | backend/jest config in package.json |
| **Quick run command** | `cd backend && npx jest --passWithNoTests --forceExit` |
| **Full suite command** | `cd backend && npx jest --forceExit && cd ../frontend && npx tsc --noEmit` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

*Will be populated during planning with exact task IDs and test files.*

---

## Wave 0 Requirements

- [ ] R2 bucket CORS configuration (must be done before frontend upload testing)
- [ ] Evidence service unit tests (validateTask cascade, XP calculation)
- [ ] Approval service unit tests (approve/reject flow)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop file upload | EVID-01 | Browser drag interaction | Drag file onto upload zone, verify upload progress and completion |
| Presigned URL upload to R2 | EVID-01 | External service | Upload file, verify it appears in R2 bucket |
| Toast + animation on validation | EVID-03 | Visual animation | Approve evidence, verify toast "Task validated! +XP" appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
