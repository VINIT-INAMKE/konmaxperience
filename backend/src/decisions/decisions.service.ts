import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DecisionStatus,
  GovernanceTier,
  TaskDomain,
  VoteValue,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DOMAIN_LEAD_ROLE } from '../approvals/approval-policy.service';
import { RoleCode } from '../types/roles';
import { isEnumValue, parseEnum } from '../common/utils/parse-enum';
import type { Tx } from '../common/types/transaction';
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
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { ResolveDecisionDto } from './dto/resolve-decision.dto';

/** The `{ id, roleCode }` pair the JWT strategy puts on `req.user`. */
export interface DecisionActor {
  id: string;
  roleCode: string;
}

const VOTE_INCLUDE = {
  user: { select: { id: true, name: true } },
} as const;

const DECISION_INCLUDE = {
  proposer: { select: { id: true, name: true } },
  linked_mission: { select: { id: true, title: true } },
  linked_task: { select: { id: true, title: true } },
  votes: { include: VOTE_INCLUDE, orderBy: { created_at: 'asc' } },
} as const;

/**
 * `req.user.roleCode` is a plain `string` (JWT claim), so the founder check is
 * a string comparison — comparing it to the `RoleCode` enum member directly
 * trips `@typescript-eslint/no-unsafe-enum-comparison`.
 */
const FOUNDER_ROLE: string = RoleCode.FOUNDER_ADMIN;

/** Statuses that still accept votes. */
const OPEN_STATUSES: DecisionStatus[] = [
  DecisionStatus.proposed,
  DecisionStatus.reopened,
];

/**
 * SPEC §4.4 — any reject ends the decision; all required roles voting `approve`
 * aligns it and then approves it (plan decision 11); anything else keeps it open.
 * `abstain` is not `approve`, and an empty `requiredRoleCodes` never
 * auto-approves on silence.
 */
export function tallyDecision(
  requiredRoleCodes: string[],
  votes: { role_code: string; vote: VoteValue }[],
): { status: DecisionStatus; aligned: boolean } {
  if (votes.some((v) => v.vote === VoteValue.reject)) {
    return { status: DecisionStatus.rejected, aligned: false };
  }
  const approvedRoles = new Set(
    votes.filter((v) => v.vote === VoteValue.approve).map((v) => v.role_code),
  );
  const allApproved =
    requiredRoleCodes.length > 0 &&
    requiredRoleCodes.every((r) => approvedRoles.has(r));
  return allApproved
    ? { status: DecisionStatus.approved, aligned: true }
    : { status: DecisionStatus.proposed, aligned: false };
}

/**
 * SPEC §4.4 tier rules:
 * - tier 1 → the domain lead alone;
 * - tier 2 → the caller's two domain roles plus one impacted role (>= 3);
 * - tier 3 → the founder.
 */
export function resolveRequiredRoles(
  tier: GovernanceTier,
  domain: TaskDomain,
  requestedRoles?: string[],
): string[] {
  if (tier === GovernanceTier.tier_3) {
    return [RoleCode.FOUNDER_ADMIN as string];
  }
  if (tier === GovernanceTier.tier_2) {
    const roles = Array.from(new Set(requestedRoles ?? []));
    if (roles.length < 3) {
      throw new BadRequestException(
        'A tier 2 decision needs two domain roles plus one impacted role',
      );
    }
    return roles;
  }
  return [DOMAIN_LEAD_ROLE[domain]];
}

