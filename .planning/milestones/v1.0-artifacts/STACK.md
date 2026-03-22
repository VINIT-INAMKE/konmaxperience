# Stack Research

**Domain:** Role-based food operations platform (internal ops OS + customer-facing)
**Researched:** 2026-03-19
**Confidence:** HIGH (core stack), MEDIUM (supporting libraries)

---

## Decision Summary

| Question | Answer | Confidence |
|----------|--------|------------|
| Express vs NestJS? | **NestJS** | HIGH |
| Postgres vs MongoDB? | **PostgreSQL** | HIGH |
| ORM? | **Prisma** | HIGH |
| Frontend framework? | **Next.js 16** (App Router) | HIGH |
| Auth approach? | **NestJS + Passport JWT + RolesGuard** | HIGH |
| Storage? | **Cloudflare R2** (S3-compatible) | MEDIUM |
| Managed DB? | **Neon** (serverless Postgres) | HIGH |
| UI library? | **shadcn/ui + Tailwind CSS 4** | HIGH |

---

## Why NestJS, Not Express

Express is a micro-framework — minimal structure, no built-in DI, no module system, no decorators, no RBAC primitives. For a solo-to-small-team project building a system with 15 entities, multi-tier RBAC (8 roles, 15 permission enums), approval workflows, background job queues, and a governance engine, Express would require assembling all of this by hand. You'd end up building NestJS anyway, just worse.

**NestJS wins here because:**

1. **RBAC is first-class.** NestJS Guards + custom decorators (`@Roles()`, `@HasPermissions()`) map directly onto this project's permission model. The dev spec's role-scoped access patterns (`VIEW_ROLE_SCOPED`, `APPROVE_EVIDENCE`, `VERIFY_TASK`) have exact NestJS implementations in current docs.

2. **Module system matches the domain model.** Each of the 15 entities (missions, quests, tasks, evidence, approvals, decisions, etc.) becomes a NestJS module — this isn't boilerplate overhead, it's the architecture the spec demands. Express would require you to invent this structure.

3. **Integrated testing.** NestJS ships Jest config and auto-generates test files. The approval/validation business logic in the spec (`validate_task`, `update_readiness_from_task`, `create_cross_function_decision`) is exactly the kind of unit-testable service layer that NestJS DI makes trivial.

4. **TypeScript-first.** The entire dev spec is typed (UUIDs, enums, status fields). NestJS with Prisma gives end-to-end type safety. Express requires manual typing everywhere.

5. **NestJS 11 is current.** Released early 2025, now at 11.1.17 (as of March 2026). Active development, stable LTS.

**Choose Express when:** solo developer, <5 endpoints, or building a stateless microservice in 2 days. Not this project.

---

## Why PostgreSQL, Not MongoDB

The dev spec defines 15 entities with explicit foreign keys, join relationships, and multi-step transactional workflows. This is relational data by design.

**Specific reasons MongoDB fails here:**

1. **The approval model requires JOINs.** The `approvals` table references `entity_type + entity_id` (polymorphic), `required_role_code`, and needs to be queried alongside `tasks`, `decisions`, and `evidence` simultaneously. In MongoDB, this requires application-level JOINs that are slow, complex, and error-prone.

2. **Task validity is a transaction.** The `validate_task` business rule requires atomically checking task status, evidence approval, and all approval records — then updating task, user XP, quest progress, mission progress, and readiness events. PostgreSQL handles this with a single ACID transaction. MongoDB's multi-document transactions are bolted on and carry overhead.

3. **Readiness meters are aggregates over valid tasks.** This is a relational aggregate query (`SUM(value) WHERE applied = true GROUP BY meter_id`). PostgreSQL handles it in one query. MongoDB requires either aggregation pipelines or denormalized documents — either approach increases complexity.

4. **RBAC enforcement at DB level.** PostgreSQL row-level security (RLS) can enforce `VIEW_ROLE_SCOPED` at the database layer if needed. MongoDB has no equivalent.

5. **Neon Postgres integrates natively with Vercel.** Vercel Postgres transitioned to Neon in Q4 2024. The deployment story (Vercel + Neon) is purpose-built for this use case — every Vercel preview deployment gets its own Neon branch.

