> 🏡 This is your guide, Founder/Admin. You sign in as **admin@konma.store** and you can see and change everything in the villa. That's a lot of buttons, so this walks you through each one in plain words — what the screen shows, what to click, and what happens next. Read the ⭐ worked example at the end and you'll have done a full lap of the system.

---

# 🗝️ Before you start

Sign in at **https://www.konma.store/team** with **admin@konma.store** and your password. You land on **Mission Control**.

Your sidebar has an extra group the others don't: **Admin**. Open it and you'll find twelve screens:

**Import** · **Users** · **Permissions** · **Delegations** · **Notices** · **Settings** · **Node** · **Modules** · **Usage** · **Guide Editor** · **Zones** · **Channels**

This guide takes them one at a time, then covers the three things only you really do: approving across the whole villa, signing the daily close, and the morning brief.

> ⚠️ You share full access with the **Tech Lead**. That's deliberate — two people, so the villa is never locked out. Everything either of you does is recorded with your name against it.

---

# 👥 Users

**Sidebar → Admin → Users** (`https://www.konma.store/admin/users`)

The page heading says **Team**. It's a table of everyone who can sign in.

| Column | What it tells you |
|---|---|
| **Name** | Their initials and their name |
| **Email** | The address they sign in with |
| **Contact** | Their phone number, plus a green WhatsApp mark if they've opted in. A dash means no number on file. |
| **Role** | **Founder/Admin**, **Frontend Lead**, **Backend Lead**, **BI Lead**, **Procurement Lead**, **Talent Lead**, **Tech Lead** or **Design/Outreach Lead** |
| **Status** | `active` or `inactive` |
| **Last active** | `Just now`, `3h ago`, `2d ago`, or a date |

## Adding someone to the team

1. Click **Add team member** at the top right.
2. A dialog opens. It tells you what happens: *"They will receive an email to set their password."*
3. Fill in **Full name**.
4. Fill in **Email address** — use their `@konma.store` address.
5. Pick a **Role** from the dropdown.
6. Click **Add member**.

You'll see **Invitation sent to {name}**. They get an email with a link to set their own password. You never type or see their password — that's the point.

> ⚠️ **Choose the role carefully.** There is no way to change someone's role afterwards from this screen. If you get it wrong, deactivate the account and add them again with the right role.

## The ⋯ menu on each row

Click the three dots at the end of a row. Three things:

### 1. Contact & notifications

This is where you set up how someone is reached **outside** the app. The dialog explains itself: *"How {name} is reached outside the app. In-app notifications are unaffected by these settings."*

1. Type their number in **Phone**. Digits only — no plus sign, no spaces, no dashes. The hint says it plainly: *"Digits only — the country code is added automatically for India."* Between 10 and 13 digits.
2. Turn on **WhatsApp nudges** if they want approvals, blocked tasks and low stock sent to that number.
3. Click **Save**. You'll see **Contact details saved for {name}.**

> 💡 The **WhatsApp nudges** switch is greyed out until there's a phone number: *"Add a phone number first — there is nowhere to send a nudge without one."* And if you clear the phone number, the opt-in turns itself off. The system won't let you promise a message it can't send.

> ⚠️ Even with this all set, WhatsApp messages don't go out until the **WhatsApp staff nudges** master switch is on in **Settings** — and that stays off until the message templates are approved by Meta. In-app notifications work regardless, always.

### 2. Send password reset email

One click, no confirmation. They get a reset link. Use this when someone is locked out. You'll see **Password reset email sent to {name}**.

### 3. Deactivate user

Opens a confirmation: **Deactivate {name}?** — *"They will lose access immediately. You can reactivate them at any time."* Click **Deactivate** to go ahead, or **Keep active** to back out.

> ⚠️ **Read this before you deactivate anyone.** The dialog says you can reactivate them at any time, but there is **no reactivate button anywhere in the app**. A deactivated person stays in the table showing `inactive` and cannot be restored from this screen. Treat deactivation as permanent and ask the Tech Lead if you need someone brought back.

---

# ⚙️ Settings

**Sidebar → Admin → Settings** (`https://www.konma.store/admin/settings`)

Heading: **System Settings**. Two cards.

## The leaderboard switch

One control: **Enable Leaderboard**.

*"When disabled, leaderboard rankings are hidden from all users. XP and levels continue to accumulate silently."*

Turning it **on** saves instantly. Turning it **off** asks first: **Disable leaderboard?** with buttons **Keep Leaderboard Active** and **Disable Leaderboard**.

> 💡 Switch it off if rankings start feeling competitive in the wrong way. Nobody loses progress — the XP keeps counting, it's just not on display.

