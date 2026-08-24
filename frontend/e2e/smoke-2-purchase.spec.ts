import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import {
  applyCustomerSession,
  customerApi,
  loginCustomer,
  type CustomerSession,
} from './fixtures/customer';
import { installRazorpayStub, razorpayStubState } from './fixtures/razorpay-stub';
import { sendPaymentCaptured } from './fixtures/webhook';

/**
 * **Smoke 2 — the purchase** (`QA-06`).
 *
 * One customer walks the money path the storefront was built for: browse →
 * facet → product detail → variant → a cart holding all **three** fulfilment
 * types → the three-step checkout → a coupon → loyalty points → the frozen
 * quote → Razorpay → a signed `payment.captured` → the tracking page. Plus the
 * two negatives that cost nothing to prove: an expired coupon is refused in the
 * server's own words, and a line the server will not sell blocks checkout.
 *
 * ## Nothing here is hard-coded that the data can move
 *
 * The seeded demo database is not a fixture this suite owns — earlier smokes
 * have already bought from it, so `masala-chai` is sold out, the demo customer
 * has `attended` the Fermentation Workshop and `WELCOME10`
 * (`per_customer_limit: 1`) may already be spent. Every one of those would break
 * a spec written against literal slugs, so the products are **chosen at run
 * time** from `GET /catalog/products` + `GET /catalog/availability/:id`, the
 * experience is chosen from the sittings this customer has no booking on, and
 * the coupon assertion accepts either of the two answers the server is entitled
 * to give — asserting the exact text in both cases. `e2e/README.md` documents
 * the reset that restores the strict path locally; CI seeds a fresh database
 * every run and therefore always takes it.
 *
 * ## Why the payment is confirmed by webhook and not by the modal
 *
 * The Razorpay stub cannot mint a `razorpay_signature` the backend will accept,
 * so `POST /customer/orders/confirm` is not walkable from a stubbed browser.
 * `POST /webhooks/razorpay` is — and it runs the same `confirmPaidOrder`, so the
 * order this produces is the real thing. See `fixtures/webhook.ts`.
 */

test.describe.configure({ mode: 'serial' });

/** `PRODUCT_TYPE_LABELS` — the facet link text for a product's type. */
const TYPE_FACET_LABEL: Record<string, string> = {
  prepared_food: 'Prepared food',
  packaged: 'Packaged',
  experience: 'Experience',
  merchandise: 'Merchandise',
};

// ─── money helpers ──────────────────────────────────────────────────────────

/** `"₹5,730.00"` → `5730`, `"−₹5.00"` → `-5`, `"Free"` → `0`. */
function parseMoney(text: string): number {
  const trimmed = text.trim();
  if (/^free$/i.test(trimmed)) return 0;
  const negative = /^[−–-]/.test(trimmed);
  const value = Number(trimmed.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(value)) {
    throw new Error(`Not a money string: ${JSON.stringify(text)}`);
  }
  return negative ? -value : value;
}

/** The `QuoteSummary` that is actually on screen — desktop aside or mobile block. */
function quoteSummary(page: Page): Locator {
  return page.locator('[data-slot="quote-summary"]:visible').first();
}

function moneyRow(scope: Locator, label: string | RegExp): Locator {
  return scope.locator('[data-slot="money-line"]').filter({ hasText: label });
}

/** `MoneyLine` renders exactly two child spans: the label, then the amount. */
async function readMoneyRow(row: Locator): Promise<number> {
  return parseMoney(await row.locator('xpath=./span[2]').innerText());
}

async function readMoneyRowIfPresent(row: Locator): Promise<number> {
  return (await row.count()) === 0 ? 0 : readMoneyRow(row.first());
}

// ─── catalog helpers ────────────────────────────────────────────────────────

interface CatalogVariant {
  id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
}

interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  type: string;
  fulfilment: 'local' | 'shipped' | 'booking';
  base_price: number;
  event_id: string | null;
  variants: CatalogVariant[];
}

interface Availability {
  available: boolean;
  servings_remaining: number;
}

interface EventRow {
  id: string;
  spots_remaining?: number | null;
}

interface CustomerBooking {
  event_id: string;
  status: string;
}

