'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import { KPI_STATUS_LABELS, type KpiStatus } from '@/lib/types/kpi';

interface KpiStatusBadgeProps {
  status: KpiStatus;
  className?: string;
}

const STATUS_CLASSES: Record<KpiStatus, string> = {
  on_track: STATUS_BADGE.good,
  at_risk: STATUS_BADGE.warning,
  off_track: STATUS_BADGE.serious,
};

export function KpiStatusBadge({ status, className }: KpiStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_CLASSES[status], className)}
    >
      {KPI_STATUS_LABELS[status]}
    </Badge>
  );
}
