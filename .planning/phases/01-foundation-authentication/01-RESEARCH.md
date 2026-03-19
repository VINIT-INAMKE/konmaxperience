# Phase 1: Foundation & Authentication - Research

**Researched:** 2026-03-19
**Domain:** NestJS 11 + Next.js 16 + PostgreSQL (Neon) + Prisma 7 — JWT RBAC, admin-configurable permissions, full 15-entity schema, project scaffolding
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- NestJS 11 + PostgreSQL (Neon) + Prisma 7 + Next.js 16 as the full stack
- JWT with 7-day expiry, silent auto-refresh before expiry
- Unlimited concurrent device sessions per user
- Logout options: "Log out" (this device) and "Log out everywhere" (all devices)
- Token carries identity only (user_id, role_code) — permissions resolved from cache on each request
- NO role-switching mechanism. Admin is a super-role that sees ALL data natively
- Admin can filter by individual user (e.g., "Show me Sadhana's tasks") — NOT by role
- Admin retains all admin actions (approve, override, inject) at all times
- AUTH-06 replaced by unified admin view with user-level filtering (not role-perspective switching)
- Admin creates user accounts (enters name, email, assigns role) — system sends "Set your password" email
- Password reset: both self-service ("Forgot password" → email link) AND admin can force-trigger a reset email
- 8 generic roles: Frontend Lead, Backend Lead, BI Lead, Procurement Lead, Talent Lead, Tech Lead, Design/Outreach Lead, Founder/Admin
- Roles are NOT named after people — those are usernames assigned to roles
- Admin-configurable permissions: admin can toggle individual permissions per role from a settings screen
- 15 permission enums from dev spec (VIEW_ALL, CREATE_MISSION, APPROVE_EVIDENCE, etc.)
- Data scoping: users see own assigned tasks + read-only view of related team tasks (dependencies, same quest)
- Shared boards (mission board, quest board, wins feed) are readable by all internal users
- Cross-functional approvals appear in both "Pending Approvals" queue AND inline on the task detail page
- This phase also delivers: full 15-entity database schema (for all subsequent phases)

### Claude's Discretion

- JWT refresh token implementation details (httpOnly cookie vs localStorage)
- Email service provider for password setup/reset emails
- Permission settings UI layout and interaction design
- Exact permission defaults per role (sensible defaults based on dev spec)
- Database migration strategy and seed data structure

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can log in with email and password (JWT-based) | NestJS Passport JWT strategy; POST /auth/login endpoint; bcrypt password verification; JWT signed with user_id + role_code payload |
| AUTH-02 | System enforces 8 generic roles (Frontend Lead, Backend Lead, BI Lead, Procurement Lead, Talent Lead, Tech Lead, Design/Outreach Lead, Founder/Admin) | Prisma `roles` table seeded with 8 role records; role_code stored as immutable string enum; RolesGuard applied globally |
| AUTH-03 | Each role has scoped permissions controlling what they can view, create, approve | Admin-configurable `roles.permissions` array stored in DB; PermissionsGuard reads from Redis/in-memory cache keyed by role_code with 60s TTL; buildScopeFilter() enforces data-layer scoping |
| AUTH-04 | User session persists across browser refresh | JWT stored in httpOnly cookie (or localStorage); 7-day expiry with silent refresh before expiry; Next.js middleware.ts validates JWT on every request at edge |
| AUTH-05 | Admin has super access — can see everything across all roles | FOUNDER_ADMIN role carries VIEW_ALL permission; admin queries have no scope filter applied; admin can pass `?user_id=X` filter parameter |
| AUTH-06 | (Reinterpreted per CONTEXT.md) Admin can filter view by individual user name, not role-switching | Admin filter UI passes optional `user_id` query param to service layer; service applies it as an additional WHERE clause only for admin callers |
</phase_requirements>

---

## Summary

Phase 1 establishes everything the rest of the system depends on: the database schema for all 15 entities, JWT-based authentication, an admin-configurable RBAC system with per-request permission resolution from cache, and the base UI layouts. Getting this phase right means all subsequent phases build on a sound foundation.

The critical architectural commitment is the **token carries identity only** pattern: JWT payload contains only `user_id` and `role_code`. Permissions are NOT embedded in the token. Every authenticated request resolves permissions from a short-lived in-memory (or Redis) cache keyed by `role_code`. When admin updates a role's permissions via the settings screen, the cache is invalidated immediately. This eliminates the stale-JWT-permissions pitfall identified in PITFALLS.md.

The second critical commitment is **data-layer RBAC** via a `buildScopeFilter(user)` utility. Route guards alone are insufficient — any authenticated user with a scoped role must have the WHERE clause applied in the database query, regardless of what query parameters they supply. The `VIEW_ALL` permission bypasses the filter. Everything else scopes to the requesting user's assignments.

This phase also delivers the complete Prisma schema for all 15 entities in one migration, so Phase 2 and beyond can immediately build on a fully-defined, seed-populated database.

