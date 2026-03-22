# Phase 15: Reader View - Research

**Researched:** 2026-03-22
**Domain:** Tiptap v3 read-only rendering, Next.js 16 dynamic routing, client-side HTML sanitization, Tailwind v4 typography
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Claude's discretion on layout approach — card grid, list, or magazine style. Should feel polished and use section icon + accent color prominently
- **D-02:** Section cards show page count + total estimated read time ("8 pages · ~25 min total read")
- **D-03:** Cards display section icon, title, description, accent color, page count with read time
- **D-04:** Documentation style — clean, focused reading like Notion/Stripe docs. Max-width prose, clear headings, good spacing
- **D-05:** Full header on each page — section breadcrumb, page title, summary, estimated read time, last updated date
- **D-06:** Tiptap JSON content rendered to HTML client-side using `generateHTML()` from @tiptap/html
- **D-07:** Client-side DOMPurify sanitization before rendering (defense-in-depth alongside server-side sanitization from Phase 14)
- **D-08:** Callout blocks rendered with styled tip/warning/info containers matching MagicUI theme
- **D-09:** Inline images rendered at their natural width within max-content-width container
- **D-10:** Slide-in overlay sidebar — hamburger menu trigger on both desktop and mobile, maximizes content reading space
- **D-11:** Shows all role-visible sections with their pages listed — collapsible per section
- **D-12:** Current page highlighted in sidebar tree with active state styling
- **D-13:** Section entries show icon + accent color in sidebar for visual orientation
- **D-14:** Skeleton card placeholders for loading state — animated, matching actual card/page layout
- **D-15:** Friendly empty state when user's role has no sections: "No guides available for your role yet. Check back soon!" with an illustration
- **D-16:** Guide sidebar nav item always visible (even with zero sections — empty state shown on page)
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

### Deferred Ideas (OUT OF SCOPE)

- Tiptap editor integration — Phase 16
- Full-text search — Phase 17
- Admin preview-as-role — Phase 17
- Content seeding — Phase 17
- Print/export guide pages — Future
- Contextual "?" help links in app headers — Future
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| READ-01 | User sees only guide sections assigned to their role on the guide index page | Backend `GET /guide/sections` already filters by `roleCode` in `GuidesService.findSections()` — frontend just fetches and renders what it receives |
| READ-02 | User can read guide pages in a polished, styled view with MagicUI components | Tiptap `useEditor({ editable: false })` + isomorphic-dompurify + MagicCard/BorderBeam already installed — pure frontend build |
| READ-05 | Guide pages render with section sidebar navigation for easy browsing | shadcn `Sheet` component already installed, `GuideSidebarSheet` wraps the section tree and is triggered by a hamburger button |
</phase_requirements>

---

## Summary

Phase 15 is a pure-frontend phase — the backend API from Phase 14 is already complete and role-filters data correctly. The entire work is building three Next.js pages and seven new components that consume `GET /guide/sections` and `GET /guide/pages/:id` to render a polished, Notion/Stripe-docs-style reader experience.

The most critical technical decision was already locked in CONTEXT.md (D-06): render Tiptap content using a **read-only Tiptap editor instance** (`editable: false`, `immediatelyRender: false`) rather than `generateHTML` + `dangerouslySetInnerHTML`. The UI-SPEC elaborates this in the `GuideProseRenderer` spec: use `useEditor` with `editable: false` and pass content parsed from the stored `String @db.Text` value. This avoids a `dangerouslySetInnerHTML` surface entirely while still requiring `isomorphic-dompurify` sanitization as defense-in-depth.

Two non-obvious discoveries require planner attention: (1) `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`, and `isomorphic-dompurify` are NOT yet installed in the frontend — they must be installed in Wave 0 before any component can be written. (2) `@tailwindcss/typography` (the `prose` class source) is also NOT installed, and the prose container in the UI-SPEC relies on it — it must be installed and registered via `@plugin '@tailwindcss/typography'` in `globals.css`.

