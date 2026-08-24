import Link from 'next/link';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import { hasActiveFacet, type FacetGroup } from './catalog-model';

/**
 * The desktop facet rail (`lg` and up).
 *
 * **Every option is a `<Link>`, not a checkbox.** Filters live in the URL, so
 * the page stays a server component, a filtered view is shareable, and the back
 * button unwinds one filter at a time. That is also why this file carries no
 * client directive and no state: there is nothing to hold.
 *
 * The same {@link FacetGroup} data feeds `FacetChips` below `lg`, so `/shop`
 * (facets built from `GET /catalog/categories`) and `/search` (facets straight
 * off the envelope, with counts) render through one model.
 */
export interface FacetSidebarProps {
  groups: readonly FacetGroup[];
  /** Drops every filter at once. Rendered only when something is on. */
  clearAllHref?: string;
  className?: string;
}

export function FacetSidebar({ groups, clearAllHref, className }: FacetSidebarProps) {
  const visible = groups.filter((group) => group.options.length > 0);
  if (visible.length === 0) return null;

  return (
    <aside
      data-slot="facet-sidebar"
      aria-label="Filter products"
      className={cn('hidden lg:block', className)}
    >
      <div className="sticky top-24 space-y-7">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Filter
          </h2>
          {clearAllHref && hasActiveFacet(visible) ? (
            <Link
              href={clearAllHref}
              className="rounded-sm text-xs font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
            >
              Clear all
            </Link>
          ) : null}
        </div>

        {visible.map((group) => (
          <section key={group.id} className="space-y-2">
            <h3 className="text-sm font-semibold text-ink-strong">{group.label}</h3>
            <ul className="space-y-0.5">
              {group.clearHref ? (
                <li>
                  <FacetLink
                    href={group.clearHref}
                    label="All"
                    active={!group.options.some((option) => option.active)}
                  />
                </li>
              ) : null}
              {group.options.map((option) => (
                <li key={option.id}>
                  <FacetLink
                    href={option.href}
                    label={option.label}
                    count={option.count}
                    active={option.active}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}

function FacetLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count?: number | null;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
        active
          ? 'bg-brand-soft font-medium text-ink-strong'
          : 'text-ink-subtle hover:bg-surface-raised hover:text-ink-strong',
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {active ? <Check className="size-3.5 shrink-0 text-brand" aria-hidden="true" /> : null}
        <span className="truncate">{label}</span>
      </span>
      {typeof count === 'number' ? (
        <span className="shrink-0 text-xs text-ink-faint tabular-nums">{count}</span>
      ) : null}
    </Link>
  );
}
