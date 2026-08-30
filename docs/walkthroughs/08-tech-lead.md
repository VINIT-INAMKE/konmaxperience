> 🔧 **Welcome, Tech Lead.** You are `vinit@konma.store`, role **Tech Lead** — the only account besides Founder/Admin that holds every permission in the system. This guide skips the day-to-day and covers the surfaces nobody else opens: Usage, Settings, Module access, Imports, Zones, Channels, Delegations, Notices and the Guide editor. Plus a runbook for where everything actually runs.

> 💡 **Commerce and kitchen are covered elsewhere.** POS, orders, KDS, prep batches, inventory and daily close each have their own walkthrough in this folder — this one assumes you'll read those for the operational screens and stays on the system layer.

---

# 🧭 What you can see, and why

Your role is seeded with `Object.values(Permission)` — all 23 permission codes. But **permissions are not what builds your sidebar**. Module access is.

That distinction matters more than anything else in this guide:

| Layer | Answers | Where it's edited |
| --- | --- | --- |
| **Permissions** | What a role may *do* once inside a screen | **Permissions** (`/admin/permissions`) |
| **Module access** | Whether a role sees the screen at all | **Modules** (`/admin/modules`) |

You hold every module key by seed except one — `talent`, which is a v2.1 module with no screen yet. Granting it would produce a dead link, which is why it isn't granted.

---

# 📊 Usage — reading real adoption

**Sidebar → Admin → Usage** (`/admin/usage`)

This is the honest answer to "is anybody actually using this?" The page header says it plainly:

> *Page views and key actions recorded by the app itself. Staff traffic is attributed to the person; storefront traffic is anonymous and appears only in the role split.*

## Reading the page

1. Pick a window with the button group at the top right — **7 days**, **30 days** or **90 days**. Thirty is the default.
2. Read the date range beside it. It ends with *"· node-local days, both ends included"* — these are **calendar days in Asia/Kolkata**, not a rolling `now minus 720 hours`. The analytics screens draw their day boundaries the same way, so the two agree.
3. Scan the four cards: **Page views**, **Key actions**, **Active staff** ("people with at least one event"), **Busiest screen**.
4. Read **Page views per day** for the shape of adoption. Its description is worth internalising: *"A day with no traffic is a real zero, not a missing reading."*
5. Read **Events by role** for the split.
6. Read **Busiest screens** and **Key actions** for what people actually do. Both are capped — *"The server returns at most 25."*
7. Read **Who was active** at the bottom for the per-person table.

## 🚦 The storefront-vs-staff distinction

This is the one thing on the page that confuses people, so it's worth being precise.

Every usage event carries a `role_code`. Storefront visitors — customers browsing `www.konma.store` — are recorded with **no user attached** under a synthetic role code that renders as **"Storefront visitors"**.

The consequence:

| Surface | Includes storefront traffic? |
| --- | --- |
| **Events by role** chart | ✅ Yes — as its own bar, labelled **Storefront visitors** |
| **Who was active** table | ❌ Never — there is no person to attribute it to |
| **Page views** / **Key actions** cards | ✅ Yes — they count all events |
| **Active staff** card | ❌ No — staff only |

The chart even carries a footnote when a customer row exists:

> *"Storefront visitors" is anonymous shop traffic — it has no user behind it and never appears in the per-person table.*

> ⚠️ **So don't read "Active staff: 3" as "only 3 people used the site."** It means three *staff members*. Storefront traffic could be in the thousands and that card would not move. Cross-read the two.

The **Who was active** table has five columns — **User**, **Role**, **Page views**, **Actions**, **Last seen** — and all but Role are sortable. A person with no event in the window is absent from the table entirely, not shown as zero. A null last-seen renders as the literal word `never`.

> 💡 **On a fresh deployment this page is empty, and that is correct.** The empty state says so: *"On a fresh install that is the expected reading — page views and key actions appear here as soon as somebody uses the app."*

## The action vocabulary

Only instrumented actions are counted, not every click. The list is fixed: task create, task status change, task validate, evidence upload, approval decide, quest create, order place, KDS item ready, import run, export run, module access update.

---

# ⚙️ Settings — every block, briefly

