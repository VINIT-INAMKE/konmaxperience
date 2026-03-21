---
phase: 9
slug: kitchen-prep
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=prep-batches\|kds\|waste\|availability\|kitchen-metrics --passWithNoTests` |
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
| KDS full-screen layout | KITCHEN-02 | Browser visual | Toggle full-screen, verify sidebar hidden, columns render |
| KDS elapsed timer color transitions | KITCHEN-02 | Browser visual + time | Wait 10+ min, verify timer turns amber then red |
| KDS new order flash animation | KITCHEN-02 | Browser visual | Place order (Phase 10), verify BorderBeam on new card |
| Prep wizard stock check blocking | KITCHEN-01 | Browser interaction | Try prep with insufficient stock, verify confirm disabled |
| Waste form auto-cost calculation | KITCHEN-04 | Browser + calculation | Log waste, verify cost_impact matches expected |
| Expiry cron auto-waste creation | KITCHEN-06 | Time-dependent | Create batch with short shelf life, wait for cron, verify waste entry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
