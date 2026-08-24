'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, CheckCheck, Loader2, TriangleAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AttendanceRow,
  type AttendanceStatus,
} from '@/components/ops/operations/events/AttendanceRow';
import { HoldsPanel } from '@/components/ops/operations/events/HoldsPanel';
import { apiClient, apiErrorMessage } from '@/lib/api-client';
import { formatDateTime, msUntil } from '@/lib/format/date';
import { reportError } from '@/lib/report-error';
import type { BookingStatus, Event, EventBooking } from '@/lib/types/events';
import { cn } from '@/lib/utils';

/**
 * Bookings and day-of attendance for one experience (OPS-04).
 *
 * Three backend facts shape this screen and none of them is guessed:
 *
 * 1. **Capacity is hold-aware.** `EventsService.OCCUPYING_BOOKINGS` counts
 *    `confirmed` + `attended` + `held` rows whose `hold_expires_at` is still in
 *    the future. `cancelled` and `no_show` never occupy. The summary here
 *    computes the same thing client-side off the booking list so the number
 *    ticks down live as a hold runs out, instead of waiting for a refetch.
 * 2. **Only a `confirmed` booking can be marked.** `markAttendance` throws a
 *    400 for anything else, and `attended`/`no_show` are terminal — there is no
 *    route back. Every confirm here therefore says so out loud, and the bulk
 *    action tells the host to mark no-shows *first*.
 * 3. **`attended` opens the review gate.** It flips the linked `OrderItem` to
 *    `attended`, which is what lets `ReviewsService` accept a review, and it
 *    credits loyalty on that order. `no_show` cancels the item instead, so
 *    neither happens. The confirm copy names both consequences.
 */
export interface AttendanceSheetProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Confirmed first — the ones still to check in — then the settled outcomes. */
const STATUS_RANK: Record<BookingStatus, number> = {
  confirmed: 0,
  attended: 1,
  no_show: 2,
  held: 3,
  cancelled: 4,
};

const POLL_MS = 15_000;

// ── One interval for the whole sheet ────────────────────────────────────────
// The countdown, the capacity bar and the "has the event started" gate all read
// the same clock, so they can never disagree by a second. Mirrors the shared
// tick in `KdsElapsedTimer`.
const tickListeners = new Set<() => void>();
let tickHandle: ReturnType<typeof setInterval> | null = null;

function subscribeTick(listener: () => void) {
  tickListeners.add(listener);
  if (!tickHandle) {
    tickHandle = setInterval(() => {
      tickListeners.forEach((fn) => fn());
    }, 1000);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  };
}

/**
 * The wall clock is a mutable value outside React, so `useSyncExternalStore` is
 * how it is read — not `Date.now()` in the render body, which is impure and
 * would re-read on every unrelated re-render.
 *
 * The snapshot is quantised to the second, which is what makes it a legal
 * snapshot: two reads inside one render pass return the identical number, and
 * the memo below can therefore actually memoise.
 */
const getTickSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
/** Nothing clock-dependent is server-rendered — the sheet starts closed. */
const getServerTickSnapshot = () => 0;

/** The current instant, refreshed once a second while `active`. */
function useSecondTick(active: boolean): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      active ? subscribeTick(onStoreChange) : () => undefined,
    [active],
  );
  return useSyncExternalStore(subscribe, getTickSnapshot, getServerTickSnapshot);
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

type Confirmation =
  | { kind: 'single'; booking: EventBooking; status: AttendanceStatus }
  | { kind: 'bulk'; bookings: EventBooking[] };

interface ConfirmCopy {
  title: string;
  body: string;
  action: string;
  destructive: boolean;
}

