# Phase 15: Reader View - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff-facing guide reader experience — users browse and read guide pages filtered to their role in a polished, navigable UI. No admin editing, no search, no content seeding in this phase.

Requirements: READ-01, READ-02, READ-05

</domain>

<decisions>
## Implementation Decisions

### Guide Index Layout
- **D-01:** Claude's discretion on layout approach — card grid, list, or magazine style. Should feel polished and use section icon + accent color prominently
- **D-02:** Section cards show page count + total estimated read time ("8 pages · ~25 min total read")
- **D-03:** Cards display section icon, title, description, accent color, page count with read time

### Page Reading View
- **D-04:** Documentation style — clean, focused reading like Notion/Stripe docs. Max-width prose, clear headings, good spacing
- **D-05:** Full header on each page — section breadcrumb, page title, summary, estimated read time, last updated date
- **D-06:** Tiptap JSON content rendered to HTML client-side using `generateHTML()` from @tiptap/html
- **D-07:** Client-side DOMPurify sanitization before rendering (defense-in-depth alongside server-side sanitization from Phase 14)
- **D-08:** Callout blocks rendered with styled tip/warning/info containers matching MagicUI theme
- **D-09:** Inline images rendered at their natural width within max-content-width container

### Sidebar Navigation
- **D-10:** Slide-in overlay sidebar — hamburger menu trigger on both desktop and mobile, maximizes content reading space
- **D-11:** Shows all role-visible sections with their pages listed — collapsible per section
- **D-12:** Current page highlighted in sidebar tree with active state styling
- **D-13:** Section entries show icon + accent color in sidebar for visual orientation

### Loading & Empty States
- **D-14:** Skeleton card placeholders for loading state — animated, matching actual card/page layout
- **D-15:** Friendly empty state when user's role has no sections: "No guides available for your role yet. Check back soon!" with an illustration
- **D-16:** Guide sidebar nav item always visible (even with zero sections — empty state shown on page)

### Routing
- **D-17:** `/guide` — section index page (role-filtered grid of section cards)
- **D-18:** `/guide/[section-slug]` — section page listing all pages in that section
- **D-19:** `/guide/[section-slug]/[page-slug]` — individual page reading view
- **D-20:** "Guide" added to ops sidebar navigation for all authenticated users

### Claude's Discretion
- Exact MagicUI components to use (ShimmerButton, MagicCard, BorderBeam, etc.)
- Typography choices (prose styles, heading sizes, line heights)
- Card grid column count and responsive breakpoints
- Sidebar animation (slide direction, duration, overlay opacity)
- Skeleton placeholder shapes and animation
- Empty state illustration choice
- Mobile responsive behavior and breakpoints
- Tiptap content rendering approach (SSR vs client-only)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 14 Implementation (what exists now)
- `backend/src/guides/guides.service.ts` — GuidesService with CRUD, role filtering, sanitization (the API this phase consumes)
- `backend/src/guides/guides.controller.ts` — 9 REST endpoints this frontend calls
- `backend/prisma/schema.prisma` — GuideSection + GuidePage models (field names, types)
- `.planning/phases/14-foundation/14-CONTEXT.md` — All Phase 14 decisions (data model, permissions, routing)
- `.planning/phases/14-foundation/14-01-SUMMARY.md` — Phase 14 Plan 1 outcomes
- `.planning/phases/14-foundation/14-02-SUMMARY.md` — Phase 14 Plan 2 outcomes

### Existing Frontend Patterns
- `frontend/app/(ops)/layout.tsx` — Ops layout with sidebar (where "Guide" nav item goes)
- `frontend/components/ops/Sidebar.tsx` — Sidebar component (add Guide nav item here)
- `frontend/app/(ops)/operations/recipes/[id]/page.tsx` — Example of slug-based dynamic route
- `frontend/lib/auth.ts` — Auth utilities for fetching with JWT
- `frontend/components/ui/magic-card.tsx` — MagicUI card component (reuse for section cards)
- `frontend/components/ui/shimmer-button.tsx` — MagicUI shimmer (for loading states)

### Research
- `.planning/research/STACK.md` — Tiptap v3 versions, generateHTML for rendering
- `.planning/research/FEATURES.md` — Feature landscape, reader view patterns
- `.planning/research/PITFALLS.md` — SSR issues with Tiptap, bundle size concerns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MagicCard` component — use for section index cards with accent color
- `BorderBeam` — accent color border animations for section cards
- `ShimmerButton` — CTA buttons in empty states
- Existing skeleton loading patterns in `frontend/app/(ops)/loading.tsx`
- Auth store (`frontend/lib/stores/auth-store.ts`) for user role detection

### Established Patterns
- Ops pages use `(ops)` route group with shared layout and sidebar
- Data fetching via `fetch` with JWT from auth store
- Loading states via Next.js `loading.tsx` convention
- Responsive design with Tailwind breakpoints (sm/md/lg/xl)

### Integration Points
- `Sidebar.tsx` — add "Guide" nav item (BookOpen icon from Lucide)
- `(ops)/guide/` — new route group for guide pages
- Backend API at `/guide/sections` and `/guide/sections/:slug/pages/:slug` for data

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants "rich UI, not some static bullshit" — this phase must deliver polished, professional reader experience
- Documentation style reading (Notion/Stripe docs) with MagicUI components for visual richness
- Accent colors from sections should be visually prominent on cards and headers
- Section icons should be prominent and contribute to visual identity

</specifics>

<deferred>
## Deferred Ideas

- Tiptap editor integration — Phase 16
- Full-text search — Phase 17
- Admin preview-as-role — Phase 17
- Content seeding — Phase 17
- Print/export guide pages — Future
- Contextual "?" help links in app headers — Future

</deferred>

---

*Phase: 15-reader-view*
*Context gathered: 2026-03-22*
