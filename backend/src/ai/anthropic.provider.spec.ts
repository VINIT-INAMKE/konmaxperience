import Anthropic from '@anthropic-ai/sdk';
import { AnthropicProvider } from './anthropic.provider';
import { HeuristicProvider } from './heuristic.provider';
import { AI_SETTINGS_DEFAULT } from './ai.types';
import type { SettingsService } from '../settings/settings.service';
import type { EvidenceAssistInput, MorningBriefInput } from './ai.types';

const ASSIST_INPUT: EvidenceAssistInput = {
  evidence_id: 'ev-1',
  task_title: 'Close the kitchen',
  task_description: null,
  evidence_type: 'image',
  evidence_notes: 'Closing photo of the pass after the deep clean.',
  evidence_url: 'https://r2.example/ev-1.jpg',
  source: 'manual',
  bridge_event: null,
  uploaded_by_name: 'Kitchen Lead',
  prior_rejections: 0,
};

const BRIEF_INPUT: MorningBriefInput = {
  business_date: '2026-08-24',
  readiness: [{ code: 'SALES', value: 72, delta_7d: 6 }],
  sales: {
    orders: 18,
    revenue: 24350.5,
    by_channel: [{ channel: 'storefront', orders: 18, revenue: 24350.5 }],
  },
  waste: { entries: 1, cost: 100 },
  pending: { approvals: 4, blockers: 2, stale_decisions: 0 },
  shipments: { open: 5, failed: 1 },
  low_stock: [],
};

function settingsDouble() {
  return {
    get: jest
      .fn()
      .mockResolvedValue({ ...AI_SETTINGS_DEFAULT, provider: 'anthropic' }),
  } as unknown as SettingsService;
}

/** The client is a private field; replacing it is how the network stays out of jest. */
function withClient(provider: AnthropicProvider, parse: jest.Mock): jest.Mock {
  (provider as unknown as { client: unknown }).client = { messages: { parse } };
  return parse;
}

/**
 * What the request actually carried. Deliberately loose — the point is to assert
 * on fields the SDK types would let us omit, `budget_tokens` above all.
 */
interface ObservedParams {
  model?: unknown;
  max_tokens?: unknown;
  system?: unknown;
  stream?: unknown;
  budget_tokens?: unknown;
  thinking?: Record<string, unknown>;
  output_config?: Record<string, unknown>;
  messages?: { role?: unknown; content?: unknown }[];
}

function paramsOf(parse: jest.Mock, index = 0): ObservedParams {
  const calls = parse.mock.calls as unknown[][];
  return calls[index][0] as ObservedParams;
}

function build(): {
  provider: AnthropicProvider;
  heuristic: HeuristicProvider;
} {
  const heuristic = new HeuristicProvider();
  const provider = new AnthropicProvider(settingsDouble(), heuristic);
  return { provider, heuristic };
}

