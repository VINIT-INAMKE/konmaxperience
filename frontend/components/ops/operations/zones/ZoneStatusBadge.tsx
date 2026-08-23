'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { ZoneStatus } from '@/lib/types/zone';
import { ZONE_STATUS_LABELS } from '@/lib/types/zone';

const STATUS_CLASSES: Record<ZoneStatus, string> = {
  planned: STATUS_BADGE.warning,
  setup: STATUS_BADGE.info,
  active: STATUS_BADGE.good,
  inactive: STATUS_BADGE.neutral,
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
