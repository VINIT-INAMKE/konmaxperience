# Phase 16: Admin CMS - Research

**Researched:** 2026-03-22
**Domain:** Tiptap v3 rich text editor, R2 image upload, autosave, Next.js 16 unsaved-changes navigation blocking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dual toolbar — fixed top bar (block-level: headings, lists, images, callouts) + floating BubbleMenu (inline: bold, italic, links) on text selection
- **D-02:** Formatting: h2/h3/h4, bold, italic, underline, links, ordered/unordered lists, images, callout blocks (tip/warning/info). No tables, no horizontal rules.
- **D-03:** Tiptap editor loaded via `dynamic({ ssr: false })` with `immediatelyRender: false`
- **D-04:** Three upload paths: toolbar button, drag-drop onto editor, paste from clipboard. All use R2 presigned URL via POST /storage/presign-guide
- **D-05:** Upload feedback: inline blurred placeholder + progress bar overlay, swaps to final R2 URL on completion
- **D-06:** Image-only MIME types (image/jpeg, image/png, image/webp) enforced by presign-guide DTO
- **D-07:** Admin page at `/admin/guide` with section list, expand-to-pages, inline actions
- **D-08:** Section create/edit uses Sheet form pattern
- **D-09:** Page create opens full Tiptap editor at `/admin/guide/pages/[id]`
- **D-10:** Reorder: up/down arrow icon buttons (resolved, not drag-and-drop)
- **D-11:** Section form fields: title, description, icon picker, accent color picker, role multi-select checkboxes
- **D-12:** Delete section shows confirmation dialog (cascades to pages)
- **D-13:** All saves default to draft. Explicit "Publish" button for going live.
- **D-14:** Autosave to draft every 5 seconds (debounced, content-hash check) + "Saved" indicator
- **D-15:** Explicit "Publish" action separate from autosave
- **D-16:** Unsaved changes warning when navigating away with pending changes
- **D-17:** "Unpublish" action to revert published page to draft

### Claude's Discretion

- Tiptap extensions list and configuration
- Toolbar icon choices and grouping
- Bubble menu positioning and animation
- Icon picker component implementation (resolved: predefined list of 20 Lucide icons)
- Color picker component (resolved: 12 predefined hex swatches)
- Reorder UX (resolved: up/down arrow buttons)
- Editor page layout (resolved: full-width, no inner max-width)
- Autosave debounce timing and hash implementation

### Deferred Ideas (OUT OF SCOPE)

- Full-text search — Phase 17
- Admin preview-as-role — Phase 17
- Content seeding from codebase — Phase 17
- Version history / undo — Future
- Collaborative editing — Future
- AI-assisted content generation — Future
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDIT-01 | Admin can edit page content with Tiptap rich text editor (headings, lists, bold/italic/underline, links) | Tiptap v3.20.4 installed; StarterKit provides h2/h3/h4, bold, italic, underline, lists; Link extension 3.20.4 (post-CVE fix); useEditor + EditorContent; BubbleMenu from @tiptap/extension-bubble-menu (installed); full setup pattern documented |
| EDIT-02 | Admin can upload and embed images inline via R2 presigned URLs | POST /storage/presign-guide endpoint already built (MANAGE_GUIDE permission gated); StorageService.generatePresignedPutUrl + getPublicUrl flow; Image extension @tiptap/extension-image 3.20.4 installed; three upload paths (toolbar, drag-drop, paste) converge on GuideImageUploadHandler utility |
| EDIT-03 | Admin can insert styled callout blocks (tip, warning, info) within page content | CalloutExtension already built in frontend/components/ops/guide/GuideCalloutBlock.tsx; reuse directly — no new extension needed; toolbar buttons trigger editor.chain().focus().insertContent({type:'callout',attrs:{type:'tip/warning/info'}}) |
</phase_requirements>

---

## Summary

Phase 16 builds the admin-facing content authoring interface for the guide system. The backend (Phase 14) is fully built — 9 REST endpoints, GuidesService with DOMPurify sanitization, Prisma schema with GuideSection/GuidePage models, and a presign-guide storage endpoint. The reader (Phase 15) is fully built — GuideProseRenderer, GuideCalloutBlock, DynamicIcon, and all supporting types are available for direct reuse.

