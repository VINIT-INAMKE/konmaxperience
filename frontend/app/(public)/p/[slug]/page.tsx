import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { AddToCartPanel } from '@/components/storefront/product/AddToCartPanel';
import { ProductGallery } from '@/components/storefront/product/ProductGallery';
import { ProductMeta } from '@/components/storefront/product/ProductMeta';
import { ReviewList } from '@/components/storefront/product/ReviewList';
import { ReviewSummary, Stars } from '@/components/storefront/product/ReviewSummary';
import { Badge } from '@/components/ui/badge';
import { storefrontMetadata } from '@/lib/seo/metadata';
import {
  breadcrumbJsonLd,
  jsonLdScript,
  productJsonLd,
  type BreadcrumbRung,
} from '@/lib/seo/json-ld';
import { PRODUCT_TYPE_LABELS } from '@/lib/types/catalog';
import type { StorefrontProduct } from '@/lib/types/storefront';
import { storefrontProductImage } from '@/lib/types/storefront';

import {
  getProductBySlug,
  getProductBySlugSafe,
  getProductReviews,
  REVIEWS_PAGE_SIZE,
} from './data';

/**
 * `/p/[slug]` — `STORE-01`, and the page that makes `variantId` real.
 *
 * **A server component, deliberately and verifiably.** The product, its media
 * and the first page of reviews are all fetched on the server, so the markup a
 * crawler sees carries the name, the price, the description and the reviews
 * without running a line of JavaScript. Only three islands are client code —
 * the gallery (it holds a selected frame), the buy box (it holds a variant, a
 * quantity and the cart write) and the review pager. Everything else, including
 * the JSON-LD, is rendered here.
 *
 * **Two structured-data blocks, both honest.** `productJsonLd` prices the offer
 * at the tax-inclusive `base_price` (P5a decision 1 — GST is carved *out* of
 * that figure, never added to it), emits `aggregateRating` only when
 * `rating_count > 0`, and carries the same published reviews the page renders.
 * `breadcrumbJsonLd` mirrors the trail above the title rather than inventing a
 * second hierarchy — markup that contradicts the page is worse than none.
 *
 * **`notFound()` means the slug is gone; a backend failure does not.**
 * `getProductBySlug` returns `null` only on a `404` and throws on anything else,
 * so a hiccup in the catalog service renders the storefront error boundary and
 * answers `500` instead of telling Google to deindex a live product.
 *
 * **The 404 render answers HTTP `200`, and that is correct here.** The
 * storefront streams — `app/(public)/loading.tsx` and this route's own
 * `loading.tsx` both open a Suspense boundary, so the response headers are
 * already on the wire by the time `notFound()` throws. Next 16 documents this
 * exactly (`loading.md` §Status Codes) and injects
 * `<meta name="robots" content="noindex">` into the streamed 404 markup;
 * `generateMetadata` sets `robots: { index: false, follow: false }` on top of
 * it, so the URL is not indexed either way. A hard `404` status would mean
 * resolving the slug in `proxy.ts` before the body streams, which is Task 3's
 * file and a per-request catalog lookup in the proxy — a worse trade than a
 * documented soft 404 that crawlers are told to ignore.
 */
interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/** The description a card or a search result gets when the product has none. */
function metaDescription(product: StorefrontProduct): string {
  const raw = product.description?.trim() || product.story?.trim();
  if (raw) return raw.length > 200 ? `${raw.slice(0, 197).trimEnd()}…` : raw;
  return `${product.name} from Konma.`;
}

/**
 * Root → section → (category) → product.
 *
 * An `experience` hangs off `/experiences`, everything else off `/shop`; a
 * product whose category join is missing simply loses that rung rather than
 * linking to `/shop/undefined`.
 */
function breadcrumbTrail(product: StorefrontProduct): BreadcrumbRung[] {
  const trail: BreadcrumbRung[] = [{ name: 'Home', path: '/' }];

  if (product.type === 'experience') {
    trail.push({ name: 'Experiences', path: '/experiences' });
  } else {
    trail.push({ name: 'Shop', path: '/shop' });
    if (product.category) {
      trail.push({ name: product.category.name, path: `/shop/${product.category.slug}` });
    }
  }

  trail.push({ name: product.name, path: `/p/${product.slug}` });
  return trail;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlugSafe(slug);

  if (!product) {
    return {
      title: 'Product not found — Konma',
      robots: { index: false, follow: false },
    };
  }

  return storefrontMetadata({
    title: `${product.name} — Konma`,
    description: metaDescription(product),
    path: `/p/${product.slug}`,
    image: storefrontProductImage(product),
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const reviews = await getProductReviews(product.id);
  const media = product.media ?? [];
  const trail = breadcrumbTrail(product);
  const hasRating = product.rating_count > 0 && product.rating_avg !== null;

  return (
    <article className="space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd(product, reviews.items)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(trail)) }}
      />

      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
          {trail.map((rung, index) => {
            const isLast = index === trail.length - 1;
            return (
              <li key={rung.path} className="flex items-center gap-1">
                {index > 0 ? (
                  <ChevronRight className="size-3.5 text-ink-faint" aria-hidden="true" />
                ) : null}
                {isLast ? (
                  <span aria-current="page" className="text-ink-subtle">
                    {rung.name}
                  </span>
                ) : (
                  <Link href={rung.path} className="rounded-sm hover:text-ink-strong hover:underline">
                    {rung.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductGallery media={media} productName={product.name} />

        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{PRODUCT_TYPE_LABELS[product.type]}</Badge>
              {product.category ? (
                <Link
                  href={`/shop/${product.category.slug}`}
                  className="text-sm text-ink-muted hover:text-ink-strong hover:underline"
                >
                  {product.category.name}
                </Link>
              ) : null}
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-ink-strong sm:text-4xl">
              {product.name}
            </h1>

            {hasRating ? (
              <a href="#reviews" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink-strong">
                <Stars value={product.rating_avg ?? 0} size="sm" />
                <span className="tabular-nums">
                  {(product.rating_avg ?? 0).toFixed(1)} · {product.rating_count}{' '}
                  {product.rating_count === 1 ? 'review' : 'reviews'}
                </span>
              </a>
            ) : null}

            {product.description ? (
              <p className="max-w-prose text-sm leading-relaxed text-ink-subtle">
                {product.description}
              </p>
            ) : null}
          </div>

          <AddToCartPanel product={product} />
        </div>
      </div>

      <ProductMeta product={product} />

      <section id="reviews" className="scroll-mt-24 space-y-6">
        <h2 className="text-lg font-semibold text-ink-strong">Reviews</h2>
        <ReviewSummary
          ratingAvg={product.rating_avg}
          ratingCount={product.rating_count}
          reviews={reviews.items}
        />
        <ReviewList
          productId={product.id}
          initialItems={reviews.items}
          initialCursor={reviews.next_cursor}
          pageSize={REVIEWS_PAGE_SIZE}
        />
      </section>
    </article>
  );
}
