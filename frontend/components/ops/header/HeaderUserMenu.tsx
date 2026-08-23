'use client';

import Link from 'next/link';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { XpProgressBar } from '@/components/ops/gamification/XpProgressBar';
import { logout, logoutAll } from '@/lib/auth';
import { ROLE_DISPLAY_NAMES, type RoleCode } from '@/lib/types/roles';
import type { SpineItem } from '@/lib/nav/spine';
import type { HeaderContext } from '@/lib/types/header';

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * SPEC §6.1 slot 9 — the user menu, lifted out of the old sidebar's bottom block.
 *
 * It doubles as the narrow-viewport home for the header modules (Guide, Chat),
 * which are icon links on `md` and up and menu items below it. `headerModules`
 * is already filtered by the caller's `ModuleAccess`, so a role without `chat`
 * never sees the item here either.
 */
export function HeaderUserMenu({
  ctx,
  headerModules,
}: {
  ctx: HeaderContext;
  headerModules: SpineItem[];
}) {
  const name = ctx.user?.name ?? 'User';
  const roleLabel = ctx.role
    ? (ROLE_DISPLAY_NAMES[ctx.role.code as RoleCode] ?? ctx.role.name)
    : '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md pl-0.5 pr-1 transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50"
        aria-label={`Account menu — ${name}${roleLabel ? `, ${roleLabel}` : ''}`}
      >
        <Avatar size="sm">
          <AvatarFallback>{ctx.user ? initials(name) : '?'}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[120px] truncate text-sm font-medium text-ink xl:block">
          {name}
        </span>
        <ChevronsUpDown
          className="hidden size-3.5 shrink-0 text-ink-muted xl:block"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-[248px]">
        <div className="px-1.5 py-1.5">
          <p className="truncate text-sm font-semibold text-ink-strong">{name}</p>
          <p className="truncate text-xs text-ink-muted">
            {roleLabel}
            {ctx.node ? ` · ${ctx.node.name}` : ''}
          </p>
        </div>

        <DropdownMenuSeparator />

        <div className="px-1.5 py-2">
          <XpProgressBar xpTotal={ctx.xp_total} level={ctx.level} />
        </div>

        {headerModules.length > 0 && (
          <div className="md:hidden">
            <DropdownMenuSeparator />
            {headerModules.map((item) => (
              <DropdownMenuItem
                key={item.moduleKey}
                render={<Link href={item.href} />}
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden="true" />
          Log out
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => void logoutAll()}>
          <LogOut className="size-4" aria-hidden="true" />
          Log out everywhere
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