describe('AnthropicProvider', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  describe('with no ANTHROPIC_API_KEY (the supported production state)', () => {
    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('constructs without throwing and reports itself unconfigured', () => {
      const { provider } = build();
      expect(provider.name).toBe('anthropic');
      expect(provider.configured).toBe(false);
    });

    it('lands every evidence assist on the heuristic', async () => {
      const { provider } = build();
      const result = await provider.reviewEvidence(ASSIST_INPUT);
      expect(result.provider).toBe('heuristic');
      expect(result.model).toBeNull();
    });

    it('lands every morning brief on the heuristic', async () => {
      const { provider } = build();
      const result = await provider.writeMorningBrief(BRIEF_INPUT);
      expect(result.provider).toBe('heuristic');
      expect(result.headline).toContain('2026-08-24');
    });
  });

  describe('with a client', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    });

    it('returns a valid parsed_output verbatim', async () => {
      const { provider } = build();
      withClient(
        provider,
        jest.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          parsed_output: {
            verdict: 'approve',
            confidence: 0.91,
            reasons: [
              'The photo shows the pass wiped down and the log signed.',
            ],
          },
        }),
      );

      const result = await provider.reviewEvidence(ASSIST_INPUT);
      expect(result).toMatchObject({
        verdict: 'approve',
        confidence: 0.91,
        reasons: ['The photo shows the pass wiped down and the log signed.'],
        provider: 'anthropic',
        model: 'claude-opus-5',
      });
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('sends the pinned call shape — adaptive thinking, effort in output_config, no budget_tokens, no prefill', async () => {
      const { provider } = build();
      const parse = withClient(
        provider,
        jest.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          parsed_output: { verdict: 'unsure', confidence: 0.5, reasons: ['x'] },
        }),
      );

      await provider.reviewEvidence(ASSIST_INPUT);
      const params = paramsOf(parse);
      expect(params.model).toBe('claude-opus-5');
      expect(params.max_tokens).toBe(2048);
      expect(params.thinking).toEqual({ type: 'adaptive' });
      expect(params.output_config?.effort).toBe('low');
      expect(params.output_config?.format).toBeDefined();
      expect(params.budget_tokens).toBeUndefined();
      expect(params.thinking?.budget_tokens).toBeUndefined();
      expect(params.stream).toBeUndefined();
      // No assistant prefill: the only message is the user turn.
      expect(params.messages).toHaveLength(1);
      expect(params.messages?.[0].role).toBe('user');
      expect(typeof params.system).toBe('string');
      expect(params.system).toContain('You never approve or reject anything');
    });

    it('uses medium effort and 4096 tokens for the morning brief', async () => {
      const { provider } = build();
      const parse = withClient(
        provider,
        jest.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          parsed_output: {
            headline: 'Quiet Monday',
            bullets: ['a', 'b', 'c'],
            actions: ['Clear approvals.'],
          },
        }),
      );

      const result = await provider.writeMorningBrief(BRIEF_INPUT);
      const params = paramsOf(parse);
      expect(params.max_tokens).toBe(4096);
      expect(params.output_config?.effort).toBe('medium');
      expect(params.thinking).toEqual({ type: 'adaptive' });
      expect(result).toMatchObject({
        headline: 'Quiet Monday',
        bullets: ['a', 'b', 'c'],
        actions: ['Clear approvals.'],
        provider: 'anthropic',
        model: 'claude-opus-5',
      });
    });

    it('falls back to the heuristic on a refusal stop reason', async () => {
      const { provider } = build();
      withClient(
        provider,
        jest.fn().mockResolvedValue({
          stop_reason: 'refusal',
          stop_details: { type: 'refusal', category: 'cyber' },
          parsed_output: null,
        }),
      );

      const result = await provider.reviewEvidence(ASSIST_INPUT);
      expect(result.provider).toBe('heuristic');
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('falls back when the body cannot be parsed against the schema', async () => {
      const { provider } = build();
      withClient(
        provider,
        jest
          .fn()
          .mockResolvedValue({ stop_reason: 'end_turn', parsed_output: null }),
      );

      const result = await provider.writeMorningBrief(BRIEF_INPUT);
      expect(result.provider).toBe('heuristic');
    });

    it('falls back on a rate limit', async () => {
      const { provider } = build();
      withClient(
        provider,
        jest
          .fn()
          .mockRejectedValue(
            new Anthropic.RateLimitError(
              429,
              undefined,
              'rate limited',
              new Headers(),
            ),
          ),
      );

      const result = await provider.reviewEvidence(ASSIST_INPUT);
      expect(result.provider).toBe('heuristic');
    });

    it('falls back when Anthropic is unreachable', async () => {
      const { provider } = build();
      withClient(
        provider,
        jest
          .fn()
          .mockRejectedValue(
            new Anthropic.APIConnectionError({ message: 'ECONNRESET' }),
          ),
      );

      const result = await provider.writeMorningBrief(BRIEF_INPUT);
      expect(result.provider).toBe('heuristic');
    });

    it('falls back on any other API error', async () => {
      const { provider } = build();
      withClient(
        provider,
        jest
          .fn()
          .mockRejectedValue(
            new Anthropic.APIError(500, undefined, 'overloaded', undefined),
          ),
      );

      const result = await provider.reviewEvidence(ASSIST_INPUT);
      expect(result.provider).toBe('heuristic');
    });

    it('rethrows a non-SDK error rather than hiding a bug in this file', async () => {
      const { provider } = build();
      withClient(
        provider,
        jest.fn().mockRejectedValue(new TypeError('cfg.model is not a string')),
      );

      await expect(provider.reviewEvidence(ASSIST_INPUT)).rejects.toThrow(
        TypeError,
      );
    });

    it('re-reads the model setting on every call', async () => {
      const heuristic = new HeuristicProvider();
      const settings = settingsDouble();
      const provider = new AnthropicProvider(settings, heuristic);
      const parse = withClient(
        provider,
        jest.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          parsed_output: { verdict: 'unsure', confidence: 0.4, reasons: ['x'] },
        }),
      );

      await provider.reviewEvidence(ASSIST_INPUT);
      (settings.get as unknown as jest.Mock).mockResolvedValueOnce({
        ...AI_SETTINGS_DEFAULT,
        provider: 'anthropic',
        model: 'claude-sonnet-5',
      });
      const second = await provider.reviewEvidence(ASSIST_INPUT);

      expect(paramsOf(parse, 0).model).toBe('claude-opus-5');
      expect(paramsOf(parse, 1).model).toBe('claude-sonnet-5');
      expect(second.model).toBe('claude-sonnet-5');
    });

    it('falls back to the declared defaults when the ai setting key is unknown', async () => {
      const heuristic = new HeuristicProvider();
      const settings = {
        get: jest.fn().mockRejectedValue(new Error('Invalid setting key: ai')),
      } as unknown as SettingsService;
      const provider = new AnthropicProvider(settings, heuristic);
      const parse = withClient(
        provider,
        jest.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          parsed_output: { verdict: 'unsure', confidence: 0.4, reasons: ['x'] },
        }),
      );

      await expect(
        provider.reviewEvidence(ASSIST_INPUT),
      ).resolves.toBeDefined();
      expect(paramsOf(parse).model).toBe('claude-opus-5');
    });
  });
});
