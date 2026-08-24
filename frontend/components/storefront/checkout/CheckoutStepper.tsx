'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The three steps of P5b decision 3: **Contact → Fulfilment → Review**.
 *
 * The order is load-bearing rather than cosmetic. A quote freezes a price,
 * creates 15-minute `held` bookings and burns a coupon validation, so it is
 * issued once — on entering *Review* — and re-issued only when one of its five
 * inputs actually changes. Steps 1 and 2 exist precisely so that the customer
 * has settled those inputs before the clock starts.
 */

export type CheckoutStep = 'contact' | 'fulfilment' | 'review';

export const CHECKOUT_STEPS: readonly CheckoutStep[] = ['contact', 'fulfilment', 'review'];

const STEP_LABELS: Record<CheckoutStep, string> = {
  contact: 'Contact',
  fulfilment: 'Fulfilment',
  review: 'Review',
};

const STEP_HINTS: Record<CheckoutStep, string> = {
  contact: 'Who we are sending this to',
  fulfilment: 'Where it goes, or when you collect',
  review: 'Your price, held for 15 minutes',
};

export function stepIndex(step: CheckoutStep): number {
  return CHECKOUT_STEPS.indexOf(step);
}

export interface CheckoutStepperProps {
  current: CheckoutStep;
  /** The furthest step reached — earlier ones become clickable, later ones do not. */
  furthest: CheckoutStep;
  onNavigate?: (step: CheckoutStep) => void;
  className?: string;
}

export function CheckoutStepper({
  current,
  furthest,
  onNavigate,
  className,
}: CheckoutStepperProps) {
  const currentIdx = stepIndex(current);
  const furthestIdx = stepIndex(furthest);

  return (
    <nav aria-label="Checkout progress" className={cn('w-full', className)}>
      <ol className="flex items-stretch gap-2 sm:gap-3">
        {CHECKOUT_STEPS.map((step, index) => {
          const isCurrent = index === currentIdx;
          const isComplete = index < currentIdx;
          const isReachable = index <= furthestIdx && index !== currentIdx;

          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  isComplete && 'bg-leaf text-leaf-ink',
                  isCurrent && 'bg-brand text-brand-ink',
                  !isComplete && !isCurrent && 'bg-surface-raised text-ink-faint',
                )}
              >
                {isComplete ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 text-left">
                <span
                  className={cn(
                    'block truncate text-sm font-medium',
                    isCurrent ? 'text-ink-strong' : 'text-ink-subtle',
                  )}
                >
                  {STEP_LABELS[step]}
                </span>
                <span className="hidden truncate text-xs text-ink-faint sm:block">
                  {STEP_HINTS[step]}
                </span>
              </span>
            </>
          );

          return (
            <li key={step} className="min-w-0 flex-1">
              {isReachable && onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate(step)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                    'border-line bg-surface hover:border-line-strong hover:bg-surface-raised',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  )}
                >
                  {content}
                </button>
              ) : (
                <div
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5',
                    isCurrent ? 'border-brand bg-brand-soft' : 'border-line bg-surface',
                    !isCurrent && !isComplete && 'opacity-70',
                  )}
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
