# Stack Research

**Domain:** In-app CMS — admin-editable user guide with rich text + image uploads
**Researched:** 2026-03-22
**Confidence:** HIGH (core libraries verified via npm + official sources; R2 integration pattern verified against existing codebase)

---

## Context: What Already Exists (Do Not Re-research)

- NestJS backend + Prisma v6 + PostgreSQL (Neon)
- Next.js 14 frontend + shadcn/ui + Tailwind CSS
- Cloudflare R2 via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` — presigned PUT URL pattern already implemented in `StorageService`
- JWT auth with 8-role RBAC already in place

This research covers ONLY new additions needed for the user guide CMS.

---

## Recommended Stack

### Core Technologies (New Additions)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@tiptap/react` | ^3.20.4 | Rich text editor React bindings | v3 is stable (released 2025), ships with Next.js SSR fix (`immediatelyRender: false`), headless so it inherits shadcn/ui styling naturally. Active — published 3 days ago as of research date. |
| `@tiptap/pm` | ^3.20.x | ProseMirror peer dependency | Required alongside @tiptap/react; provides ProseMirror core engine. |
| `@tiptap/starter-kit` | ^3.20.3 | Bundled extensions (headings, bold, italic, lists, code) | Single install for all table-stakes formatting. In v3, `history` option renamed to `undoRedo`; `underline` and `link` now included by default. |
| `@tiptap/extension-image` | ^3.20.2 | Image nodes in editor content | Handles rendering existing `<img src>` tags in saved content. Does NOT do uploading — that is wired separately via the upload handler. |
| `isomorphic-dompurify` | ^2.x (pin jsdom ≤25) | XSS sanitization for saved HTML | DOMPurify works on both server (NestJS) and Next.js client without Window errors. **Pin jsdom to 25.0.1 via package overrides** — v3.0.0+ of isomorphic-dompurify breaks with `require()` in Next.js due to ESM-only jsdom@28. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tiptap/extension-placeholder` | ^3.20.x | Placeholder text in empty editor | UX improvement for admin CMS — always use |
| `@tiptap/extension-character-count` | ^3.20.x | Character/word count in toolbar | Optional; useful for section length awareness in guide content |
| `@tiptap/extension-typography` | ^3.20.x | Smart quotes, em-dashes, ellipsis | Polishes guide text automatically; zero config |
| `@tiptap/extension-link` | Included in StarterKit v3 | Hyperlinks in content | Already bundled in StarterKit v3 — do not install separately |
| `dompurify` | ^3.3.3 | Browser-side XSS sanitization | Use in Next.js client components via `isomorphic-dompurify` wrapper |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Prisma `Json` field type | Stores Tiptap JSON document in PostgreSQL | Maps to JSONB by default in PostgreSQL — no `@db.JsonB` annotation required; Prisma uses JSONB as the native JSON type |
| Tiptap `generateHTML` from `@tiptap/html` | Server-side JSON → HTML rendering | Use `@tiptap/html` (not `@tiptap/core`) for NestJS — the core export is browser-only. Required if backend needs to send pre-rendered HTML to email or external consumers. |

---

## Installation

```bash
# Frontend (inside /frontend)
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-placeholder @tiptap/extension-character-count @tiptap/extension-typography isomorphic-dompurify

