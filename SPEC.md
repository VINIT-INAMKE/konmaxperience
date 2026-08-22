# Konma Xperience OS — Canonical Specification (v2.0)

**Status:** Canonical. Supersedes `contextdocs/`, `contextdocsv2/`, `contextdocsv3/` (now historical) and is the source `.planning/` documents sync to.
**Date:** 2026-08-22 · **Baseline commit:** `49086da` · **Branch:** `v2-os-marketplace`
**Audit this spec answers:** the end-to-end review published 2026-08-22 (identity problem, 14 Critical/High defects, test rot, shelf-ware).

---

## 0. One-paragraph definition

Konma Xperience OS is the operating system for a Konma node — today one 4,000 sq ft villa where **Konma Food** designs and standardises (R&D → recipe → SOP) and **Just Craves** executes and sells (kitchen → service → channels → shipped products → experiences). The system's job is to turn real operational work into **evidence-backed, approved, measured readiness**, and to sell what the node produces through one storefront. The loop that must hold every day: *what must I move today → I do the real work → the work itself becomes the proof → someone with skin in the game signs it off → a meter I care about moves.* Step three is automatic in v2; it was manual in v1, and that is why v1 felt like an ERP with a task tool beside it.

## 1. Goals, non-goals, constraints

### 1.1 Goals (v2.0)
1. **One system, not two.** Operational events produce mission evidence and readiness signals without re-typing. Approval gates execute. Four readiness meters are derived from ops state, with history.
2. **Every role lands on "what I must move today."** Persistent mission header, mission-spine navigation, a real `/tasks`, module visibility scoped per role.
3. **A full Konma-only storefront.** Prepared food (local), packaged products (shipped nationally via Shiprocket), experiences (capacity bookings), merchandise/art/lifestyle goods (tracked stock) — one catalog, one cart, one checkout, accounts, reviews, coupons, loyalty, search, desktop + SEO.
4. **No money or account is ever at risk from a known defect.** All 14 Critical/High findings fixed and regression-tested.
5. **A machine gates every change.** Green unit + integration + smoke tests in CI before deploy; no phase is "done" while red.
6. **Platform discipline now, platform later.** `Node` exists from day one; rules live in tables/settings, not constants; enums replace status strings.

### 1.2 Non-goals (explicitly out of v2.0)
- Multi-vendor sellers, commissions, payouts (Razorpay Route). Konma brands are the only sellers.
- Cash on delivery. Prepaid only.
- Multi-node *operation* (two live villas), cross-node federation or benchmarking. `node_id` is present; only one node is seeded.
- Native mobile apps. Web-first, responsive.
- Art/lifestyle *workflows* (studio R&D, residencies). Art and lifestyle **products** are sold; their production is not modelled.
- AI that approves evidence, assigns readiness values, sets prices, or is the primary UI.
- Replacing Razorpay, Pusher, MailerSend, R2, Neon, Railway, Vercel.

### 1.3 Constraints
- Stack fixed: NestJS 11 · Next.js 16 · React 19 · Prisma 6 · PostgreSQL (Neon) · Tailwind 4 · shadcn (base-ui) · npm. No Python, no Supabase, no monorepo tooling, no Prisma 7.
- Database is **not deployed**; v2 performs one schema reset with a fresh migration baseline and a new seed. No backfill migrations are required.
- The public homepage (`frontend/app/page.tsx` + `ScrollVideoStory`) is **kept as-is** visually; only performance and metadata may change. Its palette is the brand source of truth.
- Team: 8 internal roles (below). The 21-role model in `contextdocsv3/` is retired.

---

## 2. Actors and roles

| RoleCode | Person/function | Domain | Home screen |
|---|---|---|---|
| `FOUNDER_ADMIN` | Founder — strategy, escalation, override | all | Mission Control (admin) |
| `BACKEND_LEAD` | Food, production, R&D, standardisation, quality | food | My Tasks + Recipes + Kitchen |
| `FRONTEND_LEAD` | Service, customer flow, beverage, channels | food | My Tasks + Orders/POS + Feedback |
| `BI_LEAD` | Costing, pricing, KPIs, analytics | bi | My Tasks + Analytics + KPIs |
| `PROCUREMENT_LEAD` | Vendors, sourcing, inventory, receiving | procurement | My Tasks + Inventory + POs |
| `TALENT_LEAD` | Onboarding, training, hiring, team readiness | talent | My Tasks + Team |
| `TECH_LEAD` | Dashboard, automation, integrations, infra | tech | Mission Control (admin) + Settings |
| `DESIGN_OUTREACH_LEAD` | Brand, storytelling, events, partnerships | design | My Tasks + Catalog + Experiences |
| *Customer* | Public buyer (OTP identity) | — | Storefront |

