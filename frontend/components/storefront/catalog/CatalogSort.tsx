import Link from 'next/link';

import { cn } from '@/lib/utils';

import { CATALOG_SORT_LABELS, type CatalogSortKey } from './catalog-model';

/**
 * The ordering control — links, not a `<select>`, for the same reason the facets
 * are links: the order belongs in the URL and the page stays server-rendered.
 *
 * **What the control honestly offers.** `catalog.service.ts` orders by
 * `name asc` and pages on a `{ name, id }` cursor; there is no `sort` parameter
 * on `GET /catalog/products`. So `Curated` — the server's own order — is the
 * only view that can be paged, and it keeps the "Load more" button. The other
 * three orders are applied by the server component over a single
 * `limit=200` fetch (the backend's `LIST_LIMIT_MAX`), which covers the whole
 * filtered catalogue today. When it stops covering it, the page says so rather
 * than silently ordering a slice — see `note`.
 */
export interface CatalogSortOption {
  key: CatalogSortKey;
  href: string;
  active: boolean;
}

export interface CatalogSortProps {
  options: readonly CatalogSortOption[];
  /** Rendered beside the control when the sorted set is known to be truncated. */
  note?: string | null;
  className?: string;
}

export function CatalogSort({ options, note, className }: CatalogSortProps) {
  if (options.length === 0) return null;

  return (
    <div
      data-slot="catalog-sort"
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5', className)}
    >
      <span
        id="catalog-sort-label"
        className="text-xs font-medium uppercase tracking-wide text-ink-faint"
      >
        Sort
      </span>
      <ul
        aria-labelledby="catalog-sort-label"
        className="flex flex-wrap items-center gap-1"
      >
        {options.map((option) => (
          <li key={option.key}>
            <Link
              href={option.href}
              aria-current={option.active ? 'true' : undefined}
              className={cn(
                'inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
                option.active
                  ? 'bg-surface-raised text-ink-strong'
                  : 'text-ink-muted hover:bg-surface-raised hover:text-ink-strong',
              )}
            >
              {CATALOG_SORT_LABELS[option.key]}
            </Link>
          </li>
        ))}
      </ul>
      {note ? <p className="text-xs text-ink-faint">{note}</p> : null}
    </div>
  );
}
