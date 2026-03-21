'use client';

import { useState, useRef, useEffect } from 'react';
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
  Trophy,
  Gauge,
  BarChart3,
  Settings,
  ClipboardList,
  ClipboardCheck,
  UserCheck,
  MapPin,
  Tag,
  Radio,
  FolderOpen,
  ChefHat,
  Salad,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Evidence } from '@/lib/types/evidence';
import type { Decision } from '@/lib/types/decisions';
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
import { NumberTicker } from '@/components/ui/number-ticker';
import { LevelBadge } from '@/components/ops/gamification/LevelBadge';
import { XpProgressBar } from '@/components/ops/gamification/XpProgressBar';
import { LevelUpCelebration } from '@/components/ops/gamification/LevelUpCelebration';

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
  const levelUpEvent = useAuthStore((s) => s.levelUpEvent);
  const clearLevelUpEvent = useAuthStore((s) => s.clearLevelUpEvent);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [showLevelGlow, setShowLevelGlow] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const prevLevelRef = useRef<number>(user?.level ?? 1);

  // Detect level-up via auth store levelUpEvent
  useEffect(() => {
    if (levelUpEvent !== null) {
      setLevelUpLevel(levelUpEvent);
      setShowLevelGlow(true);
      const glowTimer = setTimeout(() => setShowLevelGlow(false), 3000);
      clearLevelUpEvent();
      return () => clearTimeout(glowTimer);
    }
  }, [levelUpEvent, clearLevelUpEvent]);

  // Also detect level-up via direct user.level change
  useEffect(() => {
    const currentLevel = user?.level ?? 1;
    if (currentLevel > prevLevelRef.current) {
      setLevelUpLevel(currentLevel);
      setShowLevelGlow(true);
      const glowTimer = setTimeout(() => setShowLevelGlow(false), 3000);
      prevLevelRef.current = currentLevel;
      return () => clearTimeout(glowTimer);
    }
    prevLevelRef.current = currentLevel;
  }, [user?.level]);

  // Fetch pending approvals count for badge
  const { data: pendingEvidence } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () =>
      apiClient.get<Evidence[]>('/evidence?status=pending'),
    // Only fetch for users who can approve (admin and leads)
    enabled: isAdmin || (user?.roleCode?.endsWith('_LEAD') ?? false),
  });
  const pendingCount = pendingEvidence?.length ?? 0;

  // Fetch proposed decisions count for badge
  const { data: proposedDecisions } = useQuery({
    queryKey: ['decisions', 'proposed-count'],
    queryFn: () => apiClient.get<Decision[]>('/decisions?status=proposed'),
  });
  const proposedCount = proposedDecisions?.length ?? 0;

  // Fetch leaderboard kill switch setting
  const { data: leaderboardSetting } = useQuery({
    queryKey: ['settings', 'leaderboard_enabled'],
    queryFn: () =>
      apiClient.get<{ key: string; value: string }>('/settings/leaderboard_enabled'),
    retry: false,
  });
  // Default to true — leaderboard shows unless explicitly disabled
  const leaderboardEnabled = leaderboardSetting?.value !== 'false';

  const overviewNav: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard className="size-4" />,
    },
  ];

  const workNav: NavItem[] = [
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
    {
      label: 'Decisions',
      href: '/decisions',
      icon: <ClipboardCheck className="size-4" />,
      badge: proposedCount > 0 ? String(proposedCount) : undefined,
      badgeClassName: 'text-blue-400 bg-blue-950 border-blue-500/20',
    },
  ];

  const intelligenceNav: NavItem[] = [
    {
      label: 'Readiness',
      href: '/readiness',
      icon: <Gauge className="size-4" />,
    },
    ...(leaderboardEnabled
      ? [
          {
            label: 'Leaderboard',
            href: '/leaderboard',
            icon: <Trophy className="size-4" />,
          },
        ]
      : []),
    {
      label: 'KPIs',
      href: '/kpis',
      icon: <BarChart3 className="size-4" />,
    },
  ];

  const operationsNav: NavItem[] = [
    { label: 'Zones', href: '/operations/zones', icon: <MapPin className="size-4" /> },
    { label: 'Brands', href: '/operations/brands', icon: <Tag className="size-4" /> },
    { label: 'Channels', href: '/operations/channels', icon: <Radio className="size-4" /> },
    { label: 'Assets', href: '/operations/assets', icon: <FolderOpen className="size-4" /> },
    { label: 'Recipes', href: '/operations/recipes', icon: <ChefHat className="size-4" /> },
    { label: 'Ingredients', href: '/operations/ingredients', icon: <Salad className="size-4" /> },
    { label: 'Vendors', href: '/operations/vendors', icon: <Truck className="size-4" /> },
    { label: 'Menu', href: '/operations/menu', icon: <UtensilsCrossed className="size-4" /> },
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
    {
      label: 'Delegations',
      href: '/admin/delegations',
      icon: <UserCheck className="size-4" />,
    },
    {
      label: 'Settings',
      href: '/admin/settings',
      icon: <Settings className="size-4" />,
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
        {overviewNav.map((item) => (
          <NavLink key={item.label} item={item} active={isActive(item.href)} />
        ))}

        <div className="pt-3 pb-1 px-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Work
          </span>
        </div>
        {workNav.map((item) => (
          <NavLink key={item.label} item={item} active={isActive(item.href)} />
        ))}

        <div className="pt-3 pb-1 px-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Intelligence
          </span>
        </div>
        {intelligenceNav.map((item) => (
          <NavLink key={item.label} item={item} active={isActive(item.href)} />
        ))}

        <div className="pt-3 pb-1 px-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Operations
          </span>
        </div>
        {operationsNav.map((item) => (
          <NavLink key={item.label} item={item} active={isActive(item.href)} />
        ))}

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
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
              {/* XP total + Level badge */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <NumberTicker
                  value={user?.xp_total ?? 0}
                  className="text-xs tabular-nums text-muted-foreground"
                />
                <span className="text-xs text-muted-foreground">XP</span>
                <LevelBadge level={user?.level ?? 1} showGlow={showLevelGlow} />
              </div>
            </div>
            <ChevronsUpDown className="size-4 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-[224px]"
          >
            {/* XP progress bar in dropdown — user profile/header location */}
            <div className="px-2 py-2">
              <XpProgressBar
                xpTotal={user?.xp_total ?? 0}
                level={user?.level ?? 1}
              />
            </div>
            <DropdownMenuSeparator />
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

      {/* Level-up celebration overlay */}
      {levelUpLevel !== null && (
        <LevelUpCelebration
          newLevel={levelUpLevel}
          onComplete={() => setLevelUpLevel(null)}
        />
      )}

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
