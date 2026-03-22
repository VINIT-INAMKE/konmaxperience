---
phase: 12
slug: notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) |
| **Config file** | `backend/jest.config.ts` |
| **Quick run command** | `cd backend && npx jest --testPathPattern=notification --no-coverage` |
| **Full suite command** | `cd backend && npx jest --no-coverage` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern=notification --no-coverage`
- **After every plan wave:** Run `cd backend && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | NOTF-01-07 | unit | `npx jest notification` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | NOTF-01-04 | unit | `npx jest notification-cron` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | NOTF-05-07 | unit | `npx jest notification-listener` | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 2 | All | manual | Browser: bell icon, panel, /notifications | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/notifications/notifications.service.spec.ts` — stubs for core notification CRUD + deduplication
- [ ] `backend/src/notifications/notification-cron.service.spec.ts` — stubs for cron trigger tests

*Existing test infrastructure covers backend. Frontend pages are manual verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bell icon shows unread count | All | UI rendering | Login, verify bell badge updates with 30s polling |
| Notification panel dropdown | All | UI interaction | Click bell, verify panel opens with notifications |
| Click notification navigates | All | Navigation | Click a notification, verify deep link works |
| /notifications page filters | All | UI rendering | Navigate to /notifications, test type/read/date filters |
| Email delivery for critical | NOTF-01-04 | External service | Trigger critical event, verify MailerSend email received |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
