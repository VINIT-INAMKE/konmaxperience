import type { Page } from '@playwright/test';

/**
 * A `checkout.razorpay.com` that never leaves the machine.
 *
 * `useRazorpay` injects `<script src="https://checkout.razorpay.com/v1/checkout.js">`
 * and then constructs `new window.Razorpay(options)`. This route serves a stub
 * for that script, so **CI needs no network** for the payment leg and the suite
 * cannot be broken by a third party's uptime.
 *
 * ## The stub deliberately does not pay
 *
 * `open()` records that it was called and stops. It never invokes the `handler`
 * callback, because doing so would send `POST /customer/orders/confirm` a
 * `razorpay_signature` the stub cannot compute — the backend verifies it with
 * the real key secret and would answer `400`. The smoke instead confirms the
 * order the way Razorpay's own servers do it, through a signed
 * `payment.captured` webhook (see `webhook.ts`), which is the path P5a §5c
 * recorded and the one that is actually worth proving.
 *
 * What the stub *does* prove is that the storefront handed Razorpay the order
 * the backend just opened: {@link razorpayStubState} returns the constructor
 * options, `order_id` included.
 */

export interface RazorpayStubOptions {
  key?: string;
  order_id?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
}

export interface RazorpayStubState {
  /** Every options object the page constructed a `Razorpay` with. */
  constructed: RazorpayStubOptions[];
  /** How many times `open()` was called. */
  opens: number;
  /** Events the page bound with `on()` — `payment.failed` in practice. */
  boundEvents: string[];
}

/** The global the stub script writes to, and the test reads. */
const STUB_GLOBAL = '__konmaRazorpayStub';

const STUB_SCRIPT = `
(function () {
  var stub = window.${STUB_GLOBAL} || { constructed: [], opens: 0, boundEvents: [] };
  window.${STUB_GLOBAL} = stub;

  function Razorpay(options) {
    if (!(this instanceof Razorpay)) return new Razorpay(options);
    this.options = options || {};
    stub.constructed.push(JSON.parse(JSON.stringify({
      key: this.options.key,
      order_id: this.options.order_id,
      name: this.options.name,
      description: this.options.description,
      prefill: this.options.prefill,
    })));
  }

  Razorpay.prototype.open = function () {
    stub.opens += 1;
    // Deliberately inert — the smoke confirms through a signed webhook instead.
  };

  Razorpay.prototype.on = function (event, handler) {
    stub.boundEvents.push(String(event));
    this['on_' + event] = handler;
  };

  Razorpay.prototype.close = function () {
    var modal = this.options && this.options.modal;
    if (modal && typeof modal.ondismiss === 'function') modal.ondismiss();
  };

  window.Razorpay = Razorpay;
})();
`;

/**
 * Intercept the checkout script for this page. Call it **before** the page
 * navigates anywhere that might load it.
 */
export async function installRazorpayStub(page: Page): Promise<void> {
  await page.route('https://checkout.razorpay.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: STUB_SCRIPT,
    });
  });
}

/** What the page did with the stub. `opens > 0` means the modal was opened. */
export async function razorpayStubState(page: Page): Promise<RazorpayStubState> {
  return page.evaluate((globalName) => {
    const stub = (window as unknown as Record<string, unknown>)[globalName] as
      | RazorpayStubState
      | undefined;
    return stub ?? { constructed: [], opens: 0, boundEvents: [] };
  }, STUB_GLOBAL);
}
