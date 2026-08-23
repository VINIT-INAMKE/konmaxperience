import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Approval,
  ApprovalEntityType,
  ApprovalScope,
  ApprovalStatus,
  Prisma,
  RecipeStatus,
  TaskDomain,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceService } from '../evidence/evidence.service';
import type { ValidateTaskResult } from '../evidence/evidence.service';
import { DelegationsService } from '../delegations/delegations.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalPolicyService } from './approval-policy.service';
import { RoleCode } from '../types/roles';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import {
  SERIALIZABLE_TX_OPTIONS,
  withSerializableRetry,
} from '../common/utils/transaction-retry';
import {
  DomainEvent,
  domainEventBase,
  emitDomainEvent,
  userActor,
} from '../common/events/domain-events';
import type { Tx } from '../common/types/transaction';
import {
  DecideApprovalDto,
  normaliseDecision,
} from './dto/decide-approval.dto';
import { ListApprovalsDto } from './dto/list-approvals.dto';

/** The acting staff member as the guards put it on the request. */
export interface ActingUser {
  id: string;
  roleCode: string;
}

/** SPEC §6.2 — the display fields the inbox renders per entity type. */
export interface ApprovalSubject {
  id: string;
  title: string;
  url: string;
  owner: { id: string; name: string } | null;
  status?: string | null;
}

/**
 * Everything the transaction produced that must be acted on AFTER commit:
 * the validation result whose `task.validated` still has to be emitted, and the
 * recipe row whose `recipe.approved` still has to be emitted (P3 decision 12 —
 * never emit inside the transaction).
 */
interface CascadeOutbox {
  validated: ValidateTaskResult | null;
  recipe: {
    id: string;
    node_id: string;
    name: string;
    version: number;
    computed_cost: Prisma.Decimal | null;
  } | null;
}

/**
 * `Approval.required_role_code` and the JWT's `roleCode` are plain strings, so
 * the founder check compares string to string (the `RoleCode` enum is the
 * source of the value, not of the type).
 */
const FOUNDER_ADMIN: string = RoleCode.FOUNDER_ADMIN;

