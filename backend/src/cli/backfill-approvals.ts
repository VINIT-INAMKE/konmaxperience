/**
 * `npm run backfill:approvals [-- --dry-run]`
 *
 * Operator entry point for the P3 decision 4 backfill: tasks with
 * `requires_approval: true` and zero `Approval` rows. See
 * `ApprovalPolicyService.backfillMissing` for what it does and why.
 *
 * It boots a Nest **application context** (no HTTP listener) so the repair runs
 * through the real service layer — `ApprovalPolicyService.materialise` writes
 * the rows and `EvidenceService.validateTask` re-runs the cascade — rather than
 * through a second, drifting copy of the rules in a raw-Prisma script. This is
 * the same harness the P3 runtime smoke used.
 *
 * Idempotent: run it as many times as you like. Always run `--dry-run` first.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import {
  ApprovalPolicyService,
  type BackfillReport,
} from '../approvals/approval-policy.service';

const TAG = '[backfill:approvals]';

function print(report: BackfillReport, dryRun: boolean): void {
  const verb = dryRun ? 'would be' : 'were';
  console.log(
    `${TAG} ${dryRun ? 'DRY RUN — nothing was written' : 'LIVE RUN'}`,
  );
  console.log(
    `${TAG} scanned        ${report.scanned} tasks (requires_approval = true)`,
  );
  console.log(
    `${TAG} affected       ${report.revalidated + report.skipped.length} tasks (zero Approval rows)`,
  );
  console.log(
    `${TAG} materialised   ${report.materialised} Approval rows ${verb} created`,
  );
  console.log(
    `${TAG} revalidated    ${report.revalidated} tasks ${verb} put back through the cascade`,
  );
  console.log(`${TAG} skipped        ${report.skipped.length} tasks`);
  for (const skip of report.skipped) {
    console.log(`${TAG}   - ${skip.task_id}: ${skip.reason}`);
  }
  console.log(`${TAG} report ${JSON.stringify(report)}`);
}

async function main(): Promise<number> {
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const report = await app.get(ApprovalPolicyService).backfillMissing(dryRun);
    print(report, dryRun);
    return report.skipped.length > 0 ? 2 : 0;
  } finally {
    await app.close();
  }
}

main()
  .then((code) => {
    // The context holds Redis/QStash/schedule handles that can outlive
    // `app.close()`; exit explicitly so the script never hangs a CI step.
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.error(`${TAG} failed:`, error);
    process.exit(1);
  });
