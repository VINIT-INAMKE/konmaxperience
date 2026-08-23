'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { PrepBatchStatus } from '@/lib/types/kitchen';
import { PREP_BATCH_STATUS_LABELS } from '@/lib/types/kitchen';

interface PrepBatchStatusBadgeProps {
  status: PrepBatchStatus;
}

const STATUS_CLASSES: Record<PrepBatchStatus, string> = {
  active: STATUS_BADGE.good,
  depleted: STATUS_BADGE.neutral,
  expired: STATUS_BADGE.serious,
};

export function PrepBatchStatusBadge({ status }: PrepBatchStatusBadgeProps) {
  return (
    <Badge variant="secondary" className={STATUS_CLASSES[status]}>
      {PREP_BATCH_STATUS_LABELS[status]}
    </Badge>
  );
}
