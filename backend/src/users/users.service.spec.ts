import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  mockEmail,
  mockPrisma,
  MockPrisma,
} from '../test-utils/mock-providers';
import {
  SYSTEM_ROLE_CODE,
  SYSTEM_USER_ID,
  SYSTEM_USER_STATUS,
} from '../common/constants/system-actor';

const HUMAN_ID = '22222222-2222-4222-8222-222222222222';

describe('UsersService — the system actor is invisible and untouchable', () => {
  let service: UsersService;
  let prisma: MockPrisma;
  let email: ReturnType<typeof mockEmail>;

  beforeEach(async () => {
    prisma = mockPrisma();
    email = mockEmail();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('excludes every account with status "system"', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { not: SYSTEM_USER_STATUS } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('reports the system account as not found without hitting the database', async () => {
      await expect(service.findOne(SYSTEM_USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('still returns a real user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: HUMAN_ID, name: 'Ada' });

      await expect(service.findOne(HUMAN_ID)).resolves.toEqual(
        expect.objectContaining({ id: HUMAN_ID }),
      );
    });
  });

  describe('update', () => {
    it('refuses to modify the system account', async () => {
      await expect(
        service.update(SYSTEM_USER_ID, { status: 'active' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('still updates a real user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: HUMAN_ID,
        status: 'active',
      });
      prisma.user.update.mockResolvedValue({ id: HUMAN_ID, name: 'Ada Two' });

      await service.update(HUMAN_ID, { name: 'Ada Two' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: HUMAN_ID } }),
      );
    });
  });

  describe('deactivate', () => {
    it('refuses to deactivate the system account', async () => {
      await expect(service.deactivate(SYSTEM_USER_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('triggerPasswordReset', () => {
    it('refuses to issue a reset token for the system account', async () => {
      await expect(
        service.triggerPasswordReset(SYSTEM_USER_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(email.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Impostor',
      email: 'impostor@konma.store',
      roleId: 'role-1',
    };

    it('refuses to hand the SYSTEM role to a human user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        code: SYSTEM_ROLE_CODE,
      });

      await expect(service.create(dto, HUMAN_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(email.sendPasswordSetup).not.toHaveBeenCalled();
    });

    it('still creates a user for a real role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        code: 'BACKEND_LEAD',
      });
      prisma.user.create.mockResolvedValue({
        id: HUMAN_ID,
        password_hash: 'hashed',
      });
      prisma.passwordResetToken.create.mockResolvedValue({});

      const created: unknown = await service.create(dto, HUMAN_ID);

      expect(prisma.user.create).toHaveBeenCalled();
      expect(created).not.toHaveProperty('password_hash');
      expect(email.sendPasswordSetup).toHaveBeenCalled();
    });
  });
});
