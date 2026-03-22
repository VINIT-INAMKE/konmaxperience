import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApprovalsService } from '../approvals.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EvidenceService } from '../../evidence/evidence.service';
import { DelegationsService } from '../../delegations/delegations.service';
import { Permission } from '../../types/permissions';

const mockGetPermissionsForRole = jest.fn();

jest.mock('../../permissions/permissions.cache', () => ({
  getPermissionsForRole: (...args: any[]) => mockGetPermissionsForRole(...args),
}));

describe('ApprovalsService', () => {
  let service: ApprovalsService;
  let prisma: any;
  let txMock: any;
  let evidenceService: any;
  let delegationsService: any;

  const mockApproval = {
    id: 'approval-1',
    entity_type: 'evidence',
    entity_id: 'evidence-1',
    approval_scope: 'review',
    required_role_code: 'OPS_LEAD',
    approved_by: null,
    status: 'pending',
    notes: null,
  };

  const mockEvidence = {
    id: 'evidence-1',
    task_id: 'task-1',
    uploaded_by: 'user-1',
    approval_status: 'approved',
  };

  const mockDelegation = {
    id: 'delegation-1',
    from_user_id: 'user-a',
    to_user_id: 'user-b',
    active: true,
    from_user: { id: 'user-a', name: 'User A', role_id: 'role-1' },
  };

  beforeEach(async () => {
    txMock = {
      approval: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      evidence: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    prisma = {
      approval: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((cb: any) => cb(txMock)),
    };

    evidenceService = {
      validateTask: jest.fn().mockResolvedValue({ valid: true, valid_xp: 100, user: { id: 'user-1', xp_total: 100, level: 1 } }),
    };

    delegationsService = {
      getActiveDelegationForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EvidenceService, useValue: evidenceService },
        { provide: DelegationsService, useValue: delegationsService },
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
    jest.clearAllMocks();
    mockGetPermissionsForRole.mockReset();
  });

  describe('overrideApproval', () => {
    it('updates Approval status, override fields, Evidence approval_status, and calls validateTask for evidence entity', async () => {
      txMock.approval.findFirst.mockResolvedValue(mockApproval);
      txMock.approval.update.mockResolvedValue({ ...mockApproval, status: 'approved' });
      txMock.evidence.update.mockResolvedValue(mockEvidence);
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);

      await service.overrideApproval('evidence-1', 'admin-1', 'Urgent override reason');

      expect(txMock.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'approval-1' },
          data: expect.objectContaining({
            status: 'approved',
            approved_by: 'admin-1',
            override_by: 'admin-1',
            override_reason: 'Urgent override reason',
            override_at: expect.any(Date),
          }),
        }),
      );

      expect(txMock.evidence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evidence-1' },
          data: expect.objectContaining({ approval_status: 'approved' }),
        }),
      );

      expect(evidenceService.validateTask).toHaveBeenCalledWith('task-1', txMock);
    });

    it('does NOT call validateTask when entity_type is not evidence', async () => {
      const taskApproval = { ...mockApproval, entity_type: 'task', entity_id: 'task-1' };
      txMock.approval.findFirst.mockResolvedValue(taskApproval);
      txMock.approval.update.mockResolvedValue({ ...taskApproval, status: 'approved' });

      const result = await service.overrideApproval('task-1', 'admin-1', 'Override reason text');

      expect(evidenceService.validateTask).not.toHaveBeenCalled();
      expect(result).toEqual({ overridden: true });
    });

    it('throws NotFoundException when no pending approval exists for the entity', async () => {
      txMock.approval.findFirst.mockResolvedValue(null);

      await expect(
        service.overrideApproval('missing-1', 'admin-1', 'Override reason here'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveWithDelegation', () => {
    it('does NOT query delegations when user already has APPROVE_EVIDENCE permission', async () => {
      mockGetPermissionsForRole.mockResolvedValue([Permission.APPROVE_EVIDENCE]);
      txMock.approval.findUnique.mockResolvedValue({ ...mockApproval, id: 'approval-1' });
      txMock.approval.update.mockResolvedValue({ ...mockApproval, status: 'approved' });
      txMock.evidence.update.mockResolvedValue(mockEvidence);
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);

      await service.approveWithDelegation('approval-1', 'user-b', 'OPS_LEAD');

      expect(delegationsService.getActiveDelegationForUser).not.toHaveBeenCalled();
    });

    it('sets delegated_from_user_id when user lacks permission but has active delegation', async () => {
      mockGetPermissionsForRole.mockResolvedValue([]);
      delegationsService.getActiveDelegationForUser.mockResolvedValue(mockDelegation);
      txMock.approval.findUnique.mockResolvedValue(mockApproval);
      txMock.approval.update.mockResolvedValue({ ...mockApproval, status: 'approved' });
      txMock.evidence.update.mockResolvedValue(mockEvidence);
      txMock.evidence.findUnique.mockResolvedValue(mockEvidence);

      await service.approveWithDelegation('approval-1', 'user-b', 'FOOD_LEAD');

      expect(delegationsService.getActiveDelegationForUser).toHaveBeenCalledWith('user-b');
      expect(txMock.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            delegated_from_user_id: 'user-a',
          }),
        }),
      );
    });

    it('throws ForbiddenException when user lacks permission AND has no active delegation', async () => {
      mockGetPermissionsForRole.mockResolvedValue([]);
      delegationsService.getActiveDelegationForUser.mockResolvedValue(null);

      await expect(
        service.approveWithDelegation('approval-1', 'user-b', 'FOOD_LEAD'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.approveWithDelegation('approval-1', 'user-b', 'FOOD_LEAD'),
      ).rejects.toThrow('No permission to approve and no active delegation');
    });
  });
});
