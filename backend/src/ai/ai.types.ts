/**
 * SPEC §1.2 / RUN-05 — the AI port and its payloads.
 *
 * These are plain interfaces, deliberately *not* Prisma model types (plan
 * decision 1 and the P5a `shipping.types.ts` precedent): the providers must
 * compile and unit-test before the `EvidenceReviewSuggestion` model lands, and
 * the callers map their rows onto these shapes at the boundary.
 *
 * Nothing here can express a decision. A verdict is a *suggestion*; the only
 * writers of `Evidence`'s approval column stay `EvidenceService` and
 * `ApprovalsService`, and `ai-boundaries.spec.ts` proves it off disk.
 */

/** What the assist is asked about. Plain data — never a Prisma row. */
export interface EvidenceAssistInput {
  evidence_id: string;
  task_title: string;
  task_description: string | null;
  evidence_type: string;
  evidence_notes: string | null;
  evidence_url: string;
  /** `bridge` evidence was written by the system from a real ops event. */
  source: 'manual' | 'bridge';
  bridge_event: string | null;
  uploaded_by_name: string;
  /** How many times this task's evidence has already been rejected. */
  prior_rejections: number;
}

export type AssistVerdict = 'approve' | 'reject' | 'unsure';

export interface EvidenceAssistResult {
  verdict: AssistVerdict;
  /** 0..1 */
  confidence: number;
  /** One to four short, specific reasons. Never empty. */
  reasons: string[];
  provider: AiProviderName;
  model: string | null;
  latency_ms: number;
}

export interface MorningBriefInput {
  business_date: string; // YYYY-MM-DD, node-local
  readiness: { code: string; value: number; delta_7d: number }[];
  sales: {
    orders: number;
    revenue: number;
    by_channel: { channel: string; orders: number; revenue: number }[];
  };
  waste: { entries: number; cost: number };
  pending: { approvals: number; blockers: number; stale_decisions: number };
  shipments: { open: number; failed: number };
  low_stock: { ingredient: string; on_hand: number; minimum: number }[];
}

export interface MorningBriefResult {
  headline: string;
  /** Three to six bullets. Rendered verbatim; no markdown. */
  bullets: string[];
  /** Zero to three things a lead should do today. */
  actions: string[];
  provider: AiProviderName;
  model: string | null;
  latency_ms: number;
}

export type AiProviderName = 'anthropic' | 'heuristic';

export interface AiProviderPort {
  readonly name: AiProviderName;
  reviewEvidence(input: EvidenceAssistInput): Promise<EvidenceAssistResult>;
  writeMorningBrief(input: MorningBriefInput): Promise<MorningBriefResult>;
}

// ---------------------------------------------------------------------------
// The `SystemSetting['ai']` seam.
//
// The block itself is declared by `SETTING_DEFAULTS` in `settings.service.ts`
// (P6 Task 1). This module is typed against its own copy of the shape rather
// than against that object, for the same reason the payloads above are not
// Prisma types: the providers ship in the same wave that introduces the block
// and must compile and test without it. `readAiSettings` is the single reader,
// so when the row (or the whole key) is missing the module still answers with
// the seeded defaults instead of throwing into an advisory code path.
// ---------------------------------------------------------------------------

/** The allow-listed `SystemSetting` key holding the block below. */
export const AI_SETTING_KEY = 'ai';

export interface AiSettings {
  /** `heuristic` needs no key and is the seeded default (decision 1). */
  provider: AiProviderName;
  model: string;
  /** RUN-05 guard rail. Nothing reads this as permission to decide. */
  evidence_assist_enabled: boolean;
  morning_brief_enabled: boolean;
  /** Roles that receive the morning brief. */
  morning_brief_role_codes: string[];
}

export const AI_SETTINGS_DEFAULT: AiSettings = {
  provider: 'heuristic',
  model: 'claude-opus-5',
  evidence_assist_enabled: true,
  morning_brief_enabled: true,
  morning_brief_role_codes: [
    'FOUNDER_ADMIN',
    'BACKEND_LEAD',
    'FRONTEND_LEAD',
    'BI_LEAD',
    'PROCUREMENT_LEAD',
  ],
};

/**
 * The slice of `SettingsService` this module needs. Structural on purpose —
 * `SettingsService.get` is keyed on `SettingKey`, and depending on that union
 * here would couple wave 1's two tasks together for no behavioural gain.
 */
export interface AiSettingsReader {
  get(key: string): Promise<unknown>;
}

function isBlock(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function stringArray(value: unknown, fallback: string[]): string[] {
  return isStringArray(value) ? value : fallback;
}

/** Layers a stored block over `AI_SETTINGS_DEFAULT`, field by field. */
export function coerceAiSettings(raw: unknown): AiSettings {
  if (!isBlock(raw)) return { ...AI_SETTINGS_DEFAULT };
  return {
    provider:
      raw.provider === 'anthropic' || raw.provider === 'heuristic'
        ? raw.provider
        : AI_SETTINGS_DEFAULT.provider,
    model:
      typeof raw.model === 'string' && raw.model.trim().length > 0
        ? raw.model
        : AI_SETTINGS_DEFAULT.model,
    evidence_assist_enabled:
      typeof raw.evidence_assist_enabled === 'boolean'
        ? raw.evidence_assist_enabled
        : AI_SETTINGS_DEFAULT.evidence_assist_enabled,
    morning_brief_enabled:
      typeof raw.morning_brief_enabled === 'boolean'
        ? raw.morning_brief_enabled
        : AI_SETTINGS_DEFAULT.morning_brief_enabled,
    morning_brief_role_codes: stringArray(
      raw.morning_brief_role_codes,
      AI_SETTINGS_DEFAULT.morning_brief_role_codes,
    ),
  };
}

/**
 * Reads `SystemSetting['ai']` and never throws. An unknown key, an absent row
 * or an unreachable database all resolve to the declared defaults: every P6 AI
 * path is advisory, and a settings read must not be the thing that breaks an
 * evidence board or a nightly cron.
 */
export async function readAiSettings(
  reader: AiSettingsReader,
): Promise<AiSettings> {
  try {
    return coerceAiSettings(await reader.get(AI_SETTING_KEY));
  } catch {
    return { ...AI_SETTINGS_DEFAULT };
  }
}