**Sidebar → Admin → Settings** (`/admin/settings`)

> ⚠️ **Read this first.** The Settings *screen* has exactly **two cards** — Leaderboard and Notifications. The system has fourteen setting keys. The other twelve are backend defaults that are not exposed here; a few live on the **Node** screen, the rest change through a deploy. Don't go hunting the Settings page for the loyalty rate — it isn't there.

## Block 1 — Leaderboard

One switch: **Enable Leaderboard**.

> *When disabled, leaderboard rankings are hidden from all users. XP and levels continue to accumulate silently.*

Turning it **off** opens a confirm dialog — **Disable leaderboard?** — with buttons **Keep Leaderboard Active** and **Disable Leaderboard**. Turning it on is immediate.

## Block 2 — Notifications

> *How staff nudges leave the app. In-app notifications are always delivered and are not governed by anything on this card.*

That sentence is the whole model. In-app notifications always land. This card only governs the **WhatsApp** leg.

### 📱 The WhatsApp master switch

**WhatsApp staff nudges** — a single switch, currently **off**.

> *When off, nudges are written in-app only, whatever an individual has opted into.*

And, in warning colour beneath it:

> *WhatsApp templates must be approved in the Meta WhatsApp Manager before this is turned on.*

> ⚠️ **Leave this off.** Five Meta templates must be approved before it means anything: `staff_approval_waiting`, `staff_task_blocked`, `staff_low_stock`, `staff_shipment_failed`, `staff_morning_brief`. Flipping the switch before Meta approves them produces failed sends, not messages.

### 🌙 Quiet hours

> *No WhatsApp message is sent inside this window. A window that crosses midnight is fine — 21:00 to 07:00 is the overnight one. The in-app notification is still written.*

Two fields, **Start** and **End**, defaulting to **21:00 → 07:00**.

A few properties worth knowing:

- The window is **half-open** — `[start, end)` — and wraps midnight correctly.
- Setting start equal to end means *never quiet*, not *always quiet*.
- A malformed window **fails open** (nothing is suppressed) rather than silently muting everything.
- Quiet hours leave **no record at all** for the WhatsApp leg, so the next hourly sweep outside the window re-sends once. Nothing is lost, it's deferred.
- The 07:00 default end is not a coincidence — the morning brief fires at exactly 07:00, *the moment quiet hours close*.

### ⏱️ Cooldowns

> *Hours before the same person is nudged about the same thing again. This is what stops one stuck approval from becoming a daily message.*

Six numeric fields, each in hours, min 0 and max 168:

| Field | Default |
| --- | --- |
| **Approval pending** | 24 |
| **Task blocked** | 12 |
| **Low stock** | 4 |
| **Shipment failed** | 6 |
| **Morning brief** | 20 |
| **Daily close due** | 20 |

The cooldown is checked **once per dispatch, not once per channel** — a nudge is one event however many ways it travels. Any type not in this list falls back to 24 hours.

Save with **Save notification settings**; abandon with **Discard changes**.

## The settings that aren't on this screen

For orientation, the full key list and the defaults that matter operationally:

| Key | Notable defaults |
| --- | --- |
| `loyalty` | 5 points per ₹100 · ₹0.25 a point · expire after 365 days · max 20% of a subtotal · tiers Member 0 / Regular 500 / Insider 2000 |
| `reviews` | auto-publish at rating ≥ 4 · invitation 24h after delivery |
| `promotions` | stacking **off** — one coupon per order |
| `daily_close` | computes at 00:45 · signable by Frontend Lead and Founder/Admin |
| `ai` | provider `heuristic` (needs no API key) · morning brief on |
| `shipping` | provider `manual` · default parcel 500g, 20×15×10cm |
| `delivery_pincodes` | empty — falls back to the `DELIVERY_PINCODES` env var |
| `readiness`, `xp_rules`, `system_name`, `maintenance_mode`, `marketplace_fulfilment_zone_id` | — |

> 💡 A `PATCH` to any key outside this allow-list is rejected with `Invalid setting key`. The list is the contract.

---

# 🧩 Module access — how the sidebar is actually built

**Sidebar → Admin → Modules** (`/admin/modules`)

