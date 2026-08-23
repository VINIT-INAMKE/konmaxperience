import { Injectable, Logger } from '@nestjs/common';
import {
  BridgeOutcome,
  EvidenceSource,
  EvidenceType,
  TaskSubjectType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_USER_ID } from '../common/constants/system-actor';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { hasPrismaCode } from '../common/utils/transaction-retry';
import type { Tx } from '../common/types/transaction';
import { bridgeDeepLink, renderBridgeNote } from './bridge-links';
import {
  RULES_BY_EVENT,
  type BridgeRule,
  type BridgeSelection,
} from './mission-bridge.rules';
import type {
  DomainEventName,
  DomainEventPayloads,
} from '../common/events/domain-events';

export interface BridgeSubject {
  subject_type: TaskSubjectType;
  subject_id: string;
  /** Explicit task link when the source row carries one (PO/Decision). */
  explicit_task_id?: string | null;
}

/** What a rule application reports back to the `BridgeDispatch` ledger row. */
export interface BridgeDispatchResult {
  outcome: BridgeOutcome;
  task_id?: string | null;
  evidence_id?: string | null;
  detail?: string;
}

/**
 * SPEC §4.2 — the one-directional bridge from operations to the mission layer.
 * Ops services emit typed domain events after commit; `MissionBridgeListener`
 * is the only subscriber that writes. Every rule application is claimed by a
 * `BridgeDispatch` row whose `@@unique([rule_key, source_type, source_id])`
 * makes a replayed event a no-op, and nothing here ever throws at the caller.
 *
 * This phase implements the *evidence* half of a rule. Task 12 adds the
 * `signal` (ReadinessSignal + derived recompute) and `spawn` halves inside
 * `applyRule` — the single seam every rule flows through.
 */
