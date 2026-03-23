'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  PackageSearch,
  ShoppingCart,
  TrendingUp,
  Monitor,
  Trash2,
  Medal,
  Eye,
  MessageSquare,
  CalendarDays,
  BookOpen,
  ChevronDown,
  Download,
  Megaphone,
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
import { STATUS_BADGE } from '@/lib/status-styles';
import { NumberTicker } from '@/components/ui/number-ticker';
import { LevelBadge } from '@/components/ops/gamification/LevelBadge';
import { XpProgressBar } from '@/components/ops/gamification/XpProgressBar';
import { LevelUpCelebration } from '@/components/ops/gamification/LevelUpCelebration';
import { NotificationBell } from '@/components/ops/notifications/NotificationBell';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: string;
  badgeClassName?: string;
}

interface SidebarProps {
  onNavigate?: () => void;
}

const DEFAULT_COLLAPSED = ['Operations', 'Kitchen', 'POS', 'Admin'];

// Map section names to route prefixes for auto-expand
const SECTION_ROUTES: Record<string, string[]> = {
  Boards: ['/boards/'],
  Intelligence: ['/readiness', '/leaderboard', '/kpis', '/intelligence/'],
  Operations: ['/operations/zones', '/operations/brands', '/operations/channels', '/operations/assets', '/operations/recipes', '/operations/ingredients', '/operations/vendors', '/operations/menu', '/operations/inventory', '/operations/purchase-orders', '/operations/procurement', '/operations/feedback', '/operations/events'],
  Kitchen: ['/operations/kitchen/'],
  POS: ['/pos'],
  Admin: ['/admin/'],
};

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const levelUpEvent = useAuthStore((s) => s.levelUpEvent);
  const clearLevelUpEvent = useAuthStore((s) => s.clearLevelUpEvent);
  const permissions = useAuthStore((s) => s.permissions);
  const isAdmin = user?.roleCode === RoleCode.FOUNDER_ADMIN;
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [showLevelGlow, setShowLevelGlow] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const prevLevelRef = useRef<number>(user?.level ?? 1);

  // Collapsible sidebar sections — persist to localStorage
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLLAPSED;
    try {
      const stored = localStorage.getItem('konma-sidebar-collapsed');
      return stored ? JSON.parse(stored) : DEFAULT_COLLAPSED;
    } catch {
      return DEFAULT_COLLAPSED;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('konma-sidebar-collapsed', JSON.stringify(collapsed));
    } catch { /* ignore */ }
  }, [collapsed]);

  const toggleSection = useCallback((name: string) => {
    setCollapsed((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }, []);

  const isSectionCollapsed = (name: string) => collapsed.includes(name);

  // Auto-expand section containing the active route
  useEffect(() => {
    for (const [section, prefixes] of Object.entries(SECTION_ROUTES)) {
      if (prefixes.some((p) => pathname === p || pathname.startsWith(p))) {
        setCollapsed((prev) =>
          prev.includes(section) ? prev.filter((s) => s !== section) : prev,
        );
        break;
      }
    }
  }, [pathname]);

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

  // Fetch leaderboard kill switch setting (admin/tech only — requires MANAGE_SYSTEM)
  const isAdminOrTech = permissions.includes('MANAGE_SYSTEM');
  const { data: leaderboardSetting } = useQuery({
    queryKey: ['settings', 'leaderboard_enabled'],
    queryFn: () =>
      apiClient.get<{ key: string; value: string }>('/settings/leaderboard_enabled'),
    enabled: isAdminOrTech,
    retry: false,
  });
  // Default to true — leaderboard shows unless admin explicitly disabled it
  const leaderboardEnabled = isAdminOrTech ? leaderboardSetting?.value !== 'false' : true;

  // Helper: check if user has a permission
  const can = (perm: string) => permissions.includes(perm);
  const canAny = (...perms: string[]) => perms.some((p) => permissions.includes(p));

  // ── Overview (everyone) ──
  const overviewNav: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard className="size-4" />,
    },
    {
      label: 'Guide',
      href: '/guide',
      icon: <BookOpen className="size-4" />,
    },
    {
      label: 'Chat',
      href: '/chat',
      icon: <MessageSquare className="size-4" />,
    },
  ];

  // ── Work (permission-filtered) ──
  const workNav: NavItem[] = [
    // Missions: everyone can view, but link is always visible
    {
      label: 'Missions',
      href: '/missions',
      icon: <Rocket className="size-4" />,
    },
    // Approvals: only if user can approve evidence
    ...(can('APPROVE_EVIDENCE')
      ? [{
          label: 'Approvals',
          href: '/approvals',
          icon: <CheckCircle className="size-4" />,
          badge: pendingCount > 0 ? String(pendingCount) : undefined,
          badgeClassName: STATUS_BADGE.amber,
        }]
      : []),
    // Decisions: only if user can create or approve decisions
    ...(canAny('CREATE_DECISION', 'APPROVE_DECISION')
      ? [{
          label: 'Decisions',
          href: '/decisions',
          icon: <ClipboardCheck className="size-4" />,
          badge: proposedCount > 0 ? String(proposedCount) : undefined,
          badgeClassName: STATUS_BADGE.blue,
        }]
      : []),
  ];

  // ── Boards (everyone — shared visibility) ──
  const boardsNav: NavItem[] = [
    { label: 'Missions', href: '/boards/missions', icon: <Rocket className="size-4" /> },
    { label: 'Quests', href: '/boards/quests', icon: <CheckCircle className="size-4" /> },
    { label: 'Wins', href: '/boards/wins', icon: <Medal className="size-4" /> },
    { label: 'Evidence Feed', href: '/boards/evidence', icon: <Eye className="size-4" /> },
  ];

  // ── Intelligence (permission-filtered) ──
  const intelligenceNav: NavItem[] = [
    // Readiness: everyone can view
    {
      label: 'Readiness',
      href: '/readiness',
      icon: <Gauge className="size-4" />,
    },
    // Leaderboard: everyone (if enabled)
    ...(leaderboardEnabled
      ? [{
          label: 'Leaderboard',
          href: '/leaderboard',
          icon: <Trophy className="size-4" />,
        }]
      : []),
    // KPIs: only if MANAGE_KPIS
    ...(can('MANAGE_KPIS')
      ? [{
          label: 'KPIs',
          href: '/kpis',
          icon: <BarChart3 className="size-4" />,
        }]
      : []),
    // Analytics: only if MANAGE_KPIS
    ...(can('MANAGE_KPIS')
      ? [{
          label: 'Analytics',
          href: '/intelligence/analytics',
          icon: <TrendingUp className="size-4" />,
        }]
      : []),
  ];

  // ── Operations (requires MANAGE_OPS) ──
  const operationsNav: NavItem[] = [
    ...(can('MANAGE_OPS')
      ? [
          { label: 'Zones', href: '/operations/zones', icon: <MapPin className="size-4" /> },
          { label: 'Brands', href: '/operations/brands', icon: <Tag className="size-4" /> },
          { label: 'Channels', href: '/operations/channels', icon: <Radio className="size-4" /> },
          { label: 'Assets', href: '/operations/assets', icon: <FolderOpen className="size-4" /> },
          { label: 'Recipes', href: '/operations/recipes', icon: <ChefHat className="size-4" /> },
          { label: 'Ingredients', href: '/operations/ingredients', icon: <Salad className="size-4" /> },
          { label: 'Vendors', href: '/operations/vendors', icon: <Truck className="size-4" /> },
          { label: 'Menu', href: '/operations/menu', icon: <UtensilsCrossed className="size-4" /> },
        ]
      : []),
    ...(can('MANAGE_INVENTORY')
      ? [
          { label: 'Inventory', href: '/operations/inventory', icon: <PackageSearch className="size-4" /> },
          { label: 'Inventory Overview', href: '/operations/inventory/dashboard', icon: <BarChart3 className="size-4" /> },
        ]
      : []),
    ...(can('MANAGE_PROCUREMENT')
      ? [
          { label: 'Purchase Orders', href: '/operations/purchase-orders', icon: <ShoppingCart className="size-4" /> },
          { label: 'Procurement', href: '/operations/procurement', icon: <TrendingUp className="size-4" /> },
        ]
      : []),
    ...(can('MANAGE_POS')
      ? [
          { label: 'Feedback', href: '/operations/feedback', icon: <MessageSquare className="size-4" /> },
        ]
      : []),
    ...(can('MANAGE_OPS')
      ? [
          { label: 'Events', href: '/operations/events', icon: <CalendarDays className="size-4" /> },
        ]
      : []),
  ];

  // ── Kitchen (requires MANAGE_KITCHEN) ──
  const kitchenNav: NavItem[] = can('MANAGE_KITCHEN')
    ? [
        { label: 'Dashboard', href: '/operations/kitchen/dashboard', icon: <LayoutDashboard className="size-4" /> },
        { label: 'Prep Batches', href: '/operations/kitchen/prep-batches', icon: <ChefHat className="size-4" /> },
        { label: 'KDS', href: '/operations/kitchen/kds', icon: <Monitor className="size-4" /> },
        { label: 'Waste Log', href: '/operations/kitchen/waste', icon: <Trash2 className="size-4" /> },
      ]
    : [];

  // ── POS (requires MANAGE_POS) ──
  const posNav: NavItem[] = can('MANAGE_POS')
    ? [
        { label: 'Take Order', href: '/pos', icon: <ShoppingCart className="size-4" /> },
        { label: 'Order History', href: '/pos/orders', icon: <ClipboardList className="size-4" /> },
        { label: 'Delivery Queue', href: '/pos/delivery', icon: <Truck className="size-4" /> },
      ]
    : [];

  // ── Admin (requires MANAGE_RBAC or MANAGE_SYSTEM or MANAGE_DELEGATIONS) ──
  const adminNav: NavItem[] = [
    ...(can('MANAGE_RBAC')
      ? [
          { label: 'Team', href: '/admin/users', icon: <Users className="size-4" /> },
          { label: 'Permissions', href: '/admin/permissions', icon: <Shield className="size-4" /> },
        ]
      : []),
    ...(can('VIEW_ALL')
      ? [
          { label: 'Blockers', href: '/admin/blockers', icon: <AlertTriangle className="size-4" /> },
        ]
      : []),
    ...(can('MANAGE_DELEGATIONS')
      ? [
          { label: 'Delegations', href: '/admin/delegations', icon: <UserCheck className="size-4" /> },
        ]
      : []),
    ...(can('MANAGE_SYSTEM')
      ? [
          { label: 'Settings', href: '/admin/settings', icon: <Settings className="size-4" /> },
        ]
      : []),
    ...(can('MANAGE_GUIDE')
      ? [
          { label: 'Guide Management', href: '/admin/guide', icon: <BookOpen className="size-4" /> },
        ]
      : []),
    ...(can('MANAGE_SYSTEM')
      ? [
          { label: 'Exports', href: '/admin/exports', icon: <Download className="size-4" /> },
          { label: 'Notices', href: '/admin/notices', icon: <Megaphone className="size-4" /> },
        ]
      : []),
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
    <aside className="shrink-0 border-r bg-card flex flex-col h-full w-full">
      {/* Top: Logo area */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Konma Xperience" width={28} height={28} style={{ height: '1.75rem', width: 'auto' }} />
          <span className="text-sm font-semibold tracking-tight">Konma Xperience</span>
        </div>
        <div className="flex items-center gap-1">
          <AnimatedThemeToggler />
          <NotificationBell />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {overviewNav.map((item) => (
          <NavLink key={item.label} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
        ))}

        <div className="pt-3 pb-1 px-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Work
          </span>
        </div>
        {workNav.map((item) => (
          <NavLink key={item.label} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
        ))}

        <CollapsibleSection name="Boards" collapsed={isSectionCollapsed('Boards')} onToggle={toggleSection}>
          {boardsNav.map((item) => (
            <NavLink key={item.label} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
          ))}
        </CollapsibleSection>

        <CollapsibleSection name="Intelligence" collapsed={isSectionCollapsed('Intelligence')} onToggle={toggleSection}>
          {intelligenceNav.map((item) => (
            <NavLink key={item.label} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
          ))}
        </CollapsibleSection>

        {operationsNav.length > 0 && (
          <CollapsibleSection name="Operations" collapsed={isSectionCollapsed('Operations')} onToggle={toggleSection}>
            {operationsNav.map((item) => (
              <NavLink key={item.label} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
            ))}
          </CollapsibleSection>
        )}

        {kitchenNav.length > 0 && (
          <CollapsibleSection name="Kitchen" collapsed={isSectionCollapsed('Kitchen')} onToggle={toggleSection}>
            {kitchenNav.map((item) => (
              <NavLink key={item.label} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
            ))}
          </CollapsibleSection>
        )}

        {posNav.length > 0 && (
          <CollapsibleSection name="POS" collapsed={isSectionCollapsed('POS')} onToggle={toggleSection}>
            {posNav.map((item) => (
              <NavLink key={item.label} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
            ))}
          </CollapsibleSection>
        )}

        {adminNav.length > 0 && (
          <CollapsibleSection name="Admin" collapsed={isSectionCollapsed('Admin')} onToggle={toggleSection}>
            {adminNav.map((item) => (
              <NavLink key={item.label} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
            ))}
          </CollapsibleSection>
        )}
      </nav>

      {/* Ad-hoc task shortcut */}
      {can('CREATE_ADHOC_TASK') && (
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

function CollapsibleSection({
  name,
  collapsed,
  onToggle,
  children,
}: {
  name: string;
  collapsed: boolean;
  onToggle: (name: string) => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        onClick={() => onToggle(name)}
        className="w-full pt-3 pb-1 px-2 flex items-center justify-between group"
        aria-expanded={!collapsed}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {name}
        </span>
        <ChevronDown
          className={`size-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-transform duration-200 ${
            collapsed ? '-rotate-90' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
        }`}
      >
        <div className="overflow-hidden min-h-0">
          {children}
        </div>
      </div>
    </>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
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
      onClick={onNavigate}
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
          className={`ml-auto text-[10px] h-4 px-1.5 ${item.badgeClassName ?? ''}`}
        >
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}
