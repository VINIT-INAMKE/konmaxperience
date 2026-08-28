'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatPaise } from '@/lib/format/currency';
import { STATUS_BADGE } from '@/lib/status-styles';
import type { TheoreticalProductLine } from '@/lib/types/food-cost';

/** The columns a reader can reorder the table by. */
type SortKey = 'name' | 'quantity' | 'unit_cost' | 'cost';
type SortDirection = 'asc' | 'desc';

interface FoodCostVarianceTableProps {
  lines: TheoreticalProductLine[];
  /** Theoretical total in paise — the denominator of the share column. */
  total: number;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

const COLUMNS: {
  key: SortKey;
  label: string;
  align: 'left' | 'right';
  /** The direction a first click on this header should produce. */
  initial: SortDirection;
}[] = [
  { key: 'name', label: 'Product', align: 'left', initial: 'asc' },
  { key: 'quantity', label: 'Qty sold', align: 'right', initial: 'desc' },
  { key: 'unit_cost', label: 'Unit cost', align: 'right', initial: 'desc' },
  { key: 'cost', label: 'Theoretical cost', align: 'right', initial: 'desc' },
];

function compare(a: TheoreticalProductLine, b: TheoreticalProductLine, key: SortKey): number {
  if (key === 'name') return a.name.localeCompare(b.name);
  return a[key] - b[key];
}

/**
 * The theoretical side, product by product — what the BOM says the food sold
 * should have cost.
 *
 * Default order is `cost` descending, which matches the server's own sort and
 * puts the products that actually move the total at the top. The share column
 * is computed against the theoretical total the caller passes, not against the
 * sum of the rows, so it stays honest if the list is ever windowed.
 *
 * A `unit_cost` of ₹0.00 against a real quantity gets a **"no BOM cost"** badge
 * rather than being hidden. That row is the reason the theoretical total is too
 * low, and a reader who cannot see it will read the variance as theft.
 */
export function FoodCostVarianceTable({
  lines,
  total,
  isLoading,
  isError,
  onRetry,
}: FoodCostVarianceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [direction, setDirection] = useState<SortDirection>('desc');

  const sorted = useMemo(() => {
    const factor = direction === 'asc' ? 1 : -1;
    return [...lines].sort(
      (a, b) => compare(a, b, sortKey) * factor || a.name.localeCompare(b.name),
    );
  }, [lines, sortKey, direction]);

  const unpricedRows = useMemo(
    () => lines.filter((line) => line.unit_cost === 0 && line.quantity > 0).length,
    [lines],
  );

  function toggle(key: SortKey, initial: SortDirection) {
    if (key === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setDirection(initial);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold">Theoretical cost by product</CardTitle>
        <CardDescription>
          Units sold × the recipe&apos;s rolled-up cost, over orders that were not cancelled or
          refunded.
          {unpricedRows > 0 && (
            <>
              {' '}
              <span className="text-[var(--status-warning)]">
                {unpricedRows} product{unpricedRows === 1 ? '' : 's'} sold with no BOM cost — the
                theoretical total below is understated.
              </span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="space-y-3 py-2">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                The per-product breakdown could not be loaded for this range.
              </AlertDescription>
            </Alert>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        ) : isLoading ? (
          <div className="space-y-2 py-2">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <Skeleton key={row} className="h-9 w-full rounded-md" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            No orders in this range, so there is nothing for the recipes to account for.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((column) => {
                    const active = sortKey === column.key;
                    const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
                    return (
                      <TableHead
                        key={column.key}
                        className={column.align === 'right' ? 'text-right' : undefined}
                        aria-sort={
                          active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
                        }
                      >
                        <button
                          type="button"
                          onClick={() => toggle(column.key, column.initial)}
                          className={`inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 ${
                            active ? 'text-foreground' : ''
                          }`}
                        >
                          {column.label}
                          <Icon className="size-3" aria-hidden />
                        </button>
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((line) => {
                  const share = total > 0 ? (line.cost / total) * 100 : 0;
                  const noBom = line.unit_cost === 0;
                  return (
                    <TableRow key={line.product_id}>
                      <TableCell className="font-medium">
                        <span className="flex flex-wrap items-center gap-2">
                          {line.name}
                          {noBom && (
                            <Badge
                              variant="outline"
                              className={STATUS_BADGE.warning}
                              title="This product has no recipe, or a recipe whose cost was never rolled up. It contributes ₹0 to the theoretical total."
                            >
                              no BOM cost
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {line.quantity.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono tabular-nums ${
                          noBom ? 'text-[var(--status-warning)]' : ''
                        }`}
                      >
                        {formatPaise(line.unit_cost)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums">
                        {formatPaise(line.cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-2">
                          <span
                            className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-raised sm:block"
                            aria-hidden
                          >
                            <span
                              className="block h-full rounded-full bg-[var(--chart-1)]"
                              style={{ width: `${Math.min(share, 100)}%` }}
                            />
                          </span>
                          <span className="font-mono tabular-nums text-ink-muted">
                            {share.toFixed(1)}%
                          </span>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
