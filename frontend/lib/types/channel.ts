export type ChannelStatus = 'planned' | 'active' | 'inactive';
export type ChannelType = 'dine_in' | 'delivery' | 'takeaway' | 'retail' | 'event' | 'workshop' | 'online';

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

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  dine_in: 'Dine-in',
  delivery: 'Delivery',
  takeaway: 'Takeaway',
  retail: 'Retail',
  event: 'Event',
  workshop: 'Workshop',
  online: 'Online',
};

export const CHANNEL_STATUSES: ChannelStatus[] = ['planned', 'active', 'inactive'];
export const CHANNEL_TYPES: ChannelType[] = ['dine_in', 'delivery', 'takeaway', 'retail', 'event', 'workshop', 'online'];
