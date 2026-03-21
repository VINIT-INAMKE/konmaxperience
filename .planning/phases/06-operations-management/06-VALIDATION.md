---
phase: 6
slug: operations-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=zones\|brands\|channels\|assets --passWithNoTests` |
| **Full suite command** | `cd backend && npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern=zones\|brands\|channels\|assets --passWithNoTests`
- **After every plan wave:** Run `cd backend && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | OPS-01, OPS-02, OPS-03, OPS-04 | unit | `npx jest zones\|brands\|channels\|assets` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/zones/zones.service.spec.ts` — stubs for OPS-01
- [ ] `backend/src/brands/brands.service.spec.ts` — stubs for OPS-02
- [ ] `backend/src/channels/channels.service.spec.ts` — stubs for OPS-03
- [ ] `backend/src/assets/assets.service.spec.ts` — stubs for OPS-04

*Existing jest infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zone status badge colors | OPS-01 | Browser visual | Set zone to each status, verify badge color changes |
| Brand lifecycle progression | OPS-02 | Browser visual | Move brand through all 5 statuses, verify UI updates |
| Asset upload via presigned URL | OPS-04 | Browser + R2 | Upload a file, verify it appears and is accessible |
| Asset status workflow | OPS-04 | Browser visual | Move asset draft → in_review → approved, verify status changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
