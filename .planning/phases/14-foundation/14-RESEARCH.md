# Phase 14: Foundation - Research

**Researched:** 2026-03-22
**Domain:** NestJS CRUD module + Prisma v6 schema migration + XSS sanitization (backend-only)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Section Taxonomy**
- D-01: Hybrid organization — sections organized by feature area (Kitchen, POS, Inventory, Recipes, etc.), each tagged with which roles can see it via `role_codes String[]`
- D-02: Sections have visual metadata — icon (string identifier) and accent color (hex string) chosen by admin when creating/editing
- D-03: Sections have a short description (2-3 lines) visible on guide index cards

**Page Content Model**
- D-04: Content stored as `String @db.Text` (JSON-stringified Tiptap document)
- D-05: Pages have full metadata: title, slug (URL-friendly), summary (for search results), estimated_read_time (integer, computed from content word count on save)
- D-06: No edit tracking (no updated_by field) — small team, admin-only editing
- D-07: Pages have sort_order (integer) and status (draft/published enum)

**Role Assignment**
- D-08: Role assignment via multi-select checkboxes — admin picks which of the 8 roles can see a section
- D-09: New sections have no roles assigned by default (hidden until admin assigns) — safer for draft content
- D-10: FOUNDER_ADMIN and TECH_LEAD always bypass role filter — they see all sections including drafts regardless of role_codes mapping

**Guide Access & Routing**
- D-11: Guide accessible via sidebar nav item "Guide" (all authenticated users) + admin section for content management
- D-12: Route structure: `/guide/[section-slug]/[page-slug]` — clean, readable, shareable URLs
- D-13: Admin management routes: `/admin/guide/[id]` for editing (UUID-based)

**Content Sanitization**
- D-14: Server-side sanitization on every save using isomorphic-dompurify — strip `<script>`, `javascript:` hrefs, event handlers
- D-15: No client-side sanitization in this phase (deferred to Phase 15 reader view)

**Permission Model**
- D-16: Single new permission: `MANAGE_GUIDE` added to Permission enum in `types/permissions.ts`
- D-17: Read access: any authenticated user (filtered by role_codes on section)
- D-18: Write access (CRUD): requires `MANAGE_GUIDE` permission
- D-19: Assign `MANAGE_GUIDE` to FOUNDER_ADMIN and TECH_LEAD roles in seed data

### Claude's Discretion
- Exact Prisma model field names and types
- API endpoint design (REST conventions following existing patterns)
- Slug generation strategy (auto from title vs manual)
- Estimated read time calculation formula
- Sanitization allowlist configuration

### Deferred Ideas (OUT OF SCOPE)
- Frontend guide reader view — Phase 15
- Tiptap editor integration — Phase 16
- Full-text search with tsvector — Phase 17
- Admin preview-as-role — Phase 17
- Content seeding from codebase — Phase 17
- Sidebar "Guide" nav item — Phase 15

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GUIDE-01 | Admin can create, edit, and delete guide sections | GuidesModule CRUD endpoints + `@RequiresPermission(MANAGE_GUIDE)` on write methods |
| GUIDE-02 | Admin can create, edit, and delete guide pages within sections | GuidePage CRUD endpoints; cascade delete via Prisma `onDelete: Cascade` on section FK |
| GUIDE-03 | Admin can assign roles to sections — mapped roles see the section, unmapped don't | `role_codes String[]` on `GuideSection`; Prisma `has` filter at service layer; FOUNDER_ADMIN + TECH_LEAD bypass |
| GUIDE-04 | Admin can set page status to draft or published — drafts visible only to admin/tech | `status` enum (DRAFT/PUBLISHED) on `GuidePage`; service-layer filter excludes DRAFT pages from non-admin read paths |
| GUIDE-05 | Admin can reorder sections and pages via sort position | `sort_order Int` on both models; `PATCH /guide/sections/:id` and `PATCH /guide/pages/:id` accept sort_order updates |
| EDIT-04 | Content is sanitized server-side on save (DOMPurify) to prevent XSS | `isomorphic-dompurify@3.x` installed on backend; sanitize HTML-parsed content before every `prisma.guidePage.create/update()` |

