> 📊 **Welcome, BI Lead.** You are the person who tells everyone else what the numbers actually mean. Your job in Konma Xperience OS is **costing, pricing, KPIs and performance analytics** — reading what the kitchen, the shop and the guests did, then turning it into a number the team can act on. Nothing on your screens is a spreadsheet you have to build. It is already built. You read it, you spot the odd thing, and you tell the right person.

Sign in at **https://www.konma.store/sign-in** with **hasmitha@konma.store**.

---

# 🧭 What you see in the sidebar

When you sign in, the left-hand menu is built for you and only you. Here is your whole world.

| Where | What it is |
| --- | --- |
| **Mission Control** | The team's home page — what everyone is working on right now |
| **My Tasks** | Jobs assigned to you |
| **My Quests** | The bigger pieces of work your tasks sit inside |
| **Evidence** | Photos and proof people have attached to finished work |
| **Decisions** | The team's written record of choices made |
| **Readiness** | How prepared the villa is, as meters |
| **Team** | Everyone, their scores and their wins |

Then a group called **Intelligence** — this is your desk:

| Where | What it is |
| --- | --- |
| **Analytics** | Sales, revenue and item performance |
| **KPIs** | The targets you set and track |
| **Feedback** | What guests said about their orders |
| **Exports** | A history of every file anyone downloaded |

At the top of every page you also have **Guide** and **Chat**.

> 💡 You will **not** see an **Approvals** item. That is correct — approving other people's evidence is not part of your role. You can still *look* at evidence on the **Evidence** page.

> ⚠️ There is one more page that is **not in the sidebar**: **Food Cost**. It is deliberately reached from a button on the Analytics page, and it is one of the most important screens you own. It is covered in full below.

---

# 💰 A note about money before you start

Every screen shows money the way you would say it out loud — **₹480**, **₹4,500**, **₹1,290**. Behind the scenes the system stores some numbers in paise (the hundredths of a rupee), but **you never see that and you never convert anything**. If a screen shows ₹80.00, it means eighty rupees.

The only thing to remember: **large numbers get shortened on chart edges** — `₹4.5k` on a chart axis means ₹4,500.

---

# 📈 Analytics

Sidebar → **Analytics**. The page title is **Analytics**.

## Choosing your window

Along the top right you have four buttons and one extra:

1. Click **Today** for just today.
2. Click **7 days** for the last seven days — *this is what the page opens on*.
3. Click **30 days** for the last thirty days.
4. Click **Custom**, pick a **From** date and a **To** date, then click **Apply Range**.

Everything on the page — every card, every chart, every table — redraws for the window you chose.

Two more buttons sit beside them:

- **Food Cost** — takes you to the Food Cost report (the next section).
- **Export** — downloads what you are looking at. Covered under Exports below.

## The four cards at the top

Reading left to right:

| Card | What it tells you |
| --- | --- |
| **Total Revenue** | Every rupee taken in the window. This is the big one — it has its own wide card. |
| **Avg Food Cost** | On average, what share of the price of a dish went into buying the ingredients. Shown as a percentage. |
| **Total Orders** | How many orders were placed. |
| **Avg Order Value** | Total Revenue divided by Total Orders — what a typical guest spent. |

> 💡 **Avg Food Cost** is the number most restaurants live or die by. Lower is healthier. If it climbs week on week, something is being over-portioned, wasted, or bought too expensively — and the **Food Cost** page will tell you which.

## Revenue Trend

A single line, one dot per day, showing money taken each day. Hover any point and it tells you the exact date and the exact rupee figure.

Use it to answer: *which days are busy, and did anything fall off a cliff?*

If there were no sales in your window it simply says **"No revenue data for this period."**

## Top Selling Items

A numbered list of the ten best-selling items, each showing how many sold and how much money they brought in — for example `Konma Signature Thali · 34 sold · ₹16,320`.

Use it to answer: *what are people actually buying?*

Empty window shows **"No sales data for this period."**

## Revenue by Channel

A ring chart splitting revenue by where the order came from — dine-in, takeaway, delivery and so on. Hover a slice for the rupee amount.

Use it to answer: *are we a restaurant, a delivery kitchen, or both?*

Empty window shows **"No channel data for this period."**

## Recipe Cost Analysis

A full-width table at the bottom. Its columns are:

| Column | Meaning |
| --- | --- |
| **Recipe** | The dish |
| **Cost** | What the ingredients cost to make one |
| **Base Price** | What we charge for it |
| **Food Cost %** | Cost as a share of Base Price |
| **Units Sold** | How many went out in this window |

