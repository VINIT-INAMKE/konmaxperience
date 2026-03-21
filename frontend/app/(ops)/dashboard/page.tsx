'use client';

import { useQuery } from '@tanstack/react-query';
import { BlurFade } from '@/components/ui/blur-fade';
import { Card, CardContent } from '@/components/ui/card';
import { AdminUserFilter } from '@/components/ops/AdminUserFilter';
import { AdminPendingApprovalsWidget } from '@/components/ops/dashboard/AdminPendingApprovalsWidget';
import { AdminBlockersWidget } from '@/components/ops/dashboard/AdminBlockersWidget';
import { AdminAdHocInjectorWidget } from '@/components/ops/dashboard/AdminAdHocInjectorWidget';
import { DashboardReadinessStrip } from '@/components/ops/dashboard/DashboardReadinessStrip';
import { DashboardKpiAlert } from '@/components/ops/dashboard/DashboardKpiAlert';
import { AdminRecentDecisionsWidget } from '@/components/ops/dashboard/AdminRecentDecisionsWidget';
import { DashboardLeaderboardPreview } from '@/components/ops/dashboard/DashboardLeaderboardPreview';
import { DashboardLowStockAlert } from '@/components/ops/dashboard/DashboardLowStockAlert';
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
        <h1 className="text-2xl font-semibold">My Dashboard</h1>
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
    <BlurFade>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold">Mission Control</h1>
          <AdminUserFilter />
        </div>

        {/* Row 1: Approvals, Blockers, Ad-hoc Injector (D-04 positions 1-3) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AdminPendingApprovalsWidget />
          <AdminBlockersWidget />
          <AdminAdHocInjectorWidget />
        </div>

        {/* Row 2: Readiness Strip (D-04 position 4) */}
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

        {/* Row 3: KPI Alerts (D-04 position 5) */}
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

        {/* Row 4: Recent Decisions (D-04 position 6 — AFTER KPI alerts) */}
        <section>
          <AdminRecentDecisionsWidget />
        </section>

        {/* Row 5: Leaderboard + Low Stock (D-04 positions 7-8) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            {(leaderboardLoading || (leaderboard && leaderboard.enabled)) ? (
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
            ) : null}
          </div>
          <div className="lg:col-span-2">
            {(lowStockLoading || hasLowStock) ? (
              <section className="space-y-3">
                {lowStockLoading ? (
                  <div className="animate-pulse h-24 bg-muted/30 rounded-lg" />
                ) : (
                  lowStockItems && <DashboardLowStockAlert lowStockItems={lowStockItems} />
                )}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </BlurFade>
  );
}
