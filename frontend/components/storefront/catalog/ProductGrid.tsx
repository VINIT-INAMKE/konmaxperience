import type { ReactNode } from 'react';

import type { StorefrontProduct } from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

import { StorefrontProductCard } from './StorefrontProductCard';

/**
 * The product grid.
 *
 * `children` is where the `LoadMore` island mounts, **inside** the grid rather
 * than after it. That is deliberate: `LoadMore` returns a fragment of appended
 * cards plus a `col-span-full` footer, so every page lands in the same CSS grid
 * and the rows stay aligned. Rendering appended pages in a second grid below
 * this one would leave a visible seam wherever the first page's last row was
 * partial.
 *
 * Server-rendered by default and client-rendered inside `LoadMore` — no hooks,
 * no directive, one implementation.
 */
export interface ProductGridProps {
  items: readonly StorefrontProduct[];
  /** Images in the first row get `priority` for LCP. Two on `sm`, three on `lg`. */
  priorityCount?: number;
  /** The `LoadMore` island, or nothing. */
  children?: ReactNode;
  className?: string;
}

/** Mirrors `StorefrontProductCard`'s `sizes` attribute. Keep the two in step. */
export const PRODUCT_GRID_CLASS =
  'grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3';

export function ProductGrid({
  items,
  priorityCount = 3,
  children,
  className,
}: ProductGridProps) {
  return (
    <div data-slot="product-grid" className={cn(PRODUCT_GRID_CLASS, className)}>
      {items.map((product, index) => (
        <StorefrontProductCard
          key={product.id}
          product={product}
          priority={index < priorityCount}
        />
      ))}
      {children}
    </div>
  );
}
