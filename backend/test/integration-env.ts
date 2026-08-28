/**
 * jest `setupFiles` for the integration project — runs in every worker before
 * the test framework and before the spec file is required, so `DATABASE_URL`
 * already points at the test database by the time anything constructs a Prisma
 * client. See `test/integration-setup.ts`.
 */
import { applyIntegrationEnv } from './integration-setup';

applyIntegrationEnv();
