---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Mission OS + Marketplace
status: "Phase 35 (P6 Run-It Layer) COMPLETE at dce8180 — all 16 tasks merged, migrated, gated and runtime-smoked. **The v2.0 milestone (Mission OS + Marketplace, Phases 29–35) is COMPLETE.** Next milestone intentionally open; talent module parked for v2.1."
stopped_at: v2.0 complete. P6 complete at dce8180 — 16/16 tasks, migration 20260828000000_p6_run_it_layer applied, drift gate clean, live-stack smoke recorded; see .planning/phases/35-p6-run-it-layer/35-01-SUMMARY.md
last_updated: "2026-08-28"
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-22) and /SPEC.md (canonical v2.0 specification)

**Core value:** Every piece of work must be evidence-backed, approved, and validated before it counts -- turning real execution into measurable readiness and progress.

## Current Position

Milestone: **v2.0 Mission OS + Marketplace — COMPLETE 2026-08-28** (Phases 29–35 on branch `v2-os-marketplace`)
Phase: 35 (Run-It Layer, P6) — **COMPLETE** at `dce8180`
(record: `.planning/phases/35-p6-run-it-layer/35-01-SUMMARY.md`)
Current phase: **none — next milestone intentionally open.** The talent module is parked for v2.1 (the
SPEC spine carries a "no route" note against it, and nothing in v2.0 assumes it).
Previous phases: 34 (Storefront + Staff Commerce, P5b) at `6b82f7f`; 33 (Marketplace Backend, P5a) at `5a15e39`;
32 (Role-Aware IA + Identity, P4) at `e871cf4`; 31 (Mission Bridge, P3) at `080a664`;
30 (Platform Foundation, P2) at `fc49c19`
Previous milestone: v1.1 complete 2026-03-27 (Phases 14–24, 27, 28 shipped; Phases 25 and 26 were never built — see ROADMAP.md notes)

**Phase 35 (P6 Run-It Layer) is complete.** All 16 tasks of
`docs/superpowers/plans/2026-08-24-p6-run-it-layer.md` are merged at `dce8180` across five waves. W1:
`b7da851` (P6 schema — `DailyClose`, `EvidenceReviewSuggestion`, `User.phone`/`whatsapp_opt_in`, three
`NotificationType` members, the `notifications`/`ai`/`daily_close` setting blocks), `6885699` (unified
`ADVISORY_LOCK` registry with a **checked** `pg_advisory_unlock` release, nightly stock reconciliation
record-only, weekly R2 orphan sweep, `docs/R2-LIFECYCLE.md`), `8e29ac8` (heuristic-first `AiProviderPort` —
`AnthropicProvider` optional, degrades internally, **no API key needed to boot, test or ship**).
W2: `c2131c5` evidence assist (suggestion-only, boundary-guard enforced), `182195f` food cost
(theoretical-vs-actual, vendor-price valuation, unpriced ingredients reported not zero-costed), `108d4be`
daily close (compute/recompute/sign, versioned integer-paise metrics, 00:45 cron), `ab79518`
`NotificationDispatcher` (in_app always · email per settings · whatsapp behind enabled + opt-in + template +
quiet-hours, per-type cooldowns) with `Notification.is_email_sent` **retired end to end**, plus `117389b`
sibling registration and `173d88b` the dispatcher seam in the daily-close cron.
W3: `81a0e53` hourly staff-nudge sweep (blocked tasks, failed shipments with a 14-day lookback; approvals and
low-stock were already dispatcher-routed), `c707648` `GET /usage/summary`, `9d00c8c` 07:00 morning brief
(gathered from close/readiness/pending/shipments/low-stock, per-recipient delivery, 20 h cooldown), `cdae634`
gap closure, `8a2ae4b` spec-type fix.
W4: `14fc543` `/operations/daily-close`, `0e98987` `/intelligence/food-cost`, `82128a4` `/admin/usage` +
`usage` module key, `65d66f0` the human edges (`EvidenceAssistPanel` — structurally unable to touch the human
controls — `MorningBriefCard`, staff contactability incl. `PATCH /me/notification-prefs` with the
phone/opt-in invariant), `202320a` the nav gap T12 flagged (`daily_close` module key + Commerce spine entry).
W5: `dce8180` migration `20260828000000_p6_run_it_layer` (3 enum adds, the `is_email_sent` **DROP** — first
DROP since the P2 baseline — 2 tables, 2 hand-written CHECKs: `DailyClose_signed_has_signer`,
`EvidenceReviewSuggestion_verdict_check`), the `FRONTEND_LEAD` → `MANAGE_OPS` grant (the named daily-close
signer was 403-blocked; found by the smoke, not by review), and seed spec coverage.

**Task 13 closed four debts, three of them phases old**: `refund.failed` is handled (state re-derived by
**summing** surviving refunds, not reversing the failed one); `PATCH /tasks/:id` re-runs the validation
cascade **on every status change**, crossing the `TasksModule ↔ EvidenceModule` edge P3 avoided **via a
`TASK_VALIDATION_PORT`** that inverts the dependency (a module spec asserts the graph stays acyclic); all
nine catalog writes audit; the feedback bridge dispatch is keyed per order.

**Gates at `dce8180`:** backend **125 suites / 2023 tests** (1997 passed, 26 todo), 0 failures · **full**
`tsc --noEmit` clean (specs included — that is what `8a2ae4b` fixed; the build tsconfig excludes them) ·
0 lint errors · build green. Frontend `tsc` clean · `eslint .` 0 errors / **56 warnings** (ceiling 60) ·
build green, **85 routes**. `prisma migrate deploy` applied · drift gate `No difference detected.` ·
`seed:reference` green (8 roles, 49 modules, 14 settings).

