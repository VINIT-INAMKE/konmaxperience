> 🛎️ **Welcome — you're the Front-of-House Lead.**
> Your half of Konma is the guest's half: taking the order, getting it to them, packing what has to travel, looking after the people who keep coming back, and putting your name on the day when it's done. This walkthrough goes screen by screen, in the order a normal day tends to run. You don't need to know anything technical. Every button you're told to press is written **in bold, exactly as it appears on screen**.
> You sign in as **advitha2@konma.store**.

---

# 🔑 Getting in

1. Open **https://www.konma.store/sign-in** in your browser.
2. The page says **Team Login**. Type your address in **Email** and your password in **Password**.
3. Press **Sign in**.

> 💡 The eye icon next to the password box shows what you've typed, if you want to check it before pressing the button. If you've forgotten the password, use **Forgot password?** and a reset link comes to your inbox — nobody, including this guide, will ever ask you to share it.

---

# 🧭 What's in your sidebar

Down the left-hand side you'll see a fixed list. Yours has three parts.

**At the top (everyone in the team sees these):** **Mission Control**, **My Tasks**, **My Quests**, **Evidence**, **Approvals**, **Decisions**, **Readiness**, **Team**. Up in the header bar there's also **Guide** and **Chat**.

**Then collapsible groups.** Click a group name to open or close it.

| Group | What's inside it for you |
| --- | --- |
| **Kitchen** | Kitchen Overview, KDS, Pick & Pack, Prep Batches, Recipes, Ingredients, Supply Usage, Waste Log |
| **Commerce** | **Take Order**, **Order History**, **Delivery Queue**, **Shipments**, **Customers**, **Reviews**, **Daily Close** |
| **Catalog & Experiences** | **Catalog**, **Experiences**, Brands, Assets, **Promotions** |

This guide covers the **Commerce** group and the three Catalog screens you actually own day to day. The Kitchen group is shared with the Backend Lead and is a different job. **Brands** and **Assets** sit in your Catalog group too, but they're really the Design/Outreach Lead's tools.

> 💡 A screen you can't see in the sidebar isn't one you can reach by typing its address either. If something you expect is missing, that's a permissions question for the Founder/Admin or the Tech Lead — not something you've done wrong.

---

# 🧾 Take Order — the till

**https://www.konma.store/pos**

This is where a walk-up, a table, or a phone order becomes a real order in the system.

## Putting an order together

1. Click **Take Order** in the sidebar. The page header says **Take Order**.
2. Along the top of the product area are the **brand tabs** — **Konma Food** and **Just Craves**. Pick the one you're selling from.
3. Below that, products are grouped under their category headings — **Signature Plates**, **Beverages**, **Pantry & Provisions**, **Experiences**, **Villa Merchandise**.
4. Each product is a tile with its name, its price, and a **+ Add** button. Press **+ Add** once per portion.
5. On the right you'll see **Order Summary** filling up. Before you add anything it says **No items yet** and **Tap any product to add it to the order.**
6. Use the small **+** and **−** on each line in the summary to change quantities. Taking a line down to zero removes it.

> 💡 A tile can show a small badge in its top corner: **5 left**, **1 left**, or **Sold Out**. That count comes from the kitchen's actual stock and refreshes on its own about every half a minute. A **Sold Out** tile is greyed out and has no **+ Add** — you physically cannot sell it.

## Choosing the channel

Underneath the item list in **Order Summary** there are three tabs. Pick the one that matches how the guest is taking the food.

| Tab | Use it when | Extra boxes you get |
| --- | --- | --- |
| **Dine-in** | They're eating here | **Table number** |
| **Takeaway** | They're carrying it out | **Customer phone** |
| **Delivery** | Someone is taking it to them | **Customer phone**, **Delivery address**, **Rider or staff name** |

**Customer name (optional)** shows on all three. Fill it in whenever you know it — it's what makes the order findable later and what links it to a person's history.

> 💡 There's a fourth channel in the system, **Marketplace**, but you'll never pick it here. That's what an order places itself as when a customer buys on the public website.

## Placing it

1. Add anything the kitchen needs to know in **Any special requests? (optional)** — allergies, "no chilli", "table by the window".
2. Check **Subtotal** and **Total**. Under the subtotal it says **Channel pricing applied at checkout** — that's the system telling you a small per-channel adjustment (say a delivery surcharge) gets worked out when the bill is settled, so the number here is the honest before-adjustment figure.
3. Press **Place Order**.
4. A green message appears: **Order #1042 placed**. The cart empties and the ticket is already on the kitchen screen.

> ⚠️ There is **no coupon box on this till.** Coupon codes like `WELCOME10` are applied by the customer at checkout on the public website. If a guest standing in front of you has a code, it can't be honoured through this screen — take the order, then adjust with a loyalty credit on their customer page (see **Customers** below) so there's a written reason for the money.

> 💡 **Terminal Mode** is the big button at the top right. It blows the screen up to fill the whole display and hides everything else — good for a dedicated till tablet at the counter. The header changes to **Terminal Mode** and the button becomes **Exit Terminal**.

> ⚠️ If the products never load, or **Place Order** comes back with an error, your account may be missing the **Manage POS operations** permission. Ask the Founder/Admin or the Tech Lead to add it under **Admin → Permissions**. It isn't something you can grant yourself.

---

# 📜 Order History — everything that's been sold

**https://www.konma.store/pos/orders**

1. Click **Order History**. Three cards sit across the top: **Orders Today**, **Revenue Today**, **Avg Order Value**.
2. Underneath is the filter row: **From**, **To**, **Channel**, **Status**, **Payment**, and **Search** (which takes an order number).
3. It opens showing **today** only. Change **From** to look further back.
4. The table lists **Order #**, **Time**, **Channel**, **Items**, **Total**, **Payment**, **Status**.
5. Click anywhere on a row — or the little eye icon in **Actions** — to open that order in full.

If there's nothing to show you'll see **No orders today** and **Orders placed from the POS will appear here.**

> 💡 The **Export** button at the end of the filter row hands you a spreadsheet of exactly what the filters are currently showing.

---

# 🔎 Inside one order

**https://www.konma.store/pos/orders/…** (you get here by clicking a row above)

The order number is at the top in big type, with a coloured badge for the order's state and another for whether it's been paid. **Order history** at the very top takes you back.

## The facts strip

