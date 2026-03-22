# Architecture Research

**Domain:** Admin-editable user guide CMS integrated into NestJS + Next.js + Prisma v6
**Researched:** 2026-03-22
**Confidence:** HIGH

---

## Context: What Already Exists

This is a subsequent milestone. The platform is a fully operational NestJS monolith with:

- **Backend:** NestJS, Prisma v6, PostgreSQL. 35+ modules, each following the same pattern: `module.ts` → `controller.ts` → `service.ts` → Prisma calls. Global guards: `JwtAuthGuard` + `PermissionsGuard` + `ThrottlerGuard` (registered in `app.module.ts` via `APP_GUARD`).
- **Auth/RBAC:** JWT in httpOnly cookie. `user.roleCode` and `user.permissions[]` in JWT payload. `@RequiresPermission(Permission.X)` decorator on controller methods. `PermissionsGuard` reads `getPermissionsForRole(user.roleCode, prisma)` (cached in memory).
- **File uploads:** `StorageService` in `StorageModule` (exported, reusable). Two presign endpoints: `/storage/presign` (evidence, task-scoped) and `/storage/presign-asset` (ops assets). Key pattern: `{folder}/{timestamp}-{sanitized-filename}`. Returns `{ presignedUrl, key, publicUrl }`.
- **Frontend:** Next.js, App Router, `(ops)` route group, Zustand auth store. `useAuthStore` holds `user.roleCode`, `user.permissions[]`, and `hasPermission()`. Sidebar is role-aware. All ops pages live in `frontend/app/(ops)/`.
- **Permissions:** Enum in `backend/src/types/permissions.ts`. Currently 21 values. New permissions are added to the enum, then granted to roles via seed or admin UI.
- **Role codes:** `FOUNDER_ADMIN`, `FRONTEND_LEAD`, `BACKEND_LEAD`, `BI_LEAD`, `PROCUREMENT_LEAD`, `TALENT_LEAD`, `TECH_LEAD`, `DESIGN_LEAD`.

---

## System Overview: Guide Module Integration Points

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS FRONTEND                                │
│                                                                         │
│  (ops)/guide/                      (ops)/admin/guide/                   │
│  ├── page.tsx                      ├── page.tsx (section list)          │
│  │   (role-filtered section list)  ├── sections/new/page.tsx            │
│  └── [sectionSlug]/                ├── sections/[id]/edit/page.tsx      │
│      └── [pageSlug]/page.tsx       ├── sections/[id]/pages/new/         │
│          (rendered guide page)     └── sections/[id]/pages/[pid]/edit/  │
│                                                                         │
│  useAuthStore.roleCode ──────► role-filtered API calls                  │
│  useAuthStore.hasPermission() ► hide admin nav, lock edit UI            │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │ HTTP (apiClient)
┌──────────────────────────────────────▼──────────────────────────────────┐
│                         NESTJS BACKEND                                  │
│                                                                         │
│  GuidesModule                                                           │
│  ├── GuidesController (/guide/sections, /guide/pages)                   │
│  │   ├── GET  /guide/sections         → list sections (role-filtered)   │
│  │   ├── POST /guide/sections         → @RequiresPermission(MANAGE_GUIDE)│
│  │   ├── GET  /guide/sections/:id/pages → pages in section (role-check) │
│  │   ├── GET  /guide/pages/:id        → single page (role-check)        │
│  │   ├── POST /guide/pages            → @RequiresPermission(MANAGE_GUIDE)│
│  │   ├── PATCH /guide/sections/:id    → @RequiresPermission(MANAGE_GUIDE)│
│  │   ├── PATCH /guide/pages/:id       → @RequiresPermission(MANAGE_GUIDE)│
│  │   ├── DELETE /guide/sections/:id   → @RequiresPermission(MANAGE_GUIDE)│
│  │   └── DELETE /guide/pages/:id      → @RequiresPermission(MANAGE_GUIDE)│
│  │                                                                       │
│  └── GuidesService                                                      │
│      ├── Role filtering on read (WHERE role_mappings contains roleCode) │
│      └── FOUNDER_ADMIN + TECH_LEAD bypass role filter (see all)         │
│                                                                         │
│  StorageModule (existing, reused)                                       │
│  └── POST /storage/presign-guide  → new presign endpoint, guide/ prefix │
│                                                                         │
│  PermissionsGuard (existing, global — no changes)                       │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │ Prisma v6
┌──────────────────────────────────────▼──────────────────────────────────┐
│                         POSTGRESQL                                      │
│                                                                         │
│  GuideSection  ──────────────────────────────────────────────           │
│  ├── id, title, slug, description, icon, sort_order                     │
│  ├── role_codes  String[]   (e.g. ["BACKEND_LEAD","FRONTEND_LEAD"])     │
│  ├── published   Boolean    (false = admin-only draft)                  │
│  └── GuidePage[] (one-to-many)                                          │
│                                                                         │
│  GuidePage  ────────────────────────────────────────────────────        │
│  ├── id, section_id (FK), title, slug, sort_order                       │
│  ├── content  Json          (Tiptap/ProseMirror doc JSON)               │
│  ├── published Boolean      (false = admin-only draft)                  │
│  └── updated_at DateTime                                                │
│                                                                         │
│  (No separate GuideRoleMapping join table — role_codes[] on GuideSection│
│   is simpler and matches how Role.permissions[] is already stored.)     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## New Prisma Models

