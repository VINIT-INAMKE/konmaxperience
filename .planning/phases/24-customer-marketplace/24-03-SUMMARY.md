---
phase: 24-customer-marketplace
plan: 03
subsystem: ui, frontend
tags: [zustand, cart, google-places, razorpay, next.js, tailwind, bottom-sheet]

# Dependency graph
requires:
  - phase: 24-customer-marketplace
    provides: CustomerOrdersModule with cart Redis CRUD, address CRUD, Customer Pusher auth
  - phase: 23-razorpay-customer-auth
    provides: useRazorpay hook, useCustomerAuth hook, CustomerOtpForm, apiClient 401 bypass
provides:
  - Zustand cart store with localStorage persistence (useCartStore)
  - Marketplace types (CartItem, CartData, CustomerAddress, OrderTrackingStep, CustomerOrder)
  - useCart hook with server sync, checkout, and confirmOrder methods
  - Cart-sync-on-login wired into useCustomerAuth verifyOtp handler
  - CategoryTabBar with IntersectionObserver scroll-spy
  - MenuItemOrderCard horizontal card with quantity stepper
  - FloatingCartBar with slide animation and item count
  - CartBottomSheet with ChannelToggle, AddressSelector, Razorpay checkout
  - GooglePlacesInput with @react-google-maps/api Autocomplete
  - ChannelToggle for Pickup/Delivery selection
  - AddressSelector with saved addresses and new address form
  - Enhanced /menu page with Swiggy-style ordering UX
affects: [24-04-profile-tracking, customer-ordering]

# Tech tracking
tech-stack:
  added: ["@react-google-maps/api@2.20.8"]
  patterns:
    - "Zustand persist middleware with localStorage for guest cart state"
    - "IntersectionObserver scroll-spy for category tab active state"
    - "Fire-and-forget cart sync on OTP verify (non-blocking)"
    - "Sheet side=bottom for cart checkout bottom sheet"

key-files:
  created:
    - frontend/lib/types/marketplace.ts
    - frontend/lib/stores/cart-store.ts
    - frontend/hooks/use-cart.ts
    - frontend/components/public/CategoryTabBar.tsx
    - frontend/components/public/MenuItemOrderCard.tsx
    - frontend/components/public/FloatingCartBar.tsx
    - frontend/components/public/CartBottomSheet.tsx
    - frontend/components/public/ChannelToggle.tsx
    - frontend/components/public/AddressSelector.tsx
    - frontend/components/public/GooglePlacesInput.tsx
  modified:
    - frontend/app/globals.css
    - frontend/hooks/use-customer-auth.ts
    - frontend/app/(public)/menu/page.tsx
    - frontend/package.json

key-decisions:
  - "Cart sync on OTP verify is fire-and-forget (not awaited) to avoid blocking login"
  - "IntersectionObserver with -120px rootMargin for scroll-spy accounting for sticky header + tab bar"
  - "LIBRARIES array defined outside GooglePlacesInput component to avoid useJsApiLoader re-renders"
  - "CartBottomSheet fetches channel modifiers and addresses only when opened and logged in"

patterns-established:
  - "useCartStore.getState() pattern for accessing cart state outside React lifecycle"
  - "Horizontal MenuItemOrderCard layout replacing grid-based MenuItemPublicCard"
  - "FloatingCartBar slide-up/down animation via translate-y + opacity transition"

requirements-completed: [MKT-01, MKT-02, MKT-04, MKT-06]

# Metrics
duration: 9min
completed: 2026-03-26
---

# Phase 24 Plan 03: Frontend Cart + Menu Ordering Summary

