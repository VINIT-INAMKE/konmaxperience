# Roadmap: Konma Xperience OS

## Milestones

- ✅ **v1.0 MVP** - Phases 1-13 (shipped 2026-03-22)
- ✅ **v1.1 User Guide, Data Management & Commerce Foundations** - Phases 14-28 (complete 2026-03-27; Phases 25 and 26 not built — see notes)
- 🚧 **v2.0 Mission OS + Marketplace** - Phases 29-35 (P0 spec sync done 2026-08-22; Phase 29 next). Canonical spec: `/SPEC.md`

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-13) - SHIPPED 2026-03-22</summary>

13 phases, 56 plans, 99 tasks. Full audit in `.planning/milestones/v1.0-MILESTONE-AUDIT.md`.

</details>

### ✅ v1.1 User Guide, Data Management & Commerce Foundations (Phases 14-28) - COMPLETE 2026-03-27

**Milestone Goal:** In-app user guide CMS with role-based access + bulk data import/export across the entire system; grew to include chat, recipe builder, Razorpay + customer auth, customer marketplace v1, mission-flow gap closure and recipe preparation types.

**Honest status notes (from the 2026-08-22 audit):**
- **Phase 25 (Third-Party Delivery Integration): NOT BUILT.** No code exists for Porter or Shiprocket and no plans were ever written, despite this file previously reporting "4/4 plans complete". Superseded by v2.0 Phase 33 (P5 Shiprocket shipments).
- **Phase 26 (Order Detail Page): NOT BUILT.** Phase directory is empty; no `/orders/[id]` staff page exists. Folded into v2.0 Phase 34 (staff Orders screen with refunds).
- All other phases (14-24, 27, 28) shipped with code and summaries. Phase 28-05 code landed in commit `49086da`.

- [x] **Phase 14: Foundation** - Schema, backend API, role filtering, and security hardening (completed 2026-03-22)
- [x] **Phase 15: Reader View** - Staff-facing guide experience with role-gated content (completed 2026-03-22)
- [x] **Phase 16: Admin CMS** - Tiptap rich text editor with image upload and content management UI (completed 2026-03-22)
- [x] **Phase 17: Search, Preview, and Content Seeding** - Full-text search, admin preview-as-role, and real guide content generated from codebase (completed 2026-03-23)
- [x] **Phase 18: Data Export** - CSV/XLSX export for 22 report types across all modules (completed 2026-03-23)
- [x] **Phase 19: Master Data Import + Export Gaps + Timezone** - Bulk import, missing exports (missions/quests), IST timezone (completed 2026-03-23)
- [x] **Phase 20: Operations Import** - Bulk import for stock, recipes, menu, events, tasks, quests, KPIs (completed 2026-03-23)
- [x] **Phase 21: In-App Chat** - Real-time 1-1 and group messaging with Pusher.js, role-scoped visibility (completed 2026-03-23)
- [x] **Phase 22: Recipe Page Redesign** - Full-page recipe builder, dnd-kit BOM, live cost, approval workflow, versioning (completed 2026-03-24)
- [x] **Phase 23: Razorpay Payments + Customer Auth** - WhatsApp OTP customer identity, Razorpay for events and POS, webhooks (completed 2026-03-25)
- [x] **Phase 24: Customer Marketplace** - Redis cart, /menu ordering, Razorpay checkout, Pusher tracking, addresses, receipts (completed 2026-03-26)
- [ ] **Phase 25: Third-Party Delivery Integration** - NOT BUILT; superseded by v2.0 Phase 33
- [ ] **Phase 26: Order Detail Page** - NOT BUILT; folded into v2.0 Phase 34
- [x] **Phase 27: Mission Flow & Assessment Gap Closure** - Mission-control API, PO→Task linking, activity feed, team contribution, Today's Focus (completed 2026-03-27)
- [x] **Phase 28: Recipe preparation_type** - scratch/batch_prepared/ready_to_sell/assemble routing, Pick & Pack, supply usage, DB ingredient categories (completed 2026-03-27)

### 🚧 v2.0 Mission OS + Marketplace (Phases 29–35)

**Milestone Goal (SPEC.md §1.1):** One system, not two — operational events produce mission evidence and readiness signals automatically, approval gates execute, four meters are derived from ops state. Every role lands on "what I must move today". A full Konma-only storefront (prepared food, packaged products shipped via Shiprocket, experiences, merchandise) with one catalog, cart, checkout, accounts, reviews, coupons, loyalty, search, desktop + SEO. No money or account at risk from a known defect; CI gates every change; `Node` and enums from day one.

**Phase Numbering:**
- **P0 (Canonical spec + planning sync) is already done** — `SPEC.md` committed 2026-08-22; this roadmap, PROJECT.md and REQUIREMENTS.md synced; `contextdocs*/` marked historical. No phase number.
- Integer phases 29-35 map to SPEC.md §11 sub-projects P1-P6 (P5 split into backend and frontend phases).
- Decimal phases (29.1, 30.1): urgent insertions (marked with INSERTED).
- Branch: `v2-os-marketplace`. Each phase: plan → parallel subagents by module → CI green → walk-through → summary.

- [ ] **Phase 29: Stop the Bleeding (P1)** - 14 Critical/High defects fixed with regression tests, config validation, safe seeds, error boundaries, test suite green, CI enforcing
- [x] **Phase 30: Platform Foundation (P2)** - Fresh migration baseline: Node, Prisma enums, AuditEvent, Task.subject, ApprovalPolicy, timestamptz, CHECKs, Product replacing MenuItem, new seeds *(complete 2026-08-23 at `fc49c19`)*
- [ ] **Phase 31: Mission Bridge (P3)** - Domain events, MissionBridgeService, derived meters + snapshots + history, policy-generated approvals, recipe approval via policy, decision votes
- [ ] **Phase 32: Role-Aware IA + Identity (P4)** - Persistent header, spine nav, ModuleAccess, /tasks, My Quests, sheets, chips, motion allowlist, brand tokens light + dark, Pusher on kitchen screens, usage events
- [ ] **Phase 33: Marketplace Backend (P5a)** - Catalog, mixed-fulfilment quote/checkout/confirm, FulfilmentService, Shiprocket + shipments, coupons, loyalty, reviews, search, refunds
- [ ] **Phase 34: Marketplace Storefront + Staff Commerce (P5b)** - Storefront routes (desktop + SEO), cart/checkout UI, account, staff Catalog/Promotions/Reviews/Shipments/Orders/Experiences/Customers screens
- [ ] **Phase 35: Run-It Layer (P6)** - WhatsApp nudges, daily close, theoretical vs actual food cost, usage dashboard, AI evidence-review assist + morning brief (human-in-the-loop)

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
**Plans**: 2 plans

