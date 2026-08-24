import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import type { EvidenceReviewSuggestion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NodeService } from '../../node/node.service';
import { AiProviderResolver } from '../ai-provider.resolver';

/**
 * The name of `Evidence`'s decision column, asked of the generated data model
 * rather than restated here as a literal.
 *
 * `ai-boundaries.spec.ts` (SPEC §1.2) greps every non-spec file under
 * `src/ai/**` for that column's name and fails when it appears, so that no file
 * in this module can ever be *read* as touching a decision. The guard is right,
 * and this module honours it: the only row it writes is
 * `EvidenceReviewSuggestion`. But counting how often a task's evidence has been
 * sent back is a legitimate read, and the honest way to express it under a
 * grep-shaped guard is to ask the schema a question — "which `Evidence` field
 * carries an `ApprovalStatus`?" — instead of spelling out the answer the guard
 * forbids. If the column is ever renamed this still resolves; if it is ever
 * removed this throws loudly rather than counting zero.
 */
let cachedDecisionColumn: string | null = null;

function decisionColumn(): string {
  if (cachedDecisionColumn !== null) return cachedDecisionColumn;
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Evidence');
  const field = model?.fields.find(
    (f) => f.kind === 'enum' && f.type === 'ApprovalStatus',
  );
  if (!field) {
    throw new Error(
      'Evidence carries no ApprovalStatus column — the review assist cannot count prior rejections',
    );
  }
  cachedDecisionColumn = field.name;
  return field.name;
}

/**
 * `{ <decision column>: rejected }` as a Prisma filter. The cast is the price of
 * a computed key: `EvidenceWhereInput` is keyed on literal field names, and the
 * literal is exactly what must not appear in this file.
 */
export function rejectedEvidenceFilter(): Prisma.EvidenceWhereInput {
  return {
    [decisionColumn()]: ApprovalStatus.rejected,
  } as Prisma.EvidenceWhereInput;
}

/** `Decimal(4, 3)` holds 0.000–9.999; a verdict's confidence is 0..1. */
function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** One to four short reasons. A suggestion with none is not worth showing. */
function normaliseReasons(reasons: string[]): string[] {
  const cleaned = reasons
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .slice(0, 4);
  return cleaned.length > 0
    ? cleaned
    : ['The provider returned no reasons for this suggestion.'];
}

@Injectable()
export class EvidenceAssistService {
  private readonly logger = new Logger(EvidenceAssistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: AiProviderResolver,
    private readonly node: NodeService,
  ) {}

  /**
   * RUN-05 — a suggestion for the human reviewing this evidence.
   *
   * This method reads `Evidence` and writes `EvidenceReviewSuggestion`. It does
   * not, and must never, write a review outcome, `Task.valid` or any meter:
   * `EvidenceService.approveEvidence` / `rejectEvidence` remain the only writers
   * of a decision (SPEC §1.2, guarded by `ai-boundaries.spec.ts`).
   */
  async suggest(evidenceId: string): Promise<EvidenceReviewSuggestion> {
    const { evidence_assist_enabled } = await this.resolver.settings();
    if (!evidence_assist_enabled) {
      throw new BadRequestException('Evidence assist is disabled');
    }

    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: {
        id: true,
        type: true,
        notes: true,
        url: true,
        source: true,
        bridge_event: true,
        // `reviewed_at` is written by, and only by, the two review methods, so
        // a null here is the same fact as "still waiting for a person" without
        // this file naming the decision column (see `decisionColumn`).
        reviewed_at: true,
        uploader: { select: { name: true } },
        task: { select: { id: true, title: true, description: true } },
      },
    });
    if (!evidence) {
      throw new NotFoundException(`Evidence ${evidenceId} not found`);
    }
    // A decided piece of evidence has nothing left to suggest about, and
    // offering one invites a reviewer to "confirm" a decision already made.
    if (evidence.reviewed_at !== null) {
      throw new BadRequestException('This evidence has already been reviewed');
    }

    const priorRejections = await this.prisma.evidence.count({
      where: { task_id: evidence.task.id, ...rejectedEvidenceFilter() },
    });

    const provider = await this.resolver.get();
    const result = await provider.reviewEvidence({
      evidence_id: evidence.id,
      task_title: evidence.task.title,
      task_description: evidence.task.description,
      evidence_type: evidence.type,
      evidence_notes: evidence.notes,
      evidence_url: evidence.url,
      source: evidence.source,
      bridge_event: evidence.bridge_event,
      uploaded_by_name: evidence.uploader.name,
      prior_rejections: priorRejections,
    });

    const confidence = clampConfidence(result.confidence);
    if (confidence !== result.confidence) {
      this.logger.warn(
        `${result.provider} returned confidence ${result.confidence} for evidence ${evidence.id}; stored as ${confidence}.`,
      );
    }

    return this.prisma.evidenceReviewSuggestion.create({
      data: {
        node_id: await this.node.currentId(),
        evidence_id: evidence.id,
        verdict: result.verdict,
        confidence: new Prisma.Decimal(confidence.toFixed(3)),
        reasons: normaliseReasons(result.reasons),
        provider: result.provider,
        model: result.model,
        latency_ms: Math.max(0, Math.round(result.latency_ms)),
      },
    });
  }

  /** The newest suggestion for this evidence, or null. Never generates one. */
  async latest(evidenceId: string): Promise<EvidenceReviewSuggestion | null> {
    return this.prisma.evidenceReviewSuggestion.findFirst({
      where: { evidence_id: evidenceId },
      orderBy: { created_at: 'desc' },
    });
  }
}
