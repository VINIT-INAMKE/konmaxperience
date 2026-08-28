'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { formatPaise, paiseToRupees } from '@/lib/format/currency';
import { MOVEMENT_TYPE_LABELS } from '@/lib/types/inventory';
import {
  varianceBand,
  type ActualMovementLine,
  type FoodCostReport as FoodCostReportPayload,
  type VarianceBand,
} from '@/lib/types/food-cost';
import { FoodCostVarianceTable } from './FoodCostVarianceTable';

/** Presets plus the escape hatch, matching `/intelligence/analytics`'s toolbar. */
type RangePreset = '7d' | '30d' | 'month' | 'custom';

const PRESET_LABELS: Record<Exclude<RangePreset, 'custom'>, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
};

/** `YYYY-MM-DD` in the browser's local calendar — the same shape the API takes. */
function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function computeRange(
  preset: RangePreset,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  const today = new Date();
  if (preset === 'custom') return { from: customFrom, to: customTo };
  if (preset === 'month') {
    return {
      from: dayKey(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: dayKey(today),
    };
  }
  const span = preset === '7d' ? 7 : 30;
  return { from: dayKey(shiftDays(today, -(span - 1))), to: dayKey(today) };
}

/** Token classes per band. Colour lives in `tokens.css`; this maps meaning to it. */
const BAND_TEXT: Record<VarianceBand, string> = {
  good: 'text-[var(--status-good)]',
  warning: 'text-[var(--status-warning)]',
  serious: 'text-[var(--status-serious)]',
};

const BAND_ACCENT: Record<VarianceBand, string> = {
  good: 'border-l-[color:var(--status-good)]',
  warning: 'border-l-[color:var(--status-warning)]',
  serious: 'border-l-[color:var(--status-serious)]',
};

/**
 * The whole reason the variance is worth rendering. A number without its
 * direction is the kind of metric people learn to ignore, so the direction is
 * a sentence beside the figure, not a footnote in a plan.
 */
function varianceMeaning(amount: number): string {
  if (amount > 0) {
    return 'More stock left the store room than the recipes account for — over-portioning, unlogged waste, or theft.';
  }
  if (amount < 0) {
    return 'Less stock left the store room than the recipes account for — usually a stale recipe cost rather than a real saving.';
  }
  return 'The store room and the recipes agree exactly for this range.';
}

/** The chart ramp, with waste deliberately on the alarm token rather than a hue. */
const MOVEMENT_COLOR: Record<ActualMovementLine['movement_type'], string> = {
  order_deducted: 'var(--chart-1)',
  prep_deducted: 'var(--chart-2)',
  waste: 'var(--status-serious)',
  supply_usage: 'var(--chart-4)',
};

function HeadlineSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[0, 1, 2].map((card) => (
        <Card key={card}>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * RUN-03 — two independent readings of the same period, side by side.
 *
 * *Theoretical* is what the BOM says the food sold should have cost.
 * *Actual* is what actually left the store room, valued at the latest vendor
 * price. The gap between them is the finding; everything else on this screen
 * exists to tell a reader whether the gap is real or an artefact of missing
 * data — which is why `unpriced_ingredients` gets a banner and a zero unit cost
 * gets a badge instead of being quietly dropped.
 *
 * **Every money field on the payload is integer paise**, so nothing here
 * renders a raw number: `formatPaise` for text, `paiseToRupees` for the chart.
 */
export function FoodCostReport() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [customFrom, setCustomFrom] = useState(() => dayKey(shiftDays(new Date(), -29)));
  const [customTo, setCustomTo] = useState(() => dayKey(new Date()));
  /** The window whose data-quality banner has been dismissed, if any. */
  const [dismissedRange, setDismissedRange] = useState<string | null>(null);

  const { from, to } = computeRange(preset, customFrom, customTo);
  const rangeKey = `${from}_${to}`;
  const rangeValid = Boolean(from && to && from <= to);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['food-cost', from, to],
    queryFn: () =>
      apiClient.get<FoodCostReportPayload>(`/analytics/food-cost?from=${from}&to=${to}`),
    enabled: rangeValid,
  });

  const movementRows = useMemo(() => {
    const lines = data?.actual.by_movement_type ?? [];
    const total = data?.actual.total ?? 0;
    return lines.map((line) => ({
      key: line.movement_type,
      label: MOVEMENT_TYPE_LABELS[line.movement_type],
      cost: line.cost,
      rupees: paiseToRupees(line.cost),
      share: total > 0 ? (line.cost / total) * 100 : 0,
    }));
  }, [data]);

  const retry = () => {
    void queryClient.invalidateQueries({ queryKey: ['food-cost'] });
  };

  const band = varianceBand(data?.variance.percent ?? 0);
  const VarianceIcon =
    !data || data.variance.amount === 0
      ? Minus
      : data.variance.amount > 0
        ? ArrowUpRight
        : ArrowDownRight;

  const unpriced = data?.unpriced_ingredients ?? [];
  const showUnpriced = unpriced.length > 0 && dismissedRange !== rangeKey;
  const hasActivity = Boolean(data && (data.theoretical.total > 0 || data.actual.total > 0));

  return (
    <div className="space-y-6">
      {/* Range toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {data ? (
            <>
              Showing{' '}
              <span className="font-medium text-foreground">
                {format(new Date(`${data.from}T00:00:00`), 'd MMM yyyy')} –{' '}
                {format(new Date(`${data.to}T00:00:00`), 'd MMM yyyy')}
              </span>{' '}
              (node-local, inclusive)
            </>
          ) : (
            'Choose a window'
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(['7d', '30d', 'month'] as const).map((option) => (
            <Button
              key={option}
              variant={preset === option ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPreset(option)}
            >
              {PRESET_LABELS[option]}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger
              className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
                preset === 'custom'
                  ? 'bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              Custom
            </PopoverTrigger>
            <PopoverContent className="w-auto space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold" htmlFor="food-cost-from">
                    From
                  </label>
                  <input
                    id="food-cost-from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="mt-1 block w-full rounded-md border bg-background px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold" htmlFor="food-cost-to">
                    To
                  </label>
                  <input
                    id="food-cost-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="mt-1 block w-full rounded-md border bg-background px-2 py-1 text-sm"
                  />
                </div>
              </div>
              {customFrom > customTo && (
                <p className="text-xs text-[var(--status-serious)]">
                  &ldquo;From&rdquo; must not be after &ldquo;To&rdquo;.
                </p>
              )}
              <Button
                size="sm"
                disabled={!customFrom || !customTo || customFrom > customTo}
                onClick={() => setPreset('custom')}
              >
                Apply range
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Data quality: ingredients valued at zero (P6 decision 18) */}
      {showUnpriced && (
        <Alert className="border-l-4 border-l-[color:var(--status-warning)]">
          <AlertTriangle className="size-4 text-[var(--status-warning)]" />
          <AlertDescription>
            <span className="block pr-8">
              <strong className="font-semibold text-foreground">
                {unpriced.length} ingredient{unpriced.length === 1 ? '' : 's'} ha
                {unpriced.length === 1 ? 's' : 've'} no vendor price and{' '}
                {unpriced.length === 1 ? 'was' : 'were'} valued at ₹0
              </strong>{' '}
              — the actual figure below is understated, and so is the variance.
            </span>
            <span className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
              {unpriced.map((ingredient) => (
                <Link
                  key={ingredient.id}
                  href={`/operations/ingredients?highlight=${ingredient.id}`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {ingredient.name}
                </Link>
              ))}
            </span>
          </AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1.5 right-1.5 size-7 p-0"
            aria-label="Dismiss data quality warning"
            onClick={() => setDismissedRange(rangeKey)}
          >
            <X className="size-4" />
          </Button>
        </Alert>
      )}

      {/* Error */}
      {isError && (
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {error instanceof Error && error.message
                ? error.message
                : 'The food cost report could not be loaded for this range.'}
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      )}

      {/* Headline: theoretical · actual · variance */}
      {isLoading || !data ? (
        !isError && <HeadlineSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-[color:var(--chart-1)]">
            <CardContent className="p-5">
              <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">
                Theoretical
              </p>
              <p className="mt-2 font-mono text-3xl leading-tight font-bold tabular-nums">
                {formatPaise(data.theoretical.total)}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                {data.theoretical_pct_of_revenue.toFixed(2)}% of{' '}
                {formatPaise(data.revenue)} revenue · what the recipes say the food sold should
                have cost
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[color:var(--chart-2)]">
            <CardContent className="p-5">
              <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">Actual</p>
              <p className="mt-2 font-mono text-3xl leading-tight font-bold tabular-nums">
                {formatPaise(data.actual.total)}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                {data.actual_pct_of_revenue.toFixed(2)}% of revenue · what actually left the store
                room, valued at the latest vendor price
              </p>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${BAND_ACCENT[band]}`}>
            <CardContent className="p-5">
              <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">Variance</p>
              <p
                className={`mt-2 flex items-center gap-1.5 font-mono text-3xl leading-tight font-bold tabular-nums ${BAND_TEXT[band]}`}
              >
                <VarianceIcon className="size-6 shrink-0" aria-hidden />
                <span>
                  {data.variance.amount > 0 ? '+' : ''}
                  {formatPaise(data.variance.amount)}
                </span>
              </p>
              <p className={`mt-1 text-sm font-semibold ${BAND_TEXT[band]}`}>
                {data.variance.percent > 0 ? '+' : ''}
                {data.variance.percent.toFixed(2)}% against theoretical
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                {varianceMeaning(data.variance.amount)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Where the actual side came from */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold">Actual cost by movement type</CardTitle>
          <CardDescription>
            The four consuming movements, so a spike is attributable to waste rather than to
            orders. Stock <strong>adjustments are excluded</strong> — an adjustment is the
            correction <em>for</em> drift, and counting it would net this variance to zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : !hasActivity ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              Nothing moved and nothing sold in this range.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={movementRows}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v}`
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={false}
                      formatter={(value) => [
                        `₹${Number(value).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`,
                        'Cost',
                      ]}
                    />
                    <Bar dataKey="rupees" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {movementRows.map((row) => (
                        <Cell key={row.key} fill={MOVEMENT_COLOR[row.key]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2 lg:col-span-2">
                {movementRows.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-b-0"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: MOVEMENT_COLOR[row.key] }}
                        aria-hidden
                      />
                      {row.label}
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-sm font-bold tabular-nums">
                        {formatPaise(row.cost)}
                      </span>
                      <span className="block font-mono text-xs tabular-nums text-ink-muted">
                        {row.share.toFixed(1)}% of actual
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <FoodCostVarianceTable
        lines={data?.theoretical.by_product ?? []}
        total={data?.theoretical.total ?? 0}
        isLoading={isLoading && !isError}
        isError={isError}
        onRetry={retry}
      />
    </div>
  );
}
