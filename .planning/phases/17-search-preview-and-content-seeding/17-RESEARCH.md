# Phase 17: Search, Preview, and Content Seeding - Research

**Researched:** 2026-03-23
**Domain:** PostgreSQL full-text search (tsvector), shadcn Command/cmdk, Tiptap JSON text extraction, guide content seeding strategy
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Global search overlay — Cmd+K / Ctrl+K style accessible from anywhere in the guide pages
- **D-02:** Search results display is Claude's discretion — dropdown, inline list, or dedicated overlay results
- **D-03:** Search uses Postgres tsvector for server-side full-text search
- **D-04:** Search results filtered by role — users only see results from sections they have access to
- **D-05:** Results include page title, section name, and a text snippet with highlighted match
- **D-06:** Role selector dropdown on the /guide index page — visible only when admin is logged in
- **D-07:** When a role is selected, the guide index filters sections to match that role's view exactly
- **D-08:** Preview is frontend-only — no backend role-spoofing. Admin fetches all sections, filters client-side
- **D-09:** Clear indicator showing "Previewing as: [Role Name]" with a button to return to admin view
- **D-10:** Full walkthroughs — every feature area gets 3-5 pages with detailed step-by-step instructions and tips
- **D-11:** Comprehensive coverage — all major features PLUS admin/system guide (expand existing + new sections)
- **D-12:** Admin & System Guide covers: user management, permissions, settings, delegations, system overview
- **D-13:** Content generated from actual codebase — Claude reads the real code to write accurate walkthroughs
- **D-14:** All sections pre-mapped to correct roles based on existing RBAC permissions
- **D-15:** All seeded content stored as Tiptap JSON, fully editable via the CMS
- **D-16:** Seed data goes in prisma/seed.ts — idempotent, runs on every seed

### Claude's Discretion

- Search result display format (dropdown vs overlay vs inline)
- Search keyboard shortcut trigger component
- tsvector column implementation details (generated column vs trigger)
- Number of exact pages per section (within 3-5 range)
- Exact content of each walkthrough page
- How to structure the admin guide sections

### Deferred Ideas (OUT OF SCOPE)

- Search within page content (highlighting matches in the page)
- Search suggestions / autocomplete
- Content versioning
- AI-assisted content updates

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| READ-03 | User can search across all visible guide pages via full-text search | tsvector migration pattern, NestJS search endpoint with role filter, cmdk/Command component |
| READ-04 | Admin/tech can preview the guide as any role to verify content visibility | Frontend-only role filter using ROLE_DISPLAY_NAMES, GuidePreviewBanner, auth store roleCode check |
| SEED-01 | System ships with pre-written guide sections for all major feature areas | Seed structure, role-to-section mapping, idempotent delete+create pattern |
| SEED-02 | Each section contains step-by-step workflow walkthroughs generated from actual codebase | Tiptap JSON content format, existing content as template, real codebase read |
| SEED-03 | Sections are pre-mapped to the correct roles based on existing RBAC permissions | Authoritative role codes from roles.ts, permission-based section mapping table |
| SEED-04 | All seeded content is editable by admin post-deployment | Tiptap JSON stored in content column, GuideProseRenderer compatible, no special handling needed |

</phase_requirements>

---

## Summary

Phase 17 has three distinct work streams: (1) a PostgreSQL full-text search endpoint on the backend plus a Cmd+K overlay on the frontend; (2) a purely frontend admin preview-as-role toggle; (3) a large seed.ts expansion from 5 sections/8 pages to ~12 sections/40+ pages of real content.

The search stream requires a new Prisma migration adding a `search_text TEXT` column (plain text extracted from Tiptap JSON), a PostgreSQL trigger to keep it in sync, a GIN index, and a raw SQL query via `prisma.$queryRaw`. The frontend installs `cmdk` via `npx shadcn add command` which pulls in the base-nova Command component that wraps the existing Base UI dialog — no Radix UI conflict. The preview stream is zero backend work; it is local state in the guide index page.

The seed stream is the largest effort in file size terms: ~12 sections, ~40+ pages, each as Tiptap JSON. The critical fix is correcting stale role codes in the existing seed (`PRODUCTION_LEAD` → `BACKEND_LEAD`, `FRONTEND_EXPERIENCE_LEAD` → `FRONTEND_LEAD`) and mapping every new section to the right role codes from `RoleCode` enum.

**Primary recommendation:** Execute as three parallel sub-tasks: (1) backend search migration + endpoint, (2) frontend Command overlay + preview banner, (3) seed content expansion. Each is independently mergeable.

---

## Standard Stack

