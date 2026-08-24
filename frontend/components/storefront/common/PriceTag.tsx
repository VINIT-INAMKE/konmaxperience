import { formatCurrency } from '@/lib/format/currency';
import { cn } from '@/lib/utils';

/**
 * A product price, with the variant delta already folded in.
 *
 * `StorefrontVariant.price_delta` is added to `Product.base_price` and **may be
 * negative** (a smaller jar costs less than the default). So there are three
 * shapes to render and exactly one component that knows them:
 *
 * - no variant, or a zero delta → the base price alone;
 * - a positive delta → the effective price, optionally with a `+₹x` chip so a
 *   grid card can say "from ₹450 · +₹120" without doing arithmetic in JSX;
 * - a negative delta → the effective price with the base price struck through,
 *   because a price that only ever goes up is a lie a customer notices.
 *
 * Every figure is tax-inclusive (P5a decision 1). This is **display only** — the
 * charged price is re-derived server-side on every cart sync and every quote
 * (`CHK-01`), and a channel modifier can move it.
 */
export type PriceTagSize = 'sm' | 'md' | 'lg';

export interface PriceTagProps {
  /** `Product.base_price`, rupees, tax-inclusive. */
  basePrice: number;
  /** The selected (or cheapest) variant's `price_delta`. May be negative. */
  priceDelta?: number | null;
  /** Prefixes "from" — for a grid card standing in for several variants. */
  from?: boolean;
  /** Renders the `+₹x` chip alongside a positive delta. */
  showDelta?: boolean;
  size?: PriceTagSize;
  className?: string;
}

const SIZE_CLASS: Record<PriceTagSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
};

export function PriceTag({
  basePrice,
  priceDelta,
  from = false,
  showDelta = false,
  size = 'md',
  className,
}: PriceTagProps) {
  const delta = priceDelta ?? 0;
  const effective = Number((basePrice + delta).toFixed(2));
  const reduced = delta < 0;

  return (
    <p
      data-slot="price-tag"
      className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}
    >
      {from ? (
        <span className="text-xs font-normal text-ink-muted">from</span>
      ) : null}
      <span className={cn('font-semibold tracking-tight text-ink-strong tabular-nums', SIZE_CLASS[size])}>
        {formatCurrency(effective)}
      </span>
      {reduced ? (
        <span className="text-xs text-ink-faint line-through tabular-nums">
          {formatCurrency(basePrice)}
        </span>
      ) : null}
      {!reduced && showDelta && delta > 0 ? (
        <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-xs font-medium text-ink-muted tabular-nums">
          +{formatCurrency(delta)}
        </span>
      ) : null}
    </p>
  );
}
