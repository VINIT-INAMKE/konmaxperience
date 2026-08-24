'use client';

import { Sparkles } from 'lucide-react';

import { formatCurrency, loyaltyValue } from '@/lib/format/currency';
import { LOYALTY_TIER_LABELS, type LoyaltySummary } from '@/lib/types/checkout';

/**
 * Balance, tier and what the next tier costs (`ACCT-01`).
 *
 * **The balance is stated in rupees as well as points.** `redeem_value_per_point`
 * is the rate the checkout quote will actually use, so showing the points alone
 * would leave the customer to do the arithmetic that decides whether the balance
 * is worth spending. The rupee figure here is display-only: the server clamps
 * the real burn three ways (balance, `loyalty.max_redeem_percent`, subtotal) at
 * quote time, and the checkout — not this panel — is where that number becomes
 * a promise.
 *
 * **The progress bar is honest about what it does not know.** The API gives
 * `next_tier.points_needed` but not the tier's threshold, so the bar is drawn
 * against `lifetime_points / (lifetime_points + points_needed)` — the share of
 * the way there from *zero*, which is the only ratio the payload supports. At
 * the top tier there is no next tier and no bar, rather than a full one that
 * implies something further to reach.
 */
export function LoyaltyPanel({ summary }: { summary: LoyaltySummary }) {
  const rupees = loyaltyValue(summary.points_balance, summary.redeem_value_per_point);
  const next = summary.next_tier;
  const progress = next
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (summary.lifetime_points / (summary.lifetime_points + next.points_needed)) * 100,
          ),
        ),
      )
    : 100;

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Points balance
          </p>
          <p className="flex items-baseline gap-2">
            <Sparkles className="size-5 text-gold-text" aria-hidden="true" />
            <span className="text-3xl font-semibold tabular-nums text-ink-strong">
              {summary.points_balance.toLocaleString('en-IN')}
            </span>
            <span className="text-sm text-ink-muted">pts</span>
          </p>
          <p className="text-sm text-ink-muted">
            Worth <span className="font-medium text-ink">{formatCurrency(rupees)}</span> at
            checkout — {formatCurrency(summary.redeem_value_per_point)} a point.
          </p>
        </div>

        <div className="space-y-1 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Tier
          </p>
          <p className="inline-flex items-center rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/12 px-3 py-1 text-sm font-medium text-gold-text">
            {LOYALTY_TIER_LABELS[summary.tier]}
          </p>
          <p className="text-xs text-ink-faint tabular-nums">
            {summary.lifetime_points.toLocaleString('en-IN')} lifetime points
          </p>
        </div>
      </div>

      {next ? (
        <div className="mt-5 space-y-2">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-ink-muted">
              {next.points_needed.toLocaleString('en-IN')} points to{' '}
              <span className="font-medium text-ink-strong">
                {LOYALTY_TIER_LABELS[next.tier]}
              </span>
            </span>
            <span className="text-xs tabular-nums text-ink-faint">{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={`Progress to ${LOYALTY_TIER_LABELS[next.tier]}`}
            className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
          >
            <div
              className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-ink-faint">
            Points are earned when an order is delivered or a workshop attended — not
            when it is paid for.
          </p>
        </div>
      ) : (
        <p className="mt-5 text-sm text-ink-muted">
          You are at the top tier. Thank you — genuinely.
        </p>
      )}
    </section>
  );
}
