'use client';

import { Home, Truck } from 'lucide-react';

import type { CheckoutChannel } from '@/lib/types/checkout';
import { cn } from '@/lib/utils';

/**
 * How the **villa-made** lines reach the customer.
 *
 * This one control writes two request fields, because on the backend they are
 * one intention:
 *
 * - `pickup` — `checkout.service.ts:151` runs `assertLocalServiceable` only
 *   `if (priced.has_local && !dto.pickup)`. Collecting at the villa means the
 *   delivery allow-list does not apply, so an unserviceable pincode stops
 *   blocking the order.
 * - `channel` — `takeaway` or `delivery`, which is what the channel price
 *   modifier is computed from. Letting the two drift would let a customer pick
 *   "collect" and still be charged the delivery modifier.
 *
 * It renders **only when the cart holds a local line**. Shipped lines go by
 * courier and booking lines are attended, so for a cart of just those two the
 * question is meaningless and asking it would imply the address is optional
 * when it is not.
 */

export interface PickupToggleProps {
  pickup: boolean;
  /** Writes both fields at once — see the note above. */
  onChange: (next: { pickup: boolean; channel: CheckoutChannel }) => void;
  disabled?: boolean;
  className?: string;
}

interface OptionProps {
  selected: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  onSelect: () => void;
}

function Option({ selected, disabled, icon, title, hint, onSelect }: OptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex flex-1 items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        selected
          ? 'border-brand bg-brand-soft'
          : 'border-line bg-surface hover:border-line-strong hover:bg-surface-raised',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('mt-0.5 shrink-0', selected ? 'text-brand' : 'text-ink-muted')}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block text-sm font-medium',
            selected ? 'text-ink-strong' : 'text-ink-subtle',
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>
      </span>
    </button>
  );
}

export function PickupToggle({ pickup, onChange, disabled, className }: PickupToggleProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-ink-strong">Your villa-made items</p>
      <div role="radiogroup" aria-label="How your villa-made items reach you" className="flex flex-col gap-2 sm:flex-row">
        <Option
          selected={!pickup}
          disabled={disabled}
          icon={<Truck className="size-4" />}
          title="Deliver to my address"
          hint="We bring it to the address below."
          onSelect={() => onChange({ pickup: false, channel: 'delivery' })}
        />
        <Option
          selected={pickup}
          disabled={disabled}
          icon={<Home className="size-4" />}
          title="Collect at the villa"
          hint="No delivery area limits, and no delivery charge."
          onSelect={() => onChange({ pickup: true, channel: 'takeaway' })}
        />
      </div>
    </div>
  );
}
