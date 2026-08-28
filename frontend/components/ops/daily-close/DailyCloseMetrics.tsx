'use client';

/**
 * RUN-02 — the five blocks of a daily close, in the order RUN-02 lists them:
 * orders and revenue by channel, waste, batches, stock reconciliation, and
 * shipments.
 *
 * Everything here renders `DailyClose.metrics` **verbatim**. Nothing is
 * re-derived, nothing is re-aggregated, nothing is fetched to "check" a figure:
 * the whole point of a close is that the numbers somebody signs are the numbers
 * that were frozen, so a screen that recomputed them would be showing a
 * different day from the one in the signature.
 *
 * Two honesty rules the copy enforces, because a number without its caveat is
 * worse than no number:
 *
 * - **GST is carved out of revenue, never added to it** (P5a decision 1). It
 *   renders through `<MoneyLine variant="of-which">`, which is the only shape
 *   that component will give it.
 * - **`stock_reconciliation.ran_at` is null on a clean night.** The job records
 *   drift and nothing else, so a missing timestamp means "nothing drifted", and
 *   the card says that rather than leaving an em dash that reads as an outage.
 */

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  ChefHat,
  ClipboardCheck,
  Package,
  Receipt,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MoneyLine } from '@/components/storefront/common/MoneyLine';
import { formatPaise, paiseToRupees } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { STATUS_BADGE } from '@/lib/status-styles';
import { ORDER_CHANNEL_LABELS, type OrderChannel } from '@/lib/types/kds';
import { WASTE_REASON_LABELS, type WasteReason } from '@/lib/types/kitchen';
import type { DailyCloseMetrics } from '@/lib/types/daily-close';