Permissions (23, unchanged set) remain the authorisation primitive. **Module visibility** is a separate, data-driven layer (§6.3) so a role can hold `MANAGE_KITCHEN` without seeing six kitchen pages it never opens.

---

## 3. Domain model (target)

Conventions: all `DateTime` are `@db.Timestamptz(3)`; money is `Decimal @db.Decimal(12, 2)`; quantities `Decimal @db.Decimal(14, 4)`; every enum-like field is a **Prisma enum**; every aggregate carries `node_id`; every mutating write in a transaction also writes `AuditEvent`. Field names stay `snake_case` to match v1.

### 3.1 Platform
```
Node            { id, code @unique, name, timezone, currency, status: NodeStatus, created_at, updated_at }
AuditEvent      { id, node_id, entity_type, entity_id, action, actor_type: ActorType(user|customer|system), actor_id?, before Json?, after Json?, created_at }   @@index([entity_type, entity_id, created_at])
SystemSetting   { key @id, value Json, updated_at }          // JSON instead of string; keys allowlisted in code
ModuleAccess    { module_key @id, role_codes String[], enabled Boolean, sort_order }
```
`node_id` (FK → Node, required) is added to: Zone, Mission, Quest, Task, ReadinessMeter, Kpi, Recipe, Ingredient, Vendor, PurchaseOrder, PrepBatch, WasteLog, Order, Product, Event, Brand, Asset, Decision, Coupon, Shipment, Review. Customers, Users, Roles, IngredientCategory, UnitConversion, Guide*, Conversation* stay global. Unique constraints that become node-scoped: `ReadinessMeter (node_id, code)`, `ChannelModifier (node_id, channel)`, `Product (node_id, slug)`. `Order.order_number` stays a global sequence (display only).

### 3.2 Mission layer
```
Mission   { …v1…, node_id, phase: MissionPhase, scope: MissionScope, status: MissionStatus, created_by → User (FK added) }
Quest     { …v1…, node_id, status: QuestStatus }
Task      { …v1…, node_id, task_type: TaskType, domain: TaskDomain, status: TaskStatus, priority: TaskPriority,
            subject_type: TaskSubjectType?, subject_id: String?,            // what the task is about
            readiness_value Int (kept, task-driven meters only), updated_by → User? }
            @@index([subject_type, subject_id]) @@index([node_id, status, due_date])
Evidence  { …v1…, type: EvidenceType (image|document|video|link|note|system), source: EvidenceSource (manual|bridge),
            bridge_event: String?, approval_status: ApprovalStatus }
ApprovalPolicy { id, node_id, scope: ApprovalScope (task|decision|recipe|pricing|vendor|experience|tech|hiring),
                 domain: TaskDomain?, required_role_codes String[], min_approvals Int, mode: ApprovalMode (all|n_of), is_default }
Approval  { …v1…, entity_type: ApprovalEntityType (task|decision|recipe), entity_id, policy_id → ApprovalPolicy?,
            status: ApprovalStatus }   // Task FK removed; @@index([entity_type, entity_id]) retained
Decision  { …v1…, status: DecisionStatus (proposed|aligned|approved|rejected|reopened), tier: GovernanceTier (1|2|3),
            required_role_codes String[], linked_task_id?, linked_mission_id?, resolved_by?, resolved_at? }
DecisionVote { id, decision_id, user_id, role_code, vote: VoteValue (approve|reject|abstain), notes?, created_at  @@unique([decision_id, user_id]) }
ReadinessMeter   { …v1…, node_id, mode: MeterMode (task_driven|derived|hybrid), formula_key: String? }
TaskReadinessEvent (unchanged — task-driven contributions)
ReadinessSignal  { id, node_id, meter_id, source_event, source_type, source_id, value Decimal, created_at }   // ops-derived contributions ledger
ReadinessSnapshot{ id, node_id, meter_id, date @db.Date, value Decimal  @@unique([meter_id, date]) }
```
XP rules move to `SystemSetting['xp_rules'] = { core: 1.0, adhoc: 0.7, improvement: 0.8, level_curve: [...] }`.