# Backend (inside /backend) — only if server-side HTML generation needed
npm install @tiptap/html @tiptap/starter-kit @tiptap/extension-image isomorphic-dompurify
```

Pin jsdom in `frontend/package.json` (required for isomorphic-dompurify with Next.js):
```json
{
  "overrides": {
    "jsdom": "25.0.1"
  }
}
```

---

## Content Storage Decision: JSON in PostgreSQL

**Store Tiptap JSON (not HTML, not markdown) in the database.**

Rationale:
- Tiptap JSON is the native ProseMirror document format — round-trips perfectly back into the editor for subsequent edits
- JSON stored in PostgreSQL JSONB is indexed, queryable, and compact enough for guide content
- HTML output can be generated on-demand client-side (`editor.getHTML()`) or server-side (`generateHTML`) — no need to store both
- Markdown requires an extra conversion layer and loses structured marks (e.g., link attributes, image sizing) that Prisma JSON preserves
- XSS risk with stored HTML is eliminated — JSON never goes into `dangerouslySetInnerHTML` without sanitization

**Prisma schema pattern:**
```prisma
model GuideSection {
  id         String   @id @default(uuid())
  slug       String   @unique
  title      String
  content    Json     // Tiptap ProseMirror JSON document
  roles      String[] // Role codes that can view this section
  order      Int      @default(0)
  created_by String
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}
```

---

## Image Upload Integration Pattern

The existing `StorageService` already implements the presigned PUT URL pattern. Wire Tiptap image uploads into it as follows:

1. Admin selects/drops an image in the Tiptap editor
2. Frontend calls `POST /storage/presign` (existing endpoint) with `{ contentType: 'image/jpeg', fileSize }` — get back `{ presignedUrl, key, publicUrl }`
3. Frontend does a direct `PUT` to the presigned R2 URL with the image file
4. Frontend inserts an image node into Tiptap: `editor.chain().focus().setImage({ src: publicUrl }).run()`
5. The `publicUrl` (pointing to R2) is embedded in the Tiptap JSON `content` field — no image data in the DB

**Key point:** No new backend endpoint needed. The existing `/storage/presign` route handles this. Only frontend wiring is new work.

Tiptap `@tiptap/extension-image` renders saved `<img src="r2-url">` nodes on display. The upload logic lives in a custom toolbar button that calls the presign endpoint, not in any Tiptap extension.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Tiptap v3 | Plate.js | If already using Slate.js elsewhere, or if you need Radix UI primitives and rapid plugin composability. Plate is React-only and has a smaller community. For this stack (shadcn/ui + NestJS), Tiptap's ProseMirror foundation is more stable. |
| Tiptap v3 | BlockNote | Good choice for Notion-style block editors. Higher-level abstraction with less control. Not suitable here since we need precise role-gated content and shadcn/ui toolbar integration. |
| Tiptap v3 | TinyMCE / CKEditor | Mature cloud products with licensing costs. Unnecessary overhead for an internal CMS with 8 users. |
| JSON storage | HTML storage | Only use HTML storage if the only consumer is `dangerouslySetInnerHTML` and you never need to re-edit the content. Not appropriate here since admins edit repeatedly. |
| JSON storage | Markdown storage | Only use markdown if your display layer is MDX/Remark (e.g., a static site). Tiptap does not natively output/import markdown without an extra extension, and markdown loses link attributes. |
| isomorphic-dompurify | dompurify (direct) | Use direct `dompurify` if you never render content in a Next.js Server Component or API route. isomorphic-dompurify is the safer default for Next.js apps. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@tiptap-pro/extension-file-handler` | Pro/paid extension. Not needed — existing R2 presign flow in StorageService handles file upload independently of the editor. Known duplicate-image bug with Image extension. | Custom toolbar button calling `/storage/presign` |
| `react-quill` / `react-draft-wysiwyg` | Legacy editors. react-quill is in maintenance mode; react-draft-wysiwyg last meaningful update was 2022. No TypeScript-first design. | Tiptap v3 |
| `slate.js` directly | Very low-level; requires building all editor tooling from scratch. High maintenance burden. | Plate.js (if Slate ecosystem needed), or Tiptap |
| `@tiptap/core` for server-side `generateHTML` | Browser-only export — crashes in NestJS because it accesses `window` | `@tiptap/html` which uses virtual DOM for Node.js environments |
| Storing HTML in database | XSS risk without sanitization on every read, content cannot be cleanly re-edited in Tiptap without HTML→JSON conversion | Store Tiptap JSON; generate HTML client-side |
| Markdown with remark/rehype pipeline | Significant new dependency tree (remark, rehype, unified, plugins). Overkill for internal guide content that never leaves the app. | Tiptap JSON rendered via `editor.getHTML()` |

---

## Stack Patterns by Variant

