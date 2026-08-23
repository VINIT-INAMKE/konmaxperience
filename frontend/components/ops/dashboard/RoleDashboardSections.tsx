'use client';

import Link from 'next/link';
import { CheckCircle, Rocket } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ProgressRing } from '@/components/ops/ProgressRing';
import { XpProgressBar } from '@/components/ops/gamification/XpProgressBar';
import { LevelBadge } from '@/components/ops/gamification/LevelBadge';
import { DashboardKpiAlert } from '@/components/ops/dashboard/DashboardKpiAlert';
import { DashboardLowStockAlert } from '@/components/ops/dashboard/DashboardLowStockAlert';
import { TodaysFocusSection } from '@/components/ops/dashboard/TodaysFocusSection';
import { apiClient } from '@/lib/api-client';
import { getTaskStatusBadge } from '@/lib/status-styles';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { ReadinessMeter } from '@/lib/types/readiness';
import type { Evidence } from '@/lib/types/evidence';
import type { Kpi } from '@/lib/types/kpi';
import type { IngredientStock } from '@/lib/types/inventory';
import { format, isPast, parseISO } from 'date-fns';

interface TaskItem {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  quest?: { id: string; title: string } | null;
}

interface QuestItem {
  id: string;
  title: string;
  status: string;
  progress: number;
  owner_user_id: string;
  baseline_task_count: number;
  core_progress: number;
  adhoc_progress: number;
}

/** Maps role codes to relevant readiness meter names for contribution display */
function getRelevantMeterNames(roleCode: string): string[] {
  switch (roleCode) {
    case RoleCode.BACKEND_LEAD:
      return ['Backend', 'Food', 'Standardization'];
    case RoleCode.FRONTEND_LEAD:
      return ['Frontend', 'Service'];
    case RoleCode.BI_LEAD:
      return ['Business Intelligence', 'Finance'];
    case RoleCode.PROCUREMENT_LEAD:
      return ['Procurement', 'Supply'];
    case RoleCode.TALENT_LEAD:
      return ['Talent', 'Hiring'];
    case RoleCode.TECH_LEAD:
      return ['Tech', 'Systems'];
    case RoleCode.DESIGN_OUTREACH_LEAD:
      return ['Design', 'Outreach', 'Brand'];
    default:
      return ['Villa'];
  }
}