**Primary recommendation:** Wave 0 must install all Tiptap packages, isomorphic-dompurify, and @tailwindcss/typography. All Tiptap components must be wrapped in `dynamic(() => import(...), { ssr: false })` when consumed from page-level components to avoid SSR errors. Implement the three pages sequentially: `/guide` → `/guide/[sectionSlug]` → `/guide/[sectionSlug]/[pageSlug]`, with the sidebar overlay shared across the latter two.

---

## Standard Stack

### Core (New Installations Required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tiptap/react` | ^3.20.4 | Read-only editor instance with `useEditor` hook | Required for `editable: false` rendering pattern per D-06; v3 ships with `immediatelyRender: false` to prevent SSR crashes |
| `@tiptap/pm` | ^3.20.4 | ProseMirror engine peer dep | Mandatory alongside @tiptap/react; already required by backend |
| `@tiptap/starter-kit` | ^3.20.4 | Headings, paragraphs, lists, bold, italic, blockquote extensions | Single bundle for all content node types present in guide content |
| `@tiptap/extension-image` | ^3.20.4 | Image node rendering | Required to render inline images stored as R2 URLs in page content |
| `isomorphic-dompurify` | ^2.x | Client-side XSS sanitization of content before passing to editor | Defense-in-depth per D-07; works in both server and client contexts |
| `@tailwindcss/typography` | ^0.5.19 | `prose` CSS class for Tiptap-rendered HTML typography | Required for the `prose prose-neutral dark:prose-invert` container on page reading view |

**Version verification (npm registry, 2026-03-22):**

| Package | Registry Version | Publish Date |
|---------|-----------------|--------------|
| @tiptap/react | 3.20.4 | ~2026-03-19 |
| @tiptap/pm | 3.20.4 | ~2026-03-19 |
| @tiptap/starter-kit | 3.20.4 | ~2026-03-19 |
| @tiptap/extension-image | 3.20.4 | ~2026-03-19 |
| isomorphic-dompurify | 3.6.0 | (check jsdom compat — see Pitfalls) |
| @tailwindcss/typography | 0.5.19 | stable |

### Already Installed (No Install Needed)

| Library | Version | Purpose |
|---------|---------|---------|
| `date-fns` | ^4.1.0 | `formatDistanceToNow` for "Updated 3 days ago" display in page header |
| `lucide-react` | ^0.577.0 | Icons: `BookOpen`, `ChevronRight`, `ChevronDown`, `CheckCircle2`, `AlertTriangle`, `Info`, `X`, `Menu` |
| `motion` | ^12.38.0 | Already used by `MagicCard` and `BorderBeam` components |
| `@tanstack/react-query` | ^5.91.2 | Data fetching pattern already established across all ops pages |
| shadcn `Sheet` | installed | Guide sidebar overlay container |
| shadcn `Skeleton` | installed | Loading placeholders |
| shadcn `ScrollArea` | installed | Sidebar scroll container |
| shadcn `Separator` | installed | Page header divider |
| `MagicCard` | `@/components/ui/magic-card.tsx` | Section index cards |
| `BorderBeam` | `@/components/ui/border-beam.tsx` | Section card decoration on hover |

### Installation

```bash
# Run inside /frontend
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-image isomorphic-dompurify @tailwindcss/typography
```

After installing, add to `frontend/app/globals.css` after the existing `@import` lines:

```css
@plugin '@tailwindcss/typography';
```

**isomorphic-dompurify jsdom pin:** The existing `frontend/package.json` must have an `overrides` entry to prevent jsdom@28 breakage:

```json
"overrides": {
  "jsdom": "25.0.1"
}
```

Run `npm install` again after adding the override to resolve the pinned version.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/app/(ops)/guide/
├── page.tsx                          # /guide — section index (role-filtered grid)
├── loading.tsx                       # Skeleton for section index
├── [sectionSlug]/
│   ├── page.tsx                      # /guide/[sectionSlug] — section page (page list)
│   └── [pageSlug]/
│       └── page.tsx                  # /guide/[sectionSlug]/[pageSlug] — page reading view