This phase is purely frontend work. The Tiptap stack is already installed at v3.20.4: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/html`. The `@tiptap/extension-bubble-menu` (3.20.4) is installed as a transitive dependency of StarterKit. The `Placeholder` extension is available via `@tiptap/extensions` (already installed) — no additional npm installs needed beyond `@tiptap/extension-typography` (optional, for smart quotes). The link extension is at 3.20.4, past the CVE-2025-14284 vulnerability window.

The unsaved-changes warning in Next.js 16 must combine two mechanisms: `window.beforeunload` (for tab close/browser navigation) and the Next.js 16 `<Link onNavigate>` prop (for in-app navigation). The deprecated `useRouter().events` API from Next.js 12/13 is NOT available in Next.js 16 App Router. The `onNavigate` prop on `<Link>` was added in Next.js v15.3.0 and is the official pattern for intercepting client-side navigations.

**Primary recommendation:** Build `GuideEditorClient` as a client-only dynamic component (`ssr: false`), isolate it with `shouldRerenderOnTransaction: false`, reuse `CalloutExtension` and `DynamicIcon` from Phase 15, and wire all three image upload paths through a single `GuideImageUploadHandler` utility that calls `/storage/presign-guide`.

---

## Standard Stack

### Core (All Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tiptap/react` | 3.20.4 | `useEditor`, `EditorContent`, `ReactNodeViewRenderer` | Already installed; v3 stable; Next.js SSR-safe with `immediatelyRender: false` |
| `@tiptap/starter-kit` | 3.20.4 | Heading, Bold, Italic, Underline, Lists, Link, History (UndoRedo in v3) | Single package for all table-stakes formatting. Link extension at 3.20.4 (post-CVE-2025-14284) |
| `@tiptap/extension-image` | 3.20.4 | Image nodes in editor content | Renders saved R2 image URLs; does NOT handle upload logic |
| `@tiptap/extension-bubble-menu` | 3.20.4 | BubbleMenu floating toolbar on text selection | Installed as StarterKit transitive dep; import: `import { BubbleMenu } from '@tiptap/extension-bubble-menu'` |
| `@tiptap/extensions` | 3.20.4 | `Placeholder` (already included) | `import { Placeholder } from '@tiptap/extensions'` — no separate install |
| `isomorphic-dompurify` | 3.6.0 | Already in use (GuideProseRenderer) | Defense-in-depth sanitization; jsdom pinned to 25.0.1 via package overrides |

### Supporting (Need Install)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tiptap/extension-typography` | ^3.20.4 | Smart quotes, em-dashes, ellipsis | Optional quality-of-life for admin guide authoring; zero config |

### Installation

```bash
# Frontend — inside /frontend
npm install @tiptap/extension-typography
```

All other required packages are already installed.

**Version verification (confirmed against npm registry 2026-03-22):**
- `@tiptap/extension-typography`: 3.20.4 (published alongside rest of 3.20.4 batch)

### Key Import Paths (Verified Against Installed node_modules)

```typescript
// Core editor
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

// BubbleMenu — from extension-bubble-menu (NOT from @tiptap/react in v3)
import { BubbleMenu } from '@tiptap/extension-bubble-menu';

// Placeholder — from @tiptap/extensions bundle (NOT @tiptap/extension-placeholder)
import { Placeholder } from '@tiptap/extensions';

// CalloutExtension — reused from Phase 15
import { CalloutExtension } from '@/components/ops/guide/GuideCalloutBlock';

// DynamicIcon — reused from Phase 15
import { DynamicIcon } from '@/components/ops/guide/DynamicIcon';
```

---

## Architecture Patterns

### Project Structure (New Files Only)

