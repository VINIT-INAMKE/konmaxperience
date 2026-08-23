import { Module } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { EvidenceModule } from '../evidence/evidence.module';
import { DelegationsModule } from '../delegations/delegations.module';

/**
 * `ApprovalPolicyService` comes from the `@Global` `ApprovalPolicyModule`
 * (P3 decision 5) and `EventEmitter2` from `EventEmitterModule.forRoot()` in
 * `app.module.ts`, so neither needs an entry here.
 */
@Module({
  imports: [EvidenceModule, DelegationsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
