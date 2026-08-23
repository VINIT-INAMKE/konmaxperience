import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApprovalEntityType, ApprovalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceService } from '../evidence/evidence.service';
import { DelegationsService } from '../delegations/delegations.service';
import { AuditService } from '../audit/audit.service';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { Permission } from '../types/permissions';
import type { Tx } from '../common/types/transaction';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceService: EvidenceService,
    private readonly delegationsService: DelegationsService,
    private readonly auditService: AuditService,
  ) {}

  async findPending() {
    const approvals = await this.prisma.approval.findMany({
      where: { status: 'pending' },
      include: {
        approver: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
      take: 100,
    });

    // `Approval.entity_id` is polymorphic (task | evidence | decision | recipe),
    // so there is no `task` relation to include (SPEC §3.5). Resolve the task
    // rows the queue needs with an explicit query.
    const taskIds = approvals
      .filter((a) => a.entity_type === ApprovalEntityType.task)
      .map((a) => a.entity_id);
    const tasks = taskIds.length
      ? await this.prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: {
            id: true,
            title: true,
            status: true,
            owner: { select: { id: true, name: true } },
            _count: { select: { evidence: true } },
          },
        })
      : [];
    const taskById = new Map(tasks.map((task) => [task.id, task]));

    return approvals.map((approval) => ({
      ...approval,
      task:
        approval.entity_type === ApprovalEntityType.task
          ? (taskById.get(approval.entity_id) ?? null)
          : null,
    }));
  }

  /**
   * Override any pending approval (admin only).
   * Accepts the Approval primary key (id).
   * If entity_type is 'evidence', also updates Evidence approval_status and fires validateTask cascade.
   */
  async overrideApproval(
    approvalId: string,
    adminId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const approval = await tx.approval.findFirst({
        where: { id: approvalId, status: 'pending' },
      });

      if (!approval) {
        throw new NotFoundException(
          `No pending approval found with ID ${approvalId}`,
        );
      }

      await tx.approval.update({
        where: { id: approval.id },
        data: {
          status: 'approved',
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
        after: { status: ApprovalStatus.approved, override_reason: reason },
      });

      // Per D-10: if evidence approval, update Evidence record AND fire validation cascade
      if (approval.entity_type === 'evidence') {
        const evidence = await tx.evidence.update({
          where: { id: approval.entity_id },
          data: {
            approval_status: 'approved',
            reviewed_by: adminId,
            reviewed_at: new Date(),
          },
          select: { task_id: true },
        });
        if (evidence) {
          return this.evidenceService.validateTask(evidence.task_id, tx);
        }
      }

      return { overridden: true };
    });
  }

  /**
   * Approve an Approval record with delegation-aware permission check.
   * Short-circuits if acting user already has APPROVE_EVIDENCE from their own role.
   * Otherwise checks for active delegation; if none, throws ForbiddenException.
   */
  async approveWithDelegation(
    approvalId: string,
    actingUserId: string,
    actingRoleCode: string,
  ) {
    const ownPerms = await getPermissionsForRole(actingRoleCode, this.prisma);
    let delegatedFromUserId: string | null = null;

    if (!ownPerms.includes(Permission.APPROVE_EVIDENCE)) {
      const delegation =
        await this.delegationsService.getActiveDelegationForUser(actingUserId);
      if (!delegation) {
        throw new ForbiddenException(
          'No permission to approve and no active delegation',
        );
      }
      delegatedFromUserId = delegation.from_user_id;
    }

    return this.prisma.$transaction(async (tx: Tx) => {
      const approval = await tx.approval.findUnique({
        where: { id: approvalId },
      });
      if (!approval) {
        throw new NotFoundException(`Approval ${approvalId} not found`);
      }

      await tx.approval.update({
        where: { id: approvalId },
        data: {
          status: 'approved',
          approved_by: actingUserId,
          delegated_from_user_id: delegatedFromUserId,
        },
      });

      await this.auditService.record(tx, {
        entity_type: 'approval',
        entity_id: approvalId,
        action: 'approval.decided',
        ...AuditService.user(actingUserId),
        before: { status: ApprovalStatus.pending },
        after: {
          status: ApprovalStatus.approved,
          delegated_from: delegatedFromUserId ?? null,
        },
      });

      if (approval.entity_type === 'evidence') {
        const evidence = await tx.evidence.update({
          where: { id: approval.entity_id },
          data: {
            approval_status: 'approved',
            reviewed_by: actingUserId,
            reviewed_at: new Date(),
          },
          select: { task_id: true },
        });
        if (evidence) {
          return this.evidenceService.validateTask(evidence.task_id, tx);
        }
      }

      return { approved: true, delegated_from: delegatedFromUserId };
    });
  }
}
