---
phase: 8
slug: inventory-procurement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=inventory\|procurement\|purchase --passWithNoTests` |
| **Full suite command** | `cd backend && npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern=inventory\|procurement\|purchase --passWithNoTests`
- **After every plan wave:** Run `cd backend && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | INV-01, INV-02, INV-03 | unit | `npx jest inventory\|purchase` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | INV-04 | unit | `npx jest procurement` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/inventory/inventory.service.spec.ts` — stubs for INV-01, INV-02
- [ ] `backend/src/purchase-orders/purchase-orders.service.spec.ts` — stubs for INV-03

*Existing jest infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Low-stock badge on ingredient rows | INV-01 | Browser visual | Set ingredient stock below min_stock_level, verify red badge appears |
| Low-stock alert on dashboard | INV-01 | Browser visual | Verify dashboard shows low-stock warning section when items are below threshold |
| PO receiving stock update | INV-03 | End-to-end flow | Create PO, mark ordered, fill received_qty, mark received — verify stock levels updated |
| Stock movement audit trail | INV-02 | Browser visual | After receiving, check inventory detail for movement entries |
| Procurement dashboard cards | INV-04 | Browser visual | Verify pending POs count, low stock count, vendor spend, inventory value display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
