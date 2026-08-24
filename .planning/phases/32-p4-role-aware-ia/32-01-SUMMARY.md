# Phase 32-01 — P4 "Role-Aware IA + Identity" Summary

**Branch:** `v2-os-marketplace`
**Range:** `be2879f..e871cf4` (frontend + `backend/src/{usage,me,search,realtime}`)
**Plan:** `docs/superpowers/plans/2026-08-23-p4-role-aware-ia-identity.md` (19 tasks)
**Date:** 2026-08-24

P4 gives every role one answer to "what must I move today". A persistent mission header sits on every
ops page, the navigation spine is rendered from `GET /modules/mine` instead of from permissions, and
`/tasks`, `/quests?mine=1`, `/team`, `/admin/modules`, `/admin/node`, Mission Control and My Day are
built on a single brand token file derived from the homepage's `--public-*` palette — in light and
dark, with the SPEC §6.4 motion allowlist and the SPEC §3.5 dead weight now enforced by lint and CI
rather than by convention.

The phase ran as five waves in parallel worktrees (`p4-01/02` → the four sweeps → the IA screens →
interaction/realtime → this enforcement task). Backend work was small, purely additive, and ran in
Wave 0 so no frontend task ever waited on an API.

---

## What P4 delivered

| Task | Commit(s) | What landed |
|---|---|---|
| 1 | `6b91bf4`, `bc19803` | `app/tokens.css` (164 lines) — raw ramp → `--public-*` (values unchanged) → semantic (`--bg`, `--surface*`, `--ink*`, `--line*`, `--accent`, `--leaf`, `--gold`) → `--status-*` → the 26-name shadcn compat layer, for `:root` and `.dark`. Root layout stops hard-coding `dark`; `defaultTheme="system"`. `lib/brand-colors.ts` and `lib/status-styles.ts` rewritten onto tokens. `framer-motion` dropped. |
| 2 | `52b8450` | SPEC §3.5 removals, each grep-proven: `components/spectrumui/` and `components/patterns/` deleted, `shadcn` moved to `devDependencies` with its 95 runtime lines vendored into `app/base-ui-variants.css` (97 lines), the duplicate `MissionCard` merged behind a `density` prop, admin `GuideSectionCard` renamed `GuideSectionAdminRow`, BullMQ `.env.example` remnants confirmed already gone. |
| 3 | `1e95fa2`, `31337f3` | `UsageEvent` model + `UsageEventType` enum, migration `20260826000000_p4_role_aware_ia`, `POST /usage` (202) and `GET /usage/summary` (admin). |
| 4 | `14de34d` | `GET /me/header` and `GET /search` (tasks · products · recipes · guides). |
| 5 | `7db8438` | `GET /tasks` server-filtered and cursor-paginated (`?mine=1&status=&quest_id=&cursor=&limit=`), `GET /quests?mine=1`. Additive: the legacy bare-array shape survives when neither `cursor` nor `limit` is sent. |
| 6 | `ed46963` | Pusher channel auth generalised off `private-chat-*`; `realtime.channels.ts` declares KDS, Pick & Pack, Shipments, Approvals and Notifications. |
| 7 | `f552816`, `2aae5c6` | Sweep A — ops routes, mission/quest/task/board/dashboard onto brand tokens. |
| 8 | `0fa8b66`, `448cbc1` | Sweep B — operations/kitchen/POS/intelligence components. |
| 9 | `6b8a136`, `cc1dba0` | Sweep C — governance/evidence/readiness/gamification/guide/chat/notifications/exports. |
| 10 | `96794ca`, `2fba6b9` | Sweep D — public storefront and auth pages, plus the `IMPORT_TYPES` gap P2 left open. |
| 11 | `63464ec`, `b0af65b` | `AppHeader` on every ops page: `MissionCrumb`, `ReadinessPill`, `AlertBadges`, `XpChip`, `CommandPalette` (⌘K), notifications, theme toggler, user menu. Never null — a start-a-mission CTA or an ask-the-founder note fills the empty case. |
| 12 | `26815ef`, `4bf7f6c` | `lib/nav/spine.ts` — 8 fixed primary items, 6 collapsible groups (35 items), Guide and Chat moved to the header, `assertUniqueLabels()`, `buildSpine()` filtering on `ModuleAccess`. `/team` → `/sign-in` **rewrite** in `proxy.ts`. |
| 13 | `e8bb245`, `a5f06ca` | `/tasks` (server-filtered kanban + list), `/quests?mine=1`, and the `/team` hub with wins · contribution · activity · leaderboard · directory tabs. |
| 14 | `34e57ed`, `d7839e3` | Mission Control (admin) — Action Required / Status / Intelligence with a 30-day sparkline — and My Day (everyone else). `lib/api/optional.ts` + `lib/api/phase31.ts` degrade every Phase-31 surface to a defined empty state. |
| 15 | `3e881a9`, `dcc06b3` | `/admin/modules` — the 47-row × 8-role `ModuleAccess` matrix, `MANAGE_SYSTEM`-gated, with last-role and primary-spine confirmations — and `/admin/node`. |
| 16 | `7ed2052`, `a3097c9` | Task and Quest **Sheets** (the `/quests/[id]/tasks/new` and `/missions/[id]/quests/new` routes deleted), inline approve/reject with a required note on reject, and evidence upload straight from the task row. |
| 17 | `c7f9d6d`, `7971814`, `54c50f7` | "Quest › Task" lineage chips, the meter a task feeds, and `QuestLinkedEntities` (POs, recipes, products, batches, events). The follow-up commit enriched the evidence/PO/task **backend includes** the chips need. |
| 18 | `6fdc113`, `4c40654` | Shared realtime client (`use-realtime-channel.ts`), Pusher on the kitchen screens with a 30 s polling floor when it is unconfigured, and the `UsageEvent` client. |
| 19 | **`e871cf4`** | **Lint enforcement, dead-primitive deletion, CI gates and this record** — see below. |

