'use client';

import { Badge } from '@/components/ui/badge';
import type { AssetStatus } from '@/lib/types/asset';
import { ASSET_STATUS_LABELS } from '@/lib/types/asset';

interface AssetStatusBadgeProps {
  status: AssetStatus;
}

const STATUS_COLORS: Record<AssetStatus, string> = {
  draft: 'text-zinc-400 border-zinc-500/30',
  in_review: 'text-blue-400 border-blue-500/30',
  approved: 'text-green-400 border-green-500/30',
  rejected: 'text-red-400 border-red-500/30',
};

export function AssetStatusBadge({ status }: AssetStatusBadgeProps) {
  return (
    <Badge variant="outline" className={STATUS_COLORS[status]}>
      {ASSET_STATUS_LABELS[status]}
    </Badge>
  );
}