### 3.3 Catalog and commerce
`MenuItem`/`MenuCategory` are **replaced** by `Product`/`ProductCategory`. POS, KDS, Pick & Pack, exports, imports and analytics read products.
```
ProductCategory { id, node_id, brand_id → Brand, name, slug, sort_order, product_types: ProductType[], status }
Product  { id, node_id, brand_id, category_id, type: ProductType (prepared_food|packaged|experience|merchandise),
           name, slug, description, story?, media ProductMedia[], base_price Decimal, tax_rate Decimal (GST %, inclusive pricing), hsn_code?,
           fulfilment: FulfilmentType (local|shipped|booking), stock_mode: StockMode (derived_from_recipe|tracked|capacity),
           recipe_id → Recipe?  (prepared_food, packaged),  event_id → Event? (experience),
           weight_grams Int?, dimensions_cm Json? (shipped), shelf_life_days Int?, is_featured, rating_avg Decimal?, rating_count Int @default(0), status: ProductStatus (draft|active|archived),
           search_text (tsvector via trigger), created_by, updated_by, created_at, updated_at }
           @@unique([node_id, slug]) @@index([node_id, type, status]) @@index([category_id])
ProductVariant { id, product_id, name ("500 g", "Large"), sku @unique, price_delta Decimal, stock_on_hand Decimal (tracked mode),
                 low_stock_threshold Decimal?, is_default, status }
ProductMedia   { id, product_id, url, alt, sort_order, kind: MediaKind (image|video) }
ChannelModifier{ …v1…, node_id, channel: OrderChannel }  @@unique([node_id, channel])
```
Availability per type (Phase 28 logic preserved): `prepared_food` → recipe preparation_type fork (scratch / batch_prepared / ready_to_sell / assemble); `packaged` → recipe `ready_to_sell` or `batch_prepared`; `merchandise` → `variant.stock_on_hand`; `experience` → `event.capacity − confirmed guests`.

```
Order     { …v1…, node_id (required), channel: OrderChannel (dine_in|takeaway|delivery|marketplace), status: OrderStatus
            (placed|confirmed|preparing|ready|served|dispatched|shipped|delivered|completed|cancelled|refunded),
            fulfilment_zone_id → Zone (required for any order that deducts stock), customer_id?, address snapshot Json? ,
            subtotal, discount_amount, coupon_id?, shipping_amount, tax_amount, total, loyalty_points_earned Int, loyalty_points_redeemed Int,
            idempotency_key @unique?, placed_via: OrderSource (pos|storefront|webhook_fallback), updated_by?, … }
OrderItem { …v1…, product_id → Product, variant_id → ProductVariant?, fulfilment: FulfilmentType, status: OrderItemStatus
            (pending|preparing|ready|packed|shipped|delivered|attended|cancelled), unit_price, tax_rate, event_booking_id → EventBooking? }
Payment   { …v1…, method: PaymentMethod, status: PaymentStatus (pending|paid|failed|refunded|partially_refunded),
            razorpay_payment_id @unique?, razorpay_order_id @unique?, refunded_amount Decimal }
Refund    { id, order_id, payment_id, amount, reason, razorpay_refund_id @unique?, status, requested_by, created_at }
Shipment  { id, node_id, order_id, provider: ShippingProvider (shiprocket|manual), provider_order_id?, provider_shipment_id?, awb?, courier_name?,
            status: ShipmentStatus (pending|awb_assigned|pickup_scheduled|picked_up|in_transit|out_for_delivery|delivered|rto|cancelled|failed),
            label_url?, tracking_url?, pickup_location_code, weight_grams, cost Decimal?, etd?, created_at, updated_at }
ShipmentEvent { id, shipment_id, status, raw Json, occurred_at, created_at }
Event     { …v1…, node_id, event_type: EventType, status: EventStatus (draft|upcoming|live|past|cancelled), starts_at, ends_at, product_id → Product? }
EventBooking { …v1…, status: BookingStatus (held|confirmed|cancelled|attended|no_show), order_item_id?, hold_expires_at? }
Coupon    { id, node_id, code @unique, type: CouponType (percent|fixed|free_shipping), value Decimal, min_order Decimal?, max_discount?, applies_to: ProductType[]?,
            starts_at, ends_at, usage_limit?, per_customer_limit?, status }
CouponRedemption { id, coupon_id, order_id, customer_id, amount, created_at  @@unique([coupon_id, order_id]) }
LoyaltyAccount { customer_id @id, points_balance Int, tier: LoyaltyTier (member|regular|insider), updated_at }
LoyaltyTransaction { id, customer_id, order_id?, delta Int, reason: LoyaltyReason (earn|redeem|adjust|expire), created_at }
Review    { id, node_id, product_id, customer_id, order_item_id @unique, rating Int, title?, body?, media String[], status: ReviewStatus (pending|published|hidden), created_at }
Customer  { …v1…, email?, default_address_id?, marketing_opt_in Boolean, last_seen_at }
```
Cart stays in Redis (`cart:{customer_id}`) with the v1 shape extended: `items[].productId, variantId?, fulfilment` ; a cart may mix fulfilment types.

