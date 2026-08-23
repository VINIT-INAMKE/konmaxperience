import { Module } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import {
  EvidenceController,
  EvidenceReviewController,
} from './evidence.controller';
import { TasksModule } from '../tasks/tasks.module';

/**
 * `ApprovalPolicyService` (P3 decision 5) and `EventEmitter2` are both provided
 * by globally-registered modules (`ApprovalPolicyModule` is `@Global`,
 * `EventEmitterModule.forRoot()` is registered in `app.module.ts`), so neither
 * appears in `imports` — adding `ApprovalsModule` here would create the cycle
 * TasksModule → ApprovalsModule → EvidenceModule → TasksModule.
 */
@Module({
  imports: [TasksModule],
  controllers: [EvidenceController, EvidenceReviewController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
