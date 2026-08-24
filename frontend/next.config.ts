import type { NextConfig } from "next";

/**
 * Product media are **unsigned** public CDN objects: `StorageService.getPublicUrl`
 * returns `${R2_PUBLIC_URL}/${key}` with no query-string signature, so the
 * optimiser can fetch and cache them and `next/image` is safe to point at them.
 * (Evidence and export downloads keep their presigned GETs and are never
 * rendered through `next/image` — a signature would expire out of the cache.)
 *
 * The bucket host is read at config time so a deployment can point at its own
 * R2 domain without a code change; the literal fallbacks cover the two shapes
 * that exist today — `cdn.konma.store`, which `prisma/seed-data/demo-catalog.ts`
 * falls back to, and any `*.r2.dev` bucket URL, the shape `.env.example` documents.
 * A missing or malformed env var therefore degrades to the fallbacks instead of
 * throwing during `next build`.
 */
const R2_FALLBACK_HOSTS = ["cdn.konma.store", "**.r2.dev"] as const;

function imageHosts(): string[] {
  const configured = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!configured) return [...R2_FALLBACK_HOSTS];
  try {
    const { hostname } = new URL(configured);
    return hostname
      ? [hostname, ...R2_FALLBACK_HOSTS.filter((h) => h !== hostname)]
      : [...R2_FALLBACK_HOSTS];
  } catch {
    return [...R2_FALLBACK_HOSTS];
  }
}

/**
 * The retired storefront paths, and where they went.
 *
 * These live here rather than in a route-level `redirect()` because a
 * `next.config.ts` rule is answered by the router **before** the filesystem is
 * consulted — the visitor gets a real `308` with a `Location` header and no HTML
 * body, which is what a crawler needs in order to move the link equity. A server
 * page calling `redirect()` answers `307` and only after rendering the route
 * group, so the old address keeps costing a render forever.
 *
 * Config redirects also run **before** `proxy.ts` — the chain is headers →
 * redirects → proxy → rewrites → filesystem
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
 * §Execution order) — so `/menu`, `/events` and `/profile` never reach the
 * proxy's `PUBLIC_PATHS` check at all. Their entries there are now dead weight
 * rather than a contradiction, and are deliberately left alone so that removing
 * a rule from this file cannot silently turn a retired path into a bounce to
 * the staff login.
 *
 * `permanent: true` is deliberate on all four. None of these paths is coming
 * back: `/menu` became `?type=prepared_food` on the one catalogue route,
 * `/events` became `/experiences` (an experience is a `Product` addressed by
 * slug, not an `Event` addressed by uuid), and `/profile` became the six
 * `/account/*` routes.
 *
 * The frozen homepage (SPEC §1.3) still links to `/menu` three times and to
 * `/events` three times; it is not edited, and these rules are what keep those
 * links working.
 */
const RETIRED_ROUTES = [
  /** SPEC §5.1 — the prepared-food shelf of the catalogue. */
  { source: "/menu", destination: "/shop?type=prepared_food", permanent: true },
  { source: "/events", destination: "/experiences", permanent: true },
  /**
   * To the **list**, not to a slug: the old route addressed an `Event` by uuid
   * and the public catalog offers no id→slug lookup, so resolving one would
   * cost a fetch on every hit of a legacy URL. The sitting a visitor wanted is
   * the first thing on the list anyway.
   */
  { source: "/events/:id", destination: "/experiences", permanent: true },
  { source: "/profile", destination: "/account", permanent: true },
] as const;

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: imageHosts().map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/**",
    })),
  },
  async redirects() {
    return RETIRED_ROUTES.map((rule) => ({ ...rule }));
  },
};

export default nextConfig;
