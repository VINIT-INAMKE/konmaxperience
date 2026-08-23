'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { FileClock, Rocket } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { MeterRing } from '@/components/ops/readiness/MeterRing';
import { MeterModeBadge } from '@/components/ops/readiness/MeterModeBadge';
import {
  METER_TONE_TEXT,
  METER_TONE_VAR,
  METER_TRACK_VAR,
  meterTone,
} from '@/components/ops/readiness/meter-tone';
import { TodaysFocusSection } from './TodaysFocusSection';
import { NudgesPanel } from './NudgesPanel';
import { selectRoleMeters } from '@/lib/nav/meters';
import { apiClient } from '@/lib/api-client';
import { optionalGet, unwrapList, type MaybePaginated } from '@/lib/api/optional';
import { P31 } from '@/lib/api/phase31';
import { useAuthStore } from '@/lib/stores/auth-store';
import { EVIDENCE_TYPE_LABELS } from '@/lib/types/evidence';
import type { Evidence } from '@/lib/types/evidence';
import type { Quest } from '@/lib/types/quests';
import type { ReadinessMeter } from '@/lib/types/readiness';
import type { Task } from '@/lib/types/tasks';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
      {children}
    </h2>
  );
}

/**
 * SPEC §6.5 — what everybody who is not an admin lands on: the five blocks that
 * answer "what must I move today", in order, with Today's Focus at full width.
 *
 * Nothing here is a spinner that never resolves: each block renders a defined
 * empty state, and the two reads that can be permission-gated
 * (`/approvals/count`, the evidence queue) go through `optionalGet`.
 */
