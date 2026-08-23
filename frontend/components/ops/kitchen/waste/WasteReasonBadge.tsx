'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { WasteReason } from '@/lib/types/kitchen';
import { WASTE_REASON_LABELS } from '@/lib/types/kitchen';

interface WasteReasonBadgeProps {
  reason: WasteReason;
}

const REASON_CLASSES: Record<WasteReason, string> = {
  spoilage: STATUS_BADGE.warning,
  over_prep: STATUS_BADGE.info,
  cooking_error: STATUS_BADGE.warning,
  expired: STATUS_BADGE.serious,
  other: STATUS_BADGE.neutral,
};

export function WasteReasonBadge({ reason }: WasteReasonBadgeProps) {
  return (
    <Badge className={REASON_CLASSES[reason]}>
      {WASTE_REASON_LABELS[reason]}
    </Badge>
  );
}
