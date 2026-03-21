---
phase: 5
slug: governance-decision-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=decisions\|governance\|delegations --passWithNoTests` |
| **Full suite command** | `cd backend && npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern=decisions\|governance\|delegations --passWithNoTests`
- **After every plan wave:** Run `cd backend && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | GOVN-01 | unit | `npx jest decisions` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | GOVN-02 | unit | `npx jest governance` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | GOVN-03 | unit | `npx jest delegations` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/decisions/decisions.service.spec.ts` — stubs for GOVN-01
- [ ] `backend/src/governance/governance.service.spec.ts` — stubs for GOVN-02 (override)
- [ ] `backend/src/delegations/delegations.service.spec.ts` — stubs for GOVN-03

*Existing jest infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Decision card locked visual | GOVN-01 | Browser visual (lock icon + disabled state) | Approve a decision, verify card shows lock icon, edit/delete hidden |
| Override reason inline display | GOVN-02 | Browser visual | Override an approval, verify reason text appears on approval card |
| "On behalf of" attribution | GOVN-03 | Browser visual | Create delegation, delegate approves, verify "on behalf of" text |
| Delegation auto-expiry | GOVN-03 | Time-dependent | Set delegation end date in past, verify delegate cannot approve |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
