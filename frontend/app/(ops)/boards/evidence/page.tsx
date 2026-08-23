'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import type { EvidenceFeedEntry } from '@/lib/types/analytics';
import { EvidenceFeedCard } from '@/components/ops/boards/EvidenceFeedCard';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function EvidenceFeedPage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [entries, setEntries] = useState<EvidenceFeedEntry[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  // Reset entries and cursor when status filter changes
  useEffect(() => {
    setEntries([]);
    setCursor(undefined);
    setHasMore(true);
  }, [status]);

  const statusParam = status !== 'all' ? `&status=${status}` : '';
  const cursorParam = cursor ? `&cursor=${cursor}` : '';

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['evidence-feed', status, cursor],
    queryFn: () =>
      apiClient.get<EvidenceFeedEntry[]>(
        `/evidence/feed?limit=20${statusParam}${cursorParam}`
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

  const isEmpty = !isLoading && entries.length === 0;

  const handleLoadMore = () => {
    if (entries.length > 0) {
      setCursor(entries[entries.length - 1].created_at);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + filter bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Evidence Feed</h1>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={status === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 rounded-lg border p-4">
              <Skeleton className="size-16" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <FileSearch className="size-12 text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold">No evidence submitted</h2>
            <p className="text-sm text-muted-foreground">
              Evidence submitted to tasks will appear here.
            </p>
          </div>
        </div>
      )}

      {/* Evidence feed */}
      {entries.length > 0 && (
        <div className="space-y-4">
          {entries.map((evidence) => (
            <EvidenceFeedCard key={evidence.id} evidence={evidence} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && entries.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={handleLoadMore}
          >
            {isFetching ? 'Loading...' : 'Load more evidence'}
          </Button>
        </div>
      )}
    </div>
  );
}