function confirmCopy(confirmation: Confirmation): ConfirmCopy {
  if (confirmation.kind === 'bulk') {
    const count = confirmation.bookings.length;
    const guests = confirmation.bookings.reduce((sum, b) => sum + b.guests, 0);
    return {
      title: `Check in ${count} remaining ${plural(count, 'booking')}?`,
      body:
        `${guests} ${plural(guests, 'guest')} across ${count} ${plural(count, 'booking')} ` +
        'are marked attended. Each one flips its order item to attended, opens the ' +
        'review gate so the customer can review this experience, and credits loyalty ' +
        'on that order. Mark your no-shows first — an attended booking cannot be ' +
        'changed back.',
      action: 'Mark all attended',
      destructive: false,
    };
  }

  const name = confirmation.booking.customer_name || 'this guest';
  const guests = confirmation.booking.guests;
  if (confirmation.status === 'attended') {
    return {
      title: `Check in ${name}?`,
      body:
        `${guests} ${plural(guests, 'guest')}. This flips the linked order item to ` +
        'attended, opens the review gate so the customer can review this experience, ' +
        'and credits loyalty on the order. It cannot be undone.',
      action: 'Mark attended',
      destructive: false,
    };
  }
  return {
    title: `Mark ${name} a no-show?`,
    body:
      `${guests} ${plural(guests, 'guest')}. The linked order item is cancelled, no ` +
      'review invitation goes out and no loyalty is credited. It cannot be undone.',
    action: 'Mark no-show',
    destructive: true,
  };
}

