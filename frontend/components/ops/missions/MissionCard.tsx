'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Calendar, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProgressRing } from '@/components/ops/ProgressRing';
import { STATUS_BADGE } from '@/lib/status-styles';
import type {
  Mission,
  MissionPhase,
  MissionStatus,
  MISSION_PHASE_LABELS,
  MISSION_SCOPE_LABELS,
} from '@/lib/types/missions';

/** Long-form phase names used by the compact (board) density. */
const PHASE_LABELS: Record<MissionPhase, string> = {
  setup: 'Setup Phase',
  foundation: 'Foundation Phase',
  activation: 'Activation Phase',
  scale: 'Scale Phase',
};

const PHASE_BADGE: Record<MissionPhase, string> = {
  setup: STATUS_BADGE.neutral,
  foundation: STATUS_BADGE.info,
  activation: STATUS_BADGE.warning,
  scale: STATUS_BADGE.good,
};

const STATUS_BADGE_BY_STATUS: Record<MissionStatus, string> = {
  planned: '',
  active: STATUS_BADGE.good,
  completed: STATUS_BADGE.info,
  paused: STATUS_BADGE.warning,
};

interface MissionCardProps {
  mission: Mission;
  /**
   * `full` (default) is the missions-index card: badges, description, progress
   * ring, readiness impact, dates and quest-owner avatars.
   * `compact` is the mission-board card: title, phase, progress bar, quest
   * count, readiness impact and the end date.
   */
  density?: 'full' | 'compact';
  phaseLabelMap?: typeof MISSION_PHASE_LABELS;
  scopeLabelMap?: typeof MISSION_SCOPE_LABELS;
}

function ReadinessImpactBadges({ mission }: { mission: Mission }) {
  if (!mission.readiness_impact || mission.readiness_impact.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TrendingUp className="size-3.5 text-[var(--status-info)]" />
      {mission.readiness_impact.slice(0, 3).map((ri) => (
        <Badge
          key={ri.meter_code}
          variant="outline"
          className="text-[10px] h-5 px-1.5 text-[var(--status-info)] border-[var(--status-info)]/30"
        >
          +{ri.total_value}{' '}
          {ri.meter_label.length > 15
            ? ri.meter_label.slice(0, 15) + '...'
            : ri.meter_label}
        </Badge>
      ))}
    </div>
  );
}

export function MissionCard({
  mission,
  density = 'full',
  phaseLabelMap,
  scopeLabelMap,
}: MissionCardProps) {
  if (density === 'compact') {
    return (
      <Link
        href={`/missions/${mission.id}`}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
      >
        <Card className="rounded-xl cursor-pointer p-4 gap-3">
          <h3 className="text-xl font-bold leading-tight line-clamp-2">
            {mission.title}
          </h3>
          <p className="text-xs font-bold text-ink-muted">
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
          <p className="text-sm text-ink-muted">
            {mission.quests?.[0]
              ? `${mission.quests.length} quest${mission.quests.length !== 1 ? 's' : ''}`
              : 'No quests yet'}
          </p>
          <ReadinessImpactBadges mission={mission} />
          <p className="text-sm text-ink-muted">
            {mission.end_date
              ? format(new Date(mission.end_date), 'MMM d, yyyy')
              : 'No deadline'}
          </p>
        </Card>
      </Link>
    );
  }

  // Quest owners shown as a stacked avatar row (top 4 + overflow count).
  const avatarData =
    mission.quests
      ?.filter((q) => q.status === 'active' || q.status === 'completed')
      .slice(0, 4)
      .map((q) => ({
        title: q.title,
        imageUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(q.title)}`,
      })) ?? [];

  const overflowCount =
    (mission.quests?.length ?? 0) > 4 ? (mission.quests?.length ?? 0) - 4 : 0;

  return (
    <Link
      href={`/missions/${mission.id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
    >
      <Card className="rounded-xl cursor-pointer p-6 gap-4">
        {/* Header: badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={PHASE_BADGE[mission.phase]}>
            {phaseLabelMap?.[mission.phase] ?? PHASE_LABELS[mission.phase]}
          </Badge>
          {scopeLabelMap && (
            <Badge variant="secondary">{scopeLabelMap[mission.scope]}</Badge>
          )}
          <Badge
            variant="secondary"
            className={STATUS_BADGE_BY_STATUS[mission.status]}
          >
            {mission.status.charAt(0).toUpperCase() + mission.status.slice(1)}
          </Badge>
        </div>

        {/* Title and description */}
        <div>
          <h3 className="text-base font-semibold leading-tight">{mission.title}</h3>
          <p className="text-sm text-ink-muted mt-1 line-clamp-2">
            {mission.description}
          </p>
        </div>

        {/* Progress section */}
        <div className="flex items-center gap-4">
          <ProgressRing
            value={mission.progress_percent}
            className="size-12 text-xs shrink-0"
          />
          <div className="flex-1">
            <div className="flex items-baseline gap-1">
              <NumberTicker
                value={mission.progress_percent}
                className="text-sm font-semibold"
              />
              <span className="text-sm text-ink-muted">% complete</span>
            </div>
            {mission.quests && mission.quests.length > 0 && (
              <span className="text-xs text-ink-muted">
                {mission.quests.length} quest
                {mission.quests.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <ReadinessImpactBadges mission={mission} />

        {/* Footer: dates and quest-owner avatars */}
        <div className="flex items-center justify-between">
          {mission.start_date && (
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Calendar className="size-3.5" />
              <span>
                {format(new Date(mission.start_date), 'MMM d, yyyy')}
                {mission.end_date &&
                  ` - ${format(new Date(mission.end_date), 'MMM d, yyyy')}`}
              </span>
            </div>
          )}
          {avatarData.length > 0 && (
            <div className="flex -space-x-2">
              {avatarData.map((a) => (
                <Avatar key={a.title} size="sm" className="ring-2 ring-[var(--surface)]">
                  <AvatarImage src={a.imageUrl} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {a.title.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {overflowCount > 0 && (
                <span className="flex size-6 items-center justify-center rounded-full bg-surface-raised text-[10px] font-medium text-ink-muted ring-2 ring-[var(--surface)]">
                  +{overflowCount}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
