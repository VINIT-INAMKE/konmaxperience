'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { AssetStatus } from '@/lib/types/asset';
import { ASSET_STATUS_LABELS } from '@/lib/types/asset';

interface AssetStatusBadgeProps {
  status: AssetStatus;
}

const STATUS_CLASSES: Record<AssetStatus, string> = {
  draft: STATUS_BADGE.neutral,
  in_review: STATUS_BADGE.info,
  approved: STATUS_BADGE.good,
  rejected: STATUS_BADGE.serious,
};

export function AssetStatusBadge({ status }: AssetStatusBadgeProps) {
  return (
    <Badge variant="outline" className={STATUS_CLASSES[status]}>
      {ASSET_STATUS_LABELS[status]}
    </Badge>
  );
}
