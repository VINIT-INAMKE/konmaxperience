# Phase 12: Notifications - Research

**Researched:** 2026-03-22
**Domain:** BullMQ async queues, NestJS EventEmitter, in-app notification persistence, MailerSend email alerts, React Query polling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Delivery Mechanism**
- D-01: In-app notifications for all 7 types + email via MailerSend for 4 critical types (task overdue, approval pending 24h+, low stock, task blocked).
- D-02: BullMQ + Redis for async queue processing. Upstash Redis (serverless, free tier).
- D-03: Notification jobs enqueued to BullMQ. Worker processes: persist to DB, send email for critical types. Failures isolated — never block the producing service.

**Notification Triggers**
- D-04: Time-based triggers via hourly cron (existing @nestjs/schedule pattern): scan for tasks due within 48h, approvals pending 24h+, low stock below min level.
- D-05: Event-driven triggers via NestJS EventEmitter: services emit events (OrderPlaced, StockLow, DeliveryUpdated, OrderReady), NotificationListener subscribes and enqueues BullMQ jobs.
- D-06: Deduplication with cooldown — track last notification time per (user_id, type, reference_id). Cooldowns: 24h for task due, 4h for low stock, 24h for approval pending, no cooldown for order/delivery events (one-shot).
- D-07: NOTF-05 (new order to kitchen): both bell notification AND existing KDS visual flash (BorderBeam from Phase 9). KDS already handles visual; this adds the bell notification for kitchen staff not watching the screen.

**Frontend Notification UX**
- D-08: Bell icon in sidebar header with unread count badge. Click opens dropdown panel showing recent notifications (last 20). "Mark all as read" button. Link to full /notifications page.
- D-09: 30-second polling for unread count via `GET /notifications/unread-count`. Full list fetched on panel open.
- D-10: Clicking a notification navigates to the related item (deep link URL stored per notification). Marks as read on click.
- D-11: Dedicated `/notifications` page accessible to all users (not admin-only). Shows full history with filters (type, read/unread, date range) and pagination.

**Notification Persistence**
- D-12: Notification model in Prisma: id, user_id, type (enum of 7 types), title, body, link_url, reference_id, reference_type, is_read, is_email_sent, created_at.
- D-13: 30-day retention with auto-cleanup via weekly cron. Read notifications older than 30 days deleted first.
- D-14: No per-user notification preferences for v1. All users get all notifications relevant to their role.
- D-15: Role-based routing: task due/blocked → assigned user. Approval pending → admin (FOUNDER_ADMIN). Low stock → MANAGE_PROCUREMENT permission holders. New order → MANAGE_KITCHEN permission holders. Order ready → MANAGE_POS permission holders. Delivery updates → order creator.

### Claude's Discretion
- BullMQ queue names and job configuration
- Email template design for critical notifications
- Bell icon placement and dropdown animation
- Notification panel card layout
- Unread count badge styling
- Cleanup cron schedule (weekly, which day)
- EventEmitter event naming conventions

### Deferred Ideas (OUT OF SCOPE)
- WhatsApp/Slack notification integration — v2
- Per-user notification preferences/muting — v2
- Real-time WebSocket push (replace polling) — v2
- Sound alerts on KDS for new orders — v2
- Near level-up nudge (within 20 XP) — v2 (NOTF-V2-01)
- Quest almost complete nudge (80%+ progress) — v2 (NOTF-V2-02)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTF-01 | Alert user when task is due within 48 hours | Hourly cron scans `Task.due_date < now() + 48h`, enqueues BullMQ job per user — dedup by 24h cooldown |
| NOTF-02 | Alert user when task is blocked by unresolved dependency | Event-driven: TasksService emits `task.blocked` event when `blocked=true` set; listener enqueues immediately — no cooldown for blocked state |
| NOTF-03 | Alert admin when approval is pending more than 24 hours | Hourly cron scans `Approval.status=pending AND created_at < now() - 24h` — dedup by 24h cooldown per approval |
| NOTF-04 | Low stock alert when ingredient drops below min level | Event-driven: InventoryService emits `stock.low` after any adjustment that drops below min_stock_level — 4h cooldown dedup |
| NOTF-05 | New order alert to kitchen (KDS push or sound) | Event-driven: OrdersService emits `order.placed` on createOrder — no cooldown, one-shot per order |
| NOTF-06 | Order ready alert to POS staff | Event-driven: OrdersService emits `order.ready` when all items ready — no cooldown, one-shot per order |
| NOTF-07 | Delivery dispatched / delivered status update | Event-driven: OrdersService emits `delivery.updated` on updateDelivery — no cooldown, tracks status |
</phase_requirements>

