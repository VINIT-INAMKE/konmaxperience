# Phase 17: Search, Preview, and Content Seeding - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Three capabilities: (1) full-text search across visible guide pages, (2) admin preview-as-role to verify content visibility, (3) comprehensive content seeding — real walkthroughs generated from the actual codebase covering all features including admin guide. No new editor features, no new reader features beyond search.

Requirements: READ-03, READ-04, SEED-01, SEED-02, SEED-03, SEED-04

</domain>

<decisions>
## Implementation Decisions

### Full-Text Search
- **D-01:** Global search overlay — Cmd+K / Ctrl+K style accessible from anywhere in the guide pages
- **D-02:** Search results display is Claude's discretion — dropdown, inline list, or dedicated overlay results
- **D-03:** Search uses Postgres tsvector for server-side full-text search (from research SUMMARY)
- **D-04:** Search results filtered by role — users only see results from sections they have access to
- **D-05:** Results should include page title, section name, and a text snippet with highlighted match

### Admin Preview-as-Role
- **D-06:** Role selector dropdown on the /guide index page — visible only when admin is logged in
- **D-07:** When a role is selected, the guide index filters sections to match that role's view exactly
- **D-08:** Preview is frontend-only — no backend role-spoofing. Admin fetches all sections, filters client-side
- **D-09:** Clear indicator showing "Previewing as: [Role Name]" with a button to return to admin view

### Content Seeding
- **D-10:** Full walkthroughs — every feature area gets 3-5 pages with detailed step-by-step instructions and tips
- **D-11:** Comprehensive coverage — all major features PLUS admin/system guide:
  - Expand existing: Kitchen Operations (3 pages → 5), POS & Orders (2 → 4), Inventory & Procurement (1 → 3), Missions & Tasks (1 → 4), Recipes & Menu (1 → 3)
  - New sections: Evidence & Approvals, Governance & Decisions, Analytics & Dashboard, Notifications, Events & Bookings, Customer Feedback, Admin & System Guide
- **D-12:** Admin & System Guide covers: user management, permissions, settings, delegations, system overview
- **D-13:** Content generated from actual codebase — Claude reads the real code to write accurate walkthroughs
- **D-14:** All sections pre-mapped to correct roles based on existing RBAC permissions
- **D-15:** All seeded content stored as Tiptap JSON, fully editable via the CMS built in Phase 16
- **D-16:** Seed data goes in prisma/seed.ts — idempotent, runs on every seed

### Claude's Discretion
- Search result display format (dropdown vs overlay vs inline)
- Search keyboard shortcut trigger component
- tsvector column implementation details (generated column vs trigger)
- Number of exact pages per section (within 3-5 range)
- Exact content of each walkthrough page
- How to structure the admin guide sections

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Guide System (Phases 14-16)
- `backend/src/guides/guides.service.ts` — GuidesService with CRUD, role filtering (add search endpoint here)
- `backend/src/guides/guides.controller.ts` — REST endpoints (add search endpoint here)
- `backend/prisma/schema.prisma` — GuideSection + GuidePage models (add search_text column here)
- `frontend/app/(ops)/guide/page.tsx` — Guide index page (add preview-as-role dropdown + search trigger here)
- `frontend/components/ops/guide/GuideSidebarSheet.tsx` — Sidebar (potential search trigger location)
- `backend/prisma/seed.ts` — Existing seed with 5 sections/8 pages (expand here)

### Research
- `.planning/research/SUMMARY.md` — Postgres tsvector recommendation, search filtering by role
- `.planning/research/ARCHITECTURE.md` — Search integration architecture

### Existing Codebase (for content generation)
- `backend/src/` — All backend modules (source for walkthrough content)
- `frontend/app/(ops)/` — All frontend pages (source for UI walkthrough content)
- `backend/src/types/roles.ts` — Role codes for role-to-section mapping
- `backend/src/types/permissions.ts` — Permission list for admin guide content

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Guide index page already renders role-filtered sections — preview-as-role can filter the same data client-side
- Existing seed.ts has the pattern for section/page creation (expand, don't rewrite)
- GuideProseRenderer already renders Tiptap JSON — seeded content uses same format
- Auth store has role info for the preview dropdown

### Established Patterns
- React Query for data fetching — search endpoint adds a new query
- Sidebar Sheet pattern — could host search trigger
- Dialog/Command pattern from shadcn for Cmd+K overlay
- Existing seed.ts uses `deleteMany` + `create` for idempotency

### Integration Points
- New backend endpoint: `GET /guide/search?q=&role_code=` (or similar)
- New migration: add `search_text` column to GuidePage
- Frontend: search overlay component + keyboard shortcut listener
- Frontend: role selector dropdown on guide index (admin only)
- Seed.ts: expand from 5 sections/8 pages to ~12 sections/40+ pages

</code_context>

<specifics>
## Specific Ideas

- User wants "rich UI, not some static bullshit" — search overlay should feel premium (like Cmd+K in Linear/Vercel)
- Content seeding is a REAL deliverable — these are actual walkthroughs staff will use, not placeholder text
- Admin guide is explicitly requested — covers the system administration features
- Existing 5 sections with 8 pages serve as the template for content quality and structure

</specifics>

<deferred>
## Deferred Ideas

- Search within page content (highlighting matches in the page) — Future
- Search suggestions / autocomplete — Future
- Content versioning — Future
- AI-assisted content updates — Future

</deferred>

---

*Phase: 17-search-preview-and-content-seeding*
*Context gathered: 2026-03-23*
