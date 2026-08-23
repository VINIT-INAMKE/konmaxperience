'use client';

/**
 * The XP leaderboard, extracted from `app/(ops)/leaderboard` so the `/team` hub's
 * Leaderboard tab and the standalone route share one implementation
 * (SPEC §6.2 item 8 / Decision 11).
 *
 * `GET /leaderboard` carries its own kill switch: `enabled` is
 * `SystemSetting['leaderboard_enabled']`, so the tab and the page both learn the
 * switch's state from the data they already fetch — no second request, and the
 * `['leaderboard']` query key is shared so `TeamTabs` reuses this cache entry.
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Trophy } from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeaderboardPodium } from '@/components/ops/leaderboard/LeaderboardPodium';
import { LeaderboardTable } from '@/components/ops/leaderboard/LeaderboardTable';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { LeaderboardResponse } from '@/lib/types/leaderboard';

/** Shared by `TeamTabs`, so the tab visibility check costs no extra request. */
export const LEADERBOARD_QUERY_KEY = ['leaderboard'] as const;

export function useLeaderboard() {
  return useQuery({
    queryKey: LEADERBOARD_QUERY_KEY,
    queryFn: () => apiClient.get<LeaderboardResponse>('/leaderboard'),
  });
}

export function LeaderboardPanel() {
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const { data, isLoading, isError, refetch } = useLeaderboard();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Could not load the leaderboard</AlertTitle>
        <AlertDescription>
          Rankings did not come back. Try again in a moment.
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (data?.enabled === false) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Trophy className="size-10 text-ink-faint" />
          <h2 className="text-base font-semibold">Leaderboard paused</h2>
          <p className="max-w-md text-sm text-ink-muted">
            Rankings are currently hidden. Keep completing tasks to earn XP —
            your progress is still being tracked.
          </p>
        </CardContent>
      </Card>
    );
  }

  const users = data?.users ?? [];

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Trophy className="size-10 text-ink-faint" />
        <h2 className="text-base font-semibold">No rankings yet</h2>
        <p className="max-w-md text-sm text-ink-muted">
          Complete and validate tasks to earn XP and appear on the leaderboard.
        </p>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/boards/quests" />}
        >
          Go to the quest board
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {users.length >= 2 && (
        <LeaderboardPodium users={users} currentUserId={currentUserId} />
      )}
      <LeaderboardTable
        users={users}
        currentUserId={currentUserId}
        startRank={1}
      />
    </div>
  );
}