**Runtime smoke (live stack, T16):** recompute 2026-08-27 → metrics v1, IST window, reconciliation 13
checked / 0 drifted · sign as `BI_LEAD` → **403** at the `MANAGE_OPS` gate · sign as `FRONTEND_LEAD` →
**201 signed** + `daily_close.signed` `AuditEvent` · re-sign → **409** · morning brief generate →
`provider: heuristic`, `delivered_to: 5`, headline "2026-08-27: 0 orders, 2 approvals waiting" · regenerate →
`delivered_to: 0` (cooldown) · evidence assist on pending evidence → verdict `unsure` / confidence 0.35 /
heuristic, **the evidence stays `pending`** · food cost → `currency_unit: paise`, theoretical ₹16,570.00 over
3 products, unpriced: Basmati Rice · usage summary → 3 roles incl. the synthetic `CUSTOMER`, dense 31-day
series · notification prefs → opt-in **forced off** when the phone is cleared · boot → **12 cron jobs**
registered including all five new ones.

**New debts recorded in P6** (none blocking): `GET /evidence?approval_status=` filter is a no-op; there is no
`GET /me/notification-prefs` (PATCH only); the phone pattern is 10–13 digits with **no `+`** (rejects E.164);
`CreateUserDialog` lacks the contact fields (`ContactNotificationsFields` is a pending drop-in);
`lib/types/settings.ts` should absorb the `notifications` block (typed locally in
`components/ops/admin/settings/notifications-setting.ts`); no personal notification-prefs UI consumes the
PATCH; there is no `/admin/audit` browser, so the daily-close drift drill-down points at
`/operations/inventory`; the retired `feedback_received_v1` bridge key means old `BridgeDispatch` rows no
longer dedupe a replay (harmless pre-launch); `mockAiResolver()` lacks `settings()` (specs layer it locally);
the Anthropic refusal fallback is local-only per plan decision 4.

### Prior position (Phase 34 record)

**Phase 34 (P5b) is complete.** All 20 tasks of
`docs/superpowers/plans/2026-08-24-p5b-storefront-staff-commerce.md` are merged. Tasks 1–12 and 14–19 landed
first at `b1d7fcd` (types/money/`ApiError` status, seven backend gaps fixed incl. the six `@Public()` customer
routes and cart-shrink, the real light pin + colour sweep + proxy hardening + staff spine entries, the
storefront shell, cart store v3 + `/cart`, `/shop` + `/shop/[category]` + `/search`, `/p/[slug]`,
`/experiences`, `/checkout` (quote → countdown → Razorpay → confirm), `/orders/[id]/track`, `/account/*` +
`/login` + `/profile` retirement + session context, and the six staff screens: Shipments, Promotions, Reviews,
Customers, Orders detail `/pos/orders/[id]` + refunds, Experiences attendance, Catalog variants + media).
The final two landed 2026-08-25: **T13 SEO** (`864da4b`, merge `dcdabd7`) and **T20 Playwright/CI**
(`d623af1`, merge `6b82f7f`).

T13 shipped `app/sitemap.ts` (21 URLs matching the live catalogue — 4 static + 5 categories + 10
non-experience products + 2 experiences, an experience listed only under `/experiences/[slug]`),
`app/robots.ts` (5 allows, 34 disallows, absolute sitemap pointer), `app/opengraph-image.tsx`, and the four
retired routes moved into `next.config.ts` as real **308**s (`/menu`→`/shop?type=prepared_food`,
`/events`→`/experiences`, `/events/:id`→`/experiences`, `/profile`→`/account`, all curl-verified). It also
fixed a load-bearing `proxy.ts` matcher hole — robots/sitemap/og-image were being 307-bounced to the staff
login, which made the whole feature inert — and deleted the four superseded route pages plus
`CategoryTabBar`/`MenuBrandTabs`/`ProductOrderCard`. T20 shipped `playwright.config.ts` (desktop 1440×900 +
Pixel 5, `workers: 1`, trace on-first-retry), `e2e/smoke-2-purchase.spec.ts` with real-OTP / Razorpay-stub /
signed-webhook fixtures, `e2e/README.md`, the `frontend-e2e` CI job, and the lint ratchet (P4's legacy warn
block dropped, error block widened to the whole customer surface, CI ceiling 80→60).

**Gates at `6b82f7f`:** frontend `tsc` clean · `eslint` 0 errors / 53 warnings (ceiling 60) · `next build`
83/83 static pages · **`npm run test:e2e` 3/3 passed on the merged tree**. Backend (counts include Phase 35
Wave 1): 111 suites / 1749 tests (1722 passed, 27 todo) · `tsc` clean · 0 lint errors · build green. P5b adds
no migration, so the drift gate stands where P5a left it.

Phase 35 Wave 1 (`b7da851`, `6885699`, `8e29ac8`) merged into this branch *before* P5b's final two tasks,
which is why the backend counts above are a merged-tree figure and not P5b's delta.

**Recorded debts carried out of Phase 34** (none blocking; `Notification.is_email_sent` was **discharged by
P6 Task 4 and dropped in the P6 migration**, the rest are still open): catalog availability `capacity` branch ignores live
holds (experiences pages read `/events/:id` instead — backend fix wanted); no `sort` param on
`GET /catalog/products` (CatalogSort caps at 200); `PUBLIC_INCLUDE` variants lack `stock_on_hand`;
`getOrderById` items lack the `event` relation (booking date on track page); `AccountLink` still does its own
profile GET (should use `loadCustomerProfile`); `use-cart.ts` header comment stale + redundant profile effect;
no staff receipt endpoint; no `PATCH /catalog/media/:id` (reorder = create-then-delete); no `order_id` filter on
`GET /shipments`; **`app/layout.tsx` hardcodes `metadataBase: https://konma.store` while `lib/seo/metadata.ts`
reads `NEXT_PUBLIC_SITE_URL`** (two sources of truth for one origin); **unknown routes 307-bounce to `/team`**
via the `proxy.ts` fallthrough (no real 404); **three soft-404s** (`/p|/shop|/experiences` with an unknown slug
return 200 bodies — all `noindex`ed, but the status-code fix needs proxy slug resolution); **sitemap cursor
pagination unexercised** by one-page seed data; ~~**`Notification.is_email_sent` drop deferred to P6 Task 4**~~
— **done 2026-08-28**: the column, its writes, its reads and the frontend field are gone, and the migration
carries the `DROP COLUMN`.

