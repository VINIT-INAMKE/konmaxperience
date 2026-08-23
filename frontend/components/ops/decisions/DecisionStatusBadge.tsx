'use client';

import { Badge } from '@/components/ui/badge';
import type { DecisionStatus } from '@/lib/types/decisions';
import { DECISION_STATUS_LABELS } from '@/lib/types/decisions';
import { STATUS_BADGE } from '@/lib/status-styles';

const statusClasses: Record<DecisionStatus, string> = {
  proposed: STATUS_BADGE.warning,
  aligned: STATUS_BADGE.info,
  approved: STATUS_BADGE.good,
  rejected: STATUS_BADGE.serious,
  reopened: STATUS_BADGE.warning,
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