**Channel**, **Placed via** (POS, Storefront, or Payment Webhook), **Placed at**, **Customer**, and — when they exist — **Phone**, **Table**, **Address**, **Rider**. Any special request the guest made shows in a grey box underneath.

## The money box — and the discount split

On the right is a panel headed **Totals**. Read it top to bottom:

| Line | What it means |
| --- | --- |
| **Subtotal (incl. GST)** | What the items come to. Tax is *already inside* this number. |
| **Channel modifier** | The per-channel adjustment, if the channel has one. |
| **Coupon discount** | Money taken off by a coupon code. Shown as a minus. |
| **Loyalty redeemed (620 pts)** | Money taken off by burning the customer's points. Also a minus, with the point count in brackets. |
| **Shipping** | The delivery charge, if any. |
| **Total** | What the customer actually pays. |
| *of which GST ₹…* | A note, not a line. It is **already inside** the subtotal and is never added on top. |
| **Loyalty points** | `+40 / −620` — points this order earned, then points it burned. |

> 💡 **Why the discount is split into two lines.** Internally the system keeps one single "discount" figure. This screen pulls it apart for you: the **Loyalty redeemed** half is worked out from the points burned, and whatever's left over is the **Coupon discount** half. That's how you can tell a generous code from a guest spending their own points — which matters a great deal when someone asks for their money back.

## Items

The lines are grouped by how each one gets handed over, because different people deal with each group:

- **Local — counter, table or rider**
- **Shipped — courier parcel**
- **Booking — seat at an experience**

Each group has its own subtotal, and each row shows **Item**, **Qty**, **Unit price**, **GST**, **Status**, **Line total**. The GST column is the rate *carved out of* the price, not a surcharge on top.

## Moving the order along (the **Lifecycle** panel)

Only the moves that are legal right now appear as buttons. This is the whole map:

| Where it is | Buttons you'll see |
| --- | --- |
| **Placed** | **Confirm order**, **Start preparing** |
| **Confirmed** | **Start preparing** |
| **Preparing** | **Mark ready** |
| **Ready** | **Mark served**, **Mark dispatched**, **Mark shipped** |
| **Dispatched** | **Mark delivered** |
| **Shipped** | **Mark delivered** |
| **Served** | **Complete order** |
| **Delivered** | **Complete order** |
| **Completed** | nothing — "*Completed is the end of the line for this order*" |

**Ready** is the fork in the road. Three different endings, one per way the food leaves: **Mark served** at the counter, **Mark dispatched** to your own rider, **Mark shipped** to a courier.

Two of these stop and ask you first:

> ⚠️ **Mark delivered** opens a box titled **Mark this order delivered?** — *"Delivering credits the customer's loyalty points for this order and fires the review invitation. Neither can be undone from this screen."* Press **Yes, continue** or **Not yet**. Don't press it before the guest actually has the food: the points go out and the review invitation goes out, and you can't pull either back.

> ⚠️ **Complete order** opens **Complete this order?** — *"Completing closes the order for good — it is the one status an order never leaves."* Once it's Completed, that's it.

If the order is a **Delivery**, there's a second little line: **Delivery: not started** with a button **Mark Picked Up**, then **Mark In Transit**, then **Mark Delivered**. That's the rider's own leg, and it moves independently of the order status.

**Cancel order** is the red button at the bottom, available until the order has been served, dispatched or completed. Its box says: *"The order is cancelled and its tickets leave the kitchen display. Cancelling does **not** move money — use the refund panel for that."* You choose **Keep order** or **Yes, cancel**.

> 💡 If the server refuses a move, a red box appears headed **The server refused that move** with the reason spelled out. That usually means the kitchen screen advanced the order while you were reading it. Nothing is broken — the message tells you where the order actually is now.

## Payment

The **Payment** panel shows **Method**, **Status**, **Amount taken**, **Refunded**, **Refundable balance**, and the payment reference if it went through Razorpay.

If nothing's been taken yet it says **No payment has been recorded against this order yet.** and offers **Record payment**:

1. Press **Record payment**.
2. Choose **Method** — **Cash**, **Card**, **UPI** or **Razorpay**.
3. For cash, card and UPI: check the **Amount**, add a **Notes** line if it was split (*"Split — cash ₹300 + UPI ₹200"*), and press **Record Payment**.
4. For Razorpay: the amount is locked to the order total and you press **Open Razorpay**, which brings up the payment window for the guest to scan.

## Refunds — the careful bit

The **Refunds** panel shows **Refundable ₹840** and a red **Refund…** button, with the full history of every attempt underneath.

Sometimes the button is greyed out, and the reason is written in plain words below it — one of:

- *This order has no payment to refund.*
- *A payment with status "pending" cannot be refunded.*
- *Only Razorpay payments refund from here — record cash, card and UPI refunds manually.*
- *This payment has already been refunded in full.*

To give money back:

1. Press **Refund…**. The box is titled **Refund order #1042** and tells you how much of the payment is still refundable.
2. Choose **Full — ₹840** or **Partial**.
3. If you chose **Partial**, type the figure into **Amount to refund (₹)**.
4. Fill in **Reason (required)** — at least a few words, up to 200 characters. Something like *"Customer received the wrong variant"*. This is written onto the refund record, sent to the payment provider as a note, and copied into the audit trail. It is not optional and it should not be lazy.
5. Press **Refund**.

**Partial vs full — they are genuinely different things.**

A **partial** refund moves money and nothing else. The order carries on being whatever it was. The customer keeps the points they earned.

> ⚠️ **A full refund closes the order.** The box tells you so before you commit: *"The order moves to **Refunded** and loyalty is clawed back: the points it earned are reversed and the points the customer redeemed against it are restored."* So a full refund does three things at once — the money goes back, the order becomes **Refunded** and stops being a live order, and the points ledger is unwound in both directions. If a guest earned 40 points on this order, those 40 come off their balance. If they spent 620 points on it, those 620 go back to them. That is usually exactly what you want. It is also impossible to half-do, so decide before you press it.

If the payment provider says no, a red box appears headed **The gateway refused this refund** with their own message, and the failed attempt is still recorded in the history below. That's deliberate — an attempt that didn't work is still something the next person needs to know about.

## Shipment, Timeline, and the receipt

