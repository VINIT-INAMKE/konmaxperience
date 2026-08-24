import { defineConfig, devices } from '@playwright/test';

/**
 * The end-to-end harness (`QA-06`).
 *
 * ## What this config assumes, and what it starts itself
 *
 * `webServer` starts **only the frontend**, because that is the only process
 * this package owns. The backend, Postgres and Redis are the caller's job — the
 * fixtures need the backend's stdout to read the `[DEV] OTP …` line the OTP
 * login depends on, and a `webServer` entry cannot hand a log file back to a
 * test. `e2e/README.md` documents the two commands that bring the rest up, and
 * `.github/workflows/ci.yml`'s `frontend-e2e` job runs exactly those.
 *
 * `npm run build && npm run start` rather than `next dev`: the storefront is a
 * mix of server and client components whose caching, streaming and
 * `revalidate` windows only behave like production in a production build. A
 * smoke that passes against `next dev` proves less than one that passes here.
 *
 * ## Two projects, one purchase
 *
 * The money path is destructive — it confirms a real order, burns a coupon
 * redemption and turns an experience hold into a confirmed booking. Running it
 * once per viewport would buy twice, so `desktop` runs everything and `mobile`
 * runs only the tests tagged `@mobile`, which are read-only. Both are Chromium:
 * SPEC §10 asks for the walk-through at desktop *and* mobile widths, not for
 * cross-engine coverage.
 *
 * `workers: 1` for the same reason — every test in the file shares one
 * customer, one server-side cart and one Redis quote namespace.
 */

/** Where the storefront under test lives. Overridden locally to dodge a busy 3000. */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

const PORT = Number(new URL(BASE_URL).port || '3000');

export default defineConfig({
  testDir: './e2e',
  // The purchase walks a real payment path; a shared cart cannot be parallelised.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A quote holds for 15 minutes and a production build is cold on first hit.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'desktop',
      // The `@mobile` checks assert the small-screen chrome (the chip row rather
      // than the sidebar), which does not exist at 1440.
      grepInvert: /@mobile/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // SPEC §10's mobile half of the walk-through. Read-only by construction —
      // see the header.
      name: 'mobile',
      grep: /@mobile/,
      use: { ...devices['Pixel 5'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // A cold Next build on a CI runner is minutes, not seconds.
    timeout: 600_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PORT: String(PORT),
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
