import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  expect,
  request,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';

/**
 * A real staff session, obtained the way a staff member obtains one.
 *
 * ## Why this looks nothing like `fixtures/customer.ts`
 *
 * A customer proves who they are with an OTP the backend prints to its own
 * stdout, so `customer.ts` can read the code out of a log file and there is no
 * password anywhere. Staff log in with **email and password** against
 * `POST /auth/login`, and `prisma/seed-demo.ts` generates those passwords with
 * `randomBytes(24)`, prints them **once**, and never stores them (`seed-demo.ts`
 * lines 68-95). There is no log line to scrape and no back door to open: a
 * password this suite did not witness being issued cannot be recovered.
 *
 * So the password has to be *told* to the suite. {@link resolveStaffPassword}
 * looks in three places, in order:
 *
 *  1. `E2E_STAFF_PASSWORD_<ROLE_CODE>` — one role, explicitly.
 *  2. `E2E_STAFF_PASSWORDS` — several, as `ROLE=secret` or `email=secret` pairs
 *     separated by newlines, commas or semicolons.
 *  3. the demo table in `.planning/phases/31-p3-mission-bridge/31-01-SUMMARY.md`
 *     §6, parsed at run time. Those eight passwords were rotated by hand against
 *     the local `konma` database, which is what makes a developer machine work
 *     with no configuration at all.
 *
 * They are read from that file rather than copied into this one deliberately:
 * the repository should hold exactly one plaintext copy of a demo credential,
 * and it already holds that one.
 *
 * ## When the passwords do not fit the database
 *
 * Source 3 is database-specific. A database seeded independently — CI seeds a
 * fresh one for every job — has eight *different* random passwords, and the
 * demo table will simply 401. That is not a product failure and must not be
 * reported as one, so {@link loginStaff} raises
 * {@link StaffCredentialsUnavailable} and the spec skips with the reason on the
 * report. A password that came from **the environment** is treated as a
 * deliberate configuration and a 401 on it is fatal, because then something
 * really is wrong.
 *
 * ## Why the token is cached
 *
 * `POST /auth/login` is throttled to **five requests per five minutes**, keyed
 * per IP for an anonymous caller (`auth.controller.ts:41`,
 * `common/guards/user-aware-throttler.guard.ts`). This smoke needs two roles,
 * and a re-run four minutes later would need two more. The access token is good
 * for fifteen minutes, so it is written under `node_modules/.cache` (already
 * ignored by git, and untouched by `next build`) and reused while
 * `GET /auth/me` still accepts it. Delete the directory to force the full login
 * — including the sign-in **form**, which {@link signInThroughTheForm} only
 * walks when the cache is cold.
 */

/** The backend, as the *tests* reach it. Must match the app's `NEXT_PUBLIC_API_URL`. */
export const API_BASE_URL =
  process.env.E2E_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * The two actors this smoke needs, and why each one is the role it is.
 *
 * The **author** ought to be an ordinary lead — SPEC §0's loop is about the
 * person who did the work turning it into proof. It is the founder instead
 * because of a live defect: `GET /tasks/:id` (`TasksService.findOne`) does not
 * return `is_own`, and `app/(ops)/tasks/[id]/page.tsx` computes
 * `canEdit = task?.is_own === true || isAdmin`. So a task's own owner opens
 * their own task page and is told *"Read-only -- this task belongs to
 * <themselves>"*: no status control, no evidence upload. Only a `FOUNDER_ADMIN`
 * can drive the task page today. `e2e/README.md` records it; when `findOne`
 * starts projecting `is_own`, `author` can move back to a `_LEAD` and
 * {@link STAFF.approver} to whichever lead the task's domain maps to.
 */