### GuideSection

```prisma
model GuideSection {
  id          String      @id @default(uuid())
  title       String
  slug        String      @unique
  description String?
  icon        String?     // Lucide icon name string, e.g. "ChefHat"
  sort_order  Int         @default(0)
  role_codes  String[]    // role codes that can see this section
  published   Boolean     @default(false)
  created_at  DateTime    @default(now())
  updated_at  DateTime    @updatedAt
  pages       GuidePage[]

  @@index([published])
}
```

### GuidePage

```prisma
model GuidePage {
  id         String       @id @default(uuid())
  section_id String
  section    GuideSection @relation(fields: [section_id], references: [id], onDelete: Cascade)
  title      String
  slug       String
  sort_order Int          @default(0)
  content    Json         // Rich text as Tiptap JSON document
  published  Boolean      @default(false)
  created_at DateTime     @default(now())
  updated_at DateTime     @updatedAt

  @@unique([section_id, slug])
  @@index([section_id, sort_order])
}
```

**Why `role_codes String[]` on GuideSection instead of a join table:**
The existing schema already uses `String[]` for `Role.permissions`. It is consistent with the pattern. A join table (GuideRoleMapping) would be needed if roles themselves were complex entities with metadata per mapping — they are not here. The trade-off is that querying "all sections for a given roleCode" requires a Prisma `has` filter on an array field, which works on PostgreSQL (`@> ARRAY[?]`) but is slightly less portable. Given PostgreSQL is fixed in this stack, array is the right call.

**Why `content Json` instead of `String` (Markdown/HTML):**
Tiptap (the recommended rich text editor — see STACK.md) serialises its editor state as a structured JSON document. Storing JSON in a `Json` column enables partial updates, future serverless rendering without a Markdown parser, and potential server-side content inspection (e.g. extracting image URLs for R2 cleanup). Storing raw HTML is an XSS liability when rendered. Storing Markdown requires a parse step on every render. JSON is the right choice.

---

## Role-Based Content Filtering at the Data Layer

Role filtering is enforced in `GuidesService`, not in the controller or frontend. This prevents accidental data leaks if a new route is added without the filter.

```typescript
// backend/src/guides/guides.service.ts (pattern)

async findSections(roleCode: string): Promise<GuideSection[]> {
  const isAdmin = roleCode === 'FOUNDER_ADMIN' || roleCode === 'TECH_LEAD';

  return this.prisma.guideSection.findMany({
    where: {
      published: isAdmin ? undefined : true,  // admins see unpublished drafts
      ...(isAdmin ? {} : {
        role_codes: { has: roleCode },         // Prisma array filter
      }),
    },
    include: {
      pages: {
        where: { published: isAdmin ? undefined : true },
        orderBy: { sort_order: 'asc' },
        select: { id: true, title: true, slug: true, sort_order: true },
        // Do NOT include content in the section list — fetch only on page open
      },
    },
    orderBy: { sort_order: 'asc' },
  });
}

async findPage(pageId: string, roleCode: string): Promise<GuidePage> {
  const page = await this.prisma.guidePage.findUnique({
    where: { id: pageId },
    include: { section: { select: { role_codes: true, published: true } } },
  });

  if (!page) throw new NotFoundException();

  const isAdmin = roleCode === 'FOUNDER_ADMIN' || roleCode === 'TECH_LEAD';
  const canAccess =
    isAdmin ||
    (page.published && page.section.published &&
     page.section.role_codes.includes(roleCode));

  if (!canAccess) throw new ForbiddenException();
  return page;
}
```