@Injectable()
export class DecisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(status?: string, page?: number, limit?: number) {
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = parseEnum(DecisionStatus, status, 'status');
    }

    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    return this.prisma.decision.findMany({
      where,
      include: DECISION_INCLUDE,
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });
  }

  async findAllForExport(): Promise<any[]> {
    return this.prisma.decision.findMany({
      include: {
        proposer: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const decision = await this.prisma.decision.findUnique({
      where: { id },
      include: DECISION_INCLUDE,
    });
    if (!decision) {
      throw new NotFoundException(`Decision with ID ${id} not found`);
    }
    return decision;
  }

  async listVotes(decisionId: string) {
    await this.findOne(decisionId);
    return this.prisma.decisionVote.findMany({
      where: { decision_id: decisionId },
      include: VOTE_INCLUDE,
      orderBy: { created_at: 'asc' },
    });
  }

  async create(dto: CreateDecisionDto, proposer: DecisionActor) {
    const impactScope = dto.impact_scope ?? TaskDomain.ops;
    const domain: TaskDomain = isEnumValue(TaskDomain, impactScope)
      ? impactScope
      : TaskDomain.ops;
    const tier = dto.tier ?? GovernanceTier.tier_1;
    const roles = resolveRequiredRoles(tier, domain, dto.required_role_codes);

    // Tier 1: the domain lead decides. Auto-approved on creation by that lead;
    // proposed by anyone else it waits for that lead's vote.
    const autoApprove =
      tier === GovernanceTier.tier_1 &&
      proposer.roleCode === DOMAIN_LEAD_ROLE[domain];
    const resolvedAt = autoApprove ? new Date() : null;

    const decision = await this.prisma.$transaction(async (tx: Tx) => {
      const created = await tx.decision.create({
        data: {
          title: dto.title,
          decision_type: dto.decision_type,
          context: dto.context,
          proposed_by: proposer.id,
          impact_scope: impactScope,
          tier,
          required_role_codes: roles,
          status: autoApprove
            ? DecisionStatus.approved
            : DecisionStatus.proposed,
          resolved_by: autoApprove ? proposer.id : null,
          resolved_at: resolvedAt,
          linked_mission_id: dto.linked_mission_id ?? null,
          linked_task_id: dto.linked_task_id ?? null,
        },
        include: DECISION_INCLUDE,
      });
      await this.auditService.record(tx, {
        entity_type: 'decision',
        entity_id: created.id,
        action: autoApprove ? 'decision.resolved' : 'decision.created',
        ...AuditService.user(proposer.id),
        after: {
          status: created.status,
          tier: created.tier,
          required_role_codes: roles,
        },
      });
      return created;
    }, SERIALIZABLE_TX_OPTIONS);

    if (autoApprove) this.emitResolved(decision);
    return decision;
  }

  /**
   * SPEC §4.4 — one vote per (decision, user); the tally runs in the same
   * transaction so two simultaneous approving votes cannot both believe they
   * were the last one.
   */
  async castVote(decisionId: string, voter: DecisionActor, dto: CastVoteDto) {
    const outcome = await withSerializableRetry(() =>
      this.prisma.$transaction(async (tx: Tx) => {
        const decision = await tx.decision.findUnique({
          where: { id: decisionId },
          include: DECISION_INCLUDE,
        });
        if (!decision) {
          throw new NotFoundException(
            `Decision with ID ${decisionId} not found`,
          );
        }
        if (!OPEN_STATUSES.includes(decision.status)) {
          throw new BadRequestException(
            `Decision is ${decision.status} and no longer accepts votes`,
          );
        }

        // The decision's own `required_role_codes` is the ACL. The founder can
        // always weigh in (SPEC §4.4 "founder may reopen"/override).
        const isFounder = voter.roleCode === FOUNDER_ROLE;
        if (
          !isFounder &&
          !decision.required_role_codes.includes(voter.roleCode)
        ) {
          throw new ForbiddenException('Your role is not on this decision');
        }

        await tx.decisionVote.upsert({
          where: {
            decision_id_user_id: {
              decision_id: decisionId,
              user_id: voter.id,
            },
          },
          create: {
            decision_id: decisionId,
            user_id: voter.id,
            role_code: voter.roleCode,
            vote: dto.vote,
            notes: dto.notes ?? null,
          },
          update: {
            vote: dto.vote,
            notes: dto.notes ?? null,
            role_code: voter.roleCode,
          },
        });
        await this.auditService.record(tx, {
          entity_type: 'decision',
          entity_id: decisionId,
          action: 'decision.voted',
          ...AuditService.user(voter.id),
          after: { vote: dto.vote, role_code: voter.roleCode },
        });

        const votes = await tx.decisionVote.findMany({
          where: { decision_id: decisionId },
          include: VOTE_INCLUDE,
          orderBy: { created_at: 'asc' },
        });
        const next = tallyDecision(decision.required_role_codes, votes);
        if (next.status === decision.status) {
          return { decision, votes, resolved: false };
        }

        // A `reopened` row whose tally is still incomplete falls back to
        // `proposed` — a status change, but not a resolution, so it neither
        // stamps `resolved_by/at` nor fires `decision.resolved`.
        const resolved =
          next.status === DecisionStatus.approved ||
          next.status === DecisionStatus.rejected;

        // `aligned` is a recorded transition, not a resting state (plan
        // decision 11): the moment every required role approved is audited,
        // then the row lands on `approved`.
        if (next.aligned) {
          await this.auditService.record(tx, {
            entity_type: 'decision',
            entity_id: decisionId,
            action: 'decision.aligned',
            ...AuditService.user(voter.id),
            after: { status: DecisionStatus.aligned },
          });
        }
        const updated = await tx.decision.update({
          where: { id: decisionId },
          data: {
            status: next.status,
            resolved_by: resolved ? voter.id : null,
            resolved_at: resolved ? new Date() : null,
          },
          include: DECISION_INCLUDE,
        });
        await this.auditService.record(tx, {
          entity_type: 'decision',
          entity_id: decisionId,
          action: resolved ? 'decision.resolved' : 'decision.status_changed',
          ...AuditService.user(voter.id),
          before: { status: decision.status },
          after: { status: next.status },
        });
        return { decision: updated, votes, resolved };
      }, SERIALIZABLE_TX_OPTIONS),
    );

    const decision = { ...outcome.decision, votes: outcome.votes };
    if (outcome.resolved) this.emitResolved(decision);
    return { decision, votes: outcome.votes };
  }

  /** Tier 3 — the founder's call. Also the escape hatch for a stalled tier 2. */
  async resolve(id: string, founder: DecisionActor, dto: ResolveDecisionDto) {
    if (founder.roleCode !== FOUNDER_ROLE) {
      throw new ForbiddenException('Only the founder can resolve a decision');
    }
    if (
      dto.status !== DecisionStatus.approved &&
      dto.status !== DecisionStatus.rejected
    ) {
      throw new BadRequestException(
        'A decision resolves to approved or rejected',
      );
    }

    const decision = await this.prisma.$transaction(async (tx: Tx) => {
      const existing = await tx.decision.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Decision with ID ${id} not found`);
      }
      if (!OPEN_STATUSES.includes(existing.status)) {
        throw new BadRequestException(
          `Decision is already ${existing.status}; reopen it first`,
        );
      }
      const updated = await tx.decision.update({
        where: { id },
        data: {
          status: dto.status,
          final_decision: dto.final_decision,
          resolved_by: founder.id,
          resolved_at: new Date(),
        },
        include: DECISION_INCLUDE,
      });
      await this.auditService.record(tx, {
        entity_type: 'decision',
        entity_id: id,
        action: 'decision.resolved',
        ...AuditService.user(founder.id),
        before: { status: existing.status },
        after: { status: dto.status, final_decision: dto.final_decision },
      });
      return updated;
    }, SERIALIZABLE_TX_OPTIONS);

    this.emitResolved(decision);
    return decision;
  }

  /** Founder-only. Clears the resolution and the votes so the tally restarts. */
  async reopen(id: string, founder: DecisionActor) {
    if (founder.roleCode !== FOUNDER_ROLE) {
      throw new ForbiddenException('Only the founder can reopen a decision');
    }

    return this.prisma.$transaction(async (tx: Tx) => {
      const existing = await tx.decision.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Decision with ID ${id} not found`);
      }
      if (existing.status === DecisionStatus.reopened) {
        throw new BadRequestException('Decision is already reopened');
      }
      await tx.decisionVote.deleteMany({ where: { decision_id: id } });
      const updated = await tx.decision.update({
        where: { id },
        data: {
          status: DecisionStatus.reopened,
          resolved_by: null,
          resolved_at: null,
        },
        include: DECISION_INCLUDE,
      });
      await this.auditService.record(tx, {
        entity_type: 'decision',
        entity_id: id,
        action: 'decision.reopened',
        ...AuditService.user(founder.id),
        before: { status: existing.status },
        after: { status: DecisionStatus.reopened },
      });
      return updated;
    }, SERIALIZABLE_TX_OPTIONS);
  }

  async update(
    id: string,
    dto: UpdateDecisionDto,
    userId: string,
    isAdmin: boolean,
  ) {
    const decision = await this.findOne(id);

    if (decision.status === 'approved' && !isAdmin) {
      throw new ForbiddenException(
        'Approved decisions are locked. Only admin can reopen.',
      );
    }

    return this.prisma.$transaction(async (tx: Tx) => {
      const updated = await tx.decision.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.decision_type !== undefined && {
            decision_type: dto.decision_type,
          }),
          ...(dto.context !== undefined && { context: dto.context }),
          ...(dto.linked_mission_id !== undefined && {
            linked_mission_id: dto.linked_mission_id,
          }),
          ...(dto.linked_task_id !== undefined && {
            linked_task_id: dto.linked_task_id,
          }),
        },
        include: DECISION_INCLUDE,
      });
      await this.auditService.record(tx, {
        entity_type: 'decision',
        entity_id: id,
        action: 'decision.updated',
        ...AuditService.user(userId),
        before: { title: decision.title, context: decision.context },
        after: { title: updated.title, context: updated.context },
      });
      return updated;
    }, SERIALIZABLE_TX_OPTIONS);
  }

  async remove(id: string, isAdmin: boolean) {
    const decision = await this.findOne(id);

    if (decision.status === 'approved') {
      throw new ForbiddenException('Cannot delete an approved decision');
    }

    if (!isAdmin && decision.status !== 'proposed') {
      throw new ForbiddenException(
        'Only admins can delete non-proposed decisions',
      );
    }

    return this.prisma.decision.delete({ where: { id } });
  }

  /** SPEC §4.1 — emitted only after the transaction commits. */
  private emitResolved(decision: {
    id: string;
    node_id: string;
    title: string;
    tier: GovernanceTier;
    status: DecisionStatus;
    linked_task_id: string | null;
    resolved_by: string | null;
  }): void {
    emitDomainEvent(this.eventEmitter, DomainEvent.DECISION_RESOLVED, {
      ...domainEventBase(decision.node_id, userActor(decision.resolved_by)),
      decisionId: decision.id,
      title: decision.title,
      tier: decision.tier,
      status: decision.status,
      linkedTaskId: decision.linked_task_id,
    });
  }
}
