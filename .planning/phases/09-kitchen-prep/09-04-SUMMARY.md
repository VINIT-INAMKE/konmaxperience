---
phase: 09-kitchen-prep
plan: 04
subsystem: ui
tags: [react, next.js, kitchen, prep-batches, wizard, sidebar, countdown]

requires:
  - phase: 09-02
    provides: Kitchen backend API modules (prep-batches, prep-batches/preview endpoints)
  - phase: 09-01
    provides: Kitchen TypeScript types (PrepBatch, DeductionPreviewLine, PrepBatchStatus)
provides:
  - Prep Batches page at /operations/kitchen/prep-batches with FIFO-ordered table
  - 3-step PrepBatchWizard with deduction preview and stock validation
  - Kitchen sidebar nav section with Prep Batches, KDS, and Waste Log links
  - PrepBatchStatusBadge component (active/depleted/expired)
  - ExpiresInCountdown component with amber/red color thresholds
affects: [09-05-kds-waste-frontend, phase-10-pos]

tech-stack:
  added: []
  patterns: [wizard-in-sheet-with-hoisted-state, expiry-countdown-with-color-thresholds, tooltip-on-disabled-button-without-asChild]

key-files:
  created:
    - frontend/app/(ops)/operations/kitchen/prep-batches/page.tsx
    - frontend/components/ops/kitchen/prep-batches/PrepBatchList.tsx
    - frontend/components/ops/kitchen/prep-batches/PrepBatchRow.tsx
    - frontend/components/ops/kitchen/prep-batches/PrepBatchWizard.tsx
    - frontend/components/ops/kitchen/prep-batches/PrepBatchWizardStep1.tsx
    - frontend/components/ops/kitchen/prep-batches/PrepBatchWizardStep2.tsx
    - frontend/components/ops/kitchen/prep-batches/PrepBatchWizardStep3.tsx
    - frontend/components/ops/kitchen/prep-batches/PrepBatchStatusBadge.tsx
    - frontend/components/ops/kitchen/prep-batches/ExpiresInCountdown.tsx
  modified:
    - frontend/components/ops/Sidebar.tsx

key-decisions:
  - "TooltipTrigger renders directly without asChild per Phase 03-03 decision -- disabled button shows tooltip by rendering TooltipTrigger as styled span"
  - "Wizard step circles use 32px (w-8 h-8) per UI-SPEC spacing scale"
  - "ExpiresInCountdown updates every 60s via setInterval (not every second) since prep batch expiry does not need second precision"

patterns-established:
  - "Disabled-button-tooltip pattern: render TooltipTrigger directly as styled element matching button appearance when button is disabled"
  - "Kitchen nav section pattern: kitchenNav array between operationsNav and adminNav in Sidebar"

requirements-completed: [KITCHEN-01, KITCHEN-06]

duration: 5min
completed: 2026-03-21
---

# Phase 9 Plan 4: Prep Batches Frontend Summary

**Prep Batches page with FIFO-ordered table, 3-step creation wizard with deduction preview and stock validation, and Kitchen sidebar navigation section**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T13:56:38Z
- **Completed:** 2026-03-21T14:02:36Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Kitchen sidebar section with Prep Batches, KDS, and Waste Log nav items between Operations and Admin
- Prep Batches page at /operations/kitchen/prep-batches with FIFO-ordered table showing recipe name, quantities, expiry countdown (amber/red thresholds), and status badges
- 3-step PrepBatchWizard in Sheet: Step 1 selects recipe (approved only)/qty/zone, Step 2 reviews deductions with red highlighting for insufficient inputs and disabled confirm, Step 3 confirms and creates batch
- ExpiresInCountdown with color thresholds: neutral (>4h), amber (1-4h), red (<1h)

## Task Commits

Each task was committed atomically:

1. **Task 1: Sidebar Kitchen section + Prep Batches page shell + list components** - `537440d` (feat)
2. **Task 2: PrepBatchWizard 3-step creation flow** - `ca880fd` (feat)

## Files Created/Modified
- `frontend/components/ops/Sidebar.tsx` - Added Kitchen nav section with Monitor and Trash2 icons
- `frontend/app/(ops)/operations/kitchen/prep-batches/page.tsx` - Prep Batches page with list and wizard Sheet
- `frontend/components/ops/kitchen/prep-batches/PrepBatchList.tsx` - FIFO-ordered table with empty state per copywriting contract
- `frontend/components/ops/kitchen/prep-batches/PrepBatchRow.tsx` - Table row with recipe name, quantities, countdown, status badge
- `frontend/components/ops/kitchen/prep-batches/PrepBatchStatusBadge.tsx` - Badge for active/depleted/expired states
- `frontend/components/ops/kitchen/prep-batches/ExpiresInCountdown.tsx` - Countdown with amber/red color thresholds
- `frontend/components/ops/kitchen/prep-batches/PrepBatchWizard.tsx` - Sheet wizard with 3 steps, step indicator, hoisted state
- `frontend/components/ops/kitchen/prep-batches/PrepBatchWizardStep1.tsx` - Recipe/qty/zone selection
- `frontend/components/ops/kitchen/prep-batches/PrepBatchWizardStep2.tsx` - Deduction preview with insufficient stock highlighting
- `frontend/components/ops/kitchen/prep-batches/PrepBatchWizardStep3.tsx` - Confirmation summary with Start Batch button

## Decisions Made
- TooltipTrigger renders directly without asChild per Phase 03-03 decision -- disabled button uses styled TooltipTrigger element
- Wizard step circles 32px per UI-SPEC spacing, with primary accent on active step
- ExpiresInCountdown uses 60s interval (minute precision adequate for prep batch lifecycle)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TooltipTrigger asChild incompatibility**
- **Found during:** Task 2 (PrepBatchWizardStep2)
- **Issue:** base-ui TooltipTrigger does not support asChild prop -- tsc error TS2322
- **Fix:** Render TooltipTrigger directly as styled span matching button appearance when disabled, use regular Button when enabled
- **Files modified:** frontend/components/ops/kitchen/prep-batches/PrepBatchWizardStep2.tsx
- **Verification:** tsc --noEmit passes
- **Committed in:** ca880fd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Auto-fix necessary due to known base-ui constraint. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Prep Batches page ready for integration with backend API
- Kitchen sidebar enables navigation to KDS and Waste Log pages (built in Plan 05)
- Wizard preview endpoint POST /kitchen/prep-batches/preview wired and ready

## Self-Check: PASSED

All 10 files verified present. Both commit hashes (537440d, ca880fd) found in git log.

---
*Phase: 09-kitchen-prep*
*Completed: 2026-03-21*
