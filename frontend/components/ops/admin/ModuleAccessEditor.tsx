'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { apiClient, ApiError } from '@/lib/api-client';
import { useUsageEvent } from '@/lib/hooks/use-usage-event';
import { USAGE_ACTIONS } from '@/lib/types/usage';
import { ROLE_DISPLAY_NAMES, RoleCode } from '@/lib/types/roles';
import type {
  ModuleAccess,
  ModuleKey,
  UpdateModuleAccessPayload,
} from '@/lib/types/modules';
import { cn } from '@/lib/utils';
import {
  MODULE_BANDS,
  MODULE_ROUTES,
  OVERFLOW_BAND,
  PRIMARY_MODULE_KEYS,
  ROLE_SHORT_LABELS,
  bandForSortOrder,
  moduleLabel,
  type ModuleBand,
} from './module-routes';
import {
  ModuleAccessCard,
  ModuleAccessRow,
  type RoleColumn,
} from './ModuleAccessRow';

const MODULES_KEY = ['modules'] as const;
const MY_MODULES_KEY = ['modules', 'mine'] as const;

/** Shape `GET /roles` returns; the API already hides the `SYSTEM` role. */
interface RoleSummary {
  id: string;
  code: string;
  name: string;
}

interface PatchVariables {
  key: ModuleKey;
  body: UpdateModuleAccessPayload;
  /** Toast shown once the server confirms the write. */
  message: string;
}

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  run: () => void;
}

const ROLE_FILTER_ALL = '__all__';

