import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * The storefront's loading state (`DESIGN-03`).
 *
 * The shapes here mirror the real layouts they stand in for — a product grid
 * skeleton is a grid of card-shaped blocks, not a stack of grey bars — so the
 * page does not visibly re-flow when the data lands. Every list in Wave 2 uses
 * this rather than inventing its own.
 */
export type StorefrontSkeletonVariant = 'grid' | 'list' | 'detail' | 'text';

export interface StorefrontSkeletonProps {
  variant?: StorefrontSkeletonVariant;
  /** How many cards or rows to draw. Ignored by `detail`. */
  count?: number;
  className?: string;
}

function range(count: number): number[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => i);
}

export function StorefrontSkeleton({
  variant = 'grid',
  count = 6,
  className,
}: StorefrontSkeletonProps) {
  if (variant === 'text') {
    return (
      <div
        data-slot="storefront-skeleton"
        className={cn('space-y-2', className)}
        aria-hidden="true"
      >
        {range(count).map((i) => (
          <Skeleton key={i} className={cn('h-4 rounded-md', i % 3 === 2 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div
        data-slot="storefront-skeleton"
        className={cn('divide-y divide-line rounded-xl border border-line', className)}
        aria-hidden="true"
      >
        {range(count).map((i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="size-16 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3 rounded-md" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
            </div>
            <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div
        data-slot="storefront-skeleton"
        className={cn('grid gap-10 lg:grid-cols-2', className)}
        aria-hidden="true"
      >
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-5">
          <Skeleton className="h-9 w-3/4 rounded-lg" />
          <Skeleton className="h-5 w-28 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>
          <Skeleton className="h-11 w-48 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div
      data-slot="storefront-skeleton"
      className={cn(
        'grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
      aria-hidden="true"
    >
      {range(count).map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-4/3 w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-1/3 rounded-md" />
        </div>
      ))}
    </div>
  );
}