This is the most useful screen on this page, because it's the one that changes what other people see.

> *Module visibility is a data layer of its own: a role sees a screen only when the module is enabled and that role is ticked. Permissions still decide what a role may* do *once inside.*

## The mechanism, end to end

1. `ModuleAccess` is a table of module keys, each with a set of role codes.
2. When someone loads the app, the frontend calls `GET /modules/mine` and gets back **the module keys visible to their role**.
3. `buildSpine()` takes the **fixed** navigation structure and *filters* it by those keys. It never re-sorts — order is defined in code, visibility is defined in data.
4. A group with zero visible items disappears entirely.
5. A module key with no route is simply absent from the structure, so granting one can never produce a dead link.

**Grant a module, the person gets the nav item.** That is the whole loop.

## ⚠️ It grants to roles, not to people

This trips everyone up once. There is **no per-user grant** on this screen. The matrix is modules down the side, **roles** across the top:

**Founder · Frontend · Backend · BI · Procurement · Talent · Tech · Design**

You tick the cell where a module row meets a role column. Everyone holding that role is affected.

## Using the screen

1. Find the module with the **Search modules…** box, or narrow with the **Filter by role** select (its options read **Visible to {Role}**).
2. Read the live count line: *"{n} of {total} modules · {n} disabled · {n} with no role"*.
3. Tick the checkbox at the module × role intersection. Its accessible label is `{Role} can see {Module}`.
4. **The write is immediate.** There is no save button for visibility — a toast confirms: *"{Role} can now see {Module}."*
5. Only the **Order** column is deferred. Change a sort order and a sticky bar appears with **Discard** and **Save order**.

Rows are grouped under sticky band headings that mirror the sidebar: **Navigation spine**, **Kitchen**, **Procurement**, **Commerce**, **Catalog & Experiences**, **Intelligence**, **Admin**, **Talent (v2.1)**.

## The guard rails

Two confirm dialogs stand between you and a bad afternoon:

- **Remove the last role?** — *"No role will be able to see {label}. Continue?"* The module becomes an orphan, flagged with a warning triangle.
- **Disable a navigation spine item?** — *"{label} is one of the fixed spine destinations. Disabling it removes {label} from every role's navigation, **including yours**. Continue?"*

> ⚠️ Take that second one seriously. Disabling a spine module removes it from your own sidebar too, and you'd be re-enabling it from a screen you can still reach only because `modules` is a different key.

> 💡 **`Settings` and `Node` share one module key.** Revoking `settings` hides both screens. **`Zones`** and **`Channels`** are `/operations/*` routes that sit in the **Admin** nav group. **`Exports`** lives under **Intelligence**, not Admin.

---

# 📥 Imports

**Sidebar → Admin → Import** (`/admin/import`)

> *Bulk import operational data from CSV or XLSX files*

Thirteen entity types, arranged in four tiers by dependency:

| Tier | Types |
| --- | --- |
| **Foundation Data** | Ingredients, Vendors, Vendor Pricing |
| **Operations — Independent** | Opening Stock, Purchase Orders, Missions, KPIs, Events |
| **Operations — Sequenced** | Quests, Tasks |
| **Menu** | Recipes, Product Categories, Products |

Prerequisite badges spell out the order: quests show **Needs: Missions**, tasks show **Needs: Missions + Quests**, product categories **Needs: Brands**, products **Needs: Recipes + Categories**. A tier with everything in place gets a green dot.

## The flow

It is **upload → parse → commit**. There is no separate column-mapping step (the template fixes the columns) and no separate dry-run button — **the parse *is* the dry run**.

1. Open a type. Click **Download Template (.xlsx)** or **Download Template (.csv)**.
2. Fill the template. Don't add or rename columns.
3. Drag the file onto the upload zone — *"Drag and drop your CSV or XLSX file here / or click to browse"*.
4. Click **Parse File**.
5. Read the summary: *"{n} rows parsed · {n} valid · {n} invalid · {n} duplicates · {n} blocked"*.
6. Scan the preview table. Every row gets a status — **Invalid**, **Blocked**, **Duplicate — will update**, **Duplicate — will skip**, or a green dot for valid. **Cells are click-to-edit inline**: fix problems right here, Enter to commit, Escape to cancel.
7. Decide on the update toggle — *"Update existing records. Matching by name — existing records will be overwritten."* Its wording changes per type.
8. Click **Import {n} Records**.
9. Read the result tiles: **Imported · Updated · Skipped · Errors**.

