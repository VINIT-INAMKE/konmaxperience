> 🛍️ **Walk in the customer's shoes.** This guide is for *staff*. It takes you through the storefront at **https://www.konma.store** exactly as a customer meets it — the shop, a product page, an experience, the cart, checkout, tracking, and the account area. You'll understand what people see before they ring you about it.

> 💡 **Why this is worth an hour of your time.** Every complaint you'll ever field starts on one of these screens. "Where's my grand total?" "My coupon didn't work." "It says the price expired." Walk it once and you'll answer those from memory.

---

# ⚠️ Before you start — two things that will bite you

## 📱 Sign-in codes aren't reaching customers yet

Customer login is a 6-digit code sent over **WhatsApp**. WhatsApp is switched off until Meta approves our message templates, and WhatsApp is the *only* channel the code can travel on.

> ⚠️ **Ask the tech lead for your code before you try to sign in.** Sign-in codes currently surface only on the server side, not on any phone. If you plan to walk the whole journey, arrange that first — everything from the cart onward needs you signed in.

The rules that *are* live, so you recognise the error messages: codes are 6 digits, expire after **5 minutes**, you get **3 requests per phone per hour** and **5 guesses per code**.

## 💳 Razorpay is in TEST mode

No real money moves. There is deliberately **no "test mode" badge anywhere on the site** — it looks exactly like the live thing.

> ⚠️ **Use Razorpay's test card flow when you reach the payment step.** Never enter a real card. If you're unsure which test card to use, ask tech — don't improvise.

---

# 🏠 The shop — browsing the shelves

Go to **https://www.konma.store** and click **Shop**.

## What a customer sees first

Across the top, before anything else, the promise:

> *Cooked in the villa kitchen · shipped across India · every price includes GST*

Then the heading **Shop**, and the standfirst:

> *Everything the villa kitchen makes — food cooked to order, pantry jars shipped across India, seats at the table and kit from the kitchen. Every price includes GST.*

Note **"every price includes GST"** appears twice before a customer sees a single product. That's deliberate, and it's why there's no tax line added anywhere later.

## The shelves

Four product types, each with its own heading and voice:

| Type | Heading | How it reaches the customer |
| --- | --- | --- |
| **Prepared food** | *Prepared food* | *Collection or local delivery* |
| **Packaged** | *Pantry* | *Ships across India* |
| **Experience** | *Experiences* | *Reserved for a sitting* |
| **Merchandise** | *Merchandise* | *Ships across India* |

And five categories: **Signature Plates**, **Beverages**, **Pantry & Provisions**, **Experiences**, **Villa Merchandise**.

## Filtering, sorting, searching

1. On a wide screen, the **Filter** rail sits on the left with two groups — **Type** and **Category**. Each starts with an **All** option. **Clear all** resets them.
2. On a phone, the same filters become scrollable chips. An active chip has an × to dismiss it.
3. **Sort** offers four options: **Curated** (the default), **Price: low to high**, **Price: high to low**, **Best rated**.
4. Products load 24 at a time. **Load more products** fetches the next batch; when you reach the bottom it says **That is everything.**

> 💡 **Curated is the only sort that pages properly.** Pick any other and a note appears: *"Ordered across the first 200 products."* With our catalogue that's academic, but it's why the count line sometimes reads *"Showing the first N products."*

5. Try **Search** from the header. The placeholder is *"Search the shop — pickles, mugs, supper club…"* and the empty prompt suggests *"coconut", "ceramic", "supper"*.

> 💡 A new search **resets your type and category filters** on purpose — otherwise people search for "mug" while filtered to Beverages and conclude we don't sell mugs.

## What a product card tells you

- The price shown is **"from" the cheapest variant**, not the base price.
- A card with more than one variant shows **2 options** instead of an add button — you must pick on the product page.
- An experience shows **Book**, never an add button.
- Anything simple gets a one-click **Add** button that flips to **Added** for a moment.

---

# 🍵 A product page

Click through to **Masala Chai** (₹90, in **Beverages**).

1. The breadcrumb reads **Home → Shop → Beverages → Masala Chai**.
2. The price sits under the name with **Inclusive of all taxes** beneath it.
3. The availability line updates itself **every 60 seconds**. For kitchen items it reads *"Made to order · N servings left today"*, or *"Sold out for today"*.
4. Set a quantity with the − / + stepper, then **Add to cart**.

## Variants

