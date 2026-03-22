# Project Research Summary

**Project:** Konma Xperience OS — v1.1 User Guide CMS
**Domain:** Admin-editable in-app guide system (internal knowledge base) on an existing NestJS + Next.js + Prisma v6 + PostgreSQL + Cloudflare R2 stack
**Researched:** 2026-03-22
**Confidence:** HIGH

---

## Executive Summary

This milestone adds an internal-facing CMS to an already-mature operations platform. The guide system is narrow by design: admins write structured role-specific guides, team members read them. It is emphatically not a public help center, a collaborative wiki, or an onboarding tooltip engine. The correct implementation pattern is a new NestJS `GuidesModule` with two Prisma models (`GuideSection`, `GuidePage`), a single new permission (`MANAGE_GUIDE`), and a Tiptap v3 editor on the frontend — all wired into the existing auth, storage, and permission infrastructure without any new services or infrastructure.

The recommended stack adds `@tiptap/react@^3.20.x` and `isomorphic-dompurify@^2.x` as the only new runtime dependencies of consequence. The Tiptap editor must be loaded exclusively via `next/dynamic({ ssr: false })` to prevent SSR crashes, and `jsdom` must be pinned to `25.0.1` via `package.json` overrides to fix a known ESM incompatibility in `isomorphic-dompurify`. Image uploads reuse the existing `StorageService` presign flow without any new backend infrastructure — only a new `presign-guide` endpoint and key prefix are needed.

The two most significant risks are security and performance. On security: rich text content must be sanitized with `isomorphic-dompurify` on every save (backend) and with `DOMPurify` on every render (frontend), and `@tiptap/extension-link` must be pinned to `>=2.10.4` to close CVE-2025-14284. On performance: the content storage column type is a deliberate decision that must be made before any data is written (see Content Storage Conflict Resolution below). Role-based content visibility must be enforced at the NestJS service layer, not the frontend — the API must never return sections outside the caller's role.

---

## Content Storage Conflict Resolution

STACK.md recommends `content Json` (PostgreSQL JSONB) to preserve Tiptap's ProseMirror JSON for clean round-trip editing. PITFALLS.md warns that JSONB triggers PostgreSQL's TOAST mechanism for values over ~2 KB, causing every UPDATE to copy the entire document — which is punishing when autosave is debounced at even 3 seconds.

**Recommendation: use `String @db.Text` and store serialised JSON as a text string.**

Rationale:
- `String @db.Text` stores the same `JSON.stringify(editor.getJSON())` output as the JSONB column would, but avoids JSONB binary-parse overhead on every read.
- The TOAST storage penalty (full document copy on every update) applies identically to large TEXT and JSONB values — but TEXT eliminates the additional JSONB binary parsing cost on top.
- Editor round-trip fidelity is preserved: `JSON.parse(content)` returns the full ProseMirror document, which loads cleanly into `useEditor({ content: parsedDoc })`.
- Structural JSON queries (`content->'paragraphs'`, GIN index) are not needed for this use case — full-text search runs against a separate `plain_text` extracted column or `tsvector`, not against JSONB paths.
- The trade-off vs pure `Json` type: Prisma will not type-check the content shape at compile time. Mitigate with a TypeScript type alias and a DTO that validates the content is valid JSON before persisting.

**Prisma schema:**
```prisma
model GuidePage {
  content    String  @db.Text   // JSON.stringify(editor.getJSON()) — not raw HTML
  ...
}
```

**Do not autosave on every Tiptap `onUpdate` event.** Use a debounced save (3–5 second minimum) that compares a hash of the current content to the last-saved hash before firing the PATCH request.

---

## Key Findings

### Recommended Stack

