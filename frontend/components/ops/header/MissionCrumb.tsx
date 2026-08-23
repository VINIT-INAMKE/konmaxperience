'use client';

import Link from 'next/link';
import { ChevronRight, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HeaderContext } from '@/lib/types/header';

/** Prisma `MissionPhase` → the word a human says out loud. */
const PHASE_LABELS: Record<string, string> = {
  setup: 'Setup',
  foundation: 'Foundation',
  activation: 'Activation',
  scale: 'Scale',
};

/**
 * SPEC §6.1 slot 1–3: mission › phase › this week's quest.
 *
 * The never-null rule lives here: with no active mission a `CREATE_MISSION`
 * holder gets the CTA and everyone else gets the note. This component never
 * returns `null` and never renders an empty box.
 */
export function MissionCrumb({ ctx }: { ctx: HeaderContext }) {
  if (!ctx.mission) {
    return ctx.can_create_mission ? (
      <Button size="sm" variant="outline" render={<Link href="/missions/new" />}>
        <Rocket className="size-3.5" aria-hidden="true" />
        Start a mission
      </Button>
    ) : (
      <span className="truncate text-sm text-ink-muted">
        No active mission — ask the founder
      </span>
    );
  }

  const phase = PHASE_LABELS[ctx.mission.phase] ?? ctx.mission.phase;

  return (
    <nav
      aria-label="Mission context"
      className="flex min-w-0 items-center gap-1.5 text-sm"
    >
      <Link
        href={`/missions/${ctx.mission.id}`}
        className="truncate font-medium text-ink transition-colors hover:text-brand focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
      >
        {ctx.mission.title}
      </Link>

      <ChevronRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
      <span className="shrink-0 text-ink-muted">{phase}</span>

      {ctx.quest && (
        <>
          <ChevronRight
            className="hidden size-3.5 shrink-0 text-ink-faint sm:block"
            aria-hidden="true"
          />
          <Link
            href={`/quests/${ctx.quest.id}`}
            title={`Week ${ctx.quest.week_number} — ${ctx.quest.title}`}
            className="hidden min-w-0 truncate text-ink-subtle transition-colors hover:text-brand focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 sm:block"
          >
            <span className="text-ink-muted">W{ctx.quest.week_number}</span>{' '}
            {ctx.quest.title}
            {!ctx.quest.mine && (
              <span className="ml-1 text-ink-faint">(node)</span>
            )}
          </Link>
        </>
      )}
    </nav>
  );
}
