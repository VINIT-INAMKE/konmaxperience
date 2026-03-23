---
phase: 18
slug: data-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (backend) + Next.js build (frontend) |
| **Config file** | backend/jest.config.ts, frontend/next.config.ts |
| **Quick run command** | `cd backend && npx jest --testPathPattern exports && cd ../frontend && npx tsc --noEmit` |
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

TBD — populated during planning based on plan structure.

---

## Wave 0 Requirements

- [ ] `npm install exceljs` in backend
- [ ] Existing jest + Next.js build infrastructure covers all other needs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| XLSX file opens correctly in Excel/Google Sheets | Export quality | File format validation | Download an XLSX export, open in spreadsheet app, verify formatting |
| CSV file parseable by standard tools | Export quality | File format validation | Download a CSV export, open in spreadsheet app, verify columns |
| R2 download URL works and file persists | Export pipeline | R2 integration | Generate export, wait 1min, re-download from history |
| Export history shows all past exports | Admin page | Visual verification | Generate 3 exports, check admin page shows all with correct metadata |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
