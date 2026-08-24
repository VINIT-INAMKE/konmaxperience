import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { AiProviderResolver } from './ai-provider.resolver';
import { AnthropicProvider } from './anthropic.provider';
import { HeuristicProvider } from './heuristic.provider';

/**
 * RUN-05 behind a port. No controllers of its own: the assist and brief
 * surfaces arrive in wave 2 under `src/ai/evidence-assist/` and
 * `src/ai/morning-brief/`, each importing this module for `AiProviderResolver`.
 */
@Module({
  imports: [SettingsModule],
  providers: [HeuristicProvider, AnthropicProvider, AiProviderResolver],
  exports: [AiProviderResolver, HeuristicProvider, AnthropicProvider],
})
export class AiModule {}
