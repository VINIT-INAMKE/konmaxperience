---
phase: 22
slug: recipe-page-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend), vitest (frontend — if configured) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=recipes --no-coverage` |
| **Full suite command** | `cd backend && npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern=recipes --no-coverage`
- **After every plan wave:** Run `cd backend && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| *Populated after planning* | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. Backend jest is configured. Frontend has no test framework — frontend tasks are manual verification only.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop reorder | D-05 | DnD interactions require browser | Drag BOM row, verify sort_order updates |
| Live cost preview updates | D-09 | Requires visual inspection of animation | Edit quantity, verify cost panel updates within 1s |
| Sticky cost panel scroll | D-01 | CSS sticky behavior | Scroll page, verify cost panel stays fixed |
| Status banner transitions | D-12 | Visual state changes | Click Submit/Approve/Reject, verify banner updates |
| beforeunload warning | D-04 | Browser native dialog | Edit field, close tab, verify warning appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
