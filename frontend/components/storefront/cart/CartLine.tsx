'use client';

/**
 * One row of `/cart`.
 *
 * Three things here are not cosmetic:
 *
 * - **The row is addressed by `lineKey`, never by `productId`.** The v3 store
 *   keys lines by `` `${productId}:${variantId ?? ''}` `` (P5b decision 2), so
 *   the 250 g jar and the 500 g jar are two rows with two steppers. Passing the
 *   key down rather than recomputing it here keeps one definition of identity.
 * - **`repriced` is shown, not swallowed.** `useStorefrontCart` reports which
 *   lines the server moved on the last sync; silently swapping the number is how
 *   a customer arrives at checkout believing a different price.
 * - **At quantity 1 the minus button becomes a bin.** `updateQuantity(key, 0)`
 *   removes the line, so a `−` that quietly deletes the row would be a trap. The
 *   icon and the label both say what the click will do.
 *
 * Every figure is tax-inclusive (P5a decision 1) and comes from the last sync;
 * the charged price is re-derived server-side at quote time.
 */

import Image from 'next/image';
import { Minus, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format/currency';
import type { CartLine as CartLineModel } from '@/lib/stores/cart-store';
import { cn } from '@/lib/utils';

export interface CartLineProps {
  line: CartLineModel;
  /** The `lineKeyOf(line)` key this row is addressed by. */
  lineKey: string;
  /** The server changed this line's `unitPrice` on the last sync. */
  repriced?: boolean;
  /** A rejected line can only be removed — no stepper is drawn. */
  readOnly?: boolean;
  /** Disables the controls while a sync is in flight. */
  busy?: boolean;
  onIncrement?: (key: string) => void;
  onDecrement?: (key: string) => void;
  onRemove: (key: string) => void;
  className?: string;
}

/**
 * `next/image` throws on a relative or unconfigured host. Product media are
 * absolute `https://` R2 URLs (P5b decision 15); anything else degrades to an
 * initial rather than taking the page down.
 */
function isRenderableImage(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

function LineThumb({ line }: { line: CartLineModel }) {
  if (isRenderableImage(line.imageUrl)) {
    return (
      <Image
        src={line.imageUrl}
        alt=""
        width={80}
        height={80}
        className="size-20 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-xl font-semibold text-ink-faint"
    >
      {line.name.charAt(0).toUpperCase()}
    </div>
  );
}

export function CartLine({
  line,
  lineKey,
  repriced = false,
  readOnly = false,
  busy = false,
  onIncrement,
  onDecrement,
  onRemove,
  className,
}: CartLineProps) {
  const lineTotal = Number((line.unitPrice * line.quantity).toFixed(2));
  const lastOne = line.quantity <= 1;

  return (
    <li
      data-slot="cart-line"
      data-line-key={lineKey}
      className={cn('flex gap-4 py-5', className)}
    >
      <LineThumb line={line} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-strong">{line.name}</p>
          {line.variantName ? (
            <p className="truncate text-xs text-ink-muted">{line.variantName}</p>
          ) : null}
          {line.available === false ? (
            <p className="mt-1 text-xs text-critical">
              {line.unavailable_reason ?? 'Currently unavailable'}
            </p>
          ) : null}
        </div>

        {readOnly ? (
          <div>
            <Button
              variant="ghost"
              size="xs"
              disabled={busy}
              onClick={() => onRemove(lineKey)}
              aria-label={`Remove ${line.name} from your cart`}
            >
              <Trash2 />
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-full border border-line bg-surface">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                disabled={busy}
                onClick={() => (lastOne ? onRemove(lineKey) : onDecrement?.(lineKey))}
                aria-label={
                  lastOne
                    ? `Remove ${line.name} from your cart`
                    : `Decrease quantity of ${line.name}`
                }
              >
                {lastOne ? <Trash2 /> : <Minus />}
              </Button>
              <span
                className="min-w-8 text-center text-sm font-medium tabular-nums text-ink"
                aria-live="polite"
                aria-label={`Quantity of ${line.name}`}
              >
                {line.quantity}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                disabled={busy}
                onClick={() => onIncrement?.(lineKey)}
                aria-label={`Increase quantity of ${line.name}`}
              >
                <Plus />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="xs"
              className="text-ink-muted"
              disabled={busy}
              onClick={() => onRemove(lineKey)}
              aria-label={`Remove ${line.name} from your cart`}
            >
              Remove
            </Button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <p className="text-sm font-semibold tabular-nums text-ink-strong">
          {formatCurrency(lineTotal)}
        </p>
        {line.quantity > 1 ? (
          <p className="text-xs tabular-nums text-ink-faint">
            {formatCurrency(line.unitPrice)} each
          </p>
        ) : null}
        {repriced ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-ink-muted"
            title="We re-checked this price with the server just now."
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            Price updated
          </span>
        ) : null}
      </div>
    </li>
  );
}