### 3.4 Operations (changes only)
- `Recipe`: `parent_recipe_id → Recipe?`, `version Int @default(1)`, `status: RecipeStatus`, `preparation_type: PreparationType`, `node_id`.
- `RecipeLine`: CHECK `(input_type = 'ingredient') = (ingredient_id IS NOT NULL)` and `(input_type = 'recipe') = (source_recipe_id IS NOT NULL)`; `ingredient_id` onDelete **Restrict**; `RecipeLine → Recipe` onDelete Cascade.
- `Ingredient`: drop legacy `category` string; `usage_type: UsageType`; `node_id`.
- `IngredientStock`: CHECK `current_quantity >= 0`; nightly reconciliation job compares to `Σ StockMovement.quantity` and writes an `AuditEvent(action='stock.reconciliation_mismatch')` on drift.
- `StockMovement.movement_type: MovementType (purchase_received|prep_deducted|order_deducted|waste|adjustment|supply_usage|import|shipment_packed|return)`; `created_by` becomes `actor_type/actor_id` (system or customer orders are not Users).
- `PurchaseOrder.status: PurchaseOrderStatus`, `PrepBatch.status: PrepBatchStatus`, `WasteLog` XOR CHECK.
- `EventBooking → Event` onDelete **Restrict** when `status in (confirmed, attended)` (enforced in service; FK set to Restrict).
- `Notification.type: NotificationType`; `Notification.channel: NotificationChannel[] (in_app|email|whatsapp)`.

### 3.5 Removed
`MenuItem`, `MenuCategory` (replaced), `Ingredient.category` (legacy string), BullMQ remnants in `.env.example`, `Approval.task` relation, `frontend/components/spectrumui/`, `frontend/components/patterns/p-combobox-3.tsx`, duplicate `MissionCard`/`GuideSectionCard`, `framer-motion` dependency, `shadcn` as runtime dependency.

---

## 4. The mission ↔ operations contract

### 4.1 Domain events (after-commit, typed, one file: `backend/src/common/events/domain-events.ts`)
Existing: `order.placed`, `order.ready`, `delivery.updated`, `stock.low`, `task.blocked`.
New: `recipe.approved`, `recipe.archived`, `purchase_order.received`, `prep_batch.created`, `prep_batch.depleted`, `order.confirmed`, `order.served`, `order.delivered`, `shipment.status_changed`, `shipment.delivered`, `waste.logged`, `event.completed`, `booking.attended`, `feedback.received`, `review.published`, `product.published`, `vendor_price.updated`, `task.validated`, `approval.decided`, `decision.resolved`, `coupon.redeemed`.
Every emitter passes `{ node_id, actor, occurred_at, …payload }` and emits **only after the transaction commits**, inside try/catch (failure-isolated, as v1 already does).

### 4.2 MissionBridgeService (`backend/src/mission-bridge/`)
Subscribes to the ops events above. Rules live in `mission-bridge.rules.ts` (typed, reviewed in PRs), each rule declaring:
- **evidence**: if the source entity resolves to a task — via `PurchaseOrder.linked_task_id`, `Task.subject_type/subject_id` (recipe, product, event, vendor, purchase_order, prep_batch), or `Decision.linked_task_id` — create `Evidence{ type: system, source: bridge, bridge_event, url: deep link, notes: rendered template, uploaded_by: system user, approval_status: pending }`. Humans still approve; the bridge only removes re-typing.
- **signal**: write `ReadinessSignal{ meter_id, source_event, value }` per the rule; trigger derived-meter recompute for that meter.
- **task spawn** (optional): e.g. `feedback.received` with rating ≤ 2 → create `Task{ task_type: improvement, domain: food, owner: FRONTEND_LEAD, subject: order }` once per order.

### 4.3 Derived readiness (`backend/src/readiness/derivation/`)
`ReadinessMeter.mode = derived` meters are computed, never typed:

| Meter code | Formula (0–100) |
|---|---|
| `STANDARDIZATION` | % of active `prepared_food`/`packaged` products whose recipe is `approved` and has `computed_cost > 0` |
| `PROCUREMENT` | % of BOM ingredients (across approved recipes) that have an active `VendorPrice` **and** `IngredientStock ≥ min_quantity` |
| `SALES` | min(100, 25 × channels with ≥ 1 completed order in the trailing 7 days) + bonus for ≥ 10 orders/week |
| `QUALITY` | 100 − clamp(waste_cost / COGS trailing 7 days × 100 × 5) blended 50/50 with average review rating × 20 |

