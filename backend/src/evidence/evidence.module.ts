import { Module } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import {
  EvidenceController,
  EvidenceReviewController,
} from './evidence.controller';

@Module({
  controllers: [EvidenceController, EvidenceReviewController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
