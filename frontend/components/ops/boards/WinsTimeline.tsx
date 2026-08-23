'use client';

import { formatDistanceToNow } from 'date-fns';
import type { WinsEntry } from '@/lib/types/analytics';

interface WinsTimelineProps {
  entries: WinsEntry[];
}

const DOT_COLORS: Record<WinsEntry['type'], string> = {
  quest_completed: 'bg-[var(--status-good)]',
  task_validated: 'bg-primary',
};

const TYPE_LABELS: Record<WinsEntry['type'], string> = {
  quest_completed: 'Quest Completed',
  task_validated: 'Task Validated',
};

export function WinsTimeline({ entries }: WinsTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No milestones yet.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />

      {entries.map((entry) => (
        <div key={entry.id} className="relative flex gap-3 pl-8 pb-6">
          {/* Timeline dot */}
          <div
            className={`absolute left-[7px] top-[6px] size-2 rounded-full ${DOT_COLORS[entry.type]}`}
          />

          {/* Content */}
          <div className="min-w-0">
            <p className="text-sm">
              <span className="text-muted-foreground">[{TYPE_LABELS[entry.type]}]</span>{' '}
              {entry.title}
            </p>
            <p className="text-sm text-muted-foreground">
              @{entry.actor_name} &middot;{' '}
              {formatDistanceToNow(new Date(entry.timestamp), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
