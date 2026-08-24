'use client';

/**
 * The lines the server refused to price, with its reason verbatim.
 *
 * **Why this blocks checkout rather than quietly dropping the line.**
 * `POST /customer/checkout/quote` answers `400` when nothing in the cart is
 * available, and its `rejected[]` array carries the same reasons this block
 * shows. Letting a customer walk into that error, one step further along and
 * with an address half typed, is strictly worse than stopping here — so `/cart`
 * fails early and says exactly which item and exactly why.
 *
 * The reason string is the **server's**, printed as written ("Out of stock",
 * "This experience is fully booked", "Not sold on delivery"). Substituting a
 * house apology for a specific reason is how a customer ends up unable to tell
 * whether to wait, swap the variant or give up.
 */

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { lineKeyOf, type CartLine as CartLineModel } from '@/lib/stores/cart-store';
import { cn } from '@/lib/utils';

import { CartLine } from './CartLine';

export interface RejectedLinesProps {
  lines: CartLineModel[];
  busy?: boolean;
  onRemove: (key: string) => void;
  /** Clears every refused line in one gesture. */
  onRemoveAll: () => void;
  className?: string;
}

export function RejectedLines({
  lines,
  busy = false,
  onRemove,
  onRemoveAll,
  className,
}: RejectedLinesProps) {
  if (lines.length === 0) return null;

  const many = lines.length > 1;

  return (
    <section
      data-slot="rejected-lines"
      aria-label="Items that are unavailable"
      className={cn('rounded-2xl border border-critical/40 bg-critical/5', className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-critical/30 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-critical/10 text-critical">
            <AlertTriangle className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink-strong">
              {many ? `${lines.length} items are unavailable` : 'One item is unavailable'}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              We cannot sell {many ? 'these' : 'this'} right now. Remove{' '}
              {many ? 'them' : 'it'} to carry on — the rest of your cart is untouched.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onRemoveAll}
          className="shrink-0"
        >
          Remove all unavailable
        </Button>
      </header>

      <ul className="divide-y divide-critical/20 px-5">
        {lines.map((line) => {
          const key = lineKeyOf(line);
          return (
            <CartLine
              key={key}
              line={line}
              lineKey={key}
              readOnly
              busy={busy}
              onRemove={onRemove}
              className="opacity-80"
            />
          );
        })}
      </ul>
    </section>
  );
}
