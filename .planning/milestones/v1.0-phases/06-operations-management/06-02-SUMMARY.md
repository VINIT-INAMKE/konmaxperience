---
phase: 06-operations-management
plan: 02
subsystem: ui
tags: [react, nextjs, tanstack-query, lucide, magicui, shadcn, base-ui]

# Dependency graph
requires:
  - phase: 06-01
    provides: Zone and Brand REST APIs (/zones, /brands) with MANAGE_OPS permission gate

provides:
  - Zone management page at /operations/zones with card grid, filter tabs, Sheet form, and delete Dialog
  - Brand management page at /operations/brands with card grid, filter tabs, Sheet form, and delete Dialog
  - ZoneCard, ZoneForm, ZoneStatusBadge components under frontend/components/ops/operations/zones/
  - BrandCard, BrandForm, BrandStatusBadge components under frontend/components/ops/operations/brands/
  - Zone and Brand TypeScript interfaces in frontend/lib/types/
  - Sidebar Operations section with 4 nav items (Zones, Brands, Channels, Assets)

affects:
  - 06-03 (Channels and Assets pages — same operations section)
  - verifier (UI verification for zone/brand pages)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Card grid with MagicCard + ShineBorder highlight on newly created items (3 seconds)
    - Sheet-based create/edit form with zone/brand-type Select, status Select (edit mode only), owner Select (admin only)
    - Client-side status filter tabs (Tabs component) + search input combined filter pattern
    - ZoneStatusBadge/BrandStatusBadge using Badge variant="outline" with text-{color}-400 border-{color}-500/30
    - Admin-only ShimmerButton CTA + edit/delete visibility gated by isAdmin || currentUserId === owner_user_id
    - useQuery invalidation pattern after create/edit/delete with separate newEntityId state for ShineBorder trigger

key-files:
  created:
    - frontend/lib/types/zone.ts
    - frontend/lib/types/brand.ts
    - frontend/components/ops/operations/zones/ZoneStatusBadge.tsx
    - frontend/components/ops/operations/zones/ZoneCard.tsx
    - frontend/components/ops/operations/zones/ZoneForm.tsx
    - frontend/components/ops/operations/brands/BrandStatusBadge.tsx
    - frontend/components/ops/operations/brands/BrandCard.tsx
    - frontend/components/ops/operations/brands/BrandForm.tsx
    - frontend/app/(ops)/operations/zones/page.tsx
    - frontend/app/(ops)/operations/brands/page.tsx
  modified:
    - frontend/components/ops/Sidebar.tsx

key-decisions:
  - "ZoneForm and BrandForm both accept an optional zone/brand prop to handle create vs edit in a single component — avoids code duplication"
  - "Status Select shown only in edit mode per plan spec — prevents setting status on creation (defaults to initial state server-side)"
  - "Operations nav section not admin-gated — visible to all authenticated users per RESEARCH decision and UI-SPEC"
  - "Empty state shown when filteredZones/filteredBrands.length === 0 (post-filter) — correctly shows when filter finds nothing"

patterns-established:
  - "ZoneCard/BrandCard: relative container with ShineBorder absolute overlay + MagicCard for interactive spotlight"
  - "ZoneForm/BrandForm: useEffect to populate fields on zone/brand prop change — supports reuse for create and edit"
  - "Pages follow decisions/page.tsx pattern: BlurFade > header > filter bar > grid > Sheet + Dialog"

requirements-completed: [OPS-01, OPS-02]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 06 Plan 02: Operations Frontend (Zones and Brands) Summary

**Zone and Brand management pages with MagicCard grids, Sheet forms, status filter tabs, and sidebar Operations section with 4 nav items**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T09:21:37Z
- **Completed:** 2026-03-21T09:26:41Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Zone page at /operations/zones with responsive card grid (1/2/3 cols), status filter tabs (All/Planned/Setup/Active/Inactive), search, MagicCard cards with type icons, ZoneForm Sheet, and delete Dialog
- Brand page at /operations/brands with responsive card grid, status filter tabs (All/Idea/Planning/Development/Active/Paused), search, MagicCard cards with type badges, BrandForm Sheet, and delete Dialog
- Sidebar updated with Operations section (Zones, Brands, Channels, Assets) between Intelligence and Admin, visible to all users