**Any row where Food Cost % is above 40% is tinted red**, and hovering it says *"Food cost exceeds 40% threshold"*. Those are your problem dishes — either the price is too low or the recipe is too expensive.

1. Click any row to jump straight to that recipe and see what is in it.

If it is empty you will see **"No recipe cost data available. Ensure recipes have vendor prices."** — that is a message for the **Procurement Lead**, who enters vendor prices.

> ⚠️ If something goes wrong loading the page you will see a red bar: *"Some analytics couldn't be loaded for this range. Figures below may be incomplete."* with a **Retry** button. Click **Retry** once. If it keeps happening, tell the Tech Lead.

---

# 🍲 Food Cost

Sidebar → **Analytics** → click the **Food Cost** button. (There is a small **Analytics** link at the top of the Food Cost page to get back.)

The page title is **Food Cost**, and it explains itself in one line:

> *"Two independent readings of the same period: what the recipes say the food sold should have cost, and what actually left the store room. The gap between them is the finding."*

## Think of it as a kitchen conversation

Imagine you sold 100 plates of thali yesterday.

- **You**, holding the recipe cards: *"100 thalis, and each one uses ₹150 of ingredients. So we should have used ₹15,000 of food."* — **That is Theoretical.**
- **The store room keeper**, holding the stock book: *"Well, ₹16,200 of ingredients actually left the shelves yesterday."* — **That is Actual.**
- The ₹1,200 difference is **Variance** — and it is the entire reason this page exists.

## The three cards

They sit side by side across the top.

**Theoretical** — the big rupee figure, with a line underneath like *"31.25% of ₹48,000 revenue · what the recipes say the food sold should have cost"*.

**Actual** — the big rupee figure, with *"33.75% of revenue · what actually left the store room, valued at the latest vendor price"*.

**Variance** — the gap, with an arrow, a percentage, and **a plain-English sentence telling you what it means**. The system writes that sentence for you:

| If the arrow points | The card says |
| --- | --- |
| **Up (a + figure)** | *"More stock left the store room than the recipes account for — over-portioning, unlogged waste, or theft."* |
| **Down (a − figure)** | *"Less stock left the store room than the recipes account for — usually a stale recipe cost rather than a real saving."* |
| **Flat (zero)** | *"The store room and the recipes agree exactly for this range."* |

> 💡 A **negative** variance is not good news. It nearly always means a recipe's cost was never updated, so the "should have cost" figure is too low. Take it as seriously as a positive one.

## The variance bands — how worried to be

The Variance card is colour-coded. The system measures **how far from zero** the percentage is, in either direction:

| Band | Range | What to do |
| --- | --- | --- |
| 🟢 **Good** | Within **±2%** | Normal kitchen drift. Nothing to do. |
| 🟡 **Warning** | Between **±2% and ±5%** | Worth a look. Note it, watch it next week. |
| 🔴 **Serious** | Beyond **±5%** | Something is wrong. Raise it. |

## Choosing your window

Different buttons from Analytics — read them carefully:

1. **Last 7 days**
2. **Last 30 days** — *the page opens on this one*
3. **This month** — from the 1st of this month to today
4. **Custom** — pick **From** and **To**, then click **Apply range**

A line above the buttons confirms exactly what you are looking at, e.g. *"Showing 1 Aug 2026 – 30 Aug 2026 (node-local, inclusive)"*. "Inclusive" means both the first and last day are counted.

> ⚠️ If you pick a From date after the To date, it tells you: *"From" must not be after "To".* and the **Apply range** button stays greyed out.

## The two warnings — and who to tell

These are the most valuable things on the page, because they tell you when **not** to trust the variance.

### ⚠️ Warning 1 — "no vendor price, valued at ₹0"

A yellow banner near the top saying something like:

> **3 ingredients have no vendor price and were valued at ₹0** — the actual figure below is understated, and so is the variance.

Underneath it lists the ingredients by name as clickable links. Clicking one opens the **Ingredients** page with that ingredient highlighted.

**What it means in plain words:** nobody has recorded what we pay for those ingredients, so when they left the store room the system counted them as free. Your **Actual** figure is therefore too low, and so is your variance.

**Who to tell: the Procurement Lead.** They own vendors and prices. Send them the ingredient names from the banner.

You can dismiss the banner with the **✕** (its label is *Dismiss data quality warning*) — it comes back if you change the date range.