```
frontend/
├── app/(ops)/admin/guide/
│   ├── page.tsx                          # GuideAdminPage — section list (RSC shell)
│   └── pages/
│       └── [id]/
│           └── page.tsx                  # GuideEditorPage — editor shell (RSC, fetches page data)
├── components/ops/guide/admin/
│   ├── GuideEditorClient.tsx             # "use client", dynamic({ssr:false}), full editor
│   ├── GuideEditorToolbar.tsx            # Fixed block-level toolbar (React.memo)
│   ├── GuideEditorBubbleMenu.tsx         # Floating inline formatting toolbar
│   ├── GuideSectionList.tsx              # Collapsible section list with page sub-lists
│   ├── GuideSectionCard.tsx              # Admin variant — expand toggle, up/down, edit/delete
│   ├── GuideSectionForm.tsx              # Sheet-based create/edit form
│   ├── GuideIconPicker.tsx               # 5x4 grid of 20 predefined Lucide icons
│   ├── GuideColorPicker.tsx              # 12 predefined hex color swatches
│   ├── GuideImageUploadHandler.ts        # Utility (NOT a React component)
│   └── GuideAdminSkeleton.tsx            # 4 section card loading skeletons
```

### Pattern 1: Dynamic Import for Editor (SSR Bypass)

**What:** Page component is RSC; editor component is dynamically imported with `ssr: false` inside a client boundary.
**When to use:** Mandatory for any Tiptap editor component due to ProseMirror DOM dependency.

```typescript
// app/(ops)/admin/guide/pages/[id]/page.tsx (RSC)
import dynamic from 'next/dynamic';

const GuideEditorClient = dynamic(
  () => import('@/components/ops/guide/admin/GuideEditorClient'),
  { ssr: false }
);

export default async function GuideEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Fetch initial page data server-side
  // Pass to GuideEditorClient as props
  return <GuideEditorClient pageId={id} initialPage={page} />;
}
```

Source: Next.js 16 docs `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` — `ssr: false` must be used inside a Client Component boundary. In Next.js 16 App Router, the RSC page can call `dynamic()` but the `ssr: false` option requires the import to be in a Client Component.

**CRITICAL Next.js 16 note:** Per `lazy-loading.md`: "`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component." The pattern is: RSC page renders a `<GuideEditorPageShell>` client component, and `GuideEditorPageShell` calls `dynamic(() => import('./GuideEditorClient'), { ssr: false })`.

### Pattern 2: useEditor Configuration

**What:** Tiptap editor setup with all required options set at initialization.

```typescript
// Source: .planning/research/PITFALLS.md Pitfall 6, STACK.md
const editor = useEditor({
  extensions: [
    StarterKit,           // includes heading h2/h3/h4, bold, italic, underline, lists, Link, UndoRedo
    Image,                // @tiptap/extension-image — renders saved R2 image nodes
    CalloutExtension,     // reused from GuideCalloutBlock.tsx — tip/warning/info callout nodes
    Placeholder.configure({ placeholder: 'Start writing your guide page...' }),
    Typography,           // smart quotes, em-dashes — zero config
  ],
  immediatelyRender: false,        // REQUIRED: prevents Next.js hydration mismatch
  shouldRerenderOnTransaction: false, // REQUIRED: prevents re-render on every keystroke
  editable: true,
  content: parsedContent,          // JSON-parsed from API (content is String @db.Text stored as JSON)
  onUpdate: ({ editor }) => {
    // triggers debounced autosave (5-second debounce + SHA-256 hash check)
  },
});
```

Toolbar active state driven by `editor.isActive('bold')`, NOT React state, to avoid re-renders.

### Pattern 3: Autosave with Content Hash

**What:** 5-second debounce after last change, skip save if content hash unchanged.

```typescript
// Source: CONTEXT.md D-14
const lastSavedHashRef = useRef<string>('');
const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

async function hashContent(content: string): Promise<string> {
  // SubtleCrypto SHA-256 — available in all modern browsers
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function triggerAutosave(editor: Editor) {
  if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  autosaveTimerRef.current = setTimeout(async () => {
    const html = editor.getHTML();
    const hash = await hashContent(html);
    if (hash === lastSavedHashRef.current) return; // no change
    setSaveState('saving');
    await apiClient.patch(`/guide/pages/${pageId}`, { content: html, title: pageTitle });
    lastSavedHashRef.current = hash;
    setIsDirty(false);
    setSaveState('saved');
  }, 5000);
}
```

### Pattern 4: Unsaved Changes Warning (Next.js 16 Pattern)

**What:** Two-pronged approach for Next.js 16 App Router — browser tab close + in-app navigation.

