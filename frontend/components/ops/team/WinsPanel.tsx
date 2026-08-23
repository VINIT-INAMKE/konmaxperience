'use client';

/**
 * Wins and milestones, extracted from `app/(ops)/boards/wins` so the `/team`
 * hub's Wins tab and the standalone board share one implementation
 * (SPEC §6.2 item 8 / Decision 11).
 *
 * `GET /analytics/wins` pages on a timestamp cursor: the last entry's timestamp
 * becomes the next request's cursor, and a short page means the end. That is
 * exactly `useInfiniteQuery`'s contract, so the accumulated pages live in the
 * query cache rather than in component state kept in sync by an effect.
 */

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AlertCircle, Trophy } from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WinsTimeline } from '@/components/ops/boards/WinsTimeline';
import { apiClient } from '@/lib/api-client';
import type { WinsEntry } from '@/lib/types/analytics';

const WINS_PAGE_SIZE = 20;

export function WinsPanel() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['wins', 'timeline'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<WinsEntry[]>(
        `/analytics/wins?limit=${WINS_PAGE_SIZE}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    // A short page is the end of the timeline; otherwise the oldest row on this
    // page is the cursor for the next one.
    getNextPageParam: (last) =>
      last.length < WINS_PAGE_SIZE ? undefined : last[last.length - 1]?.timestamp,
  });

  const entries = data?.pages.flat() ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="ml-8 h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Could not load the wins timeline</AlertTitle>
        <AlertDescription>
          Completed quests and validated tasks did not come back.
        </AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Trophy className="size-10 text-ink-faint" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold">No milestones yet</h2>
          <p className="text-sm text-ink-muted">
            Completed quests and validated tasks will appear here.
          </p>
        </div>
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
      <WinsTimeline entries={entries} />

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more entries'}
          </Button>
        </div>
      )}
    </div>
  );
}