Plans:
- [x] 15-01-PLAN.md -- Dependencies, types, sidebar nav, section index page (/guide), and section detail page (/guide/[sectionSlug])
- [x] 15-02-PLAN.md -- Page reading view with Tiptap prose renderer, callout blocks, page header, and sidebar navigation overlay

### Phase 16: Admin CMS
**Goal**: Admins can author and edit rich guide content with inline images, callout blocks, and publish controls through a polished editor UI
**Depends on**: Phase 15
**Requirements**: EDIT-01, EDIT-02, EDIT-03
**Success Criteria** (what must be TRUE):
  1. Admin can open a guide page in the editor, type rich text (headings, bold/italic, lists, links), and see changes persist after save and page reload
  2. Admin can upload an image from the editor toolbar, see it appear inline in the content, and confirm it renders in the reader view
  3. Admin can insert styled callout blocks (tip, warning, info) that render distinctly in both editor and reader views
  4. Tiptap editor bundle does not appear in the reader view's JavaScript bundle (verified via build analysis or network tab)
**Plans**: 2 plans

Plans:
- [x] 16-01-PLAN.md -- Admin guide management page with section list, CRUD forms, reorder, and sidebar nav entry
- [x] 16-02-PLAN.md -- Tiptap rich text editor with toolbar, bubble menu, image upload, callouts, autosave, and publish workflow

### Phase 17: Search, Preview, and Content Seeding
**Goal**: Users can search across their visible guides, admins can preview content as any role, and the system ships with real guide content covering all major feature areas
**Depends on**: Phase 16
**Requirements**: READ-03, READ-04, SEED-01, SEED-02, SEED-03, SEED-04
**Success Criteria** (what must be TRUE):
  1. User can type a search query and see matching guide pages filtered to their visible sections, with results appearing within 500ms
  2. Admin can select any role from a preview dropdown and see the guide index filtered exactly as that role would see it
  3. On fresh deployment, every major feature area (Kitchen, POS, Inventory, Recipes, Missions, Evidence, and others) has a pre-written guide section with step-by-step walkthroughs
  4. Seeded sections are correctly mapped to the roles that use those features (e.g., Kitchen guides visible to BACKEND_LEAD)
  5. Admin can edit any seeded content through the CMS editor -- seeded content is not read-only or special-cased
**Plans**: 3 plans

Plans:
- [x] 17-01-PLAN.md -- Backend search infrastructure: Prisma migration with tsvector trigger and GIN index, search endpoint with role filtering, unit tests, shadcn Command install
- [x] 17-02-PLAN.md -- Frontend search overlay (Cmd+K CommandDialog), preview-as-role dropdown with amber banner, search triggers, guide layout
- [x] 17-03-PLAN.md -- Content seeding: expand seed.ts from 5 sections/8 pages to 12 sections/39+ pages of real walkthrough content

## Progress

**Execution Order:**
v1.1 (done): 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22 -> 23 -> 24 -> 27 -> 28 (25, 26 never executed).
v2.0: 29 -> 30 -> 31 -> 32 -> 33 -> 34 -> 35. Phase 33 may run in parallel with Phase 32 once Phase 31 is complete; Phase 34 needs both.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 14. Foundation | v1.1 | 2/2 | Complete    | 2026-03-22 |
| 15. Reader View | v1.1 | 2/2 | Complete    | 2026-03-22 |
| 16. Admin CMS | v1.1 | 2/2 | Complete    | 2026-03-22 |
| 17. Search, Preview, and Content Seeding | v1.1 | 3/3 | Complete    | 2026-03-23 |
| 18. Data Export | v1.1 | 7/7 | Complete    | 2026-03-23 |
| 19. Master Data Import | v1.1 | 3/3 | Complete    | 2026-03-23 |
| 20. Operations Import | v1.1 | 5/5 | Complete    | 2026-03-23 |
| 21. In-App Chat | v1.1 | 4/4 | Complete    | 2026-03-23 |
| 22. Recipe Page Redesign | v1.1 | 4/4 | Complete    | 2026-03-24 |
| 23. Razorpay Payments + Customer Auth | v1.1 | 4/4 | Complete    | 2026-03-25 |
| 24. Customer Marketplace | v1.1 | 4/4 | Complete    | 2026-03-26 |
| 25. Third-Party Delivery Integration | v1.1 | 0/0 | Not built (superseded by Phase 33) | — |
| 26. Order Detail Page | v1.1 | 0/0 | Not built (folded into Phase 34) | — |
| 27. Mission Flow & Assessment Gap Closure | v1.1 | 5/5 | Complete    | 2026-03-27 |
| 28. Recipe preparation_type | v1.1 | 5/5 | Complete    | 2026-03-27 |
| 29. Stop the Bleeding (P1) | v2.0 | 0/? | Not started | — |
| 30. Platform Foundation (P2) | v2.0 | 0/? | Not started | — |
| 31. Mission Bridge (P3) | v2.0 | 0/? | Not started | — |
| 32. Role-Aware IA + Identity (P4) | v2.0 | 0/? | Not started | — |
| 33. Marketplace Backend (P5a) | v2.0 | 0/? | Not started | — |
| 34. Marketplace Storefront + Staff Commerce (P5b) | v2.0 | 0/? | Not started | — |
| 35. Run-It Layer (P6) | v2.0 | 0/? | Not started | — |

### Phase 18: Data Export
**Goal**: CSV/XLSX export for all 22 report types with server-side file generation, R2 storage, export history, and export buttons on 13 data pages
**Depends on**: v1.0 (Phase 13) -- existing analytics, orders, inventory, kitchen, procurement services
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-04, EXPORT-05, EXPORT-06, EXPORT-07, EXPORT-08, EXPORT-09, EXPORT-10, EXPORT-11
**Success Criteria** (what must be TRUE):
  1. User can download CSV/XLSX from any report page via export button
  2. Exports respect role-based access — users only export data they can view
  3. Date range filtering available on time-series exports (orders, waste, stock movements)
  4. XLSX files have proper column headers, formatting, and sheet names
  5. Multi-sheet XLSX for Purchase Orders and Recipes (header + line items)
  6. Admin can view export history at /admin/exports with re-download capability
