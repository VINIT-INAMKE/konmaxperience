'use client';

import { Badge } from '@/components/ui/badge';
import type { DecisionType } from '@/lib/types/decisions';
import { DECISION_TYPE_LABELS } from '@/lib/types/decisions';

const typeClasses: Record<DecisionType, string> = {
  individual: 'bg-slate-500/10 text-slate-400',
  cross_function: 'bg-blue-500/10 text-blue-400',
  strategic: 'bg-purple-500/10 text-purple-400',
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
