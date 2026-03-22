---
phase: 16
slug: admin-cms
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Next.js dev server + TypeScript compiler |
| **Config file** | frontend/next.config.ts |
| **Quick run command** | `cd frontend && npx tsc --noEmit` |
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
| TBD | TBD | TBD | EDIT-01 | build | `npx tsc --noEmit` | N/A | ⬜ pending |
| TBD | TBD | TBD | EDIT-02 | build | `npx tsc --noEmit` | N/A | ⬜ pending |
| TBD | TBD | TBD | EDIT-03 | build | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing Tiptap packages already installed (confirmed by research)
- [ ] Existing Next.js build infrastructure covers framework needs

*Existing infrastructure covers all requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tiptap editor renders with toolbar and accepts rich text input | EDIT-01 | Visual editor interaction | Open /admin/guide/pages/[id], type text, use toolbar for headings/bold/lists |
| Image upload shows inline placeholder with progress | EDIT-02 | Upload UX with R2 | Drag an image onto editor, verify placeholder + progress + final render |
| Callout blocks insert via toolbar with correct styling | EDIT-03 | Visual component | Click callout button, select tip/warning/info, verify styled container |
| Autosave triggers and shows "Saved" indicator | EDIT-01 | Timing behavior | Edit content, wait 5s, verify "Saved" appears without manual save |
| Publish button changes page visibility | EDIT-01 | State transition | Publish a draft page, verify it appears in reader view for assigned roles |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
