---
phase: 24
slug: customer-marketplace
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern="(cart\|customer-order\|marketplace)" --no-coverage` |
| **Full suite command** | `cd backend && npx jest --no-coverage` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| *Populated after planning* | | | | | | | |

---

## Wave 0 Requirements

- Existing jest infrastructure covers backend
- Frontend components are manual verification only (no test framework)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Swiggy-style menu + cart | D-06, D-07 | Visual interaction | Browse /menu, add items, verify floating cart bar, expand sheet |
| Google Places autocomplete | D-15 | External API + browser | Type address, verify autocomplete suggestions, pincode extraction |
| Razorpay checkout from cart | D-09, D-10 | Third-party modal | Complete full checkout with test card |
| Pusher real-time tracking | D-11, D-13 | Two-device real-time | Place order, update status from KDS, verify timeline updates on customer device |
| Receipt print layout | D-17 | Browser print dialog | Open receipt URL, verify print preview looks correct |
| Re-order flow | D-20 | Multi-step interaction | Click "Order again" on past order, verify items added to cart |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