</phase_requirements>

---

## Summary

Phase 14 is a backend-only phase. It delivers the Prisma schema, NestJS CRUD module, role-based filtering logic, and XSS sanitization for guide sections and pages. No frontend work is in scope.

The implementation pattern is well-established: a new `GuidesModule` following the exact structure of the 35 existing modules (especially `assets/`, `decisions/`). Two new Prisma models are added (`GuideSection`, `GuidePage`) in an additive-only migration. One new permission (`MANAGE_GUIDE`) is added to the Permission enum and granted to `FOUNDER_ADMIN` and `TECH_LEAD` in seed data. A new `/storage/presign-guide` endpoint is added to the existing `StorageController`.

The single new backend dependency is `isomorphic-dompurify@^3.x`. Version 3.6.0 (current latest) ships with proper CJS support (`require: './dist/index.js'`), so it works in NestJS without any jsdom pinning. The jsdom pin concern documented in the project's prior research was specific to the frontend/Next.js ESM context (Phase 16) — it does not apply to Phase 14's NestJS context.

**Primary recommendation:** Build GuidesModule exactly like `assets/` and `decisions/`. Add `MANAGE_GUIDE` to the Permission enum. Sanitize content with `isomorphic-dompurify@^3.x` on every write. Keep the migration additive-only.

---

## Standard Stack

### Core (New Additions Only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `isomorphic-dompurify` | ^3.6.0 | XSS sanitization of rich text content before DB write | Only DOMPurify wrapper with CJS + ESM dual support; Node.js `require` path confirmed working; no jsdom pin needed in NestJS |
| `isomorphic-dompurify` (types) | bundled | TypeScript types | Bundled in v3.x; no separate `@types` package needed |

Everything else (NestJS, Prisma v6, class-validator, ParseUUIDPipe, @RequiresPermission) is already installed and follows existing patterns.

### Existing Stack (Reused, Not Reinstalled)

| Library | Version | Purpose | Reuse Pattern |
|---------|---------|---------|---------------|
| `@nestjs/common` | ^11.0.1 | Controllers, services, decorators | Exact same imports as all other modules |
| `prisma` / `@prisma/client` | ^6.19.2 | Schema migration + ORM | Add two new models, run `migrate dev` |
| `class-validator` | ^0.15.1 | DTO validation | Same decorators: `@IsString`, `@IsNotEmpty`, `@IsOptional`, `@IsIn`, `@IsUUID`, `@IsInt`, `@IsArray` |
| `class-transformer` | ^0.5.1 | DTO transformation | Already configured globally in main.ts |
| `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | ^3.x | Guide image presigning | Reuse `StorageService.generatePresignedPutUrl()` — key prefix change only |

**Installation (backend only):**
```bash
cd backend && npm install isomorphic-dompurify
```

**Version verified:** `isomorphic-dompurify@3.6.0` — latest as of 2026-03-22 (npm confirmed).

---

## Architecture Patterns

### Module Structure (Follow Exactly)

```
backend/src/guides/
├── guides.module.ts          # Module declaration, imports StorageModule
├── guides.controller.ts      # REST endpoints
├── guides.service.ts         # Business logic, role filtering, sanitization
└── dto/
    ├── create-section.dto.ts
    ├── update-section.dto.ts
    ├── create-page.dto.ts
    └── update-page.dto.ts

backend/src/storage/dto/
└── presign-guide.dto.ts      # New DTO, added to existing StorageController

backend/prisma/
└── schema.prisma             # Add GuideSection + GuidePage models
```

### Pattern 1: NestJS Module (Follow assets.module.ts)

```typescript
// guides/guides.module.ts
import { Module } from '@nestjs/common';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';