If the order has any **Shipped** lines, a **Shipment** panel appears with the parcel's status, **Provider**, **AWB**, **Courier**, **Weight**, **ETD** and a link to the courier's own tracking page, plus **Open shipment**. If no parcel exists yet it says *"This order has shipped lines but no parcel yet. Pack it from the Shipments queue — packing is what creates the shipment row."* and gives you **Go to "To pack"**.

**Timeline** down the right is the order's life story, newest first: when it was placed, when it was paid, every courier scan, every refund attempt, and where it stands now.

**Print receipt** is at the top of the page. Press it and a small receipt window opens and goes straight to your printer dialog. It prints exactly the figures on this screen, with GST shown as an *of which* note and never added to the total.

> 💡 If nothing happens when you press **Print receipt**, your browser has blocked the pop-up — a message will say **Allow pop-ups for this site to print the receipt.** Allow it and press again.

---

# 🛵 Delivery Queue — your own riders

**https://www.konma.store/pos/delivery**

*"Manage active delivery orders, assign riders, and track progress."*

This is only for deliveries your own people are running. Courier parcels live on the next screen.

1. Click **Delivery Queue**. The table shows **Order #**, **Customer**, **Address**, **Assigned To**, **Delivery Status**, **Actions**.
2. If nobody's assigned yet, the **Assigned To** cell shows an **Assign** button. Press it, type the **Rider or staff name**, press **Save**.
3. As the rider moves, press the button in **Actions**: **Mark Picked Up**, then **Mark In Transit**, then **Mark Delivered**.
4. An order that hasn't left yet shows **Awaiting pickup**.

The list refreshes itself every thirty seconds, and an order drops off it once it's delivered or cancelled. When there's nothing running you get **No active deliveries** — *"Delivery orders in progress will appear here."*

---

# 📦 Shipments — the parcel desk

**https://www.konma.store/shipments**

*"Pack the orders that need a box, put a waybill on them, and watch them travel."*

Top right you'll see either **Live** (a green dot — updates are arriving the instant they happen) or **Refreshing every 30s** (still perfectly current, just on a timer). There's also a **Refresh** button if you want to force it.

There are **two tabs, and they are two different jobs.**

## Tab 1 — **To pack**

Orders that have something to ship and **no box yet**. Nothing more, nothing less.

Each one is a card showing the order number, its status, channel and time, the customer, the shipping address, the list of items going in the box, and a line like **2 units to ship · ₹1,190 order**.

1. Get the physical items together.
2. Press **Pack parcel** on that card.
3. A box opens: **Pack order #1042**, telling you how many units across how many lines go in — and reminding you that *"Local and booking lines on this order are handled elsewhere."*
4. **Parcel weight (grams)** — **leave this blank** unless the parcel has actually been on a scale. Blank means the system adds up each product's real catalogue weight, which is nearly always better than a guess.
5. **Pickup location code** — leave blank to use the configured default.
6. Press **Pack parcel**.
7. You get **Order #1042 is packed** and, underneath, **Assign an AWB next to hand it to the courier.**

When the bench is clear you'll see **Nothing waiting to be packed** — *"Every open order with shipped items already has a parcel. New orders land here as soon as they are paid."*

> ⚠️ **Pack before you move the order on.** This queue only looks at orders that are Placed, Confirmed, Preparing or Ready. The moment you mark the order **shipped**, it drops off this tab. If that's already happened, find the order in **Order History** instead and use its **Shipment** panel.

> 💡 Pressing **Pack parcel** twice is harmless — the system hands you back the same parcel rather than making a second one. Two people at the same bench will never fight over it.

## Tab 2 — **Shipments**

Every parcel that exists, with a **Status** filter (**All statuses**, or one of the ten below). The table shows **Order**, **Customer**, **Status**, **AWB**, **Packed** and **Next step**.

**Next step** is deliberately one button, not four — whichever single move the parcel is allowed to make. Once it's with the courier it just says **With the courier**, because from then on the courier's scans do the work.

| Badge | What's happened |
| --- | --- |
| **Packed** | Box is made. No waybill yet. |
| **AWB assigned** | It has a tracking number. |
| **Pickup scheduled** | The courier has been asked to collect. |
| **Picked up** | The courier physically has it. |
| **In transit** | It's moving. |
| **Out for delivery** | Last leg. |
| **Delivered** | Done. |
| **Returned to origin** | It came back. Needs a human. |
| **Cancelled** | Someone stood the courier down. |
| **Failed** | Something went wrong. Needs a human. |

### Assigning an AWB (the tracking number)

Press **Assign AWB**. What you see next depends entirely on which courier this parcel was booked with — and the box tells you which, in its subtitle: **Order #1042 · Manual courier** or **Order #1042 · Shiprocket**.

**If it says Shiprocket:** there is a blue notice — **Shiprocket issues this AWB** — *"The waybill number and courier name come back from Shiprocket, so there is nothing to type. Confirm to request one."* You have nothing to fill in. Press **Request AWB** and the number comes back from them.

**If it says Manual courier:** you type it yourself, because a person handed you a slip.
1. **AWB number** — *"The number the courier wrote on the parcel."*
2. **Courier name** — *"Delhivery, Blue Dart, the local runner…"*
3. Press **Assign AWB**.

Either way there's a **Tracking link (optional)** box — the page the customer opens to follow the parcel. It's kept on both kinds. Paste it if the courier gave you one.

You'll see **AWB assigned** and **Schedule the pickup when the parcel is ready to leave.**

> 💡 If the courier's system is unreachable you'll be told *"The courier did not answer. The parcel is unchanged — try again in a moment."* That's their end, not a mistake of yours, and nothing has been half-saved.

### Scheduling the pickup

Press **Schedule pickup** once the parcel is physically ready to leave the building. Until an AWB exists the button is greyed out and hovering it says *"Assign an AWB before scheduling a pickup."*

> ⚠️ **Scheduling a pickup does not mark the order shipped.** The confirmation says so out loud: *"The order moves to Shipped on the courier's first scan, not now."* All this button does is ask the courier to come. The order flips to **Shipped** later, on its own, the moment the courier actually scans the parcel as picked up. Don't sit waiting for a status change that only a courier can cause — and don't book a second pickup because the first "didn't work".

### Labels

Press **Label**. Three things can happen, and they all mean something different:

- The label opens in a new browser tab. Print it and stick it on.
- A blue message: **No label for manual shipments** — *"This parcel was booked with the manual provider, which issues no printable label."* That's normal. The courier's own paperwork travels with the box.
- A red message telling you to **assign an AWB before printing a label**.

