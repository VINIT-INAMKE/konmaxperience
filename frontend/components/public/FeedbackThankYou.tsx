'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

/**
 * The thank-you after a `/feedback/[orderId]` submission.
 *
 * **The two things are not the same thing and the copy says so.** `Feedback` is
 * a private, order-level note that reaches the team — no login, no moderation,
 * never published. A `Review` is public, keyed on a delivered order line, and
 * goes through moderation before it appears on a product page (`REV-01`). Since
 * P5b this screen points at `/account/reviews`, where the second one is written,
 * rather than leaving a customer who wanted to say something publicly with
 * nowhere to say it.
 *
 * **No confetti.** P4 Sweep D removed the `Confetti` primitive from this
 * component and SPEC §6.4's motion allowlist keeps it out: a feedback form is
 * not a celebration, and the animation fired on a screen a customer reaches by
 * being asked to complain.
 */
export function FeedbackThankYou() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <CheckCircle2 aria-hidden="true" className="size-12 text-[var(--status-good)]" />
      <h2 className="text-3xl font-semibold">Thank you!</h2>
      <p className="max-w-prose text-base text-muted-foreground">
        Your feedback goes straight to the team who made this. It stays private.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm">
        <Link
          href="/account/reviews"
          className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
        >
          Write a public review →
        </Link>
        <Link
          href="/shop"
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