**Choose MongoDB when:** data is document-centric, schema evolves rapidly, you have deep nesting, or you're building a CMS/catalog. None of these apply here.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2 | Frontend + customer-facing UI | Locked requirement; App Router + React 19.2; Turbopack stable default; SSR for role dashboards |
| NestJS | 11.1.x | Backend REST API | Opinionated structure matches the 15-entity domain model; RBAC Guards/Decorators built-in; TypeScript-first |
| PostgreSQL | 16 (via Neon) | Primary database | All 15 entities are relational; ACID transactions for task validation; multi-join queries for readiness aggregation |
| Prisma | 7.x | ORM | Schema-first type safety; migration tooling; NestJS official recipe; PostgreSQL JSONB support if needed |
| TypeScript | 5.x | Language (both sides) | Shared types between frontend/backend; NestJS and Prisma are TS-native |

### Frontend (Next.js Layer)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | latest | Component library (Radix primitives + Tailwind) | All UI components — dashboards, forms, tables, cards |
| Tailwind CSS | 4.x | Utility-first CSS | All styling; CSS-first config (no tailwind.config.js in v4) |
| React Query (TanStack Query) | 5.x | Server state management | All API calls from client components; caching, invalidation, optimistic updates |
| React Hook Form | 7.x | Form management | Task creation, evidence upload, approval forms |
| Zod | 4.x | Schema validation | Client-side validation; shared schemas with backend via monorepo or shared package |
| Zustand | 4.x | Client state | Auth state, UI state (modals, filters, sidebar); lightweight alternative to Redux |
| date-fns | 3.x | Date utilities | Due dates, streak calculations, timeline rendering |
| Recharts | 2.x | Charts | Readiness meter gauges, KPI trend lines, leaderboard bars |

### Backend (NestJS Layer)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/core | 11.x | NestJS core | Always |
| @nestjs/passport | 10.x | Passport integration | Auth module; JWT strategy binding |
| @nestjs/jwt | 10.x | JWT handling | Token signing + verification in AuthModule |
| passport-jwt | 4.x | JWT strategy | Stateless token extraction and validation |
| bcrypt | 5.x | Password hashing | User password storage (never store plaintext) |
| class-validator | 0.14.x | DTO validation | Request body validation via `ValidationPipe` |
| class-transformer | 0.5.x | DTO transformation | Serialize/deserialize request/response objects |
| @nestjs/bullmq | 10.x | Background job queue | Notification dispatch, readiness recalculation, XP recompute |
| bullmq | 5.x | Job queue (Redis-backed) | Underlying queue for BullMQ; enables delayed/scheduled notifications |
| @aws-sdk/client-s3 | 3.x | S3-compatible uploads | Evidence file uploads to Cloudflare R2 |
| @aws-sdk/lib-storage | 3.x | Multipart upload | Large file uploads (videos, docs) |
| multer | 1.x | Multipart file handling | File extraction from HTTP requests before S3 upload |
| helmet | 7.x | HTTP security headers | Prevents XSS, clickjacking, MIME sniffing |
| @nestjs/throttler | 6.x | Rate limiting | Prevents API abuse; apply to auth and upload routes |
| compression | 1.x | Gzip response | Leaderboard and mission board payloads can be large |

### Infrastructure

| Technology | Purpose | Why |
|------------|---------|-----|
| Neon (serverless Postgres) | Managed PostgreSQL | Native Vercel integration; branch per PR; scale-to-zero; no ops overhead; free tier generous enough for 8 internal users |
| Cloudflare R2 | Evidence file storage | Zero egress fees (vs AWS S3 which charges per GB out); S3-compatible API means `@aws-sdk/client-s3` works unchanged; $0.015/GB storage vs S3 $0.023/GB |
| Upstash Redis | BullMQ backing store | Serverless Redis; no persistent server needed; pairs with Vercel deployment model; free tier covers notification queue for 8 users |
| Vercel | Frontend deployment | Required; Next.js is Vercel-native; edge middleware, preview deployments with Neon branching |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Prisma CLI | Schema management, migrations | `npx prisma migrate dev` for local; `npx prisma migrate deploy` for production |
| NestJS CLI | Module/service/guard scaffolding | `nest g module missions`, `nest g service tasks`, etc. |
| Vitest or Jest | Unit testing | NestJS ships Jest config; Vitest is faster for pure TS unit tests |
| ESLint + Prettier | Code style | NestJS CLI configures ESLint by default; enforce consistency |
| Postman / Bruno | API testing during dev | Bruno is Git-friendly (stores requests as files) |

