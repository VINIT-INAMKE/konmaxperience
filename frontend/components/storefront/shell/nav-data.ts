import type { Brand } from '@/lib/types/brand';
import type { StorefrontCategory } from '@/lib/types/storefront';

import type { StorefrontNavSection } from './nav-model';

/**
 * Server-side loader for the Shop menu.
 *
 * **Why raw `fetch` and not `apiClient`:** `apiClient` is cookie-bound and
 * browser-only (it redirects to `/team` on a stale staff session). The shell is
 * a server component, so it talks to the two public routes directly and gets
 * Next's data cache for free.
 *
 * `GET /catalog/categories` is `@Public()` and returns a **bare array** with a
 * `brand_id` but no brand join, so the brand names come from `GET /brands`,
 * which is also `@Public()`. Both are cached for 60 s server-side by the
 * backend; 300 s here is deliberately longer — a category rename is not urgent
 * and this fetch sits in the layout of every storefront page.
 *
 * **Failure is not an error.** During `next build` there is no backend to talk
 * to, and in production a category list is a convenience, not the page. Either
 * fetch failing degrades the header to its three primary links rather than
 * throwing an error boundary over the whole storefront.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const NAV_REVALIDATE_SECONDS = 300;

/** More than this in one brand column stops being a menu and starts being a page. */
const MAX_CATEGORIES_PER_BRAND = 8;

async function fetchPublicJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: NAV_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // No backend (a build machine), a DNS failure, a timeout — the nav degrades.
    return null;
  }
}

export async function loadStorefrontNav(): Promise<StorefrontNavSection[]> {
  const [categories, brands] = await Promise.all([
    fetchPublicJson<StorefrontCategory[]>('/catalog/categories'),
    fetchPublicJson<Brand[]>('/brands'),
  ]);

  if (!Array.isArray(categories) || categories.length === 0) return [];

  const brandNames = new Map<string, string>();
  if (Array.isArray(brands)) {
    for (const brand of brands) {
      if (brand?.id && brand.name) brandNames.set(brand.id, brand.name);
    }
  }

  // `findCategories` already excludes archived rows and orders by `sort_order`,
  // so first appearance is the intended order for both brands and categories.
  const sections = new Map<string, StorefrontNavSection>();
  for (const category of categories) {
    if (category.status !== 'active') continue;
    if (!category.slug || !category.name) continue;
    const brandId = category.brand_id ?? '';
    let section = sections.get(brandId);
    if (!section) {
      section = {
        brandId,
        brandName: brandNames.get(brandId) ?? null,
        categories: [],
      };
      sections.set(brandId, section);
    }
    if (section.categories.length >= MAX_CATEGORIES_PER_BRAND) continue;
    section.categories.push({
      id: category.id,
      name: category.name,
      slug: category.slug,
    });
  }

  return [...sections.values()].filter((section) => section.categories.length > 0);
}
