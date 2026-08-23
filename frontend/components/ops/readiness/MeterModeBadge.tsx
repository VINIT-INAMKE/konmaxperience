'use client';

import { Blend, ListChecks, Sigma } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MeterMode } from '@/lib/types/readiness';

const MODE_LABEL: Record<MeterMode, string> = {
  task_driven: 'Task-driven',
  derived: 'Derived',
  hybrid: 'Hybrid',
};

const MODE_TITLE: Record<MeterMode, string> = {
  task_driven: 'Moves only when a task is validated with approved evidence',
  derived: 'Derived from operations state, recomputed nightly',
  hybrid: 'Half task-driven, half derived — the two are averaged 50/50',
};

const MODE_ICON: Record<MeterMode, typeof Blend> = {
  task_driven: ListChecks,
  derived: Sigma,
  hybrid: Blend,
};

const MODE_CLASS: Record<MeterMode, string> = {
  task_driven: 'border-line text-ink-muted bg-surface-raised',
  derived:
    'border-[var(--status-info)]/30 text-[var(--status-info)] bg-[var(--status-info)]/12',
  hybrid: 'border-brand/30 text-brand bg-brand/12',
};

interface MeterModeBadgeProps {
  mode: MeterMode;
  className?: string;
}

export function MeterModeBadge({ mode, className }: MeterModeBadgeProps) {
  const Icon = MODE_ICON[mode];

  return (
    <Badge
      variant="outline"
      title={MODE_TITLE[mode]}
      className={cn('gap-1 font-medium', MODE_CLASS[mode], className)}
    >
      <Icon aria-hidden="true" />
      {MODE_LABEL[mode]}
    </Badge>
  );
}

export { MODE_LABEL as METER_MODE_LABEL, MODE_TITLE as METER_MODE_TITLE };
