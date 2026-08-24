'use client';

/**
 * The loyalty account and its ledger (`GET /customers/:id` →
 * `loyalty_account` + `loyalty_transactions`), plus the staff adjust action.
 *
 * `loyalty_account` is `null` until something has touched the account once —
 * `LoyaltyService.getAccount` upserts it on first read, and the staff adjust
 * route does the same — so a customer who has never earned or burned a point
 * genuinely has no row. The panel says that plainly instead of rendering a zero
 * that looks like a fetched fact, and the adjust action still works: the first
 * adjustment creates the account.
 *
 * `lifetime_points` is the tier ladder's input and never decreases on a burn —
 * only `points_balance` does. Showing both is what makes an `insider` sitting on
 * zero points make sense at a glance.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Sparkles, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { STATUS_BADGE } from '@/lib/status-styles';
import { formatDateTime } from '@/lib/format/date';
import {
  LOYALTY_REASON_LABELS,
  type LoyaltyAccount,
  type LoyaltyTransaction,
} from '@/lib/types/checkout';
import { LoyaltyTierBadge } from '@/components/ops/customers/MarketingOptInBadge';
import {
  PanelEmpty,
  PanelHeading,
  formatPoints,
  formatPointsDelta,
} from '@/components/ops/customers/CustomerPanel';
import { LoyaltyAdjustDialog } from '@/components/ops/customers/LoyaltyAdjustDialog';

interface CustomerLoyaltyPanelProps {
  customerId: string;
  customerName: string;
  account: LoyaltyAccount | null;
  transactions: LoyaltyTransaction[];
}

export function CustomerLoyaltyPanel({
  customerId,
  customerName,
  account,
  transactions,
}: CustomerLoyaltyPanelProps) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const balance = account?.points_balance ?? 0;

  const adjustButton = (
    <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
      <Sparkles />
      Adjust points
    </Button>
  );

  return (
    <>
      <div className="space-y-4">
        <PanelHeading
          title="Loyalty"
          hint="Every adjustment writes a ledger row and an audit event."
          action={adjustButton}
        />

        <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
          <div className="space-y-0.5">
            <dt className="text-xs font-medium text-muted-foreground">Balance</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatPoints(balance)}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs font-medium text-muted-foreground">
              Lifetime points
            </dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatPoints(account?.lifetime_points ?? 0)}
            </dd>
            <p className="text-xs text-muted-foreground">Sets the tier; never burns down</p>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs font-medium text-muted-foreground">Tier</dt>
            <dd className="pt-1">
              <LoyaltyTierBadge tier={account?.tier ?? null} />
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs font-medium text-muted-foreground">Ledger rows</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {transactions.length}
            </dd>
            <p className="text-xs text-muted-foreground">50 most recent</p>
          </div>
        </dl>

        {transactions.length === 0 ? (
          <PanelEmpty
            icon={Wallet}
            title={account ? 'No loyalty activity yet' : 'No loyalty account yet'}
            description={
              account
                ? 'Points are earned when an order is delivered or an experience is attended — not when it is paid for.'
                : 'The account is created the first time this customer earns, burns or is adjusted.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>When</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Balance after</TableHead>
                  <TableHead className="hidden md:table-cell">Note</TableHead>
                  <TableHead className="hidden sm:table-cell">Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.reason === 'expire'
                            ? STATUS_BADGE.serious
                            : row.reason === 'adjust'
                              ? STATUS_BADGE.warning
                              : STATUS_BADGE.neutral
                        }
                      >
                        {LOYALTY_REASON_LABELS[row.reason]}
                      </Badge>
                      {row.expires_at && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Expires {formatDateTime(row.expires_at)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm font-bold tabular-nums ${
                        row.delta < 0 ? 'text-serious' : 'text-good'
                      }`}
                    >
                      {formatPointsDelta(row.delta)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatPoints(row.balance_after)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[20rem] text-sm text-muted-foreground">
                      {row.notes ?? '—'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {row.order_id ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          nativeButton={false}
                          aria-label="Open the order this row belongs to"
                          render={<Link href={`/pos/orders/${row.order_id}`} />}
                        >
                          <ExternalLink />
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <LoyaltyAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        customerId={customerId}
        customerName={customerName}
        currentBalance={balance}
      />
    </>
  );
}
