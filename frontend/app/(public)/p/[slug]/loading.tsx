import { StorefrontSkeleton } from '@/components/storefront/common/StorefrontSkeleton';

/**
 * `/p/[slug]`'s loading state (`DESIGN-03`).
 *
 * The `detail` variant is already shaped like the real page — a square media
 * plate beside a title, a price and a call to action — so the layout does not
 * visibly re-flow when the product lands. The reviews block below it stands in
 * for the section that always follows.
 */
export default function ProductLoading() {
  return (
    <div className="space-y-12">
      <StorefrontSkeleton variant="text" count={1} className="max-w-xs" />
      <StorefrontSkeleton variant="detail" />
      <StorefrontSkeleton variant="list" count={3} />
    </div>
  );
}
