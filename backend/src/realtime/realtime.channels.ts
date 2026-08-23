import { Permission } from '../types/permissions';

/**
 * Every private channel the ops app may subscribe to (SPEC §6.4 realtime).
 * This map is a closed vocabulary: a channel that is not a key here — and is not
 * the caller's own `private-user-*` channel — is refused by `RealtimeService`.
 *
 * `permission` is the capability gate, `moduleKey` the SPEC §6.3 visibility gate.
 * Both must pass: a role that cannot see the screen must not hold a socket for it.
 */
export const REALTIME_CHANNELS = {
  'private-kds': { permission: Permission.MANAGE_KITCHEN, moduleKey: 'kds' },
  'private-pick-pack': {
    permission: Permission.MANAGE_KITCHEN,
    moduleKey: 'pick_pack',
  },
  'private-shipments': {
    permission: Permission.MANAGE_POS,
    moduleKey: 'shipments',
  },
  'private-approvals': {
    permission: Permission.APPROVE_EVIDENCE,
    moduleKey: 'approvals',
  },
} as const;

export type StaticChannel = keyof typeof REALTIME_CHANNELS;

/** Per-user channel: `private-user-{userId}` — notifications, XP, level-ups. */
export const USER_CHANNEL_PREFIX = 'private-user-';

export const userChannel = (userId: string): string =>
  `${USER_CHANNEL_PREFIX}${userId}`;

export const REALTIME_EVENTS = {
  KDS_ORDER_NEW: 'kds.order.new',
  KDS_ORDER_UPDATED: 'kds.order.updated',
  PICK_PACK_ORDER_NEW: 'pickpack.order.new',
  PICK_PACK_ORDER_UPDATED: 'pickpack.order.updated',
  APPROVALS_COUNT_CHANGED: 'approvals.count.changed',
  NOTIFICATION_CREATED: 'notification.created',
} as const;

export type RealtimeEvent =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
