import { Module } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import {
  EvidenceController,
  EvidenceReviewController,
} from './evidence.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  controllers: [EvidenceController, EvidenceReviewController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