Backend commits that carried P4 API work but were merged under a P5a heading: `957396a` / `a853338`
(`p5a-17`) also wired `UsageEvent` recording on the staff customers surface.

---

## Task 19 — what was deleted, and the proof

Every deletion was preceded by a grep over `app components lib` for both the import path and the
component name. Nothing was deleted on the strength of the plan's list alone — three files the plan
named as survivors turned out to be dead, and one it named for deletion turned out to be live.

**Deleted — 12 Magic-UI primitives** (zero importers each; the grep excluded the file itself):
`blur-fade`, `magic-card`, `shimmer-button`, `shine-border`, `pulsating-button`,
`interactive-hover-button`, `animated-list`, `avatar-circles`, `animated-circular-progress-bar`,
`text-animate`, `hyper-text`, `cool-mode`. `components/ui/` goes 44 → 32 files.

**Kept, with the count that saved them:**

| Primitive | Importers | Why it stays |
|---|---|---|
| `border-beam.tsx` | 2 | `KdsOrderCard`, `PickAndPackOrderCard` — the "new order" beam SPEC §6.4 explicitly allows |
| `number-ticker.tsx` | 12 | readiness rings, XP chip, mission/quest progress, procurement + inventory dashboards |
| `confetti.tsx` | 1 | `LevelUpCelebration` |
| `animated-theme-toggler.tsx` | 1 | `AppHeader` |

**Deleted — orphans the IA waves left behind** (all zero-importer, confirmed by a whole-tree grep
that ignored each file's own definition):

| File | Orphaned by |
|---|---|
| `components/ops/Sidebar.tsx` (8-line shim) | Task 12 — `SpineNav` replaced it |
| `components/ops/AdminUserFilter.tsx` | Task 14 |
| `components/ops/dashboard/AdminBlockersWidget.tsx` | Task 14 — Mission Control's Action Required panel absorbed it. **The brief asked to verify whether Mission Control now uses it: it does not.** |
| `components/ops/dashboard/AdminPendingApprovalsWidget.tsx` | Task 14 |
| `components/ops/dashboard/AdminRecentDecisionsWidget.tsx` | Task 14 |
| `components/ops/dashboard/DashboardReadinessStrip.tsx` | Task 14 |
| `components/ops/evidence/EvidenceList.tsx` | Task 16 — **not on the plan's list**; found by a whole-tree orphan sweep. `EvidenceSection` renders `EvidenceItem` directly now. |

**Kept against the brief's suspicion:** `DashboardLowStockAlert` (imported by
`app/(ops)/operations/inventory/dashboard/page.tsx`) and `DashboardLeaderboardPreview` (imported by
`IntelligencePanel`). Both live.

