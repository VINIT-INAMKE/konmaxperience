'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiStatusBadge } from '@/components/ops/kpis/KpiStatusBadge';
import { KPI_DOMAIN_LABELS } from '@/lib/types/kpi';
import type { Kpi } from '@/lib/types/kpi';

interface KpiCardProps {
  kpi: Kpi;
  canEdit: boolean;
  onEdit: () => void;
}

export function KpiCard({ kpi, canEdit, onEdit }: KpiCardProps) {
  const domainLabel = KPI_DOMAIN_LABELS[kpi.domain] ?? kpi.domain;
  const linkedCount = kpi._count?.tasks ?? kpi.tasks?.length ?? 0;

  return (
    <Card className="rounded-xl py-0">
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-tight">{kpi.name}</h3>
          <p className="text-xs text-ink-muted">{domainLabel}</p>
        </div>

        {/* Description */}
        <p className="text-sm text-ink-muted line-clamp-2">
          {kpi.description}
        </p>

        {/* Values */}
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold tabular-nums">
            {kpi.current_value.toLocaleString('en-IN')}
          </span>
          <span className="text-sm text-ink-muted">
            / {kpi.target_value} {kpi.unit}
          </span>
        </div>

        {/* Status & tasks */}
        <div className="flex items-center justify-between">
          <KpiStatusBadge status={kpi.status} />
          <span className="text-xs text-ink-muted">
            {linkedCount} linked task{linkedCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Edit action — off-track KPIs get the more prominent outline button. */}
        {canEdit && (
          <Button
            variant={kpi.status === 'on_track' ? 'ghost' : 'outline'}
            size="sm"
            onClick={onEdit}
            className="w-full"
          >
            Edit
          </Button>
        )}
      </div>
    </Card>
  );
}
