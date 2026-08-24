import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/search` while a query resolves (`DESIGN-03`).
 *
 * The route-group `(public)/loading.tsx` would replace the query field with a
 * grey bar on every search, which reads as the page having thrown the query
 * away. This keeps the field's shape at the top and animates only the results.
 */
export default function SearchLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-11 w-full max-w-2xl rounded-xl" />
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <div className="hidden space-y-4 lg:block" aria-hidden="true">
          <Skeleton className="h-3 w-16 rounded-md" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-7 w-full rounded-lg" />
          ))}
        </div>

        <div className="space-y-6">
          <Skeleton className="h-4 w-48 rounded-md" />
          <StorefrontSkeleton
            variant="grid"
            count={6}
            className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
          />
        </div>
      </div>
    </div>
  );
}
