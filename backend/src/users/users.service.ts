import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateUserDto } from '../types/users';
import {
  SYSTEM_ROLE_CODE,
  SYSTEM_USER_ID,
  SYSTEM_USER_STATUS,
} from '../common/constants/system-actor';

/**
 * RUN-01 — the two columns that make a teammate contactable outside the app.
 * They travel together everywhere: a number without consent must not be
 * messaged, and consent without a number is a dead end (see `contactWrite`).
 */
export interface StaffContactInput {
  phone?: string | null;
  whatsapp_opt_in?: boolean;
}

/** The contact columns every user read exposes. */
const CONTACT_SELECT = {
  phone: true,
  whatsapp_opt_in: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * SPEC §4.2 (plan decision 3) — the MissionBridge writes as a seeded `User`
   * because `Evidence.uploaded_by` is a required FK. That account is machinery,
   * not a teammate: it must never appear in the admin roster and must never be
   * renamed, re-roled, reactivated or deactivated through the users API.
   */
  private assertNotSystemUser(id: string): void {
    if (id === SYSTEM_USER_ID) {
      throw new ForbiddenException('The system account cannot be modified');
    }
  }

  /**
   * Turns a contact patch into the `data` fragment for a `user.update`.
   *
   * The one rule the callers must not be able to skip: **an opt-in without a
   * number is forced back off.** `NotificationDispatcher` already refuses to
   * send when `phone` is empty, so a row in that state is not dangerous — it is
   * worse than that, it is a lie the person reads on their own settings screen
   * ("WhatsApp on") while nothing is ever delivered. `currentPhone` is the value
   * already stored, so turning the opt-in on in one request and setting the
   * number in another still lands correctly.
   */
  private contactWrite(
    dto: StaffContactInput,
    currentPhone: string | null,
  ): { phone?: string | null; whatsapp_opt_in?: boolean } {
    const data: { phone?: string | null; whatsapp_opt_in?: boolean } = {};

    if (dto.phone !== undefined) {
      const trimmed = typeof dto.phone === 'string' ? dto.phone.trim() : null;
      data.phone = trimmed ? trimmed : null;
    }
    if (dto.whatsapp_opt_in !== undefined) {
      data.whatsapp_opt_in = dto.whatsapp_opt_in;
    }

    const resultingPhone =
      data.phone !== undefined ? data.phone : currentPhone;
    if (!resultingPhone && (data.whatsapp_opt_in ?? false)) {
      data.whatsapp_opt_in = false;
    }
    // Clearing the number withdraws the consent that depended on it.
    if (data.phone === null) {
      data.whatsapp_opt_in = false;
    }

    return data;
  }

  async findAll() {
    return this.prisma.user.findMany({
      // Hides the bridge account from /admin/users. Every other reader already
      // filters `status: 'active'` (leaderboard, chat, activity, notifications).
      where: { status: { not: SYSTEM_USER_STATUS } },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { code: true, name: true } },
        status: true,
        xp_total: true,
        level: true,
        // RUN-01 — the roster is where an admin sees who can be nudged at all.
        ...CONTACT_SELECT,
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
    // Beyond the roster: `GET /users/:id` and the admin `?viewAs=` filter both
    // land here, so the bridge account is unreachable through every read path.
    if (id === SYSTEM_USER_ID) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

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
        ...CONTACT_SELECT,
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

  async create(dto: CreateUserDto & StaffContactInput, createdByUserId: string) {
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
    // SYSTEM holds zero permissions and exists only for the bridge; handing it
    // to a person would create an account nobody can act as.
    if (role.code === SYSTEM_ROLE_CODE) {
      throw new BadRequestException('SYSTEM is not an assignable role');
    }

    // A new account has no number yet, so `contactWrite`'s "no phone means no
    // opt-in" rule is what makes `whatsapp_opt_in` default false on create even
    // when the caller asks for true.
    const contact = this.contactWrite(dto, null);

    // Create user and setup token in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password_hash: placeholderHash,
          role_id: dto.roleId,
          function: role.code.toLowerCase().replace(/_/g, '-'),
          ...contact,
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

  async update(
    id: string,
    dto: { name?: string; status?: string } & StaffContactInput,
  ) {
    this.assertNotSystemUser(id);

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true, phone: true },
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
        ...this.contactWrite(dto, existing.phone ?? null),
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

  /**
   * RUN-01 — the calling user's own contact preferences.
   *
   * `id` comes from the verified JWT, never from the body or the path, so there
   * is no user to authorise against: this method can only ever write the row of
   * the person who called it. That is the whole reason it exists separately
   * from `update()`, which is gated behind `MANAGE_RBAC` — a teammate must be
   * able to turn their own WhatsApp nudges off without asking an admin.
   */
  async updateNotificationPrefs(id: string, dto: StaffContactInput) {
    this.assertNotSystemUser(id);

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, phone: true },
    });
    if (!existing) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data: this.contactWrite(dto, existing.phone ?? null),
      select: { id: true, ...CONTACT_SELECT },
    });
  }

  async triggerPasswordReset(id: string) {
    // A reset is the one path that would replace `password_hash: '!'` with a
    // real bcrypt digest, so it is closed too.
    this.assertNotSystemUser(id);

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
    // The plan calls this guard `remove()`; the service deactivates rather than
    // deletes, and this is the only destructive path on a user row.
    this.assertNotSystemUser(id);

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
