'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { BrandStatus } from '@/lib/types/brand';
import { BRAND_STATUS_LABELS } from '@/lib/types/brand';

// `idea` has no status meaning (it was decorative purple) — Rule S4 maps it to neutral.
// `planning` and `development` are both "in flight, not live" and share the info tint.
const STATUS_CLASSES: Record<BrandStatus, string> = {
  idea: STATUS_BADGE.neutral,
  planning: STATUS_BADGE.info,
  development: STATUS_BADGE.info,
  active: STATUS_BADGE.good,
  paused: STATUS_BADGE.warning,
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
