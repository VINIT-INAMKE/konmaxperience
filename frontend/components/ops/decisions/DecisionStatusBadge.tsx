'use client';

import { Badge } from '@/components/ui/badge';
import type { DecisionStatus } from '@/lib/types/decisions';
import { DECISION_STATUS_LABELS } from '@/lib/types/decisions';

const statusClasses: Record<DecisionStatus, string> = {
  proposed: 'border-amber-500/40 text-amber-400',
  approved: 'border-green-500/40 text-green-400',
  rejected: 'border-red-500/40 text-red-400',
};

interface DecisionStatusBadgeProps {
  status: DecisionStatus;
}

export function DecisionStatusBadge({ status }: DecisionStatusBadgeProps) {
  return (
    <Badge variant="outline" className={statusClasses[status]}>
      {DECISION_STATUS_LABELS[status]}
    </Badge>
  );
}
