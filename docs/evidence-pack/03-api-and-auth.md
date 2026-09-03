> 🔐 **As-Built Technical Evidence Pack — 03: API surface, authentication, authorization**
> Snapshot: tag `as-built-2026-09-03`, commit `2cab09e` (authored 2026-08-30).
> Everything below is read from the code at that commit. `file:line` references are literal. Gaps are stated, not smoothed.

## 1. API surface

### 1.1 There is no OpenAPI/Swagger specification

**Verified absent.** `@nestjs/swagger` appears in neither `backend/package.json` nor `frontend/package.json`, and `backend/src/main.ts` (144 lines, read in full) contains no `SwaggerModule`, `DocumentBuilder`, or `/docs` mount. No `openapi.json`, `openapi.yaml`, or `swagger.json` exists anywhere in the repo. No `@Api*` decorator appears on any controller.

The inventory below was therefore generated mechanically from the controller sources at `2cab09e`: every `*.controller.ts` under `backend/src/` was parsed for `@Controller`, the HTTP-verb decorators, `@Public`, `@UseGuards`, `@RequiresPermission`, and `@Throttle`. It is a description of the code, not of a contract document — because no contract document exists.

> ⚠️ **Gap.** A reviewer cannot diff the API against a published spec, and no machine-readable contract is generated at build time. Clients are validated only by TypeScript types in `frontend/lib/` that are maintained by hand.

### 1.2 Totals

| Measure | Count |
| --- | --- |
| Controller files (`*.controller.ts`) | 68 |
| `@Controller` classes | 72 |
| **Route handlers (HTTP-verb decorators)** | **310** |
| Registered paths (7 handlers in `catalog.controller.ts` declare a `['catalog/…', 'menu/…']` alias pair) | 317 |

Guard posture across the 310 handlers:

| Guard | Handlers | Meaning |
| --- | --- | --- |
| `Public` | 23 | `@Public()` — global `JwtAuthGuard` and `PermissionsGuard` both short-circuit; no credential required |
| `Customer JWT` | 29 | `@UseGuards(CustomerGuard)` **paired with** `@Public()` (see §3.4) |
| `Staff JWT` (no permission) | 73 | authenticated staff token, any role |
| `Staff JWT + permission` | 185 | `@RequiresPermission(...)` |

Permission usage frequency across those 185:

| Permission | Routes | | Permission | Routes |
| --- | --- | --- | --- | --- |
| `MANAGE_OPS` | 66 | | `MANAGE_PROCUREMENT` | 7 |
| `MANAGE_SYSTEM` | 25 | | `MANAGE_INVENTORY` | 6 |
| `MANAGE_POS` | 15 | | `MANAGE_RBAC` | 5 |
| `APPROVE_EVIDENCE` | 11 | | `VIEW_ROLE_SCOPED` | 5 |
| `MANAGE_KITCHEN` | 11 | | `APPROVE_DECISION` | 4 |
| `MANAGE_KPIS` | 9 | | `UPLOAD_EVIDENCE` | 4 |
| `MANAGE_GUIDE` | 7 | | `MANAGE_DELEGATIONS` | 3 |
| `CREATE_MISSION` | 2 | | `CREATE_QUEST` | 2 |
| `VIEW_ALL` | 2 | | `CREATE_DECISION` | 1 |

> ⚠️ Five of the 23 declared `Permission` members never appear in a `@RequiresPermission`: `CREATE_TASK`, `CREATE_ADHOC_TASK`, `UPDATE_OWN_TASK`, `UPDATE_ANY_TASK`, `VERIFY_TASK`. Four of them are enforced in service code instead (`backend/src/tasks/tasks.controller.ts:93-96`, `backend/src/tasks/tasks.service.ts:357,564,631`, `backend/src/evidence/evidence.service.ts:170`, `backend/src/storage/storage.controller.ts:49`). **`VERIFY_TASK` is enforced nowhere.** It is seeded onto three roles (`backend/prisma/seed-data/roles.ts:33,58,93`) and rendered in the RBAC screen, but no code path reads it. See §6.4.

### 1.3 Global request pipeline

Read from `backend/src/main.ts` and `backend/src/app.module.ts`.

**ValidationPipe** — `backend/src/main.ts:122-128`:

```ts
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
```

`whitelist` strips properties with no decorator on the DTO; `forbidNonWhitelisted` turns an unknown body property into a `400` rather than dropping it silently; `transform` runs `plainToInstance`. The posture is strict-by-default on request **bodies**. It does not apply to `@Query()`/`@Param()` values bound as bare `string` — most query parameters in this codebase are bound that way, so unknown query keys are ignored rather than rejected (this is the mechanism behind §6.3).

**Global filters, interceptors, guards:**

| Kind | Class | Registered at | Effect |
| --- | --- | --- | --- |
| Filter | `GlobalExceptionFilter` | `main.ts:116` | safe `500` in production, no stack leakage |
| Interceptor | `DecimalSerializationInterceptor` | `main.ts:119` | converts Prisma `Decimal` to plain JSON numbers on every response |
| Interceptor | `CustomerPresenceInterceptor` | `app.module.ts:175` (`APP_INTERCEPTOR`) | when `req.user.type === 'customer'`, refreshes `Customer.last_seen_at` (throttled to one write per customer per 15 min) and records the matched **route pattern**, not the concrete URL — `backend/src/customers/customer-presence.interceptor.ts:43-55` |
| Guard | `JwtAuthGuard` | `app.module.ts:171` (`APP_GUARD`) | passport-jwt, `@Public()`-aware |
| Guard | `PermissionsGuard` | `app.module.ts:172` (`APP_GUARD`) | `@RequiresPermission` enforcement |
| Guard | `UserAwareThrottlerGuard` | `app.module.ts:173` (`APP_GUARD`) | rate limiting keyed on principal, not IP |

**Other `main.ts` hardening:** `trust proxy = 1` for Cloudflare (`main.ts:25`); 1 MB JSON/urlencoded body cap with raw-body capture **only** for `/webhooks/razorpay` (`main.ts:29-34`); `helmet` with CSP and one-year HSTS (`main.ts:37-53`); CORS restricted to `FRONTEND_URL` + its `www.` variant with `credentials: true` (`main.ts:59-78`); an in-process abuse counter that logs at 500 requests / 5 min / IP (`main.ts:85-113`); `keepAliveTimeout 65s`, `headersTimeout 66s`, `requestTimeout 30s` (`main.ts:137-139`).

**Throttler baseline** — `backend/src/config/throttler.config.ts:8-13`:

| Name | TTL | Limit |
| --- | --- | --- |
| `default` | 60 000 ms | 100 |
| `short` | 1 000 ms | 20 |
| `medium` | 10 000 ms | 20 |
| `long` | 60 000 ms | 100 |

A throttler literally named `default` must exist or every `@Throttle({ default: {...} })` override in the codebase is silently ignored under `@nestjs/throttler` 6.x — the config file says so explicitly. The tracker (`backend/src/common/guards/user-aware-throttler.guard.ts:11-19`) keys on `user.id ?? user.userId ?? user.customerId`, falling back to `cf-connecting-ip` then `req.ip` for anonymous callers.

In the tables below, **Throttle** shows only per-route overrides; `—` means the route inherits the `default` bucket (100 / 60 s per principal).

---

### 1.4 Route inventory

#### Health

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/` | Public | — | `@SkipThrottle` all buckets | Liveness/health check — `app.controller.ts:9` |

#### Staff auth — `backend/src/auth/auth.controller.ts` (8)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/login` | Public | — | 5 / 300 s | Email+password → sets `access_token` + `refresh_token` cookies (L42) |
| POST | `/auth/refresh` | Public | — | 10 / 60 s | Rotates the refresh token, re-issues both cookies (L83) |
| POST | `/auth/logout` | Staff JWT | — | — | Revokes this device's refresh token, clears both cookies (L120) |
| POST | `/auth/logout-all` | Staff JWT | — | — | Revokes every active refresh token for the user (L140) |
| POST | `/auth/forgot-password` | Public | — | 5 / 300 s | Emails a reset link; fixed 200 regardless of account existence (L156) |
| POST | `/auth/reset-password` | Public | — | 5 / 300 s | Consumes a reset token, sets a new password (L164) |
| POST | `/auth/set-password` | Public | — | 5 / 300 s | First-login password set; same code path as reset (L172) |
| GET | `/auth/me` | Staff JWT | — | — | Current staff profile incl. `roleCode` and `permissions` (L178) |

#### Customer auth — `backend/src/customer-auth/customer-auth.controller.ts` (6)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| POST | `/customer-auth/send-otp` | Public | — | 3 / 3600 s | Issues a 6-digit WhatsApp OTP (L45) |
| POST | `/customer-auth/verify-otp` | Public | — | 10 / 3600 s | Verifies OTP, upserts the `Customer`, sets `customer_token` (L52) |
| GET | `/customer-auth/profile` | Customer JWT | — | — | Own profile (`id, phone, name, email, marketing_opt_in`) (L62) |
| PATCH | `/customer-auth/profile` | Customer JWT | — | — | Self-service profile edit; consent change writes an `AuditEvent` (L70) |
| POST | `/customer-auth/logout` | Customer JWT | — | — | Clears `customer_token` (L81) |
| POST | `/customer-auth/pusher-auth` | Customer JWT | — | — | Pusher handshake, pinned to `private-customer-<own id>` (L88) |

#### Mission loop — missions, quests, tasks (16)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/missions` | Staff JWT | — | — | List missions, scope-filtered (`missions.controller.ts:23`) |
| GET | `/missions/mission-control` | Staff JWT | — | — | Mission Control roll-up (L37) |
| GET | `/missions/:id` | Staff JWT | — | — | One mission (L46) |
| POST | `/missions` | Staff JWT | `CREATE_MISSION` | — | Create a mission (L51) |
| PATCH | `/missions/:id` | Staff JWT | `CREATE_MISSION` | — | Edit a mission (L61) |
| GET | `/quests` | Staff JWT | — | — | List quests; `?mine=1` narrows to owned (`quests.controller.ts:24`) |
| GET | `/quests/:id` | Staff JWT | — | — | One quest (L44) |
| POST | `/quests` | Staff JWT | `CREATE_QUEST` | — | Create a quest (L49) |
| PATCH | `/quests/:id` | Staff JWT | `CREATE_QUEST` | — | Edit a quest (L55) |
| GET | `/tasks` | Staff JWT | — | — | List tasks; `mine`/`cursor`/`limit` additive (`tasks.controller.ts:34`) |
| GET | `/tasks/blocked` | Staff JWT | — | — | Blocked-task queue (L66) |
| GET | `/tasks/:id` | Staff JWT | `VIEW_ROLE_SCOPED` | — | One task, with `is_own` (L75) |
| POST | `/tasks` | Staff JWT | *(in-handler)* | — | Create; requires `CREATE_ADHOC_TASK` when `task_type === 'adhoc'`, else `CREATE_TASK`, checked at L93-96 |
| PATCH | `/tasks/:id` | Staff JWT | *(in-service)* | — | Edit; owner-or-`UPDATE_ANY_TASK` in `tasks.service.ts:357` (L101) |
| POST | `/tasks/:id/block` | Staff JWT | *(in-service)* | — | Block a task (L114) |
| POST | `/tasks/:id/unblock` | Staff JWT | *(in-service)* | — | Unblock a task (L127) |

