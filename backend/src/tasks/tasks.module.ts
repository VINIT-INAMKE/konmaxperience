import { Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { EvidenceService } from '../evidence/evidence.service';
import {
  TASK_VALIDATION_PORT,
  type TaskValidationPort,
} from './task-validation.port';

/**
 * Binds {@link TASK_VALIDATION_PORT} to the application's single
 * `EvidenceService`, resolved on **every call** rather than once at
 * construction.
 *
 * `strict: false` searches the whole application container, so `TasksModule`
 * does not import `EvidenceModule` — which is what keeps the module graph
 * acyclic, since `EvidenceModule` already imports `TasksModule`. Resolving
 * lazily also means the factory cannot run before `EvidenceModule` has been
 * instantiated: by the time a task is marked done, every provider exists.
 *
 * Importing the `EvidenceService` *class* here is safe where importing it from
 * `tasks.service.ts` is not: this file is only ever reached through
 * `tasks.module.ts`, never from `evidence.service.ts`, so the `require()` chain
 * `tasks.module → evidence.service → tasks.service` terminates.
 */
export const taskValidationPortFactory = (
  moduleRef: ModuleRef,
): TaskValidationPort => ({
  validateTask: (taskId, tx) =>
    moduleRef.get(EvidenceService, { strict: false }).validateTask(taskId, tx),
  emitTaskValidated: (seed, actorUserId) =>
    moduleRef
      .get(EvidenceService, { strict: false })
      .emitTaskValidated(seed, actorUserId),
});

@Module({
  controllers: [TasksController],
  providers: [
    TasksService,
    {
      provide: TASK_VALIDATION_PORT,
      inject: [ModuleRef],
      useFactory: taskValidationPortFactory,
    },
  ],
  exports: [TasksService],
})
export class TasksModule {}
