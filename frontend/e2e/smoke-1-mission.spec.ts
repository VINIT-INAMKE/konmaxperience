import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import {
  API_BASE_URL,
  applyStaffSession,
  loginStaff,
  signInThroughTheForm,
  STAFF,
  StaffCredentialsUnavailable,
  staffApi,
  type StaffSession,
} from './fixtures/staff';

/**
 * **Smoke 1 — the mission flow** (`QA-03`).
 *
 * SPEC §0's loop, walked end to end through the ops shell by two people:
 * *I do the real work → the work itself becomes the proof → someone with skin in
 * the game signs it off → a meter I care about moves.*
 *
 * One person signs in at the real form, finds her task on `/tasks`, marks it
 * done, attaches link evidence — and is offered no way to approve it, because
 * she wrote it. A second person reads the pending approval off `/approvals`,
 * approves the **evidence**, and the task is *still not valid*; only when the
 * **policy approval** is decided too does the task turn valid and the readiness
 * meter it feeds move by exactly the points the task was worth.
 *
 * ## Why two gates, asserted separately
 *
 * `EvidenceService.validateTask` requires all three of: `status === 'done'`, at
 * least one approved evidence row, and a satisfied approval policy. P3 decision 4
 * made the third gate real — `requires_approval: true` with an undecided
 * `Approval` row blocks validation where v1 treated it as satisfied. That is the
 * single most regressible behaviour in this flow, so the spec stops between the
 * two approvals and asserts, against the API, that the task has *not* validated
 * and the meter has *not* moved. A smoke that only checked the happy end would
 * pass with the gate removed.
 *
 * ## Why the fixture is created and not found
 *
 * Neither `seed:reference` nor `seed:demo` writes a single `Mission`, `Quest` or
 * `Task` — the seeds stop at users, meters, approval policies and the catalog.
 * There is nothing to complete, so the walk opens with `POST /missions` and
 * `POST /tasks` as the founder, which is also the only way to guarantee a task
 * wired to a **task-driven** meter. That choice matters: a `hybrid` meter blends
 * `task_value` with a derived formula 50/50 and would move by half the points,
 * and a `derived` meter discards `task_value` entirely and would not move at all.
 *
 * ## What re-running does to the database
 *
 * Every run adds a `TaskReadinessEvent` worth {@link READINESS_VALUE} to whichever
 * task-driven meter had the most headroom, and `task_value` clamps at 100. Five
 * runs exhaust one meter; there are six, so thirty runs exhaust them all. The
 * spec picks the emptiest meter each time, and `e2e/README.md` carries the SQL
 * that empties them again. On CI the database is fresh and every meter reads 0.
 */

test.describe.configure({ mode: 'serial' });

/** Points the task carries onto its meter. A task-driven meter moves 1:1 with it. */
const READINESS_VALUE = 20;

/** XP the task is worth once validated — asserted back as `valid_xp`. */
const TASK_XP = 50;

/**
 * `tech`, deliberately: it is the domain whose default policy resolves to the
 * one role {@link STAFF.approver} holds. See the note on `STAFF` for why the
 * pairing is what it is.
 */
const TASK_DOMAIN = 'tech';

// ─── the shapes this spec reads ─────────────────────────────────────────────

interface MeterRow {
  id: string;
  code: string;
  name: string;
  mode: 'task_driven' | 'derived' | 'hybrid';
  current_value: number;
  task_value: number;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  valid: boolean;
  valid_xp: number;
  verified: boolean;
  readiness_meter_id: string | null;
  readiness_value: number;
}

interface ApprovalRow {
  id: string;
  entity_type: string;
  entity_id: string;
  required_role_code: string;
  status: string;
}

