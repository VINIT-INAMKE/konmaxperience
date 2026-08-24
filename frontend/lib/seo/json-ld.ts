import type { ProductReview, StorefrontProduct } from '../types/storefront';
import { storefrontProductImage } from '../types/storefront';
import { absoluteUrl, SITE_NAME, SITE_URL } from './metadata';

/**
 * schema.org builders for the storefront.
 *
 * Each returns a plain object; the page renders it with
 *
 * ```tsx
 * <script
 *   type="application/ld+json"
 *   dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product, reviews)) }}
 * />
 * ```
 *
 * Two rules keep the markup honest, because structured data that contradicts
 * the page is worse than none at all:
 *
 * - **`aggregateRating` is emitted only when `rating_count > 0`.** Google
 *   rejects a rating built on zero reviews, and `rating_avg` is `null` (not `0`)
 *   precisely so "unrated" and "rated badly" stay distinguishable.
 * - **`price` is the tax-inclusive figure the customer actually sees.**
 *   `base_price` already contains GST (P5a decision 1), so no tax is added on
 *   top of it here either.
 */

/** A JSON-LD node. Deliberately loose — schema.org is not a closed vocabulary. */
export type JsonLd = Record<string, unknown>;

const IN_STOCK = 'https://schema.org/InStock';
const OUT_OF_STOCK = 'https://schema.org/OutOfStock';

export interface ProductJsonLdOptions {
  /** Overrides availability when the page has already fetched `/catalog/availability`. */
  available?: boolean;
  /** Brand display name, when the page knows it. */
  brandName?: string;
}

/**
 * schema.org `Product` for `/p/[slug]`, with `offers`, an optional
 * `aggregateRating` and the published reviews the page already rendered.
 */
export function productJsonLd(
  product: StorefrontProduct,
  reviews: readonly ProductReview[] = [],
  options: ProductJsonLdOptions = {},
): JsonLd {
  const image = storefrontProductImage(product);
  const node: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    url: absoluteUrl(`/p/${product.slug}`),
    sku: product.id,
    ...(image ? { image: [image] } : {}),
    brand: {
      '@type': 'Brand',
      name: options.brandName ?? SITE_NAME,
    },
    ...(product.category ? { category: product.category.name } : {}),
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/p/${product.slug}`),
      priceCurrency: 'INR',
      /** Tax-inclusive, exactly as rendered. */
      price: product.base_price.toFixed(2),
      availability:
        options.available === false || product.status !== 'active' ? OUT_OF_STOCK : IN_STOCK,
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
  };

  if (product.rating_count > 0 && product.rating_avg !== null) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating_avg.toFixed(1),
      reviewCount: product.rating_count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (reviews.length > 0) {
    node.review = reviews.map((review) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { '@type': 'Person', name: review.customer.name ?? 'Verified buyer' },
      datePublished: review.created_at,
      ...(review.title ? { name: review.title } : {}),
      ...(review.body ? { reviewBody: review.body } : {}),
    }));
  }

  return node;
}

/**
 * The fields an experience needs for `Event` markup. Satisfied by a
 * `StorefrontProduct` of type `experience` (whose `event` join carries the date
 * and capacity) and by the ops `Event` row alike.
 */
export interface EventJsonLdInput {
  name: string;
  slug: string;
  description?: string | null;
  /** ISO 8601. */
  startDate: string;
  /** ISO 8601. Omitted when the sitting has no published end. */
  endDate?: string | null;
  /** Tax-inclusive rupees. */
  price: number;
  image?: string | null;
  /** Seats left; `0` renders `SoldOut`. */
  spotsRemaining?: number | null;
  locationName?: string;
  locationAddress?: string;
}

/** schema.org `Event` for `/experiences/[slug]`. */
export function eventJsonLd(input: EventJsonLdInput): JsonLd {
  const url = absoluteUrl(`/experiences/${input.slug}`);
  const soldOut = input.spotsRemaining !== null && input.spotsRemaining !== undefined
    ? input.spotsRemaining <= 0
    : false;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url,
    ...(input.image ? { image: [input.image] } : {}),
    location: {
      '@type': 'Place',
      name: input.locationName ?? SITE_NAME,
      ...(input.locationAddress
        ? { address: { '@type': 'PostalAddress', streetAddress: input.locationAddress } }
        : {}),
    },
    organizer: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'INR',
      price: input.price.toFixed(2),
      availability: soldOut ? 'https://schema.org/SoldOut' : IN_STOCK,
      validFrom: input.startDate,
    },
  };
}

/** One rung of a breadcrumb: a label and a route-relative path. */
export interface BreadcrumbRung {
  name: string;
  path: string;
}

/**
 * schema.org `BreadcrumbList`. The trail is ordered root-first and **includes
 * the current page** as its last rung, which is what Google renders as the
 * result's path line.
 */
export function breadcrumbJsonLd(trail: readonly BreadcrumbRung[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((rung, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: rung.name,
      item: absoluteUrl(rung.path),
    })),
  };
}

/** schema.org `Organization` for the homepage and the site-wide card. */
export function organizationJsonLd(logoPath = '/opengraph-image'): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl(logoPath),
  };
}

/** Serialises a node for `dangerouslySetInnerHTML`, neutralising a `</script>` in any string. */
export function jsonLdScript(node: JsonLd | JsonLd[]): string {
  return JSON.stringify(node).replace(/</g, '\\u003c');
}