**Primary recommendation:** Scaffold as a monorepo (Turborepo + pnpm workspaces) with `apps/api` (NestJS 11) and `apps/web` (Next.js 16), sharing a `packages/types` package for Zod schemas and TypeScript interfaces. Implement auth in NestJS with httpOnly refresh cookies. Use Resend for transactional emails (password setup + reset). Use an in-memory Map with 60s TTL for permission caching (no Redis dependency in Phase 1 — upgrade path is clear if Redis is added later for BullMQ).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS (@nestjs/core) | 11.1.17 | Backend API framework | Locked; Guards + Decorators map to RBAC model; TypeScript-native; DI makes services testable |
| Next.js | 16.2.0 | Frontend + edge middleware | Locked; App Router; `middleware.ts` runs JWT verification at edge before any page load |
| PostgreSQL (Neon) | 16 | Primary database | Locked; all 15 entities are relational; ACID transactions; Neon branches per PR |
| Prisma | 7.5.0 | ORM | Locked; schema-first type safety; 15-entity schema generates fully-typed client; `$transaction` API |
| TypeScript | 5.x | Language (both sides) | NestJS and Prisma are TS-native; shared types between API and web |

### Auth & Security

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/passport | 11.0.5 | Passport integration | JWT strategy binding in AuthModule |
| @nestjs/jwt | 11.0.2 | JWT signing + verification | Token creation at login; token validation in JwtStrategy |
| passport-jwt | 4.0.1 | JWT extraction strategy | Extracts token from Authorization header or httpOnly cookie |
| bcrypt | 6.0.0 | Password hashing | Hash user passwords at creation; verify at login. Never store plaintext |
| jose | 6.2.2 | Edge-compatible JWT verification | Use in `middleware.ts` only — jsonwebtoken cannot run in Next.js edge runtime |
| @nestjs/throttler | 6.5.0 | Rate limiting | Apply to `/auth/login` and `/auth/forgot-password` to prevent brute force |
| helmet | 7.x | HTTP security headers | Global NestJS middleware; prevents XSS, clickjacking |
| @nestjs/config | 4.0.3 | Environment config | Load JWT_SECRET, DATABASE_URL, RESEND_API_KEY from .env |

### Email (Claude's Discretion — Resend recommended)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| resend | latest | Transactional email | Password setup + password reset emails; 3,000 free emails/month covers 8 internal users comfortably |

Resend is preferred over Nodemailer because it requires no SMTP server configuration, has a clean REST API, React email template support, and a free tier adequate for this use case. Nodemailer is the fallback if domain/DNS setup for Resend is blocked.

### Frontend (Phase 1 relevant)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | latest | Component library (Radix + Tailwind) | Login page, role-scoped nav sidebar, permission settings screen |
| Tailwind CSS | 4.2.2 | Utility-first CSS | All styling; CSS-first config in v4 (no tailwind.config.js) |
| Zustand | 5.0.12 | Client auth state | Store current user, role, permissions after login; persist to sessionStorage |
| React Hook Form | 7.x | Form management | Login form, forgot-password form, new user creation form |
| Zod | 4.3.6 | Schema validation | Login DTO, user creation DTO; shared via `packages/types` with NestJS |
| @tanstack/react-query | 5.91.0 | Server state | Fetch current user, role list, permission settings |

### ORM & Validation

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @prisma/client | 7.5.0 | Database queries | All DB reads/writes via generated typed client |
| class-validator | 0.15.1 | DTO validation | Validate request bodies in NestJS with `ValidationPipe` |
| class-transformer | 0.5.1 | DTO serialization | Transform request/response objects; exclude password fields from responses |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | Nodemailer | Nodemailer requires SMTP server; Resend is API-first and simpler; Nodemailer acceptable if external mail relay is available |
| httpOnly cookie for refresh token | localStorage for access token | httpOnly cookie is more secure (not accessible to JavaScript, XSS-resistant); tradeoff is CSRF requires SameSite=Strict; for internal app on same domain this is acceptable |
| In-memory permission cache | Redis | In-memory is sufficient at 8 users; Redis is the upgrade path when BullMQ is added (Phase 8) and can absorb permission cache at that point |
| Turborepo monorepo | Two separate repos | Monorepo enables shared types/Zod schemas; avoids type drift between API and frontend; Turborepo caching speeds builds |

**Installation:**
```bash
# Monorepo scaffold
npx create-turbo@latest konmaxperience --package-manager pnpm
# Then set up apps/api (NestJS), apps/web (Next.js), packages/types

# Backend (apps/api)
nest new api
npm install @nestjs/passport @nestjs/jwt @nestjs/config @nestjs/throttler
npm install passport passport-jwt bcrypt jose resend
npm install -D @types/passport-jwt @types/bcrypt
npm install class-validator class-transformer
npm install prisma @prisma/client && npx prisma init
npm install helmet

# Frontend (apps/web)
npx create-next-app@latest web --typescript --tailwind --app
npx shadcn@latest init
npm install zustand @tanstack/react-query react-hook-form @hookform/resolvers zod
```

**Version verification:** Verified against npm registry on 2026-03-19.

---

## Architecture Patterns

### Recommended Project Structure

