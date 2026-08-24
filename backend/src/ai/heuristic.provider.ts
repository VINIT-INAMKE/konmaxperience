import { Injectable } from '@nestjs/common';
import type {
  AiProviderPort,
  EvidenceAssistInput,
  EvidenceAssistResult,
  MorningBriefInput,
  MorningBriefResult,
} from './ai.types';

/**
 * The deterministic half of RUN-05. It is not a stub: with no `ANTHROPIC_API_KEY`
 * this is what ships, so its output has to be genuinely useful. It encodes the
 * rules a reviewer applies before reading the attachment — where the evidence
 * came from, whether it says anything, and whether this task has already been
 * bounced — and it is honest about uncertainty rather than guessing.
 *
 * No network, no clock beyond `Date.now()`, no randomness: the same input twice
 * gives the same answer, which is what makes it a fallback you can reason about.
 */
@Injectable()
export class HeuristicProvider implements AiProviderPort {
  readonly name = 'heuristic' as const;

  async reviewEvidence(
    input: EvidenceAssistInput,
  ): Promise<EvidenceAssistResult> {
    const started = Date.now();
    const reasons: string[] = [];
    let score = 0;

    if (input.source === 'bridge') {
      score += 2;
      reasons.push(
        `Written by the mission bridge from a real ${input.bridge_event ?? 'ops'} event, not typed by hand.`,
      );
    } else {
      reasons.push(
        'Uploaded manually — the attachment itself still needs a human eye.',
      );
    }

    const noteLength = (input.evidence_notes ?? '').trim().length;
    if (noteLength === 0) {
      score -= 2;
      reasons.push('No note explaining what this proves.');
    } else if (noteLength < 20) {
      score -= 1;
      reasons.push('The note is too short to tie the file to the task.');
    } else {
      score += 1;
    }

    if (input.evidence_type === 'note' && noteLength < 60) {
      score -= 1;
      reasons.push('A note-only submission carries no artefact.');
    }
    if (input.evidence_type === 'image' || input.evidence_type === 'document') {
      score += 1;
    }

    if (input.prior_rejections > 0) {
      score -= input.prior_rejections;
      reasons.push(
        `This task has already had ${input.prior_rejections} piece(s) of evidence rejected.`,
      );
    }

    const verdict = score >= 2 ? 'approve' : score <= -2 ? 'reject' : 'unsure';
    // Banded, never 0 and never 1 — a heuristic must not present as certain.
    const confidence =
      verdict === 'unsure'
        ? 0.35
        : Math.min(0.75, 0.45 + Math.abs(score) * 0.1);

    return {
      verdict,
      confidence,
      reasons: reasons.slice(0, 4),
      provider: this.name,
      model: null,
      latency_ms: Date.now() - started,
    };
  }

  async writeMorningBrief(
    input: MorningBriefInput,
  ): Promise<MorningBriefResult> {
    const started = Date.now();
    const bullets: string[] = [];

    bullets.push(
      `${input.sales.orders} order(s) for ₹${input.sales.revenue.toFixed(2)} across ` +
        `${input.sales.by_channel.length} channel(s).`,
    );
    const movers = [...input.readiness]
      .sort((a, b) => Math.abs(b.delta_7d) - Math.abs(a.delta_7d))
      .slice(0, 2)
      .filter((m) => m.delta_7d !== 0);
    for (const m of movers) {
      bullets.push(
        `${m.code} is ${m.value.toFixed(0)}% (${m.delta_7d > 0 ? '+' : ''}${m.delta_7d.toFixed(0)} over 7 days).`,
      );
    }
    if (input.waste.entries > 0) {
      bullets.push(
        `${input.waste.entries} waste entr(ies) costing ₹${input.waste.cost.toFixed(2)}.`,
      );
    }
    if (input.shipments.failed > 0) {
      bullets.push(`${input.shipments.failed} shipment(s) failed or went RTO.`);
    }
    if (input.low_stock.length > 0) {
      bullets.push(`${input.low_stock.length} ingredient(s) below minimum.`);
    }

    const actions: string[] = [];
    if (input.pending.approvals > 0) {
      actions.push(`Clear ${input.pending.approvals} waiting approval(s).`);
    }
    if (input.pending.blockers > 0) {
      actions.push(`Unblock ${input.pending.blockers} task(s).`);
    }
    if (input.shipments.failed > 0) {
      actions.push('Re-run the failed shipments from the Shipments queue.');
    }

    return {
      headline: `${input.business_date}: ${input.sales.orders} orders, ${input.pending.approvals} approvals waiting`,
      bullets: bullets.slice(0, 6),
      actions: actions.slice(0, 3),
      provider: this.name,
      model: null,
      latency_ms: Date.now() - started,
    };
  }
}