---

## Summary

Phase 12 adds a comprehensive async notification system to an already-running NestJS + Next.js 16 application. The stack is fully decided: BullMQ as the job queue backed by Upstash Redis, NestJS EventEmitter for in-process event bus, an hourly cron for time-based scanning, and MailerSend (already integrated) for critical email alerts. In-app notifications are persisted to PostgreSQL via Prisma and fetched via 30-second polling — no WebSocket needed in v1.

The project already has `@nestjs/schedule` installed and in use (kitchen expiry cron), `mailersend` integrated with a clean try/catch isolation pattern, and React Query polling established in multiple places (KDS at 5s, kitchen dashboard at 10s). The notification architecture mirrors these patterns. The new dependencies — `@nestjs/bullmq`, `bullmq`, `ioredis`, and `@nestjs/event-emitter` — are the only additions; everything else reuses existing infrastructure.

The key architectural challenge is deduplication: the cron runs hourly and must not flood users. A `NotificationCooldown` table (or a cooldown field on the Notification record) tracks last-sent per `(user_id, type, reference_id)` tuple. One-shot event-driven notifications (orders, delivery) skip cooldown entirely.

**Primary recommendation:** Build as one `NotificationsModule` with four collaborators — `NotificationsCron` (time-based scanner), `NotificationsListener` (EventEmitter subscriber), `NotificationsWorker` (BullMQ processor), and `NotificationsService` (DB + API). Existing services emit events via injected EventEmitter2 — no circular dependencies because emitting is fire-and-forget.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/bullmq` | 11.0.4 | BullMQ integration for NestJS (module + decorators) | Official NestJS integration — matches project's NestJS 11 |
| `bullmq` | 5.71.0 | Job queue backed by Redis | Locked decision D-02; successor to Bull with better TypeScript support |
| `ioredis` | 5.10.1 | Redis client used internally by BullMQ | Required peer dependency of BullMQ |
| `@nestjs/event-emitter` | 3.0.1 | In-process event bus for NestJS | Locked decision D-05; official NestJS module wrapping EventEmitter2 |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nestjs/schedule` | 6.1.1 | Cron scheduling | Time-based triggers: task due scan, approval scan, cleanup cron |
| `mailersend` | 2.6.0 | Email delivery | Critical email alerts for 4 notification types |
| `@tanstack/react-query` | 5.91.2 | Frontend data fetching + polling | Bell unread count (30s interval), notification list (on panel open) |
| `sonner` | 2.0.7 | Frontend toast | Order ready (NOTF-06) supplementary toast for POS staff |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ | pg-boss (PostgreSQL queue) | pg-boss avoids Redis dependency but is slower; BullMQ is locked decision |
| EventEmitter2 | RxJS Subject | RxJS adds complexity; EventEmitter2 is idiomatic NestJS |
| 30s polling | WebSocket | WebSocket is real-time but deferred to v2; polling is simpler and sufficient |

**Installation (backend):**
```bash
npm install @nestjs/bullmq bullmq ioredis @nestjs/event-emitter
```

**Version verification:** Confirmed against npm registry 2026-03-22.
- `bullmq` 5.71.0 — latest stable
- `@nestjs/bullmq` 11.0.4 — matches NestJS 11 major
- `ioredis` 5.10.1 — latest stable
- `@nestjs/event-emitter` 3.0.1 — latest, supports NestJS 11

---

## Architecture Patterns

### Recommended Module Structure

```
backend/src/notifications/
├── notifications.module.ts        # registers BullMQ queue, EventEmitter imports
├── notifications.service.ts       # DB CRUD: create, findForUser, markRead, markAllRead, unreadCount
├── notifications.controller.ts    # REST endpoints: GET /notifications, GET /notifications/unread-count,
│                                  #   PATCH /notifications/:id/read, POST /notifications/read-all
├── notifications.cron.ts          # @Cron('0 * * * *') — scans tasks due, approvals pending, low stock
├── notifications.listener.ts      # @OnEvent() subscribers — enqueues BullMQ jobs
├── notifications.worker.ts        # @Processor() — persists to DB, sends email
├── notifications.cleanup.cron.ts  # @Cron('0 3 * * 0') weekly cleanup (Sunday 3am)
└── dto/
    ├── notification-query.dto.ts  # GET /notifications query params: limit, cursor, type, is_read
    └── notification-response.dto.ts
```

