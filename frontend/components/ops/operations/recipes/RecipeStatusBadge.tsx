'use client';

import { cn } from '@/lib/utils';
import type { RecipeStatus } from '@/lib/types/recipe';
import { RECIPE_STATUS_LABELS } from '@/lib/types/recipe';

interface RecipeStatusBadgeProps {
  status: RecipeStatus;
  className?: string;
}

export function RecipeStatusBadge({ status, className }: RecipeStatusBadgeProps) {
  const statusClasses: Record<RecipeStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    approved: 'bg-green-500/15 text-green-400',
    archived: 'bg-muted/50 text-muted-foreground line-through',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusClasses[status],
        className
      )}
    >
      {RECIPE_STATUS_LABELS[status]}
    </span>
  );
}
