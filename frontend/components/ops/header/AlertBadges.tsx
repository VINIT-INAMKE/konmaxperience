'use client';

import Link from 'next/link';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { STATUS_BADGE } from '@/lib/status-styles';

/**
 * SPEC §6.1 slot 5 — the two badges that mean "you are the blocker".
 *
 * Both are hidden at zero: a permanent "0 approvals" chip trains people to stop
 * reading the header. `warning` for approvals (someone is waiting on you),
 * `critical` for blockers (you are stopped) — the weight difference is
 * deliberate, per the SPEC §7 status ramp.
 *
 * The counts arrive on `HeaderContext`; realtime keeps them honest
 * (`approvals.count.changed`) and the 60 s poll is the floor.
 */
export function AlertBadges({
  approvalsWaiting,
  myBlockers,
}: {
  approvalsWaiting: number;
  myBlockers: number;
}) {
  if (approvalsWaiting <= 0 && myBlockers <= 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {approvalsWaiting > 0 && (
        <Link
          href="/approvals"
          aria-label={`${approvalsWaiting} approvals waiting on you`}
          className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-semibold tabular-nums transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 ${STATUS_BADGE.warning}`}
        >
          <ClipboardCheck className="size-3.5" aria-hidden="true" />
          <span aria-hidden="true">{approvalsWaiting}</span>
          <span className="hidden sm:inline" aria-hidden="true">
            to approve
          </span>
        </Link>
      )}

      {myBlockers > 0 && (
        <Link
          href="/tasks?status=blocked&mine=1"
          aria-label={`${myBlockers} of your tasks are blocked`}
          className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-semibold tabular-nums transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 ${STATUS_BADGE.critical}`}
        >
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          <span aria-hidden="true">{myBlockers}</span>
          <span className="hidden sm:inline" aria-hidden="true">
            blocked
          </span>
        </Link>
      )}
    </div>
  );
}