### ⚠️ Warning 2 — "no BOM cost"

Lower down, in the **Theoretical cost by product** table, you may see a yellow **`no BOM cost`** badge next to a product name, and a warning above the table:

> *N products sold with no BOM cost — the theoretical total below is understated.*

Hovering the badge explains it: *"This product has no recipe, or a recipe whose cost was never rolled up. It contributes ₹0 to the theoretical total."*

**What it means in plain words:** we sold this dish, but the system has no recipe for it (or an unfinished one), so it thinks the dish cost nothing to make. Your **Theoretical** figure is too low, which makes the variance look far worse than it is.

**Who to tell: the Backend Lead.** They own recipes and standardisation.

> 💡 **This is the single most important habit on this page.** Before you report a variance to anyone, check both warnings. A scary +12% variance caused by a missing recipe is a data problem, not a theft problem — and telling the team it is theft is the fastest way to lose their trust.

## Actual cost by movement type

A bar chart plus a list, breaking the **Actual** figure into the four ways food leaves the store room:

| Label | Meaning |
| --- | --- |
| **Order Deducted** | Used to fill a customer order |
| **Prep Deducted** | Used in a prep batch in the kitchen |
| **Waste** | Thrown away — shown in the alarm colour on purpose |
| **Supply Usage** | Used up as supplies rather than sold |

Each line shows the rupee amount and its share, e.g. *"14.2% of actual"*.

The card explains one deliberate exclusion: **stock adjustments are not counted**, because an adjustment is the *correction for* drift — counting it would cancel the variance out and hide the very thing you are looking for.

If nothing happened in your window it says **"Nothing moved and nothing sold in this range."**

## Theoretical cost by product

The table at the bottom. Columns:

| Column | Meaning |
| --- | --- |
| **Product** | The item sold |
| **Qty sold** | How many went out |
| **Unit cost** | What the recipe says one costs to make |
| **Theoretical cost** | Qty × Unit cost |
| **Share** | This product's slice of the theoretical total, with a small bar |

1. Click any column heading to sort by it. Click again to flip the direction.
2. It opens sorted by **Theoretical cost**, biggest first — so your heaviest items are already at the top.

Empty window shows: *"No orders in this range, so there is nothing for the recipes to account for."*

---

# 🎯 KPIs

Sidebar → **KPIs**. The page title is **KPI Tracker**.

A KPI is simply **a number you promised to watch**, with a target beside it.

## Reading the page

Each KPI is a card showing its name, its area of the business, its description, the **current value out of the target** (e.g. `28 / 35 percent`), a status badge, and how many tasks are linked to it.

Above the cards are filter tabs: **All**, then one tab per area — **Backend**, **Frontend**, **Procurement**, **Business Intelligence**, **Talent**, **Tech**, **Design/Outreach**, **Food**, **Operations**, **Sales**, **Standardization**. Click one to see only that area's KPIs.

The status badges are:

| Badge | Meaning |
| --- | --- |
| **On Track** | Heading for the target |
| **At Risk** | Might miss it |
| **Off Track** | Will miss it without a change |

If there are none yet you see **"No KPIs yet"** and *"Create your first KPI to track domain metrics. Each KPI can be linked to contributing tasks."*

## Creating a KPI

1. Click **Create KPI** (top right). A panel slides in from the right titled **Create KPI**.
2. **Name** — what you are tracking. At least 3 characters, at most 100.
3. **Description** — the box asks *"What does this KPI measure?"*. Required.
4. **Domain** — pick the area from the dropdown. Required.
5. **Unit** — how it is counted. The hint suggests *"e.g. percent, count, hours"*. Required.
6. **Target Value** — the number you are aiming for.
7. **Current Value** — where it stands today. Leave it at 0 if you do not know yet.
8. **Status** — **On Track**, **At Risk** or **Off Track**.
9. **Linked Tasks** *(optional but powerful)* — type in the search box (*"Search tasks by title, owner, or quest..."*) and click tasks to tick them. Each one you pick appears as a chip above; click the **✕** on a chip to remove it. A counter underneath tells you how many are linked.
10. Click **Save KPI**. You will see the message **"KPI saved."**

To back out without saving, click **Discard Changes**.

## Editing a KPI

1. Click **Edit** at the bottom of any KPI card.
2. The same panel opens, titled **Edit KPI**, pre-filled.
3. Change what you need — most often **Current Value** and **Status**.
4. Click **Save KPI**.