## Notifications

*"How staff nudges leave the app. In-app notifications are always delivered and are not governed by anything on this card."*

Three blocks, then one save button.

### WhatsApp staff nudges

The master switch for the whole villa. *"When off, nudges are written in-app only, whatever an individual has opted into."*

> ⚠️ There's an amber line under it: *"WhatsApp templates must be approved in the Meta WhatsApp Manager before this is turned on."* Leave it off until that's done. Turning it on early means messages that silently fail.

### Quiet hours

*"No WhatsApp message is sent inside this window. A window that crosses midnight is fine — 21:00 to 07:00 is the overnight one. The in-app notification is still written."*

Two fields, **Start** and **End**, in 24-hour time. The default is 21:00 to 07:00 — nobody's phone buzzes overnight.

### Cooldowns

*"Hours before the same person is nudged about the same thing again. This is what stops one stuck approval from becoming a daily message."*

Six numbers, all in hours:

| Setting | Default | What it controls |
|---|---|---|
| **Approval pending** | 24 | How often a reviewer is reminded about the same waiting approval |
| **Task blocked** | 12 | How often the owner of a stuck task is nudged |
| **Low stock** | 4 | How often the same low ingredient reminds you |
| **Shipment failed** | 6 | How often a failed parcel comes back round |
| **Morning brief** | 20 | Stops a second brief landing the same day |
| **Daily close due** | 20 | Stops the close reminder repeating |

Change anything and two buttons wake up at the bottom: **Discard changes** and **Save notification settings**. Nothing is saved until you click.

> 💡 A cooldown of 168 is a week — that's the maximum, and the form will tell you so.

---

# 🧩 Modules

**Sidebar → Admin → Modules** (`https://www.konma.store/admin/modules`)

Heading: **Module access**. This screen decides **which roles see which screens**.

*"Module visibility is a data layer of its own: a role sees a screen only when the module is enabled and that role is ticked. Permissions still decide what a role may do once inside."*

That sentence is the whole idea. **Modules** answer *"can they see the door?"* **Permissions** answer *"can they open it?"* You need both.

A big grid: one row per screen, one column per role (**Founder**, **Frontend**, **Backend**, **BI**, **Procurement**, **Talent**, **Tech**, **Design**), plus **Enabled**, **Order** and **Route**. Rows are banded under headings that match the sidebar: **Navigation spine**, **Kitchen**, **Procurement**, **Commerce**, **Catalog & Experiences**, **Intelligence**, **Admin**, **Talent (v2.1)**, **Other**.

## Giving someone a screen

1. Find the row — use the **Search modules…** box, or the **Filter by role** dropdown to see only what one role can reach.
2. Tick the box where the row meets the role's column.
3. That's it. It saves the moment you click, and you'll see a message like **Frontend Lead can now see Waste Log.**

Untick to take it away.

The counts line above the grid tells you where you stand: `31 of 49 modules · 2 disabled · 1 with no role`.

## The two warnings

- **Remove the last role?** — *"No role will be able to see {Module}. Continue?"* You're about to make a screen invisible to everyone.
- **Disable a navigation spine item?** — *"{Module} is one of the fixed spine destinations. Disabling it removes {Module} from every role's navigation, including yours. Continue?"*

> ⚠️ That second one is the dangerous button. The eight home-base links are marked with a **Spine** pill. Disabling one takes it out of *your* sidebar too.

**Order** is the only thing here that isn't instant — change it and a **Save order** bar appears at the bottom.

---

# 📊 Usage

**Sidebar → Admin → Usage** (`https://www.konma.store/admin/usage`)

Heading: **Usage**. *"Page views and key actions recorded by the app itself. Staff traffic is attributed to the person; storefront traffic is anonymous and appears only in the role split."*

Pick a window with the buttons **7 days**, **30 days** or **90 days** (30 is the default). The dates sit beside them.

Four numbers across the top: **Page views**, **Key actions**, **Active staff** and **Busiest screen**.

Then:

| Card | What it answers |
|---|---|
| **Page views per day** | Is the team actually opening the app? A quiet day shows as a real zero. |
| **Events by role** | Which roles are doing the work. |
| **Busiest screens** | Which screens earn their place. |
| **Key actions** | The things that matter: tasks created, statuses changed, tasks validated, evidence uploaded, approvals decided, quests created, orders placed, imports and exports run. |
| **Who was active** | One row per person — **User**, **Role**, **Page views**, **Actions**, **Last seen**. Click a column header to sort. |

> 💡 **Who was active** is the fastest way to spot someone quietly drowning or quietly disengaged. If a lead's **Last seen** says `never`, they haven't started.

