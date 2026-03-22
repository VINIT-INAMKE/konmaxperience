---
phase: 13-customer-experience
plan: 02
subsystem: ui
tags: [nextjs, react-query, public-pages, feedback, events, menu, mobile-first]

# Dependency graph
requires:
  - phase: 13-customer-experience
    provides: Feedback, Event, EventBooking backend modules, @Public() endpoints, frontend types
provides:
  - 5 public-facing Next.js pages under (public) route group
  - Light-theme public layout with branded header/footer
  - StarRatingInput with 44px touch targets for mobile QR-scan use case
  - FeedbackThankYou with confetti animation
  - EventCard with MagicCard spotlight and CapacityBadge
  - EventBookingForm with inline capacity enforcement
  - Digital menu with brand tabs, category sections, 60s availability refresh
  - 8 reusable components in components/public/
affects: [13-customer-experience, ops-dashboards]

# Tech tracking
tech-stack:
  added: []
  patterns: [public-route-group-light-theme, inline-error-no-toast-on-public, refetchInterval-availability]

key-files:
  created:
    - frontend/app/(public)/layout.tsx
    - frontend/app/(public)/feedback/[orderId]/page.tsx
    - frontend/app/(public)/events/page.tsx
    - frontend/app/(public)/events/[id]/page.tsx
    - frontend/app/(public)/menu/page.tsx
    - frontend/components/public/StarRatingInput.tsx
    - frontend/components/public/FeedbackThankYou.tsx
    - frontend/components/public/EventCard.tsx
    - frontend/components/public/EventBookingForm.tsx
    - frontend/components/public/CapacityBadge.tsx
    - frontend/components/public/MenuBrandTabs.tsx
    - frontend/components/public/MenuItemPublicCard.tsx
    - frontend/components/public/AvailabilityBadge.tsx
  modified: []

key-decisions:
  - "Public layout uses 'light' CSS class wrapper to override global dark theme for customer-facing pages"
  - "Inline error messages on all public forms (no toast) per UI-SPEC interaction contract"
  - "Menu availability uses refetchInterval 60s to auto-refresh without manual button"

patterns-established:
  - "Public route group (public) with own light-theme layout, no auth, no sidebar"
  - "Inline error/success messaging pattern for public anonymous forms (no toast)"
  - "Client-side brand filtering of pre-fetched full menu data (no re-fetch on tab change)"

requirements-completed: [CUST-01, CUST-02, CUST-03]

# Metrics
duration: 7min
completed: 2026-03-22
---

# Phase 13 Plan 02: Customer-Facing Public Pages Summary

**5 public pages (feedback, events, menu) with light-theme layout, star rating with confetti, event booking with capacity enforcement, and digital menu with 60s availability refresh**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T09:40:45Z
- **Completed:** 2026-03-22T09:48:03Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Public (public) route group with light-theme layout (no auth, no sidebar, branded header/footer)
- Feedback page at /feedback/[orderId] with interactive 5-star rating (44px touch targets), comment, optional name/phone, confetti thank-you on submit
- Events listing at /events with MagicCard grid, staggered BlurFade entrance, capacity badges
- Event detail at /events/[id] with 2-column desktop / 1-column mobile layout and inline EventBookingForm with +/- guest stepper and capacity enforcement
- Digital menu at /menu with brand tab switcher, category sections, item cards showing base_price and binary Available/Sold Out badges refreshing every 60 seconds
- All 5 pages mobile-first responsive, no auth imports, light theme

## Task Commits

Each task was committed atomically:

1. **Task 1: Public layout + Feedback page with star rating and thank-you confetti** - `d68456b` (feat)
2. **Task 2: Events listing + detail + booking, Digital menu display** - `7086581` (feat)

## Files Created/Modified
- `frontend/app/(public)/layout.tsx` - Light-theme public layout with branded header/footer, no auth
- `frontend/app/(public)/feedback/[orderId]/page.tsx` - Feedback form with star rating, POST to /feedback, confetti thank-you
- `frontend/app/(public)/events/page.tsx` - Event listing grid with MagicCard and staggered entrance
- `frontend/app/(public)/events/[id]/page.tsx` - Event detail with image, details, and booking form
- `frontend/app/(public)/menu/page.tsx` - Digital menu with brand tabs, categories, 60s availability refresh
- `frontend/components/public/StarRatingInput.tsx` - 5 interactive stars with 44px touch targets and hover preview
- `frontend/components/public/FeedbackThankYou.tsx` - Confetti burst with BlurFade entrance animation
- `frontend/components/public/EventCard.tsx` - MagicCard with title, date, type badge, price, capacity
- `frontend/components/public/EventBookingForm.tsx` - Booking with name/phone/guest stepper, capacity check, inline errors
- `frontend/components/public/CapacityBadge.tsx` - "X spots left" or "Sold Out" badge
- `frontend/components/public/MenuBrandTabs.tsx` - Brand tab switcher with horizontal scroll
- `frontend/components/public/MenuItemPublicCard.tsx` - Display-only card with name, price, image, availability
- `frontend/components/public/AvailabilityBadge.tsx` - "Available" or "Sold Out" badge

## Decisions Made
- Public layout uses `light` CSS class on wrapper div to override the global `dark` class on html element, ensuring customer-facing pages are bright and inviting
- All public forms use inline error messages (no toast) per UI-SPEC interaction contract -- customers on mobile may not see toast notifications
- Menu availability fetched once as full map, filtered client-side on brand tab change (no re-fetch per brand switch per Research Pitfall 5)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
None - all pages are fully wired to backend API endpoints via apiClient with real data queries.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All public-facing customer pages complete and ready for use
- Plan 03 (ops dashboard pages for feedback and event management) can proceed independently
- Backend API endpoints from Plan 01 fully consumed by these pages

## Self-Check: PASSED

- All 13 created files verified present on disk
- Commit d68456b (Task 1) verified in git log
- Commit 7086581 (Task 2) verified in git log
