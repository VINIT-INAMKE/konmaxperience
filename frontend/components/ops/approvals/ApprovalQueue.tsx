'use client';

import { useState, useMemo } from 'react';
import { CheckCircle, Search, AlertCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BlurFade } from '@/components/ui/blur-fade';
import { AnimatedList } from '@/components/ui/animated-list';
import { Input } from '@/components/ui/input';
import { ApprovalItem } from './ApprovalItem';
import { apiClient } from '@/lib/api-client';
import type { Evidence } from '@/lib/types/evidence';

interface ApprovalEvidence extends Evidence {
  task?: {
    id: string;
    title: string;
    quest?: { id: string; title: string } | null;
    mission?: { id: string; title: string } | null;
  };
}

export function ApprovalQueue() {
  const queryClient = useQueryClient();
  const [taskFilter, setTaskFilter] = useState('');

  const {
    data: pendingEvidence,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () =>
      apiClient.get<ApprovalEvidence[]>('/evidence?status=pending'),
  });

  const filteredEvidence = useMemo(() => {
    if (!pendingEvidence) return [];
    let result = pendingEvidence;

    if (taskFilter.trim()) {
      const search = taskFilter.toLowerCase();
      result = result.filter((e) =>
        e.task?.title?.toLowerCase().includes(search),
      );
    }

    // Sort: oldest first (most urgent at top)
    return result.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [pendingEvidence, taskFilter]);

  const handleAction = () => {
    void queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[120px] rounded-lg bg-muted/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Can't load approvals right now. Try refreshing.
        </p>
      </div>
    );
  }

  if (!pendingEvidence || pendingEvidence.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
        <CheckCircle className="size-12 text-green-400" />
        <h2 className="text-xl font-semibold">No pending approvals</h2>
        <p className="text-sm text-muted-foreground">
          You're all caught up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-4 justify-end">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Filter by task name..."
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Evidence list */}
      <BlurFade>
        {filteredEvidence.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No approvals match your filter.
            </p>
          </div>
        ) : (
          <AnimatedList delay={50} className="gap-3">
            {filteredEvidence.map((item) => (
              <ApprovalItem
                key={item.id}
                evidence={item}
                onAction={handleAction}
              />
            ))}
          </AnimatedList>
        )}
      </BlurFade>
    </div>
  );
}
