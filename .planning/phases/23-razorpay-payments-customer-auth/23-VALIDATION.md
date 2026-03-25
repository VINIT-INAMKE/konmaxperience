---
phase: 23
slug: razorpay-payments-customer-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern="(customer-auth|razorpay|payment)" --no-coverage` |
| **Full suite command** | `cd backend && npx jest --no-coverage` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern="(customer-auth|razorpay|payment)" --no-coverage`
- **After every plan wave:** Run `cd backend && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| *Populated after planning* | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing jest infrastructure covers backend. No new test framework needed.
- Frontend components are manual verification (no frontend test framework configured).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Razorpay modal opens | D-06 | Third-party JS modal | Click pay button, verify Razorpay modal appears with correct amount |
| WhatsApp OTP received | D-02 | External service delivery | Request OTP, verify WhatsApp message arrives with 6-digit code |
| Payment capture end-to-end | D-09 | Requires Razorpay test mode | Complete payment in test mode, verify signature verification + booking creation |
| Customer JWT cookie set | D-03/D-04 | Browser cookie inspection | Login, verify customer_access_token cookie with 30-day expiry |
| Webhook signature verification | D-10 | Requires Razorpay webhook trigger | Use Razorpay dashboard test webhook, verify signature passes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
