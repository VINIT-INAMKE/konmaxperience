import type { OrderChannel } from './kds';
import { ORDER_CHANNEL_LABELS } from './kds';

export type ChannelStatus = 'planned' | 'active' | 'inactive';

/**
 * The channel vocabulary is the Prisma `OrderChannel` enum — the same four members
 * used by Order.channel and ChannelModifier.channel. `retail`, `event`, `workshop`
 * and `online` were dropped in P2.
 */
export type ChannelType = OrderChannel;

export interface Channel {
  id: string;
  name: string;
  channel_type: ChannelType;
  status: ChannelStatus;
}

export const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  inactive: 'Inactive',
};

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = ORDER_CHANNEL_LABELS;

export const CHANNEL_STATUSES: ChannelStatus[] = ['planned', 'active', 'inactive'];
export const CHANNEL_TYPES: ChannelType[] = ['dine_in', 'takeaway', 'delivery', 'marketplace'];

/** Legacy rows may still carry a retired channel_type; render the raw value rather than blank. */
export function channelTypeLabel(value: string): string {
  return CHANNEL_TYPE_LABELS[value as ChannelType] ?? value;
}
