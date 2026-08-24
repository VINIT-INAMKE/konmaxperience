/**
 * SPEC §6.2 — the navigation spine.
 *
 * The spine is rendered from `ModuleAccess` (`GET /modules/mine`), **not** from
 * the permission set: a role may hold `MANAGE_KITCHEN` without seeing six
 * kitchen pages it never opens (SPEC §6.3).
 *
 * Two invariants this file carries:
 *
 * 1. **Order is fixed.** `SPINE_PRIMARY` is SPEC §6.2 positions 1–8 and
 *    `SPINE_GROUPS` is the stated group order. Nothing sorts either list at
 *    runtime — `buildSpine()` only filters.
 * 2. **A module key with no route is absent.** The registry is the source of
 *    truth for "has a page". `shipments`, `customers`, `reviews` and
 *    `promotions` were seeded in `ModuleAccess` ahead of their screens and are
 *    listed below as of Phase 34, which ships `/shipments`, `/customers`,
 *    `/reviews` and `/promotions`. `talent` lands in v2.1 and is still absent,
 *    so granting that key can never produce a dead link.
 *
 * Module-key → group mapping (47 seeded keys):
 * - primary  : mission_control, my_tasks, my_quests, evidence, approvals,
 *              decisions, readiness, team
 * - header   : guide, chat            (rendered by `AppHeader`, never the spine)
 * - kitchen  : kds, pick_pack, prep_batches, recipes, ingredients,
 *              supply_usage, waste
 * - procurement: inventory, procurement, purchase_orders, vendors
 * - commerce : pos, orders, delivery, shipments, customers, reviews
 * - catalog  : catalog, experiences, brands, assets, promotions
 * - intelligence: analytics, kpis, feedback, exports
 * - admin    : imports, users, permissions, delegations, notices, settings,
 *              modules, guide_editor, zones, channels
 * - no route : talent (v2.1)
 *
 * `/leaderboard`, `/boards/wins`, `/team-contribution` and `/activity` are
 * routes without a spine entry — SPEC §6.2 merges them into `/team` and
 * Decision 11 keeps them reachable only from that hub's tabs. Likewise
 * `/missions`, `/boards/missions` and `/boards/quests`: reachable from Mission
 * Control and quest pages, absent here, which is what makes "no label appears
 * twice" achievable.
 */

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ClipboardList,
  Target,
  Eye,
  CheckCircle,
  ClipboardCheck,
  Gauge,
  Users,
  ChefHat,
  Salad,
  Package,
  PackageCheck,
  Monitor,
  PackageSearch,
  Trash2,
  ShoppingCart,
  TrendingUp,
  Truck,
  CalendarDays,
  Star,
  Tag,
  TicketPercent,
  FolderOpen,
  BarChart3,
  MessageSquare,
  Download,
  Upload,
  Shield,
  UserCheck,
  Megaphone,
  Settings,
  SlidersHorizontal,
  BookOpen,
  MapPin,
  Radio,
  UtensilsCrossed,
  Boxes,
} from 'lucide-react';
import type { ModuleKey } from '@/lib/types/modules';