**Deleted — dead constants:**
- The whole `@deprecated` block in `lib/brand-colors.ts` (`GRADIENT_*`, `ORB_GLOW_*`, `SHIMMER_*`,
  `SHINE_COLOR`, `PULSE_COLOR`). Every consumer was one of the twelve primitives above, so the block
  and its call sites died together. `BEAM_FROM` / `BEAM_TO` remain — they are prop values, not
  classes, which is why they may not live in `tokens.css`.
- The `STATUS_BADGE` colour-named aliases `amber` / `blue` / `green` / `red` — zero references.

**Storefront orphans left alone, deliberately:** `components/public/EventBookingForm.tsx` and
`components/public/ProductPublicCard.tsx` are also unimported, but Phase 34 rewrites the storefront
wholesale and may want them as a starting point. Recorded here rather than deleted.

---

## Task 19 — the lint rules, and what they caught

`frontend/eslint-rules/no-raw-colors.mjs` is a local flat-config fragment; no new dependency, no
plugin authored. It exports three rule sets, wired into `frontend/eslint.config.mjs` as three
`files`-scoped blocks.

| Rule | Level | Scope |
|---|---|---|
| `no-restricted-syntax` — raw colour (`Literal` + `TemplateElement` selectors) | **error** | `app/(ops)/**`, `components/ops/**`, `components/ui/**`, `lib/**` |
| the same, at warn | warn | `app/(public)/**`, `components/public/**`, `app/(auth)/**` |
| the same, off | off | `app/page.tsx`, `components/public/ScrollVideoStory.tsx` (frozen) |
| `no-restricted-imports` — the 12 banned primitives, `framer-motion`, runtime `shadcn`, `components/spectrumui/**`, `components/patterns/**` | **error** | the four P4-owned slices |
| `@typescript-eslint/no-explicit-any` | **error** (was warn globally) | the four P4-owned slices |

**Deviation from the plan text, deliberate:** the plan's regex guard was `(?:^|\s)`, which misses
every variant-prefixed class — `hover:bg-red-500` would have passed. The shipped guard is
`(?:^|[\s:])`. The plan's escaping (`\\\\s` in a JS string, i.e. a literal backslash) would also not
have matched whitespace at all; the shipped file uses `\\s`.

**Regression check** (added to `components/ops/ProgressRing.tsx`, run, reverted):

