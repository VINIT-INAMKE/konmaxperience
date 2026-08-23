# P4 Role-Aware IA + Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every role lands on "what I must move today". One persistent mission header on every ops page, a fixed navigation spine rendered from `GET /modules/mine`, a real `/tasks` (server-filtered, paginated, kanban + list), `/quests?mine=1`, `/team`, `/admin/modules`, Mission Control (admin) and My Day (everyone else), Task/Quest sheets and Quest › Task chips, Pusher on the kitchen screens, `UsageEvent` page-view/action logging — all painted with **one** brand token file derived from the homepage's `--public-*` palette, in light and dark, with the SPEC §6.4 motion allowlist enforced and the SPEC §3.5 front-end dead weight deleted.

**Architecture:** Four layers, in order. (1) **Tokens first** — one `frontend/app/tokens.css` with a raw ramp, a semantic layer (`--bg`, `--surface`, `--ink`, `--accent`, `--status-*`) and a *compat* layer that re-points the 26 shadcn/base-ui variable names (`--primary`, `--card`, `--border`, …) at the semantic layer. Because all 44 `components/ui/*` primitives already consume those names, re-pointing `--primary` at terracotta brands 279 components with zero component edits. (2) **Sweeps** — four disjoint directory slices strip the disallowed Magic-UI motion and replace raw Tailwind palette classes with token classes; the sweeps are mechanical and each ends with a `grep` that proves it is complete. (3) **IA** — header, spine, `/tasks`, `/quests`, `/team`, `/admin/modules`, Mission Control + My Day are built on the swept, tokenised base. (4) **Interaction + realtime** — sheets, chips, inline approve/reject, Pusher, usage events, then the lint rules that make all of it stick. Backend work is small, purely additive and runs in Wave 0 in parallel with the token work, so no frontend task ever waits on an API.

