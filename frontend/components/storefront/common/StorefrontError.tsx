'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The storefront's error state (`DESIGN-03`) — the third of the three states
 * every Wave 2 list is required to have.
 *
 * It is a client component **only** so that `onRetry` can exist: the route-level
 * `app/(public)/error.tsx` boundary owns a retry function and needs somewhere to
 * put it. A server page renders the same component with no handler and gets a
 * link instead, which is why `href`/`actionLabel` are separate props rather than
 * a second component.
 *
 * `description` is the place for the **server's own message**. On the checkout
 * path a `400` carries text written for the customer ("This coupon has expired",
 * "Add ₹150.00 more to use this coupon") and P5b decision 4 says to show it
 * verbatim — so callers pass `apiErrorMessage(error, fallback)` here rather than
 * substituting a generic apology.
 */
export interface StorefrontErrorProps {
  title?: string;
  description?: ReactNode;
  /** A support reference — Next's `error.digest`, when there is one. */
  digest?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Rendered when there is no `onRetry`, or beside it as the way out. */
  href?: string;
  actionLabel?: string;
  density?: 'page' | 'inline';
  className?: string;
}

export function StorefrontError({
  title = 'Something went wrong',
  description = 'We could not load this just now. Nothing you did caused it.',
  digest,
  onRetry,
  retryLabel = 'Try again',
  href,
  actionLabel = 'Back to the shop',
  density = 'page',
  className,
}: StorefrontErrorProps) {
  return (
    <div
      data-slot="storefront-error"
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-line bg-surface text-center',
        density === 'page' ? 'gap-4 px-6 py-16' : 'gap-3 px-4 py-10',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <div className="max-w-prose space-y-1.5">
        <h2 className={cn('font-semibold text-ink-strong', density === 'page' ? 'text-lg' : 'text-base')}>
          {title}
        </h2>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
        {digest ? (
          <p className="font-mono text-xs text-ink-faint">Reference: {digest}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {onRetry ? (
          <Button size="lg" onClick={onRetry}>
            <RotateCw className="size-4" aria-hidden="true" />
            {retryLabel}
          </Button>
        ) : null}
        {href ? (
          <Button
            size="lg"
            variant={onRetry ? 'outline' : 'default'}
            nativeButton={false}
            render={<Link href={href} />}
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
