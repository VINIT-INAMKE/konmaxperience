'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ModuleAccess } from '@/lib/types/modules';
import { moduleLabel } from './module-routes';

/** One role column of the matrix. */
export interface RoleColumn {
  code: string;
  /** Full display name — used for tooltips and every `aria-label`. */
  name: string;
  /** Abbreviated heading; the matrix is eight columns wide. */
  short: string;
}

export interface ModuleAccessRowProps {
  module: ModuleAccess;
  roles: readonly RoleColumn[];
  /** The screen this key opens, or `null` when it has none in this release. */
  route: string | null;
  /** Whether the key is one of the fixed spine items (SPEC §6.2). */
  isPrimary: boolean;
  /** Uncommitted `sort_order` text; `undefined` when the row is untouched. */
  orderDraft: string | undefined;
  orderDirty: boolean;
  /** A `PATCH /modules/:key` for this row is in flight. */
  isPending: boolean;
  onToggleRole: (roleCode: string, next: boolean) => void;
  onToggleEnabled: (next: boolean) => void;
  onOrderDraftChange: (value: string) => void;
  onOrderCommit: () => void;
  onOrderRevert: () => void;
}

/** Shared by the desktop row and the mobile card so the labels stay identical. */
function rowText(module: ModuleAccess) {
  const label = moduleLabel(module.module_key);
  const orphaned = module.role_codes.length === 0;
  return { label, orphaned };
}

function OrphanWarning({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`No role can see ${label}`}
        className="inline-flex cursor-help items-center text-warning"
      >
        <AlertTriangle className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>No role can see this module</TooltipContent>
    </Tooltip>
  );
}

function RouteLink({ route, label }: { route: string | null; label: string }) {
  if (!route) {
    return (
      <Tooltip>
        <TooltipTrigger
          aria-label={`${label} has no screen in this release`}
          className="cursor-help font-mono text-xs text-ink-faint"
        >
          &mdash;
        </TooltipTrigger>
        <TooltipContent>No screen in this release</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Link
      href={route}
      className="inline-flex max-w-full items-center gap-1 rounded-sm font-mono text-xs text-brand underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="truncate">{route}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
    </Link>
  );
}

/** The numeric `sort_order` field. Commits on Enter or via the save bar. */
function OrderField({
  module,
  label,
  orderDraft,
  orderDirty,
  isPending,
  onOrderDraftChange,
  onOrderCommit,
  onOrderRevert,
  className,
}: Pick<
  ModuleAccessRowProps,
  | 'module'
  | 'orderDraft'
  | 'orderDirty'
  | 'isPending'
  | 'onOrderDraftChange'
  | 'onOrderCommit'
  | 'onOrderRevert'
> & { label: string; className?: string }) {
  return (
    <Input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      value={orderDraft ?? String(module.sort_order)}
      disabled={isPending}
      aria-label={`Sort order for ${label}`}
      aria-describedby={orderDirty ? 'module-order-unsaved' : undefined}
      onChange={(event) => onOrderDraftChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onOrderCommit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onOrderRevert();
        }
      }}
      className={cn(
        'h-7 text-center tabular-nums',
        orderDirty && 'border-brand bg-brand-soft',
        className,
      )}
    />
  );
}

/** Desktop matrix row. One `<tr>`; the module cell stays pinned while scrolling. */
export function ModuleAccessRow(props: ModuleAccessRowProps) {
  const {
    module,
    roles,
    route,
    isPrimary,
    isPending,
    onToggleRole,
    onToggleEnabled,
  } = props;
  const { label, orphaned } = rowText(module);

  return (
    <TableRow
      className={cn(
        // The pinned first cell needs an opaque background, so the row hover is
        // opaque too — otherwise the two tints do not line up.
        'group/row border-line hover:bg-surface-raised',
        !module.enabled && 'text-ink-muted',
      )}
      data-disabled={!module.enabled || undefined}
    >
      <TableCell className="sticky left-0 z-10 bg-card transition-colors group-hover/row:bg-surface-raised">
        <div className="flex min-w-0 items-start gap-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'truncate text-sm font-medium',
                  module.enabled ? 'text-ink' : 'text-ink-muted line-through',
                )}
              >
                {label}
              </span>
              {isPrimary && (
                <Tooltip>
                  <TooltipTrigger
                    aria-label={`${label} is a navigation spine item`}
                    className="cursor-help rounded-full bg-brand-soft px-1.5 py-px text-[10px] font-medium text-brand"
                  >
                    Spine
                  </TooltipTrigger>
                  <TooltipContent>
                    Fixed navigation spine item (SPEC §6.2)
                  </TooltipContent>
                </Tooltip>
              )}
              {orphaned && <OrphanWarning label={label} />}
            </div>
            <div className="truncate font-mono text-xs text-ink-muted">
              {module.module_key}
            </div>
          </div>
        </div>
      </TableCell>

      {roles.map((role) => {
        const checked = module.role_codes.includes(role.code);
        return (
          <TableCell key={role.code} className="text-center">
            <span className="inline-flex min-h-9 min-w-9 items-center justify-center">
              <Checkbox
                checked={checked}
                disabled={isPending}
                onCheckedChange={(next) => onToggleRole(role.code, next)}
                aria-label={`${role.name} can see ${label}`}
              />
            </span>
          </TableCell>
        );
      })}

      <TableCell className="text-center">
        <span className="inline-flex min-h-9 items-center justify-center">
          <Switch
            checked={module.enabled}
            disabled={isPending}
            onCheckedChange={(next) => onToggleEnabled(next)}
            aria-label={`${label} enabled`}
          />
        </span>
      </TableCell>

      <TableCell>
        <OrderField {...props} label={label} className="w-16" />
      </TableCell>

      <TableCell className="max-w-[170px]">
        <RouteLink route={route} label={label} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Below `lg` the eight-column matrix is unreadable, so the same row renders as a
 * card with the role grants laid out as a wrapping checkbox grid.
 */
export function ModuleAccessCard(props: ModuleAccessRowProps) {
  const {
    module,
    roles,
    route,
    isPrimary,
    isPending,
    onToggleRole,
    onToggleEnabled,
  } = props;
  const { label, orphaned } = rowText(module);
  const checkboxId = `module-${module.module_key}`;

  return (
    <li className="rounded-lg bg-card p-3 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'text-sm font-medium',
                module.enabled ? 'text-ink' : 'text-ink-muted line-through',
              )}
            >
              {label}
            </span>
            {isPrimary && (
              <span className="rounded-full bg-brand-soft px-1.5 py-px text-[10px] font-medium text-brand">
                Spine
              </span>
            )}
            {orphaned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-1.5 py-px text-[10px] font-medium text-warning">
                <AlertTriangle className="size-3" aria-hidden="true" />
                No role
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-xs text-ink-muted">
            {module.module_key}
          </div>
        </div>
        <Switch
          checked={module.enabled}
          disabled={isPending}
          onCheckedChange={(next) => onToggleEnabled(next)}
          aria-label={`${label} enabled`}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        {roles.map((role) => {
          const checked = module.role_codes.includes(role.code);
          const id = `${checkboxId}-${role.code}`;
          return (
            <div key={role.code} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={checked}
                disabled={isPending}
                onCheckedChange={(next) => onToggleRole(role.code, next)}
              />
              <label
                htmlFor={id}
                className="cursor-pointer truncate text-xs text-ink-subtle"
              >
                {role.short}
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">Order</span>
          <OrderField {...props} label={label} className="w-16" />
        </div>
        <RouteLink route={route} label={label} />
      </div>
    </li>
  );
}
