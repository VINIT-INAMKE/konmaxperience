---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: User Guide & Data Management
status: unknown
stopped_at: Completed 18-03-PLAN.md
last_updated: "2026-03-23T08:41:45.550Z"
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 16
  completed_plans: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Every piece of work must be evidence-backed, approved, and validated before it counts -- turning real execution into measurable readiness and progress.
**Current focus:** Phase 18 — data-export

## Current Position

Phase: 18 (data-export) — EXECUTING
Plan: 3 of 7

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

### Roadmap Evolution

- Phase 18 added: Data Export — CSV/XLSX export for 22 report types
- Phase 19 added: Master Data Import — ingredients, vendors, vendor pricing
- Phase 20 added: Operations Import — stock, recipes, menu, events, tasks, quests, KPIs

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-23T08:41:45.540Z
Stopped at: Completed 18-03-PLAN.md
Resume file: None