**Admin creates/edits a guide section:**
- Use `useEditor` hook with `@tiptap/react`, `StarterKit`, `Image` extension
- Set `immediatelyRender: false` to prevent Next.js hydration mismatch
- Toolbar is custom shadcn/ui `Button` components calling `editor.chain().focus()...run()` — no separate toolbar library needed
- Image upload: custom toolbar button → presign → PUT → `setImage({ src })`

**Staff user reads a guide section:**
- Fetch `content` (JSON) from API
- Render read-only Tiptap instance with `editable: false`, or use `generateHTML` + sanitized `dangerouslySetInnerHTML`
- Read-only Tiptap instance is preferred — no DOMPurify dependency needed, no XSS surface

**Backend search/index over guide content:**
- PostgreSQL JSONB supports `@>` containment queries and GIN indexes
- For full-text search, extract text from JSON content using `content->>'text'` traversal or store a separate `plain_text` column populated on save

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@tiptap/react@^3.20.x` | `@tiptap/starter-kit@^3.20.x` | All packages must be same major version. Do not mix v2 and v3. |
| `@tiptap/react@^3.20.x` | Next.js 14/15 | Requires `immediatelyRender: false` in `useEditor` config to avoid hydration errors |
| `isomorphic-dompurify@^2.x` | jsdom@25.0.1 | Pin jsdom to 25.0.1 via package overrides — isomorphic-dompurify v3.0.0+ breaks with jsdom@28 in Next.js due to ESM-only require() incompatibility |
| `@tiptap/extension-image@^3.20.x` | `@tiptap/starter-kit@^3.20.x` | Compatible. StarterKit v3 does not bundle Image — must be added explicitly. |
| Prisma `Json` field | PostgreSQL (Neon) | No annotation needed. Prisma maps `Json` to PostgreSQL `jsonb` natively. |

---

## Sources

- [Tiptap v3 Release Notes](https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable) — v3 stability and breaking changes confirmed
- [Tiptap Next.js Install Guide](https://tiptap.dev/docs/editor/getting-started/install/nextjs) — `immediatelyRender: false` SSR requirement
- [npm: @tiptap/react](https://www.npmjs.com/package/@tiptap/react) — current version 3.20.4
- [npm: @tiptap/starter-kit](https://www.npmjs.com/package/@tiptap/starter-kit) — current version 3.20.3
- [npm: @tiptap/extension-image](https://www.npmjs.com/package/@tiptap/extension-image) — current version 3.20.2
- [Tiptap Image Extension Docs](https://tiptap.dev/docs/editor/extensions/nodes/image) — image node behavior, upload integration pattern
- [Tiptap FileHandler Docs](https://tiptap.dev/docs/editor/extensions/functionality/filehandler) — Pro extension, explicitly not used
- [Tiptap HTML Utility Docs](https://tiptap.dev/docs/editor/api/utilities/html) — `generateHTML` server vs browser exports
- [Tiptap Export Guide](https://tiptap.dev/docs/guides/output-json-html) — JSON vs HTML storage rationale
- [Tiptap v2→v3 Migration Guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2) — breaking changes (import paths, StarterKit options)
- [npm: isomorphic-dompurify](https://www.npmjs.com/package/isomorphic-dompurify) — SSR DOMPurify wrapper
- [isomorphic-dompurify jsdom@28 breakage — Next.js discussion](https://github.com/vercel/next.js/discussions/58142) — jsdom pin workaround
- [npm: dompurify](https://www.npmjs.com/package/dompurify) — version 3.3.3 confirmed current
- [Liveblocks: Which rich text editor in 2025](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025) — Tiptap vs Plate comparison (MEDIUM confidence, secondary source)
- [Prisma JSONB Guide](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields) — `Json` field type in Prisma/PostgreSQL
- Existing codebase: `backend/src/storage/storage.service.ts` — presigned PUT URL pattern confirmed already implemented; no new backend endpoint needed for image uploads

---
*Stack research for: User Guide CMS — admin-editable rich text + image uploads*
*Researched: 2026-03-22*
