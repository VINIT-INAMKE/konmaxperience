'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BarChart3, RefreshCw } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { KpiCard } from '@/components/ops/kpis/KpiCard';
import { KpiForm } from '@/components/ops/kpis/KpiForm';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { KPI_DOMAIN_LABELS, type Kpi } from '@/lib/types/kpi';

function KpiSkeletonCard() {
  return (
    <Card className="p-5 animate-pulse space-y-4">
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/3 rounded bg-muted" />
      </div>
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="h-6 w-1/4 rounded bg-muted" />
      <div className="h-8 w-full rounded bg-muted" />
    </Card>
  );
}

export default function KpisPage() {
  const [editingKpi, setEditingKpi] = useState<Kpi | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('all');

  const hasManageKpis = useAuthStore.getState().hasPermission('MANAGE_KPIS');

  const {
    data: kpis,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => apiClient.get<Kpi[]>('/kpis'),
  });

  function handleCreate() {
    setEditingKpi(undefined);
    setFormOpen(true);
  }

  function handleEdit(kpi: Kpi) {
    setEditingKpi(kpi);
    setFormOpen(true);
  }

  // Get unique domains from fetched data
  const domains = kpis
    ? Array.from(new Set(kpis.map((k) => k.domain))).sort()
    : [];

  const filteredKpis =
    selectedDomain === 'all'
      ? kpis ?? []
      : (kpis ?? []).filter((k) => k.domain === selectedDomain);

  const isEmpty = !isLoading && !isError && (!kpis || kpis.length === 0);

  return (
    <BlurFade>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold">KPI Tracker</h1>
          {hasManageKpis && (
            <ShimmerButton
              onClick={handleCreate}
              className="text-sm px-5 py-2"
            >
              Create KPI
            </ShimmerButton>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <KpiSkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="flex items-center gap-3">
              Couldn&apos;t load KPIs. Refresh the page or try again.
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="ml-auto"
              >
                <RefreshCw className="size-3.5 mr-1" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <BarChart3 className="size-12 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">No KPIs yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Create your first KPI to track domain metrics. Each KPI can be linked to contributing tasks.
              </p>
            </div>
            {hasManageKpis && (
              <ShimmerButton onClick={handleCreate} className="text-sm px-5 py-2">
                Create KPI
              </ShimmerButton>
            )}
          </div>
        )}

        {/* KPI grid with domain filter tabs */}
        {kpis && kpis.length > 0 && (
          <Tabs value={selectedDomain} onValueChange={setSelectedDomain}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="all">All</TabsTrigger>
              {domains.map((domain) => (
                <TabsTrigger key={domain} value={domain}>
                  {KPI_DOMAIN_LABELS[domain] ?? domain}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedDomain} className="mt-4">
              {filteredKpis.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No KPIs in this domain.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredKpis.map((kpi) => (
                    <KpiCard
                      key={kpi.id}
                      kpi={kpi}
                      canEdit={hasManageKpis}
                      onEdit={() => handleEdit(kpi)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* KPI Form Sheet */}
        <KpiForm
          kpi={editingKpi}
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditingKpi(undefined);
          }}
        />
      </div>
    </BlurFade>
  );
}