/** `spoilage` → `Spoilage`, and anything unrecognised keeps its own name. */
function wasteReasonLabel(reason: string): string {
  return (
    WASTE_REASON_LABELS[reason as WasteReason] ??
    reason.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

/** `dine_in` → `Dine-In`, with the same fallback. */
function channelLabel(channel: string): string {
  return (
    ORDER_CHANNEL_LABELS[channel as OrderChannel] ??
    channel.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
  /** Dims the figure when it is a zero that carries no news. */
  muted?: boolean;
}

function Stat({ label, value, hint, muted }: StatProps) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={
          muted
            ? 'text-lg font-semibold tabular-nums text-muted-foreground'
            : 'text-lg font-semibold tabular-nums'
        }
      >
        {value}
      </dd>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** An em-dash row for a block whose day was genuinely empty. */
function NothingRecorded({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function OrdersCard({ orders }: { orders: DailyCloseMetrics['orders'] }) {
  const hasOrders = orders.by_channel.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          Orders &amp; revenue
        </CardTitle>
        <CardDescription>
          Orders placed on this business day, excluding cancelled and refunded
          ones — those are counted separately below rather than netted out.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasOrders ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.by_channel.map((row) => (
                  <TableRow key={row.channel}>
                    <TableCell className="font-medium">
                      {channelLabel(row.channel)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.orders}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPaise(row.revenue_paise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">All channels</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {orders.total}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatPaise(orders.revenue_paise)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ) : (
          <NothingRecorded>
            No orders were placed on this day. The close is still a real
            artefact — an empty day is a fact worth signing.
          </NothingRecorded>
        )}

        {hasOrders ? (
          <div className="space-y-1.5 rounded-lg border border-line bg-surface-sunken p-4">
            <p className="pb-1 text-xs font-medium text-muted-foreground">
              How the day&apos;s takings reconcile
            </p>
            <MoneyLine
              label="Item subtotal"
              value={paiseToRupees(orders.subtotal_paise)}
            />
            {orders.channel_modifier_paise !== 0 ? (
              <MoneyLine
                label="Channel modifier"
                value={paiseToRupees(orders.channel_modifier_paise)}
              />
            ) : null}
            {orders.discount_paise !== 0 ? (
              <MoneyLine
                label="Discounts"
                value={paiseToRupees(orders.discount_paise)}
                sign="minus"
              />
            ) : null}
            {orders.shipping_paise !== 0 ? (
              <MoneyLine
                label="Shipping"
                value={paiseToRupees(orders.shipping_paise)}
              />
            ) : null}
            <MoneyLine
              label="Revenue"
              value={paiseToRupees(orders.revenue_paise)}
              variant="total"
            />
            <MoneyLine
              label="GST"
              value={paiseToRupees(orders.tax_paise)}
              variant="of-which"
            />
            <MoneyLine
              label="Net of GST"
              value={paiseToRupees(orders.net_revenue_paise)}
              note="What the node keeps before cost."
            />
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Cancelled"
            value={String(orders.cancelled)}
            muted={orders.cancelled === 0}
            hint="Not in revenue"
          />
          <Stat
            label="Refunded orders"
            value={String(orders.refunded)}
            muted={orders.refunded === 0}
            hint="Not in revenue"
          />
          <Stat
            label="Refunds processed"
            value={String(orders.refunds)}
            muted={orders.refunds === 0}
            hint="Rail confirmed today"
          />
          <Stat
            label="Refunded amount"
            value={formatPaise(orders.refund_amount_paise)}
            muted={orders.refund_amount_paise === 0}
            hint="Money returned today"
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function WasteCard({ waste }: { waste: DailyCloseMetrics['waste'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="size-4 text-muted-foreground" />
          Waste
        </CardTitle>
        <CardDescription>
          Everything logged to the waste book on this day, and what it cost.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-4">
          <Stat
            label="Entries"
            value={String(waste.entries)}
            muted={waste.entries === 0}
          />
          <Stat
            label="Cost"
            value={formatPaise(waste.cost_paise)}
            muted={waste.cost_paise === 0}
          />
        </dl>

        {waste.by_reason.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waste.by_reason.map((row) => (
                  <TableRow key={row.reason}>
                    <TableCell className="font-medium">
                      {wasteReasonLabel(row.reason)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.entries}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPaise(row.cost_paise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <NothingRecorded>
            Nothing was written off on this day.
          </NothingRecorded>
        )}
      </CardContent>
    </Card>
  );
}

function BatchesCard({ batches }: { batches: DailyCloseMetrics['batches'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChefHat className="size-4 text-muted-foreground" />
          Prep batches
        </CardTitle>
        <CardDescription>
          Batches opened on this day. &ldquo;Opened and depleted&rdquo; counts
          how many of <em>those same</em> batches were empty by the time the
          close ran — a batch opened yesterday and finished today is in neither
          figure, because a prep batch records no depletion time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          <Stat
            label="Opened"
            value={String(batches.created)}
            muted={batches.created === 0}
          />
          <Stat
            label="Opened and depleted"
            value={String(batches.depleted)}
            muted={batches.depleted === 0}
            hint="Same-day only"
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function ReconciliationCard({
  reconciliation,
}: {
  reconciliation: DailyCloseMetrics['stock_reconciliation'];
}) {
  const drifted = reconciliation.drifted > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-muted-foreground" />
          Stock reconciliation
          {drifted ? (
            <Badge variant="outline" className={STATUS_BADGE.warning}>
              <AlertTriangle />
              {reconciliation.drifted} drifted
            </Badge>
          ) : (
            <Badge variant="outline" className={STATUS_BADGE.good}>
              Clean
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          The nightly job compares recorded stock against what the day&apos;s
          consumption implies. It writes a row <em>only</em> when the two
          disagree.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat
            label="Stock rows checked"
            value={String(reconciliation.checked)}
            hint="As of the computation"
          />
          <Stat
            label="Drifted"
            value={String(reconciliation.drifted)}
            muted={!drifted}
          />
          <Stat
            label="Last drift recorded"
            value={
              reconciliation.ran_at
                ? formatDateTime(reconciliation.ran_at)
                : 'None'
            }
            muted={!reconciliation.ran_at}
            hint={
              reconciliation.ran_at
                ? undefined
                : 'No timestamp means nothing drifted, not that the job was skipped.'
            }
          />
        </dl>

        {drifted ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/operations/inventory" />}
            >
              Review ingredient stock
              <ArrowUpRight />
            </Button>
            <p className="text-xs text-muted-foreground">
              The per-ingredient detail for each drift is written to the audit
              log as <code>stock.reconciliation_mismatch</code>.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ShipmentsCard({
  shipments,
}: {
  shipments: DailyCloseMetrics['shipments'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" />
          Shipments
          {shipments.failed > 0 ? (
            <Badge variant="outline" className={STATUS_BADGE.serious}>
              <AlertTriangle />
              {shipments.failed} failed
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Parcels <em>created</em> on this day, folded by where they ended up.
          The four counts are disjoint and add up to the day&apos;s dispatches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Still open"
            value={String(shipments.open)}
            muted={shipments.open === 0}
            hint="Someone's problem"
          />
          <Stat
            label="Failed"
            value={String(shipments.failed)}
            muted={shipments.failed === 0}
            hint="Needs a human"
          />
          <Stat
            label="Delivered"
            value={String(shipments.delivered)}
            muted={shipments.delivered === 0}
          />
          <Stat
            label="Cancelled"
            value={String(shipments.cancelled)}
            muted={shipments.cancelled === 0}
          />
        </dl>

        {shipments.open > 0 || shipments.failed > 0 ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/shipments" />}
          >
            <Boxes />
            Open the shipments queue
            <ArrowUpRight />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export interface DailyCloseMetricsPanelProps {
  metrics: DailyCloseMetrics;
}

/**
 * The five RUN-02 blocks. Named `…Panel` so it does not collide with the
 * `DailyCloseMetrics` *type* it renders — the file keeps the plan's name, the
 * export says what it is.
 */
export function DailyCloseMetricsPanel({
  metrics,
}: DailyCloseMetricsPanelProps) {
  return (
    <div className="space-y-6">
      <OrdersCard orders={metrics.orders} />
      <div className="grid gap-6 lg:grid-cols-2">
        <WasteCard waste={metrics.waste} />
        <BatchesCard batches={metrics.batches} />
      </div>
      <ReconciliationCard reconciliation={metrics.stock_reconciliation} />
      <ShipmentsCard shipments={metrics.shipments} />
    </div>
  );
}
