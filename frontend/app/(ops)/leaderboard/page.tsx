'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Trophy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LeaderboardTable } from '@/components/ops/leaderboard/LeaderboardTable';
import { LeaderboardPodium } from '@/components/ops/leaderboard/LeaderboardPodium';
import { BlurFade } from '@/components/ui/blur-fade';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { LeaderboardResponse } from '@/lib/types/leaderboard';
import { ExportButton } from '@/components/ops/exports/ExportButton';

export default function LeaderboardPage() {
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => apiClient.get<LeaderboardResponse>('/leaderboard'),
  });

  const isEmpty =
    !isLoading && !isError && data?.enabled && (!data.users || data.users.length === 0);

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Team Leaderboard</h1>
          <ExportButton
            reportType="leaderboard"
            reportName="Leaderboard"
            isTimeSeries={false}
          />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 animate-pulse">
                <div className="h-4 w-8 rounded bg-muted" />
                <div className="size-8 rounded-full bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted ml-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                Couldn&apos;t load leaderboard. Refresh the page or try again in a moment.
              </AlertDescription>
            </Alert>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Kill switch off state */}
        {!isLoading && !isError && data?.enabled === false && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Trophy className="size-12 text-muted-foreground/30" />
              <h2 className="text-lg font-semibold">Leaderboard Paused</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Rankings are currently hidden. Keep completing tasks to earn XP — your progress is being tracked.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <Trophy className="size-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">No Rankings Yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Complete and validate tasks to earn XP and appear on the leaderboard.
            </p>
          </div>
        )}

        {/* Populated state — podium + ranked table */}
        {!isLoading && !isError && data?.enabled && data.users && data.users.length > 0 && (
          <BlurFade>
            <div className="space-y-6">
              {data.users.length >= 2 && (
                <LeaderboardPodium
                  users={data.users}
                  currentUserId={currentUserId}
                />
              )}
              <LeaderboardTable
                users={data.users}
                currentUserId={currentUserId}
                startRank={1}
              />
            </div>
          </BlurFade>
        )}
      </div>
  );
}