**Tech Stack:** Next.js 16.2 (App Router; the middleware file is `frontend/proxy.ts`, Next 16's rename), React 19.2, Tailwind CSS v4 (`@theme inline`, no `tailwind.config.*`), shadcn-flavoured primitives built on `@base-ui/react`, `motion` v12 (`motion/react`), `@tanstack/react-query` v5, `zustand`, `react-hook-form` + `zod` v4, `cmdk`, `pusher-js`, `lucide-react`, `recharts`. Backend: NestJS 11, Prisma 6.19 (PostgreSQL), Jest 30 (`rootDir: src`, `testRegex: .*\.spec\.ts$`, 60 suites / 603 tests green at `0da0e09`). npm only, Node 22. Branch `v2-os-marketplace`. **Frontend has no test runner** — verification is `npx tsc --noEmit`, `npx eslint .` (0 errors), `npm run build`, plus a `next start` + `curl` route smoke described in Task 19.

**Frozen files — no task may modify them:** `frontend/app/page.tsx` and `frontend/components/public/ScrollVideoStory.tsx`. The brand tokens are *derived from* the `--public-*` values these files read; the `--public-*` block itself keeps its exact values and simply moves into `tokens.css`, so the homepage renders byte-identically.

---

## Decisions taken while reading the code

1. **`--primary` is an alias of `--accent`, not a parallel palette.** shadcn's `--primary` / `--card` / `--border` / `--muted` / `--ring` names are consumed by all 44 files in `frontend/components/ui/`. Rather than rename them across 279 components, `tokens.css` keeps the names and re-points their *values* at the semantic layer. `bg-primary` therefore becomes terracotta everywhere on the first commit.

2. **shadcn's `--accent` is a hover tint, not a brand accent.** `components/ui/button.tsx`, `dropdown-menu.tsx` and 12 others use `hover:bg-accent hover:text-accent-foreground` for *hover surfaces*. Making `--accent` terracotta would fill every ghost hover with orange. So the semantic brand token is `--accent` (per SPEC §7 wording) and the Tailwind utility `accent` is mapped to a separate `--ui-accent` (= `--surface-raised`): `@theme inline { --color-accent: var(--ui-accent) }`. Brand utilities are `bg-brand` / `text-brand` / `border-brand`.

3. **`/team` is currently the staff login page** (`frontend/app/(auth)/team/page.tsx`), and **the frozen homepage links to `/team` three times** (`app/page.tsx:93`, `:204`, `:275`). SPEC §6.2 item 8 wants `/team` to be the Team hub. Two routes cannot share a path. Resolution: the login page moves to `app/(auth)/sign-in/page.tsx`, the Team hub is created at `app/(ops)/team/page.tsx`, and `frontend/proxy.ts` **rewrites** (not redirects) `/team` → `/sign-in` when there is no valid staff cookie. The frozen homepage keeps working, the URL the user sees stays `/team`, and an authenticated staff member at `/team` gets the Team hub. `lib/auth.ts`, `lib/api-client.ts` and `app/(ops)/layout.tsx` keep pointing at `/team` unchanged.

4. **`framer-motion` is already dead.** Zero files import it — every animation imports from `motion/react` (the `motion` package). Removing the `framer-motion` dependency is a `package.json` edit with no code change (grep proof in Task 2).

5. **`shadcn` is a real build-time dependency.** `app/globals.css:3` does `@import "shadcn/tailwind.css"`, and the 95 lines it supplies (`@custom-variant data-open|data-closed|data-checked|data-unchecked|data-selected|data-disabled|data-active|data-horizontal|data-vertical`, `@utility no-scrollbar`, the accordion keyframes) are used **32 times across 15 files**. So "remove `shadcn` as a runtime dependency" = vendor those 95 lines into `frontend/app/base-ui-variants.css` and move `shadcn` to `devDependencies` (it stays as the component-registry CLI behind `components.json`).

6. **The "duplicate" cards are name collisions, not dead code.** All four files are imported. `components/ops/missions/MissionCard.tsx` (160 lines, exports `MissionCard`) and `components/ops/boards/MissionCard.tsx` (75 lines, exports `BoardMissionCard`) render the same entity twice; they are merged into one `MissionCard` with a `density` prop. `components/ops/guide/GuideSectionCard.tsx` (66 lines, reader) and `components/ops/guide/admin/GuideSectionCard.tsx` (261 lines, editor row) are genuinely different things — the admin one is **renamed** `GuideSectionAdminRow` so the name appears once.

7. **`lib/brand-colors.ts` is not brand.** It holds Magic-UI defaults — purple `#9E7AFF`, pink `#FE8BBB`, `#ee4f27`, `#6b21ef`, `#ffaa40`, `#9c40ff`. Every one of them is off-brand. The file is rewritten to export only the two constants the surviving motion components need (`BEAM_FROM`, `BEAM_TO`, both reading brand tokens) and the rest are deleted with their call sites.

8. **`UsageEvent` did not ship in P2** (deferred to P5 with the other commerce models — see `30-01-SUMMARY.md`). SPEC §8 and `IA-07` put it in P4, so this plan adds the model plus a `UsageEventType` enum in a second, additive migration `20260826000000_p4_role_aware_ia`. Phase 33 must pick a *different* timestamp; both are additive so replay order does not matter.

9. **`GET /tasks` is not server-filtered or paginated today.** `tasks.controller.ts` accepts `quest_id`, `mission_id`, `status`, `task_type`, `view_as` and returns an unbounded array. `IA-04` needs `?mine=1` and `cursor`/`limit`. This is added *additively* — the existing query params keep their meaning and an absent `cursor` keeps the legacy array shape only when `limit` is also absent, so the six existing callers do not break (Task 5 lists them).

10. **The nav registry is the source of truth for "has a page".** Nine seeded module keys have no route in P4 (`shipments`, `customers`, `reviews`, `promotions` → Phase 34; `talent` → v2.1; `catalog` maps to the existing `/operations/menu`; `experiences` maps to `/operations/events`). Keys with no route are simply absent from `lib/nav/spine.ts`, so `ModuleAccess` can grant them without producing a dead link. Phase 34 adds the entries.

11. **SPEC §6.2 has no "Missions" spine item.** `/missions`, `/boards/missions`, `/boards/quests` stay as routes reachable from Mission Control and quest pages but are *not* in the spine — that is what makes "no label appears twice" achievable. `/admin/blockers` becomes a redirect to `/tasks?status=blocked`; `/boards/wins`, `/team-contribution`, `/activity` and `/leaderboard` stay as routes but are absorbed as tabs of `/team` and leave the spine.

12. **The root layout hard-codes dark.** `app/layout.tsx` sets `className="… dark h-full antialiased"` on `<html>` and `lib/providers.tsx` sets `defaultTheme="dark"`. Light mode is therefore unreachable today. Both are fixed in Task 1 (`defaultTheme="system"`, `enableSystem`), which is a prerequisite for DESIGN-02's light-mode validation.

13. **The arbitrary-colour lint rule is scoped, not global.** 336 raw palette/arbitrary colour occurrences exist across 109 files: ~259 in ops (fixed by Tasks 7–9), 31 in `components/public` + 3 in `app/(public)` (Task 10), 12 in `app/(auth)` (Task 10), 15 in the frozen `app/page.tsx`, 1 in the frozen `ScrollVideoStory.tsx`, 16 in `components/spectrumui/` (deleted). `components/ui/` is already clean (0). The rule ships as **error** for `app/(ops)/**`, `components/ops/**`, `components/ui/**`, `lib/**` and **warn** for `app/(public)/**` + `components/public/**` (Phase 34 rewrites the storefront wholesale); the two frozen files are ignored by path.

14. **Kitchen screens poll at 5 s today** (`KdsBoard.tsx:20`, `PickAndPackBoard.tsx:20`, both with `refetchIntervalInBackground: true`), POS at 10–15 s. SPEC §6.4 caps fallback polling at ≥ 30 s. Task 18 adds Pusher and raises every interval to 30 s.

15. **`AdminAdHocInjectorWidget` posts an invalid body** — it omits the required `mission_id`, `domain`, `owner_user_id`, `priority` and sends unknown `assigned_to` / `status`, so it 400s against `CreateTaskDto`. It is replaced by a button that opens the existing `AdHocTaskSheet` (Task 14).

16. **BullMQ remnants are already gone** from every `.env.example` (grep in Task 2 records the zero result). `PLAT-09` listed them under P2; nothing remains to remove.

---

## Contracts assumed from Phase 31

Phase 31 (P3, mission bridge) runs concurrently. Mission Control and My Day *read* data P3 produces. Every consumer below must render a defined empty/degraded state when the call 404s, 403s or errors — never a crash, never a spinner that never resolves. The shared helper is `frontend/lib/api/optional.ts` (Task 14):

```ts
/** Resolves to `null` instead of throwing when an endpoint Phase 31 owns is not live yet. */
export async function optionalGet<T>(path: string): Promise<T | null> {
  try {
    return await apiClient.get<T>(path);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403 || err.status === 501)) return null;
    throw err;
  }
}
```

| # | Endpoint assumed | Assumed response shape | Consumer | Degraded behaviour if absent |
|---|---|---|---|---|
| C1 | `GET /readiness-meters/:code/history?days=30` | `{ code: string; points: { date: string /* YYYY-MM-DD */; value: number }[] }` | Mission Control "Status" sparkline (Task 14) | Sparkline block is not rendered; the current meter value still shows |
| C2 | `GET /approvals?mine=1&status=pending` | `{ id, entity_type: 'task'\|'decision'\|'recipe'\|'evidence', entity_id, entity_title, required_role_code, status, created_at }[]` | Header "approvals waiting on me" badge (Task 11), Mission Control Action Required, My Day (Task 14) | Falls back to today's `GET /evidence?status=pending` count, which is what `Sidebar.tsx:173` already does |
| C3 | `POST /approvals/:id/decide` `{ decision: 'approve'\|'reject', note?: string }` | the updated approval | Inline approve/reject (Task 16) | Falls back to the existing `POST /approvals/:id/approve` and the existing `RejectionDialog` flow |
| C4 | `GET /readiness-meters` returns `mode: 'task_driven'\|'derived'\|'hybrid'` and `formula_key` | existing `ReadinessMeter[]` + those two fields | My Day "my meter contributions" (Task 14) | Fields are already columns in P2's schema; if the API omits them the mode chip is not rendered |
| C5 | `GET /decisions?status=proposed` | existing `Decision[]` | Mission Control "stale decisions" | Already live today (`Sidebar.tsx:184`) — no degradation needed |

**Reconciliation note for the harness:** C1–C3 are the only genuinely new surfaces. If Phase 31 names them differently, change the three constants in `frontend/lib/api/phase31.ts` (Task 14) — no other file hard-codes those paths.

---

## Token table

### Source: `--public-*` as found in `frontend/app/globals.css` (unchanged values, relocated to `tokens.css`)

| `--public-*` | Value | Promoted to (light) |
|---|---|---|
| `--public-bg` | `oklch(0.98 0.005 80)` | `--bg` |
| `--public-surface` | `#f0ebe3` | `--surface-raised` |
| `--public-surface-alt` | `#f0ebe3` *(identical to `--public-surface`; kept for the homepage, not promoted)* | — |
| `--public-fg` | `#1c1917` | `--ink` |
| `--public-fg-hover` | `#292524` | `--ink-strong` (inverted role: hover on light) |
| `--public-fg-subtle` | `#44403c` | `--ink-subtle` |
| `--public-muted` | `#78716c` | `--ink-muted` |
| `--public-muted-warm` | `#a1977e` | `--ink-faint` |
| `--public-muted-stone` | `#a8a29e` | *(dark-mode `--ink-muted`)* |
| `--public-border` | `#e8e0d4` | `--line` |
| `--public-border-warm` | `#e0d8cc` | `--line-warm` |
| `--public-border-light` | `#d6cfc4` | `--line-strong` |
| `--public-terracotta` | `#c2410c` | `--accent` |
| `--public-terracotta-hover` | `#b13a0a` | `--accent-hover` |
| `--public-olive` | `#365314` | `--leaf` |
| `--public-olive-hover` | `#2d4510` | `--leaf-hover` |
| `--public-accent` | `#a16207` | `--gold` |
| `--public-cart-bar` / `--public-cart-bar-fg` | `#1c1917` / `#fafaf9` | *(storefront-only, not promoted)* |
| `--public-tracking-active/done/pending` | `#c2410c` / `#365314` / `#d6cfc4` | *(storefront-only, not promoted)* |

### Semantic layer — light (`:root`) and dark (`.dark`)

| Semantic token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `oklch(0.98 0.005 80)` | `#141210` | page ground |
| `--surface` | `#faf8f5` | `#1c1917` | card / popover / sidebar |
| `--surface-raised` | `#f0ebe3` | `#252220` | hover tint, muted fill, secondary |
| `--surface-sunken` | `#e8e0d4` | `#0d0b0a` | wells, table stripes, kanban columns |
| `--ink` | `#1c1917` | `#f5f0e8` | body text |
| `--ink-strong` | `#0c0a09` | `#ffffff` | headings, emphasised numerals |
| `--ink-subtle` | `#44403c` | `#d6cfc4` | secondary text |
| `--ink-muted` | `#78716c` | `#a8a29e` | labels, captions, placeholders |
| `--ink-faint` | `#a1977e` | `#78716c` | disabled, dividers-with-text |
| `--line` | `#e8e0d4` | `#2e2a26` | default border |
| `--line-warm` | `#e0d8cc` | `#332e29` | warm inner divider |
| `--line-strong` | `#d6cfc4` | `#413b35` | input border, focused container |
| `--accent` | `#c2410c` | `#e8663a` | brand primary (terracotta) |
| `--accent-hover` | `#b13a0a` | `#f07a52` | brand primary hover |
| `--accent-ink` | `#fffbf7` | `#1c0f09` | text on brand primary |
| `--accent-soft` | `color-mix(in oklab, var(--accent) 12%, transparent)` | `color-mix(in oklab, var(--accent) 20%, transparent)` | brand tint fill |
| `--leaf` | `#365314` | `#8fae4a` | brand secondary (olive) |
| `--leaf-hover` | `#2d4510` | `#a2c159` | |
| `--leaf-ink` | `#f7faf2` | `#131a08` | text on olive |
| `--gold` | `#a16207` | `#d9a441` | brand tertiary (amber) — fills, large text, icons |
| `--gold-text` | `#8a5406` | `#d9a441` | amber for **small** text (light amber is only 4.71:1 on `--bg`; `#8a5406` is 6.0:1) |
| `--gold-ink` | `#fffaf0` | `#1c1408` | text on amber |
| `--focus` | `var(--accent)` | `var(--accent)` | focus ring |
| `--radius` | `0.625rem` | `0.625rem` | unchanged from today |

### Status layer — separate from brand (SPEC §7)

| Token | Light | Dark | Contrast on `--bg` (light / dark) |
|---|---|---|---|
| `--status-good` | `#15803d` | `#4ade80` | 4.80 : 1 / 10.7 : 1 |
| `--status-warning` | `#b45309` | `#fbbf24` | 4.81 : 1 / 11.2 : 1 |
| `--status-serious` | `#be123c` | `#fb7185` | 6.01 : 1 / 6.94 : 1 |
| `--status-critical` | `#7f1d1d` | `#ef4444` | 9.60 : 1 / 4.97 : 1 |
| `--status-info` | `#1d4ed8` | `#60a5fa` | 6.41 : 1 / 7.35 : 1 |
| `--status-neutral` | `var(--ink-muted)` | `var(--ink-muted)` | 4.90 : 1 / 7.41 : 1 |
| `--status-*-ink` | `#fff1f2` / `#f0fdf4` / `#fffbeb` / `#eff6ff` | `#141210` | text on a solid status fill |

`serious` and `critical` sit in the same hue family on purpose — they are the readiness ramp, and they are differentiated by **weight**, not hue: `serious` renders as a tinted background with coloured text (`bg-[var(--status-serious)]/12 text-[var(--status-serious)]`), `critical` renders as a solid fill with inverse text (`bg-[var(--status-critical)] text-[var(--status-critical-ink)]`). Every pair above clears WCAG AA (≥ 4.5 : 1) for normal text against its own theme's `--bg`.

### Compat layer — the 26 shadcn/base-ui names, re-pointed

`--background: var(--bg)` · `--foreground: var(--ink)` · `--card: var(--surface)` · `--card-foreground: var(--ink)` · `--popover: var(--surface)` · `--popover-foreground: var(--ink)` · `--primary: var(--accent)` · `--primary-foreground: var(--accent-ink)` · `--secondary: var(--surface-raised)` · `--secondary-foreground: var(--ink)` · `--muted: var(--surface-raised)` · `--muted-foreground: var(--ink-muted)` · `--ui-accent: var(--surface-raised)` · `--ui-accent-foreground: var(--ink)` · `--destructive: var(--status-critical)` · `--success: var(--status-good)` · `--info: var(--status-info)` · `--border: var(--line)` · `--input: var(--line-strong)` · `--ring: var(--focus)` · `--chart-1..5` = `var(--accent)`, `var(--leaf)`, `var(--gold)`, `var(--status-info)`, `var(--ink-faint)` · `--sidebar: var(--surface)` · `--sidebar-foreground: var(--ink)` · `--sidebar-primary: var(--accent)` · `--sidebar-primary-foreground: var(--accent-ink)` · `--sidebar-accent: var(--surface-raised)` · `--sidebar-accent-foreground: var(--ink)` · `--sidebar-border: var(--line)` · `--sidebar-ring: var(--focus)`.

### Tailwind v4 `@theme inline` wiring

```css
@theme inline {
  /* Brand + semantic utilities (new) */
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-surface-sunken: var(--surface-sunken);
  --color-ink: var(--ink);
  --color-ink-strong: var(--ink-strong);
  --color-ink-subtle: var(--ink-subtle);
  --color-ink-muted: var(--ink-muted);
  --color-ink-faint: var(--ink-faint);
  --color-line: var(--line);
  --color-line-warm: var(--line-warm);
  --color-line-strong: var(--line-strong);
  --color-brand: var(--accent);
  --color-brand-hover: var(--accent-hover);
  --color-brand-ink: var(--accent-ink);
  --color-leaf: var(--leaf);
  --color-gold: var(--gold);
  --color-gold-text: var(--gold-text);
  --color-good: var(--status-good);
  --color-warning: var(--status-warning);
  --color-serious: var(--status-serious);
  --color-critical: var(--status-critical);
  --color-info-status: var(--status-info);

  /* Compat utilities (existing names, new values) */
  --color-accent: var(--ui-accent);              /* NOTE: hover tint, not brand */
  --color-accent-foreground: var(--ui-accent-foreground);
  /* …the remaining --color-* lines are unchanged from today's globals.css… */
}
```

Utilities this produces: `bg-bg`, `bg-surface`, `bg-surface-raised`, `text-ink`, `text-ink-muted`, `border-line`, `border-line-strong`, `bg-brand`, `text-brand`, `border-brand`, `text-leaf`, `text-gold-text`, `bg-good`, `text-critical`, … alongside every existing shadcn utility.

**Project rule reminder — arbitrary values must wrap in `var()`.** Write `bg-[var(--accent-soft)]`, `text-[var(--status-serious)]`, `border-[var(--line-strong)]`. Never `bg-[--accent-soft]`. Prefer the named utility when one exists (`bg-brand` over `bg-[var(--accent)]`).

---

## File structure

**Create (frontend):**
- `frontend/app/tokens.css` — the single token file: ramp → `--public-*` → semantic → status → compat, for `:root` and `.dark`.
- `frontend/app/base-ui-variants.css` — the 95 vendored lines from `shadcn/tailwind.css`.
- `frontend/lib/nav/spine.ts` — the module-key → route/label/icon/group registry + `buildSpine()`.
- `frontend/lib/api/optional.ts`, `frontend/lib/api/phase31.ts` — degrade-gracefully helpers and the three Phase-31 path constants.
- `frontend/lib/hooks/use-module-access.ts`, `use-header-context.ts`, `use-usage-event.ts`, `use-realtime-channel.ts`.
- `frontend/components/ops/header/AppHeader.tsx`, `MissionCrumb.tsx`, `ReadinessPill.tsx`, `AlertBadges.tsx`, `XpChip.tsx`, `CommandPalette.tsx`, `HeaderUserMenu.tsx`.
- `frontend/components/ops/nav/SpineNav.tsx`, `SpineGroup.tsx`, `SpineLink.tsx`.
- `frontend/components/ops/tasks/TaskFilterBar.tsx`, `TaskSheet.tsx`, `TaskRowEvidenceButton.tsx`, `QuestTaskChip.tsx`, `MeterChip.tsx`.
- `frontend/components/ops/quests/QuestSheet.tsx`, `QuestLinkedEntities.tsx`.
- `frontend/components/ops/team/TeamTabs.tsx`.
- `frontend/components/ops/dashboard/MissionControl.tsx`, `MyDay.tsx`, `ActionRequiredPanel.tsx`, `StatusPanel.tsx`, `IntelligencePanel.tsx`, `ReadinessSparkline.tsx`, `NudgesPanel.tsx`.
- `frontend/components/ops/admin/ModuleAccessEditor.tsx`, `NodeSettingsForm.tsx`.
- `frontend/app/(ops)/tasks/page.tsx`, `frontend/app/(ops)/quests/page.tsx`, `frontend/app/(ops)/team/page.tsx`, `frontend/app/(ops)/admin/modules/page.tsx`, `frontend/app/(ops)/admin/node/page.tsx`.
- `frontend/app/(auth)/sign-in/page.tsx` (moved from `(auth)/team/page.tsx`).
- `frontend/eslint-rules/no-raw-colors.mjs` — a local flat-config fragment (no new dependency).

**Delete (frontend):** `frontend/components/spectrumui/` (whole dir), `frontend/components/patterns/` (whole dir), `frontend/app/(auth)/team/` (moved), `frontend/app/(ops)/quests/[id]/tasks/new/`, `frontend/app/(ops)/missions/[id]/quests/new/` (both become sheets), `frontend/components/ops/boards/MissionCard.tsx` (merged), `frontend/components/ops/dashboard/AdminAdHocInjectorWidget.tsx` (replaced).

**Create (backend):**
- `backend/src/usage/usage.service.ts`, `usage.service.spec.ts`, `usage.controller.ts`, `usage.module.ts`, `dto/create-usage-event.dto.ts`.
- `backend/src/me/me.service.ts`, `me.service.spec.ts`, `me.controller.ts`, `me.module.ts`.
- `backend/src/search/search.service.ts`, `search.service.spec.ts`, `search.controller.ts`, `search.module.ts`.
- `backend/src/realtime/realtime.controller.ts`, `realtime.service.ts`, `realtime.service.spec.ts`, `realtime.module.ts`, `realtime.channels.ts`, `dto/realtime-auth.dto.ts`.
- `backend/prisma/migrations/20260826000000_p4_role_aware_ia/migration.sql`.

**Modify (shared files — each assigned to exactly one task):**

| File | Owned by |
|---|---|
| `frontend/app/globals.css` | Task 1 |
| `frontend/app/layout.tsx` | Task 1 |
| `frontend/lib/providers.tsx` | Task 1 |
| `frontend/lib/brand-colors.ts` | Task 1 |
| `frontend/lib/status-styles.ts` | Task 1 |
| `frontend/package.json` | Task 1 |
| `frontend/components.json` | Task 2 |
| `frontend/eslint.config.mjs` | Task 19 |
| `frontend/lib/types/index.ts` | Task 12 |
| `frontend/app/(ops)/layout.tsx` | Task 11 |
| `frontend/components/ops/Sidebar.tsx` | Task 12 |
| `frontend/proxy.ts` | Task 12 |
| `frontend/app/(ops)/dashboard/page.tsx` | Task 7 (sweep), then Task 14 (rewrite) |
| `backend/src/app.module.ts` | Task 3 |
| `backend/prisma/schema.prisma` | Task 3 |

**Current state (verified 23 Aug at `0da0e09`):** 93 route files under `frontend/app`, 279 components under `frontend/components`. No `/tasks` list page, no `/quests` list page, no `/team` ops page, no `/admin/modules`, no `/admin/node`. `Sidebar.tsx` (663 lines) builds nav from **permissions**, not `ModuleAccess`. Backend has `GET /modules`, `GET /modules/mine`, `PATCH /modules/:key`, `GET/PATCH /nodes/current`, `GET /missions/mission-control`, 47 seeded `ModuleAccess` rows matching SPEC §6.3 exactly. No `UsageEvent` model, no `/usage`, no `/search`, and Pusher channel auth is hard-wired to `private-chat-*` in `chat.controller.ts:37`.

---

### Task 1: One token file — brand ramp, semantic layer, compat layer, light + dark

Everything else in this plan repaints itself the moment this lands, because the compat layer re-points the variable names all 44 `components/ui/*` primitives already consume.

**Files:**
- Create: `frontend/app/tokens.css`, `frontend/app/base-ui-variants.css`
- Modify: `frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/lib/providers.tsx`, `frontend/lib/brand-colors.ts`, `frontend/lib/status-styles.ts`, `frontend/package.json`

- [ ] Create `frontend/app/base-ui-variants.css` holding the exact 95 lines of `frontend/node_modules/shadcn/dist/tailwind.css`, prefixed by this comment:

```css
/* Vendored from `shadcn@4.0.8` dist/tailwind.css (SPEC §3.5 removes `shadcn` as a runtime dependency).
   Supplies the base-ui data-state variants (32 uses across 15 files) and `@utility no-scrollbar`. */
```

  Copy it verbatim from `frontend/`: `node -e "const fs=require('fs');fs.appendFileSync('app/base-ui-variants.css', fs.readFileSync('node_modules/shadcn/dist/tailwind.css','utf8'))"`.

- [ ] Create `frontend/app/tokens.css`:

```css
/* ─────────────────────────────────────────────────────────────────────────────
   Konma Xperience OS — the one token file (SPEC §7, DESIGN-01/02).
   Layer 1 `--public-*` : the homepage palette, values unchanged. app/page.tsx and
                          ScrollVideoStory.tsx are frozen and read these directly.
   Layer 2 semantic     : --bg / --surface / --ink / --line / --accent / --leaf / --gold
   Layer 3 status       : good < warning < serious < critical, separate from brand
   Layer 4 compat       : the shadcn/base-ui names, re-pointed at layer 2.
   No component may declare a colour. Enforced by eslint-rules/no-raw-colors.mjs.
   ───────────────────────────────────────────────────────────────────────────── */

/* ── Layer 1 — public palette (moved from globals.css, values byte-identical) ── */
:root {
  --public-bg: oklch(0.98 0.005 80);
  --public-fg: #1c1917;
  --public-fg-hover: #292524;
  --public-muted: #78716c;
  --public-muted-warm: #a1977e;
  --public-muted-stone: #a8a29e;
  --public-border: #e8e0d4;
  --public-surface: #f0ebe3;
  --public-surface-alt: #f0ebe3;
  --public-border-warm: #e0d8cc;
  --public-terracotta: #c2410c;
  --public-terracotta-hover: #b13a0a;
  --public-olive: #365314;
  --public-olive-hover: #2d4510;
  --public-fg-subtle: #44403c;
  --public-border-light: #d6cfc4;
  --public-accent: #a16207;
  --public-cart-bar: #1c1917;
  --public-cart-bar-fg: #fafaf9;
  --public-tracking-active: #c2410c;
  --public-tracking-done: #365314;
  --public-tracking-pending: #d6cfc4;
}

/* ── Layers 2 + 3 — semantic and status, light ── */
:root {
  --bg: var(--public-bg);
  --surface: #faf8f5;
  --surface-raised: var(--public-surface);
  --surface-sunken: var(--public-border);

  --ink: var(--public-fg);
  --ink-strong: #0c0a09;
  --ink-subtle: var(--public-fg-subtle);
  --ink-muted: var(--public-muted);
  --ink-faint: var(--public-muted-warm);

  --line: var(--public-border);
  --line-warm: var(--public-border-warm);
  --line-strong: var(--public-border-light);

  --accent: var(--public-terracotta);
  --accent-hover: var(--public-terracotta-hover);
  --accent-ink: #fffbf7;
  --accent-soft: color-mix(in oklab, var(--accent) 12%, transparent);

  --leaf: var(--public-olive);
  --leaf-hover: var(--public-olive-hover);
  --leaf-ink: #f7faf2;

  --gold: var(--public-accent);
  --gold-text: #8a5406;   /* #a16207 is 4.71:1 on --bg; this is 6.0:1, safe for small text */
  --gold-ink: #fffaf0;

  --focus: var(--accent);
  --radius: 0.625rem;

  --status-good: #15803d;
  --status-good-ink: #f0fdf4;
  --status-warning: #b45309;
  --status-warning-ink: #fffbeb;
  --status-serious: #be123c;
  --status-serious-ink: #fff1f2;
  --status-critical: #7f1d1d;
  --status-critical-ink: #fff1f2;
  --status-info: #1d4ed8;
  --status-info-ink: #eff6ff;
  --status-neutral: var(--ink-muted);
  --status-neutral-ink: var(--surface);
}

/* ── Layers 2 + 3 — dark (SPEC §7 designed dark set) ── */
.dark {
  --bg: #141210;
  --surface: #1c1917;
  --surface-raised: #252220;
  --surface-sunken: #0d0b0a;

  --ink: #f5f0e8;
  --ink-strong: #ffffff;
  --ink-subtle: #d6cfc4;
  --ink-muted: #a8a29e;
  --ink-faint: #78716c;

  --line: #2e2a26;
  --line-warm: #332e29;
  --line-strong: #413b35;

  --accent: #e8663a;
  --accent-hover: #f07a52;
  --accent-ink: #1c0f09;
  --accent-soft: color-mix(in oklab, var(--accent) 20%, transparent);

  --leaf: #8fae4a;
  --leaf-hover: #a2c159;
  --leaf-ink: #131a08;

  --gold: #d9a441;
  --gold-text: #d9a441;
  --gold-ink: #1c1408;

  --status-good: #4ade80;
  --status-good-ink: #141210;
  --status-warning: #fbbf24;
  --status-warning-ink: #141210;
  --status-serious: #fb7185;
  --status-serious-ink: #141210;
  --status-critical: #ef4444;
  --status-critical-ink: #141210;
  --status-info: #60a5fa;
  --status-info-ink: #141210;
  --status-neutral: var(--ink-muted);
  --status-neutral-ink: #141210;
}

/* ── Layer 4 — compat: the names every components/ui/* file already consumes ── */
:root, .dark {
  --background: var(--bg);
  --foreground: var(--ink);
  --card: var(--surface);
  --card-foreground: var(--ink);
  --popover: var(--surface);
  --popover-foreground: var(--ink);
  --primary: var(--accent);
  --primary-foreground: var(--accent-ink);
  --secondary: var(--surface-raised);
  --secondary-foreground: var(--ink);
  --muted: var(--surface-raised);
  --muted-foreground: var(--ink-muted);
  --ui-accent: var(--surface-raised);
  --ui-accent-foreground: var(--ink);
  --destructive: var(--status-critical);
  --success: var(--status-good);
  --info: var(--status-info);
  --border: var(--line);
  --input: var(--line-strong);
  --ring: var(--focus);
  --chart-1: var(--accent);
  --chart-2: var(--leaf);
  --chart-3: var(--gold);
  --chart-4: var(--status-info);
  --chart-5: var(--ink-faint);
  --sidebar: var(--surface);
  --sidebar-foreground: var(--ink);
  --sidebar-primary: var(--accent);
  --sidebar-primary-foreground: var(--accent-ink);
  --sidebar-accent: var(--surface-raised);
  --sidebar-accent-foreground: var(--ink);
  --sidebar-border: var(--line);
  --sidebar-ring: var(--focus);
}
```

- [ ] Rewrite the head of `frontend/app/globals.css` (replace lines 1–6):

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "./base-ui-variants.css";
@import "./tokens.css";
@plugin '@tailwindcss/typography';

@custom-variant dark (&:is(.dark *));
```

- [ ] In the same file's `@theme inline { … }` block: **keep** every existing `--color-*` line except `--color-accent` / `--color-accent-foreground`, which become `var(--ui-accent)` / `var(--ui-accent-foreground)`; **add** the new semantic map exactly as printed in the Token table section above; **delete** the four Magic-UI keyframe blocks (`shimmer-slide`, `spin-around`, `pulse`, `shine`) and their `--animate-*` declarations — Task 8 deletes their only consumers.

- [ ] In the same file, delete the three now-duplicated `:root` / `.dark` / `.light` colour blocks and the `--public-*` block (all moved to `tokens.css`), and de-hard-code `mark`:

```css
mark { background: transparent; color: var(--accent); font-weight: 600; }
```

  Keep unchanged: the `@layer base` block, `::view-transition-*`, the `orb-drift-*` / `dot-drift` / `glow-pulse` keyframes, the `@supports (animation-timeline: scroll())` block and the `prefers-reduced-motion` block — all homepage-scoped, and the homepage is frozen.

- [ ] `frontend/app/layout.tsx` — drop the hard-coded `dark` so light mode becomes reachable, and re-point the theme colours:

```tsx
className={`${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
```
```tsx
themeColor: [
  { media: "(prefers-color-scheme: dark)", color: "#141210" },
  { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
],
```

- [ ] `frontend/lib/providers.tsx` — `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>`.

- [ ] Replace `frontend/lib/brand-colors.ts` entirely — only the two BorderBeam colours survive:

```ts
/**
 * The only colour constants allowed outside tokens.css. `BorderBeam` takes colours
 * as props, not classes, so it cannot use a Tailwind utility — these read brand tokens.
 * SPEC §6.4 allows BorderBeam on new KDS / Pick & Pack orders only.
 */
export const BEAM_FROM = 'var(--accent)';
export const BEAM_TO = 'var(--gold)';
```

- [ ] Replace `frontend/lib/status-styles.ts`. The exported API is unchanged (so no call site breaks) and gains the readiness ramp. Colour-named keys stay as deprecated aliases until the end of Wave 1:

```ts
/**
 * Semantic status classes. Colour lives in tokens.css; this file maps *meaning* to
 * token classes. `serious` is a tint + coloured text, `critical` is a solid fill +
 * inverse text — the two are differentiated by weight, not hue.
 */
export const STATUS_BADGE = {
  good:     'text-[var(--status-good)] bg-[var(--status-good)]/12 border-[var(--status-good)]/25',
  warning:  'text-[var(--status-warning)] bg-[var(--status-warning)]/12 border-[var(--status-warning)]/25',
  serious:  'text-[var(--status-serious)] bg-[var(--status-serious)]/12 border-[var(--status-serious)]/25',
  critical: 'text-[var(--status-critical-ink)] bg-[var(--status-critical)] border-transparent',
  info:     'text-[var(--status-info)] bg-[var(--status-info)]/12 border-[var(--status-info)]/25',
  neutral:  'text-ink-muted bg-surface-raised border-transparent',
  muted:    'text-ink-muted bg-surface-raised border-transparent line-through',
  /** @deprecated colour-named aliases — deleted at the end of Wave 1. */
  amber: 'text-[var(--status-warning)] bg-[var(--status-warning)]/12 border-[var(--status-warning)]/25',
  blue:  'text-[var(--status-info)] bg-[var(--status-info)]/12 border-[var(--status-info)]/25',
  green: 'text-[var(--status-good)] bg-[var(--status-good)]/12 border-[var(--status-good)]/25',
  red:   'text-[var(--status-serious)] bg-[var(--status-serious)]/12 border-[var(--status-serious)]/25',
} as const;

export function getTaskStatusBadge(status: string): string {
  switch (status) {
    case 'doing': return STATUS_BADGE.info;
    case 'done': return STATUS_BADGE.good;
    case 'blocked': return STATUS_BADGE.critical;
    case 'cancelled': return STATUS_BADGE.muted;
    default: return STATUS_BADGE.neutral;
  }
}

export function getTaskTypeBadge(type: string): string {
  switch (type) {
    case 'adhoc': return STATUS_BADGE.warning;
    case 'improvement': return STATUS_BADGE.info;
    default: return '';
  }
}

export function getPriorityBadge(priority: string): string {
  switch (priority) {
    case 'critical': return STATUS_BADGE.critical;
    case 'high': return STATUS_BADGE.serious;
    case 'medium': return STATUS_BADGE.warning;
    default: return '';
  }
}

export function getEvidenceStatusBadge(status: string): string {
  switch (status) {
    case 'pending': return STATUS_BADGE.warning;
    case 'approved': return STATUS_BADGE.good;
    case 'rejected': return STATUS_BADGE.serious;
    default: return STATUS_BADGE.neutral;
  }
}

/** Readiness 0–100 → the four-band ramp (SPEC §7 status colours). */
export function getReadinessBandBadge(value: number): string {
  if (value >= 75) return STATUS_BADGE.good;
  if (value >= 50) return STATUS_BADGE.warning;
  if (value >= 25) return STATUS_BADGE.serious;
  return STATUS_BADGE.critical;
}

/** Bare token for chart series and SVG fills, which cannot take a class. */
export function readinessBandToken(value: number): string {
  if (value >= 75) return 'var(--status-good)';
  if (value >= 50) return 'var(--status-warning)';
  if (value >= 25) return 'var(--status-serious)';
  return 'var(--status-critical)';
}
```

- [ ] `frontend/package.json`: delete `"framer-motion": "^12.38.0"` from `dependencies`; move `"shadcn": "^4.0.8"` to `devDependencies`. Then `cd frontend && npm install` to refresh `package-lock.json`.

**Verification:**
- `cd frontend && npx tsc --noEmit` → exit 0.
- `cd frontend && npx eslint .` → 0 errors.
- `cd frontend && npm run build` → compiles, full route table renders.
- `node -e "const fs=require('fs');const a=fs.readFileSync('app/base-ui-variants.css','utf8'),b=fs.readFileSync('node_modules/shadcn/dist/tailwind.css','utf8');process.exit(a.includes(b)?0:1)"` → exit 0.
- `node -e "const p=require('./package.json');process.exit(p.dependencies['framer-motion']||p.dependencies['shadcn']?1:0)"` → exit 0.
- Contrast acceptance: the pairs in the Token table are the acceptance figures (all ≥ 4.5 : 1, computed against sRGB relative luminance). Re-check any pair whose value is changed.
- Manual: load `/dashboard` in both themes via the header toggle; confirm terracotta primary buttons, warm stone ground, no black-on-black or white-on-white.

---

### Task 2: SPEC §3.5 front-end removals, with a grep-proven audit per removal

Nothing is deleted on faith. Each removal is preceded by the grep that proves it unreferenced, and every grep result goes verbatim into the commit body.

**Files:**
- Delete: `frontend/components/spectrumui/kanbanboard.tsx` (dir goes with it), `frontend/components/patterns/p-combobox-3.tsx` (dir goes with it)
- Modify: `frontend/components.json`

- [ ] **`framer-motion`** — `grep -rn "framer-motion" --include=*.ts --include=*.tsx app components lib hooks` → **expected: no output**. All 11 animation files import `motion/react` (the `motion` package, which stays — BorderBeam, NumberTicker and the frozen homepage need it). Task 1's `package.json` edit is therefore a pure dependency drop.
- [ ] **`components/spectrumui/`** — `grep -rn "spectrumui" --include=*.ts --include=*.tsx app components lib hooks` → **expected: no output**; the only repo-wide hit is the registry URL in `components.json`. Delete `components/spectrumui/kanbanboard.tsx`. This also removes 16 of the 336 raw-colour occurrences.
- [ ] **`components/patterns/p-combobox-3.tsx`** — `grep -rn "p-combobox-3\|components/patterns" --include=*.ts --include=*.tsx app components lib hooks` → **expected: exactly one hit**, a stale comment at `components/ops/tasks/TaskForm.tsx:292`. Delete the file and directory; **Task 7** (which owns `TaskForm.tsx`) rewrites that comment to `{/* Dependency picker — Combobox from @base-ui/react via components/ui/combobox */}`.
- [ ] **`shadcn` runtime dependency** — `grep -rn "from ['\"]shadcn" --include=*.ts --include=*.tsx app components lib hooks` → **expected: no output**; nothing imports the package as JS. Its only consumption was `@import "shadcn/tailwind.css"`, vendored in Task 1. Delete the `"@spectrumui": "https://ui.spectrumhq.in/r/{name}.json"` line from the `registries` block of `frontend/components.json` so no registry points at the deleted directory. Leave the rest of `components.json` intact — the CLI still runs from `devDependencies`.
- [ ] **Duplicate `MissionCard`** — `grep -rn "MissionCard" --include=*.tsx app components` returns `components/ops/missions/MissionCard.tsx` (exports `MissionCard`, used at `app/(ops)/missions/page.tsx:17`) and `components/ops/boards/MissionCard.tsx` (exports `BoardMissionCard`, used at `app/(ops)/boards/missions/page.tsx:17`). Both render title, phase, progress and readiness-impact badges. Record the audit; **Task 7 performs the merge** (it owns both directories). Target: one `components/ops/missions/MissionCard.tsx` exporting `MissionCard` with `density?: 'full' | 'compact'`; `boards/MissionCard.tsx` deleted; `boards/missions/page.tsx` imports `MissionCard` with `density="compact"`.
- [ ] **Duplicate `GuideSectionCard`** — `grep -rn "GuideSectionCard" --include=*.tsx app components` returns `components/ops/guide/GuideSectionCard.tsx` (66 lines, reader card, `app/(ops)/guide/page.tsx:9`) and `components/ops/guide/admin/GuideSectionCard.tsx` (261 lines, editor row, `guide/admin/GuideSectionList.tsx:7`). Different components, same name. Record the audit; **Task 9 performs the rename**: `admin/GuideSectionCard.tsx` → `admin/GuideSectionAdminRow.tsx`, export `GuideSectionAdminRow`, `GuideSectionList.tsx` updated.
- [ ] **BullMQ remnants** — `grep -rn -i "bullmq\|BULL_\|REDIS_QUEUE" .env.example backend/.env.example frontend/.env.example` → **expected: no output**. Already removed before P4; record the zero result, change nothing.

**Verification:**
- `cd frontend && npx tsc --noEmit` → exit 0; `npx eslint .` → 0 errors; `npm run build` → compiles.
- `test ! -d components/spectrumui && test ! -d components/patterns` → exit 0.
- `grep -rn "spectrumui\|p-combobox-3\|framer-motion" . --include=*.ts --include=*.tsx --include=*.json --include=*.css --exclude-dir=node_modules --exclude=package-lock.json` → no output.

---

### Task 3: `UsageEvent` model, the `p4_role_aware_ia` migration, and the `usage` module

`IA-07` and SPEC §8 require usage events; P2 deferred the model. This is the only schema change in P4, and it is purely additive.

**Files:**
- Modify: `backend/prisma/schema.prisma`, `backend/src/app.module.ts`
- Create: `backend/prisma/migrations/20260826000000_p4_role_aware_ia/migration.sql`, `backend/src/usage/usage.service.ts`, `usage.service.spec.ts`, `usage.controller.ts`, `usage.module.ts`, `dto/create-usage-event.dto.ts`
- Backend only. The matching `frontend/lib/types/usage.ts` belongs to Task 18, and its `index.ts` re-export to Task 12.

- [ ] Append the enum to `backend/prisma/schema.prisma`, in the enum block, alphabetically near `UnitType`:

```prisma
enum UsageEventType { page_view action }
```

- [ ] Append the model after `ModuleAccess`:

```prisma
/// Page views per role and key actions (SPEC §8 observability, IA-07). Feeds the
/// Phase 35 admin usage dashboard (RUN-04). Writes are fire-and-forget and are
/// never part of a business transaction.
model UsageEvent {
  id         String         @id @default(uuid())
  node_id    String         @default("11111111-1111-4111-8111-111111111111")
  node       Node           @relation(fields: [node_id], references: [id], onDelete: Restrict)
  user_id    String?
  user       User?          @relation(fields: [user_id], references: [id], onDelete: SetNull)
  role_code  String
  event_type UsageEventType
  /// Route path for `page_view`, e.g. `/tasks`. Query strings are stripped client-side.
  path       String?
  /// Dotted action key for `action`, e.g. `task.create`, `evidence.upload`.
  action     String?
  meta       Json?
  created_at DateTime       @default(now()) @db.Timestamptz(3)

  @@index([node_id, created_at])
  @@index([role_code, created_at])
  @@index([user_id, created_at])
  @@index([event_type, created_at])
}
```

  Add the back-relations: `usage_events UsageEvent[]` on `model Node` and on `model User`.

- [ ] Generate the migration from `backend/`:

```
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url postgresql://konma:konma@localhost:5433/konma_shadow --script > prisma/migrations/20260826000000_p4_role_aware_ia/migration.sql
```

  Expect exactly one `CREATE TYPE "UsageEventType"`, one `CREATE TABLE "UsageEvent"`, two `ALTER TABLE … ADD CONSTRAINT` foreign keys and four `CREATE INDEX`. **Nothing else may appear** — if the diff contains anything from another model, the working tree has drifted and the task stops.

  > **Cross-phase note:** Phase 33 (P5a) must pick a timestamp other than `20260826000000`. Both migrations are additive, so replay order is irrelevant, but the directory name must be unique.

- [ ] `backend/src/usage/dto/create-usage-event.dto.ts`:

```ts
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { UsageEventType } from '@prisma/client';

export class CreateUsageEventDto {
  @IsEnum(UsageEventType)
  event_type!: UsageEventType;

  /** Route path, query string already stripped. */
  @IsOptional() @IsString() @MaxLength(256)
  path?: string;

  /** Dotted action key, e.g. `task.create`. */
  @IsOptional() @IsString() @MaxLength(64)
  action?: string;

  @IsOptional() @IsObject()
  meta?: Record<string, unknown>;
}
```

- [ ] `backend/src/usage/usage.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UsageEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsageEventDto } from './dto/create-usage-event.dto';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget. A telemetry write must never fail a user's request, so every
   * error is swallowed after a debug log — the caller already returned 202.
   */
  async record(
    dto: CreateUsageEventDto,
    actor: { id: string; roleCode: string },
  ): Promise<void> {
    try {
      await this.prisma.usageEvent.create({
        data: {
          user_id: actor.id,
          role_code: actor.roleCode,
          event_type: dto.event_type,
          path: dto.event_type === UsageEventType.page_view ? (dto.path ?? null) : null,
          action: dto.event_type === UsageEventType.action ? (dto.action ?? null) : null,
          meta: (dto.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.debug(`usage event dropped: ${(err as Error).message}`);
    }
  }

  /** Admin roll-up (Phase 35 builds the screen; the data path lands here). */
  async summary(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [byRole, byPath, byAction] = await Promise.all([
      this.prisma.usageEvent.groupBy({
        by: ['role_code'], where: { created_at: { gte: since } }, _count: { _all: true },
      }),
      this.prisma.usageEvent.groupBy({
        by: ['path'],
        where: { created_at: { gte: since }, event_type: UsageEventType.page_view },
        _count: { _all: true }, orderBy: { _count: { path: 'desc' } }, take: 25,
      }),
      this.prisma.usageEvent.groupBy({
        by: ['action'],
        where: { created_at: { gte: since }, event_type: UsageEventType.action },
        _count: { _all: true }, orderBy: { _count: { action: 'desc' } }, take: 25,
      }),
    ]);
    return {
      days,
      by_role: byRole.map((r) => ({ role_code: r.role_code, count: r._count._all })),
      by_path: byPath.map((r) => ({ path: r.path, count: r._count._all })),
      by_action: byAction.map((r) => ({ action: r.action, count: r._count._all })),
    };
  }
}
```

- [ ] `backend/src/usage/usage.controller.ts` — `POST /usage` is authenticated (the global `JwtAuthGuard` covers it) but needs **no** permission; `GET /usage/summary` needs `MANAGE_SYSTEM`. `POST` returns 202 and does not await the write.

```ts
import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import express from 'express';
import { UsageService } from './usage.service';
import { CreateUsageEventDto } from './dto/create-usage-event.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Post()
  @HttpCode(202)
  record(@Body() dto: CreateUsageEventDto, @Req() req: express.Request) {
    // JwtStrategy puts { id, roleCode, type } on req.user for staff sessions.
    const user = (req as any).user;
    void this.usage.record(dto, { id: user.id, roleCode: user.roleCode });
    return { accepted: true };
  }

  @Get('summary')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  summary(@Query('days') days?: string) {
    const parsed = Number(days);
    return this.usage.summary(Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 365) : 30);
  }
}
```

- [ ] `backend/src/usage/usage.module.ts` — standard: imports `PrismaModule`, declares controller + service, exports `UsageService`.

- [ ] `backend/src/usage/usage.service.spec.ts` — four cases against a mocked `PrismaService` (follow `module-access.service.spec.ts` for the mocking style): (1) `page_view` writes `path` and nulls `action`; (2) `action` writes `action` and nulls `path`; (3) a rejecting `create` resolves without throwing; (4) `summary(7)` passes a `gte` 7 days back and caps `take` at 25.

- [ ] `backend/src/app.module.ts` — register **all four** new P4 modules now, so `app.module.ts` is edited exactly once in this phase:

```ts
import { UsageModule } from './usage/usage.module';
import { MeModule } from './me/me.module';
import { SearchModule } from './search/search.module';
import { RealtimeModule } from './realtime/realtime.module';
// …add UsageModule, MeModule, SearchModule, RealtimeModule to the `imports` array,
// after ActivityModule.
```

  Because Tasks 4, 5 and 6 run **after** this task inside the same agent, create the three sibling module files as part of their own tasks; this step is the last one in Task 3 and is committed together with Task 6 if the intermediate tree would not compile. Practical order for the agent: Task 3 schema + usage module → Task 4 → Task 5 → Task 6 → then the single `app.module.ts` edit, then one `npx jest` run.

**Verification:**
- `cd backend && npx prisma validate` → valid.
- `cd backend && npx prisma migrate deploy` against the local `konma` DB → applies `20260826000000_p4_role_aware_ia`.
- `cd backend && npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url postgresql://konma:konma@localhost:5433/konma_shadow --exit-code` → `No difference detected.`, exit 0.
- `grep -c "CREATE TABLE" prisma/migrations/20260826000000_p4_role_aware_ia/migration.sql` → `1`.
- `cd backend && npx jest --silent` → 61 suites green (60 + `usage.service.spec.ts`).
- `cd backend && npx tsc --noEmit -p tsconfig.build.json` → exit 0; `npm run lint:check` → 0 errors; `npm run build` → exit 0.
- Runtime: `POST /usage {"event_type":"page_view","path":"/tasks"}` → 202; `SELECT count(*) FROM "UsageEvent"` → 1; `GET /usage/summary?days=7` as `FOUNDER_ADMIN` → 200 with `by_role`/`by_path`/`by_action`; as `BACKEND_LEAD` → 403.

---

### Task 4: `GET /me/header` and `GET /search` — one round trip for the header

SPEC §6.1 puts nine things in the header. Nine parallel requests on every navigation is not acceptable, so one aggregate endpoint serves them. It reads Prisma directly (never through `ApprovalsService`) so Phase 31's rewrite of that service cannot collide with this file.

**Files:**
- Create: `backend/src/me/me.service.ts`, `me.service.spec.ts`, `me.controller.ts`, `me.module.ts`
- Create: `backend/src/search/search.service.ts`, `search.service.spec.ts`, `search.controller.ts`, `search.module.ts`

- [ ] `backend/src/me/me.service.ts` — the header context. "This week's quest" is the caller's active quest whose `[start_date, end_date]` spans today, else the node's; the mission is the newest `active` mission; readiness is the mean of all meter `current_value`s.

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HeaderContext {
  mission: { id: string; title: string; phase: string; status: string } | null;
  quest: { id: string; title: string; week_number: number; progress_percent: number; mine: boolean } | null;
  readiness_percent: number | null;
  approvals_waiting: number;
  my_blockers: number;
  xp_total: number;
  level: number;
  /** True when the caller may start a mission — drives the §6.1 empty-state CTA. */
  can_create_mission: boolean;
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async header(
    actor: { id: string; roleCode: string; permissions: string[] },
  ): Promise<HeaderContext> {
    const now = new Date();
    const [mission, myQuest, meters, approvals, blockers, user] = await Promise.all([
      this.prisma.mission.findFirst({
        where: { status: 'active' },
        orderBy: { created_at: 'desc' },
        select: { id: true, title: true, phase: true, status: true },
      }),
      this.prisma.quest.findFirst({
        where: {
          owner_user_id: actor.id,
          status: { in: ['active', 'planned'] },
          start_date: { lte: now },
          end_date: { gte: now },
        },
        orderBy: { week_number: 'desc' },
        select: { id: true, title: true, week_number: true, progress_percent: true },
      }),
      this.prisma.readinessMeter.findMany({ select: { current_value: true } }),
      // Read Prisma directly: Phase 31 rewrites ApprovalsService, this file must not depend on it.
      this.prisma.approval.count({
        where: { status: 'pending', required_role_code: actor.roleCode },
      }),
      this.prisma.task.count({
        where: { owner_user_id: actor.id, blocked: true, status: { notIn: ['done', 'cancelled'] } },
      }),
      this.prisma.user.findUnique({
        where: { id: actor.id },
        select: { xp_total: true, level: true },
      }),
    ]);

    let quest = myQuest ? { ...myQuest, mine: true } : null;
    if (!quest) {
      const nodeQuest = await this.prisma.quest.findFirst({
        where: { status: 'active', start_date: { lte: now }, end_date: { gte: now } },
        orderBy: { week_number: 'desc' },
        select: { id: true, title: true, week_number: true, progress_percent: true },
      });
      quest = nodeQuest ? { ...nodeQuest, mine: false } : null;
    }

    const readiness = meters.length
      ? Math.round(meters.reduce((s, m) => s + m.current_value, 0) / meters.length)
      : null;

    return {
      mission,
      quest,
      readiness_percent: readiness,
      approvals_waiting: approvals,
      my_blockers: blockers,
      xp_total: user?.xp_total ?? 0,
      level: user?.level ?? 1,
      can_create_mission: actor.permissions.includes('CREATE_MISSION'),
    };
  }
}
```

  > If `Approval.required_role_code` is not the column name in `schema.prisma` at implementation time, read the actual field on `model Approval` and adjust — do not invent one. The count is a *hint* for a badge, so an over-broad `where: { status: 'pending' }` is an acceptable fallback if no role column exists.

- [ ] `backend/src/me/me.controller.ts`:

```ts
import { Controller, Get, Req } from '@nestjs/common';
import express from 'express';
import { MeService } from './me.service';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { PrismaService } from '../prisma/prisma.service';

@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('header')
  async header(@Req() req: express.Request) {
    const user = (req as any).user;
    const permissions = await getPermissionsForRole(user.roleCode, this.prisma);
    return this.me.header({ id: user.id, roleCode: user.roleCode, permissions });
  }
}
```

- [ ] `backend/src/search/search.service.ts` — the ⌘K corpus: tasks, products, recipes, guides. Reuse the live services' query shapes rather than writing new SQL: products via `CatalogService.search`, guides via `GuidesService.searchPages` (already role-filtered), recipes via a `name contains` query, tasks via a `title contains` query scoped to the caller unless they hold `VIEW_ALL`.

```ts
export interface SearchHit { id: string; title: string; subtitle: string; href: string; }
export interface SearchResults {
  tasks: SearchHit[]; products: SearchHit[]; recipes: SearchHit[]; guides: SearchHit[];
}
```

  `search(q, actor, limit = 5)` returns at most `limit` hits per bucket, `{ tasks: [], products: [], recipes: [], guides: [] }` for a `q` shorter than 2 characters, and never throws when one bucket's underlying service errors (each bucket is wrapped in its own `.catch(() => [])`). `href` values: `/tasks/{id}`, `/operations/menu?product={id}`, `/operations/recipes/{id}`, `/guide/{sectionSlug}/{pageSlug}`.

- [ ] `backend/src/search/search.controller.ts` — `@Controller('search')`, `@Get()` `search(@Query('q') q, @Query('limit') limit, @Req() req)`. Authenticated, no extra permission (the buckets are individually scoped).

- [ ] Spec files: `me.service.spec.ts` — (1) returns the newest active mission; (2) prefers the caller's in-window quest and sets `mine: true`; (3) falls back to the node quest with `mine: false`; (4) `readiness_percent` is `null` when there are no meters; (5) `can_create_mission` reflects the permission list. `search.service.spec.ts` — (1) `q` of length 1 returns four empty buckets without touching Prisma; (2) a throwing bucket yields `[]` for that bucket and populated results for the others; (3) `limit` is respected per bucket.

**Verification:**
- `cd backend && npx jest --silent` → 63 suites green.
- `npx tsc --noEmit -p tsconfig.build.json` → exit 0; `npm run lint:check` → 0 errors.
- Runtime against the seeded DB: `GET /me/header` as `FOUNDER_ADMIN` → 200 with all nine keys, `mission` non-null, `readiness_percent` an integer 0–100, `can_create_mission: true`; as `TALENT_LEAD` → `can_create_mission: false`. `GET /me/header` with an empty `Mission` table → `mission: null`, `quest: null` (never an error — SPEC §6.1 "Never `null`" is a *rendering* rule, satisfied by the header's CTA).
- `GET /search?q=coco` → 200, `products` non-empty (the seeded coconut oil); `GET /search?q=c` → 200, four empty buckets.

---

### Task 5: `GET /tasks` server-filtered and paginated, and `GET /quests?mine=1`

`IA-04` needs `tasks?mine=1&status=&quest_id=` with `cursor`/`limit`. Today `tasks.controller.ts` returns an unbounded array. The change is additive and backwards-compatible: **when `cursor` and `limit` are both absent the response keeps its current bare-array shape**, so the six existing callers do not break.

**Files:**
- Modify: `backend/src/tasks/tasks.controller.ts`, `backend/src/tasks/tasks.service.ts`, `backend/src/tasks/tasks.service.spec.ts`, `backend/src/quests/quests.controller.ts`, `backend/src/quests/quests.service.ts`
- **No `backend/src/team/` module.** `/team` composes four endpoints that already exist (`/activity`, `/activity/contributions`, the wins query, `/leaderboard`); Task 13 composes them client-side. Recorded here so nobody adds a redundant module.

- [ ] Existing `GET /tasks` callers, all of which must keep working (grep `apiClient.get<Task` and `'/tasks`): `frontend/app/(ops)/quests/[id]/page.tsx`, `components/ops/dashboard/RoleDashboardSections.tsx`, `components/ops/dashboard/AdminBlockersWidget.tsx`, `app/(ops)/admin/blockers/page.tsx`, `components/ops/readiness/MeterDetailPanel.tsx`, `app/(ops)/missions/[id]/page.tsx`. Re-run that grep before editing and extend the list if it has grown.

- [ ] Add to `tasks.controller.ts` — new params only, existing ones untouched:

```ts
@Get()
async findAll(
  @Req() req: express.Request,
  @Query('quest_id') questId?: string,
  @Query('mission_id') missionId?: string,
  @Query('status') status?: string,
  @Query('task_type') taskType?: string,
  @Query('view_as') viewAs?: string,
  @Query('mine') mine?: string,
  @Query('cursor') cursor?: string,
  @Query('limit') limit?: string,
) {
  const user = (req as any).user;
  const parsedLimit = limit === undefined ? undefined : Math.min(Math.max(Number(limit) || 50, 1), 200);
  return this.tasksService.findAll(
    { id: user.id, roleCode: user.roleCode },
    { questId, missionId, status, taskType, viewAs, mine: mine === '1' || mine === 'true', cursor, limit: parsedLimit },
  );
}
```

- [ ] In `tasks.service.ts`, extend `findAll`'s options type with `mine?: boolean; cursor?: string; limit?: number`, then:
  1. When `mine` is true, add `owner_user_id: <caller id>` to the `where` — applied **after** the existing role-scoping so it can only narrow, never widen.
  2. `status` accepts a comma-separated list: `status.includes(',') ? { in: status.split(',') } : status`, each value validated with `isEnumValue(TaskStatus, …)` from `common/utils/parse-enum` (a bad value → `BadRequestException`).
  3. Paginate with a stable cursor. `orderBy: [{ created_at: 'desc' }, { id: 'desc' }]`, `take: limit + 1`, `cursor: { id: cursor }`, `skip: cursor ? 1 : 0`.
  4. Shape the return:

```ts
// Legacy shape preserved when the caller asks for neither cursor nor limit.
if (opts.cursor === undefined && opts.limit === undefined) return rows;
const hasMore = rows.length > limit;
const items = hasMore ? rows.slice(0, limit) : rows;
return { items, next_cursor: hasMore ? items[items.length - 1].id : null, has_more: hasMore };
```

- [ ] `quests.controller.ts` — add `@Query('mine') mine?: string` to `findAll` and pass `mine === '1' || mine === 'true'`; in `quests.service.ts`, `mine` adds `owner_user_id: <caller id>`. Keep the existing response shape (`/quests` has no pagination requirement in `IA-04`).

- [ ] `tasks.service.spec.ts` — add: (1) `mine: true` adds `owner_user_id` to the `where` passed to `prisma.task.findMany`; (2) `status: 'todo,doing'` becomes `{ in: ['todo','doing'] }`; (3) `status: 'bogus'` throws `BadRequestException`; (4) with `limit: 2` and three rows available, the result is `{ items: [2 rows], next_cursor: <id of row 2>, has_more: true }`; (5) with neither `cursor` nor `limit`, the result is a bare array.

**Verification:**
- `cd backend && npx jest --silent` → all suites green, `tasks.service.spec.ts` count up by 5.
- `npx tsc --noEmit -p tsconfig.build.json` → exit 0; `npm run lint:check` → 0 errors.
- Runtime: `GET /tasks` → array (legacy shape intact). `GET /tasks?mine=1&limit=2` → `{ items, next_cursor, has_more }` with `items.length <= 2` and every `owner_user_id` equal to the caller. `GET /tasks?mine=1&limit=2&cursor=<next_cursor>` → a disjoint page. `GET /tasks?status=todo,doing` → only those statuses. `GET /tasks?status=bogus` → 400. `GET /quests?mine=1` → only the caller's quests.

---

### Task 6: Realtime — generalised Pusher channel auth and the kitchen / approvals / notification triggers

Today `PusherService` exists but `POST /chat/auth` hard-codes `private-chat-{conversationId}` (`chat.controller.ts:37`), so no other private channel can be subscribed. `IA-07` needs five.

**Files:**
- Create: `backend/src/realtime/realtime.channels.ts`, `realtime.service.ts`, `realtime.service.spec.ts`, `realtime.controller.ts`, `realtime.module.ts`, `dto/realtime-auth.dto.ts`
- Modify: `backend/src/chat/chat.module.ts` (export `PusherService`), `backend/src/kitchen/kds/kds.service.ts`, `backend/src/kitchen/pick-and-pack/pick-and-pack.service.ts`, `backend/src/approvals/approvals.service.ts`, `backend/src/notifications/notifications.service.ts`

- [ ] `realtime.channels.ts` — the closed channel vocabulary and its authorisation table. A channel not in this map is refused.

```ts
import { Permission } from '../types/permissions';

/** Every private channel the ops app may subscribe to (SPEC §6.4 realtime). */
export const REALTIME_CHANNELS = {
  'private-kds': { permission: Permission.MANAGE_KITCHEN, moduleKey: 'kds' },
  'private-pick-pack': { permission: Permission.MANAGE_KITCHEN, moduleKey: 'pick_pack' },
  'private-shipments': { permission: Permission.MANAGE_POS, moduleKey: 'shipments' },
  'private-approvals': { permission: Permission.APPROVE_EVIDENCE, moduleKey: 'approvals' },
} as const;

export type StaticChannel = keyof typeof REALTIME_CHANNELS;

/** Per-user channel: `private-user-{userId}` — notifications, XP, level-ups. */
export const USER_CHANNEL_PREFIX = 'private-user-';

export const REALTIME_EVENTS = {
  KDS_ORDER_NEW: 'kds.order.new',
  KDS_ORDER_UPDATED: 'kds.order.updated',
  PICK_PACK_ORDER_NEW: 'pickpack.order.new',
  PICK_PACK_ORDER_UPDATED: 'pickpack.order.updated',
  APPROVALS_COUNT_CHANGED: 'approvals.count.changed',
  NOTIFICATION_CREATED: 'notification.created',
} as const;
```

- [ ] `realtime.service.ts` — `authorize(socketId, channelName, actor)` and a `trigger` passthrough:

```ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PusherService } from '../chat/pusher.service';
import { PrismaService } from '../prisma/prisma.service';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { REALTIME_CHANNELS, USER_CHANNEL_PREFIX, StaticChannel } from './realtime.channels';

@Injectable()
export class RealtimeService {
  constructor(
    private readonly pusher: PusherService,
    private readonly prisma: PrismaService,
  ) {}

  async authorize(socketId: string, channel: string, actor: { id: string; roleCode: string }) {
    if (channel.startsWith(USER_CHANNEL_PREFIX)) {
      // A user may only ever subscribe to their own channel.
      if (channel !== `${USER_CHANNEL_PREFIX}${actor.id}`) {
        throw new ForbiddenException('Not your channel');
      }
      return this.pusher.authorizeChannel(socketId, channel);
    }

    const rule = REALTIME_CHANNELS[channel as StaticChannel];
    if (!rule) throw new ForbiddenException('Unknown channel');

    const perms = await getPermissionsForRole(actor.roleCode, this.prisma);
    if (!perms.includes(rule.permission)) throw new ForbiddenException('Missing permission');

    // ModuleAccess is the visibility layer (SPEC §6.3) — a role without the module
    // never sees the screen, so it must not hold a socket for it either.
    const module = await this.prisma.moduleAccess.findUnique({
      where: { module_key: rule.moduleKey },
      select: { enabled: true, role_codes: true },
    });
    if (!module?.enabled || !module.role_codes.includes(actor.roleCode)) {
      throw new ForbiddenException('Module not visible to this role');
    }

    return this.pusher.authorizeChannel(socketId, channel);
  }

  /** Failure-isolated: a realtime push must never fail the business write. */
  async emit(channel: string, event: string, data: unknown): Promise<void> {
    try {
      await this.pusher.trigger(channel, event, data);
    } catch {
      /* PusherService already logs; a dropped push degrades to the 30 s poll. */
    }
  }
}
```

- [ ] `realtime.controller.ts` — `@Controller('realtime')`, `@Post('auth')` `@HttpCode(200)`, body `{ socket_id, channel_name }` (`RealtimeAuthDto`, both `@IsString() @IsNotEmpty()`). `POST /chat/auth` is left exactly as it is so chat keeps working unchanged.

- [ ] `chat.module.ts` — add `PusherService` to `exports` so `RealtimeModule` can inject it; `realtime.module.ts` imports `ChatModule` and `PrismaModule`, exports `RealtimeService`.

- [ ] Emit sites. Each call is `void this.realtime.emit(...)` placed **after** the transaction commits, in a `try/catch`-free position because `emit` already swallows:
  - `kds.service.ts` — after an order is routed to KDS: `emit('private-kds', REALTIME_EVENTS.KDS_ORDER_NEW, { order_id })`; after an item/order status change: `KDS_ORDER_UPDATED`.
  - `pick-and-pack.service.ts` — the same pair on `private-pick-pack`.
  - `approvals.service.ts` — after `approve` / `override` / any status write: `emit('private-approvals', REALTIME_EVENTS.APPROVALS_COUNT_CHANGED, { at: new Date().toISOString() })`. The payload carries no count: the client refetches, so the number can never be stale or leak across roles.
  - `notifications.service.ts` — after a `Notification` row is created: `emit(`${USER_CHANNEL_PREFIX}${notification.user_id}`, REALTIME_EVENTS.NOTIFICATION_CREATED, { id })`.

- [ ] `realtime.service.spec.ts` — (1) `private-user-{ownId}` authorises; (2) `private-user-{otherId}` throws `ForbiddenException`; (3) an unknown channel throws; (4) a permitted role with the module enabled authorises `private-kds`; (5) the same role with `ModuleAccess.enabled = false` is refused; (6) a role holding the permission but absent from `role_codes` is refused; (7) `emit` resolves when `PusherService.trigger` rejects.

**Verification:**
- `cd backend && npx jest --silent` → all suites green (`realtime.service.spec.ts` adds 7).
- `npx tsc --noEmit -p tsconfig.build.json` → exit 0; `npm run lint:check` → 0 errors; `npm run build` → exit 0.
- `grep -rn "authorizeChannel" src/` → exactly two call sites: `chat.controller.ts` (unchanged) and `realtime.service.ts`.
- Runtime with Pusher env unset: `POST /realtime/auth` for a permitted channel → 500 from `PusherService`'s "not configured" throw, which is correct and matches chat's behaviour; the client falls back to polling. With Pusher configured: `private-kds` as `BACKEND_LEAD` → 200 auth payload; as `TALENT_LEAD` → 403; `private-user-<someone-else>` → 403.

---

## The sweep contract (Tasks 7–10)

Tasks 7–10 are four **disjoint directory slices** of one mechanical migration. They share these rules verbatim; each task lists only its own slice and its own exceptions.

**Rule S1 — motion allowlist (SPEC §6.4).** Exactly three motion components survive, and only in these places:

| Component | Allowed only in | Everywhere else |
|---|---|---|
| `BorderBeam` | `components/ops/kitchen/kds/KdsOrderCard.tsx` and `components/ops/kitchen/pick-and-pack/PickAndPackOrderCard.tsx`, conditional on the order being **new** (`isNew` prop, true for < 60 s since `created_at`) | deleted |
| `NumberTicker` | XP and readiness values that change: `components/ops/gamification/*`, `components/ops/readiness/*`, `components/ops/header/XpChip.tsx`, `ReadinessPill.tsx` | replaced by the plain number |
| `Confetti` | `components/ops/gamification/LevelUpCelebration.tsx` (level-up) and the task-validation success path in `app/(ops)/tasks/[id]/page.tsx` | deleted |

  Every other Magic-UI component is removed from its call sites: `BlurFade` (28 files), `MagicCard` (20), `ShimmerButton` (22), `ShineBorder` (7), `AnimatedList` (7), `AnimatedCircularProgressBar` (6), `AvatarCircles` (5), `PulsatingButton` (3), `InteractiveHoverButton` (3), `TextAnimate` (1), `HyperText` (1), `CoolMode` (1). Replacements: `MagicCard` → `<Card>` (SPEC §6.4: `<Card>` is the only card); `ShimmerButton` / `PulsatingButton` / `InteractiveHoverButton` → `<Button>` (SPEC §6.4: `<Button>` is the only button — pick `variant="default"` for the primary action, `variant="outline"` otherwise); `BlurFade` → deleted wrapper, its children promoted; `AnimatedList` → a plain `<ul>`/`<div>` with the same children; `AnimatedCircularProgressBar` → `components/ops/readiness/ReadinessMeterRing.tsx` (which Task 9 rewrites as a static SVG ring); `AvatarCircles` → a plain stacked `<Avatar>` row; `ShineBorder` → deleted; `TextAnimate` / `HyperText` / `CoolMode` → the plain text or element.

  The **unused primitive files themselves** are deleted at the end of Wave 1 by Task 19, once every slice's grep is clean: `components/ui/blur-fade.tsx`, `magic-card.tsx`, `shimmer-button.tsx`, `shine-border.tsx`, `pulsating-button.tsx`, `interactive-hover-button.tsx`, `animated-list.tsx`, `avatar-circles.tsx`, `animated-circular-progress-bar.tsx`, `text-animate.tsx`, `hyper-text.tsx`, `cool-mode.tsx`.

**Rule S2 — `motion-reduce`.** Every surviving animated element carries `motion-reduce:animate-none` (or the component's own reduced-motion prop). `BorderBeam` and `NumberTicker` already honour `useReducedMotion` internally; assert it rather than assume it, and add the guard where it is missing.

**Rule S3 — colours.** No raw Tailwind palette class and no arbitrary colour literal. Substitutions, in order of preference:

| Found | Replace with |
|---|---|
| `bg-white`, `bg-black`, `bg-zinc-*`, `bg-neutral-*`, `bg-stone-*`, `bg-slate-*`, `bg-gray-*` | `bg-surface` / `bg-surface-raised` / `bg-surface-sunken` / `bg-bg` |
| `text-white`, `text-black`, `text-zinc-*`, `text-gray-*`, `text-stone-*` | `text-ink` / `text-ink-subtle` / `text-ink-muted` / `text-ink-faint` |
| `border-zinc-*`, `border-gray-*`, `border-stone-*` | `border-line` / `border-line-strong` |
| `*-green-*`, `*-emerald-*` | `STATUS_BADGE.good` / `text-[var(--status-good)]` |
| `*-amber-*`, `*-yellow-*`, `*-orange-*` | `STATUS_BADGE.warning` / `text-[var(--status-warning)]` — **unless** the colour is decorative brand, in which case `text-gold-text` / `bg-[var(--gold)]` |
| `*-red-*`, `*-rose-*` | `STATUS_BADGE.serious` (tint) or `STATUS_BADGE.critical` (solid fill) per Rule S4 |
| `*-blue-*`, `*-sky-*`, `*-indigo-*`, `*-cyan-*` | `STATUS_BADGE.info` / `text-[var(--status-info)]` |
| `*-purple-*`, `*-violet-*`, `*-fuchsia-*`, `*-pink-*`, `*-teal-*`, `*-lime-*` | these are decoration with no meaning — use `text-brand` / `bg-[var(--accent-soft)]` / `text-leaf` |
| `bg-[#…]`, `text-[rgb(…)]`, `fill="#…"`, `stroke="#…"`, `style={{ color: '#…' }}` | the matching token via `var(--…)`; for SVG/recharts props use the bare-token helpers `readinessBandToken()` or a literal `'var(--accent)'` |

  Wrap arbitrary values in `var()` — `bg-[var(--accent-soft)]`, never `bg-[--accent-soft]`. Prefer a named utility where one exists.

**Rule S4 — status meaning.** Anything meaning *failure / blocked / overdue / rejected* uses `STATUS_BADGE.critical` (solid fill) when it demands action now, `STATUS_BADGE.serious` (tint) otherwise. Do not invent new colour pairs; if a case does not fit the six `STATUS_BADGE` keys, use `neutral` and note it in the commit body.

**Rule S5 — list states (DESIGN-03).** Every list, table and grid the slice touches must have all three of loading (`<Skeleton>`), empty (an icon, a one-line explanation and, where the user can act, a `<Button>`) and error (`<Alert>` with a retry). Where a state is missing, add it. Do not restyle layouts beyond this — a sweep is not a redesign.

**Rule S6 — forms (DESIGN-03).** Any form the slice touches that is not already `react-hook-form + zod` is converted. `zod` is v4: use `z.object({...})` with `zodResolver` from `@hookform/resolvers/zod`, matching the pattern in `app/(auth)/team/page.tsx` and `components/ops/tasks/TaskForm.tsx`.

**Rule S7 — accessible focus.** Every interactive element the slice touches renders a visible focus ring. `components/ui/button.tsx` already emits `focus-visible:ring-3 focus-visible:ring-ring/50`; bare `<button>`/`<a>`/`<div role="button">` elements get `focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]`. Icon-only controls get an `aria-label`.

**Rule S8 — responsive.** Nothing the slice touches may scroll the page horizontally at 360 px. Wide tables get `overflow-x-auto` on their own wrapper; kanban columns get `min-w-[16rem]` inside a horizontally scrolling flex row.

**Per-slice verification (identical for Tasks 7–10):**
- `cd frontend && npx tsc --noEmit` → exit 0; `npx eslint .` → 0 errors; `npm run build` → compiles.
- Slice grep A (motion): `grep -rn "BlurFade\|MagicCard\|ShimmerButton\|ShineBorder\|PulsatingButton\|InteractiveHoverButton\|AnimatedList\|AvatarCircles\|AnimatedCircularProgressBar\|TextAnimate\|HyperText\|CoolMode" <slice paths>` → **no output**.
- Slice grep B (colour): `grep -rnE "(bg|text|border|from|via|to|ring|fill|stroke|shadow|outline|decoration|divide|caret|accent)-(\[#|\[rgb|\[hsl|\[oklch|red-|blue-|green-|amber-|orange-|purple-|pink-|emerald-|slate-|zinc-|neutral-|stone-|yellow-|indigo-|violet-|cyan-|teal-|rose-|sky-|lime-|fuchsia-|gray-)" <slice paths>` → **no output** (Task 10's slice may retain the two frozen files, which are excluded by path).
- Slice grep C (hex): `grep -rn "#[0-9a-fA-F]\{3,8\}\b" <slice paths>` → no output outside `aria-*`/`href` anchors.
- Manual, both themes: open two representative screens from the slice at 360 px and 1440 px; confirm no horizontal page scroll, visible focus rings on tab, and readable text in light and dark.

---

### Task 7: Sweep A — ops route files, mission / quest / task / board / dashboard components

The largest slice, and the one that owns the `MissionCard` merge.

**Slice (this task owns these paths and no others):**
- `frontend/app/(ops)/**/*.tsx` **except** `layout.tsx`, `error.tsx`, `loading.tsx` (Task 11 owns the layout; the other two are already token-clean)
- `frontend/components/ops/missions/**`, `components/ops/quests/**`, `components/ops/tasks/**`, `components/ops/boards/**`, `components/ops/dashboard/**`
- `frontend/components/ops/AdminUserFilter.tsx`, `CreateUserDialog.tsx`, `ErrorBoundary.tsx`, `PermissionMatrix.tsx`

**Files with known hits (from the audit at `0da0e09`):** `app/(ops)/admin/import/[type]/page.tsx` (23 colour hits — the largest single file), `admin/import/page.tsx` (7), `tasks/[id]/page.tsx` (8 colour + `AvatarCircles` + `Confetti`), `missions/[id]/page.tsx` (7 + `AnimatedCircularProgressBar`), `quests/[id]/page.tsx` (5 + `BlurFade` + `Confetti`), `activity/page.tsx` (3), `dashboard/page.tsx` (3 + `BlurFade`), `operations/inventory/page.tsx` (3), `operations/procurement/page.tsx` (3 + `MagicCard`), `admin/notices/page.tsx` (2), `admin/blockers/page.tsx` (1), `admin/users/page.tsx` (1), `team-contribution/page.tsx` (1 + `BlurFade`), `approvals/page.tsx` (1), `operations/purchase-orders/[id]/page.tsx` (1 + `MagicCard` + `ShineBorder` + `BorderBeam`), `operations/kitchen/kds/page.tsx` (1), `operations/kitchen/dashboard/page.tsx` (1), `boards/*` (4 pages, all `BlurFade`), `leaderboard/page.tsx`, `intelligence/analytics/page.tsx`, `pos/orders/page.tsx`, `pos/page.tsx`, `operations/menu/page.tsx`, `operations/kitchen/waste/page.tsx`, `operations/inventory/[ingredientId]/page.tsx`, `operations/purchase-orders/new/page.tsx`, `quests/[id]/tasks/new/page.tsx`; components `boards/MissionCard.tsx` (2), `boards/WinsTimeline.tsx` (1), `boards/EvidenceFeedCard.tsx` (2), `missions/MissionCard.tsx` (8), `quests/QuestCard.tsx` (3), `QuestProgress.tsx` (3), `ConfirmActivateDialog.tsx` (`Confetti`), `tasks/TaskListView.tsx` (4 + `BlurFade`), `TaskKanbanCard.tsx` (7 + `CoolMode`), `TaskKanban.tsx` (3), `TaskForm.tsx` (2), `dashboard/*` (12 files: `MissionContextStrip`, `RoleDashboardSections`, `AdminBlockersWidget`, `AdminPendingApprovalsWidget`, `DashboardKpiAlert`, `DashboardLowStockAlert`, `DashboardLeaderboardPreview`, `TeamContributionWidget`, `ActivityFeedWidget`, `AdminRecentDecisionsWidget`, `DashboardReadinessStrip`, `TodaysFocusSection`).

- [ ] Apply Rules S1–S8 across the slice.
- [ ] **Merge the `MissionCard` duplicate** (audited in Task 2). In `components/ops/missions/MissionCard.tsx` add `density?: 'full' | 'compact'` (default `'full'`); `'compact'` renders the boards layout (title, phase label, progress bar + percent, quest count, readiness-impact badges, end date) inside a `<Card>` instead of a `MagicCard`. Delete `components/ops/boards/MissionCard.tsx`. Update `app/(ops)/boards/missions/page.tsx` to `import { MissionCard } from '@/components/ops/missions/MissionCard'` and render `<MissionCard key={m.id} mission={m} density="compact" />`. The `PHASE_LABELS` map moves into the merged file; delete the duplicate.
- [ ] **Confetti**: keep it in `app/(ops)/tasks/[id]/page.tsx` only where a task transitions to *validated*; delete it from `app/(ops)/quests/[id]/page.tsx` and `components/ops/quests/ConfirmActivateDialog.tsx` (quest activation is not on the allowlist).
- [ ] **`CoolMode`**: delete from `TaskKanbanCard.tsx`; the drag interaction stays (`@dnd-kit`), only the particle effect goes.
- [ ] **`/admin/blockers`**: replace the page body with a `redirect('/tasks?status=blocked')` from `next/navigation`. The route stays so existing links do not 404. Its `AdminBlockersWidget` sibling in `components/ops/dashboard/` keeps working and is retargeted at `/tasks?status=blocked`.
- [ ] **`TaskForm.tsx:292`**: rewrite the stale comment to `{/* Dependency picker — Combobox from @base-ui/react via components/ui/combobox */}` (Task 2 deleted the file it referenced).
- [ ] **`app/(ops)/admin/import/[type]/page.tsx`** carries 23 hits, almost all validation-state colouring on the preview grid. Map them: valid row → `STATUS_BADGE.good`, warning row → `STATUS_BADGE.warning`, error row/cell → `STATUS_BADGE.critical`, skipped → `STATUS_BADGE.muted`. Do not restructure the grid.

**Verification:** the per-slice block above, with `<slice paths>` = `"app/(ops)" components/ops/missions components/ops/quests components/ops/tasks components/ops/boards components/ops/dashboard components/ops/*.tsx`, plus:
- `test ! -f components/ops/boards/MissionCard.tsx` → exit 0.
- `grep -rn "MissionCard" --include=*.tsx app components` → hits only `components/ops/missions/MissionCard.tsx` and its two importers.
- `grep -rn "Confetti" --include=*.tsx "app/(ops)" components/ops` → only `tasks/[id]/page.tsx` and `gamification/LevelUpCelebration.tsx`.
- Manual: `/dashboard`, `/tasks/<id>`, `/missions/<id>`, `/boards/missions`, `/admin/import/products` in both themes.

---

### Task 8: Sweep B — operations, kitchen, POS, inventory, analytics, KPIs, leaderboard components

**Slice:** `frontend/components/ops/operations/**`, `components/ops/kitchen/**`, `components/ops/pos/**`, `components/ops/inventory/**`, `components/ops/analytics/**`, `components/ops/kpis/**`, `components/ops/leaderboard/**`.

**Files with known hits:** `operations/brands/BrandStatusBadge.tsx` (5), `BrandCard.tsx` (`MagicCard` + `ShineBorder`), `BrandForm.tsx` (`ShimmerButton`); `operations/zones/ZoneStatusBadge.tsx` (4), `ZoneCard.tsx` (`MagicCard` + `ShineBorder`), `ZoneForm.tsx` (`ShimmerButton`); `operations/menu/FoodCostBadge.tsx` (3), `ProductCard.tsx` (`MagicCard`), `ProductForm.tsx` (`ShimmerButton`); `operations/recipes/builder/*` (5 files, 9 hits), `recipes/wizard/RecipeWizardStep1-3.tsx` (`ShimmerButton`), `recipes/RecipeCard.tsx` (`MagicCard`); `operations/ingredients/IngredientRow.tsx` (2), `IngredientForm.tsx` (1 + `ShimmerButton`); `operations/inventory/InventoryRow.tsx` (2), `StockMovementRow.tsx` (1); `operations/feedback/FeedbackStatsCard.tsx` (2), `FeedbackRow.tsx` (1); `operations/assets/AssetForm.tsx` (`ShimmerButton`), `AssetRow.tsx` (`ShineBorder`), `AssetUploadZone.tsx` (`BorderBeam`); `operations/channels/ChannelForm.tsx` (`ShimmerButton`); `operations/vendors/VendorForm.tsx`, `VendorPriceForm.tsx` (`ShimmerButton`); `kitchen/kds/*` (7 files: `KdsItemStatusBadge` 3, `KdsElapsedTimer` 2, `KdsMetricsBar` 2, `KdsZoneColumn` 1, `KdsOrderItem` 1, `KdsOrderCard` 1 + `BorderBeam`, `KdsBoard`); `kitchen/pick-and-pack/PickAndPackOrderCard.tsx` (1 + `BorderBeam`), `PickAndPackBoard.tsx`; `kitchen/prep-batches/PrepBatchWizardStep2.tsx` (1), `ExpiresInCountdown.tsx` (1); `kitchen/KitchenMetricsCards.tsx`; `pos/PosProductCard.tsx` (3 + `MagicCard`), `PosCartSidebar.tsx` (`BorderBeam` + `PulsatingButton` + `AnimatePresence`), `PosCartItemRow.tsx`, `DailyRevenueSummary.tsx`; `inventory/InventoryDashboardCharts.tsx` (2); `analytics/AnalyticsSummaryCards.tsx` (1), `RevenueTrendChart.tsx`, `ChannelBreakdownChart.tsx`; `kpis/KpiStatusBadge.tsx` (3), `KpiCard.tsx` (`MagicCard` + `PulsatingButton`), `KpiForm.tsx` (`ShimmerButton`); `leaderboard/LeaderboardTable.tsx` (`MagicCard`), `LeaderboardPodium.tsx` (`BlurFade` + `ShineBorder` + `HyperText`).

- [ ] Apply Rules S1–S8 across the slice.
- [ ] **`BorderBeam` survives in exactly two files.** In `kitchen/kds/KdsOrderCard.tsx` and `kitchen/pick-and-pack/PickAndPackOrderCard.tsx`, gate it behind a new `isNew` prop and render it only when true:

```tsx
{isNew && (
  <BorderBeam size={60} duration={5} colorFrom={BEAM_FROM} colorTo={BEAM_TO} className="motion-reduce:hidden" />
)}
```

  The parent boards compute `isNew` as `Date.now() - new Date(order.created_at).getTime() < 60_000`. Delete `BorderBeam` from `operations/assets/AssetUploadZone.tsx` and `pos/PosCartSidebar.tsx`.
- [ ] **`AnimatePresence` in `PosCartSidebar.tsx`** is not on the allowlist — delete it and render the list plainly.
- [ ] **Recharts colours.** `RevenueTrendChart`, `ChannelBreakdownChart` and `InventoryDashboardCharts` pass hex strings to `<Line stroke>`, `<Bar fill>`, `<Cell fill>`. Replace each with the chart tokens — `'var(--chart-1)'` … `'var(--chart-5)'` — which `tokens.css` already points at the brand ramp. Also remove the two `any` casts flagged in `RevenueTrendChart.tsx` and the one in `ChannelBreakdownChart.tsx` by typing the recharts payload props (QA-04).
- [ ] **The `*StatusBadge` helper components** (`BrandStatusBadge`, `ZoneStatusBadge`, `KpiStatusBadge`, `KdsItemStatusBadge`, `FoodCostBadge`, `ExportStatusBadge` — the last is Task 9's) all hand-roll their own colour maps. Rewrite each to return a `STATUS_BADGE` key from `lib/status-styles`; do not add new maps.

**Verification:** the per-slice block, `<slice paths>` = `components/ops/operations components/ops/kitchen components/ops/pos components/ops/inventory components/ops/analytics components/ops/kpis components/ops/leaderboard`, plus:
- `grep -rn "BorderBeam" --include=*.tsx components/ops` → exactly `kitchen/kds/KdsOrderCard.tsx` and `kitchen/pick-and-pack/PickAndPackOrderCard.tsx`.
- `grep -rnE "(stroke|fill)=\{?['\"]#" components/ops` → no output.
- Manual: `/operations/kitchen/kds`, `/pos`, `/kpis`, `/intelligence/analytics`, `/leaderboard` in both themes; confirm a newly arriving KDS order beams once and a 60-second-old one does not.

---

### Task 9: Sweep C — governance, evidence, guide, gamification, readiness, chat, notifications, exports

Owns the `GuideSectionCard` rename and the readiness ring rewrite.

**Slice:** `frontend/components/ops/approvals/**`, `decisions/**`, `evidence/**`, `delegations/**`, `readiness/**`, `gamification/**`, `guide/**`, `chat/**`, `notifications/**`, `exports/**`, `auth/**` (i.e. `frontend/components/auth/`).

**Files with known hits:** `approvals/ApprovalItem.tsx` (4 + `ShimmerButton` + `PulsatingButton` + `InteractiveHoverButton` + `AvatarCircles`), `ApprovalQueue.tsx` (1 + `BlurFade` + `AnimatedList` + `ShimmerButton`), `OverrideDialog.tsx` (`ShimmerButton` + `BorderBeam`); `decisions/DecisionCard.tsx` (`MagicCard` + `ShineBorder`), `DecisionList.tsx` (`BlurFade` + `AnimatedList` + `ShimmerButton`), `DecisionDetail.tsx` (`BlurFade`), `DecisionForm.tsx` (`ShimmerButton`); `evidence/EvidenceItem.tsx` (5 + `ShineBorder` + `InteractiveHoverButton`), `EvidenceUploadZone.tsx` (2 + `ShimmerButton` + `BorderBeam`), `ValidationStatus.tsx` (3 + `AnimatedCircularProgressBar`), `EvidenceList.tsx` / `EvidenceSection.tsx` (`AnimatedList`), `LinkEvidenceForm.tsx` / `NoteEvidenceForm.tsx` (`ShimmerButton`), `RejectionDialog.tsx`; `delegations/DelegationCard.tsx` (`AvatarCircles`), `DelegationForm.tsx` (`ShimmerButton`); `readiness/MeterDetailPanel.tsx` (1 + `BlurFade` + `AnimatedList`), `ReadinessGrid.tsx` (`BlurFade`), `ReadinessMeterRing.tsx` (`AnimatedCircularProgressBar` + `InteractiveHoverButton`); `gamification/LevelBadge.tsx` (`BorderBeam`), `LevelUpCelebration.tsx` (`TextAnimate` + `Confetti`), `XpProgressBar.tsx`; `guide/GuideSectionCard.tsx` (`MagicCard` + `BorderBeam`), `GuidePreviewBanner.tsx` (3), `GuideCalloutBlock.tsx` (3), `guide/admin/GuideSectionCard.tsx` (4), `GuideEditorToolbar.tsx` (1), `GuideEditorClient.tsx` (2), `GuideProseRenderer.tsx` (one `any`), `GuideSectionList.tsx`; `chat/PolicyNotice.tsx` (2), `NewChatDialog.tsx`, `NewGroupDialog.tsx`; `notifications/NotificationItem.tsx` (8), `NotificationBell.tsx`; `exports/ExportStatusBadge.tsx` (1); `auth/PasswordSetupForm.tsx` (2).

- [ ] Apply Rules S1–S8 across the slice.
- [ ] **Rename the `GuideSectionCard` duplicate** (audited in Task 2): `components/ops/guide/admin/GuideSectionCard.tsx` → `components/ops/guide/admin/GuideSectionAdminRow.tsx`, export renamed `GuideSectionAdminRow`, interface renamed `GuideSectionAdminRowProps`; update the import and the JSX in `components/ops/guide/admin/GuideSectionList.tsx`. The reader card at `components/ops/guide/GuideSectionCard.tsx` keeps its name and loses its `MagicCard` (→ `<Card>`) and its `BorderBeam` (not on the allowlist).
- [ ] **`BorderBeam` in `gamification/LevelBadge.tsx`** is not on the allowlist — delete it; the level-up moment is already carried by `LevelUpCelebration`'s confetti and the existing 3-second glow.
- [ ] **Rewrite `readiness/ReadinessMeterRing.tsx`** as a static SVG ring: two `<circle>` elements, `stroke-dasharray`/`stroke-dashoffset` driven by the value, `stroke={readinessBandToken(value)}`, a `transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none` on the indicator, and the numeral rendered with `<NumberTicker>` (allowlisted for readiness). Give the `<svg>` `role="img"` and an `aria-label` of `` `${label}: ${value} percent` ``. Delete `InteractiveHoverButton` from it; the ring becomes a plain `<Link>`/`<button>` carrying Rule S7's focus ring. This is the replacement `AnimatedCircularProgressBar`'s six call sites (across Tasks 7, 9) point at.
- [ ] **`notifications/NotificationItem.tsx`** has 8 hits, one per `NotificationType`. Map every type to a `STATUS_BADGE` key plus a lucide icon in a single exported `const NOTIFICATION_STYLE: Record<NotificationType, { badge: string; icon: LucideIcon }>` so the map lives in one place.
- [ ] **`GuideProseRenderer.tsx`** — remove the `any` (QA-04) by typing the tiptap JSON node as `{ type: string; content?: unknown[]; attrs?: Record<string, unknown> }`.

**Verification:** the per-slice block, `<slice paths>` = `components/ops/approvals components/ops/decisions components/ops/evidence components/ops/delegations components/ops/readiness components/ops/gamification components/ops/guide components/ops/chat components/ops/notifications components/ops/exports components/auth`, plus:
- `test ! -f components/ops/guide/admin/GuideSectionCard.tsx` → exit 0.
- `grep -rn "GuideSectionCard" --include=*.tsx app components` → hits only the reader card and `app/(ops)/guide/page.tsx`.
- `grep -rn "AnimatedCircularProgressBar" --include=*.tsx app components` → no output (Task 7 handled the other three call sites).
- Manual: `/approvals`, `/decisions`, `/readiness`, `/guide`, `/notifications` in both themes; tab through the readiness rings and confirm a visible focus ring and a screen-reader label.

---

### Task 10: Sweep D — public storefront, auth pages, and the `IMPORT_TYPES` gap

The smallest slice. The storefront is rewritten wholesale by Phase 34, so this task tokenises it rather than redesigning it.

**Slice:** `frontend/app/(public)/**`, `frontend/components/public/**` **except the frozen `ScrollVideoStory.tsx`**, `frontend/app/(auth)/**`, `frontend/hooks/**`, `frontend/lib/types/imports.ts`.

**Files with known hits:** `components/public/CustomerOrderCard.tsx` (12), `PaymentStatusPanel.tsx` (6), `CustomerAddressCard.tsx` (5), `CustomerOtpForm.tsx` (2), `StarRatingInput.tsx` (1), `ProductOrderCard.tsx` (1), `AddressSelector.tsx` (1), `CartBottomSheet.tsx` (1), `EventCheckoutForm.tsx` (1), `ProductPublicCard.tsx` (`MagicCard`), `EventCard.tsx` (`MagicCard`), `OrderTrackingTimeline.tsx` (`BlurFade`), `FeedbackThankYou.tsx` (`BlurFade` + `Confetti`); `app/(public)/profile/page.tsx` (3 + `BlurFade`), `login/page.tsx` (`BlurFade`), `menu/page.tsx` (`BlurFade`), `events/page.tsx`, `events/[id]/page.tsx`, `orders/[id]/track/page.tsx`, `feedback/[orderId]/page.tsx`; `app/(auth)/layout.tsx` (6), `app/(auth)/team/page.tsx` (3), `forgot-password/page.tsx` (3); `hooks/use-razorpay.ts` (2 `any`), `hooks/use-customer-auth.ts` (1 `any`).

- [ ] Apply Rules S1–S8 across the slice. The storefront's own `--public-*` tokens stay: `bg-[var(--public-bg)]`, `text-[var(--public-fg)]` etc. are already token-correct and must not be converted to the ops semantic names — the storefront is deliberately theme-independent (it does not follow the dark-mode toggle). Only raw palette classes and bare hex literals are replaced, each with the matching `--public-*` token.
- [ ] **`Confetti` in `components/public/FeedbackThankYou.tsx`** is not on the SPEC §6.4 allowlist (level-up and task validation only) — delete it. The thank-you page keeps its copy and its check icon.
- [ ] **Do not touch** `frontend/app/page.tsx` or `frontend/components/public/ScrollVideoStory.tsx`. Their 16 combined raw-colour hits are accepted and the lint rule ignores both paths (Task 19).
- [ ] **`app/(auth)/team/page.tsx`** is moved to `app/(auth)/sign-in/page.tsx` by **Task 12**, which owns the route resolution. This task sweeps the file **in place** at its current path; Task 12's move is a pure `git mv` afterwards. Coordinate by wave order — Task 10 is Wave 1, Task 12 is Wave 2.
- [ ] Remove the three `any`s in `hooks/use-razorpay.ts` and `hooks/use-customer-auth.ts` by typing against `frontend/types/razorpay.d.ts` (QA-04).
- [ ] **Close the `IMPORT_TYPES` gap** reported in `30-01-SUMMARY.md` follow-up #2: `frontend/lib/types/imports.ts` lists 12 types, the backend registry lists 13. Add `'purchase_orders'` to the frontend `IMPORT_TYPES` array in the same position as the backend (last), and add its label/description to whatever label map `app/(ops)/admin/import/page.tsx` uses — read the backend's `IMPORT_TYPE_CONFIG.purchase_orders` entry (`backend/src/imports/import-types.ts:293`) for the copy so the two agree.

**Verification:** the per-slice block, `<slice paths>` = `"app/(public)" "app/(auth)" components/public hooks`, with `components/public/ScrollVideoStory.tsx` excluded from greps B and C, plus:
- `node -e "const f=require('./lib/types/imports.ts')" ` is not runnable on a `.ts` file — instead: `diff <(grep -oE \"'[a-z_]+'\" lib/types/imports.ts | head -13) <(grep -oE \"'[a-z_]+'\" ../backend/src/imports/import-types.ts | head -13)` → no differences.
- `grep -rn "Confetti" --include=*.tsx components/public "app/(public)"` → no output.
- `git diff --name-only` must **not** contain `app/page.tsx` or `components/public/ScrollVideoStory.tsx`.
- Manual: `/menu`, `/events`, `/orders/<id>/track`, `/team` (login), `/profile` — confirm the storefront looks byte-identical to before except where a raw palette class was swapped for its `--public-*` equivalent.

---

### Task 11: The persistent mission header (SPEC §6.1) on every ops page, for every role

Nine slots, one round trip, never null.

**Files:**
- Create: `frontend/components/ops/header/AppHeader.tsx`, `MissionCrumb.tsx`, `ReadinessPill.tsx`, `AlertBadges.tsx`, `XpChip.tsx`, `CommandPalette.tsx`, `HeaderUserMenu.tsx`
- Create: `frontend/lib/hooks/use-header-context.ts`, `frontend/lib/types/header.ts`
- Modify: `frontend/app/(ops)/layout.tsx` (**this task owns it**)

- [ ] `frontend/lib/types/header.ts` — mirror `MeService.HeaderContext` exactly:

```ts
export interface HeaderMission { id: string; title: string; phase: string; status: string }
export interface HeaderQuest { id: string; title: string; week_number: number; progress_percent: number; mine: boolean }
export interface HeaderContext {
  mission: HeaderMission | null;
  quest: HeaderQuest | null;
  readiness_percent: number | null;
  approvals_waiting: number;
  my_blockers: number;
  xp_total: number;
  level: number;
  can_create_mission: boolean;
}
export interface SearchHit { id: string; title: string; subtitle: string; href: string }
export interface SearchResults { tasks: SearchHit[]; products: SearchHit[]; recipes: SearchHit[]; guides: SearchHit[] }
```

- [ ] `frontend/lib/hooks/use-header-context.ts`:

```ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { HeaderContext } from '@/lib/types/header';

/** One round trip for all nine header slots (SPEC §6.1). Refetched on window focus
 *  and every 60 s; the approvals badge is additionally invalidated by Pusher (Task 18). */
export function useHeaderContext() {
  return useQuery({
    queryKey: ['me', 'header'],
    queryFn: () => apiClient.get<HeaderContext>('/me/header'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
```

- [ ] `MissionCrumb.tsx` — mission › phase › this week's quest, and the **never-null** rule:

```tsx
'use client';
import Link from 'next/link';
import { ChevronRight, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HeaderContext } from '@/lib/types/header';

const PHASE_LABELS: Record<string, string> = {
  setup: 'Setup', foundation: 'Foundation', activation: 'Activation', scale: 'Scale',
};

export function MissionCrumb({ ctx }: { ctx: HeaderContext }) {
  if (!ctx.mission) {
    // SPEC §6.1: never null — a CTA for CREATE_MISSION holders, a note for everyone else.
    return ctx.can_create_mission ? (
      <Button size="sm" variant="outline" render={<Link href="/missions/new" />}>
        <Rocket className="size-3.5" />
        Start a mission
      </Button>
    ) : (
      <span className="text-sm text-ink-muted">No active mission — ask the founder</span>
    );
  }

  return (
    <nav aria-label="Mission context" className="flex min-w-0 items-center gap-1.5 text-sm">
      <Link href={`/missions/${ctx.mission.id}`} className="truncate font-medium text-ink hover:text-brand">
        {ctx.mission.title}
      </Link>
      <ChevronRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
      <span className="shrink-0 text-ink-muted">{PHASE_LABELS[ctx.mission.phase] ?? ctx.mission.phase}</span>
      {ctx.quest && (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
          <Link href={`/quests/${ctx.quest.id}`} className="truncate text-ink-subtle hover:text-brand">
            W{ctx.quest.week_number} · {ctx.quest.title}
            {!ctx.quest.mine && <span className="ml-1 text-ink-faint">(node)</span>}
          </Link>
        </>
      )}
    </nav>
  );
}
```

  > `<Button render={<Link/>} />` is base-ui's composition prop, the pattern already used in this codebase's `components/ui/button.tsx`. If the local `Button` does not accept `render`, wrap: `<Link href="…"><Button …/></Link>`.

- [ ] `ReadinessPill.tsx` — node readiness %, `NumberTicker` (allowlisted), band colour from `readinessBandToken`, links to `/readiness`. Renders `—` and no colour when `readiness_percent` is `null`.
- [ ] `AlertBadges.tsx` — two badges. "Approvals waiting on me" links to `/approvals`, uses `STATUS_BADGE.warning`, hidden at zero. "My blockers" links to `/tasks?status=blocked&mine=1`, uses `STATUS_BADGE.critical`, hidden at zero. Each carries `aria-label={`${n} approvals waiting on you`}`.
- [ ] `XpChip.tsx` — `NumberTicker` for `xp_total` + the existing `LevelBadge`; the dropdown reuses the existing `XpProgressBar`. Lift these from `Sidebar.tsx`'s bottom block (Task 12 removes them there).
- [ ] `CommandPalette.tsx` — ⌘K / Ctrl-K over `GET /search?q=`, built on the existing `components/ui/command.tsx` (`CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`):

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut,
} from '@/components/ui/command';
import { apiClient } from '@/lib/api-client';
import type { SearchResults } from '@/lib/types/header';

const GROUPS = [
  ['tasks', 'Tasks'], ['products', 'Products'], ['recipes', 'Recipes'], ['guides', 'Guide'],
] as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => apiClient.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`),
    enabled: open && q.trim().length >= 2,
    staleTime: 15_000,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search tasks, products, recipes and the guide"
        className="hidden items-center gap-2 rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 md:flex"
      >
        <Search className="size-3.5" />
        <span>Search</span>
        <CommandShortcut>⌘K</CommandShortcut>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput value={q} onValueChange={setQ} placeholder="Search tasks, products, recipes, guide…" />
        <CommandList>
          {q.trim().length < 2 ? (
            <CommandEmpty>Type at least two characters.</CommandEmpty>
          ) : isFetching && !data ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : !data || GROUPS.every(([k]) => data[k].length === 0) ? (
            <CommandEmpty>No matches.</CommandEmpty>
          ) : (
            GROUPS.map(([key, label]) =>
              data[key].length ? (
                <CommandGroup key={key} heading={label}>
                  {data[key].map((hit) => (
                    <CommandItem
                      key={hit.id}
                      value={`${label} ${hit.title}`}
                      onSelect={() => { setOpen(false); router.push(hit.href); }}
                    >
                      <span className="truncate">{hit.title}</span>
                      <span className="ml-auto truncate text-xs text-ink-muted">{hit.subtitle}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null,
            )
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
```

- [ ] `HeaderUserMenu.tsx` — avatar, name, role display name, XP progress, "Log out", "Log out everywhere". Lifted verbatim from `Sidebar.tsx`'s `DropdownMenu` block (Task 12 removes it there) with the colours already tokenised by Task 7's sweep of `components/ops/*.tsx`.
- [ ] `AppHeader.tsx` — composes the row. Sticky, 56 px tall, `bg-surface/95 backdrop-blur border-b border-line`, `z-30`. Order left→right: mobile menu button (`lg:hidden`, opens the nav sheet), `MissionCrumb` (flex-1, `min-w-0`, truncating), then a right cluster: `ReadinessPill`, `AlertBadges`, `XpChip`, `CommandPalette`, Guide link (`BookOpen` → `/guide`), Chat link (`MessageSquare` → `/chat`), `NotificationBell`, `AnimatedThemeToggler`, `HeaderUserMenu`. Below `md`, hide `ReadinessPill` and `XpChip` and collapse the Guide/Chat links into the user menu — the crumb and the two alert badges are the mobile-critical slots. While `useHeaderContext()` is loading, render a `<Skeleton>` of the same height so the header never reflows; on error render the crumb's "No active mission" note and zeroed badges rather than nothing.
- [ ] Rewrite `frontend/app/(ops)/layout.tsx`: keep the existing auth bootstrap (`/auth/me` → `useAuthStore`), the `ErrorBoundary`, the body-scroll lock and the mobile `Sheet`; replace the `lg:hidden` mobile-only header with `<AppHeader onOpenNav={() => setSidebarOpen(true)} />` rendered **outside** the `lg:` breakpoint so it is present on every ops page at every width, and move `<SpineNav>` (Task 12) into the desktop rail and the sheet. Structure:

```tsx
<ErrorBoundary>
  <div className="flex h-screen overflow-hidden bg-bg">
    <div className="hidden w-[248px] shrink-0 lg:flex"><SpineNav /></div>
    <Sheet open={navOpen} onOpenChange={setNavOpen}>
      <SheetContent side="left" className="w-[288px] p-0" showCloseButton={false}>
        <SpineNav onNavigate={() => setNavOpen(false)} />
      </SheetContent>
    </Sheet>
    <div className="flex min-w-0 flex-1 flex-col">
      <AppHeader onOpenNav={() => setNavOpen(true)} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6">{children}</div>
      </main>
    </div>
  </div>
</ErrorBoundary>
```

**Verification:**
- `cd frontend && npx tsc --noEmit` → exit 0; `npx eslint .` → 0 errors; `npm run build` → compiles.
- Manual, as **each of the eight seeded roles** (demo credentials are held by the user; `seed:demo` prints them once): every ops page shows the header; with an active mission the crumb shows mission › phase › quest; with `Mission` truncated it shows "Start a mission" for `FOUNDER_ADMIN`/`TECH_LEAD` and "No active mission — ask the founder" for the rest. Never blank.
- ⌘K on Windows/Linux (Ctrl-K) and macOS (⌘K) opens the palette; typing `coco` lists the seeded coconut oil under Products; Enter navigates; Escape closes; focus returns to the trigger.
- 360 px: header does not wrap to two lines and the page does not scroll horizontally.
- `grep -rn "useHeaderContext" app components | wc -l` → the hook is called exactly once (in `AppHeader`), so a navigation costs one request, not nine.

---

### Task 12: The navigation spine (SPEC §6.2) rendered from `GET /modules/mine`, and the `/team` route resolution

Replaces 663 lines of permission-derived nav with a data-driven registry.

**Files:**
- Create: `frontend/lib/nav/spine.ts`, `frontend/lib/hooks/use-module-access.ts`, `frontend/components/ops/nav/SpineNav.tsx`, `SpineGroup.tsx`, `SpineLink.tsx`
- Modify: `frontend/components/ops/Sidebar.tsx` (**owned here** — becomes a 3-line re-export shim, then is deleted by Task 19 once no importer remains), `frontend/proxy.ts` (**owned here**), `frontend/lib/types/index.ts` (**owned here** — add `export * from './header';` and `export * from './usage';`)
- Move: `frontend/app/(auth)/team/page.tsx` → `frontend/app/(auth)/sign-in/page.tsx` (`git mv`; the file's contents were already swept by Task 10)

- [ ] `frontend/lib/nav/spine.ts` — the registry. **A module key with no route is absent**, so `ModuleAccess` can grant it without producing a dead link (Decision 10). The primary list is the SPEC §6.2 order, positions 1–8.

```ts
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, ClipboardList, Target, Eye, CheckCircle, ClipboardCheck, Gauge, Users,
  ChefHat, Salad, Package, Monitor, PackageSearch, Trash2, ShoppingCart, TrendingUp, Truck,
  CalendarDays, Tag, FolderOpen, BarChart3, MessageSquare, Download, Upload, Shield, UserCheck,
  Megaphone, Settings, SlidersHorizontal, BookOpen, MapPin, Radio, Trophy, UtensilsCrossed, Boxes,
} from 'lucide-react';

export interface SpineItem {
  /** `ModuleAccess.module_key` that gates this item. */
  moduleKey: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface SpineGroupDef { id: string; label: string; items: SpineItem[] }

/** SPEC §6.2 positions 1–8. Order is fixed and must not be sorted at runtime. */
export const SPINE_PRIMARY: SpineItem[] = [
  { moduleKey: 'mission_control', label: 'Mission Control', href: '/dashboard', icon: LayoutDashboard },
  { moduleKey: 'my_tasks',        label: 'My Tasks',        href: '/tasks',      icon: ClipboardList },
  { moduleKey: 'my_quests',       label: 'My Quests',       href: '/quests?mine=1', icon: Target },
  { moduleKey: 'evidence',        label: 'Evidence',        href: '/boards/evidence', icon: Eye },
  { moduleKey: 'approvals',       label: 'Approvals',       href: '/approvals',  icon: CheckCircle },
  { moduleKey: 'decisions',       label: 'Decisions',       href: '/decisions',  icon: ClipboardCheck },
  { moduleKey: 'readiness',       label: 'Readiness',       href: '/readiness',  icon: Gauge },
  { moduleKey: 'team',            label: 'Team',            href: '/team',       icon: Users },
];

/** SPEC §6.2 collapsible groups, in the stated order. */
export const SPINE_GROUPS: SpineGroupDef[] = [
  { id: 'kitchen', label: 'Kitchen', items: [
    { moduleKey: 'kds',          label: 'Kitchen Overview', href: '/operations/kitchen/dashboard',     icon: LayoutDashboard },
    { moduleKey: 'kds',          label: 'KDS',              href: '/operations/kitchen/kds',           icon: Monitor },
    { moduleKey: 'pick_pack',    label: 'Pick & Pack',      href: '/operations/kitchen/pick-and-pack', icon: Package },
    { moduleKey: 'prep_batches', label: 'Prep Batches',     href: '/operations/kitchen/prep-batches',  icon: ChefHat },
    { moduleKey: 'recipes',      label: 'Recipes',          href: '/operations/recipes',               icon: UtensilsCrossed },
    { moduleKey: 'ingredients',  label: 'Ingredients',      href: '/operations/ingredients',           icon: Salad },
    { moduleKey: 'supply_usage', label: 'Supply Usage',     href: '/operations/kitchen/supply-usage',  icon: ClipboardList },
    { moduleKey: 'waste',        label: 'Waste Log',        href: '/operations/kitchen/waste',         icon: Trash2 },
  ]},
  { id: 'procurement', label: 'Procurement', items: [
    { moduleKey: 'inventory',       label: 'Inventory',          href: '/operations/inventory',           icon: PackageSearch },
    { moduleKey: 'inventory',       label: 'Inventory Overview', href: '/operations/inventory/dashboard', icon: Boxes },
    { moduleKey: 'procurement',     label: 'Procurement',        href: '/operations/procurement',         icon: TrendingUp },
    { moduleKey: 'purchase_orders', label: 'Purchase Orders',    href: '/operations/purchase-orders',     icon: ShoppingCart },
    { moduleKey: 'vendors',         label: 'Vendors',            href: '/operations/vendors',             icon: Truck },
  ]},
  { id: 'commerce', label: 'Commerce', items: [
    { moduleKey: 'pos',      label: 'Take Order',     href: '/pos',          icon: ShoppingCart },
    { moduleKey: 'orders',   label: 'Order History',  href: '/pos/orders',   icon: ClipboardList },
    { moduleKey: 'delivery', label: 'Delivery Queue', href: '/pos/delivery', icon: Truck },
    // shipments · customers · reviews → Phase 34 adds their routes and entries.
  ]},
  { id: 'catalog', label: 'Catalog & Experiences', items: [
    { moduleKey: 'catalog',     label: 'Catalog',     href: '/operations/menu',   icon: UtensilsCrossed },
    { moduleKey: 'experiences', label: 'Experiences', href: '/operations/events', icon: CalendarDays },
    { moduleKey: 'brands',      label: 'Brands',      href: '/operations/brands', icon: Tag },
    { moduleKey: 'assets',      label: 'Assets',      href: '/operations/assets', icon: FolderOpen },
    // promotions → Phase 34.
  ]},
  { id: 'intelligence', label: 'Intelligence', items: [
    { moduleKey: 'analytics', label: 'Analytics',   href: '/intelligence/analytics', icon: TrendingUp },
    { moduleKey: 'kpis',      label: 'KPIs',        href: '/kpis',                   icon: BarChart3 },
    { moduleKey: 'feedback',  label: 'Feedback',    href: '/operations/feedback',    icon: MessageSquare },
    { moduleKey: 'exports',   label: 'Exports',     href: '/admin/exports',          icon: Download },
    { moduleKey: 'team',      label: 'Leaderboard', href: '/leaderboard',            icon: Trophy },
  ]},
  { id: 'admin', label: 'Admin', items: [
    { moduleKey: 'imports',      label: 'Import',       href: '/admin/import',      icon: Upload },
    { moduleKey: 'users',        label: 'Users',        href: '/admin/users',       icon: Users },
    { moduleKey: 'permissions',  label: 'Permissions',  href: '/admin/permissions', icon: Shield },
    { moduleKey: 'delegations',  label: 'Delegations',  href: '/admin/delegations', icon: UserCheck },
    { moduleKey: 'notices',      label: 'Notices',      href: '/admin/notices',     icon: Megaphone },
    { moduleKey: 'settings',     label: 'Settings',     href: '/admin/settings',    icon: Settings },
    { moduleKey: 'settings',     label: 'Node',         href: '/admin/node',        icon: MapPin },
    { moduleKey: 'modules',      label: 'Modules',      href: '/admin/modules',     icon: SlidersHorizontal },
    { moduleKey: 'guide_editor', label: 'Guide Editor', href: '/admin/guide',       icon: BookOpen },
    { moduleKey: 'zones',        label: 'Zones',        href: '/operations/zones',  icon: MapPin },
    { moduleKey: 'channels',     label: 'Channels',     href: '/operations/channels', icon: Radio },
  ]},
];

/** SPEC §6.2: "Guide and Chat move to the header." Rendered by AppHeader, never in the spine. */
export const HEADER_MODULES = [
  { moduleKey: 'guide', label: 'Guide', href: '/guide', icon: BookOpen },
  { moduleKey: 'chat',  label: 'Chat',  href: '/chat',  icon: MessageSquare },
];

/** SPEC §6.2: "No label appears twice." Asserted in development so a regression is loud. */
export function assertUniqueLabels(): void {
  const all = [
    ...SPINE_PRIMARY, ...SPINE_GROUPS.flatMap((g) => g.items), ...HEADER_MODULES,
  ].map((i) => i.label);
  const dupes = all.filter((l, i) => all.indexOf(l) !== i);
  if (dupes.length) throw new Error(`Duplicate nav labels: ${[...new Set(dupes)].join(', ')}`);
}

/** Filters the fixed structure by the caller's visible module keys. Order is never re-sorted. */
export function buildSpine(visible: string[]) {
  const has = new Set(visible);
  return {
    primary: SPINE_PRIMARY.filter((i) => has.has(i.moduleKey)),
    groups: SPINE_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => has.has(i.moduleKey)) }))
      .filter((g) => g.items.length > 0),
    header: HEADER_MODULES.filter((i) => has.has(i.moduleKey)),
  };
}
```

- [ ] `frontend/lib/hooks/use-module-access.ts` — `useQuery(['modules','mine'], () => apiClient.get<string[]>('/modules/mine'), { staleTime: 300_000 })`. On error return `[]`, which renders an empty spine plus a one-line "Navigation unavailable — reload" note rather than falling back to the old permission logic (a silent fallback would hide a real outage).
- [ ] `SpineLink.tsx` — one `<Link>` with `aria-current="page"` when active, the active treatment `bg-[var(--accent-soft)] text-brand font-medium border-l-2 border-l-[var(--accent)]`, the idle treatment `text-ink-muted hover:bg-surface-raised hover:text-ink`, Rule S7's focus ring, and an optional badge slot.
- [ ] `SpineGroup.tsx` — the collapsible group, lifted from `Sidebar.tsx`'s `CollapsibleSection` (grid-rows transition, `aria-expanded`, chevron rotation, `motion-reduce:transition-none`). Collapse state persists to `localStorage['konma-spine-collapsed']`; the group containing the active route auto-expands. Default-collapsed: every group except the one matching the current path.
- [ ] `SpineNav.tsx` — logo + product name at the top, then `primary` as flat links, then `groups`. Keeps the "Ad-hoc task" button at the bottom (gated on `CREATE_ADHOC_TASK`, opening `AdHocTaskSheet`) restyled to `<Button variant="outline" size="sm" className="w-full">`. The XP block, user dropdown, theme toggler and notification bell are **removed** — they moved to `AppHeader` in Task 11. Badges: `approvals` shows `useHeaderContext().data?.approvals_waiting` with `STATUS_BADGE.warning`; `decisions` keeps today's proposed-count query with `STATUS_BADGE.info`. Calls `assertUniqueLabels()` once inside `if (process.env.NODE_ENV !== 'production')`.
- [ ] `components/ops/Sidebar.tsx` — replace the whole file with `export { SpineNav as Sidebar } from '@/components/ops/nav/SpineNav';` so any straggling import keeps compiling; Task 19 deletes it after proving no importer remains.
- [ ] **`/team` route resolution** (Decision 3). `git mv "app/(auth)/team" "app/(auth)/sign-in"`. Then in `frontend/proxy.ts`:

```ts
const STAFF_AUTH_PAGES = ['/team', '/sign-in', '/forgot-password', '/set-password', '/reset-password'];

// …inside the STAFF_AUTH_PAGES branch, replace `return NextResponse.next()` with:
//   an authenticated staff member at /team falls through to the ops Team hub;
//   everyone else is *rewritten* (URL preserved) to the login form.
if (pathname === '/team' || pathname.startsWith('/team?')) {
  if (isValidStaff) return NextResponse.next();          // → app/(ops)/team/page.tsx
  return NextResponse.rewrite(new URL('/sign-in', request.url));
}
return NextResponse.next();
```

  where `isValidStaff` is the result of the existing `jwtVerify` + `payload.type === 'staff'` check that already lives in that branch. Keep the existing `payload.type === 'staff'` → `/dashboard` redirect for `/sign-in`, `/forgot-password`, `/set-password`, `/reset-password` — only `/team` changes behaviour. **Do not touch** `app/page.tsx`'s three `/team` links, `lib/auth.ts:25,35`, `lib/api-client.ts:86` or `app/(ops)/layout.tsx:64`: all four still point at `/team` and all four still land on the login form for a logged-out user.
- [ ] `frontend/lib/types/index.ts` — add `export * from './header';` and `export * from './usage';` (the latter created by Task 18).

**Verification:**
- `cd frontend && npx tsc --noEmit` → exit 0; `npx eslint .` → 0 errors; `npm run build` → compiles.
- `node -e "require('ts-node').register({transpileOnly:true,compilerOptions:{module:'commonjs'}});require('./lib/nav/spine.ts').assertUniqueLabels()"` → exit 0 (no duplicate labels). If `ts-node` is not installed in `frontend`, assert instead by loading `/dashboard` in dev, where the guarded call throws visibly.
- Spine order check: on `/dashboard` as `FOUNDER_ADMIN`, the first eight links read Mission Control, My Tasks, My Quests, Evidence, Approvals, Decisions, Readiness, Team — in that order.
- Role scoping: as `TALENT_LEAD` (seeded `ModuleAccess` grants only the ten universal keys + `talent`, which has no route) the spine shows the eight primary items and **no** groups. As `PROCUREMENT_LEAD` the Kitchen and Procurement groups appear and Commerce/Admin do not.
- `/team` logged out → the login form at URL `/team`; log in → `/dashboard`; navigate to `/team` → the Team hub (Task 13). `/sign-in` logged out → the same form; logged in → redirect to `/dashboard`.
- 360 px: the nav sheet opens from the header's menu button and closes on navigation.

---

### Task 13: `/tasks` (server-filtered, paginated, kanban + list), `/quests?mine=1`, `/team`

The three routes SPEC §6.2 names that do not exist today.

**Files:**
- Create: `frontend/app/(ops)/tasks/page.tsx`, `frontend/app/(ops)/quests/page.tsx`, `frontend/app/(ops)/team/page.tsx`
- Create: `frontend/components/ops/tasks/TaskFilterBar.tsx`, `frontend/components/ops/team/TeamTabs.tsx`
- Create: `frontend/lib/types/tasks-page.ts` — the paginated envelope type
- Modify: `frontend/components/ops/tasks/TaskKanban.tsx`, `TaskListView.tsx`, `TaskViewToggle.tsx` (they exist and are used by `/quests/[id]`; extend, do not fork)

- [ ] `frontend/lib/types/tasks-page.ts`:

```ts
import type { Task } from '@/lib/types/tasks';

/** Shape of `GET /tasks` when `cursor` or `limit` is supplied (Task 5). */
export interface TaskPage { items: Task[]; next_cursor: string | null; has_more: boolean }

export const TASK_PAGE_SIZE = 50;
```

- [ ] `TaskFilterBar.tsx` — the filter row, driven entirely by URL search params so a filtered view is linkable and the back button works:
  - **Mine** toggle (`mine=1`), default **on** for every role except `FOUNDER_ADMIN`/`TECH_LEAD`, whose default is off.
  - **Status** multi-select over `TaskStatus` (`todo`, `doing`, `blocked`, `done`, `cancelled`), serialised comma-separated into `status=`.
  - **Quest** combobox over `GET /quests?mine=1` → `quest_id=`.
  - **Priority** and **Type** selects → client-side narrowing only (the API does not filter on them; say so in a comment rather than silently pretending).
  - A "Clear" `<Button variant="ghost">` when any filter is active, and a live result count.
  Read/write with `useSearchParams()` + `router.replace(pathname + '?' + params, { scroll: false })`.

- [ ] `frontend/app/(ops)/tasks/page.tsx` — the list. Wrap the body in `<Suspense>` because `useSearchParams()` requires it (this is why `app/(auth)/team/page.tsx` already splits `LoginContent`).

```tsx
'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { TaskFilterBar } from '@/components/ops/tasks/TaskFilterBar';
import { TaskViewToggle } from '@/components/ops/tasks/TaskViewToggle';
import { TaskListView } from '@/components/ops/tasks/TaskListView';
import { TaskKanban } from '@/components/ops/tasks/TaskKanban';
import { TaskSheet } from '@/components/ops/tasks/TaskSheet';        // Task 16
import { TASK_PAGE_SIZE, type TaskPage } from '@/lib/types/tasks-page';

function TasksContent() {
  const params = useSearchParams();
  const [view, setView] = useState<'kanban' | 'list'>('list');
  const [createOpen, setCreateOpen] = useState(false);
  const query = params.toString();

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['tasks', 'page', query],
      initialPageParam: undefined as string | undefined,
      queryFn: ({ pageParam }) => {
        const p = new URLSearchParams(query);
        p.set('limit', String(TASK_PAGE_SIZE));
        if (pageParam) p.set('cursor', pageParam);
        return apiClient.get<TaskPage>(`/tasks?${p.toString()}`);
      },
      getNextPageParam: (last) => last.next_cursor ?? undefined,
    });

  const tasks = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">My Tasks</h1>
        <div className="flex items-center gap-2">
          <TaskViewToggle view={view} onViewChange={setView} />
          <Button onClick={() => setCreateOpen(true)}>New task</Button>
        </div>
      </div>

      <TaskFilterBar resultCount={tasks.length} />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : isError ? (
        <Alert variant="destructive">
          <span>Could not load tasks.</span>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button>
        </Alert>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-10 text-center">
          <p className="text-sm text-ink-muted">Nothing matches these filters.</p>
          <Button className="mt-3" onClick={() => setCreateOpen(true)}>Create a task</Button>
        </div>
      ) : view === 'kanban' ? (
        <TaskKanban tasks={tasks} />
      ) : (
        <TaskListView tasks={tasks} />
      )}

      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <TaskSheet open={createOpen} onOpenChange={setCreateOpen} mode="create" />
    </div>
  );
}

export default function TasksPage() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><TasksContent /></Suspense>;
}
```

  > `TaskSheet` lands in Task 16 (Wave 3). Until then this task renders the existing `AdHocTaskSheet` in its place and leaves a one-line comment naming Task 16 — a wave boundary, not a TODO.

- [ ] `TaskKanban.tsx` / `TaskListView.tsx` — today they are called from `/quests/[id]` with a quest-scoped array. Extend, do not fork: accept an optional `groupByStatus?: boolean` (kanban already groups) and make the quest link visible when `task.quest` is present, since `/tasks` is cross-quest. Rule S8: the kanban row is `flex gap-4 overflow-x-auto` with `min-w-[16rem]` columns.

- [ ] `frontend/app/(ops)/quests/page.tsx` — the quest list. Reads `mine` from the URL (`/quests?mine=1` is the spine's href), fetches `GET /quests?mine=1`, renders the existing `QuestCard` in a `grid gap-4 sm:grid-cols-2 xl:grid-cols-3`, and offers a "Mine / All" toggle. Loading = six `<Skeleton>` cards; empty = "No quests assigned to you this week." plus a "Browse all quests" button that flips the toggle; error = `<Alert>` + retry. A "New quest" `<Button>` opens `QuestSheet` (Task 16) for holders of `CREATE_QUEST`.

- [ ] `frontend/app/(ops)/team/page.tsx` + `TeamTabs.tsx` — SPEC §6.2 item 8: "Team — merges wins, contribution, activity, leaderboard". Four tabs on `components/ui/tabs.tsx`, tab state in `?tab=`:

| Tab | Data | Reuse |
|---|---|---|
| Wins | the existing `/boards/wins` query | `components/ops/boards/WinsTimeline.tsx` |
| Contribution | `GET /activity/contributions?scope=` | `app/(ops)/team-contribution/page.tsx`'s table, extracted into `components/ops/team/ContributionTable.tsx` |
| Activity | `GET /activity?limit=100&hours=168` | `components/ops/dashboard/ActivityFeedWidget.tsx`'s row renderer |
| Leaderboard | `GET /leaderboard` | `components/ops/leaderboard/LeaderboardTable.tsx` + `LeaderboardPodium.tsx`, hidden when `SystemSetting['leaderboard_enabled']` is false |

  The four legacy routes (`/boards/wins`, `/team-contribution`, `/activity`, `/leaderboard`) stay reachable — do not delete them — but they leave the spine (Task 12 already omits them), which is what makes "no label appears twice" hold. Each tab carries its own loading/empty/error trio.

**Verification:**
- `cd frontend && npx tsc --noEmit` → exit 0; `npx eslint .` → 0 errors; `npm run build` → the route table lists `/tasks`, `/quests`, `/team`.
- Pagination: with > 50 tasks seeded, `/tasks?mine=1` shows 50 and a working "Load more"; the second page contains no id from the first (check in the network tab or by counting unique ids).
- Filters: `/tasks?status=todo,doing` shows only those statuses; toggling Mine changes the URL and the result set; the browser back button restores the previous filter set.
- Kanban ↔ list toggle preserves the filter set.
- `/team?tab=leaderboard` opens on the leaderboard; with `leaderboard_enabled` set to `false` by `FOUNDER_ADMIN` at `/admin/settings`, the tab disappears and `?tab=leaderboard` falls back to Wins.
- 360 px: the kanban scrolls horizontally inside its own container; the page does not.

---

### Task 14: Mission Control (admin) and My Day (everyone else) — SPEC §6.5

`/dashboard` forks on `VIEW_ALL`, not on a hard-coded role.

**Files:**
- Create: `frontend/lib/api/optional.ts`, `frontend/lib/api/phase31.ts`
- Create: `frontend/components/ops/dashboard/MissionControl.tsx`, `MyDay.tsx`, `ActionRequiredPanel.tsx`, `StatusPanel.tsx`, `IntelligencePanel.tsx`, `ReadinessSparkline.tsx`, `NudgesPanel.tsx`
- Modify: `frontend/app/(ops)/dashboard/page.tsx`
- Delete: `frontend/components/ops/dashboard/AdminAdHocInjectorWidget.tsx`

- [ ] `frontend/lib/api/optional.ts` — the `optionalGet` helper printed in the "Contracts assumed from Phase 31" section above.
- [ ] `frontend/lib/api/phase31.ts` — the three path constants, so a rename in Phase 31 costs one file:

```ts
/** Endpoints Phase 31 (P3 mission bridge) owns. Every caller goes through `optionalGet`. */
export const P31 = {
  readinessHistory: (code: string, days = 30) => `/readiness-meters/${encodeURIComponent(code)}/history?days=${days}`,
  myPendingApprovals: '/approvals?mine=1&status=pending',
  decideApproval: (id: string) => `/approvals/${id}/decide`,
} as const;
```

- [ ] `frontend/app/(ops)/dashboard/page.tsx` — the fork:

```tsx
'use client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { MissionControl } from '@/components/ops/dashboard/MissionControl';
import { MyDay } from '@/components/ops/dashboard/MyDay';

export default function DashboardPage() {
  const permissions = useAuthStore((s) => s.permissions);
  // SPEC §6.5 says "admin"; VIEW_ALL is the permission that means it, and it is
  // already held by FOUNDER_ADMIN and TECH_LEAD — role codes are not hard-coded.
  return permissions.includes('VIEW_ALL') ? <MissionControl /> : <MyDay />;
}
```

- [ ] `MissionControl.tsx` — three stacked sections, each an `<h2>` + a `<Card>` grid.
  - **Action Required** (`ActionRequiredPanel`) — approvals (C2, falling back to `GET /evidence?status=pending`), blockers (`GET /tasks?status=blocked`), stale decisions (`GET /decisions?status=proposed`, "stale" = `created_at` older than 7 days), low stock (`GET /inventory/low-stock`), failed shipments (**Phase 34** — the row is omitted, with a code comment naming the phase, not a placeholder). Each row: count, one-line label, a `<Button variant="outline" size="sm">` deep link. Zero rows → a single "Nothing needs you right now." line, not five empty cards.
  - **Status** (`StatusPanel`) — the active mission and its quest progress (reuse `MissionContextStrip`), the readiness grid with a 30-day sparkline per meter, revenue today (`GET /analytics/summary` — use whatever the existing analytics page calls; do not invent an endpoint), orders in flight (`GET /orders?status=…` as the POS pages already do).
  - **Intelligence** (`IntelligencePanel`) — reuse `DashboardKpiAlert`, add top products from the existing analytics response, and feedback themes from `GET /feedback` grouped by rating band. Where an existing widget already fetches the data, render the widget; do not duplicate the query.
- [ ] `ReadinessSparkline.tsx` — C1's consumer. `optionalGet<{ points: { date: string; value: number }[] }>(P31.readinessHistory(code, 30))`; when it resolves `null`, render nothing at all (the meter's current value is already shown by its ring). When it resolves, draw a 30-point `<svg>` polyline, `stroke={readinessBandToken(latest)}`, `preserveAspectRatio="none"`, `aria-hidden` (the numeric value beside it carries the meaning). No chart library — recharts for a 30-point sparkline is 40 KB for nothing.
- [ ] `MyDay.tsx` — SPEC §6.5's five blocks, in order:
  1. **Today's Focus**, full width — overdue › due today › quest-linked, exactly the ordering `TodaysFocusSection.tsx` already implements. Re-point it at `GET /tasks?mine=1&limit=50` instead of the unbounded fetch it does today.
  2. **My quest progress** — the caller's in-window quest from `useHeaderContext()` (already fetched; do not re-request) plus its task roll-up.
  3. **My evidence awaiting review** — `GET /evidence?status=pending` filtered to `uploaded_by === user.id`.
  4. **My meter contributions** — `GET /readiness-meters` filtered to the meters the caller's role maps to (`RoleDashboardSections.getRelevantMeterNames` already holds that mapping — move it into `lib/nav/meters.ts` rather than duplicating). Show the `mode` chip (`task_driven` / `derived` / `hybrid`) when the field is present (C4).
  5. **Nudges** (`NudgesPanel`) — derived client-side from data already on the page, no new endpoint: a task overdue by more than 3 days, evidence pending review for more than 2 days, a quest below 50 % with fewer than 2 days left, an approval waiting on the caller. Each nudge is one sentence and one deep link. No nudges → the block is not rendered.
- [ ] Delete `AdminAdHocInjectorWidget.tsx` (Decision 15 — it 400s). Its slot in Mission Control becomes a `<Button>` that opens `AdHocTaskSheet`, which already sends a valid body. Remove its import from `app/(ops)/dashboard/page.tsx`.

**Verification:**
- `cd frontend && npx tsc --noEmit` → exit 0; `npx eslint .` → 0 errors; `npm run build` → compiles.
- `test ! -f components/ops/dashboard/AdminAdHocInjectorWidget.tsx` → exit 0; `grep -rn "AdminAdHocInjectorWidget" app components` → no output.
- **Degradation proof (the point of the Phase 31 contract):** with the backend running *without* Phase 31, load `/dashboard` as `FOUNDER_ADMIN`. `GET /readiness-meters/:code/history` 404s → the page renders with meter values and **no** sparklines, no error toast, no console error. `GET /approvals?mine=1&status=pending` 404s → the Action Required approvals row shows the `/evidence?status=pending` count instead. Capture both network traces in the phase summary.
- As each non-admin role: `/dashboard` shows My Day with Today's Focus at full width; a role with zero tasks sees the empty state, not a spinner.
- 360 px and 1440 px, both themes.

---

### Task 15: `/admin/modules` (the `ModuleAccess` editor) and `/admin/node`

`IA-03`'s editor, plus the `PATCH /nodes/current` screen P2 shipped an API for and no UI.

**Files:**
- Create: `frontend/app/(ops)/admin/modules/page.tsx`, `frontend/app/(ops)/admin/node/page.tsx`
- Create: `frontend/components/ops/admin/ModuleAccessEditor.tsx`, `ModuleAccessRow.tsx`, `NodeSettingsForm.tsx`

- [ ] `ModuleAccessEditor.tsx` — one table over `GET /modules` (all 47 rows, already ordered by `sort_order` then key). Columns: **Module** (`moduleKeyLabel(module_key)` from `lib/types/modules.ts`, with the raw key in `font-mono text-xs text-ink-muted` beneath), **Roles** (eight checkboxes, one per `RoleCode`, labelled with `ROLE_DISPLAY_NAMES`), **Enabled** (`<Switch>`), **Order** (a numeric `<Input>`, `min=0`), **Route** (the `href` from `lib/nav/spine.ts` if the key has one, else `—` with a tooltip reading "No screen in this release"). Group the rows visually by the `sort_order` bands the seed uses (10–100 primary, 200 Kitchen, 300 Procurement, 400 Commerce, 500 Catalog, 600 Intelligence, 700 Admin, 800 Talent) with a sticky band heading.
- [ ] Mutations: one `PATCH /modules/:key` per changed row, optimistic, with `queryClient.invalidateQueries({ queryKey: ['modules'] })` **and** `['modules','mine']` on settle so the caller's own spine updates live. Toast on success; on failure roll back the optimistic write and toast the server message. Guard the destructive case: unchecking the **last** role on a row, or disabling a row that is in `SPINE_PRIMARY`, opens a confirm `<Dialog>` reading "No role will be able to see *Approvals*. Continue?".
- [ ] Permission gate: the page renders the editor only when `permissions.includes('MANAGE_SYSTEM')`; otherwise a `<Alert>` reading "You need MANAGE_SYSTEM to edit module access." The backend already enforces it on `PATCH`; this is the UI half.
- [ ] A "Reset to seeded defaults" button is **not** built — there is no backend route for it and inventing one is out of scope. Note it in the phase summary as a P6 candidate.
- [ ] `NodeSettingsForm.tsx` at `/admin/node` — `react-hook-form` + `zod` over `GET /nodes/current` → `PATCH /nodes/current`. Editable: `name` (1–120 chars), `timezone` (a `<Combobox>` over `Intl.supportedValuesOf('timeZone')`, defaulting to the current value), `currency` (exactly 3 uppercase letters — the backend DTO requires it). Read-only, rendered as a definition list: `code`, `status`, `created_at`. Same `MANAGE_SYSTEM` gate.

**Verification:**
- `cd frontend && npx tsc --noEmit` → exit 0; `npx eslint .` → 0 errors; `npm run build` → the route table lists `/admin/modules` and `/admin/node`.
- As `FOUNDER_ADMIN`: `/admin/modules` lists **47** rows. Uncheck `PROCUREMENT_LEAD` from `vendors` → toast, then log in as `PROCUREMENT_LEAD` and confirm Vendors is gone from the spine while Inventory remains. Re-check it and confirm it returns.
- Toggling `enabled` off on `kds` removes both Kitchen Overview and KDS from the spine for every role and, per Task 6's `RealtimeService`, also makes `POST /realtime/auth` for `private-kds` return 403 — check that too, since it is the one place the visibility layer has teeth beyond the UI.
- As `BI_LEAD`: `/admin/modules` renders the permission alert and no table; a hand-crafted `PATCH /modules/vendors` from the browser console returns 403.
- `/admin/node`: change `name`, reload, value persists; submit `currency: "RUPEE"` → the zod error shows before any request is sent.

---

### Task 16: Sheets, inline approve/reject, evidence from the task row (SPEC §6.4)

Task and Quest create/edit stop being pages.

**Files:**
- Create: `frontend/components/ops/tasks/TaskSheet.tsx`, `frontend/components/ops/tasks/TaskRowEvidenceButton.tsx`, `frontend/components/ops/quests/QuestSheet.tsx`, `frontend/components/ops/approvals/InlineDecision.tsx`
- Modify: `frontend/components/ops/tasks/TaskForm.tsx`, `TaskListView.tsx`, `TaskKanbanCard.tsx`, `frontend/components/ops/quests/QuestForm.tsx`, `QuestCard.tsx`, `frontend/components/ops/approvals/ApprovalItem.tsx`, `frontend/components/ops/evidence/EvidenceSection.tsx`, `frontend/app/(ops)/quests/[id]/page.tsx`, `frontend/app/(ops)/missions/[id]/page.tsx`, `frontend/app/(ops)/tasks/[id]/page.tsx`
- Delete: `frontend/app/(ops)/quests/[id]/tasks/new/` , `frontend/app/(ops)/missions/[id]/quests/new/`

- [ ] `TaskSheet.tsx` — wraps the existing `TaskForm` in `components/ui/sheet.tsx`. Props: `{ open, onOpenChange, mode: 'create' | 'edit', task?: Task, defaults?: { mission_id?: string; quest_id?: string } }`. `SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto"`, `SheetHeader` with `SheetTitle` "New task" / "Edit task" and a `SheetDescription` naming the quest when one is pre-selected. On success: toast, `queryClient.invalidateQueries({ queryKey: ['tasks'] })`, close. `TaskForm` keeps its `react-hook-form + zod` schema and gains nothing but a `submitLabel` prop — do not fork it.
- [ ] `QuestSheet.tsx` — the same wrapper around the existing `QuestForm`, props `{ open, onOpenChange, mode, quest?, defaults?: { mission_id?: string } }`.
- [ ] Replace the two "new" routes with sheet triggers:
  - `app/(ops)/quests/[id]/page.tsx` — the "New task" link becomes a `<Button>` opening `<TaskSheet mode="create" defaults={{ quest_id, mission_id }} />`. Delete `app/(ops)/quests/[id]/tasks/new/`.
  - `app/(ops)/missions/[id]/page.tsx` — the "New quest" link becomes a `<Button>` opening `<QuestSheet mode="create" defaults={{ mission_id }} />`. Delete `app/(ops)/missions/[id]/quests/new/`.
  - Edit entry points: the task row's overflow menu and `app/(ops)/tasks/[id]/page.tsx`'s "Edit" button open `<TaskSheet mode="edit" task={task} />`; `QuestCard`'s overflow menu opens `<QuestSheet mode="edit" quest={quest} />`.
  Grep for links to the deleted routes before deleting: `grep -rn "tasks/new\|quests/new" --include=*.tsx app components` must return no output afterwards.
- [ ] `TaskRowEvidenceButton.tsx` — "evidence upload is available from the task row **and** the task page". A small `<Button variant="ghost" size="icon-sm">` with a `Paperclip` icon and `aria-label="Upload evidence"`, opening a `<Sheet>` that renders the existing `EvidenceUploadZone` + `LinkEvidenceForm` + `NoteEvidenceForm` tabs for that `task_id`. Mount it in `TaskListView.tsx`'s row action cluster and on `TaskKanbanCard.tsx`. It shows the task's current evidence count as a badge when > 0.
- [ ] `InlineDecision.tsx` — approve/reject without leaving the list. Two buttons; **Approve** fires immediately; **Reject** expands an inline `<Textarea>` with a required note (zod: `note: z.string().trim().min(10, 'Say why in at least 10 characters')`) and the submit button stays disabled until it validates. Posts to `P31.decideApproval(id)` through `optionalGet`-style handling: on 404 it falls back to today's `POST /approvals/:id/approve` and, for reject, the existing `RejectionDialog` flow (C3). Optimistic update on the list, rollback + toast on failure, and `queryClient.invalidateQueries` on `['approvals']`, `['me','header']` and `['evidence']`.
- [ ] Mount `InlineDecision` in `components/ops/approvals/ApprovalItem.tsx` (replacing the current navigate-to-detail affordance, which stays available as a "Open" link) and in `components/ops/evidence/EvidenceSection.tsx` for evidence approvals.
- [ ] Accessibility for every sheet: `SheetContent` must trap focus (base-ui does this), return focus to the trigger on close, close on Escape, and set `aria-describedby` to the `SheetDescription`. Any unsaved-changes close prompts a confirm — use `form.formState.isDirty`.

**Verification:**
- `cd frontend && npx tsc --noEmit` → exit 0; `npx eslint .` → 0 errors; `npm run build` → the route table no longer lists `/quests/[id]/tasks/new` or `/missions/[id]/quests/new`.
- `grep -rn "tasks/new\|quests/new" --include=*.tsx app components` → no output.
- Manual: from `/tasks`, "New task" opens a right sheet; submit creates the task and the list updates without a full reload. From `/quests/<id>`, "New task" opens the sheet with the quest pre-filled. Escape closes; with a dirty form it prompts first. Tab order inside the sheet never escapes to the page behind it.
- Reject with an empty note → the submit button stays disabled and the field shows the message. Reject with a 10+ character note → the row updates optimistically and the header's approvals badge decrements.
- Evidence: the paperclip on a task row opens the upload sheet; uploading a note-type evidence increments the row's badge and appears on `/tasks/<id>` without a reload.

---

### Task 17: "Quest › Task" chips, the meter chip, and the quest's linked entities (SPEC §6.4, §6.5)

The connective tissue that makes an ops card explain why it exists.

**Files:**
- Create: `frontend/components/ops/tasks/QuestTaskChip.tsx`, `frontend/components/ops/tasks/MeterChip.tsx`, `frontend/components/ops/quests/QuestLinkedEntities.tsx`
- Create: `frontend/lib/nav/meters.ts` (the role → meter-name map moved out of `RoleDashboardSections`)
- Modify: every ops card that carries a task link — `components/ops/tasks/TaskListView.tsx`, `TaskKanbanCard.tsx`, `components/ops/evidence/EvidenceItem.tsx`, `components/ops/approvals/ApprovalItem.tsx`, `components/ops/decisions/DecisionCard.tsx`, `components/ops/boards/EvidenceFeedCard.tsx`, `components/ops/operations/purchase-orders/*` (the PO card carrying `linked_task_id`), `components/ops/dashboard/TodaysFocusSection.tsx`, `components/ops/dashboard/AdminBlockersWidget.tsx`
- Modify: `frontend/app/(ops)/quests/[id]/page.tsx`

- [ ] `QuestTaskChip.tsx` — the chip:

```tsx
'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface QuestTaskChipProps {
  quest?: { id: string; title: string } | null;
  task?: { id: string; title: string } | null;
  className?: string;
}

/** SPEC §6.4: every ops card with a task link shows a "Quest › Task" chip. */
export function QuestTaskChip({ quest, task, className }: QuestTaskChipProps) {
  if (!quest && !task) return null;
  return (
    <Badge
      variant="outline"
      className={`max-w-full gap-1 border-line bg-surface-raised px-1.5 text-[11px] font-normal text-ink-muted ${className ?? ''}`}
    >
      {quest && (
        <Link href={`/quests/${quest.id}`} className="truncate hover:text-brand">
          {quest.title}
        </Link>
      )}
      {quest && task && <ChevronRight className="size-3 shrink-0 text-ink-faint" aria-hidden />}
      {task && (
        <Link href={`/tasks/${task.id}`} className="truncate hover:text-brand">
          {task.title}
        </Link>
      )}
    </Badge>
  );
}
```

- [ ] `MeterChip.tsx` — "and the meter it feeds". Takes `{ meterId?: string | null; meterCode?: string | null; meterLabel?: string | null; value?: number | null }`, renders `<Badge>` with a `Gauge` icon, the meter label and `+{value}` when a `readiness_value` is present, coloured `text-[var(--status-info)]`, linking to `/readiness?meter={code}`. Returns `null` when there is no meter — a task not feeding a meter must not render an empty chip.
- [ ] Mount both chips. `Task` already carries `quest`, `readiness_meter_id` and `readiness_value` (see `schema.prisma` `model Task`), so most call sites need no new query. Where a card has only `linked_task_id` (purchase orders) or `task_id` (evidence, approvals), include the task's `{ id, title, quest: { id, title } }` in the existing list query's `include` rather than firing a per-row request — check each service's `findAll` and extend the `select`/`include` if it is missing. **Backend edits stay within `include` clauses**; if a change would need a new endpoint, skip that card and record it.
- [ ] `QuestLinkedEntities.tsx` — "every quest page lists linked POs, recipes, products, batches, events". Driven by `Task.subject_type` / `Task.subject_id` (P2 shipped both) plus `PurchaseOrder.linked_task_id`. Group the quest's tasks by `subject_type` (`recipe`, `product`, `event`, `vendor`, `purchase_order`, `prep_batch`) and render one section per non-empty group: an icon, the group name, and a list of `<Link>`s to the subject's own route (`/operations/recipes/{id}`, `/operations/menu?product={id}`, `/operations/events/{id}`, `/operations/vendors/{id}`, `/operations/purchase-orders/{id}`, `/operations/kitchen/prep-batches?batch={id}`). Subject titles come from a single batched lookup per type, not per row; where no batch endpoint exists, render the subject id in `font-mono text-xs` with the link still live and note the gap. Mount it on `app/(ops)/quests/[id]/page.tsx` under the task list.
- [ ] `frontend/lib/nav/meters.ts` — move `getRelevantMeterNames(roleCode)` out of `RoleDashboardSections.tsx` (Task 14 already references it from `MyDay`); both callers import it from here.

**Verification:**
- `cd frontend && npx tsc --noEmit` → exit 0; `npx eslint .` → 0 errors; `npm run build` → compiles.
- `grep -rln "QuestTaskChip" components/ops app` → at least the nine files listed above.
- Manual: on `/tasks`, a task belonging to a quest shows "Quest › Task"; a task with no quest shows only the task, and one with neither renders no chip (not an empty badge). On `/approvals`, each row shows the chip and the meter it feeds. On `/quests/<id>`, the Linked section lists the recipes/POs/events the quest's tasks point at, and each link opens the right record.
- Network: opening `/tasks` with 50 rows fires **one** request, not 51 — the chip data rides on the list payload.
- 360 px: the chip truncates rather than wrapping the card.

---

### Task 18: Pusher on the kitchen screens, the ≥ 30 s polling floor, and usage events (IA-07)

**Files:**
- Create: `frontend/lib/hooks/use-realtime-channel.ts`, `frontend/lib/hooks/use-usage-event.ts`, `frontend/lib/types/usage.ts`, `frontend/components/ops/UsageTracker.tsx`
- Modify: `frontend/lib/pusher-client.ts`, `frontend/lib/hooks/use-pusher-channel.ts`, `frontend/components/ops/kitchen/kds/KdsBoard.tsx`, `KdsMetricsBar.tsx`, `frontend/components/ops/kitchen/pick-and-pack/PickAndPackBoard.tsx`, `frontend/components/ops/notifications/NotificationBell.tsx`, `frontend/app/(ops)/pos/page.tsx`, `frontend/app/(ops)/pos/delivery/page.tsx`, `frontend/app/(ops)/operations/kitchen/dashboard/page.tsx`, `frontend/components/ops/header/AlertBadges.tsx`, `frontend/app/(ops)/layout.tsx`

- [ ] `lib/pusher-client.ts` — the singleton currently authorises against `/chat/auth`, which only knows `private-chat-*`. Route the auth by channel prefix so chat is untouched and the four new channels work:

```ts
const endpoint = params.channelName.startsWith('private-chat-')
  ? `${process.env.NEXT_PUBLIC_API_URL}/chat/auth`
  : `${process.env.NEXT_PUBLIC_API_URL}/realtime/auth`;
```

  Keep `credentials: 'include'` and the existing error path. Add a module-level `isPusherConfigured()` returning `Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER)` so callers can decide between realtime and polling without throwing.

- [ ] `lib/hooks/use-realtime-channel.ts` — subscribe + bind + invalidate, degrading to polling:

```ts
'use client';
import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { getPusherClient, isPusherConfigured } from '@/lib/pusher-client';

/**
 * Binds Pusher events on a private channel to react-query invalidations.
 * Returns whether realtime is live, so the caller can set its polling interval:
 * SPEC §6.4 caps fallback polling at >= 30 s and forbids it while realtime is up.
 */
export function useRealtimeChannel(
  channelName: string | null,
  events: string[],
  invalidate: QueryKey[],
): { live: boolean } {
  const queryClient = useQueryClient();
  const live = Boolean(channelName) && isPusherConfigured();

  useEffect(() => {
    if (!channelName || !live) return;
    const pusher = getPusherClient();
    const channel = pusher.subscribe(channelName);
    const handler = () => { for (const key of invalidate) void queryClient.invalidateQueries({ queryKey: key }); };
    for (const e of events) channel.bind(e, handler);
    return () => {
      for (const e of events) channel.unbind(e, handler);
      pusher.unsubscribe(channelName);
    };
    // `events` and `invalidate` are module-level constants at every call site.
  }, [channelName, live, queryClient, events, invalidate]);

  return { live };
}
```

  Delete `lib/hooks/use-pusher-channel.ts` if chat can be migrated to this hook in the same pass; if chat's usage differs enough to risk a regression, leave it and note it.

- [ ] Wire the four channels. In each case the poll interval becomes `live ? false : 30_000` — never below 30 s, and disabled entirely when realtime is up:

| File | Channel | Events | Invalidate | Today |
|---|---|---|---|---|
| `kitchen/kds/KdsBoard.tsx` | `private-kds` | `kds.order.new`, `kds.order.updated` | `['kds']` | 5 s + `refetchIntervalInBackground` |
| `kitchen/kds/KdsMetricsBar.tsx` | `private-kds` | same | `['kds','metrics']` | 10 s |
| `kitchen/pick-and-pack/PickAndPackBoard.tsx` | `private-pick-pack` | `pickpack.order.new`, `pickpack.order.updated` | `['pick-and-pack']` | 5 s + background |
| `header/AlertBadges.tsx` | `private-approvals` | `approvals.count.changed` | `['me','header']`, `['approvals']` | n/a |
| `notifications/NotificationBell.tsx` | `private-user-{userId}` | `notification.created` | `['notifications']` | 30 s (already compliant) |

  Also raise `app/(ops)/pos/page.tsx` (10 s) and `app/(ops)/pos/delivery/page.tsx` (15 s) to 30 s and delete every `refetchIntervalInBackground: true` — a backgrounded tab must not poll. `operations/kitchen/dashboard/page.tsx` is already at 30 s; leave it.

- [ ] **New-order beam.** `KdsBoard` and `PickAndPackBoard` pass `isNew={Date.now() - new Date(order.created_at).getTime() < 60_000}` to the cards Task 8 prepared. Recompute on each render tick the boards already have; do not add a timer.

- [ ] `lib/types/usage.ts`:

```ts
export type UsageEventType = 'page_view' | 'action';
export interface UsageEventPayload {
  event_type: UsageEventType;
  path?: string;
  action?: string;
  meta?: Record<string, unknown>;
}
```

- [ ] `lib/hooks/use-usage-event.ts` — `useUsageEvent()` returns `track(action: string, meta?: Record<string, unknown>)`, posting `POST /usage` and swallowing every error (telemetry may never surface to the user). Debounce identical `(action, path)` pairs within 2 s.

- [ ] `components/ops/UsageTracker.tsx` — a render-nothing client component mounted once in `app/(ops)/layout.tsx` (inside `<AppHeader>`'s sibling position, after the auth bootstrap resolves). It fires one `page_view` per pathname change:

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useUsageEvent } from '@/lib/hooks/use-usage-event';

/** IA-07: page views per role. The role comes from the session server-side, so the
 *  client sends only the path — never the role, never query strings (they carry ids). */
export function UsageTracker() {
  const pathname = usePathname();
  const { track } = useUsageEvent();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;
    track('page_view', { path: pathname });
  }, [pathname, track]);

  return null;
}
```

  > `track` must send `{ event_type: 'page_view', path }` for this call and `{ event_type: 'action', action, meta }` for the others; give the hook two functions (`trackPageView`, `trackAction`) rather than overloading one if that reads more clearly at the call sites.

- [ ] **Key actions** to instrument with `trackAction` (SPEC §8 "key actions", kept to a short, meaningful list — not every click): `task.create`, `task.status_change`, `task.validate`, `evidence.upload`, `approval.decide`, `quest.create`, `order.place` (POS), `kds.item_ready`, `import.run`, `export.run`, `module_access.update`. Add the call at the success branch of each existing mutation.

**Verification:**
- `cd frontend && npx tsc --noEmit` → exit 0; `npx eslint .` → 0 errors; `npm run build` → compiles.
- `grep -rn "refetchInterval" app components lib` → **every** numeric value is ≥ 30000, and no `refetchIntervalInBackground` remains. This is the mechanical proof of SPEC §6.4.
- With Pusher **unconfigured** (no `NEXT_PUBLIC_PUSHER_KEY`): `/operations/kitchen/kds` polls once every 30 s and never opens a socket; no console error.
- With Pusher **configured**: `/operations/kitchen/kds` opens `private-kds`, `refetchInterval` is `false`, and placing a POS order makes the board update within a second without a poll. As `TALENT_LEAD`, subscribing to `private-kds` is refused by `POST /realtime/auth` (403) and the board — which that role cannot see anyway — is unreachable.
- Approvals badge: approving from `/approvals` in one browser decrements the header badge in a second browser logged in as another approver.
- Usage: navigate `/dashboard` → `/tasks` → `/readiness`; `SELECT path, count(*) FROM "UsageEvent" WHERE event_type='page_view' GROUP BY path` returns those three paths with count 1 each, and re-visiting `/tasks` in the same session does not double-count until the pathname actually changes. `GET /usage/summary` shows `by_role` populated with the logged-in role.

---

### Task 19: Enforce it — lint rules, dead-primitive deletion, CI, and the walk-through

`QA-04` and `DESIGN-02`. This task runs last and alone: it deletes files only after every slice's grep is clean.

**Files:**
- Create: `frontend/eslint-rules/no-raw-colors.mjs`
- Modify: `frontend/eslint.config.mjs`, `backend/src/**/*.service.ts` (the eight files with `console.*`), `.github/workflows/ci.yml`
- Delete: 12 unused `frontend/components/ui/*` primitives, `frontend/components/ops/Sidebar.tsx` (the shim)

- [ ] `frontend/eslint-rules/no-raw-colors.mjs` — no new dependency; `no-restricted-syntax` selectors over string literals and template chunks:

```js
const RAW_COLOR =
  "/(?:^|\\\\s)(?:bg|text|border|from|via|to|ring|fill|stroke|shadow|outline|decoration|divide|caret|accent)-(?:\\\\[#|\\\\[rgb|\\\\[hsl|\\\\[oklch|slate-|gray-|zinc-|neutral-|stone-|red-|orange-|amber-|yellow-|lime-|green-|emerald-|teal-|cyan-|sky-|blue-|indigo-|violet-|purple-|fuchsia-|pink-|rose-)/";

const MESSAGE =
  'No raw colour values (DESIGN-02). Use a token: bg-surface / text-ink / border-line / text-brand, ' +
  'or a STATUS_BADGE key from lib/status-styles. Arbitrary values must wrap in var(): bg-[var(--accent-soft)].';

/** Also catches bare hex in JSX props and inline styles: fill="#fff", style={{ color: '#c2410c' }}. */
const BARE_HEX = "/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/";

export const noRawColorRules = {
  'no-restricted-syntax': ['error',
    { selector: `Literal[value=${RAW_COLOR}]`, message: MESSAGE },
    { selector: `TemplateElement[value.raw=${RAW_COLOR}]`, message: MESSAGE },
    { selector: `Literal[value=${BARE_HEX}]`, message: MESSAGE },
  ],
};

/** Same rules at warn level, for slices Phase 34 rewrites wholesale. */
export const noRawColorWarnRules = {
  'no-restricted-syntax': ['warn', ...noRawColorRules['no-restricted-syntax'].slice(1)],
};
```

- [ ] `frontend/eslint.config.mjs` — add three blocks after the existing rules block:

```js
import { noRawColorRules, noRawColorWarnRules } from './eslint-rules/no-raw-colors.mjs';

// …inside defineConfig([...]):
{
  files: ['app/(ops)/**/*.tsx', 'components/ops/**/*.tsx', 'components/ui/**/*.tsx', 'lib/**/*.ts', 'lib/**/*.tsx'],
  rules: {
    ...noRawColorRules,
    // QA-04: no new `any` on the surfaces P4 owns.
    '@typescript-eslint/no-explicit-any': 'error',
  },
},
{
  // Phase 34 rewrites the storefront; the rule warns there so the debt is visible, not silent.
  files: ['app/(public)/**/*.tsx', 'components/public/**/*.tsx', 'app/(auth)/**/*.tsx'],
  rules: noRawColorWarnRules,
},
{
  // Frozen: the homepage owns its scoped styles (SPEC §7).
  files: ['app/page.tsx', 'components/public/ScrollVideoStory.tsx'],
  rules: { 'no-restricted-syntax': 'off' },
},
```

- [ ] **QA-04, backend half** — remove the 16 `console.*` calls from the eight services (`customer-auth/whatsapp.service.ts` ×2, `customer-auth/redis.service.ts` ×3, `kitchen/waste/waste.service.ts` ×1, `webhooks/webhooks.service.ts` ×5, `procurement/procurement.service.ts` ×1, `orders/orders.service.ts` ×2, `customer-orders/customer-orders.service.ts` ×1, `razorpay/razorpay.service.ts` ×1), replacing each with the Nest `Logger` those files already have (or adding `private readonly logger = new Logger(X.name)`). Then add to `backend/eslint.config.*`:

```js
{
  files: ['src/**/*.service.ts'],
  rules: { 'no-console': 'error' },
},
```

- [ ] **Delete the dead motion primitives.** Only after `grep -rn "<Name" --include=*.tsx app components | grep -v "components/ui/"` returns nothing for each: `components/ui/blur-fade.tsx`, `magic-card.tsx`, `shimmer-button.tsx`, `shine-border.tsx`, `pulsating-button.tsx`, `interactive-hover-button.tsx`, `animated-list.tsx`, `avatar-circles.tsx`, `animated-circular-progress-bar.tsx`, `text-animate.tsx`, `hyper-text.tsx`, `cool-mode.tsx`. Survivors: `border-beam.tsx`, `number-ticker.tsx`, `confetti.tsx`, `animated-theme-toggler.tsx`.
- [ ] **Delete the `Sidebar` shim** — `grep -rn "components/ops/Sidebar" app components` must return nothing first.
- [ ] **Delete the deprecated `STATUS_BADGE` colour aliases** (`amber`, `blue`, `green`, `red`) from `lib/status-styles.ts` once `grep -rn "STATUS_BADGE\.\(amber\|blue\|green\|red\)" app components` is empty.
- [ ] `.github/workflows/ci.yml` — make lint failures bite. Change the frontend step to `- run: npx eslint . --max-warnings 500` (a ceiling that today's ~34 storefront warnings sit far below, and which ratchets down in Phase 34) and add, after the build step:

```yaml
      - name: Motion allowlist
        run: |
          ! grep -rn "BlurFade\|MagicCard\|ShimmerButton\|ShineBorder\|PulsatingButton\|InteractiveHoverButton\|AnimatedList\|AvatarCircles\|AnimatedCircularProgressBar\|TextAnimate\|HyperText\|CoolMode" --include=*.tsx app components
      - name: Polling floor (SPEC 6.4 — no interval under 30s, no background polling)
        run: |
          ! grep -rnE "refetchInterval: *(1?[0-9]{1,4})(,|$)|refetchIntervalInBackground" --include=*.ts --include=*.tsx app components lib
```

- [ ] **Frontend smoke (there is no test runner — this is the substitute).** From `frontend/`, with the backend running against the seeded database:

```
npm run build
npx next start -p 3100 &
# wait for the port, then:
curl -s -o /dev/null -w "/ %{http_code}\n"                http://localhost:3100/
curl -s -o /dev/null -w "/team %{http_code}\n"            http://localhost:3100/team
curl -s -o /dev/null -w "/sign-in %{http_code}\n"         http://localhost:3100/sign-in
curl -s -o /dev/null -w "/dashboard %{http_code}\n"       http://localhost:3100/dashboard
curl -s -o /dev/null -w "/tasks %{http_code}\n"           http://localhost:3100/tasks
curl -s -o /dev/null -w "/quests %{http_code}\n"          http://localhost:3100/quests
curl -s -o /dev/null -w "/admin/modules %{http_code}\n"   http://localhost:3100/admin/modules
```

  Expected: `/` → 200; `/team` → 200 (the rewritten login form); `/sign-in` → 200; `/dashboard`, `/tasks`, `/quests`, `/admin/modules` → 307 to `/team?redirect=…` with no cookie. Repeat the last four with a valid `access_token` cookie from `POST /auth/login` and expect 200. On Windows PowerShell use `Invoke-WebRequest -MaximumRedirection 0 -SkipHttpErrorCheck` and read `.StatusCode`.

**Verification:**
- `cd frontend && npx eslint .` → **0 errors** and the warning count is only the storefront's.
- Deliberate regression check: add `className="bg-red-500"` to any file under `components/ops/` → `npx eslint .` reports 1 error; revert.
- `cd backend && npm run lint:check` → 0 errors; `npx jest --silent` → all suites green; `npx tsc --noEmit -p tsconfig.build.json` → exit 0; `npm run build` → exit 0.
- `grep -rn "console\." backend/src --include=*.service.ts` → no output.
- Both CI grep gates pass locally (run the two `!` grep commands by hand).
- The `next start` + curl table matches the expected column.
- **Walk-through, recorded in `.planning/phases/32-p4-role-aware-ia-identity/32-01-SUMMARY.md`** (SPEC §10 definition of done): log in as each of the eight seeded roles and capture, per role, the spine items rendered, the header crumb, and the `/dashboard` variant; then one end-to-end pass as `BACKEND_LEAD` — `/tasks` → filter to mine + todo → open the task sheet → create → upload evidence from the row → approve as `FOUNDER_ADMIN` inline → confirm the header badge decrements and the readiness ring moves. Both themes, 360 px and 1440 px.

---

## Execution partition

Five waves. Every agent is an **Opus implementer** (`model: "opus"` on every execution subagent) running in its **own git worktree** off `v2-os-marketplace`, created with the `superpowers:using-git-worktrees` skill. Within a wave, agents run in parallel and their file sets are **disjoint**; a wave merges to `v2-os-marketplace` and the gates run before the next wave starts.

### Wave 0 — foundation (2 agents in parallel)

| Agent | Tasks | Exclusive file set |
|---|---|---|
| **W0-A** `p4-tokens` | 1, 2 | `frontend/app/tokens.css`, `frontend/app/base-ui-variants.css`, `frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/lib/providers.tsx`, `frontend/lib/brand-colors.ts`, `frontend/lib/status-styles.ts`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/components.json`, `frontend/components/spectrumui/**` (delete), `frontend/components/patterns/**` (delete) |
| **W0-B** `p4-backend` | 3, 4, 5, 6 | everything under `backend/` |

W0-A and W0-B share nothing — one is `frontend/`, the other `backend/`. W0-B runs its four tasks sequentially inside one agent so `backend/src/app.module.ts` is edited exactly once (Task 3's last step, committed with Task 6).

**Gate before Wave 1:** frontend `tsc` + `eslint` + `build` green; backend `lint:check` + `tsc` + `jest` (63 suites) + `build` + `prisma validate` + the drift check green; the migration applied to the local `konma` database.

### Wave 1 — sweeps (4 agents in parallel) · depends on Wave 0-A

| Agent | Task | Exclusive file set |
|---|---|---|
| **W1-A** `p4-sweep-ops-routes` | 7 | `frontend/app/(ops)/**` except `layout.tsx`/`error.tsx`/`loading.tsx`; `frontend/components/ops/missions/**`, `quests/**`, `tasks/**`, `boards/**`, `dashboard/**`; `frontend/components/ops/*.tsx` |
| **W1-B** `p4-sweep-operations` | 8 | `frontend/components/ops/operations/**`, `kitchen/**`, `pos/**`, `inventory/**`, `analytics/**`, `kpis/**`, `leaderboard/**` |
| **W1-C** `p4-sweep-governance` | 9 | `frontend/components/ops/approvals/**`, `decisions/**`, `evidence/**`, `delegations/**`, `readiness/**`, `gamification/**`, `guide/**`, `chat/**`, `notifications/**`, `exports/**`; `frontend/components/auth/**` |
| **W1-D** `p4-sweep-public` | 10 | `frontend/app/(public)/**`, `frontend/app/(auth)/**`, `frontend/components/public/**` (not `ScrollVideoStory.tsx`), `frontend/hooks/**`, `frontend/lib/types/imports.ts` |

The four slices partition `frontend/app` and `frontend/components` with no overlap. `frontend/components/ui/**` is touched by **nobody** in Wave 1 (it is already colour-clean; Task 19 deletes the dead files). `frontend/lib/**` is touched by nobody in Wave 1 except W1-D's single `lib/types/imports.ts`.

**Gate before Wave 2:** `tsc` + `eslint` + `build` green on the merged tree; all four slice greps clean.

### Wave 2 — information architecture (5 agents in parallel) · depends on Wave 1

| Agent | Task | Exclusive file set |
|---|---|---|
| **W2-A** `p4-header` | 11 | `frontend/components/ops/header/**`, `frontend/lib/hooks/use-header-context.ts`, `frontend/lib/types/header.ts`, **`frontend/app/(ops)/layout.tsx`** |
| **W2-B** `p4-spine` | 12 | `frontend/lib/nav/spine.ts`, `frontend/lib/hooks/use-module-access.ts`, `frontend/components/ops/nav/**`, **`frontend/components/ops/Sidebar.tsx`**, **`frontend/proxy.ts`**, **`frontend/lib/types/index.ts`**, `frontend/app/(auth)/team/` → `frontend/app/(auth)/sign-in/` (move) |
| **W2-C** `p4-work-routes` | 13 | `frontend/app/(ops)/tasks/page.tsx`, `frontend/app/(ops)/quests/page.tsx`, `frontend/app/(ops)/team/page.tsx`, `frontend/components/ops/tasks/TaskFilterBar.tsx`, `TaskKanban.tsx`, `TaskListView.tsx`, `TaskViewToggle.tsx`, `frontend/components/ops/team/**`, `frontend/lib/types/tasks-page.ts` |
| **W2-D** `p4-mission-control` | 14 | `frontend/app/(ops)/dashboard/page.tsx`, `frontend/components/ops/dashboard/**`, `frontend/lib/api/optional.ts`, `frontend/lib/api/phase31.ts` |
| **W2-E** `p4-admin-screens` | 15 | `frontend/app/(ops)/admin/modules/**`, `frontend/app/(ops)/admin/node/**`, `frontend/components/ops/admin/**` |

Boundary notes that make the sets disjoint: `app/(ops)/layout.tsx` belongs to W2-A alone (W2-B *consumes* `SpineNav` but does not edit the layout — W2-A imports it, so W2-B must land the file first inside the wave; both agents are told to create `components/ops/nav/SpineNav.tsx` as W2-B's file and W2-A merges second). `components/ops/tasks/**` is split by file: W2-C owns `TaskFilterBar`, `TaskKanban`, `TaskListView`, `TaskViewToggle`; Wave 3's W3-A owns `TaskSheet`, `TaskForm`, `TaskKanbanCard`, `TaskRowEvidenceButton`. `components/ops/dashboard/**` is W2-D's alone (W1-A swept it in the previous wave, which is a wave boundary, not a conflict).

> **Intra-wave ordering, W2-A ↔ W2-B:** merge **W2-B first** so `SpineNav` exists, then W2-A. If both are merged simultaneously, the merge order is `W2-B`, `W2-A`, `W2-C`, `W2-D`, `W2-E` — the only real edge is the `SpineNav` import.

**Gate before Wave 3:** `tsc` + `eslint` + `build` green; the eight-role spine walk-through from Task 12's verification passes.

### Wave 3 — interaction and realtime (3 agents in parallel) · depends on Wave 2

| Agent | Task | Exclusive file set |
|---|---|---|
| **W3-A** `p4-sheets` | 16 | `frontend/components/ops/tasks/TaskSheet.tsx`, `TaskForm.tsx`, `TaskKanbanCard.tsx`, `TaskRowEvidenceButton.tsx`; `frontend/components/ops/quests/QuestSheet.tsx`, `QuestForm.tsx`, `QuestCard.tsx`; `frontend/components/ops/approvals/**`; `frontend/components/ops/evidence/EvidenceSection.tsx`; `frontend/app/(ops)/quests/[id]/**`, `frontend/app/(ops)/missions/[id]/**`, `frontend/app/(ops)/tasks/[id]/**` |
| **W3-B** `p4-chips` | 17 | `frontend/components/ops/tasks/QuestTaskChip.tsx`, `MeterChip.tsx`, `TaskListView.tsx`; `frontend/components/ops/quests/QuestLinkedEntities.tsx`; `frontend/lib/nav/meters.ts`; `frontend/components/ops/decisions/DecisionCard.tsx`, `boards/EvidenceFeedCard.tsx`, `evidence/EvidenceItem.tsx`, `operations/purchase-orders/**`, `dashboard/TodaysFocusSection.tsx`, `dashboard/AdminBlockersWidget.tsx`; backend `include`-clause edits under `backend/src/{tasks,evidence,approvals,purchase-orders}/` |
| **W3-C** `p4-realtime-usage` | 18 | `frontend/lib/pusher-client.ts`, `frontend/lib/hooks/use-realtime-channel.ts`, `use-pusher-channel.ts`, `use-usage-event.ts`; `frontend/lib/types/usage.ts`; `frontend/components/ops/UsageTracker.tsx`; `frontend/components/ops/kitchen/**`; `frontend/components/ops/notifications/**`; `frontend/components/ops/header/AlertBadges.tsx`; `frontend/app/(ops)/pos/**`, `frontend/app/(ops)/operations/kitchen/**`; `frontend/app/(ops)/layout.tsx` (one line: mount `<UsageTracker />`) |

Three genuine near-collisions, resolved by explicit ownership: `TaskListView.tsx` → **W3-B** (W3-A mounts `TaskRowEvidenceButton` by exporting it and letting W3-B place it — W3-A creates the component, W3-B mounts it). `components/ops/header/AlertBadges.tsx` → **W3-C** (W2-A created it in the previous wave). `app/(ops)/layout.tsx` → **W3-C**, for one import and one JSX line; W3-A and W3-B must not touch it. `components/ops/evidence/**` is split: `EvidenceSection.tsx` → W3-A, `EvidenceItem.tsx` → W3-B.

**Gate before Wave 4:** `tsc` + `eslint` + `build` green; the polling-floor grep clean; the Pusher-configured and Pusher-unconfigured runs from Task 18 both pass.

### Wave 4 — enforcement (1 agent, alone)

| Agent | Task | File set |
|---|---|---|
| **W4** `p4-enforce` | 19 | `frontend/eslint-rules/no-raw-colors.mjs`, `frontend/eslint.config.mjs`, `frontend/components/ui/**` (12 deletions), `frontend/components/ops/Sidebar.tsx` (deletion), `frontend/lib/status-styles.ts` (alias deletion), `backend/src/**/*.service.ts` (16 `console.*`), `backend/eslint.config.*`, `.github/workflows/ci.yml` |

Runs alone because it deletes files across every slice and only a clean, merged tree can prove the deletions are safe.

### Dependency graph

```
W0-A ──┬─→ W1-A ─┐
       ├─→ W1-B ─┤
       ├─→ W1-C ─┼─→ W2-B → W2-A ─┐
       └─→ W1-D ─┘   W2-C          ├─→ W3-A ─┐
W0-B ────────────────→ W2-D        │   W3-B ─┼─→ W4
                       W2-E ───────┘   W3-C ─┘
```

W0-B (backend) gates W2-A (`/me/header`, `/search`), W2-C (`/tasks?mine=1&cursor=`), W2-E (`/modules`, `/nodes/current` — already live) and W3-C (`/realtime/auth`, `/usage`). Because W0-B runs in parallel with W0-A and finishes long before Wave 2, it is never on the critical path.

---

## Self-review

### SPEC coverage → task

| Spec item | Task |
|---|---|
| §6.1 persistent header on every ops page, every role | 11 |
| §6.1 mission › phase › this week's quest | 4 (`/me/header`), 11 (`MissionCrumb`) |
| §6.1 node readiness % | 4, 11 (`ReadinessPill`) |
| §6.1 approvals-waiting + my-blockers badges | 4, 11 (`AlertBadges`), 18 (Pusher refresh) |
| §6.1 XP / level | 11 (`XpChip`) |
| §6.1 ⌘K search across tasks, products, recipes, guides | 4 (`GET /search`), 11 (`CommandPalette`) |
| §6.1 notifications · theme · user in the header | 11 |
| §6.1 never null — start-a-mission CTA / ask-the-founder note | 11 (`MissionCrumb`) |
| §6.2 fixed spine order, positions 1–8 | 12 (`SPINE_PRIMARY`) |
| §6.2 collapsible groups Kitchen · Procurement · Commerce · Catalog & Experiences · Intelligence · Admin | 12 (`SPINE_GROUPS`) |
| §6.2 Guide and Chat move to the header | 11, 12 (`HEADER_MODULES`) |
| §6.2 no label appears twice | 12 (`assertUniqueLabels`) |
| §6.2 `/team` merges wins, contribution, activity, leaderboard | 13 (`TeamTabs`) |
| §6.3 items render only when `ModuleAccess` allows | 12 (`buildSpine` + `use-module-access`) |
| §6.3 `/admin/modules` editable by `MANAGE_SYSTEM` | 15 |
| §6.4 Task and Quest create/edit are Sheets | 16 |
| §6.4 evidence upload from the task row and the task page | 16 (`TaskRowEvidenceButton`) |
| §6.4 approve/reject inline, required note on reject | 16 (`InlineDecision`) |
| §6.4 "Quest › Task" chip + the meter it feeds | 17 |
| §6.4 quest pages list linked POs, recipes, products, batches, events | 17 (`QuestLinkedEntities`) |
| §6.4 `react-hook-form + zod` everywhere | Rule S6 (Tasks 7–10), 15, 16 |
| §6.4 `<Button>` is the only button, `<Card>` the only card | Rule S1 (Tasks 7–10), 19 (deletion) |
| §6.4 loading / empty / error on every list | Rule S5 (Tasks 7–10), 13, 14, 15 |
| §6.4 motion allowlist — BorderBeam, NumberTicker, confetti; `motion-reduce` | Rules S1–S2 (Tasks 7–10), 8 (`isNew` beam), 19 (CI gate) |
| §6.4 Pusher private channels for KDS, Pick & Pack, Shipments, Approvals, Notifications | 6 (backend), 18 (frontend) — Shipments channel is declared in `realtime.channels.ts`; its screen is Phase 34 |
| §6.4 polling only as a ≥ 30 s fallback | 18, 19 (CI gate) |
| §6.5 Mission Control — Action Required / Status / Intelligence, 30-day sparkline | 14 |
| §6.5 My Day — Today's Focus, quest progress, evidence awaiting review, meter contributions, nudges | 14 |
| §7 `--public-*` promoted to `:root` with a designed dark set | 1 |
| §7 status colours separate from brand | 1 (`--status-*`), Rules S3–S4 |
| §7 Plus Jakarta Sans (UI) + Geist Mono (data) | already in `app/layout.tsx`; 1 keeps the `--font-*` map |
| §7 one token file, zero arbitrary colour values, lint rule | 1, Tasks 7–10, 19 |
| §7 light and dark both validated for contrast | 1 (the acceptance table) |
| §7 the homepage keeps its own scoped styles | 1 (`--public-*` preserved), 10 (frozen), 19 (lint ignore) |
| §3.5 `frontend/components/spectrumui/` | 2 |
| §3.5 `frontend/components/patterns/p-combobox-3.tsx` | 2 |
| §3.5 duplicate `MissionCard` | 2 (audit), 7 (merge) |
| §3.5 duplicate `GuideSectionCard` | 2 (audit), 9 (rename) |
| §3.5 `framer-motion` dependency | 1 (removal), 2 (proof) |
| §3.5 `shadcn` as a runtime dependency | 1 (vendor + move to dev), 2 (proof) |
| §3.5 BullMQ remnants in `.env.example` | 2 (already gone — zero result recorded) |
| §8 `UsageEvent` — page views per role, key actions | 3 (model + API), 18 (client) |
| §9 `modules` (GET, PATCH) | already live; 15 builds the UI |
| §9 `nodes` (GET/PATCH current) | already live; 15 builds the UI |
| §9 `tasks?mine=1&status=&quest_id=` server-filtered, paginated, `cursor`/`limit` | 5 |
| §9 `usage` (admin) | 3 |
| §10 CI gates, definition-of-done lint | 19 |
| §10 human walk-through recorded in the phase summary | 19 |

### REQUIREMENTS id → task

| Id | Task(s) |
|---|---|
| `IA-01` | 4, 11 |
| `IA-02` | 11, 12 |
| `IA-03` | 12, 15 |
| `IA-04` | 5, 13 |
| `IA-05` | 16, 17 |
| `IA-06` | 14 |
| `IA-07` | 3, 6, 18 |
| `DESIGN-01` | 1 |
| `DESIGN-02` | 1, 19 |
| `DESIGN-03` | Rules S5/S6 in 7–10; 13, 14, 15, 16 |
| `DESIGN-04` | Rules S1/S2 in 7–10; 8, 19 |
| `QA-04` | 8, 9, 10 (the ten frontend `any`s), 19 (rules + the 16 backend `console.*` + CI) |
| `PLAT-09` (frontend half, deferred to P4 by P2) | 1, 2, 7, 9 |

### Deliberately deferred, with reason

- **`shipments`, `customers`, `reviews`, `promotions` spine entries** → Phase 34. Their `ModuleAccess` rows are seeded and `private-shipments` is declared in `realtime.channels.ts`, but the routes do not exist; adding nav entries now would ship dead links (Decision 10).
- **`talent` module** → v2.1, per SPEC §6.3's own annotation.
- **"Failed shipments" in Mission Control's Action Required** → Phase 34, for the same reason. The row is omitted with a code comment, not stubbed.
- **Admin usage dashboard over `UsageEvent`** → Phase 35 (`RUN-04`). P4 ships the model, the write path, `GET /usage/summary` and the client; the screen is explicitly out of scope.
- **"Reset module access to seeded defaults"** → no backend route exists and inventing one is out of scope; recorded as a P6 candidate (Task 15).
- **Storefront colour debt** (~34 warnings across `app/(public)` + `components/public`) → the lint rule warns rather than errors there because Phase 34 rewrites those files wholesale; the CI ceiling ratchets down then (Decision 13).
- **`app/page.tsx` and `ScrollVideoStory.tsx`** — frozen by the brief and by SPEC §7 ("the homepage keeps its own scoped styles"). Their 16 raw-colour hits are permanently exempt.
- **P2 follow-ups not in P4's scope:** product **variant picker** and **media upload** UI (`30-01-SUMMARY.md` #1, #6) → Phase 34 with the catalog admin; `OrderItem.fulfilment` derivation (#4) → Phase 33; the explicit-UTC `T23:59:59.999Z` day filters (#5) → a follow-up, since fixing them touches five services P3 and P5 are both rewriting. P4 does close #2 (`IMPORT_TYPES`, Task 10) and #3 (`AdminAdHocInjectorWidget`, Task 14).
- **Chat's own Pusher hook** stays on `use-pusher-channel.ts` if migrating it would risk a regression (Task 18) — chat is not on the `IA-07` list.

### Risks

1. **The compat layer is a blast radius.** Re-pointing `--primary`, `--card`, `--border` recolours 279 components in one commit. Mitigation: Task 1 changes *values only*, never names, so nothing can fail to compile; the failure mode is visual, and it is caught by Task 1's two-theme manual pass before Wave 1 forks four agents off it. If a primitive looks wrong, the fix is one line in `tokens.css`, not 279 files.
2. **Four parallel sweeps over 109 files can collide at merge.** Mitigation: the slices partition `app/` and `components/` by directory with no overlap, and the three near-collisions (`app/(ops)/layout.tsx`, `components/ops/dashboard/**`, `app/(auth)/team/page.tsx`) are named with an owner in the partition table. Merge order within Wave 1 does not matter because no file appears twice.
3. **`/team` is load-bearing and the homepage that links to it is frozen.** Mitigation: a `NextResponse.rewrite` (not a redirect) keeps the URL and every existing `/team` reference working — `app/page.tsx` ×3, `lib/auth.ts` ×2, `lib/api-client.ts`, `app/(ops)/layout.tsx`, `PasswordSetupForm`, `forgot-password` ×2, `app/(public)/login`. Task 12's verification exercises the logged-out and logged-in paths separately. **This is sign-off item 1.**
4. **Phase 31 may name its endpoints differently.** Mitigation: three constants in `lib/api/phase31.ts`, every call through `optionalGet`, and Task 14's verification explicitly runs `/dashboard` against a *Phase-31-less* backend and requires a clean render.
5. **`GET /tasks` pagination could break six existing callers.** Mitigation: the response shape only changes when `cursor` or `limit` is supplied; the six callers are enumerated in Task 5 and none of them sends either. A `tasks.service.spec.ts` case pins the legacy shape.
6. **`ModuleAccess` can lock a role out of everything.** A `MANAGE_SYSTEM` holder can uncheck every role from `mission_control`. Mitigation: Task 15's confirm dialog on the last-role and primary-spine cases; and the spine failing open is *not* implemented deliberately — an empty spine with a visible note is better than a nav that silently ignores the data.
7. **Pusher is optional in this environment.** `PusherService` warns and no-ops when unconfigured. Mitigation: `isPusherConfigured()` gates every subscription, `useRealtimeChannel` returns `live: false`, and the boards fall back to 30 s polling. Task 18 verifies both configurations.
8. **The arbitrary-colour rule uses ESLint selector regexes,** which are matched against string literal *values*, so a class assembled at runtime (`` `bg-${color}-500` ``) slips through. Mitigation: the `TemplateElement` selector catches the static chunks, and Rules S3–S4 forbid runtime colour assembly in the first place — where a sweep finds one, it is replaced by a lookup into `STATUS_BADGE`. Residual risk accepted and recorded.
9. **`--gold` at `#a16207` is the weakest pair** in the light theme (4.71 : 1). Mitigation: `--gold-text: #8a5406` (6.0 : 1) is the token for small text; `--gold` is for fills, icons and ≥ 18 px text. Called out in the token table so a sweep does not reach for the wrong one.

### Two design decisions needing sign-off

1. **`/team` becomes the Team hub; the staff login form moves to `/sign-in` but keeps serving at `/team` via a proxy rewrite.** SPEC §6.2 demands `/team` for the Team hub; the frozen homepage links to `/team` three times for login. A rewrite satisfies both without touching the frozen file and without changing any of the nine existing `/team` references. The alternative — putting the Team hub at a non-SPEC path like `/team-hub` — is cheaper but violates §6.2 and leaves the IA inconsistent. **Confirm the rewrite approach.**

2. **The brand accent is wired through shadcn's `--primary`, and shadcn's `--accent` is retargeted to a hover tint under the new name `--ui-accent`.** This is what lets 279 components become terracotta in one commit instead of a 279-file rename, but it means the Tailwind utility `bg-accent` no longer means "brand accent" — brand is `bg-brand` / `bg-primary`. The alternative is to rename the variables across `components/ui/**` and every consumer, which is a large mechanical diff with no visual gain and a real regression risk in a wave that already has four parallel agents. **Confirm that `--accent` (CSS variable) = brand terracotta while `accent` (Tailwind utility) = hover surface is an acceptable naming split**, or ask for the full rename and add a task to Wave 0.

---