export interface SpineItem {
  /** `ModuleAccess.module_key` that gates this item. */
  moduleKey: ModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface SpineGroupDef {
  id: string;
  label: string;
  items: SpineItem[];
}

/** SPEC §6.2 positions 1–8. Order is fixed and must not be sorted at runtime. */
export const SPINE_PRIMARY: SpineItem[] = [
  { moduleKey: 'mission_control', label: 'Mission Control', href: '/dashboard', icon: LayoutDashboard },
  { moduleKey: 'my_tasks', label: 'My Tasks', href: '/tasks', icon: ClipboardList },
  { moduleKey: 'my_quests', label: 'My Quests', href: '/quests?mine=1', icon: Target },
  { moduleKey: 'evidence', label: 'Evidence', href: '/boards/evidence', icon: Eye },
  { moduleKey: 'approvals', label: 'Approvals', href: '/approvals', icon: CheckCircle },
  { moduleKey: 'decisions', label: 'Decisions', href: '/decisions', icon: ClipboardCheck },
  { moduleKey: 'readiness', label: 'Readiness', href: '/readiness', icon: Gauge },
  { moduleKey: 'team', label: 'Team', href: '/team', icon: Users },
];

/** SPEC §6.2 collapsible groups, in the stated order. */
export const SPINE_GROUPS: SpineGroupDef[] = [
  {
    id: 'kitchen',
    label: 'Kitchen',
    items: [
      { moduleKey: 'kds', label: 'Kitchen Overview', href: '/operations/kitchen/dashboard', icon: LayoutDashboard },
      { moduleKey: 'kds', label: 'KDS', href: '/operations/kitchen/kds', icon: Monitor },
      { moduleKey: 'pick_pack', label: 'Pick & Pack', href: '/operations/kitchen/pick-and-pack', icon: Package },
      { moduleKey: 'prep_batches', label: 'Prep Batches', href: '/operations/kitchen/prep-batches', icon: ChefHat },
      { moduleKey: 'recipes', label: 'Recipes', href: '/operations/recipes', icon: UtensilsCrossed },
      { moduleKey: 'ingredients', label: 'Ingredients', href: '/operations/ingredients', icon: Salad },
      { moduleKey: 'supply_usage', label: 'Supply Usage', href: '/operations/kitchen/supply-usage', icon: ClipboardList },
      { moduleKey: 'waste', label: 'Waste Log', href: '/operations/kitchen/waste', icon: Trash2 },
    ],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    items: [
      { moduleKey: 'inventory', label: 'Inventory', href: '/operations/inventory', icon: PackageSearch },
      { moduleKey: 'inventory', label: 'Inventory Overview', href: '/operations/inventory/dashboard', icon: Boxes },
      { moduleKey: 'procurement', label: 'Procurement', href: '/operations/procurement', icon: TrendingUp },
      { moduleKey: 'purchase_orders', label: 'Purchase Orders', href: '/operations/purchase-orders', icon: ShoppingCart },
      { moduleKey: 'vendors', label: 'Vendors', href: '/operations/vendors', icon: Truck },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    items: [
      { moduleKey: 'pos', label: 'Take Order', href: '/pos', icon: ShoppingCart },
      { moduleKey: 'orders', label: 'Order History', href: '/pos/orders', icon: ClipboardList },
      { moduleKey: 'delivery', label: 'Delivery Queue', href: '/pos/delivery', icon: Truck },
      { moduleKey: 'shipments', label: 'Shipments', href: '/shipments', icon: PackageCheck },
      { moduleKey: 'customers', label: 'Customers', href: '/customers', icon: Users },
      { moduleKey: 'reviews', label: 'Reviews', href: '/reviews', icon: Star },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog & Experiences',
    items: [
      { moduleKey: 'catalog', label: 'Catalog', href: '/operations/menu', icon: UtensilsCrossed },
      { moduleKey: 'experiences', label: 'Experiences', href: '/operations/events', icon: CalendarDays },
      { moduleKey: 'brands', label: 'Brands', href: '/operations/brands', icon: Tag },
      { moduleKey: 'assets', label: 'Assets', href: '/operations/assets', icon: FolderOpen },
      { moduleKey: 'promotions', label: 'Promotions', href: '/promotions', icon: TicketPercent },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { moduleKey: 'analytics', label: 'Analytics', href: '/intelligence/analytics', icon: TrendingUp },
      { moduleKey: 'kpis', label: 'KPIs', href: '/kpis', icon: BarChart3 },
      { moduleKey: 'feedback', label: 'Feedback', href: '/operations/feedback', icon: MessageSquare },
      { moduleKey: 'exports', label: 'Exports', href: '/admin/exports', icon: Download },
      // Leaderboard is deliberately absent: SPEC §6.2 item 8 merges wins,
      // contribution, activity and leaderboard into `/team`, and Decision 11
      // keeps `/leaderboard` as a route reachable from the Team hub's tabs but
      // out of the spine. Listing it here under the all-roles `team` key would
      // also give every role a one-item Intelligence group, which contradicts
      // this task's own role-scoping check (TALENT_LEAD sees no groups).
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { moduleKey: 'imports', label: 'Import', href: '/admin/import', icon: Upload },
      { moduleKey: 'users', label: 'Users', href: '/admin/users', icon: Users },
      { moduleKey: 'permissions', label: 'Permissions', href: '/admin/permissions', icon: Shield },
      { moduleKey: 'delegations', label: 'Delegations', href: '/admin/delegations', icon: UserCheck },
      { moduleKey: 'notices', label: 'Notices', href: '/admin/notices', icon: Megaphone },
      { moduleKey: 'settings', label: 'Settings', href: '/admin/settings', icon: Settings },
      { moduleKey: 'settings', label: 'Node', href: '/admin/node', icon: MapPin },
      { moduleKey: 'modules', label: 'Modules', href: '/admin/modules', icon: SlidersHorizontal },
      { moduleKey: 'guide_editor', label: 'Guide Editor', href: '/admin/guide', icon: BookOpen },
      { moduleKey: 'zones', label: 'Zones', href: '/operations/zones', icon: MapPin },
      { moduleKey: 'channels', label: 'Channels', href: '/operations/channels', icon: Radio },
    ],
  },
];

/** SPEC §6.2: "Guide and Chat move to the header." Rendered by AppHeader, never in the spine. */
export const HEADER_MODULES: SpineItem[] = [
  { moduleKey: 'guide', label: 'Guide', href: '/guide', icon: BookOpen },
  { moduleKey: 'chat', label: 'Chat', href: '/chat', icon: MessageSquare },
];

export interface BuiltSpine {
  primary: SpineItem[];
  groups: SpineGroupDef[];
  header: SpineItem[];
}

/** SPEC §6.2: "No label appears twice." Asserted in development so a regression is loud. */
export function assertUniqueLabels(): void {
  const all = [
    ...SPINE_PRIMARY,
    ...SPINE_GROUPS.flatMap((g) => g.items),
    ...HEADER_MODULES,
  ].map((i) => i.label);
  const dupes = all.filter((l, i) => all.indexOf(l) !== i);
  if (dupes.length) {
    throw new Error(`Duplicate nav labels: ${[...new Set(dupes)].join(', ')}`);
  }
}

/** Filters the fixed structure by the caller's visible module keys. Order is never re-sorted. */
export function buildSpine(visible: readonly string[]): BuiltSpine {
  const has = new Set(visible);
  return {
    primary: SPINE_PRIMARY.filter((i) => has.has(i.moduleKey)),
    groups: SPINE_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => has.has(i.moduleKey)),
    })).filter((g) => g.items.length > 0),
    header: HEADER_MODULES.filter((i) => has.has(i.moduleKey)),
  };
}