**Zustand cart store with localStorage persistence, Swiggy-style /menu page with category tabs, horizontal item cards with quantity steppers, floating cart bar, and cart bottom sheet with Razorpay checkout flow**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-26T09:22:04Z
- **Completed:** 2026-03-26T09:31:39Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Zustand cart store with localStorage persistence, addItem/removeItem/updateQuantity/replaceCart/clearCart actions
- Marketplace type definitions: CartItem, CartData, CustomerAddress, OrderTrackingStep, CustomerOrder
- useCart hook wrapping store with syncToServer, checkout, and confirmOrder API integration
- Cart sync to Redis wired into useCustomerAuth verifyOtp success handler (fire-and-forget per D-02)
- CategoryTabBar with IntersectionObserver scroll-spy for auto-active state on scroll
- MenuItemOrderCard horizontal layout with quantity stepper (add/increment/decrement)
- FloatingCartBar with slide animation, item count chip, subtotal, and View Cart button
- CartBottomSheet with item list, ChannelToggle, AddressSelector, order summary, and Razorpay Pay CTA
- GooglePlacesInput with @react-google-maps/api Autocomplete, pincode and lat/lng extraction
- Menu page rewritten from grid to Swiggy-style single-column ordering with max-w-2xl

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, CSS tokens, Zustand cart store, useCart hook, cart-sync-on-login** - `54b975c` (feat)
2. **Task 2: Menu page enhancement with all components** - `8602b85` (feat)

## Files Created/Modified
- `frontend/lib/types/marketplace.ts` - CartItem, CartData, CustomerAddress, OrderTrackingStep, CustomerOrder types
- `frontend/lib/stores/cart-store.ts` - Zustand cart store with persist middleware and localStorage
- `frontend/hooks/use-cart.ts` - Cart hook with syncToServer, checkout, confirmOrder methods
- `frontend/hooks/use-customer-auth.ts` - Added cart sync on verifyOtp success (fire-and-forget)
- `frontend/app/globals.css` - Added --public-cart-bar, --public-cart-bar-fg, --public-tracking-* tokens
- `frontend/components/public/CategoryTabBar.tsx` - Sticky horizontal scroll tabs with scroll-spy
- `frontend/components/public/MenuItemOrderCard.tsx` - Horizontal item card with quantity stepper
- `frontend/components/public/FloatingCartBar.tsx` - Fixed bottom bar with count, total, View Cart
- `frontend/components/public/CartBottomSheet.tsx` - Full checkout sheet with items, channel, address, payment
- `frontend/components/public/ChannelToggle.tsx` - Pickup/Delivery pill selector
- `frontend/components/public/AddressSelector.tsx` - Saved addresses + Google Places new address form
- `frontend/components/public/GooglePlacesInput.tsx` - Autocomplete input with pincode extraction
- `frontend/app/(public)/menu/page.tsx` - Rewritten to Swiggy-style ordering with all new components
- `frontend/package.json` - Added @react-google-maps/api@2.20.8

## Decisions Made
- Cart sync on OTP verify is fire-and-forget to avoid blocking login flow
- IntersectionObserver rootMargin of -120px accounts for sticky header (56px) + tab bar (48px)
- LIBRARIES const defined outside GooglePlacesInput component (React Google Maps requirement to avoid re-renders)
- CartBottomSheet lazily fetches addresses and channel modifiers only when sheet opens and customer is logged in
- useCartStore.getState() pattern used in CartBottomSheet for imperative updates from event handlers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript narrowing issue with IntersectionObserver callback variable**
- **Found during:** Task 2 (menu page rewrite)
- **Issue:** `let topSection: string | null = null` assigned inside forEach callback was narrowed to `never` by TypeScript when accessed after the loop
- **Fix:** Changed to `let topSectionId = ''` (empty string default) to avoid null narrowing issue
- **Files modified:** frontend/app/(public)/menu/page.tsx
- **Verification:** TypeScript compiles with no errors
- **Committed in:** 8602b85 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript narrowing fix. No scope creep.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
**External services require manual configuration:**
- `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` - Google Cloud Console API key with Places API enabled
- `DELIVERY_PINCODES` - Comma-separated serviceable pincodes for delivery zone restriction

## Known Stubs
None - all components are wired to real API endpoints and Zustand store.

## Next Phase Readiness
- Cart + checkout flow complete for customer ordering on /menu page
- CartBottomSheet integrates with useRazorpay for payment modal
- Google Places address input ready for delivery address management
- Ready for Plan 04 (profile enrichment, order history, tracking page)

## Self-Check: PASSED

---
*Phase: 24-customer-marketplace*
*Completed: 2026-03-26*