#### Evidence — `backend/src/evidence/evidence.controller.ts` (6, two controllers)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/tasks/:taskId/evidence` | Staff JWT | — | — | Evidence attached to one task (L24) |
| POST | `/tasks/:taskId/evidence` | Staff JWT | `UPLOAD_EVIDENCE` | — | Attach proof to a task (L29) |
| GET | `/evidence/feed` | Staff JWT | `UPLOAD_EVIDENCE` | — | Paginated evidence feed, `?status=` (L50) |
| GET | `/evidence` | Staff JWT | `APPROVE_EVIDENCE` | — | Review queue, scope-filtered; `?status=` (L64) — see §6.3 |
| POST | `/evidence/:id/approve` | Staff JWT | `APPROVE_EVIDENCE` | — | Approve (L86) |
| POST | `/evidence/:id/reject` | Staff JWT | `APPROVE_EVIDENCE` | — | Reject, note required (L96) |

#### Approvals & policies (11)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/approvals` | Staff JWT | `APPROVE_EVIDENCE` | — | Inbox: `?mine=1&status=pending` (`approvals.controller.ts:33`) |
| GET | `/approvals/count` | Staff JWT | `APPROVE_EVIDENCE` | — | "Waiting on me" badge (L43) |
| GET | `/approvals/pending` | Staff JWT | `APPROVE_EVIDENCE` | — | All pending, unnarrowed (v1 route) (L50) |
| POST | `/approvals/:id/decide` | Staff JWT | `APPROVE_EVIDENCE` | — | `{ decision, note? }` (L57) |
| POST | `/approvals/:id/approve` | Staff JWT | `APPROVE_EVIDENCE` | — | v1 alias of decide (L68) |
| POST | `/approvals/:id/reject` | Staff JWT | `APPROVE_EVIDENCE` | — | Alias; note mandatory (L83) |
| POST | `/approvals/:id/override` | Staff JWT | `MANAGE_SYSTEM` | — | Founder override of a gate (L97) |
| GET | `/approval-policies` | Staff JWT | `MANAGE_SYSTEM` | — | List policies (`approval-policies.controller.ts:25`) |
| POST | `/approval-policies` | Staff JWT | `MANAGE_SYSTEM` | — | Create (L31) |
| PATCH | `/approval-policies/:id` | Staff JWT | `MANAGE_SYSTEM` | — | Edit (L37) |
| DELETE | `/approval-policies/:id` | Staff JWT | `MANAGE_SYSTEM` | — | Remove (L46) |

#### Decisions & delegations (12)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/decisions` | Staff JWT | `VIEW_ROLE_SCOPED` | — | Decision log (`decisions.controller.ts:35`) |
| GET | `/decisions/:id` | Staff JWT | `VIEW_ROLE_SCOPED` | — | One decision (L45) |
| GET | `/decisions/:id/votes` | Staff JWT | `VIEW_ROLE_SCOPED` | — | Votes cast (L51) |
| POST | `/decisions` | Staff JWT | `CREATE_DECISION` | — | Log a decision (L57) |
| POST | `/decisions/:id/votes` | Staff JWT | `VIEW_ROLE_SCOPED` | — | Cast a tier-2 vote; the real ACL is the decision's own `required_role_codes`, enforced in the service (L70, see the comment at L63-69) |
| POST | `/decisions/:id/resolve` | Staff JWT | `APPROVE_DECISION` | — | Resolve (L80) |
| POST | `/decisions/:id/reopen` | Staff JWT | `APPROVE_DECISION` | — | Reopen (L90) |
| PATCH | `/decisions/:id` | Staff JWT | `APPROVE_DECISION` | — | Edit (L99) |
| DELETE | `/decisions/:id` | Staff JWT | `APPROVE_DECISION` | — | Delete (L111) |
| GET | `/delegations` | Staff JWT | `MANAGE_DELEGATIONS` | — | List approval delegations (`delegations.controller.ts:21`) |
| POST | `/delegations` | Staff JWT | `MANAGE_DELEGATIONS` | — | Create (L27) |
| PATCH | `/delegations/:id/deactivate` | Staff JWT | `MANAGE_DELEGATIONS` | — | Deactivate (L37) — see §6.1 |

#### Readiness, activity, leaderboard, me, search (10)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/readiness-meters` | Staff JWT | — | — | All meters for the node (`readiness.controller.ts:28`) |
| POST | `/readiness-meters/recompute` | Staff JWT | `MANAGE_SYSTEM` | — | Governance recompute of every meter (L34) |
| GET | `/readiness-meters/:id/tasks` | Staff JWT | — | — | Tasks feeding a meter (L40) |
| GET | `/readiness-meters/:code/history` | Staff JWT | — | — | Meter history (L45) |
| GET | `/readiness-meters/:code/signals` | Staff JWT | — | — | Signal breakdown (L53) |
| GET | `/activity` | Staff JWT | — | — | Activity feed (`activity.controller.ts:8`) |
| GET | `/activity/contributions` | Staff JWT | — | — | Contribution heatmap (L19) |
| GET | `/leaderboard` | Staff JWT | — | — | XP leaderboard (`leaderboard.controller.ts:8`) |
| GET | `/me/header` | Staff JWT | — | — | Whole persistent header in one round trip (`me.controller.ts:15`) |
| GET | `/search` | Staff JWT | — | — | ⌘K search; each bucket separately scoped in the service (`search.controller.ts:22`) |

#### Chat & realtime (13)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| POST | `/chat/auth` | Staff JWT | — | — | Pusher handshake for chat channels (`chat.controller.ts:33`) |
| GET | `/chat/team-members` | Staff JWT | — | — | User picker (L59) |
| POST | `/chat/conversations` | Staff JWT | — | — | Start a conversation (L73) |
| GET | `/chat/conversations` | Staff JWT | — | — | Own conversations (L92) |
| GET | `/chat/conversations/:id` | Staff JWT | — | — | One conversation (L97) |
| GET | `/chat/conversations/:id/messages` | Staff JWT | — | — | Message page (L103) |
| POST | `/chat/conversations/:id/messages` | Staff JWT | — | — | Send (L118) |
| PATCH | `/chat/conversations/:id/read` | Staff JWT | — | — | Mark read (L147) |
| PATCH | `/chat/conversations/:id/members` | Staff JWT | `MANAGE_SYSTEM` | — | Add group members (L155) |
| DELETE | `/chat/conversations/:id/members` | Staff JWT | `MANAGE_SYSTEM` | — | Remove group members (L164) |
| GET | `/chat/admin/conversations` | Staff JWT | `MANAGE_SYSTEM` | — | Admin oversight: all conversations (L175) |
| GET | `/chat/admin/conversations/:id/messages` | Staff JWT | `MANAGE_SYSTEM` | — | Admin oversight: messages (L181) |
| POST | `/realtime/auth` | Staff JWT | — | — | Pusher private-channel handshake for ops channels; per-channel rules in `RealtimeService` (`realtime.controller.ts:14`) |

#### Notifications (7)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| POST | `/notifications/qstash-webhook` | Public | — | — | QStash job intake; Upstash signature verified in-handler (`notifications.controller.ts:67`) |
| GET | `/notifications` | Staff JWT | — | — | Own notifications (L98) |
| GET | `/notifications/unread-count` | Staff JWT | — | — | Badge count (L103) |
| PATCH | `/notifications/:id/read` | Staff JWT | — | — | Mark one read (L108) |
| POST | `/notifications/read-all` | Staff JWT | — | — | Mark all read (L114) |
| POST | `/notifications/broadcast` | Staff JWT | `MANAGE_SYSTEM` | — | Broadcast a notice (L120) |
| PATCH | `/me/notification-prefs` | Staff JWT | — | — | Per-channel notification preferences (`users/notification-prefs.controller.ts:25`) |

#### Catalog and product reviews (21)

`@Controller()` has no prefix; every path is declared on the method. Seven routes carry a `menu/*` alias for P1 clients.

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/catalog/categories` *(alias `/menu/categories`)* | Public | — | 30 / 60 s | Storefront category list (L45) |
| POST | `/catalog/categories` | Staff JWT | `MANAGE_OPS` | — | Create category (L52) |
| PATCH | `/catalog/categories/:id` | Staff JWT | `MANAGE_OPS` | — | Edit category (L61) |
| DELETE | `/catalog/categories/:id` | Staff JWT | `MANAGE_OPS` | — | Remove category (L71) |
| GET | `/catalog/products/staff` *(alias `/menu/items/staff`)* | Staff JWT | — | — | Bare `Product[]` for ops menu and POS grids (L87) |
| GET | `/catalog/search` | Public | — | 30 / 60 s | `{ items, facets, next_cursor }` (L105) |
| GET | `/catalog/products/slug/:slug` | Public | — | 30 / 60 s | Product detail by slug (L124) |
| GET | `/catalog/products` *(alias `/menu/items`)* | Public | — | 30 / 60 s | `{ items, next_cursor }` (L135) |
| POST | `/catalog/products` | Staff JWT | `MANAGE_OPS` | — | Create product (L154) |
| PATCH | `/catalog/products/:id/publish` | Staff JWT | `MANAGE_OPS` | — | Publish (status → `active`) (L160) |
| PATCH | `/catalog/products/:id` | Staff JWT | `MANAGE_OPS` | — | Edit product (L169) |
| DELETE | `/catalog/products/:id` | Staff JWT | `MANAGE_OPS` | — | Archive (soft; `OrderItem.product_id` is a hard FK) (L180) |
| PATCH | `/catalog/variants` | Staff JWT | `MANAGE_OPS` | — | Upsert a variant (L193) |
| DELETE | `/catalog/variants/:id` | Staff JWT | `MANAGE_OPS` | — | Remove a variant (L204) |
| POST | `/catalog/products/:id/media` | Staff JWT | `MANAGE_OPS` | — | Attach media (L213) |
| DELETE | `/catalog/media/:id` | Staff JWT | `MANAGE_OPS` | — | Detach media (L223) |
| GET | `/catalog/availability` *(alias `/menu/availability`)* | Public | — | 30 / 60 s | Batch servings-available (L237) |
| GET | `/catalog/availability/:productId` *(alias `/menu/availability/:productId`)* | Public | — | 30 / 60 s | Single-product live availability for `/p/[slug]` (L247) |
| GET | `/catalog/channel-modifiers` *(alias `/menu/channel-modifiers`)* | Staff JWT | — | — | Channel price modifiers (L258) |
| PATCH | `/catalog/channel-modifiers` *(alias `/menu/channel-modifiers`)* | Staff JWT | `MANAGE_OPS` | — | Upsert a modifier (L263) |
| GET | `/catalog/products/:id/reviews` | Public | — | 30 / 60 s | Published reviews for a product (`reviews.controller.ts:156`) |

#### Brands, zones, channels, assets (19)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/brands` | Public | — | 30 / 60 s | Storefront brand list (`brands.controller.ts:26`) |
| GET | `/brands/:id` | Staff JWT | — | — | One brand (L33) |
| POST | `/brands` | Staff JWT | `MANAGE_OPS` | — | Create (L38) |
| PATCH | `/brands/:id` | Staff JWT | `MANAGE_OPS` | — | Edit (L44) |
| DELETE | `/brands/:id` | Staff JWT | `MANAGE_OPS` | — | Remove (L56) |
| GET | `/zones` | Staff JWT | — | — | List zones (`zones.controller.ts:23`) |
| GET | `/zones/:id` | Staff JWT | — | — | One zone (L28) |
| POST | `/zones` | Staff JWT | `MANAGE_OPS` | — | Create (L33) |
| PATCH | `/zones/:id` | Staff JWT | `MANAGE_OPS` | — | Edit (L39) |
| DELETE | `/zones/:id` | Staff JWT | `MANAGE_OPS` | — | Remove (L51) |
| GET | `/channels` | Staff JWT | — | — | List channels (`channels.controller.ts:20`) |
| GET | `/channels/:id` | Staff JWT | — | — | One channel (L25) |
| POST | `/channels` | Staff JWT | `MANAGE_OPS` | — | Create (L30) |
| PATCH | `/channels/:id` | Staff JWT | `MANAGE_OPS` | — | Edit (L36) |
| GET | `/assets` | Staff JWT | — | — | List assets (`assets.controller.ts:24`) |
| GET | `/assets/:id` | Staff JWT | — | — | One asset (L32) |
| POST | `/assets` | Staff JWT | `MANAGE_OPS` | — | Create (L37) |
| PATCH | `/assets/:id` | Staff JWT | `MANAGE_OPS` | — | Edit (L44) |
| DELETE | `/assets/:id` | Staff JWT | `MANAGE_OPS` | — | Remove (L56) |

