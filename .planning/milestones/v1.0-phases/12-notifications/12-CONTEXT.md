# Phase 12: Notifications - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprehensive alert system covering 7 notification types: task deadlines (48h), task blockers, approval delays (24h), low stock alerts, new order to kitchen, order ready for POS, and delivery status updates. In-app notifications with bell icon + email for critical alerts via MailerSend. BullMQ + Upstash Redis for async processing. NestJS EventEmitter for event-driven triggers. All notification delivery failures isolated from core operations.

</domain>

<decisions>
## Implementation Decisions

### Delivery Mechanism
- **D-01:** In-app notifications for all 7 types + email via MailerSend for 4 critical types (task overdue, approval pending 24h+, low stock, task blocked).
- **D-02:** BullMQ + Redis for async queue processing. Upstash Redis (serverless, free tier).
- **D-03:** Notification jobs enqueued to BullMQ. Worker processes: persist to DB, send email for critical types. Failures isolated — never block the producing service.

### Notification Triggers
- **D-04:** Time-based triggers via hourly cron (existing @nestjs/schedule pattern): scan for tasks due within 48h, approvals pending 24h+, low stock below min level.
- **D-05:** Event-driven triggers via NestJS EventEmitter: services emit events (OrderPlaced, StockLow, DeliveryUpdated, OrderReady), NotificationListener subscribes and enqueues BullMQ jobs.
- **D-06:** Deduplication with cooldown — track last notification time per (user_id, type, reference_id). Cooldowns: 24h for task due, 4h for low stock, 24h for approval pending, no cooldown for order/delivery events (one-shot).
- **D-07:** NOTF-05 (new order to kitchen): both bell notification AND existing KDS visual flash (BorderBeam from Phase 9). KDS already handles visual; this adds the bell notification for kitchen staff not watching the screen.

### Frontend Notification UX
- **D-08:** Bell icon in sidebar header with unread count badge. Click opens dropdown panel showing recent notifications (last 20). "Mark all as read" button. Link to full /notifications page.
- **D-09:** 30-second polling for unread count via `GET /notifications/unread-count`. Full list fetched on panel open.
- **D-10:** Clicking a notification navigates to the related item (deep link URL stored per notification). Marks as read on click.
- **D-11:** Dedicated `/notifications` page accessible to all users (not admin-only). Shows full history with filters (type, read/unread, date range) and pagination.

### Notification Persistence
- **D-12:** Notification model in Prisma: id, user_id, type (enum of 7 types), title, body, link_url, reference_id, reference_type, is_read, is_email_sent, created_at.
- **D-13:** 30-day retention with auto-cleanup via weekly cron. Read notifications older than 30 days deleted first.
- **D-14:** No per-user notification preferences for v1. All users get all notifications relevant to their role.
- **D-15:** Role-based routing: task due/blocked → assigned user. Approval pending → admin (FOUNDER_ADMIN). Low stock → MANAGE_PROCUREMENT permission holders. New order → MANAGE_KITCHEN permission holders. Order ready → MANAGE_POS permission holders. Delivery updates → order creator.

### Claude's Discretion
- BullMQ queue names and job configuration
- Email template design for critical notifications
- Bell icon placement and dropdown animation
- Notification panel card layout
- Unread count badge styling
- Cleanup cron schedule (weekly, which day)
- EventEmitter event naming conventions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — NOTF-01 through NOTF-07

### Existing Cron Pattern
- `backend/src/kitchen/expiry/kitchen-expiry.cron.ts` — @Cron('0 * * * *') pattern, @nestjs/schedule usage

### Event Sources (services that will emit events)
- `backend/src/orders/orders.service.ts` — Order creation (NOTF-05), order ready (NOTF-06)
- `backend/src/inventory/inventory.service.ts` — Stock adjustment (NOTF-04)
- `backend/src/tasks/tasks.service.ts` — Task assignment, due dates (NOTF-01, NOTF-02)
- `backend/src/evidence/evidence.service.ts` — Evidence approval workflow (NOTF-03)

### Email
- `backend/src/mail/` — Existing MailerSend integration (from Phase 1)

### Frontend Patterns
- `frontend/components/ops/Sidebar.tsx` — Where bell icon will be placed
- `frontend/lib/api-client.ts` — API client pattern
- `frontend/lib/stores/auth-store.ts` — User/permissions access for role routing

### Prior Phase Context
- `.planning/phases/09-kitchen-prep/09-CONTEXT.md` — KDS 5s polling, BorderBeam flash for new orders (D-08)
- `.planning/phases/10-pos-orders/10-CONTEXT.md` — Order status flow, delivery dispatch

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@nestjs/schedule` — Already installed, used by kitchen expiry cron
- `backend/src/mail/` — MailerSend integration for email delivery
- Sonner toast — Frontend toast notifications (for supplementary flash)
- `frontend/components/ui/badge.tsx` — Badge for unread count
- `frontend/components/ui/popover.tsx` — Popover for notification dropdown

### Established Patterns
- NestJS Module → Controller → Service → Prisma
- React Query with polling (refetchInterval pattern used in KDS, kitchen dashboard)
- Permission-based rendering via `useAuthStore((s) => s.permissions)`
- Cron pattern: `@Cron('0 * * * *')` in dedicated `.cron.ts` files

### Integration Points
- Sidebar: Bell icon in header area
- BullMQ: New dependency — `@nestjs/bullmq` + `bullmq` + `ioredis`
- EventEmitter: `@nestjs/event-emitter` — new dependency
- Prisma: New Notification model
- Existing services: Add event emissions (OrdersService, InventoryService, etc.)

</code_context>

<specifics>
## Specific Ideas

- Notifications should feel lightweight — bell icon with count, not intrusive
- Critical email alerts should be concise — subject line + one-line body + link to the item
- KDS already handles visual new order alerts — bell notification is supplementary for kitchen staff away from the screen

</specifics>

<deferred>
## Deferred Ideas

- WhatsApp/Slack notification integration — v2
- Per-user notification preferences/muting — v2
- Real-time WebSocket push (replace polling) — v2
- Sound alerts on KDS for new orders — v2
- Near level-up nudge (within 20 XP) — v2 (NOTF-V2-01)
- Quest almost complete nudge (80%+ progress) — v2 (NOTF-V2-02)

</deferred>

---

*Phase: 12-notifications*
*Context gathered: 2026-03-22*
