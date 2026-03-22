'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KanbanSquare } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import type { Quest } from '@/lib/types/quests';
import type { Mission } from '@/lib/types/missions';
import type { UserProfile } from '@/lib/types/users';
import { QuestKanbanColumn } from '@/components/ops/boards/QuestKanbanColumn';

export default function QuestBoardPage() {
  const [missionFilter, setMissionFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  const { data: quests, isLoading: questsLoading } = useQuery({
    queryKey: ['quests'],
    queryFn: () => apiClient.get<Quest[]>('/quests'),
  });

  const { data: missions } = useQuery({
    queryKey: ['missions'],
    queryFn: () => apiClient.get<Mission[]>('/missions'),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<UserProfile[]>('/users'),
  });

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!quests) return [];
    return quests.filter(
      (q) =>
        (missionFilter === 'all' || q.mission_id === missionFilter) &&
        (assigneeFilter === 'all' || q.owner_user_id === assigneeFilter)
    );
  }, [quests, missionFilter, assigneeFilter]);

  // Partition into 3 groups
  const notStarted = useMemo(
    () => filtered.filter((q) => q.status === 'planned'),
    [filtered]
  );

  const inProgress = useMemo(
    () =>
      filtered
        .filter((q) => q.status === 'active' || q.status === 'blocked')
        .sort((a, b) => b.progress_percent - a.progress_percent),
    [filtered]
  );

  const completed = useMemo(
    () => filtered.filter((q) => q.status === 'completed'),
    [filtered]
  );

  const isEmpty =
    !questsLoading && filtered.length === 0;

  return (
    <BlurFade>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Quest Board</h1>
          <div className="flex gap-4">
            <Select
              value={missionFilter}
              onValueChange={(v) => setMissionFilter(v ?? 'all')}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All missions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All missions</SelectItem>
                {missions?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={assigneeFilter}
              onValueChange={(v) => setAssigneeFilter(v ?? 'all')}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading state */}
        {questsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg bg-muted/30 p-4 space-y-3 animate-pulse">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-24 w-full rounded bg-muted" />
                <div className="h-24 w-full rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <KanbanSquare className="size-12 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-xl font-bold">No quests found</h2>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters.
              </p>
            </div>
          </div>
        )}

        {/* Kanban columns */}
        {!questsLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <QuestKanbanColumn
              title="Not Started"
              quests={notStarted}
              accentClass="border-l-muted-foreground/40"
            />
            <QuestKanbanColumn
              title="In Progress"
              quests={inProgress}
              accentClass="border-l-primary"
            />
            <QuestKanbanColumn
              title="Completed"
              quests={completed}
              accentClass="border-l-emerald-500"
            />
          </div>
        )}
      </div>
    </BlurFade>
  );
}
