import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { SettingsService } from '../settings/settings.service';
import { NodeService } from '../node/node.service';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../customer-auth/whatsapp.service';
import { WHATSAPP_TEMPLATES, TemplateContext } from './notification-templates';
import { isQuietHour } from './quiet-hours';

/** Cooldown for a type with no entry in `notifications.cooldown_hours`. */
const DEFAULT_COOLDOWN_HOURS = 24;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface DispatchInput {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link_url?: string;
  reference_id: string;
  reference_type: string;
  /** Substitutions for the WhatsApp template's positional params. */
  template_ctx?: TemplateContext;
}

export interface DispatchResult {
  id: string;
  channels: NotificationChannel[];
}

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly node: NodeService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  /**
   * The one way P6 sends anything to a staff member (RUN-01).
   *
   * Channel resolution, in order:
   *   in_app   — always. It is a pull surface; suppressing it loses the record.
   *   email    — when the type is in `settings.notifications.email_types`.
   *   whatsapp — when the master switch is on, a template exists for the type,
   *              the user opted in, the user has a phone, and it is not quiet
   *              hours (decision 11).
   *
   * Returns `null` when the cooldown blocks the send, or when the recipient is
   * gone or deactivated, so a caller can count suppressions. The cooldown is
   * checked once for the whole dispatch, not per channel — a nudge is one event
   * however many ways it travels.
   */
  async dispatch(input: DispatchInput): Promise<DispatchResult | null> {
    const cfg = await this.settings.get('notifications');
    const cooldown =
      cfg.cooldown_hours[input.type as keyof typeof cfg.cooldown_hours] ??
      DEFAULT_COOLDOWN_HOURS;

    const fresh = await this.notifications.shouldNotify(
      input.user_id,
      input.type,
      input.reference_id,
      cooldown,
    );
    if (!fresh) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: input.user_id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        whatsapp_opt_in: true,
        status: true,
      },
    });
    if (!user || user.status !== 'active') return null;

    const channels: NotificationChannel[] = [NotificationChannel.in_app];
    const wantsEmail = cfg.email_types.includes(input.type);
    const template = WHATSAPP_TEMPLATES[input.type];
    const timeZone = await this.node.timezone();
    const quiet = isQuietHour(new Date(), timeZone, cfg.quiet_hours);
    const wantsWhatsApp =
      cfg.whatsapp_enabled &&
      !!template &&
      user.whatsapp_opt_in &&
      !!user.phone &&
      !quiet;

    if (wantsEmail) channels.push(NotificationChannel.email);
    if (wantsWhatsApp) channels.push(NotificationChannel.whatsapp);

    // The row records what was *attempted*. A provider failure below is logged,
    // not un-recorded: "we tried to WhatsApp you and Meta was down" is the fact
    // an operator needs, and a rollback here would re-fire on the next sweep.
    // Quiet hours are the deliberate exception — they leave no row at all for
    // the WhatsApp leg because they never add the channel, so the next sweep
    // outside the window re-sends once (decision 11).
    const notification = await this.notifications.create({
      user_id: user.id,
      type: input.type,
      title: input.title,
      body: input.body,
      link_url: input.link_url,
      reference_id: input.reference_id,
      reference_type: input.reference_type,
      channel: channels,
    });

    if (wantsEmail) {
      const target = `${this.email.publicFrontendUrl}${input.link_url ?? ''}`;
      await this.safely('email', () =>
        this.email.sendHtml(
          { email: user.email, name: user.name },
          `[Konma] ${input.title}`,
          `<p>Hi ${escapeHtml(user.name)},</p>` +
            `<p>${escapeHtml(input.body)}</p>` +
            `<p><a href="${target}">Open Konma Xperience</a></p>` +
            `<p>-- Konma Xperience Team</p>`,
          `Hi ${user.name},\n\n${input.body}\n\n` +
            `Open Konma Xperience: ${target}\n\n` +
            `-- Konma Xperience Team`,
        ),
      );
    }

    if (wantsWhatsApp && template && user.phone) {
      await this.safely('whatsapp', () =>
        this.whatsapp.sendTemplate(
          user.phone as string,
          template.name,
          template.params(input.template_ctx ?? {}),
        ),
      );
    }

    return { id: notification.id, channels };
  }

  /** `sendTemplate` throws on a Meta error; a nudge must never fail its caller. */
  private async safely(
    channel: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(
        `${channel} dispatch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
