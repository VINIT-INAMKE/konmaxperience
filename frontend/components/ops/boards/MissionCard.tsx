'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { MagicCard } from '@/components/ui/magic-card';
import { Progress } from '@/components/ui/progress';
import type { Mission, MissionPhase } from '@/lib/types/missions';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

const PHASE_LABELS: Record<MissionPhase, string> = {
  setup: 'Setup Phase',
  foundation: 'Foundation Phase',
  activation: 'Activation Phase',
  scale: 'Scale Phase',
};

interface BoardMissionCardProps {
  mission: Mission;
}

export function BoardMissionCard({ mission }: BoardMissionCardProps) {
  return (
    <Link href={`/missions/${mission.id}`} className="block rounded-xl">
      <MagicCard className="rounded-xl cursor-pointer" gradientColor={GRADIENT_OVERLAY}>
        <div className="p-4 space-y-3">
          <h3 className="text-xl font-bold leading-tight line-clamp-2">
            {mission.title}
          </h3>
          <p className="text-xs font-bold text-muted-foreground">
            {PHASE_LABELS[mission.phase] ?? mission.phase}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Progress value={mission.progress_percent} />
            </div>
            <span className="text-sm font-bold tabular-nums">
              {mission.progress_percent}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {mission.quests?.[0]
              ? `${mission.quests.length} quest${mission.quests.length !== 1 ? 's' : ''}`
              : 'No quests yet'}
          </p>
          <p className="text-sm text-muted-foreground">
            {mission.end_date
              ? format(new Date(mission.end_date), 'MMM d, yyyy')
              : 'No deadline'}
          </p>
        </div>
      </MagicCard>
    </Link>
  );
}