### Prior position (Phase 32/33 record)

P4 shipped all 19 tasks of `docs/superpowers/plans/2026-08-23-p4-role-aware-ia-identity.md`: one `app/tokens.css`
promoting the homepage's `--public-*` palette to a semantic layer plus a designed dark set and a 26-name shadcn
compat layer (so 279 components re-branded by changing values, not names), four mechanical sweeps onto those
tokens, the persistent `AppHeader` (mission crumb, readiness pill, approvals/blockers badges, XP chip, Cmd-K command
palette, notifications, theme, user), `lib/nav/spine.ts` rendering the SPEC 6.2 spine from `ModuleAccess` with
Guide and Chat in the header, `/tasks` (server-filtered kanban + list), `/quests?mine=1`, the `/team` hub that
absorbs wins/contribution/activity/leaderboard, `/admin/modules` and `/admin/node`, Mission Control (admin) and
My Day (everyone else), Task/Quest sheets with inline approve/reject and evidence from the task row, Quest-to-Task
lineage chips, Pusher on the kitchen screens with a 30 s polling floor, and `UsageEvent` page views plus six wired
key actions. One additive migration `20260826000000_p4_role_aware_ia` (`UsageEvent` + `UsageEventType`).

Task 19 made the rules mechanical: a local `eslint-rules/no-raw-colors.mjs` (no new dependency) errors on raw
colour, banned motion primitives and `any` across `app/(ops)`, `components/ops`, `components/ui` and `lib`, warns
on the storefront, and is off for the two frozen homepage files; 12 unused Magic-UI primitives, the `Sidebar` shim,
six orphaned dashboard widgets and the deprecated colour constants were deleted after grep-proving zero importers;
17 backend `console.*` calls moved to the Nest `Logger` with `no-console` enforced on services; and CI gained the
motion-allowlist, polling-floor, single-token-file and no-console greps plus `eslint . --max-warnings 80`.
The rules immediately caught a real gap the sweeps missed — `lib/types/purchase-order.ts` held raw palette classes
with two live call sites, because the sweeps partitioned `app/` and `components/` and never covered `lib/types/**`.

Gates at `e871cf4`: frontend `tsc --noEmit` clean, `eslint .` **0 errors / 60 warnings** (was 64), `next build`
compiled, all four CI greps pass; backend 102 suites / 1549 tests + 26 todo, `tsc` clean, 0 lint errors.
The eight-role walk-through ran against the local seeded stack (backend on 4022, `next start` on 3022): logged-out
routes redirect to `/team?redirect=`, `/team` serves the rewritten login form, and per-role `GET /modules/mine`
fed through `buildSpine()` gives 8/8 primary items and six groups for FOUNDER_ADMIN and TECH_LEAD down to 7/8 and
no groups for TALENT_LEAD. **The visual half of the SPEC 10 walk-through (both themes, 360/1440 px, on-screen
spine and crumb) is NOT done** — the ops shell is client-rendered, so `curl` cannot reach it; `QA-03` (Playwright
on a built preview) moves to Phase 34.

P5a shipped all 18 tasks of `docs/superpowers/plans/2026-08-23-p5a-marketplace-backend.md`: integer-paise money
helpers, the `ShippingProvider` interface with `ManualProvider` + `ShiprocketAdapter`, a 60-second-cached public
catalog with faceted `tsvector` search, server-priced carts, `POST /customer/checkout/quote` (coupon + loyalty +
shipping rate + tax breakup + 15-minute booking holds, stored as `quote:{customerId}:{quoteId}`), `POST /customer/orders`
taking a `quote_id`, `confirmPaidOrder` extended with `applyCommercialEffects` in the same Serializable transaction,
the shipments staff API, the shared-secret Shiprocket webhook, refunds with `refund.processed` reconciliation,
reviews with auto-publish and a rating rollup, loyalty earn/redeem/expiry, and the staff customers + usage surface.
One additive migration `20260826120000_p5a_marketplace_backend` (2 enums, 8 tables, 3 altered tables, zero DROPs)
plus hand-written triggers and six CHECK constraints. Gates at `5a15e39`: backend 102/102 suites · 1575 tests ·
tsc clean · 0 lint errors · build clean · drift gate `No difference detected.` · frontend tsc clean and `next build`
compiled.

~~The storefront purchase flow is broken until Phase 34 fixes it~~ — **resolved 2026-08-25 by Phase 34.**
`hooks/use-cart.ts` was rewritten around sync → quote → order → Razorpay → confirm, `variantId` became half a
cart line's identity in cart store v3 (`cartLineKey(productId, variantId)`, byte-identical to the key
`assertQuoteStillValid` builds), and the whole path is proven by the passing Playwright smoke.

P3 shipped all 17 tasks of `docs/superpowers/plans/2026-08-23-p3-mission-bridge.md`: the typed after-commit
domain-event catalogue (`common/events/domain-events.ts`), `MissionBridgeService` + `mission-bridge.rules.ts`
+ the `BridgeDispatch` exactly-once ledger, bridge evidence written as the seeded `SYSTEM` actor, four derived
meters as pure functions plus 50/50 hybrids, `ReadinessSignal`/`ReadinessSnapshot` finally consumed, the nightly
snapshot job under an advisory lock, the history + signals APIs, policy-generated `Approval` rows on tasks and
recipes with a validation cascade that now actually gates on them, and decision tiers with voting. One additive
migration `20260823180000_p3_mission_bridge` (enum + `BridgeDispatch` + 3 meter columns + 3 indexes, zero DROPs).
Gates at `080a664`: backend 75/75 suites · 974 tests · tsc clean · 0 lint errors · build clean · drift gate
`No difference detected.`

Frontend gates re-run on the merged tree (harness, 2026-08-23): `tsc --noEmit` clean · `eslint .` 0 errors /
67 warnings · `next build` compiled. Phase 31 is closed end to end.

