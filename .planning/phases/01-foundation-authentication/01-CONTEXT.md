# Phase 1: Foundation & Authentication - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffolding (NestJS + PostgreSQL + Prisma + Next.js 16), full database schema for all 15 entities, JWT authentication with 8 generic roles, admin-configurable RBAC, and admin super-access with user-level filtering. No role-switching mechanism — admin sees everything natively.

</domain>

<decisions>
## Implementation Decisions

### Session & Token Handling
- JWT with 7-day expiry, silent auto-refresh before expiry
- Unlimited concurrent device sessions per user
- Logout options: "Log out" (this device) and "Log out everywhere" (all devices)
- Token carries identity only (user_id, role_code) — permissions resolved from cache on each request (per research pitfalls)

### Admin View Model
- NO role-switching mechanism. Admin is a super-role that sees ALL data natively
- Admin can filter by individual user (e.g., "Show me Sadhana's tasks") — NOT by role
- Admin retains all admin actions (approve, override, inject) at all times
- This replaces AUTH-06 ("role-perspective switching") — the dropdown header approach was rejected in favor of unified admin view with user-level filtering

### User Onboarding
- Admin creates user accounts (enters name, email, assigns role)
- System sends "Set your password" email link to new user
- Admin can add new users anytime — system grows as team grows
- Password reset: both self-service ("Forgot password" → email link) AND admin can force-trigger a reset email

### Permission Model
- 8 generic roles: Frontend Lead, Backend Lead, BI Lead, Procurement Lead, Talent Lead, Tech Lead, Design/Outreach Lead, Founder/Admin
- Roles are NOT named after people (Anchitha, Sadhana, etc.) — those are usernames assigned to roles
- Admin-configurable permissions: admin can toggle individual permissions per role from a settings screen
- 15 permission enums from dev spec (VIEW_ALL, CREATE_MISSION, APPROVE_EVIDENCE, etc.)
- Data scoping: users see own assigned tasks + read-only view of related team tasks (dependencies, same quest)
- Shared boards (mission board, quest board, wins feed) are readable by all internal users
- Cross-functional approvals appear in both "Pending Approvals" queue AND inline on the task detail page

### Claude's Discretion
- JWT refresh token implementation details (httpOnly cookie vs localStorage)
- Email service provider for password setup/reset emails
- Permission settings UI layout and interaction design
- Exact permission defaults per role (sensible defaults based on dev spec)
- Database migration strategy and seed data structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain Model & Schema
- `contextdocs/dev_spec.md` — Full 15-entity schema, REST API design, business rules, permission enums, seed data
- `contextdocs/dev_spec.md` §5 (Role model) — 8 roles with descriptions
- `contextdocs/dev_spec.md` §6 (Permission model) — 15 permission enums and rules
- `contextdocs/dev_spec.md` §7 (Data schema) — All entity schemas with field types
- `contextdocs/dev_spec.md` §11.1 (Auth API) — Login endpoint, JWT response structure

### Architecture & Stack
- `.planning/research/STACK.md` — NestJS 11 + PostgreSQL (Neon) + Prisma 7 + Next.js 16 stack with rationale
- `.planning/research/ARCHITECTURE.md` — Monolith architecture, route groups, middleware RBAC pattern
- `.planning/research/PITFALLS.md` — JWT stale permissions pitfall, RBAC data-layer bypass, approval deadlock

### System Blueprint
- `contextdocs/blueprint.md` — Team roles, zone ownership, approval gates, governance tiers
- `contextdocs/technical.md` — System layers, execution engine, validation logic

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — this phase establishes the foundational patterns for all subsequent phases

### Integration Points
- This phase produces: auth middleware, RBAC guards, database schema, base layouts
- Phase 2 (Mission Execution) depends on: user model, role model, auth middleware, permission checks
- Phase 3 (Evidence & Validation) depends on: full schema, approval model from this phase

</code_context>

<specifics>
## Specific Ideas

- Admin filtering should be by individual user name, not by role — "Show me Sadhana's work" is how the founder thinks
- The system should feel like a premium internal tool (Notion/Linear level polish) — not a generic admin template
- UI must be professional and well-designed — explicit requirement from user

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-authentication*
*Context gathered: 2026-03-19*
