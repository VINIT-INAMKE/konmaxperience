'use client';

/**
 * RUN-02 — `/operations/daily-close`.
 *
 * The screen is a reader of a **persisted artefact**, not a dashboard. Every
 * figure comes out of `DailyClose.metrics` exactly as it was frozen; the screen
 * never aggregates anything itself, because a close that re-derived its numbers
 * on each render would show a different day from the one somebody signed.
 *
 * Three consequences shape the states below:
 *
 * - **A day with no row is not an error and not a spinner.** The cron computes
 *   yesterday at 00:45; a day it missed, or one being looked at before the cron
 *   has run, simply has no row and answers `404`. That renders as an empty state
 *   with a **Recompute** button, which is the actual fix, rather than a
 *   loading state that never resolves.
 * - **Recompute is safe on an open day and a no-op on a signed one.** The server
 *   returns the frozen row untouched, so the button never needs to be hidden to
 *   protect a signature — but the toast says which of the two happened.
 * - **The date is a node-local calendar day**, formatted through the IST-pinned
 *   helpers in `lib/format/date`, never `toISOString().slice(0, 10)` — which
 *   would file the last five and a half hours of every evening under yesterday.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileClock,
  Lock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiClient,
  apiErrorMessage,
  apiErrorStatus,
} from '@/lib/api-client';
import { formatDateTime, toDateInputValue } from '@/lib/format/date';
import { STATUS_BADGE } from '@/lib/status-styles';
import {
  isKnownMetricsVersion,
  type DailyCloseView,
} from '@/lib/types/daily-close';
import { DailyCloseMetricsPanel } from '@/components/ops/daily-close/DailyCloseMetrics';
import {
  DailyCloseSignCard,
  useSignerName,
} from '@/components/ops/daily-close/DailyCloseSignCard';

const DAY_MS = 86_400_000;

/** How many recent closes the jump strip offers. */
const RECENT_LIMIT = 14;

const detailKey = (date: string) => ['daily-close', 'detail', date] as const;
const listKey = ['daily-close', 'list', RECENT_LIMIT] as const;

/**
 * Shifts a `YYYY-MM-DD` by whole days.
 *
 * The arithmetic runs at UTC midnight deliberately: the key is a calendar label,
 * not an instant, so stepping it must not be able to land on the wrong side of a
 * local midnight or a DST boundary.
 */
function shiftDayKey(day: string, days: number): string {
  const at = new Date(`${day}T00:00:00.000Z`).getTime() + days * DAY_MS;
  return new Date(at).toISOString().slice(0, 10);
}

/** Node-local today and yesterday, via the IST-pinned formatter. */
function todayKey(): string {
  return toDateInputValue(Date.now());
}

function yesterdayKey(): string {
  return toDateInputValue(Date.now() - DAY_MS);
}