Anonymous shop traffic appears as **Storefront visitors** in the role chart only — it never shows in the per-person table, because there's no person behind it.

On a brand-new villa you'll see **No activity recorded yet** — that's expected, not broken.

---

# 🛡️ Permissions

**Sidebar → Admin → Permissions** (`https://www.konma.store/admin/permissions`)

Heading: **Permissions**. Subheading: *"Control what each role can view and do. Changes take effect within 60 seconds."*

A grid with one row per capability and one column per role. Tick or untick.

Some of what's in there:

| Permission | In plain words |
|---|---|
| **View all data** | See everything, not just their own |
| **Create tasks** | Add work to a quest |
| **Update own tasks** | Change tasks assigned to them |
| **Upload evidence** | Attach proof to a finished task |
| **Approve evidence** | Review other people's proof and say yes or no |
| **Verify tasks** | Mark a task verified |
| **Log decisions** | Record a call the team made |
| **Approve decisions** | Sign off on a proposed decision |
| **Inject ad-hoc tasks** | Add unplanned work to an active quest |
| **Manage operations** | Zones, brands, channels, assets — and signing the daily close |
| **Manage inventory** | Adjust stock across zones |
| **Manage procurement** | Purchase orders and vendors |
| **Manage kitchen operations** | Prep batches, KDS, waste |
| **Manage POS & orders** | Take orders, take payment, dispatch |
| **Manage KPIs** | Create and edit performance metrics |
| **Manage guide content** | Write the guide |
| **Manage permissions** | Change this very screen |
| **Manage system** | Node, Modules, Usage, system settings |

Hover the little info mark next to any row for its full description.

Nothing saves as you click. A bar appears at the bottom saying **Unsaved changes** with **Discard** and **Save changes**. Click **Save changes** and you'll see **Permissions updated**.

> 💡 Your own **Founder/Admin** column is locked with a padlock and can't be unticked. That's a safety rail — you can't accidentally lock yourself out.

> ⚠️ Changes take up to 60 seconds to reach everyone. If a lead says "I still can't see it", wait a minute and have them refresh.

---

# 🤝 Delegations

**Sidebar → Admin → Delegations** (`https://www.konma.store/admin/delegations`)

Heading: **Approval Delegations**. This is what you use when someone who has to approve things goes away.

Without it, one person on leave stops every task in their domain. A delegation hands their approval power to someone else for a fixed window.

1. Click **Create Delegation**.
2. In **Delegating From (Absent User)**, choose the person who's away.
3. In **Delegate To**, choose who's covering. (This stays greyed out until you pick the first one.)
4. Set **Start** and **End** dates.
5. Click **Create Delegation**.

You'll see a message naming both people and the end date — *"Delegation created. {cover} can approve on behalf of {absent} until 14 Sep 2026."*

Live delegations sit under **Active**; each card shows both faces, the dates, and who set it up. Click **Deactivate** to end one early. Past ones hide behind **Show expired (N)**.

Nothing there yet? **No active delegations** — *"Set up a delegation so someone can approve things while another person is away."*

> ⚠️ This screen is yours alone. Nobody else — not even the Tech Lead — can open it.

---

# 📣 Notices

**Sidebar → Admin → Notices** (`https://www.konma.store/admin/notices`)

Heading: **Send Notice**. *"Broadcast a notification to all active team members"*

A single form. Three fields:

1. **Title** — up to 200 characters. The placeholder suggests *"e.g., Team standup at 3 PM today"*.
2. **Message** — up to 1000 characters. The full text.
3. **Link (optional)** — where the notice should take them, like `/dashboard` or `/operations/inventory`. The hint says: *"Users will be taken to this page when they click the notification"*.

Click **Send Notice to All**. The button says **Sending to all team members...**, then **Sent!**, and you get a count: **Notice sent to 8 team members**. The form clears itself.

> ⚠️ This lands in every active person's bell at once, and there is no undo and no edit. Read it twice before you send.

> 💡 Use this for things that are genuinely for everyone — a shutdown, a visit, a change of hours. Anything aimed at one person belongs in **Chat**.

---

# 📍 Zones

**Sidebar → Admin → Zones** (`https://www.konma.store/operations/zones`)

Heading: **Zones**. These are the villa's physical spaces — the ones stock lives in and work happens in. Seeded examples: **Main Kitchen**, **Prep Station**, **Dining Hall**, **Garden Terrace**, **Workshop Studio**, **Cold Storage**, **Office**, **Lounge**.

Filter with the tabs **All**, **Planned**, **Setup**, **Active**, **Inactive**, or use **Search zones...**.