**Plans**: 7 plans

Plans:
- [x] 18-01-PLAN.md -- Foundation: ExportRecord Prisma model, ExportsModule skeleton, StorageService putObjectDirect, export type config
- [x] 18-02-PLAN.md -- Financial/analytics export builders: Orders, Revenue Summary, Top Items, Channel Breakdown, Recipe Costs
- [x] 18-03-PLAN.md -- Inventory/procurement export builders: Inventory Levels, Stock Movements, Purchase Orders (multi-sheet), Vendor Pricing
- [x] 18-04-PLAN.md -- Kitchen/F&B export builders: Waste Log, Prep Batches, Ingredients, Vendors, Recipes (multi-sheet)
- [x] 18-05-PLAN.md -- Menu/events/feedback export builders: Menu Items, Feedback, Events, Event Guest Lists
- [x] 18-06-PLAN.md -- Operations/intelligence export builders: Tasks, KPIs, Decision Log, Leaderboard
- [x] 18-07-PLAN.md -- Frontend: ExportButton + ExportDialog on 13 pages, admin exports history page, sidebar nav

### Phase 19: Master Data Import + Export Gaps + Timezone
**Goal**: Bulk CSV/XLSX import for foundation data (ingredients, vendors, vendor pricing) with drag-drop upload, preview table, inline editing, and schema-strict validation; plus missing export builders (missions, quests), ExportButton on all remaining pages, and IST timezone verification
**Depends on**: Phase 18 -- shared CSV/XLSX library infrastructure
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, EXPORT-12, EXPORT-13, TZ-01
**Success Criteria** (what must be TRUE):
  1. Admin can upload a CSV/XLSX of ingredients and see a preview table with validation errors highlighted
  2. Admin can upload a vendor roster with contact details in bulk
  3. Admin can upload vendor price lists with ingredient name resolution
  4. Invalid rows are reported with clear error messages, valid rows can be committed separately
  5. Import respects existing data — duplicate detection by name
  6. Missions and quests have export builders with ExportButton on missions, boards/missions, boards/quests, and decisions pages
  7. All date/time outputs (exports, timestamps) use IST (Asia/Kolkata) regardless of server timezone
**Plans**: 3 plans

Plans:
- [x] 19-01-PLAN.md -- Export gaps: Missions/Quests export builders, findAllForExport methods, ExportButton on 4 missing pages, frontend type updates, IST verification
- [x] 19-02-PLAN.md -- Import backend: ImportsModule with CSV/XLSX parsers, schema-strict validators, template generation, parse/commit/template endpoints
- [x] 19-03-PLAN.md -- Import frontend: types, import index page, sidebar nav, import type pages with drag-drop upload, preview table, inline editing, commit flow, result summary

### Phase 20: Operations Import
**Goal**: Bulk CSV/XLSX import for operational data — opening stock, recipes, menu items, events, tasks, quests, KPIs with dependency ordering, entity resolution, and per-entity update policies
**Depends on**: Phase 19 -- shared import infrastructure, master data must exist
**Requirements**: OPSIMPORT-01, OPSIMPORT-02, OPSIMPORT-03, OPSIMPORT-04, OPSIMPORT-05, OPSIMPORT-06, OPSIMPORT-07, OPSIMPORT-08, OPSIMPORT-09, OPSIMPORT-10
**Success Criteria** (what must be TRUE):
  1. Admin can upload opening stock levels with ingredient + zone name resolution and unit conversion validation
  2. Admin can upload recipes with BOM lines (3-sheet XLSX: headers + BOM + instructions) with cycle detection
  3. Admin can upload menu items with approved recipe guard and brand-scoped category resolution
  4. Admin can bulk-create events, tasks, quests, missions, and KPIs with enum enforcement and FK resolution
  5. Dependency ordering visible on import index page with live prerequisite checks and amber warnings
  6. Per-entity update policies enforce SAFE/BLOCKED/NEVER field categories per D-02
  7. Infrastructure fixes: transaction rollback, userId audit, base_unit protection, enum enforcement, row limit, number sanitization
**Plans**: 5 plans

Plans:
- [x] 20-01-PLAN.md -- Backend infrastructure: extend types/config (10 new import types), fix service/controller (D-26-D-31), recipe XLSX parser, prerequisites endpoint, module wiring
- [x] 20-02-PLAN.md -- Level 1 validators (opening stock, mission, KPI, event) + fix ingredient validator (D-28, D-29) + templates for all 10 new types
- [x] 20-03-PLAN.md -- Level 2-4 validators (quest, task, recipe, menu category, menu item) + wire all validators into service
- [x] 20-04-PLAN.md -- Commit logic: createRow/updateRow for all types, stock special path (inventoryService.adjust), recipe two-pass commit with BOM and cost calc
- [x] 20-05-PLAN.md -- Frontend: tiered import index with prerequisites, stock/recipe specific UI (amber warnings, grouped preview, XLSX-only)

### Phase 21: In-App Chat
**Goal**: Real-time 1-1 and group messaging using Pusher.js — users can start 1-1 chats, admin creates group chats, admin/tech can view all conversations, normal users see only their own chats
**Depends on**: Phase 20
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07, CHAT-08, CHAT-09, CHAT-10
**Success Criteria** (what must be TRUE):
  1. Users can start 1-1 chats with any team member and send/receive messages in real-time via Pusher.js
  2. Admin can create group chats with selected members and a group name
  3. Admin and tech lead can view any 1-1 or group chat (oversight capability)
  4. Normal users can only see their own 1-1 chats and groups they belong to
  5. Messages appear instantly without page refresh (Pusher real-time events)
  6. Chat UI with conversation list, message thread, and unread indicators
**Plans**: 4 plans

