'use client';

import Link from 'next/link';
import { differenceInCalendarDays, isPast, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';
import type { Evidence } from '@/lib/types/evidence';
import type { Quest } from '@/lib/types/quests';
import type { Task } from '@/lib/types/tasks';

/** Thresholds. Deliberately generous — a nudge that fires daily is wallpaper. */
const TASK_OVERDUE_DAYS = 3;
const EVIDENCE_WAITING_DAYS = 2;
const QUEST_TAIL_DAYS = 2;
const QUEST_BEHIND_PERCENT = 50;

interface Nudge {
  key: string;
  /** One sentence. Says what is wrong and what it will cost. */
  text: string;
  href: string;
  cta: string;
}

interface NudgesPanelProps {
  tasks: Task[];
  quest: Quest | null;
  pendingEvidence: Evidence[];
  approvalCount: number;
}

function daysSince(iso: string): number {
  return differenceInCalendarDays(new Date(), parseISO(iso));
}

/**
 * SPEC §6.5 — the last block of My Day. Every nudge is derived from data the
 * page has already fetched: no endpoint of its own, no polling, and nothing
 * rendered at all when there is nothing to say.
 */
export function NudgesPanel({
  tasks,
  quest,
  pendingEvidence,
  approvalCount,
}: NudgesPanelProps) {
  const nudges: Nudge[] = [];

  const stalest = tasks
    .filter(
      (task) =>
        task.due_date &&
        !task.completed_at &&
        task.status !== 'done' &&
        task.status !== 'cancelled' &&
        isPast(parseISO(task.due_date)) &&
        daysSince(task.due_date) > TASK_OVERDUE_DAYS,
    )
    .sort(
      (a, b) =>
        parseISO(a.due_date as string).getTime() -
        parseISO(b.due_date as string).getTime(),
    )[0];

  if (stalest) {
    nudges.push({
      key: 'overdue-task',
      text: `“${stalest.title}” has been overdue for ${daysSince(stalest.due_date as string)} days — close it or move the date.`,
      href: `/tasks/${stalest.id}`,
      cta: 'Open task',
    });
  }

  const waitingEvidence = pendingEvidence
    .filter((item) => daysSince(item.created_at) > EVIDENCE_WAITING_DAYS)
    .sort(
      (a, b) =>
        parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime(),
    )[0];

  if (waitingEvidence) {
    nudges.push({
      key: 'evidence-waiting',
      text: `Evidence you uploaded ${daysSince(waitingEvidence.created_at)} days ago is still unreviewed — your XP will not land until it is approved.`,
      href: `/tasks/${waitingEvidence.task_id}`,
      cta: 'Chase review',
    });
  }

  if (quest?.end_date) {
    const daysLeft = differenceInCalendarDays(
      parseISO(quest.end_date),
      new Date(),
    );
    if (
      daysLeft >= 0 &&
      daysLeft < QUEST_TAIL_DAYS &&
      quest.progress_percent < QUEST_BEHIND_PERCENT
    ) {
      nudges.push({
        key: 'quest-tail',
        text: `“${quest.title}” is ${Math.round(quest.progress_percent)}% done with ${daysLeft === 0 ? 'no full day' : `${daysLeft} day`} left in the window.`,
        href: `/quests/${quest.id}`,
        cta: 'Open quest',
      });
    }
  }

  if (approvalCount > 0) {
    nudges.push({
      key: 'approvals',
      text:
        approvalCount === 1
          ? 'One approval is waiting on your sign-off — somebody else is blocked until you decide.'
          : `${approvalCount} approvals are waiting on your sign-off — somebody else is blocked until you decide.`,
      href: '/approvals',
      cta: 'Review',
    });
  }

  if (nudges.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
        Nudges
      </h2>
      <Card>
        <CardContent>
          <ul className="divide-y divide-line">
            {nudges.map((nudge) => (
              <li
                key={nudge.key}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
              >
                <Lightbulb
                  className="size-4 shrink-0 text-gold-text"
                  aria-hidden="true"
                />
                <p className="min-w-0 flex-1 text-sm text-ink">{nudge.text}</p>
                <Link
                  href={nudge.href}
                  className="shrink-0 rounded-sm text-xs font-medium text-brand transition-colors hover:text-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                >
                  {nudge.cta}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