You can reprint a label any time after the AWB exists, including after delivery.

### One parcel, in full

Click an order number (or the **›** arrow) to open a single parcel. You get a **Parcel** card — **AWB**, **Courier**, **Provider**, **Weight**, **Courier charge**, **Expected**, **Pickup point**, **Packed**, **Ships to** — then the action buttons, then **What is in the box** (only the shipped lines; anything eaten in or booked is handled on its own lane), then **Tracking**, which is the full scan-by-scan history.

If nothing more can be done to it you'll read *"This parcel has reached a final state — there is nothing left to do to it here."*

**Cancel parcel** is the red one. Its box says: *"The courier is told to stand down and the parcel cannot be un-cancelled. The order itself is not cancelled by this."* You must give a **Reason** of at least four characters — it goes into the parcel's permanent record and nobody can answer it for you a month from now. Press **Keep the parcel** to back out or **Cancel parcel** to go through.

---

# 👤 Customers — the people

**https://www.konma.store/customers**

*"Everyone who has ordered, booked or reviewed — with their loyalty balance and marketing consent."*

## Finding someone

1. Click **Customers**.
2. Type into **Search by phone, name or email**. It searches as you type — all three fields at once — so a phone number on a scrap of paper is enough.
3. Underneath the box it tells you what it found: *"12 customers matching "9900""*.
4. The table shows **Customer**, **Email**, **Points**, **Tier**, **Orders · Reviews · Bookings**, **Marketing**, **Last seen**. **Load more** brings the next page.
5. Click a name to open their page.

If nothing matches: **No customer matches that search** — *"Nothing came back for "…". Search matches phone, name and email."*

## Their page

At the top: their name, phone, email, **Customer since …· last seen …**, and four figures:

| Figure | What it counts |
| --- | --- |
| **Lifetime value** | Everything they've spent, GST included, billable orders only |
| **Orders** | How many, and how many of those were billable |
| **Last order** | When, or **Never** |
| **Reviews · Bookings** | Plus their coupon redemptions underneath |

Then five tabs — **Orders**, **Loyalty**, **Reviews**, **Addresses**, **Coupons** — each with its count in brackets.

- **Orders** — their recent orders, newest first, each showing the total with *of which GST* and any discount underneath. The little arrow at the end of a row opens that order's full page.
- **Reviews** — what they've written. Read-only here; you act on reviews from the **Reviews** queue.
- **Addresses** — read-only. *"A customer edits these from their own account."*
- **Coupons** — one row per coupon per order, with how much each one actually took off.

**Marketing** is a switch at the top right, with a badge reading **Opted in** or **Opted out**. Flipping it asks first: *"…will be excluded from marketing emails and campaigns. Order and delivery notifications are unaffected."* Underneath, in grey: *"The change is recorded in the audit log against your account. Only do this when the customer has actually told you."* Choose **Opt in** / **Opt out**, or **Cancel**.

## Adjusting loyalty points — and why the note matters

The **Loyalty** tab shows **Balance**, **Lifetime points** (*"Sets the tier; never burns down"*), **Tier** (**Member**, **Regular**, **Insider**), and the ledger — **When**, **Reason** (**Earned**, **Redeemed**, **Adjusted**, **Expired**), **Change**, **Balance after**, **Note**, and a link to the order it came from.

1. Press **Adjust points**.
2. The box says how many points they have, and: *"A positive number credits, a negative number claws back."*
3. In **Points**, type a whole number — **250** to give, **-50** to take away. As you type it shows you the result: *"New balance: 870 points (+250)."*
4. In **Reason**, write why. Example placeholder: *"Goodwill credit for the delayed shipment on order #1042."*
5. Press **Apply adjustment**.

> ⚠️ **The reason is compulsory** — at least 3 characters, at most 500 — and it is not there to slow you down. Every adjustment writes a permanent ledger row *and* an audit entry against your name. A points balance that changed for no recorded reason is exactly the thing nobody can explain six months later when a guest queries it, so the system simply won't let you make one. Write the sentence you'd want to read if someone else had done it.

> 💡 You can't take a balance below zero, and the form tells you the ceiling while you're typing: *"You can remove at most 620 points."* Points are earned when an order is **delivered** or an experience is **attended** — not when it's paid for.

---

# ⭐ Reviews — what gets seen

**https://www.konma.store/reviews**

*"Customers can review a line once it has been delivered or attended. Publishing one puts it on the product page and folds its score into the product's rating."*

Four tabs: **Pending**, **Published**, **Hidden**, **All**. It opens on **Pending**, which is your queue.

Each review is a card with the star rating, its status, when it came in, a link to the product on the public site, the customer's name and phone, whatever they wrote, and any photos they attached.

## Publishing

1. Read it.
2. Press **Publish**.
3. Confirmation: **Published to Konma Signature Thali.** — *"Its 5-star score now counts towards the product's rating."*

That's the whole action, one click, because the queue is meant to be worked through.

## Hiding

1. Press **Hide**.
2. A box appears: **Hide this review?** — *"It leaves Konma Signature Thali's page and its 2-star score stops counting towards the product rating. The customer still sees it on their own account as un-published. You can publish it again at any time."*
3. **Reason (optional)** — e.g. *"names a member of staff, or is about the wrong product."* It's recorded on the audit trail against your name and is **never shown to the customer**.
4. Press **Hide review**.

> ⚠️ **Publishing and hiding move the product's star rating.** A product's public average and review count are recalculated the instant you press either button. Publishing a 1-star review will visibly pull the product's rating down on the website; hiding a 5-star one will pull it up. Neither is a small edit — it's a change to what every future customer sees.

> 💡 Hiding is not deleting. Hidden reviews stay in the **Hidden** tab so the decision can be revisited, and you can publish one again at any time. Hide things that break the rules — naming staff, wrong product, abuse — not things that are simply unflattering.

An empty **Pending** tab reads **Nothing waiting on you** — *"Every review a customer has written has been published or hidden."* That's a good result, not an error.

---

# 🎟️ Promotions — coupon codes

**https://www.konma.store/promotions**

*"Coupon codes customers can apply at checkout."* The header also tells you how many exist and how many are **live right now**.

## The three kinds of coupon, in plain words