To add one:

1. Click **Add Zone**.
2. Type a **Name** — *"e.g. Main Kitchen"*.
3. Pick a **Zone Type**: **Kitchen**, **Dining**, **Outdoor**, **Workspace**, **Storage** or **Leisure**.
4. Optionally set an **Owner (optional)** — the person accountable for it.
5. Optionally add **Notes (optional)**.
6. Click **Add Zone**.

Editing an existing zone adds a **Status** field so you can move it from **Planned** to **Setup** to **Active**.

Deleting asks first — **Delete Zone**, *"This will permanently remove this zone. This cannot be undone."*

Nothing there yet? **No Zones Yet** — *"Add the physical spaces your villa operates in."*

---

# 📡 Channels

**Sidebar → Admin → Channels** (`https://www.konma.store/operations/channels`)

Heading: **Channels**. These are the ways the villa sells. Seeded: **Dine-in**, **Delivery**, **Takeaway**, **Retail**, **Event**, **Workshop**, **Online** — all starting as **Planned**.

A simple table: **Channel**, **Type**, **Status**, **Action**.

The **Status** column is a switch. Flick it on and the channel goes live; flick it off and it stops. You'll see **Channel status updated.**

To add one:

1. Click **Add Channel**.
2. Type a **Name** — *"e.g. Dine-in Service"*.
3. Pick a **Channel Type**: **Dine-In**, **Takeaway**, **Delivery** or **Marketplace**.
4. Click **Add Channel**.

New channels always start as **Planned**. Switch them on when you're genuinely ready to take orders through them.

> 💡 Channels feed the **Sales Readiness** meter. Every channel you actually activate moves that number.

---

# 📥 Import

**Sidebar → Admin → Import** (`https://www.konma.store/admin/import`)

Heading: **Import**. *"Bulk import operational data from CSV or XLSX files"*

This is how you load a lot of things at once instead of typing them in one by one.

Across the top is a row of counters — **Ingredients**, **Vendors**, **Zones**, **Brands**, **Missions**, **Quests**, **Recipes (approved)**, **Product Categories** — showing what you already have. They turn green once there's something there.

The cards below are grouped into four tiers, and **the order matters**:

| Tier | What's in it | Why it's here |
|---|---|---|
| **Foundation Data** | Ingredients, Vendors, Vendor Pricing | Nothing else works without these |
| **Operations — Independent** | Opening Stock, Purchase Orders, Missions, KPIs, Events | These don't depend on each other |
| **Operations — Sequenced** | Quests, Tasks | Quests need Missions; Tasks need both |
| **Menu** | Recipes, Product Categories, Products | Products need approved Recipes and Categories |

A card that isn't ready yet says so: **Needs: Missions**, **Needs: Missions + Quests**, **Needs: Recipes + Categories**.

## Running an import

1. Click the card for what you're loading — say **Tasks**.
2. Click **Download Template (.xlsx)** or **Download Template (.csv)**. The template has the exact column names.
3. Fill it in, one row per thing.
4. Drag the file onto **Drag and drop your CSV or XLSX file here**, or click to browse.
5. Click **Parse File**.
6. Read the counts: `40 rows parsed`, `38 valid`, `2 invalid`. Every row shows its status — **Invalid**, **Blocked**, **Duplicate — will update** or a green tick.
7. Fix anything wrong. You can edit the bad cells right there.
8. Click **Import 38 Records**.

You get four result cards: **Imported**, **Updated**, **Skipped**, **Errors**.

## The "Update existing" switch

Above the preview there's a switch that changes what an import does with rows that already exist. What it says depends on what you're loading:

- Tasks: *"Update matching tasks. Completed tasks (status = "done") cannot be modified."*
- Quests: *"Update matching quests. Quests with status other than "planned" cannot be modified."*
- Events: *"Update matching events. Capacity cannot be reduced below existing bookings."*
- Recipes: *"Replace BOM lines for matching draft recipes. Approved recipes are never modified."*

> ⚠️ **Opening Stock is the one to be careful with.** Its own banner says it: *"Stock imports are ADDITIVE. Each row adds to current inventory. If you import this file twice, quantities will be doubled."* There is no undo. Import it once.

> 💡 Recipes are **XLSX only** — they need two sheets, one for the recipe and one for the ingredient lines. And they always arrive as drafts: *"Recipes import as drafts. Approve them in the app before linking to products."*

---

# 📖 Guide Editor

**Sidebar → Admin → Guide Editor** (`https://www.konma.store/admin/guide`)

Heading: **Guide Management**. *"Create and manage guide sections and pages for your team."*