Now open **Villa Filter Coffee** instead. It has two variants, so a picker appears:

- Legend: **Choose an option**
- **Small (180 ml)** — ₹120
- **Large (300 ml)** — ₹160

The button stays inert until you choose, with **Choose an option to continue.** underneath. Try clicking anyway and you get a toast: *"Choose an option first."*

> 💡 Two variants of the same product are **two separate cart lines**, not one line with a note. That's why a customer can have a small and a large chai in the same order.

## Photos, details, reviews

- The gallery sits at the top. Every product has at least one image.
- **Details** lists only what's filled in — *About this*, *The story*, *Net weight*, *Shelf life*, *HSN code*.
- **Reviews** shows an average out of 5, a star-bar breakdown and the reviews themselves, ten at a time behind **Show more reviews**.

With nothing seeded yet, reviews read:

> **No reviews yet** — *Reviews come from customers once their order has been delivered. Be the first to say how this one landed.*

That sentence is the rule: **you cannot review something you haven't received.**

## 🎟️ Experiences never add from the product page

Open **Fermentation Workshop** from the shop and you'll find no add button at all. Instead:

> *Places are chosen with a date and a guest count. Your seat is held for 15 minutes once you reach checkout.*

…and a button, **View dates and book**.

---

# 🎪 Experiences — seats and dates

Click **Experiences** in the main nav.

> *Dinners, workshops and tastings run at the villa on a fixed date, for a fixed number of people. Places go into your cart and are held for fifteen minutes once you reach checkout.*

Two groups: **Upcoming** (*"Every sitting still open, soonest first"*) and **Past sittings** (*"These have already run. They are here because we usually run them again."*).

Two experiences are running:

| Experience | Type | Price a seat | Capacity |
| --- | --- | --- | --- |
| **Chef's Table Dinner** | Dining | ₹4,500 | 12 places |
| **Fermentation Workshop** | Workshop | ₹2,500 | 16 places |

Open **Fermentation Workshop**:

1. A fact grid shows **Date**, **Time**, and **Sitting** (*"16 places"*).
2. The capacity note counts down honestly — *"12 of 16 places left"*, tightening to *"Only 3 of 16 places left"* and *"Last place — 1 of 16 left"*, then **Sold out · all 16 places taken**.
3. Set **Guests** with the stepper. The helper caps you: *"Up to N in one booking."*
4. Click **Add to cart**.

> ⚠️ **Adding here does not reserve the seat.** The page says so: *"Adding it here puts it in your cart — it does not reserve the seat yet."* The seat is held only when you reach the checkout Review step, and only for 15 minutes.

> 💡 **One booking per guest per sitting.** Come back and change the number and the button reads **Update your booking** — it *replaces* your party size rather than adding a second booking. That's why a customer can't accidentally book twice.

The seat count re-polls every 60 seconds, so a sitting can sell out while you're looking at it.

---

# 🛒 The cart — three kinds of thing

Click the cart icon. The heading is **Your cart**.

## The three groups

The cart deliberately **never flattens** your items into one list. It groups them by how they reach you:

| Group | Heading | What it says |
| --- | --- | --- |
| 🍳 **Pickup / local** | **From the villa kitchen** | *Cooked to order at the villa. Collect it yourself or have it brought to you — we confirm the window at checkout.* |
| 📦 **Shipped** | **Shipped to you** | *Packed from the pantry and handed to a courier. Shipping is quoted at checkout, once we have your pincode.* |
| 🎟️ **Experience booking** | **Booked experiences** | *Your seats are held while you pay and confirmed the moment payment lands. Nothing is shipped — just turn up on the day.* |

Understand these three and you understand the whole storefront. They stay separate through checkout and all the way through order tracking, because they're fulfilled by three different people on three different clocks.

## If your cart has kitchen items

A selector appears — **How would you like the kitchen items?**

> *Kitchen prices can differ between collection and delivery, so we re-check them with the server when you switch.*

- **Collect from the villa** — *Ready at the kitchen counter at your slot. Nothing to pay for delivery.*
- **Deliver to me** — *Brought to your address, if it falls inside the villa's delivery zone.*

Nothing is preselected. The customer must choose.

## 💰 Why there is no grand total

This is the question you'll be asked most, so here's the answer in full.

The Summary panel shows exactly three things:

1. **Subtotal (incl. GST)**
2. **of which GST** — carved *out of* the subtotal, never added to it
3. And this line:

> *Shipping, coupons and loyalty are calculated at checkout.*

**There is no Total row, and that's a deliberate decision.** Shipping depends on the customer's pincode. A coupon depends on validation. Loyalty depends on their balance and a cap. None of those three exist until there's a channel and an address — which the cart doesn't have.

> 💡 **The alternative was worse.** Show a "Total" that's really just the subtotal and you've lied. Demand an address before showing a cart and you've built a wall. Showing the subtotal, naming the GST inside it, and saying plainly what's still to come is the only honest option.

## Other things the cart does

- **Unavailable lines block checkout on purpose.** A banner reads *"We cannot sell this right now. Remove it to carry on — the rest of your cart is untouched."* with a **Remove all unavailable** button.
- If a price moved since you added it: *"One price changed since you added it — the new price is marked below."*
- Not signed in? *"You are browsing as a guest — your cart is saved on this device."* The button reads **Sign in to check out**.
- At quantity 1, the − button becomes a bin.

Empty, it reads:

> **Your cart is empty** — *Everything from the villa kitchen, the pantry shelf and the events calendar lives a click away.*

---

# 💳 Checkout — three steps and a countdown

Click **Continue to checkout**. The heading is **Checkout**:

> *Three short steps. Your price is held for 15 minutes once you reach the last one.*

| Step | Label | Hint |
| --- | --- | --- |
| 1 | **Contact** | *Who we are sending this to* |
| 2 | **Fulfilment** | *Where it goes, or when you collect* |
| 3 | **Review** | *Your price, held for 15 minutes* |

## Step 1 — Contact

If you're signed out, the OTP form appears **inline** — you're never bounced to a separate login page, because that would lose a guest cart. The preamble reads *"Your cart is saved. Sign in to place the order — we will not lose anything."*

Signed in, you'll see *"Signed in as {name}"* and your number. Click **Continue to fulfilment**.

## Step 2 — Fulfilment

What you're asked depends entirely on what's in the cart.

1. **If you have kitchen items**, choose **Deliver to my address** or **Collect at the villa** (*"No delivery area limits, and no delivery charge."*).
2. **If you have shipped items**, you always need an address: *"Your shipped items go by courier and always need a delivery address."*
3. **If you only booked an experience**, you walk straight through — *"Your experiences are attended at the villa — nothing to deliver."*

Adding an address:

1. Use **Search for your address** to autofill, or type it directly.
2. **Full address** — *"Flat, building, street, area"*
3. **Landmark (optional)**
4. **Pincode** — six digits. *"A pincode is exactly six digits."*
5. **Save and use this address**

> 💡 **Serviceability is checked on every keystroke of the pincode**, before any price is calculated. You'll see *"We deliver from the villa to this pincode"* for kitchen items and *"{courier} delivers here, arriving {date}"* with an estimated shipping cost for parcels. These are two independent checks — a pincode can pass one and fail the other.

If local delivery is refused, an escape hatch appears: **Collect at the villa instead**.

## Step 3 — Review and pay

**This is where the clock starts.** Arriving on this step does three things at once: it freezes your price, it creates a **15-minute hold on every experience seat** in your cart, and it burns a coupon validation.

### 🎟️ The coupon

Under **Have a coupon?** — the placeholder is literally `WELCOME10`.

1. Type **WELCOME10**.
2. Click **Apply**.
3. It becomes **WELCOME10 applied** with the rupees off, and a **Remove** link.

The live coupons:

| Code | What it does | Catch |
| --- | --- | --- |
| **WELCOME10** | 10% off, capped at ₹200 | Minimum order **₹500** |
| **PANTRY150** | ₹150 off | Minimum **₹900**, packaged goods only |
| **SHIPFREE** | Free shipping | Minimum **₹1,200**, shipped goods only |
| **EXPIRED5** | 5% off | **Expired** — it exists to prove the date check works |

> 💡 **Coupon errors are written for customers, and they're actionable.** Try **EXPIRED5** and you get *"This coupon has expired."* Try **PANTRY150** on a small cart and you get *"Add ₹150.00 more to use this coupon"* — a number you can act on, not "Invalid coupon."

> ⚠️ **Only one coupon per order.** Stacking is off. There is no UI to add a second.

### ⭐ Loyalty points

Under **Loyalty points**, with the balance and tier beside it. The demo customer holds **620 points** at **Regular** tier.