P2 shipped all 16 tasks of `docs/superpowers/plans/2026-08-23-p2-platform-foundation.md`: 50 Prisma enums,
`Node` + `node_id` on 24 aggregates, `AuditEvent` + `AuditService`, `Task.subject`, `ApprovalPolicy`,
`DecisionVote`, readiness signals/snapshots, timestamptz(3)/Decimal precision, `Product`* replacing
`MenuItem`/`MenuCategory`, `ModuleAccess`, Json `SystemSetting.value`, `Node.timezone` replacing the hardcoded
IST offset, new seeds, and one baseline migration `20260823120000_p2_platform_foundation` (1,845 lines) with
hand-written CHECKs and search triggers. Gates: backend 60/60 suites · 603 tests · tsc clean · 0 lint errors ·
frontend tsc + build clean · drift gate `No difference detected.`

Canonical local `konma` database rebuilt 2026-08-23 from the single baseline (DROP/CREATE DATABASE via
docker psql, `prisma migrate deploy`, `seed:reference`, `seed:demo`); scratch `konma_p2_verify` dropped.
Drift gate against `konma_shadow`: `No difference detected.`

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.1)
- Average duration: -- (v1.0 avg ~6.5 min/plan across 56 plans)
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14. Foundation | 0/? | - | - |

**Recent Trend:**

- Last 5 plans (v1.0): Phase 13 P01 (11min), Phase 13 P02 (7min), Phase 13 P03 (8min)
- Trend: Stable

