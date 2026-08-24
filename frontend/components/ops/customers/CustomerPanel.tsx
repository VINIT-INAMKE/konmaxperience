'use client';

/**
 * The furniture every panel on `/customers/[id]` shares: a heading that states
 * what slice is on screen, an empty state, and the loyalty-point formatters.
 *
 * **Why a heading that counts.** `GET /customers/:id` fans out five *bounded*
 * queries — `orders`, `loyalty_transactions`, `coupon_redemptions` and
 * `reviews` each come back newest-first and truncated at 50. `_count` carries
 * the real totals. A panel that showed 50 rows without saying "50 of 214" would
 * quietly lie about a customer's history, so the heading always states both.
 *
 * **Points are not money** and never pass through `formatCurrency`: a balance of
 * 1 200 is twelve hundred points, not ₹1,200.00 — the rupee value of a burn is
 * `points × redeem_value_per_point`, which only a quote knows.
 */

import type { LucideIcon } from 'lucide-react';

const POINTS = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** `1200` → `1,200`. Loyalty points are whole by construction. */
export function formatPoints(points: number): string {
  return POINTS.format(Number.isFinite(points) ? Math.round(points) : 0);
}

/**
 * A signed ledger delta: `+150`, `−50`.
 *
 * The minus is a real U+2212 so a clawback lines up with the digits instead of
 * hanging off a hyphen, and is never mistaken for a list bullet.
 */
export function formatPointsDelta(delta: number): string {
  const safe = Number.isFinite(delta) ? Math.round(delta) : 0;
  return safe < 0 ? `−${formatPoints(-safe)}` : `+${formatPoints(safe)}`;
}

interface PanelHeadingProps {
  title: string;
  hint?: string;
  /** Actions rendered opposite the title — e.g. the loyalty adjust button. */
  action?: React.ReactNode;
}

export function PanelHeading({ title, hint, action }: PanelHeadingProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

interface PanelEmptyProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function PanelEmpty({
  icon: Icon,
  title,
  description,
  action,
}: PanelEmptyProps) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed py-14 text-center">
      <Icon className="mx-auto size-6 text-muted-foreground" aria-hidden />
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