Drag the **Points to redeem** slider. Underneath you'll see *"N of MAX points"* on the left and the rupees off on the right.

The economics, so you can explain them:

- Points are worth **₹0.25 each** — so 4 points = ₹1, and 620 points = **₹155**.
- You earn **5 points per ₹100** of net order value.
- **You can never redeem more than 20% of the subtotal.** The slider's maximum is already clamped to this; it is not your raw balance.
- Points expire **365 days** after they're earned.

> ⚠️ **Points are earned on delivery or attendance — not on payment.** The footnote says *"This order earns about N points once it is delivered or attended."* A customer who pays today and collects Friday gets their points Friday.

If the cap bites, it tells you: *"Only N points can be used on this order — we applied that much."*

### ⏱️ The 15-minute price promise

Watch the countdown at the top of the price panel:

- Normally: **Price held for 14:32**, ticking down.
- Under three minutes it turns amber. Same words, louder.
- At zero: **This price has expired**, and the Pay button disables.

The expiry banner explains it without alarming anyone:

> **Your price has expired** — *Your price and any experience holds have lapsed. Refresh to get a fresh price — the items in your cart are untouched.*

…and offers **Refresh price**.

> 💡 **Nothing is lost when it expires.** The cart is untouched. The only casualty is the held seat, which goes back into the pool for someone else — which is exactly the point of holding it for a bounded time.

### The price panel

Read it top to bottom. This is the first place in the entire journey a **Total** appears:

1. **Subtotal (incl. GST)**
2. **of which GST** — with a **Show GST rates** toggle breaking it down by rate
3. **Coupon {CODE}** — as a negative
4. **Loyalty points** — as a separate negative, with *"N points redeemed"*
5. **Shipping** — a figure, or **Free**, with the courier and arrival date
6. **Total**

> 💡 Coupon and loyalty are kept on **separate lines** deliberately. They're different things — one is a promotion, one is the customer's own balance — and merging them makes both harder to query later.

### 💳 Paying

1. The button reads **Pay ₹{amount}**. Underneath, always: *"Secured by Razorpay. Your card details never reach us."*
2. Click it. The button walks through **Starting payment… → Waiting for payment… → Confirming your order…**
3. The Razorpay modal opens. **Use a Razorpay test card** — we're in test mode.
4. On success you land on the tracking page.

> 💡 **Dismissing the modal costs nothing.** The button returns to **Pay ₹{amount}**, the quote and countdown untouched. And double-tapping Pay can't double-charge — the same payment attempt is reused.

If payment succeeds but the order doesn't finish writing, the button becomes **Retry finishing your order** with a reassurance: *"Your payment went through but we could not finish the order. Tap retry — you will not be charged twice."*

---

# 📦 Order tracking — the live page

You land on **Order #{number}** with a confirmation:

> *Payment received — your order is confirmed. This page updates itself as it moves.*

## It really is live

Look at the top-right indicator:

- **Live** — connected; updates arrive the instant they happen.
- **Refreshing every 30s** — not connected, so the page polls instead.

Either way the customer sees the truth. Both stop once the order and its parcel are finished.

## One rail per kind of thing

**A mixed order gets one timeline per group — never a single averaged progress bar.** This is the cart's three kinds showing up again, and it's why a customer isn't told "50% complete" when their chai is ready and their parcel hasn't shipped.

**From the kitchen** — *Prepared at the villa and driven to your address*:

> Order placed → Payment confirmed → Being prepared → **Ready to leave** → Out for delivery → Delivered

For collection, the last stages read **Ready for collection** → **Collected**, and no delivery step ever appears.

**Shipped to you** — with **Courier**, **Tracking number (AWB)** and **Estimated arrival**, each with an honest placeholder (*Being assigned*, *Not issued yet*, *To be confirmed*):

> Packed → AWB assigned → Pickup scheduled → Picked up → In transit → Out for delivery → Delivered

Below that, **Courier scans**. Empty at first: *"No courier scans yet. They appear here as the parcel moves."* A stage the parcel passed with no scan is marked **No courier scan recorded** rather than quietly ticked.

**Your experience** — *Your seat is held from the moment you pay and confirmed on the guest list*:

> Seat held → Booking confirmed → Attended

Below the rails, **What you paid** repeats the full breakdown, plus *"N points are credited once this order is delivered."* There's a **Receipt** link in the header too.

---

# 👤 The account area