function isIntegerText(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function ModuleAccessEditor() {
  const queryClient = useQueryClient();
  const { trackAction } = useUsageEvent();

  const {
    data: modules,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: MODULES_KEY,
    queryFn: () => apiClient.get<ModuleAccess[]>('/modules'),
  });

  const { data: apiRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient.get<RoleSummary[]>('/roles'),
  });

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(ROLE_FILTER_ALL);
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  /**
   * Columns are the eight declared `RoleCode`s in declaration order, plus any
   * further code the API or an existing grant mentions, so a role added on the
   * backend never silently disappears from the matrix.
   */
  const roleColumns = useMemo<RoleColumn[]>(() => {
    const declared = Object.values(RoleCode) as string[];
    const nameByCode = new Map((apiRoles ?? []).map((r) => [r.code, r.name]));
    const seen = new Set(declared);
    const extras: string[] = [];
    for (const code of nameByCode.keys()) {
      if (!seen.has(code)) {
        seen.add(code);
        extras.push(code);
      }
    }
    for (const row of modules ?? []) {
      for (const code of row.role_codes) {
        if (!seen.has(code)) {
          seen.add(code);
          extras.push(code);
        }
      }
    }
    extras.sort();
    return [...declared, ...extras].map((code) => {
      const name =
        ROLE_DISPLAY_NAMES[code as RoleCode] ?? nameByCode.get(code) ?? code;
      return {
        code,
        name,
        short: ROLE_SHORT_LABELS[code as RoleCode] ?? name,
      };
    });
  }, [apiRoles, modules]);

  const patch = useMutation<
    ModuleAccess,
    unknown,
    PatchVariables,
    { previous?: ModuleAccess[] }
  >({
    mutationFn: ({ key, body }) =>
      apiClient.patch<ModuleAccess>(
        `/modules/${encodeURIComponent(key)}`,
        body,
      ),
    onMutate: async ({ key, body }) => {
      setPending((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
      await queryClient.cancelQueries({ queryKey: MODULES_KEY });
      const previous = queryClient.getQueryData<ModuleAccess[]>(MODULES_KEY);
      queryClient.setQueryData<ModuleAccess[]>(MODULES_KEY, (rows) =>
        rows?.map((row) =>
          row.module_key === key ? { ...row, ...body } : row,
        ),
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(MODULES_KEY, context.previous);
      }
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Could not save module access. Nothing was changed.',
      );
    },
    onSuccess: (_data, variables) => {
      trackAction(USAGE_ACTIONS.MODULE_ACCESS_UPDATE, {
        module_key: variables.key,
      });
      toast.success(variables.message);
    },
    onSettled: (_data, _error, variables) => {
      setPending((prev) => {
        const next = { ...prev };
        const count = (next[variables.key] ?? 1) - 1;
        if (count <= 0) delete next[variables.key];
        else next[variables.key] = count;
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: MODULES_KEY });
      void queryClient.invalidateQueries({ queryKey: MY_MODULES_KEY });
    },
  });

  const rows = useMemo(() => {
    return [...(modules ?? [])].sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.module_key.localeCompare(b.module_key),
    );
  }, [modules]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (
        roleFilter !== ROLE_FILTER_ALL &&
        !row.role_codes.includes(roleFilter)
      ) {
        return false;
      }
      if (!query) return true;
      return (
        row.module_key.toLowerCase().includes(query) ||
        moduleLabel(row.module_key).toLowerCase().includes(query)
      );
    });
  }, [rows, roleFilter, search]);

  const bandedRows = useMemo(() => {
    const buckets = new Map<
      string,
      { band: ModuleBand; rows: ModuleAccess[] }
    >();
    for (const band of [...MODULE_BANDS, OVERFLOW_BAND]) {
      buckets.set(band.id, { band, rows: [] });
    }
    for (const row of visibleRows) {
      buckets.get(bandForSortOrder(row.sort_order).id)?.rows.push(row);
    }
    return [...buckets.values()].filter((bucket) => bucket.rows.length > 0);
  }, [visibleRows]);

  const dirtyOrders = useMemo(() => {
    const dirty: { row: ModuleAccess; draft: string }[] = [];
    for (const row of rows) {
      const draft = orderDrafts[row.module_key];
      if (draft === undefined) continue;
      if (isIntegerText(draft) && Number(draft) === row.sort_order) continue;
      dirty.push({ row, draft });
    }
    return dirty;
  }, [rows, orderDrafts]);

  const dirtyKeys = useMemo(
    () => new Set(dirtyOrders.map((entry) => entry.row.module_key)),
    [dirtyOrders],
  );

  // Browser-level guard. Route changes inside the app cannot be intercepted in
  // the App Router, so the save bar below stays visible until the drafts land.
  useEffect(() => {
    if (dirtyOrders.length === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyOrders.length]);

  const clearDraft = useCallback((key: ModuleKey) => {
    setOrderDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const commitOrder = useCallback(
    (row: ModuleAccess) => {
      const draft = orderDrafts[row.module_key];
      if (draft === undefined) return;
      if (!isIntegerText(draft)) {
        toast.error('Order must be a whole number of 0 or more.');
        return;
      }
      const parsed = Number(draft);
      if (parsed === row.sort_order) {
        clearDraft(row.module_key);
        return;
      }
      patch.mutate(
        {
          key: row.module_key,
          body: { sort_order: parsed },
          message: `${moduleLabel(row.module_key)} moved to order ${parsed}.`,
        },
        { onSuccess: () => clearDraft(row.module_key) },
      );
    },
    [orderDrafts, patch, clearDraft],
  );

  const commitAllOrders = useCallback(() => {
    for (const { row } of dirtyOrders) commitOrder(row);
  }, [dirtyOrders, commitOrder]);

  const handleToggleRole = useCallback(
    (row: ModuleAccess, roleCode: string, next: boolean) => {
      const roleName =
        roleColumns.find((r) => r.code === roleCode)?.name ?? roleCode;
      const label = moduleLabel(row.module_key);
      const role_codes = next
        ? [...row.role_codes, roleCode]
        : row.role_codes.filter((code) => code !== roleCode);
      const run = () =>
        patch.mutate({
          key: row.module_key,
          body: { role_codes },
          message: next
            ? `${roleName} can now see ${label}.`
            : `${roleName} can no longer see ${label}.`,
        });

      if (!next && role_codes.length === 0) {
        setConfirm({
          title: 'Remove the last role?',
          description: `No role will be able to see ${label}. Continue?`,
          confirmLabel: 'Remove anyway',
          run,
        });
        return;
      }
      run();
    },
    [patch, roleColumns],
  );

  const handleToggleEnabled = useCallback(
    (row: ModuleAccess, next: boolean) => {
      const label = moduleLabel(row.module_key);
      const run = () =>
        patch.mutate({
          key: row.module_key,
          body: { enabled: next },
          message: next ? `${label} enabled.` : `${label} disabled.`,
        });

      if (!next && PRIMARY_MODULE_KEYS.includes(row.module_key)) {
        setConfirm({
          title: 'Disable a navigation spine item?',
          description: `${label} is one of the fixed spine destinations. Disabling it removes ${label} from every role's navigation, including yours. Continue?`,
          confirmLabel: 'Disable anyway',
          run,
        });
        return;
      }
      run();
    },
    [patch],
  );

  const rowProps = useCallback(
    (row: ModuleAccess) => ({
      module: row,
      roles: roleColumns,
      route: MODULE_ROUTES[row.module_key] ?? null,
      isPrimary: PRIMARY_MODULE_KEYS.includes(row.module_key),
      orderDraft: orderDrafts[row.module_key],
      orderDirty: dirtyKeys.has(row.module_key),
      isPending: (pending[row.module_key] ?? 0) > 0,
      onToggleRole: (roleCode: string, next: boolean) =>
        handleToggleRole(row, roleCode, next),
      onToggleEnabled: (next: boolean) => handleToggleEnabled(row, next),
      onOrderDraftChange: (value: string) =>
        setOrderDrafts((prev) => ({ ...prev, [row.module_key]: value })),
      onOrderCommit: () => commitOrder(row),
      onOrderRevert: () => clearDraft(row.module_key),
    }),
    [
      roleColumns,
      orderDrafts,
      dirtyKeys,
      pending,
      handleToggleRole,
      handleToggleEnabled,
      commitOrder,
      clearDraft,
    ],
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const disabled = rows.filter((row) => !row.enabled).length;
    const orphaned = rows.filter((row) => row.role_codes.length === 0).length;
    return { total, disabled, orphaned };
  }, [rows]);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-9 w-full max-w-md animate-pulse rounded-lg bg-surface-raised motion-reduce:animate-none" />
        <div className="h-[420px] w-full animate-pulse rounded-lg bg-surface-raised motion-reduce:animate-none" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-card py-12 text-center ring-1 ring-foreground/10">
        <AlertCircle className="size-8 text-serious" aria-hidden="true" />
        <p className="text-sm text-ink-muted">
          Can&apos;t load module access right now.
        </p>
        <Button variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const columnCount = roleColumns.length + 4;

  return (
    <div className="space-y-4">
      {/* Filters + counts */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search modules…"
            aria-label="Search modules"
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal
            className="size-3.5 shrink-0 text-ink-muted"
            aria-hidden="true"
          />
          <Select
            value={roleFilter}
            onValueChange={(value: unknown) => setRoleFilter(value as string)}
          >
            <SelectTrigger className="w-[190px]" aria-label="Filter by role">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROLE_FILTER_ALL}>All roles</SelectItem>
              {roleColumns.map((role) => (
                <SelectItem key={role.code} value={role.code}>
                  Visible to {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-ink-muted sm:ml-auto" aria-live="polite">
          <span className="font-medium text-ink">{visibleRows.length}</span> of{' '}
          {stats.total} modules
          {stats.disabled > 0 && <> · {stats.disabled} disabled</>}
          {stats.orphaned > 0 && (
            <> · <span className="text-warning">{stats.orphaned} with no role</span></>
          )}
        </p>
      </div>

      {visibleRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-card py-12 text-center ring-1 ring-foreground/10">
          <p className="text-sm text-ink">No module matches that filter.</p>
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setRoleFilter(ROLE_FILTER_ALL);
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          {/*
            The matrix owns its own scroll box rather than using <Table>'s
            wrapper: sticky column headings need one element that scrolls in
            both axes, and `overflow-x-auto` alone leaves `top` sticky inert.
          */}
          <div className="relative hidden max-h-[min(70vh,44rem)] overflow-auto rounded-lg bg-card ring-1 ring-foreground/10 lg:block">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="[&_tr]:border-b [&_tr]:border-line">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky top-0 left-0 z-40 w-[220px] min-w-[220px] bg-card">
                    Module
                  </TableHead>
                  {roleColumns.map((role) => (
                    <TableHead
                      key={role.code}
                      className="sticky top-0 z-30 w-[84px] min-w-[84px] bg-card px-1 text-center"
                    >
                      <Tooltip>
                        <TooltipTrigger
                          aria-label={role.name}
                          className="cursor-help text-[11px] leading-tight font-medium"
                        >
                          {role.short}
                        </TooltipTrigger>
                        <TooltipContent>{role.name}</TooltipContent>
                      </Tooltip>
                    </TableHead>
                  ))}
                  <TableHead className="sticky top-0 z-30 w-[86px] min-w-[86px] bg-card text-center">
                    Enabled
                  </TableHead>
                  <TableHead className="sticky top-0 z-30 w-[88px] min-w-[88px] bg-card">
                    Order
                  </TableHead>
                  <TableHead className="sticky top-0 z-30 w-[170px] min-w-[170px] bg-card">
                    Route
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bandedRows.map(({ band, rows: bandRows }) => (
                  <Fragment key={band.id}>
                    <TableRow className="border-line hover:bg-transparent">
                      <TableCell
                        colSpan={columnCount}
                        className="sticky top-10 z-20 bg-surface-sunken p-0"
                      >
                        <div className="sticky left-0 flex w-fit items-center gap-2 px-2 py-1.5">
                          <span className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                            {band.label}
                          </span>
                          <span className="rounded-full bg-surface-raised px-1.5 py-px text-[10px] font-medium text-ink-muted tabular-nums">
                            {bandRows.length}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {bandRows.map((row) => (
                      <ModuleAccessRow
                        key={row.module_key}
                        {...rowProps(row)}
                      />
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </table>
          </div>

          {/* Below lg the matrix becomes one card per module. */}
          <div className="space-y-5 lg:hidden">
            {bandedRows.map(({ band, rows: bandRows }) => (
              <section key={band.id} aria-labelledby={`band-${band.id}`}>
                <h2
                  id={`band-${band.id}`}
                  className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wider text-ink-muted uppercase"
                >
                  {band.label}
                  <span className="rounded-full bg-surface-raised px-1.5 py-px text-[10px] font-medium tabular-nums normal-case">
                    {bandRows.length}
                  </span>
                </h2>
                <ul className="space-y-2">
                  {bandRows.map((row) => (
                    <ModuleAccessCard key={row.module_key} {...rowProps(row)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {/* Unsaved sort-order drafts. Role and Enabled writes save immediately. */}
      {dirtyOrders.length > 0 && (
        <div
          id="module-order-unsaved"
          role="status"
          className={cn(
            'sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center gap-3',
            'border-t border-line bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6',
          )}
        >
          <span className="mr-auto text-sm text-ink-subtle">
            <span className="font-medium text-ink">{dirtyOrders.length}</span>{' '}
            unsaved order {dirtyOrders.length === 1 ? 'change' : 'changes'}
          </span>
          <Button
            variant="ghost"
            onClick={() => setOrderDrafts({})}
            disabled={patch.isPending}
          >
            Discard
          </Button>
          <Button onClick={commitAllOrders} disabled={patch.isPending}>
            {patch.isPending && (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            Save order
          </Button>
        </div>
      )}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                confirm?.run();
                setConfirm(null);
              }}
            >
              {confirm?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
