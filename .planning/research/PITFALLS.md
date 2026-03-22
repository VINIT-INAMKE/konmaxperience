# Pitfalls Research

**Domain:** Adding admin-editable rich text CMS (user guide / manual) to an existing NestJS + Next.js + Prisma v6 + PostgreSQL + R2 application
**Researched:** 2026-03-22
**Confidence:** HIGH (SSR/hydration, XSS, bundle size — verified with official sources and CVE records), MEDIUM (R2 upload race, TOAST performance — verified with official docs and benchmarks), MEDIUM (mobile editing — limited official guidance, community patterns)

---

## Critical Pitfalls

### Pitfall 1: Rich Text Editor SSR / Hydration Mismatch Crash

**What goes wrong:**
Tiptap (and all ProseMirror-based editors) depend on browser DOM APIs that do not exist in Node.js. When Next.js App Router server-renders a page that imports the editor, the process throws `window is not defined` or a React hydration mismatch: "Text content does not match server-rendered HTML." In the best case the page crashes silently. In the worst case React re-mounts and the editor loses draft content.

**Why it happens:**
Next.js App Router components default to server rendering. Developers add `'use client'` to the file but forget that `'use client'` marks a client boundary — it does not skip SSR. Tiptap's `useEditor()` hook by default calls `immediatelyRender: true`, which attempts to produce HTML on the server where no DOM exists. Additionally, importing Tiptap in a component that is part of an SSR-rendered tree (even via a `use client` file) can still cause issues if the parent is a Server Component.

**How to avoid:**
Two rules, both required:
1. Always pass `immediatelyRender: false` to `useEditor()` — this is now explicitly required by Tiptap's React integration docs.
2. Use `next/dynamic` with `ssr: false` to import the entire editor component: `const GuideEditor = dynamic(() => import('@/components/guide-editor'), { ssr: false })`. This prevents the bundle from being evaluated during server rendering at all.

The read-only viewer (which renders saved HTML) does not need the editor at all — use `dangerouslySetInnerHTML` with sanitization instead.

**Warning signs:**
- Error: "SSR has been detected, please set `immediatelyRender` explicitly to `false`"
- Hydration mismatch errors in the browser console after page load
- Editor content appears blank briefly then populates (flash of unstyled content)
- The editor component imports directly without `dynamic()`

**Phase to address:**
Phase 1 (editor scaffolding) — must be resolved before any content editing feature is built on top of it.

---

### Pitfall 2: XSS via Stored Rich Text (Rendering Without Sanitization)

**What goes wrong:**
Admin saves rich text content containing a malicious payload. Any user who views the guide page receives and executes that payload in their browser. Because admin accounts exist (and could be compromised), and because the content is stored in the database and served to all role groups, this is a stored XSS vulnerability with wide blast radius. It affects all 8 internal users who view guides.

**Why it happens:**
React's JSX escapes text by default, giving developers a false sense of security. But rich text output must be rendered as raw HTML — it is injected with `dangerouslySetInnerHTML`. Developers see "admin-only" editing and conclude sanitization is unnecessary. This ignores: compromised admin accounts, injected content in the DB from external paths, and the CVE-2025-14284 vulnerability in `@tiptap/extension-link` (versions below 2.10.4) where `javascript:` href payloads bypass editor validation entirely.

**How to avoid:**
Three layers are required:
1. **On save (backend, NestJS):** Sanitize with `isomorphic-dompurify` before persisting to DB. `DOMPurify` cannot run in plain Node.js without a DOM — `isomorphic-dompurify` bundles `jsdom` to handle this. Call `DOMPurify.sanitize(htmlContent)` in the guide content service before every `prisma.guideSection.create/update()`.
2. **On render (frontend):** Even though content is already sanitized in DB, sanitize again client-side with `DOMPurify` before passing to `dangerouslySetInnerHTML`. Defense in depth.
3. **Pin `@tiptap/extension-link` to >=2.10.4:** CVE-2025-14284 is patched in this version. Earlier versions allow `javascript:` URL injection via the link popover UI component.

