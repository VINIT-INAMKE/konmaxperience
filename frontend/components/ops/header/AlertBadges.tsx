'use client';

import Link from 'next/link';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { STATUS_BADGE } from '@/lib/status-styles';
import { useRealtimeChannel } from '@/lib/hooks/use-realtime-channel';
import { HEADER_CONTEXT_QUERY_KEY } from '@/lib/hooks/use-header-context';

const APPROVALS_EVENTS = ['approvals.count.changed'] as const;
const APPROVALS_INVALIDATE = [
  HEADER_CONTEXT_QUERY_KEY,
  ['approvals'],
] as const;

/**
 * SPEC §6.1 slot 5 — the two badges that mean "you are the blocker".
 *
 * Both are hidden at zero: a permanent "0 approvals" chip trains people to stop
 * reading the header. `warning` for approvals (someone is waiting on you),
 * `critical` for blockers (you are stopped) — the weight difference is
 * deliberate, per the SPEC §7 status ramp.
 *
 * The counts arrive on `HeaderContext`. `private-approvals` keeps them honest:
 * an approval decided in another browser decrements this badge without waiting
 * for the 60 s `/me/header` poll, which stays as the floor.
 *
 * The backend double-gates `private-approvals` on `APPROVE_EVIDENCE` **and** the
 * `approvals` module, so the caller passes `canWatchApprovals` and we never ask
 * for a socket the server is going to refuse. The hook runs before the
 * zero-count early return: the badge must be able to appear from nothing.
 */
export function AlertBadges({
  approvalsWaiting,
  myBlockers,
  canWatchApprovals = false,
}: {
  approvalsWaiting: number;
  myBlockers: number;
  canWatchApprovals?: boolean;
}) {
  useRealtimeChannel(
    canWatchApprovals ? 'private-approvals' : null,
    APPROVALS_EVENTS,
    APPROVALS_INVALIDATE,
  );

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