@Injectable()
export class MissionBridgeService {
  private readonly logger = new Logger(MissionBridgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Entry point ───────────────────────────────────────────────────────────

  /**
   * Entry point for every subscribed event. Never throws and never rejects:
   * each rule goes through `dispatchOnce`, which catches everything.
   */
  async apply<K extends DomainEventName>(
    event: K,
    payload: DomainEventPayloads[K],
  ): Promise<void> {
    const rules = RULES_BY_EVENT.get(event) ?? [];
    for (const rule of rules) {
      await this.applyOne(rule, payload);
    }
  }

  private async applyOne(
    rule: BridgeRule,
    payload: DomainEventPayloads[DomainEventName],
  ): Promise<void> {
    let picked: BridgeSelection;
    try {
      picked = rule.select(payload);
    } catch (err) {
      this.logger.warn(
        `bridge ${rule.key} could not read its payload: ${String(err)}`,
      );
      return;
    }
    if (!picked.subject_id) {
      this.logger.debug(
        `bridge ${rule.key} skipped: payload carries no subject id`,
      );
      return;
    }

    const subject: BridgeSubject = {
      subject_type: rule.subject_type,
      subject_id: picked.subject_id,
      explicit_task_id: picked.explicit_task_id,
    };
    const nodeId = payload.node_id || DEFAULT_NODE_ID;

    await this.dispatchOnce(rule.key, rule.event, subject, nodeId, (tx) =>
      this.applyRule(tx, rule, subject, picked),
    );
  }

  /**
   * The body of one rule, inside the dispatch transaction. Task 12 extends this
   * with the `signal` and `spawn` halves; everything before and after it —
   * claim, idempotency, ledger update, failure isolation — stays untouched.
   */
  protected async applyRule(
    tx: Tx,
    rule: BridgeRule,
    subject: BridgeSubject,
    picked: BridgeSelection,
  ): Promise<BridgeDispatchResult> {
    const taskId = await this.resolveTaskId(tx, subject);
    if (rule.evidence && !taskId) {
      return {
        outcome: BridgeOutcome.skipped_no_task,
        detail: 'no open task for subject',
      };
    }
    const evidenceId =
      rule.evidence && taskId
        ? await this.createBridgeEvidence(
            tx,
            taskId,
            rule,
            subject,
            picked.values,
          )
        : null;
    return {
      outcome: BridgeOutcome.applied,
      task_id: taskId,
      evidence_id: evidenceId,
    };
  }

  // ─── Subject resolution ────────────────────────────────────────────────────

  /**
   * SPEC §4.2 — a source entity resolves to a task via an explicit link
   * (`PurchaseOrder.linked_task_id`, `Decision.linked_task_id`) or via
   * `Task.subject_type/subject_id` (indexed by `@@index([subject_type, subject_id])`).
   * The newest matching open task wins; a validated task is never re-evidenced.
   */
  async resolveTaskId(tx: Tx, subject: BridgeSubject): Promise<string | null> {
    if (subject.explicit_task_id) return subject.explicit_task_id;
    const task = await tx.task.findFirst({
      where: {
        subject_type: subject.subject_type,
        subject_id: subject.subject_id,
        valid: false,
      },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
    return task?.id ?? null;
  }

  // ─── Exactly-once dispatch ─────────────────────────────────────────────────

  /**
   * Runs `fn` exactly once for `(rule_key, source_type, source_id)`. The
   * `BridgeDispatch` insert is the lock: a replayed event hits the unique index
   * (P2002) and returns `null` without doing any work.
   *
   * A genuine failure rolls the claim back with the work, so no ledger row is
   * written and a later re-emit may retry — only *decided* outcomes (applied,
   * skipped_*) are recorded and therefore permanent.
   */
  async dispatchOnce(
    ruleKey: string,
    event: string,
    subject: BridgeSubject,
    nodeId: string,
    fn: (tx: Tx) => Promise<BridgeDispatchResult>,
  ): Promise<BridgeDispatchResult | null> {
    try {
      return await this.prisma.$transaction(async (tx: Tx) => {
        const claim = await tx.bridgeDispatch.create({
          data: {
            node_id: nodeId,
            rule_key: ruleKey,
            event,
            source_type: subject.subject_type,
            source_id: subject.subject_id,
            outcome: BridgeOutcome.applied,
          },
          select: { id: true },
        });
        const result = await fn(tx);
        await tx.bridgeDispatch.update({
          where: { id: claim.id },
          data: {
            outcome: result.outcome,
            task_id: result.task_id ?? null,
            evidence_id: result.evidence_id ?? null,
            detail: result.detail ?? null,
          },
        });
        return result;
      });
    } catch (err) {
      if (hasPrismaCode(err, 'P2002')) {
        this.logger.debug(
          `bridge ${ruleKey} already dispatched for ${subject.subject_type}:${subject.subject_id}`,
        );
        return null;
      }
      // Failure isolation: the bridge must never fail the caller's request.
      this.logger.warn(`bridge ${ruleKey} failed: ${String(err)}`);
      return null;
    }
  }

  // ─── Bridge evidence ───────────────────────────────────────────────────────

  /**
   * SPEC §4.2 — bridge evidence: `type: system`, `source: bridge`, deep link,
   * rendered note, uploaded by the system user, `approval_status: pending`
   * (the schema default — humans still approve; the bridge only removes
   * re-typing).
   */
  async createBridgeEvidence(
    tx: Tx,
    taskId: string,
    rule: Pick<BridgeRule, 'key' | 'event' | 'note_template'>,
    subject: BridgeSubject,
    values: Record<string, string | number | null | undefined>,
  ): Promise<string> {
    const evidence = await tx.evidence.create({
      data: {
        task_id: taskId,
        uploaded_by: SYSTEM_USER_ID,
        type: EvidenceType.system,
        source: EvidenceSource.bridge,
        bridge_event: rule.event,
        url: bridgeDeepLink(subject.subject_type, subject.subject_id),
        notes: renderBridgeNote(rule.note_template, values),
      },
      select: { id: true },
    });
    return evidence.id;
  }

  // ─── Observability ─────────────────────────────────────────────────────────

  /** Backs `GET /mission-bridge/dispatches`. */
  async listDispatches(limit = 50, cursor?: string) {
    const before = cursor ? new Date(cursor) : null;
    const take = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 200)
      : 50;
    return this.prisma.bridgeDispatch.findMany({
      where:
        before && !Number.isNaN(before.getTime())
          ? { created_at: { lt: before } }
          : {},
      orderBy: { created_at: 'desc' },
      take,
    });
  }
}
