import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { request, type APIRequestContext, type BrowserContext } from '@playwright/test';

/**
 * A real customer session, obtained the way a customer obtains one.
 *
 * ## No fixture user is invented
 *
 * There is no password to seed and no back door to open: `POST
 * /customer-auth/send-otp` → the OTP → `POST /customer-auth/verify-otp` is the
 * only way into a customer session, and this fixture walks it. The OTP itself is
 * read from the **backend's own stdout**: `WhatsAppService` logs
 * `OTP for <phone>: <code>` (with a `[DEV]`/`[OTP fallback…]` prefix) whenever WhatsApp is unconfigured, which is
 * the case on every developer machine and on CI. So the backend must be started
 * with its output redirected to a file and `E2E_BACKEND_LOG` pointed at it —
 * `e2e/README.md` and the `frontend-e2e` CI job both do exactly that.
 *
 * ## Why the session is cached
 *
 * `send-otp` is throttled to **three requests per hour**
 * (`customer-auth.controller.ts`). A suite that logged in from scratch on every
 * local run would lock itself out on the fourth. The verified token is good for
 * 30 days, so it is written to a file under `node_modules/.cache` (already
 * ignored by git, and untouched by `next build`) and reused while
 * `GET /customer-auth/profile` still accepts it. CI starts with no cache and
 * therefore always exercises the full OTP path once.
 */

/** The backend, as the *tests* reach it. Must match the app's `NEXT_PUBLIC_API_URL`. */
export const API_BASE_URL =
  process.env.E2E_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * The demo customer seeded by `prisma/seed-demo.ts` — 620 loyalty points and a
 * default `600096` address, which is what makes the loyalty and delivery legs of
 * the smoke walkable at all.
 */
export const CUSTOMER_PHONE = process.env.E2E_CUSTOMER_PHONE ?? '9900000001';

/** Where the backend's stdout was redirected. Required for a cold login. */
const BACKEND_LOG = process.env.E2E_BACKEND_LOG ?? '';

const SESSION_FILE =
  process.env.E2E_SESSION_FILE ??
  path.join(process.cwd(), 'node_modules', '.cache', 'konma-e2e', 'customer-session.json');

export interface CustomerSession {
  /** The raw JWT the backend put in the `customer_token` cookie. */
  token: string;
  customerId: string;
  phone: string;
  name: string | null;
}

interface VerifyOtpResponse {
  customer: { id: string; phone: string; name: string | null; email: string | null };
  isNewCustomer: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The last OTP line written **after** `fromByte`.
 *
 * The offset matters: the log is append-only across runs, so without it the
 * first read would happily return an hour-old code and `verify-otp` would answer
 * `400`. The Nest logger wraps the line in ANSI colour codes, which the pattern
 * simply steps over.
 */
export async function readDevOtp(
  phone: string,
  fromByte: number,
  timeoutMs = 20_000,
): Promise<string> {
  if (!BACKEND_LOG) {
    throw new Error(
      'E2E_BACKEND_LOG is not set. Start the backend with its stdout redirected to a file ' +
        'and point E2E_BACKEND_LOG at it — see frontend/e2e/README.md.',
    );
  }
  const pattern = new RegExp(`OTP for ${phone}:\\s*(\\d{4,8})`, 'g');
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (existsSync(BACKEND_LOG)) {
      const text = (await readFile(BACKEND_LOG, 'utf8')).slice(fromByte);
      let last: string | null = null;
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) last = match[1];
      if (last) return last;
    }
    await sleep(250);
  }
  throw new Error(
    `No "OTP for ${phone}" line appeared in ${BACKEND_LOG} within ${timeoutMs} ms. ` +
      'Is the backend running, and is WhatsApp genuinely unconfigured?',
  );
}

/** Current size of the backend log, so `readDevOtp` can ignore everything before it. */
async function backendLogSize(): Promise<number> {
  if (!BACKEND_LOG || !existsSync(BACKEND_LOG)) return 0;
  return (await stat(BACKEND_LOG)).size;
}

/** `Set-Cookie: customer_token=…` → just the value. */
function extractCustomerToken(headers: Array<{ name: string; value: string }>): string | null {
  for (const header of headers) {
    if (header.name.toLowerCase() !== 'set-cookie') continue;
    for (const cookie of header.value.split('\n')) {
      const match = /(?:^|;\s*)customer_token=([^;]+)/.exec(cookie);
      if (match) return match[1];
    }
  }
  return null;
}

async function readCachedSession(): Promise<CustomerSession | null> {
  try {
    const raw = await readFile(SESSION_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CustomerSession>;
    if (!parsed.token || !parsed.customerId) return null;
    if (parsed.phone !== CUSTOMER_PHONE) return null;
    return parsed as CustomerSession;
  } catch {
    return null;
  }
}

async function writeCachedSession(session: CustomerSession): Promise<void> {
  await mkdir(path.dirname(SESSION_FILE), { recursive: true });
  await writeFile(SESSION_FILE, JSON.stringify(session, null, 2), 'utf8');
}

/** `true` while the backend still accepts this token. */
async function tokenStillValid(api: APIRequestContext, token: string): Promise<boolean> {
  const response = await api.get('/customer-auth/profile', {
    headers: { cookie: `customer_token=${token}` },
  });
  return response.ok();
}

/**
 * A signed-in customer, from cache when possible and from the real OTP flow
 * when not.
 *
 * The caller owns the returned {@link APIRequestContext}-free session object;
 * {@link customerApi} turns it into an authenticated API client and
 * {@link applyCustomerSession} into a browser cookie.
 */
export async function loginCustomer(): Promise<CustomerSession> {
  const api = await request.newContext({ baseURL: API_BASE_URL });
  try {
    const cached = await readCachedSession();
    if (cached && (await tokenStillValid(api, cached.token))) return cached;

    const offset = await backendLogSize();
    const sent = await api.post('/customer-auth/send-otp', {
      data: { phone: CUSTOMER_PHONE },
    });
    if (!sent.ok()) {
      throw new Error(
        `POST /customer-auth/send-otp answered ${sent.status()}: ${await sent.text()}. ` +
          '(Three sends per hour — a cached session normally spares you this.)',
      );
    }

    const otp = await readDevOtp(CUSTOMER_PHONE, offset);

    const verified = await api.post('/customer-auth/verify-otp', {
      data: { phone: CUSTOMER_PHONE, otp },
    });
    if (!verified.ok()) {
      throw new Error(
        `POST /customer-auth/verify-otp answered ${verified.status()}: ${await verified.text()}`,
      );
    }

    const token = extractCustomerToken(await verified.headersArray());
    if (!token) throw new Error('verify-otp did not set a customer_token cookie');

    const body = (await verified.json()) as VerifyOtpResponse;
    const session: CustomerSession = {
      token,
      customerId: body.customer.id,
      phone: body.customer.phone,
      name: body.customer.name,
    };
    await writeCachedSession(session);
    return session;
  } finally {
    await api.dispose();
  }
}

/**
 * The session as a browser cookie.
 *
 * `customer_token` is `HttpOnly`, so the app can only ever see it this way —
 * and because cookies ignore ports, one `localhost` cookie serves both the page
 * on `:3000` and the API on `:4000`.
 */
export async function applyCustomerSession(
  context: BrowserContext,
  session: CustomerSession,
  baseURL: string,
): Promise<void> {
  const { hostname } = new URL(baseURL);
  await context.addCookies([
    {
      name: 'customer_token',
      value: session.token,
      domain: hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/** An API client that talks to the backend as this customer. */
export async function customerApi(session: CustomerSession): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { cookie: `customer_token=${session.token}` },
  });
}
