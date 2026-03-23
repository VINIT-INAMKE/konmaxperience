---
phase: 19
slug: master-data-import
status: draft
nyquist_compliant: true
wave_0_complete: true
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

| Task ID | Plan | Wave | Description | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-T1 | 01 | 1 | Missions/Quests export builders + findAllForExport | type-check | `cd backend && npx tsc --noEmit` | n/a | pending |
| 19-01-T2 | 01 | 1 | ExportButton on 5 pages + frontend type updates | type-check | `cd frontend && npx tsc --noEmit` | n/a | pending |
| 19-02-T0 | 02 | 1 | Test stubs for imports service and controller | unit | `cd backend && npx jest --passWithNoTests --testPathPattern=imports` | W0 task | pending |
| 19-02-T1 | 02 | 1 | Import types, parsers, validators | type-check + unit | `cd backend && npx tsc --noEmit` | via T0 | pending |
| 19-02-T2 | 02 | 1 | ImportsModule, controller, service, templates | type-check + unit | `cd backend && npx jest --passWithNoTests --testPathPattern=imports` | via T0 | pending |
| 19-03-T1 | 03 | 2 | Import types, index page, sidebar nav | type-check | `cd frontend && npx tsc --noEmit` | n/a | pending |
| 19-03-T2 | 03 | 2 | Import type page with full upload/preview/commit flow | type-check | `cd frontend && npx tsc --noEmit` | n/a | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `backend/src/imports/imports.service.spec.ts` — created by Plan 02, Task 0
- [x] `backend/src/imports/imports.controller.spec.ts` — created by Plan 02, Task 0

*Existing jest/vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-drop file upload UX | D-01 | Browser drag events not testable in jsdom | Upload file via drag-drop, verify preview table renders |
| ExportButton placement on pages | D-24, D-25 | Visual placement verification | Navigate to missions, quests/[id], decisions pages — confirm ExportButton visible |
| Inline cell editing in preview | D-03, D-16 | Interactive UI behavior | Click cell in preview table, edit value, press Enter, verify re-validation |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 02 Task 0 creates stubs)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
