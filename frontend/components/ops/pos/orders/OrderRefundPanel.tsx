'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format/currency';
import { refundableAmount } from '@/lib/types/refunds';
import type { Refund } from '@/lib/types/refunds';
import { RefundDialog } from './RefundDialog';
import { RefundHistoryTable } from './RefundHistoryTable';
import type { StaffOrderDetail } from './types';

/**
 * Why the refund button may be unavailable, in the server's own terms so the
 * screen and `RefundsService` cannot drift apart.
 */
function blockedReason(order: StaffOrderDetail): string | null {
  const payment = order.payment;
  if (!payment) return 'This order has no payment to refund.';
  if (payment.status !== 'paid' && payment.status !== 'partially_refunded') {
    return `A payment with status "${payment.status}" cannot be refunded.`;
  }
  if (payment.method !== 'razorpay' || !payment.razorpay_payment_id) {
    return 'Only Razorpay payments refund from here — record cash, card and UPI refunds manually.';
  }
  if (refundableAmount(payment) <= 0) {
    return 'This payment has already been refunded in full.';
  }
  return null;
}

interface OrderRefundPanelProps {
  order: StaffOrderDetail;
}

/**
 * `CHK-05` — the refund control and its ledger.
 *
 * The ledger is fetched separately from the order because a failed refund
 * changes it without changing the order at all, so the two must be able to
 * refetch independently.
 */
export function OrderRefundPanel({ order }: OrderRefundPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    data: refunds,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['orders', order.id, 'refunds'],
    queryFn: () => apiClient.get<Refund[]>(`/orders/${order.id}/refunds`),
  });

  const payment = order.payment;
  const blocked = blockedReason(order);
  const balance = payment ? refundableAmount(payment) : 0;

  return (
    <section className="space-y-3 rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Undo2 className="size-4 text-ink-muted" />
          <h2 className="text-sm font-semibold text-ink">Refunds</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Refundable{' '}
            <span className="font-mono font-semibold tabular-nums text-ink">
              {formatCurrency(balance)}
            </span>
          </span>
          <Button
            size="sm"
            variant="destructive"
            disabled={blocked !== null}
            onClick={() => setDialogOpen(true)}
          >
            Refund…
          </Button>
        </div>
      </div>

      {blocked ? (
        <p className="text-xs text-muted-foreground">{blocked}</p>
      ) : null}

      <RefundHistoryTable
        refunds={refunds ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
      />

      {/* Mounted only while open, so the dialog's state initialisers are its
          reset — see the note in `RefundDialog`. */}
      {payment && dialogOpen ? (
        <RefundDialog
          orderId={order.id}
          orderNumber={order.order_number}
          payment={payment}
          open
          onOpenChange={setDialogOpen}
        />
      ) : null}
    </section>
  );
}
