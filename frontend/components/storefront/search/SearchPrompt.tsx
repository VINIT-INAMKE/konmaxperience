import Link from 'next/link';
import { Compass } from 'lucide-react';

import {
  CATALOG_TYPE_COPY,
  CATALOG_TYPE_ORDER,
  productTypeLabel,
} from '@/components/storefront/catalog/catalog-model';
import { cn } from '@/lib/utils';

/**
 * What `/search` shows when there is no `q` yet.
 *
 * **An empty query is not an error and must not look like one** (plan Task 5).
 * `catalog.service.ts:search` short-circuits a blank term to an empty envelope,
 * so there is nothing to report and nothing went wrong — the page offers the
 * four shelves as a starting point instead of an apology, and the shelf links
 * are the same `/shop?type=` URLs the header's Shop menu uses.
 */
export interface SearchPromptProps {
  className?: string;
}

export function SearchPrompt({ className }: SearchPromptProps) {
  return (
    <section
      data-slot="search-prompt"
      className={cn(
        'rounded-2xl border border-dashed border-line-warm bg-surface/60 px-6 py-10',
        className,
      )}
    >
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-raised text-ink-muted">
          <Compass className="size-5" aria-hidden="true" />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-ink-strong">
            What are you looking for?
          </h2>
          <p className="text-sm text-ink-muted">
            Search by name, ingredient or occasion — “coconut”, “ceramic”, “supper”.
            Or start from one of the shelves.
          </p>
        </div>
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {CATALOG_TYPE_ORDER.map((type) => (
            <li key={type}>
              <Link
                href={`/shop?type=${type}`}
                className="flex h-9 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink-subtle transition-colors hover:border-brand/40 hover:text-ink-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
                title={CATALOG_TYPE_COPY[type].blurb}
              >
                {productTypeLabel(type)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