## Task Commits

Each task was committed atomically:

1. **Task 1: Frontend types and Sidebar Operations section** - `698ef43` (feat)
2. **Task 2: Zones and Brands pages with card grids, forms, and status badges** - `a767e6e` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `frontend/lib/types/zone.ts` - Zone, ZoneStatus, ZoneType interfaces, ZONE_STATUS_LABELS, ZONE_TYPE_LABELS, ZONE_STATUSES, ZONE_TYPES
- `frontend/lib/types/brand.ts` - Brand, BrandStatus, BrandType interfaces, BRAND_STATUS_LABELS, BRAND_TYPE_LABELS, BRAND_STATUSES, BRAND_TYPES
- `frontend/components/ops/Sidebar.tsx` - Added MapPin/Tag/Radio/FolderOpen imports, operationsNav array, Operations section in JSX
- `frontend/components/ops/operations/zones/ZoneStatusBadge.tsx` - Badge with planned→amber, setup→blue, active→green, inactive→zinc
- `frontend/components/ops/operations/zones/ZoneCard.tsx` - MagicCard with type icon+tooltip, name, status badge, owner avatar, edit/delete
- `frontend/components/ops/operations/zones/ZoneForm.tsx` - Sheet form for create/edit with name, zone_type, status (edit), owner (admin), notes
- `frontend/components/ops/operations/brands/BrandStatusBadge.tsx` - Badge with idea→purple, planning→blue, development→cyan, active→green, paused→amber
- `frontend/components/ops/operations/brands/BrandCard.tsx` - MagicCard with brand name, type badge, status badge, owner avatar, edit/delete
- `frontend/components/ops/operations/brands/BrandForm.tsx` - Sheet form for create/edit with name, brand_type, status (edit), owner (admin), notes
- `frontend/app/(ops)/operations/zones/page.tsx` - Zones list page with BlurFade, filter tabs, search, card grid, ZoneForm Sheet, delete Dialog
- `frontend/app/(ops)/operations/brands/page.tsx` - Brands list page with BlurFade, filter tabs, search, card grid, BrandForm Sheet, delete Dialog

## Decisions Made

- ZoneForm and BrandForm both accept an optional zone/brand prop — single component handles both create (no prop) and edit (with prop). useEffect repopulates fields on prop/open change.
- Status Select only shown in edit mode — new zones/brands use server default status (planned for zones, idea for brands).
- Operations nav section not admin-gated — visible to all authenticated users per RESEARCH recommendation.
- Empty state text matches UI-SPEC copywriting contract exactly: "No zones yet" / "Add the physical spaces your villa operates in." and "No brands yet" / "Add your food, art, or lifestyle brands to get started."

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `ChannelStatusToggle.tsx` and `AssetRow.tsx` (from Phase 06-01, using `asChild` prop on base-ui components that don't support it). These are out-of-scope for this plan and not introduced by our changes. No new TypeScript errors from this plan's files.

## Known Stubs

None — all data flows are wired to live API calls (GET /zones, GET /brands, POST /zones, PATCH /zones/:id, DELETE /zones/:id, POST /brands, PATCH /brands/:id, DELETE /brands/:id). No hardcoded mock data.

## Next Phase Readiness

- Zones and Brands pages are fully functional pending backend running
- Phase 06-03 (Channels and Assets pages) can proceed — sidebar Operations section already has Channels and Assets nav items
- Pre-existing TypeScript errors in channels and assets components should be resolved in 06-03

---
*Phase: 06-operations-management*
*Completed: 2026-03-21*
