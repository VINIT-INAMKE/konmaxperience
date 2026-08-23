'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { NotificationBell } from '@/components/ops/notifications/NotificationBell';
import { useHeaderContext } from '@/lib/hooks/use-header-context';
import { useAuthStore } from '@/lib/stores/auth-store';
import { HEADER_MODULES } from '@/lib/nav/spine';
import { EMPTY_HEADER_CONTEXT } from '@/lib/types/header';
import { MissionCrumb } from './MissionCrumb';
import { ReadinessPill } from './ReadinessPill';
import { AlertBadges } from './AlertBadges';
import { XpChip } from './XpChip';
import { CommandPalette } from './CommandPalette';
import { HeaderUserMenu } from './HeaderUserMenu';

export interface AppHeaderProps {
  /** Opens the navigation sheet. Only rendered below `lg`, where the rail is hidden. */
  onOpenNav?: () => void;
}

const SHELL =
  'sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur-sm supports-[backdrop-filter]:bg-surface/80 sm:gap-3 sm:px-4';

/**
 * SPEC §6.1 — the persistent mission header, on every ops page, for every role.
 *
 * Nine slots, one round trip (`GET /me/header`), never null:
 *
 * ```
 * [≡]  mission › phase › W12 quest        [78% ready] [3 to approve] [1 blocked] [1.2k XP Lvl4] │ [Search ⌘K] [Guide] [Chat] [Bell] [Theme] [Avatar]
 * ```
 *
 * **Responsive.** `ReadinessPill` and `XpChip` leave below `md`; Guide and Chat
 * collapse into the user menu; the search trigger loses its label and keeps its
 * icon. What stays at 360 px is the crumb and the two alert badges — the slots
 * that tell someone they are the blocker. The row never wraps: everything in the
 * right cluster is `shrink-0` and the crumb is the only `min-w-0 flex-1`.
 *
 * **Loading and failure.** While `/me/header` is in flight the shell renders at
 * the same 56 px with skeletons, so a navigation never reflows. On failure the
 * crumb falls back to its "no active mission" note and every badge reads zero —
 * degraded, never blank.
 *
 * `useHeaderContext()` is called here and nowhere else; every part below takes
 * `ctx` as a prop.
 */
export function AppHeader({ onOpenNav }: AppHeaderProps) {
  const { data, isLoading } = useHeaderContext();
  const permissions = useAuthStore((s) => s.permissions);

  const ctx = data ?? EMPTY_HEADER_CONTEXT;

  // SPEC §6.2: "Guide and Chat move to the header" — gated by ModuleAccess, the
  // same list the spine filters on, so a role never sees a module it cannot open.
  const headerModules = useMemo(
    () => HEADER_MODULES.filter((m) => ctx.module_keys.includes(m.moduleKey)),
    [ctx.module_keys],
  );

  // Backend double-gates `private-approvals` on APPROVE_EVIDENCE *and* the
  // `approvals` module; ask for the socket only when both hold. The subscription
  // itself lives in `AlertBadges` (approvals) and `NotificationBell`
  // (`private-user-{id}`), both on the one shared client in `lib/pusher-client`.
  const canWatchApprovals =
    ctx.module_keys.includes('approvals') &&
    permissions.includes('APPROVE_EVIDENCE');

  const navButton = onOpenNav ? (
    <button
      type="button"
      onClick={onOpenNav}
      aria-label="Open navigation"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 lg:hidden"
    >
      <Menu className="size-5" aria-hidden="true" />
    </button>
  ) : null;

  if (isLoading && !data) {
    return (
      <header className={SHELL} aria-busy="true">
        {navButton}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="h-4 w-32 sm:w-56" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="hidden h-7 w-20 rounded-full md:block" />
          <Skeleton className="hidden h-8 w-24 rounded-md md:block" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </header>
    );
  }

  return (
    <header className={SHELL}>
      {navButton}

      <div className="flex min-w-0 flex-1 items-center">
        <MissionCrumb ctx={ctx} />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <div className="hidden md:block">
          <ReadinessPill value={ctx.readiness_percent} />
        </div>

        <AlertBadges
          approvalsWaiting={ctx.approvals_waiting}
          myBlockers={ctx.my_blockers}
          canWatchApprovals={canWatchApprovals}
        />

        <div className="hidden md:block">
          <XpChip xpTotal={ctx.xp_total} level={ctx.level} />
        </div>

        <span
          className="mx-0.5 hidden h-5 w-px bg-line md:block"
          aria-hidden="true"
        />

        <CommandPalette />

        {headerModules.map((item) => (
          <Link
            key={item.moduleKey}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            className="hidden size-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 md:inline-flex"
          >
            <item.icon className="size-4" aria-hidden="true" />
          </Link>
        ))}

        <NotificationBell />
        <AnimatedThemeToggler className="shrink-0 text-ink-subtle hover:text-ink" />
        <HeaderUserMenu ctx={ctx} headerModules={headerModules} />
      </div>
    </header>
  );
}
