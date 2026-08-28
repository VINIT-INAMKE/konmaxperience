import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApprovalEntityType,
  ApprovalMode,
  ApprovalScope,
  ApprovalStatus,
  Prisma,
  TaskDomain,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { RoleCode } from '../types/roles';
import type { Tx } from '../common/types/transaction';
import { CreateApprovalPolicyDto } from './dto/create-approval-policy.dto';
import { UpdateApprovalPolicyDto } from './dto/update-approval-policy.dto';
import {
  BACKFILL_VALIDATION_PORT,
  type BackfillValidationPort,
} from './backfill-validation.port';

/**
 * SPEC §4.4 — "default → task owner's domain lead". The seeded fallback policy
 * carries `required_role_codes: []`; the resolver substitutes this map so the
 * seed file stays declarative (see prisma/seed-data/approval-policies.ts).
 */
export const DOMAIN_LEAD_ROLE: Record<TaskDomain, string> = {
  food: RoleCode.BACKEND_LEAD,
  art: RoleCode.DESIGN_OUTREACH_LEAD,
  lifestyle: RoleCode.DESIGN_OUTREACH_LEAD,
  ops: RoleCode.FOUNDER_ADMIN,
  procurement: RoleCode.PROCUREMENT_LEAD,
  bi: RoleCode.BI_LEAD,
  talent: RoleCode.TALENT_LEAD,
  tech: RoleCode.TECH_LEAD,
  design: RoleCode.DESIGN_OUTREACH_LEAD,
};

export interface ResolvedPolicy {
  policy_id: string | null;
  scope: ApprovalScope;
  domain: TaskDomain | null;
  required_role_codes: string[];
  min_approvals: number;
  mode: ApprovalMode;
}

export interface MaterialiseInput {
  entity_type: ApprovalEntityType;
  entity_id: string;
  scope: ApprovalScope;
  domain: TaskDomain | null;
}

/** One task the backfill could not repair, and why. Never an exception. */
export interface BackfillSkip {
  task_id: string;
  reason: string;
}

/**
 * The result of one {@link ApprovalPolicyService.backfillMissing} pass.
 *
 * - `scanned` — every `requires_approval: true` task examined, healthy or not.
 * - `materialised` — **`Approval` rows** written by `materialise` (the same unit
 *   `materialise` itself returns). In a dry run this is the projected count and
 *   nothing was written.
 * - `revalidated` — **tasks** put back through the validation cascade. In a dry
 *   run, the projection of the same.
 * - `skipped` — affected tasks left untouched, each with a reason.
 *
 * `materialised + skipped.length` is not a task count on its own; the number of
 * *affected* tasks is `revalidated + skipped.length`.
 */
export interface BackfillReport {
  scanned: number;
  materialised: number;
  revalidated: number;
  skipped: BackfillSkip[];
}

/** Tasks pulled per scan page. Bounds the `IN (…)` list of the row probe. */
const BACKFILL_PAGE_SIZE = 200;

