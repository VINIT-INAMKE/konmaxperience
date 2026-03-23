---
phase: 17-search-preview-and-content-seeding
verified: 2026-03-23T07:00:00Z
status: passed
score: 18/18 must-haves verified
gaps: []
human_verification:
  - test: "Cmd+K / Ctrl+K opens search overlay on /guide/* route"
    expected: "CommandDialog opens, typing returns matching guide pages with highlighted snippets"
    why_human: "Keyboard event dispatch and overlay open state cannot be verified statically"
  - test: "Admin role selector filters section grid"
    expected: "Selecting 'Backend Lead' shows only sections with BACKEND_LEAD in role_codes, amber banner appears"
    why_human: "Client-side state filtering and banner render require live browser session"
  - test: "Running prisma db seed against a real database"
    expected: "12 sections and 39 pages inserted, seed succeeds twice without error (idempotency)"
    why_human: "Seed execution requires live PostgreSQL connection"
---

# Phase 17: Search, Preview, and Content Seeding Verification Report

**Phase Goal:** Users can search across their visible guides, admins can preview content as any role, and the system ships with real guide content covering all major feature areas
**Verified:** 2026-03-23T07:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /guide/search?q=kitchen returns matching pages with snippets | VERIFIED | `@Get('search')` in guides.controller.ts:28, `searchPages` in service:252, `websearch_to_tsquery` called with ts_headline snippets |
| 2 | Non-admin users only see results from sections matching their role_codes | VERIFIED | Non-admin branch uses `s.role_codes @> ARRAY[${roleCode}]::text[]` filter at guides.service.ts:293 |
| 3 | Admin users see results from all published sections | VERIFIED | Admin branch omits role_codes filter; uses only `to_tsvector @@ websearch_to_tsquery` at guides.service.ts:259 |
| 4 | Queries under 2 characters return empty array without hitting database | VERIFIED | `if (!query \|\| query.trim().length < 2) return []` at guides.service.ts:253; unit tests confirm $queryRaw not called |
| 5 | Snippets contain mark tags wrapping matched text | VERIFIED | `ts_headline` uses `StartSel=<mark>,StopSel=</mark>` params; `mark` added to ALLOWED_TAGS in sanitizeContent; globals.css:200 styles mark element |
| 6 | Pressing Cmd+K or Ctrl+K on any /guide/* route opens the search overlay | VERIFIED | GuideSearchOverlay.tsx:42 handles `(e.metaKey \|\| e.ctrlKey) && e.key === 'k'`; guide layout.tsx mounts overlay for all /guide/* routes |
| 7 | Typing a query shows matching pages with title, snippet, and section badge | VERIFIED | GuideSearchResultItem.tsx renders pageTitle, dangerouslySetInnerHTML snippet, Badge with sectionTitle |
| 8 | Clicking a result navigates to the guide page and closes the overlay | VERIFIED | GuideSearchOverlay.tsx:102-107 calls `router.push('/guide/' + r.sectionSlug + '/' + r.pageSlug)` then `setOpen(false)` |
| 9 | Admin user sees role selector dropdown on /guide index page | VERIFIED | page.tsx:134 renders Select inside `{isAdmin && (` guard; isAdmin = FOUNDER_ADMIN or TECH_LEAD |
| 10 | Selecting a role filters the section grid to that role's view | VERIFIED | page.tsx:35-37 `displaySections = previewRole ? sections.filter(s => s.role_codes.includes(previewRole)) : sections`; grid renders `displaySections.map` |
| 11 | Amber 'Previewing as' banner appears when a role is selected | VERIFIED | page.tsx:158-160 `{previewRole && <GuidePreviewBanner previewRole={previewRole} onReset={() => setPreviewRole(null)} />}`; banner uses `bg-amber-500/10` |
| 12 | Non-admin users do not see the role selector or preview banner | VERIFIED | Both Select and GuidePreviewBanner wrapped in `{isAdmin && ...}` and `{previewRole && ...}` guards; non-admin never sets previewRole |
| 13 | Running prisma db seed creates 12 guide sections with 39+ guide pages | VERIFIED | seed.ts lists exactly 12 sections (250-1520); slug count = 51 (12 sections + 39 pages); console.log prints '12 guide sections with 39+ pages' |
| 14 | Every major feature area has a section | VERIFIED | Kitchen, POS & Orders, Inventory & Procurement, Recipes & Menu, Missions & Tasks, Evidence & Approvals, Governance & Decisions, Analytics & Dashboard, Notifications, Events & Bookings, Customer Feedback, Admin & System Guide — all confirmed in seed.ts |
| 15 | Each section has 2-5 pages with real step-by-step walkthroughs | VERIFIED | Counts: Kitchen=5, POS=4, Inventory=3, Recipes=3, Missions=4, Evidence=3, Governance=3, Analytics=3, Notifications=2, Events=3, Feedback=2, Admin=4; content uses specific field names, workflow steps from actual codebase |
| 16 | Sections role_codes use only valid RoleCode enum values | VERIFIED | Zero instances of PRODUCTION_LEAD or FRONTEND_EXPERIENCE_LEAD; `grep -c` returns 0 for stale codes |
| 17 | Seed is idempotent | VERIFIED | seed.ts:1631-1632 runs `tx.guidePage.deleteMany({})` then `tx.guideSection.deleteMany({})` before creating — deleteMany+create pattern is idempotent |
| 18 | All seeded content uses valid Tiptap JSON format | VERIFIED | doc() helper at seed.ts:227 returns `JSON.stringify({ type: 'doc', content })`; builder helpers p(), h2(), h3(), ul(), ol(), li(), liBold() all produce correct Tiptap node objects |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/prisma/schema.prisma` | search_text column on GuidePage model | VERIFIED | Line 790: `search_text String @default("")` |
| `backend/prisma/migrations/20260323051500_add_guide_search_text/migration.sql` | ALTER TABLE, trigger, GIN index | VERIFIED | Full migration present: ADD COLUMN, backfill, trigger function, DROP/CREATE TRIGGER, GIN index on `to_tsvector('english', search_text)` |
| `backend/src/guides/guides.service.ts` | searchPages method with tsvector query | VERIFIED | searchPages at line 252, websearch_to_tsquery at lines 268-302, SearchResult interface at line 9 |
| `backend/src/guides/guides.controller.ts` | GET /guide/search endpoint | VERIFIED | `@Get('search')` at line 28, placed before `@Get('sections')` at line 36, uses `@Query('q')` |
| `backend/src/guides/__tests__/guides.service.search.spec.ts` | 6 unit tests for search | VERIFIED | All 6 tests present: empty string, single char, null, admin query, non-admin query, sanitize snippets |
| `frontend/components/ui/command.tsx` | shadcn Command component | VERIFIED | CommandDialog exported at line 188; imports from cmdk |
| `frontend/components/ops/guide/GuideSearchOverlay.tsx` | CommandDialog with Cmd+K, debounce, query | VERIFIED | CommandDialog, 300ms debounce via useEffect, (metaKey\|ctrlKey)&&key==='k', useQuery calling /guide/search |
| `frontend/components/ops/guide/GuideSearchResultItem.tsx` | Result row with title, snippet, badge | VERIFIED | CommandItem, pageTitle, dangerouslySetInnerHTML snippet, Badge with sectionTitle |
| `frontend/components/ops/guide/GuidePreviewBanner.tsx` | Amber preview banner | VERIFIED | bg-amber-500/10, "Previewing as:", "Back to your view" button, ROLE_DISPLAY_NAMES map |
| `frontend/app/(ops)/guide/layout.tsx` | Guide layout mounting GuideSearchOverlay | VERIFIED | Imports and renders `<GuideSearchOverlay />` alongside `{children}` |
| `frontend/app/(ops)/guide/page.tsx` | Guide index with role selector and banner | VERIFIED | previewRole state, isAdmin guard, Select with all 8 roles, GuidePreviewBanner, displaySections filter |
| `frontend/lib/types/guides.ts` | GuideSearchResult interface | VERIFIED | Line 48: `export interface GuideSearchResult` with all 6 fields |
| `backend/prisma/seed.ts` | 12 sections with 39+ pages of real content | VERIFIED | 51 slugs (12 section + 39 page), computeReadTime function, doc/p/h2/h3 builder helpers, no stale role codes |
| `frontend/app/globals.css` | mark element styling | VERIFIED | Line 200: `mark {` block with transparent background, #9E7AFF color, font-weight 600 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/src/guides/guides.controller.ts` | `backend/src/guides/guides.service.ts` | `this.guidesService.searchPages` | WIRED | controller.ts:31 calls `this.guidesService.searchPages(q, user.roleCode)` |
| `backend/src/guides/guides.service.ts` | `prisma.$queryRaw` | tsvector full-text search SQL | WIRED | service.ts:259,281 use tagged template $queryRaw with websearch_to_tsquery |
| `frontend/components/ops/guide/GuideSearchOverlay.tsx` | `/guide/search?q=` | `apiClient.get` in useQuery | WIRED | overlay.tsx:54-56 calls `apiClient.get<GuideSearchResult[]>('/guide/search?q=' + encodeURIComponent(debouncedQuery))` |
| `frontend/app/(ops)/guide/page.tsx` | `GuidePreviewBanner` | previewRole state | WIRED | page.tsx:158-160 renders `<GuidePreviewBanner previewRole={previewRole} onReset={...} />` when previewRole is truthy |
| `frontend/app/(ops)/guide/layout.tsx` | `GuideSearchOverlay` | component mount | WIRED | layout.tsx:7 mounts `<GuideSearchOverlay />` for all /guide/* routes |
| `backend/prisma/seed.ts` | Tiptap JSON format | doc() builder function | WIRED | seed.ts:227-228 `doc()` returns `JSON.stringify({ type: 'doc', content })` — compatible with GuideProseRenderer |
| `backend/prisma/seed.ts` | Valid RoleCode enum values | role_codes arrays | WIRED | All sections use only: FOUNDER_ADMIN, TECH_LEAD, BACKEND_LEAD, FRONTEND_LEAD, BI_LEAD, PROCUREMENT_LEAD, TALENT_LEAD, DESIGN_OUTREACH_LEAD — zero stale codes confirmed |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| READ-03 | 17-01-PLAN, 17-02-PLAN | User can search across all visible guide pages via full-text search | SATISFIED | GET /guide/search?q= endpoint wired; tsvector search with role filtering; Cmd+K overlay consuming it |
| READ-04 | 17-02-PLAN | Admin/tech can preview the guide as any role to verify content visibility | SATISFIED | previewRole state, Select dropdown with 8 roles, displaySections client-side filter, GuidePreviewBanner |
| SEED-01 | 17-03-PLAN | System ships with pre-written guide sections for all major feature areas | SATISFIED | 12 sections seeded covering Kitchen, POS, Inventory, Recipes, Missions, Evidence, Governance, Analytics, Notifications, Events, Feedback, Admin |
| SEED-02 | 17-03-PLAN | Each section contains step-by-step workflow walkthroughs from actual codebase | SATISFIED | Content references real controller endpoints, DTO fields, UI workflows; no placeholder text |
| SEED-03 | 17-03-PLAN | Sections are pre-mapped to correct roles per RBAC permissions | SATISFIED | Kitchen uses BACKEND_LEAD/PROCUREMENT_LEAD; Admin uses FOUNDER_ADMIN/TECH_LEAD only; etc. |
| SEED-04 | 17-03-PLAN | All seeded content is editable by admin post-deployment | SATISFIED | Content stored as Tiptap JSON in GuidePage.content field — same field written by CMS editor (Phase 16) |

No orphaned requirements found. All 6 Phase 17 requirement IDs (READ-03, READ-04, SEED-01, SEED-02, SEED-03, SEED-04) are claimed in plan frontmatter and verified in code.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/components/ops/guide/GuideSearchOverlay.tsx` | 72 | `placeholder="Search guides..."` | Info | React input placeholder attribute — not a stub, legitimate UX text |

No blockers or warnings found. The single "placeholder" grep hit is a legitimate HTML input placeholder attribute, not a content stub. All implementations are substantive and fully wired.

---

### Human Verification Required

#### 1. Search overlay keyboard shortcut

**Test:** Open the app, navigate to /guide, press Cmd+K (Mac) or Ctrl+K (Windows/Linux)
**Expected:** CommandDialog opens with "Search guides" title and input focused; type "kitchen" and see results appear within 500ms with highlighted text in purple (#9E7AFF) and section badges
**Why human:** Keyboard event listener behavior and overlay open/close state transitions require a live browser

#### 2. Admin role preview flow

**Test:** Log in as FOUNDER_ADMIN or TECH_LEAD, navigate to /guide index page, select "Backend Lead" from the "Preview as role" dropdown
**Expected:** Section grid filters to only sections where role_codes includes BACKEND_LEAD; amber banner appears saying "Previewing as: Backend Lead"; clicking "Back to your view" restores all sections
**Why human:** Client-side state filtering and DOM rendering require a live browser

#### 3. Seed database execution

**Test:** Run `cd backend && npx prisma db seed` against a real PostgreSQL database, then run it a second time
**Expected:** First run: 12 sections and 39 pages inserted, no errors; second run: identical result (idempotent — deleteMany clears prior data then recreates)
**Why human:** Requires live PostgreSQL database connection

---

### Commit Verification

All commits documented in SUMMARY files are confirmed present in git log:

| Commit | Plan | Description |
|--------|------|-------------|
| `871e95f` | 17-01 | feat(17-01): add tsvector search infrastructure and cmdk component |
| `d4e3ea1` | 17-01 | test(17-01): add unit tests for guide search endpoint |
| `235d189` | 17-02 | feat(17-02): add search overlay, result item, and guide layout |
| `3e1a2d3` | 17-02 | feat(17-02): add preview-as-role dropdown, banner, and search trigger on guide index |
| `4d09564` | 17-03 | feat(17-03): expand guide seed to 12 sections with 39 pages of real content |

---

## Summary

Phase 17 goal is fully achieved. All three plans delivered substantive, wired implementations:

**Plan 01 (Search Infrastructure):** PostgreSQL tsvector search is live with search_text column, trigger-based sync, GIN index, role-based query branching, sanitized snippets with mark tags, and 6 passing unit tests. The shadcn Command component is installed.

**Plan 02 (Search Overlay + Preview):** The GuideSearchOverlay mounts globally via the guide layout, handles Cmd+K/Ctrl+K with a 300ms debounce and React Query, and renders results with highlighted snippets and section badges. The admin preview-as-role dropdown with amber banner and client-side section filtering is fully implemented and gated to admin roles only.

**Plan 03 (Content Seeding):** seed.ts expanded from 5 sections / 8 pages to 12 sections / 39 pages of real walkthrough content using Tiptap builder helpers. Stale role codes eliminated. Word-count-based read time calculation replaces the JSON length heuristic. All content is stored as valid Tiptap JSON editable via the Phase 16 CMS editor. Seed is idempotent via deleteMany + create.

---

_Verified: 2026-03-23T07:00:00Z_
_Verifier: Claude (gsd-verifier)_
