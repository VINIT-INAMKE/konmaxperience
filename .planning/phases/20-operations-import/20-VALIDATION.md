---
phase: 20
slug: operations-import
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) / vitest (frontend) |
| **Config file** | backend/jest.config.ts, frontend/vitest.config.ts |
| **Quick run command** | `cd backend && npx jest --passWithNoTests --testPathPattern=import` |
| **Full suite command** | `cd backend && npx jest --passWithNoTests && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --passWithNoTests --testPathPattern=import`
- **After every plan wave:** Run `cd backend && npx jest --passWithNoTests && cd ../frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Description | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD — populated after plans are created | TBD | TBD | TBD | pending |

*Status: pending / green / red / flaky*

*Note: This table will be populated by the planner after plans are created, matching actual task IDs.*

---

## Wave 0 Requirements

- [ ] `backend/src/imports/validators/__tests__/` — test stubs for all new validators
- [ ] Existing jest/vitest infrastructure covers framework needs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-drop upload with recipe XLSX | SC-2 | Browser drag events + multi-sheet preview | Upload 3-sheet recipe XLSX, verify grouped preview renders |
| Tiered import index with prerequisite warnings | SC-5 | Visual layout + dynamic warning banners | Navigate to /admin/import, verify tier sections and warning badges |
| Stock additive warning banner | SC-1 | Visual amber banner behavior | Navigate to stock import, verify amber warning appears |
| Inline cell editing on new entity types | SC-4 | Interactive browser behavior | Edit a cell in preview table, verify validation updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
