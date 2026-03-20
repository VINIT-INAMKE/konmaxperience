'use client';

import { useQuery } from '@tanstack/react-query';
import { BlurFade } from '@/components/ui/blur-fade';
import { Card, CardContent } from '@/components/ui/card';
import { AdminUserFilter } from '@/components/ops/AdminUserFilter';
import { DashboardReadinessStrip } from '@/components/ops/dashboard/DashboardReadinessStrip';
import { DashboardKpiAlert } from '@/components/ops/dashboard/DashboardKpiAlert';
import { DashboardLeaderboardPreview } from '@/components/ops/dashboard/DashboardLeaderboardPreview';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import type { ReadinessMeter } from '@/lib/types/readiness';
import type { Kpi } from '@/lib/types/kpi';
import type { LeaderboardResponse } from '@/lib/types/leaderboard';

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

  // Determine if each section has visible content
  const hasLowMeters = meters && meters.length > 0;
  const hasAlertKpis = kpis && kpis.some((k) => k.status !== 'on_track');
  const hasLeaderboard = leaderboard && leaderboard.enabled && leaderboard.users.length > 0;

  const allDataLoaded = !metersLoading && !kpisLoading && !leaderboardLoading;
  const allSectionsEmpty = allDataLoaded && !hasLowMeters && !hasAlertKpis && !hasLeaderboard;

  return (
    <BlurFade>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold">Mission Control</h1>
          {isAdmin && <AdminUserFilter />}
        </div>

        {/* Section 1: Readiness Strip */}
        {(metersLoading || hasLowMeters) && (
          <section className="space-y-3">
            {metersLoading ? (
              <>
                <span className="text-sm font-semibold">Attention Needed</span>
                <ReadinessStripSkeleton />
              </>
            ) : (
              meters && <DashboardReadinessStrip meters={meters} />
            )}
          </section>
        )}

        {/* Section 2: KPI Alerts */}
        {(kpisLoading || hasAlertKpis) && (
          <section>
            {kpisLoading ? (
              <div className="space-y-3">
                <span className="text-sm font-semibold">KPIs Requiring Attention</span>
                <KpiAlertSkeleton />
              </div>
            ) : (
              kpis && <DashboardKpiAlert kpis={kpis} />
            )}
          </section>
        )}

        {/* Section 3: Leaderboard Preview */}
        {(leaderboardLoading || (leaderboard && leaderboard.enabled)) && (
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
        )}

        {/* All clear state */}
        {allSectionsEmpty && (
          <Card>
            <CardContent className="px-6 py-8 text-center">
              <p className="text-muted-foreground">
                All systems operational. No items require attention.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </BlurFade>
  );
}
