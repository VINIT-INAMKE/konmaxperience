---
phase: 24-customer-marketplace
plan: 02
subsystem: api
tags: [nestjs, razorpay, pusher, redis, checkout, receipts, webhooks]

# Dependency graph
requires:
  - phase: 24-customer-marketplace/01
    provides: Cart CRUD, address CRUD, CustomerOrdersModule, Redis cart storage, Prisma migration (CustomerAddress + nullable created_by/zone_id)
  - phase: 23
    provides: RazorpayService, CustomerGuard, PusherService, webhook infrastructure
provides:
  - POST /customer/orders (checkout — server-side price validation, Razorpay order creation)
  - POST /customer/orders/confirm (payment verification, Order+OrderItems+Payment creation)
  - GET /customer/orders/:id (single order with ownership check)
  - GET /customer/orders (customer order history)
  - GET /customer/bookings (customer booking history)
  - GET /customer/orders/:id/receipt (HTML order receipt)
  - GET /customer/bookings/:id/receipt (HTML booking receipt)
  - Pusher triggers in updateOrderStatus and updateDelivery for customer channels
  - Webhook marketplace handler for payment.captured fallback
  - Pincode serviceability check via DELIVERY_PINCODES env var
affects: [24-customer-marketplace/03, 24-customer-marketplace/04, 25-delivery-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [pending-order Redis pattern with 30-min TTL, belt-and-suspenders payment verification, inline Prisma transaction in webhook handler]

key-files:
  created:
    - backend/src/customer-orders/dto/confirm-order.dto.ts
    - backend/src/customer-orders/receipt.template.ts
    - backend/src/customer-orders/customer-orders.service.spec.ts
  modified:
    - backend/src/customer-orders/customer-orders.service.ts
    - backend/src/customer-orders/customer-orders.controller.ts
    - backend/src/customer-orders/customer-orders.module.ts
    - backend/src/orders/orders.service.ts
    - backend/src/orders/orders.module.ts
    - backend/src/webhooks/webhooks.service.ts
    - backend/src/webhooks/webhooks.module.ts

key-decisions:
  - "Pending order stored in Redis with 30-min TTL keyed by Razorpay order ID for webhook fallback"
  - "Serializable isolation level for confirmOrder Prisma transaction to prevent double-creation"
  - "Pusher triggers use fire-and-forget .catch() pattern — non-blocking, consistent with existing codebase"
  - "Webhook marketplace handler uses inline Prisma $transaction (not CustomerOrdersService) since webhook already verified"
  - "Receipt route declared before :id route in controller to avoid NestJS path conflict"

patterns-established:
  - "pending_order:{rzpOrderId} Redis pattern: stores server-validated cart data for confirm/webhook consumption"
  - "Customer Pusher null-guard: if (order.customer_id) before triggering — POS orders have no customer"
  - "HTML receipt via @Header('Content-Type', 'text/html') + pure template function returning string"

requirements-completed: [MKT-03, MKT-05, MKT-07]

# Metrics
duration: 11min
completed: 2026-03-26
---

# Phase 24 Plan 02: Customer Marketplace Backend Summary

**Checkout flow with server-side price validation, Razorpay payment confirm with belt-and-suspenders verification, Pusher real-time triggers for customer order tracking, webhook marketplace handler, and HTML receipt generation**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-26T09:21:52Z
- **Completed:** 2026-03-26T09:33:27Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Full checkout flow: cart validation, server-side pricing, Razorpay order creation, pending data in Redis
- Payment confirmation with signature verification, API re-fetch, amount match, serializable Prisma transaction
- Real-time Pusher triggers on order status and delivery updates for customer channels (null-guarded for POS)
- Webhook marketplace handler as fallback for browser crash / timeout scenarios
- HTML receipt endpoints for orders and event bookings with print-optimized CSS
- 32 unit tests covering all service methods

## Task Commits

Each task was committed atomically:

1. **Task 1: Checkout + confirm + single-order + receipts + serviceability** - `9c23202` (feat)
2. **Task 2: Pusher triggers + webhook handler + unit tests** - `9d6fe58` (feat)

## Files Created/Modified
- `backend/src/customer-orders/dto/confirm-order.dto.ts` - DTO for Razorpay payment confirmation
- `backend/src/customer-orders/receipt.template.ts` - Pure HTML template functions for order and booking receipts
- `backend/src/customer-orders/customer-orders.service.ts` - Added checkoutCart, confirmOrder, getOrderById, getCustomerOrders, getCustomerBookings, generateOrderReceipt, generateBookingReceipt, isServiceable
- `backend/src/customer-orders/customer-orders.controller.ts` - Added order/booking/receipt endpoints with rate limiting
- `backend/src/customer-orders/customer-orders.module.ts` - Added RazorpayModule import
- `backend/src/orders/orders.service.ts` - Added PusherService injection, Pusher triggers in updateOrderStatus and updateDelivery
- `backend/src/orders/orders.module.ts` - Added ChatModule import for PusherService
- `backend/src/webhooks/webhooks.service.ts` - Implemented handleMarketplacePayment with inline Prisma transaction
- `backend/src/webhooks/webhooks.module.ts` - Added ChatModule import for PusherService
- `backend/src/customer-orders/customer-orders.service.spec.ts` - 32 unit tests

## Decisions Made
- Pending order stored in Redis with 30-min TTL keyed by Razorpay order ID — enables both confirm endpoint and webhook handler to create the order
- Serializable isolation level for confirmOrder transaction to prevent race conditions
- Pusher triggers use .catch() fire-and-forget pattern consistent with existing codebase
- Webhook marketplace handler uses inline Prisma $transaction (not via service) since signature already verified upstream
- Receipt route (`orders/:id/receipt`) declared before generic route (`orders/:id`) in controller to avoid NestJS path conflict
- customer_id and order_number added to updateOrderStatus select for Pusher payload

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. DELIVERY_PINCODES env var is optional (no restriction if not set).

## Next Phase Readiness
- All backend APIs needed for the customer marketplace frontend are now ready
- Plan 03 (frontend menu + cart) can build on these endpoints
- Plan 04 (order tracking page) can use GET /customer/orders/:id and Pusher channels

## Self-Check: PASSED

- All 10 files verified present on disk
- Commit 9c23202 (Task 1) verified in git log
- Commit 9d6fe58 (Task 2) verified in git log

---
*Phase: 24-customer-marketplace*
*Completed: 2026-03-26*