interface UserRow {
  id: string;
  email: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readJson<T>(api: APIRequestContext, url: string, what: string): Promise<T> {
  const response = await api.get(url);
  expect(response.ok(), `${what} → ${response.status()} ${await response.text()}`).toBeTruthy();
  return (await response.json()) as T;
}

async function meters(api: APIRequestContext): Promise<MeterRow[]> {
  return readJson<MeterRow[]>(api, '/readiness-meters', 'GET /readiness-meters');
}

async function meterByCode(api: APIRequestContext, code: string): Promise<MeterRow> {
  const found = (await meters(api)).find((m) => m.code === code);
  expect(found, `no readiness meter with code ${code}`).toBeTruthy();
  return found as MeterRow;
}

async function fetchTask(api: APIRequestContext, id: string): Promise<TaskRow> {
  return readJson<TaskRow>(api, `/tasks/${id}`, `GET /tasks/${id}`);
}

/**
 * The `Approval` the policy materialised for this task.
 *
 * `GET /approvals` answers a bare array when neither `cursor` nor `limit` is
 * sent and an envelope when either is, so both shapes are accepted rather than
 * pinned to whichever one today's query happens to produce.
 */
async function taskApproval(api: APIRequestContext, taskId: string): Promise<ApprovalRow> {
  const body = await readJson<ApprovalRow[] | { items: ApprovalRow[] }>(
    api,
    '/approvals?mine=1&status=pending&entity_type=task',
    'GET /approvals',
  );
  const rows = Array.isArray(body) ? body : body.items;
  const found = rows.find((row) => row.entity_id === taskId);
  expect(
    found,
    'the (task, null) approval policy materialised no pending approval for this task — ' +
      'requires_approval was honoured but no row reached the approver',
  ).toBeTruthy();
  return found as ApprovalRow;
}

/** `"Villa Readiness: 40% ready"` → `40`. */
async function readMeterPercent(button: Locator): Promise<number> {
  const label = await button.getAttribute('aria-label');
  const match = /:\s*(\d+)%\s*ready$/.exec(label ?? '');
  expect(match, `not a meter button label: ${JSON.stringify(label)}`).toBeTruthy();
  return Number((match as RegExpExecArray)[1]);
}

/** The `Card` whose `h3` is exactly this heading. */
function card(page: Page, heading: string): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
}

/**
 * The evidence list row carrying this URL.
 *
 * `EvidenceItem` renders the URL as an `<a>` inside a flex row that also holds
 * the status badge and — for a reviewer who did not write it — the approve
 * control. The innermost `div` containing the URL text *is* that row, which is
 * what makes `Approve` addressable without colliding with the identically named
 * button in the "Waiting on your sign-off" section higher up the same card.
 */
function evidenceRow(evidenceCard: Locator, url: string): Locator {
  return evidenceCard.locator('div').filter({ hasText: url }).last();
}

/** The in-task approvals block — the second place an `Approve` button lives. */
function signOffSection(page: Page): Locator {
  return page.locator('section[aria-label="Approvals waiting on you"]');
}

// ─── the fixture this walk needs ────────────────────────────────────────────

let approver: StaffSession;
let approverApi: APIRequestContext;

/** Non-null when the suite could not get a session and has to stand down. */
let skipReason: string | null = null;

let meter: MeterRow;
let meterBefore: number;
let missionId = '';
let taskId = '';
let taskTitle = '';
let evidenceUrl = '';