## ⚠️ Two banners worth obeying

- **Opening Stock**: *"Stock imports are ADDITIVE. Each row adds to current inventory. If you import this file twice, quantities will be doubled."* There is no update toggle on this type, because there is no safe one.
- **Recipes**: *"Recipes import as drafts. Approve them in the app before linking to products."* Recipes are **XLSX only** — two sheets, headers and BOM lines. CSV is refused.

---

# 📍 Zones and 📡 Channels

Both sit under **Admin** in the sidebar despite living on `/operations/*` routes.

## Zones (`/operations/zones`)

The physical spaces the villa operates in. Empty state: *"Add the physical spaces your villa operates in."*

Tabs across the top: **All · Planned · Setup · Active · Inactive**.

1. Click **Add Zone**.
2. Fill **Name** (e.g. *Main Kitchen*), pick a **Zone Type** — Kitchen, Dining, Outdoor, Workspace, Storage or Leisure.
3. Optionally set **Owner** and **Notes**.
4. Save with **Add Zone**.

**Status** only appears when editing — new zones start as planned. Deleting warns *"This will permanently remove this zone. This cannot be undone."*

> 💡 Zones are referenced by inventory, purchase orders and stock imports. Create them before you import opening stock, not after.

## Channels (`/operations/channels`)

How orders reach the kitchen. A four-column table — **Channel · Type · Status · Action**.

1. Click **Add Channel**.
2. Enter **Name** (e.g. *Dine-in Service*) and pick a **Channel Type**: dine-in, takeaway, delivery or marketplace.
3. Save.

New channels are always created **planned**; you flip them to Active by editing. Seven ship seeded — Dine-in, Delivery, Takeaway, Retail, Event, Workshop, Online — all planned.

---

# 🔁 Delegations

**Sidebar → Admin → Delegations** (`/admin/delegations`)

Approval delegation: letting someone approve on another person's behalf while they're away.

> ⚠️ **Known gotcha for your account.** You hold the `delegations` module key, so the nav item appears in your sidebar — but the page itself hard-redirects anyone whose role isn't **Founder/Admin** straight back to `/dashboard`. If you click Delegations and land on Mission Control, that's why. Delegations are created by `admin@konma.store`, not by you.

For reference, the flow the Founder/Admin sees:

1. Click **Create Delegation**.
2. Pick **Delegating From (Absent User)**, then **Delegate To** (which stays locked until a "from" is chosen — *"Select delegating-from user first"*).
3. Set **Start** and **End** dates. *"End date must be after start date."*
4. Submit. The toast reads *"Delegation created. {to} can approve on behalf of {from} until {date}."*

Delegations are listed under **Active** and **Expired** headings, with a **Show expired ({n})** toggle. Each card shows `{From} → {To}`, the date range and *"Created by {name}"*, plus a **Deactivate** button.

---

# 📢 Notices

**Sidebar → Admin → Notices** (`/admin/notices`)

> *Broadcast a notification to all active team members*

> ⚠️ **There is no severity picker and no audience targeting.** This is a single broadcast to *every active team member*. If you were expecting to scope a notice to one role, that doesn't exist — use it accordingly.

1. Write a **Title** — max 200 characters, with a live counter. Placeholder: *"e.g., Team standup at 3 PM today"*.
2. Write a **Message** — max 1000 characters.
3. Optionally add a **Link** — *"e.g., /dashboard or /operations/inventory"*. Helper text: *"Users will be taken to this page when they click the notification."*
4. Click **Send Notice to All**.

The button walks through *"Sending to all team members…"* then *"Sent!"* and resets after three seconds. The toast confirms the headcount: *"Notice sent to {n} team members."*

---

# 📖 Guide editor

**Sidebar → Admin → Guide Editor** (`/admin/guide`)

The nav label is **Guide Editor**; the page heading is **Guide Management**. Same screen.

