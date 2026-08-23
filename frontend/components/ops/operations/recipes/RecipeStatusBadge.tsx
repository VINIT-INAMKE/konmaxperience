'use client';

import { cn } from '@/lib/utils';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { RecipeStatus } from '@/lib/types/recipe';
import { RECIPE_STATUS_LABELS } from '@/lib/types/recipe';

interface RecipeStatusBadgeProps {
  status: RecipeStatus;
  className?: string;
}

const STATUS_CLASSES: Record<RecipeStatus, string> = {
  draft: STATUS_BADGE.neutral,
  pending: STATUS_BADGE.warning,
  approved: STATUS_BADGE.good,
  archived: STATUS_BADGE.muted,
};

export function RecipeStatusBadge({ status, className }: RecipeStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        STATUS_CLASSES[status],
        className
      )}
    >
      {RECIPE_STATUS_LABELS[status]}
    </span>
  );
}