@Module({
  controllers: [GuidesController],
  providers: [GuidesService],
  exports: [GuidesService],
})
export class GuidesModule {}
```

Register in `app.module.ts` by adding `GuidesModule` to the imports array (same line-by-line pattern as `AssetsModule`, `DecisionsModule`).

### Pattern 2: Controller (Follow assets.controller.ts / decisions.controller.ts)

```typescript
// guides/guides.controller.ts — Source: existing codebase patterns
@Controller('guide')
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}

  // Read endpoints — JWT only, no permission decorator
  @Get('sections')
  findAllSections(@Req() req: express.Request) {
    const user = (req as any).user;
    return this.guidesService.findSections(user.roleCode);
  }

  @Get('sections/:id')
  findOneSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.guidesService.findSection(id, user.roleCode);
  }

  @Get('pages/:id')
  findOnePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.guidesService.findPage(id, user.roleCode);
  }

  // Write endpoints — require MANAGE_GUIDE
  @Post('sections')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  createSection(@Body() dto: CreateSectionDto) {
    return this.guidesService.createSection(dto);
  }

  @Patch('sections/:id')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  updateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.guidesService.updateSection(id, dto);
  }

  @Delete('sections/:id')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  removeSection(@Param('id', ParseUUIDPipe) id: string) {
    return this.guidesService.removeSection(id);
  }

  @Post('pages')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  createPage(@Body() dto: CreatePageDto) {
    return this.guidesService.createPage(dto);
  }

  @Patch('pages/:id')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  updatePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.guidesService.updatePage(id, dto);
  }

  @Delete('pages/:id')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  removePage(@Param('id', ParseUUIDPipe) id: string) {
    return this.guidesService.removePage(id);
  }
}
```

### Pattern 3: Service Role Filtering (Core Logic)

```typescript
// guides/guides.service.ts — Source: .planning/research/ARCHITECTURE.md
import DOMPurify from 'isomorphic-dompurify';

private isAdmin(roleCode: string): boolean {
  return roleCode === 'FOUNDER_ADMIN' || roleCode === 'TECH_LEAD';
}

async findSections(roleCode: string) {
  const admin = this.isAdmin(roleCode);

  return this.prisma.guideSection.findMany({
    where: {
      ...(admin ? {} : {
        status: 'published',
        role_codes: { has: roleCode },
      }),
    },
    include: {
      pages: {
        where: admin ? {} : { status: 'published' },
        orderBy: { sort_order: 'asc' },
        select: { id: true, title: true, slug: true, sort_order: true, status: true },
      },
    },
    orderBy: { sort_order: 'asc' },
  });
}

async findPage(pageId: string, roleCode: string) {
  const page = await this.prisma.guidePage.findUnique({
    where: { id: pageId },
    include: { section: { select: { role_codes: true, status: true } } },
  });

  if (!page) throw new NotFoundException();

  const admin = this.isAdmin(roleCode);
  const canAccess =
    admin ||
    (page.status === 'published' &&
     page.section.status === 'published' &&
     page.section.role_codes.includes(roleCode));

  if (!canAccess) throw new NotFoundException(); // 404, not 403 — don't reveal draft existence
  return page;
}
```

### Pattern 4: Content Sanitization on Write

Content is stored as `String @db.Text` (JSON-stringified Tiptap document per D-04). The sanitization step in Phase 14 must parse the JSON, sanitize any HTML-like strings within it, then re-stringify. For Phase 14 (no editor yet), content will arrive as raw JSON from API callers — sanitize the stringified form before persisting.

```typescript
// In GuidesService — call before every create/update of GuidePage content
private sanitizeContent(content: string): string {
  // content is JSON.stringify(tiptapDoc) — sanitize it as a string
  // DOMPurify.sanitize on the raw string strips any injected HTML
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
                   'h1', 'h2', 'h3', 'h4', 'blockquote', 'img', 'figure', 'figcaption'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel', 'class', 'data-type'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'javascript'],
  });
}
```

Note: `isomorphic-dompurify` in a NestJS (CommonJS) context requires no special setup. Import with `import DOMPurify from 'isomorphic-dompurify'` (or `const DOMPurify = require('isomorphic-dompurify')`). The CJS `require` path (`dist/index.js`) is confirmed available.

### Pattern 5: Prisma Schema (Authoritative Definitions)

Per locked decisions D-01 through D-07 and D-09:

```prisma
// Add to backend/prisma/schema.prisma