```typescript
// Source: Next.js 16 docs — link.md "Blocking navigation" section (added v15.3.0)
// Prong 1: Browser tab close / external navigation
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = ''; // Modern browsers show generic dialog
    }
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [isDirty]);

// Prong 2: In-app navigation via Next.js Link onNavigate
// The back link and sidebar links must use onNavigate to intercept.
// In GuideEditorClient, pass isDirty down to a custom ConfirmLink wrapper:
// <Link onNavigate={(e) => { if (isDirty && !window.confirm('You have unsaved changes. Leave anyway?')) e.preventDefault(); }} href="/admin/guide">
//   <ArrowLeft /> Guide Management
// </Link>
```

**CRITICAL:** The `useRouter().events` API (Next.js 12/13 pattern) does NOT exist in Next.js 16 App Router. The `onNavigate` prop on `<Link>` (added in v15.3.0) is the official mechanism. This is verified against `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`.

The sidebar navigation links (not controlled by the editor page) cannot be individually wrapped. The practical approach is:
1. `window.beforeunload` — catches all browser-level navigation including sidebar links that cause full page transitions
2. Back link in editor header wraps with `onNavigate` — catches in-app router navigation from that specific link

### Pattern 5: Image Upload Handler (Three Paths, One Utility)

**What:** All three image paths (toolbar, drag-drop, paste) converge on a single async utility.

```typescript
// GuideImageUploadHandler.ts — NOT a React component
export async function uploadImageToR2(file: File): Promise<string> {
  // 1. Validate MIME type client-side (D-06)
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  if (!ALLOWED.includes(file.type)) throw new Error('INVALID_TYPE');
  if (file.size > 10 * 1024 * 1024) throw new Error('TOO_LARGE');

  // 2. Request presigned URL from backend
  const { presignedUrl, publicUrl } = await apiClient.post<{ presignedUrl: string; publicUrl: string }>(
    '/storage/presign-guide',
    { contentType: file.type, fileSize: file.size, filename: file.name }
  );

  // 3. PUT directly to R2
  await fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });

  return publicUrl; // R2 public URL to embed in editor content
}
```

Toolbar path: file input `onChange` → `uploadImageToR2` → insert placeholder node → swap to final URL.
Drag-drop path: `onDrop` event handler on editor wrapper div → extract file → same `uploadImageToR2` flow.
Paste path: `onPaste` event handler → check `e.clipboardData.files` → same flow.

Placeholder insert + swap pattern per D-05:
```typescript
// 1. Insert placeholder immediately (blurred, with Progress overlay)
editor.chain().focus().setImage({ src: PLACEHOLDER_SRC, 'data-uploading': 'true' }).run();

// 2. Upload
const finalUrl = await uploadImageToR2(file);

// 3. Find placeholder node and replace src
// Use editor.state.doc traversal to find img node with data-uploading=true, update src
```

### Pattern 6: Section Sort Order Swap (Up/Down Reorder)

**What:** Reorder sections or pages by swapping adjacent sort_order values.

```typescript
async function moveSection(section: GuideSection, direction: 'up' | 'down', sections: GuideSection[]) {
  const currentIndex = sections.findIndex(s => s.id === section.id);
  const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= sections.length) return;

  const swapTarget = sections[swapIndex];
  // Two PATCH calls — swap sort_order values
  await Promise.all([
    apiClient.patch(`/guide/sections/${section.id}`, { sort_order: swapTarget.sort_order }),
    apiClient.patch(`/guide/sections/${swapTarget.id}`, { sort_order: section.sort_order }),
  ]);
  queryClient.invalidateQueries({ queryKey: ['guide-sections-admin'] });
}
```

Same pattern applies for page reorder within a section.

### Anti-Patterns to Avoid