> 💡 **Domain cannot be changed after a KPI is created.** If you picked the wrong area, create a new KPI in the right one.

> ⚠️ If saving fails you will see *"Failed to save KPI. Check your inputs and try again."* — usually a required field left blank or a name under 3 characters.

---

# 💬 Feedback

Sidebar → **Feedback**. The page title is **Customer Feedback**.

This is what guests said, in their own words, after an order.

## The card at the top

**Avg. Rating** — one number out of five, with stars filled in beside it, and underneath *"N total feedback"*. That is your headline guest-satisfaction figure.

## Reading the list

The table has five columns: **Rating**, **Comment**, **Customer**, **Order**, **Date**.

- **Rating** shows as gold stars.
- **Comment** is trimmed if long — click the small arrow at the end to expand the full comment underneath, and again to collapse it. A dash (—) means they left no words.
- **Customer** shows their name, or **Anonymous**.
- **Order** is a short reference; clicking it opens Order History.

## Filtering

1. Click a rating tab — **All**, **5★**, **4★**, **3★**, **2★** or **1★** — to see only that score.
2. Use the date dropdown for **All Time**, **Today**, **This Week** or **This Month**.

If nothing has come in you will see **"No Feedback Yet"** and *"Feedback submitted via QR codes and links will appear here."*

## What happens automatically to poor feedback

**When a guest leaves a rating of 2 stars or lower, the system automatically creates a follow-up task called "Follow up on N-star feedback", assigns it to the Frontend Lead, quotes the guest's own words in it, and requires approval before it can be closed** — so a bad experience always turns into work someone owns, without you having to chase it.

> 💡 Your job with poor feedback is not to chase the fix — that task already exists. Your job is to notice the **pattern**: three 2-star ratings all mentioning the same dish is a costing and recipe conversation, and that is yours.

---

# 📥 Exports

Every data page you own has an **Export** button, and there is an **Exports** page listing everything that was ever downloaded.

## Downloading a report from a page

1. Open the page whose data you want (for example **Analytics**).
2. Set the date range you want *first* — the export takes your current view.
3. Click **Export**. A window opens titled **Export Analytics**.
4. Choose a format by clicking one of the two tiles:
   - **CSV** — *Universal*. Opens anywhere, plain.
   - **XLSX** — *Formatted*. Opens in Excel, tidier. This is pre-selected.
5. If the report covers a date range, confirm the **From** and **To** boxes.
6. Click **Export**. The button reads **Generating...** while it works.
7. You will get **"Export ready. Click to download."** with a **Download** button on the message. Click it.

To back out, click **Discard**.

## The Exports page

Sidebar → **Exports**. Title **Exports**, subtitle *"Download history and re-export any report."*

The table shows **Report Type**, **Format**, **Filters Applied**, **File Size**, **Generated By**, **Generated At**, **Status**. Completed rows have a small download icon on the right — **Re-download** — so you can pull the same file again without regenerating it.

Status badges are **Completed**, **Generating** and **Failed**.

Filter the list with the **All report types** dropdown and the **From** / **To** date boxes.

## What you can export

| You can export | You cannot export |
| --- | --- |
| Orders, Revenue Summary, Top Items, Channel Breakdown, Recipe Costs | Inventory Levels, Stock Movements |
| Tasks, KPIs, Decision Log, Leaderboard, Missions, Quests | Purchase Orders, Vendor Pricing, Waste Log, Prep Batches |
| | Ingredients, Vendors, Recipes, Products, **Feedback**, Events, Event Guest Lists |

> ⚠️ **Two things will look broken, and they are not your fault.**
>
> 1. The **Export** button on the **Customer Feedback** page will fail with *"Export failed. The file could not be generated. Try again."* Feedback exports need an operations permission you do not hold.
> 2. The **Exports** page itself may show *"Could not load export history. Try refreshing the page."* Viewing the shared history needs a system-admin permission you do not hold.
>
> Neither is a mistake you made. If you need either, ask the **Founder/Admin** or the **Tech Lead** to pull it for you, or to grant you the permission.

---

# ✅ Worked example — find a variance, track it, prove it

Do this once end to end and the whole role will click into place. It takes about fifteen minutes.

**The goal:** open the last 30 days of food cost, work out whether the gap is real, turn it into a KPI, get the data out, and confirm it lines up with what Analytics shows.

- [ ] **1. Open the report.** Sidebar → **Analytics** → click the **Food Cost** button at the top right.