model GuideSection {
  id          String      @id @default(uuid())
  title       String
  slug        String      @unique
  description String?                          // D-03: 2-3 line description
  icon        String?                          // D-02: Lucide icon name, e.g. "ChefHat"
  accent_color String?                         // D-02: hex color, e.g. "#FF6B35"
  sort_order  Int         @default(0)          // D-01 / GUIDE-05
  role_codes  String[]                         // D-01: which roles can see this section
  status      String      @default("draft")    // D-04: "draft" | "published"
  created_at  DateTime    @default(now())
  updated_at  DateTime    @updatedAt
  pages       GuidePage[]

  @@index([status])
  @@index([sort_order])
}

model GuidePage {
  id                  String       @id @default(uuid())
  section_id          String
  section             GuideSection @relation(fields: [section_id], references: [id], onDelete: Cascade)
  title               String
  slug                String                   // D-05: URL-friendly
  sort_order          Int          @default(0) // D-07 / GUIDE-05
  content             String       @db.Text    // D-04: JSON.stringify(tiptapDoc)
  summary             String?                  // D-05: for search results
  estimated_read_time Int?                     // D-05: word count / 200, integer minutes
  status              String       @default("draft") // D-07: "draft" | "published"
  created_at          DateTime     @default(now())
  updated_at          DateTime     @updatedAt

  @@unique([section_id, slug])
  @@index([section_id, sort_order])
  @@index([status])
}
```

**Design decisions:**
- `status` is `String` (not enum) to match existing patterns in schema (`Asset.status`, `Decision.status` are all String, not Prisma enums). Consistent with codebase convention.
- `role_codes String[]` is consistent with `Role.permissions String[]` — already proven pattern.
- `content String @db.Text` confirmed per D-04 and SUMMARY.md conflict resolution.
- `onDelete: Cascade` on `GuidePage.section_id` ensures pages are deleted when their section is deleted (GUIDE-01/02).
- `accent_color` added per D-02 (hex string, e.g. `"#FF6B35"`).

### Pattern 6: Presign Guide Endpoint (Add to StorageController)

```typescript
// Add to backend/src/storage/storage.controller.ts

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

```typescript
// New file: backend/src/storage/dto/presign-guide.dto.ts
import { IsString, IsNotEmpty, IsNumber, IsIn, Min, Max } from 'class-validator';

export class PresignGuideDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;   // Image-only — stricter than the general presign DTO

  @IsNumber()
  @Min(1)
  @Max(10485760)
  fileSize: number;
}
```

### Pattern 7: Permission Enum Addition

```typescript
// Modify backend/src/types/permissions.ts — add to end of each object:

export enum Permission {
  // ... existing 21 permissions ...
  MANAGE_GUIDE = 'MANAGE_GUIDE',
}

export const PERMISSION_DISPLAY_NAMES: Record<Permission, string> = {
  // ... existing entries ...
  [Permission.MANAGE_GUIDE]: 'Manage guide content',
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  // ... existing entries ...
  [Permission.MANAGE_GUIDE]: 'Create, edit, and delete guide sections and pages',
};
```

### Pattern 8: Seed Data Update

