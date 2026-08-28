import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateNotificationPrefsDto } from './dto/notification-prefs.dto';
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

/**
 * RUN-01 — staff contactability. `User.phone` and `User.whatsapp_opt_in` are
 * what let the dispatcher reach a person outside the app, so the rules around
 * them are about consent, not about data entry.
 */
describe('UsersService — staff contactability', () => {
  let service: UsersService;
  let prisma: MockPrisma;

  const OTHER_ID = '33333333-3333-4333-8333-333333333333';

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: mockEmail() },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('lets an admin set another user’s phone through PATCH /users/:id', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: OTHER_ID,
      status: 'active',
      phone: null,
    });
    prisma.user.update.mockResolvedValue({ id: OTHER_ID });

    await service.update(OTHER_ID, {
      phone: '9876543210',
      whatsapp_opt_in: true,
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: OTHER_ID },
        data: expect.objectContaining({
          phone: '9876543210',
          whatsapp_opt_in: true,
        }),
      }),
    );
  });

  it('writes only the calling user’s row from the self-service route', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: HUMAN_ID,
      phone: '9876543210',
    });
    prisma.user.update.mockResolvedValue({
      id: HUMAN_ID,
      phone: '9876543210',
      whatsapp_opt_in: false,
    });

    // The id is the caller's, taken from the JWT — the body carries no subject.
    await service.updateNotificationPrefs(HUMAN_ID, {
      whatsapp_opt_in: false,
    });

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: HUMAN_ID } }),
    );
  });

  it('forces the opt-in off when there is no number to send to', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: HUMAN_ID, phone: null });
    prisma.user.update.mockResolvedValue({ id: HUMAN_ID });

    await service.updateNotificationPrefs(HUMAN_ID, { whatsapp_opt_in: true });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ whatsapp_opt_in: false }),
      }),
    );
  });

  it('withdraws the opt-in when the number is cleared', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: HUMAN_ID,
      phone: '9876543210',
    });
    prisma.user.update.mockResolvedValue({ id: HUMAN_ID });

    await service.updateNotificationPrefs(HUMAN_ID, { phone: null });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { phone: null, whatsapp_opt_in: false },
      }),
    );
  });

  it('never opts a newly created user in', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      code: 'BACKEND_LEAD',
    });
    prisma.user.create.mockResolvedValue({ id: HUMAN_ID });
    prisma.passwordResetToken.create.mockResolvedValue({});

    await service.create(
      {
        name: 'Ada',
        email: 'ada@konma.store',
        roleId: 'role-1',
        // Asking for the opt-in without a number must not create the dead end.
        whatsapp_opt_in: true,
      },
      HUMAN_ID,
    );

    const data = prisma.user.create.mock.calls[0][0].data as {
      whatsapp_opt_in?: boolean;
    };
    expect(data.whatsapp_opt_in).toBe(false);
  });

  it('exposes the contact columns on the roster and the detail read', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          phone: true,
          whatsapp_opt_in: true,
        }),
      }),
    );

    prisma.user.findUnique.mockResolvedValue({ id: HUMAN_ID });
    await service.findOne(HUMAN_ID);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          phone: true,
          whatsapp_opt_in: true,
        }),
      }),
    );
  });
});

describe('phone validation', () => {
  const createErrors = (body: Record<string, unknown>) =>
    validate(
      plainToInstance(CreateUserDto, {
        name: 'Ada',
        email: 'ada@konma.store',
        roleId: '11111111-1111-4111-8111-111111111111',
        ...body,
      }),
    );

  const prefErrors = (body: Record<string, unknown>) =>
    validate(plainToInstance(UpdateNotificationPrefsDto, body));

  it('accepts a bare ten-digit mobile number', async () => {
    await expect(createErrors({ phone: '9876543210' })).resolves.toEqual([]);
  });

  it('accepts a thirteen-digit number with a country code', async () => {
    await expect(createErrors({ phone: '9198765432100' })).resolves.toEqual([]);
  });

  // `WhatsAppService.normalize` prepends `91` to whatever it is given, so a
  // number carrying punctuation would be sent as a number that does not exist.
  it.each(['98765', '+919876543210', '98765 43210', '98765-43210', 'abcdefghij'])(
    'rejects %p',
    async (phone) => {
      const bad = await prefErrors({ phone });
      expect(bad.map((e) => e.property)).toContain('phone');
    },
  );

  it('treats an omitted phone and an explicit null as "leave it / clear it"', async () => {
    await expect(prefErrors({ whatsapp_opt_in: true })).resolves.toEqual([]);
    await expect(prefErrors({ phone: null })).resolves.toEqual([]);
  });
});
