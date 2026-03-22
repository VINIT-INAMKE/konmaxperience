---
phase: 17
slug: search-preview-and-content-seeding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (backend) + Next.js build (frontend) |
| **Config file** | backend/jest.config.ts, frontend/next.config.ts |
| **Quick run command** | `cd backend && npx jest --testPathPattern guides && cd ../frontend && npx tsc --noEmit` |
| **Full suite command** | `cd backend && npx jest && cd ../frontend && npx next build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | READ-03 | build+test | `npx jest guides && npx tsc --noEmit` | N/A | ⬜ pending |
| TBD | TBD | TBD | READ-04 | build | `npx tsc --noEmit` | N/A | ⬜ pending |
| TBD | TBD | TBD | SEED-01 | seed | `npx prisma db seed` | N/A | ⬜ pending |
| TBD | TBD | TBD | SEED-02 | seed | `npx prisma db seed` | N/A | ⬜ pending |
| TBD | TBD | TBD | SEED-03 | seed | `npx prisma db seed` | N/A | ⬜ pending |
| TBD | TBD | TBD | SEED-04 | build | `npx tsc --noEmit` | N/A | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `npx shadcn add command` in frontend (installs cmdk)
- [ ] Existing jest + Next.js build infrastructure covers all other needs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cmd+K search overlay opens and returns results | READ-03 | Visual + UX interaction | Press Cmd+K, type query, verify results with snippets |
| Search results filtered by role | READ-03 | Role-specific JWT | Login as different roles, search same term, verify different results |
| Admin preview-as-role dropdown filters sections | READ-04 | Visual state change | Select role from dropdown, verify section grid changes |
| Seeded content is accurate and complete | SEED-01/02 | Content quality | Read through seeded pages, verify accuracy against actual features |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