- **`useRouter().events` for navigation blocking:** Does not exist in Next.js 16 App Router. Only valid in Pages Router.
- **`editor.isActive()` results stored in React state:** Causes unnecessary re-renders on every cursor move. Read directly from `editor.isActive()` in toolbar render.
- **Importing editor without `dynamic()`:** Crashes server rendering with "window is not defined".
- **Autosave on every `onUpdate` without debounce:** Floods the backend with writes on every keystroke; TOAST penalty on every save.
- **`@tiptap/extension-placeholder` as a separate install:** `Placeholder` is already available via `@tiptap/extensions` which is installed. Do NOT add a separate install.
- **`import { BubbleMenu } from '@tiptap/react'`:** In Tiptap v3, `BubbleMenu` is NOT exported from `@tiptap/react`. Import from `@tiptap/extension-bubble-menu`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XSS sanitization of saved HTML content | Custom regex strip | `isomorphic-dompurify` (already in GuidesService) | CVE-2025-14284; backend sanitizes on save; frontend already has it |
| Debounce utility | `setTimeout` wrapper function | `setTimeout` with `clearTimeout` pattern (inline, no library) | Simple enough inline; no additional dependency needed |
| SHA-256 hash for change detection | MD5 or string comparison | `crypto.subtle.digest('SHA-256', ...)` | Browser built-in; no library; constant-time comparison |
| Callout block Tiptap extension | New custom node | `CalloutExtension` from `GuideCalloutBlock.tsx` | Already built and tested in Phase 15 reader |
| Icon name resolver | Switch statement | `DynamicIcon` from `DynamicIcon.tsx` | Already handles missing icon fallback to BookOpen |
| Image file picker input | Complex custom input | Plain `<input type="file" accept="image/jpeg,image/png,image/webp" hidden>` + ref trigger | Simple; zero dependency |

---

## Runtime State Inventory

This is not a rename/refactor phase. No runtime state inventory is required.

---

## Common Pitfalls

### Pitfall 1: BubbleMenu Import Path Changed in Tiptap v3

**What goes wrong:** Developer imports `BubbleMenu` from `@tiptap/react` (the v2 pattern). In v3, this import path no longer exports `BubbleMenu` — it returns `undefined`, and the floating toolbar silently does nothing.

**Why it happens:** Tiptap v3 reorganized exports. `BubbleMenu` moved to `@tiptap/extension-bubble-menu`.

**How to avoid:**
```typescript
// WRONG (v2 pattern — broken in v3)
import { BubbleMenu } from '@tiptap/react';

// CORRECT (v3 pattern — verified against installed node_modules)
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
```

**Warning signs:** BubbleMenu renders nothing; no error thrown; `BubbleMenu` evaluates to `undefined`.

### Pitfall 2: `dynamic({ ssr: false })` Must Be Called Inside a Client Component in Next.js 16

**What goes wrong:** Developer puts `const GuideEditorClient = dynamic(() => import('./GuideEditorClient'), { ssr: false })` in the RSC page file. Next.js 16 throws: "`ssr: false` is not allowed with `next/dynamic` in Server Components."

**Why it happens:** Next.js 16 enforces that `ssr: false` is only valid in Client Components.

**How to avoid:** Create `GuideEditorPageShell.tsx` as a `'use client'` component that calls `dynamic()` with `ssr: false`, and have the RSC page render `<GuideEditorPageShell>` instead.

```typescript
// GuideEditorPageShell.tsx — 'use client'
'use client';
import dynamic from 'next/dynamic';
const GuideEditorClient = dynamic(() => import('./GuideEditorClient'), { ssr: false });
export function GuideEditorPageShell(props: ...) {
  return <GuideEditorClient {...props} />;
}
```

**Warning signs:** Build error "`ssr: false` is not allowed with `next/dynamic` in Server Components".

### Pitfall 3: `Placeholder` Extension Wrong Import

**What goes wrong:** Developer installs `@tiptap/extension-placeholder` separately, then package-lock conflicts with the already-installed `@tiptap/extensions` bundle that already includes `Placeholder`.

**Why it happens:** STACK.md lists `@tiptap/extension-placeholder` as a separate install. This was the recommendation before `@tiptap/extensions` bundle was discovered to be already installed.

**How to avoid:**
```typescript
// WRONG (requires separate npm install)
import Placeholder from '@tiptap/extension-placeholder';

// CORRECT (no install needed — already in @tiptap/extensions)
import { Placeholder } from '@tiptap/extensions';
```

**Warning signs:** `npm install @tiptap/extension-placeholder` adds a new package that duplicates what's already available.

### Pitfall 4: `useRouter().events` Does Not Exist in Next.js 16 App Router

