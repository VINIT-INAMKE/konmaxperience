'use client';

import { Badge } from '@/components/ui/badge';
import type { BrandStatus } from '@/lib/types/brand';
import { BRAND_STATUS_LABELS } from '@/lib/types/brand';

const STATUS_CLASSES: Record<BrandStatus, string> = {
  idea: 'text-purple-400 border-purple-500/30',
  planning: 'text-blue-400 border-blue-500/30',
  development: 'text-cyan-400 border-cyan-500/30',
  active: 'text-green-400 border-green-500/30',
  paused: 'text-amber-400 border-amber-500/30',
};

interface BrandStatusBadgeProps {
  status: BrandStatus;
}

export function BrandStatusBadge({ status }: BrandStatusBadgeProps) {
  return (
    <Badge variant="outline" className={`text-xs ${STATUS_CLASSES[status]}`}>
      {BRAND_STATUS_LABELS[status]}
    </Badge>
  );
}