frontend/components/ops/guide/
├── GuideSectionCard.tsx              # MagicCard + BorderBeam + section metadata
├── GuideSidebarSheet.tsx             # Collapsible section tree in Sheet overlay
├── GuidePageHeader.tsx               # Breadcrumb + title + summary + metadata row
├── GuideProseRenderer.tsx            # Read-only Tiptap instance ("use client")
├── GuideCalloutBlock.tsx             # Tip/warning/info styled containers
├── GuideSectionIndexSkeleton.tsx     # 3-column skeleton grid
└── GuidePageSkeleton.tsx             # Page reading view skeleton
```

### Pattern 1: Read-Only Tiptap Rendering

**What:** Use `useEditor({ editable: false, immediatelyRender: false })` to render stored guide page content. Content stored as `String @db.Text` (JSON-stringified Tiptap doc) is parsed and sanitized before passing to the editor.

**When to use:** For the `GuideProseRenderer` component on `/guide/[sectionSlug]/[pageSlug]` page view.

**Why `editable: false` over `generateHTML` + `dangerouslySetInnerHTML`:** The read-only editor avoids a `dangerouslySetInnerHTML` surface entirely. Content is still sanitized with `isomorphic-dompurify` as defense-in-depth per D-07, but the Tiptap editor itself renders the node tree — not raw HTML.

```typescript
// Source: CONTEXT.md D-06, UI-SPEC GuideProseRenderer spec
// frontend/components/ops/guide/GuideProseRenderer.tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import DOMPurify from 'isomorphic-dompurify';
import { generateHTML } from '@tiptap/html';

interface GuideProseRendererProps {
  content: string; // JSON-stringified Tiptap doc from API (String @db.Text)
}

export function GuideProseRenderer({ content }: GuideProseRendererProps) {
  // Parse raw string → JSON → sanitize HTML intermediate → pass to editor
  let parsedContent: Record<string, unknown> | null = null;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    parsedContent = null;
  }

  // Defense-in-depth: sanitize generateHTML output before using as content source
  const extensions = [StarterKit, Image];
  const sanitizedHtml = parsedContent
    ? DOMPurify.sanitize(generateHTML(parsedContent as any, extensions))
    : '';

  const editor = useEditor({
    extensions,
    editable: false,
    immediatelyRender: false,
    content: sanitizedHtml,
  });

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none text-[16px] leading-[1.75]">
      <EditorContent editor={editor} />
    </div>
  );
}
```

**IMPORTANT — `@tiptap/html` import source:** `generateHTML` must be imported from `@tiptap/html`, NOT `@tiptap/core`. The `@tiptap/core` export is browser-only and crashes in Node.js. However since `GuideProseRenderer` is a `"use client"` component, both work — but use `@tiptap/html` for consistency with the research recommendation.

### Pattern 2: Dynamic Import to Prevent SSR Errors

**What:** Pages that render `GuideProseRenderer` must import it via `next/dynamic` with `{ ssr: false }`.

**When to use:** In the `/guide/[sectionSlug]/[pageSlug]/page.tsx` page component.

```typescript
// Source: PITFALLS.md Pitfall 1 — SSR hydration mismatch
import dynamic from 'next/dynamic';

const GuideProseRenderer = dynamic(
  () => import('@/components/ops/guide/GuideProseRenderer').then(m => m.GuideProseRenderer),
  { ssr: false }
);
```

### Pattern 3: Next.js 16 Dynamic Route Params (Breaking Change)

**What:** In Next.js 16, `params` in page components is a `Promise<{ slug: string }>`, not a plain object. Client components must use the `use()` React hook to unwrap it.

**Confirmed from:** Official Next.js 16 docs at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`

```typescript
// Source: Next.js 16 official docs — dynamic-routes.md
// Pattern used by existing missions/[id]/page.tsx in this codebase
'use client';
import { use } from 'react';

export default function GuidePage({
  params,
}: {
  params: Promise<{ sectionSlug: string; pageSlug: string }>;
}) {
  const { sectionSlug, pageSlug } = use(params);
  // ...
}
```

**Existing codebase precedent:** `frontend/app/(ops)/missions/[id]/page.tsx` uses `use(params)`. Other pages use `useParams()` hook from `next/navigation` — both patterns are valid in Next.js 16 client components.

### Pattern 4: API Lookups by Slug

