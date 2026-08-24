import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The route-group loading state, drawn against the shell rather than against the
 * old 4xl phone column: the layout already owns the gutter and the `max-w-7xl`
 * well, so this only supplies the page's own shapes — a title, a standfirst and
 * a product grid, which is what most storefront routes resolve into.
 */
export default function PublicLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64 max-w-full rounded-lg" />
        <Skeleton className="h-4 w-96 max-w-full rounded-md" />
      </div>
      <StorefrontSkeleton variant="grid" count={8} />
    </div>
  );
}