*Updated after each plan completion*
| Phase 14 P01 | 11min | 3 tasks | 9 files |
| Phase 14 P02 | 8min | 3 tasks | 9 files |
| Phase 15 P01 | 7min | 3 tasks | 10 files |
| Phase 15 P02 | 8min | 3 tasks | 9 files |
| Phase 16 P01 | 6min | 2 tasks | 8 files |
| Phase 16 P02 | 10min | 2 tasks | 7 files |
| Phase 17 P01 | 9min | 2 tasks | 10 files |
| Phase 17-03 P03 | 10min | 2 tasks | 1 files |
| Phase 17 P02 | 5min | 2 tasks | 7 files |
| Phase 18 P01 | 7min | 2 tasks | 11 files |
| Phase 18 P03 | 4min | 2 tasks | 5 files |
| Phase 18 P05 | 6min | 2 tasks | 6 files |
| Phase 18 P02 | 6min | 2 tasks | 5 files |
| Phase 18 P04 | 9min | 2 tasks | 10 files |
| Phase 18 P07 | 23min | 3 tasks | 22 files |
| Phase 21 P01 | 6min | 2 tasks | 14 files |
| Phase 21 P02 | 5min | 2 tasks | 3 files |
| Phase 21 P03 | 11min | 2 tasks | 12 files |
| Phase 21 P04 | 15min | 2 tasks | 13 files |
| Phase 19 P01 | 5min | 2 tasks | 11 files |
| Phase 19 P02 | 11min | 3 tasks | 16 files |
| Phase 19 P03 | 8min | 2 tasks | 5 files |
| Phase 20 P01 | 5min | 2 tasks | 7 files |
| Phase 20 P02 | 4min | 2 tasks | 5 files |
| Phase 20 P03 | 5min | 2 tasks | 6 files |
| Phase 20 P05 | 6min | 2 tasks | 3 files |
| Phase 20 P04 | 8min | 2 tasks | 3 files |
| Phase 22 P01 | 6min | 2 tasks | 4 files |
| Phase 22 P02 | 9min | 2 tasks | 6 files |
| Phase 22 P03 | 8min | 2 tasks | 6 files |
| Phase 22 P04 | 5min | 2 tasks | 4 files |
| Phase 23 P01 | 21min | 2 tasks | 19 files |
| Phase 23 P02 | 10min | 2 tasks | 11 files |
| Phase 23 P03 | 13min | 2 tasks | 13 files |
| Phase 23 P04 | 7min | 2 tasks | 16 files |
| Phase 23 P04 | 7 | 3 tasks | 16 files |
| Phase 24 P01 | 11min | 2 tasks | 16 files |
| Phase 24 P03 | 9min | 2 tasks | 15 files |
| Phase 24 P02 | 11min | 2 tasks | 10 files |
| Phase 24 P04 | 9min | 2 tasks | 5 files |
| Phase 27 P02 | 5min | 2 tasks | 4 files |
| Phase 27 P01 | 8min | 2 tasks | 11 files |
| Phase 27 P03 | 5min | 2 tasks | 6 files |
| Phase 27 P04 | 5min | 2 tasks | 5 files |
| Phase 28 P01 | 7min | 2 tasks | 8 files |
| Phase 28 P03 | 5min | 2 tasks | 8 files |
| Phase 28 P02 | 7min | 2 tasks | 5 files |
| Phase 28 P04 | 10min | 2 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.1 Research]: Content storage as String @db.Text (JSON-stringified Tiptap doc), not JSONB
- [v1.1 Research]: Tiptap v3 (3.20.x) for rich text editing, loaded via dynamic({ ssr: false })
- [v1.1 Research]: isomorphic-dompurify with jsdom pinned to 25.0.1 for XSS sanitization
- [v1.1 Research]: Reader view built BEFORE editor to validate backend filtering end-to-end
- [v1.1 Research]: MANAGE_GUIDE as single new permission; GuidesModule follows existing module pattern
- [Phase 14]: Used prisma migrate resolve for migration drift recovery instead of prisma migrate dev
- [Phase 14]: PresignGuideDto restricts contentType to image/jpeg, image/png, image/webp only
- [Phase 14]: DOMPurify default import works in NestJS with esModuleInterop: true
- [Phase 14]: 404 returned for inaccessible guide pages instead of 403 to prevent information disclosure
- [Phase 14]: Prisma has operator used for role_codes array membership filtering
- [Phase 15]: DynamicIcon extracted to shared component for Lucide icon name resolution across guide pages
- [Phase 15]: Guide section detail page reuses same TanStack Query cache key as index page for instant navigation
- [Phase 15]: GuideProseRenderer dynamically imported with ssr:false to prevent Tiptap SSR crash
- [Phase 15]: Two-query data fetching: shared sections cache + page-by-ID to avoid slug-based endpoint pitfall
- [Phase 15]: DOMPurify sanitizes generateHTML output before Tiptap editor content as defense-in-depth
- [Phase 16]: Sort-order reorder via Promise.all of two PATCH calls swapping adjacent sort_order values
- [Phase 16]: BubbleMenuPlugin registered programmatically via editor.registerPlugin (Tiptap v3 changed BubbleMenu from React component to Extension)
- [Phase 16]: GuideEditorClient fetches page data client-side via React Query (avoids auth cookie forwarding in SSR)
- [Phase 16]: Content hash uses SHA-256 of getHTML() not getJSON() for autosave (Tiptap v3 JSON is non-deterministic)
- [Phase 17]: Used prisma migrate resolve for migration drift (consistent with Phase 14 approach)
- [Phase 17]: tsvector search pattern: search_text column + trigger sync + GIN index + websearch_to_tsquery
- [Phase 17-03]: Tiptap JSON builder helpers (p, h2, h3, ul, ol, li, doc) for readable seed content generation
- [Phase 17-03]: Word-count read time (200 wpm) replacing JSON string length heuristic for accurate read estimates
- [Phase 17-02]: Admin detection via roleCode check (FOUNDER_ADMIN or TECH_LEAD) matching existing RBAC pattern
- [Phase 17-02]: Client-side section filtering for preview-as-role (no backend role-spoofing needed)
- [Phase 17-02]: Search trigger dispatches synthetic Cmd+K keydown event to reuse overlay keyboard listener
- [Phase 18]: Builder registry pattern: ExportsService holds Map<ReportType, ExportBuilder> for pluggable export builders
- [Phase 18]: Service-level permission check on /exports/generate because required permission varies by report type
- [Phase 18]: putObjectDirect on StorageService bypasses MIME whitelist for server-initiated R2 uploads
- [Phase 18]: VendorPricingExportBuilder uses direct PrismaService injection since VendorPrice has no dedicated service
- [Phase 18]: PO CSV export flattens parent fields onto every line item row for single flat file output
- [Phase 18]: Multi-sheet XLSX pattern: workbook.addWorksheet called per sheet, each with own columns
- [Phase 18]: Channel modifiers exported as global values (not per-item) since ChannelModifier model is global per channel_type
- [Phase 18]: EventGuestListsExportBuilder uses direct PrismaService injection for cross-entity EventBooking query
- [Phase 18]: LeaderboardExportBuilder injects PrismaService directly since LeaderboardService lacks export-suitable method
- [Phase 18]: findAllForExport reuses getOrders filter pattern but removes take/skip for full dataset export
- [Phase 18]: 4 separate analytics builder classes for single-responsibility; default 30-day date range fallback
- [Phase 18]: Buffer.from(arrayBuffer) pattern for ExcelJS writeBuffer to satisfy Node.js Buffer type requirements
- [Phase 18]: DecisionsService.findAllForExport added because findAll is paginated with take/skip
- [Phase 18]: RecipesExportBuilder multi-sheet: Recipes + BOM Lines per D-02 user constraint
- [Phase 18]: WasteService and RecipesService exported from their modules for ExportsModule DI access
- [Phase 18]: TooltipProvider delay prop (not Tooltip delay) for base-ui tooltip component API compatibility
- [Phase 18]: KDS export button placed in fullscreen top bar (no filter bar available)
- [Phase 18]: MANAGE_SYSTEM permission guard for Exports sidebar nav item
- [Phase 21]: PusherService uses graceful fallback (null pusher) when env vars missing, allowing app to start without Pusher for dev
- [Phase 21]: Admin/tech bypass checks role BEFORE participant membership in chat auth endpoint (per D-15, D-16)
- [Phase 21]: Duplicate direct conversation check uses Prisma AND filter with nested participants.some for both user IDs
- [Phase 21]: Message sending restricted to participants only - no admin bypass (D-18) - enforced in controller
- [Phase 21]: Cursor pagination fetches desc then reverses for chronological frontend display
- [Phase 21]: Pusher events update React Query cache directly via setQueryData for instant message UX
- [Phase 21]: Admin read-only determined by active tab state plus participant membership check
- [Phase 21]: Typing indicator uses 2s sender throttle and 3s receiver display timeout per Pusher best practices
- [Phase 21]: Pusher client uses customHandler (not default ajax transport) to forward cookies via credentials: 'include'
- [Phase 21]: Chat layout uses negative margins to break out of ops layout padding for full-height split panel
- [Phase 21]: DropdownMenuTrigger uses className directly (not asChild) since base-ui does not support asChild
- [Phase 21]: ConversationItem unread badge uses dot indicator instead of numeric count for simplicity
- [Phase 19]: MissionsExportBuilder and QuestsExportBuilder use MANAGE_KPIS permission matching tasks/decisions pattern
- [Phase 19]: Quest detail page uses tasks reportType since it displays quest task list (per D-25)
- [Phase 19]: IST timezone confirmed working via process.env.TZ in main.ts; XLSX date columns use numFmt styles
- [Phase 19]: @fast-csv/parse v5 uses parseString (not parse) for string input; ignoreEmpty replaces skipEmptyLines
- [Phase 19]: ImportsService uses PrismaService directly for create/update in transaction (not IngredientsService/VendorsService) to keep tx boundary clean
- [Phase 19]: Import validator pattern: pure async function taking (raw, rowIndex, prisma) returning ImportRow
- [Phase 19]: Multipart parse uses raw fetch with credentials:include (apiClient forces JSON Content-Type)
- [Phase 19]: Inline cell edit updates both raw and validated fields to keep commitImport data contract correct
- [Phase 19]: Local error clearing on inline edit (no re-parse API call) - server re-validates at commit time
- [Phase 20]: Recipe XLSX parser extracts parseSheet helper; transaction errors re-thrown for full rollback; new types get pass-through validation until Plan 03
- [Phase 20]: Opening stock has NO duplicate detection — stock is additive per D-08
- [Phase 20]: KPI blocked check triggers when existing current_value > 0 and new value differs per D-02
- [Phase 20]: Event duplicate detection uses title + date composite key; capacity/date blocked checks query booking count
- [Phase 20]: Recipe XLSX generates BOM Lines sheet between data sheet and instructions sheet per D-13
- [Phase 20]: Recipe BOM validator accepts optional recipeNameMap for cross-sheet FK resolution without DB lookup
- [Phase 20]: Menu item validator resolves brand BEFORE category for scoped category-within-brand lookup
- [Phase 20]: PrerequisiteData interface mirrors backend response for type-safe prerequisite checks on import index page
- [Phase 20]: Recipe grouped preview uses expandedRecipes Set state with collapsible BOM lines under parent recipe rows
- [Phase 20]: Stock import: no outer transaction, each inventoryService.adjust() independent with import reference tagging
- [Phase 20]: Recipe import: two-pass commit (headers then BOM) with two-level cycle detection and cost calc outside tx
- [Phase 22]: Status transition via ALLOWED_TRANSITIONS map replacing single if-check
- [Phase 22]: Approved recipes reject all data edits via Object.keys filter; createNewVersion archives in tx before cloning
- [Phase 22]: cost-data GET route declared before :id GET route to avoid NestJS route conflict
- [Phase 22]: base-ui Select onValueChange passes string|null -- coalesced to empty string with ?? operator
- [Phase 22]: Replaced entire [id]/page.tsx detail view with RecipeBuilderPage, removing RecipeWizard sidebar pattern
- [Phase 22]: calcLineCost exported from RecipeBomTable for reuse in RecipeBuilderPage client-side cost aggregation
- [Phase 22]: BomTableRow receives ingredientOptions/recipeOptions as props (not fetching internally) for single data source
- [Phase 22]: subRecipeLineMap added to RecipeBomTable props for sub-recipe expansion without extra API calls
- [Phase 22]: Approver gate uses roleCode === FOUNDER_ADMIN (no APPROVE_FOOD permission exists)
- [Phase 22]: RecipeCard Edit button removed -- entire card is Link to builder page
- [Phase 22]: Wizard components left as dead code in wizard/ directory for future cleanup
- [Phase 23]: HttpException with HttpStatus.TOO_MANY_REQUESTS since NestJS lacks TooManyRequestsException
- [Phase 23]: Dual-token JWT: type discriminator in payload, separate cookie names (access_token vs customer_access_token)
- [Phase 23]: Manual Prisma migration SQL + migrate deploy for non-interactive CI (consistent with Phase 14/17 approach)
- [Phase 23]: Module-level jest.mock for Razorpay constructor to prevent real SDK API calls in tests
- [Phase 23]: Raw body via verify callback (req.rawBody = buf) instead of bodyParser:false + getBodyParserOptions
- [Phase 23]: Webhook signature-first pattern: verify HMAC before dedup before routing
- [Phase 23]: Number(payment.amount) cast for Razorpay SDK fetchPayment return type compatibility with createRefund
- [Phase 23]: optionsRef pattern in useRazorpay to avoid stale closure in Razorpay callbacks
- [Phase 23]: Auto-verify OTP when 6 digits entered for faster UX (no extra button click needed)
- [Phase 23]: Cookie-based session detection in public layout for login/profile link (document.cookie check for instant render)
- [Phase 23]: optionsRef pattern in useRazorpay to avoid stale closure in Razorpay callbacks
- [Phase 23]: Auto-verify OTP when 6 digits entered for faster UX
- [Phase 23]: Cookie-based session detection in public layout for login/profile link (document.cookie check for instant render)
- [Phase 24]: UpdateAddressDto written manually (no @nestjs/mapped-types); KDS filters null zone_id for customer orders; Pusher channel: private-customer-{customerId}
- [Phase 24]: Cart sync on OTP verify is fire-and-forget (non-blocking) to avoid slowing login
- [Phase 24]: LIBRARIES array defined outside GooglePlacesInput component to prevent useJsApiLoader re-renders
- [Phase 24]: CartBottomSheet lazily fetches addresses and channel modifiers only when sheet opens
- [Phase 24]: Pending order stored in Redis with 30-min TTL keyed by Razorpay order ID for webhook fallback
- [Phase 24]: Serializable isolation for confirmOrder Prisma transaction; Pusher triggers fire-and-forget with .catch()
- [Phase 24]: Webhook marketplace handler uses inline Prisma tx; receipt route before :id route in controller
- [Phase 24]: No changes to useCustomerAuth needed -- customer.id already exposed for Pusher channel name
- [Phase 24]: Re-order fetches fresh /menu/items each time for up-to-date availability (no stale cache)
- [Phase 27]: Kept direct mission include alongside quest.mission on findOne for adhoc tasks with no quest
- [Phase 27]: PO update uses empty-string-to-null coalescion for linked_task_id clearing
- [Phase 27]: User model uses status field not is_active boolean -- adapted getContributions query accordingly
- [Phase 27]: date-fns installed for time scope calculations (startOfWeek, startOfMonth, subHours)
- [Phase 27]: GET /missions/mission-control route placed before GET /missions/:id to prevent NestJS param route conflict
- [Phase 27]: Breadcrumb shows full chain only when quest.mission data populated; falls back to simple back link for adhoc tasks
- [Phase 27]: Kanban meter name truncated at 12 chars with ellipsis to prevent badge overflow
- [Phase 27]: TodaysFocusSection uses owner_user_id (actual Prisma field) not assigned_to from existing TaskItem interface
- [Phase 27]: TodaysFocusSection receives allTasks as prop from existing query — no new API call needed (D-14)
- [Phase 28]: JwtAuthGuard omitted from controller since globally applied via APP_GUARD
- [Phase 28]: Old category String field kept nullable during migration for backward compatibility
- [Phase 28]: Controllers use RequiresPermission(Permission.MANAGE_KITCHEN) matching existing KDS/Waste pattern (JwtAuthGuard is global APP_GUARD)
- [Phase 28]: Supply usage controller uses @Req() express.Request pattern (matching WasteController) instead of @CurrentUser decorator
- [Phase 28]: No standalone pick-and-pack.module.ts or supply-usage.module.ts created -- direct registration in KitchenModule matches existing pattern
- [Phase 28]: OrdersService injected into CustomerOrdersService via OrdersModule import for deductItemIngredients reuse
- [Phase 28]: Non-scratch items auto-set to ready at order creation; deductBatchPrepared warns on insufficient stock instead of throwing
- [Phase 28]: RadioGroup built manually from base-ui primitives since shadcn registry was unreachable
- [Phase 28]: Card-style RadioGroup: sr-only RadioGroupItem inside styled label for accessible custom radio UI
- [Phase 28]: IngredientForm category validation relaxed (optional) since DB categories use UUID IDs