This is where the **Guide** in everyone's header comes from. You write it.

## Making a section

1. Click **Add Section**.
2. Type a **Section title** — *"e.g. Kitchen Operations"*.
3. Add a **Description** — one line saying what it covers.
4. Pick a **Section Icon** from the grid.
5. Pick an **Accent Color** — **Terracotta**, **Olive**, **Amber**, **Blue**, **Green**, **Ochre**, **Rose** or **Stone**.
6. Under **Visible to roles**, tick the roles who should see it.
7. Click **Save Section**.

## Writing a page

1. Expand a section and click **Add Page** at the bottom of its list.
2. A page called **Untitled page** is created and the editor opens straight away.
3. Type a title in the box at the top.
4. Write in the body. The toolbar gives you **Heading 2**, **Heading 3**, **Heading 4**, **Paragraph**, **Bullet list**, **Ordered list**, **Insert image**, and three coloured callouts — **Insert tip callout**, **Insert warning callout**, **Insert info callout**.
5. It saves itself five seconds after you stop typing. Watch the corner: **Saving...** then **Saved**.
6. When it's ready, click **Publish**.

Until you publish, a banner says: *"This page is a draft. Only admins can see it."*

Drag order with the **Move section up** / **Move section down** and **Move page up** / **Move page down** buttons that appear when you hover.

> ⚠️ Deleting a section deletes everything inside it: **Delete "{title}"?** — *"This will permanently delete the section and all 5 pages inside it. This cannot be undone."*

> 💡 To check your work looks right for a particular role, go to the reader's **Guide** page and use the **Preview as role** dropdown. Pick a role, read it as they'd read it, then click **Back to your view**.

---

# 🏡 Node

**Sidebar → Admin → Node** (`https://www.konma.store/admin/node`)

Heading: **Node settings**. *"The operating node this deployment runs. Its time zone decides where every "today" boundary falls and its currency labels every price in the product."*

"Node" is the villa. There is exactly one.

Three things you can change, on the card headed **Node**:

- **Name** — what the villa is called wherever it's named.
- **Time zone** — searchable. This is important: it decides when "today" ends. The daily close, the morning brief and every date in the app follow it.
- **Currency** — a three-letter code like `INR`.

Click **Save changes**. You'll see **Node settings saved.**

A second card, **Not editable here**, shows the **Code**, **Status** and **Created** date read-only. As it says: *"v2.0 runs exactly one node. Code and status change through a migration, not this screen."*

> ⚠️ Changing the time zone shifts every business-day boundary in the villa. Don't do it casually, and never do it mid-day — a close computed before the change and one computed after will disagree about which orders belong to which day.

---

# ✅ Approvals across the villa

**Sidebar → Approvals** (`https://www.konma.store/approvals`)

Everyone who can approve sees this page, but you see the most: *"Everything waiting on your sign-off — tasks, recipes, decisions and evidence."*

Five tabs: **All**, **Tasks**, **Recipes**, **Decisions**, **Evidence**.

## The two gates, from your side

A finished task normally needs two separate yeses, and both land here:

- **The evidence gate.** Somebody attached proof. A reviewer says *this is real proof.* These rows sit under **Evidence**.
- **The policy gate.** The system looks at the task's **Domain** and works out who has to sign off on that kind of work. Those rows sit under **Tasks**.

Here's who the policy asks for, by domain:

| Task domain | Who must approve | How many |
|---|---|---|
| **Food** | Backend Lead **and** Frontend Lead | Both |
| **Business Intelligence** (pricing) | BI Lead **and** Frontend Lead | Both |
| **Procurement** (vendors) | Procurement Lead **and** Backend Lead | Both |
| **Design/Outreach** (experiences) | Frontend Lead **and** Design/Outreach Lead | Both |
| **Tech** | Tech Lead **and** Founder/Admin | Both |
| **Talent** (hiring) | Talent Lead **and** Founder/Admin | Both |
| **Operations** and everything else | The domain's lead — for Operations, that's **you** | One |

Each row tells you which rule it's under: **Single approver**, **Any 2 of the required roles**, or **Every required role**.

## Deciding

**Approve** fires immediately from the row — no dialog. **Reject** opens a small panel in the row asking **Why is this being sent back?** and requires **at least 10 characters**, then **Send feedback**.

## Override — your emergency exit

You alone get an **Override** button on every row. Use it when someone is on a plane and the villa can't wait.

1. Click **Override**.
2. The dialog says: **Override approval** — *"Bypassing the approval workflow. This action is recorded in the audit trail."*
3. Write a **Reason** — at least 10 characters, and write it for whoever reads it in six months.
4. Click **Override and approve**.