#### Experiences / events — `backend/src/events/events.controller.ts` (11)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/events` | Public | — | 30 / 60 s | Upcoming experiences (L31) |
| GET | `/events/all` | Staff JWT | `MANAGE_OPS` | — | All events incl. past/unpublished (L39) — declared before `:id` to avoid shadowing |
| GET | `/events/:id` | Public | — | 30 / 60 s | One event (L45) |
| POST | `/events` | Staff JWT | `MANAGE_OPS` | — | Create (L52) |
| PATCH | `/events/:id` | Staff JWT | `MANAGE_OPS` | — | Edit (L58) |
| DELETE | `/events/:id` | Staff JWT | `MANAGE_OPS` | — | Remove (L67) |
| POST | `/events/:id/checkout` | Customer JWT | — | 5 / 60 s | Start a booking checkout (L73) |
| POST | `/events/:id/bookings/confirm` | Customer JWT | — | 5 / 60 s | Confirm a paid booking (L85) |
| POST | `/events/:id/bookings` | **Public** | — | 5 / 300 s | **Anonymous guest booking** — no customer token required (L97) |
| GET | `/events/:id/bookings` | Staff JWT | `MANAGE_OPS` | — | Booking list for the host (L109) |
| POST | `/events/:id/attendance` | Staff JWT | `MANAGE_OPS` | — | Mark `attended` / `no_show`; opens the review gate (L120) |

#### Storefront checkout & customer commerce (23)

All of these carry `@UseGuards(CustomerGuard)` + `@Public()` at class level.

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| POST | `/customer/checkout/quote` | Customer JWT | — | 20 / 60 s | Price the cart; the cart comes from Redis, never the body (`checkout.controller.ts:52`) |
| POST | `/customer/checkout/serviceability` | Customer JWT | — | 20 / 60 s | Pincode pre-check (L70) |
| POST | `/customer/coupons/validate` | Customer JWT | — | 10 / 60 s | "Will this code work?" — tighter throttle, this is what a code-guesser hammers (L89) |
| GET | `/customer/cart` | Customer JWT | — | 20 / 60 s | Cart, re-priced from the DB on every read (`customer-orders.controller.ts:41`) |
| POST | `/customer/cart/sync` | Customer JWT | — | 20 / 60 s | Push local cart to Redis (L47) |
| DELETE | `/customer/cart` | Customer JWT | — | 20 / 60 s | Empty cart (L56) |
| POST | `/customer/orders` | Customer JWT | — | 5 / 60 s | Create a pending order (L72) |
| POST | `/customer/orders/confirm` | Customer JWT | — | 5 / 60 s | Confirm after gateway payment (L79) |
| GET | `/customer/orders` | Customer JWT | — | 20 / 60 s | Own order history (L86) |
| GET | `/customer/orders/:id/receipt` | Customer JWT | — | 20 / 60 s | Receipt (declared before `:id`) (L93) |
| GET | `/customer/orders/:id/shipment` | Customer JWT | — | 20 / 60 s | Tracking; `null` when nothing shipped (L101) |
| GET | `/customer/orders/:id` | Customer JWT | — | 20 / 60 s | One own order (L110) |
| GET | `/customer/bookings` | Customer JWT | — | 20 / 60 s | Own experience bookings (L120) |
| GET | `/customer/bookings/:id/receipt` | Customer JWT | — | 20 / 60 s | Booking receipt (L126) |
| POST | `/customer/addresses` | Customer JWT | — | 20 / 60 s | Add address (L137) |
| GET | `/customer/addresses` | Customer JWT | — | 20 / 60 s | List addresses (L146) |
| PATCH | `/customer/addresses/:id` | Customer JWT | — | 20 / 60 s | Edit address (L152) |
| DELETE | `/customer/addresses/:id` | Customer JWT | — | 20 / 60 s | Delete address (L162) |
| PATCH | `/customer/addresses/:id/default` | Customer JWT | — | 20 / 60 s | Set default address (L172) |
| GET | `/customer/loyalty` | Customer JWT | — | 30 / 60 s | Own points balance and ledger (`loyalty.controller.ts:35`) |
| GET | `/customer/reviews` | Customer JWT | — | 30 / 60 s | Own reviews incl. unmoderated (`reviews.controller.ts:69`) |
| GET | `/customer/reviews/pending` | Customer JWT | — | 30 / 60 s | Delivered/attended lines not yet reviewed (L77) |
| POST | `/customer/reviews` | Customer JWT | — | 10 / 60 s | Submit a review — `400` not delivered · `403` other customer · `409` duplicate (L85) |

#### Staff orders, POS, refunds, feedback (16)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| POST | `/orders` | Staff JWT | `MANAGE_POS` | — | Take an order at the till (`orders.controller.ts:38`) |
| GET | `/orders` | Staff JWT | `MANAGE_POS` | — | Order list (L44) |
| GET | `/orders/daily-summary` | Staff JWT | `MANAGE_POS` | — | Day summary (before `:id`) (L51) |
| GET | `/orders/:id/qr` | Staff JWT | `MANAGE_POS` | — | Order QR (L60) |
| GET | `/orders/:id` | Staff JWT | `MANAGE_POS` | — | One order (L66) |
| PATCH | `/orders/:id/status` | Staff JWT | `MANAGE_POS` | — | Status transition (L72) |
| POST | `/orders/:id/complete` | Staff JWT | `MANAGE_POS` | — | Close out; re-completing is a no-op (L91) |
| POST | `/orders/:id/payment` | Staff JWT | `MANAGE_POS` | — | Record a payment (L97) |
| POST | `/orders/:id/razorpay-order` | Staff JWT | `MANAGE_POS` | 5 / 60 s | Create a gateway order (L106) |
| POST | `/orders/:id/razorpay-confirm` | Staff JWT | `MANAGE_POS` | 5 / 60 s | Confirm a gateway payment (L113) |
| PATCH | `/orders/:id/delivery` | Staff JWT | `MANAGE_POS` | — | Delivery details (L123) |
| POST | `/orders/:id/refund` | Staff JWT | `MANAGE_POS` | — | Issue a refund (`refunds.controller.ts:34`) |
| GET | `/orders/:id/refunds` | Staff JWT | `MANAGE_POS` | — | Refund history (L44) |
| POST | `/feedback` | Public | — | 5 / 300 s | Anonymous QR feedback (`feedback.controller.ts:14`) |
| GET | `/feedback/stats` | Staff JWT | `MANAGE_POS` | — | Feedback stats (before any `:param`) (L22) |
| GET | `/feedback` | Staff JWT | `MANAGE_POS` | — | Feedback list (L28) — see §6.5 |

#### Fulfilment / kitchen (12)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/kitchen/kds` | Staff JWT | `MANAGE_KITCHEN` | — | Active KDS tickets (`kds.controller.ts:24`) |
| PATCH | `/kitchen/kds/items/:id/status` | Staff JWT | `MANAGE_KITCHEN` | — | Advance an item's status (L30) |
| GET | `/kitchen/pick-and-pack` | Staff JWT | `MANAGE_KITCHEN` | — | Pick-and-pack queue (`pick-and-pack.controller.ts:10`) |
| PATCH | `/kitchen/pick-and-pack/items/:id/picked` | Staff JWT | `MANAGE_KITCHEN` | — | Mark item picked (L16) |
| GET | `/kitchen/prep-batches` | Staff JWT | — | — | Prep batch list (`prep-batches.controller.ts:20`) |
| POST | `/kitchen/prep-batches` | Staff JWT | `MANAGE_KITCHEN` | — | Create a batch (L30) |
| POST | `/kitchen/prep-batches/preview` | Staff JWT | `MANAGE_KITCHEN` | — | Dry-run ingredient draw (L40) |
| GET | `/kitchen/supply-usage` | Staff JWT | `MANAGE_KITCHEN` | — | Supply usage log (`supply-usage.controller.ts:12`) |
| POST | `/kitchen/supply-usage` | Staff JWT | `MANAGE_KITCHEN` | — | Log supply usage (L18) |
| GET | `/kitchen/waste` | Staff JWT | `MANAGE_KITCHEN` | — | Waste log (`waste.controller.ts:19`) |
| POST | `/kitchen/waste` | Staff JWT | `MANAGE_KITCHEN` | — | Log waste (L29) |
| GET | `/kitchen/metrics` | Staff JWT | `MANAGE_KITCHEN` | — | Kitchen metrics summary (`kitchen-metrics.controller.ts:12`) |

#### Shipments (7)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/shipments` | Staff JWT | `MANAGE_OPS` | — | Shipment list (`shipments.controller.ts:39`) |
| GET | `/shipments/:id` | Staff JWT | `MANAGE_OPS` | — | One shipment (L53) |
| POST | `/shipments/pack` | Staff JWT | `MANAGE_OPS` | — | Pack order lines into a shipment (L59) |
| POST | `/shipments/:id/awb` | Staff JWT | `MANAGE_OPS` | — | Assign an AWB via the courier (L65) |
| POST | `/shipments/:id/pickup` | Staff JWT | `MANAGE_OPS` | — | Schedule pickup (L75) |
| GET | `/shipments/:id/label` | Staff JWT | `MANAGE_OPS` | — | Fetch the shipping label (L84) |
| POST | `/shipments/:id/cancel` | Staff JWT | `MANAGE_OPS` | — | Cancel the shipment (L93) |

