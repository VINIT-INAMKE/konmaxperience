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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BlurFade } from '@/components/ui/blur-fade';
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar';
import { NumberTicker } from '@/components/ui/number-ticker';
import { apiClient } from '@/lib/api-client';
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
import { QuestCard } from '@/components/ops/quests/QuestCard';

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
  } = useQuery({
    queryKey: ['missions', id],
    queryFn: () => apiClient.get<Mission>(`/missions/${id}`),
  });

  const {
    data: quests,
    isLoading: questsLoading,
    isError: questsError,
  } = useQuery({
    queryKey: ['quests', { missionId: id }],
    queryFn: () => apiClient.get<Quest[]>(`/quests?mission_id=${id}`),
  });

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
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>
          Could not load mission. Try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <BlurFade>
      <div className="space-y-8">
        {/* Back link */}
        <Link
          href="/missions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Missions
        </Link>

        {/* Mission header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">{mission.title}</h1>
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
            <AnimatedCircularProgressBar
              value={mission.progress_percent}
              gaugePrimaryColor="hsl(var(--primary))"
              gaugeSecondaryColor="hsl(var(--muted))"
              className="size-16 text-sm shrink-0"
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

          {/* Description */}
          {mission.description && (
            <p className="text-sm text-muted-foreground">
              {mission.description}
            </p>
          )}

          {/* Dates */}
          {(mission.start_date || mission.end_date) && (
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
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
              <Button render={<Link href={`/missions/${id}/quests/new`} />} size="sm">
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
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                Could not load quests. Try refreshing the page.
              </AlertDescription>
            </Alert>
          )}

          {!questsLoading && sortedQuests.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              No quests yet. Add the first quest to get started.
            </p>
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
    </BlurFade>
  );
}
