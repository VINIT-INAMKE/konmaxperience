'use client';

import { AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_BADGE } from '@/lib/status-styles';
import { formatCurrency } from '@/lib/format/currency';
import { formatDateTime } from '@/lib/format/date';
import { REFUND_STATUS_LABELS } from '@/lib/types/refunds';
import type { Refund, RefundStatus } from '@/lib/types/refunds';

const REFUND_STATUS_STYLES: Record<RefundStatus, string> = {
  pending: STATUS_BADGE.warning,
  processed: STATUS_BADGE.good,
  failed: STATUS_BADGE.serious,
};

interface RefundHistoryTableProps {
  refunds: Refund[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/**
 * `GET /orders/:id/refunds`, newest first.
 *
 * `failed` rows are shown, not filtered: `RefundsService` opens the row *before*
 * calling the gateway and leaves it `failed` when the call is refused, so a row
 * that never moved money is still the auditable record that someone tried.
 */
export function RefundHistoryTable({
  refunds,
  isLoading,
  isError,
  onRetry,
}: RefundHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Could not load the refund ledger</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          The refunds for this order failed to load. Do not issue a new refund
          until you can see the history.
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (refunds.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-muted-foreground">
        No refunds have been attempted on this order.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <Table>
        <TableHeader>
          <TableRow className="bg-surface-raised">
            <TableHead>When</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Gateway refund</TableHead>
            <TableHead>Requested by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {refunds.map((refund) => (
            <TableRow key={refund.id}>
              <TableCell className="text-sm whitespace-nowrap">
                {formatDateTime(refund.created_at)}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                {formatCurrency(refund.amount)}
              </TableCell>
              <TableCell>
                <Badge className={REFUND_STATUS_STYLES[refund.status]}>
                  {REFUND_STATUS_LABELS[refund.status] ?? refund.status}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[16rem] text-sm text-ink-subtle">
                {refund.reason}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {refund.razorpay_refund_id ?? '—'}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {refund.requested_by ? refund.requested_by.slice(0, 8) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
