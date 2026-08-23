'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Plus,
  AlertCircle,
  Loader2,
  Calendar,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProgressRing } from '@/components/ops/ProgressRing';
import { NumberTicker } from '@/components/ui/number-ticker';
import { apiClient } from '@/lib/api-client';
import { STATUS_BADGE } from '@/lib/status-styles';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import {
  MISSION_PHASE_LABELS,
  MISSION_SCOPE_LABELS,
  type Mission,
  type MissionPhase,
  type MissionStatus,
} from '@/lib/types/missions';
import type { Quest } from '@/lib/types/quests';
import type { Task } from '@/lib/types/tasks';
import { TASK_TYPE_XP_WEIGHT } from '@/lib/types/tasks';
import { QuestCard } from '@/components/ops/quests/QuestCard';

const PHASE_COLORS: Record<MissionPhase, string> = {
  setup: STATUS_BADGE.neutral,
  foundation: STATUS_BADGE.info,
  activation: STATUS_BADGE.warning,
  scale: STATUS_BADGE.good,
};

const STATUS_COLORS: Record<MissionStatus, string> = {
  planned: '',
  active: STATUS_BADGE.good,
  completed: STATUS_BADGE.info,
  paused: STATUS_BADGE.warning,
};

export default function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const {
    data: mission,
    isLoading: missionLoading,
    isError: missionError,
    refetch: refetchMission,
  } = useQuery({
    queryKey: ['missions', id],
    queryFn: () => apiClient.get<Mission>(`/missions/${id}`),
  });

  const {
    data: quests,
    isLoading: questsLoading,
    isError: questsError,
    refetch: refetchQuests,
  } = useQuery({
    queryKey: ['quests', { missionId: id }],
    queryFn: () => apiClient.get<Quest[]>(`/quests?mission_id=${id}`),
  });

  // Fetch all tasks for this mission to compute total XP earned
  const { data: missionTasks = [], isLoading: missionTasksLoading } = useQuery({
    queryKey: ['tasks', { missionId: id }],
    queryFn: () => apiClient.get<Task[]>(`/tasks?mission_id=${id}`),
    enabled: !!mission,
  });

  const totalXpEarned = missionTasks
    .filter((t) => t.valid)
    .reduce((sum, t) => sum + t.valid_xp, 0);
  const potentialXp = missionTasks.reduce(
    (sum, t) => sum + Math.floor(t.xp * (TASK_TYPE_XP_WEIGHT[t.task_type] ?? 1)),
    0,
  );

  const sortedQuests = quests
    ? [...quests].sort((a, b) => a.week_number - b.week_number)
    : [];

  if (missionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
      </div>
    );
  }

  if (missionError || !mission) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Could not load this mission. Try again in a moment.
          </AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={() => void refetchMission()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
      <div className="space-y-8">
        {/* Back link */}
        <Link
          href="/missions"
          className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        >
          <ArrowLeft className="size-4" />
          Missions
        </Link>

        {/* Mission header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{mission.title}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={PHASE_COLORS[mission.phase]}
                >
                  {MISSION_PHASE_LABELS[mission.phase]}
                </Badge>
                <Badge variant="secondary">
                  {MISSION_SCOPE_LABELS[mission.scope]}
                </Badge>
                <Badge
                  variant="secondary"
                  className={STATUS_COLORS[mission.status]}
                >
                  {mission.status.charAt(0).toUpperCase() +
                    mission.status.slice(1)}
                </Badge>
              </div>
            </div>

            {/* Progress ring */}
            <ProgressRing
              value={mission.progress_percent}
              max={100}
              showValue
              className="size-16 text-sm shrink-0"
              label={`Mission ${mission.progress_percent}% complete`}
            />
          </div>

          {/* Progress text */}
          <div className="flex items-baseline gap-1">
            <NumberTicker
              value={mission.progress_percent}
              className="text-sm font-semibold"
            />
            <span className="text-sm text-muted-foreground">% complete</span>
          </div>

          {/* XP earned summary */}
          {missionTasksLoading ? (
            <div className="h-4 w-32 rounded bg-muted/50 animate-pulse motion-reduce:animate-none" />
          ) : (
            <div className="flex items-baseline gap-1">
              <NumberTicker
                value={totalXpEarned}
                className="text-sm font-semibold text-[var(--status-good)] tabular-nums"
              />
              <span className="text-sm text-muted-foreground">
                / {potentialXp} XP earned
              </span>
            </div>
          )}

          {/* Description */}
          {mission.description && (
            <p className="text-sm text-muted-foreground">
              {mission.description}
            </p>
          )}

          {/* Dates */}
          {(mission.start_date || mission.end_date) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              <span>
                {mission.start_date &&
                  format(new Date(mission.start_date), 'MMM d, yyyy')}
                {mission.start_date && mission.end_date && ' - '}
                {mission.end_date &&
                  format(new Date(mission.end_date), 'MMM d, yyyy')}
              </span>
            </div>
          )}
        </div>

        {/* Quests section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Quests</h2>
            {isAdmin && (
              <Button nativeButton={false} render={<Link href={`/missions/${id}/quests/new`} />} size="sm">
                <Plus className="size-4" />
                Add quest
              </Button>
            )}
          </div>

          {questsLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground" />
            </div>
          )}

          {questsError && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Could not load quests for this mission. Try again in a moment.
                </AlertDescription>
              </Alert>
              <Button variant="outline" size="sm" onClick={() => void refetchQuests()}>
                Retry
              </Button>
            </div>
          )}

          {!questsLoading && !questsError && sortedQuests.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Target className="size-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No quests yet. Break this mission into weekly quests to get moving.
              </p>
              {isAdmin ? (
                <Button
                  nativeButton={false}
                  render={<Link href={`/missions/${id}/quests/new`} />}
                  size="sm"
                >
                  <Plus className="size-4" />
                  Add quest
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/missions" />}
                >
                  Browse missions
                </Button>
              )}
            </div>
          )}

          {sortedQuests.length > 0 && (
            <div className="space-y-3">
              {sortedQuests.map((quest) => (
                <QuestCard key={quest.id} quest={quest} />
              ))}
            </div>
          )}
        </div>
      </div>
  );
}
