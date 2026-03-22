# Architecture Research

**Domain:** Role-based food operations platform (internal ops + customer-facing)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                            │
│                                                                      │
│  ┌──────────────────────┐        ┌──────────────────────────────┐   │
│  │   (ops) Route Group  │        │   (customer) Route Group     │   │
│  │  /dashboard          │        │  /menu                       │   │
│  │  /missions           │        │  /order                      │   │
│  │  /tasks              │        │  /book                       │   │
│  │  /approvals          │        │  /feedback                   │   │
│  │  /leaderboard        │        │                              │   │
│  └──────────┬───────────┘        └──────────────┬───────────────┘   │
│             │  Next.js App Router (route groups)  │                  │
│             └──────────────────┬──────────────────┘                 │
│                                │                                     │
│                      Next.js middleware.ts                           │
│           (JWT validation + role routing at edge)                    │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTP / fetch
┌────────────────────────────────▼─────────────────────────────────────┐
│                          API LAYER                                   │
│                                                                      │
│            Next.js Route Handlers  (app/api/*)                       │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │  /auth   │  │ /tasks   │  │/evidence │  │  /readiness      │    │
│  │  /users  │  │/missions │  │/approvals│  │  /leaderboard    │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────────┘   │
│       │             │             │                 │               │
│  ┌────▼─────────────▼─────────────▼─────────────────▼────────────┐  │
│  │                      Service Layer                              │  │
│  │  ValidationService  GamificationService  ReadinessService      │  │
│  │  ApprovalService    NotificationService  AssetService          │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│                        DATA LAYER                                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  PostgreSQL (Neon / Railway)                  │   │
│  │  users · roles · missions · quests · tasks · evidence        │   │
│  │  approvals · decisions · readiness_meters · kpis             │   │
│  │  task_readiness_events · zones · brands · channels · assets  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │   S3-compatible      │    │   In-process event emitter       │   │
│  │   object storage     │    │   (Node EventEmitter / BullMQ)   │   │
│  │  (evidence files)    │    │   (validation cascades)          │   │
│  └──────────────────────┘    └──────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

This is a **monolith-first** architecture: one Next.js application containing both the ops UI and the customer-facing UI, with all API logic in Next.js Route Handlers. No separate Express or NestJS process is needed at this scale (8 internal users + modest external traffic). This keeps deployment simple (single Vercel project) and avoids the operational overhead of coordinating two services.

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| Next.js middleware.ts | JWT decode, role extraction, route guard, redirect to login | `middleware.ts` at app root, runs at edge |
| `(ops)` route group | All authenticated internal pages with ops sidebar layout | `app/(ops)/layout.tsx` — requires auth |
| `(customer)` route group | Public customer-facing pages with storefront layout | `app/(customer)/layout.tsx` — no auth required |
| Route Handlers `app/api/*` | REST endpoints consumed by client components and external callers | `route.ts` files, standard Web API Request/Response |
| Service layer (`lib/services/`) | Business logic: validation cascades, XP calculation, readiness aggregation | Plain TypeScript modules, no framework overhead |
| Validation Engine | Orchestrates task validity: status + evidence approval + approvals satisfied | `lib/services/validation.ts`, called after any state change |
| Gamification Engine | XP calculation, level assignment, leaderboard aggregation | `lib/services/gamification.ts`, triggered by validation |
| Readiness Engine | Applies `task_readiness_events`, aggregates meter values | `lib/services/readiness.ts`, idempotent by design |
| Approval Engine | Creates approval records, checks satisfaction, triggers downstream | `lib/services/approval.ts` |
| Notification Engine | Due-date nudges, blocker alerts, level-up alerts | `lib/services/notifications.ts` + cron or BullMQ |
| PostgreSQL (Neon) | Source of truth for all 15 entities | Relational, enforces FK constraints |
| S3 storage | Evidence file storage (photos, docs, videos) | Presigned URL upload — client uploads direct, DB stores URL |

## Recommended Project Structure

```
konmaxperience/
├── app/
│   ├── (ops)/                      # Internal ops — requires auth
│   │   ├── layout.tsx              # Sidebar, top-bar, role-scoped nav
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Founder mission control or role dashboard
│   │   ├── missions/
│   │   │   ├── page.tsx            # Mission list
│   │   │   └── [id]/page.tsx       # Mission detail + quests
│   │   ├── quests/
│   │   │   └── [id]/page.tsx       # Quest detail + tasks
│   │   ├── tasks/
│   │   │   ├── page.tsx            # Task list (role-scoped)
│   │   │   └── [id]/page.tsx       # Task detail + evidence + approvals
│   │   ├── approvals/
│   │   │   └── page.tsx            # Pending approvals queue
│   │   ├── decisions/
│   │   │   └── page.tsx            # Decision board
│   │   ├── readiness/
│   │   │   └── page.tsx            # Readiness meters overview
│   │   ├── leaderboard/
│   │   │   └── page.tsx            # XP leaderboard
│   │   ├── kpis/
│   │   │   └── page.tsx            # KPI tracker
│   │   └── zones/
│   │       └── page.tsx            # Zone status
│   │
│   ├── (customer)/                 # Customer-facing — no auth required
│   │   ├── layout.tsx              # Storefront nav, brand-aware header
│   │   ├── menu/
│   │   │   └── page.tsx            # Menu browsing (reads assets + channels)
│   │   ├── order/
│   │   │   └── page.tsx            # Online ordering
│   │   ├── book/
│   │   │   └── page.tsx            # Experience/event booking
│   │   └── feedback/
│   │       └── page.tsx            # Feedback form
│   │
│   ├── api/                        # REST endpoints (Route Handlers)
│   │   ├── auth/
│   │   │   └── route.ts            # POST /auth/login → JWT
│   │   ├── users/
│   │   │   └── route.ts
│   │   ├── missions/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── quests/
│   │   │   └── route.ts
│   │   ├── tasks/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts        # GET/PATCH /tasks/:id
│   │   │       ├── verify/route.ts # POST /tasks/:id/verify
│   │   │       ├── block/route.ts  # POST /tasks/:id/block
│   │   │       └── evidence/route.ts
│   │   ├── evidence/
│   │   │   └── [id]/
│   │   │       ├── approve/route.ts
│   │   │       └── reject/route.ts
│   │   ├── approvals/
│   │   │   └── route.ts
│   │   ├── decisions/
│   │   │   └── route.ts
│   │   ├── readiness/
│   │   │   └── route.ts
│   │   ├── leaderboard/
│   │   │   └── route.ts
│   │   ├── kpis/
│   │   │   └── route.ts
│   │   ├── assets/
│   │   │   └── route.ts            # Also serves menu items for customer layer
│   │   └── uploads/
│   │       └── presign/route.ts    # Generate S3 presigned URL for evidence
│   │
│   ├── login/
│   │   └── page.tsx                # Auth — no route group
│   │
│   └── layout.tsx                  # Root layout (fonts, providers)
│
├── lib/
│   ├── db/
│   │   ├── client.ts               # PostgreSQL connection (pg or postgres.js)
│   │   └── queries/                # SQL query functions per entity
│   │       ├── tasks.ts
│   │       ├── evidence.ts
│   │       ├── approvals.ts
│   │       └── ...
│   ├── services/
│   │   ├── validation.ts           # Core: validate_task orchestrator
│   │   ├── gamification.ts         # XP calculation, level assignment
│   │   ├── readiness.ts            # Readiness event creation + meter update
│   │   ├── approval.ts             # Approval record management
│   │   ├── notifications.ts        # Notification trigger logic
│   │   └── decisions.ts            # Cross-function decision creation
│   ├── auth/
│   │   ├── jwt.ts                  # Sign/verify JWT
│   │   └── permissions.ts          # Permission matrix per role
│   ├── storage/
│   │   └── s3.ts                   # Presigned URL generation
│   └── middleware/
│       └── with-auth.ts            # Route Handler auth wrapper
│
├── components/
│   ├── ops/                        # Ops-specific UI components
│   │   ├── TaskCard.tsx
│   │   ├── EvidenceUploader.tsx
│   │   ├── ReadinessMeter.tsx
│   │   ├── ApprovalQueue.tsx
│   │   └── MissionProgress.tsx
│   ├── customer/                   # Customer-facing UI components
│   │   ├── MenuGrid.tsx
│   │   ├── OrderForm.tsx
│   │   └── BookingCalendar.tsx
│   └── shared/                     # Used by both surfaces
│       ├── Navigation.tsx
│       └── StatusBadge.tsx
│
├── middleware.ts                   # Next.js edge middleware — JWT + route guard
└── next.config.ts
```

### Structure Rationale

- **`(ops)` route group:** All internal pages share the ops layout (sidebar with role-scoped nav). The layout component reads the JWT role and renders only permitted nav items. No URL segment is added by the parenthetical group name.
- **`(customer)` route group:** Customer pages share a storefront layout entirely separate from ops. No auth required. Menu data is read from the `assets` and `channels` tables (same DB, different query shape).
- **`app/api/*`:** All API logic lives here. Client components call these endpoints. External consumers (future mobile app, webhooks) can also call them. Keeping API routes inside the Next.js app avoids running a second server.
- **`lib/services/`:** Business logic is decoupled from Route Handlers. Route Handlers validate input and call service functions. Services call `lib/db/queries/`. This makes services testable in isolation.
- **`lib/db/queries/`:** Raw SQL or a thin query builder (no ORM). The 15 entities have complex joins; using Prisma is optional but adds type safety for free at this scale.

## Architectural Patterns

### Pattern 1: Validation Cascade (triggered after any state change)

**What:** When evidence is approved or a task is verified, a single `validateTask()` call triggers a chain: task validity → user XP → quest progress → mission progress → readiness event. Each step is a pure function operating on data already in memory.

**When to use:** Any time evidence status, approval status, or task status changes.

**Trade-offs:** Simple and synchronous — easy to debug. At 8 internal users the synchronous approach is fine. If the system scales to many concurrent approvals, queue this work (BullMQ) to avoid blocking the HTTP response.

```typescript
// lib/services/validation.ts
export async function validateTask(taskId: string, db: DB): Promise<void> {
  const task = await db.tasks.findById(taskId);
  const evidenceList = await db.evidence.findByTaskId(taskId);
  const approvals = await db.approvals.findByEntity("task", taskId);

  const hasApprovedEvidence = evidenceList.some(e => e.approval_status === "approved");
  const approvalsSatisfied = task.requires_approval
    ? approvals.every(a => a.status === "approved")
    : true;

  const valid =
    task.status === "done" &&
    task.verified === true &&
    hasApprovedEvidence &&
    approvalsSatisfied;

  const validXp = valid ? calculateEffectiveXp(task) : 0;

  await db.tasks.update(taskId, { valid, valid_xp: validXp });

  // Cascade downstream
  await recalculateUserXp(task.owner_user_id, db);
  await recalculateQuestProgress(task.quest_id, db);
  await recalculateMissionProgress(task.mission_id, db);
  await applyReadinessFromTask(taskId, db);
}
```

### Pattern 2: Route Group Separation with Shared Data

**What:** The `(ops)` and `(customer)` route groups each have independent layouts but call the same API routes and read from the same database. The `assets` table with `asset_type: "menu"` is the bridge — ops team creates and approves menu items; customers browse them.

**When to use:** Any time two user audiences need the same underlying data but different UI chrome and auth requirements.

**Trade-offs:** Simple and avoids data duplication. The risk is accidentally exposing ops-only data to the customer route. Prevent this by checking the audience context in every API route: customer-facing endpoints return only `status: "approved"` assets.

```typescript
// app/api/assets/route.ts — audience-aware response
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-role"); // injected by middleware
  const isInternal = role !== null; // customers have no role header

  const assets = isInternal
    ? await db.assets.findAll()           // ops sees drafts too
    : await db.assets.findByStatus("approved"); // customers see only approved

  return Response.json(assets);
}
```

### Pattern 3: Presigned URL Upload for Evidence

**What:** Evidence files (photos, docs, videos) are uploaded directly from the browser to S3-compatible storage (AWS S3 or Cloudflare R2). The backend only generates a presigned URL and stores the resulting file URL in the `evidence` table. The API server never buffers the file bytes.

**When to use:** Any evidence upload. Eliminates 10MB+ files traversing the Node.js process.

**Trade-offs:** Slightly more complex frontend logic (two-step: get URL, then PUT to S3). The benefit is dramatically better upload performance and no server memory pressure.

```typescript
// app/api/uploads/presign/route.ts
export async function POST(request: NextRequest) {
  const { filename, contentType, taskId } = await request.json();
  const key = `evidence/${taskId}/${Date.now()}-${filename}`;
  const url = await generatePresignedPutUrl(key, contentType); // lib/storage/s3.ts
  return Response.json({ url, key });
}

// Client: PUT file directly to presigned URL, then POST evidence record with URL
```

### Pattern 4: JWT + Middleware RBAC at the Edge

**What:** `middleware.ts` runs at the Next.js edge before any page or API route. It decodes the JWT, extracts the role, checks the route against a role-permission map, and redirects to `/login` if unauthorized. The role is injected into request headers so server components and Route Handlers can read it without re-decoding the JWT.

**When to use:** All protected routes. The middleware is the single enforcement point — page-level and component-level checks are UX only.

**Trade-offs:** Edge middleware has limited Node.js API access (no `pg`, no `fs`). Keep JWT verification in the middleware (pure crypto, no DB). Move any DB-backed permission checks into individual Route Handlers.

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  if (pathname.startsWith("/menu") || pathname.startsWith("/order") ||
      pathname.startsWith("/book") || pathname.startsWith("/feedback") ||
      pathname === "/login") {
    return NextResponse.next();
  }

  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  const payload = verifyJwt(token); // pure crypto — works at edge
  if (!payload) return NextResponse.redirect(new URL("/login", request.url));

  const response = NextResponse.next();
  response.headers.set("x-user-id", payload.userId);
  response.headers.set("x-role", payload.role);
  return response;
}
```

## Data Flow

### Core Execution Loop (evidence approval → readiness update)

```
User uploads file (browser PUT → S3 presigned URL)
    ↓
POST /api/tasks/:id/evidence  →  create evidence record (pending)
    ↓
Lead calls POST /evidence/:id/approve
    ↓
evidence.approval_status = "approved"
    ↓
validateTask(taskId)
    ├── task.valid = true / false
    ├── recalculateUserXp(userId)     → user.xp_total, user.level
    ├── recalculateQuestProgress()    → quest.progress_percent
    ├── recalculateMissionProgress()  → mission.progress_percent
    └── applyReadinessFromTask()
            ├── create task_readiness_event (idempotent: skip if exists)
            └── sum all applied events → update readiness_meter.current_value
```

### Customer Order Flow

```
Customer browses /menu
    ↓
GET /api/assets?type=menu&status=approved  →  returns approved menu assets
    ↓
Customer places order → POST /api/orders (customer API route)
    ↓
Order stored (future entity — not in v1 schema, add in customer phase)
    ↓
Notification to relevant ops role (Anchitha / FRONTEND role)
```

### Cross-Function Decision Flow

```
Any user proposes decision → POST /api/decisions
    ↓
System creates approval records for required role codes (2+1 rule)
    ↓
Each required approver calls POST /approvals/:id/approve
    ↓
All approvals satisfied → decision.status = "approved" → decision logged
```

### Notification Flow

```
Background job (Vercel Cron or BullMQ) polls every hour:
    - tasks where due_date <= now + 48h AND valid = false  → nudge owner
    - approvals where status = pending AND age_hours > 24  → nudge admin
    - users where xp gap to next level <= 20               → level-up alert
    - quests where progress >= 80                          → near-complete alert
```

## Internal Ops and Customer-Facing Coexistence

The two surfaces share data but are fully separated at the UI layer:

| Concern | Internal Ops | Customer-Facing |
|---------|-------------|-----------------|
| Auth | JWT required, role in token | None (public) |
| Layout | `(ops)/layout.tsx` — sidebar, role nav | `(customer)/layout.tsx` — storefront nav |
| Data access | All records by permission | Only `status = "approved"` assets/channels |
| Routes | `/dashboard`, `/missions`, etc. | `/menu`, `/order`, `/book`, `/feedback` |
| Data shared | `assets` table (menu items), `brands`, `channels`, `zones` | Same rows, filtered by status |

The key insight: ops team builds the product (tasks, evidence, approvals create approved assets). Customer-facing layer consumes only the approved outputs. No data duplication needed.

## Suggested Build Order

Components have dependencies. Build in this order to avoid blocked work:

**Phase 1 — Foundation (nothing works without this)**
1. Database schema + seed data (all 15 entities, FK constraints)
2. Auth: JWT login endpoint + `middleware.ts` route guard
3. User + role CRUD + permission matrix in code
4. Base layouts: `(ops)/layout.tsx` with role-scoped nav, login page

**Phase 2 — Core Ops Engine**
5. Mission / Quest / Task CRUD (the spine of the system)
6. Evidence upload: presigned URL flow + evidence record creation
7. Approval engine: create approval records, approve/reject endpoints
8. Validation engine: `validateTask()` cascade — this unlocks XP and readiness

**Phase 3 — Intelligence Layer**
9. Gamification: XP calculation, level assignment, leaderboard endpoint
10. Readiness meters: `task_readiness_events` creation + meter aggregation
11. KPI tracking: manual update + KPI rollup display
12. Decision board: create decisions, cross-function approval flow

**Phase 4 — Ops Dashboards**
13. Founder dashboard: mission control, readiness overview, blockers, approvals queue
14. Role user dashboard: my tasks, my quests, my evidence, my contribution meters
15. Notifications: due-date nudges, approval alerts, level-up alerts (cron)

**Phase 5 — Customer-Facing**
16. Menu browsing: asset query filtered to approved menu items
17. Online ordering: customer order form (new `orders` entity)
18. Experience booking: booking form (new `bookings` entity)
19. Feedback: feedback form (new `feedback` entity)

**Dependency note:** Phase 5 (customer features) requires Phase 2-3 ops work to produce approved assets and active channels. Do not start customer features until at least Phase 2 is complete and seed data includes approved menu assets.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users (current) | Monolith fine. Synchronous validation cascade. Single Vercel deployment. Neon free tier DB. |
| 100-1,000 users | Add BullMQ job queue for validation cascades to avoid blocking HTTP responses. Add DB connection pooling (PgBouncer via Neon). Cache leaderboard and readiness meter reads. |
| 1,000+ users | Extract gamification + readiness as separate services. Add Redis for real-time readiness meter pushes. Consider read replicas for analytics queries. |

### Scaling Priorities

1. **First bottleneck:** Validation cascade is synchronous and hits DB 5-6 times. At high concurrent approval volume, this blocks HTTP workers. Fix: push cascade to a background queue (BullMQ) and return 202 Accepted immediately.
2. **Second bottleneck:** Leaderboard query (ORDER BY xp_total DESC across all users) is a full table scan. Fix: add a materialized view or a dedicated `leaderboard` cache table updated by the cascade.

## Anti-Patterns

### Anti-Pattern 1: Putting Business Logic in Route Handlers

**What people do:** Write validation cascade, XP calculations, and readiness updates directly inside the Route Handler function body.

**Why it's wrong:** Route Handlers become untestable 200-line functions. When the same logic needs to run from a cron job or a Server Action, it gets duplicated.

**Do this instead:** Route Handlers only validate input and call service functions from `lib/services/`. Services contain all logic. Route Handlers are thin adapters.

### Anti-Pattern 2: Skipping Evidence Approval Before Marking Tasks Valid

**What people do:** Allow `task.valid = true` when status is "done" regardless of evidence and approval state — justified as "for testing" or "faster flow".

**Why it's wrong:** The system's entire integrity rests on valid tasks representing real, approved work. XP, readiness, and mission progress become meaningless if shortcuts bypass the validation chain. The leaderboard becomes gameable.

**Do this instead:** The `validateTask()` function is the single gate. It cannot be bypassed. Admin can approve evidence quickly but the chain must run.

### Anti-Pattern 3: Storing Uploaded Files in the Database

**What people do:** Store evidence file bytes as BLOBs in the `evidence` table, or route uploads through the Next.js API server to save to disk.

**Why it's wrong:** PostgreSQL is not a file store. Large BLOBs degrade query performance and blow up DB storage costs. Routing video files through the Node.js process creates memory pressure.

**Do this instead:** Use the presigned URL pattern. Client uploads directly to S3-compatible storage. DB stores only the URL string.

### Anti-Pattern 4: Duplicating Data Between Ops and Customer Layers

**What people do:** Create a separate "customer-facing menu" data model disconnected from the ops `assets` table, requiring manual sync.

**Why it's wrong:** Data gets out of sync. Ops team approves a recipe change that never appears in the customer menu because the two models are separate.

**Do this instead:** Customer menu is a filtered view of the `assets` table (`asset_type = "menu"`, `status = "approved"`). One source of truth. Ops approval automatically makes it live for customers.

### Anti-Pattern 5: Recalculating Readiness from Scratch on Every Request

**What people do:** On every GET `/readiness`, re-query all tasks and sum `readiness_value` for valid ones.

**Why it's wrong:** As tasks accumulate, this query grows linearly. It is also inconsistent with the event-based model defined in the dev spec (readiness events are idempotent — applied once per valid task).

**Do this instead:** Readiness meter values are maintained incrementally via `task_readiness_events`. The GET `/readiness` endpoint reads the pre-computed `current_value` directly from the `readiness_meters` table. Only the cascade updates the value.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| S3 / Cloudflare R2 | Presigned PUT URL (client-direct upload) | Backend generates URL in `lib/storage/s3.ts`, stores resulting key in evidence.url |
| Vercel Cron | HTTP POST to `/api/cron/notify` on a schedule | Runs notification checks hourly; protected with `CRON_SECRET` env var |
| Email (Resend / Nodemailer) | HTTP call from `lib/services/notifications.ts` | First channel for nudges; WhatsApp/Slack later |
| Neon / Railway (PostgreSQL) | `pg` or `postgres.js` driver | Connection pool managed in `lib/db/client.ts`; use connection string env var |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Route Handler ↔ Service Layer | Direct function call (same process) | No HTTP between them — services are imported, not fetched |
| Ops UI ↔ Customer UI | None (separate route groups, no shared components except `shared/`) | Route groups share the DB but have no UI dependencies on each other |
| Validation → Gamification | Direct call: `validateTask` calls `recalculateUserXp` | Keep synchronous for v1; promote to queue if needed |
| Validation → Readiness | Direct call: `validateTask` calls `applyReadinessFromTask` | Idempotent by design — safe to call multiple times |
| API Layer ↔ Middleware | Request headers (`x-user-id`, `x-role` injected by middleware.ts) | Route Handlers read these headers to check permissions without re-decoding JWT |

## Sources

- [Next.js Building APIs (official, Feb 2025)](https://nextjs.org/blog/building-apis-with-nextjs) — Route Handlers vs separate backend guidance, presigned URL patterns (HIGH confidence)
- [Next.js Route Groups (official docs)](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) — separating ops and customer layouts without URL impact (HIGH confidence)
- [Next.js App Router: Patterns That Matter 2026](https://dev.to/teguh_coding/nextjs-app-router-the-patterns-that-actually-matter-in-2026-146) — Server/Client component boundaries, route group separation (MEDIUM confidence)
- [Modern Full-Stack Architecture using Next.js 15+](https://softwaremill.com/modern-full-stack-application-architecture-using-next-js-15/) — Server Actions vs Route Handlers, service layer separation (MEDIUM confidence)
- [Next.js Middleware Authentication 2025](https://www.hashbuilds.com/articles/next-js-middleware-authentication-protecting-routes-in-2025) — JWT middleware pattern, role injection into headers (MEDIUM confidence)
- [S3 Presigned URL Architecture](https://dev.to/oliverke/the-architecture-that-lets-us-sleep-scalable-uploads-with-s3-presigned-urls-1jf3) — Client-direct upload pattern for evidence files (MEDIUM confidence)
- [NestJS vs Next.js (Contentful 2025)](https://www.contentful.com/blog/nestjs-vs-nextjs/) — Guidance on when a separate backend is warranted (MEDIUM confidence)
- Dev spec (`contextdocs/dev_spec.md`) and system layers (`contextdocs/technical.md`) — primary implementation reference, 15-layer system model (HIGH confidence, first-party)

---
*Architecture research for: Konma Xperience OS — role-based food operations platform*
*Researched: 2026-03-19*
