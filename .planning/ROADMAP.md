# Roadmap: Konma Xperience OS

## Milestones

- ✅ **v1.0 MVP** - Phases 1-13 (shipped 2026-03-22)
- 🚧 **v1.1 User Guide & Data Management** - Phases 14-20 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-13) - SHIPPED 2026-03-22</summary>

13 phases, 56 plans, 99 tasks. Full audit in `.planning/milestones/v1.0-MILESTONE-AUDIT.md`.

</details>

### 🚧 v1.1 User Guide & Data Management (In Progress)

**Milestone Goal:** In-app user guide CMS with role-based access + bulk data import/export across the entire system.

**Phase Numbering:**
- Integer phases (14-20): Planned milestone work
- Decimal phases (14.1, 15.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 14: Foundation** - Schema, backend API, role filtering, and security hardening (completed 2026-03-22)
- [ ] **Phase 15: Reader View** - Staff-facing guide experience with role-gated content
- [ ] **Phase 16: Admin CMS** - Tiptap rich text editor with image upload and content management UI
- [ ] **Phase 17: Search, Preview, and Content Seeding** - Full-text search, admin preview-as-role, and real guide content generated from codebase
- [ ] **Phase 18: Data Export** - CSV/XLSX export for 22 report types across all modules
- [ ] **Phase 19: Master Data Import** - Bulk import for ingredients, vendors, and vendor pricing
- [ ] **Phase 20: Operations Import** - Bulk import for stock, recipes, menu, events, tasks, quests, KPIs

## Phase Details

### Phase 14: Foundation
**Goal**: Backend API delivers complete CRUD for guide sections and pages with role-based filtering enforced at the service layer and XSS-safe content sanitization
**Depends on**: v1.0 (Phase 13) -- existing auth, RBAC, storage, and Prisma infrastructure
**Requirements**: GUIDE-01, GUIDE-02, GUIDE-03, GUIDE-04, GUIDE-05, EDIT-04
**Success Criteria** (what must be TRUE):
  1. Admin can create, read, update, and delete guide sections and pages via API (verified with curl/Postman)
  2. API returns only sections whose role_codes array includes the caller's role -- non-matching sections are never returned
  3. Draft pages are excluded from non-admin API responses; admin sees both draft and published
  4. Sections and pages respect sort_order in API responses (ascending)
  5. Content containing `<script>` or `javascript:` hrefs is stripped on save and never stored in the database
**Plans**: 2 plans

Plans:
- [x] 14-01-PLAN.md -- Infrastructure: Prisma schema, migration, MANAGE_GUIDE permission, GuidesModule scaffold, presign-guide endpoint
- [x] 14-02-PLAN.md -- Implementation: DTOs, GuidesService CRUD with role filtering and XSS sanitization, GuidesController endpoints, unit tests

### Phase 15: Reader View
**Goal**: Authenticated team members can browse and read guide pages filtered to their role in a polished, navigable UI
**Depends on**: Phase 14
**Requirements**: READ-01, READ-02, READ-05
**Success Criteria** (what must be TRUE):
  1. User navigating to /guide sees only guide sections assigned to their role, with no visibility of other roles' sections
  2. User can click into a section and read pages rendered with styled headings, lists, images, and callout blocks using MagicUI components
  3. A persistent sidebar shows the section tree with page links, allowing navigation without returning to the index
**Plans**: TBD

Plans:
- [ ] 15-01: TBD
- [ ] 15-02: TBD

### Phase 16: Admin CMS
**Goal**: Admins can author and edit rich guide content with inline images, callout blocks, and publish controls through a polished editor UI
**Depends on**: Phase 15
**Requirements**: EDIT-01, EDIT-02, EDIT-03
**Success Criteria** (what must be TRUE):
  1. Admin can open a guide page in the editor, type rich text (headings, bold/italic, lists, links), and see changes persist after save and page reload
  2. Admin can upload an image from the editor toolbar, see it appear inline in the content, and confirm it renders in the reader view
  3. Admin can insert styled callout blocks (tip, warning, info) that render distinctly in both editor and reader views
  4. Tiptap editor bundle does not appear in the reader view's JavaScript bundle (verified via build analysis or network tab)
**Plans**: TBD

Plans:
- [ ] 16-01: TBD
- [ ] 16-02: TBD
- [ ] 16-03: TBD

### Phase 17: Search, Preview, and Content Seeding
**Goal**: Users can search across their visible guides, admins can preview content as any role, and the system ships with real guide content covering all major feature areas
**Depends on**: Phase 16
**Requirements**: READ-03, READ-04, SEED-01, SEED-02, SEED-03, SEED-04
**Success Criteria** (what must be TRUE):
  1. User can type a search query and see matching guide pages filtered to their visible sections, with results appearing within 500ms
  2. Admin can select any role from a preview dropdown and see the guide index filtered exactly as that role would see it
  3. On fresh deployment, every major feature area (Kitchen, POS, Inventory, Recipes, Missions, Evidence, and others) has a pre-written guide section with step-by-step walkthroughs
  4. Seeded sections are correctly mapped to the roles that use those features (e.g., Kitchen guides visible to PRODUCTION_LEAD)
  5. Admin can edit any seeded content through the CMS editor -- seeded content is not read-only or special-cased
**Plans**: TBD

Plans:
- [ ] 17-01: TBD
- [ ] 17-02: TBD
- [ ] 17-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 14 -> 14.x -> 15 -> 15.x -> 16 -> 16.x -> 17 -> 17.x -> 18 -> 18.x -> 19 -> 19.x -> 20

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 14. Foundation | v1.1 | 2/2 | Complete    | 2026-03-22 |
| 15. Reader View | v1.1 | 0/? | Not started | - |
| 16. Admin CMS | v1.1 | 0/? | Not started | - |
| 17. Search, Preview, and Content Seeding | v1.1 | 0/? | Not started | - |
| 18. Data Export | v1.1 | 0/? | Not started | - |
| 19. Master Data Import | v1.1 | 0/? | Not started | - |
| 20. Operations Import | v1.1 | 0/? | Not started | - |

### Phase 18: Data Export
**Goal**: CSV/XLSX export endpoints for all major report types — orders, revenue, analytics, waste logs, recipes, menu pricing, stock levels, stock movements, POs, vendor pricing, ingredients, vendors, feedback, events, guest lists, tasks, KPIs, decisions, leaderboard (22 report types)
**Depends on**: v1.0 (Phase 13) -- existing analytics, orders, inventory, kitchen, procurement services
**Requirements**: TBD (to be defined during planning)
**Success Criteria** (what must be TRUE):
  1. User can download CSV/XLSX from any report page via export button
  2. Exports respect role-based access — users only export data they can view
  3. Date range filtering available on time-series exports (orders, waste, stock movements)
  4. XLSX files have proper column headers, formatting, and sheet names
**Plans**: TBD

Plans:
- [ ] 18-01: TBD
- [ ] 18-02: TBD
- [ ] 18-03: TBD

### Phase 19: Master Data Import
**Goal**: Bulk CSV/XLSX import for foundation data — ingredients, vendors, and vendor pricing with validation, error reporting, and preview before commit
**Depends on**: Phase 18 -- shared CSV/XLSX library infrastructure
**Requirements**: TBD (to be defined during planning)
**Success Criteria** (what must be TRUE):
  1. Admin can upload a CSV/XLSX of ingredients and see a preview table with validation errors highlighted
  2. Admin can upload a vendor roster with contact details in bulk
  3. Admin can upload vendor price lists with ingredient name resolution
  4. Invalid rows are reported with clear error messages, valid rows can be committed separately
  5. Import respects existing data — duplicate detection by name
**Plans**: TBD

Plans:
- [ ] 19-01: TBD
- [ ] 19-02: TBD

### Phase 20: Operations Import
**Goal**: Bulk CSV/XLSX import for operational data — opening stock, recipes, menu items, events, tasks, quests, KPIs with dependency ordering and entity resolution
**Depends on**: Phase 19 -- shared import infrastructure, master data must exist
**Requirements**: TBD (to be defined during planning)
**Success Criteria** (what must be TRUE):
  1. Admin can upload opening stock levels with ingredient + zone name resolution
  2. Admin can upload recipes with BOM lines (two-sheet format: recipes + lines)
  3. Admin can upload menu items with recipe and category name resolution
  4. Admin can bulk-create events, tasks, quests, and KPIs from spreadsheets
  5. Dependency ordering enforced — import rejects if required master data is missing
**Plans**: TBD

Plans:
- [ ] 20-01: TBD
- [ ] 20-02: TBD
- [ ] 20-03: TBD
