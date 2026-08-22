---
phase: 28
slug: recipe-preparation-type-support-scratch-ready-to-sell-assemble-routing-for-pre-made-food-products
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-27
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend), tsc --noEmit (frontend) |
| **Config file** | backend/jest.config.ts, frontend/tsconfig.json |
| **Quick run command** | `cd backend && npm run build` |
| **Full suite command** | `cd backend && npm run build && cd ../frontend && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npm run build`
- **After every plan wave:** Run full suite (backend build + frontend tsc)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 28-01-01 | 01 | 1 | R28-01, R28-05, R28-09, R28-10 | build + migration | `cd backend && npm run build` | pending |
| 28-01-02 | 01 | 1 | R28-11 | build | `cd backend && npm run build` | pending |
| 28-02-01 | 02 | 2 | R28-02, R28-10 | build + grep | `cd backend && npm run build` | pending |
| 28-02-02 | 02 | 2 | R28-03, R28-04, R28-05 | build + grep | `cd backend && npm run build` | pending |
| 28-03-01 | 03 | 2 | R28-06, R28-07, R28-08, R28-13, R28-14 | build | `cd backend && npm run build` | pending |
| 28-03-02 | 03 | 2 | R28-06 | build + grep | `cd backend && npm run build` | pending |
| 28-04-01 | 04 | 3 | R28-08, R28-12, R28-13 | tsc | `cd frontend && npx tsc --noEmit` | pending |
| 28-04-02 | 04 | 3 | R28-14, R28-15 | tsc | `cd frontend && npx tsc --noEmit` | pending |
| 28-05-01 | 05 | 4 | R28-07, R28-08, R28-15 | tsc | `cd frontend && npx tsc --noEmit` | pending |
| 28-05-02 | 05 | 4 | visual | manual checkpoint | Human verification | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or fixture setup needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pick & Pack page renders order items correctly | R28-07 | Visual UI | Open /operations/kitchen/pick-pack, verify non-scratch order items appear with correct badges |
| Supply Usage form logs usage correctly | R28-08 | Visual + data | Log a supply usage, verify StockMovement created with movement_type='supply_usage' |
| Recipe form shows preparation_type selector | R28-12 | Visual UI | Create new recipe, verify radio group appears with 4 options |
| Ingredient form shows usage_type selector | R28-13 | Visual UI | Create new ingredient, verify usage_type dropdown with 3 options |
| KDS only shows scratch items | R28-05 | Visual UI | Place mixed order, verify only scratch items appear on KDS |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual checkpoint
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-27