`hybrid` meters (e.g. `BACKEND`, `FRONTEND`) = 0.5 × task-driven + 0.5 × the mapped derived meter. Remaining meters (`VILLA`, `BI`, `TALENT`, `TECH`, `ART_EXPERIENCE`, `LIFESTYLE_EXPERIENCE`) stay `task_driven`. Recompute on relevant events and nightly; write `ReadinessSnapshot` daily; `GET /readiness-meters/:code/history?days=90`.

### 4.4 Approval policy and governance
- `ApprovalPolicy` seeded from the blueprint gates: food → `BACKEND_LEAD + FRONTEND_LEAD`; pricing → `BI_LEAD + FRONTEND_LEAD`; vendor → `PROCUREMENT_LEAD + BACKEND_LEAD`; experience → `FRONTEND_LEAD + DESIGN_OUTREACH_LEAD`; tech → `TECH_LEAD + FOUNDER_ADMIN`; hiring → `TALENT_LEAD + FOUNDER_ADMIN`; default → task owner's domain lead.
- On `Task` create/update with `requires_approval = true`, resolve the policy by `(scope=task, domain)` and create one `Approval` per required role (pending). The validation cascade requires every policy-generated approval approved (or overridden by `FOUNDER_ADMIN` with reason). Self-approval blocked; delegation honoured (v1 logic kept).
- `Recipe` approval (draft → pending → approved) creates `Approval{ entity_type: recipe }` rows from the `food` policy; the recipe flips to `approved` only when the rows are satisfied. The legacy direct status flip is removed.
- `Decision`: tier 1 (domain lead decides, auto-`approved` on creation by the domain lead); tier 2 (2+1: `required_role_codes` = two domain roles from `impact_scope` + one impacted role; status `aligned` when all `DecisionVote = approve`, then `approved`); tier 3 (`FOUNDER_ADMIN` resolves). Any reject → `rejected`; founder may `reopen`.

---

## 5. Commerce

### 5.1 Storefront routes (Next.js, server components with metadata unless noted)
`/` (existing homepage, untouched) · `/shop` · `/shop/[category]` · `/p/[slug]` · `/experiences` · `/experiences/[slug]` · `/search?q=` · `/cart` (client) · `/checkout` (client) · `/orders/[id]/track` · `/account` · `/account/orders` · `/account/addresses` · `/account/loyalty` · `/account/reviews` · `/feedback/[orderId]` · `/login`. Legacy `/menu` redirects to `/shop?type=prepared_food`. Desktop layouts are designed, not stretched; every page exports `generateMetadata`; images go through `next/image` (remote pattern for R2); JSON-LD `Product`/`Event` on detail pages; sitemap and robots.

### 5.2 Cart and checkout (single flow, mixed fulfilment)
1. **Cart** (Redis, server-priced on every sync): lines carry `productId, variantId?, quantity, fulfilment`. Server recomputes unit price (base + variant delta + channel modifier), availability per §3.3, and rejects lines that are unavailable.
2. **Serviceability** (`POST /customer/checkout/quote`): local lines need `deliveryAddress.pincode ∈ SystemSetting['delivery_pincodes']` or pickup; shipped lines need a Shiprocket serviceability + rate for `(pickup_pincode, dest_pincode, weight)`; booking lines need capacity (hold created with 15-minute `hold_expires_at`). Response: itemised subtotal, discount (coupon validated server-side), shipping, tax breakup, loyalty redeemable, total.
3. **Pay** (`POST /customer/orders`): creates Razorpay order for the quoted total, stores `pending_order:{rzp_order_id}` (30 min).
4. **Confirm** (`POST /customer/orders/confirm`) — idempotent: `GETDEL` the pending key inside a lock; verify HMAC; re-fetch payment; amount match; create `Order` + `Payment` in one Serializable transaction with `Payment.razorpay_payment_id @unique` (P2002 → return the existing order). Per line: local prepared-food → KDS/Pick & Pack routing by `preparation_type` (deduction via one `FulfilmentService`); shipped → item `packed` queue; booking → `EventBooking.status = confirmed`. Coupon redemption and loyalty earn/redeem written in the same transaction. Webhook `payment.captured` runs **the same** `FulfilmentService.confirmPaidOrder` so the fallback path cannot diverge.
5. **Fulfilment**: local → existing rider flow; shipped → staff "Pack" in Pick & Pack → `Shipment` created → `ShiprocketAdapter.createOrder → assignAwb → schedulePickup` → label printed → tracking webhook updates `Shipment.status` and `Order.status` (`shipped` → `delivered`) → customer Pusher event + WhatsApp template; booking → `attended`/`no_show` marked from the Events admin on the day.
6. **After delivery/attendance**: review invitation (WhatsApp + email), loyalty points credited, feedback page.
7. **Refunds**: staff action `POST /orders/:id/refund` (full/partial) → Razorpay refund → `Refund` row → webhook `refund.processed` reconciles status.

