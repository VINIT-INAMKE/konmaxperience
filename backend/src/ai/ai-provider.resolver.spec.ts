import { AiProviderResolver } from './ai-provider.resolver';
import { AnthropicProvider } from './anthropic.provider';
import { HeuristicProvider } from './heuristic.provider';
import { AI_SETTINGS_DEFAULT } from './ai.types';
import type { SettingsService } from '../settings/settings.service';

function build(get: jest.Mock) {
  const settings = { get } as unknown as SettingsService;
  const heuristic = new HeuristicProvider();
  const anthropic = new AnthropicProvider(settings, heuristic);
  return {
    resolver: new AiProviderResolver(settings, anthropic, heuristic),
    anthropic,
    heuristic,
    get,
  };
}

describe('AiProviderResolver', () => {
  it('returns the heuristic provider on the seeded default', async () => {
    const { resolver, heuristic } = build(
      jest.fn().mockResolvedValue({ ...AI_SETTINGS_DEFAULT }),
    );
    await expect(resolver.get()).resolves.toBe(heuristic);
  });

  it('returns the Anthropic provider when the setting says so', async () => {
    const { resolver, anthropic } = build(
      jest
        .fn()
        .mockResolvedValue({ ...AI_SETTINGS_DEFAULT, provider: 'anthropic' }),
    );
    await expect(resolver.get()).resolves.toBe(anthropic);
  });

  it('re-reads the setting on every call so an operator can flip it live', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({ ...AI_SETTINGS_DEFAULT })
      .mockResolvedValueOnce({
        ...AI_SETTINGS_DEFAULT,
        provider: 'anthropic',
      })
      .mockResolvedValueOnce({ ...AI_SETTINGS_DEFAULT });
    const { resolver, anthropic, heuristic } = build(get);

    await expect(resolver.get()).resolves.toBe(heuristic);
    await expect(resolver.get()).resolves.toBe(anthropic);
    await expect(resolver.get()).resolves.toBe(heuristic);
    expect(get).toHaveBeenCalledTimes(3);
    expect(get).toHaveBeenCalledWith('ai');
  });

  it('falls back to the heuristic when the block is absent or malformed', async () => {
    for (const stored of [
      undefined,
      null,
      'anthropic',
      [],
      { provider: 'x' },
    ]) {
      const { resolver, heuristic } = build(
        jest.fn().mockResolvedValue(stored),
      );
      await expect(resolver.get()).resolves.toBe(heuristic);
    }
  });

  it('falls back to the heuristic when the settings read throws', async () => {
    const { resolver, heuristic } = build(
      jest.fn().mockRejectedValue(new Error('Invalid setting key: ai')),
    );
    await expect(resolver.get()).resolves.toBe(heuristic);
  });

  it('exposes the whole block, defaulted field by field', async () => {
    const { resolver } = build(
      jest.fn().mockResolvedValue({
        provider: 'anthropic',
        morning_brief_enabled: false,
      }),
    );
    await expect(resolver.settings()).resolves.toEqual({
      provider: 'anthropic',
      model: 'claude-opus-5',
      evidence_assist_enabled: true,
      morning_brief_enabled: false,
      morning_brief_role_codes: AI_SETTINGS_DEFAULT.morning_brief_role_codes,
    });
  });
});