#### Inventory, ingredients, recipes (23)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/inventory` | Staff JWT | `MANAGE_INVENTORY` | — | Stock by ingredient/zone (`inventory.controller.ts:21`) |
| GET | `/inventory/low-stock` | Staff JWT | `MANAGE_INVENTORY` | — | Below-threshold list (L30) |
| GET | `/inventory/:ingredientId/movements` | Staff JWT | `MANAGE_INVENTORY` | — | Movement ledger (L36) |
| POST | `/inventory/adjust` | Staff JWT | `MANAGE_INVENTORY` | — | Manual stock adjustment (L46) |
| GET | `/ingredients` | Staff JWT | — | — | Ingredient list (`ingredients.controller.ts:22`) |
| GET | `/ingredients/:id` | Staff JWT | — | — | One ingredient (L30) |
| GET | `/ingredients/:id/compatible-units` | Staff JWT | — | — | Convertible units (L35) |
| POST | `/ingredients` | Staff JWT | `MANAGE_OPS` | — | Create (L40) |
| PATCH | `/ingredients/:id` | Staff JWT | `MANAGE_OPS` | — | Edit (L46) |
| DELETE | `/ingredients/:id` | Staff JWT | `MANAGE_OPS` | — | Remove (L55) |
| GET | `/ingredient-categories` | Staff JWT | — | — | Category list (`ingredient-categories.controller.ts:11`) |
| POST | `/ingredient-categories` | Staff JWT | `MANAGE_INVENTORY` | — | Create (L16) |
| DELETE | `/ingredient-categories/:id` | Staff JWT | `MANAGE_INVENTORY` | — | Remove (L22) |
| GET | `/recipes` | Staff JWT | — | — | Recipe list (`recipes.controller.ts:25`) |
| GET | `/recipes/cost-data` | Staff JWT | — | — | Cost inputs (before `:id`) (L34) |
| GET | `/recipes/:id` | Staff JWT | — | — | One recipe (L39) |
| GET | `/recipes/:id/approvals` | Staff JWT | — | — | The policy-generated approval gate (L45) |
| POST | `/recipes` | Staff JWT | `MANAGE_OPS` | — | Create (L50) |
| PATCH | `/recipes/:id` | Staff JWT | `MANAGE_OPS` | — | Edit (L60) |
| POST | `/recipes/:id/submit` | Staff JWT | `MANAGE_OPS` | — | Submit for approval (`draft → pending`) (L77) |
| POST | `/recipes/:id/version` | Staff JWT | `MANAGE_OPS` | — | New version (L88) |
| POST | `/recipes/:id/cost-preview` | Staff JWT | `MANAGE_OPS` | — | Cost preview (L98) |
| DELETE | `/recipes/:id` | Staff JWT | `MANAGE_OPS` | — | Remove (L109) |

#### Procurement, vendors, purchase orders (14)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/procurement/summary` | Staff JWT | `MANAGE_PROCUREMENT` | — | Procurement dashboard (`procurement.controller.ts:10`) |
| GET | `/purchase-orders` | Staff JWT | `MANAGE_PROCUREMENT` | — | PO list (`purchase-orders.controller.ts:42`) |
| GET | `/purchase-orders/:id` | Staff JWT | `MANAGE_PROCUREMENT` | — | One PO (L48) |
| POST | `/purchase-orders` | Staff JWT | `MANAGE_PROCUREMENT` | — | Raise a PO (L54) |
| PATCH | `/purchase-orders/:id` | Staff JWT | `MANAGE_PROCUREMENT` | — | Edit (L64) |
| POST | `/purchase-orders/:id/receive` | Staff JWT | `MANAGE_PROCUREMENT` | — | Receive goods → stock movement (L75) |
| POST | `/purchase-orders/:id/cancel` | Staff JWT | `MANAGE_PROCUREMENT` | — | Cancel (L86) |
| GET | `/vendors` | Staff JWT | — | — | Vendor list (`vendors.controller.ts:23`) |
| GET | `/vendors/prices/ingredient/:ingredientId` | Staff JWT | — | — | Price history for an ingredient (L28) |
| GET | `/vendors/:id` | Staff JWT | — | — | One vendor (L35) |
| POST | `/vendors` | Staff JWT | `MANAGE_OPS` | — | Create vendor (L40) |
| POST | `/vendors/prices` | Staff JWT | `MANAGE_OPS` | — | Add a vendor price (L46) |
| PATCH | `/vendors/:id` | Staff JWT | `MANAGE_OPS` | — | Edit vendor (L52) |
| DELETE | `/vendors/:id` | Staff JWT | `MANAGE_OPS` | — | Remove vendor (L61) |

#### Customers, promotions, staff loyalty, staff reviews (12)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/customers` | Staff JWT | `MANAGE_OPS` | — | Customer list (`customers.controller.ts:38`) |
| GET | `/customers/:id` | Staff JWT | `MANAGE_OPS` | — | Customer detail (L48) |
| PATCH | `/customers/:id` | Staff JWT | `MANAGE_OPS` | — | Marketing consent toggle — the only staff-side write on `Customer` (L55) |
| POST | `/customers/:id/loyalty-adjust` | Staff JWT | `MANAGE_OPS` | — | Manual points adjustment + `AuditEvent` (`loyalty.controller.ts:52`) |
| GET | `/promotions/coupons` | Staff JWT | `MANAGE_OPS` | — | Coupon list (`coupons.controller.ts:38`) |
| GET | `/promotions/coupons/:id` | Staff JWT | `MANAGE_OPS` | — | One coupon (L44) |
| POST | `/promotions/coupons` | Staff JWT | `MANAGE_OPS` | — | Create (L50) |
| PATCH | `/promotions/coupons/:id` | Staff JWT | `MANAGE_OPS` | — | Edit (L56) |
| DELETE | `/promotions/coupons/:id` | Staff JWT | `MANAGE_OPS` | — | Disable (redeemed coupons are never deleted) (L67) |
| GET | `/reviews` | Staff JWT | `MANAGE_OPS` | — | Moderation queue (`reviews.controller.ts:97`) |
| PATCH | `/reviews/:id/publish` | Staff JWT | `MANAGE_OPS` | — | Publish + recompute product rollup (L112) |
| PATCH | `/reviews/:id/hide` | Staff JWT | `MANAGE_OPS` | — | Un-publish (L128) |

#### Daily close (4)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/daily-close` | Staff JWT | `MANAGE_OPS` | — | Close history (`daily-close.controller.ts:28`) |
| GET | `/daily-close/:date` | Staff JWT | `MANAGE_OPS` | — | One business day (L35) |
| POST | `/daily-close/:date/recompute` | Staff JWT | `MANAGE_OPS` | — | Refresh an `open` day; a `signed` day returns untouched rather than erroring (L49) |
| POST | `/daily-close/:date/sign` | Staff JWT | `MANAGE_OPS` | — | Sign off; signer identity checked in the service against `daily_close.signer_role_codes` (L57) |

#### AI (4)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/ai/morning-brief/latest` | Staff JWT | — | — | Most recent brief for the caller, or `null` (`morning-brief.controller.ts:31`) |
| POST | `/ai/morning-brief/generate` | Staff JWT | `MANAGE_SYSTEM` | `short` 10 / 60 s | Manual re-run; defaults to yesterday (L46) |
| POST | `/evidence/:id/review-assist` | Staff JWT | `APPROVE_EVIDENCE` | `short` 10 / 60 s | Generate a review suggestion — a route that costs money per call, so throttled (`evidence-assist.controller.ts:24`) |
| GET | `/evidence/:id/review-assist` | Staff JWT | `APPROVE_EVIDENCE` | — | Read the newest stored suggestion; never spends a model call (L35) |

#### Analytics, KPIs, exports, usage, audit (16)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/analytics/channels` | Staff JWT | `MANAGE_KPIS` | — | Revenue by channel (`analytics.controller.ts:11`) |
| GET | `/analytics/recipe-costs` | Staff JWT | `MANAGE_KPIS` | — | Recipe cost table (L17) |
| GET | `/analytics/revenue` | Staff JWT | `MANAGE_KPIS` | — | Revenue series (L23) |
| GET | `/analytics/summary` | Staff JWT | `MANAGE_KPIS` | — | Headline summary (L29) |
| GET | `/analytics/top-items` | Staff JWT | `MANAGE_KPIS` | — | Best sellers (L35) |
| GET | `/analytics/wins` | Staff JWT | `MANAGE_KPIS` | — | Wins feed (L41) |
| GET | `/analytics/food-cost` | Staff JWT | `MANAGE_KPIS` | — | Food-cost percentage (`food-cost.controller.ts:21`) |
| GET | `/kpis` | Staff JWT | — | — | KPI list (`kpis.controller.ts:23`) |
| GET | `/kpis/:id` | Staff JWT | — | — | One KPI (L33) |
| POST | `/kpis` | Staff JWT | `MANAGE_KPIS` | — | Create (L38) |
| PATCH | `/kpis/:id` | Staff JWT | `MANAGE_KPIS` | — | Edit (L44) |
| POST | `/exports/generate` | Staff JWT | *(in-handler)* | — | Generate an export; the required permission varies by report type and is checked in the service (`exports.controller.ts:30`) |
| GET | `/exports/history` | Staff JWT | `MANAGE_SYSTEM` | — | Export history (L47) — see §6.2 |
| POST | `/usage` | Staff JWT | — | — | Telemetry ingest; returns 202 without awaiting the write (`usage.controller.ts:35`) |
| GET | `/usage/summary` | Staff JWT | `MANAGE_SYSTEM` | — | `/admin/usage` roll-up (L50) |
| GET | `/audit` | Staff JWT | `MANAGE_SYSTEM` | — | Audit event log (`audit.controller.ts:10`) |

#### Admin — users, roles, modules, settings, node, imports, guide, storage, mission bridge (36)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| GET | `/users` | Staff JWT | `VIEW_ALL` | — | User directory (`users.controller.ts:24`) |
| GET | `/users/:id` | Staff JWT | `VIEW_ALL` | — | One user (L38) |
| POST | `/users` | Staff JWT | `MANAGE_RBAC` | — | Create a user (L44) |
| PATCH | `/users/:id` | Staff JWT | `MANAGE_RBAC` | — | Edit a user (L63) |
| POST | `/users/:id/reset-password` | Staff JWT | `MANAGE_RBAC` | — | Send a reset link (L72) |
| POST | `/users/:id/deactivate` | Staff JWT | `MANAGE_RBAC` | — | Deactivate (L79) |
| GET | `/roles` | Staff JWT | — | — | Role list with permission arrays (`roles.controller.ts:18`) |
| PATCH | `/roles/:id/permissions` | Staff JWT | `MANAGE_RBAC` | — | Rewrite a role's permission set (L24) |
| GET | `/modules` | Staff JWT | — | — | All module-access rows (`module-access.controller.ts:35`) |
| GET | `/modules/mine` | Staff JWT | — | — | Modules visible to the caller's role — drives nav (L40) |
| PATCH | `/modules/:key` | Staff JWT | `MANAGE_SYSTEM` | — | Edit a module's role list / sort order (L48) |
| GET | `/settings/:key` | Staff JWT | `MANAGE_SYSTEM` | — | Read a `SystemSetting` (`settings.controller.ts:17`) |
| PATCH | `/settings/:key` | Staff JWT | `MANAGE_SYSTEM` | — | Write a `SystemSetting` (L23) |
| GET | `/nodes/current` | Staff JWT | — | — | Current node incl. timezone (`node.controller.ts:11`) |
| PATCH | `/nodes/current` | Staff JWT | `MANAGE_SYSTEM` | — | Edit node config (L16) |
| GET | `/mission-bridge/dispatches` | Staff JWT | `MANAGE_SYSTEM` | — | Mission-bridge dispatch log (`mission-bridge.controller.ts:15`) |
| POST | `/imports/parse` | Staff JWT | `MANAGE_SYSTEM` | — | Parse an upload into a preview (`imports.controller.ts:28`) |
| POST | `/imports/commit` | Staff JWT | `MANAGE_SYSTEM` | — | Commit a parsed import (L81) |
| GET | `/imports/prerequisites` | Staff JWT | `MANAGE_SYSTEM` | — | What must exist before importing (L93) |
| GET | `/imports/template/:type` | Staff JWT | `MANAGE_SYSTEM` | — | XLSX template (L99) |
| GET | `/imports/template/:type/csv` | Staff JWT | `MANAGE_SYSTEM` | — | CSV template (L120) |
| GET | `/guide/search` | Staff JWT | — | — | Guide full-text search (`guides.controller.ts:28`) |
| GET | `/guide/sections` | Staff JWT | — | — | Section tree (L36) |
| GET | `/guide/sections/:id` | Staff JWT | — | — | One section (L42) |
| POST | `/guide/sections` | Staff JWT | `MANAGE_GUIDE` | — | Create section (L53) |
| PATCH | `/guide/sections/:id` | Staff JWT | `MANAGE_GUIDE` | — | Edit section (L59) |
| DELETE | `/guide/sections/:id` | Staff JWT | `MANAGE_GUIDE` | — | Remove section (L68) |
| GET | `/guide/pages/:id` | Staff JWT | — | — | One page (L76) |
| POST | `/guide/pages` | Staff JWT | `MANAGE_GUIDE` | — | Create page (L87) |
| PATCH | `/guide/pages/:id` | Staff JWT | `MANAGE_GUIDE` | — | Edit page (L93) |
| DELETE | `/guide/pages/:id` | Staff JWT | `MANAGE_GUIDE` | — | Remove page (L102) |
| POST | `/storage/presign` | Staff JWT | `UPLOAD_EVIDENCE` | — | Presigned R2 PUT for evidence; additionally checks `UPDATE_ANY_TASK` for non-owners at L49 (`storage.controller.ts:28`) |
| POST | `/storage/presign-asset` | Staff JWT | `UPLOAD_EVIDENCE` | — | Presign for asset media (L67) |
| POST | `/storage/presign-guide` | Staff JWT | `MANAGE_GUIDE` | — | Presign for guide media (L77) |
| POST | `/storage/presign-product-media` | Staff JWT | `MANAGE_OPS` | — | Presign for catalog media, matched to the route that consumes the URL (L93) |
| POST | `/storage/presign-chat` | Staff JWT | — | — | Presign for chat attachments (L103) |

