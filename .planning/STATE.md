---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: User Guide & Data Management
status: unknown
stopped_at: Phase 19 context gathered
last_updated: "2026-03-23T15:42:50.953Z"
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 20
  completed_plans: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Every piece of work must be evidence-backed, approved, and validated before it counts -- turning real execution into measurable readiness and progress.
**Current focus:** Phase 21 — in-app-chat

## Current Position

Phase: 21
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.1)
- Average duration: -- (v1.0 avg ~6.5 min/plan across 56 plans)
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14. Foundation | 0/? | - | - |

**Recent Trend:**

- Last 5 plans (v1.0): Phase 13 P01 (11min), Phase 13 P02 (7min), Phase 13 P03 (8min)
- Trend: Stable

*Updated after each plan completion*
| Phase 14 P01 | 11min | 3 tasks | 9 files |
| Phase 14 P02 | 8min | 3 tasks | 9 files |
| Phase 15 P01 | 7min | 3 tasks | 10 files |
| Phase 15 P02 | 8min | 3 tasks | 9 files |
| Phase 16 P01 | 6min | 2 tasks | 8 files |
| Phase 16 P02 | 10min | 2 tasks | 7 files |
| Phase 17 P01 | 9min | 2 tasks | 10 files |
| Phase 17-03 P03 | 10min | 2 tasks | 1 files |
| Phase 17 P02 | 5min | 2 tasks | 7 files |
| Phase 18 P01 | 7min | 2 tasks | 11 files |
| Phase 18 P03 | 4min | 2 tasks | 5 files |
| Phase 18 P05 | 6min | 2 tasks | 6 files |
| Phase 18 P02 | 6min | 2 tasks | 5 files |
| Phase 18 P04 | 9min | 2 tasks | 10 files |
| Phase 18 P07 | 23min | 3 tasks | 22 files |
| Phase 21 P01 | 6min | 2 tasks | 14 files |
| Phase 21 P02 | 5min | 2 tasks | 3 files |
| Phase 21 P03 | 11min | 2 tasks | 12 files |
| Phase 21 P04 | 15min | 2 tasks | 13 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.1 Research]: Content storage as String @db.Text (JSON-stringified Tiptap doc), not JSONB
- [v1.1 Research]: Tiptap v3 (3.20.x) for rich text editing, loaded via dynamic({ ssr: false })
- [v1.1 Research]: isomorphic-dompurify with jsdom pinned to 25.0.1 for XSS sanitization
- [v1.1 Research]: Reader view built BEFORE editor to validate backend filtering end-to-end
- [v1.1 Research]: MANAGE_GUIDE as single new permission; GuidesModule follows existing module pattern
- [Phase 14]: Used prisma migrate resolve for migration drift recovery instead of prisma migrate dev
- [Phase 14]: PresignGuideDto restricts contentType to image/jpeg, image/png, image/webp only
- [Phase 14]: DOMPurify default import works in NestJS with esModuleInterop: true
- [Phase 14]: 404 returned for inaccessible guide pages instead of 403 to prevent information disclosure
- [Phase 14]: Prisma has operator used for role_codes array membership filtering
- [Phase 15]: DynamicIcon extracted to shared component for Lucide icon name resolution across guide pages
- [Phase 15]: Guide section detail page reuses same TanStack Query cache key as index page for instant navigation
- [Phase 15]: GuideProseRenderer dynamically imported with ssr:false to prevent Tiptap SSR crash
- [Phase 15]: Two-query data fetching: shared sections cache + page-by-ID to avoid slug-based endpoint pitfall
- [Phase 15]: DOMPurify sanitizes generateHTML output before Tiptap editor content as defense-in-depth
- [Phase 16]: Sort-order reorder via Promise.all of two PATCH calls swapping adjacent sort_order values
- [Phase 16]: BubbleMenuPlugin registered programmatically via editor.registerPlugin (Tiptap v3 changed BubbleMenu from React component to Extension)
- [Phase 16]: GuideEditorClient fetches page data client-side via React Query (avoids auth cookie forwarding in SSR)
- [Phase 16]: Content hash uses SHA-256 of getHTML() not getJSON() for autosave (Tiptap v3 JSON is non-deterministic)
- [Phase 17]: Used prisma migrate resolve for migration drift (consistent with Phase 14 approach)
- [Phase 17]: tsvector search pattern: search_text column + trigger sync + GIN index + websearch_to_tsquery
- [Phase 17-03]: Tiptap JSON builder helpers (p, h2, h3, ul, ol, li, doc) for readable seed content generation
- [Phase 17-03]: Word-count read time (200 wpm) replacing JSON string length heuristic for accurate read estimates
- [Phase 17-02]: Admin detection via roleCode check (FOUNDER_ADMIN or TECH_LEAD) matching existing RBAC pattern
- [Phase 17-02]: Client-side section filtering for preview-as-role (no backend role-spoofing needed)
- [Phase 17-02]: Search trigger dispatches synthetic Cmd+K keydown event to reuse overlay keyboard listener
- [Phase 18]: Builder registry pattern: ExportsService holds Map<ReportType, ExportBuilder> for pluggable export builders
- [Phase 18]: Service-level permission check on /exports/generate because required permission varies by report type
- [Phase 18]: putObjectDirect on StorageService bypasses MIME whitelist for server-initiated R2 uploads
- [Phase 18]: VendorPricingExportBuilder uses direct PrismaService injection since VendorPrice has no dedicated service
- [Phase 18]: PO CSV export flattens parent fields onto every line item row for single flat file output
- [Phase 18]: Multi-sheet XLSX pattern: workbook.addWorksheet called per sheet, each with own columns
- [Phase 18]: Channel modifiers exported as global values (not per-item) since ChannelModifier model is global per channel_type
- [Phase 18]: EventGuestListsExportBuilder uses direct PrismaService injection for cross-entity EventBooking query
- [Phase 18]: LeaderboardExportBuilder injects PrismaService directly since LeaderboardService lacks export-suitable method
- [Phase 18]: findAllForExport reuses getOrders filter pattern but removes take/skip for full dataset export
- [Phase 18]: 4 separate analytics builder classes for single-responsibility; default 30-day date range fallback
- [Phase 18]: Buffer.from(arrayBuffer) pattern for ExcelJS writeBuffer to satisfy Node.js Buffer type requirements
- [Phase 18]: DecisionsService.findAllForExport added because findAll is paginated with take/skip
- [Phase 18]: RecipesExportBuilder multi-sheet: Recipes + BOM Lines per D-02 user constraint
- [Phase 18]: WasteService and RecipesService exported from their modules for ExportsModule DI access
- [Phase 18]: TooltipProvider delay prop (not Tooltip delay) for base-ui tooltip component API compatibility
- [Phase 18]: KDS export button placed in fullscreen top bar (no filter bar available)
- [Phase 18]: MANAGE_SYSTEM permission guard for Exports sidebar nav item
- [Phase 21]: PusherService uses graceful fallback (null pusher) when env vars missing, allowing app to start without Pusher for dev
- [Phase 21]: Admin/tech bypass checks role BEFORE participant membership in chat auth endpoint (per D-15, D-16)
- [Phase 21]: Duplicate direct conversation check uses Prisma AND filter with nested participants.some for both user IDs
- [Phase 21]: Message sending restricted to participants only - no admin bypass (D-18) - enforced in controller
- [Phase 21]: Cursor pagination fetches desc then reverses for chronological frontend display
- [Phase 21]: Pusher events update React Query cache directly via setQueryData for instant message UX
- [Phase 21]: Admin read-only determined by active tab state plus participant membership check
- [Phase 21]: Typing indicator uses 2s sender throttle and 3s receiver display timeout per Pusher best practices
- [Phase 21]: Pusher client uses customHandler (not default ajax transport) to forward cookies via credentials: 'include'
- [Phase 21]: Chat layout uses negative margins to break out of ops layout padding for full-height split panel
- [Phase 21]: DropdownMenuTrigger uses className directly (not asChild) since base-ui does not support asChild
- [Phase 21]: ConversationItem unread badge uses dot indicator instead of numeric count for simplicity

### Roadmap Evolution

- Phase 18 added: Data Export — CSV/XLSX export for 22 report types
- Phase 19 added: Master Data Import — ingredients, vendors, vendor pricing
- Phase 20 added: Operations Import — stock, recipes, menu, events, tasks, quests, KPIs
- Phase 21 added: In-App Chat — 1-1 and group messaging with Pusher.js, role-scoped visibility
- Phase 20 added: Operations Import — stock, recipes, menu, events, tasks, quests, KPIs

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-23T15:42:50.943Z
Stopped at: Phase 19 context gathered
Resume file: .planning/phases/19-master-data-import/19-CONTEXT.md