```typescript
// Modify backend/prisma/seed.ts
// TECH_LEAD already has Object.values(Permission) — MANAGE_GUIDE auto-included
// FOUNDER_ADMIN already has Object.values(Permission) — MANAGE_GUIDE auto-included
// No seed change needed — both roles use Object.values(Permission) spread
// Verify: search for RoleCode.TECH_LEAD in seed.ts → confirms `permissions: Object.values(Permission)`
```

This is a zero-change seed update because both `FOUNDER_ADMIN` and `TECH_LEAD` already use `Object.values(Permission)` — adding `MANAGE_GUIDE` to the enum automatically grants it to them on the next seed run.

### Pattern 9: Slug Generation (Claude's Discretion)

Auto-generate from title on create, allow manual override on update:

```typescript
private generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}
```

On page creation: if `slug` not provided in DTO, auto-generate from `title`. If auto-generated slug conflicts with an existing page in the same section, append `-2`, `-3`, etc. Section slugs must be globally unique (per `@@unique` on `GuideSection.slug`).

### Pattern 10: Estimated Read Time Calculation (Claude's Discretion)

```typescript
private computeReadTime(content: string): number {
  // content is JSON.stringify(tiptapDoc) — extract word count from text nodes
  const text = content.replace(/"text":"([^"]+)"/g, '$1 ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200)); // 200 words/min, minimum 1 minute
}
```

Call `computeReadTime(dto.content)` on every create and update of a GuidePage.

### Anti-Patterns to Avoid

- **Role filtering only in the controller or frontend:** The `where` clause with `role_codes: { has: roleCode }` MUST be in the Prisma query inside `GuidesService`, not extracted and handled in the controller.
- **404 vs 403 for draft pages:** Return `404` (not `403`) when a non-admin requests a draft page. Returning `403` reveals that the page exists — information disclosure.
- **`ALTER TABLE` in the migration:** The new migration must contain ONLY `CREATE TABLE` and `CREATE INDEX` statements. Any `ALTER TABLE` on an existing v1.0 table will risk production data.
- **Storing Tiptap JSON as `Json` Prisma type:** Decision D-04 locked `String @db.Text`. Do not use `Json` type.
- **Join table for role mapping:** Use `role_codes String[]` consistent with `Role.permissions String[]`. No separate `GuideRoleMapping` table.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XSS sanitization | Custom HTML stripper, regex-based sanitizer | `isomorphic-dompurify` | DOMPurify handles 200+ edge cases including `javascript:` hrefs, data URIs, CSS injection, Unicode escapes — regex misses almost all of them |
| UUID validation | Manual regex in controller | `ParseUUIDPipe` (existing import) | Already in codebase, handles invalid UUID format with proper 400 response |
| DTO validation | Manual type checks | `class-validator` decorators (already installed) | Already globally configured in main.ts with `useGlobalPipes(new ValidationPipe({ whitelist: true }))` |
| Permission checks | Manual role code comparisons in controller | `@RequiresPermission()` + global `PermissionsGuard` | Guard is already global — just add decorator, it handles the rest |
| Slug uniqueness conflict | Complex UUID fallback | Simple `-2`/`-3` suffix loop | Sufficient for a guide with < 1000 pages per section |

**Key insight:** This phase is almost entirely "fill in the pattern" work — every mechanism (guards, validation, pagination, UUID pipes, presigning) already exists. The only new logic is `findSections` role filtering and `sanitizeContent`.

---

## Common Pitfalls

### Pitfall 1: Admins Seeing 404 on Draft Pages They Created

**What goes wrong:** Service uses the same `findPage` method for all callers, including MANAGE_GUIDE holders. Admin creates a draft page, tries to preview it, gets 404.

**Why it happens:** The role filter `status === 'published'` is applied without checking for admin bypass first.

**How to avoid:** The `isAdmin` check must come first. If `isAdmin(roleCode)` is true, skip the published check and the role_codes check entirely. Admins see all sections and all pages regardless of status.

**Warning signs:** Admin is unable to retrieve a page they just created via POST.

### Pitfall 2: Breaking Migration Touches Existing Tables