| Probe | Caught |
|---|---|
| `"bg-red-500"` | ✅ |
| `"hover:text-blue-400"` (variant prefix — the plan's regex would have missed this) | ✅ |
| `"#c2410c"` (bare hex) | ✅ |
| `` `p-2 bg-[#fff]` `` (template chunk) | ✅ |
| `import { BlurFade } from '@/components/ui/blur-fade'` | ✅ |

**What the new errors surfaced — this is the point of the task.** 11 errors on first run, all real:

| Where | What | Fix |
|---|---|---|
| `lib/types/purchase-order.ts:13–15` | `PO_STATUS_BADGE_CLASSES` held `bg-blue-500/15 text-blue-400`, `bg-green-500/15`, `bg-red-500/15`. **Two live call sites.** The Wave 1 sweeps partitioned `app/` and `components/` by directory and never covered `lib/types/**` — this is a real gap the rule closed. | re-pointed at `STATUS_BADGE.{neutral,info,good,muted}` |
| `lib/types/nodes.ts:25–27` | `NODE_STATUS_BADGE_CLASSES`, same raw palette, zero call sites — while `NodeSettingsForm` carried a *private, already-tokenised* duplicate | re-tokenised in `nodes.ts`; `NodeSettingsForm`'s copy deleted and the import re-pointed, so the mapping exists once |
| `components/ui/magic-card.tsx:87`, `lib/brand-colors.ts:36` (`SHIMMER_COLOR = '#ffffff'`) | bare hex | deleted with their files |
| `components/ops/guide/DynamicIcon.tsx:10` | `Record<string, any>` over the lucide namespace | a narrow `IconLike` component type |
| `components/ops/guide/GuideCalloutBlock.tsx:84` | `HTMLAttributes: Record<string, any>` | `Record<string, unknown>` |
| `lib/types/customer-auth.ts:20` | `booking?: any` | `booking?: unknown` (no consumer reads it) |

The storefront warn-level slice reports **0 warnings** — sweep D (`96794ca`) genuinely cleared the
colour debt there. The only surviving raw colours in the tree are the 16 in the two frozen homepage
files, which are permanently exempt by path.

### `module-routes.ts` re-pointed at the spine

`components/ops/admin/module-routes.ts` shipped with a TODO saying `MODULE_ROUTES` and
`PRIMARY_MODULE_KEYS` "should be derived from `lib/nav/spine.ts` once it lands". Task 19 did it:
both are now folded out of `SPINE_PRIMARY` + `SPINE_GROUPS` + `HEADER_MODULES` (first entry wins per
module key), with a single documented override — `kds`, because the Kitchen group opens on "Kitchen
Overview" and first-wins would otherwise point the `kds` key away from the KDS screen. **The derived
map was diffed against the hand-written one and is identical across all 42 keys.** The label
overrides and `sort_order` bands stay local — they are editor presentation, not navigation.

### QA-04, backend half

17 `console.*` calls across eight services moved to the Nest `Logger`, following the house convention
already used in `email.service.ts` (`logger.error(message, err instanceof Error ? err.stack :
String(err))`). Seven services gained `private readonly logger = new Logger(X.name)`;
`webhooks.service.ts` already had one. `customer-auth.service.spec.ts` had the one test that spied on
`console.log`; it now spies on `Logger.prototype.log`. `backend/eslint.config.mjs` gains
`no-console: error` for `src/**/*.service.ts`.

### CI (`.github/workflows/ci.yml`)

| Job | Step added / changed |
|---|---|
| backend | `! grep -rn "console\." src --include=*.service.ts` |
| frontend | `npm run lint` → `npx eslint . --max-warnings 80` |
| frontend | Motion allowlist — the 12 banned component names must not appear in `app` or `components` |
| frontend | Polling floor — no sub-30 s `refetchInterval`, no `refetchIntervalInBackground` |
| frontend | One token file — no `--public-*` block outside `app/tokens.css` |

All four greps were run by hand against the tree before being committed; all four pass.

**Deviation:** the plan specified `--max-warnings 500`. The tree sits at 60, so 500 could never fire.
The ceiling shipped at **80** — real headroom, but an actual ratchet. Phase 34 lowers it again.

---

## Task 19 — the walk-through

Run against the **local** stack: backend `PORT=4022 node dist/src/main.js` on the seeded Docker
Postgres (`konma-postgres`, port 5433), `npx next start -p 3022` off the production build. Both
processes were killed afterwards; both ports confirmed free.

`POST /auth/login` is throttled to 5 attempts per 5 minutes per IP and returns the JWT **only** in an
httpOnly `access_token` cookie, so the walk-through ran in batches with a backend restart between
them (the throttler store is in-memory).

### A. Route gating, logged out

| Route | Result |
|---|---|
| `/` | 200 |
| `/team` | 200 — the rewritten login form, exactly as Decision 3 intends |
| `/sign-in` | 200 |
| `/dashboard` · `/tasks` · `/quests` · `/readiness` · `/approvals` · `/decisions` · `/boards/evidence` · `/admin/modules` · `/admin/node` · `/guide` | 307 → `/team?redirect=<encoded path>` |

The frozen homepage's three `/team` links keep working and the URL the user sees never changes.
**Sign-off item 1 holds.**

### B. Per role, authenticated

All eight seeded roles logged in and fetched all 11 routes: **every route returned 200 for every
role.** That is the edge middleware's answer — `proxy.ts` gates on the cookie, not on permissions.

**An honest limitation, recorded rather than glossed:** the ops shell is client-rendered. The
server sends a 26 KB auth-gate document containing a loading spinner and the RSC payload; the header,
the spine and the panels mount on the client after `useAuth` resolves. The HTML is byte-identical
across roles, so `curl` **cannot** read the per-role nav out of it, and `/admin/modules` returning 200
to `BI_LEAD` at the HTTP level says nothing about whether the screen renders for them.

So the role-scoping was verified where it is actually decided: `GET /modules/mine` per role, fed
through the same pure `buildSpine()` filter the client runs (the fixed structure parsed straight out
of `lib/nav/spine.ts`, which is `buildSpine`'s only other input).

| Role | `ModuleAccess` keys | Spine primary | Groups rendered | `/approvals?mine=1` |
|---|---|---|---|---|
| FOUNDER_ADMIN | 47 | 8 / 8 | Kitchen (8) · Procurement (5) · Commerce (3) · Catalog & Experiences (4) · Intelligence (4) · Admin (11) | 200 |
| TECH_LEAD | 46 | 8 / 8 | same six groups | 200 |
| FRONTEND_LEAD | 28 | 8 / 8 | Kitchen (8) · Commerce (3) · Catalog & Experiences (4) | 200 |
| BACKEND_LEAD | 21 | 8 / 8 | Kitchen (8) · Procurement (5) | 200 |
| PROCUREMENT_LEAD | 21 | 8 / 8 | Kitchen (8) · Procurement (5) | 200 |
| DESIGN_OUTREACH_LEAD | 14 | 7 / 8 (no Approvals) | Catalog & Experiences (4) | 403 |
| BI_LEAD | 13 | 7 / 8 (no Approvals) | Intelligence (4) | 403 |
| TALENT_LEAD | 10 | 7 / 8 (no Approvals) | **none** | 403 |

This is the behaviour SPEC §6.3 asks for, and it matches the plan's own role-scoping check
("TALENT_LEAD sees no groups") exactly. Guide and Chat resolve to the header for all eight roles —
never into the spine — so no label appears twice.

The three roles without the `approvals` key get a **403** from `/approvals?mine=1&status=pending`,
which exercises the `optionalGet` degrade path (403 → `null`, no crash, no unresolved spinner) on a live
403 rather than a mocked one.

`GET /me/header` returned 200 for all eight roles with a consistent 13-key payload:
`user · role · node · module_keys · mission · quest · readiness_percent · approvals_waiting ·
notifications_unread · my_blockers · xp_total · level · can_create_mission`.
Values observed: mission `"P3 Smoke Mission"`, quest `null` (empty-state CTA path),
`readiness_percent` 21, `approvals_waiting` 0–4 by role.

### C. End-to-end pass (SPEC §10)

`/tasks` → filter → create → evidence from the row → inline approve → header badge, exercised
against the running API:

| Step | Result |
|---|---|
| `GET /tasks?mine=1&status=todo&limit=5` as BACKEND_LEAD | 200, `{items, next_cursor, has_more}` |
| `GET /tasks?mine=1` (no cursor/limit) | 200, **bare array** — the legacy shape the six existing callers depend on survives |
| `POST /tasks` as BACKEND_LEAD | **403 `Missing permission: CREATE_ADHOC_TASK`** — correct RBAC; ad-hoc injection is the founder's |
| `POST /tasks` as FOUNDER_ADMIN, `owner_user_id` = the lead | 201, `status=todo` |
| `POST /tasks/:id/evidence` as BACKEND_LEAD (the row-level button) | 201 |
| `GET /approvals?mine=1&status=pending` as FOUNDER_ADMIN | 200, 3 pending, `entity_type=task` |
| `POST /approvals/:id/decide {decision:'approve', note}` | 201 |
| `POST /approvals/:id/decide {decision:'reject'}` with **no** note | **400** — SPEC §6.4's required note is enforced server-side |
| header badge after the decision | `approvals_waiting` 4 → 3, then 3 → 2 across runs — **the badge decrements** |
| `POST /usage` | 202 |
| `GET /usage/summary` (admin) | 200 — `by_role` and `by_path`, with `/tasks` climbing 3 → 4 as the events landed |
| `GET /search?q=walk` | 200 — found the task created seconds earlier (`tasks=1`) |
| `GET /search?q=Smoke` | 200 — `tasks=4, recipes=1` across buckets `tasks · products · recipes · guides` |

**Not verified, and not claimed:** the visual half of SPEC §10 — per-role spine rendering in the
browser, the header crumb on screen, the Mission Control vs My Day split, the readiness ring
animating, both themes, 360 px and 1440 px. That needs a browser; the ops shell's client-side render
puts it out of `curl`'s reach. It is carried forward as the first item under "Outstanding" below.

---

## Deviations from the plan, wave by wave

Recorded because the merged code is ground truth where it differs from the plan text.

1. **`/team` is a rewrite, not a redirect** (Decision 3, sign-off item 1 — taken as written). The
   staff login form moved to `app/(auth)/sign-in/page.tsx`; `proxy.ts` rewrites `/team` → `/sign-in`
   when there is no valid staff cookie. The frozen homepage's three `/team` links, `lib/auth.ts`,
   `lib/api-client.ts` and `app/(ops)/layout.tsx` were all left untouched. Verified above: `/team`
   200 logged out, and the Team hub for authenticated staff.
2. **`--accent` (CSS variable) is brand terracotta; `accent` (Tailwind utility) is a hover surface**
   (sign-off item 2 — taken as written). shadcn's `--accent` is retargeted to `--ui-accent` =
   `--surface-raised` and mapped through `@theme inline { --color-accent: var(--ui-accent) }`, so
   `hover:bg-accent` stays a tint. Brand is `bg-brand` / `bg-primary`. This is what let 279
   components become terracotta by changing values, not names.
3. **Leaderboard folded into `/team`.** `/leaderboard`, `/team-contribution` and `/activity` survive
   as routes but leave the spine; `TeamTabs` renders wins · contribution · activity · leaderboard ·
   directory. Listing Leaderboard under Intelligence would also have given every role a one-item
   Intelligence group, contradicting the role-scoping check.
4. **`/me/header` returns a superset of the plan's shape.** 13 keys, including `module_keys` (so the
   spine and the header come from one round trip), `notifications_unread` and `can_create_mission`
   (which drives the never-null CTA). No consumer was broken; the extra keys are additive.
5. **The chips needed backend include enrichments.** Task 17's frontend work exposed that
   evidence, purchase-order and task payloads did not carry enough lineage to render "Quest › Task"
   or the meter chip. `54c50f7` extended those includes — a backend change inside a frontend wave,
   noted here because it is not in the plan's file list.
6. **Usage actions are wired at six call sites**, not just page views: `ModuleAccessEditor`,
   `ExportDialog`, `KdsBoard`, `UsageTracker`, `/admin/import/[type]`, `/pos`.
7. **`AdminAdHocInjectorWidget` was deleted, not repaired** (Decision 15). It posted a body that
   could never validate — no `mission_id`, `domain`, `owner_user_id` or `priority`, plus unknown
   `assigned_to`/`status`. Task 14 replaced it with a button that opens the existing
   `AdHocTaskSheet`. The walk-through above confirms the shape the sheet posts is the one
   `CreateTaskDto` accepts.
8. **Sweep D's storefront debt is smaller than the plan assumed.** `96794ca` cleared the colour debt
   in `app/(public)`, `components/public` and `app/(auth)` outright — the warn-level rule reports 0
   there today, not the ~34 the plan predicted. The storefront work Phase 34 inherits is the broken
   **purchase flow** (`use-cart.ts` posting an empty body to `POST /customer/orders`, which now needs
   `{ quote_id }`), not colour.
9. **`components/ops/evidence/EvidenceList.tsx` deleted** — an orphan the plan did not list, found by
   a whole-tree sweep rather than by following the list.
10. **`no-console` in CI is a grep as well as a lint rule.** The lint rule is scoped to
    `*.service.ts`; the CI grep is the same scope, so a config regression cannot silently disarm it.

---

## Gates

**Frontend, at `e871cf4`:**

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | **0 errors, 60 warnings** (was 0 / 64 before Task 19 — the 3 `any`s became errors and were fixed, and one `no-img-element` warning left with a deleted file) |
| `npx eslint . --max-warnings 80` (the CI form) | exit 0 |
| `npm run build` | compiled; 79 route files, 298 components, `components/ui/` 44 → 32 |
| Motion-allowlist grep | no hits |
| Polling-floor grep | no hits (every interval is 30 s or 60 s, or `live ? false : POLL_FLOOR_MS`) |
| One-token-file grep | only `app/tokens.css` |

Remaining 60 warnings, unchanged in kind from the pre-P4 baseline: `no-unused-vars` 20,
`react-hooks/set-state-in-effect` 14, `react-hooks/refs` 9, `@next/next/no-img-element` 5,
`react-hooks/purity` 5, `exhaustive-deps` 4, `incompatible-library` 2, `no-unused-expressions` 1.

**Backend, at `e871cf4`:**

| Gate | Result |
|---|---|
| `npm run lint:check` | 0 errors (4026 prettier/type-unsafety warnings — the pre-existing baseline) |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx jest --silent` | **102 suites, 1549 passed + 26 todo, 0 failed** |
| `grep -rn "console\." src --include=*.service.ts` | no output |

**Migration:** `20260826000000_p4_role_aware_ia` (`UsageEvent` + `UsageEventType`), additive, applied
to the local Postgres. Phase 33's `20260826120000_p5a_marketplace_backend` picked a later timestamp;
both are additive so replay order does not matter.

---

## Outstanding

1. **The visual walk-through** — per-role spine, header crumb, Mission Control vs My Day, both
   themes, 360 px and 1440 px. `curl` cannot reach it through the client-rendered ops shell. This is
   `QA-03` (Playwright on a built preview), which Phase 31's record already moved into this phase;
   it did not ship here and moves to Phase 34, where the storefront needs the same harness.
2. **Per-route permission gating is client-side.** `proxy.ts` checks only that a staff cookie is
   valid, so `/admin/modules` and `/admin/node` return 200 at the HTTP layer for every authenticated
   role; the screens themselves gate on `MANAGE_SYSTEM`. The APIs behind them are properly guarded
   (`/approvals?mine=1` 403s for the three roles without the key), so this is a UX/defence-in-depth
   gap, not a data-exposure one. Worth closing in the same phase as (1).
3. **Admin usage dashboard over `UsageEvent`** → Phase 35 (`RUN-04`), as planned. P4 ships the model,
   the write path, `GET /usage/summary` and the client; the screen is explicitly out of scope.
4. **"Reset module access to seeded defaults"** — no backend route exists; recorded as a P6 candidate.
5. **Spine entries for `shipments`, `customers`, `reviews`, `promotions`** → Phase 34. Their
   `ModuleAccess` rows are seeded and `private-shipments` is declared in `realtime.channels.ts`, but
   the routes do not exist, so adding nav entries now would ship dead links (Decision 10).
   `talent` → v2.1 per SPEC §6.3's own annotation.
6. **`components/public/EventBookingForm.tsx` and `ProductPublicCard.tsx`** are unimported; Phase 34
   should either adopt or delete them.
7. **Chat keeps its own `use-pusher-channel.ts`** rather than migrating to `use-realtime-channel.ts`.
   Chat is not on the `IA-07` list and the migration carried regression risk for no gain (Task 18).

---

## Status

**Phase 32 (P4) is complete.** All 19 plan tasks are merged. The token file is the single source of
colour and both themes are defined; the spine renders from `ModuleAccess` and was verified per role
against live seeded data; `/tasks` is server-filtered and paginated without breaking its legacy
callers; sheets, inline approve/reject, evidence-from-the-row, lineage chips, Pusher and usage events
are in; and the rules that hold all of it together — raw colour, banned primitives, `any`, the motion
allowlist, the polling floor, the single token file and `no-console` — are now enforced by ESLint and
by CI rather than by convention.

Gates at `e871cf4`: frontend `tsc` clean · eslint **0 errors / 60 warnings** · build compiled ·
all four CI greps pass. Backend 102 suites · 1549 tests + 26 todo · `tsc` clean · 0 lint errors.

**Next:** Phase 34 (Marketplace Storefront + Staff Commerce, P5b). It inherits the storefront
purchase flow Phase 33 broke, the four spine entries deferred here, and the browser-based visual
harness both this phase and Phase 31 have now deferred twice.
