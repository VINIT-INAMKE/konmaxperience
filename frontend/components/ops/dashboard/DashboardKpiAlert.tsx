'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { KpiStatusBadge } from '@/components/ops/kpis/KpiStatusBadge';
import { KPI_DOMAIN_LABELS, type Kpi } from '@/lib/types/kpi';

interface DashboardKpiAlertProps {
  kpis: Kpi[];
}

export function DashboardKpiAlert({ kpis }: DashboardKpiAlertProps) {
  // Filter to only at_risk or off_track KPIs
  const alertKpis = kpis.filter((k) => k.status !== 'on_track');

  if (alertKpis.length === 0) {
    return null;
  }

  // Show max 4 cards
  const displayKpis = alertKpis.slice(0, 4);

  return (
    <div className="space-y-3">
      <span className="text-sm font-semibold">KPIs Requiring Attention</span>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {displayKpis.map((kpi) => (
          <Card key={kpi.id} className="py-0">
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium leading-tight">{kpi.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {KPI_DOMAIN_LABELS[kpi.domain] ?? kpi.domain}
                  </p>
                </div>
                <KpiStatusBadge status={kpi.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {kpi.current_value} / {kpi.target_value} {kpi.unit}
              </p>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Link
          href="/kpis"
          className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        >
          View All KPIs
        </Link>
      </div>
    </div>
  );
}
