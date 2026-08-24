'use client';

/**
 * Coupon history (`GET /customers/:id` → `coupon_redemptions`).
 *
 * `CouponRedemption.amount` is the rupee value **this coupon** actually took off
 * that order. It is not the whole discount: `Order.discount_amount` bundles the
 * coupon and the loyalty burn into one column (P5a decision 23), and the two
 * halves are reconstructed — never guessed — from this row and from
 * `loyalty_points_redeemed × redeem_value_per_point`. So the Orders panel shows
 * the bundle and this panel shows the coupon half, and neither pretends to be
 * the other.
 *
 * One redemption per order per coupon is the DB's own rule, which is why a
 * per-customer usage limit can be enforced by counting these rows.
 */

import Link from 'next/link';
import { ExternalLink, TicketPercent } from 'lucide-react';
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
import { formatCurrency } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { COUPON_TYPE_LABELS } from '@/lib/types/promotions';
import type { CouponRedemption } from '@/lib/types/promotions';
import { PanelEmpty, PanelHeading } from '@/components/ops/customers/CustomerPanel';

interface CustomerCouponsPanelProps {
  redemptions: CouponRedemption[];
  /** `_count.coupon_redemptions` — the real total, which the slice truncates. */
  totalRedemptions: number;
}

export function CustomerCouponsPanel({
  redemptions,
  totalRedemptions,
}: CustomerCouponsPanelProps) {
  if (redemptions.length === 0) {
    return (
      <PanelEmpty
        icon={TicketPercent}
        title="No coupons used"
        description="Coupon redemptions are written at checkout, one row per coupon per order."
      />
    );
  }

  const total = redemptions.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="space-y-3">
      <PanelHeading
        title={`${redemptions.length} of ${totalRedemptions} redemptions`}
        hint={`${formatCurrency(total)} discounted across the rows shown. Loyalty burns are in the Loyalty ledger, not here.`}
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Coupon</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="hidden md:table-cell">Redeemed</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {redemptions.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.coupon ? (
                    <Badge variant="outline" className={STATUS_BADGE.info}>
                      <span className="font-mono">{row.coupon.code}</span>
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Coupon removed
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {row.coupon ? COUPON_TYPE_LABELS[row.coupon.type] : '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-bold tabular-nums">
                  {formatCurrency(row.amount)}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground whitespace-nowrap">
                  {formatDateTime(row.created_at)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    aria-label="Open the order this coupon was used on"
                    render={<Link href={`/pos/orders/${row.order_id}`} />}
                  >
                    <ExternalLink />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
