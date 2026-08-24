import type { ReactNode } from 'react';

import { formatCurrency } from '@/lib/format/currency';
import { cn } from '@/lib/utils';

/**
 * One label-and-amount row — the primitive that makes P5a decision 1 the path of
 * least resistance.
 *
 * `Order.subtotal` and `Quote.subtotal` are the **tax-inclusive gross**;
 * `tax_amount` is the GST already carved out of it. So GST is never a `+` line.
 * `variant="of-which"` renders it as the clarification it is — indented, quieter
 * and prefixed "of which" — which is the only shape this component will give it.
 * A caller that wants GST to look like an added charge has to fight the API,
 * which is the point.
 *
 * `sign="minus"` is for the two terms that genuinely subtract — the coupon
 * discount and the loyalty burn — and renders the amount as `−₹x` so a customer
 * can add the column up by eye and land on `total`.
 */
export type MoneyLineVariant = 'default' | 'of-which' | 'total';

export type MoneyLineSign = 'none' | 'minus';

export interface MoneyLineProps {
  /** The row label. "Subtotal (incl. GST)", "Shipping", "Coupon WELCOME10". */
  label: ReactNode;
  /** Rupees, as the API sends them — a JSON number, never a string. */
  value: number;
  variant?: MoneyLineVariant;
  sign?: MoneyLineSign;
  /** A quiet second line under the label: "Calculated at checkout", an ETD, a tier. */
  note?: ReactNode;
  /** Replaces the formatted amount entirely — for "Free" or "—". */
  valueOverride?: ReactNode;
  className?: string;
}

export function MoneyLine({
  label,
  value,
  variant = 'default',
  sign = 'none',
  note,
  valueOverride,
  className,
}: MoneyLineProps) {
  const isOfWhich = variant === 'of-which';
  const isTotal = variant === 'total';
  const amount =
    valueOverride ??
    `${sign === 'minus' && value !== 0 ? '−' : ''}${formatCurrency(Math.abs(value))}`;

  return (
    <div
      data-slot="money-line"
      data-variant={variant}
      className={cn(
        'flex items-baseline justify-between gap-6',
        isOfWhich && 'pl-3 text-xs text-ink-muted',
        !isOfWhich && 'text-sm',
        isTotal && 'border-t border-line pt-3 text-base font-semibold text-ink-strong',
        className,
      )}
    >
      <span className={cn('min-w-0', isTotal ? 'text-ink-strong' : 'text-ink-subtle')}>
        {isOfWhich ? <span className="text-ink-faint">of which </span> : null}
        {label}
        {note ? (
          <span className="mt-0.5 block text-xs font-normal text-ink-faint">{note}</span>
        ) : null}
      </span>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          isOfWhich && 'font-normal text-ink-muted',
          !isOfWhich && 'font-medium text-ink',
          isTotal && 'text-base font-semibold text-ink-strong',
          sign === 'minus' && !isTotal && 'text-leaf',
        )}
      >
        {amount}
      </span>
    </div>
  );
}
