'use client';

import { Badge } from '@/components/ui/badge';
import type { PrepBatchStatus } from '@/lib/types/kitchen';
import {
  PREP_BATCH_STATUS_BADGE_CLASSES,
  PREP_BATCH_STATUS_LABELS,
} from '@/lib/types/kitchen';

interface PrepBatchStatusBadgeProps {
  status: PrepBatchStatus;
}

export function PrepBatchStatusBadge({ status }: PrepBatchStatusBadgeProps) {
  return (
    <Badge variant="secondary" className={PREP_BATCH_STATUS_BADGE_CLASSES[status]}>
      {PREP_BATCH_STATUS_LABELS[status]}
    </Badge>
  );
}
