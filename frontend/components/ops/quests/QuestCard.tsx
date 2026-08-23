'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { QuestProgress } from './QuestProgress';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { Quest, QuestStatus } from '@/lib/types/quests';

const STATUS_COLORS: Record<QuestStatus, string> = {
  planned: STATUS_BADGE.neutral,
  active: STATUS_BADGE.good,
  completed: STATUS_BADGE.info,
  blocked: STATUS_BADGE.critical,
};

/** How many stacked avatars render before the `+N` overflow chip. */
const MAX_AVATARS = 3;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

interface QuestCardProps {
  quest: Quest;
}

export function QuestCard({ quest }: QuestCardProps) {
  const owners = quest.owner ? [quest.owner] : [];
  const shownOwners = owners.slice(0, MAX_AVATARS);
  const overflow = owners.length - shownOwners.length;

  const totalTasks = quest._count?.tasks ?? 0;
  // Ad-hoc tasks = total minus baseline (core) tasks
  const adhocTasks =
    quest.baseline_task_count > 0
      ? Math.max(0, totalTasks - quest.baseline_task_count)
      : 0;

  return (
    <Link
      href={`/quests/${quest.id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
    >
      <Card className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-4 overflow-hidden">
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">{quest.title}</h3>
              <Badge variant="secondary" className="text-[11px]">
                Week {quest.week_number}
              </Badge>
              <Badge
                variant="secondary"
                className={STATUS_COLORS[quest.status]}
              >
                {quest.status.charAt(0).toUpperCase() + quest.status.slice(1)}
              </Badge>
            </div>

            {/* Progress bars */}
            <QuestProgress
              coreProgress={quest.core_progress_percent}
              adhocProgress={quest.adhoc_progress_percent}
              baselineTaskCount={quest.baseline_task_count}
              totalAdhocTasks={adhocTasks}
            />

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {totalTasks > 0 && (
                <span>
                  {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                </span>
              )}
              {quest.owner && <span>{quest.owner.name}</span>}
            </div>
          </div>

          {/* Owner avatars */}
          {shownOwners.length > 0 && (
            <div className="flex -space-x-2 shrink-0">
              {shownOwners.map((owner) => (
                <Avatar key={owner.id} size="sm" title={owner.name}>
                  <AvatarImage
                    src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(owner.name)}`}
                    alt=""
                  />
                  <AvatarFallback>{initials(owner.name)}</AvatarFallback>
                </Avatar>
              ))}
              {overflow > 0 && (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-medium text-ink-muted">
                  +{overflow}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