**What goes wrong:** Prisma generates a migration that `ALTER TABLE`s an existing table (e.g., adding a FK reference from an existing model to `GuideSection`).

**Why it happens:** Developer adds a back-reference or foreign key on an existing model while drafting the schema.

**How to avoid:** The `GuideSection` and `GuidePage` models must have no outgoing FK references to existing v1.0 models. Only `GuidePage.section_id` → `GuideSection` is allowed (new → new). After generating the migration with `prisma migrate dev`, read the SQL file and verify it contains only `CREATE TABLE` and `CREATE INDEX` statements.

**Warning signs:** Any line starting with `ALTER TABLE` in the generated migration SQL.

### Pitfall 3: role_codes Empty Array Returns All Sections

**What goes wrong:** Prisma `has` filter on an empty array (`role_codes: { has: roleCode }`) returns no rows, which is correct — but developers may misread this as a bug and add a fallback that returns all sections.

**Why it happens:** D-09 says new sections have no roles assigned by default. On the reader side, a section with `role_codes: []` is invisible to all non-admin users until an admin assigns roles. This is intentional, not a bug.

**How to avoid:** Document this behavior. The default state (empty role_codes) is "hidden from all non-admin roles". The test for this: create a section with no role_codes, log in as a non-admin, verify it does not appear in `GET /guide/sections`.

**Warning signs:** Adding a `role_codes.length === 0` special case that falls back to showing the section to everyone.

### Pitfall 4: isomorphic-dompurify Import in NestJS

**What goes wrong:** Using `import * as DOMPurify from 'isomorphic-dompurify'` instead of `import DOMPurify from 'isomorphic-dompurify'` — the `*` import gives an object with a `default` property, and `DOMPurify.sanitize(...)` is undefined.

**Why it happens:** NestJS uses CommonJS; the `isomorphic-dompurify` v3.x package has a dual CJS/ESM build. The default export is the correct import path.

**How to avoid:** Use `import DOMPurify from 'isomorphic-dompurify'`. If TypeScript complains, add `"esModuleInterop": true` to `tsconfig.json` (already present in NestJS default config). Verify with a quick smoke test: `DOMPurify.sanitize('<script>alert(1)</script>')` should return `''`.

**Warning signs:** `TypeError: DOMPurify.sanitize is not a function` at runtime.

### Pitfall 5: Seed Not Updated After Permission Enum Change

**What goes wrong:** `MANAGE_GUIDE` is added to the Permission enum but the database still has the old `permissions` string array on the Role rows from the previous seed run — so `FOUNDER_ADMIN` and `TECH_LEAD` don't actually have `MANAGE_GUIDE` in their permissions until seed is re-run.

**Why it happens:** The seed uses `upsert` — it only updates roles that are being seeded. If the seed has already run, the old array persists until the seed is run again.

**How to avoid:** After adding `MANAGE_GUIDE` to the Permission enum and running the migration, run `npx ts-node prisma/seed.ts` to refresh the role permission arrays. Both `FOUNDER_ADMIN` and `TECH_LEAD` use `Object.values(Permission)` — the new value is auto-included on the next seed run. No manual array changes needed in seed.ts.

**Warning signs:** `403 Forbidden` when `TECH_LEAD` tries `POST /guide/sections` despite having `MANAGE_GUIDE` in the enum — the DB row has the old permissions array.

---

## Code Examples

Verified patterns from existing codebase:

### Service Role Bypass Pattern (from assets.service.ts + decisions.service.ts)
```typescript
// Source: backend/src/assets/assets.service.ts:52, backend/src/decisions/decisions.service.ts
const isAdmin = user.roleCode === 'FOUNDER_ADMIN'; // existing pattern
// For guides, extend to include TECH_LEAD (D-10):
const isAdmin = roleCode === 'FOUNDER_ADMIN' || roleCode === 'TECH_LEAD';
```