| **Discount type** | What it does |
| --- | --- |
| **Percentage off** | Takes a percentage off the basket. `WELCOME10` is 10% off. You can put a **Maximum discount (₹)** ceiling on it so a huge basket doesn't cost you a fortune — `WELCOME10` is capped at ₹200. |
| **Flat amount off** | Takes a fixed number of rupees off. `PANTRY150` is ₹150 off. |
| **Free shipping** | Zeroes the delivery charge instead of touching the item prices. `SHIPFREE` is one of these. It only helps a basket that actually has something being posted — a cart with nothing shipped is told so at checkout. |

## Reading the table

**Code**, **Type**, **Value**, **Min order**, **Max discount**, **Applies to**, **Window**, **Usage**, **Per customer**, **Status**.

The **Status** badge is the honest one — it's the coupon's *effective* state, not just what's stored:

| Badge | Means |
| --- | --- |
| **Live** | Working at checkout right now |
| **Scheduled** | Turned on, but its window hasn't opened yet |
| **Expired** | Turned on, but its window has closed |
| **Draft** | Not offered to anyone until you set it Active |
| **Disabled** | Switched off. Its history is kept. |

**Usage** shows redemptions against the cap, with a little bar — and says **Fully redeemed** when it's hit the ceiling, because from that moment the code stops working whatever the badge says.

## Making one

1. Press **New coupon**. A panel slides in from the right: **New coupon** — *"A new coupon starts as a draft — nothing is offered to customers until you set it to Active."*
2. **Code** — 3 to 32 characters. It's saved in capitals, so `welcome10` and `WELCOME10` are the same coupon.
3. **Status** — **Draft**, **Active** or **Disabled**. *"Only **Active** coupons are accepted at checkout, and only inside the window below."*
4. **Description (optional)** — an internal note for your colleagues. Customers never see it.
5. **Discount type** — one of the three above.
6. **Percentage off** or **Amount off (₹)**, and for a percentage coupon, **Maximum discount (₹)** (*"Leave empty for no ceiling"*).
7. **Minimum order (₹, optional)** — measured against the whole basket including GST, not just the eligible bits.
8. **Applies to** — tick **Prepared food**, **Packaged**, **Experience**, **Merchandise**. *"Leave every box clear to apply the discount to all four product types."*
9. **Starts** and **Ends** — *"Both instants are read in India Standard Time, whatever this machine is set to."* The end must be after the start.
10. **Total redemptions (optional)** and **Per customer (optional)** — leave blank for unlimited.
11. Press **Create coupon**.

To change one later, press the **pencil** icon on its row. Changes take effect *"from the moment you save."*

## Why it says **Disable**, not Delete

Press the **circle-with-a-line** icon on a row and you get:

> ⚠️ **Disable WELCOME10?** — *"The code stops working at checkout immediately. It stays on this list as **Disabled**, and every redemption already made against it is kept — a redeemed coupon is part of an order's financial record and is never deleted. You can set it back to Active later."*

That's the whole reason. Once a code has taken money off a real order, that discount is part of that order's accounts forever. Deleting the coupon would leave orders in the books with a discount that came from nowhere. So there is no delete — only an off switch, and it's reversible. Choose **Keep it active** or **Disable coupon**.

> 💡 Nothing on this screen previews what a customer would save. The rules live here; the actual arithmetic happens once, at checkout, so the number the customer is shown and the number that's charged can never disagree.

---

# 🍽️ Catalog — the products

**https://www.konma.store/operations/menu**

The sidebar calls it **Catalog**; the page heading says **Menu**. Same screen.

Along the top are the brand tabs — **Konma Food**, **Just Craves** — and **Add Category**. Products sit under their category headings.

## A product card

Name, price, a food-cost badge, and a small grey line: **2 variants · 1 image** (it turns amber if it says **No images**). Then:

- The **Published** switch — flip it on and the product appears on the public site; flip it off and it goes back to being a draft. You get **Product published.** or **Product unpublished.**
- **Edit** — opens the full product panel.

## Editing a product

The panel that slides in has three tabs: **Details**, **Variants**, **Media**.

### **Details**

1. **Name** — e.g. *Konma Signature Thali*.
2. **Slug** — fills itself in from the name. *"Used in the storefront URL. Lowercase letters, numbers and hyphens."*
3. **Type** — **Prepared food**, **Packaged**, **Experience** or **Merchandise**. Underneath it tells you what that choice implies about fulfilment and stock. This is the switch that decides whether a thing is eaten here or posted.
4. **Recipe (approved only)** — for the types that are made from a recipe. Only approved recipes are offered. If there are none: *"No approved recipes available. Approve a recipe before adding products."*
5. **Category**.
6. **Base Price (INR)**.
7. **Food Cost %** appears as a coloured badge once there's a recipe and a price — your instant read on whether the price works.
8. **Description (optional)** — the short line the storefront shows.
9. The **Published** switch.
10. Press **Add Product** (new) or **Save Changes** (existing).

> 💡 On a brand-new product the **Variants** and **Media** tabs are greyed out until you've saved once — they need the product to exist first. After you press **Add Product** you're taken straight to **Variants** with the message *"Product added. Variants and media are available now."*

### **Variants**

*"Each variant is a separate cart line on the storefront, priced at the base price plus its delta."*

That's sizes and options — **Small (180 ml)** and **Large (300 ml)** for the filter coffee, **100 g** and **250 g** for the garam masala, **Terracotta** and **Olive** for the mug.

1. Press **Add variant**.
2. Give it a **name** (what the customer picks from) and a **SKU** (the internal code — it must be unique; the screen will tell you if it collides with an existing one).
3. Set the **price delta** — how much more or less than the base price. `0` for the standard option.
4. For stock-tracked products, set **stock on hand** and a **low-stock threshold**.
5. Mark exactly one variant as the **default** — the one pre-selected on the website.
6. Save.

If none is marked you'll see an amber warning: *"No variant is marked as the default. The storefront picker will have nothing pre-selected until one is."*

**Archiving** a variant *"disappears from the storefront picker but stays attached to the orders that already bought it. Set its status back to Active to bring it back."*

### **Media** — and why alt text isn't optional

*"The first image is the one the storefront card, the product page and the share preview lead with. Drag, or use the arrows, to change which that is."*

1. Drop an image on the dashed box, or press **Choose image**. **JPEG, PNG or WebP · up to 10.0 MB.**
2. Fill in **Alt text (required)**. Placeholder: *"Sourdough loaf, sliced, on a wooden board."*
3. Press **Upload image**. You'll see the progress as it goes.

