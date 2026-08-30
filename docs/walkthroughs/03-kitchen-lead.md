> 🍳 **Welcome, Kitchen Lead.** In Konma this role is called **Backend Lead** — "Food, production, R&D, standardization, quality." You run what comes out of the kitchen: the tickets, the batches, the recipes, and the honest record of what got thrown away. This guide walks through every screen you'll see, in the order a normal day uses them. Nothing here needs any technical knowledge. Take it one screen at a time.

Sign in at **https://www.konma.store/sign-in** with your email — `sadhana@konma.store`. Your password is yours; nobody should ever ask you for it, and it isn't written down anywhere in this guide.

---

# 🧭 What you'll see on the left

After you sign in, there's a menu down the left side of every screen. Yours has two parts.

**Always at the top:**

| Menu item | What it's for |
| --- | --- |
| **Mission Control** | Your home screen — today at a glance |
| **My Tasks** | The jobs assigned to you |
| **My Quests** | The bigger pieces of work your tasks belong to |
| **Evidence** | Photos and proof people have uploaded |
| **Approvals** | Things waiting on your sign-off |
| **Decisions** | Decisions the team has recorded |
| **Readiness** | How ready the villa is, meter by meter |
| **Team** | Who's doing what |

**Then a group called "Kitchen"** — this is your day:

| Menu item | Where it goes |
| --- | --- |
| **Kitchen Overview** | https://www.konma.store/operations/kitchen/dashboard |
| **KDS** | https://www.konma.store/operations/kitchen/kds |
| **Pick & Pack** | https://www.konma.store/operations/kitchen/pick-and-pack |
| **Prep Batches** | https://www.konma.store/operations/kitchen/prep-batches |
| **Recipes** | https://www.konma.store/operations/recipes |
| **Ingredients** | https://www.konma.store/operations/ingredients |
| **Supply Usage** | https://www.konma.store/operations/kitchen/supply-usage |
| **Waste Log** | https://www.konma.store/operations/kitchen/waste |

You'll also see a **Procurement** group (Inventory, Purchase Orders, Vendors and so on). Those screens belong to the Procurement Lead and have their own guide — you can look, but you won't usually be the one acting there.

At the top of the screen there's a **Guide** link and a **Chat** link, and a little bell for your notifications.

> 💡 If a menu item is missing, or a button says you don't have permission, that isn't a mistake you made. Which buttons work is switched on per role by your admin on the Permissions screen. The one you need for kitchen work is called **"Manage kitchen operations"**. Ask your admin to turn it on for the Backend Lead role.

---

# ☀️ 1. Kitchen Overview — start your day here

