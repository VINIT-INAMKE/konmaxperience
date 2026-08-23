'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QuestProgress } from './QuestProgress';
import { QuestSheet } from './QuestSheet';
import { STATUS_BADGE } from '@/lib/status-styles';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
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
  const user = useAuthStore((s) => s.user);
  const [editOpen, setEditOpen] = useState(false);

  const canEdit =
    user?.roleCode === RoleCode.FOUNDER_ADMIN ||
    (!!user?.id && user.id === quest.owner_user_id);

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
    <>
      {/*
        The whole card is the link, but the overflow menu has to stay clickable
        — so the anchor is a stretched overlay rather than a wrapper, and the
        menu sits one layer above it. Nesting a button inside an <a> would be
        invalid markup and unusable with a keyboard.
      */}
      <Card className="relative p-4 transition-colors hover:bg-muted/30">
        <Link
          href={`/quests/${quest.id}`}
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        >
          <span className="sr-only">Open {quest.title}</span>
        </Link>

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

          <div className="flex shrink-0 items-start gap-1">
            {/* Owner avatars */}
            {shownOwners.length > 0 && (
              <div className="flex -space-x-2">
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

            {canEdit && (
              <div className="relative z-20">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
                    aria-label={`Actions for ${quest.title}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditOpen(true)}>
                      <Pencil className="size-4" />
                      Edit quest
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </Card>

      {canEdit && (
        <QuestSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          quest={quest}
        />
      )}
    </>
  );
}
