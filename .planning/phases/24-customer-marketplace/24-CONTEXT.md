# Phase 24: Customer Marketplace - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Full customer-facing marketplace — cart + checkout with Razorpay custom checkout modal, takeaway & delivery ordering, delivery address management, checkpoint-based order tracking (staff fires events, customer sees timeline via Pusher), customer order history, booking/order receipt download (printable HTML), and enriched customer profile (order history, saved addresses, active order tracking). This phase builds on Phase 23's customer auth and Razorpay infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Cart system
- **D-01:** Cart stored in Redis (Upstash, already configured) keyed by `cart:{customerId}`. JSON blob with items, channel, delivery address. 7-day TTL — abandoned carts auto-cleanup. No Prisma model needed for cart
- **D-02:** Before login, cart lives in Zustand store (local state). On login/OTP verify, local cart syncs to Redis under the customer ID. If Redis already has a cart for that customer (from another device), merge: keep the one with more items (or prompt "You have an existing cart — use it or replace?")
- **D-03:** Login required at checkout only — browsing /menu and adding to cart do NOT require auth. Login prompt appears when customer taps "Pay". Swiggy pattern: low friction for browsing, auth at commitment point

### Order channels
- **D-04:** Customer self-ordering supports **takeaway** and **delivery** only. Dine-in stays staff POS only (no change to existing flow). Checkout has two clear options: [Pickup] and [Delivery]
- **D-05:** Channel modifier (delivery charge) applied at checkout using the existing `ChannelModifier` model — same modifier calculation as POS but triggered from customer checkout. No new pricing logic needed

### Menu + cart UX (Swiggy pattern)
- **D-06:** Enhance existing `/menu` page with ordering capability. Category tabs at top (horizontal scroll), item cards with `+` button and quantity controls (`-`/`+`). No separate /order page — ordering happens on /menu itself
- **D-07:** Floating cart summary bar at bottom of /menu page: shows item count, total, and [View Cart] button. Tapping expands into a bottom sheet with: item list with qty controls, channel selection (Pickup/Delivery), delivery address selector (if delivery), total with modifier, and [Pay ₹XXX] CTA that triggers Razorpay checkout
- **D-08:** Item cards show: name, price, brief description, image thumbnail (if available), availability badge (greyed out if unavailable). Unavailable items cannot be added to cart

