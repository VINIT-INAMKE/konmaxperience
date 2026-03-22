---
phase: 13
slug: customer-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern="feedback|events" --no-coverage` |
| **Full suite command** | `cd backend && npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Public feedback form submits without auth | CUST-01 | Public route, no JWT | Open /feedback/[orderId] in incognito, submit rating |
| QR code generates valid URL | CUST-01 | Visual verification | Call GET /orders/:id/qr, scan resulting QR |
| Event booking enforces capacity | CUST-02 | Race condition edge case | Book until full, verify rejection on overflow |
| Public menu shows availability | CUST-03 | Visual rendering | Open /menu, verify Available/Sold Out badges match POS |
| Light theme on public pages | All | Visual | Open any public page, verify light theme not dark |
| Responsive on mobile viewport | All | Visual | Open public pages on 375px viewport |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