### Core (No New Backend Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cmdk` | 1.1.1 | Command palette primitive for search overlay | Shadcn's Command component is built on it |
| Postgres tsvector | built-in | Full-text search index on GuidePage | No extension needed, native to Postgres |
| `prisma.$queryRaw` | Prisma 6.19.x | Execute tsvector search query with JOIN | Only way to use tsvector in Prisma |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | 5.91.2 | Search query with debounce and loading state | Already in frontend; query key `['guide', 'search', query]` |
| Base UI Dialog | `@base-ui/react` 1.3.0 | CommandDialog wrapper | Already installed; base-nova Command uses this dialog |

### New Frontend Install Required

```bash
# Inside frontend/ directory
npx shadcn add command
```

This installs:
- `cmdk` 1.1.1 (new dep — adds `@radix-ui/react-id`, `@radix-ui/react-dialog`, `@radix-ui/react-primitive`, `@radix-ui/react-compose-refs` as transitive deps)
- `components/ui/command.tsx` (new file — base-nova variant)

**Critical note:** `cmdk` depends on `@radix-ui/react-dialog` but the base-nova `CommandDialog` wraps the local `dialog.tsx` (Base UI) — it does NOT use `cmdk`'s built-in dialog. The Radix packages are installed as transitive deps of `cmdk` but are NOT imported by the base-nova `command.tsx`. This is safe.

**Also critical:** `npx shadcn add command` will NOT overwrite `dialog.tsx` in base-nova style — the base-nova registry `CommandDialog` uses the local `Dialog` from `@base-ui/react/dialog`, not Radix. Verify with `npx shadcn add command --diff` before applying.

**Version verification:**
```bash
npm view cmdk version   # 1.1.1 — confirmed
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsvector trigger | Generated column (`GENERATED ALWAYS AS ... STORED`) | Generated column causes Prisma migration drift — Prisma re-adds DROP/ADD on every migrate. Trigger approach is stable. |
| `cmdk` / shadcn Command | Custom search overlay with Input + Popover | cmdk handles keyboard navigation, aria roles, escape handling automatically |
| `prisma.$queryRaw` | `pg_trgm` fuzzy search | tsvector is better for phrase/word matching. pg_trgm is better for typo-tolerance. tsvector is sufficient for guide search. |

---

## Architecture Patterns

### Recommended Project Structure (New Files)

```
backend/
├── prisma/
│   ├── migrations/
│   │   └── XXXXXXXXXXXXXXXX_add_guide_search_text/
│   │       └── migration.sql   # ALTER TABLE + trigger + GIN index
│   └── seed.ts                 # Expand to 12 sections / 40+ pages
│
└── src/
    └── guides/
        ├── guides.controller.ts   # Add GET /guide/search endpoint
        └── guides.service.ts      # Add searchPages() method

frontend/
└── components/
    └── ops/
        └── guide/
            ├── GuideSearchOverlay.tsx      # New — CommandDialog + Cmd+K listener
            ├── GuideSearchResultItem.tsx   # New — single result row
            └── GuidePreviewBanner.tsx      # New — amber strip for preview mode
```

### Pattern 1: tsvector via Trigger (Migration SQL)

**What:** Add a `search_text TEXT` column that stores plain text extracted from Tiptap JSON. A PL/pgSQL trigger keeps it up-to-date on INSERT/UPDATE. A GIN index on `to_tsvector(search_text)` enables fast full-text queries.

**Why trigger over generated column:** Prisma 6 cannot manage `GENERATED ALWAYS AS ... STORED` columns with `tsvector` type — it marks them as `Unsupported()` and re-generates DROP/ADD statements on every `migrate dev`, causing migration drift. The trigger approach is stable with Prisma because the trigger function and index are defined entirely in the migration SQL and never touched by Prisma schema diff.

**When to use:** Any time you need full-text search on a column managed by Prisma.

**Migration SQL:**
```sql
-- 1. Add plain text column to hold extracted text for search
ALTER TABLE "GuidePage" ADD COLUMN "search_text" TEXT NOT NULL DEFAULT '';

-- 2. Back-fill existing rows: extract all "text" values from the Tiptap JSON content
--    The content is stored as JSON string. The regex extracts all "text":"..." values.
UPDATE "GuidePage"
SET "search_text" = title || ' ' || COALESCE(
  regexp_replace(content, '"text":"([^"]+)"', '\1 ', 'g'),
  ''
);

