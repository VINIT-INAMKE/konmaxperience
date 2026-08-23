'use client';

/**
 * `IA-04` — the cross-quest task list.
 *
 * Filtering is server-side: the URL search params become the `GET /tasks` query
 * string (see `lib/types/tasks-page.ts` for the mapping) and the page renders
 * whatever comes back. The one exception is `priority`, which the API cannot
 * filter on; it narrows the rows already fetched and the filter bar says so.
 *
 * Pagination is `cursor`/`limit` with an explicit "Load more" rather than an
 * infinite scroll, so the page never fetches work nobody asked to see.
 */

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { AlertCircle, ClipboardList, Plus } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskFilterBar } from '@/components/ops/tasks/TaskFilterBar';
import { TaskListView } from '@/components/ops/tasks/TaskListView';
import {
  TaskViewToggle,
  useTaskViewPreference,
} from '@/components/ops/tasks/TaskViewToggle';
// `TaskSheet` (Task 16, Wave 3) replaces this — a wave boundary, not a TODO.
import { AdHocTaskSheet } from '@/components/ops/tasks/AdHocTaskSheet';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Permission } from '@/lib/types/permissions';
import { RoleCode } from '@/lib/types/roles';
import type { TaskStatus } from '@/lib/types/tasks';
import {
  buildTaskQuery,
  isMineOn,
  parsePriorityParam,
  TASK_PAGE_SIZE,
  type TaskPage,
} from '@/lib/types/tasks-page';

const TaskKanban = dynamic(
  () => import('@/components/ops/tasks/TaskKanban').then((m) => m.TaskKanban),
  { loading: () => <Skeleton className="h-96 rounded-xl" /> },
);

const VIEW_STORAGE_KEY = 'konma.tasks.view';

function TasksContent() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;
  const canCreate =
    permissions.includes(Permission.CREATE_TASK) ||
    permissions.includes(Permission.CREATE_ADHOC_TASK);

  const [view, setView] = useTaskViewPreference(VIEW_STORAGE_KEY, 'list');
  const [createOpen, setCreateOpen] = useState(false);

  const urlQuery = params.toString();
  const mine = isMineOn(params, user?.roleCode);
  const priority = parsePriorityParam(params.get('priority'));

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    // `user?.roleCode` is part of the key because it decides the `mine` default.
    queryKey: ['tasks', 'page', urlQuery, user?.roleCode ?? ''],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<TaskPage>(
        `/tasks?${buildTaskQuery(params, user?.roleCode, {
          cursor: pageParam,
          limit: TASK_PAGE_SIZE,
        })}`,
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const loaded = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  // Client-side narrowing — the API has no priority filter (see TaskFilterBar).
  const tasks = useMemo(
    () => (priority ? loaded.filter((task) => task.priority === priority) : loaded),
    [loaded, priority],
  );

  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      apiClient.patch(`/tasks/${taskId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    statusMutation.mutate({ taskId, status });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {mine ? 'My Tasks' : 'All Tasks'}
        </h1>
        <div className="flex items-center gap-2">
          <TaskViewToggle view={view} onViewChange={setView} />
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New task
            </Button>
          )}
        </div>
      </div>

      <TaskFilterBar
        resultCount={tasks.length}
        hasMore={!!hasNextPage}
        isLoading={isLoading}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load tasks</AlertTitle>
          <AlertDescription>
            The task list did not come back. Try again in a moment.
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-10 text-center">
          <ClipboardList className="size-6 text-ink-muted" />
          <p className="text-sm text-ink-muted">
            {loaded.length === 0
              ? 'Nothing matches these filters.'
              : 'No loaded task has that priority. Load more, or clear the priority filter.'}
          </p>
          {canCreate && (
            <Button className="mt-1" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create a task
            </Button>
          )}
        </div>
      ) : view === 'kanban' ? (
        <TaskKanban
          tasks={tasks}
          onStatusChange={handleStatusChange}
          currentUserId={user?.id ?? ''}
          isAdmin={isAdmin}
          showQuestLink
        />
      ) : (
        <TaskListView
          tasks={tasks}
          onStatusChange={handleStatusChange}
          currentUserId={user?.id ?? ''}
          isAdmin={isAdmin}
          groupByStatus
        />
      )}

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <AdHocTaskSheet open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

export default function TasksPage() {
  // `useSearchParams()` needs a Suspense boundary above it to prerender.
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <TasksContent />
    </Suspense>
  );
}
