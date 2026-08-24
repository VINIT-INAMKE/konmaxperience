import type { ReactNode } from 'react';

import type { CatalogSearchHit } from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

import { SearchResultCard } from './SearchResultCard';

/**
 * The results grid for `/search`.
 *
 * Same contract as `ProductGrid`: `children` is the `LoadMore` island, mounted
 * **inside** the grid so its appended cards and its `col-span-full` footer share
 * one CSS grid with the server-rendered first page.
 */
export interface SearchResultGridProps {
  hits: readonly CatalogSearchHit[];
  children?: ReactNode;
  className?: string;
}

export const SEARCH_GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

export function SearchResultGrid({ hits, children, className }: SearchResultGridProps) {
  return (
    <div data-slot="search-result-grid" className={cn(SEARCH_GRID_CLASS, className)}>
      {hits.map((hit) => (
        <SearchResultCard key={hit.id} hit={hit} />
      ))}
      {children}
    </div>
  );
}
