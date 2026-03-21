import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DelegationsService } from '../delegations.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DelegationsService', () => {
  let service: DelegationsService;
  let prisma: any;

  const now = new Date();
  const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  const activeDelegation = {
    id: 'delegation-1',
    from_user_id: 'user-a',
    from_user: { id: 'user-a', name: 'User A', role_id: 'role-1' },
    to_user_id: 'user-b',
    to_user: { id: 'user-b', name: 'User B' },
    start_date: pastDate,
    end_date: futureDate,
    created_by: 'admin-1',
    creator: { id: 'admin-1', name: 'Admin' },
    active: true,
    created_at: pastDate,
    updated_at: pastDate,
  };

  beforeEach(async () => {
    prisma = {
      approvalDelegation: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DelegationsService>(DelegationsService);
    jest.clearAllMocks();
  });

  describe('getActiveDelegationForUser', () => {
    it('calls findFirst with to_user_id, active=true, and date range covering now', async () => {
      prisma.approvalDelegation.findFirst.mockResolvedValue(activeDelegation);

      const result = await service.getActiveDelegationForUser('user-b');

      expect(prisma.approvalDelegation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            to_user_id: 'user-b',
            active: true,
            start_date: expect.objectContaining({ lte: expect.any(Date) }),
            end_date: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
      expect(result).toEqual(activeDelegation);
    });

    it('returns null when no active delegation exists', async () => {
      prisma.approvalDelegation.findFirst.mockResolvedValue(null);

      const result = await service.getActiveDelegationForUser('user-b');

      expect(result).toBeNull();
    });

    it('returns null for expired delegation (query returns null naturally)', async () => {
      // The Prisma query filters by end_date >= now, so expired delegations are excluded
      // This test verifies the query returns null when findFirst returns null
      prisma.approvalDelegation.findFirst.mockResolvedValue(null);

      const result = await service.getActiveDelegationForUser('user-b');

      expect(result).toBeNull();
    });

    it('returns null for deactivated delegation (active=false)', async () => {
      // The Prisma query filters by active: true, so inactive delegations are excluded
      prisma.approvalDelegation.findFirst.mockResolvedValue(null);

      const result = await service.getActiveDelegationForUser('user-b');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('throws BadRequestException when end_date < start_date', async () => {
      const dto = {
        from_user_id: 'user-a',
        to_user_id: 'user-b',
        start_date: futureDate.toISOString(),
        end_date: pastDate.toISOString(),
      };

      await expect(
        service.create(dto as any, 'admin-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(dto as any, 'admin-1'),
      ).rejects.toThrow('end_date must be on or after start_date');
    });

    it('creates delegation with active=true when dates are valid', async () => {
      const dto = {
        from_user_id: 'user-a',
        to_user_id: 'user-b',
        start_date: pastDate.toISOString(),
        end_date: futureDate.toISOString(),
      };
      prisma.approvalDelegation.create.mockResolvedValue(activeDelegation);

      const result = await service.create(dto as any, 'admin-1');

      expect(prisma.approvalDelegation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            from_user_id: 'user-a',
            to_user_id: 'user-b',
            created_by: 'admin-1',
            active: true,
          }),
        }),
      );
    });
  });

  describe('deactivate', () => {
    it('calls update with active=false', async () => {
      prisma.approvalDelegation.findUnique.mockResolvedValue(activeDelegation);
      prisma.approvalDelegation.update.mockResolvedValue({ ...activeDelegation, active: false });

      const result = await service.deactivate('delegation-1');

      expect(prisma.approvalDelegation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'delegation-1' },
          data: { active: false },
        }),
      );
      expect(result.active).toBe(false);
    });

    it('throws NotFoundException when delegation does not exist', async () => {
      prisma.approvalDelegation.findUnique.mockResolvedValue(null);

      await expect(
        service.deactivate('missing-delegation'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
