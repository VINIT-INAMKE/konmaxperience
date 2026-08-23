'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Trophy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { WinsEntry } from '@/lib/types/analytics';
import { WinsTimeline } from '@/components/ops/boards/WinsTimeline';

export default function WinsBoardPage() {
  const [entries, setEntries] = useState<WinsEntry[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['wins', cursor],
    queryFn: () =>
      apiClient.get<WinsEntry[]>(
        `/analytics/wins?limit=20${cursor ? `&cursor=${cursor}` : ''}`
      ),
  });

  useEffect(() => {
    if (data) {
      if (data.length < 20) {
        setHasMore(false);
      }
      setEntries((prev) => (cursor ? [...prev, ...data] : data));
    }
  }, [data, cursor]);

  const isEmpty = !isLoading && !isError && entries.length === 0;

  const handleLoadMore = () => {
    if (entries.length > 0) {
      setCursor(entries[entries.length - 1].timestamp);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold">Wins &amp; Milestones</h1>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4 animate-pulse motion-reduce:animate-none">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3 pl-8">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
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
              Couldn&apos;t load the wins timeline. Try again in a moment.
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <Trophy className="size-12 text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold">No milestones yet</h2>
            <p className="text-sm text-muted-foreground">
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
      )}

      {/* Timeline */}
      {entries.length > 0 && <WinsTimeline entries={entries} />}

      {/* Load more */}
      {hasMore && entries.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={handleLoadMore}
          >
            {isFetching ? 'Loading...' : 'Load more entries'}
          </Button>
        </div>
      )}
    </div>
  );
}
