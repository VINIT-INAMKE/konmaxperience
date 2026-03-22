import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../types/auth';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) return null;
    if (user.status !== 'active') return null;

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) return null;

    return user;
  }

  async login(user: any) {
    const payload: JwtPayload = {
      userId: user.id,
      roleCode: user.role.code,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Hash refresh token with SHA-256 before storing
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleCode: user.role.code,
        roleName: user.role.name,
        permissions: user.role.permissions,
        xp_total: user.xp_total,
        level: user.level,
      },
    };
  }

  async refreshToken(refreshTokenValue: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshTokenValue)
      .digest('hex');

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      include: {
        user: {
          include: { role: true },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = storedToken.user;

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Revoke the old refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked_at: new Date() },
    });

    const payload: JwtPayload = {
      userId: user.id,
      roleCode: user.role.code,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    // Issue a new refresh token (rotation)
    const newRefreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    const newTokenHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: newTokenHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleCode: user.role.code,
        roleName: user.role.name,
        permissions: user.role.permissions,
        xp_total: user.xp_total,
        level: user.level,
      },
    };
  }

  async logout(tokenHash: string) {
    // token_hash is not unique in schema, so use findFirst + update by id
    const token = await this.prisma.refreshToken.findFirst({
      where: { token_hash: tokenHash, revoked_at: null },
    });
    if (token) {
      await this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revoked_at: new Date() },
      });
    }
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        user_id: userId,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Log but don't error -- prevent email enumeration
      return;
    }

    // Invalidate all existing unused reset tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    return { token, userName: user.name, userEmail: user.email };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token_hash: tokenHash,
        expires_at: { gt: new Date() },
        used_at: null,
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: resetToken.user_id },
      data: { password_hash: passwordHash },
    });

    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used_at: new Date() },
    });

    // Revoke all active refresh tokens for this user (invalidate all sessions)
    await this.prisma.refreshToken.updateMany({
      where: { user_id: resetToken.user_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async setPassword(token: string, newPassword: string) {
    // Same logic as resetPassword -- for new user initial setup
    return this.resetPassword(token, newPassword);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        xp_total: true,
        level: true,
        created_at: true,
        role: { select: { code: true, name: true, permissions: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleCode: user.role.code,
      roleName: user.role.name,
      permissions: user.role.permissions,
      status: user.status,
      xpTotal: user.xp_total,
      level: user.level,
      createdAt: user.created_at.toISOString(),
    };
  }
}
