# Feature Research

**Domain:** In-app user guide / admin-editable manual CMS
**Researched:** 2026-03-22
**Confidence:** HIGH (core CMS patterns, RBAC content gating), MEDIUM (search implementation), HIGH (anti-features based on complexity analysis)

---

## Context: This Is Not a Generic Knowledge Base

Konma Xperience OS already has 8 roles, a polished ops UI, and 13 phases of built functionality. The v1.1 User Guide System is a narrow, internal-facing CMS whose sole job is: **admins write guides, team members read the guides for their role**.

This is not:
- A public help center (no anonymous access needed)
- A collaborative wiki (team members don't author content)
- A full CMS platform (no publishing pipelines, workflows, or localization)
- An onboarding wizard engine (no in-app tooltips or interactive flows)

Evaluation lens: what does a polished, admin-maintained internal guide system look like for an 8-person team that already has a production ops platform?

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that admins and team members assume exist. Missing = system feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Content CRUD for sections and pages | Admins must be able to create, edit, and delete guide content without code deployments | LOW | Sections = top-level categories (e.g. "Kitchen Ops", "POS"); Pages = individual step-by-step articles within a section |
| Rich text editing with inline images | Step-by-step guides require formatted text, numbered lists, screenshots, and callout blocks — plain text is unusable | MEDIUM | TipTap (ProseMirror-based) is the right choice: headless, Next.js-native, stores JSON in Postgres. No separate media server needed — images upload to R2, stored as embedded URLs in TipTap JSON |
| Role-to-section mapping (RBAC content gating) | A kitchen staff member must not see the founder's admin governance guide; a procurement role must not see kitchen KDS docs | MEDIUM | Many-to-many: each section can be visible to one or more roles. Roles already exist in the auth system — reuse, do not reinvent. Admin and tech roles see everything by default |
| Navigation sidebar / table of contents | Users need to browse the guide tree without search — sidebar with section headings and page titles is the standard mental model | LOW | Mirroring GitBook / Notion-style left nav; section collapsed/expanded state; active page highlight |
| Manual ordering of sections and pages | Admin must control the sequence in which content appears — default alphabetical sort is wrong for learning paths | LOW | Integer `position` field on both Section and Page entities. Frontend drag-to-reorder in the admin editor, PATCH endpoint to bulk-update positions |
| Admin content management UI | A dedicated CMS interface (separate from the guide reader view) where admins can manage all sections and pages | MEDIUM | Two modes: read mode (what team members see) and edit mode (admin only). Route-guarded by admin/tech role |
| Basic full-text search within guides | Users need to find a specific workflow without browsing the full tree | MEDIUM | PostgreSQL tsvector on page title + plain-text content is sufficient for this data size (tens to low hundreds of pages). No Elasticsearch needed. Postgres already in the stack |
| Responsive read view for mobile | Team members may reference guides on phones in the kitchen or on the floor | LOW | Next.js responsive layout; guide reader is a content-display page, not a complex interactive UI |
| Image upload via R2 | Screenshots and diagrams are essential for step-by-step guides | LOW | R2 is already the storage layer for evidence and assets — reuse the presign flow. Images stored as R2 URLs embedded in TipTap JSON content |

---

### Differentiators (Competitive Advantage)

Features that make this guide system genuinely useful for Konma Xperience OS rather than feeling like a generic wiki tacked on.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Role-personalized landing page | When a team member opens the guide, they see only their role's sections — no clutter from irrelevant domains. "Your Guide" not "All Guides" | LOW | Filter sections by authenticated user's role on the landing page. Reuses existing auth context. Single query with role join |
| Feature-area anchoring (guide sections mirror app sections) | Guide sections map 1:1 to the app's navigation areas (POS, Kitchen, Inventory, Missions, etc.) so users can jump from a feature to its guide contextually | LOW | Naming convention and optional `feature_slug` field on Section entity. Future use: "?" icon in app feature headers links to the matching guide section |
| Step-numbered page layout | Workflow walkthroughs render numbered steps with visual hierarchy — not a wall of text. Admin sets numbered steps in TipTap; reader renders them with step indicators | LOW | TipTap's ordered list extension + custom step block extension. Cosmetic differentiation that makes content feel intentional |
| Admin preview (read-as-role) | Admin can preview exactly what a specific role sees before publishing — prevents publishing guide pages that are invisible to the intended audience | LOW | Preview mode passes `?previewAs=ROLE` query param, filters sections by that role. No backend change needed |
| MagicUI-styled reader experience | Guide pages rendered with MagicUI components (shimmer headers, border-beam section cards, smooth transitions) — not a plain white document | LOW | Pure frontend work; the reader view is a Next.js page with existing MagicUI components. High visual impact, low implementation cost |
| Section visibility toggle (publish/draft) | Admin can author a section and keep it hidden until content is ready — prevents team from seeing half-finished guides | LOW | Boolean `published` field on Section. Toggle in admin UI. Reader query filters to `published = true` |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Content versioning / revision history | "We want to track every change to a guide page" | For an 8-person internal tool with infrequent content updates, full version history adds schema complexity (version tables, diff rendering, rollback UI) with near-zero practical benefit. Who is rolling back guide content? | Store `updated_at` and `updated_by` on Page — shows last edit context. Full versioning is v2 only if admins report content regression problems |
| Onboarding wizard / interactive tooltips | "Instead of a guide, let's walk users through the app step-by-step" | Interactive tooltips require per-feature mounting logic in every app component, maintenance on every UI change, and a separate tooltip state engine. This is a different product (Appcues, Intercom Product Tours) entirely | A well-structured guide with screenshots is 80% as useful and 5% of the implementation cost. Build the guide system first; add tooltips in a future phase if adoption data justifies it |
| Collaborative editing (multiple admins editing simultaneously) | "What if two admins edit the same page?" | With 1-2 admins (Founder + Tech), concurrent editing collisions are extremely rare. WebSocket/CRDT collaboration adds significant complexity | Last-write-wins with `updated_at` timestamp. Show a warning if a page was saved by someone else since you opened it. Sufficient for the team size |
| Multilingual content | "Should we support guides in multiple languages?" | Single language team at a single villa node. Localization infrastructure (locale keys, translation workflows, per-locale content) is irrelevant overhead | English only for v1. Add locale field to Section/Page if a second language is ever needed — no structural change required |
| Comment / discussion threads on guide pages | "Team members should be able to ask questions in the guide" | Feedback on guide content goes to the admin, not to all team members. A comment system on guide pages becomes a support channel with notification complexity | Provide a simple "Was this helpful? [yes/no]" reaction button (LOW complexity) as a feedback signal. Direct questions go to the admin through existing notification flow |
| Automatic export to PDF / print | "We want to print the SOPs" | PDF generation (Puppeteer, @react-pdf/renderer) adds a server-side rendering dependency for a feature that will be used rarely. Browser print CSS achieves 90% of the outcome | Apply `@media print` CSS to the guide reader view. Users can browser-print any guide page. No build step needed |
| AI-generated guide content | "Can the system write the guides automatically?" | This is an internal tool where content quality directly reflects how well the team understands their role. Auto-generated text for a specialized food ops system will be generic and wrong | Admin writes the guides. This is the right behavior — guide quality is a function of admin effort, not automation |
| Full-text search with fuzzy matching / typo tolerance | "Search should handle typos like 'recip' for 'recipe'" | Postgres tsvector with `pg_trgm` trigram extension handles similarity matching adequately. Elasticsearch adds operational infrastructure (separate service, ETL sync, index management) for a guide corpus that will be at most a few hundred pages | Use Postgres tsvector for exact and prefix matching. Add `pg_trgm` if typo tolerance is requested post-launch. Both are native Postgres, zero new infrastructure |

---

## Feature Dependencies

```
[Auth / RBAC (existing)]
    └──required by──> [Role-to-section mapping]
    └──required by──> [Admin content management UI]
    └──required by──> [Role-personalized landing page]

[Section entity (CRUD + ordering + published flag)]
    └──required by──> [Page entity]
    └──required by──> [Navigation sidebar]
    └──required by──> [Role-to-section mapping]
    └──required by──> [Section visibility toggle]

[Page entity (CRUD + ordering + TipTap content)]
    └──required by──> [Rich text editing]
    └──required by──> [Full-text search]
    └──required by──> [Guide reader view]

[R2 presign flow (existing)]
    └──required by──> [Image upload in TipTap]

[TipTap editor]
    └──required by──> [Rich text editing]
    └──required by──> [Image upload in TipTap] (via TipTap Image extension)

[Guide reader view]
    └──enhances──> [Feature-area anchoring] (contextual links from app to guide)
    └──enhances──> [MagicUI styling]

[Full-text search]
    └──requires──> [Page entity] (needs content indexed)
    └──independent of──> [Role-to-section mapping] (search filters by visible sections at query time)
```

### Dependency Notes

- **Section before Page:** The section entity must exist before page CRUD is built. Sections are the navigation containers; pages are content leaves.
- **Auth reuse is critical:** Do not build a separate permission model for guides. Reuse the existing `role` field on the User entity and the existing RBAC guards on NestJS controllers. Map sections to roles via a `SectionRole` join table.
- **R2 already works:** The presign upload flow exists from the evidence and assets modules. The TipTap image extension points to the same R2 presign endpoint — no new storage infrastructure.
- **Search is independent of RBAC at the index level:** Index all page content in Postgres. Filter search results by the authenticated user's visible sections at query time using a JOIN. Do not maintain separate per-role search indexes.
- **Feature-area anchoring is a soft dependency:** The `feature_slug` field on Section can be added from day one as a nullable field. The contextual "?" icon integration in app feature headers is a future enhancement — the guide system does not depend on it.

---

## MVP Definition

### Launch With (v1.1)

Minimum viable guide system — what admins need to author content and what team members need to read it.

- [ ] Section CRUD with manual ordering and role assignment — the content container
- [ ] Page CRUD with TipTap rich text editor (bold, italic, headings, lists, images) and manual ordering — the content unit
- [ ] R2 image upload from TipTap editor — screenshots are essential for step-by-step guides
- [ ] Role-gated guide reader (team member sees only their role's sections) — the core access control
- [ ] Admin content management UI with section/page tree — where guides are authored
- [ ] Navigation sidebar in reader view — how users browse guides
- [ ] Section published/draft toggle — allows admin to stage content before revealing it
- [ ] Postgres full-text search across visible pages — how users find specific content

### Add After Validation (v1.1.x)

- [ ] Admin preview as role — add after first complaint about publishing invisible content
- [ ] `feature_slug` on sections + contextual "?" link in app headers — add after guide adoption shows team actually uses the guide
- [ ] "Was this helpful?" reaction on pages — add after content library is populated enough to need quality signals
- [ ] `pg_trgm` trigram similarity for search — add if users report search missing expected results

### Future Consideration (v2+)

- [ ] Version history / revision audit — only if admins report content regression problems
- [ ] Interactive onboarding tooltips — only if guide adoption data shows users are not reading guide pages
- [ ] PDF/print export via Puppeteer — only if team physically prints SOPs regularly
- [ ] Collaborative editing — only if team grows beyond 2 admin-level users

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Section CRUD + ordering + role mapping | HIGH | LOW | P1 |
| Page CRUD + ordering | HIGH | LOW | P1 |
| TipTap rich text editor | HIGH | MEDIUM | P1 |
| R2 image upload in editor | HIGH | LOW | P1 |
| Role-gated reader view | HIGH | LOW | P1 |
| Admin management UI | HIGH | MEDIUM | P1 |
| Navigation sidebar | HIGH | LOW | P1 |
| Section published/draft toggle | MEDIUM | LOW | P1 |
| Full-text search (Postgres tsvector) | MEDIUM | MEDIUM | P1 |
| MagicUI-styled reader experience | MEDIUM | LOW | P1 |
| Admin preview as role | MEDIUM | LOW | P2 |
| Feature-area anchoring (feature_slug) | MEDIUM | LOW | P2 |
| "Was this helpful?" reaction | LOW | LOW | P2 |
| pg_trgm search improvement | LOW | LOW | P2 |
| Version history | LOW | HIGH | P3 |
| Interactive tooltips / onboarding wizard | MEDIUM | HIGH | P3 |
| PDF export | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

The closest analogues are internal knowledge base tools, not public help centers or full CMS platforms.

| Feature | GitBook | Notion | Confluence | Konma Guide Approach |
|---------|---------|--------|------------|----------------------|
| Content hierarchy | Section → Page (linear) | Nested pages (unlimited) | Space → Page → Subpage | Section → Page (two levels, deliberately flat — deep nesting creates navigation confusion in a small team) |
| Rich text editor | Block-based, drag-and-drop | Block-based, flexible | Proprietary WYSIWYG | TipTap (ProseMirror) — standard, extensible, Next.js native |
| Role-based visibility | Audience scoping on collections | Workspace permissions | Space permissions + page-level | Role-to-section mapping via join table — reuses existing 8-role system |
| Search | Algolia-powered | Basic full-text | Confluence search | Postgres tsvector — sufficient for tens of pages, zero new infrastructure |
| Ordering | Drag-and-drop in sidebar | Manual or alphabetical | Manual | Integer position field + drag-and-drop in admin UI |
| Draft / publish | Yes (branch-based) | Toggle | Draft → Published workflow | Simple `published` boolean on Section — right-sized for internal tool |
| Versioning | Git-based branching | Page history | Page history | `updated_at` + `updated_by` only for v1.1; full history is anti-feature at this scale |
| Onboarding wizards | Not built-in | Not built-in | Requires plugin | Deliberately excluded — guide pages are the onboarding format |
| Deployment | SaaS | SaaS | SaaS/Cloud | Embedded in existing NestJS/Next.js app — no separate service |

**Key differentiation from all of the above:** This guide system lives inside the product, authenticated by the same JWT/RBAC system, and displays only the content relevant to the logged-in user's role. No external service, no separate login, no iframe.

---

## Dependencies on Existing System Features

| Existing Feature | How Guide System Uses It | Risk |
|-----------------|--------------------------|------|
| Auth / JWT / roles | Gate all guide read/write routes by role. SectionRole join table references the existing role enum | LOW — roles are stable, enum values are defined |
| R2 presign upload | TipTap image extension calls the existing `/storage/presign` endpoint | LOW — endpoint exists and works |
| NestJS module system | Guide feature = new NestJS module (GuideModule) following existing module pattern | LOW — established pattern in codebase |
| Prisma schema | New models: `GuideSection`, `GuidePage`, `GuideSectionRole`. Additive migration, no changes to existing models | LOW — additive only |
| MagicUI component library | Reader view uses existing shimmer, border-beam, magic-card components | LOW — already installed |
| Notification system | No dependency for v1.1. Could notify team of new guide sections in v1.1.x | NONE for v1.1 |

---

## Sources

- [10 Best Knowledge Base Software Tools 2026 — Text.com](https://www.text.com/blog/top-10-knowledge-base-software/)
- [Internal Wiki Best Practices 2025 — Docsie](https://www.docsie.io/blog/articles/establishing-an-effective-internal-wiki-for-your-organization/)
- [28 Best Knowledge Base Software Reviewed 2026 — People Managing People](https://peoplemanagingpeople.com/tools/best-knowledge-base-software/)
- [Notion vs GitBook: Which is Better for Documentation? — Archbee](https://www.archbee.com/blog/notion-vs-gitbook)
- [Confluence vs GitBook — Archbee](https://www.archbee.com/blog/confluence-vs-gitbook)
- [PostgreSQL Full-Text Search vs Elasticsearch — Neon](https://neon.com/blog/postgres-full-text-search-vs-elasticsearch)
- [Why we replaced Elasticsearch with Postgres Full-Text Search — Blockost](https://blog.blockost.com/why-we-replaced-elasticsearch-with-postgres-full-text-search/)
- [Tiptap Editor Docs — tiptap.dev](https://tiptap.dev/docs)
- [Which rich text editor framework should you choose in 2025? — Liveblocks](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [User Onboarding Checklists Best Practices — Appcues](https://www.appcues.com/blog/best-checklist-examples)
- [SaaS User Manual Template & Guide 2026 — ProProfs](https://www.proprofskb.com/blog/create-user-manual-for-saas/)
- [Custom Knowledge Base Pros and Cons 2025 — Docsie](https://www.docsie.io/blog/articles/custom-knowledge-bases-pros-and-cons/)

---

*Feature research for: Konma Xperience OS v1.1 — in-app user guide / admin-editable manual CMS*
*Researched: 2026-03-22*
