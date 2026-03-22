---
phase: 10-pos-orders
plan: 03
subsystem: ui
tags: [nextjs, react, pos, cart, magicui, shadcn, tabs, animated-list, typescript]

# Dependency graph
requires:
  - phase: 10-pos-orders
    provides: "OrdersModule with 7 REST endpoints, batch availability, frontend order types"
  - phase: 07-recipe-ingredient-management
    provides: "MenuModule with items, categories, brands, channel modifiers"
provides:
  - "POS page at /pos with split-screen layout (menu grid + cart sidebar)"
  - "6 POS components: PosMenuGrid, PosMenuItemCard, PosCartSidebar, PosCartItemRow, PosChannelFields, page.tsx"
  - "Sidebar POS navigation section with Take Order, Order History, Delivery Queue"
affects: [10-04-pos-order-history, 10-05-pos-delivery]

# Tech tracking
tech-stack:
  added: []
  patterns: [split-screen-pos-layout, tap-to-add-cart-pattern, channel-conditional-fields, fullscreen-terminal-mode]

key-files:
  created:
    - frontend/app/(ops)/pos/page.tsx
    - frontend/components/ops/pos/PosMenuGrid.tsx
    - frontend/components/ops/pos/PosMenuItemCard.tsx
    - frontend/components/ops/pos/PosCartSidebar.tsx
    - frontend/components/ops/pos/PosCartItemRow.tsx
    - frontend/components/ops/pos/PosChannelFields.tsx
  modified:
    - frontend/components/ops/Sidebar.tsx

key-decisions:
  - "Cart state managed entirely in local useState until Place Order submission — no intermediate API calls for tap-to-add speed"
  - "AnimatedListItem used directly (NOT AnimatedList wrapper) per Research Pitfall 4"
  - "Zone ID derived from first kitchen-type zone via zones query — simple MVP approach"
  - "Channel modifier shown as 'Channel pricing applied at checkout' text — server is authoritative per research anti-pattern"

patterns-established:
  - "Split-screen POS layout: flex-1 overflow-y-auto left panel + w-80 min-w-[320px] fixed-width right panel"
  - "Tap-to-add pattern: addItem checks for existing cart item by menu_item_id, increments or appends"
  - "Full-screen terminal mode: CSS fixed inset-0 z-50 toggle without separate layout"
  - "Channel-conditional fields: dine_in shows table_number, takeaway shows phone, delivery shows phone+address+rider"

requirements-completed: [POS-01]

# Metrics
duration: 6min
completed: 2026-03-21
---

# Phase 10 Plan 03: POS New Order Page Summary

**Split-screen POS interface with MagicCard menu grid, tap-to-add cart with AnimatedListItem animations, channel-conditional fields, PulsatingButton Place Order CTA, BorderBeam confirmation, and full-screen terminal mode**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T16:59:31Z
- **Completed:** 2026-03-21T17:05:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- POS page with split-screen layout: brand-tabbed menu grid (left) and order cart sidebar (right)
- MagicCard item cards with servings-remaining badges (emerald 6+, amber 2-5, red 1, sold-out opacity)
- Cart sidebar with AnimatePresence/AnimatedListItem animations, channel selector, conditional fields
- Place Order flow with PulsatingButton CTA, Sonner toast confirmation, BorderBeam flash, cart reset
- Full-screen terminal mode toggle via ShimmerButton with CSS fixed positioning
- Sidebar POS navigation section with 3 nav items between Kitchen and Admin

## Task Commits

Each task was committed atomically:

1. **Task 1: POS page layout, menu grid, and menu item card** - `6932ad2` (feat)
2. **Task 2: Cart sidebar, cart item row, channel fields, sidebar nav** - `488bb5a` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `frontend/app/(ops)/pos/page.tsx` - POS page with cart state, brand/category/item/availability queries, Place Order mutation, full-screen toggle
- `frontend/components/ops/pos/PosMenuGrid.tsx` - Brand tabs + category sections + 3-col item card grid
- `frontend/components/ops/pos/PosMenuItemCard.tsx` - MagicCard item card with servings badge color logic and sold-out state
- `frontend/components/ops/pos/PosCartSidebar.tsx` - Order summary sidebar with AnimatePresence, channel fields, totals, PulsatingButton CTA, BorderBeam
- `frontend/components/ops/pos/PosCartItemRow.tsx` - Cart item row with AnimatedListItem, +/- quantity buttons, line total
- `frontend/components/ops/pos/PosChannelFields.tsx` - Channel selector tabs with conditional dine-in/takeaway/delivery fields
- `frontend/components/ops/Sidebar.tsx` - Added posNav array and POS section between Kitchen and Admin

## Decisions Made
- **Local cart state until submission:** All cart operations (add, increment, remove) are local useState — no API calls between taps for fast 30-second order flow
- **AnimatedListItem direct usage:** Per Research Pitfall 4, AnimatedListItem is used directly with AnimatePresence, not the AnimatedList wrapper which controls reveal timing
- **Kitchen zone as default zone_id:** Queries zones and picks first kitchen-type zone for the order payload — adequate for single-villa MVP
- **Server-authoritative channel modifier:** Display text "Channel pricing applied at checkout" instead of computing modifier client-side, since server is the authority per research

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are fully wired to API queries and mutations with no placeholder data.

## Next Phase Readiness
- POS page fully functional for order creation flow
- Order History page (/pos/orders) route ready for Plan 04
- Delivery Queue page (/pos/delivery) route ready for Plan 05
- Sidebar navigation already links to all 3 POS pages

## Self-Check: PASSED

- All 6 created files exist on disk
- All 2 commit hashes (6932ad2, 488bb5a) found in git log
- TypeScript compiles with no errors
- All acceptance criteria pass (11 for Task 1, 13 for Task 2)

---
*Phase: 10-pos-orders*
*Completed: 2026-03-21*