Do not use `@tiptap/extension-link`'s `autolink` feature without `HTMLAttributes: { rel: 'noopener noreferrer nofollow' }` set.

**Warning signs:**
- No sanitization step in the NestJS guide content service
- `dangerouslySetInnerHTML` used directly with raw DB content
- `@tiptap/extension-link` version below 2.10.4 in `package.json`
- No CSP header blocking inline scripts in the app's response headers

**Phase to address:**
Phase 1 (backend content API) — sanitization must be in the save endpoint before any content is stored. Also Phase 2 if viewer component is built separately.

---

### Pitfall 3: Editor Bundle Bloating the Initial App Load

**What goes wrong:**
Tiptap plus its extensions (StarterKit, Image, Link, Placeholder, etc.) with ProseMirror internals adds 200–400 KB gzipped to the JavaScript bundle. If the editor is eagerly loaded on every page load — not just the admin guide editing page — every user in every role pays this cost on navigation, making the entire ops application noticeably slower.

**Why it happens:**
Tiptap's tree-shaking is incomplete: packages lack `"sideEffects": false` in their `package.json`, and ProseMirror packages are CommonJS, which bundlers cannot tree-shake. Even if you only import `StarterKit`, large transitive dependencies (ProseMirror tables, popper.js, tippy.js) can be included. Developers add the editor as a regular import and move on without checking bundle analyzer output.

**How to avoid:**
1. **Use `next/dynamic` with `ssr: false`** for all editor components — this code-splits the editor into a separate chunk loaded only when the edit page is visited.
2. **Import extensions individually** instead of the full `StarterKit` — e.g., `import Bold from '@tiptap/extension-bold'` instead of `StarterKit` which includes ~15 extensions.
3. **Never import the editor in the viewer** — the read-only guide viewer only needs to render HTML. It should have zero Tiptap imports.
4. **Run `next build` and check bundle analyzer** (`ANALYZE=true next build`) before shipping — the editor chunk should appear only under the admin edit route, not in the main app bundle.

**Warning signs:**
- Editor component imported with a regular `import`, not `dynamic()`
- `@tiptap/starter-kit` imported instead of per-extension imports
- Bundle analyzer shows Tiptap in the main `_app` or layout bundle
- First Contentful Paint on the main dashboard degrades after adding the editor

**Phase to address:**
Phase 1 (editor setup) — code-splitting architecture must be decided at the import stage. Retrofitting is possible but requires touching every import site.

---

### Pitfall 4: Image Upload Race Condition — Orphaned R2 Files

**What goes wrong:**
Admin uploads an image inside the editor. The flow is: (1) frontend requests a presigned R2 URL from the backend, (2) frontend uploads directly to R2, (3) Tiptap inserts the R2 URL into the document. If the admin abandons the edit (navigates away, closes the tab, decides not to publish), the image exists in R2 but is never referenced by any saved document. Over time, R2 accumulates orphaned images consuming storage with no cleanup path. The reverse also fails: if step 3 succeeds but step 1 of a later save fails, the document is saved with a broken image URL.

**Why it happens:**
Presigned URL upload is a two-step process with no guaranteed atomicity. The file lands in storage before the document record is written to the DB. There is no link between the upload event and the save event. Tiptap inserts the URL immediately after the upload succeeds, but the user may not click "save" for minutes or at all.

