export type ZoneStatus = 'planned' | 'setup' | 'active' | 'inactive';
export type ZoneType = 'kitchen' | 'dining' | 'outdoor' | 'workspace' | 'storage' | 'leisure';

export interface Zone {
  id: string;
  name: string;
  zone_type: ZoneType;
  owner_user_id: string | null;
  owner?: { id: string; name: string } | null;
  status: ZoneStatus;
  notes: string | null;
}

export const ZONE_STATUS_LABELS: Record<ZoneStatus, string> = {
  planned: 'Planned',
  setup: 'Setup',
  active: 'Active',
  inactive: 'Inactive',
};

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  kitchen: 'Kitchen',
  dining: 'Dining',
  outdoor: 'Outdoor',
  workspace: 'Workspace',
  storage: 'Storage',
  leisure: 'Leisure',
};

export const ZONE_STATUSES: ZoneStatus[] = ['planned', 'setup', 'active', 'inactive'];
export const ZONE_TYPES: ZoneType[] = ['kitchen', 'dining', 'outdoor', 'workspace', 'storage', 'leisure'];
