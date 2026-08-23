'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface QuestTaskChipProps {
  quest?: { id: string; title: string } | null;
  task?: { id: string; title: string } | null;
  /**
   * Cards whose whole surface is already an `<a>` (the evidence feed, My Day's
   * focus rows) pass `false`: nesting an anchor inside an anchor is invalid
   * HTML and breaks keyboard order. The lineage still reads, it just is not
   * separately clickable there.
   */
  linkify?: boolean;
  className?: string;
}

const SEGMENT_CLASSES =
  'truncate rounded-sm transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50';

/**
 * SPEC §6.4 — every ops card that carries a task link explains why that task
 * exists: `Quest › Task`, each half deep-linking its own record. Renders
 * nothing at all when there is neither, so a card for unattached work does not
 * carry an empty badge.
 */
export function QuestTaskChip({
  quest,
  task,
  linkify = true,
  className,
}: QuestTaskChipProps) {
  if (!quest && !task) return null;

  const label = [quest?.title, task?.title].filter(Boolean).join(' › ');

  return (
    <Badge
      variant="outline"
      title={label}
      className={cn(
        'max-w-full gap-1 border-line bg-surface-raised px-1.5 text-[11px] font-normal text-ink-muted',
        className,
      )}
    >
      {quest &&
        (linkify ? (
          <Link href={`/quests/${quest.id}`} className={SEGMENT_CLASSES}>
            {quest.title}
          </Link>
        ) : (
          <span className="truncate">{quest.title}</span>
        ))}

      {quest && task && (
        <ChevronRight className="size-3 shrink-0 text-ink-faint" aria-hidden />
      )}

      {task &&
        (linkify ? (
          <Link href={`/tasks/${task.id}`} className={SEGMENT_CLASSES}>
            {task.title}
          </Link>
        ) : (
          <span className="truncate">{task.title}</span>
        ))}
    </Badge>
  );
}