/** The audit verb written once per repaired task, beside `task.approvals_cleared`. */
export const BACKFILL_AUDIT_ACTION = 'task.approvals_backfilled';

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class ApprovalPolicyService {
  private readonly logger = new Logger(ApprovalPolicyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(BACKFILL_VALIDATION_PORT)
    private readonly validation: BackfillValidationPort,
  ) {}

  /**
   * Exact `(scope, domain)` match → the scope's `domain: null` row → the node's
   * `is_default` row. Never throws: an entity with no policy at all still gets
   * one approver so the gate is never silently open.
   */
  async resolve(
    scope: ApprovalScope,
    domain: TaskDomain | null,
    nodeId: string = DEFAULT_NODE_ID,
  ): Promise<ResolvedPolicy> {
    const exact = domain
      ? await this.prisma.approvalPolicy.findFirst({
          where: { node_id: nodeId, scope, domain },
        })
      : null;
    const matched =
      exact ??
      (await this.prisma.approvalPolicy.findFirst({
        where: { node_id: nodeId, scope, domain: null },
      })) ??
      (await this.prisma.approvalPolicy.findFirst({
        where: { node_id: nodeId, is_default: true },
      }));

    const domainLead = domain
      ? DOMAIN_LEAD_ROLE[domain]
      : (RoleCode.FOUNDER_ADMIN as string);

    if (!matched) {
      return {
        policy_id: null,
        scope,
        domain,
        required_role_codes: [domainLead],
        min_approvals: 1,
        mode: ApprovalMode.all,
      };
    }

    const roles =
      matched.required_role_codes.length > 0
        ? matched.required_role_codes
        : [domainLead];

    return {
      policy_id: matched.id,
      scope: matched.scope,
      domain: matched.domain,
      required_role_codes: roles,
      min_approvals: Math.min(Math.max(matched.min_approvals, 1), roles.length),
      mode: matched.mode,
    };
  }

  /**
   * Creates one pending `Approval` per required role, skipping roles that already
   * have a row. Idempotent by diff, and safe under concurrency because every
   * caller runs it inside the Serializable transaction that writes the entity.
   * Returns the number of rows created.
   */
  async materialise(
    tx: Tx,
    input: MaterialiseInput,
    nodeId: string = DEFAULT_NODE_ID,
  ): Promise<number> {
    const policy = await this.resolve(input.scope, input.domain, nodeId);

    const existing = await tx.approval.findMany({
      where: { entity_type: input.entity_type, entity_id: input.entity_id },
      select: { required_role_code: true },
    });
    const have = new Set(existing.map((a) => a.required_role_code));
    const missing = policy.required_role_codes.filter((r) => !have.has(r));
    if (missing.length === 0) return 0;

    await tx.approval.createMany({
      data: missing.map((role) => ({
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        approval_scope: policy.scope,
        required_role_code: role,
        policy_id: policy.policy_id,
        status: ApprovalStatus.pending,
      })),
    });
    return missing.length;
  }

  /**
   * SPEC §4.4 — "the validation cascade requires every policy-generated approval
   * approved". `all` needs every row approved; `n_of` needs `min_approvals`.
   * Zero rows is NEVER satisfied (decision 4) — the caller decides whether the
   * entity required approval at all.
   */
  async isSatisfied(
    tx: Tx,
    entityType: ApprovalEntityType,
    entityId: string,
    scope: ApprovalScope,
    domain: TaskDomain | null,
    nodeId: string = DEFAULT_NODE_ID,
  ): Promise<boolean> {
    const rows = await tx.approval.findMany({
      where: { entity_type: entityType, entity_id: entityId },
      select: { status: true },
    });
    if (rows.length === 0) return false;

    const approved = rows.filter(
      (r) => r.status === ApprovalStatus.approved,
    ).length;
    const rejected = rows.some((r) => r.status === ApprovalStatus.rejected);
    if (rejected) return false;

    const policy = await this.resolve(scope, domain, nodeId);
    return policy.mode === ApprovalMode.n_of
      ? approved >= policy.min_approvals
      : approved === rows.length;
  }

  // ── P3 decision 4 backfill ───────────────────────────────────────────────

  /**
   * Repairs the tasks P3 decision 4 left stranded: `requires_approval: true`
   * with **zero** `Approval` rows.
   *
   * Under v1 "no rows" counted as satisfied, so such a task could reach
   * `valid: true` without any sign-off ever happening. {@link isSatisfied} now
   * returns `false` for zero rows, and P6 Task 13 made `TasksService.update`
   * re-run the cascade on **every** status change — so on a populated database
   * each of these tasks silently loses `valid` (and its XP, and its readiness
   * contribution) the next time anybody touches it, at a moment nobody chose.
   * The P3 summary flagged the backfill and deferred it; this is it.
   *
   * What it does, per affected task, in one Serializable transaction:
   * materialise the policy's pending rows through {@link materialise} — the
   * single writer of policy-generated approvals, never a hand-written
   * `Approval` — write one `task.approvals_backfilled` audit row, then re-run
   * the validation cascade so `valid`/`valid_xp`/user XP/quest/mission/meter
   * settle **now**, visibly and audited.
   *
   * It does not make anything valid again: the rows land `pending`, so an
   * affected task settles at `valid: false` and the gate becomes real, visible
   * in the approvers' queue and actionable. That is the point — the flip stops
   * being a landmine.
   *
   * Silent by design: no notification is sent, and `task.validated` is never
   * emitted (the cascade seeds that event only on the `false → true`
   * transition, which pending rows cannot produce, and this method never calls
   * `emitTaskValidated`).
   *
   * Idempotent: the scan only selects tasks with no rows at all, so a second
   * run materialises 0. A task whose policy resolves to zero approvers, or
   * whose repair throws, becomes a {@link BackfillSkip} — never a crash, so one
   * bad row cannot abort the pass.
   *
   * @param dryRun report what would change and write nothing.
   */
  async backfillMissing(dryRun = false): Promise<BackfillReport> {
    const report: BackfillReport = {
      scanned: 0,
      materialised: 0,
      revalidated: 0,
      skipped: [],
    };
    let cursor: string | undefined;

    for (;;) {
      const page = await this.prisma.task.findMany({
        where: { requires_approval: true },
        select: { id: true, node_id: true, domain: true },
        orderBy: { id: 'asc' },
        take: BACKFILL_PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (page.length === 0) break;
      cursor = page[page.length - 1].id;
      report.scanned += page.length;

      // `Approval.entity_id` is polymorphic (SPEC §3.5) — there is no relation
      // to filter on, so the affected set is "this page minus the ids that
      // appear in Approval at all", decided/pending alike.
      const covered = await this.prisma.approval.findMany({
        where: {
          entity_type: ApprovalEntityType.task,
          entity_id: { in: page.map((t) => t.id) },
        },
        select: { entity_id: true },
        distinct: ['entity_id'],
      });
      const have = new Set(covered.map((row) => row.entity_id));

      for (const task of page) {
        if (have.has(task.id)) continue;
        await this.backfillTask(task, dryRun, report);
      }

      if (page.length < BACKFILL_PAGE_SIZE) break;
    }

    return report;
  }

  /** One task's repair. Resolves outside the transaction so a zero-approver
   * policy is a skip rather than an opened-and-rolled-back transaction. */
  private async backfillTask(
    task: { id: string; node_id: string; domain: TaskDomain },
    dryRun: boolean,
    report: BackfillReport,
  ): Promise<void> {
    let roles: string[];
    try {
      const policy = await this.resolve(
        ApprovalScope.task,
        task.domain,
        task.node_id,
      );
      // `resolve` substitutes the domain lead for an empty policy, so this is
      // normally non-empty — but a domain with no `DOMAIN_LEAD_ROLE` entry
      // would yield `[undefined]`, and materialising that is a crash.
      roles = policy.required_role_codes.filter(
        (role): role is string => typeof role === 'string' && role.length > 0,
      );
    } catch (error) {
      report.skipped.push({
        task_id: task.id,
        reason: `policy resolution failed: ${reasonOf(error)}`,
      });
      return;
    }

    if (roles.length === 0) {
      report.skipped.push({
        task_id: task.id,
        reason: `policy for (task, ${task.domain}) resolves to zero approvers`,
      });
      return;
    }

    if (dryRun) {
      report.materialised += roles.length;
      report.revalidated += 1;
      return;
    }

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          // `materialise` re-resolves the policy inside the transaction and is
          // the ONLY writer of policy-generated `Approval` rows — the backfill
          // never touches `tx.approval` itself.
          const rows = await this.materialise(
            tx,
            {
              entity_type: ApprovalEntityType.task,
              entity_id: task.id,
              scope: ApprovalScope.task,
              domain: task.domain,
            },
            task.node_id,
          );
          if (rows === 0) return 0;

          await this.audit.record(tx, {
            entity_type: 'task',
            entity_id: task.id,
            action: BACKFILL_AUDIT_ACTION,
            // A null user collapses to the system actor tuple: nobody asked for
            // this row, the backfill did.
            ...AuditService.user(null),
            before: { approvals: 0 },
            after: { approvals: rows, required_role_codes: roles },
            node_id: task.node_id,
          });

          // Settle `valid`/XP/quest/mission/meter now rather than at whatever
          // unrelated status change would otherwise have tripped it.
          await this.validation.validateTask(task.id, tx);
          return rows;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (created === 0) {
        report.skipped.push({
          task_id: task.id,
          reason: 'approval rows appeared between the scan and the write',
        });
        return;
      }

      report.materialised += created;
      report.revalidated += 1;
    } catch (error) {
      const reason = reasonOf(error);
      this.logger.warn(`backfill skipped task ${task.id}: ${reason}`);
      report.skipped.push({ task_id: task.id, reason });
    }
  }

  // ── CRUD (SPEC §9 `approval-policies`) ───────────────────────────────────

  async findAll(nodeId: string = DEFAULT_NODE_ID) {
    return this.prisma.approvalPolicy.findMany({
      where: { node_id: nodeId },
      orderBy: [{ scope: 'asc' }, { domain: 'asc' }],
    });
  }

  async create(dto: CreateApprovalPolicyDto, nodeId: string = DEFAULT_NODE_ID) {
    if (
      dto.mode === ApprovalMode.n_of &&
      dto.min_approvals > dto.required_role_codes.length
    ) {
      throw new BadRequestException(
        'min_approvals cannot exceed required_role_codes.length',
      );
    }
    const clash = await this.prisma.approvalPolicy.findFirst({
      where: { node_id: nodeId, scope: dto.scope, domain: dto.domain ?? null },
    });
    if (clash) {
      throw new BadRequestException(
        `A policy for (${dto.scope}, ${dto.domain ?? 'default'}) already exists`,
      );
    }
    return this.prisma.approvalPolicy.create({
      data: {
        node_id: nodeId,
        scope: dto.scope,
        domain: dto.domain ?? null,
        required_role_codes: dto.required_role_codes,
        min_approvals: dto.min_approvals,
        mode: dto.mode,
        is_default: dto.is_default ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateApprovalPolicyDto) {
    const existing = await this.prisma.approvalPolicy.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`Approval policy ${id} not found`);
    const roles = dto.required_role_codes ?? existing.required_role_codes;
    const min = dto.min_approvals ?? existing.min_approvals;
    const mode = dto.mode ?? existing.mode;
    if (mode === ApprovalMode.n_of && min > roles.length) {
      throw new BadRequestException(
        'min_approvals cannot exceed required_role_codes.length',
      );
    }
    return this.prisma.approvalPolicy.update({
      where: { id },
      data: {
        ...(dto.required_role_codes !== undefined && {
          required_role_codes: dto.required_role_codes,
        }),
        ...(dto.min_approvals !== undefined && {
          min_approvals: dto.min_approvals,
        }),
        ...(dto.mode !== undefined && { mode: dto.mode }),
        ...(dto.is_default !== undefined && { is_default: dto.is_default }),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.approvalPolicy.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`Approval policy ${id} not found`);
    if (existing.is_default) {
      throw new BadRequestException('The default policy cannot be deleted');
    }
    return this.prisma.approvalPolicy.delete({ where: { id } });
  }
}
