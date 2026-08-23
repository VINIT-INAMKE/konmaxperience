'use client';

/**
 * `IA-04` — the quest list. `/quests?mine=1` is the spine's "My Quests" href, so
 * `mine` lives in the URL and the Mine/All toggle is a link-equivalent: the view
 * is shareable and the back button restores the previous scope.
 *
 * An absent `mine` param means **on**. The page's job is "the quests I am
 * carrying"; seeing everyone's is the deliberate second step.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Plus, Target } from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuestCard } from '@/components/ops/quests/QuestCard';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Permission } from '@/lib/types/permissions';
import type { Quest } from '@/lib/types/quests';

/** One page of quests. `GET /quests` is page/limit, not cursor-based. */
const QUEST_PAGE_SIZE = 100;

function QuestsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const permissions = useAuthStore((s) => s.permissions);
  const canCreate = permissions.includes(Permission.CREATE_QUEST);

  const rawMine = params.get('mine');
  const mine = rawMine === null ? true : rawMine === '1' || rawMine === 'true';

  const setMine = (next: boolean) => {
    const query = new URLSearchParams(params.toString());
    query.set('mine', next ? '1' : '0');
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['quests', 'list', mine],
    queryFn: () =>
      apiClient.get<Quest[]>(
        `/quests?limit=${QUEST_PAGE_SIZE}${mine ? '&mine=1' : ''}`,
      ),
  });

  const quests = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {mine ? 'My Quests' : 'All Quests'}
        </h1>
        <div className="flex items-center gap-2">
          <Tabs
            value={mine ? 'mine' : 'all'}
            onValueChange={(value: unknown) => setMine(value === 'mine')}
          >
            <TabsList>
              <TabsTrigger value="mine">Mine</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          {canCreate && (
            /*
              `QuestSheet` (Task 16, Wave 3) opens here. Until it lands, the
              button goes to the mission list, since a quest must be created
              inside a mission — a wave boundary, not a dead control.
            */
            <Button nativeButton={false} render={<Link href="/missions" />}>
              <Plus className="size-4" />
              New quest
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load quests</AlertTitle>
          <AlertDescription>
            The quest list did not come back. Try again in a moment.
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : quests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-10 text-center">
          <Target className="size-6 text-ink-muted" />
          <p className="text-sm text-ink-muted">
            {mine
              ? 'No quests assigned to you this week.'
              : 'No quests have been created yet.'}
          </p>
          {mine && (
            <Button
              variant="outline"
              className="mt-1"
              onClick={() => setMine(false)}
            >
              Browse all quests
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} />
          ))}
        </div>
      )}

      {quests.length >= QUEST_PAGE_SIZE && (
        <p className="text-center text-xs text-ink-muted">
          Showing the first {QUEST_PAGE_SIZE} quests. Narrow the scope to see
          more.
        </p>
      )}
    </div>
  );
}

export default function QuestsPage() {
  // `useSearchParams()` needs a Suspense boundary above it to prerender.
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <QuestsContent />
    </Suspense>
  );
}
