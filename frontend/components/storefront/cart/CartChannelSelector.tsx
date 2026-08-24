'use client';

/**
 * Takeaway or delivery, for the villa-kitchen half of the cart.
 *
 * **Why it is on `/cart` at all, and why it is conditional.** `channel` is a
 * *pricing* input, not just a logistics one: `ChannelModifier` moves a product's
 * price between takeaway and delivery, so `POST /customer/cart/sync` re-prices
 * the whole cart when it changes. A customer who only discovers the switch on
 * the checkout's fulfilment step watches the subtotal move under them at the
 * worst possible moment. Choosing here means the subtotal they agree to on
 * `/cart` is the one the quote will echo.
 *
 * It renders **only when the cart holds `local` lines**, because that is the
 * only fulfilment the channel governs. Asking "takeaway or delivery?" about a
 * jar of pickle going out by courier, or about a seat at Saturday's supper club,
 * would be a question with no true answer. Checkout still owns the full
 * fulfilment step (Task 10); this is the early, honest half of it.
 *
 * No option is preselected when the store has no channel yet — a default
 * silently chosen for the customer is a price silently chosen for them.
 */

import { Bike, ShoppingBag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { CheckoutChannel } from '@/lib/types/checkout';
import { cn } from '@/lib/utils';

interface ChannelOption {
  value: CheckoutChannel;
  label: string;
  description: string;
  icon: LucideIcon;
}

const CHANNEL_OPTIONS: readonly ChannelOption[] = [
  {
    value: 'takeaway',
    label: 'Collect from the villa',
    description: 'Ready at the kitchen counter at your slot. Nothing to pay for delivery.',
    icon: ShoppingBag,
  },
  {
    value: 'delivery',
    label: 'Deliver to me',
    description: 'Brought to your address, if it falls inside the villa’s delivery zone.',
    icon: Bike,
  },
];

export interface CartChannelSelectorProps {
  channel: CheckoutChannel | null;
  onChange: (channel: CheckoutChannel) => void;
  disabled?: boolean;
  className?: string;
}

export function CartChannelSelector({
  channel,
  onChange,
  disabled = false,
  className,
}: CartChannelSelectorProps) {
  return (
    <section
      data-slot="cart-channel-selector"
      aria-label="How you would like the kitchen items"
      className={cn('rounded-2xl border border-line bg-surface p-5', className)}
    >
      <h2 className="text-sm font-semibold text-ink-strong">
        How would you like the kitchen items?
      </h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        Kitchen prices can differ between collection and delivery, so we re-check them
        with the server when you switch.
      </p>

      <RadioGroup
        value={channel ?? ''}
        onValueChange={(next) => onChange(next as CheckoutChannel)}
        disabled={disabled}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        {CHANNEL_OPTIONS.map((option) => {
          const selected = channel === option.value;
          const Icon = option.icon;
          return (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                selected
                  ? 'border-brand bg-brand-soft'
                  : 'border-line bg-surface hover:border-line-strong',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <RadioGroupItem value={option.value} className="sr-only" />
              <span
                className={cn(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                  selected ? 'bg-brand text-brand-ink' : 'bg-surface-raised text-ink-muted',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink-strong">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </section>
  );
}
