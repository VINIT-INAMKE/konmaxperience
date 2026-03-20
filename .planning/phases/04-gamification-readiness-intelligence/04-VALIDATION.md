---
phase: 4
slug: gamification-readiness-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) / vitest (frontend — if configured) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=readiness\|leaderboard\|kpi --passWithNoTests` |
| **Full suite command** | `cd backend && npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern=readiness\|leaderboard\|kpi --passWithNoTests`
- **After every plan wave:** Run `cd backend && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | INTL-01 | unit | `npx jest readiness` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | INTL-02 | unit | `npx jest readiness` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | INTL-03 | unit | `npx jest leaderboard` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | INTL-04 | unit | `npx jest leaderboard` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | INTL-05 | unit | `npx jest kpi` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/readiness/readiness.service.spec.ts` — stubs for INTL-01, INTL-02
- [ ] `backend/src/leaderboard/leaderboard.service.spec.ts` — stubs for INTL-03, INTL-04
- [ ] `backend/src/kpis/kpis.service.spec.ts` — stubs for INTL-05

*Existing jest infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confetti level-up animation | INTL-03 | Browser visual effect | Trigger level-up in browser, verify confetti fires |
| NumberTicker XP animation | INTL-03 | Browser animation | Approve evidence, verify sidebar XP animates |
| Readiness ring color tiers | INTL-01 | Visual color check | Set meter to <30%, 30-69%, 70%+ — verify green/amber/red |
| Kill switch hides leaderboard | INTL-04 | Browser UI state | Disable toggle, verify /leaderboard shows paused state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
