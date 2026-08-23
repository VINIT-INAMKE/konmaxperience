import { Global, Module } from '@nestjs/common';
import { ApprovalPolicyService } from './approval-policy.service';
import { ApprovalPoliciesController } from './approval-policies.controller';

/**
 * @Global so TasksService, RecipesService, ApprovalsService and EvidenceService
 * can inject the resolver without TasksModule → ApprovalsModule → EvidenceModule
 * → TasksModule becoming a cycle. It depends on PrismaService only.
 */
@Global()
@Module({
  controllers: [ApprovalPoliciesController],
  providers: [ApprovalPolicyService],
  exports: [ApprovalPolicyService],
})
export class ApprovalPolicyModule {}