> ⚠️ **You cannot upload a photo without alt text**, and the screen will say so: *"Alt text is required — it is what the storefront gallery and the OG card read out."* Three separate things read that sentence: a guest using a screen reader, who has nothing else to go on; the product card on the website; and the preview card that appears when someone shares the link on WhatsApp. One skipped box makes the product invisible to a blind customer and makes the share look broken. Describe what's actually in the photo — not "product image".

You can edit alt text later from the pencil on each thumbnail, reorder by dragging, and remove an image. Removing the **first** one warns you: *"This is the cover image. Removing it promotes the next one — or leaves the storefront on its placeholder tile if there is no next one."*

**Channel modifiers** sit at the bottom of the page — one adjustment per channel (**Dine-In**, **Takeaway**, **Delivery**, **Marketplace**). That's the per-channel pricing the till mentioned.

> ⚠️ Deleting a **category** deletes every product inside it, and it can't be undone. The box says so. Almost always, unpublishing is what you actually meant.

---

# 🎪 Experiences — dinners and workshops

**https://www.konma.store/operations/events**

The page is headed **Experience Events**, with **Create Event** at the top right.

The table shows **Title**, **Date**, **Type** (**Dining**, **Workshop**, **Pop-Up**, **Tasting**, **Other**), **Status** (**Draft**, **Upcoming**, **Live**, **Past**, **Cancelled**), **Capacity** with a fill bar and *"4 left"*, **Bookings**, and edit/delete icons.

To make one, press **Create Event** and fill in **Title**, type, **Date & Time**, **Capacity**, **Price**, optional zone and brand, **Description (optional)** and **Image URL (optional)**.

## The Bookings panel — where the day actually happens

Press **Bookings** on the row. A panel slides in with the experience's name and date.

### Seats

At the top: **9 / 12 seats taken**, **3 left** (or **Full**), a coloured bar, and a key showing how many are **confirmed**, **attended**, **held**, **no-show**, **cancelled**. Under it: *"Held seats count against capacity only until their timer runs out. No-shows and cancellations never do."*

### **Held by a checkout in progress**

This is the panel that trips people up, so here's what it is. When a customer starts paying for a seat, the system quietly reserves it for fifteen minutes so a second customer can't buy the same last chair while the first is typing in their card. Each held seat shows the name, phone, party size and a **countdown** — amber under five minutes, red under two.

When nothing is held: *"Nothing is held right now. A hold appears the moment a customer quotes this experience."*

When a timer runs out the row simply disappears and you'll see a line like *"1 hold just ran out. Those seats are already back in the pool."* Nothing has gone wrong — the seat is free again.

> 💡 A held seat is **not** a booking. It becomes one only when the payment lands. If the panel says every booking is still a hold, it means people are mid-checkout right now, not that you have a room full of guests.

### Marking attendance on the day

The **Bookings** table shows **Guest**, **Party**, **Payment**, **Status**, **Attendance**. Two buttons sit on each confirmed row: **Attended** and **No-show**.

**Before the experience has started**, both buttons are greyed out and a note explains: *"This experience hasn't happened yet. Attendance opens on 29 Sept 2026, 19:00."* Hovering the buttons says *"Attendance opens when the experience starts."*

**On the day:**

1. Work down the list as people arrive.
2. Press **Attended** for a guest who turned up. A box asks first: *"…This flips the linked order item to attended, opens the review gate so the customer can review this experience, and credits loyalty on the order. It cannot be undone."* Press **Mark attended**.
3. Press **No-show** for a guest who didn't. Its box: *"The linked order item is cancelled, no review invitation goes out and no loyalty is credited. It cannot be undone."* Press **Mark no-show**.
4. Once the room has settled, use **Mark 8 attended** at the top to check in everyone who's left.

> ⚠️ **Mark your no-shows first, then use the bulk button.** The bulk confirmation says exactly that. **Attended** and **No-show** are both final — there is no way back from either — so the bulk button will happily check in someone who never arrived if you press it too early.

---

# 🌙 Daily Close — putting your name on the day

**https://www.konma.store/operations/daily-close**

*"One signed record per business day. The numbers are frozen when they are computed and frozen for good when they are signed — nothing on this screen is recalculated as you read it."*

This is the last thing you do, and it's the one screen where you are one of only two named signatories — you and the Founder/Admin.

## Picking a day

At the top: **Business day** with a date box and **‹** / **›** arrows, plus a **Yesterday** shortcut. It opens on **yesterday**, because a night's takings aren't complete until the night is over. Under it is a **Recent:** strip of the last fourteen days — a padlock means signed, a clock means still open. Click one to jump to it.

Next to it is a badge telling you where the day stands:

- **Open · computed 31 Aug 2026, 00:45** — computed but not yet signed.
- **Signed by Advitha2 · 31 Aug 2026, 09:12** — done, and by whom.

## Reading the cards

### **Orders & revenue**

*"Orders placed on this business day, excluding cancelled and refunded ones."* A table of every channel — **Dine-In**, **Takeaway**, **Delivery**, **Marketplace** — with orders and revenue, then **All channels** as the total.

Under it, **How the day's takings reconcile**, which is the day's bill read the same way an order's bill reads:

| Line | Plain words |
| --- | --- |
| **Item subtotal** | What the food and goods came to |
| **Channel modifier** | Per-channel adjustments |
| **Discounts** | Coupons and points, taken off |
| **Shipping** | Delivery charges taken in |
| **Revenue** | The day's money |
| *of which GST* | Tax that is **already inside** revenue — never added to it |
| **Net of GST** | *"What the node keeps before cost."* |

Then four counts: **Cancelled** and **Refunded orders** (both marked *Not in revenue*), **Refunds processed** (*Rail confirmed today*) and **Refunded amount** (*Money returned today*).

> 💡 Cancelled and refunded orders are **counted separately rather than subtracted**. That's on purpose: "we sold ₹40,000 and gave ₹3,000 back" is a truer picture of a day than "we sold ₹37,000".

### **Waste**

**Entries** and **Cost**, then a breakdown by reason. On a clean day: *"Nothing was written off on this day."*

### **Prep batches**

**Opened** and **Opened and depleted** (*Same-day only*). The card explains its own limitation honestly: a batch opened yesterday and finished today counts in neither figure, because a batch doesn't record when it ran out.

### **Stock reconciliation**

