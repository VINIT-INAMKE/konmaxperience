import { Injectable, Logger } from '@nestjs/common';
import {
  ActorType,
  ApprovalEntityType,
  ApprovalScope,
  BridgeOutcome,
  EvidenceSource,
  EvidenceType,
  MissionStatus,
  Prisma,
  TaskDomain,
  TaskPriority,
  TaskSubjectType,
  TaskType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalPolicyService } from '../approvals/approval-policy.service';
import { AuditService } from '../audit/audit.service';
import { ReadinessDerivationService } from '../readiness/readiness-derivation.service';
import { SYSTEM_USER_ID } from '../common/constants/system-actor';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { RoleCode } from '../types/roles';
import { hasPrismaCode } from '../common/utils/transaction-retry';
import type { Tx } from '../common/types/transaction';
import { bridgeDeepLink, renderBridgeNote } from './bridge-links';
import {
  RULES_BY_EVENT,
  type BridgeRule,
  type BridgeSelection,
  type BridgeSignal,
  type MeterCode,
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
 * Threaded through `applyRule` so a rule body can reach the raw event payload
 * (the spawn needs fields no `BridgeSelection` carries) and queue the meters it
 * touched. `recompute` is drained by `applyOne` *after* the dispatch
 * transaction commits — never inside it.
 */
interface BridgeRuleContext {
  node_id: string;
  payload: DomainEventPayloads[DomainEventName];
  recompute: Set<MeterCode>;
}

/**
 * SPEC §4.2 — "`feedback.received` with rating ≤ 2 → create
 * `Task{ task_type: improvement, … }`". Ratings are the 1–5 scale on `Feedback`.
 */
const LOW_RATING_THRESHOLD = 2;

/** Below this a guest is actively unhappy, so the spawned task jumps the queue. */
const CRITICAL_RATING_THRESHOLD = 1;

/**
 * SPEC §4.2 — the one-directional bridge from operations to the mission layer.
 * Ops services emit typed domain events after commit; `MissionBridgeListener`
 * is the only subscriber that writes. Every rule application is claimed by a
 * `BridgeDispatch` row whose `@@unique([rule_key, source_type, source_id])`
 * makes a replayed event a no-op, and nothing here ever throws at the caller.
 *
 * All three halves of a rule run inside `applyRule`, the single seam every rule
 * flows through: **evidence** (pending `Evidence{ source: bridge }`), **signal**
 * (a `ReadinessSignal` row plus a queued derived recompute) and **spawn** (the
 * one improvement task `feedback.received` creates). The recompute is the only
 * part that happens outside the transaction — see `applyOne`.
 */
@Injectable()
export class MissionBridgeService {
  private readonly logger = new Logger(MissionBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly derivation: ReadinessDerivationService,
    private readonly approvalPolicy: ApprovalPolicyService,
    private readonly audit: AuditService,
  ) {}

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
    const ctx: BridgeRuleContext = {
      node_id: nodeId,
      payload,
      recompute: new Set<MeterCode>(),
    };

    const result = await this.dispatchOnce(
      rule.key,
      rule.event,
      subject,
      nodeId,
      (tx) => this.applyRule(tx, rule, subject, picked, ctx),
    );

    // `null` means the claim lost to a replay or the transaction rolled back:
    // no signal was committed, so there is nothing to recompute.
    if (result) await this.drainRecomputes(rule, ctx.recompute);
  }

  /**
   * The body of one rule, inside the dispatch transaction. Everything around it
   * — claim, idempotency, ledger update, failure isolation — belongs to
   * `dispatchOnce`.
   *
   * SPEC §4.2 lists evidence, signal and task spawn as three independent rule
   * halves, and that independence is load-bearing here: **only evidence needs
   * the subject to resolve to an open task**. `stock.low` resolves to nothing
   * and must still move `PROCUREMENT`; a 1-star review arrives precisely
   * because nobody is working on the problem yet, so gating the spawn behind
   * "an open task already exists" would mean BRIDGE-04 never fires on a real
   * order. The no-task bail-out therefore comes last, and only when neither of
   * the other halves produced anything.
   */
  protected async applyRule(
    tx: Tx,
    rule: BridgeRule,
    subject: BridgeSubject,
    picked: BridgeSelection,
    ctx: BridgeRuleContext,
  ): Promise<BridgeDispatchResult> {
    const taskId = await this.resolveTaskId(tx, subject);

    if (rule.signal) {
      await this.writeSignal(tx, ctx.node_id, rule, rule.signal, subject);
      ctx.recompute.add(rule.signal.meter);
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

    const spawn =
      rule.spawn === 'low_rating_improvement'
        ? await this.spawnLowRatingTask(
            tx,
            ctx.node_id,
            ctx.payload as DomainEventPayloads['feedback.received'],
          )
        : null;

    // A spawn that could not run is the most specific thing the ledger can say.
    if (spawn && spawn.outcome !== BridgeOutcome.applied) {
      return { ...spawn, evidence_id: evidenceId };
    }
    if (rule.evidence && !taskId && !spawn?.task_id) {
      return {
        outcome: BridgeOutcome.skipped_no_task,
        detail: 'no open task for subject',
      };
    }
    // The spawned task is what the ledger points at when there is one; the
    // resolved task is the fallback, so the row is never link-less.
    return {
      outcome: BridgeOutcome.applied,
      task_id: spawn?.task_id ?? taskId,
      evidence_id: evidenceId,
      detail: spawn?.detail,
    };
  }

  /**
   * After commit, never inside: a derived recompute reads a lot of rows across
   * products, recipes, orders and waste, and must not extend the dispatch
   * transaction. Failures are logged and swallowed — a meter that is one event
   * stale is recovered by the next signal or by the nightly job.
   */
  private async drainRecomputes(
    rule: BridgeRule,
    meters: Set<MeterCode>,
  ): Promise<void> {
    for (const meter of meters) {
      try {
        await this.derivation.recomputeWithHybrids(meter);
      } catch (err) {
        this.logger.warn(
          `recompute of ${meter} after ${rule.key} failed: ${String(err)}`,
        );
      }
    }
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

  // ─── Readiness signal ──────────────────────────────────────────────────────

  /**
   * SPEC §4.2 "signal" — `ReadinessSignal{ meter_id, source_event, value }`,
   * written inside the dispatch transaction so a rolled-back dispatch leaves no
   * contribution behind. `source_type/source_id` mirror the ledger's own key,
   * which is what lets `GET /readiness-meters/:code/signals` show the entity
   * that moved the meter.
   *
   * A meter code that is not seeded on this node writes nothing and does not
   * throw: a mis-seeded meter must never break the bridge.
   */
  async writeSignal(
    tx: Tx,
    nodeId: string,
    rule: Pick<BridgeRule, 'event'>,
    signal: BridgeSignal,
    subject: BridgeSubject,
  ): Promise<void> {
    const meter = await tx.readinessMeter.findUnique({
      where: { node_id_code: { node_id: nodeId, code: signal.meter } },
      select: { id: true },
    });
    if (!meter) {
      this.logger.debug(
        `bridge signal skipped: meter ${signal.meter} is not seeded on node ${nodeId}`,
      );
      return;
    }
    await tx.readinessSignal.create({
      data: {
        node_id: nodeId,
        meter_id: meter.id,
        source_event: rule.event,
        source_type: subject.subject_type,
        source_id: subject.subject_id,
        value: new Prisma.Decimal(signal.value),
      },
    });
  }

  // ─── Improvement-task spawn ────────────────────────────────────────────────

  /**
   * SPEC §4.2 "task spawn" — `feedback.received` with rating ≤ 2 creates
   * `Task{ task_type: improvement, domain: food, owner: FRONTEND_LEAD,
   * subject: order }` **once per order**. The "once" is the ledger's:
   * `BridgeDispatch @@unique([rule_key, source_type, source_id])` with
   * `source_id = orderId`, so nothing here needs its own de-duplication.
   *
   * `Task.mission_id` and `Task.owner_user_id` are both required columns, so
   * the spawn needs an active mission and an active `FRONTEND_LEAD`. When
   * either is missing the dispatch is *recorded* as skipped rather than
   * throwing — a rolled-back dispatch would silently retry forever, while a
   * `skipped_no_mission` row says exactly why no task exists.
   *
   * The task row is written through Prisma directly rather than through
   * `TasksService.create`: that method takes a `CreateTaskDto` and an acting
   * user id and cannot express `subject_type`/`subject_id`, and importing
   * `TasksModule` here would point the bridge back at the module that emits
   * into it. The column set below mirrors `tasks.service.ts` `create()`.
   */
  private async spawnLowRatingTask(
    tx: Tx,
    nodeId: string,
    payload: DomainEventPayloads['feedback.received'],
  ): Promise<BridgeDispatchResult> {
    if (payload.rating > LOW_RATING_THRESHOLD) {
      return {
        outcome: BridgeOutcome.applied,
        detail: 'rating above threshold, no task spawned',
      };
    }

    const mission = await tx.mission.findFirst({
      where: { node_id: nodeId, status: MissionStatus.active },
      orderBy: { start_date: 'desc' },
      select: { id: true },
    });
    if (!mission) {
      return {
        outcome: BridgeOutcome.skipped_no_mission,
        detail: 'no active mission',
      };
    }

    // `status: 'active'` also excludes the system user (`status: 'system'`),
    // so the bridge can never end up owning its own task.
    const owner = await tx.user.findFirst({
      where: { status: 'active', role: { code: RoleCode.FRONTEND_LEAD } },
      select: { id: true },
    });
    if (!owner) {
      return {
        outcome: BridgeOutcome.skipped_no_owner,
        detail: 'no active FRONTEND_LEAD',
      };
    }

    const comment = payload.comment?.trim();
    const task = await tx.task.create({
      data: {
        node_id: nodeId,
        mission_id: mission.id,
        title: `Follow up on ${payload.rating}-star feedback`,
        description:
          `A guest rated order ${payload.orderId ?? '(unknown)'} ${payload.rating}/5.` +
          (comment ? ` They said: "${comment}"` : '') +
          ' Find the cause, fix it, and attach the evidence.',
        task_type: TaskType.improvement,
        domain: TaskDomain.food,
        owner_user_id: owner.id,
        created_by: SYSTEM_USER_ID,
        priority:
          payload.rating <= CRITICAL_RATING_THRESHOLD
            ? TaskPriority.high
            : TaskPriority.medium,
        subject_type: TaskSubjectType.order,
        subject_id: payload.orderId ?? payload.feedbackId,
        requires_approval: true,
      },
      select: { id: true, domain: true },
    });

    // The spawned task is approval-gated like any other (SPEC §4.4).
    await this.approvalPolicy.materialise(
      tx,
      {
        entity_type: ApprovalEntityType.task,
        entity_id: task.id,
        scope: ApprovalScope.task,
        domain: task.domain,
      },
      nodeId,
    );
    await this.audit.record(tx, {
      node_id: nodeId,
      entity_type: 'task',
      entity_id: task.id,
      action: 'task.spawned_by_bridge',
      actor_type: ActorType.system,
      actor_id: null,
      after: {
        rule: 'low_rating_improvement',
        rating: payload.rating,
        order_id: payload.orderId,
      },
    });

    return { outcome: BridgeOutcome.applied, task_id: task.id };
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