/** Runs `query` only when there is something to look up, keeping the row type. */
function whenAny<T>(ids: string[], query: () => Promise<T[]>): Promise<T[]> {
  return ids.length ? query() : Promise.resolve<T[]>([]);
}

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceService: EvidenceService,
    private readonly delegationsService: DelegationsService,
    private readonly auditService: AuditService,
    private readonly approvalPolicy: ApprovalPolicyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Inbox (SPEC §6.2/§9, GOV-04) ──────────────────────────────────────────

  /**
   * SPEC §6.2/§9 — the approvals inbox, `GET /approvals?mine=1&status=pending`.
   * `mine=1` narrows to the caller's own required role plus any role they hold
   * by an active delegation. `FOUNDER_ADMIN` always sees everything.
   */
  async findApprovals(requestingUser: ActingUser, filters: ListApprovalsDto) {
    const isFounder = requestingUser.roleCode === FOUNDER_ADMIN;
    const narrowToMine = filters.mine === '1' && !isFounder;
    const roleCodes = narrowToMine
      ? await this.effectiveRoleCodes(requestingUser)
      : [];

    const where: Prisma.ApprovalWhereInput = {
      status: filters.status ?? ApprovalStatus.pending,
      ...(filters.entity_type ? { entity_type: filters.entity_type } : {}),
      ...(narrowToMine ? { required_role_code: { in: roleCodes } } : {}),
      ...(filters.cursor
        ? { created_at: { lt: new Date(filters.cursor) } }
        : {}),
    };

    const approvals = await this.prisma.approval.findMany({
      where,
      include: {
        approver: { select: { id: true, name: true } },
        policy: { select: { id: true, mode: true, min_approvals: true } },
      },
      orderBy: { created_at: 'asc' },
      take: Math.min(Number(filters.limit) || 50, 200),
    });

    return this.attachSubjects(approvals);
  }

  /**
   * Kept for backwards compatibility with `GET /approvals/pending`; identical to
   * `findApprovals` with no filters (every pending row, no `mine` narrowing).
   */
  async findPending() {
    return this.findApprovals(
      { id: '', roleCode: RoleCode.FOUNDER_ADMIN },
      { status: ApprovalStatus.pending, limit: '100' },
    );
  }

  /** Header/sidebar badge — SPEC §6.1 "approvals waiting on me". */
  async countForUser(requestingUser: ActingUser): Promise<{ count: number }> {
    const roleCodes = await this.effectiveRoleCodes(requestingUser);
    const isFounder = requestingUser.roleCode === FOUNDER_ADMIN;

    const count = await this.prisma.approval.count({
      where: {
        status: ApprovalStatus.pending,
        ...(isFounder ? {} : { required_role_code: { in: roleCodes } }),
      },
    });
    return { count };
  }

  /**
   * Resolves the display fields for every entity type in at most four extra
   * queries. The legacy `task` field is preserved alongside `subject` so the
   * existing queue component keeps rendering until it is rewired.
   */
  private async attachSubjects<T extends Approval>(approvals: T[]) {
    const idsFor = (type: ApprovalEntityType) =>
      approvals.filter((a) => a.entity_type === type).map((a) => a.entity_id);

    const taskIds = idsFor(ApprovalEntityType.task);
    const recipeIds = idsFor(ApprovalEntityType.recipe);
    const decisionIds = idsFor(ApprovalEntityType.decision);
    const evidenceIds = idsFor(ApprovalEntityType.evidence);

    const [tasks, recipes, decisions, evidence] = await Promise.all([
      whenAny(taskIds, () =>
        this.prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: {
            id: true,
            title: true,
            status: true,
            owner: { select: { id: true, name: true } },
            _count: { select: { evidence: true } },
          },
        }),
      ),
      whenAny(recipeIds, () =>
        this.prisma.recipe.findMany({
          where: { id: { in: recipeIds } },
          select: {
            id: true,
            name: true,
            status: true,
            version: true,
            creator: { select: { id: true, name: true } },
          },
        }),
      ),
      whenAny(decisionIds, () =>
        this.prisma.decision.findMany({
          where: { id: { in: decisionIds } },
          select: {
            id: true,
            title: true,
            status: true,
            tier: true,
            proposer: { select: { id: true, name: true } },
          },
        }),
      ),
      whenAny(evidenceIds, () =>
        this.prisma.evidence.findMany({
          where: { id: { in: evidenceIds } },
          select: {
            id: true,
            type: true,
            task_id: true,
            approval_status: true,
            task: { select: { id: true, title: true } },
            uploader: { select: { id: true, name: true } },
          },
        }),
      ),
    ]);

    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const recipeById = new Map(recipes.map((r) => [r.id, r]));
    const decisionById = new Map(decisions.map((d) => [d.id, d]));
    const evidenceById = new Map(evidence.map((e) => [e.id, e]));

    return approvals.map((approval) => {
      let subject: ApprovalSubject | null = null;

      switch (approval.entity_type) {
        case ApprovalEntityType.task: {
          const task = taskById.get(approval.entity_id);
          if (task) {
            subject = {
              id: task.id,
              title: task.title,
              url: `/tasks/${task.id}`,
              owner: task.owner,
              status: task.status,
            };
          }
          break;
        }
        case ApprovalEntityType.recipe: {
          const recipe = recipeById.get(approval.entity_id);
          if (recipe) {
            subject = {
              id: recipe.id,
              title: `${recipe.name} (v${recipe.version})`,
              url: `/operations/recipes/${recipe.id}`,
              owner: recipe.creator,
              status: recipe.status,
            };
          }
          break;
        }
        case ApprovalEntityType.decision: {
          const decision = decisionById.get(approval.entity_id);
          if (decision) {
            subject = {
              id: decision.id,
              title: decision.title,
              url: `/decisions?decision=${decision.id}`,
              owner: decision.proposer,
              status: decision.status,
            };
          }
          break;
        }
        case ApprovalEntityType.evidence: {
          const row = evidenceById.get(approval.entity_id);
          if (row) {
            subject = {
              id: row.id,
              title: row.task?.title ?? `${row.type} evidence`,
              url: `/tasks/${row.task_id}`,
              owner: row.uploader,
              status: row.approval_status,
            };
          }
          break;
        }
      }

      return {
        ...approval,
        subject,
        // Backwards compatibility with the v1 queue component.
        task:
          approval.entity_type === ApprovalEntityType.task
            ? (taskById.get(approval.entity_id) ?? null)
            : null,
      };
    });
  }

  // ── Decide (SPEC §4.4, GOV-02) ────────────────────────────────────────────

  /**
   * The polymorphic decision: approve or reject a `task`, `recipe`, `decision`
   * or `evidence` approval. Blocks self-approval, honours delegation, and drives
   * whatever cascade the entity type needs.
   */
  async decide(
    approvalId: string,
    actingUser: ActingUser,
    dto: DecideApprovalDto,
  ) {
    const decision = normaliseDecision(dto);
    const actor = await this.resolveActor(actingUser);
    const isFounder = actingUser.roleCode === FOUNDER_ADMIN;

    const outbox: CascadeOutbox = { validated: null, recipe: null };

    const cascade = await withSerializableRetry(() =>
      this.prisma.$transaction(async (tx: Tx) => {
        const approval = await tx.approval.findUnique({
          where: { id: approvalId },
        });
        if (!approval) {
          throw new NotFoundException(`Approval ${approvalId} not found`);
        }
        if (approval.status !== ApprovalStatus.pending) {
          throw new BadRequestException(
            `Approval ${approvalId} is already ${approval.status}`,
          );
        }
        if (
          !isFounder &&
          !actor.roleCodes.includes(approval.required_role_code)
        ) {
          throw new ForbiddenException(
            `This approval is reserved for ${approval.required_role_code}`,
          );
        }

        // SPEC §4.4 — self-approval blocked (the founder path is /override).
        const authorId = await this.entityAuthorId(
          tx,
          approval.entity_type,
          approval.entity_id,
        );
        if (authorId && authorId === actingUser.id && !isFounder) {
          throw new ForbiddenException('You cannot approve your own work');
        }

        // Acting under the caller's own role is not a delegated decision;
        // anything else they are allowed to decide comes from the delegation.
        const delegatedFrom =
          approval.required_role_code === actingUser.roleCode
            ? null
            : actor.delegatorUserId;

        await tx.approval.update({
          where: { id: approvalId },
          data: {
            status: decision.status,
            approved_by: actingUser.id,
            notes: decision.notes ?? null,
            delegated_from_user_id: delegatedFrom,
          },
        });

        await this.auditService.record(tx, {
          entity_type: 'approval',
          entity_id: approvalId,
          action: 'approval.decided',
          ...AuditService.user(actingUser.id),
          before: { status: ApprovalStatus.pending },
          after: {
            status: decision.status,
            delegated_from: delegatedFrom,
            notes: decision.notes ?? null,
          },
        });

        return this.cascade(
          tx,
          {
            ...approval,
            status: decision.status,
            notes: decision.notes ?? null,
            approved_by: actingUser.id,
            delegated_from_user_id: delegatedFrom,
          },
          actingUser.id,
          outbox,
        );
      }, SERIALIZABLE_TX_OPTIONS),
    );

    this.emitAfterCommit(outbox, actingUser.id);
    emitDomainEvent(this.eventEmitter, DomainEvent.APPROVAL_DECIDED, {
      ...domainEventBase(DEFAULT_NODE_ID, userActor(actingUser.id)),
      approvalId,
      entityType: cascade.entity_type,
      entityId: cascade.entity_id,
      status: decision.status,
      requiredRoleCode: cascade.required_role_code,
      overridden: false,
    });

    return cascade.result;
  }

  /**
   * Kept so `POST /approvals/:id/approve` keeps working: a thin shim over
   * `decide(id, user, { status: 'approved' })`.
   */
  async approveWithDelegation(
    approvalId: string,
    actingUserId: string,
    actingRoleCode: string,
  ) {
    return this.decide(
      approvalId,
      { id: actingUserId, roleCode: actingRoleCode },
      { status: ApprovalStatus.approved },
    );
  }

  /**
   * Override any pending approval (`FOUNDER_ADMIN` only, reason required by
   * `OverrideApprovalDto`). Runs the same cascade as `decide` so an override
   * completes a task/recipe gate rather than only flipping the row.
   */
  async overrideApproval(approvalId: string, adminId: string, reason: string) {
    const outbox: CascadeOutbox = { validated: null, recipe: null };

    const cascade = await withSerializableRetry(() =>
      this.prisma.$transaction(async (tx: Tx) => {
        const approval = await tx.approval.findFirst({
          where: { id: approvalId, status: ApprovalStatus.pending },
        });

        if (!approval) {
          throw new NotFoundException(
            `No pending approval found with ID ${approvalId}`,
          );
        }

        await tx.approval.update({
          where: { id: approval.id },
          data: {
            status: ApprovalStatus.approved,
            approved_by: adminId,
            override_by: adminId,
            override_reason: reason,
            override_at: new Date(),
          },
        });

        await this.auditService.record(tx, {
          entity_type: 'approval',
          entity_id: approval.id,
          action: 'approval.overridden',
          ...AuditService.user(adminId),
          before: { status: ApprovalStatus.pending },
          after: {
            status: ApprovalStatus.approved,
            override_reason: reason,
          },
        });

        return this.cascade(
          tx,
          {
            ...approval,
            status: ApprovalStatus.approved,
            approved_by: adminId,
            override_by: adminId,
            override_reason: reason,
          },
          adminId,
          outbox,
        );
      }, SERIALIZABLE_TX_OPTIONS),
    );

    this.emitAfterCommit(outbox, adminId);
    emitDomainEvent(this.eventEmitter, DomainEvent.APPROVAL_DECIDED, {
      ...domainEventBase(DEFAULT_NODE_ID, userActor(adminId)),
      approvalId,
      entityType: cascade.entity_type,
      entityId: cascade.entity_id,
      status: ApprovalStatus.approved,
      requiredRoleCode: cascade.required_role_code,
      overridden: true,
    });

    return { overridden: true, ...cascade.result };
  }

  // ── Cascade ───────────────────────────────────────────────────────────────

  /**
   * The one place that knows what a satisfied gate means per entity type
   * (P3 decision 12). Never emits — after-commit work is parked in `outbox`.
   */
  private async cascade(
    tx: Tx,
    approval: Approval,
    actorId: string,
    outbox: CascadeOutbox,
  ) {
    const envelope = {
      entity_type: approval.entity_type,
      entity_id: approval.entity_id,
      required_role_code: approval.required_role_code,
    };

    switch (approval.entity_type) {
      case ApprovalEntityType.evidence: {
        const evidence = await tx.evidence.update({
          where: { id: approval.entity_id },
          data: {
            approval_status: approval.status,
            reviewed_by: actorId,
            reviewed_at: new Date(),
          },
          select: { task_id: true },
        });
        if (!evidence) {
          return { ...envelope, result: { decided: true } as const };
        }
        const validated = await this.evidenceService.validateTask(
          evidence.task_id,
          tx,
        );
        outbox.validated = validated;
        return {
          ...envelope,
          result: EvidenceService.publicResult(validated),
        };
      }

      case ApprovalEntityType.task: {
        // The task's own gate — re-run the cascade so `valid` flips the moment
        // the last policy approval lands (and un-flips on a reject).
        const validated = await this.evidenceService.validateTask(
          approval.entity_id,
          tx,
        );
        outbox.validated = validated;
        return {
          ...envelope,
          result: EvidenceService.publicResult(validated),
        };
      }

      case ApprovalEntityType.recipe: {
        if (approval.status === ApprovalStatus.rejected) {
          await tx.recipe.update({
            where: { id: approval.entity_id },
            data: { status: RecipeStatus.draft },
          });
          await this.auditService.record(tx, {
            entity_type: 'recipe',
            entity_id: approval.entity_id,
            action: 'recipe.status_changed',
            ...AuditService.user(actorId),
            before: { status: RecipeStatus.pending },
            after: { status: RecipeStatus.draft },
          });
          return { ...envelope, result: { recipe_status: RecipeStatus.draft } };
        }

        const satisfied = await this.approvalPolicy.isSatisfied(
          tx,
          ApprovalEntityType.recipe,
          approval.entity_id,
          ApprovalScope.recipe,
          TaskDomain.food,
        );
        if (!satisfied) {
          return {
            ...envelope,
            result: { recipe_status: RecipeStatus.pending },
          };
        }

        const recipe = await tx.recipe.update({
          where: { id: approval.entity_id },
          data: { status: RecipeStatus.approved },
          select: {
            id: true,
            node_id: true,
            name: true,
            version: true,
            computed_cost: true,
          },
        });
        await this.auditService.record(tx, {
          entity_type: 'recipe',
          entity_id: approval.entity_id,
          action: 'recipe.approved',
          ...AuditService.user(actorId),
          before: { status: RecipeStatus.pending },
          after: { status: RecipeStatus.approved },
        });
        outbox.recipe = recipe ?? null;
        return {
          ...envelope,
          result: { recipe_status: RecipeStatus.approved },
        };
      }

      case ApprovalEntityType.decision:
      default:
        // Tallying lives in DecisionsService (SPEC §4.4 tier 2/3).
        return { ...envelope, result: { decision: approval.entity_id } };
    }
  }

  /** Emits everything the transaction parked, after it has committed. */
  private emitAfterCommit(outbox: CascadeOutbox, actorId: string): void {
    this.evidenceService.emitTaskValidated(
      outbox.validated?.event ?? null,
      actorId,
    );
    if (outbox.recipe) {
      emitDomainEvent(this.eventEmitter, DomainEvent.RECIPE_APPROVED, {
        ...domainEventBase(outbox.recipe.node_id, userActor(actorId)),
        recipeId: outbox.recipe.id,
        name: outbox.recipe.name,
        version: outbox.recipe.version,
        computedCost: outbox.recipe.computed_cost?.toString() ?? null,
      });
    }
  }

  // ── Actor resolution ──────────────────────────────────────────────────────

  /**
   * The caller's own role plus, when they hold an active delegation, the
   * delegator's role code — one extra `user.findUnique` at most.
   */
  private async resolveActor(user: ActingUser): Promise<{
    roleCodes: string[];
    delegatorUserId: string | null;
  }> {
    const delegation = await this.delegationsService.getActiveDelegationForUser(
      user.id,
    );
    if (!delegation) {
      return { roleCodes: [user.roleCode], delegatorUserId: null };
    }

    const delegator = await this.prisma.user.findUnique({
      where: { id: delegation.from_user_id },
      select: { role: { select: { code: true } } },
    });
    const delegatedRoleCode = delegator?.role?.code ?? null;

    return {
      roleCodes: Array.from(
        new Set([
          user.roleCode,
          ...(delegatedRoleCode ? [delegatedRoleCode] : []),
        ]),
      ),
      delegatorUserId: delegation.from_user_id,
    };
  }

  private async effectiveRoleCodes(user: ActingUser): Promise<string[]> {
    return (await this.resolveActor(user)).roleCodes;
  }

  /** `task.owner_user_id` / `recipe.created_by` / `decision.proposed_by` / `evidence.uploaded_by`. */
  private async entityAuthorId(
    tx: Tx,
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<string | null> {
    switch (entityType) {
      case ApprovalEntityType.task: {
        const row = await tx.task.findUnique({
          where: { id: entityId },
          select: { owner_user_id: true },
        });
        return row?.owner_user_id ?? null;
      }
      case ApprovalEntityType.recipe: {
        const row = await tx.recipe.findUnique({
          where: { id: entityId },
          select: { created_by: true },
        });
        return row?.created_by ?? null;
      }
      case ApprovalEntityType.decision: {
        const row = await tx.decision.findUnique({
          where: { id: entityId },
          select: { proposed_by: true },
        });
        return row?.proposed_by ?? null;
      }
      case ApprovalEntityType.evidence: {
        const row = await tx.evidence.findUnique({
          where: { id: entityId },
          select: { uploaded_by: true },
        });
        return row?.uploaded_by ?? null;
      }
      default:
        return null;
    }
  }
}