**How to avoid:**
Use a two-bucket / two-prefix strategy:
1. Uploaded images go to an `uploads/pending/` prefix in R2.
2. On document save, the backend parses the HTML content, extracts all image URLs, and moves referenced images from `uploads/pending/` to `uploads/published/` (using R2's copy-then-delete or a re-upload).
3. Set an R2 lifecycle rule on the `uploads/pending/` prefix to delete objects older than 24 hours. This is the automated orphan cleanup — no cron job needed in the app.
4. On document delete, move referenced images to `uploads/pending/` so they age out via the lifecycle rule rather than being deleted synchronously (avoids R2 API errors blocking the delete operation).

Alternatively (simpler for a small team): use a `GuideImage` table in the DB that records every upload event with `guide_section_id` nullable. A nightly cron marks nulled rows older than 24 hours as orphaned and deletes them from R2.

**Warning signs:**
- No orphan cleanup strategy documented
- Presigned URL is generated but no lifecycle rule exists on the R2 bucket
- Image URLs are directly inserted into the DB HTML without any save-time validation
- Testing only covers the happy path (upload → save immediately)

**Phase to address:**
Phase 1 (image upload integration) — the cleanup strategy must be designed at the same time as the upload flow. Retrofitting orphan cleanup to an existing bucket with hundreds of files is painful.

---

### Pitfall 5: Storing Large Rich Text Content as JSONB Causes TOAST Performance Cliff

**What goes wrong:**
Tiptap can output content in two formats: HTML string or ProseMirror JSON document. Storing as JSONB is tempting for queryability. But PostgreSQL's TOAST mechanism kicks in for any value over approximately 2 KB (the default page size threshold). For TOAST-stored values, every UPDATE — even changing a single character — copies the entire document value. A 50 KB guide page document incurs a full 50 KB copy on every keystroke save (autosave). Query performance for JSONB degrades 2–10x for documents over 2 KB compared to well-indexed text columns.

**Why it happens:**
JSONB is recommended for schemaless data. Developers store Tiptap's `editor.getJSON()` output as JSONB assuming it performs well. The TOAST threshold is not well-known. Autosave (saving on every change debounced 1–2 seconds) magnifies the write cost.

**How to avoid:**
Store content as PostgreSQL `TEXT` (not `JSONB`) and save the HTML output from `editor.getHTML()`, not the JSON. Reasons:
1. TEXT avoids JSONB binary-parsing overhead on read, which matters for content fetched frequently by viewers.
2. The content does not need to be queried structurally (no JSON path queries like `content->'paragraphs'`).
3. HTML is what the viewer needs anyway — no conversion step.
4. TOAST cost is the same for large TEXT vs JSONB, but TEXT avoids the JSONB binary parse overhead on top of it.

In Prisma schema: `content String @db.Text` (not `Json`).

Do not implement autosave that fires on every keystroke. Use debounced manual save or explicit "save" button. For autosave, debounce at 3–5 seconds minimum and only save when content has actually changed (compare hash or version).

**Warning signs:**
- Schema uses `content Json` or `content String @db.Json`
- Autosave fires on every Tiptap `onUpdate` event without debouncing
- No index on `updated_at` for recently-modified content queries
- Large guide documents (>10 KB) cause noticeable latency on save

**Phase to address:**
Phase 1 (schema design) — the column type decision must be made before any content is written. Changing from JSONB to TEXT after data exists requires a migration with content transformation.

---

### Pitfall 6: Editor Re-Renders on Every Transaction, Degrading React Performance

**What goes wrong:**
Tiptap's `useEditor()` hook by default causes a React re-render on every ProseMirror transaction (every keystroke, cursor move, selection change). If the component tree above the editor contains heavy components (the full ops layout, sidebar, role-based nav), the entire tree re-renders on every character typed. On mid-range hardware the editor becomes noticeably laggy. This is especially acute on Windows laptops and the mobile browser used by kitchen staff.

**Why it happens:**
`useEditor()` subscribes to all editor state changes and signals React on each one. Developers put the editor deep inside a large component without isolating it. The ops layout already has significant complexity from the existing v1.0 system, making the re-render cost higher than a greenfield app.

**How to avoid:**
1. Set `shouldRerenderOnTransaction: false` on `useEditor()` — this disables the default re-render-on-transaction behavior. Most toolbar state updates (bold active, heading level, etc.) can be driven by Tiptap's event system instead of React state.
2. Isolate the editor into its own leaf component that does not import or render any ops layout components.
3. Use `React.memo()` on toolbar buttons that read from editor state.
4. Test editing performance on a mid-range Android device (Chrome) and on the lowest-spec laptop available in the villa — not just the dev machine.

**Warning signs:**
- React DevTools profiler shows re-renders on every keystroke propagating to the sidebar or layout
- `shouldRerenderOnTransaction` not set
- Editor and toolbar in the same component as page-level layout
- Editing feels sluggish after 2–3 paragraphs of content

**Phase to address:**
Phase 1 (editor component architecture) — component isolation must be designed at the start. Extracting the editor from a deeply nested component later requires refactoring consumers.

---

### Pitfall 7: Role-Based Content Visibility Checked Only on Frontend

**What goes wrong:**
Guide sections have a `visibleToRoles` mapping — each team member should only see guides relevant to their role. If visibility filtering happens only in the Next.js UI (hiding sections the current user cannot see), an authenticated user can call the API directly with `GET /guide-sections` and receive all content regardless of their role. For a user guide with sensitive SOPs, pricing data, or workflow details meant for specific roles, this is an information disclosure issue.

**Why it happens:**
The ops frontend already enforces role visibility via conditional rendering. Developers carry that pattern over and add a `if (user.role !== 'ADMIN') return null` check in JSX, believing the UI layer is sufficient. The API is left unguarded.

**How to avoid:**
Enforce role filtering in the NestJS service layer. `GuideSection` records should carry a `allowedRoles: String[]` (or a junction table). The `GET /guide-sections` endpoint must append a `WHERE allowedRoles @> ARRAY[$userRole]` filter (or equivalent Prisma `hasSome`/`has` filter on a relation) before returning results. This is the same pattern as the v1.0 data-layer RBAC scoping (Pitfall 2 in the prior research). The frontend can then trust what it receives is already scoped — no extra filtering needed, no leakage risk.

The admin role must receive all sections unfiltered (admin creates and edits all guides).

**Warning signs:**
- `GET /guide-sections` returns the same result regardless of the authenticated user's role
- Visibility logic only in React `if` statements or `filter()` calls on the client
- No `allowedRoles` or equivalent field in the `GuideSection` Prisma model
- API test cases do not cover cross-role access attempts

**Phase to address:**
Phase 1 (NestJS guide module) — must be part of the initial API design, not a bolt-on. Retrofitting row-level filtering to an existing endpoint requires careful testing of all consumer paths.

---

### Pitfall 8: Adding the CMS Module Causes a Breaking Prisma Migration on the Production Database

**What goes wrong:**
The existing Konma Xperience production database has 22+ entities and active data from v1.0. A carelessly written Prisma migration that renames a column, changes a type, or drops a non-null constraint on an existing table can cause downtime or data loss during deployment. Even a migration that only adds new tables can fail if migration history is out of sync between the local dev branch and the production database.

**Why it happens:**
Developers run `prisma migrate dev` locally, which auto-generates migrations based on schema diffs. If the local database state does not exactly match production (e.g., manual schema changes were applied to production, or previous migrations were applied out of order), Prisma will generate a migration that makes incorrect assumptions about the current production state.

**How to avoid:**
1. The CMS module adds entirely new tables (`GuideSection`, `GuidePage`, `GuideImage`, etc.) — do not modify any existing v1.0 tables. This makes the migration additive-only and safe to apply without downtime.
2. All new columns must have defaults or be nullable — no new non-null columns without defaults on new tables either (seed data must run after schema migration).
3. Verify migration state with `prisma migrate status` against the production DB before deploying.
4. Use the expand-and-contract pattern from Prisma docs if any existing table must be modified.
5. Run `prisma migrate deploy` (not `migrate dev`) in the deployment pipeline.

**Warning signs:**
- Any `ALTER TABLE` in the migration SQL touching an existing v1.0 table
- Prisma migration shows "pending" or "failed" status on production before deploy
- `prisma db push` used instead of `prisma migrate deploy` in production
- New model has a required field with no default that would fail to insert without a seed

**Phase to address:**
Phase 1 (schema definition) — migration safety must be verified before deploying the first schema change to production.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing Tiptap JSON output as `Json` in Prisma instead of HTML as `Text` | Preserves editor fidelity, potentially re-parseable | JSONB TOAST penalty on large documents, every update copies the full value, no benefit over TEXT for this use case | Never — use TEXT + HTML output |
| Skipping backend sanitization because "admin-only editing" | Faster to build | Stored XSS risk if admin account is compromised; fails CVE-2025-14284 check | Never — sanitize on every save regardless of who edits |
| Eager-loading the editor on all routes (no `dynamic()`) | Simpler imports | 200–400 KB added to every page's JS budget | Never for production; acceptable for local dev only |
| No orphan image cleanup strategy | Simpler upload flow | R2 storage costs grow unbounded; no way to audit storage use | MVP acceptable if R2 lifecycle rule is set on the bucket; full DB-tracked cleanup needed at scale |
| Autosaving on every Tiptap `onUpdate` event | Real-time feel | Floods the DB with writes; TOAST copies on every keystroke; unnecessary API load | Never — minimum 3-second debounce with change detection |
| Role visibility only on frontend | Faster to build | Information disclosure via direct API calls | Never — data-layer filtering is mandatory |
| Skipping content versioning / revision history | Simpler schema | Admin can accidentally destroy guide content with no recovery path | Acceptable in MVP if a `previousContent` column stores the last saved version as a single-step undo |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cloudflare R2 presigned URLs | Including `Content-Type` in signed headers causes R2 to reject the browser upload (header mismatch) | Use `signQuery: true` with `aws4fetch`; sign only the host header; let the browser send Content-Type as an unsigned header |
| `isomorphic-dompurify` in NestJS | Calling DOMPurify without `clearWindow()` in long-running processes causes progressive jsdom memory growth | Call `DOMPurify.clearWindow()` periodically in the NestJS service, or after every sanitization batch |
| `@tiptap/extension-link` | Using version <2.10.4 allows `javascript:` href injection via the link popover UI | Pin to >=2.10.4; add `autolink: false` or configure `protocols` allowlist explicitly |
| Next.js `dangerouslySetInnerHTML` for guide viewer | Rendering DB content directly without sanitization even though "it was sanitized on save" | Always sanitize at render time with `DOMPurify` on the client; memoize the result to avoid re-sanitizing on every render |
| Prisma migration against production | Running `prisma migrate dev` in a CI pipeline that targets production | CI must use `prisma migrate deploy`; `migrate dev` is only for local development; it may reset or alter the migration history |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Editor re-renders on every ProseMirror transaction | Typing becomes laggy; React DevTools shows full tree re-render on each keystroke | Set `shouldRerenderOnTransaction: false`; isolate editor in a leaf component | Noticeable on mid-range hardware immediately; severe on mobile |
| Autosave firing on every `onUpdate` with large content | DB write storm; noticeable save latency; TOAST copies accumulating | Debounce at 3–5 seconds; only save when content hash has changed | Immediately on fast typists with large documents |
| Fetching all guide sections per page load without role filtering in SQL | Guide API slow as content grows; returns excess data to client | Apply `allowedRoles` filter in the Prisma query, not in JS after fetch | At 50+ guide sections (realistic for an 8-role system) |
| Loading full guide content body in list views | Guide index page slow; large payloads transferred for thumbnail/nav views | Select only `id, title, slug, updatedAt` for list queries; load full `content` only on individual page fetch | At 20+ guide sections with multi-KB content each |
| No index on `guideSection.slug` or `guideSection.order` | Guide nav renders slowly; sort operations run full table scans | Add `@@index([slug])` and `@@index([order])` in Prisma schema | Immediate correctness issue if slug is used for routing |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rendering guide HTML without sanitization (`dangerouslySetInnerHTML` with raw DB content) | Stored XSS affecting all 8 internal users | Sanitize with `isomorphic-dompurify` on save (backend) and `DOMPurify` on render (frontend) |
| Using `@tiptap/extension-link` <2.10.4 | CVE-2025-14284: `javascript:` href injection via link popover bypasses editor validation | Pin to >=2.10.4; verify with `npm list @tiptap/extension-link` |
| `GET /guide-sections` returning all sections regardless of caller's role | Information disclosure — kitchen staff sees admin SOPs, pricing guides, tech documentation | Add `allowedRoles` filter in NestJS service layer; data-layer enforcement, not UI-layer |
| Image upload endpoint accepting any MIME type | Executable files disguised as images stored in R2 | Validate `Content-Type` and magic bytes server-side; accept only `image/jpeg`, `image/png`, `image/webp`; do not rely on file extension |
| Admin guide edit API accessible to non-admin roles | Any authenticated user can overwrite guide content | NestJS `@Roles('FOUNDER_ADMIN')` guard on all write endpoints (`POST /guide-sections`, `PUT`, `DELETE`); MANAGE_GUIDES permission in the permission matrix |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Mobile editing with Tiptap toolbar on small screens | Toolbar overflows or wraps, blocking content; touch targets too small for finger taps | Use a minimal floating toolbar (Tiptap's `BubbleMenu`) for mobile that appears only on text selection; hide fixed toolbar on screens <768px |
| No visual distinction between draft and published guide content | Admin saves a draft, team members see incomplete/inaccurate guide | Add a `status: DRAFT | PUBLISHED` field; only show PUBLISHED content to non-admin roles; show a yellow banner on DRAFT pages in admin view |
| Editor toolbar with all available extensions shown at once | Admin overwhelmed; guide content becomes inconsistently formatted | Limit the toolbar to a curated subset: headings H2/H3, bold, italic, bullet list, numbered list, link, image — nothing else. No tables, no code blocks, no embeds. |
| No "last edited by / at" metadata on guide pages | Team cannot tell if a guide is current or stale | Show `updatedAt` and the editor's name prominently at the top of every guide page |
| Guide content not responsive for mobile viewers | Kitchen staff viewing a workflow guide on a phone see overflowing content | Apply Tailwind `prose` class with `max-w-full` and `overflow-hidden` to the viewer container; test every guide at 375px width |

---

## "Looks Done But Isn't" Checklist

- [ ] **Sanitization on save:** Verify the NestJS guide service calls `DOMPurify.sanitize()` before every `prisma.guideSection.create()` and `update()` — not just on creation.
- [ ] **Sanitization on render:** Verify the Next.js guide viewer sanitizes content client-side before `dangerouslySetInnerHTML` — not just trusting the DB value.
- [ ] **SSR guard:** Verify the editor component is loaded via `dynamic(() => import(...), { ssr: false })` — load the guide edit page with JS disabled to confirm it does not crash the server.
- [ ] **Bundle isolation:** Run `ANALYZE=true next build` and verify Tiptap chunks appear only under the admin edit route chunk, not in the root layout or main bundle.
- [ ] **Role-scoped API:** Verify that calling `GET /guide-sections` with a kitchen staff JWT returns only kitchen-role sections — not admin or pricing sections. Test with `curl` bypassing the UI.
- [ ] **Link extension version:** Run `npm list @tiptap/extension-link` — verify version is >=2.10.4.
- [ ] **R2 orphan cleanup:** Verify an R2 lifecycle rule or a `GuideImage` DB tracking table exists before the first image is uploaded to production.
- [ ] **Migration safety:** Verify the Prisma migration SQL contains only `CREATE TABLE` statements — no `ALTER TABLE` touching existing v1.0 tables.
- [ ] **Draft/publish gate:** Verify that a DRAFT guide section returns 404 (not 403) to non-admin roles — the existence of the draft should not be disclosed.
- [ ] **Image type validation:** Verify the presigned URL generation endpoint rejects non-image MIME types before issuing the URL — not just after the upload.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stored XSS discovered in guide content | HIGH | Take guide pages offline immediately; run a DB migration that passes all `content` fields through `DOMPurify.sanitize()` to clean stored payloads; redeploy with sanitization enforced; audit access logs for script execution events |
| Orphaned R2 images accumulated with no tracking | MEDIUM | Write a one-time script that lists all R2 objects under the guide prefix, cross-references against image URLs found in all `content` fields, and deletes unreferenced objects; set R2 lifecycle rules going forward |
| Wrong Prisma migration applied to production (modified existing table) | HIGH | Restore from the last pre-migration DB snapshot; replay only safe migrations; rebuild the CMS migration to be additive-only; verify against staging before re-deploying |
| Editor bundle leaked into root layout (performance regression) | MEDIUM | Move all editor imports behind `dynamic()` with `ssr: false`; verify with bundle analyzer; deploy; measure Core Web Vitals diff |
| Role visibility bypass discovered (non-admin reading restricted guides) | MEDIUM | Add `allowedRoles` filter to the NestJS service as a hotfix; audit which users made unscoped API calls via server logs; notify affected role owners if sensitive content was exposed |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SSR hydration mismatch | Phase 1 — editor scaffold | Load the edit page with JS disabled: server must not throw. Load with JS enabled: no hydration error in browser console. |
| XSS via stored rich text | Phase 1 — backend guide API + Phase 2 viewer component | Attempt to save `<script>alert(1)</script>` via the API; verify stored value has script stripped; verify viewer renders without executing script. |
| Editor bundle bloat | Phase 1 — editor component setup | `ANALYZE=true next build`; Tiptap must not appear in the main `/_app` chunk. |
| R2 image upload race / orphaned files | Phase 1 — image upload integration | Upload an image, do not save the document, wait 25h (or manually trigger lifecycle rule); verify file is gone from R2. |
| JSONB TOAST performance | Phase 1 — schema design | Schema must use `String @db.Text`, not `Json`. No migration required if caught before first data write. |
| Editor re-render on transaction | Phase 1 — editor component architecture | Open React DevTools profiler; type 10 characters; verify re-renders are isolated to the editor component only. |
| Role-scoped content bypass | Phase 1 — NestJS guide module | Call `GET /api/guide-sections` with a kitchen staff JWT; response must not include admin-only or pricing-role sections. |
| Breaking Prisma migration | Phase 1 — schema definition and deployment | `prisma migrate status` must show "all migrations applied" against a production-equivalent DB before deploy. Migration SQL must contain only `CREATE TABLE` / `CREATE INDEX`. |

---

## Sources

- Tiptap official Next.js integration docs (SSR, `immediatelyRender: false`): https://tiptap.dev/docs/editor/getting-started/install/nextjs
- Tiptap GitHub Issue #5856 — "SSR has been detected, please set `immediatelyRender` explicitly to `false`": https://github.com/ueberdosis/tiptap/issues/5856
- CVE-2025-14284 — XSS in `@tiptap/extension-link` <2.10.4 via `javascript:` href: https://security.snyk.io/vuln/SNYK-JS-TIPTAPEXTENSIONLINK-14222197
- Tiptap XSS Link Popover Incident Report (June 2025): https://tiptap.dev/docs/resources/incidents/06-25-2025-link-popover
- `isomorphic-dompurify` (server-side DOMPurify for NestJS / Node.js): https://github.com/kkomelin/isomorphic-dompurify
- Syncfusion: "How to Prevent XSS Attacks in React Rich Text Editor": https://www.syncfusion.com/blogs/post/react-rich-text-editor-xss-prevention
- pganalyze: "5 mins of Postgres — JSONB TOAST performance cliff at 2KB": https://pganalyze.com/blog/5mins-postgres-jsonb-toast
- Evan Jones: "Postgres large JSON value query performance": https://www.evanjones.ca/postgres-large-json-performance.html
- Tiptap performance guide (tree shaking, `shouldRerenderOnTransaction`): https://tiptap.dev/docs/guides/performance
- Tiptap GitHub Issue #3170 — "Popper/Tippy included in bundle despite not being used": https://github.com/ueberdosis/tiptap/issues/3170
- Cloudflare R2 presigned URLs official docs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Prisma expand-and-contract migration pattern: https://www.prisma.io/docs/guides/data-migration
- Prisma migrate deploy vs migrate dev (production guidance): https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
- Pragmatic Web Security: "Preventing XSS in React — dangerouslySetInnerHTML": https://pragmaticwebsecurity.com/articles/spasecurity/react-xss-part2

---
*Pitfalls research for: v1.1 User Guide CMS — adding admin-editable rich text guide system to existing Konma Xperience OS (NestJS + Next.js + Prisma v6 + PostgreSQL + R2)*
*Researched: 2026-03-22*