### 5.3 Shipping (`backend/src/shipping/`)
`ShippingProvider` interface: `checkServiceability(req)`, `createShipment(order, lines)`, `assignAwb(shipment)`, `schedulePickup(shipment)`, `getLabel(shipment)`, `track(awb)`, `cancel(shipment)`. `ShiprocketAdapter` implements it against `apiv2.shiprocket.in/v1/external`: `auth/login` (token cached in Redis ~9 days), `orders/create/adhoc`, `courier/serviceability`, `courier/assign/awb`, `courier/generate/pickup`, `courier/generate/label`, `track/awb/{awb}`, and an inbound tracking webhook (`POST /webhooks/shiprocket`, shared-secret header, idempotent on `(awb, status, occurred_at)`). `ManualProvider` lets staff paste an AWB/tracking URL. Pickup location code, default package dimensions and the provider choice live in `SystemSetting['shipping']`.

### 5.4 Promotions, loyalty, reviews, search
- Coupons: validated only server-side in the quote; stacking disallowed; `free_shipping` applies to shipped lines only.
- Loyalty: `SystemSetting['loyalty'] = { earn_rate_per_100: 5, redeem_value_per_point: 0.25, tiers }`; points earn on `delivered`/`attended`, expire after 365 days (nightly job).
- Reviews: one per `order_item` after `delivered`/`attended`; auto-published at rating ≥ 4, else `pending` for `FRONTEND_LEAD` moderation; aggregated `Product.rating_avg/count` maintained by trigger.
- Search: Postgres `tsvector` (`name || description || story || category || brand`) with GIN index and a trigger, the same pattern as guides; `GET /catalog/search?q=` with type/category facets.

### 5.5 Staff-side commerce screens
Catalog (products, variants, media, categories, publish), Promotions (coupons), Reviews moderation, Shipments queue (pack → AWB → pickup → label → track), Orders (all channels, refunds), Experiences (events + attendance), Customers (profile, orders, loyalty adjustments). POS sells `prepared_food` products only and is otherwise unchanged.

---

## 6. Role experiences and information architecture

### 6.1 Persistent header (every ops page, every role)
Current mission › phase › this week's quest (owner's, else node's) › node readiness % › badges: approvals waiting on me, my blockers › XP/level › search (⌘K across tasks, products, recipes, guides) › notifications › theme › user.
When there is no active mission: a "Start a mission" call to action for `CREATE_MISSION` holders; a "No active mission — ask the founder" note for others. Never `null`.

### 6.2 Navigation spine (order fixed; items appear only if the role's `ModuleAccess` allows)
1. **Mission Control** (`/dashboard`)  2. **My Tasks** (`/tasks`, server-filtered, kanban + list)  3. **My Quests** (`/quests?mine=1`)  4. **Evidence** (`/boards/evidence`)  5. **Approvals** (`/approvals`)  6. **Decisions** (`/decisions`)  7. **Readiness** (`/readiness`)  8. **Team** (`/team` — merges wins, contribution, activity, leaderboard)
then collapsible groups: **Kitchen** · **Procurement** · **Commerce** · **Catalog & Experiences** · **Intelligence** · **Admin**. Guide and Chat move to the header. No label appears twice.

### 6.3 Module access (seeded defaults; editable by `MANAGE_SYSTEM` at `/admin/modules`)
| Module | Roles |
|---|---|
| mission_control, my_tasks, my_quests, evidence, readiness, team, guide | all |
| approvals | all with `APPROVE_EVIDENCE` |
| decisions | all |
| chat | all (header entry) |
| recipes, ingredients, prep_batches, kds, pick_pack, waste, supply_usage | BACKEND_LEAD, PROCUREMENT_LEAD, FRONTEND_LEAD, FOUNDER_ADMIN, TECH_LEAD |
| inventory, procurement, purchase_orders, vendors | PROCUREMENT_LEAD, BACKEND_LEAD, FOUNDER_ADMIN, TECH_LEAD |
| pos, orders, delivery, shipments, customers, reviews | FRONTEND_LEAD, FOUNDER_ADMIN, TECH_LEAD |
| catalog, promotions, experiences, brands, assets | DESIGN_OUTREACH_LEAD, FRONTEND_LEAD, FOUNDER_ADMIN, TECH_LEAD |
| analytics, kpis, feedback, exports | BI_LEAD, FOUNDER_ADMIN, TECH_LEAD |
| imports, users, permissions, delegations, notices, settings, modules, guide_editor, zones, channels | FOUNDER_ADMIN, TECH_LEAD |
| talent (team readiness, onboarding checklist — v2.1) | TALENT_LEAD, FOUNDER_ADMIN |