You'll see **Approval overridden. Validation cascade triggered.**

> ⚠️ An override is permanent and permanently attributed to you. If you find yourself overriding regularly, the approval policy is wrong — fix the policy, not the symptom. And a **Delegation** is almost always the better answer for planned absence.

---

# 🌙 The Daily Close

**Sidebar → Commerce → Daily Close** (`https://www.konma.store/operations/daily-close`)

Heading: **Daily Close**. *"One signed record per business day. The numbers are frozen when they are computed and frozen for good when they are signed — nothing on this screen is recalculated as you read it."*

Every night at **00:45** villa time the system totals up the previous day and files it. In the morning, somebody signs it. That signature is what turns a set of numbers into a record.

## Reading a day

The top card has a **Business day** date picker with **Previous day** / **Next day** arrows and a **Yesterday** shortcut. Underneath, a **Recent:** strip of the last fortnight — a padlock means signed, a clock means still open.

Beside the date sits the status:

- **Open · computed 30 Aug 2026, 12:45 am** — the numbers exist, nobody has signed.
- **Signed by {name} · 30 Aug 2026, 9:12 am** — done and frozen.

Five cards of numbers, in order:

| Card | What's in it |
|---|---|
| **Orders & revenue** | Orders and revenue per channel — **Dine-In**, **Takeaway**, **Delivery**, **Marketplace** — then the money broken down: **Item subtotal**, **Channel modifier**, **Discounts**, **Shipping**, **Revenue**, **of which GST**, **Net of GST**. Plus **Cancelled**, **Refunded orders**, **Refunds processed** and **Refunded amount**. |
| **Waste** | **Entries** and **Cost**, split by reason: **Spoilage**, **Over-Prep**, **Cooking Error**, **Expired**, **Other**. |
| **Prep batches** | **Opened** and **Opened and depleted**. |
| **Stock reconciliation** | **Stock rows checked**, **Drifted**, **Last drift recorded**. A green **Clean** badge means the books agree. |
| **Shipments** | **Still open**, **Failed**, **Delivered**, **Cancelled**. |

## Recomputing

If something landed late — a refund, a corrected waste entry — click **Recompute**. The whole day is rebuilt from scratch and you'll see **{date} recomputed.**

If the nightly job was missed entirely, the page says **No close has been computed for {date}** and offers a **Compute {date}** button.

> 💡 Recompute an open day as many times as you like. It costs nothing and nobody is misled — the numbers just get more correct.

## Signing

Only the **Frontend Lead** and the **Founder/Admin** can sign. The card explains why: *"Sign-off is reserved for the Frontend Lead and the Founder/Admin — running operations and being accountable for the day are different claims."*

1. Read the numbers above. All of them.
2. In **Note (optional)**, write anything a reader would need a year from now — *"Power cut 19:00–20:30, two orders comped"*.
3. Click **Sign off**.
4. A confirmation appears: **Sign off on 2026-08-29?** — *"A signed close is frozen and cannot be recomputed. The figures on this screen become the permanent record of the day, and there is no way to unsign it."*
5. Click **Sign and freeze**.

You'll see **{date} is signed. The numbers are now frozen.**

> ⚠️ There is no unsign. Recompute *before* you sign, never after — a recompute on a signed day returns the frozen numbers unchanged, which is exactly what the signature bought you.

> 💡 The **Daily close ready for …** notification takes you to this screen but always lands on yesterday. If you're catching up on an older missed day, pick the date manually with the picker.

---

# ☀️ The Morning Brief

At **7:00 am** villa time, every day, the system writes one short summary of yesterday and delivers it to the leads — Founder/Admin, Backend Lead, Frontend Lead, BI Lead and Procurement Lead.

It appears as a card at the top of the **Status** section on your **Mission Control** dashboard, and as a **Morning Brief** notification in the bell.

What goes into it:

- Yesterday's orders, revenue and waste — read straight from the **Daily Close**, never recalculated. (If no close was computed, the brief says so.)
- The readiness meters that moved most over the last 7 days.
- How many approvals are waiting, how many tasks are blocked, how many decisions have been sitting more than a week.
- Open and failed shipments.
- Up to eight ingredients below their minimum, worst first.

Then a short **Today:** list — *"Clear 2 waiting approval(s)."*, *"Unblock 1 task(s)."*

> 💡 The brief and the Daily Close can never disagree, because the brief reads the close rather than doing its own maths. If the brief looks wrong, recompute the close and tomorrow's brief will be right.

> ⚠️ There is **no button in the app** to regenerate a brief. It runs on the 7:00 am schedule, and a 20-hour cooldown stops a second one landing the same day. If you need one out of cycle — say the close was recomputed after a correction — ask the Tech Lead to trigger it.