Click your name in the header. Six sections down the left:

| Section | What's there |
| --- | --- |
| **Overview** | Loyalty tile, reviews tile, two recent orders, marketing toggle |
| **Orders** | Every purchase, all channels |
| **Addresses** | The saved address book |
| **Loyalty** | Balance, tier, progress, full ledger |
| **Reviews** | What's waiting, and what you've written |
| **Preferences** | Details, messages consent, sign out |

## Orders — and where bookings live

> *Everything you have bought from us — in the villa, by post, or a seat at a workshop.*

> 💡 **There is no separate "Bookings" tab.** Workshop seats appear in **Orders** alongside everything else — one list, newest first, no channel tabs and no filters. That's deliberate: customers think in *purchases*, not fulfilment methods.

Each card carries **Receipt**, **Track order** and **Order again**. Reorder is smarter than it looks — it adds every line, re-checks with the server, and drops anything no longer available, telling you what it dropped.

Empty: **No orders yet** — *"Everything you buy — in the villa, by post or a seat at a workshop — shows up here."*

## Loyalty

> *Points earn on delivery or attendance, and come off the bill at checkout.*

**Points balance** with its rupee value, the **Tier** badge, lifetime points, and progress to the next tier. Tiers are **Member** (0), **Regular** (500), **Insider** (2,000).

**Points activity** lists the last 50 movements, tagged **Earned**, **Redeemed**, **Adjusted** or **Expired**, each with the running balance. Anything expiring within 30 days is flagged.

The footnote repeats the rule you'll be asked about: *"Points are earned when an order is delivered or a workshop attended — not when it is paid for."*

## Addresses

> *Where we deliver. The default one is picked automatically at checkout.*

Add, edit, delete, and **Make default**. Labels are **Home**, **Work** or **Other**. The demo account has one: *Home — 12 Thoraipakkam OMR, Chennai, 600096*.

## Reviews

> *Tell other people what something was actually like.*

Two sections. **Waiting for your review** lists invitations — these appear **24 hours after an order is delivered**, never before. Each has a **Write a review** button opening a composer: **Your rating** (required), **Headline (optional)**, **Review (optional)**.

**Reviews you have written** states the moderation status plainly:

- **Published** — *Live on the product page.*
- **Awaiting moderation** — *A moderator reads every review before it goes live.*
- **Not shown** — *A moderator has taken this one off the product page.*

> 💡 A review rated **4 or 5 publishes automatically**; anything lower waits for a human. Nobody is ever left guessing which state theirs is in.

## Preferences

Your **Name** and **Email (optional)** — the phone is fixed, marked *"your sign-in — cannot be changed here."*

**Messages** carries one toggle, **Offers and new arrivals**, with a line that pre-empts the complaint: *"Order updates and receipts are sent either way — those are not marketing."*

And **Sign out**: *"Signing out revokes this device's token on our side and clears the cart stored in this browser."*

---

# 💬 Feedback — private, and not a review

Feedback lives at a **per-order link** (`/feedback/{order id}`) — customers reach it from a QR code or a link after a meal, not from a menu.

- Heading: **Tell us about your meal** — *Quick feedback, big impact.*
- **Rate your meal** (required), **Comments**, **Name (optional)**, **Phone (optional)**
- Button: **Submit Feedback**

The thank-you draws the distinction that matters:

> **Thank you!** — *Your feedback goes straight to the team who made this. It stays private.*

…then offers **Write a public review →**.

| | Feedback | Review |
| --- | --- | --- |
| **Visibility** | Private, team only | Public on the product page |
| **Login** | Not needed | Signed in |
| **Scope** | The whole order | One delivered item |
| **Moderation** | None | Every one is read |

> 💡 **This is why an unhappy customer has two doors.** Feedback is a private word with the kitchen. A review is a public statement. Offering only the second makes people either shout or stay silent.

---

# 🌟 Worked example — the full shopping trip

Do this end to end. It takes about twenty minutes and it's the single best hour you can spend understanding the storefront.

**Get set up:**

- [ ] Ask the tech lead for a sign-in code, or confirm with them that the OTP path is working today. Don't skip this — everything past the cart needs it.
- [ ] Confirm you have a **Razorpay test card** to hand. Never use a real one.
- [ ] Open **https://www.konma.store**.

**Browse and fill a cart with all three kinds:**