/** The pathname half of an `href` — `/quests?mine=1` → `/quests`. */
export function hrefPath(href: string): string {
  const cut = href.search(/[?#]/);
  return cut === -1 ? href : href.slice(0, cut);
}

/**
 * The single spine entry that owns `pathname`: the longest route prefix that
 * matches. Longest-match is what keeps `/pos/orders` from lighting up both
 * "Take Order" (`/pos`) and "Order History" (`/pos/orders`).
 *
 * Returns the winning item's `href`, or `null` when the current route has no
 * spine entry (`/missions`, `/boards/wins`, `/notifications`, …).
 */
export function resolveActiveHref(
  pathname: string,
  spine: BuiltSpine,
): string | null {
  const candidates = [...spine.primary, ...spine.groups.flatMap((g) => g.items)];
  let best: string | null = null;
  let bestLength = -1;
  for (const item of candidates) {
    const path = hrefPath(item.href);
    if (pathname !== path && !pathname.startsWith(`${path}/`)) continue;
    if (path.length > bestLength) {
      best = item.href;
      bestLength = path.length;
    }
  }
  return best;
}

/** The group id that should auto-expand for `pathname`, or `null`. */
export function activeGroupId(
  pathname: string,
  spine: BuiltSpine,
): string | null {
  const active = resolveActiveHref(pathname, spine);
  if (!active) return null;
  return spine.groups.find((g) => g.items.some((i) => i.href === active))?.id ?? null;
}
