import type { ReactNode } from 'react';

import type { StorefrontProduct } from '@/lib/types/storefront';
import { cn } from '@/lib/utils';

/**
 * Everything the customer is allowed to know about the product, as a definition
 * list.
 *
 * **The type is the guard rail, not this component.** `StorefrontProduct`
 * (Task 1) mirrors `PUBLIC_INCLUDE` and therefore declares no `computed_cost`,
 * no `yield_qty`, no BOM and no margin — `CAT-03` asserts they never leave the
 * server, and a storefront component that reached for one would not compile.
 * That is why this file can render `product` freely without an allowlist: the
 * allowlist is the type.
 *
 * Rows appear only when the underlying field is populated. A missing HSN code
 * is the norm for a plated dish and rendering "HSN code: —" for every one of
 * them is noise, not transparency.
 */
export interface ProductMetaProps {
  product: StorefrontProduct;
  className?: string;
}

interface MetaRow {
  term: string;
  value: ReactNode;
  /** Prose spans the full width; a short fact sits in the two-column grid. */
  wide?: boolean;
}

/** `500` → `500 g`; `1200` → `1.2 kg`. Net weight is what a courier quotes on. */
function formatWeight(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${Number(kg.toFixed(kg % 1 === 0 ? 0 : 2))} kg`;
  }
  return `${grams} g`;
}

/** `365` → `12 months`; `21` → `21 days`. */
function formatShelfLife(days: number): string {
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30;
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export function ProductMeta({ product, className }: ProductMetaProps) {
  const rows: MetaRow[] = [];

  if (product.description) {
    rows.push({ term: 'About this', value: product.description, wide: true });
  }
  if (product.story) {
    rows.push({ term: 'The story', value: product.story, wide: true });
  }
  if (product.weight_grams !== null) {
    rows.push({ term: 'Net weight', value: formatWeight(product.weight_grams) });
  }
  if (product.shelf_life_days !== null) {
    rows.push({ term: 'Shelf life', value: formatShelfLife(product.shelf_life_days) });
  }
  if (product.hsn_code) {
    rows.push({ term: 'HSN code', value: product.hsn_code });
  }

  if (rows.length === 0) return null;

  return (
    <section data-slot="product-meta" className={cn('space-y-4', className)}>
      <h2 className="text-lg font-semibold text-ink-strong">Details</h2>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.term}
            className={cn('min-w-0 space-y-1', row.wide && 'sm:col-span-2')}
          >
            <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">
              {row.term}
            </dt>
            <dd
              className={cn(
                'text-sm text-ink-subtle',
                row.wide ? 'max-w-prose leading-relaxed whitespace-pre-line' : 'tabular-nums',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