---

# 🌟 Worked example: one task, end to end

This is the whole system in one lap. Create a task, wire it to a meter, walk both approval gates, watch the readiness page change, and check the activity log.

Give it fifteen minutes and one willing teammate.

## Part 1 — Set the stage

- [ ] Open **https://www.konma.store/missions**. Confirm there is at least one mission. If not, click **New mission**, give it a **Title**, a **Description**, a **Phase** and a **Scope**, and click **Create mission**.
- [ ] Open **https://www.konma.store/quests**. Confirm there's a quest in that mission. If not, click **New quest** and create one.

> 💡 Tasks always live inside a quest, and quests inside a mission. That's what makes the weekly picture add up.

## Part 2 — Create the task

- [ ] Open **https://www.konma.store/tasks**.
- [ ] Click **New task** at the top right. A panel slides in from the right headed **New task**.
- [ ] Pick your **Mission** from the dropdown.
- [ ] Pick your **Quest**. The rest of the form appears.
- [ ] In **Title**, type: `Restock the welcome-drink station`
- [ ] In **Description**, type something a reviewer can check against: `Top up glasses, ice, garnish and the cold-brew carafe at the welcome station. Photograph the finished station.`
- [ ] Leave **Task type** as **Core**.
- [ ] Set **Domain** to **Operations**.
- [ ] In **Assigned to**, pick a teammate — not yourself.
- [ ] Set **Priority** to **Medium**.
- [ ] Leave **XP** at `25`.
- [ ] Set a **Due date** of today.
- [ ] Click **Create task**. You'll see **Task created.**

> 💡 **You didn't tick an "approval required" box, and you didn't need to.** Every task requires approval by default. Choosing **Operations** as the domain is what decided *who*: the Operations lead is the Founder/Admin, so exactly one approval row was created — and it's yours. Pick **Food** instead and you'd have created two rows, one for the Backend Lead and one for the Frontend Lead.

## Part 3 — Wire it to a readiness meter

Tasks don't feed a meter unless somebody says which one. That connection is made through **Import**.

- [ ] Open **https://www.konma.store/admin/import**.
- [ ] Click the **Tasks** card, under **Operations — Sequenced**.
- [ ] Click **Download Template (.csv)**.
- [ ] Open the file and fill in **one row**, matching the task you just made exactly:

| Column | Value |
|---|---|
| `title` | `Restock the welcome-drink station` |
| `description` | the same description you used |
| `mission` | your mission's exact title |
| `quest` | your quest's exact title |
| `owner_email` | your teammate's `@konma.store` address |
| `task_type` | `core` |
| `domain` | `ops` |
| `priority` | `medium` |
| `readiness_meter` | `Villa Readiness` |

- [ ] Save the file and drag it onto the upload area.
- [ ] Turn **on** the **Update existing** switch — *"Update matching tasks. Completed tasks (status = "done") cannot be modified."*
- [ ] Click **Parse File**. Your row should show **Duplicate — will update**.
- [ ] Click **Import 1 Records**. The **Updated** card should read `1`.
- [ ] Go back to **https://www.konma.store/tasks** and open the task. A small gauge chip now sits on it reading **Villa Readiness**.

> ⚠️ Do this **before** the task reaches **Done** — a completed task can't be updated by an import.

> ⚠️ The import wires the *connection* but not the *points*. A task connected this way is worth zero points, so the ring on **Readiness** won't jump for this one task. What it will do is join the meter's **Contributing tasks** list and trigger a recalculation — which is what you're about to watch. Point values are set when work is loaded from the planning blueprint; ask the Tech Lead if you need one set by hand.

## Part 4 — Your teammate does the work

Ask them to do this on their own login:

- [ ] Open **My Tasks** and click **Restock the welcome-drink station**.
- [ ] In the **Status** section, change the dropdown to **Doing**.
- [ ] Do the actual job at the actual station.
- [ ] Scroll to **Evidence** and either drop in a photo, or click **Add a link** and paste one, or click **Add a note** and describe what they did. All three count.
- [ ] Change **Status** to **Done**.

They'll now see a card headed **Validation required** with a `1/3` ring and three lines: **Status is Done** ticked green, **At least one evidence approved** still grey, **All required approvals satisfied** still grey.

That's the task waiting on you.

## Part 5 — Gate 1: approve the evidence

- [ ] Open **https://www.konma.store/approvals**.
- [ ] Click the **Evidence** tab.
- [ ] Find the row for the task. It shows how long it's been waiting.
- [ ] Look at what they actually attached. Does it prove the station is restocked?
- [ ] Click **Approve**. The row vanishes and you'll see **Approved.**