**What goes wrong:** Developer implements unsaved-changes warning using `router.events.on('routeChangeStart', ...)`. This throws `TypeError: Cannot read properties of undefined (reading 'on')` because `router.events` is `undefined` in the App Router.

**Why it happens:** `router.events` was a Pages Router feature removed in App Router. Training data contains many examples of this pattern.

**How to avoid:** Use `window.beforeunload` for browser-level navigation + `<Link onNavigate>` for in-app navigation (Next.js 16 official pattern, added v15.3.0). Verified against `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`.

**Warning signs:** Runtime error about `router.events` being undefined.

### Pitfall 5: Editor Re-Renders on Every Keystroke Without `shouldRerenderOnTransaction: false`

**What goes wrong:** The ops layout (sidebar, notifications bell, XP bar) re-renders on every keystroke in the editor, causing visible typing lag.

**Why it happens:** Tiptap's `useEditor()` by default signals React on every ProseMirror transaction.

**How to avoid:** Always set `shouldRerenderOnTransaction: false` in `useEditor()`. Drive toolbar active state via `editor.isActive()` in render, not React state. Apply `React.memo()` to `GuideEditorToolbar`.

**Warning signs:** React DevTools profiler shows Sidebar re-rendering on each keypress.

### Pitfall 6: Drag-and-Drop Uploads Need `e.preventDefault()` to Stop Browser File Open

**What goes wrong:** When a file is dragged onto the editor, the browser intercepts the drop event and navigates to the file URL (or opens a download dialog), losing the editor state entirely.

**Why it happens:** Default browser behavior for drop events on non-form elements is to navigate.

**How to avoid:** Always call `e.preventDefault()` and `e.stopPropagation()` on both `onDragOver` and `onDrop` handlers. The drag-drop zone is the editor's wrapper div, not the ProseMirror content area.

**Warning signs:** File drop causes browser navigation away from the editor page.

### Pitfall 7: Content Hash Comparison Must Hash the HTML, Not the JSON

**What goes wrong:** Developer hashes `editor.getJSON()` output (stringified). Tiptap's JSON serialization is not deterministic — object key order may vary between re-renders, causing false positives (always "changed") or false negatives (never "changed") depending on the JS engine's object iteration order.

**Why it happens:** `editor.getJSON()` returns a nested object whose serialization is engine-dependent.

**How to avoid:** Hash `editor.getHTML()` — HTML serialization is deterministic. The autosave also sends HTML (as stored in DB as `String @db.Text`), so hashing HTML is consistent with what gets persisted.

---

## Code Examples

### GuideEditorClient Full Setup

```typescript
// Source: .planning/research/PITFALLS.md Pitfall 1+6, CONTEXT.md D-03, D-14
// frontend/components/ops/guide/admin/GuideEditorClient.tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';        // NOT @tiptap/extension-placeholder
import { BubbleMenu } from '@tiptap/extension-bubble-menu'; // NOT @tiptap/react
import { CalloutExtension } from '@/components/ops/guide/GuideCalloutBlock';
import { useEffect, useRef, useState } from 'react';

export function GuideEditorClient({ pageId, initialPage }: Props) {
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle'|'saving'|'saved'|'unsaved'>('idle');
  const lastSavedHashRef = useRef<string>('');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      CalloutExtension,
      Placeholder.configure({ placeholder: 'Start writing your guide page...' }),
    ],
    immediatelyRender: false,           // Next.js SSR guard (REQUIRED)
    shouldRerenderOnTransaction: false, // Performance guard (REQUIRED)
    editable: true,
    content: parsedContent,
    onUpdate: () => {
      setIsDirty(true);
      setSaveState('unsaved');
      triggerAutosave();
    },
  });

  // beforeunload for browser tab close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return (
    <div>
      <GuideEditorToolbar editor={editor} />
      <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }}>
        <GuideEditorBubbleMenu editor={editor} />
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
```

### CalloutExtension Insert Command

```typescript
// Source: frontend/components/ops/guide/GuideCalloutBlock.tsx — existing node definition
// Callout node name is 'callout', attr is 'type'
editor.chain().focus().insertContent({
  type: 'callout',
  attrs: { type: 'tip' }, // 'warning' | 'info'
  content: [{ type: 'text', text: '' }],
}).run();
```

