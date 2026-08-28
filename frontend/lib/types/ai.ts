/**
 * The two AI-assisted reads P6 exposes to a person.
 *
 * SPEC §1.2 is the line that shapes both: **a model may suggest, a person
 * decides.** Nothing in this file is a decision type — `EvidenceReviewSuggestion`
 * deliberately does not reuse `EvidenceApprovalStatus`, and no component may map
 * one onto the other. A suggestion is a second opinion printed next to the
 * buttons; it never moves them.
 */

/** The provider that produced a suggestion. `heuristic` is the no-key fallback. */
export type AiProvider = 'anthropic' | 'heuristic';

/**
 * A suggestion's verdict. Structurally identical to nothing else in the app on
 * purpose: `unsure` has no counterpart in `ApprovalStatus`, so the two vocabularies
 * cannot be silently interchanged.
 */
export type EvidenceAssistVerdict = 'approve' | 'reject' | 'unsure';

/**
 * A row of `EvidenceReviewSuggestion`.
 *
 * `confidence` arrives as a **string**: it is a Prisma `Decimal(4,3)` and the
 * JSON serialiser preserves it verbatim rather than risking a float. Read it
 * with `confidencePercent()`, never with a bare `Number(...)` at a call site.
 */
export interface EvidenceReviewSuggestion {
  id: string;
  node_id: string;
  evidence_id: string;
  verdict: EvidenceAssistVerdict;
  /** Decimal serialised as a string, `0`..`1`. */
  confidence: string;
  /** One to four short sentences. Rendered as a list, never concatenated. */
  reasons: string[];
  provider: AiProvider;
  /** `null` for the heuristic provider, which is not a model. */
  model: string | null;
  latency_ms: number;
  created_at: string;
}

/**
 * `GET /ai/morning-brief/latest` — the caller's newest `morning_brief`
 * notification, or `null` on a day with no brief.
 *
 * `body` is **pre-rendered plain text**: a headline line, `•` bullets, and
 * `→` actions under a "Today:" heading, separated by `\n`. It is rendered with
 * whitespace preserved and is never re-parsed into structure — the backend owns
 * that layout, and a second parser would be a second thing to keep in step.
 */
export interface MorningBrief {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  /** The business date the brief reports on, `YYYY-MM-DD`. */
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

/** A brief older than this reads as history, not as this morning's news. */
export const MORNING_BRIEF_STALE_HOURS = 36;

/**
 * `confidence` as a whole percentage, clamped to 0–100.
 *
 * A malformed or missing decimal yields `null` rather than `0`: a bar sitting
 * at zero is a claim about the model's certainty, and "we could not read it"
 * is not that claim.
 */
export function confidencePercent(confidence: string): number | null {
  const parsed = Number.parseFloat(confidence);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(Math.min(1, Math.max(0, parsed)) * 100);
}

export const ASSIST_VERDICT_LABELS: Record<EvidenceAssistVerdict, string> = {
  approve: 'Suggests approve',
  reject: 'Suggests reject',
  unsure: 'Not sure',
};

/**
 * The provenance line printed under every suggestion.
 *
 * The heuristic wording is not decoration. It is the difference between a
 * reviewer trusting a language model's reading of the evidence and a reviewer
 * knowing they are looking at a handful of rules about file type and history.
 */
export function assistProvenance(
  provider: AiProvider,
  model: string | null,
): string {
  if (provider === 'heuristic') {
    return 'Rule-based suggestion (no AI provider configured) — a person decides.';
  }
  return `Suggestion from ${provider}${model ? ` (${model})` : ''} — a person decides.`;
}
