'use client';

import { formatCurrency } from '@/lib/format/currency';
import type { StorefrontVariant } from '@/lib/types/storefront';
import { variantPrice } from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

/**
 * The control that makes `variantId` real (P5b decision 2).
 *
 * A cart line is keyed by `` `${productId}:${variantId ?? ''}` ``, so the choice
 * made here *is* the line's identity: adding the 250 g jar and then the 500 g
 * jar must produce two lines at two prices, and the only way that holds is if
 * the selection is explicit. `AddToCartPanel` therefore refuses to add a
 * product with variants until one is selected — this component never renders a
 * "no choice" option.
 *
 * **Native radios, not a bespoke listbox.** Arrow-key navigation, the roving
 * tab stop and the group semantics come free and correctly; the visual
 * segmented card is a `<label>` styled through `has-[input:checked]`, so the
 * accessibility tree and the pixels never drift apart.
 *
 * **Deviation from the plan text, recorded deliberately:** the plan asks each
 * option to show its own stock for `stock_mode: 'tracked'`. The public
 * projection cannot supply it — `PUBLIC_INCLUDE` in `catalog.service.ts` selects
 * variants as `{ id, name, sku, price_delta, is_default }` and omits
 * `stock_on_hand`, and `StorefrontVariant` mirrors that omission so the gap is a
 * type error rather than a runtime `undefined`. Per-variant stock would need a
 * backend change, which Task 6 does not own. `GET /catalog/availability/:id`
 * sums stock across variants, so `AvailabilityNote` states the product-level
 * position and the picker stays price-only.
 */
export interface VariantPickerProps {
  variants: StorefrontVariant[];
  /** `Product.base_price`, rupees, tax-inclusive. Each option adds its delta. */
  basePrice: number;
  /** The selected variant id, or `null` before a choice exists. */
  value: string | null;
  onChange: (variantId: string) => void;
  /** Namespaces the radio group so two pickers on one page never collide. */
  name: string;
  disabled?: boolean;
  className?: string;
}

export function VariantPicker({
  variants,
  basePrice,
  value,
  onChange,
  name,
  disabled = false,
  className,
}: VariantPickerProps) {
  // One variant is not a choice; the panel still carries its id into the cart.
  if (variants.length <= 1) return null;

  return (
    <fieldset
      data-slot="variant-picker"
      disabled={disabled}
      className={cn('min-w-0 space-y-2', className)}
    >
      <legend className="mb-2 text-sm font-medium text-ink-strong">
        Choose an option
      </legend>

      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const price = variantPrice({ base_price: basePrice }, variant);
          const isSelected = value === variant.id;

          return (
            <label
              key={variant.id}
              className={cn(
                'group/variant relative flex min-w-36 cursor-pointer flex-col gap-0.5 rounded-xl border bg-surface px-3.5 py-2.5 transition-colors',
                'hover:border-line-strong',
                'has-[input:checked]:border-brand has-[input:checked]:bg-brand-soft',
                'has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50',
                'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50',
                isSelected ? 'border-brand' : 'border-line',
              )}
            >
              <input
                type="radio"
                name={name}
                value={variant.id}
                checked={isSelected}
                onChange={() => onChange(variant.id)}
                className="sr-only"
              />
              <span
                className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-ink-strong' : 'text-ink',
                )}
              >
                {variant.name}
              </span>
              <span className="text-sm tabular-nums text-ink-subtle">
                {formatCurrency(price)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
