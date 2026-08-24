import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { SettingsService } from '../settings/settings.service';
import { HeuristicProvider } from './heuristic.provider';
import {
  EVIDENCE_ASSIST_SYSTEM,
  evidenceAssistPrompt,
} from './evidence-assist/evidence-assist.prompt';
import {
  MORNING_BRIEF_SYSTEM,
  morningBriefPrompt,
} from './morning-brief/morning-brief.prompt';
import { readAiSettings } from './ai.types';
import type {
  AiProviderPort,
  EvidenceAssistInput,
  EvidenceAssistResult,
  MorningBriefInput,
  MorningBriefResult,
} from './ai.types';

const AssistSchema = z.object({
  verdict: z.enum(['approve', 'reject', 'unsure']),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).min(1).max(4),
});

const BriefSchema = z.object({
  headline: z.string(),
  bullets: z.array(z.string()).min(3).max(6),
  actions: z.array(z.string()).max(3),
});

/**
 * The model-backed half of RUN-05. Every failure mode — no credentials, a 429,
 * a connection error, a refusal, an unparseable body — degrades to
 * `HeuristicProvider` rather than throwing: an assist is advisory, and it must
 * never be the reason an evidence board or a nightly cron fails.
 *
 * The call shape is fixed by plan decision 3: `thinking: { type: 'adaptive' }`,
 * effort inside `output_config`, structured output through `messages.parse` and
 * `zodOutputFormat`. **No `budget_tokens`** (removed on Opus 5 — a 400) and
 * **no assistant prefill** (also a 400). No streaming: both outputs are small
 * and schema-bounded.
 *
 * Server-side refusal fallbacks are deliberately not used (plan decision 4):
 * rerouting a refusal to another model is strictly less available than a
 * fallback that needs no key, no network and no quota.
 */
@Injectable()
export class AnthropicProvider implements AiProviderPort {
  readonly name = 'anthropic' as const;
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly settings: SettingsService,
    private readonly heuristic: HeuristicProvider,
  ) {
    // Zero-arg constructor resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN /
    // an `ant auth login` profile. Absent credentials are a supported state
    // (decision 2), so construction never throws — the fallback carries it.
    this.client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  }

  /** True when credentials were present at boot. Advisory surfaces may show it. */
  get configured(): boolean {
    return this.client !== null;
  }

  async reviewEvidence(
    input: EvidenceAssistInput,
  ): Promise<EvidenceAssistResult> {
    if (!this.client) return this.heuristic.reviewEvidence(input);
    const started = Date.now();
    const cfg = await readAiSettings(this.settings);
    try {
      const response = await this.client.messages.parse({
        model: cfg.model,
        max_tokens: 2048,
        system: EVIDENCE_ASSIST_SYSTEM,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low', format: zodOutputFormat(AssistSchema) },
        messages: [{ role: 'user', content: evidenceAssistPrompt(input) }],
      });
      // `stop_details` is populated only on a refusal — always guard first.
      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        this.logger.warn(
          `Evidence assist fell back to heuristic (stop_reason=${response.stop_reason ?? 'none'}).`,
        );
        return this.heuristic.reviewEvidence(input);
      }
      const parsed = response.parsed_output;
      return {
        verdict: parsed.verdict,
        confidence: parsed.confidence,
        reasons: parsed.reasons,
        provider: this.name,
        model: cfg.model,
        latency_ms: Date.now() - started,
      };
    } catch (err) {
      this.degradeOrRethrow(err, 'evidence assist');
      return this.heuristic.reviewEvidence(input);
    }
  }

  async writeMorningBrief(
    input: MorningBriefInput,
  ): Promise<MorningBriefResult> {
    if (!this.client) return this.heuristic.writeMorningBrief(input);
    const started = Date.now();
    const cfg = await readAiSettings(this.settings);
    try {
      const response = await this.client.messages.parse({
        model: cfg.model,
        max_tokens: 4096,
        system: MORNING_BRIEF_SYSTEM,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'medium',
          format: zodOutputFormat(BriefSchema),
        },
        messages: [{ role: 'user', content: morningBriefPrompt(input) }],
      });
      if (response.stop_reason === 'refusal' || !response.parsed_output) {
        this.logger.warn(
          `Morning brief fell back to heuristic (stop_reason=${response.stop_reason ?? 'none'}).`,
        );
        return this.heuristic.writeMorningBrief(input);
      }
      const parsed = response.parsed_output;
      return {
        headline: parsed.headline,
        bullets: parsed.bullets,
        actions: parsed.actions,
        provider: this.name,
        model: cfg.model,
        latency_ms: Date.now() - started,
      };
    } catch (err) {
      this.degradeOrRethrow(err, 'morning brief');
      return this.heuristic.writeMorningBrief(input);
    }
  }

  /**
   * Most-specific-first, and `APIConnectionError` before `APIError` (it is a
   * subclass in the TS SDK). Every Anthropic-shaped branch degrades; anything
   * that is not an SDK error is a bug in this file and is rethrown.
   */
  private degradeOrRethrow(err: unknown, surface: string): void {
    if (err instanceof Anthropic.RateLimitError) {
      this.logger.warn(
        `Anthropic rate limited on ${surface}; using heuristic.`,
      );
    } else if (err instanceof Anthropic.APIConnectionError) {
      this.logger.warn(`Anthropic unreachable on ${surface}; using heuristic.`);
    } else if (err instanceof Anthropic.APIError) {
      this.logger.error(
        `Anthropic error ${err.status ?? 'unknown'} on ${surface}; using heuristic.`,
      );
    } else {
      throw err;
    }
  }
}
