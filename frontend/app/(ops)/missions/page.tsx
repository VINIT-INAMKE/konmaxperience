'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Rocket, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BlurFade } from '@/components/ui/blur-fade';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RoleCode } from '@/lib/types/roles';
import {
  MISSION_PHASE_LABELS,
  MISSION_SCOPE_LABELS,
  type Mission,
} from '@/lib/types/missions';
import { MissionCard } from '@/components/ops/missions/MissionCard';

export default function MissionsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;

  const {
    data: missions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['missions'],
    queryFn: () => apiClient.get<Mission[]>('/missions'),
  });

  const isEmpty = !isLoading && (!missions || missions.length === 0);

  return (
    <BlurFade>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Missions</h1>
          {isAdmin && (
            <Button render={<Link href="/missions/new" />}>
              <Plus className="size-4" />
              New mission
            </Button>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <div className="space-y-4 animate-pulse">
                  <div className="flex gap-2">
                    <div className="h-5 w-16 rounded bg-muted" />
                    <div className="h-5 w-12 rounded bg-muted" />
                  </div>
                  <div className="h-5 w-3/4 rounded bg-muted" />
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-full bg-muted" />
                    <div className="h-4 w-20 rounded bg-muted" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              Could not load missions. Try refreshing the page.
            </AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <Rocket className="size-12 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">No missions yet</h2>
              <p className="text-sm text-muted-foreground">
                Create your first mission to start organizing work.
              </p>
            </div>
            {isAdmin && (
              <Button render={<Link href="/missions/new" />}>
                <Plus className="size-4" />
                New mission
              </Button>
            )}
          </div>
        )}

        {/* Mission grid */}
        {missions && missions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {missions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                phaseLabelMap={MISSION_PHASE_LABELS}
                scopeLabelMap={MISSION_SCOPE_LABELS}
              />
            ))}
          </div>
        )}
      </div>
    </BlurFade>
  );
}
