---
phase: 1
slug: foundation-authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (NestJS default) + vitest (Next.js) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test:all` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test:all`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01 | integration | `npm run test -- --grep "login"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-02 | unit | `npm run test -- --grep "role"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | AUTH-03 | unit | `npm run test -- --grep "permission"` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | AUTH-04 | integration | `npm run test -- --grep "session"` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | AUTH-05 | integration | `npm run test -- --grep "admin"` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | AUTH-06 | integration | `npm run test -- --grep "filter"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test framework setup (jest for NestJS, vitest for Next.js)
- [ ] Database test fixtures and seed helpers
- [ ] Auth test utilities (login helper, token generation)
- [ ] Shared test configuration

*Will be filled with exact file paths during planning.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Password setup email delivery | AUTH-01 | External email service | Trigger account creation, verify email received in test inbox |
| JWT persistence across browser refresh | AUTH-04 | Browser behavior | Log in, refresh page, verify still authenticated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