### Image Upload with Placeholder (D-05 Pattern)

```typescript
// Source: CONTEXT.md D-04, D-05; backend/src/storage/storage.controller.ts presign-guide
const PLACEHOLDER_SVG = 'data:image/svg+xml,...'; // 1x1 gray SVG

async function handleImageUpload(editor: Editor, file: File) {
  // Insert blurred placeholder immediately
  editor.chain().focus().setImage({ src: PLACEHOLDER_SRC }).run();
  const placeholderPos = editor.state.selection.from - 1;

  try {
    const finalUrl = await uploadImageToR2(file); // GuideImageUploadHandler

    // Replace placeholder src with final URL
    const { tr } = editor.state;
    editor.state.doc.nodesBetween(0, editor.state.doc.content.size, (node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === PLACEHOLDER_SRC) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: finalUrl });
      }
    });
    editor.view.dispatch(tr);
  } catch {
    // Remove placeholder node on failure
    toast.error('Image upload failed. Try again or use a different file.');
  }
}
```

### Section Sort Order Swap

```typescript
// Source: CONTEXT.md D-10; UI-SPEC reorder interaction contract
// PATCH /guide/sections/:id accepts { sort_order: number }
async function swapSortOrder(
  a: { id: string; sort_order: number },
  b: { id: string; sort_order: number },
) {
  await Promise.all([
    apiClient.patch(`/guide/sections/${a.id}`, { sort_order: b.sort_order }),
    apiClient.patch(`/guide/sections/${b.id}`, { sort_order: a.sort_order }),
  ]);
  queryClient.invalidateQueries({ queryKey: ['guide-sections-admin'] });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import { BubbleMenu } from '@tiptap/react'` | `import { BubbleMenu } from '@tiptap/extension-bubble-menu'` | Tiptap v3 (2025) | Breaking — silent failure if old import used |
| `import Placeholder from '@tiptap/extension-placeholder'` | `import { Placeholder } from '@tiptap/extensions'` | Tiptap v3 extensions bundle | Not breaking but redundant — `@tiptap/extensions` already installed |
| `router.events.on('routeChangeStart')` for unsaved changes | `<Link onNavigate>` + `window.beforeunload` | Next.js 13+ App Router | Breaking — `router.events` undefined in App Router |
| `useEditor({ immediatelyRender: true })` | `useEditor({ immediatelyRender: false })` | Tiptap v3 (explicit requirement) | Breaking — SSR crash without this flag |
| `history` in StarterKit options | `undoRedo` in StarterKit options | Tiptap v3 migration | Breaking config rename |

**Deprecated/outdated:**
- `@tiptap-pro/extension-file-handler`: Pro/paid extension; not needed; has known duplicate-image bug with Image extension
- `react-quill`: Maintenance mode; no TypeScript-first design
- `router.events`: Pages Router only; not available in App Router

---

## Open Questions

1. **Typography extension: worth the install?**
   - What we know: `@tiptap/extension-typography` provides smart quotes and em-dashes; optional quality improvement
   - What's unclear: Whether admin guide authoring benefits enough to justify adding a package
   - Recommendation: Include it — 1 npm install, zero config, improves guide content quality; cost is negligible

2. **Image placeholder: real SVG or transparent pixel?**
   - What we know: D-05 specifies a blurred placeholder; implementation detail is discretion
   - What's unclear: Whether a data-URI SVG or a separate public file is preferable
   - Recommendation: Use a `data:image/svg+xml` placeholder inline — no public file dependency, no import needed

3. **Page data fetching: SSR or CSR?**
   - What we know: GuideEditorPage can be an RSC that fetches data server-side and passes as props, OR the client component can fetch via React Query
   - What's unclear: Which approach is cleaner given that the editor must be client-only anyway
   - Recommendation: RSC fetches via direct backend call, passes `initialPage` prop to `GuideEditorPageShell`. Editor uses `initialPage` as the starting content. No React Query needed for the initial load — simplifies the component.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest (NestJS backend) |
| Config file | `backend/package.json` (jest key) |
| Quick run command | `cd backend && npm test -- --testPathPattern=guides` |
| Full suite command | `cd backend && npm test` |