- [ ] **2. Set the window.** Click **Last 30 days**. Check the line above the buttons now reads *"Showing … – … (node-local, inclusive)"* with roughly a month between the two dates.

- [ ] **3. Read the three cards left to right.** Write down the **Theoretical** figure, the **Actual** figure, and the **Variance** figure and percentage. Read the sentence under Variance out loud — that is the finding in plain English.

- [ ] **4. Decide how worried to be.** Ignore the plus or minus sign and look at the size of the percentage. Under 2% → nothing to do. Between 2% and 5% → worth a look. Over 5% → raise it.

- [ ] **5. Find the unpriced ingredient — before you believe the number.** Look for the yellow banner near the top. If it is there, read how many ingredients it names and note the names. On the demo data you are likely to see one of the store-room staples such as **Green Cardamom Pods** or **Coriander Seeds**. **Click the ingredient name** — it opens the Ingredients page with it highlighted, which confirms you found the right one.

- [ ] **6. Check the second warning too.** Scroll to **Theoretical cost by product** and look for any yellow **`no BOM cost`** badge. Hover it and read the explanation.

- [ ] **7. Decide who to tell.**
  - Unpriced ingredients from step 5 → message the **Procurement Lead** with the names.
  - `no BOM cost` products from step 6 → message the **Backend Lead** with the product names.
  - Write both into a sentence like: *"Last 30 days shows +6.4% variance, but Green Cardamom Pods has no vendor price and Masala Chai has no BOM cost — so the real gap is smaller. Fixing those two will tell us the truth."*

- [ ] **8. Turn it into a KPI so it does not get forgotten.** Sidebar → **KPIs** → **Create KPI**.
  - **Name:** `Food cost variance — 30 day`
  - **Description:** `Gap between what the recipes say we should have used and what actually left the store room. Target is within 2%.`
  - **Domain:** `Business Intelligence`
  - **Unit:** `percent`
  - **Target Value:** `2`
  - **Current Value:** the variance percentage you wrote down in step 3 (ignore the minus sign)
  - **Status:** **On Track** if under 2, **At Risk** if 2–5, **Off Track** if over 5
  - Click **Save KPI**. Confirm you see **"KPI saved."** and the card appears under the **Business Intelligence** tab.

- [ ] **9. Export the evidence.** Go back to **Analytics**, set the range to **30 days**, click **Export**, choose **XLSX**, click **Export**, then click **Download** on the message. You now have the file to attach to your message from step 7.

- [ ] **10. Check Analytics agrees with the demo orders.** Still on **Analytics** with **30 days** selected:
  - **Top Selling Items** should list real demo products — **Konma Signature Thali**, **Smoked Butter Chicken Bowl**, **Villa Filter Coffee**, **Masala Chai**, **Terrace Garden Salad**.
  - **Recipe Cost Analysis** should show those same dishes with a **Food Cost %**. Find any row tinted red (over 40%) and click it to open the recipe.
  - **Total Revenue** should be a believable multiple of **Total Orders** — the demo thali is ₹480 and the demo coffee is ₹120, so an **Avg Order Value** somewhere in the low hundreds means the numbers hang together.

- [ ] **11. Come back next week.** Open **KPIs**, click **Edit** on the KPI you made, update **Current Value** and **Status**, and click **Save KPI**. That single habit is the whole job.

---

# 🆘 Quick reference

| I want to… | Go to |
| --- | --- |
| See how much money came in | **Analytics** → **Total Revenue** card |
| See which dishes sell | **Analytics** → **Top Selling Items** |
| Find dishes that cost too much to make | **Analytics** → **Recipe Cost Analysis** (red rows) |
| Find out if the kitchen is losing food | **Analytics** → **Food Cost** button → **Variance** card |
| See if the food-cost number can be trusted | **Food Cost** → the yellow banner and the `no BOM cost` badges |
| Set or update a target | **KPIs** → **Create KPI** / **Edit** |
| Read what guests said | **Feedback** |
| Get a file out | **Export** button on any data page |
| Find a file someone already made | **Exports** |

| Something looks wrong with… | Tell |
| --- | --- |
| An ingredient with no price | **Procurement Lead** |
| A product with no recipe / `no BOM cost` | **Backend Lead** |
| A guest complaint pattern | **Frontend Lead** (the follow-up task is already theirs) |
| A page that will not load, or a permission you need | **Tech Lead** or **Founder/Admin** |
