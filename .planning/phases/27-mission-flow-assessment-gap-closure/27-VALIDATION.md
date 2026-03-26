---
phase: 27
slug: mission-flow-assessment-gap-closure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.x (NestJS) |
| **Config file** | `backend/package.json` `"jest"` key |
| **Quick run command** | `cd backend && npx jest --testPathPattern=missions --no-coverage` |
| **Full suite command** | `cd backend && npx jest --no-coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern=missions --no-coverage`
- **After every plan wave:** Run `cd backend && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | MC-01 | unit | `npx jest --testPathPattern=missions.service --no-coverage` | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | MC-02 | unit | `npx jest --testPathPattern=missions.service --no-coverage` | ❌ W0 | ⬜ pending |
| 27-01-03 | 01 | 1 | PO-01 | migration | `prisma migrate deploy` | ❌ W0 | ⬜ pending |
| 27-02-01 | 02 | 1 | AF-01 | unit | `npx jest --testPathPattern=activity.service --no-coverage` | ❌ W0 | ⬜ pending |
| 27-02-02 | 02 | 1 | TC-01 | unit | `npx jest --testPathPattern=activity.service --no-coverage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/missions/__tests__/missions.service.spec.ts` — stubs for MC-01, MC-02 (getMissionControl unit tests)
- [ ] `backend/src/activity/__tests__/activity.service.spec.ts` — stubs for AF-01, TC-01 (activity feed + contribution query tests)
- [ ] Migration file for PO linked_task_id FK

*Existing Jest infrastructure covers test runner setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard widget layout | D-08, D-09 | Visual layout verification | Open admin dashboard, verify activity feed and team contribution widgets are positioned correctly |
| Task card badge truncation | D-18 | Visual overflow check | View kanban board with tasks linked to long-named readiness meters |
| Breadcrumb navigation chain | D-20 | Navigation flow verification | Open a task with quest→mission context, verify breadcrumb links navigate correctly |
| Validation toast content | D-21 | Toast timing and content | Approve evidence on a task with readiness_meter_id, verify toast shows meter name + value |
| Today's Focus section | D-13, D-14 | Personalized content | Log in as non-admin with overdue/due-today tasks, verify Today's Focus appears at top |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
