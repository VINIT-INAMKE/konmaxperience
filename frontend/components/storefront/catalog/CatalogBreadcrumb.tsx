import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { breadcrumbJsonLd, jsonLdScript, type BreadcrumbRung } from '@/lib/seo/json-ld';
import { cn } from '@/lib/utils';

/**
 * The visible breadcrumb **and** its `BreadcrumbList` JSON-LD, from one trail.
 *
 * Emitting both from a single source is the whole point: structured data that
 * disagrees with the page is worse than none, and two hand-maintained copies of
 * the same trail drift the first time a heading is reworded. The last rung is
 * the current page — that is the rung Google renders as the result's path line —
 * so it is text, not a link.
 */
export interface CatalogBreadcrumbProps {
  trail: readonly BreadcrumbRung[];
  className?: string;
}

export function CatalogBreadcrumb({ trail, className }: CatalogBreadcrumbProps) {
  if (trail.length === 0) return null;
  const last = trail.length - 1;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(trail)) }}
      />
      <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
        <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-faint">
          {trail.map((rung, index) => (
            <li key={rung.path} className="flex items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
              ) : null}
              {index === last ? (
                <span aria-current="page" className="font-medium text-ink-muted">
                  {rung.name}
                </span>
              ) : (
                <Link
                  href={rung.path}
                  className="rounded-sm underline-offset-4 transition-colors hover:text-ink-strong hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
                >
                  {rung.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