#### Webhooks (2, plus the QStash intake listed under Notifications)

| Method | Path | Guard | Permission | Throttle | Purpose |
| --- | --- | --- | --- | --- | --- |
| POST | `/webhooks/razorpay` | Public + HMAC | — | 100 / 60 s | Payment events; body HMAC + Redis dedup (`webhooks.controller.ts:26`) |
| POST | `/webhooks/shiprocket` | Public + shared secret | — | 300 / 60 s | Courier tracking callback (`webhooks.controller.ts:60`) |

---

## 2. Staff authentication

### 2.1 Credential store

`User.password_hash` holds a **bcrypt** hash. Verification is `bcrypt.compare` (`backend/src/auth/auth.service.ts:58`). New hashes are written with **cost factor 12** on password reset (`auth.service.ts:272`). Login also requires `user.status === 'active'` (`auth.service.ts:56`); an inactive account fails identically to a wrong password, so status is not enumerable.

### 2.2 Tokens

Two token kinds, deliberately signed with **different secrets** so a stolen refresh token cannot be replayed as a bearer credential.

| | Access | Refresh |
| --- | --- | --- |
| Signing secret | `JWT_SECRET` | `JWT_REFRESH_SECRET` |
| Claim | `token_use: 'access'` | `token_use: 'refresh'` |
| Expiry | `15m` — **hardcoded** at `auth.service.ts:38` | `7d` — **hardcoded** at `auth.service.ts:46` |
| Payload | `{ userId, roleCode, type: 'staff', token_use }` | same |
| Server-side record | none (stateless) | SHA-256 hash row in `RefreshToken` with `expires_at` and `revoked_at` |

> ⚠️ **Correction to a common assumption: token lifetimes are NOT environment-driven.** `'15m'` and `'7d'` are string literals in `backend/src/auth/auth.service.ts:34-47`, and `JwtModule.registerAsync` hardcodes `signOptions: { expiresIn: '15m' }` at `backend/src/auth/auth.module.ts:19`. Only the *secrets* come from env. Cookie `maxAge` values (`auth.controller.ts:63,72`) are separate literals that happen to match. Changing a lifetime requires a code change and a redeploy.

`JWT_REFRESH_SECRET` resolution — `backend/src/auth/refresh-secret.ts:9-22`: use the explicit env var if set; **throw at boot** if `NODE_ENV=production` and it is missing; otherwise derive `` `${JWT_SECRET}.refresh` `` and log a warning. `backend/src/config/env.validation.ts:32,36` additionally enforces `JWT_SECRET` ≥ 32 chars always, and `JWT_REFRESH_SECRET` ≥ 32 chars in production.

`JwtStrategy.validate` (`backend/src/auth/jwt.strategy.ts:35-45`) rejects any token whose `token_use !== 'access'` — this is what stops a refresh token, or any legacy token minted before the claim existed, from being used as a bearer credential.

### 2.3 Token extraction

`extractJwtFromHeaderOrCookie` (`jwt.strategy.ts:10-23`) tries, in order:

1. `Authorization: Bearer <token>`
2. `access_token` cookie (staff)
3. `customer_token` cookie (customer)

Two separate cookie names is what lets a staff session and a customer session coexist in one browser.

### 2.4 Cookies

Set in `backend/src/auth/auth.controller.ts:58-74` (login) and `:97-113` (refresh):

| Cookie | httpOnly | secure | sameSite | path | maxAge | domain |
| --- | --- | --- | --- | --- | --- | --- |
| `access_token` | ✅ | `NODE_ENV === 'production'` | `lax` | *(default `/`)* | 15 min | derived (below) |
| `refresh_token` | ✅ | `NODE_ENV === 'production'` | `lax` | **`/auth`** | 7 days | derived (below) |

The `refresh_token` cookie's `path: '/auth'` means the browser never sends it to any route outside `/auth/*` — it reaches `POST /auth/refresh`, `POST /auth/logout` and `POST /auth/logout-all` and nothing else.

**The token is never returned in the response body.** Both `login` and `refresh` return only `{ user }` — the comment at `auth.controller.ts:76` states this is deliberate XSS-token-theft prevention.

**Derived cookie domain** — `backend/src/auth/auth.controller.ts:19-32`, computed once per controller instance at `:36`:

```ts
function getCookieDomain(): string | undefined {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) return undefined;
  try {
    const hostname = new URL(frontendUrl).hostname;
    // Strip www. prefix and prepend dot for subdomain sharing
    const root = hostname.replace(/^www\./, '');
    // Don't set domain for localhost
    if (root === 'localhost' || root.startsWith('127.')) return undefined;
    return `.${root}`;
  } catch {
    return undefined;
  }
}
```

With `FRONTEND_URL=https://www.konma.store` this yields `.konma.store`, so cookies set by the API at `api.konma.store` are readable by the Next.js app at `www.konma.store`. Locally it returns `undefined` and the cookie stays host-only. The value is spread conditionally (`...(this.cookieDomain && { domain: this.cookieDomain })`) on every `cookie()` and `clearCookie()` call, so clears match sets.

### 2.5 Refresh rotation

`AuthService.refreshToken` (`auth.service.ts:104-194`), in order:

1. `jwtService.verify` against `refreshSecret` — **signature checked before any DB access**, so an access token presented here fails immediately (`:109-114`).
2. Reject unless `token_use === 'refresh'` **and** `type === 'staff'` (`:115-117`).
3. SHA-256 the presented token and look up a `RefreshToken` row that is `revoked_at: null` and `expires_at > now` (`:119-135`).
4. Cross-check `storedToken.user_id === decoded.userId` (`:141`) — a valid-but-mismatched pairing is rejected.
5. Reject if the user is missing or not `active` (`:147`).
6. **Revoke** the presented token (`:152-155`), then mint and store a **new** refresh token (`:166-178`).

Every failure returns the same `UnauthorizedException('Invalid or expired refresh token')`.

> ⚠️ Rotation is one-way revocation, not reuse-detection: presenting an already-revoked refresh token fails, but it does not cascade-revoke the family. A stolen-then-rotated token is dead on arrival; a stolen-and-used-first token leaves the legitimate user locked out without an alarm.

### 2.6 Logout

- `POST /auth/logout` (`auth.controller.ts:120-138`): SHA-256 the cookie, revoke that one row, clear both cookies (with the matching `path`/`domain`).
- `POST /auth/logout-all` (`:140-152`): `updateMany` sets `revoked_at` on every active row for the user, then clears both cookies.

### 2.7 Forgot / reset / set password

- `POST /auth/forgot-password` → `AuthService.forgotPassword` (`auth.service.ts:219-252`): unknown email **returns silently** (no enumeration); all prior unused reset tokens for that user are invalidated; a 32-byte random token is generated, its SHA-256 stored, TTL **15 minutes**; the plaintext goes out by email. `EmailService` swallows transport failures, so the controller's fixed `200` never varies.
- `POST /auth/reset-password` → `resetPassword` (`:254-289`): looks up an unused, unexpired token hash; bcrypt-hashes the new password at cost 12; marks the token used; and **revokes every active refresh token for that user** — a password reset kills all sessions.
- `POST /auth/set-password` → `setPassword` (`:291-294`) is an alias for `resetPassword`, used for first-login activation of a seeded/invited account.

All three are `@Public()` and throttled at **5 requests / 300 s** per principal (`auth.controller.ts:41,155,163,171`) — the same bucket as login.

### 2.8 Edge verification in the frontend

`frontend/proxy.ts` runs on every route not excluded by the matcher at `:160-164`. It reads the `access_token` cookie (`:63`) and verifies it with `jose.jwtVerify` against `process.env.JWT_SECRET` (`:4`, `:80`, `:114`).

**The frontend and backend therefore share `JWT_SECRET`.** The edge does not call the API to validate a session; it re-verifies the signature locally. Two consequences worth stating plainly: (a) `JWT_SECRET` must be present and identical in both deployments; (b) the edge cannot see refresh-token revocation — a logged-out-everywhere user still passes the edge check until their 15-minute access token expires.

Behaviour by branch:

| Path class | Behaviour |
| --- | --- |
| `/` | always allowed (`:66-68`) |
| `PUBLIC_PATHS` (`/login`, `/menu`, `/events`, `/feedback`, `/profile`, `/shop`, `/p`, `/experiences`, `/search`, `/cart`, `/checkout`, `/account`, `/orders`) | always allowed (`:21-35`, `:71-73`) |
| `STAFF_AUTH_PAGES` (`/team`, `/sign-in`, `/forgot-password`, `/set-password`, `/reset-password`) | valid staff token → `/team` falls through to the ops hub, the others redirect to `/dashboard`; otherwise `/team` is **rewritten** onto `/sign-in` with the URL preserved (`:76-105`) |
| everything else (ops) | no token → `302 /team?redirect=<path>`; `payload.type === 'customer'` → redirect `/account`; valid staff → `next()` with `x-user-id` and `x-role-code` response headers set (`:107-129`) |

Matching is segment-aware (`matchesPath`, `:57-59`) specifically so `/p` cannot swallow `/pos` and `/team` cannot swallow `/team-contribution`.

> ⚠️ The edge distinguishes **staff vs customer vs anonymous only**. It does not check permissions or module access. A staff member of any role passes the edge for every ops path; the actual authorization happens at the API and in per-page client code (see §6.1).

### 2.9 Full staff login sequence

