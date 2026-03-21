'use client';

import { Badge } from '@/components/ui/badge';
import type { WasteReason } from '@/lib/types/kitchen';
import { WASTE_REASON_LABELS, WASTE_REASON_BADGE_CLASSES } from '@/lib/types/kitchen';

interface WasteReasonBadgeProps {
  reason: WasteReason;
}

export function WasteReasonBadge({ reason }: WasteReasonBadgeProps) {
  return (
    <Badge className={WASTE_REASON_BADGE_CLASSES[reason]}>
      {WASTE_REASON_LABELS[reason]}
    </Badge>
  );
}
