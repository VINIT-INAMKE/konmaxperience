'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MagicCard } from '@/components/ui/magic-card';
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar';
import { NumberTicker } from '@/components/ui/number-ticker';
import { AvatarCircles } from '@/components/ui/avatar-circles';
import type {
  Mission,
  MissionPhase,
  MissionStatus,
  MISSION_PHASE_LABELS,
  MISSION_SCOPE_LABELS,
} from '@/lib/types/missions';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

const PHASE_COLORS: Record<MissionPhase, string> = {
  setup: 'text-muted-foreground bg-muted',
  foundation: 'text-blue-400 bg-blue-950',
  activation: 'text-amber-400 bg-amber-950',
  scale: 'text-green-400 bg-green-950',
};

const STATUS_COLORS: Record<MissionStatus, string> = {
  planned: '',
  active: 'text-green-400 bg-green-950',
  completed: 'text-blue-400 bg-blue-950',
  paused: 'text-amber-400 bg-amber-950',
};

interface MissionCardProps {
  mission: Mission;
  phaseLabelMap: typeof MISSION_PHASE_LABELS;
  scopeLabelMap: typeof MISSION_SCOPE_LABELS;
}

export function MissionCard({
  mission,
  phaseLabelMap,
  scopeLabelMap,
}: MissionCardProps) {
  // Build avatar circles data from quest owners if present
  const avatarData =
    mission.quests
      ?.filter((q) => q.status === 'active' || q.status === 'completed')
      .slice(0, 4)
      .map((q, i) => ({
        imageUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(q.title)}&backgroundColor=0a0a0a&textColor=ffffff`,
        profileUrl: '#',
      })) ?? [];

  const overflowCount =
    (mission.quests?.length ?? 0) > 4
      ? (mission.quests?.length ?? 0) - 4
      : 0;

  return (
    <Link href={`/missions/${mission.id}`} className="block rounded-xl">
      <MagicCard className="rounded-xl cursor-pointer" gradientColor={GRADIENT_OVERLAY}>
        <div className="p-6 space-y-4">
          {/* Header: badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className={PHASE_COLORS[mission.phase]}
            >
              {phaseLabelMap[mission.phase]}
            </Badge>
            <Badge variant="secondary">
              {scopeLabelMap[mission.scope]}
            </Badge>
            <Badge
              variant="secondary"
              className={STATUS_COLORS[mission.status]}
            >
              {mission.status.charAt(0).toUpperCase() + mission.status.slice(1)}
            </Badge>
          </div>

          {/* Title and description */}
          <div>
            <h3 className="text-base font-semibold leading-tight">
              {mission.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {mission.description}
            </p>
          </div>

          {/* Progress section */}
          <div className="flex items-center gap-4">
            <AnimatedCircularProgressBar
              value={mission.progress_percent}
              gaugePrimaryColor="hsl(var(--primary))"
              gaugeSecondaryColor="hsl(var(--muted))"
              className="size-12 text-xs"
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <NumberTicker
                  value={mission.progress_percent}
                  className="text-sm font-semibold"
                />
                <span className="text-sm text-muted-foreground">% complete</span>
              </div>
              {mission.quests && mission.quests.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {mission.quests.length} quest{mission.quests.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Footer: dates and avatars */}
          <div className="flex items-center justify-between">
            {mission.start_date && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="size-3.5" />
                <span>
                  {format(new Date(mission.start_date), 'MMM d, yyyy')}
                  {mission.end_date &&
                    ` - ${format(new Date(mission.end_date), 'MMM d, yyyy')}`}
                </span>
              </div>
            )}
            {avatarData.length > 0 && (
              <AvatarCircles
                avatarUrls={avatarData}
                numPeople={overflowCount > 0 ? overflowCount : undefined}
                className="[&_img]:size-6 [&_img]:border [&_a]:size-6 [&>a:last-child]:size-6"
              />
            )}
          </div>
        </div>
      </MagicCard>
    </Link>
  );
}
