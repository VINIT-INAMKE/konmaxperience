'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AvatarCircles } from '@/components/ui/avatar-circles';
import { QuestProgress } from './QuestProgress';
import type { Quest, QuestStatus } from '@/lib/types/quests';

const STATUS_COLORS: Record<QuestStatus, string> = {
  planned: '',
  active: 'text-green-400 bg-green-950',
  completed: 'text-blue-400 bg-blue-950',
  blocked: 'text-red-400 bg-red-950',
};

interface QuestCardProps {
  quest: Quest;
}

export function QuestCard({ quest }: QuestCardProps) {
  const ownerAvatars = quest.owner
    ? [
        {
          imageUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(quest.owner.name)}&backgroundColor=0a0a0a&textColor=ffffff`,
          profileUrl: '#',
        },
      ]
    : [];

  const totalTasks = quest._count?.tasks ?? 0;
  // Ad-hoc tasks = total minus baseline (core) tasks
  const adhocTasks =
    quest.baseline_task_count > 0
      ? Math.max(0, totalTasks - quest.baseline_task_count)
      : 0;

  return (
    <Link href={`/quests/${quest.id}`} className="block">
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

          {/* Owner avatar */}
          {ownerAvatars.length > 0 && (
            <AvatarCircles
              avatarUrls={ownerAvatars}
              className="[&_img]:size-8 [&_img]:border [&_a]:size-8 shrink-0"
            />
          )}
        </div>
      </Card>
    </Link>
  );
}
