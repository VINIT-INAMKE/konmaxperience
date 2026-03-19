# Pitfalls Research

**Domain:** Food operations / kitchen management platform with RBAC, gamification, approval workflows, and customer-facing ordering
**Researched:** 2026-03-19
**Confidence:** HIGH (critical pitfalls), MEDIUM (integration and performance)

---

## Critical Pitfalls

### Pitfall 1: Task Validation Cascade Causing Inconsistent State

**What goes wrong:**
The `validate_task` pseudo-code triggers a chain: approve evidence -> validate task -> recalculate user XP -> recalculate quest progress -> recalculate mission progress -> update readiness meter. If any step in this chain fails mid-execution (network error, DB timeout, constraint violation), the system lands in a partially-updated state. User XP increments but mission progress does not, or readiness meter moves but XP does not. The system presents contradictory data.

**Why it happens:**
Each function calls the next function directly without wrapping the entire cascade in a single database transaction. Developers implement each step correctly in isolation but miss that the entire chain must be atomic.

**How to avoid:**
Wrap the entire `validate_task` cascade inside a single PostgreSQL transaction. All five writes (task.valid, user.xp_total, quest.progress_percent, mission.progress_percent, readiness_meter.current_value) either all commit or all roll back. Use a job queue (BullMQ or pg-boss) for the side-effect parts (notifications, badge checks) that can run outside the transaction without breaking consistency.

**Warning signs:**
- User XP total does not match the sum of their valid tasks' XP
- Quest shows 80% progress but all tasks show valid=true
- Readiness meter value does not match the sum of applied task_readiness_events
- Data discrepancies emerge after server restarts or high-load periods

**Phase to address:**
Phase 1 (core data model and validation engine) — before any other feature touches XP or readiness.

---

### Pitfall 2: RBAC Checked Only at API Layer, Not at Data Layer

**What goes wrong:**
Middleware checks `req.user.role` before routing, and returns 403 for disallowed routes. But when a user calls `GET /tasks?owner_user_id=xxx`, the query fetches all tasks matching the filter regardless of whether the calling user should see them. A `VIEW_ROLE_SCOPED` user gets `VIEW_ALL` data by filtering on a different user's ID.

**Why it happens:**
Route-level guards are easy to implement and feel sufficient. Developers assume "they can't reach this route" protects the data. But REST APIs with query filters bypass route-level intent entirely.

**How to avoid:**
Enforce data-layer scoping in every query, not just route guards. When a non-admin user calls `GET /tasks`, the service layer appends `WHERE owner_user_id = req.user.id` regardless of what query params were sent. Implement a `buildScopeFilter(user)` utility that returns the mandatory WHERE clause for each role, and call it before every query. Never trust client-supplied owner filters from scoped roles.

**Warning signs:**
- Tests only check HTTP status codes (200/403), not the data returned in the response body
- `owner_user_id` is accepted as a query param from any role
- No `scope` concept exists in the service layer — only in middleware

**Phase to address:**
Phase 1 (RBAC foundation) — this must be correct before shipping to any real user.

---

### Pitfall 3: Stale Role Permissions in JWT Tokens

**What goes wrong:**
A user's JWT encodes their role and permissions at login time. If the founder changes a user's permissions in the admin panel, the user's active token still carries the old permissions until it expires. With a 24-hour token lifetime, a demoted user retains elevated access for up to a day.

**Why it happens:**
JWTs are designed to be stateless and self-contained. Developers include permissions in the payload for performance (no DB lookup on each request) but do not account for the invalidation problem when permissions change.

**How to avoid:**
Do not embed permission arrays in the JWT payload. Store only `user_id` and `role_code` in the token. On each request, look up the current role permissions from a short-lived cache (Redis or in-memory with a 60-second TTL) keyed by `role_code`. Permission changes take effect within one cache TTL, not one token lifetime. Keep token expiry at a reasonable window (4-8 hours for internal users).

**Warning signs:**
- JWT payload contains a `permissions: [...]` array
- No cache layer between JWT decode and permission check
- "Permissions updated, please log out and back in" is the stated UX for permission changes

**Phase to address:**
Phase 1 (auth and RBAC) — the architecture decision must be made here, retrofitting is painful.

---

### Pitfall 4: Approval Deadlock — Single Named Approver, No Escalation

