# Roadmap: Konma Xperience OS

## Milestones

- ✅ **v1.0 MVP** - Phases 1-13 (shipped 2026-03-22)
- 🚧 **v1.1 User Guide & Data Management** - Phases 14-21 (in progress)

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
- [x] **Phase 15: Reader View** - Staff-facing guide experience with role-gated content (completed 2026-03-22)
- [x] **Phase 16: Admin CMS** - Tiptap rich text editor with image upload and content management UI (completed 2026-03-22)
- [x] **Phase 17: Search, Preview, and Content Seeding** - Full-text search, admin preview-as-role, and real guide content generated from codebase (completed 2026-03-23)
- [x] **Phase 18: Data Export** - CSV/XLSX export for 22 report types across all modules (completed 2026-03-23)
- [x] **Phase 19: Master Data Import + Export Gaps + Timezone** - Bulk import, missing exports (missions/quests), IST timezone (completed 2026-03-23)
- [x] **Phase 20: Operations Import** - Bulk import for stock, recipes, menu, events, tasks, quests, KPIs (completed 2026-03-23)
- [x] **Phase 21: In-App Chat** - Real-time 1-1 and group messaging with Pusher.js, role-scoped visibility (completed 2026-03-23)

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
Phases execute in numeric order: 14 -> 14.x -> 15 -> 15.x -> 16 -> 16.x -> 17 -> 17.x -> 18 -> 18.x -> 19 -> 19.x -> 20 -> 20.x -> 21 -> 22 -> 23 -> 24

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
| 23. Razorpay Payments + Customer Auth | v1.2 | 4/4 | Complete    | 2026-03-25 |
| 24. Customer Marketplace | v1.2 | 1/4 | In Progress|  |

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
- [ ] 24-02-PLAN.md -- Backend checkout + tracking: checkout/confirm endpoints, Pusher triggers in order status/delivery updates, webhook marketplace handler, receipt endpoints, unit tests
- [ ] 24-03-PLAN.md -- Frontend cart + menu: Zustand cart store, CSS tokens, menu page enhancement (CategoryTabBar, MenuItemOrderCard, FloatingCartBar, CartBottomSheet, Google Places)
- [ ] 24-04-PLAN.md -- Frontend tracking + profile: order tracking page with Pusher timeline, profile enrichment (Orders/Addresses/Bookings tabs, re-order flow), human verification

### Phase 25: Third-Party Delivery Integration

**Goal:** Porter API for local overflow delivery (when own team can't deliver) and Shiprocket API for interstate shipping of non-food items (art, merchandise) — with courier selection, AWB generation, tracking webhooks, and delivery status synced to order tracking
**Depends on:** Phase 24 — marketplace ordering and order tracking infrastructure
**Plans:** 1/4 plans executed

Plans:
- [ ] TBD (run /gsd:plan-phase 25 to break down)

### Phase 26: Order Detail Page

**Goal:** Dedicated /orders/[id] detail page for staff — order timeline, payment processing (Razorpay UPI QR display + WhatsApp payment link), delivery status tracking, KDS status, receipt generation and download. Replaces the current OrderDetailSheet slide-out with a full page.
**Requirements**: TBD
**Depends on:** Phase 23 — Razorpay payment infrastructure
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 26 to break down)
