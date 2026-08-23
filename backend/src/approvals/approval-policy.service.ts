import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApprovalEntityType,
  ApprovalMode,
  ApprovalScope,
  ApprovalStatus,
  TaskDomain,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from '../node/node.constants';
import { RoleCode } from '../types/roles';
import type { Tx } from '../common/types/transaction';
import { CreateApprovalPolicyDto } from './dto/create-approval-policy.dto';
import { UpdateApprovalPolicyDto } from './dto/update-approval-policy.dto';

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

@Injectable()
export class ApprovalPolicyService {
  constructor(private readonly prisma: PrismaService) {}

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