Plans:
- [x] 21-01-PLAN.md -- Foundation: Prisma schema (Conversation, Message, ConversationParticipant), ChatModule scaffold, PusherService singleton, Pusher auth endpoint
- [x] 21-02-PLAN.md -- Backend API: Conversation CRUD, message CRUD with cursor pagination, read receipts, Pusher triggers, admin oversight endpoints, unit tests
- [x] 21-03-PLAN.md -- Frontend chat page: split-panel layout, ConversationList with admin tabs, ConversationItem, NewChatDialog, NewGroupDialog, Sidebar nav, Pusher client, types
- [x] 21-04-PLAN.md -- Frontend messages + real-time: MessageThread, MessageBubble, ComposeArea, file upload, typing indicators, read receipts, GroupMembersSheet, Pusher integration

### Phase 22: Recipe Page Redesign
**Goal**: Replace the sidebar recipe wizard with a dedicated full-page recipe builder — proper BOM table editing, live cost preview, inline approval workflow, and better UX for complex multi-ingredient recipes
**Depends on**: Phase 20 -- recipes and BOM infrastructure
**Requirements**: RECIPE-01, RECIPE-02, RECIPE-03, RECIPE-04, RECIPE-05, RECIPE-06, RECIPE-07, RECIPE-08, RECIPE-09, RECIPE-10, RECIPE-11, RECIPE-12, RECIPE-13
**Success Criteria** (what must be TRUE):
  1. User can create a new recipe at /recipes/new with a full-page builder layout
  2. User can edit an existing recipe at /recipes/[id] with all data pre-loaded
  3. BOM table supports drag-and-drop reordering, inline editing, and sub-recipe expansion
  4. Cost panel shows live batch cost, per-portion cost, and food cost % with animated transitions
  5. Status banner shows contextual approval actions (Submit, Approve/Reject, Create New Version/Archive)
  6. Approved recipes are locked — editing requires "Create New Version" which archives and clones
  7. Sidebar wizard is completely removed from the codebase
**Plans**: 4 plans

Plans:
- [x] 22-01-PLAN.md -- Backend: pending status + transitions, createNewVersion endpoint, cost-preview endpoint, bulk cost-data endpoint
- [x] 22-02-PLAN.md -- Frontend types + builder scaffold: RecipeStatus with pending, RecipeBuilderPage, RecipeMetaGrid, route pages, beforeunload
- [x] 22-03-PLAN.md -- BOM table + cost panel: RecipeBomTable with dnd-kit, BomTableRow, RecipeCostPanel with animated numbers, CostEstimateBadge, client + server cost calc
- [x] 22-04-PLAN.md -- Status banner + wiring + cleanup: RecipeStatusBanner with approval workflow, list page Link navigation, wizard removal

### Phase 23: Razorpay Payments + Customer Auth

**Goal:** OTP-based customer authentication (phone login via WhatsApp), Razorpay payment gateway integration for event bookings and POS, with existing manual payment methods (cash/card/UPI) preserved. Events confirmed only after successful payment.
**Depends on:** Phase 20 — existing orders, payments, and menu infrastructure
**Requirements:** PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, PAY-08, PAY-09, PAY-10, PAY-11, PAY-12, PAY-13, PAY-14, PAY-15, PAY-16, PAY-17, PAY-18, PAY-19, PAY-20, PAY-21, PAY-22, PAY-23, PAY-24
**Success Criteria** (what must be TRUE):
  1. Customer can log in via phone OTP (WhatsApp delivery or console fallback in dev) and receive 30-day JWT cookie
  2. Customer can book a paid event through Razorpay checkout modal with server-side signature verification
  3. Customer can book a free event without payment modal
  4. Capacity race condition after payment triggers automatic refund (no double-booking)
  5. POS staff can process Razorpay payments for existing orders
  6. Webhook endpoint verifies signatures, deduplicates events, and routes to correct handler
  7. All existing manual payment methods (cash/card/UPI) and anonymous booking flow still work
**Plans**: 4 plans

Plans:
- [x] 23-01-PLAN.md -- Schema + Customer Auth: Customer model, migration, JWT extension, guards, OTP service with WhatsApp, Redis storage, rate limiting
- [x] 23-02-PLAN.md -- Razorpay + Webhooks: RazorpayService SDK wrapper, webhook endpoint with raw body, signature verification, dedup, routing, main.ts update
- [x] 23-03-PLAN.md -- Payment flows: Event checkout/confirm endpoints with pay-to-book, free event path, auto-refund; POS Razorpay order/confirm endpoints
- [x] 23-04-PLAN.md -- Frontend: Customer OTP components, EventCheckoutForm, POS Razorpay, useRazorpay hook, customer profile page

### Phase 24: Customer Marketplace

**Goal:** Full customer-facing marketplace — cart + checkout with Razorpay custom checkout modal, takeaway & delivery ordering, delivery address management, checkpoint-based order tracking (staff fires events, customer sees timeline via Pusher), customer order history, booking/order receipt download (printable HTML), and enriched customer profile (order history, saved addresses, active order tracking)
**Depends on:** Phase 23 — customer auth and Razorpay payment infrastructure
**Requirements:** MKT-01, MKT-02, MKT-03, MKT-04, MKT-05, MKT-06, MKT-07, MKT-08
**Success Criteria** (what must be TRUE):
  1. Customer can browse menu with category tabs, add items via quantity steppers, and see floating cart bar
  2. Customer can checkout via cart bottom sheet with Pickup/Delivery toggle, Google Places address input, and Razorpay payment
  3. Customer can track order in real-time at /orders/[id]/track with 4-step timeline updating via Pusher
  4. Customer can view order history, re-order past orders, and download HTML receipts at /profile
  5. Customer can manage delivery addresses with Google Places autocomplete and pincode serviceability check
  6. Cart persists in localStorage before login and syncs to Redis on OTP verify
  7. Unavailable items are greyed out and cannot be added to cart
**Plans**: 4 plans

Plans:
- [x] 24-01-PLAN.md -- Backend foundation: Prisma migration (CustomerAddress), CustomerOrdersModule with cart Redis CRUD, address CRUD, Pusher customer auth, apiClient fix
- [x] 24-02-PLAN.md -- Backend checkout + tracking: checkout/confirm endpoints, Pusher triggers in order status/delivery updates, webhook marketplace handler, receipt endpoints, unit tests
- [x] 24-03-PLAN.md -- Frontend cart + menu: Zustand cart store, CSS tokens, menu page enhancement (CategoryTabBar, MenuItemOrderCard, FloatingCartBar, CartBottomSheet, Google Places)
- [x] 24-04-PLAN.md -- Frontend tracking + profile: order tracking page with Pusher timeline, profile enrichment (Orders/Addresses/Bookings tabs, re-order flow), human verification