test.beforeAll(async () => {
  const runId = Date.now().toString(36);
  taskTitle = `QA-03 mission smoke ${runId}`;
  evidenceUrl = `https://example.com/qa-03/${runId}`;

  try {
    approver = await loginStaff(STAFF.approver);
  } catch (error) {
    if (error instanceof StaffCredentialsUnavailable) {
      // A database whose `seed:demo` passwords were never captured. Not a
      // product failure — see fixtures/staff.ts.
      skipReason = error.message;
      return;
    }
    throw error;
  }

  approverApi = await staffApi(approver);

  const users = await readJson<UserRow[]>(approverApi, '/users', 'GET /users');
  const author = users.find((u) => u.email === STAFF.author.email);
  expect(author, `the demo user ${STAFF.author.email} is missing — run seed:demo`).toBeTruthy();

  // The emptiest task-driven meter: a hybrid would move by half the points and a
  // derived one would not move at all, and `task_value` clamps at 100.
  const candidates = (await meters(approverApi))
    .filter((m) => m.mode === 'task_driven')
    .sort((a, b) => a.task_value - b.task_value);
  const roomy = candidates.find((m) => m.task_value + READINESS_VALUE <= 100);
  if (!roomy) {
    const exhausted =
      `Every task-driven meter is within ${READINESS_VALUE} points of its 100 ceiling, so no ` +
      'meter can move and the walk cannot prove anything. Clear the accumulated ' +
      'TaskReadinessEvent rows — see frontend/e2e/README.md.';
    // On CI the database is seeded fresh and every meter reads 0, so this is a
    // real defect rather than an exhausted local fixture.
    if (process.env.CI) throw new Error(exhausted);
    skipReason = exhausted;
    return;
  }
  meter = roomy;
  meterBefore = meter.current_value;

  const mission = await approverApi.post('/missions', {
    data: {
      title: `QA-03 smoke mission ${runId}`,
      description: 'Created by frontend/e2e/smoke-1-mission.spec.ts.',
      phase: 'setup',
      scope: 'system',
    },
  });
  expect(mission.status(), await mission.text()).toBe(201);
  missionId = ((await mission.json()) as { id: string }).id;

  // A task may only hang off an active mission's progress roll-up.
  const activated = await approverApi.patch(`/missions/${missionId}`, {
    data: { status: 'active' },
  });
  expect(activated.ok(), await activated.text()).toBeTruthy();

  const created = await approverApi.post('/tasks', {
    data: {
      mission_id: missionId,
      title: taskTitle,
      description: 'Attach link evidence, get it signed off, watch the meter move.',
      task_type: 'core',
      domain: TASK_DOMAIN,
      owner_user_id: (author as UserRow).id,
      // `critical` sorts first under `orderBy: [priority desc, created_at desc]`,
      // which is what keeps a brand-new task on the first page of `/tasks`.
      priority: 'critical',
      xp: TASK_XP,
      requires_approval: true,
      readiness_meter_id: meter.id,
      readiness_value: READINESS_VALUE,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const task = (await created.json()) as TaskRow;
  taskId = task.id;

  // The starting point every later assertion is measured against.
  expect(task.status).toBe('todo');
  expect(task.valid).toBe(false);
  expect(task.readiness_meter_id).toBe(meter.id);
  expect(task.readiness_value).toBe(READINESS_VALUE);
});

test.afterAll(async () => {
  await approverApi?.dispose();
});

// ─── the walk ───────────────────────────────────────────────────────────────

test('negative — the ops shell turns a stranger away', async ({ page, request: anonymous }) => {
  // `proxy.ts` rewrites rather than redirects, so the URL stays on `/team` and
  // the login form is what renders. Getting this wrong is how a "logged in"
  // smoke silently asserts against the sign-in page.
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/team\?redirect=%2Ftasks$/);
  await expect(page.getByRole('heading', { name: 'Team Login' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  // And the door the page sits in front of is locked too.
  const refused = await anonymous.get(`${API_BASE_URL}/tasks`);
  expect(refused.status()).toBe(401);
});

test('smoke 1 — work becomes proof, proof is signed off, and a meter moves', async ({
  page,
  browser,
  baseURL,
}) => {
  test.skip(skipReason !== null, skipReason ?? '');

  const base = baseURL ?? 'http://localhost:3000';
  const evidenceCard = card(page, 'Evidence');

  await test.step('the owner signs in at the real form and lands on her tasks', async () => {
    await signInThroughTheForm(page, STAFF.author, '/tasks');
    await expect(page.getByRole('heading', { level: 1, name: /^(My|All) Tasks$/ })).toBeVisible({
      timeout: 60_000,
    });
  });

  await test.step('she finds the task, and the row announces the meter it feeds', async () => {
    const filter = page.getByPlaceholder('Filter tasks by title...');
    await expect(filter).toBeVisible({ timeout: 30_000 });
    await filter.fill(taskTitle);

    const row = page.getByRole('row').filter({ hasText: taskTitle });
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    await expect(row).toContainText('Critical');
    await expect(row).toContainText(`+${TASK_XP} XP`);
    // `MeterChip` — the link between a task and a readiness meter, on screen.
    await expect(row).toContainText(meter.name);
    await expect(row).toContainText(`+${READINESS_VALUE}`);

    await row.getByText(taskTitle).click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}$`));
  });

  await test.step('nothing is proven yet: none of the three conditions is met', async () => {
    await expect(page.getByRole('heading', { level: 1, name: taskTitle })).toBeVisible({
      timeout: 60_000,
    });
    await expect(evidenceCard.getByText('No evidence submitted yet.')).toBeVisible();
    await expect(
      page.getByRole('img', { name: 'Validation conditions met: 0 of 3' }),
    ).toBeVisible();
    await expect(evidenceCard.getByText('Status is Done')).toBeVisible();
    await expect(evidenceCard.getByText('At least one evidence approved')).toBeVisible();
    await expect(evidenceCard.getByText('All required approvals satisfied')).toBeVisible();
  });

  await test.step('she does the work — the task goes to Done', async () => {
    const statusCard = card(page, 'Status');
    await statusCard.locator('[data-slot="select-trigger"]').click();
    await page.getByRole('option', { name: 'Done', exact: true }).click();

    // The header badge, not the select trigger: `Select.Value` prints the raw
    // enum (`done`), while the badge runs it through `TASK_STATUS_LABELS`.
    await expect(page.getByText('Done', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('img', { name: 'Validation conditions met: 1 of 3' })).toBeVisible({
      timeout: 30_000,
    });
  });

  await test.step('the work becomes the proof — link evidence, no object storage', async () => {
    // The link form is the evidence path that needs no R2: `POST /tasks/:id/evidence`
    // writes straight to Postgres. (`Add a note` posts an empty `url`, which the
    // DTO's `@IsNotEmpty()` refuses — see e2e/README.md.)
    await evidenceCard.getByRole('button', { name: 'Add a link' }).click();
    await page.getByPlaceholder('https://...').fill(evidenceUrl);
    await page.getByPlaceholder('Add context for the reviewer').fill(`QA-03 smoke ${taskTitle}`);
    await evidenceCard.getByRole('button', { name: 'Save link' }).click();

    await expect(page.getByText('Link evidence submitted.')).toBeVisible({ timeout: 30_000 });
    const row = evidenceRow(evidenceCard, evidenceUrl);
    await expect(row).toContainText('Pending', { timeout: 30_000 });
  });

  await test.step('negative — she is offered no way to approve her own proof', async () => {
    // She is `FOUNDER_ADMIN` and holds every permission in the system. What
    // withholds the control is authorship — `EvidenceSection` passes
    // `canApprove: uploaded_by !== user.id` — and the UI withholds it rather
    // than letting the 403 be discovered by clicking.
    const row = evidenceRow(evidenceCard, evidenceUrl);
    await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Reject' })).toHaveCount(0);

    // The founder's *override* on the policy approval is offered — `mine=1`
    // hands every pending row to a `FOUNDER_ADMIN`. This walk deliberately does
    // not take it: the sign-off belongs to the role the policy named, and the
    // approver claims it below.
    await expect(signOffSection(page)).toBeVisible();

    const stillOpen = await fetchTask(approverApi, taskId);
    expect(stillOpen.status).toBe('done');
    expect(stillOpen.valid).toBe(false);
  });

  // ── the second pair of eyes ───────────────────────────────────────────────

  const approverContext = await browser.newContext({ baseURL: base });
  await applyStaffSession(approverContext, approver, base);
  const approverPage = await approverContext.newPage();

  try {
    const meterButton = approverPage.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(meter.name)}: \\d+% ready$`),
    });
    let shownBefore = 0;

    await test.step('the meter, before anyone signs anything', async () => {
      await approverPage.goto('/readiness');
      await expect(
        approverPage.getByRole('heading', { level: 1, name: 'Readiness Intelligence' }),
      ).toBeVisible({ timeout: 60_000 });
      // Every readiness number on screen is painted by `NumberTicker`, which
      // renders `0` first and animates toward the real value inside an
      // `aria-hidden` span. The button's own label is plain markup.
      await expect(meterButton).toBeVisible({ timeout: 30_000 });
      shownBefore = await readMeterPercent(meterButton);
      expect(shownBefore).toBe(Math.round(meterBefore));
    });

    await test.step('the approval is waiting for him on /approvals', async () => {
      await approverPage.goto('/approvals');
      await expect(
        approverPage.getByRole('heading', { level: 1, name: 'Approvals' }),
      ).toBeVisible({ timeout: 60_000 });
      await approverPage.getByLabel('Filter approvals').fill(taskTitle);

      const queued = approverPage
        .locator('[data-slot="card"]')
        .filter({ hasText: taskTitle });
      await expect(queued).toHaveCount(1, { timeout: 30_000 });
      // The policy's terms, on screen: who must sign, and whose work it is.
      await expect(queued).toContainText(STAFF.approver.roleName);
      await expect(queued).toContainText('Submitted by');

      const row = await taskApproval(approverApi, taskId);
      expect(row.required_role_code).toBe(STAFF.approver.roleCode);
      expect(row.status).toBe('pending');
    });

    await test.step('he approves the evidence — and the task is still not valid', async () => {
      await approverPage.goto(`/tasks/${taskId}`);
      await expect(
        approverPage.getByRole('heading', { level: 1, name: taskTitle }),
      ).toBeVisible({ timeout: 60_000 });

      const approverEvidence = card(approverPage, 'Evidence');
      const row = evidenceRow(approverEvidence, evidenceUrl);
      await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(1, {
        timeout: 30_000,
      });
      await row.getByRole('button', { name: 'Approve' }).click();
      await expect(row).toContainText('Approved', { timeout: 30_000 });

      // P3 decision 4, the whole point of this smoke: an approved evidence row
      // is not enough while the policy approval is undecided. The screen's own
      // checklist approximates the third condition client-side, so the API is
      // the authority here.
      const gated = await fetchTask(approverApi, taskId);
      expect(
        gated.valid,
        'evidence was approved but the policy approval is still pending — the task must not validate',
      ).toBe(false);
      expect(gated.valid_xp).toBe(0);
      expect(gated.verified).toBe(false);

      const unmoved = await meterByCode(approverApi, meter.code);
      expect(unmoved.current_value).toBeCloseTo(meterBefore, 5);
      expect(unmoved.task_value).toBeCloseTo(meter.task_value, 5);
    });

    await test.step('he signs the approval off — and the task validates', async () => {
      const signOff = signOffSection(approverPage);
      await expect(signOff).toHaveCount(1, { timeout: 30_000 });
      await expect(signOff).toContainText(taskTitle);
      await signOff.getByRole('button', { name: 'Approve' }).click();

      await expect(
        approverPage.getByText(new RegExp(`Task validated! \\+${TASK_XP} XP`)),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        approverPage.getByRole('img', { name: 'Validation conditions met: 3 of 3' }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(card(approverPage, 'Evidence').getByText('Task validated')).toBeVisible();

      const validated = await fetchTask(approverApi, taskId);
      expect(validated.valid).toBe(true);
      expect(validated.verified).toBe(true);
      expect(validated.valid_xp).toBe(TASK_XP);
    });

    await test.step(`the meter moved by exactly +${READINESS_VALUE}`, async () => {
      const moved = await meterByCode(approverApi, meter.code);
      expect(
        moved.current_value - meterBefore,
        `${meter.code} (${meter.mode}) should have risen by the task's readiness_value`,
      ).toBeCloseTo(READINESS_VALUE, 5);
      expect(moved.task_value - meter.task_value).toBeCloseTo(READINESS_VALUE, 5);

      await approverPage.goto('/readiness');
      await expect(
        approverPage.getByRole('heading', { level: 1, name: 'Readiness Intelligence' }),
      ).toBeVisible({ timeout: 60_000 });
      await expect(meterButton).toHaveAttribute(
        'aria-label',
        `${meter.name}: ${shownBefore + READINESS_VALUE}% ready`,
        { timeout: 30_000 },
      );
    });

    await test.step('and there is nothing left waiting on him for this task', async () => {
      await approverPage.goto('/approvals');
      await approverPage.getByLabel('Filter approvals').fill(taskTitle);
      await expect(
        approverPage.locator('[data-slot="card"]').filter({ hasText: taskTitle }),
      ).toHaveCount(0, { timeout: 30_000 });
    });
  } finally {
    await approverContext.close();
  }
});