- [ ] Click **Shop**. Filter **Category → Beverages**.
- [ ] Open **Masala Chai** (₹90). Read **Inclusive of all taxes** and the availability line. Click **Add to cart**. *(That's your pickup item.)*
- [ ] Go back to **Shop** and filter **Type → Packaged**. Open **Konma Garam Masala** (₹340).
- [ ] Notice it has two variants — pick **250 g** (₹760) and **Add to cart**. *(That's your shipped item.)*
- [ ] Click **Experiences** in the nav. Open **Fermentation Workshop** (₹2,500).
- [ ] Read the capacity note. Set **Guests** to 1 and **Add to cart**.
- [ ] Read the footnote carefully: *"Adding it here puts it in your cart — it does not reserve the seat yet."* **Nothing is held yet.** *(That's your booking.)*

**Read the cart properly:**

- [ ] Open the cart. Confirm you see **three separate groups**: **From the villa kitchen**, **Shipped to you**, **Booked experiences**.
- [ ] Under the kitchen group, choose **Collect from the villa** or **Deliver to me**.
- [ ] Look at the Summary. Find **Subtotal (incl. GST)** and **of which GST**.
- [ ] Confirm for yourself that **there is no Total** — and read why: *"Shipping, coupons and loyalty are calculated at checkout."*
- [ ] Click **Continue to checkout**.

**Walk the three steps:**

- [ ] **Contact** — sign in with the code you were given. Click **Continue to fulfilment**.
- [ ] **Fulfilment** — pick or add an address. Watch the serviceability line resolve as you type the sixth pincode digit.
- [ ] Click **Continue to review**. **The 15-minute clock starts now, and your workshop seat is held from this moment.**

**Work the money:**

- [ ] Find the countdown. It should read **Price held for 14:5x**.
- [ ] Under **Have a coupon?**, type **EXPIRED5** and click **Apply**. Read the error: *"This coupon has expired."* Now you've seen a real failure.
- [ ] Clear it and apply **WELCOME10**. Your cart is well over the ₹500 minimum, so it takes. Confirm the discount appears as its own line.
- [ ] Drag the **Points to redeem** slider up. Watch the maximum stop short of 620 — that's the 20% cap.
- [ ] Redeem a few points. Confirm **Loyalty points** appears as a **separate line** from the coupon.
- [ ] Read the whole panel top to bottom: subtotal → GST → coupon → loyalty → shipping → **Total**. Click **Show GST rates** to see the breakdown.
- [ ] Watch the countdown pass **3:00** and turn amber. If you're patient, let it hit zero and read the expiry banner, then click **Refresh price** to prove nothing was lost.

**Pay and track:**

- [ ] Click **Pay ₹{amount}**. Read *"Secured by Razorpay. Your card details never reach us."*
- [ ] Complete the Razorpay modal with the **test card**.
- [ ] Land on the tracking page. Read *"Payment received — your order is confirmed."*
- [ ] Check the top-right indicator: **Live** or **Refreshing every 30s**.
- [ ] Confirm you see **three separate rails** — kitchen, parcel, experience — and *not* one combined progress bar. Read the parcel's placeholders: *Being assigned*, *Not issued yet*.
- [ ] Scroll to **What you paid** and check it matches what you agreed to.
- [ ] Click **Receipt**.

**Find everything again:**

- [ ] Go to **Account → Orders**. Your order is at the top — and so is the **workshop seat**, in the same list. No separate bookings tab.
- [ ] Click **Order again** on it and watch it rebuild your cart, dropping anything unavailable. *(Then empty the cart.)*
- [ ] Go to **Account → Loyalty**. Your balance has **dropped by the points you redeemed**. Find that redemption in **Points activity**, tagged **Redeemed**.
- [ ] Confirm the points you *earned* are **not there yet** — they land on delivery or attendance, not on payment. This is the single most common customer question.
- [ ] Go to **Account → Addresses** and confirm the address you used is saved.
- [ ] Go to **Account → Reviews**. It reads **Nothing waiting on a review** — invitations arrive 24 hours *after* delivery, and nothing has been delivered yet.
- [ ] Go to **Account → Preferences** and read the **Messages** toggle wording.

---

> 🛍️ **That's the whole journey.** Three kinds of item, one honest cart with no fake total, a fifteen-minute promise on the price, three tracking rails because three different people fulfil them, and one account area that remembers all of it. When a customer calls, you now know exactly which screen they're looking at.