---

## Installation

```bash
# --- Backend (NestJS) ---
# Scaffold
npx @nestjs/cli new konma-api

# Core auth
npm install @nestjs/passport @nestjs/jwt passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt

# Validation
npm install class-validator class-transformer

# ORM
npm install prisma @prisma/client
npx prisma init

# Background jobs
npm install @nestjs/bullmq bullmq

# File uploads + S3
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage multer
npm install -D @types/multer

# Security
npm install helmet @nestjs/throttler compression

# --- Frontend (Next.js) ---
# Scaffold
npx create-next-app@latest konma-web --typescript --tailwind --app

# UI
npx shadcn@latest init

# State + data fetching
npm install @tanstack/react-query zustand

# Forms + validation
npm install react-hook-form @hookform/resolvers zod

# Utilities
npm install date-fns recharts
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Backend framework | NestJS 11 | Express | No DI, no module system, no RBAC primitives; requires assembling everything manually for a 15-entity system |
| Database | PostgreSQL (Neon) | MongoDB (Atlas) | 15 entities are relational with explicit FK constraints; ACID transactions needed for task validation cascade; no schema flexibility advantage here |
| ORM | Prisma 7 | Drizzle ORM | Drizzle is faster in benchmarks but Prisma has better DX for complex multi-relation schemas; Prisma's schema file is easier to maintain with 15 entities; NestJS official recipe uses Prisma |
| ORM | Prisma 7 | TypeORM | TypeORM has active maintenance issues as of 2025; decorator-heavy approach conflicts with Prisma's cleaner migrations |
| Storage | Cloudflare R2 | AWS S3 | R2 is S3-compatible so no code difference, but zero egress fees; at any scale, R2 is materially cheaper for photo/video evidence retrieval |
| Storage | Cloudflare R2 | Cloudinary | Cloudinary is expensive ($99/mo middle tier); this project needs raw storage, not image transformation |
| Redis | Upstash | Railway Redis | Upstash is serverless (no persistent process); better fit for Vercel deployment; free tier adequate for notification queue |
| UI | shadcn/ui + Tailwind | MUI (Material UI) | shadcn/ui ships with Radix primitives that are accessible and composable; MUI adds bundle weight and has opinionated styling that fights customization |
| State | Zustand | Redux Toolkit | 8 internal users, no megastate; Zustand is 1KB and handles auth + UI state trivially |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| TypeORM | Maintenance has slowed; decorator-based approach causes subtle migration issues with complex schemas; community moving to Prisma/Drizzle | Prisma 7 |
| Sequelize | Legacy; no native TypeScript; verbose and error-prone compared to modern ORMs | Prisma 7 |
| next-auth (NextAuth) v4 | v4 is deprecated; Auth.js v5 is the successor but introducing third-party auth in v1 adds complexity without benefit when JWT-only is sufficient | Custom NestJS JWT with Passport |
| Clerk / Auth0 | External auth vendors add cost and dependency for a system with 8 fixed internal users; overkill | Custom NestJS JWT with Passport |
| FastAPI / Python | Explicitly excluded per project constraints; inconsistent with Node.js ecosystem | NestJS |
| Supabase | Explicitly excluded; also: Supabase auth and storage would create vendor lock-in on critical paths | Custom NestJS + Neon + R2 |
| Bull (not BullMQ) | Bull is in maintenance-only mode; BullMQ is the TypeScript rewrite with active development | BullMQ |
| GraphQL | REST is sufficient for v1 per dev spec; GraphQL adds schema layer complexity without benefit for 8 internal users | REST (NestJS controllers) |
| Socket.io for notifications | Heavy WebSocket server; for 8 users, BullMQ-triggered email/push notifications are sufficient in v1 | BullMQ + email (v1), SSE or polling for live updates |
| Mongoose | Tied to MongoDB, which is not the recommended DB for this schema | Prisma + PostgreSQL |

---

## Stack Patterns by Variant

**Auth flow (RBAC):**
- Use `@nestjs/passport` with `JwtStrategy` for token verification
- Use custom `@Roles()` decorator + `RolesGuard` for permission checks
- Store role + permissions array in the JWT payload (roles are fixed for 8 users, no dynamic re-fetch needed)
- Apply `RolesGuard` globally, use `@Public()` decorator to opt-out on login/register routes

**Evidence upload flow:**
- Use `FileInterceptor` (NestJS Multer integration) to accept the file
- Upload directly to Cloudflare R2 with `@aws-sdk/lib-storage` `Upload` class (handles multipart for large files)
- Store the R2 URL in the `evidence.url` field; never serve files through the NestJS server

**Background jobs (notifications + XP):**
- Dispatch BullMQ jobs on: task status change, evidence approval, approaching due dates (cron)
- Processor pattern: `@Processor('notifications')` class with `@Process()` methods per job type
- Use Upstash Redis as the BullMQ backing store (serverless-compatible)

**Deployment:**
- NestJS backend on Railway or Render (not Vercel — Vercel serverless functions have cold starts and execution limits unsuitable for a stateful NestJS app)
- Next.js frontend on Vercel (standard)
- Neon for Postgres (connects from both Railway/Render and Vercel)
- Cloudflare R2 for evidence files

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| NestJS 11.x | Node.js 18, 20, 22 | Requires Node 18+ minimum |
| Prisma 7.x | Node.js 18+ | v7 drops Node 16 support |
| Next.js 16.x | React 19.2 | Uses React 19 features (View Transitions, improved Server Components) |
| Tailwind CSS 4.x | shadcn/ui latest | shadcn/ui CLI updated for Tailwind v4; CSS-first config |
| BullMQ 5.x | @nestjs/bullmq 10.x | Must use matching major versions |
| @aws-sdk/client-s3 3.x | Cloudflare R2 | Set `endpoint: 'https://<account>.r2.cloudflarestorage.com'` and `forcePathStyle: true` |
| Zod 4.x | React Hook Form 7.x | Use `@hookform/resolvers/zod` — supports Zod v4 |

---

## Sources

- [NestJS 11 Release — Trilon Consulting](https://trilon.io/blog/announcing-nestjs-11-whats-new) — NestJS 11 features, CQRS, microservice improvements
- [NestJS Docs: Authentication](https://docs.nestjs.com/security/authentication) — Passport JWT strategy, Guards pattern
- [NestJS Docs: Queues](https://docs.nestjs.com/techniques/queues) — BullMQ integration
- [Best ORM for NestJS 2025 — DEV Community](https://dev.to/sasithwarnakafonseka/best-orm-for-nestjs-in-2025-drizzle-orm-vs-typeorm-vs-prisma-229c) — Prisma vs Drizzle vs TypeORM comparison
- [Prisma + NestJS Official Recipe](https://docs.nestjs.com/recipes/prisma) — Integration pattern
- [Drizzle vs Prisma — BetterStack](https://betterstack.com/community/guides/scaling-nodejs/drizzle-vs-prisma/) — Performance and DX tradeoffs
- [MongoDB vs PostgreSQL 2025 — Astera](https://wp.astera.com/knowledge-center/mongodb-vs-postgresql/) — DB comparison for complex relational data
- [PostgreSQL vs MongoDB for Enterprise — Xenoss](https://xenoss.io/blog/postgresql-mongodb-comparison) — RBAC + ACID for enterprise workloads
- [Neon + Vercel Integration](https://vercel.com/marketplace/neon) — Managed Postgres, preview branching
- [Cloudflare R2 vs AWS S3](https://www.digitalapplied.com/blog/cloudflare-r2-vs-aws-s3-comparison) — Egress cost analysis
- [RBAC with Custom Guards in NestJS — OneUptime](https://oneuptime.com/blog/post/2026-01-25-rbac-custom-guards-nestjs/view) — Guard + decorator RBAC pattern (Jan 2026)
- [NestJS + BullMQ + Redis — Medium](https://medium.com/@jaymesonmendes/implementing-background-processes-with-nestjs-bullmq-and-redis-91f119cc8ff8) — Background job processing pattern
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — Current shadcn/ui + Tailwind 4 compatibility
- [Zod v4 — InfoQ](https://www.infoq.com/news/2025/08/zod-v4-available/) — Zod 4 features and performance
- [Next.js 16 Release](https://nextjs.org/blog/next-16) — Next.js 16 features, Turbopack stable
- [Next.js 16.2](https://nextjs.org/blog/next-16-2) — March 2026 release details

---

*Stack research for: Konma Xperience OS — role-based food operations platform*
*Researched: 2026-03-19*