### 6.4 Interaction rules
- Task and Quest create/edit are **Sheets**; evidence upload is available from the task row and the task page; approve/reject inline with a required note on reject.
- Every ops card that has a task link shows a "Quest › Task" chip and the meter it feeds; every quest page lists linked POs, recipes, products, batches, events.
- Forms: `react-hook-form + zod` everywhere; `<Button>` is the only button; `<Card>` is the only card; loading, empty and error states on every list.
- Motion allowlist: BorderBeam for *new* KDS/Pick & Pack orders; NumberTicker for XP/readiness on change; confetti on level-up and task validation only; `motion-reduce` respected. Everything else is removed.
- Realtime: Pusher private channels for KDS, Pick & Pack, Shipments, Approvals count, Notifications; polling only as fallback at ≥ 30 s.

### 6.5 Mission Control (admin) and My Day (everyone)
Admin: Action Required (approvals, blockers, stale decisions, low stock, failed shipments) · Status (mission, quest progress, readiness with 30-day sparkline, revenue today, orders in flight) · Intelligence (KPI alerts, variance, top products, feedback themes).
Everyone else: Today's Focus (overdue › due today › quest-linked, full width) · my quest progress · my evidence awaiting review · my meter contributions · nudges.

---

## 7. Design system

Source palette = the existing public tokens (`globals.css --public-*`): warm stone ground `oklch(0.98 0.005 80)`, ink `#1c1917`, terracotta `#c2410c` (primary), olive `#365314` (secondary), amber `#a16207` (accent), warm borders `#e8e0d4`. These are promoted to the shared `:root` token set (light) with a designed dark set (warm near-black `#141210`, stone ink `#f5f0e8`, terracotta `#e8663a`, olive `#8fae4a`, amber `#d9a441`). Status colours (good/warning/serious/critical) are separate from brand. Type: Plus Jakarta Sans (UI), Geist Mono (data), existing homepage display treatment untouched. One token file, zero arbitrary colour values in components (lint rule), light and dark both validated for contrast. The homepage keeps its own scoped styles.

---

## 8. Security, reliability, operations

