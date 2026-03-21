---
phase: 05-governance-decision-management
plan: "03"
subsystem: frontend/approvals
tags: [override, approval, admin, modal, animation]
dependency_graph:
  requires: ["05-01"]
  provides: ["OverrideDialog", "ApprovalItem override UI"]
  affects: ["frontend/components/ops/approvals"]
tech_stack:
  added: []
  patterns:
    - BorderBeam on focused textarea (seriousness signal)
    - CoolMode wrapping ShimmerButton for particle effect on decisive submit
    - PulsatingButton (amber) for time-sensitive admin actions (>24h pending)
    - evidenceId passed to override endpoint (backend resolves Approval internally)
key_files:
  created:
    - frontend/components/ops/approvals/OverrideDialog.tsx
  modified:
    - frontend/components/ops/approvals/ApprovalItem.tsx
decisions:
  - "[05-03]: BorderBeam shown only when textarea is focused (isFocused state) — avoids permanent animation distraction"
  - "[05-03]: Override button placed inside actionButtons div for consistent Row 3 layout — vertical separator (w-px h-4 bg-border) provides visual separation from approve/reject"
  - "[05-03]: OverrideDialog rendered conditionally (isAdmin guard) to avoid unnecessary DOM for non-admin users"
metrics:
  duration: "~2 min"
  completed: "2026-03-21"
  tasks_completed: 2
  files_changed: 2
---

# Phase 05 Plan 03: Override Dialog and ApprovalItem Attribution Summary

Admin-only override UI for approval queue: OverrideDialog with mandatory reason textarea (BorderBeam on focus, CoolMode on submit) plus ApprovalItem modified with override button (pulsating amber when pending >24h) and inline override/delegation attribution display.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | OverrideDialog component | f370c73 | frontend/components/ops/approvals/OverrideDialog.tsx |
| 2 | ApprovalItem override button and attribution | d79aac0 | frontend/components/ops/approvals/ApprovalItem.tsx |

## What Was Built

**OverrideDialog** (`frontend/components/ops/approvals/OverrideDialog.tsx`):
- shadcn Dialog with "Override Approval" title (20px semibold) and audit trail description
- Reason Textarea with `min-h-[80px]`, `aria-required="true"`, `aria-describedby` on validation error
- BorderBeam activates on textarea focus via `isFocused` state — signals gravity of the field
- Inline validation: "Reason is required (minimum 10 characters)." shown after first failed submit attempt
- CoolMode wraps ShimmerButton "Override and Approve" (`shimmerColor="#4ade80"`)
- Submit disabled when `reason.trim().length < 10` or while submitting (Loader2 + "Overriding...")
- Ghost Button "Keep Waiting" as cancel
- On success: `toast.success('Approval overridden. Validation cascade triggered.')` + `onOverridden()` callback
- On error: `toast.error('Override failed. Try again or check permissions.')` + dialog stays open
- Posts to `apiClient.post('/approvals/${evidenceId}/override', { reason })` — evidence ID per Plan 01 architecture

**ApprovalItem** (`frontend/components/ops/approvals/ApprovalItem.tsx`):
- Imports `useAuthStore`, `RoleCode`, `OverrideDialog`, `AlertCircle`
- `isAdmin` computed from `user?.roleCode === RoleCode.FOUNDER_ADMIN`
- `overrideDialogOpen` state added alongside existing `rejectDialogOpen`
- Admin override button added inside `actionButtons` div after approve/reject:
  - Vertical separator `w-px h-4 bg-border` separates from existing buttons
  - `PulsatingButton` (pulseColor `#f59e0b`) when `isPendingLong` (>24h)
  - `InteractiveHoverButton` (amber border) when not pending long
- Override attribution row rendered when `evidence.override_reason` present:
  - AlertCircle (size-3, text-amber-400) + italic "Overridden by [name] — [reason]"
  - Relative timestamp pushed right when `override_at` present
- Delegation attribution row rendered when `delegated_from_user_id && delegated_from_user`:
  - "Approved by [reviewer] (on behalf of [from_user])"
- `ApprovalEvidence` interface extended with `override_by`, `override_reason`, `override_at`, `overrider`, `delegated_from_user_id`, `delegated_from_user` fields
- OverrideDialog rendered at end of component, guarded by `isAdmin`

## Decisions Made

1. BorderBeam shown only on focus (not permanently) — avoids visual distraction when textarea is idle; signals active input seriousness
2. Override button placed inside `actionButtons` div (not after it) — keeps Row 3 as a single unified flex container; vertical separator provides clean visual boundary
3. `OverrideDialog` conditionally rendered (`{isAdmin && ...}`) — avoids DOM overhead for non-admin users who will never trigger the dialog

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all fields (override_reason, override_at, overrider, delegated_from_user) are wired to live API data from the approval queue endpoint. Attribution rows only render when data is present.

## Self-Check

- FOUND: frontend/components/ops/approvals/OverrideDialog.tsx
- FOUND: frontend/components/ops/approvals/ApprovalItem.tsx
- FOUND commit f370c73 (Task 1)
- FOUND commit d79aac0 (Task 2)

## Self-Check: PASSED