export function RoleDashboardSections() {
  const user = useAuthStore((s) => s.user);

  // Section 1: My Tasks
  const {
    data: allTasks,
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['tasks', 'my'],
    queryFn: () => apiClient.get<TaskItem[]>('/tasks'),
  });

  const myTasks = allTasks
    ? allTasks
        .filter((t) => t.assigned_to === user?.id && t.status !== 'done')
        .sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        })
    : [];

  // Section 2: Active Quest
  const {
    data: allQuests,
    isLoading: questsLoading,
    isError: questsError,
    refetch: refetchQuests,
  } = useQuery({
    queryKey: ['quests', 'my'],
    queryFn: () => apiClient.get<QuestItem[]>('/quests'),
  });

  const activeQuest = allQuests?.find(
    (q) => q.owner_user_id === user?.id && q.status === 'active',
  );

  // Section 4: My Contributions - Readiness meters
  const { data: meters } = useQuery({
    queryKey: ['readiness-meters'],
    queryFn: () => apiClient.get<ReadinessMeter[]>('/readiness-meters'),
  });

  // Section 4: My Contributions - Evidence count
  const { data: evidenceFeed } = useQuery({
    queryKey: ['evidence', 'my'],
    queryFn: () => apiClient.get<Evidence[]>('/evidence/feed'),
  });
  const myEvidenceCount = evidenceFeed?.filter((e) => e.uploaded_by === user?.id).length ?? 0;

  // Section 5: Team Alerts
  const { data: kpis } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => apiClient.get<Kpi[]>('/kpis'),
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => apiClient.get<IngredientStock[]>('/inventory/low-stock'),
  });

  // Determine relevant readiness meters for this role
  const relevantMeterNames = getRelevantMeterNames(user?.roleCode ?? '');
  const relevantMeters = meters
    ? meters
        .filter(
          (m) =>
            relevantMeterNames.some((name) =>
              m.name.toLowerCase().includes(name.toLowerCase()),
            ),
        )
        .slice(0, 3)
    : [];
  // If no role-specific meters found, fall back to top 3 by lowest value
  const displayMeters =
    relevantMeters.length > 0
      ? relevantMeters
      : (meters ?? [])
          .sort((a, b) => a.current_value - b.current_value)
          .slice(0, 3);

  const hasAlertKpis = kpis && kpis.some((k) => k.status !== 'on_track');
  const hasLowStock = lowStockItems && lowStockItems.length > 0;

  return (
    <div className="space-y-6">
      {/* Today's Focus — shown when there are overdue/due-today tasks */}
      <TodaysFocusSection allTasks={allTasks as any} />

      {/* Row 1: My Tasks + Active Quest */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: My Tasks */}
        <Card>
          <CardContent className="pt-4">
            <span className="text-sm font-bold">My Tasks</span>
            {tasksLoading ? (
              <div className="space-y-3 mt-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                ))}
              </div>
            ) : tasksError ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTitle>Could not load your tasks</AlertTitle>
                <AlertDescription>The task list did not respond.</AlertDescription>
                <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => void refetchTasks()}>
                  Retry
                </Button>
              </Alert>
            ) : myTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle className="size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">All caught up — new tasks appear when quests are assigned.</p>
                <Button nativeButton={false} render={<Link href="/tasks" />} variant="outline" size="sm">
                  Browse all tasks
                </Button>
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                {myTasks.slice(0, 8).map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                  >
                    <span className="flex-1 text-sm truncate">{task.title}</span>
                    {task.quest && (
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {task.quest.title}
                      </span>
                    )}
                    {task.due_date && (
                      <span
                        className={`text-xs shrink-0 ${
                          isPast(parseISO(task.due_date)) ? 'text-destructive' : 'text-muted-foreground'
                        }`}
                      >
                        {format(parseISO(task.due_date), 'MMM d')}
                      </span>
                    )}
                    <Badge
                      className={`text-[10px] shrink-0 ${getTaskStatusBadge(task.status)}`}
                    >
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Active Quest */}
        <Card>
          <CardContent className="pt-4">
            <span className="text-sm font-bold">Active Quest</span>
            {questsLoading ? (
              <div className="space-y-3 mt-3">
                <div className="h-5 w-2/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
                <div className="h-2 w-full rounded bg-muted animate-pulse motion-reduce:animate-none" />
                <div className="h-4 w-1/4 rounded bg-muted animate-pulse motion-reduce:animate-none" />
              </div>
            ) : questsError ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTitle>Could not load your quests</AlertTitle>
                <AlertDescription>The quest list did not respond.</AlertDescription>
                <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => void refetchQuests()}>
                  Retry
                </Button>
              </Alert>
            ) : !activeQuest ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Rocket className="size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No active quest — check Missions for available quests.</p>
                <Button nativeButton={false} render={<Link href="/missions" />} variant="outline" size="sm">
                  Browse missions
                </Button>
              </div>
            ) : (
              <div className="space-y-3 mt-3">
                <p className="text-base font-medium">{activeQuest.title}</p>
                <Progress value={activeQuest.progress}>
                  <ProgressLabel className="text-xs text-muted-foreground">
                    Progress
                  </ProgressLabel>
                  <ProgressValue className="text-xs" />
                </Progress>
                <p className="text-xs text-muted-foreground">
                  {activeQuest.core_progress + activeQuest.adhoc_progress}/
                  {activeQuest.baseline_task_count} tasks
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: My Progress (XP strip) */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold shrink-0">My Progress</span>
            <div className="flex-1">
              <XpProgressBar
                xpTotal={user?.xp_total ?? 0}
                level={user?.level ?? 1}
              />
            </div>
            <LevelBadge level={user?.level ?? 1} className="shrink-0" />
          </div>
        </CardContent>
      </Card>

      {/* Row 3: My Contributions */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <span className="text-sm font-bold">My Contributions</span>

          {/* Sub-section a: Readiness Contributions */}
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              Readiness Contributions
            </span>
            {displayMeters.length > 0 ? (
              <div className="flex items-center gap-6 mt-3 overflow-x-auto">
                {displayMeters.map((meter) => (
                  <div key={meter.id} className="flex shrink-0 flex-col items-center gap-1">
                    <ProgressRing
                      value={meter.current_value}
                      max={meter.target_value || 100}
                      className="size-16 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground text-center truncate max-w-[80px]">
                      {meter.name}
                    </span>
                    <span className="text-xs font-bold tabular-nums">
                      {Math.round((meter.current_value / (meter.target_value || 100)) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                No readiness data available.
              </p>
            )}
          </div>

          <Separator />

          {/* Sub-section b: Evidence Submitted */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Evidence Submitted
              </span>
              <Badge variant="secondary" className="text-xs">
                {myEvidenceCount} submissions
              </Badge>
            </div>
            <Link
              href="/boards/evidence"
              className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            >
              View feed
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Row 4: Team Alerts */}
      {(hasAlertKpis || hasLowStock) && (
        <div className="rounded-lg bg-muted/30 p-4 space-y-4">
          <span className="text-sm font-bold">Team Alerts</span>
          {hasAlertKpis && kpis && <DashboardKpiAlert kpis={kpis} />}
          {hasLowStock && lowStockItems && (
            <DashboardLowStockAlert lowStockItems={lowStockItems} />
          )}
          {!hasAlertKpis && !hasLowStock && (
            <p className="text-sm text-muted-foreground">All systems operational</p>
          )}
        </div>
      )}
    </div>
  );
}
