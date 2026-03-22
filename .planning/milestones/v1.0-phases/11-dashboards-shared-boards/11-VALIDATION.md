---
phase: 11
slug: dashboards-shared-boards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend), vitest (frontend if configured) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=analytics --no-coverage` |
| **Full suite command** | `cd backend && npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern=analytics --no-coverage`
- **After every plan wave:** Run `cd backend && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | DASH-05 | unit | `npx jest analytics.service` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | DASH-01 | unit | `npx jest analytics.controller` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | DASH-01, DASH-02 | manual | Browser: /dashboard admin vs role | N/A | ⬜ pending |
| 11-03-01 | 03 | 2 | DASH-03 | manual | Browser: /operations/kitchen/dashboard | N/A | ⬜ pending |
| 11-04-01 | 04 | 2 | DASH-04 | manual | Browser: /operations/inventory/dashboard | N/A | ⬜ pending |
| 11-05-01 | 05 | 2 | DASH-05 | manual | Browser: /intelligence/analytics | N/A | ⬜ pending |
| 11-06-01 | 06 | 3 | DASH-06 | manual | Browser: /boards/* | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/analytics/analytics.service.spec.ts` — stubs for DASH-05 BI analytics
- [ ] `backend/src/analytics/analytics.controller.spec.ts` — stubs for endpoint tests

*Existing test infrastructure covers backend. Frontend pages are manual verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin sees mission control widgets | DASH-01 | UI rendering, role-conditional | Login as admin, verify approvals/blockers/decisions/ad-hoc widgets visible |
| Role user sees personal dashboard | DASH-02 | UI rendering, role-conditional | Login as non-admin, verify my tasks/quests/XP visible, admin widgets hidden |
| Kitchen dashboard metrics display | DASH-03 | Visual chart rendering | Navigate to /operations/kitchen/dashboard, verify 6 metric cards |
| Inventory dashboard charts | DASH-04 | Visual chart rendering | Navigate to /operations/inventory/dashboard, verify stock + PO charts |
| BI charts render correctly | DASH-05 | Recharts rendering, date range | Navigate to /intelligence/analytics, toggle date ranges, verify line chart + donut |
| Shared boards render | DASH-06 | Kanban + timeline + feed rendering | Navigate to /boards/*, verify mission grid, quest kanban, wins timeline, evidence feed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
