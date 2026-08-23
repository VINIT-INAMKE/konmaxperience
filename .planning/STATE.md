---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Mission OS + Marketplace
status: "Phase 31 (P3 mission bridge) complete pending the frontend gate re-run — Phases 32 and 33 next, in parallel"
stopped_at: P3 complete at 080a664 — migration 20260823180000_p3_mission_bridge applied, seeded, drift-gated and smoke-tested end to end; see .planning/phases/31-p3-mission-bridge/31-01-SUMMARY.md
last_updated: "2026-08-23"
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

Milestone: v2.0 Mission OS + Marketplace (Phases 29–35 on branch `v2-os-marketplace`)
Phase: 31 (Mission Bridge, P3) — **COMPLETE pending the frontend gate re-run** at `080a664` (record: `.planning/phases/31-p3-mission-bridge/31-01-SUMMARY.md`)
Next phases: 32 (Role-Aware IA + Identity, P4) and 33 (Marketplace Backend, P5a) — can proceed in parallel
Previous phase: 30 (Platform Foundation, P2) — complete at `fc49c19` (record: `.planning/phases/30-p2-platform-foundation/30-01-SUMMARY.md`)
Previous milestone: v1.1 complete 2026-03-27 (Phases 14–24, 27, 28 shipped; Phases 25 and 26 were never built — see ROADMAP.md notes)

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

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 29 must close all 14 Critical/High audit defects (FIX-01..14) before Phase 30 resets the schema; the DB is not deployed, so the reset is safe but nothing from v1 migrations survives.
- Shiprocket credentials (`SHIPROCKET_*`) are needed before Phase 33 integration tests can run against the sandbox.

## Session Continuity

Last session: 2026-08-23
Stopped at: Phase 31 (P3 mission bridge) complete at `080a664` — migration
`20260823180000_p3_mission_bridge` committed, applied to Postgres, seeded, drift-checked and smoke-tested
end to end against `dist/src/main.js`. Record: `.planning/phases/31-p3-mission-bridge/31-01-SUMMARY.md`
Resume file: None
Next action: `/gsd:plan-phase 32` and `/gsd:plan-phase 33` — they are independent and can run in parallel.

Carry into Phases 32/33:
- **Re-run the frontend gates on the merged tree** (`cd frontend && npx tsc --noEmit && npm run lint &&
  npm run build`). Tasks 15/16 were verified in their worktrees only.
- `QA-03` (Playwright smoke test 1) → **Phase 32**. The six-step flow is proven by the recorded curl smoke in
  the Phase 31 summary; only the browser automation moves.
- `QA-02` (Postgres-backed integration harness) → **Phase 33**. P3 delivers unit coverage plus the runtime
  smoke, so `QA-02` is partially met, not fully.
- Phase 33 also owns the deferred emitters (`shipment.status_changed`, `shipment.delivered`,
  `review.published`, `coupon.redeemed`, `booking.attended` — declared with `emitter: 'P5'` in
  `mission-bridge.rules.ts`, one `emitDomainEvent` call each) and swapping `Review` in for `Feedback.rating`
  behind the `ratingSource` seam in the `QUALITY` formula.
- Phase 32 owns `/admin/approval-policies`, the header approvals badge, the spine nav, `/tasks`, the Mission
  Control §6.5 layout, and the `Notification.is_email_sent` removal.
- **Decision 4 is a live behaviour change**: `requires_approval: true` with zero `Approval` rows now blocks
  validation. On a populated database, affected tasks stop being `valid` on their next cascade. No backfill was
  written.
- `PATCH /tasks/:id {"status":"done"}` does not re-run the validation cascade (pre-existing v1 behaviour;
  `evidence.service.ts:334` is the only validator and `TasksService` never calls it). Fixing it means crossing
  the `TasksModule ↔ EvidenceModule` edge P3 deliberately avoided.
- P2 deferred `Shipment*`/`Refund`/`Coupon*`/`Loyalty*`/`Review`/`UsageEvent` **models** to Phase 33 (P5);
  their enums and the `Order` money columns already exist. ROADMAP Phase 30 criterion 4 corrected accordingly.
- Six frontend follow-ups are listed at the end of the Phase 30 summary (variant selection UI, `purchase_orders`
  import type, `AdminAdHocInjectorWidget`, `OrderItem.fulfilment` derivation, explicit-UTC day filters,
  product media upload UI).
- Demo passwords were rotated during Phase 31 Task 17 — the current set is in the Phase 31 summary, §6.
