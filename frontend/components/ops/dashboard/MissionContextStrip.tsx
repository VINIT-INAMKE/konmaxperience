'use client';

import { useQuery } from '@tanstack/react-query';
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import type { MissionPhase } from '@/lib/types/missions';
import type { ReadinessMeter } from '@/lib/types/readiness';

interface MissionControlResponse {
  missions: Array<{
    id: string;
    title: string;
    phase: MissionPhase;
    status: string;
    progress_percent: number;
    quests?: Array<{
      id: string;
      title: string;
      status: string;
      progress_percent: number;
    }>;
  }>;
  readiness: ReadinessMeter[];
  actionRequired: {
    pendingApprovals: number;
    blockers: number;
    overdueTasks: number;
  };
}

const PHASE_BADGE_CLASSES: Record<MissionPhase, string> = {
  setup: 'bg-muted text-muted-foreground border-0',
  foundation: 'bg-blue-500/15 text-blue-500 border-0',
  activation: 'bg-amber-500/15 text-amber-500 border-0',
  scale: 'bg-emerald-500/15 text-emerald-500 border-0',
};

const PHASE_LABELS: Record<MissionPhase, string> = {
  setup: 'Setup',
  foundation: 'Foundation',
  activation: 'Activation',
  scale: 'Scale',
};

function Divider() {
  return <div className="w-px self-stretch bg-foreground/5" />;
}

export function MissionContextStrip() {
  const { data, isLoading } = useQuery({
    queryKey: ['mission-control'],
    queryFn: () => apiClient.get<MissionControlResponse>('/missions/mission-control'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-6 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 ring-1 ring-foreground/5 px-6 py-3 animate-pulse">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="w-px h-6 bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="w-px h-6 bg-muted" />
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="w-px h-6 bg-muted" />
        <div className="size-8 rounded-full bg-muted" />
      </div>
    );
  }

  // Find the first active mission
  const activeMission = data?.missions?.find((m) => m.status === 'active');

  // If no active mission, don't render the strip
  if (!activeMission) return null;

  // Find an active quest within the mission
  const activeQuest = activeMission.quests?.find((q) => q.status === 'active');

  // Calculate overall readiness percentage
  const meters = data?.readiness ?? [];
  const overallReadiness =
    meters.length > 0
      ? Math.round(
          meters.reduce(
            (sum, m) => sum + (m.current_value / (m.target_value || 100)) * 100,
            0,
          ) / meters.length,
        )
      : 0;

  return (
    <div className="flex items-center gap-6 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 ring-1 ring-foreground/5 px-6 py-3">
      {/* Mission Name */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Mission
        </span>
        <span className="text-sm font-medium truncate">
          {activeMission.title}
        </span>
      </div>

      <Divider />

      {/* Phase Badge */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Phase
        </span>
        <Badge
          variant="secondary"
          className={`text-[10px] w-fit ${PHASE_BADGE_CLASSES[activeMission.phase]}`}
        >
          {PHASE_LABELS[activeMission.phase]}
        </Badge>
      </div>

      <Divider />

      {/* Active Quest */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Active Quest
        </span>
        <span className="text-sm font-medium truncate">
          {activeQuest ? activeQuest.title : 'None'}
        </span>
      </div>

      <Divider />

      {/* Readiness */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Readiness
          </span>
          <span className="text-sm font-bold tabular-nums">{overallReadiness}%</span>
        </div>
        <AnimatedCircularProgressBar
          value={overallReadiness}
          max={100}
          gaugePrimaryColor="var(--primary)"
          gaugeSecondaryColor="var(--muted)"
          className="size-8 text-[8px]"
          showValue={false}
        />
      </div>
    </div>
  );
}
