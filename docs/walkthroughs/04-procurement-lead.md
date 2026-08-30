> 📦 **Welcome, Procurement Lead.** Your job in Konma is "Vendors, sourcing, inventory management" — you make sure the kitchen never opens a cupboard and finds it empty, and that everything the villa buys is written down at the price it actually cost. This guide walks through every screen you own, in the order a normal week uses them. No technical knowledge needed anywhere.

Sign in at **https://www.konma.store/sign-in** with your email — `surya@konma.store`. Your password is yours alone; nobody should ever ask you for it, and it isn't written down here.

---

# 🧭 What you'll see on the left

There's a menu down the left side of every screen. Yours has three parts.

**Always at the top:** **Mission Control**, **My Tasks**, **My Quests**, **Evidence**, **Approvals**, **Decisions**, **Readiness** and **Team** — the shared bones of the system, the same for everybody.

**A group called "Procurement"** — this is your day:

| Menu item | Where it goes |
| --- | --- |
| **Inventory** | https://www.konma.store/operations/inventory |
| **Inventory Overview** | https://www.konma.store/operations/inventory/dashboard |
| **Procurement** | https://www.konma.store/operations/procurement |
| **Purchase Orders** | https://www.konma.store/operations/purchase-orders |
| **Vendors** | https://www.konma.store/operations/vendors |

**A group called "Kitchen"** — Kitchen Overview, KDS, Pick & Pack, Prep Batches, Recipes, Ingredients, Supply Usage and Waste Log. You can see all of these because what the kitchen uses is what you have to replace. They belong to the Kitchen Lead day to day and have their own guide.

At the top of every screen there's a **Guide** link, a **Chat** link, and a bell for your notifications.

> 💡 If a button ever says you don't have permission, that isn't something you did wrong. Which buttons work is switched on per role by your admin on the Permissions screen. Adding or editing a **vendor** or a **vendor price** needs the one called **"Manage operations"** — ask your admin to turn it on for the Procurement Lead role if you find those buttons refusing.

---

# 📋 1. Inventory — what's actually on the shelf

