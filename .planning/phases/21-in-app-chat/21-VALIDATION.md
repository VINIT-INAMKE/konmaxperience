---
phase: 21
slug: in-app-chat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (backend) + Next.js build (frontend) |
| **Config file** | backend/jest.config.ts, frontend/next.config.ts |
| **Quick run command** | `cd backend && npx jest --testPathPattern chat && cd ../frontend && npx tsc --noEmit` |
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

TBD — populated during planning.

---

## Wave 0 Requirements

- [ ] `npm install pusher` in backend (server SDK)
- [ ] `npm install pusher-js` in frontend (client SDK)
- [ ] Pusher app created in dashboard with client events enabled
- [ ] Existing jest + Next.js build infrastructure covers all other needs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time message delivery | Chat-01 | Requires Pusher connection | Open /chat in two browser tabs, send message, verify instant delivery |
| Typing indicator | Chat-02 | Real-time UX | Start typing in one tab, verify "typing..." in other tab |
| Read receipts | Chat-03 | Visual indicator | Send message, open in recipient tab, verify double-check |
| Admin oversight | Chat-04 | Role-based access | Login as admin, verify "All Conversations" tab shows all chats |
| File/image upload | Chat-05 | R2 integration | Attach image in message, verify upload and display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
