import Image from 'next/image';
import Link from 'next/link';
import { ImageOff, Star } from 'lucide-react';

import { PriceTag } from '@/components/storefront/common/PriceTag';
import { storefrontProductImage, type StorefrontProduct } from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

import {
  cheapestVariant,
  FULFILMENT_NOTE,
  productTypeLabel,
} from './catalog-model';
import { QuickAddButton } from './QuickAddButton';

/**
 * One product in the grid (`STORE-01`).
 *
 * Three decisions are worth knowing before editing this file:
 *
 * 1. **The whole card is one link, drawn as a stretched pseudo-element.** The
 *    anchor wraps only the product name; `after:absolute after:inset-0` grows
 *    its hit area over the card. That keeps a single link in the accessibility
 *    tree (a nested `<a>`-inside-`<a>` is invalid, and a card built from three
 *    separate links reads as three results to a screen reader) while leaving the
 *    quick-add button clickable above it at `z-10`.
 * 2. **Price is quoted "from" the cheapest variant, not from `base_price`.**
 *    `price_delta` may be negative, so a 250 g jar can be cheaper than the
 *    default — leading with `base_price` would quote a price the customer can
 *    beat, which reads as a markup. `PriceTag` renders the arithmetic.
 * 3. **No add-to-cart on a multi-variant card.** A grid cannot ask which size,
 *    so those cards link through to `/p/[slug]`. See `QuickAddButton`.
 *
 * This component carries no client directive and no hooks, so it renders on the
 * server inside `/shop` **and** compiles into the client bundle when `LoadMore`
 * appends a page — one card implementation, two rendering contexts.
 */
export interface StorefrontProductCardProps {
  product: StorefrontProduct;
  /** Sets `priority` on the image — the first row only, for LCP. */
  priority?: boolean;
  className?: string;
}

/**
 * Three columns at `lg`, two at `sm`, one below — the well is capped at
 * `max-w-7xl` and gives ~15rem to the facet sidebar, so a fourth column would
 * only shrink the photography. Mirrors `ProductGrid`'s classes; change one and
 * change the other, or the optimiser serves the wrong width.
 */
const IMAGE_SIZES =
  '(min-width: 1024px) 26vw, (min-width: 640px) 45vw, 100vw';

function RatingStars({ average, count }: { average: number; count: number }) {
  const rounded = Math.round(average * 10) / 10;
  return (
    <span
      className="flex items-center gap-1 text-xs text-ink-muted"
      aria-label={`Rated ${rounded} out of 5 from ${count} ${count === 1 ? 'review' : 'reviews'}`}
    >
      <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
      <span className="font-medium text-ink-subtle tabular-nums">{rounded.toFixed(1)}</span>
      <span className="tabular-nums" aria-hidden="true">
        ({count})
      </span>
    </span>
  );
}

export function StorefrontProductCard({
  product,
  priority = false,
  className,
}: StorefrontProductCardProps) {
  const image = storefrontProductImage(product);
  const variants = product.variants ?? [];
  const cheapest = cheapestVariant(product);
  const hasChoice = variants.length > 1;

  // A booking product needs a sitting and a guest count before it can be priced
  // — that lives on `/p/[slug]` (Task 6) and `/experiences` (Task 7), never here.
  const canQuickAdd = !hasChoice && product.fulfilment !== 'booking';

  return (
    <article
      data-slot="product-card"
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl border border-line-warm bg-surface p-3 transition-shadow',
        'focus-within:ring-3 focus-within:ring-[var(--focus)]/40 hover:shadow-[0_2px_18px_-6px_rgb(0_0_0/0.18)]',
        className,
      )}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-surface-raised">
        {image ? (
          <Image
            src={image}
            alt={product.media?.[0]?.alt || product.name}
            fill
            sizes={IMAGE_SIZES}
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-ink-faint">
            <ImageOff className="size-6" aria-hidden="true" />
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-bg/85 px-2 py-0.5 text-[0.6875rem] font-medium text-ink-subtle backdrop-blur">
          {productTypeLabel(product.type)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="text-sm font-semibold leading-snug text-ink-strong">
          <Link
            href={`/p/${product.slug}`}
            className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>

        {product.category?.name ? (
          <p className="truncate text-xs text-ink-faint">{product.category.name}</p>
        ) : null}

        {product.rating_count > 0 && product.rating_avg !== null ? (
          <RatingStars average={product.rating_avg} count={product.rating_count} />
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <PriceTag
            basePrice={product.base_price}
            priceDelta={cheapest?.price_delta ?? 0}
            from={hasChoice}
            size="sm"
          />
          <p className="mt-0.5 text-xs text-ink-faint">
            {FULFILMENT_NOTE[product.fulfilment]}
          </p>
        </div>

        {canQuickAdd ? (
          <QuickAddButton
            productId={product.id}
            variantId={variants[0]?.id ?? null}
            variantName={variants[0]?.name ?? null}
            name={product.name}
            unitPrice={Number(
              (product.base_price + (variants[0]?.price_delta ?? 0)).toFixed(2),
            )}
            imageUrl={image}
          />
        ) : (
          <span className="relative z-10 shrink-0 text-xs font-medium text-brand">
            {hasChoice ? `${variants.length} options` : 'Book'}
          </span>
        )}
      </div>
    </article>
  );
}
