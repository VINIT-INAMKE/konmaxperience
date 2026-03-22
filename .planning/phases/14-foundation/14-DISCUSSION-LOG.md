# Phase 14: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 14-foundation
**Areas discussed:** Section taxonomy, Page content model, Role assignment UX, Guide access point

---

## Section Taxonomy

### Organization Style

| Option | Description | Selected |
|--------|-------------|----------|
| By feature area | Kitchen, POS, Inventory, etc. — maps to app structure | |
| By role | One section per role: 'Production Lead Guide', etc. | |
| Hybrid | Feature-area sections tagged with which roles they apply to | ✓ |

**User's choice:** Hybrid
**Notes:** Feature-area sections, each tagged with roles via multi-select. Multiple roles can share sections.

### Visual Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Icon + color per section | Admin picks icon and accent color | ✓ |
| Icon only | Icon per section, consistent color scheme | |
| Plain text | Just titles and descriptions | |

**User's choice:** Icon + color per section

### Section Description

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, short description | 2-3 line summary on guide index card | ✓ |
| Title + icon only | Description on section's own page only | |

**User's choice:** Yes, short description

---

## Page Content Model

### Metadata Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Slug + summary | URL-friendly slug + short summary for search results | |
| Full metadata | Slug + summary + estimated read time + last-edited tracking | ✓ |
| Minimal | Title, content, sort order, draft/published status only | |

**User's choice:** Full metadata

### Edit Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show editor info | 'Last edited by [name] on [date]' | |
| No, not needed | Small team, admin-only editing | ✓ |

**User's choice:** No edit tracking
**Notes:** Despite choosing "full metadata", user explicitly opted out of edit tracking — read time and summary are wanted, but who-edited-when is not.

---

## Role Assignment UX

### Assignment Method

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-select checkboxes | Admin checks off roles from list of 8 | ✓ |
| All visible by default | New sections visible to all, admin unchecks to restrict | |
| No roles by default | Hidden until admin assigns — safer for drafts | |

**User's choice:** Multi-select checkboxes
**Notes:** Combined with "no roles by default" being the initial state (safer for draft content).

### Admin/Tech Access

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, always all | FOUNDER_ADMIN and TECH_LEAD bypass role filter | ✓ |
| Respect mapping | Admin/tech only see sections they're mapped to | |

**User's choice:** Always all — admin/tech bypass role filter

---

## Guide Access Point

### Navigation Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar nav item | Dedicated 'Guide' in sidebar, same level as Missions, Operations | |
| Under admin section | Management in admin, reader via top-bar help icon | |
| Both | Sidebar 'Guide' for reading + admin section for managing | ✓ |

**User's choice:** Both

### Route Structure

| Option | Description | Selected |
|--------|-------------|----------|
| /guide/[section]/[page] | Clean slugs: /guide/kitchen/create-prep-batch | ✓ |
| /guide/[id] | UUID-based: simpler routing | |
| Slug for reader, ID for admin | Slug URLs for reading, /admin/guide/[id] for editing | |

**User's choice:** /guide/[section]/[page] — clean slug-based URLs

---

## Claude's Discretion

- Exact Prisma model field names and types
- API endpoint design and REST conventions
- Slug generation strategy
- Estimated read time calculation
- Sanitization allowlist configuration

## Deferred Ideas

- Frontend reader view (Phase 15)
- Tiptap editor (Phase 16)
- Full-text search (Phase 17)
- Content seeding (Phase 17)