If it doesn't prove it, click **Reject** instead, write at least ten characters saying exactly what's missing — *"The photo shows the counter but not the carafe or the ice — retake with both in frame."* — and click **Send feedback**.

> ⚠️ For everyone else on the team, approving their own work is blocked outright — the system answers **You cannot approve your own work**, for their own evidence and for tasks they own. **You are the exception**, so the villa is never deadlocked. Use that exception sparingly: a gate you close yourself proves nothing.

> 💡 This is why the worked example asks you to assign the task to a *teammate*. Assign it to yourself and you'd be marking your own homework.

## Part 6 — Gate 2: approve the task

- [ ] Still on **https://www.konma.store/approvals**, click the **Tasks** tab.
- [ ] Find the same task. Its row says **Single approver** — that's the Operations policy, and you're the approver.
- [ ] Click **Approve**.

Both gates are now closed.

> 💡 You could also have done both of these from the task page itself. Open any task you owe a decision on and there's a warning-tinted block headed **Waiting on your sign-off** with the same **Approve** and **Reject** buttons.

## Part 7 — Watch it land

- [ ] Open the task at **https://www.konma.store/tasks** and click into it.
- [ ] The Validation card now shows a **Valid** badge, the words **Task validated**, and a `3/3` ring. All three lines are green.
- [ ] Your teammate's XP has gone up. Their header chip shows it.
- [ ] Open **https://www.konma.store/readiness**.
- [ ] Find **Villa Readiness** under the **Task-driven** section. Its badge reads **Task-driven** — *"Moves only when a task is validated with approved evidence."*
- [ ] Click the ring. A panel opens below it.
- [ ] Look at **Contributing tasks**. **Restock the welcome-drink station** is now in that list, with your teammate's name and when it validated.

That list *is* the meter. Nothing else touches it. Every task in it earned its place by being done, evidenced and approved — and the number at the top of the ring is the sum of exactly that.

> 💡 It works in reverse too. If a task ever stops meeting all three conditions — the status moves back off **Done**, or a fresh piece of evidence is rejected — the task loses **Valid**, the XP comes off, and it drops out of **Contributing tasks**. The meter recalculates on the spot. Nothing in this system is true until it's earned, and nothing stays true if the ground moves.

> ⚠️ Once you've clicked **Approve** on a piece of evidence, the buttons disappear from it. A decision is a decision. If it turns out to be wrong, the honest fix is a new task and new evidence, not a rewritten record.

## Part 8 — See the day's activity

- [ ] Open **https://www.konma.store/admin/usage**.
- [ ] Leave the window on **30 days**.
- [ ] Look at **Key actions**. You should see `task.create`, `task.status_change`, `evidence.upload`, `approval.decide`, `task.validate` and `import.run` — one for each thing that just happened.
- [ ] Look at **Who was active**. You and your teammate are both there, with today's page views and actions and a **Last seen** of a few minutes ago.
- [ ] Look at **Busiest screens**. `/tasks` and `/approvals` should be near the top.

That's the whole lap, and it's all recorded.

---

# 📌 Quick reference

| I want to… | Go to |
|---|---|
| Add someone to the team | **Admin → Users** → **Add team member** |
| Give someone their phone / WhatsApp settings | **Admin → Users** → ⋯ → **Contact & notifications** |
| Reset someone's password | **Admin → Users** → ⋯ → **Send password reset email** |
| Show or hide a screen for a role | **Admin → Modules** |
| Change what a role is allowed to *do* | **Admin → Permissions** |
| Cover someone who's on leave | **Admin → Delegations** |
| Tell the whole team something | **Admin → Notices** |
| Turn the leaderboard off | **Admin → Settings** |
| Change quiet hours or nudge cooldowns | **Admin → Settings** → **Notifications** |
| Load a lot of data at once | **Admin → Import** |
| Write a how-to for the team | **Admin → Guide Editor** |
| Change the villa's time zone or currency | **Admin → Node** |
| See who's actually using the app | **Admin → Usage** |
| Add a physical space | **Admin → Zones** |
| Turn a sales channel on | **Admin → Channels** |
| Sign off yesterday's numbers | **Commerce → Daily Close** |
| Clear the approval queue | **Approvals** |
| See whether the villa is actually getting ready | **Readiness** |

> 🏡 Two habits and this system runs itself: clear the **Approvals** queue every morning, and sign the **Daily Close** before you do anything else. Everything downstream — the readiness numbers, the morning brief, the team's XP — depends on those two.