async function catalogProducts(api: APIRequestContext): Promise<CatalogProduct[]> {
  const response = await api.get('/catalog/products?limit=100');
  expect(response.ok(), 'GET /catalog/products').toBeTruthy();
  const body = (await response.json()) as { items: CatalogProduct[] };
  return body.items;
}

async function isSellable(api: APIRequestContext, product: CatalogProduct): Promise<boolean> {
  const response = await api.get(`/catalog/availability/${product.id}`);
  if (!response.ok()) return false;
  const body = (await response.json()) as Availability;
  return body.available && body.servings_remaining > 0;
}

/** The first product of this fulfilment the kitchen or the shelf can still supply. */
async function pickSellable(
  api: APIRequestContext,
  products: CatalogProduct[],
  fulfilment: CatalogProduct['fulfilment'],
  extra: (p: CatalogProduct) => boolean = () => true,
): Promise<CatalogProduct> {
  const candidates = products.filter((p) => p.fulfilment === fulfilment && extra(p));
  for (const product of candidates) {
    if (await isSellable(api, product)) return product;
  }
  throw new Error(
    `No sellable "${fulfilment}" product in the catalogue. Re-seed the demo data ` +
      '(see frontend/e2e/README.md) — earlier runs have consumed the stock.',
  );
}

/**
 * An experience this customer can still book, or `null` when there is none.
 *
 * `EventBooking` is `@@unique([event_id, customer_phone])` and only `held` rows
 * are swept, so a *confirmed* seat from an earlier run permanently blocks that
 * sitting for this customer: `CheckoutService.createHolds` turns the P2002 into
 * `You already have a booking for "…"` and the whole quote fails. Picking around
 * it is the only thing a test can do without writing to the database.
 *
 * With the two seeded sittings that gives two strict local runs. **On CI this is
 * fatal** — the database is seeded fresh for every job, so an exhausted
 * catalogue there means something is genuinely wrong. Locally it degrades: the
 * booking line is dropped, the omission is annotated, and the rest of the money
 * path still runs. `e2e/README.md` has the SQL that restores the full walk.
 */
async function pickBookableExperience(
  api: APIRequestContext,
  products: CatalogProduct[],
): Promise<CatalogProduct | null> {
  const [eventsResponse, bookingsResponse] = await Promise.all([
    api.get('/events'),
    api.get('/customer/bookings'),
  ]);
  const events = (await eventsResponse.json()) as EventRow[];
  const bookings = (await bookingsResponse.json()) as CustomerBooking[];

  // A `held` row is released by the next quote; anything else is permanent.
  const blocked = new Set(bookings.filter((b) => b.status !== 'held').map((b) => b.event_id));
  const open = new Set(
    events.filter((e) => !blocked.has(e.id) && (e.spots_remaining ?? 0) > 0).map((e) => e.id),
  );

  const candidate = products.find(
    (p) => p.fulfilment === 'booking' && p.event_id && open.has(p.event_id),
  );
  if (!candidate && process.env.CI) {
    throw new Error(
      'No bookable sitting on a freshly seeded database — the `booking` leg of the purchase ' +
        'cannot run. Check `seed:demo` and `GET /events`.',
    );
  }
  return candidate ?? null;
}

// ─── page helpers ───────────────────────────────────────────────────────────

/** How many lines the header's mini-cart trigger is announcing. */
async function cartLineCount(page: Page): Promise<number> {
  const label = await page
    .locator('button[aria-haspopup="dialog"][aria-label^="Cart,"]')
    .first()
    .getAttribute('aria-label');
  const match = /Cart, (\d+) lines?/.exec(label ?? '');
  return match ? Number(match[1]) : 0;
}

/** The cart lives in `localStorage` *and* in Redis; a clean run clears both. */
async function emptyBothCarts(page: Page, api: APIRequestContext): Promise<void> {
  await page.goto('/shop');
  await page.evaluate(() => window.localStorage.removeItem('cart-storage'));
  const cleared = await api.delete('/customer/cart');
  expect(cleared.ok(), 'DELETE /customer/cart').toBeTruthy();
  await page.reload();
  await expect.poll(() => cartLineCount(page)).toBe(0);
}