**What:** The backend API's `GET /guide/sections` returns all visible sections with their pages included (shallow select). It does NOT have a slug-based section lookup endpoint. The `GET /guide/pages/:id` endpoint takes UUID, not slug.

**Confirmed from:** `guides.controller.ts` — endpoints are:
- `GET /guide/sections` — returns all visible sections with pages (role-filtered)
- `GET /guide/sections/:id` — by UUID only
- `GET /guide/pages/:id` — by UUID only

**Implication for routing:** The frontend must do one of:
1. Fetch all sections with `GET /guide/sections`, then find the section by `slug` in the response array — works at `/guide/[sectionSlug]` page
2. Find the page by `slug` within the matching section's pages array — works at `/guide/[sectionSlug]/[pageSlug]` page, but requires fetching all sections to get the page ID, then fetching the page content separately

**Recommended approach (confirmed by CONTEXT.md canonical refs):**
- For the section index (`/guide`): fetch `GET /guide/sections` once, render all sections
- For section page (`/guide/[sectionSlug]`): fetch `GET /guide/sections`, find section by slug, display its pages list
- For page view (`/guide/[sectionSlug]/[pageSlug]`): fetch `GET /guide/sections` to get page IDs, then `GET /guide/pages/:id` for full content — OR use TanStack Query to cache the sections response and avoid double fetch

The planner should structure these as two separate queries using TanStack Query with appropriate `queryKey` caching to avoid redundant API calls.

### Pattern 5: GuideSidebarSheet Data Flow

**What:** The `GuideSidebarSheet` needs access to all visible sections and their pages to render the navigation tree. It also needs to know the current `sectionSlug` and `pageSlug` to highlight the active page.

**Implementation:** Pass `sections` data as a prop (already fetched by the parent page), and read `sectionSlug`/`pageSlug` from URL via `usePathname()` or `useParams()`.

```typescript
// Pattern: sidebar receives pre-fetched sections and compares slugs for active state
interface GuideSidebarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: GuideSection[];
  activeSectionSlug?: string;
  activePageSlug?: string;
}
```

### Pattern 6: Dynamic Lucide Icon by Name

**What:** Section `icon` field stores a Lucide icon name as a string (e.g., `"ChefHat"`, `"PackageSearch"`). This must be rendered dynamically.

**Implementation:** Use a dynamic import map or the `lucide-react` dynamic component pattern. The simplest approach for this codebase is a lookup object mapping icon names to components.

```typescript
// Source: lucide-react v0.577.0 — dynamic icon rendering pattern
import * as LucideIcons from 'lucide-react';

function DynamicIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = (LucideIcons as Record<string, any>)[name];
  if (!Icon) return <LucideIcons.BookOpen className={className} style={style} />;
  return <Icon className={className} style={style} />;
}
```

**Caution:** Importing `* as LucideIcons` includes all icons in the bundle. For this phase (read-only, no editor), this is acceptable since lucide-react is already in the project. The bundle impact is fixed regardless of this additional usage.

### Anti-Patterns to Avoid

