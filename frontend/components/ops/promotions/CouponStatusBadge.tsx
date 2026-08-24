'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE } from '@/lib/status-styles';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format/date';
import { isCouponLive, type Coupon } from '@/lib/types/promotions';

/**
 * The *effective* state of a coupon, which is not the same thing as its stored
 * `status`.
 *
 * `CouponsService.evaluate` rejects a code for three separate reasons — the row
 * is not `active`, the window has not opened, the window has closed — and a
 * badge that only rendered `Coupon.status` would show "Active" for a coupon
 * every customer is being told has expired. `isCouponLive` (lib/types/promotions)
 * is the shared predicate for the first of those; the other two are read off the
 * window here so staff see the same three answers the customer gets.
 */
export type CouponLifecycle =
  | 'live'
  | 'scheduled'
  | 'expired'
  | 'draft'
  | 'disabled';

/** `now` is passed in rather than read here so a table renders one consistent clock. */
export function couponLifecycle(coupon: Coupon, now: number): CouponLifecycle {
  if (coupon.status === 'disabled') return 'disabled';
  if (coupon.status === 'draft') return 'draft';
  if (isCouponLive(coupon, now)) return 'live';
  // `active` but outside its window: before it opens, or after it closed.
  // An unparseable `starts_at` compares false and falls through to `expired`,
  // which is the safe direction to be wrong in.
  return now < Date.parse(coupon.starts_at) ? 'scheduled' : 'expired';
}

const LIFECYCLE_LABELS: Record<CouponLifecycle, string> = {
  live: 'Live',
  scheduled: 'Scheduled',
  expired: 'Expired',
  draft: 'Draft',
  disabled: 'Disabled',
};

const LIFECYCLE_STYLES: Record<CouponLifecycle, string> = {
  live: STATUS_BADGE.good,
  scheduled: STATUS_BADGE.info,
  expired: STATUS_BADGE.warning,
  draft: STATUS_BADGE.neutral,
  disabled: STATUS_BADGE.muted,
};

function lifecycleHint(coupon: Coupon, lifecycle: CouponLifecycle): string {
  switch (lifecycle) {
    case 'live':
      return `Accepted at checkout until ${formatDateTime(coupon.ends_at)}`;
    case 'scheduled':
      return `Active, but the window opens ${formatDateTime(coupon.starts_at)}`;
    case 'expired':
      return `Active, but the window closed ${formatDateTime(coupon.ends_at)}`;
    case 'draft':
      return 'Not offered to anyone until it is set to Active';
    case 'disabled':
      return 'Switched off. Redemption history is kept.';
  }
}

interface CouponStatusBadgeProps {
  coupon: Coupon;
  /** The table's shared clock. */
  now: number;
  className?: string;
}

export function CouponStatusBadge({
  coupon,
  now,
  className,
}: CouponStatusBadgeProps) {
  const lifecycle = couponLifecycle(coupon, now);
  return (
    <Badge
      variant="outline"
      className={cn(LIFECYCLE_STYLES[lifecycle], className)}
      title={lifecycleHint(coupon, lifecycle)}
    >
      {LIFECYCLE_LABELS[lifecycle]}
    </Badge>
  );
}