```
konmaxperience/                    # Turborepo monorepo root
├── apps/
│   ├── api/                       # NestJS 11 backend
│   │   ├── src/
│   │   │   ├── auth/              # AuthModule: login, refresh, logout, guards
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts  # POST /auth/login, /auth/refresh, /auth/logout
│   │   │   │   ├── auth.service.ts     # validateUser(), login(), refreshToken()
│   │   │   │   ├── jwt.strategy.ts     # Extracts userId + roleCode from token
│   │   │   │   ├── jwt-auth.guard.ts   # Global guard (opt-out with @Public())
│   │   │   │   └── permissions.guard.ts # Checks permissions from cache
│   │   │   ├── users/             # UserModule: CRUD + admin management
│   │   │   │   ├── users.module.ts
│   │   │   │   ├── users.controller.ts # GET/POST/PATCH /users; POST /users/:id/reset-password
│   │   │   │   └── users.service.ts
│   │   │   ├── roles/             # RoleModule: role + permission management
│   │   │   │   ├── roles.module.ts
│   │   │   │   ├── roles.controller.ts # GET /roles; PATCH /roles/:id/permissions
│   │   │   │   └── roles.service.ts
│   │   │   ├── permissions/       # Permission cache + buildScopeFilter
│   │   │   │   ├── permissions.module.ts
│   │   │   │   ├── permissions.cache.ts  # In-memory Map<roleCode, Permission[]> with 60s TTL
│   │   │   │   └── scope.filter.ts       # buildScopeFilter(user) utility
│   │   │   ├── email/             # EmailModule: Resend integration
│   │   │   │   ├── email.module.ts
│   │   │   │   └── email.service.ts  # sendPasswordSetup(), sendPasswordReset()
│   │   │   ├── prisma/            # PrismaModule: shared PrismaService
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── public.decorator.ts      # @Public() — bypass JwtAuthGuard
│   │   │   │   │   ├── roles.decorator.ts       # @Roles('FOUNDER_ADMIN')
│   │   │   │   │   └── permissions.decorator.ts # @RequiresPermission('VIEW_ALL')
│   │   │   │   └── guards/
│   │   │   └── main.ts
│   │   └── prisma/
│   │       ├── schema.prisma      # Full 15-entity schema (defined in Phase 1)
│   │       ├── migrations/        # Migration history
│   │       └── seed.ts            # 8 roles + 8 users + 10 readiness meters + 8 zones
│   │
│   └── web/                       # Next.js 16 frontend
│       ├── app/
│       │   ├── (ops)/             # Authenticated internal ops
│       │   │   ├── layout.tsx     # Sidebar with role-scoped nav + admin user filter
│       │   │   └── dashboard/
│       │   │       └── page.tsx   # Role dashboard (Phase 1: scaffolded, real data Phase 7)
│       │   ├── (auth)/            # Login flow (no route group segment in URL)
│       │   │   ├── login/
│       │   │   │   └── page.tsx
│       │   │   ├── forgot-password/
│       │   │   │   └── page.tsx
│       │   │   └── set-password/
│       │   │       └── page.tsx   # New user sets password via email link token
│       │   ├── api/               # Next.js Route Handlers (thin proxies to NestJS API)
│       │   └── layout.tsx
│       ├── middleware.ts          # Edge JWT verification with jose; redirects to /login
│       ├── lib/
│       │   ├── auth.ts            # Client auth helpers (useAuth hook, logout action)
│       │   └── api-client.ts      # Typed fetch wrapper to NestJS
│       └── components/
│           ├── ops/
│           │   ├── Sidebar.tsx    # Role-scoped nav; admin shows all sections
│           │   └── AdminUserFilter.tsx  # Admin filter: "Show me [user]'s view"
│           └── shared/
│
└── packages/
    └── types/                     # Shared TypeScript types + Zod schemas
        ├── auth.ts                # LoginDto, JwtPayload, UserProfile
        ├── roles.ts               # RoleCode enum, Permission enum
        └── users.ts               # User, CreateUserDto
```

### Pattern 1: Token Carries Identity Only — Permissions Resolved from Cache

**What:** JWT payload contains only `{ userId, roleCode, iat, exp }`. No permissions array. Every authenticated request resolves permissions from an in-memory cache keyed by `roleCode`.

**When to use:** All authenticated API routes. This is the only correct pattern given admin-configurable permissions.

**Why:** If permissions were embedded in the JWT, an admin change to a role's permissions would take up to 7 days (token expiry) to propagate. With a cache TTL of 60 seconds, permission changes take effect within one minute without requiring logout.

```typescript
// apps/api/src/permissions/permissions.cache.ts
// Source: PITFALLS.md §Pitfall 3 + verified via WebSearch

type PermissionSet = string[]; // Permission enum values
const cache = new Map<string, { perms: PermissionSet; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function getPermissionsForRole(
  roleCode: string,
  prisma: PrismaService,
): Promise<PermissionSet> {
  const cached = cache.get(roleCode);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.perms;
  }
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  const perms = role?.permissions ?? [];
  cache.set(roleCode, { perms, expiresAt: Date.now() + CACHE_TTL_MS });
  return perms;
}

export function invalidateRoleCache(roleCode: string): void {
  cache.delete(roleCode);
}
```

### Pattern 2: Data-Layer Scope Filter (RBAC Enforcement Below Route Guards)

**What:** A `buildScopeFilter(user)` utility returns a mandatory Prisma WHERE clause fragment. Applied to every query involving user-scoped data. Prevents scoped users from accessing other users' data via query parameters.

