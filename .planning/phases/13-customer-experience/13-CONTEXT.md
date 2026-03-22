# Phase 13: Customer Experience - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Post-dining feedback collection (QR/link), experience event booking with capacity enforcement, and digital menu display — all public-facing without customer auth. Separate (public) route group with minimal branded layout. Backend: Feedback, Event, EventBooking models. Internal ops pages for feedback list and event management.

</domain>

<decisions>
## Implementation Decisions

### Feedback Collection Flow
- **D-01:** QR code per order (encodes order ID in URL) + shareable link. Customer scans → lands on `/feedback/[orderId]` pre-linked to their order.
- **D-02:** Form fields: star rating (1-5), free-text comment, optional customer name, optional phone. Order auto-linked from URL param.
- **D-03:** After submission: animated thank-you screen with MagicUI confetti burst. "Your feedback helps us improve." No redirect — page is the end.
- **D-04:** Internal ops page at `/operations/feedback` showing all feedback: rating, comment, customer, order link, date. Filter by rating and date. Average rating card at top.

### Event Booking Experience
- **D-05:** Public event listing page as card grid of upcoming events. Each card: title, date, type, price, capacity status ("X spots left" or "Sold Out"), zone, brand. Click opens detail with booking form.
- **D-06:** Booking form collects: customer name, phone number, number of guests. Capacity check: reject if guests would exceed remaining spots. Confirmation shown inline.
- **D-07:** Capacity enforcement: auto-full when sum of booking guest counts >= event capacity. Event shows "Sold Out" and booking form disabled. No waitlist.
- **D-08:** Internal ops CRUD page at `/operations/events` for creating/editing events and viewing bookings. Fields: title, type, date, capacity, price, zone, brand, description, image.

### Digital Menu Display
- **D-09:** Structure: brand tabs → category sections → item cards. Each card: name, price, image (if available), availability badge. Mirrors POS menu structure.
- **D-10:** Real-time availability: items show "Available" or "Sold Out" badge from existing menu availability endpoint. Binary only — no serving count for customers.
- **D-11:** Pricing: base_price only. No channel modifier applied — public menu is informational, not transactional.

### Public Page Routing
- **D-12:** Separate `(public)` route group at `frontend/app/(public)/` with its own minimal layout (no sidebar, no auth). Routes: `/feedback/[orderId]`, `/events`, `/events/[id]`, `/menu`.
- **D-13:** Public layout: minimal branded header with Konma logo/name. No sidebar, no navigation. Footer with "Powered by Konma Xperience". Clean, mobile-first.
- **D-14:** Fully responsive — equal effort on mobile (QR scan from phones) and desktop/tablet (display screens, kiosk).

### Claude's Discretion
- QR code generation approach (library, format, where generated)
- Feedback form validation and error states
- Event card design and detail page layout
- Menu item card sizing and image handling
- Public layout header/footer styling
- Responsive breakpoints
- Backend API endpoint design for public routes (auth bypass)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — CUST-01 through CUST-03

### Existing Menu System (Phase 7)
- `backend/src/menu/menu.controller.ts` — Menu item endpoints, availability check
- `backend/src/menu/menu.service.ts` — getServingsAvailable, MenuItem queries
- `frontend/app/(ops)/operations/menu/page.tsx` — Existing menu page (ops side) for reference

### Existing Order System (Phase 10)
- `backend/src/orders/orders.controller.ts` — Order endpoints (feedback links to orders)

### Frontend Patterns
- `frontend/app/(ops)/layout.tsx` — Existing ops layout (public layout will be different)
- `frontend/components/ui/magic-card.tsx` — MagicCard for event cards
- `frontend/components/ui/confetti.tsx` — Confetti for thank-you screen

### Prior Phase Context
- `.planning/phases/07-recipe-ingredient-management/07-CONTEXT.md` — Menu items, categories, brands, channel modifiers
- `.planning/phases/10-pos-orders/10-CONTEXT.md` — Order model, channel fields

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/components/ui/magic-card.tsx` — MagicCard for event listing cards
- `frontend/components/ui/confetti.tsx` — Confetti for feedback thank-you
- `frontend/components/ui/blur-fade.tsx` — Page entrance animation
- `frontend/components/ui/badge.tsx` — Available/Sold Out badges
- `backend/src/menu/menu.service.ts` — Menu availability logic reusable for digital menu

### Established Patterns
- React Query for data fetching
- Card/CardContent for list items
- Tab-based filtering (brand tabs on menu)
- BlurFade page wrapper

### Integration Points
- Public routes: new `(public)` layout group — no auth middleware
- Backend: new public endpoints (no JWT guard) for feedback submission, event listing, event booking, public menu
- Sidebar: add Feedback and Events links under Operations section (ops side)
- Prisma: new Feedback, Event, EventBooking models

</code_context>

<specifics>
## Specific Ideas

- Feedback form should be dead simple — customer fills it in 30 seconds after a meal
- Event cards should feel inviting — this is the public face of Konma
- Digital menu should work beautifully on a phone screen (QR scan) AND on a wall-mounted display
- QR code contains the full URL so customer doesn't need to type anything

</specifics>

<deferred>
## Deferred Ideas

- Customer accounts/login — v2
- Online ordering from digital menu — v2
- Event payment integration (Razorpay) — v2
- Feedback sentiment analysis — v2
- Event waitlist when sold out — v2
- Social sharing from feedback/events — v2

</deferred>

---

*Phase: 13-customer-experience*
*Context gathered: 2026-03-22*