### Customer order creation (backend)
- **D-09:** New `POST /customer/orders` endpoint (CustomerGuard, not staff). Reads cart from Redis, validates items against current menu/availability, calculates prices server-side (ignores any client-sent prices), creates Razorpay order, returns `razorpay_order_id`. Same belt-and-suspenders payment verification as event bookings
- **D-10:** After Razorpay payment confirmed: `POST /customer/orders/confirm` verifies signature + API re-fetch, creates Order + OrderItems in Prisma transaction, deletes cart from Redis, triggers Pusher event `order.placed` to staff KDS + customer channel. Order `created_by` set to a system user (since customer isn't a staff User)

### Order tracking
- **D-11:** Real-time order tracking at `/orders/[id]/track`. Vertical timeline with checkpoints. Pusher channel: `private-customer-{customerId}`. Events: `order.status-changed`, `delivery.updated`. Timeline updates instantly without page refresh
- **D-12:** Simplified 4-step customer-facing statuses (internal KDS statuses abstracted away):
  - **Takeaway:** Order Placed → Preparing → Ready for Pickup → Picked Up
  - **Delivery:** Order Placed → Preparing → Out for Delivery → Delivered
  - Mapping: `placed` → "Order Placed", `preparing` → "Preparing", `ready` → "Ready for Pickup" (takeaway), `dispatched + picked_up` → "Out for Delivery", `dispatched + delivered` → "Delivered", `served` → "Picked Up"
- **D-13:** When staff updates order status (via KDS or POS), the existing `updateOrderStatus` and `updateDelivery` methods emit Pusher events to `private-customer-{customerId}` channel. No new staff UI needed — just add Pusher triggers to existing flows

### Delivery address management
- **D-14:** New `CustomerAddress` Prisma model: `id`, `customer_id` (FK), `label` (Home/Work/Other), `address` (full text), `landmark` (optional), `pincode`, `lat` (optional), `lng` (optional), `is_default` (boolean), `created_at`. Customer can save multiple addresses with one default
- **D-15:** Google Places Autocomplete for address input. Frontend uses `@react-google-maps/api` or direct Places API. Customer types address, selects from autocomplete suggestions, pincode and lat/lng auto-extracted from Place result
- **D-16:** Pincode-based delivery zone restriction. Serviceable pincodes stored as env var (`DELIVERY_PINCODES=560001,560002,...`). At checkout, validate delivery address pincode is in the list. Shows "Sorry, we don't deliver to this area yet" if not. This check is designed as a simple `isServiceable(pincode)` function — Phase 25 can replace it with Porter/Shiprocket serviceability API calls without touching checkout flow

### Receipt
- **D-17:** Server-generated receipt — backend renders the receipt HTML at `GET /customer/orders/:id/receipt` (returns `text/html`). The HTML is pre-rendered with all order data server-side — tamper-proof, customer cannot modify amounts or items. Frontend opens this URL in a new tab/iframe, customer uses browser print (Save as PDF). No client-side React rendering of receipt data. Print-optimized CSS (`@media print` hides any chrome). Shows: business name, order number, date/time, channel, itemized list with quantities and prices, subtotal, delivery charge (if applicable), total, payment method, Razorpay payment ID
- **D-18:** Same pattern for event booking receipts: `GET /customer/bookings/:id/receipt` with event name, date, guests, amount, Razorpay payment ID. Both endpoints require CustomerGuard — customer can only view their own receipts

### Order history + enriched profile
- **D-19:** Customer profile page (`/profile`) enhanced with Orders tab. Lists past orders with: order number, date, items summary (first 2-3 items + "and X more"), total, status badge. Each order has [Receipt] and [Re-order] buttons
- **D-20:** Re-order adds the same items to cart (checks current availability — skips unavailable items with a toast notification). If cart already has items, prompt "Replace cart or add to existing?"
- **D-21:** Profile also shows saved addresses with edit/delete/set-default actions. And event bookings list (similar to orders)

### Claude's Discretion
- Exact Redis key schema and cart JSON structure
- Google Places API key configuration
- Cart merge UX (when existing Redis cart vs local cart conflict)
- Loading states and skeleton designs
- Error handling for unavailable items during checkout
- Pusher channel authentication for customer channels
- Empty state designs for order history and addresses
- ETA calculation logic (or whether to show ETA at all)

</decisions>

<specifics>
## Specific Ideas

- The /menu ordering experience should feel exactly like Swiggy — browse, tap +, floating cart bar, expand to checkout. No friction until payment
- Re-order is a key retention feature — make it prominent on order history cards
- The tracking timeline should feel alive — Pusher updates should animate the new checkpoint appearing
- Google Places makes address entry fast and accurate — saves the customer from typing a full address manually
- Receipt should look professional enough to use as a tax invoice for food delivery

</specifics>

<canonical_refs>
## Canonical References

### Menu + ordering
- `backend/src/menu/menu.controller.ts` — Public menu endpoints: categories, items, availability
- `backend/src/menu/menu.service.ts` — Menu item CRUD, availability check, channel modifier lookup
- `backend/prisma/schema.prisma` — MenuItem, MenuCategory, ChannelModifier, Order, OrderItem models

### Order flow
- `backend/src/orders/orders.service.ts` — `createOrder()` (staff POS, reference for customer order creation), `updateOrderStatus()`, `updateDelivery()`, `recordPayment()`
- `backend/src/orders/orders.controller.ts` — Staff order endpoints, delivery update endpoint

### Payment infrastructure (Phase 23)
- `backend/src/razorpay/razorpay.service.ts` — `createOrder()`, `verifyPaymentSignature()`, `fetchPayment()`
- `backend/src/webhooks/webhooks.service.ts` — Webhook routing by `notes.type`
- `frontend/hooks/use-razorpay.ts` — `openCheckout()` with Razorpay modal

### Customer auth (Phase 23)
- `backend/src/customer-auth/customer-auth.service.ts` — OTP verify, profile, JWT
- `backend/src/customer-auth/guards/customer.guard.ts` — CustomerGuard for customer-only endpoints
- `frontend/hooks/use-customer-auth.ts` — Customer session management

### Real-time
- `backend/src/chat/pusher.service.ts` — `trigger(channel, event, data)` method
- `frontend/lib/hooks/use-pusher-channel.ts` — `usePusherChannel()` hook for subscribing

### Existing public pages
- `frontend/app/(public)/menu/page.tsx` — Current read-only menu browse (to be enhanced)
- `frontend/app/(public)/profile/page.tsx` — Current minimal profile (to be enriched)
- `frontend/app/(public)/layout.tsx` — Public layout with Account link

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useRazorpay` hook: Already handles Razorpay modal open/close/success/failure — reuse for checkout
- `usePusherChannel` hook: Already handles channel subscribe/unsubscribe — reuse for order tracking
- `PusherService`: Already initialized — add `trigger()` calls in `updateOrderStatus` and `updateDelivery`
- `CustomerOtpForm`: Login prompt component — reuse at checkout gate
- `RecordPaymentDto` with `@IsIn(['cash','card','upi','razorpay'])` — marketplace orders always use 'razorpay'
- `ChannelModifier` lookup in `createOrder` — reuse same logic for customer orders

### Established Patterns
- `apiClient` with customer endpoint 401 bypass — customer API calls don't redirect to staff login
- `CustomerGuard` for customer-only endpoints
- Serializable transactions for concurrent-safe order creation
- Webhook dedup via Redis SET NX
- `@Throttle()` on all public endpoints

### Integration Points
- `RedisService` (from customer-auth module): reuse for cart storage — `get`/`set`/`del` with TTL
- `updateOrderStatus()` needs Pusher trigger added for customer channel
- `updateDelivery()` needs Pusher trigger added for customer channel
- Webhook handler needs `marketplace` case routing (currently noop `console.log`)
- `/menu` page.tsx needs to become interactive (add-to-cart) from read-only
- `/profile` page.tsx needs order history + addresses tabs
- New `CustomerAddress` model requires Prisma migration
- Google Places API key needs env var: `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`

</code_context>

<deferred>
## Deferred Ideas

- Porter/Shiprocket delivery integration — Phase 25
- Order detail page for staff — Phase 26
- Customer loyalty/rewards program — future phase
- Push notifications (web push / WhatsApp) for order status — future phase
- Customer ratings for delivery experience — future phase
- Estimated delivery time calculation — future phase (needs historical data)
- Multi-restaurant/brand filtering on menu — future if multi-brand grows

</deferred>

---

*Phase: 24-customer-marketplace*
*Context gathered: 2026-03-26*
