'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import {
  Boxes,
  CalendarDays,
  ChefHat,
  Link2Off,
  Package,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { optionalGet, unwrapList, type MaybePaginated } from '@/lib/api/optional';
import type { Task, TaskSubjectType } from '@/lib/types/tasks';

/**
 * The six subject types that name a record a person can open. `order` and
 * `decision` are also valid `TaskSubjectType`s but they are not "things the
 * quest touched" in the SPEC §6.4 sense, so they stay out of this list.
 */
type LinkedSubjectType = Extract<
  TaskSubjectType,
  'recipe' | 'product' | 'event' | 'vendor' | 'purchase_order' | 'prep_batch'
>;

/** The loose shape of one row from any of the six directory endpoints. */
interface DirectoryRow {
  id: string;
  name?: string | null;
  title?: string | null;
  vendor?: { name?: string | null } | null;
  recipe?: { name?: string | null } | null;
}

interface SubjectSource {
  /** Section heading — plural, because a section only exists when non-empty. */
  label: string;
  icon: LucideIcon;
  /** One batched lookup for the whole group, never one request per row. */
  path: string;
  /**
   * Shared with the screen that owns this list, so opening a quest after
   * visiting `/operations/recipes` costs nothing.
   */
  queryKey: readonly unknown[];
  href: (id: string) => string;
  titleOf: (row: DirectoryRow) => string | null;
}

/**
 * `/operations/events` and `/operations/vendors` have no `[id]` route, so those
 * two deep-link by query string onto the list screen rather than 404 on a
 * detail page that does not exist. The other four have real detail routes.
 */
const SUBJECT_SOURCES: Record<LinkedSubjectType, SubjectSource> = {
  recipe: {
    label: 'Recipes',
    icon: ChefHat,
    path: '/recipes',
    queryKey: ['recipes'],
    href: (id) => `/operations/recipes/${id}`,
    titleOf: (row) => row.name ?? null,
  },
  product: {
    label: 'Products',
    icon: Package,
    path: '/catalog/products/staff',
    queryKey: ['catalog', 'products', 'staff', 'all'],
    href: (id) => `/operations/menu?product=${id}`,
    titleOf: (row) => row.name ?? null,
  },
  event: {
    label: 'Events',
    icon: CalendarDays,
    path: '/events/all',
    queryKey: ['ops-events'],
    href: (id) => `/operations/events?event=${id}`,
    titleOf: (row) => row.title ?? null,
  },
  vendor: {
    label: 'Vendors',
    icon: Truck,
    path: '/vendors',
    queryKey: ['vendors'],
    href: (id) => `/operations/vendors?vendor=${id}`,
    titleOf: (row) => row.name ?? null,
  },
  purchase_order: {
    label: 'Purchase orders',
    icon: ShoppingCart,
    path: '/purchase-orders',
    queryKey: ['purchase-orders'],
    href: (id) => `/operations/purchase-orders/${id}`,
    titleOf: (row) => (row.vendor?.name ? `PO · ${row.vendor.name}` : null),
  },
  prep_batch: {
    label: 'Prep batches',
    icon: Boxes,
    path: '/kitchen/prep-batches',
    queryKey: ['prep-batches'],
    href: (id) => `/operations/kitchen/prep-batches?batch=${id}`,
    titleOf: (row) => (row.recipe?.name ? `Batch · ${row.recipe.name}` : null),
  },
};

/** Section order on the page — kitchen work first, money last. */
const SUBJECT_ORDER: LinkedSubjectType[] = [
  'recipe',
  'product',
  'prep_batch',
  'event',
  'vendor',
  'purchase_order',
];

function isLinkedSubjectType(
  value: TaskSubjectType | null,
): value is LinkedSubjectType {
  return value !== null && value in SUBJECT_SOURCES;
}

interface QuestLinkedEntitiesProps {
  tasks: Task[];
  isLoading?: boolean;
}

/**
 * SPEC §6.4 — "every quest page lists the linked POs, recipes, products,
 * batches and events". The quest owns no such columns; the link is the bridge
 * layer's `Task.subject_type` / `Task.subject_id`, so this reads the quest's
 * own task list and turns it inside out: grouped by the record touched instead
 * of by the work done.
 */
export function QuestLinkedEntities({
  tasks,
  isLoading = false,
}: QuestLinkedEntitiesProps) {
  /** `{ type → ordered, de-duplicated subject ids }`. */
  const grouped = useMemo(() => {
    const map = new Map<LinkedSubjectType, string[]>();
    for (const task of tasks) {
      if (!isLinkedSubjectType(task.subject_type) || !task.subject_id) continue;
      const bucket = map.get(task.subject_type);
      if (!bucket) map.set(task.subject_type, [task.subject_id]);
      else if (!bucket.includes(task.subject_id)) bucket.push(task.subject_id);
    }
    return map;
  }, [tasks]);

  /**
   * Six queries, one per type, each switched off unless the quest actually
   * touches that type — `useQueries` keeps the hook count stable while the
   * enabled set changes. Every read is optional: a role without procurement
   * access still sees its recipes, and the unnamed rows fall back to their id.
   */
  const directories = useQueries({
    queries: SUBJECT_ORDER.map((type) => ({
      queryKey: SUBJECT_SOURCES[type].queryKey,
      queryFn: () =>
        optionalGet<MaybePaginated<DirectoryRow>>(SUBJECT_SOURCES[type].path),
      enabled: grouped.has(type),
      staleTime: 5 * 60_000,
    })),
  });

  const sections = SUBJECT_ORDER.map((type, index) => ({
    type,
    ids: grouped.get(type) ?? [],
    rows: unwrapList(directories[index]?.data),
    isPending: grouped.has(type) && directories[index]?.isPending === true,
  })).filter((section) => section.ids.length > 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Linked records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardContent>
      </Card>
    );
  }

  if (sections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Linked records</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
          <Link2Off className="size-6 text-ink-faint" aria-hidden />
          <p className="text-sm text-ink-muted">
            Nothing is linked to this quest yet.
          </p>
          <p className="max-w-sm text-xs text-ink-faint">
            Records appear here once a task on this quest is attached to a
            recipe, product, batch, event, vendor or purchase order.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Linked records</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {sections.map(({ type, ids, rows, isPending }) => {
          const source = SUBJECT_SOURCES[type];
          const Icon = source.icon;
          const byId = new Map(rows.map((row) => [row.id, row]));

          return (
            <section key={type} className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                <Icon className="size-3.5 text-ink-faint" aria-hidden />
                {source.label}
                <span className="font-normal tabular-nums normal-case">
                  {ids.length}
                </span>
              </h3>
              <ul className="space-y-1">
                {ids.map((id) => {
                  const row = byId.get(id);
                  const title = row ? source.titleOf(row) : null;
                  return (
                    <li key={id}>
                      <Link
                        href={source.href(id)}
                        className="-mx-2 block truncate rounded-md px-2 py-1 text-sm text-ink transition-colors hover:bg-surface-raised hover:text-brand focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                      >
                        {title ? (
                          title
                        ) : isPending ? (
                          <span className="text-ink-muted">Loading…</span>
                        ) : (
                          // No title came back — the record may be filtered out
                          // of the directory this role can read. The link still
                          // works, so the id stands in rather than a blank row.
                          <span className="font-mono text-xs text-ink-muted">
                            {id}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
