import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ApprovalPolicyModule } from '../approvals/approval-policy.module';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceModule } from '../evidence/evidence.module';
import { EvidenceService } from '../evidence/evidence.service';
import { TasksModule } from './tasks.module';
import { TasksService } from './tasks.service';
import {
  TASK_VALIDATION_PORT,
  type TaskValidationPort,
} from './task-validation.port';
import { mockPrisma } from '../test-utils/mock-providers';

/**
 * P6 Task 13. `TasksService` now re-runs `EvidenceService.validateTask` when a
 * task is marked done, and `EvidenceModule` already imports `TasksModule` —
 * so the naive wiring (constructor injection plus `imports: [EvidenceModule]`)
 * is a two-way cycle at both the module and the provider level. Compiling the
 * *real* graph, both modules in one container, is the only thing that proves
 * the port removed it: a cycle fails here, at `compile()`, rather than at boot
 * after a merge.
 */
describe('TasksModule ↔ EvidenceModule', () => {
  it('resolves both services and binds the validation port with no cycle', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        PrismaModule,
        AuditModule,
        ApprovalPolicyModule,
        TasksModule,
        EvidenceModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma())
      .compile();

    expect(moduleRef.get(TasksService)).toBeInstanceOf(TasksService);
    expect(moduleRef.get(EvidenceService)).toBeInstanceOf(EvidenceService);

    // The port must reach the application's own `EvidenceService`, not a second
    // instance stood up inside `TasksModule`.
    const port = moduleRef.get<TaskValidationPort>(TASK_VALIDATION_PORT);
    const evidence = moduleRef.get(EvidenceService);
    const spy = jest
      .spyOn(evidence, 'emitTaskValidated')
      .mockImplementation(() => undefined);

    port.emitTaskValidated(null, 'user-1');

    expect(spy).toHaveBeenCalledWith(null, 'user-1');
    spy.mockRestore();
  });
});
