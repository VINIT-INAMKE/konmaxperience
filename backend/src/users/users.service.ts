import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateUserDto } from '../types/users';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { code: true, name: true } },
        status: true,
        xp_total: true,
        level: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  private stripSensitive(user: any) {
    if (!user) return user;
    const { password_hash, ...safe } = user;
    return safe;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        function: true,
        status: true,
        xp_total: true,
        level: true,
        streak_days: true,
        role_id: true,
        created_at: true,
        updated_at: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async create(dto: CreateUserDto, createdByUserId: string) {
    // Validate email uniqueness — only need existence check
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    // Generate setup token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenHash = crypto
      .createHash('sha256')
      .update(setupToken)
      .digest('hex');

    // Hash placeholder password -- user will set real password via email link
    const placeholder = crypto.randomBytes(32).toString('hex');
    const placeholderHash = await bcrypt.hash(placeholder, 12);

    // Look up the role to get the function field — only need the code
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
      select: { id: true, code: true },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${dto.roleId} not found`);
    }

    // Create user and setup token in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password_hash: placeholderHash,
          role_id: dto.roleId,
          function: role.code.toLowerCase().replace(/_/g, '-'),
        },
        include: { role: true },
      });

      await tx.passwordResetToken.create({
        data: {
          user_id: newUser.id,
          token_hash: setupTokenHash,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours for initial setup
        },
      });

      return newUser;
    });

    // Send setup email after transaction commits (side effect -- cannot roll back email)
    await this.emailService.sendPasswordSetup(dto.email, setupToken, dto.name);

    return this.stripSensitive(user);
  }

  async update(id: string, dto: { name?: string; status?: string }) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { name, status } = dto;
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(status !== undefined && { status }),
      },
      include: { role: true },
    });

    // If status changed to inactive, revoke all refresh tokens
    if (dto.status === 'inactive' && existing.status !== 'inactive') {
      await this.prisma.refreshToken.updateMany({
        where: { user_id: id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      this.logger.log(`Revoked all refresh tokens for deactivated user ${id}`);
    }

    return this.stripSensitive(updated);
  }

  async triggerPasswordReset(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
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

    await this.emailService.sendPasswordReset(user.email, token, user.name);
  }

  async deactivate(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Parallelize user update and token revocation (independent writes)
    const [updated] = await Promise.all([
      this.prisma.user.update({
        where: { id },
        data: { status: 'inactive' },
        include: { role: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { user_id: id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);

    return this.stripSensitive(updated);
  }
}