A badge saying **Clean** or **3 drifted**. Then **Stock rows checked**, **Drifted**, and **Last drift recorded**.

> 💡 **"Last drift recorded: None" is good news.** The overnight job only writes something down when the counted stock and the expected stock disagree. No timestamp means nothing disagreed — it does *not* mean the job was skipped. The card says so under the figure.

If something did drift, a **Review ingredient stock** button appears.

### **Shipments**

Parcels *created* on this day, folded into four counts that don't overlap: **Still open** (*Someone's problem*), **Failed** (*Needs a human*), **Delivered**, **Cancelled**. If anything is open or failed, there's an **Open the shipments queue** button.

## **Recompute**

Press **Recompute** to re-gather the numbers.

- On an **open** day it re-reads everything and you get *"2026-08-30 recomputed."* Do this if late refunds or a corrected waste entry landed after the overnight job ran. You can do it as often as you like.
- On a **signed** day it changes nothing and tells you so: *"2026-08-30 is already signed — the frozen figures are unchanged."*

If a day has no close at all — the overnight job hasn't run yet, or it missed one — you'll see **No close has been computed for 2026-08-30** and a **Compute 2026-08-30** button. That's a normal state, not a fault.

## Signing — the one thing you can't take back

The bottom card is **Sign off on 2026-08-30** — *"Signing freezes every figure above. Anything that lands after this — a late refund, a corrected waste entry — will not change what you signed."*

1. Read every card above properly. This is the whole job.
2. Write anything a future reader would need in **Note** (optional, up to 2000 characters). The placeholder is a good example: *"Power cut 19:00–20:30, two orders comped…"* — and the hint underneath is the standard to write to: *"Frozen with the numbers, so write it for whoever reads this day a year from now."*
3. Press **Sign off**.
4. A box appears: **Sign off on 2026-08-30?** — *"A signed close is frozen and cannot be recomputed. The figures on this screen become the permanent record of the day, and there is no way to unsign it."*
5. Press **Sign and freeze** — or **Not yet** if you want another look.
6. You'll see **2026-08-30 is signed. The numbers are now frozen.**

> ⚠️ **Signing freezes the day, permanently.** This is not "saving" and it is not "marking as read". Once you sign:
> - The numbers on that screen become the permanent record of that day.
> - A recompute will refuse to change them — it hands back the frozen row untouched.
> - Anything that arrives later — a refund processed the next morning, a waste entry someone forgot — will *not* appear in the day you signed.
> - There is no unsign button, for anyone, including administrators.
>
> Your name and the timestamp go on it. So: read the cards, recompute if something's obviously missing, write the note, *then* sign.

After signing, the card becomes a receipt headed **Signed off**, showing **Signed by**, **Signed at**, and your note.

> 💡 If someone else signs the day while you're looking at it, you'll see **Someone else signed this day — refreshing.** and the receipt appears. Nothing's gone wrong; the day is closed.

---

# 🔔 Your notifications

The **bell** in the top bar carries a red count. Click it for the last twenty, or **View all notifications** for the full page at **https://www.konma.store/notifications** — with tabs **All**, **Unread**, **Tasks**, **Approvals**, **Operations**, and **Mark all as read**.

These are the ones that are specifically yours:

| Nudge | When it arrives | What it says |
| --- | --- | --- |
| **Shipment Failed** | The moment a parcel goes **Failed** or **Returned to origin**, and again on the hourly sweep if it's still stuck. Only for parcels that have moved in the last 14 days. | *"Shipment failed: Order 1042"* — *"AWB 12345 is failed. Re-book or refund from the Shipments queue."* Takes you straight to **Shipments**. |
| **Daily Close Due** | Just after midnight, once the night's numbers are computed. Only the two named signatories get it — you and the Founder/Admin. | *"Daily close ready for 2026-08-30"* — *"Yesterday's numbers are computed and waiting for a signature."* |
| **Morning Brief** | Each morning. | Your day, summarised. |
| **Task Due** / **Task Blocked** | 48 hours before one of your tasks is due; and whenever one of yours is stuck. | Takes you to the task. |
| **Approval Pending** | When something you're an approver on has been waiting more than a day. | Takes you to **Approvals**. |

> 💡 The same nudge won't spam you. A failed shipment repeats at most every 6 hours, and the daily-close reminder at most once every 20 — so one problem is one message, not forty.

> 💡 **Shipment Failed** and **Daily Close Due** don't sit under the **Operations** tab on the notifications page. Look under **All** or **Unread** for those.

---

# 🌟 Worked example — one order, end to end

Do this once, all the way through, on a quiet morning. It touches nearly every screen in this guide and takes about twenty minutes. Tick as you go.

### Part 1 — Make a coupon

- [ ] Go to **https://www.konma.store/promotions**.
- [ ] Press **New coupon**.
- [ ] In **Code**, type `FRONTDESK10`.
- [ ] Set **Status** to **Active**.
- [ ] In **Description (optional)**, write *Front desk training coupon*.
- [ ] Set **Discount type** to **Percentage off**.
- [ ] In **Percentage off**, type `10`.
- [ ] In **Maximum discount (₹)**, type `200` — so it can never take more than ₹200 off, however big the basket.
- [ ] Leave **Minimum order**, **Applies to**, and both limit boxes empty for now.
- [ ] Leave **Starts** and **Ends** as they are — a fortnight from today, in Indian time.
- [ ] Press **Create coupon**.
- [ ] Check the message: *"FRONTDESK10 created."* and *"It is offered at checkout inside its window."*
- [ ] Find it in the table. Its **Status** badge should read **Live**, its **Type** **Percentage off**, its **Value** **10%**, its **Max discount** **₹200.00**, and **Applies to** should say **All types**.

> 💡 `FRONTDESK10` now works on the public website. It will *not* appear anywhere on the till — coupons are a checkout thing, not a counter thing.

### Part 2 — Take a mixed order

- [ ] Go to **https://www.konma.store/pos**.
- [ ] Make sure the **Konma Food** brand tab is selected.
- [ ] Under **Signature Plates**, find **Konma Signature Thali** (₹480) and press **+ Add**. That's your prepared-food line — it gets made in the kitchen and handed over here.
- [ ] Scroll to **Pantry & Provisions**, find **Konma Garam Masala** (₹340) and press **+ Add**. That's your shipped line — it has to go in a box and travel.
- [ ] In **Order Summary**, check you have two lines and a **Subtotal** of ₹820.
- [ ] Leave the channel on **Dine-in**.
- [ ] In **Customer name (optional)**, type `Demo Customer`.
- [ ] In **Table number**, type `4`.
- [ ] In **Any special requests? (optional)**, type *Training order — please ignore.*
- [ ] Press **Place Order**.
- [ ] Note the order number from the green message: **Order #… placed**.

