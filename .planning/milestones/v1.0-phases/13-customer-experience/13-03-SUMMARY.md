---
phase: 13-customer-experience
plan: "03"
subsystem: frontend-ops
tags: [feedback, events, ops-pages, sidebar]
dependency_graph:
  requires: [13-01]
  provides: [ops-feedback-page, ops-events-page, sidebar-feedback-events]
  affects: [frontend-navigation]
tech_stack:
  added: []
  patterns: [react-hook-form-zod-v4, sheet-crud, booking-list-sheet, rating-filter-tabs]
key_files:
  created:
    - frontend/app/(ops)/operations/feedback/page.tsx
    - frontend/app/(ops)/operations/events/page.tsx
    - frontend/components/ops/operations/feedback/FeedbackStatsCard.tsx
    - frontend/components/ops/operations/feedback/RatingFilterTabs.tsx
    - frontend/components/ops/operations/feedback/FeedbackRow.tsx
    - frontend/components/ops/operations/events/EventForm.tsx
    - frontend/components/ops/operations/events/EventRow.tsx
    - frontend/components/ops/operations/events/BookingListSheet.tsx
  modified:
    - frontend/components/ops/Sidebar.tsx
decisions:
  - "z.number() with register valueAsNumber for zod v4 + react-hook-form compatibility (z.coerce.number() produces unknown type)"
metrics:
  duration: 8min
  completed: "2026-03-22T09:49:17Z"
---

# Phase 13 Plan 03: Ops Feedback & Events Pages Summary

Ops pages for viewing customer feedback and managing experience events with sidebar navigation integration, using existing Plan 01 API endpoints and types.

## What Was Built

### Task 1: Ops Feedback Page (4 files)

- **FeedbackStatsCard**: Card showing average rating (amber text-2xl), filled star icons, and total feedback count with skeleton loading
- **RatingFilterTabs**: Tabs component with All / 5-star / 4-star / 3-star / 2-star / 1-star rating filter options
- **FeedbackRow**: Table row with star rating display (size-3), expandable comment with toggle (80 char truncation), customer name (defaults to "Anonymous"), order link to /pos/orders, and date
- **Feedback page**: Full ops page at /operations/feedback with stats card, rating tabs, date filter Select (All Time / Today / This Week / This Month), feedback table with loading skeletons, empty state ("No feedback yet"), and error state

### Task 2: Ops Events CRUD Page + Sidebar (5 files)

- **EventForm**: Sheet form with react-hook-form + zod validation for create/edit events. Fields: title, event_type, date, capacity, price, zone, brand, description, image_url. Fetches zones and brands for Select dropdowns
- **EventRow**: Table row with capacity fill progress bar (h-1), type/status badges, View Bookings button, edit/delete actions
- **BookingListSheet**: Read-only Sheet showing event bookings with customer name, phone, guest count, and date. Fetches from /events/:id/bookings
- **Events page**: Full ops page at /operations/events with CRUD table, Create Event button, delete confirmation Dialog ("Delete event: This will permanently remove the event and all its bookings. This cannot be undone."), empty state ("No events created"), error state
- **Sidebar**: Added Feedback (MessageSquare icon) and Events (CalendarDays icon) links at end of operationsNav array

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 12f3e42 | feat(13-03): ops feedback page with stats card, rating/date filters, and feedback table |
| 2 | aa2a0d5 | feat(13-03): ops events CRUD page with booking list sheet and sidebar update |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed zod v4 coerce.number() type inference with react-hook-form**
- **Found during:** Task 2
- **Issue:** `z.coerce.number()` in zod v4 produces `unknown` output type, causing TypeScript error with `zodResolver` from @hookform/resolvers
- **Fix:** Changed to `z.number()` with `register('field', { valueAsNumber: true })` to handle number coercion at the input level
- **Files modified:** frontend/components/ops/operations/events/EventForm.tsx
- **Commit:** aa2a0d5

## Decisions Made

1. **z.number() + valueAsNumber over z.coerce.number()**: Zod v4's `z.coerce.number()` produces `unknown` output type which breaks react-hook-form's `zodResolver` type inference. Using `z.number()` with react-hook-form's built-in `valueAsNumber: true` on register achieves the same coercion while maintaining full type safety.

## Verification

- [x] `npx tsc --noEmit` succeeds (zero errors)
- [x] Both ops pages exist under frontend/app/(ops)/operations/
- [x] All 6 ops components exist under frontend/components/ops/operations/ (3 feedback + 3 events)
- [x] Sidebar contains Feedback and Events entries in operationsNav
- [x] Events page has delete confirmation dialog
- [x] Booking list Sheet fetches from /events/:id/bookings

## Known Stubs

None. All components are fully wired to API endpoints built in Plan 01.

## Self-Check: PASSED

- All 8 created files verified on disk
- Commits 12f3e42 and aa2a0d5 verified in git log