- **Direct `dangerouslySetInnerHTML` without sanitization:** Never render guide content with raw HTML — always sanitize with `isomorphic-dompurify` first even though backend already sanitizes.
- **Importing `GuideProseRenderer` without `dynamic()`:** Without `ssr: false`, Tiptap's `useEditor` will throw "window is not defined" on server render.
- **Using `generateHTML` from `@tiptap/core`:** The `@tiptap/core` export is browser-only. Use `@tiptap/html` for the `generateHTML` helper.
- **Using `editor.getHTML()` instead of reading from API:** The editor instance should be initialized from the API response content, not used to transform content from another format.
- **Fetching full content on section list pages:** `GET /guide/sections` already returns pages with only `id, title, slug, sort_order, status, summary, estimated_read_time` (confirmed from `GuidesService.findSections()` select clause) — no content body. Full content only comes from `GET /guide/pages/:id`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide-in sidebar overlay | Custom CSS animation panel | shadcn `Sheet` (`side="left"`) | Already used in `(ops)/layout.tsx` mobile sidebar; ARIA roles, focus trap, keyboard dismiss all included |
| Prose typography styles | Custom CSS for h2, h3, p, ul, ol, blockquote | `@tailwindcss/typography` `prose` class | Handles heading scale, list indentation, blockquote borders, dark mode inversion — 200+ lines of correct CSS |
| HTML sanitization | Custom regex/tag stripping | `isomorphic-dompurify` | DOMPurify is the industry standard; CVE track record; handles 300+ edge cases including SVG, MathML, and attribute injection |
| Scrollable overflow container | CSS `overflow-y: auto` with custom scrollbar | shadcn `ScrollArea` | Consistent scrollbar styling with Radix primitive; already installed |
| Date relative formatting | Manual `Date.now() - date` arithmetic | `date-fns/formatDistanceToNow` | `date-fns` is already installed at v4.1.0; handles locale, edge cases, pluralization |
| Animation on section card | Custom CSS keyframes for beam effect | `BorderBeam` component | Already in `@/components/ui/border-beam.tsx`; uses `motion/react` (installed) |
| Skeleton loading | CSS pulse divs with manual sizing | shadcn `Skeleton` | Consistent with existing loading patterns in `(ops)/loading.tsx` |

**Key insight:** Every animation, overlay, scroll, and prose challenge in this phase has a pre-built solution already in the codebase or installable in one command. Zero custom primitives should be built.

---

## Common Pitfalls

### Pitfall 1: Tiptap SSR Crash Without `{ ssr: false }`

**What goes wrong:** Page throws `window is not defined` or React hydration mismatch. The editor component renders on the server where the DOM does not exist.

**Why it happens:** `'use client'` marks a client boundary but does NOT prevent server-side rendering. `useEditor()` with `immediatelyRender: true` (the default) tries to access DOM APIs during server render.

**How to avoid:** Two requirements, BOTH needed:
1. `immediatelyRender: false` in `useEditor()` config
2. `dynamic(() => import('./GuideProseRenderer'), { ssr: false })` at the page/parent level

**Warning signs:** "SSR has been detected, please set `immediatelyRender` explicitly to `false`" error in terminal.

### Pitfall 2: Content Parse Failure on Malformed JSON

**What goes wrong:** `JSON.parse(content)` throws when the content string is `null`, empty, or not valid JSON (e.g., old plain-text content or a parsing edge case). The entire page crashes.

**Why it happens:** `GuidePage.content` is `String @db.Text` — valid JSON is enforced by the Phase 14 sanitizer, but future content might be empty string or `null` on newly created pages.

**How to avoid:** Always wrap JSON.parse in try/catch. Fall back to `null` or empty doc if parse fails. Render an informative placeholder ("No content yet") rather than crashing.

```typescript
let parsedContent = null;
try {
  parsedContent = JSON.parse(content);
} catch {
  parsedContent = null;
}
```

### Pitfall 3: Next.js 16 `params` is a Promise

**What goes wrong:** Code like `const { sectionSlug } = params` (treating params as a plain object) works in Next.js 14 but throws a type error or returns `undefined` in Next.js 16.

**Why it happens:** Next.js 16 changed `params` to be a `Promise<{...}>` in all page/layout components. This is a BREAKING change from Next.js 14.

**How to avoid:** Use `use(params)` in client components:
```typescript
import { use } from 'react';
const { sectionSlug, pageSlug } = use(params);
```
Or use `useParams()` hook from `next/navigation` (also valid — confirmed used in `purchase-orders/[id]/page.tsx`).

**Warning signs:** Existing missions page uses `use(params)` pattern — follow that precedent.

### Pitfall 4: `@tailwindcss/typography` Not Installed — `prose` Class Does Nothing

**What goes wrong:** The `prose prose-neutral dark:prose-invert` class on the Tiptap renderer container has zero effect. Content renders without typographic hierarchy — headings look like body text, lists have no indentation.

**Why it happens:** `@tailwindcss/typography` is NOT currently installed in the frontend (`node_modules/@tailwindcss/typography` does not exist). The `prose` class only works when the plugin is installed AND registered via `@plugin '@tailwindcss/typography'` in `globals.css`.