### Part 3 — Walk it through its life

- [ ] Go to **https://www.konma.store/pos/orders**.
- [ ] Find your order in the table and click the row.
- [ ] Look at **Items**. You should see two groups: **Local — counter, table or rider** with the thali, and **Shipped — courier parcel** with the garam masala. That grouping is the point of the exercise — one basket, two different teams.
- [ ] Look at **Totals** on the right. **Subtotal (incl. GST) ₹820**, then **Total ₹820**, then the small grey note *of which GST …* — proof that tax is inside the price, never on top.
- [ ] In the **Payment** panel, press **Record payment**, leave the method on **Cash**, leave the amount as-is, and press **Record Payment**.
- [ ] In the **Lifecycle** panel, press **Start preparing**. The badge at the top goes to **Preparing**.
- [ ] Press **Mark ready**. The badge goes to **Ready**, and three buttons appear.
- [ ] **Before going further:** open **https://www.konma.store/shipments** in another tab, stay on **To pack**, and find your order there. Press **Pack parcel**, leave both boxes blank, and press **Pack parcel**. You'll get *"Order #… is packed"* and *"Assign an AWB next to hand it to the courier."*
- [ ] Go back to the order tab. Press **Mark shipped**. (You have to pass through one of the three **Ready** options — **Mark served**, **Mark dispatched** or **Mark shipped** — before **Delivered** is offered. This order has a parcel, so **shipped** is the honest one.)
- [ ] Press **Mark delivered**. Read the box that appears — *"Delivering credits the customer's loyalty points for this order and fires the review invitation."* — and press **Yes, continue**.
- [ ] Look at **Totals** again. A **Loyalty points** row has appeared with a `+` figure. Those points were credited by that button press, not by the payment.
- [ ] Press **Print receipt** at the top and check the printout shows the two items and the *of which GST* note.

> ⚠️ Pack the parcel **before** you mark the order shipped. The **To pack** queue only looks at orders that are Placed, Confirmed, Preparing or Ready — once it's shipped, it disappears from that tab and you'd have to reach the parcel through the order's own **Shipment** panel instead.

### Part 4 — Find the person

- [ ] Go to **https://www.konma.store/customers**.
- [ ] In **Search by phone, name or email**, type `9900000001` (the demo customer's number).
- [ ] Click **Demo Customer** to open their page.
- [ ] Check the top strip: **Lifetime value**, **Orders**, **Last order**, **Reviews · Bookings**.
- [ ] Open the **Orders** tab. Your order should be at the top, newest first, with its total, its *of which GST* line and its status.
- [ ] Open the **Loyalty** tab. Look at **Balance** and **Lifetime points**, then find the newest ledger row — its **Reason** should be **Earned** and its **Order** column should link back to the order you just walked through.

### Part 5 — Publish a review

- [ ] Go to **https://www.konma.store/reviews**.
- [ ] Stay on the **Pending** tab.
- [ ] If there's a review waiting, read it, then press **Publish**.
- [ ] Check the message: *"Published to …"* and *"Its N-star score now counts towards the product's rating."*
- [ ] Switch to the **Published** tab and confirm it's moved there.
- [ ] If **Pending** says **Nothing waiting on you**, that's fine — nothing is broken. Reviews only become possible after a customer receives something, so come back once real orders have been delivered.

### Part 6 — Read the day

- [ ] Go to **https://www.konma.store/operations/daily-close**.
- [ ] It opens on **yesterday**. Use the **›** arrow once, or the date box, to move to **today**.
- [ ] If it says **No close has been computed for …**, press **Compute …**.
- [ ] Read the **Orders & revenue** card. Find your channel in the table and check the order count went up by one.
- [ ] Read **How the day's takings reconcile** from top to bottom. Say each line out loud in your own words: *this is what the food came to; this is what we gave away; this is what came in; this much of it is tax we're only holding; this is what's actually ours.*
- [ ] Read the **Waste**, **Prep batches**, **Stock reconciliation** and **Shipments** cards.
- [ ] Look at the bottom card. Because today isn't over, you can see the **Sign off on …** form — but **stop here and do not sign a day that is still running.**

> ⚠️ **Don't sign today as part of this exercise.** Signing freezes the numbers permanently, and a day that's still trading has hours of orders left in it. Signing is a tomorrow-morning job, on yesterday's close, once the numbers are complete. That's why the screen opens on yesterday.

### Part 7 — Tidy up

- [ ] Go back to **https://www.konma.store/promotions**.
- [ ] Find `FRONTDESK10` and press the **disable** icon on its row.
- [ ] Read the box, then press **Disable coupon**.
- [ ] Confirm its badge now reads **Disabled** and that it's still sitting in the list — because that's the point.

---

# 📖 Quick reference

**Order statuses:** Placed → Confirmed → Preparing → Ready → *(Served | Dispatched | Shipped)* → Delivered → Completed. Plus **Cancelled** and **Refunded**, which are ends, not steps.

**Parcel statuses:** Packed → AWB assigned → Pickup scheduled → Picked up → In transit → Out for delivery → Delivered. Plus **Returned to origin**, **Cancelled** and **Failed**.

**The four things that can't be undone:**

| Action | Where | What it locks in |
| --- | --- | --- |
| **Mark delivered** / **Complete order** | Order detail | Credits loyalty, fires the review invitation, closes the order |
| **Full refund** | Order detail → **Refund…** | Order becomes **Refunded**; earned points reversed, redeemed points restored |
| **Attended** / **No-show** | Experiences → **Bookings** | Opens or shuts the review gate; credits or withholds loyalty |
| **Sign and freeze** | Daily Close | Freezes that day's numbers for good, under your name |

**Two things that only *look* final but aren't:** hiding a review (you can publish it again) and disabling a coupon (you can set it back to Active).

**Two things that sound like they'd do more than they do:** **Cancel order** doesn't move any money — use the refund panel for that. **Schedule pickup** doesn't mark the order shipped — the courier's first scan does that.