**Key rule:** `FOUNDER_ADMIN` and `TECH_LEAD` see all sections (published and draft) and all role codes. All other roles see only published sections where `role_codes` includes their code.

---

## New Permission

Add one new permission to `backend/src/types/permissions.ts`:

```typescript
MANAGE_GUIDE = 'MANAGE_GUIDE',
```

Grant to: `FOUNDER_ADMIN` (already has all permissions), `TECH_LEAD`.

Read access (GET endpoints) requires only `JwtAuthGuard` — no permission decorator needed because the service-layer role filter handles visibility. Only write operations (POST/PATCH/DELETE) require `@RequiresPermission(Permission.MANAGE_GUIDE)`.

---

## Image Upload: Reusing StorageService

Add a new presign endpoint for guide images. The `StorageService` is already exported from `StorageModule` — import it into `GuidesModule`.

```typescript
// Option A: Add to existing StorageController
@Post('presign-guide')
@RequiresPermission(Permission.MANAGE_GUIDE)
async presignGuide(@Body() dto: PresignGuideDto) {
  this.storageService.validatePresignRequest(dto.contentType, dto.fileSize);
  const key = `guide/${Date.now()}-${dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const presignedUrl = await this.storageService.generatePresignedPutUrl(key, dto.contentType);
  const publicUrl = this.storageService.getPublicUrl(key);
  return { presignedUrl, key, publicUrl };
}
```

`PresignGuideDto`: `filename: string`, `contentType: string` (restrict to `image/jpeg`, `image/png`, `image/webp`), `fileSize: number`. No `taskId` needed — guide images are not task-scoped.

The image URL is embedded inside the Tiptap JSON content as a node attribute. When a guide page is saved, the content JSON already contains the R2 public URL. No separate image-to-page FK table is needed for v1.

---

## API Design

All routes prefixed `/guide`.

| Method | Route | Permission | Description |
|--------|-------|-----------|-------------|
| GET | `/guide/sections` | JWT only | List sections visible to requester's role |
| POST | `/guide/sections` | MANAGE_GUIDE | Create section |
| GET | `/guide/sections/:id` | JWT only | Get section + page list (no content) |
| PATCH | `/guide/sections/:id` | MANAGE_GUIDE | Update section metadata / role_codes |
| DELETE | `/guide/sections/:id` | MANAGE_GUIDE | Delete section (cascades pages) |
| GET | `/guide/pages/:id` | JWT only | Get single page with full content JSON |
| POST | `/guide/pages` | MANAGE_GUIDE | Create page inside a section |
| PATCH | `/guide/pages/:id` | MANAGE_GUIDE | Update page content / metadata |
| DELETE | `/guide/pages/:id` | MANAGE_GUIDE | Delete page |
| POST | `/storage/presign-guide` | MANAGE_GUIDE | Get presigned URL for guide image upload |

Note: No slug-based routing in the API. The frontend resolves slugs to IDs on the section list response, then fetches by ID. This avoids encoding slug-based DB queries with composite keys.

---

## Frontend Routing

```
frontend/app/(ops)/
├── guide/
│   ├── page.tsx                        # Section index (role-filtered)
│   └── [sectionId]/
│       └── [pageId]/
│           └── page.tsx                # Read view: renders Tiptap JSON → HTML
│
├── admin/
│   └── guide/
│       ├── page.tsx                    # Admin section list + publish toggles
│       ├── sections/
│       │   ├── new/page.tsx            # Create section form
│       │   └── [sectionId]/
│       │       ├── edit/page.tsx       # Edit section metadata + role mapping
│       │       └── pages/
│       │           ├── new/page.tsx    # Create page + Tiptap editor
│       │           └── [pageId]/
│       │               └── edit/page.tsx  # Edit page + Tiptap editor
```

Admin routes under `(ops)/admin/guide/` follow the existing pattern (see `admin/users`, `admin/permissions`). The `hasPermission('MANAGE_GUIDE')` check from `useAuthStore` hides the admin nav item for non-admin roles.

---

## Component Boundaries

| Component | Location | Responsibility |
|-----------|----------|---------------|
| `GuideSectionCard` | `components/ops/guide/GuideSectionCard.tsx` | Section card on index page, links to first page |
| `GuidePageNav` | `components/ops/guide/GuidePageNav.tsx` | Left sidebar or top nav showing pages in current section |
| `GuidePageRenderer` | `components/ops/guide/GuidePageRenderer.tsx` | Renders Tiptap JSON to HTML using `@tiptap/react` `generateHTML()` — no editor, read-only |
| `GuideEditor` | `components/ops/guide/GuideEditor.tsx` | Tiptap editor instance, image upload integration, save/publish controls. Admin-only. |
| `GuideSectionForm` | `components/ops/guide/GuideSectionForm.tsx` | Create/edit section metadata + role code checkboxes |
| `GuideRoleSelector` | `components/ops/guide/GuideRoleSelector.tsx` | Multi-select of all 8 role codes for a section's visibility |

---

## Data Flow

### Admin: Create a Guide Page with Images

```
Admin opens editor page
    ↓
