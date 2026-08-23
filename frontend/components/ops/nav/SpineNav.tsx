'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useModuleAccess } from '@/lib/hooks/use-module-access';
import {
  activeGroupId,
  assertUniqueLabels,
  buildSpine,
  resolveActiveHref,
} from '@/lib/nav/spine';
import { STATUS_BADGE } from '@/lib/status-styles';
import { AdHocTaskSheet } from '@/components/ops/tasks/AdHocTaskSheet';
import { LevelUpCelebration } from '@/components/ops/gamification/LevelUpCelebration';
import type { Decision } from '@/lib/types/decisions';
import { SpineGroup } from './SpineGroup';
import { SpineLink } from './SpineLink';

/**
 * SPEC §6.2 — the navigation spine.
 *
 * ## Props contract (drop-in replacement for the old `Sidebar`)
 *
 * ```tsx
 * <SpineNav />                                   // desktop rail
 * <SpineNav onNavigate={() => setOpen(false)} /> // inside the mobile Sheet
 * ```
 *
 * | Prop | Type | Default | Meaning |
 * |---|---|---|---|
 * | `onNavigate` | `() => void` | — | Fired after any spine link is followed. The mobile drawer passes its own close handler; the desktop rail passes nothing. |
 * | `className` | `string` | — | Appended to the root `<aside>`. The component already sizes itself to `h-full w-full`, so the parent controls width. |
 *
 * The component fills its parent in both axes and renders its own `<aside>` —
 * mount it inside a sized box (`<div className="w-[240px]"><SpineNav /></div>`)
 * exactly the way `app/(ops)/layout.tsx` mounts it today. It owns no header
 * chrome: the XP block, user dropdown, theme toggler and notification bell live
 * in `AppHeader` (Task 11).
 *
 * Data source is `GET /modules/mine` only — never the permission set. On error
 * the spine renders empty plus a one-line notice rather than silently falling
 * back to permission-derived nav, which would hide a real outage.
 */
export interface SpineNavProps {
  onNavigate?: () => void;
  className?: string;
}

const COLLAPSED_STORAGE_KEY = 'konma-spine-collapsed';

// SPEC §6.2: "No label appears twice." Loud in development, free in production.
if (process.env.NODE_ENV !== 'production') {
  assertUniqueLabels();
}

/** Every group starts collapsed; the one owning the current route auto-expands. */
function readCollapsed(fallback: string[]): string[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!stored) return fallback;
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : fallback;
  } catch {
    return fallback;
  }
}

