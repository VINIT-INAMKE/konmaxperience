'use client';

import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentStatusPanelProps {
  status: 'success' | 'failed' | 'refunded';
  eventDate?: string;
  refundAmount?: number;
  onRetry?: () => void;
}

export function PaymentStatusPanel({
  status,
  eventDate,
  refundAmount,
  onRetry,
}: PaymentStatusPanelProps) {
  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('en-IN', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-[var(--success)]/20 bg-[var(--success)]/10 p-6 text-center space-y-2" role="status">
        <CheckCircle2 className="size-12 text-[var(--success)] mx-auto" />
        <h3 className="text-xl font-semibold text-[var(--public-fg)]">
          You&apos;re booked!
        </h3>
        {formattedDate && (
          <p className="text-sm text-[var(--public-muted)]">
            See you on {formattedDate}.
          </p>
        )}
      </div>
    );
  }

  if (status === 'refunded') {
    return (
      <div className="rounded-lg border border-[var(--status-serious)]/25 bg-[var(--status-serious)]/10 p-6 text-center space-y-2" role="alert">
        <AlertTriangle className="size-12 text-[var(--status-serious)] mx-auto" />
        <h3 className="text-base font-semibold text-[var(--status-serious)]">
          Event is now full
        </h3>
        <p className="text-sm text-[var(--status-serious)]">
          This event is now full. Your payment
          {refundAmount ? ` of \u20B9${refundAmount}` : ''} has been refunded
          — it may take 5–7 business days to reflect.
        </p>
      </div>
    );
  }

  // failed
  return (
    <div className="rounded-lg border border-[var(--status-serious)]/25 bg-[var(--status-serious)]/10 p-6 text-center space-y-3" role="alert">
      <XCircle className="size-12 text-[var(--status-serious)] mx-auto" />
      <h3 className="text-base font-semibold text-[var(--status-serious)]">
        Payment didn&apos;t go through
      </h3>
      <p className="text-sm text-[var(--status-serious)]">
        Payment didn&apos;t go through — try again or use a different method.
      </p>
      {onRetry && (
        <Button
          type="button"
          onClick={onRetry}
          className="bg-[var(--public-terracotta)] text-white hover:bg-[var(--public-terracotta)]/90"
        >
          Try again
        </Button>
      )}
    </div>
  );
}
