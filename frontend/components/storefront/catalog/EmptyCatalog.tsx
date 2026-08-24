import { PackageOpen, SearchX } from 'lucide-react';

import { StorefrontEmpty } from '@/components/storefront/common/StorefrontEmpty';
import type { ProductType } from '@/lib/types/catalog';

import { CATALOG_TYPE_COPY, productTypeLabel } from './catalog-model';

/**
 * The catalogue's empty states (`DESIGN-03`).
 *
 * "No products in Pantry yet" and "No results for 'coconut'" are different
 * facts and this component refuses to average them: an empty **shelf** is the
 * shop's problem and offers a way to the rest of the catalogue; an empty
 * **result set** is the query's problem and offers a way to widen it. A filter
 * that excluded everything gets a third message again, because the fix there is
 * to drop the filter, not to browse elsewhere.
 *
 * Server-safe — `StorefrontEmpty`'s actions are `{ label, href }` data, never
 * handlers, so this renders inside a server page with no client boundary.
 */
export type EmptyCatalogScope =
  | { kind: 'shop'; type?: ProductType }
  | { kind: 'category'; categoryName: string; type?: ProductType }
  | { kind: 'filtered'; clearHref: string }
  | { kind: 'search'; query: string };

export interface EmptyCatalogProps {
  scope: EmptyCatalogScope;
  className?: string;
}

export function EmptyCatalog({ scope, className }: EmptyCatalogProps) {
  if (scope.kind === 'search') {
    return (
      <StorefrontEmpty
        icon={SearchX}
        title={`No results for “${scope.query}”`}
        description="Check the spelling, try a shorter word, or browse the shelves instead."
        action={{ label: 'Browse the shop', href: '/shop' }}
        secondaryAction={{ label: 'See experiences', href: '/experiences' }}
        className={className}
      />
    );
  }

  if (scope.kind === 'filtered') {
    return (
      <StorefrontEmpty
        title="Nothing matches those filters"
        description="Every filter narrows the shelf. Drop one and the rest of the catalogue comes back."
        action={{ label: 'Clear the filters', href: scope.clearHref }}
        className={className}
      />
    );
  }

  if (scope.kind === 'category') {
    return (
      <StorefrontEmpty
        icon={PackageOpen}
        title={
          scope.type
            ? `No ${productTypeLabel(scope.type).toLowerCase()} in ${scope.categoryName} yet`
            : `No products in ${scope.categoryName} yet`
        }
        description="This shelf is being restocked. The rest of the shop is open."
        action={{ label: 'Browse the shop', href: '/shop' }}
        className={className}
      />
    );
  }

  return (
    <StorefrontEmpty
      icon={PackageOpen}
      title={scope.type ? CATALOG_TYPE_COPY[scope.type].empty : 'The shop is being restocked'}
      description={
        scope.type
          ? 'Nothing on this shelf right now. The rest of the catalogue is still open.'
          : 'Nothing is listed just yet. Come back shortly, or take a look at the experiences.'
      }
      action={{ label: scope.type ? 'Browse everything' : 'See experiences', href: scope.type ? '/shop' : '/experiences' }}
      className={className}
    />
  );
}
