import { Global, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ApprovalPolicyService } from './approval-policy.service';
import { ApprovalPoliciesController } from './approval-policies.controller';
import { EvidenceService } from '../evidence/evidence.service';
import {
  BACKFILL_VALIDATION_PORT,
  type BackfillValidationPort,
} from './backfill-validation.port';

/**
 * Binds {@link BACKFILL_VALIDATION_PORT} to the application's single
 * `EvidenceService`, resolved on **every call** rather than once at
 * construction — the same shape `tasks.module.ts` uses for
 * `TASK_VALIDATION_PORT`, and for the same reason.
 *
 * `strict: false` searches the whole application container, so this module
 * still imports nothing. Resolving lazily also means the factory cannot run
 * before `EvidenceModule` has been instantiated.
 *
 * Importing the `EvidenceService` *class* here is safe where importing it from
 * `approval-policy.service.ts` is not: nothing in `src/evidence/**` reaches
 * this file, so the `require()` chain
 * `approval-policy.module → evidence.service → approval-policy.service`
 * terminates.
 */
export const backfillValidationPortFactory = (
  moduleRef: ModuleRef,
): BackfillValidationPort => ({
  validateTask: (taskId, tx) =>
    moduleRef.get(EvidenceService, { strict: false }).validateTask(taskId, tx),
});

/**
 * @Global so TasksService, RecipesService, ApprovalsService and EvidenceService
 * can inject the resolver without TasksModule → ApprovalsModule → EvidenceModule
 * → TasksModule becoming a cycle. It depends on PrismaService, the `@Global`
 * AuditService and the lazily-resolved validation port above.
 */
@Global()
@Module({
  controllers: [ApprovalPoliciesController],
  providers: [
    ApprovalPolicyService,
    {
      provide: BACKFILL_VALIDATION_PORT,
      inject: [ModuleRef],
      useFactory: backfillValidationPortFactory,
    },
  ],
  exports: [ApprovalPolicyService],
})
export class ApprovalPolicyModule {}