### Roadmap Evolution

- Phase 18 added: Data Export — CSV/XLSX export for 22 report types
- Phase 19 added: Master Data Import — ingredients, vendors, vendor pricing
- Phase 20 added: Operations Import — stock, recipes, menu, events, tasks, quests, KPIs
- Phase 21 added: In-App Chat — 1-1 and group messaging with Pusher.js, role-scoped visibility
- Phase 22 added: Recipe Page Redesign — full-page recipe builder replacing sidebar wizard
- Phase 23 added: Razorpay Payments + Customer Auth — OTP-based customer login, Razorpay integration for marketplace and POS
- Phase 24 added: Customer Marketplace — cart, checkout, takeaway/delivery ordering, checkpoint-based order tracking via Pusher
- Phase 25 added: Third-Party Delivery Integration — Porter for local overflow, Shiprocket for interstate shipping
- Phase 26 added: Order Detail Page — /orders/[id] with payment processing (QR + WhatsApp link), receipt download, order timeline
- Phase 27 added: Mission Flow & Assessment Gap Closure — aggregation API, ops-to-mission linking, dashboard widgets, UX flow improvements
- Phase 28 added: Recipe preparation_type — multi-fulfillment food product support (scratch, batch_prepared, ready_to_sell, assemble). Forked availability, deduction timing, KDS routing, pick & pack queue. 10 requirements scoped.
- 2026-08-22 audit: Phases 25 and 26 confirmed never built (no code, no plans). v1.1 closed as-is; their intent moves to v2.0 Phases 33/34.
- v2.0 opened 2026-08-22 from SPEC.md: Phase 29 Stop the Bleeding (P1), 30 Platform Foundation (P2), 31 Mission Bridge (P3), 32 Role-Aware IA + Identity (P4), 33 Marketplace Backend (P5a), 34 Marketplace Storefront + Staff Commerce (P5b), 35 Run-It Layer (P6). 89 requirements scoped.
- 2026-08-25: Phase 34 (P5b) complete at `6b82f7f` — 20/20 tasks. Phase 26's intent (a real staff order detail page) is now discharged by `/pos/orders/[id]`; Phase 25's remains superseded by Phase 33's `ShippingProvider`. The frontend gained its first automated test infrastructure (Playwright + the `frontend-e2e` CI job); there was none before.
- 2026-08-28: Phase 35 (P6 Run-It Layer) complete at `dce8180` — 16/16 tasks. **v2.0 (Mission OS + Marketplace, Phases 29–35) is COMPLETE.** Seven phases from a schema reset to a running node. Two structural firsts landed here: the P6 migration carries the **first `DROP COLUMN` since the P2 baseline** (`Notification.is_email_sent`), and `TASK_VALIDATION_PORT` breaks the `TasksModule ↔ EvidenceModule` cycle P3 deliberately avoided, so the validation cascade finally runs on every task status change.
- 2026-08-28: **Next milestone intentionally left open.** The talent module is parked for v2.1 — the SPEC spine carries a "no route" note against it and nothing in v2.0 was written assuming it. A v2.1 scope must not skip the two oldest deferrals: `QA-05`'s Postgres-backed integration harness (four phases deep, carried from Phase 31's `QA-02`) and `QA-03` (Playwright smoke 1 on the ops shell, never owned).

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 29 must close all 14 Critical/High audit defects (FIX-01..14) before Phase 30 resets the schema; the DB is not deployed, so the reset is safe but nothing from v1 migrations survives.
- ~~Shiprocket credentials (`SHIPROCKET_*`) are needed before Phase 33~~ — **resolved 2026-08-24**: P5a never
  required them. `SystemSetting['shipping'].provider` seeds `manual`, `SHIPROCKET_*` is validated only when the
  provider is `shiprocket` in production, and the whole shipment lifecycle was smoke-tested with the manual
  provider. Credentials are needed only to exercise the eight `ShiprocketAdapter` request/response shapes
  against the sandbox before the first production switch.