**What goes wrong:**
Approval records store `required_role_code` (e.g., `SADHANA_BACKEND`). The dev spec has role codes named after specific people. If Sadhana is sick, traveling, or leaves the team, all food-scope approvals queue indefinitely. Tasks marked `requires_approval=true` never reach `valid=true`. Mission progress freezes. XP freezes. Readiness meters stop moving.

**Why it happens:**
The spec models roles after current real people, which is intentional for a small team. But the approval mechanism routes to a single required approver with no fallback. The system was designed for normal operations but not for absence.

**How to avoid:**
Build role delegation into the approval model: add a `delegate_user_id` to the users table that the founder can set when a role owner is unavailable. When checking approval permissions, accept either the role owner or their current delegate. Additionally, add a `founder_override` flag on approvals that allows `FOUNDER_ADMIN` to approve any pending approval with an override note. Build the 24-hour escalation notification (already in the spec's nudge logic) and make it visible on the founder dashboard with a one-click override action.

**Warning signs:**
- `required_role_code` maps to exactly one possible user with no fallback
- No `escalated_to_admin` flag exists on the approvals table
- The founder has no override capability in the UI
- Pending approvals older than 48 hours exist with no way to resolve them

**Phase to address:**
Phase 1 (approval workflow) — before the system goes live with real tasks.

---

### Pitfall 5: Readiness Meter Over-Attribution (Double-Counting Valid Tasks)

**What goes wrong:**
The `update_readiness_from_task` function checks for an existing `task_readiness_event` to prevent double-counting. But if a task is invalidated (evidence rejected, approval revoked) and then re-validated, the existing event check short-circuits and does not add the contribution again. Alternatively, if the idempotency check fails under concurrent load, the same task contributes twice, pushing a meter past its actual state.

**Why it happens:**
The idempotency check (`if existing: return`) is correct for the happy path (task validated once) but does not handle the invalidation-then-revalidation cycle. The dev spec does not model what happens when `task.valid` flips from `true` back to `false`.

**How to avoid:**
Add a `revoked_at` timestamp to `task_readiness_events`. When a task is invalidated, mark its readiness events as revoked and subtract the value from the meter. When re-validated, create a new event. This gives an append-only audit trail of readiness movement with correct net values. Use a database-level unique constraint with partial indexing: `UNIQUE(task_id, readiness_meter_id) WHERE revoked_at IS NULL`.

**Warning signs:**
- No test case for the sequence: validate -> reject evidence -> re-submit evidence -> approve -> validate again
- No `revoked_at` column or equivalent on task_readiness_events
- Readiness meter values exceed what valid tasks could mathematically contribute
- Meter values can only go up, never down

**Phase to address:**
Phase 1 (readiness engine) — the event model must be immutable/append-only from the start.

---

### Pitfall 6: Ad-Hoc Task Injection Breaking Quest Progress Calculation

**What goes wrong:**
Quest progress is `(valid tasks / total tasks) * 100`. When the founder injects an ad-hoc task into an active quest mid-flight, the denominator increases immediately. A quest that was 80% complete (8/10 tasks valid) drops to 73% (8/11) the moment a new task is added. The team sees "progress went backward" despite doing nothing wrong, which erodes trust in the system.

**Why it happens:**
The progress formula treats all tasks equally regardless of whether they existed when the quest was created. Ad-hoc injection is explicitly required by the spec, but its effect on progress calculation was not modeled.

**How to avoid:**
Separate quest progress into two tracks: `core_progress_percent` (valid core tasks / total core tasks at quest creation) and `adhoc_progress_percent` (valid adhoc tasks / total adhoc tasks). Display both on the quest card. Do not let ad-hoc task addition change the core progress calculation. This preserves the team's earned progress while still showing the full picture.

**Warning signs:**
- Progress calculation uses a single `COUNT(*)` for total tasks regardless of type
- No `baseline_task_count` is stored on the quest at creation time
- Test cases do not include "add task after quest is active" scenarios
- Product demo shows progress going backward when admin adds tasks

**Phase to address:**
Phase 1 (quest/task model) and Phase 2 (ad-hoc injection feature) — the data model must support dual-track progress from Phase 1.

---

### Pitfall 7: Customer Ordering Without Inventory/Availability Guard

**What goes wrong:**
A customer browses the menu, adds items, and places an order. Between browsing and checkout, a kitchen team member marks an item as unavailable (out of stock, recipe not standardized, kitchen closed). The order is accepted, confirmed, and enters the kitchen queue for an item that cannot be fulfilled. The team must manually contact the customer for substitution or cancellation.

**Why it happens:**
Menu availability is typically modeled as a static flag on menu items. The ordering flow reads the menu once at page load and does not re-validate availability at order submission time. There is no real-time availability lock between browsing and checkout.

**How to avoid:**
Re-validate item availability server-side at the moment `POST /orders` is called, not just at menu-load time. Return a specific error response (`ITEM_UNAVAILABLE`) that the frontend can surface gracefully before payment. Add an `is_available` flag to menu items that internal users can toggle in real time. Build an optimistic availability check at add-to-cart time (to surface errors early) plus a hard check at order submission (to guarantee correctness).

**Warning signs:**
- Availability check only happens at `GET /menu` time, not at `POST /orders`
- No test for the "item becomes unavailable between browse and checkout" scenario
- Internal team has no UI to mark items temporarily unavailable
- Customer-facing ordering and internal operations are in separate codebases with no shared availability state

**Phase to address:**
Phase with customer-facing ordering — cannot ship ordering without this guard in place.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding role permission arrays in code constants | Faster to implement, no DB lookup | Role changes require code deploys and re-testing | Never — permissions must be database-driven for this system |
| Storing all permissions in JWT payload | No DB lookup on each request | Stale permissions persist until token expiry | Never — cache lookup is trivial, stale permissions are a security issue |
| Single progress_percent field on quests | Simple calculation | Breaks visually when ad-hoc tasks added | Never — dual-track progress must be designed in from Phase 1 |
| Recalculating all meters on every task save | Always consistent | Catastrophic at scale, and introduces race conditions | MVP only if meter recalculation is wrapped in a DB transaction |
| Skip file type/size validation on evidence uploads | Faster to build | Users upload 500MB videos; storage fills; app slows | Never — validate server-side at upload time |
| Using `role_code` as foreign key string instead of UUID | Readable queries | Schema coupling — renaming a role requires data migrations | Acceptable only if role codes are treated as immutable enums |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| File storage (S3/Cloudinary for evidence) | Saving the local file path to DB before confirming upload succeeded | Generate a signed upload URL, let client upload directly, then confirm with a webhook or presigned URL verification before saving the evidence record |
| Email/WhatsApp notifications (nudge system) | Sending notifications synchronously inside the request handler | Always enqueue notifications to a job queue; notification failures must never fail the API request |
| Payment (future customer ordering) | Accepting order before payment is confirmed | Use payment intent pattern: create order in `pending_payment` state, confirm only on payment webhook |
| Postgres with Prisma/Drizzle ORM | Default eager-loading of related entities causing N+1 on `/tasks` list (tasks + owner + evidence + approvals) | Explicitly define which relations to include per endpoint; use `select` to limit fields; add `pg_stat_statements` monitoring from day one |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries on task list with relations | `/tasks` endpoint takes 2-5 seconds, scales linearly with task count | Use `include` with explicit relation selection in ORM; write raw SQL for dashboard queries | Around 200+ tasks in the system |
| Leaderboard recalculated on every XP change | Leaderboard endpoint is slow; high DB load after approval waves | Cache leaderboard result with 30-second TTL; recalculate on a job schedule, not on every XP write | At 8 users this is fine; becomes an issue if the team grows or if leaderboard is polled on a dashboard |
| Mission/quest progress recalculated by fetching all tasks | `recalculate_mission_progress` fetches the full task list on every task update | Use DB aggregation: `SELECT COUNT(*) WHERE valid=true` rather than loading all task objects into memory | Around 50+ tasks per mission |
| No database indexes on filter columns | `GET /tasks?owner_user_id=x&status=doing&domain=food` scans full tasks table | Add composite index on `(owner_user_id, status)`, index on `domain`, index on `(quest_id, valid)` | At 500+ tasks |
| Readiness meter recalculation without locking | Concurrent task approvals update the same meter simultaneously, causing over/under-count | Use `SELECT FOR UPDATE` on the readiness_meter row before updating, or use atomic `UPDATE readiness_meters SET current_value = current_value + $1` | At any concurrent load |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Verifying a task (`POST /tasks/:id/verify`) without checking that the caller has `VERIFY_TASK` permission AND the task is in the caller's domain scope | Any internal user can verify tasks outside their domain, bypassing cross-functional approval rules | Service layer must check both the permission AND domain ownership before allowing verify |
| Evidence `approve/reject` endpoints accessible by the task owner | Owner approves their own evidence, defeating the entire validation model | `APPROVE_EVIDENCE` permission must explicitly exclude `UPDATE_OWN_TASK` holders; add a DB-level constraint: `reviewed_by != uploaded_by` |
| Customer order endpoint without rate limiting | A bad actor places hundreds of fake orders, flooding the kitchen queue | Apply rate limiting per IP and per phone number on `POST /orders`; require phone verification before ordering |
| Decision log with no immutability | Approved decisions are edited or deleted after the fact, destroying audit trail | Decisions table: allow INSERT and status UPDATE only; no DELETE, no edit of `context` or `final_decision` fields after status = `approved` |
| File upload endpoint accepting any content type | User uploads executable file as "evidence photo", gaining code execution vector | Validate MIME type server-side (not just file extension); use a dedicated storage bucket with no execute permissions; scan uploads with a simple content-type check |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Leaderboard showing absolute XP with no context of role scope | Sadhana (food R&D) and Vinit (tech) have very different task volumes; comparing raw XP is unfair and demotivating | Show role-normalized progress (% of role's expected XP achieved) alongside raw XP; make leaderboard opt-in or soft-default rather than prominent |
| Evidence upload with no feedback on approval status | Users submit evidence and have no idea if it was seen, approved, or rejected | Explicitly show three states on the task card: "Evidence pending review", "Evidence approved", "Evidence rejected (reason)" |
| Ad-hoc task appears in the same list as core roadmap tasks with no visual distinction | Team cannot distinguish planned work from emergency injections; roadmap feels chaotic | Visual badge on ADHOC and IMPROVEMENT task types; separate sections or filter default |
| Approval required but approver has no mobile-optimized view | Approver is on-site in kitchen and cannot approve from phone; approval queues up and blocks progress | Approval actions must work from a minimal mobile view: show evidence thumbnail, approve/reject buttons, notes field — nothing else |
| Progress percentage showing decimal precision (e.g., 73.33%) | Feels mechanical and arbitrary in a team operations context | Round to nearest integer for display; show "8 of 11 tasks complete" alongside percentage |

---

## "Looks Done But Isn't" Checklist

- [ ] **Task validation:** Verify that `valid=false` tasks show `valid_xp=0` in all API responses, not just in the DB — common to compute correctly in DB but return stale value in cached response
- [ ] **Evidence approval:** Verify that rejecting evidence after a task was already validated correctly sets `task.valid=false` and reverses the XP contribution — the reverse path is almost always untested
- [ ] **Readiness meters:** Verify that the 10 seed meters exist and have correct `weight` values before any task data is created — readiness events for a non-existent meter silently fail
- [ ] **Cross-functional approvals:** Verify the "2+1 rule" creates exactly the right approval records — a food decision should create records for Sadhana + Anchitha + one impacted role, not just two
- [ ] **RBAC scoping:** Verify that `GET /leaderboard` returns all users (it is a shared view) but `GET /tasks` returns only role-scoped tasks — these have different intended audiences and must be tested explicitly
- [ ] **Customer ordering:** Verify that a customer cannot access any internal endpoint (task, evidence, approval, decision, readiness) — the auth middleware must distinguish `CUSTOMER` token from internal role tokens
- [ ] **Notification queue:** Verify that failing to send a notification does not roll back the task or approval action it was triggered by — notifications are side effects, not core operations
- [ ] **Ad-hoc task injection:** Verify that adding an ad-hoc task to a completed quest does not reset the quest's `status` from `completed` back to `active`

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cascade validation left system in inconsistent XP/progress state | HIGH | Write a reconciliation script that re-runs `recalculate_user_xp`, `recalculate_quest_progress`, `recalculate_mission_progress` for all entities; audit and compare against expected values; requires downtime or read-only mode |
| RBAC data-layer bypass discovered in production | HIGH | Immediately revoke all active tokens (force re-login); audit access logs for the affected endpoints; patch data-layer scoping; redeploy; notify team of potential data exposure |
| Approval deadlock (approver unavailable, no escalation) | MEDIUM | Add `founder_override` capability to approvals table as a hotfix migration; deploy; founder manually approves blocked items; build proper delegation in next sprint |
| Readiness meter double-counted | MEDIUM | Write a SQL correction that subtracts excess `task_readiness_events` for affected tasks; requires identifying the duplicate events and which was the "true" one |
| Customer orders accepted for unavailable items | MEDIUM | Manual outreach to affected customers; add availability re-check as a hotfix to order endpoint; implement real-time item toggle in internal dashboard |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Task validation cascade inconsistency | Phase 1 — core validation engine | Integration test: reject evidence after task validated; verify XP and progress both reverse atomically |
| RBAC data-layer bypass | Phase 1 — auth and RBAC foundation | Security test: authenticated user with `VIEW_ROLE_SCOPED` role queries another user's tasks by ID; must receive empty result, not 403 |
| Stale JWT permissions | Phase 1 — auth architecture | Test: change role permissions in DB; make API call with existing token; verify new permissions are enforced within cache TTL |
| Approval deadlock | Phase 1 — approval workflow | Test: mark required approver as inactive; verify founder can still approve or delegate; check 24h escalation notification fires |
| Readiness double-counting | Phase 1 — readiness meter engine | Test: validate task, reject evidence, re-approve evidence, validate again; verify meter value is correct (not doubled) |
| Ad-hoc task breaking quest progress | Phase 1 (data model) + Phase with ad-hoc injection | Test: add ad-hoc task to quest with existing progress; verify core_progress_percent unchanged |
| Customer ordering without availability guard | Phase with customer-facing ordering | Test: mark item unavailable between add-to-cart and checkout; verify order is rejected with ITEM_UNAVAILABLE error, not accepted |
| N+1 query on task list | Phase with task list implementation | Performance test: 200 tasks in DB; measure response time for `GET /tasks` with relations; must complete under 200ms |
| Leaderboard demotivation in small team | Phase with gamification UI | User test with team: gather feedback after 2 weeks of use; provide kill switch to hide leaderboard if morale impact is negative |

---

## Sources

- OSO HQ: "Why You Shouldn't Write Your Own RBAC in Node.js" — https://www.osohq.com/post/why-you-shouldnt-write-your-own-rbac-in-node-js
- Permit.io: "How to Use JWTs for Authorization: Best Practices and Common Mistakes" — https://www.permit.io/blog/how-to-use-jwts-for-authorization-best-practices-and-common-mistakes
- Hoop.dev: "JWT-Based Authentication and the Challenges of Large-Scale Role Explosion" — https://hoop.dev/blog/jwt-based-authentication-and-the-challenges-of-large-scale-role-explosion/
- ACM: "Design Patterns for Approval Processes" — https://dl.acm.org/doi/fullHtml/10.1145/3628034.3628035
- Moxo: "Multi-level approval workflows: A guide to preventing stalls" — https://www.moxo.com/blog/multi-level-approval-workflow
- Growth Engineering: "The Dark Side of Gamification: When Points, Badges, & Leaderboards Go Wrong" — https://www.growthengineering.co.uk/dark-side-of-gamification/
- Doyensec: "Database Transactions Undermining Your AppSec — Race Conditions" — https://blog.doyensec.com/2024/07/11/database-race-conditions.html
- Sylius GitHub: "Race conditions in inventory tracking, order, payment status" — https://github.com/Sylius/Sylius/issues/2776
- PlanetScale: "What is the N+1 Query Problem and How to Solve it?" — https://planetscale.com/blog/what-is-n-1-query-problem-and-how-to-solve-it
- Deonde: "10 Common Problems In Online Food Ordering And How To Fix" — https://deonde.co/blog/common-problems-in-online-food-ordering-and-solutions/
- CMU research via phys.org: "Workplace gamification erodes employee moral agency" — https://phys.org/news/2026-02-workplace-gamification-erodes-employee-moral.html

---
*Pitfalls research for: Konma Xperience OS — food operations / kitchen management platform with RBAC, gamification, approval workflows, customer-facing ordering*
*Researched: 2026-03-19*
