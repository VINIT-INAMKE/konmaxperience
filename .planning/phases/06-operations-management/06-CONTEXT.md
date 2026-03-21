# Phase 6: Operations Management - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

CRUD and lifecycle management for villa zones, brands, sales channels, and operational assets. All 4 models already exist in schema — Phase 6 builds NestJS modules, frontend pages, seed data, and the asset upload flow (reusing R2 presigned URLs from Phase 3). No new entity types, no recipe/inventory logic (Phase 7+).

</domain>

<decisions>
## Implementation Decisions

### Zone Management
- **D-01:** 8 default zones seeded: Main Kitchen (kitchen), Prep Station (kitchen), Dining Hall (dining), Garden Terrace (outdoor), Workshop Studio (workspace), Cold Storage (storage), Office (workspace), Lounge (leisure)
- **D-02:** Zone statuses: planned → setup → active → inactive (4-state lifecycle)
- **D-03:** Admin creates zones and assigns an owner. Owner can edit their zone's details and status. Admin can reassign ownership.
- **D-04:** Zone page shows a grid/list of all zones with status badges, owner name, and zone type

### Brand Lifecycle
- **D-05:** 2 brands seeded: Konma Food (food, active), Just Craves (food, active)
- **D-06:** Brand statuses: idea → planning → development → active → paused (5-state lifecycle)
- **D-07:** Brand types from schema: food, art, lifestyle
- **D-08:** Brands have an owner (owner_user_id). Admin assigns owner. Owner can edit brand details and manage its assets.

### Sales Channels
- **D-09:** All 7 channels seeded with status=planned: Dine-in, Delivery, Takeaway, Retail, Event, Workshop, Online
- **D-10:** Channel statuses: planned → active → inactive. Admin toggles activation.
- **D-11:** Channels are simple entities — name, type, status. No complex configuration in v1.

### Asset Library
- **D-12:** Asset types: recipe, sop, menu, cost_sheet, training_doc
- **D-13:** Asset status workflow: draft → in_review → approved / rejected. Simple status toggle by admin or creator — no formal Approval record. Only assets with status=approved are candidates for customer-facing display.
- **D-14:** Asset upload reuses R2 presigned URL flow from Phase 3 (StorageService). Same MIME/size validation.
- **D-15:** Assets link to a brand (linked_brand_id) and optionally to a task (linked_task_id) — both already in schema.

### Navigation
- **D-16:** New "Operations" sidebar section between Intelligence and Admin: Zones, Brands, Channels, Assets — 4 pages.

### Claude's Discretion
- Zone/brand/channel page layouts (cards vs table, responsive breakpoints)
- Asset list filtering and sorting options
- Zone type icons/colors
- Brand status transition UI (dropdown vs button flow)
- Channel activation toggle design
- Asset preview behavior (inline preview vs new tab)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain Model & Schema
- `contextdocs/dev_spec.md` §7.13 (zones) — Zone schema with type, owner, status
- `contextdocs/dev_spec.md` §7.14 (brands) — Brand schema with type, status, owner
- `contextdocs/dev_spec.md` §7.15 (channels) — Channel schema with type, status
- `contextdocs/dev_spec.md` §7.16 (assets) — Asset schema with type, status, linked entities

### Existing Implementation
- `backend/prisma/schema.prisma` — Zone (lines 274-282), Brand (284-293), Channel (295-300), Asset (302-315) models
- `backend/src/storage/storage.service.ts` — R2 presigned URL generation (reuse for asset upload)
- `backend/prisma/seed.ts` — Existing zone seeds (will be replaced with D-01 zones)

### Food Production Pipeline
- `docs/superpowers/specs/2026-03-20-food-production-pipeline-design.md` — Brand → Category → Items hierarchy for Phases 7-13. Phase 6 brands are the parent entities.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/storage/storage.service.ts` — R2 presigned URL for asset upload (same as evidence)
- `backend/src/storage/storage.controller.ts` — Presigned URL endpoint pattern
- `frontend/components/ops/evidence/EvidenceUploadZone.tsx` — Drag-drop upload zone pattern (reusable for asset upload)
- `frontend/components/ui/magic-card.tsx` — MagicCard for entity cards
- `frontend/components/ui/badge.tsx` — Status badges
- `frontend/components/ui/shimmer-button.tsx` — Create action buttons

### Established Patterns
- NestJS Module → Controller → Service → Prisma
- React Query for server state, Sheet for create/edit forms
- Sonner toast for notifications
- Sidebar nav grouped by section (Dashboard, Work, Intelligence, Operations, Admin)
- buildScopeFilter for data-layer RBAC

### Integration Points
- Sidebar: New "Operations" section with 4 nav items
- Seed: Replace existing zone seeds with D-01 zones, add brands + channels
- Storage: Reuse StorageService for asset presigned URLs
- Future: Phase 7 recipes reference brands, Phase 10 POS references channels

</code_context>

<specifics>
## Specific Ideas

- Operations pages should feel like admin panels — functional, data-dense, not flashy. Tables or card grids with quick actions.
- Asset upload should feel like the evidence upload flow — familiar UX pattern.
- Brand lifecycle is the most interesting entity — the status progression from "idea" to "active" should feel meaningful.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-operations-management*
*Context gathered: 2026-03-21*
