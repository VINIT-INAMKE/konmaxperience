'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Rocket,
  CheckCircle,
  Users,
  Shield,
  LogOut,
  ChevronsUpDown,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Evidence } from '@/lib/types/evidence';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/lib/stores/auth-store';
import { logout, logoutAll } from '@/lib/auth';
import { RoleCode, ROLE_DISPLAY_NAMES } from '@/lib/types/roles';
import { AdHocTaskSheet } from '@/components/ops/tasks/AdHocTaskSheet';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: string;
  badgeClassName?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;
  const [adHocOpen, setAdHocOpen] = useState(false);

  // Fetch pending approvals count for badge
  const { data: pendingEvidence } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () =>
      apiClient.get<Evidence[]>('/evidence?status=pending'),
    // Only fetch for users who can approve (admin and leads)
    enabled: isAdmin || (user?.roleCode?.endsWith('_LEAD') ?? false),
  });
  const pendingCount = pendingEvidence?.length ?? 0;

  const mainNav: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard className="size-4" />,
    },
    {
      label: 'Missions',
      href: '/missions',
      icon: <Rocket className="size-4" />,
    },
    {
      label: 'Approvals',
      href: '/approvals',
      icon: <CheckCircle className="size-4" />,
      badge: pendingCount > 0 ? String(pendingCount) : undefined,
      badgeClassName: 'text-amber-400 bg-amber-950 border-amber-500/20',
    },
  ];

  const adminNav: NavItem[] = [
    {
      label: 'Team',
      href: '/admin/users',
      icon: <Users className="size-4" />,
    },
    {
      label: 'Permissions',
      href: '/admin/permissions',
      icon: <Shield className="size-4" />,
    },
    {
      label: 'Blockers',
      href: '/admin/blockers',
      icon: <AlertTriangle className="size-4" />,
    },
  ];

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function isActive(href: string): boolean {
    if (href === '#') return false;
    return pathname === href || pathname.startsWith(href + '/');
  }

  const roleDisplayName = user?.roleCode
    ? ROLE_DISPLAY_NAMES[user.roleCode as RoleCode] || user.roleName
    : '';

  return (
    <aside className="w-[240px] shrink-0 border-r bg-card flex flex-col h-full">
      {/* Top: Logo area */}
      <div className="px-4 py-4 border-b">
        <span className="text-sm font-semibold tracking-tight">
          Konma Xperience
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {mainNav.map((item) => (
          <NavLink key={item.label} item={item} active={isActive(item.href)} />
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-2">
              <span className="text-[13px] font-normal text-muted-foreground">
                Admin
              </span>
            </div>
            {adminNav.map((item) => (
              <NavLink
                key={item.label}
                item={item}
                active={isActive(item.href)}
              />
            ))}
          </>
        )}
      </nav>

      {/* Ad-hoc task shortcut (admin only) */}
      {isAdmin && (
        <div className="px-2 pb-2">
          <button
            onClick={() => setAdHocOpen(true)}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors"
          >
            <Plus className="size-4" />
            Ad-hoc task
          </button>
        </div>
      )}

      {/* Bottom: User section */}
      <div className="border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full rounded-md p-2 hover:bg-muted transition-colors flex items-center gap-3 text-left">
            <Avatar size="sm">
              <AvatarFallback>
                {user?.name ? getInitials(user.name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {user?.name || 'User'}
              </p>
              <Badge variant="secondary" className="text-[11px] h-4 px-1.5">
                {roleDisplayName}
              </Badge>
            </div>
            <ChevronsUpDown className="size-4 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-[224px]"
          >
            <DropdownMenuItem
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void logoutAll();
              }}
            >
              <LogOut className="size-4" />
              Log out everywhere
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Ad-hoc task sheet */}
      <AdHocTaskSheet open={adHocOpen} onOpenChange={setAdHocOpen} />
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  if (item.disabled) {
    return (
      <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground opacity-60 cursor-not-allowed select-none">
        {item.icon}
        <span>{item.label}</span>
        {item.badge && (
          <Badge
            variant="secondary"
            className={`ml-auto text-[10px] h-4 px-1.5 ${item.badgeClassName ?? ''}`}
          >
            {item.badge}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {item.icon}
      <span>{item.label}</span>
      {item.badge && (
        <Badge
          variant="secondary"
          className="ml-auto text-[10px] h-4 px-1.5"
        >
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}