**How to avoid:** Wave 0 task must:
1. `npm install @tailwindcss/typography`
2. Add `@plugin '@tailwindcss/typography';` to `frontend/app/globals.css`

### Pitfall 5: No Slug-Based API Endpoint for Sections or Pages

**What goes wrong:** Attempting `GET /guide/sections/kitchen-ops` (slug-based) returns a 400 or 422 because the backend uses UUID-only params (`ParseUUIDPipe`).

**Why it happens:** `GuidesController` uses `@Param('id', ParseUUIDPipe)` — slug lookup is not exposed as an API endpoint.

**How to avoid:** Fetch all sections via `GET /guide/sections`, then resolve slugs client-side using `sections.find(s => s.slug === sectionSlug)`. Use TanStack Query to cache the result and share it across the section page and page reading view to avoid duplicate fetches.

### Pitfall 6: Accent Color Background Tint Requires `hex + opacity` Syntax

**What goes wrong:** Trying to apply `style={{ backgroundColor: section.accent_color }}` at 10% opacity doesn't work with standard hex colors using Tailwind alone.

**Why it happens:** Dynamic CSS custom property opacity modifiers need either `color-mix()` or inline style with hex-to-rgba conversion.

**How to avoid:** Use the `${accentColor}20` hex opacity suffix pattern (last two hex digits = alpha: `20` ≈ 12.5% opacity). This is the pattern confirmed in the UI-SPEC `GuideSectionCard` spec:
```typescript
style={{ backgroundColor: `${section.accent_color}20` }}
```

---

## Code Examples

Verified patterns from the existing codebase and official sources:

### Sidebar Nav Item Addition (Sidebar.tsx)

Add to the "Overview" section (everyone sees it per D-20):

```typescript
// Source: frontend/components/ops/Sidebar.tsx — overviewNav pattern
import { BookOpen } from 'lucide-react';

// Add to overviewNav array:
{
  label: 'Guide',
  href: '/guide',
  icon: <BookOpen className="size-4" />,
}
```

### Section Index Page Data Fetching

```typescript
// Source: Established pattern — frontend/app/(ops)/operations/recipes/[id]/page.tsx
// + frontend/lib/api-client.ts pattern
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

const { data: sections, isLoading, isError } = useQuery({
  queryKey: ['guide', 'sections'],
  queryFn: () => apiClient.get<GuideSection[]>('/guide/sections'),
});
```

### Page Content Fetching (UUID from sections array)

```typescript
// Source: Pattern combining sections cache + page detail fetch
// Sections response includes page summaries with IDs
// Find page ID from sections cache, then fetch full content

const { data: page } = useQuery({
  queryKey: ['guide', 'page', pageId],
  queryFn: () => apiClient.get<GuidePage>(`/guide/pages/${pageId}`),
  enabled: !!pageId,
});
```

### Sheet-Based Sidebar (matches existing ops/layout.tsx pattern)

```typescript
// Source: frontend/app/(ops)/layout.tsx — mobile sidebar Sheet pattern
import { Sheet, SheetContent } from '@/components/ui/sheet';

<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <SheetContent side="left" className="w-[280px] p-0" showCloseButton={false}>
    <GuideSidebarSheet
      sections={sections ?? []}
      activeSectionSlug={sectionSlug}
      activePageSlug={pageSlug}
      onNavigate={() => setSidebarOpen(false)}
    />
  </SheetContent>
</Sheet>
```

### isomorphic-dompurify Client-Side Sanitization

```typescript
// Source: PITFALLS.md Integration Gotchas, frontend client component context
import DOMPurify from 'isomorphic-dompurify';

// In GuideProseRenderer (client component):
const clean = DOMPurify.sanitize(htmlContent);
```

### MagicCard with Dynamic Accent Color

```typescript
// Source: frontend/components/ui/magic-card.tsx — mode="gradient" is the correct prop
// UI-SPEC GuideSectionCard spec
<MagicCard mode="gradient" className="rounded-xl cursor-pointer">
  <BorderBeam size={50} duration={6} colorFrom={BEAM_FROM} colorTo={BEAM_TO} />
  <div
    className="p-6 flex flex-col gap-3"
    style={{ backgroundColor: `${section.accent_color}20` }}
  >
    {/* ... */}
  </div>
</MagicCard>
```