export const STAFF = {
  /**
   * Does the work. Also the one who signs in at the real form.
   *
   * That the founder holds every permission in the system and *still* is not
   * offered an approve control over evidence she wrote herself is what makes
   * the self-approval negative a statement about authorship rather than about a
   * missing grant.
   */
  author: { roleCode: 'FOUNDER_ADMIN', roleName: 'Founder/Admin', email: 'admin@konma.store' },
  /**
   * Signs it off, and stands up the fixture over the API (`TECH_LEAD` is seeded
   * with `Object.values(Permission)`, so it can create the mission and the task).
   *
   * A task in the `tech` domain has no `(scope: task, domain: tech)` policy, so
   * the node's default `(task, null)` row applies and its empty
   * `required_role_codes` is expanded by `DOMAIN_LEAD_ROLE.tech` to exactly one
   * `TECH_LEAD` approval. One approver, one session. `food` would materialise
   * two and cost a third.
   */
  approver: { roleCode: 'TECH_LEAD', roleName: 'Tech Lead', email: 'vinit@konma.store' },
} as const;

export type StaffRole = (typeof STAFF)[keyof typeof STAFF];

export interface StaffSession {
  /** The raw JWT the backend put in the `access_token` cookie. */
  token: string;
  userId: string;
  email: string;
  name: string;
  roleCode: string;
}

/**
 * Raised when no password this suite can find authenticates as a role — the
 * expected outcome on a database whose `seed:demo` passwords were never
 * captured. The spec turns it into a skip with this message attached.
 */
export class StaffCredentialsUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffCredentialsUnavailable';
  }
}

const SESSION_DIR =
  process.env.E2E_STAFF_SESSION_DIR ??
  path.join(process.cwd(), 'node_modules', '.cache', 'konma-e2e');

/** The P3 record that carries the demo table. Relative to `frontend/`. */
const DEMO_CREDENTIALS_FILE = path.join(
  process.cwd(),
  '..',
  '.planning',
  'phases',
  '31-p3-mission-bridge',
  '31-01-SUMMARY.md',
);

// ─── password resolution ────────────────────────────────────────────────────

/** `ROLE=secret, other@konma.store=secret` → a lookup keyed by both. */
function parsePairs(raw: string): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const entry of raw.split(/[\n,;]+/)) {
    const separator = entry.indexOf('=');
    if (separator <= 0) continue;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (key && value) pairs.set(key.toLowerCase(), value);
  }
  return pairs;
}

let demoTable: Map<string, string> | null = null;

/**
 * The §6 table of `31-01-SUMMARY.md`, as `ROLE → password` and
 * `email → password`. Rows look like:
 *
 * ```
 * | FOUNDER_ADMIN | admin@konma.store | `Br-Oym06xPq8vaHLFSy0h3fE` |
 * ```
 *
 * Anything that does not match that shape — prose, the other tables in the file
 * — is skipped, so the parse cannot pick up a false positive.
 */