- The configured Upstash Redis host was unresolvable from the dev machine on 2026-08-24
  (`getaddrinfo ENOTFOUND present-pelican-68710.upstash.io`). Without Redis there is no OTP, cart, quote or
  pending-order key. The P5a smoke ran against a throwaway local `redis:8.6-alpine` container on port 6390.
- **Operator actions outstanding at v2.0 close (none doable from the repo, one of them gates CI and one gates
  a shipped feature):** submit the five Meta WhatsApp templates (`staff_approval_waiting`,
  `staff_task_blocked`, `staff_low_stock`, `staff_shipment_failed`, `staff_morning_brief`) **then flip
  `settings.notifications.whatsapp_enabled`** — until both are done the dispatcher's WhatsApp channel is
  correctly inert (master switch off, no template resolves) while in-app and email deliver regardless; create
  the R2 lifecycle rule `expire-exports-30d` per `docs/R2-LIFECYCLE.md` (a console action — the weekly orphan
  sweep is the code half and shipped in P6 Wave 1); set `NEXT_PUBLIC_R2_PUBLIC_URL` in production
  (`next.config.ts` otherwise degrades to the `cdn.konma.store` / `**.r2.dev` fallbacks); add the three
  Razorpay test-mode repository secrets `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`
  — the `frontend-e2e` job still fails at "Razorpay not configured" without them.