function StatusChip({ close }: { close: DailyCloseView }) {
  const signerName = useSignerName(close.signed_by);

  if (close.status === 'signed') {
    return (
      <Badge variant="outline" className={STATUS_BADGE.good}>
        <Lock />
        Signed by {signerName ?? 'a signatory'} ·{' '}
        {formatDateTime(close.signed_at)}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={STATUS_BADGE.warning}>
      <FileClock />
      Open · computed {formatDateTime(close.metrics?.computed_at)}
    </Badge>
  );
}

function MetricsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DailyCloseScreen() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<string>(() => yesterdayKey());
  const today = useMemo(() => todayKey(), []);

  const {
    data: close,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: detailKey(date),
    queryFn: () => apiClient.get<DailyCloseView>(`/daily-close/${date}`),
    // A day with no close answers 404, which is a normal state here, not a
    // transient fault — retrying it three times only delays the empty state.
    retry: false,
  });

  const { data: recent } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      apiClient.get<DailyCloseView[]>(`/daily-close?limit=${RECENT_LIMIT}`),
    retry: false,
    staleTime: 60_000,
  });

  const recomputeMutation = useMutation({
    mutationFn: (day: string) =>
      apiClient.post<DailyCloseView>(`/daily-close/${day}/recompute`),
    onSuccess: (row) => {
      queryClient.setQueryData(detailKey(row.business_date), row);
      void queryClient.invalidateQueries({ queryKey: listKey });
      if (row.status === 'signed') {
        toast.info(
          `${row.business_date} is already signed — the frozen figures are unchanged.`,
        );
      } else {
        toast.success(`${row.business_date} recomputed.`);
      }
    },
    onError: (err) => {
      toast.error(
        apiErrorMessage(err, 'Could not compute this day. Try again shortly.'),
      );
    },
  });

  const status = apiErrorStatus(error);
  const notComputed = isError && status === 404;
  const forbidden = isError && status === 403;
  const badDate = isError && status === 400;
  const otherError = isError && !notComputed && !forbidden && !badDate;

  return (
    <div className="space-y-6">
      {/* ── Date picker + status ───────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="daily-close-date">Business day</Label>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous day"
                  onClick={() => setDate((d) => shiftDayKey(d, -1))}
                >
                  <ChevronLeft />
                </Button>
                <Input
                  id="daily-close-date"
                  type="date"
                  className="w-44"
                  value={date}
                  max={today}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next day"
                  disabled={date >= today}
                  onClick={() => setDate((d) => shiftDayKey(d, 1))}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              disabled={date === yesterdayKey()}
              onClick={() => setDate(yesterdayKey())}
            >
              <CalendarDays />
              Yesterday
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {close ? <StatusChip close={close} /> : null}
            {close ? (
              <Button
                variant="outline"
                size="sm"
                disabled={recomputeMutation.isPending}
                onClick={() => recomputeMutation.mutate(date)}
              >
                {recomputeMutation.isPending ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <RefreshCw />
                )}
                Recompute
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ── Jump strip: which recent days actually have a close ─────────── */}
      {recent && recent.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Recent:
          </span>
          {recent.map((row) => (
            <Button
              key={row.id}
              variant={row.business_date === date ? 'secondary' : 'ghost'}
              size="xs"
              onClick={() => setDate(row.business_date)}
            >
              {row.status === 'signed' ? <Lock /> : <FileClock />}
              {row.business_date}
            </Button>
          ))}
        </div>
      ) : null}

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {isLoading ? <MetricsSkeleton /> : null}

      {/* ── No close for this day: the normal pre-cron state ───────────── */}
      {notComputed ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <CalendarDays className="size-10 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold">
              No close has been computed for {date}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              The nightly job files yesterday shortly after midnight. If it was
              missed — or this day is still in progress — compute it now. An open
              close can be recomputed as often as you like; only a signature
              freezes it.
            </p>
            <Button
              disabled={recomputeMutation.isPending}
              onClick={() => recomputeMutation.mutate(date)}
            >
              {recomputeMutation.isPending ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" />
              ) : (
                <RefreshCw />
              )}
              Compute {date}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Refused, malformed, or genuinely broken ─────────────────────── */}
      {forbidden ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>You cannot view the daily close</AlertTitle>
          <AlertDescription>
            {apiErrorMessage(
              error,
              'This screen needs the “Manage operations” permission.',
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {badDate ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>That is not a real calendar day</AlertTitle>
          <AlertDescription>
            {apiErrorMessage(error, 'Pick a date from the calendar above.')}
          </AlertDescription>
        </Alert>
      ) : null}

      {otherError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Couldn&apos;t load the close for {date}</AlertTitle>
          <AlertDescription>
            {apiErrorMessage(error, 'Something went wrong on the way back.')}
          </AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw />
              Try again
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {/* ── The close itself ───────────────────────────────────────────── */}
      {close ? (
        <>
          {!isKnownMetricsVersion(close.metrics) ? (
            <Alert>
              <AlertCircle />
              <AlertTitle>Computed by an earlier version</AlertTitle>
              <AlertDescription>
                This close was frozen under metrics version{' '}
                {close.metrics?.version ?? 'unknown'}, so some figures below may
                be missing or mean something slightly different. Signed closes
                are never rewritten, which is why old shapes survive.
              </AlertDescription>
            </Alert>
          ) : null}

          <DailyCloseMetricsPanel metrics={close.metrics} />

          <DailyCloseSignCard
            close={close}
            onSigned={(signed) => {
              queryClient.setQueryData(detailKey(signed.business_date), signed);
              void queryClient.invalidateQueries({ queryKey: listKey });
            }}
            onConflict={() => {
              void refetch();
              void queryClient.invalidateQueries({ queryKey: listKey });
            }}
          />

          <p className="text-xs text-muted-foreground">
            Figures gathered {formatDateTime(close.metrics?.computed_at)} for the
            node-local day {close.metrics?.business_date} (
            {close.metrics?.timezone}).
          </p>
        </>
      ) : null}
    </div>
  );
}
