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
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.user_id },
      include: { role: true },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User not found or inactive');
    }

    const payload: JwtPayload = {
      userId: user.id,
      roleCode: user.role.code,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    return { accessToken };
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
  }

  async setPassword(token: string, newPassword: string) {
    // Same logic as resetPassword -- for new user initial setup
    return this.resetPassword(token, newPassword);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
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
      status: user.status,
      xpTotal: user.xp_total,
      level: user.level,
      createdAt: user.created_at.toISOString(),
    };
  }
}