1. Browser `POST /auth/login { email, password }` — `@Public()`, throttled 5 / 300 s per IP.
2. `ValidationPipe` validates `LoginDto`; unknown body keys → `400`.
3. `AuthService.validateUser`: `user.findUnique({ email })` with `role` included → `null` if absent → `null` if `status !== 'active'` → `bcrypt.compare`.
4. `null` at any step → `UnauthorizedException('Incorrect email or password')`.
5. `AuthService.login`: build `{ userId, roleCode, type: 'staff' }`; sign access (`JWT_SECRET`, `token_use: 'access'`, 15 m) and refresh (`JWT_REFRESH_SECRET`, `token_use: 'refresh'`, 7 d).
6. SHA-256 the refresh token; insert a `RefreshToken` row with `expires_at = now + 7d`.
7. Set `refresh_token` (httpOnly, `path=/auth`, 7 d, derived domain) and `access_token` (httpOnly, `/`, 15 m, derived domain).
8. Respond `{ user: { id, name, email, roleCode, roleName, permissions, xp_total, level } }` — **no token in the body**.
9. Browser navigates to an ops route. `frontend/proxy.ts` reads `access_token`, `jwtVerify`s it with the shared `JWT_SECRET`, confirms `type === 'staff'`, and forwards with `x-user-id` / `x-role-code`.
10. The page calls the API. `JwtAuthGuard` → `JwtStrategy.validate` (rejects `token_use !== 'access'`) attaches `{ id, roleCode, type: 'staff' }`; `PermissionsGuard` reads `@RequiresPermission` and checks it against the 60-second role-permission cache; `UserAwareThrottlerGuard` counts against `user:<id>`.
11. At ~15 minutes the access token expires. The client calls `POST /auth/refresh`; the browser sends `refresh_token` because the path matches `/auth`; the server verifies, revokes, re-mints, and re-sets both cookies.

---

## 3. Customer authentication

### 3.1 Phone + OTP

`POST /customer-auth/send-otp` → `CustomerAuthService.sendOtp` (`backend/src/customer-auth/customer-auth.service.ts:41-73`):

1. If Redis is unavailable → `503 ServiceUnavailableException('OTP service unavailable')`. **Fails closed** — there is no in-memory fallback.
2. Rate limit `otp_rate:<phone>` — `INCR`, `EXPIRE 3600` on first hit, **max 3 per phone per hour** → `429`. This is a *second*, phone-keyed limit layered under the route's own `@Throttle({ default: { limit: 3, ttl: 3600000 } })`, which is IP-keyed for an anonymous caller.
3. `crypto.randomInt(100000, 999999)` — 6 digits.
4. **`bcrypt.hash(otp, 10)`** — the OTP is hashed, never stored in plaintext.
5. `SET otp:<phone> <hash> EX 300` — **5-minute TTL**.
6. Send via `WhatsAppService.sendOtp`.

`POST /customer-auth/verify-otp` → `verifyOtp` (`:75-164`):

1. Redis unavailable → `503`.
2. Brute-force guard `otp_verify:<phone>` — `INCR` with 300 s TTL; on the **6th** attempt, delete the OTP entirely and both counters, then `429`.
3. Missing hash → `410 GoneException('This code has expired — request a new one')`.
4. `bcrypt.compare` mismatch → `401`.
5. On success, delete both keys (single-use).
6. `findUnique` **before** upsert to determine `isNewCustomer` deterministically, then `customer.upsert({ where: { phone } })`.
7. If new, back-link pre-existing `Order`, `EventBooking` and `Feedback` rows that carry the same `customer_phone` and a null `customer_id` (`:126-137`).
8. Sign `{ customerId, type: 'customer', token_use: 'access' }` with **`JWT_SECRET`** (the same secret as staff access tokens — the `type` claim is what separates them), `expiresIn: '30d'`.
9. Set the cookie and return `{ customer, isNewCustomer }`.

### 3.2 OTP storage

`RedisService` (`backend/src/customer-auth/redis.service.ts`) connects to `UPSTASH_REDIS_URL` with `maxRetriesPerRequest: 3`, `connectTimeout: 5000`, `lazyConnect: true`. After 3 failed retries it **sets `this.client = null` and stops retrying** (`:22-32`), logging once. `UPSTASH_REDIS_URL` is required in production (`env.validation.ts:43`); without it the service logs `OTP storage disabled` at boot and every OTP route returns `503`. The same Redis client backs webhook dedup (§5.1) and the storefront cart.

### 3.3 WhatsApp send path and the credential-absent fallback

`WhatsAppService` (`backend/src/customer-auth/whatsapp.service.ts`) reads `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_ID` at construction (`:11-12`) and posts to `https://graph.facebook.com/v18.0/<phoneId>/messages` with template `otp_verification` (`:28`, `:66-103`). Numbers are normalised to a `91` prefix with no `+` (`:60-64`). A non-2xx from Meta logs the status and body and throws.

**When credentials are absent it does not throw** (`:21-26`):

```ts
if (!this.token || !this.phoneId) {
  this.logger.warn(
    `[OTP fallback — WhatsApp unconfigured] OTP for ${recipientPhone}: ${otp}`,
  );
  return;
}
```

The comment states the reasoning: a node without Meta credentials is a supported production state (the channel ships disabled until Meta approves the templates), and throwing would block the entire customer sign-in funnel; the operator relays the code from the server log meanwhile. `env.validation.ts:54-55` matches this — the two WhatsApp vars are required **as a pair only when either is set**, never unconditionally.

> ⚠️ **This writes a live credential to the application log.** In the current production configuration (WhatsApp not yet approved) every customer OTP is printed to the Railway log stream at WARN level. Anyone with log access can sign in as any customer within the 5-minute window. This is a deliberate, documented trade-off, but it is a real exposure for as long as `WHATSAPP_TOKEN` is unset. `sendTemplate` (`:39-57`) has the same fallback for non-OTP messages, where the exposure is benign.

### 3.4 The `customer_token` cookie and the `@Public()` pairing

Set at `customer-auth.service.ts:147-153`:

| httpOnly | secure | sameSite | path | maxAge |
| --- | --- | --- | --- | --- |
| ✅ | `NODE_ENV === 'production'` | `lax` | `/` | 30 days |

No `domain` is set — the customer cookie is host-only, unlike the staff pair.

**Every customer route is `@Public()`, and none of them is open.** The reason is documented at `backend/src/customer-auth/customer-auth.controller.ts:23-37`: NestJS runs global guards before route-level ones, and the global `PermissionsGuard` rejects `user.type === 'customer'` unconditionally (`backend/src/auth/permissions.guard.ts:33`). A customer route guarded only by `@UseGuards(CustomerGuard)` therefore answers `403` to its own logged-in customer. Pairing `@Public()` switches off the global staff stack so that `CustomerGuard` is the sole authority — and `CustomerGuard` (`backend/src/customer-auth/guards/customer.guard.ts:10-15`) still throws `401` unless `user.type === 'customer'`.

The five controllers that pair the decorators at class level are `CustomerAuthController`, `CustomerOrdersController`, `CheckoutController`, `CustomerLoyaltyController` and `CustomerReviewsController`. `EventsController` applies the pair per-method on `/events/:id/checkout` and `/events/:id/bookings/confirm`.

> ⚠️ The pattern is correct but fragile by construction: `@Public()` alone (i.e. forgetting `@UseGuards(CustomerGuard)`) yields a genuinely unauthenticated route with no compile-time or lint-time signal. `POST /events/:id/bookings` (`events.controller.ts:97`) is exactly that shape — there it is intentional (anonymous guest booking), which means a mistake of the same shape would be indistinguishable from the intended case on inspection.

### 3.5 The `@Public()` storefront surface

23 routes need no credential at all: the health check; the seven staff-auth entry points (`login`, `refresh`, `forgot`/`reset`/`set-password`); the OTP pair; the read-only catalog surface (`/catalog/categories`, `/catalog/search`, `/catalog/products`, `/catalog/products/slug/:slug`, `/catalog/availability`, `/catalog/availability/:productId`, `/catalog/products/:id/reviews`, `/brands`); the events read surface plus anonymous booking; anonymous `/feedback`; and the three webhook intakes. Every storefront read route carries an explicit `@Throttle({ default: { limit: 30, ttl: 60000 } })`; the write-shaped public routes are tighter (5 / 300 s for feedback and guest bookings).

### 3.6 Pusher auth for customer channels

`POST /customer-auth/pusher-auth` (`customer-auth.controller.ts:88-102`), `CustomerGuard` + `@Public()` + `@HttpCode(200)`:

```ts
const expectedChannel = `private-customer-${customerId}`;
if (body.channel_name !== expectedChannel) {
  throw new ForbiddenException('Not authorized for this channel');
}
return this.pusherService.authorizeChannel(body.socket_id, body.channel_name);
```

The channel name is pinned to the token's own `customerId` — a customer can only ever subscribe to their own channel. The staff equivalents are `POST /realtime/auth` (`realtime.controller.ts:14`, per-channel rules delegated to `RealtimeService`) and `POST /chat/auth` (`chat.controller.ts:33`), both under the global `JwtAuthGuard`.

---

## 4. Authorization model

### 4.1 The `Permission` enum

23 members, `backend/src/types/permissions.ts:1-25`. Descriptions verbatim from `PERMISSION_DESCRIPTIONS` (`:53-77`); display names from `PERMISSION_DISPLAY_NAMES` (`:27-51`).

| Permission | Display name | Description |
| --- | --- | --- |
| `VIEW_ALL` | View all data | See data across all users and roles |
| `VIEW_ROLE_SCOPED` | View own data | See only data assigned to this role |
| `CREATE_MISSION` | Create missions | Create long-term missions and phases |
| `CREATE_QUEST` | Create quests | Create weekly quests within missions |
| `CREATE_TASK` | Create tasks | Create daily tasks within quests |
| `UPDATE_OWN_TASK` | Update own tasks | Edit tasks assigned to this user |
| `UPDATE_ANY_TASK` | Update any task | Edit tasks assigned to any user |
| `UPLOAD_EVIDENCE` | Upload evidence | Attach proof to completed tasks |
| `APPROVE_EVIDENCE` | Approve evidence | Review and approve/reject submitted evidence |
| `VERIFY_TASK` | Verify tasks | Mark a task as verified (final validation) |
| `CREATE_DECISION` | Log decisions | Record team decisions with context |
| `APPROVE_DECISION` | Approve decisions | Sign off on pending decisions |
| `CREATE_ADHOC_TASK` | Inject ad-hoc tasks | Add unplanned tasks to active quests |
| `MANAGE_RBAC` | Manage permissions | Change role permissions from this screen |
| `MANAGE_SYSTEM` | Manage system | Access system configuration and settings |
| `MANAGE_KPIS` | Manage KPIs | Create and edit KPI metrics |
| `MANAGE_DELEGATIONS` | Manage approval delegations | Create and deactivate approval delegations between users |
| `MANAGE_OPS` | Manage operations | Create and manage zones, brands, channels, and assets |
| `MANAGE_INVENTORY` | Manage inventory | Track and adjust ingredient stock levels across zones |
| `MANAGE_PROCUREMENT` | Manage procurement | Create and manage purchase orders with vendors |
| `MANAGE_KITCHEN` | Manage kitchen operations | Create prep batches, update KDS item status, log waste, and view kitchen metrics |
| `MANAGE_POS` | Manage POS operations | Create orders, record payments, manage deliveries |
| `MANAGE_GUIDE` | Manage guide content | Create, edit, and delete guide sections and pages |

> ⚠️ `MANAGE_OPS`'s description ("zones, brands, channels, and assets") is materially narrower than its actual reach. At 66 routes it is by far the widest permission in the system, additionally covering the whole catalog write surface, events, shipments, daily close, promotions, review moderation, customer records, vendors, ingredients and recipes. A reviewer reading the description alone would badly under-estimate the grant.

### 4.2 Guard mechanics

