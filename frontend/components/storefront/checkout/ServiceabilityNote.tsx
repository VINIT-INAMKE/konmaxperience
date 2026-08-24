'use client';

import { CheckCircle2, Loader2, PackageX, Truck, XCircle } from 'lucide-react';

import { formatCurrency } from '@/lib/format/currency';
import { formatEtd } from '@/lib/format/date';
import type { ServiceabilityResponse } from '@/lib/types/checkout';
import { cn } from '@/lib/utils';

/**
 * The answer to "can you actually get this to me", rendered **before any quote
 * exists**.
 *
 * Two independent halves, because a mixed cart can be half-serviceable:
 *
 * - **local** — the villa's own delivery allow-list. When it says no, the
 *   customer is not stuck: `onOfferPickup` surfaces "collect at the villa
 *   instead", which is exactly the case `pickup: true` skips the allow-list for.
 * - **shipped** — the courier, and **`null` when the cart holds no shipped
 *   line**. `null` is not "unserviceable": the question does not arise, so
 *   nothing is rendered for it. Rendering a red row there would be the shape bug
 *   this component is written to prevent.
 *
 * Only the halves that apply to *this* cart are drawn, so a booking-only cart
 * sees nothing at all rather than two reassurances about deliveries it is not
 * making.
 */

export interface ServiceabilityNoteProps {
  result: ServiceabilityResponse | null;
  isLoading?: boolean;
  /** A transport failure — distinct from an "unserviceable" answer. */
  error?: string | null;
  /** `false` for a cart with no local line: the villa half is not asked about. */
  showLocal?: boolean;
  /** Offered when local delivery is refused and the cart can still be collected. */
  onOfferPickup?: () => void;
  className?: string;
}

function Row({
  tone,
  icon,
  children,
}: {
  tone: 'good' | 'bad' | 'neutral';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        tone === 'good' && 'border-leaf/25 bg-leaf/10 text-ink-subtle',
        tone === 'bad' && 'border-warning/25 bg-warning/10 text-ink-subtle',
        tone === 'neutral' && 'border-line bg-surface-raised text-ink-subtle',
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ServiceabilityNote({
  result,
  isLoading = false,
  error = null,
  showLocal = true,
  onOfferPickup,
  className,
}: ServiceabilityNoteProps) {
  if (isLoading) {
    return (
      <div
        data-slot="serviceability-note"
        className={cn('flex items-center gap-2 text-sm text-ink-muted', className)}
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Checking this pincode…
      </div>
    );
  }

  if (error) {
    return (
      <div data-slot="serviceability-note" className={cn('space-y-2', className)}>
        <Row tone="neutral" icon={<XCircle className="size-4 text-ink-muted" />}>
          {error}
        </Row>
      </div>
    );
  }

  if (!result) return null;

  const { local, shipped } = result;
  const etd = shipped?.etd ? formatEtd(shipped.etd) : null;

  return (
    <div data-slot="serviceability-note" className={cn('space-y-2', className)} aria-live="polite">
      {showLocal ? (
        local.serviceable ? (
          <Row tone="good" icon={<CheckCircle2 className="size-4 text-leaf" />}>
            <span className="font-medium text-ink">We deliver from the villa to this pincode.</span>
          </Row>
        ) : (
          <Row tone="bad" icon={<PackageX className="size-4 text-warning" />}>
            <span className="font-medium text-ink">
              {/* The backend's own wording, e.g. "We do not deliver to 560001 yet". */}
              {local.reason ?? 'We do not deliver from the villa to this pincode yet.'}
            </span>
            {onOfferPickup ? (
              <button
                type="button"
                onClick={onOfferPickup}
                className="mt-1 block text-sm font-medium text-brand underline underline-offset-2 hover:text-brand-hover"
              >
                Collect at the villa instead
              </button>
            ) : null}
          </Row>
        )
      ) : null}

      {/* `null` means "this cart ships nothing" — say nothing, do not say "no". */}
      {shipped === null ? null : shipped.serviceable ? (
        <Row tone="good" icon={<Truck className="size-4 text-leaf" />}>
          <span className="font-medium text-ink">
            {shipped.courier_name
              ? `${shipped.courier_name} delivers here`
              : 'A courier delivers here'}
            {etd ? `, arriving ${etd}` : ''}.
          </span>
          {typeof shipped.amount === 'number' ? (
            <span className="mt-0.5 block text-xs text-ink-muted">
              {shipped.amount > 0
                ? `Shipping about ${formatCurrency(shipped.amount)} — confirmed on the next step.`
                : 'Free shipping — confirmed on the next step.'}
            </span>
          ) : null}
        </Row>
      ) : (
        <Row tone="bad" icon={<PackageX className="size-4 text-warning" />}>
          {/* The backend's `ServiceabilityHalf` carries a `reason` here too, but
              Task 1's `ServiceabilityResponse['shipped']` does not declare one —
              so this half states the fact rather than inventing a field. When
              Task 1 adds `reason?: string`, prefer it exactly as `local` does. */}
          <span className="font-medium text-ink">No courier serves this pincode yet.</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            Try another address, or remove the shipped items from your cart.
          </span>
        </Row>
      )}
    </div>
  );
}