> *Create and manage guide sections and pages for your team.*

## Sections

1. Click **Add Section**.
2. Fill **Section title** (e.g. *Kitchen Operations*) and **Description**.
3. Pick an icon and a colour.
4. Under **Visible to roles**, tick the roles that should see this section.
5. **Save Section**.

Sections and the pages inside them are drag-reorderable.

## Pages

New pages are created titled **Untitled page** and drop you straight into the editor.

1. Set the page title in the centre field.
2. Write in the rich-text body. You get headings, lists, bold/italic, images and a **callout** block.
3. **It autosaves** — five seconds after you stop typing. The indicator cycles **Unsaved changes → Saving… → Saved**.
4. A new page is a **draft**, banner and all: *"This page is a draft. Only admins can see it."*
5. Click **Publish** when it's ready. Published pages show a **Published** badge and an **Unpublish** button.

Images upload to R2 and accept JPEG, PNG and WebP. Navigating away with unsaved work prompts *"You have unsaved changes. Leave anyway?"*

Deleting a section warns that it takes every page inside it: *"This will permanently delete the section and all {n} pages inside it. This cannot be undone."*

---

# 🖥️ Runbook — where things actually run

> 🔧 **The production topology, as of the 2026-08-30 go-live.**

## Where it runs

| Piece | Where | Notes |
| --- | --- | --- |
| **Frontend** | Vercel → **https://www.konma.store** | Apex `konma.store` 308-redirects to `www`. Deployed from the **repo root**, not `frontend/` |
| **Backend API** | Railway → **https://api.konma.store** | Service `api`, plus a Redis addon. Builder is **Railpack** |
| **Database** | **Aiven Postgres 18** | `sslmode=require`. Migrations applied on deploy |
| **Object storage** | Cloudflare R2 | Evidence, exports, product media, guide images |

Two operational notes about the backend that are easy to get wrong:

- Railpack **ignores `railway.toml`** and always runs `npm run start`. The heap cap and the `prisma migrate deploy` prestart hook therefore live in `backend/package.json`, not in a Railway config file. Deploys are self-migrating.
- **Never set `NODE_OPTIONS` as a Railway service variable** — it poisons the build's TypeScript compile.

## ⏰ Where the crons fire

All times are **node-local — `Asia/Kolkata` (IST)**. Every scheduled job takes a Postgres advisory lock first, so running several API instances doesn't mean running the job several times. None of them can crash the process — an unhandled rejection out of a cron method would take the whole API down, so each one swallows its own errors.

| Time (IST) | Job | What it does |
| --- | --- | --- |
| **00:20 daily** | Readiness snapshot | One snapshot row per meter for the day |
| **00:45 daily** | **Daily close** | Computes yesterday's numbers, notifies the signers |
| **02:00 daily** | Loyalty expiry | Expires points 365 days after they were earned |
| **02:30 daily** | **Stock reconciliation** | Compares the movement ledger against cached stock |
| **07:00 daily** | **Morning brief** | Sends the brief — exactly as quiet hours close |
| **Hourly, on the hour** | Staff nudges | Stuck approvals, still-blocked tasks, failed shipments |
| **Hourly** | Task-due scan, approvals-pending scan, prep-batch expiry | — |
| **Every 5 minutes** | Booking-hold sweep | Releases expired 15-minute seat holds |
| **Sunday 03:00** | Notification cleanup | Purges notifications older than 30 days |
| **Sunday 04:00** | **Storage sweep** | Deletes orphaned R2 objects |

The nightly ordering is deliberate, and the source comments say why: the close runs *"after the readiness snapshot (00:20) and well before the loyalty expiry (02:00) and stock reconciliation (02:30), so the four nightlies never contend for a connection."* The two weekly jobs are an hour apart *"so the two weeklies never overlap."*

> 💡 **Stock reconciliation records drift and never repairs it.** A silent correcting write would destroy the only evidence of whichever code path is losing movements. The audit event *is* the deliverable — go read it, don't wait for it to fix itself.

## 📱 WhatsApp is off, and what that costs

The channel ships **disabled**, pending Meta template approval. Two consequences, and they are different:

