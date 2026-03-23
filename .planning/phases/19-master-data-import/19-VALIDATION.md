---
phase: 19
slug: master-data-import
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) / vitest (frontend) |
| **Config file** | backend/jest.config.ts, frontend/vitest.config.ts |
| **Quick run command** | `cd backend && npx jest --passWithNoTests --testPathPattern=import` |
| **Full suite command** | `cd backend && npx jest --passWithNoTests && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --passWithNoTests --testPathPattern=import`
- **After every plan wave:** Run `cd backend && npx jest --passWithNoTests && cd ../frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | SC-1 | unit+integration | `npx jest --testPathPattern=import` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | SC-2 | unit+integration | `npx jest --testPathPattern=import` | ❌ W0 | ⬜ pending |
| 19-01-03 | 01 | 1 | SC-3 | unit+integration | `npx jest --testPathPattern=import` | ❌ W0 | ⬜ pending |
| 19-01-04 | 01 | 1 | SC-4,5 | unit | `npx jest --testPathPattern=import` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 1 | SC-6 | unit | `npx jest --testPathPattern=export` | ❌ W0 | ⬜ pending |
| 19-03-01 | 03 | 1 | SC-7 | unit | `npx jest --testPathPattern=timezone` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/imports/imports.service.spec.ts` — stubs for import service tests
- [ ] `backend/src/imports/imports.controller.spec.ts` — stubs for controller upload tests
- [ ] `frontend/src/app/admin/import/__tests__/` — stubs for import UI tests

*Existing jest/vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-drop file upload UX | SC-1 | Browser drag events not testable in jsdom | Upload file via drag-drop, verify preview table renders |
| ExportButton placement on pages | SC-6 | Visual placement verification | Navigate to missions, readiness, tasks pages — confirm ExportButton visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
