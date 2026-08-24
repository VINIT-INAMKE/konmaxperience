'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Clock, Sparkles } from 'lucide-react';

import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';
import { formatDate } from '@/lib/format/date';
import { STATUS_BADGE } from '@/lib/status-styles';
import {
  LOYALTY_REASON_LABELS,
  type LoyaltyReason,
  type LoyaltyTransaction,
} from '@/lib/types/checkout';
import { cn } from '@/lib/utils';

/** Thirty days, in milliseconds — the window that earns an expiry warning. */
const EXPIRY_WARNING_MS = 30 * 24 * 60 * 60 * 1000;

function reasonBadge(reason: LoyaltyReason): string {
  switch (reason) {
    case 'earn':
      return STATUS_BADGE.good;
    case 'redeem':
      return STATUS_BADGE.info;
    case 'expire':
      return STATUS_BADGE.serious;
    default:
      return STATUS_BADGE.neutral;
  }
}

function expiresSoon(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return false;
  const at = new Date(expiresAt).getTime();
  if (Number.isNaN(at)) return false;
  return at > now && at - now <= EXPIRY_WARNING_MS;
}

/**
 * The last 50 ledger rows, newest first.
 *
 * **`balance_after` is shown, not recomputed.** The server writes it on the row
 * inside the same transaction that moves the balance, so it is the only figure
 * that can be trusted after an `adjust` a staff member made between two of the
 * customer's own orders. Deriving a running total in the browser from `delta`
 * would silently disagree with the account the moment the list is truncated at
 * 50 — which it always is.
 *
 * An expiry inside thirty days is called out on the row itself rather than
 * summarised at the top: which points are about to lapse is the actionable part,
 * and "you have points expiring" without saying which is a notification, not
 * information.
 */
export function LoyaltyLedger({
  transactions,
}: {
  transactions: LoyaltyTransaction[];
}) {
  // Read the clock once per mount rather than on every render: the thirty-day
  // window does not move between two renders a frame apart, and a render-body
  // `Date.now()` is an impure read the React compiler rejects.
  const [now] = useState(() => Date.now());

  if (transactions.length === 0) {
    return (
      <StorefrontEmpty
        density="inline"
        icon={Sparkles}
        title="No points activity yet"
        description="Points land when an order is delivered or a workshop attended."
        action={{ label: 'Start shopping', href: '/shop' }}
      />
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {transactions.map((row) => {
        const soon = expiresSoon(row.expires_at, now);
        return (
          <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                    reasonBadge(row.reason),
                  )}
                >
                  {LOYALTY_REASON_LABELS[row.reason]}
                </span>
                <span className="text-xs text-ink-muted">{formatDate(row.created_at)}</span>
                {row.order_id ? (
                  <Link
                    href={`/account/orders/${row.order_id}`}
                    className="text-xs text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
                  >
                    View order
                  </Link>
                ) : null}
              </div>

              {row.notes ? (
                <p className="text-xs text-ink-muted">{row.notes}</p>
              ) : null}

              {soon ? (
                <p className="inline-flex items-center gap-1 text-xs text-[var(--status-warning)]">
                  <Clock className="size-3" aria-hidden="true" />
                  Expires {formatDate(row.expires_at)}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  row.delta >= 0 ? 'text-[var(--status-good)]' : 'text-ink-strong',
                )}
              >
                {row.delta >= 0 ? '+' : '−'}
                {Math.abs(row.delta).toLocaleString('en-IN')}
              </p>
              <p className="text-xs tabular-nums text-ink-faint">
                balance {row.balance_after.toLocaleString('en-IN')}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
