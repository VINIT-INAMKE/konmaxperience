---
phase: 15
slug: reader-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Next.js dev server + browser verification |
| **Config file** | frontend/next.config.ts |
| **Quick run command** | `cd frontend && npx next build` |
| **Full suite command** | `cd frontend && npx next build && cd ../backend && npx jest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx tsc --noEmit`
- **After every plan wave:** Run `cd frontend && npx next build`
- **Before `/gsd:verify-work`:** Full build must succeed
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | READ-01 | build | `npx next build` | N/A | ⬜ pending |
| TBD | TBD | TBD | READ-02 | build | `npx next build` | N/A | ⬜ pending |
| TBD | TBD | TBD | READ-05 | build | `npx next build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-image isomorphic-dompurify @tailwindcss/typography` in frontend
- [ ] Register `@tailwindcss/typography` plugin in globals.css
- [ ] Existing Next.js build infrastructure covers framework needs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Role-filtered sections visible only to correct roles | READ-01 | Requires seeded data + role-specific JWT | Login as different roles, verify section visibility |
| Tiptap content renders with correct styling | READ-02 | Visual rendering quality | Open guide page, check headings, lists, images render correctly |
| Sidebar navigation works across pages | READ-05 | UX interaction flow | Click through sidebar, verify active states and navigation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
