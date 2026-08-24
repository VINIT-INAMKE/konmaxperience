'use client';

/**
 * One fulfilment section of `/cart`.
 *
 * A Konma cart can legitimately hold a thali cooked in the villa kitchen, a jar
 * of pickle that goes out by courier and a seat at Saturday's supper club — and
 * those three things reach the customer in three completely different ways. A
 * flat list of six rows makes that invisible, and the first a customer learns of
 * it is a courier tracking link for a meal they expected tonight.
 *
 * So the lines are grouped by `Product.fulfilment` and each group states, in one
 * sentence, how its items actually arrive. This is the whole point of the
 * screen: mixed fulfilment made legible instead of confusing (`STORE-02`).
 *
 * The copy lives here rather than in the page because the same three sentences
 * have to hold on `/cart`, in the mini-cart and on the checkout review step —
 * three places is exactly where wording drifts.
 */

import { Package, Ticket, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { CartLine as CartLineModel } from '@/lib/stores/cart-store';
import { lineKeyOf } from '@/lib/stores/cart-store';
import type { FulfilmentType } from '@/lib/types/catalog';
import { cn } from '@/lib/utils';

import { CartLine } from './CartLine';

export interface FulfilmentGroupCopy {
  title: string;
  /** How these items reach the customer. One sentence, no hedging. */
  explanation: string;
  icon: LucideIcon;
}

/**
 * The render order is deliberate: soonest first. Kitchen items are today,
 * couriered items are days away, a booking is a date in the diary.
 */
export const FULFILMENT_ORDER: readonly FulfilmentType[] = ['local', 'shipped', 'booking'];

export const FULFILMENT_COPY: Record<FulfilmentType, FulfilmentGroupCopy> = {
  local: {
    title: 'From the villa kitchen',
    explanation:
      'Cooked to order at the villa. Collect it yourself or have it brought to you — we confirm the window at checkout.',
    icon: UtensilsCrossed,
  },
  shipped: {
    title: 'Shipped to you',
    explanation:
      'Packed from the pantry and handed to a courier. Shipping is quoted at checkout, once we have your pincode.',
    icon: Package,
  },
  booking: {
    title: 'Booked experiences',
    explanation:
      'Your seats are held while you pay and confirmed the moment payment lands. Nothing is shipped — just turn up on the day.',
    icon: Ticket,
  },
};

export interface CartFulfilmentGroupProps {
  fulfilment: FulfilmentType;
  lines: CartLineModel[];
  /** Keys the server repriced on the last sync. */
  repricedKeys: ReadonlySet<string>;
  busy?: boolean;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onRemove: (key: string) => void;
  className?: string;
}

export function CartFulfilmentGroup({
  fulfilment,
  lines,
  repricedKeys,
  busy = false,
  onIncrement,
  onDecrement,
  onRemove,
  className,
}: CartFulfilmentGroupProps) {
  if (lines.length === 0) return null;

  const copy = FULFILMENT_COPY[fulfilment];
  const Icon = copy.icon;
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <section
      data-slot="cart-fulfilment-group"
      data-fulfilment={fulfilment}
      aria-label={copy.title}
      className={cn('rounded-2xl border border-line bg-surface', className)}
    >
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-ink-muted">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-ink-strong">
            {copy.title}
            <span className="text-xs font-normal tabular-nums text-ink-faint">
              {units} item{units === 1 ? '' : 's'}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">{copy.explanation}</p>
        </div>
      </header>

      <ul className="divide-y divide-line px-5">
        {lines.map((line) => {
          const key = lineKeyOf(line);
          return (
            <CartLine
              key={key}
              line={line}
              lineKey={key}
              repriced={repricedKeys.has(key)}
              busy={busy}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
            />
          );
        })}
      </ul>
    </section>
  );
}