### Pattern 1: BullMQ Module Registration

**What:** Register BullMQ in NotificationsModule pointing at Upstash Redis via TLS URL.
**When to use:** Required for any BullMQ queue usage in NestJS.

```typescript
// notifications.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notifications' }),
    // BullModule.forRoot() registered in AppModule with Upstash connection
  ],
  providers: [
    NotificationsService,
    NotificationsCron,
    NotificationsListener,
    NotificationsCleanupCron,
    NotificationsWorker,  // @Processor must be in providers array
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

```typescript
// app.module.ts — add BullModule.forRoot and EventEmitterModule.forRoot globally
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    // ...existing
    EventEmitterModule.forRoot(),  // registers EventEmitter2 globally
    BullModule.forRoot({
      connection: {
        // Upstash Redis — TLS required
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT ?? 6380),
        password: process.env.REDIS_PASSWORD,
        tls: {},  // empty object enables TLS for Upstash
        enableTLSForSentinelMode: false,
        maxRetriesPerRequest: null,  // REQUIRED for BullMQ workers
      },
    }),
    // ...existing
  ],
})
export class AppModule {}
```

### Pattern 2: NestJS EventEmitter — Emit and Listen

**What:** Services emit named events; NotificationsListener subscribes without coupling.
**When to use:** All event-driven triggers (D-05).

```typescript
// In producing service (e.g., OrdersService) — inject EventEmitter2
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,  // NEW injection
  ) {}

  async createOrder(dto: CreateOrderDto, userId: string) {
    // ... existing order creation logic
    const order = await this.prisma.$transaction(async (tx) => { /* ... */ });

    // Fire-and-forget AFTER transaction commits — never inside transaction
    this.eventEmitter.emit('order.placed', {
      orderId: order.id,
      channel: order.channel,
      itemCount: order.items.length,
      total: order.total,
      createdBy: userId,
    });

    return order;
  }
}
```

```typescript
// notifications.listener.ts
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsListener {
  constructor(
    @InjectQueue('notifications') private readonly queue: Queue,
  ) {}

  @OnEvent('order.placed')
  async handleOrderPlaced(payload: OrderPlacedEvent) {
    await this.queue.add('notify-new-order', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  @OnEvent('stock.low')
  async handleStockLow(payload: StockLowEvent) {
    await this.queue.add('notify-low-stock', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
```

### Pattern 3: BullMQ Worker (Processor)

**What:** @Processor class processes jobs from the queue — persists notifications, sends email.
**When to use:** All job processing in this phase.

```typescript
// notifications.worker.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('notifications')
export class NotificationsWorker extends WorkerHost {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'notify-new-order':
        await this.processNewOrder(job.data);
        break;
      case 'notify-low-stock':
        await this.processLowStock(job.data);
        break;
      // ... other job types
    }
  }

  private async processNewOrder(data: OrderPlacedEvent): Promise<void> {
    // 1. Find users with MANAGE_KITCHEN permission
    const kitchenUsers = await this.getUsersByPermission('MANAGE_KITCHEN');

    // 2. Create notification per user (no dedup for one-shot events)
    for (const user of kitchenUsers) {
      await this.notifications.create({
        user_id: user.id,
        type: 'new_order',
        title: `New order #${data.orderId.slice(-6).toUpperCase()}`,
        body: `${data.channel} order placed. ${data.itemCount} item(s).`,
        link_url: `/pos/orders`,
        reference_id: data.orderId,
        reference_type: 'order',
      });
    }
    // No email for new_order (not in critical-4 list per D-01)
  }
}
```

### Pattern 4: Deduplication via Last-Sent Tracking

**What:** Notification table stores `last_sent_at` per `(user_id, type, reference_id)` using upsert logic, or a separate cooldown check.
**When to use:** Time-based cron notifications (task due, low stock, approval pending).

```typescript
// In NotificationsService — check cooldown before creating
async shouldNotify(
  userId: string,
  type: string,
  referenceId: string,
  cooldownHours: number,
): Promise<boolean> {
  const last = await this.prisma.notification.findFirst({
    where: { user_id: userId, type, reference_id: referenceId },
    orderBy: { created_at: 'desc' },
  });
  if (!last) return true;
  const hoursSinceLast =
    (Date.now() - last.created_at.getTime()) / (1000 * 60 * 60);
  return hoursSinceLast >= cooldownHours;
}
```

Cooldown values (per D-06):
- `task_due` → 24h
- `low_stock` → 4h
- `approval_pending` → 24h
- `task_blocked`, `new_order`, `order_ready`, `delivery_update` → no cooldown (one-shot)

### Pattern 5: Hourly Cron (Time-Based Scan)

**What:** Mirrors existing `KitchenExpiryCron` pattern exactly.
**When to use:** NOTF-01, NOTF-03, and low stock re-check.

```typescript
// notifications.cron.ts
@Injectable()
export class NotificationsCron {
  private readonly logger = new Logger(NotificationsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly queue: Queue,
  ) {}

  @Cron('0 * * * *')  // Every hour at :00
  async scanTasksDue() {
    const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const tasks = await this.prisma.task.findMany({
      where: {
        due_date: { lte: cutoff, gt: new Date() },
        status: { notIn: ['done', 'cancelled'] },
      },
      select: { id: true, title: true, owner_user_id: true, due_date: true },
    });

    for (const task of tasks) {
      await this.queue.add('notify-task-due', task, { attempts: 2 });
    }
  }

  @Cron('0 * * * *')
  async scanApprovalsPending() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const approvals = await this.prisma.approval.findMany({
      where: { status: 'pending', created_at: { lt: cutoff } },
      include: { task: { select: { id: true, title: true } } },
    });
    for (const approval of approvals) {
      await this.queue.add('notify-approval-pending', approval, { attempts: 2 });
    }
  }
}
```

### Pattern 6: Frontend Polling with React Query

**What:** Bell unread count polls every 30s; notification panel fetches on open.
**When to use:** NotificationBell component.

```typescript
// useNotifications hook (or inline in NotificationBell)
const { data: unreadData } = useQuery({
  queryKey: ['notifications', 'unread-count'],
  queryFn: () => apiClient.get<{ count: number }>('/notifications/unread-count'),
  refetchInterval: 30_000,
  staleTime: 25_000,
});

const [panelOpen, setPanelOpen] = useState(false);

const { data: recentNotifications } = useQuery({
  queryKey: ['notifications', 'recent'],
  queryFn: () => apiClient.get<Notification[]>('/notifications?limit=20'),
  enabled: panelOpen,  // only fetch when panel is opened
  staleTime: 0,
});
```

### Anti-Patterns to Avoid

- **Emitting events inside Prisma transactions:** Never call `eventEmitter.emit()` inside `this.prisma.$transaction()`. If the transaction rolls back, the event has already fired and notifications get orphaned. Emit AFTER `await this.prisma.$transaction(...)` returns.
- **Blocking core services on notification failure:** The BullMQ `queue.add()` call must be fire-and-forget (no `await` on job completion, or wrapped in try/catch). The queue enqueue itself can fail if Redis is down — wrap in try/catch with Logger.warn.
- **Registering @Processor without adding to providers:** NestJS BullMQ workers must be in the `providers` array of the module. Forgetting this silently causes jobs to pile up unprocessed.
- **Using `maxRetriesPerRequest: 3` with BullMQ workers:** BullMQ requires `maxRetriesPerRequest: null` on the Redis connection for workers; otherwise it throws `ENOTCONN` errors on long-running jobs.
- **Querying permissions in worker via role code only:** The `getPermissionsForRole` cache utility exists — use it. Don't query the DB for every job; permissions rarely change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with retry/backoff | Custom retry loop in service | BullMQ via @nestjs/bullmq | BullMQ handles exponential backoff, dead letter, concurrency, persistence across restarts |
| In-process event bus | Custom EventEmitter wrapper | @nestjs/event-emitter (EventEmitter2) | Supports wildcards, async listeners, NestJS DI injection |
| Redis connection for BullMQ | Raw `ioredis` client construction | BullMQ.forRoot connection config | @nestjs/bullmq manages the connection lifecycle automatically |
| Deduplication via Redis TTL keys | Custom Redis SET NX TTL logic | Prisma Notification table last-sent query | Project already has PostgreSQL; no need for additional Redis data layer when simple DB query suffices |
| Upstash TLS config | Complex TLS certificates | `tls: {}` empty object in ioredis config | Upstash Redis TLS works with empty tls object in ioredis — no cert files needed |

**Key insight:** BullMQ handles all the hard parts of reliable job delivery (at-least-once semantics, retry with backoff, job stall detection). The application code only needs to `queue.add()` and `process()` — never think about retry loops or failure isolation manually.

---

## Common Pitfalls

### Pitfall 1: Emitting Events Inside Prisma Transactions
**What goes wrong:** EventEmitter fires `order.placed`, listener enqueues a BullMQ job, worker creates a notification — all before the transaction commits. If the transaction rolls back, the notification exists for an order that doesn't.
**Why it happens:** Developers naturally put the emit inside the `$transaction` callback for "completeness."
**How to avoid:** Always emit AFTER `await this.prisma.$transaction(...)` returns successfully. Pattern: `const result = await this.prisma.$transaction(...); this.eventEmitter.emit('...', result);`
**Warning signs:** Notifications appearing for cancelled/rolled-back orders.

### Pitfall 2: Missing `maxRetriesPerRequest: null` on BullMQ Connection
**What goes wrong:** Workers connect fine, but hang on first job processing attempt. Error: `MaxRetriesPerRequestError` or silent job stall.
**Why it happens:** ioredis default `maxRetriesPerRequest: 3` conflicts with BullMQ's blocking BRPOP calls.
**How to avoid:** Always set `maxRetriesPerRequest: null` in the `BullModule.forRoot` connection config.
**Warning signs:** Jobs sit in "active" state without completing.

### Pitfall 3: BullMQ Worker Not in Module Providers Array
**What goes wrong:** Jobs are added to the queue but never processed. No error thrown.
**Why it happens:** `@Processor('notifications')` registers a metadata key, but NestJS DI never instantiates the class if it's not in `providers`.
**How to avoid:** Always list the Worker class in `providers: [NotificationsWorker]` in the module.
**Warning signs:** Queue grows indefinitely; `queue.getWaiting()` count climbs.

### Pitfall 4: Cron Deduplication Gap — First-Hour Flood
**What goes wrong:** On first deploy, the hourly cron finds 50+ overdue tasks and creates 50+ notifications for every user who has them. This is a real-data scenario, not edge case.
**Why it happens:** `shouldNotify()` returns true for all tasks (no prior notifications exist).
**How to avoid:** The deduplication cooldown check handles this correctly — if 24h cooldown and no prior record, only ONE notification per (user, type, reference) per 24h. Just ensure the cron processes are idempotent and the cooldown query runs first.
**Warning signs:** Mass notifications on first deploy.

### Pitfall 5: Upstash Redis Free Tier — Connection Limits
**What goes wrong:** Multiple BullMQ workers + ioredis connections exhaust Upstash free tier (max 100 concurrent connections on free plan).
**Why it happens:** BullMQ opens multiple connections per worker (queue, worker, events).
**How to avoid:** Use single queue name `'notifications'`. BullMQ 5.x uses ~3 connections per worker instance. With 1 worker, stays well within free tier limits.
**Warning signs:** `ERR max number of clients reached` from Redis.

### Pitfall 6: `@nestjs/event-emitter` Module Not Globally Registered
**What goes wrong:** `EventEmitter2` injection fails in services outside NotificationsModule.
**Why it happens:** `EventEmitterModule.forRoot()` must be in `AppModule.imports`, not in `NotificationsModule`.
**How to avoid:** Register `EventEmitterModule.forRoot()` in `AppModule` — it is automatically global.
**Warning signs:** `Cannot inject EventEmitter2` runtime error in OrdersService or InventoryService.

### Pitfall 7: Role-Based User Lookup — MANAGE_KITCHEN vs MANAGE_POS
**What goes wrong:** Worker queries all users but doesn't filter by permission, sending notifications to everyone.
**Why it happens:** User-to-permission mapping requires joining Role.permissions array in Prisma.
**How to avoid:** Use a helper: `prisma.user.findMany({ include: { role: true } })` then filter `role.permissions.includes('MANAGE_KITCHEN')` in application code. Permissions are stored as String[] on Role. Keep result in a short-lived (per-job) set — no separate cache needed.
**Warning signs:** Non-kitchen staff getting kitchen notifications.

---

## Code Examples

### Prisma Schema — Notification Model

```prisma
// Add to schema.prisma

enum NotificationType {
  task_due
  task_blocked
  approval_pending
  low_stock
  new_order
  order_ready
  delivery_update
}

model Notification {
  id             String   @id @default(uuid())
  user_id        String
  user           User     @relation(fields: [user_id], references: [id])
  type           String   // NotificationType values as string — avoids migration enum complexity
  title          String
  body           String
  link_url       String?
  reference_id   String?  // ID of related entity (task_id, order_id, ingredient_id, approval_id)
  reference_type String?  // "task" | "order" | "ingredient" | "approval"
  is_read        Boolean  @default(false)
  is_email_sent  Boolean  @default(false)
  created_at     DateTime @default(now())

  @@index([user_id, is_read, created_at(sort: Desc)])
  @@index([user_id, type, reference_id])  // dedup lookup
}
```

**Note:** Use `String` type for `type` field (not Prisma enum) to avoid needing a DB migration for enum values. The application enforces valid values via class-validator `@IsIn([...])`.

**Also add to User model:**
```prisma
notifications Notification[]
```

### Upstash Redis TLS Connection

```typescript
// app.module.ts — BullModule.forRoot
BullModule.forRoot({
  connection: {
    host: configService.get('REDIS_HOST'),       // e.g. "xyz.upstash.io"
    port: Number(configService.get('REDIS_PORT') ?? 6380),
    password: configService.get('REDIS_PASSWORD'),
    tls: {},                    // enables TLS — required for Upstash
    maxRetriesPerRequest: null, // CRITICAL for BullMQ workers
    enableReadyCheck: false,    // recommended for Upstash
  },
}),
```

```
# .env additions
REDIS_HOST=<upstash-redis-endpoint>
REDIS_PORT=6380
REDIS_PASSWORD=<upstash-token>
```

### Mark All Read — Optimistic Update Pattern (Frontend)

```typescript
// In NotificationBell component
const queryClient = useQueryClient();

const markAllReadMutation = useMutation({
  mutationFn: () => apiClient.post('/notifications/read-all', {}),
  onMutate: async () => {
    // Optimistic: set unread count to 0 immediately
    queryClient.setQueryData(['notifications', 'unread-count'], { count: 0 });
    queryClient.setQueryData(
      ['notifications', 'recent'],
      (old: Notification[] | undefined) =>
        old?.map((n) => ({ ...n, is_read: true })) ?? [],
    );
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  },
});
```

### Event Payload Types (Shared DTOs)

```typescript
// notifications/events/notification-events.ts — plain objects, no classes
export interface OrderPlacedEvent {
  orderId: string;
  channel: string;
  itemCount: number;
  total: string;
  createdBy: string;
}

export interface StockLowEvent {
  ingredientId: string;
  ingredientName: string;
  currentQty: number;
  minQty: number;
  unit: string;
  zoneId: string;
}

export interface OrderReadyEvent {
  orderId: string;
  channel: string;
  createdBy: string; // order creator for delivery routing
}

export interface DeliveryUpdatedEvent {
  orderId: string;
  deliveryStatus: string;
  deliveryAddress: string | null;
  createdBy: string;
}

export interface TaskBlockedEvent {
  taskId: string;
  taskTitle: string;
  ownerUserId: string;
  blockedReason: string | null;
}
```

### Email Template — Critical Alert (MailerSend pattern)

```typescript
// In NotificationsWorker — mirrors EmailService pattern exactly
private async sendCriticalEmail(
  toEmail: string,
  toName: string,
  subject: string,
  bodyHtml: string,
  linkUrl: string,
): Promise<void> {
  try {
    const sentFrom = new Sender(this.fromEmail, 'Konma Xperience');
    const recipients = [new Recipient(toEmail, toName)];
    const emailParams = new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject(subject)
      .setHtml(bodyHtml + `<p><a href="${this.frontendUrl}${linkUrl}">View in app →</a></p>`)
      .setText(subject + '\n\n' + `${this.frontendUrl}${linkUrl}`);
    await this.mailerSend.email.send(emailParams);
  } catch (error) {
    // Failures never throw — logged only, matches Phase 1 email pattern
    this.logger.error('Notification email failed', error instanceof Error ? error.stack : String(error));
  }
}
```

### Weekly Cleanup Cron

```typescript
// notifications.cleanup.cron.ts
@Injectable()
export class NotificationsCleanupCron {
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * 0') // Sunday 3:00 AM
  async cleanupOldNotifications() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Delete read notifications older than 30 days first (per D-13)
    await this.prisma.notification.deleteMany({
      where: { is_read: true, created_at: { lt: cutoff } },
    });

    // Then delete all (including unread) older than 30 days
    await this.prisma.notification.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
  }
}
```

---

## Integration Points — What Existing Services Need

This is the most critical section for the planner. Existing services need minimal surgical edits.

### Services that need `EventEmitter2` injected

| Service | File | Event(s) to Emit | Where in Code |
|---------|------|-----------------|---------------|
| `OrdersService` | `backend/src/orders/orders.service.ts` | `order.placed` | After `$transaction` in `createOrder()` |
| `OrdersService` | `backend/src/orders/orders.service.ts` | `order.ready` | After all items ready — in `updateItemStatus()` when order transitions to `ready` |
| `OrdersService` | `backend/src/orders/orders.service.ts` | `delivery.updated` | After `updateDelivery()` persists new delivery_status |
| `InventoryService` | `backend/src/inventory/inventory.service.ts` | `stock.low` | After `createAdjustment()` if new qty < min_stock_level |
| `TasksService` | `backend/src/tasks/tasks.service.ts` | `task.blocked` | After task update sets `blocked: true` |

**Each service needs:** `private readonly eventEmitter: EventEmitter2` injected in constructor. Since `EventEmitterModule.forRoot()` is global, no module import change needed in individual service modules.

### Module Changes

- `AppModule` — add `EventEmitterModule.forRoot()` and `BullModule.forRoot(...)` to imports
- Add `NotificationsModule` to `AppModule` imports
- `OrdersModule`, `InventoryModule`, `TasksModule` — no import changes needed (EventEmitter is global)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@nestjs/bull` (Bull v3) | `@nestjs/bullmq` (BullMQ v5) | BullMQ released 2022, became standard 2023 | BullMQ uses streams not lists; better TypeScript; no polling |
| `WorkerHost` class extension | Still `WorkerHost` in BullMQ 5 | N/A | `@Processor` + `extends WorkerHost` is the current pattern |
| `EventEmitter` (Node built-in) | `EventEmitter2` via `@nestjs/event-emitter` | NestJS 9+ era | Supports async handlers, wildcard events, NestJS DI |
| Direct email in service (synchronous) | Queue → Worker → email (async) | Pattern applied in Phase 1 (try/catch isolation) | Worker extends isolation — email failure never blocks queue |

**Deprecated/outdated:**
- `@nestjs/bull` (wraps Bull v3): Do NOT use — use `@nestjs/bullmq` only. Bull v3 is unmaintained.
- `BullModule.forFeature()`: Renamed to `BullModule.registerQueue()` in `@nestjs/bullmq`.

---

## Open Questions

1. **Upstash Redis free tier — connection count under load**
   - What we know: Free tier allows up to 100 concurrent connections. BullMQ uses ~3 connections per worker instance.
   - What's unclear: Under peak load (many events), does a single worker instance handle throughput or do we need concurrency config?
   - Recommendation: Set `{ concurrency: 5 }` in `@Processor('notifications', { concurrency: 5 })` — processes 5 jobs in parallel, stays within single worker's ~3 Redis connections. This is sufficient for the expected workload.

2. **Order ready detection — all items ready vs. individual item ready**
   - What we know: `OrdersService` has `updateItemStatus()` (in `KdsService`). Order status becomes `ready` when all items are `ready` — this is already implemented in Phase 10.
   - What's unclear: Does `order.ready` fire at item-level (per KDS tap) or at order-level (when status changes to `ready`)?
   - Recommendation: Emit `order.ready` only when `order.status` transitions to `'ready'` — not on individual item status updates. This matches NOTF-06 semantics ("order is ready for serving/pickup").

3. **Admin approval pending alert — multiple admins**
   - What we know: D-15 says approval pending alerts go to admin (FOUNDER_ADMIN). Multiple FOUNDER_ADMIN users could theoretically exist.
   - What's unclear: Should all FOUNDER_ADMIN users get the alert, or just one?
   - Recommendation: Alert ALL users with FOUNDER_ADMIN role code. The notification panel shows context (task name + link) — admin sees it and acts, others see it resolved on next poll.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 (ts-jest 29.2.5) |
| Config file | `backend/jest.config` via `package.json` jest key |
| Quick run command | `cd backend && npx jest --testPathPattern="notifications" --passWithNoTests` |
| Full suite command | `cd backend && npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTF-01 | Cron finds tasks due within 48h and enqueues job | unit | `cd backend && npx jest notifications.cron.spec -t "scanTasksDue"` | ❌ Wave 0 |
| NOTF-02 | `task.blocked` event triggers notification job | unit | `cd backend && npx jest notifications.listener.spec -t "handleTaskBlocked"` | ❌ Wave 0 |
| NOTF-03 | Cron finds approvals pending >24h and enqueues | unit | `cd backend && npx jest notifications.cron.spec -t "scanApprovalsPending"` | ❌ Wave 0 |
| NOTF-04 | `stock.low` event enqueues low-stock notification | unit | `cd backend && npx jest notifications.listener.spec -t "handleStockLow"` | ❌ Wave 0 |
| NOTF-05 | `order.placed` event enqueues kitchen notification | unit | `cd backend && npx jest notifications.listener.spec -t "handleOrderPlaced"` | ❌ Wave 0 |
| NOTF-06 | `order.ready` event enqueues POS notification | unit | `cd backend && npx jest notifications.listener.spec -t "handleOrderReady"` | ❌ Wave 0 |
| NOTF-07 | `delivery.updated` event enqueues delivery notification | unit | `cd backend && npx jest notifications.listener.spec -t "handleDeliveryUpdated"` | ❌ Wave 0 |
| ALL | Worker persists Notification to DB for job | unit | `cd backend && npx jest notifications.worker.spec` | ❌ Wave 0 |
| ALL | shouldNotify() respects cooldown periods | unit | `cd backend && npx jest notifications.service.spec -t "shouldNotify"` | ❌ Wave 0 |
| NOTF-01–07 | Delivery failures do not throw / propagate | unit | `cd backend && npx jest notifications.worker.spec -t "isolates failure"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx jest --testPathPattern="notifications" --passWithNoTests`
- **Per wave merge:** `cd backend && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/notifications/__tests__/notifications.cron.spec.ts` — covers NOTF-01, NOTF-03
- [ ] `backend/src/notifications/__tests__/notifications.listener.spec.ts` — covers NOTF-02, NOTF-04, NOTF-05, NOTF-06, NOTF-07
- [ ] `backend/src/notifications/__tests__/notifications.worker.spec.ts` — covers worker + failure isolation
- [ ] `backend/src/notifications/__tests__/notifications.service.spec.ts` — covers shouldNotify() cooldown logic
- [ ] No framework gaps — Jest + ts-jest already installed and configured

---

## Sources

### Primary (HIGH confidence)

- Verified against npm registry 2026-03-22: `bullmq@5.71.0`, `@nestjs/bullmq@11.0.4`, `@nestjs/event-emitter@3.0.1`, `ioredis@5.10.1`
- Project codebase direct reads: `backend/package.json`, `backend/src/app.module.ts`, `backend/src/email/email.service.ts`, `backend/src/kitchen/expiry/kitchen-expiry.cron.ts`, `backend/prisma/schema.prisma`
- `.planning/phases/12-notifications/12-CONTEXT.md` — all locked decisions
- `.planning/phases/12-notifications/12-UI-SPEC.md` — approved UI contract

### Secondary (MEDIUM confidence)

- BullMQ `maxRetriesPerRequest: null` and `enableReadyCheck: false` requirements for Upstash: documented pattern seen consistently across BullMQ + Upstash integration guides. Consistent with BullMQ docs on blocking commands.
- Upstash TLS via `tls: {}` empty object: standard ioredis TLS pattern for Upstash (serverless Redis uses TLS-only connections on port 6380).

### Tertiary (LOW confidence — flag for validation)

- Upstash free tier connection limit (100 concurrent): from Upstash pricing page documentation, may change. Verify at https://upstash.com/pricing before deploy.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-03-22
- Architecture patterns: HIGH — mirrors existing codebase patterns (cron, email, React Query polling)
- Integration points: HIGH — read actual service files; injection points confirmed
- Pitfalls: HIGH — derived from BullMQ docs and project-specific code review
- Frontend: HIGH — UI-SPEC is approved and fully defines component inventory

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack — BullMQ, NestJS, EventEmitter have slow release cadence)
