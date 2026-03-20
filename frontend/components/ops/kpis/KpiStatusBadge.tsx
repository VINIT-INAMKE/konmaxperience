'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { KPI_STATUS_LABELS, type KpiStatus } from '@/lib/types/kpi';

interface KpiStatusBadgeProps {
  status: KpiStatus;
  className?: string;
}

const STATUS_CLASSES: Record<KpiStatus, string> = {
  on_track: 'text-green-500 border-green-500/30',
  at_risk: 'text-amber-500 border-amber-500/30',
  off_track: 'text-red-500 border-red-500/30',
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
