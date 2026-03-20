'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AvatarCircles } from '@/components/ui/avatar-circles';
import { TextAnimate } from '@/components/ui/text-animate';
import { LeaderboardPodium } from '@/components/ops/leaderboard/LeaderboardPodium';
import { LeaderboardTable } from '@/components/ops/leaderboard/LeaderboardTable';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { LeaderboardResponse } from '@/lib/types/leaderboard';

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

  // Derive recent level-ups: users with level > 1, sorted by level descending, take top 3
  const recentLevelUps = data?.users
    ? [...data.users]
        .filter((u) => u.level > 1)
        .sort((a, b) => b.level - a.level)
        .slice(0, 3)
    : [];

  const levelUpAvatarUrls = recentLevelUps.map((u) => ({
    imageUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`,
  }));

  return (
    <BlurFade>
      <div className="space-y-8">
        {/* Header */}
        <h1 className="text-xl font-semibold">Team Leaderboard</h1>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6">
            {/* Podium skeleton */}
            <div className="flex items-end justify-center gap-4 py-6">
              {[2, 1, 3].map((rank) => (
                <div
                  key={rank}
                  className={`flex flex-col items-center gap-2 p-4 animate-pulse ${rank === 1 ? '-translate-y-5' : ''}`}
                >
                  <div className="size-12 rounded-full bg-muted" />
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-5 w-16 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
            {/* Table skeleton */}
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
            <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-2">
              <h2 className="text-lg font-semibold">Leaderboard Paused</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Rankings are currently hidden. Keep completing tasks to earn XP — your progress is being tracked.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <p className="text-sm text-muted-foreground max-w-md">
              No rankings yet. Complete and validate tasks to earn XP and appear on the leaderboard.
            </p>
          </div>
        )}

        {/* Populated state */}
        {!isLoading && !isError && data?.enabled && data.users && data.users.length > 0 && (
          <>
            {/* Podium - top 3 */}
            <LeaderboardPodium users={data.users} currentUserId={currentUserId} />

            {/* Ranked table - rank 4 and beyond */}
            {data.users.length > 3 && (
              <LeaderboardTable
                users={data.users.slice(3)}
                currentUserId={currentUserId}
                startRank={4}
              />
            )}

            {/* Recent level-ups strip */}
            {recentLevelUps.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border p-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Recent Level-Ups
                </span>
                <div className="flex items-center gap-4">
                  <AvatarCircles avatarUrls={levelUpAvatarUrls} />
                  <TextAnimate
                    as="p"
                    animation="blurIn"
                    by="word"
                    className="text-sm font-medium whitespace-normal"
                  >
                    {`${recentLevelUps[0].name} just reached Level ${recentLevelUps[0].level}!`}
                  </TextAnimate>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </BlurFade>
  );
}
