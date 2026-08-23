'use client';

import { CheckCircle2 } from 'lucide-react';

export function FeedbackThankYou() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <CheckCircle2 aria-hidden="true" className="size-12 text-[var(--status-good)]" />
      <h2 className="text-3xl font-semibold">Thank you!</h2>
      <p className="text-base text-muted-foreground">
        Your feedback makes every meal better.
      </p>
    </div>
  );
}
