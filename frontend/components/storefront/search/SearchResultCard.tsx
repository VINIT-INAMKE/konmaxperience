import Link from 'next/link';
import { ArrowUpRight, Star } from 'lucide-react';

import { PriceTag } from '@/components/storefront/common/PriceTag';
import { productTypeLabel } from '@/components/storefront/catalog/catalog-model';
import type { CatalogSearchHit } from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

/**
 * One hit from `GET /catalog/search` (`SRCH-01`).
 *
 * **It is not a product card and must not pretend to be one.** The search
 * projection is raw SQL over `Product.search_text` and selects seven columns —
 * `id, name, slug, type, base_price, rating_avg, rating_count, rank`. There is
 * no media join, no variant join and no category join, so a card that reserved
 * space for a photograph would render an empty box on every result, and a
 * "from ₹x" price would be a guess about variants this route never fetched.
 * The card therefore leads with the name and quotes `base_price` flat, and the
 * variant choice happens on `/p/[slug]`.
 *
 * `rank` is ordering only and is never displayed — a relevance score means
 * nothing to a customer.
 */
export interface SearchResultCardProps {
  hit: CatalogSearchHit;
  className?: string;
}

export function SearchResultCard({ hit, className }: SearchResultCardProps) {
  return (
    <article
      data-slot="search-result"
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border border-line-warm bg-surface p-4 transition-colors',
        'focus-within:ring-3 focus-within:ring-[var(--focus)]/40 hover:border-brand/40',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[0.6875rem] font-medium text-ink-muted">
          {productTypeLabel(hit.type)}
        </span>
        <ArrowUpRight
          className="size-4 shrink-0 text-ink-faint transition-colors group-hover:text-brand"
          aria-hidden="true"
        />
      </div>

      <h3 className="text-sm font-semibold leading-snug text-ink-strong">
        <Link
          href={`/p/${hit.slug}`}
          className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {hit.name}
        </Link>
      </h3>

      <div className="mt-auto flex items-end justify-between gap-3">
        <PriceTag basePrice={hit.base_price} size="sm" />
        {hit.rating_count > 0 && hit.rating_avg !== null ? (
          <span
            className="flex items-center gap-1 text-xs text-ink-muted"
            aria-label={`Rated ${hit.rating_avg.toFixed(1)} out of 5 from ${hit.rating_count} ${
              hit.rating_count === 1 ? 'review' : 'reviews'
            }`}
          >
            <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
            <span className="font-medium text-ink-subtle tabular-nums">
              {hit.rating_avg.toFixed(1)}
            </span>
            <span className="tabular-nums" aria-hidden="true">
              ({hit.rating_count})
            </span>
          </span>
        ) : null}
      </div>
    </article>
  );
}
