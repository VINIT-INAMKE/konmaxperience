import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/shop` and `/shop/[category]` while the catalogue resolves (`DESIGN-03`).
 *
 * A nested segment inherits the nearest `loading.tsx`, so this one file covers
 * the category route too — which is right, because the two share a layout down
 * to the sidebar width. The shapes mirror the real page (a facet rail, a sort
 * bar, a card grid) so nothing jumps when the data lands, and the route-group
 * `(public)/loading.tsx` is deliberately not reused: it draws a full-width grid
 * with no rail and would re-flow the moment the sidebar appeared.
 */
export default function ShopLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40 rounded-md" />
        <Skeleton className="h-9 w-56 max-w-full rounded-lg" />
        <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <div className="hidden space-y-6 lg:block" aria-hidden="true">
          <Skeleton className="h-3 w-16 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-20 rounded-md" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-full rounded-lg" />
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 rounded-md" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 w-full rounded-lg" />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-7 w-64 max-w-[60%] rounded-lg" />
          </div>
          <StorefrontSkeleton
            variant="grid"
            count={9}
            className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
          />
        </div>
      </div>
    </div>
  );
}