Frontend has no test framework configured (no jest.config, no vitest.config, no `__tests__` directories in frontend). All testable behavior for this phase is backend-side (sanitization, CRUD, presign). Frontend validation is manual smoke testing.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | Page content saved as sanitized HTML via PATCH /guide/pages/:id | unit (backend) | `cd backend && npm test -- --testPathPattern=guides.service` | Yes — `backend/src/guides/__tests__/guides.service.spec.ts` |
| EDIT-02 | POST /storage/presign-guide returns presignedUrl + publicUrl for MANAGE_GUIDE role | manual smoke | curl with admin JWT | No spec file |
| EDIT-03 | Callout block HTML persists round-trip (create page with callout content, fetch page, verify HTML) | unit (backend) | `cd backend && npm test -- --testPathPattern=guides.service` | Yes (sanitization test covers this) |

### Sampling Rate

- **Per task commit:** `cd backend && npm test -- --testPathPattern=guides.service --passWithNoTests`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Backend suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/src/storage/__tests__/storage.controller.spec.ts` — test presign-guide endpoint returns 200 for MANAGE_GUIDE role, 403 for non-admin — currently no storage controller spec exists
- [ ] Frontend: no test framework configured — all EDIT-01/02/03 frontend behavior validated via manual smoke testing (editor renders, image uploads, callouts insert and persist)

*(No test framework install needed for backend — Jest already configured. Frontend testing gap is pre-existing and out of scope for this phase.)*

---

## Sources

### Primary (HIGH confidence)

- Verified against installed `node_modules/` — all Tiptap import paths, versions, and exports confirmed by Node.js `require()` calls against installed packages
- `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` — `ssr: false` must be in Client Component; dynamic import behavior in Next.js 16
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` — `onNavigate` prop (added v15.3.0); blocking navigation pattern; `router.events` does NOT exist in App Router
- `.planning/research/STACK.md` — Tiptap v3 stack, installation, content storage decision (String @db.Text)
- `.planning/research/PITFALLS.md` — SSR guard, XSS, bundle bloat, shouldRerenderOnTransaction, autosave debounce
- `backend/src/guides/guides.controller.ts` — 9 REST endpoints confirmed, all PATCH routes accept partial update DTOs
- `backend/src/guides/guides.service.ts` — sanitizeContent() confirmed, updatePage() confirms content+title in single PATCH
- `backend/src/storage/storage.controller.ts` — POST /storage/presign-guide confirmed, gated by MANAGE_GUIDE permission
- `backend/src/guides/dto/create-page.dto.ts` + `update-page.dto.ts` — API shape confirmed, content is string
- `frontend/components/ops/guide/GuideCalloutBlock.tsx` — CalloutExtension definition; node name is 'callout'; insertContent shape
- `frontend/components/ops/guide/GuideProseRenderer.tsx` — existing Tiptap usage pattern; confirms extensions, immediatelyRender: false
- `frontend/components/ops/guide/DynamicIcon.tsx` — confirmed reusable component interface
- `frontend/lib/types/guides.ts` — GuideSection and GuidePage TypeScript interfaces confirmed
- `frontend/package.json` — all installed packages and versions confirmed; jsdom pinned to 25.0.1
- `backend/prisma/schema.prisma` (lines 761-796) — GuideSection and GuidePage schema confirmed; content is `String @db.Text`

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` (2026-03-22) — CVE-2025-14284 on @tiptap/extension-link <2.10.4; installed version is 3.20.4 (safe)
- `frontend/components/ops/Sidebar.tsx` — admin nav pattern confirmed; MANAGE_GUIDE permission is the gating permission; `can('MANAGE_GUIDE')` is the pattern to use for "Guide Management" nav item

### Tertiary (LOW confidence)

None — all critical claims verified against installed source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against installed node_modules; import paths confirmed by require() calls
- Architecture: HIGH — RSC/client split verified against Next.js 16 docs; all API shapes verified against backend source
- Pitfalls: HIGH — Tiptap v3 breaking changes verified against installed packages; Next.js 16 navigation API verified against shipped docs
- Unsaved changes pattern: HIGH — verified against Next.js 16 Link component docs (onNavigate added v15.3.0)

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days — Tiptap 3.20.x is stable; Next.js 16.x is stable)