**For staff nudges** — harmless. Notifications degrade to in-app (and email, for the four types configured for it). Nothing is lost.

**For customer sign-in** — this one matters. Customer login is OTP over WhatsApp, and WhatsApp is the *only* delivery channel. Outside production the code prints the OTP to the API log as `[DEV] OTP for {phone}: {code}`. **In production, with the WhatsApp credentials unset, the send is refused outright rather than logged.**

> ⚠️ **So before anyone demos customer sign-in on `www.konma.store`, check with tech that the OTP path actually completes.** If it doesn't, that step of the customer walkthrough can't be finished by the tester alone. This is the single blocker between the storefront and a real customer, and it clears the moment Meta approves the `otp_verification` template.

For the record, the OTP rules that *are* live: 6 digits, 5-minute expiry, max 3 requests per phone per hour, max 5 verification attempts per code, and Redis must be reachable or the endpoint answers *"OTP service unavailable"*.

## 💳 Razorpay is in TEST mode

Live keys have not been swapped in. There is deliberately **no test-mode badge anywhere in the UI** — the only signal is the key prefix.

- The Razorpay *order* is created for real against `api.razorpay.com`, in test mode.
- Payment capture arrives as a **signed webhook**, not from the browser modal.
- The backend accepts both `captured` and `authorized` payment states, because auto-capture may be off in test mode.
- With no keys configured at all, the backend logs *"payment service disabled"* and the Pay button refuses to open the modal rather than showing a broken checkout.

> ⚠️ **No real money moves yet.** Anyone testing checkout must use Razorpay's test card flow. Swapping to live keys is a deliberate, separate step.

---

# 🌟 Worked example — grant a module and watch it land

The full loop: make a change, see it appear for someone else, then see the evidence of it a day later.

- [ ] Open **Sidebar → Admin → Modules** (`/admin/modules`).
- [ ] Type `feedback` into **Search modules…** to find the **Feedback** row.
- [ ] Look across to the **Design** column (Design/Outreach Lead) — the cell is unticked. By seed, `feedback` goes to BI Lead, Founder/Admin and Tech Lead only.
- [ ] Tick that cell. Confirm the toast reads *"Design/Outreach Lead can now see Feedback."* Note that **nothing was saved** — the write already happened.
- [ ] Ask the person holding Design/Outreach Lead to **refresh their browser**.
- [ ] Watch an **Intelligence** group appear in their sidebar with a single **Feedback** item in it. Before this, they had no Intelligence group at all — a group with no visible items isn't rendered.
- [ ] Have them open it. They can read feedback because the module is granted; what they can *do* there is still governed by their permissions, which have not changed.
- [ ] Untick the cell to put it back, and confirm the group vanishes on their next refresh.

Now the second half — evidence, the next day:

- [ ] Come back tomorrow and open **Sidebar → Admin → Usage** (`/admin/usage`).
- [ ] Set the window to **7 days**.
- [ ] Find that person in the **Who was active** table. Their **Page views** count includes the visit you just caused, and **Last seen** shows when.
- [ ] Look at **Busiest screens** — `/operations/feedback` should now appear if they spent time there.
- [ ] Check **Events by role**. If any customer browsed the shop that day, you'll see a **Storefront visitors** bar. Confirm for yourself that the same people are **not** in the table below it.

Finally, read Settings without touching it:

- [ ] Open **Sidebar → Admin → Settings** (`/admin/settings`).
- [ ] Scroll to the **Notifications** card.
- [ ] Confirm **WhatsApp staff nudges** is **off**, and read the warning about Meta template approval underneath it.
- [ ] Read **Quiet hours** — **21:00** to **07:00**. Note that the end time is exactly when the morning brief fires.
- [ ] Read the six **Cooldowns**. Ask yourself whether 24 hours is the right gap for a pending approval before anyone complains about it.
- [ ] Click **Discard changes** and leave. **Do not save.** Nothing here needs changing until WhatsApp templates are approved.

---

> 🔧 **You now hold the system layer.** Module access decides what everyone sees, Settings decides how the app speaks to them, Usage tells you whether any of it landed, and the runbook tells you where to look when it doesn't. For the operational screens — POS, kitchen, inventory, close — see the other guides in this folder.
