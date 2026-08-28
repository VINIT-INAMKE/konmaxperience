/**
 * `QA-05` (second half) — the Postgres-backed integration harness promised by
 * the P1c plan and carried through Phases 31 → 33 → 34 → 35.
 *
 * Unit specs mock `PrismaService`, so nothing in the 2 000-test unit run can
 * prove that a Serializable transaction *commits together*, that a DB `CHECK`
 * rejects a bad row, or that a unique index makes a replay a no-op. Those are
 * database facts. This module is the seam that lets a spec talk to a real
 * Postgres without ever touching the demo database.
 *
 * Three exports carry the whole harness:
 *   • {@link applyIntegrationEnv} — points `DATABASE_URL` at the test database
 *     *before* anything constructs a Prisma client (jest `setupFiles`).
 *   • {@link createTestPrisma} — a real {@link PrismaService} on that URL. The
 *     production class, not a stand-in: the services under test take
 *     `PrismaService`, and swapping in a look-alike would re-introduce exactly
 *     the mock-shaped blind spot this harness exists to remove.
 *   • {@link truncateAll} — one `TRUNCATE … CASCADE` over every table but
 *     `_prisma_migrations`, so suites never inherit each other's rows.
 *
 * The default export is jest's `globalSetup`: `prisma migrate deploy` against
 * the test URL, then a truncate, so a run starts from a schema that matches
 * `prisma/migrations` exactly and a database with nothing in it.
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';

/** The backend package root — `migrate deploy` has to run from here. */
export const BACKEND_ROOT = path.resolve(__dirname, '..');

/**
 * The local Docker Postgres (`konma-postgres`, host port 5433) with a database
 * of its own. CI overrides it through `INTEGRATION_DATABASE_URL`.
 */
export const DEFAULT_INTEGRATION_DATABASE_URL =
  'postgresql://konma:konma@localhost:5433/konma_test?schema=public';

/** Where every integration spec in this directory reads and writes. */
export const INTEGRATION_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL?.trim() ||
  DEFAULT_INTEGRATION_DATABASE_URL;

/**
 * Databases the harness must never open, whatever the environment says.
 * `konma` is the live demo database and `konma_shadow` belongs to the drift
 * gate; a truncate against either would be unrecoverable and silent.
 */
const FORBIDDEN_DATABASES = new Set(['konma', 'konma_shadow', 'postgres']);

function databaseNameOf(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `INTEGRATION_DATABASE_URL is not a valid connection URL: ${url}`,
    );
  }
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
}

/**
 * The hard rule, enforced in code rather than in a README: the harness only
 * ever opens a database whose name says it is a test database, and never one
 * of the two real ones. Every entry point calls this before it connects.
 */
export function assertIsTestDatabase(url: string = INTEGRATION_DATABASE_URL) {
  const name = databaseNameOf(url);
  if (!name) {
    throw new Error(`INTEGRATION_DATABASE_URL names no database: ${url}`);
  }
  if (FORBIDDEN_DATABASES.has(name) || !/test/i.test(name)) {
    throw new Error(
      `Refusing to run integration tests against "${name}". The harness ` +
        `truncates every table, so it only accepts a database whose name ` +
        `contains "test" (default: konma_test) — never konma or konma_shadow.`,
    );
  }
  return name;
}

/**
 * Redirects this process at the test database. `PrismaService` reads
 * `DATABASE_URL` in its constructor and nothing in `src/**` loads a `.env`
 * file, so setting the variable here is the whole override — and it is
 * inherited by the `prisma migrate deploy` child process too.
 *
 * Idempotent, and called from both `setupFiles` (per worker) and `globalSetup`
 * (the jest parent process, where `setupFiles` has not run).
 */
export function applyIntegrationEnv(): string {
  const url = INTEGRATION_DATABASE_URL;
  assertIsTestDatabase(url);
  process.env.DATABASE_URL = url;
  process.env.DIRECT_DATABASE_URL = url;
  // The money path stamps `@db.Date` business days; pin the node's zone so a
  // runner in another timezone cannot shift one.
  process.env.TZ ??= 'Asia/Kolkata';
  return url;
}

/**
 * A real `PrismaService` on the test database. Callers own the lifecycle —
 * Nest is not involved, so `onModuleInit`/`onModuleDestroy` never fire and the
 * client connects lazily on its first query. Disconnect it in `afterAll`.
 */
export function createTestPrisma(): PrismaService {
  applyIntegrationEnv();
  return new PrismaService();
}

/**
 * Empties every application table in one statement. `CASCADE` means the FK
 * graph does not have to be ordered by hand — which matters, because the
 * schema has ~70 tables and the order would rot on the next migration.
 * `_prisma_migrations` is preserved: dropping it would make the next
 * `migrate deploy` replay migrations against a populated schema.
 */
export async function truncateAll(prisma: PrismaService): Promise<void> {
  assertIsTestDatabase();
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE tables text;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
        INTO tables
        FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename <> '_prisma_migrations';
      IF tables IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE';
      END IF;
    END $$;
  `);
}

/** Truncate through a throwaway client — for the global setup/teardown hooks. */
async function truncateStandalone(): Promise<void> {
  const prisma = createTestPrisma();
  try {
    await truncateAll(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * `prisma migrate deploy` against the test database, run through the prisma CLI
 * the repo already depends on. Deploy, never `dev`: the harness applies the
 * committed migrations and is forbidden from authoring one.
 */
function migrateDeploy(url: string): void {
  // The path is spelled out rather than `require.resolve`d: jest replaces
  // `require.resolve` with its own resolver inside a transpiled global hook,
  // and that one follows the package's `types` condition to a `.d.ts` sibling.
  const cli = path.join(
    BACKEND_ROOT,
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );
  execFileSync(process.execPath, [cli, 'migrate', 'deploy'], {
    cwd: BACKEND_ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
  });
}

/**
 * jest `globalSetup`. Runs once per `npm run test:integration`, in the parent
 * process, before any worker starts.
 */
export default async function globalSetup(): Promise<void> {
  const url = applyIntegrationEnv();
  const name = assertIsTestDatabase(url);
  console.log(`[qa-05] integration database: ${name}`);
  try {
    migrateDeploy(url);
  } catch (err) {
    throw new Error(
      `prisma migrate deploy failed against "${name}".\n` +
        `If the database does not exist yet, create it first:\n` +
        `  docker exec konma-postgres psql -U konma -d postgres -c "CREATE DATABASE ${name};"\n` +
        String(err),
    );
  }
  await truncateStandalone();
}

/** jest `globalTeardown` — leave the database as empty as we found it. */
export async function globalTeardown(): Promise<void> {
  applyIntegrationEnv();
  if (process.env.INTEGRATION_KEEP_DATA === 'true') return;
  await truncateStandalone();
}