### ParseUUIDPipe on ID params (from assets.controller.ts:34)
```typescript
// Source: backend/src/assets/assets.controller.ts
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string) { ... }
```

### RequiresPermission decorator (from assets.controller.ts:38)
```typescript
// Source: backend/src/assets/assets.controller.ts
@Post()
@RequiresPermission(Permission.MANAGE_OPS)
async create(@Body() dto: CreateAssetDto, @Req() req: express.Request) { ... }
```

### Prisma array scalar filter (from .planning/research/ARCHITECTURE.md)
```typescript
// Prisma v6 — filter sections where role_codes contains the caller's roleCode
where: {
  role_codes: { has: roleCode },  // PostgreSQL @> ARRAY[?] — index-able with GIN
}
```

### Module registration (from backend/src/app.module.ts)
```typescript
// Source: backend/src/app.module.ts — add GuidesModule alongside existing entries
import { GuidesModule } from './guides/guides.module';
// In @Module imports array:
GuidesModule,
```

### StorageService reuse for new prefix (from storage.controller.ts:64-72)
```typescript
// Source: backend/src/storage/storage.controller.ts — existing presign-asset pattern
const key = `assets/${Date.now()}-${dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
// For guide images, same pattern with 'guide/' prefix:
const key = `guide/${Date.now()}-${dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| isomorphic-dompurify@^2.x + jsdom@25 pin | isomorphic-dompurify@^3.x (jsdom@^29 bundled) | 2025 | v3.x has dual CJS/ESM output; no jsdom pin needed in NestJS; jsdom pin only relevant in Next.js frontend (Phase 16) |
| `content Json` for Tiptap storage | `content String @db.Text` | Decision D-04 (SUMMARY.md conflict resolution) | Avoids JSONB binary overhead; same round-trip fidelity via JSON.parse/stringify |

**Note on isomorphic-dompurify version:** The project's prior research (STACK.md) recommended `isomorphic-dompurify@^2.x` with `jsdom` pinned to `25.0.1`. This was relevant for the Next.js frontend. For Phase 14 (NestJS backend only), use the current `@^3.x` — it has a confirmed CJS require path and no jsdom issues in Node.js environments. The jsdom pin will be re-evaluated in Phase 16 when the frontend editor is added.

---

## Validation Architecture

nyquist_validation is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (existing, `@nestjs/testing` + `@types/jest@^30`) |
| Config file | `backend/package.json` jest config |
| Quick run command | `cd backend && npx jest src/guides/guides.service.spec.ts --no-coverage` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GUIDE-01 | `createSection` persists and `removeSection` deletes | unit | `npx jest src/guides/guides.service.spec.ts -t "createSection\|removeSection" --no-coverage` | Wave 0 |
| GUIDE-02 | `createPage` links to section; `removePage` deletes | unit | `npx jest src/guides/guides.service.spec.ts -t "createPage\|removePage" --no-coverage` | Wave 0 |
| GUIDE-03 | `findSections` returns only role-matched sections for non-admin; admin sees all | unit | `npx jest src/guides/guides.service.spec.ts -t "findSections" --no-coverage` | Wave 0 |
| GUIDE-04 | `findSections` excludes DRAFT sections/pages for non-admin; admin sees drafts | unit | `npx jest src/guides/guides.service.spec.ts -t "draft" --no-coverage` | Wave 0 |
| GUIDE-05 | `updateSection`/`updatePage` accepts sort_order updates | unit | `npx jest src/guides/guides.service.spec.ts -t "sort_order" --no-coverage` | Wave 0 |
| EDIT-04 | `sanitizeContent` strips `<script>` tags and `javascript:` hrefs | unit | `npx jest src/guides/guides.service.spec.ts -t "sanitize" --no-coverage` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx jest src/guides/guides.service.spec.ts --no-coverage`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/guides/guides.service.spec.ts` — covers all GUIDE-01..05 + EDIT-04 (use `/gen-test guides` skill after service is written)

---

## Open Questions

1. **`DESIGN_OUTREACH_LEAD` role code name**
   - What we know: The seed uses `RoleCode.DESIGN_OUTREACH_LEAD` = `'DESIGN_OUTREACH_LEAD'`, but the CONTEXT.md mentions `DESIGN_LEAD` in multiple places.
   - What's unclear: The actual string code to use in `role_codes` array values.
   - Recommendation: Use `RoleCode.DESIGN_OUTREACH_LEAD` = `'DESIGN_OUTREACH_LEAD'` — this is the canonical value in `backend/src/types/roles.ts`. The CONTEXT.md shorthand `DESIGN_LEAD` is informal. When the admin assigns roles in Phase 15/16, the multi-select should display all 8 RoleCode values from `types/roles.ts`.

2. **Sanitization of JSON-stringified Tiptap content**
   - What we know: D-14 says sanitize on save using isomorphic-dompurify. D-04 says content is `String @db.Text` (JSON-stringified Tiptap document). DOMPurify works on HTML strings, not JSON.
   - What's unclear: In Phase 14 (no editor yet), content will arrive as JSON strings from API testers — not rendered HTML. DOMPurify sanitizing a JSON string will leave JSON intact but strip any injected HTML within it.
   - Recommendation: Sanitize the raw content string with `DOMPurify.sanitize(content)`. This is correct for Phase 14 (no editor). In Phase 16 when the editor sends real Tiptap JSON, the same sanitization applies — any injected HTML tags within the JSON string will be stripped. The edge case (a `<script>` node encoded in the Tiptap JSON doc structure) will be handled when Tiptap's HTML output is sanitized in Phase 15.

---

## Sources

### Primary (HIGH confidence)

- `backend/src/assets/assets.controller.ts` — NestJS module pattern, ParseUUIDPipe, RequiresPermission usage
- `backend/src/assets/assets.service.ts` — Service pattern, admin bypass, Prisma calls
- `backend/src/types/permissions.ts` — Permission enum structure (21 existing values, PERMISSION_DISPLAY_NAMES, PERMISSION_DESCRIPTIONS)
- `backend/src/types/roles.ts` — RoleCode enum, 8 canonical role code strings
- `backend/src/storage/storage.controller.ts` — Presign endpoint pattern, key construction
- `backend/src/storage/storage.service.ts` — validatePresignRequest, generatePresignedPutUrl, getPublicUrl
- `backend/src/app.module.ts` — Module registration pattern
- `backend/prisma/seed.ts` — FOUNDER_ADMIN and TECH_LEAD use `Object.values(Permission)` — MANAGE_GUIDE auto-included
- `.planning/research/SUMMARY.md` — Content storage conflict resolution (String @db.Text confirmed)
- `.planning/research/ARCHITECTURE.md` — Prisma model definitions, API surface, role filter query pattern
- `.planning/research/PITFALLS.md` — 8 critical pitfalls, all Phase 1 priority
- npm registry: `isomorphic-dompurify@3.6.0` — confirmed latest, CJS `require` path available (`dist/index.js`)

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` — jsdom pin recommendation (applicable to Phase 16 frontend only, not Phase 14 backend)
- Prisma v6 docs — `String @db.Text` maps to PostgreSQL TEXT; `String[]` array scalar filter `has` confirmed (referenced in ARCHITECTURE.md)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `isomorphic-dompurify@3.6.0` confirmed via npm; CJS require path verified; all other dependencies already installed
- Architecture: HIGH — follows 35 existing module patterns; Prisma array filter pattern confirmed; locked decisions (D-01 to D-19) provide all design choices
- Pitfalls: HIGH — all 8 pitfalls from PITFALLS.md verified against official sources; additional pitfalls discovered by reading actual seed.ts and permission patterns

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (isomorphic-dompurify version — stable library; Prisma v6 — stable)
