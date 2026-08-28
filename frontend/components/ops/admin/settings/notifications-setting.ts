import { z } from 'zod';

/**
 * `SystemSetting['notifications']` — RUN-01's delivery policy, mirroring
 * `SETTING_DEFAULTS.notifications` in `backend/src/settings/settings.service.ts`
 * one key for one.
 *
 * It is declared here rather than in `lib/types/settings.ts` because that file
 * carries the eleven pre-P6 keys and is shared ground; this block is P6's and
 * its form is the only thing that reads it. `SettingValueMap` should absorb it
 * the next time that file is opened for another reason.
 */
export interface NotificationsSetting {
  /** Master switch for outbound WhatsApp staff nudges. In-app is unaffected. */
  whatsapp_enabled: boolean;
  /** Node-local window in which no WhatsApp nudge is sent. May wrap midnight. */
  quiet_hours: { start: string; end: string };
  /** Hours before the same (user, type, reference) may be nudged again. */
  cooldown_hours: Record<CooldownKey, number>;
  /** Types that also send an email. Not editable here; carried through on save. */
  email_types: string[];
}

export const COOLDOWN_KEYS = [
  'approval_pending',
  'task_blocked',
  'low_stock',
  'shipment_failed',
  'morning_brief',
  'daily_close_due',
] as const;

export type CooldownKey = (typeof COOLDOWN_KEYS)[number];

export const COOLDOWN_LABELS: Record<CooldownKey, string> = {
  approval_pending: 'Approval pending',
  task_blocked: 'Task blocked',
  low_stock: 'Low stock',
  shipment_failed: 'Shipment failed',
  morning_brief: 'Morning brief',
  daily_close_due: 'Daily close due',
};

export const NOTIFICATIONS_DEFAULTS: NotificationsSetting = {
  whatsapp_enabled: false,
  quiet_hours: { start: '21:00', end: '07:00' },
  cooldown_hours: {
    approval_pending: 24,
    task_blocked: 12,
    low_stock: 4,
    shipment_failed: 6,
    morning_brief: 20,
    daily_close_due: 20,
  },
  email_types: ['task_due', 'task_blocked', 'approval_pending', 'low_stock'],
};

/** `HH:MM`, 24-hour. The backend compares these as node-local wall clock. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const time = z
  .string()
  .regex(TIME_PATTERN, 'Use a 24-hour time, like 21:00.');

/**
 * A cooldown of `0` is legal and means "no cooldown" — the ceiling is a week,
 * beyond which a nudge is not a cooldown but a mute, and muting a type belongs
 * in `email_types` / the master switch rather than in a number nobody rereads.
 */
const cooldown = z
  .number({ message: 'Enter a number of hours.' })
  .int('Whole hours only.')
  .min(0, 'Cannot be negative.')
  .max(168, 'A week is the longest useful cooldown.');

export const notificationsSettingSchema = z.object({
  whatsapp_enabled: z.boolean(),
  quiet_hours: z.object({ start: time, end: time }),
  cooldown_hours: z.object({
    approval_pending: cooldown,
    task_blocked: cooldown,
    low_stock: cooldown,
    shipment_failed: cooldown,
    morning_brief: cooldown,
    daily_close_due: cooldown,
  }),
});

export type NotificationsFormValues = z.infer<typeof notificationsSettingSchema>;

/**
 * Reads the stored row into form values, filling any key the row predates from
 * the defaults. `PATCH /settings/:key` replaces the whole Json value, so a form
 * that silently dropped a key it did not know about would delete it.
 */
export function toFormValues(value: unknown): NotificationsFormValues {
  const row = (value ?? {}) as Partial<NotificationsSetting>;
  const cooldowns: Partial<Record<CooldownKey, number>> =
    row.cooldown_hours ?? {};
  return {
    whatsapp_enabled: row.whatsapp_enabled ?? NOTIFICATIONS_DEFAULTS.whatsapp_enabled,
    quiet_hours: {
      start: row.quiet_hours?.start ?? NOTIFICATIONS_DEFAULTS.quiet_hours.start,
      end: row.quiet_hours?.end ?? NOTIFICATIONS_DEFAULTS.quiet_hours.end,
    },
    cooldown_hours: COOLDOWN_KEYS.reduce(
      (acc, key) => {
        acc[key] =
          cooldowns[key] ?? NOTIFICATIONS_DEFAULTS.cooldown_hours[key];
        return acc;
      },
      {} as Record<CooldownKey, number>,
    ),
  };
}

/** Form values back to the full Json block, preserving `email_types` verbatim. */
export function toSettingValue(
  values: NotificationsFormValues,
  stored: unknown,
): NotificationsSetting {
  const row = (stored ?? {}) as Partial<NotificationsSetting>;
  return {
    ...values,
    email_types: row.email_types ?? NOTIFICATIONS_DEFAULTS.email_types,
  };
}