**When to use:** Every service method that returns task-scoped, quest-scoped, or user-scoped data.

**Critical rule:** Route guards check permissions. Scope filters enforce data boundaries. Both must be present. Route guards alone are insufficient (PITFALLS.md §Pitfall 2).

```typescript
// apps/api/src/permissions/scope.filter.ts
// Source: PITFALLS.md §Pitfall 2 (RBAC data-layer bypass prevention)

import { Permission } from '@konma/types';

export interface ScopedUser {
  id: string;
  roleCode: string;
  permissions: string[];
}

export function buildScopeFilter(user: ScopedUser): Record<string, unknown> {
  if (user.permissions.includes(Permission.VIEW_ALL)) {
    return {}; // FOUNDER_ADMIN — no filter, sees everything
  }
  // All other roles see only their own assigned tasks
  return { owner_user_id: user.id };
}

// Usage in TasksService:
// const scopeFilter = buildScopeFilter(requestingUser);
// const tasks = await this.prisma.task.findMany({ where: { ...scopeFilter, ...queryFilters } });
```

### Pattern 3: Admin User-Level Filter (AUTH-06 Reinterpretation)

**What:** Admin can optionally pass `?viewAs=<userId>` to filter the view to a specific user's data. The admin retains FOUNDER_ADMIN permissions throughout — this is NOT role-switching. It is an optional additional WHERE clause applied on top of the admin's full access.

**When to use:** Admin dashboard calls to GET /tasks, GET /quests when admin wants to inspect a specific team member's work.

```typescript
// apps/api/src/tasks/tasks.service.ts
async findAll(requestingUser: ScopedUser, viewAsUserId?: string) {
  const scopeFilter = buildScopeFilter(requestingUser); // {} for admin
  const adminViewFilter =
    requestingUser.permissions.includes(Permission.VIEW_ALL) && viewAsUserId
      ? { owner_user_id: viewAsUserId }
      : {};

  return this.prisma.task.findMany({
    where: { ...scopeFilter, ...adminViewFilter },
  });
}
```

### Pattern 4: JWT with httpOnly Refresh Cookie

**What:** Access token (15-min expiry) stored in-memory on the client. Refresh token (7-day expiry) stored in httpOnly, SameSite=Strict cookie. Silent refresh before access token expires using a background interval or on 401 response.