- **Auth:** refresh JWT carries `token_use: refresh` and a separate `JWT_REFRESH_SECRET`; `JwtStrategy` rejects refresh tokens on API routes; customer sessions 7 days sliding with `jti` revocation list in Redis; edge proxy verifies with an EdDSA public key (backend signs with the private key).
- **Rate limiting:** named throttlers `default/short/long` registered; authenticated routes keyed by user id; public auth/OTP/feedback routes on explicit per-route limits; `cf-connecting-ip` used as tracker when present.
- **Config:** `ConfigModule` validation schema; production boot fails on missing `DATABASE_URL, DIRECT_DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, JWT_PUBLIC_KEY, R2_*, UPSTASH_REDIS_URL, RAZORPAY_*, SHIPROCKET_*, WHATSAPP_*`; QStash webhook returns 403 without a configured receiver; all `.env.example` files generated from the schema.
- **Data safety:** `seed:reference` (idempotent, prod-safe, no users' passwords) and `seed:demo` (guarded `NODE_ENV !== production`, random passwords printed once). Migrations run in a release step, not the build.
- **Observability:** `nestjs-pino` with request ids; Sentry both sides; `/health` runs `SELECT 1` and checks Redis; route-level `error.tsx` + `global-error.tsx`; `UsageEvent` table (page views per role, key actions) feeding an admin usage panel.
- **Background work:** crons wrapped in `pg_try_advisory_lock`; every webhook idempotent on provider event id; caches (permissions, unit conversions) in Redis with pub/sub invalidation.
- **Storage:** private R2 bucket, presigned GET for evidence/exports/product media (media may use a public CDN prefix), lifecycle rule on `exports/` (30 days), orphan sweep weekly.
- **Public surface hygiene:** public catalog endpoints never return cost, yield, BOM or margin fields.

---

## 9. API surface (delta; all JSON, existing envelope and guard conventions)

New/changed staff endpoints: `nodes` (GET/PATCH current), `modules` (GET, PATCH `/modules/:key`), `approval-policies` (CRUD), `decisions/:id/votes`, `readiness-meters/:code/history`, `tasks?mine=1&status=&quest_id=` (server-filtered, paginated), `catalog/products|variants|categories|media` (CRUD + publish), `promotions/coupons`, `reviews` (moderate), `shipments` (list, pack, assign-awb, pickup, label, cancel), `orders/:id/refund`, `customers` (list, detail, loyalty adjust), `events/:id/attendance`, `usage` (admin), `audit?entity_type=&entity_id=`.
New customer endpoints: `catalog/*` (public, cached 60 s), `customer/checkout/quote`, `customer/coupons/validate`, `customer/loyalty`, `customer/reviews`, `customer/orders/:id/shipment`.
Webhooks: `/webhooks/razorpay` (unchanged contract), `/webhooks/shiprocket` (new).
All list endpoints accept `cursor`/`limit` (default 50, max 200).

---

## 10. Quality gates and definition of done

- **CI (`.github/workflows/ci.yml`)** on every push/PR: backend `npm ci → lint (no --fix) → tsc --noEmit → jest --ci → prisma validate → build`; frontend `npm ci → lint → tsc --noEmit → build`; integration job with a Postgres service running `jest --config test/jest-integration.json`; Playwright smoke on a built preview. Railway and Vercel deploy only on green `master`.
- **Tests required per sub-project:** unit (services, pure functions), integration (every multi-write transaction: order confirm, fulfilment, PO receive, prep batch, evidence cascade, approvals, derived meters, shipment lifecycle), smoke (`login → create task → upload evidence → approve → meter moves`; `browse → add three fulfilment types → coupon → pay (Razorpay test) → confirm → track`).
- **Definition of done for a sub-project:** spec section satisfied; CI green; a human walk-through recorded in the phase summary; no new `any`, no arbitrary colour values, no `console.*` in services; planning docs updated.

---

## 11. Delivery plan (sub-projects, in order)

| # | Sub-project | Exit criteria |
|---|---|---|
| **P0** | Canonical spec + planning sync | This file committed; `PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md` reflect v2.0; historical docs marked |
| **P1** | Stop the bleeding | All 14 Critical/High defects fixed with regression tests; config validation; safe seeds; error boundaries; 43/43 suites green; CI enforcing |
| **P2** | Platform foundation | Fresh migration baseline with `Node`, enums, `AuditEvent`, `Task.subject`, `ApprovalPolicy`, timestamptz, CHECKs, `Product` replacing `MenuItem`; new seeds; all v1 flows green against the new schema |
| **P3** | Mission bridge | Domain events, `MissionBridgeService`, derived meters + snapshots + history API, policy-generated approvals, recipe approval via policy, decision votes (2+1); smoke test 1 passes |
| **P4** | Role-aware IA + identity | Header, spine nav, `ModuleAccess`, `/tasks`, My Quests, sheets, chips, motion allowlist, brand tokens light+dark, Pusher on kitchen screens; usage events |
| **P5** | Marketplace | Catalog admin, storefront (desktop + SEO), mixed-fulfilment cart/checkout/quote, Shiprocket + shipments queue, bookings via checkout, merch stock, coupons, loyalty, reviews, search, refunds, customer account; smoke test 2 passes |
| **P6** | Run-it layer | WhatsApp nudges (staff templates), daily close screen, theoretical vs actual food cost, usage dashboard, AI: evidence review assist + morning brief (Claude API, human-in-the-loop) |

Each sub-project: written plan → parallel subagents partitioned by module → CI green → walk-through → commit on `v2-os-marketplace` → summary in `.planning/phases/`.

---

## 12. Open decisions resolved here (so nobody re-litigates them)
- `MenuItem` is replaced by `Product`, not extended. POS reads products.
- Bridge rules are versioned TypeScript, signals and policies are tables.
- Prepaid only; no COD.
- Global `order_number`; node-scoped `Product.slug` and meter codes.
- Customers are global identities; loyalty is per customer, not per node.
- Experiences are products whose fulfilment is a booking; `EventBooking` remains the capacity record.
- Kitchen screens get Pusher; everything else may poll at ≥ 30 s.
- Chat, delegations, guide editor, exports, imports, admin consoles are **kept** and scoped by `ModuleAccess`; nothing is deleted for being unused.