export function AttendanceSheet({ event, open, onOpenChange }: AttendanceSheetProps) {
  const queryClient = useQueryClient();
  const eventId = event?.id ?? null;
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const now = useSecondTick(open);

  const {
    data: bookings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['event-bookings', eventId],
    queryFn: () => apiClient.get<EventBooking[]>(`/events/${eventId}/bookings`),
    enabled: open && !!eventId,
    // Holds are written and swept by other actors, so the list goes stale on its
    // own even when this screen does nothing.
    refetchInterval: open ? POLL_MS : false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['event-bookings', eventId] });
    // `attended` does not move the occupancy needle (both states occupy), but the
    // list page's counts come from the same aggregate — keep them honest.
    void queryClient.invalidateQueries({ queryKey: ['ops-events'] });
  };

  const markOne = useMutation({
    mutationFn: (vars: { booking_id: string; status: AttendanceStatus }) =>
      apiClient.post<EventBooking>(`/events/${eventId}/attendance`, vars),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === 'attended' ? 'Checked in.' : 'Marked as a no-show.',
      );
    },
    onError: (error) => {
      reportError(error, { where: 'AttendanceSheet.markOne', eventId });
      // The server's 400 names the real reason ("…this one is held"), which is
      // strictly better than anything guessed here.
      toast.error(apiErrorMessage(error, 'Could not mark attendance. Please try again.'));
    },
    onSettled: () => {
      setConfirmation(null);
      invalidate();
    },
  });

  const markAll = useMutation({
    // No bulk route exists, and `markAttendance` runs a Serializable transaction
    // per booking — firing them in parallel would race for the same event rows.
    // Sequential is both correct and fast enough for a room-sized list.
    mutationFn: async (targets: EventBooking[]) => {
      setBulkProgress({ done: 0, total: targets.length });
      let marked = 0;
      const failures: string[] = [];
      for (const booking of targets) {
        try {
          await apiClient.post<EventBooking>(`/events/${eventId}/attendance`, {
            booking_id: booking.id,
            status: 'attended',
          });
          marked += 1;
        } catch (error) {
          reportError(error, { where: 'AttendanceSheet.markAll', eventId });
          failures.push(
            apiErrorMessage(
              error,
              `${booking.customer_name || 'A guest'} could not be marked.`,
            ),
          );
        }
        setBulkProgress({ done: marked + failures.length, total: targets.length });
      }
      return { marked, failures };
    },
    onSuccess: ({ marked, failures }) => {
      if (failures.length === 0) {
        toast.success(`Checked in ${marked} ${plural(marked, 'booking')}.`);
      } else {
        toast.error(
          `Checked in ${marked} of ${marked + failures.length}. ${failures[0]}`,
        );
      }
    },
    onError: (error) => {
      reportError(error, { where: 'AttendanceSheet.markAll', eventId });
      toast.error(apiErrorMessage(error, 'Could not check everyone in. Please try again.'));
    },
    onSettled: () => {
      setBulkProgress(null);
      setConfirmation(null);
      invalidate();
    },
  });

  const isBusy = markOne.isPending || markAll.isPending;

  const view = useMemo(() => {
    const all = bookings ?? [];
    const holds: EventBooking[] = [];
    const roster: EventBooking[] = [];
    let expiredHolds = 0;
    let heldGuests = 0;
    let confirmedGuests = 0;
    let attendedGuests = 0;
    let noShowGuests = 0;
    let cancelledGuests = 0;

    for (const booking of all) {
      if (booking.status === 'held') {
        // A hold past its expiry has already given the seat back; the sweep
        // deletes the row shortly. Never render it as a live hold.
        if (msUntil(booking.hold_expires_at, now) > 0) {
          holds.push(booking);
          heldGuests += booking.guests;
        } else {
          expiredHolds += 1;
        }
        continue;
      }
      roster.push(booking);
      if (booking.status === 'confirmed') confirmedGuests += booking.guests;
      else if (booking.status === 'attended') attendedGuests += booking.guests;
      else if (booking.status === 'no_show') noShowGuests += booking.guests;
      else cancelledGuests += booking.guests;
    }

    holds.sort(
      (a, b) => msUntil(a.hold_expires_at, now) - msUntil(b.hold_expires_at, now),
    );
    roster.sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        a.customer_name.localeCompare(b.customer_name),
    );

    return {
      total: all.length,
      holds,
      roster,
      expiredHolds,
      heldGuests,
      confirmedGuests,
      attendedGuests,
      noShowGuests,
      cancelledGuests,
      pending: roster.filter((b) => b.status === 'confirmed'),
    };
  }, [bookings, now]);

  const capacity = event?.capacity ?? 0;
  const occupied = view.confirmedGuests + view.attendedGuests + view.heldGuests;
  const remaining = capacity - occupied;
  const scale = Math.max(capacity, occupied, 1);
  const settledPct = ((view.confirmedGuests + view.attendedGuests) / scale) * 100;
  const heldPct = (view.heldGuests / scale) * 100;

  const startsAt = event ? new Date(event.date).getTime() : 0;
  const eventStarted = Number.isFinite(startsAt) && startsAt <= now;

  const copy = confirmation ? confirmCopy(confirmation) : null;

  const handleConfirm = () => {
    if (!confirmation) return;
    if (confirmation.kind === 'bulk') {
      markAll.mutate(confirmation.bookings);
      return;
    }
    markOne.mutate({
      booking_id: confirmation.booking.id,
      status: confirmation.status,
    });
  };

  const legend: Array<{ label: string; value: number; dot: string }> = [
    { label: 'confirmed', value: view.confirmedGuests, dot: 'bg-primary' },
    { label: 'attended', value: view.attendedGuests, dot: 'bg-good' },
    { label: 'held', value: view.heldGuests, dot: 'bg-warning' },
    { label: 'no-show', value: view.noShowGuests, dot: 'bg-serious' },
    { label: 'cancelled', value: view.cancelledGuests, dot: 'bg-ink-muted' },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle>{event?.title ?? 'Bookings'}</SheetTitle>
            <SheetDescription>
              {event ? formatDateTime(event.date) : 'Bookings and attendance'}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-6">
            {isLoading && (
              <div className="space-y-3" aria-busy="true">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
            )}

            {isError && (
              <div className="flex flex-col items-center gap-3 rounded-lg bg-card py-10 text-center ring-1 ring-foreground/10">
                <TriangleAlert className="size-7 text-serious" aria-hidden="true" />
                <p className="text-sm text-ink-muted">
                  Can&apos;t load bookings for this experience right now.
                </p>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  Try again
                </Button>
              </div>
            )}

            {!isLoading && !isError && (
              <>
                {/* Capacity — the same rule the backend counts by */}
                <section
                  aria-label="Capacity"
                  className="rounded-lg bg-card p-3 ring-1 ring-foreground/10"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-2xl font-semibold text-ink tabular-nums">
                      {occupied}
                      <span className="text-base font-normal text-ink-muted">
                        {' / '}
                        {capacity}
                      </span>
                      <span className="ml-1.5 text-xs font-normal tracking-wider text-ink-muted uppercase">
                        seats taken
                      </span>
                    </p>
                    <p
                      className={cn(
                        'text-sm font-medium tabular-nums',
                        remaining > 0 ? 'text-ink-muted' : 'text-serious',
                      )}
                    >
                      {remaining > 0
                        ? `${remaining} left`
                        : remaining === 0
                          ? 'Full'
                          : `${-remaining} over capacity`}
                    </p>
                  </div>

                  <div
                    className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${occupied} of ${capacity} seats taken, including ${view.heldGuests} held`}
                  >
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(100, settledPct)}%` }}
                    />
                    <div
                      className="h-full bg-warning/60"
                      style={{ width: `${Math.min(100, heldPct)}%` }}
                    />
                  </div>

                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {legend
                      .filter((item) => item.value > 0)
                      .map((item) => (
                        <li
                          key={item.label}
                          className="flex items-center gap-1.5 text-xs text-ink-muted"
                        >
                          <span
                            className={cn('size-1.5 rounded-full', item.dot)}
                            aria-hidden="true"
                          />
                          <span className="tabular-nums">{item.value}</span> {item.label}
                        </li>
                      ))}
                  </ul>

                  <p className="mt-2 text-xs text-ink-muted">
                    Held seats count against capacity only until their timer runs out.
                    No-shows and cancellations never do.
                  </p>
                </section>

                <HoldsPanel
                  holds={view.holds}
                  heldGuests={view.heldGuests}
                  expiredCount={view.expiredHolds}
                  now={now}
                />

                {/* Attendance */}
                <section aria-labelledby="attendance-heading" className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3
                      id="attendance-heading"
                      className="text-sm font-medium text-ink"
                    >
                      Bookings
                    </h3>
                    {eventStarted && view.pending.length > 0 && (
                      <Button
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          setConfirmation({ kind: 'bulk', bookings: view.pending })
                        }
                      >
                        {markAll.isPending ? (
                          <Loader2
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : (
                          <CheckCheck aria-hidden="true" />
                        )}
                        Mark {view.pending.length} attended
                      </Button>
                    )}
                  </div>

                  {!eventStarted && view.roster.length > 0 && (
                    <p className="flex items-start gap-2 rounded-lg bg-surface-raised px-3 py-2 text-xs text-ink-muted">
                      <CalendarClock
                        className="mt-px size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        This experience hasn&apos;t happened yet. Attendance opens on{' '}
                        {event ? formatDateTime(event.date) : 'the day'}.
                      </span>
                    </p>
                  )}

                  {view.roster.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg bg-card py-10 text-center ring-1 ring-foreground/10">
                      <Users className="size-7 text-ink-muted/40" aria-hidden="true" />
                      <p className="text-sm text-ink">
                        {view.total === 0
                          ? 'No bookings yet.'
                          : 'Nothing to check in yet.'}
                      </p>
                      <p className="max-w-sm text-xs text-ink-muted">
                        {view.total === 0
                          ? 'Bookings land here as customers check out. A checkout in progress shows up above as a held seat.'
                          : `Every booking on this experience is still a live hold — ${view.holds.length} ${plural(
                              view.holds.length,
                              'checkout',
                            )} in progress. A hold becomes a booking once the payment lands.`}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Guest</TableHead>
                            <TableHead>Party</TableHead>
                            <TableHead className="hidden sm:table-cell">
                              Payment
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Attendance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {view.roster.map((booking) => (
                            <AttendanceRow
                              key={booking.id}
                              booking={booking}
                              canMark={eventStarted}
                              isBusy={isBusy}
                              isPending={
                                markOne.isPending &&
                                markOne.variables?.booking_id === booking.id
                              }
                              now={now}
                              onMark={(target, status) =>
                                setConfirmation({ kind: 'single', booking: target, status })
                              }
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sibling, not nested — the same shape TaskSheet uses for its confirm. */}
      <Dialog
        open={!!confirmation}
        onOpenChange={(next) => {
          if (!next && !isBusy) setConfirmation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy?.title ?? 'Mark attendance'}</DialogTitle>
            <DialogDescription>{copy?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isBusy}
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </Button>
            <Button
              variant={copy?.destructive ? 'destructive' : 'default'}
              disabled={isBusy}
              onClick={handleConfirm}
            >
              {isBusy && (
                <Loader2
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              {bulkProgress
                ? `Marking ${bulkProgress.done} of ${bulkProgress.total}…`
                : (copy?.action ?? 'Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
