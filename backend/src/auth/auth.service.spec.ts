import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: any;
  let jwtService: any;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    password_hash: '', // will be set in beforeAll
    role_id: 'role-1',
    role: { code: 'FRONTEND_LEAD', name: 'Frontend Lead' },
    status: 'active',
    xp_total: 100,
    level: 2,
    function: 'frontend',
    created_at: new Date(),
    updated_at: new Date(),
    streak_days: 0,
  };

  beforeAll(async () => {
    mockUser.password_hash = await bcrypt.hash('correctPassword', 12);
  });

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('returns user when email and password are valid', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const result = await authService.validateUser(
        'test@example.com',
        'correctPassword',
      );
      expect(result).toBeDefined();
      expect(result!.id).toBe('user-1');
    });

    it('returns null when email does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      const result = await authService.validateUser(
        'nonexistent@example.com',
        'anyPassword',
      );
      expect(result).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const result = await authService.validateUser(
        'test@example.com',
        'wrongPassword',
      );
      expect(result).toBeNull();
    });

    it('returns null when user is inactive', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'inactive',
      });
      const result = await authService.validateUser(
        'test@example.com',
        'correctPassword',
      );
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns access token, refresh token, and user profile', async () => {
      jwtService.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');
      prismaService.refreshToken.create.mockResolvedValue({});

      const result = await authService.login(mockUser as any);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.user.id).toBe('user-1');
      expect(result.user.roleCode).toBe('FRONTEND_LEAD');
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(prismaService.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-1',
          }),
        }),
      );
    });
  });

  describe('refreshToken', () => {
    it('returns new access token for valid non-revoked refresh token', async () => {
      const refreshTokenValue = 'valid-refresh-token';
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshTokenValue)
        .digest('hex');

      prismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        user_id: 'user-1',
        token_hash: tokenHash,
        revoked_at: null,
        expires_at: new Date(Date.now() + 86400000),
        user: mockUser,
      });
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('new-access-token');

      const result = await authService.refreshToken(refreshTokenValue);
      expect(result.accessToken).toBe('new-access-token');
    });

    it('throws UnauthorizedException for revoked refresh token', async () => {
      prismaService.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        authService.refreshToken('revoked-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for expired refresh token', async () => {
      prismaService.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        authService.refreshToken('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the specific refresh token', async () => {
      const tokenHash = 'hashed-token';
      prismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        token_hash: tokenHash,
        revoked_at: null,
      });
      prismaService.refreshToken.update.mockResolvedValue({});

      await authService.logout(tokenHash);

      expect(prismaService.refreshToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ token_hash: tokenHash }),
        }),
      );
      expect(prismaService.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-1' },
        }),
      );
    });
  });

  describe('logoutAll', () => {
    it('revokes all refresh tokens for the user', async () => {
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await authService.logoutAll('user-1');

      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: 'user-1',
            revoked_at: null,
          }),
        }),
      );
    });
  });
});
