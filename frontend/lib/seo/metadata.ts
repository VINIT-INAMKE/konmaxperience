import type { Metadata } from 'next';

/**
 * One builder for every storefront route's `generateMetadata`.
 *
 * `metadataBase` is declared once, on `app/layout.tsx`, so **`path` stays
 * relative here** — Next resolves the canonical, the OpenGraph URL and a
 * relative image against that base. Passing an absolute path would silently
 * bypass it and hard-code an origin into every page.
 *
 * Anything that must be absolute at build time (a sitemap entry, a JSON-LD
 * `url`) goes through {@link absoluteUrl}, which reads the same origin.
 */

/** The public origin. Overridable per environment; the production value is the default. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://konma.store'
).replace(/\/+$/, '');

export const SITE_NAME = 'Konma';

/** The default social card, used when a page has no image of its own. */
export const DEFAULT_OG_IMAGE = '/opengraph-image';

/** `/p/ceramic-mug` → `https://konma.store/p/ceramic-mug`. Idempotent on absolute URLs. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface StorefrontMetadataInput {
  title: string;
  description: string;
  /** Route-relative, leading slash, no origin — e.g. `/shop/merchandise`. */
  path: string;
  /** An absolute CDN image URL, or a route-relative one. Omitted falls back to the site card. */
  image?: string | null;
  /** `article` for editorial pages; everything else is a `website`. */
  type?: 'website' | 'article';
  /**
   * Set on anything that must never be indexed — the cart, the checkout, the
   * account surface, an order's track page. All of them are behind a session
   * and none of them has a stable public URL worth ranking.
   */
  noIndex?: boolean;
}

/**
 * Builds the canonical + OpenGraph + Twitter block a storefront page needs.
 *
 * The title is left exactly as given: a product page wants
 * `"Ceramic Mug — Konma"`, and appending a site suffix here would double it up
 * for pages that already carry one.
 */
export function storefrontMetadata(input: StorefrontMetadataInput): Metadata {
  const { title, description, path, image, type = 'website', noIndex } = input;
  const images = image ? [{ url: image, alt: title }] : [{ url: DEFAULT_OG_IMAGE, alt: SITE_NAME }];

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((i) => i.url),
    },
    ...(noIndex
      ? { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } }
      : {}),
  };
}

/**
 * The metadata a private route wants: a plain title, and a firm instruction not
 * to index. Used by `/cart`, `/checkout`, `/account/*` and `/orders/[id]/track`.
 */
export function privateMetadata(title: string, description = ''): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

/**
 * Trims a product description to a length a search result will actually show,
 * breaking on a word rather than mid-syllable.
 */
export function metaDescription(text: string | null | undefined, max = 160): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