The feature is built entirely on the existing technology stack. No new services, databases, or infrastructure are introduced. New frontend dependencies are Tiptap v3 packages (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-placeholder`, `@tiptap/extension-typography`) and `isomorphic-dompurify`. The backend adds no new runtime dependencies — `Prisma Json` type (or `String @db.Text` per the conflict resolution) is native to the existing Prisma v6 + PostgreSQL setup.

**Core technologies (new additions only):**
- `@tiptap/react@^3.20.4`: Rich text editor — headless, SSR-safe with `immediatelyRender: false`, inherits shadcn/ui styling naturally. Must be loaded via `next/dynamic({ ssr: false })`.
- `@tiptap/starter-kit@^3.20.3`: Bundled extensions (headings, bold, italic, lists, link, undo/redo). In v3, `history` option renamed to `undoRedo`; do not mix v2 and v3 packages.
- `@tiptap/extension-image@^3.20.2`: Image node rendering. Does not handle uploads — upload logic is a custom toolbar button calling `/storage/presign-guide`.
- `isomorphic-dompurify@^2.x` + `jsdom` pinned to `25.0.1`: XSS sanitization in both NestJS (server) and Next.js (client/SSR) contexts. Pin jsdom via `package.json` overrides — v3.0.0+ breaks with Next.js due to ESM-only `require()`.
- `@tiptap/extension-link` pinned to `>=2.10.4`: Patches CVE-2025-14284 (`javascript:` href injection via link popover).

See `.planning/research/STACK.md` for full version compatibility table and installation commands.

### Expected Features

The MVP (v1.1) is tightly scoped. Every table-stakes feature reuses an existing system capability.

**Must have (table stakes — launch blockers):**
- Section CRUD with manual ordering (`sort_order Int`) and role visibility assignment (`role_codes String[]`)
- Page CRUD with Tiptap rich text editor and manual ordering
- R2 image upload from within the editor (reuses existing `StorageService` presign flow)
- Role-gated guide reader: team members see only sections mapped to their role code
- Admin content management UI under `(ops)/admin/guide/`
- Navigation sidebar in reader view (section tree + page list)
- Section and page published/draft toggle (`published Boolean`)
- Postgres full-text search across visible pages (`tsvector` on title + extracted plain text)

**Should have (differentiators — add after validation):**
- Admin preview as role (`?previewAs=ROLE` query param, no backend change)
- Role-personalized landing page (filters sections by authenticated user's role)
- `feature_slug` on sections + contextual "?" icon link in app feature headers
- MagicUI-styled reader experience (shimmer headers, border-beam section cards)
- "Was this helpful?" reaction on pages

**Defer to v2+:**
- Content versioning / revision history (only if admins report content regression)
- Interactive onboarding tooltips (separate product category — Appcues territory)
- PDF/print export via Puppeteer (browser `@media print` CSS covers 90% of the need)
- Collaborative real-time editing (team is 1–2 admins; last-write-wins is sufficient)

See `.planning/research/FEATURES.md` for full prioritisation matrix and competitor analysis.

### Architecture Approach

The guide system is a new NestJS module (`GuidesModule`) that integrates with the existing global guards (`JwtAuthGuard`, `PermissionsGuard`, `ThrottlerGuard`) without any changes to those guards. One new permission is added to the existing enum (`MANAGE_GUIDE`). Role filtering is enforced in `GuidesService`, not in the controller or frontend — the API never returns a section the caller cannot access. Two new Prisma models are added (`GuideSection`, `GuidePage`) with an additive-only migration (no `ALTER TABLE` on existing v1.0 tables).

**Major components:**
1. `GuidesModule` (NestJS) — `GuidesController` + `GuidesService` + DTOs. Follows the established module pattern from `assets/`, `events/`, `decisions/`, etc.
2. `/storage/presign-guide` endpoint (added to existing `StorageController`) — issues presigned R2 PUT URLs for guide images under the `guide/` key prefix. Requires `MANAGE_GUIDE` permission.
3. `GuideEditor` (React, loaded via `dynamic({ ssr: false })`) — Tiptap editor instance with image upload integration and save/publish controls. Admin-only.
4. `GuidePageRenderer` (React, read-only) — renders stored JSON content to HTML using `generateHTML()`. Zero Tiptap editor imports — never adds editor bundle cost to the reader view.
5. `GuidePageNav` + `GuideSectionCard` — reader navigation components; no editor dependency.
6. Admin route tree under `(ops)/admin/guide/` — section/page management UI, permission-gated by `hasPermission('MANAGE_GUIDE')`.
7. Reader route tree under `(ops)/guide/` — accessible to all authenticated roles; content filtered by role at the API layer.

See `.planning/research/ARCHITECTURE.md` for the full API surface, Prisma model definitions, data flow diagrams, and build-order sequence.

### Critical Pitfalls

The following pitfalls are all Phase 1 concerns — they must be resolved in the initial scaffold, not retrofitted later.

1. **SSR / hydration crash** — `useEditor()` calls browser DOM APIs during server render. Prevention: `immediatelyRender: false` in every `useEditor()` call AND `dynamic(() => import('...'), { ssr: false })` for the editor component. Both are required.

2. **Stored XSS via rich text** — `dangerouslySetInnerHTML` with unsanitized DB content is a stored XSS vector. Prevention: sanitize with `isomorphic-dompurify` on every save (backend) and with `DOMPurify` on every render (frontend). Pin `@tiptap/extension-link >=2.10.4` (CVE-2025-14284).

3. **Editor bundle bloat** — Tiptap adds 200–400 KB gzipped; if eagerly imported it inflates every page load. Prevention: `dynamic({ ssr: false })` ensures the editor chunk only loads on the admin edit route. The guide reader imports zero Tiptap editor packages — only `generateHTML` from `@tiptap/html` for server-side rendering if needed.

4. **Role visibility enforced only on the frontend** — any authenticated user can call the API directly and receive all guide content. Prevention: `GuidesService.findSections(roleCode)` applies `role_codes: { has: roleCode }` at the Prisma query level. Frontend filtering is supplementary UX only.

5. **Breaking Prisma migration on production** — the existing production DB has 22+ active tables. Prevention: the CMS migration must be additive-only (`CREATE TABLE` / `CREATE INDEX` only — no `ALTER TABLE` on existing tables). Verify with `prisma migrate status` against a production-equivalent DB before deploying.

6. **TOAST performance on content saves** — resolved by the content storage decision above (`String @db.Text` + debounced save with change-hash check). See Content Storage Conflict Resolution section.

7. **Orphaned R2 images** — images uploaded but not saved leave files in R2 with no reference. Prevention: set an R2 lifecycle rule on the `guide/pending/` prefix to auto-delete objects older than 24 hours, or track uploads in a `GuideImage` DB table.

See `.planning/research/PITFALLS.md` for full recovery strategies and a "looks done but isn't" verification checklist.

---

## Implications for Roadmap

Research points to a clean 4-phase structure driven by the dependency graph: schema must exist before backend, backend before frontend read views, and the editor last (it needs a real save target to be useful). All 8 pitfalls classified as "Phase 1" means the scaffold phase carries the most risk and must be the most carefully reviewed.

### Phase 1: Foundation — Schema, Backend API, and Security Decisions

**Rationale:** Every other phase depends on the Prisma schema being correct and the backend API being secure. The content storage column type (`String @db.Text`), role filtering, and sanitization must be locked in before any content is written — retrofitting these after data exists is expensive or impossible.

**Delivers:**
- `GuideSection` and `GuidePage` Prisma models with additive migration
- `MANAGE_GUIDE` permission added to enum and granted to `TECH_LEAD` in seed
- `GuidesModule`, `GuidesController`, `GuidesService` with all 9 CRUD endpoints
- Role filtering at the service layer (`role_codes: { has: roleCode }`)
- `isomorphic-dompurify` sanitization on every save operation
- `/storage/presign-guide` endpoint with MIME type validation

**Addresses features:** Section CRUD, Page CRUD, role-gated content, published/draft toggle

**Avoids pitfalls:** Breaking migration, role visibility bypass, stored XSS, TOAST performance cliff, image MIME type injection

**Research flag:** Standard patterns — NestJS module creation follows established codebase patterns (`assets/`, `decisions/`, etc.). No research-phase needed.

---

### Phase 2: Reader View — Staff-Facing Guide Experience

**Rationale:** Validating role filtering end-to-end requires a working reader UI. Building this before the editor forces the team to test the backend with real data (manually seeded), surfacing API issues before the editor is built on top of them.

**Delivers:**
- `/guide/page.tsx` — role-filtered section index
- `/guide/[sectionId]/[pageId]/page.tsx` — page read view with `GuidePageRenderer`
- `GuidePageNav` sidebar component
- `GuideSectionCard` component
- "Guide" nav item in `Sidebar.tsx` (visible to all roles)
- MagicUI styling on reader view (shimmer headers, border-beam cards)
- Client-side DOMPurify sanitization before `dangerouslySetInnerHTML`

**Addresses features:** Role-gated reader view, navigation sidebar, responsive mobile layout, MagicUI-styled reader experience

**Avoids pitfalls:** XSS on render, role visibility only on frontend

**Research flag:** Standard patterns — Next.js App Router page with data fetch. No research-phase needed.

---

### Phase 3: Admin CMS — Editor and Content Management UI

**Rationale:** The editor is built last among core features because it depends on both the backend save target (Phase 1) and the reader view (Phase 2) to validate the full author → read loop. The editor is also the highest-risk phase for SSR issues, bundle bloat, and React performance problems.

**Delivers:**
- `GuideEditor` component loaded via `dynamic({ ssr: false })` with:
  - Tiptap v3 (`StarterKit`, `Image`, `Placeholder`, `Typography`)
  - Image upload: toolbar button → `/storage/presign-guide` → R2 PUT → Tiptap `setImage()`
  - Debounced save (3–5s, hash-checked) writing `JSON.stringify(editor.getJSON())` to `String @db.Text`
  - Publish/unpublish toggle
  - `shouldRerenderOnTransaction: false` to prevent React re-render storms
- `GuideSectionForm` with `GuideRoleSelector` (multi-select of 8 role codes)
- Admin route tree under `(ops)/admin/guide/`
- "Guide Admin" nav item under admin section in `Sidebar.tsx` (gated by `hasPermission('MANAGE_GUIDE')`)
- Bundle analysis verification (`ANALYZE=true next build` — Tiptap must not appear in root layout)
- R2 lifecycle rule on `guide/pending/` prefix (orphan cleanup)

**Addresses features:** Admin content management UI, rich text editing with inline images, section visibility toggle

**Avoids pitfalls:** SSR hydration crash, editor bundle bloat, editor re-render on transaction, R2 orphaned images

**Research flag:** Standard patterns for the NestJS side. The Tiptap image upload wiring and `shouldRerenderOnTransaction` configuration are well-documented in official Tiptap docs. No research-phase needed, but the "looks done but isn't" checklist from PITFALLS.md should be run explicitly as a review step.

---

### Phase 4: Search and Polish

**Rationale:** Full-text search requires content to exist in the database (seeded in Phase 3). Sort reordering and admin preview are low-risk enhancements that are easier to add once the core CRUD is stable.

**Delivers:**
- Postgres `tsvector` full-text search on `GuidePage.title` + extracted plain text from content
- Search filtered by caller's visible sections (JOIN with role filter)
- Drag-to-reorder (or up/down arrow controls) for sections and pages (`sort_order` bulk PATCH)
- Admin preview-as-role (`?previewAs=ROLE` query param)
- `updated_at` + `updated_by` metadata displayed on each guide page
- Loading skeletons on reader index and page views
- Initial guide content seeded for each role via admin CMS

**Addresses features:** Full-text search, manual ordering, admin preview as role, "last edited" metadata

**Avoids pitfalls:** Loading full content in list views (search index uses extracted plain text, not full JSON), no index on slug/order (add `@@index` for sort_order)

**Research flag:** Postgres `tsvector` search is well-documented. `pg_trgm` trigram extension for fuzzy matching is a known pattern if needed post-launch. No research-phase needed unless the search spec expands to cross-model or full-app search.

---

### Phase Ordering Rationale

- Schema and backend first because every other component is blocked by it (dependency chain from ARCHITECTURE.md build order)
- Reader before editor because testing role filtering requires a UI, and the reader reveals API problems with zero editor complexity
- Editor in Phase 3 because it carries the highest risk (SSR, bundle, performance) and benefits from a stable backend beneath it
- Search and polish last because they require content to exist and are not launch-blockers
- All 8 critical pitfalls identified in PITFALLS.md resolve in Phase 1 or Phase 3 — neither Phase 2 nor Phase 4 introduce new critical risks
- The content storage decision (Text vs JSONB) is Phase 1 and irreversible after data is written — this is the single highest-priority pre-build decision

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified via npm and official Tiptap docs. Existing codebase (R2 presign flow, StorageService) confirmed as direct reference. jsdom pin requirement verified against Next.js community issue. |
| Features | HIGH | Table-stakes and anti-features based on well-established internal knowledge base patterns. Anti-features (versioning, tooltips, collaborative editing) are explicitly out of scope with clear rationale. |
| Architecture | HIGH | Module pattern follows 35 existing NestJS modules in the codebase. Prisma array filter (`has`) verified against Prisma v6 first-party docs. Service-layer role filtering pattern confirmed correct. |
| Pitfalls | HIGH (security/SSR/bundle), MEDIUM (R2 race, TOAST) | SSR, XSS, and CVE-2025-14284 verified with official sources and CVE records. TOAST performance cliff verified with Postgres-specialist benchmark sources. R2 lifecycle rule approach is community-consensus, not first-party R2 guidance. |

**Overall confidence:** HIGH

### Gaps to Address

- **R2 orphan cleanup strategy:** The two-prefix approach (pending → published on save) is the recommended pattern but adds complexity to the save operation. The simpler alternative (R2 lifecycle rule on `guide/` prefix, 24-hour TTL) is acceptable for MVP given the small team size. Decide before Phase 3 — not a blocker for Phase 1 or 2.

- **Search implementation detail:** PITFALLS.md flags that loading full content in list views is a performance trap. The `tsvector` column approach (with a separate `plain_text` extracted column, or a Postgres generated column) needs a schema decision in Phase 1. Recommend adding a nullable `search_vector tsvector` generated column to `GuidePage` in the initial migration rather than retrofitting it in Phase 4.

- **Admin preview security boundary:** The `?previewAs=ROLE` query param in admin preview must not reach the backend — it must be a pure frontend filter using already-fetched data (all sections visible to admin). If it triggers a new API call, it creates a potential role-spoofing vector. Confirm this is frontend-only during Phase 3 implementation.

- **Mobile editing UX:** Tiptap's fixed toolbar overflows on screens under 768px. PITFALLS.md recommends `BubbleMenu` for mobile. This is a UX decision — either restrict admin editing to desktop only (acceptable for internal tool) or implement `BubbleMenu`. Decide during Phase 3 scoping.

---

## Sources

### Primary (HIGH confidence)

- Tiptap v3 official docs (tiptap.dev) — SSR requirements, `immediatelyRender: false`, `shouldRerenderOnTransaction`, `generateHTML`, extension-image behavior, StarterKit v3 breaking changes
- Prisma v6 official docs (prisma.io) — `Json` field type, `String @db.Text`, array scalar filters (`has`, `hasSome`), migrate deploy vs migrate dev
- Tiptap GitHub Issue #5856 — SSR detection error and `immediatelyRender` requirement
- CVE-2025-14284 / Tiptap Incident Report (June 2025) — `@tiptap/extension-link <2.10.4` XSS via `javascript:` href
- Existing codebase: `backend/src/storage/storage.service.ts`, `backend/src/assets/`, `backend/src/decisions/` — confirmed integration patterns
- npm: `@tiptap/react@3.20.4`, `@tiptap/starter-kit@3.20.3`, `@tiptap/extension-image@3.20.2` — current versions confirmed

### Secondary (MEDIUM confidence)

- pganalyze: "5 mins of Postgres — JSONB TOAST performance cliff at 2KB" — TOAST threshold and UPDATE cost
- Evan Jones: "Postgres large JSON value query performance" — JSONB vs TEXT read performance comparison
- isomorphic-dompurify / Next.js jsdom@28 ESM breakage (Next.js GitHub discussions) — jsdom pin workaround
- Cloudflare R2 presigned URLs official docs — signed header behavior and `signQuery` pattern
- Liveblocks: "Which rich text editor framework should you choose in 2025" — Tiptap vs Plate comparison

### Tertiary (LOW confidence)

- Community guides on Tiptap bundle tree-shaking limitations (Tiptap GitHub Issue #3170) — `sideEffects: false` absence in ProseMirror packages

---

*Research completed: 2026-03-22*
*Ready for roadmap: yes*