export function MyDay() {
  const user = useAuthStore((s) => s.user);

  /**
   * `mine=1` and `limit=50` are the server-filtered contract; until that slice
   * is deployed the extra params are ignored and a bare array comes back, so the
   * response is unwrapped either way and re-filtered by owner client-side. The
   * client-side filter can only narrow, so it is correct against both shapes.
   */
  const tasksQuery = useQuery({
    queryKey: ['tasks', 'mine'],
    queryFn: () =>
      apiClient.get<MaybePaginated<Task>>('/tasks?mine=1&limit=50'),
  });
  const myTasks = unwrapList(tasksQuery.data).filter(
    (task) => task.owner_user_id === user?.id,
  );

  const questsQuery = useQuery({
    queryKey: ['quests', 'mine'],
    queryFn: () => apiClient.get<Quest[]>('/quests?mine=1'),
  });
  const activeQuest =
    questsQuery.data?.find(
      (quest) => quest.owner_user_id === user?.id && quest.status === 'active',
    ) ?? null;

  /**
   * The reviewer-facing `GET /evidence` needs `APPROVE_EVIDENCE`, which most
   * contributors do not hold — so the uploader-facing feed is asked first and
   * the reviewer queue is only the fallback.
   */
  const evidenceQuery = useQuery({
    queryKey: ['evidence', 'mine-pending'],
    queryFn: async () => {
      const feed = await optionalGet<Evidence[]>(
        '/evidence/feed?status=pending&limit=100',
      );
      if (feed) return feed;
      return (await optionalGet<Evidence[]>('/evidence?status=pending')) ?? [];
    },
  });
  const myEvidence = (evidenceQuery.data ?? []).filter(
    (item) => item.uploaded_by === user?.id,
  );

  const metersQuery = useQuery({
    queryKey: ['readiness-meters'],
    queryFn: () => apiClient.get<ReadinessMeter[]>('/readiness-meters'),
  });
  const myMeters = selectRoleMeters(metersQuery.data, user?.roleCode);

  const approvalsQuery = useQuery({
    queryKey: ['approvals', 'count'],
    queryFn: () => optionalGet<{ count: number }>(P31.myPendingApprovalCount),
  });

  const questTasks = activeQuest
    ? myTasks.filter((task) => task.quest_id === activeQuest.id)
    : [];
  const questTasksDone = questTasks.filter(
    (task) => task.status === 'done',
  ).length;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-ink-strong">My Day</h1>

      {/* 1 — Today's Focus, full width */}
      <section className="space-y-3">
        <SectionHeading>Today&apos;s focus</SectionHeading>
        {tasksQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load your tasks</AlertTitle>
            <AlertDescription>The task list did not respond.</AlertDescription>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-fit"
              onClick={() => void tasksQuery.refetch()}
            >
              Retry
            </Button>
          </Alert>
        ) : (
          <TodaysFocusSection
            allTasks={myTasks}
            isLoading={tasksQuery.isLoading}
          />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 2 — My quest progress */}
        <section className="space-y-3">
          <SectionHeading>My quest</SectionHeading>
          <Card>
            <CardContent>
              {questsQuery.isLoading ? (
                <div className="space-y-3 py-1">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ) : !activeQuest ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Rocket
                    className="size-8 text-ink-faint"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-ink-muted">
                    No quest is active for you this week.
                  </p>
                  <Button
                    nativeButton={false}
                    render={<Link href="/missions" />}
                    variant="outline"
                    size="sm"
                  >
                    Browse missions
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href={`/quests/${activeQuest.id}`}
                    className="block rounded-sm text-base font-medium text-ink transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                  >
                    {activeQuest.title}
                  </Link>
                  <Progress value={activeQuest.progress_percent}>
                    <ProgressLabel className="text-xs text-ink-muted">
                      Quest progress
                    </ProgressLabel>
                    <ProgressValue className="text-xs tabular-nums" />
                  </Progress>
                  <p className="text-xs text-ink-muted">
                    {questTasksDone} of {questTasks.length} of your tasks in this
                    quest are done
                    {activeQuest.baseline_task_count > 0 &&
                      ` · ${activeQuest.baseline_task_count} baseline tasks`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 3 — My evidence awaiting review */}
        <section className="space-y-3">
          <SectionHeading>Evidence awaiting review</SectionHeading>
          <Card>
            <CardContent>
              {evidenceQuery.isLoading ? (
                <div className="space-y-3 py-1">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-5 w-full" />
                  ))}
                </div>
              ) : myEvidence.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <FileClock
                    className="size-8 text-ink-faint"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-ink-muted">
                    Nothing of yours is waiting on a reviewer.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {myEvidence.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/tasks/${item.task_id}`}
                        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                      >
                        <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-muted">
                          {EVIDENCE_TYPE_LABELS[item.type]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {item.notes?.trim() || 'Uploaded evidence'}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">
                          {formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* 4 — My meter contributions */}
      <section className="space-y-3">
        <SectionHeading>My readiness contributions</SectionHeading>
        <Card>
          <CardContent>
            {metersQuery.isLoading ? (
              <div className="flex gap-8">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-14 shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : myMeters.length === 0 ? (
              <p className="py-2 text-sm text-ink-muted">
                No readiness meters are mapped to your role yet.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {myMeters.map((meter) => {
                  const tone = meterTone(meter.current_value);
                  return (
                    <li key={meter.id} className="flex items-center gap-3">
                      <div className="relative size-14 shrink-0">
                        <MeterRing
                          value={meter.current_value}
                          toneVar={METER_TONE_VAR[tone]}
                          trackVar={METER_TRACK_VAR}
                          strokeWidth={10}
                          label={`${meter.name}: ${Math.round(meter.current_value)} percent`}
                        />
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums ${METER_TONE_TEXT[tone]}`}
                        >
                          {Math.round(meter.current_value)}
                        </span>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm text-ink">
                          {meter.name}
                        </p>
                        {/* C4 — the chip is dropped, not defaulted, when the
                            payload predates the `mode` column. */}
                        {meter.mode && <MeterModeBadge mode={meter.mode} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 5 — Nudges, derived from everything already on this page */}
      <NudgesPanel
        tasks={myTasks}
        quest={activeQuest}
        pendingEvidence={myEvidence}
        approvalCount={approvalsQuery.data?.count ?? 0}
      />
    </div>
  );
}
