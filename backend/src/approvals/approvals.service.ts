import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceService } from '../evidence/evidence.service';
import { DelegationsService } from '../delegations/delegations.service';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { Permission } from '../types/permissions';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceService: EvidenceService,
    private readonly delegationsService: DelegationsService,
  ) {}

  async findPending() {
    return this.prisma.approval.findMany({
      where: { status: 'pending' },
      include: {
        approver: { select: { id: true, name: true } },
        task: {
          include: {
            evidence: true,
            owner: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Override any pending approval (admin only).
   * Finds approval by entity_id + entity_type (not by Approval primary key).
   * If entity_type is 'evidence', also updates Evidence approval_status and fires validateTask cascade.
   */
  async overrideApproval(
    entityId: string,
    entityType: string,
    adminId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const approval = await tx.approval.findFirst({
        where: { entity_id: entityId, entity_type: entityType, status: 'pending' },
      });

      if (!approval) {
        throw new NotFoundException(
          `No pending approval found for ${entityType} ${entityId}`,
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

      // Per D-10: if evidence approval, update Evidence record AND fire validation cascade
      if (entityType === 'evidence') {
        await tx.evidence.update({
          where: { id: entityId },
          data: {
            approval_status: 'approved',
            reviewed_by: adminId,
            reviewed_at: new Date(),
          },
        });
        const evidence = await tx.evidence.findUnique({ where: { id: entityId } });
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

    return this.prisma.$transaction(async (tx: any) => {
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

      if (approval.entity_type === 'evidence') {
        await tx.evidence.update({
          where: { id: approval.entity_id },
          data: {
            approval_status: 'approved',
            reviewed_by: actingUserId,
            reviewed_at: new Date(),
          },
        });
        const evidence = await tx.evidence.findUnique({
          where: { id: approval.entity_id },
        });
        if (evidence) {
          return this.evidenceService.validateTask(evidence.task_id, tx);
        }
      }

      return { approved: true, delegated_from: delegatedFromUserId };
    });
  }
}