async function addFromProductPage(
  page: Page,
  product: CatalogProduct,
  variantName?: string,
): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/p/${product.slug}$`));
  await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();

  const panel = page.locator('[data-slot="add-to-cart-panel"]');
  await expect(panel).toBeVisible();

  if (variantName) {
    const picker = panel.locator('[data-slot="variant-picker"]');
    await expect(picker).toBeVisible();
    await picker.locator('label').filter({ hasText: variantName }).click();
  }

  const before = await cartLineCount(page);
  await panel.getByRole('button', { name: 'Add to cart' }).click();
  await expect.poll(() => cartLineCount(page)).toBe(before + 1);
}

// ─── the walk ───────────────────────────────────────────────────────────────

let session: CustomerSession;
let api: APIRequestContext;

test.beforeAll(async () => {
  session = await loginCustomer();
  api = await customerApi(session);
});

test.afterAll(async () => {
  await api?.dispose();
});

test('smoke 2 — a mixed-fulfilment order, paid and tracked', async ({ page, context, baseURL }) => {
  await applyCustomerSession(context, session, baseURL ?? 'http://localhost:3000');
  await installRazorpayStub(page);

  const products = await catalogProducts(api);
  const shipped = await pickSellable(api, products, 'shipped', (p) => p.variants.length > 1);
  const local = await pickSellable(api, products, 'local');
  const experience = await pickBookableExperience(api, products);

  // A named variant that is *not* the default, so the choice is provably carried.
  const chosenVariant =
    shipped.variants.find((v) => !v.is_default) ?? shipped.variants[shipped.variants.length - 1];

  /** The fulfilment groups this run actually put in the cart. */
  const expected: CatalogProduct['fulfilment'][] = experience
    ? ['local', 'shipped', 'booking']
    : ['local', 'shipped'];
  const added = experience ? [shipped, local, experience] : [shipped, local];

  if (!experience) {
    test.info().annotations.push({
      type: 'note',
      description:
        'This customer already holds a booking on every upcoming sitting, so the `booking` leg ' +
        'was skipped and the cart carried two fulfilment groups. Reset the demo bookings to ' +
        'restore the full three-group walk — see frontend/e2e/README.md.',
    });
  }

  await emptyBothCarts(page, api);

  await test.step('browse, narrow with a facet, open the product', async () => {
    await page.goto('/shop');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const facets = page.locator('[aria-label="Filter products"]:visible').first();
    await facets
      .getByRole('link', { name: TYPE_FACET_LABEL[shipped.type], exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`[?&]type=${shipped.type}`));

    await page.locator(`a[href="/p/${shipped.slug}"]`).first().click();
  });

  await test.step('the product detail page, with an explicit variant', async () => {
    await addFromProductPage(page, shipped, chosenVariant.name);
  });

  await test.step('a villa-kitchen line', async () => {
    await page.goto(`/p/${local.slug}`);
    await addFromProductPage(page, local);
  });

  if (experience) {
    await test.step('an experience, booked from its own page', async () => {
      await page.goto(`/experiences/${experience.slug}`);
      const panel = page.locator('[data-slot="booking-panel"]');
      await expect(panel).toHaveAttribute('data-state', 'open');

      const before = await cartLineCount(page);
      await panel.getByRole('button', { name: /^(Add to cart|Update your booking)$/ }).click();
      await expect.poll(() => cartLineCount(page)).toBe(before + 1);
    });
  }

  await test.step('/cart — one group per fulfilment type, and no grand total', async () => {
    await page.goto('/cart');
    await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();

    await expect(page.locator('[data-slot="cart-fulfilment-group"]')).toHaveCount(expected.length);
    for (const fulfilment of expected) {
      await expect(
        page.locator(`[data-slot="cart-fulfilment-group"][data-fulfilment="${fulfilment}"]`),
      ).toBeVisible();
    }

    const cart = page.locator('[data-slot="cart-summary"]');
    await expect(moneyRow(cart, 'Subtotal (incl. GST)')).toBeVisible();
    // P5b decision 6 — the cart must never imply a total it cannot know.
    await expect(cart.locator('[data-slot="money-line"][data-variant="total"]')).toHaveCount(0);
    await expect(
      cart.getByText('Shipping, coupons and loyalty are calculated at checkout.'),
    ).toBeVisible();

    // `Button` renders its `<Link>` as `<a role="button">`, so the accessible
    // role is `button` even though the element is an anchor.
    await expect(cart.locator('a[href="/checkout"]')).toHaveCount(1);
    await cart.getByRole('button', { name: 'Continue to checkout' }).click();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  await test.step('checkout step 1 — contact', async () => {
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    await expect(page.getByText(/^Signed in( as .+)?$/)).toBeVisible();
    await page.getByRole('button', { name: 'Continue to fulfilment' }).click();
  });

  await test.step('checkout step 2 — fulfilment and address', async () => {
    await expect(page.getByRole('heading', { name: 'Fulfilment' })).toBeVisible();
    // A shipped line always needs an address; the default one is pre-selected.
    const chosen = page.locator('input[name="checkout-delivery-address"]:checked');
    if ((await chosen.count()) === 0) {
      await page.getByRole('button', { name: 'Add a new address' }).click();
      await page.locator('#checkout-address').fill('12 Thoraipakkam OMR, Chennai');
      await page.locator('#checkout-pincode').fill('600096');
      await page.getByRole('button', { name: 'Save and use this address' }).click();
    }
    await expect(chosen).toHaveCount(1);

    await page.getByRole('button', { name: 'Continue to review' }).click();
  });

  const summary = quoteSummary(page);

  await test.step('checkout step 3 — the frozen price', async () => {
    await expect(page.getByRole('heading', { name: 'Review and pay' })).toBeVisible();
    await expect(summary).toBeVisible({ timeout: 60_000 });

    // Every line the cart held is on the quote.
    for (const product of added) {
      await expect(summary.getByText(product.name, { exact: false }).first()).toBeVisible();
    }

    // The 15-minute clock — P5a risk 5's containment.
    await expect(page.locator('[data-slot="quote-countdown"]:visible').first()).toHaveText(
      /Price held for \d{1,2}:\d{2}/,
    );

    // GST is carved *out of* the subtotal, so it renders "of which" — never a `+` line.
    const gst = summary.locator('[data-slot="money-line"][data-variant="of-which"]');
    await expect(gst).toHaveCount(1);
    await expect(gst).toHaveText(/of which\s*GST/);
    expect(await readMoneyRow(gst)).toBeGreaterThan(0);
  });

  await test.step('negative — an expired coupon is refused in the server’s own words', async () => {
    await page.locator('#checkout-coupon').fill('EXPIRED5');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'This coupon has expired' }),
    ).toBeVisible();
  });

  let couponApplied = false;

  await test.step('WELCOME10', async () => {
    await page.locator('#checkout-coupon').fill('WELCOME10');
    await page.getByRole('button', { name: 'Apply' }).click();

    const applied = page.getByText(/WELCOME10\s+applied/);
    const alreadyUsed = page
      .getByRole('alert')
      .filter({ hasText: 'You have already used this coupon' });

    await expect(applied.or(alreadyUsed).first()).toBeVisible({ timeout: 30_000 });
    couponApplied = (await applied.count()) > 0;

    if (couponApplied) {
      // The quote re-prices; the discount becomes its own line, never merged
      // with the loyalty burn (P5a decision 23).
      await expect(moneyRow(summary, /^Coupon /)).toBeVisible({ timeout: 30_000 });
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'WELCOME10 was already spent by this customer (per_customer_limit: 1) — the server ' +
          'rejection was asserted instead. A fresh demo seed takes the applied branch.',
      });
    }
  });

  let redeemedPoints = 0;

  await test.step('redeem loyalty points', async () => {
    const slider = page.locator('#checkout-redeem');
    if ((await slider.count()) === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'No redeemable points on this order — the loyalty leg was skipped.',
      });
      return;
    }
    const max = Number((await slider.getAttribute('max')) ?? '0');
    expect(max).toBeGreaterThan(0);
    // A small, fixed burn: the balance is finite and every run spends it.
    redeemedPoints = Math.min(20, max);

    const requoted = page.waitForResponse(
      (r) => r.url().includes('/customer/checkout/quote') && r.request().method() === 'POST',
    );
    // React listens to the *native* setter, so a plain `.value =` is invisible to it.
    await slider.evaluate((element, value) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, redeemedPoints);
    await requoted;

    const loyaltyRow = moneyRow(summary, 'Loyalty points');
    await expect(loyaltyRow).toBeVisible({ timeout: 30_000 });
    await expect(loyaltyRow).toContainText(`${redeemedPoints} points redeemed`);
  });

  let renderedTotal = 0;

  await test.step('the totals add up: total = subtotal − discount − redeem + shipping', async () => {
    const subtotal = await readMoneyRow(moneyRow(summary, 'Subtotal (incl. GST)').first());
    const coupon = await readMoneyRowIfPresent(moneyRow(summary, /^Coupon /));
    const loyalty = await readMoneyRowIfPresent(moneyRow(summary, 'Loyalty points'));
    const shipping = await readMoneyRowIfPresent(moneyRow(summary, 'Shipping'));
    renderedTotal = await readMoneyRow(
      summary.locator('[data-slot="money-line"][data-variant="total"]'),
    );

    // `coupon` and `loyalty` render as negative amounts, so they add.
    const expected = subtotal + coupon + loyalty + shipping;
    expect(
      Math.abs(renderedTotal - expected),
      `total ${renderedTotal} != subtotal ${subtotal} + coupon ${coupon} + loyalty ${loyalty} + shipping ${shipping}`,
    ).toBeLessThan(0.01);

    if (couponApplied) expect(coupon).toBeLessThan(0);
    if (redeemedPoints > 0) expect(loyalty).toBeLessThan(0);
  });

  const idsBefore = new Set(
    ((await (await api.get('/customer/orders')).json()) as Array<{ id: string }>).map((o) => o.id),
  );

  let razorpayOrderId = '';
  let amountPaise = 0;

  await test.step('pay — a Razorpay order is opened, and the stub is handed it', async () => {
    const created = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' && /\/customer\/orders$/.test(new URL(r.url()).pathname),
    );
    await summary.getByRole('button', { name: /^Pay ₹/ }).click();

    const response = await created;
    expect(response.status(), await response.text()).toBe(201);
    const body = (await response.json()) as {
      razorpay_order_id: string;
      amount: number;
      currency: string;
      key_id: string | null;
    };

    razorpayOrderId = body.razorpay_order_id;
    amountPaise = body.amount;
    expect(razorpayOrderId).toMatch(/^order_/);
    expect(body.currency).toBe('INR');
    // The server charged exactly what the screen promised.
    expect(amountPaise).toBe(Math.round(renderedTotal * 100));

    await expect
      .poll(async () => (await razorpayStubState(page)).opens, { timeout: 30_000 })
      .toBeGreaterThan(0);
    const stub = await razorpayStubState(page);
    expect(stub.constructed.at(-1)?.order_id).toBe(razorpayOrderId);
    expect(stub.boundEvents).toContain('payment.failed');
  });

  let orderId = '';

  await test.step('a signed payment.captured confirms the order', async () => {
    const result = await sendPaymentCaptured({
      razorpayOrderId,
      amountPaise,
      customerId: session.customerId,
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.status).toBe('ok');

    await expect
      .poll(
        async () => {
          const orders = (await (await api.get('/customer/orders')).json()) as Array<{
            id: string;
          }>;
          const fresh = orders.find((o) => !idsBefore.has(o.id));
          if (fresh) orderId = fresh.id;
          return Boolean(fresh);
        },
        { timeout: 30_000, message: 'the webhook did not produce a new order' },
      )
      .toBe(true);
  });

  await test.step('/orders/[id]/track renders the confirmed order', async () => {
    const detail = await api.get(`/customer/orders/${orderId}`);
    expect(detail.ok()).toBeTruthy();
    const order = (await detail.json()) as {
      order_number: number;
      status: string;
      total: number;
      items: Array<{ fulfilment: string }>;
    };
    expect(order.status).toBe('placed');
    expect(Math.abs(order.total - renderedTotal)).toBeLessThan(0.01);
    expect([...new Set(order.items.map((i) => i.fulfilment))].sort()).toEqual(
      [...expected].sort(),
    );

    await page.goto(`/orders/${orderId}/track?placed=1`);
    await expect(
      page.getByRole('heading', { level: 1, name: `Order #${order.order_number}` }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Placed', { exact: true }).first()).toBeVisible();
  });
});

