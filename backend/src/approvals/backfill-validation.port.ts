import type { Tx } from '../common/types/transaction';
import type { ValidateTaskResult } from '../evidence/evidence.service';

/**
 * The one slice of `EvidenceService` that {@link
 * ApprovalPolicyService.backfillMissing} needs: re-run the validation cascade
 * for a task inside the transaction that just materialised its approvals.
 *
 * **Why a port instead of injecting `EvidenceService`.** `EvidenceService`
 * already injects `ApprovalPolicyService` (`evidence.service.ts` — the P3
 * decision 4 gate), so a constructor dependency the other way is a provider
 * cycle, and a *value* import of `evidence.service.ts` from
 * `approval-policy.service.ts` is a `require()` cycle on top of it. The port
 * removes both: the two imports in this file are **type-only and must stay
 * that way**, and `approval-policy.module.ts` binds the token through
 * `ModuleRef` resolved lazily at call time — the same shape
 * `tasks.module.ts` uses for `TASK_VALIDATION_PORT`.
 *
 * `TASK_VALIDATION_PORT` itself is not reusable here: `TasksModule` binds it
 * but does not export it, and `ApprovalPolicyModule` is `@Global()` and imports
 * nothing.
 */
export interface BackfillValidationPort {
  /** `EvidenceService.validateTask` — runs inside the caller's transaction. */
  validateTask(taskId: string, tx: Tx): Promise<ValidateTaskResult>;
}

/** DI token for {@link BackfillValidationPort}; bound in `approval-policy.module.ts`. */
export const BACKFILL_VALIDATION_PORT = Symbol('BACKFILL_VALIDATION_PORT');

export type { ValidateTaskResult };
