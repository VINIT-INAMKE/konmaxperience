'use client';

import { AlertTriangle, Info, Loader2, RotateCw, TimerOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Everything the money path needs to say to the customer, in one shape.
 *
 * The tone is not decoration — it encodes P5b decision 4, where the three
 * failures of `POST /customer/orders` are genuinely different events:
 *
 * | tone | raised by | what it means |
 * |---|---|---|
 * | `expired` | the countdown hitting zero | the price and any booking hold lapsed; Pay is disabled until "Refresh price" |
 * | `info` | `410` → `'requote'` | the server refreshed a price that had just passed; nothing is wrong |
 * | `warning` | `400` → `'stale'` | the cart moved under the quote; the **server's own message** is shown |
 * | `error` | anything else | a fault, retryable |
 *
 * `message` is rendered **verbatim**. The backend writes these for the customer
 * (`This coupon has expired`, `Add ₹150.00 more to use this coupon`,
 * `We do not deliver to 560001 yet`) and substituting a generic apology would
 * be strictly worse than what the server already said.
 */

export type QuoteBannerTone = 'expired' | 'info' | 'warning' | 'error';

export interface QuoteErrorBannerProps {
  tone: QuoteBannerTone;
  title?: string;
  message: ReactNode;
  onRefresh?: () => void;
  refreshLabel?: string;
  isRefreshing?: boolean;
  className?: string;
}

const TONE_CLASS: Record<QuoteBannerTone, string> = {
  expired: 'border-serious/25 bg-serious/10 text-serious',
  info: 'border-info-status/25 bg-info-status/10 text-info-status',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  error: 'border-serious/25 bg-serious/10 text-serious',
};

const TONE_TITLE: Record<QuoteBannerTone, string> = {
  expired: 'Your price has expired',
  info: 'Your price was refreshed',
  warning: 'Your cart changed',
  error: 'We could not complete that',
};

function ToneIcon({ tone }: { tone: QuoteBannerTone }) {
  if (tone === 'expired') return <TimerOff className="size-4 shrink-0" aria-hidden="true" />;
  if (tone === 'info') return <Info className="size-4 shrink-0" aria-hidden="true" />;
  return <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />;
}

export function QuoteErrorBanner({
  tone,
  title,
  message,
  onRefresh,
  refreshLabel = 'Refresh price',
  isRefreshing = false,
  className,
}: QuoteErrorBannerProps) {
  return (
    <div
      data-slot="quote-error-banner"
      role="alert"
      className={cn('rounded-xl border px-4 py-3', TONE_CLASS[tone], className)}
    >
      <div className="flex items-start gap-2.5">
        <ToneIcon tone={tone} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold">{title ?? TONE_TITLE[tone]}</p>
          <p className="text-sm text-ink-subtle">{message}</p>
          {onRefresh ? (
            <div className="pt-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCw className="size-3.5" aria-hidden="true" />
                )}
                {isRefreshing ? 'Refreshing…' : refreshLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
