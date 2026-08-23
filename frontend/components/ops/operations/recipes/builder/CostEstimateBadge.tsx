'use client';

import { cn } from '@/lib/utils';
import { STATUS_BADGE } from '@/lib/status-styles';

interface CostEstimateBadgeProps {
  isEstimate: boolean;
  className?: string;
}

export function CostEstimateBadge({ isEstimate, className }: CostEstimateBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        isEstimate ? STATUS_BADGE.warning : STATUS_BADGE.good,
        className
      )}
    >
      {isEstimate ? 'Estimated' : 'Confirmed'}
    </span>
  );
}