### formatDistanceToNow for Last Updated

```typescript
// Source: date-fns v4 (already installed) — formatDistanceToNow
import { formatDistanceToNow } from 'date-fns';

const relativeDate = formatDistanceToNow(new Date(page.updated_at), { addSuffix: true });
// Output: "3 days ago", "about 2 hours ago", etc.
```

---

## API Contract (Confirmed from Phase 14 Source)

### `GET /guide/sections` Response Shape

```typescript
interface GuideSection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;          // Lucide icon name e.g. "ChefHat"
  accent_color: string | null;  // CSS color string e.g. "#FF6B35"
  sort_order: number;
  role_codes: string[];
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  pages: GuideSectionPage[];    // Shallow select — no content body
}

interface GuideSectionPage {
  id: string;
  title: string;
  slug: string;
  sort_order: number;
  status: 'draft' | 'published';
  summary: string | null;
  estimated_read_time: number | null;
  // NOTE: content is NOT included in this response
}
```

**Key facts:**
- Non-admin users only receive `status: 'published'` sections where `role_codes` includes their role
- Pages in the response are already filtered to `status: 'published'` for non-admins
- No `content` field in the sections response — content is only in `GET /guide/pages/:id`

### `GET /guide/pages/:id` Response Shape

```typescript
interface GuidePage {
  id: string;
  section_id: string;
  title: string;
  slug: string;
  sort_order: number;
  content: string;              // JSON-stringified Tiptap doc (String @db.Text)
  summary: string | null;
  estimated_read_time: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  section: {                    // Included via findPage include
    role_codes: string[];
    status: string;
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params` as plain object in Next.js page | `params` as `Promise<{...}>`, unwrapped via `use(params)` | Next.js 15+ | Client pages must use `use(params)` or `useParams()` hook |
| `@tailwindcss/typography` via `tailwind.config.js` plugins | `@plugin '@tailwindcss/typography'` in CSS file | Tailwind v4 | No JS config needed; register in globals.css instead |
| `generateHTML` from `@tiptap/core` | `generateHTML` from `@tiptap/html` | Tiptap v3 | Core export is browser-only; html package works in both Node.js and browser |
| Tiptap `history` option in StarterKit | `undoRedo` option in StarterKit v3 | Tiptap v3 | (Not relevant for read-only use, but confirms v3 breaking changes are real) |

**Deprecated/outdated:**

- `params` destructuring without `use()` in Next.js 16: `const { id } = params` — broken; use `const { id } = use(params)` instead
- `@tiptap/core` `generateHTML`: deprecated for server/isomorphic use — use `@tiptap/html` package instead

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in frontend (`jest.config.*`, `vitest.config.*`, `*.test.*` absent) |
| Config file | None — Wave 0 gap |
| Quick run command | Not applicable — no test infrastructure |
| Full suite command | Not applicable |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| READ-01 | Role-filtered sections shown | manual-only | N/A — frontend display test requires live API + seeded data | No test infra |
| READ-02 | Polished reading view renders | manual-only | N/A — visual/UI test requires browser | No test infra |
| READ-05 | Sidebar navigation renders and highlights active page | manual-only | N/A — UI interaction test | No test infra |

**Manual verification plan (no automated tests):**
- Log in as a role with assigned sections → verify only those sections appear at `/guide`
- Click a section card → verify section page loads with page list
- Click a page → verify reading view renders with header, prose, sidebar trigger
- Open sidebar → verify section tree is collapsible, active page highlighted

### Wave 0 Gaps

- [ ] No frontend test infrastructure — confirmed no `jest.config.*`, `vitest.config.*`, or test files
- [ ] All requirements are UI/visual — manual verification is the appropriate validation approach for this phase

*(No automated test scaffolding required for this phase — all requirements are UI rendering behaviors validated by manual inspection)*

---

## Open Questions

