'use client';

import Link from 'next/link';
import { MagicCard } from '@/components/ui/magic-card';
import { KpiStatusBadge } from '@/components/ops/kpis/KpiStatusBadge';
import { KPI_DOMAIN_LABELS, type Kpi } from '@/lib/types/kpi';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

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
          <MagicCard key={kpi.id} gradientColor={GRADIENT_OVERLAY} className="rounded-xl">
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
          </MagicCard>
        ))}
      </div>
      <div className="flex justify-end">
        <Link
          href="/kpis"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View All KPIs
        </Link>
      </div>
    </div>
  );
}
