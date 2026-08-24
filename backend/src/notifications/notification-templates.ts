import { NotificationType } from '@prisma/client';

/** Substitutions a dispatch supplies for its template's positional params. */
export type TemplateContext = Record<string, string | number>;

export interface WhatsAppTemplateSpec {
  /** The name registered in the Meta WhatsApp Manager. */
  name: string;
  /** Positional body params, in template order. Meta rejects a count mismatch. */
  params: (ctx: TemplateContext) => string[];
  /**
   * The context keys `params` reads, in order. Documentation that a spec can
   * assert on, so a call site adding a param cannot quietly ship a template
   * whose registry entry still sends the old count.
   */
  contextKeys: string[];
}

/** `''` would be rejected by Meta as an empty positional param. */
function param(ctx: TemplateContext, key: string, fallback: string): string {
  const value = ctx[key];
  return value === undefined || value === null || value === ''
    ? fallback
    : String(value);
}

/**
 * A type absent from this registry is in-app (and possibly email) only — the
 * dispatcher skips WhatsApp for it without a special case at each call site.
 *
 * Every name below must exist and be APPROVED in the Meta WhatsApp Manager
 * before `SystemSetting['notifications'].whatsapp_enabled` is flipped on, which
 * is why the setting seeds `false`. An unapproved name fails the send with a
 * Meta 400, which `WhatsAppService.sendTemplate` throws and the dispatcher
 * isolates — a bad template degrades to in-app, it does not break the sweep.
 */
export const WHATSAPP_TEMPLATES: Partial<
  Record<NotificationType, WhatsAppTemplateSpec>
> = {
  [NotificationType.approval_pending]: {
    name: 'staff_approval_waiting',
    contextKeys: ['subject', 'hours'],
    params: (c) => [
      param(c, 'subject', 'An approval'),
      param(c, 'hours', '24'),
    ],
  },
  [NotificationType.task_blocked]: {
    name: 'staff_task_blocked',
    contextKeys: ['subject', 'reason'],
    params: (c) => [
      param(c, 'subject', 'A task'),
      param(c, 'reason', 'No reason given'),
    ],
  },
  [NotificationType.low_stock]: {
    name: 'staff_low_stock',
    contextKeys: ['subject', 'onHand', 'minimum'],
    params: (c) => [
      param(c, 'subject', 'An ingredient'),
      param(c, 'onHand', '0'),
      param(c, 'minimum', '0'),
    ],
  },
  [NotificationType.shipment_failed]: {
    name: 'staff_shipment_failed',
    contextKeys: ['subject', 'status'],
    params: (c) => [
      param(c, 'subject', 'A shipment'),
      param(c, 'status', 'failed'),
    ],
  },
  [NotificationType.morning_brief]: {
    name: 'staff_morning_brief',
    contextKeys: ['headline'],
    params: (c) => [param(c, 'headline', 'Your morning brief is ready.')],
  },
};