1. **Are guide sections seeded with actual content?**
   - What we know: Phase 14 is complete; CRUD endpoints work. Phase 17 handles content seeding.
   - What's unclear: Are there any test sections/pages in the database right now for development testing?
   - Recommendation: Create one test section and one test page via the API (or seed script) before implementing the reader view, so the UI can be tested with real content.

2. **How does the `icon` field render if it contains an invalid Lucide icon name?**
   - What we know: `GuideSection.icon` is `String?` (nullable). Valid values are Lucide icon names.
   - What's unclear: No validation enforces valid icon names in Phase 14.
   - Recommendation: Implement a safe fallback in `DynamicIcon` — if the icon name is null/undefined/unknown, render `BookOpen` as the default icon.

3. **Does `@tiptap/html` `generateHTML` handle custom callout nodes (blockquote with `data-type="callout"`) correctly out of the box?**
   - What we know: The Phase 14 sanitizer allows `data-type` attribute on blockquote. `GuideCalloutBlock` is a custom Tiptap node extension per the UI-SPEC.
   - What's unclear: Whether a custom callout node extension needs to be defined in both the renderer and (future) editor, and whether the read-only renderer can render custom nodes without a full extension definition.
   - Recommendation: For Phase 15, treat callout blocks as styled blockquotes (the fallback rendering). The custom `GuideCalloutBlock` Tiptap extension can be added in Phase 16 when the editor is built. This means callout content renders correctly (as blockquote text), but without the visual tip/warning/info styling — that styling is a Phase 16 enhancement.

---

## Sources

### Primary (HIGH confidence)

- `backend/src/guides/guides.service.ts` — Phase 14 service confirming API response shape, content storage as `String @db.Text`, role filtering logic
- `backend/src/guides/guides.controller.ts` — Confirmed API endpoints: `/guide/sections`, `/guide/sections/:id`, `/guide/pages/:id` (UUID-only, no slug endpoints)
- `backend/prisma/schema.prisma` lines 761-796 — `GuideSection` and `GuidePage` model fields confirmed
- `frontend/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` — Next.js 16 `params` is `Promise<{...}>`, client components use `use(params)` — confirmed BREAKING CHANGE from Next.js 14
- `frontend/app/(ops)/missions/[id]/page.tsx` — Existing codebase precedent for `use(params)` pattern
- `frontend/components/ops/Sidebar.tsx` — `overviewNav` pattern for adding Guide nav item
- `frontend/app/(ops)/layout.tsx` — Sheet pattern for overlay sidebar, confirmed `w-[280px] p-0` and `showCloseButton={false}`
- `frontend/components/ui/magic-card.tsx` — Confirmed `mode="gradient"` prop interface; uses `motion/react`
- `frontend/components/ui/border-beam.tsx` — Confirmed `colorFrom`, `colorTo`, `duration` props; uses `BEAM_FROM`/`BEAM_TO` defaults from brand-colors
- `frontend/lib/brand-colors.ts` — `BEAM_FROM = '#ffaa40'`, `BEAM_TO = '#9c40ff'`
- `frontend/package.json` — Confirmed Tiptap NOT installed; date-fns@4.1.0 installed; Next.js 16.2.0
- npm registry verification (2026-03-22): @tiptap/* at 3.20.4, @tailwindcss/typography at 0.5.19

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` — v1.1 pre-existing research, confirmed Tiptap v3 stack choices, jsdom pin requirement
- `.planning/research/PITFALLS.md` — SSR hydration mismatch, XSS sanitization patterns, `@tiptap/html` vs `@tiptap/core` distinction
- GitHub Discussion #14120 (tailwindlabs/tailwindcss) — `@tailwindcss/typography` v4 integration via `@plugin` directive confirmed as official solution

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — package names and versions verified against npm registry; install status confirmed by checking node_modules
- Architecture: HIGH — patterns verified against existing codebase, Next.js 16 docs, and Phase 14 source
- Pitfalls: HIGH — SSR crash confirmed from official Tiptap docs + existing research; params Promise confirmed from Next.js 16 local docs; typography not-installed confirmed by checking node_modules
- API contract: HIGH — confirmed by reading Phase 14 source code directly

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack; Tiptap minor releases won't affect this)