GuideEditor mounts Tiptap instance
    ↓
Admin inserts image → POST /storage/presign-guide
    ↓
Frontend receives { presignedUrl, publicUrl }
    ↓
Browser PUTs file directly to R2 via presignedUrl
    ↓
Tiptap inserts image node with src = publicUrl
    ↓
Admin clicks Save → PATCH /guide/pages/:id
    Body: { content: <tiptap-json>, title, published }
    ↓
GuidesService writes content Json to DB
    ↓
Admin clicks Publish → PATCH /guide/pages/:id { published: true }
    + PATCH /guide/sections/:id { published: true }
```

### Staff: Read a Guide Page

```
Staff navigates to /guide
    ↓
GET /guide/sections (JWT in cookie, backend filters by roleCode)
    ↓
Sections list rendered as cards
    ↓
Staff clicks section → page list from section.pages[]
    ↓
Staff clicks page → GET /guide/pages/:id
    Backend re-validates roleCode has access (defense-in-depth)
    ↓
GuidePageRenderer calls generateHTML(content) from @tiptap/react
    ↓
Styled article rendered
```

---

## New vs Modified: Explicit List

### New (create from scratch)

| Artifact | Type | Location |
|----------|------|----------|
| `GuideSection` model | Prisma schema | `backend/prisma/schema.prisma` |
| `GuidePage` model | Prisma schema | `backend/prisma/schema.prisma` |
| `MANAGE_GUIDE` permission | Enum entry | `backend/src/types/permissions.ts` |
| `GuidesModule` | NestJS module | `backend/src/guides/guides.module.ts` |
| `GuidesController` | NestJS controller | `backend/src/guides/guides.controller.ts` |
| `GuidesService` | NestJS service | `backend/src/guides/guides.service.ts` |
| `CreateSectionDto` | DTO | `backend/src/guides/dto/create-section.dto.ts` |
| `UpdateSectionDto` | DTO | `backend/src/guides/dto/update-section.dto.ts` |
| `CreatePageDto` | DTO | `backend/src/guides/dto/create-page.dto.ts` |
| `UpdatePageDto` | DTO | `backend/src/guides/dto/update-page.dto.ts` |
| `PresignGuideDto` | DTO | `backend/src/storage/dto/presign-guide.dto.ts` |
| Prisma migration | SQL migration | `backend/prisma/migrations/` |
| `GuideSectionCard` | React component | `frontend/components/ops/guide/` |
| `GuidePageNav` | React component | `frontend/components/ops/guide/` |
| `GuidePageRenderer` | React component | `frontend/components/ops/guide/` |
| `GuideEditor` | React component | `frontend/components/ops/guide/` |
| `GuideSectionForm` | React component | `frontend/components/ops/guide/` |
| `GuideRoleSelector` | React component | `frontend/components/ops/guide/` |
| `/guide/` routes | Next.js pages | `frontend/app/(ops)/guide/` |
| `/admin/guide/` routes | Next.js pages | `frontend/app/(ops)/admin/guide/` |

### Modified (extend existing)

| Artifact | Change |
|----------|--------|
| `backend/src/types/permissions.ts` | Add `MANAGE_GUIDE` to enum and display/description maps |
| `backend/src/storage/storage.controller.ts` | Add `presign-guide` endpoint |
| `backend/src/storage/dto/` | Add `PresignGuideDto` |
| `backend/src/app.module.ts` | Add `GuidesModule` to imports array |
| `backend/prisma/schema.prisma` | Add `GuideSection`, `GuidePage` models |
| `backend/prisma/seed.ts` | Grant `MANAGE_GUIDE` to `TECH_LEAD` role seed |
| `frontend/components/ops/Sidebar.tsx` | Add "Guide" nav item (visible to all roles); add "Guide Admin" under admin section (gated by `hasPermission('MANAGE_GUIDE')`) |
| `frontend/package.json` | Add `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link` |
| `backend/package.json` | No new deps required (Prisma `Json` type is native) |

---

## Suggested Build Order

Dependencies flow: schema → backend CRUD → presign endpoint → frontend read views → frontend editor. Do not start the editor before the backend is serving content — the editor needs a real save target.

**Step 1 — Schema + Migration (backend blocker for everything)**
- Add `GuideSection` and `GuidePage` to `schema.prisma`
- Run `prisma migrate dev`
- Add `MANAGE_GUIDE` to permissions enum
- Update seed: grant to `TECH_LEAD`

**Step 2 — Backend CRUD (enables frontend to fetch real data)**
- Create `GuidesModule`, `GuidesController`, `GuidesService`
- Implement all 9 API routes with role filter logic
- Add `presign-guide` to `StorageController`
- Register `GuidesModule` in `app.module.ts`
- Test with seed data (manually create one section + page via SQL or seed function)

**Step 3 — Frontend Read Views (validates backend + establishes UI shell)**
- Scaffold `/guide/page.tsx` — section index, calls `GET /guide/sections`
- Scaffold `/guide/[sectionId]/[pageId]/page.tsx` — page read view with `GuidePageRenderer`
- Add "Guide" to Sidebar nav
- Validate role filtering works end-to-end (log in as different roles, confirm visibility)

**Step 4 — Admin CMS (depends on step 2 + 3 working)**
- Scaffold `/admin/guide/` route tree
- Build `GuideSectionForm` (create/edit section, role selector)
- Build `GuideEditor` with Tiptap and image upload integration
- Wire save/publish/delete flows
- Add "Guide Admin" to Sidebar admin section (permission-gated)

**Step 5 — Polish + Seed Content**
- Write initial guide content for each role via admin CMS
- Add sort reordering (drag or up/down arrows on section/page lists)
- Add loading skeletons to read views

---

## Scaling Considerations

| Scale | Architecture Notes |
|-------|--------------------|
| 8 internal users (current) | No caching needed. Direct DB reads per request are fine. |
| 50+ users | Cache `GET /guide/sections` response per roleCode (5 min TTL in memory or Redis). Content changes are infrequent so stale reads are acceptable. |
| Content-heavy (100+ pages) | Add full-text search via `pg_trgm` on `GuidePage.title` + JSON content extraction, or a separate search index. Not needed for v1. |

---

## Anti-Patterns

### Anti-Pattern 1: Role Filtering Only in the Frontend

**What people do:** Fetch all sections from the API, then filter in the React component using `roleCode` from `useAuthStore`.

**Why it's wrong:** Any user can call the API directly with a valid JWT and retrieve guide content for roles other than their own. Frontend filtering is UX, not security.

**Do this instead:** Filter at the service layer (`GuidesService.findSections(roleCode)`). The API never returns sections the caller cannot access. Frontend filtering is a redundant UX enhancement, not the security gate.

### Anti-Pattern 2: Storing Tiptap HTML Instead of JSON

**What people do:** Call `editor.getHTML()` and store the string in a `TEXT` column, then `dangerouslySetInnerHTML` it on render.

**Why it's wrong:** XSS vector — if the stored HTML is ever compromised or injected via a bug, it executes in users' browsers. HTML is also not diffable, making future migrations harder.

**Do this instead:** Store `editor.getJSON()` in a `Json` column. On render, call `generateHTML(content, extensions)` server-side or in a React component. This keeps the HTML generation controlled and allows sanitization.

### Anti-Pattern 3: One Giant GuideSection With All Content

**What people do:** Create one `GuideSection` per feature area but put all 20+ steps as a wall of Tiptap content in a single `GuidePage`.

**Why it's wrong:** Pages become unnavigable. Users cannot link to a specific step. Editing long content in Tiptap is error-prone (accidental deletes affect large blocks).

**Do this instead:** Each workflow step or logical topic is its own `GuidePage` within the section. `sort_order` controls sequence. Navigation between pages is fast (GET by ID, not a content re-parse).

### Anti-Pattern 4: New GuideRoleMapping Join Table When String[] Suffices

**What people do:** Design a `GuideRoleMapping` join table with `section_id` and `role_id` FKs, mirroring a many-to-many relationship.

**Why it's wrong:** For 8 fixed roles that are referenced by code string throughout the codebase (see `Role.permissions String[]`, `user.roleCode`, `PermissionsGuard`), a join table adds two extra queries per section read and a migration complexity for no benefit over `String[]`. The join table pattern is needed when role records themselves carry metadata per section (e.g. per-role view counts) — this system has no such requirement.

**Do this instead:** `role_codes String[]` on `GuideSection`. Prisma `has` filter on PostgreSQL is a single index-able GIN query. Consistent with how `Role.permissions` is already stored.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `GuidesModule` ↔ `PrismaModule` | Direct DI injection (same pattern as all 35 existing modules) | `PrismaModule` is global; no explicit import needed in `GuidesModule` |
| `GuidesModule` ↔ `StorageModule` | `StorageModule` exports `StorageService`. Add `StorageModule` to `GuidesModule` imports if needed, or add presign endpoint to `StorageController` directly (recommended — avoids cross-module controller coupling) |
| `GuidesController` ↔ `PermissionsGuard` | Guard is global (registered via `APP_GUARD`). Apply `@RequiresPermission(Permission.MANAGE_GUIDE)` on write methods. Read methods need no decorator — JWT guard alone is sufficient. |
| Frontend `useAuthStore` ↔ backend role filter | `roleCode` is already in the JWT payload and in `useAuthStore`. API calls carry JWT cookie automatically (credentials: 'include'). Backend extracts `user.roleCode` from `req.user` (populated by `JwtAuthGuard`). |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Cloudflare R2 | Reuse existing `StorageService.generatePresignedPutUrl()`. Add `guide/` key prefix. | No R2 config changes. Just a new endpoint and key prefix. |
| Tiptap (npm package) | Client-side editor and server-side `generateHTML()`. No external API. | `@tiptap/react` ~200KB gzipped. Acceptable. |

---

## Sources

- Prisma v6 `Json` field type: [Prisma Docs — Json fields](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields) — storing structured content in PostgreSQL `jsonb` (HIGH confidence, first-party)
- Prisma v6 array filters (`has`, `hasSome`): [Prisma Docs — Filtering on scalar lists](https://www.prisma.io/docs/orm/reference/prisma-client-reference#scalar-list-filters) — `role_codes: { has: roleCode }` (HIGH confidence, first-party)
- Tiptap JSON storage pattern: [Tiptap Docs — Working with JSON](https://tiptap.dev/docs/editor/api/editor) — `editor.getJSON()` / `generateHTML()` (HIGH confidence, first-party)
- NestJS module pattern: existing codebase — `backend/src/assets/` module as direct reference for new `guides/` module structure (HIGH confidence, first-party)
- StorageService reuse: `backend/src/storage/storage.service.ts` — `generatePresignedPutUrl()` is general-purpose, key prefix is the only caller-specific parameter (HIGH confidence, first-party)

---

*Architecture research for: Konma Xperience OS — user guide CMS integration (v1.1 milestone)*
*Researched: 2026-03-22*
