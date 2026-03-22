---
phase: 2
slug: mission-execution-hierarchy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

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

- [ ] Mission service unit tests
- [ ] Quest service unit tests
- [ ] Task service unit tests with progress calculation
- [ ] Scope filter tests for mission/quest/task data scoping

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kanban drag-and-drop | EXEC-03 | Browser interaction | Drag task between columns, verify status updates |
| Ad-hoc task global shortcut | EXEC-05 | UI interaction | Use global shortcut, verify quest picker and task creation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