## Session Continuity

Last session: 2026-08-28
Stopped at: **v2.0 complete.** Phase 35 (P6 Run-It Layer) complete at `dce8180` — all 16 tasks merged across
five waves, migration `20260828000000_p6_run_it_layer` applied, drift gate `No difference detected.`, and an
eleven-step live-stack smoke recorded (403/201/409 on the daily-close sign, `provider: heuristic` on the
morning brief with no API key, evidence left `pending` by the assist). Record:
`.planning/phases/35-p6-run-it-layer/35-01-SUMMARY.md`
Post-close debt wave (2026-08-28, same day): the four plan-promised deferrals were closed — QA-03 ops smoke
(`a6b9617`), QA-05 integration harness (`cefb1b2`), the hold-vs-capture refuse-and-refund fix (`8f13497`),
and the P3 approval backfill (`0b4b99b`) — plus the two defects QA-03 surfaced (`91839f8`). Full gates and
both Playwright smokes re-run green on the merged tree. Everything still open below is either deliberately
descoped or an operator action; no development is queued.
Resume file: None
Next action: **none queued — the next milestone is intentionally open.** The talent module is parked for
v2.1 (SPEC spine "no route" note). Before scoping v2.1, read the deferrals below: two of them are four
phases old.

Deferrals that survive v2.0:
- ~~**`QA-05` second half — the Postgres-backed integration harness**~~ — **closed by the 2026-08-28 debt
  wave** (`cefb1b2`): `test/jest-integration.json` runs 8 transaction-level specs against a guarded
  `konma_test` database (Serializable confirm commit/rollback/replay/race, three DB CHECKs by name, the
  `BridgeDispatch` exactly-once ledger under concurrency), with a `backend-integration` CI job.
- ~~**`QA-03` (Playwright smoke test 1 — the ops shell)**~~ — **closed by the same wave** (`a6b9617`):
  `e2e/smoke-1-mission.spec.ts` walks login → task → evidence → both approval gates → meter +20, plus the
  stranger negative. It found two live defects, both fixed same-day in `91839f8`: `GET /tasks/:id` never
  projected `is_own` (a task's own author saw a read-only page — only admins could drive it), and note-type
  evidence could never save (`url` `@IsNotEmpty` rejected the form's empty string). CI hands the seeded staff
  passwords to the fixture via `E2E_STAFF_PASSWORDS` (same commit).
- **A fresh operator walk-through of the seven staff commerce screens** on a merged tree was NOT done. The
  storefront money path is proven by the passing Playwright smoke; the staff path (pack → AWB → pickup →
  label → courier webhook → delivered → review moderation → partial/full refund with loyalty clawback) was
  runtime-proved at the API layer by P5a's 51-request smoke and re-checked per screen by each P5b Wave-3 task
  agent at merge time. P6's smoke exercised the *new* operational surfaces, not P5b's commerce ones.
- ~~**The 15-minute hold vs the 30-minute pending order**~~ — **closed by the same wave** (`8f13497`): a
  capture arriving after the sweep now re-acquires the seat atomically inside the confirm transaction
  (hold-aware arithmetic, `order.booking_reacquired` audit); if any line cannot be re-seated the whole order
  is refused — a `cancelled` order row is written to hang the `paid` Payment on, a full auto-refund issues as
  the system actor (`refunded` end state), `order.refunded` fires on the customer channel, and the webhook
  answers 2xx with replay-safety in both branches. A gateway-refused refund keeps the row and writes
  `order.auto_refund_failed` for the order desk.
- **Soft-404 status codes** (`/p|/shop|/experiences` unknown slugs return `200` bodies, all `noindex`ed) and
  the **`metadataBase` vs `NEXT_PUBLIC_SITE_URL` split** in `app/layout.tsx` / `lib/seo/metadata.ts`.
- Shiprocket sandbox was never needed (`SystemSetting['shipping'].provider` seeds `manual`); the eight
  adapter request/response shapes remain the only surface untested against reality.
- `/admin/approval-policies`; `Order.zone_id` → `fulfilment_zone_id` rename; multi-shipment orders.
- ~~**P3 decision 4 still has no backfill**~~ — **closed by the same wave** (`0b4b99b`):
  `ApprovalPolicyService.backfillMissing` materialises the missing rows through the existing single writer
  and re-runs the validation cascade, audited per task (`task.approvals_backfilled`), idempotent, silent by
  construction. CLI: `npm run backfill:approvals` (`--dry-run` supported; exit 2 if anything was skipped).
  Proven live against the local DB with a torn-down fixture. Run it once on any pre-P3 production data
  **before** first real traffic.
- ~~`refund.failed` webhook reconciliation~~ — **closed by P6 Task 13** (`cdae634`); state is re-derived by
  summing surviving refunds, not by reversing the failed one.
- ~~`PATCH /tasks/:id {"status":"done"}` does not re-run the validation cascade~~ — **closed by P6 Task 13**
  via `TASK_VALIDATION_PORT`, which inverts the `TasksModule ↔ EvidenceModule` dependency P3 avoided; a module
  spec asserts the graph stays acyclic.
- ~~`Notification.is_email_sent` removal~~ — **closed by P6 Task 4 + the P6 migration's `DROP COLUMN`.**

Long-lived carry-forwards (recorded in the Phase 32 record, `e7ab01e`, and still open):
- P2 deferred `Shipment*`/`Refund`/`Coupon*`/`Loyalty*`/`Review`/`UsageEvent` **models** to Phase 33 (P5);
  their enums and the `Order` money columns already exist. ROADMAP Phase 30 criterion 4 corrected accordingly.
- Six frontend follow-ups are listed at the end of the Phase 30 summary (variant selection UI, `purchase_orders`
  import type, `AdminAdHocInjectorWidget`, `OrderItem.fulfilment` derivation, explicit-UTC day filters,
  product media upload UI).
- Demo passwords were rotated during Phase 31 Task 17 — the current set is in the Phase 31 summary, §6.
