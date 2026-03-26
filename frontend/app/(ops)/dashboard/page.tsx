'use client';

import { useQuery } from '@tanstack/react-query';
import { BlurFade } from '@/components/ui/blur-fade';
import { AdminUserFilter } from '@/components/ops/AdminUserFilter';
import { AdminPendingApprovalsWidget } from '@/components/ops/dashboard/AdminPendingApprovalsWidget';
import { AdminBlockersWidget } from '@/components/ops/dashboard/AdminBlockersWidget';
import { AdminAdHocInjectorWidget } from '@/components/ops/dashboard/AdminAdHocInjectorWidget';
import { MissionContextStrip } from '@/components/ops/dashboard/MissionContextStrip';
import { DashboardReadinessStrip } from '@/components/ops/dashboard/DashboardReadinessStrip';
import { DashboardKpiAlert } from '@/components/ops/dashboard/DashboardKpiAlert';
import { AdminRecentDecisionsWidget } from '@/components/ops/dashboard/AdminRecentDecisionsWidget';
import { DashboardLeaderboardPreview } from '@/components/ops/dashboard/DashboardLeaderboardPreview';
import { DashboardLowStockAlert } from '@/components/ops/dashboard/DashboardLowStockAlert';
import { ActivityFeedWidget } from '@/components/ops/dashboard/ActivityFeedWidget';
import { TeamContributionWidget } from '@/components/ops/dashboard/TeamContributionWidget';
import { RoleDashboardSections } from '@/components/ops/dashboard/RoleDashboardSections';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { ReadinessMeter } from '@/lib/types/readiness';
import type { Kpi } from '@/lib/types/kpi';
import type { LeaderboardResponse } from '@/lib/types/leaderboard';
import type { IngredientStock } from '@/lib/types/inventory';

function ReadinessStripSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="shrink-0 flex flex-col items-center gap-2">
          <div className="size-16 rounded-full bg-muted animate-pulse" />
          <div className="h-3 w-14 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function KpiAlertSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl border p-4 space-y-2 animate-pulse">
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="size-10 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-5 rounded bg-muted animate-pulse" />
          <div className="h-3 flex-1 rounded bg-muted animate-pulse" />
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  if (isAdmin) {
    return <AdminDashboard />;
  }

  return (
    <BlurFade>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <RoleDashboardSections />
      </div>
    </BlurFade>
  );
}

function AdminDashboard() {
  const {
    data: meters,
    isLoading: metersLoading,
  } = useQuery({
    queryKey: ['readiness-meters'],
    queryFn: () => apiClient.get<ReadinessMeter[]>('/readiness-meters'),
  });

  const {
    data: kpis,
    isLoading: kpisLoading,
  } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => apiClient.get<Kpi[]>('/kpis'),
  });

  const {
    data: leaderboard,
    isLoading: leaderboardLoading,
  } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => apiClient.get<LeaderboardResponse>('/leaderboard'),
  });

  const {
    data: lowStockItems,
    isLoading: lowStockLoading,
  } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => apiClient.get<IngredientStock[]>('/inventory/low-stock'),
  });

  const hasLowMeters = meters && meters.length > 0;
  const hasAlertKpis = kpis && kpis.some((k) => k.status !== 'on_track');
  const hasLeaderboard = leaderboard && leaderboard.enabled && leaderboard.users.length > 0;
  const hasLowStock = lowStockItems && lowStockItems.length > 0;

  return (
    <div className="space-y-10">
      {/* Page header */}
      <BlurFade delay={0.05}>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-bold">Mission Control</h1>
            <AdminUserFilter />
          </div>
          <MissionContextStrip />
        </div>
      </BlurFade>

      {/* === ACTION ZONE — what needs you NOW === */}
      <BlurFade delay={0.15}>
        <section className="bg-amber-500/[0.02] dark:bg-amber-500/[0.03] rounded-2xl p-4 -mx-2 space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Action Required</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <BlurFade delay={0.2}>
              <AdminPendingApprovalsWidget />
            </BlurFade>
            <BlurFade delay={0.28}>
              <AdminBlockersWidget />
            </BlurFade>
            <BlurFade delay={0.36}>
              <AdminAdHocInjectorWidget />
            </BlurFade>
          </div>

          {/* KPI Alerts */}
          {(kpisLoading || hasAlertKpis) && (
            <BlurFade delay={0.44}>
              <div>
                {kpisLoading ? (
                  <div className="space-y-3">
                    <span className="text-sm font-semibold">KPIs Requiring Attention</span>
                    <KpiAlertSkeleton />
                  </div>
                ) : (
                  kpis && <DashboardKpiAlert kpis={kpis} />
                )}
              </div>
            </BlurFade>
          )}
        </section>
      </BlurFade>

      {/* === STATUS ZONE — current state of things === */}
      <BlurFade delay={0.35}>
        <section className="bg-blue-500/[0.02] dark:bg-blue-500/[0.03] rounded-2xl p-4 -mx-2 space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</h2>

          {/* Readiness Strip */}
          {(metersLoading || hasLowMeters) && (
            <BlurFade delay={0.4}>
              <div>
                {metersLoading ? (
                  <ReadinessStripSkeleton />
                ) : (
                  meters && <DashboardReadinessStrip meters={meters} />
                )}
              </div>
            </BlurFade>
          )}

          {/* Activity Feed + Team Contribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BlurFade delay={0.48}>
              <ActivityFeedWidget />
            </BlurFade>
            <BlurFade delay={0.56}>
              <TeamContributionWidget />
            </BlurFade>
          </div>

          {/* Recent Decisions */}
          <BlurFade delay={0.64}>
            <AdminRecentDecisionsWidget />
          </BlurFade>
        </section>
      </BlurFade>

      {/* === INTELLIGENCE ZONE — context & insights === */}
      <BlurFade delay={0.55}>
        <section className="bg-emerald-500/[0.02] dark:bg-emerald-500/[0.03] rounded-2xl p-4 -mx-2 space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Intelligence</h2>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              {(leaderboardLoading || (leaderboard && leaderboard.enabled)) ? (
                <BlurFade delay={0.6}>
                  <section>
                    {leaderboardLoading ? (
                      <div className="space-y-3">
                        <span className="text-sm font-semibold">Leaderboard</span>
                        <LeaderboardSkeleton />
                      </div>
                    ) : (
                      leaderboard && <DashboardLeaderboardPreview data={leaderboard} />
                    )}
                  </section>
                </BlurFade>
              ) : null}
            </div>
            <div className="lg:col-span-2">
              {(lowStockLoading || hasLowStock) ? (
                <BlurFade delay={0.68}>
                  <section className="space-y-3">
                    {lowStockLoading ? (
                      <div className="animate-pulse h-24 bg-muted/30 rounded-lg" />
                    ) : (
                      lowStockItems && <DashboardLowStockAlert lowStockItems={lowStockItems} />
                    )}
                  </section>
                </BlurFade>
              ) : null}
            </div>
          </div>
        </section>
      </BlurFade>
    </div>
  );
}
