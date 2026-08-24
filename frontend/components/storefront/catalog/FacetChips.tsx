import Link from 'next/link';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

import { hasActiveFacet, type FacetGroup } from './catalog-model';

/**
 * The small-screen facet row (below `lg`), where a sidebar would eat the whole
 * first screen.
 *
 * Same {@link FacetGroup} data and the same URL-as-state rule as
 * `FacetSidebar` — these are two presentations of one model, not two filter
 * implementations. One horizontally scrollable row per group, with the active
 * chip carrying an inline dismiss so a filter can be dropped without hunting
 * for a "clear" control.
 *
 * `-mx-4 px-4 sm:-mx-6 sm:px-6` is the deliberate exception to "never re-declare
 * the gutter": the row must bleed to the viewport edge so a scrolled chip is not
 * clipped mid-word, and it pays the gutter back as padding so the first chip
 * still lines up with the grid.
 */
export interface FacetChipsProps {
  groups: readonly FacetGroup[];
  clearAllHref?: string;
  className?: string;
}

export function FacetChips({ groups, clearAllHref, className }: FacetChipsProps) {
  const visible = groups.filter((group) => group.options.length > 0);
  if (visible.length === 0) return null;

  return (
    <nav
      data-slot="facet-chips"
      aria-label="Filter products"
      className={cn('space-y-2 lg:hidden', className)}
    >
      {visible.map((group) => (
        <div key={group.id} className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          <ul className="flex w-max items-center gap-2 pb-1">
            <li className="shrink-0 pr-0.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
              {group.label}
            </li>
            {group.clearHref ? (
              <li>
                <Chip
                  href={group.clearHref}
                  label="All"
                  active={!group.options.some((option) => option.active)}
                />
              </li>
            ) : null}
            {group.options.map((option) => (
              <li key={option.id}>
                <Chip
                  href={option.active && group.clearHref ? group.clearHref : option.href}
                  label={option.label}
                  count={option.count}
                  active={option.active}
                  dismissible={option.active && Boolean(group.clearHref)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {clearAllHref && hasActiveFacet(visible) ? (
        <Link
          href={clearAllHref}
          className="inline-block rounded-sm text-xs font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
        >
          Clear all filters
        </Link>
      ) : null}
    </nav>
  );
}

function Chip({
  href,
  label,
  count,
  active,
  dismissible = false,
}: {
  href: string;
  label: string;
  count?: number | null;
  active: boolean;
  dismissible?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      aria-label={dismissible ? `Remove filter ${label}` : undefined}
      className={cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
        active
          ? 'border-brand bg-brand-soft text-ink-strong'
          : 'border-line-strong bg-surface text-ink-subtle hover:border-brand/40 hover:text-ink-strong',
      )}
    >
      <span>{label}</span>
      {typeof count === 'number' ? (
        <span className="text-ink-faint tabular-nums">{count}</span>
      ) : null}
      {dismissible ? <X className="size-3" aria-hidden="true" /> : null}
    </Link>
  );
}
