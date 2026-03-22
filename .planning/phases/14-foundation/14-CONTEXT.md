# Phase 14: Foundation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend API delivers complete CRUD for guide sections and pages with role-based filtering enforced at the service layer and XSS-safe content sanitization. No frontend work in this phase.

Requirements: GUIDE-01, GUIDE-02, GUIDE-03, GUIDE-04, GUIDE-05, EDIT-04

</domain>

<decisions>
## Implementation Decisions

### Section Taxonomy
- **D-01:** Hybrid organization — sections organized by feature area (Kitchen, POS, Inventory, Recipes, etc.), each tagged with which roles can see it via `role_codes String[]`
- **D-02:** Sections have visual metadata — icon (string identifier) and accent color (hex string) chosen by admin when creating/editing
- **D-03:** Sections have a short description (2-3 lines) visible on guide index cards

### Page Content Model
- **D-04:** Content stored as `String @db.Text` (JSON-stringified Tiptap document)
- **D-05:** Pages have full metadata: title, slug (URL-friendly), summary (for search results), estimated_read_time (integer, computed from content word count on save)
- **D-06:** No edit tracking (no updated_by field) — small team, admin-only editing
- **D-07:** Pages have sort_order (integer) and status (draft/published enum)

### Role Assignment
- **D-08:** Role assignment via multi-select checkboxes — admin picks which of the 8 roles can see a section
- **D-09:** New sections have no roles assigned by default (hidden until admin assigns) — safer for draft content
- **D-10:** FOUNDER_ADMIN and TECH_LEAD always bypass role filter — they see all sections including drafts regardless of role_codes mapping

### Guide Access & Routing
- **D-11:** Guide accessible via sidebar nav item "Guide" (all authenticated users) + admin section for content management
- **D-12:** Route structure: `/guide/[section-slug]/[page-slug]` — clean, readable, shareable URLs
- **D-13:** Admin management routes: `/admin/guide/[id]` for editing (UUID-based)

### Content Sanitization
- **D-14:** Server-side sanitization on every save using isomorphic-dompurify — strip `<script>`, `javascript:` hrefs, event handlers
- **D-15:** No client-side sanitization in this phase (deferred to Phase 15 reader view)

### Permission Model
- **D-16:** Single new permission: `MANAGE_GUIDE` added to Permission enum in `types/permissions.ts`
- **D-17:** Read access: any authenticated user (filtered by role_codes on section)
- **D-18:** Write access (CRUD): requires `MANAGE_GUIDE` permission
- **D-19:** Assign `MANAGE_GUIDE` to FOUNDER_ADMIN and TECH_LEAD roles in seed data

### Claude's Discretion
- Exact Prisma model field names and types
- API endpoint design (REST conventions following existing patterns)
- Slug generation strategy (auto from title vs manual)
- Estimated read time calculation formula
- Sanitization allowlist configuration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research
- `.planning/research/SUMMARY.md` — Synthesized research decisions (content storage, Tiptap, sanitization)
- `.planning/research/ARCHITECTURE.md` — Integration architecture, data models, API design
- `.planning/research/PITFALLS.md` — 8 critical pitfalls including XSS CVE, TOAST performance, SSR guards
- `.planning/research/STACK.md` — Tiptap v3 versions, isomorphic-dompurify, jsdom pin

### Existing Patterns
- `backend/src/assets/assets.controller.ts` — Representative NestJS module pattern (REST, permissions, pagination)
- `backend/src/assets/assets.service.ts` — Service pattern (Prisma, creator-ownership, admin bypass)
- `backend/src/storage/storage.service.ts` — Presigned URL generation (reuse for guide images)
- `backend/src/types/permissions.ts` — Permission enum and display metadata (add MANAGE_GUIDE here)
- `backend/prisma/schema.prisma` — Current schema (Role.permissions String[] pattern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StorageService.generatePresignedPutUrl(key, contentType)` — reuse for guide image uploads with `guide/` key prefix
- `StorageService.getPublicUrl(key)` — resolve stored image keys to public URLs
- `@RequiresPermission()` decorator — apply to guide CRUD endpoints with `Permission.MANAGE_GUIDE`
- `ParseUUIDPipe` — existing UUID validation on all ID params

### Established Patterns
- NestJS module structure: `module.ts` → `controller.ts` → `service.ts` + DTOs in `dto/` folder
- Pagination: `take` limited to 100, `skip` from page/limit query params
- Admin bypass: `if (roleCode === 'FOUNDER_ADMIN' || roleCode === 'TECH_LEAD')` for unrestricted access
- DTO validation: class-validator decorators (`@IsString()`, `@IsNotEmpty()`, `@IsOptional()`, `@IsIn()`, `@IsUUID()`)
- No existing JSON fields in Prisma schema — `String @db.Text` follows research recommendation

### Integration Points
- `app.module.ts` — register new `GuidesModule`
- `types/permissions.ts` — add `MANAGE_GUIDE` to Permission enum + display metadata
- `prisma/schema.prisma` — add `GuideSection` and `GuidePage` models
- `prisma/seed.ts` — assign `MANAGE_GUIDE` to FOUNDER_ADMIN and TECH_LEAD roles
- Sidebar navigation — add "Guide" item (Phase 15, not this phase)

</code_context>

<specifics>
## Specific Ideas

- User wants "rich UI, not some static bullshit" — the data model must support visual richness (icons, colors, descriptions on sections)
- Content seeding in Phase 17 means the schema must support all the fields needed for comprehensive walkthroughs from day one
- Guide sections should map to how the app is actually structured (Kitchen, POS, Inventory, Recipes, Missions, Evidence)

</specifics>

<deferred>
## Deferred Ideas

- Frontend guide reader view — Phase 15
- Tiptap editor integration — Phase 16
- Full-text search with tsvector — Phase 17
- Admin preview-as-role — Phase 17
- Content seeding from codebase — Phase 17
- Sidebar "Guide" nav item — Phase 15

</deferred>

---

*Phase: 14-foundation*
*Context gathered: 2026-03-22*