**Why httpOnly cookie for refresh (Claude's discretion — RECOMMENDED):** Refresh token in httpOnly cookie is not accessible to JavaScript, eliminating XSS theft risk. Access token stays short-lived (15 min) minimizing exposure window. SameSite=Strict prevents CSRF on same-domain internal apps.

**Multi-device support:** Each login creates a new refresh token record in a `refresh_tokens` table (`id, user_id, token_hash, device_fingerprint, created_at, expires_at, revoked`). "Log out everywhere" sets `revoked = true` for all records for that user.

```typescript
// apps/api/src/auth/auth.service.ts — login response pattern
// Source: NestJS official auth docs + WebSearch verified 2026

async login(user: User): Promise<{ accessToken: string }> {
  const payload: JwtPayload = { userId: user.id, roleCode: user.role.code };
  const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
  const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

  await this.storeRefreshToken(user.id, refreshToken); // hashed in DB
  return { accessToken, refreshToken }; // controller sets refresh as httpOnly cookie
}
```

### Pattern 5: Next.js Edge Middleware with jose

**What:** `middleware.ts` uses `jose` (not `jsonwebtoken`) for JWT verification. jsonwebtoken requires Node.js crypto module which is unavailable in the edge runtime.

**When to use:** All protected routes in the `(ops)` group.

```typescript
// apps/web/middleware.ts
// Source: STATE.md concern + WebSearch verified (jose for edge runtime)

import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const PUBLIC_PATHS = ['/login', '/forgot-password', '/set-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('access_token')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.userId as string);
    response.headers.set('x-role-code', payload.roleCode as string);
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
```

### Pattern 6: Prisma Interactive Transaction for Multi-Step Operations

**What:** Prisma 7 fully rewrites in TypeScript (no native Rust binaries). Interactive transactions via `prisma.$transaction(async (tx) => { ... })` work correctly in NestJS. Nested writes within an interactive transaction are collapsed into a single transaction by Prisma automatically.

**When to use:** Any operation that writes to multiple tables atomically. For Phase 1: user creation + role assignment; password reset token creation. In later phases: the validate_task cascade.

```typescript
// apps/api/src/users/users.service.ts
// Source: Prisma docs on transactions (verified via WebSearch 2025)

async createUser(dto: CreateUserDto): Promise<User> {
  return this.prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password_hash: await bcrypt.hash(generateTempPassword(), 12),
        role_id: dto.roleId,
        status: 'active',
      },
    });
    // Send setup email outside transaction (side effect — cannot roll back email)
    return user;
  });
}
```

### Anti-Patterns to Avoid

- **Permissions array in JWT payload:** Admin can change permissions mid-session but token keeps old permissions until expiry. The only safe pattern is: token has role_code, permissions from cache.
- **Route guard without data-layer scope filter:** A user with `VIEW_ROLE_SCOPED` can still fetch other users' tasks by passing `?owner_user_id=<other>`. The WHERE clause MUST be applied in the service layer unconditionally.
- **Single progress_percent on quests:** Must be designed with dual-track (`core_progress_percent` + `adhoc_progress_percent`) from the schema level in Phase 1 to avoid a painful migration later.
- **Storing password reset tokens as plaintext:** Store only the hash; the token sent in the email is the plaintext. Hash with bcrypt or SHA-256.
- **Creating refresh_tokens table in a later phase:** Multi-device logout requires it from Phase 1. If deferred, logout-everywhere cannot be implemented without a migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing + verification | Custom crypto | @nestjs/jwt + jose | JWT signing has subtle security requirements (algorithm confusion, weak secrets); these libraries handle HS256/RS256 correctly |
| Password hashing | MD5, SHA1, custom | bcrypt | bcrypt has adaptive cost factor (work factor increases as CPUs get faster); MD5/SHA1 are broken for passwords |
| Request body validation | Manual if-checks | class-validator + ValidationPipe | ValidationPipe auto-rejects malformed requests before reaching controller; whitelist: true strips unknown fields |
| Email delivery | Raw SMTP | Resend | SMTP requires server config, SPF/DKIM setup, deliverability management; Resend handles all of this |
| Permission UI | Custom drag-drop | shadcn/ui table + checkboxes | The permission settings screen is a simple matrix; shadcn Table + Checkbox covers it cleanly |
| Edge JWT verification | jwt-decode (no verify) | jose | jwt-decode only decodes, does not verify signature. jose's jwtVerify() verifies signature, expiry, and claims |

**Key insight:** The auth stack (bcrypt + JWT + Guards + cache) has well-understood implementations. The risk in this domain is subtle mistakes (algorithm choices, httpOnly vs localStorage) not build complexity. Use established libraries and patterns.

---

## Common Pitfalls

### Pitfall 1: Stale Permissions from JWT Payload
**What goes wrong:** Including permissions array in JWT payload means permission changes by admin take up to 7 days to propagate.
**Why it happens:** Tempting because it avoids a cache lookup per request.
**How to avoid:** Token carries only `userId + roleCode`. Permissions always resolved from cache (60s TTL). Invalidate cache on PATCH /roles/:id/permissions.
**Warning signs:** JWT payload contains `permissions: [...]` key.

### Pitfall 2: RBAC Data-Layer Bypass
**What goes wrong:** Route guard checks role but service query has no scope filter. User with VIEW_ROLE_SCOPED can add `?owner_user_id=<admin>` and get admin's tasks.
**Why it happens:** Route-level protection feels sufficient.
**How to avoid:** `buildScopeFilter(user)` applied unconditionally in every service method. Test by authenticating as a scoped user and attempting to query another user's data by ID.
**Warning signs:** No `owner_user_id` filter in service-level queries; tests only check HTTP status codes.

### Pitfall 3: jsonwebtoken in Next.js Middleware
**What goes wrong:** `jsonwebtoken` throws at runtime in Next.js middleware because it depends on Node.js `crypto` module, which is unavailable in the edge runtime.
**Why it happens:** Developers install jsonwebtoken (the standard library) and forget middleware runs at edge.
**How to avoid:** Use `jose` exclusively in `middleware.ts`. NestJS API can use @nestjs/jwt (which uses jsonwebtoken internally) for signing/verifying server-side.
**Warning signs:** `Error: The edge runtime does not support Node.js 'crypto' module` in build or runtime output.

### Pitfall 4: Missing refresh_tokens Table
**What goes wrong:** "Log out everywhere" functionality cannot be implemented without tracking active refresh tokens per device.
**Why it happens:** Developers skip the table assuming JWT expiry is sufficient.
**How to avoid:** Create `refresh_tokens` table in the Phase 1 schema with `user_id`, `token_hash`, `revoked_at`, `expires_at`. Logout-this-device sets revoked_at on current token; logout-everywhere sets revoked_at on all user's tokens.
**Warning signs:** No refresh_tokens entity in Prisma schema; "log out everywhere" feature deferred.

### Pitfall 5: Ad-Hoc Task Progress Breaking Quest Calculation
**What goes wrong:** Quest progress drops when admin injects ad-hoc tasks (quest was 80% → becomes 73% after new task added). Team perceives system as broken.
**Why it happens:** Single `progress_percent` field treats all tasks identically.
**How to avoid:** Schema must include dual-track progress from Phase 1: `core_progress_percent` and `adhoc_progress_percent` on quests table. Also store `baseline_task_count` (count at quest creation time).
**Warning signs:** Quest schema has single `progress_percent` field; no `baseline_task_count`.

### Pitfall 6: Password Reset Token Stored as Plaintext
**What goes wrong:** If the database is breached, attackers get valid password reset tokens.
**Why it happens:** Convenience — easier to look up by token value.
**How to avoid:** Generate a random token (crypto.randomBytes(32)), email the token, store only SHA-256 hash in `password_reset_tokens` table. On reset, hash the incoming token and compare.

---

## Code Examples

Verified patterns from official sources and project research:

### Prisma Schema — Critical Phase 1 Fields

```prisma
// apps/api/prisma/schema.prisma
// Excerpted — shows fields critical to Phase 1 auth + RBAC decisions

model Role {
  id          String   @id @default(uuid())
  code        String   @unique  // Immutable string enum e.g. "FRONTEND_LEAD"
  name        String
  description String
  permissions String[] // Array of Permission enum values; admin-editable
  created_at  DateTime @default(now())
  users       User[]
}

model User {
  id             String   @id @default(uuid())
  name           String
  email          String   @unique
  password_hash  String
  role_id        String
  role           Role     @relation(fields: [role_id], references: [id])
  function       String   // functional domain enum
  status         String   @default("active") // active | inactive
  xp_total       Int      @default(0)
  level          Int      @default(1)
  streak_days    Int      @default(0)
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
  refresh_tokens RefreshToken[]
  reset_tokens   PasswordResetToken[]
}

model RefreshToken {
  id         String    @id @default(uuid())
  user_id    String
  user       User      @relation(fields: [user_id], references: [id])
  token_hash String    // SHA-256 of the actual refresh token
  revoked_at DateTime?
  expires_at DateTime
  created_at DateTime  @default(now())
  @@index([user_id])
}

model PasswordResetToken {
  id         String   @id @default(uuid())
  user_id    String
  user       User     @relation(fields: [user_id], references: [id])
  token_hash String   // SHA-256 of emailed token
  expires_at DateTime
  used_at    DateTime?
  created_at DateTime @default(now())
}

// CRITICAL PHASE 1 SCHEMA DECISION: dual-track quest progress
model Quest {
  id                    String   @id @default(uuid())
  mission_id            String
  title                 String
  description           String
  week_number           Int
  owner_user_id         String
  status                String   @default("planned")
  baseline_task_count   Int      @default(0)  // Set at creation, never changes
  core_progress_percent Float    @default(0)  // valid core tasks / baseline_task_count
  adhoc_progress_percent Float   @default(0)  // valid adhoc tasks / total adhoc tasks
  progress_percent      Float    @default(0)  // Derived display field
  start_date            DateTime?
  end_date              DateTime?
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt
}
```

### NestJS JwtStrategy — Identity Only

```typescript
// apps/api/src/auth/jwt.strategy.ts
// Source: NestJS official authentication docs

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@konma/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  // Only userId and roleCode in token — permissions resolved from cache per request
  async validate(payload: JwtPayload) {
    return { id: payload.userId, roleCode: payload.roleCode };
  }
}
```

### Global JwtAuthGuard with @Public() Escape Hatch

```typescript
// apps/api/src/auth/jwt-auth.guard.ts
// Source: NestJS docs + RBAC Guards pattern (oneuptime.com Jan 2026)

import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
// Register globally in AppModule providers:
// { provide: APP_GUARD, useClass: JwtAuthGuard }
```

### Permission Guard (resolves from cache)

```typescript
// apps/api/src/auth/permissions.guard.ts
// Source: PITFALLS.md §Pitfall 3 + RBAC guide (leapcell.io 2025)

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    const perms = await getPermissionsForRole(user.roleCode, this.prisma);
    return perms.includes(required);
  }
}
```

### Seed Data Structure

```typescript
// apps/api/prisma/seed.ts — Phase 1 critical seed data

const ROLES = [
  { code: 'FOUNDER_ADMIN',   name: 'Founder/Admin',          permissions: ['VIEW_ALL','CREATE_MISSION','CREATE_QUEST','CREATE_TASK','UPDATE_ANY_TASK','APPROVE_EVIDENCE','VERIFY_TASK','CREATE_DECISION','APPROVE_DECISION','MANAGE_RBAC','CREATE_ADHOC_TASK','MANAGE_SYSTEM'] },
  { code: 'FRONTEND_LEAD',   name: 'Frontend Lead',          permissions: ['VIEW_ROLE_SCOPED','CREATE_TASK','UPDATE_OWN_TASK','UPLOAD_EVIDENCE','APPROVE_EVIDENCE','VERIFY_TASK','CREATE_DECISION'] },
  { code: 'BACKEND_LEAD',    name: 'Backend Lead',           permissions: ['VIEW_ROLE_SCOPED','CREATE_TASK','UPDATE_OWN_TASK','UPLOAD_EVIDENCE','APPROVE_EVIDENCE','VERIFY_TASK','CREATE_DECISION'] },
  { code: 'BI_LEAD',         name: 'BI Lead',                permissions: ['VIEW_ROLE_SCOPED','CREATE_TASK','UPDATE_OWN_TASK','UPLOAD_EVIDENCE','CREATE_DECISION'] },
  { code: 'PROCUREMENT_LEAD',name: 'Procurement Lead',       permissions: ['VIEW_ROLE_SCOPED','CREATE_TASK','UPDATE_OWN_TASK','UPLOAD_EVIDENCE','APPROVE_EVIDENCE','VERIFY_TASK'] },
  { code: 'TALENT_LEAD',     name: 'Talent Lead',            permissions: ['VIEW_ROLE_SCOPED','CREATE_TASK','UPDATE_OWN_TASK','UPLOAD_EVIDENCE'] },
  { code: 'TECH_LEAD',       name: 'Tech Lead',              permissions: ['VIEW_ROLE_SCOPED','CREATE_TASK','UPDATE_OWN_TASK','UPLOAD_EVIDENCE','VERIFY_TASK','MANAGE_SYSTEM'] },
  { code: 'DESIGN_OUTREACH_LEAD', name: 'Design/Outreach Lead', permissions: ['VIEW_ROLE_SCOPED','CREATE_TASK','UPDATE_OWN_TASK','UPLOAD_EVIDENCE','CREATE_DECISION'] },
];
// + 8 initial users (one per role) with temporary hashed passwords
// + 10 readiness meters (VILLA, BACKEND, FRONTEND, PROCUREMENT, STANDARDIZATION, SALES, TECH, TALENT, ART_EXPERIENCE, LIFESTYLE_EXPERIENCE)
// + 8 zones (Food Innovation Lab, Production Kitchen, Frontend Experience Zone, ...)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jsonwebtoken in Next.js middleware | jose for edge runtime JWT verification | Next.js Edge Runtime GA (2022, widespread 2023) | jsonwebtoken will throw at runtime in middleware; must use jose |
| Permissions array in JWT payload | Token carries identity only; permissions from cache | Best practice shift 2023-2025 as admin-configurable RBAC became standard | Eliminates stale-permissions security issue |
| TypeORM for NestJS | Prisma (v7 fully TS, no Rust binaries) | Prisma 7 released 2025 | Prisma 7 drops native binaries; pure TypeScript; better serverless compatibility |
| Auth0/Clerk for internal tools | Custom NestJS JWT with Passport | Ongoing; preference for internal apps where user count is fixed | Eliminates external auth vendor dependency for 8-user internal system |
| Role-perspective switching (dropdown) | Admin super-role with user-level filter | Decided in CONTEXT.md | Simpler mental model; admin always has full context |
| NextAuth v4 | Not used (custom NestJS JWT) | NextAuth v4 deprecated; Auth.js v5 is successor | Custom JWT is lighter and avoids third-party auth complexity for fixed internal users |

**Deprecated/outdated:**
- `jsonwebtoken` in Next.js `middleware.ts`: will fail with edge runtime error. Use `jose`.
- `TypeORM`: maintenance slowed; community moved to Prisma/Drizzle.
- Permissions in JWT: stale-permissions problem. Token = identity only.
- `Bull` (not BullMQ): maintenance-only. Use BullMQ when adding job queue in Phase 8.

---

## Open Questions

1. **Monorepo or separate repos?**
   - What we know: Turborepo + pnpm monorepo enables shared `packages/types` (Zod schemas, TypeScript interfaces) between NestJS and Next.js. Prevents type drift.
   - What's unclear: Whether the user has a preference for repo structure.
   - Recommendation: Default to Turborepo monorepo. If user prefers separate repos, shared types must be published as an npm package or duplicated manually.

2. **httpOnly cookie vs localStorage for access token**
   - What we know: httpOnly cookie (refresh) + in-memory (access) is the most secure pattern. localStorage is simpler to implement but vulnerable to XSS.
   - What's unclear: This is marked Claude's discretion.
   - Recommendation: httpOnly cookie for refresh token; access token in memory (Zustand store, cleared on tab close). This is the recommended pattern per security research.

3. **Email service: Resend vs Nodemailer**
   - What we know: Resend is simpler (REST API, no SMTP), free tier covers 3,000 emails/month, has React email template support. Nodemailer is more universal.
   - What's unclear: Whether user has a domain already verified with Resend or a preferred SMTP provider.
   - Recommendation: Resend as primary. Nodemailer as documented fallback if Resend is blocked.

4. **Permission defaults per role**
   - What we know: Dev spec lists 15 permission enums and 8 roles. Default assignments are inference based on role descriptions.
   - What's unclear: Whether Anchitha (Frontend Lead) should have APPROVE_EVIDENCE for cross-functional tasks.
   - Recommendation: Research-derived defaults provided in seed data above. Mark as admin-configurable so they can be adjusted on day one via the permissions settings screen.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (auto-configured by NestJS CLI) |
| Config file | `apps/api/jest.config.ts` — generated by `nest new` |
| Quick run command | `cd apps/api && npx jest --testPathPattern=auth --passWithNoTests` |
| Full suite command | `cd apps/api && npx jest --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | POST /auth/login returns JWT on valid credentials | unit | `npx jest auth.service --passWithNoTests` | Wave 0 |
| AUTH-01 | POST /auth/login returns 401 on bad password | unit | `npx jest auth.service --passWithNoTests` | Wave 0 |
| AUTH-02 | 8 roles seeded with correct codes | unit | `npx jest seed.spec --passWithNoTests` | Wave 0 |
| AUTH-02 | RolesGuard returns 403 for wrong role | unit | `npx jest roles.guard --passWithNoTests` | Wave 0 |
| AUTH-03 | PermissionsGuard resolves from cache (not JWT payload) | unit | `npx jest permissions.guard --passWithNoTests` | Wave 0 |
| AUTH-03 | buildScopeFilter returns empty for VIEW_ALL, user filter for scoped | unit | `npx jest scope.filter --passWithNoTests` | Wave 0 |
| AUTH-03 | Permission change invalidates cache within 60s | unit | `npx jest permissions.cache --passWithNoTests` | Wave 0 |
| AUTH-04 | Refresh token endpoint returns new access token | unit | `npx jest auth.service --passWithNoTests` | Wave 0 |
| AUTH-04 | Expired access token with valid refresh returns new access token | unit | `npx jest auth.service --passWithNoTests` | Wave 0 |
| AUTH-05 | FOUNDER_ADMIN GET /tasks returns all tasks unfiltered | unit | `npx jest tasks.service --passWithNoTests` | Wave 0 |
| AUTH-05 | Scoped role GET /tasks returns only own tasks | unit | `npx jest tasks.service --passWithNoTests` | Wave 0 |
| AUTH-06 | Admin GET /tasks?viewAs=<userId> returns that user's tasks only | unit | `npx jest tasks.service --passWithNoTests` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/api && npx jest --testPathPattern=auth --passWithNoTests`
- **Per wave merge:** `cd apps/api && npx jest --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/auth/auth.service.spec.ts` — covers AUTH-01, AUTH-04 (login, refresh)
- [ ] `apps/api/src/auth/jwt-auth.guard.spec.ts` — covers AUTH-02 (RolesGuard behavior)
- [ ] `apps/api/src/permissions/permissions.guard.spec.ts` — covers AUTH-03 (permission resolution)
- [ ] `apps/api/src/permissions/scope.filter.spec.ts` — covers AUTH-03, AUTH-05, AUTH-06
- [ ] `apps/api/src/permissions/permissions.cache.spec.ts` — covers AUTH-03 (cache TTL + invalidation)
- [ ] `apps/api/prisma/seed.spec.ts` — covers AUTH-02 (8 roles seeded correctly)
- [ ] `apps/api/src/tasks/tasks.service.spec.ts` — covers AUTH-05, AUTH-06 (scope filter in queries)
- [ ] Framework install: `cd apps/api && npx @nestjs/cli new api` — scaffolded by NestJS CLI with Jest config

---

## Sources

### Primary (HIGH confidence)

- NestJS official authentication docs — https://docs.nestjs.com/security/authentication — Passport JWT strategy, Guards pattern, @Public() decorator
- NestJS official Prisma recipe — https://docs.nestjs.com/recipes/prisma — PrismaService setup, lifecycle hooks
- Prisma transactions documentation — https://www.prisma.io/docs/orm/prisma-client/queries/transactions — interactive transactions, nested writes behavior
- PITFALLS.md (project-level, first-party) — Pitfall 2 (data-layer RBAC), Pitfall 3 (stale JWT permissions), Pitfall 4 (approval deadlock), Pitfall 5 (readiness double-counting)
- STACK.md (project-level, first-party) — locked stack decisions, version compatibility matrix
- ARCHITECTURE.md (project-level, first-party) — middleware pattern, scope filter pattern, route group structure
- dev_spec.md (project-level, first-party) — 15 permission enums, 8 role codes, all entity schemas, auth API structure

### Secondary (MEDIUM confidence)

- WebSearch verified: jose for Next.js edge runtime JWT verification — multiple 2025-2026 sources confirm jsonwebtoken fails at edge; jose is the standard solution
- WebSearch verified: httpOnly cookie for refresh tokens in NestJS — multiple sources confirm this as security best practice
- RBAC with Custom Guards in NestJS (oneuptime.com, Jan 2026) — https://oneuptime.com/blog/post/2026-01-25-rbac-custom-guards-nestjs/view
- Resend + NestJS integration (shaoxuan.dev, Jan 2025) — https://shaoxuandev10.medium.com/using-resend-with-a-nestjs-backend-a-step-by-step-guide-54a449d1b3d4
- Prisma 7 + NestJS (Medium, 2025) — https://medium.com/@msmiraj8/get-started-with-prisma-7-with-nest-js-mysql-3919eaa7c760

### Tertiary (LOW confidence, flagged for validation)

- Turborepo official NestJS + Next.js + shadcn example PR — https://github.com/vercel/turborepo/pull/10792 — monorepo structure confirmed by PR but not yet merged; validate Turborepo setup against current docs before scaffolding

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core packages verified against npm registry on 2026-03-19; stack locked by project decisions
- Architecture: HIGH — patterns sourced from project ARCHITECTURE.md (first-party) and NestJS/Prisma official docs
- JWT/jose edge runtime: HIGH — confirmed by multiple 2025-2026 sources; STATE.md concern resolved
- Prisma transactions: HIGH — confirmed by official Prisma docs; STATE.md concern resolved
- Permission defaults: MEDIUM — derived from dev_spec role descriptions; admin-configurable so incorrect defaults are easily corrected
- Email provider (Resend): MEDIUM — no first-party confirmation of Resend availability; Nodemailer is documented fallback

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable stack; 30-day validity reasonable)

**STATE.md concerns addressed:**
- [Resolved] Edge-compatible JWT library: use `jose` in `middleware.ts`; `@nestjs/jwt` in NestJS API
- [Resolved] Prisma transaction API: interactive transactions with `$transaction(async (tx) => {...})` work correctly in NestJS; nested writes collapse to single transaction automatically
- [Pending] Payment gateway (Phase 9) — not in scope for Phase 1
