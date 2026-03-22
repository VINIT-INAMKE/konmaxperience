# Phase 16: Admin CMS - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin-facing content management UI — Tiptap rich text editor with inline images, callout blocks, and publish controls. Admin can create/edit/reorder sections and pages through a dedicated management interface. No search, no preview-as-role, no content seeding in this phase.

Requirements: EDIT-01, EDIT-02, EDIT-03

</domain>

<decisions>
## Implementation Decisions

### Editor Toolbar
- **D-01:** Dual toolbar approach — fixed top bar for block-level actions (headings, lists, images, callouts) + floating bubble menu for inline formatting (bold, italic, links) when text is selected
- **D-02:** Formatting options: headings (h2, h3, h4), bold, italic, underline, links, ordered/unordered lists, images, callout blocks (tip/warning/info). No tables, no horizontal rules
- **D-03:** Tiptap editor loaded via `dynamic({ ssr: false })` with `immediatelyRender: false` per research findings

### Image Upload
- **D-04:** Three upload paths — toolbar button (file picker), drag-drop onto editor, paste from clipboard. All use R2 presigned URL flow via POST /storage/presign-guide
- **D-05:** Upload feedback: inline blurred placeholder in editor with progress bar overlay. Swaps to final R2 URL on completion
- **D-06:** Image-only MIME types (image/jpeg, image/png, image/webp) enforced by presign-guide DTO

### Section/Page Management
- **D-07:** Dedicated admin page at `/admin/guide` with section list, expand to see pages, inline actions (edit, delete, reorder)
- **D-08:** Section create/edit uses Sheet form pattern (consistent with rest of app — events, vendors, zones)
- **D-09:** Page create opens the full Tiptap editor at `/admin/guide/pages/[id]`
- **D-10:** Reorder approach is Claude's discretion (drag-and-drop vs up/down arrows)
- **D-11:** Section form includes: title, description, icon picker, accent color picker, role multi-select checkboxes
- **D-12:** Delete section shows confirmation dialog (destructive — cascades to pages)

### Publish Workflow
- **D-13:** All saves default to draft status. Explicit "Publish" button to make content visible to assigned roles
- **D-14:** Autosave to draft every 5 seconds (debounced, content-hash check to avoid unnecessary saves) + "Saved" indicator
- **D-15:** Explicit "Publish" action for going live — separate from autosave
- **D-16:** Unsaved changes warning when navigating away from editor with pending changes
- **D-17:** "Unpublish" action to revert a published page back to draft

### Claude's Discretion
- Tiptap extensions list and configuration
- Toolbar icon choices and grouping
- Bubble menu positioning and animation
- Icon picker component implementation (predefined list vs Lucide search)
- Color picker component (predefined palette vs free-form hex)
- Reorder UX approach (drag-drop vs arrows)
- Editor page layout (sidebar vs full-width)
- Autosave debounce timing and hash implementation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 14 Backend (API this phase consumes)
- `backend/src/guides/guides.service.ts` — CRUD operations, sanitization, slug generation
- `backend/src/guides/guides.controller.ts` — 9 REST endpoints (POST/PATCH/DELETE for sections and pages)
- `backend/src/guides/dto/create-section.dto.ts` — Section creation fields
- `backend/src/guides/dto/create-page.dto.ts` — Page creation fields (content as string)
- `backend/src/storage/storage.controller.ts` — presign-guide endpoint

### Phase 15 Reader (components to reuse/extend)
- `frontend/components/ops/guide/GuideProseRenderer.tsx` — Read-only Tiptap renderer (reference for editor config)
- `frontend/components/ops/guide/GuideCalloutBlock.tsx` — Callout Tiptap extension (reuse in editor)
- `frontend/components/ops/guide/DynamicIcon.tsx` — Lucide icon resolver (reuse in icon picker)
- `frontend/lib/types/guides.ts` — TypeScript interfaces

### Research
- `.planning/research/STACK.md` — Tiptap v3 versions, breaking changes, SSR guards
- `.planning/research/PITFALLS.md` — CVE-2025-14284 on link extension (pin >=2.10.4), bundle size

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GuideCalloutBlock` Tiptap extension — reuse directly in editor
- `DynamicIcon` component — reuse for icon picker display
- `StorageService` presign-guide endpoint — already built for image uploads
- Sheet component from shadcn — for section/page management forms
- Existing admin page patterns (`/admin/users`, `/admin/settings`, `/admin/delegations`)

### Established Patterns
- Admin pages at `(ops)/admin/` route group
- Sheet-based forms for CRUD operations (EventForm, VendorForm, ZoneForm)
- `@RequiresPermission` on backend, permission check on frontend via auth store
- Sonner toast for success/error notifications
- React Query for data fetching with cache invalidation on mutations

### Integration Points
- `/admin/guide` — new admin route for guide management
- `/admin/guide/pages/[id]` — editor route for page content
- Sidebar admin nav — add "Guide Management" item under admin section
- Backend PATCH /guide/sections/:id and PATCH /guide/pages/:id for updates

</code_context>

<specifics>
## Specific Ideas

- User wants "rich UI, not some static bullshit" — editor must feel professional and polished
- Autosave + explicit publish is the core UX pattern (like Notion)
- Three image upload paths (toolbar, drag-drop, paste) for maximum convenience
- Dual toolbar (fixed + bubble) for best of both worlds

</specifics>

<deferred>
## Deferred Ideas

- Full-text search — Phase 17
- Admin preview-as-role — Phase 17
- Content seeding from codebase — Phase 17
- Version history / undo — Future
- Collaborative editing — Future
- AI-assisted content generation — Future

</deferred>

---

*Phase: 16-admin-cms*
*Context gathered: 2026-03-22*