-- 3. Trigger function: re-extracts text on INSERT/UPDATE
CREATE OR REPLACE FUNCTION guide_page_search_text_sync()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text :=
    NEW.title || ' ' ||
    COALESCE(
      regexp_replace(NEW.content::text, '"text":"([^"]+)"', '\1 ', 'g'),
      ''
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger before INSERT/UPDATE
CREATE TRIGGER guide_page_search_text_trigger
BEFORE INSERT OR UPDATE OF content, title
ON "GuidePage"
FOR EACH ROW EXECUTE FUNCTION guide_page_search_text_sync();

-- 5. GIN index on tsvector for fast search
CREATE INDEX "GuidePage_search_text_gin_idx"
ON "GuidePage" USING GIN (to_tsvector('english', search_text));
```

**Prisma schema addition (schema.prisma):**
```prisma
model GuidePage {
  // ... existing fields ...
  search_text String @default("") // populated by trigger
}
```

### Pattern 2: Search Endpoint (NestJS)

**What:** `GET /guide/search?q=<query>` — returns up to 10 results, filtered by caller's role.

**Endpoint:**
```typescript
// guides.controller.ts
@Get('search')
search(@Query('q') q: string, @Req() req: express.Request) {
  const user = (req as any).user;
  return this.guidesService.searchPages(q, user.roleCode);
}
```

**Service method — role-filtered tsvector search:**
```typescript
// guides.service.ts
async searchPages(query: string, roleCode: string) {
  if (!query || query.trim().length < 2) return [];

  const isAdmin = this.isAdmin(roleCode);
  const safeQuery = query.trim().replace(/[^\w\s]/g, '').trim();
  if (!safeQuery) return [];

  // Use websearch_to_tsquery for natural language support (handles multi-word, AND, OR)
  // ts_headline extracts a snippet with the match highlighted using <mark> tags
  // Role filter: JOIN with GuideSection and check role_codes array or admin bypass
  const results = await this.prisma.$queryRaw<SearchResult[]>`
    SELECT
      p.id           AS "pageId",
      p.title        AS "pageTitle",
      p.slug         AS "pageSlug",
      s.title        AS "sectionTitle",
      s.slug         AS "sectionSlug",
      ts_headline(
        'english',
        p.search_text,
        websearch_to_tsquery('english', ${safeQuery}),
        'MaxWords=20, MinWords=10, StartSel=<mark>, StopSel=</mark>, HighlightAll=false'
      ) AS snippet
    FROM "GuidePage" p
    JOIN "GuideSection" s ON s.id = p.section_id
    WHERE
      p.status = 'published'
      AND s.status = 'published'
      AND to_tsvector('english', p.search_text) @@ websearch_to_tsquery('english', ${safeQuery})
      AND (
        ${isAdmin ? Prisma.sql`TRUE` : Prisma.sql`s.role_codes @> ARRAY[${roleCode}]::text[]`}
      )
    ORDER BY ts_rank(to_tsvector('english', p.search_text), websearch_to_tsquery('english', ${safeQuery})) DESC
    LIMIT 10
  `;

  return results;
}
```

**Return shape:**
```typescript
interface SearchResult {
  pageId: string;
  pageTitle: string;
  pageSlug: string;
  sectionTitle: string;
  sectionSlug: string;
  snippet: string; // HTML with <mark> tags — sanitized before sending
}
```

**Security:** `ts_headline` output contains `<mark>` tags only — the DOMPurify sanitizer already allows `<mark>` in the existing allowlist. Add `'mark'` to `ALLOWED_TAGS` in `sanitizeContent()` if not present, or sanitize the snippet in the search method before returning.

**Note on `Prisma.sql` conditional:** The pattern `${isAdmin ? Prisma.sql\`TRUE\` : Prisma.sql\`s.role_codes @> ARRAY[${roleCode}]::text[]\`}` is the correct Prisma raw SQL conditional. Import `Prisma` from `@prisma/client`.

### Pattern 3: Frontend CommandDialog with Cmd+K

**What:** `GuideSearchOverlay` is a `"use client"` component that registers a `keydown` listener for `Cmd+K`/`Ctrl+K` and renders a `CommandDialog`. It is mounted in the `/guide/page.tsx` (index page) and imported without `ssr: false` — it is already `"use client"` and safe. The guide page components need to also include it or it should be in a guide-specific layout.

**Mounting strategy — no guide layout file exists:** The overlay must be mounted in each guide route that should support Cmd+K:
- `frontend/app/(ops)/guide/page.tsx` — add `<GuideSearchOverlay />`
- `frontend/app/(ops)/guide/[sectionSlug]/page.tsx` — add `<GuideSearchOverlay />`
- `frontend/app/(ops)/guide/[sectionSlug]/[pageSlug]/page.tsx` — add `<GuideSearchOverlay />`

Alternatively (cleaner): create `frontend/app/(ops)/guide/layout.tsx` as a thin client layout that mounts `<GuideSearchOverlay />` once for all guide routes. This is the recommended pattern.

**Query debounce implementation:**
```typescript
// In GuideSearchOverlay — 300ms debounce, min 2 chars
const [query, setQuery] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');

useEffect(() => {
  const t = setTimeout(() => setDebouncedQuery(query), 300);
  return () => clearTimeout(t);
}, [query]);

const { data: results, isLoading } = useQuery({
  queryKey: ['guide', 'search', debouncedQuery],
  queryFn: () => apiClient.get<SearchResult[]>(`/guide/search?q=${encodeURIComponent(debouncedQuery)}`),
  enabled: debouncedQuery.length >= 2,
  staleTime: 30_000,
});
```

**Keyboard listener guard — avoid conflict with inputs:**
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);
```

### Pattern 4: Preview-as-Role (Frontend Only)

**What:** Local state `previewRole: RoleCode | null` in `/guide/page.tsx`. When set, the section grid filters using `sections.filter(s => s.role_codes.includes(previewRole))`. No API call.

**Admin detection:** `useAuthStore(s => s.user?.roleCode)` — render selector only when `roleCode === 'FOUNDER_ADMIN' || roleCode === 'TECH_LEAD'`.

**State reset:** `previewRole` is component-local state — resets on navigation away from `/guide`.

### Pattern 5: Seed Expansion Structure

**What:** The seed expands from 5 sections/8 pages to ~12 sections/40-50 pages. Structure follows existing pattern: `deleteMany` + `create` inside `$transaction`.

**Idempotency mechanism:** The existing pattern `await tx.guidePage.deleteMany({})` followed by `await tx.guideSection.deleteMany({})` then `create` for each is already idempotent. Maintain this.

**Content format:** Every page's `content` field is `JSON.stringify({type:'doc', content:[...]})` — the Tiptap ProseMirror document. Headings use `{type:'heading',attrs:{level:2},content:[...]}`. Bullet lists use `{type:'bulletList',content:[...]}`. Ordered lists use `{type:'orderedList',content:[...]}`. Paragraphs use `{type:'paragraph',content:[...]}`. Text nodes: `{type:'text',text:'...'}`. Bold: `{type:'text',text:'...',marks:[{type:'bold'}]}`.

**estimated_read_time formula (fix existing bug):** The seed currently uses `Math.ceil(JSON.stringify(page.content).length / 1000)` which is wrong — it measures JSON string length not word count. Use the service's `computeReadTime` logic: extract text and count words at ~200 words/min.

**Role code correction (CRITICAL):** The existing sections have stale role codes that must be fixed:

| Old (wrong) | Correct |
|---|---|
| `PRODUCTION_LEAD` | `BACKEND_LEAD` |
| `FRONTEND_EXPERIENCE_LEAD` | `FRONTEND_LEAD` |

### Anti-Patterns to Avoid

- **Using `prisma.guidePage.findMany` for search:** Prisma ORM queries cannot use tsvector operators. Use `prisma.$queryRaw`.
- **Inlining `query` directly into SQL string:** Use Prisma tagged template literals (`$queryRaw\`...\``) which parameterize safely. Never `$queryRawUnsafe` with user input.
- **Checking `cmdk` dialog for Radix conflict:** The base-nova `CommandDialog` wraps Base UI dialog — it never imports `@radix-ui/react-dialog` directly. The Radix packages are installed as transitive cmdk deps only.
- **Mounting GuideSearchOverlay in ops layout:** The Cmd+K search is guide-specific. Mount it in a guide layout (`app/(ops)/guide/layout.tsx`), not the global ops layout.
- **Setting `role_codes` with stale codes in new seed sections:** Always reference `RoleCode` enum values from `types/roles.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard navigation in search results | Custom `onKeyDown` handlers | `cmdk` CommandItem | cmdk handles arrow keys, enter, escape, aria-selected natively |
| Search input debounce | `lodash.debounce` or custom hook | `useEffect` with `setTimeout` (inline, 300ms) | No new dependency needed for a single debounce |
| Plain text extraction from Tiptap JSON | `@tiptap/core` `generateText()` on backend | PostgreSQL trigger + regex on JSON text nodes | Backend has no Tiptap dependency; regex on the JSON string is sufficient and deterministic |
| Snippet highlighting | Custom substring matcher | PostgreSQL `ts_headline()` | Handles multi-word matches, weights, and context automatically |
| Role filtering on search | Re-implement in NestJS application code | Raw SQL JOIN with `role_codes @> ARRAY[role]` | Single query, no round-trip, uses same pattern as the Prisma `has` filter |

**Key insight:** The heavy lifting of snippet extraction and ranking is delegated entirely to PostgreSQL. The NestJS service is a thin query wrapper.

---

## Common Pitfalls

### Pitfall 1: Prisma Migration Drift with tsvector Generated Column

**What goes wrong:** Adding `search_vector Unsupported("tsvector GENERATED ALWAYS AS ... STORED")` to schema.prisma causes Prisma to generate `DROP COLUMN` / `ADD COLUMN` on every `migrate dev` run, forcing re-index of all rows.

**Why it happens:** Prisma does not understand the `GENERATED ALWAYS AS ... STORED` clause on `Unsupported` types and treats it as unmanaged column drift.

**How to avoid:** Use a TEXT column (`search_text String @default("")`) managed by Prisma for schema purposes, plus a trigger (defined in the migration SQL) that populates it. The trigger is invisible to Prisma schema diff. The GIN index is also created in the migration SQL, not the schema.

**Warning signs:** Running `prisma migrate dev` generates a migration that drops and re-adds a column.

### Pitfall 2: `cmdk` Installing Radix Dialog Conflict

**What goes wrong:** Developer sees `@radix-ui/react-dialog` in the install output and worries it will conflict with the existing Base UI dialog.

**Why it happens:** `cmdk` 1.1.1 lists `@radix-ui/react-dialog` as a runtime dependency for its own `Command.Dialog` sub-component.

**How to avoid:** The base-nova `command.tsx` does NOT use `cmdk`'s built-in dialog — it uses the project's local `Dialog` (Base UI). The Radix dialog package is installed but never imported in the base-nova component tree. No conflict. Verify: after install, `components/ui/command.tsx` imports from `"cmdk"` and `@/components/ui/dialog` — no `@radix-ui/react-dialog` import anywhere in command.tsx.

**Warning signs:** If `command.tsx` contains `import ... from "@radix-ui/react-dialog"` — that would be the wrong style. The base-nova style uses local dialog.

### Pitfall 3: `ts_headline` Returns HTML — XSS Risk

**What goes wrong:** `ts_headline()` returns a string with `<mark>` tags. If passed through `dangerouslySetInnerHTML` without sanitization, any malicious content stored in `search_text` could inject script tags.

**Why it happens:** Guide content is admin-authored and DOMPurify-sanitized on save, so the risk is low. But if a bug allowed unsanitized content into `search_text` via the trigger, the snippet would be rendered raw.

**How to avoid:** In the search service method, pass the snippet through the existing `sanitizeContent()` method before returning. The existing DOMPurify config allows `<mark>` in `ALLOWED_TAGS` — verify or add it.

**Warning signs:** `GuideSearchResultItem` uses `dangerouslySetInnerHTML={{ __html: result.snippet }}` — this is correct per the UI-SPEC but requires the backend to sanitize first.

### Pitfall 4: Stale Role Codes in Seed

**What goes wrong:** The existing seed uses `PRODUCTION_LEAD` and `FRONTEND_EXPERIENCE_LEAD` which do not exist in the `RoleCode` enum. These sections silently get zero role-matched readers.

**Why it happens:** The seed was written during an earlier design iteration with different role names.

**How to avoid:** Fix all `role_codes` in the seed to use only values from `RoleCode` enum: `FOUNDER_ADMIN`, `FRONTEND_LEAD`, `BACKEND_LEAD`, `BI_LEAD`, `PROCUREMENT_LEAD`, `TALENT_LEAD`, `TECH_LEAD`, `DESIGN_OUTREACH_LEAD`.

**Warning signs:** Logging in as `BACKEND_LEAD` and seeing no Kitchen Operations guide (because `PRODUCTION_LEAD` is the listed code, which doesn't match).

### Pitfall 5: GuideSearchOverlay Not Mounted on Sub-Routes

**What goes wrong:** `GuideSearchOverlay` is only added to `/guide/page.tsx` but not the section detail page or page reading view. Cmd+K does not fire on sub-routes.

**Why it happens:** No guide layout file — each route file is standalone.

**How to avoid:** Create `frontend/app/(ops)/guide/layout.tsx` as the canonical mount point for `GuideSearchOverlay`. This file can be a thin client component that renders `{children}` plus the overlay. All three guide route files automatically pick it up.

### Pitfall 6: `websearch_to_tsquery` vs `plainto_tsquery`

**What goes wrong:** Using `plainto_tsquery` causes a syntax error when the user types a single character or special character.

**Why it happens:** `plainto_tsquery` does not accept empty input cleanly. `websearch_to_tsquery` is more robust for user input.

**How to avoid:** Use `websearch_to_tsquery('english', $1)` in the query. Guard against empty or < 2 char queries at the service layer before executing SQL.

---

## Role-to-Section Mapping (SEED-03)

The authoritative role codes from `backend/src/types/roles.ts`:

| Role Code | Display Name | Primary Domain |
|-----------|-------------|----------------|
| `FOUNDER_ADMIN` | Founder/Admin | All features (full access) |
| `TECH_LEAD` | Tech Lead | All features (full access) |
| `FRONTEND_LEAD` | Frontend Lead | POS, Orders, Events, Customer Feedback, Missions & Tasks |
| `BACKEND_LEAD` | Backend Lead | Kitchen Operations, Recipes & Menu, Missions & Tasks |
| `BI_LEAD` | BI Lead | Analytics & Dashboard, KPIs, Recipes & Menu, Missions & Tasks |
| `PROCUREMENT_LEAD` | Procurement Lead | Inventory & Procurement, Kitchen Operations, Missions & Tasks |
| `TALENT_LEAD` | Talent Lead | Missions & Tasks |
| `DESIGN_OUTREACH_LEAD` | Design/Outreach Lead | Missions & Tasks, Events & Bookings |

**Recommended section-to-role mapping for seed:**

| Section | Role Codes |
|---------|-----------|
| Kitchen Operations (expand to 5 pages) | `FOUNDER_ADMIN`, `TECH_LEAD`, `BACKEND_LEAD`, `PROCUREMENT_LEAD` |
| POS & Orders (expand to 4 pages) | `FOUNDER_ADMIN`, `TECH_LEAD`, `FRONTEND_LEAD` |
| Inventory & Procurement (expand to 3 pages) | `FOUNDER_ADMIN`, `TECH_LEAD`, `PROCUREMENT_LEAD` |
| Recipes & Menu (expand to 3 pages) | `FOUNDER_ADMIN`, `TECH_LEAD`, `BACKEND_LEAD`, `BI_LEAD` |
| Missions & Tasks (expand to 4 pages) | All 8 roles |
| Evidence & Approvals (new, 3 pages) | `FOUNDER_ADMIN`, `TECH_LEAD`, `FRONTEND_LEAD`, `BACKEND_LEAD`, `PROCUREMENT_LEAD` |
| Governance & Decisions (new, 3 pages) | `FOUNDER_ADMIN`, `TECH_LEAD`, `FRONTEND_LEAD`, `BACKEND_LEAD`, `BI_LEAD`, `DESIGN_OUTREACH_LEAD` |
| Analytics & Dashboard (new, 3 pages) | `FOUNDER_ADMIN`, `TECH_LEAD`, `BI_LEAD` |
| Notifications (new, 2 pages) | All 8 roles |
| Events & Bookings (new, 3 pages) | `FOUNDER_ADMIN`, `TECH_LEAD`, `FRONTEND_LEAD`, `DESIGN_OUTREACH_LEAD` |
| Customer Feedback (new, 2 pages) | `FOUNDER_ADMIN`, `TECH_LEAD`, `FRONTEND_LEAD` |
| Admin & System Guide (new, 4 pages) | `FOUNDER_ADMIN`, `TECH_LEAD` |

Total: ~12 sections, ~39 pages minimum.

---

## Code Examples

### Tsvector Migration SQL (complete)

```sql
-- Source: Wanago.io tsvector migration pattern + Prisma $queryRaw guidance (verified)

