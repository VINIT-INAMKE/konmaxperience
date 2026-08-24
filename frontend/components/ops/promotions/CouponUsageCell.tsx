'use client';

import { cn } from '@/lib/utils';
import type { Coupon } from '@/lib/types/promotions';

const INFINITY = '∞';

/**
 * The usage column: redemptions against `usage_limit`.
 *
 * `_count.redemptions` is a real `COUNT` over `CouponRedemption`, not a
 * denormalised counter — `CouponsService.evaluate` counts rows for exactly the
 * same reason (a counter would drift under the Serializable confirm retry), so
 * this figure and the one the checkout enforces are the same figure.
 *
 * `usage_limit === null` means unlimited, and a coupon at its ceiling is called
 * out because `evaluate` will answer "This coupon has been fully redeemed" from
 * that moment on, whatever the status badge says.
 */
export function CouponUsageCell({ coupon }: { coupon: Coupon }) {
  const used = coupon._count?.redemptions ?? 0;
  const limit = coupon.usage_limit;
  const unlimited = limit === null;
  const exhausted = !unlimited && used >= limit;
  const ratio = unlimited || limit === 0 ? 0 : Math.min(used / limit, 1);

  return (
    <div className="min-w-[104px] space-y-1">
      <div className="flex items-baseline gap-1 tabular-nums">
        <span
          className={cn(
            'text-sm font-medium',
            exhausted ? 'text-warning' : 'text-ink',
          )}
        >
          {used}
        </span>
        <span className="text-xs text-ink-muted">
          / {unlimited ? INFINITY : limit}
        </span>
      </div>
      {unlimited ? (
        <p className="text-xs text-ink-faint">No cap</p>
      ) : (
        <>
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
            role="presentation"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width]',
                exhausted ? 'bg-warning' : 'bg-brand',
              )}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
          {exhausted && (
            <p className="text-xs text-warning">Fully redeemed</p>
          )}
        </>
      )}
    </div>
  );
}
