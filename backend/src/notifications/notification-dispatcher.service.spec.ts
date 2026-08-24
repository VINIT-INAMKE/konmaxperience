import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SETTING_DEFAULTS,
  SettingsService,
} from '../settings/settings.service';
import { NodeService } from '../node/node.service';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../customer-auth/whatsapp.service';
import {
  MockPrisma,
  mockPrisma,
  mockEmail,
  mockNodeService,
  mockSettings,
  mockWhatsApp,
} from '../test-utils/mock-providers';

/** 12:00 in `Asia/Kolkata` — outside the seeded 21:00–07:00 quiet window. */
const DAYTIME = new Date('2026-08-24T06:30:00Z');
/** 23:00 in `Asia/Kolkata` — inside it. */
const NIGHT = new Date('2026-08-24T17:30:00Z');

const ACTIVE_USER = {
  id: 'user-1',
  name: 'Priya <Ops>',
  email: 'priya@konma.test',
  phone: '9876543210',
  whatsapp_opt_in: true,
  status: 'active',
};

type NotificationsDouble = {
  shouldNotify: jest.Mock;
  create: jest.Mock;
};

describe('NotificationDispatcher', () => {
  let dispatcher: NotificationDispatcher;
  let prisma: MockPrisma;
  let notifications: NotificationsDouble;
  let settings: ReturnType<typeof mockSettings>;
  let email: ReturnType<typeof mockEmail>;
  let whatsapp: ReturnType<typeof mockWhatsApp>;

  /** Rebuild the module with a `notifications` settings block layered on. */
  async function build(
    overrides: Partial<typeof SETTING_DEFAULTS.notifications> = {},
  ): Promise<void> {
    prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(ACTIVE_USER);

    notifications = {
      shouldNotify: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockResolvedValue({ id: 'notif-1', user_id: 'user-1' }),
    };
    settings = mockSettings({
      notifications: { ...SETTING_DEFAULTS.notifications, ...overrides },
    });
    email = mockEmail();
    whatsapp = mockWhatsApp();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDispatcher,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: SettingsService, useValue: settings },
        { provide: NodeService, useValue: mockNodeService() },
        { provide: EmailService, useValue: email },
        { provide: WhatsAppService, useValue: whatsapp },
      ],
    }).compile();

    dispatcher = module.get(NotificationDispatcher);
  }

  /** Run one dispatch with the clock pinned; timers are always handed back. */
  async function dispatchAt(
    at: Date,
    input: Parameters<NotificationDispatcher['dispatch']>[0],
  ) {
    jest.useFakeTimers().setSystemTime(at);
    try {
      return await dispatcher.dispatch(input);
    } finally {
      jest.useRealTimers();
    }
  }

  const brief = {
    user_id: 'user-1',
    type: NotificationType.morning_brief,
    title: 'Your morning brief',
    body: 'Yesterday closed clean.',
    link_url: '/dashboard',
    reference_id: '2026-08-23',
    reference_type: 'daily_brief',
    template_ctx: { headline: 'Yesterday closed clean.' },
  };

  const approval = {
    user_id: 'user-1',
    type: NotificationType.approval_pending,
    title: 'Approval waiting 26h',
    body: 'Prep the Sunday menu evidence has been pending approval.',
    link_url: '/approvals',
    reference_id: 'approval-9',
    reference_type: 'approval',
    template_ctx: { subject: 'Prep the Sunday menu', hours: 26 },
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('writes in_app alone when no other channel is enabled', async () => {
    await build();

    const result = await dispatchAt(DAYTIME, brief);

    expect(result).toEqual({ id: 'notif-1', channels: ['in_app'] });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: NotificationType.morning_brief,
        reference_id: '2026-08-23',
        reference_type: 'daily_brief',
        channel: ['in_app'],
      }),
    );
    expect(email.sendHtml).not.toHaveBeenCalled();
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('returns null and writes no row inside the cooldown', async () => {
    await build();
    notifications.shouldNotify.mockResolvedValue(false);

    const result = await dispatchAt(DAYTIME, approval);

    expect(result).toBeNull();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(email.sendHtml).not.toHaveBeenCalled();
  });

  it('takes the cooldown for the type from the notifications setting', async () => {
    await build();

    await dispatchAt(DAYTIME, approval);
    expect(notifications.shouldNotify).toHaveBeenCalledWith(
      'user-1',
      NotificationType.approval_pending,
      'approval-9',
      SETTING_DEFAULTS.notifications.cooldown_hours.approval_pending,
    );

    await dispatchAt(DAYTIME, {
      ...approval,
      type: NotificationType.low_stock,
      reference_id: 'ingredient-3',
    });
    expect(notifications.shouldNotify).toHaveBeenLastCalledWith(
      'user-1',
      NotificationType.low_stock,
      'ingredient-3',
      SETTING_DEFAULTS.notifications.cooldown_hours.low_stock,
    );
  });

  it('falls back to 24h for a type with no configured cooldown', async () => {
    await build();

    await dispatchAt(DAYTIME, {
      ...approval,
      type: NotificationType.task_due,
      reference_id: 'task-7',
    });

    expect(notifications.shouldNotify).toHaveBeenCalledWith(
      'user-1',
      NotificationType.task_due,
      'task-7',
      24,
    );
  });

  it('adds email for a type in email_types and sends exactly one', async () => {
    await build();

    const result = await dispatchAt(DAYTIME, approval);

    expect(result?.channels).toEqual(['in_app', 'email']);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ channel: ['in_app', 'email'] }),
    );
    expect(email.sendHtml).toHaveBeenCalledTimes(1);
    const [to, subject, html] = email.sendHtml.mock.calls[0] as [
      { email: string; name: string },
      string,
      string,
      string,
    ];
    expect(to).toEqual({ email: 'priya@konma.test', name: 'Priya <Ops>' });
    expect(subject).toBe('[Konma] Approval waiting 26h');
    // The recipient name is interpolated into HTML, so it must be escaped.
    expect(html).toContain('Priya &lt;Ops&gt;');
    expect(html).not.toContain('<Ops>');
  });

  it('adds whatsapp and sends the template with its exact positional params', async () => {
    await build({ whatsapp_enabled: true });

    const result = await dispatchAt(DAYTIME, approval);

    expect(result?.channels).toEqual(['in_app', 'email', 'whatsapp']);
    expect(whatsapp.sendTemplate).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendTemplate).toHaveBeenCalledWith(
      '9876543210',
      'staff_approval_waiting',
      ['Prep the Sunday menu', '26'],
    );
  });

  it('suppresses whatsapp inside quiet hours but still writes the row', async () => {
    await build({ whatsapp_enabled: true });

    const result = await dispatchAt(NIGHT, brief);

    expect(result?.channels).toEqual(['in_app']);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ channel: ['in_app'] }),
    );
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it.each([
    ['the user has not opted in', { whatsapp_opt_in: false }],
    ['the user has no phone', { phone: null }],
  ])('skips whatsapp when %s', async (_label, patch) => {
    await build({ whatsapp_enabled: true });
    prisma.user.findUnique.mockResolvedValue({ ...ACTIVE_USER, ...patch });

    const result = await dispatchAt(DAYTIME, brief);

    expect(result?.channels).toEqual(['in_app']);
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('skips whatsapp for a type with no registered template', async () => {
    await build({ whatsapp_enabled: true });

    const result = await dispatchAt(DAYTIME, {
      ...brief,
      type: NotificationType.daily_close_due,
      reference_id: '2026-08-23',
    });

    expect(result?.channels).toEqual(['in_app']);
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('swallows a Meta failure and keeps the notification row', async () => {
    await build({ whatsapp_enabled: true });
    whatsapp.sendTemplate.mockRejectedValue(
      new Error('WhatsApp API error: 400'),
    );

    const result = await dispatchAt(DAYTIME, brief);

    expect(result).toEqual({ id: 'notif-1', channels: ['in_app', 'whatsapp'] });
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('swallows an email provider failure the same way', async () => {
    await build();
    email.sendHtml.mockRejectedValue(new Error('MailerSend 502'));

    const result = await dispatchAt(DAYTIME, approval);

    expect(result).toEqual({ id: 'notif-1', channels: ['in_app', 'email'] });
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an inactive user', { ...ACTIVE_USER, status: 'inactive' }],
    ['a user that no longer exists', null],
  ])('returns null for %s', async (_label, user) => {
    await build({ whatsapp_enabled: true });
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await dispatchAt(DAYTIME, approval);

    expect(result).toBeNull();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(email.sendHtml).not.toHaveBeenCalled();
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });
});
