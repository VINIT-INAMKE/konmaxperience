'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Rocket } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BlurFade } from '@/components/ui/blur-fade';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import type { Mission, MissionStatus } from '@/lib/types/missions';
import { BoardMissionCard } from '@/components/ops/boards/MissionCard';
import { ExportButton } from '@/components/ops/exports/ExportButton';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'planned', label: 'Planned' },
  { value: 'paused', label: 'Paused' },
];

export default function MissionBoardPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const {
    data: missions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['missions'],
    queryFn: () => apiClient.get<Mission[]>('/missions'),
  });

  const filtered = useMemo(() => {
    if (!missions) return [];
    if (statusFilter === 'all') return missions;
    return missions.filter((m) => m.status === statusFilter);
  }, [missions, statusFilter]);

  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <BlurFade>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mission Board</h1>
          <div className="flex items-center gap-2">
            <ExportButton reportType="missions" reportName="Missions" isTimeSeries={false} />
            <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? 'all')}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4">
                <div className="space-y-3 animate-pulse">
                  <div className="h-5 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="h-2 w-full rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <p className="text-sm text-destructive">
            Could not load data. Refresh the page to try again.
          </p>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <Rocket className="size-12 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-xl font-bold">No missions yet</h2>
              <p className="text-sm text-muted-foreground">
                Create a mission to get started.
              </p>
            </div>
          </div>
        )}

        {/* Mission grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((mission) => (
              <BoardMissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        )}
      </div>
    </BlurFade>
  );
}
