---
phase: 14
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | backend/jest.config.ts |
| **Quick run command** | `cd backend && npx jest --testPathPattern guides` |
| **Full suite command** | `cd backend && npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern guides`
- **After every plan wave:** Run `cd backend && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | GUIDE-01 | unit | `npx jest --testPathPattern guides.service` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GUIDE-02 | unit | `npx jest --testPathPattern guides.service` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GUIDE-03 | unit | `npx jest --testPathPattern guides.service` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GUIDE-04 | unit | `npx jest --testPathPattern guides.service` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | GUIDE-05 | unit | `npx jest --testPathPattern guides.service` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EDIT-04 | unit | `npx jest --testPathPattern guides.service` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/guides/__tests__/guides.service.spec.ts` — stubs for GUIDE-01 through GUIDE-05, EDIT-04
- [ ] Existing jest infrastructure covers framework needs

*Existing infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Presigned URL generates valid R2 upload target | EDIT-04 (image support) | Requires R2 credentials | POST /storage/presign-guide, verify URL format |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
