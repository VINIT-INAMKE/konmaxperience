'use client';

import { Badge } from '@/components/ui/badge';
import type { DecisionType } from '@/lib/types/decisions';
import { DECISION_TYPE_LABELS } from '@/lib/types/decisions';

const typeClasses: Record<DecisionType, string> = {
  individual: 'bg-surface-raised text-ink-muted',
  cross_function: 'bg-info-status/12 text-info-status',
  strategic: 'bg-gold/12 text-gold-text',
};

interface DecisionTypeBadgeProps {
  type: DecisionType;
}

export function DecisionTypeBadge({ type }: DecisionTypeBadgeProps) {
  return (
    <Badge variant="secondary" className={typeClasses[type]}>
      {DECISION_TYPE_LABELS[type]}
    </Badge>
  );
}
