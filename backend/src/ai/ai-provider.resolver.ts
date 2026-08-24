import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { AnthropicProvider } from './anthropic.provider';
import { HeuristicProvider } from './heuristic.provider';
import { readAiSettings } from './ai.types';
import type { AiProviderPort, AiSettings } from './ai.types';

/**
 * Resolves the provider **per call** from `SystemSetting['ai'].provider` (plan
 * decision 1), so an operator can flip providers without a redeploy and tests
 * default to `heuristic` — no jest run can reach the network.
 *
 * Mirrors `ShippingProviderResolver`, including its `settings()` accessor, so
 * the callers that need the rest of the block (the two enable flags, the
 * recipient roles for the brief) do not reach for `SettingsService` themselves.
 */
@Injectable()
export class AiProviderResolver {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly anthropic: AnthropicProvider,
    private readonly heuristic: HeuristicProvider,
  ) {}

  /** The `SystemSetting['ai']` block, defaulted field by field. */
  async settings(): Promise<AiSettings> {
    return readAiSettings(this.settingsService);
  }

  async get(): Promise<AiProviderPort> {
    const { provider } = await readAiSettings(this.settingsService);
    return provider === 'anthropic' ? this.anthropic : this.heuristic;
  }
}