### Phase 25: Third-Party Delivery Integration

**Goal:** Porter API for local overflow delivery (when own team can't deliver) and Shiprocket API for interstate shipping of non-food items (art, merchandise) — with courier selection, AWB generation, tracking webhooks, and delivery status synced to order tracking
**Depends on:** Phase 24 — marketplace ordering and order tracking infrastructure
**Status:** **NOT BUILT.** No plans were written and no code exists (no Porter/Shiprocket adapter, no Shipment model, no tracking webhook). The earlier "4/4 plans complete" entry was wrong. Superseded by v2.0 Phase 33 (Shiprocket via `ShippingProvider` interface, SPEC.md §5.3); Porter is dropped.
**Plans:** 0 plans (none)

### Phase 26: Order Detail Page

**Goal:** Dedicated /orders/[id] detail page for staff — order timeline, payment processing (Razorpay UPI QR display + WhatsApp payment link), delivery status tracking, KDS status, receipt generation and download. Replaces the current OrderDetailSheet slide-out with a full page.
**Requirements**: TBD
**Depends on:** Phase 23 — Razorpay payment infrastructure
**Status:** **NOT BUILT.** Phase directory is empty and no staff `/orders/[id]` page exists (orders still use `OrderDetailSheet`). Folded into v2.0 Phase 34 staff Orders screen (all channels, refunds, shipment status — SPEC.md §5.5).
**Plans:** 0 plans (none)

### Phase 27: Mission Flow & Assessment Gap Closure

**Goal:** Close every gap identified in the v2 assessment review — `GET /mission-control` aggregation endpoint, PurchaseOrder/Asset to Task FK linking with UI display, activity feed widget on admin dashboard, team contribution breakdown view (tasks/valid/readiness/blocked per person), "Today's Focus" section on non-admin dashboard, readiness meter name on task card badges, quest to mission breadcrumb on task detail pages, readiness impact in task validation toast, mission/quest context in task list view. After this phase, 0 of the assessment's 47 claims remain valid (except the intentionally deferred Experience module).
**Requirements**: MC-01, MC-02, AF-01, AF-02, TC-01, TF-01, PO-01, PO-02, LR-01, KB-01, LV-01, BC-01, VT-01
**Depends on:** Phase 24 — customer marketplace
**Success Criteria** (what must be TRUE):
  1. GET /missions/mission-control returns active missions, readiness snapshot, and action-required counts with role scoping
  2. Admin dashboard has ActivityFeedWidget (48h lookback, last 5 items) and TeamContributionWidget (per-role, time-scoped)
  3. Non-admin dashboard has TodaysFocusSection (overdue/due-today/quest tasks, max 5, hidden when empty)
  4. Task kanban card readiness badge shows "+N MetricName" with meter name
  5. Task list view has Quest and Mission columns (collapsible on mobile)
  6. Task detail page has Mission -> Quest -> Task breadcrumb chain with links
  7. Task validation toast shows readiness impact ("Task validated! +N XP . +M MeterName")
  8. Task detail page shows Linked Resources section (POs and Assets)
  9. PO model has linked_task_id FK, PO form has "Link to Task" dropdown
  10. /activity full page and /team-contribution detail page accessible from dashboard widgets
**Plans**: 5 plans

Plans:
- [x] 27-01-PLAN.md -- Backend foundation: Prisma migration (PO linked_task_id), /missions/mission-control aggregation endpoint, ActivityModule with feed + contribution endpoints
- [x] 27-02-PLAN.md -- Backend task includes: extend findAll/findOne with quest.mission + readiness_meter, PO create/update accepts linked_task_id, task detail returns linked resources
- [x] 27-03-PLAN.md -- Frontend task UX: Task type updates, kanban badge meter name, list view columns, detail breadcrumb, validation toast, linked resources section
- [x] 27-04-PLAN.md -- Frontend dashboard widgets: ActivityFeedWidget, TeamContributionWidget, TodaysFocusSection, wired into admin and non-admin dashboards
- [x] 27-05-PLAN.md -- Frontend pages + checkpoint: /activity full page, /team-contribution detail page, PO form "Link to Task" dropdown, visual verification

### Phase 28: Recipe preparation_type — multi-fulfillment food product support

**Goal:** Enable the system to handle 4 food product types (scratch, batch_prepared, ready_to_sell, assemble) through the existing recipe/inventory pipeline, with fulfillment routing that matches how each type is actually produced and sold. Also add supply/equipment inventory tracking for non-consumable kitchen items.

**Requirements:**

*Recipe preparation types:*
- R28-01: `preparation_type` field on Recipe model (scratch | batch_prepared | ready_to_sell | assemble), default scratch
- R28-02: Forked availability calculation — scratch uses ingredient BOM, batch_prepared uses PrepBatch.quantity_remaining, ready_to_sell uses IngredientStock directly, assemble uses min(component availability)
- R28-03: Forked deduction timing — scratch deducts at KDS "ready", non-scratch deducts at order confirmation (prevents double-selling last item)
- R28-04: Order items auto-set to "ready" for non-scratch types (no kitchen prep needed)
- R28-05: KDS filters to scratch items only — kitchen staff sees only what needs cooking
- R28-06: Pick & Pack queue or notification for non-scratch order items (someone needs to know to grab the pickle jar)
- R28-07: Mixed order handling — order with coffee (scratch) + cookie (batch_prepared) + pickle (ready_to_sell) routes correctly, order status tracks partial readiness
- R28-08: Recipe form updated with preparation_type selector
- R28-09: Batch-prepared FIFO — sell from batches expiring soonest first
- R28-10: Menu availability endpoint returns correct counts per preparation_type

*Supply & equipment inventory:*
- R28-11: `usage_type` field on Ingredient model (recipe_input | supply), default recipe_input. Supplies are non-consumable items (moulds, cups, baking sheets, cling wrap) tracked by count but never auto-deducted from recipes or orders.
- R28-12: Supplies excluded from recipe BOM lookups and availability calculations — they don't feed into menu servings
- R28-13: Manual "Log Usage" action for supplies — record quantity used with reason, date, and who logged it. Creates StockMovement with a new movement_type (e.g., "supply_usage")
- R28-14: Supplies still use full procurement pipeline — PO receiving, VendorPrice, IngredientStock per zone, low stock alerts. Only the deduction path differs.
- R28-15: Frontend: ingredient form gets usage_type selector; ingredient list filters/badges by type; supply usage log UI (similar to waste log pattern)

**Key design decisions to make during planning:**
- batch_prepared out-of-stock: show "out of stock" or fall back to "can make more from ingredients"?
- Assemble packing step: KDS item (assembly station) or pick & pack item?
- Pick & Pack: new page or filtered view within existing KDS/POS?
- Supply usage log: standalone page or integrated into existing waste log page?
- Disposable supplies: DECIDED — all supply usage is manual end-of-day logging, no auto-deduction (even for cups/containers). Keeps the system simple and matches how kitchen teams actually work.

**Product types this enables:**

| Type | Example | Made how | Sold how |
|------|---------|----------|----------|
| scratch | Coffee, sandwich, fresh pasta | Per order in kitchen | KDS > cook > serve |
| batch_prepared | Cookies, bread, cakes | Bulk via prep batch, sold throughout day | Pick from existing batch |
| ready_to_sell | Pickle jars, packaged snacks, bottled drinks | Purchased from vendor | Pick from shelf |
| assemble | Gift box, thali, combo meal | Combine ready components | Pick + assemble |

**Supply/equipment types this enables:**

| Type | Examples | Depletes how | Tracked how |
|------|----------|-------------|-------------|
| Reusable equipment | Moulds, baking sheets, pans, spatulas | Breakage/wear — logged manually | Count, log when damaged/lost |
| Disposable supplies | Paper cups, takeaway containers, napkins, cling wrap | Used per batch/period — logged manually | Count, log usage periodically |


**Depends on:** Phase 27
**Success Criteria** (what must be TRUE):
  1. Recipe model has preparation_type field with 4 values; menu availability forks correctly per type
  2. Non-scratch order items deduct stock at order confirmation (not KDS) and auto-set status='ready'
  3. KDS shows only scratch items — kitchen staff never sees pre-made or assembled items
  4. Pick & Pack page at /operations/kitchen/pick-and-pack shows non-scratch order queue with assemble checklists
  5. Supply Usage page at /operations/kitchen/supply-usage lets staff log supply consumption with StockMovement audit trail
  6. Ingredient model has usage_type field; supplies/equipment excluded from recipe BOM ingredient selectors
  7. IngredientCategory table replaces hardcoded category string; 25+ default categories seeded, admin can add custom categories
  8. Recipe form has preparation_type RadioGroup selector; ingredient form has usage_type selector and DB-driven category dropdown
  9. Sidebar has "Pick & Pack" and "Supply Usage" entries under Kitchen section
**Plans**: 5 plans

Plans:
- [x] 28-01-PLAN.md -- Schema foundation: Prisma migration (preparation_type, usage_type, IngredientCategory), seed 25 categories, IngredientCategories CRUD module
- [x] 28-02-PLAN.md -- Backend logic fork: computeServings availability by preparation_type, non-scratch deduction at order creation, KDS scratch-only filter
- [x] 28-03-PLAN.md -- New backend modules: Pick & Pack queue endpoint, Supply Usage logging endpoint, ingredients usage_type filtering
- [x] 28-04-PLAN.md -- Frontend forms: RadioGroup install, types update, RecipeMetaGrid preparation_type selector, IngredientForm usage_type + DB categories, IngredientCategoriesSection
- [x] 28-05-PLAN.md -- Frontend pages: Pick & Pack page, Supply Usage page, sidebar entries, visual verification checkpoint (commit `49086da`)

---

## v2.0 Phase Details (Phases 29–35)

P0 (canonical spec + planning sync) has no phase number: `SPEC.md` was committed at `cd04779` on 2026-08-22 and this roadmap, `PROJECT.md`, `REQUIREMENTS.md` and the `contextdocs*/README.md` markers were synced in the same pass. Requirement IDs below are defined in `.planning/REQUIREMENTS.md` ("v2.0 Requirements").

### Phase 29: Stop the Bleeding (P1)
**Goal**: Every Critical/High defect from the 2026-08-22 audit is fixed with a regression test, and a CI pipeline blocks deploys while any test is red.
**Depends on**: Phase 28 (v1.1 complete) and P0 (`SPEC.md` committed)
**Requirements**: FIX-01 … FIX-14, QA-01
**Success Criteria** (what must be TRUE):
  1. Marketplace orders carry a `fulfilment_zone_id` and deduct stock exactly once; `POST /customer/orders/confirm` and the `payment.captured` webhook both call the same `FulfilmentService.confirmPaidOrder` (integration test proves no divergence)
  2. Replaying the same Razorpay payment to `/confirm` returns the existing order — no duplicate `Order`/`Payment` rows (`razorpay_payment_id @unique`, P2002 path tested)
  3. Refresh tokens carry `token_use: refresh`, are signed with `JWT_REFRESH_SECRET` and are rejected by `JwtStrategy` on API routes; named throttlers `default/short/long` are registered and every public auth/OTP/feedback route has an explicit limit
  4. Batch-prepared items cannot oversell (insufficient `quantity_remaining` fails the transaction), assemble deduction converts component units first, and POS and customer order paths are guard-isolated (customer JWT cannot reach staff order endpoints)
  5. Production boot fails on missing required env vars (`ConfigModule` schema); QStash webhook returns 403 without a configured receiver; `seed:demo` refuses to run when `NODE_ENV=production` and prints random passwords once
  6. Route-level `error.tsx` + `global-error.tsx` exist; all 43 backend jest suites are green; `.github/workflows/ci.yml` runs lint → tsc → jest → prisma validate → build on every push/PR and Railway/Vercel deploy only on green `master`
**Spec sections**: §1.1 (goals 4–5), §5.2 step 4, §8, §10, §11 P1
**Plans**: TBD

### Phase 30: Platform Foundation (P2) — ✅ COMPLETE (2026-08-23, `fc49c19`)
**Goal**: The schema is reset to one fresh migration baseline — `Node`, Prisma enums, `AuditEvent`, `Task.subject`, `ApprovalPolicy`, timestamptz, CHECK constraints and `Product` replacing `MenuItem` — with every v1 flow green against it.
**Depends on**: Phase 29
**Requirements**: PLAT-01 … PLAT-09
**Success Criteria** (what must be TRUE):
  1. `prisma/migrations` contains a single baseline migration; `Node` is seeded with one node and every aggregate listed in SPEC §3.1 has a required `node_id` with the node-scoped unique constraints (`ReadinessMeter (node_id, code)`, `ChannelModifier (node_id, channel)`, `Product (node_id, slug)`)
  2. Every enum-like field is a Prisma enum, every `DateTime` is `@db.Timestamptz(3)`, money is `Decimal(12,2)`, quantities `Decimal(14,4)`; CHECKs exist on `RecipeLine` (input XOR), `IngredientStock` (`current_quantity >= 0`) and `WasteLog`
  3. `MenuItem`/`MenuCategory` are gone; `Product`, `ProductCategory`, `ProductVariant`, `ProductMedia` exist and POS, KDS, Pick & Pack, exports, imports and analytics read products
  4. Every mutating transaction writes an `AuditEvent`; `SystemSetting.value` is JSON with allowlisted keys; `ModuleAccess` exists with the §6.3 defaults; `Task.subject_type/subject_id`, `ApprovalPolicy`, `Approval.entity_type/entity_id`, `DecisionVote`, `ReadinessSignal/Snapshot`, `Shipment*`, `Coupon*`, `Loyalty*`, `Review`, `Refund` are in the schema
     — **Corrected 2026-08-23:** for `Shipment*`, `Coupon*`, `Loyalty*`, `Review`, `Refund` and `UsageEvent` this phase delivers **enums declared only; the models land in Phase 33 (P5)** together with the services that write them (the `Order` money columns they populate did ship in P2). Everything else in this criterion shipped in Phase 30.
  5. `seed:reference` (idempotent, prod-safe) and `seed:demo` (guarded) both run clean on an empty database; migrations run in a release step, not the build
  6. All v1 flows (login → task → evidence → approve; PO receive; prep batch; POS → KDS → deduction; marketplace order) pass integration tests against the new schema, and every item in SPEC §3.5 is removed from the codebase
**Spec sections**: §3.1–§3.5, §8 (data safety), §11 P2, §12
**Plans**: 1 plan — complete

Plans:
- [x] 30-01 — `docs/superpowers/plans/2026-08-23-p2-platform-foundation.md` (16 tasks, `a6c454c..fc49c19`); record at `.planning/phases/30-p2-platform-foundation/30-01-SUMMARY.md`

### Phase 31: Mission Bridge (P3)
**Goal**: Operational events automatically become bridge evidence and readiness signals, four meters are derived from ops state with daily snapshots and a history API, and approval gates and decision votes execute from policy tables.
**Depends on**: Phase 30
**Requirements**: BRIDGE-01 … BRIDGE-04, READY-01 … READY-03, GOV-01 … GOV-04, QA-02, QA-03
**Success Criteria** (what must be TRUE):
  1. `backend/src/common/events/domain-events.ts` defines every event in SPEC §4.1; each emitter fires after commit, inside try/catch, with `{ node_id, actor, occurred_at }`
  2. `MissionBridgeService` rules (`mission-bridge.rules.ts`) create `Evidence{ type: system, source: bridge, approval_status: pending }` with a deep link whenever the source entity resolves to a task via `Task.subject`, `PurchaseOrder.linked_task_id` or `Decision.linked_task_id`; humans still approve
  3. `STANDARDIZATION`, `PROCUREMENT`, `SALES`, `QUALITY` are computed per the §4.3 formulas, hybrid meters blend 50/50, `ReadinessSnapshot` is written nightly and `GET /readiness-meters/:code/history?days=90` returns it
  4. A task with `requires_approval` gets one pending `Approval` per policy role; validation requires all of them (or a `FOUNDER_ADMIN` override with reason); self-approval is blocked and delegation is honoured
  5. Recipe approval flows through the `food` policy (legacy direct status flip removed); decisions run tier 1 (auto-approve by domain lead), tier 2 (`DecisionVote` 2+1 → `aligned` → `approved`), tier 3 (founder), with reject → `rejected` and founder `reopen`
  6. Smoke test 1 (`login → create task → upload evidence → approve → meter moves`) passes in CI
**Spec sections**: §3.2, §4.1–§4.4, §9, §10, §11 P3
**Plans**: TBD

### Phase 32: Role-Aware IA + Identity (P4)
**Goal**: Every role lands on "what I must move today" through a persistent mission header, a fixed navigation spine scoped by `ModuleAccess`, a real `/tasks`, and one brand token system validated in light and dark.
**Depends on**: Phase 31 (header needs approvals count and readiness history); UI groundwork may start after Phase 30
**Requirements**: IA-01 … IA-07, DESIGN-01 … DESIGN-04, QA-04
**Success Criteria** (what must be TRUE):
  1. Every ops page shows the persistent header — mission › phase › this week's quest › node readiness % › approvals/blockers badges › XP/level › ⌘K search › notifications › theme › user — and it is never null (start-a-mission CTA or "ask the founder" note)
  2. The navigation spine follows the §6.2 order, items appear only when the role's `ModuleAccess` allows, `/admin/modules` is editable by `MANAGE_SYSTEM`, Guide and Chat live in the header, and no label appears twice
  3. `/tasks` is server-filtered and paginated (`?mine=1&status=&quest_id=`) with kanban + list; `/quests?mine=1` and `/team` (wins, contribution, activity, leaderboard) exist; Mission Control (admin) and My Day (everyone else) match §6.5
  4. Task and Quest create/edit are Sheets; evidence upload works from the task row and task page; approve/reject is inline with a required note on reject; ops cards with a task link show the "Quest › Task" chip and meter
  5. One token file promotes the `--public-*` palette to `:root` with a designed dark set, light and dark pass contrast checks, a lint rule rejects arbitrary colour values, the motion allowlist is enforced (framer-motion and spectrumui removed), and the homepage is visually untouched
  6. Pusher private channels drive KDS, Pick & Pack, Shipments, Approvals count and Notifications (polling ≥ 30 s only as fallback); `UsageEvent` records page views per role and key actions
**Spec sections**: §2, §3.5, §6.1–§6.5, §7, §8 (observability), §11 P4
**Plans**: TBD

### Phase 33: Marketplace Backend (P5a)
**Goal**: The backend sells all four product types through one catalog and one mixed-fulfilment quote → pay → confirm pipeline, with Shiprocket shipments, coupons, loyalty, reviews, search and refunds.
**Depends on**: Phase 31 (bridge events) and Phase 30 (`Product` model); may run in parallel with Phase 32
**Requirements**: CAT-01 … CAT-04, CHK-01 … CHK-05, SHIP-01 … SHIP-05, PROMO-01, PROMO-02, LOYAL-01, LOYAL-02, REV-01, REV-02, SRCH-01, QA-05
**Success Criteria** (what must be TRUE):
  1. Staff `catalog/products|variants|categories|media` CRUD + publish works; public `catalog/*` is cached 60 s and never returns cost, yield, BOM or margin; `GET /catalog/search?q=` runs on a `tsvector` + GIN index with type/category facets
  2. The Redis cart is server-priced on every sync (base + variant delta + channel modifier) with availability per type (§3.3), and `POST /customer/checkout/quote` returns itemised subtotal, coupon discount, shipping (Shiprocket rate), tax breakup, loyalty redeemable and total, creating 15-minute booking holds
  3. `POST /customer/orders/confirm` creates `Order` + `Payment` in one Serializable transaction, routes each line (KDS/Pick & Pack by `preparation_type`, shipped → `packed` queue, booking → `EventBooking.confirmed`), writes coupon redemption and loyalty in the same transaction, and is idempotent; the webhook uses the same `FulfilmentService`
  4. `ShippingProvider` interface is implemented by `ShiprocketAdapter` (token cached ~9 days, create/AWB/pickup/label/track/cancel) and `ManualProvider`; `POST /webhooks/shiprocket` is shared-secret protected and idempotent on `(awb, status, occurred_at)`; shipment status drives `Order.status` `shipped → delivered` with customer Pusher event and WhatsApp template
  5. Coupons are validated only server-side in the quote (no stacking, `free_shipping` on shipped lines only); loyalty earns on `delivered`/`attended` and expires after 365 days; reviews are one per `order_item`, auto-published at rating ≥ 4, with `rating_avg/count` maintained by trigger; `POST /orders/:id/refund` (full/partial) creates a `Refund` reconciled by the `refund.processed` webhook
  6. Integration tests cover order confirm, fulfilment, shipment lifecycle, coupon, loyalty and review flows; the smoke-test-2 API path is green
**Spec sections**: §3.3, §5.2–§5.4, §8, §9, §10, §11 P5
**Plans**: TBD

### Phase 34: Marketplace Storefront + Staff Commerce (P5b)
**Goal**: Customers shop all four product types on a desktop-designed, SEO-ready storefront with account, tracking and reviews, and staff run catalog, promotions, reviews, shipments, orders, experiences and customers from the ops app.
**Depends on**: Phase 32 and Phase 33
**Requirements**: STORE-01 … STORE-04, ACCT-01, ACCT-02, OPS-01 … OPS-05, QA-06
**Success Criteria** (what must be TRUE):
  1. Every route in SPEC §5.1 exists as a server component with `generateMetadata`; product and event pages emit JSON-LD; sitemap and robots are generated; `/menu` redirects to `/shop?type=prepared_food`; images use `next/image` with the R2 remote pattern; the homepage is untouched
  2. `/cart` and `/checkout` handle mixed fulfilment in one flow (local pincode or pickup, shipped address with live rate, booking hold), coupon entry, loyalty redemption and Razorpay pay → confirm → `/orders/[id]/track` with shipment tracking
  3. `/account`, `/account/orders`, `/account/addresses`, `/account/loyalty`, `/account/reviews` and `/feedback/[orderId]` work on a 7-day sliding customer session with `jti` revocation on logout
  4. Staff screens exist for Catalog (products, variants, media, categories, publish), Promotions, Reviews moderation, Shipments queue (pack → AWB → pickup → label → track, Pusher-driven), Orders (all channels, refunds, full order detail — closes the Phase 26 intent), Experiences (events + attendance) and Customers (profile, orders, loyalty adjust)
  5. POS sells `prepared_food` products only and is otherwise unchanged; Pick & Pack shows the shipped `packed` queue alongside local non-scratch items
  6. Playwright smoke test 2 (`browse → add three fulfilment types → coupon → pay (Razorpay test) → confirm → track`) passes in CI; desktop and mobile layouts pass a recorded walk-through
**Spec sections**: §5.1, §5.2, §5.5, §6.4, §7, §8 (auth), §10, §11 P5
**Plans**: TBD

### Phase 35: Run-It Layer (P6)
**Goal**: The node runs day-to-day on the system — staff get WhatsApp nudges, a daily close screen, theoretical vs actual food cost, a usage dashboard, and human-in-the-loop AI assists.
**Depends on**: Phase 34
**Requirements**: RUN-01 … RUN-06
**Success Criteria** (what must be TRUE):
  1. WhatsApp staff templates fire for approvals waiting, blockers, low stock and failed shipments through the existing Cloud API with per-type cooldowns
  2. A daily close screen shows orders and revenue by channel, waste logged, batches depleted, stock reconciliation result and open shipments, and is signed off by `FRONTEND_LEAD` or `FOUNDER_ADMIN` as an `AuditEvent`
  3. A theoretical vs actual food cost report compares recipe-derived COGS with stock movements per period and surfaces variance to `BI_LEAD`
  4. An admin usage dashboard reads `UsageEvent` (page views per role, key actions)
  5. AI evidence-review assist and a morning brief run on the Claude API as suggestions only — no evidence is approved, readiness value set or price changed by AI
  6. Nightly jobs (stock reconciliation with drift `AuditEvent`, loyalty expiry, readiness snapshots) run under `pg_try_advisory_lock`; R2 has a 30-day lifecycle rule on `exports/` and a weekly orphan sweep
**Spec sections**: §1.2 (AI limits), §3.4, §6.5, §8, §11 P6
**Plans**: TBD