export function SpineNav({ onNavigate, className }: SpineNavProps = {}) {
  const pathname = usePathname();
  const permissions = useAuthStore((s) => s.permissions);
  const levelUpEvent = useAuthStore((s) => s.levelUpEvent);
  const clearLevelUpEvent = useAuthStore((s) => s.clearLevelUpEvent);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);

  const { moduleKeys, isLoading, isError, refetch } = useModuleAccess();
  const spine = useMemo(() => buildSpine(moduleKeys), [moduleKeys]);

  const activeHref = useMemo(
    () => resolveActiveHref(pathname, spine),
    [pathname, spine],
  );
  const openGroupId = useMemo(
    () => activeGroupId(pathname, spine),
    [pathname, spine],
  );

  // ── Collapse state ────────────────────────────────────────────────────────
  // Keyed on a string so a re-rendered (but identical) group list cannot
  // re-trigger the seeding effect.
  const groupIdKey = spine.groups.map((g) => g.id).join('|');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Groups only exist once `/modules/mine` has answered; seed defaults then.
  useEffect(() => {
    if (!groupIdKey) return;
    setCollapsed(readCollapsed(groupIdKey.split('|')));
    setHydrated(true);
  }, [groupIdKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(collapsed));
    } catch {
      /* private mode / quota — collapse state is a convenience, not state we owe */
    }
  }, [collapsed, hydrated]);

  // The group containing the active route auto-expands.
  useEffect(() => {
    if (!openGroupId) return;
    setCollapsed((prev) => (prev.includes(openGroupId) ? prev.filter((id) => id !== openGroupId) : prev));
  }, [openGroupId]);

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }, []);

  // ── Badges ────────────────────────────────────────────────────────────────
  // Phase 31 contract: `GET /approvals/count` → `{ count }`, guarded by
  // APPROVE_EVIDENCE (the same permission that gates the endpoint).
  const canApprove = permissions.includes('APPROVE_EVIDENCE');
  const { data: approvalCount } = useQuery({
    queryKey: ['approvals', 'count'],
    queryFn: () => apiClient.get<{ count: number }>('/approvals/count'),
    enabled: canApprove && spine.primary.some((i) => i.moduleKey === 'approvals'),
    staleTime: 30_000,
  });
  const pendingApprovals = approvalCount?.count ?? 0;

  const { data: proposedDecisions } = useQuery({
    queryKey: ['decisions', 'proposed-count'],
    queryFn: () => apiClient.get<Decision[]>('/decisions?status=proposed'),
    enabled: spine.primary.some((i) => i.moduleKey === 'decisions'),
  });
  const proposedCount = proposedDecisions?.length ?? 0;

  // ── Level-up overlay (kept here until a better host exists) ───────────────
  useEffect(() => {
    if (levelUpEvent === null) return;
    setLevelUpLevel(levelUpEvent);
    clearLevelUpEvent();
  }, [levelUpEvent, clearLevelUpEvent]);

  function badgeFor(moduleKey: string, label: string) {
    if (moduleKey === 'approvals' && label === 'Approvals' && pendingApprovals > 0) {
      return {
        badge: String(pendingApprovals),
        badgeClassName: STATUS_BADGE.warning,
        badgeLabel: `${pendingApprovals} approvals waiting on you`,
      };
    }
    if (moduleKey === 'decisions' && proposedCount > 0) {
      return {
        badge: String(proposedCount),
        badgeClassName: STATUS_BADGE.info,
        badgeLabel: `${proposedCount} proposed decisions`,
      };
    }
    return {};
  }

  return (
    <aside
      className={`flex h-full w-full shrink-0 flex-col border-r border-line bg-card ${className ?? ''}`}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Image
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          style={{ height: '1.75rem', width: 'auto' }}
        />
        <span className="text-sm font-semibold tracking-tight text-ink-strong">
          Konma Xperience
        </span>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {isError ? (
          <div className="rounded-md border border-line bg-surface-raised px-3 py-2 text-xs text-ink-muted">
            <p>Navigation unavailable.</p>
            <button
              type="button"
              onClick={refetch}
              className="mt-1 text-brand underline underline-offset-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            >
              Reload
            </button>
          </div>
        ) : null}

        {!isError && isLoading ? (
          <div className="space-y-1" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-surface-raised motion-reduce:animate-none" />
            ))}
          </div>
        ) : null}

        {spine.primary.map((item) => (
          <SpineLink
            key={item.label}
            label={item.label}
            href={item.href}
            icon={item.icon}
            active={activeHref === item.href}
            onNavigate={onNavigate}
            {...badgeFor(item.moduleKey, item.label)}
          />
        ))}

        {spine.groups.map((group) => (
          <SpineGroup
            key={group.id}
            id={group.id}
            label={group.label}
            collapsed={collapsed.includes(group.id)}
            onToggle={toggleGroup}
          >
            {group.items.map((item) => (
              <SpineLink
                key={item.label}
                label={item.label}
                href={item.href}
                icon={item.icon}
                active={activeHref === item.href}
                onNavigate={onNavigate}
              />
            ))}
          </SpineGroup>
        ))}
      </nav>

      {/* Ad-hoc task shortcut */}
      {permissions.includes('CREATE_ADHOC_TASK') && (
        <div className="border-t border-line p-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setAdHocOpen(true)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Ad-hoc task
          </Button>
        </div>
      )}

      {levelUpLevel !== null && (
        <LevelUpCelebration
          newLevel={levelUpLevel}
          onComplete={() => setLevelUpLevel(null)}
        />
      )}

      <AdHocTaskSheet open={adHocOpen} onOpenChange={setAdHocOpen} />
    </aside>
  );
}