`RequiresPermission` is a one-line metadata setter (`backend/src/common/decorators/permissions.decorator.ts:3-5`):

```ts
export const REQUIRED_PERMISSION_KEY = 'requiredPermission';
export const RequiresPermission = (permission: string) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
```

Note the parameter type is `string`, not `Permission` — `backend/src/imports/imports.controller.ts:28,81,93,99,120` passes the bare string `'MANAGE_SYSTEM'` rather than the enum member. It works because the enum values are their own names, but it is not type-checked against the enum.

`PermissionsGuard.canActivate` (`backend/src/auth/permissions.guard.ts:15-40`), in order:

1. `@Public()` on handler **or** class → `true`; both auth and permission checks are skipped.
2. Read `REQUIRED_PERMISSION_KEY` from handler-then-class (`getAllAndOverride`).
3. No `req.user` → `false`.
4. `user.type === 'customer'` → **`false`, unconditionally** (`:33`). This is the rule that makes a customer token useless on any staff endpoint, including the 73 staff routes that carry no `@RequiresPermission`.
5. No permission required → `true` (any authenticated staff member).
6. `getPermissionsForRole(user.roleCode, prisma)` → `perms.includes(required)`.

The JWT carries `roleCode`, not the permission list, so **permissions are resolved per request from the database** — a permission revoked in `/admin/permissions` takes effect without forcing a re-login.

`getPermissionsForRole` (`backend/src/permissions/permissions.cache.ts:8-20`) is a process-local `Map<roleCode, { perms, expiresAt }>` with a **60-second TTL** (`:6`). `invalidateRoleCache(roleCode)` and `invalidateAllCache()` are exported (`:22-28`) and called on `PATCH /roles/:id/permissions`.

> ⚠️ The cache is per-process and in-memory. Across more than one API instance, an explicit invalidation only clears the instance that served the write; the others converge within 60 s. At one instance (the current production topology) this is exact.