function readDemoTable(): Map<string, string> {
  if (demoTable) return demoTable;
  const table = new Map<string, string>();
  try {
    if (existsSync(DEMO_CREDENTIALS_FILE)) {
      const text = readFileSync(DEMO_CREDENTIALS_FILE, 'utf8');
      const row = /^\|\s*([A-Z][A-Z_]+)\s*\|\s*(\S+@\S+?)\s*\|\s*`([^`]+)`\s*\|/gm;
      for (const match of text.matchAll(row)) {
        table.set(match[1].toLowerCase(), match[3]);
        table.set(match[2].toLowerCase(), match[3]);
      }
    }
  } catch {
    // A missing or unreadable record is not an error — it just means the only
    // remaining source is the environment.
  }
  demoTable = table;
  return table;
}

export interface ResolvedPassword {
  password: string;
  /** `env` is a deliberate configuration; `demo` is a best guess at the seed. */
  source: 'env' | 'demo';
}

export function resolveStaffPassword(role: StaffRole): ResolvedPassword | null {
  const direct = process.env[`E2E_STAFF_PASSWORD_${role.roleCode}`];
  if (direct) return { password: direct, source: 'env' };

  const bundle = process.env.E2E_STAFF_PASSWORDS;
  if (bundle) {
    const pairs = parsePairs(bundle);
    const hit = pairs.get(role.roleCode.toLowerCase()) ?? pairs.get(role.email.toLowerCase());
    if (hit) return { password: hit, source: 'env' };
  }

  const demo = readDemoTable();
  const seeded = demo.get(role.roleCode.toLowerCase()) ?? demo.get(role.email.toLowerCase());
  return seeded ? { password: seeded, source: 'demo' } : null;
}

/** The message the spec shows when it has to skip. Names the exact fix. */
export function credentialsHelp(role: StaffRole): string {
  return (
    `No password authenticates ${role.email} (${role.roleCode}) against ${API_BASE_URL}. ` +
    'Staff passwords are generated by `prisma/seed-demo.ts` and printed to its stdout once, ' +
    'so a database this suite did not watch being seeded cannot be logged into. Capture them ' +
    `from the seed output and set E2E_STAFF_PASSWORD_${role.roleCode}=… (or E2E_STAFF_PASSWORDS=` +
    `"${role.roleCode}=…"). See frontend/e2e/README.md.`
  );
}

// ─── the session cache ──────────────────────────────────────────────────────

function sessionFile(role: StaffRole): string {
  return path.join(SESSION_DIR, `staff-${role.roleCode.toLowerCase()}.json`);
}

async function readCachedSession(role: StaffRole): Promise<StaffSession | null> {
  try {
    const parsed = JSON.parse(await readFile(sessionFile(role), 'utf8')) as Partial<StaffSession>;
    if (!parsed.token || !parsed.userId) return null;
    if (parsed.email !== role.email) return null;
    return parsed as StaffSession;
  } catch {
    return null;
  }
}

async function writeCachedSession(role: StaffRole, session: StaffSession): Promise<void> {
  await mkdir(SESSION_DIR, { recursive: true });
  await writeFile(sessionFile(role), JSON.stringify(session, null, 2), 'utf8');
}

interface MeResponse {
  id: string;
  name: string;
  email: string;
  roleCode: string;
}

/** `true` while the backend still accepts this token. */
async function tokenStillValid(api: APIRequestContext, token: string): Promise<boolean> {
  const response = await api.get('/auth/me', {
    headers: { authorization: `Bearer ${token}` },
  });
  return response.ok();
}

/** `Set-Cookie: access_token=…` → just the value. */
function extractAccessToken(headers: Array<{ name: string; value: string }>): string | null {
  for (const header of headers) {
    if (header.name.toLowerCase() !== 'set-cookie') continue;
    for (const cookie of header.value.split('\n')) {
      const match = /(?:^|;\s*)access_token=([^;]+)/.exec(cookie);
      if (match) return match[1];
    }
  }
  return null;
}

interface LoginResponse {
  user: { id: string; name: string; email: string; roleCode: string };
}

/**
 * A signed-in staff member, from cache when possible and from a real
 * `POST /auth/login` when not.
 *
 * @throws {StaffCredentialsUnavailable} when no password is known, or when the
 * only password available came from the demo record and this database does not
 * accept it.
 */
export async function loginStaff(role: StaffRole): Promise<StaffSession> {
  const api = await request.newContext({ baseURL: API_BASE_URL });
  try {
    const cached = await readCachedSession(role);
    if (cached && (await tokenStillValid(api, cached.token))) return cached;

    const resolved = resolveStaffPassword(role);
    if (!resolved) throw new StaffCredentialsUnavailable(credentialsHelp(role));

    const response = await api.post('/auth/login', {
      data: { email: role.email, password: resolved.password },
    });

    if (response.status() === 401 && resolved.source === 'demo') {
      // The demo record's passwords belong to the database it was written
      // against. A different one is an ordinary state, not a defect.
      throw new StaffCredentialsUnavailable(credentialsHelp(role));
    }
    if (!response.ok()) {
      throw new Error(
        `POST /auth/login as ${role.email} answered ${response.status()}: ${await response.text()}` +
          (response.status() === 429
            ? ' (five logins per five minutes per IP — the cache under node_modules/.cache normally spares you this.)'
            : ''),
      );
    }

    const token = extractAccessToken(await response.headersArray());
    if (!token) throw new Error('POST /auth/login did not set an access_token cookie');

    const body = (await response.json()) as LoginResponse;
    const session: StaffSession = {
      token,
      userId: body.user.id,
      email: body.user.email,
      name: body.user.name,
      roleCode: body.user.roleCode,
    };
    await writeCachedSession(role, session);
    return session;
  } finally {
    await api.dispose();
  }
}

// ─── carrying the session ───────────────────────────────────────────────────

/**
 * The session as a browser cookie.
 *
 * `access_token` is `HttpOnly`, so the app can only ever see it this way — and
 * because cookies ignore ports, one `localhost` cookie serves the page on
 * `:3000`, the API on `:4000` **and** `proxy.ts`, which verifies the same JWT on
 * the Next.js edge before it will render an ops route at all.
 */
export async function applyStaffSession(
  context: BrowserContext,
  session: StaffSession,
  baseURL: string,
): Promise<void> {
  const { hostname } = new URL(baseURL);
  await context.addCookies([
    {
      name: 'access_token',
      value: session.token,
      domain: hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/** An API client that talks to the backend as this staff member. */
export async function staffApi(session: StaffSession): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { authorization: `Bearer ${session.token}` },
  });
}

/**
 * The sign-in **form**, walked for real, and the cookie it leaves behind cached
 * for the next run.
 *
 * `proxy.ts` rewrites a logged-out ops route onto the login page while keeping
 * the URL — `/tasks` becomes `/team?redirect=%2Ftasks` — so arriving at the form
 * by asking for `/tasks` is both the shortest route to it and a check that the
 * gate in front of the ops shell is closed.
 */
export async function signInThroughTheForm(
  page: Page,
  role: StaffRole,
  landingPath = '/tasks',
): Promise<void> {
  const resolved = resolveStaffPassword(role);
  if (!resolved) throw new StaffCredentialsUnavailable(credentialsHelp(role));

  await page.goto(landingPath);
  await expect(page).toHaveURL(`/team?redirect=${encodeURIComponent(landingPath)}`);
  await expect(page.getByRole('heading', { name: 'Team Login' })).toBeVisible({ timeout: 60_000 });

  // By id, not by label: the password field shares its accessible name with the
  // "Show password" toggle sitting inside it.
  await page.locator('#email').fill(role.email);
  await page.locator('#password').fill(resolved.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The form answers a bad password with a `role="alert"` banner and stays put,
  // so without this the failure would surface as an unexplained URL timeout.
  await page
    .waitForURL((url) => url.pathname === landingPath, { timeout: 30_000 })
    .catch(async () => {
      const alert = page.getByRole('alert');
      const detail = (await alert.count()) ? (await alert.first().innerText()).trim() : '';
      throw new Error(
        `The sign-in form did not let ${role.email} through to ${landingPath}` +
          (detail ? `: "${detail}". ` : '. ') +
          credentialsHelp(role),
      );
    });

  // Cache what the form just earned, so the next run spends no login budget.
  const cookie = (await page.context().cookies()).find((c) => c.name === 'access_token');
  if (cookie) {
    const api = await request.newContext({ baseURL: API_BASE_URL });
    try {
      const me = await api.get('/auth/me', {
        headers: { authorization: `Bearer ${cookie.value}` },
      });
      if (me.ok()) {
        const profile = (await me.json()) as MeResponse;
        await writeCachedSession(role, {
          token: cookie.value,
          userId: profile.id,
          email: profile.email,
          name: profile.name,
          roleCode: profile.roleCode,
        });
      }
    } finally {
      await api.dispose();
    }
  }
}