**Kitchen Overview** (https://www.konma.store/operations/kitchen/dashboard) is the calm version of everything. Open it with your first coffee.

Across the top you get four boxes:

| Box | What it means |
| --- | --- |
| **In Queue** | Orders waiting to be cooked right now |
| **Completed Today** | Items you and the team have finished today |
| **Avg Prep Time** | How long an item takes on average, in minutes |
| **Waste Today** | Today's waste in rupees, with the percentage of production underneath |

Below that:

- **Zone Utilization** — a little bar per kitchen zone (Main Kitchen, Prep Station, and so on) showing how many live orders each one is holding. If there's been no activity yet you'll see "No zone activity yet today."
- **Active Prep Batches** — everything you've batched that's still usable: **Recipe**, **Qty Remaining**, **Expires At**, **Status**. Anything expiring within two hours turns amber, so it catches your eye.

The numbers refresh on their own every half minute. There's nothing to click unless you want to.

---

# 🖥️ 2. KDS — the kitchen display

**KDS** (https://www.konma.store/operations/kitchen/kds) is the screen you stand in front of during service. It fills the whole display and stays dark on purpose — it's easier to read across a hot kitchen.

## How tickets arrive

You don't fetch anything. When someone takes an order out front, the ticket appears here by itself, within a second or two. If the connection wobbles you'll see a red strip saying **"Connection issue — retrying..."** and a **Retry now** button. It sorts itself out.

Each order is one card, sitting in the column for its kitchen zone. On the card:

- The big **#number** — the order number
- The customer's name underneath, if there is one
- A **timer** in the corner, counting up since the order was placed
- One row per item: the dish name, **×2** for quantity, and any special note from the customer in amber

An order that arrived in the last minute gets a moving glow around its edge, so a new ticket is impossible to miss.

> 💡 Only **made-from-scratch** dishes show up on the KDS. Anything pre-batched, assembled or straight off the shelf goes to **Pick & Pack** instead. If a ticket seems to be missing an item, check there.

## Working a ticket

Every item has a small status label. There are three, and they only ever go forwards:

| Label | Plain meaning | What to do |
| --- | --- | --- |
| **Pending** | Nobody's started it | Tap it when you pick it up |
| **Preparing** | It's on the stove | Tap it when it's plated and ready |
| **Ready** | Done | Nothing — it goes dim and stops responding |

1. Find the item on the card.
2. **Tap the item row once.** It moves from **Pending** to **Preparing**, and a small message confirms it.
3. Cook it.
4. **Tap the same row again.** It moves to **Ready** and dims out.

That's the whole interaction. One tap per step, no forms.

## What marking Ready actually does

This is the important bit, and it's worth knowing because it's the moment the books move.

The instant you tap an item to **Ready**, the system quietly takes that dish's ingredients off the shelf — and if the dish uses a prep batch, it takes it out of that batch's remaining quantity. Stock goes down by exactly what the recipe says the dish needed.

And when **every** item on a ticket is **Ready**, the whole order flips to Ready — front-of-house is told it can go out — and the card fades off your screen about thirty seconds later, so the board only ever shows live work.

So: mark things Ready as they genuinely become ready, not in a batch at the end of service. The stock numbers, and everything built on them, are only as truthful as your taps.

## The top bar

Along the top of the KDS you get a small live readout — **Orders**, **Completed Today**, and **Waste** as a percentage (green under 5%, amber up to 10%, red above). There's an export button for the waste log, and an **✕** in the corner that closes the display and drops you on **Prep Batches**.

When there's nothing to cook you'll see **"No orders in queue"** and a friendly note that orders placed out front will appear here automatically. That's a good sign, not a broken screen.

---

# 📦 3. Pick & Pack — everything that isn't cooked to order

**Pick & Pack** (https://www.konma.store/operations/kitchen/pick-and-pack) catches the other half of an order: the pre-batched, the assembled, and the things that just come off a shelf.

One card per order, oldest at the top, with the order number, the customer, the channel (dine-in, takeaway and so on) and a timer. Each item carries a coloured tag telling you how it's handled:

| Tag | Meaning |
| --- | --- |
| **Fresh Prep** | Made per order |
| **Batch Prepared** | Comes out of a batch you already made |
| **Ready to Sell** | Straight off the shelf |
| **Assembly** | Put together from parts |

1. Pick the item off the shelf or out of the batch.
2. **Tap the item row.** It gets a green tick and a line through it.
3. Repeat for the rest of the card.

**Assembly** items work slightly differently: instead of one tap, they open a little checklist of their parts, each with a quantity. Tick each part as you add it. When they're all ticked, a **Mark Complete** button appears — press that.

When every line on a card is ticked, a green **Order Ready** banner appears across the bottom and the card fades away half a minute later.

If there's nothing waiting you'll see **"Nothing to pack."**

---

# 🥘 4. Prep Batches — cooking ahead

**Prep Batches** (https://www.konma.store/operations/kitchen/prep-batches) is where you record the things you make in bulk in the morning: a gravy base, a chai concentrate, a spice blend.

The table shows every batch: **Recipe**, **Qty Remaining**, **Qty Produced**, **Unit**, **Expires In**, **Status**. Status is one of:

| Status | Meaning |
| --- | --- |
| **Active** | Still good, still has quantity left |
| **Depleted** | All used up |
| **Expired** | Past its shelf life |

## Starting a batch

Press **New Batch** in the top right. A panel slides in from the side with three steps.

1. **Step 1 — Create Prep Batch.** Pick the **Recipe** from the dropdown (only approved recipes appear here), type the **Quantity** you're making, choose the **Zone** you're making it in — Main Kitchen, Prep Station, and so on. Press **Next**.
2. **Step 2 — Review Deductions.** The system shows you exactly what this batch will use: one row per input with **Available**, **Required**, **Unit** and a status of **OK** or **Insufficient**. If everything says OK, press **Next**.
3. **Step 3 — Confirm Batch.** A short summary — recipe, quantity, zone, and how many inputs will come off the shelf. Press **Start Batch**.

You'll get a small confirmation reading "Prep batch started," and the batch appears in the table as **Active**.

> ⚠️ If step 2 shows any row as **Insufficient**, the **Next** button won't work and hovering it explains why. That's the system stopping you from promising a batch the store room can't actually supply. Tell the Procurement Lead what's short, or scale the batch down and try again.

## How a batch gets used up

You don't have to do anything to run a batch down. Every time an order that uses it is marked **Ready**, the batch's **Qty Remaining** drops automatically. When it reaches zero the status becomes **Depleted** on its own.

**Expiry is automatic too.** Every hour, the system looks for active batches that have passed their **Expires In** time. Those become **Expired**, and whatever quantity was still sitting in them is written straight into the **Waste Log** with the reason **Expired**, logged by "System". You don't have to log it yourself — but you will see it in the waste numbers, which is exactly the point.

If nothing is batched you'll see **"No active prep batches"** and a nudge to tap **New Batch**.

---

# 📖 5. Recipes — the standard

**Recipes** (https://www.konma.store/operations/recipes) is the villa's cookbook and its cost book at the same time.

The main screen is a grid of cards. Each card shows the recipe name, a status badge, the brand and zone it belongs to, its yield, and a rupee figure. You can narrow the list with **All Brands**, **All Statuses**, and a **Search recipes...** box.

## Reading a recipe

Click any card to open it. Down the left you'll find:

- **Preparation Type** — one of **Fresh Prep** (made per order), **Batch Prepared** (pre-batched), **Ready to Sell** (off the shelf), or **Assembly** (combine parts)
- **Brand**, **Zone**, **Yield Qty**, **Yield Unit**, **Portion Size**, **Shelf Life (hrs)** and a **Description**
- **Bill of Materials** — the ingredient list, with columns for **Type**, **Item**, **Qty**, **Unit**, **Prep Notes** and **Cost**
- **Prep Steps** and **Cooking Method** written out in full

Down the right sits a **Cost Preview** panel with **Batch Cost** and **Per Portion** in rupees.

**Where that cost comes from, in one sentence:** the system takes the most recent price the Procurement Lead recorded for each ingredient on the vendor screen, converts it into the units your recipe uses, and adds up the whole Bill of Materials.

So if a cost looks wrong, it's almost never the recipe — it's a vendor price that's out of date. And if the panel says **"Cost unavailable — add vendor prices to ingredients to calculate batch cost,"** or lists ingredients as **missing prices**, that's the same story: nobody has told the system what those ingredients cost yet.

## Statuses and approval

| Status | What it means |
| --- | --- |
| **Draft** | Being worked on — freely editable |
| **Pending Approval** | Submitted, waiting for sign-offs |
| **Approved** | Locked. This is the standard now |
| **Archived** | Retired |

A draft has a **Submit for Approval** button. Once submitted, a banner shows **"Awaiting approval — 1 of 2 signed off"** with a row per required role, and an **Approve** or **Reject** button appears on the row that's yours to decide. Food recipes need two sign-offs, and one of them is yours.

An approved recipe says **"Approved — locked for editing"** and can't be changed — that's deliberate, so the standard stays a standard. To change it, press **Create New Version**: the current one is archived and you get a fresh draft copy to edit and re-submit.

> 💡 Only **Approved** recipes appear in the Prep Batches dropdown. If a recipe you want to batch isn't in the list, check its status first.

---

# 🥬 6. Ingredients — the raw materials list

**Ingredients** (https://www.konma.store/operations/ingredients) is the master list of everything your recipes are built from.

Across the top are category tabs — **All**, Dairy, Vegetables, Spices (dried), Grains & Cereals and the rest — plus a **Search ingredients...** box.

The table shows **Name**, **Category**, **Base Unit**, **Min Stock Level**, **Stock**, **Recipes** and **Actions**.

Two columns are worth knowing well:

- **Stock** shows what's actually on hand. If it's below the minimum, an amber **Low Stock** badge appears next to it, and hovering it tells you the minimum.
- **Recipes** shows which recipes use this ingredient, as little clickable tags. Before you change or retire anything, glance here — this is how you know what you'd be affecting.

Press **Add Ingredient** (or the pencil on a row) to open the side panel. You'll pick an **Item Type** first:

| Item type | Use it for |
| --- | --- |
| **Recipe Ingredient** | Actual food that goes into recipes |
| **Disposable Supply** | Napkins, containers, packaging |
| **Reusable Equipment** | Tools and kit |

Then **Name**, **Category**, **Base Unit** and **Min Stock Level** — the number that decides when something counts as running low. Supplies and equipment don't appear in recipes; the form tells you so as you pick.

---

# 🧻 7. Supply Usage — the non-food things

**Supply Usage** (https://www.konma.store/operations/kitchen/supply-usage) is for the things that get used up but never go in a dish: takeaway boxes, cling film, gloves.

On the left is the history — **Date**, **Supply**, **Qty**, **Unit**, **Notes**, **By**. On the right is a small **Log Usage** card.

1. Choose the **Supply**. Only items marked as **Disposable Supply** show up here.
2. Type the **Quantity**. The **Unit** fills in for you.
3. Choose the **Zone**.
4. Add **Notes** if there's anything worth saying.
5. Press **Log Usage**.

If nothing's been logged yet you'll see **"No usage logged yet"** and a suggestion to fill this in at the end of each shift — which is genuinely the easiest time to do it.

---

# 🗑️ 8. Waste Log — the honest number

**Waste Log** (https://www.konma.store/operations/kitchen/waste) is the screen that matters most and takes the least time.

On the left, everything logged so far: **Date**, **Type**, **Item**, **Qty**, **Reason**, **Cost Impact**, **Logged By**. On the right, a **Log Waste** card.

## Logging waste

1. Choose the **Type**: **Ingredient** (something raw) or **Prep Batch** (something you'd already made).
2. Choose the **Item**. For a prep batch, the list helpfully shows how much is left in each one.
3. Enter the **Quantity**. The **Unit** fills itself in from the item.
4. Choose the **Reason**:

| Reason | When to use it |
| --- | --- |
| **Spoilage** | It went off |
| **Over-Prep** | You made more than the day needed |
| **Cooking Error** | It burned, split, or otherwise didn't work |
| **Expired** | Past its date |
| **Other** | Anything else — please add a note |

5. Add **Notes** if the reason needs context. It's optional but it's often the useful part.
6. Choose the **Zone**.
7. Press **Log Waste**.

You'll get a confirmation and a **Cost Impact** figure in rupees, worked out for you: raw ingredients are priced at the latest vendor price, and a wasted prep batch is priced as its share of what that whole batch cost to make.

Logging waste also adjusts the real numbers — an ingredient comes off the shelf, and a prep batch's remaining quantity drops (and goes **Depleted** if that empties it). You never need to "also" adjust stock afterwards.

## Where that number goes

Your waste figure isn't filed away in a drawer. It shows up in four places:

- The **Waste** percentage in the KDS top bar, live during service
- **Waste Today** on your **Kitchen Overview**
- The **Daily Close** — a "Waste" card showing the day's entries, what they cost, and a breakdown by reason, costliest first
- The **food-cost report**, where waste is one of the four things counted as food leaving the store room

> 💡 **Log it honestly, log it small, log it now.** Waste that's recorded is a number somebody can act on — a portion size to adjust, a batch to make smaller, a delivery to move earlier in the week. Waste that isn't recorded doesn't disappear; it turns up later as an unexplained gap between what the recipes say you used and what actually left the store room, and nobody can fix a gap. Nobody is judged on a waste entry. The only bad number is a hidden one.

---

# 🔔 9. Your notifications

There's a bell at the top of every screen. A red number means something new. Click it for the recent list, use **Mark all as read** to clear it, or **View all** to see the full history.

What normally lands there for you:

| Notification | What it's telling you |
| --- | --- |
| **Still blocked: <task name>** | A task of yours has been sitting blocked. The reason is in the message. It repeats until you unblock it or explain why |
| **An approval is waiting** | Something needs your sign-off — usually a recipe. Head to **Approvals** |
| **Task due** | One of your tasks is coming up |
| **Morning brief** | The short summary of the day ahead |

Low-stock warnings don't come to you — they go to the Procurement Lead, who owns ordering. If you notice something running out during service, tell them; you don't need to raise anything yourself.

---

# 🌙 10. The nightly stock check

Every night at 2:30 in the morning, the system quietly compares its books against the record of every single movement — everything received, cooked, wasted and adjusted — and notes anywhere the two don't agree.

It doesn't change anything and nobody is in trouble. Think of it as a torch, not an audit: it just makes sure that if a number ever starts drifting, somebody finds out the next morning rather than two months later while counting a freezer.

---

# 🌟 A worked example: one lunch service

Try this end-to-end once and the rest will feel obvious. It uses the dishes already in the system.

**Before service — batch the gravy**

- [ ] Open **Prep Batches** (https://www.konma.store/operations/kitchen/prep-batches)
- [ ] Press **New Batch**
- [ ] Recipe: **Butter Chicken Base**. Quantity: **5**. Zone: **Main Kitchen**. Press **Next**
- [ ] On **Review Deductions**, check every row says **OK** — this batch needs chicken thigh, cream, tomato and cardamom. Press **Next**
- [ ] On **Confirm Batch**, check the summary reads Butter Chicken Base, 5, Main Kitchen. Press **Start Batch**
- [ ] Watch it appear in the table as **Active**, with its **Qty Remaining** at 5 and an **Expires In** roughly two days out

**During service — work a ticket**

- [ ] Open **KDS** (https://www.konma.store/operations/kitchen/kds)
- [ ] Find the card for the order containing **Konma Signature Thali**. Note the timer running in its corner
- [ ] **Tap the thali row.** It turns **Preparing**
- [ ] Cook it: rice, dal, tomato curry, plated
- [ ] **Tap the thali row again.** It turns **Ready** and dims. Behind the scenes, the basmati, toor dal, tomato and coriander seeds just came off the shelf
- [ ] If the same order also had a **Smoked Butter Chicken Bowl** or a **Terrace Garden Salad**, those won't be on this screen — pop over to **Pick & Pack** and tick them off there. The bowl carries a **Batch Prepared** tag and draws from the batch you made this morning; the salad carries an **Assembly** tag and opens a checklist of its parts
- [ ] Once every line on the ticket is done, the card shows as complete and fades away

**After service — log the waste**

- [ ] Open **Waste Log** (https://www.konma.store/operations/kitchen/waste)
- [ ] Type: **Ingredient**. Item: **Tomato**. Quantity: **0.4**. The unit fills in as **kg**
- [ ] Reason: **Spoilage**. Notes: *"Two soft at the bottom of the crate."*
- [ ] Zone: **Main Kitchen**
- [ ] Press **Log Waste**
- [ ] Read the **Cost Impact** box — that's what those two tomatoes actually cost the villa. Your entry is now the top row of the table with your name in **Logged By**

**Close the loop**

- [ ] Open **Kitchen Overview** (https://www.konma.store/operations/kitchen/dashboard)
- [ ] **Completed Today** has gone up by the items you marked ready
- [ ] **Waste Today** now includes your tomatoes, with the percentage of production underneath
- [ ] **Active Prep Batches** shows your Butter Chicken Base with a lower **Qty Remaining** than you started with — that's the bowls that went out

That's the whole loop: cook it, mark it, record it. The numbers take care of themselves.

---

# 🆘 When something looks wrong

| What you see | What's going on | What to do |
| --- | --- | --- |
| An item won't move past **Ready** | That's the end of the line for the kitchen. Front-of-house takes it from here | Nothing |
| A dish isn't on the **KDS** | It isn't made-from-scratch | Check **Pick & Pack** |
| A recipe isn't in the **New Batch** dropdown | It isn't **Approved** yet | Open it in **Recipes** and check its status |
| **Next** is greyed out in the batch wizard | Something's short in the store room | Hover it to see why, then tell the Procurement Lead |
| A recipe's cost says **unavailable** | An ingredient has no vendor price | Ask the Procurement Lead to add one |
| **"Connection issue — retrying..."** on the KDS | The network hiccupped | Wait a moment, or press **Retry now** |
| A button says you don't have permission | A setting on your role, not a mistake | Ask your admin for **"Manage kitchen operations"** on the Permissions screen |

Anything else, the **Guide** link at the top of every screen has more, and **Chat** puts you in touch with the rest of the team.