**Inventory** (https://www.konma.store/operations/inventory) is the live count of every ingredient, in every storage zone.

If anything has dropped below its minimum, an amber strip sits across the top of the page: **"3 ingredients below minimum stock level. Review and reorder."** That strip is your morning to-do list in one line.

The table underneath shows:

| Column | What it tells you |
| --- | --- |
| **Name** | The ingredient |
| **Category** | Vegetables, Dairy, Spices (dried), and so on |
| **Zone** | Where it's stored — Main Kitchen, Cold Storage, Prep Station |
| **Current Stock** | What's there right now. Amber if it's low, green if it's fine |
| **Min Level** | The floor. Below this, it counts as low |
| **Status** | **Low Stock** or **OK** |
| **Actions** | A small clock icon — **View Movements** |

Narrow the list with **All Categories**, **All Zones**, or the **Search ingredients...** box.

## What "low stock" actually means

Every ingredient has a **Min Stock Level** set on the Ingredients screen — a plain number, like 12 kg of tomato. The moment the amount on hand falls under that number, three things happen on their own:

1. The row turns amber and its status becomes **Low Stock**
2. The count in the strip at the top goes up
3. **The system sends you a notification** — the automatic nudge

That third one is worth trusting. You don't have to keep this page open all day. Whenever a stock movement pushes an ingredient under its minimum, a notification titled **"Low stock: Tomato"** arrives with the body *"Tomato is at 6 kg, below minimum level of 12 kg,"* and clicking it brings you straight here. It goes to everyone who handles procurement, and there's a built-in cooling-off period so the same ingredient doesn't nag you every ten minutes.

## Looking at one ingredient's history

Click the clock icon on any row and you land on that ingredient's own page. It shows **Current Stock**, **Zone** and **Last updated** at the top, then **Stock Movements** — every single change, newest first: what came in from a delivery, what the kitchen cooked with, what got wasted, what someone corrected by hand.

This is where you go when a number looks wrong. The answer is nearly always sitting in this list.

## Adjust Stock

The **Adjust Stock** button in the top right opens a side panel for corrections.

1. Choose the **Ingredient**.
2. Choose the **Zone**.
3. Enter the **Quantity (negative to deduct)** — `50` adds fifty, `-10` takes ten away.
4. Type a **Reason** — the box suggests things like "Spillage" or "Received delivery".
5. Press **Save Adjustment**.

> ⚠️ **Adjust Stock is for corrections, not for receiving deliveries.** When a supplier's van arrives, receive it against the purchase order (section 4) — that keeps the delivery, the price and the stock change tied together in one record. Adjusting by hand instead breaks that link, and the paperwork stops matching the shelf.

If the page is completely empty you'll see **"No Inventory Data"** and a **Go to Ingredients** button — that means nobody has set up the ingredient list yet.

---

# 📊 2. Inventory Overview — the wider picture

**Inventory Overview** (https://www.konma.store/operations/inventory/dashboard) is the same world one step back. Four boxes across the top:

| Box | What it means |
| --- | --- |
| **Inventory Value** | What everything on the shelves is worth, in rupees |
| **Low Stock Items** | How many things are under their minimum. Turns red when it isn't zero |
| **Open POs** | Purchase orders placed but not yet fully received |
| **Total PO Value** | What's been spent on purchase orders this month |

Under those you get the low-stock alerts spelled out one by one, and two charts: how your purchase orders are split across draft / ordered / received / cancelled, and who your biggest suppliers are.

Good screen for a Monday morning, or for anyone who asks "how are we doing on supplies?"

---

# 📈 3. Procurement — spend and shortages side by side

**Procurement** (https://www.konma.store/operations/procurement) puts money and shortages on one page.

Four boxes: **Pending Orders**, **Low Stock Items** (amber when above zero), **Vendor Spend This Month**, **Total Inventory Value**.

Then two sections:

- **Top Vendors by Spend** — your three biggest suppliers this month with what you've spent with each. If there's been no spend yet it says so and offers a **Go to Purchase Orders** button.
- **Low Stock Alerts** — up to four cards, each naming the ingredient, its zone, a **Low Stock** badge, and the shortfall written as *current / minimum* — for example **6 / 12 kg**. A **View All Inventory** link takes you to the full list.

---

# 🧾 4. Purchase Orders — buying things

**Purchase Orders** (https://www.konma.store/operations/purchase-orders) is where an order to a supplier lives from the moment you draft it to the moment the goods land on the shelf.

Tabs across the top let you filter: **All**, **Draft**, **Ordered**, **Received**, **Cancelled**. The table shows **Vendor**, **Items**, **Total**, **Status**, **Ordered At**, and an **Actions** column with a **View** button and a small ✕ to cancel.

| Status | Meaning |
| --- | --- |
| **Draft** | Written up, not sent |
| **Ordered** | Placed with the supplier, waiting on delivery |
| **Received** | Everything on it has arrived and gone into stock |
| **Cancelled** | Called off |

If a purchase order was raised because of a specific task, a small chip under the vendor name shows which one — so you can always see *why* something was bought.

## Creating a purchase order

Press **New Purchase Order**.

1. **Select Vendor** — only vendors marked active appear. Once you pick one, their phone and email show underneath so you can double-check you've got the right supplier.
2. **Select Zone** — where the goods will be stored when they arrive. This matters: it decides which shelf the stock lands on.
3. Under **Order Items**, fill in the first row: **Ingredient**, **Qty**, **Unit**, **Unit Cost (INR)**. The **Line Total** works itself out, and a running **Total** sits at the bottom of the table.
4. Press **Add Item** for each extra line.
5. Add **Notes** if there's anything the supplier or your colleagues should know.
6. **Link to Task (optional)** — if this order exists because of a job somebody logged, pick it here. It's how the purchase gets a reason attached to it.
7. Finish with either **Save as Draft** (you're not ready to send it) or **Save and Mark as Ordered** (it's going to the supplier now).

## Does it need approval?

**No.** A purchase order doesn't go into an approval queue — you create it and mark it ordered yourself, and it takes effect straight away. The only thread back to the rest of the system is that optional **Link to Task**, which records *why* the order was raised. So the responsibility sits with you: check the vendor, check the quantities, check the unit costs before you press the button.

## Receiving the goods

This is the part that changes the shelves, so do it properly and do it when the van arrives.

1. Open the purchase order — **View** from the list, or click its row.
2. If it's still a **Draft**, press **Mark as Ordered** first. You can only receive against an ordered PO.
3. Scroll to **Receive Items**. Every line is listed with the quantity you ordered, and a **Received Qty** box already filled in with that same number.
4. **Change any box that doesn't match reality.** If you ordered 20 kg and 18 kg turned up, type 18. This is the whole point of the screen.
5. Press **Mark as Received**.
6. A dialog appears: **Confirm Receiving**, telling you how many ingredients are about to have their stock updated. Press **Confirm Receive**.

You'll see **"Receiving recorded. Stock levels updated."**

**What that does, in plain words:**

- Each received quantity is **added to that ingredient's stock** in the zone on the purchase order — converted into the ingredient's own unit if you ordered in a different one
- A **stock movement** is written for each line, labelled as a purchase receipt and pointing back at this purchase order, so the history explains itself forever
- If every line came in full, the PO becomes **Received** and stamps the date. If only part of the delivery arrived, it **stays Ordered** so you can come back and receive the rest later
- You can never record more than you ordered — the system will stop you

> ⚠️ Receiving cannot be undone. If you record the wrong number, fix it afterwards with **Adjust Stock** on the Inventory screen and write a clear reason so the next person understands.

**Cancelling:** a draft or ordered PO can be cancelled with the ✕ or the **Cancel PO** button. It asks first. A received PO can't be cancelled — the goods are already on the shelf.

---

# 🚚 5. Vendors — your suppliers and their prices

**Vendors** (https://www.konma.store/operations/vendors) is the address book and the price book in one.

The table lists **Name**, **Phone**, **Email**, **Payment Terms**, **Status** and **Actions**. On a fresh system this starts empty, with **"No Vendors Yet"** and a note that each vendor can carry a price history per ingredient. Press **Add Vendor** to begin.

## Adding a vendor

1. Press **Add Vendor**. A side panel opens.
2. Fill in the **Name** — the only required field.
3. Add **Phone**, **Email** and **Address** if you have them.
4. Pick **Payment Terms** if you've agreed any.
5. Press **Add Vendor**.

To edit one later, use the pencil on its row. To stop using a supplier without losing their history, deactivate them — inactive vendors stop appearing in the purchase order dropdown but everything you've bought from them stays on record.

## Vendor prices — and why they matter more than they look

Click **View** on a vendor and a panel slides in showing their contact details and a section headed **Linked Ingredients & Prices**. Each ingredient they supply is one row with its current price — **₹42.00/kg** — and clicking the row expands the full history of what that ingredient has cost over time.

To record a new price:

1. Press **Add Price**.
2. Choose the **Ingredient**.
3. Enter the **Price per base unit** — the panel reminds you which unit that is, for example *(per kg)*.
4. Set the **Effective Date**. It defaults to today.
5. Press **Add Price**.

The old price isn't overwritten; it stays in the history and the new one takes over from its effective date.

**Here's why this is the most quietly important screen you own.** The newest price you've recorded for an ingredient is the number the whole system uses to work out what food costs:

- Every recipe's **Cost Preview** — batch cost and cost per portion — is built by taking your latest price for each ingredient in the recipe and adding them up. If a price is missing, the recipe simply says **"Cost unavailable"** and lists what it can't price
- Every **waste entry** the kitchen logs gets its rupee **Cost Impact** from your latest price
- The **food-cost report** values everything that leaves the store room at your prices, and compares it against what the recipes say it should have cost

Which means: **out-of-date vendor prices don't produce an error, they produce a wrong number that looks right.** A recipe costed at last season's tomato price will quietly under-report food cost for months. Ten minutes updating prices after a delivery is worth more than any amount of analysis afterwards.

The delete-vendor confirmation says it plainly: *"This vendor and all their price history will be removed. Recipes using these prices will lose their cost data."* Deactivate rather than delete, unless you're certain.

---

# 🔔 6. Your notifications

There's a bell at the top of every screen. A red number means something new. Click it for the recent list, **Mark all as read** to clear it, or **View all** for the full history.

| Notification | What it's telling you |
| --- | --- |
| **Low stock: <ingredient>** | Something has fallen below its minimum. The message gives you the exact figures — *"is at 6 kg, below minimum level of 12 kg"* — and clicking it opens **Inventory**. This is your main working alert |
| **Still blocked: <task name>** | A task of yours has been sitting blocked, with the reason attached |
| **An approval is waiting** | Something needs your sign-off. Head to **Approvals** |
| **Task due** | One of your tasks is coming up |
| **Morning brief** | The short summary of the day ahead |

The low-stock nudge goes to everyone who handles procurement, and repeats itself on a cooling-off timer rather than every time the number moves — so if you see the same ingredient again after a while, it means it's still short.

---

# 🌙 7. The nightly stock check

Every night at 2:30 in the morning, the system quietly compares its stock numbers against the record of every single movement — everything received, cooked, wasted and adjusted — and notes anywhere the two don't line up.

It doesn't change anything and nobody is in trouble. Think of it as a torch, not an audit: it just makes sure that if a number ever starts drifting, somebody finds out the next morning rather than two months later while counting a freezer.

---

# 🌟 A worked example: from shortage to shelf

Do this once and the rest becomes routine.

**Find what's short**

- [ ] Open **Inventory** (https://www.konma.store/operations/inventory)
- [ ] Read the amber strip at the top — it tells you how many ingredients are below minimum
- [ ] Sort your eye down the **Status** column and find a row marked **Low Stock**. Say **Tomato** shows **6 kg** against a **Min Level** of **12 kg**, in **Main Kitchen**
- [ ] Click the clock icon on that row to see its **Stock Movements** — this shows you whether it went down through normal cooking or something unusual

**Check the price is current before you order**

- [ ] Open **Vendors** (https://www.konma.store/operations/vendors)
- [ ] Press **View** on your vegetable supplier
- [ ] Under **Linked Ingredients & Prices**, find **Tomato** and read the price shown on its row
- [ ] If that price is stale, press **Add Price**, choose **Tomato**, enter today's real rate per kg, leave the **Effective Date** as today, and press **Add Price**

**Raise the purchase order**

- [ ] Open **Purchase Orders** (https://www.konma.store/operations/purchase-orders)
- [ ] Press **New Purchase Order**
- [ ] **Select Vendor** — your vegetable supplier. Their phone and email appear underneath; check it's the right one
- [ ] **Select Zone** — **Main Kitchen**
- [ ] In the first item row: Ingredient **Tomato**, Qty **20**, Unit **kg**, Unit Cost the rate you just confirmed
- [ ] Watch the **Line Total** and the running **Total** fill in at the bottom
- [ ] Optionally **Link to Task** if this order came out of a job somebody logged
- [ ] Press **Save and Mark as Ordered**

**Receive the delivery**

- [ ] Back on the list, find your new order under the **Ordered** tab and press **View**
- [ ] Scroll to **Receive Items**. The **Received Qty** box is pre-filled with **20**
- [ ] Count what actually arrived. If it's 20, leave it. If 18 turned up, type **18**
- [ ] Press **Mark as Received**, read the **Confirm Receiving** dialog, then press **Confirm Receive**
- [ ] The message reads *"Receiving recorded. Stock levels updated."* and the order's status becomes **Received** with today's date

**Watch the shelf go up**

- [ ] Open **Inventory** again
- [ ] **Tomato** now reads **26 kg** (6 + 20), and its **Status** has flipped from **Low Stock** to **OK**
- [ ] The amber strip at the top has one fewer ingredient in it, or has gone entirely
- [ ] Click the clock icon on the Tomato row — the newest entry in **Stock Movements** is your delivery, pointing back at the purchase order that brought it in

**Close the loop on price**

- [ ] Open **Vendors** once more and **View** the same supplier
- [ ] Check the **Tomato** price on the row matches what you actually paid on the purchase order
- [ ] If the invoice came in different from what you expected, press **Add Price** and record the real figure with today's date — so every recipe that uses tomato costs itself correctly from now on

That last step is the one people skip, and it's the one that keeps every food-cost number in the villa honest.

---

# 🆘 When something looks wrong

| What you see | What's going on | What to do |
| --- | --- | --- |
| An ingredient is short but there's no notification | The nudge has a cooling-off period, so it doesn't repeat constantly | Trust the **Inventory** screen — it's always current |
| A vendor doesn't appear when creating a PO | Only **active** vendors are listed | Open **Vendors** and check their status |
| **Mark as Received** won't work | The PO is still a **Draft** | Press **Mark as Ordered** first |
| The system won't let you receive a quantity | You can't receive more than was ordered | Check the ordered quantity; raise a second PO if you genuinely got more |
| A PO stayed **Ordered** after receiving | Only part of the delivery arrived | That's correct — come back and receive the rest when it turns up |
| A recipe says its cost is **unavailable** | An ingredient in it has no vendor price | Add the price on the **Vendors** screen |
| Stock is wrong and no delivery explains it | Look at the ingredient's **Stock Movements** | The answer is nearly always in that list; correct it with **Adjust Stock** and a clear reason |
| A button says you don't have permission | A setting on your role, not a mistake | Ask your admin for **"Manage operations"** on the Permissions screen |

Anything else, the **Guide** link at the top of every screen has more, and **Chat** puts you in touch with the rest of the team.
