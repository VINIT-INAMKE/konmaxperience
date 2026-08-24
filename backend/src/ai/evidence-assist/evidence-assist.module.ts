import { Module } from '@nestjs/common';
import { AiModule } from '../ai.module';
import { EvidenceAssistController } from './evidence-assist.controller';
import { EvidenceAssistService } from './evidence-assist.service';

/**
 * RUN-05's evidence surface, as a self-contained sub-module of `src/ai/`.
 *
 * `AiModule` itself is frozen at the end of wave 1 and declares no controllers,
 * so the assist ships its own module and `app.module.ts` imports this one.
 * `PrismaModule` and `NodeModule` are both `@Global()`, so `AiModule` — for
 * `AiProviderResolver` — is the only import needed.
 */
@Module({
  imports: [AiModule],
  controllers: [EvidenceAssistController],
  providers: [EvidenceAssistService],
  exports: [EvidenceAssistService],
})
export class EvidenceAssistModule {}
