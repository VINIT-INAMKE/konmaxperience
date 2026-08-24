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

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: imageHosts().map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/**",
    })),
  },
};

export default nextConfig;