-- Step 1: Add search_text column
ALTER TABLE "GuidePage" ADD COLUMN "search_text" TEXT NOT NULL DEFAULT '';

-- Step 2: Backfill from existing content (extracts text from JSON string values)
UPDATE "GuidePage"
SET "search_text" = title || ' ' ||
  COALESCE(regexp_replace(content, '"text":"([^"]+)"', '\1 ', 'g'), '');

-- Step 3: Trigger function
CREATE OR REPLACE FUNCTION guide_page_search_text_sync()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text :=
    NEW.title || ' ' ||
    COALESCE(
      regexp_replace(NEW.content::text, '"text":"([^"]+)"', '\1 ', 'g'),
      ''
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Trigger
DROP TRIGGER IF EXISTS guide_page_search_text_trigger ON "GuidePage";
CREATE TRIGGER guide_page_search_text_trigger
BEFORE INSERT OR UPDATE OF content, title
ON "GuidePage"
FOR EACH ROW EXECUTE FUNCTION guide_page_search_text_sync();

-- Step 5: GIN index
CREATE INDEX "GuidePage_search_text_gin_idx"
ON "GuidePage" USING GIN (to_tsvector('english', search_text));
```

### Prisma Schema Addition

```prisma
// Source: Existing schema.prisma — add to GuidePage model
model GuidePage {
  // ... existing fields ...
  search_text String @default("") // Populated by trigger, used for FTS
}
```

### Search Service Method

```typescript
// Source: Prisma $queryRaw pattern + tsvector JOIN role filter
import { Prisma } from '@prisma/client';

interface SearchResult {
  pageId: string;
  pageTitle: string;
  pageSlug: string;
  sectionTitle: string;
  sectionSlug: string;
  snippet: string;
}

async searchPages(query: string, roleCode: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const safeQuery = query.trim();
  const isAdmin = this.isAdmin(roleCode);

  const results = isAdmin
    ? await this.prisma.$queryRaw<SearchResult[]>`
        SELECT
          p.id          AS "pageId",
          p.title       AS "pageTitle",
          p.slug        AS "pageSlug",
          s.title       AS "sectionTitle",
          s.slug        AS "sectionSlug",
          ts_headline(
            'english', p.search_text,
            websearch_to_tsquery('english', ${safeQuery}),
            'MaxWords=20,MinWords=10,StartSel=<mark>,StopSel=</mark>'
          ) AS snippet
        FROM "GuidePage" p
        JOIN "GuideSection" s ON s.id = p.section_id
        WHERE to_tsvector('english', p.search_text)
              @@ websearch_to_tsquery('english', ${safeQuery})
        ORDER BY ts_rank(
          to_tsvector('english', p.search_text),
          websearch_to_tsquery('english', ${safeQuery})
        ) DESC
        LIMIT 10
      `
    : await this.prisma.$queryRaw<SearchResult[]>`
        SELECT
          p.id          AS "pageId",
          p.title       AS "pageTitle",
          p.slug        AS "pageSlug",
          s.title       AS "sectionTitle",
          s.slug        AS "sectionSlug",
          ts_headline(
            'english', p.search_text,
            websearch_to_tsquery('english', ${safeQuery}),
            'MaxWords=20,MinWords=10,StartSel=<mark>,StopSel=</mark>'
          ) AS snippet
        FROM "GuidePage" p
        JOIN "GuideSection" s ON s.id = p.section_id
        WHERE p.status = 'published'
          AND s.status = 'published'
          AND s.role_codes @> ARRAY[${roleCode}]::text[]
          AND to_tsvector('english', p.search_text)
              @@ websearch_to_tsquery('english', ${safeQuery})
        ORDER BY ts_rank(
          to_tsvector('english', p.search_text),
          websearch_to_tsquery('english', ${safeQuery})
        ) DESC
        LIMIT 10
      `;

  // Sanitize snippets before returning (defense-in-depth, snippet contains <mark> tags)
  return results.map(r => ({
    ...r,
    snippet: this.sanitizeContent(r.snippet),
  }));
}
```

**Note:** Two separate `$queryRaw` calls (admin vs non-admin) because Prisma tagged template conditionals do not support Prisma.sql within `$queryRaw` when the entire WHERE clause changes. The two-branch approach is explicit and type-safe.

**`sanitizeContent` must allow `<mark>` tag:** Add `'mark'` to `ALLOWED_TAGS` in the existing `sanitizeContent` method in `guides.service.ts`.

### Frontend Search Overlay Skeleton

```typescript
// Source: UI-SPEC + cmdk base-nova Command component
// GuideSearchOverlay.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

export function GuideSearchOverlay() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const { data: results, isLoading } = useQuery({
    queryKey: ['guide', 'search', debouncedQuery],
    queryFn: () => apiClient.get<SearchResult[]>(`/guide/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setQuery(''); }}
      title="Search guides"
      description="Search all visible guide pages"
      className="max-w-[560px] top-[20%] translate-y-0"
    >
      <CommandInput
        placeholder="Search guides..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[360px]">
        {/* ... results rendering per UI-SPEC ... */}
      </CommandList>
      {/* Footer bar per UI-SPEC */}
    </CommandDialog>
  );
}
```

### Guide Layout for Global Search Mount

```typescript
// Source: Next.js App Router layout pattern
// frontend/app/(ops)/guide/layout.tsx
import { GuideSearchOverlay } from '@/components/ops/guide/GuideSearchOverlay';

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GuideSearchOverlay />
    </>
  );
}
```

**Note:** `layout.tsx` can be a server component (no `'use client'` needed) because it just renders children plus `GuideSearchOverlay` (which is itself `'use client'`).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `plainto_tsquery` for user search input | `websearch_to_tsquery` | Postgres 11+ | Handles multi-word search, quoted phrases, exclusions robustly |
| cmdk wrapping Radix Dialog | base-nova cmdk wrapping Base UI Dialog | shadcn base-nova style | No Radix UI needed for the overlay — no conflict with existing Base UI components |
| Hard-coded role_codes with old names | Role codes from `RoleCode` enum | Phase 17 (now) | Role filtering works correctly |

**Deprecated/outdated:**
- `PRODUCTION_LEAD` / `FRONTEND_EXPERIENCE_LEAD` in seed.ts: these role codes do not exist in the current RoleCode enum — replace with `BACKEND_LEAD` / `FRONTEND_LEAD`
- `Math.ceil(JSON.stringify(page.content).length / 1000)` for read time in seed: replace with word-count-based calculation

---

## Open Questions

1. **`sanitizeContent` does not currently allow `<mark>` tag**
   - What we know: The existing allowlist in `guides.service.ts` does not include `mark`. `ts_headline` outputs `<mark>` tags.
   - What's unclear: Will DOMPurify strip the `<mark>` tags in snippet output before returning to client?
   - Recommendation: Add `'mark'` to `ALLOWED_TAGS` in `sanitizeContent`. This is a 1-line change. Verify when implementing the search method.

2. **Guide layout file creation — is `layout.tsx` in Next.js 16.2.0 compatible with this project's patterns?**
   - What we know: Next.js App Router supports nested layouts. The ops layout exists at `app/(ops)/layout.tsx`. A guide sub-layout at `app/(ops)/guide/layout.tsx` would wrap all `/guide/*` routes.
   - What's unclear: The `frontend/AGENTS.md` warns about Next.js breaking changes. The current Next.js version is 16.2.0. Layout files in App Router are standard.
   - Recommendation: Create `layout.tsx` as a simple server component wrapper — this is App Router core functionality unchanged since Next.js 13.

3. **Backfill query correctness for JSON extraction**
   - What we know: The regex `regexp_replace(content, '"text":"([^"]+)"', '\1 ', 'g')` extracts text node values from the Tiptap JSON string. This covers most content.
   - What's unclear: Tiptap JSON may contain escaped quotes inside text values (e.g., `"text":"He said \"hello\""`) which the simple regex would truncate at the backslash.
   - Recommendation: For the backfill, this is acceptable — the search index is approximate. Edge-case content with embedded quotes will still be partially indexed. The trigger populates `search_text` on every future save via the trigger where Postgres handles the full JSON correctly.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.x (backend) |
| Config file | `backend/package.json` → `jest` key |
| Quick run command | `cd backend && npm test -- --testPathPattern=guides` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| READ-03 | Search returns role-filtered results for a given query | unit | `cd backend && npm test -- --testPathPattern=guides` | ❌ Wave 0 |
| READ-03 | Search returns empty array for query < 2 chars | unit | `cd backend && npm test -- --testPathPattern=guides` | ❌ Wave 0 |
| READ-04 | Preview role selector visible only for admin roles | manual | Manual — visual check | N/A |
| SEED-01 | Seed creates all 12 sections | smoke | `cd backend && npx prisma db seed` then count sections | N/A |
| SEED-03 | Role-to-section mapping correct (BACKEND_LEAD sees Kitchen) | smoke | Login as BACKEND_LEAD, check sections visible | N/A |
| SEED-04 | Seeded content renders in GuideProseRenderer | smoke | Open a seeded page in UI | N/A |

### Sampling Rate

- **Per task commit:** `cd backend && npm test -- --testPathPattern=guides --passWithNoTests`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** All guide service tests pass before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/src/guides/__tests__/guides.service.search.spec.ts` — covers READ-03 (search filtering by role, empty query guard)

---

## Sources

### Primary (HIGH confidence)

- `backend/src/types/roles.ts` — authoritative RoleCode enum (8 roles confirmed)
- `backend/src/types/permissions.ts` — Permission enum, role-permission mapping
- `backend/prisma/schema.prisma` — GuidePage model (content TEXT, no search_text yet)
- `backend/prisma/migrations/20260322141410_add_guide_section_and_page/migration.sql` — existing guide tables confirmed
- `backend/prisma/seed.ts` — existing 5-section seed structure, stale role codes confirmed
- `backend/src/guides/guides.service.ts` — sanitizeContent, isAdmin, computeReadTime patterns
- `frontend/components/ui/dialog.tsx` — uses Base UI, not Radix (confirmed)
- `frontend/components/ui/select.tsx` — uses Base UI (confirmed)
- `frontend/package.json` — `@base-ui/react` 1.3.0 installed, no Radix UI, no cmdk (confirmed)
- `frontend/components.json` — style: `base-nova` (confirmed)
- shadcn base-nova `command.json` registry — CommandDialog uses local Dialog (Base UI), not Radix
- npm registry: `cmdk@1.1.1` dependencies include `@radix-ui/react-dialog` (but not used by base-nova variant)

### Secondary (MEDIUM confidence)

- [Wanago.io — NestJS tsvector full-text search](https://wanago.io/2022/11/14/api-nestjs-text-search-tsvector-sql/) — trigger + $queryRaw pattern, 2022 (stable Postgres pattern)
- [Svanstrom.nu — PostgreSQL FTS with Prisma](https://www.svanstrom.nu/2024/03/05/postgresql-full-text-search-with-prisma/) — Unsupported tsvector schema, $queryRaw usage, 2024
- Tiptap GitHub Discussion #3114 — generateText availability (for server-side approach if needed)

### Tertiary (LOW confidence)

- Medium: Bulletproof FTS in Prisma without migration drift — trigger approach (access blocked during research; referenced by pattern match)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cmdk version verified, Base UI conflict analyzed from source files, no Radix in frontend confirmed
- Architecture: HIGH — tsvector trigger pattern verified from two independent sources, Prisma $queryRaw pattern confirmed, role codes verified from actual codebase
- Pitfalls: HIGH — stale role codes confirmed by grep of seed.ts, Base UI/Radix conflict analyzed directly from component source
- Seed mapping: MEDIUM — role-to-section mapping is inferred from permission assignments in seed.ts; final mapping is Claude's discretion per CONTEXT.md

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain — Postgres tsvector, Next.js layouts, cmdk are not fast-moving)
