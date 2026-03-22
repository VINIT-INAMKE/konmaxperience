---
phase: 7
slug: recipe-ingredient-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=recipes\|ingredients\|vendors\|menu\|cost --passWithNoTests` |
| **Full suite command** | `cd backend && npx jest` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern=recipes\|ingredients\|vendors\|menu\|cost --passWithNoTests`
- **After every plan wave:** Run `cd backend && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | RECIPE-01,02,03,04 | unit | `npx jest recipes\|ingredients` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | RECIPE-05,06 | unit | `npx jest vendors\|cost` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | RECIPE-07 | unit | `npx jest menu` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/recipes/recipes.service.spec.ts` — stubs for RECIPE-01, RECIPE-02
- [ ] `backend/src/ingredients/ingredients.service.spec.ts` — stubs for RECIPE-03
- [ ] `backend/src/vendors/vendors.service.spec.ts` — stubs for RECIPE-05
- [ ] `backend/src/recipes/cost-calculator.service.spec.ts` — stubs for RECIPE-06
- [ ] `backend/src/menu/menu.service.spec.ts` — stubs for RECIPE-07

*Existing jest infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recipe wizard step navigation | RECIPE-01 | Browser multi-step form | Create recipe via wizard, verify steps 1→2→3, back navigation preserves state |
| BOM combobox switches ingredient/recipe | RECIPE-02 | Browser interaction | Toggle type selector, verify combobox options change |
| Dependency tree visualization | RECIPE-02 | Browser visual | Create chained recipes (A→B→C), verify tree renders on detail page |
| Food cost % color coding on menu items | RECIPE-07 | Browser visual | Create menu items with varying costs, verify green/amber/red thresholds |
| Channel modifier price display | RECIPE-07 | Browser visual | Set channel modifiers, verify adjusted prices show correctly |
| Recursive cost calculation accuracy | RECIPE-06 | Manual calculation check | Create 3-level recipe chain, manually verify computed_cost matches expected |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
