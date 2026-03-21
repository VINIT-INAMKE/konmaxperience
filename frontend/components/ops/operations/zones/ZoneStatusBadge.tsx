'use client';

import { Badge } from '@/components/ui/badge';
import type { ZoneStatus } from '@/lib/types/zone';
import { ZONE_STATUS_LABELS } from '@/lib/types/zone';

const STATUS_CLASSES: Record<ZoneStatus, string> = {
  planned: 'text-amber-400 border-amber-500/30',
  setup: 'text-blue-400 border-blue-500/30',
  active: 'text-green-400 border-green-500/30',
  inactive: 'text-zinc-400 border-zinc-500/30',
};

interface ZoneStatusBadgeProps {
  status: ZoneStatus;
}

export function ZoneStatusBadge({ status }: ZoneStatusBadgeProps) {
  return (
    <Badge variant="outline" className={`text-xs ${STATUS_CLASSES[status]}`}>
      {ZONE_STATUS_LABELS[status]}
    </Badge>
  );
}