test('negative — a line the server will not sell blocks checkout', async ({
  page,
  context,
  baseURL,
}) => {
  await applyCustomerSession(context, session, baseURL ?? 'http://localhost:3000');
  await emptyBothCarts(page, api);

  const products = await catalogProducts(api);
  const good = await pickSellable(api, products, 'shipped');
  const seed = {
    productId: good.id,
    variantId: good.variants.find((v) => v.is_default)?.id ?? good.variants[0]?.id ?? null,
    name: good.name,
    unitPrice: good.base_price,
    /** A well-formed uuid that resolves to no product — `No longer available`. */
    ghostId: '00000000-0000-4000-8000-0000000000ff',
  };

  /**
   * `CartPricingService` answers `No longer available` for the ghost line,
   * `POST /customer/cart/sync` marks it `available: false`, and `/cart` refuses
   * to hand it to the quote — which is exactly the gate being proved. Seeding it
   * through `localStorage` is how the store itself rehydrates
   * (`CART_STORAGE_KEY`, version 3), so no private API is reached into.
   */
  await page.evaluate((line) => {
    window.localStorage.setItem(
      'cart-storage',
      JSON.stringify({
        state: {
          items: [
            {
              productId: line.productId,
              variantId: line.variantId,
              variantName: null,
              name: line.name,
              quantity: 1,
              unitPrice: line.unitPrice,
              imageUrl: null,
              fulfilment: 'shipped',
            },
            {
              productId: line.ghostId,
              variantId: null,
              variantName: null,
              name: 'A product that no longer exists',
              quantity: 1,
              unitPrice: 100,
              imageUrl: null,
              fulfilment: null,
            },
          ],
          channel: 'delivery',
          deliveryAddressId: null,
        },
        version: 3,
      }),
    );
  }, seed);

  await page.goto('/cart');

  const rejected = page.locator('[data-slot="rejected-lines"]');
  await expect(rejected).toBeVisible({ timeout: 60_000 });
  await expect(rejected.getByRole('heading', { name: 'One item is unavailable' })).toBeVisible();
  await expect(rejected).toContainText('No longer available');

  const cart = page.locator('[data-slot="cart-summary"]');
  // A disabled *link* would still navigate, so the blocked state is a real
  // `<button disabled>` and the `/checkout` anchor is gone entirely.
  await expect(cart.locator('a[href="/checkout"]')).toHaveCount(0);
  await expect(cart.getByRole('button', { name: 'Continue to checkout' })).toBeDisabled();
  await expect(cart.getByText('One item is unavailable. Remove it to continue.')).toBeVisible();

  // Leave nothing behind for the next run.
  await emptyBothCarts(page, api);
});

test('the storefront reads at a phone width @mobile', async ({ page }) => {
  // Read-only by construction — the money path must run exactly once per suite,
  // so the mobile project asserts rendering and reachability, not purchase.
  await page.goto('/shop');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const chips = page.locator('nav[aria-label="Filter products"]');
  await expect(chips).toBeVisible();
  await chips.getByRole('link', { name: 'Merchandise', exact: true }).click();
  await expect(page).toHaveURL(/[?&]type=merchandise/);

  // Navigated rather than clicked: at this width the shelf sits under a
  // scrollable chip row and a slide-over nav, and a "click the first card" step
  // would be asserting the overlay stack, not the page.
  const products = await catalogProducts(api);
  const product = products.find((p) => p.type === 'merchandise') ?? products[0];
  await page.goto(`/p/${product.slug}`);

  await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();
  await expect(page.locator('[data-slot="add-to-cart-panel"]')).toBeVisible();
  await expect(page.locator('[data-slot="availability-note"]')).toBeVisible();
  await expect(page.locator('button[aria-label^="Cart,"]').first()).toBeAttached();

  // The page must not scroll sideways at 393 px — the one responsive failure
  // that makes a storefront unusable on a phone.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
