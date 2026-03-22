'use client';

import { MagicCard } from '@/components/ui/magic-card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { PulsatingButton } from '@/components/ui/pulsating-button';
import { Button } from '@/components/ui/button';
import { KpiStatusBadge } from '@/components/ops/kpis/KpiStatusBadge';
import { KPI_DOMAIN_LABELS } from '@/lib/types/kpi';
import type { Kpi } from '@/lib/types/kpi';
import { GRADIENT_OVERLAY } from '@/lib/brand-colors';

interface KpiCardProps {
  kpi: Kpi;
  canEdit: boolean;
  onEdit: () => void;
}

export function KpiCard({ kpi, canEdit, onEdit }: KpiCardProps) {
  const domainLabel = KPI_DOMAIN_LABELS[kpi.domain] ?? kpi.domain;
  const linkedCount = kpi.tasks.length;

  return (
    <MagicCard gradientColor={GRADIENT_OVERLAY} className="rounded-xl">
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-tight">{kpi.name}</h3>
          <p className="text-xs text-muted-foreground">{domainLabel}</p>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {kpi.description}
        </p>

        {/* Values */}
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold">
            <NumberTicker value={kpi.current_value} />
          </span>
          <span className="text-sm text-muted-foreground">
            / {kpi.target_value} {kpi.unit}
          </span>
        </div>

        {/* Status & tasks */}
        <div className="flex items-center justify-between">
          <KpiStatusBadge status={kpi.status} />
          <span className="text-xs text-muted-foreground">
            {linkedCount} linked task{linkedCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Edit action */}
        {canEdit && (
          <div>
            {kpi.status === 'on_track' ? (
              <Button variant="ghost" size="sm" onClick={onEdit} className="w-full">
                Edit
              </Button>
            ) : kpi.status === 'at_risk' ? (
              <PulsatingButton
                pulseColor="rgba(245,158,11,0.4)"
                onClick={onEdit}
                className="w-full text-sm h-8"
              >
                Edit
              </PulsatingButton>
            ) : (
              <PulsatingButton
                pulseColor="rgba(239,68,68,0.4)"
                onClick={onEdit}
                className="w-full text-sm h-8"
              >
                Edit
              </PulsatingButton>
            )}
          </div>
        )}
      </div>
    </MagicCard>
  );
}
