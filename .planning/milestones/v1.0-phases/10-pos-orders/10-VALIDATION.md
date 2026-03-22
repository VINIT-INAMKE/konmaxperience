---
phase: 10
slug: pos-orders
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=orders\|pos\|delivery --passWithNoTests` |
| **Full suite command** | `cd backend && npx jest` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| POS split screen layout | POS-01 | Browser visual | Verify menu left 2/3, cart right 1/3, responsive |
| Full-screen POS toggle | POS-01 | Browser visual | Toggle full screen, verify sidebar hidden |
| Servings-remaining badge | POS-02 | Browser visual | Check availability badges update, sold-out grays out |
| KDS deduction on mark ready | POS-04 | End-to-end | Place order → mark item ready on KDS → verify stock decremented |
| Payment recording after service | POS-05 | Browser interaction | Serve order → record payment → verify payment status |
| Delivery dispatch status flow | POS-03 | Browser interaction | Place delivery order → assign → picked_up → in_transit → delivered |
| Order history daily summary | POS-06 | Browser visual | Verify total orders, revenue, avg order value cards |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
