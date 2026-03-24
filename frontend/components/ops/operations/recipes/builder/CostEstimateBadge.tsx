'use client';

import { cn } from '@/lib/utils';

interface CostEstimateBadgeProps {
  isEstimate: boolean;
  className?: string;
}

export function CostEstimateBadge({ isEstimate, className }: CostEstimateBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        isEstimate
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-green-500/10 text-green-600 dark:text-green-400',
        className
      )}
    >
      {isEstimate ? 'Estimated' : 'Confirmed'}
    </span>
  );
}
