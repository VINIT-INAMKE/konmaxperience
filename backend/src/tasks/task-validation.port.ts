import type { Tx } from '../common/types/transaction';
import type {
  TaskValidatedSeed,
  ValidateTaskResult,
} from '../evidence/evidence.service';

/**
 * The slice of `EvidenceService` that `TasksService.update` needs to re-run the
 * validation cascade when a task is marked done (P6 Task 13).
 *
 * **Why a port instead of injecting `EvidenceService` directly.** The plan asked
 * for `EvidenceModule` in `TasksModule.imports`, on the reading that
 * "`EvidenceModule` does not import `TasksModule`". It does
 * (`evidence.module.ts`), and `EvidenceService` injects `TasksService` on top of
 * that — so a constructor dependency here closes two cycles at once, one at the
 * module level and one at the provider level. Nest's `forwardRef` escape hatch
 * has to be applied on **both** sides of a cycle, and both of those sides live
 * in `src/evidence/**`, which this task does not own. Worse, a one-sided
 * `forwardRef` does not even fail loudly: it depends on which of the two files
 * `require()` reaches first, so it would boot on one import order and throw
 * "Nest can't resolve dependencies of the EvidenceService (?, …)" on another.
 *
 * The port removes the cycle rather than deferring it. Nothing in
 * `tasks.service.ts` refers to anything in `src/evidence/**` at runtime — the
 * two imports in this file are **type-only and must stay that way**; turning
 * either into a value import re-creates exactly the cycle described above.
 * `tasks.module.ts` binds the token to the real singleton through `ModuleRef`,
 * resolved lazily at call time, so no module has to import another.
 */
export interface TaskValidationPort {
  /** `EvidenceService.validateTask` — runs inside the caller's transaction. */
  validateTask(taskId: string, tx: Tx): Promise<ValidateTaskResult>;
  /** `EvidenceService.emitTaskValidated` — call AFTER the transaction commits. */
  emitTaskValidated(
    seed: TaskValidatedSeed | null,
    actorUserId: string | null,
  ): void;
}

/** DI token for {@link TaskValidationPort}; bound in `tasks.module.ts`. */
export const TASK_VALIDATION_PORT = Symbol('TASK_VALIDATION_PORT');

/** Re-exported so `tasks.service.ts` never has to name `src/evidence/**` at all. */
export type { TaskValidatedSeed, ValidateTaskResult };
