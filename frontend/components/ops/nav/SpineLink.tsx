'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface SpineLinkProps {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Longest-prefix winner for the current pathname (see `resolveActiveHref`). */
  active: boolean;
  /** Rendered right-aligned when present. Falsy values render nothing. */
  badge?: string | null;
  /** One of the `STATUS_BADGE` class strings. */
  badgeClassName?: string;
  /** `aria-label` for the badge — screen readers need more than a bare number. */
  badgeLabel?: string;
  /** Fired after navigation so the mobile sheet can close itself. */
  onNavigate?: () => void;
}

/**
 * One spine row. Active treatment is a left rule plus a brand tint; idle is
 * muted ink that fills in on hover. Rule S7 focus ring on every row.
 */
export function SpineLink({
  label,
  href,
  icon: Icon,
  active,
  badge,
  badgeClassName,
  badgeLabel,
  onNavigate,
}: SpineLinkProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        'motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
        active
          ? 'bg-[var(--accent-soft)] text-brand font-medium border-l-2 border-l-[var(--accent)]'
          : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
      ].join(' ')}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {badge ? (
        <Badge
          variant="secondary"
          aria-label={badgeLabel}
          className={`ml-auto h-4 shrink-0 px-1.5 text-[10px] ${badgeClassName ?? ''}`}
        >
          {badge}
        </Badge>
      ) : null}
    </Link>
  );
}
