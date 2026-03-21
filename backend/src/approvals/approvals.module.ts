import { Module } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { EvidenceModule } from '../evidence/evidence.module';
import { DelegationsModule } from '../delegations/delegations.module';

@Module({
  imports: [EvidenceModule, DelegationsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