Service-level checks that bypass the decorator entirely, for reference: `tasks.controller.ts:93-96` (`CREATE_TASK` vs `CREATE_ADHOC_TASK` by `task_type`), `exports.controller.ts:36-40` (permission varies by report type), `evidence.service.ts:170` and `storage.controller.ts:49` (`UPDATE_ANY_TASK` for non-owners), `evidence.controller.ts:71-83` (scope filter built from the caller's live permission set), `tasks.service.ts:357,564,631`, and `buildScopeFilter` in `backend/src/permissions/scope.filter.ts` (which widens a query to everything when the caller holds `VIEW_ALL`).

### 4.3 Role × permission matrix

Eight roles, from `backend/prisma/seed-data/roles.ts:14-153`. This is the **seeded default**; `PATCH /roles/:id/permissions` can change any cell at runtime, and `Role.permissions` in the database is the actual authority.

Legend: **FA** Founder/Admin · **TL** Tech Lead · **FE** Frontend Lead · **BE** Backend Lead · **PR** Procurement Lead · **BI** BI Lead · **TA** Talent Lead · **DE** Design/Outreach Lead

| Permission | FA | TL | FE | BE | PR | BI | TA | DE |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `VIEW_ALL` | ✅ | ✅ | | | | | | |
| `VIEW_ROLE_SCOPED` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CREATE_MISSION` | ✅ | ✅ | | | | | | |
| `CREATE_QUEST` | ✅ | ✅ | | | | | ✅ ¹ | |
| `CREATE_TASK` | ✅ | ✅ | | | | | ✅ ¹ | |
| `UPDATE_OWN_TASK` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `UPDATE_ANY_TASK` | ✅ | ✅ | | | | | | |
| `UPLOAD_EVIDENCE` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `APPROVE_EVIDENCE` | ✅ | ✅ | ✅ | ✅ | ✅ | | ✅ ¹ | |
| `VERIFY_TASK` | ✅ | ✅ | ✅ | ✅ | ✅ | | | |
| `CREATE_DECISION` | ✅ | ✅ | ✅ | ✅ | | ✅ | | ✅ |
| `APPROVE_DECISION` | ✅ | ✅ | | | | | | |
| `CREATE_ADHOC_TASK` | ✅ | ✅ | | | | | | |
| `MANAGE_RBAC` | ✅ | ✅ | | | | | | |
| `MANAGE_SYSTEM` | ✅ | ✅ | | | | | | |
| `MANAGE_KPIS` | ✅ | ✅ | | | | ✅ | | |
| `MANAGE_DELEGATIONS` | ✅ | ✅ | | | | | | |
| `MANAGE_OPS` | ✅ | ✅ | ✅ | | ✅ ¹ | | | ✅ ¹ |
| `MANAGE_INVENTORY` | ✅ | ✅ | | | ✅ | | | |
| `MANAGE_PROCUREMENT` | ✅ | ✅ | | | ✅ | | | |
| `MANAGE_KITCHEN` | ✅ | ✅ | | ✅ ¹ | ✅ | | | |
| `MANAGE_POS` | ✅ | ✅ | ✅ ¹ | | | | | |
| `MANAGE_GUIDE` | ✅ | ✅ | | | | | | |
| **Total** | **23** | **23** | **8** | **7** | **9** | **5** | **6** | **5** |

¹ Added on **2026-08-30** in commit `2cab09e` — see §4.5.

`FOUNDER_ADMIN` and `TECH_LEAD` both use `permissions: Object.values(Permission)` (`roles.ts:19,130`), so they automatically inherit any permission added to the enum later. The other six enumerate literally.

### 4.4 Module access

`backend/prisma/seed-data/module-access.ts:28-136`. `ModuleAccess` is **global** (no `node_id`) and editable at `/admin/modules` by any holder of `MANAGE_SYSTEM`. `sort_order` follows the SPEC §6.2 navigation spine.

`'ALL'` resolves to every seeded role code; `'APPROVERS'` resolves at seed time to every role holding `APPROVE_EVIDENCE` (`resolveModuleRoleCodes`, `:139-146`) — which after the 2026-08-30 grants is **FA, TL, FE, BE, PR, TA** (BI and DE excluded).

| Module key | Roles | Sort |
| --- | --- | --- |
| `mission_control` | ALL | 10 |
| `my_tasks` | ALL | 20 |
| `my_quests` | ALL | 30 |
| `evidence` | ALL | 40 |
| `approvals` | APPROVERS → FA, TL, FE, BE, PR, TA | 50 |
| `decisions` | ALL | 60 |
| `readiness` | ALL | 70 |
| `team` | ALL | 80 |
| `guide` | ALL | 90 |
| `chat` | ALL | 100 |
| `recipes` | BE, PR, FE, FA, TL | 200 |
| `ingredients` | BE, PR, FE, FA, TL | 201 |
| `prep_batches` | BE, PR, FE, FA, TL | 202 |
| `kds` | BE, PR, FE, FA, TL | 203 |
| `pick_pack` | BE, PR, FE, FA, TL | 204 |
| `waste` | BE, PR, FE, FA, TL | 205 |
| `supply_usage` | BE, PR, FE, FA, TL | 206 |
| `inventory` | PR, BE, FA, TL | 300 |
| `procurement` | PR, BE, FA, TL | 301 |
| `purchase_orders` | PR, BE, FA, TL | 302 |
| `vendors` | PR, BE, FA, TL | 303 |
| `pos` | FE, FA, TL | 400 |
| `orders` | FE, FA, TL | 401 |
| `delivery` | FE, FA, TL | 402 |
| `shipments` | FE, FA, TL | 403 |
| `customers` | FE, FA, TL | 404 |
| `reviews` | FE, FA, TL | 405 |
| `daily_close` | FE, FA, TL | 406 |
| `catalog` | DE, FE, FA, TL | 500 |
| `promotions` | DE, FE, FA, TL | 501 |
| `experiences` | DE, FE, FA, TL | 502 |
| `brands` | DE, FE, FA, TL | 503 |
| `assets` | DE, FE, FA, TL | 504 |
| `analytics` | BI, FA, TL | 600 |
| `kpis` | BI, FA, TL | 601 |
| `feedback` | BI, FA, TL | 602 |
| `exports` | BI, FA, TL | 603 |
| `imports` | FA, TL | 700 |
| `users` | FA, TL | 701 |
| `permissions` | FA, TL | 702 |
| `delegations` | FA, TL | 703 |
| `notices` | FA, TL | 704 |
| `settings` | FA, TL | 705 |
| `modules` | FA, TL | 706 |
| `guide_editor` | FA, TL | 707 |
| `zones` | FA, TL | 708 |
| `channels` | FA, TL | 709 |
| `usage` | FA, TL | 710 |
| `talent` | TA, FA | 800 |

### 4.5 Two layers, and the mismatches found and fixed on 2026-08-30

**`ModuleAccess` controls nav visibility. `Permission` controls API authorization. They are entirely separate tables, seeded from separate files, with no code path that reconciles them.** `GET /modules/mine` (`backend/src/module-access/module-access.controller.ts:40`) answers "what does this role see in the sidebar"; `PermissionsGuard` answers "may this role call this route". A role can therefore hold a module and be rejected by every route behind it — the nav renders, the screen loads, and every action returns `403`.

Five such mismatches were found while writing the role walkthroughs and fixed at commit `2cab09e` (2026-08-30) by granting the missing permissions in `backend/prisma/seed-data/roles.ts`:

| # | Role | Grant added | Line | Why it was needed |
| --- | --- | --- | --- | --- |
| 1 | Frontend Lead | `MANAGE_POS` | `roles.ts:43` | The role runs the till, and its module grant already exposed `pos`/`orders`/`delivery` — but POS order-taking, the order lifecycle and refunds are all `MANAGE_POS`-gated |
| 2 | Backend Lead | `MANAGE_KITCHEN` | `roles.ts:63` | The kitchen lead's whole module group (`kds`, `prep_batches`, `waste`, `supply_usage`) is `MANAGE_KITCHEN`-gated — the nav rendered but every action 403'd |
| 3 | Procurement Lead | `MANAGE_OPS` | `roles.ts:100` | Vendor and vendor-price writes are `MANAGE_OPS`-gated; the role that owns "Vendors, sourcing" could not create either |
| 4 | Talent Lead | `CREATE_TASK`, `CREATE_QUEST`, `APPROVE_EVIDENCE` | `roles.ts:118-120` | The role that runs onboarding/training must drive the mission loop, and the seeded `hiring` approval policy names `TALENT_LEAD` as a required approver — a required approver must hold `APPROVE_EVIDENCE` |
| 5 | Design/Outreach Lead | `MANAGE_OPS` | `roles.ts:147` | The role's entire module grant (`catalog`, `experiences`, `brands`, `assets`, `promotions`) is `MANAGE_OPS`-gated — Experiences and Promotions did not load at all |

Each grant carries an inline comment in `roles.ts` explaining the reasoning; grants 1-3 and 5 are single lines, grant 4 is three.

> ⚠️ Grant 4 changed the resolution of the `'APPROVERS'` marker: `TALENT_LEAD` now holds `APPROVE_EVIDENCE`, so the `approvals` module (sort 50) is seeded to six roles rather than five. This is a side effect of the permission grant, not an explicit module edit.

> ⚠️ **The sweep was not exhaustive — mismatches of the same class remain at the snapshot commit.** These were verified by intersecting §4.3 against §4.4:
>
> | Role | Module held | Route(s) behind it | Missing permission |
> | --- | --- | --- | --- |
> | BI Lead | `exports` | `GET /exports/history` | `MANAGE_SYSTEM` (see §6.2) |
> | BI Lead | `feedback` | `GET /feedback`, `GET /feedback/stats` | `MANAGE_POS` (see §6.5) |
> | Backend Lead | `inventory` | all four `/inventory/*` routes | `MANAGE_INVENTORY` |
> | Backend Lead | `procurement`, `purchase_orders` | `/procurement/summary`, all `/purchase-orders/*` | `MANAGE_PROCUREMENT` |
> | Backend Lead | `recipes`, `ingredients`, `vendors` | every write route (reads are fine) | `MANAGE_OPS` |
> | Frontend Lead | `kds`, `prep_batches`, `waste`, `supply_usage`, `pick_pack` | every kitchen route | `MANAGE_KITCHEN` |
> | Procurement Lead, Talent Lead | `decisions` | `POST /decisions` (reads are fine) | `CREATE_DECISION` |
>
> The Backend Lead case is the most consequential: the role whose description is "Food, production, R&D, standardization, quality" (`roles.ts:52`) cannot create or edit a recipe, because every recipe write is `MANAGE_OPS`-gated.
>
> The structural fix is a test that asserts, for every `(module_key, role)` pair in `MODULE_ACCESS`, that the role holds the permissions the routes behind that module require. No such test exists; there is no route→module mapping in the codebase for one to read.

---

## 5. Webhook authentication

### 5.1 Razorpay — body HMAC

`POST /webhooks/razorpay` (`backend/src/webhooks/webhooks.controller.ts:26-43`) is `@Public()`, `@HttpCode(200)`, throttled 100 / 60 s. It requires two headers up front, each a `401` if absent: `x-razorpay-signature` and `x-razorpay-event-id`.

The raw body is essential and is preserved by a targeted `verify` callback in `backend/src/main.ts:29-33`:

```ts
app.use(json({ limit: '1mb', verify: (req: any, _res, buf) => {
  if (req.originalUrl === '/webhooks/razorpay') { req.rawBody = buf; }
} }));
```

Only this one path pays the memory cost of a retained buffer.

`WebhooksService.processWebhook` (`backend/src/webhooks/webhooks.service.ts:41-75`), in order:

1. No `rawBody` → `401`.
2. `RazorpayService.verifyWebhookSignature` (`backend/src/razorpay/razorpay.service.ts:62-70`) delegates to the SDK's `validateWebhookSignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET)`; a missing secret throws `BadRequestException`, a thrown comparison returns `false`. Invalid → `401`. **This happens before anything else touches the payload.**
3. Dedup on `webhook_processed:<eventId>` via Redis `SET … EX 86400 NX`. **Fails closed** — if Redis is unavailable the handler throws `503` so Razorpay retries later, rather than risking a double-capture.
4. Only then is the body `JSON.parse`d and routed.

`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are all required in production (`backend/src/config/env.validation.ts:44-46`).

### 5.2 Shiprocket — `x-konma-webhook-token` shared secret

`POST /webhooks/shiprocket` (`webhooks.controller.ts:60-69`) is `@Public()`, `@HttpCode(200)`, throttled 300 / 60 s. Authentication is a shared-secret header, not a body HMAC — `main.ts` retains `rawBody` only for the Razorpay path, so a body HMAC is not available (and SPEC §5.3 does not ask for one). The comment at `webhooks.controller.ts:45-59` records this decision.

`ShiprocketWebhookService.assertAuthorised` (`backend/src/webhooks/shiprocket-webhook.service.ts:153-166`):

```ts
const expected = this.config.get<string>('SHIPROCKET_WEBHOOK_TOKEN');
if (!expected) {
  throw new ForbiddenException('Shiprocket webhook is not configured');
}
const provided = Buffer.from(token ?? '', 'utf8');
const secret   = Buffer.from(expected, 'utf8');
if (provided.length !== secret.length || !timingSafeEqual(provided, secret)) {
  throw new UnauthorizedException('Invalid webhook token');
}
```

**Fails closed** on an unconfigured secret (`403`, not "allow"). Comparison is constant-time via `node:crypto.timingSafeEqual`; the length pre-check exists because `timingSafeEqual` throws on unequal buffer lengths, and the comment at `:149-151` notes that this leaks only the secret's length. `assertAuthorised` is the first statement of `handle()` (`:172`), before the payload is read at all.

Every other outcome is `200`, deliberately: an unknown AWB or an ignorable status logs and returns `{ status: 'ignored' }` rather than a non-2xx, because Shiprocket retries every non-2xx forever. `SHIPROCKET_WEBHOOK_TOKEN` is validated at `@MinLength(16)` and required only when `NODE_ENV=production && SHIPPING_PROVIDER=shiprocket` (`env.validation.ts:70`).

### 5.3 QStash — Upstash signing keys

`POST /notifications/qstash-webhook` (`backend/src/notifications/notifications.controller.ts:67-96`) is `@Public()`, `@HttpCode(200)`. The `Receiver` is built in the constructor **only if both** `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` are present (`:53-60`) — two keys because Upstash rotates them.

With a receiver: a missing `upstash-signature` header → `401`; `receiver.verify({ signature, body: JSON.stringify(body) })` throwing → `401`.

Without a receiver (`:74-83`) the route **fails closed** — `403 'QStash signing keys are not configured'` — with one escape hatch: `QSTASH_ALLOW_UNSIGNED === 'true'` **and** `NODE_ENV !== 'production'`, which logs a `Processing UNSIGNED QStash webhook` warning and proceeds. The production check is a separate conjunct, so setting the flag in production does not open the route.

`env.validation.ts:58-61` requires `QSTASH_URL`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` as a group whenever `QSTASH_TOKEN` is set — a node with no queue is a supported state, a half-configured one is not.

> ⚠️ Signature verification re-serialises the parsed body (`JSON.stringify(body)`) rather than using the received bytes. This works because QStash signs a canonical JSON payload the Node serialiser reproduces, but it is not byte-exact in the way the Razorpay path is; a payload whose key order or number formatting differed after a parse/stringify round trip would fail verification.

---

## 6. Known authorization rough edges

Each of these is visible in the code at `2cab09e`.

### 6.1 The delegations page hard-redirects every non-Founder role

`frontend/app/(ops)/admin/delegations/page.tsx:19-21`:

```tsx
if (user && user.roleCode !== RoleCode.FOUNDER_ADMIN) {
  redirect('/dashboard');
}
```

This is a **role-code check in a client component**, not a permission check. Three consequences:

- `TECH_LEAD` holds `MANAGE_DELEGATIONS` (`roles.ts:130`, `Object.values(Permission)`) and the `delegations` module (`module-access.ts:110-128`), so the API accepts every call it would make — but the page bounces it to `/dashboard` before rendering.
- Granting `MANAGE_DELEGATIONS` to any other role through `/admin/permissions` has no effect on this screen; the check is hardcoded to a role code and cannot be changed at runtime.
- It is the only screen in the ops app that gates on `roleCode` rather than on a permission or on `ModuleAccess`. The three underlying routes (`delegations.controller.ts:21,27,37`) are correctly gated on `MANAGE_DELEGATIONS`, so this is a UI-layer inconsistency, not a security hole.

### 6.2 `GET /exports/history` requires `MANAGE_SYSTEM`, but BI Lead holds the module

`backend/src/exports/exports.controller.ts:47-48` gates the route on `MANAGE_SYSTEM`, with the docblock at `:44-46` describing it as "Admin-only". But `module-access.ts:103-107` grants the `exports` module (sort 603) to `BI_LEAD`, `FOUNDER_ADMIN` and `TECH_LEAD` — and `BI_LEAD`'s permission set (`roles.ts:73-79`) is `VIEW_ROLE_SCOPED`, `UPDATE_OWN_TASK`, `UPLOAD_EVIDENCE`, `CREATE_DECISION`, `MANAGE_KPIS`. No `MANAGE_SYSTEM`.

The BI Lead therefore sees "Exports" in the nav, opens the screen, and can generate exports (`POST /exports/generate` has no route-level permission — it checks per report type inside the service at `exports.controller.ts:36-40`) but the history panel on the same screen returns `403`. Half the screen works.

Either the route should require a narrower permission that BI holds, or the module should not be granted to BI. Neither has been done.

### 6.3 `GET /evidence?approval_status=` is a silent no-op

The handler binds `@Query('status')` (`backend/src/evidence/evidence.controller.ts:67`) and passes it as `{ status }`; the service maps it onto the Prisma column at `backend/src/evidence/evidence.service.ts:92-94`:

```ts
if (filters.status) {
  where.approval_status = filters.status;
}
```

So the **query parameter is `status`** while the **field it filters, and the field name in every response body and in `frontend/lib/types/evidence.ts:27`, is `approval_status`**. A caller who reasonably infers the query key from the response shape and sends `?approval_status=pending` gets an unfiltered list back with a `200`. There is no `400`: the global `ValidationPipe`'s `forbidNonWhitelisted` only inspects DTO-bound bodies, and this handler binds bare `string` query params, so an unrecognised query key is neither validated nor rejected.

`GET /evidence/feed` (`evidence.controller.ts:53`) has the same `status` vs `approval_status` split. The current frontend happens to send `status`, so nothing is visibly broken — but a filter that silently returns everything is a defect that fails open, and any new client is one plausible guess away from it.

### 6.4 `VERIFY_TASK` is seeded and displayed but enforced nowhere

`VERIFY_TASK` is declared (`backend/src/types/permissions.ts:11`), described as "Mark a task as verified (final validation)" (`:63`), seeded onto `FRONTEND_LEAD`, `BACKEND_LEAD` and `PROCUREMENT_LEAD` (`roles.ts:33,58,93`) plus both admin roles, and rendered in the `/admin/permissions` matrix from `frontend/lib/types/permissions.ts:11`. A repo-wide search finds **no other reference**: no `@RequiresPermission(Permission.VERIFY_TASK)`, and no `perms.includes(Permission.VERIFY_TASK)` in any service.

It is a checkbox in the RBAC UI that controls nothing. Toggling it changes no behaviour anywhere in the system.

### 6.5 `GET /feedback` requires `MANAGE_POS`, but BI Lead holds the module

Structurally identical to §6.2. `backend/src/feedback/feedback.controller.ts:22,28` gate both staff feedback routes on `MANAGE_POS`; `module-access.ts:103-107` grants the `feedback` module (sort 602) to `BI_LEAD`, who does not hold `MANAGE_POS`. The Feedback nav entry renders for the BI Lead and the screen returns `403` on load. Listed here because it is the same defect class as §6.2 and was not caught by the 2026-08-30 sweep.

### 6.6 Smaller notes

- **`@RequiresPermission` takes `string`, not `Permission`.** `backend/src/imports/imports.controller.ts:28,81,93,99,120` passes `'MANAGE_SYSTEM'` as a string literal. It works only because the enum's values equal its keys; a typo would compile and produce a route no role can ever reach.
- **`@Public()` is load-bearing on 29 customer routes.** Omitting the paired `@UseGuards(CustomerGuard)` would produce an unauthenticated route with no compile-time signal (§3.4). `POST /events/:id/bookings` is deliberately in that state.
- **The edge proxy cannot see revocation.** `frontend/proxy.ts` verifies the JWT signature locally against the shared `JWT_SECRET`; a user logged out via `/auth/logout-all` still passes the edge check until their 15-minute access token expires. The API is unaffected only for refresh — a revoked *access* token remains valid at the API too, until expiry.
- **`GET /roles` has no permission gate** (`backend/src/roles/roles.controller.ts:18`). Any authenticated staff member can read every role's full permission array. Reconnaissance-grade information, not a privilege escalation.
