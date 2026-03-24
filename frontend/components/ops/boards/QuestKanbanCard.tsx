'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import type { Quest } from '@/lib/types/quests';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface QuestKanbanCardProps {
  quest: Quest;
}

export function QuestKanbanCard({ quest }: QuestKanbanCardProps) {
  const ownerName = quest.owner?.name ?? 'Unassigned';
  const taskCount = quest._count?.tasks;

  return (
    <Link
      href={`/missions/${quest.mission_id}`}
      className="block rounded-lg border bg-card overflow-hidden"
    >
      <div className="p-4 space-y-2">
        {/* Quest title */}
        <h4 className="text-sm font-bold truncate">{quest.title}</h4>

        {/* Progress bar */}
        <Progress value={quest.progress_percent} />

        {/* Owner row */}
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback>{getInitials(ownerName)}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {ownerName}
          </span>
        </div>

        {/* Task count */}
        <p className="text-xs text-muted-foreground">
          {taskCount != null
            ? `${taskCount} task${taskCount !== 1 ? 's' : ''}`
            : `${quest.progress_percent}% complete`}
        </p>
      </div>
    </Link>
  );
}
